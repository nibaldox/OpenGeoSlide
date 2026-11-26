"""cSlope sobre todas las filas de ../X22_filas -> $TMPDIR/x22/results_oracle.json
  env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python run_oracle.py"""
import glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oracle
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.environ["TMPDIR"], "x22"); os.makedirs(OUT, exist_ok=True)
res = {}
for path in sorted(glob.glob(os.path.join(HERE, "..", "X22_filas", "X22-*.json"))):
    rid = os.path.basename(path)[:-5]
    res[rid] = oracle.run_all(json.load(open(path)))
    print(rid, {k: (round(v["fos"], 5) if v.get("fos") else v) for k, v in res[rid].items()}, flush=True)
json.dump(res, open(os.path.join(OUT, "results_oracle.json"), "w"), indent=1, default=str)
