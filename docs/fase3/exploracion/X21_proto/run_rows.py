"""Corre el prototipo sobre todas las filas de rows_def.py (o las pedidas) y guarda results_proto.json."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import proto, rows_def

OUT = os.environ.get("X21_OUT", os.path.join(os.environ.get("TMPDIR", "/tmp"), "f3g-x21"))
os.makedirs(f"{OUT}/rows", exist_ok=True)
ids = sys.argv[1:] or list(rows_def.ROWS)
res = {}
for rid in ids:
    if rid in rows_def.ROWS:
        m = rows_def.ROWS[rid]
        json.dump(m, open(f"{OUT}/rows/{rid}.json", "w"), indent=1)
    else:
        m = json.load(open(f"{OUT}/rows/{rid}.json"))
    try:
        out, info = proto.analyze(m)
    except Exception as exc:                      # noqa: BLE001
        out, info = None, {"status": "ERROR " + repr(exc)[:200]}
    res[rid] = {"proto": out, "info": {k: v for k, v in info.items() if k != "slices"}}
    print(rid, info.get("status") if out is None else {k: round(v, 6) for k, v in out.items() if isinstance(v, float)})
prev = {}
p = f"{OUT}/results_proto.json"
if os.path.exists(p):
    prev = json.load(open(p))
prev.update(res)
json.dump(prev, open(p, "w"), indent=1)
