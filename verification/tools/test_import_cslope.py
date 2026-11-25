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


# ------------------------------------------------------------ schema v0.2: seismic coefficients and loads

PENDING_DIR = os.path.join(ROOT, "verification", "pending")


def _raw_v02(udls=None, line_loads=None, seismic=None, extra_options=None):
    """The synthetic problem of `_raw` with loads and/or seismic coefficients in the cSlope format."""
    options = dict(extra_options or {})
    if seismic is not None:
        options.update(seismic)
    raw = _raw(options=options)
    if udls is not None:
        raw["definition"]["udls"] = udls
    if line_loads is not None:
        raw["definition"]["lineLoads"] = line_loads
    return raw


def test_v0_1_conversion_still_omits_loads_and_seismic():
    with pytest.raises(imp.Omit, match="udls"):
        imp.convert(_raw_v02(udls=[{"magnitude": 20.0, "x1": 1.0, "x2": 5.0}]), PROB)
    with pytest.raises(imp.Omit, match="lineLoads"):
        imp.convert(_raw_v02(line_loads=[{"x": 3.0, "magnitude": 10.0, "angle": 5.0}]), PROB)
    with pytest.raises(imp.Omit, match="seismicHorizontal"):
        imp.convert(_raw_v02(seismic={"seismicHorizontal": 0.1}), PROB)


def test_v0_2_conversion_writes_loads_and_seismic_in_contract_order():
    raw = _raw_v02(
        udls=[{"magnitude": 20.0, "x1": 1.0, "x2": 5.0}, {"magnitude": 7.5, "x1": 6.0, "x2": 9.0, "direction": "vertical"}],
        line_loads=[{"x": 3.0, "magnitude": 10.0, "angle": -12.5}],
        seismic={"seismicHorizontal": 0.15, "seismicVertical": -0.05},
    )
    raw["definition"]["waterTable"] = {"mode": "custom", "value": [[0.0, 3.0], [25.0, 3.0]]}
    case, _ = imp.convert(raw, PROB, v02=True)
    model = case["model"]
    assert model["version"] == "0.2"
    assert model["loads"] == [
        {"type": "udl", "id": "u1", "x1": 1.0, "x2": 5.0, "q": 20.0},
        {"type": "udl", "id": "u2", "x1": 6.0, "x2": 9.0, "q": 7.5},
        {"type": "line", "id": "l1", "x": 3.0, "p": 10.0, "angle": -12.5},   # the angle is copied unchanged
    ]
    assert model["analysis"]["seismic"] == {"kh": 0.15, "kv": -0.05}
    keys = list(model)
    assert keys.index("water") < keys.index("loads") < keys.index("slope")      # F1.1: after water, before slope
    assert [e for e in imp.gate_schema(case)] == [] and imp.gate_loads(case) == []


def test_v0_2_conversion_without_features_is_not_a_v0_2_case():
    with pytest.raises(imp.Omit, match="sin cargas ni coeficientes"):
        imp.convert(_raw(), PROB, v02=True)
    assert imp.has_v02_features(_raw()) is False
    assert imp.has_v02_features(_raw_v02(seismic={"seismicVertical": 0.1})) is True
    assert imp.has_v02_features(_raw_v02(seismic={"seismicHorizontal": 0.0})) is False


def test_v0_2_conversion_keeps_omitting_what_v0_2_does_not_cover():
    udl = {"magnitude": 20.0, "x1": 1.0, "x2": 5.0}
    cases = [
        (_raw_v02(udls=[dict(udl, excessPorePressure=0.5)]), "excessPorePressure"),
        (_raw_v02(udls=[dict(udl, direction="normal")]), "normal"),
        (_raw_v02(line_loads=[{"x": 3.0, "magnitude": 10.0, "angle": 0.0, "y": 8.0}]), "propiedad no soportada: y"),
        (_raw_v02(udls=[{"magnitude": 20.0, "x1": 5.0, "x2": 1.0}]), "x1 >= x2"),
        (_raw_v02(udls=[{"magnitude": 20.0, "x1": 1.0, "x2": 90.0}]), "fuera del rango"),
        (_raw_v02(line_loads=[{"x": -3.0, "magnitude": 10.0, "angle": 0.0}]), "fuera del rango"),
        (_raw_v02(udls=[udl], extra_options={"partialFactors": {"cohesion": 1.25}}), "partialFactors"),
        (_raw_v02(seismic={"seismicHorizontal": 1.0}), "kh"),
    ]
    for raw, match in cases:
        with pytest.raises(imp.Omit, match=match):
            imp.convert(raw, PROB, v02=True)
    raw = _raw_v02(udls=[udl])
    raw["definition"]["reinforcements"] = [{"x1": 0.0, "y1": 1.0, "x2": 5.0, "y2": 1.0}]
    with pytest.raises(imp.Omit, match="reinforcements"):
        imp.convert(raw, PROB, v02=True)
    raw = _raw_v02(udls=[udl])
    raw["definition"]["customSurfaces"] = [{}]
    with pytest.raises(imp.Omit, match="customSurfaces"):
        imp.convert(raw, PROB, v02=True)


def test_v0_2_conversion_needs_one_seismic_pair_for_all_the_checks():
    raw = _raw_v02(seismic={"seismicHorizontal": 0.1})
    raw["checks"].append({"method": "Bishop", "published": 1.1, "publishedBy": "T2", "tolerance": 0.05,
                          "options": {"seismicHorizontal": 0.2}})
    with pytest.raises(imp.Omit, match="coeficientes sísmicos distintos"):
        imp.convert(raw, PROB, v02=True)
    # a check that is discarded for another reason does not count
    raw["checks"][1]["options"]["nonCircularOptimization"] = True
    case, discarded = imp.convert(raw, PROB, v02=True)
    assert case["model"]["analysis"]["seismic"] == {"kh": 0.1, "kv": 0.0} and len(discarded) == 1


def _v02_model() -> dict:
    model = _model_from_fixture()
    model["version"] = "0.2"
    model["loads"] = [{"type": "udl", "id": "u1", "x1": 50.0, "x2": 70.0, "q": 20.0},
                      {"type": "line", "id": "l1", "x": 40.0, "p": 20.0, "angle": 10.0}]
    model["analysis"]["seismic"] = {"kh": 0.1, "kv": 0.0}
    return model


def test_schema_accepts_a_v0_2_model_and_only_v0_2_has_loads_and_seismic():
    model = _v02_model()
    assert _schema_errors(model) == []
    # the same fields with version 0.1 are rejected, as the engine does
    for mutate in (lambda m: m.pop("loads"), lambda m: m["analysis"].pop("seismic")):
        v01 = _v02_model()
        mutate(v01)
        v01["version"] = "0.1"
        assert _schema_errors(v01), "version 0.1 must not carry loads or seismic"
    model.pop("loads"), model["analysis"].pop("seismic")
    model["version"] = "0.1"
    assert _schema_errors(model) == []
    model["version"] = "0.3"
    assert _schema_errors(model)


@pytest.mark.parametrize("mutate", [
    lambda m: m["loads"][0].update(q=-1.0),
    lambda m: m["loads"][0].update(direction="vertical"),
    lambda m: m["loads"][0].pop("x2"),
    lambda m: m["loads"][1].update(angle=91.0),
    lambda m: m["loads"][1].update(p=-0.1),
    lambda m: m["loads"][1].update(y=3.0),
    lambda m: m["loads"].append({"type": "patch"}),
    lambda m: m["analysis"]["seismic"].update(kh=1.0),
    lambda m: m["analysis"]["seismic"].update(kh=-0.01),
    lambda m: m["analysis"]["seismic"].update(kv=1.0),
    lambda m: m["analysis"]["seismic"].update(kv=-1.0),
    lambda m: m["analysis"]["seismic"].update(kz=0.1),
])
def test_schema_rejects_malformed_loads_and_seismic(mutate):
    model = _v02_model()
    mutate(model)
    assert _schema_errors(model)


def test_schema_accepts_the_limits_of_loads_and_seismic():
    model = _v02_model()
    model["loads"][0]["q"] = 0.0
    model["loads"][1].update(p=0.0, angle=-90.0)
    model["analysis"]["seismic"] = {"kh": 0.0, "kv": -0.999}
    assert _schema_errors(model) == []
    model["loads"][1]["angle"] = 90.0
    model["analysis"]["seismic"] = {"kv": 0.999}
    assert _schema_errors(model) == []


def test_gate_loads_checks_version_range_order_and_ids():
    case = {"model": _v02_model()}
    assert imp.gate_loads(case) == []
    case["model"]["loads"][0]["x2"] = 500.0
    assert any("fuera del rango" in e for e in imp.gate_loads(case))
    case = {"model": _v02_model()}
    case["model"]["loads"][0].update(x1=70.0, x2=50.0)
    assert any("x1 >= x2" in e for e in imp.gate_loads(case))
    case = {"model": _v02_model()}
    case["model"]["loads"][1]["id"] = "u1"
    assert any("repetidos" in e for e in imp.gate_loads(case))
    case = {"model": _v02_model()}
    case["model"]["version"] = "0.1"
    assert any("requieren" in e for e in imp.gate_loads(case))


V02_IDS = ("V102a", "V102b", "V097a", "V081a", "V081b")


def _v02_cases() -> dict[str, dict]:
    """The v0.2 cases of verification/cases (promoted from pending/ once the engine accepted version 0.2)."""
    out = {}
    for path in sorted(glob.glob(os.path.join(CASES_DIR, "V*.json"))):
        with open(path, encoding="utf-8") as fh:
            case = json.load(fh)
        if case["model"]["version"] == "0.2":
            out[case["id"]] = case
    return out


def test_v0_2_cases_pass_every_gate_of_the_importer():
    cases = _v02_cases()
    assert set(cases) == set(V02_IDS), sorted(cases)
    for cid, case in cases.items():
        assert imp.gate_schema(case) == [], cid
        assert imp.gate_search(case) == [], cid
        assert imp.gate_loads(case) == [], cid
        assert case["model"].get("loads") or case["model"]["analysis"].get("seismic"), cid
        # they were promoted: nothing is left in pending/
        assert not os.path.exists(os.path.join(PENDING_DIR, f"{cid}.json")), cid


def test_v0_2_seismic_cases_carry_the_published_critical_coefficients():
    cases = _v02_cases()
    assert cases["V102a"]["model"]["analysis"]["seismic"] == {"kh": 0.432, "kv": 0.0}
    assert cases["V102b"]["model"]["analysis"]["seismic"] == {"kh": 0.132, "kv": 0.0}
    assert cases["V102b"]["model"]["materials"][0]["ru"] == 0.5
    assert cases["V097a"]["model"]["loads"] == [{"type": "udl", "id": "u1", "x1": 52.0, "x2": 62.0, "q": 35.0}]
    assert cases["V081a"]["model"]["loads"] == [{"type": "udl", "id": "u1", "x1": 17.0, "x2": 30.0, "q": 40.0}]
    # the non-circular check of V102a/b is discarded, the circular ones are kept
    for cid in ("V102a", "V102b"):
        assert {c["method"] for c in cases[cid]["checks"]} == {"bishop", "spencer"}
        assert all(c["kind"] == "search" for c in cases[cid]["checks"])


def test_pending_index_lists_only_the_excluded_problems_with_their_reason():
    with open(os.path.join(PENDING_DIR, "INDEX.md"), encoding="utf-8") as fh:
        index = fh.read()
    for cid in ("V017a", "V066e", "V097b", "V104c"):
        assert f"| {cid} | excluido |" in index, cid
    assert "| V097b | excluido |" in index and "partialFactors" in index
    assert "| V066e | excluido |" in index and "reinforcements" in index
    for cid in V02_IDS:
        assert f"| {cid} |" not in index, cid


def test_cases_index_lists_the_v0_2_cases_with_their_seismic_and_loads():
    with open(os.path.join(CASES_DIR, "INDEX.md"), encoding="utf-8") as fh:
        index = fh.read()
    assert "| V102a |" in index and "kh = 0.432" in index
    for cid in V02_IDS:
        assert f"| {cid} |" in index, cid


def test_v0_1_cases_are_untouched_by_the_v0_2_schema():
    n = 0
    for path in sorted(glob.glob(os.path.join(CASES_DIR, "V*.json"))):
        with open(path, encoding="utf-8") as fh:
            case = json.load(fh)
        if case["id"] in V02_IDS:
            continue
        n += 1
        assert case["model"]["version"] == "0.1", path
        assert "loads" not in case["model"] and "seismic" not in case["model"]["analysis"], path
    assert n == 16
