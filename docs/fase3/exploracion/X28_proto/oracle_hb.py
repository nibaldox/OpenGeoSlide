"""Oráculo cSlope 0.1.0 para los modelos HB de X28. Ejecutar con $TMPDIR/oracle-venv/bin/python.

Uso:
  OUT=$TMPDIR/f3b-x28 ; $OR oracle_hb.py search KEY             # círculo crítico Bishop (HB) -> $OUT/circles.json
  $OR oracle_hb.py fixed KEY CX CY R [WATER] [RU]                # círculo fijo, 5 métodos -> $OUT/oracle_<tag>.json
Salida: minFOS por método, y las dovelas críticas (x, xLeft, xRight, yTop, yBottom, alpha, baseLength, weight,
normalForce N total, porePressure, cohesion, frictionAngle) de cada método.
"""
from __future__ import annotations
import json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import models
import cslope as cs

OUT = os.environ.get("X28_OUT", os.path.join(os.environ.get("TMPDIR", "/tmp"), "f3b-x28"))
os.makedirs(OUT, exist_ok=True)
M5 = models.METHODS


def build(key, ru=None, wt=None, slices=40, method="bishop", circle=None, poly=None):
    doc = models.ogs_doc(key, circle=circle, ru=ru, wt=wt, slices=slices, poly=poly)
    return doc


def run_doc(cd):
    issues = cs.validate(cd)
    errs = [i for i in issues if i.get("severity") == "error"]
    if errs:
        return {"error": "; ".join(f"{e.get('path')} [{e.get('code')}]" for e in errs[:3])}
    t0 = time.perf_counter()
    r = cs.analyse(cd)
    el = time.perf_counter() - t0
    out = {"fos": r.get("minFOS"), "elapsed_s": el, "warnings": [w.get("code") for w in r.get("warnings") or []]}
    cr = r.get("criticalSurface") or {}
    out["surface"] = {k: cr.get(k) for k in ("cx", "cy", "radius", "entryPoint", "exitPoint")}
    out["slices"] = [{k: s.get(k) for k in ("x", "xLeft", "xRight", "yTop", "yBottom", "alpha", "baseLength", "weight",
                                            "normalForce", "shearForce", "porePressure", "cohesion", "frictionAngle")}
                     for s in (r.get("criticalSlices") or [])]
    out["n_slices"] = len(out["slices"])
    out["passes_info"] = {k: r.get(k) for k in ("nonConvergedSurfaces", "splitFailureCount")}
    return out


def search(key, limits=None):
    d = models.MODELS[key]
    doc = build(key)
    cd, _ = models.oracle_doc(doc, "bishop", kind="search", limits=limits or d["limits"])
    cd["options"]["method"] = "Bishop"
    return run_doc(cd)


def fixed(key, circle, method, ru=None, wt=None, slices=40, poly=None):
    doc = build(key, ru=ru, wt=wt, slices=slices, circle=circle, poly=poly)
    cd, _ = models.oracle_doc(doc, method, kind="fixed")
    return run_doc(cd)


def direct_fixed(key, circle, method, wt=None, slices=40, ru=None):
    """cslope_direct (escrito a mano, como X23) con círculo fijo."""
    d = models.cslope_direct(key, method=method, kind="fixed", circle=circle, slices=slices, wt=wt)
    if ru is not None:
        d["definition"]["materials"][0]["model"]["ru"] = ru
    if method != "Bishop" and method is not None:
        pass
    return run_doc(d)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "direct":
        # direct KEY [WT:0|1] [RU|-] [TAG] : círculo de circles_direct.json, 5 métodos (escrito a mano)
        key = sys.argv[2]
        cd_ = json.load(open(os.path.join(OUT, "circles_direct.json")))[key]
        circle = [cd_["cx"], cd_["cy"], cd_["r"]]
        wt = models.MODELS[key].get("wt") if (len(sys.argv) > 3 and sys.argv[3] == "1") else None
        ru = float(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] != "-" else None
        tag = sys.argv[5] if len(sys.argv) > 5 else key + ("_wt" if wt else "")
        names = {"bishop": "Bishop", "spencer": "Morgenstern-Price", "morgenstern_price": "Morgenstern-Price",
                 "janbu_simplified": "Janbu", "janbu_corrected": "Janbu"}
        res = {}
        for m in M5:
            if m in ("spencer", "morgenstern_price"):
                d = models.cslope_direct(key, method="Morgenstern-Price", kind="fixed", circle=circle, wt=wt)
                d["definition"]["analysisLimits"] = None
                d["options"]["intersliceFunction"] = "constant"
            elif m.startswith("janbu"):
                d = models.cslope_direct(key, method="Janbu", kind="fixed", circle=circle, wt=wt)
                d["options"]["janbuCorrection"] = (m == "janbu_corrected")
            else:
                d = models.cslope_direct(key, method="Bishop", kind="fixed", circle=circle, wt=wt)
            d["definition"].pop("analysisLimits", None)
            if ru is not None:
                d["definition"]["materials"][0]["model"]["ru"] = ru
            res[m] = run_doc(d)
            print(tag, m, res[m].get("fos"), res[m].get("error"), res[m].get("n_slices"))
        models.dump({"circle": circle, "wt": wt is not None, "ru": ru, "results": res}, os.path.join(OUT, f"oracle_direct_{tag}.json"))
        raise SystemExit(0)
    if cmd == "dump_circles":
        pass
    if cmd == "search":
        key = sys.argv[2]
        res = search(key)
        path = os.path.join(OUT, "circles.json")
        allc = json.load(open(path)) if os.path.exists(path) else {}
        allc[key] = res
        models.dump(allc, path)
        print(key, res.get("fos"), res.get("surface"), res.get("error"))
    elif cmd == "fixed":
        key = sys.argv[2]
        circle = [float(v) for v in sys.argv[3:6]]
        ru = float(sys.argv[6]) if len(sys.argv) > 6 and sys.argv[6] != "-" else None
        wt = None
        tag = sys.argv[7] if len(sys.argv) > 7 else key
        res = {}
        for m in M5:
            res[m] = fixed(key, circle, m, ru=ru)
            print(tag, m, res[m].get("fos"), res[m].get("error"), res[m].get("n_slices"))
        models.dump({"circle": circle, "ru": ru, "results": res}, os.path.join(OUT, f"oracle_{tag}.json"))
