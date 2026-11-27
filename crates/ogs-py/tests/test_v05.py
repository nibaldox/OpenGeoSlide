"""Tests del formato v0.5 (grieta de tracción, agua embalsada y pilotes de Ito-Matsui) a través del binding de Python.

Se ejecutan contra el wheel instalado, como `test_v03.py` y `test_v04.py`, y se corren con el procedimiento de
`docs/desarrollo.md` (`crates/ogs-py/README.md`, sección «Tests»). `analyze_json` delega íntegro en
`ogs_core::analyze_json`, así que estos tests fijan que los campos, los estados, los avisos y los errores de la v0.5 llegan
a Python sin cambios. Cuatro fuentes de verdad:

1. **Los ejemplos de `docs/formato-ogs-json.md`** (grieta seca, embalse al pie y pilote de Ito-Matsui, con sus fragmentos): el
   FS a 4 decimales, los avisos, el objeto `tension_crack` y el cruce de Ito-Matsui que declara cada marca. Es la misma
   lectura que hace `docs/tools/validar_ejemplos.py`, pero a través del wheel.
2. **Las 55 filas de X21** (grieta y agua embalsada, `crates/ogs-core/tests/data/f3g/`) y **las 28 de X22** (Ito-Matsui,
   `crates/ogs-core/tests/data/f3g3/`) contra el oráculo cSlope 0.1.0, a 0,1 %. Las cifras de referencia están en los
   `expected.json` de esas carpetas, con su origen: aquí no se importa cSlope y las filas se leen de donde las lee el motor.
3. **Propiedades** que no dependen del oráculo: neutralidad, espejo, monotonía con `water_fill`, continuidad con
   `depth → 0`, la compuerta de versión, los rechazos con su ruta y que la salida nunca lleve `NaN` ni `∞`.
4. **Las reproducciones de la revisión R12** (`docs/fase3/r12/repro/`): las enmiendas E15l-1, E15l-2 y E15l-11 ya están
   en el motor que se prueba, y los tres tests corren sin marcas `xfail`.
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
R12_REPRO = REPO_ROOT / "docs" / "fase3" / "r12" / "repro"

V047A_CIRCLE = {"type": "circle", "xc": 29.54334963719809, "yc": 53.63784815923435, "r": 28.641487934160704}
REL_ORACLE = 1e-3  # E15e-3: 0,1 % contra cSlope 0.1.0
V05_BASES = {"grieta-seca", "embalse-al-pie", "ito-matsui-centroide"}  # los ejemplos de la v0.5 de docs/formato-ogs-json.md


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


def test_the_three_v05_examples_of_the_format_doc_are_there():
    names = {p.values[0] for p in doc_cases() if p.id.startswith("ejemplo:")}
    assert names == V05_BASES


# ------------------------------------------------------------------ 2. las filas de X21 y de X22 (oráculo)


def rows(directory: Path) -> list:
    expected = json.loads((directory / "expected.json").read_text(encoding="utf-8"))
    return [pytest.param(directory, row_id, row, id=row_id) for row_id, row in expected["rows"].items()]


@pytest.mark.parametrize("directory, row_id, row", rows(X21_DIR) + rows(X22_DIR))
def test_rows_of_x21_and_x22_match_the_oracle(directory, row_id, row):
    doc = json.loads((directory / "rows" / f"{row_id}.json").read_text(encoding="utf-8"))
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


def test_the_rows_cover_crack_pond_and_ito_matsui():
    kinds = {row["kind"] for _, _, row in (p.values for p in rows(X21_DIR))}
    assert {"crack", "pond", "state"} <= kinds
    assert len(rows(X21_DIR)) >= 55 and len(rows(X22_DIR)) >= 28


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
    assert dry_dumps(opengeoslide.analyze(old)) == dry_dumps(opengeoslide.analyze({**dry_level, "version": "0.3"}))


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


# --------------------------------------------- 6. reproducciones de la revisión R12 (E15l-1, -2 y -11)


def run_repro(name: str, **overrides) -> dict:
    return opengeoslide.analyze(json.loads((R12_REPRO / name).read_text(encoding="utf-8")) | overrides)


def test_e15l_1_the_automatic_crack_at_the_model_edge_has_a_mirror():
    rtl, ltr = by_method(run_repro("a01_rtl.json")), by_method(run_repro("a01_ltr.json"))
    for method in rtl:
        assert rtl[method]["fos"] == pytest.approx(ltr[method]["fos"], rel=1e-9)
        assert rtl[method]["tension_crack"]["depth"] == pytest.approx(ltr[method]["tension_crack"]["depth"], rel=1e-9)
        assert rtl[method]["tension_crack"]["depth"] > 0.0


def test_e15l_2_a_crack_on_a_discontinuity_reports_the_face_it_cuts():
    for result in run_repro("a04_udl.json")["results"]:
        crack = result["tension_crack"]
        assert crack["depth"] > 0.0
        assert crack["water_force"] == pytest.approx(0.5 * 9.81 * crack["depth"] ** 2, rel=1e-9)  # water_fill = 1


def test_e15l_11_a_non_finite_ito_matsui_profile_is_an_invalid_model():
    with pytest.raises(ValueError, match=r"InvalidModel: reinforcements\[0\]\.lateral_pressure: la presión de Ito-Matsui no es finita"):
        run_repro("a02_fixed.json")
