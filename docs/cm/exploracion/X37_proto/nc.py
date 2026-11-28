"""X37 (copia de X29 nc.py, con el sys.path fijo quitado: el evaluador es el del venv activo).

X29: búsqueda no circular por variación alterna (Celestino y Duncan, como cSlope) sobre el motor real.

Solo lectura del repo. Cada candidato es una polilínea fija o un círculo fijo que se evalúa con
`opengeoslide.analyze` (wheel 0.4.0, venv propio). Sin generador aleatorio: todo es determinista.

Partes:
- Site: terreno (envolvente superior de los polígonos de `regions`) y ventanas de entrada y salida.
- Eng: evaluador (un método por llamada: `morgenstern_price` con `interslice` constante, o `spencer`).
- grid_circles / pick_seeds: semillas = 3 mejores círculos distintos de una malla con superficies fijas
  (misma parametrización que `search.rs:120-150`: entrada xe, salida xs y ρ; R = (L/2)·e^ρ).
- NC: variación alterna con la lógica de `optimize.rs` (Δ0 = 0,1 × segmento más corto; 6 pasos de Δ;
  6 rondas por paso; parábola; movimiento conjunto con respaldo del mejor individual; 9 → 17 → 33).
- Admisibilidad propia (X24 §6.2): dx ≥ 1e-6·ancho; concavidad ≤ 1° (regla de `surface.rs:293-304`);
  vértices bajo el terreno; tramos bajo el terreno (muestreo).

Referencias de cSlope (lectura, no copia): optimize.rs:54-71 (constantes), :451-484 (pick_seeds),
:1225-1262 (rondas), :1284-1298 (parábola), :1349-1368 y decide() (movimiento y paro),
surface.rs:286-305 (concavidad). Lineas de ogs-core: search.rs:139-182 y :520-545 (malla y círculo).
"""
from __future__ import annotations

import copy
import math
import sys
import time

import opengeoslide as og  # noqa: E402  (wheel 0.4.0)

METHOD_MP = "morgenstern_price"
METHOD_SP = "spencer"
DELTA_REL = 0.1          # Δ0 = 0,1 × segmento más corto (optimize.rs:64-65)
MIN_DELTA_REL = 0.02     # se para cuando Δ < 0,02·Δ0 (optimize.rs:66-69)
ROUNDS = 6               # rondas por Δ (optimize.rs:70-71)
STAGES = (9, 17, 33)     # vértices (9→17→33; el de cSlope es 9→17 y pulido a 33)
BUDGET = 1500            # evaluaciones por semilla (optimize.rs:112)
POLISH_BUDGET = 3000     # pulido (optimize.rs:414)
POLISH_CYCLES = 4        # optimize.rs:61
CONCAVITY_DEG = 1.0
MIN_DX_REL = 1e-6        # dx ≥ 1e-6·ancho
ACCEPT_TOL = 1e-6        # aceptar si F < F0 − 1e-6 (optimize.rs decide)
SEEDS = 3
SEED_SPAN_REL = 0.05     # semillas distintas si la entrada o la salida se separan > 5 % del span


class Site:
    """Terreno y límites a partir de `regions` (polígonos del modelo v0.3)."""

    def __init__(self, model: dict):
        self.polys = [r["polygon"] for r in model["regions"]]
        pts = [p for poly in self.polys for p in poly]
        self.xmin = min(p[0] for p in pts)
        self.xmax = max(p[0] for p in pts)
        self.ymin = min(p[1] for p in pts)
        self.W = self.xmax - self.xmin

    def t(self, x: float):
        """Terreno: envolvente superior de los polígonos en x (None fuera del modelo)."""
        best = None
        for poly in self.polys:
            n = len(poly)
            for i in range(n):
                (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
                if x1 == x2:
                    if x == x1:
                        for y in (y1, y2):
                            best = y if best is None or y > best else best
                elif min(x1, x2) <= x <= max(x1, x2):
                    y = y1 + (y2 - y1) * (x - x1) / (x2 - x1)
                    best = y if best is None or y > best else best
        return best


class Eng:
    """Evaluador: una llamada de `analyze` por superficie, un método por llamada."""

    def __init__(self, case_model: dict, method: str):
        m = copy.deepcopy(case_model)
        a = m["analysis"]
        a.pop("search", None)
        a.pop("surface", None)
        a["methods"] = [method]
        if method == METHOD_MP:
            a["interslice"] = {"function": "constant"}
        else:
            a.pop("interslice", None)
        self.base = m
        self.calls = 0
        self.errors = {}

    def fos(self, surface: dict):
        """(FS, resultado). FS = None si el motor no converge o la superficie es inválida."""
        self.calls += 1
        m = dict(self.base)
        a = dict(self.base["analysis"])
        a["surface"] = surface
        m["analysis"] = a
        if not hasattr(self, "stat"):
            self.stat = {}
        try:
            r = og.analyze(m)["results"][0]
        except ValueError as exc:  # p. ej. NoValidSurface: el arco sale del modelo
            key = "error:" + str(exc).split(":")[0]
            self.stat[key] = self.stat.get(key, 0) + 1
            self.errors[str(exc).split(":")[0]] = self.errors.get(str(exc).split(":")[0], 0) + 1
            return None, {"status": "error", "error": str(exc)}
        f = r.get("fos")
        key = str(r.get("status"))
        self.stat[key] = self.stat.get(key, 0) + 1
        if r.get("status") == "converged" and f is not None and math.isfinite(f):
            return float(f), r
        return None, r


def window(case_model: dict, site: Site):
    """[e_l, e_r], [x_l, x_r] de la búsqueda del caso; si no hay, todo el modelo."""
    s = case_model["analysis"].get("search") or {}
    ent = s.get("entry") or [site.xmin, site.xmax]
    ex = s.get("exit") or [site.xmin, site.xmax]
    return [float(ent[0]), float(ent[1])], [float(ex[0]), float(ex[1])]


def span_of(win) -> float:
    (el, er), (xl, xr) = win
    return max(abs(er - xl), abs(xr - el), 1.0)


def linspace(lo, hi, n):
    if n == 1:
        return [0.5 * (lo + hi)]
    return [lo + (hi - lo) * (i / (n - 1)) for i in range(n)]


def grid_circles(site: Site, eng: Eng, win, n_e: int, n_s: int, n_r: int, mrf: float):
    """Malla de círculos fijos (xe, xs, ρ) como search.rs:120-182. Devuelve filas con FS (o None)."""
    E = linspace(win[0][0], win[0][1], n_e)
    S = linspace(win[1][0], win[1][1], n_s)
    RH = linspace(math.log(1.0001), math.log(2.0 * mrf), n_r)
    rows = []
    for i, xe in enumerate(E):
        for j, xs in enumerate(S):
            if not xs > xe + MIN_DX_REL * site.W:
                continue
            ye, ys = site.t(xe), site.t(xs)
            if ye is None or ys is None:
                continue
            dx, dy = xs - xe, ys - ye
            chord = math.hypot(dx, dy)
            half = 0.5 * chord
            nx, ny = -dy / chord, dx / chord
            for k, rho in enumerate(RH):
                dist = half * math.sqrt(math.expm1(2.0 * rho))
                R = half * math.exp(rho)
                xc = 0.5 * (xe + xs) + dist * nx
                yc = 0.5 * (ye + ys) + dist * ny
                if not (ye < yc and ys < yc):  # el arco útil es el inferior (entre xe y xs)
                    rows.append(dict(i=i, j=j, k=k, xe=xe, xs=xs, rho=rho, xc=xc, yc=yc, r=R, fos=None))
                    continue
                f, _ = eng.fos({"type": "circle", "xc": xc, "yc": yc, "r": R})
                rows.append(dict(i=i, j=j, k=k, xe=xe, xs=xs, rho=rho, xc=xc, yc=yc, r=R, fos=f))
    return rows


def pick_seeds(rows, win):
    """Como pick_seeds (optimize.rs:451-484): por FS y, a igualdad, por índice; distintas si >5 % del span."""
    valid = [r for r in rows if r["fos"] is not None]
    valid.sort(key=lambda r: (r["fos"], r["i"], r["j"], r["k"]))
    span = span_of(win)
    seeds = []
    for c in valid:
        if len(seeds) >= SEEDS:
            break
        if all(abs(s["xe"] - c["xe"]) > SEED_SPAN_REL * span or abs(s["xs"] - c["xs"]) > SEED_SPAN_REL * span
               for s in seeds):
            seeds.append(c)
    return seeds


def circle_to_polyline(site: Site, c: dict, n: int = 9):
    """Círculo → polilínea: x iguales entre entrada y salida, arco inferior (surface.rs:493-514 de ogs-core)."""
    xe, xs = c["xe"], c["xs"]
    pts = [[xe, site.t(xe)]]
    for i in range(1, n - 1):
        x = xe + i * (xs - xe) / (n - 1)
        pts.append([x, c["yc"] - math.sqrt(max(c["r"] ** 2 - (x - c["xc"]) ** 2, 0.0))])
    pts.append([xs, site.t(xs)])
    return pts


def refine_points(P):
    """Duplica vértices: inserta el punto medio de cada segmento (9→17→33)."""
    out = []
    for i in range(len(P)):
        out.append(P[i])
        if i < len(P) - 1:
            out.append([0.5 * (P[i][0] + P[i + 1][0]), 0.5 * (P[i][1] + P[i + 1][1])])
    return out


def min_segment(P) -> float:
    return min(math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]) for i in range(len(P) - 1))


def _unit_up_normal(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    nx, ny = -dy / L, dx / L
    if ny < 0:
        nx, ny = -nx, -ny
    return nx, ny


class NC:
    """Variación alterna sobre una polilínea (X24 §6.1 con la mecánica de optimize.rs)."""

    def __init__(self, site: Site, eng: Eng, win, budget: int):
        self.s = site
        self.e = eng
        self.win = win
        self.budget = budget
        self.used = 0
        self.rej_adm = 0      # candidatos no admisibles (no cuentan como evaluación)
        self.rej_eng = 0      # candidatos admisibles que el motor no da como convergidos
        self.last_gain = None

    # --- admisibilidad (X24 §6.2) ---
    def admissible(self, Q) -> bool:
        n = len(Q)
        if n < 2:
            return False
        W = self.s.W
        for i in range(n - 1):
            if not (Q[i + 1][0] - Q[i][0] >= MIN_DX_REL * W):
                return False
        prev = None
        tol = math.radians(CONCAVITY_DEG)
        for i in range(n - 1):
            alpha = math.atan2(Q[i][1] - Q[i + 1][1], Q[i + 1][0] - Q[i][0])
            if prev is not None and alpha > prev + tol:
                return False
            prev = alpha
        for k in range(1, n - 1):
            x, y = Q[k]
            ty = self.s.t(x)
            if ty is None or not (y < ty - 1e-6) or not (y > self.s.ymin):
                return False
        for i in range(n - 1):  # tramos bajo el terreno (muestreo de 8 puntos)
            for q in range(1, 8):
                f = q / 8.0
                x = Q[i][0] + f * (Q[i + 1][0] - Q[i][0])
                y = Q[i][1] + f * (Q[i + 1][1] - Q[i][1])
                ty = self.s.t(x)
                if ty is None or y >= ty:
                    return False
        return True

    def fos(self, Q):
        """FS de Q (cuenta una evaluación si Q es admisible; None si no lo es o no converge)."""
        if not self.admissible(Q):
            self.rej_adm += 1
            return None
        self.used += 1
        f, _ = self.e.fos({"type": "polyline", "points": [[x, y] for x, y in Q]})
        if f is None:
            self.rej_eng += 1
        return f

    # --- movimiento ---
    def _direction(self, P, k):
        n1 = _unit_up_normal(P[k - 1], P[k])
        n2 = _unit_up_normal(P[k], P[k + 1])
        bx, by = n1[0] + n2[0], n1[1] + n2[1]
        L = math.hypot(bx, by)
        if L < 1e-12:
            return n1
        bx, by = bx / L, by / L
        if by < 0:
            bx, by = -bx, -by
        return (bx, by)

    def _move_point(self, P, k, t, dirs):
        n = len(P)
        if k == 0 or k == n - 1:  # extremos: deslizan por el terreno dentro de la ventana
            x = P[k][0] + t
            lo, hi = (self.win[0] if k == 0 else self.win[1])
            if not (lo <= x <= hi):
                return None
            y = self.s.t(x)
            return None if y is None else (x, y)
        b = dirs[k]
        return (P[k][0] + t * b[0], P[k][1] + t * b[1])

    def optimise(self, P, F, delta0: float):
        """Un ciclo de variación alterna para un nivel de vértices. Devuelve (P, F)."""
        delta = delta0
        while delta >= MIN_DELTA_REL * delta0 - 1e-15:
            rnd = 0
            while rnd < ROUNDS and self.used < self.budget:
                f0 = F
                n = len(P)
                dirs = [None] + [self._direction(P, k) for k in range(1, n - 1)] + [None]
                sides = []
                best_single = None  # (FS, polilínea)
                for k in range(n):
                    pair = [None, None]
                    for j, t in enumerate((delta, -delta)):
                        if self.used >= self.budget:
                            break
                        pt = self._move_point(P, k, t, dirs)
                        if pt is None:
                            continue
                        Q = list(P)
                        Q[k] = [pt[0], pt[1]]
                        fq = self.fos(Q)
                        pair[j] = fq
                        if fq is not None and (best_single is None or fq < best_single[0]):
                            best_single = (fq, Q)
                    sides.append(pair)
                shifts = [0.0] * n
                for k in range(n):
                    fp, fm = sides[k]
                    t = 0.0
                    if fp is not None and fm is not None:
                        curv = fp + fm - 2.0 * f0
                        if curv > 0:
                            t = delta * (fm - fp) / (2.0 * curv)
                            t = max(-delta, min(delta, t))
                        elif fp < f0 or fm < f0:
                            t = delta if fp < fm else -delta
                    elif fp is not None and fp < f0:
                        t = delta
                    elif fm is not None and fm < f0:
                        t = -delta
                    shifts[k] = t
                joint = None
                if any(s != 0.0 for s in shifts) and self.used < self.budget:
                    Qj = []
                    ok = True
                    for k in range(n):
                        if shifts[k] == 0.0:
                            Qj.append(list(P[k]))
                            continue
                        pt = self._move_point(P, k, shifts[k], dirs)
                        if pt is None:
                            ok = False
                            break
                        Qj.append([pt[0], pt[1]])
                    if ok:
                        fj = self.fos(Qj)
                        if fj is not None:
                            joint = (fj, Qj)
                moved = joint
                if best_single is not None and (moved is None or best_single[0] < moved[0]):
                    moved = best_single
                if moved is not None and moved[0] < f0 - ACCEPT_TOL:
                    self.last_gain = f0 - moved[0]
                    P, F = moved[1], moved[0]
                    rnd += 1
                else:
                    break
            delta /= 2.0
        return P, F

    def run(self, seed_pts, polish: bool = False):
        """Una semilla: 9 → 17 → 33 con presupuesto por semilla; pulido opcional del 33 (cSlope)."""
        P = [list(p) for p in seed_pts]
        F = self.fos(P)
        if F is None:
            return dict(fos=None, reason="seed_polyline_not_evaluable", used=self.used, points=P)
        stage_log = []
        fos0 = F
        last_gain = 0.0
        for nv in STAGES:
            if nv > len(P):
                P = refine_points(P)
                F2 = self.fos(P)  # reevaluación tras duplicar vértices
                if F2 is None:
                    stage_log.append(dict(vertices=len(P), fos=None))
                    break
                F = F2
            if self.used >= self.budget:
                stage_log.append(dict(vertices=len(P), fos=F, skipped="budget"))
                continue
            F_before = F
            P, F = self.optimise(P, F, DELTA_REL * min_segment(P))
            last_gain = F_before - F
            stage_log.append(dict(vertices=len(P), fos=F, used=self.used, gain=last_gain))
        polish_log = []
        if polish:  # optimize.rs:1462-1485: hasta 4 ciclos mientras el último baje más que la tolerancia
            cyc = 0
            while cyc < POLISH_CYCLES and last_gain > ACCEPT_TOL:
                saved = self.budget
                self.budget = self.used + POLISH_BUDGET
                F_before = F
                P, F = self.optimise(P, F, DELTA_REL * min_segment(P))
                self.budget = saved
                last_gain = F_before - F
                polish_log.append(dict(cycle=cyc + 1, fos=F, gain=last_gain))
                cyc += 1
        return dict(fos=F, fos0=fos0, points=P, used=self.used, stages=stage_log, polish=polish_log,
                    rej_adm=self.rej_adm, rej_eng=self.rej_eng)
