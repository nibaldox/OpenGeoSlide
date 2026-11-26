"""Prototipo X22: fuerza de pilote de Ito-Matsui sobre las dovelas del motor, en superficie fija (círculo).

Entrada: documento ogs v0.4 con `analysis.surface` (círculo) y `reinforcements[]` de tipo `pile` que pueden traer, además de los
campos de v0.4, los de la propuesta v0.5 (ver X22.md §6):
  "lateral_pressure": {"model": "ito_matsui", "diameter": d, "location": "centroid" | "slip_surface"}   (y `force` ausente)
  "capacity": {"shear": Vcap, "moment": Mcap}     (opcional, por pilote, como `shearCapacity`/`momentCapacity` de cSlope)
Un pilote con `force` (y sin `lateral_pressure`) es el de v0.4: sirve para validar los términos pasivos contra el motor.
Salida: FS por método, fuerza por cruce y residuos del equilibrio global independiente.
"""
from __future__ import annotations
import copy, json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine, equilibrium, geometry, pile as pilemod, solvers


def direction_sign(model, surface, terrain):
    """Regla de `slope.direction` del contrato (§1, E1/E1b), como X21."""
    d = (model.get("slope") or {}).get("direction", "auto")
    if d == "left_to_right":
        return +1
    if d == "right_to_left":
        return -1
    ys = [terrain.top(x, 0) for x in (terrain.xmin, terrain.xmax)]
    ysall = [y for e in terrain.edges for y in (e[1], e[3])]
    height = max(ysall) - min(ysall)
    if abs(ys[0] - ys[1]) > 1e-6 * height:
        return +1 if ys[0] > ys[1] else -1
    ends = surface.ends(terrain)
    return -1 if terrain.top(ends[0]) < terrain.top(ends[1]) else +1


def validate_pile(p, where="reinforcements[?]"):
    """Reglas propuestas (X22.md §6). Devuelve la lista de errores."""
    errs = []
    lp = p.get("lateral_pressure")
    if lp is None:
        if p.get("force") is None:
            errs.append(f"{where}: un pilote necesita `force` o `lateral_pressure`")
        return errs
    if p.get("force") is not None:
        errs.append(f"{where}: `force` y `lateral_pressure` son excluyentes")
    if lp.get("model") != "ito_matsui":
        errs.append(f"{where}.lateral_pressure.model debe ser \"ito_matsui\"")
    d = lp.get("diameter")
    if not (isinstance(d, (int, float)) and math.isfinite(d) and d > 0):
        errs.append(f"{where}.lateral_pressure.diameter debe ser > 0")
    if abs(p["x2"] - p["x1"]) > 1e-6:
        errs.append(f"{where}: Ito-Matsui exige pilote vertical (x2 = x1)")
    if not (p.get("spacing", 1.0) > (d or 0)):
        errs.append(f"{where}.spacing debe ser mayor que lateral_pressure.diameter")
    return errs


def analyze(model, step=pilemod.PROFILE_STEP, floor=True, divide_passive=True):
    m = copy.deepcopy(model)
    a = m["analysis"]
    terrain = geometry.Terrain(m)
    surface = geometry.Surface(a["surface"])
    assert surface.kind == "circle"
    s = direction_sign(m, surface, terrain)
    xc, yc, r = surface.xc, surface.yc, surface.r
    width = terrain.xmax - terrain.xmin
    piles = [p for p in m.get("reinforcements", []) if p.get("type") == "pile"]
    xa, xb = surface.ends(terrain)
    info = {"s": s, "ends": (xa, xb), "piles": []}
    crossings = []
    for p in piles:
        errs = validate_pile(p, p.get("id", "?"))
        if errs:
            raise ValueError("; ".join(errs))
        x = p["x1"] if abs(p["x1"] - p["x2"]) < 1e-9 else None
        if x is None:
            raise ValueError("el prototipo solo trata pilotes verticales")
        yb = surface.base_y(x)
        ground = terrain.top(x)
        rec = {"id": p["id"], "x": x, "y": yb, "application": p["application"], "status": "applied"}
        inside = xa + 1e-9 * width < x < xb - 1e-9 * width
        if not inside or not (min(p["y1"], p["y2"]) <= yb <= max(p["y1"], p["y2"])) or yb >= ground:
            rec["status"] = "outside_mass"
            info["piles"].append(rec)
            continue
        zf = ground - yb
        lp = p.get("lateral_pressure")
        spacing = p.get("spacing", 1.0)
        if lp:
            prof = pilemod.build_profile(m, terrain, p, step=step, floor=floor)
            per_pile, arm = pilemod.force_at(prof, zf)
            rec.update(zf=zf, z_top=prof["z_top"], f_soil=per_pile, arm=arm)
            governs = "soil"
            cap = p.get("capacity") or {}
            if cap.get("shear") is not None and cap["shear"] < per_pile:
                per_pile, governs = cap["shear"], "shear"
            lm = arm if arm > 0 else max(0.0, zf - prof["z_top"]) / 3.0
            if cap.get("moment") is not None and lm > 0 and cap["moment"] / lm < per_pile:
                per_pile, governs = cap["moment"] / lm, "bending"
            at_centroid = lp.get("location", "centroid") == "centroid" and arm > 0
            rec["governs"] = governs
        else:
            per_pile, arm, at_centroid, governs = p["force"], 0.0, False, "given"
            rec["governs"] = governs
        mag = per_pile / spacing
        ang = math.radians(p.get("angle", 0.0))
        mode = p.get("direction", "angle")
        if mode == "tangent":
            slope_b = (x - xc) / math.sqrt(max(r * r - (x - xc) ** 2, 1e-300))        # dy/dx de la base
            tx, ty = s / math.hypot(1.0, slope_b), s * slope_b / math.hypot(1.0, slope_b)
            ux, uy = -tx, -ty
        else:                                              # "angle" y "perpendicular" (pilote vertical: horizontal)
            ux, uy = -s * math.cos(ang), math.sin(ang)
        ya = yb + arm if at_centroid else yb
        rec.update(per_pile=per_pile, per_metre=mag, fx=mag * ux, fy=mag * uy, xapp=x, yapp=ya, arm_used=arm if at_centroid else 0.0)
        crossings.append((rec, p))
        info["piles"].append(rec)
    nodes = []
    for rec, _ in crossings:
        nodes += [rec["x"] - 1e-6 * width, rec["x"] + 1e-6 * width]
    res = engine.engine_results(m, extra_nodes=nodes)
    ref = res.get("bishop") or res["spencer"]
    slices = []
    for e in ref["slices"]:
        d = dict(e)
        d["V"], d["H"], d["Mb"], d["Dx"] = e["weight_extra"], e["h_force"], e["h_moment_base"], e["driving_extra"]
        d["pV"] = d["pH"] = d["pMb"] = d["pDx"] = 0.0
        d["V0"] = e["weight_extra"]
        slices.append(d)
    forces = []
    for rec, p in crossings:
        k = next(i for i, d in enumerate(slices) if d["x_left"] <= rec["x"] <= d["x_right"])
        d = slices[k]
        xm, ym = 0.5 * (d["x_left"] + d["x_right"]), 0.5 * (d["y_base_left"] + d["y_base_right"])
        px, py = rec["fx"], rec["fy"]
        pre = "p" if (p["application"] == "passive" and divide_passive) else ""
        d[pre + "V"] += -py
        d[pre + "H"] += s * px
        d[pre + "Mb"] += s * px * (rec["yapp"] - ym) + s * (-py) * (rec["xapp"] - xm)
        d[pre + "Dx"] += s * px * (yc - rec["yapp"]) / r
        forces.append({"px": px, "py": py, "x": rec["xapp"], "y": rec["yapp"], "passive": bool(pre)})
        rec["slice"] = k
    out = solvers.solve_all(slices, circular=True)
    info["equilibrium"] = equilibrium.check(slices, out, s, (xc, yc, r), forces)
    out["engine_fos"] = {k: v["fos"] for k, v in res.items()}
    info["n_slices"] = len(slices)
    info["circle"] = (xc, yc, r)
    info["forces"] = forces
    return out, info


if __name__ == "__main__":
    model = json.load(open(sys.argv[1]))
    out, info = analyze(model)
    print(json.dumps({"fos": out, "info": info}, indent=1, default=str))
