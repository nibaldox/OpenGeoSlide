"""Tests for the differential battery (W7b). Run from the worktree root, see README.md.

- the fourteen generated models are the committed ones (no drift);
- the ogs binary accepts every model (search and fixed) without InvalidModel;
- the cSlope converter accepts every model and cSlope validates the document;
- the E9b verdict rules of run.py.

The ogs binary is required: if it is missing the tests fail (they never pass by skipping).
"""

from __future__ import annotations

import copy
import importlib.util
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
HARNESS = HERE.parent / "harness"
sys.path.insert(0, str(HARNESS))
sys.path.insert(0, str(HERE))

import build_cases  # noqa: E402
from to_cslope import ogs_to_cslope  # noqa: E402

DEFAULT_OGS = os.path.normpath(os.path.join(HERE, "..", "..", "target", "release", "ogs"))
OGS_BIN = os.environ.get("OGS_BIN", DEFAULT_OGS)
MODELS = build_cases.build_all()
CASE_IDS = sorted(MODELS)


def _load_run():
    """run.py by file path: the harness also has a run.py, and both must not collide."""
    spec = importlib.util.spec_from_file_location("differential_run", HERE / "run.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


run = _load_run()


def _ogs_binary() -> str:
    exe = OGS_BIN if os.path.isfile(OGS_BIN) else shutil.which(OGS_BIN)
    if not exe:
        pytest.fail(f"binario ogs no encontrado: {OGS_BIN} (definir OGS_BIN)")
    return exe


def _ogs_analyze(model: dict, method: str, kind: str, tmp_path: Path) -> subprocess.CompletedProcess:
    check = {"method": method, "kind": kind}
    doc = run.harness_run.model_for_check(model, check)
    path = tmp_path / "model.ogs.json"
    path.write_text(json.dumps(doc), encoding="utf-8")
    return subprocess.run([_ogs_binary(), "analyze", str(path)], capture_output=True, text=True, timeout=300)


# ------------------------------------------------------------ cases

def test_fourteen_cases_with_intent():
    assert CASE_IDS == [f"D{i:02d}" for i in range(1, 15)]
    for case_id, model in MODELS.items():
        assert model["meta"]["notes"].strip(), f"{case_id} has no intent note"
        assert model["units"] == "SI"
        assert model["water"]["unit_weight"] == build_cases.GAMMA_W
        assert model["analysis"]["slices"] == 50
        assert model["analysis"]["surface"]["type"] == "circle"
        assert model["analysis"]["search"]["type"] == "circular_entry_exit"


def test_committed_cases_match_builder():
    for case_id, model in MODELS.items():
        path = HERE / "cases" / f"{case_id}.ogs.json"
        assert path.is_file(), f"missing {path.name}: run build_cases.py"
        assert path.read_text(encoding="utf-8") == build_cases.serialize(model), (
            f"{path.name} is stale: rerun build_cases.py")


def test_v0_2_cases_carry_seismic_and_loads_as_designed():
    """D11-D14 are the only v0.2 models; D01-D10 stay v0.1 and byte-identical to the previous battery."""
    for case_id, model in MODELS.items():
        assert model["version"] == ("0.2" if case_id >= "D11" else "0.1"), case_id
        has_new = bool(model.get("loads")) or "seismic" in model["analysis"]
        assert has_new == (case_id >= "D11"), case_id
    assert MODELS["D11"]["analysis"]["seismic"] == {"kh": 0.15, "kv": 0.0}
    assert MODELS["D12"]["loads"] == [{"type": "udl", "id": "u1", "x1": 0.0, "x2": 10.0, "q": 50.0}]
    assert MODELS["D12"]["analysis"]["seismic"] == {"kh": 0.0, "kv": -0.05}
    assert MODELS["D13"]["loads"] == [{"type": "line", "id": "l1", "x": 6.0, "p": 100.0, "angle": 15.0}]
    assert MODELS["D14"]["analysis"]["seismic"] == {"kh": 0.1, "kv": 0.0}
    assert MODELS["D14"]["water"]["piezometric_line"]
    assert list(MODELS["D12"]).index("loads") == list(MODELS["D12"]).index("water") + 1  # F1.1: after water


def test_material_mix_covers_mining_and_civil_cases():
    materials = {m["id"] for model in MODELS.values() for m in model["materials"]}
    assert {"weak", "waste", "rock", "clay", "core"} <= materials
    assert any(m.get("ru") for model in MODELS.values() for m in model["materials"])
    assert any(model["water"].get("piezometric_line") for model in MODELS.values())


# ------------------------------------------------------------ ogs

@pytest.mark.parametrize("case_id", CASE_IDS)
@pytest.mark.parametrize("method", ["bishop", "spencer"])
def test_ogs_accepts_search(case_id, method, tmp_path):
    proc = _ogs_analyze(MODELS[case_id], method, "search", tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "InvalidModel" not in proc.stderr
    report = json.loads(proc.stdout)
    assert report["results"][0]["method"] == method
    assert report["results"][0]["fos"] is not None


@pytest.mark.parametrize("case_id", CASE_IDS)
@pytest.mark.parametrize("method", ["bishop", "spencer"])
def test_ogs_accepts_fixed_surface(case_id, method, tmp_path):
    proc = _ogs_analyze(MODELS[case_id], method, "fixed", tmp_path)
    # exit 0 means the surface is valid; a method that does not converge is still a report.
    assert proc.returncode == 0, proc.stderr
    assert "InvalidModel" not in proc.stderr and "NoValidSurface" not in proc.stderr


# ------------------------------------------------------------ cSlope

@pytest.mark.parametrize("case_id", CASE_IDS)
@pytest.mark.parametrize("method", ["bishop", "spencer"])
@pytest.mark.parametrize("kind", ["search", "fixed"])
def test_cslope_accepts_document(case_id, method, kind):
    import cslope

    conv = ogs_to_cslope(MODELS[case_id], {"method": method, "kind": kind})
    errors = [i for i in cslope.validate(conv.document) if i.get("severity") == "error"]
    assert not errors, errors


# ------------------------------------------------------------ verdict rules (E9b)

def _side(fos, status="converged", error=None):
    return {"fos": fos, "status": status, "error": error}


def test_search_criterion_allows_one_percent_above_oracle():
    assert run.evaluate("search", _side(0.3408), _side(0.3307))[0] == "FALLA"  # +3.06 %
    assert run.evaluate("search", _side(0.3340), _side(0.3307))[0] == "OK"     # +1.0 %
    assert run.evaluate("search", _side(0.3300), _side(0.3307))[0] == "OK"     # more thorough


def test_fixed_criterion_is_half_a_percent_either_way():
    assert run.evaluate("fixed", _side(1.0049), _side(1.0))[0] == "OK"
    assert run.evaluate("fixed", _side(0.9951), _side(1.0))[0] == "OK"
    assert run.evaluate("fixed", _side(1.0060), _side(1.0))[0] == "FALLA"
    assert run.evaluate("fixed", _side(0.9940), _side(1.0))[0] == "FALLA"


def test_ogs_not_converged_is_a_failure_even_with_a_number():
    verdict, reason = run.evaluate("fixed", _side(2.83, status="not_converged"), _side(0.5187))
    assert verdict == "FALLA"
    assert "not_converged" in reason


def test_missing_values_are_no_data_not_a_pass():
    assert run.evaluate("search", _side(None, error="exit 2"), _side(0.3))[0] == "sin dato"
    assert run.evaluate("fixed", _side(0.5), _side(None, error="conversión no soportada: x"))[0] == "sin dato"
    assert run.evaluate("fixed", _side(0.5), _side(None))[0] == "sin dato"
    # An ogs execution error is never a declaration of no solution.
    assert run.evaluate("fixed", _side(None, error="exit 2"), _side(None, error="EngineError: x"))[0] == "sin dato"


def test_one_side_declaring_no_solution_is_a_failure():
    # cSlope has no surface, ogs has one: a discrepancy, not a no-data case (W9).
    verdict, reason = run.evaluate("fixed", _side(0.5), _side(None, error="EngineError: No valid slip surface"))
    assert verdict == "FALLA"
    assert "cSlope" in reason
    # ogs has no solution, cSlope has a surface.
    assert run.evaluate("fixed", _side(2.83, status="not_converged"), _side(0.5187))[0] == "FALLA"
    assert run.evaluate("fixed", _side(None, status="invalid"), _side(0.5187))[0] == "FALLA"


def test_both_engines_without_solution_on_a_fixed_surface_is_concordance():
    cs_err = _side(None, error="EngineError: No valid slip surface was found")
    verdict, reason = run.evaluate("fixed", _side(2.83, status="not_converged"), cs_err)
    assert verdict == "OK (concordancia: ambos sin solución)" == run.VERDICT_BOTH_NO_SOLUTION
    assert verdict in run.PASS_VERDICTS
    assert "ambos motores" in reason
    assert run.evaluate("fixed", _side(None, status="invalid"), cs_err)[0] == run.VERDICT_BOTH_NO_SOLUTION


def test_cslope_not_converged_is_an_oracle_without_solution_never_a_reference():
    """X6: converged = false is cSlope's closest Fm/Ff pair, not a root. Same semantics as EngineError."""
    cs_nc = _side(0.0830, status="not_converged")  # R3-01b: not converged 0.0830, the real root is 0.2685
    assert run.cslope_declares_no_solution(cs_nc)
    assert not run.cslope_declares_no_solution(_side(0.2685))
    assert not run.cslope_declares_no_solution(_side(None, error="conversión no soportada: x"))
    # fixed surface: both without solution is concordance, whatever ogs would have compared against 0.0830
    for ogs in (_side(2.83, status="not_converged"), _side(None, status="invalid")):
        verdict, reason = run.evaluate("fixed", ogs, cs_nc)
        assert verdict == run.VERDICT_BOTH_NO_SOLUTION and "no es una raíz" in reason
    # only the oracle without solution: FALLA, and the oracle's number is not used as reference
    verdict, reason = run.evaluate("fixed", _side(0.0830), cs_nc)  # equal to the oracle's number: still FALLA
    assert verdict == "FALLA" and "solo cSlope" in reason
    verdict, _ = run.evaluate("search", _side(0.0830), cs_nc)
    assert verdict == "FALLA"
    # only ogs without solution, the oracle has a root
    assert run.evaluate("fixed", _side(None, status="not_converged"), _side(0.2685))[0] == "FALLA"
    # the concordance rule is not extended to the search
    assert run.evaluate("search", _side(None, status="not_converged"), cs_nc)[0] == "FALLA"


def test_both_without_solution_is_not_concordance_on_search():
    # The concordance rule is for the fixed surface only (E9b). A search where both fail stays FALLA.
    cs_err = _side(None, error="EngineError: No valid slip surface was found")
    assert run.evaluate("search", _side(None, status="not_converged"), cs_err)[0] == "FALLA"


def test_run_writes_report_and_exits_zero_with_failures(tmp_path):
    """Full path on the 14 cases: exit 0 even though some checks fail, and the summary counts 28+28."""
    cases = tmp_path / "cases"
    shutil.copytree(HERE / "cases", cases)
    out = tmp_path / "out"
    code = run.main(["--ogs", _ogs_binary(), "--cases", str(cases), "--out", str(out)])
    assert code == 0
    report = json.loads((out / "report.json").read_text(encoding="utf-8"))
    assert len(report["checks"]) == 56
    assert report["summary"]["search"]["N"] == 28 and report["summary"]["fixed"]["N"] == 28
    assert (out / "REPORT.md").read_text(encoding="utf-8").startswith("# Batería diferencial")
    # R4-04: the ogs warnings of every check are kept in report.json and listed in REPORT.md.
    for check in report["checks"]:
        assert isinstance(check["ogs"]["warnings"], list), check["case_id"]
    text = (out / "REPORT.md").read_text(encoding="utf-8")
    assert "| avisos ogs (no informativos) | veredicto |" in text
    assert "Checks de ogs con avisos no informativos:" in text


# ------------------------------------------------------------ ogs warnings (R4-04)

def test_informative_ogs_warnings_are_the_notes_of_the_contract():
    # Same list as INFORMATIVE_WARNINGS in crates/ogs-core/tests/acceptance.rs (E5, E10a, E11a′, E12b, E12e).
    assert set(run.OGS_INFORMATIVE_WARNINGS) == {
        "negative_effective_normal", "truncated_mass", "negative_lambda", "load_outside_mass",
        "multiple_admissible_roots", "reinforcement_outside_mass", "reinforcement_compression_ignored",
        "structural_checks_not_covered"}


def test_non_informative_warnings_keep_driving_and_major_codes():
    warnings = ["negative_effective_normal", "truncated_driving_mass", "truncated_mass", "negative_lambda",
                "negative_effective_normal_major", "truncated_driving_mass"]
    assert run.non_informative_warnings(warnings) == ["truncated_driving_mass", "negative_effective_normal_major"]
    assert run.non_informative_warnings([]) == []


def test_warnings_cell_lists_only_non_informative_codes_per_check():
    def check(warnings):
        return {"ogs": {"warnings": warnings}}

    assert run._warnings_cell(check(["negative_lambda"]), check([])) == "—"
    assert run._warnings_cell(check(["truncated_driving_mass"]), check(["negative_effective_normal_major"])) == (
        "búsqueda: truncated_driving_mass · fija: negative_effective_normal_major")


# ------------------------------------------------------------ Phase 3a: v0.3 models, M-P, Janbu, polyline (F3.8)

F3_MODELS = build_cases.build_all_f3()


def test_v0_3_models_d15_d23_are_committed_and_designed_as_intended():
    assert sorted(F3_MODELS) == [f"D{i}" for i in range(15, 24)]
    for case_id, model in F3_MODELS.items():
        path = HERE / "cases_f3" / f"{case_id}.ogs.json"
        assert path.read_text(encoding="utf-8") == build_cases.serialize(model), f"{path.name} is stale"
        assert model["version"] == "0.3" and model["units"] == "SI" and model["meta"]["notes"].strip()
        assert model["analysis"]["slices"] == 50
    # the v0.1 / v0.2 battery does not move: D01-D14 stay where they were
    assert sorted(p.name for p in (HERE / "cases").glob("*.ogs.json")) == [f"D{i:02d}.ogs.json" for i in range(1, 15)]
    linear = {m["id"]: m for m in F3_MODELS["D15"]["materials"]}["clay"]
    assert linear["model"] == "undrained" and (linear["undrained_strength"], linear["strength_datum"],
                                               linear["strength_gradient"]) == (15.0, 0.0, 1.5)
    assert "cohesion" not in linear and "friction_angle" not in linear
    constant = {m["id"]: m for m in F3_MODELS["D16"]["materials"]}["tailings"]
    assert constant["model"] == "undrained" and "strength_gradient" not in constant
    for case_id in ("D15", "D16", "D18", "D19", "D20"):
        a = F3_MODELS[case_id]["analysis"]
        assert a["methods"][:2] == ["bishop", "spencer"] and a["surface"]["type"] == "circle" and a["search"]
    d17 = F3_MODELS["D17"]["analysis"]
    assert d17["surface"]["type"] == "polyline" and len(d17["surface"]["points"]) >= 3 and "search" not in d17
    assert "bishop" not in d17["methods"] and set(d17["methods"]) == {"spencer", "morgenstern_price", "janbu_corrected"}


def test_r10_models_d18_d23_cover_what_the_93_cases_and_d01_d17_did_not():
    """R10A-11 4 and the contrapositives of E13l-2 and E13l-5: each model is there for one thing."""
    d18 = {m["id"]: m for m in F3_MODELS["D18"]["materials"]}["clay"]
    assert d18["model"] == "undrained" and d18["strength_gradient"] < 0 and d18["strength_limit"] > 0
    # the floor is reached inside the fixed circle: its lowest point is under the depth where Su gets to the limit
    circle = F3_MODELS["D18"]["analysis"]["surface"]
    floor_y = d18["strength_datum"] + (d18["undrained_strength"] - d18["strength_limit"]) / d18["strength_gradient"]
    assert circle["yc"] - circle["r"] < floor_y
    for cid, fn in (("D19", "clipped_sine"), ("D20", "trapezoidal")):
        a = F3_MODELS[cid]["analysis"]
        assert a["interslice"] == {"function": fn} and "morgenstern_price" in a["methods"], cid
    assert F3_MODELS["D19"]["regions"] == F3_MODELS["D20"]["regions"]        # only the function differs
    assert F3_MODELS["D19"]["analysis"]["surface"] == F3_MODELS["D20"]["analysis"]["surface"]
    # D21: a segment of the polyline lies exactly on the edge shared by two regions
    d21 = F3_MODELS["D21"]
    shared = {y for r in d21["regions"] for _, y in r["polygon"]}
    pts = d21["analysis"]["surface"]["points"]
    assert any(a[1] == b[1] and a[1] in shared and a[1] == 10.0 for a, b in zip(pts, pts[1:]))
    assert len(d21["regions"]) == 2 and len(d21["materials"]) == 2
    # D22 and D23: level ground, a driving force that is only horizontal (kh, or a line load at 90 degrees)
    for cid in ("D22", "D23"):
        m = F3_MODELS[cid]
        ground = {y for r in m["regions"] for x, y in r["polygon"] if y > 0}
        assert ground == {10.0} and m["analysis"]["surface"]["type"] == "polyline", cid
    assert F3_MODELS["D22"]["analysis"]["seismic"]["kh"] == 0.3 and "loads" not in F3_MODELS["D22"]
    assert F3_MODELS["D23"]["loads"][0]["angle"] == 90.0 and "seismic" not in F3_MODELS["D23"]["analysis"]


def _plan():
    return run.f3_plan(list(MODELS_AS_CASES), list(F3_AS_CASES))


MODELS_AS_CASES = [{"id": k, "title": v["meta"]["title"], "model": v} for k, v in MODELS.items()]
F3_AS_CASES = [{"id": k, "title": v["meta"]["title"], "model": v} for k, v in F3_MODELS.items()]


def test_f3_plan_runs_m_p_and_janbu_corrected_on_every_circle_and_the_new_models():
    plan = _plan()
    by_case = {}
    for case, method, kind, caps in plan:
        by_case.setdefault(case["id"], []).append((method, kind, tuple(caps)))
    for i in range(1, 15):                      # D01-D14: only the fixed circle, M-P half_sine and Janbu corrected
        assert by_case[f"D{i:02d}"] == [("morgenstern_price", "fixed", ("morgenstern_price",)),
                                        ("janbu_corrected", "fixed", ("janbu_corrected",))], i
    for cid in ("D15", "D16"):                  # undrained: Bishop and Spencer in search and fixed, then the new ones
        assert [(m, k) for m, k, _ in by_case[cid]] == [
            ("bishop", "search"), ("bishop", "fixed"), ("spencer", "search"), ("spencer", "fixed"),
            ("morgenstern_price", "fixed"), ("janbu_corrected", "fixed")]
        assert all("undrained" in caps for _, _, caps in by_case[cid])
    assert by_case["D17"] == [("spencer", "fixed", ("polyline",)),
                              ("morgenstern_price", "fixed", ("morgenstern_price", "polyline")),
                              ("janbu_corrected", "fixed", ("janbu_corrected", "polyline"))]
    for cid in ("D18", "D19", "D20"):             # circles: the same plan as D15 and D16
        assert [(m, k) for m, k, _ in by_case[cid]] == [
            ("bishop", "search"), ("bishop", "fixed"), ("spencer", "search"), ("spencer", "fixed"),
            ("morgenstern_price", "fixed"), ("janbu_corrected", "fixed")], cid
    assert [m for m, _, _ in by_case["D21"]] == ["spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]
    assert [m for m, _, _ in by_case["D22"]] == ["spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]
    assert [m for m, _, _ in by_case["D23"]] == ["janbu_simplified", "janbu_corrected"]
    assert len(plan) == 28 + 12 + 3 + 28


def test_f3_models_use_version_0_3_for_the_new_methods_even_when_the_case_is_older():
    model = run.f3_model(MODELS["D01"], "morgenstern_price")
    assert model["version"] == "0.3" and MODELS["D01"]["version"] == "0.1"      # the original is not modified


def test_cslope_accepts_every_f3_document_and_gives_a_converged_value():
    import cslope

    for case, method, kind, _ in _plan():
        conv = ogs_to_cslope(run.f3_model(case["model"], method), {"method": method, "kind": kind})
        errors = [i for i in cslope.validate(conv.document) if i.get("severity") == "error"]
        assert not errors, (case["id"], method, errors)
        cs = run.harness_run.run_cslope(cslope, conv.document)
        if case["id"] == "D03" and method == "morgenstern_price":
            continue                                    # the oracle has no valid surface here (as Spencer on D03)
        assert cs["fos"] is not None and cs["status"] == "converged", (case["id"], method, kind, cs)


def _all_supported():
    return {cap: {"supported": True, "detail": ""} for cap in run.CAPABILITIES}


def _fake_ogs(unsupported=()):
    """A stand-in for run_ogs: the capabilities in `unsupported` fail like an engine that does not have them."""
    def runner(binary, model, check, timeout):
        needs = set()
        if any(m["model"] == "undrained" for m in model["materials"]):
            needs.add("undrained")
        if model["analysis"].get("surface", {}).get("type") == "polyline":
            needs.add("polyline")
        needs.add(check["method"])
        if needs & set(unsupported):
            return {"fos": None, "status": None, "error": "exit 101: not implemented: F3-W1b", "engine": None,
                    "warnings": []}
        return {"fos": 1.0, "status": "converged", "error": None, "engine": "fake", "warnings": []}
    return runner


def test_probe_marks_a_capability_pending_with_the_engine_message_and_keeps_the_others():
    probe = run.probe_capabilities("ogs", runner=_fake_ogs(unsupported=("morgenstern_price",)))
    assert set(probe) == set(run.CAPABILITIES)
    assert probe["morgenstern_price"]["supported"] is False
    assert "F3-W1b" in probe["morgenstern_price"]["detail"]
    for cap in ("undrained", "janbu_corrected", "polyline"):
        assert probe[cap]["supported"] is True, cap
    assert all(c["supported"] for c in run.probe_capabilities("ogs", runner=_fake_ogs()).values())


def test_a_check_that_needs_an_unsupported_capability_is_pending_not_failed():
    import cslope

    case = next(c for c in MODELS_AS_CASES if c["id"] == "D01")
    probe = run.probe_capabilities("ogs", runner=_fake_ogs(unsupported=("morgenstern_price",)))
    row = run.run_f3_check(cslope, "ogs", case, "morgenstern_price", "fixed", ["morgenstern_price"], probe,
                           ogs_runner=_fake_ogs(unsupported=("morgenstern_price",)))
    assert row["verdict"] == run.VERDICT_PENDING == "pendiente"
    assert "morgenstern_price" in row["reason"] and "F3-W1b" in row["reason"]
    assert row["ogs"]["fos"] is None and row["cslope"]["fos"] is not None      # the oracle value is still recorded
    assert row["verdict"] not in run.PASS_VERDICTS


def test_a_supported_capability_is_compared_with_the_oracle_and_can_fail():
    import cslope

    case = next(c for c in MODELS_AS_CASES if c["id"] == "D01")
    row = run.run_f3_check(cslope, "ogs", case, "janbu_corrected", "fixed", ["janbu_corrected"], _all_supported(),
                           ogs_runner=_fake_ogs())          # the fake engine answers 1.0, far from 0.857
    assert row["verdict"] == "FALLA" and "0,5 %" in row["reason"]


def test_f3_summary_counts_pending_apart_and_the_old_summary_keys_do_not_change():
    checks = [{"kind": "fixed", "verdict": v, "ogs": {"seconds": 0.0}, "cslope": {"seconds": 0.0}}
              for v in ("OK", "pendiente", "pendiente", "FALLA", "sin dato", run.VERDICT_BOTH_NO_SOLUTION)]
    s = run.summarize_f3(checks)
    assert s == {"OK": 2, "ambos_sin_solucion": 1, "FALLA": 1, "sin dato": 1, "pendiente": 2, "N": 6}
    old = run.summarize([{"kind": "fixed", "verdict": "OK", "ogs": {"seconds": 0.1}, "cslope": {"seconds": 0.1}}])
    assert set(old) == {"search", "fixed", "ogs_seconds", "cslope_seconds"}
    assert "pendiente" not in old["fixed"]


def test_f3_section_of_the_report_says_pending_and_lists_the_capabilities(tmp_path):
    import cslope

    unsupported = ("morgenstern_price", "janbu_corrected", "polyline")
    probe = run.probe_capabilities("ogs", runner=_fake_ogs(unsupported=unsupported))
    rows = [run.run_f3_check(cslope, "ogs", c, m, k, caps, probe, ogs_runner=_fake_ogs(unsupported=unsupported))
            for c, m, k, caps in _plan()]
    text = "\n".join(run.f3_markdown(MODELS_AS_CASES, F3_AS_CASES, rows, probe))
    assert "## Fase 3a" in text and "pendiente" in text
    assert "| morgenstern_price | no |" in text and "| undrained | sí |" in text
    summary = run.summarize_f3(rows)
    assert summary["N"] == 71 and summary["pendiente"] > 0 and summary["pendiente"] + summary["FALLA"] \
        + summary["OK"] + summary["sin dato"] == 71
    # undrained is supported by the fake engine: Bishop and Spencer on D15 and D16 are compared, not pending
    assert any(r["case_id"] == "D15" and r["method"] == "bishop" and r["verdict"] == "FALLA" for r in rows)


def test_run_keeps_the_old_report_and_adds_the_f3_section(tmp_path):
    """Full path: the 56 checks and their summary are the ones of before; F3 is an extra section, exit code 0."""
    cases = tmp_path / "cases"
    shutil.copytree(HERE / "cases", cases)
    out = tmp_path / "out"
    code = run.main(["--ogs", _ogs_binary(), "--cases", str(cases), "--out", str(out)])
    assert code == 0
    report = json.loads((out / "report.json").read_text(encoding="utf-8"))
    assert len(report["checks"]) == 56 and report["summary"]["search"]["N"] == 28 and report["summary"]["fixed"]["N"] == 28
    assert report["report_version"] == "4"
    f3 = report["f3"]
    assert f3["summary"]["N"] == 71 and set(f3["capabilities"]) == set(run.CAPABILITIES)
    assert f3["summary"]["FALLA"] + f3["summary"]["sin dato"] + f3["summary"]["pendiente"] + f3["summary"]["OK"] == 71
    text = (out / "REPORT.md").read_text(encoding="utf-8")
    assert text.startswith("# Batería diferencial") and "## Fase 3a" in text
    assert text.index("## Tabla de línea base") < text.index("## Fase 3a") < text.index("## Reproducir")
    # every F3 check that is not pending was compared with the oracle (never silently skipped)
    for row in f3["checks"]:
        assert row["verdict"] in ("OK", run.VERDICT_BOTH_NO_SOLUTION, "FALLA", "sin dato", "pendiente"), row


def test_require_f3_turns_pending_into_a_failing_exit_code(tmp_path, monkeypatch):
    monkeypatch.setattr(run, "probe_capabilities", lambda *a, **k: {
        cap: {"supported": cap == "undrained", "detail": "exit 2: no soportado"} for cap in run.CAPABILITIES})
    cases = tmp_path / "cases"
    shutil.copytree(HERE / "cases", cases)
    out = tmp_path / "out"
    assert run.main(["--ogs", _ogs_binary(), "--cases", str(cases), "--out", str(out)]) == 0
    assert run.main(["--ogs", _ogs_binary(), "--cases", str(cases), "--out", str(out), "--require-f3"]) == 3


# ------------------------------------------------------------ v0.4: reinforcements (D24-D27)

F3R_MODELS = build_cases.build_all_f3r()
F3R_AS_CASES = [{"id": k, "title": v["meta"]["title"], "model": v, "path": f"cases_f3r/{k}.ogs.json"}
                for k, v in F3R_MODELS.items()]
# Forces that cSlope 0.1.0 applies on the fixed circle of each model (`reinforcementForces`): D24 three of the four nails
# (the first one stays short), D25 five of the eight layers (G5 almost at its tip), D26 the anchor and the sheet pile, D27 the pile.
F3R_ORACLE_FORCES = {"D24": 3, "D25": 5, "D26": 2, "D27": 1}


def test_v0_4_models_d24_d27_are_committed_and_designed_as_intended():
    assert list(F3R_MODELS) == ["D24", "D25", "D26", "D27"]
    for case_id, model in F3R_MODELS.items():
        path = build_cases.CASES_F3R_DIR / f"{case_id}.ogs.json"
        assert path.read_text(encoding="utf-8") == build_cases.serialize(model), f"{case_id} drifts from the builder"
        assert model["version"] == "0.4" and model["units"] == "SI" and model["meta"]["notes"].strip()
        assert model["analysis"]["surface"]["type"] == "circle" and "search" not in model["analysis"]
        assert model["analysis"]["methods"] == ["bishop", "morgenstern_price", "janbu_corrected"]
        ids = [r["id"] for r in model["reinforcements"]]
        assert len(ids) == len(set(ids)), case_id
        assert list(model).index("reinforcements") == list(model).index("slope") - 1
    types = {k: {r["type"] for r in m["reinforcements"]} for k, m in F3R_MODELS.items()}
    assert types == {"D24": {"nail"}, "D25": {"geosynthetic"}, "D26": {"sheet_pile", "anchor"}, "D27": {"pile"}}
    d25 = F3R_MODELS["D25"]["reinforcements"]
    assert {r["pullout"]["model"] for r in d25} == {"development", "interface"}
    assert {r["direction"] for r in d25} == {"axial", "tangent"}
    d26 = {r["type"]: r for r in F3R_MODELS["D26"]["reinforcements"]}
    assert d26["anchor"]["application"] == "active" and d26["sheet_pile"]["application"] == "passive"
    assert {r["application"] for r in F3R_MODELS["D24"]["reinforcements"]} == {"passive"}
    assert F3R_MODELS["D26"]["slope"]["direction"] == "right_to_left"      # the two orientations are covered


def test_v0_4_models_pass_the_v0_4_schema():
    import jsonschema

    schema = json.loads((HERE.parent.parent / "schema" / "ogs-0.4.schema.json").read_text(encoding="utf-8"))
    for case_id, model in F3R_MODELS.items():
        errors = list(jsonschema.validators.validator_for(schema)(schema).iter_errors(model))
        assert not errors, (case_id, [e.message for e in errors])


@pytest.mark.parametrize("case_id", sorted(F3R_MODELS))
@pytest.mark.parametrize("method", ["bishop", "morgenstern_price", "janbu_corrected"])
def test_ogs_accepts_the_v0_4_models(case_id, method, tmp_path):
    """The engine parses and validates the model: it analyzes it, or (before R1) it reaches the stub of the forces."""
    proc = _ogs_analyze(F3R_MODELS[case_id], method, "fixed", tmp_path)
    assert "InvalidModel" not in proc.stderr and "NoValidSurface" not in proc.stderr, proc.stderr
    assert proc.returncode == 0 or "R1: fuerzas de refuerzo" in proc.stderr, proc.stderr


@pytest.mark.parametrize("case_id", sorted(F3R_MODELS))
@pytest.mark.parametrize("method", ["bishop", "morgenstern_price", "janbu_corrected"])
def test_cslope_converges_on_every_v0_4_model_and_applies_the_forces_of_the_design(case_id, method):
    import cslope

    model = F3R_MODELS[case_id]
    conv = ogs_to_cslope(model, {"method": method, "kind": "fixed"})
    res = run.run_cslope(cslope, conv.document)
    assert res["error"] is None and res["status"] == "converged" and res["fos"] is not None, res
    assert len(res["forces"]) == F3R_ORACLE_FORCES[case_id], res["forces"]
    # the battery discriminates: without the reinforcements the factor is clearly lower (>= 5 %)
    bare = copy.deepcopy(model)
    bare["version"], bare["reinforcements"] = "0.3", []
    ref = run.run_cslope(cslope, ogs_to_cslope(bare, {"method": method, "kind": "fixed"}).document)
    assert res["fos"] >= 1.05 * ref["fos"], (case_id, method, res["fos"], ref["fos"])


def test_the_passive_and_active_forces_of_d26_come_from_the_two_elements_and_have_the_designed_size():
    import cslope

    conv = ogs_to_cslope(F3R_MODELS["D26"], {"method": "bishop", "kind": "fixed"})
    forces = run.run_cslope(cslope, conv.document)["forces"]
    by_pile = {bool(f.get("pile")): f for f in forces}
    assert by_pile[True]["force"] == pytest.approx(120.0) and by_pile[True]["passive"] is True
    # the anchor is crossed in its free length: the force is the head capacity, 300 / 2.5 (E14m-2)
    assert by_pile[False]["force"] == pytest.approx(120.0, rel=1e-9) and by_pile[False]["passive"] is False
    assert by_pile[False]["fx"] > 0 > by_pile[False]["fy"]          # toward the stable side (+x), downward


# ---- the probe, the plan and the pending checks of the v0.4 block

def _f3r_probe(supported=(True, True)):
    return {cap: {"supported": ok, "detail": "" if ok else "exit 101: not implemented: R1"}
            for cap, ok in zip(run.CAPABILITIES_F3R, supported)}


def _f3r_fake_ogs(factors=None, error=None):
    """A stand-in for run_ogs that answers the figure of the oracle of each probe, scaled by `factors`."""
    factors = factors or {}

    def runner(binary, model, check, timeout):
        if error:
            return {"fos": None, "status": None, "error": error, "engine": None, "warnings": []}
        app = model["reinforcements"][0]["application"]
        cap = f"reinforcements_{app}"
        return {"fos": build_cases.PROBE_F3R_BISHOP[cap] * factors.get(cap, 1.0), "status": "converged",
                "error": None, "engine": "fake", "warnings": []}
    return runner


def test_the_probe_models_are_the_anchor_rows_of_f4_13_and_the_figures_are_the_oracle_ones():
    for cap, app in (("reinforcements_active", "active"), ("reinforcements_passive", "passive")):
        model = build_cases.probe_f3r_model(cap)
        assert model["version"] == "0.4" and model["analysis"]["methods"] == ["bishop"]
        assert model["reinforcements"] == [{"id": "A1", "type": "anchor", "x1": 52.0, "y1": 28.0, "x2": 25.0, "y2": 28.0,
                                            "application": app, "tensile_capacity": 100.0, "direction": "axial"}]
    assert build_cases.PROBE_F3R_BISHOP == {"reinforcements_active": 1.333661, "reinforcements_passive": 1.248405}


def test_the_probe_figures_are_what_the_oracle_gives():
    import cslope

    for cap, want in build_cases.PROBE_F3R_BISHOP.items():
        conv = ogs_to_cslope(build_cases.probe_f3r_model(cap), {"method": "bishop", "kind": "fixed"})
        assert run.run_cslope(cslope, conv.document)["fos"] == pytest.approx(want, abs=5e-7), cap


def test_probe_f3r_supported_only_when_bishop_reproduces_the_oracle_to_0_1_percent():
    ok = run.probe_f3r("ogs", runner=_f3r_fake_ogs())
    assert all(v["supported"] for v in ok.values()) and set(ok) == set(run.CAPABILITIES_F3R)
    # the engine runs the passive anchor but its methods ignore the terms divided by F: 0.3 % high
    passive_missing = run.probe_f3r("ogs", runner=_f3r_fake_ogs({"reinforcements_passive": 1.003}))
    assert passive_missing["reinforcements_active"]["supported"] is True
    assert passive_missing["reinforcements_passive"]["supported"] is False
    assert "0,1 %" in passive_missing["reinforcements_passive"]["detail"]
    # 0.05 % off is inside the tolerance
    assert run.probe_f3r("ogs", runner=_f3r_fake_ogs({"reinforcements_active": 1.0005}))["reinforcements_active"]["supported"]
    stub = run.probe_f3r("ogs", runner=_f3r_fake_ogs(error="exit 101: not yet implemented: R1: fuerzas de refuerzo"))
    assert not any(v["supported"] for v in stub.values()) and "R1" in stub["reinforcements_active"]["detail"]


def test_f3r_plan_runs_three_methods_per_model_and_asks_for_the_capabilities_of_its_applications():
    plan = run.f3r_plan(F3R_AS_CASES)
    assert len(plan) == 12 and {k for _, _, k, _ in plan} == {"fixed"}
    caps = {}
    for case, method, _, c in plan:
        caps.setdefault(case["id"], set()).add(tuple(c))
        assert method in ("bishop", "morgenstern_price", "janbu_corrected")
    assert caps == {"D24": {("reinforcements_passive",)}, "D25": {("reinforcements_passive",)},
                    "D26": {("reinforcements_active", "reinforcements_passive")}, "D27": {("reinforcements_passive",)}}


def test_a_v0_4_check_without_the_capability_is_pending_and_with_it_can_fail():
    import cslope

    case = F3R_AS_CASES[2]                                    # D26: needs the two
    pending = run.run_f3_check(cslope, "ogs", case, "bishop", "fixed", ["reinforcements_active", "reinforcements_passive"],
                               _f3r_probe((True, False)), ogs_runner=_f3r_fake_ogs(), prepare=run.f3r_model)
    assert pending["verdict"] == run.VERDICT_PENDING and "reinforcements_passive" in pending["reason"]
    assert pending["ogs"]["fos"] is None and pending["cslope"]["fos"] is not None
    assert pending["surface"] == "circle" and pending["kind"] == "fixed"

    def one_percent_high(binary, model, check, timeout):
        return {"fos": 1.01 * 1.9876, "status": "converged", "error": None, "engine": "fake", "warnings": []}
    failed = run.run_f3_check(cslope, "ogs", case, "bishop", "fixed", ["reinforcements_active", "reinforcements_passive"],
                              _f3r_probe(), ogs_runner=one_percent_high, prepare=run.f3r_model)
    assert failed["verdict"] == "FALLA" and "0,5 %" in failed["reason"]

    def exact(binary, model, check, timeout):
        return {"fos": 1.9876, "status": "converged", "error": None, "engine": "fake", "warnings": []}
    passed = run.run_f3_check(cslope, "ogs", case, "bishop", "fixed", ["reinforcements_active", "reinforcements_passive"],
                              _f3r_probe(), ogs_runner=exact, prepare=run.f3r_model)
    assert passed["verdict"] in run.PASS_VERDICTS and abs(passed["delta_pct"]) < 0.01


def test_the_v0_4_run_keeps_the_model_as_written_and_does_not_downgrade_it_to_0_3():
    import cslope

    seen = {}

    def spy(binary, model, check, timeout):
        seen["version"] = model["version"]
        return {"fos": None, "status": None, "error": "exit 1: spy", "engine": None, "warnings": []}
    run.run_f3_check(cslope, "ogs", F3R_AS_CASES[0], "bishop", "fixed", ["reinforcements_passive"], _f3r_probe(),
                     ogs_runner=spy, prepare=run.f3r_model)
    assert seen["version"] == "0.4"


def test_f3r_section_of_the_report_lists_the_capabilities_and_the_pending_checks():
    import cslope

    probe = _f3r_probe((False, False))
    rows = [run.run_f3_check(cslope, "ogs", c, m, k, caps, probe, ogs_runner=_f3r_fake_ogs(), prepare=run.f3r_model)
            for c, m, k, caps in run.f3r_plan(F3R_AS_CASES)]
    text = "\n".join(run.f3r_markdown(rows, probe))
    assert text.startswith("## v0.4: refuerzos (D24 a D27)")
    assert "| reinforcements_active | no |" in text and "| reinforcements_passive | no |" in text
    assert "**OK 0/12**" in text and "pendiente 12" in text and text.count("| pendiente |") == 12


def test_run_adds_the_v0_4_block_and_keeps_the_rest_of_the_report(tmp_path):
    cases = tmp_path / "cases"
    shutil.copytree(HERE / "cases", cases)
    out = tmp_path / "out"
    assert run.main(["--ogs", _ogs_binary(), "--cases", str(cases), "--out", str(out)]) == 0
    report = json.loads((out / "report.json").read_text(encoding="utf-8"))
    assert len(report["checks"]) == 56 and report["f3"]["summary"]["N"] == 71       # the older blocks are as before
    f3r = report["f3r"]
    assert f3r["summary"]["N"] == 12 and set(f3r["capabilities"]) == set(run.CAPABILITIES_F3R)
    assert [c["id"] for c in f3r["cases"]] == ["D24", "D25", "D26", "D27"]
    for row in f3r["checks"]:
        assert row["verdict"] in ("OK", run.VERDICT_BOTH_NO_SOLUTION, "FALLA", "sin dato", "pendiente"), row
        assert row["cslope"]["fos"] is not None                       # the oracle line is there, pending or not
    text = (out / "REPORT.md").read_text(encoding="utf-8")
    assert text.index("## Fase 3a") < text.index("## v0.4: refuerzos") < text.index("## Reproducir")


def test_require_f3r_turns_pending_into_a_failing_exit_code(tmp_path, monkeypatch):
    monkeypatch.setattr(run, "probe_f3r", lambda *a, **k: _f3r_probe((True, False)))
    cases = tmp_path / "cases"
    shutil.copytree(HERE / "cases", cases)
    out = tmp_path / "out"
    assert run.main(["--ogs", _ogs_binary(), "--cases", str(cases), "--out", str(out)]) == 0
    assert run.main(["--ogs", _ogs_binary(), "--cases", str(cases), "--out", str(out), "--require-f3r"]) == 4
