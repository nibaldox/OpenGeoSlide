#!/usr/bin/env python3
"""Convert cSlope verification problems (MIT) into OpenGeoSlide v0.1 verification cases.

Usage (from the repository root):

    uv run --no-project --with shapely --with jsonschema \\
        python verification/tools/import_cslope.py --src /path/to/cslope

The source clone is read only. The script writes:

- verification/cases/<id>.json   one case per converted cSlope problem (format: briefs/00_CONTRATOS.md, section 2)
- verification/cases/INDEX.md    table of converted cases, omitted cases and discarded checks
- NOTICE                         attribution plus the cSlope MIT license text, copied from the source

The output is deterministic: running the script twice leaves every file unchanged.
Gates run on every execution: JSON Schema (defined below), geometry (shapely).
The script exits with status 1 if any gate fails or the selection bounds are not met.
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

# ---------------------------------------------------------------- selection
PRIORITY = [
    "V044", "V044b", "V045", "V047a", "V049", "V001", "V002", "V003", "V025", "V019",
    "V033", "V093", "V101", "V063", "V030",
]
MIN_CASES, MAX_CASES = 12, 20
MIN_SPENCER, MIN_FIXED = 8, 4

# ---------------------------------------------------------------- conversion constants
GAMMA_W = {"SI": 9.807, "imperial": 62.4}  # cSlope constant 9.807 kN/m3; 62.4 pcf for imperial
ALLOWED_DEFINITION_KEYS = {
    "coordinates", "materials", "materialBoundaries", "regionAssignments", "analysisLimits",
    "customPlanesOnly", "customSearchPlanes", "orientation", "waterTable",
}
ALLOWED_MATERIAL_KEYS = {"name", "model"}
ALLOWED_MODEL_KEYS = {"kind", "unitWeight", "cohesion", "frictionAngle", "unitWeightSat", "ru"}
ALLOWED_WATER_KEYS = {"mode", "value", "followBoundary"}
ALLOWED_LIMIT_KEYS = {"entryLeftX", "entryRightX", "exitLeftX", "exitRightX"}
NEUTRAL_OPTION_KEYS = {"method", "slices", "iterations", "refinedIterations", "tolerance"}
# Options that change the problem: their presence omits the whole case.
CASE_OMIT_OPTION_PREFIXES = ("tensionCrack", "seismic", "partialFactors", "compositeBase")
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
DIRECTION_OVERRIDES = {"V063": "left_to_right"}
DIRECTION_OVERRIDE_NOTE = (
    "slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): auto no puede "
    "resolver el sentido en esta presa simétrica con entry == exit; la orientación ltr reproduce el "
    "círculo crítico de cSlope (centro ≈ (154.2, 76.6), r ≈ 69.4)."
)

# ---------------------------------------------------------------- JSON Schema (sections 1 and 2 of the contracts)
POINT = {"type": "array", "items": {"type": "number"}, "minItems": 2, "maxItems": 2}
MODEL_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["format", "version", "meta", "units", "materials", "regions", "slope", "analysis"],
    "additionalProperties": False,
    "properties": {
        "format": {"const": "opengeoslide"},
        "version": {"const": "0.1"},
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
            "items": {
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
            },
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
                    "items": {"enum": ["bishop", "spencer"]},
                },
                "slices": {"type": "integer", "minimum": 3, "maximum": 2000},
                "tolerance": {"type": "number", "exclusiveMinimum": 0, "maximum": 0.01},
                "max_iterations": {"type": "integer", "minimum": 1, "maximum": 100000},
                "min_m_alpha": {"type": "number", "exclusiveMinimum": 0, "maximum": 1},
                "surface": {
                    "type": "object",
                    "required": ["type", "xc", "yc", "r"],
                    "additionalProperties": False,
                    "properties": {
                        "type": {"const": "circle"},
                        "xc": {"type": "number"},
                        "yc": {"type": "number"},
                        "r": {"type": "number", "exclusiveMinimum": 0},
                    },
                },
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
                    "method": {"enum": ["bishop", "spencer"]},
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


def option_reason(method: str, opts: dict) -> str | None:
    """Return why a check cannot be used with our engine, or None if its options are neutral."""
    if opts.get("nonCircularOptimization"):
        return "superficie no circular (nonCircularOptimization)"
    for key, value in opts.items():
        if key in NEUTRAL_OPTION_KEYS:
            continue
        if key == "porePressureHead" and value == "vertical":
            continue
        if key == "intersliceFunction" and value == "constant" and method == "Morgenstern-Price":
            continue
        if key == "compositeSurfaces" and value is False:
            continue
        return f"opción {key}={value!r}"
    return None


# ---------------------------------------------------------------- conversion
class Omit(Exception):
    """Raised to omit a case; the message is the reason recorded in INDEX.md."""


def convert(raw: dict, prob: dict | None) -> tuple[dict, list[str]]:
    """Convert one cSlope case. Returns (case, discarded_checks). Raises Omit."""
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
    extra = sorted(set(d) - ALLOWED_DEFINITION_KEYS)
    if extra:
        raise Omit("definition con clave que cambia el problema: " + ", ".join(extra))

    for ck in raw["checks"]:
        for key in ck.get("options", {}):
            if key.startswith(CASE_OMIT_OPTION_PREFIXES):
                raise Omit(f"opción de check que cambia el problema: {key}")

    # materials
    materials, name2id = [], {}
    for m in d["materials"]:
        if set(m) - ALLOWED_MATERIAL_KEYS:
            raise Omit(f"material '{m.get('name')}' con propiedad no soportada: " + ", ".join(sorted(set(m) - ALLOWED_MATERIAL_KEYS)))
        model = m["model"]
        if model.get("kind") != "mohr-coulomb":
            raise Omit(f"material '{m['name']}' con modelo {model.get('kind')!r}")
        if set(model) - ALLOWED_MODEL_KEYS:
            raise Omit(f"material '{m['name']}' con propiedad no soportada: " + ", ".join(sorted(set(model) - ALLOWED_MODEL_KEYS)))
        mid = snake(m["name"])
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

    # geometry
    coords = d["coordinates"]
    outer = Polygon(coords)
    if not outer.is_valid:
        raise Omit("contorno no válido")
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
    if surface_kind == "fixed":
        planes = d.get("customSearchPlanes") or []
        if d.get("customPlanesOnly") is not True or len(planes) != 1:
            raise Omit("superficie fija que no es un único círculo con customPlanesOnly")
        p = planes[0]
        analysis["surface"] = {"type": "circle", "xc": num(p["cx"]), "yc": num(p["cy"]), "r": num(p["radius"])}
    else:
        if d.get("customPlanesOnly") or d.get("customSearchPlanes"):
            raise Omit("búsqueda restringida a círculos propios")
        search: dict = {"type": "circular_entry_exit"}
        limits = d.get("analysisLimits")
        if limits is not None:
            if set(limits) - ALLOWED_LIMIT_KEYS:
                raise Omit("analysisLimits con clave no soportada")
            search["entry"] = [num(limits["entryLeftX"]), num(limits["entryRightX"])]
            search["exit"] = [num(limits["exitLeftX"]), num(limits["exitRightX"])]
        search.update(SEARCH_DEFAULTS)
        analysis["search"] = search

    # checks
    checks, discarded = [], []
    for ck in raw["checks"]:
        opts = ck.get("options", {})
        label = f"{ck['method']} ({ck.get('label')}, {ck['publishedBy']}, {ck['published']})"
        if ck["method"] == "Bishop":
            method = "bishop"
        elif ck["method"] == "Morgenstern-Price" and opts.get("intersliceFunction") == "constant":
            method = "spencer"
        else:
            discarded.append(f"{label}: método no soportado")
            continue
        reason = option_reason(ck["method"], opts)
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
    if not checks:
        raise Omit("sin checks válidos")

    methods = [m for m in ("bishop", "spencer") if any(c["method"] == m for c in checks)]
    slice_values = {c["options"].get("slices", 50) for c in checks}
    slices = slice_values.pop() if len(slice_values) == 1 else 50
    analysis_block = {"methods": methods, "slices": slices, **ANALYSIS_DEFAULTS, **analysis}

    model = {
        "format": "opengeoslide",
        "version": "0.1",
        "meta": {"id": cid, "title": raw["title"], "notes": prob.get("description") or ""},
        "units": units,
        "materials": materials,
        "regions": regions,
    }
    if water is not None:
        model["water"] = water
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
            "notes": prob.get("notes", []) + solver_notes + ([DIRECTION_OVERRIDE_NOTE] if overridden else []),
        },
    }
    return case, discarded


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


def build_index(converted, omitted, discarded_by_case, order, sat_report) -> str:
    """sat_report: (ids of problems with unitWeightSat in the source, reasons per id, ids included)."""
    sat_ids, sat_reason, sat_included = sat_report
    n_sat_in = sum(1 for c in converted if any(m["unit_weight_sat"] is not None for m in c["model"]["materials"]))
    convertible = [cid for cid in sat_ids if cid not in sat_included and sat_reason[cid].startswith("convertible")]
    lines = [
        "# Casos de verificación v0.1 (desde cSlope)",
        "",
        "Generado por `verification/tools/import_cslope.py`. No editar a mano.",
        "Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.",
        "",
        f"Casos convertidos e incluidos: **{len(converted)}**. Casos no incluidos: **{len(omitted)}** "
        "(no convertibles o convertibles pero fuera del conjunto mínimo; motivo en cada fila).",
        "",
        "| id | título | referencia | unidades | checks (bishop/spencer) | tipo |",
        "|---|---|---|---|---|---|",
    ]
    for case in converted:
        nb = sum(c["method"] == "bishop" for c in case["checks"])
        ns = sum(c["method"] == "spencer" for c in case["checks"])
        lines.append(
            f"| {md_cell(case['id'])} | {md_cell(case['title'])} | {md_cell(case['source']['reference'])} "
            f"| {case['model']['units']} | {nb} / {ns} | {case['checks'][0]['kind']} |"
        )
    lines += ["", "## Checks descartados en casos convertidos", ""]
    for cid in order:
        for reason in discarded_by_case.get(cid, []):
            lines.append(f"- {cid}: {md_cell(reason)}")
    overrides = [c["id"] for c in converted if DIRECTION_OVERRIDE_NOTE in c["source"]["notes"]]
    if overrides:
        lines += ["", "## Sentidos de deslizamiento fijados por el importador", ""]
        lines += [f"- {cid}: {md_cell(DIRECTION_OVERRIDE_NOTE)}" for cid in overrides]
    lines += ["", "## Problemas con peso saturado (`unitWeightSat`) no incluidos", ""]
    lines += [
        f"En la fuente hay **{len(sat_ids)}** problemas con `unitWeightSat` no nulo; **{len(sat_included)}** "
        f"se incluyen. Casos incluidos con `unit_weight_sat` en el modelo: **{n_sat_in}**. "
        + ("Ninguno de los no incluidos es convertible con las reglas actuales (contrato §1, §2). "
           if not convertible else
           f"Convertibles y no incluidos (decidir si se añaden): {', '.join(convertible)}. ")
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


def build_notice(license_text: str) -> str:
    return (
        "NOTICE\n\n"
        "This product includes verification problem data adapted from cSlope (MIT License, "
        "Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.\n\n"
        "The adapted data are the verification problems in verification/cases/ (outlines, material parameters, "
        "water levels, analysis limits and fixed circles). The published factors of safety they are checked against "
        "belong to the bibliographic references cited in each case (source.reference in verification/cases/<id>.json). "
        "Transformations and discarded checks are documented in verification/cases/INDEX.md.\n\n"
        "The cSlope license text follows, copied from its LICENSE file.\n\n"
        "---\n\n"
        f"{license_text.rstrip()}\n"
    )


# ---------------------------------------------------------------- main
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

    # Convert every candidate once: priority list first, then the rest in source order to complete the set.
    # Every candidate is converted once; cases that cannot be converted keep their reason.
    converted_all: dict[str, dict] = {}
    discarded_all: dict[str, list[str]] = {}
    reason_all: dict[str, str] = {}
    for cid in order:
        try:
            case, disc = convert(raw_by_id[cid], problems.get(cid))
            converted_all[cid] = case
            discarded_all[cid] = disc
        except Omit as exc:
            reason_all[cid] = str(exc)
        except KeyError as exc:
            reason_all[cid] = f"campo ausente en cSlope: {exc}"

    selected: list[str] = [cid for cid in PRIORITY if cid in converted_all]

    def counts(ids: list[str]) -> tuple[int, int]:
        """Return (number of fixed cases, number of Spencer checks) for the given case ids."""
        fixed = sum(converted_all[i]["checks"][0]["kind"] == "fixed" for i in ids)
        spencer = sum(c["method"] == "spencer" for i in ids for c in converted_all[i]["checks"])
        return fixed, spencer

    # Complete the set in source order only while a requirement is still unmet.
    for cid in order:
        if len(selected) >= MAX_CASES:
            break
        fixed, spencer = counts(selected)
        if len(selected) >= MIN_CASES and fixed >= MIN_FIXED and spencer >= MIN_SPENCER:
            break
        if cid in selected or cid not in converted_all:
            continue
        case = converted_all[cid]
        is_fixed = case["checks"][0]["kind"] == "fixed"
        has_spencer = any(c["method"] == "spencer" for c in case["checks"])
        helps = (
            len(selected) < MIN_CASES
            or (fixed < MIN_FIXED and is_fixed)
            or (spencer < MIN_SPENCER and has_spencer)
        )
        if helps:
            selected.append(cid)

    converted = [converted_all[cid] for cid in order if cid in selected]
    omitted = [(cid, reason_all[cid]) for cid in order if cid in reason_all]
    omitted += [(cid, "convertible, no incluido (el conjunto ya cumple los mínimos)")
                for cid in order if cid in converted_all and cid not in selected]
    discarded_by_case = {c["id"]: discarded_all[c["id"]] for c in converted}
    # Problems whose source has a saturated unit weight: why none is in the set (R1-12 b).
    sat_ids = [cid for cid in order if any(m["model"].get("unitWeightSat") is not None
                                           for m in raw_by_id[cid]["definition"]["materials"])]
    sat_reason = {cid: reason_all.get(cid, "convertible, no incluido (el conjunto ya cumple los mínimos)")
                  for cid in sat_ids}
    sat_included = [cid for cid in sat_ids if cid in selected]

    # ---- gates
    failures = []
    for case in converted:
        cid = case["id"]
        for err in gate_schema(case):
            failures.append(f"{cid} schema: {err}")
        for err in gate_search(case):
            failures.append(f"{cid} rangos: {err}")
        for err in gate_geometry(case, raw_by_id[cid]):
            failures.append(f"{cid} geometría: {err}")
    total_fixed, total_spencer = counts(selected)
    if not MIN_CASES <= len(converted) <= MAX_CASES:
        failures.append(f"nº de casos {len(converted)} fuera de [{MIN_CASES}, {MAX_CASES}]")
    if total_spencer < MIN_SPENCER:
        failures.append(f"checks Spencer {total_spencer} < {MIN_SPENCER}")
    if total_fixed < MIN_FIXED:
        failures.append(f"casos fixed {total_fixed} < {MIN_FIXED}")
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

    # ---- summary
    print(f"Fuente: {src}")
    print(f"Problemas en verification.json: {len(order)}; en problems.ts: {len(problems)}")
    print(f"Casos convertidos: {len(converted)} (fixed {total_fixed}, search {len(converted) - total_fixed}); "
          f"checks Spencer {total_spencer}, Bishop {sum(c['method'] == 'bishop' for k in converted for c in k['checks'])}")
    print("Convertidos:")
    for case in converted:
        cks = ", ".join(f"{c['method']} {c['published']} ±{c['tolerance']:.4f} [{c['published_by']}]" for c in case["checks"])
        print(f"  {case['id']:6} {case['checks'][0]['kind']:6} {case['model']['units']:8} {case['title']}\n"
              f"         checks: {cks}")
    print("Omitidos:")
    for cid, reason in omitted:
        print(f"  {cid}: {reason}")
    print(f"Archivos escritos/modificados en esta ejecución: {changed}")
    print("GATES OK: schema, geometría, selección")
    return 0


if __name__ == "__main__":
    sys.exit(main())
