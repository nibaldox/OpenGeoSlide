#!/usr/bin/env python3
"""xslope 1.1.0 as an informative third column: published vs. ogs vs. xslope, bishop and spencer.

Usage (from the worktree root):

  uv run -q --python 3.13 --no-project --with xslope==1.1.0 \\
    python verification/xslope/run.py --ogs target/release/ogs

Reads every check of ``verification/cases`` (``--cases``), runs ogs (CLI) and xslope on each check that
``verification/harness/to_xslope.py`` converts, and writes ``REPORT.md`` and ``REPORT.json`` in ``--out``
(default: this folder). The checks that are not converted are counted by rasgo, not run.

xslope is **not a judge**. On a fixed surface the verdict is the agreement of xslope with ogs (``concordancia`` or
``discrepancia``, |xslope - ogs| / ogs against ``FIXED_AGREEMENT``). In a search each engine finds its own surface,
so the row is only a ``diagnóstico``: there is no pass/fail. The acceptance criteria stay the published value and ogs.

Deterministic: two runs give the same ``REPORT.json`` except ``generated_at`` (no timings, no paths of the machine).
Needs ``xslope==1.1.0`` and stops with an error on any other version.
"""

from __future__ import annotations

import os

# Single-threaded numerics: the report must not depend on how many cores the machine has.
for _var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ.setdefault(_var, "1")

import argparse  # noqa: E402
import collections  # noqa: E402
import concurrent.futures as cf  # noqa: E402
import copy  # noqa: E402
import datetime as _dt  # noqa: E402
import glob  # noqa: E402
import json  # noqa: E402
import platform  # noqa: E402
import statistics  # noqa: E402
import sys  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
HARNESS = os.path.join(REPO, "verification", "harness")
sys.path.insert(0, HARNESS)

REPORT_VERSION = "1"
FIXED_AGREEMENT = 0.005      # |xslope - ogs| / ogs, on a fixed surface
OGS_TIMEOUT_S = 300
CLASS_FIXED, CLASS_SEARCH = "convertido, superficie fija", "convertido, búsqueda"


# ------------------------------------------------------------------ rows

def load_cases(cases_dir: str, only: set[str] | None) -> list[dict]:
    if not os.path.isdir(cases_dir):
        raise SystemExit(f"error: no existe el directorio de casos: {cases_dir}")
    paths = sorted(p for p in glob.glob(os.path.join(cases_dir, "*.json"))
                   if os.path.basename(p) not in ("report.json", "HOLD.json"))
    cases = []
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            case = json.load(fh)
        if only and case["id"] not in only:
            continue
        cases.append(case)
    if not cases:
        raise SystemExit(f"error: ningún caso (*.json) en {cases_dir}")
    return cases


def _pct(a: float | None, b: float | None) -> float | None:
    return None if a is None or not b else (a - b) / b * 100.0


def _crit_circle(surface: dict | None) -> dict | None:
    if surface and all(isinstance(surface.get(k), (int, float)) for k in ("xc", "yc", "r")):
        return {"type": "circle", "xc": surface["xc"], "yc": surface["yc"], "r": surface["r"]}
    return None


def harness_run():
    """``verification/harness/run.py`` (``run_ogs``), loaded by path: this folder has a ``run.py`` of its own."""
    import importlib.util

    if "ogs_harness_run" not in sys.modules:
        spec = importlib.util.spec_from_file_location("ogs_harness_run", os.path.join(HARNESS, "run.py"))
        module = importlib.util.module_from_spec(spec)
        sys.modules["ogs_harness_run"] = module
        spec.loader.exec_module(module)
    return sys.modules["ogs_harness_run"]


def _with_surface(model: dict, circle: dict) -> dict:
    fixed = copy.deepcopy(model)
    fixed.setdefault("analysis", {})["surface"] = circle
    return fixed


def run_check(task: tuple) -> dict:
    """One check: ogs and xslope (and, in a search, xslope on the critical circle of ogs). Runs in a worker."""
    import to_xslope as tx

    harness = harness_run()

    case, idx, ogs_binary = task
    ch = case["checks"][idx]
    model = case["model"]
    published, tolerance = float(ch["published"]), float(ch["tolerance"])
    row: dict = {
        "case_id": case["id"], "check": idx, "method": ch["method"], "kind": ch["kind"],
        "published": published, "published_by": ch.get("published_by"), "tolerance": tolerance,
        "slices": (ch.get("options") or {}).get("slices"),
        "class": None, "unsupported": None, "mode": None,
        "ogs": None, "xslope": None, "xs_vs_pub_pct": None, "xs_vs_ogs_pct": None,
        "xs_on_ogs_surface": None, "ogs_on_xs_surface": None, "verdict": None, "notes": [],
    }
    try:
        tx.convert(model, ch)
    except tx.Unsupported as exc:
        row["class"] = f"Unsupported: {exc.feature}"
        row["unsupported"] = exc.feature
        row["verdict"] = "no convertido"
        return row
    og = harness.run_ogs(ogs_binary, model, ch, OGS_TIMEOUT_S)
    xs = tx.run_xslope(model, ch)
    row["class"] = CLASS_FIXED if ch["kind"] == "fixed" else CLASS_SEARCH
    row["mode"] = xs["mode"]
    row["notes"] = list(xs["notes"])
    row["ogs"] = {"fos": og["fos"], "status": og["status"], "error": og["error"], "engine": og["engine"]}
    row["xslope"] = {"fos": xs["fos"], "error": xs["error"], "trials": xs["trials"]}
    row["xs_vs_pub_pct"] = _pct(xs["fos"], published)
    row["xs_vs_ogs_pct"] = _pct(xs["fos"], og["fos"])
    if ch["kind"] == "search":
        row["verdict"] = "diagnóstico" if xs["fos"] is not None and og["fos"] is not None else "sin dato"
        circle = _crit_circle(og.get("surface"))
        if circle is not None and xs["fos"] is not None:
            try:
                cross = tx.run_xslope(_with_surface(model, circle), dict(ch, kind="fixed"))
            except Exception:  # noqa: BLE001
                cross = {"fos": None}
            row["xs_on_ogs_surface"] = {"surface": circle, "fos": cross["fos"],
                                        "vs_ogs_pct": _pct(cross["fos"], og["fos"])}
        # the other way round: ogs on the critical circle of xslope, when the two searches disagree
        xs_circle = _crit_circle(xs["surface"])
        if (xs_circle is not None and xs["fos"] is not None and og["fos"] is not None
                and abs(row["xs_vs_ogs_pct"]) > FIXED_AGREEMENT * 100):
            back = harness.run_ogs(ogs_binary, _with_surface(model, xs_circle), dict(ch, kind="fixed"), OGS_TIMEOUT_S)
            row["ogs_on_xs_surface"] = {"surface": xs_circle, "fos": back["fos"], "status": back["status"],
                                        "warnings": back["warnings"], "vs_xs_pct": _pct(back["fos"], xs["fos"])}
    else:
        if xs["fos"] is None or og["fos"] is None:
            row["verdict"] = "sin dato"
        else:
            row["verdict"] = ("concordancia" if abs(xs["fos"] - og["fos"]) / og["fos"] <= FIXED_AGREEMENT
                              else "discrepancia")
    return row


# --------------------------------------------------------------- summary

def _stats(rows: list[dict]) -> dict:
    vals = [(abs(r["xs_vs_ogs_pct"]), r) for r in rows if r["xs_vs_ogs_pct"] is not None]
    if not vals:
        return {"n": 0, "median_abs_pct": None, "max_abs_pct": None, "max_at": None}
    top_abs, top_row = max(vals, key=lambda v: (v[0], v[1]["case_id"], v[1]["check"]))
    return {"n": len(vals), "median_abs_pct": statistics.median(v for v, _ in vals), "max_abs_pct": top_abs,
            "max_at": f"{top_row['case_id']} {top_row['method']}#{top_row['check']}"}


def summarize(rows: list[dict]) -> dict:
    by_class = collections.Counter(r["class"] for r in rows)
    converted = [r for r in rows if r["unsupported"] is None]
    fixed = [r for r in converted if r["kind"] == "fixed"]
    search = [r for r in converted if r["kind"] == "search"]
    return {
        "checks": len(rows), "cases": len({r["case_id"] for r in rows}), "converted": len(converted),
        "by_class": dict(sorted(by_class.items(), key=lambda kv: (not kv[0].startswith("convertido"), -kv[1], kv[0]))),
        "fixed": {**_stats(fixed), "concordancia": sum(r["verdict"] == "concordancia" for r in fixed),
                  "discrepancia": sum(r["verdict"] == "discrepancia" for r in fixed),
                  "sin_dato": sum(r["verdict"] == "sin dato" for r in fixed)},
        "search": {**_stats(search), "sin_dato": sum(r["verdict"] == "sin dato" for r in search)},
        "fixed_agreement_threshold_pct": FIXED_AGREEMENT * 100,
    }


# --------------------------------------------------------------- outputs

def _fmt(v, spec: str) -> str:
    return "—" if v is None else format(v, spec)


def _id(r: dict) -> str:
    return f"{r['case_id']} {r['method']}#{r['check']}"


def search_note(r: dict) -> str:
    """The diagnosis of a search row: each engine evaluated, as a fixed surface, on the critical circle of the other."""
    thr = FIXED_AGREEMENT * 100
    xs_fos, ogs_fos = r["xslope"]["fos"], r["ogs"]["fos"]
    on_ogs, on_xs = r["xs_on_ogs_surface"], r["ogs_on_xs_surface"]
    out = []
    if on_ogs is not None and on_ogs["fos"] is not None:
        out.append(f"xslope sobre la superficie de ogs: {on_ogs['fos']:.4f} ({on_ogs['vs_ogs_pct']:+.2f} % frente a ogs)")
    if on_xs is not None:
        if on_xs["status"] not in (None, "converged"):
            why = ", ".join(on_xs.get("warnings") or []) or on_xs["status"]
            out.append(f"ogs declara no válida la superficie de xslope ({why})")
        elif on_xs["fos"] is not None:
            out.append(f"ogs sobre la superficie de xslope: {on_xs['fos']:.4f} ({on_xs['vs_xs_pct']:+.2f} % frente a xslope)")
    if on_ogs is not None and on_ogs["fos"] is not None and ogs_fos:
        if abs(on_ogs["vs_ogs_pct"]) > thr:
            out.append("la diferencia persiste sobre la superficie de ogs (fórmula, conversión o rebanado)")
        else:
            out.append("la fórmula concuerda sobre la superficie de ogs")
        if xs_fos is not None and (xs_fos - on_ogs["fos"]) / on_ogs["fos"] * 100 > thr:
            out.append("la búsqueda de xslope no llegó a la superficie de ogs (su FS sobre ella es menor que el que halla)")
    if on_xs is not None and on_xs["fos"] is not None and on_xs["status"] in (None, "converged") and ogs_fos:
        if (ogs_fos - on_xs["fos"]) / on_xs["fos"] * 100 > thr:
            out.append("la búsqueda de ogs no llegó a la superficie de xslope")
    return "; ".join(out) or "sin evaluación cruzada"


def write_markdown(path: str, rows: list[dict], meta: dict, summary: dict) -> None:
    L: list[str] = []
    L.append("# Verificación cruzada: publicado vs. ogs vs. xslope (columna informativa)")
    L.append("")
    L.append(f"Generado: {meta['generated_at']} · informe v{REPORT_VERSION} · casos: `{meta['cases_dir']}` "
             f"({summary['cases']} casos, {summary['checks']} checks)")
    L.append("")
    L.append("xslope **no es un juez**: los criterios de aceptación siguen siendo el publicado y ogs. En superficie fija "
             f"el veredicto es la concordancia de xslope con ogs (|xslope − ogs| / ogs ≤ {summary['fixed_agreement_threshold_pct']:g} %); "
             "en búsqueda cada motor halla su superficie y la fila es solo un diagnóstico.")
    L.append("")
    L.append("## Motores")
    L.append("")
    L.append(f"- **xslope**: `xslope=={meta['xslope']}` (versión fijada) · Python {meta['python']}")
    L.append(f"- **ogs**: `{meta['ogs']['version'] or '—'}`")
    L.append("")
    L.append("## Resumen")
    L.append("")
    L.append("| clase | checks |")
    L.append("|---|---:|")
    for k, v in summary["by_class"].items():
        L.append(f"| {k} | {v} |")
    L.append(f"| **total** | **{summary['checks']}** |")
    L.append("")
    f, s = summary["fixed"], summary["search"]
    L.append("| superficie | filas | mediana \\|xs − ogs\\| % | máximo \\|xs − ogs\\| % | en | concordancia | discrepancia | sin dato |")
    L.append("|---|---:|---:|---:|---|---:|---:|---:|")
    L.append(f"| fija | {f['n']} | {_fmt(f['median_abs_pct'], '.3f')} | {_fmt(f['max_abs_pct'], '.3f')} | {f['max_at'] or '—'} | "
             f"{f['concordancia']} | {f['discrepancia']} | {f['sin_dato']} |")
    L.append(f"| búsqueda (diagnóstico) | {s['n']} | {_fmt(s['median_abs_pct'], '.3f')} | {_fmt(s['max_abs_pct'], '.3f')} | "
             f"{s['max_at'] or '—'} | — | — | {s['sin_dato']} |")
    L.append("")
    converted = [r for r in rows if r["unsupported"] is None]
    fixed_rows = [r for r in converted if r["kind"] == "fixed"]
    search_rows = [r for r in converted if r["kind"] == "search"]
    exc_fixed = [r for r in fixed_rows if r["verdict"] != "concordancia"]
    L.append("## Excepciones en superficie fija")
    L.append("")
    if not exc_fixed:
        L.append(f"Ninguna: los {len(fixed_rows)} checks de superficie fija concuerdan dentro de "
                 f"{summary['fixed_agreement_threshold_pct']:g} %.")
    else:
        for r in exc_fixed:
            note = EXCEPTIONS.get((r["case_id"], r["method"], r["check"]), "SIN DIAGNOSTICAR")
            L.append(f"- **{_id(r)}** ({r['verdict']}, xs − ogs {_fmt(r['xs_vs_ogs_pct'], '+.3f')} %): {note}")
    L.append("")
    big = [r for r in search_rows if r["xs_vs_ogs_pct"] is not None and abs(r["xs_vs_ogs_pct"]) > FIXED_AGREEMENT * 100]
    L.append(f"## Búsqueda: filas con |xs − ogs| > {FIXED_AGREEMENT * 100:g} % (diagnóstico)")
    L.append("")
    L.append("En cada fila se evalúa cada motor, como superficie fija, sobre el círculo crítico del otro. Si xslope sobre "
             "la superficie de ogs concuerda con ogs, la fórmula y la conversión son las mismas y lo que difiere es la "
             "superficie que halla cada búsqueda (el caso de V020, X36 §3.3).")
    L.append("")
    if not big:
        L.append("Ninguna.")
    else:
        L.append("| check | ogs | xslope | xs − ogs % | círculo crítico de ogs (xc; yc; r) | xslope sobre ese círculo | diagnóstico |")
        L.append("|---|---:|---:|---:|---|---:|---|")
        for r in big:
            on = r["xs_on_ogs_surface"]
            circle = "—" if on is None else "({xc:.2f}; {yc:.2f}; {r:.2f})".format(**on["surface"])
            L.append(f"| {_id(r)} | {_fmt(r['ogs']['fos'], '.4f')} | {_fmt(r['xslope']['fos'], '.4f')} | "
                     f"{_fmt(r['xs_vs_ogs_pct'], '+.2f')} | {circle} | {_fmt(on and on['fos'], '.4f')} | {search_note(r)} |")
    L.append("")
    L.append("## Tabla por check")
    L.append("")
    L.append("`err xs` es el error de xslope frente al publicado; `xs − ogs`, la diferencia de xslope con ogs, ambos en %. "
             "Veredicto: fija → concordancia / discrepancia; búsqueda → diagnóstico.")
    L.append("")
    L.append("| caso | método | tipo | publicado | tol % | ogs | xslope | err xs % | xs − ogs % | veredicto |")
    L.append("|---|---|---|---:|---:|---:|---:|---:|---:|---|")
    for r in converted:
        L.append("| {case} | {m} | {k} | {pub} | {tol} | {og} | {xs} | {ee} | {d} | {v} |".format(
            case=r["case_id"], m=r["method"], k=("fija, polilínea" if r["mode"] == "fixed_polyline"
                                                  else "fija" if r["kind"] == "fixed" else "búsqueda"),
            pub=_fmt(r["published"], ".4f"), tol=_fmt(r["tolerance"] * 100, ".1f"),
            og=_fmt(r["ogs"]["fos"], ".4f"), xs=_fmt(r["xslope"]["fos"], ".4f"),
            ee=_fmt(r["xs_vs_pub_pct"], "+.2f"), d=_fmt(r["xs_vs_ogs_pct"], "+.3f"), v=r["verdict"]))
    L.append("")
    errors = sorted({f"{_id(r)} ogs: {r['ogs']['error']}" for r in converted if r["ogs"]["error"]}
                    | {f"{_id(r)} xslope: {r['xslope']['error']}" for r in converted if r["xslope"]["error"]})
    if errors:
        L.append("## Errores")
        L.append("")
        L.extend(f"- {e}" for e in errors)
        L.append("")
    notes: dict[tuple[str, str], list[str]] = {}
    for r in converted:
        for n in r["notes"]:
            notes.setdefault((r["case_id"], n), []).append(f"{r['method']}#{r['check']}")
    if notes:
        L.append("## Notas de conversión")
        L.append("")
        for (case_id, n), checks in notes.items():
            L.append(f"- {case_id} ({', '.join(checks)}): {n}")
        L.append("")
    L.append("## Reproducir")
    L.append("")
    L.append("```")
    L.append("uv run -q --python 3.13 --no-project --with xslope==1.1.0 \\")
    L.append("  python verification/xslope/run.py --ogs PATH_BINARIO_OGS")
    L.append("```")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")


# Diagnosed exceptions on a fixed surface, by (case, method, check index). Filled in from the first full run.
EXCEPTIONS: dict[tuple[str, str, int], str] = {}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cases", default=os.path.join(REPO, "verification", "cases"), help="directorio de casos <id>.json")
    ap.add_argument("--ogs", required=True, help="binario ogs (ogs analyze <modelo.json>)")
    ap.add_argument("--out", default=HERE, help="directorio de salida de REPORT.md y REPORT.json")
    ap.add_argument("--jobs", type=int, default=min(4, os.cpu_count() or 1), help="procesos en paralelo")
    ap.add_argument("--only", default=None, help="ids de caso separados por coma (para pruebas)")
    args = ap.parse_args(argv)

    import to_xslope as tx

    try:
        xs_version = tx.require_version()
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    cases = load_cases(args.cases, set(args.only.split(",")) if args.only else None)
    tasks = [(case, i, args.ogs) for case in cases for i in range(len(case["checks"]))]
    if args.jobs > 1:
        with cf.ProcessPoolExecutor(max_workers=args.jobs) as pool:
            rows = list(pool.map(run_check, tasks, chunksize=1))
    else:
        rows = [run_check(t) for t in tasks]
    summary = summarize(rows)

    ogs_version = next((r["ogs"]["engine"] for r in rows if r["ogs"] and r["ogs"]["engine"]), None)
    for r in rows:
        if r["ogs"]:
            r["ogs"].pop("engine", None)
    try:
        cases_dir = os.path.relpath(args.cases, start=os.getcwd())
    except ValueError:
        cases_dir = args.cases
    meta = {
        "generated_at": _dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "cases_dir": cases_dir, "xslope": xs_version, "python": platform.python_version(),
        "ogs": {"version": ogs_version},
    }
    os.makedirs(args.out, exist_ok=True)
    report = {"generated_at": meta["generated_at"], "report_version": REPORT_VERSION, "cases_dir": cases_dir,
              "engines": {"xslope": xs_version, "ogs": meta["ogs"]["version"], "python": meta["python"]},
              "summary": summary, "checks": rows}
    with open(os.path.join(args.out, "REPORT.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2, sort_keys=True)
        fh.write("\n")
    write_markdown(os.path.join(args.out, "REPORT.md"), rows, meta, summary)
    f, s = summary["fixed"], summary["search"]
    print(f"checks={summary['checks']} convertidos={summary['converted']} "
          f"fija: n={f['n']} mediana={_fmt(f['median_abs_pct'], '.3f')} % máx={_fmt(f['max_abs_pct'], '.3f')} % "
          f"({f['max_at']}) discrepancias={f['discrepancia']} · "
          f"búsqueda: n={s['n']} mediana={_fmt(s['median_abs_pct'], '.3f')} % máx={_fmt(s['max_abs_pct'], '.3f')} % ({s['max_at']})")
    print(f"escribí {os.path.join(args.out, 'REPORT.md')} y REPORT.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
