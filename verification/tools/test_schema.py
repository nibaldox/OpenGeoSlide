"""Tests of schema/ogs-0.6.schema.json (contracts F6.1 a F6.4 and E16n), of schema/ogs-0.5.schema.json (contract F5.2), of schema/ogs-0.4.schema.json (contract F4.2), of schema/ogs-0.3.schema.json (contracts F1.1 and F3.1) and of
the 0.2 and 0.1 schemas, which are kept. Run
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
- version "0.5" (`analysis.tension_crack`): the table at the end of the file, with the schema and the engine in agreement (a
  document that reaches the `todo!("G1: grieta de tracción")` stub of the engine counts as accepted);
- version "0.4" (reinforcements): the table at the end of the file, with the schema and the engine in agreement (a
  document that reaches the `todo!("R1: ...")` stub of the engine counts as accepted), and the rules that only the
  engine enforces;
- version "0.6" (Hoek-Brown, SHANSEP and the non-circular search, F6.1 a F6.4): the table at the end of the file, with
  the schema and the engine in agreement (a document that reaches a `todo!("F3B-M-…")` stub of the engine counts as
  accepted), and the rules that only the engine enforces (E16n: `ocr_by_elevation` with `y` strictly increasing, and
  the F6.5 rules that relate two parts of the document — crack `auto` or Ito-Matsui with Hoek-Brown/SHANSEP materials,
  and Bishop with `non_circular`);
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
SCHEMA_07 = json.load(open(os.path.join(ROOT, "schema", "ogs-0.7.schema.json"), encoding="utf-8"))
SCHEMA_06 = json.load(open(os.path.join(ROOT, "schema", "ogs-0.6.schema.json"), encoding="utf-8"))
SCHEMA_05 = json.load(open(os.path.join(ROOT, "schema", "ogs-0.5.schema.json"), encoding="utf-8"))
SCHEMA_04 = json.load(open(os.path.join(ROOT, "schema", "ogs-0.4.schema.json"), encoding="utf-8"))
SCHEMA_03 = json.load(open(os.path.join(ROOT, "schema", "ogs-0.3.schema.json"), encoding="utf-8"))
SCHEMA_02 = json.load(open(os.path.join(ROOT, "schema", "ogs-0.2.schema.json"), encoding="utf-8"))
SCHEMA_01 = json.load(open(os.path.join(ROOT, "schema", "ogs-0.1.schema.json"), encoding="utf-8"))
STUB_MARKS = (
    "not implemented: F3-W1",
    "not yet implemented: R1: fuerzas de refuerzo",
    "not yet implemented: G1: grieta de tracción",
    # A surface that does not get to the crack (G1) is a valid document whose analysis has no surface.
    "tension_crack_not_reached",
    # The B0 stubs of the F3B block: a valid Hoek-Brown, SHANSEP or non-circular document stops at one of them.
    "not yet implemented: F3B-M-HB",
    "not yet implemented: F3B-M-SH",
    "not yet implemented: F3B-M-NC",
)
OGS_BIN = os.environ.get("OGS_BIN", os.path.join(ROOT, "target", "release", "ogs"))

V02_CASE_IDS = ("V081a", "V081b", "V097a", "V102a", "V102b")


def _errors(model: dict, schema: dict = SCHEMA_03) -> list[str]:
    return [e.message for e in jsonschema.Draft202012Validator(schema).iter_errors(model)]


def _load(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _case_models() -> dict[str, dict]:
    return {c["id"]: c["model"] for c in map(_load, sorted(glob.glob(os.path.join(ROOT, "verification", "cases", "*.json"))))}   # V*.json and HAM1.json (F3B)


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
        assert _errors(model, {"0.7": SCHEMA_07, "0.6": SCHEMA_06, "0.5": SCHEMA_05, "0.4": SCHEMA_04}.get(model["version"], SCHEMA_03)) == [], cid
        assert model["version"] in ("0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7"), cid
        # V013b-e (Ito-Matsui, promoted in cc66c2e) carry reinforcements and are v0.5 because of `lateral_pressure`.
        ito = any("lateral_pressure" in r for r in model.get("reinforcements") or [])
        crack = model["analysis"].get("tension_crack") is not None
        assert (model["version"] == "0.4") == (bool(model.get("reinforcements")) and not ito and not crack), cid
        if ito:
            assert model["version"] == "0.5", cid
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
    if proc.returncode != 0 and any(mark in proc.stderr for mark in STUB_MARKS):
        # The document got past every validation and stopped at an `unimplemented!("F3-W1a" / "F3-W1b")` or
        # `todo!("R1: fuerzas de refuerzo")` stub of the engine: it is accepted. Once the stubs are gone this branch is
        # never taken.
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
    lambda m: m.update(version="0.8"),
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
    ("version='0.8'", _set("version", "0.8"), False),
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


# ------------------------------------------------------------ version 0.4: reinforcements (F4.1, F4.2, E14a, E14b)

def _base_v04() -> dict:
    """The complete v0.2 model, declared as version 0.4 and without reinforcements yet."""
    model = _base_v02()
    model["version"] = "0.4"
    return model


def _item(base: dict, **fields) -> dict:
    out = dict(base)
    for key, value in fields.items():
        if value is _DEL:
            out.pop(key, None)
        else:
            out[key] = value
    return out


def _anchor(**f):
    return _item({"id": "a1", "type": "anchor", "x1": 44.0, "y1": 12.0, "x2": 30.0, "y2": 8.0,
                  "tensile_capacity": 100.0, "application": "active", "direction": "axial"}, **f)


def _pile(**f):
    return _item({"id": "p1", "type": "pile", "x1": 40.0, "y1": 12.0, "x2": 40.0, "y2": 2.0,
                  "application": "passive", "force": 60.0, "spacing": 1.5, "direction": "angle", "angle": 0.0}, **f)


def _sheet(**f):
    return _item({"id": "s1", "type": "sheet_pile", "x1": 40.0, "y1": 12.5, "x2": 40.0, "y2": 0.5,
                  "application": "active", "force": 120.0, "direction": "perpendicular"}, **f)


def _reinf(*items):
    def mutate(m: dict) -> None:
        m["reinforcements"] = list(items)
    return mutate


def _pull(**f):
    return _anchor(pullout=f)


_BOND = {"model": "bond", "strength": 30.0}
_IFACE = {"model": "interface", "adhesion": 10.0, "friction_angle": 20.0, "coverage": 0.8}
_DEVEL = {"model": "development", "length1": 3.0, "length2": 4.0}
_OLD = (_set("loads", []), _set("analysis.seismic", None))  # a version 0.1 document admits no loads and no seismic

V04_TABLE = [
    # accepted
    ("anchor", _reinf(_anchor()), True),
    ("empty list in 0.4", _reinf(), True),
    ("no reinforcements in 0.4", _set("version", "0.4"), True),
    ("nail with every optional field", _reinf(_anchor(type="nail", end1_capacity=5.0, end2_capacity=7.0, spacing=2.5, direction="bisector")), True),
    ("geosynthetic tangent, application passive", _reinf(_anchor(type="geosynthetic", direction="tangent", application="passive")), True),
    ("null optionals", _reinf(_anchor(end1_capacity=None, end2_capacity=None, spacing=None, pullout=None)), True),
    ("tensile_capacity 0", _reinf(_anchor(tensile_capacity=0)), True),
    ("pullout bond", _reinf(_anchor(pullout=_BOND)), True),
    ("pullout bond strength 0", _reinf(_pull(**{**_BOND, "strength": 0})), True),
    ("pullout bond with bonded_length 5", _reinf(_pull(**{**_BOND, "bonded_length": 5.0})), True),
    ("pullout bond with bonded_length=null", _reinf(_pull(**{**_BOND, "bonded_length": None})), True),
    ("pullout interface", _reinf(_anchor(pullout=_IFACE)), True),
    ("pullout interface, coverage 1, friction 0, adhesion 0", _reinf(_pull(**{**_IFACE, "coverage": 1.0, "friction_angle": 0.0, "adhesion": 0.0})), True),
    ("pullout development", _reinf(_anchor(pullout=_DEVEL)), True),
    ("pullout development 0 and 0", _reinf(_pull(model="development", length1=0, length2=0)), True),
    ("pile, direction angle 0", _reinf(_pile()), True),
    ("pile, angle 89.99", _reinf(_pile(angle=89.99)), True),
    ("pile, angle -89.99", _reinf(_pile(angle=-89.99)), True),
    ("pile tangent without angle", _reinf(_pile(direction="tangent", angle=_DEL)), True),
    ("pile perpendicular with angle=null", _reinf(_pile(direction="perpendicular", angle=None)), True),
    ("pile without spacing", _reinf(_pile(spacing=_DEL)), True),
    ("pile force 0", _reinf(_pile(force=0)), True),
    ("sheet_pile", _reinf(_sheet()), True),
    ("sheet_pile with direction angle", _reinf(_sheet(direction="angle", angle=-20.0)), True),
    ("the five types", _reinf(_anchor(), _anchor(id="n", type="nail"), _anchor(id="g", type="geosynthetic"), _pile(), _sheet()), True),
    # version gate (F4.1)
    ("reinforcements in version 0.3", _both(_set("version", "0.3"), _reinf(_anchor())), False),
    ("reinforcements in version 0.2", _both(_set("version", "0.2"), _reinf(_anchor())), False),
    ("reinforcements in version 0.1", _both(_set("version", "0.1"), *_OLD, _reinf(_anchor())), False),
    ("empty reinforcements in version 0.3", _both(_set("version", "0.3"), _reinf()), True),
    ("empty reinforcements in version 0.1", _both(_set("version", "0.1"), *_OLD, _reinf()), True),
    ("reinforcements=null", _set("reinforcements", None), False),
    ("reinforcements=null in version 0.3", _both(_set("version", "0.3"), _set("reinforcements", None)), False),
    ("reinforcements that is not a list", _set("reinforcements", {"type": "anchor"}), False),
    ("version 0.8", _both(_set("version", "0.8"), _reinf(_anchor())), False),
    # the tag, the fields and the enums
    ("unknown type", _reinf(_anchor(type="strut")), False),
    ("without type", _reinf(_anchor(type=_DEL)), False),
    ("unknown field (prestress)", _reinf(_anchor(prestress=50.0)), False),
    ("unknown field in a pile", _reinf(_pile(diameter=0.6)), False),
    ("without id", _reinf(_anchor(id=_DEL)), False),
    ("without application", _reinf(_anchor(application=_DEL)), False),
    ("application null", _reinf(_anchor(application=None)), False),
    ("application=both", _reinf(_anchor(application="both")), False),
    ("without direction", _reinf(_anchor(direction=_DEL)), False),
    ("direction=angle in an anchor", _reinf(_anchor(direction="angle")), False),
    ("direction=axial in a pile", _reinf(_pile(direction="axial", angle=_DEL)), False),
    ("without tensile_capacity", _reinf(_anchor(tensile_capacity=_DEL)), False),
    ("without x2", _reinf(_anchor(x2=_DEL)), False),
    ("x1 as a string", _reinf(_anchor(x1="44")), False),
    ("anchor with force", _reinf(_anchor(force=5.0)), False),
    ("pile with tensile_capacity", _reinf(_pile(tensile_capacity=5.0)), False),
    # E14m-3: `location` was dropped in v0.4 and is an unknown field, whatever its value
    ("pile with location=slip_surface", _reinf(_pile(location="slip_surface")), False),
    ("pile with location=centroid", _reinf(_pile(location="centroid")), False),
    ("pile with location=bottom", _reinf(_pile(location="bottom")), False),
    ("sheet_pile with location", _reinf(_sheet(location="centroid")), False),
    ("pile without force", _reinf(_pile(force=_DEL)), False),
    ("sheet_pile with spacing", _reinf(_sheet(spacing=1.0)), False),
    # ranges
    ("empty id", _reinf(_anchor(id="")), False),
    ("tensile_capacity=-1", _reinf(_anchor(tensile_capacity=-1.0)), False),
    ("end1_capacity=-0.5", _reinf(_anchor(end1_capacity=-0.5)), False),
    ("end2_capacity=-0.5", _reinf(_anchor(end2_capacity=-0.5)), False),
    ("spacing=0", _reinf(_anchor(spacing=0)), False),
    ("spacing=-1", _reinf(_pile(spacing=-1.0)), False),
    ("force=-1 in a pile", _reinf(_pile(force=-1.0)), False),
    ("force=-1 in a sheet_pile", _reinf(_sheet(force=-1.0)), False),
    ("pullout without model", _reinf(_pull(strength=30.0)), False),
    ("pullout model=grout", _reinf(_pull(model="grout")), False),
    ("pullout bond without strength", _reinf(_anchor(pullout={"model": "bond"})), False),
    ("pullout bond strength=-1", _reinf(_pull(**{**_BOND, "strength": -1.0})), False),
    ("pullout bond bonded_length=0", _reinf(_pull(**{**_BOND, "bonded_length": 0})), False),
    ("pullout bond bonded_length=-1", _reinf(_pull(**{**_BOND, "bonded_length": -1.0})), False),
    ("pullout bond with adhesion", _reinf(_pull(**{**_BOND, "adhesion": 1.0})), False),
    ("pullout interface coverage=0", _reinf(_pull(**{**_IFACE, "coverage": 0})), False),
    ("pullout interface coverage=1.0001", _reinf(_pull(**{**_IFACE, "coverage": 1.0001})), False),
    ("pullout interface friction_angle=90", _reinf(_pull(**{**_IFACE, "friction_angle": 90})), False),
    ("pullout interface friction_angle=-0.1", _reinf(_pull(**{**_IFACE, "friction_angle": -0.1})), False),
    ("pullout interface adhesion=-1", _reinf(_pull(**{**_IFACE, "adhesion": -1.0})), False),
    ("pullout interface without coverage", _reinf(_anchor(pullout={k: v for k, v in _IFACE.items() if k != "coverage"})), False),
    ("pullout development length1=-1", _reinf(_pull(**{**_DEVEL, "length1": -1.0})), False),
    ("pullout development length2=-1", _reinf(_pull(**{**_DEVEL, "length2": -1.0})), False),
    ("pullout development without length2", _reinf(_anchor(pullout={"model": "development", "length1": 1.0})), False),
    # angle (F4.2): required only with direction "angle", in (-90, 90)
    ("pile angle required with direction angle", _reinf(_pile(angle=_DEL)), False),
    ("pile angle null with direction angle", _reinf(_pile(angle=None)), False),
    ("pile angle with tangent", _reinf(_pile(direction="tangent", angle=10.0)), False),
    ("pile angle with perpendicular", _reinf(_pile(direction="perpendicular", angle=10.0)), False),
    ("pile angle=90", _reinf(_pile(angle=90)), False),
    ("pile angle=-90", _reinf(_pile(angle=-90)), False),
    ("pile angle=95", _reinf(_pile(angle=95.0)), False),
    ("sheet_pile angle required with direction angle", _reinf(_sheet(direction="angle")), False),
    ("sheet_pile angle with tangent", _reinf(_sheet(direction="tangent", angle=10.0)), False),
    ("sheet_pile angle=90", _reinf(_sheet(direction="angle", angle=90)), False),
]

# Rules of 0.4 that only the engine enforces (JSON Schema cannot express them): the schema accepts, the engine rejects.
V04_ENGINE_ONLY_TABLE = [
    ("repeated id", _reinf(_anchor(), _pile(id="a1"))),
    ("repeated id between two anchors", _reinf(_anchor(), _anchor())),
    ("anchor with length 0", _reinf(_anchor(x2=44.0, y2=12.0))),
    ("pile with length 0", _reinf(_pile(y2=12.0))),
    ("inclined sheet_pile", _reinf(_sheet(x2=41.0))),
    ("sheet_pile with x1 != x2 by 1e-9", _reinf(_sheet(x2=40.000000001))),
    ("bonded_length > L", _reinf(_pull(**{**_BOND, "bonded_length": 15.0}))),
]


def _prepare_v04(mutate) -> dict:
    model = _base_v04()
    mutate(model)
    return model


def test_every_case_the_battery_and_the_examples_validate_against_the_0_4_schema():
    jsonschema.Draft202012Validator.check_schema(SCHEMA_04)
    assert SCHEMA_04["$id"] == "ogs-0.4.schema.json"
    assert SCHEMA_04["properties"]["version"] == {"enum": ["0.1", "0.2", "0.3", "0.4"]}
    models = {**_case_models(), **_battery_models()}
    for path in glob.glob(os.path.join(ROOT, "examples", "*.ogs.json")):
        models[os.path.basename(path)] = _load(path)
    assert len(models) >= _index_case_count()
    for cid, model in models.items():
        if model["version"] in ("0.5", "0.6", "0.7"):      # the F3G cases with a crack are validated by the 0.5 schema, the F3B ones by the 0.6, V053 (CM) by the 0.7
            continue
        assert _errors(model, SCHEMA_04) == [], cid
    # and the older versions are still rejected by the older schemas: 0.3 does not know 0.4
    model = _base_v04()
    assert _errors(model, SCHEMA_03)


def test_the_complete_v0_4_model_validates_in_the_schema_and_the_engine(tmp_path):
    model = _prepare_v04(_reinf(_anchor(), _pile(), _sheet()))
    assert _errors(model, SCHEMA_04) == []
    ok, err = _engine_accepts(model, tmp_path)
    assert ok, err


def test_the_v0_4_table_has_at_least_25_rows():
    assert len(V04_TABLE) >= 25 and len(V04_ENGINE_ONLY_TABLE) >= 5


@pytest.mark.parametrize("name,mutate,accepted", V04_TABLE, ids=[row[0] for row in V04_TABLE])
def test_schema_and_engine_agree_on_the_v0_4_table(name, mutate, accepted, tmp_path):
    model = _prepare_v04(mutate)
    schema_ok = _errors(model, SCHEMA_04) == []
    engine_ok, err = _engine_accepts(model, tmp_path)
    assert engine_ok == accepted, f"motor: esperado {'aceptar' if accepted else 'rechazar'}, dio {err or 'OK'}"
    assert schema_ok == accepted, f"esquema: esperado {'aceptar' if accepted else 'rechazar'}: {_errors(model, SCHEMA_04)[:2]}"


@pytest.mark.parametrize("name,mutate", V04_ENGINE_ONLY_TABLE, ids=[row[0] for row in V04_ENGINE_ONLY_TABLE])
def test_v0_4_engine_only_rules_pass_the_schema_and_fail_in_the_engine(name, mutate, tmp_path):
    model = _prepare_v04(mutate)
    assert _errors(model, SCHEMA_04) == [], name
    ok, err = _engine_accepts(model, tmp_path)
    assert not ok and "InvalidModel" in err and "reinforcements[" in err, (name, err)


def test_the_engine_errors_carry_the_json_path_of_the_field(tmp_path):
    for mutate, path in (
        (_reinf(_anchor(), _pile(id="p"), _anchor(id="a3", pullout={**_IFACE, "coverage": 0})), "reinforcements[2].pullout.coverage"),
        (_reinf(_anchor(tensile_capacity=-1.0)), "reinforcements[0].tensile_capacity"),
        (_reinf(_pile(direction="tangent", angle=10.0)), "reinforcements[0].angle"),
        (_reinf(_sheet(x2=41.0)), "reinforcements[0].x2"),
        (_reinf(_pull(**{**_BOND, "bonded_length": 15.0})), "reinforcements[0].pullout.bonded_length"),
    ):
        model = _prepare_v04(mutate)
        path_file = tmp_path / "path.ogs.json"
        path_file.write_text(json.dumps(model), encoding="utf-8")
        proc = subprocess.run([_ogs(), "analyze", str(path_file)], capture_output=True, text=True, timeout=120)
        assert proc.returncode != 0 and "InvalidModel" in proc.stderr and path in proc.stderr, proc.stderr


def test_the_engine_gate_names_reinforcements_and_the_schema_rejects_the_same_documents(tmp_path):
    """F4.1: with a version below 0.4 the error is `reinforcements requiere version "0.4"`."""
    for old in ("0.1", "0.2", "0.3"):
        model = _prepare_v04(_reinf(_anchor()))
        model["version"] = old
        if old == "0.1":
            model["loads"], model["analysis"]["seismic"] = [], None
        assert _errors(model, SCHEMA_04), old
        path = tmp_path / "gate.ogs.json"
        path.write_text(json.dumps(model), encoding="utf-8")
        proc = subprocess.run([_ogs(), "analyze", str(path)], capture_output=True, text=True, timeout=120)
        assert proc.returncode != 0 and 'reinforcements requiere version "0.4"' in proc.stderr, proc.stderr


# ------------------------------------------------------------ version 0.5: analysis.tension_crack (F5.1, F5.2, E15a, E15b)

def _base_v05() -> dict:
    """The complete v0.2 model, declared as version 0.5, with no crack yet."""
    model = _base_v02()
    model["version"] = "0.5"
    return model


def _crack(depth=2.0, water_fill=1.0, **extra):
    """`analysis.tension_crack` with the given fields; `_DEL` removes one."""
    crack = {"depth": depth, "water_fill": water_fill, **extra}
    crack = {k: v for k, v in crack.items() if v is not _DEL}
    return _set("analysis.tension_crack", crack)


def _version(version: str):
    """Sets the version; version 0.1 admits no loads and no seismic, so it clears them."""
    def mutate(m: dict) -> None:
        m["version"] = version
        if version == "0.1":
            m["loads"], m["analysis"]["seismic"] = [], None
    return mutate


V05_TABLE = [
    # accepted
    ("full crack", _crack(), True),
    ("dry crack", _crack(0.5, 0), True),
    ("integer depth", _crack(2, 1), True),
    ("half full", _crack(2.0, 0.5), True),
    ("auto", _crack("auto", 0.25), True),
    ("auto and dry", _crack("auto", 0.0), True),
    ("tiny depth", _crack(1e-9, 1.0), True),
    ("huge depth", _crack(1.0e6, 1.0), True),
    ("no crack in 0.5", lambda m: m["analysis"].pop("tension_crack", None), True),
    ("null crack in 0.5", _set("analysis.tension_crack", None), True),
    ("null crack in 0.4", _both(_version("0.4"), _set("analysis.tension_crack", None)), True),
    ("null crack in 0.3", _both(_version("0.3"), _set("analysis.tension_crack", None)), True),
    ("null crack in 0.2", _both(_version("0.2"), _set("analysis.tension_crack", None)), True),
    ("null crack in 0.1", _both(_version("0.1"), _set("analysis.tension_crack", None)), True),
    ("crack with search", _both(_search(), _crack()), True),
    # version gate
    ("crack in 0.4", _both(_version("0.4"), _crack()), False),
    ("crack in 0.3", _both(_version("0.3"), _crack()), False),
    ("crack in 0.2", _both(_version("0.2"), _crack()), False),
    ("crack in 0.1", _both(_version("0.1"), _crack()), False),
    ("crack in 0.8", _both(_version("0.8"), _crack()), False),
    # depth
    ("depth 0", _crack(0.0), False),
    ("depth -2", _crack(-2.0), False),
    ("depth text", _crack("deep"), False),
    ("depth AUTO", _crack("AUTO"), False),
    ("depth true", _crack(True), False),
    ("depth array", _crack([2.0]), False),
    ("depth null", _crack(None), False),
    ("depth missing", _crack(_DEL), False),
    # water_fill
    ("water_fill missing (no default)", _crack(water_fill=_DEL), False),
    ("water_fill null", _crack(water_fill=None), False),
    ("water_fill -0.1", _crack(water_fill=-0.1), False),
    ("water_fill 1.1", _crack(water_fill=1.1), False),
    ("water_fill 100", _crack(water_fill=100), False),
    ("water_fill text", _crack(water_fill="1"), False),
    ("water_fill true", _crack(water_fill=True), False),
    # shape
    ("empty object", _set("analysis.tension_crack", {}), False),
    ("unknown field x", _crack(x=50.0), False),
    ("the old name of water_fill", _set("analysis.tension_crack", {"depth": 2.0, "water": 1.0}), False),
    ("the boolean of X20", _set("analysis.tension_crack", {"depth": 2.0, "filled": True}), False),
    ("crack is a number", _set("analysis.tension_crack", 2.0), False),
    ("crack is a text", _set("analysis.tension_crack", "auto"), False),
    ("crack is an array", _set("analysis.tension_crack", [2.0, 1.0]), False),
    ("crack is a boolean", _set("analysis.tension_crack", True), False),
    # the rest of the format keeps its rules in 0.5
    ("0.5 with reinforcements", _both(_reinf(_anchor())), True),
    ("0.5 with seismic out of range", _set("analysis.seismic.kh", 1.0), False),
]


def _prepare_v05(mutate) -> dict:
    model = _base_v05()
    mutate(model)
    return model


def test_every_case_the_battery_and_the_examples_validate_against_the_0_5_schema():
    jsonschema.Draft202012Validator.check_schema(SCHEMA_05)
    assert SCHEMA_05["$id"] == "ogs-0.5.schema.json"
    assert SCHEMA_05["properties"]["version"] == {"enum": ["0.1", "0.2", "0.3", "0.4", "0.5"]}
    models = {**_case_models(), **_battery_models()}
    for path in glob.glob(os.path.join(ROOT, "examples", "*.ogs.json")):
        models[os.path.basename(path)] = _load(path)
    assert len(models) >= _index_case_count()
    for cid, model in models.items():
        if model["version"] in ("0.6", "0.7"):      # the F3B cases (non-circular search, Hoek-Brown) are validated by the 0.6 schema, V053 (CM) by the 0.7
            continue
        assert _errors(model, SCHEMA_05) == [], cid
    # the older schemas do not know 0.5
    assert _errors(_base_v05(), SCHEMA_04)


def test_the_x21_rows_validate_against_the_0_5_schema():
    paths = sorted(glob.glob(os.path.join(ROOT, "crates", "ogs-core", "tests", "data", "f3g", "rows", "X21-*.json")))
    assert len(paths) == 55
    for path in paths:
        assert _errors(_load(path), SCHEMA_05) == [], path


def test_the_v0_5_table_has_at_least_40_rows():
    assert len(V05_TABLE) >= 40


@pytest.mark.parametrize("name,mutate,accepted", V05_TABLE, ids=[row[0] for row in V05_TABLE])
def test_schema_and_engine_agree_on_the_v0_5_table(name, mutate, accepted, tmp_path):
    model = _prepare_v05(mutate)
    schema_ok = _errors(model, SCHEMA_05) == []
    engine_ok, err = _engine_accepts(model, tmp_path)
    assert engine_ok == accepted, f"motor: esperado {'aceptar' if accepted else 'rechazar'}, dio {err or 'OK'}"
    assert schema_ok == accepted, f"esquema: esperado {'aceptar' if accepted else 'rechazar'}: {_errors(model, SCHEMA_05)[:2]}"


def test_the_engine_errors_carry_the_path_of_the_crack_fields(tmp_path):
    for mutate, text in (
        (_crack(0.0), "analysis.tension_crack.depth"),
        (_crack(-1.0), "analysis.tension_crack.depth"),
        (_crack("deep"), "analysis.tension_crack.depth"),
        (_crack(water_fill=1.5), "analysis.tension_crack.water_fill"),
        (_crack(water_fill=-0.5), "analysis.tension_crack.water_fill"),
        (_crack(water_fill=_DEL), "analysis.tension_crack.water_fill"),
        (_crack(_DEL), "analysis.tension_crack.depth"),
    ):
        model = _prepare_v05(mutate)
        path = tmp_path / "path.ogs.json"
        path.write_text(json.dumps(model), encoding="utf-8")
        proc = subprocess.run([_ogs(), "analyze", str(path)], capture_output=True, text=True, timeout=120)
        assert proc.returncode != 0 and "InvalidModel" in proc.stderr and text in proc.stderr, proc.stderr


def test_the_engine_gate_names_tension_crack_and_the_schema_rejects_the_same_documents(tmp_path):
    """F5.1: with a version below 0.5 the error is `tension_crack requiere version "0.5"`."""
    for old in ("0.1", "0.2", "0.3", "0.4"):
        model = _prepare_v05(_both(_version(old), _crack()))
        assert _errors(model, SCHEMA_05), old
        path = tmp_path / "gate.ogs.json"
        path.write_text(json.dumps(model), encoding="utf-8")
        proc = subprocess.run([_ogs(), "analyze", str(path)], capture_output=True, text=True, timeout=120)
        assert proc.returncode != 0 and 'InvalidModel: tension_crack requiere version "0.5"' in proc.stderr, proc.stderr


# ------------------------------------------------------------ version 0.5: Ito-Matsui (F5.10, E15i-1)

_LP = {"model": "ito_matsui", "diameter": 0.8, "location": "centroid"}


def _ito(**f):
    """A pile whose force comes from `lateral_pressure` (no `force`); `_DEL` removes a field."""
    return _pile(**{**{"force": _DEL, "lateral_pressure": dict(_LP), "spacing": 2.4}, **f})


def _lp(**f):
    """The `lateral_pressure` object with some fields changed; `_DEL` removes one."""
    lp = {**_LP, **f}
    return {k: v for k, v in lp.items() if v is not _DEL}


V05_PILE_TABLE = [
    # accepted
    ("ito-matsui centroid", _reinf(_ito()), True),
    ("ito-matsui slip_surface", _reinf(_ito(lateral_pressure=_lp(location="slip_surface"))), True),
    ("ito-matsui with capacity shear", _reinf(_ito(capacity={"shear": 150.0})), True),
    ("ito-matsui with capacity moment", _reinf(_ito(capacity={"moment": 250.0})), True),
    ("ito-matsui with both capacities", _reinf(_ito(capacity={"shear": 150.0, "moment": 250.0})), True),
    ("capacity with a null and a value", _reinf(_ito(capacity={"shear": None, "moment": 250.0})), True),
    ("force null with lateral_pressure", _reinf(_ito(force=None)), True),
    ("capacity null with lateral_pressure", _reinf(_ito(capacity=None)), True),
    ("lateral_pressure null with force", _reinf(_pile(lateral_pressure=None)), True),
    ("capacity null with force", _reinf(_pile(capacity=None)), True),
    ("spacing by default (1) above the diameter", _reinf(_ito(spacing=_DEL)), True),
    ("spacing null above the diameter", _reinf(_ito(spacing=None)), True),
    ("tangent direction", _reinf(_ito(direction="tangent", angle=_DEL)), True),
    ("active", _reinf(_ito(application="active")), True),
    ("0.5 pile with force", _reinf(_pile()), True),
    # exactly one of force and lateral_pressure
    ("force and lateral_pressure", _reinf(_ito(force=60.0)), False),
    ("neither force nor lateral_pressure", _reinf(_ito(lateral_pressure=_DEL)), False),
    ("force null and lateral_pressure null", _reinf(_ito(force=None, lateral_pressure=None)), False),
    # lateral_pressure
    ("diameter 0", _reinf(_ito(lateral_pressure=_lp(diameter=0))), False),
    ("diameter -0.8", _reinf(_ito(lateral_pressure=_lp(diameter=-0.8))), False),
    ("diameter text", _reinf(_ito(lateral_pressure=_lp(diameter="0.8"))), False),
    ("diameter missing", _reinf(_ito(lateral_pressure=_lp(diameter=_DEL))), False),
    ("model missing", _reinf(_ito(lateral_pressure=_lp(model=_DEL))), False),
    ("another model", _reinf(_ito(lateral_pressure=_lp(model="broms"))), False),
    ("location missing", _reinf(_ito(lateral_pressure=_lp(location=_DEL))), False),
    ("location null", _reinf(_ito(lateral_pressure=_lp(location=None))), False),
    ("location bottom", _reinf(_ito(lateral_pressure=_lp(location="bottom"))), False),
    ("location with a hyphen", _reinf(_ito(lateral_pressure=_lp(location="slip-surface"))), False),
    ("unknown field in lateral_pressure", _reinf(_ito(lateral_pressure=_lp(friction=0.3))), False),
    ("lateral_pressure empty", _reinf(_ito(lateral_pressure={})), False),
    ("lateral_pressure is a number", _reinf(_ito(lateral_pressure=0.8)), False),
    # capacity
    ("empty capacity", _reinf(_ito(capacity={})), False),
    ("capacity with two nulls", _reinf(_ito(capacity={"shear": None, "moment": None})), False),
    ("capacity shear 0", _reinf(_ito(capacity={"shear": 0})), False),
    ("capacity shear negative", _reinf(_ito(capacity={"shear": -1.0})), False),
    ("capacity moment negative", _reinf(_ito(capacity={"moment": -1.0})), False),
    ("capacity text", _reinf(_ito(capacity={"shear": "150"})), False),
    ("unknown field in capacity", _reinf(_ito(capacity={"shear": 10.0, "axial": 3.0})), False),
    ("capacity with force", _reinf(_pile(capacity={"shear": 10.0})), False),
    # elsewhere
    ("lateral_pressure in a sheet_pile", _reinf(_sheet(lateral_pressure=dict(_LP))), False),
    ("capacity in a sheet_pile", _reinf(_sheet(capacity={"shear": 10.0})), False),
    ("lateral_pressure in an anchor", _reinf(_anchor(lateral_pressure=dict(_LP))), False),
    # version gate
    ("lateral_pressure in 0.4", _both(_version("0.4"), _reinf(_ito())), False),
    ("lateral_pressure in 0.3", _both(_version("0.3"), _reinf(_ito())), False),
    ("capacity in 0.4", _both(_version("0.4"), _reinf(_pile(capacity={"shear": 10.0}))), False),
    ("a pile with force in 0.4", _both(_version("0.4"), _reinf(_pile())), True),
    ("null lateral_pressure and capacity in 0.4", _both(_version("0.4"), _reinf(_pile(lateral_pressure=None, capacity=None))), True),
]

# Rules of E15i-1 that only the engine enforces (JSON Schema cannot compare two fields): the schema accepts, the engine rejects.
V05_PILE_ENGINE_ONLY_TABLE = [
    ("inclined pile", _reinf(_ito(x2=41.0)), "reinforcements[0].x2"),
    ("pile 1e-3 off the vertical", _reinf(_ito(x2=40.001)), "reinforcements[0].x2"),
    ("spacing equal to the diameter", _reinf(_ito(spacing=0.8)), "reinforcements[0].spacing"),
    ("spacing below the diameter", _reinf(_ito(spacing=0.5)), "reinforcements[0].spacing"),
    ("default spacing (1) below the diameter", _reinf(_ito(spacing=_DEL, lateral_pressure=_lp(diameter=1.5))), "reinforcements[0].spacing"),
]


def test_the_v0_5_pile_table_has_at_least_45_rows():
    assert len(V05_PILE_TABLE) >= 45 and len(V05_PILE_ENGINE_ONLY_TABLE) >= 5


@pytest.mark.parametrize("name,mutate,accepted", V05_PILE_TABLE, ids=[row[0] for row in V05_PILE_TABLE])
def test_schema_and_engine_agree_on_the_ito_matsui_table(name, mutate, accepted, tmp_path):
    model = _prepare_v05(mutate)
    schema_ok = _errors(model, SCHEMA_05) == []
    engine_ok, err = _engine_accepts(model, tmp_path)
    assert engine_ok == accepted, f"motor: esperado {'aceptar' if accepted else 'rechazar'}, dio {err or 'OK'}"
    assert schema_ok == accepted, f"esquema: esperado {'aceptar' if accepted else 'rechazar'}: {_errors(model, SCHEMA_05)[:2]}"


@pytest.mark.parametrize("name,mutate,path", V05_PILE_ENGINE_ONLY_TABLE, ids=[row[0] for row in V05_PILE_ENGINE_ONLY_TABLE])
def test_ito_matsui_engine_only_rules_pass_the_schema_and_fail_in_the_engine(name, mutate, path, tmp_path):
    model = _prepare_v05(mutate)
    assert _errors(model, SCHEMA_05) == [], name
    ok, err = _engine_accepts(model, tmp_path)
    assert not ok and "InvalidModel" in err and path in err, (name, err)


def test_the_engine_gate_names_lateral_pressure_and_the_schema_rejects_the_same_documents(tmp_path):
    """E15i-1: with a version below 0.5 the error is `lateral_pressure requiere version "0.5"`."""
    model = _prepare_v05(_both(_version("0.4"), _reinf(_ito())))
    assert _errors(model, SCHEMA_05)
    path = tmp_path / "gate.ogs.json"
    path.write_text(json.dumps(model), encoding="utf-8")
    proc = subprocess.run([_ogs(), "analyze", str(path)], capture_output=True, text=True, timeout=120)
    assert proc.returncode != 0 and 'InvalidModel: lateral_pressure requiere version "0.5"' in proc.stderr, proc.stderr


def test_the_ito_matsui_rows_validate_against_the_0_5_schema():
    paths = sorted(glob.glob(os.path.join(ROOT, "crates", "ogs-core", "tests", "data", "f3g3", "rows", "X22-*.json")))
    # 28 filas de E15i y la X22-S16 (ru y piezométrica, oráculo cSlope por to_cslope) que suma R12 M-B (E15l-12).
    assert len(paths) == 29
    for path in paths:
        assert _errors(_load(path), SCHEMA_05) == [], path


# ------------------------------------------------------------ version 0.6: Hoek-Brown, SHANSEP and non-circular (F6.1 a F6.4, E16n)

_SH_POP = {"ratio": 0.25, "exponent": 0.8, "pop": 30.0}
_SH_ELEV = [[10.0, 1.0], [20.0, 1.5], [30.0, 2.0]]


def _base_v06() -> dict:
    """The complete v0.2 model, declared as version 0.6, with no new field yet."""
    model = _base_v02()
    model["version"] = "0.6"
    return model


def _hb(**f):
    """Replaces the material by a Hoek-Brown one (same id, name and unit weight); `_DEL` removes a field."""
    def mutate(m: dict) -> None:
        old = m["materials"][0]
        mat = {"id": old["id"], "name": old["name"], "model": "hoek_brown",
               "unit_weight": old["unit_weight"], "ucs": 30000.0, "gsi": 50.0,
               "mi": 10.0, "disturbance": 0.7, **f}
        m["materials"][0] = {k: v for k, v in mat.items() if v is not _DEL}
    return mutate


def _sh(spec=_SH_POP, **f):
    """Replaces the material by a SHANSEP one (same id, name and unit weight); `_DEL` removes a material field."""
    def mutate(m: dict) -> None:
        old = m["materials"][0]
        mat = {"id": old["id"], "name": old["name"], "model": "shansep",
               "unit_weight": old["unit_weight"], "shansep": spec, **f}
        m["materials"][0] = {k: v for k, v in mat.items() if v is not _DEL}
    return mutate


def _shan(**f):
    """The `shansep` object (pop by default) with some fields changed; `_DEL` removes one."""
    return _item(dict(_SH_POP), **f)


def _noncirc(**f):
    """A cheap Spencer search with `analysis.search.non_circular`; `_DEL` removes a field of the object."""
    def mutate(m: dict) -> None:
        m["analysis"]["surface"] = None
        m["analysis"]["methods"] = ["spencer"]
        m["analysis"]["search"] = {"type": "circular_entry_exit", "n_entry": 3, "n_exit": 3,
                                   "n_radius": 3, "non_circular": _item({}, **f)}
    return mutate


V06_TABLE = [
    # the format is neutral in 0.6 (F6.1 identity)
    ("no new fields in 0.6", lambda m: None, True),
    ("0.6 with reinforcements and a crack", _both(_reinf(_anchor()), _crack()), True),
    # Hoek-Brown (F6.2)
    ("hoek_brown", _hb(), True),
    ("hoek_brown with unit_weight_sat and ru", _hb(unit_weight_sat=27.0, ru=0.2), True),
    ("hoek_brown with null optionals", _hb(unit_weight_sat=None, ru=None), True),
    ("gsi 0", _hb(gsi=0.0), True),
    ("gsi 100", _hb(gsi=100.0), True),
    ("disturbance 0", _hb(disturbance=0.0), True),
    ("disturbance 1", _hb(disturbance=1.0), True),
    ("tiny ucs and mi", _hb(ucs=1e-9, mi=1e-9), True),
    ("hoek_brown without ucs", _hb(ucs=_DEL), False),
    ("hoek_brown without gsi", _hb(gsi=_DEL), False),
    ("hoek_brown without mi", _hb(mi=_DEL), False),
    ("hoek_brown without disturbance", _hb(disturbance=_DEL), False),
    ("ucs 0", _hb(ucs=0.0), False),
    ("ucs negative", _hb(ucs=-1.0), False),
    ("gsi -0.1", _hb(gsi=-0.1), False),
    ("gsi 100.1", _hb(gsi=100.1), False),
    ("mi 0", _hb(mi=0.0), False),
    ("mi negative", _hb(mi=-1.0), False),
    ("disturbance -0.1", _hb(disturbance=-0.1), False),
    ("disturbance 1.1", _hb(disturbance=1.1), False),
    ("hoek_brown with cohesion", _hb(cohesion=8.0), False),
    ("hoek_brown with friction_angle", _hb(friction_angle=23.0), False),
    ("hoek_brown with undrained_strength", _hb(undrained_strength=25.0), False),
    ("hoek_brown with strength_datum", _hb(strength_datum=35.0), False),
    ("hoek_brown with strength_gradient", _hb(strength_gradient=1.0), False),
    ("hoek_brown with strength_limit", _hb(strength_limit=50.0), False),
    ("hoek_brown with shansep", _hb(shansep=_SH_POP), False),
    ("hoek_brown with null prohibited fields", _hb(cohesion=None, friction_angle=None, undrained_strength=None,
                                                   strength_datum=None, strength_gradient=None, strength_limit=None,
                                                   shansep=None), True),
    ("mohr_coulomb with ucs", _mc_with(ucs=30000.0), False),
    ("mohr_coulomb with gsi", _mc_with(gsi=50.0), False),
    ("mohr_coulomb with mi", _mc_with(mi=10.0), False),
    ("mohr_coulomb with disturbance", _mc_with(disturbance=0.7), False),
    ("mohr_coulomb with shansep", _mc_with(shansep=_SH_POP), False),
    ("mohr_coulomb with null 0.6 fields", _mc_with(ucs=None, gsi=None, mi=None, disturbance=None, shansep=None), True),
    ("undrained with ucs", _undrained(undrained_strength=20.0, ucs=1.0), False),
    ("undrained with null ucs", _undrained(undrained_strength=20.0, ucs=None), True),
    # SHANSEP (F6.3)
    ("shansep pop", _sh(), True),
    ("shansep ocr", _sh(_shan(pop=_DEL, ocr=1.6)), True),
    ("shansep ocr 1", _sh(_shan(pop=_DEL, ocr=1.0)), True),
    ("shansep ocr_by_elevation", _sh(_shan(pop=_DEL, ocr_by_elevation=_SH_ELEV)), True),
    ("shansep ocr_by_elevation with 2 rows", _sh(_shan(pop=_DEL, ocr_by_elevation=[[0.0, 1.0], [10.0, 2.0]])), True),
    ("shansep without exponent (default 0.8)", _sh(_shan(exponent=_DEL)), True),
    ("shansep exponent null (default 0.8)", _sh(_shan(exponent=None)), True),
    ("shansep exponent 0", _sh(_shan(exponent=0.0)), True),
    ("shansep exponent 1", _sh(_shan(exponent=1.0)), True),
    ("shansep pop 0", _sh(_shan(pop=0.0)), True),
    ("shansep with unit_weight_sat and ru", _sh(unit_weight_sat=19.0, ru=0.3), True),
    ("shansep without the object", _sh(spec=_DEL), False),
    ("shansep null object", _sh(shansep=None), False),
    ("shansep without ratio", _sh(_shan(ratio=_DEL)), False),
    ("shansep ratio 0", _sh(_shan(ratio=0.0)), False),
    ("shansep ratio negative", _sh(_shan(ratio=-0.1)), False),
    ("shansep exponent 1.1", _sh(_shan(exponent=1.1)), False),
    ("shansep exponent -0.1", _sh(_shan(exponent=-0.1)), False),
    ("shansep with no source", _sh(_shan(pop=_DEL)), False),
    ("shansep with ocr and pop", _sh(_shan(ocr=1.6)), False),
    ("shansep ocr 0.999", _sh(_shan(pop=_DEL, ocr=0.999)), False),
    ("shansep pop negative", _sh(_shan(pop=-1.0)), False),
    ("shansep ocr_by_elevation with 1 row", _sh(_shan(pop=_DEL, ocr_by_elevation=[[0.0, 1.0]])), False),
    ("shansep ocr_by_elevation row with 3 numbers", _sh(_shan(pop=_DEL, ocr_by_elevation=[[0.0, 1.0, 2.0], [1.0, 1.5]])), False),
    ("shansep ocr_by_elevation OCR below 1", _sh(_shan(pop=_DEL, ocr_by_elevation=[[0.0, 1.0], [10.0, 0.5]])), False),
    ("shansep unknown field", _sh(_shan(su_min=1.0)), False),
    ("shansep with cohesion", _sh(cohesion=8.0), False),
    ("shansep with friction_angle", _sh(friction_angle=23.0), False),
    ("shansep with undrained_strength", _sh(undrained_strength=25.0), False),
    ("shansep with ucs", _sh(ucs=30000.0), False),
    ("shansep with gsi", _sh(gsi=50.0), False),
    ("shansep with mi", _sh(mi=10.0), False),
    ("shansep with disturbance", _sh(disturbance=0.7), False),
    ("shansep with null prohibited fields", _sh(cohesion=None, friction_angle=None, undrained_strength=None,
                                                ucs=None, gsi=None, mi=None, disturbance=None), True),
    # non-circular search (F6.4)
    ("non_circular {}", _noncirc(), True),
    ("non_circular seeds 3 and max_vertices 33", _noncirc(seeds=3, max_vertices=33), True),
    ("non_circular seeds 1", _noncirc(seeds=1), True),
    ("non_circular seeds 10", _noncirc(seeds=10), True),
    ("non_circular max_vertices 9", _noncirc(max_vertices=9), True),
    ("non_circular max_vertices 17", _noncirc(max_vertices=17), True),
    ("non_circular null", _search(non_circular=None), True),
    # E16z (R15A-11): an optional field set to null is the same as absent, as everywhere else in the schema and in the engine
    ("non_circular seeds null", _noncirc(seeds=None), True),
    ("non_circular max_vertices null", _noncirc(max_vertices=None), True),
    ("non_circular seeds null and max_vertices null", _noncirc(seeds=None, max_vertices=None), True),
    ("non_circular seeds null in 0.5", _both(_version("0.5"), _noncirc(seeds=None)), False),
    ("non_circular seeds 0", _noncirc(seeds=0), False),
    ("non_circular seeds 11", _noncirc(seeds=11), False),
    ("non_circular seeds 2.5", _noncirc(seeds=2.5), False),
    ("non_circular max_vertices 8", _noncirc(max_vertices=8), False),
    ("non_circular max_vertices 16", _noncirc(max_vertices=16), False),
    ("non_circular max_vertices 34", _noncirc(max_vertices=34), False),
    ("non_circular unknown field", _noncirc(vertices=10), False),
    # version gate (F6.1)
    ("hoek_brown in 0.5", _both(_version("0.5"), _hb()), False),
    ("shansep in 0.5", _both(_version("0.5"), _sh()), False),
    ("ucs in 0.5", _both(_version("0.5"), _mc_with(ucs=1.0)), False),
    ("non_circular in 0.5", _both(_version("0.5"), _noncirc()), False),
    ("non_circular null in 0.5", _both(_version("0.5"), _search(non_circular=None)), True),
    ("null 0.6 fields in 0.5", _both(_version("0.5"), _mc_with(ucs=None, gsi=None, mi=None, disturbance=None, shansep=None)), True),
]

# Rules of F6.3 and F6.5 that only the engine enforces (E16n): the schema accepts, the engine rejects. JSON Schema
# cannot compare two values (`y` strictly increasing) nor relate two parts of the document (crack "auto" or Ito-Matsui
# with the new materials, Bishop with `non_circular`). Enmienda E16n (briefs/05_CONTRATOS_FASE3B.md).
V06_ENGINE_ONLY_TABLE = [
    ("ocr_by_elevation with y not increasing", _sh(_shan(pop=_DEL, ocr_by_elevation=[[10.0, 1.0], [5.0, 1.5]])), "ocr_by_elevation"),
    ("crack auto with hoek_brown", _both(_hb(), _crack("auto", 0.25)), "tension_crack.depth"),
    ("crack auto with shansep", _both(_sh(), _crack("auto", 0.25)), "tension_crack.depth"),
    ("ito-matsui with hoek_brown", _both(_hb(), _reinf(_ito())), "lateral_pressure"),
    ("ito-matsui with shansep", _both(_sh(), _reinf(_ito())), "lateral_pressure"),
    ("bishop with non_circular", _both(_noncirc(), _set("analysis.methods", ["bishop"])), "non_circular"),
]


def _prepare_v06(mutate) -> dict:
    model = _base_v06()
    mutate(model)
    return model


def test_every_case_the_battery_and_the_examples_validate_against_the_0_6_schema():
    jsonschema.Draft202012Validator.check_schema(SCHEMA_06)
    assert SCHEMA_06["$id"] == "ogs-0.6.schema.json"
    assert SCHEMA_06["properties"]["version"] == {"enum": ["0.1", "0.2", "0.3", "0.4", "0.5", "0.6"]}
    models = {**_case_models(), **_battery_models()}
    for path in glob.glob(os.path.join(ROOT, "examples", "*.ogs.json")):
        models[os.path.basename(path)] = _load(path)
    assert len(models) >= _index_case_count()
    for cid, model in models.items():
        if model["version"] == "0.7":      # V053 (CM, `global`) is a 0.7 case: the 0.7 schema validates it
            assert _errors(model, SCHEMA_07) == [], cid
            continue
        assert _errors(model, SCHEMA_06) == [], cid
    # the older schemas do not know 0.6
    assert _errors(_base_v06(), SCHEMA_05)


def test_the_v0_6_table_has_at_least_90_rows():
    assert len(V06_TABLE) >= 90 and len(V06_ENGINE_ONLY_TABLE) >= 6


@pytest.mark.parametrize("name,mutate,accepted", V06_TABLE, ids=[row[0] for row in V06_TABLE])
def test_schema_and_engine_agree_on_the_v0_6_table(name, mutate, accepted, tmp_path):
    model = _prepare_v06(mutate)
    schema_ok = _errors(model, SCHEMA_06) == []
    engine_ok, err = _engine_accepts(model, tmp_path)
    assert engine_ok == accepted, f"motor: esperado {'aceptar' if accepted else 'rechazar'}, dio {err or 'OK'}"
    assert schema_ok == accepted, f"esquema: esperado {'aceptar' if accepted else 'rechazar'}: {_errors(model, SCHEMA_06)[:2]}"


@pytest.mark.parametrize("name,mutate,path", V06_ENGINE_ONLY_TABLE, ids=[row[0] for row in V06_ENGINE_ONLY_TABLE])
def test_v0_6_engine_only_rules_pass_the_schema_and_fail_in_the_engine(name, mutate, path, tmp_path):
    model = _prepare_v06(mutate)
    assert _errors(model, SCHEMA_06) == [], name
    ok, err = _engine_accepts(model, tmp_path)
    assert not ok and "InvalidModel" in err and path in err, (name, err)


def test_the_engine_gate_names_the_v0_6_fields_and_the_schema_rejects_the_same_documents(tmp_path):
    """F6.1: with a version below 0.6 the error is `<campo> requiere version "0.6"`, naming the first field."""
    cases = [
        (_hb(), "hoek_brown"),
        (_sh(), "shansep"),
        (_mc_with(ucs=1.0), "ucs"),
        (_mc_with(gsi=1.0), "gsi"),
        (_mc_with(mi=1.0), "mi"),
        (_mc_with(disturbance=1.0), "disturbance"),
        (_mc_with(shansep=_SH_POP), "shansep"),
        (_noncirc(), "non_circular"),
    ]
    for mutate, token in cases:
        for old in ("0.1", "0.2", "0.3", "0.4", "0.5"):
            model = _prepare_v06(_both(_version(old), mutate))
            assert _errors(model, SCHEMA_06), (token, old)
            path = tmp_path / "gate.ogs.json"
            path.write_text(json.dumps(model), encoding="utf-8")
            proc = subprocess.run([_ogs(), "analyze", str(path)], capture_output=True, text=True, timeout=120)
            assert proc.returncode != 0 and 'requiere version "0.6"' in proc.stderr and token in proc.stderr, proc.stderr


@pytest.mark.parametrize("spec,valid", [
    ({}, True),
    ({"algorithm": "block", "generated": 50, "seed": 0, "polish": False}, True),
    ({"algorithm": "annealing", "generated": 2000, "seed": 9007199254740991}, True),
    ({"algorithm": "path"}, False), ({"generated": 49}, False),
    ({"generated": 2001}, False), ({"seed": -1}, False),
    ({"seed": 9007199254740992}, False), ({"typo": 1}, False),
])
def test_v07_global_schema(spec, valid):
    jsonschema.Draft202012Validator.check_schema(SCHEMA_07)
    model = copy.deepcopy(_case_models()["V001-nc"])
    model["version"] = "0.7"
    model["analysis"]["search"]["non_circular"]["global"] = spec
    assert (not _errors(model, SCHEMA_07)) == valid
    if valid:
        model["version"] = "0.6"
        assert _errors(model, SCHEMA_07)
        model["analysis"]["search"]["non_circular"]["global"] = None
        assert not _errors(model, SCHEMA_07)
