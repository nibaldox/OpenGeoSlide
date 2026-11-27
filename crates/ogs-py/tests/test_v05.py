"""Tests del formato v0.5 (grieta de tracción, agua embalsada y pilotes de Ito-Matsui) a través del binding de Python.

Se ejecutan contra el wheel instalado, como `test_v03.py` y `test_v04.py`, y se corren con el procedimiento de
`docs/desarrollo.md` (`crates/ogs-py/README.md`, sección «Tests»). `analyze_json` delega íntegro en
`ogs_core::analyze_json`, así que estos tests fijan que los campos, los estados, los avisos y los errores de la v0.5 llegan
a Python sin cambios. Cuatro fuentes de verdad:

1. **Los ejemplos de `docs/formato-ogs-json.md`** (grieta seca, embalse al pie, pilote de Ito-Matsui y grieta con UDL y
   profundidad automática, con sus fragmentos): el FS a 4 decimales, los avisos, el objeto `tension_crack` y el cruce de
   Ito-Matsui que declara cada marca. Es la misma lectura que hace `docs/tools/validar_ejemplos.py`, pero a través del
   wheel.
2. **Las filas contra el oráculo cSlope 0.1.0**, a 0,1 %: las 55 de X21 (grieta y agua embalsada,
   `crates/ogs-core/tests/data/f3g/`) y las 3 de R12 con agua embalsada activa (`f3g/r12/`), las 28 de X22 (Ito-Matsui,
   `crates/ogs-core/tests/data/f3g3/`) y la de R12 (`f3g3/expected_r12.json`, `ru` con piezométrica). Las cifras de
   referencia están en los `expected*.json` de esas carpetas, con su origen: aquí no se importa cSlope y las filas se leen
   de donde las lee el motor.
3. **Propiedades** que no dependen del oráculo: neutralidad, espejo, monotonía con `water_fill`, continuidad con
   `depth → 0`, la compuerta de versión, los rechazos con su ruta y que la salida nunca lleve `NaN` ni `∞`.
4. **Las reproducciones de las revisiones R12 y R13** (`docs/fase3/r12/repro/` y `docs/fase3/r13/repro/`): E15l-1,
   E15l-5, E15l-6, E15l-7 y E15l-11, y E15m-1, E15m-2, E15m-6, E15m-7 y E15m-15 corren sin marcas. E15m-15 revisa E15l-2:
   la grieta sobre una discontinuidad toma profundidad y agua de `d(x_c)`, como cSlope, y el informe agrega
   `tension_crack.face_height` cuando la cara cortada difiere de `depth`.
"""

import copy
import json
import math
import re
from pathlib import Path

import pytest

import opengeoslide

REPO_ROOT = Path(__file__).resolve().parents[3]
ACADS1A = REPO_ROOT / "examples" / "acads1a.ogs.json"
FORMAT_DOC = REPO_ROOT / "docs" / "formato-ogs-json.md"
X21_DIR = REPO_ROOT / "crates" / "ogs-core" / "tests" / "data" / "f3g"
X22_DIR = REPO_ROOT / "crates" / "ogs-core" / "tests" / "data" / "f3g3"
X21_R12_DIR = X21_DIR / "r12"
R12_REPRO = REPO_ROOT / "docs" / "fase3" / "r12" / "repro"
R13_REPRO = REPO_ROOT / "docs" / "fase3" / "r13" / "repro"

V047A_CIRCLE = {"type": "circle", "xc": 29.54334963719809, "yc": 53.63784815923435, "r": 28.641487934160704}
REL_ORACLE = 1e-3  # E15e-3: 0,1 % contra cSlope 0.1.0
V05_BASES = {"grieta-seca", "embalse-al-pie", "ito-matsui-centroide", "grieta-udl-automatica"}  # los ejemplos de la v0.5 de docs/formato-ogs-json.md


# ------------------------------------------------------------------------------------------------- utilidades


def by_method(report: dict) -> dict:
    return {r["method"]: r for r in report["results"]}


def v05_model(methods: list[str] | None = None, **analysis) -> dict:
    """V047a (ACADS 1(a)) como modelo v0.5, con el círculo fijo de la búsqueda de Bishop y sentido hacia -x."""
    model = json.loads(ACADS1A.read_text(encoding="utf-8"))
    model["version"] = "0.5"
    model["slope"] = {"direction": "right_to_left"}
    model["analysis"].pop("search")
    model["analysis"]["surface"] = dict(V047A_CIRCLE)
    model["analysis"]["methods"] = methods or ["bishop", "spencer"]
    model["analysis"].update(analysis)
    return model


def with_crack(model: dict, depth, water_fill: float) -> dict:
    out = copy.deepcopy(model)
    out["analysis"]["tension_crack"] = {"depth": depth, "water_fill": water_fill}
    return out


def with_pond(model: dict, level: float = 27.0) -> dict:
    """V047a con la piezométrica horizontal a `level`: sobre el terreno del pie (y = 25) se forma un embalse."""
    out = copy.deepcopy(model)
    out["water"] = {"unit_weight": 9.81, "piezometric_line": [[20, level], [70, level]]}
    return out


def dry_dumps(report: dict) -> str:
    """El informe sin el nombre de la superficie, para compararlo literalmente."""
    return json.dumps(report, sort_keys=True)


def assert_finite(value, path="informe"):
    """Ningún número del informe es NaN ni infinito (E15l-11)."""
    if isinstance(value, float):
        assert math.isfinite(value), path
    elif isinstance(value, dict):
        for key, item in value.items():
            assert_finite(item, f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            assert_finite(item, f"{path}[{index}]")


# --------------------------------------------------------- 1. los ejemplos de docs/formato-ogs-json.md

MARK = re.compile(r"<!--\s*(ogs-ejemplo|ogs-fragmento)\s+(.*?)\s*-->\s*```json\n(.*?)```", re.S)


def attributes(text: str) -> dict:
    return dict(re.findall(r"(\w+)=(\S+)", text))


def set_path(doc: dict, path: str, value) -> dict:
    out = copy.deepcopy(doc)
    node = out
    parts = path.split(".")
    for part in parts[:-1]:
        node = node[int(part)] if isinstance(node, list) else node[part]
    if isinstance(node, list):
        node[int(parts[-1])] = value
    else:
        node[parts[-1]] = value
    return out


def doc_cases() -> list:
    """`(id, documento, atributos)` de los ejemplos y fragmentos de la v0.5 de `docs/formato-ogs-json.md`."""
    examples: dict[str, dict] = {}
    cases = []
    for kind, attrs_text, body in MARK.findall(FORMAT_DOC.read_text(encoding="utf-8")):
        attrs = attributes(attrs_text)
        value = json.loads(body)
        if kind == "ogs-ejemplo":
            examples[attrs["nombre"]] = value
            if attrs["nombre"] in V05_BASES:
                cases.append(pytest.param(attrs["nombre"], value, attrs, id=f"ejemplo:{attrs['nombre']}"))
        elif attrs["base"] in V05_BASES:
            doc = set_path(examples[attrs["base"]], attrs["ruta"], value)
            cases.append(pytest.param(f"{attrs['base']}:{attrs['ruta']}", doc, attrs, id=f"fragmento:{attrs['base']}:{attrs['ruta']}"))
    return cases


def check_report(name: str, results: list, attrs: dict) -> None:
    status, _, code = attrs.get("estado", "converged").partition(":")
    for r in results:
        assert r["status"] == status, (name, r["method"], r["status"], r["warnings"])
        if code:
            assert code in r["warnings"], (name, r["method"])
    for pair in filter(None, attrs.get("fos", "").split(",")):
        method, _, expected = pair.partition(":")
        assert by_method({"results": results})[method]["fos"] == pytest.approx(float(expected), abs=5.01e-5), (name, method)
    if "fuerzas" in attrs:
        expected = [] if attrs["fuerzas"] == "ninguna" else attrs["fuerzas"].split(",")
        for r in results:
            assert [f["status"] for f in r.get("reinforcement_forces", [])] == expected, (name, r["method"])
    if "grieta" in attrs:
        for r in results:
            crack = r.get("tension_crack")
            if attrs["grieta"] == "ninguna":
                assert crack is None, (name, r["method"], crack)
                continue
            for pair in attrs["grieta"].split(","):
                key, _, expected = pair.partition(":")
                assert crack is not None and crack[key] == pytest.approx(float(expected), abs=5.01e-5), (name, r["method"], key)
    if "cruce" in attrs:
        for r in results:
            crossing = (r.get("reinforcement_forces") or [None])[0]
            assert crossing is not None, (name, r["method"])
            for pair in attrs["cruce"].split(","):
                key, _, expected = pair.partition(":")
                if key == "governs":
                    assert crossing[key] == expected, (name, r["method"], key)
                else:
                    assert crossing[key] == pytest.approx(float(expected), abs=5.01e-5), (name, r["method"], key)
    for code in filter(None, attrs.get("avisos", "").split(",")):
        for r in results:
            assert code in r["warnings"], (name, r["method"], code)


@pytest.mark.parametrize("name, doc, attrs", doc_cases())
def test_documented_examples_run_through_the_wheel(name, doc, attrs):
    expected = attrs.get("esperado", "ok")
    if expected.startswith("error:"):
        substring = expected.split(":", 1)[1].replace("~", " ")
        with pytest.raises(ValueError) as exc:
            opengeoslide.analyze(doc)
        assert substring in str(exc.value), (name, str(exc.value))
        return
    report = opengeoslide.analyze(doc)
    check_report(name, report["results"], attrs)
    assert_finite(report)


def test_the_four_v05_examples_of_the_format_doc_are_there():
    names = {p.values[0] for p in doc_cases() if p.id.startswith("ejemplo:")}
    assert names == V05_BASES


# ------------------------------------------------------------------ 2. las filas de X21 y de X22 (oráculo)


def rows(directory: Path, expected_file: str = "expected.json") -> list:
    expected = json.loads((directory / expected_file).read_text(encoding="utf-8"))
    return [pytest.param(directory, row_id, row, id=row_id) for row_id, row in expected["rows"].items()]


def row_doc(directory: Path, row_id: str) -> dict:
    return json.loads((directory / "rows" / f"{row_id}.json").read_text(encoding="utf-8"))


ORACLE_ROWS = rows(X21_DIR) + rows(X21_R12_DIR) + rows(X22_DIR) + rows(X22_DIR, "expected_r12.json")


@pytest.mark.parametrize("directory, row_id, row", ORACLE_ROWS)
def test_rows_of_x21_and_x22_match_the_oracle(directory, row_id, row):
    doc = row_doc(directory, row_id)
    code = row.get("expect_error")
    if code:
        # X21-A07: el oráculo descarta la fila y el motor tiene que decir por qué (E15j-2)
        with pytest.raises(ValueError, match=f"NoValidSurface: {code}"):
            opengeoslide.analyze(doc)
        return
    results = by_method(opengeoslide.analyze(doc))
    assert row["oracle"], row_id
    for method, oracle in row["oracle"].items():
        assert results[method]["status"] == "converged", (row_id, method)
        assert results[method]["fos"] == pytest.approx(oracle, rel=REL_ORACLE), (row_id, method)


def test_the_ru_with_piezometric_row_matches_the_oracle_force_per_metre():
    # E15l-12: X22-S16-ru-piezo, la fuerza por metro del pilote (`available`) a 0,1 % del oráculo
    ((_, row_id, row),) = (p.values for p in rows(X22_DIR, "expected_r12.json"))
    force = row["force_per_metre"]
    (crossing,) = by_method(opengeoslide.analyze(row_doc(X22_DIR, row_id)))["bishop"]["reinforcement_forces"]
    assert crossing["status"] == force["estado"] and crossing["governs"] == force["gobierna"]
    assert crossing["available"] == pytest.approx(force["oracle"], rel=REL_ORACLE)


@pytest.mark.parametrize("directory, row_id, row", rows(X21_R12_DIR))
def test_the_r12_rows_have_active_ponded_terms(directory, row_id, row):
    # E15l-10: la superficie atraviesa el embalse, así que el peso y el empuje del agua actúan en cada método
    for result in opengeoslide.analyze(row_doc(directory, row_id))["results"]:
        weight = sum(abs(s["weight_extra"]) for s in result["slices"])
        thrust = sum(abs(s["h_force"]) for s in result["slices"])
        assert weight > 1.0 and thrust > 1.0, (row_id, result["method"], weight, thrust)


def test_the_rows_cover_crack_pond_and_ito_matsui():
    kinds = {row["kind"] for _, _, row in (p.values for p in rows(X21_DIR))}
    assert {"crack", "pond", "state"} <= kinds
    assert len(rows(X21_DIR)) >= 55 and len(rows(X22_DIR)) >= 28
    # R12: 3 filas con agua embalsada activa y la de `ru` con piezométrica
    assert len(rows(X21_R12_DIR)) == 3 and len(rows(X22_DIR, "expected_r12.json")) == 1
    assert len(ORACLE_ROWS) >= 55 + 3 + 28 + 1


# -------------------------------------------------------------------------------- 3. la grieta de tracción


def test_a_dry_crack_cuts_the_mass_and_reports_its_position():
    report = by_method(opengeoslide.analyze(with_crack(v05_model(), 2.0, 0.0)))
    for method, fos in (("bishop", 1.0263), ("spencer", 1.0256)):
        assert report[method]["fos"] == pytest.approx(fos, abs=5.01e-5)
        crack = report[method]["tension_crack"]
        assert set(crack) == {"x", "depth", "water_force"}
        assert crack["x"] == pytest.approx(48.7109, abs=5.01e-5) and crack["depth"] == 2.0 and crack["water_force"] == 0.0
        assert "truncated_mass" in report[method]["warnings"]
    # sin grieta el FS es 0,9851: la grieta seca de 2 m sube el FS (la masa que se quita empujaba), no es monótono
    assert by_method(opengeoslide.analyze(v05_model()))["bishop"]["fos"] == pytest.approx(0.9851, abs=5.01e-5)


def test_water_in_the_crack_is_a_horizontal_force_and_lowers_the_fos():
    values = []
    for water_fill in (0.0, 0.5, 1.0):
        result = by_method(opengeoslide.analyze(with_crack(v05_model(["bishop"]), 2.0, water_fill)))["bishop"]
        values.append((result["fos"], result["tension_crack"]["water_force"]))
    assert values[0][1] == 0.0
    assert values[1][1] == pytest.approx(0.5 * 9.81 * 1.0**2)  # ½·γw·(0,5·2)²
    assert values[2][1] == pytest.approx(0.5 * 9.81 * 2.0**2)  # ½·γw·(1·2)² = 19,62
    assert values[0][0] > values[1][0] > values[2][0]


def test_with_a_depth_going_to_zero_the_fos_tends_to_the_surface_without_crack():
    no_crack = by_method(opengeoslide.analyze(v05_model(["bishop"])))["bishop"]["fos"]
    thin = by_method(opengeoslide.analyze(with_crack(v05_model(["bishop"]), 1e-4, 0.0)))["bishop"]["fos"]
    assert thin == pytest.approx(no_crack, rel=1e-4)


def test_a_fixed_surface_that_does_not_reach_the_crack_is_an_analysis_error():
    with pytest.raises(ValueError, match="NoValidSurface: tension_crack_not_reached"):
        opengeoslide.analyze(with_crack(v05_model(), 20.0, 0.0))


def test_the_automatic_crack_is_the_rankine_depth():
    # V047a con c = 19,6 kPa... el modelo usa c, φ y γ de su material: z = 2c/(γ·tan(45° − φ/2))
    model = json.loads(ACADS1A.read_text(encoding="utf-8"))
    material = model["materials"][0]
    z = 2 * material["cohesion"] / (material["unit_weight"] * math.tan(math.radians(45 - material["friction_angle"] / 2)))
    crack = by_method(opengeoslide.analyze(with_crack(v05_model(["bishop"]), "auto", 0.0)))["bishop"]["tension_crack"]
    assert crack["depth"] == pytest.approx(z, rel=1e-4)


def test_the_crack_mirror_gives_the_same_fos():
    # espejo x → −x: mismo FS con el sentido del deslizamiento invertido (G5)
    model = with_crack(v05_model(["bishop", "spencer"]), 2.0, 1.0)
    mirror = copy.deepcopy(model)
    mirror["slope"] = {"direction": "left_to_right"}
    for region in mirror["regions"]:
        region["polygon"] = [[-x, y] for x, y in region["polygon"]]
    mirror["analysis"]["surface"]["xc"] = -mirror["analysis"]["surface"]["xc"]
    a, b = by_method(opengeoslide.analyze(model)), by_method(opengeoslide.analyze(mirror))
    for method in ("bishop", "spencer"):
        assert b[method]["fos"] == pytest.approx(a[method]["fos"], rel=1e-9)
        assert b[method]["tension_crack"]["x"] == pytest.approx(-a[method]["tension_crack"]["x"], abs=1e-6)


@pytest.mark.parametrize(
    "crack, message",
    [
        ({"depth": 2.0}, "analysis.tension_crack.water_fill es obligatorio"),
        ({"depth": 0.0, "water_fill": 0.0}, "analysis.tension_crack.depth debe ser finito y mayor que 0"),
        ({"depth": 2.0, "water_fill": 1.5}, "analysis.tension_crack.water_fill debe ser finito y estar en [0, 1]"),
    ],
)
def test_crack_errors_carry_their_json_path(crack, message):
    model = v05_model()
    model["analysis"]["tension_crack"] = crack
    with pytest.raises(ValueError, match="InvalidModel") as exc:
        opengeoslide.analyze(model)
    assert message in str(exc.value)


def test_a_non_finite_crack_depth_is_rejected_before_the_engine():
    model = v05_model()
    model["analysis"]["tension_crack"] = {"depth": float("nan"), "water_fill": 0.0}
    with pytest.raises(ValueError, match=r"InvalidModel: .*modelo\.analysis\.tension_crack\.depth"):
        opengeoslide.analyze(model)


def test_the_crack_and_the_pile_pressure_require_version_05():
    crack = with_crack(v05_model(), 2.0, 0.0)
    crack["version"] = "0.4"
    with pytest.raises(ValueError, match='tension_crack requiere version "0.5"'):
        opengeoslide.analyze(crack)
    pile = v05_model()
    pile["reinforcements"] = [ito_pile()]
    pile["version"] = "0.4"
    with pytest.raises(ValueError, match='lateral_pressure requiere version "0.5"'):
        opengeoslide.analyze(pile)


# ------------------------------------------------------------------------------------ 4. el agua embalsada


def test_ponded_water_is_included_in_every_version_and_keeps_its_note():
    # V047a con 2 m de agua sobre el pie: 0,939 (el valor de cSlope); con la v0.3.0 daba 0,848 y sin peso ni empuje del agua
    reports = {}
    for version in ("0.1", "0.2", "0.3", "0.4", "0.5"):
        model = with_pond(v05_model(["bishop"]))
        model["version"] = version
        reports[version] = opengeoslide.analyze(model)
    first = reports["0.1"]
    for version, report in reports.items():
        assert dry_dumps(report) == dry_dumps(first), version
    (result,) = first["results"]
    assert result["fos"] == pytest.approx(0.9392, abs=5.01e-5)
    assert "water_above_ground" in result["warnings"]  # nota informativa; el texto lo da la aplicación
    assert "negative_effective_normal" not in result["warnings"]


def test_the_ponded_water_weight_and_thrust_are_in_the_slices():
    pond = by_method(opengeoslide.analyze(with_pond(v05_model(["bishop"]))))["bishop"]
    # el agua libre suma peso (weight_extra, hacia abajo) y empuje horizontal (h_force) a las dovelas del pie
    assert sum(s["weight_extra"] for s in pond["slices"]) > 0.0
    assert any(s["h_force"] != 0.0 for s in pond["slices"])


def test_a_piezometric_line_under_the_ground_is_neutral():
    # E15e-1: sin agua sobre el terreno y sin grieta, la salida es la de siempre; y no se emite la nota
    dry_level = with_pond(v05_model(), level=22.0)
    result = by_method(opengeoslide.analyze(dry_level))
    for r in result.values():
        assert "water_above_ground" not in r["warnings"]
        assert all(s["weight_extra"] == 0.0 and s["h_force"] == 0.0 for s in r["slices"])
    old = copy.deepcopy(dry_level)
    old["version"] = "0.3"
    # la comparación real: el mismo modelo como v0.3 y como v0.5 (`dry_level` es v0.5) da el mismo informe (E15m-13)
    assert dry_level["version"] == "0.5" and old["version"] == "0.3"
    assert dry_dumps(opengeoslide.analyze(old)) == dry_dumps(opengeoslide.analyze(dry_level))


def test_the_crack_filled_with_water_needs_no_piezometric_line():
    # la grieta usa water.unit_weight y, si no está, el γw del modelo (9,81 en SI)
    model = with_crack(v05_model(["bishop"]), 2.0, 1.0)
    assert "water" not in model
    crack = by_method(opengeoslide.analyze(model))["bishop"]["tension_crack"]
    assert crack["water_force"] == pytest.approx(0.5 * 9.81 * 2.0**2)
    with_unit_weight = copy.deepcopy(model)
    with_unit_weight["water"] = {"unit_weight": 9.81}
    assert by_method(opengeoslide.analyze(with_unit_weight))["bishop"]["fos"] == by_method(opengeoslide.analyze(model))["bishop"]["fos"]


def test_the_seismic_force_does_not_act_on_the_pond():
    # E7: kh y kv actúan sobre el peso del suelo y no sobre el agua embalsada: sus términos no cambian con el sismo
    still = by_method(opengeoslide.analyze(with_pond(v05_model(["spencer"]))))["spencer"]
    shaken_model = with_pond(v05_model(["spencer"]))
    shaken_model["analysis"]["seismic"] = {"kh": 0.1, "kv": 0.05}
    shaken = by_method(opengeoslide.analyze(shaken_model))["spencer"]
    assert shaken["fos"] < still["fos"]
    for quiet, moved in zip(still["slices"], shaken["slices"]):
        water_weight = quiet["weight_extra"]  # solo agua: sin sismo, weight_extra es el peso del agua
        # con sismo, weight_extra = kv·W + peso del agua: la parte del agua no se multiplica por (1 + kv)
        assert moved["weight_extra"] == pytest.approx(water_weight + 0.05 * moved["weight"], rel=1e-9, abs=1e-9)


# ------------------------------------------------------------------------------------ 5. Ito-Matsui


def ito_pile(**fields) -> dict:
    """El pilote del ejemplo de `docs/formato-ogs-json.md` (talud de Cai y Ugai), con S/D = 3."""
    pile = {"type": "pile", "id": "P1", "x1": 17.5, "y1": 5.0, "x2": 17.5, "y2": -10.0, "spacing": 2.4,
            "application": "passive", "direction": "angle", "angle": 0,
            "lateral_pressure": {"model": "ito_matsui", "diameter": 0.8, "location": "centroid"}}
    pile.update(fields)
    return pile


def cai_ugai_model() -> dict:
    """El modelo del ejemplo `ito-matsui-centroide` del documento del formato, sin refuerzos."""
    for name, doc, attrs in (p.values for p in doc_cases()):
        if name == "ito-matsui-centroide":
            model = copy.deepcopy(doc)
            model["reinforcements"] = []
            return model
    raise AssertionError("falta el ejemplo ito-matsui-centroide")


def crossing_of(model: dict, method: str = "bishop") -> dict:
    (force,) = by_method(opengeoslide.analyze(model))[method]["reinforcement_forces"]
    return force


def test_the_ito_matsui_crossing_reports_soil_force_governs_and_arm():
    model = cai_ugai_model()
    model["reinforcements"] = [ito_pile()]
    for result in opengeoslide.analyze(model)["results"]:
        (force,) = result["reinforcement_forces"]
        assert force["status"] == "applied"
        assert force["soil_force"] == pytest.approx(117.9241, abs=5.01e-5)
        assert force["governs"] == "soil" and force["arm"] == pytest.approx(1.2238, abs=5.01e-5)
        assert "structural_checks_not_covered" in result["warnings"]
    # un pilote con force no trae esos tres campos (identidad con la v0.4)
    model["reinforcements"] = [{k: v for k, v in ito_pile().items() if k != "lateral_pressure"} | {"force": 120.0}]
    assert not {"soil_force", "governs", "arm"} & set(crossing_of(model))


def test_the_capacity_caps_the_force_and_reports_what_governs():
    model = cai_ugai_model()
    model["reinforcements"] = [ito_pile(capacity={"shear": 150.0, "moment": 250.0})]
    force = crossing_of(model)
    assert force["governs"] == "shear" and force["soil_force"] == pytest.approx(117.9241, abs=5.01e-5)
    assert force["available"] == pytest.approx(150.0 / 2.4)  # el tope de corte, por metro
    model["reinforcements"] = [ito_pile(capacity={"moment": 100.0})]
    bending = crossing_of(model)
    assert bending["governs"] == "bending"
    assert bending["available"] == pytest.approx(100.0 / bending["arm"] / 2.4, rel=1e-6)
    assert bending["available"] < bending["soil_force"]


def test_the_force_decreases_with_the_spacing_ratio_and_the_warning_marks_the_range():
    # E15i-9: la fuerza por pilote y por metro bajan con S/D (la fórmula sobrestima con S/D pequeño); el aviso marca 2 a 8
    forces, per_metre, warned = [], [], []
    for spacing in (1.6, 2.4, 3.2, 6.4, 7.2):  # S/D = 2, 3, 4, 8, 9 con D = 0,8
        model = cai_ugai_model()
        model["reinforcements"] = [ito_pile(spacing=spacing)]
        result = by_method(opengeoslide.analyze(model))["bishop"]
        soil_force = result["reinforcement_forces"][0]["soil_force"]
        per_metre.append(soil_force)
        forces.append(soil_force * spacing)  # por pilote
        warned.append("ito_matsui_spacing_range" in result["warnings"])
    assert forces == sorted(forces, reverse=True) and len(set(forces)) == len(forces)
    assert per_metre == sorted(per_metre, reverse=True) and len(set(per_metre)) == len(per_metre)
    assert warned == [False, False, False, False, True]


def test_a_pile_with_force_and_lateral_pressure_or_neither_is_rejected():
    model = cai_ugai_model()
    model["reinforcements"] = [ito_pile(force=100.0)]
    with pytest.raises(ValueError, match=r"reinforcements\[0\]: force y lateral_pressure se excluyen"):
        opengeoslide.analyze(model)
    model["reinforcements"] = [{k: v for k, v in ito_pile().items() if k != "lateral_pressure"}]
    with pytest.raises(ValueError, match="InvalidModel"):
        opengeoslide.analyze(model)


@pytest.mark.parametrize(
    "fields, message",
    [
        ({"spacing": 0.8}, "reinforcements[0].spacing debe ser mayor que lateral_pressure.diameter"),
        ({"x2": 18.5}, "reinforcements[0].x2 debe ser igual a x1"),
        ({"capacity": {}}, "reinforcements[0].capacity debe tener shear, moment o ambos"),
        ({"capacity": {"shear": -1.0}}, "InvalidModel"),
    ],
)
def test_the_pile_pressure_rejections(fields, message):
    model = cai_ugai_model()
    model["reinforcements"] = [ito_pile(**fields)]
    with pytest.raises(ValueError) as exc:
        opengeoslide.analyze(model)
    assert message in str(exc.value)


def test_the_ito_matsui_report_is_always_finite():
    for spacing in (2.4, 6.4, 20.0):
        model = cai_ugai_model()
        model["reinforcements"] = [ito_pile(spacing=spacing, capacity={"shear": 500.0, "moment": 900.0})]
        assert_finite(opengeoslide.analyze(model))


def test_without_lateral_pressure_the_report_is_the_v04_report():
    # E15i-9: N01 y N02 dan el FS sin pilote, y un modelo v0.4 con force no cambia al subir a 0.5
    base = v05_model()
    base["version"] = "0.4"
    base["reinforcements"] = [{"type": "pile", "id": "P1", "x1": 40, "y1": 33, "x2": 40, "y2": 22, "application": "passive",
                               "force": 60, "direction": "angle", "spacing": 1.5, "angle": 0}]
    up = copy.deepcopy(base)
    up["version"] = "0.5"
    assert dry_dumps(opengeoslide.analyze(up)) == dry_dumps(opengeoslide.analyze(base))


# --------------------------------------------- 6. reproducciones de la revisión R12 (E15l-1 y -11) y E15m-15 (que revisa E15l-2)


def run_repro(name: str, **overrides) -> dict:
    return opengeoslide.analyze(json.loads((R12_REPRO / name).read_text(encoding="utf-8")) | overrides)


def test_e15l_1_the_automatic_crack_at_the_model_edge_has_a_mirror():
    rtl, ltr = by_method(run_repro("a01_rtl.json")), by_method(run_repro("a01_ltr.json"))
    for method in rtl:
        assert rtl[method]["fos"] == pytest.approx(ltr[method]["fos"], rel=1e-9)
        assert rtl[method]["tension_crack"]["depth"] == pytest.approx(ltr[method]["tension_crack"]["depth"], rel=1e-9)
        assert rtl[method]["tension_crack"]["depth"] > 0.0


def test_e15m_15_a_crack_on_a_udl_edge_takes_the_depth_of_the_point_and_reports_the_face():
    # E15m-15 revisa E15l-2: bajo la UDL la profundidad de Rankine en x_c es 0, y la cara cortada va en `face_height`
    for result in run_repro("a04_udl.json")["results"]:
        crack = result["tension_crack"]
        assert crack["x"] == pytest.approx(-66.5, abs=5.01e-5)
        assert crack["depth"] == 0.0 and crack["water_force"] == 0.0, crack
        assert crack["face_height"] == pytest.approx(1.78272, abs=5.01e-6), crack


def test_e15l_11_a_non_finite_ito_matsui_profile_is_an_invalid_model():
    with pytest.raises(ValueError, match=r"InvalidModel: reinforcements\[0\]\.lateral_pressure: la presión de Ito-Matsui no es finita"):
        run_repro("a02_fixed.json")


# ------------------------------------- 7. R12 (E15l-5, -6 y -7) y R13 (E15m-1, -2, -6, -7 y -15) a través del wheel


def dam(depth: float = 14.0) -> dict:
    """La presa de R12B-03: muro vertical en x = 20 (y = 2..14), embalse a y = 10 en x ≤ 20 y un círculo que sale por el muro."""
    return {
        "format": "opengeoslide", "version": "0.5", "units": "SI",
        "materials": [{"id": "s", "name": "s", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 10.0, "friction_angle": 25.0}],
        "regions": [{"material": "s", "polygon": [[0, -depth], [0, 2], [20, 2], [20, 14], [40, 14], [40, -depth]]}],
        "slope": {"direction": "right_to_left"},
        "water": {"piezometric_line": [[0, 10], [40, 10]]},
        "analysis": {"methods": ["bishop", "spencer"], "slices": 50, "tolerance": 1e-9,
                     "surface": {"type": "circle", "xc": 19.0, "yc": 18.0, "r": 13.0}},
    }


def wall_a09() -> dict:
    """R12A-09: muro en x = 10 (y = 0..10), agua a y = 8 en el lado bajo y toda la masa en el lado alto."""
    return {
        "format": "opengeoslide", "version": "0.5", "units": "SI",
        "materials": [{"id": "s", "name": "s", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 10.0, "friction_angle": 25.0}],
        "regions": [{"material": "s", "polygon": [[0, -5], [0, 0], [10, 0], [10, 10], [30, 10], [30, -5]]}],
        "slope": {"direction": "right_to_left"},
        "water": {"piezometric_line": [[0, 8], [30, 8]]},
        "analysis": {"methods": ["bishop"], "slices": 50, "tolerance": 1e-9,
                     "surface": {"type": "circle", "xc": 12.0, "yc": 14.0, "r": 11.0}},
    }


def sum_h_force(result: dict) -> float:
    return sum(s["h_force"] for s in result["slices"])


def test_e15l_5_a_dam_with_only_the_wall_thrust_warns_water_above_ground():
    # R12B-03: el único término de agua es el empuje sobre el muro (la piezométrica queda bajo el terreno en cada dovela)
    for result in opengeoslide.analyze(dam())["results"]:
        assert abs(sum_h_force(result)) > 100.0, result["method"]
        assert "water_above_ground" in result["warnings"], (result["method"], result["warnings"])


def test_e15l_5_the_wall_of_a09_warns_water_above_ground():
    (result,) = opengeoslide.analyze(wall_a09())["results"]
    assert abs(sum_h_force(result)) > 100.0
    assert "water_above_ground" in result["warnings"], result["warnings"]


def test_e15l_5_without_water_or_with_the_line_under_the_ground_there_is_no_warning():
    dry = dam()
    del dry["water"]
    under = dam()
    under["water"] = {"piezometric_line": [[0, 1.0], [40, 1.0]]}
    for model in (dry, under):
        for result in opengeoslide.analyze(model)["results"]:
            assert "water_above_ground" not in result["warnings"], result["warnings"]


# E15l-6: el mismo modelo escrito en unidades imperiales, con los factores de `apps/web/src/editor/state/units.ts`
FT_PER_M = 1 / 0.3048
LBF_PER_KN = 1000 / 4.4482216152605


def to_imperial(model: dict, label: str = "imperial") -> dict:
    length, unit_weight, stress = FT_PER_M, LBF_PER_KN / FT_PER_M**3, LBF_PER_KN / FT_PER_M**2
    out = copy.deepcopy(model)
    out["units"] = label
    for material in out["materials"]:
        material["unit_weight"] *= unit_weight
        material["cohesion"] *= stress
    for region in out["regions"]:
        region["polygon"] = [[x * length, y * length] for x, y in region["polygon"]]
    surface = out["analysis"]["surface"]
    for key in ("xc", "yc", "r"):
        surface[key] *= length
    crack = out["analysis"].get("tension_crack")
    if crack and isinstance(crack["depth"], float):
        crack["depth"] *= length
    if "piezometric_line" in out.get("water", {}):
        out["water"]["piezometric_line"] = [[x * length, y * length] for x, y in out["water"]["piezometric_line"]]
    return out


def b01_si(**analysis) -> dict:
    """R12B-01: la grieta con agua de a01_ltr, sin bloque `water`."""
    model = json.loads((R12_REPRO / "a01_ltr.json").read_text(encoding="utf-8"))
    model["analysis"]["tolerance"] = 1e-12
    model["analysis"]["max_iterations"] = 5000
    model["analysis"]["tension_crack"] = {"depth": 2.0, "water_fill": 1.0}
    model["analysis"].update(analysis)
    return model


def assert_same_fos_and_scaled_force(imperial: dict, si: dict, what: str) -> None:
    a, b = by_method(opengeoslide.analyze(imperial)), by_method(opengeoslide.analyze(si))
    for method in ("bishop", "spencer"):
        assert a[method]["fos"] == pytest.approx(b[method]["fos"], rel=1e-9), (what, method)
        pw_si, pw_imp = b[method]["tension_crack"]["water_force"], a[method]["tension_crack"]["water_force"]
        assert pw_si > 0.0, what
        assert pw_imp == pytest.approx(pw_si * LBF_PER_KN / FT_PER_M, rel=1e-9), (what, method)  # lbf/ft


@pytest.mark.parametrize("label", ["imperial", "Imperial", " IMPERIAL "])
def test_e15l_6_the_crack_water_without_a_water_block_is_unit_invariant(label):
    si = b01_si()
    assert "water" not in si
    assert_same_fos_and_scaled_force(to_imperial(si, label), si, label)


def test_e15l_6_the_piezometric_line_without_unit_weight_is_unit_invariant_and_an_explicit_value_wins():
    si = b01_si()
    si["water"] = {"piezometric_line": [[-70.0, 32.0], [-20.0, 24.0]]}
    imperial = to_imperial(si)
    assert_same_fos_and_scaled_force(imperial, si, "línea piezométrica")
    explicit = copy.deepcopy(imperial)
    explicit["water"]["unit_weight"] = 9.81 * LBF_PER_KN / FT_PER_M**3  # 62,4493 pcf
    assert_same_fos_and_scaled_force(explicit, si, "γw explícito")
    # un valor explícito manda también en imperial: con 62,4 pcf la fuerza es ½·γw·h²
    explicit["water"]["unit_weight"] = 62.4
    pw = by_method(opengeoslide.analyze(explicit))["bishop"]["tension_crack"]["water_force"]
    assert pw == pytest.approx(0.5 * 62.4 * (2.0 * FT_PER_M) ** 2, rel=1e-9)


def test_e15l_6_in_si_the_default_is_9_81_and_an_explicit_value_is_the_same_model():
    si = b01_si()
    explicit = copy.deepcopy(si)
    explicit["water"] = {"unit_weight": 9.81}
    assert dry_dumps(opengeoslide.analyze(si)) == dry_dumps(opengeoslide.analyze(explicit))
    assert by_method(opengeoslide.analyze(si))["bishop"]["tension_crack"]["water_force"] == pytest.approx(0.5 * 9.81 * 2.0**2)


def search_with_crack(depth: float) -> dict:
    model = json.loads((R12_REPRO / "a01_ltr.json").read_text(encoding="utf-8"))
    model["analysis"]["tension_crack"] = {"depth": depth, "water_fill": 1.0}
    del model["analysis"]["surface"]
    model["analysis"]["search"] = {"type": "circular_entry_exit"}
    return model


def test_e15l_7_a_search_without_surfaces_names_the_crack_with_its_count():
    with pytest.raises(ValueError) as exc:
        opengeoslide.analyze(search_with_crack(40.0))
    message = str(exc.value)
    prefix = "NoValidSurface: la búsqueda con bishop no encontró ninguna superficie convergida ("
    assert message.startswith(prefix), message
    match = re.fullmatch(r"(\d+) evaluadas, 0 válidas; (\d+) no alcanzan la grieta de tracción, tension_crack_not_reached\)", message[len(prefix):])
    assert match, message
    evaluated, discarded = int(match[1]), int(match[2])
    assert 0 < discarded <= evaluated, message


def test_e15l_7_without_candidates_discarded_by_the_crack_the_message_is_the_usual_one():
    model = search_with_crack(40.0)
    del model["analysis"]["tension_crack"]
    model["analysis"]["search"] = {"type": "circular_entry_exit", "min_width": 1000.0, "n_entry": 4, "n_exit": 4, "n_radius": 4}
    with pytest.raises(ValueError) as exc:
        opengeoslide.analyze(model)
    message = str(exc.value)
    assert message.startswith("NoValidSurface: la búsqueda con bishop no encontró ninguna superficie convergida (")
    assert message.endswith(" válidas)") and "grieta" not in message and "tension_crack" not in message, message


# E15m-1: con `depth` numérica la profundidad es siempre la del usuario (enmienda de E15l-2)


def test_e15m_1_a_fixed_crack_on_a_ground_step_keeps_the_depth_of_the_user():
    # a03_escalon_fija.json: grieta fija de 2 m en x = 5, sobre un escalón del terreno
    report = by_method(opengeoslide.analyze(json.loads((R13_REPRO / "a03_escalon_fija.json").read_text(encoding="utf-8"))))
    for method in ("bishop", "spencer"):
        crack = report[method]["tension_crack"]
        assert crack["depth"] == 2.0, (method, crack)
        assert crack["water_force"] == pytest.approx(0.5 * 9.81 * 2.0**2, rel=1e-9), (method, crack)  # Pw = 19,62
    assert report["bishop"]["fos"] == pytest.approx(1.882066, abs=5.01e-7)  # E15m-1; el contrato fija 6 decimales


# E15m-15: la grieta sobre una discontinuidad sigue a cSlope (profundidad y agua de d(x_c)) y el informe trae `face_height`


def repro(name: str) -> dict:
    directory = R12_REPRO if name.startswith("a04") else R13_REPRO
    return by_method(opengeoslide.analyze(json.loads((directory / name).read_text(encoding="utf-8"))))


def test_e15m_15_the_udl_example_follows_cslope():
    # a04_udl.json (`depth: "auto"` sobre una UDL): 1,102248 (E15l-2 daba 1,095348, −0,63 % frente a cSlope 1,102311)
    report = repro("a04_udl.json")
    assert report["bishop"]["fos"] == pytest.approx(1.102248, abs=5.01e-7)
    assert report["spencer"]["fos"] == pytest.approx(1.100895, abs=5.01e-7)
    assert report["bishop"]["fos"] == pytest.approx(1.102311, rel=REL_ORACLE)  # cSlope 0.1.0, superficie fija


@pytest.mark.parametrize(
    "name, depth, water_force, bishop, cslope",
    [
        ("a03_escalon_auto.json", 2.61614, 33.57, 1.862343, 1.862416),  # E15l-2 daba 1,751144 (−6,0 %)
        ("a03_escalon_fija.json", 2.0, 19.62, 1.882066, 1.882138),  # la fija no cambia (E15m-1)
    ],
)
def test_e15m_15_the_ground_step_follows_cslope_and_reports_the_face(name, depth, water_force, bishop, cslope):
    report = repro(name)
    assert report["bishop"]["fos"] == pytest.approx(bishop, abs=5.01e-7)
    assert report["bishop"]["fos"] == pytest.approx(cslope, rel=REL_ORACLE)
    for method in ("bishop", "spencer"):
        crack = report[method]["tension_crack"]
        assert crack["depth"] == pytest.approx(depth, abs=5.01e-6) and crack["water_force"] == pytest.approx(water_force, abs=5.01e-3), crack
        assert crack["water_force"] == pytest.approx(0.5 * 9.81 * crack["depth"] ** 2, rel=1e-9), crack  # water_fill = 1: Pw con depth
        assert crack["face_height"] == pytest.approx(4.97068, abs=5.01e-6), crack


def test_e15m_15_face_height_is_only_reported_when_it_differs_from_the_depth():
    # presente en la UDL y en el escalón (arriba); ausente en una grieta normal: la salida de siempre
    for result in opengeoslide.analyze(with_crack(v05_model(), 2.0, 1.0))["results"]:
        assert set(result["tension_crack"]) == {"x", "depth", "water_force"}, result["tension_crack"]
    for result in opengeoslide.analyze(with_crack(v05_model(), "auto", 1.0))["results"]:
        assert "face_height" not in result["tension_crack"], result["tension_crack"]
    for name in ("a04_udl.json", "a03_escalon_auto.json", "a03_escalon_fija.json"):
        for result in repro(name).values():
            face = result["tension_crack"]["face_height"]
            assert math.isfinite(face) and face > 0.0 and abs(face - result["tension_crack"]["depth"]) > 1e-3, (name, result["tension_crack"])


# E15m-2: un vértice a 1e-12 del paramento no hace perder el empuje


def paramento(dx: float) -> dict:
    model = json.loads((R13_REPRO / "a02_paramento_dx0.json").read_text(encoding="utf-8"))
    model["analysis"]["surface"]["points"][0][0] = 20.0 + dx
    return model


@pytest.mark.parametrize("dx", [1e-12, 1e-9])
def test_e15m_2_a_vertex_next_to_the_wall_gives_the_same_fos_and_thrust(dx):
    base, moved = by_method(opengeoslide.analyze(paramento(0.0))), by_method(opengeoslide.analyze(paramento(dx)))
    for method in ("spencer", "janbu_simplified"):
        assert abs(sum_h_force(base[method])) > 100.0, method  # el empuje del paramento actúa
        assert moved[method]["fos"] == pytest.approx(base[method]["fos"], rel=1e-6), (method, dx)
        assert sum_h_force(moved[method]) == pytest.approx(sum_h_force(base[method]), rel=1e-6), (method, dx)


# E15m-6: aviso informativo `water_unit_weight_default` (γw por defecto en imperial) y excepción de identidad declarada


def with_ponded_water(model: dict, **water) -> dict:
    out = copy.deepcopy(model)
    out["water"] = {"piezometric_line": [[-70.0, 32.0], [-20.0, 24.0]], **water}
    return out


def imperial_water_models() -> dict:
    """Los usos del agua sin `water.unit_weight`: piezométrica, agua embalsada y agua en la grieta (R13B-01)."""
    crack = b01_si()
    ponded, under = with_pond(v05_model([]), 27.0), with_pond(v05_model([]), 22.0)
    del ponded["water"]["unit_weight"], under["water"]["unit_weight"]
    return {
        "grieta con agua": to_imperial(crack),
        "piezométrica": to_imperial(with_ponded_water(crack)),
        "agua embalsada": to_imperial(ponded),
        "piezométrica bajo el terreno": to_imperial(under),  # el caso de R13B-01: sin agua sobre el terreno ni grieta
    }


WATER_USES = list(imperial_water_models())


@pytest.mark.parametrize("use", WATER_USES)
def test_e15m_6_imperial_water_without_unit_weight_warns_once_per_analysis(use):
    for result in opengeoslide.analyze(imperial_water_models()[use])["results"]:
        assert result["warnings"].count("water_unit_weight_default") == 1, (use, result["method"], result["warnings"])


@pytest.mark.parametrize("use", WATER_USES)
def test_e15m_6_an_explicit_unit_weight_in_imperial_gives_no_warning(use):
    model = imperial_water_models()[use]
    model.setdefault("water", {})["unit_weight"] = 9.81 * LBF_PER_KN / FT_PER_M**3
    for result in opengeoslide.analyze(model)["results"]:
        assert "water_unit_weight_default" not in result["warnings"], (use, result["warnings"])


def test_e15m_6_a_model_without_water_gives_no_warning_in_imperial():
    model = to_imperial(b01_si())
    del model["analysis"]["tension_crack"]
    assert "water" not in model
    for result in opengeoslide.analyze(model)["results"]:
        assert "water_unit_weight_default" not in result["warnings"]


def test_e15m_6_in_si_there_is_no_warning_and_the_report_is_the_same_as_with_the_explicit_value():
    # E15m-6: en SI el valor no cambia y la salida es la de siempre, byte a byte
    for si in (b01_si(), with_ponded_water(b01_si())):
        explicit = copy.deepcopy(si)
        explicit.setdefault("water", {})["unit_weight"] = 9.81
        report = opengeoslide.analyze(si)
        for result in report["results"]:
            assert "water_unit_weight_default" not in result["warnings"]
        assert dry_dumps(report) == dry_dumps(opengeoslide.analyze(explicit))


# E15m-7: un brazo o una fuerza no finitos de Ito-Matsui son un error, nunca `null` ni `no_capacity`


def test_e15m_7_a_pile_arm_that_overflows_is_an_error_or_a_finite_report():
    model = json.loads((R13_REPRO / "a01_arm_null.json").read_text(encoding="utf-8"))
    try:
        report = opengeoslide.analyze(model)
    except ValueError as error:
        assert "InvalidModel: reinforcements[0].lateral_pressure" in str(error), str(error)
        return
    assert_finite(report)
    for result in report["results"]:
        for force in result["reinforcement_forces"]:
            assert force["arm"] is not None and force["arm"] > 0.0, (result["method"], force)
            assert force["status"] != "no_capacity", (result["method"], force)
            assert force["governs"] in {"soil", "shear", "bending"}, (result["method"], force)
