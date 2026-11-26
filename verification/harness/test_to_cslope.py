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


# --- schema v0.3 (contract F3.8): undrained, polyline, Morgenstern-Price and Janbu

V047A_POLYLINE = [[30, 25.000001], [35, 25.520953], [40, 26.973391], [45, 29.525055], [51.29111842105263, 35.0]]


def v03_model(**analysis) -> dict:
    """V047a fixed circle as a v0.3 model; `analysis` entries replace the ones of the circle model."""
    model = v047a_fixed()
    model["version"] = "0.3"
    model["analysis"].update(analysis)
    return model


def _undrained(model: dict, **fields) -> dict:
    mat = model["materials"][0]
    mat.pop("cohesion"), mat.pop("friction_angle")
    mat.update(model="undrained", undrained_strength=25.0, **fields)
    return model


def _doc(model: dict, method: str, kind: str = "fixed", **options) -> dict:
    return ogs_to_cslope(model, {"method": method, "kind": kind, "options": options}).document


def test_undrained_maps_to_cslope_undrained_without_gradient():
    d = _doc(_undrained(v03_model()), "bishop")["definition"]
    assert d["materials"][0]["model"] == {"kind": "undrained", "unitWeight": 20.0, "undrainedShearStrength": 25.0}


def test_undrained_gradient_datum_and_limit_map_to_surefdepth_surateofchange_sumax():
    model = _undrained(v03_model(), strength_datum=35.0, strength_gradient=1.5, strength_limit=60.0)
    model["materials"][0]["undrained_strength"] = 10.0
    mdl = _doc(model, "bishop")["definition"]["materials"][0]["model"]
    assert mdl == {"kind": "undrained", "unitWeight": 20.0, "undrainedShearStrength": 10.0,
                   "suRefDepth": 35.0, "suRateOfChange": 1.5, "suMax": 60.0}


def test_undrained_keeps_unit_weight_sat_and_ru_like_mohr_coulomb():
    model = _undrained(v03_model())
    model["materials"][0].update(unit_weight_sat=21.0, ru=0.2)
    mdl = _doc(model, "bishop")["definition"]["materials"][0]["model"]
    assert mdl["unitWeightSat"] == 21.0 and mdl["ru"] == 0.2


@pytest.mark.parametrize("fields, match", [
    ({"strength_datum": 35.0}, "van juntos"),
    ({"strength_gradient": 1.0, "strength_datum": None}, "van juntos"),
    ({"strength_limit": 50.0}, "sin strength_gradient"),
    ({"undrained_strength": float("nan")}, "finito"),
    ({"bogus": 1}, "desconocidos"),
])
def test_undrained_with_inconsistent_fields_is_refused(fields, match):
    model = _undrained(v03_model())
    model["materials"][0].update(fields)
    with pytest.raises(UnsupportedModel, match=match):
        _doc(model, "bishop")


def test_polyline_maps_to_customsurfaces_with_customplanesonly_and_no_axis():
    model = v03_model(surface={"type": "polyline", "points": V047A_POLYLINE})
    d = _doc(model, "spencer")["definition"]
    assert d["customSurfaces"] == [{"points": [[float(x), float(y)] for x, y in V047A_POLYLINE]}]
    assert d["customPlanesOnly"] is True and "customSearchPlanes" not in d


def test_polyline_with_x_not_increasing_is_refused():
    model = v03_model(surface={"type": "polyline", "points": [[30, 25], [30, 26], [40, 27]]})
    with pytest.raises(UnsupportedModel, match="strictly increasing"):
        _doc(model, "spencer")


def test_bishop_on_a_polyline_is_refused_like_the_engine_does():
    model = v03_model(surface={"type": "polyline", "points": V047A_POLYLINE})
    with pytest.raises(UnsupportedModel, match="solo admite superficies circulares"):
        _doc(model, "bishop")


def test_direction_of_a_fixed_polyline_is_its_higher_end_to_its_lower_end():
    model = v03_model(surface={"type": "polyline", "points": V047A_POLYLINE})
    model["slope"] = {"direction": "auto"}
    d = _doc(model, "spencer")
    assert d["definition"]["orientation"] == "rtl"            # the right end (y = 35) is the entry


@pytest.mark.parametrize("function, expected", [
    ("constant", "constant"), ("half_sine", "half-sine"), ("clipped_sine", "clipped-sine"),
    ("trapezoidal", "trapezoidal"),
])
def test_morgenstern_price_functions_map_to_kebab_case(function, expected):
    model = v03_model(methods=["morgenstern_price"], interslice={"function": function})
    doc = _doc(model, "morgenstern_price")
    assert doc["options"]["method"] == "Morgenstern-Price" and doc["options"]["intersliceFunction"] == expected
    assert "intersliceDataPoints" not in doc["options"]


def test_morgenstern_price_data_points_and_default_function():
    pts = [[0.0, 0.0], [0.5, 1.0], [1.0, 0.0]]
    model = v03_model(methods=["morgenstern_price"], interslice={"function": "data_points", "points": pts})
    opts = _doc(model, "morgenstern_price")["options"]
    assert opts["intersliceFunction"] == "data-point-specified" and opts["intersliceDataPoints"] == pts
    # without `interslice` the function is half_sine (F3.4), cSlope's default
    assert _doc(v03_model(methods=["morgenstern_price"]), "morgenstern_price")["options"][
        "intersliceFunction"] == "half-sine"
    # a check can carry its own function (the importer writes one per model, but the converter is general)
    opts = _doc(model, "morgenstern_price", interslice={"function": "constant"})["options"]
    assert opts["intersliceFunction"] == "constant"


@pytest.mark.parametrize("interslice, match", [
    ({"function": "parabolic"}, "desconocida"),
    ({"function": "data_points"}, "al menos 2 puntos"),
    ({"function": "half_sine", "points": [[0, 1], [1, 1]]}, "solo se admite con data_points"),
])
def test_invalid_interslice_is_refused(interslice, match):
    with pytest.raises(UnsupportedModel, match=match):
        _doc(v03_model(methods=["morgenstern_price"], interslice=interslice), "morgenstern_price")


def test_spencer_is_still_morgenstern_price_with_a_constant_function():
    opts = _doc(v03_model(), "spencer")["options"]
    assert opts["method"] == "Morgenstern-Price" and opts["intersliceFunction"] == "constant"


def test_janbu_maps_to_janbu_with_the_correction_flag():
    simple = _doc(v03_model(), "janbu_simplified")["options"]
    corrected = _doc(v03_model(), "janbu_corrected")["options"]
    assert simple["method"] == corrected["method"] == "Janbu"
    assert simple["janbuCorrection"] is False and corrected["janbuCorrection"] is True
    assert "intersliceFunction" not in simple


def test_v0_3_fields_need_version_0_3_and_name_the_first_one():
    cases = [
        (lambda m: _undrained(m), "bishop", 'model: "undrained" requiere version "0.3"'),
        (lambda m: m["analysis"].update(surface={"type": "polyline", "points": V047A_POLYLINE}), "spencer",
         'surface.type: "polyline" requiere version "0.3"'),
        (lambda m: None, "morgenstern_price", "methods: morgenstern_price requiere version"),
        (lambda m: None, "janbu_corrected", "methods: janbu_corrected requiere version"),
    ]
    for mutate, method, match in cases:
        model = v03_model(methods=[method])
        mutate(model)
        model["version"] = "0.2"
        with pytest.raises(UnsupportedModel, match=match):
            _doc(model, method)
    old = v047a_fixed()
    assert _doc(old, "bishop")["options"]["method"] == "Bishop"      # 0.1 / 0.2 without v0.3 fields: as before


def test_v0_3_loads_and_seismic_are_accepted():
    model = _with(v03_model(), seismic={"kh": 0.1, "kv": 0.0})
    assert _doc(model, "spencer")["options"]["seismicHorizontal"] == 0.1


# --- the oracle reproduces the F3.8 values (cslope 0.1.0, 50 slices, tolerance 1e-5; reproduced by the coordinator)

ORACLE_CIRCLE = [
    ("M-P constant", "spencer", None, 0.9841002710),
    ("M-P half_sine", "morgenstern_price", None, 0.9840779260),
    ("Janbu simplificado", "janbu_simplified", None, 0.9452285578),
    ("Janbu corregido", "janbu_corrected", None, 0.9883537594),
]
ORACLE_POLYLINE = [
    ("M-P constant", "spencer", 0.9991304877),
    ("M-P half_sine", "morgenstern_price", 0.9999384297),
    ("Janbu corregido", "janbu_corrected", 0.9993458659),
]


def _oracle_fos(cs, model: dict, method: str) -> float:
    doc = _doc(model, method)
    errors = [i for i in cs.validate(doc) if i.get("severity") == "error"]
    assert not errors, errors
    result = cs.analyse(doc)
    assert result["criticalSurface"].get("converged", True), (method, result["criticalSurface"])
    return result["minFOS"]


@pytest.mark.parametrize("name, method, interslice, expected", ORACLE_CIRCLE)
def test_oracle_circle_values_of_f3_8(name, method, interslice, expected):
    cs = pytest.importorskip("cslope")
    model = v03_model(methods=[method])
    assert _oracle_fos(cs, model, method) == pytest.approx(expected, rel=1e-9), name


@pytest.mark.parametrize("name, method, expected", ORACLE_POLYLINE)
def test_oracle_polyline_values_of_f3_8(name, method, expected):
    cs = pytest.importorskip("cslope")
    model = v03_model(methods=[method], surface={"type": "polyline", "points": V047A_POLYLINE})
    assert _oracle_fos(cs, model, method) == pytest.approx(expected, rel=1e-9), name


def test_oracle_undrained_values_of_f3_8():
    cs = pytest.importorskip("cslope")
    constant = _undrained(v03_model())
    assert _oracle_fos(cs, constant, "bishop") == pytest.approx(1.5697595025, rel=1e-9)
    linear = _undrained(v03_model(), strength_datum=35.0, strength_gradient=1.0)
    linear["materials"][0]["undrained_strength"] = 10.0
    assert _oracle_fos(cs, linear, "bishop") == pytest.approx(1.0373275799, rel=1e-9)
    # the limit does not bite here (X11 1.2): a limit of 22 leaves the value as it is
    limited = _undrained(v03_model(), strength_datum=35.0, strength_gradient=1.0, strength_limit=22.0)
    limited["materials"][0]["undrained_strength"] = 10.0
    assert _oracle_fos(cs, limited, "bishop") == pytest.approx(1.0373275799, rel=1e-9)


def test_oracle_other_interslice_functions_on_the_circle():
    cs = pytest.importorskip("cslope")
    expected = {"clipped_sine": 0.9840846639, "trapezoidal": 0.9840713928}      # X11 §2.2
    for fn, value in expected.items():
        model = v03_model(methods=["morgenstern_price"], interslice={"function": fn})
        assert _oracle_fos(cs, model, "morgenstern_price") == pytest.approx(value, rel=1e-9), fn
    model = v03_model(methods=["morgenstern_price"], interslice={
        "function": "data_points", "points": [[0.0, 0.0], [0.5, 1.0], [1.0, 0.0]]})
    assert _oracle_fos(cs, model, "morgenstern_price") == pytest.approx(0.9840869415, rel=1e-9)


def test_oracle_mirror_gives_the_same_fos_for_the_new_methods():
    """Contract F3.8 criterion 4 on the oracle side: x -> -x, with the direction reversed."""
    cs = pytest.importorskip("cslope")
    for method in ("morgenstern_price", "janbu_corrected"):
        a = _oracle_fos(cs, v03_model(methods=[method], surface={"type": "polyline", "points": V047A_POLYLINE}), method)
        mirrored = v03_model(methods=[method], surface={
            "type": "polyline", "points": [[-x, y] for x, y in reversed(V047A_POLYLINE)]})
        mirrored["regions"] = [{"material": "soil", "polygon": [[-x, y] for x, y in
                                                                 [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]]]}]
        mirrored["slope"] = {"direction": "left_to_right"}
        assert _oracle_fos(cs, mirrored, method) == pytest.approx(a, rel=1e-9), method


# --- R10A-11: `auto` with the polyline ends fitted to the ground (E13c)

def _hill_model(points: list[list[float]], direction: str = "auto") -> dict:
    """A symmetric hill (ground y = 10 + x/2 up to the top at x = 20, then back down) with a fixed polyline."""
    model = v03_model(surface={"type": "polyline", "points": points}, methods=["spencer"])
    model["materials"] = [_material("soil", 18.0)]
    model["regions"] = [{"material": "soil", "polygon": [[0, 0], [0, 10], [20, 20], [40, 10], [40, 0]]}]
    model["slope"] = {"direction": direction}
    model["analysis"].pop("search", None)
    return model


def test_auto_direction_uses_the_polyline_ends_fitted_to_the_ground():
    # as written the left end is the higher one (10.5 > 10.4), but both ends lie under the ground and the fitted ones
    # are at (6.5, 13.25) and (28.97, 15.5): the entry is on the right (E13c, R10A-11).
    model = _hill_model([[12, 10.5], [15, 9], [18, 10.4]])
    assert _doc(model, "spencer")["definition"]["orientation"] == "rtl"


def test_fitted_polyline_ends_trim_an_end_over_the_ground_and_extend_one_under_it():
    # the left end, (2, 18), is over the ground (y = 11) and is trimmed where the polyline goes under it, at
    # (5.5, 12.75); the right end, (18, 14), is under the ground (y = 19) and is extended along its segment to
    # the ground of the right flank, at (21.5, 19.25).
    model = _hill_model([[2, 18], [8, 9], [14, 8], [18, 14]])
    (xl, yl), (xr, yr) = _fitted_ends(model)
    assert (xl, yl) == pytest.approx((5.5, 12.75), abs=1e-9)
    assert (xr, yr) == pytest.approx((21.5, 19.25), abs=1e-9)
    assert _doc(model, "spencer")["definition"]["orientation"] == "rtl"     # 19.25 > 12.75: the right end is the entry


def _fitted_ends(model: dict):
    from to_cslope import fitted_polyline_ends
    outline = outline_of(regions_of(model))
    return fitted_polyline_ends(model["analysis"]["surface"]["points"], outline)


def test_fitted_polyline_ends_of_a_polyline_already_on_the_ground_are_unchanged():
    model = _hill_model([[0.0, 10.0], [10.0, 5.0], [30.0, 5.0], [40.0, 10.0]])
    assert _fitted_ends(model) == ((0.0, 10.0), (40.0, 10.0))


# ------------------------------------------------ reinforcements (schema v0.4, E14m)

ORACLE_ROWS_RS = os.path.join(HERE, "..", "..", "crates", "ogs-core", "tests", "f3r_oracle.rs")
_R_METHODS = {"Bishop": ("bishop", None), "MorgensternPriceConstant": ("morgenstern_price", {"function": "constant"}),
              "JanbuSimplified": ("janbu_simplified", None), "JanbuCorrected": ("janbu_corrected", None)}


def v047a_v04(reinforcements: list[dict], method: str = "bishop", interslice=None, mirror: bool = False) -> dict:
    """V047a, fixed circle, version 0.4, with the reinforcements of a row of ``f3r_oracle.rs``."""
    model = v047a_fixed(mirror=mirror)
    model["version"] = "0.4"
    model["analysis"]["methods"] = [method]
    if interslice:
        model["analysis"]["interslice"] = interslice
    model["reinforcements"] = reinforcements
    return model


def _oracle_rows_from_the_rust_test() -> list[tuple[str, str, list[dict], float]]:
    """(label, method, reinforcements, value) of every ``check(...)`` of ``f3r_oracle.rs``: the same rows and values
    that the engine must reproduce, so that the oracle side and the engine side cannot drift apart."""
    import re
    text = open(ORACLE_ROWS_RS, encoding="utf-8").read()
    consts = dict(re.findall(r'const (\w+): &str = r#"(.*?)"#;', text))
    rows = []
    for label, method, const, want in re.findall(
            r'check\(\s*"([^"]+)",\s*Method::(\w+),\s*(\w+),\s*([\d.]+),', text):
        rows.append((label, method, json.loads(consts[const]), float(want)))
    return rows


ORACLE_ROWS = _oracle_rows_from_the_rust_test()


def test_the_rust_oracle_file_has_every_row_and_method():
    labels = {r[0] for r in ORACLE_ROWS}
    # E14o-9 (R11A-09): the two trivial rows inc_up30_pas / inc_up45_pas became cmp30_pas / cmp45_pas (embedded and
    # compressed) and three capx_* rows (bond, interface and tieback below tensile_capacity) were added: 33 labels x 4.
    assert len(ORACLE_ROWS) == 132 and len(labels) == 33
    assert {r[1] for r in ORACLE_ROWS} == set(_R_METHODS)


@pytest.mark.parametrize("label, method, reinforcements, want", ORACLE_ROWS,
                         ids=[f"{r[0]}-{r[1]}" for r in ORACLE_ROWS])
def test_oracle_rows_of_f4_13_and_x17_through_the_converter(label, method, reinforcements, want):
    """The converter reproduces the oracle figure of every row of X17 §4.3 to §4.5 (six decimals: rel 2e-6)."""
    cs = pytest.importorskip("cslope")
    ogs_method, interslice = _R_METHODS[method]
    model = v047a_v04(reinforcements, ogs_method, interslice)
    assert _oracle_fos(cs, model, ogs_method) == pytest.approx(want, rel=2e-6), label


def _one(reinforcement: dict, **kw) -> dict:
    return v047a_v04([reinforcement], **kw)


ANCHOR = {"type": "anchor", "id": "A1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "active",
          "tensile_capacity": 100, "direction": "axial"}
PILE = {"type": "pile", "id": "P1", "x1": 40, "y1": 33, "x2": 40, "y2": 22, "application": "passive", "force": 60,
        "direction": "angle", "angle": 0, "spacing": 1.5}
SHEET = {"type": "sheet_pile", "id": "S1", "x1": 40, "y1": 33, "x2": 40, "y2": 22, "application": "active",
         "force": 120, "direction": "angle", "angle": 0}


def test_tension_elements_go_to_reinforcements_with_explicit_direction_and_application():
    d = _mapped(_one(ANCHOR))["definition"]
    assert "piles" not in d
    assert d["reinforcements"] == [{"x1": 52.0, "y1": 28.0, "x2": 25.0, "y2": 28.0, "tensileCapacity": 100.0,
                                    "direction": "axial", "application": "active"}]


@pytest.mark.parametrize("kind", ["anchor", "nail", "geosynthetic"])
def test_the_three_tension_types_share_the_target_and_keep_every_optional_field(kind):
    item = dict(ANCHOR, type=kind, application="passive", direction="bisector", end1_capacity=5.0,
                end2_capacity=7.0, spacing=2.5)
    r = _mapped(_one(item))["definition"]["reinforcements"][0]
    assert (r["application"], r["direction"], r["end1Capacity"], r["end2Capacity"], r["spacing"]) == (
        "passive", "bisector", 5.0, 7.0, 2.5)


def test_pullout_models_map_to_the_camel_case_kinds_of_cslope():
    bond = _mapped(_one(dict(ANCHOR, pullout={"model": "bond", "strength": 30, "bonded_length": 10})))
    assert bond["definition"]["reinforcements"][0]["pullout"] == {"kind": "bond", "strength": 30.0, "bondedLength": 10.0}
    plain = _mapped(_one(dict(ANCHOR, pullout={"model": "bond", "strength": 30})))
    assert plain["definition"]["reinforcements"][0]["pullout"] == {"kind": "bond", "strength": 30.0}
    iface = _mapped(_one(dict(ANCHOR, pullout={"model": "interface", "adhesion": 10, "friction_angle": 20,
                                               "coverage": 0.5})))
    assert iface["definition"]["reinforcements"][0]["pullout"] == {
        "kind": "interface", "adhesion": 10.0, "frictionAngle": 20.0, "coverage": 0.5}
    dev = _mapped(_one(dict(ANCHOR, pullout={"model": "development", "length1": 3, "length2": 0})))
    assert dev["definition"]["reinforcements"][0]["pullout"] == {"kind": "development", "length1": 3.0, "length2": 0.0}


def test_piles_go_to_piles_with_the_hyphenated_location_and_explicit_fields():
    d = _mapped(_one(PILE))["definition"]
    assert "reinforcements" not in d
    assert d["piles"] == [{"x1": 40.0, "y1": 33.0, "x2": 40.0, "y2": 22.0, "force": 60.0, "direction": "angle",
                           "application": "passive", "location": "slip-surface", "angle": 0.0, "spacing": 1.5}]


def test_a_sheet_pile_is_a_pile_with_spacing_1_and_the_force_per_metre():
    pile = _mapped(_one(SHEET))["definition"]["piles"][0]
    assert pile["spacing"] == 1.0 and pile["force"] == 120.0 and pile["wall"] is True
    assert pile["location"] == "slip-surface" and pile["application"] == "active"


def test_tangent_and_perpendicular_piles_carry_no_angle():
    for direction in ("tangent", "perpendicular"):
        pile = _mapped(_one(dict(PILE, direction=direction, angle=None)))["definition"]["piles"][0]
        assert pile["direction"] == direction and "angle" not in pile


def test_a_model_with_the_five_types_converts_to_two_lists_and_is_valid_for_cslope():
    cs = pytest.importorskip("cslope")
    items = [ANCHOR, dict(ANCHOR, id="N1", type="nail", y1=27, y2=27), dict(ANCHOR, id="G1", type="geosynthetic",
             y1=26, y2=26), PILE, dict(SHEET, id="S2", x1=45, x2=45)]
    doc = _mapped(v047a_v04(items))
    assert len(doc["definition"]["reinforcements"]) == 3 and len(doc["definition"]["piles"]) == 2
    assert [i for i in cs.validate(doc) if i.get("severity") == "error"] == []


def test_an_empty_or_absent_list_adds_nothing_in_any_version():
    plain = _mapped(v047a_fixed())["definition"]
    for model in (v047a_fixed(reinforcements=[]), v047a_v04([])):
        d = _mapped(model)["definition"]
        assert d == plain and "reinforcements" not in d and "piles" not in d


def test_reinforcements_need_version_0_4():
    for version in ("0.1", "0.2", "0.3"):
        model = _one(ANCHOR)
        model["version"] = version
        with pytest.raises(UnsupportedModel, match='version "0.4"'):
            _mapped(model)


def test_version_0_4_still_admits_loads_seismic_and_the_v0_3_fields():
    model = _with(_one(ANCHOR), seismic={"kh": 0.1}, loads=[{"type": "line", "x": 40, "p": 20}])
    model["analysis"]["methods"] = ["janbu_corrected"]
    d = _mapped(model, "janbu_corrected")
    assert d["options"]["seismicHorizontal"] == 0.1 and d["options"]["janbuCorrection"] is True
    assert d["definition"]["lineLoads"] and d["definition"]["reinforcements"]


@pytest.mark.parametrize("mutate, match", [
    (lambda i: i.update(location="slip_surface"), "location"),          # E14m-3: no such field in v0.4
    (lambda i: i.update(prestress=50), "prestress"),
    (lambda i: i.update(application="both"), "application"),
    (lambda i: i.update(direction="perpendicular"), "direction"),
    (lambda i: i.pop("tensile_capacity"), "tensile_capacity"),
    (lambda i: i.update(id=""), "id"),
    (lambda i: i.update(type="strut"), "type"),
    (lambda i: i.update(pullout={"model": "grout"}), "grout"),
    (lambda i: i.update(pullout={"model": "bond", "strength": 1, "adhesion": 2}), "adhesion"),
])
def test_malformed_reinforcements_are_refused(mutate, match):
    item = dict(ANCHOR)
    mutate(item)
    with pytest.raises(UnsupportedModel, match=match):
        _mapped(_one(item))


# E14o-11 (R11A-11): the converter refuses what `ogs` refuses (F4.2), so that the harness never compares an invalid
# model: before, these five were ACCEPTED while `ogs analyze` answered rc = 2.
RANGE_BOND = {"model": "bond", "strength": 30, "bonded_length": 10}
RANGE_IFACE = {"model": "interface", "adhesion": 10, "friction_angle": 25, "coverage": 0.8}


@pytest.mark.parametrize("base, mutate, match", [
    (PILE, lambda i: i.update(force=-1), "force"),
    (SHEET, lambda i: i.update(force=-0.5), "force"),
    (ANCHOR, lambda i: i.update(x2=i["x1"], y2=i["y1"]), "longitud"),
    (SHEET, lambda i: i.update(x2=41), "x2"),
    (ANCHOR, lambda i: i.update(pullout=dict(RANGE_BOND, bonded_length=30)), "bonded_length"),
    (PILE, lambda i: i.update(direction="angle", angle=90), "angle"),
    (PILE, lambda i: i.update(direction="angle", angle=-90), "angle"),
    (SHEET, lambda i: i.update(direction="angle", angle=90.0), "angle"),
    (ANCHOR, lambda i: i.update(tensile_capacity=-1), "tensile_capacity"),
    (ANCHOR, lambda i: i.update(end1_capacity=-1), "end1_capacity"),
    (ANCHOR, lambda i: i.update(end2_capacity=-1), "end2_capacity"),
    (ANCHOR, lambda i: i.update(spacing=0), "spacing"),
    (ANCHOR, lambda i: i.update(spacing=-2), "spacing"),
    (PILE, lambda i: i.update(spacing=0), "spacing"),
    (ANCHOR, lambda i: i.update(pullout=dict(RANGE_BOND, strength=-1)), "strength"),
    (ANCHOR, lambda i: i.update(pullout=dict(RANGE_BOND, bonded_length=0)), "bonded_length"),
    (ANCHOR, lambda i: i.update(pullout=dict(RANGE_IFACE, adhesion=-1)), "adhesion"),
    (ANCHOR, lambda i: i.update(pullout=dict(RANGE_IFACE, friction_angle=90)), "friction_angle"),
    (ANCHOR, lambda i: i.update(pullout=dict(RANGE_IFACE, friction_angle=-1)), "friction_angle"),
    (ANCHOR, lambda i: i.update(pullout=dict(RANGE_IFACE, coverage=0)), "coverage"),
    (ANCHOR, lambda i: i.update(pullout=dict(RANGE_IFACE, coverage=1.5)), "coverage"),
    (ANCHOR, lambda i: i.update(pullout={"model": "development", "length1": -1, "length2": 0}), "length1"),
    (ANCHOR, lambda i: i.update(pullout={"model": "development", "length1": 0, "length2": -1}), "length2"),
])
def test_values_out_of_range_are_refused_like_ogs_does(base, mutate, match):
    item = dict(base)
    mutate(item)
    with pytest.raises(UnsupportedModel, match=match):
        _mapped(_one(item))


@pytest.mark.parametrize("item", [
    dict(ANCHOR, tensile_capacity=0),                                      # zero capacity is valid (no_capacity)
    dict(PILE, force=0),
    dict(SHEET, force=0),
    dict(PILE, angle=89.99),
    dict(PILE, angle=-89.99),
    dict(ANCHOR, pullout=dict(RANGE_BOND, bonded_length=27)),              # L = 27: equal is valid
    dict(ANCHOR, pullout=dict(RANGE_IFACE, friction_angle=0, adhesion=0, coverage=1)),
    dict(ANCHOR, pullout={"model": "development", "length1": 0, "length2": 0}),
    dict(ANCHOR, end1_capacity=0, end2_capacity=0, spacing=0.001),
])
def test_values_on_the_edge_of_the_range_are_accepted(item):
    _mapped(_one(item))


def test_a_pile_with_location_or_a_wrong_angle_is_refused():
    with pytest.raises(UnsupportedModel, match="location"):
        _mapped(_one(dict(PILE, location="slip_surface")))
    with pytest.raises(UnsupportedModel, match="angle"):
        _mapped(_one(dict(PILE, angle=None)))
    with pytest.raises(UnsupportedModel, match="angle"):
        _mapped(_one(dict(PILE, direction="tangent")))
    with pytest.raises(UnsupportedModel, match="spacing"):
        _mapped(_one(dict(SHEET, spacing=1.0)))


def test_repeated_ids_are_refused():
    with pytest.raises(UnsupportedModel, match="repetido"):
        _mapped(v047a_v04([ANCHOR, dict(ANCHOR, y1=27, y2=27)]))


def test_oracle_the_mirror_of_a_row_gives_the_same_fos():
    """x -> -x, with the direction reversed: the pile and the anchor are mirrored and the FS is the same (X17 §1.3)."""
    cs = pytest.importorskip("cslope")

    def mirrored(items):
        out = []
        for it in items:
            it = dict(it)
            it["x1"], it["x2"] = -it["x1"], -it["x2"]
            out.append(it)
        return out

    for items in ([ANCHOR], [PILE], [SHEET], [dict(PILE, direction="angle", angle=20)]):
        a = _oracle_fos(cs, v047a_v04(items), "bishop")
        b = _oracle_fos(cs, v047a_v04(mirrored(items), mirror=True), "bishop")
        assert b == pytest.approx(a, rel=1e-9), items


def test_oracle_drops_the_active_element_in_compression_that_ogs_applies():
    """X17 §1.5: the installed cSlope (a80f9a0) drops an active element with ``along > 0``; the contract (E14m-1)
    applies it. The two rows are therefore not oracle rows of the engine: this test records what the oracle gives
    (the slope without reinforcement) so that the difference stays documented."""
    cs = pytest.importorskip("cslope")
    base = _oracle_fos(cs, v047a_fixed(), "bishop")
    for x2, y2 in ((59.382686, 41.5), (55.091883, 47.091883)):
        item = dict(ANCHOR, x1=36, y1=28, x2=x2, y2=y2)
        assert _oracle_fos(cs, v047a_v04([item]), "bishop") == pytest.approx(base, rel=1e-9)
