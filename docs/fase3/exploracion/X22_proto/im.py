"""Presión lateral de Ito-Matsui (1975) sobre una fila de pilotes, con la notación del ARTÍCULO (solo biblioteca estándar).

Fuente: Ito, T. y Matsui, T. (1975), Soils and Foundations 15(4): 43-59, ecs. 13, 14 y 23 (leídas en el PDF de J-STAGE).
  D1 = espaciamiento entre ejes, D2 = separación libre = D1 - d, d = diámetro.   Nphi = tan^2(45° + phi/2).
  p(z) = c·A1 + γ·z·A2          (fuerza por pilote por unidad de longitud del pilote)
Se escribe aquí tal como está en el artículo (no con las abreviaturas R, E, F de cSlope/XSLOPE), para poder contrastarla con
la forma de cSlope (`cslope_form`) y con el oráculo.
"""
from __future__ import annotations
import math

TAN_PI8 = math.tan(math.pi / 8.0)


def coeffs_paper(spacing: float, d: float, phi_deg: float):
    """(A1, A2) de las ecs. 13 (c-φ) y 23 (φ = 0) del artículo, SIN el piso de φ = 0. `spacing` = D1 (entre ejes)."""
    d1, d2 = spacing, spacing - d
    if not d2 > 0:
        raise ValueError("Ito-Matsui exige spacing > diameter")
    if phi_deg < 0.01:           # umbral de cSlope (reinforcement.rs:717): φ < 0,01° se trata como φ = 0
        return d1 * (3.0 * math.log(d1 / d2) + (d1 - d2) / d2 * TAN_PI8) - 2.0 * (d1 - d2), d1 - d2
    phi = math.radians(phi_deg)
    n = math.tan(math.pi / 4 + phi / 2) ** 2
    sn, tp = math.sqrt(n), math.tan(phi)
    expo = sn * tp + n - 1.0                                   # exponente de (D1/D2) en las ecs. 11-14
    ratio = (d1 / d2) ** expo
    ex = math.exp((d1 - d2) / d2 * n * tp * math.tan(math.pi / 8 + phi / 4))
    g = (2.0 * tp + 2.0 * sn + 1.0 / sn) / expo                # (2 tanφ + 2 √N + N^-1/2) / (√N tanφ + N - 1)
    # ec. 13: p = c·D1·ratio·[ (ex - 2√N tanφ - 1)/(N tanφ) + g ] - c·{ D1·g - 2·D2/√N } + (γz/N)·{ D1·ratio·ex - D2 }
    a1 = d1 * ratio * ((ex - 2.0 * sn * tp - 1.0) / (n * tp) + g) - (d1 * g - 2.0 * d2 / sn)
    a2 = (d1 * ratio * ex - d2) / n
    return a1, a2


def coeffs(spacing: float, d: float, phi_deg: float):
    """(A1, A2) con el piso de φ = 0 (cSlope y XSLOPE: el artículo no lo trae)."""
    a1, a2 = coeffs_paper(spacing, d, phi_deg)
    b1, b2 = coeffs_paper(spacing, d, 0.0)
    return max(a1, b1), max(a2, b2)


def cslope_form(spacing: float, d: float, phi_deg: float):
    """La misma fórmula con las abreviaturas de cSlope (`ito_matsui_coefficients`, reinforcement.rs:713-731), con su piso.
    S = D1_artículo; D1 = separación libre. Se deja para comprobar que las dos escrituras coinciden."""
    s_, d1 = spacing, spacing - d
    a1p0 = s_ * (3.0 * math.log(s_ / d1) + (d / d1) * TAN_PI8 - 2.0) + 2.0 * d1
    a2p0 = d
    if phi_deg < 0.01:
        return a1p0, a2p0
    phi = math.radians(phi_deg)
    n = math.tan(math.pi / 4 + phi / 2) ** 2
    sn, tp = math.sqrt(n), math.tan(phi)
    r = (s_ / d1) ** (sn * tp + n - 1.0)
    e = math.exp((d / d1) * n * tp * math.tan(math.pi / 8 + phi / 4))
    a2 = (s_ * r * e - d1) / n
    f = (2.0 * tp + 2.0 * sn + 1.0 / sn) / (sn * tp + n - 1.0)
    a1 = (s_ * r * (e - 2.0 * sn * tp - 1.0)) / (n * tp) + s_ * f * (r - 1.0) + (2.0 * d1) / sn
    return max(a1, a1p0), max(a2, a2p0)


if __name__ == "__main__":
    import sys
    s, d, phi = (float(v) for v in sys.argv[1:4])
    print("paper (sin piso):", coeffs_paper(s, d, phi))
    print("con piso        :", coeffs(s, d, phi))
    print("forma cSlope    :", cslope_form(s, d, phi))
