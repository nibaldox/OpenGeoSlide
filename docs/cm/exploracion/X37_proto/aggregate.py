"""X37: agrega las corridas (run_x37.py) en tablas Markdown y comprueba el determinismo entre dos corridas.

Uso: python aggregate.py <runA> <runB> > tablas.md
"""
import json
import os
import statistics
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import models as M  # noqa: E402

GENS = ["G1", "G2", "G3"]
NS = [500, 2000, 5000]
CFG = [f"{g}-N{n}" for g in GENS for n in NS]


def load(run):
    out = {}
    for f in sorted(os.listdir(run)):
        if f.endswith(".json") and not f.startswith("_"):
            with open(os.path.join(run, f), encoding="utf-8") as fh:
                r = json.load(fh)
            out[r["id"]] = r
    return out


def f3(x):
    return "—" if x is None else f"{x:.4f}"


def pct(x):
    return "—" if x is None else f"{100 * x:+.2f} %"


def canon(r):
    """Quita tiempos (los únicos campos que pueden variar entre corridas)."""
    if isinstance(r, dict):
        return {k: canon(v) for k, v in r.items() if "second" not in k and k not in ("seconds", "grid_cost", "refine_cost", "polish_cost", "circ_seconds", "nc_seconds")}
    if isinstance(r, list):
        return [canon(v) for v in r]
    return r


def main(runA, runB):
    A, B = load(runA), load(runB)
    ids = sorted(A, key=lambda k: (A[k]["group"], k))
    L = []
    # ---------- determinismo
    same = [i for i in ids if i in B and json.dumps(canon(A[i]), sort_keys=True) == json.dumps(canon(B[i]), sort_keys=True)]
    L.append(f"## Determinismo\n\n- Modelos en la corrida A: {len(A)}; en B: {len(B)}.")
    L.append(f"- Idénticos (JSON sin campos de tiempo, incluidas FS, superficies y contadores): **{len(same)}/{len(ids)}**.")
    diff = [i for i in ids if i not in same]
    if diff:
        L.append(f"- Diferencias: {diff}")
    L.append("")
    # ---------- tabla FS por modelo
    hdr = ["modelo", "grupo", "circ. motor", "nc motor (actual)", "nc replica (sin pulido)", "nc replica + pulido", "cSlope nco"] + CFG
    L.append("## FS por modelo y configuración (la tubería final: min con el refinamiento actual del motor)\n")
    L.append("| " + " | ".join(hdr) + " |")
    L.append("|" + "---|" * len(hdr))
    rows = {}
    for i in ids:
        r = A[i]
        e = r["engine"]
        pc = r.get("proto_current", {})
        cs = r.get("cslope", {})
        cells = [i, r["group"], f3(e.get("circ_fos")), f3(e.get("nc_fos")), f3(pc.get("F_noPolish")), f3(pc.get("F_polish")),
                 f3((cs.get("nco") or {}).get("fos"))]
        for c in CFG:
            p = r.get("pipelines", {}).get(c, {})
            cells.append(f3(p.get("F_final_monotone")) if "F_final_pipeline" in p else "err")
        rows[i] = cells
        L.append("| " + " | ".join(cells) + " |")
    L.append("")
    # ---------- checks publicados
    L.append("## Checks publicados (un lado: FS ≤ P(1+tol); banda: |FS/P−1| ≤ tol). Error = FS/P − 1\n")
    chk_rows = []
    for i in ids:
        r = A[i]
        if r["group"] not in ("pendiente", "promovido"):
            continue
        ents = [e for e in M.all_entries(with_sweep=False) if e["id"] == i]
        checks = ents[0]["checks"] if ents else []
        for c in checks:
            if c.get("method") != "spencer" or c.get("kind") != "search":
                continue
            chk_rows.append((i, c))
    H2 = ["check", "P", "tol", "cSlope nco", "motor nc (actual)", "circ"] + CFG
    L.append("| " + " | ".join(H2) + " |")
    L.append("|" + "---|" * len(H2))
    summary_checks = {}
    for i, c in chk_rows:
        r = A[i]
        P, tol = c["published"], c["tolerance"]
        cs = (r.get("cslope") or {}).get("nco", {}).get("fos")
        ec = r["engine"]["circ_fos"]
        en = r["engine"]["nc_fos"]
        cells = [f"{i} ({c.get('published_by','')[:28]})", f"{P}", f"{tol*100:.2f} %", f3(cs), f"{pct(en/P-1)}", pct(ec/P - 1)]
        for cf in CFG:
            p = r.get("pipelines", {}).get(cf, {})
            F = p.get("F_final_monotone")
            if F is None:
                cells.append("err")
                continue
            e_ = F / P - 1
            one = F <= P * (1 + tol)
            band = abs(e_) <= tol
            cells.append(f"{pct(e_)} {'✔' if one else '✘'}{'b' if band else ''}")
            summary_checks.setdefault(cf, []).append((i, one, band))
        L.append("| " + " | ".join(cells) + " |")
        cells2 = None
    L.append("")
    L.append("Leyenda: ✔ pasa el lado de D3; ✘ no pasa; «b» = pasa la banda completa. Columnas motor: nc actual (su FS) y circ.\n")
    L.append("| configuración | un lado (de los checks) | banda completa |")
    L.append("|---|---|---|")
    for cf in CFG:
        v = summary_checks.get(cf, [])
        L.append(f"| {cf} | {sum(1 for _, o, _ in v if o)}/{len(v)} | {sum(1 for _, _, b in v if b)}/{len(v)} |")
    L.append("")
    # ---------- monotonía
    L.append("## Monotonía frente al refinamiento actual del motor (FS_final ≤ FS_nc motor)\n")
    L.append("| configuración | casos | FS_pipeline > FS_nc motor (sin min) | peores casos (Δ) |")
    L.append("|---|---|---|---|")
    for cf in CFG:
        n = 0
        bad = []
        for i in ids:
            p = A[i].get("pipelines", {}).get(cf, {})
            if "F_final_pipeline" not in p:
                continue
            n += 1
            d = p["F_final_pipeline"] - A[i]["engine"]["nc_fos"]
            if d > 1e-9:
                bad.append((i, d))
        worst = ", ".join(f"{i} ({d*100:+.3f} %)" for i, d in sorted(bad, key=lambda x: -x[1])[:3]) or "—"
        L.append(f"| {cf} | {n} | {len(bad)} | {worst} |")
    L.append("")
    # ---------- costo
    L.append("## Costo (evaluaciones de motor y tiempo de Python; el tiempo nativo se estima con el coste por evaluación del motor)\n")
    L.append("| modelo | circ: evaluaciones | nc motor: evaluaciones | nc motor: t (s) | c_nc nativo (µs/eval) | "
             "configuración | eval. gen | eval. refin. | eval. pulido | eval. total | t Python (s) | est. nativo (s) | cociente nativo / circ |")
    L.append("|" + "---|" * 13)
    ratios = []
    for i in ids:
        r = A[i]
        e = r["engine"]
        circ_ev = e.get("circ_evaluated") or 0
        nc_ev = (e.get("nc_search") or {}).get("evaluated") or 0
        nc_s = e.get("nc_seconds") or 0
        circ_s = e.get("circ_seconds") or 0
        cnc = ((nc_s - circ_s) / nc_ev * 1e6) if nc_ev else None
        for cf in CFG:
            p = r.get("pipelines", {}).get(cf, {})
            if "gen_evals" not in p or "error" in p:
                continue
            tot = p["gen_evals"] + p["refine_evals"] + p.get("polish_evals", 0)
            est = (tot * cnc / 1e6) if cnc else None
            ratio = (est / circ_s) if (est and circ_s) else None
            if ratio and i.startswith("TAL") is False:
                ratios.append((i, cf, ratio))
            L.append(f"| {i} | {circ_ev} | {nc_ev} | {nc_s:.3f} | {f3(cnc)} | {cf} | {p['gen_evals']} | {p['refine_evals']} | "
                     f"{p.get('polish_evals', 0)} | {tot} | {p.get('seconds')} | {f3(est)} | {f3(ratio)} |")
    L.append("")
    if ratios:
        vals = [x[2] for x in ratios]
        L.append(f"Cociente nativo estimado / circular (sin los sintéticos de barrido): mediana {statistics.median(vals):.2f}, "
                 f"máximo {max(vals):.2f} ({max(ratios, key=lambda x: x[2])[0]}, {max(ratios, key=lambda x: x[2])[1]}).\n")
    # ---------- avisos del ganador
    L.append("## Avisos del motor en la superficie ganadora (y cSlope como superficie fija)\n")
    L.append("| modelo | configuración | fuente | FS ogs | avisos | FS cSlope fija | cSlope > ogs·1,02 y avisos de λ |")
    L.append("|---|---|---|---|---|---|---|")
    flags = []
    for i in ids:
        r = A[i]
        for cf in CFG:
            p = r.get("pipelines", {}).get(cf, {})
            if "winner_engine_check" not in p:
                continue
            w = p["winner_engine_check"]
            warn = w.get("warnings") or []
            lam = any(x in ("negative_lambda", "negative_effective_normal_major") for x in warn)
            cs = p.get("winner_cslope_fixed_fos")
            mark = ""
            if cs is not None and w.get("fos") and cs > 1.02 * w["fos"] and lam:
                mark = "**MARCADA**"
                flags.append((i, cf))
            L.append(f"| {i} | {cf} | {p.get('source')} | {f3(w.get('fos'))} | {', '.join(warn) or '—'} | {f3(cs)} | {mark} |")
    L.append("")
    L.append(f"Superficies marcadas: {len(flags)} {flags[:12]}\n")
    # ---------- barrido
    sw = [i for i in ids if A[i]["group"] == "barrido"]
    L.append("## Barrido de 24 taludes\n")
    L.append("| talud | circ. motor | nc motor | cSlope nco | " + " | ".join(CFG) + " | evaluated>0 (nc motor) | candidatos evaluados>0 |")
    L.append("|" + "---|" * (5 + len(CFG) + 2))
    cnt_eval = 0
    for i in sw:
        r = A[i]
        nc_ev = (r["engine"].get("nc_search") or {}).get("evaluated") or 0
        cnt_eval += 1 if nc_ev > 0 else 0
        cs = (r.get("cslope") or {}).get("nco", {}).get("fos")
        cells = [i, f3(r["engine"]["circ_fos"]), f3(r["engine"]["nc_fos"]), f3(cs)]
        ok_gen = 0
        for cf in CFG:
            p = r.get("pipelines", {}).get(cf, {})
            cells.append(f3(p.get("F_final_monotone")))
        cells.append(str(nc_ev))
        cells.append(str(sum(1 for cf in CFG if (r.get("pipelines", {}).get(cf, {}).get("candidates_evaluated") or 0) > 0)) + "/9")
        L.append("| " + " | ".join(cells) + " |")
    L.append(f"\nEn {cnt_eval}/{len(sw)} taludes el motor evaluó más de 0 polilíneas en nc.\n")
    # resumen del barrido: respecto a cSlope y al motor
    L.append("| configuración | media (FS_pipe / FS_cSlope) | máx (FS_pipe / FS_cSlope) | mejoras frente al motor nc (n/24) | empeoras (n/24) |")
    L.append("|---|---|---|---|---|")
    for cf in CFG:
        rat, better, worse = [], 0, 0
        for i in sw:
            r = A[i]
            p = r.get("pipelines", {}).get(cf, {})
            cs = (r.get("cslope") or {}).get("nco", {}).get("fos")
            F = p.get("F_final_monotone")
            if F is None or not cs:
                continue
            rat.append(F / cs)
            if F < r["engine"]["nc_fos"] - 1e-9:
                better += 1
            if F > r["engine"]["nc_fos"] + 1e-9:
                worse += 1
        if rat:
            L.append(f"| {cf} | {statistics.mean(rat):.4f} | {max(rat):.4f} | {better} | {worse} |")
    L.append("")
    # ---------- estados del motor
    L.append("## Estados del motor en las evaluaciones de las tuberías (conteo por configuración, suma de modelos)\n")
    agg = {}
    for i in ids:
        for cf in CFG:
            p = A[i].get("pipelines", {}).get(cf, {})
            for k, v in (p.get("engine_status_delta") or {}).items():
                agg.setdefault(cf, {}).setdefault(k, 0)
                agg[cf][k] += v
    for cf in CFG:
        if cf in agg:
            L.append(f"- {cf}: " + ", ".join(f"{k}={v}" for k, v in sorted(agg[cf].items())))
    L.append("")
    print("\n".join(L))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
