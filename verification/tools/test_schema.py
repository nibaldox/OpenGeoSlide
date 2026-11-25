"""Tests of schema/ogs-0.2.schema.json (contract F1.1). Run from the worktree root:

    env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with jsonschema --with pytest \\
        python -m pytest -q verification/tools/test_schema.py

- the 21 cases of verification/cases, the 4+10 models of the differential battery and examples/ validate;
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
    ("version='0.3'", _set("version", "0.3"), False),
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
