"""Corre el prototipo sobre todas las filas de ../X22_filas -> $TMPDIR/x22/results_proto.json   (python3 run_proto.py [paso])"""
import glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import proto
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.environ["TMPDIR"], "x22"); os.makedirs(OUT, exist_ok=True)
step = float(sys.argv[1]) if len(sys.argv) > 1 else 0.05
res = {}
for path in sorted(glob.glob(os.path.join(HERE, "..", "X22_filas", "X22-*.json"))):
    rid = os.path.basename(path)[:-5]
    out, info = proto.analyze(json.load(open(path)), step=step)
    res[rid] = {"fos": {k: out[k] for k in ("bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected")},
                "engine_nopile": out["engine_fos"], "piles": info["piles"], "equilibrium": info["equilibrium"], "lambda": out["lambda"]}
    m = json.load(open(path))
    if any(p.get("force") is not None for p in m.get("reinforcements", [])):
        import engine
        res[rid]["engine_with_force"] = {k: v["fos"] for k, v in engine.engine_results(m, keep_forces=True).items()}
    print(rid, {k: round(v, 5) for k, v in res[rid]["fos"].items() if v}, [(p["status"], round(p.get("per_metre", 0), 4)) for p in info["piles"]], flush=True)
json.dump(res, open(os.path.join(OUT, f"results_proto_{step}.json"), "w"), indent=1, default=str)
