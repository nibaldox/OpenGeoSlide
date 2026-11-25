"""Tests for the cSlope importer gates (run with pytest; see verification/harness/README.md).

    uv run --python 3.13 --no-project --with shapely --with jsonschema --with pytest \\
      python -m pytest verification/tools/test_import_cslope.py
"""

from __future__ import annotations

import copy
import glob
import importlib.util
import json
import os

import jsonschema
import pytest
from shapely.geometry import Polygon

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
_spec = importlib.util.spec_from_file_location("import_cslope", os.path.join(HERE, "import_cslope.py"))
assert _spec is not None and _spec.loader is not None
imp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(imp)

CASES_DIR = os.path.join(ROOT, "verification", "cases")


# ------------------------------------------------------------ water over ground

# Bump: top at y = 10, a lower terrace (y = 4) between x = 10 and x = 15, and y = 10 again beyond.
# Water at y = 6 is above the terrace inside (10, 15) but below the ground at both ends and at x = 15.
BUMP = Polygon([(0, 0), (0, 10), (10, 10), (10, 4), (15, 4), (15, 10), (25, 10), (25, 0)])


def test_water_above_lower_terrace_is_detected_at_the_step():
    # Old check (vertices only): x = 10 and x = 15 report the upper level (10), so y = 6 looked safe.
    assert imp.water_above_ground(BUMP, [[0.0, 6.0], [25.0, 6.0]])


def test_water_below_both_terraces_is_accepted():
    assert not imp.water_above_ground(BUMP, [[0.0, 3.0], [25.0, 3.0]])


def test_water_touching_the_terrace_is_accepted():
    # Exactly on the lower terrace: within the tolerance, no warning.
    assert not imp.water_above_ground(BUMP, [[0.0, 4.0], [25.0, 4.0]])


# ------------------------------------------------------------ convert() gates

def _raw(piezo=None, options=None, surface_ok=True):
    raw = {
        "id": "T-IMP",
        "title": "synthetic",
        "surface": "fixed",
        "definition": {
            "coordinates": [[0, 0], [0, 10], [10, 10], [10, 4], [15, 4], [15, 10], [25, 10], [25, 0]],
            "materials": [{"name": "Soil", "model": {
                "kind": "mohr-coulomb", "unitWeight": 18.0, "cohesion": 5.0, "frictionAngle": 30.0}}],
            "regionAssignments": [{"point": [5.0, 5.0], "materialName": "Soil"}],
            "customSearchPlanes": [{"cx": 10.0, "cy": 30.0, "radius": 25.0}],
            "customPlanesOnly": True,
        },
        "checks": [{"method": "Bishop", "published": 1.0, "publishedBy": "T", "tolerance": 0.05,
                    "options": options or {}}],
    }
    if piezo is not None:
        raw["definition"]["waterTable"] = {"mode": "custom", "value": piezo, "followBoundary": False}
    return raw


PROB = {"reference": "synthetic reference", "units": "SI", "notes": []}


def test_convert_omits_piezometric_line_with_x_not_increasing():
    with pytest.raises(imp.Omit, match="estrictamente creciente"):
        imp.convert(_raw(piezo=[[0.0, 3.0], [0.0, 3.0]]), PROB)
    with pytest.raises(imp.Omit, match="estrictamente creciente"):
        imp.convert(_raw(piezo=[[10.0, 3.0], [0.0, 3.0]]), PROB)


def test_convert_omits_water_above_a_step_inside_the_model():
    with pytest.raises(imp.Omit, match="agua embalsada"):
        imp.convert(_raw(piezo=[[0.0, 6.0], [25.0, 6.0]]), PROB)


def test_convert_keeps_water_below_the_terrain():
    case, _ = imp.convert(_raw(piezo=[[0.0, 3.0], [25.0, 3.0]]), PROB)
    assert case["model"]["water"]["piezometric_line"] == [[0.0, 3.0], [25.0, 3.0]]


def test_solver_tolerance_of_the_check_is_recorded_in_notes():
    case, _ = imp.convert(_raw(options={"tolerance": 0.001}), PROB)
    assert any("options.tolerance = 0.001" in n for n in case["source"]["notes"])
    assert any("analysis.tolerance = 1e-05" in n for n in case["source"]["notes"])


def test_face_without_assignment_reports_the_point_on_its_edge():
    raw = _raw()
    raw["definition"]["regionAssignments"] = [{"point": [0.0, 10.0], "materialName": "Soil"}]
    with pytest.raises(imp.Omit, match="sobre el borde"):
        imp.convert(raw, PROB)


# ------------------------------------------------------------ schema vs contract §4.5

def _model_from_fixture() -> dict:
    with open(os.path.join(CASES_DIR, "V047a.json"), encoding="utf-8") as fh:
        return copy.deepcopy(json.load(fh)["model"])


def _schema_errors(model: dict) -> list[str]:
    return [e.message for e in jsonschema.Draft202012Validator(imp.MODEL_SCHEMA).iter_errors(model)]


@pytest.mark.parametrize("path, value", [
    (("materials", 0, "friction_angle"), 90),
    (("materials", 0, "ru"), 1.0),
    (("analysis", "slices"), 2),
    (("analysis", "slices"), 2001),
    (("analysis", "min_m_alpha"), 0),
    (("analysis", "tolerance"), 0.02),
    (("analysis", "max_iterations"), 100001),
    (("analysis", "search", "max_radius_factor"), 0.51),
    (("analysis", "search", "min_width"), -1.0),
    (("analysis", "search", "n_entry"), 201),
])
def test_schema_rejects_values_outside_section_4_5(path, value):
    model = _model_from_fixture()
    node = model
    for key in path[:-1]:
        node = node[key]
    node[path[-1]] = value
    assert _schema_errors(model), f"{path}={value} should be rejected"


def test_schema_accepts_the_limits_of_section_4_5():
    model = _model_from_fixture()
    model["materials"][0]["friction_angle"] = 89.9
    model["materials"][0]["ru"] = 0.0
    model["analysis"]["slices"] = 3
    model["analysis"]["tolerance"] = 0.01
    model["analysis"]["min_m_alpha"] = 1.0
    model["analysis"]["search"]["min_width"] = 0.0
    model["analysis"]["search"]["max_radius_factor"] = 0.52
    assert _schema_errors(model) == []


def test_search_gates_order_extent_and_grid_size():
    case = {"model": _model_from_fixture()}
    s = case["model"]["analysis"]["search"]
    s["entry"], s["exit"] = [49.9, 55.2], [26.9, 30.2]
    assert imp.gate_search(case) == []
    s["entry"] = [55.2, 49.9]
    assert any("lo > hi" in e for e in imp.gate_search(case))
    s["entry"] = [-500.0, 10.0]
    assert any("fuera de la extensión" in e for e in imp.gate_search(case))
    s["entry"] = [49.9, 55.2]
    s["n_entry"] = s["n_exit"] = s["n_radius"] = 200
    assert any("candidatos" in e for e in imp.gate_search(case))


def test_generated_cases_pass_the_schema_and_search_gates():
    paths = sorted(glob.glob(os.path.join(CASES_DIR, "V*.json")))
    assert paths, "no verification cases found"
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            case = json.load(fh)
        errors = [e.message for e in jsonschema.Draft202012Validator(imp.CASE_SCHEMA).iter_errors(case)]
        assert errors == [], (path, errors)
        assert imp.gate_search(case) == [], path


# ------------------------------------------------------------ checks[].options.slices (R3-08)

@pytest.mark.parametrize("value, accepted", [(2, False), (3, True), (2000, True), (2001, False)])
def test_case_schema_check_slices_follow_section_4_5(value, accepted):
    """R3-08: the case schema allowed `checks[].options.slices` from 2, without a maximum. §4.5 says [3, 2000]."""
    case = json.load(open(os.path.join(CASES_DIR, "V047a.json"), encoding="utf-8"))
    case["checks"][0]["options"] = {"slices": value}
    errors = [e.message for e in jsonschema.Draft202012Validator(imp.CASE_SCHEMA).iter_errors(case)]
    assert (errors == []) is accepted, (value, errors)
