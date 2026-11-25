"""Tests of schema/ogs-0.2.schema.json (contract F1.1). Run from the worktree root:

    env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with jsonschema --with pytest \\
        python -m pytest -q verification/tools/test_schema.py

- the 21 cases of verification/cases, the 4+10 models of the differential battery and examples/ validate;
- version "0.1" with `loads` or `analysis.seismic` fails, and ogs-0.1 stays as it was (it rejects them too);
- malformed loads and seismic coefficients fail;
- the same documents are accepted or rejected by the ogs binary (it must exist: the tests fail otherwise).
"""

from __future__ import annotations

import copy
import glob
import json
import os
import shutil
import subprocess

import jsonschema
import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SCHEMA_02 = json.load(open(os.path.join(ROOT, "schema", "ogs-0.2.schema.json"), encoding="utf-8"))
SCHEMA_01 = json.load(open(os.path.join(ROOT, "schema", "ogs-0.1.schema.json"), encoding="utf-8"))
OGS_BIN = os.environ.get("OGS_BIN", os.path.join(ROOT, "target", "release", "ogs"))

V02_CASE_IDS = ("V081a", "V081b", "V097a", "V102a", "V102b")


def _errors(model: dict, schema: dict = SCHEMA_02) -> list[str]:
    return [e.message for e in jsonschema.Draft202012Validator(schema).iter_errors(model)]


def _load(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _case_models() -> dict[str, dict]:
    return {c["id"]: c["model"] for c in map(_load, sorted(glob.glob(os.path.join(ROOT, "verification", "cases", "V*.json"))))}


def _battery_models() -> dict[str, dict]:
    paths = sorted(glob.glob(os.path.join(ROOT, "verification", "differential", "cases", "D*.ogs.json")))
    return {os.path.basename(p).split(".")[0]: _load(p) for p in paths}


def _base_v02() -> dict:
    """V097a (fixed circle, udl) plus a line load and seismic coefficients: a complete v0.2 model."""
    model = copy.deepcopy(_case_models()["V097a"])
    model["loads"] = [{"type": "udl", "id": "u1", "x1": 52.0, "x2": 62.0, "q": 35.0},
                      {"type": "line", "id": "l1", "x": 40.0, "p": 20.0, "angle": 10.0}]
    model["analysis"]["seismic"] = {"kh": 0.1, "kv": 0.0}
    return model


# ------------------------------------------------------------ the schema itself

def test_schema_is_a_valid_draft_2020_12_document_and_v0_1_is_still_there():
    jsonschema.Draft202012Validator.check_schema(SCHEMA_02)
    assert SCHEMA_02["$id"] == "ogs-0.2.schema.json"
    jsonschema.Draft202012Validator.check_schema(SCHEMA_01)
    assert SCHEMA_01["properties"]["version"] == {"const": "0.1"}
    assert "loads" not in SCHEMA_01["properties"]


def test_the_21_cases_validate_against_v0_2():
    models = _case_models()
    assert len(models) == 21 and set(V02_CASE_IDS) <= set(models)
    for cid, model in models.items():
        assert _errors(model) == [], cid
        expected = "0.2" if cid in V02_CASE_IDS else "0.1"
        assert model["version"] == expected, cid


def test_the_16_v0_1_cases_still_validate_against_v0_1():
    models = {cid: m for cid, m in _case_models().items() if cid not in V02_CASE_IDS}
    assert len(models) == 16
    for cid, model in models.items():
        assert _errors(model, SCHEMA_01) == [], cid


def test_the_v0_2_cases_do_not_validate_against_v0_1():
    for cid in V02_CASE_IDS:
        assert _errors(_case_models()[cid], SCHEMA_01), cid


def test_battery_models_and_examples_validate_against_v0_2():
    models = _battery_models()
    assert sorted(models) == [f"D{i:02d}" for i in range(1, 15)]
    for cid, model in models.items():
        assert _errors(model) == [], cid
    for path in glob.glob(os.path.join(ROOT, "examples", "*.ogs.json")):
        assert _errors(_load(path)) == [], path


def test_a_complete_v0_2_model_validates_and_loads_are_optional():
    model = _base_v02()
    assert _errors(model) == []
    model["loads"] = []
    del model["analysis"]["seismic"]
    assert _errors(model) == []
    model["analysis"]["seismic"] = None  # Option<SeismicSettings>: null is the same as absent
    assert _errors(model) == []
    model["analysis"]["seismic"] = {}  # both coefficients default to 0
    assert _errors(model) == []


# ------------------------------------------------------------ version 0.1 with new fields

@pytest.mark.parametrize("mutate", [
    lambda m: m.pop("loads"),
    lambda m: m["analysis"].pop("seismic"),
    lambda m: m["analysis"].update(seismic=None),
    lambda m: m.update(loads=[]),
])
def test_version_0_1_with_new_fields_fails(mutate):
    model = _base_v02()
    mutate(model)
    # each mutation leaves at least one new field: the document is v0.1 and must fail
    model["version"] = "0.1"
    assert _errors(model), model.get("loads")
    # the same document with both new fields removed is a valid v0.1 model
    model.pop("loads", None)
    model["analysis"].pop("seismic", None)
    assert _errors(model) == []


def test_version_0_1_without_new_fields_validates_and_unknown_versions_fail():
    model = _base_v02()
    model.pop("loads"), model["analysis"].pop("seismic")
    for version in ("0.1", "0.2"):
        model["version"] = version
        assert _errors(model) == [], version
    for version in ("0.3", "1.0", "0.10", 0.2, None):
        model["version"] = version
        assert _errors(model), version


# ------------------------------------------------------------ malformed loads and seismic

@pytest.mark.parametrize("mutate", [
    lambda m: m["loads"][0].update(q=-1.0),
    lambda m: m["loads"][0].update(q="20"),
    lambda m: m["loads"][0].pop("q"),
    lambda m: m["loads"][0].pop("x2"),
    lambda m: m["loads"][0].update(id=""),
    lambda m: m["loads"][0].update(direction="vertical"),
    lambda m: m["loads"][1].update(angle=91.0),
    lambda m: m["loads"][1].update(angle=-90.5),
    lambda m: m["loads"][1].update(p=-0.1),
    lambda m: m["loads"][1].pop("p"),
    lambda m: m["loads"][1].pop("x"),
    lambda m: m["loads"][1].update(y=3.0),
    lambda m: m["loads"].append({"type": "patch", "x": 1.0}),
    lambda m: m["loads"].append({"x": 1.0, "p": 1.0}),
    lambda m: m["loads"][1].update(type="udl"),
    lambda m: m.update(loads={"type": "udl"}),
    lambda m: m.update(loads=None),
    lambda m: m["analysis"]["seismic"].update(kh=1.0),
    lambda m: m["analysis"]["seismic"].update(kh=-0.01),
    lambda m: m["analysis"]["seismic"].update(kv=1.0),
    lambda m: m["analysis"]["seismic"].update(kv=-1.0),
    lambda m: m["analysis"]["seismic"].update(kz=0.1),
    lambda m: m["analysis"].update(seismic=[0.1, 0.0]),
    lambda m: m["analysis"]["seismic"].update(kh="0.1"),
])
def test_malformed_loads_and_seismic_fail(mutate):
    model = _base_v02()
    mutate(model)
    assert _errors(model)


def test_limits_of_loads_and_seismic_validate():
    model = _base_v02()
    model["loads"][0]["q"] = 0.0
    model["loads"][1].update(p=0.0, angle=-90.0)
    model["analysis"]["seismic"] = {"kh": 0.0, "kv": -0.999}
    assert _errors(model) == []
    model["loads"][1]["angle"] = 90.0
    model["analysis"]["seismic"] = {"kh": 0.999, "kv": 0.999}
    assert _errors(model) == []
    del model["loads"][1]["angle"]  # angle defaults to 0 in the engine
    assert _errors(model) == []


# ------------------------------------------------------------ agreement with the engine

def _ogs() -> str:
    exe = OGS_BIN if os.path.isfile(OGS_BIN) else shutil.which(OGS_BIN)
    if not exe:
        pytest.fail(f"binario ogs no encontrado: {OGS_BIN} (definir OGS_BIN)")
    return exe


def _engine_accepts(model: dict, tmp_path) -> tuple[bool, str]:
    path = tmp_path / "model.ogs.json"
    path.write_text(json.dumps(model), encoding="utf-8")
    proc = subprocess.run([_ogs(), "analyze", str(path)], capture_output=True, text=True, timeout=120)
    return proc.returncode == 0, proc.stderr.strip()


def test_engine_accepts_every_v0_2_case_and_the_complete_model(tmp_path):
    models = _case_models()
    for cid in V02_CASE_IDS:
        if models[cid]["analysis"].get("surface") is None:
            continue  # search cases are slow here; the harness runs them
        ok, err = _engine_accepts(models[cid], tmp_path)
        assert ok, (cid, err)
    ok, err = _engine_accepts(_base_v02(), tmp_path)
    assert ok, err


@pytest.mark.parametrize("mutate", [
    lambda m: m["loads"][0].update(q=-1.0),
    lambda m: m["loads"][1].update(angle=91.0),
    lambda m: m["loads"][1].update(p=-0.1),
    lambda m: m["loads"][0].update(direction="vertical"),
    lambda m: m["loads"].append({"type": "patch", "x": 1.0}),
    lambda m: m["analysis"]["seismic"].update(kh=1.0),
    lambda m: m["analysis"]["seismic"].update(kh=-0.01),
    lambda m: m["analysis"]["seismic"].update(kv=1.0),
    lambda m: m["analysis"]["seismic"].update(kv=-1.0),
    lambda m: m["analysis"]["seismic"].update(kz=0.1),
    lambda m: m.update(version="0.1"),
    lambda m: m.update(version="0.3"),
])
def test_schema_and_engine_both_reject_the_same_malformed_documents(mutate, tmp_path):
    model = _base_v02()
    mutate(model)
    assert _errors(model)
    ok, err = _engine_accepts(model, tmp_path)
    assert not ok and "InvalidModel" in err, err


def test_rules_that_json_schema_cannot_express_are_left_to_the_engine(tmp_path):
    """x1 < x2, x inside the model and unique ids: valid for the schema, rejected by the engine (F1.1)."""
    for mutate, text in (
        (lambda m: m["loads"][0].update(x1=62.0, x2=52.0), "x1 >= x2"),
        (lambda m: m["loads"][0].update(x1=-5.0), "rango"),
        (lambda m: m["loads"][1].update(id="u1"), "u1"),
    ):
        model = _base_v02()
        mutate(model)
        assert _errors(model) == [], text
        ok, err = _engine_accepts(model, tmp_path)
        assert not ok and "InvalidModel" in err, err
