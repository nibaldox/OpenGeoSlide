"""D-1: r_v del barrido aleatorio (Spencer y M-P constant) sobre las semillas dadas. Uso: rv_random.py VARIANTE OUT.json SEMILLA..."""
import sys, os, json, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import admiss, gen_cases as g


def one(pts_variant):
    pts, variant = pts_variant
    m = g.model(pts, variant, ("spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"))
    res = admiss.ogs_run(m)
    row = {"points": pts, "jb": [res[2]["fos"], res[2]["status"]], "jc": res[3]["fos"]}
    geo = admiss.Geo(m)
    for r in res[:2]:
        ev = admiss.evaluate(m, r["method"], r, geo) if r["status"] == "converged" else None
        row[r["method"]] = [r["fos"], r["status"], None if ev is None else ev["rv_max"], None if ev is None else ev["rv1_max"]]
    return row


if __name__ == "__main__":
    variant, out = sys.argv[1], sys.argv[2]
    jobs = []
    for s in sys.argv[3:]:
        for r in json.load(open(os.path.join(os.environ["TMPDIR"], f"d1_{variant}_{s}.json"))):
            if r["ogs"] and r["ogs"]["spencer"][1] == "converged":
                jobs.append((r["points"], variant))
    with cf.ProcessPoolExecutor(8) as ex:
        rows = list(ex.map(one, jobs, chunksize=8))
    json.dump(rows, open(out, "w"))
    print(len(rows), "->", out)
