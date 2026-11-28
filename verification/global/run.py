#!/usr/bin/env python3
"""Medición de la búsqueda global no circular (F7.7: A2, A2b y A3 a A9) sobre los 40 modelos de X37.

Se corre con el Python del oráculo (`$TMPDIR/oracle-venv/bin/python`, cslope 0.1.0 y shapely):

    export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch
    export CARGO_TARGET_DIR=$TMPDIR/cm-m/target
    cargo build --release -p ogs-cli && cp $CARGO_TARGET_DIR/release/ogs $TMPDIR/cm-m/ogs
    cargo build --release -p ogs-cli --features parallel && cp $CARGO_TARGET_DIR/release/ogs $TMPDIR/cm-m/ogs-parallel
    env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python verification/global/run.py \
        --bin $TMPDIR/cm-m/ogs --parallel-bin $TMPDIR/cm-m/ogs-parallel

Pasos (`--steps`, todos por defecto): `measure` (los 40 modelos y los casos no circulares extra: circular, refinamiento,
global, repeticiones, binario paralelo, reevaluación de la polilínea ganadora y cSlope), `robust` (A2b, 48 semillas),
`a9` (el generador de Rust contra el prototipo) y `report` (REPORT.md y REPORT.json). Cada paso guarda su resultado en
`--work` (por defecto `$TMPDIR/cm-m/global-work`), de modo que `report` se repite sin volver a medir. Las compuertas A1
y A10 (las del repositorio) las llena `gates_repo.json`, si existe.

Salida: 0 si todas las compuertas medidas pasan, 1 si alguna falla.
"""
import argparse
import hashlib
import json
import os
import resource
import statistics
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import entries as E  # noqa: E402

TMP = Path(os.environ.get("TMPDIR", "/tmp"))
REPS = 3
BAND = (1.01, 0.034950495049504954)        # V053: publicado ± tolerancia del caso (F7.7, A2)
NEW_NOTES = {"non_circular_global_no_candidates", "non_circular_global_tension_rejected"}
TENSION = {"negative_lambda", "negative_effective_normal_major"}


# ------------------------------------------------------------------ ejecución

def call(binary, model):
    """Una corrida del binario: texto de salida, tiempos de pared y de CPU del hijo."""
    before = resource.getrusage(resource.RUSAGE_CHILDREN)
    t = time.perf_counter()
    p = subprocess.run([str(binary), "analyze", "/dev/stdin"], input=json.dumps(model), text=True, capture_output=True)
    wall = time.perf_counter() - t
    after = resource.getrusage(resource.RUSAGE_CHILDREN)
    cpu = (after.ru_utime - before.ru_utime) + (after.ru_stime - before.ru_stime)
    if p.returncode:
        raise RuntimeError(p.stderr.strip() or f"código {p.returncode}")
    return dict(text=p.stdout, wall=wall, cpu=cpu)


def results(text):
    return {r["method"]: r for r in json.loads(text)["results"]}


def summary(run):
    """Lo que se guarda de una corrida: por método, FS, estado, avisos, superficie y contadores."""
    out = {}
    for method, r in results(run["text"]).items():
        nc = (r.get("search") or {}).get("non_circular") or {}
        out[method] = dict(fos=r["fos"], status=r["status"], warnings=r["warnings"], surface=r["surface"],
                           seed_fos=nc.get("seed_fos"), polyline_fos=nc.get("polyline_fos"), nc_evaluated=nc.get("evaluated"),
                           stats=nc.get("global"), search_evaluated=(r.get("search") or {}).get("evaluated"))
    return out


def fixed_polyline(model, points):
    m = E.variant(model, "circular")
    m["analysis"].pop("search", None)
    m["analysis"]["surface"] = {"type": "polyline", "points": points}
    return m


def oracle(model, method, points):
    import cslope
    sys.path.insert(0, str(ROOT / "verification/harness"))
    import to_cslope
    m = fixed_polyline(model, points)
    check = {"method": method, "kind": "fixed", "options": {"slices": m["analysis"].get("slices", 50)}}
    try:
        o = cslope.analyse(to_cslope.ogs_to_cslope(m, check).document)
        return dict(fos=o.get("minFOS"), converged=(o.get("criticalSurface") or {}).get("converged"), error=None)
    except Exception as ex:  # noqa: BLE001 - se informa, no se oculta
        return dict(fos=None, converged=False, error=f"{type(ex).__name__}: {str(ex)[:160]}")


# ------------------------------------------------------------------ paso 1: measure

def measure_entry(e, binary, parallel, full=True):
    labels = ("circular", "refinement", "global") if full else ("refinement", "global")
    models = {label: E.variant(e["model"], label) for label in labels}
    runs = {label: [] for label in labels}
    for _ in range(REPS if full else 1):                 # intercaladas: la deriva de la carga afecta a todas por igual
        for label in labels:
            runs[label].append(call(binary, models[label]))
    rec = dict(id=e["id"], group=e["group"], checks=e["checks"], methods=sorted(results(runs["global"][0]["text"])))
    for label in labels:
        rec[label] = dict(by_method=summary(runs[label][0]), wall=[r["wall"] for r in runs[label]],
                          cpu=[r["cpu"] for r in runs[label]],
                          deterministic=all(r["text"] == runs[label][0]["text"] for r in runs[label]))
    text = runs["global"][0]["text"]
    rec["global"]["sha256"] = hashlib.sha256(text.encode()).hexdigest()
    rec["global"]["parallel_identical"] = None if not parallel else call(parallel, models["global"])["text"] == text
    rec["winner"] = {}
    for method, r in rec["global"]["by_method"].items():
        stats = r["stats"] or {}
        if stats.get("winner") != "global":
            continue
        points = r["surface"]["points"]
        fixed = fixed_polyline(e["model"], points)
        fixed["analysis"]["methods"] = [method]
        again = results(call(binary, fixed)["text"])[method]
        rec["winner"][method] = dict(points=points, fixed_fos=again["fos"], fixed_status=again["status"],
                                     fixed_warnings=again["warnings"], oracle=oracle(e["model"], method, points))
    return rec


def step_measure(a, work):
    es = E.entries()
    known = {e["id"] for e in es}
    todo = [(e, True) for e in es] + [(e, False) for e in E.extras(known)]
    out = work / "measure.jsonl"
    with out.open("w") as f:
        for e, full in todo:
            try:
                rec = measure_entry(e, a.bin, a.parallel_bin, full)
            except Exception as ex:  # noqa: BLE001
                rec = dict(id=e["id"], group=e["group"], error=str(ex))
            f.write(json.dumps(rec) + "\n")
            f.flush()
            print("measure", e["id"], rec.get("error", "ok"), flush=True)


# ------------------------------------------------------------------ paso 2: robust (A2b)

def step_robust(a, work):
    models = {e["id"]: e["model"] for e in E.entries() if e["id"] in ("V053", "S2")}

    def job(item):
        name, seed = item
        r = results(call(a.bin, E.variant(models[name], "global", seed=seed))["text"])
        (r,) = r.values() if len(r) == 1 else (r["spencer"],)
        return dict(model=name, seed=seed, fos=r["fos"], winner=r["search"]["non_circular"]["global"]["winner"])

    with ThreadPoolExecutor(max_workers=a.jobs) as pool:
        rows = list(pool.map(job, [(n, s) for n in models for s in range(48)]))
    (work / "robust.json").write_text(json.dumps(rows, indent=1))
    print("robust", len(rows), flush=True)


# ------------------------------------------------------------------ paso 3: a9

def probe(model, path):
    """El mejor candidato generado antes de refinar, de la sonda `a9_probe` de `global.rs` (compilación sin `parallel`)."""
    path.write_text(json.dumps(model))
    p = subprocess.run(["cargo", "test", "-q", "--release", "-p", "ogs-core", "--lib", "a9_probe", "--", "--ignored",
                        "--nocapture"], cwd=ROOT, env=dict(os.environ, OGS_A9_MODEL=str(path)), capture_output=True, text=True)
    line = next((x for x in p.stdout.splitlines() if x.startswith("A9 ")), None)
    if line is None:
        raise RuntimeError((p.stdout + p.stderr)[-600:])
    out = json.loads(line[3:])
    best = out["best"] or {}
    return dict(fos=best.get("fos"), index=best.get("index"), start=out["start"], stats=out["stats"])


def step_a9(a, work):
    measured = [json.loads(line) for line in (work / "measure.jsonl").read_text().splitlines()]
    es = {e["id"]: e for e in E.entries()}
    rust, starts = {}, {}
    for rec in measured:
        if rec.get("error") or rec["id"] not in es:
            continue
        auto = next(iter(rec["global"]["by_method"].values()))["stats"]["algorithm"]
        m = E.variant(es[rec["id"]]["model"], "global")
        rust[(rec["id"], auto)] = dict(probe(m, work / "a9_model.json"), auto_algorithm=auto, forced=False)
        if auto == "block":      # el recocido forzado en los modelos con capas: también tiene prototipo
            m["analysis"]["search"]["non_circular"]["global"]["algorithm"] = "annealing"
            rust[(rec["id"], "annealing")] = dict(probe(m, work / "a9_model.json"), auto_algorithm=auto, forced=True)
        starts[rec["id"]] = rust[(rec["id"], "annealing")]["start"] if (rec["id"], "annealing") in rust else None
    (work / "a9_starts.json").write_text(json.dumps(starts))
    proto = subprocess.run([str(a.proto_python), str(HERE / "a9_proto.py"), "all", "--seed", "0", "--generated", "500",
                            "--starts", str(work / "a9_starts.json")], capture_output=True, text=True)
    if proto.returncode:
        raise RuntimeError(proto.stderr[-800:])
    rows = [json.loads(line) for line in proto.stdout.splitlines() if line.startswith("{")]
    out = [dict(row, rust=rust.get((row["id"], "annealing" if row["kind"].startswith("annealing") else row["kind"]))) for row in rows]
    (work / "a9.json").write_text(json.dumps(out, indent=1))
    print("a9", len(out), flush=True)


# ------------------------------------------------------------------ paso 4: report

def load_jsonl(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def fmt(x, n=6):
    return "—" if x is None else (f"{x:.{n}f}" if isinstance(x, float) else str(x))


def table(header, rows):
    lines = ["| " + " | ".join(header) + " |", "|" + "|".join("---" for _ in header) + "|"]
    lines += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return lines


def verdict(ok):
    return "**PASA**" if ok else "**NO PASA**"


def first(rec, label):
    """Resultado del método principal (el primero que informa el motor) de una variante."""
    by = rec[label]["by_method"]
    return by[sorted(by)[0]] if "spencer" not in by else by["spencer"]


def gates(a, work):
    recs = load_jsonl(work / "measure.jsonl")
    bad = [r for r in recs if "error" in r]
    ok = [r for r in recs if "error" not in r]
    forty = [r for r in ok if r["group"] != "otro caso"]
    extra = [r for r in ok if r["group"] == "otro caso"]
    G = {}
    # --- A2
    v = next(r for r in forty if r["id"] == "V053")
    g = first(v, "global")
    lo, hi = BAND[0] * (1 - BAND[1]), BAND[0] * (1 + BAND[1])
    cs = (v["winner"].get("spencer") or {}).get("oracle") or {}
    diff = abs(cs["fos"] / g["fos"] - 1) if cs.get("fos") else None
    G["A2"] = dict(ok=lo <= g["fos"] <= hi and diff is not None and diff <= 0.01,
                   criterion=f"V053 con `global: {{}}` en [{lo:.5f}, {hi:.5f}] y cSlope en la polilínea ganadora a ±1 %",
                   fos=g["fos"], band=[lo, hi], refinement_fos=first(v, "refinement")["fos"], cslope=cs.get("fos"),
                   cslope_diff=diff, stats=g["stats"])
    # --- A2b
    rob = json.loads((work / "robust.json").read_text()) if (work / "robust.json").exists() else None
    if rob:
        d = {}
        for name in ("V053", "S2"):
            fs = [r["fos"] for r in rob if r["model"] == name]
            seed0 = next(r["fos"] for r in rob if r["model"] == name and r["seed"] == 0)
            d[name] = dict(n=len(fs), min=min(fs), median=statistics.median(fs), max=max(fs), seed0=seed0,
                           passed=sum(lo <= x <= hi for x in fs) if name == "V053" else None,
                           global_wins=sum(r["winner"] == "global" for r in rob if r["model"] == name))
        G["A2b"] = dict(ok=lo <= d["V053"]["seed0"] <= hi and d["V053"]["passed"] >= 44,
                        criterion="V053 pasa la banda con la semilla 0 y con al menos 44 de las semillas 0 a 47", **d)
    # --- A3
    checks = []
    for r in forty:
        for c in r["checks"]:
            if c.get("kind") == "search" and c.get("published") is not None:
                gm = r["global"]["by_method"].get(c["method"]) or first(r, "global")
                rm = r["refinement"]["by_method"].get(c["method"]) or first(r, "refinement")
                limit = c["published"] * (1 + c["tolerance"])
                checks.append(dict(id=r["id"], method=c["method"], published=c["published"], tolerance=c["tolerance"],
                                   limit=limit, refinement=rm["fos"], global_fos=gm["fos"], passed=gm["fos"] <= limit,
                                   refinement_passed=rm["fos"] <= limit, not_above=gm["fos"] <= rm["fos"]))
    G["A3"] = dict(ok=len(checks) == 15 and all(c["passed"] and c["not_above"] for c in checks),
                   criterion="los 15 checks no circulares con `global: {}`: criterio de un lado y ninguno por encima de su FS sin `global`",
                   checks=checks)
    # --- A4
    rows, v051 = [], None
    for r in forty:
        for method, w in r["winner"].items():
            gfos = r["global"]["by_method"][method]["fos"]
            o = w["oracle"]
            d_ = abs(o["fos"] / gfos - 1) if o.get("fos") else None
            tension = sorted((set(w["fixed_warnings"]) | set(r["global"]["by_method"][method]["warnings"])) & TENSION)
            rows.append(dict(id=r["id"], method=method, fos=gfos, fixed_fos=w["fixed_fos"], cslope=o.get("fos"),
                             cslope_diff=d_, cslope_error=o.get("error"), tension_notes=tension))
    v051 = first(next(r for r in forty if r["id"] == "V051"), "global")["fos"]
    with_fos = [x for x in rows if x["cslope_diff"] is not None]
    G["A4"] = dict(ok=not any(x["tension_notes"] for x in rows) and v051 >= 0.69 and all(x["cslope_diff"] <= 0.02 for x in with_fos)
                   and all(abs(x["fixed_fos"] / x["fos"] - 1) < 1e-9 for x in rows),
                   criterion="ninguna polilínea ganadora del generador con negative_lambda ni negative_effective_normal_major; V051 ≥ 0,69; cSlope a ±2 %",
                   winners=len(rows), with_cslope=len(with_fos), v051=v051, rows=rows,
                   max_cslope_diff=max((x["cslope_diff"] for x in with_fos), default=None))
    # --- A5
    mono = []
    for r in forty + extra:
        for method in r["global"]["by_method"]:
            rm, gm = r["refinement"]["by_method"][method], r["global"]["by_method"][method]
            mono.append(dict(id=r["id"], method=method, group=r["group"], refinement=rm["fos"], global_fos=gm["fos"],
                             circular=r["circular"]["by_method"][method]["fos"] if "circular" in r else None,
                             ok=gm["fos"] <= rm["fos"], winner=(gm["stats"] or {}).get("winner")))
    G["A5"] = dict(ok=all(m["ok"] for m in mono) and not bad, criterion="FS con `global` ≤ FS sin `global` en los 40 modelos y en los demás casos con búsqueda no circular",
                   rows=mono, models=len(forty), extra_cases=len(extra), global_wins=sum(m["winner"] == "global" for m in mono))
    # --- A6
    G["A6"] = dict(ok=all(r["global"]["deterministic"] and r["refinement"]["deterministic"] for r in forty + extra)
                   and all(r["global"]["parallel_identical"] in (True, None) for r in forty + extra)
                   and any(r["global"]["parallel_identical"] for r in forty + extra),
                   criterion="tres corridas iguales byte a byte y la misma salida con el binario `--features parallel`",
                   deterministic=sum(r["global"]["deterministic"] for r in forty + extra),
                   parallel_identical=sum(bool(r["global"]["parallel_identical"]) for r in forty + extra), models=len(forty + extra))
    # --- A7
    ratios = []
    for r in forty:
        wall = statistics.median(r["global"]["wall"]) / statistics.median(r["circular"]["wall"])
        cpu = statistics.median(r["global"]["cpu"]) / statistics.median(r["circular"]["cpu"])
        ratios.append(dict(id=r["id"], circular=statistics.median(r["circular"]["wall"]), global_s=statistics.median(r["global"]["wall"]),
                           wall=wall, cpu=cpu, refinement=statistics.median(r["refinement"]["wall"]) / statistics.median(r["circular"]["wall"])))
    G["A7"] = dict(ok=max(x["wall"] for x in ratios) <= 4.0,
                   criterion="tiempo con `global` (N = 500) ≤ 4 × el circular, mediana de 3 corridas por modelo (nativo)",
                   median=statistics.median(x["wall"] for x in ratios), maximum=max(x["wall"] for x in ratios),
                   cpu_median=statistics.median(x["cpu"] for x in ratios), cpu_maximum=max(x["cpu"] for x in ratios),
                   rows=ratios, wasm="no medido: ver «Pendientes»")
    # --- A8
    slopes = [r for r in forty if r["group"] == "talud"]
    srows = []
    for r in slopes:
        gm, rm = first(r, "global"), first(r, "refinement")
        stats = gm["stats"]
        new = sorted(set(gm["warnings"]) - set(rm["warnings"]) - NEW_NOTES)
        srows.append(dict(id=r["id"], refinement=rm["fos"], global_fos=gm["fos"], algorithm=stats["algorithm"], evaluated=stats["evaluated"],
                          winner=stats["winner"], new_warnings=new, notes=sorted(set(gm["warnings"]) & NEW_NOTES)))
    zero = [x["id"] for x in srows if x["evaluated"] == 0]
    G["A8"] = dict(ok=len(slopes) == 24 and all(x["global_fos"] <= x["refinement"] for x in srows) and len(zero) <= 1
                   and all(not x["new_warnings"] for x in srows) and all("non_circular_global_no_candidates" in x["notes"] for x in srows if x["evaluated"] == 0),
                   criterion="en los 24 taludes `global` no empeora ninguno, `evaluated` > 0 en al menos 23 y no hay avisos nuevos fuera de F7.2 (E17a)",
                   slopes=len(slopes), evaluated_zero=zero, rows=srows)
    # --- A9
    if (work / "a9.json").exists():
        a9 = json.loads((work / "a9.json").read_text())
        pair = {}
        for x in a9:
            if x["kind"].startswith("annealing") and x["rust"]:
                row = pair.setdefault(x["id"], dict(id=x["id"], forced=x["rust"]["forced"], rust=x["rust"]["fos"], rust_index=x["rust"]["index"],
                                                    rejected=(x["rust"]["stats"] or {}).get("tension_rejected"),
                                                    generated=(x["rust"]["stats"] or {}).get("generated"),
                                                    unconverged=((x["rust"]["stats"] or {}).get("generated") or 0) - ((x["rust"]["stats"] or {}).get("converged") or 0)))
                row[x["kind"]] = x["best"]
                row[x["kind"] + "_index"] = x.get("index")
                row[x["kind"] + "_rejected"] = x.get("rejected")
        ann = list(pair.values())
        for row in ann:
            for kind in ("annealing", "annealing_aligned"):
                p_, r_ = row.get(kind), row["rust"]
                row[kind + "_diff"] = 0.0 if p_ is None and r_ is None else (abs(p_ - r_) if p_ is not None and r_ is not None else None)
        G["A9"] = dict(ok=bool(ann) and all(x["annealing_aligned_diff"] is not None and x["annealing_aligned_diff"] <= 1e-6 for x in ann),
                       criterion="el recocido de Rust da el mismo mejor candidato antes de refinar que `X37_proto/global.py` con la misma semilla y el mismo punto de partida (1e-6), o la diferencia se explica con una cifra; el bloque cambió en E17c y no tiene prototipo",
                       annealing=ann,
                       exact=sum(x["annealing_diff"] is not None and x["annealing_diff"] <= 1e-6 for x in ann),
                       block=[dict(id=x["id"], proto_original=x["best"], rust=(x["rust"] or {}).get("fos")) for x in a9 if x["kind"] == "block"])
    # --- A1 y A10: las del repositorio, de `gates_repo.json`
    repo = HERE / "gates_repo.json"
    if repo.exists():
        G.update(json.loads(repo.read_text()))
    return dict(gates=G, models=ok, errors=bad)


def step_report(a, work):
    data = gates(a, work)
    G = data["gates"]
    version = subprocess.run([str(a.bin), "--version"], capture_output=True, text=True).stdout.strip()
    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    (HERE / "REPORT.json").write_text(json.dumps(dict(binary=version, commit=commit, gates=G, models=data["models"], errors=data["errors"]),
                                                  ensure_ascii=False, indent=1) + "\n")
    L = ["# Búsqueda global no circular v0.7: medición de las compuertas de F7.7", "",
         f"Binario: `{version}`; commit base: `{commit}`; semilla 0 y `generated` 500 (los valores por defecto), salvo en A2b.",
         f"Modelos medidos: {len(data['models'])} (40 de X37 y {sum(m['group'] == 'otro caso' for m in data['models'])} casos más con búsqueda no circular); errores: {len(data['errors'])}.",
         "Generado por `verification/global/run.py`; los datos completos están en `REPORT.json`.", "",
         "| Compuerta | Veredicto | Cifra |", "|---|---|---|"]

    def line(name, text):
        g = G.get(name)
        L.append(f"| {name} | {verdict(g['ok']) if g else 'pendiente'} | {text(g) if g else '—'} |")
    line("A1", lambda g: g.get("figure", ""))
    line("A2", lambda g: f"V053 = {g['fos']:.4f} (banda ≤ {g['band'][1]:.4f}); cSlope {g['cslope']:.4f} ({g['cslope_diff'] * 100:.2f} %)")
    line("A2b", lambda g: f"V053: {g['V053']['passed']}/48 semillas, semilla 0 = {g['V053']['seed0']:.4f}; S2 mediana {g['S2']['median']:.4f}")
    line("A3", lambda g: f"{sum(c['passed'] for c in g['checks'])}/{len(g['checks'])} checks; ninguno sobre su FS sin `global`: {all(c['not_above'] for c in g['checks'])}")
    line("A4", lambda g: f"{g['winners']} ganadores del generador; sin notas de tracción; V051 = {g['v051']:.4f}; cSlope ≤ {(g['max_cslope_diff'] or 0) * 100:.2f} % en {g['with_cslope']}")
    line("A5", lambda g: f"{sum(m['ok'] for m in g['rows'])}/{len(g['rows'])} resultados ≤ sin `global`; `global` gana en {g['global_wins']}")
    line("A6", lambda g: f"{g['deterministic']}/{g['models']} deterministas; {g['parallel_identical']}/{g['models']} idénticos con `parallel`")
    line("A7", lambda g: f"razón de tiempo: mediana {g['median']:.2f}, máximo {g['maximum']:.2f} (CPU: {g['cpu_median']:.2f} / {g['cpu_maximum']:.2f}); WASM pendiente")
    line("A8", lambda g: f"24 taludes; `evaluated` = 0 en {len(g['evaluated_zero'])}: {', '.join(g['evaluated_zero']) or '—'}")
    line("A9", lambda g: f"recocido: {g['exact']}/{len(g['annealing'])} iguales al prototipo original a 1e-6; {sum(x['annealing_aligned_diff'] is not None and x['annealing_aligned_diff'] <= 1e-6 for x in g['annealing'])}/{len(g['annealing'])} con el alineado a las reglas del contrato")
    line("A10", lambda g: g.get("figure", ""))
    L.append("")
    if "A2" in G:
        g = G["A2"]
        L += ["## A2 · V053", "", g["criterion"] + ".", ""]
        L += table(["Medida", "Valor"], [["FS del refinamiento (sin `global`)", fmt(g["refinement_fos"])], ["FS con `global: {}`", fmt(g["fos"])],
                                         ["cSlope en la polilínea ganadora", fmt(g["cslope"])], ["diferencia con cSlope", f"{g['cslope_diff'] * 100:.3f} %"],
                                         ["contadores", json.dumps(g["stats"])]])
        L += ["", f"Veredicto: {verdict(g['ok'])}.", ""]
    if "A2b" in G:
        g = G["A2b"]
        L += ["## A2b · robustez frente a la semilla (48 semillas, 0 a 47)", "", g["criterion"] + ".", ""]
        L += table(["Modelo", "Mínimo", "Mediana", "Máximo", "Semilla 0", "En la banda", "Gana `global`"],
                   [[n, fmt(g[n]["min"]), fmt(g[n]["median"]), fmt(g[n]["max"]), fmt(g[n]["seed0"]),
                     f"{g[n]['passed']}/48" if g[n]["passed"] is not None else "—", f"{g[n]['global_wins']}/48"] for n in ("V053", "S2")])
        L += ["", f"Veredicto: {verdict(g['ok'])}.", ""]
    if "A3" in G:
        g = G["A3"]
        L += ["## A3 · los 15 checks no circulares", "", g["criterion"] + ".", ""]
        L += table(["Caso", "Método", "Publicado", "Límite", "Sin `global`", "Con `global`", "Pasa", "No sube"],
                   [[c["id"], c["method"], c["published"], fmt(c["limit"], 4), fmt(c["refinement"], 4), fmt(c["global_fos"], 4),
                     "sí" if c["passed"] else "NO", "sí" if c["not_above"] else "NO"] for c in g["checks"]])
        L += ["", f"Veredicto: {verdict(g['ok'])}.", ""]
    if "A4" in G:
        g = G["A4"]
        L += ["## A4 · guarda de tracción", "", g["criterion"] + ".", "",
              "«FS reeval.» es la polilínea ganadora evaluada como superficie fija en `ogs`; sus notas se miran contra "
              "`negative_lambda` y `negative_effective_normal_major`. Solo hay polilínea del generador en los modelos donde gana `global`.", ""]
        L += table(["Modelo", "FS global", "FS reeval.", "cSlope", "Dif.", "Notas de tracción"],
                   [[x["id"], fmt(x["fos"], 4), fmt(x["fixed_fos"], 4), fmt(x["cslope"], 4) if x["cslope"] else f"({x['cslope_error']})",
                     f"{x['cslope_diff'] * 100:.2f} %" if x["cslope_diff"] is not None else "—", ", ".join(x["tension_notes"]) or "ninguna"] for x in g["rows"]])
        L += ["", f"V051 con `global`: {g['v051']:.4f} (mínimo 0,69). Veredicto: {verdict(g['ok'])}.", ""]
    if "A5" in G:
        g = G["A5"]
        L += ["## A5 · monotonía", "", g["criterion"] + ".", ""]
        L += table(["Caso", "Grupo", "Método", "Circular", "Sin `global`", "Con `global`", "Ganador", "≤"],
                   [[m["id"], m["group"], m["method"], fmt(m["circular"], 4), fmt(m["refinement"], 6), fmt(m["global_fos"], 6), m["winner"],
                     "sí" if m["ok"] else "NO"] for m in g["rows"]])
        L += ["", f"Veredicto: {verdict(g['ok'])}.", ""]
    if "A6" in G:
        g = G["A6"]
        L += ["## A6 · determinismo", "", g["criterion"] + ".", "",
              f"{g['deterministic']}/{g['models']} modelos con tres corridas idénticas; {g['parallel_identical']}/{g['models']} con salida idéntica en el binario `parallel`. "
              f"Veredicto: {verdict(g['ok'])}.", ""]
    if "A7" in G:
        g = G["A7"]
        L += ["## A7 · costo (nativo)", "", g["criterion"] + ".", "",
              f"Razón global/circular por modelo: mediana {g['median']:.2f}, máximo {g['maximum']:.2f} (tiempo de CPU: mediana {g['cpu_median']:.2f}, máximo {g['cpu_maximum']:.2f}). "
              "La columna «Refinamiento» es la razón del refinamiento de v0.6 sin `global`, para ver cuánto agrega la etapa global.", ""]
        L += table(["Modelo", "Circular (s)", "Global (s)", "Razón", "Razón CPU", "Refinamiento"],
                   [[x["id"], fmt(x["circular"], 3), fmt(x["global_s"], 3), f"{x['wall']:.2f}", f"{x['cpu']:.2f}", f"{x['refinement']:.2f}"] for x in g["rows"]])
        L += ["", f"WASM en Chrome: {g['wasm']}. Veredicto nativo: {verdict(g['ok'])}.", ""]
    if "A8" in G:
        g = G["A8"]
        L += ["## A8 · barrido de 24 taludes", "", g["criterion"] + ".", ""]
        L += table(["Talud", "Sin `global`", "Con `global`", "Algoritmo", "Evaluaciones", "Ganador", "Avisos nuevos", "Notas F7.2"],
                   [[x["id"], fmt(x["refinement"], 5), fmt(x["global_fos"], 5), x["algorithm"], x["evaluated"], x["winner"],
                     ", ".join(x["new_warnings"]) or "—", ", ".join(x["notes"]) or "—"] for x in g["rows"]])
        L += ["", f"`evaluated` = 0 en: {', '.join(g['evaluated_zero']) or 'ninguno'}. Veredicto: {verdict(g['ok'])}.", ""]
    if "A9" in G:
        g = G["A9"]
        L += ["## A9 · paridad con el prototipo", "", g["criterion"] + ".", "",
              "Se compara el mejor candidato generado antes de refinar (500 candidatos, semilla 0, mismo punto de partida: la polilínea del círculo semilla que eligió Rust). "
              "Prototipo: `gen_sa` sobre el wheel 0.5.1; Rust: la sonda `a9_probe` de `global.rs`. **Solo el recocido tiene paridad**: el bloque cambió en E17c "
              "(Halton rotado, proyecciones a 15°-75°) y no tiene prototipo.", "",
              "Dos columnas de prototipo: «original» es `gen_sa` sin cambios; «alineado» es el mismo bucle con las dos reglas del contrato que el prototipo no tiene "
              "(la guarda de F7.4 y que un candidato rechazado cuenta como generado y adelanta el enfriamiento; `a9_proto.py`). La diferencia entre las dos es la explicación de "
              "cada fila que no coincide: los candidatos rechazados por la guarda y los que no convergen son los que el prototipo no cuenta como generados.", f"Coinciden con el prototipo original: {g['exact']}/{len(g['annealing'])}.", ""]
        L += table(["Modelo", "Rust", "Proto. original", "Dif.", "Proto. alineado", "Dif.", "Rechazados por la guarda", "No convergidos", "Índice (orig. / alin. / Rust)"],
                   [[x["id"] + (" (recocido forzado)" if x["forced"] else ""), fmt(x["rust"], 9), fmt(x.get("annealing"), 9),
                     f"{x['annealing_diff']:.1e}" if x["annealing_diff"] is not None else "—", fmt(x.get("annealing_aligned"), 9),
                     f"{x['annealing_aligned_diff']:.1e}" if x["annealing_aligned_diff"] is not None else "—", x["rejected"], x["unconverged"],
                     f"{x.get('annealing_index')} / {x.get('annealing_aligned_index')} / {x['rust_index']}"] for x in g["annealing"]])
        L += ["", "Bloque (informativo, sin exigencia): el mejor de 500 del prototipo original (F7.3.2 sin E17c) contra el de Rust (E17c).", ""]
        L += table(["Modelo", "Prototipo original", "Rust (E17c)"], [[x["id"], fmt(x["proto_original"], 6), fmt(x["rust"], 6)] for x in g["block"]])
        L += ["", f"Veredicto: {verdict(g['ok'])}.", ""]
    for name in ("A1", "A10"):
        if name in G and G[name].get("detail"):
            L += [f"## {name}", ""] + G[name]["detail"] + [""]
    (HERE / "REPORT.md").write_text("\n".join(L) + "\n")
    failed = [k for k, g in G.items() if not g["ok"]]
    print("REPORT.md escrito; compuertas que no pasan:", failed or "ninguna")
    return int(bool(failed) or bool(data["errors"]))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bin", type=Path, required=True)
    ap.add_argument("--parallel-bin", type=Path)
    ap.add_argument("--proto-python", type=Path, default=TMP / "cm-x37/venv/bin/python")
    ap.add_argument("--work", type=Path, default=TMP / "cm-m/global-work")
    ap.add_argument("--steps", default="measure,robust,a9,report")
    ap.add_argument("--jobs", type=int, default=2)
    a = ap.parse_args()
    a.work.mkdir(parents=True, exist_ok=True)
    steps = {"measure": step_measure, "robust": step_robust, "a9": step_a9}
    rc = 0
    for name in a.steps.split(","):
        if name == "report":
            rc = step_report(a, a.work)
        else:
            steps[name](a, a.work)
    return rc


if __name__ == "__main__":
    sys.exit(main())
