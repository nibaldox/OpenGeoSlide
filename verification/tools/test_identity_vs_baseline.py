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
