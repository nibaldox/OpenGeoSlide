"""Cinco métodos sobre dovelas del motor con los términos nuevos (solo biblioteca estándar).

Una dovela es un dict con los campos del informe de `ogs analyze` más los términos del prototipo:
  V   fuerza vertical añadida hacia abajo (peso del agua, kv·W, cargas) -> `weight_extra`
  H   fuerza horizontal en el sentido del deslizamiento                 -> `h_force`
  Mb  momento de las fuerzas nuevas respecto del punto medio de la base, en el sentido de la ecuación de Spencer
      (H·(yg - ym) + s·V·(xg - xm))                                      -> `h_moment_base` (ampliado con V excéntrica)
  Dx  contribución al momento motor respecto del centro / R (Bishop)     -> `driving_extra` (ampliado)
Las fórmulas son las del motor (methods/bishop.rs, spencer.rs, janbu.rs) escritas de nuevo.
"""
from __future__ import annotations
import math

MIN_M = 0.2


def tw(s):
    return s["weight"] + s["V"]


def bishop(slices, tol=1e-12, maxit=500):
    f = 1.0
    for _ in range(maxit):
        num = den = 0.0
        for s in slices:
            sin, cos = math.sin(s["alpha"]), math.cos(s["alpha"])
            m = cos + sin * s["tan_phi"] / f
            num += (s["cohesion"] * s["width"] + (tw(s) - s["pore_pressure"] * s["width"]) * s["tan_phi"]) / m
            den += tw(s) * sin + s["Dx"]
        g = num / den
        if abs(g - f) < tol * max(1, abs(f)):
            return g
        f = g
    raise RuntimeError("Bishop no converge")


def interslice(slices, f, lam):
    e = [0.0]
    for s in slices:
        sin, cos = math.sin(s["alpha"]), math.cos(s["alpha"])
        d = (sin - lam * cos) * s["tan_phi"] + (cos + lam * sin) * f
        t = tw(s) * sin
        r = (tw(s) * cos - s["pore_pressure"] * s["base_length"]) * s["tan_phi"] + s["cohesion"] * s["base_length"]
        thrust = (f * cos + s["tan_phi"] * sin) * s["H"]
        e.append(e[-1] + (f * t - r + thrust) / d)
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


def janbu_f0(slices):
    return force_root(slices, 0.0)


def janbu_correction(slices):
    (xa, ya), (xb, yb) = slices_ends(slices)
    length = math.hypot(xb - xa, yb - ya)
    d = 0.0
    for s in slices:
        x = 0.5 * (s["x_left"] + s["x_right"])
        y = 0.5 * (s["y_base_left"] + s["y_base_right"])
        depth = ((xb - xa) * (ya - y) - (yb - ya) * (xa - x)) / length
        d = max(d, depth)
    ratio = d / length
    cohesion = any(s["cohesion"] > 0 for s in slices)
    friction = any(s["tan_phi"] > 0 for s in slices)
    b1 = 0.50 if (cohesion and friction) else (0.69 if cohesion else 0.31)
    return max(1.0, 1.0 + b1 * (ratio - 1.4 * ratio * ratio)), ratio


def slices_ends(slices):
    xs_l = min(slices, key=lambda s: s["x_left"])
    xs_r = max(slices, key=lambda s: s["x_right"])
    # extremos de la base: izquierdo (menor x) y derecho (mayor x)
    return (xs_l["x_left"], xs_l["y_base_left"]), (xs_r["x_right"], xs_r["y_base_right"])


def moment_resid(slices, f, lam):
    e = interslice(slices, f, lam)
    r = 0.0
    for k, s in enumerate(slices):
        tan = math.tan(s["alpha"])
        r += s["width"] * (e[k] + e[k + 1]) * (tan - lam) - 2.0 * s["Mb"]
    sw = sum(s["weight"] + s["V"] for s in slices)
    sb = sum(s["width"] for s in slices)
    return r / (sw * sb), e


def admissible(slices, f, lam, min_m=MIN_M):
    """Φ_i/F >= min_m y m_alpha(F) >= min_m en todas las dovelas (E11b)."""
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
        lam_grid = [round(-0.5 + 0.05 * i, 10) for i in range(41)]
        lam_grid.sort(key=abs)
    pts = []
    for lam in lam_grid:
        f = force_root(slices, lam)
        if f is None:
            continue
        r, _ = moment_resid(slices, f, lam)
        pts.append((lam, f, r))
    pts.sort()
    roots = []
    for (l1, f1, r1), (l2, f2, r2) in zip(pts, pts[1:]):
        if abs(l2 - l1) > 0.051:
            continue
        if r1 == 0:
            roots.append((l1, f1))
        elif r1 * r2 < 0:
            a, b = l1, l2

            def g(lam):
                ff = force_root(slices, lam)
                return moment_resid(slices, ff, lam)[0]
            lam = _bisect(g, a, b, 60)
            ff = force_root(slices, lam)
            # un salto de rama de F(lambda) no es una raíz: se exige |ρ| <= 1e-6 en el punto final (como el motor, E11c)
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
    f0 = janbu_f0(slices)
    out["janbu_simplified"] = f0
    fcorr, ratio = janbu_correction(slices)
    out["janbu_corrected"] = fcorr * f0
    f, lam = spencer(slices)
    out["spencer"] = f
    out["morgenstern_price"] = f
    out["lambda"] = lam
    return out
