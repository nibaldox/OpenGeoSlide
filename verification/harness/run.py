#!/usr/bin/env python3
"""Cross-check harness: published value vs. ogs (CLI) vs. cSlope 0.1.0 oracle.

Usage (from the worktree root):

  uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
    python verification/harness/run.py --cases DIR --ogs PATH_BINARIO_OGS --out DIR

Writes REPORT.md and report.json into --out. A missing or failing ogs binary is
recorded as ogs=null (sin dato); it does not abort the run.
"""

from __future__ import annotations

import argparse
import copy
import datetime as _dt
import glob
import json
import math
import os
import platform
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from to_cslope import UnsupportedModel, ogs_to_cslope  # noqa: E402

HARNESS_VERSION = "1"
METHODS = ("bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected")
KINDS = ("fixed", "search")
OGS_TIMEOUT_S = 300
ORACLE_ONLY = "<oracle-only>"   # replaces the binary: the cases wait for the engine (verification/pending/F3)


def _first_line(text: str, limit: int = 200) -> str:
    line = next((ln.strip() for ln in (text or "").splitlines() if ln.strip()), "")
    return line[:limit]


# ------------------------------------------------------------------ cases

def validate_case(case: dict) -> None:
    for key in ("id", "model", "checks"):
        if key not in case:
            raise KeyError(f"missing '{key}'")
    if not isinstance(case["checks"], list) or not case["checks"]:
        raise ValueError("'checks' must be a non-empty list")
    for ch in case["checks"]:
        if ch.get("method") not in METHODS:
            raise ValueError(f"invalid method {ch.get('method')!r}")
        if ch.get("kind") not in KINDS:
            raise ValueError(f"invalid kind {ch.get('kind')!r}")
        pub = ch.get("published")
        if not isinstance(pub, (int, float)) or isinstance(pub, bool) or pub <= 0:
            raise ValueError(f"'published' must be a positive number, got {pub!r}")
        tol = ch.get("tolerance")
        if not isinstance(tol, (int, float)) or isinstance(tol, bool) or tol <= 0:
            raise ValueError(f"'tolerance' must be a positive number, got {tol!r}")


def load_cases(cases_dir: str) -> list[dict]:
    if not os.path.isdir(cases_dir):
        raise SystemExit(f"error: cases directory not found: {cases_dir}")
    paths = sorted(glob.glob(os.path.join(cases_dir, "*.json")))
    if not paths:
        raise SystemExit(f"error: no verification cases (*.json) in {cases_dir}")
    cases, errors = [], []
    for path in paths:
        try:
            with open(path, encoding="utf-8") as fh:
                case = json.load(fh)
            validate_case(case)
        except (OSError, ValueError, KeyError, TypeError) as exc:
            errors.append(f"{path}: {exc}")
            continue
        case["_path"] = os.path.relpath(path, start=os.getcwd())
        cases.append(case)
    if errors:
        for err in errors:
            print(f"invalid case: {err}", file=sys.stderr)
        raise SystemExit(1)
    return cases


# ------------------------------------------------------------- ogs engine

def model_for_check(model: dict, check: dict) -> dict:
    """Model as the acceptance test runs it: one method, optional slices, no search for fixed."""
    m = copy.deepcopy(model)
    analysis = m.setdefault("analysis", {})
    analysis["methods"] = [check["method"]]
    if "slices" in check.get("options", {}):
        analysis["slices"] = int(check["options"]["slices"])
    if check["kind"] == "fixed":
        analysis.pop("search", None)
    return m


def run_ogs(binary: str | None, model: dict, check: dict, timeout: float) -> dict:
    res = {"fos": None, "status": None, "error": None, "engine": None, "warnings": []}
    if binary == ORACLE_ONLY:
        res["error"] = "solo oráculo (--oracle-only): el motor no se ejecuta"
        return res
    if not binary:
        res["error"] = "no se indicó binario ogs (--ogs)"
        return res
    exe = binary if (os.sep in binary or os.path.isabs(binary)) else shutil.which(binary)
    if not exe or not os.path.isfile(exe):
        res["error"] = f"binario ogs no encontrado: {binary}"
        return res
    with tempfile.TemporaryDirectory(prefix="ogs-check-") as tmp:
        path = os.path.join(tmp, "model.ogs.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(model_for_check(model, check), fh, ensure_ascii=False, indent=2)
        try:
            proc = subprocess.run([exe, "analyze", path], capture_output=True, text=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            res["error"] = f"timeout tras {timeout:g} s"
            return res
        except OSError as exc:
            res["error"] = f"no se pudo ejecutar ogs: {exc}"
            return res
    if proc.returncode != 0:
        res["error"] = f"exit {proc.returncode}: {_first_line(proc.stderr or proc.stdout)}"
        return res
    try:
        report = json.loads(proc.stdout)
    except json.JSONDecodeError:
        res["error"] = f"salida no JSON: {_first_line(proc.stdout)}"
        return res
    res["engine"] = report.get("engine")
    results = report.get("results") or []
    if not results:
        res["error"] = "la salida de ogs no tiene 'results'"
        return res
    # Status first: a non-finite fos (null) with status invalid / not_converged is a method
    # outcome (contract E4f), not a missing value. The reason of a method outcome is in `warnings`
    # (MethodReport has no `message` field, R3-05).
    res["status"] = results[0].get("status")
    res["warnings"] = list(results[0].get("warnings") or [])
    fos = results[0].get("fos")
    if not isinstance(fos, (int, float)) or isinstance(fos, bool) or not math.isfinite(fos):
        if res["status"] not in (None, "converged"):
            return res
        res["error"] = f"fos no numérico: {fos!r}"
        return res
    res["fos"] = float(fos)
    return res


# -------------------------------------------------------- cSlope engine

def run_cslope(cs, document: dict) -> dict:
    res: dict = {"fos": None, "status": None, "error": None, "warnings": []}
    issues = cs.validate(document)
    res["warnings"] = [f"{i['code']}: {i['message']}" for i in issues if i.get("severity") != "error"]
    errors = [i for i in issues if i.get("severity") == "error"]
    if errors:
        res["error"] = "validación cSlope: " + "; ".join(f"{e['path']} [{e['code']}]" for e in errors[:3])
        return res
    try:
        result = cs.analyse(document)
    except Exception as exc:  # cSlope raises EngineError and friends
        res["error"] = f"{type(exc).__name__}: {_first_line(str(exc))}"
        return res
    fos = result.get("minFOS")
    if not isinstance(fos, (int, float)) or not math.isfinite(fos):
        res["error"] = "cSlope no devolvió FS finito"
        return res
    crit = result.get("criticalSurface") or {}
    res["fos"] = float(fos)
    res["status"] = "converged" if crit.get("converged", True) else "not_converged"
    res["warnings"] += [f"{w.get('code')}: {w.get('message')}" for w in result.get("warnings") or []]
    return res


# ------------------------------------------------------------- verdicts

def verdict(fos, status, published: float, tolerance: float) -> str:
    # Status is checked first: a method that did not converge has no usable FS (fos may be null).
    if status not in (None, "converged"):
        return "no convergido"
    if fos is None:
        return "sin dato"
    return "OK" if abs(fos - published) / published <= tolerance else "FALLA"


def err_pct(fos, published: float):
    return None if fos is None else (fos - published) / published * 100.0


def estado(ogs_verdict: str, cs_verdict: str) -> str:
    if ogs_verdict == "no aplica":   # --oracle-only: the state is the oracle's
        return {"OK": "cSlope reproduce", "FALLA": "revisar conversión", "sin dato": "cSlope sin dato",
                "no convergido": "cSlope no convergido"}[cs_verdict]
    parts = [ogs_verdict]
    if cs_verdict == "FALLA":
        parts.append("cSlope no reproduce: revisar conversión")
    elif cs_verdict == "sin dato":
        parts.append("cSlope sin dato")
    elif cs_verdict == "no convergido":
        parts.append("cSlope no convergido")
    return " · ".join(parts)


def build_rows(cases: list[dict], ogs_binary: str | None, cs) -> list[dict]:
    rows = []
    for case in cases:
        for ch in case["checks"]:
            published = float(ch["published"])
            tolerance = float(ch["tolerance"])
            og = run_ogs(ogs_binary, case["model"], ch, OGS_TIMEOUT_S)
            og_v = "no aplica" if ogs_binary == ORACLE_ONLY else verdict(og["fos"], og["status"], published, tolerance)

            cs_res: dict = {"fos": None, "status": None, "error": None, "warnings": []}
            notes: list[str] = []
            try:
                conv = ogs_to_cslope(case["model"], ch)
                notes = conv.notes
                cs_res = run_cslope(cs, conv.document)
            except UnsupportedModel as exc:
                cs_res["error"] = f"conversión no soportada: {exc}"
            except Exception as exc:  # keep the run going; record the failure
                cs_res["error"] = f"conversión fallida: {type(exc).__name__}: {_first_line(str(exc))}"
            cs_v = verdict(cs_res["fos"], cs_res["status"], published, tolerance)

            rows.append({
                "case_id": case["id"],
                "title": case.get("title", ""),
                "source_path": case["_path"],
                "method": ch["method"],
                "kind": ch["kind"],
                "published": published,
                "published_by": ch.get("published_by"),
                "tolerance": tolerance,
                "options": ch.get("options", {}),
                "ogs": {
                    "fos": og["fos"], "status": og["status"], "error": og["error"],
                    "engine": og["engine"], "warnings": og["warnings"],
                    "err_pct": err_pct(og["fos"], published), "verdict": og_v,
                },
                "cslope": {
                    "fos": cs_res["fos"], "status": cs_res["status"], "error": cs_res["error"],
                    "err_pct": err_pct(cs_res["fos"], published), "verdict": cs_v,
                    "warnings": cs_res["warnings"], "notes": notes,
                },
                "estado": estado(og_v, cs_v),
            })
    return rows


def summarize(rows: list[dict]) -> dict:
    def count(engine: str) -> dict:
        out = {"OK": 0, "FALLA": 0, "sin dato": 0, "no convergido": 0}
        if engine == "ogs" and rows and all(r["ogs"]["verdict"] == "no aplica" for r in rows):
            out["no aplica"] = 0
        for r in rows:
            out[r[engine]["verdict"]] += 1
        return out

    cs_ok = sum(1 for r in rows if r["cslope"]["verdict"] == "OK")
    return {
        "checks": len(rows),
        "ogs": count("ogs"),
        "cslope": count("cslope"),
        "cslope_reproduces": {"n": cs_ok, "N": len(rows)},
    }


# ------------------------------------------------------------- outputs

def _fmt(v, spec: str) -> str:
    return "—" if v is None else format(v, spec)


def write_markdown(path: str, rows: list[dict], meta: dict, summary: dict) -> None:
    L: list[str] = []
    L.append("# Verificación cruzada: publicado vs. ogs vs. cSlope")
    L.append("")
    L.append(f"Generado: {meta['generated_at']} · harness v{HARNESS_VERSION} · casos: `{meta['cases_dir']}` "
             f"({meta['n_cases']} casos, {summary['checks']} checks)")
    L.append("")
    L.append("## Motores")
    L.append("")
    if meta["ogs"]["binary"] == ORACLE_ONLY:
        L.append("- **ogs**: no se ejecutó (`--oracle-only`): estos casos esperan al motor; se verifica solo que cSlope "
                 "reproduzca el valor publicado.")
    else:
        L.append(f"- **ogs**: binario `{meta['ogs']['binary'] or '—'}` · versión: {meta['ogs']['version'] or '—'}"
                 + (f" · error: {meta['ogs']['error']}" if meta['ogs']['error'] else ""))
    L.append(f"- **cSlope**: {meta['cslope']['package']} · motor {meta['cslope']['engine_build']} · "
             f"esquema {meta['cslope']['schema_version']} · Python {meta['python']}")
    L.append("")
    L.append("## Resumen")
    L.append("")
    L.append("| motor | OK | FALLA | sin dato | no convergido |")
    L.append("|---|---:|---:|---:|---:|")
    for name, key in (("ogs", "ogs"), ("cSlope", "cslope")):
        c = summary[key]
        if "no aplica" in c:
            L.append(f"| {name} | — | — | — (no aplica: solo oráculo) | — |")
            continue
        L.append(f"| {name} | {c['OK']} | {c['FALLA']} | {c['sin dato']} | {c['no convergido']} |")
    cr = summary["cslope_reproduces"]
    L.append("")
    L.append(f"cSlope reproduce el valor publicado dentro de tolerancia en **{cr['n']}/{cr['N']}** checks.")
    L.append("")
    L.append("## Tabla")
    L.append("")
    L.append("| caso | método | tipo | publicado | ogs | err ogs % | cSlope | err cSlope % | tol % | estado |")
    L.append("|---|---|---|---:|---:|---:|---:|---:|---:|---|")
    for r in rows:
        L.append("| {case} | {m} | {k} | {pub} | {og} | {oe} | {cs} | {ce} | {tol} | {st} |".format(
            case=r["case_id"], m=r["method"], k=r["kind"],
            pub=_fmt(r["published"], ".4f"),
            og=_fmt(r["ogs"]["fos"], ".4f"), oe=_fmt(r["ogs"]["err_pct"], "+.2f"),
            cs=_fmt(r["cslope"]["fos"], ".4f"), ce=_fmt(r["cslope"]["err_pct"], "+.2f"),
            tol=_fmt(r["tolerance"] * 100, ".2f"), st=r["estado"]))
    L.append("")
    L.append("Estado: veredicto de ogs (OK / FALLA / sin dato / no convergido). Si cSlope no reproduce el "
             "publicado, se añade «revisar conversión» (el fallo puede estar en el conversor, en el "
             "publicado o en el motor).")
    L.append("")
    errors = sorted({f"ogs: {r['ogs']['error']}" for r in rows if r["ogs"]["error"] and r["ogs"]["verdict"] != "no aplica"}
                    | {f"{r['case_id']} {r['method']}/{r['kind']} cSlope: {r['cslope']['error']}"
                       for r in rows if r["cslope"]["error"]})
    if errors:
        L.append("## Errores")
        L.append("")
        for e in errors:
            L.append(f"- {e}")
        L.append("")
    notes: dict[tuple[str, str], list[str]] = {}
    for r in rows:
        for n in r["cslope"]["notes"]:
            notes.setdefault((r["case_id"], n), []).append(f"{r['method']}/{r['kind']}")
    if notes:
        L.append("## Notas de conversión")
        L.append("")
        for (case_id, n), checks in notes.items():
            L.append(f"- {case_id} ({', '.join(dict.fromkeys(checks))}): {n}")
        L.append("")
    L.append("## Reproducir")
    L.append("")
    L.append("```")
    L.append("uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \\")
    L.append("  python verification/harness/run.py --cases DIR --ogs PATH_BINARIO_OGS --out DIR")
    L.append("```")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cases", required=True, help="directory with <id>.json verification cases")
    ap.add_argument("--ogs", default=None, help="path to the ogs binary (ogs analyze <model.json>)")
    ap.add_argument("--oracle-only", action="store_true",
                    help="do not run ogs: only published vs cSlope (cases that the engine does not support yet)")
    ap.add_argument("--out", required=True, help="output directory for REPORT.md and report.json")
    args = ap.parse_args(argv)

    try:
        import cslope as cs
    except ImportError as exc:
        raise SystemExit(f"error: cslope not importable ({exc}); run with uv --with cslope==0.1.0") from exc

    cases = load_cases(args.cases)
    if args.oracle_only:
        args.ogs = ORACLE_ONLY
    rows = build_rows(cases, args.ogs, cs)
    summary = summarize(rows)

    # ogs version comes from the 'engine' field of its JSON output (None if never run OK).
    ogs_version = next((r["ogs"]["engine"] for r in rows if r["ogs"]["engine"]), None)
    ogs_error = next((r["ogs"]["error"] for r in rows if r["ogs"]["error"] and r["ogs"]["verdict"] != "no aplica"), None)
    meta = {
        "generated_at": _dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "harness_version": HARNESS_VERSION,
        "cases_dir": args.cases,
        "n_cases": len(cases),
        "python": platform.python_version(),
        "ogs": {"binary": args.ogs, "version": ogs_version, "error": ogs_error},
        "cslope": {
            "package": f"cslope {cs.__version__}",
            "version": cs.__version__,
            "engine_build": cs.ENGINE_BUILD,
            "schema_version": cs.SCHEMA_VERSION,
        },
    }

    os.makedirs(args.out, exist_ok=True)
    report = {
        "generated_at": meta["generated_at"],
        "harness_version": HARNESS_VERSION,
        "cases_dir": args.cases,
        "engines": {
            "ogs": meta["ogs"],
            "cslope": meta["cslope"],
            "python": meta["python"],
            "platform": platform.platform(),
        },
        "cases": [{"id": c["id"], "title": c.get("title", ""), "path": c["_path"],
                   "n_checks": len(c["checks"])} for c in cases],
        "summary": summary,
        "checks": rows,
    }
    with open(os.path.join(args.out, "report.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    write_markdown(os.path.join(args.out, "REPORT.md"), rows, meta, summary)

    cr = summary["cslope_reproduces"]
    print(f"cases={len(cases)} checks={summary['checks']} ogs={summary['ogs']} "
          f"cslope_reproduces={cr['n']}/{cr['N']}")
    print(f"wrote {os.path.join(args.out, 'REPORT.md')} and report.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
