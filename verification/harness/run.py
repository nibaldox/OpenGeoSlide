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

from forces import compare_forces  # noqa: E402
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
    # report.json (the output of a previous run) and HOLD.json (the held checks) live in some case directories
    paths = sorted(p for p in glob.glob(os.path.join(cases_dir, "*.json"))
                   if os.path.basename(p) not in ("report.json", "HOLD.json"))
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
    if check["method"] != "morgenstern_price":
        analysis.pop("interslice", None)
    elif (check.get("options") or {}).get("interslice"):
        # like to_cslope.interslice_options: the check's function wins over the model's (R10A-11)
        analysis["interslice"] = copy.deepcopy(check["options"]["interslice"])
    if "slices" in check.get("options", {}):
        analysis["slices"] = int(check["options"]["slices"])
    if check["kind"] == "fixed":
        analysis.pop("search", None)
    return m


def run_ogs(binary: str | None, model: dict, check: dict, timeout: float) -> dict:
    res = {"fos": None, "status": None, "error": None, "engine": None, "warnings": [], "forces": [], "surface": None}
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
    res["forces"] = list(results[0].get("reinforcement_forces") or [])
    res["surface"] = results[0].get("surface")
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
    res["forces"] = [{k: f.get(k) for k in ("index", "pile", "x", "y", "fx", "fy", "force", "passive")}
                     for f in crit.get("reinforcementForces") or []]
    res["surface"] = {"xc": crit.get("cx"), "yc": crit.get("cy"), "r": crit.get("radius")}
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

            applied = cs_res.pop("forces", None)
            cs_surface = cs_res.pop("surface", None)
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
            n_items = len(case["model"].get("reinforcements") or [])
            if n_items and applied is not None:
                # v0.4: how many forces the oracle applied on its critical surface (a force of 0 kN/m is not applied)
                rows[-1]["cslope"]["reinforcement_forces"] = {"elements": n_items, "applied": len(applied),
                                                              "forces": applied}
                if ogs_binary != ORACLE_ONLY:
                    rows[-1]["forces_comparison"] = _forces_comparison(
                        ogs_binary, case["model"], ch, og, applied, cs_surface)
    return rows


def _forces_comparison(binary: str | None, model: dict, check: dict, og: dict, applied: list[dict],
                       cs_surface: dict | None) -> dict | None:
    """Per-crossing comparison of the forces of ogs and of the oracle on the same surface.

    On a fixed surface both engines use the circle of the model. In a search each engine finds its own circle, so
    ogs is run again on the oracle's critical circle (`on_oracle_circle: true`): the crossings are compared there.
    """
    on_oracle = False
    surface = og["surface"]
    forces = og["forces"]
    if check["kind"] == "search":
        if not cs_surface or None in cs_surface.values():
            return None
        fixed_model = copy.deepcopy(model)
        fixed_model["analysis"]["surface"] = {"type": "circle", **cs_surface}
        fixed_check = dict(check, kind="fixed")
        again = run_ogs(binary, fixed_model, fixed_check, OGS_TIMEOUT_S)
        if again["error"] or again["status"] != "converged":
            return None
        forces, surface, on_oracle = again["forces"], again["surface"], True
    elif og["error"] or og["status"] != "converged":
        return None
    circle = surface if surface and {"xc", "yc", "r"} <= set(surface) else None
    out = compare_forces(model, forces, applied, circle)
    out["on_oracle_circle"] = on_oracle
    return out


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


EXPLAIN_TEXT = {
    "igual": "igual (|ΔF| ≤ 1e-9 de la fuerza)",
    "direccion": "misma magnitud, otra dirección: el oráculo mide la base en la cuerda de su dovela, ogs en la "
                 "tangente exacta del círculo en el cruce",
    "rampa": "rampa `development`: ΔF = (Tmax/ℓ)·Δs, con Δs la diferencia de posición del cruce (el oráculo cruza "
             "con la poligonal de sus dovelas, ogs con el arco)",
    "sin explicar": "SIN EXPLICAR",
}


def _deg(fx: float, fy: float) -> str:
    return "—" if fx == 0 and fy == 0 else format(math.degrees(math.atan2(fy, fx)), "+.2f")


def write_forces_section(L: list[str], rows: list[dict]) -> None:
    """Section «Comparación por cruce» of REPORT.md: one line per check, the differences and the crossings."""
    comp = [r for r in rows if r.get("forces_comparison")]
    if not comp:
        return
    L.append("## Comparación por cruce de las fuerzas de los refuerzos")
    L.append("")
    L.append("Las fuerzas que ogs aplica (`reinforcement_forces`, estado `applied`) frente a las del oráculo "
             "(`reinforcementForces`), emparejadas por elemento y por orden de `x`. En una búsqueda cada motor "
             "halla su círculo: ogs se vuelve a correr sobre el círculo crítico del oráculo (marca «◇»). "
             "`fx`, `fy` en coordenadas del modelo; la dirección es el ángulo del vector de la fuerza sobre la masa.")
    L.append("")
    L.append("| caso | método | cruces ogs | cruces oráculo | emparejados | máx \\|Δx,y\\| | máx \\|ΔF\\| | sin explicar |")
    L.append("|---|---|---:|---:|---:|---:|---:|---:|")
    for r in comp:
        c = r["forces_comparison"]
        mark = " ◇" if c.get("on_oracle_circle") else ""
        L.append(f"| {r['case_id']}{mark} | {r['method']} | {c['n_ogs']} | {c['n_oracle']} | {len(c['pairs'])} | "
                 f"{c['max_dxy']:.1e} | {c['max_dF']:.1e} | {c['unexplained']} |")
    total = sum(len(r["forces_comparison"]["pairs"]) for r in comp)
    unexplained = sum(r["forces_comparison"]["unexplained"] for r in comp)
    L.append("")
    L.append(f"**{len(comp)}** checks, **{total}** cruces emparejados, **{unexplained}** diferencias sin explicar.")
    L.append("")
    zero = [r for r in comp if r["forces_comparison"]["n_ogs"] == 0 and r["forces_comparison"]["n_oracle"] == 0]
    if zero:
        L.append("Ni ogs ni el oráculo aplican fuerza en: "
                 + ", ".join(sorted({f"{r['case_id']} ({r['method']})" for r in zero}))
                 + ". La superficie no cruza ningún elemento, así que el FS es el del talud sin refuerzo y el acuerdo "
                 "con lo publicado no prueba nada sobre los refuerzos.")
        L.append("")
    diffs = [(r, p) for r in comp for p in r["forces_comparison"]["pairs"] if p["explanation"] != "igual"]
    lone = [(r, "solo ogs", p) for r in comp for p in r["forces_comparison"]["only_ogs"]] + \
           [(r, "solo oráculo", p) for r in comp for p in r["forces_comparison"]["only_oracle"]]
    if diffs or lone:
        L.append("### Diferencias por cruce")
        L.append("")
        L.append("| caso | método | elemento | x ogs | x oráculo | Δx | fuerza ogs | fuerza oráculo | ΔF | dirección ogs → oráculo (°) | explicación |")
        L.append("|---|---|---|---:|---:|---:|---:|---:|---:|---|---|")
        seen = set()
        for r, p in diffs:
            key = (r["case_id"], p["id"], round(p["ogs"]["x"], 9), round(p["dfx"], 12), round(p["dfy"], 12))
            if key in seen:
                continue
            seen.add(key)
            o, c = p["ogs"], p["oracle"]
            L.append(f"| {r['case_id']} | {r['method']} | {p['id']} | {o['x']:.5f} | {c['x']:.5f} | {p['dx']:+.1e} | "
                     f"({o['fx']:.4f}; {o['fy']:.4f}) | ({c['fx']:.4f}; {c['fy']:.4f}) | "
                     f"{math.hypot(p['dfx'], p['dfy']):.1e} | {_deg(o['fx'], o['fy'])} → {_deg(c['fx'], c['fy'])} | "
                     f"{EXPLAIN_TEXT[p['explanation']]} |")
        for r, side, p in lone:
            L.append(f"| {r['case_id']} | {r['method']} | {p['id']} | | | | {side}: ({p['fx']:.4f}; {p['fy']:.4f}) "
                     f"en x = {p['x']:.5f} | | | | SIN EXPLICAR |")
        L.append("")
    L.append("### Cruces")
    L.append("")
    L.append("Todos los cruces emparejados (los checks con el mismo círculo y las mismas fuerzas se listan una vez). "
             "`Δr` es la distancia del punto del oráculo al círculo exacto: el oráculo cruza con la poligonal de sus "
             "dovelas, que queda por dentro del arco.")
    L.append("")
    L.append("| caso | elemento | x | y | fx ogs | fy ogs | dir ogs (°) | fx oráculo | fy oráculo | dir oráculo (°) | Δx | Δr oráculo |")
    L.append("|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    seen_checks = set()
    for r in comp:
        c = r["forces_comparison"]
        key = (r["case_id"], tuple((p["id"], round(p["ogs"]["x"], 9), round(p["ogs"]["fx"], 9), round(p["ogs"]["fy"], 9))
                                   for p in c["pairs"]))
        if key in seen_checks or not c["pairs"]:
            continue
        seen_checks.add(key)
        for p in c["pairs"]:
            o, q = p["ogs"], p["oracle"]
            radial = f"{p['radial_oracle']:+.1e}" if "radial_oracle" in p else "—"
            L.append(f"| {r['case_id']} | {p['id']} | {o['x']:.5f} | {o['y']:.5f} | {o['fx']:.4f} | {o['fy']:.4f} | "
                     f"{_deg(o['fx'], o['fy'])} | {q['fx']:.4f} | {q['fy']:.4f} | {_deg(q['fx'], q['fy'])} | "
                     f"{p['dx']:+.1e} | {radial} |")
    L.append("")


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
    write_forces_section(L, rows)
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
