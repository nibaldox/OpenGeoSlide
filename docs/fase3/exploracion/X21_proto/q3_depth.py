"""Pregunta 3: qué profundidad usa el oráculo con tensionCrackAuto. Se compara cSlope(auto) con cSlope(profundidad fija = Rankine
del prototipo en el x de la grieta): si coinciden a 1e-9, esa es la profundidad. Necesita cslope:
  env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python q3_depth.py"""
import copy, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oracle, proto, rows_def

res = {}
for rid in ("X21-A01", "X21-A02", "X21-A03", "X21-A04", "X21-A05", "X21-A06"):
    m = rows_def.ROWS[rid]
    out, info = proto.analyze(m, equilibrium_check=False)
    z, xc = info["crack_depth"], info["crack_x"]
    fixed = copy.deepcopy(m)
    fixed["analysis"]["tension_crack"]["depth"] = z
    a = oracle.run(m, "bishop")["fos"]
    b = oracle.run(fixed, "bishop")["fos"]
    res[rid] = {"z_rankine_proto": z, "x_grieta": xc, "fos_auto": a, "fos_fija_z": b, "dif_rel": (a - b) / b}
    print(rid, json.dumps(res[rid]))
# sensibilidad: ±1 % de z cambia el FS en una cantidad medible (el barrido demuestra que 1e-9 es una igualdad real)
m = copy.deepcopy(rows_def.ROWS["X21-A01"])
z = res["X21-A01"]["z_rankine_proto"]
for k in (0.99, 1.01):
    f = copy.deepcopy(m)
    f["analysis"]["tension_crack"]["depth"] = z * k
    print("A01 con z·%.2f" % k, oracle.run(f, "bishop")["fos"])
# límite de la altura: c = 100 -> z = 14,15 m > 10 m de talud; ¿topa a la altura o descarta?
for c in (60.0, 100.0):
    mm = rows_def.auto_row({"cohesion": c})
    r = oracle.run(mm, "bishop")
    print("c =", c, "z =", 2 * c / (20 * 0.7066), "->", r.get("error", r["fos"]))
# φ = 0 con Mohr-Coulomb: c = 25, φ = 0 igual que undrained Su = 25 (A03)
m0 = rows_def.auto_row({"cohesion": 25.0, "friction_angle": 0.0})
print("Mohr-Coulomb φ=0 c=25:", oracle.run(m0, "bishop")["fos"], " undrained Su=25:", oracle.run(rows_def.ROWS["X21-A03"], "bishop")["fos"])
json.dump(res, open(os.path.join(os.environ.get("TMPDIR", "/tmp"), "f3g-x21", "q3_depth.json"), "w"), indent=1)
