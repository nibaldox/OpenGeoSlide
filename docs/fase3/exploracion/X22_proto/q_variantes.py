"""Pregunta 3: búsqueda Bishop del oráculo en V013b-e con cada variante de la fuerza (application × direction × location),
contra lo publicado (Program A: 1,54 / 1,43 / 1,33 / 1,25; Cai y Ugai: 1,54 / 1,37 / 1,31 / 1,25).
  env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python q_variantes.py"""
import copy, itertools, json, os, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "verification/harness"))
import cslope as cs
G = json.load(open(os.path.join(os.environ["TMPDIR"], "cslope-src/packages/engine-rs/golden/verification.json")))
PUB = {"V013b": (1.54, 1.54), "V013c": (1.43, 1.37), "V013d": (1.33, 1.31), "V013e": (1.25, 1.25)}
res = {}
for cid in PUB:
    case = next(c for c in G["cases"] if c["id"] == cid)
    for app, dr, loc in itertools.product(("passive", "active"), ("angle", "tangent"), ("centroid", "slip-surface")):
        df = copy.deepcopy(case["definition"])
        p = df["piles"][0]
        p.update(application=app, direction=dr, location=loc)
        if dr == "angle":
            p["angle"] = 0.0
        r = cs.analyse({"format": "cslope-analysis", "formatVersion": 1, "definition": df, "options": case["checks"][0]["options"]})
        c = r["criticalSurface"]
        key = f"{cid}/{app}/{dr}/{loc}"
        res[key] = {"fos": round(r["minFOS"], 6), "circulo": [round(c[k], 4) for k in ("cx", "cy", "radius")],
                    "fuerza_por_metro": [round(f["force"], 4) for f in c["reinforcementForces"]]}
        print(key, res[key], flush=True)
json.dump({"publicado": PUB, "variantes": res}, open(os.path.join(os.environ["TMPDIR"], "x22", "q_variantes.json"), "w"), indent=1)
