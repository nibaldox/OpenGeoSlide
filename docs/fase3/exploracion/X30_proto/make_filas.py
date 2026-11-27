"""X30: escribe X30_filas/*.json (filas de aceptación, formato v0.6 provisional) y resultados.json.
Lee las cifras de $TMPDIR/f3b-x30/run1..run4.json (salidas reales) y recalcula solo el caso γ < γw (nuevo).
Uso: env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python make_filas.py"""
import copy, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import x30, x30_oracle as xo, cslope as cs
T = os.environ["TMPDIR"]
W = os.path.join(T, "f3b-x30")
R1 = json.load(open(os.path.join(W, "run1.json")))
R2 = json.load(open(os.path.join(W, "run2.json")))
R3 = json.load(open(os.path.join(W, "run3.json")))
R4 = json.load(open(os.path.join(W, "run4.json")))
OUTD = HERE.replace("X30_proto", "X30_filas")
os.makedirs(OUTD, exist_ok=True)
M = x30.METHODS
rows = []


def six(x):
    return None if x is None else round(float(x), 6)


def add(rid, grupo, desc, model, oracle_vals, oracle_cfg, proto_vals, tol, nota=""):
    row = {"id": rid, "descripcion": desc, "grupo": grupo, "model": model,
           "oracle": {**{k: six(v) for k, v in oracle_vals.items()}, "config": oracle_cfg},
           "proto": {k: six(v) for k, v in proto_vals.items()},
           "tolerancia": tol, "nota": nota}
    rows.append(row)
    json.dump(row, open(os.path.join(OUTD, rid + ".json"), "w"), indent=1, ensure_ascii=False)


CFG = "cSlope 0.1.0 (oracle-venv), círculo fijo, to_cslope.ogs_to_cslope + SHANSEP (ratio, exponent, OCR) y agua libre (freeWater true), 50 dovelas, tolerancia 1e-3, M-P con intersliceFunction constant (= Spencer)"
CFG_VB = CFG
for key, lab, spec, wet in [
    ("V047a-seco-ocr1", "seco, OCR 1", {"ocr": 1.0}, False),
    ("V047a-seco-ocr1.5", "seco, OCR 1,5", {"ocr": 1.5}, False),
    ("V047a-seco-pop10", "seco, POP 10 kPa", {"pop": 10.0}, False),
    ("V047a-seco-ocrbyelev", "seco, ocr_by_elevation [[20,1],[35,1.5]]", {"ocr_by_elevation": [[20.0, 1.0], [35.0, 1.5]]}, False),
    ("V047a-humedo-ocr1", "húmedo (línea y=30, agua embalsada), OCR 1", {"ocr": 1.0}, True),
    ("V047a-humedo-ocr1.5", "húmedo, OCR 1,5", {"ocr": 1.5}, True),
    ("V047a-humedo-pop10", "húmedo, POP 10 kPa", {"pop": 10.0}, True),
    ("V047a-humedo-ocrbyelev", "húmedo, ocr_by_elevation", {"ocr_by_elevation": [[20.0, 1.0], [35.0, 1.5]]}, True),
]:
    k = "V047a_" + ("wet" if wet else "dry") + "_" + {"ocr1": "ocr1", "ocr1.5": "ocr1.5", "pop10": "pop10", "ocr_by_elev": "ocr_by_elev"}[key.split("-")[-1].replace("ocrbyelev", "ocr_by_elev")]
    o = R1[k]["oracle"]
    p = R1[k]["proto"]
    model = xo.v047a(spec, wet=wet)
    add("X30-F-" + key, "ocr_fuentes", f"V047a {lab}, círculo fijo crítico MC (29,511; 53,738; r 28,742)", model,
        o, CFG_VB, p, {"relativa": 0.001, "nota_tol": "prototipo ≤ 0,02 % en 50 dovelas"},
        "Su = 0,25·σ′v·OCR^0,8. Diferencia del prototipo frente al oráculo: ver resultados.json.")

# V105a
m105, df105, case105 = xo.v105a()
ov = R1["V105a"]["oracle_golden"]
oracle105 = {"bishop": ov["Bishop"]["fos"], "spencer": ov["Morgenstern-Price_const"]["fos"],
             "morgenstern_price": ov["Morgenstern-Price_const"]["fos"], "janbu_simplified": ov["Janbu_simpl"]["fos"],
             "janbu_corrected": ov["Janbu_corr"]["fos"]}
add("X30-F-V105a", "pop_entra", "V105a (POP, aboveWater, nivel de agua diario), círculo fijo cx 20, cy 20, r 20", m105,
    oracle105, "cSlope 0.1.0 con el golden de verification.json tal cual (opciones de V105a, 50 dovelas); publicado Bishop 1,285 ± 0,01039",
    R1["V105a"]["proto"], {"relativa": 0.005, "nota_tol": "0,5 % con 50 dovelas; ver nota"},
    "Publicado Bishop 1,285 (tol 0,01039). Proto Bishop 1,289122 (+0,31 %) con 50 dovelas; 1,287163 con 100 dovelas; "
    "1,284176 con 400. El 0,1 % no se alcanza con 50 dovelas: la diferencia es de discretización del motor (119 dovelas).")

# sismo y cargas
for key, lab in [("carga_udl", "udl q=50 kPa en x 40–60"), ("carga_line", "carga de línea P=300 kN/m en x=45")]:
    d = R2[key]
    model = xo.v047a({"ocr": 1.0})
    model["loads"] = ([{"type": "udl", "id": "q1", "x1": 40.0, "x2": 60.0, "q": 50.0}] if key == "carga_udl"
                      else [{"type": "line", "id": "l1", "x": 45.0, "p": 300.0, "angle": 0.0}])
    add("X30-F-" + key.replace("_", "-"), "cargas", f"V047a seco OCR 1 con {lab}", model, d["oracle"],
        CFG, d["proto"], {"relativa": 0.001, "nota_tol": "diferencia medida ≤ 0,006 %"},
        "Las cargas entran en σ′v (weight_extra de Q) y el oráculo las trae igual.")

s_or = R2["sismo_kh0.1"]
add("X30-F-sismo-kh0.1", "sismo", "V047a seco OCR 1 con kh 0,1 (sismo pseudoestático)", xo.v047a({"ocr": 1.0}, kh=0.1),
    {"bishop": s_or["fos_oracle"]}, CFG + " | solo Bishop, Su por dovela idéntico al caso sin sismo (diferencia relativa máxima 0)",
    {"bishop": s_or["proto"]["bishop"]}, {"relativa": 0.001},
    "kh cambia el FS (0,682261 → 0,566999) pero no σ′v ni Su: ver resultados.json (sismo).")
s_kv = R2["sismo_kv0.1"]
add("X30-F-sismo-kv0.1", "sismo", "V047a seco OCR 1 con kv 0,1", xo.v047a({"ocr": 1.0}, kv=0.1),
    {"bishop": s_kv["fos_oracle"]}, CFG + " | solo Bishop; Su por dovela idéntico al caso sin sismo",
    {"bishop": s_kv["proto"]["bishop"]}, {"relativa": 0.001},
    "kv cambia el FS (0,682261 → 0,620237) pero no Su: σ′v es estática (kv·W fuera).")

# búsqueda profunda
cr = R3["oraculo_busqueda_seco_ocr1"]
mc = xo.v047a({"ocr": 1.0}, surface={"type": "circle", "xc": cr["cx"], "yc": cr["cy"], "r": cr["r"]})
pc = R3["circulo_del_oraculo_fijo"]["proto"]
oc = {"bishop": R3["circulo_del_oraculo_fijo"]["oracle_bishop"]}
add("X30-S-V047a-profundo", "busqueda", "V047a seco OCR 1, búsqueda circular del oráculo (r ≈ 257 m en 15 m de talud) evaluada por el prototipo como superficie fija",
    mc, oc, "cSlope 0.1.0 búsqueda circular (entrada/salida 20×20), Bishop, MINIMO " + f"{cr['minFOS']:.6f} en (cx {cr['cx']:.3f}, cy {cr['cy']:.3f}, r {cr['r']:.3f})",
    {"bishop": pc["bishop"]}, {"relativa": 0.001},
    "El motor (0.4.0) no busca con SHANSEP: no hay búsqueda del prototipo implementada. Advertencia propuesta: r/H ≈ 17.")

# γ < γw sin γsat: σ′v < 0 en dovelas bajo el agua
m_neg = xo.v047a({"ocr": 1.0}, wet=True)
m_neg["materials"][0]["unit_weight"] = 8.0
m_neg["materials"][0]["unit_weight_sat"] = None
try:
    pn, sln = x30.proto_fos(m_neg, return_slices=True, methods=["bishop"])
    oon = xo.oracle_run(m_neg, "bishop")
    neg_pr = sum(1 for d in sln if d["sv"] <= 0)
    neg_or = sum(1 for s in oon["slices"] if s["cohesion"] == 0.0)
    R4["sv_neg_gamma8_wet"] = {"n_sv_le0_proto": neg_pr, "n_cohesion0_oracle": neg_or, "proto_bishop": pn["bishop"],
                               "oracle_bishop": oon["fos"], "oracle_warnings": oon["warnings"]}
except Exception as e:  # noqa: BLE001
    R4["sv_neg_gamma8_wet"] = {"error": repr(e)[:300]}
print("γ8 húmedo:", R4["sv_neg_gamma8_wet"])

resumen = {"filas": [r["id"] for r in rows], "tabla": {}, "identidades_y_monotonia_seco": {
    "identidad_dovela_a_dovela_seco_ocr1_oraculo_max_abs_kPa": R4["identidad_seco_ocr1_oraculo_max_abs_dif_kPa"],
    "identidad_dovela_a_dovela_seco_ocr1_proto_max_abs_kPa": R4["identidad_seco_ocr1_proto_max_abs_dif_kPa"],
    "pop0_igual_ocr1_proto": R4["pop0_vs_ocr1_proto_dif"], "pop0_igual_ocr1_oraculo": R4["pop0_vs_ocr1_oracle_dif"],
    "monotonia": R4["monotonia_seco"], "espejo": {k: v for k, v in R4.items() if k.startswith("espejo")},
    "sv_neg": {k: v for k, v in R4.items() if k.startswith("sv_neg")}},
    "V047a_extra": {"sismo": {k: R2[k] for k in R2 if k.startswith("sismo")},
                    "cargas": {k: R2[k] for k in R2 if k.startswith("carga")},
                    "avisos_motor_placeholder_vs_oraculo": {k: v for k, v in R2.items() if k.startswith("avisos")}},
    "busqueda": {"oraculo": cr, "circulo_fijo": R3["circulo_del_oraculo_fijo"]},
    "sv_neg_gamma8_wet": R4.get("sv_neg_gamma8_wet"),
    "V105a": {"proto": R1["V105a"]["proto"], "oracle": oracle105, "n_aw": R1["V105a"]["n_above_water_slices"]}}
for r in rows:
    tab = {}
    for m in M:
        o = r["oracle"].get(m)
        p = r["proto"].get(m)
        tab[m] = {"oracle": o, "proto": p, "dif_pct": None if (o is None or p is None) else round((p - o) / o * 100, 4)}
    resumen["tabla"][r["id"]] = tab
json.dump(resumen, open(os.path.join(OUTD, "resultados.json"), "w"), indent=1, ensure_ascii=False, default=str)
print("filas", len(rows), [r["id"] for r in rows])
for r in rows:
    print(r["id"], {m: resumen["tabla"][r["id"]][m]["dif_pct"] for m in M})
