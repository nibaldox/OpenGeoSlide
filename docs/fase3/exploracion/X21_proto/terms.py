"""Términos nuevos por dovela: agua embalsada y grieta de tracción (solo biblioteca estándar).

Marco del modelo; `s` = +1 si el deslizamiento va hacia +x, -1 si va hacia -x. En cada dovela, con (xm, ym) el punto
medio de la base y (xc, yc, R) el círculo (solo Bishop):
  V   peso hacia abajo,           H  fuerza horizontal en el sentido del deslizamiento,
  Mb  = H·(yg - ym) + s·V·(xg - xm)      momento respecto del punto medio de la base (ecuación de Spencer, §solvers)
  Dx  = H·(yc - yg)/R - s·V·(xg - xm)/R momento motor respecto del centro / R (Bishop), sin el término V·sin(alpha)
"""
from __future__ import annotations
import math

GL3 = [(-math.sqrt(3 / 5), 5 / 9), (0.0, 8 / 9), (math.sqrt(3 / 5), 5 / 9)]


def _gauss(fn, a, b):
    h = 0.5 * (b - a)
    m = 0.5 * (a + b)
    return h * sum(w * fn(m + h * t) for t, w in GL3)


def pond_slice(sl, terrain, piezo, gw, s, circle=None):
    """(V, H, Mb, Dx) del agua sobre el terreno en la cara superior de la dovela `sl`."""
    x0, x1 = sl["x_left"], sl["x_right"]
    xm = 0.5 * (x0 + x1)
    ym = 0.5 * (sl["y_base_left"] + sl["y_base_right"])
    ycc, R = (circle[1], circle[2]) if circle else (None, None)
    brk = {x0, x1}
    for x in list(terrain.vertices) + piezo.xs():
        if x0 + 1e-12 < x < x1 - 1e-12:
            brk.add(x)
    brk = sorted(brk)
    V = Hx = HM = HD = VM = 0.0
    for a, b in zip(brk, brk[1:]):
        ya, yb = terrain.top(a, +1), terrain.top(b, -1)
        wa, wb = piezo.y(a), piezo.y(b)
        da, db = wa - ya, wb - yb
        if da <= 0 and db <= 0:
            continue
        # h = max(0, da + (db-da)t): recorta en el cruce
        ta, tb = 0.0, 1.0
        if da <= 0:
            ta = da / (da - db)
        if db <= 0:
            tb = da / (da - db)
        slope = (yb - ya) / (b - a)
        xs = lambda t: a + (b - a) * t
        hh = lambda t: da + (db - da) * t
        yt = lambda t: ya + (yb - ya) * t
        L = (b - a)
        V += gw * L * _gauss(hh, ta, tb)
        VM += gw * L * _gauss(lambda t: hh(t) * (xs(t) - xm), ta, tb)
        Hx += gw * L * _gauss(lambda t: hh(t) * slope, ta, tb)           # componente en +x (marco del modelo)
        HM += gw * L * _gauss(lambda t: hh(t) * slope * (yt(t) - ym), ta, tb)
        if R:
            HD += gw * L * _gauss(lambda t: hh(t) * slope * (ycc - yt(t)), ta, tb)
    H = s * Hx
    Mb = s * HM + s * VM
    Dx = (s * HD - s * VM) / R if R else 0.0
    return V, H, Mb, Dx, {"V": V, "VM": VM, "H": H, "HY": s * (HM + ym * Hx)}


def wall_slice(sl, terrain, piezo, gw, s, surface, circle=None):
    """Empuje del agua sobre un paramento vertical del terreno que cierra la dovela (cara de presa)."""
    H = Mb = Dx = HY = 0.0
    ym = 0.5 * (sl["y_base_left"] + sl["y_base_right"])
    for (x1, y1, x2, y2) in terrain.vertical:
        xw = x1
        for side_x, soil_side in ((sl["x_left"], +1), (sl["x_right"], -1)):
            if abs(side_x - xw) > 1e-7 * max(1.0, terrain.xmax - terrain.xmin):
                continue
            y_lo, y_hi = min(y1, y2), max(y1, y2)
            # el suelo está del lado alto: la dovela (a ese lado del paramento) debe estar en el lado alto
            high_side = +1 if terrain.top(xw, +1) > terrain.top(xw, -1) else -1
            if soil_side != high_side:
                continue
            yw = piezo.y(xw)
            ya = max(y_lo, surface.base_y(xw))
            yb = min(yw, y_hi)
            if yb <= ya:
                continue
            F = gw * ((yw - ya) ** 2 - (yw - yb) ** 2) / 2
            yg = _centroid(yw, ya, yb)
            fx = F * (+1 if high_side == +1 else -1)       # hacia el lado del suelo
            h = s * fx
            H += h
            HY += h * yg
            Mb += h * (yg - ym)
            if circle:
                Dx += h * (circle[1] - yg) / circle[2]
    return H, Mb, Dx, HY


def _centroid(yw, ya, yb):
    # centroide (en y) de la presión g(yw - y) entre ya y yb
    num = _gauss(lambda y: y * (yw - y), ya, yb)
    den = _gauss(lambda y: (yw - y), ya, yb)
    return num / den


def crack_water(depth, fraction, gw, y_base, sl, s, circle=None):
    """Fuerza del agua en la grieta sobre la dovela de la cara: ½·γw·hw², horizontal, a hw/3 sobre la base."""
    hw = depth * fraction
    if hw <= 0:
        return 0.0, 0.0, 0.0, 0.0
    F = 0.5 * gw * hw * hw
    yg = y_base + hw / 3
    ym = 0.5 * (sl["y_base_left"] + sl["y_base_right"])
    H = F                                    # en el sentido del deslizamiento
    Mb = H * (yg - ym)
    Dx = H * (circle[1] - yg) / circle[2] if circle else 0.0
    return H, Mb, Dx, H * yg
