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
