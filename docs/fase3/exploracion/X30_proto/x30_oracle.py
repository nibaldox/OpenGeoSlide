"""X30: modelos de prueba, oráculo cSlope con SHANSEP y comparación con el prototipo (solo biblioteca estándar + oráculo).

Uso: env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python x30_oracle.py  (necesita cslope)
"""
from __future__ import annotations

import copy
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import x30  # noqa: E402
import oracle  # noqa: E402  (añade verification/harness al path)
import cslope as cs  # noqa: E402
from from_cslope import convert, load_case, GOLDEN  # noqa: E402

REPO = x30.REPO
METHOD_LIST = x30.METHODS
V047A_CIRCLE = {"type": "circle", "xc": 29.511, "yc": 53.738, "r": 28.742}   # círculo crítico MC (X26 §4.1)


def base_analysis(surface):
    return {"methods": list(METHOD_LIST), "slices": 50, "tolerance": 1e-5, "max_iterations": 500,
            "min_m_alpha": 0.2, "surface": surface}


def v047a(ocr_spec, wet=False, kh=0.0, kv=0.0, surface=V047A_CIRCLE, ratio=0.25, exponent=0.8):
    """V047a (ACADS 1(a)) con SHANSEP. Geometría y regiones de verification/cases/V047a.json (v0.3)."""
    base = json.load(open(os.path.join(REPO, "verification/cases/V047a.json")))["model"]
    sh = {"ratio": ratio, "exponent": exponent}
    sh.update(ocr_spec)
    m = {"format": "opengeoslide", "version": "0.6", "units": "SI",
         "materials": [{"id": "soil", "name": "Soil", "model": "shansep", "unit_weight": 20.0,
                        "unit_weight_sat": 20.0, "shansep": sh}],
         "regions": copy.deepcopy(base["regions"]), "slope": copy.deepcopy(base["slope"]),
         "analysis": base_analysis(surface)}
    if wet:
        m["water"] = {"piezometric_line": [[0.0, 30.0], [100.0, 30.0]]}
    if kh or kv:
        m["analysis"]["seismic"] = {"kh": kh, "kv": kv}
    return m


def v105a():
    """V105a (dique sobre turba, SHANSEP con POP y aboveWater): desde el golden de cSlope (sin copiar su motor)."""
    case = load_case("V105a")
    df = case["definition"]
    mats = []
    for m in df["materials"]:
        mm = m["model"]
        mat = {"id": x30_slug(m["name"]), "name": m["name"], "unit_weight": mm["unitWeight"]}
        if mm["kind"] == "shansep":
            mat["model"] = "shansep"
            if mm.get("unitWeightSat") is not None:
                mat["unit_weight_sat"] = mm["unitWeightSat"]
            sh = {"ratio": mm["ratio"], "exponent": mm.get("exponent", 0.8)}
            if mm.get("pop") is not None:
                sh["pop"] = mm["pop"]
            mat["shansep"] = sh
            if mm.get("aboveWater"):
                aw = mm["aboveWater"]
                mat["above_water"] = {"cohesion": aw["cohesion"], "friction_angle": aw["frictionAngle"],
                                      "unit_weight": aw["unitWeight"]}
        else:
            mat["model"] = "mohr_coulomb"
            mat["cohesion"] = mm["cohesion"]
            mat["friction_angle"] = mm["frictionAngle"]
            if mm.get("unitWeightSat") is not None:
                mat["unit_weight_sat"] = mm["unitWeightSat"]
        mats.append(mat)
    # convertir la geometría con el adaptador del corpus (X21): materiales de reemplazo, luego restaurar
    tmp = copy.deepcopy(case)
    for m in tmp["definition"]["materials"]:
        if m["model"]["kind"] == "shansep":
            m["model"] = {"kind": "undrained", "unitWeight": m["model"]["unitWeight"],
                          "undrainedShearStrength": x30.PLACE_SU,
                          **({"unitWeightSat": m["model"]["unitWeightSat"]} if m["model"].get("unitWeightSat") else {})}
    model = convert(tmp, check=0, slices=50)
    model["regions"] = split_regions_without_holes(model["regions"])
    model["version"] = "0.6"
    model["materials"] = mats
    model["analysis"]["surface"]["type"] = "circle"
    model["analysis"].pop("tension_crack", None)
    return model, df, case


def x30_slug(name):
    import re
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def split_regions_without_holes(regions):
    """El motor no admite agujeros ni regiones que se solapen. La cara de cSlope `clay_shallow` tiene una isla
    (`sand_with_clay`) dentro: se corta por la vertical que pasa por el centroide de la isla; las dos piezas
    son la misma región de material (el agujero queda como muesca)."""
    from shapely.geometry import LineString, Polygon
    from shapely.ops import split
    polys = [Polygon(r["polygon"]) for r in regions]
    out = []
    for i, r in enumerate(regions):
        p = polys[i]
        holes = [q for j, q in enumerate(polys) if j != i and p.buffer(-1e-9).contains(q.representative_point()) and q.area < p.area]
        if not holes:
            out.append(r)
            continue
        cur = p
        for q in holes:
            cur = cur.difference(q)
        if cur.geom_type != "Polygon":
            raise RuntimeError("diferencia no simple")
        if list(cur.interiors):
            c = max(q.centroid.x for q in holes)
            minx, miny, maxx, maxy = cur.bounds
            cut = LineString([(c, miny - 1.0), (c, maxy + 1.0)])
            for piece in split(cur, cut).geoms:
                out.append({"material": r["material"], "polygon": [list(c_) for c_ in piece.exterior.coords][:-1]})
        else:
            out.append({"material": r["material"], "polygon": [list(c_) for c_ in cur.exterior.coords][:-1]})
    return out


# ----------------------------------------------------------------------------- oráculo con SHANSEP

def oracle_doc(model_v06, method):
    m4, specs = x30.strip_shansep(model_v06)
    doc = oracle.build_doc(m4, method)
    # oracle.build_doc pone freeWater=False sin free_water (X21). En v0.6 el agua embalsada es automática (todas las
    # versiones, F5.3; to_cslope.water_table_from_piezo): freeWater=True, followBoundary=False.
    wt = doc["definition"].get("waterTable")
    if wt:
        wt["freeWater"] = True
        wt["followBoundary"] = False
    defs = doc["definition"]["materials"]
    for i, mat in enumerate(model_v06["materials"]):
        if i not in specs:
            continue
        sp = specs[i]
        mm = {"kind": "shansep", "unitWeight": float(mat["unit_weight"]), "ratio": float(sp["ratio"]),
              "exponent": float(sp.get("exponent", 0.8))}
        if mat.get("unit_weight_sat") is not None:
            mm["unitWeightSat"] = float(mat["unit_weight_sat"])
        if sp.get("pop") is not None:
            mm["pop"] = float(sp["pop"])
        elif sp.get("ocr_by_elevation"):
            mm["ocrByElevation"] = sp["ocr_by_elevation"]
        else:
            mm["ocr"] = float(sp["ocr"])
        if mat.get("ru") is not None:
            mm["ru"] = float(mat["ru"])
        if sp.get("above_water"):
            aw = sp["above_water"]
            mm["aboveWater"] = {"kind": "mohr-coulomb", "unitWeight": aw["unit_weight"], "cohesion": aw["cohesion"],
                                "frictionAngle": aw["friction_angle"]}
        defs[i]["model"] = mm
    return doc


def oracle_run(model_v06, method):
    doc = oracle_doc(model_v06, method)
    r = cs.analyse(doc)
    return {"fos": r.get("minFOS"), "slices": r.get("criticalSlices"), "warnings": [w.get("code") for w in r.get("warnings") or []],
            "surface": r.get("criticalSurface")}


def oracle_v105a(method="Bishop"):
    """El golden de V105a tal cual (cSlope lee el SHANSEP nativo)."""
    case = load_case("V105a")
    opts = {"method": method, "slices": 50, "iterations": 1000, "refinedIterations": 1000, "tolerance": 0.001}
    if method == "Morgenstern-Price":
        opts["intersliceFunction"] = "constant"
    if method == "Janbu":
        opts["janbuCorrection"] = True
    doc = {"format": "cslope-analysis", "formatVersion": 1, "definition": case["definition"], "options": opts}
    r = cs.analyse(doc)
    return {"fos": r.get("minFOS"), "slices": r.get("criticalSlices"),
            "warnings": [w.get("code") for w in r.get("warnings") or []]}


if __name__ == "__main__":
    print("módulo x30_oracle listo")
