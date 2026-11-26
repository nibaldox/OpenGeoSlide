#!/usr/bin/env python3
"""Convert cSlope verification problems (MIT) into OpenGeoSlide verification cases (v0.1, v0.2 and v0.3).

Usage (from the repository root):

    uv run --no-project --with shapely --with jsonschema \\
        python verification/tools/import_cslope.py --src /path/to/cslope

The source clone is read only. The script writes:

- verification/cases/<id>.json   one case per converted cSlope problem (format: briefs/00_CONTRATOS.md, section 2)
- verification/cases/INDEX.md    table of converted cases, omitted cases and discarded checks
                                 Cases with seismic coefficients or loads (schema v0.2, briefs/01_CONTRATOS_FASE1.md F1.1)
                                 are written here too, with `version: "0.2"` (the v0.2 engine accepts them since A1)
- verification/pending/INDEX.md  every cSlope problem with `seismicHorizontal`, `seismicVertical`, `udls` or
                                 `lineLoads`, with the reason it is excluded (the included ones live in cases/)
- verification/pending/lote0/    checks of batch 0 that the engine does not reproduce (listed in HOLD.json with the numbers);
                                 they are not promoted and nothing is relaxed (briefs/F3A_ola0.md, W1v)
- verification/pending/F3/       batches 1 and 2 (contract F3.8): undrained / s-f-datum materials, fixed polylines,
                                 Morgenstern-Price with every interslice function and Janbu, written as v0.3 models.
                                 They wait for the engine; each file holds every convertible check of the problem
- NOTICE                         attribution plus the cSlope MIT license text, copied from the source

Batch 0 is every problem that converts today (no cap, no selection). The output is deterministic: running the
script twice leaves every file unchanged. Gates run on every execution: JSON Schema (defined below), geometry
(shapely). The script exits with status 1 if any gate fails.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import jsonschema
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import polygonize, unary_union
from shapely.validation import explain_validity

# ---------------------------------------------------------------- batches (contract F3.8)
# Batch 0: converts today (mohr-coulomb, circles, Bishop and Spencer). Batch 1: undrained and s-f-datum materials.
# Batch 2: fixed polylines (`customSurfaces`), Morgenstern-Price with any function and Janbu. A check belongs to
# the highest batch that one of its requirements needs.
F3_VERSION = "0.3"
F3_METHOD_ORDER = ("bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected")
INTERSLICE_FUNCTIONS = {
    "constant": "constant", "half-sine": "half_sine", "clipped-sine": "clipped_sine",
    "trapezoidal": "trapezoidal", "data-point-specified": "data_points",
}
HOLD_FILE = Path("verification") / "pending" / "lote0" / "HOLD.json"
HOLD_F3_FILE = Path("verification") / "pending" / "F3" / "HOLD.json"

# ---------------------------------------------------------------- conversion constants
GAMMA_W = {"SI": 9.807, "imperial": 62.4}  # cSlope constant 9.807 kN/m3; 62.4 pcf for imperial
ALLOWED_DEFINITION_KEYS = {
    "coordinates", "materials", "materialBoundaries", "regionAssignments", "analysisLimits",
    "customPlanesOnly", "customSearchPlanes", "orientation", "waterTable",
}
# Schema v0.2 (contract F1.1): loads and seismic coefficients. Only with `convert(..., v02=True)`.
V02_DEFINITION_KEYS = {"udls", "lineLoads"}
ALLOWED_UDL_KEYS = {"magnitude", "x1", "x2", "direction"}
ALLOWED_LINE_LOAD_KEYS = {"magnitude", "x", "angle"}
SEISMIC_OPTION_KEYS = ("seismicHorizontal", "seismicVertical")
ALLOWED_MATERIAL_KEYS = {"name", "model"}
ALLOWED_MODEL_KEYS = {"kind", "unitWeight", "cohesion", "frictionAngle", "unitWeightSat", "ru"}
# Batch 1 (contract F3.2): `undrained` and `s-f-datum` are the same law, Su = max(0, su + (datum - y)·rate).
ALLOWED_UNDRAINED_KEYS = {"kind", "unitWeight", "undrainedShearStrength", "suRefDepth", "suRateOfChange", "suMax",
                          "unitWeightSat", "ru"}
ALLOWED_SFD_KEYS = {"kind", "unitWeight", "suRef", "yRef", "rate", "suMax", "unitWeightSat", "ru"}
ALLOWED_WATER_KEYS = {"mode", "value", "followBoundary"}
ALLOWED_LIMIT_KEYS = {"entryLeftX", "entryRightX", "exitLeftX", "exitRightX"}
NEUTRAL_OPTION_KEYS = {"method", "slices", "iterations", "refinedIterations", "tolerance"}
# Options that change the problem: their presence omits the whole case. The seismic coefficients are
# imported with schema v0.2.
CASE_OMIT_OPTION_PREFIXES = ("tensionCrack", "seismic", "partialFactors", "compositeBase")
CASE_OMIT_OPTION_PREFIXES_V02 = ("tensionCrack", "partialFactors", "compositeBase")
ORIENTATION = {"rtl": "right_to_left", "ltr": "left_to_right"}

ANALYSIS_DEFAULTS = {"tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2}
SEARCH_DEFAULTS = {
    "n_entry": 20, "n_exit": 20, "n_radius": 20, "max_radius_factor": 5.0,
    "min_width": None, "refine": True,
}
TOL_ABS = 1e-9
TOL_REL = 1e-9

# Sliding direction that the source leaves to `auto` but `auto` cannot resolve (contract §1, rule E1b).
# V063 (Huang & Jia dam): both crests sit at elevation 7.3 and entry == exit == [101.7, 185.6], so `auto`
# has no hint. Evidence, checked with cslope 0.1.0 on this search: the critical circle of cSlope lies on the
# right-hand face (centre ≈ (154.2, 76.6), r ≈ 69.4); with orientation ltr it gives Bishop 2.4528 and Spencer
# 2.4511, and with rtl it finds no valid slip surface.
# V077 (Prandtl, F3 batch 2): level ground and a polyline whose two ends are at the same elevation, so `auto` has
# no hint. cSlope's own rule (`infer_orientation_from_coordinates`, model/canonical.rs) takes `ltr` when both
# crests are equal; the mechanism is symmetric about x = 5 (checked with the oracle: ltr and rtl give the same FS).
# V026 (Duncan & Wright fig. 7.12, I-M): a symmetric embankment on clay (both toes at y = 50, crests at x = 300..400) with
# no search ranges, so `auto` has no hint. cSlope's rule takes `ltr` with equal crests; the critical circle that the
# source note gives, (500, 174), lies on the right-hand face, which is a mass moving toward +x (`ltr`); the search is
# symmetric, so ogs and cSlope give the same FS with `ltr` and with `rtl` (checked in the I-M run, see the note).
DIRECTION_OVERRIDES = {"V026": "left_to_right", "V063": "left_to_right", "V077": "left_to_right"}
DIRECTION_OVERRIDE_NOTES = {
    "V026": (
        "slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): terraplén simétrico sobre "
        "arcilla (ambos pies a y = 50) y sin rangos de búsqueda, así que auto no tiene pista; cSlope toma ltr con "
        "crestas iguales (infer_orientation_from_coordinates), el círculo crítico de Duncan & Wright, (500, 174) en el "
        "marco del modelo, está en la cara derecha (masa hacia +x) y, al ser la búsqueda simétrica, ogs y cSlope dan el "
        "mismo FS con ltr y con rtl."
    ),
    "V063": (
        "slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): auto no puede "
        "resolver el sentido en esta presa simétrica con entry == exit; la orientación ltr reproduce el "
        "círculo crítico de cSlope (centro ≈ (154.2, 76.6), r ≈ 69.4)."
    ),
    "V077": (
        "slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): terreno plano y una "
        "polilínea simétrica con los dos extremos a la misma cota, así que auto no tiene pista; cSlope toma ltr "
        "con crestas iguales (infer_orientation_from_coordinates) y el oráculo da el mismo FS con ltr y con rtl."
    ),
}

# ---------------------------------------------------------------- JSON Schema (sections 1 and 2 of the contracts)
POINT = {"type": "array", "items": {"type": "number"}, "minItems": 2, "maxItems": 2}
# F1.1: `loads` go after `water` and before `slope`; `q`, `p` >= 0 (cSlope's magnitudes are > 0 and come out that way).
UDL_SCHEMA = {
    "type": "object",
    "required": ["type", "x1", "x2", "q"],
    "additionalProperties": False,
    "properties": {
        "type": {"const": "udl"},
        "id": {"type": "string", "minLength": 1},
        "x1": {"type": "number"},
        "x2": {"type": "number"},
        "q": {"type": "number", "minimum": 0},
    },
}
LINE_LOAD_SCHEMA = {
    "type": "object",
    "required": ["type", "x", "p", "angle"],
    "additionalProperties": False,
    "properties": {
        "type": {"const": "line"},
        "id": {"type": "string", "minLength": 1},
        "x": {"type": "number"},
        "p": {"type": "number", "minimum": 0},
        "angle": {"type": "number", "minimum": -90, "maximum": 90},
    },
}
SEISMIC_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "kh": {"type": "number", "minimum": 0, "exclusiveMaximum": 1},
        "kv": {"type": "number", "exclusiveMinimum": -1, "exclusiveMaximum": 1},
    },
}
POLYLINE_SURFACE_SCHEMA = {
    "type": "object",
    "required": ["type", "points"],
    "additionalProperties": False,
    "properties": {
        "type": {"const": "polyline"},
        "points": {"type": "array", "minItems": 2, "items": POINT},
    },
}
INTERSLICE_SCHEMA = {
    "type": "object",
    "required": ["function"],
    "additionalProperties": False,
    "properties": {
        "function": {"enum": ["constant", "half_sine", "clipped_sine", "trapezoidal", "data_points"]},
        "points": {"type": "array", "minItems": 2, "items": POINT},
    },
}
MC_MATERIAL_SCHEMA = {
    "type": "object",
    "required": ["id", "name", "model", "unit_weight", "unit_weight_sat", "cohesion", "friction_angle", "ru"],
    "additionalProperties": False,
    "properties": {
        "id": {"type": "string", "pattern": "^[a-z0-9_]+$"},
        "name": {"type": "string"},
        "model": {"const": "mohr_coulomb"},
        "unit_weight": {"type": "number", "exclusiveMinimum": 0},
        "unit_weight_sat": {"type": ["number", "null"], "exclusiveMinimum": 0},
        "cohesion": {"type": "number", "minimum": 0},
        "friction_angle": {"type": "number", "minimum": 0, "exclusiveMaximum": 90},
        "ru": {"type": ["number", "null"], "minimum": 0, "exclusiveMaximum": 1},
    },
}
# F3.2: no cohesion or friction angle; the strength datum and gradient go together; the limit needs a gradient.
UNDRAINED_MATERIAL_SCHEMA = {
    "type": "object",
    "required": ["id", "name", "model", "unit_weight", "unit_weight_sat", "undrained_strength", "ru"],
    "additionalProperties": False,
    "dependentRequired": {"strength_datum": ["strength_gradient"], "strength_gradient": ["strength_datum"],
                          "strength_limit": ["strength_gradient"]},
    "properties": {
        "id": {"type": "string", "pattern": "^[a-z0-9_]+$"},
        "name": {"type": "string"},
        "model": {"const": "undrained"},
        "unit_weight": {"type": "number", "exclusiveMinimum": 0},
        "unit_weight_sat": {"type": ["number", "null"], "exclusiveMinimum": 0},
        "undrained_strength": {"type": "number", "minimum": 0},
        "strength_datum": {"type": "number"},
        "strength_gradient": {"type": "number"},
        "strength_limit": {"type": "number", "minimum": 0},
        "ru": {"type": ["number", "null"], "minimum": 0, "exclusiveMaximum": 1},
    },
}
MODEL_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["format", "version", "meta", "units", "materials", "regions", "slope", "analysis"],
    "additionalProperties": False,
    "allOf": [
        # `loads` and `analysis.seismic` exist only from v0.2 (F1.1); the engine rejects them with version "0.1".
        {"if": {"properties": {"version": {"const": "0.1"}}},
         "then": {"properties": {"loads": False, "analysis": {"properties": {"seismic": False}}}}},
        # F3.1: every v0.3 variant needs version "0.3".
        {"if": {"properties": {"version": {"enum": ["0.1", "0.2"]}}},
         "then": {"properties": {
             "materials": {"items": {"properties": {"model": {"const": "mohr_coulomb"}}}},
             "analysis": {"properties": {
                 "interslice": False,
                 "methods": {"items": {"enum": ["bishop", "spencer"]}},
                 "surface": {"properties": {"type": {"const": "circle"}}},
             }},
         }}},
    ],
    "properties": {
        "format": {"const": "opengeoslide"},
        "version": {"enum": ["0.1", "0.2", "0.3"]},
        "meta": {
            "type": "object",
            "required": ["id"],
            "additionalProperties": False,
            "properties": {
                "id": {"type": "string", "minLength": 1},
                "title": {"type": "string"},
                "notes": {"type": "string"},
            },
        },
        "units": {"enum": ["SI", "imperial"]},
        "materials": {
            "type": "array", "minItems": 1,
            "items": {"oneOf": [MC_MATERIAL_SCHEMA, UNDRAINED_MATERIAL_SCHEMA]},
        },
        "regions": {
            "type": "array", "minItems": 1,
            "items": {
                "type": "object",
                "required": ["material", "polygon"],
                "additionalProperties": False,
                "properties": {
                    "material": {"type": "string"},
                    "polygon": {"type": "array", "minItems": 3, "items": POINT},
                },
            },
        },
        "water": {
            "type": "object",
            "required": ["unit_weight", "piezometric_line"],
            "additionalProperties": False,
            "properties": {
                "unit_weight": {"type": "number", "exclusiveMinimum": 0},
                "piezometric_line": {"type": "array", "minItems": 2, "items": POINT},
            },
        },
        "loads": {
            "type": "array",
            "items": {"oneOf": [UDL_SCHEMA, LINE_LOAD_SCHEMA]},
        },
        "slope": {
            "type": "object",
            "required": ["direction"],
            "additionalProperties": False,
            "properties": {"direction": {"enum": ["auto", "left_to_right", "right_to_left"]}},
        },
        "analysis": {
            "type": "object",
            "required": ["methods", "slices", "tolerance", "max_iterations", "min_m_alpha"],
            "oneOf": [{"required": ["surface"]}, {"required": ["search"]}],
            "additionalProperties": False,
            "properties": {
                "methods": {
                    "type": "array", "minItems": 1, "uniqueItems": True,
                    "items": {"enum": list(F3_METHOD_ORDER)},
                },
                "interslice": INTERSLICE_SCHEMA,
                "slices": {"type": "integer", "minimum": 3, "maximum": 2000},
                "tolerance": {"type": "number", "exclusiveMinimum": 0, "maximum": 0.01},
                "max_iterations": {"type": "integer", "minimum": 1, "maximum": 100000},
                "min_m_alpha": {"type": "number", "exclusiveMinimum": 0, "maximum": 1},
                "seismic": SEISMIC_SCHEMA,
                "surface": {"oneOf": [{
                    "type": "object",
                    "required": ["type", "xc", "yc", "r"],
                    "additionalProperties": False,
                    "properties": {
                        "type": {"const": "circle"},
                        "xc": {"type": "number"},
                        "yc": {"type": "number"},
                        "r": {"type": "number", "exclusiveMinimum": 0},
                    },
                }, POLYLINE_SURFACE_SCHEMA]},
                "search": {
                    "type": "object",
                    "required": ["type", "n_entry", "n_exit", "n_radius", "max_radius_factor", "refine"],
                    "additionalProperties": False,
                    "properties": {
                        "type": {"const": "circular_entry_exit"},
                        "entry": {"type": "array", "minItems": 2, "maxItems": 2, "items": {"type": "number"}},
                        "exit": {"type": "array", "minItems": 2, "maxItems": 2, "items": {"type": "number"}},
                        "n_entry": {"type": "integer", "minimum": 1, "maximum": 200},
                        "n_exit": {"type": "integer", "minimum": 1, "maximum": 200},
                        "n_radius": {"type": "integer", "minimum": 1, "maximum": 200},
                        "max_radius_factor": {"type": "number", "exclusiveMinimum": 0.51},
                        "min_width": {"type": ["number", "null"], "minimum": 0},
                        "refine": {"type": "boolean"},
                    },
                },
            },
        },
    },
}
CASE_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["id", "title", "model", "checks", "source"],
    "additionalProperties": False,
    "properties": {
        "id": {"type": "string", "minLength": 1},
        "title": {"type": "string", "minLength": 1},
        "model": MODEL_SCHEMA,
        "checks": {
            "type": "array", "minItems": 1,
            "items": {
                "type": "object",
                "required": ["method", "kind", "published", "published_by", "tolerance", "options"],
                "additionalProperties": False,
                "properties": {
                    "method": {"enum": list(F3_METHOD_ORDER)},
                    "kind": {"enum": ["fixed", "search"]},
                    "published": {"type": "number", "exclusiveMinimum": 0},
                    "published_by": {"type": "string", "minLength": 1},
                    "tolerance": {"type": "number", "exclusiveMinimum": 0},
                    "options": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {"slices": {"type": "integer", "minimum": 3, "maximum": 2000}},
                    },
                },
            },
        },
        "source": {
            "type": "object",
            "required": ["reference", "derived_from", "notes"],
            "additionalProperties": False,
            "properties": {
                "reference": {"type": "string", "minLength": 1},
                "derived_from": {"type": "string", "minLength": 1},
                "notes": {"type": "array", "items": {"type": "string"}},
            },
        },
    },
}


# ---------------------------------------------------------------- helpers
def num(x: float) -> float:
    """Round to 1e-9 and normalise -0.0."""
    return round(float(x), 9) + 0.0


def snake(name: str) -> str:
    return re.sub(r"[^0-9A-Za-z]+", "_", name).strip("_").lower()


def parse_problems(path: Path) -> dict[str, dict]:
    """Extract reference, units, title, description and notes per id from problems.ts (TypeScript literals)."""
    text = path.read_text(encoding="utf-8")
    out: dict[str, dict] = {}
    for chunk in re.split(r'\n  \{\n    id: "', text)[1:]:
        cid = chunk.split('"', 1)[0]
        rec: dict = {"id": cid}
        for key in ("title", "reference", "units", "description"):
            m = re.search(rf'\n    {key}: ("(?:[^"\\]|\\.)*"),?\n', chunk)
            rec[key] = json.loads(m.group(1)) if m else None
        m = re.search(r"\n    notes: \[\n(.*?)\n    \],", chunk, re.S)
        rec["notes"] = [json.loads(s) for s in re.findall(r'"(?:[^"\\]|\\.)*"', m.group(1))] if m else []
        out[cid] = rec
    return out


def ground_top(outer: Polygon, x: float):
    """Upper envelope y_top(x) of the outline at x (None if x is outside)."""
    miny, maxy = outer.bounds[1], outer.bounds[3]
    inter = LineString([(x, miny - 1.0), (x, maxy + 1.0)]).intersection(outer.boundary)
    if inter.is_empty:
        return None
    return inter.bounds[3]


def piezo_y(points: list[list[float]], x: float) -> float:
    """Piecewise-linear piezometric line with constant extrapolation (contract section 1).

    ``points`` must have strictly increasing x (checked by ``convert``).
    """
    pts = sorted(points, key=lambda p: p[0])
    if x <= pts[0][0]:
        return pts[0][1]
    if x >= pts[-1][0]:
        return pts[-1][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            if x1 == x0:
                return max(y0, y1)
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    raise AssertionError("unreachable")


def water_above_ground(outer: Polygon, piezo: list[list[float]]) -> bool:
    """True if the piezometric line is above the ground anywhere in the model (contract §1, R2-07).

    The ground and the line are piecewise linear with breakpoints at the outline's vertex x's and at
    the piezometric x's, so between two consecutive breakpoints their difference is linear. Its
    supremum on the open interval is therefore at one end, taken as the limit from inside (this covers
    vertical steps from both sides). The midpoint of each interval is also checked explicitly.
    """
    minx, _, maxx, _ = outer.bounds
    xs = sorted({x for x, _ in outer.exterior.coords} | {x for x, _ in piezo} | {minx, maxx})
    xs = [x for x in xs if minx <= x <= maxx]

    def excess(x: float) -> float | None:
        top = ground_top(outer, x)
        return None if top is None else piezo_y(piezo, x) - top

    for x0, x1 in zip(xs, xs[1:]):
        if not x1 - x0 > 0:
            continue
        p, q = x0 + (x1 - x0) / 3.0, x0 + 2.0 * (x1 - x0) / 3.0   # interior: on the linear pieces
        dp, dq = excess(p), excess(q)
        mid = excess(0.5 * (x0 + x1))
        if dp is None or dq is None or mid is None:
            continue
        slope = (dq - dp) / (q - p)
        at_left, at_right = dp + slope * (x0 - p), dp + slope * (x1 - p)
        if max(at_left, at_right, mid) > TOL_ABS:
            return True
    return False


def option_reason(method: str, opts: dict, v02: bool = False, f3: bool = False) -> str | None:
    """Return why a check cannot be used with our engine, or None if its options are neutral.

    With ``v02`` the seismic coefficients are not an obstacle: they go to ``analysis.seismic``. With ``f3``
    the interslice function, its data points and the Janbu correction are not an obstacle either: they
    become the method (``janbu_simplified`` / ``janbu_corrected``) and ``analysis.interslice``.
    """
    if opts.get("nonCircularOptimization"):
        return "superficie no circular (nonCircularOptimization)"
    for key, value in opts.items():
        if key in NEUTRAL_OPTION_KEYS:
            continue
        if (v02 or f3) and key in SEISMIC_OPTION_KEYS:
            continue
        if key == "porePressureHead" and value == "vertical":
            continue
        if key == "intersliceFunction" and value == "constant" and method == "Morgenstern-Price":
            continue
        if f3 and method == "Morgenstern-Price" and key in ("intersliceFunction", "intersliceDataPoints"):
            continue
        if f3 and method == "Janbu" and key == "janbuCorrection" and isinstance(value, bool):
            continue
        if key == "compositeSurfaces" and value is False:
            continue
        return f"opción {key}={value!r}"
    return None


def interslice_points_reason(points) -> str | None:
    """Contract F3.4 for `data_points`: >= 2 points, xi strictly increasing from 0 to 1, f >= 0, max f > 0."""
    try:
        pts = [(float(x), float(f)) for x, f in points]
    except (TypeError, ValueError):
        return "intersliceDataPoints mal formado"
    if len(pts) < 2:
        return "intersliceDataPoints con menos de 2 puntos"
    if pts[0][0] != 0.0 or pts[-1][0] != 1.0:
        return "intersliceDataPoints no empieza en 0 y termina en 1"
    if any(b[0] <= a[0] for a, b in zip(pts, pts[1:])):
        return "intersliceDataPoints con x no estrictamente creciente"
    if any(f < 0 for _, f in pts) or not max(f for _, f in pts) > 0:
        return "intersliceDataPoints con f negativa o idénticamente nula"
    return None


def f3_method(ck: dict) -> tuple[str | None, dict | None, str | None]:
    """cSlope check -> (ogs method, interslice or None, reason). Mapping of contract F3.8 (and F3.4, F3.5).

    Morgenstern-Price with ``constant`` is Spencer (as in batch 0). Without ``intersliceFunction`` cSlope uses
    ``half-sine``, which is also the default of ``morgenstern_price`` (no ``interslice`` is written).
    Janbu is simplified unless ``janbuCorrection`` is true.
    """
    opts = ck.get("options", {})
    if ck["method"] == "Bishop":
        return "bishop", None, None
    if ck["method"] == "Janbu":
        return ("janbu_corrected" if opts.get("janbuCorrection") else "janbu_simplified"), None, None
    if ck["method"] != "Morgenstern-Price":
        return None, None, "método no soportado"
    fn = opts.get("intersliceFunction") or "half-sine"
    if fn not in INTERSLICE_FUNCTIONS:
        return None, None, f"función interslice {fn!r} desconocida"
    if fn == "constant":
        return "spencer", None, None
    if fn == "half-sine":
        return "morgenstern_price", None, None
    interslice = {"function": INTERSLICE_FUNCTIONS[fn]}
    if fn == "data-point-specified":
        why = interslice_points_reason(opts.get("intersliceDataPoints") or [])
        if why:
            return None, None, why
        interslice["points"] = [[num(x), num(f)] for x, f in opts["intersliceDataPoints"]]
    return "morgenstern_price", interslice, None


# ---------------------------------------------------------------- conversion
class Omit(Exception):
    """Raised to omit a case; the message is the reason recorded in INDEX.md."""


def has_v02_features(raw: dict) -> bool:
    """True if the cSlope problem has loads or seismic coefficients (the v0.2 schema)."""
    d = raw["definition"]
    if d.get("udls") or d.get("lineLoads"):
        return True
    return any(float(ck.get("options", {}).get(k) or 0.0) != 0.0
               for ck in raw["checks"] for k in SEISMIC_OPTION_KEYS)


def convert_loads(d: dict, x_min: float, x_max: float) -> list[dict]:
    """cSlope ``udls`` and ``lineLoads`` -> ogs ``loads`` (F1.1). Raises Omit if one cannot be expressed.

    The angle of a line load is copied unchanged: cSlope measures it from the downward vertical, positive
    towards +x of the model, for ltr and rtl alike (verified with the oracle, see to_cslope.py).
    """
    loads: list[dict] = []
    for i, u in enumerate(d.get("udls") or []):
        extra = sorted(set(u) - ALLOWED_UDL_KEYS)
        if extra:
            raise Omit("udl con propiedad no soportada: " + ", ".join(extra))
        if u.get("direction", "vertical") != "vertical":
            raise Omit(f"udl con direction {u['direction']!r} (solo vertical)")
        x1, x2, q = float(u["x1"]), float(u["x2"]), float(u["magnitude"])
        if not x1 < x2:
            raise Omit(f"udl {i + 1} con x1 >= x2")
        if x1 < x_min - TOL_ABS or x2 > x_max + TOL_ABS:
            raise Omit(f"udl {i + 1} fuera del rango x del modelo [{x_min:g}, {x_max:g}]")
        if not q > 0:
            raise Omit(f"udl {i + 1} con magnitud no positiva")
        loads.append({"type": "udl", "id": f"u{i + 1}", "x1": num(x1), "x2": num(x2), "q": num(q)})
    for i, ll in enumerate(d.get("lineLoads") or []):
        extra = sorted(set(ll) - ALLOWED_LINE_LOAD_KEYS)
        if extra:
            raise Omit("carga lineal con propiedad no soportada: " + ", ".join(extra))
        x, p, angle = float(ll["x"]), float(ll["magnitude"]), float(ll.get("angle", 0.0))
        if x < x_min - TOL_ABS or x > x_max + TOL_ABS:
            raise Omit(f"carga lineal {i + 1} fuera del rango x del modelo [{x_min:g}, {x_max:g}]")
        if not p > 0:
            raise Omit(f"carga lineal {i + 1} con magnitud no positiva")
        if not -90.0 <= angle <= 90.0:
            raise Omit(f"carga lineal {i + 1} con ángulo fuera de [-90, 90]")
        loads.append({"type": "line", "id": f"l{i + 1}", "x": num(x), "p": num(p), "angle": num(angle)})
    return loads


def convert_strength_material(m: dict, mid: str) -> dict:
    """cSlope `undrained` / `s-f-datum` material -> ogs `undrained` (contract F3.2). Raises Omit.

    Both kinds are the same law, Su = max(0, su + (datum - y)·rate) with `datum` an elevation:
    undrained: su = undrainedShearStrength, datum = suRefDepth, rate = suRateOfChange, limit = suMax;
    s-f-datum: su = suRef, datum = yRef, rate = rate, limit = suMax (types/strength.rs in cSlope).
    """
    model = m["model"]
    kind = model["kind"]
    name = m["name"]
    allowed = ALLOWED_UNDRAINED_KEYS if kind == "undrained" else ALLOWED_SFD_KEYS
    if set(model) - allowed:
        raise Omit(f"material '{name}' con propiedad no soportada: " + ", ".join(sorted(set(model) - allowed)))
    if kind == "undrained":
        su, datum = model["undrainedShearStrength"], model.get("suRefDepth")
        rate = model.get("suRateOfChange")
    else:
        su, datum, rate = model["suRef"], model["yRef"], model["rate"]
    limit = model.get("suMax")
    if (datum is None) != (rate is None):
        raise Omit(f"material '{name}': suRefDepth y suRateOfChange deben ir juntos (F3.2)")
    if limit is not None and rate is None:
        raise Omit(f"material '{name}': suMax sin gradiente (F3.2)")
    if not float(su) >= 0 or (limit is not None and not float(limit) >= 0):
        raise Omit(f"material '{name}': resistencia no drenada negativa")
    out = {
        "id": mid,
        "name": name,
        "model": "undrained",
        "unit_weight": num(model["unitWeight"]),
        "unit_weight_sat": num(model["unitWeightSat"]) if model.get("unitWeightSat") is not None else None,
        "undrained_strength": num(su),
    }
    if rate is not None:
        out["strength_datum"] = num(datum)
        out["strength_gradient"] = num(rate)
        if limit is not None:
            out["strength_limit"] = num(limit)
    out["ru"] = num(model["ru"]) if model.get("ru") is not None else None
    return out


def convert(raw: dict, prob: dict | None, v02: bool = False) -> tuple[dict, list[str]]:
    """Convert one cSlope case for batch 0. Returns (case, discarded_checks). Raises Omit.

    With ``v02`` the case may have ``udls``, ``lineLoads`` and seismic coefficients, and the model
    is written with ``version "0.2"`` (``loads`` after ``water``, ``analysis.seismic``). Otherwise those
    features omit the case, as in schema v0.1.
    """
    case, discarded, _ = _convert(raw, prob, v02=v02, f3=False)
    return case, discarded


def convert_f3(raw: dict, prob: dict | None) -> tuple[dict, list[str], list[int]]:
    """Convert one cSlope case for the target state of batches 0, 1 and 2 (v0.3 model).

    Returns (case, discarded_checks, batches) where ``batches[i]`` is the batch (0, 1 or 2) of ``case["checks"][i]``.
    The case keeps every convertible check, batch 0 included, so that promoting it replaces the file in cases/.
    """
    return _convert(raw, prob, v02=True, f3=True)


def _convert(raw: dict, prob: dict | None, v02: bool, f3: bool) -> tuple[dict, list[str], list[int]]:
    cid = raw["id"]
    if prob is None:
        raise Omit("sin entrada en problems.ts")
    if not prob.get("reference"):
        raise Omit("sin referencia en problems.ts")
    units = prob.get("units")
    if units not in GAMMA_W:
        raise Omit(f"unidades no soportadas: {units!r}")
    surface_kind = raw["surface"]
    if surface_kind not in ("fixed", "search"):
        raise Omit(f"superficie desconocida: {surface_kind!r}")

    d = raw["definition"]
    extra = sorted(set(d) - ALLOWED_DEFINITION_KEYS - (V02_DEFINITION_KEYS if v02 else set())
                   - ({"customSurfaces"} if f3 else set()))
    if extra:
        raise Omit("definition con clave que cambia el problema: " + ", ".join(extra))

    omit_prefixes = CASE_OMIT_OPTION_PREFIXES_V02 if v02 else CASE_OMIT_OPTION_PREFIXES
    for ck in raw["checks"]:
        for key in ck.get("options", {}):
            if key.startswith(omit_prefixes):
                raise Omit(f"opción de check que cambia el problema: {key}")

    # materials
    materials, name2id = [], {}
    for m in d["materials"]:
        if set(m) - ALLOWED_MATERIAL_KEYS:
            raise Omit(f"material '{m.get('name')}' con propiedad no soportada: " + ", ".join(sorted(set(m) - ALLOWED_MATERIAL_KEYS)))
        model = m["model"]
        kind = model.get("kind")
        mid = snake(m["name"])
        if kind in ("undrained", "s-f-datum") and f3:
            if not mid or mid in name2id.values():
                raise Omit(f"id de material vacío o repetido: '{m['name']}'")
            name2id[m["name"]] = mid
            materials.append(convert_strength_material(m, mid))
            continue
        if kind != "mohr-coulomb":
            raise Omit(f"material '{m['name']}' con modelo {kind!r}")
        if set(model) - ALLOWED_MODEL_KEYS:
            raise Omit(f"material '{m['name']}' con propiedad no soportada: " + ", ".join(sorted(set(model) - ALLOWED_MODEL_KEYS)))
        if not mid or mid in name2id.values():
            raise Omit(f"id de material vacío o repetido: '{m['name']}'")
        name2id[m["name"]] = mid
        materials.append({
            "id": mid,
            "name": m["name"],
            "model": "mohr_coulomb",
            "unit_weight": num(model["unitWeight"]),
            "unit_weight_sat": num(model["unitWeightSat"]) if model.get("unitWeightSat") is not None else None,
            "cohesion": num(model["cohesion"]),
            "friction_angle": num(model["frictionAngle"]),
            "ru": num(model["ru"]) if model.get("ru") is not None else None,
        })
    has_undrained = any(m["model"] == "undrained" for m in materials)

    # geometry
    coords = d["coordinates"]
    outer = Polygon(coords)
    if not outer.is_valid:
        raise Omit(f"contorno no válido ({explain_validity(outer)})")
    # water
    water = None
    wt = d.get("waterTable")
    if wt is not None:
        if set(wt) - ALLOWED_WATER_KEYS:
            raise Omit("waterTable con clave no soportada: " + ", ".join(sorted(set(wt) - ALLOWED_WATER_KEYS)))
        if wt.get("mode") != "custom":
            raise Omit(f"waterTable modo {wt.get('mode')!r}")
        if wt.get("followBoundary"):
            raise Omit("waterTable followBoundary=true")
        if len(wt["value"]) < 2:
            raise Omit("piezométrica con menos de 2 puntos")
        xs_raw = [float(x) for x, _ in wt["value"]]
        if any(b <= a for a, b in zip(xs_raw, xs_raw[1:])):
            raise Omit("piezométrica con x no estrictamente creciente (ogs-core exige x creciente)")
        piezo = [[num(x), num(y)] for x, y in wt["value"]]
        if water_above_ground(outer, piezo):
            raise Omit("piezométrica sobre el terreno (agua embalsada)")
        water = {"unit_weight": GAMMA_W[units], "piezometric_line": piezo}

    # faces (after water: a reservoir is the blocker that matters for the report)
    boundary_lines = [LineString(b["coordinates"]) for b in (d.get("materialBoundaries") or [])]
    closed = LineString(list(coords) + [coords[0]])
    merged = unary_union([closed] + boundary_lines)
    parts = list(getattr(merged, "geoms", [merged]))
    faces = [f for f in polygonize(parts) if outer.contains(f.representative_point())]
    if abs(sum(f.area for f in faces) - outer.area) > TOL_REL * outer.area:
        raise Omit("las caras no cubren el contorno")
    assignments = d["regionAssignments"]
    for a in assignments:
        if a["materialName"] not in name2id:
            raise Omit(f"regionAssignments con material desconocido: '{a['materialName']}'")
    regions = []
    for f in faces:
        if f.interiors:
            raise Omit("cara con huecos")
        mats = {name2id[a["materialName"]] for a in assignments if f.contains(Point(a["point"]))}
        if not mats:
            c = f.representative_point()
            on_edge = [a["materialName"] for a in assignments if f.boundary.distance(Point(a["point"])) <= TOL_ABS]
            why = (f"un punto de regionAssignments ({', '.join(on_edge)}) está sobre el borde de la cara"
                   if on_edge else "ninguna regionAssignments la cubre")
            raise Omit(f"cara sin material asignado en ({c.x:.4g}, {c.y:.4g}): {why}")
        if len(mats) > 1:
            raise Omit("cara con materiales en conflicto: " + ", ".join(sorted(mats)))
        ring = [[num(x), num(y)] for x, y in list(f.exterior.coords)[:-1]]
        regions.append({"material": mats.pop(), "polygon": ring})
    regions.sort(key=lambda r: (r["material"], r["polygon"][0]))

    # direction
    orientation = d.get("orientation")
    overridden = orientation is None and cid in DIRECTION_OVERRIDES
    if orientation is None:
        direction = DIRECTION_OVERRIDES.get(cid, "auto")
    elif orientation in ORIENTATION:
        direction = ORIENTATION[orientation]
    else:
        raise Omit(f"orientación desconocida: {orientation!r}")

    # analysis surface
    analysis = {}
    limit_notes: list[str] = []
    polyline = False
    if surface_kind == "fixed":
        planes = d.get("customSearchPlanes") or []
        custom = d.get("customSurfaces") or []
        if d.get("customPlanesOnly") is not True:
            raise Omit("superficie fija sin customPlanesOnly")
        if custom and not planes:
            if len(custom) != 1 or set(custom[0]) - {"points"}:
                raise Omit("superficie fija que no es una única polilínea sin eje")
            pts = [[num(x), num(y)] for x, y in custom[0]["points"]]
            if len(pts) < 2 or any(b[0] <= a[0] for a, b in zip(pts, pts[1:])):
                raise Omit("polilínea con x no estrictamente creciente o con menos de 2 puntos")
            analysis["surface"] = {"type": "polyline", "points": pts}
            polyline = True
        elif len(planes) != 1 or custom:
            raise Omit("superficie fija que no es un único círculo con customPlanesOnly")
        else:
            p = planes[0]
            analysis["surface"] = {"type": "circle", "xc": num(p["cx"]), "yc": num(p["cy"]), "r": num(p["radius"])}
    else:
        if d.get("customPlanesOnly") or d.get("customSearchPlanes") or d.get("customSurfaces"):
            raise Omit("búsqueda restringida a círculos propios")
        search: dict = {"type": "circular_entry_exit"}
        limits = d.get("analysisLimits")
        if limits is not None:
            if set(limits) - ALLOWED_LIMIT_KEYS:
                raise Omit("analysisLimits con clave no soportada")
            for name, lo, hi in (("entry", limits["entryLeftX"], limits["entryRightX"]),
                                 ("exit", limits["exitLeftX"], limits["exitRightX"])):
                if lo > hi:
                    # cSlope's `mirror_range` (model/canonical.rs) takes min and max when it mirrors an rtl model
                    limit_notes.append(
                        f"analysisLimits.{name} viene con left > right ({lo:g} > {hi:g}) en la fuente; se escribe "
                        f"[{hi:g}, {lo:g}] (cSlope toma min y max al espejar la orientación rtl).")
                    lo, hi = hi, lo
                search[name] = [num(lo), num(hi)]
        search.update(SEARCH_DEFAULTS)
        analysis["search"] = search

    # checks
    case_batch = 2 if polyline else (1 if has_undrained else 0)
    checks, discarded, kept_raw, batches, interslices = [], [], [], [], []
    for ck in raw["checks"]:
        opts = ck.get("options", {})
        label = f"{ck['method']} ({ck.get('label')}, {ck['publishedBy']}, {ck['published']})"
        interslice = None
        if f3:
            method, interslice, why = f3_method(ck)
            if why:
                discarded.append(f"{label}: {why}")
                continue
            if method == "bishop" and polyline:
                discarded.append(f"{label}: Bishop no admite superficies polilínea (contrato F3.6)")
                continue
        elif ck["method"] == "Bishop":
            method = "bishop"
        elif ck["method"] == "Morgenstern-Price" and opts.get("intersliceFunction") == "constant":
            method = "spencer"
        else:
            discarded.append(f"{label}: método no soportado")
            continue
        reason = option_reason(ck["method"], opts, v02, f3)
        if reason:
            discarded.append(f"{label}: {reason}")
            continue
        check_opts = {}
        if "slices" in opts:
            check_opts["slices"] = int(opts["slices"])
        checks.append({
            "method": method,
            "kind": surface_kind,
            "published": ck["published"],
            "published_by": ck["publishedBy"],
            "tolerance": ck["tolerance"],
            "options": check_opts,
        })
        kept_raw.append(ck)
        interslices.append(interslice)
        batches.append(max(case_batch, 2 if method in ("morgenstern_price", "janbu_simplified", "janbu_corrected") else 0))
    if not checks:
        raise Omit("sin checks válidos")

    # Morgenstern-Price: one interslice function per model (contract F3.4). Checks with another one are discarded.
    interslice_model = None
    mp_functions = [(i, json.dumps(f, sort_keys=True)) for i, f in enumerate(interslices) if checks[i]["method"] == "morgenstern_price"]
    if mp_functions:
        first = mp_functions[0][1]
        drop = [i for i, f in mp_functions if f != first]
        for i in sorted(drop, reverse=True):
            ck = kept_raw[i]
            discarded.append(f"{ck['method']} ({ck.get('label')}, {ck['publishedBy']}, {ck['published']}): "
                             "otra función interslice que la del primer check del caso (un modelo, una función)")
            for lst in (checks, kept_raw, batches, interslices):
                del lst[i]
        interslice_model = next(f for i, f in enumerate(interslices) if checks[i]["method"] == "morgenstern_price")

    # seismic coefficients: one pair for the model, shared by every check kept (v0.2 only)
    seismic = None
    if v02:
        pairs = {(float(ck["options"].get("seismicHorizontal") or 0.0),
                  float(ck["options"].get("seismicVertical") or 0.0)) for ck in kept_raw}
        if len(pairs) > 1:
            raise Omit("checks con coeficientes sísmicos distintos: "
                       + ", ".join(f"kh={kh:g} kv={kv:g}" for kh, kv in sorted(pairs)))
        kh, kv = pairs.pop()
        if not 0.0 <= kh < 1.0:
            raise Omit(f"kh = {kh:g} fuera de [0, 1) (contrato F1.1)")
        if not -1.0 < kv < 1.0:
            raise Omit(f"kv = {kv:g} fuera de (-1, 1) (contrato F1.1)")
        if kh != 0.0 or kv != 0.0:
            seismic = {"kh": num(kh), "kv": num(kv)}
    loads: list[dict] = []
    if v02:
        xs = [float(x) for x, _ in coords]
        loads = convert_loads(d, min(xs), max(xs))
        if not loads and seismic is None and not f3:
            raise Omit("sin cargas ni coeficientes sísmicos (corresponde a verification/cases)")

    methods = [m for m in F3_METHOD_ORDER if any(c["method"] == m for c in checks)]
    slice_values = {c["options"].get("slices", 50) for c in checks}
    slices = slice_values.pop() if len(slice_values) == 1 else 50
    analysis_block = {"methods": methods,
                      **({"interslice": interslice_model} if interslice_model is not None else {}),
                      "slices": slices, **ANALYSIS_DEFAULTS,
                      **({"seismic": seismic} if seismic is not None else {}), **analysis}

    if f3:
        version = F3_VERSION
    else:
        version = "0.2" if v02 else "0.1"
    model = {
        "format": "opengeoslide",
        "version": version,
        "meta": {"id": cid, "title": raw["title"], "notes": prob.get("description") or ""},
        "units": units,
        "materials": materials,
        "regions": regions,
    }
    if water is not None:
        model["water"] = water
    if loads:
        model["loads"] = loads
    model["slope"] = {"direction": direction}
    model["analysis"] = analysis_block

    # cSlope's per-check solver tolerance is not imported (ogs has one analysis.tolerance); record it.
    solver_tols = sorted({float(ck["options"]["tolerance"]) for ck in raw["checks"]
                          if "tolerance" in ck.get("options", {})})
    solver_notes = []
    if solver_tols:
        solver_notes.append(
            "cSlope fija options.tolerance = " + ", ".join(f"{t:g}" for t in solver_tols)
            + " (tolerancia del solver) en sus checks; no se importa: ogs usa analysis.tolerance = "
            + f"{ANALYSIS_DEFAULTS['tolerance']:g}."
        )

    case = {
        "id": cid,
        "title": raw["title"],
        "model": model,
        "checks": checks,
        "source": {
            "reference": prob["reference"],
            "derived_from": f"cSlope verification problem {cid} (MIT License), https://github.com/ZilanCiftci/cslope",
            "notes": prob.get("notes", []) + solver_notes + limit_notes
            + ([DIRECTION_OVERRIDE_NOTES[cid]] if overridden else []),
        },
    }
    return case, discarded, batches


# ---------------------------------------------------------------- gates
def gate_schema(case: dict) -> list[str]:
    errors = [f"{e.json_path}: {e.message}" for e in jsonschema.Draft202012Validator(CASE_SCHEMA).iter_errors(case)]
    m = case.get("model") or {}
    analysis = m.get("analysis") or {}
    if (m.get("meta") or {}).get("id") != case.get("id"):
        errors.append("meta.id distinto de id")
    if case.get("checks") and {c.get("kind") for c in case["checks"]} != {"fixed" if "surface" in analysis else "search"}:
        errors.append("kind de los checks no coincide con el tipo de análisis")
    used = {c.get("method") for c in case.get("checks") or []}
    if not used <= set(analysis.get("methods") or []):
        errors.append("methods no cubre los checks")
    return errors


def gate_search(case: dict) -> list[str]:
    """Contract §4.5 rules that JSON Schema cannot express: range order, extent and grid size."""
    errors = []
    m = case.get("model") or {}
    search = (m.get("analysis") or {}).get("search")
    if not search:
        return errors
    xs = [x for r in m.get("regions", []) for x, _ in r["polygon"]]
    minx, maxx = min(xs), max(xs)
    for name in ("entry", "exit"):
        rng = search.get(name)
        if rng is None:
            continue
        if rng[0] > rng[1]:
            errors.append(f"search.{name}: lo > hi")
        if rng[0] < minx or rng[1] > maxx:
            errors.append(f"search.{name} fuera de la extensión del modelo [{minx}, {maxx}]")
    candidates = search["n_entry"] * search["n_exit"] * search["n_radius"]
    if candidates > 2_000_000:
        errors.append(f"grilla de búsqueda con {candidates} candidatos (máximo 2000000)")
    return errors


def gate_loads(case: dict) -> list[str]:
    """F1.1 rules that JSON Schema cannot express: version, ranges in x, order, unique ids."""
    errors = []
    m = case.get("model") or {}
    loads = m.get("loads") or []
    seismic = (m.get("analysis") or {}).get("seismic")
    if (loads or seismic) and m.get("version") not in ("0.2", F3_VERSION):
        errors.append('loads y analysis.seismic requieren version "0.2"')
    xs = [x for r in m.get("regions", []) for x, _ in r["polygon"]]
    ids = [load["id"] for load in loads if "id" in load]
    if len(set(ids)) != len(ids):
        errors.append("ids de carga repetidos")
    for load in loads:
        ends = [load["x1"], load["x2"]] if load["type"] == "udl" else [load["x"]]
        if load["type"] == "udl" and not load["x1"] < load["x2"]:
            errors.append(f"carga {load.get('id')}: x1 >= x2")
        if xs and (min(ends) < min(xs) - TOL_ABS or max(ends) > max(xs) + TOL_ABS):
            errors.append(f"carga {load.get('id')} fuera del rango x del modelo")
    return errors


def gate_features(case: dict) -> list[str]:
    """F3.1 to F3.6 rules that JSON Schema cannot express: version per feature, interslice, polyline, Bishop."""
    errors = []
    m = case.get("model") or {}
    a = m.get("analysis") or {}
    methods = a.get("methods") or []
    surface = a.get("surface") or {}
    needs_03 = (any(mat.get("model") == "undrained" for mat in m.get("materials", []))
                or surface.get("type") == "polyline" or "interslice" in a
                or any(x in methods for x in ("morgenstern_price", "janbu_simplified", "janbu_corrected")))
    if needs_03 and m.get("version") != F3_VERSION:
        errors.append('los campos de v0.3 requieren version "0.3"')
    if "interslice" in a:
        if "morgenstern_price" not in methods:
            errors.append("interslice sin morgenstern_price en methods")
        fn = a["interslice"].get("function")
        if (fn == "data_points") != ("points" in a["interslice"]):
            errors.append("interslice.points solo con data_points, y obligatorio con ella")
        if fn == "data_points":
            why = interslice_points_reason(a["interslice"].get("points") or [])
            if why:
                errors.append(why)
    if surface.get("type") == "polyline":
        pts = surface.get("points") or []
        if any(b[0] <= a_[0] for a_, b in zip(pts, pts[1:])):
            errors.append("polilínea con x no estrictamente creciente")
        if "bishop" in methods:
            errors.append("bishop no admite superficies polilínea")
    for mat in m.get("materials", []):
        if mat.get("model") == "undrained" and mat.get("strength_limit") is not None and mat.get("strength_gradient") is None:
            errors.append(f"material {mat.get('id')}: strength_limit sin strength_gradient")
    return errors


def gate_geometry(case: dict, raw: dict) -> list[str]:
    errors = []
    polys = [Polygon(r["polygon"]) for r in case["model"]["regions"]]
    for i, p in enumerate(polys):
        if not p.is_valid:
            errors.append(f"región {i} no válida")
    for i in range(len(polys)):
        for j in range(i + 1, len(polys)):
            area = polys[i].intersection(polys[j]).area
            if area >= TOL_ABS:
                errors.append(f"solape regiones {i}-{j}: {area:.3g}")
    outer = Polygon(raw["definition"]["coordinates"])
    union_area = unary_union(polys).area
    if abs(union_area - outer.area) > TOL_REL * outer.area:
        errors.append(f"área de la unión {union_area} ≠ contorno {outer.area}")
    return errors


# ---------------------------------------------------------------- writing
def write_if_changed(path: Path, text: str) -> bool:
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


def md_cell(text: str) -> str:
    return str(text).replace("|", "\\|").replace("\n", " ")


def build_index(converted, omitted, discarded_by_case, order, sat_report, promoted_batches=None) -> str:
    """converted: v0.1, v0.2 and v0.3 cases (v0.2: `loads` or `analysis.seismic`; v0.3: lots 1 and 2, promoted)."""
    """sat_report: (ids of problems with unitWeightSat in the source, reasons per id, ids included)."""
    sat_ids, sat_reason, sat_included = sat_report
    n_sat_in = sum(1 for c in converted if any(m["unit_weight_sat"] is not None for m in c["model"]["materials"]))
    convertible = [cid for cid in sat_ids if cid not in sat_included and sat_reason[cid].startswith("convertible")]
    n_checks = sum(len(c["checks"]) for c in converted)
    lines = [
        "# Casos de verificación v0.1, v0.2 y v0.3 (desde cSlope)",
        "",
        "Generado por `verification/tools/import_cslope.py`. No editar a mano.",
        "Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.",
        "",
        f"Casos convertidos e incluidos: **{len(converted)}** "
        f"(v0.1: **{sum(c['model']['version'] == '0.1' for c in converted)}**, "
        f"v0.2 con sismo o cargas: **{sum(c['model']['version'] == '0.2' for c in converted)}**, "
        f"v0.3: **{sum(c['model']['version'] == '0.3' for c in converted)}**), "
        f"con **{n_checks}** checks. Lote 0: todo lo que se convierte con la versión 0.1 o 0.2, sin tope ni selección. "
        "Lotes 1 y 2 (`undrained`, polilíneas fijas, Morgenstern-Price y Janbu): los casos v0.3, promovidos desde "
        "`verification/pending/F3` cuando el motor reproduce sus checks. "
        f"Casos no incluidos: **{len(omitted)}** (motivo en cada fila). "
        "Los problemas de cSlope con sismo o cargas que no se pudieron convertir figuran en "
        "[`../pending/INDEX.md`](../pending/INDEX.md); los checks que el motor no reproduce, en "
        "[`../pending/lote0/INDEX.md`](../pending/lote0/INDEX.md); los lotes 1 y 2 (formato v0.3), en "
        "[`../pending/F3/INDEX.md`](../pending/F3/INDEX.md).",
        "",
        "Checks por método: Bishop / Spencer / Morgenstern-Price / Janbu simplificado / Janbu corregido.",
        "",
        "| id | título | referencia | unidades | sismo y cargas | checks (B/S/MP/JS/JC) | tipo | versión |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for case in converted:
        counts = " / ".join(str(sum(c["method"] == m for c in case["checks"])) for m in
                            ("bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"))
        kinds = sorted({c["kind"] for c in case["checks"]})
        lines.append(
            f"| {md_cell(case['id'])} | {md_cell(case['title'])} | {md_cell(case['source']['reference'])} "
            f"| {case['model']['units']} | {md_cell(describe_features(case)) or '—'} | {counts} "
            f"| {'/'.join(kinds)} | {case['model']['version']} |"
        )
    lines += ["", "## Checks descartados en casos convertidos", ""]
    for cid in order:
        for reason in discarded_by_case.get(cid, []):
            lines.append(f"- {cid}: {md_cell(reason)}")
    overrides = [c["id"] for c in converted if c["id"] in DIRECTION_OVERRIDE_NOTES
                 and DIRECTION_OVERRIDE_NOTES[c["id"]] in c["source"]["notes"]]
    if overrides:
        lines += ["", "## Sentidos de deslizamiento fijados por el importador", ""]
        lines += [f"- {cid}: {md_cell(DIRECTION_OVERRIDE_NOTES[cid])}" for cid in overrides]
    lines += ["", "## Problemas con peso saturado (`unitWeightSat`) no incluidos", ""]
    lines += [
        f"En la fuente hay **{len(sat_ids)}** problemas con `unitWeightSat` no nulo; **{len(sat_included)}** "
        f"se incluyen. Casos incluidos con `unit_weight_sat` en el modelo: **{n_sat_in}**. "
        + ("Ninguno de los no incluidos es convertible con las reglas actuales (contrato §1, §2). "
           if not convertible else
           f"Convertibles y no incluidos (retenidos): {', '.join(convertible)}. ")
        + "Motivo de cada uno (el primero que lo impide):",
        "",
        "| id | motivo |",
        "|---|---|",
    ]
    lines += [f"| {cid} | {md_cell(sat_reason[cid])} |" for cid in sat_ids if cid not in sat_included]
    lines += ["", "## Casos no incluidos", "", "| id | motivo |", "|---|---|"]
    for cid, reason in omitted:
        lines.append(f"| {cid} | {md_cell(reason)} |")
    return "\n".join(lines) + "\n"


def describe_features(case: dict) -> str:
    """Short text of the seismic coefficients and loads of a v0.2 case."""
    m = case["model"]
    parts = []
    seismic = m["analysis"].get("seismic")
    if seismic:
        parts.append(f"kh = {seismic['kh']:g}, kv = {seismic['kv']:g}")
    for load in m.get("loads", []):
        if load["type"] == "udl":
            parts.append(f"udl q = {load['q']:g} en [{load['x1']:g}, {load['x2']:g}]")
        else:
            parts.append(f"carga lineal p = {load['p']:g} en x = {load['x']:g}, ángulo {load['angle']:g}°")
    return "; ".join(parts)


def build_pending_index(converted: list[dict], status: list[tuple[str, str, str]]) -> str:
    """status: (id, title, reason or '') per cSlope problem with loads or seismic coefficients."""
    included = [c["id"] for c in converted]
    excluded = [(cid, reason) for cid, _, reason in status if cid not in set(included)]
    lines = [
        "# Problemas con sismo o cargas excluidos (esquema v0.2)",
        "",
        "Generado por `verification/tools/import_cslope.py`. No editar a mano.",
        "Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.",
        "",
        "Los problemas de cSlope con `seismicHorizontal`, `seismicVertical`, `udls` o `lineLoads` que se pueden "
        "convertir al esquema v0.2 (contrato F1.1) están en `verification/cases/` desde que el motor acepta la "
        f"versión 0.2: **{len(included)}** casos ({', '.join(included)}). Aquí quedan los **{len(excluded)}** "
        f"excluidos, de un total de **{len(status)}** problemas con sismo o cargas, con el motivo de cada uno.",
        "",
        "| id | estado | motivo |",
        "|---|---|---|",
    ]
    for cid, reason in excluded:
        lines.append(f"| {cid} | excluido | {md_cell(reason)} |")
    return "\n".join(lines) + "\n"


# Third-party attribution that is not derived from cSlope: the PDF report font of the web editor.
FONT_NOTICE = (
    "\n---\n\n"
    "This product also embeds the font DejaVu Sans 2.37 in the PDF report of the web editor "
    "(apps/web/public/fonts/DejaVuSans.ttf and apps/web/public/fonts/DejaVuSans-Bold.ttf). DejaVu Sans is "
    "licensed under the Bitstream Vera / DejaVu license (the changes made by DejaVu are in the public domain). "
    "The full license text is in apps/web/public/fonts/LICENSE-DejaVu.txt.\n"
)


def build_notice(license_text: str) -> str:
    return (
        "NOTICE\n\n"
        "This product includes verification problem data adapted from cSlope (MIT License, "
        "Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.\n\n"
        "The adapted data are the verification problems in verification/cases/ (v0.1 and v0.2; outlines, material parameters, "
        "water levels, loads, seismic coefficients, analysis limits and fixed circles). The published factors of safety they are checked against "
        "belong to the bibliographic references cited in each case (source.reference in verification/cases/<id>.json). "
        "Transformations and discarded checks are documented in verification/cases/INDEX.md.\n\n"
        "The cSlope license text follows, copied from its LICENSE file.\n\n"
        "---\n\n"
        f"{license_text.rstrip()}\n"
        f"{FONT_NOTICE}"
    )


# ---------------------------------------------------------------- main
def check_key(cid: str, check: dict) -> tuple:
    return (cid, check["method"], check["published"], check["published_by"])


def load_hold(path: Path) -> dict[tuple, dict]:
    """Checks of batch 0 that the engine does not reproduce: {(id, method, published, published_by): entry}."""
    if not path.is_file():
        return {}
    entries = json.loads(path.read_text(encoding="utf-8"))
    return {(e["id"], e["method"], e["published"], e["published_by"]): e for e in entries}


def split_hold(case: dict, hold: dict[tuple, dict], only_batch0: list[int] | None = None) -> tuple[dict | None, dict | None]:
    """(case without the held checks or None, case with only the held checks or None)."""
    kept, held = [], []
    for i, c in enumerate(case["checks"]):
        is_b0 = only_batch0 is None or only_batch0[i] == 0
        (held if is_b0 and check_key(case["id"], c) in hold else kept).append(c)
    if not held:
        return case, None
    rest = {**case, "checks": kept} if kept else None
    return rest, {**case, "checks": held}


def build_hold_index(held: list[dict], hold: dict[tuple, dict]) -> str:
    lines = [
        "# Checks del lote 0 que el motor no reproduce (no promovidos)",
        "",
        "Generado por `verification/tools/import_cslope.py` a partir de `HOLD.json`. No editar a mano.",
        "Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.",
        "",
        "Cada check está convertido igual que los de `verification/cases/`, pero el binario de `main` no cae dentro de la "
        "tolerancia publicada. No se relaja ninguna tolerancia ni se toca ningún dato: los números de `HOLD.json` "
        "(publicado, ogs, cSlope) vienen del harness y el diagnóstico es del escritor. Cuando el motor los reproduzca, "
        "el integrador los promueve quitándolos de `HOLD.json` y regenerando.",
        "",
        f"Checks retenidos: **{sum(len(c['checks']) for c in held)}** en **{len(held)}** casos.",
        "",
        "| caso | método | publicado | por | tol % | ogs | cSlope | motivo y diagnóstico |",
        "|---|---|---:|---|---:|---:|---:|---|",
    ]
    for case in held:
        for c in case["checks"]:
            e = hold[check_key(case["id"], c)]
            def f(v):
                return "—" if v is None else f"{v:.4f}"
            lines.append(f"| {case['id']} | {c['method']} | {c['published']} | {md_cell(c['published_by'])} "
                         f"| {100 * c['tolerance']:.2f} | {f(e.get('ogs'))} | {f(e.get('cslope'))} "
                         f"| {md_cell(e.get('diagnosis', ''))} |")
    return "\n".join(lines) + "\n"


def build_f3_index(converted: list[dict], promoted: dict[str, dict], promoted_batches: dict[str, list[int]],
                   held: list[dict], hold: dict[tuple, dict], lote0_ids: set[str], dropped: dict[str, list[str]],
                   omitted: list[tuple[str, str]]) -> str:
    n = {b: sum(1 for bs in promoted_batches.values() for x in bs if x == b) for b in (0, 1, 2)}
    new_ids = [cid for cid in promoted if cid not in lote0_ids]
    lines = [
        "# Lotes 1 y 2 (formato v0.3): checks retenidos",
        "",
        "Generado por `verification/tools/import_cslope.py` a partir de `HOLD.json`. No editar a mano.",
        "Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.",
        "",
        f"Los lotes 1 (`undrained` y `s-f-datum`) y 2 (polilíneas fijas, M-P y Janbu) están promovidos a `verification/cases/`: "
        f"**{len(promoted)}** casos (de ellos **{len(new_ids)}** nuevos) con **{sum(n.values())}** checks "
        f"(del lote 0: {n[0]}, lote 1: **{n[1]}**, lote 2: **{n[2]}**). Aquí quedan solo los checks que el motor no "
        "reproduce, convertidos igual que los de `verification/cases/`. No se relaja ninguna tolerancia ni se toca ningún "
        "dato. Cuando el motor los reproduzca, el integrador los promueve quitándolos de `HOLD.json` y regenerando.",
        "",
        f"Checks retenidos: **{sum(len(c['checks']) for c in held)}** en **{len(held)}** casos.",
        "",
        "| caso | método | publicado | por | tol % | ogs | cSlope | motivo y diagnóstico |",
        "|---|---|---:|---|---:|---:|---:|---|",
    ]
    for case in held:
        for c in case["checks"]:
            e = hold[check_key(case["id"], c)]

            def f(v):
                return "—" if v is None else f"{v:.4f}"
            lines.append(f"| {case['id']} | {c['method']} | {c['published']} | {md_cell(c['published_by'])} "
                         f"| {100 * c['tolerance']:.2f} | {f(e.get('ogs'))} | {f(e.get('cslope'))} "
                         f"| {md_cell(e.get('diagnosis', ''))} |")
    lines += ["", "## Checks descartados en los casos de los lotes 1 y 2", ""]
    for cid in sorted(dropped):
        for reason in dropped[cid]:
            lines.append(f"- {cid}: {md_cell(reason)}")
    lines += ["", "## Problemas que no entran", "", "| id | motivo |", "|---|---|"]
    for cid, reason in omitted:
        lines.append(f"| {cid} | {md_cell(reason)} |")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--src", required=True, help="path to the read-only cSlope clone")
    ap.add_argument("--root", default=None, help="repository root (default: two levels above this script)")
    args = ap.parse_args()

    src = Path(args.src).expanduser().resolve()
    root = Path(args.root).resolve() if args.root else Path(__file__).resolve().parents[2]
    golden = src / "packages/engine-rs/golden/verification.json"
    problems_path = src / "packages/engine/src/verification/problems.ts"
    license_path = src / "LICENSE"
    for p in (golden, problems_path, license_path):
        if not p.is_file():
            print(f"ERROR: no existe {p}", file=sys.stderr)
            return 1

    license_text = license_path.read_text(encoding="utf-8")
    if "Copyright (c) 2026 Zilan Ciftci" not in license_text:
        print("ERROR: copyright literal no encontrado en LICENSE", file=sys.stderr)
        return 1

    data = json.loads(golden.read_text(encoding="utf-8"))
    raw_by_id = {c["id"]: c for c in data["cases"]}
    order = [c["id"] for c in data["cases"]]
    problems = parse_problems(problems_path)
    hold = load_hold(root / HOLD_FILE)

    # ---- batch 0: every problem that converts today (v0.1, and v0.2 with seismic coefficients or loads).
    # No cap and no selection (contract F3.8): a convertible problem is a verification case.
    batch0: dict[str, dict] = {}
    discarded_all: dict[str, list[str]] = {}
    reason_all: dict[str, str] = {}
    pending_status: list[tuple[str, str, str]] = []   # v0.2 problems and why they are excluded
    for cid in order:
        v02 = has_v02_features(raw_by_id[cid])
        try:
            case, disc = convert(raw_by_id[cid], problems.get(cid), v02=v02)
        except Omit as exc:
            reason_all[cid] = str(exc)
            if v02:
                pending_status.append((cid, raw_by_id[cid]["title"], str(exc)))
        except KeyError as exc:
            reason_all[cid] = f"campo ausente en cSlope: {exc}"
            if v02:
                pending_status.append((cid, raw_by_id[cid]["title"], reason_all[cid]))
        else:
            batch0[cid] = case
            discarded_all[cid] = disc
            if v02:
                pending_status.append((cid, case["title"], ""))
    lote0_ids = set(batch0)

    # held checks (the engine does not reproduce them): not promoted, kept in verification/pending/lote0
    converted, held_cases = [], []
    for cid in order:
        if cid not in batch0:
            continue
        rest, held_case = split_hold(batch0[cid], hold)
        if held_case is not None:
            held_cases.append(held_case)
        if rest is not None:
            converted.append(rest)
    omitted = [(cid, reason_all[cid]) for cid in order if cid in reason_all and cid not in lote0_ids]
    omitted += [(c["id"], "todos sus checks están retenidos en verification/pending/lote0 (el motor no los reproduce)")
                for c in held_cases if c["id"] not in {x["id"] for x in converted}]
    unknown_hold = sorted(set(hold) - {check_key(c["id"], k) for c in held_cases for k in c["checks"]})
    discarded_by_case = {c["id"]: discarded_all[c["id"]] for c in converted}
    sat_ids = [cid for cid in order if any(m["model"].get("unitWeightSat") is not None
                                           for m in raw_by_id[cid]["definition"]["materials"])]
    sat_reason = {cid: reason_all.get(cid, "convertible, retenido (ver verification/pending/lote0)") for cid in sat_ids}
    sat_included = [cid for cid in sat_ids if cid in {c["id"] for c in converted}]

    # ---- batches 1 and 2: the target state in v0.3 (pending/F3)
    f3_cases: list[dict] = []
    f3_batches: dict[str, list[int]] = {}
    f3_dropped: dict[str, list[str]] = {}
    f3_omitted: list[tuple[str, str]] = []
    for cid in order:
        try:
            case, disc, batches = convert_f3(raw_by_id[cid], problems.get(cid))
        except Omit as exc:
            f3_omitted.append((cid, str(exc)))
            continue
        except KeyError as exc:
            f3_omitted.append((cid, f"campo ausente en cSlope: {exc}"))
            continue
        # the held checks of batch 0 stay out here too (the file must be the cases/ file plus the new checks)
        keep = [i for i, c in enumerate(case["checks"]) if not (batches[i] == 0 and check_key(cid, c) in hold)]
        if len(keep) != len(case["checks"]):
            case = {**case, "checks": [case["checks"][i] for i in keep]}
            batches = [batches[i] for i in keep]
        if not keep or max(batches) == 0:
            continue
        f3_cases.append(case)
        f3_batches[cid] = batches
        f3_dropped[cid] = disc
    f3_dropped = {k: v for k, v in f3_dropped.items() if v}
    # ---- promotion (I-M): the v0.3 target replaces the case of verification/cases/; the checks that the engine does not
    # reproduce stay in verification/pending/F3 (HOLD.json) with their diagnosis.
    hold_f3 = load_hold(root / HOLD_F3_FILE)
    promoted: dict[str, dict] = {}
    promoted_batches: dict[str, list[int]] = {}
    f3_held: list[dict] = []
    for case in f3_cases:
        cid = case["id"]
        rest, held_case = split_hold(case, hold_f3)
        if held_case is not None:
            f3_held.append(held_case)
        if rest is None:
            continue
        kept = [b for c, b in zip(case["checks"], f3_batches[cid]) if check_key(cid, c) not in hold_f3]
        if max(kept) == 0:
            continue    # only batch-0 checks are left: the v0.1/v0.2 case of batch 0 stays
        promoted[cid] = rest
        promoted_batches[cid] = kept
    unknown_hold_f3 = sorted(set(hold_f3) - {check_key(c["id"], k) for c in f3_held for k in c["checks"]})
    by_id = {c["id"]: c for c in converted}
    by_id.update(promoted)
    converted = [by_id[cid] for cid in order if cid in by_id]
    discarded_by_case = {c["id"]: (f3_dropped.get(c["id"], []) if c["id"] in promoted else discarded_all[c["id"]])
                         for c in converted}
    omitted = [(cid, r) for cid, r in omitted if cid not in promoted]
    sat_included = [cid for cid in sat_ids if cid in {c["id"] for c in converted}]
    sat_reason = {cid: reason_all.get(cid, "convertible, retenido (ver verification/pending/lote0)")
                  for cid in sat_ids}

    # ---- gates
    failures = []
    for label, group in (("", converted), (" (lote0 retenido)", held_cases), (" (F3)", f3_cases)):
        for case in group:
            cid = case["id"]
            for err in gate_schema(case):
                failures.append(f"{cid}{label} schema: {err}")
            for err in gate_search(case):
                failures.append(f"{cid}{label} rangos: {err}")
            for err in gate_loads(case):
                failures.append(f"{cid}{label} cargas: {err}")
            for err in gate_features(case):
                failures.append(f"{cid}{label} v0.3: {err}")
            for err in gate_geometry(case, raw_by_id[cid]):
                failures.append(f"{cid}{label} geometría: {err}")
    if unknown_hold:
        failures.append(f"HOLD.json con checks que no existen en el lote 0: {unknown_hold}")
    if unknown_hold_f3:
        failures.append(f"pending/F3/HOLD.json con checks que no existen en F3: {unknown_hold_f3}")
    if not converted:
        failures.append("ningún caso convertido")
    if failures:
        print("GATE FAILURES:", *failures, sep="\n  ", file=sys.stderr)
        return 1

    # ---- write (deterministic, idempotent)
    cases_dir = root / "verification" / "cases"
    expected = {f"{c['id']}.json" for c in converted}
    changed = 0
    for case in converted:
        text = json.dumps(case, indent=2, ensure_ascii=False) + "\n"
        changed += write_if_changed(cases_dir / f"{case['id']}.json", text)
    for stale in sorted(cases_dir.glob("*.json")):
        if stale.name not in expected:
            stale.unlink()
            changed += 1
    changed += write_if_changed(cases_dir / "INDEX.md", build_index(
        converted, omitted, discarded_by_case, order, (sat_ids, sat_reason, sat_included)))
    changed += write_if_changed(root / "NOTICE", build_notice(license_text))

    pending_dir = root / "verification" / "pending"
    pending_included = [c for c in converted if c["model"].get("loads") or c["model"]["analysis"].get("seismic")]
    for stale in sorted(pending_dir.glob("V*.json")):
        stale.unlink()
        changed += 1
    changed += write_if_changed(pending_dir / "INDEX.md", build_pending_index(pending_included, pending_status))
    # lote 0 holds
    hold_dir = pending_dir / "lote0"
    for stale in sorted(hold_dir.glob("V*.json")) if hold_dir.is_dir() else []:
        stale.unlink()
        changed += 1
    if held_cases:
        for case in held_cases:
            changed += write_if_changed(hold_dir / f"{case['id']}.json", json.dumps(case, indent=2, ensure_ascii=False) + "\n")
        changed += write_if_changed(hold_dir / "INDEX.md", build_hold_index(held_cases, hold))
    # F3: only the checks that the engine does not reproduce are left in pending (the rest was promoted above)
    f3_dir = pending_dir / "F3"
    keep_f3 = {f"{c['id']}.json" for c in f3_held}
    for stale in sorted(f3_dir.glob("V*.json")) if f3_dir.is_dir() else []:
        if stale.name not in keep_f3:
            stale.unlink()
            changed += 1
    for case in f3_held:
        changed += write_if_changed(f3_dir / f"{case['id']}.json", json.dumps(case, indent=2, ensure_ascii=False) + "\n")
    changed += write_if_changed(f3_dir / "INDEX.md", build_f3_index(
        converted, promoted, promoted_batches, f3_held, hold_f3, lote0_ids, f3_dropped, f3_omitted))

    # ---- summary
    n_checks = sum(len(c["checks"]) for c in converted)
    n_v02 = sum(c["model"]["version"] == "0.2" for c in converted)
    print(f"Fuente: {src}")
    print(f"Problemas en verification.json: {len(order)}; en problems.ts: {len(problems)}")
    print(f"Lote 0 convertible hoy: {len(batch0)} casos, {sum(len(c['checks']) for c in batch0.values())} checks")
    print(f"Lote 0 retenido: {len(held_cases)} casos, {sum(len(c['checks']) for c in held_cases)} checks")
    n_v03 = sum(c["model"]["version"] == "0.3" for c in converted)
    print(f"verification/cases: {len(converted)} casos ({len(converted) - n_v02 - n_v03} v0.1 + {n_v02} v0.2 + {n_v03} v0.3), "
          f"{n_checks} checks")
    nb = {b: sum(x == b for bs in promoted_batches.values() for x in bs) for b in (0, 1, 2)}
    print(f"Promovidos desde F3 a verification/cases: {len(promoted)} casos; checks lote 0/1/2 = {nb[0]}/{nb[1]}/{nb[2]}")
    print(f"verification/pending/F3 (retenidos): {len(f3_held)} casos, {sum(len(c['checks']) for c in f3_held)} checks")
    print("Omitidos del lote 0:")
    for cid, reason in omitted:
        print(f"  {cid}: {reason}")
    print(f"Archivos escritos/modificados en esta ejecución: {changed}")
    print("GATES OK: schema, geometría, v0.3")
    return 0


if __name__ == "__main__":
    sys.exit(main())
