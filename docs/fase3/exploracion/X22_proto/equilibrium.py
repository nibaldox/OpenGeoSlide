"""Criterio 2: equilibrio global independiente.

No usa la recurrencia de Spencer ni los momentos `Mb`: con las fuerzas normales N' y de corte S de cada dovela (las del método),
suma fuerzas y momentos de TODA la masa con cada fuerza en su punto real:
  - peso W (+ cargas del motor V0) en x_mid de la dovela,
  - N total (N' + u·l) y S en el punto medio de la base (N hacia dentro de la masa, S contra el deslizamiento),
  - fuerzas de pilote en su punto de aplicación; las pasivas, divididas por el F del método (E14g).
Residuos normalizados: fuerzas por ΣW, momento (respecto del centro del círculo) por ΣW·R.
Bishop: se exige el momento. Janbu simplificado: la suma horizontal. Spencer / M-P: las tres ecuaciones.
"""
from __future__ import annotations
import math
import solvers


def _normal_shear(slices, f, lam, method, e=None):
    out = []
    if e is None and method != "bishop":
        e = solvers.interslice(slices, f, lam)
    for k, s in enumerate(slices):
        sin, cos = math.sin(s["alpha"]), math.cos(s["alpha"])
        tw, h, _, _ = solvers.eff(s, f)
        ul = s["pore_pressure"] * s["base_length"]
        if method == "bishop":
            m = cos + sin * s["tan_phi"] / f
            n_eff = (tw - (s["cohesion"] * s["base_length"] - ul * s["tan_phi"]) * sin / f) / m - ul
        else:
            n_eff = tw * cos - ul - h * sin + (sin - lam * cos) * (e[k + 1] - e[k])
        out.append((n_eff + ul, (s["cohesion"] * s["base_length"] + n_eff * s["tan_phi"]) / f))
    return out


def residuals(slices, f, lam, method, s_dir, circle, forces):
    xo, yo, rad = circle
    ns = _normal_shear(slices, f, lam, method)
    fx = fy = mo = sw = 0.0
    for sl, (n, sh) in zip(slices, ns):
        dx, dy = sl["x_right"] - sl["x_left"], sl["y_base_right"] - sl["y_base_left"]
        ln = math.hypot(dx, dy)
        nup = (-dy / ln, dx / ln)
        ts = (s_dir * dx / ln, s_dir * dy / ln)
        xm, ym = 0.5 * (sl["x_left"] + sl["x_right"]), 0.5 * (sl["y_base_left"] + sl["y_base_right"])
        bx, by = n * nup[0] - sh * ts[0], n * nup[1] - sh * ts[1]
        wv = sl["weight"] + sl["V0"]
        fx += bx
        fy += by - wv
        mo += (xm - xo) * (by - wv) - (ym - yo) * bx
        sw += sl["weight"]
    for pf in forces:
        k = 1.0 / f if pf["passive"] else 1.0
        px, py = pf["px"] * k, pf["py"] * k
        fx += px
        fy += py
        mo += (pf["x"] - xo) * py - (pf["y"] - yo) * px
    return {"Fx": fx / sw, "Fy": fy / sw, "M": mo / (sw * rad)}


def check(slices, out, s_dir, circle, forces):
    res = {}
    res["bishop"] = abs(residuals(slices, out["bishop"], 0.0, "bishop", s_dir, circle, forces)["M"])
    res["janbu_simplified"] = abs(residuals(slices, out["janbu_simplified"], 0.0, "janbu", s_dir, circle, forces)["Fx"])
    if out.get("lambda") is not None and out["spencer"]:
        r = residuals(slices, out["spencer"], out["lambda"], "spencer", s_dir, circle, forces)
        res["spencer"] = max(abs(r["Fx"]), abs(r["Fy"]), abs(r["M"]))
    return res
