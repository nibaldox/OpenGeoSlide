"""Geometría del prototipo X21 (solo biblioteca estándar).

Todo en el marco del modelo (x hacia la derecha, y hacia arriba). `s = +1` si el deslizamiento va hacia +x
(left_to_right) y `s = -1` si va hacia -x (right_to_left): el mismo criterio que X17.
"""
from __future__ import annotations
import math

EPS = 1e-9


def polygon_edges(model):
    edges = []
    for reg in model["regions"]:
        pts = reg["polygon"]
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            edges.append((float(a[0]), float(a[1]), float(b[0]), float(b[1])))
    return edges


class Terrain:
    """Envolvente superior de las regiones. Los tramos verticales se guardan aparte (paramentos)."""

    def __init__(self, model):
        self.edges = [e for e in polygon_edges(model) if abs(e[2] - e[0]) > EPS]
        self.vertical = [e for e in polygon_edges(model) if abs(e[2] - e[0]) <= EPS]
        xs = sorted({e[0] for e in self.edges} | {e[2] for e in self.edges})
        self.xs = xs
        self.xmin, self.xmax = xs[0], xs[-1]
        # vértices del terreno: x donde la pendiente de la envolvente cambia
        self.vertices = [x for x in xs if self._kink(x)]

    def _y_on(self, x, side=0):
        """Ordenada máxima de las aristas no verticales que cubren x (con tolerancia)."""
        best = None
        for (x1, y1, x2, y2) in self.edges:
            lo, hi = min(x1, x2), max(x1, x2)
            if lo - EPS <= x <= hi + EPS:
                y = y1 + (y2 - y1) * (x - x1) / (x2 - x1)
                if best is None or y > best:
                    best = y
        return best

    def top(self, x, side=0):
        """Terreno en x. `side` = -1 / +1 elige el límite por la izquierda / derecha en una discontinuidad."""
        if side != 0:
            x = x + side * 1e-9 * max(1.0, self.xmax - self.xmin)
        y = self._y_on(x)
        if y is None:
            raise ValueError(f"x={x} fuera del modelo")
        return y

    def slope(self, x, side=0):
        """Pendiente dy/dx de la arista superior en x (hacia el lado `side`)."""
        xx = x + (side or 1) * 1e-7 * max(1.0, self.xmax - self.xmin)
        best = None
        for (x1, y1, x2, y2) in self.edges:
            lo, hi = min(x1, x2), max(x1, x2)
            if lo <= xx <= hi:
                y = y1 + (y2 - y1) * (xx - x1) / (x2 - x1)
                if best is None or y > best[0]:
                    best = (y, (y2 - y1) / (x2 - x1))
        return best[1]

    def _kink(self, x):
        d = 1e-6 * max(1.0, self.xmax - self.xmin)
        if x - d < self.xmin or x + d > self.xmax:
            return True
        return abs(self.slope(x, -1) - self.slope(x, 1)) > 1e-12


class Piezo:
    """Línea piezométrica: horizontal fuera de su rango (como el motor)."""

    def __init__(self, line):
        self.pts = [(float(a), float(b)) for a, b in line]

    def y(self, x):
        p = self.pts
        if x <= p[0][0]:
            return p[0][1]
        if x >= p[-1][0]:
            return p[-1][1]
        for (x1, y1), (x2, y2) in zip(p, p[1:]):
            if x1 <= x <= x2:
                return y1 if x2 == x1 else y1 + (y2 - y1) * (x - x1) / (x2 - x1)
        raise AssertionError

    def xs(self):
        return [a for a, _ in self.pts]


class Surface:
    """Superficie fija: círculo o polilínea. `base_y(x)` es la ordenada de la base."""

    def __init__(self, spec):
        self.spec = spec
        self.kind = spec["type"]
        if self.kind == "circle":
            self.xc, self.yc, self.r = float(spec["xc"]), float(spec["yc"]), float(spec["r"])
        else:
            self.pts = [(float(a), float(b)) for a, b in spec["points"]]

    def base_y(self, x):
        if self.kind == "circle":
            return self.yc - math.sqrt(max(self.r * self.r - (x - self.xc) ** 2, 0.0))
        p = self.pts
        if x <= p[0][0]:
            return p[0][1]
        for (x1, y1), (x2, y2) in zip(p, p[1:]):
            if x1 <= x <= x2:
                return y1 + (y2 - y1) * (x - x1) / (x2 - x1)
        return p[-1][1]

    def ends(self, terrain):
        """(x_a, x_b) extremos del tramo bajo el terreno, x_a < x_b (primer y último cruce)."""
        a = max(terrain.xmin, (self.xc - self.r) if self.kind == "circle" else self.pts[0][0])
        b = min(terrain.xmax, (self.xc + self.r) if self.kind == "circle" else self.pts[-1][0])
        n = 4000
        xs = [a + (b - a) * i / n for i in range(n + 1)]
        under = [self.base_y(x) < terrain.top(x) - 1e-12 for x in xs]
        idx = [i for i in range(n) if under[i] != under[i + 1]]
        if not idx:
            return None

        def refine(i):
            lo, hi = xs[i], xs[i + 1]
            st = under[i]
            for _ in range(60):
                mid = 0.5 * (lo + hi)
                if (self.base_y(mid) < terrain.top(mid) - 1e-12) == st:
                    lo = mid
                else:
                    hi = mid
            return 0.5 * (lo + hi)

        return refine(idx[0]), refine(idx[-1])


def rankine_depth(model, terrain, x, q=0.0):
    """z = 2c/(gamma tan(45 - phi/2)) - q/gamma con el material bajo el terreno en x (se trunca a 0).

    Para `undrained` se usa c = undrained_strength, phi = 0 (como cSlope, X19 §1.1)."""
    y = terrain.top(x) - 1e-3
    for reg in model["regions"]:
        poly = reg["polygon"]
        if point_in_polygon(x, y, poly):
            mat = next(m for m in model["materials"] if m["id"] == reg["material"])
            gamma = mat["unit_weight"]
            if mat.get("model") == "undrained":
                c, phi = mat["undrained_strength"], 0.0
                if mat.get("strength_datum") is not None:          # Su(y) = su + (datum - y)·gradiente, con tope
                    c = max(0.0, c + (mat["strength_datum"] - y) * mat.get("strength_gradient", 0.0))
                    if mat.get("strength_limit") is not None:
                        c = min(c, mat["strength_limit"])
            else:
                c, phi = mat["cohesion"], math.radians(mat["friction_angle"])
            if not (c > 0 and gamma > 0):
                return 0.0
            return max(0.0, 2 * c / (gamma * math.tan(math.pi / 4 - phi / 2)) - q / gamma)
    return 0.0


def point_in_polygon(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            if x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                inside = not inside
    return inside


def find_crack_x(surface, terrain, x_entry, x_exit, depth_at):
    """Primer x desde la entrada en que la superficie queda `depth_at(x)` bajo el terreno (como cSlope).

    Devuelve None si nunca llega. 200 pasos y bisección de 50 iteraciones."""
    def below(x):
        return terrain.top(x) - surface.base_y(x) - depth_at(x)
    steps = 200
    prev = x_entry
    for k in range(1, steps + 1):
        x = x_entry + (x_exit - x_entry) * k / steps
        if below(x) >= 0:
            lo, hi = prev, x
            for _ in range(50):
                mid = 0.5 * (lo + hi)
                if below(mid) >= 0:
                    hi = mid
                else:
                    lo = mid
            return hi if abs(hi - x_exit) > 1e-12 else None
        prev = x
    return None
