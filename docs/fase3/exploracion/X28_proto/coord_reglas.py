"""Coordinador (E16q): reglas de bajo confinamiento y esquemas de iteración sobre los cuatro círculos fijos de X28.

Ejecutar desde X28_proto con X28_OUT=$TMPDIR/f3b-x28 (salidas del oráculo de X28). Columnas: [F, pasadas, estado,
dovelas con σ′n ≤ sn(0), dovelas con σ′n ≤ σt].
"""
import sys, os, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import models, hb, hbsolve, proto_hb as P
from x28_run import setup_doc
M5 = hbsolve.METHODS
out = {}
for key in ["X25", "HAM1", "SA", "SB"]:
    doc = models.ogs_doc(key, circle=P.circle_of(key))
    sl, p, g = setup_doc(doc)
    s0 = hb.sn_zero(p); st = hb.sigma_t(p)
    row = {}
    for rule, tol, w in [("cslope", 1e-8, 0.5), ("cut", 1e-8, 0.5), ("cut", 1e-6, 1.0), ("cut", 1e-6, 0.5)]:
        res = hbsolve.solve_all(sl, g, p, rule=rule, tol=tol, max_pass=200, w=w)
        for m in M5:
            r = res[m]
            low = sum(1 for s in r["slices"] if "sn_last" in s and s["sn_last"] <= s0)
            tens = sum(1 for s in r["slices"] if "sn_last" in s and s["sn_last"] <= st)
            row.setdefault(m, {})[f"{rule}/{tol:g}/w{w:g}"] = [None if r["F"] is None else round(r["F"], 6), r["passes"], r["status"][:6], low, tens]
    out[key] = row
    print(key, f"sn0={s0:.3f} st={st:.3f}")
    for m in M5:
        print("  ", m.ljust(17), row[m])
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "X28_filas", "reglas_coordinador.json"), "w"), indent=1)
