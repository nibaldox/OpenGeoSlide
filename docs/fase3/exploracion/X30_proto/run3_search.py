"""X30 corrida 3: búsqueda circular SHANSEP del oráculo (V047a seco, OCR 1) y el prototipo en su círculo crítico.
Salida: $TMPDIR/f3b-x30/run3.json"""
import json, os, sys, time
sys.path.insert(0, '/home/xodla/archivos/opengeoslide/docs/fase3/exploracion/X30_proto')
import x30, x30_oracle as xo, cslope as cs
from to_cslope import ogs_to_cslope
OUT = os.path.join(os.environ['TMPDIR'], 'f3b-x30', 'run3.json')
res = {}
m = xo.v047a({"ocr": 1.0}, surface=None)
m["analysis"].pop("surface", None)
m["analysis"]["search"] = {"type": "circular_entry_exit", "n_entry": 20, "n_exit": 20}
m4, specs = x30.strip_shansep(m)
m4["version"] = "0.4"
t0 = time.time()
conv = ogs_to_cslope(m4, {"method": "bishop", "kind": "search"})
doc = conv.document
for i, mat in enumerate(m["materials"]):
    sp = specs[i]
    doc["definition"]["materials"][i]["model"] = {"kind": "shansep", "unitWeight": 20.0, "unitWeightSat": 20.0,
                                                "ratio": sp["ratio"], "exponent": sp["exponent"], "ocr": sp["ocr"]}
r = cs.analyse(doc)
cr = r.get("criticalSurface") or {}
res["oraculo_busqueda_seco_ocr1"] = {"minFOS": r.get("minFOS"), "cx": cr.get("cx"), "cy": cr.get("cy"), "r": cr.get("radius"),
                                    "warnings": [w.get("code") for w in r.get("warnings") or []], "t_s": round(time.time() - t0, 1),
                                    "n_criticalSlices": len(r.get("criticalSlices") or [])}
print("oraculo busqueda", res["oraculo_busqueda_seco_ocr1"], flush=True)
mc = xo.v047a({"ocr": 1.0}, surface={"type": "circle", "xc": cr["cx"], "yc": cr["cy"], "r": cr["radius"]})
try:
    fp = x30.proto_fos(mc)
    oc = xo.oracle_run(mc, "bishop")
    res["circulo_del_oraculo_fijo"] = {"proto": fp, "oracle_bishop": oc["fos"],
                                      "dif_bishop_pct": (fp["bishop"] - oc["fos"]) / oc["fos"] * 100,
                                      "oracle_warnings": oc["warnings"]}
    print("circulo fijo", res["circulo_del_oraculo_fijo"], flush=True)
except Exception as e:  # noqa: BLE001
    res["circulo_del_oraculo_fijo"] = {"error": repr(e)[:300]}
    print("ERR fijo", repr(e)[:300], flush=True)
json.dump(res, open(OUT, "w"), indent=1, default=str)
print("escrito", OUT, flush=True)
