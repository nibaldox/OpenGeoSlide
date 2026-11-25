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
    # Same list as INFORMATIVE_WARNINGS in crates/ogs-core/tests/acceptance.rs (E5, E10a, E11a′, E12b).
    assert set(run.OGS_INFORMATIVE_WARNINGS) == {
        "negative_effective_normal", "truncated_mass", "negative_lambda", "load_outside_mass"}


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
