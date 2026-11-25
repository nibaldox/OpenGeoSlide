"""Tests for the ogs -> cSlope converter (run with pytest, see README.md)."""

from __future__ import annotations

import json
import os
import sys

import pytest
from shapely.geometry import Point, Polygon

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from to_cslope import (  # noqa: E402
    UnsupportedModel,
    circle_from_plane,
    interior_boundaries,
    regions_of,
    ogs_to_cslope,
    piezo_from_water_table,
    plane_from_circle,
    resolve_direction,
    water_table_from_piezo,
    outline_of,
)

FIXTURE = os.path.join(HERE, "fixtures", "V047a.json")


def _material(mid: str, gamma: float = 18.0, **extra) -> dict:
    base = {"id": mid, "name": mid, "model": "mohr_coulomb", "unit_weight": gamma,
            "unit_weight_sat": None, "cohesion": 5.0, "friction_angle": 30.0, "ru": None}
    base.update(extra)
    return base


def stacked_model(**overrides) -> dict:
    """Two rectangles stacked on each other: fill above clay, one shared edge at y=10."""
    model = {
        "format": "opengeoslide", "version": "0.1", "meta": {"id": "T-stacked"}, "units": "SI",
        "materials": [_material("fill", 18.0), _material("clay", 17.0)],
        "regions": [
            {"material": "fill", "polygon": [[0, 10], [0, 15], [40, 15], [40, 10]]},
            {"material": "clay", "polygon": [[0, 0], [0, 10], [40, 10], [40, 0]]},
        ],
        "slope": {"direction": "left_to_right"},
        "analysis": {"methods": ["bishop"], "slices": 50,
                     "surface": {"type": "circle", "xc": 20.0, "yc": 20.0, "r": 15.0}},
    }
    model.update(overrides)
    return model


def _check(kind: str = "fixed", method: str = "bishop") -> dict:
    return {"method": method, "kind": kind, "published": 1.0, "tolerance": 0.05}


def test_stacked_regions_give_one_outline_one_boundary_two_assignments():
    model = stacked_model()
    doc = ogs_to_cslope(model, _check()).document
    d = doc["definition"]

    # one outline: the 40 x 15 rectangle, area 600
    outline = Polygon(d["coordinates"])
    assert outline.is_valid
    assert outline.area == pytest.approx(600.0)
    assert outline.bounds == pytest.approx((0.0, 0.0, 40.0, 15.0))

    # one interior boundary: the shared edge y = 10, from x = 0 to x = 40
    assert len(d["materialBoundaries"]) == 1
    edge = d["materialBoundaries"][0]["coordinates"]
    assert {tuple(p) for p in (edge[0], edge[-1])} == {(0.0, 10.0), (40.0, 10.0)}
    assert all(abs(y - 10.0) < 1e-12 for _, y in edge)

    # two assignments, each at an interior point of its own region
    assigns = {a["materialName"]: a["point"] for a in d["regionAssignments"]}
    assert set(assigns) == {"fill", "clay"}
    assert 10.0 < assigns["fill"][1] < 15.0
    assert 0.0 < assigns["clay"][1] < 10.0
    assert Polygon([(0, 10), (0, 15), (40, 15), (40, 10)]).contains(Point(assigns["fill"]))
    assert Polygon([(0, 0), (0, 10), (40, 10), (40, 0)]).contains(Point(assigns["clay"]))


def test_interior_boundaries_empty_for_single_region():
    model = stacked_model(regions=[{"material": "fill", "polygon": [[0, 0], [0, 15], [40, 15], [40, 0]]}])
    polys = regions_of(model)
    assert interior_boundaries(polys) == []
    d = ogs_to_cslope(model, _check()).document["definition"]
    assert "materialBoundaries" not in d
    assert [a["materialName"] for a in d["regionAssignments"]] == ["fill"]


def test_piezometric_line_round_trip():
    pts = [[0.0, 12.0], [40.0, 6.0], [55.0, 6.0]]
    wt = water_table_from_piezo(pts)
    assert wt["mode"] == "custom"
    assert wt["freeWater"] is False
    assert piezo_from_water_table(wt) == pts


def test_piezometric_line_is_sorted_left_to_right():
    wt = water_table_from_piezo([[40.0, 6.0], [0.0, 12.0]])
    assert piezo_from_water_table(wt) == [[0.0, 12.0], [40.0, 6.0]]


def test_fixed_circle_round_trip():
    circle = {"type": "circle", "xc": 120.0, "yc": 90.0, "r": 80.0}
    plane = plane_from_circle(circle)
    assert plane == {"cx": 120.0, "cy": 90.0, "radius": 80.0}
    assert circle_from_plane(plane) == circle


def test_fixed_check_uses_custom_plane_only():
    model = stacked_model(analysis={"methods": ["bishop"], "slices": 50,
                                    "surface": {"type": "circle", "xc": 20.0, "yc": 20.0, "r": 15.0}})
    doc = ogs_to_cslope(model, _check("fixed")).document
    assert doc["definition"]["customPlanesOnly"] is True
    assert doc["definition"]["customSearchPlanes"] == [{"cx": 20.0, "cy": 20.0, "radius": 15.0}]
    assert "analysisLimits" not in doc["definition"]


def test_ru_with_piezometric_line_and_saturated_weight_is_refused():
    model = stacked_model(
        materials=[_material("fill", 18.0, unit_weight_sat=19.0, ru=0.2), _material("clay", 17.0)],
        water={"unit_weight": 9.81, "piezometric_line": [[0, 5.0], [40, 5.0]]},
    )
    with pytest.raises(UnsupportedModel):
        ogs_to_cslope(model, _check("fixed"))


def test_ru_with_piezometric_line_uses_dry_water_line():
    model = stacked_model(
        materials=[_material("fill", 18.0, ru=0.2), _material("clay", 17.0)],
        water={"unit_weight": 9.81, "piezometric_line": [[0, 5.0], [40, 5.0]]},
    )
    conv = ogs_to_cslope(model, _check("fixed"))
    mats = {m["name"]: m for m in conv.document["definition"]["materials"]}
    assert mats["fill"]["model"]["ru"] == 0.2
    assert mats["fill"]["waterTableId"] == "ogs-ru-no-water"
    assert "waterTableId" not in mats["clay"]
    assert conv.document["definition"]["waterTables"][0]["id"] == "ogs-ru-no-water"
    assert any("gamma_w" in n for n in conv.notes)


def test_fixture_converts_with_expected_mapping():
    with open(FIXTURE, encoding="utf-8") as fh:
        case = json.load(fh)
    ch = case["checks"][0]
    conv = ogs_to_cslope(case["model"], ch)
    d, o = conv.document["definition"], conv.document["options"]
    assert conv.orientation == "rtl"          # y_top(20)=25 is not > y_top(70)=35
    assert d["orientation"] == "rtl"
    assert d["analysisLimits"] == {"entryLeftX": 49.9, "entryRightX": 55.2,
                                   "exitLeftX": 26.9, "exitRightX": 30.2}
    assert d["waterTable"]["value"] == [[0.0, 12.0], [40.0, 6.0], [55.0, 6.0]]
    assert o["method"] == "Bishop" and o["slices"] == 50 and o["searchMethod"] == "circular"
    assert o["compositeSurfaces"] is False


def test_spencer_maps_to_morgenstern_price_constant():
    with open(FIXTURE, encoding="utf-8") as fh:
        case = json.load(fh)
    o = ogs_to_cslope(case["model"], {"method": "spencer", "kind": "search"}).document["options"]
    assert o["method"] == "Morgenstern-Price"
    assert o["intersliceFunction"] == "constant"


def test_fixture_document_is_valid_for_cslope():
    cs = pytest.importorskip("cslope")
    with open(FIXTURE, encoding="utf-8") as fh:
        case = json.load(fh)
    for method in ("bishop", "spencer"):
        doc = ogs_to_cslope(case["model"], {"method": method, "kind": "search"}).document
        errors = [i for i in cs.validate(doc) if i["severity"] == "error"]
        assert errors == [], errors


# ------------------------------------------------ direction (E1 / E1b, R2-05)

def _dam_model(direction: str = "auto", search: dict | None = None, surface: dict | None = None) -> dict:
    """Symmetric dam: both toes at y = 0, crest from x = 20 to x = 30 at y = 10."""
    analysis: dict = {"methods": ["bishop"], "slices": 50}
    if search is not None:
        analysis["search"] = search
    if surface is not None:
        analysis["surface"] = surface
    return {
        "format": "opengeoslide", "version": "0.1", "meta": {"id": "T-dam"}, "units": "SI",
        "materials": [_material("dam", 18.0)],
        "regions": [{"material": "dam", "polygon": [[0, -5], [0, 0], [20, 10], [30, 10], [50, 0], [50, -5]]}],
        "slope": {"direction": direction},
        "analysis": analysis,
    }


def _dam_outline() -> Polygon:
    return outline_of(regions_of(_dam_model()))


def _search(entry: list, exit_: list) -> dict:
    return {"type": "circular_entry_exit", "entry": entry, "exit": exit_}


def test_e1_ranges_midpoints_give_the_direction():
    outline = _dam_outline()
    to_right = _dam_model(search=_search([5, 15], [35, 45]))
    to_left = _dam_model(search=_search([35, 45], [5, 15]))
    assert resolve_direction(to_right, outline, "search") == "ltr"
    assert resolve_direction(to_left, outline, "search") == "rtl"


def test_e1b_equal_midpoints_fall_through_and_fail_on_symmetric_dam():
    # Midpoints 25 and 25: E1b sends the decision to rule 2, which is a tie on this dam.
    model = _dam_model(search=_search([20, 30], [15, 35]))
    with pytest.raises(UnsupportedModel):
        resolve_direction(model, _dam_outline(), "search")


def test_e1_crest_rule_uses_the_higher_end():
    # Asymmetric slope: y_top(0) = 15 > y_top(50) = 0, so the mass moves towards +x.
    model = _dam_model()
    model["regions"] = [{"material": "dam", "polygon": [[0, -5], [0, 15], [20, 15], [50, 0], [50, -5]]}]
    outline = outline_of(regions_of(model))
    assert resolve_direction(model, outline) == "ltr"
    model["regions"][0]["polygon"] = [[0, -5], [0, 0], [50, 15], [50, -5]]  # crest on the right
    assert resolve_direction(model, outline_of(regions_of(model))) == "rtl"


def test_e1_fixed_circle_higher_crossing_is_the_entry():
    # Circle (30, 40, 32) crosses the left face at y = 9.76 and the right face at y = 8.20:
    # the entry is on the left and the mass moves to +x.
    right = _dam_model(surface={"type": "circle", "xc": 30.0, "yc": 40.0, "r": 32.0})
    assert resolve_direction(right, _dam_outline(), "fixed") == "ltr"
    # Its mirror image (x -> 50 - x) crosses the other way.
    left = _dam_model(surface={"type": "circle", "xc": 20.0, "yc": 40.0, "r": 32.0})
    assert resolve_direction(left, _dam_outline(), "fixed") == "rtl"


def test_e1_fixed_circle_tie_is_undetermined():
    # Circle (25, 40, 35) crosses both faces at the same height: rule 4.
    model = _dam_model(surface={"type": "circle", "xc": 25.0, "yc": 40.0, "r": 35.0})
    with pytest.raises(UnsupportedModel, match="slope.direction"):
        resolve_direction(model, _dam_outline(), "fixed")
    with pytest.raises(UnsupportedModel):
        ogs_to_cslope(model, {"method": "bishop", "kind": "fixed", "published": 1.0, "tolerance": 0.05})


def test_e1_explicit_direction_always_wins():
    model = _dam_model(direction="right_to_left", search=_search([5, 15], [35, 45]))
    assert resolve_direction(model, _dam_outline(), "search") == "rtl"


def test_e1_search_check_ignores_the_fixed_surface():
    # Search present: ogs-core ignores analysis.surface, so rule 3 must not decide.
    model = _dam_model(search=_search([20, 30], [15, 35]),
                       surface={"type": "circle", "xc": 30.0, "yc": 40.0, "r": 32.0})
    with pytest.raises(UnsupportedModel):
        resolve_direction(model, _dam_outline(), "search")


# ----------------------------------------- water and units (R2-05, imperial)

def test_imperial_piezometric_line_with_62_4_is_refused():
    model = stacked_model(units="imperial",
                          water={"unit_weight": 62.4, "piezometric_line": [[0, 5.0], [40, 5.0]]})
    with pytest.raises(UnsupportedModel, match="waterUnitWeight"):
        ogs_to_cslope(model, _check("fixed"))


def test_piezometric_line_with_other_water_weight_is_refused():
    model = stacked_model(water={"unit_weight": 10.0, "piezometric_line": [[0, 5.0], [40, 5.0]]})
    with pytest.raises(UnsupportedModel):
        ogs_to_cslope(model, _check("fixed"))


def test_piezometric_line_with_9_81_converts_and_notes_the_si_unit():
    model = stacked_model(water={"unit_weight": 9.81, "piezometric_line": [[0, 5.0], [40, 5.0]]})
    conv = ogs_to_cslope(model, _check("fixed"))
    assert any("kN/m3" in n and "9.807" in n for n in conv.notes)


def test_imperial_water_weight_near_cslope_number_notes_pcf():
    model = stacked_model(units="imperial",
                          water={"unit_weight": 9.81, "piezometric_line": [[0, 5.0], [40, 5.0]]})
    conv = ogs_to_cslope(model, _check("fixed"))
    assert any("pcf" in n for n in conv.notes) and not any("kN/m3" in n for n in conv.notes)


def test_imperial_model_without_water_converts():
    model = stacked_model(units="imperial")
    conv = ogs_to_cslope(model, _check("fixed"))
    assert "waterTable" not in conv.document["definition"]


def test_min_m_alpha_note_also_for_spencer():
    model = stacked_model(analysis={"methods": ["spencer"], "slices": 50, "min_m_alpha": 0.3,
                                    "surface": {"type": "circle", "xc": 20.0, "yc": 20.0, "r": 15.0}})
    conv = ogs_to_cslope(model, {"method": "spencer", "kind": "fixed", "published": 1.0, "tolerance": 0.05})
    assert any("min_m_alpha" in n for n in conv.notes)


# ------------------------------------------- seismic coefficients and loads (schema v0.2)

V047A_CIRCLE = {"type": "circle", "xc": 29.54334963719809, "yc": 53.63784815923435,
                "r": 28.641487934160704}


def v047a_fixed(mirror: bool = False, **extra) -> dict:
    """V047a with the fixed circle of its Bishop search (the X1 experiment), version 0.2.

    ``mirror=False`` is the original right-to-left geometry. ``mirror=True`` is its mirror image
    (x -> -x, left_to_right).
    """
    sign = -1.0 if mirror else 1.0
    circle = dict(V047A_CIRCLE, xc=sign * V047A_CIRCLE["xc"])
    polygon = [[sign * x, y] for x, y in [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]]]
    model = {
        "format": "opengeoslide", "version": "0.2", "meta": {"id": "T-v047a"}, "units": "SI",
        "materials": [_material("soil", 20.0, cohesion=3.0, friction_angle=19.6)],
        "regions": [{"material": "soil", "polygon": polygon}],
        "slope": {"direction": "left_to_right" if mirror else "right_to_left"},
        "analysis": {"methods": ["bishop"], "slices": 50, "tolerance": 1e-5, "max_iterations": 500,
                     "min_m_alpha": 0.2, "surface": circle},
    }
    model.update(extra)
    return model


def _with(model: dict, *, seismic=None, loads=None) -> dict:
    model = json.loads(json.dumps(model))
    if seismic is not None:
        model["analysis"]["seismic"] = seismic
    if loads is not None:
        model["loads"] = loads
    return model


def _mapped(model: dict, method: str = "bishop") -> dict:
    return ogs_to_cslope(model, {"method": method, "kind": "fixed"}).document


def test_seismic_maps_to_options_and_zero_is_omitted():
    opts = _mapped(_with(v047a_fixed(), seismic={"kh": 0.1, "kv": -0.05}))["options"]
    assert opts["seismicHorizontal"] == 0.1 and opts["seismicVertical"] == -0.05
    opts = _mapped(_with(v047a_fixed(), seismic={"kh": 0.2, "kv": 0.0}))["options"]
    assert opts["seismicHorizontal"] == 0.2 and "seismicVertical" not in opts
    for seismic in ({"kh": 0.0, "kv": 0.0}, {}, {"kh": 0}):
        opts = _mapped(_with(v047a_fixed(), seismic=seismic))["options"]
        assert "seismicHorizontal" not in opts and "seismicVertical" not in opts
    opts = _mapped(v047a_fixed())["options"]
    assert "seismicHorizontal" not in opts and "seismicVertical" not in opts


def test_seismic_is_the_same_for_both_orientations_and_for_spencer():
    for mirror in (False, True):
        for method in ("bishop", "spencer"):
            d = _mapped(_with(v047a_fixed(mirror), seismic={"kh": 0.1, "kv": 0.05}), method)
            assert d["options"]["seismicHorizontal"] == 0.1
            assert d["options"]["seismicVertical"] == 0.05


@pytest.mark.parametrize("seismic, match", [
    ({"kh": 1.0}, r"kh debe estar en \[0, 1\)"),
    ({"kh": -0.1}, r"kh debe estar en \[0, 1\)"),
    ({"kv": 1.0}, r"kv debe estar en \(-1, 1\)"),
    ({"kv": -1.0}, r"kv debe estar en \(-1, 1\)"),
    ({"kh": float("nan")}, "finito"),
    ({"kh": float("inf")}, "finito"),
    ({"kh": "0.1"}, "finito"),
    ({"kx": 0.1}, "desconocidos"),
])
def test_seismic_out_of_range_or_malformed_is_refused(seismic, match):
    with pytest.raises(UnsupportedModel, match=match):
        _mapped(_with(v047a_fixed(), seismic=seismic))


def test_loads_map_to_udls_and_line_loads():
    loads = [
        {"type": "udl", "id": "u1", "x1": 50.0, "x2": 70.0, "q": 20.0},
        {"type": "line", "id": "l1", "x": 40.0, "p": 20.0, "angle": 10.0},
        {"type": "udl", "x1": 20.0, "x2": 30.0, "q": 5.0},
        {"type": "line", "x": 45.0, "p": 8.0},
    ]
    d = _mapped(_with(v047a_fixed(), loads=loads))["definition"]
    # no `id`: cslope 0.1.0 reports it as an unknown key
    assert d["udls"] == [
        {"magnitude": 20.0, "x1": 50.0, "x2": 70.0, "direction": "vertical"},
        {"magnitude": 5.0, "x1": 20.0, "x2": 30.0, "direction": "vertical"},
    ]
    assert d["lineLoads"] == [
        {"x": 40.0, "magnitude": 20.0, "angle": 10.0},
        {"x": 45.0, "magnitude": 8.0, "angle": 0.0},
    ]
    d = _mapped(v047a_fixed())["definition"]
    assert "udls" not in d and "lineLoads" not in d


def test_line_load_angle_goes_through_unchanged_in_both_orientations():
    load = {"type": "line", "id": "l1", "x": 40.0, "p": 20.0, "angle": 10.0}
    for mirror in (False, True):
        x = -40.0 if mirror else 40.0
        d = _mapped(_with(v047a_fixed(mirror), loads=[dict(load, x=x)]))["definition"]
        assert d["lineLoads"][0]["angle"] == 10.0 and d["lineLoads"][0]["x"] == x
        assert d["orientation"] == ("ltr" if mirror else "rtl")


def test_zero_loads_are_omitted_with_a_note():
    loads = [{"type": "udl", "id": "u0", "x1": 50.0, "x2": 70.0, "q": 0.0},
             {"type": "line", "id": "l0", "x": 40.0, "p": 0.0, "angle": 5.0}]
    conv = ogs_to_cslope(_with(v047a_fixed(), loads=loads), _check("fixed"))
    assert "udls" not in conv.document["definition"] and "lineLoads" not in conv.document["definition"]
    assert any("u0" in n for n in conv.notes) and any("l0" in n for n in conv.notes)


@pytest.mark.parametrize("loads, match", [
    ([{"type": "udl", "id": "u", "x1": 70.0, "x2": 50.0, "q": 1.0}], "x1 >= x2"),
    ([{"type": "udl", "id": "u", "x1": 50.0, "x2": 50.0, "q": 1.0}], "x1 >= x2"),
    ([{"type": "udl", "id": "u", "x1": 50.0, "x2": 70.0, "q": -1.0}], "q < 0"),
    ([{"type": "line", "id": "l", "x": 40.0, "p": -1.0, "angle": 0.0}], "p < 0"),
    ([{"type": "line", "id": "l", "x": 40.0, "p": 1.0, "angle": 91.0}], "angle fuera"),
    ([{"type": "line", "id": "l", "x": 40.0, "p": 1.0, "angle": -90.5}], "angle fuera"),
    ([{"type": "udl", "id": "a", "x1": 1.0, "x2": 2.0, "q": 1.0},
      {"type": "udl", "id": "a", "x1": 3.0, "x2": 4.0, "q": 1.0}], "repetido"),
    ([{"type": "patch", "id": "p"}], "no soportado"),
    ([{"type": "udl", "id": "u", "x1": 1.0, "x2": 2.0, "q": 1.0, "direction": "normal"}], "desconocidos"),
    ([{"type": "udl", "id": "u", "x1": 1.0, "x2": 2.0, "q": float("nan")}], "finito"),
])
def test_invalid_loads_are_refused(loads, match):
    with pytest.raises(UnsupportedModel, match=match):
        _mapped(_with(v047a_fixed(), loads=loads))


def test_loads_and_seismic_need_version_0_2():
    loads = [{"type": "udl", "id": "u", "x1": 50.0, "x2": 70.0, "q": 20.0}]
    for kwargs in ({"loads": loads}, {"seismic": {"kh": 0.1, "kv": 0.0}}):
        model = _with(v047a_fixed(), **kwargs)
        model["version"] = "0.1"
        with pytest.raises(UnsupportedModel, match='requieren version "0.2"'):
            _mapped(model)
    # a v0.1 model without the new fields converts exactly as before
    model = v047a_fixed()
    model["version"] = "0.1"
    d = _mapped(model)
    assert "udls" not in d["definition"] and "seismicHorizontal" not in d["options"]


def test_v0_1_document_is_identical_to_v0_2_without_the_new_fields():
    a, b = v047a_fixed(), v047a_fixed()
    a["version"] = "0.1"
    assert _mapped(a) == _mapped(b)


# --- the oracle: angle convention (ltr and rtl), seismic and udl, mirror symmetry (cslope 0.1.0)

def _fos(cs, model: dict, method: str = "bishop") -> float:
    doc = _mapped(model, method)
    errors = [i for i in cs.validate(doc) if i.get("severity") == "error"]
    assert not errors, errors
    return cs.analyse(doc)["minFOS"]


def _mirror_load(load: dict) -> dict:
    out = dict(load)
    if "x" in out:
        out["x"] = -out["x"]
        out["angle"] = -out.get("angle", 0.0)
    else:
        out["x1"], out["x2"] = -load["x2"], -load["x1"]
    return out


LINE = {"type": "line", "id": "l1", "x": 40.0, "p": 20.0, "angle": 0.0}


def test_oracle_line_load_angle_convention_in_both_orientations():
    cs = pytest.importorskip("cslope")
    rtl_base = _fos(cs, v047a_fixed())
    ltr_base = _fos(cs, v047a_fixed(True))
    assert rtl_base == pytest.approx(ltr_base, rel=1e-9)
    assert rtl_base == pytest.approx(0.9850842466548518, rel=1e-9)

    def fos(mirror: bool, angle: float) -> float:
        load = dict(LINE, angle=angle)
        load = _mirror_load(load) if mirror else load
        # `_mirror_load` flips the sign for the mirror image; undo it to express the angle in the model frame.
        if mirror:
            load["angle"] = angle
        return _fos(cs, _with(v047a_fixed(mirror), loads=[load]))

    rtl = {a: fos(False, a) for a in (0.0, 10.0, -10.0)}
    ltr = {a: fos(True, a) for a in (0.0, 10.0, -10.0)}
    # reference values: oracle output quoted in the module docstring
    assert rtl[0.0] == pytest.approx(0.9836208911149462, rel=1e-9)
    assert rtl[10.0] == pytest.approx(0.9920950618992327, rel=1e-9)
    assert rtl[-10.0] == pytest.approx(0.9753135037279751, rel=1e-9)
    assert ltr[0.0] == pytest.approx(0.9836208911149332, rel=1e-9)
    assert ltr[10.0] == pytest.approx(0.9753135037279624, rel=1e-9)
    assert ltr[-10.0] == pytest.approx(0.9920950618992197, rel=1e-9)
    # direction of the effect: +x against the sliding raises F, along the sliding lowers it
    assert rtl[10.0] > rtl[0.0] > rtl[-10.0]
    assert ltr[10.0] < ltr[0.0] < ltr[-10.0]
    # mirror symmetry: x -> -x, ltr, and the angle with the opposite sign give the same F
    for angle in (10.0, -10.0):
        assert ltr[-angle] == pytest.approx(rtl[angle], rel=1e-9)


def test_oracle_seismic_and_udl_are_mirror_symmetric():
    cs = pytest.importorskip("cslope")
    base = _fos(cs, v047a_fixed())
    for seismic in ({"kh": 0.1, "kv": 0.0}, {"kh": 0.0, "kv": 0.1}, {"kh": 0.0, "kv": -0.1}):
        a = _fos(cs, _with(v047a_fixed(), seismic=seismic))
        b = _fos(cs, _with(v047a_fixed(True), seismic=seismic))
        assert a == pytest.approx(b, rel=1e-9), seismic
    kh = _fos(cs, _with(v047a_fixed(), seismic={"kh": 0.1, "kv": 0.0}))
    kv_down = _fos(cs, _with(v047a_fixed(), seismic={"kh": 0.0, "kv": 0.1}))
    kv_up = _fos(cs, _with(v047a_fixed(), seismic={"kh": 0.0, "kv": -0.1}))
    assert kh == pytest.approx(0.7905926841940195, rel=1e-4)   # X1 §2.2 T1
    assert kv_down < base < kv_up                                 # kv > 0 is downward: heavier, lower F
    udl = {"type": "udl", "id": "u1", "x1": 50.0, "x2": 70.0, "q": 20.0}
    a = _fos(cs, _with(v047a_fixed(), loads=[udl]))
    b = _fos(cs, _with(v047a_fixed(True), loads=[_mirror_load(udl)]))
    assert a == pytest.approx(b, rel=1e-9)
    assert a == pytest.approx(0.9590357325570893, rel=1e-4)    # X1 §2.2 T4
    assert a < base
    # Spencer (Morgenstern-Price with a constant function) also accepts the fields
    sp0 = _fos(cs, v047a_fixed(), "spencer")
    sp = _fos(cs, _with(v047a_fixed(), seismic={"kh": 0.1, "kv": 0.0}), "spencer")
    sp_ltr = _fos(cs, _with(v047a_fixed(True), seismic={"kh": 0.1, "kv": 0.0}), "spencer")
    assert sp < sp0 and sp == pytest.approx(sp_ltr, rel=1e-9)
    assert sp == pytest.approx(0.7909056976112471, rel=5e-4)   # X1 §2.2 T1 MP-constante (other options)
