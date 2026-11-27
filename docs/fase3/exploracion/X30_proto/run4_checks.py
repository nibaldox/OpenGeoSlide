"""X30 corrida 4: identidades, monotonía, espejo y σ′v ≤ 0. Salida: $TMPDIR/f3b-x30/run4.json"""
import copy, json, os, sys
sys.path.insert(0, '/home/xodla/archivos/opengeoslide/docs/fase3/exploracion/X30_proto')
import x30, x30_oracle as xo, cslope as cs
OUT = os.path.join(os.environ['TMPDIR'], 'f3b-x30', 'run4.json')
res = {}
# 1. identidad dovela a dovela (seco, sin agua ni cargas): Su_or = ratio·(W/b − u) con u = 0
m = xo.v047a({"ocr": 1.0})
o = xo.oracle_run(m, "bishop")
d = [abs(s["cohesion"] - 0.25 * (s["weight"] / s["width"] - s["porePressure"])) for s in o["slices"]]
res["identidad_seco_ocr1_oraculo_max_abs_dif_kPa"] = max(d)
res["identidad_seco_ocr1_n_dovelas"] = len(d)
# 1b. el prototipo: Su_pr = ratio·σ′v en cada dovela del motor (ocr=1)
pr, sl = x30.proto_fos(m, return_slices=True, methods=["bishop"])
res["identidad_seco_ocr1_proto_max_abs_dif_kPa"] = max(abs(x["cohesion"] - 0.25 * x["sv"]) for x in sl)
# 2. pop = 0 ≡ ocr = 1 (exacto) en el prototipo y en el oráculo
a = x30.proto_fos(xo.v047a({"pop": 0.0}))
b = x30.proto_fos(xo.v047a({"ocr": 1.0}))
res["pop0_vs_ocr1_proto_dif"] = {k: a[k] - b[k] for k in a}
oa = xo.oracle_run(xo.v047a({"pop": 0.0}), "bishop")["fos"]
ob = xo.oracle_run(xo.v047a({"ocr": 1.0}), "bishop")["fos"]
res["pop0_vs_ocr1_oracle_dif"] = oa - ob
# 3. monotonía: ratio (0.20, 0.25, 0.30) y OCR (1.0, 1.5, 2.0), con proto y oráculo
mon = {}
for r_ in (0.20, 0.25, 0.30):
    mon[f"ratio{r_}"] = {"proto_bishop": x30.proto_fos(xo.v047a({"ocr": 1.0}, ratio=r_))["bishop"],
                         "oracle_bishop": xo.oracle_run(xo.v047a({"ocr": 1.0}, ratio=r_), "bishop")["fos"]}
for o_ in (1.0, 1.5, 2.0):
    mon[f"ocr{o_}"] = {"proto_bishop": x30.proto_fos(xo.v047a({"ocr": o_}))["bishop"],
                       "oracle_bishop": xo.oracle_run(xo.v047a({"ocr": o_}), "bishop")["fos"]}
res["monotonia_seco"] = mon
# 4. espejo: x -> −x, dirección contraria, línea de agua reflejada (proto y oráculo)
def mirror(model):
    mm = copy.deepcopy(model)
    for r_ in mm["regions"]:
        r_["polygon"] = [[-p[0], p[1]] for p in r_["polygon"]][::-1]
    mm["analysis"]["surface"]["xc"] = -mm["analysis"]["surface"]["xc"]
    mm["slope"]["direction"] = "left_to_right" if mm["slope"]["direction"] == "right_to_left" else "right_to_left"
    if mm.get("water"):
        mm["water"]["piezometric_line"] = [[-p[0], p[1]] for p in mm["water"]["piezometric_line"]][::-1]
    return mm
for wet in (False, True):
    m0 = xo.v047a({"ocr": 1.0}, wet=wet)
    m1 = mirror(m0)
    res[f"espejo_wet{wet}"] = {"proto_dif": x30.proto_fos(m1)["bishop"] - x30.proto_fos(m0)["bishop"],
                               "oracle_dif": xo.oracle_run(m1, "bishop")["fos"] - xo.oracle_run(m0, "bishop")["fos"],
                               "oracle_m0": xo.oracle_run(m0, "bishop")["fos"], "oracle_m1": xo.oracle_run(m1, "bishop")["fos"],
                               "proto_m0": x30.proto_fos(m0)["bishop"], "proto_m1": x30.proto_fos(m1)["bishop"]}
# 5. σ′v ≤ 0: ru = 1.2 (u > σv en algunas dovelas) → Su = 0 en cSlope y en el prototipo
for lab, mod in [("ru_1.2", lambda m: m["materials"][0].__setitem__("ru", 1.2)),
                 ("udl_q_neg150", lambda m: m.__setitem__("loads", [{"type": "udl", "id": "u1", "x1": 20.0, "x2": 70.0, "q": -150.0}]))]:
    m = xo.v047a({"ocr": 1.0})
    try:
        mod(m)
        pr, sl = x30.proto_fos(m, return_slices=True, methods=["bishop"])
        oo = xo.oracle_run(m, "bishop")
        neg_pr = [d for d in sl if d["sv"] <= 0]
        neg_or = [s for s in oo["slices"] if s["cohesion"] == 0.0]
        res["sv_neg_" + lab] = {"n_sv_le0_proto": len(neg_pr), "n_cohesion0_oracle": len(neg_or),
                                "min_sv_proto": min(d["sv"] for d in sl), "proto_bishop": pr["bishop"],
                                "oracle_bishop": oo["fos"], "oracle_warnings": oo["warnings"]}
    except Exception as e:  # noqa: BLE001
        res["sv_neg_" + lab] = {"error": repr(e)[:300]}
json.dump(res, open(OUT, "w"), indent=1, default=str)
print(json.dumps(res, indent=1, default=str)[:4000], flush=True)
