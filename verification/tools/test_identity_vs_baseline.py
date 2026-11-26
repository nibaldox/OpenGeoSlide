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
