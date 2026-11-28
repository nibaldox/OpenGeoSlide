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
- verification/cases/ (v0.4)     batches R1 to R4 (contract F4.12), promoted: the published cases with reinforcements and
                                 piles of constant force, written as v0.4 models after the v0.1 to v0.3 ones; the
                                 «Casos con refuerzos» section of `cases/INDEX.md` is built from `verification/report.json`
                                 (written by `verification/harness/run.py` over `verification/cases`)
- verification/pending/F3R/      only an `INDEX.md` that says where the batches went
- verification/cases/ (v0.3, v0.5) batch F3G (contract F5.6), promoted: the cases with a tension crack and / or ponded
                                 water (the piezometric line above the ground), written as v0.5 models (the minimum
                                 version of their fields, v0.1 to v0.3, when they have no crack) after the R1 to R4 ones; the «Grieta de tracción y agua embalsada»
                                 section of `cases/INDEX.md` is built from `verification/report.json`
- verification/pending/F3G/      the F3G checks that the engine does not reproduce: `HOLD.json` (the numbers and the
                                 cause) and `<id>.json` with the held checks, plus an `INDEX.md`
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
# Batches R1 to R4 of F4.12 (X14 §7). V013b to V013e (Ito-Matsui) stay in `pending/`: no `force`, so not expressible.
F4_VERSION = "0.4"
F3R_BATCHES = {
    "R1": ("anclajes", ["V016b", "V035a", "V035b", "V037"]),
    "R2": ("clavos y geosintéticos con development", ["V011a", "V011b", "V012", "V064", "V065", "V066a", "V066b",
                                                      "V066c", "V066e"]),
    "R3": ("geosintéticos con interface y clavos de pared", ["V010", "V010b", "V014", "V083", "V084a", "V084b",
                                                              "V084c", "V084d", "V084e", "V084f"]),
    "R4": ("pilotes de fuerza constante", ["V015", "V095c"]),
}
# `type` of the tension elements of a case. The type changes no number (E14b); it is the one the source names.
F3R_TENSION_TYPE = {
    "V016b": "geosynthetic",   # "mesh as geosynthetic supports"
    "V035a": "anchor", "V035b": "anchor",   # Duncan & Wright tieback
    "V037": "geosynthetic",    # "Geogrid-reinforced fill"
    "V011a": "geosynthetic", "V011b": "geosynthetic", "V012": "geosynthetic",   # Borges & Cardoso embankment 3
    "V064": "geosynthetic", "V065": "geosynthetic", "V066a": "geosynthetic", "V066b": "geosynthetic",
    "V066c": "geosynthetic", "V066e": "geosynthetic",   # Leshchinsky & Han MSE walls
    "V010": "geosynthetic", "V010b": "geosynthetic",    # Borges & Cardoso embankment 2 (geosynthetic)
    "V014": "nail", "V083": "nail", "V084a": "nail", "V084b": "nail", "V084c": "nail", "V084d": "nail",
    "V084e": "nail", "V084f": "nail",   # nailed walls
    "V015": "anchor",   # soldier-pile tieback wall
}
PHREATIC_NOTE = (
    "porePressureHead = phreatic-correction en los checks de la fuente: ogs solo tiene la altura vertical (E3), que es también "
    "la opción por defecto de cSlope y la que usa el harness (no emite porePressureHead). Con la corrección freática "
    "cSlope da el FS de Bishop en 1,5338 (V082a) y 1,5126 (V082b); con la vertical, 1,5204 y 1,4994, que siguen dentro de "
    "la tolerancia del valor publicado.")
# Batch F3G (F5.6, X18 §3.1 D): tension crack and ponded water, v0.5.
F5_VERSION = "0.5"
F3G_DIR = Path("verification") / "pending" / "F3G"
F3G_SCHEMA = Path("schema") / "ogs-0.5.schema.json"
HOLD_F3G_FILE = F3G_DIR / "HOLD.json"
CRACK_OPTION_KEYS = ("tensionCrackDepth", "tensionCrackAuto", "tensionCrackWater")
# Batch F3B (F6.12, X23 §1, X29 §8): Hoek-Brown, SHANSEP and the non-circular search, v0.6. Written to pending/F3B until the
# engine reproduces them; B2 promotes them with `import_cslope.py --promote-f3b` (E16l) and flips `F3B_PROMOTED`. What the engine
# does not reproduce stays in pending/F3B (HOLD.json).
F6_VERSION = "0.6"
F3B_DIR = Path("verification") / "pending" / "F3B"
F3B_SCHEMA = Path("schema") / "ogs-0.6.schema.json"
HOLD_F3B_FILE = F3B_DIR / "HOLD.json"
F3B_PROMOTED = True
# Ten cSlope problems of the list already live in verification/cases with other checks (v0.1 to v0.3, circular search) and another
# model: their non-circular checks are a different case and take this suffix, as `V086b-auto` does (F3G).
F3B_RENAMED = ("V001", "V002", "V026", "V033", "V034a", "V034b", "V036a", "V093", "V102a", "V102b")
F3B_SUFFIX = "-nc"
# cSlope 0.1.0 has no document fields for the seeds or the vertices of the non-circular search (its engine fixes 3 seeds and up
# to 33 vertices in `optimize.rs`, X24 §1), so the case writes those values: they are the ones the oracle runs with.
NC_DEFAULTS = {"seeds": 3, "max_vertices": 33}
# Batch CM (F7.6, X32, X37): the non-circular checks of cSlope that F3B left out of its list. Promoted by CM-C2V: V036c, V036d, V039
# (2 checks), V041a, V041b, V051 and V098 in v0.6, and V053 in v0.7 with `analysis.search.non_circular.global: {}` (the refinement
# alone does not reach its published value, X32 §2; the global search does, F7.6). What the engine does not reproduce stays in
# pending/CM (HOLD.json).
CM_VERSION = "0.7"
CM_DIR = Path("verification") / "pending" / "CM"
HOLD_CM_FILE = CM_DIR / "HOLD.json"
CM_IDS = ("V036c", "V036d", "V039", "V041a", "V041b", "V051", "V053", "V098")
CM_RENAMED = ("V036c", "V036d", "V041a", "V041b", "V098")    # they already have a case in verification/cases (circular checks)
CM_GLOBAL = ("V053",)
CM_SECTION = "Búsqueda no circular y global (lote CM, v0.6 y v0.7)"
HAM1_URL = ("https://www.rocscience.com/assets/resources/learning/papers/"
            "The-Shear-Strength-Reduction-Method-for-the-Generalized-Hoek-Brown-Criterion.pdf")
F3R_DIR = Path("verification") / "pending" / "F3R"
F3R_SCHEMA = Path("schema") / "ogs-0.4.schema.json"
TENSION_KEYS = {"x1", "y1", "x2", "y2", "tensileCapacity", "spacing", "end1Capacity", "end2Capacity", "direction",
                "application", "pullout", "prestress"}
PILE_KEYS = {"x1", "y1", "x2", "y2", "force", "diameter", "spacing", "direction", "angle", "application", "location",
             "wall"}
# Batch F3I (E15i-10): the Ito-Matsui piles of Cai & Ugai (2000), v0.5 with `lateral_pressure`. Written to pending/F3I until the
# engine reproduces them; the integrator promotes them with `import_cslope.py --promote-f3i` and flips this constant.
F3I_IDS = ("V013b", "V013c", "V013d", "V013e")
F3I_DIR = Path("verification") / "pending" / "F3I"
F3I_PROMOTED = True
F3I_F3R_NOTE_PROMOTED = (
    "V013b a V013e (Ito-Matsui, sin `force`) no son de v0.4: son de v0.5 con `lateral_pressure` y están en el lote F3I.")
PILE_KEYS_F3I = PILE_KEYS | {"shearCapacity", "momentCapacity"}
F3I_LOCATIONS = {"centroid": "centroid", "slip-surface": "slip_surface"}
PILE_VERTICAL_TOL = 1e-6
HOLD_FILE = Path("verification") / "pending" / "lote0" / "HOLD.json"
HOLD_F3_FILE = Path("verification") / "pending" / "F3" / "HOLD.json"
HOLD_F3R_FILE = Path("verification") / "pending" / "F3R" / "HOLD.json"

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
# Batch F3B (F6.2, F6.3): the cSlope names of `hoek-brown` and `shansep`. `mb`, `s` and `a` are derived by ogs (F6.2) and the other
# keys of cSlope's SHANSEP (suMin, yieldStress, suByStress, anisotropy, yieldFromEarlierStage, aboveWater, bBar) are outside v0.6.
ALLOWED_HB_KEYS = {"kind", "unitWeight", "ucs", "gsi", "mi", "disturbance", "unitWeightSat", "ru"}
ALLOWED_SHANSEP_KEYS = {"kind", "unitWeight", "ratio", "exponent", "ocr", "pop", "ocrByElevation", "unitWeightSat", "ru"}
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
DIRECTION_OVERRIDES = {"V026": "left_to_right", "V063": "left_to_right", "V077": "left_to_right",
                       "V038": "left_to_right", "V038b": "left_to_right", "V058": "left_to_right"}
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
    **{cid: (
        "slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): presa con las dos coronas a la misma "
        "cota y sin rangos de búsqueda, así que auto no tiene pista; cSlope toma ltr con crestas iguales "
        "(infer_orientation_from_coordinates) y su círculo crítico está en el talud de aguas abajo (derecho). Medido con el "
        f"oráculo (F3G-V): con ltr da {fos_ltr} y con rtl {fos_rtl} en el primer check, frente al publicado {pub}."
    ) for cid, (fos_ltr, fos_rtl, pub) in {"V038": ("1,0693 (Bishop)", "2,0808", "1,09"),
                                           "V038b": ("1,1578 (Spencer)", "1,9342", "1,16"),
                                           "V058": ("1,9152 (Spencer)", "3,2688", "1,9")}.items()},
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


def option_reason(method: str, opts: dict, v02: bool = False, f3: bool = False, f3g: bool = False,
                  f3b: bool = False) -> str | None:
    """Return why a check cannot be used with our engine, or None if its options are neutral.

    With ``v02`` the seismic coefficients are not an obstacle: they go to ``analysis.seismic``. With ``f3``
    the interslice function, its data points and the Janbu correction are not an obstacle either: they
    become the method (``janbu_simplified`` / ``janbu_corrected``) and ``analysis.interslice``.
    """
    if opts.get("nonCircularOptimization") and not f3b:
        return "superficie no circular (nonCircularOptimization)"
    for key, value in opts.items():
        if key in NEUTRAL_OPTION_KEYS:
            continue
        if f3b and key == "nonCircularOptimization":
            continue    # it is a field of the model in v0.6 (`analysis.search.non_circular`, F6.4)
        if (v02 or f3) and key in SEISMIC_OPTION_KEYS:
            continue
        if f3g and key in CRACK_OPTION_KEYS:
            continue
        if f3g and key == "porePressureHead" and value == "phreatic-correction":
            continue    # ogs has only the vertical head (E3); noted in the case (PHREATIC_NOTE)
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


def convert_f3b_material(m: dict, mid: str) -> dict:
    """Convert only explicitly representable HB/SHANSEP parameters (F6.2-3)."""
    src = m["model"]
    kind = src["kind"]
    allowed = ALLOWED_HB_KEYS if kind == "hoek-brown" else ALLOWED_SHANSEP_KEYS
    extra = sorted(set(src) - allowed)
    if extra:
        raise Omit(f"material '{m['name']}' con propiedad no soportada: " + ", ".join(extra))
    out = {"id": mid, "name": m["name"], "model": kind.replace("-", "_"),
           "unit_weight": num(src["unitWeight"])}
    for source, target in (("unitWeightSat", "unit_weight_sat"), ("ru", "ru")):
        if src.get(source) is not None:
            out[target] = num(src[source])
    if kind == "hoek-brown":
        for key in ("ucs", "gsi", "mi"):
            out[key] = num(src[key])
        out["disturbance"] = num(src.get("disturbance", 0))
    else:
        sources = [k for k in ("ocr", "pop", "ocrByElevation") if src.get(k) is not None]
        if len(sources) != 1:
            raise Omit(f"material '{m['name']}': SHANSEP requiere exactamente una fuente OCR (F6.3)")
        spec = {"ratio": num(src["ratio"])}
        if src.get("exponent") is not None:
            spec["exponent"] = num(src["exponent"])
        key = sources[0]
        spec["ocr_by_elevation" if key == "ocrByElevation" else key] = (
            [[num(y), num(ocr)] for y, ocr in src[key]] if key == "ocrByElevation" else num(src[key]))
        out["shansep"] = spec
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


def crack_signature(opts: dict) -> tuple | None:
    """The tension crack of one cSlope check: ``(depth | "auto", water fraction)`` or None (no crack)."""
    water = float(opts.get("tensionCrackWater") or 0.0)
    if opts.get("tensionCrackAuto"):
        return ("auto", water)
    depth = opts.get("tensionCrackDepth")
    if depth:
        return (float(depth), water)
    return None


def _convert(raw: dict, prob: dict | None, v02: bool, f3: bool, f3g: bool = False,
             f3b: bool = False) -> tuple[dict, list[str], list[int]]:
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
            # F3G: the crack is a model field; partialFactors and compositeBase only discard their own check
            if key.startswith(omit_prefixes) and not f3g:
                raise Omit(f"opción de check que cambia el problema: {key}")

    # materials
    materials, name2id = [], {}
    for m in d["materials"]:
        if set(m) - ALLOWED_MATERIAL_KEYS:
            raise Omit(f"material '{m.get('name')}' con propiedad no soportada: " + ", ".join(sorted(set(m) - ALLOWED_MATERIAL_KEYS)))
        model = m["model"]
        kind = model.get("kind")
        mid = snake(m["name"])
        if kind in ("hoek-brown", "shansep") and f3b:
            if not mid or mid in name2id.values():
                raise Omit(f"id de material vacío o repetido: '{m['name']}'")
            name2id[m["name"]] = mid
            materials.append(convert_f3b_material(m, mid))
            continue
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
        if water_above_ground(outer, piezo) and not f3g:
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
        if not mats and f3g:
            # a point that float noise leaves on the edge of its face (V089: x = -3.6e-15): it belongs to the one face it touches
            mats = {name2id[a["materialName"]] for a in assignments
                    if f.buffer(1e-6).contains(Point(a["point"]))
                    and sum(1 for g in faces if g.buffer(1e-6).contains(Point(a["point"]))) == 1}
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
        reason = option_reason(ck["method"], opts, v02, f3, f3g, f3b)
        if f3b and opts.get("nonCircularOptimization") and method == "bishop":
            reason = "Bishop no admite búsqueda no circular (F6.4)"
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

    crack = None
    if f3g:
        sigs = {crack_signature(ck.get("options", {})) for ck in kept_raw}
        if len(sigs) > 1:
            raise Omit("checks con grietas distintas en un mismo modelo: " + ", ".join(sorted(map(str, sigs))))
        sig = sigs.pop()
        if sig is not None:
            crack = {"depth": sig[0] if sig[0] == "auto" else num(sig[0]), "water_fill": num(sig[1])}
            if not 0.0 <= crack["water_fill"] <= 1.0:
                raise Omit(f"tensionCrackWater = {sig[1]:g} fuera de [0, 1] (contrato F5.2)")
            analysis_block["tension_crack"] = crack
            if sig[1] > 0 and water is None:
                # no piezometric line: the crack uses water.unit_weight (E12e); the oracle uses 9.807
                water = {"unit_weight": GAMMA_W[units]}
    if f3b:
        version = F6_VERSION
        if any(ck.get("options", {}).get("nonCircularOptimization") for ck in kept_raw):
            if any(not ck.get("options", {}).get("nonCircularOptimization") for ck in kept_raw):
                raise Omit("checks circulares y no circulares mezclados en un mismo modelo")
            if surface_kind != "search":
                raise Omit("nonCircularOptimization requiere búsqueda")
            analysis_block["search"]["non_circular"] = dict(NC_DEFAULTS)
    elif f3 and f3g and not crack:
        # F3G without a crack: the minimum version of its fields (F3.9, F5.1); ponded water has no field and needs none
        needs_03 = (any(mat.get("model") == "undrained" for mat in materials) or "interslice" in analysis_block
                    or analysis_block.get("surface", {}).get("type") == "polyline"
                    or any(x in methods for x in ("morgenstern_price", "janbu_simplified", "janbu_corrected")))
        version = F3_VERSION if needs_03 else ("0.2" if v02 and (seismic is not None or loads) else "0.1")
    elif f3:
        version = F5_VERSION if crack else F3_VERSION
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


# ---------------------------------------------------------------- reinforcements (batches R1 to R4, v0.4)
def convert_pullout(pullout: dict, where: str) -> dict:
    """cSlope ``pullout`` -> ogs ``pullout`` (F4.2). Raises Omit."""
    kind = pullout.get("kind")
    if kind == "bond":
        extra = sorted(set(pullout) - {"kind", "strength", "bondedLength"})
        if extra:
            raise Omit(f"{where}: pullout bond con propiedad no soportada: " + ", ".join(extra))
        out = {"model": "bond", "strength": num(pullout["strength"])}
        if pullout.get("bondedLength") is not None:
            out["bonded_length"] = num(pullout["bondedLength"])
        return out
    if kind == "interface":
        extra = sorted(set(pullout) - {"kind", "adhesion", "frictionAngle", "coverage"})
        if extra:
            raise Omit(f"{where}: pullout interface con propiedad no soportada: " + ", ".join(extra))
        # cSlope: a missing coverage is the continuous sheet, Rc = 1; ogs asks for it
        coverage = 1.0 if pullout.get("coverage") is None else pullout["coverage"]
        return {"model": "interface", "adhesion": num(pullout["adhesion"]),
                "friction_angle": num(pullout["frictionAngle"]), "coverage": num(coverage)}
    if kind == "development":
        extra = sorted(set(pullout) - {"kind", "length1", "length2"})
        if extra:
            raise Omit(f"{where}: pullout development con propiedad no soportada: " + ", ".join(extra))
        return {"model": "development", "length1": num(pullout["length1"]), "length2": num(pullout["length2"])}
    raise Omit(f"{where}: pullout {kind!r} no soportado")


def convert_reinforcements(cid: str, d: dict, ito_matsui: bool = False) -> tuple[list[dict], list[str]]:
    """``reinforcements`` and ``piles`` of a cSlope definition -> ogs v0.4 ``reinforcements`` (F4.2).

    Returns (list, notes). ``direction`` and ``application`` are always written (cSlope would take ``axial`` /
    ``active`` for tension elements and ``angle`` / ``active`` for piles; E14b has no default). ``prestress`` (only
    the finite element analysis uses it), ``diameter`` and ``location`` (no effect with a given force, E14m-3) are not
    written, and the case says so. Raises Omit for what v0.4 cannot express: Ito-Matsui piles (no ``force``) or a
    ``shearCapacity`` / ``momentCapacity``. With ``ito_matsui`` (batch F3I, v0.5) a pile without ``force`` becomes a
    ``lateral_pressure`` pile and ``shearCapacity`` / ``momentCapacity`` become its ``capacity`` (E15i-1).
    """
    out: list[dict] = []
    notes: list[str] = []
    ttype = F3R_TENSION_TYPE.get(cid, "anchor")
    dropped_prestress = 0
    for i, r in enumerate(d.get("reinforcements") or []):
        where = f"reinforcements[{i}]"
        extra = sorted(set(r) - TENSION_KEYS)
        if extra:
            raise Omit(f"{where} con propiedad no soportada: " + ", ".join(extra))
        item: dict = {"id": f"R{i + 1}", "type": ttype, "x1": num(r["x1"]), "y1": num(r["y1"]),
                      "x2": num(r["x2"]), "y2": num(r["y2"]),
                      "application": r.get("application") or "active",
                      "tensile_capacity": num(r["tensileCapacity"]),
                      "direction": r.get("direction") or "axial"}
        if item["application"] not in ("active", "passive") or item["direction"] not in ("axial", "tangent", "bisector"):
            raise Omit(f"{where}: application {item['application']!r} o direction {item['direction']!r} no soportadas")
        for src, dst in (("end1Capacity", "end1_capacity"), ("end2Capacity", "end2_capacity"), ("spacing", "spacing")):
            if r.get(src) is not None:
                item[dst] = num(r[src])
        if r.get("pullout") is not None:
            item["pullout"] = convert_pullout(r["pullout"], where)
        if r.get("prestress") not in (None, 0):
            dropped_prestress += 1
        out.append(item)
    if dropped_prestress:
        notes.append(f"prestress de {dropped_prestress} elemento(s) no se importa: solo lo usa el análisis de elementos "
                     "finitos de cSlope (en equilibrio límite la fuerza activa es la capacidad).")
    dropped_diameter = 0
    for i, p in enumerate(d.get("piles") or []):
        where = f"piles[{i}]"
        extra = sorted(set(p) - (PILE_KEYS_F3I if ito_matsui else PILE_KEYS))
        if extra:
            raise Omit(f"{where} con propiedad no soportada: " + ", ".join(extra))
        if p.get("force") is None:
            if not ito_matsui:
                raise Omit(f"{where}: pilote Ito-Matsui (sin force), fuera de v0.4")
            out.append(convert_ito_matsui_pile(i, p, where, notes))
            continue
        if ito_matsui and (p.get("shearCapacity") is not None or p.get("momentCapacity") is not None):
            raise Omit(f"{where}: shearCapacity o momentCapacity con force (E15i-1: capacity solo con lateral_pressure)")
        direction = p.get("direction") or "angle"
        if direction not in ("angle", "tangent", "perpendicular"):
            raise Omit(f"{where}: direction {direction!r} no soportada")
        application = p.get("application") or "active"
        base = {"x1": num(p["x1"]), "y1": num(p["y1"]), "x2": num(p["x2"]), "y2": num(p["y2"]),
                "application": application, "force": num(p["force"]), "direction": direction}
        if direction == "angle":
            base["angle"] = num(p.get("angle") or 0.0)
        elif p.get("angle") is not None:
            raise Omit(f"{where}: angle con direction {direction!r}")
        if p.get("diameter") is not None:
            dropped_diameter += 1
        if p.get("wall") is True:
            # a wall: ogs `sheet_pile` has the force per metre of wall and no spacing
            spacing = float(p.get("spacing") or 1.0)
            base["force"] = num(float(p["force"]) / spacing)
            out.append({"id": f"S{i + 1}", "type": "sheet_pile", **base})
            notes.append(f"{where}: wall true; force por metro = force / spacing = {base['force']:g}.")
        else:
            if p.get("spacing") is not None:
                base["spacing"] = num(p["spacing"])
            out.append({"id": f"P{i + 1}", "type": "pile", **base})
    if dropped_diameter:
        notes.append(f"diameter de {dropped_diameter} pilote(s) no se importa: con force dada no interviene (solo "
                     "Ito-Matsui y el análisis de elementos finitos lo usan).")
    return out, notes


def convert_f3r(raw: dict, prob: dict | None) -> tuple[dict, list[str], list[int]]:
    """Convert one cSlope case with ``reinforcements`` or ``piles`` into a v0.4 case (batches R1 to R4).

    The rest of the problem goes through the same conversion as batches 1 and 2 (``_convert`` with v0.2 loads and the
    v0.3 fields); the reinforcements are taken out of the definition first and written as ``model.reinforcements``.
    """
    d = raw["definition"]
    if not (d.get("reinforcements") or d.get("piles")):
        raise Omit("sin reinforcements ni piles")
    stripped = {**raw, "definition": {k: v for k, v in d.items() if k not in ("reinforcements", "piles")}}
    case, discarded, batches = _convert(stripped, prob, v02=True, f3=True)
    items, notes = convert_reinforcements(raw["id"], d)
    model = {}
    for key, value in case["model"].items():
        if key == "slope":
            model["reinforcements"] = items
        model[key] = value
    model["version"] = F4_VERSION
    case = {**case, "model": model}
    case["source"] = {**case["source"], "notes": case["source"]["notes"] + notes}
    return case, discarded, batches


def convert_ito_matsui_pile(i: int, p: dict, where: str, notes: list[str]) -> dict:
    """A cSlope pile without ``force`` (Ito-Matsui, ``diameter``) -> an ogs v0.5 ``pile`` with ``lateral_pressure`` (E15i-1).

    ``application``, ``direction`` and ``angle`` are written as for the other piles (cSlope's defaults, ``active`` and
    ``angle`` 0, become explicit); ``location`` defaults to ``centroid`` like cSlope and is always written, as E15i-1
    asks. ``shearCapacity`` and ``momentCapacity`` become ``capacity.shear`` and ``capacity.moment``. Raises Omit when
    ogs would reject it: a pile that is not vertical, ``diameter`` <= 0, ``spacing`` <= ``diameter``.
    """
    diameter = p.get("diameter")
    if not isinstance(diameter, (int, float)) or not diameter > 0:
        raise Omit(f"{where}: pilote Ito-Matsui sin diameter > 0")
    if abs(float(p["x2"]) - float(p["x1"])) > PILE_VERTICAL_TOL:
        raise Omit(f"{where}: pilote Ito-Matsui no vertical (E15i-1)")
    spacing = p.get("spacing")
    spacing = 1.0 if spacing is None else float(spacing)
    if not spacing > float(diameter):
        raise Omit(f"{where}: spacing {spacing:g} no es mayor que diameter {float(diameter):g} (E15i-1)")
    direction = p.get("direction") or "angle"
    if direction not in ("angle", "tangent", "perpendicular"):
        raise Omit(f"{where}: direction {direction!r} no soportada")
    location = p.get("location") or "centroid"
    if location not in F3I_LOCATIONS:
        raise Omit(f"{where}: location {location!r} no soportada")
    item: dict = {"id": f"P{i + 1}", "type": "pile", "x1": num(p["x1"]), "y1": num(p["y1"]),
                  "x2": num(p["x2"]), "y2": num(p["y2"]), "application": p.get("application") or "active",
                  "direction": direction}
    if direction == "angle":
        item["angle"] = num(p.get("angle") or 0.0)
    elif p.get("angle") is not None:
        raise Omit(f"{where}: angle con direction {direction!r}")
    item["spacing"] = num(spacing)
    item["lateral_pressure"] = {"model": "ito_matsui", "diameter": num(diameter), "location": F3I_LOCATIONS[location]}
    capacity = {}
    for src, dst in (("shearCapacity", "shear"), ("momentCapacity", "moment")):
        if p.get(src) is not None:
            if not p[src] > 0:
                raise Omit(f"{where}: {src} {p[src]!r} no es mayor que 0")
            capacity[dst] = num(p[src])
    if capacity:
        item["capacity"] = capacity
    how = "de la fuente" if p.get("location") else "por defecto de cSlope"
    angle = f" {item['angle']:g}" if direction == "angle" else ""
    notes.append(f"{where}: pilote Ito-Matsui (E15i): diameter {float(diameter):g} pasa a lateral_pressure; location "
                 f"{location} ({how}); direction {direction}{angle} (la fuente no lleva el campo: cSlope toma `angle` 0, "
                 "horizontal, perpendicular a un pilote vertical).")
    return item


def convert_f3i(raw: dict, prob: dict | None) -> tuple[dict, list[str], list[int]]:
    """Convert one cSlope case with Ito-Matsui piles into a v0.5 case with ``lateral_pressure`` (batch F3I, E15i-10)."""
    d = raw["definition"]
    if not any(p.get("force") is None for p in d.get("piles") or []):
        raise Omit("sin pilotes Ito-Matsui")
    stripped = {**raw, "definition": {k: v for k, v in d.items() if k not in ("reinforcements", "piles")}}
    case, discarded, batches = _convert(stripped, prob, v02=True, f3=True)
    items, notes = convert_reinforcements(raw["id"], d, ito_matsui=True)
    model = {}
    for key, value in case["model"].items():
        if key == "slope":
            model["reinforcements"] = items
        model[key] = value
    model["version"] = F5_VERSION
    case = {**case, "model": model}
    case["source"] = {**case["source"], "notes": case["source"]["notes"] + notes}
    return case, discarded, batches


def schema_with_ito_matsui(schema: dict) -> dict:
    """The 0.5 schema with the pile of E15i-1: ``force`` optional, ``lateral_pressure`` and ``capacity`` added.

    Used while ``schema/ogs-0.5.schema.json`` does not know ``lateral_pressure`` (the engine side adds it with E15i); once
    it does, the schema is used as it is. ``force`` and ``lateral_pressure`` excluding each other is checked by ``gate_f3i``.
    """
    if "lateral_pressure" in schema["$defs"]["pile"]["properties"]:
        return schema
    s = json.loads(json.dumps(schema))
    pile = s["$defs"]["pile"]
    pile["required"] = [k for k in pile["required"] if k != "force"]
    pile["properties"]["lateral_pressure"] = {
        "type": "object", "additionalProperties": False, "required": ["model", "diameter", "location"],
        "properties": {"model": {"const": "ito_matsui"}, "diameter": {"type": "number", "exclusiveMinimum": 0},
                       "location": {"enum": ["centroid", "slip_surface"]}}}
    pile["properties"]["capacity"] = {
        "type": "object", "additionalProperties": False, "minProperties": 1,
        "properties": {"shear": {"type": "number", "exclusiveMinimum": 0},
                       "moment": {"type": "number", "exclusiveMinimum": 0}}}
    return s


def gate_f3i(case: dict, schema: dict) -> list[str]:
    """E15i-1: the model against the 0.5 schema, plus what the schema cannot say."""
    errors = gate_schema_f3r(case, schema_with_ito_matsui(schema))
    m = case.get("model") or {}
    if m.get("version") != F5_VERSION:
        errors.append('lateral_pressure requiere version "0.5"')
    errors += gate_reinforcements({**case, "model": {**m, "version": F4_VERSION}})
    for r in m.get("reinforcements") or []:
        if r["type"] != "pile":
            continue
        if ("force" in r) == ("lateral_pressure" in r):
            errors.append(f"pilote {r['id']}: force y lateral_pressure se excluyen y debe haber uno")
        if "capacity" in r and "lateral_pressure" not in r:
            errors.append(f"pilote {r['id']}: capacity sin lateral_pressure")
        if "lateral_pressure" in r:
            if abs(r["x2"] - r["x1"]) > PILE_VERTICAL_TOL:
                errors.append(f"pilote {r['id']}: no es vertical")
            if not r.get("spacing", 1.0) > r["lateral_pressure"]["diameter"]:
                errors.append(f"pilote {r['id']}: spacing no es mayor que diameter")
    return errors


def gate_reinforcements(case: dict) -> list[str]:
    """F4.2 rules that JSON Schema cannot express: version, unique ids, length > 0, sheet_pile vertical, bonded_length."""
    errors = []
    m = case.get("model") or {}
    items = m.get("reinforcements") or []
    if items and m.get("version") != F4_VERSION:
        errors.append('reinforcements requiere version "0.4"')
    ids = [r["id"] for r in items]
    if len(set(ids)) != len(ids):
        errors.append("ids de refuerzo repetidos")
    for r in items:
        length = ((r["x2"] - r["x1"]) ** 2 + (r["y2"] - r["y1"]) ** 2) ** 0.5
        if not length > 0:
            errors.append(f"refuerzo {r['id']}: longitud nula")
        if r["type"] == "sheet_pile" and r["x1"] != r["x2"]:
            errors.append(f"tablestaca {r['id']}: x1 != x2")
        bonded = (r.get("pullout") or {}).get("bonded_length")
        if bonded is not None and bonded > length:
            errors.append(f"refuerzo {r['id']}: bonded_length > longitud")
    return errors


def gate_schema_f3r(case: dict, schema: dict) -> list[str]:
    """The model against the real `schema/ogs-0.4.schema.json`; the checks against the case schema without its model."""
    validator = jsonschema.validators.validator_for(schema)
    errors = [f"model{e.json_path[1:]}: {e.message}" for e in validator(schema).iter_errors(case.get("model"))]
    case_schema = {**CASE_SCHEMA, "properties": {**CASE_SCHEMA["properties"], "model": {}}}
    errors += [f"{e.json_path}: {e.message}" for e in jsonschema.Draft202012Validator(case_schema).iter_errors(case)]
    m = case.get("model") or {}
    analysis = m.get("analysis") or {}
    if (m.get("meta") or {}).get("id") != case.get("id"):
        errors.append("meta.id distinto de id")
    if case.get("checks") and {c.get("kind") for c in case["checks"]} != {"fixed" if "surface" in analysis else "search"}:
        errors.append("kind de los checks no coincide con el tipo de análisis")
    if not {c.get("method") for c in case.get("checks") or []} <= set(analysis.get("methods") or []):
        errors.append("methods no cubre los checks")
    return errors


def held_label(held_cases: list[dict]) -> str:
    """«V035b ×2, V083»: the held checks of F3R per case."""
    return ", ".join(c["id"] + (f" ×{len(c['checks'])}" if len(c["checks"]) > 1 else "") for c in held_cases)


def build_f3r_section(cases: list[dict], lots: dict[str, str], report: dict | None, held_cases: list[dict] | None = None,
                      ito_promoted: bool = False) -> str:
    """Section of `cases/INDEX.md` for the promoted batches R1 to R4: published value, ogs and cSlope per check (from
    the `report.json` that `verification/harness/run.py` writes for `verification/cases`)."""
    rows = {}
    for r in (report or {}).get("checks", []):
        rows[(r["case_id"], r["method"], r["published"])] = r
    n_checks = sum(len(c["checks"]) for c in cases)
    lines = [
        "## Casos con refuerzos (v0.4, lotes R1 a R4)",
        "",
        f"**{len(cases)}** casos con **{n_checks}** checks, promovidos desde `verification/pending/F3R` cuando el motor de "
        "los refuerzos reproduce el valor publicado dentro de su tolerancia. No se relajó ninguna tolerancia ni se tocó "
        "ningún dato del problema. Los lotes son los de F4.12: " + "; ".join(
            f"**{lot}** {name} ({', '.join(ids)})" for lot, (name, ids) in F3R_BATCHES.items()) + ".",
        "",
        F3I_F3R_NOTE_PROMOTED if ito_promoted else "V013b a V013e (Ito-Matsui, sin `force`) quedan fuera de v0.4 y siguen sin importarse.",
        "",
    ]
    n_held = sum(len(c["checks"]) for c in held_cases or [])
    if n_held:
        lines += [f"**{n_held}** checks más ({held_label(held_cases)}) quedan retenidos en `verification/pending/F3R` "
                  "(`HOLD.json`): su FS reproduce el publicado, pero el motor emite `negative_effective_normal_major` y el test "
                  "de aceptación lo rechaza. Es una tracción real del modelo, presente también sin refuerzos; E14n-1 de §F4.17 "
                  "(adoptada) solo elimina el aviso en V014, donde venía de dovelas finas de cruce.", ""]
    if not rows:
        lines += ["No hay `verification/report.json` con estos casos: corra el harness sobre `verification/cases` y "
                  "regenere este índice.", ""]
    lines += ["| lote | caso | refuerzos | método | publicado | por | tol % | ogs | Δ ogs % | cSlope | Δ cSlope % "
              "| cruces ogs / oráculo |",
              "|---|---|---:|---|---:|---|---:|---:|---:|---:|---:|---|"]
    idle = []
    for case in cases:
        n_items = len(case["model"]["reinforcements"])
        for c in case["checks"]:
            r = rows.get((case["id"], c["method"], c["published"]))
            og = cs = d_og = d_cs = crossings = "—"
            if r is not None:
                fmt = lambda v, f: "—" if v is None else format(v, f)  # noqa: E731
                og, d_og = fmt(r["ogs"]["fos"], ".4f"), fmt(r["ogs"]["err_pct"], "+.2f")
                cs, d_cs = fmt(r["cslope"]["fos"], ".4f"), fmt(r["cslope"]["err_pct"], "+.2f")
                cmp_ = r.get("forces_comparison")
                if cmp_:
                    crossings = f"{cmp_['n_ogs']} / {cmp_['n_oracle']}"
                    if cmp_["n_ogs"] == 0 and cmp_["n_oracle"] == 0:
                        idle.append((case["id"], c["method"], c["published"]))
            lines.append(f"| {lots[case['id']]} | {case['id']} | {n_items} | {c['method']} | {c['published']} "
                         f"| {md_cell(c['published_by'])} | {100 * c['tolerance']:.2f} | {og} | {d_og} | {cs} | {d_cs} "
                         f"| {crossings} |")
    if idle:
        lines += ["", "### Checks en los que ningún motor aplica fuerza", "",
                  "Con 0 / 0 cruces la superficie fija no corta ningún elemento (en V016b, los tres quedan dentro del "
                  "círculo), así que el FS es el del talud sin refuerzo y el acuerdo con el publicado **no prueba nada "
                  "sobre los refuerzos**: " + ", ".join(f"{cid} ({m}, {pub})" for cid, m, pub in idle) + ".", ""]
    lines += ["", "La comparación por cruce de las fuerzas (posición, fuerza y dirección de ogs y del oráculo) está en "
              "[`../REPORT.md`](../REPORT.md), sección «Comparación por cruce».", ""]
    return "\n".join(lines)


def build_f3r_promoted_index(cases: list[dict], omitted: list[tuple[str, str]], held: list[dict] | None = None,
                             hold: dict[tuple, dict] | None = None, ito_promoted: bool = False) -> str:
    """INDEX.md left in pending/F3R once the batches are promoted (`cases` are all the converted ones, held included)."""
    held = held or []
    n_held = sum(len(c["checks"]) for c in held)
    n_all = sum(len(c["checks"]) for c in cases)
    lines = [
        "# Casos con refuerzos (lotes R1 a R4): promovidos y retenidos",
        "",
        "Generado por `verification/tools/import_cslope.py`. No editar a mano.",
        "",
        f"Los **{len(cases)}** casos de los lotes R1 a R4 (**{n_all}** checks, formato v0.4) pasaron a "
        "[`../../cases/`](../../cases/INDEX.md), con su tabla en la sección «Casos con refuerzos»"
        + (f", salvo **{n_held}** checks retenidos aquí (`HOLD.json`: tracción real del modelo, también sin refuerzos; E14n-1 de §F4.17 adoptada); "
           "la tabla de abajo los lista con su número y el diagnóstico." if held else ". No queda ninguno retenido."),
        "",
    ]
    if held:
        lines += [
            "Cada check retenido está convertido igual que los de `verification/cases/`; el FS reproduce el publicado, pero "
            "el motor emite `negative_effective_normal_major` y el test de aceptación rechaza ese aviso (E5). No se relaja "
            "ninguna tolerancia ni se toca ningún dato. Se promueven quitándolos de `HOLD.json` y regenerando.",
            "",
            "| caso | método | publicado | por | tol % | ogs | cSlope | motivo y diagnóstico |",
            "|---|---|---:|---|---:|---:|---:|---|",
        ]
        for case in held:
            for c in case["checks"]:
                e = (hold or {})[check_key(case["id"], c)]

                def f(v):
                    return "—" if v is None else f"{v:.4f}"
                lines.append(f"| {case['id']} | {c['method']} | {c['published']} | {md_cell(c['published_by'])} "
                             f"| {100 * c['tolerance']:.2f} | {f(e.get('ogs'))} | {f(e.get('cslope'))} "
                             f"| {md_cell(e.get('diagnosis', ''))} |")
        lines.append("")
    lines.append((F3I_F3R_NOTE_PROMOTED if ito_promoted else
                  "V013b a V013e (Ito-Matsui, sin `force`) quedan fuera de v0.4 y siguen sin importarse.")
                 + ("" if not omitted else " No entran: " + "; ".join(f"{cid} ({md_cell(r)})" for cid, r in omitted) + "."))
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------- tension crack and ponded water (batch F3G, v0.5)
def raw_ponded(d: dict) -> bool:
    """True if the piezometric line of the cSlope definition goes above the ground (ponded water)."""
    wt = d.get("waterTable")
    if not wt or wt.get("mode") != "custom" or wt.get("followBoundary") or len(wt.get("value") or []) < 2:
        return False
    piezo = [[num(x), num(y)] for x, y in wt["value"]]
    if any(b[0] <= a[0] for a, b in zip(piezo, piezo[1:])):
        return False
    return water_above_ground(Polygon(d["coordinates"]), piezo)


def crack_suffix(sig: tuple) -> str:
    return "auto" if sig[0] == "auto" else f"d{sig[0]:g}"


def convert_f3g(raw: dict, prob: dict | None) -> list[tuple[dict, list[str], list[int]]]:
    """Convert one cSlope case with a tension crack and / or ponded water into v0.5 cases (batch F3G).

    The crack is a field of the model (`analysis.tension_crack`), not of the check: the checks of a problem that
    ask for different cracks (V086b: a fixed depth of 2 m and the automatic one) go to different cases. The first
    group keeps the id; the others are `<id>-auto` or `<id>-d<depth>`. A case without a crack is written with the
    minimum version of its fields (v0.1 to v0.3, F3.9); the ponded water has no field (F5.3). Returns [] if the problem has neither a
    crack nor ponded water (it belongs to the earlier batches). Raises Omit if no group converts.
    """
    d = raw["definition"]
    sigs: list = []
    for ck in raw["checks"]:
        sig = crack_signature(ck.get("options", {}))
        if sig not in sigs:
            sigs.append(sig)
    ponded = raw_ponded(d)
    if not ponded and not any(s is not None for s in sigs):
        return []
    out, reasons = [], []
    for sig in sigs:
        group = [ck for ck in raw["checks"] if crack_signature(ck.get("options", {})) == sig]
        try:
            case, discarded, batches = _convert({**raw, "checks": group}, prob, v02=True, f3=True, f3g=True)
        except Omit as exc:
            reasons.append(str(exc))
            continue
        notes = []
        if any((ck.get("options") or {}).get("porePressureHead") == "phreatic-correction" for ck in group):
            notes.append(PHREATIC_NOTE)
        if sig is not None:
            notes.append(
                f"grieta de tracción: profundidad {'automática (Rankine)' if sig[0] == 'auto' else format(sig[0], 'g') + ' m'}, "
                f"fracción de agua {sig[1]:g} (cSlope tensionCrack{'Auto' if sig[0] == 'auto' else 'Depth'} y tensionCrackWater); "
                "en ogs es `analysis.tension_crack {depth, water_fill}` (F5.2).")
        if ponded:
            notes.append("agua embalsada: la piezométrica pasa sobre el terreno; ogs la incluye en todas las versiones, con su "
                         "peso y su empuje horizontal y sin sismo (F5.3); cSlope la carga con `followBoundary: false`.")
        if out:   # not the first group
            new_id = f"{raw['id']}-{crack_suffix(sig)}"
            notes.append(f"derivado de {raw['id']}: la grieta es un campo del modelo y este problema tiene checks con otra grieta; "
                         f"este caso tiene los checks con la grieta {crack_suffix(sig)}.")
            model = {**case["model"], "meta": {**case["model"]["meta"], "id": new_id}}
            case = {**case, "id": new_id, "title": f"{case['title']} ({crack_suffix(sig)})", "model": model}
        case["source"] = {**case["source"], "notes": case["source"]["notes"] + notes}
        out.append((case, discarded, batches))
    if not out:
        raise Omit(reasons[0] if reasons else "sin checks válidos")
    return out


def gate_f3g(case: dict, schema: dict) -> list[str]:
    """The model against the real `schema/ogs-0.5.schema.json` plus what the schema cannot say (F5.1, F5.2)."""
    errors = gate_schema_f3r(case, schema)
    m = case.get("model") or {}
    a = m.get("analysis") or {}
    crack = a.get("tension_crack")
    if crack is not None:
        if m.get("version") != F5_VERSION:
            errors.append('tension_crack requiere version "0.5"')
        depth = crack.get("depth")
        if not (depth == "auto" or (isinstance(depth, (int, float)) and depth > 0)):
            errors.append("tension_crack.depth debe ser un número > 0 o \"auto\"")
        if not 0.0 <= crack.get("water_fill", -1.0) <= 1.0:
            errors.append("tension_crack.water_fill fuera de [0, 1]")
        if crack.get("water_fill", 0) > 0 and not (m.get("water") or {}).get("unit_weight"):
            errors.append("grieta con agua sin water.unit_weight")
    elif m.get("version") == F5_VERSION:
        errors.append("version 0.5 sin tension_crack (la versión mínima es otra)")
    return errors


def _f3g_features(case: dict, raw_by_id: dict[str, dict] | None = None) -> tuple[str, str]:
    """(crack, ponded water) text of a F3G case: «2 m, water_fill 1» or «—», and «sí» / «no»."""
    crack = case["model"]["analysis"].get("tension_crack")
    c = "—" if crack is None else (f"{'auto' if crack['depth'] == 'auto' else format(crack['depth'], 'g') + ' m'}, "
                                  f"water_fill {crack['water_fill']:g}")
    outline = unary_union([Polygon(r["polygon"]) for r in case["model"]["regions"]])
    piezo = (case["model"].get("water") or {}).get("piezometric_line") or []
    pond = "sí" if len(piezo) >= 2 and water_above_ground(outline, piezo) else "no"
    return c, pond


def build_f3g_section(cases: list[dict], report: dict | None, held_cases: list[dict] | None = None) -> str:
    """Section of `cases/INDEX.md` for the promoted batch F3G: published value, ogs and cSlope per check (from the
    `report.json` that `verification/harness/run.py` writes for `verification/cases`)."""
    rows = {}
    for r in (report or {}).get("checks", []):
        rows[(r["case_id"], r["method"], r["published"])] = r
    n_checks = sum(len(c["checks"]) for c in cases)
    n_held = sum(len(c["checks"]) for c in held_cases or [])
    lines = [
        "## Grieta de tracción y agua embalsada (lote F3G, v0.5)",
        "",
        f"**{len(cases)}** casos con **{n_checks}** checks, promovidos desde `verification/pending/F3G` cuando el motor de la "
        "grieta y del agua embalsada (F5.2 y F5.3) reproduce el valor publicado dentro de su tolerancia. Con grieta el caso es "
        "v0.5 (`analysis.tension_crack`); sin grieta lleva la versión mínima de sus campos (v0.1 a v0.3) y el agua embalsada "
        "la activa que la piezométrica pase sobre el terreno (F5.3). La grieta es un campo del modelo, no del check: los checks de V086b con otra grieta están en "
        "`V086b-auto`. La tolerancia es la del corpus de cSlope, leída como **relativa** (`|Δ|/publicado ≤ tolerancia`), la "
        "misma convención de los demás casos; no se relajó ninguna ni se tocó ningún dato.",
        "",
    ]
    if n_held:
        lines += [f"**{n_held}** checks más ({held_label(held_cases)}) quedan retenidos en `verification/pending/F3G` "
                  "(`HOLD.json`), con los números y la causa medida.", ""]
    if not rows:
        lines += ["No hay `verification/report.json` con estos casos: corra el harness sobre `verification/cases` y "
                  "regenere este índice.", ""]
    lines += ["| caso | v | grieta | agua embalsada | método | publicado | por | tol % | ogs | Δ ogs % | cSlope | Δ cSlope % |",
              "|---|---|---|---|---|---:|---|---:|---:|---:|---:|---:|"]
    for case in sorted(cases, key=lambda c: (c["id"].split("-")[0], c["id"])):
        crack, pond = _f3g_features(case)
        for c in case["checks"]:
            r = rows.get((case["id"], c["method"], c["published"]))
            og = cs = d_og = d_cs = "—"
            if r is not None:
                fmt = lambda v, f: "—" if v is None else format(v, f)  # noqa: E731
                og, d_og = fmt(r["ogs"]["fos"], ".4f"), fmt(r["ogs"]["err_pct"], "+.2f")
                cs, d_cs = fmt(r["cslope"]["fos"], ".4f"), fmt(r["cslope"]["err_pct"], "+.2f")
            lines.append(f"| {case['id']} | {case['model']['version']} | {crack} | {pond} | {c['method']} | {c['published']} "
                         f"| {md_cell(c['published_by'])} | {100 * c['tolerance']:.2f} | {og} | {d_og} | {cs} | {d_cs} |")
    lines.append("")
    return "\n".join(lines)


def build_f3g_index(cases: list[dict], held_cases: list[dict], hold: dict[tuple, dict], omitted: list[tuple[str, str]],
                    discarded: dict[str, list[str]], raw_by_id: dict[str, dict]) -> str:
    """INDEX.md left in pending/F3G once the batch is promoted (`cases` are the promoted ones, `held_cases` the checks
    that the engine does not reproduce)."""
    n_ok = sum(len(c["checks"]) for c in cases)
    n_held = sum(len(c["checks"]) for c in held_cases)
    lines = [
        "# Grieta de tracción y agua embalsada (F3G, formato v0.5): promovidos y retenidos",
        "",
        "Generado por `verification/tools/import_cslope.py`. No editar a mano.",
        "Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.",
        "",
        f"**{len(cases)}** casos con **{n_ok}** checks pasaron a [`../../cases/`](../../cases/INDEX.md) (sección «Grieta de "
        "tracción y agua embalsada», con la tabla del publicado, ogs y cSlope por check)"
        + (f", salvo **{n_held}** checks retenidos aquí (`HOLD.json`); la tabla de abajo los lista con sus números y la "
           "causa medida." if held_cases else ". No queda ninguno retenido."),
        "",
        "**Convención de tolerancia.** El diagnóstico previo (`docs/fase3/exploracion/X18.md` §3.1) leyó la tolerancia del "
        "corpus como absoluta (`tolerance/publicado`) y dio por fuera V009b, V087 y V092 (tres métodos). El harness, "
        "`acceptance.rs` y el informe de cSlope la leen como relativa (`|Δ|/publicado ≤ tolerance`), la convención de los "
        "demás casos. Con ella el oráculo y ogs reproducen esos cinco checks: V087 y V092 (tres métodos) se promovieron y "
        "V009b (Spencer) se retiene por otro motivo, el aviso de cortante entre dovelas (véase la tabla). Ninguno se retiene "
        "por la tolerancia. No se relaja ninguna tolerancia ni se toca ningún dato.",
        "",
        "Un caso sin grieta se escribe con la versión mínima de sus campos (v0.1 a v0.3); con grieta, en v0.5. El agua "
        "embalsada no tiene campo: la activa que la piezométrica pase sobre el terreno (F5.3).",
        "",
    ]
    if held_cases:
        lines += ["## Checks retenidos", "",
                  "Cada check retenido está convertido igual que los de `verification/cases/`. Se promueven quitándolos de "
                  "`HOLD.json` y regenerando, cuando el motor o el oráculo los reproduzcan.", "",
                  "| caso | método | publicado | por | tol % | ogs | cSlope | motivo y diagnóstico |",
                  "|---|---|---:|---|---:|---:|---:|---|"]

        def f(v):
            return "—" if v is None else f"{v:.4f}"
        for case in held_cases:
            for c in case["checks"]:
                e = hold[check_key(case["id"], c)]
                lines.append(f"| {case['id']} | {c['method']} | {c['published']} | {md_cell(c['published_by'])} "
                             f"| {100 * c['tolerance']:.2f} | {f(e.get('ogs'))} | {f(e.get('cslope'))} | {md_cell(e.get('diagnosis', ''))} |")
        lines.append("")
    lines += ["## Problemas con grieta o agua embalsada que no entran en F3G", ""]
    lines += [f"- {cid}: {md_cell(r)}" for cid, r in omitted] or ["- ninguno"]
    dropped = {k: v for k, v in discarded.items() if v}
    if dropped:
        lines += ["", "## Checks descartados dentro de los casos", ""]
        lines += [f"- {cid}: {md_cell(x)}" for cid, v in sorted(dropped.items()) for x in v]
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------- Ito-Matsui piles (batch F3I, v0.5, E15i-10)
F3I_PROMOTE_COMMAND = (
    "uv run --python 3.13 --no-project --with shapely --with jsonschema python verification/tools/import_cslope.py "
    "--src $TMPDIR/cslope-src --promote-f3i")
F3I_REPORT_COMMAND = (
    "uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely python verification/harness/run.py "
    "--cases verification/cases --ogs target/release/ogs --out verification")


def _f3i_rows(report: dict | None) -> dict:
    return {(r["case_id"], r["method"], r["published"]): r for r in (report or {}).get("checks", [])}


def _f3i_table(cases: list[dict], report: dict | None, lead: str = "") -> list[str]:
    rows = _f3i_rows(report)
    lines = [f"| {lead}caso | D1/D | método | publicado | por | tol % | ogs | Δ ogs % | cSlope | Δ cSlope % |",
             f"|{'---|' if lead else ''}---|---:|---|---:|---|---:|---:|---:|---:|---:|"]
    fmt = lambda v, f: "—" if v is None else format(v, f)  # noqa: E731
    for case in cases:
        pile = next(r for r in case["model"]["reinforcements"] if "lateral_pressure" in r)
        ratio = pile["spacing"] / pile["lateral_pressure"]["diameter"]
        for c in case["checks"]:
            r = rows.get((case["id"], c["method"], c["published"]))
            og = d_og = cs = d_cs = "—"
            if r is not None:
                og, d_og = fmt(r["ogs"]["fos"], ".4f"), fmt(r["ogs"]["err_pct"], "+.2f")
                cs, d_cs = fmt(r["cslope"]["fos"], ".4f"), fmt(r["cslope"]["err_pct"], "+.2f")
            lines.append(f"| {lead and 'F3I | '}{case['id']} | {ratio:g} | {c['method']} | {c['published']} "
                         f"| {md_cell(c['published_by'])} | {100 * c['tolerance']:.2f} | {og} | {d_og} | {cs} | {d_cs} |")
    return lines


def build_f3i_section(cases: list[dict], report: dict | None) -> str:
    """Section of `cases/INDEX.md` for the promoted batch F3I: published value, ogs and cSlope per check."""
    n_checks = sum(len(c["checks"]) for c in cases)
    lines = [
        "## Pilotes de Ito-Matsui (lote F3I, v0.5)",
        "",
        f"**{len(cases)}** casos con **{n_checks}** checks (V013b a V013e, Cai y Ugai 2000, filas de D1/D = 2, 3, 4 y 6), "
        "promovidos desde `verification/pending/F3I` cuando el motor de E15i reproduce el valor publicado dentro de su "
        "tolerancia. Cada pilote lleva `lateral_pressure` (`ito_matsui`, `diameter`, `location`) y no `force`; la fuente no trae "
        "`direction` ni `location`, y se escriben los valores de cSlope (`angle` 0 y `centroid`). No se relajó ninguna "
        "tolerancia ni se tocó ningún dato del problema.",
        "",
    ]
    if not _f3i_rows(report):
        lines += ["No hay `verification/report.json` con estos casos: corra el harness sobre `verification/cases` y "
                  "regenere este índice.", ""]
    lines += _f3i_table(cases, report)
    lines.append("")
    return "\n".join(lines)


def build_f3i_index(cases: list[dict], report: dict | None, promoted: bool) -> str:
    """INDEX.md of pending/F3I: the cases that wait for the engine of E15i (or, once promoted, where they went)."""
    n_checks = sum(len(c["checks"]) for c in cases)
    lines = [
        "# Pilotes de Ito-Matsui (lote F3I, formato v0.5): V013b a V013e",
        "",
        "Generado por `verification/tools/import_cslope.py`. No editar a mano.",
        "Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.",
        "",
    ]
    if promoted:
        lines += [f"Los **{len(cases)}** casos (**{n_checks}** checks) pasaron a [`../../cases/`](../../cases/INDEX.md) (sección "
                  "«Pilotes de Ito-Matsui»). Aquí no queda ningún caso.", ""]
        return "\n".join(lines)
    lines += [
        f"**{len(cases)}** casos con **{n_checks}** checks de búsqueda de Bishop, en v0.5 con `lateral_pressure` (E15i-1). "
        "Esperan al motor de E15i (G3): hoy los excluye de `cases/` el motivo «Ito-Matsui» (el pilote no lleva `force`). "
        "Cada caso es el de `verification/cases/` de cSlope más el pilote: `lateral_pressure {model: \"ito_matsui\", "
        "diameter: 0.8, location: \"centroid\"}`, `application: passive` (la fuente), `direction: angle` con `angle: 0` "
        "(horizontal: perpendicular a un pilote vertical, E15i-6; cSlope toma `angle` 0 si la fuente no trae `direction`) y "
        "`location` `centroid` (el valor por defecto de cSlope, el de Cai y Ugai 2000, ecuación 9). Sin `capacity`: la fuente "
        "no trae capacidades. No se relaja ninguna tolerancia ni se toca ningún dato del problema.",
        "",
        "La columna del oráculo sale de `harness/run.py --oracle-only` sobre este directorio (`report.json`, `REPORT.md`); "
        "la de ogs queda vacía hasta que el motor de E15i exista. El oráculo da entre +0,05 % y +0,50 % sobre el publicado "
        "(X22 §5.1).",
        "",
    ]
    if not _f3i_rows(report):
        lines += ["No hay `report.json` en este directorio: genérelo con `run.py --oracle-only` y regenere este índice.", ""]
    lines += _f3i_table(cases, report)
    lines += [
        "",
        "## Promoción a `verification/cases/` (la hace el integrador)",
        "",
        "Cuando el motor de E15i está integrado (`ogs analyze` acepta `lateral_pressure` y el esquema 0.5 lo trae), desde la "
        "raíz del worktree:",
        "",
        "```",
        "export TMPDIR=<directorio temporal>",
        "cargo build --release -p ogs-cli",
        "env -u PYTHONPATH -u PYTHONHOME " + F3I_PROMOTE_COMMAND,
        "env -u PYTHONPATH -u PYTHONHOME " + F3I_REPORT_COMMAND,
        "env -u PYTHONPATH -u PYTHONHOME " + F3I_PROMOTE_COMMAND,
        "sed -i 's/^F3I_PROMOTED = False/F3I_PROMOTED = True/' verification/tools/import_cslope.py",
        "```",
        "",
        "La primera orden escribe los 4 casos en `verification/cases/` (y vacía este directorio); la segunda regenera "
        "`verification/report.json` y `REPORT.md` con el motor real; la tercera arma el `INDEX.md` de `cases/` con las cifras "
        "(sección «Pilotes de Ito-Matsui»); la cuarta deja la promoción como comportamiento por defecto del importador, para "
        "que una ejecución sin la opción no los borre. Después: `verification/cases` pasa de 147 a 151 casos y de 323 a 327 "
        "checks (la aceptación de Rust cuenta los checks por el directorio), y el informe de cSlope da 326 de 327 si el "
        "oráculo los reproduce (322 de 323 hoy).",
        "",
    ]
    return "\n".join(lines)


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
    if (loads or seismic) and m.get("version") not in ("0.2", F3_VERSION, F4_VERSION, F5_VERSION):
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
    if needs_03 and m.get("version") not in (F3_VERSION, F4_VERSION, F5_VERSION):
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


def build_index(converted, omitted, discarded_by_case, order, sat_report, promoted_batches=None,
                f3r_section: str = "", f3g_section: str = "") -> str:
    """converted: every promoted case (v0.2: `loads` or `analysis.seismic`; v0.3: lots 1 and 2; v0.4: R1 to R4; v0.5 and the
    v0.3 ones with ponded water: F3G)."""
    """sat_report: (ids of problems with unitWeightSat in the source, reasons per id, ids included)."""
    sat_ids, sat_reason, sat_included = sat_report
    n_sat_in = sum(1 for c in converted if any(m.get("unit_weight_sat") is not None for m in c["model"]["materials"]))
    convertible = [cid for cid in sat_ids if cid not in sat_included and sat_reason[cid].startswith("convertible")]
    n_checks = sum(len(c["checks"]) for c in converted)
    lines = [
        "# Casos de verificación v0.1 a v0.7 (desde cSlope)",
        "",
        "Generado por `verification/tools/import_cslope.py`. No editar a mano.",
        "Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.",
        "",
        f"Casos convertidos e incluidos: **{len(converted)}** "
        f"(v0.1: **{sum(c['model']['version'] == '0.1' for c in converted)}**, "
        f"v0.2 con sismo o cargas: **{sum(c['model']['version'] == '0.2' for c in converted)}**, "
        f"v0.3: **{sum(c['model']['version'] == '0.3' for c in converted)}**, "
        f"v0.4 con refuerzos: **{sum(c['model']['version'] == '0.4' for c in converted)}**, "
        f"v0.5 con grieta de tracción: **{sum(c['model']['version'] == '0.5' for c in converted)}**, "
        f"v0.6 con Hoek-Brown o búsqueda no circular: **{sum(c['model']['version'] == '0.6' for c in converted)}**, "
        f"v0.7 con búsqueda global: **{sum(c['model']['version'] == '0.7' for c in converted)}**), "
        f"con **{n_checks}** checks. Lote 0: todo lo que se convierte con la versión 0.1 o 0.2, sin tope ni selección. "
        "Lotes 1 y 2 (`undrained`, polilíneas fijas, Morgenstern-Price y Janbu): los casos v0.3, promovidos desde "
        "`verification/pending/F3` cuando el motor reproduce sus checks. Lotes R1 a R4: los casos v0.4 con refuerzos, "
        "promovidos desde `verification/pending/F3R` (sección «Casos con refuerzos»). Lote F3G: los casos con grieta de "
        "tracción (v0.5) y con agua embalsada (la versión mínima de sus campos si no tienen grieta), promovidos desde "
        "`verification/pending/F3G` "
        "(sección «Grieta de tracción y agua embalsada»). Lote F3B: los casos v0.6 con búsqueda no circular y Hoek-Brown, "
        "promovidos desde `verification/pending/F3B` (sección «Hoek-Brown y búsqueda no circular»). "
        f"Lote CM (F7.6): los checks no circulares que F3B no listó, de v0.6 y, con `global`, de v0.7 (V053), promovidos en CM "
        f"(sección «{CM_SECTION}»). "
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
    if f3r_section:
        lines += ["", f3r_section.rstrip("\n")]
    if f3g_section:
        lines += ["", f3g_section.rstrip("\n")]
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


def build_pending_index(converted: list[dict], status: list[tuple[str, str, str]], cm_promoted: dict[str, str] | None = None,
                        held_totals: list[tuple[str, int]] | None = None) -> str:
    """status: (id, title, reason or '') per cSlope problem with loads or seismic coefficients. `cm_promoted`: {id: case id}
    of the problems of that list that CM promoted with another version (F7.6). `held_totals`: (batch, checks held) per batch."""
    cm_promoted = cm_promoted or {}
    included = [c["id"] for c in converted]
    promoted_cm = [cid for cid, _, _ in status if cid in cm_promoted and cid not in set(included)]
    excluded = [(cid, reason) for cid, _, reason in status if cid not in set(included) and cid not in cm_promoted]
    lines = [
        "# Problemas con sismo o cargas excluidos (esquema v0.2)",
        "",
        "Generado por `verification/tools/import_cslope.py`. No editar a mano.",
        "Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.",
        "",
        "Los problemas de cSlope con `seismicHorizontal`, `seismicVertical`, `udls` o `lineLoads` que se pueden "
        "convertir al esquema v0.2 (contrato F1.1) están en `verification/cases/` desde que el motor acepta la "
        f"versión 0.2: **{len(included)}** casos ({', '.join(included)})."
        + (f" {', '.join(promoted_cm)} {'pasó' if len(promoted_cm) == 1 else 'pasaron'} a `verification/cases` en CM (F7.6) con "
           "una versión mayor, con la búsqueda no circular que antes no tenían (sección «" + CM_SECTION + "» de "
           "[`../cases/INDEX.md`](../cases/INDEX.md))." if promoted_cm else "")
        + f" Aquí quedan los **{len(excluded)}** excluidos, de un total de **{len(status)}** problemas con sismo o cargas, "
        "con el motivo de cada uno.",
        "",
        "| id | estado | motivo |",
        "|---|---|---|",
    ]
    for cid, reason in excluded:
        lines.append(f"| {cid} | excluido | {md_cell(reason)} |")
    if held_totals is not None:
        total = sum(n for _, n in held_totals)
        lines += ["", "## Checks retenidos en total", "",
                  f"Hay **{total}** checks retenidos en `verification/pending` (el motor o el oráculo no los reproducen; cada uno "
                  "está en el `HOLD.json` de su lote, con el diagnóstico en el `INDEX.md` del lote):", "",
                  "| lote | checks retenidos |", "|---|---:|"]
        lines += [f"| [{name}]({name}/INDEX.md) | {n} |" for name, n in held_totals]
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


F3B_IDS = ("V001", "V002", "V026", "V033", "V034a", "V034b", "V036a", "V093",
           "V102a", "V102b", "V009c", "V050b", "V059a", "V059b", "V059c", "V094", "V103", "V105a")
# F6.12: the cases that enter with the non-circular search alone are the 16 of X23 §1 plus V036a (X29 §8). The other cases of the
# corpus with a non-circular check convert too, but X23 §1.4 marks them as needing `porePressureHead` and X29 §1 measured only
# V036a, so they stay out of the list until B2 measures them; they are listed in INDEX.md with this reason.
F3B_NOT_LISTED = "fuera de la lista de F6.12 (X23 §1.4 y X29 §8): el conversor lo escribe, pero no se midió con el motor ni con el oráculo"
HAM1_NOTES = (
    "Geometría reconstruida (X23 §3.2, inferida del tutorial de XSLOPE): pie en (20, 5), corona en (30, 15), terreno llano de "
    "x = 0 a 20 en y = 5 y de x = 30 a 50 en y = 15, base en y = 0. La cimentación de 5 m (de y = 0 a 5) es un supuesto: la "
    "fuente no la da.",
    "Supuestos escritos en el caso: terreno seco (la fuente no da el nivel freático), γ = 25 kN/m³ (supuesto de X28), roca "
    "única con σci = 30 000 kPa, GSI = 5, mi = 2 y D = 0 (tabla 1 de la fuente).",
    "Círculo fijo: el que encuentra la búsqueda de cSlope con entrada [−20, 40] y salida [10, 60] (centro (17,81; 20,77), "
    "r = 15,92; X23 §3.2). Los publicados son resultados de búsqueda de la fuente, no de este círculo: el oráculo da Bishop "
    "1,151807 (−0,11 %) y Spencer 1,153019 (+0,08 %).",
    "Tolerancia de 0,5 % (F6.12): la geometría está reconstruida, así que no se compara con la última cifra publicada.",
    "F6.8: el producto usa la envolvente completa en bajo confinamiento, no la tangente de σ3 = 0 de cSlope. El prototipo da "
    "Bishop 1,150215 (−0,24 %) y Spencer 1,152052 (+0,005 %) con ella, dentro de 0,5 %.")


def ham1_case(root: Path) -> dict:
    ham = json.loads((root / "docs/fase3/exploracion/X28_filas/X28-F-HAM1.json").read_text(encoding="utf-8"))["model"]
    ham["meta"]["id"] = "HAM1"
    ham["analysis"]["methods"] = ["bishop", "spencer"]
    return {"id": "HAM1", "title": "Hammah et al. (2005), ejemplo 1", "model": ham,
            "checks": [{"method": method, "kind": "fixed", "published": value,
                        "published_by": "Hammah et al. (2005), tabla 2", "tolerance": 0.005, "options": {"slices": 40}}
                       for method, value in (("bishop", 1.153), ("spencer", 1.152))],
            "source": {"reference": "Hammah et al. (2005), ARMA/USRMS 05-810", "derived_from": HAM1_URL,
                       "notes": list(HAM1_NOTES)}}


def f3b_rename(case: dict, renamed: tuple = F3B_RENAMED) -> dict:
    """The non-circular check of a problem that already has a case in verification/cases is a case of its own: `<id>-nc`."""
    cid = case["id"]
    if cid not in renamed:
        return case
    new = cid + F3B_SUFFIX
    title = f"{case['title']}, non-circular search"
    out = {**case, "id": new, "title": title,
           "model": {**case["model"], "meta": {**case["model"]["meta"], "id": new, "title": title}}}
    out["source"] = {**case["source"], "notes": [*case["source"]["notes"],
        f"Checks de búsqueda no circular del problema {cid} de cSlope. El caso lleva el sufijo `{F3B_SUFFIX}` porque `{cid}` ya "
        "está en `verification/cases` con otros checks y otro modelo (búsqueda circular)."]}
    return out


def cm_reason(cid: str, cm: dict | None) -> str | None:
    """The line of «Otros casos con búsqueda no circular» for a problem of the batch CM (F7.6): where it went."""
    if cm is None or cid not in CM_IDS:
        return None
    new = cm["new_id"].get(cid)
    held = [c for c in cm["held"] if c["id"] == new]
    if new is None:
        return "lote CM (F7.6): no se escribe (" + md_cell(dict(cm["omitted"]).get(cid, "")) + ")"
    version = "v0.7 con `analysis.search.non_circular.global: {}`" if cid in CM_GLOBAL else "v0.6"
    if held:
        n = len(held[0]["checks"])
        return (f"lote CM (F7.6): escrito como `{new}` ({version}); {n} {'check retenido' if n == 1 else 'checks retenidos'} en "
                "`../CM/HOLD.json`, con su causa")
    return (f"promovido en CM (F7.6) como `{new}` ({version}): está en [`../../cases/`](../../cases/INDEX.md), sección "
            f"«{CM_SECTION}»")


def build_f3b(root: Path, raw_by_id: dict, problems: dict, order: list[str], cm: dict | None = None) -> dict:
    """Convert the cases of F3B (not written yet): {cases, omitted, discarded, not_listed, hold, ok, held}."""
    schema = json.loads((root / F3B_SCHEMA).read_text(encoding="utf-8"))
    cases, omitted, discarded = [], [], {}
    for cid in F3B_IDS:
        raw = raw_by_id[cid]
        checks = [ck for ck in raw["checks"] if ck.get("options", {}).get("nonCircularOptimization")] or raw["checks"]
        try:
            case, disc, _ = _convert({**raw, "checks": checks}, problems.get(cid), v02=True, f3=True, f3g=True, f3b=True)
            errors = gate_schema_f3r(case, schema) + gate_search(case) + gate_geometry(case, raw)
            if errors:
                raise Omit("; ".join(errors))
            if any((ck.get("options") or {}).get("porePressureHead") == "phreatic-correction" for ck in checks):
                case["source"]["notes"].append(
                    "La fuente pide porePressureHead=phreatic-correction; ogs usa altura vertical. "
                    "X29 §1 comprobó que en V036a el FS del oráculo no cambia al quitar esta opción.")
            case = f3b_rename(case)
            cases.append(case)
            discarded[case["id"]] = disc
        except (Omit, KeyError, ValueError) as exc:
            omitted.append((cid, str(exc)))
    cases.append(ham1_case(root))
    errors = gate_schema_f3r(cases[-1], schema)
    if errors:
        raise ValueError(f"HAM1: {errors}")
    # the corpus cases with a non-circular check that are not in the list of F6.12
    not_listed = []
    for cid in order:
        if cid in F3B_IDS:
            continue
        raw = raw_by_id[cid]
        nco = [ck for ck in raw["checks"] if ck.get("options", {}).get("nonCircularOptimization")]
        if not nco:
            continue
        try:
            _convert({**raw, "checks": nco}, problems.get(cid), v02=True, f3=True, f3g=True, f3b=True)
            not_listed.append((cid, len(nco), cm_reason(cid, cm) or F3B_NOT_LISTED))
        except (Omit, KeyError, ValueError) as exc:
            not_listed.append((cid, len(nco), cm_reason(cid, cm) or str(exc)))
    hold = load_hold(root / HOLD_F3B_FILE)
    known = {check_key(c["id"], k) for c in cases for k in c["checks"]}
    unknown = sorted(key for key in hold if key not in known and key[0] not in {cid for cid, _ in omitted})
    if unknown:
        raise ValueError(f"pending/F3B/HOLD.json con checks que no existen en F3B: {unknown}")
    ok, held = [], []
    for case in cases:
        rest, only_held = split_hold(case, hold)
        if rest:
            ok.append(rest)
        if only_held:
            held.append(only_held)
    return {"cases": cases, "omitted": omitted, "discarded": discarded, "not_listed": not_listed, "hold": hold,
            "ok": ok, "held": held}


def build_cm(root: Path, raw_by_id: dict, problems: dict) -> dict:
    """Convert the cases of the batch CM (F7.6): {cases, ok, held, hold, discarded, omitted, new_id}. Same conversion as F3B
    (v0.6, `non_circular` with the defaults of cSlope); the cases of CM_GLOBAL are v0.7 with `global: {}`."""
    schemas = {v: json.loads((root / "schema" / f"ogs-{v}.schema.json").read_text(encoding="utf-8")) for v in (F6_VERSION, CM_VERSION)}
    cases, omitted, discarded, new_id = [], [], {}, {}
    for cid in CM_IDS:
        raw = raw_by_id[cid]
        checks = [ck for ck in raw["checks"] if ck.get("options", {}).get("nonCircularOptimization")]
        try:
            if not checks:
                raise Omit("sin checks con nonCircularOptimization")
            case, disc, _ = _convert({**raw, "checks": checks}, problems.get(cid), v02=True, f3=True, f3g=True, f3b=True)
            if cid in CM_GLOBAL:
                case["model"]["version"] = CM_VERSION
                case["model"]["analysis"]["search"]["non_circular"]["global"] = {}
                case["source"]["notes"].append(
                    "Con `analysis.search.non_circular.global: {}` (v0.7, F7.1): la búsqueda global (bloque con Halton rotado y "
                    "recocido, `generated` 500, semilla 0) más el refinamiento. El refinamiento solo (v0.6) da 1,0847, +7,40 % "
                    "frente a 1,01 ± 3,50 %, porque no alcanza la cuenca de la polilínea de cSlope (1,0061; X32 §0 y §3); con "
                    "`global` ogs da 1,0103. cSlope no tiene búsqueda global: el oráculo corre su propia optimización no "
                    "circular.")
            errors = (gate_schema_f3r(case, schemas[case["model"]["version"]]) + gate_search(case) + gate_geometry(case, raw))
            if errors:
                raise Omit("; ".join(errors))
            if any((ck.get("options") or {}).get("porePressureHead") == "phreatic-correction" for ck in checks):
                case["source"]["notes"].append(
                    "La fuente pide porePressureHead=phreatic-correction; ogs usa altura vertical. "
                    "X29 §1 comprobó que en V036a el FS del oráculo no cambia al quitar esta opción.")
            case = f3b_rename(case, CM_RENAMED)
            cases.append(case)
            new_id[cid] = case["id"]
            discarded[case["id"]] = disc
        except (Omit, KeyError, ValueError) as exc:
            omitted.append((cid, str(exc)))
    hold = load_hold(root / HOLD_CM_FILE)
    known = {check_key(c["id"], k) for c in cases for k in c["checks"]}
    unknown = sorted(key for key in hold if key not in known)
    if unknown:
        raise ValueError(f"pending/CM/HOLD.json con checks que no existen en CM: {unknown}")
    ok, held = [], []
    for case in cases:
        rest, only_held = split_hold(case, hold)
        if rest:
            ok.append(rest)
        if only_held:
            held.append(only_held)
    return {"cases": cases, "ok": ok, "held": held, "hold": hold, "discarded": discarded, "omitted": omitted, "new_id": new_id}


def generate_cm(root: Path, cm: dict) -> None:
    """Write pending/CM: the held checks (with their cases), HOLD.json and an INDEX.md. The promoted cases go to cases/."""
    directory = root / CM_DIR
    directory.mkdir(parents=True, exist_ok=True)
    keep = {f"{c['id']}.json" for c in cm["held"]}
    for stale in sorted(directory.glob("*.json")):
        if stale.name not in keep and stale.name != "HOLD.json":
            stale.unlink()
    for case in cm["held"]:
        write_if_changed(directory / f"{case['id']}.json", json.dumps(case, indent=2, ensure_ascii=False) + "\n")
    if not (directory / "HOLD.json").exists():
        write_if_changed(directory / "HOLD.json", "[]\n")
    write_if_changed(directory / "INDEX.md", build_cm_index(cm))
    n_ok, n_held = (sum(len(c["checks"]) for c in cm[k]) for k in ("ok", "held"))
    print(f"CM: {len(cm['cases'])} casos; promovidos: {n_ok} checks; retenidos: {n_held}; omitidos: {cm['omitted']}")


def build_cm_index(cm: dict) -> str:
    ok, held, hold = cm["ok"], cm["held"], cm["hold"]
    n_ok = sum(len(c["checks"]) for c in ok)
    lines = [
        "# Búsqueda no circular y global (CM, formatos v0.6 y v0.7): promovidos y retenidos",
        "",
        "Generado por `verification/tools/import_cslope.py`. No editar a mano (`HOLD.json` sí: lo lee el generador).",
        "Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.",
        "",
        f"**{len(ok)}** casos con **{n_ok}** checks pasaron a [`../../cases/`](../../cases/INDEX.md) (sección «{CM_SECTION}», con la "
        "tabla del publicado, ogs y cSlope por check)"
        + (f", salvo **{sum(len(c['checks']) for c in held)}** checks retenidos aquí (`HOLD.json`); la tabla de abajo los lista con "
           "sus números y la causa medida." if hold else ". No queda ninguno retenido."),
        "",
        "Son los checks no circulares de `../F3B/INDEX.md` §«Otros casos con búsqueda no circular» (contrato F7.6): "
        + ", ".join(f"{cid}" + (f" (`{cm['new_id'][cid]}`)" if cm["new_id"].get(cid, cid) != cid else "") for cid in CM_IDS)
        + ". Los cinco que ya tenían un caso en `verification/cases` con otros checks se llaman `<id>-nc`. "
        + "V053 es de v0.7 con `analysis.search.non_circular.global: {}`; los demás, de v0.6. Ninguna tolerancia, valor publicado "
        "ni modelo cambió al promover.",
        "",
        "## Checks retenidos",
        "",
    ]
    if hold:
        lines += ["| caso | método | publicado | por | ogs | cSlope | motivo y diagnóstico |", "|---|---|---:|---|---:|---:|---|"]

        def f(v):
            return "—" if v is None else f"{v:.4f}"
        for key, e in sorted(hold.items()):
            lines.append(f"| {e['id']} | {e['method']} | {e['published']} | {md_cell(e['published_by'])} | {f(e.get('ogs'))} "
                         f"| {f(e.get('cslope'))} | {md_cell(e.get('diagnosis', ''))} |")
    else:
        lines.append("Ninguno.")
    lines += ["", "## Casos de la lista que no se escriben", ""]
    lines += [f"- {cid}: {md_cell(r)}" for cid, r in cm["omitted"]] or ["- ninguno"]
    lines.append("")
    return "\n".join(lines)


def build_cm_section(cases: list[dict], report: dict | None, held_cases: list[dict]) -> str:
    """Section of `cases/INDEX.md` for the promoted batch CM: published value, ogs and cSlope per check."""
    rows = {(r["case_id"], r["method"], r["published"]): r for r in (report or {}).get("checks", [])}
    n_checks = sum(len(c["checks"]) for c in cases)
    n_held = sum(len(c["checks"]) for c in held_cases)
    lines = [
        f"## {CM_SECTION}",
        "",
        f"**{len(cases)}** casos con **{n_checks}** checks, promovidos desde `verification/pending/F3B` (§«Otros casos con "
        "búsqueda no circular») en CM (F7.6): los checks con `nonCircularOptimization` del corpus de cSlope que F3B no listó. "
        "Son de v0.6, con `analysis.search.non_circular` en sus valores por defecto (3 semillas y 33 vértices), salvo "
        "**V053**, que es de v0.7 con `analysis.search.non_circular.global: {}` (la búsqueda global; el refinamiento solo da "
        f"+7,40 % sobre el publicado). Los cinco problemas que ya tienen un caso en este directorio con otros checks llevan el "
        f"sufijo `{F3B_SUFFIX}`: {', '.join(c + F3B_SUFFIX for c in CM_RENAMED)}. La tolerancia es la del corpus de cSlope, leída "
        "como **relativa** (`|Δ|/publicado ≤ tolerancia`); no se relajó ninguna ni se tocó ningún dato.",
        "",
    ]
    if n_held:
        lines += [f"**{n_held}** check más ({held_label(held_cases)}) queda retenido en `verification/pending/CM` "
                  "(`HOLD.json`), con los números y la causa medida.", ""]
    else:
        lines += ["Ningún check de este lote queda retenido.", ""]
    if not rows:
        lines += ["No hay `verification/report.json` con estos casos: corra el harness sobre `verification/cases` y "
                  "regenere este índice.", ""]
    lines += ["| caso | v | búsqueda | método | publicado | por | tol % | ogs | Δ ogs % | cSlope | Δ cSlope % |",
              "|---|---|---|---|---:|---|---:|---:|---:|---:|---:|"]
    for case in sorted(cases, key=lambda c: (c["id"].split("-")[0], c["id"])):
        for c in case["checks"]:
            r = rows.get((case["id"], c["method"], c["published"]))
            og = cs = d_og = d_cs = "—"
            if r is not None:
                fmt = lambda v, f: "—" if v is None else format(v, f)  # noqa: E731
                og, d_og = fmt(r["ogs"]["fos"], ".4f"), fmt(r["ogs"]["err_pct"], "+.2f")
                cs, d_cs = fmt(r["cslope"]["fos"], ".4f"), fmt(r["cslope"]["err_pct"], "+.2f")
            search = "no circular + global" if case["model"]["analysis"]["search"]["non_circular"].get("global") is not None \
                else "no circular"
            lines.append(f"| {case['id']} | {case['model']['version']} | {search} | {c['method']} | {c['published']} "
                         f"| {md_cell(c['published_by'])} | {100 * c['tolerance']:.2f} | {og} | {d_og} | {cs} | {d_cs} |")
    lines.append("")
    return "\n".join(lines)


def generate_f3b(root: Path, f3b: dict, promote: bool) -> int:
    """Write pending/F3B: every case while nothing is promoted; only the held checks (and the INDEX) once promoted. Promoted
    cases are written to cases/ by `main`."""
    directory = root / F3B_DIR
    directory.mkdir(parents=True, exist_ok=True)
    keep = {f"{c['id']}.json" for c in (f3b["held"] if promote else f3b["cases"])}
    for stale in sorted(directory.glob("*.json")):
        if stale.name not in keep and stale.name != "HOLD.json":
            stale.unlink()
    for case in (f3b["held"] if promote else f3b["cases"]):
        write_if_changed(directory / f"{case['id']}.json", json.dumps(case, indent=2, ensure_ascii=False) + "\n")
    if not (directory / "HOLD.json").exists():
        write_if_changed(directory / "HOLD.json", "[]\n")
    index = (build_f3b_promoted_index(f3b) if promote else
             build_f3b_index(f3b["cases"], f3b["hold"], f3b["omitted"], f3b["not_listed"], f3b["discarded"]))
    write_if_changed(directory / "INDEX.md", index)
    n_ok, n_held = (sum(len(c["checks"]) for c in f3b[k]) for k in ("ok", "held"))
    print(f"F3B: {len(f3b['cases'])} casos; {'promovidos' if promote else 'sin promover'}: {n_ok} checks; retenidos: {n_held}; "
          f"omitidos: {f3b['omitted']}")
    return 0


F3B_PROMOTE_COMMAND = (
    "uv run --python 3.13 --no-project --with shapely --with jsonschema python verification/tools/import_cslope.py "
    "--src $TMPDIR/cslope-src --promote-f3b")


def _f3b_search(case: dict) -> str:
    surface = case["model"]["analysis"].get("surface", {})
    if surface.get("type") == "circle":
        return "círculo fijo"
    return "no circular" if case["model"]["analysis"].get("search", {}).get("non_circular") else "circular"


def build_f3b_section(cases: list[dict], report: dict | None, held_cases: list[dict], hold: dict[tuple, dict]) -> str:
    """Section of `cases/INDEX.md` for the promoted batch F3B: published value, ogs and cSlope per check (from the
    `report.json` that `verification/harness/run.py` writes for `verification/cases`)."""
    rows = {(r["case_id"], r["method"], r["published"]): r for r in (report or {}).get("checks", [])}
    n_checks = sum(len(c["checks"]) for c in cases)
    n_held = sum(len(c["checks"]) for c in held_cases)
    lines = [
        "## Hoek-Brown y búsqueda no circular (lote F3B, v0.6)",
        "",
        f"**{len(cases)}** casos con **{n_checks}** checks, promovidos desde `verification/pending/F3B` (F6.12) cuando el motor "
        "reproduce el valor publicado dentro de su tolerancia. Son los problemas de cSlope con `nonCircularOptimization` de la "
        "lista de F6.12 (con `analysis.search.non_circular` en sus valores por defecto: 3 semillas y 33 vértices) y el ejemplo 1 "
        "de Hammah et al. (2005), `HAM1`, con Hoek-Brown, geometría reconstruida, círculo fijo y tolerancia de 0,5 %. Los diez "
        f"problemas que ya tienen un caso en este directorio con otros checks y otro modelo llevan el sufijo `{F3B_SUFFIX}` "
        "(como `V086b-auto`): `V001-nc` es el check no circular del problema `V001`, y `V001` sigue con sus checks circulares. "
        "La tolerancia es la del corpus de cSlope, leída como **relativa** (`|Δ|/publicado ≤ tolerancia`); no se relajó ninguna "
        "ni se tocó ningún dato.",
        "",
    ]
    if n_held:
        lines += [f"**{n_held}** check más ({held_label(held_cases)}) queda retenido en `verification/pending/F3B` "
                  "(`HOLD.json`), con los números y la causa medida.", ""]
    if not rows:
        lines += ["No hay `verification/report.json` con estos casos: corra el harness sobre `verification/cases` y "
                  "regenere este índice.", ""]
    lines += ["| caso | v | búsqueda | método | publicado | por | tol % | ogs | Δ ogs % | cSlope | Δ cSlope % |",
              "|---|---|---|---|---:|---|---:|---:|---:|---:|---:|"]
    for case in sorted(cases, key=lambda c: (c["id"].split("-")[0], c["id"])):
        for c in case["checks"]:
            r = rows.get((case["id"], c["method"], c["published"]))
            og = cs = d_og = d_cs = "—"
            if r is not None:
                fmt = lambda v, f: "—" if v is None else format(v, f)  # noqa: E731
                og, d_og = fmt(r["ogs"]["fos"], ".4f"), fmt(r["ogs"]["err_pct"], "+.2f")
                cs, d_cs = fmt(r["cslope"]["fos"], ".4f"), fmt(r["cslope"]["err_pct"], "+.2f")
            lines.append(f"| {case['id']} | {case['model']['version']} | {_f3b_search(case)} | {c['method']} | {c['published']} "
                         f"| {md_cell(c['published_by'])} | {100 * c['tolerance']:.2f} | {og} | {d_og} | {cs} | {d_cs} |")
    lines.append("")
    return "\n".join(lines)


def build_f3b_promoted_index(f3b: dict) -> str:
    """INDEX.md left in pending/F3B once the batch is promoted: the held checks, with their numbers and their cause."""
    ok, held, hold = f3b["ok"], f3b["held"], f3b["hold"]
    n_ok = sum(len(c["checks"]) for c in ok)
    n_held = sum(len(c["checks"]) for c in held)
    lines = [
        "# Hoek-Brown, SHANSEP y búsqueda no circular (F3B, formato v0.6): promovidos y retenidos",
        "",
        "Generado por `verification/tools/import_cslope.py`. No editar a mano (`HOLD.json` sí: lo lee el generador).",
        "Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope, y Hammah et al. "
        "(2005) para HAM1.",
        "",
        f"**{len(ok)}** casos con **{n_ok}** checks pasaron a [`../../cases/`](../../cases/INDEX.md) (sección «Hoek-Brown y "
        "búsqueda no circular», con la tabla del publicado, ogs y cSlope por check)"
        + (f", salvo **{len(hold)}** checks retenidos aquí (`HOLD.json`: {n_held} de casos con archivo"
           + (f" y {len(hold) - n_held} de {'un caso' if len(hold) - n_held == 1 else 'casos'} que no se "
              f"{'escribe' if len(hold) - n_held == 1 else 'escriben'}" if len(hold) > n_held else "")
           + "); la tabla de abajo los lista con sus números y la causa medida." if hold else ". No queda ninguno retenido."),
        "",
        "Los casos de cSlope son los checks con `nonCircularOptimization` (F6.12). Los diez problemas que ya tenían un caso en "
        f"`verification/cases` con otros checks y otro modelo se llaman `<id>{F3B_SUFFIX}` ({', '.join(F3B_RENAMED)}): es el "
        "mismo modelo y los mismos checks de la fuente, con otro nombre. Ninguna tolerancia, valor publicado ni modelo cambió "
        "al promover.",
        "",
    ]
    lines += ["## Checks retenidos", ""]
    if held or hold:
        lines += ["Cada check retenido es uno que el motor o el oráculo no reproducen, con su causa. Se promueve quitándolo de "
                  "`HOLD.json` y regenerando, cuando se reproduzca.", "",
                  "| caso | método | publicado | por | tol % | ogs | cSlope | motivo y diagnóstico |",
                  "|---|---|---:|---|---:|---:|---:|---|"]

        def f(v):
            return "—" if v is None else f"{v:.4f}"
        tol = {check_key(c["id"], k): k["tolerance"] for c in f3b["cases"] for k in c["checks"]}
        for key, e in sorted(hold.items()):
            t = tol.get(key)
            lines.append(f"| {e['id']} | {e['method']} | {e['published']} | {md_cell(e['published_by'])} "
                         f"| {'—' if t is None else format(100 * t, '.2f')} | {f(e.get('ogs'))} | {f(e.get('cslope'))} "
                         f"| {md_cell(e.get('diagnosis', ''))} |")
    else:
        lines.append("Ninguno.")
    lines += ["", "## Casos de la lista que no se escriben", ""]
    lines += [f"- {cid}: {md_cell(r)}" for cid, r in f3b["omitted"]] or ["- ninguno"]
    lines += ["", "## Otros casos con búsqueda no circular", "",
              "El corpus de cSlope tiene más checks con `nonCircularOptimization`. No entran en F3B; los de la lista de F7.6 pasaron a "
              "`verification/cases` en CM (lote «Búsqueda no circular y global»), y el resto queda fuera por el motivo de cada uno:", ""]
    lines += [f"- {cid} ({n} {'check' if n == 1 else 'checks'}): {md_cell(r)}" for cid, n, r in f3b["not_listed"]] or ["- ninguno"]
    dropped = {k: v for k, v in f3b["discarded"].items() if v}
    if dropped:
        lines += ["", "## Checks descartados dentro de los casos", ""]
        lines += [f"- {cid}: {md_cell(x)}" for cid, v in sorted(dropped.items()) for x in v]
    lines.append("")
    return "\n".join(lines)


def build_f3b_index(cases: list[dict], hold: dict[tuple, dict], omitted: list[tuple[str, str]],
                    not_listed: list[tuple[str, int, str]], discarded: dict[str, list[str]]) -> str:
    n_checks = sum(len(c["checks"]) for c in cases)
    lines = [
        "# Hoek-Brown, SHANSEP y búsqueda no circular (F3B, formato v0.6): casos pendientes",
        "",
        "Generado por `verification/tools/import_cslope.py --src $TMPDIR/cslope-src --f3b-only`. No editar a mano "
        "(`HOLD.json` sí: lo lee el generador).",
        "Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope, y Hammah et al. "
        "(2005) para HAM1.",
        "",
        f"**{len(cases)}** casos con **{n_checks}** checks. Ninguno está promovido: el motor de este bloque no tiene aún la "
        "física v0.6, y B2 los pasa a [`../../cases/`](../../cases/INDEX.md) cuando el motor los reproduce, quitando de "
        "`HOLD.json` lo que corresponda y sin relajar ninguna tolerancia.",
        "",
        "Los casos de cSlope son los checks con `nonCircularOptimization` (F6.12: los 16 casos de X23 §1 más V036a, X29 §8). "
        "Se escriben en la versión `0.6` con `analysis.search.non_circular` en sus valores por defecto (`seeds` 3, "
        "`max_vertices` 33): cSlope 0.1.0 no tiene esos parámetros en el documento y su motor usa 3 semillas y hasta 33 "
        "vértices (X24 §1), así que son los valores con los que corre el oráculo. HAM1 es el ejemplo 1 de Hammah et al. con "
        "su geometría reconstruida, círculo fijo y tolerancia de 0,5 % (F6.12).",
        "",
        "## Casos y checks",
        "",
        "| caso | método | superficie | publicado | por | tol % |",
        "|---|---|---|---:|---|---:|",
    ]
    for case in cases:
        for c in case["checks"]:
            lines.append(f"| {case['id']} | {c['method']} | {c['kind']} | {c['published']} | {md_cell(c['published_by'])} "
                         f"| {100 * c['tolerance']:.2f} |")
    lines += ["", "## Checks retenidos", ""]
    if hold:
        lines += ["Cada check retenido es uno que el motor o el oráculo no reproducen, con su causa. No se promueve hasta "
                  "que se reproduzca.", "",
                  "| caso | método | publicado | por | ogs | cSlope | motivo y diagnóstico |", "|---|---|---:|---|---:|---:|---|"]

        def f(v):
            return "—" if v is None else f"{v:.4f}"
        for key, e in sorted(hold.items()):
            lines.append(f"| {e['id']} | {e['method']} | {e['published']} | {md_cell(e['published_by'])} | {f(e.get('ogs'))} "
                         f"| {f(e.get('cslope'))} | {md_cell(e.get('diagnosis', ''))} |")
    else:
        lines.append("Ninguno.")
    lines += ["", "## Casos de la lista que no se escriben", ""]
    lines += [f"- {cid}: {md_cell(r)}" for cid, r in omitted] or ["- ninguno"]
    lines += ["", "## Otros casos con búsqueda no circular", "",
              "El corpus de cSlope tiene más checks con `nonCircularOptimization`. No entran en F3B; los de la lista de F7.6 pasaron a "
              "`verification/cases` en CM (lote «Búsqueda no circular y global»), y el resto queda fuera por el motivo de cada uno:", ""]
    lines += [f"- {cid} ({n} {'check' if n == 1 else 'checks'}): {md_cell(r)}" for cid, n, r in not_listed] or ["- ninguno"]
    dropped = {k: v for k, v in discarded.items() if v}
    if dropped:
        lines += ["", "## Checks descartados dentro de los casos", ""]
        lines += [f"- {cid}: {md_cell(x)}" for cid, v in sorted(dropped.items()) for x in v]
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--src", required=True, help="path to the read-only cSlope clone")
    ap.add_argument("--root", default=None, help="repository root (default: two levels above this script)")
    ap.add_argument("--promote-f3i", action="store_true",
                    help="write the Ito-Matsui cases V013b to V013e (batch F3I, v0.5) to verification/cases instead of "
                         "verification/pending/F3I (the integrator's promotion, see pending/F3I/INDEX.md)")
    ap.add_argument("--promote-f3b", action="store_true",
                    help="write the cases of batch F3B (v0.6) that the engine reproduces to verification/cases and leave the held "
                         "checks (HOLD.json) in verification/pending/F3B (the integrator's promotion, see pending/F3B/INDEX.md)")
    ap.add_argument("--f3b-only", action="store_true", help="generate only pending/F3B (the promoted cases are written by the full run)")
    args = ap.parse_args()

    src = Path(args.src).expanduser().resolve()
    root = Path(args.root).resolve() if args.root else Path(__file__).resolve().parents[2]
    promote_f3i = bool(args.promote_f3i or F3I_PROMOTED)
    promote_f3b = bool(args.promote_f3b or F3B_PROMOTED)
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
    cm = build_cm(root, raw_by_id, problems)
    f3b = build_f3b(root, raw_by_id, problems, order, cm)
    if args.f3b_only:
        generate_cm(root, cm)
        return generate_f3b(root, f3b, promote_f3b)
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

    # ---- batches R1 to R4 (F4.12): v0.4 cases with reinforcements, in pending/F3R
    f3r_cases: list[dict] = []
    f3r_lots: dict[str, str] = {}
    f3r_dropped: dict[str, list[str]] = {}
    f3r_omitted: list[tuple[str, str]] = []
    f3r_schema = json.loads((root / F3R_SCHEMA).read_text(encoding="utf-8"))
    for lot, (_, ids) in F3R_BATCHES.items():
        for cid in ids:
            if cid not in raw_by_id:
                failures.append(f"{cid} (F3R): no existe en verification.json")
                continue
            try:
                case, disc, _ = convert_f3r(raw_by_id[cid], problems.get(cid))
            except Omit as exc:
                f3r_omitted.append((cid, str(exc)))
                continue
            except KeyError as exc:
                f3r_omitted.append((cid, f"campo ausente en cSlope: {exc}"))
                continue
            f3r_cases.append(case)
            f3r_lots[cid] = lot
            if disc:
                f3r_dropped[cid] = disc
    for case in f3r_cases:
        cid = case["id"]
        for err in gate_schema_f3r(case, f3r_schema):
            failures.append(f"{cid} (F3R) schema: {err}")
        for err in gate_search(case):
            failures.append(f"{cid} (F3R) rangos: {err}")
        for err in gate_loads(case):
            failures.append(f"{cid} (F3R) cargas: {err}")
        for err in gate_features(case):
            failures.append(f"{cid} (F3R) v0.3: {err}")
        for err in gate_reinforcements(case):
            failures.append(f"{cid} (F3R) refuerzos: {err}")
        for err in gate_geometry(case, raw_by_id[cid]):
            failures.append(f"{cid} (F3R) geometría: {err}")
    if failures:
        print("GATE FAILURES:", *failures, sep="\n  ", file=sys.stderr)
        return 1

    # ---- F3R holds (F4.17, E14n-1): the checks that the acceptance test rejects stay in pending/F3R (HOLD.json)
    hold_f3r = load_hold(root / HOLD_F3R_FILE)
    f3r_held: list[dict] = []
    f3r_kept: list[dict] = []
    for case in f3r_cases:
        rest, held_case = split_hold(case, hold_f3r)
        if held_case is not None:
            f3r_held.append(held_case)
        if rest is not None:
            f3r_kept.append(rest)
    unknown_hold_f3r = sorted(set(hold_f3r) - {check_key(c["id"], k) for c in f3r_held for k in c["checks"]})
    if unknown_hold_f3r:
        print("GATE FAILURES:", f"pending/F3R/HOLD.json con checks que no existen en F3R: {unknown_hold_f3r}",
              sep="\n  ", file=sys.stderr)
        return 1
    f3r_all = f3r_cases
    f3r_held_checks = [c for case in f3r_held for c in case["checks"]]
    f3r_cases = f3r_kept

    # ---- batch F3G (F5.6): tension crack and ponded water, v0.5, in pending/F3G
    f3g_all: list[dict] = []
    f3g_dropped: dict[str, list[str]] = {}
    f3g_omitted: list[tuple[str, str]] = []
    f3g_schema = json.loads((root / F3G_SCHEMA).read_text(encoding="utf-8"))
    for cid in order:
        try:
            groups = convert_f3g(raw_by_id[cid], problems.get(cid))
        except Omit as exc:
            f3g_omitted.append((cid, str(exc)))
            continue
        except KeyError as exc:
            f3g_omitted.append((cid, f"campo ausente en cSlope: {exc}"))
            continue
        for case, disc, _ in groups:
            f3g_all.append(case)
            f3g_dropped[case["id"]] = disc
    hold_f3g = load_hold(root / HOLD_F3G_FILE)
    f3g_ok: list[dict] = []
    f3g_held: list[dict] = []
    for case in f3g_all:
        rest, held_case = split_hold(case, hold_f3g)
        if held_case is not None:
            f3g_held.append(held_case)
        if rest is not None:
            f3g_ok.append(rest)
    for case in f3g_all:
        cid = case["id"]
        base = raw_by_id[cid.split("-")[0]] if cid.split("-")[0] in raw_by_id else raw_by_id[cid]
        for err in gate_f3g(case, f3g_schema):
            failures.append(f"{cid} (F3G) schema: {err}")
        for err in gate_search(case):
            failures.append(f"{cid} (F3G) rangos: {err}")
        for err in gate_loads(case):
            failures.append(f"{cid} (F3G) cargas: {err}")
        for err in gate_features(case):
            failures.append(f"{cid} (F3G) v0.3: {err}")
        for err in gate_geometry(case, base):
            failures.append(f"{cid} (F3G) geometría: {err}")
    unknown_hold_f3g = sorted(set(hold_f3g) - {check_key(c["id"], k) for c in f3g_held for k in c["checks"]})
    if unknown_hold_f3g:
        failures.append(f"pending/F3G/HOLD.json con checks que no existen en F3G: {unknown_hold_f3g}")
    if failures:
        print("GATE FAILURES:", *failures, sep="\n  ", file=sys.stderr)
        return 1

    # ---- batch F3I (E15i-10): the Ito-Matsui piles, v0.5 with lateral_pressure, in pending/F3I (or in cases/ once promoted)
    f3i_cases: list[dict] = []
    f3i_omitted: list[tuple[str, str]] = []
    for cid in F3I_IDS:
        try:
            case, _, _ = convert_f3i(raw_by_id[cid], problems.get(cid))
        except (Omit, KeyError) as exc:
            f3i_omitted.append((cid, str(exc)))
            continue
        f3i_cases.append(case)
        for err in gate_f3i(case, f3g_schema):
            failures.append(f"{cid} (F3I) E15i-1: {err}")
        for err in gate_search(case):
            failures.append(f"{cid} (F3I) rangos: {err}")
        for err in gate_features(case):
            failures.append(f"{cid} (F3I) v0.3: {err}")
        for err in gate_geometry(case, raw_by_id[cid]):
            failures.append(f"{cid} (F3I) geometría: {err}")
    if f3i_omitted:
        failures.append(f"F3I: no se convierten {f3i_omitted}")
    if failures:
        print("GATE FAILURES:", *failures, sep="\n  ", file=sys.stderr)
        return 1
    f3i_ids = {c["id"] for c in f3i_cases}
    f3_omitted = [(cid, ("Ito-Matsui: pilote sin `force`; v0.5 con `lateral_pressure`, " + (
        "promovido a `verification/cases` (lote F3I)" if promote_f3i else "en `verification/pending/F3I`"))
        if cid in f3i_ids else r) for cid, r in f3_omitted]

    # ---- write (deterministic, idempotent)
    cases_dir = root / "verification" / "cases"
    # R1 to R4 are promoted: the v0.4 cases of the reinforcements go to cases/ after the v0.1 to v0.3 ones.
    f3i_promoted = f3i_cases if promote_f3i else []
    f3b_promoted = f3b["ok"] if promote_f3b else []
    cm_promoted = cm["ok"]
    all_cases = converted + f3r_cases + f3g_ok + f3i_promoted + f3b_promoted + cm_promoted
    dup = sorted({c["id"] for c in all_cases if [x["id"] for x in all_cases].count(c["id"]) > 1})
    if dup:
        print(f"ERROR: ids repetidos entre lotes: {dup}", file=sys.stderr)
        return 1
    expected = {f"{c['id']}.json" for c in all_cases}
    changed = 0
    for case in all_cases:
        text = json.dumps(case, indent=2, ensure_ascii=False) + "\n"
        changed += write_if_changed(cases_dir / f"{case['id']}.json", text)
    for stale in sorted(cases_dir.glob("*.json")):
        if stale.name not in expected:
            stale.unlink()
            changed += 1
    cases_report = None
    if (root / "verification" / "report.json").is_file():
        cases_report = json.loads((root / "verification" / "report.json").read_text(encoding="utf-8"))
    changed += write_if_changed(cases_dir / "INDEX.md", build_index(
        all_cases, [(cid, r) for cid, r in omitted if cid not in {c["id"] for c in f3r_cases + f3g_ok + f3i_promoted + f3b_promoted + cm_promoted}],
        {**discarded_by_case, **f3r_dropped, **f3g_dropped, **f3b["discarded"], **cm["discarded"]},
        order + [c["id"] for c in f3r_cases] + [c["id"] for c in f3g_ok] + [c["id"] for c in f3i_promoted]
        + [c["id"] for c in f3b_promoted] + [c["id"] for c in cm_promoted],
        (sat_ids, sat_reason, sat_included),
        f3r_section=build_f3r_section(f3r_cases, f3r_lots, cases_report, f3r_held, ito_promoted=promote_f3i),
        f3g_section=build_f3g_section(f3g_ok, cases_report, f3g_held) + (
            "\n" + build_f3i_section(f3i_promoted, cases_report) if f3i_promoted else "") + (
            "\n" + build_f3b_section(f3b_promoted, cases_report, f3b["held"], f3b["hold"]) if f3b_promoted else "") + (
            "\n" + build_cm_section(cm_promoted, cases_report, cm["held"]) if cm_promoted else "")))
    changed += write_if_changed(root / "NOTICE", build_notice(license_text))

    pending_dir = root / "verification" / "pending"
    pending_included = [c for c in converted if c["model"].get("loads") or c["model"]["analysis"].get("seismic")]
    for stale in sorted(pending_dir.glob("V*.json")):
        stale.unlink()
        changed += 1
    changed += write_if_changed(pending_dir / "INDEX.md", build_pending_index(
        pending_included, pending_status, cm["new_id"],
        [(name, len(json.loads((pending_dir / name / "HOLD.json").read_text(encoding="utf-8")))
          if (pending_dir / name / "HOLD.json").is_file() else len(cm["hold"]) if name == "CM" else 0)
         for name in ("lote0", "F3", "F3R", "F3G", "F3B", "CM")]))
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
    # F3R: promoted to cases/ above; only a short INDEX stays in pending/F3R
    f3r_dir = root / F3R_DIR
    keep_f3r = {f"{c['id']}.json" for c in f3r_held}
    for stale in sorted(f3r_dir.glob("V*.json")) if f3r_dir.is_dir() else []:
        if stale.name not in keep_f3r:
            stale.unlink()
            changed += 1
    for case in f3r_held:
        changed += write_if_changed(f3r_dir / f"{case['id']}.json", json.dumps(case, indent=2, ensure_ascii=False) + "\n")
    for old_file in ("report.json", "REPORT.md"):
        if (f3r_dir / old_file).is_file():
            (f3r_dir / old_file).unlink()
            changed += 1
    changed += write_if_changed(f3r_dir / "INDEX.md", build_f3r_promoted_index(
        f3r_all, f3r_omitted, f3r_held, hold_f3r, ito_promoted=promote_f3i))

    # F3G: promoted to cases/ above; only the checks that the engine does not reproduce (HOLD.json) stay in pending/F3G
    f3g_dir = root / F3G_DIR
    keep_held = {f"{c['id']}.json" for c in f3g_held}
    for stale in sorted(f3g_dir.glob("V*.json")) if f3g_dir.is_dir() else []:
        if stale.name not in keep_held:
            stale.unlink()
            changed += 1
    for old_file in ("report.json", "REPORT.md"):
        if (f3g_dir / old_file).is_file():
            (f3g_dir / old_file).unlink()
            changed += 1
    if (f3g_dir / "hold").is_dir():
        for old in sorted((f3g_dir / "hold").iterdir()):
            old.unlink()
            changed += 1
        (f3g_dir / "hold").rmdir()
    for case in f3g_held:
        changed += write_if_changed(f3g_dir / f"{case['id']}.json", json.dumps(case, indent=2, ensure_ascii=False) + "\n")
    changed += write_if_changed(f3g_dir / "INDEX.md", build_f3g_index(
        f3g_ok, f3g_held, hold_f3g, f3g_omitted, f3g_dropped, raw_by_id))

    # F3I: the Ito-Matsui cases wait here for the engine of E15i, or are gone once promoted
    f3i_dir = root / F3I_DIR
    keep_f3i = set() if promote_f3i else {f"{c['id']}.json" for c in f3i_cases}
    for stale in sorted(f3i_dir.glob("V*.json")) if f3i_dir.is_dir() else []:
        if stale.name not in keep_f3i:
            stale.unlink()
            changed += 1
    f3i_report = None
    if promote_f3i:
        for old_file in ("report.json", "REPORT.md"):
            if (f3i_dir / old_file).is_file():
                (f3i_dir / old_file).unlink()
                changed += 1
    elif (f3i_dir / "report.json").is_file():
        f3i_report = json.loads((f3i_dir / "report.json").read_text(encoding="utf-8"))
    for case in f3i_cases:
        if not promote_f3i:
            changed += write_if_changed(f3i_dir / f"{case['id']}.json", json.dumps(case, indent=2, ensure_ascii=False) + "\n")
    changed += write_if_changed(f3i_dir / "INDEX.md", build_f3i_index(f3i_cases, f3i_report, promote_f3i))

    # ---- summary
    n_checks = sum(len(c["checks"]) for c in all_cases)
    n_v02 = sum(c["model"]["version"] == "0.2" for c in converted)
    print(f"Fuente: {src}")
    print(f"Problemas en verification.json: {len(order)}; en problems.ts: {len(problems)}")
    print(f"Lote 0 convertible hoy: {len(batch0)} casos, {sum(len(c['checks']) for c in batch0.values())} checks")
    print(f"Lote 0 retenido: {len(held_cases)} casos, {sum(len(c['checks']) for c in held_cases)} checks")
    n_v03 = sum(c["model"]["version"] == "0.3" for c in converted)
    print(f"verification/cases: {len(all_cases)} casos ({len(converted) - n_v02 - n_v03} v0.1 + {n_v02} v0.2 + {n_v03} v0.3 "
          f"+ {len(f3r_cases)} v0.4 + {len(f3g_ok)} de F3G), {n_checks} checks")
    nb = {b: sum(x == b for bs in promoted_batches.values() for x in bs) for b in (0, 1, 2)}
    print(f"Promovidos desde F3 a verification/cases: {len(promoted)} casos; checks lote 0/1/2 = {nb[0]}/{nb[1]}/{nb[2]}")
    print(f"verification/pending/F3 (retenidos): {len(f3_held)} casos, {sum(len(c['checks']) for c in f3_held)} checks")
    print(f"verification/cases (v0.4, refuerzos, R1 a R4): {len(f3r_cases)} casos, "
          f"{sum(len(c['checks']) for c in f3r_cases)} checks; no entran: {[c for c, _ in f3r_omitted]}")
    print(f"verification/cases (F3G, v0.3 y v0.5): {len(f3g_ok)} casos, {sum(len(c['checks']) for c in f3g_ok)} checks; "
          f"retenidos en pending/F3G: {len(f3g_held)} casos, {sum(len(c['checks']) for c in f3g_held)} checks; "
          f"casos derivados: {[c['id'] for c in f3g_all if c['id'] not in raw_by_id]}")
    print(f"Ito-Matsui (F3I, v0.5): {len(f3i_cases)} casos, {sum(len(c['checks']) for c in f3i_cases)} checks, en "
          + ("verification/cases (promovidos)" if promote_f3i else "verification/pending/F3I"))
    print("Omitidos del lote 0:")
    for cid, reason in omitted:
        print(f"  {cid}: {reason}")
    print(f"Archivos escritos/modificados en esta ejecución: {changed}")
    print("GATES OK: schema, geometría, v0.3")
    generate_cm(root, cm)    # batch CM (F7.6): the held checks stay in pending/CM
    return generate_f3b(root, f3b, promote_f3b)    # batch F3B (v0.6): the held checks stay in pending/F3B


if __name__ == "__main__":
    sys.exit(main())
