"""Tests of the xslope column: one per conversion rule of ``to_xslope.py``, the ``Unsupported`` cases, an end-to-end
check (V044, fixed circle) and the report of ``run.py``. Run with:

  uv run -q --python 3.13 --no-project --with xslope==1.1.0 --with pytest python -m pytest -q verification/xslope
"""

from __future__ import annotations

import copy
import importlib.util
import json
import os
import stat
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
HARNESS = os.path.join(REPO, "verification", "harness")
sys.path.insert(0, HARNESS)

pytest.importorskip("xslope")
import to_xslope as tx  # noqa: E402


def _load(name: str, path: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


xs_run = _load("xslope_run", os.path.join(HERE, "run.py"))

OGS_BIN = os.environ.get("OGS_BIN", os.path.join(REPO, "target", "release", "ogs"))


def case(case_id: str) -> dict:
    with open(os.path.join(REPO, "verification", "cases", f"{case_id}.json"), encoding="utf-8") as fh:
        return json.load(fh)


# A clay layer (y 0..4) under a fill (y 4..10 at the crest, 4..6 at the toe); no water.
FILL = {"id": "fill", "name": "fill", "model": "mohr_coulomb", "unit_weight": 19.0, "cohesion": 5.0,
        "friction_angle": 30.0, "ru": None, "unit_weight_sat": None}
CLAY = {"id": "clay", "name": "clay", "model": "undrained", "unit_weight": 17.0, "undrained_strength": 30.0,
        "ru": None, "unit_weight_sat": None}


def model(**over) -> dict:
    m = {
        "format": "opengeoslide", "version": "0.3", "units": "metric", "meta": {},
        "materials": [copy.deepcopy(FILL), copy.deepcopy(CLAY)],
        "regions": [
            {"material": "fill", "polygon": [[0, 4], [30, 4], [30, 6], [20, 6], [10, 10], [0, 10]]},
            {"material": "clay", "polygon": [[0, 0], [30, 0], [30, 4], [0, 4]]},
        ],
        "slope": {"direction": "left_to_right"},
        "analysis": {"methods": ["bishop"], "slices": 30, "tolerance": 1e-5, "max_iterations": 500,
                     "min_m_alpha": 0.2, "surface": {"type": "circle", "xc": 12.0, "yc": 14.0, "r": 11.0}},
    }
    for key, value in over.items():
        m[key] = value
    return m


def check(method="bishop", kind="fixed", slices=30) -> dict:
    return {"method": method, "kind": kind, "published": 1.0, "tolerance": 0.05, "options": {"slices": slices}}


def materials(m: dict) -> dict:
    return {d["name"]: d for d in tx.convert(m, check()).slope_data["materials"]}


# --------------------------------------------------- one test per rule

def test_mohr_coulomb_is_option_mc():
    fill = materials(model())["fill"]
    assert (fill["option"], fill["c"], fill["phi"], fill["gamma"]) == ("mc", 5.0, 30.0, 19.0)


def test_undrained_without_gradient_is_constant_cp():
    clay = materials(model())["clay"]
    assert (clay["option"], clay["c"], clay["cp"], clay["r_elev"], clay["phi"]) == ("cp", 30.0, 0.0, 0.0, 0.0)


def test_undrained_with_datum_and_zero_gradient_is_still_constant():
    m = model()
    m["materials"][1].update(strength_datum=2.0, strength_gradient=0.0)
    clay = materials(m)["clay"]
    assert (clay["c"], clay["cp"], clay["r_elev"]) == (30.0, 0.0, 0.0)


def test_undrained_gradient_below_the_datum_is_cp_with_r_elev():
    m = model()
    m["materials"][1].update(strength_datum=5.0, strength_gradient=1.5)   # clay top is y = 4 <= 5
    clay = materials(m)["clay"]
    assert (clay["option"], clay["c"], clay["cp"], clay["r_elev"]) == ("cp", 30.0, 1.5, 5.0)


def test_undrained_zero_strength_is_mc_with_no_strength():
    """xslope refuses 'cp' with Su = 0 in its preflight (V021: a zero-strength sand), and runs 'mc' with c = phi = 0."""
    m = model()
    m["materials"][1]["undrained_strength"] = 0.0
    clay = materials(m)["clay"]
    assert (clay["option"], clay["c"], clay["phi"]) == ("mc", 0.0, 0.0)
    out = tx.run_xslope(m, check())
    assert out["error"] is None and out["fos"] > 0


def test_undrained_gradient_with_a_base_above_the_datum_is_unsupported():
    m = model()
    m["materials"][1].update(strength_datum=3.0, strength_gradient=1.5)   # the arc reaches y = 4 in the clay
    with pytest.raises(tx.Unsupported) as exc:
        tx.convert(m, check())
    assert exc.value.feature == "undrained con gradiente: bases sobre el datum"


def test_undrained_gradient_in_a_search_uses_the_material_inside_the_window():
    m = model()
    m["analysis"].pop("surface")
    m["analysis"]["search"] = {"type": "circular_entry_exit", "entry": [0.0, 10.0], "exit": [20.0, 30.0]}
    m["materials"][1].update(strength_datum=5.0, strength_gradient=1.5)
    assert tx.convert(m, check(kind="search")).mode == "search_circular"
    m["materials"][1]["strength_datum"] = 3.0
    with pytest.raises(tx.Unsupported):
        tx.convert(m, check(kind="search"))


def test_undrained_gradient_arc_that_leaves_through_the_side_of_the_model_is_checked():
    """V023: the arc meets the ground once and leaves through the vertical side; its base is still examined.

    The circle (0, 40, r 38) has its lowest point (y = 2) on the left side of the model, and rises to y = 4 (the top of
    the clay) at x = 12.2. Its only crossing with the ground is far to the right, so an examination limited to the
    crossings would see no base at all.
    """
    m = model()
    m["analysis"]["surface"] = {"type": "circle", "xc": 0.0, "yc": 40.0, "r": 38.0}
    m["materials"][1].update(strength_datum=5.0, strength_gradient=1.0)
    assert tx.convert(m, check()).mode == "fixed_circle"
    m["materials"][1]["strength_datum"] = 3.0
    with pytest.raises(tx.Unsupported):
        tx.convert(m, check())


def test_undrained_negative_gradient_is_unsupported():
    m = model()
    m["materials"][1].update(strength_datum=5.0, strength_gradient=-0.5)
    with pytest.raises(tx.Unsupported) as exc:
        tx.convert(m, check())
    assert exc.value.feature == "undrained con gradiente negativo"


def test_piezometric_line_goes_to_materials_without_ru():
    m = model(water={"unit_weight": 9.81, "piezometric_line": [[0, 5], [30, 4]]})
    m["materials"][0]["ru"] = None
    conv = tx.convert(m, check())
    assert conv.slope_data["piezo_line"] == [(0.0, 5.0), (30.0, 4.0)]
    assert {d["name"]: d["u"] for d in conv.slope_data["materials"]} == {"fill": "piezo", "clay": "piezo"}


def test_ru_overrides_the_piezometric_line_of_its_material():
    m = model(water={"unit_weight": 9.81, "piezometric_line": [[0, 5], [30, 4]]})
    m["materials"][0]["ru"] = 0.25
    mats = materials(m)
    assert (mats["fill"]["u"], mats["fill"]["ru"]) == ("ru", 0.25)
    assert mats["clay"]["u"] == "piezo"


def test_a_piezometric_line_sets_the_water_loads_to_auto():
    """Ponded water: xslope loads the ground with the water only in 'auto' mode (V089, V091, V092, V023)."""
    assert tx.convert(model(), check()).slope_data["water_loads"] == "manual"
    wet = model(water={"unit_weight": 9.81, "piezometric_line": [[0, 5], [30, 4]]})
    assert tx.convert(wet, check()).slope_data["water_loads"] == "auto"


def test_ponded_water_is_loaded():
    """The line is 3 m above the toe: with 'manual' xslope would ignore the water on the ground."""
    ponded = model(water={"unit_weight": 9.81, "piezometric_line": [[0, 9], [30, 9]]})
    out = tx.run_xslope(ponded, check())
    assert out["error"] is None
    ponded["water"]["piezometric_line"] = [[0, 9], [30, 9]]
    conv = tx.convert(ponded, check())
    conv.slope_data["water_loads"] = "manual"
    assert tx.solve(conv)["fos"] != pytest.approx(out["fos"], rel=1e-3)


def test_no_water_is_u_none():
    assert {d["u"] for d in materials(model()).values()} == {"none"}


def test_unit_weight_sat_is_gamma_sat():
    m = model()
    m["materials"][0]["unit_weight_sat"] = 21.0
    mats = materials(m)
    assert (mats["fill"]["gamma_sat"], mats["clay"]["gamma_sat"]) == (21.0, None)


def test_water_unit_weight_is_gamma_water_and_the_default_follows_the_units():
    assert tx.convert(model(water={"unit_weight": 10.0, "piezometric_line": [[0, 5], [30, 4]]}),
                      check()).slope_data["gamma_water"] == 10.0
    assert tx.convert(model(), check()).slope_data["gamma_water"] == pytest.approx(9.81)
    imperial = tx.convert(model(units="imperial"), check()).slope_data["gamma_water"]
    assert imperial == pytest.approx(62.4, abs=0.2)          # pcf, the default of ogs in imperial (E15l-6)


def test_fixed_circle_is_circles_with_depth_below_the_centre():
    conv = tx.convert(model(), check())
    assert conv.mode == "fixed_circle" and conv.num_slices == 30
    assert conv.slope_data["circles"] == [{"Xo": 12.0, "Yo": 14.0, "Depth": 3.0, "R": 11.0}]
    assert conv.slope_data["circular"] is True and conv.slope_data["non_circ"] == []


def test_fixed_polyline_is_non_circ_without_movement():
    m = model()
    m["analysis"]["surface"] = {"type": "polyline", "points": [[8.0, 8.0], [14.0, 3.0], [22.0, 6.0]]}
    conv = tx.convert(m, check(method="spencer"))
    assert conv.mode == "fixed_polyline" and conv.method == "spencer"
    assert conv.slope_data["non_circ"] == [{"X": 8.0, "Y": 8.0, "Movement": None},
                                           {"X": 14.0, "Y": 3.0, "Movement": None},
                                           {"X": 22.0, "Y": 6.0, "Movement": None}]
    assert conv.slope_data["circles"] == []


def test_search_window_from_entry_and_exit_or_the_domain():
    m = model()
    m["analysis"].pop("surface")
    m["analysis"]["search"] = {"type": "circular_entry_exit", "entry": [1.0, 9.0], "exit": [21.0, 29.0]}
    sd = tx.convert(m, check(kind="search")).slope_data
    assert sd["search_window"] == {"entry_x_min": 1.0, "entry_x_max": 9.0, "exit_x_min": 21.0, "exit_x_max": 29.0}
    m["analysis"]["search"] = {"type": "circular_entry_exit"}
    sd = tx.convert(m, check(kind="search")).slope_data
    assert sd["search_window"] == {"entry_x_min": 0.0, "entry_x_max": 30.0, "exit_x_min": 0.0, "exit_x_max": 30.0}


def test_slices_come_from_the_check_then_the_model():
    assert tx.convert(model(), check(slices=17)).num_slices == 17
    no_options = {"method": "bishop", "kind": "fixed", "published": 1.0, "tolerance": 0.05}
    assert tx.convert(model(), no_options).num_slices == 30


# ----------------------------------------------------------- Unsupported

@pytest.mark.parametrize("what,feature", [
    ("morgenstern_price", "método morgenstern_price"),
    ("janbu_simplified", "método janbu_simplified"),
    ("janbu_corrected", "método janbu_corrected"),
])
def test_unsupported_methods(what, feature):
    with pytest.raises(tx.Unsupported) as exc:
        tx.convert(model(), check(method=what))
    assert exc.value.feature == feature


def _hoek_brown(m):
    m["materials"][0] = {"id": "fill", "name": "fill", "model": "hoek_brown", "unit_weight": 25.0, "ucs": 20.0,
                         "gsi": 50, "mi": 10, "disturbance": 0.0, "ru": None, "unit_weight_sat": None}


@pytest.mark.parametrize("mutate,feature", [
    (lambda m: m["analysis"].update(seismic={"kh": 0.1, "kv": 0.0}), "sismo"),
    (lambda m: m["analysis"].update(tension_crack={"depth": 2.0, "water_fill": 0.0}), "grieta de tracción"),
    (lambda m: m.update(loads=[{"type": "udl", "id": "q", "x1": 0.0, "x2": 5.0, "q": 10.0}]), "cargas"),
    (lambda m: m.update(reinforcements=[{"type": "nail", "id": "n", "x1": 0, "y1": 0, "x2": 1, "y2": 1}]), "refuerzos"),
    (lambda m: m["materials"][1].update(strength_gradient=1.0, strength_datum=5.0, strength_limit=80.0), "strength_limit"),
    (_hoek_brown, "material hoek_brown"),
    (lambda m: m["analysis"].update(search={"type": "circular_entry_exit", "non_circular": {"seeds": 3}}),
     "búsqueda no circular"),
])
def test_unsupported_features(mutate, feature):
    m = model()
    mutate(m)
    with pytest.raises(tx.Unsupported) as exc:
        tx.convert(m, check())
    assert exc.value.feature == feature


def test_a_search_window_of_zero_width_is_unsupported():
    m = model()
    m["analysis"].pop("surface")
    m["analysis"]["search"] = {"type": "circular_entry_exit", "entry": [0.0, 12.0], "exit": [20.0, 20.0]}
    with pytest.raises(tx.Unsupported) as exc:
        tx.convert(m, check(kind="search"))
    assert exc.value.feature == "ventana de búsqueda de ancho cero"


def test_zero_seismic_coefficients_are_not_a_feature():
    m = model()
    m["analysis"]["seismic"] = {"kh": 0.0, "kv": 0.0}
    assert tx.convert(m, check()).mode == "fixed_circle"


def test_unsupported_lists_every_feature_with_the_first_as_the_class():
    m = model(loads=[{"type": "udl", "id": "q", "x1": 0.0, "x2": 5.0, "q": 10.0}])
    m["analysis"]["seismic"] = {"kh": 0.1}
    with pytest.raises(tx.Unsupported) as exc:
        tx.convert(m, check(method="janbu_corrected"))
    assert exc.value.features == ("método janbu_corrected", "cargas", "sismo")
    assert exc.value.feature == "método janbu_corrected"


def test_run_xslope_reports_unsupported_without_running():
    out = tx.run_xslope(model(), check(method="morgenstern_price"))
    assert out["fos"] is None and out["unsupported"] == "método morgenstern_price"


# ------------------------------------------------------ preflight patch

def test_preflight_patch_sets_surface_supplied_and_is_restored():
    import xslope.search as xs_search

    original = xs_search.preflight
    seen = {}

    def recorder(slope_data, analysis, selection=None, **kw):
        seen["selection"] = dict(selection or {})
        return "ok"

    xs_search.preflight = recorder
    try:
        with tx.surface_supplied_preflight():
            assert xs_search.preflight is not recorder
            assert xs_search.preflight({}, "lem", {"surface": "circular", "search": True}) == "ok"
        assert xs_search.preflight is recorder
    finally:
        xs_search.preflight = original
    assert seen["selection"] == {"surface": "circular", "search": True, "surface_supplied": True}


def test_preflight_patch_is_restored_after_an_error():
    import xslope.search as xs_search

    original = xs_search.preflight
    with pytest.raises(RuntimeError):
        with tx.surface_supplied_preflight():
            raise RuntimeError("boom")
    assert xs_search.preflight is original


def test_a_search_runs_through_the_patched_preflight():
    m = model()
    m["analysis"].pop("surface")
    m["analysis"]["search"] = {"type": "circular_entry_exit", "entry": [0.0, 12.0], "exit": [18.0, 30.0]}
    out = tx.run_xslope(m, check(kind="search"))
    assert out["error"] is None and out["fos"] > 0 and out["trials"] > 0


# ---------------------------------------------------------------- version

def test_the_pinned_version_is_installed():
    assert tx.XSLOPE_VERSION == "1.1.0"
    assert tx.require_version() == "1.1.0"


def test_another_version_stops_with_a_clear_error(monkeypatch):
    monkeypatch.setattr(tx.metadata, "version", lambda name: "9.9.9")
    with pytest.raises(RuntimeError, match=r"xslope==1\.1\.0.*xslope==9\.9\.9"):
        tx.require_version()


def test_run_py_exits_with_an_error_on_another_version(monkeypatch, capsys, tmp_path):
    monkeypatch.setattr(tx.metadata, "version", lambda name: "9.9.9")
    assert xs_run.main(["--ogs", "x", "--out", str(tmp_path), "--only", "V044"]) == 2
    assert "xslope==1.1.0" in capsys.readouterr().err


# ------------------------------------------------------- end to end: V044

def _ogs_fos(method: str) -> float:
    """The FS of ogs for V044 / fixed / ``method``: the binary if there is one, else the one recorded in
    ``verification/report.json`` (the harness run of the same cases)."""
    c = case("V044")
    ch = next(x for x in c["checks"] if x["method"] == method and x["kind"] == "fixed")
    if os.path.isfile(OGS_BIN):
        res = xs_run.harness_run().run_ogs(OGS_BIN, c["model"], ch, 120)
        assert res["error"] is None, res["error"]
        return res["fos"]
    with open(os.path.join(REPO, "verification", "report.json"), encoding="utf-8") as fh:
        rows = json.load(fh)["checks"]
    return next(r["ogs"]["fos"] for r in rows if r["case_id"] == "V044" and r["method"] == method and r["kind"] == "fixed")


@pytest.mark.parametrize("method", ["bishop", "spencer"])
def test_v044_fixed_circle_agrees_with_ogs(method):
    c = case("V044")
    ch = next(x for x in c["checks"] if x["method"] == method and x["kind"] == "fixed")
    out = tx.run_xslope(c["model"], ch)
    assert out["error"] is None and out["mode"] == "fixed_circle"
    ogs = _ogs_fos(method)
    assert abs(out["fos"] - ogs) / ogs <= 0.0005, (out["fos"], ogs)


# -------------------------------------------------------- the report

def _fake_ogs(tmp_path, fos: float) -> str:
    payload = {"engine": "ogs-fake 0.0", "results": [{"method": "bishop", "fos": fos, "status": "converged",
                                                       "warnings": []}]}
    script = tmp_path / "ogs"
    script.write_text(f"#!{sys.executable}\nimport sys\nprint({json.dumps(json.dumps(payload))})\n", encoding="utf-8")
    script.chmod(script.stat().st_mode | stat.S_IXUSR)
    return str(script)


def _strip(report: dict) -> dict:
    return {k: v for k, v in report.items() if k != "generated_at"}


def test_report_is_deterministic_and_complete(tmp_path):
    ogs = _fake_ogs(tmp_path, 2.0766)
    outs = []
    for name in ("a", "b"):
        out = tmp_path / name
        assert xs_run.main(["--ogs", ogs, "--out", str(out), "--only", "V044", "--jobs", "1"]) == 0
        outs.append(out)
    a = json.loads((outs[0] / "REPORT.json").read_text(encoding="utf-8"))
    b = json.loads((outs[1] / "REPORT.json").read_text(encoding="utf-8"))
    assert _strip(a) == _strip(b)
    assert a["engines"]["xslope"] == "1.1.0" and a["engines"]["ogs"] == "ogs-fake 0.0"
    summary = a["summary"]
    assert summary["checks"] == 3 and summary["cases"] == 1       # V044: bishop, morgenstern_price, spencer
    assert summary["by_class"] == {"convertido, superficie fija": 2, "Unsupported: método morgenstern_price": 1}
    assert summary["fixed"]["n"] == 2 and summary["search"]["n"] == 0
    md = (outs[0] / "REPORT.md").read_text(encoding="utf-8")
    assert "xslope==1.1.0" in md and "| V044 | bishop | fija |" in md
    assert not any(str(tmp_path) in line for line in md.splitlines() if "REPORT" not in line)


def test_fixed_verdict_is_agreement_or_discrepancy(tmp_path):
    good = xs_run.run_check((case("V044"), 0, _fake_ogs(tmp_path, 2.0757)))
    assert good["verdict"] == "concordancia" and good["class"] == "convertido, superficie fija"
    bad = xs_run.run_check((case("V044"), 0, _fake_ogs(tmp_path, 2.2)))
    assert bad["verdict"] == "discrepancia"
