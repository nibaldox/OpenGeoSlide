"""X30 corrida 2: sismo, cargas, avisos del motor (E13k), búsqueda SHANSEP del oráculo y proto en su círculo.
Salida: $TMPDIR/f3b-x30/run2.json. Uso: env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python run2.py"""
import copy, json, os, sys, time
sys.path.insert(0, '/home/xodla/archivos/opengeoslide/docs/fase3/exploracion/X30_proto')
import x30, x30_oracle as xo, engine
import cslope as cs
from to_cslope import ogs_to_cslope
OUT = os.path.join(os.environ['TMPDIR'], 'f3b-x30', 'run2.json')
M = x30.METHODS
res = {}


def pct(a, b):
    return None if (a is None or b is None or b == 0) else (a - b) / b * 100


def fos_pair(model, label):
    pr = x30.proto_fos(model)
    row = {"oracle": {}, "proto": {}, "dif_pct": {}}
    for m in M:
        try:
            o = xo.oracle_run(model, m)
            row["oracle"][m] = o["fos"]
            row["oracle_warnings"] = o["warnings"]
        except Exception as e:  # noqa: BLE001
            row["oracle"][m] = None
            row.setdefault("errors", []).append(repr(e)[:200])
        row["proto"][m] = pr.get(m)
        row["dif_pct"][m] = pct(pr.get(m), row["oracle"][m])
    res[label] = row
    print(label, {k: (round(v, 6) if v else v) for k, v in row["oracle"].items()}, {k: (round(v, 4) if v is not None else None) for k, v in row["dif_pct"].items()}, row.get("errors", ""), flush=True)
    return row


def oracle_slices(model, method="bishop"):
    return xo.oracle_run(model, method)


# A. sismo: ¿kh o kv cambian σ′v (Su por dovela) en el oráculo?
base = xo.v047a({"ocr": 1.0})
o0 = oracle_slices(base)
for lab, kw in [("kh0.1", {"kh": 0.1}), ("kv0.1", {"kv": 0.1})]:
    m = xo.v047a({"ocr": 1.0}, **kw)
    try:
        o1 = oracle_slices(m)
        c0 = [s["cohesion"] for s in o0["slices"]]
        c1 = [s["cohesion"] for s in o1["slices"]]
        dif = max(abs(a - b) / max(abs(a), 1e-9) for a, b in zip(c0, c1)) if len(c0) == len(c1) else None
        res["sismo_" + lab] = {"fos_oracle": o1["fos"], "fos_oracle_sin_sismo": o0["fos"], "n": (len(c0), len(c1)),
                               "max_rel_dif_Su_por_dovela": dif, "proto": x30.proto_fos(m)}
        print("sismo", lab, o1["fos"], "vs", o0["fos"], "max rel dif Su", dif, flush=True)
    except Exception as e:  # noqa: BLE001
        res["sismo_" + lab] = {"error": repr(e)[:300]}
        print("sismo", lab, "ERROR", repr(e)[:300], flush=True)

# B. cargas udl y line en la cresta (σ′v debe incluir Q)
for lab, loads in [("udl", [{"type": "udl", "id": "q1", "x1": 40.0, "x2": 60.0, "q": 50.0}]),
                   ("line", [{"type": "line", "id": "l1", "x": 45.0, "p": 300.0, "angle": 0.0}])]:
    m = xo.v047a({"ocr": 1.0})
    m["loads"] = loads
    m["version"] = "0.6"
    try:
        fos_pair(m, "carga_" + lab)
        o1 = oracle_slices(m)
        res["carga_" + lab]["sv_sum_or_minus_base"] = sum(s["cohesion"] for s in o1["slices"]) - sum(s["cohesion"] for s in o0["slices"])
    except Exception as e:  # noqa: BLE001
        res["carga_" + lab] = {"error": repr(e)[:300]}
        print("carga", lab, "ERROR", repr(e)[:300], flush=True)

# C. avisos del motor en V047a (E13k) y del oráculo, placeholder de Su=1 kPa en el motor
for wet in (False, True):
    for spec in ({"ocr": 1.0}, {"ocr": 1.5}):
        m = xo.v047a(spec, wet=wet)
        m4, _ = x30.strip_shansep(m)
        r = engine.engine_results(m4)
        ew = {k: r[k].get("warnings") for k in r}
        o = xo.oracle_run(m, "spencer")
        res[f"avisos_wet{wet}_{spec}"] = {"engine_placeholder_warnings": ew, "oracle_spencer_warnings": o["warnings"]}
        print("avisos", wet, spec, ew.get("spencer"), o["warnings"], flush=True)

# D. búsqueda SHANSEP del oráculo (V047a seco, OCR 1), y el proto en el círculo que devuelve
m = xo.v047a({"ocr": 1.0}, surface=None)
m["analysis"].pop("surface", None)
m["analysis"]["search"] = {"type": "circular_entry_exit", "n_entry": 20, "n_exit": 20}
m4, specs = x30.strip_shansep(m)
t0 = time.time()
try:
    conv = ogs_to_cslope(m4, {"method": "bishop", "kind": "search"})
    doc = conv.document
    for i, mat in enumerate(m["materials"]):
        sp = specs[i]
        doc["definition"]["materials"][i]["model"] = {"kind": "shansep", "unitWeight": 20.0, "unitWeightSat": 20.0,
                                                    "ratio": sp["ratio"], "exponent": sp["exponent"], "ocr": sp["ocr"]}
    r = cs.analyse(doc)
    cr = r.get("criticalSurface") or {}
    res["busqueda_oracle_dry_ocr1"] = {"minFOS": r.get("minFOS"), "cx": cr.get("cx"), "cy": cr.get("cy"), "r": cr.get("radius"),
                                      "warnings": [w.get("code") for w in r.get("warnings") or []], "t_s": round(time.time() - t0, 1)}
    print("busqueda oracle", res["busqueda_oracle_dry_ocr1"], flush=True)
    # proto en ese círculo (superficie fija)
    mc = xo.v047a({"ocr": 1.0}, surface={"type": "circle", "xc": cr["cx"], "yc": cr["cy"], "r": cr["radius"]})
    fp = x30.proto_fos(mc)
    oc = xo.oracle_run(mc, "bishop")
    res["busqueda_circulo_fijo_proto_vs_oracle"] = {"proto": fp, "oracle_bishop": oc["fos"], "dif_bishop_pct": pct(fp["bishop"], oc["fos"])}
    print("circulo fijo del oraculo: proto", fp, "oracle", oc["fos"], flush=True)
except Exception as e:  # noqa: BLE001
    res["busqueda_oracle_dry_ocr1"] = {"error": repr(e)[:400]}
    print("busqueda ERROR", repr(e)[:400], flush=True)

json.dump(res, open(OUT, "w"), indent=1, default=str)
print("escrito", OUT, flush=True)
