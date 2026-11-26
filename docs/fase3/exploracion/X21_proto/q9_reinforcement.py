"""Pregunta 9: el agua libre de `interface` (E14o-4) con el agua embalsada nueva. Mide la fuerza de arrancamiento de un geosintético
bajo el embalse en el motor (sin tocarlo) y en cSlope con freeWater verdadero y falso. Necesita cslope:
  env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python q9_reinforcement.py"""
import copy, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine, oracle, rows_def
import cslope as cs

m = copy.deepcopy(rows_def.ROWS["X21-D02"])
m["version"] = "0.4"
m["reinforcements"] = [{"type": "geosynthetic", "id": "G1", "x1": -3, "y1": -0.5, "x2": -3, "y2": -9, "application": "passive",
                        "tensile_capacity": 400, "direction": "axial",
                        "pullout": {"model": "interface", "adhesion": 0, "friction_angle": 30, "coverage": 1}}]
res = engine.engine_results(m)
print("motor (sin agua libre, piezométrica sobre el terreno):", {k: round(v["fos"], 5) for k, v in res.items()})
print("   fuerzas:", [(f.get("x"), f.get("force") or f.get("available"), f.get("status")) for f in res["spencer"].get("reinforcement_forces", [])][:2])
for free in (True, False):
    mm = copy.deepcopy(m)
    mm["water"]["free_water"] = free
    doc = oracle.build_doc(mm, "spencer")
    doc["definition"]["waterTable"]["freeWater"] = free
    r = cs.analyse(doc)
    cr = r["criticalSurface"]
    print("cSlope freeWater =", free, "FS", round(r["minFOS"], 5), "fuerzas", [(round(f["x"], 3), round(f["force"], 4)) for f in cr["reinforcementForces"]])
# σ'v esperada en el cruce (x ≈ -4,6 bajo la banqueta, 2 m bajo el terreno y 9 m de agua encima):
print("σ'v sin peso del agua: (20 − 9,807)·2 = %.3f ; con el agua: 20·2 + 9,807·9 − 9,807·11 = %.3f" % ((20 - 9.807) * 2, 20 * 2 + 9.807 * 9 - 9.807 * 11))
for label, wat in (("sin agua", None), ("piezométrica a y=9 solo bajo la banqueta (agua sobre el terreno)", True)):
    mm = copy.deepcopy(m)
    if wat is None:
        mm.pop("water")
    r = engine.engine_results(mm)["spencer"]
    print("motor", label, "fuerza", [(f.get("x"), round(f.get("force") or f.get("available") or 0, 4)) for f in r.get("reinforcement_forces", [])])
    if wat is None:
        mm2 = copy.deepcopy(mm)
        doc = oracle.build_doc(mm2, "spencer")
        rr = cs.analyse(doc)
        print("cSlope sin agua fuerza", [(round(f["x"], 3), round(f["force"], 4)) for f in rr["criticalSurface"]["reinforcementForces"]])
