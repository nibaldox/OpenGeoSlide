"""X30: SHANSEP sobre las dovelas del motor (prototipo, solo biblioteca estándar salvo el oráculo).

Idea: el motor 0.4.0 no conoce SHANSEP. Se le pasa un material `undrained` de reemplazo con el mismo γ (Su = 1 kPa,
placeholder) y el motor entrega las dovelas (peso, cargas, agua embalsada, u, geometría). El prototipo calcula, por
dovela, σ′v en el punto medio de la base y Su = ratio·σ′v·OCR^m, fija c = Su y tanφ = 0, y resuelve con solvers.py
(Bishop, Spencer, M-P constante, Janbu simplificado y corregido). Su no depende de F: no hay punto fijo.

Modelo de entrada: documento v0.6 provisional. Material SHANSEP:
  {"id", "name", "model": "shansep", "unit_weight", "unit_weight_sat"?, "ru"?,
   "shansep": {"ratio", "exponent"?, "ocr" | "pop" | "ocr_by_elevation"}}
Extensión sólo del prototipo (no es campo v0.6): "above_water": {"cohesion", "friction_angle", "unit_weight"} para el
material de V105a «Sand with clay» (aboveWater de cSlope).
"""
from __future__ import annotations

import copy
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import engine  # noqa: E402
import solvers  # noqa: E402

from pathlib import Path
REPO = str(Path(__file__).resolve().parents[4])
PLACE_SU = 1.0
METHODS = ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]


# ----------------------------------------------------------------------------- modelo y motor

def strip_shansep(model):
    """Modelo v0.6 -> (modelo v0.4 con materiales `undrained` de reemplazo, specs por índice de material)."""
    m = copy.deepcopy(model)
    specs = {}
    for i, mat in enumerate(m["materials"]):
        if mat.get("model") == "shansep":
            sp = dict(mat["shansep"])
            sp["unit_weight"] = mat["unit_weight"]
            sp["above_water"] = mat.get("above_water")
            specs[i] = sp
            mat["model"] = "undrained"
            mat["undrained_strength"] = PLACE_SU
            mat.pop("shansep", None)
            mat.pop("above_water", None)
    fw = m.get("water")
    if fw:
        fw.pop("free_water", None)
    return m, specs


def piezo_y(model, x):
    """Línea piezométrica custom (lineal a trozos, constante fuera de los extremos)."""
    pts = sorted(model["water"]["piezometric_line"], key=lambda p: p[0])
    if x <= pts[0][0]:
        return pts[0][1]
    if x >= pts[-1][0]:
        return pts[-1][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    raise ValueError("x fuera de la línea")


def interp_const(table, y):
    """Tabla [[y, OCR]] lineal, constante fuera de los extremos (como cSlope `interpolate_function`)."""
    pts = sorted(table, key=lambda p: p[0])
    if y <= pts[0][0]:
        return pts[0][1]
    if y >= pts[-1][0]:
        return pts[-1][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= y <= x1:
            return y0 + (y1 - y0) * (y - x0) / (x1 - x0)
    raise ValueError


def seismic_kv(model):
    return float(((model.get("analysis") or {}).get("seismic") or {}).get("kv", 0.0))


def sigma_v(sl, kv=0.0):
    """σ′v en el punto medio de la base: (W + cargas + agua embalsada − kv·W)/b − u.

    `weight_extra` del motor = kv·W + Q + V (slicer.rs:60-62). Se quita kv·W para que el sismo no entre en σ′v."""
    w_static = sl["weight"] + sl["weight_extra"] - kv * sl["weight"]
    return w_static / sl["width"] - sl["pore_pressure"]


def su_shansep(sv, yb, sp):
    """Su = ratio·σ′v·OCR^m con cSlope (strength.rs:657-700): σ′v ≤ 0 → Su = 0; OCR de pop > ocr_by_elevation > ocr."""
    if sv <= 0.0:
        return 0.0, 0.0
    m = sp.get("exponent", 0.8)
    if sp.get("pop") is not None:
        ocr = (sv + sp["pop"]) / sv
    elif sp.get("ocr_by_elevation"):
        ocr = interp_const(sp["ocr_by_elevation"], yb)
    else:
        ocr = sp.get("ocr", 1.0)
    ocr = max(ocr, 0.0)
    su = sp["ratio"] * sv * ocr ** m
    return max(su, 0.0), ocr


def engine_slices(model_v06, surface_fixed=True):
    """Dovelas del motor (0.4.0) con el material de reemplazo. Devuelve (dict por método, specs, modelo v0.4)."""
    m4, specs = strip_shansep(model_v06)
    res = engine.engine_results(m4)
    return res, specs, m4


def proto_fos(model_v06, methods=METHODS, return_slices=False):
    """FS por método con el prototipo. Superficie fija (círculo o polilínea) del modelo."""
    res, specs, m4 = engine_slices(model_v06)
    kv = seismic_kv(model_v06)
    ref = res.get("bishop") or res.get("spencer")
    slices = []
    for e in ref["slices"]:
        d = dict(e)
        d["V"], d["H"], d["Mb"], d["Dx"] = e["weight_extra"], e["h_force"], e["h_moment_base"], e["driving_extra"]
        d["_mat"] = e.get("material")
        slices.append(d)
    for d in slices:
        sv = sigma_v(d, kv)
        yb = 0.5 * (d["y_base_left"] + d["y_base_right"])
        sp = specs.get(d["_mat"])
        d["sv"] = sv
        d["yb"] = yb
        if sp is None:
            continue
        su, ocr = su_shansep(sv, yb, sp)
        d["ocr"] = ocr
        d["cohesion"], d["tan_phi"] = su, 0.0
        aw = sp.get("above_water")
        if aw and (not m4.get("water") or yb > piezo_y(m4, 0.5 * (d["x_left"] + d["x_right"]))):
            # cSlope aboveWater (slices.rs:722-732): y_bottom > nivel de agua en el centro → resistencia del material superior
            d["cohesion"] = aw.get("cohesion", 0.0)
            d["tan_phi"] = math.tan(math.radians(aw.get("friction_angle", 0.0)))
            d["above_water_used"] = True
    circ = (model_v06["analysis"].get("surface") or {}).get("type") == "circle"
    out = solvers.solve_all(slices, circular=circ)
    fos = {k: out.get(k) for k in methods if k in out}
    if "morgenstern_price" in fos and fos["morgenstern_price"] is None:
        pass
    if return_slices:
        return fos, slices
    return fos
