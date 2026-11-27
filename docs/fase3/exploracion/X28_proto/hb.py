"""Hoek-Brown generalizado (Hoek, Carranza-Torres y Corkum 2002) y su tangente Mohr-Coulomb por dovela.

Réplica de cSlope 0.1.0 (commit 0f07e7a): packages/engine-rs/crates/cslope-engine/src/types/hoek_brown.rs
  - parámetros (líneas 40-52 de hoek_brown_parameters): mb, s, a de GSI, mi, D;
  - at_sigma3 (84-94) y tangente en σ3 clamp a 0 (100-110);
  - instantaneous_at_normal_stress (113-133): σ'n <= sn(0) -> tangente en σ3 = 0; si no, bisección.
Reglas de σ'n <= sn(0) (X28 §3):
  'cslope' : tangente en σ3 = 0 (la de cSlope)
  'c0'     : c = 0 y φ = φ de la tangente en σ3 = 0
  'cut'    : corte en σt = -s·σci/mb: τ = 0 si σ'n <= σt; si σt < σ'n <= sn(0), tangente en la rama σ3 en [σt, 0]
Solo biblioteca estándar.
"""
from __future__ import annotations
import math

MAX_PHI = math.radians(89.9)


def params(ucs, gsi, mi, D=0.0, mb=None, s=None, a=None):
    if mb is not None and s is not None:
        return {"ucs": float(ucs), "mb": float(mb), "s": float(s), "a": float(a if a is not None else 0.5)}
    return {
        "ucs": float(ucs),
        "mb": mi * math.exp((gsi - 100.0) / (28.0 - 14.0 * D)),
        "s": math.exp((gsi - 100.0) / (9.0 - 3.0 * D)),
        "a": 0.5 + (math.exp(-gsi / 15.0) - math.exp(-20.0 / 3.0)) / 6.0,
    }


def sigma_t(p):
    return -p["s"] * p["ucs"] / p["mb"]


def env(p, s3):
    """(σn, τ, k) en σ3 (compresión positiva). Igual que at_sigma3 de cSlope (sin clamp)."""
    base = max(1e-12, p["mb"] * s3 / p["ucs"] + p["s"])
    s1 = s3 + p["ucs"] * base ** p["a"]
    k = 1.0 + p["a"] * p["mb"] * base ** (p["a"] - 1.0)
    sn = (s1 + s3) / 2.0 - ((s1 - s3) / 2.0) * ((k - 1.0) / (k + 1.0))
    tau = (s1 - s3) * math.sqrt(k) / (k + 1.0)
    return sn, tau, k


def _cf(sn, tau, k):
    phi = min(MAX_PHI, math.asin((k - 1.0) / (k + 1.0)))
    c = max(0.0, tau - sn * math.tan(phi))
    return c, math.tan(phi)


def tangent_sigma3(p, s3):
    """Tangente en σ3 (clamp a 0 como cSlope instantaneous_at_sigma3). Devuelve (c, tanφ)."""
    sn, tau, k = env(p, max(s3, 0.0))
    return _cf(sn, tau, k)


def sn_zero(p):
    return env(p, 0.0)[0]


def _bisect_sigma3(p, sn, lo, hi, sign_clamp):
    """Bisección de σ3 con σn(σ3) = sn (monótona creciente). cSlope: tol 1e-10 relativa, 100 iteraciones."""
    k = 0
    while k < 100 and hi - lo > 1e-10 * (1.0 + abs(hi)):
        m = (lo + hi) / 2.0
        if env(p, m)[0] < sn:
            lo = m
        else:
            hi = m
        k += 1
    return (lo + hi) / 2.0


def tangent(p, sn, rule="cslope"):
    """Tangente (c, tanφ) en σ'n según la regla. Réplica de instantaneous_at_normal_stress para 'cslope'."""
    s0 = sn_zero(p)
    if rule == "cslope" or rule == "c0":
        if not (sn > s0):
            c, t = tangent_sigma3(p, 0.0)
            return (0.0, t) if rule == "c0" else (c, t)
        hi = max(1.0, abs(sn))
        while env(p, hi)[0] < sn:
            hi *= 2.0
        s3 = _bisect_sigma3(p, sn, 0.0, hi, True)
        c, t = tangent_sigma3(p, s3)
        return c, t
    if rule == "cut":
        st = sigma_t(p)
        if sn <= st:
            return 0.0, 0.0
        if sn > s0:
            hi = max(1.0, abs(sn))
            while env(p, hi)[0] < sn:
                hi *= 2.0
            s3 = _bisect_sigma3(p, sn, 0.0, hi, True)
            return tangent_sigma3(p, s3)
        # σt < σ'n <= sn(0): rama de tracción σ3 en [σt, 0]; sn(σt) = σt
        s3 = _bisect_sigma3(p, sn, st, 0.0, False)
        sn_, tau, k = env(p, s3)
        return _cf(sn_, tau, k)
    raise ValueError(rule)


def sn_of_s3_monotone(p, s3a, s3b, n=400):
    """Comprobación de monotonía de σn(σ3) en [s3a, s3b]."""
    prev = None
    for i in range(n + 1):
        s3 = s3a + (s3b - s3a) * i / n
        v = env(p, s3)[0]
        if prev is not None and v < prev - 1e-12:
            return False
        prev = v
    return True
