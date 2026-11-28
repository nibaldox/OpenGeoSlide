"""Definición de las filas de aceptación X22 (documentos ogs v0.4 + `lateral_pressure` propuesto para v0.5). Solo biblioteca estándar.

Las filas V013* usan los círculos críticos de cSlope (circles.json, de circles.py). Las sintéticas usan la geometría de V013a
(talud 1:1,5 de 10 m, MC c = 10, φ = 20°, γ = 20) con el círculo crítico de V013c, que cruza el pilote a 3,14 m de profundidad.
  python3 rows.py         escribe ../X22_filas/<id>.json
"""
from __future__ import annotations
import copy, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "X22_filas")
from pathlib import Path
ROOT = str(Path(__file__).resolve().parents[4])
BASE = json.load(open(f"{ROOT}/verification/cases/V013a.json"))["model"]
CIRC = json.load(open(os.path.join(HERE, "circles.json")))
GW = 9.807     # cSlope 0.1.0 usa siempre 9,807: las filas con agua lo declaran
ROWS: dict[str, dict] = {}
META: dict[str, str] = {}
METHODS = ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]


def pile(spacing, d, application="passive", loc="centroid", x=17.5, y1=5.0, y2=-10.0, **kw):
    p = {"type": "pile", "id": "P1", "x1": x, "y1": y1, "x2": x, "y2": y2, "spacing": spacing, "direction": "angle", "angle": 0.0,
         "application": application, "lateral_pressure": {"model": "ito_matsui", "diameter": d, "location": loc}}
    p.update(kw)
    return p


def base(circle, piles, rid, note):
    m = copy.deepcopy(BASE)
    m["version"] = "0.4"
    m["meta"] = {"id": rid, "title": rid, "notes": note}
    m["analysis"].pop("search", None)
    m["analysis"]["methods"] = list(METHODS)
    m["analysis"]["interslice"] = {"function": "constant"}
    m["analysis"]["surface"] = {"type": "circle", "xc": circle[0], "yc": circle[1], "r": circle[2]}
    m["slope"] = {"direction": "right_to_left"}
    if piles:
        m["reinforcements"] = piles
    ROWS[rid] = m
    META[rid] = note
    return m


def crit(key):
    c = CIRC[key]
    return (c["xc"], c["yc"], c["r"])


def mirror(m, rid):
    m = copy.deepcopy(m)
    for r in m["regions"]:
        r["polygon"] = [[-x, y] for x, y in r["polygon"]][::-1]
    w = m.get("water") or {}
    if w.get("piezometric_line"):
        w["piezometric_line"] = [[-x, y] for x, y in w["piezometric_line"]][::-1]
    for r in m.get("reinforcements", []):
        r["x1"], r["x2"] = -r["x1"], -r["x2"]
    s = m["analysis"]["surface"]
    s["xc"] = -s["xc"]
    m["slope"] = {"direction": "left_to_right"}
    m["meta"] = {"id": rid, "title": rid, "notes": "espejo de " + m["meta"]["id"]}
    ROWS[rid] = m
    META[rid] = m["meta"]["notes"]
    return m


def build():
    # ---- Cai y Ugai (2000) con el círculo crítico de cSlope; D = 0,8 m, spacing = 1,6; 2,4; 3,2; 4,8
    base(crit("V013b/centroid"), [pile(1.6, 0.8)], "X22-V013b",
         "D1/D = 2; el círculo crítico de cSlope sale en la cabeza del pilote (17,5; 5,0): sin cruce válido, la fila es neutra")
    for cid, sp in (("V013c", 2.4), ("V013d", 3.2), ("V013e", 4.8)):
        base(crit(f"{cid}/centroid"), [pile(sp, 0.8)], f"X22-{cid}", f"D1/D = {round(sp / 0.8 - 1)}; círculo crítico de cSlope con location centroid")
        base(crit(f"{cid}/slip-surface"), [pile(sp, 0.8, loc="slip_surface")], f"X22-{cid}-xs",
             f"D1/D = {round(sp / 0.8 - 1)}; círculo crítico de cSlope con location slip-surface; fuerza en el cruce")
    c13 = crit("V013c/centroid")
    # ---- sintéticas
    m = base(c13, [pile(2.4, 0.8, loc="centroid")], "X22-S01-phi0", "φ = 0: arcilla no drenada Su = 30, γ = 18; presión con tensión total")
    m["materials"] = [{"id": "soil", "name": "Clay", "model": "undrained", "unit_weight": 18.0, "unit_weight_sat": None,
                       "undrained_strength": 30.0, "ru": None}]
    m = base(c13, [pile(2.4, 0.8)], "X22-S02-cphi", "φ > 0: c = 5, φ = 25, γ = 19, seco")
    m["materials"] = [{"id": "soil", "name": "Soil", "model": "mohr_coulomb", "unit_weight": 19.0, "unit_weight_sat": None,
                       "cohesion": 5.0, "friction_angle": 25.0, "ru": None}]
    m = base(c13, [pile(2.4, 0.8)], "X22-S03-2capas",
             "dos capas: c-φ (c = 8, φ = 15, γ = 18) sobre y = 2,5 y arcilla no drenada (Su = 40, γ = 19) debajo; el pilote cruza el contacto")
    m["materials"] = [{"id": "up", "name": "Upper", "model": "mohr_coulomb", "unit_weight": 18.0, "unit_weight_sat": None,
                       "cohesion": 8.0, "friction_angle": 15.0, "ru": None},
                      {"id": "low", "name": "Lower", "model": "undrained", "unit_weight": 19.0, "unit_weight_sat": None,
                       "undrained_strength": 40.0, "ru": None}]
    m["regions"] = [{"material": "up", "polygon": [[13.75, 2.5], [25.0, 10.0], [35.0, 10.0], [35.0, 2.5]]},
                    {"material": "low", "polygon": [[0.0, -10.0], [0.0, 0.0], [10.0, 0.0], [13.75, 2.5], [35.0, 2.5], [35.0, -10.0]]}]
    m = base(c13, [pile(2.4, 0.8)], "X22-S04-agua",
             "bajo el agua: γ = 18, γsat = 20, c = 8, φ = 22; línea piezométrica por debajo del terreno (y = 3,5 en el pilote); σ'v = γ·z - u")
    m["materials"] = [{"id": "soil", "name": "Soil", "model": "mohr_coulomb", "unit_weight": 18.0, "unit_weight_sat": 20.0,
                       "cohesion": 8.0, "friction_angle": 22.0, "ru": None}]
    m["water"] = {"unit_weight": GW, "piezometric_line": [[0.0, 0.0], [10.0, 0.0], [25.0, 7.0], [35.0, 7.0]]}
    mirror(ROWS["X22-V013c"], "X22-S05-espejo")
    m = base(c13, [pile(1.0, 0.8)], "X22-S06-D1D-pequeno", "D1/D = 0,25 (spacing 1,0; d 0,8): fuera del rango 2-8 de la fórmula")
    m = base(c13, [pile(8.0, 0.8)], "X22-S07-D1D-grande", "D1/D = 9 (spacing 8; d 0,8); con c y φ la fórmula c-φ baja del piso de φ = 0")
    m = base(c13, [pile(2.4, 0.8, y1=3.0)], "X22-S08-cabeza-bajo-terreno", "cabeza del pilote en y = 3 (2 m bajo el terreno): se carga desde la cabeza")
    base(c13, [pile(2.4, 0.8, application="active")], "X22-S09-activo", "como V013c con application active (no se divide por F)")
    base(c13, [pile(2.4, 0.8, direction="tangent", angle=None)], "X22-S10-tangente", "como V013c con direction tangent")
    ROWS["X22-S10-tangente"]["reinforcements"][0].pop("angle")
    base(c13, [pile(2.4, 0.8, capacity={"shear": 150.0})], "X22-S11-capacidad-corte", "como V013c con capacidad a corte 150 kN por pilote (< fuerza del suelo 282,9)")
    base(c13, [pile(2.4, 0.8, capacity={"moment": 250.0})], "X22-S12-capacidad-momento", "como V013c con capacidad a flexión 250 kNm (M/Lm < fuerza del suelo)")
    base(c13, [pile(2.4, 0.8, loc="slip_surface")], "X22-L01-xs-mismo-circulo",
         "como X22-V013c (mismo círculo) con location slip_surface: aísla el efecto de la posición de la fuerza")
    for rid, app, dr in (("G01-force-pasivo", "passive", "angle"), ("G02-force-activo", "active", "angle"),
                         ("G03-force-tangente", "passive", "tangent")):
        p = {"type": "pile", "id": "P1", "x1": 17.5, "y1": 5.0, "x2": 17.5, "y2": -10.0, "force": 282.77, "spacing": 2.4,
             "direction": dr, "application": app}
        if dr == "angle":
            p["angle"] = 0.0
        base(c13, [p], "X22-" + rid, "pilote v0.4 con force 282,77 kN (sin Ito-Matsui): valida los términos pasivos/activos contra el motor")
    m = base(c13, [pile(2.4, 0.8)], "X22-S13-MC-phi0", "Mohr-Coulomb con φ = 0 (c = 30, γ = 18): cSlope lo trata como no drenado (tensión total, fórmula φ = 0)")
    m["materials"] = [{"id": "soil", "name": "Soil", "model": "mohr_coulomb", "unit_weight": 18.0, "unit_weight_sat": None,
                       "cohesion": 30.0, "friction_angle": 0.0, "ru": None}]
    m = base(c13, [pile(2.4, 0.8)], "X22-S14-ru", "razón de presión de poros ru = 0,3 (c = 10, φ = 20, γ = 20): σ'v = γz·(1 - ru)")
    m["materials"][0]["ru"] = 0.3
    m = base(c13, [pile(16.0, 0.8)], "X22-S15-piso-phi0", "D1/D = 19 con φ = 10° (c = 2, γ = 20): la fórmula c-φ da A1 y A2 menores que las de φ = 0; cSlope aplica el piso de φ = 0")
    m["materials"][0]["friction_angle"] = 10.0
    m["materials"][0]["cohesion"] = 2.0
    m = base(c13, [], "X22-N01-sin-pilote", "sin pilote (neutralidad: ni X22 ni el motor cambian)")
    base(c13, [pile(2.4, 0.8, x=10.0)], "X22-N02-fuera", "pilote en x = 10 (el pie): el cruce cae en el extremo de la superficie, sin fuerza")


def write():
    os.makedirs(OUT, exist_ok=True)
    build()
    for rid, m in ROWS.items():
        json.dump(m, open(os.path.join(OUT, rid + ".json"), "w"), indent=1)
    return list(ROWS)


if __name__ == "__main__":
    print(write())
