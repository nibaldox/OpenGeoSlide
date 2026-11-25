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
    result = {"method": "bishop", "fos": fos, "status": status, "iterations": 0, "lambda": None}
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


def test_verdict_without_status_keeps_the_old_rules():
    assert run.verdict(None, None, 1.0, 0.05) == "sin dato"
    assert run.verdict(1.2, None, 1.0, 0.05) == "FALLA"
