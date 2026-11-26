"""D-1: efecto del criterio r_v sobre los 93 casos, la batería diferencial, pending y acads1a. Uso (desde la raíz del worktree):
env -u PYTHONPATH -u PYTHONHOME OGS=target/release/ogs $TMPDIR/oracle-venv/bin/python docs/fase3/d1/tools/run_sets.py OUT.json"""
import sys, os, json, glob, copy, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import admiss
def models():
    out = []
    for p in sorted(glob.glob("verification/cases/V*.json")) + sorted(glob.glob("verification/pending/F3/V*.json")) + sorted(glob.glob("verification/pending/lote0/V*.json")):
        d = json.load(open(p)); m = d["model"]; kinds = sorted({(c["kind"], c.get("options", {}).get("slices")) for c in d["checks"]})
        for kind, sl in kinds: out.append((os.path.basename(p)[:-5], kind, sl, m))
    for p in sorted(glob.glob("verification/differential/cases/*.json")) + ["examples/acads1a.ogs.json"] + sorted(glob.glob("verification/differential/cases_f3/*.json")):
        m = json.load(open(p)); m = m.get("model", m); a = m["analysis"]
        out.append((os.path.basename(p).split(".")[0], "fixed" if a.get("surface") and not a.get("search") else "search", None, m))
    return out
def one(item):
    name, kind, sl, m0 = item; m = copy.deepcopy(m0); m["version"] = "0.3"; a = m["analysis"]
    a["methods"] = ["spencer", "morgenstern_price"]
    if kind == "fixed": a.pop("search", None)
    if sl: a["slices"] = sl
    try: res = admiss.ogs_run(m)
    except Exception as e: return [{"model": name, "kind": kind, "err": str(e)[:80]}]
    rows = []; geo = admiss.Geo(m)
    for r in res:
        row = {"model": name, "kind": kind, "method": r["method"], "status": r["status"], "F": r["fos"]}
        if r["status"] == "converged":
            try: row.update(admiss.evaluate(m, r["method"], r, geo))
            except Exception as e: row["err"] = repr(e)[:100]
        rows.append(row)
    return rows
if __name__ == "__main__":
    items = models()
    with cf.ThreadPoolExecutor(6) as ex: rows = [r for rr in ex.map(one, items) for r in rr]
    json.dump(rows, open(sys.argv[1], "w")); print(len(items), "modelos/kinds,", len(rows), "filas")
