#!/usr/bin/env python3
"""Differential battery: ogs (CLI) vs cSlope 0.1.0 on the synthetic cases of build_cases.py.

For each case and method (bishop, spencer) it compares two checks:

- search: ogs' circular_entry_exit search against cSlope's own search over the same ranges,
  same method and slice count. Criterion E9b (contract §4.4.6): FS_ogs <= FS_cSlope * 1.01.
  A lower ogs FS means ogs searched more thoroughly, which is acceptable.
- fixed: the same representative circle in both engines. Criterion E9b: |FS_ogs - FS_cSlope|
  / FS_cSlope <= 0.005.

The verdict goes into REPORT.md and report.json. The script exits 0 whenever it can run,
even if checks fail; only execution errors (no cases, no ogs binary, no cslope) exit non-zero.

Usage (from the worktree root):

  export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch
  uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \\
    python verification/differential/run.py [--ogs PATH] [--cases DIR] [--out DIR]
"""

from __future__ import annotations

import argparse
import datetime as _dt
import glob
import importlib.util
import json
import os
import platform
import shutil
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
HARNESS = os.path.normpath(os.path.join(HERE, "..", "harness"))
sys.path.insert(0, HARNESS)  # to_cslope.py and harness run.py are reused, not copied

from to_cslope import UnsupportedModel, ogs_to_cslope  # noqa: E402

# harness/run.py is imported by file path under a distinct module name: both scripts are named run.py.
_spec = importlib.util.spec_from_file_location("harness_run", os.path.join(HARNESS, "run.py"))
harness_run = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(harness_run)  # type: ignore[union-attr]
run_ogs = harness_run.run_ogs
run_cslope = harness_run.run_cslope
OGS_TIMEOUT_S = harness_run.OGS_TIMEOUT_S

DEFAULT_OGS = os.environ.get("OGS_BIN", "/home/xodla/archivos/opengeoslide/target/release/ogs")
METHODS = ("bishop", "spencer")
KINDS = ("search", "fixed")
EXPECTED_CASES = 10
SEARCH_MAX_REL = 0.01    # E9b: FS_ogs <= FS_cSlope * (1 + 0.01)
FIXED_MAX_REL = 0.005    # E9b: |FS_ogs - FS_cSlope| / FS_cSlope <= 0.005
REPORT_VERSION = "1"


# ------------------------------------------------------------------ cases

def load_cases(cases_dir: str) -> list[dict]:
    if not os.path.isdir(cases_dir):
        raise SystemExit(f"error: directorio de casos no encontrado: {cases_dir}")
    paths = sorted(glob.glob(os.path.join(cases_dir, "*.ogs.json")))
    if not paths:
        raise SystemExit(f"error: no hay casos (*.ogs.json) en {cases_dir}")
    cases, errors = [], []
    for path in paths:
        try:
            with open(path, encoding="utf-8") as fh:
                model = json.load(fh)
            if model.get("format") != "opengeoslide":
                raise ValueError("format != opengeoslide")
            analysis = model.get("analysis") or {}
            if not analysis.get("search") or not analysis.get("surface"):
                raise ValueError("el caso necesita analysis.search y analysis.surface")
            cases.append({"id": model["meta"]["id"], "title": model["meta"].get("title", ""),
                          "model": model, "path": os.path.relpath(path, start=os.getcwd())})
        except (OSError, ValueError, KeyError, TypeError) as exc:
            errors.append(f"{path}: {exc}")
    if errors:
        for err in errors:
            print(f"caso inválido: {err}", file=sys.stderr)
        raise SystemExit(1)
    return cases


# ------------------------------------------------------------------ checks

def _rel(a: float | None, b: float | None) -> float | None:
    if a is None or b is None or b == 0:
        return None
    return (a - b) / b


def evaluate(kind: str, ogs: dict, cs: dict) -> tuple[str, str]:
    """Verdict and reason for one check ('OK' | 'FALLA' | 'sin dato').

    A method that does not converge is a failure of ogs even when it reports a number (its FS is
    not a valid result, contract E4a/E4d), so the ogs status is checked before the FS is compared.
    """
    if ogs["error"]:
        return "sin dato", f"ogs: {ogs['error']}"
    if ogs["status"] not in (None, "converged") or ogs["fos"] is None:
        return "FALLA", f"ogs no válido (status {ogs['status']}, FS {ogs['fos']})"
    if cs["error"]:
        return "sin dato", f"cSlope: {cs['error']}"
    if cs["status"] not in (None, "converged") or cs["fos"] is None:
        return "sin dato", f"cSlope no convergido (status {cs['status']})"
    if kind == "search":
        limit = cs["fos"] * (1.0 + SEARCH_MAX_REL)
        if ogs["fos"] <= limit:
            return "OK", ""
        return "FALLA", f"ogs {ogs['fos']:.4f} > cSlope·1,01 = {limit:.4f} (ogs no conservador)"
    rel = abs(ogs["fos"] - cs["fos"]) / cs["fos"]
    if rel <= FIXED_MAX_REL:
        return "OK", ""
    return "FALLA", f"|Δ| = {rel * 100:.2f} % > 0,5 %"


def run_check(cs_module, ogs_binary: str, case: dict, method: str, kind: str) -> dict:
    check = {"method": method, "kind": kind}
    model = case["model"]

    t0 = time.perf_counter()
    ogs = run_ogs(ogs_binary, model, check, OGS_TIMEOUT_S)
    ogs_s = time.perf_counter() - t0

    cs: dict = {"fos": None, "status": None, "error": None, "warnings": []}
    notes: list[str] = []
    t0 = time.perf_counter()
    try:
        conv = ogs_to_cslope(model, check)
        notes = conv.notes
        cs = run_cslope(cs_module, conv.document)
    except UnsupportedModel as exc:
        cs["error"] = f"conversión no soportada: {exc}"
    except Exception as exc:  # keep the battery running; the failure is recorded
        cs["error"] = f"conversión fallida: {type(exc).__name__}: {exc}"
    cs_s = time.perf_counter() - t0

    verdict, reason = evaluate(kind, ogs, cs)
    return {
        "case_id": case["id"],
        "title": case["title"],
        "method": method,
        "kind": kind,
        "criterion": "búsqueda: ogs ≤ cSlope·1,01" if kind == "search" else "fija: |Δ| ≤ 0,5 %",
        "ogs": {"fos": ogs["fos"], "status": ogs["status"], "error": ogs["error"],
                "engine": ogs["engine"], "seconds": round(ogs_s, 4)},
        "cslope": {"fos": cs["fos"], "status": cs["status"], "error": cs["error"],
                   "warnings": cs["warnings"], "seconds": round(cs_s, 4)},
        "delta_pct": None if _rel(ogs["fos"], cs["fos"]) is None else round(_rel(ogs["fos"], cs["fos"]) * 100, 4),
        "verdict": verdict,
        "reason": reason,
        "notes": notes,
    }


def summarize(checks: list[dict]) -> dict:
    out = {}
    for kind in KINDS:
        rows = [c for c in checks if c["kind"] == kind]
        out[kind] = {
            "OK": sum(1 for c in rows if c["verdict"] == "OK"),
            "FALLA": sum(1 for c in rows if c["verdict"] == "FALLA"),
            "sin dato": sum(1 for c in rows if c["verdict"] == "sin dato"),
            "N": len(rows),
        }
    out["ogs_seconds"] = round(sum(c["ogs"]["seconds"] for c in checks), 3)
    out["cslope_seconds"] = round(sum(c["cslope"]["seconds"] for c in checks), 3)
    return out


# ------------------------------------------------------------------ outputs

def _fmt(v, spec: str) -> str:
    return "—" if v is None else format(v, spec)


def _verdict_row(search: dict, fixed: dict) -> str:
    """Row verdict: OK only if both checks pass; FALLA beats sin dato; names what failed."""
    failed = [(name, c["verdict"]) for name, c in (("búsqueda", search), ("fija", fixed))
              if c["verdict"] != "OK"]
    if not failed:
        return "OK"
    label = "FALLA" if any(v == "FALLA" for _, v in failed) else "sin dato"
    return label + " (" + ", ".join(name for name, _ in failed) + ")"


def write_markdown(path: str, cases: list[dict], checks: list[dict], summary: dict, meta: dict) -> None:
    by_key = {(c["case_id"], c["method"], c["kind"]): c for c in checks}
    L: list[str] = []
    L.append("# Batería diferencial: ogs vs cSlope 0.1.0 (línea base W7b)")
    L.append("")
    L.append(f"Generado: {meta['generated_at']} · casos: {len(cases)} · checks: {len(checks)} "
             f"(búsqueda + superficie fija, bishop y spencer)")
    L.append("")
    L.append("## Motores")
    L.append("")
    L.append(f"- **ogs**: `{meta['ogs']['binary']}` · versión: {meta['ogs']['version'] or '—'}")
    L.append(f"- **cSlope**: {meta['cslope']['package']} · motor {meta['cslope']['engine_build']} · "
             f"esquema {meta['cslope']['schema_version']} · Python {meta['python']}")
    L.append("")
    L.append("## Criterio (E9b, briefs/00_CONTRATOS.md §4.4.6)")
    L.append("")
    L.append("- **Búsqueda**: `FS_ogs ≤ FS_cSlope · 1,01`, con el mismo método, número de dovelas y rangos. "
             "Un FS de ogs menor es más exhaustivo y se acepta.")
    L.append("- **Superficie fija**: `|FS_ogs − FS_cSlope| / FS_cSlope ≤ 0,5 %`, con el mismo círculo.")
    L.append("- El veredicto no detiene la batería: el exit code es 0 aunque haya fallos.")
    L.append("")
    L.append("## Resumen")
    L.append("")
    s, f = summary["search"], summary["fixed"]
    L.append(f"**búsqueda OK {s['OK']}/{s['N']}** · **fija OK {f['OK']}/{f['N']}**")
    L.append("")
    L.append("| criterio | OK | FALLA | sin dato |")
    L.append("|---|---:|---:|---:|")
    L.append(f"| búsqueda | {s['OK']} | {s['FALLA']} | {s['sin dato']} |")
    L.append(f"| fija | {f['OK']} | {f['FALLA']} | {f['sin dato']} |")
    L.append("")
    L.append(f"Tiempo total: ogs {summary['ogs_seconds']} s · cSlope {summary['cslope_seconds']} s.")
    L.append("")
    L.append("## Tabla de línea base")
    L.append("")
    L.append("| caso | método | búsqueda ogs | búsqueda cSlope | Δ% búsqueda | fija ogs | fija cSlope | Δ% fija | veredicto |")
    L.append("|---|---|---:|---:|---:|---:|---:|---:|---|")
    for case in cases:
        for method in METHODS:
            sr = by_key[(case["id"], method, "search")]
            fx = by_key[(case["id"], method, "fixed")]
            L.append("| {cid} {title} | {m} | {so} | {sc} | {sd} | {fo} | {fc} | {fd} | {v} |".format(
                cid=case["id"], title=case["title"], m=method,
                so=_fmt(sr["ogs"]["fos"], ".4f"), sc=_fmt(sr["cslope"]["fos"], ".4f"),
                sd=_fmt(sr["delta_pct"], "+.2f"),
                fo=_fmt(fx["ogs"]["fos"], ".4f"), fc=_fmt(fx["cslope"]["fos"], ".4f"),
                fd=_fmt(fx["delta_pct"], "+.2f"),
                v=_verdict_row(sr, fx)))
    L.append("")
    L.append("Δ% = (FS_ogs − FS_cSlope) / FS_cSlope · 100. El veredicto de la fila combina las dos comprobaciones.")
    L.append("")
    fails = [c for c in checks if c["verdict"] != "OK"]
    L.append("## Fallos y motivos")
    L.append("")
    if not fails:
        L.append("Ninguno.")
    for c in fails:
        L.append(f"- {c['case_id']} {c['method']}/{c['kind']}: **{c['verdict']}**. {c['reason']}")
    L.append("")
    L.append("## Tiempos por check")
    L.append("")
    L.append("| caso | método | tipo | ogs s | cSlope s |")
    L.append("|---|---|---|---:|---:|")
    for c in checks:
        L.append(f"| {c['case_id']} | {c['method']} | {c['kind']} | {c['ogs']['seconds']:.3f} | "
                 f"{c['cslope']['seconds']:.3f} |")
    L.append("")
    notes = sorted({(c["case_id"], n) for c in checks for n in c["notes"]})
    if notes:
        L.append("## Notas de conversión")
        L.append("")
        for cid, n in notes:
            L.append(f"- {cid}: {n}")
        L.append("")
    errs = sorted({f"{c['case_id']} {c['method']}/{c['kind']} {engine}: {err}"
                   for c in checks for engine, err in (("ogs", c["ogs"]["error"]),
                                                       ("cSlope", c["cslope"]["error"]))
                   if err})
    if errs:
        L.append("## Errores y rechazos de motor")
        L.append("")
        for e in errs:
            L.append(f"- {e}")
        L.append("")
    L.append("## Reproducir")
    L.append("")
    L.append("```")
    L.append("export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch")
    L.append("uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \\")
    L.append("  python verification/differential/run.py --ogs PATH_BINARIO_OGS")
    L.append("```")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ogs", default=DEFAULT_OGS, help="binario ogs (ogs analyze <modelo>)")
    ap.add_argument("--cases", default=os.path.join(HERE, "cases"), help="directorio con *.ogs.json")
    ap.add_argument("--out", default=HERE, help="directorio de REPORT.md y report.json")
    args = ap.parse_args(argv)

    exe = args.ogs if os.path.isfile(args.ogs) else shutil.which(args.ogs)
    if not exe or not os.path.isfile(exe):
        print(f"error: binario ogs no encontrado: {args.ogs}", file=sys.stderr)
        return 1
    try:
        import cslope as cs_module
    except ImportError as exc:
        print(f"error: cslope no importable ({exc}); ejecutar con uv --with cslope==0.1.0", file=sys.stderr)
        return 1

    cases = load_cases(args.cases)
    if len(cases) != EXPECTED_CASES:
        print(f"error: se esperaban {EXPECTED_CASES} casos y hay {len(cases)}", file=sys.stderr)
        return 1

    checks = []
    for case in cases:
        for method in METHODS:
            for kind in KINDS:
                checks.append(run_check(cs_module, exe, case, method, kind))
        print(f"{case['id']} listo", flush=True)
    summary = summarize(checks)

    ogs_version = next((c["ogs"]["engine"] for c in checks if c["ogs"]["engine"]), None)
    meta = {
        "generated_at": _dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "ogs": {"binary": exe, "version": ogs_version},
        "cslope": {"package": f"cslope {cs_module.__version__}", "engine_build": cs_module.ENGINE_BUILD,
                   "schema_version": cs_module.SCHEMA_VERSION},
        "python": platform.python_version(),
    }
    os.makedirs(args.out, exist_ok=True)
    report = {
        "report_version": REPORT_VERSION,
        "generated_at": meta["generated_at"],
        "criteria": {"search_max_rel": SEARCH_MAX_REL, "fixed_max_rel": FIXED_MAX_REL,
                     "source": "briefs/00_CONTRATOS.md §4.4.6 (E9b)"},
        "engines": {**meta, "platform": platform.platform()},
        "cases": [{"id": c["id"], "title": c["title"], "path": c["path"]} for c in cases],
        "summary": summary,
        "checks": checks,
    }
    with open(os.path.join(args.out, "report.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    write_markdown(os.path.join(args.out, "REPORT.md"), cases, checks, summary, meta)

    print(f"búsqueda OK {summary['search']['OK']}/{summary['search']['N']}")
    print(f"fija OK {summary['fixed']['OK']}/{summary['fixed']['N']}")
    print(f"wrote {os.path.join(args.out, 'REPORT.md')} and report.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
