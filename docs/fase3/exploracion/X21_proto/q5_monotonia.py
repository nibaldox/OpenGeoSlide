"""Monotonía del agua embalsada al pie (criterio 5). Necesita cslope:
  env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python q5_monotonia.py"""
import copy, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oracle, proto, rows_def
out = {}
print("V047a, piezométrica horizontal: FS Spencer con agua libre (embalsada) y con la línea recortada (sin agua libre)")
for lev in (26.0, 27.0, 30.0, 33.0):
    m = rows_def.pond(lev)
    clip = copy.deepcopy(m); clip["water"]["free_water"] = False
    a = oracle.run(m, "spencer")["fos"]; b = oracle.run(clip, "spencer")["fos"]
    p, _ = proto.analyze(m, equilibrium_check=False)
    out[f"v047a_{lev}"] = {"oraculo_embalsada": a, "oraculo_recortada": b, "proto_embalsada": p["spencer"]}
    print(f"  nivel {lev}: embalsada {a:.6f} (proto {p['spencer']:.6f}) | recortada {b:.6f} | embalsar sube {100*(a/b-1):+.2f} %")
print("cara de presa vertical (X21-D02), nivel del embalse")
for lev in (0.0, 3.0, 6.0, 9.0):
    m = rows_def.dam({"type": "circle", "xc": 12.0, "yc": 18.0, "r": 26.0}, level=lev)
    if lev == 0.0:
        m["water"].pop("free_water")                      # sin embalse
    a = oracle.run(m, "spencer")["fos"]
    p, _ = proto.analyze(m, equilibrium_check=False)
    out[f"dam_{lev}"] = {"oraculo": a, "proto": p["spencer"]}
    print(f"  nivel {lev}: oráculo {a:.6f} proto {p['spencer']:.6f}")
json.dump(out, open(os.path.join(os.environ.get("TMPDIR", "/tmp"), "f3g-x21", "q5_monotonia.json"), "w"), indent=1)
