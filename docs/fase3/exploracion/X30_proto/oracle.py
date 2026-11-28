"""Oráculo cSlope 0.1.0 para una fila X21.  Uso (necesita cslope y shapely):

  env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python oracle.py fila.json [...]

La fila es un documento ogs v0.4 con los campos propuestos (analysis.tension_crack, water.free_water). El adaptador arma el
documento de cSlope con `to_cslope.ogs_to_cslope` (sobre el documento sin los campos nuevos) y añade a mano
options.tensionCrackDepth / tensionCrackAuto / tensionCrackWater y waterTable.freeWater."""
from __future__ import annotations
import copy, json, os, sys

from pathlib import Path
ROOT = Path(__file__).resolve().parents[4]
HARNESS = os.environ.get("OGS_HARNESS", str(ROOT / "verification/harness"))
sys.path.insert(0, HARNESS)
import cslope as cs                      # noqa: E402
from to_cslope import ogs_to_cslope      # noqa: E402

METHOD_OPTS = {"bishop": "bishop", "spencer": "spencer", "morgenstern_price": "morgenstern_price",
               "janbu_simplified": "janbu_simplified", "janbu_corrected": "janbu_corrected"}


def clean(model):
    m = copy.deepcopy(model)
    m["version"] = "0.4"
    m["analysis"].pop("tension_crack", None)
    (m.get("water") or {}).pop("free_water", None)
    m["analysis"].pop("interslice", None)
    return m


def build_doc(model, method, extra_options=None):
    m = clean(model)
    if method == "morgenstern_price":
        m["analysis"]["interslice"] = {"function": "constant"}
    conv = ogs_to_cslope(m, {"method": method, "kind": "fixed"})
    doc = conv.document
    opt = doc["options"]
    crack = (model["analysis"].get("tension_crack"))
    if crack:
        if crack["depth"] == "auto":
            opt["tensionCrackAuto"] = True
        else:
            opt["tensionCrackDepth"] = float(crack["depth"])
        if crack.get("water"):
            opt["tensionCrackWater"] = float(crack["water"])
    if (model.get("water") or {}).get("free_water"):
        doc["definition"]["waterTable"]["freeWater"] = True
    elif (model.get("water") or {}).get("piezometric_line") and "waterTable" in doc["definition"]:
        doc["definition"]["waterTable"]["freeWater"] = False
    if extra_options:
        opt.update(extra_options)
    return doc


def run(model, method, extra_options=None, want_slices=False):
    doc = build_doc(model, method, extra_options)
    issues = cs.validate(doc)
    errs = [i for i in issues if i.get("severity") == "error"]
    if errs:
        return {"fos": None, "error": "; ".join(f"{e['path']} [{e['code']}]" for e in errs[:3])}
    try:
        r = cs.analyse(doc)
    except Exception as exc:                # noqa: BLE001
        return {"fos": None, "error": f"{type(exc).__name__}: {str(exc).splitlines()[0][:150]}"}
    fos = r.get("minFOS")
    out = {"fos": fos, "warnings": [w.get("code") for w in r.get("warnings") or []],
           "n_slices": len(r.get("criticalSlices") or [])}
    cr = r.get("criticalSurface") or {}
    out["surface"] = {"cx": cr.get("cx"), "cy": cr.get("cy"), "r": cr.get("radius"), "entry": cr.get("entryPoint"),
                      "exit": cr.get("exitPoint")}
    if want_slices:
        out["slices"] = r.get("criticalSlices")
    return out


def run_all(model, methods=("bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"), **kw):
    return {m: run(model, m, **kw) for m in methods}


if __name__ == "__main__":
    for path in sys.argv[1:]:
        model = json.load(open(path))
        res = run_all(model)
        print(path, {k: (None if v["fos"] is None else round(v["fos"], 6)) or v.get("error") for k, v in res.items()})
