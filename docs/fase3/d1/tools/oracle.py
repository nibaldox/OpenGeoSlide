"""cSlope 0.1.0 sobre una polilínea fija del generador de D-1. Uso: oracle.py '[[x,y],...]' [variante]
Requiere: $TMPDIR/oracle-venv/bin/python, ejecutado con `env -u PYTHONPATH -u PYTHONHOME`. Desde la raíz del worktree."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "verification", "harness")); sys.path.insert(0, HERE)
import cslope as cs
from to_cslope import ogs_to_cslope
from run import run_cslope
import gen_cases as g

def cslope_polyline(points, method, variant="two"):
    m = g.model(points, variant, (method,))
    if method != "morgenstern_price": m["analysis"].pop("interslice", None)
    conv = ogs_to_cslope(m, {"method": method, "kind": "fixed", "options": {}})
    return run_cslope(cs, conv.document), conv

if __name__ == "__main__":
    pts = json.loads(sys.argv[1]); variant = sys.argv[2] if len(sys.argv) > 2 else "two"
    for meth in ("morgenstern_price", "janbu"):
        mm = "janbu_simplified" if meth == "janbu" else meth
        r, conv = cslope_polyline(pts, mm, variant)
        print(meth, json.dumps(r)[:1500])
