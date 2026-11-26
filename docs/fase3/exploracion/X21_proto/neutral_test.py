"""Criterio 1 (neutralidad): sin grieta ni agua libre, el prototipo reproduce el FS del motor con sus dovelas."""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import engine, solvers

def prep(engine_slices):
    out = []
    for s in engine_slices:
        d = dict(s)
        d["V"], d["H"], d["Mb"], d["Dx"] = s["weight_extra"], s["h_force"], s["h_moment_base"], s["driving_extra"]
        out.append(d)
    return out

if __name__ == "__main__":
    model = json.load(open(sys.argv[1]))
    res = engine.engine_results(model)
    for meth in engine.METHODS:
        r = res[meth]
        print(meth, r["fos"], r["status"], len(r["slices"]))
    sl = prep(res["bishop"]["slices"])
    print({k: v for k, v in solvers.solve_all(sl).items()})
