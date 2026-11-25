"""Entrada no finita: NaN e infinitos no son JSON válido y se rechazan en la frontera Python.

El error lleva el código E6 ``InvalidModel`` y la ruta del valor, en vez del ``Json`` genérico de
``json.dumps`` con ``allow_nan=True``.
"""

import copy
import json
from pathlib import Path

import pytest

import opengeoslide

REPO_ROOT = Path(__file__).resolve().parents[3]
ACADS1A = REPO_ROOT / "examples" / "acads1a.ogs.json"


def load_acads1a() -> dict:
    return json.loads(ACADS1A.read_text(encoding="utf-8"))


@pytest.mark.parametrize("bad", [float("nan"), float("inf"), float("-inf")])
def test_non_finite_float_is_invalid_model_with_location(bad):
    model = copy.deepcopy(load_acads1a())
    model["materials"][0]["cohesion"] = bad
    with pytest.raises(ValueError, match=r"^InvalidModel: .*modelo\.materials\[0\]\.cohesion"):
        opengeoslide.analyze(model)


def test_non_finite_in_nested_analysis_setting_reports_its_path():
    model = copy.deepcopy(load_acads1a())
    model["analysis"]["tolerance"] = float("nan")
    with pytest.raises(ValueError, match=r"^InvalidModel: .*modelo\.analysis\.tolerance"):
        opengeoslide.analyze(model)


def test_circular_reference_is_json_error_not_invalid_model():
    model = copy.deepcopy(load_acads1a())
    model["meta"]["self"] = model["meta"]  # ciclo: no es un valor no finito
    with pytest.raises(ValueError, match=r"^Json: "):
        opengeoslide.analyze(model)


def test_finite_model_still_analyzes():
    report = opengeoslide.analyze(load_acads1a())
    assert report["results"]
