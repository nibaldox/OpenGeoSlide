"""Oráculo cSlope 0.1.0 para una fila X22 (círculo fijo). Necesita cslope y shapely:

  env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python oracle.py fila.json [...]

La fila es un documento ogs v0.4 con pilotes que pueden traer `lateral_pressure` (propuesta v0.5). El adaptador arma el documento
de cSlope con `to_cslope.ogs_to_cslope` sobre el documento SIN pilotes de Ito-Matsui (el conversor no los conoce) y añade a mano
`definition.piles[]` con `diameter`, sin `force`, `application`, `location` ("centroid" | "slip-surface"), `direction` y `angle`.
Los pilotes con `force` pasan por el conversor como siempre (location "slip-surface", sin efecto con fuerza dada).
"""
from __future__ import annotations
import copy, json, os, sys

from pathlib import Path
ROOT = Path(__file__).resolve().parents[4]
HARNESS = os.environ.get("OGS_HARNESS", str(ROOT / "verification/harness"))
sys.path.insert(0, HARNESS)
import cslope as cs                      # noqa: E402
from to_cslope import ogs_to_cslope      # noqa: E402

METHODS = ("bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected")


def build_doc(model, method, location=None):
    m = copy.deepcopy(model)
    m["version"] = "0.4"
    m["analysis"].pop("interslice", None)
    if method == "morgenstern_price":
        m["analysis"]["interslice"] = {"function": "constant"}
    items = m.get("reinforcements", [])
    im_piles = [r for r in items if r.get("lateral_pressure")]
    rest = [r for r in items if not r.get("lateral_pressure")]
    if rest:
        m["reinforcements"] = rest
    else:
        m.pop("reinforcements", None)
    conv = ogs_to_cslope(m, {"method": method, "kind": "fixed"})
    doc = conv.document
    df = doc["definition"]
    for r in im_piles:
        lp = r["lateral_pressure"]
        loc = location or lp.get("location", "centroid")
        p = {"x1": r["x1"], "y1": r["y1"], "x2": r["x2"], "y2": r["y2"], "spacing": r.get("spacing", 1.0),
             "diameter": lp["diameter"], "application": r["application"],
             "location": "slip-surface" if loc in ("slip_surface", "slip-surface", "crossing") else "centroid",
             "direction": r.get("direction", "angle")}
        if p["direction"] == "angle":
            p["angle"] = r.get("angle", 0.0)
        cap = r.get("capacity") or {}
        if cap.get("shear") is not None:
            p["shearCapacity"] = cap["shear"]
        if cap.get("moment") is not None:
            p["momentCapacity"] = cap["moment"]
        df.setdefault("piles", []).append(p)
    return doc


def run(model, method, location=None):
    doc = build_doc(model, method, location)
    issues = [i for i in cs.validate(doc) if i.get("severity") == "error"]
    if issues:
        return {"fos": None, "error": "; ".join(f"{e['path']} [{e['code']}]" for e in issues[:3])}
    try:
        r = cs.analyse(doc)
    except Exception as exc:                # noqa: BLE001
        return {"fos": None, "error": f"{type(exc).__name__}: {str(exc).splitlines()[0][:150]}"}
    cr = r.get("criticalSurface") or {}
    return {"fos": r.get("minFOS"), "warnings": [w.get("code") for w in r.get("warnings") or []],
            "forces": [{k: f[k] for k in ("x", "y", "fx", "fy", "force", "passive")} for f in cr.get("reinforcementForces") or []],
            "n_slices": len(r.get("criticalSlices") or [])}


def run_all(model, location=None, methods=METHODS):
    return {m: run(model, m, location) for m in methods}


if __name__ == "__main__":
    for path in sys.argv[1:]:
        print(path, json.dumps(run_all(json.load(open(path))), default=str)[:1500])
