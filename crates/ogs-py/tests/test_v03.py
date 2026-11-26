"""Tests del formato v0.3 a través del binding de Python (R10B-10).

Se ejecutan contra el wheel instalado, como `test_smoke.py`. Los valores de referencia son los de cSlope 0.1.0
(el oráculo independiente de `verification/harness/test_to_cslope.py`), sobre el modelo ACADS 1(a) (V047a) con el
círculo fijo de su búsqueda de Bishop y con una polilínea cercana a él. Aquí no se importa cSlope: los valores están
escritos, con su origen. `analyze_json` delega íntegro en `ogs_core::analyze_json`, así que estos tests fijan que cada
estado, aviso y campo nuevo de la Fase 3a llega a Python sin cambios.
"""

import copy
import json
from pathlib import Path

import pytest

import opengeoslide

REPO_ROOT = Path(__file__).resolve().parents[3]
ACADS1A = REPO_ROOT / "examples" / "acads1a.ogs.json"
D18 = REPO_ROOT / "verification" / "differential" / "cases_f3" / "D18.ogs.json"

V047A_CIRCLE = {"type": "circle", "xc": 29.54334963719809, "yc": 53.63784815923435, "r": 28.641487934160704}
V047A_POLYLINE = [[30, 25.000001], [35, 25.520953], [40, 26.973391], [45, 29.525055], [51.29111842105263, 35.0]]
WARNING_E13K = "interslice_shear_exceeds_strength"
REL = 5e-4  # ogs contra cSlope en estos modelos: hasta 3e-4 en la superficie fija


def v03_model(methods: list[str], surface: dict | None = None, **analysis) -> dict:
    """V047a como modelo v0.3 con superficie fija (círculo de la búsqueda de Bishop, o la polilínea indicada)."""
    model = json.loads(ACADS1A.read_text(encoding="utf-8"))
    model["version"] = "0.3"
    model["analysis"].pop("search")
    model["analysis"]["surface"] = surface or dict(V047A_CIRCLE)
    model["analysis"]["methods"] = methods
    model["analysis"].update(analysis)
    return model


def by_method(report: dict) -> dict:
    return {r["method"]: r for r in report["results"]}


def undrained(model: dict, **fields) -> dict:
    mat = model["materials"][0]
    for key in ("cohesion", "friction_angle"):
        mat.pop(key)
    mat.update(model="undrained", **fields)
    return model


# ------------------------------------------------------------------ polilínea

# Spencer es M-P con f constante en cSlope: 0.9991304877; M-P half_sine 0.9999384297; Janbu corregido 0.9993458659.
POLYLINE_ORACLE = [
    ("spencer", 0.9991304877),
    ("morgenstern_price", 0.9999384297),
    ("janbu_corrected", 0.9993458659),
]


@pytest.mark.parametrize("method, expected", POLYLINE_ORACLE)
def test_polyline_matches_the_oracle(method, expected):
    report = opengeoslide.analyze(v03_model([method], {"type": "polyline", "points": V047A_POLYLINE}))
    result = report["results"][0]
    assert result["status"] == "converged"
    assert result["fos"] == pytest.approx(expected, rel=REL)


def test_polyline_report_gives_the_surface_as_points_already_fitted_to_the_ground():
    model = v03_model(["spencer"], {"type": "polyline", "points": V047A_POLYLINE})
    result = opengeoslide.analyze(model)["results"][0]
    points = result["surface"]["points"]
    assert set(result["surface"]) == {"points"}
    # the first end (x = 30, y = 25.000001) is within 1e-6 of the ground (y = 25): the engine moves it onto it
    assert points[0][1] == pytest.approx(25.0, abs=1e-5) and points[-1] == pytest.approx([51.29111842105263, 35.0])
    assert all(b[0] > a[0] for a, b in zip(points, points[1:]))


def test_polyline_that_stops_under_the_ground_is_extended_to_it():
    # the last point, (40, 26.97), is under the ground (y = 30): the engine prolongs the segment up to the ground
    pts = [[30, 25.000001], [35, 25.520953], [40, 26.973391]]
    result = opengeoslide.analyze(v03_model(["spencer"], {"type": "polyline", "points": pts}))["results"][0]
    assert len(result["surface"]["points"]) == len(pts) + 1
    last = result["surface"]["points"][-1]
    assert last[0] > pts[-1][0] and last[1] > pts[-1][1]


def test_bishop_on_a_polyline_is_invalid_model():
    model = v03_model(["bishop"], {"type": "polyline", "points": V047A_POLYLINE})
    with pytest.raises(ValueError, match=r"^InvalidModel: .*bishop.*circulares"):
        opengeoslide.analyze(model)


def test_polyline_without_methods_gets_the_default_bishop_and_is_invalid_model():
    # E13l-8: the schema requires `methods` for a polyline because the default (["bishop"]) is rejected by the engine
    model = v03_model(["spencer"], {"type": "polyline", "points": V047A_POLYLINE})
    del model["analysis"]["methods"]
    with pytest.raises(ValueError, match=r"^InvalidModel: .*bishop.*circulares"):
        opengeoslide.analyze(model)


def test_polyline_over_the_ground_is_an_invalid_status_not_an_exception():
    # the interior vertex (44, 34) is over the ground (y = 32 at x = 44): `polyline_outside_ground`
    pts = [[30, 25.0], [38, 27.0], [44, 34.0], [51.29111842105263, 35.0]]
    result = opengeoslide.analyze(v03_model(["spencer"], {"type": "polyline", "points": pts}))["results"][0]
    assert result["status"] == "invalid" and result["fos"] is None
    assert result["warnings"] == ["polyline_outside_ground"]


def test_polyline_whose_end_never_reaches_the_ground_is_an_invalid_status():
    # the left end (30, 24) is under the ground (y = 25) and its segment goes down: no crossing when it is extended
    pts = [[30, 24.0], [40, 32.0], [50, 26.0]]
    result = opengeoslide.analyze(v03_model(["spencer"], {"type": "polyline", "points": pts}))["results"][0]
    assert result["status"] == "invalid" and result["fos"] is None
    assert result["warnings"] == ["polyline_no_ground_crossing"]


def test_polyline_with_a_non_increasing_x_is_invalid_model():
    pts = [[30, 25.0], [40, 27.0], [40, 28.0], [51.29111842105263, 35.0]]
    with pytest.raises(ValueError, match=r"^InvalidModel: "):
        opengeoslide.analyze(v03_model(["spencer"], {"type": "polyline", "points": pts}))


# ----------------------------------------------------------------- no drenado

def test_undrained_constant_strength_matches_the_oracle():
    model = undrained(v03_model(["bishop"]), undrained_strength=25.0)
    result = opengeoslide.analyze(model)["results"][0]
    assert result["status"] == "converged"
    assert result["fos"] == pytest.approx(1.5697595025, rel=REL)


def test_undrained_with_gradient_matches_the_oracle_and_a_limit_that_does_not_bite_changes_nothing():
    base = undrained(v03_model(["bishop"]), undrained_strength=10.0, strength_datum=35.0, strength_gradient=1.0)
    limited = copy.deepcopy(base)
    limited["materials"][0]["strength_limit"] = 22.0
    fos = opengeoslide.analyze(base)["results"][0]["fos"]
    assert fos == pytest.approx(1.0373275799, rel=REL)
    assert opengeoslide.analyze(limited)["results"][0]["fos"] == pytest.approx(fos, rel=1e-12)


def test_undrained_negative_gradient_with_a_floor_matches_the_oracle_on_d18():
    """D18 (R10): Su = 70 kPa at y = 10, −2 kPa/m, floor 25 kPa. cSlope 0.1.0, Bishop on the fixed circle: 1.2055."""
    model = json.loads(D18.read_text(encoding="utf-8"))
    model["analysis"]["methods"] = ["bishop"]
    del model["analysis"]["search"]                      # con búsqueda se ignoraría el círculo fijo
    result = opengeoslide.analyze(model)["results"][0]
    assert result["status"] == "converged"
    assert result["fos"] == pytest.approx(1.2055233500, rel=2e-3)
    # without the floor the lowest point of the circle (y = −14) would have less strength: the FS goes down
    free = copy.deepcopy(model)
    free["materials"][0]["strength_limit"] = 0.0
    assert opengeoslide.analyze(free)["results"][0]["fos"] < result["fos"] - 0.01


def test_undrained_without_its_strength_or_with_cohesion_is_invalid_model():
    model = undrained(v03_model(["bishop"]))
    with pytest.raises(ValueError, match=r"^InvalidModel: "):
        opengeoslide.analyze(model)
    model = undrained(v03_model(["bishop"]), undrained_strength=25.0, cohesion=3.0)
    with pytest.raises(ValueError, match=r"^InvalidModel: "):
        opengeoslide.analyze(model)


def test_v03_fields_with_an_older_version_are_invalid_model_naming_the_field():
    model = undrained(v03_model(["bishop"]), undrained_strength=25.0)
    for old in ("0.1", "0.2"):
        model["version"] = old
        with pytest.raises(ValueError, match=r'^InvalidModel: .*undrained.* requiere version "0\.3"'):
            opengeoslide.analyze(model)


# ----------------------------------------------------- Morgenstern-Price y Janbu

def test_morgenstern_price_functions_match_the_oracle_and_the_report_names_the_function():
    expected = {"half_sine": 0.9840779260, "clipped_sine": 0.9840846639, "trapezoidal": 0.9840713928}
    for function, fos in expected.items():
        model = v03_model(["morgenstern_price"], interslice={"function": function})
        result = opengeoslide.analyze(model)["results"][0]
        assert result["status"] == "converged" and result["fos"] == pytest.approx(fos, rel=REL), function
        assert result["interslice"]["function"] == function
        assert isinstance(result["lambda"], float)


def test_morgenstern_price_defaults_to_half_sine_and_accepts_data_points():
    default = opengeoslide.analyze(v03_model(["morgenstern_price"]))["results"][0]
    assert default["interslice"]["function"] == "half_sine"
    points = [[0.0, 0.0], [0.5, 1.0], [1.0, 0.0]]
    model = v03_model(["morgenstern_price"], interslice={"function": "data_points", "points": points})
    result = opengeoslide.analyze(model)["results"][0]
    assert result["status"] == "converged" and result["fos"] == pytest.approx(default["fos"], rel=1e-3)
    assert result["interslice"]["function"] == "data_points"


def test_interslice_without_morgenstern_price_or_with_invalid_points_is_invalid_model():
    model = v03_model(["spencer"], interslice={"function": "half_sine"})
    with pytest.raises(ValueError, match=r"^InvalidModel: "):
        opengeoslide.analyze(model)
    bad = v03_model(["morgenstern_price"], interslice={"function": "data_points", "points": [[0.0, 0.0], [0.5, 0.0], [1.0, 0.0]]})
    with pytest.raises(ValueError, match=r"^InvalidModel: "):
        opengeoslide.analyze(bad)


def test_janbu_simplified_and_corrected_match_the_oracle_and_the_report_carries_f0():
    report = opengeoslide.analyze(v03_model(["janbu_simplified", "janbu_corrected"]))
    results = by_method(report)
    simplified, corrected = results["janbu_simplified"], results["janbu_corrected"]
    assert simplified["fos"] == pytest.approx(0.9452285578, rel=REL)
    assert corrected["fos"] == pytest.approx(0.9883537594, rel=REL)
    assert corrected["correction_factor"] > 1.0
    assert corrected["fos"] == pytest.approx(simplified["fos"] * corrected["correction_factor"], rel=1e-9)
    assert "correction_factor" not in simplified or simplified["correction_factor"] is None


def test_every_method_of_the_five_runs_together_on_a_circle():
    methods = ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]
    results = by_method(opengeoslide.analyze(v03_model(methods)))
    assert list(results) == methods
    assert all(r["status"] == "converged" for r in results.values())


# ---------------------------------------------------------------- aviso de E13k

def d1_model(points: list[list[float]], methods: list[str]) -> dict:
    """Las polilíneas de D-1 (docs/fase3/d1): talud de 10 m en V, espejo del generador, como en `e13k_interslice_shear.rs`."""
    pts = [[-x, y] for x, y in reversed(points)]
    return {
        "format": "opengeoslide", "version": "0.3", "meta": {"id": "d1"}, "units": "SI",
        "materials": [{"id": "suelo", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 20.0,
                       "cohesion": 10.0, "friction_angle": 30.0}],
        "regions": [{"material": "suelo",
                     "polygon": [[0.0, -10.0], [-40.0, -10.0], [-40.0, 0.0], [-20.0, 0.0], [-10.0, 10.0], [0.0, 10.0]]}],
        "slope": {"direction": "right_to_left"},
        "analysis": {"methods": methods, "slices": 50, "tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2,
                     "surface": {"type": "polyline", "points": pts}, "interslice": {"function": "constant"}},
    }


def test_e13k_warns_when_the_interslice_shear_exceeds_the_strength_of_the_faces():
    """D-1 A: Spencer and M-P converge to an FS of about 130 (r_v = 122) while Janbu gives about 5; cSlope has no solution."""
    model = d1_model([[9.63, 9.95], [21.796, -2.571], [26.067, -0.05]], ["spencer", "morgenstern_price", "janbu_simplified"])
    results = by_method(opengeoslide.analyze(model))
    for method in ("spencer", "morgenstern_price"):
        assert results[method]["status"] == "converged"
        assert WARNING_E13K in results[method]["warnings"], method
    janbu = results["janbu_simplified"]
    assert WARNING_E13K not in janbu["warnings"]
    assert results["spencer"]["fos"] > 10 * janbu["fos"]


def test_e13k_does_not_warn_on_the_reference_models():
    for model in (v03_model(["spencer", "morgenstern_price"]),
                  v03_model(["spencer", "morgenstern_price"], {"type": "polyline", "points": V047A_POLYLINE})):
        for result in opengeoslide.analyze(model)["results"]:
            assert WARNING_E13K not in result["warnings"], result["method"]
