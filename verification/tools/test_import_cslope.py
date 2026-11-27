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
import re

import jsonschema
import pytest
from shapely.geometry import Polygon
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
_spec = importlib.util.spec_from_file_location("import_cslope", os.path.join(HERE, "import_cslope.py"))
assert _spec is not None and _spec.loader is not None
imp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(imp)

CASES_DIR = os.path.join(ROOT, "verification", "cases")


# ------------------------------------------------------------ water over ground


def test_f3b_materials_preserve_inputs_and_reject_unsupported():
    hb = {"name": "Rock", "model": {"kind": "hoek-brown", "unitWeight": 25,
          "ucs": 30000, "gsi": 5, "mi": 2}}
    converted = imp.convert_f3b_material(hb, "rock")
    assert converted["disturbance"] == 0 and converted["ucs"] == 30000
    for key, value in (("ocr", 1.5), ("pop", 20), ("ocrByElevation", [[0, 1], [10, 2]])):
        source = {"name": "Clay", "model": {"kind": "shansep", "unitWeight": 18, "ratio": 0.25, key: value}}
        out = imp.convert_f3b_material(source, "clay")
        assert out["shansep"]["ocr_by_elevation" if key == "ocrByElevation" else key] == value
    source["model"].pop(key)
    with pytest.raises(imp.Omit, match="fuente OCR"):
        imp.convert_f3b_material(source, "clay")
    source["model"]["aboveWater"] = {}
    with pytest.raises(imp.Omit, match="aboveWater"):
        imp.convert_f3b_material(source, "clay")


def test_f3b_non_circular_option_does_not_change_legacy():
    options = {"nonCircularOptimization": True}
    assert imp.option_reason("Morgenstern-Price", options, f3=True) is not None
    assert imp.option_reason("Morgenstern-Price", options, f3=True, f3b=True) is None

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
        if case["model"]["version"] == "0.4":      # the promoted batches R1 to R4 (reinforcements)
            errors = imp.gate_schema_f3r(case, F3R_SCHEMA)
        elif case["model"]["version"] == "0.5":      # the promoted batches F3G (tension crack) and F3I (Ito-Matsui piles)
            schema_05 = json.load(open(os.path.join(ROOT, "schema", "ogs-0.5.schema.json"), encoding="utf-8"))
            # V013b-e (F3I) were promoted into cases/ (cc66c2e): v0.5 because of `lateral_pressure`, with no tension_crack,
            # so they go through gate_f3i (the F3G gate demands a crack in every v0.5 case).
            f3i = any("lateral_pressure" in r for r in case["model"].get("reinforcements") or [])
            errors = (imp.gate_f3i if f3i else imp.gate_f3g)(case, schema_05)
        else:
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
    # V047a is a v0.3 case (it also carries M-P and Janbu checks). A v0.2 model has only Bishop and Spencer (F3.1):
    # the schema validates against the version the model declares, so the fixture is reduced to what 0.2 admits.
    model["analysis"]["methods"] = ["bishop", "spencer"]
    model["analysis"].pop("interslice", None)
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
    assert _schema_errors(model) == []        # F3.1: the importer's schema accepts 0.3 too
    model["version"] = "0.4"
    assert _schema_errors(model)


def test_schema_requires_version_0_3_for_every_v0_3_field():
    """F3.9: M-P, Janbu, `interslice`, `undrained` and polylines need version 0.3; 0.1 and 0.2 reject them."""
    for version, ok in (("0.1", False), ("0.2", False), ("0.3", True)):
        for method in ("morgenstern_price", "janbu_simplified", "janbu_corrected"):
            model = _v02_model()
            model["version"] = version
            if version == "0.1":
                model.pop("loads"), model["analysis"].pop("seismic")
            model["analysis"]["methods"] = ["spencer", method]
            assert (_schema_errors(model) == []) is ok, (version, method)
        model = _v02_model()
        model["version"] = version
        if version == "0.1":
            model.pop("loads"), model["analysis"].pop("seismic")
        model["analysis"]["methods"] = ["morgenstern_price"]
        model["analysis"]["interslice"] = {"function": "half_sine"}
        assert (_schema_errors(model) == []) is ok, (version, "interslice")


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


def _uses_v03(model: dict) -> bool:
    """F3.1 / F3.9: does the model use a field that exists only from v0.3?"""
    analysis = model.get("analysis") or {}
    return bool(
        any(m.get("model") == "undrained" for m in model["materials"])
        or (analysis.get("surface") or {}).get("type") == "polyline"
        or any(x in ("morgenstern_price", "janbu_simplified", "janbu_corrected") for x in analysis["methods"])
        or "interslice" in analysis
    )


def test_v0_1_cases_are_untouched_by_the_v0_2_schema():
    # Not every case of verification/cases is v0.1 or v0.2 any more: the cases with M-P, Janbu, undrained strength or a
    # polyline are v0.3 (F3.1). So each case is checked against the version it declares, and the declared version must
    # be the minimal one (F3.9): 0.1 without loads, seismic or v0.3 fields; 0.2 with loads or seismic only; 0.3 otherwise.
    counts = {"0.1": 0, "0.2": 0, "0.3": 0, "0.4": 0, "0.5": 0}
    for path in sorted(glob.glob(os.path.join(CASES_DIR, "V*.json"))):
        with open(path, encoding="utf-8") as fh:
            case = json.load(fh)
        model = case["model"]
        version = model["version"]
        counts[version] += 1
        if version == "0.4":      # promoted batches R1 to R4: their own schema and gates (test_the_promoted_...)
            assert model["reinforcements"], path
            continue
        if version == "0.5":      # promoted batches F3G (the crack) and F3I (Ito-Matsui: V013b-e since cc66c2e, v0.5 by `lateral_pressure`)
            assert model["analysis"].get("tension_crack") or any("lateral_pressure" in r for r in model.get("reinforcements") or []), path
            continue
        has_v02 = "loads" in model or "seismic" in model["analysis"]
        expected = "0.3" if _uses_v03(model) else ("0.2" if has_v02 else "0.1")
        if case["id"] in V02_IDS:
            expected = "0.2"
        assert version == expected, path
        assert [e.message for e in jsonschema.Draft202012Validator(imp.MODEL_SCHEMA).iter_errors(model)] == [], path
        if version == "0.1":
            assert not has_v02, path
    # the number comes from the index, never from a literal (contract F3.8)
    with open(os.path.join(CASES_DIR, "INDEX.md"), encoding="utf-8") as fh:
        index = fh.read()
    m = re.search(r"v0\.1: \*\*(\d+)\*\*.*?v0\.2[^*]*\*\*(\d+)\*\*.*?v0\.3: \*\*(\d+)\*\*.*?v0\.4[^*]*\*\*(\d+)\*\*.*?v0\.5[^*]*\*\*(\d+)\*\*", index, re.S)
    assert m and (counts["0.1"], counts["0.2"], counts["0.3"], counts["0.4"], counts["0.5"]) == tuple(int(g) for g in m.groups())


# ------------------------------------------------------------ batch 0 (F3.8): no cap, no selection

def test_batch_0_has_no_cap_and_no_selection():
    for name in ("MAX_CASES", "MIN_CASES", "PRIORITY", "MIN_SPENCER", "MIN_FIXED"):
        assert not hasattr(imp, name), name


def test_hold_moves_only_the_listed_checks_out_of_a_case():
    case, _ = imp.convert(_raw(options={}), PROB)
    case["checks"].append({**case["checks"][0], "published": 1.2, "published_by": "Otro"})
    hold = {imp.check_key("T-IMP", case["checks"][1]): {"diagnosis": "x"}}
    rest, held = imp.split_hold(case, hold)
    assert [c["published"] for c in rest["checks"]] == [1.0]
    assert [c["published"] for c in held["checks"]] == [1.2]
    everything = {imp.check_key("T-IMP", c): {} for c in case["checks"]}
    rest, held = imp.split_hold(case, everything)
    assert rest is None and len(held["checks"]) == 2
    assert imp.split_hold(case, {})[1] is None


def test_reversed_analysis_limits_are_written_as_min_max_with_a_note():
    raw = _raw()
    raw["surface"] = "search"
    d = raw["definition"]
    d.pop("customSearchPlanes"); d.pop("customPlanesOnly")
    d["analysisLimits"] = {"entryLeftX": 25, "entryRightX": 15, "exitLeftX": 5, "exitRightX": 0}
    case, _ = imp.convert(raw, PROB)
    search = case["model"]["analysis"]["search"]
    assert search["entry"] == [15, 25] and search["exit"] == [0, 5]
    assert any("left > right" in n for n in case["source"]["notes"])
    assert imp.gate_search(case) == []


# ------------------------------------------------------------ batches 1 and 2 (F3.8): v0.3 models

def _raw_f3(material=None, surface=None, checks=None):
    raw = _raw()
    d = raw["definition"]
    if material is not None:
        d["materials"] = [{"name": "Soil", "model": material}]
    if surface is not None:
        d.pop("customSearchPlanes")
        d["customSurfaces"] = [{"points": surface}]
    if checks is not None:
        raw["checks"] = [{"method": m, "published": 1.0 + i / 100, "publishedBy": f"T{i}", "tolerance": 0.05,
                          "options": o} for i, (m, o) in enumerate(checks)]
    return raw


POLY = [[5.0, 2.0], [12.0, 1.0], [20.0, 3.0]]


def test_f3_undrained_maps_to_the_v0_3_material_with_datum_gradient_and_limit():
    raw = _raw_f3({"kind": "undrained", "unitWeight": 18.0, "undrainedShearStrength": 25.0,
                   "suRefDepth": 30.0, "suRateOfChange": 1.5, "suMax": 60.0})
    case, _, batches = imp.convert_f3(raw, PROB)
    mat = case["model"]["materials"][0]
    assert mat == {"id": "soil", "name": "Soil", "model": "undrained", "unit_weight": 18.0, "unit_weight_sat": None,
                   "undrained_strength": 25.0, "strength_datum": 30.0, "strength_gradient": 1.5,
                   "strength_limit": 60.0, "ru": None}
    assert case["model"]["version"] == "0.3" and batches == [1]
    assert imp.gate_schema(case) == [] and imp.gate_features(case) == []


def test_f3_undrained_without_gradient_is_a_constant_su():
    raw = _raw_f3({"kind": "undrained", "unitWeight": 18.0, "undrainedShearStrength": 25.0})
    case, _, _ = imp.convert_f3(raw, PROB)
    mat = case["model"]["materials"][0]
    assert mat["undrained_strength"] == 25.0
    assert not {"strength_datum", "strength_gradient", "strength_limit", "cohesion", "friction_angle"} & set(mat)


def test_f3_s_f_datum_is_the_same_law_with_other_names():
    raw = _raw_f3({"kind": "s-f-datum", "unitWeight": 17.0, "suRef": 10.0, "yRef": 35.0, "rate": 1.0})
    case, _, _ = imp.convert_f3(raw, PROB)
    mat = case["model"]["materials"][0]
    assert (mat["undrained_strength"], mat["strength_datum"], mat["strength_gradient"]) == (10.0, 35.0, 1.0)
    assert "strength_limit" not in mat


@pytest.mark.parametrize("model, match", [
    ({"kind": "undrained", "unitWeight": 18.0, "undrainedShearStrength": 25.0, "suRateOfChange": 1.0}, "juntos"),
    ({"kind": "undrained", "unitWeight": 18.0, "undrainedShearStrength": 25.0, "suMax": 50.0}, "sin gradiente"),
    ({"kind": "undrained", "unitWeight": 18.0, "undrainedShearStrength": 25.0, "anisotropy": {}}, "no soportada"),
    ({"kind": "undrained", "unitWeight": 18.0, "undrainedShearStrength": -1.0}, "negativa"),
    ({"kind": "shansep", "unitWeight": 18.0, "ratio": 0.25}, "shansep"),
])
def test_f3_refuses_undrained_that_f3_2_cannot_express(model, match):
    with pytest.raises(imp.Omit, match=match):
        imp.convert_f3(_raw_f3(model), PROB)


def test_batch_0_conversion_still_omits_undrained_and_polylines_and_discards_new_methods():
    with pytest.raises(imp.Omit, match="undrained"):
        imp.convert(_raw_f3({"kind": "undrained", "unitWeight": 18.0, "undrainedShearStrength": 25.0}), PROB)
    with pytest.raises(imp.Omit, match="customSurfaces"):
        imp.convert(_raw_f3(surface=POLY), PROB)
    case, disc = imp.convert(_raw_f3(checks=[("Bishop", {}), ("Janbu", {}), ("Morgenstern-Price", {})]), PROB)
    assert [c["method"] for c in case["checks"]] == ["bishop"] and len(disc) == 2


def test_f3_polyline_maps_customsurfaces_and_drops_bishop():
    raw = _raw_f3(surface=POLY, checks=[("Bishop", {}), ("Morgenstern-Price", {"intersliceFunction": "constant"}),
                                        ("Janbu", {})])
    case, disc, batches = imp.convert_f3(raw, PROB)
    assert case["model"]["analysis"]["surface"] == {"type": "polyline", "points": POLY}
    assert [c["method"] for c in case["checks"]] == ["spencer", "janbu_simplified"]
    assert batches == [2, 2]
    assert len(disc) == 1 and "F3.6" in disc[0]
    assert "bishop" not in case["model"]["analysis"]["methods"]
    assert imp.gate_schema(case) == [] and imp.gate_features(case) == []


def test_f3_polyline_with_only_bishop_checks_is_omitted():
    with pytest.raises(imp.Omit, match="sin checks"):
        imp.convert_f3(_raw_f3(surface=POLY, checks=[("Bishop", {})]), PROB)


@pytest.mark.parametrize("surface, match", [
    ([[5.0, 2.0], [5.0, 1.0]], "estrictamente creciente"),
    ([[5.0, 2.0]], "menos de 2"),
])
def test_f3_polyline_needs_two_points_with_x_increasing(surface, match):
    with pytest.raises(imp.Omit, match=match):
        imp.convert_f3(_raw_f3(surface=surface), PROB)


def test_f3_polyline_with_an_axis_or_with_a_search_is_omitted():
    raw = _raw_f3(surface=POLY)
    raw["definition"]["customSurfaces"][0]["axis"] = [1.0, 2.0]
    with pytest.raises(imp.Omit, match="sin eje"):
        imp.convert_f3(raw, PROB)
    raw = _raw_f3(surface=POLY)
    raw["surface"] = "search"
    with pytest.raises(imp.Omit, match="círculos propios"):
        imp.convert_f3(raw, PROB)


def test_f3_method_mapping_for_morgenstern_price_and_janbu():
    def m(method, **opts):
        return imp.f3_method({"method": method, "options": opts})[:2]
    assert m("Bishop") == ("bishop", None)
    assert m("Morgenstern-Price", intersliceFunction="constant") == ("spencer", None)
    assert m("Morgenstern-Price") == ("morgenstern_price", None)          # cSlope's default is half-sine
    assert m("Morgenstern-Price", intersliceFunction="half-sine") == ("morgenstern_price", None)
    assert m("Morgenstern-Price", intersliceFunction="clipped-sine") == (
        "morgenstern_price", {"function": "clipped_sine"})
    assert m("Morgenstern-Price", intersliceFunction="trapezoidal") == (
        "morgenstern_price", {"function": "trapezoidal"})
    dp = [[0, 1], [0.3, 1], [0.6, 0], [1, 0]]
    assert m("Morgenstern-Price", intersliceFunction="data-point-specified", intersliceDataPoints=dp) == (
        "morgenstern_price", {"function": "data_points", "points": dp})
    assert m("Janbu") == ("janbu_simplified", None)
    assert m("Janbu", janbuCorrection=False) == ("janbu_simplified", None)
    assert m("Janbu", janbuCorrection=True) == ("janbu_corrected", None)


@pytest.mark.parametrize("points, match", [
    ([[0, 1]], "menos de 2"),
    ([[0.1, 1], [1, 1]], "empieza en 0"),
    ([[0, 1], [0.5, 1], [0.5, 1], [1, 1]], "estrictamente creciente"),
    ([[0, 1], [1, -1]], "negativa"),
    ([[0, 0], [1, 0]], "nula"),
])
def test_f3_data_points_follow_f3_4(points, match):
    method, interslice, why = imp.f3_method({"method": "Morgenstern-Price", "options": {
        "intersliceFunction": "data-point-specified", "intersliceDataPoints": points}})
    assert method is None and match in why


def test_f3_checks_get_the_batch_of_their_highest_requirement():
    undrained = {"kind": "undrained", "unitWeight": 18.0, "undrainedShearStrength": 25.0}
    checks = [("Bishop", {}), ("Morgenstern-Price", {"intersliceFunction": "constant"}),
              ("Morgenstern-Price", {}), ("Janbu", {"janbuCorrection": True})]
    _, _, batches = imp.convert_f3(_raw_f3(checks=checks), PROB)
    assert batches == [0, 0, 2, 2]
    _, _, batches = imp.convert_f3(_raw_f3(undrained, checks=checks), PROB)
    assert batches == [1, 1, 2, 2]
    _, _, batches = imp.convert_f3(_raw_f3(undrained, surface=POLY, checks=checks[1:]), PROB)
    assert batches == [2, 2, 2]


def test_f3_one_interslice_function_per_model():
    dp = [[0, 1], [0.5, 1], [1, 0]]
    checks = [("Morgenstern-Price", {"intersliceFunction": "clipped-sine"}),
              ("Morgenstern-Price", {"intersliceFunction": "data-point-specified", "intersliceDataPoints": dp}),
              ("Morgenstern-Price", {"intersliceFunction": "clipped-sine"})]
    case, disc, _ = imp.convert_f3(_raw_f3(checks=checks), PROB)
    assert case["model"]["analysis"]["interslice"] == {"function": "clipped_sine"}
    assert [c["published"] for c in case["checks"]] == [1.0, 1.02]
    assert len(disc) == 1 and "otra función interslice" in disc[0]
    # half_sine (the default) writes no `interslice`
    case, _, _ = imp.convert_f3(_raw_f3(checks=[("Morgenstern-Price", {})]), PROB)
    assert "interslice" not in case["model"]["analysis"]


def test_f3_keeps_seismic_and_loads_and_writes_version_0_3():
    raw = _raw_f3(checks=[("Janbu", {"seismicHorizontal": 0.1})])
    case, _, _ = imp.convert_f3(raw, PROB)
    assert case["model"]["version"] == "0.3" and case["model"]["analysis"]["seismic"] == {"kh": 0.1, "kv": 0.0}
    assert imp.gate_loads(case) == []


def test_schema_v0_3_features_need_version_0_3():
    raw = _raw_f3(checks=[("Janbu", {})])
    case, _, _ = imp.convert_f3(raw, PROB)
    assert imp.gate_schema(case) == []
    for version in ("0.1", "0.2"):
        old = copy.deepcopy(case)
        old["model"]["version"] = version
        assert imp.gate_schema(old), version                   # methods janbu_* are not in the enum
        assert any("0.3" in e for e in imp.gate_features(old)), version
    mutated = copy.deepcopy(case)
    mutated["model"]["materials"][0].update(model="undrained", undrained_strength=5.0)
    mutated["model"]["materials"][0].pop("cohesion"); mutated["model"]["materials"][0].pop("friction_angle")
    assert imp.gate_schema(mutated) == []
    mutated["model"]["version"] = "0.2"
    assert imp.gate_schema(mutated)                            # undrained needs 0.3


def test_schema_v0_3_rejects_malformed_undrained_polyline_and_interslice():
    case, _, _ = imp.convert_f3(_raw_f3(
        {"kind": "undrained", "unitWeight": 18.0, "undrainedShearStrength": 25.0, "suRefDepth": 30.0,
         "suRateOfChange": 1.0}, surface=POLY, checks=[("Morgenstern-Price", {"intersliceFunction": "clipped-sine"})]),
        PROB)
    assert imp.gate_schema(case) == []
    def broken(fn):
        c = copy.deepcopy(case)
        fn(c["model"])
        return imp.gate_schema(c) + imp.gate_features(c)
    assert broken(lambda m: m["materials"][0].update(cohesion=1.0))                 # prohibited with undrained
    assert broken(lambda m: m["materials"][0].pop("strength_gradient"))             # datum without gradient
    assert broken(lambda m: m["materials"][0].update(undrained_strength=-1.0))
    assert broken(lambda m: m["analysis"]["surface"].update(points=[[1.0, 1.0]]))
    assert broken(lambda m: m["analysis"]["surface"].update(points=[[2.0, 1.0], [1.0, 2.0]]))
    assert broken(lambda m: m["analysis"].update(methods=["bishop"]))                # interslice without M-P / Bishop
    assert broken(lambda m: m["analysis"]["interslice"].update(points=[[0, 1], [1, 1]]))   # points without data_points
    assert broken(lambda m: m["analysis"]["interslice"].update(function="data_points"))    # data_points without points


# ------------------------------------------------------------ batches R1 to R4: reinforcements (v0.4, F4.12)

F3R_DIR = os.path.join(ROOT, "verification", "pending", "F3R")
CASES_DIR = os.path.join(ROOT, "verification", "cases")
F3R_SCHEMA = json.load(open(os.path.join(ROOT, "schema", "ogs-0.4.schema.json"), encoding="utf-8"))
_TENSION = {"x1": 1.0, "y1": 6.0, "x2": 9.0, "y2": 6.0, "tensileCapacity": 40.0, "spacing": 0.5, "end1Capacity": 0,
            "end2Capacity": 0, "direction": "axial", "application": "passive",
            "pullout": {"kind": "development", "length1": 1.0, "length2": 2.0}}


def _raw_f3r(reinforcements=None, piles=None, **extra):
    raw = _raw()
    if reinforcements is not None:
        raw["definition"]["reinforcements"] = reinforcements
    if piles is not None:
        raw["definition"]["piles"] = piles
    raw["definition"].update(extra)
    return raw


def test_f3r_converts_reinforcements_to_v0_4_with_explicit_direction_and_application():
    bare = {k: v for k, v in _TENSION.items() if k not in ("direction", "application", "pullout")}
    case, _, _ = imp.convert_f3r(_raw_f3r([_TENSION, bare]), PROB)
    m = case["model"]
    assert m["version"] == "0.4"
    first, second = m["reinforcements"]
    assert first == {"id": "R1", "type": "anchor", "x1": 1.0, "y1": 6.0, "x2": 9.0, "y2": 6.0,
                     "application": "passive", "tensile_capacity": 40.0, "direction": "axial",
                     "spacing": 0.5, "end1_capacity": 0, "end2_capacity": 0,
                     "pullout": {"model": "development", "length1": 1.0, "length2": 2.0}}
    assert (second["application"], second["direction"], second["id"]) == ("active", "axial", "R2")   # the defaults, written
    assert list(m).index("reinforcements") == list(m).index("slope") - 1                               # before `slope`
    assert imp.gate_schema_f3r(case, F3R_SCHEMA) == [] and imp.gate_reinforcements(case) == []


def test_f3r_pullout_models_and_the_coverage_default():
    iface = dict(_TENSION, pullout={"kind": "interface", "adhesion": 0, "frictionAngle": 33.7})
    bond = dict(_TENSION, pullout={"kind": "bond", "strength": 30, "bondedLength": 3})
    m = imp.convert_f3r(_raw_f3r([iface, bond]), PROB)[0]["model"]
    assert m["reinforcements"][0]["pullout"] == {"model": "interface", "adhesion": 0.0, "friction_angle": 33.7,
                                                 "coverage": 1.0}       # a missing coverage is the continuous sheet
    assert m["reinforcements"][1]["pullout"] == {"model": "bond", "strength": 30.0, "bonded_length": 3.0}


def test_f3r_piles_with_a_given_force_and_a_wall():
    piles = [{"x1": 9, "y1": 4, "x2": 9, "y2": -2, "spacing": 1, "force": 10.7, "direction": "tangent",
              "application": "passive"},
             {"x1": 0.15, "y1": 9, "x2": 0.15, "y2": -2, "spacing": 0.3, "force": 26.0, "diameter": 0.15,
              "application": "active"},                                      # no direction: cSlope's `angle`, 0
             {"x1": 5, "y1": 9, "x2": 5, "y2": -2, "spacing": 0.5, "force": 60.0, "wall": True,
              "direction": "perpendicular", "location": "slip-surface"}]
    case, _, _ = imp.convert_f3r(_raw_f3r(piles=piles), PROB)
    p1, p2, wall = case["model"]["reinforcements"]
    assert p1 == {"id": "P1", "type": "pile", "x1": 9.0, "y1": 4.0, "x2": 9.0, "y2": -2.0, "application": "passive",
                  "force": 10.7, "direction": "tangent", "spacing": 1.0}
    assert (p2["direction"], p2["angle"], p2["application"]) == ("angle", 0.0, "active") and "diameter" not in p2
    assert wall["type"] == "sheet_pile" and wall["force"] == 120.0 and "spacing" not in wall and "location" not in wall
    assert any("diameter" in n for n in case["source"]["notes"]) and any("wall" in n for n in case["source"]["notes"])
    assert imp.gate_schema_f3r(case, F3R_SCHEMA) == []


def test_f3r_omits_what_v0_4_cannot_express():
    ito_matsui = {"x1": 9, "y1": 4, "x2": 9, "y2": -2, "diameter": 0.6, "spacing": 2.0, "application": "passive"}
    with pytest.raises(imp.Omit, match="Ito-Matsui"):
        imp.convert_f3r(_raw_f3r(piles=[ito_matsui]), PROB)
    with pytest.raises(imp.Omit, match="shearCapacity"):
        imp.convert_f3r(_raw_f3r(piles=[dict(ito_matsui, force=5.0, shearCapacity=9.0)]), PROB)
    with pytest.raises(imp.Omit, match="reinforcements"):
        imp.convert_f3r(_raw_f3r([dict(_TENSION, foo=1)]), PROB)
    with pytest.raises(imp.Omit, match="pullout"):
        imp.convert_f3r(_raw_f3r([dict(_TENSION, pullout={"kind": "grout"})]), PROB)
    with pytest.raises(imp.Omit, match="sin reinforcements"):
        imp.convert_f3r(_raw_f3r(), PROB)


def test_f3r_prestress_is_not_imported_and_the_case_says_so():
    case, _, _ = imp.convert_f3r(_raw_f3r([dict(_TENSION, prestress=50.0)]), PROB)
    assert "prestress" not in case["model"]["reinforcements"][0]
    assert any("prestress" in n for n in case["source"]["notes"])


def test_f3r_batch_conversion_does_not_change_the_batch_0_to_2_conversion():
    """The reinforcements go through the same `_convert` as batches 1 and 2: the rest of the case is unchanged."""
    plain, _, _ = imp.convert_f3(_raw_f3r(), PROB)
    case, _, _ = imp.convert_f3r(_raw_f3r([_TENSION]), PROB)
    model = {k: v for k, v in case["model"].items() if k != "reinforcements"}
    assert model == {**plain["model"], "version": "0.4"} and case["checks"] == plain["checks"]


def test_gate_reinforcements_rules_of_f4_2():
    case, _, _ = imp.convert_f3r(_raw_f3r([_TENSION]), PROB)
    assert imp.gate_reinforcements(case) == []
    bad = copy.deepcopy(case)
    bad["model"]["reinforcements"].append(dict(bad["model"]["reinforcements"][0]))          # repeated id
    bad["model"]["reinforcements"][0]["x2"] = bad["model"]["reinforcements"][0]["x1"]
    bad["model"]["reinforcements"][0]["y2"] = bad["model"]["reinforcements"][0]["y1"]       # zero length
    bad["model"]["reinforcements"][1]["pullout"] = {"model": "bond", "strength": 1.0, "bonded_length": 99.0}
    errors = imp.gate_reinforcements(bad)
    assert any("repetidos" in e for e in errors) and any("longitud nula" in e for e in errors)
    assert any("bonded_length" in e for e in errors)
    old = copy.deepcopy(case)
    old["model"]["version"] = "0.3"
    assert any("0.4" in e for e in imp.gate_reinforcements(old))


def test_f3r_batches_are_the_ones_of_f4_12():
    assert {lot: ids for lot, (_, ids) in imp.F3R_BATCHES.items()} == {
        "R1": ["V016b", "V035a", "V035b", "V037"],
        "R2": ["V011a", "V011b", "V012", "V064", "V065", "V066a", "V066b", "V066c", "V066e"],
        "R3": ["V010", "V010b", "V014", "V083", "V084a", "V084b", "V084c", "V084d", "V084e", "V084f"],
        "R4": ["V015", "V095c"],
    }


def _held_keys():
    """(id, method, published) of the checks retained in `pending/F3R/HOLD.json` (E14n-1 of F4.17)."""
    path = os.path.join(F3R_DIR, "HOLD.json")
    if not os.path.isfile(path):
        return set()
    return {(e["id"], e["method"], e["published"]) for e in json.load(open(path, encoding="utf-8"))}


def _f3r_cases(with_held=True):
    """The batches R1 to R4: promoted ones live in `verification/cases`, held checks in `verification/pending/F3R`. With
    `with_held` each case has all its checks again (the converted case of the importer)."""
    ids = sorted(i for _, ids in imp.F3R_BATCHES.values() for i in ids)
    out = []
    for i in ids:
        parts = []
        for d in (CASES_DIR, F3R_DIR):
            path = os.path.join(d, f"{i}.json")
            if os.path.isfile(path) and (d == CASES_DIR or with_held):
                parts.append(json.load(open(path, encoding="utf-8")))
        if not parts:
            continue
        case = parts[0]
        for extra in parts[1:]:
            assert extra["model"] == case["model"], i
            case["checks"] = case["checks"] + extra["checks"]
        out.append(case)
    return out


def test_the_generated_f3r_cases_pass_every_gate_and_cover_the_batches():
    cases = _f3r_cases()
    assert sorted(c["id"] for c in cases) == sorted(i for _, ids in imp.F3R_BATCHES.values() for i in ids)
    assert sum(len(c["checks"]) for c in cases) == 33
    for case in cases:
        assert imp.gate_schema_f3r(case, F3R_SCHEMA) == [], case["id"]
        assert imp.gate_reinforcements(case) == [] and imp.gate_search(case) == [], case["id"]
        assert imp.gate_loads(case) == [] and imp.gate_features(case) == [], case["id"]
        assert case["model"]["version"] == "0.4" and case["model"]["reinforcements"], case["id"]
        for r in case["model"]["reinforcements"]:      # E14b: no default for either
            assert r["application"] in ("active", "passive") and r["direction"], case["id"]


def test_the_held_f3r_checks_are_the_three_with_a_real_tension_and_nothing_else_is_pending():
    held = _held_keys()      # E14n-1b: V014 went back to cases/, V035b and V083 keep a real tension of the model
    assert held == {("V035b", "bishop", 1.324), ("V035b", "bishop", 1.32), ("V083", "janbu_corrected", 0.89)}
    pending = sorted(os.path.basename(p)[:-5] for p in glob.glob(os.path.join(F3R_DIR, "V*.json")))
    assert pending == ["V035b", "V083"]
    assert "V014" not in {e["id"] for e in json.load(open(os.path.join(F3R_DIR, "HOLD.json"), encoding="utf-8"))}
    for pid in pending:      # the pending file holds only held checks, the case in cases/ holds none of them
        file = json.load(open(os.path.join(F3R_DIR, f"{pid}.json"), encoding="utf-8"))
        assert {(pid, c["method"], c["published"]) for c in file["checks"]} <= held
        in_cases = os.path.join(CASES_DIR, f"{pid}.json")
        if os.path.isfile(in_cases):
            kept = json.load(open(in_cases, encoding="utf-8"))["checks"]
            assert not {(pid, c["method"], c["published"]) for c in kept} & held
    stub = open(os.path.join(F3R_DIR, "INDEX.md"), encoding="utf-8").read()
    assert "promovidos" in stub and "**25** casos" in stub and "**3** checks retenidos" in stub and "V013b a V013e" in stub


def test_the_cases_index_lists_every_promoted_check_with_ogs_and_the_oracle():
    index = open(os.path.join(CASES_DIR, "INDEX.md"), encoding="utf-8").read()
    assert "## Casos con refuerzos (v0.4, lotes R1 a R4)" in index
    assert "**23** casos con **30** checks" in index and "V013b a V013e" in index
    assert "**3** checks más (V035b ×2, V083) quedan retenidos" in index
    for case in _f3r_cases(with_held=False):
        assert f"| {case['id']} |" in index
        assert case["model"]["version"] == "0.4"
    report = json.load(open(os.path.join(ROOT, "verification", "report.json"), encoding="utf-8"))
    f3r = {i for _, ids in imp.F3R_BATCHES.values() for i in ids}
    rows = [r for r in report["checks"] if r["case_id"] in f3r]
    assert len(rows) == 30 and not {(r["case_id"], r["method"], r["published"]) for r in rows} & _held_keys()
    assert all(r["ogs"]["verdict"] == "OK" and r["cslope"]["verdict"] == "OK" for r in rows)


def test_f3r_section_marks_the_checks_without_crossings():
    case = {"id": "V0", "model": {"reinforcements": [{}]}, "checks": [
        {"method": "bishop", "published": 1.5, "published_by": "x", "tolerance": 0.01}]}
    report = {"checks": [{"case_id": "V0", "method": "bishop", "published": 1.5,
                          "ogs": {"fos": 1.5, "err_pct": 0.0}, "cslope": {"fos": 1.5, "err_pct": 0.0},
                          "forces_comparison": {"n_ogs": 0, "n_oracle": 0}}]}
    text = imp.build_f3r_section([case], {"V0": "R1"}, report)
    assert "| 0 / 0 |" in text and "no prueba nada" in text


# ------------------------------------------------------------ batch F3G (tension crack and ponded water, v0.5)

F3G_DIR = os.path.join(ROOT, "verification", "pending", "F3G")
F3G_SCHEMA = json.load(open(os.path.join(ROOT, "schema", "ogs-0.5.schema.json"), encoding="utf-8"))
_PONDED = [[0.0, 12.0], [25.0, 12.0]]          # above the whole ground (y = 10 at most)


def _raw_f3g(checks=None, piezo=None, **definition):
    raw = _raw(piezo=piezo)
    raw["definition"].update(definition)
    if checks is not None:
        raw["checks"] = [{"method": "Bishop", "published": 1.0 + i, "publishedBy": "T", "tolerance": 0.05, "options": o}
                         for i, o in enumerate(checks)]
    return raw


def test_f3g_a_problem_without_crack_nor_ponded_water_belongs_to_the_earlier_batches():
    assert imp.convert_f3g(_raw_f3g([{}]), PROB) == []
    assert imp.convert_f3g(_raw_f3g([{}], piezo=[[0.0, 3.0], [25.0, 3.0]]), PROB) == []     # water under the ground


def test_f3g_crack_with_water_is_a_v0_5_model_with_the_water_weight():
    (case, _, _), = imp.convert_f3g(_raw_f3g([{"tensionCrackDepth": 2.0, "tensionCrackWater": 0.5}]), PROB)
    m = case["model"]
    assert m["version"] == "0.5"
    assert m["analysis"]["tension_crack"] == {"depth": 2.0, "water_fill": 0.5}
    assert m["water"] == {"unit_weight": 9.807}            # no piezometric line: the crack uses water.unit_weight (E12e)
    assert imp.gate_f3g(case, F3G_SCHEMA) == []


def test_f3g_dry_crack_writes_water_fill_zero_and_no_water_block():
    (case, _, _), = imp.convert_f3g(_raw_f3g([{"tensionCrackDepth": 2.0}]), PROB)
    assert case["model"]["analysis"]["tension_crack"] == {"depth": 2.0, "water_fill": 0.0}
    assert "water" not in case["model"] and imp.gate_f3g(case, F3G_SCHEMA) == []


def test_f3g_automatic_depth_is_the_string_auto():
    (case, _, _), = imp.convert_f3g(_raw_f3g([{"tensionCrackAuto": True, "tensionCrackWater": 1}]), PROB)
    assert case["model"]["analysis"]["tension_crack"] == {"depth": "auto", "water_fill": 1.0}


def test_f3g_ponded_water_without_crack_keeps_the_minimum_version_and_the_line():
    (case, _, _), = imp.convert_f3g(_raw_f3g([{}], piezo=_PONDED), PROB)
    # F3.9, F5.1: the minimum version of its fields; ponded water has no field, so a circle with Bishop is v0.1
    assert case["model"]["version"] == "0.1" and "tension_crack" not in case["model"]["analysis"]
    assert case["model"]["water"]["piezometric_line"] == _PONDED
    assert imp.gate_f3g(case, F3G_SCHEMA) == []
    with pytest.raises(imp.Omit, match="agua embalsada"):        # the earlier batches still omit it
        imp.convert(_raw_f3g([{}], piezo=_PONDED), PROB)
    with pytest.raises(imp.Omit, match="agua embalsada"):
        imp.convert_f3(_raw_f3g([{}], piezo=_PONDED), PROB)


def test_f3g_checks_with_another_crack_go_to_another_case():
    raw = _raw_f3g([{"tensionCrackDepth": 2, "tensionCrackWater": 1}, {"tensionCrackAuto": True, "tensionCrackWater": 1},
                    {"tensionCrackDepth": 2, "tensionCrackWater": 1}])
    first, second = imp.convert_f3g(raw, PROB)
    assert (first[0]["id"], second[0]["id"]) == ("T-IMP", "T-IMP-auto")
    assert second[0]["model"]["meta"]["id"] == "T-IMP-auto"
    assert [c["published"] for c in first[0]["checks"]] == [1.0, 3.0] and [c["published"] for c in second[0]["checks"]] == [2.0]
    assert first[0]["model"]["analysis"]["tension_crack"]["depth"] == 2.0
    assert second[0]["model"]["analysis"]["tension_crack"]["depth"] == "auto"
    assert any("derivado de T-IMP" in n for n in second[0]["source"]["notes"])


def test_f3g_composite_base_and_partial_factors_discard_their_check_not_the_case():
    (case, disc, _), = imp.convert_f3g(_raw_f3g([{"tensionCrackDepth": 2.0}, {"tensionCrackDepth": 2.0, "compositeBase": True},
                                                 {"tensionCrackDepth": 2.0, "partialFactors": {"cu": 1.4}}]), PROB)
    assert [c["published"] for c in case["checks"]] == [1.0]
    assert len(disc) == 2 and any("compositeBase" in d for d in disc) and any("partialFactors" in d for d in disc)
    with pytest.raises(imp.Omit, match="opción de check"):       # the earlier batches omit the whole case
        imp.convert_f3(_raw_f3g([{"tensionCrackDepth": 2.0}]), PROB)


def test_f3g_phreatic_correction_is_accepted_with_a_note_and_other_heads_are_not():
    (case, _, _), = imp.convert_f3g(_raw_f3g([{"tensionCrackDepth": 2.0, "porePressureHead": "phreatic-correction"}]), PROB)
    assert imp.PHREATIC_NOTE in case["source"]["notes"]
    with pytest.raises(imp.Omit, match="sin checks válidos"):
        imp.convert_f3g(_raw_f3g([{"tensionCrackDepth": 2.0, "porePressureHead": "other"}]), PROB)


def test_f3g_point_left_on_the_edge_by_float_noise_belongs_to_its_only_face():
    raw = _raw_f3g([{}], regionAssignments=[{"point": [0.0, 5.0], "materialName": "Soil"}])
    case, _, _ = imp._convert(raw, PROB, v02=True, f3=True, f3g=True)
    assert [r["material"] for r in case["model"]["regions"]] == ["soil"]
    with pytest.raises(imp.Omit, match="sobre el borde"):        # the earlier batches keep refusing it
        imp.convert_f3(raw, PROB)


@pytest.mark.parametrize("mutate, match", [
    (lambda m: m.update(version="0.3"), "version"),
    (lambda m: m["analysis"]["tension_crack"].update(depth=0), "depth"),
    (lambda m: m["analysis"]["tension_crack"].update(depth="deep"), "depth|schema|valid"),
    (lambda m: m["analysis"]["tension_crack"].update(water_fill=1.5), "water_fill"),
    (lambda m: m["analysis"]["tension_crack"].pop("water_fill"), "water_fill"),
    (lambda m: m["analysis"]["tension_crack"].update(x=3.0), "x|additional"),
    (lambda m: m.pop("water"), "unit_weight"),
])
def test_gate_f3g_rejects_what_f5_2_rejects(mutate, match):
    (case, _, _), = imp.convert_f3g(_raw_f3g([{"tensionCrackDepth": 2.0, "tensionCrackWater": 1}]), PROB)
    case = copy.deepcopy(case)
    mutate(case["model"])
    assert re.search(match, " ".join(imp.gate_f3g(case, F3G_SCHEMA))), imp.gate_f3g(case, F3G_SCHEMA)


def _is_f3g(case):
    """A promoted F3G case: it has a tension crack or ponded water (the earlier batches have neither)."""
    m = case["model"]
    if m["analysis"].get("tension_crack"):
        return True
    piezo = (m.get("water") or {}).get("piezometric_line") or []
    outline = unary_union([Polygon(r["polygon"]) for r in m["regions"]])
    return len(piezo) >= 2 and imp.water_above_ground(outline, piezo)


def _f3g_files(held=False):
    """The F3G cases promoted to verification/cases (default) or the held ones that stay in pending/F3G."""
    pattern = os.path.join(F3G_DIR if held else CASES_DIR, "V*.json")
    cases = {os.path.basename(p)[:-5]: json.load(open(p, encoding="utf-8")) for p in sorted(glob.glob(pattern))}
    return cases if held else {cid: c for cid, c in cases.items() if _is_f3g(c)}


def test_the_f3g_batch_is_promoted_80_checks_and_6_held():
    ready, held = _f3g_files(), _f3g_files(held=True)
    assert sum(len(c["checks"]) for c in ready.values()) == 80 and len(ready) == 31
    assert sum(len(c["checks"]) for c in held.values()) == 6 and sorted(held) == ["V009a", "V009b", "V085"]
    # X18 §3.1 D: 86 checks of 33 problems; V086b is split in two cases because the crack is a field of the model
    assert len({i.split("-")[0] for i in {**ready, **held}}) == 33
    assert "V086b-auto" in ready
    hold = json.load(open(os.path.join(F3G_DIR, "HOLD.json"), encoding="utf-8"))
    hold_keys = {(e["id"], e["method"], e["published"]) for e in hold}
    assert hold_keys == {(c["id"], k["method"], k["published"]) for c in held.values() for k in c["checks"]}
    assert not hold_keys & {(c["id"], k["method"], k["published"]) for c in ready.values() for k in c["checks"]}
    for entry in hold:
        assert entry["cslope"] and entry["ogs"] and entry["diagnosis"]
        assert "relativa" in entry["diagnosis"] or "estoc" in entry["diagnosis"]      # the cause, measured
    # the five checks that X18 read with an absolute tolerance are held for the tolerance in none: V087 and V092 are
    # promoted (the repository tolerance is relative) and V009b is held for the warning of E13k
    promoted = {(c["id"], k["method"]) for c in ready.values() for k in c["checks"]}
    assert {("V087", "janbu_corrected"), ("V092", "bishop"), ("V092", "spencer"), ("V092", "morgenstern_price")} <= promoted
    assert {e["id"] for e in hold if "Convención de tolerancia" in e["diagnosis"]} == set()
    assert {(e["id"], e["method"]) for e in hold if "interslice_shear_exceeds_strength" in e["diagnosis"]} == {("V009a", "spencer"), ("V009b", "spencer")}


def test_the_f3g_cases_pass_the_gates_and_use_the_minimum_version():
    for cid, case in {**_f3g_files(), **_f3g_files(held=True)}.items():
        assert imp.gate_f3g(case, F3G_SCHEMA) == [] and imp.gate_search(case) == [], cid
        assert imp.gate_loads(case) == [] and imp.gate_features(case) == [], cid
        crack = case["model"]["analysis"].get("tension_crack")
        has_v02 = "loads" in case["model"] or "seismic" in case["model"]["analysis"]
        assert case["model"]["version"] == ("0.5" if crack else "0.3" if _uses_v03(case["model"]) else "0.2" if has_v02 else "0.1"), cid
        assert case["id"] == cid and case["model"]["meta"]["id"] == cid
        assert "reinforcements" not in case["model"], cid
        if crack and crack["water_fill"] > 0:
            assert case["model"]["water"]["unit_weight"] == 9.807, cid       # the oracle's water weight


def test_the_f3g_cases_without_a_crack_all_have_ponded_water():
    for cid, case in {**_f3g_files(), **_f3g_files(held=True)}.items():
        if case["model"]["analysis"].get("tension_crack"):
            continue
        outline = unary_union([Polygon(r["polygon"]) for r in case["model"]["regions"]])
        assert imp.water_above_ground(outline, case["model"]["water"]["piezometric_line"]), cid


def test_the_f3g_indexes_list_the_cases_the_hold_and_the_tolerance_convention():
    index = open(os.path.join(F3G_DIR, "INDEX.md"), encoding="utf-8").read()
    assert "**31** casos con **80** checks" in index and "**6** checks" in index and "| V085 |" in index and "| V009b |" in index
    assert "Convención de tolerancia" in index and "relativa" in index
    cases_index = open(os.path.join(CASES_DIR, "INDEX.md"), encoding="utf-8").read()
    section = cases_index[cases_index.index("## Grieta de tracción y agua embalsada"):]
    assert "**31** casos con **80** checks" in section and "V085 ×4" in section and "V009a" in section
    for cid, case in _f3g_files().items():
        for check in case["checks"]:
            assert f"| {cid} | {case['model']['version']} |" in section and f"| {check['published']} |" in section


def _clone():
    for cand in (os.environ.get("CSLOPE_SRC"), os.path.join(os.environ.get("TMPDIR", ""), "cslope-src")):
        if cand and os.path.isfile(os.path.join(cand, "packages", "engine-rs", "golden", "verification.json")):
            return cand
    return None


def _f3g_tree(root):
    """The files of the F3G batch under `root`: what is held in pending/F3G, the promoted cases and cases/INDEX.md."""
    out = {p.relative_to(root).as_posix(): p.read_bytes() for p in (root / "verification" / "pending" / "F3G").rglob("*") if p.is_file()}
    for p in sorted((root / "verification" / "cases").glob("*.json")):
        if _is_f3g(json.loads(p.read_text(encoding="utf-8"))):
            out[p.relative_to(root).as_posix()] = p.read_bytes()
    out["verification/cases/INDEX.md"] = (root / "verification" / "cases" / "INDEX.md").read_bytes()
    return out


@pytest.mark.skipif(_clone() is None, reason="needs the cSlope clone (CSLOPE_SRC or $TMPDIR/cslope-src)")
def test_the_importer_is_idempotent_and_reproduces_the_promoted_f3g(tmp_path):
    """Run on a copy of the tree: the F3G files are the ones in the repo and a second run writes nothing of F3G."""
    import shutil
    root = tmp_path / "repo"
    for sub in ("verification", "schema", "NOTICE", os.path.join("docs", "fase3", "exploracion", "X28_filas")):
        src = os.path.join(ROOT, sub)
        (root / sub).parent.mkdir(parents=True, exist_ok=True)    # HAM1 (F3B) reads its geometry from X28_filas
        (shutil.copytree if os.path.isdir(src) else shutil.copy)(src, root / sub)
    argv = ["import_cslope.py", "--src", _clone(), "--root", str(root)]
    import sys
    old = sys.argv
    try:
        sys.argv = argv
        assert imp.main() == 0
        first = _f3g_tree(root)
        assert imp.main() == 0
        second = _f3g_tree(root)
    finally:
        sys.argv = old
    assert first == second
    for rel, data in first.items():
        with open(os.path.join(ROOT, rel), "rb") as fh:
            assert fh.read() == data, rel
    assert "verification/pending/F3G/V085.json" in first and "verification/cases/V087.json" in first
    assert not any(rel.startswith("verification/pending/F3G/hold") for rel in first)


# ------------------------------------------------------------ batch F3I: Ito-Matsui piles (v0.5, E15i-10)

F3I_DIR = os.path.join(ROOT, "verification", "pending", "F3I")
_IM_PILE = {"x1": 9, "y1": 4, "x2": 9, "y2": -2, "diameter": 0.6, "spacing": 2.0, "application": "passive"}


def _f3i_case(**pile):
    return imp.convert_f3i(_raw_f3r(piles=[dict(_IM_PILE, **pile)]), PROB)[0]


def test_f3i_converts_an_ito_matsui_pile_to_lateral_pressure_with_explicit_fields():
    case = _f3i_case()
    pile, = case["model"]["reinforcements"]
    assert case["model"]["version"] == "0.5" and list(case["model"]).index("reinforcements") == list(case["model"]).index("slope") - 1
    assert pile == {"id": "P1", "type": "pile", "x1": 9.0, "y1": 4.0, "x2": 9.0, "y2": -2.0, "application": "passive",
                    "direction": "angle", "angle": 0.0, "spacing": 2.0,
                    "lateral_pressure": {"model": "ito_matsui", "diameter": 0.6, "location": "centroid"}}
    assert "force" not in pile and "capacity" not in pile
    assert any("Ito-Matsui" in n and "centroid" in n and "angle 0" in n for n in case["source"]["notes"])
    assert imp.gate_f3i(case, F3G_SCHEMA) == []


def test_f3i_location_direction_and_capacity_come_from_the_source():
    pile, = _f3i_case(location="slip-surface", direction="tangent", shearCapacity=150.0,
                      momentCapacity=250.0, application="active")["model"]["reinforcements"]
    assert pile["lateral_pressure"]["location"] == "slip_surface" and pile["direction"] == "tangent" and "angle" not in pile
    assert pile["capacity"] == {"shear": 150.0, "moment": 250.0} and pile["application"] == "active"
    only, = _f3i_case(momentCapacity=90.0)["model"]["reinforcements"]
    assert only["capacity"] == {"moment": 90.0}


@pytest.mark.parametrize("change, match", [
    ({"x2": 9.5}, "no vertical"),
    ({"spacing": 0.6}, "spacing"),
    ({"spacing": 0.5}, "spacing"),
    ({"diameter": 0}, "diameter"),
    ({"location": "somewhere"}, "location"),
    ({"shearCapacity": 0}, "shearCapacity"),
    ({"direction": "tangent", "angle": 3}, "angle"),
])
def test_f3i_omits_what_ogs_would_reject(change, match):
    with pytest.raises(imp.Omit, match=match):
        _f3i_case(**change)


def test_f3i_a_force_pile_with_a_capacity_is_omitted_and_the_other_batches_still_omit_ito_matsui():
    with pytest.raises(imp.Omit, match="capacity solo con lateral_pressure"):
        imp.convert_f3i(_raw_f3r(piles=[_IM_PILE, dict(_IM_PILE, force=5.0, shearCapacity=9.0)]), PROB)
    with pytest.raises(imp.Omit, match="sin pilotes Ito-Matsui"):
        imp.convert_f3i(_raw_f3r(piles=[dict(_IM_PILE, force=5.0)]), PROB)
    with pytest.raises(imp.Omit, match="Ito-Matsui"):                       # batches R1 to R4 are unchanged
        imp.convert_f3r(_raw_f3r(piles=[_IM_PILE]), PROB)


def test_f3i_gate_rejects_what_e15i_1_rejects():
    base = _f3i_case()

    def broken(mutate):
        case = copy.deepcopy(base)
        mutate(case["model"]["reinforcements"][0], case["model"])
        return imp.gate_f3i(case, F3G_SCHEMA)
    assert any("se excluyen" in e for e in broken(lambda r, m: r.update(force=5.0)))
    assert any("se excluyen" in e for e in broken(lambda r, m: r.pop("lateral_pressure")))
    assert any("capacity sin lateral_pressure" in e for e in broken(lambda r, m: (r.pop("lateral_pressure"), r.update(force=1, capacity={"shear": 1}))))
    assert any("vertical" in e for e in broken(lambda r, m: r.update(x2=10.0)))
    assert any("spacing" in e for e in broken(lambda r, m: r.update(spacing=0.5)))
    assert any('requiere version "0.5"' in e for e in broken(lambda r, m: m.update(version="0.4")))
    assert broken(lambda r, m: r["lateral_pressure"].update(diameter=-1.0))                      # schema
    assert broken(lambda r, m: r["lateral_pressure"].update(location="slip-surface"))            # schema
    assert broken(lambda r, m: r.update(capacity={}))                                            # schema


def test_f3i_schema_extension_is_a_noop_once_the_schema_knows_lateral_pressure():
    assert imp.schema_with_ito_matsui(F3G_SCHEMA) is not F3G_SCHEMA or "lateral_pressure" in F3G_SCHEMA["$defs"]["pile"]["properties"]
    known = copy.deepcopy(F3G_SCHEMA)
    known["$defs"]["pile"]["properties"]["lateral_pressure"] = {"type": "object"}
    assert imp.schema_with_ito_matsui(known) is known


def _f3i_files():
    return {os.path.basename(p)[:-5]: json.load(open(p, encoding="utf-8")) for p in sorted(glob.glob(os.path.join(F3I_DIR, "V*.json")))}


def test_the_f3i_batch_is_v013b_to_e_with_four_bishop_search_checks():
    cases = _f3i_files()
    if not cases:      # promoted: the integrator moved them to cases/ (F3I_PROMOTED)
        cases = {cid: json.load(open(os.path.join(CASES_DIR, f"{cid}.json"), encoding="utf-8")) for cid in imp.F3I_IDS}
    assert sorted(cases) == ["V013b", "V013c", "V013d", "V013e"] == sorted(imp.F3I_IDS)
    ratios = []
    for cid, case in cases.items():
        assert imp.gate_f3i(case, F3G_SCHEMA) == [] and imp.gate_search(case) == [], cid
        assert imp.gate_features(case) == [] and case["id"] == cid and case["model"]["meta"]["id"] == cid
        pile, = case["model"]["reinforcements"]
        assert "force" not in pile and pile["application"] == "passive" and pile["direction"] == "angle" and pile["angle"] == 0.0
        assert pile["lateral_pressure"] == {"model": "ito_matsui", "diameter": 0.8, "location": "centroid"}, cid
        assert case["model"]["version"] == "0.5"
        assert [(c["method"], c["kind"]) for c in case["checks"]] == [("bishop", "search")], cid
        ratios.append(pile["spacing"] / pile["lateral_pressure"]["diameter"])
    assert ratios == pytest.approx([2, 3, 4, 6])
    assert [cases[c]["checks"][0]["published"] for c in sorted(cases)] == [1.54, 1.43, 1.33, 1.25]


def test_the_f3i_index_lists_the_cases_the_oracle_and_the_promotion_command():
    index = open(os.path.join(F3I_DIR, "INDEX.md"), encoding="utf-8").read()
    if "pasaron a" in index:
        pytest.skip("promoted")
    assert "**4** casos con **4** checks" in index and "--promote-f3i" in index and "sed -i" in index
    for cid in imp.F3I_IDS:
        assert f"| {cid} |" in index
    report = json.load(open(os.path.join(F3I_DIR, "report.json"), encoding="utf-8"))
    assert len(report["checks"]) == 4
    for r in report["checks"]:      # the oracle: between +0.05 % and +0.50 % of the published value (X22 §5.1)
        assert 0.0 < r["cslope"]["err_pct"] < 0.51


def _run_importer(root, *flags):
    import sys
    old = sys.argv
    try:
        sys.argv = ["import_cslope.py", "--src", _clone(), "--root", str(root), *flags]
        assert imp.main() == 0
    finally:
        sys.argv = old


def _tree(root):
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in (root / "verification").rglob("*") if p.is_file()}


@pytest.mark.skipif(_clone() is None, reason="needs the cSlope clone (CSLOPE_SRC or $TMPDIR/cslope-src)")
def test_the_importer_is_idempotent_with_f3i_pending_and_leaves_cases_untouched(tmp_path):
    import shutil
    root = tmp_path / "repo"
    for sub in ("verification", "schema", "NOTICE", os.path.join("docs", "fase3", "exploracion", "X28_filas")):
        src = os.path.join(ROOT, sub)
        (root / sub).parent.mkdir(parents=True, exist_ok=True)    # HAM1 (F3B) reads its geometry from X28_filas
        (shutil.copytree if os.path.isdir(src) else shutil.copy)(src, root / sub)
    before = _tree(root)
    _run_importer(root)
    first = _tree(root)
    _run_importer(root)
    assert _tree(root) == first
    assert first == before                       # the committed files are what the importer writes
    assert {k for k in first if k.startswith("verification/cases/")} == {k for k in before if k.startswith("verification/cases/")}
    # F3I was promoted into cases/ (cc66c2e): the four Ito-Matsui cases are in cases/ and pending/F3I keeps only its INDEX.md.
    assert all(f"verification/cases/V013{x}.json" in first and f"verification/pending/F3I/V013{x}.json" not in first for x in "bcde")


@pytest.mark.skipif(_clone() is None, reason="needs the cSlope clone (CSLOPE_SRC or $TMPDIR/cslope-src)")
def test_promote_f3i_is_idempotent_on_the_promoted_tree_and_cases_hold_the_four_cases(tmp_path):
    # F3I was promoted in cc66c2e (V013b-e live in cases/, F3I_PROMOTED = True). The old test ran the promotion over a tree
    # that still had them in pending/F3I; now the tree is already promoted, so `--promote-f3i` must change nothing.
    import shutil
    root = tmp_path / "repo"
    for sub in ("verification", "schema", "NOTICE", os.path.join("docs", "fase3", "exploracion", "X28_filas")):
        src = os.path.join(ROOT, sub)
        (root / sub).parent.mkdir(parents=True, exist_ok=True)    # HAM1 (F3B) reads its geometry from X28_filas
        (shutil.copytree if os.path.isdir(src) else shutil.copy)(src, root / sub)
    promoted = _tree(root)
    _run_importer(root, "--promote-f3i")
    first = _tree(root)
    _run_importer(root, "--promote-f3i")
    assert _tree(root) == first == promoted
    for x in "bcde":
        cid = f"V013{x}"
        assert f"verification/pending/F3I/{cid}.json" not in first
        assert f"verification/cases/{cid}.json" in first
    assert not any(k.endswith(("pending/F3I/report.json", "pending/F3I/REPORT.md")) for k in first)
    index = first["verification/cases/INDEX.md"].decode()
    assert "## Pilotes de Ito-Matsui (lote F3I, v0.5)" in index and "**4** casos con **4** checks" in index
    assert "| V013c | 3 | bishop | 1.43 |" in index
    assert "Casos convertidos e incluidos: **151**" in index
    assert "no son de v0.4" in first["verification/pending/F3R/INDEX.md"].decode()
    assert "pasaron a" in first["verification/pending/F3I/INDEX.md"].decode()


# ---------------------------------------------------------------- batch F3B (F6.12): pending/F3B, v0.6

F3B_DIR = os.path.join(ROOT, "verification", "pending", "F3B")


def _f3b_cases():
    return {os.path.basename(p)[:-5]: json.load(open(p, encoding="utf-8"))
            for p in sorted(glob.glob(os.path.join(F3B_DIR, "*.json"))) if not p.endswith("HOLD.json")}


def test_pending_f3b_has_the_listed_cases_validated_against_the_06_schema():
    cases = _f3b_cases()
    expected = {"V001", "V002", "V026", "V033", "V034a", "V034b", "V036a", "V093", "V102a", "V102b",
                "V009c", "V050b", "V059a", "V059b", "V059c", "V094", "V103", "HAM1"}
    assert set(cases) == expected
    assert sum(len(c["checks"]) for c in cases.values()) == 22
    validator = jsonschema.Draft202012Validator(json.load(open(os.path.join(ROOT, "schema", "ogs-0.6.schema.json"))))
    for cid, case in cases.items():
        assert not list(validator.iter_errors(case["model"])), cid
        assert case["model"]["version"] == "0.6" and case["model"]["meta"]["id"] == cid
        if cid != "HAM1":
            search = case["model"]["analysis"]["search"]
            assert search["non_circular"] == {"seeds": 3, "max_vertices": 33}, cid
            assert all(ck["kind"] == "search" and ck["method"] != "bishop" for ck in case["checks"]), cid


def test_pending_f3b_never_promotes_and_keeps_v105a_in_hold_with_its_reason():
    assert not os.path.exists(os.path.join(CASES_DIR, "HAM1.json"))       # B2 promotes it, not this block
    hold = json.load(open(os.path.join(F3B_DIR, "HOLD.json"), encoding="utf-8"))
    assert [(h["id"], h["method"], h["published"]) for h in hold] == [("V105a", "bishop", 1.285)]
    assert "aboveWater" in hold[0]["diagnosis"]
    index = open(os.path.join(F3B_DIR, "INDEX.md"), encoding="utf-8").read()
    assert "**18** casos con **22** checks" in index
    assert "- V105a: material 'Sand with clay' con propiedad no soportada: aboveWater" in index
    assert "- V100 (3 checks): material 'Clay' con modelo 'shear-normal'" in index
    assert not os.path.exists(os.path.join(F3B_DIR, "V105a.json"))


def test_pending_f3b_ham1_states_its_assumptions_source_and_tolerance():
    case = _f3b_cases()["HAM1"]
    assert [(c["method"], c["published"], c["tolerance"]) for c in case["checks"]] == [
        ("bishop", 1.153, 0.005), ("spencer", 1.152, 0.005)]
    material = case["model"]["materials"][0]
    assert material["model"] == "hoek_brown" and "water" not in case["model"]
    assert case["model"]["analysis"]["surface"]["type"] == "circle"
    assert "05-810" in case["source"]["reference"] and case["source"]["derived_from"] == imp.HAM1_URL
    notes = " ".join(case["source"]["notes"])
    for text in ("cimentación", "terreno seco", "γ = 25", "0,5 %", "1,150215", "1,152052", "F6.8"):
        assert text in notes, text


def test_f3b_importer_uses_the_new_options_only_in_f3b_mode():
    nco = {"nonCircularOptimization": True}
    assert imp.option_reason("Morgenstern-Price", nco) is not None
    assert imp.option_reason("Morgenstern-Price", nco, v02=True, f3=True, f3g=True) is not None
    assert imp.option_reason("Morgenstern-Price", nco, v02=True, f3=True, f3g=True, f3b=True) is None
    assert imp.option_reason("Morgenstern-Price", {"compositeBase": True}, f3b=True) is not None
