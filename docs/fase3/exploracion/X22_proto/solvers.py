"""Cinco métodos sobre dovelas del motor con fuerzas activas y pasivas (solo biblioteca estándar).

Una dovela es un dict con los campos del informe de `ogs analyze` más los términos de fuerzas añadidas:
  activas (conocidas, E14f):   V   vertical hacia abajo      H   horizontal en el sentido del deslizamiento
                               Mb  momento de las fuerzas nuevas respecto del punto medio de la base
                               Dx  contribución al momento motor respecto del centro / R (solo Bishop en círculo)
  pasivas (E14g, se dividen por F en cada evaluación): pV, pH, pMb, pDx con el mismo sentido.
Sin pasivas los resultados son los de X21 (`solve_all` de `X21_proto/solvers.py`), que reproducen `methods/*.rs`.
"""
from __future__ import annotations
import math

MIN_M = 0.2


def eff(s, f):
    """Términos efectivos de la dovela con el F que se está evaluando."""
    inv = 1.0 / f
    return (s["weight"] + s["V"] + s.get("pV", 0.0) * inv, s["H"] + s.get("pH", 0.0) * inv,
            s["Mb"] + s.get("pMb", 0.0) * inv, s["Dx"] + s.get("pDx", 0.0) * inv)


def _bishop_g(slices, f):
    num = den = 0.0
    for s in slices:
        sin, cos = math.sin(s["alpha"]), math.cos(s["alpha"])
        tw, _, _, dx = eff(s, f)
        m = cos + sin * s["tan_phi"] / f
        num += (s["cohesion"] * s["width"] + (tw - s["pore_pressure"] * s["width"]) * s["tan_phi"]) / m
        den += tw * sin + dx
    return num / den if den > 0 else math.inf


def bishop(slices, tol=1e-13, maxit=1000):
    """Punto fijo F = g(F) desde F = 1; si no converge a una raíz positiva (con pasivos grandes el punto fijo puede salirse),
    se busca el primer cambio de signo de g(F) - F en una rejilla geométrica y se bisecta (la raíz más baja con den > 0)."""
    f = 1.0
    for _ in range(maxit):
        g = _bishop_g(slices, f)
        if not (g > 0 and math.isfinite(g)):
            break
        if abs(g - f) < tol * max(1, abs(f)):
            return g
        f = g
    prev = None
    for k in range(0, 801):
        f = 0.05 * (200.0 / 0.05) ** (k / 800)
        v = _bishop_g(slices, f) - f
        if math.isfinite(v) and prev is not None and prev[1] * v <= 0:
            return _bisect(lambda x: _bishop_g(slices, x) - x, prev[0], f)
        prev = (f, v) if math.isfinite(v) else None
    raise RuntimeError("Bishop no converge")


def interslice(slices, f, lam):
    e = [0.0]
    for s in slices:
        sin, cos = math.sin(s["alpha"]), math.cos(s["alpha"])
        tw, h, _, _ = eff(s, f)
        d = (sin - lam * cos) * s["tan_phi"] + (cos + lam * sin) * f
        t = tw * sin
        r = (tw * cos - s["pore_pressure"] * s["base_length"]) * s["tan_phi"] + s["cohesion"] * s["base_length"]
        e.append(e[-1] + (f * t - r + (f * cos + s["tan_phi"] * sin) * h) / d)
    return e


def _bisect(fn, a, b, n=200):
    fa = fn(a)
    for _ in range(n):
        m = 0.5 * (a + b)
        fm = fn(m)
        if fa * fm <= 0:
            b = m
        else:
            a, fa = m, fm
    return 0.5 * (a + b)


def force_root(slices, lam, lo=0.05, hi=20.0, steps=400):
    """Raíz más baja de E_n(F, lam) = 0 con todos los polos de D positivos."""
    def en(f):
        return interslice(slices, f, lam)[-1]

    def ok(f):
        for s in slices:
            sin, cos = math.sin(s["alpha"]), math.cos(s["alpha"])
            if (sin - lam * cos) * s["tan_phi"] + (cos + lam * sin) * f <= 1e-9 * f:
                return False
        return True
    prev_f, prev_v = None, None
    for k in range(steps + 1):
        f = lo * (hi / lo) ** (k / steps)
        if not ok(f):
            prev_f = None
            continue
        v = en(f)
        if prev_f is not None and prev_v * v <= 0:
            return _bisect(en, prev_f, f)
        prev_f, prev_v = f, v
    return None


def slices_ends(slices):
    xs_l = min(slices, key=lambda s: s["x_left"])
    xs_r = max(slices, key=lambda s: s["x_right"])
    return (xs_l["x_left"], xs_l["y_base_left"]), (xs_r["x_right"], xs_r["y_base_right"])


def janbu_correction(slices):
    (xa, ya), (xb, yb) = slices_ends(slices)
    length = math.hypot(xb - xa, yb - ya)
    d = 0.0
    for s in slices:
        x = 0.5 * (s["x_left"] + s["x_right"])
        y = 0.5 * (s["y_base_left"] + s["y_base_right"])
        d = max(d, ((xb - xa) * (ya - y) - (yb - ya) * (xa - x)) / length)
    ratio = d / length
    cohesion = any(s["cohesion"] > 0 for s in slices)
    friction = any(s["tan_phi"] > 0 for s in slices)
    b1 = 0.50 if (cohesion and friction) else (0.69 if cohesion else 0.31)
    return max(1.0, 1.0 + b1 * (ratio - 1.4 * ratio * ratio)), ratio


def moment_resid(slices, f, lam):
    e = interslice(slices, f, lam)
    r = 0.0
    for k, s in enumerate(slices):
        r += s["width"] * (e[k] + e[k + 1]) * (math.tan(s["alpha"]) - lam) - 2.0 * eff(s, f)[2]
    sw = sum(s["weight"] + s["V"] + s.get("pV", 0.0) / f for s in slices)
    sb = sum(s["width"] for s in slices)
    return r / (sw * sb), e


def admissible(slices, f, lam, min_m=MIN_M):
    for s in slices:
        sin, cos = math.sin(s["alpha"]), math.cos(s["alpha"])
        if (sin - lam * cos) * s["tan_phi"] / f + (cos + lam * sin) < min_m:
            return False
        if cos + sin * s["tan_phi"] / f < min_m:
            return False
    return True


def spencer(slices, lam_grid=None):
    """M-P con f(x) = 1 (= Spencer): raíz en lambda del residuo de momento, con F = raíz de la clausura de fuerzas."""
    if lam_grid is None:
        lam_grid = sorted((round(-0.5 + 0.05 * i, 10) for i in range(41)), key=abs)
    pts = []
    for lam in lam_grid:
        f = force_root(slices, lam)
        if f is None:
            continue
        pts.append((lam, f, moment_resid(slices, f, lam)[0]))
    pts.sort()
    roots = []
    for (l1, f1, r1), (l2, f2, r2) in zip(pts, pts[1:]):
        if abs(l2 - l1) > 0.051:
            continue
        if r1 == 0:
            roots.append((l1, f1))
        elif r1 * r2 < 0:
            lam = _bisect(lambda l: moment_resid(slices, force_root(slices, l), l)[0], l1, l2, 60)
            ff = force_root(slices, lam)
            if ff and abs(moment_resid(slices, ff, lam)[0]) <= 1e-6 and abs(f2 - f1) < 0.2 * max(f1, f2) \
                    and admissible(slices, ff, lam):
                roots.append((lam, ff))
    if not roots:
        return None, None
    lam, f = min(roots, key=lambda t: t[1])
    return f, lam


def solve_all(slices, circular=True):
    out = {}
    if circular:
        out["bishop"] = bishop(slices)
    f0 = force_root(slices, 0.0)
    out["janbu_simplified"] = f0
    fcorr, ratio = janbu_correction(slices)
    out["janbu_corrected"] = fcorr * f0
    f, lam = spencer(slices)
    out["spencer"] = f
    out["morgenstern_price"] = f
    out["lambda"] = lam
    return out
