"""Pregunta 4: grieta en la búsqueda. Mide con cSlope (a) cuántos candidatos descarta y si el descartado no alcanza la grieta,
(b) el FS y el círculo crítico del oráculo, y escribe las filas fijas con ese círculo (X21-S-*). Necesita shapely/cslope:
  env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python q4_search.py"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, "/home/xodla/archivos/opengeoslide/verification/harness")
import cslope as cs
import from_cslope as fc
import geometry

OUT = os.environ.get("X21_OUT", os.path.join(os.environ.get("TMPDIR", "/tmp"), "f3g-x21"))


def run(df, opt):
    return cs.analyse({"format": "cslope-analysis", "formatVersion": 1, "definition": df, "options": opt})


def max_depth(terrain, c):
    """Profundidad máxima de la superficie bajo el terreno (círculo inferior entre sus cruces)."""
    xc, yc, r = c["cx"], c["cy"], c["radius"]
    x0, x1 = sorted((c["entryPoint"][0], c["exitPoint"][0]))
    best = 0.0
    for i in range(2001):
        x = x0 + (x1 - x0) * i / 2000
        yb = yc - math.sqrt(max(r * r - (x - xc) ** 2, 0.0))
        best = max(best, terrain.top(x) - yb)
    return best


res = {}
for cid, ck, depth in (("V096a", 0, 1.015), ("V086b", 0, 2.0), ("V048", 0, 4.0), ("V086b", 1, None)):
    case = fc.load_case(cid)
    opt = dict(case["checks"][ck]["options"])
    df = case["definition"]
    model = fc.convert(case, check=ck)
    terrain = geometry.Terrain(model)
    r1 = run(df, opt)
    r0 = run(df, {k: v for k, v in opt.items() if "rack" not in k})
    key = lambda c: (round(c["cx"], 6), round(c["cy"], 6), round(c["radius"], 6))
    s1 = {key(c): c for c in r1["allSurfaces"]}
    s0 = {key(c): c for c in r0["allSurfaces"]}
    dropped = [s0[k] for k in s0 if k not in s1]
    kept_shallow = [c for k, c in s1.items() if depth and max_depth(terrain, c) < depth - 1e-6]
    if depth is None:
        depth = 2 * 20.0 / 19.4          # V086b auto: Rankine con φ = 0, c = Su = 20, γ = 19,4
    shallow0 = [c for c in s0.values() if max_depth(terrain, c) < depth - 1e-6]
    dropped_deep = [c for c in dropped if depth and max_depth(terrain, c) >= depth - 1e-6]
    crit = r1["criticalSurface"]
    info = {"case": f"{cid}/{ck}", "n_sin_grieta": len(s0), "n_con_grieta": len(s1), "n_descartados": len(dropped),
            "analizados_con_profundidad_<_grieta": len(kept_shallow), "candidatos_sin_grieta_con_profundidad_<_grieta": len(shallow0),
            "fos_sin_grieta": r0["minFOS"], "fos_con_grieta": r1["minFOS"],
            "critico_con_grieta": [crit["cx"], crit["cy"], crit["radius"]],
            "critico_sin_grieta": [r0["criticalSurface"][k] for k in ("cx", "cy", "radius")]}
    print(json.dumps(info))
    res[f"{cid}/{ck}"] = info
    # fila fija con el círculo crítico del oráculo
    model["analysis"]["surface"] = {"type": "circle", "xc": crit["cx"], "yc": crit["cy"], "r": crit["radius"]}
    # el círculo crítico de cSlope es tangente al fondo del modelo (límite de la búsqueda): se baja el fondo 2 m para que
    # el arco quede dentro; no cambia ninguna dovela (el arco no toca esa franja)
    ymin = min(y for reg in model["regions"] for _, y in reg["polygon"])
    for reg in model["regions"]:
        reg["polygon"] = [[x, y - 2.0 if y == ymin else y] for x, y in reg["polygon"]]
    rid = f"X21-S-{cid}-{'auto' if ck == 1 and cid == 'V086b' else 'fija'}"
    model["meta"]["id"] = rid
    json.dump(model, open(f"{OUT}/rows/{rid}.json", "w"), indent=1)
json.dump(res, open(f"{OUT}/q4_search.json", "w"), indent=1)
