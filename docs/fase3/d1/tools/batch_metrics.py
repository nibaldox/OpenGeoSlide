"""D-1: métricas de admisibilidad de cada polilínea del barrido (Spencer convergido). Uso: batch_metrics.py VARIANTE OUT.json SEMILLA..."""
import sys, os, json, math, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_cases as g, diag
def one(args):
    pts, variant = args
    m = g.model(pts, variant, ("spencer", "janbu_simplified")); r = g.ogs_run(m)
    if r is None: return None
    sp, jb = r[0], r[1]
    row = {"points": pts, "sp": [sp["fos"], sp["status"], sp.get("lambda"), sp["warnings"]], "jb": [jb["fos"], jb["status"]]}
    if sp["status"] == "converged":
        row["m"] = diag.metrics(sp["slices"], sp["fos"], sp["lambda"], phi_c=(10, math.tan(math.radians(30))) if variant == "mc" else None)
    return row
if __name__ == "__main__":
    variant, out = sys.argv[1], sys.argv[2]; seeds = [int(x) for x in sys.argv[3:]]
    jobs = []
    for s in seeds:
        for r in json.load(open(os.path.join(os.environ["TMPDIR"], f"d1_{variant}_{s}.json"))):
            if r["ogs"] and r["ogs"]["spencer"][1] == "converged": jobs.append((r["points"], variant))
    with cf.ThreadPoolExecutor(8) as ex: rows = [x for x in ex.map(one, jobs) if x]
    json.dump(rows, open(out, "w")); print(len(rows), "->", out)
