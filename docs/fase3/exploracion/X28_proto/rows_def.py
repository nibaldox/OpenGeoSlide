"""Definición de las filas de aceptación X21 (documentos ogs con los campos propuestos de v0.5)."""
from __future__ import annotations
import copy, json, math, os, sys

ROOT = "/home/xodla/archivos/opengeoslide"
BASE = json.load(open(f"{ROOT}/verification/cases/V047a.json"))["model"]
CIRCLE = {"type": "circle", "xc": 29.54334963719809, "yc": 53.63784815923435, "r": 28.641487934160704}
GW = 9.807     # cSlope 0.1.0 usa siempre 9,807 (to_cslope.py): las filas lo declaran para comparar sin ruido
ROWS: dict[str, dict] = {}
META: dict[str, dict] = {}


def v047a(surface=None):
    m = copy.deepcopy(BASE)
    m["analysis"].pop("search", None)
    m["analysis"]["surface"] = copy.deepcopy(surface or CIRCLE)
    m["version"] = "0.5"
    m["meta"] = {"id": "x21", "title": "X21"}
    return m


def mirror(m):
    m = copy.deepcopy(m)
    for r in m["regions"]:
        r["polygon"] = [[-x, y] for x, y in r["polygon"]][::-1]
    w = m.get("water") or {}
    if w.get("piezometric_line"):
        w["piezometric_line"] = [[-x, y] for x, y in w["piezometric_line"]][::-1]
    for ld in m.get("loads", []):
        if ld["type"] == "line":
            ld["x"] = -ld["x"]
        if ld["type"] == "udl":
            ld["x1"], ld["x2"] = -ld["x2"], -ld["x1"]
    s = m["analysis"]["surface"]
    if s["type"] == "circle":
        s["xc"] = -s["xc"]
    else:
        s["points"] = [[-x, y] for x, y in s["points"]][::-1]
    d = m["slope"]["direction"]
    m["slope"] = {"direction": "left_to_right" if d == "right_to_left" else "right_to_left"}
    return m


def add(rid, model, desc, group):
    ROWS[rid] = model
    META[rid] = {"desc": desc, "group": group}


def pond(level, extra=None, x=(0, 100)):
    m = v047a()
    m["water"] = {"unit_weight": GW, "piezometric_line": [[x[0], level], [x[1], level]], "free_water": True}
    if extra:
        extra(m)
    return m


def seismic(kh, kv):
    def f(m):
        m["analysis"]["seismic"] = {"kh": kh, "kv": kv}
    return f


# ---- agua embalsada sobre V047a (círculo fijo de F4.13)
add("X21-P01", pond(27.0), "V047a, círculo fijo, piezométrica horizontal y=27 (2 m sobre el pie), agua libre", "pond")
add("X21-P02", pond(30.0), "ídem, y=30 (5 m sobre el pie)", "pond")
add("X21-P03", mirror(pond(27.0)), "espejo de X21-P01 (left_to_right)", "pond")
add("X21-P04", pond(27.0, seismic(0.1, 0.0)), "X21-P01 con kh = 0,1", "pond-seis")
add("X21-P05", pond(27.0, seismic(0.0, 0.05)), "X21-P01 con kv = 0,05", "pond-seis")
add("X21-P06", pond(27.0, seismic(0.1, 0.05)), "X21-P01 con kh = 0,1 y kv = 0,05", "pond-seis")


# ---- grieta de tracción sobre V047a
def crack(depth, water=0.0, extra=None, free=False, level=None):
    m = v047a()
    m["analysis"]["tension_crack"] = {"depth": depth, "water": water}
    if free:
        m["water"] = {"unit_weight": GW, "piezometric_line": [[0, level], [100, level]], "free_water": True}
    elif water:
        m["water"] = {"unit_weight": GW}
    if extra:
        extra(m)
    return m


for d in (1.0, 2.0, 3.0):
    add(f"X21-C{int(d)}0", crack(d), f"V047a, círculo fijo, grieta seca de {d} m", "crack-dry")
for w in (0.25, 0.5, 1.0):
    add(f"X21-W{int(w*100):03d}", crack(2.0, w), f"V047a, círculo fijo, grieta de 2 m con agua al {int(w*100)} %", "crack-water")
add("X21-W100m", mirror(crack(2.0, 1.0)), "espejo de la grieta de 2 m llena (left_to_right)", "crack-water")


# ---- profundidad automática (Rankine)
def auto_row(mat=None, layers=False, level=None, water=0.0, hmax=None):
    m = v047a()
    if mat:
        m["materials"][0].update(mat)
        for k in [k for k, v in m["materials"][0].items() if v is None and k in ("cohesion", "friction_angle")]:
            del m["materials"][0][k]
    if layers:
        m["materials"].append({"id": "top", "name": "Top", "model": "mohr_coulomb", "unit_weight": 18.0,
                               "unit_weight_sat": None, "cohesion": 12.0, "friction_angle": 15.0, "ru": None})
        m["regions"] = [
            {"material": "soil", "polygon": [[20, 20], [20, 25], [30, 25], [40, 30], [70, 30], [70, 20]]},
            {"material": "top", "polygon": [[40, 30], [50, 35], [70, 35], [70, 30]]}]
    m["analysis"]["tension_crack"] = {"depth": "auto", "water": water}
    if level is not None:
        m["water"] = {"unit_weight": GW, "piezometric_line": [[0, level], [100, level]], "free_water": True}
    elif water:
        m["water"] = {"unit_weight": GW}
    return m


add("X21-A01", auto_row({"cohesion": 10.0}), "V047a con c = 10: z = 2c/(γ·tan(45° − φ/2)) = 1,4176 m, seca", "crack-auto")
add("X21-A02", auto_row({"cohesion": 10.0}, water=1.0), "ídem con la grieta llena", "crack-auto")
add("X21-A03", auto_row({"model": "undrained", "undrained_strength": 25.0, "cohesion": None, "friction_angle": None}),
    "material no drenado Su = 25 (φ = 0): z = 2Su/γ = 2,5 m", "crack-auto")
add("X21-A04", auto_row({"model": "undrained", "undrained_strength": 20.0, "strength_datum": 30.0,
                         "strength_gradient": 1.5, "cohesion": None, "friction_angle": None}),
    "no drenado con gradiente (Su = 20 + 1,5·(30 − y)): z con Su en el terreno de x", "crack-auto")
add("X21-A05", auto_row(layers=True), "dos capas: la grieta usa la capa de coronación (c=12, φ=15, γ=18)", "crack-auto")
add("X21-A06", auto_row({"cohesion": 10.0}, level=37.0), "c = 10, agua libre 2 m sobre la coronación: q = γw·2 resta a z", "crack-auto")
add("X21-A07", auto_row({"cohesion": 30.0}), "c = 30: z = 4,24 m > profundidad del círculo", "crack-auto")


# ---- cara de presa vertical (empuje puro) y círculo que sale por la banqueta
def dam(circle, level=9.0, ru=None):
    m = {"format": "opengeoslide", "version": "0.5", "meta": {"id": "x21-dam", "title": "cara vertical"}, "units": "SI",
         "materials": [{"id": "soil", "name": "Soil", "model": "mohr_coulomb", "unit_weight": 20.0,
                        "unit_weight_sat": None, "cohesion": 10.0, "friction_angle": 25.0, "ru": ru}],
         "regions": [{"material": "soil", "polygon": [[-30, -15], [-30, 0], [0, 0], [0, 12], [40, 12], [40, -15]]}],
         "water": {"unit_weight": GW, "piezometric_line": [[-30, level], [0, level], [10, 0], [40, 0]], "free_water": True},
         "slope": {"direction": "right_to_left"},
         "analysis": {"methods": ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"],
                      "slices": 200, "tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2,
                      "surface": circle}}
    return m


add("X21-D01", dam({"type": "circle", "xc": 12.0, "yc": 18.0, "r": 468 ** 0.5}),
    "cara de presa vertical de 12 m, agua a y=9; el círculo sale por el pie (0, 0): empuje puro de la cara", "pond-wall")
add("X21-D02", dam({"type": "circle", "xc": 12.0, "yc": 18.0, "r": 26.0}),
    "ídem con el círculo saliendo por la banqueta en x = -6,76: cara + peso del agua sobre la banqueta", "pond-wall")
add("X21-D03", mirror(dam({"type": "circle", "xc": 12.0, "yc": 18.0, "r": 468 ** 0.5})),
    "espejo de X21-D01 (left_to_right)", "pond-wall")
add("X21-D04", mirror(dam({"type": "circle", "xc": 12.0, "yc": 18.0, "r": 26.0})),
    "espejo de X21-D02 (left_to_right)", "pond-wall")


# ---- barridos de monotonía y filas de control
add("X21-P07", pond(26.0), "V047a, círculo fijo, piezométrica horizontal y=26 (1 m sobre el pie), agua libre", "pond")
add("X21-P08", pond(33.0), "ídem, y=33 (8 m sobre el pie, bajo la coronación)", "pond")
add("X21-N01", v047a(), "control de neutralidad: V047a sin agua ni grieta", "neutral")
add("X21-N02", pond(24.0), "control de neutralidad: agua libre activada pero la piezométrica queda bajo el terreno (y=24)", "neutral")
add("X21-N03", crack(0.0), "control de neutralidad: grieta de profundidad 0", "neutral")
