"""X37: generadores globales no circulares y tubería (generador -> refinamiento -> pulido).

Nombre de archivo fijado por el brief. `global` es palabra reservada en Python: se carga con importlib (run_x37.py).

Contenido:
- SplitMix64 (PRNG de semilla fija, escrito aquí).
- admissible(): réplica en Python de `search_polyline_admissible` (crates/ogs-core/src/surface.rs:262-295)
  y de los límites de ventana de `noncircular.rs:25-41`.
- sliding_windows(): réplica de `resolve_sliding` (crates/ogs-core/src/geometry.rs:783-820) para auto.
- G1 path (gen_path), G2 bloque automático (gen_block, con contact_layers), G3 recocido (gen_sa).
- refine(): variación alterna de nc.py (= noncircular.rs:57-150) con 9 -> 17 -> 33 y, si hace falta, inserción
  del punto medio del segmento más largo para llegar a un nivel (los generadores no dan 9 vértices).
- polish(): pulido de cSlope (X31 §4, optimize.rs:404-436 y 1462-1477): gate gain > 0,001, 4 ciclos y
  presupuesto total 2 × 1500 = 3000 (el subproceso `OptimisePoints` de optimize.rs:414).
"""
import math

import nc as X  # copia de X29 nc.py (Site, Eng, NC base, grid_circles, pick_seeds, min_segment, DELTA_REL, ...)

MASK = (1 << 64) - 1
GOLD = 0x9E3779B97F4A7C15
BUDGET = 1500          # noncircular.rs:12 (por semilla)
POLISH_BUDGET = 3000   # 2 × budget_per_seed (optimize.rs:414)
POLISH_CYCLES = 4      # optimize.rs:61
POLISH_TOL = 0.001     # tolerancia de cSlope (cslope/build.py:199), gate de optimize.rs:1462-1469
RUST_ADM_TOL_REL = 1e-9


# ---------------------------------------------------------------- PRNG (SplitMix64)

class SplitMix64:
    def __init__(self, seed: int):
        self.state = seed & MASK

    def next_u64(self) -> int:
        self.state = (self.state + GOLD) & MASK
        z = self.state
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & MASK
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & MASK
        return z ^ (z >> 31)

    def unif(self, a: float, b: float) -> float:
        return a + (b - a) * ((self.next_u64() >> 11) / 9007199254740992.0)

    def below(self, n: int) -> int:
        return self.next_u64() % n


# ---------------------------------------------------------------- sitio, ventanas y admisibilidad

def site_of(model: dict) -> X.Site:
    s = X.Site(model)
    s.ymax = max(p[1] for poly in s.polys for p in poly)
    s.scale = max(s.W, s.ymax - s.ymin)  # [inferido] scale de geometry.rs (no localizado); solo afecta a tol
    return s


def sliding_windows(model: dict, site: X.Site):
    """(izquierda, derecha, ltr): ventana del extremo izquierdo y del derecho, como noncircular.rs:refine."""
    s = (model.get("analysis") or {}).get("search") or {}
    ent = s.get("entry") or [site.xmin, site.xmax]
    ex = s.get("exit") or [site.xmin, site.xmax]
    d = (model.get("slope") or {}).get("direction", "auto")
    if d == "left_to_right":
        ltr = True
    elif d == "right_to_left":
        ltr = False
    else:  # resolve_sliding, geometry.rs:795-820
        me, mx = 0.5 * (ent[0] + ent[1]), 0.5 * (ex[0] + ex[1])
        if abs(me - mx) > 1e-9 * site.W:
            ltr = me < mx
        else:
            yl, yr = site.t(site.xmin), site.t(site.xmax)
            if yl is not None and yr is not None and abs(yl - yr) > 1e-6 * (site.ymax - site.ymin):
                ltr = yl > yr
            else:
                ltr = True
    left, right = (ent, ex) if ltr else (ex, ent)
    return [float(left[0]), float(left[1])], [float(right[0]), float(right[1])], ltr


def ends_in_windows(site, Q, wl, wr) -> bool:
    m = max(1e-9 * site.scale, 1e-6 * site.W)  # noncircular.rs:25-27 (window_margin)
    a, b = Q[0][0], Q[-1][0]
    return (min(wl) - m <= a <= max(wl) + m) and (min(wr) - m <= b <= max(wr) + m)


def admissible(site, Q) -> bool:
    """Réplica de search_polyline_admissible (surface.rs:262-295), sin la comprobación de fit_to_ground
    (esa la hace el motor: un rechazo del motor se cuenta aparte)."""
    n = len(Q)
    if n < 2:
        return False
    for p in Q:
        if not (math.isfinite(p[0]) and math.isfinite(p[1])):
            return False
    tol_deg = math.radians(1.0)
    prev = None
    for i in range(n - 1):
        dx = Q[i + 1][0] - Q[i][0]
        if dx <= 0.0 or dx < 1e-6 * site.W:
            return False
        alpha = math.atan2(Q[i][1] - Q[i + 1][1], dx)
        if prev is not None and alpha > prev + tol_deg:
            return False
        prev = alpha
        for k in range(1, 8):
            t = k / 8.0
            x = Q[i][0] + t * dx
            y = Q[i][1] + t * (Q[i + 1][1] - Q[i][1])
            g = site.t(x)
            if g is None or y >= g:
                return False
    tol = RUST_ADM_TOL_REL * site.scale
    for p in Q[1:-1]:
        g = site.t(p[0])
        if g is None or p[1] >= g - tol or p[1] <= site.ymin:
            return False
    return True


def ok_candidate(site, Q, wl, wr) -> bool:
    return admissible(site, Q) and ends_in_windows(site, Q, wl, wr)


def steepest_terrain_deg(site, n: int = 2000) -> float:
    xs = [site.xmin + site.W * i / n for i in range(n + 1)]
    best = 0.0
    for a, b in zip(xs, xs[1:]):
        ya, yb = site.t(a), site.t(b)
        if ya is None or yb is None:
            continue
        best = max(best, abs(math.degrees(math.atan2(yb - ya, b - a))))
    return best


def model_height(site) -> float:
    xs = [site.xmin + site.W * i / 400 for i in range(401)]
    ys = [site.t(x) for x in xs]
    ys = [y for y in ys if y is not None]
    return max(ys) - min(ys)


# ---------------------------------------------------------------- G1: path

def gen_path(site, wl, wr, ltr: bool, rng: SplitMix64, N: int, H: float):
    """Muestreo tipo Path Search (X31 §1, OGR X31 §2): desde una salida aleatoria en la ventana de salida,
    segmentos de longitud 0,3·H; primer ángulo U(−45°, b−5°); luego el ángulo solo sube (U(φ, b−5°)), como OGR.
    Termina al cortar el terreno dentro de la ventana de entrada; máximo 30 segmentos; intentos ≤ 20·N."""
    ell = 0.3 * H
    phimax = math.radians(steepest_terrain_deg(site) - 5.0)
    phimin = -math.pi / 4
    sgn = -1.0 if ltr else 1.0
    start, end = (wr, wl) if ltr else (wl, wr)
    out, att = [], 0
    st = dict(attempts=0, walk_fail=0, not_admissible=0)
    while len(out) < N and att < 20 * N:
        att += 1
        x0 = rng.unif(start[0], start[1])
        y0 = site.t(x0)
        if y0 is None:
            st["walk_fail"] += 1
            continue
        P = [[x0, y0]]
        phi = rng.unif(phimin, phimax)
        done = False
        for _seg in range(30):
            if _seg > 0:
                phi = rng.unif(phi, phimax) if phi < phimax else phimax
            px, py = P[-1]
            nx = px + sgn * ell * math.cos(phi)
            ny = py + ell * math.sin(phi)
            tn = site.t(nx)
            if tn is None or ny <= site.ymin:
                break
            if ny >= tn:  # cruza el terreno: bisección sobre el segmento
                lo, hi = 0.0, 1.0
                for _ in range(60):
                    mid = 0.5 * (lo + hi)
                    mx, my = px + mid * (nx - px), py + mid * (ny - py)
                    tm = site.t(mx)
                    if tm is None or my >= tm:
                        hi = mid
                    else:
                        lo = mid
                xe = px + 0.5 * (lo + hi) * (nx - px)
                te = site.t(xe)
                if te is not None:
                    P.append([xe, te])
                    done = True
                break
            P.append([nx, ny])
        if not done:
            st["walk_fail"] += 1
            continue
        Q = sorted(P, key=lambda p: p[0])
        if ok_candidate(site, Q, wl, wr):
            out.append(Q)
        else:
            st["not_admissible"] += 1
    st["attempts"] = att
    return out, st


# ---------------------------------------------------------------- G2: bloque automático

def _pip(pt, poly) -> bool:
    x, y = pt
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xint = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xint:
                inside = not inside
    return inside


def contact_layers(model: dict, site: X.Site):
    """Regla de capas débiles (G2):
    1. Resistencia relativa a la profundidad de cada región r: rho_r = c_r/(gamma_r·z_r) + tan(phi_r),
       con z_r = profundidad del centroide de vértices bajo el terreno.
    2. Contacto: arista no vertical de r cuyo punto medio, desplazado ±eps en la normal, cae en otra región.
    3. Capa = todas las aristas de contacto de la región de menor rho que tenga contactos.
    4. Si ninguna región tiene contactos (talud homogéneo): «bases» = aristas no verticales, no en el terreno,
       con el lado exterior fuera de todas las regiones (fondo del modelo)."""
    mats = {m["id"]: m for m in model["materials"]}
    polys = [r["polygon"] for r in model["regions"]]
    eps = 1e-4 * (site.ymax - site.ymin)
    rhos = []
    for ri, r in enumerate(model["regions"]):
        poly = r["polygon"]
        m = mats[r["material"]]
        c = float(m.get("cohesion") or 0.0)
        phi = math.radians(float(m.get("friction_angle") or 0.0))
        gam = float(m.get("unit_weight") or 0.0)
        xc = sum(p[0] for p in poly) / len(poly)
        yc = sum(p[1] for p in poly) / len(poly)
        t = site.t(xc)
        z = (t - yc) if t is not None else 0.0
        rho = (c / (gam * z) + math.tan(phi)) if (gam > 0 and z > 0) else float("inf")
        rhos.append(rho)
    cands = {}
    for ri, poly in enumerate(polys):
        n = len(poly)
        for i in range(n):
            A, B = poly[i], poly[(i + 1) % n]
            dx, dy = B[0] - A[0], B[1] - A[1]
            L = math.hypot(dx, dy)
            if abs(dx) <= 1e-9 * site.W or L <= 0:
                continue
            M = [0.5 * (A[0] + B[0]), 0.5 * (A[1] + B[1])]
            nx, ny = -dy / L, dx / L
            other_plus = any(_pip((M[0] + eps * nx, M[1] + eps * ny), polys[j]) for j in range(len(polys)) if j != ri)
            other_minus = any(_pip((M[0] - eps * nx, M[1] - eps * ny), polys[j]) for j in range(len(polys)) if j != ri)
            if other_plus or other_minus:
                cands.setdefault(ri, []).append((tuple(A), tuple(B), "contacto"))
    if cands:
        ri = min(cands, key=lambda k: (rhos[k], k))
        layers = [(a, b) for a, b, _ in cands[ri]]
        return layers, dict(rule="contacto", region=ri, rho=rhos[ri], n_edges=len(layers))
    # fallback: bases (aristas cuyo lado exterior no está en ninguna región y que no son del terreno)
    bases = []
    for ri, poly in enumerate(polys):
        n = len(poly)
        for i in range(n):
            A, B = poly[i], poly[(i + 1) % n]
            dx, dy = B[0] - A[0], B[1] - A[1]
            L = math.hypot(dx, dy)
            if abs(dx) <= 1e-9 * site.W or L <= 0:
                continue
            M = [0.5 * (A[0] + B[0]), 0.5 * (A[1] + B[1])]
            tm = site.t(M[0])
            if tm is not None and abs(M[1] - tm) <= 1e-6 * (site.ymax - site.ymin):
                continue  # está en el terreno
            nx, ny = -dy / L, dx / L
            outside = [(M[0] - eps * nx, M[1] - eps * ny), (M[0] + eps * nx, M[1] + eps * ny)]
            ext = [pt for pt in outside if not any(_pip(pt, pp) for pp in polys)]
            if ext:
                bases.append((tuple(A), tuple(B), "base"))
    layers = [(a, b) for a, b, _ in bases]
    return layers, dict(rule="base", region=None, rho=None, n_edges=len(layers))


def _project(site, P, th: float, H: float):
    """Proyección de P a la superficie con dirección th (rad): primera intersección con el terreno."""
    dx, dy = math.cos(th), math.sin(th)
    step = 0.01 * H
    smax = 3.0 * (site.W + H)
    s, prev = 0.0, 0.0
    a = b = None
    while True:
        s += step
        if s > smax:
            return None
        x, y = P[0] + s * dx, P[1] + s * dy
        g = site.t(x)
        if g is None:
            return None
        if y >= g:
            a, b = prev, s
            break
        prev = s
    for _ in range(60):
        mid = 0.5 * (a + b)
        x, y = P[0] + mid * dx, P[1] + mid * dy
        g = site.t(x)
        if g is None or y >= g:
            b = mid
        else:
            a = mid
    x = P[0] + b * dx
    return [x, site.t(x)]


def gen_block(site, layers, wl, wr, rng: SplitMix64, N: int, H: float):
    """Bloque tipo Block Search (X31 §1): k ∈ {2, 3} segmentos sobre la capa (k+1 puntos sobre una arista),
    proyección izquierda con ángulo U(90°,135°) y derecha U(45°,90°) hasta el terreno."""
    out, att = [], 0
    st = dict(attempts=0, proj_fail=0, not_admissible=0)
    if not layers:
        return out, st
    while len(out) < N and att < 20 * N:
        att += 1
        A, B = layers[rng.below(len(layers))]
        k = 2 + rng.below(2)
        ts = sorted(rng.unif(0.0, 1.0) for _ in range(k + 1))
        pts = [[A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])] for t in ts]
        pts.sort(key=lambda p: p[0])
        thL = math.radians(rng.unif(90.0, 135.0))
        thR = math.radians(rng.unif(45.0, 90.0))
        EL = _project(site, pts[0], thL, H)
        ER = _project(site, pts[-1], thR, H)
        if EL is None or ER is None:
            st["proj_fail"] += 1
            continue
        Q = [EL] + pts + [ER]
        if ok_candidate(site, Q, wl, wr):
            out.append(Q)
        else:
            st["not_admissible"] += 1
    st["attempts"] = att
    return out, st


# ---------------------------------------------------------------- G3: recocido

def circle_polyline9(site, circ: dict):
    """Círculo -> polilínea de 9 vértices con los cortes del círculo con el terreno (bisección)."""
    xc, yc, r = circ["xc"], circ["yc"], circ["r"]

    def arc(x):
        return yc - math.sqrt(max(r * r - (x - xc) ** 2, 0.0))

    def below(x):
        g = site.t(x)
        return g is not None and abs(x - xc) <= r and arc(x) < g - 1e-9

    lo = max(site.xmin, xc - r)
    hi = min(site.xmax, xc + r)
    n = 2000
    xs = [lo + (hi - lo) * i / n for i in range(n + 1)]
    flags = [below(x) for x in xs]
    # tramo principal: la racha contigua de muestras bajo el terreno con la mayor profundidad (el lente bajo
    # el pie se descarta, como slice_surface en search_circle_polyline, surface.rs:…)
    runs, i = [], 0
    while i <= n:
        if flags[i]:
            j = i
            while j + 1 <= n and flags[j + 1]:
                j += 1
            runs.append((i, j))
            i = j + 1
        else:
            i += 1
    if not runs:
        return None

    def depth(run):
        a, b = run
        return max((site.t(xs[k]) or 0.0) - arc(xs[k]) for k in range(a, b + 1))

    i0, i1 = max(runs, key=lambda rr: (depth(rr), -rr[0]))
    i0, i1 = i0, i1

    def edge(a, b):  # a fuera, b dentro
        for _ in range(60):
            m = 0.5 * (a + b)
            if below(m):
                b = m
            else:
                a = m
        return b

    xl = edge(xs[i0 - 1], xs[i0]) if i0 > 0 else xs[i0]
    xr = edge(xs[i1 + 1], xs[i1]) if i1 < n else xs[i1]
    tl, tr = site.t(xl), site.t(xr)
    if tl is None or tr is None or xr <= xl:
        return None
    P = [[xl, tl]]
    for i in range(1, 8):
        x = xl + i * (xr - xl) / 8.0
        P.append([x, arc(x)])
    P.append([xr, tr])
    return P


def gen_sa(eng, site, wl, wr, P0, F0, rng: SplitMix64, N: int, H: float):
    """Recocido simulado (X37 brief, G3): estado = profundidades (y) de los 7 vértices interiores de la polilínea
    de 9 vértices que parte del mejor círculo; extremos fijos. Propuesta: un vértice i ~ U{1..7},
    y_i += σ_k·U(−1,1), σ_k = max(0,2·H·T_k/T0, 0,005·H). Enfriamiento geométrico por evaluación:
    T_k = T0·(Tfin/T0)^(k/(N−1)), T0 = 0,02, Tfin = 5e-4 (unidades de FS). Metropolis sobre FS.
    Solo se evalúan propuestas admisibles; intentos ≤ 20·N. Cada estado evaluado es un candidato."""
    T0, Tfin = 0.02, 5e-4
    cur, Fcur = [list(map(float, p)) for p in P0], F0
    cands = []  # (FS, idx, P)
    att = 0
    st = dict(attempts=0, not_admissible=0, engine_none=0, accepted=0)
    while len(cands) < N and att < 20 * N:
        att += 1
        k = len(cands)
        Tk = T0 * (Tfin / T0) ** (k / max(N - 1, 1))
        sig = max(0.2 * H * (Tk / T0), 0.005 * H)
        i = 1 + rng.below(7)
        u = rng.unif(-1.0, 1.0)
        Q = [list(p) for p in cur]
        Q[i][1] = cur[i][1] + sig * u
        if not admissible(site, Q):
            st["not_admissible"] += 1
            continue
        f, _ = eng.fos({"type": "polyline", "points": Q})
        if f is None:
            st["engine_none"] += 1
            continue
        cands.append((f, k, Q))
        dF = f - Fcur
        if dF <= 0 or rng.unif(0.0, 1.0) < math.exp(-dF / Tk):
            cur, Fcur = Q, f
            st["accepted"] += 1
    st["attempts"] = att
    return cands, st


# ---------------------------------------------------------------- refinamiento, pulido y tubería

def insert_to(P, L: int):
    """Sube P a L vértices: doble (todos los segmentos) si L = 2n−1; si no, punto medio del segmento más largo."""
    P = [list(p) for p in P]
    if L == 2 * len(P) - 1:
        return X.refine_points(P)
    while len(P) < L:
        j = max(range(len(P) - 1), key=lambda i: math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]))
        mid = [0.5 * (P[j][0] + P[j + 1][0]), 0.5 * (P[j][1] + P[j + 1][1])]
        P.insert(j + 1, mid)
    return P


class NCx(X.NC):
    """NC de nc.py con la admisibilidad de Rust (admissible) en lugar de la de X29."""

    def admissible(self, Q) -> bool:  # noqa: D401
        return admissible(self.s, Q)


def refine(eng, site, win, P, budget: int = BUDGET):
    """Variación alterna 9 -> 17 -> 33 (noncircular.rs:refine). Devuelve dict con F, P, gain (última etapa), nc."""
    nc = NCx(site, eng, win, budget)
    P = [list(map(float, p)) for p in P]
    F = nc.fos(P)
    if F is None:
        return dict(F=None, P=P, gain=0.0, nc=nc, stages=[])
    gain = 0.0
    stages = []
    for lv in (9, 17, 33):
        if len(P) < lv:
            Q = insert_to(P, lv)
            F2 = nc.fos(Q)
            if F2 is None:
                break
            P, F = Q, F2
        Fb = F
        P, F = nc.optimise(P, F, X.DELTA_REL * X.min_segment(P))
        gain = Fb - F
        stages.append(dict(vertices=len(P), fos=F, gain=gain, used=nc.used))
    return dict(F=F, P=P, gain=gain, nc=nc, stages=stages)


def polish(res, site):
    """Pulido de cSlope (X31 §4): gate gain > POLISH_TOL; hasta 4 ciclos; presupuesto total 3000 (optimize.rs:414)."""
    nc = res["nc"]
    P, F, gain = res["P"], res["F"], res["gain"]
    budget_total = nc.used + POLISH_BUDGET
    cyc = 0
    saved = nc.budget
    nc.budget = budget_total
    while cyc < POLISH_CYCLES and gain > POLISH_TOL and nc.used < budget_total:
        F0 = F
        P, F = nc.optimise(P, F, X.DELTA_REL * X.min_segment(P))
        gain = F0 - F
        cyc += 1
    nc.budget = saved
    return dict(F=F, P=P, cycles=cyc, used=nc.used)


def pick_distinct(cands, win, k: int = 3):
    """Criterio de search.rs:349-356 / optimize.rs:451-484 sobre los extremos (izquierdo, derecho)."""
    span = X.span_of(win)
    seeds = []
    for f, idx, P in sorted(cands, key=lambda c: (c[0], c[1])):
        xl, xr = P[0][0], P[-1][0]
        ok = all(abs(xl - q[2][0][0]) > 0.05 * span or abs(xr - q[2][-1][0]) > 0.05 * span for q in seeds)
        if ok:
            seeds.append((f, idx, P))
            if len(seeds) >= k:
                break
    return seeds
