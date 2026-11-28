"""Círculos críticos del oráculo (búsqueda Bishop de cSlope, V013b-e, con location centroid y slip-surface) -> circles.json.
  env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python circles.py"""
import json, os, sys, copy
from pathlib import Path
ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "verification/harness"))
import cslope as cs
G = json.load(open(os.path.join(os.environ["TMPDIR"], "cslope-src/packages/engine-rs/golden/verification.json")))
out = {}
for cid in ("V013a", "V013b", "V013c", "V013d", "V013e"):
    case = next(c for c in G["cases"] if c["id"] == cid)
    for loc in (None, "slip-surface"):
        df = copy.deepcopy(case["definition"])
        if loc:
            for p in df.get("piles", []):
                p["location"] = loc
        r = cs.analyse({"format": "cslope-analysis", "formatVersion": 1, "definition": df, "options": case["checks"][0]["options"]})
        c = r["criticalSurface"]
        out[f"{cid}/{loc or 'centroid'}"] = {"fos": r["minFOS"], "xc": c["cx"], "yc": c["cy"], "r": c["radius"],
                                          "entry": list(c["entryPoint"]), "exit": list(c["exitPoint"]),
                                          "forces": [{k: f[k] for k in ("x", "y", "fx", "force")} for f in c["reinforcementForces"]]}
        print(cid, loc, round(r["minFOS"], 6), flush=True)
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "circles.json"), "w"), indent=1)
