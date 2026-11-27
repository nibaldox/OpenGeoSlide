"""Adaptador cSlope (formato del corpus golden) -> documento ogs v0.4/0.5 para las filas X21 (necesita shapely).

Solo lo que usan las filas: contorno con materialBoundaries y regionAssignments, materiales mohr-coulomb y undrained,
línea de agua `custom`, superficie fija (círculo o polilínea) y las opciones de grieta de un check."""
from __future__ import annotations
import json, re, sys
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import polygonize, unary_union

GOLDEN = "/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/cslope-src/packages/engine-rs/golden/verification.json"


def slug(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def load_case(cid):
    d = json.load(open(GOLDEN))
    return next(c for c in d["cases"] if c["id"] == cid)


def convert(case, check=0, gw=9.807, free_water=None, slices=50):
    df = case["definition"]
    outline = Polygon(df["coordinates"])
    lines = [outline.exterior] + [LineString(b["coordinates"]) for b in df.get("materialBoundaries", [])]
    polys = list(polygonize(unary_union(lines)))
    mats = []
    for m in df["materials"]:
        mm = m["model"]
        o = {"id": slug(m["name"]), "name": m["name"], "unit_weight": mm["unitWeight"], "unit_weight_sat": mm.get("unitWeightSat"), "ru": None}
        if mm["kind"] == "undrained":
            o.update(model="undrained", undrained_strength=mm["undrainedShearStrength"])
            if mm.get("suRateOfChange"):
                o.update(strength_datum=mm.get("suRefDepth", 0.0), strength_gradient=mm["suRateOfChange"])
        else:
            o.update(model="mohr_coulomb", cohesion=mm["cohesion"], friction_angle=mm["frictionAngle"])
        mats.append(o)
    regions = []
    for p in polys:
        if not outline.contains(p.representative_point()):
            continue
        for ra in df["regionAssignments"]:
            if p.buffer(1e-6).contains(Point(ra["point"])):
                pts = [list(c) for c in p.exterior.coords][:-1]
                regions.append({"material": slug(ra["materialName"]), "polygon": pts})
                break
    model = {"format": "opengeoslide", "version": "0.5", "meta": {"id": case["id"], "title": case["title"]}, "units": "SI",
             "materials": mats, "regions": regions}
    wt = df.get("waterTable")
    if wt:
        model["water"] = {"unit_weight": gw, "piezometric_line": wt["value"]}
        fw = (wt.get("followBoundary") is False) if free_water is None else free_water
        if fw:
            model["water"]["free_water"] = True
    model["slope"] = {"direction": {"rtl": "right_to_left", "ltr": "left_to_right"}.get(df.get("orientation"), "auto")}
    chk = case["checks"][check]
    opt = chk["options"]
    an = {"methods": ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"], "slices": slices,
          "tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2}
    if df.get("customSearchPlanes"):
        c = df["customSearchPlanes"][0]
        an["surface"] = {"type": "circle", "xc": c["cx"], "yc": c["cy"], "r": c["radius"]}
    elif df.get("customSurfaces"):
        an["surface"] = {"type": "polyline", "points": df["customSurfaces"][0]["points"]}
    if opt.get("tensionCrackAuto") or opt.get("tensionCrackDepth"):
        an["tension_crack"] = {"depth": "auto" if opt.get("tensionCrackAuto") else opt["tensionCrackDepth"],
                               "water": opt.get("tensionCrackWater", 0.0)}
    model["analysis"] = an
    return model


if __name__ == "__main__":
    c = load_case(sys.argv[1])
    print(json.dumps(convert(c), indent=1)[:3000])
