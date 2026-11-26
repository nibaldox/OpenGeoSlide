"""D-1: barrido de la cohesión (c = 10·s) sobre una polilínea del generador, ogs vs cSlope (M-P constant y Janbu simplificado).
Uso (oráculo): env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python scale_sweep.py '[[x,y],...]'"""
import sys, json, os, copy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oracle  # fija sys.path al harness
import gen_cases as g
from to_cslope import ogs_to_cslope
def run(points, variant, c, phi):
    out = {}
    for meth in ("spencer", "janbu_simplified"):
        m = g.model(points, variant, (meth,)); mat = m["materials"][0]; mat["cohesion"] = c; mat["friction_angle"] = phi
        r = g.ogs_run(m)[0]; og = (r["fos"], r["status"], r.get("lambda"))
        mm = copy.deepcopy(m); mm["analysis"]["methods"] = ["morgenstern_price" if meth == "spencer" else meth]
        if meth == "spencer": mm["analysis"]["interslice"] = {"function": "constant"}
        conv = ogs_to_cslope(mm, {"method": mm["analysis"]["methods"][0], "kind": "fixed", "options": {}})
        cs = oracle.run_cslope(oracle.cs, conv.document)
        out[meth] = (og, (cs["fos"], cs["status"], (cs["error"] or "")[-40:]))
    return out
if __name__ == "__main__":
    pts = json.loads(sys.argv[1]); phi = float(sys.argv[2]) if len(sys.argv) > 2 else 30
    for s in (0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.5):
        o = run(pts, "mc", 10 * s, phi)
        sp, jb = o["spencer"], o["janbu_simplified"]
        f = lambda t: "%s" % (None if t[0] is None else round(t[0], 4))
        print(f"c={10*s:5.1f} | ogs spencer {f(sp[0])} lam={sp[0][2] if sp[0][2] is None else round(sp[0][2],4)} {sp[0][1]:13s} | cslope MP {f(sp[1])} {sp[1][1]} {sp[1][2]} | janbu ogs {f(jb[0])} cs {f(jb[1])}")
