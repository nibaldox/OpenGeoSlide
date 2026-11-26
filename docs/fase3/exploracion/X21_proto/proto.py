"""Prototipo X21: grieta de tracción y agua embalsada sobre las dovelas del motor.

Entrada: un documento ogs (v0.4) con, además, los campos propuestos para v0.5
  analysis.tension_crack = {"depth": <m> | "auto", "water": <fracción 0..1>}
  water.free_water       = true
y una superficie fija en analysis.surface (círculo o polilínea). Salida: FS por método y términos.
"""
from __future__ import annotations
import copy, json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine, equilibrium, geometry, solvers, terms

GW = 9.81


def direction_sign(model, surface, terrain):
    """Regla de `slope.direction` del contrato (§1, E1/E1b): explícita; si es auto, el extremo más alto del modelo es la
    cresta (|Δy| > 1e-6·altura); si no, la entrada (extremo más alto de la superficie) es la cresta."""
    d = (model.get("slope") or {}).get("direction", "auto")
    if d == "left_to_right":
        return +1
    if d == "right_to_left":
        return -1
    ys = [terrain.top(x, 0) for x in (terrain.xmin, terrain.xmax)]
    ysall = [y for e in terrain.edges for y in (e[1], e[3])]
    height = max(ysall) - min(ysall)
    if abs(ys[0] - ys[1]) > 1e-6 * height:
        return +1 if ys[0] > ys[1] else -1        # la cresta es el extremo alto; el deslizamiento va hacia el bajo
    ends = surface.ends(terrain)
    ya, yb = terrain.top(ends[0]), terrain.top(ends[1])
    return -1 if ya < yb else +1


def base_slices(model, nodes=()):
    res = engine.engine_results(model, extra_nodes=nodes)
    return res


def analyze(model, verbose=False, kh_water=False, equilibrium_check=True, slice_hook=None):
    m = copy.deepcopy(model)
    a = m["analysis"]
    crack = a.get("tension_crack")
    free = bool((m.get("water") or {}).get("free_water"))
    gw = (m.get("water") or {}).get("unit_weight", GW)
    terrain = geometry.Terrain(m)
    spec = a["surface"]
    surface = geometry.Surface(spec)
    s = direction_sign(m, surface, terrain)
    piezo = geometry.Piezo(m["water"]["piezometric_line"]) if (m.get("water") or {}).get("piezometric_line") else None
    circle = (surface.xc, surface.yc, surface.r) if surface.kind == "circle" else None
    info = {"s": s}

    xa, xb = surface.ends(terrain)
    # entrada = extremo del lado del que viene el deslizamiento (la cresta): hacia -s ... s=-1 desliza hacia -x, entrada a la derecha
    x_entry, x_exit = (xb, xa) if s == -1 else (xa, xb)
    xc = depth = None
    nodes = []
    if crack:
        dsp = crack["depth"]
        if dsp == "auto":
            def depth_at(x):
                q = 0.0
                for ld in m.get("loads", []):
                    if ld["type"] == "udl" and ld["x1"] <= x <= ld["x2"]:
                        q += ld["q"]
                if free and piezo is not None:
                    wy = piezo.y(x)
                    if wy > terrain.top(x):
                        q += gw * (wy - terrain.top(x))
                return geometry.rankine_depth(m, terrain, x, q)
            if depth_at(x_entry) > 0 or depth_at(x_exit) > 0:
                xc = geometry.find_crack_x(surface, terrain, x_entry, x_exit, depth_at)
                depth = depth_at(xc) if xc is not None else 1.0       # 1.0 solo marca «hay grieta»
                if xc is None:
                    depth = 1.0
            info["auto"] = True
        elif float(dsp) <= 0:
            crack = None                                   # profundidad 0 = sin grieta (neutralidad)
        else:
            depth = float(dsp)
            xc = geometry.find_crack_x(surface, terrain, x_entry, x_exit, lambda x: depth)
        if crack and depth is not None and depth > 0 and xc is None:
            info["status"] = "descartada: la superficie no alcanza la grieta"
            return None, info
        if xc is not None:
            nodes = [xc]
            info["crack_x"], info["crack_depth"] = xc, depth
    res = base_slices(m, nodes)
    ref = res.get("bishop") or res["spencer"]
    for meth, r in res.items():
        if r["status"] != "converged":
            info.setdefault("engine_status", {})[meth] = r["status"]
    sl_eng = ref["slices"]
    width = terrain.xmax - terrain.xmin
    slices = []
    for e in sl_eng:
        d = dict(e)
        d["V"], d["H"], d["Mb"], d["Dx"] = e["weight_extra"], e["h_force"], e["h_moment_base"], e["driving_extra"]
        slices.append(d)
    # truncado en la grieta: se quita todo lo que queda del lado de la cresta de x_c (más la dovela fina del nodo)
    if xc is not None:
        keep = []
        for d in slices:
            # lado de la cresta de la dovela: -s·x creciente; la dovela está «antes» de la grieta si su extremo de cresta <= xc
            crest_edge = d["x_right"] if s == -1 else d["x_left"]
            beyond = (crest_edge > xc + 1e-9 * width) if s == -1 else (crest_edge < xc - 1e-9 * width)
            thin = d["width"] < 1e-4 * width * 3 and abs(0.5 * (d["x_left"] + d["x_right"]) - xc) < 1e-5 * width
            if beyond or thin:
                continue
            keep.append(d)
        info["removed_weight"] = sum(d["weight"] for d in slices if d not in keep)
        info["removed_slices"] = [d for d in slices if d not in keep]
        slices = keep
        info["n_removed"] = len(sl_eng) - len(slices)
    # agua embalsada
    if free and piezo is not None:
        for d in slices:
            V, H, Mb, Dx, raw = terms.pond_slice(d, terrain, piezo, gw, s, circle)
            hw_, Mw_, Dw_, HYw = terms.wall_slice(d, terrain, piezo, gw, s, surface, circle)
            d["V"] += V
            d["H"] += H + hw_
            d["Mb"] += Mb + Mw_
            d["Dx"] += Dx + Dw_
            r = d.setdefault("raw", {"V": 0.0, "VM": 0.0, "H": 0.0, "HY": 0.0})
            for k in r:
                r[k] += raw[k]
            r["H"] += hw_
            r["HY"] += HYw
    # agua en la grieta
    if xc is not None and crack.get("water", 0) > 0:
        face = slices[-1]
        H, Mb, Dx, HY = terms.crack_water(depth, crack["water"], gw, surface.base_y(xc), face, s, circle)
        face["H"] += H
        face["Mb"] += Mb
        face["Dx"] += Dx
        r = face.setdefault("raw", {"V": 0.0, "VM": 0.0, "H": 0.0, "HY": 0.0})
        r["H"] += H
        r["HY"] += HY
    if slice_hook:
        slice_hook(slices)
    out = solvers.solve_all(slices, circular=circle is not None)
    info["equilibrium"] = equilibrium.check(slices, out, s, circle) if equilibrium_check else None
    out["engine_fos"] = {k: r["fos"] for k, r in res.items()}
    info["n_slices"] = len(slices)
    if verbose:
        info["slices"] = slices
    info["circle"] = circle
    info["slices"] = slices if verbose else None
    return out, info


if __name__ == "__main__":
    model = json.load(open(sys.argv[1]))
    out, info = analyze(model)
    print(json.dumps({"fos": out, "info": {k: v for k, v in info.items() if k != "slices"}}, indent=1, default=str))
