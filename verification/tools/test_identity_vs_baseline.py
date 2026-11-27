"""El gate de identidad salta, y cuenta aparte, los modelos con `reinforcements` (F3R-R2, I1): el binario base
(v0.2.0) no puede leerlos, así que compararlos solo daría 143 «diferencias» que no lo son.

    env -u PYTHONPATH -u PYTHONHOME python3 -m pytest -q verification/tools/test_identity_vs_baseline.py
"""

from __future__ import annotations

import importlib.util
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("identity_vs_baseline", os.path.join(HERE, "identity_vs_baseline.py"))
ivb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ivb)


def _write(tmp, name, **extra):
    path = tmp / name
    path.write_text(json.dumps({"format": "opengeoslide", "version": "0.3", "materials": [], **extra}))
    return str(path)


def test_has_reinforcements_only_when_the_list_is_not_empty():
    assert ivb.has_reinforcements({"reinforcements": [{"id": "A"}]})
    assert not ivb.has_reinforcements({"reinforcements": []})
    assert not ivb.has_reinforcements({"reinforcements": None})
    assert not ivb.has_reinforcements({})


def test_split_models_separates_the_reinforced_ones(tmp_path):
    paths = {
        "plain.json": _write(tmp_path, "plain.json"),
        "empty.json": _write(tmp_path, "empty.json", reinforcements=[]),
        "reinforced.json": _write(tmp_path, "reinforced.json", reinforcements=[{"id": "A"}]),
    }
    plain, skipped = ivb.split_models(paths)
    assert sorted(plain) == ["empty.json", "plain.json"]
    assert sorted(skipped) == ["reinforced.json"]


def test_a_wrapped_case_is_read_through_its_model(tmp_path):
    case = {"id": "V", "model": {"format": "opengeoslide", "reinforcements": [{"id": "A"}]}, "checks": []}
    path = tmp_path / "V.json"
    path.write_text(json.dumps(case))
    plain, skipped = ivb.split_models({"V.json": str(path)})
    assert plain == {} and list(skipped) == ["V.json"]


# ------------------------------------------------------------ F3G: version normalization and ponded water (F5.1)

def test_normalize_version_replaces_only_the_version_of_the_engine():
    assert ivb.normalize_version(b'"engine": "ogs-core 0.3.0",') == b'"engine": "ogs-core <VERSION>",'
    assert ivb.normalize_version(b"ogs-cli 0.4.0-rc.1 (abc)") == b"ogs-cli <VERSION> (abc)"
    assert ivb.normalize_version(b"ogs-core 0.4.0\nogs-core 0.3.0") == b"ogs-core <VERSION>\nogs-core <VERSION>"
    # a model version and any other number stay as they are
    text = b'"version": "0.5", "fos": 1.0300, "slices": 50, "unit_weight": 9.81'
    assert ivb.normalize_version(text) == text


def test_two_runs_of_different_engine_versions_compare_equal_once_normalized():
    a = b'{"engine": "ogs-core 0.3.0", "results": [1.5]}'
    b = b'{"engine": "ogs-core 0.4.0", "results": [1.5]}'
    assert a != b and ivb.normalize_version(a) == ivb.normalize_version(b)
    c = b'{"engine": "ogs-core 0.4.0", "results": [1.6]}'
    assert ivb.normalize_version(a) != ivb.normalize_version(c)


_SLOPE = {"regions": [{"material": "s", "polygon": [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]]}]}


def _with_piezo(*line):
    return {**_SLOPE, "water": {"piezometric_line": [list(p) for p in line]}}


def test_water_over_the_ground_is_detected_from_the_geometry():
    assert not ivb.water_over_ground(_SLOPE)
    assert not ivb.water_over_ground({**_SLOPE, "water": {"unit_weight": 9.81}})
    assert not ivb.water_over_ground({**_SLOPE, "water": {"unit_weight": 9.81, "piezometric_line": None}})
    # under the ground everywhere, and exactly at the ground level of the toe
    assert not ivb.water_over_ground(_with_piezo((0, 24), (100, 24)))
    assert not ivb.water_over_ground(_with_piezo((0, 25), (30, 25), (50, 30), (100, 30)))
    # 2 m over the toe (the example of X20): over the ground for x in [20, 34]
    assert ivb.water_over_ground(_with_piezo((0, 27), (100, 27)))
    # the line extends horizontally beyond its ends, like the engine does
    assert ivb.water_over_ground(_with_piezo((22, 27), (25, 27)))
    # a line that crosses the slope face and goes over the toe only in a short stretch
    assert ivb.water_over_ground(_with_piezo((20, 24), (28, 26), (30, 26), (35, 26)))
    # over the crest platform but not at the toe
    assert ivb.water_over_ground(_with_piezo((20, 20), (60, 36), (70, 36)))


def test_split_ponded_separates_the_models_with_water_over_the_ground(tmp_path):
    def write(name, **extra):
        path = tmp_path / name
        path.write_text(json.dumps({"format": "opengeoslide", "version": "0.3", "materials": [], **extra}))
        return str(path)

    paths = {
        "dry.json": write("dry.json", **_SLOPE),
        "piezo_under.json": write("piezo_under.json", **_with_piezo((0, 22), (100, 22))),
        "pond.json": write("pond.json", **_with_piezo((0, 27), (100, 27))),
    }
    dry, ponded = ivb.split_ponded(paths)
    assert sorted(dry) == ["dry.json", "piezo_under.json"] and sorted(ponded) == ["pond.json"]


def test_include_reinforced_keeps_the_models_with_reinforcements(tmp_path):
    path = tmp_path / "r.json"
    path.write_text(json.dumps({"format": "opengeoslide", "version": "0.4", "materials": [], "reinforcements": [{"id": "A"}]}))
    assert ivb.split_models({"r.json": str(path)}) == ({}, {"r.json": str(path)})
    assert ivb.split_models({"r.json": str(path)}, include_reinforced=True) == ({"r.json": str(path)}, {})


# ------------------------------------------------------------ F3G: the models with a crack are skipped (F5.1)

def test_has_tension_crack_only_when_the_field_is_present():
    assert ivb.has_tension_crack({"analysis": {"tension_crack": {"depth": 2.0, "water_fill": 0.0}}})
    assert ivb.has_tension_crack({"analysis": {"tension_crack": {"depth": "auto", "water_fill": 1.0}}})
    assert not ivb.has_tension_crack({"analysis": {"tension_crack": None}})
    assert not ivb.has_tension_crack({"analysis": {}})
    assert not ivb.has_tension_crack({})


def test_split_cracked_separates_the_models_that_the_v0_3_baseline_cannot_read(tmp_path):
    paths = {
        "plain.json": _write(tmp_path, "plain.json", analysis={"methods": ["bishop"]}),
        "cracked.json": _write(tmp_path, "cracked.json", analysis={"tension_crack": {"depth": 2.0, "water_fill": 1.0}}),
        "cracked-ponded.json": _write(tmp_path, "cracked-ponded.json", **_with_piezo((0, 40), (100, 40)),
                                      analysis={"tension_crack": {"depth": "auto", "water_fill": 0.0}}),
        "ponded.json": _write(tmp_path, "ponded.json", **_with_piezo((0, 40), (100, 40))),
    }
    rest, cracked = ivb.split_cracked(paths)
    assert sorted(rest) == ["plain.json", "ponded.json"]
    assert sorted(cracked) == ["cracked-ponded.json", "cracked.json"]


def test_split_ito_matsui_separates_the_piles_with_lateral_pressure(tmp_path):
    ito = {"reinforcements": [{"id": "P1", "type": "pile", "lateral_pressure": {"model": "ito_matsui", "diameter": 0.8}}]}
    force = {"reinforcements": [{"id": "P1", "type": "pile", "force": 100.0}]}
    assert ivb.has_lateral_pressure(ito) and not ivb.has_lateral_pressure(force) and not ivb.has_lateral_pressure({})
    paths = {"ito.json": _write(tmp_path, "ito.json", **ito), "force.json": _write(tmp_path, "force.json", **force),
             "plain.json": _write(tmp_path, "plain.json", analysis={"methods": ["bishop"]})}
    rest, skipped = ivb.split_ito_matsui(paths)
    assert sorted(rest) == ["force.json", "plain.json"] and sorted(skipped) == ["ito.json"]



def test_has_v06_fields_detects_the_three_fields_and_the_version():
    assert ivb.has_v06_fields({"version": "0.6"})
    assert ivb.has_v06_fields({"materials": [{"id": "r", "model": "hoek_brown"}]})
    assert ivb.has_v06_fields({"materials": [{"id": "c", "model": "shansep"}]})
    assert ivb.has_v06_fields({"analysis": {"search": {"type": "circular_entry_exit", "non_circular": {"seeds": 3}}}})
    assert not ivb.has_v06_fields({"version": "0.5", "materials": [{"model": "mohr_coulomb"}],
                                   "analysis": {"search": {"type": "circular_entry_exit"}}})
    assert not ivb.has_v06_fields({})


def test_split_v06_separates_the_models_the_v0_4_baseline_cannot_read(tmp_path):
    paths = {"hb.json": _write(tmp_path, "hb.json", materials=[{"id": "r", "model": "hoek_brown"}]),
             "plain.json": _write(tmp_path, "plain.json", analysis={"methods": ["bishop"]})}
    rest, skipped = ivb.split_v06(paths)
    assert sorted(rest) == ["plain.json"] and sorted(skipped) == ["hb.json"]

# ------------------------------------------------------------ E15j-8: declared exceptions to the identity

def _out(evaluated=10040, valid=7451, fos=1.25, extra=None):
    doc = {"engine": "ogs-core <VERSION>", "results": [
        {"method": "bishop", "fos": 1.5, "search": {"evaluated": 10316, "valid": 7720}},
        {"method": "janbu_simplified", "fos": fos, "search": {"evaluated": evaluated, "valid": valid}},
    ]}
    if extra:
        doc["results"][1].update(extra)
    return json.dumps(doc).encode()


_V019 = [
    {"modelo": "V019", "variante": variant, "campos": ["results.*.search.evaluated", "results.*.search.valid"],
     "motivo": "contacto de aire capilar", "enmienda": "E15j-8"}
    for variant in ("search", "search@0.4")
]


def test_the_declared_exceptions_file_is_valid_and_covers_v019():
    entries = ivb.load_exceptions()
    assert sorted((e["modelo"], e["variante"]) for e in entries) == [("V019", "search"), ("V019", "search@0.4")]
    assert all(e["enmienda"] == "E15j-8" and e["motivo"] and e["campos"] for e in entries)


def test_load_exceptions_rejects_an_incomplete_entry(tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps([{"modelo": "V019", "variante": "search", "campos": ["a"]}]))
    try:
        ivb.load_exceptions(str(bad))
    except ValueError as err:
        assert "motivo" in str(err)
    else:
        raise AssertionError("debía rechazar una excepción sin motivo ni enmienda")
    assert ivb.load_exceptions(None) == []


def test_a_difference_only_in_the_allowed_counters_is_an_accepted_exception():
    a, b = (0, _out(), b""), (0, _out(10088, 7499), b"")
    verdict, paths, entry = ivb.classify("verification/cases/V019.json", "search", a, b, _V019)
    assert verdict == "exception" and entry["enmienda"] == "E15j-8"
    assert paths == "results.1.search.evaluated, results.1.search.valid"
    assert ivb.classify("verification/cases/V019.json", "search@0.4", a, b, _V019)[0] == "exception"
    assert ivb.classify("verification/cases/V019.json", "search", a, a, _V019)[0] == "same"


def test_a_field_that_is_not_allowed_still_counts_even_next_to_the_allowed_ones():
    a = (0, _out(), b"")
    changed = _out(10088, 7499, fos=1.26)
    verdict, what, entry = ivb.classify("verification/cases/V019.json", "search", a, (0, changed, b""), _V019)
    assert verdict == "diff" and entry is None and "results.1.fos" in what
    # a new key in the result (a warning) is a change of shape, reported at the container
    added = _out(10088, 7499, extra={"warnings": ["m_alpha"]})
    verdict, what, entry = ivb.classify("verification/cases/V019.json", "search", a, (0, added, b""), _V019)
    assert verdict == "diff" and entry is None and "results.1" in what


def test_an_undeclared_model_or_variant_still_counts():
    a, b = (0, _out(), b""), (0, _out(10088, 7499), b"")
    assert ivb.classify("verification/cases/V020.json", "search", a, b, _V019)[0] == "diff"
    assert ivb.classify("verification/cases/V019.json", "fixed", a, b, _V019)[0] == "diff"
    assert ivb.classify("verification/cases/V019.json", "search", a, b, [])[0] == "diff"


def test_a_different_status_or_stderr_is_never_excepted():
    a = (0, _out(), b"")
    assert ivb.classify("V019.json", "search", a, (2, _out(10088, 7499), b""), _V019) == ("diff", "status+stdout", None)
    assert ivb.classify("V019.json", "search", a, (0, _out(10088, 7499), b"aviso"), _V019) == ("diff", "stdout+stderr", None)
    assert ivb.classify("V019.json", "search", a, (0, b"no es json", b""), _V019)[0] == "diff"


def test_a_change_in_the_shape_of_the_json_is_not_covered_by_the_counters():
    a = (0, _out(), b"")
    shorter = json.loads(_out(10088, 7499))
    shorter["results"].pop()
    assert ivb.classify("V019.json", "search", a, (0, json.dumps(shorter).encode(), b""), _V019)[0] == "diff"
    assert ivb.json_diff_paths({"a": 1}, {"a": 1.0}) == ["a"]
    assert ivb.json_diff_paths({"a": [1, {"b": 2}]}, {"a": [1, {"b": 3}]}) == ["a.1.b"]
    assert ivb.json_diff_paths({"a": 1}, {"b": 1}) == ["$"]
