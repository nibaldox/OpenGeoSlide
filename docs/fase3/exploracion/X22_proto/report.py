"""Une los resultados del prototipo y del oráculo -> ../X22_filas/resultados.json y las tablas de X22.md (stdout).

  python3 run_proto.py ; env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python run_oracle.py ; python3 report.py
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import im, pile as pilemod, geometry
import rows
TMP = os.path.join(os.environ["TMPDIR"], "x22")
P = json.load(open(os.path.join(TMP, "results_proto_0.05.json")))
O = json.load(open(os.path.join(TMP, "results_oracle.json")))
rows.build()
M = ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]
r6 = lambda v: None if v is None else round(v, 6)


def pct(a, b):
    return None if a is None or b is None else 100.0 * (a - b) / b


out = {"descripcion": "Filas de aceptación X22 (Ito-Matsui). oracle = cSlope 0.1.0 (círculo fijo); proto = prototipo X22 sobre dovelas del motor "
                      "(ogs 0.3.0, base f3g-integracion 1c30f92). Cifras con 6 decimales; diff_pct = 100·(proto - oracle)/oracle.",
       "filas": {}}
worst = 0.0
for rid in sorted(P):
    p, o = P[rid], O[rid]
    row = {"nota": rows.META.get(rid, ""), "circulo": rows.ROWS[rid]["analysis"]["surface"], "metodos": {}}
    for m in M:
        fo, fp = o[m].get("fos"), p["fos"].get(m)
        d = pct(fp, fo)
        row["metodos"][m] = {"oracle": r6(fo), "proto": r6(fp), "diff_pct": None if d is None else round(d, 4)}
        if d is not None:
            worst = max(worst, abs(d))
    row["fuerza_por_metro"] = None
    fo = o["bishop"].get("forces") or []
    pp = p["piles"][0] if p["piles"] else None
    if pp:
        row["fuerza_por_metro"] = {"estado": pp["status"], "oracle": r6(fo[0]["force"]) if fo else None,
                                   "proto": r6(pp.get("per_metre")), "y_cruce_proto": r6(pp.get("y")),
                                   "y_cruce_oracle": r6(fo[0]["y"]) if fo else None,
                                   "brazo_resultante_proto": r6(pp.get("arm")), "gobierna": pp.get("governs")}
        if fo and pp.get("per_metre"):
            row["fuerza_por_metro"]["diff_pct"] = round(pct(pp["per_metre"], fo[0]["force"]), 4)
    row["equilibrio_global"] = {k: float("%.3e" % v) for k, v in p["equilibrium"].items()}
    row["motor_sin_pilote"] = {k: r6(v) for k, v in p["engine_nopile"].items()}
    if "engine_with_force" in p:
        row["motor_con_force"] = {k: r6(v) for k, v in p["engine_with_force"].items()}
        row["proto_menos_motor"] = {k: float("%.2e" % (p["fos"][k] - v)) for k, v in p["engine_with_force"].items()}
    out["filas"][rid] = row

# ---- criterios
crit = {}
crit["oraculo_fija_max_diff_pct"] = round(worst, 4)
n1, n2 = P["X22-N01-sin-pilote"], P["X22-N02-fuera"]
crit["neutralidad_sin_pilote_proto_menos_motor"] = {k: float("%.2e" % (n1["fos"][k] - n1["engine_nopile"][k])) for k in M}
crit["neutralidad_pilote_fuera_proto_menos_sin_pilote"] = {k: float("%.2e" % (n2["fos"][k] - n1["fos"][k])) for k in M}
crit["neutralidad_V013b_cruce_en_la_cabeza"] = {k: float("%.2e" % (P["X22-V013b"]["fos"][k] - P["X22-V013b"]["engine_nopile"][k])) for k in M}
eq = {}
for rid, p in P.items():
    for k, v in p["equilibrium"].items():
        eq[k] = max(eq.get(k, 0.0), v)
crit["equilibrio_global_max_residuo"] = {k: float("%.2e" % v) for k, v in eq.items()}
a, b = P["X22-S05-espejo"]["fos"], P["X22-V013c"]["fos"]
crit["espejo_proto_diff_max"] = float("%.2e" % max(abs(a[k] - b[k]) for k in M))
a, b = O["X22-S05-espejo"], O["X22-V013c"]
crit["espejo_oracle_diff_max"] = float("%.2e" % max(abs(a[k]["fos"] - b[k]["fos"]) for k in M))
g = {}
for rid in ("X22-G01-force-pasivo", "X22-G02-force-activo", "X22-G03-force-tangente"):
    g[rid] = max(abs(v) for v in out["filas"][rid]["proto_menos_motor"].values())
crit["fuerza_dada_proto_menos_motor_max"] = {k: float("%.2e" % v) for k, v in g.items()}
# monotonía de la fuerza con D1/D (material de V013, d = 0,8, sin círculo: perfil a profundidad fija) y del FS (V013b-e)
mono = []
d = 0.8
for dd in (0.25, 0.5, 1, 2, 3, 4, 6, 8, 9):
    sp = d * (dd + 1)
    a1, a2 = im.coeffs(sp, d, 20.0)
    zf = 3.0
    fp = 10.0 * a1 * zf + 20.0 * a2 * zf * zf / 2
    mono.append({"D1_D": dd, "spacing": round(sp, 4), "A1": round(a1, 6), "A2": round(a2, 6), "fuerza_por_pilote_zf3": round(fp, 4),
                 "fuerza_por_metro_zf3": round(fp / sp, 4)})
crit["monotonia_fuerza"] = mono
dec_pilote = all(x["fuerza_por_pilote_zf3"] > y["fuerza_por_pilote_zf3"] for x, y in zip(mono, mono[1:]))
dec_metro = all(x["fuerza_por_metro_zf3"] > y["fuerza_por_metro_zf3"] for x, y in zip(mono, mono[1:]))
crit["monotonia_fuerza_decrece_con_D1_D"] = {"por_pilote": dec_pilote, "por_metro": dec_metro}
fs = [(rid, P[rid]["fos"]["bishop"], O[rid]["bishop"]["fos"]) for rid in ("X22-V013b", "X22-V013c", "X22-V013d", "X22-V013e")]
crit["monotonia_FS_V013b_e_bishop"] = {"proto": [r6(x[1]) for x in fs], "oracle": [r6(x[2]) for x in fs],
                                         "decrece": all(x[1] > y[1] for x, y in zip(fs, fs[1:]))}
out["criterios"] = crit
json.dump(out, open(os.path.join(HERE, "..", "X22_filas", "resultados.json"), "w"), indent=1, ensure_ascii=False)

# ---- tabla Markdown
print("| fila | método | oráculo | proto | Δ % |")
print("|---|---|---:|---:|---:|")
for rid, row in out["filas"].items():
    for m in M:
        c = row["metodos"][m]
        print(f"| {rid} | {m} | {c['oracle']:.6f} | {c['proto']:.6f} | {c['diff_pct']:+.4f} |")
print(json.dumps(crit, indent=1, ensure_ascii=False))
