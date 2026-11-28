"""Modelos de X28 en formato ogs v0.4 (material HB) y su versión de oráculo (to_cslope + material HB).

- `ogs_doc(...)`: documento con material `hoek_brown` (formato v0.6 provisional de la fila: model completo).
- `engine_doc(...)`: el mismo documento con un material Mohr-Coulomb de reemplazo con el mismo γ y ru
  (el motor 0.4.0 no conoce HB; solo se usa para la geometría de dovelas, pesos, u y agua).
- `oracle_doc(...)`: `to_cslope.ogs_to_cslope` sobre `engine_doc` y el material cambiado a `hoek-brown` de cSlope.
"""
from __future__ import annotations
import copy, json, os, sys

from pathlib import Path
ROOT = str(Path(__file__).resolve().parents[4])
HARNESS = os.path.join(ROOT, "verification", "harness")
GW = 9.807                    # peso específico del agua de cSlope 0.1.0 (to_cslope.CSLOPE_WATER_UNIT_WEIGHT)
METHODS = ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]

# ---- geometría (x a la derecha, y arriba) -------------------------------------------------
X25_POLY = [[0.0, 0.0], [0.0, 25.0], [15.0, 25.0], [35.0, 5.0], [50.0, 5.0], [50.0, 0.0]]   # cslope.examples.simple_slope(20, 1)
HAM1_POLY = [[0.0, 0.0], [50.0, 0.0], [50.0, 15.0], [30.0, 15.0], [20.0, 5.0], [0.0, 5.0]]   # Hammah ej. 1 (X23 §3.2)
SA_POLY = [[-40, -10], [72.3205, -10], [72.3205, 30], [32.3205, 30], [27.3205, 30], [21.547, 20], [16.547, 20],
           [10.7735, 10], [5.7735, 10], [0, 0], [-40, 0]]                                       # X23 §4.1
SB_POLY = [[-40, -10], [57.2794, -10], [57.2794, 20], [17.2794, 20], [12.2794, 20], [8.6397, 10], [3.6397, 10],
           [0, 0], [-40, 0]]                                                                    # X23 §4.2
SB_WT = [[-40, -2], [0, -2], [15, 5], [30, 8], [50, 8], [70, 8]]                                 # X23 §4.2 waterTable

# ---- modelos -------------------------------------------------------------------------------
MODELS = {
    "X25": dict(poly=X25_POLY, dir="left_to_right", hb=dict(ucs=5000.0, gsi=20.0, mi=8.0, disturbance=0.0),
                gamma=25.0, point=[30.0, 8.0], limits=dict(entryLeftX=0.0, entryRightX=30.0, exitLeftX=20.0, exitRightX=60.0),
                note="X25 §4.1 (talud 20 m, 1H:1V, roca simple)"),
    "HAM1": dict(poly=HAM1_POLY, dir="right_to_left", hb=dict(ucs=30000.0, gsi=5.0, mi=2.0, disturbance=0.0),
                 gamma=25.0, point=[10.0, 2.5], limits=dict(entryLeftX=-20.0, entryRightX=40.0, exitLeftX=10.0, exitRightX=60.0),
                 note="Hammah et al. 2005 ej. 1 (ARMA 05-810), geometría de X23 §3.2 [inferido del tutorial XSLOPE]"),
    "SA": dict(poly=SA_POLY, dir="right_to_left", hb=dict(ucs=12000.0, gsi=25.0, mi=8.0, disturbance=0.7),
               gamma=25.0, point=[20.0, -5.0], limits=dict(entryLeftX=-40.0, entryRightX=50.0, exitLeftX=5.0, exitRightX=80.0),
               note="X23 §4.1 SA: roca débil, seco"),
    "SB": dict(poly=SB_POLY, dir="right_to_left", hb=dict(ucs=15000.0, gsi=40.0, mi=10.0, disturbance=0.5),
               gamma=25.0, point=[15.0, -5.0], limits=dict(entryLeftX=-40.0, entryRightX=50.0, exitLeftX=5.0, exitRightX=80.0),
               note="X23 §4.2 SB: roca media", wt=SB_WT),
}


def ogs_doc(key, circle=None, surface=None, ru=None, wt=None, slices=40, methods=METHODS, hb=None, poly=None,
            direction=None, unit_weight=None):
    """Documento ogs v0.4 con material hoek_brown (y `ru` opcional)."""
    spec = MODELS[key]
    hbp = dict(spec["hb"], **(hb or {}))
    m = {
        "format": "opengeoslide", "version": "0.4", "units": "SI",
        "meta": {"id": key, "title": spec["note"]},
        "materials": [{"id": "roca", "name": "roca", "model": "hoek_brown",
                       "unit_weight": unit_weight or spec["gamma"], "unit_weight_sat": None,
                       "ucs": hbp["ucs"], "gsi": hbp["gsi"], "mi": hbp["mi"],
                       "disturbance": hbp["disturbance"], "ru": ru}],
        "regions": [{"material": "roca", "polygon": copy.deepcopy(poly or spec["poly"])}],
        "slope": {"direction": direction or spec["dir"]},
        "analysis": {"methods": list(methods), "slices": slices, "tolerance": 1e-5, "max_iterations": 1000,
                     "min_m_alpha": 0.2},
    }
    w = wt
    if w is not None:
        m["water"] = {"unit_weight": GW, "piezometric_line": copy.deepcopy(w)}
    if circle is not None:
        m["analysis"]["surface"] = {"type": "circle", "xc": circle[0], "yc": circle[1], "r": circle[2]}
    if surface is not None:
        m["analysis"]["surface"] = surface
    return m


def engine_doc(doc):
    """Material de reemplazo Mohr-Coulomb (mismo γ y ru) para el motor 0.4.0: solo sirve para la geometría."""
    d = copy.deepcopy(doc)
    mat = d["materials"][0]
    mat["model"] = "mohr_coulomb"
    for k in ("ucs", "gsi", "mi", "disturbance"):
        mat.pop(k, None)
    mat["cohesion"] = 1.0
    mat["friction_angle"] = 30.0
    return d


def _harness():
    if HARNESS not in sys.path:
        sys.path.insert(0, HARNESS)
    from to_cslope import ogs_to_cslope  # noqa: E402
    return ogs_to_cslope


def oracle_doc(doc, method, kind="fixed", limits=None):
    """Documento de cSlope: to_cslope(engine_doc) + material HB + (búsqueda: límites explícitos)."""
    ogs_to_cslope = _harness()
    ed = engine_doc(doc)
    ed.setdefault("analysis", {})
    if kind == "search":
        ed["analysis"].pop("surface", None)
        ed["analysis"]["search"] = {"type": "circular_entry_exit", "n_entry": 20, "n_exit": 20, "n_radius": 20,
                                    "max_radius_factor": 5.0, "min_width": None, "refine": True}
    if method == "morgenstern_price":
        ed["analysis"]["interslice"] = {"function": "constant"}
    conv = ogs_to_cslope(ed, {"method": method, "kind": kind})
    cd = conv.document
    mat = doc["materials"][0]
    hbm = {"kind": "hoek-brown", "unitWeight": mat["unit_weight"], "ucs": mat["ucs"], "gsi": mat["gsi"],
           "mi": mat["mi"], "disturbance": mat["disturbance"]}
    if mat.get("ru") is not None:
        hbm["ru"] = mat["ru"]
    cd["definition"]["materials"][0]["model"] = hbm
    if kind == "search":
        cd["definition"].pop("customSearchPlanes", None)
        cd["definition"]["customPlanesOnly"] = False
        cd["definition"]["analysisLimits"] = dict(limits)
        cd["options"]["searchMethod"] = "circular"
    return cd, conv


def dump(obj, path):
    with open(path, "w") as f:
        json.dump(obj, f, indent=1, default=str)


def cslope_direct(key, method="Bishop", kind="search", circle=None, slices=40, wt=None):
    """Documento cSlope escrito a mano, igual que X23 §4 (sin to_cslope): sin campo `orientation`, como X23.

    kind 'search': búsqueda circular con analysisLimits de MODELS[key]; kind 'fixed': customSearchPlanes = circle.
    Sirve para la búsqueda del círculo crítico (X23 §4.1-4.2) y para comprobar que to_cslope no cambia el FS."""
    spec = MODELS[key]
    hbp = spec["hb"]
    d = {
        "coordinates": copy.deepcopy(spec["poly"]),
        "materials": [{"name": "roca", "model": {"kind": "hoek-brown", "unitWeight": spec["gamma"],
                                                  "ucs": hbp["ucs"], "gsi": hbp["gsi"], "mi": hbp["mi"],
                                                  "disturbance": hbp["disturbance"]}}],
        "materialBoundaries": [],
        "regionAssignments": [{"point": spec["point"], "materialName": "roca"}],
    }
    w = wt
    if w is not None:
        d["waterTable"] = {"mode": "custom", "value": copy.deepcopy(w), "followBoundary": False}
    o = {"method": method, "slices": slices, "iterations": 1000, "refinedIterations": 1000, "tolerance": 1e-5,
         "searchMethod": "circular"}
    if kind == "search":
        d["analysisLimits"] = dict(spec["limits"])
    else:
        d["customSearchPlanes"] = [{"cx": circle[0], "cy": circle[1], "radius": circle[2]}]
        d["customPlanesOnly"] = True
    return {"format": "cslope-analysis", "formatVersion": 1, "definition": d, "options": o}
