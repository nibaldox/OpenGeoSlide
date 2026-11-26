"""Corre cSlope sobre las filas guardadas en $X21_OUT/rows y guarda results_oracle.json (usar el python del venv del oráculo)."""
import json, os, sys, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oracle

METHODS_ALL = ('bishop', 'spencer', 'morgenstern_price', 'janbu_simplified', 'janbu_corrected')
METHODS_POLY = METHODS_ALL[1:]
OUT = os.environ.get("X21_OUT", os.path.join(os.environ.get("TMPDIR", "/tmp"), "f3g-x21"))
ids = sys.argv[1:] or sorted(os.path.basename(p)[:-5] for p in glob.glob(f"{OUT}/rows/*.json"))
p = f"{OUT}/results_oracle.json"
prev = json.load(open(p)) if os.path.exists(p) else {}
for rid in ids:
    m = json.load(open(f"{OUT}/rows/{rid}.json"))
    r = oracle.run_all(m, methods=METHODS_POLY if m['analysis']['surface']['type'] == 'polyline' else METHODS_ALL)
    prev[rid] = {k: {"fos": v["fos"], "error": v.get("error"), "warnings": v.get("warnings")} for k, v in r.items()}
    print(rid, {k: (round(v["fos"], 6) if v["fos"] is not None else v.get("error")) for k, v in r.items()})
json.dump(prev, open(p, "w"), indent=1)
