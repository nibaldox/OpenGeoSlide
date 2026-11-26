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

Phase 3a (contract F3.8) adds a second block, after the one above and without changing it: Morgenstern-Price with
the half-sine function and corrected Janbu on the fixed circle of each of the 14 models, plus the v0.3 models
D15-D23 (undrained Su, M-P functions, fixed polylines). Each capability the engine may not have yet (undrained, Morgenstern-Price,
Janbu, polyline) is probed first with a tiny model; a check that needs one the engine lacks is `pendiente`, never
a failure. With `--require-f3` a pending or failing check makes the exit code non-zero (use it at integration).

Usage (from the worktree root):

  export TMPDIR="$(mktemp -d)"
  uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \\
    python verification/differential/run.py [--ogs PATH] [--cases DIR] [--out DIR]
"""

from __future__ import annotations

import argparse
import copy
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
sys.path.insert(0, HERE)     # build_cases.py: the models of the capability probes

import build_cases  # noqa: E402
from to_cslope import UnsupportedModel, ogs_to_cslope  # noqa: E402

# harness/run.py is imported by file path under a distinct module name: both scripts are named run.py.
_spec = importlib.util.spec_from_file_location("harness_run", os.path.join(HARNESS, "run.py"))
harness_run = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(harness_run)  # type: ignore[union-attr]
run_ogs = harness_run.run_ogs
run_cslope = harness_run.run_cslope
OGS_TIMEOUT_S = harness_run.OGS_TIMEOUT_S

# Default binary: the release build of this worktree (cargo build --release -p ogs-cli), not another checkout.
DEFAULT_OGS = os.environ.get(
    "OGS_BIN", os.path.normpath(os.path.join(HERE, "..", "..", "target", "release", "ogs")))
METHODS = ("bishop", "spencer")
KINDS = ("search", "fixed")
EXPECTED_CASES = 14
EXPECTED_CASES_F3 = 9
CASES_F3_DIR = os.path.join(HERE, "cases_f3")
SEARCH_MAX_REL = 0.01    # E9b: FS_ogs <= FS_cSlope * (1 + 0.01)
FIXED_MAX_REL = 0.005    # E9b: |FS_ogs - FS_cSlope| / FS_cSlope <= 0.005
REPORT_VERSION = "3"
VERDICT_OK = "OK"
# Fixed surface where both engines declare no solution (ogs not_converged/invalid, cSlope EngineError): a match.
VERDICT_BOTH_NO_SOLUTION = "OK (concordancia: ambos sin solución)"
PASS_VERDICTS = (VERDICT_OK, VERDICT_BOTH_NO_SOLUTION)
# Informative ogs warnings (contract §4.5 / E5, E7d, E10a, E11a′): notes, not warnings. Any other code is a warning
# that the report lists. The list must match INFORMATIVE_WARNINGS in crates/ogs-core/tests/acceptance.rs.
OGS_INFORMATIVE_WARNINGS = (
    "negative_effective_normal",
    "truncated_mass",
    "negative_lambda",
    "load_outside_mass",
    "multiple_admissible_roots",
)


# Phase 3a (contract F3.8)
F3_NEW_METHODS = ("morgenstern_price", "janbu_corrected")
CAPABILITIES = ("undrained", "morgenstern_price", "janbu_corrected", "polyline")
VERDICT_PENDING = "pendiente"
EXIT_F3_PENDING = 3


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


def cslope_declares_no_solution(cs: dict) -> bool:
    """cSlope declares the check without a solution: EngineError ('No valid slip surface …') or a result with
    ``criticalSurface.converged == False`` (status ``not_converged``).

    The second case returns a ``minFOS`` that is the closest pair of Fm/Ff, not a root of the equilibrium
    (docs/fase1/exploracion/X6.md; for example R3-01b: 0,0830 not converged against the real root 0,2685). That
    number is never a reference value: it counts as «oráculo sin solución», the same as an EngineError.
    """
    if cs["error"] and cs["error"].startswith("EngineError"):
        return True
    return not cs["error"] and cs["status"] not in (None, "converged")


def cslope_no_solution_text(cs: dict) -> str:
    """Why cSlope has no solution, for the reason column."""
    if cs["error"]:
        return cs["error"]
    return f"no convergido (status {cs['status']}, minFOS {cs['fos']:.4f} no es una raíz)" if cs["fos"] is not None \
        else f"no convergido (status {cs['status']})"


def evaluate(kind: str, ogs: dict, cs: dict) -> tuple[str, str]:
    """Verdict and reason for one check ('OK' | 'OK (concordancia…)' | 'FALLA' | 'sin dato').

    A method that does not converge is a failure of ogs even when it reports a number (its FS is
    not a valid result, contract E4a/E4d), so the ogs status is checked before the FS is compared.

    No-solution rule (W9, fixed surface only): when both engines declare the surface without a solution
    (ogs not_converged/invalid and cSlope EngineError or converged = false), the verdict is
    VERDICT_BOTH_NO_SOLUTION. When only one of them declares it, the check is FALLA. A cSlope result with
    converged = false is a «sin solución» of the oracle, never a reference FS (X6). An ogs execution error is never
    a declaration: it stays sin dato.
    """
    if ogs["error"]:
        return "sin dato", f"ogs: {ogs['error']}"
    ogs_no = ogs["status"] not in (None, "converged") or ogs["fos"] is None
    cs_no = cslope_declares_no_solution(cs)
    if ogs_no and cs_no:
        if kind == "fixed":
            return VERDICT_BOTH_NO_SOLUTION, (
                f"ambos motores declaran la superficie sin solución: ogs {ogs['status']}, cSlope {cslope_no_solution_text(cs)}")
        return "FALLA", f"ogs no válido (status {ogs['status']}, FS {ogs['fos']}); cSlope sin solución"
    if ogs_no:
        return "FALLA", f"ogs no válido (status {ogs['status']}, FS {ogs['fos']})"
    if cs_no:
        return "FALLA", f"solo cSlope declara la superficie sin solución ({cslope_no_solution_text(cs)}); ogs da FS {ogs['fos']:.4f}"
    if cs["error"]:
        return "sin dato", f"cSlope: {cs['error']}"
    if cs["fos"] is None:
        return "sin dato", "cSlope sin FS"
    if kind == "search":
        limit = cs["fos"] * (1.0 + SEARCH_MAX_REL)
        if ogs["fos"] <= limit:
            return VERDICT_OK, ""
        return "FALLA", f"ogs {ogs['fos']:.4f} > cSlope·1,01 = {limit:.4f} (ogs no conservador)"
    rel = abs(ogs["fos"] - cs["fos"]) / cs["fos"]
    if rel <= FIXED_MAX_REL:
        return VERDICT_OK, ""
    return "FALLA", f"|Δ| = {rel * 100:.2f} % > 0,5 %"


def non_informative_warnings(warnings: list[str]) -> list[str]:
    """ogs warnings that are not informative notes (OGS_INFORMATIVE_WARNINGS), in order, without repeats."""
    out: list[str] = []
    for w in warnings:
        if w not in OGS_INFORMATIVE_WARNINGS and w not in out:
            out.append(w)
    return out


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
                "engine": ogs["engine"], "seconds": round(ogs_s, 4), "warnings": ogs["warnings"]},
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
            "OK": sum(1 for c in rows if c["verdict"] in PASS_VERDICTS),
            "ambos_sin_solucion": sum(1 for c in rows if c["verdict"] == VERDICT_BOTH_NO_SOLUTION),
            "FALLA": sum(1 for c in rows if c["verdict"] == "FALLA"),
            "sin dato": sum(1 for c in rows if c["verdict"] == "sin dato"),
            "N": len(rows),
        }
    out["ogs_seconds"] = round(sum(c["ogs"]["seconds"] for c in checks), 3)
    out["cslope_seconds"] = round(sum(c["cslope"]["seconds"] for c in checks), 3)
    return out


# ------------------------------------------------------------------ Phase 3a: v0.3 models, M-P, Janbu, polyline

def load_f3_cases(cases_dir: str) -> list[dict]:
    """The v0.3 models (D15-D23). A directory without them is an empty list: the block is then skipped."""
    cases = []
    for path in sorted(glob.glob(os.path.join(cases_dir, "*.ogs.json"))):
        with open(path, encoding="utf-8") as fh:
            model = json.load(fh)
        if model.get("format") != "opengeoslide" or not (model.get("analysis") or {}).get("surface"):
            raise SystemExit(f"caso inválido: {path}")
        cases.append({"id": model["meta"]["id"], "title": model["meta"].get("title", ""), "model": model,
                      "path": os.path.relpath(path, start=os.getcwd())})
    return cases


def f3_model(model: dict, method: str) -> dict:
    """The model as the v0.3 block runs it: a copy with version "0.3" (the 0.1 / 0.2 originals are not touched)."""
    out = copy.deepcopy(model)
    out["version"] = "0.3"
    return out


def capabilities_needed(model: dict, method: str) -> list[str]:
    """Engine capabilities a check needs, in the order of CAPABILITIES."""
    needs = set()
    if any(m.get("model") == "undrained" for m in model.get("materials", [])):
        needs.add("undrained")
    if ((model.get("analysis") or {}).get("surface") or {}).get("type") == "polyline":
        needs.add("polyline")
    if method in F3_NEW_METHODS:
        needs.add(method)
    return [c for c in CAPABILITIES if c in needs]


def f3_plan(cases: list[dict], f3_cases: list[dict]) -> list[tuple[dict, str, str, list[str]]]:
    """(case, method, kind, capabilities) of the v0.3 block: contract F3.8.

    - D01-D14: M-P (half_sine, the default) and corrected Janbu on the fixed circle (criterion E9b, 0.5 %);
    - undrained models on a circle: Bishop and Spencer in search and fixed, then the two new methods fixed;
    - the polyline model: Spencer, M-P and corrected Janbu fixed (no Bishop, F3.6; a polyline has no search).
    """
    plan = []
    for case in cases:
        for method in F3_NEW_METHODS:
            plan.append((case, method, "fixed", capabilities_needed(f3_model(case["model"], method), method)))
    for case in f3_cases:
        model = case["model"]
        if model["analysis"]["surface"]["type"] == "polyline":
            for method in model["analysis"]["methods"]:
                plan.append((case, method, "fixed", capabilities_needed(model, method)))
            continue
        for method in ("bishop", "spencer"):
            for kind in KINDS_BY_ORDER:
                plan.append((case, method, kind, capabilities_needed(model, method)))
        for method in F3_NEW_METHODS:
            plan.append((case, method, "fixed", capabilities_needed(model, method)))
    return plan


KINDS_BY_ORDER = ("search", "fixed")


def _probe_model(capability: str) -> tuple[dict, dict]:
    """A tiny, valid model and check for one capability, on a circle that every engine handles (D01)."""
    if capability == "polyline":
        model = build_cases.build_all_f3()["D17"]
        return model, {"method": "spencer", "kind": "fixed"}
    model = build_cases.build_all()["D01"]
    model["version"] = "0.3"
    if capability == "undrained":
        model["materials"] = [build_cases._undrained("soil", "Suelo", 18.0, 40.0)]
        model["regions"][0]["material"] = "soil"
        return model, {"method": "bishop", "kind": "fixed"}
    return model, {"method": capability, "kind": "fixed"}


def probe_capabilities(ogs_binary: str, runner=None) -> dict[str, dict]:
    """Does the engine run each Phase 3a capability? {capability: {supported, detail}}.

    Supported means a converged, finite FS on a tiny model. Anything else is reported as not supported with the
    engine's own message, so the report shows why (an engine that rejects "0.3" or panics at `unimplemented!`).
    """
    runner = runner or run_ogs
    out = {}
    for cap in CAPABILITIES:
        model, check = _probe_model(cap)
        res = runner(ogs_binary, model, check, OGS_TIMEOUT_S)
        ok = not res["error"] and res["fos"] is not None and res["status"] in (None, "converged")
        detail = "" if ok else (res["error"] or f"sin FS (status {res['status']})")
        out[cap] = {"supported": ok, "detail": detail}
    return out


def run_f3_check(cs_module, ogs_binary: str, case: dict, method: str, kind: str, caps: list[str], probe: dict,
                 ogs_runner=None) -> dict:
    ogs_runner = ogs_runner or run_ogs
    check = {"method": method, "kind": kind}
    model = f3_model(case["model"], method)
    missing = [c for c in caps if not probe[c]["supported"]]

    ogs: dict = {"fos": None, "status": None, "error": None, "engine": None, "warnings": []}
    ogs_s = 0.0
    if not missing:
        t0 = time.perf_counter()
        ogs = ogs_runner(ogs_binary, model, check, OGS_TIMEOUT_S)
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

    if missing:
        verdict = VERDICT_PENDING
        reason = "motor sin soporte de " + ", ".join(
            f"{c} ({probe[c]['detail'][:100]})" for c in missing)
    else:
        verdict, reason = evaluate(kind, ogs, cs)
    return {
        "case_id": case["id"],
        "title": case["title"],
        "method": method,
        "kind": kind,
        "surface": model["analysis"]["surface"]["type"],
        "capabilities": caps,
        "criterion": "búsqueda: ogs ≤ cSlope·1,01" if kind == "search" else "fija: |Δ| ≤ 0,5 %",
        "ogs": {"fos": ogs["fos"], "status": ogs["status"], "error": ogs["error"], "engine": ogs["engine"],
                "seconds": round(ogs_s, 4), "warnings": ogs["warnings"]},
        "cslope": {"fos": cs["fos"], "status": cs["status"], "error": cs["error"], "warnings": cs["warnings"],
                   "seconds": round(cs_s, 4)},
        "delta_pct": None if _rel(ogs["fos"], cs["fos"]) is None else round(_rel(ogs["fos"], cs["fos"]) * 100, 4),
        "verdict": verdict,
        "reason": reason,
        "notes": notes,
    }



def summarize_f3(rows: list[dict]) -> dict:
    return {
        "OK": sum(1 for r in rows if r["verdict"] in PASS_VERDICTS),
        "ambos_sin_solucion": sum(1 for r in rows if r["verdict"] == VERDICT_BOTH_NO_SOLUTION),
        "FALLA": sum(1 for r in rows if r["verdict"] == "FALLA"),
        "sin dato": sum(1 for r in rows if r["verdict"] == "sin dato"),
        "pendiente": sum(1 for r in rows if r["verdict"] == VERDICT_PENDING),
        "N": len(rows),
    }


def f3_markdown(cases: list[dict], f3_cases: list[dict], rows: list[dict], probe: dict) -> list[str]:
    """The `## Fase 3a` section of REPORT.md, as lines."""
    s = summarize_f3(rows)
    L = [
        "## Fase 3a: M-P medio seno, Janbu corregido, no drenado y polilínea (F3.8)",
        "",
        "Se corre, sobre el círculo fijo de cada uno de los 14 modelos, Morgenstern-Price con la función `half_sine` y "
        "Janbu corregido, con el criterio de 0,5 % de E9b. Se agregan nueve modelos v0.3 (`cases_f3/`): "
        "D15 terraplén sobre arcilla blanda con Su lineal, D16 depósito de relaves con Su constante, D17 bloque "
        "deslizante sobre una capa débil con polilínea fija (sin Bishop, F3.6) y, de R10, D18 corte con Su "
        "decreciente y piso, D19 y D20 M-P con `clipped_sine` y `trapezoidal`, D21 polilínea sobre un contacto de "
        "materiales y D22 y D23 polilínea en terreno horizontal con kh y con carga lineal horizontal. Cada capacidad que el motor aún no "
        "tiene se sondea antes con un modelo mínimo; el check que la necesita queda **pendiente**, nunca falla. "
        "El valor de cSlope de un check pendiente igual se calcula y queda como línea base.",
        "",
        "| capacidad | soportada por el motor | detalle |",
        "|---|---|---|",
    ]
    for cap in CAPABILITIES:
        L.append(f"| {cap} | {'sí' if probe[cap]['supported'] else 'no'} | {probe[cap]['detail'] or '—'} |")
    L += [
        "",
        f"**OK {s['OK']}/{s['N']}** · FALLA {s['FALLA']} · sin dato {s['sin dato']} · pendiente {s['pendiente']} "
        f"(de los OK, {s['ambos_sin_solucion']} por concordancia: ambos sin solución).",
        "",
        "| caso | método | tipo | ogs | cSlope | Δ% | veredicto |",
        "|---|---|---|---:|---:|---:|---|",
    ]
    for r in rows:
        L.append("| {cid} | {m} | {k} | {o} | {c} | {d} | {v} |".format(
            cid=r["case_id"], m=r["method"], k=r["kind"] + (" (polilínea)" if r["surface"] == "polyline" else ""),
            o=_fmt(r["ogs"]["fos"], ".4f"), c=_fmt(r["cslope"]["fos"], ".4f"),
            d=_fmt(r["delta_pct"], "+.2f"), v=r["verdict"]))
    fails = [r for r in rows if r["verdict"] not in PASS_VERDICTS and r["verdict"] != VERDICT_PENDING]
    L += ["", "### Fallos y datos faltantes de la Fase 3a", ""]
    if not fails:
        L.append("Ninguno.")
    for r in fails:
        L.append(f"- {r['case_id']} {r['method']}/{r['kind']}: **{r['verdict']}**. {r['reason']}")
    L.append("")
    return L


# ------------------------------------------------------------------ outputs

def _fmt(v, spec: str) -> str:
    return "—" if v is None else format(v, spec)


def _verdict_row(search: dict, fixed: dict) -> str:
    """Row verdict: OK only if both checks pass; FALLA beats sin dato; names what failed."""
    failed = [(name, c["verdict"]) for name, c in (("búsqueda", search), ("fija", fixed))
              if c["verdict"] not in PASS_VERDICTS]
    if not failed:
        return next((c["verdict"] for c in (search, fixed) if c["verdict"] != VERDICT_OK), VERDICT_OK)
    label = "FALLA" if any(v == "FALLA" for _, v in failed) else "sin dato"
    return label + " (" + ", ".join(name for name, _ in failed) + ")"


def _warnings_cell(sr: dict, fx: dict) -> str:
    """Non-informative ogs warnings of the two checks of a row, per check; '—' when there are none."""
    parts = []
    for name, c in (("búsqueda", sr), ("fija", fx)):
        warnings = non_informative_warnings(c["ogs"]["warnings"])
        if warnings:
            parts.append(f"{name}: {', '.join(warnings)}")
    return " · ".join(parts) if parts else "—"


def write_markdown(path: str, cases: list[dict], checks: list[dict], summary: dict, meta: dict,
                   f3_lines: list[str] | None = None) -> None:
    by_key = {(c["case_id"], c["method"], c["kind"]): c for c in checks}
    L: list[str] = []
    L.append("# Batería diferencial: ogs vs cSlope 0.1.0 (W9)")
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
    L.append("- **Concordancia (W9)**: si ogs declara la superficie fija sin solución (`not_converged` o `invalid`) "
             "y cSlope también (`EngineError` o `converged: false`), el veredicto es "
             "`OK (concordancia: ambos sin solución)`. Si solo uno de los dos la declara, es `FALLA`.")
    L.append("- Un resultado de cSlope con `converged: false` (el par Fm/Ff más cercano, no una raíz; X6) es un "
             "oráculo sin solución, igual que un `EngineError`, y nunca es un valor de referencia: su `minFOS` "
             "figura en la tabla pero no se compara.")
    L.append("- El veredicto no detiene la batería: el exit code es 0 aunque haya fallos.")
    L.append("")
    L.append("## Resumen")
    L.append("")
    s, f = summary["search"], summary["fixed"]
    L.append(f"**búsqueda OK {s['OK']}/{s['N']}** · **fija OK {f['OK']}/{f['N']}**")
    L.append("")
    L.append("| criterio | OK | de ellos, ambos sin solución | FALLA | sin dato |")
    L.append("|---|---:|---:|---:|---:|")
    L.append(f"| búsqueda | {s['OK']} | {s['ambos_sin_solucion']} | {s['FALLA']} | {s['sin dato']} |")
    L.append(f"| fija | {f['OK']} | {f['ambos_sin_solucion']} | {f['FALLA']} | {f['sin dato']} |")
    L.append("")
    L.append(f"Tiempo total: ogs {summary['ogs_seconds']} s · cSlope {summary['cslope_seconds']} s.")
    L.append("")
    L.append("## Tabla de línea base")
    L.append("")
    L.append("| caso | método | búsqueda ogs | búsqueda cSlope | Δ% búsqueda | fija ogs | fija cSlope | Δ% fija "
             "| avisos ogs (no informativos) | veredicto |")
    L.append("|---|---|---:|---:|---:|---:|---:|---:|---|---|")
    for case in cases:
        for method in METHODS:
            sr = by_key[(case["id"], method, "search")]
            fx = by_key[(case["id"], method, "fixed")]
            L.append("| {cid} {title} | {m} | {so} | {sc} | {sd} | {fo} | {fc} | {fd} | {w} | {v} |".format(
                cid=case["id"], title=case["title"], m=method,
                so=_fmt(sr["ogs"]["fos"], ".4f"), sc=_fmt(sr["cslope"]["fos"], ".4f"),
                sd=_fmt(sr["delta_pct"], "+.2f"),
                fo=_fmt(fx["ogs"]["fos"], ".4f"), fc=_fmt(fx["cslope"]["fos"], ".4f"),
                fd=_fmt(fx["delta_pct"], "+.2f"),
                w=_warnings_cell(sr, fx),
                v=_verdict_row(sr, fx)))
    L.append("")
    L.append("Δ% = (FS_ogs − FS_cSlope) / FS_cSlope · 100. El veredicto de la fila combina las dos comprobaciones.")
    L.append("Avisos de ogs: se listan por comprobación los códigos que no son informativos "
             "(`negative_effective_normal`, `truncated_mass` y `negative_lambda` son notas informativas). "
             "`—` significa que no hay avisos no informativos.")
    L.append("")
    n_warned = sum(1 for c in checks if non_informative_warnings(c["ogs"]["warnings"]))
    L.append(f"Checks de ogs con avisos no informativos: {n_warned} de {len(checks)}.")
    L.append("")
    fails = [c for c in checks if c["verdict"] not in PASS_VERDICTS]
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
    if f3_lines:
        L.extend(f3_lines)
    L.append("## Reproducir")
    L.append("")
    L.append("```")
    L.append('export TMPDIR="$(mktemp -d)"')
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
    ap.add_argument("--cases-f3", default=CASES_F3_DIR, help="directorio con los modelos v0.3 (D15-D23)")
    ap.add_argument("--require-f3", action="store_true",
                    help=f"salir con código {EXIT_F3_PENDING} si algún check de la Fase 3a queda pendiente, "
                         "falla o no tiene dato (para la integración)")
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

    # Phase 3a block: after the one above, which it does not touch
    f3_cases = load_f3_cases(args.cases_f3) if os.path.isdir(args.cases_f3) else []
    f3_rows: list[dict] = []
    probe: dict = {}
    if f3_cases:
        if len(f3_cases) != EXPECTED_CASES_F3:
            print(f"error: se esperaban {EXPECTED_CASES_F3} modelos v0.3 y hay {len(f3_cases)}", file=sys.stderr)
            return 1
        probe = probe_capabilities(exe)
        for case, method, kind, caps in f3_plan(cases, f3_cases):
            f3_rows.append(run_f3_check(cs_module, exe, case, method, kind, caps, probe))
        print(f"fase 3a: {summarize_f3(f3_rows)}", flush=True)

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
    if f3_cases:
        report["f3"] = {
            "criteria": {"fixed_max_rel": FIXED_MAX_REL, "search_max_rel": SEARCH_MAX_REL,
                         "source": "briefs/02_CONTRATOS_FASE3.md F3.8"},
            "capabilities": probe,
            "cases": [{"id": c["id"], "title": c["title"], "path": c["path"]} for c in f3_cases],
            "summary": summarize_f3(f3_rows),
            "checks": f3_rows,
        }
    with open(os.path.join(args.out, "report.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    write_markdown(os.path.join(args.out, "REPORT.md"), cases, checks, summary, meta,
                   f3_markdown(cases, f3_cases, f3_rows, probe) if f3_cases else None)

    print(f"búsqueda OK {summary['search']['OK']}/{summary['search']['N']}")
    print(f"fija OK {summary['fixed']['OK']}/{summary['fixed']['N']}")
    print(f"wrote {os.path.join(args.out, 'REPORT.md')} and report.json")
    if args.require_f3 and f3_rows and summarize_f3(f3_rows)["OK"] != len(f3_rows):
        print("--require-f3: hay checks de la Fase 3a pendientes, con fallo o sin dato", file=sys.stderr)
        return EXIT_F3_PENDING
    return 0


if __name__ == "__main__":
    sys.exit(main())
