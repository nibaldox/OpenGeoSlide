"""Perfil de presión de Ito-Matsui sobre un pilote vertical, integrado desde la cabeza (o el terreno) hacia abajo.

Convenciones tomadas de cSlope (`model/reinforcement.rs:751-849`, `build_pile_profile`) y comprobadas contra el oráculo:
  - z se mide desde el terreno en x del pilote; z_top = max(0, terreno - max(y1, y2)) (cabeza bajo el terreno: se carga desde la cabeza);
  - rejilla de punto medio con dz <= 0,05 m; en cada punto, el material, c y φ de ESE punto (varias capas);
  - p = c·A1 + σv·A2 con σv = σ'v = γ·z - u (γsat bajo la línea de agua del material, menos presión de poros, menos ru·peso);
    con resistencia no drenada (undrained, o Mohr-Coulomb con φ = 0) es la tensión TOTAL (caso φ = 0 de Ito-Matsui);
  - F(zf) = ∫p dz y Q(zf) = ∫p·z dz; el brazo de la resultante sobre el cruce es Lm = (zf·F - Q)/F.
"""
from __future__ import annotations
import math
import geometry
import im

PROFILE_STEP = 0.05


def _mat(model, mid):
    return next(m for m in model["materials"] if m["id"] == mid)


def material_at(model, x, y):
    for reg in model["regions"]:
        if geometry.point_in_polygon(x, y, reg["polygon"]):
            return _mat(model, reg["material"])
    return None


def breakpoints(model, x, piezo):
    """y donde la vertical x corta una arista de región, y la línea de agua."""
    ys = set()
    for reg in model["regions"]:
        pts = reg["polygon"]
        for i in range(len(pts)):
            (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
            if x1 != x2 and min(x1, x2) <= x <= max(x1, x2):
                ys.add(y1 + (y2 - y1) * (x - x1) / (x2 - x1))
    if piezo is not None:
        ys.add(piezo.y(x))
    return sorted(ys)


class Column:
    """Columna de suelo bajo el terreno en x: tensión vertical total y efectiva a cada y."""

    def __init__(self, model, terrain, x):
        self.model, self.x = model, x
        self.gw = (model.get("water") or {}).get("unit_weight", 9.81)
        wl = (model.get("water") or {}).get("piezometric_line")
        self.piezo = geometry.Piezo(wl) if wl else None
        self.ground = terrain.top(x)
        self.ys = breakpoints(model, x, self.piezo)

    def water_y(self):
        return self.piezo.y(self.x) if self.piezo else -math.inf

    def gamma(self, mat, y):
        gs = mat.get("unit_weight_sat")
        if gs is not None and y < self.water_y():
            return gs
        return mat["unit_weight"]

    def total_stress(self, y):
        """σv total en y (peso del suelo de arriba con γsat bajo el agua, más el agua embalsada sobre el terreno)."""
        if y >= self.ground:
            return 0.0, 0.0
        cuts = [b for b in self.ys if y < b < self.ground]
        edges = [self.ground] + sorted(cuts, reverse=True) + [y]
        soil = 0.0
        for hi, lo in zip(edges, edges[1:]):
            mid = 0.5 * (hi + lo)
            mat = material_at(self.model, self.x, mid)
            if mat is not None:
                soil += self.gamma(mat, mid) * (hi - lo)
        pond = max(0.0, self.water_y() - self.ground) * self.gw
        return soil + pond, soil

    def vertical_stress(self, y, effective):
        sig, soil = self.total_stress(y)
        if not effective:
            return sig
        u = max(0.0, self.water_y() - y) * self.gw
        mat = material_at(self.model, self.x, y)
        ru = (mat or {}).get("ru") or 0.0
        return max(0.0, sig - u - ru * soil)


def strength_at(mat, y):
    """(c, φ en grados, no_drenado)."""
    if mat.get("model") == "undrained":
        c = mat["undrained_strength"]
        if mat.get("strength_datum") is not None:
            c = max(0.0, c + (mat["strength_datum"] - y) * mat.get("strength_gradient", 0.0))
            if mat.get("strength_limit") is not None:
                c = min(c, mat["strength_limit"])
        return c, 0.0, True
    phi = mat["friction_angle"]
    return mat["cohesion"], phi, phi == 0.0          # Mohr-Coulomb con φ = 0: tensión total (types/strength.rs:383-389)


def build_profile(model, terrain, pile, step=PROFILE_STEP, floor=True):
    """z[k], F[k] = ∫p dz, Q[k] = ∫p·z dz por pilote (kN) desde z_top hasta la punta."""
    lp = pile["lateral_pressure"]
    d, spacing = lp["diameter"], pile.get("spacing", 1.0)
    x = pile["x1"]
    col = Column(model, terrain, x)
    yg = col.ground
    z_top = max(0.0, yg - max(pile["y1"], pile["y2"]))
    z_tip = max(z_top, yg - min(pile["y1"], pile["y2"]))
    nf = max(1, math.ceil((z_tip - z_top) / step))
    dz = (z_tip - z_top) / nf
    z, f, q = [z_top], [0.0], [0.0]
    coef = (im.coeffs if floor else im.coeffs_paper)
    for k in range(nf):
        zm = z_top + (k + 0.5) * dz
        yy = yg - zm
        mat = material_at(model, x, yy)
        pz = 0.0
        if mat is not None:
            c, phi, undrained = strength_at(mat, yy)
            a1, a2 = coef(spacing, d, phi)
            pz = c * a1 + col.vertical_stress(yy, not undrained) * a2
        z.append(z_top + (k + 1) * dz)
        f.append(f[-1] + pz * dz)
        q.append(q[-1] + pz * zm * dz)
    return {"z": z, "F": f, "Q": q, "ground": yg, "z_top": z_top, "z_tip": z_tip}


def force_at(profile, zf):
    """(fuerza por pilote, brazo de la resultante sobre el cruce) para un cruce a profundidad zf (interpolación de cSlope)."""
    z, f, q = profile["z"], profile["F"], profile["Q"]
    if not zf > z[0]:
        return 0.0, 0.0
    last = len(z) - 1
    k = 1
    while k < last and z[k] < zf:
        k += 1
    span = z[k] - z[k - 1]
    t = min(1.0, (zf - z[k - 1]) / span) if span > 0 else 1.0
    force = f[k - 1] + t * (f[k] - f[k - 1])
    moment = zf * force - (q[k - 1] + t * (q[k] - q[k - 1]))
    return force, (moment / force if force > 0 else 0.0)
