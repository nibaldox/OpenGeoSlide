"""Criterio 2: equilibrio global independiente (suma de fuerzas y momentos con las posiciones reales).

No usa la recurrencia de Spencer ni h_moment_base: toma las fuerzas N', S de cada dovela del método y suma
  - peso W y V del motor en x_mid, las fuerzas nuevas en su punto real (campos brutos `raw`),
  - N en el punto medio de la base (normal hacia la dovela) y S en sentido contrario al deslizamiento.
Residuos normalizados por ΣW (fuerzas) y ΣW·L (momento respecto del centro del círculo, o del pie si es polilínea)."""
from __future__ import annotations
import math
import solvers


def _forces(slices, f, lam, e, method):
    out = []
    for k, s in enumerate(slices):
        sin, cos = math.sin(s["alpha"]), math.cos(s["alpha"])
        tw = s["weight"] + s["V"]
        if method == "bishop":
            m = cos + sin * s["tan_phi"] / f
            n = (tw - (s["cohesion"] * sin - s["pore_pressure"] * s["base_length"] * 0 - s["pore_pressure"] * s["width"] * s["tan_phi"] * sin / s["width"] * 0) / 1.0) if False else None
            num = tw - (s["cohesion"] * s["base_length"] - s["pore_pressure"] * s["base_length"] * s["tan_phi"]) * sin / f
            # N' = (W* - (c l - u l tan(phi)) sin(a)/F) / m_a - u l
            n_eff = num / m - s["pore_pressure"] * s["base_length"]
        else:
            de = e[k + 1] - e[k]
            n_eff = tw * cos - s["pore_pressure"] * s["base_length"] - s["H"] * sin + (sin - lam * cos) * de
        shear = (s["cohesion"] * s["base_length"] + n_eff * s["tan_phi"]) / f
        out.append((n_eff + s["pore_pressure"] * s["base_length"], shear))
    return out


def residuals(slices, f, lam, method, s_dir, circle, e=None):
    if e is None:
        e = solvers.interslice(slices, f, lam)
    ns = _forces(slices, f, lam, e, method)
    if circle:
        xo, yo, L = circle[0], circle[1], circle[2]
    else:
        xo, yo = slices[0]["x_left"], slices[0]["y_base_left"]
        L = abs(slices[-1]["x_right"] - slices[0]["x_left"])
    fx = fy = mo = sw = 0.0
    for sl, (n, sh) in zip(slices, ns):
        dx, dy = sl["x_right"] - sl["x_left"], sl["y_base_right"] - sl["y_base_left"]
        ln = math.hypot(dx, dy)
        that = (dx / ln, dy / ln)
        nup = (-dy / ln, dx / ln)
        ts = (s_dir * that[0], s_dir * that[1])
        xm = 0.5 * (sl["x_left"] + sl["x_right"])
        ym = 0.5 * (sl["y_base_left"] + sl["y_base_right"])
        raw = sl.get("raw", {"V": 0.0, "VM": 0.0, "H": 0.0, "HY": 0.0})
        v_eng = sl["weight"] + sl["V"] - raw["V"]          # peso del suelo + fuerzas verticales del motor, en x_mid
        h_eng = sl["H"] - raw["H"]                         # (solo se usa sin sismo ni cargas: h_eng = 0)
        # fuerzas
        fxs = n * nup[0] - sh * ts[0] + s_dir * (h_eng + raw["H"])
        fys = n * nup[1] - sh * ts[1] - v_eng - raw["V"]
        fx += fxs
        fy += fys
        # momentos respecto de O (x Fy - y Fx), cada fuerza en su punto
        mo += (xm - xo) * (n * nup[1] - sh * ts[1]) - (ym - yo) * (n * nup[0] - sh * ts[0])
        mo += -(xm - xo) * v_eng - ((raw["V"] * (xm - xo)) + raw["VM"])
        mo += -(s_dir * (h_eng * (0.5 * (sl.get("y_top_mid", ym) + ym) - yo) * 0 + raw["HY"] - raw["H"] * yo))
        sw += sl["weight"] + sl["V"]
    return {"Fx": fx / sw, "Fy": fy / sw, "M": mo / (sw * L)}


def check(slices, out, s_dir, circle):
    res = {}
    if any(abs(d["H"] - d.get("raw", {}).get("H", 0.0)) > 1e-12 for d in slices):
        return {"nota": "dovelas con kh o cargas del motor: no se comprueba (H sin punto de aplicación)"}
    if "bishop" in out:
        res["bishop"] = residuals(slices, out["bishop"], 0.0, "bishop", s_dir, circle)["M"]
    f0 = out["janbu_simplified"]
    r = residuals(slices, f0, 0.0, "janbu", s_dir, circle)
    res["janbu_simplified"] = r["Fx"]
    if out.get("lambda") is not None and out["spencer"]:
        r = residuals(slices, out["spencer"], out["lambda"], "spencer", s_dir, circle)
        res["spencer"] = max(abs(r["Fx"]), abs(r["Fy"]), abs(r["M"]))
        res["spencer_detalle"] = r
    return res
