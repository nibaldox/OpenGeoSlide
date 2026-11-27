"""Morgenstern-Price (f constante = Spencer) con la regla de par más cercano de cSlope 0.1.0.

Réplica de solvers.rs:1395-1470 (analyse_morgenstern_price_with, rama de respaldo) y de smallest_gap (1019):
  Ff(λ): raíz en F del equilibrio de fuerzas (solvers.force_root, X21);
  Fm(λ): raíz en F del equilibrio de momentos con E(F, λ)  (solvers.moment_resid);
  gap(λ) = |Fm − Ff|. Si hay cruce (gap ~ 0): solución completa, F = Fm = Ff.
  Si no: par más cercano en λ* = argmin gap; se acepta si gap <= max(4·tol, 0,02) (mp_equilibrium_tolerance,
  solvers.rs:1176) y ambos > 0: F = Fm(λ*), converged = False, closest_pair = True.
Diferencia con cSlope: cSlope busca λ* con iteraciones sobre lff_array; aquí, rejilla de 0,05 en [−0,5; 1,5] y
refinamiento áureo en [λ_grid − 0,05; λ_grid + 0,05]. Se mide la diferencia (X28 §2).
"""
from __future__ import annotations
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import solvers

TOL_SLOPE = 1e-5
MP_EQ_TOL = max(4 * TOL_SLOPE, 0.02)


def fm_root(sl, lam, ff):
    """Raíz en F de moment_resid(F, λ) más cercana a Ff (barrido geométrico + bisección)."""
    def g(f):
        try:
            return solvers.moment_resid(sl, f, lam)[0]
        except (ZeroDivisionError, OverflowError, ValueError):
            return float("nan")          # polo de D(F, λ) = 0: no es raíz
    pts = []
    n = 60
    lo, hi = ff * 0.5, ff * 2.0
    for k in range(n + 1):
        f = lo * (hi / lo) ** (k / n)
        try:
            pts.append((f, g(f)))
        except (ZeroDivisionError, OverflowError):
            pts.append((f, float("nan")))
    roots = []
    for (a, ga), (b, gb) in zip(pts, pts[1:]):
        if math.isfinite(ga) and math.isfinite(gb) and ga * gb <= 0:
            x, y = a, b
            gx = ga
            for _ in range(60):
                m = 0.5 * (x + y)
                gm = g(m)
                if gx * gm <= 0:
                    y = m
                else:
                    x, gx = m, gm
            roots.append(0.5 * (x + y))
    if not roots:
        return None
    return min(roots, key=lambda r: abs(r - ff))


def gap_at(sl, lam):
    ff = solvers.force_root(sl, lam)
    if ff is None:
        return None
    fm = fm_root(sl, lam, ff)
    if fm is None:
        return None
    return fm, ff, abs(fm - ff)


def mp_closest(sl):
    """Devuelve (F, λ*, info). F = None si no hay solución aceptable."""
    grid = [round(-0.5 + 0.05 * i, 10) for i in range(41)]
    table = {}
    for lam in grid:
        r = gap_at(sl, lam)
        if r is not None:
            table[lam] = r
    if not table:
        return None, None, {"why": "sin raíces de fuerza"}
    lam0 = min(table, key=lambda l: table[l][2])
    # refinamiento áureo del gap en [lam0 − 0.05, lam0 + 0.05]
    a, b = lam0 - 0.05, lam0 + 0.05
    best = (table[lam0][2], lam0, table[lam0])
    phi = (math.sqrt(5) - 1) / 2

    def val(l):
        r = gap_at(sl, l)
        return (r[2] if r is not None else float("inf")), r

    c_, d_ = b - phi * (b - a), a + phi * (b - a)
    vc, rc = val(c_)
    vd, rd = val(d_)
    for _ in range(40):
        if vc < vd:
            b, d_, vd, rd = d_, c_, vc, rc
            c_ = b - phi * (b - a)
            vc, rc = val(c_)
        else:
            a, c_, vc, rc = c_, d_, vd, rd
            d_ = a + phi * (b - a)
            vd, rd = val(d_)
        for l_, v_, r_ in ((c_, vc, rc), (d_, vd, rd)):
            if r_ is not None and v_ < best[0]:
                best = (v_, l_, r_)
    gap, lam, (fm, ff, _) = best
    if gap <= 1e-6 and fm > 0 and ff > 0:
        return fm, lam, {"closest_pair": False, "gap": gap, "lam_grid": lam0}
    if fm > 0 and ff > 0 and gap <= MP_EQ_TOL:
        return fm, lam, {"closest_pair": True, "gap": gap, "lam_grid": lam0}
    return None, lam, {"why": "par no aceptado", "gap": gap, "closest_pair": False}
