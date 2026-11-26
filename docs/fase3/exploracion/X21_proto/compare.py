"""Tabla de diferencias prototipo - oráculo (en %) por fila y método."""
import json, os, sys
OUT = os.environ.get("X21_OUT", os.path.join(os.environ.get("TMPDIR", "/tmp"), "f3g-x21"))
P = json.load(open(f"{OUT}/results_proto.json"))
O = json.load(open(f"{OUT}/results_oracle.json"))
M = ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]
ids = sys.argv[1:] or sorted(P)
for rid in ids:
    if rid not in P or rid not in O:
        continue
    pr = P[rid]["proto"]
    line = []
    for m in M:
        if m not in O[rid]:
            continue
        o = O[rid][m]["fos"]
        p = None if pr is None else pr.get(m)
        if o is None or p is None:
            line.append(f"{m[:4]}: or={o} pr={p} {O[rid][m].get('error') or ''}"[:70])
        else:
            line.append(f"{m[:4]} {o:.6f} ({(p-o)/o*100:+.3f}%)")
    print(rid, " | ".join(line))
