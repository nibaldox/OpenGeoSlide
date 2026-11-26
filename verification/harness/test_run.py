"""Tests for run.py: ogs status is read before fos (R2-09 1). Run with pytest (see README.md)."""

from __future__ import annotations

import json
import os
import stat
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import run  # noqa: E402

CHECK = {"method": "bishop", "kind": "fixed", "published": 1.0, "tolerance": 0.05}
MODEL: dict = {"analysis": {"surface": {"type": "circle", "xc": 1.0, "yc": 1.0, "r": 1.0}}}


def _fake_ogs(tmp_path, payload: dict) -> str:
    """An executable that prints `payload` as the ogs JSON report, whatever its arguments."""
    script = tmp_path / "ogs"
    script.write_text(f"#!{sys.executable}\nimport sys\nprint({json.dumps(json.dumps(payload))})\n",
                      encoding="utf-8")
    script.chmod(script.stat().st_mode | stat.S_IXUSR)
    return str(script)


def _report(fos, status, message=None) -> dict:
    """ogs JSON report with one result. `message` is a legacy field that MethodReport does not have (R3-05)."""
    result = {"method": "bishop", "fos": fos, "status": status, "iterations": 0, "lambda": None, "warnings": []}
    if message is not None:
        result["message"] = message
    return {"engine": "ogs-core test", "results": [result]}


def test_null_fos_with_invalid_status_is_a_method_outcome(tmp_path):
    res = run.run_ogs(_fake_ogs(tmp_path, _report(None, "invalid", "m_alpha")), MODEL, CHECK, 30)
    assert res["fos"] is None and res["status"] == "invalid" and res["error"] is None
    assert run.verdict(res["fos"], res["status"], 1.0, 0.05) == "no convergido"


def test_null_fos_with_not_converged_status_is_not_a_missing_value(tmp_path):
    res = run.run_ogs(_fake_ogs(tmp_path, _report(None, "not_converged")), MODEL, CHECK, 30)
    assert res["error"] is None
    assert run.verdict(res["fos"], res["status"], 1.0, 0.05) == "no convergido"


def test_null_fos_with_converged_status_is_an_error(tmp_path):
    res = run.run_ogs(_fake_ogs(tmp_path, _report(None, "converged")), MODEL, CHECK, 30)
    assert res["fos"] is None and res["error"].startswith("fos no numérico")
    assert run.verdict(res["fos"], res["status"], 1.0, 0.05) == "sin dato"


def test_finite_fos_is_read_with_its_status(tmp_path):
    res = run.run_ogs(_fake_ogs(tmp_path, _report(1.02, "converged")), MODEL, CHECK, 30)
    assert res["fos"] == pytest.approx(1.02) and res["status"] == "converged"
    assert run.verdict(res["fos"], res["status"], 1.0, 0.05) == "OK"


def test_run_reads_warnings_not_message(tmp_path):
    """R3-05 (2): MethodReport has no `message`; the reason of a method outcome is in `warnings`."""
    payload = _report(None, "invalid", message="legacy")
    payload["results"][0]["warnings"] = ["no_driving"]
    res = run.run_ogs(_fake_ogs(tmp_path, payload), MODEL, CHECK, 30)
    assert res["status"] == "invalid" and res["fos"] is None
    assert res["warnings"] == ["no_driving"]
    assert "message" not in res


def test_run_keeps_warnings_of_a_converged_result(tmp_path):
    payload = _report(1.02, "converged")
    payload["results"][0]["warnings"] = ["truncated_mass"]
    res = run.run_ogs(_fake_ogs(tmp_path, payload), MODEL, CHECK, 30)
    assert res["fos"] == pytest.approx(1.02) and res["warnings"] == ["truncated_mass"]


def test_verdict_without_status_keeps_the_old_rules():
    assert run.verdict(None, None, 1.0, 0.05) == "sin dato"
    assert run.verdict(1.2, None, 1.0, 0.05) == "FALLA"


class _FakeCslope:
    """cslope module stand-in: analyse returns a minFOS with criticalSurface.converged = False (X6)."""

    def validate(self, document):
        return []

    def analyse(self, document):
        return {"minFOS": 0.0830, "criticalSurface": {"converged": False}, "warnings": []}


def test_cslope_not_converged_is_never_a_reference_value():
    # R3-01b of X6: minFOS 0.0830 with converged = false (the real root is 0.2685). Even if the published value
    # were 0.0830, the oracle verdict is «no convergido», not OK.
    res = run.run_cslope(_FakeCslope(), {})
    assert res["status"] == "not_converged" and res["fos"] == pytest.approx(0.0830)
    assert run.verdict(res["fos"], res["status"], 0.0830, 0.05) == "no convergido"
    assert run.estado("OK", "no convergido") == "OK · cSlope no convergido"


# --- R10A-11: the check's `options.interslice` travels to ogs like it does to cSlope

def test_model_for_check_applies_options_interslice_to_morgenstern_price():
    model = {"analysis": {"interslice": {"function": "half_sine"}, "methods": ["spencer"]}}
    check = {"method": "morgenstern_price", "kind": "fixed", "options": {"interslice": {"function": "trapezoidal"}}}
    doc = run.model_for_check(model, check)
    assert doc["analysis"]["interslice"] == {"function": "trapezoidal"}
    assert model["analysis"]["interslice"] == {"function": "half_sine"}      # the case is not touched


def test_model_for_check_drops_interslice_for_the_other_methods_even_if_the_check_has_it():
    model = {"analysis": {"interslice": {"function": "half_sine"}}}
    check = {"method": "spencer", "kind": "fixed", "options": {"interslice": {"function": "trapezoidal"}}}
    assert "interslice" not in run.model_for_check(model, check)["analysis"]


# ---- v0.4: the oracle forces in the report, and the directories that hold a previous report.json

def test_load_cases_ignores_the_report_and_the_hold_file_of_a_case_directory(tmp_path):
    case = {"id": "T1", "model": MODEL, "checks": [CHECK]}
    (tmp_path / "T1.json").write_text(json.dumps(case), encoding="utf-8")
    (tmp_path / "report.json").write_text(json.dumps({"checks": []}), encoding="utf-8")
    (tmp_path / "HOLD.json").write_text(json.dumps({"held": []}), encoding="utf-8")
    assert [c["id"] for c in run.load_cases(str(tmp_path))] == ["T1"]


def test_the_report_row_of_a_reinforced_model_carries_the_forces_of_the_oracle():
    cs = pytest.importorskip("cslope")
    from test_to_cslope import ANCHOR, v047a_v04
    case = {"id": "T-REINF", "title": "t", "_path": "t.json", "checks": [dict(CHECK, published=1.33, tolerance=0.01)],
            "model": v047a_v04([ANCHOR])}
    plain = {**case, "id": "T-PLAIN", "model": v047a_v04([])}
    rows = run.build_rows([case, plain], run.ORACLE_ONLY, cs)
    forces = rows[0]["cslope"]["reinforcement_forces"]
    assert (forces["elements"], forces["applied"]) == (1, 1)
    assert forces["forces"][0]["fx"] == pytest.approx(100.0) and forces["forces"][0]["passive"] is False
    assert "reinforcement_forces" not in rows[1]["cslope"]          # a model without reinforcements: the old report


def test_run_ogs_reads_the_forces_and_the_surface_of_the_report(tmp_path):
    payload = _report(1.02, "converged")
    payload["results"][0]["reinforcement_forces"] = [{"id": "A1", "x": 1.0, "y": 2.0, "fx": 3.0, "fy": 0.0,
                                                      "status": "applied"}]
    payload["results"][0]["surface"] = {"xc": 1.0, "yc": 2.0, "r": 3.0}
    res = run.run_ogs(_fake_ogs(tmp_path, payload), MODEL, CHECK, 30)
    assert res["forces"][0]["id"] == "A1" and res["surface"]["r"] == 3.0


def test_the_forces_comparison_of_a_search_reruns_ogs_on_the_circle_of_the_oracle(tmp_path):
    model = {"reinforcements": [{"id": "A1", "type": "anchor", "x1": 0, "y1": 0, "x2": 1, "y2": 0,
                                 "tensile_capacity": 5.0}],
             "analysis": {"search": {"type": "circular_entry_exit"}}}
    payload = _report(1.02, "converged")
    payload["results"][0]["reinforcement_forces"] = [{"id": "A1", "x": 1.0, "y": 2.0, "fx": 3.0, "fy": 0.0,
                                                      "status": "applied"}]
    payload["results"][0]["surface"] = {"xc": 0.0, "yc": 0.0, "r": 2.2}
    check = dict(CHECK, kind="search")
    og = {"surface": {"xc": 9.0, "yc": 9.0, "r": 9.0}, "forces": [], "error": None, "status": "converged"}
    out = run._forces_comparison(_fake_ogs(tmp_path, payload), model, check, og,
                                 [{"index": 0, "x": 1.0, "y": 2.0, "fx": 3.0, "fy": 0.0}],
                                 {"xc": 0.0, "yc": 0.0, "r": 2.2})
    assert out["on_oracle_circle"] is True and out["unexplained"] == 0 and len(out["pairs"]) == 1
    # a search whose oracle circle is unknown has no comparison
    assert run._forces_comparison(_fake_ogs(tmp_path, payload), model, check, og, [], None) is None
