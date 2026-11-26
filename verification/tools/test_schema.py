"""Tests of schema/ogs-0.3.schema.json (contracts F1.1 and F3.1) and of the 0.2 and 0.1 schemas, which are kept. Run
from the worktree root:

    env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with jsonschema --with pytest \\
        python -m pytest -q verification/tools/test_schema.py

- every case of verification/cases (their number is read from its INDEX.md, never a literal), the models of the
  differential battery and examples/ validate;
- version "0.3" is valid, every field of the Phase 3a (undrained material, polyline, M-P, Janbu, interslice) needs it,
  and the schema and the engine accept and reject the same documents (a v0.3 document that reaches an
  `unimplemented!("F3-W1…")` stub of the engine counts as accepted: the validation passed);
- version "0.1" with non-empty `loads` or non-null `analysis.seismic` fails (`loads: []` and `seismic: null` count as
  absent, as in the engine), and ogs-0.1 stays as it was (it rejects them too);
- malformed loads and seismic coefficients fail;
- the same documents are accepted or rejected by the ogs binary (it must exist: the tests fail otherwise), including a
  table of boundary values of every bound in briefs/00_CONTRATOS.md §4.5 (E12h, R5-07).
"""

from __future__ import annotations

import copy
import glob
import json
import os
import re
import shutil
import subprocess

import jsonschema
import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SCHEMA_03 = json.load(open(os.path.join(ROOT, "schema", "ogs-0.3.schema.json"), encoding="utf-8"))
SCHEMA_02 = json.load(open(os.path.join(ROOT, "schema", "ogs-0.2.schema.json"), encoding="utf-8"))
SCHEMA_01 = json.load(open(os.path.join(ROOT, "schema", "ogs-0.1.schema.json"), encoding="utf-8"))
STUB_MARK = "not implemented: F3-W1"
OGS_BIN = os.environ.get("OGS_BIN", os.path.join(ROOT, "target", "release", "ogs"))

V02_CASE_IDS = ("V081a", "V081b", "V097a", "V102a", "V102b")


def _errors(model: dict, schema: dict = SCHEMA_03) -> list[str]:
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

def test_schema_is_a_valid_draft_2020_12_document_and_v0_1_and_v0_2_are_still_there():
    jsonschema.Draft202012Validator.check_schema(SCHEMA_03)
    assert SCHEMA_03["$id"] == "ogs-0.3.schema.json"
    assert SCHEMA_03["properties"]["version"] == {"enum": ["0.1", "0.2", "0.3"]}
    jsonschema.Draft202012Validator.check_schema(SCHEMA_02)
    assert SCHEMA_02["$id"] == "ogs-0.2.schema.json"
    assert SCHEMA_02["properties"]["version"] == {"enum": ["0.1", "0.2"]}
    jsonschema.Draft202012Validator.check_schema(SCHEMA_01)
    assert SCHEMA_01["properties"]["version"] == {"const": "0.1"}
    assert "loads" not in SCHEMA_01["properties"]


def _index_case_count() -> int:
    """The number of cases that verification/cases/INDEX.md declares (never a literal)."""
    text = open(os.path.join(ROOT, "verification", "cases", "INDEX.md"), encoding="utf-8").read()
    match = re.search(r"Casos convertidos e incluidos: \*\*(\d+)\*\*", text)
    assert match, "INDEX.md no declara el número de casos"
    return int(match.group(1))


def _uses_v02_fields(model: dict) -> bool:
    return bool(model.get("loads")) or model["analysis"].get("seismic") is not None


def test_every_case_validates_against_the_current_schema_and_the_index_counts_them():
    models = _case_models()
    assert len(models) == _index_case_count() and set(V02_CASE_IDS) <= set(models)
    for cid, model in models.items():
        assert _errors(model) == [], cid
        assert model["version"] in ("0.1", "0.2", "0.3"), cid
        if cid in V02_CASE_IDS:
            assert model["version"] == "0.2", cid
        # the schemas that came before keep accepting what they accepted
        if model["version"] in ("0.1", "0.2"):
            assert _errors(model, SCHEMA_02) == [], cid


def test_the_v0_1_cases_still_validate_against_v0_1():
    models = {cid: m for cid, m in _case_models().items() if m["version"] == "0.1"}
    assert models, "debe haber casos v0.1"
    for cid, model in models.items():
        assert _errors(model, SCHEMA_01) == [], cid


def test_the_cases_with_loads_or_seismic_do_not_validate_against_v0_1():
    models = {cid: m for cid, m in _case_models().items() if _uses_v02_fields(m)}
    assert set(V02_CASE_IDS) <= set(models)
    for cid, model in models.items():
        assert _errors(model, SCHEMA_01), cid


def test_battery_models_and_examples_validate_against_the_current_schema():
    models = _battery_models()
    assert set(f"D{i:02d}" for i in range(1, 15)) <= set(models)
    for cid, model in models.items():
        assert _errors(model) == [], cid
        if model["version"] in ("0.1", "0.2"):
            assert _errors(model, SCHEMA_02) == [], cid
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
    for version in ("0.1", "0.2", "0.3"):
        model["version"] = version
        assert _errors(model) == [], version
    for version in ("0.4", "1.0", "0.10", 0.2, None):
        model["version"] = version
        assert _errors(model), version


# ------------------------------------------------------------ malformed loads and seismic

@pytest.mark.parametrize("mutate", [
    lambda m: m["loads"][0].update(q=-1.0),
    lambda m: m["loads"][0].update(q="20"),
    lambda m: m["loads"][0].pop("q"),
    lambda m: m["loads"][0].pop("x2"),
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
    if proc.returncode != 0 and STUB_MARK in proc.stderr:
        # The document got past every validation and stopped at an `unimplemented!("F3-W1a" / "F3-W1b")` stub of the
        # engine: it is accepted. Once the stubs are gone this branch is never taken.
        return True, ""
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
    lambda m: m.update(version="0.4"),
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


# ------------------------------------------------------------ version 0.1 with empty loads / null seismic (E12h)

def test_version_0_1_accepts_empty_loads_and_null_seismic_like_the_engine(tmp_path):
    model = _base_v02()
    model["version"] = "0.1"
    model["loads"] = []
    model["analysis"]["seismic"] = None
    assert _errors(model) == []
    ok, err = _engine_accepts(model, tmp_path)
    assert ok, err


# ------------------------------------------------------------ table of boundary values: schema == engine (E12h, R5-07)

def _set(path: str, value):
    """Mutation that sets (or, for the sentinel `_DEL`, removes) a value at a dotted path of the base model."""
    keys = path.split(".")

    def mutate(m: dict) -> None:
        node = m
        for k in keys[:-1]:
            node = node[int(k)] if isinstance(node, list) else node[k]
        last = keys[-1]
        target = int(last) if isinstance(node, list) else last
        if value is _DEL:
            del node[target]
        else:
            node[target] = value

    return mutate


_DEL = object()


def _search(**kw):
    """Cheap search (3x3x3 grid, Bishop) so that accepted documents run fast; `kw` overrides search fields."""
    def mutate(m: dict) -> None:
        m["analysis"]["surface"] = None
        m["analysis"]["methods"] = ["bishop"]
        m["analysis"]["search"] = {"type": "circular_entry_exit", "n_entry": 3, "n_exit": 3, "n_radius": 3, **kw}
    return mutate


def _both(*mutations):
    def mutate(m: dict) -> None:
        for f in mutations:
            f(m)
    return mutate


# (name, mutation, accepted). `accepted` is the verdict of the engine; the schema must give the same.
BOUNDARY_TABLE = [
    # analysis.slices: integer in [3, 2000]
    ("slices=2", _set("analysis.slices", 2), False),
    ("slices=3", _set("analysis.slices", 3), True),
    ("slices=2000", _set("analysis.slices", 2000), True),
    ("slices=2001", _set("analysis.slices", 2001), False),
    ("slices=0", _set("analysis.slices", 0), False),
    ("slices=-1", _set("analysis.slices", -1), False),
    ("slices=50.5", _set("analysis.slices", 50.5), False),
    ("slices='50'", _set("analysis.slices", "50"), False),
    # analysis.tolerance: (0, 0.01]
    ("tolerance=0.01", _set("analysis.tolerance", 0.01), True),
    ("tolerance=0.0100001", _set("analysis.tolerance", 0.0100001), False),
    ("tolerance=1e-12", _set("analysis.tolerance", 1e-12), True),
    ("tolerance=0", _set("analysis.tolerance", 0), False),
    ("tolerance=-1e-5", _set("analysis.tolerance", -1e-5), False),
    ("tolerance=1", _set("analysis.tolerance", 1), False),
    # analysis.max_iterations: integer in [1, 100000]
    ("max_iterations=1", _set("analysis.max_iterations", 1), True),
    ("max_iterations=0", _set("analysis.max_iterations", 0), False),
    ("max_iterations=100000", _set("analysis.max_iterations", 100000), True),
    ("max_iterations=100001", _set("analysis.max_iterations", 100001), False),
    # analysis.min_m_alpha: (0, 1]
    ("min_m_alpha=1", _set("analysis.min_m_alpha", 1), True),
    ("min_m_alpha=1.0000001", _set("analysis.min_m_alpha", 1.0000001), False),
    ("min_m_alpha=0", _set("analysis.min_m_alpha", 0), False),
    ("min_m_alpha=1e-7", _set("analysis.min_m_alpha", 1e-7), True),
    ("min_m_alpha=-0.2", _set("analysis.min_m_alpha", -0.2), False),
    # analysis.methods
    ("methods=[]", _set("analysis.methods", []), False),
    ("methods=[bishop,bishop]", _set("analysis.methods", ["bishop", "bishop"]), False),
    ("methods=[spencer]", _set("analysis.methods", ["spencer"]), True),
    ("methods=[janbu]", _set("analysis.methods", ["janbu"]), False),
    ("methods=[janbu_simplified] in version 0.2", _set("analysis.methods", ["janbu_simplified"]), False),
    # surface / search: one of the two is needed (NoSurface otherwise); null counts as absent
    ("surface=null, no search", _set("analysis.surface", None), False),
    ("no surface, no search", _set("analysis.surface", _DEL), False),
    ("analysis={}", _set("analysis", {}), False),
    ("surface=null, search=null", _both(_set("analysis.surface", None), _set("analysis.search", None)), False),
    ("search=null with a fixed surface", _set("analysis.search", None), True),
    ("search={} (all defaults) replaces the surface", _both(_search(), lambda m: m["analysis"]["search"].pop("n_entry")), True),
    ("surface r=0", _set("analysis.surface.r", 0), False),
    ("surface r=-1", _set("analysis.surface.r", -1), False),
    ("surface without r", _set("analysis.surface.r", _DEL), False),
    ("surface type=ellipse", _set("analysis.surface.type", "ellipse"), False),
    # analysis.search
    ("n_entry=1", _search(n_entry=1, n_exit=1, n_radius=1), True),
    ("n_entry=0", _search(n_entry=0), False),
    ("n_entry=200 (n_exit=n_radius=1)", _search(n_entry=200, n_exit=1, n_radius=1), True),
    ("n_entry=201", _search(n_entry=201, n_exit=1, n_radius=1), False),
    ("n_radius=2.5", _search(n_radius=2.5), False),
    ("max_radius_factor=0.51", _search(max_radius_factor=0.51), False),
    ("max_radius_factor=0.5100001", _search(max_radius_factor=0.5100001), True),
    ("max_radius_factor=0", _search(max_radius_factor=0), False),
    ("max_radius_factor=5", _search(max_radius_factor=5), True),
    ("min_width=0", _search(min_width=0), True),
    ("min_width=-0.1", _search(min_width=-0.1), False),
    ("min_width=null", _search(min_width=None), True),
    ("refine=false", _search(refine=False), True),
    ("refine=null", _search(refine=None), False),
    ("entry=null, exit=null", _search(entry=None, exit=None), True),
    ("entry with 1 number", _search(entry=[10]), False),
    ("entry with 3 numbers", _search(entry=[10, 20, 30]), False),
    ("search type=grid", _search(type="grid"), False),
    ("search unknown field", _search(n_entries=3), False),
    # materials
    ("friction_angle=0", _set("materials.0.friction_angle", 0), True),
    ("friction_angle=89.9999999", _set("materials.0.friction_angle", 89.9999999), True),
    ("friction_angle=90", _set("materials.0.friction_angle", 90), False),
    ("friction_angle=-0.1", _set("materials.0.friction_angle", -0.1), False),
    ("ru=0", _set("materials.0.ru", 0), True),
    ("ru=0.9999999", _set("materials.0.ru", 0.9999999), True),
    ("ru=1", _set("materials.0.ru", 1), False),
    ("ru=-0.1", _set("materials.0.ru", -0.1), False),
    ("ru=null", _set("materials.0.ru", None), True),
    ("cohesion=0", _set("materials.0.cohesion", 0), True),
    ("cohesion=-1", _set("materials.0.cohesion", -1), False),
    ("unit_weight=0", _set("materials.0.unit_weight", 0), False),
    ("unit_weight=1e-9", _set("materials.0.unit_weight", 1e-9), True),
    ("unit_weight_sat=null", _set("materials.0.unit_weight_sat", None), True),
    ("unit_weight_sat=0", _set("materials.0.unit_weight_sat", 0), False),
    ("material model=cam_clay", _set("materials.0.model", "cam_clay"), False),
    ("material r_u typo", _set("materials.0.r_u", 0.5), False),
    ("material without name", _set("materials.0.name", _DEL), False),
    ("materials=[]", _set("materials", []), False),
    ("regions=[]", _set("regions", []), False),
    ("polygon with 2 vertices", _set("regions.0.polygon", [[0, 0], [1, 1]]), False),
    ("polygon vertex with 3 coordinates", _set("regions.0.polygon.0", [0, 0, 0]), False),
    # top level
    ("units='metric'", _set("units", "metric"), True),
    ("units=null", _set("units", None), True),
    ("units=5", _set("units", 5), False),
    ("meta=null", _set("meta", None), False),
    ("meta.title=null", _set("meta.title", None), True),
    ("meta unknown field", _set("meta.author", "x"), False),
    ("water=null", _set("water", None), True),
    ("water.unit_weight=0", _set("water", {"unit_weight": 0}), False),
    ("water.unit_weight=null", _set("water", {"unit_weight": None}), False),
    ("water {} (defaults)", _set("water", {}), True),
    ("piezometric_line=[]", _set("water", {"piezometric_line": []}), False),
    ("piezometric_line with 1 point", _set("water", {"piezometric_line": [[0, 1]]}), False),
    ("piezometric_line=null", _set("water", {"piezometric_line": None}), True),
    ("slope=null", _set("slope", None), False),
    ("slope.direction=up", _set("slope", {"direction": "up"}), False),
    ("slope.direction=null", _set("slope", {"direction": None}), False),
    ("analysis=null", _set("analysis", None), False),
    ("unknown top-level field", _set("r_u", 0.5), False),
    ("without materials", _set("materials", _DEL), False),
    ("format=other", _set("format", "other"), False),
    # loads and seismic (v0.2)
    ("loads=null", _set("loads", None), False),
    ("load id=null", _set("loads.0.id", None), True),
    ("load id=''", _set("loads.0.id", ""), True),
    ("line load angle=90", _set("loads.1.angle", 90), True),
    ("line load angle=-90", _set("loads.1.angle", -90), True),
    ("line load angle=90.0001", _set("loads.1.angle", 90.0001), False),
    ("udl q=0", _set("loads.0.q", 0), True),
    ("udl q=-1e-9", _set("loads.0.q", -1e-9), False),
    ("seismic kh=0.9999999", _set("analysis.seismic.kh", 0.9999999), True),
    ("seismic kh=1", _set("analysis.seismic.kh", 1), False),
    ("seismic kv=-0.9999999", _set("analysis.seismic.kv", -0.9999999), True),
    ("seismic kv=-1", _set("analysis.seismic.kv", -1), False),
    ("seismic kv=0.9999999", _set("analysis.seismic.kv", 0.9999999), True),
    ("seismic=null", _set("analysis.seismic", None), True),
    ("seismic={}", _set("analysis.seismic", {}), True),
    # version 0.1: loads / seismic count as absent only when empty / null
    ("v0.1, loads=[] and seismic=null", _both(_set("version", "0.1"), _set("loads", []), _set("analysis.seismic", None)), True),
    ("v0.1, no loads and no seismic", _both(_set("version", "0.1"), _set("loads", _DEL), _set("analysis.seismic", _DEL)), True),
    ("v0.1, loads=[] and seismic={}", _both(_set("version", "0.1"), _set("loads", []), _set("analysis.seismic", {})), False),
    ("v0.1, one load and seismic=null", _both(_set("version", "0.1"), _set("analysis.seismic", None)), False),
    ("v0.1, loads=[] and seismic={kh:0.1}", _both(_set("version", "0.1"), _set("loads", [])), False),
    ("v0.1, loads=null", _both(_set("version", "0.1"), _set("loads", None), _set("analysis.seismic", None)), False),
    ("v0.2, loads=[] and seismic=null", _both(_set("loads", []), _set("analysis.seismic", None)), True),
    ("version='0.3' without fields of 0.3", _set("version", "0.3"), True),
    ("version='0.4'", _set("version", "0.4"), False),
    ("version=0.2 (number)", _set("version", 0.2), False),
]

# Rules enforced only by the engine (JSON Schema cannot express them), already listed in the schema description. The
# schema accepts these documents and the engine rejects them: it is the documented gap, not a divergence.
ENGINE_ONLY_TABLE = [
    ("region uses an unknown material", _set("regions.0.material", "nope")),
    ("duplicate material id", lambda m: m["materials"].append(dict(m["materials"][0]))),
    ("udl with x1 >= x2", _set("loads.0.x1", 99.0)),
    ("line load outside the model", _set("loads.1.x", -1e6)),
    ("duplicate load id", _set("loads.1.id", "u1")),
    ("piezometric line with x not increasing", _set("water", {"piezometric_line": [[10, 1], [5, 1]]})),
    ("search entry with lo > hi", _search(entry=[20, 10])),
    ("search entry outside the model", _search(entry=[-1e6, 1e6])),
    ("n_entry*n_exit*n_radius > 2e6", _search(n_entry=200, n_exit=200, n_radius=100)),
    ("degenerate (zero area) region", _set("regions.0.polygon", [[0, 0], [5, 0], [10, 0]])),
]


def _prepare(mutate) -> dict:
    model = _base_v02()
    mutate(model)
    return model


@pytest.mark.parametrize("name,mutate,accepted", BOUNDARY_TABLE, ids=[row[0] for row in BOUNDARY_TABLE])
def test_schema_and_engine_agree_on_the_boundary_table(name, mutate, accepted, tmp_path):
    model = _prepare(mutate)
    schema_ok = _errors(model) == []
    engine_ok, err = _engine_accepts(model, tmp_path)
    assert engine_ok == accepted, f"motor: esperado {'aceptar' if accepted else 'rechazar'}, dio {err or 'OK'}"
    assert schema_ok == accepted, f"esquema: esperado {'aceptar' if accepted else 'rechazar'}: {_errors(model)[:2]}"


def test_empty_material_id_is_rejected_by_the_schema_and_by_ogs_core_since_e12j(tmp_path):
    """E12j (G1): ogs-core rejects `material.id == ""`; the schema already did (minLength 1). Skipped on an engine that
    predates G1, so the binary and the schema are compared as soon as the engine change is merged."""
    model = _base_v02()
    model["materials"][0]["id"] = ""
    model["regions"][0]["material"] = ""
    assert _errors(model), "el esquema debe rechazar material.id vacío"
    ok, err = _engine_accepts(model, tmp_path)
    if ok:
        pytest.skip("el binario ogs aún no incluye E12j de G1 (material.id vacío)")
    assert "InvalidModel" in err


@pytest.mark.parametrize("name,mutate", ENGINE_ONLY_TABLE, ids=[row[0] for row in ENGINE_ONLY_TABLE])
def test_engine_only_rules_pass_the_schema_and_fail_in_the_engine(name, mutate, tmp_path):
    model = _prepare(mutate)
    assert _errors(model) == [], name
    ok, err = _engine_accepts(model, tmp_path)
    assert not ok and "InvalidModel" in err, (name, err)


# ------------------------------------------------------------ version 0.3 (F3.1 to F3.6, E13a)

def _base_v03() -> dict:
    """The complete v0.2 model, declared as version 0.3 (it uses no field of 0.3 yet)."""
    model = _base_v02()
    model["version"] = "0.3"
    return model


def _methods(*names):
    return _set("analysis.methods", list(names))


def _undrained(**fields):
    """Replaces the material by an undrained one (same id, name and unit weight)."""
    def mutate(m: dict) -> None:
        old = m["materials"][0]
        m["materials"][0] = {"id": old["id"], "name": old["name"], "model": "undrained",
                             "unit_weight": old["unit_weight"], **fields}
    return mutate


def _mc_with(**fields):
    def mutate(m: dict) -> None:
        m["materials"][0].update(fields)
    return mutate


def _polyline(points, *methods):
    def mutate(m: dict) -> None:
        m["analysis"]["surface"] = {"type": "polyline", "points": points}
        m["analysis"]["methods"] = list(methods)
    return mutate


def _interslice(spec, *methods):
    def mutate(m: dict) -> None:
        m["analysis"]["methods"] = list(methods) or ["morgenstern_price"]
        m["analysis"]["interslice"] = spec
    return mutate


# A polyline well under the ground of V097a, with x increasing and two interior vertices.
_POLY = [[22.0, 20.5], [30.0, 21.0], [45.0, 25.0], [60.0, 35.0]]
_DATA = {"function": "data_points", "points": [[0.0, 0.0], [0.5, 1.0], [1.0, 0.0]]}

V03_TABLE = [
    # undrained material (F3.2)
    ("undrained Su=25", _undrained(undrained_strength=25.0), True),
    ("undrained Su=0", _undrained(undrained_strength=0), True),
    ("undrained Su=-1", _undrained(undrained_strength=-1.0), False),
    ("undrained without Su", _undrained(), False),
    ("undrained Su=null", _undrained(undrained_strength=None), False),
    ("undrained Su='25'", _undrained(undrained_strength="25"), False),
    ("undrained with cohesion", _undrained(undrained_strength=20.0, cohesion=3.0), False),
    ("undrained with cohesion=null", _undrained(undrained_strength=20.0, cohesion=None), True),
    ("undrained with friction_angle=0", _undrained(undrained_strength=20.0, friction_angle=0.0), False),
    ("undrained datum and gradient", _undrained(undrained_strength=10.0, strength_datum=35.0, strength_gradient=1.0), True),
    ("undrained negative gradient", _undrained(undrained_strength=10.0, strength_datum=35.0, strength_gradient=-1.5), True),
    ("undrained gradient=0", _undrained(undrained_strength=10.0, strength_datum=35.0, strength_gradient=0), True),
    ("undrained datum without gradient", _undrained(undrained_strength=10.0, strength_datum=35.0), False),
    ("undrained gradient without datum", _undrained(undrained_strength=10.0, strength_gradient=1.0), False),
    ("undrained datum=null and gradient=null", _undrained(undrained_strength=10.0, strength_datum=None, strength_gradient=None), True),
    ("undrained datum with gradient=null", _undrained(undrained_strength=10.0, strength_datum=35.0, strength_gradient=None), False),
    ("undrained limit with gradient", _undrained(undrained_strength=10.0, strength_datum=35.0, strength_gradient=1.0, strength_limit=60.0), True),
    ("undrained limit=0 with gradient", _undrained(undrained_strength=10.0, strength_datum=35.0, strength_gradient=1.0, strength_limit=0), True),
    ("undrained limit=-1", _undrained(undrained_strength=10.0, strength_datum=35.0, strength_gradient=1.0, strength_limit=-1.0), False),
    ("undrained limit without gradient", _undrained(undrained_strength=10.0, strength_limit=60.0), False),
    ("undrained limit with null gradient", _undrained(undrained_strength=10.0, strength_gradient=None, strength_limit=60.0), False),
    ("undrained ru=0.3 and unit_weight_sat", _undrained(undrained_strength=20.0, ru=0.3, unit_weight_sat=21.0), True),
    ("undrained ru=1", _undrained(undrained_strength=20.0, ru=1), False),
    ("undrained unit_weight_sat=0", _undrained(undrained_strength=20.0, unit_weight_sat=0), False),
    ("undrained unknown field", _undrained(undrained_strength=20.0, su=1.0), False),
    ("undrained in version 0.2", _both(_undrained(undrained_strength=20.0), _set("version", "0.2")), False),
    ("undrained in version 0.1", _both(_undrained(undrained_strength=20.0), _set("version", "0.1"), _set("loads", []), _set("analysis.seismic", None)), False),
    # Mohr-Coulomb may not carry undrained fields, and needs its own
    ("mohr_coulomb with undrained_strength", _mc_with(undrained_strength=5.0), False),
    ("mohr_coulomb with strength_datum", _mc_with(strength_datum=30.0), False),
    ("mohr_coulomb with strength_gradient", _mc_with(strength_gradient=1.0), False),
    ("mohr_coulomb with strength_limit", _mc_with(strength_limit=50.0), False),
    ("mohr_coulomb with null undrained fields", _mc_with(undrained_strength=None, strength_datum=None, strength_gradient=None, strength_limit=None), True),
    ("mohr_coulomb without cohesion", _set("materials.0.cohesion", _DEL), False),
    ("mohr_coulomb with cohesion=null", _set("materials.0.cohesion", None), False),
    ("mohr_coulomb without friction_angle", _set("materials.0.friction_angle", _DEL), False),
    ("mohr_coulomb with undrained field in version 0.2", _both(_mc_with(strength_limit=50.0), _set("version", "0.2")), False),
    ("mohr_coulomb with null undrained field in version 0.2", _both(_mc_with(strength_limit=None), _set("version", "0.2")), True),
    # polyline (F3.3, F3.6)
    ("polyline with spencer", _polyline(_POLY, "spencer"), True),
    ("polyline with morgenstern_price and janbu", _polyline(_POLY, "morgenstern_price", "janbu_simplified", "janbu_corrected"), True),
    ("polyline with bishop", _polyline(_POLY, "bishop"), False),
    ("polyline with bishop and spencer", _polyline(_POLY, "spencer", "bishop"), False),
    ("polyline with bishop and a search (the surface is ignored)", _both(_polyline(_POLY, "bishop"), _set("analysis.search", {"type": "circular_entry_exit", "n_entry": 3, "n_exit": 3, "n_radius": 3})), True),
    ("polyline with 2 points", _polyline([[22.0, 20.5], [60.0, 35.0]], "spencer"), True),
    ("polyline with 1 point", _polyline([[22.0, 20.5]], "spencer"), False),
    ("polyline point with 3 coordinates", _polyline([[22.0, 20.5, 1.0], [60.0, 35.0]], "spencer"), False),
    ("polyline without points", _both(_polyline(_POLY, "spencer"), _set("analysis.surface.points", _DEL)), False),
    ("polyline unknown field", _both(_polyline(_POLY, "spencer"), _set("analysis.surface.closed", True)), False),
    ("polyline with circle fields", _both(_polyline(_POLY, "spencer"), _set("analysis.surface.r", 10.0)), False),
    ("polyline in version 0.2", _both(_polyline(_POLY, "spencer"), _set("version", "0.2")), False),
    ("polyline in version 0.1", _both(_polyline(_POLY, "spencer"), _set("version", "0.1"), _set("loads", []), _set("analysis.seismic", None)), False),
    ("polyline with a negative x (x outside the model is judged as Invalid, not as InvalidModel)", _polyline([[-5.0, 1.0], [60.0, 35.0]], "spencer"), True),
    # E13l-8 (R10A-10): without `methods` the default is ["bishop"], which a polyline rejects, so the schema requires them
    ("polyline without methods", _both(_polyline(_POLY, "spencer"), _set("analysis.methods", _DEL)), False),
    ("polyline with methods=null", _both(_polyline(_POLY, "spencer"), _set("analysis.methods", None)), False),
    ("polyline with a null search and without methods", _both(_polyline(_POLY, "spencer"), _set("analysis.methods", _DEL), _set("analysis.search", None)), False),
    ("polyline with a search and without methods (the surface is ignored, the default is bishop)", _both(_polyline(_POLY, "spencer"), _set("analysis.methods", _DEL), _set("analysis.search", {"type": "circular_entry_exit", "n_entry": 3, "n_exit": 3, "n_radius": 3})), True),
    ("polyline with an empty methods list", _both(_polyline(_POLY, "spencer"), _set("analysis.methods", [])), False),
    # methods (F3.4, F3.5)
    ("morgenstern_price", _methods("morgenstern_price"), True),
    ("janbu_simplified", _methods("janbu_simplified"), True),
    ("janbu_corrected", _methods("janbu_corrected"), True),
    ("the five methods", _methods("bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"), True),
    ("repeated new method", _methods("janbu_corrected", "janbu_corrected"), False),
    ("morgenstern_price in version 0.2", _both(_methods("morgenstern_price"), _set("version", "0.2")), False),
    ("janbu_corrected in version 0.2", _both(_methods("janbu_corrected"), _set("version", "0.2")), False),
    ("method janbu (old name)", _methods("janbu"), False),
    # interslice (F3.4)
    ("interslice constant", _interslice({"function": "constant"}), True),
    ("interslice half_sine", _interslice({"function": "half_sine"}), True),
    ("interslice clipped_sine", _interslice({"function": "clipped_sine"}), True),
    ("interslice trapezoidal", _interslice({"function": "trapezoidal"}), True),
    ("interslice data_points", _interslice(_DATA), True),
    ("interslice data_points with 2 points", _interslice({"function": "data_points", "points": [[0, 1], [1, 1]]}), True),
    ("interslice data_points with 1 point", _interslice({"function": "data_points", "points": [[0, 1]]}), False),
    ("interslice data_points without points", _interslice({"function": "data_points"}), False),
    ("interslice data_points with points=null", _interslice({"function": "data_points", "points": None}), False),
    ("interslice half_sine with points", _interslice({"function": "half_sine", "points": [[0, 0], [1, 1]]}), False),
    ("interslice half_sine with points=null", _interslice({"function": "half_sine", "points": None}), True),
    ("interslice unknown function", _interslice({"function": "parabola"}), False),
    ("interslice without function", _interslice({}), False),
    ("interslice unknown field", _interslice({"function": "constant", "scale": 2.0}), False),
    ("interslice point with 3 numbers", _interslice({"function": "data_points", "points": [[0, 0, 1], [1, 1]]}), False),
    ("interslice with spencer only", _interslice({"function": "constant"}, "spencer"), False),
    ("interslice with bishop and morgenstern_price", _interslice({"function": "constant"}, "bishop", "morgenstern_price"), True),
    ("interslice=null with spencer only", _interslice(None, "spencer"), True),
    ("interslice in version 0.2", _both(_interslice({"function": "constant"}), _set("version", "0.2")), False),
    ("interslice=null in version 0.2", _both(_interslice(None, "spencer"), _set("version", "0.2")), True),
    ("interslice that is not an object", _interslice("half_sine"), False),
]

# Rules of 0.3 that only the engine enforces (JSON Schema cannot express them).
V03_ENGINE_ONLY_TABLE = [
    ("polyline with repeated x", _polyline([[22.0, 20.5], [30.0, 21.0], [30.0, 22.0], [60.0, 35.0]], "spencer")),
    ("polyline with decreasing x", _polyline([[60.0, 35.0], [45.0, 25.0], [22.0, 20.5]], "spencer")),
    ("polyline with x closer than 1e-9 of the width", _polyline([[22.0, 20.5], [22.00000001, 20.6], [60.0, 35.0]], "spencer")),
    ("data_points not starting at 0", _interslice({"function": "data_points", "points": [[0.1, 0.5], [1.0, 1.0]]})),
    ("data_points not ending at 1", _interslice({"function": "data_points", "points": [[0.0, 0.5], [0.9, 1.0]]})),
    ("data_points with xi not increasing", _interslice({"function": "data_points", "points": [[0.0, 0.5], [0.5, 1.0], [0.5, 2.0], [1.0, 0.0]]})),
    ("data_points with a negative f", _interslice({"function": "data_points", "points": [[0.0, 0.0], [0.5, -1.0], [1.0, 1.0]]})),
    ("data_points with f = 0 everywhere", _interslice({"function": "data_points", "points": [[0.0, 0.0], [1.0, 0.0]]})),
]


def _prepare_v03(mutate) -> dict:
    model = _base_v03()
    mutate(model)
    return model


def test_a_v0_3_model_without_fields_of_0_3_validates_in_the_schema_and_the_engine(tmp_path):
    model = _base_v03()
    assert _errors(model) == []
    ok, err = _engine_accepts(model, tmp_path)
    assert ok, err


@pytest.mark.parametrize("name,mutate,accepted", V03_TABLE, ids=[row[0] for row in V03_TABLE])
def test_schema_and_engine_agree_on_the_v0_3_table(name, mutate, accepted, tmp_path):
    model = _prepare_v03(mutate)
    schema_ok = _errors(model) == []
    engine_ok, err = _engine_accepts(model, tmp_path)
    assert engine_ok == accepted, f"motor: esperado {'aceptar' if accepted else 'rechazar'}, dio {err or 'OK'}"
    assert schema_ok == accepted, f"esquema: esperado {'aceptar' if accepted else 'rechazar'}: {_errors(model)[:2]}"


@pytest.mark.parametrize("name,mutate", V03_ENGINE_ONLY_TABLE, ids=[row[0] for row in V03_ENGINE_ONLY_TABLE])
def test_v0_3_engine_only_rules_pass_the_schema_and_fail_in_the_engine(name, mutate, tmp_path):
    model = _prepare_v03(mutate)
    assert _errors(model) == [], name
    ok, err = _engine_accepts(model, tmp_path)
    assert not ok and "InvalidModel" in err, (name, err)


def test_the_engine_gate_names_the_field_and_the_schema_rejects_the_same_documents(tmp_path):
    """E13a: with a version below 0.3 the error is `<campo> requiere version "0.3"`, naming the first field."""
    cases = [
        (_undrained(undrained_strength=20.0), "undrained"),
        (_mc_with(strength_limit=50.0), "strength_limit"),
        (_polyline(_POLY, "spencer"), "polyline"),
        (_methods("janbu_simplified"), "janbu_simplified"),
        (_interslice({"function": "constant"}), "morgenstern_price"),  # the method is named before interslice
    ]
    for mutate, token in cases:
        for old in ("0.1", "0.2"):
            model = _prepare_v03(mutate)
            model["version"] = old
            if old == "0.1":
                model["loads"], model["analysis"]["seismic"] = [], None
            assert _errors(model), (token, old)
            path = tmp_path / "gate.ogs.json"
            path.write_text(json.dumps(model), encoding="utf-8")
            proc = subprocess.run([_ogs(), "analyze", str(path)], capture_output=True, text=True, timeout=120)
            assert proc.returncode != 0 and 'requiere version "0.3"' in proc.stderr and token in proc.stderr, proc.stderr
