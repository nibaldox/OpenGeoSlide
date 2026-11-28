import json, copy, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine, proto
from pathlib import Path
ROOT = Path(__file__).resolve().parents[4]
BASE=json.load(open(ROOT / "verification/cases/V013a.json"))["model"]
def row(circle, piles):
    m=copy.deepcopy(BASE); m["version"]="0.4"; m["analysis"].pop("search")
    m["analysis"]["surface"]={"type":"circle","xc":circle[0],"yc":circle[1],"r":circle[2]}
    m["slope"]={"direction":"right_to_left"}
    m["reinforcements"]=piles; return m
C=(7.4728,26.3127,26.4309)
for label,piles in (("sin pilote",[]),
    ("force 282.77 pasivo",[{"type":"pile","id":"P","x1":17.5,"y1":5,"x2":17.5,"y2":-10,"force":282.77,"spacing":2.4,"direction":"angle","angle":0,"application":"passive"}]),
    ("force 282.77 activo",[{"type":"pile","id":"P","x1":17.5,"y1":5,"x2":17.5,"y2":-10,"force":282.77,"spacing":2.4,"direction":"angle","angle":0,"application":"active"}]),
    ("force 282.77 tangente pasivo",[{"type":"pile","id":"P","x1":17.5,"y1":5,"x2":17.5,"y2":-10,"force":282.77,"spacing":2.4,"direction":"tangent","application":"passive"}])):
    m=row(C,piles)
    out,info=proto.analyze(m)
    ref=engine.engine_results(m,keep_forces=True)
    print(label)
    for k in ("bishop","spencer","morgenstern_price","janbu_simplified","janbu_corrected"):
        print("  %-18s proto %.12f  motor %.12f  diff %.2e"%(k,out[k],ref[k]["fos"],out[k]-ref[k]["fos"]))
    print("  equilibrio",{k:float("%.2e"%v) for k,v in info["equilibrium"].items() if not isinstance(v,dict)}, "lambda",out["lambda"], ref["spencer"].get("lambda"))
