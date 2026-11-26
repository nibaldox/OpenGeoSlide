"""Tests del formato v0.4 (refuerzos) a través del binding de Python.

Se ejecutan contra el wheel instalado, como `test_smoke.py` y `test_v03.py`. Las filas son las de
`docs/fase3/exploracion/X17.md` (§4.3 a §4.5): el talud ACADS 1(a) (V047a) con el círculo fijo de F3.8 y un refuerzo.
Las cifras de referencia son del oráculo cSlope 0.1.0 (binario `a80f9a0`), escritas aquí con su origen, en este orden:
Bishop, Morgenstern-Price con función `constant`, Janbu corregido y Janbu simplificado. Aquí no se importa cSlope.
`analyze_json` delega íntegro en `ogs_core::analyze_json`, así que estos tests fijan que los cinco tipos de refuerzo, las
notas nuevas y `reinforcement_forces` llegan a Python sin cambios.

Tolerancia: 0,1 % (E14m-5). En las dos filas de `interface` donde gobierna la integral de arrancamiento es 0,25 %,
porque el oráculo discretiza esa integral en 200 pasos y ogs la integra exacta (hasta -0,47 % en T, X17 §2.1).
Los activos con `along > 0` no se comparan con el oráculo instalado: este los descarta y ogs los aplica (E14m-1).
"""

import copy
import json
from pathlib import Path

import pytest

import opengeoslide

REPO_ROOT = Path(__file__).resolve().parents[3]
ACADS1A = REPO_ROOT / "examples" / "acads1a.ogs.json"

V047A_CIRCLE = {"type": "circle", "xc": 29.54334963719809, "yc": 53.63784815923435, "r": 28.641487934160704}
METHODS = ["bishop", "morgenstern_price", "janbu_corrected", "janbu_simplified"]
REL = 1e-3
REL_INTERFACE = 2.5e-3
# Un cruce sin fuerza igual agrega los nodos x_c ± 1e-6·ancho (E14d.2): la dovela fina mueve el FS en ~5e-7 (relativo).
SAME_FOS = 1e-5
INTERFACE_ROWS = {"X17-cap-interface", "X17-cap-interface-cov.5-sp2"}
NOTES = {"reinforcement_outside_mass", "reinforcement_compression_ignored", "structural_checks_not_covered"}

# (fila de X17, reinforcements, (Bishop, M-P constant, Janbu corregido, Janbu simplificado)) del oráculo
ROWS = [
    ('F4.13-1', [{"type": "anchor", "id": "A1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "active", "tensile_capacity": 100, "direction": "axial"}], (1.333661, 1.329252, 1.319292, 1.261727)),
    ('F4.13-2', [{"type": "anchor", "id": "A1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 100, "direction": "axial"}], (1.248405, 1.245588, 1.252327, 1.197684)),
    ('F4.13-3', [{"type": "nail", "id": "N1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 150, "direction": "axial", "pullout": {"model": "bond", "strength": 30}}], (1.375819, 1.372304, 1.379714, 1.319513)),
    ('F4.13-5', [{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 60, "direction": "tangent", "pullout": {"model": "interface", "adhesion": 10, "friction_angle": 20, "coverage": 1}}], (1.139869, 1.137672, 1.142257, 1.092417)),
    ('F4.13-7', [{"type": "pile", "id": "P1", "x1": 40, "y1": 33, "x2": 40, "y2": 22, "application": "active", "force": 60, "direction": "angle", "spacing": 1.5, "angle": 0}], (1.108256, 1.105923, 1.101488, 1.053426)),
    ('F4.13-9', [{"type": "pile", "id": "P1", "x1": 40, "y1": 33, "x2": 40, "y2": 22, "application": "passive", "force": 60, "direction": "angle", "spacing": 1.5, "angle": 0}], (1.096378, 1.0944, 1.095828, 1.048013)),
    ('F4.13-11', [{"type": "sheet_pile", "id": "S1", "x1": 40, "y1": 33, "x2": 40, "y2": 22, "application": "active", "force": 120, "direction": "angle", "angle": 0}], (1.455483, 1.448712, 1.409314, 1.347821)),
    ('X17-inc-down15-act', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 62.079997, "y2": 21.011886, "application": "active", "tensile_capacity": 100, "direction": "axial"}], (1.322996, 1.318077, 1.29489, 1.23839)),
    ('X17-inc-down15-pas', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 62.079997, "y2": 21.011886, "application": "passive", "tensile_capacity": 100, "direction": "axial"}], (1.243443, 1.240298, 1.238103, 1.18408)),
    ('X17-inc-down30-act', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 14.5, "application": "active", "tensile_capacity": 100, "direction": "axial"}], (1.285084, 1.280634, 1.256961, 1.202115)),
    ('X17-inc-down30-pas', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 14.5, "application": "passive", "tensile_capacity": 100, "direction": "axial"}], (1.221758, 1.218764, 1.214059, 1.161085)),
    ('X17-inc-down45-act', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 55.091883, "y2": 8.908117, "application": "active", "tensile_capacity": 100, "direction": "axial"}], (1.227727, 1.224093, 1.205578, 1.152974)),
    ('X17-inc-down45-pas', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 55.091883, "y2": 8.908117, "application": "passive", "tensile_capacity": 100, "direction": "axial"}], (1.185452, 1.182804, 1.178531, 1.127108)),
    ('X17-inc-down30-tangent-act', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 14.5, "application": "active", "tensile_capacity": 100, "direction": "tangent"}], (1.345237, 1.339658, 1.303601, 1.246721)),
    ('X17-inc-down30-tangent-pas', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 14.5, "application": "passive", "tensile_capacity": 100, "direction": "tangent"}], (1.253323, 1.249952, 1.241631, 1.187454)),
    ('X17-inc-down30-bisector-act', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 14.5, "application": "active", "tensile_capacity": 100, "direction": "bisector"}], (1.355457, 1.349912, 1.315129, 1.257745)),
    ('X17-inc-down30-bisector-pas', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 14.5, "application": "passive", "tensile_capacity": 100, "direction": "bisector"}], (1.261041, 1.257672, 1.250143, 1.195595)),
    ('X17-inc-up15-act', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 62.079997, "y2": 34.988114, "application": "active", "tensile_capacity": 100, "direction": "axial"}], (1.310751, 1.31045, 1.351581, 1.292607)),
    ('X17-inc-up15-pas', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 62.079997, "y2": 34.988114, "application": "passive", "tensile_capacity": 100, "direction": "axial"}], (1.234156, 1.233673, 1.270174, 1.214752)),
    ('X17-inc-up30-act', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 41.5, "application": "active", "tensile_capacity": 100, "direction": "axial"}], (0.985084, 0.9841, 0.988354, 0.945229)),
    ('X17-inc-up30-pas', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 41.5, "application": "passive", "tensile_capacity": 100, "direction": "axial"}], (0.985084, 0.9841, 0.988354, 0.945229)),
    ('X17-inc-up45-act', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 55.091883, "y2": 47.091883, "application": "active", "tensile_capacity": 100, "direction": "axial"}], (0.985084, 0.9841, 0.988354, 0.945229)),
    ('X17-inc-up45-pas', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 55.091883, "y2": 47.091883, "application": "passive", "tensile_capacity": 100, "direction": "axial"}], (0.985084, 0.9841, 0.988354, 0.945229)),
    ('X17-cap-interface', [{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 1000, "direction": "axial", "pullout": {"model": "interface", "adhesion": 10, "friction_angle": 20, "coverage": 1}}], (1.681102, 1.676227, 1.684366, 1.610872)),
    ('X17-cap-interface-cov.5-sp2', [{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 1000, "direction": "axial", "spacing": 2, "pullout": {"model": "interface", "adhesion": 10, "friction_angle": 20, "coverage": 0.5}}], (1.340989, 1.337655, 1.344908, 1.286225)),
    ('X17-cap-interface-a0-d30', [{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 1000, "direction": "axial", "pullout": {"model": "interface", "adhesion": 0, "friction_angle": 30, "coverage": 1}}], (1.575984, 1.571536, 1.579539, 1.510619)),
    ('X17-cap-bond20-all', [{"type": "nail", "id": "N1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 1000, "direction": "axial", "pullout": {"model": "bond", "strength": 20}}], (1.315499, 1.312303, 1.319429, 1.261858)),
    ('X17-cap-tieback-bonded25', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 63, "y2": 28, "application": "active", "tensile_capacity": 150, "direction": "axial", "pullout": {"model": "bond", "strength": 20, "bonded_length": 25}}], (1.273594, 1.269798, 1.262995, 1.207886)),
    ('X17-cap-tieback-bonded10-end1=0', [{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 63, "y2": 28, "application": "active", "tensile_capacity": 150, "direction": "axial", "pullout": {"model": "bond", "strength": 20, "bonded_length": 10}}], (0.985084, 0.9841, 0.988354, 0.945229)),
    ('X17-cap-dev10/10', [{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 100, "direction": "axial", "pullout": {"model": "development", "length1": 10, "length2": 10}}], (1.240397, 1.237628, 1.244315, 1.190022)),
    ('X17-cap-dev15/20-end1=10', [{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 100, "direction": "axial", "end1_capacity": 10, "pullout": {"model": "development", "length1": 15, "length2": 20}}], (1.182758, 1.180341, 1.18662, 1.134844)),
    ('X17-cap-dev30/30-end2=5', [{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 100, "direction": "axial", "end2_capacity": 5, "pullout": {"model": "development", "length1": 30, "length2": 30}}], (1.071741, 1.07008, 1.075358, 1.028436)),
]


def v04_model(reinforcements: list[dict], methods: list[str] | None = None, fixed: bool = True) -> dict:
    """V047a como modelo v0.4: círculo fijo de F3.8 (50 dovelas, tolerancia 1e-5), se desliza hacia -x."""
    model = json.loads(ACADS1A.read_text(encoding="utf-8"))
    model["version"] = "0.4"
    model["slope"] = {"direction": "right_to_left"}
    if fixed:
        model["analysis"].pop("search")
        model["analysis"]["surface"] = dict(V047A_CIRCLE)
    model["analysis"]["methods"] = methods or METHODS
    if "morgenstern_price" in model["analysis"]["methods"]:
        model["analysis"]["interslice"] = {"function": "constant"}
    model["reinforcements"] = copy.deepcopy(reinforcements)
    return model


def by_method(report: dict) -> dict:
    return {r["method"]: r for r in report["results"]}


def nail(**fields) -> dict:
    return {"type": "nail", "id": "N1", "x1": 42, "y1": 31, "x2": 42, "y2": 22, "tensile_capacity": 100,
            "direction": "axial", **fields}


def anchor(**fields) -> dict:
    return {"type": "anchor", "id": "A1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "active",
            "tensile_capacity": 100, "direction": "axial", **fields}


def sheet_pile(**fields) -> dict:
    return {"type": "sheet_pile", "id": "S1", "x1": 40, "y1": 33, "x2": 40, "y2": 22, "application": "active",
            "force": 120, "direction": "angle", "angle": 0, **fields}


# ------------------------------------------------------------- filas de X17 contra el oráculo


@pytest.mark.parametrize("name, reinforcements, oracle", ROWS, ids=[row[0] for row in ROWS])
def test_rows_of_x17_match_the_oracle(name, reinforcements, oracle):
    results = by_method(opengeoslide.analyze(v04_model(reinforcements)))
    rel = REL_INTERFACE if name in INTERFACE_ROWS else REL
    for method, expected in zip(METHODS, oracle):
        assert results[method]["status"] == "converged", (name, method)
        assert results[method]["fos"] == pytest.approx(expected, rel=rel), (name, method)


def test_the_five_types_are_in_the_rows():
    types = {r["type"] for _, reinforcements, _ in ROWS for r in reinforcements}
    assert types == {"anchor", "nail", "geosynthetic", "pile", "sheet_pile"}
    pullouts = {r["pullout"]["model"] for _, reinforcements, _ in ROWS for r in reinforcements if "pullout" in r}
    assert pullouts == {"bond", "interface", "development"}


# --------------------------------------------------------------------- reinforcement_forces


def test_forces_of_the_f413_rows_have_the_documented_fields():
    # X17 §4.4: (x, y, disponible, Px, Py) de cada cruce, en coordenadas del modelo con y hacia arriba
    expected = {
        "F4.13-1": (42.3119, 28.0, 100.0, 100.0, 0.0),
        "F4.13-3": (42.3119, 28.0, 150.0, 150.0, 0.0),
        "F4.13-5": (42.3119, 28.0, 60.0, 53.7078, 26.7483),   # geomalla tangent: la fuerza se opone al movimiento
        "F4.13-7": (40.0, 26.9734, 40.0, 40.0, 0.0),          # pilote de 60 con spacing 1,5: 40 por metro
        "F4.13-11": (40.0, 26.9734, 120.0, 120.0, 0.0),       # tablestaca: fuerza por metro de muro
    }
    rows = {name: reinforcements for name, reinforcements, _ in ROWS}
    for name, (x, y, available, fx, fy) in expected.items():
        for result in opengeoslide.analyze(v04_model(rows[name]))["results"]:
            (force,) = result["reinforcement_forces"]
            assert set(force) == {"id", "crossing", "x", "y", "station", "available", "fx", "fy", "application", "status"}
            assert force["crossing"] == 0 and force["status"] == "applied"
            assert force["x"] == pytest.approx(x, abs=1e-3) and force["y"] == pytest.approx(y, abs=1e-3)
            assert force["available"] == pytest.approx(available, abs=1e-3)
            assert force["fx"] == pytest.approx(fx, abs=1e-3) and force["fy"] == pytest.approx(fy, abs=1e-3)


def test_a_passive_force_is_reported_before_dividing_by_f():
    rows = {name: reinforcements for name, reinforcements, _ in ROWS}
    for method, result in by_method(opengeoslide.analyze(v04_model(rows["F4.13-2"]))).items():
        (force,) = result["reinforcement_forces"]
        assert force["application"] == "passive"
        assert force["fx"] == pytest.approx(force["available"])  # se moviliza dividida por F, pero se informa sin dividir
        assert result["fos"] > 1.0


def test_the_report_omits_reinforcement_forces_without_reinforcements():
    for reinforcements in ([], None):
        model = v04_model([])
        if reinforcements is None:
            del model["reinforcements"]
        for result in opengeoslide.analyze(model)["results"]:
            assert "reinforcement_forces" not in result


def test_identity_without_reinforcements_matches_the_v01_model():
    base = json.loads(ACADS1A.read_text(encoding="utf-8"))
    empty = copy.deepcopy(base)
    empty["version"] = "0.4"
    empty["reinforcements"] = []
    assert opengeoslide.analyze(empty) == opengeoslide.analyze(base)


def test_analyze_json_returns_the_forces_as_text():
    text = opengeoslide.analyze_json(json.dumps(v04_model([anchor()], ["bishop"])))
    (result,) = json.loads(text)["results"]
    assert result["reinforcement_forces"][0]["id"] == "A1"


# ------------------------------------------------------------------------- estados y notas


def test_status_no_capacity_for_the_free_length_without_a_plate_and_no_note():
    # X17 §2.3: tirante de (36;28) a (63;28), bond 20 en los últimos 10 m, sin end1_capacity: T(s_c) = 0
    tieback = anchor(x1=36, x2=63, tensile_capacity=150, pullout={"model": "bond", "strength": 20, "bonded_length": 10})
    free = by_method(opengeoslide.analyze(v04_model([tieback])))
    plate = by_method(opengeoslide.analyze(v04_model([{**tieback, "end1_capacity": 150}])))
    for method, result in free.items():
        (force,) = result["reinforcement_forces"]
        assert force["status"] == "no_capacity" and force["available"] == 0.0 and force["fx"] == force["fy"] == 0.0
        assert not NOTES & set(result["warnings"])  # no_capacity no emite nota
        (applied,) = plate[method]["reinforcement_forces"]
        assert applied["status"] == "applied" and applied["available"] == pytest.approx(150.0)
        assert plate[method]["fos"] > result["fos"] + 0.1
    # sin fuerza, el FS es el del talud sin el refuerzo (0,985084 en Bishop, X17 §4.5)
    assert free["bishop"]["fos"] == pytest.approx(0.985084, rel=REL)


def test_a_passive_nail_that_would_be_compressed_is_ignored_with_its_note():
    # clavo vertical pasivo: along ≈ +0,44 en el cruce (X17 §1.4), más allá de cos 88°
    base = by_method(opengeoslide.analyze(v04_model([])))
    for method, result in by_method(opengeoslide.analyze(v04_model([nail(application="passive")]))).items():
        (force,) = result["reinforcement_forces"]
        assert force["status"] == "compression_ignored" and force["fx"] == force["fy"] == 0.0
        assert "reinforcement_compression_ignored" in result["warnings"]
        assert result["fos"] == pytest.approx(base[method]["fos"], rel=SAME_FOS)


def test_an_active_element_is_applied_in_full_even_when_compressed():
    # E14m-1: activo con along > 0: axial (u = d, hacia abajo), fuerza completa; el FS baja
    base = by_method(opengeoslide.analyze(v04_model([])))
    for method, result in by_method(opengeoslide.analyze(v04_model([nail(application="active")]))).items():
        (force,) = result["reinforcement_forces"]
        assert force["status"] == "applied"
        assert force["fx"] == pytest.approx(0.0, abs=1e-6) and force["fy"] == pytest.approx(-100.0)
        assert "reinforcement_compression_ignored" not in result["warnings"]
        assert result["fos"] < base[method]["fos"]


@pytest.mark.parametrize("row", ["X17-inc-up30-act", "X17-inc-up30-pas", "X17-inc-up45-act", "X17-inc-up45-pas"])
def test_elements_that_cross_in_the_air_give_the_note_and_the_slope_without_them(row):
    reinforcements = next(r for name, r, _ in ROWS if name == row)
    for method, result in by_method(opengeoslide.analyze(v04_model(reinforcements))).items():
        assert "reinforcement_outside_mass" in result["warnings"]
        assert all(f["status"] == "outside_mass" and f["fx"] == f["fy"] == 0.0 for f in result.get("reinforcement_forces", []))


def test_structural_checks_note_for_piles_and_sheet_piles_only():
    pile = {"type": "pile", "id": "P1", "x1": 40, "y1": 33, "x2": 40, "y2": 22, "application": "active", "force": 60,
            "spacing": 1.5, "direction": "angle", "angle": 0}
    for reinforcements, expected in (([pile], True), ([sheet_pile()], True), ([anchor()], False), ([], False)):
        for result in opengeoslide.analyze(v04_model(reinforcements))["results"]:
            assert ("structural_checks_not_covered" in result["warnings"]) is expected
    # también cuando la superficie no lo cruza (x = 60 está fuera de la masa)
    far = sheet_pile(x1=60, x2=60)
    for result in opengeoslide.analyze(v04_model([far]))["results"]:
        assert {"structural_checks_not_covered", "reinforcement_outside_mass"} <= set(result["warnings"])


# --------------------------------------------------------- identidades de la tablestaca


def test_sheet_pile_identities_zero_force_no_crossing_and_monotone_fos():
    base = by_method(opengeoslide.analyze(v04_model([])))
    zero = by_method(opengeoslide.analyze(v04_model([sheet_pile(force=0)])))
    for method, result in zero.items():
        assert result["fos"] == pytest.approx(base[method]["fos"], rel=SAME_FOS)
        assert result["reinforcement_forces"][0]["status"] == "no_capacity"
    fos = [by_method(opengeoslide.analyze(v04_model([sheet_pile(force=f)], ["bishop"])))["bishop"]["fos"] for f in (0, 40, 80, 120, 160)]
    assert all(b > a for a, b in zip(fos, fos[1:]))


def test_an_anchored_sheet_pile_adds_both_forces():
    tie = anchor(id="tirante", x1=40, y1=29, x2=64, y2=22.8, tensile_capacity=300, end1_capacity=300, spacing=2.5,
                 pullout={"model": "bond", "strength": 20, "bonded_length": 10})
    wall = sheet_pile(id="tablestaca", application="passive")
    both = opengeoslide.analyze(v04_model([wall, tie], ["bishop"]))["results"][0]
    only_wall = opengeoslide.analyze(v04_model([wall], ["bishop"]))["results"][0]
    only_tie = opengeoslide.analyze(v04_model([tie], ["bishop"]))["results"][0]
    assert [f["id"] for f in both["reinforcement_forces"]] == ["tablestaca", "tirante"]
    assert both["reinforcement_forces"][1]["available"] == pytest.approx(80.0)  # bulbo de 200 kN / spacing 2,5
    assert both["fos"] > only_wall["fos"] > 1.0 and both["fos"] > only_tie["fos"] > 1.0
    assert "structural_checks_not_covered" in both["warnings"] and "structural_checks_not_covered" not in only_tie["warnings"]


def test_the_readme_example_gives_the_documented_numbers():
    # crates/ogs-py/README.md y docs/formato-ogs-json.md (ejemplo «tablestaca-anclada»); fuerzas medidas con ogs
    tie = anchor(id="tirante", x1=40, y1=29, x2=64, y2=22.8, tensile_capacity=300, end1_capacity=300, spacing=2.5,
                 pullout={"model": "bond", "strength": 20, "bonded_length": 10})
    wall = sheet_pile(id="tablestaca", application="passive")
    results = by_method(opengeoslide.analyze(v04_model([wall, tie], ["bishop", "spencer"])))
    assert results["bishop"]["fos"] == pytest.approx(1.598, abs=5e-4)
    assert results["spencer"]["fos"] == pytest.approx(1.5921, abs=5e-5)
    tirante = results["bishop"]["reinforcement_forces"][1]
    assert (tirante["x"], tirante["fx"], tirante["fy"]) == pytest.approx((42.84, 77.5, -20.0), abs=5e-2)  # redondeados a 2 y 1 decimales


# ------------------------------------------------------------------------------ búsqueda


def test_search_with_reinforcements_reports_forces_on_the_final_surface_only():
    # la búsqueda puede esquivar el refuerzo (docs/limitaciones.md): aquí el círculo crítico no cruza el anclaje
    model = v04_model([anchor()], ["bishop"], fixed=False)
    (result,) = opengeoslide.analyze(model)["results"]
    assert result["status"] == "converged" and set(result["surface"]) == {"xc", "yc", "r"}
    assert result["search"] is not None
    for force in result.get("reinforcement_forces", []):
        assert force["status"] in {"applied", "outside_mass", "compression_ignored", "no_capacity"}
    if not result.get("reinforcement_forces") or all(f["status"] == "outside_mass" for f in result["reinforcement_forces"]):
        assert "reinforcement_outside_mass" in result["warnings"]


# --------------------------------------------------------------------------------- rechazos


def rejected(reinforcements: list[dict], match: str, version: str = "0.4"):
    model = v04_model(reinforcements, ["bishop"])
    model["version"] = version
    with pytest.raises(ValueError, match=match):
        opengeoslide.analyze(model)


def test_reinforcements_require_version_04():
    for version in ("0.1", "0.2", "0.3"):
        rejected([anchor()], r'^InvalidModel: reinforcements requiere version "0\.4"', version=version)


def test_errors_carry_the_json_path_of_the_field():
    interface = {"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive",
                 "tensile_capacity": 60, "direction": "axial",
                 "pullout": {"model": "interface", "adhesion": 10, "friction_angle": 20, "coverage": 1.5}}
    rejected([interface], r"InvalidModel: reinforcements\[0\]\.pullout\.coverage debe estar en \(0, 1\], no 1\.5")
    rejected([anchor(), anchor(id="A2", spacing=0)], r"reinforcements\[1\]\.spacing debe ser finito y mayor que 0")
    rejected([anchor(tensile_capacity=-5)], r"reinforcements\[0\]\.tensile_capacity")
    rejected([anchor(pullout={"model": "bond", "strength": 20, "bonded_length": 40})], r"reinforcements\[0\]\.pullout\.bonded_length")
    rejected([anchor(), anchor()], r"reinforcements\[1\]\.id: el id 'A1' está repetido")
    rejected([anchor(x2=52, y2=28)], r"reinforcements\[0\] tiene longitud 0")


def test_sheet_pile_and_pile_rules():
    rejected([sheet_pile(x2=41)], r"reinforcements\[0\]\.x2 debe ser igual a x1")
    rejected([sheet_pile(spacing=2)], r"unknown field `spacing`")
    rejected([sheet_pile(location="centroid")], r"unknown field `location`")  # E14m-3: location ya no existe
    rejected([sheet_pile(direction="tangent")], r"reinforcements\[0\]\.angle solo se admite con direction \"angle\"")
    rejected([{**sheet_pile(), "angle": None, "direction": "angle"}], r"reinforcements\[0\]\.angle es obligatorio")
    rejected([sheet_pile(angle=90)], r"reinforcements\[0\]\.angle debe estar en \(-90, 90\)")


def test_application_and_direction_are_mandatory():
    without_application = anchor()
    del without_application["application"]
    rejected([without_application], r"missing field `application`")
    without_direction = anchor()
    del without_direction["direction"]
    rejected([without_direction], r"missing field `direction`")
    rejected([anchor(direction="angle")], r"unknown variant `angle`")
    rejected([anchor(pullout={"model": "foo"})], r"unknown variant `foo`")
