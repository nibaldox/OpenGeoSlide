#!/usr/bin/env python3
"""Fourteen synthetic OpenGeoSlide models for the differential battery (ogs vs cSlope 0.1.0).

D01-D10 are v0.1 models. D11-D14 are v0.2 models with pseudo-static seismic coefficients and surface loads
(briefs/01_CONTRATOS_FASE1.md F1.1).

D15-D17 are the v0.3 models of Phase 3a (contract F3.8): an embankment on soft clay with a linear Su, a tailings
deposit with a constant Su, and a sliding block on a weak layer with a fixed polyline. They are written to
`cases_f3/`, apart from the 14 models above, because the consumers of `cases/` (the Rust and web tests, the
web round trip and the 0.2 schema test) do not read version 0.3 yet; run.py reads both directories.

D18-D23 are the models of R10 (briefs/F3A_R10.md, tarea V), also in `cases_f3/`: undrained with a negative gradient and
a limit (D18), Morgenstern-Price with `clipped_sine` and `trapezoidal` (D19, D20), a polyline along a contact between
materials (D21) and a polyline on level ground with kh or a horizontal line load (D22, D23).

Writes verification/differential/cases/<id>.ogs.json and cases_f3/<id>.ogs.json. Nothing here is a published
value: the models only feed two engines, and run.py compares the engines with each other (contract E9b).

Usage (from the worktree root):

    uv run --python 3.13 --no-project --with shapely python verification/differential/build_cases.py

Units: SI (m, kN/m3, kPa). Every model has an analysis search (default grid unless it carries
explicit ranges) and one representative fixed circle in analysis.surface, which run.py uses for
the fixed-surface check. 50 slices, both methods, gamma_w = 9.807 (cSlope 0.1.0 ignores
waterUnitWeight, see verification/harness/README.md).
"""

from __future__ import annotations

import json
import math
from collections.abc import Callable
from pathlib import Path

HERE = Path(__file__).resolve().parent
CASES_DIR = HERE / "cases"
CASES_F3_DIR = HERE / "cases_f3"

GAMMA_W = 9.807
SLICES = 50
METHODS = ["bishop", "spencer"]

# Representative fixed circles (xc, yc, r): the critical circle of ogs main's default Bishop search
# for each model, unrounded on purpose. The search optimum passes through the toe corner by construction;
# rounding it to 4 decimals moves the arc off the corner, and then the circle no longer cuts the ground
# twice (ogs: NoValidSurface; cSlope: EngineError), so the exact float values are kept. D09 is the
# circle quoted in briefs/W7 for the R2-03 slope (its rounded value is valid).
FIXED_SURFACES: dict[str, tuple[float, float, float]] = {
    "D01": (49.57942825454256, 34.823211318713575, 36.11677577292455),
    "D02": (46.537118087549835, 30.97649684375577, 31.658762919636995),
    "D03": (40.01135684250442, 5.899514737241256, 5.899525668458307),
    "D04": (47.089557708209576, 49.90746924985149, 51.12468852803489),
    "D05": (82.92838487497718, 76.39308638542958, 85.36162170596734),
    "D06": (45.320848368234266, 26.724629914882726, 27.24917010562314),
    "D07": (27.03400140234385, 31.871649197129635, 31.866750359158594),
    "D08": (100.73720825848756, 57.00770569226089, 57.01247218207448),
    "D09": (10.77159214833143, 39.640974335435686, 24.641649084951563),
    "D10": (35.819118943985664, 36.28579647805391, 37.55500611193463),
    # D11-D14: critical circle of ogs' default Bishop search with kh / kv / loads, unrounded for the same reason.
    "D11": (49.15361069958381, 52.38433283950057, 54.01051565645141),
    "D12": (78.02156234337791, 86.40658284746021, 93.16814016491793),
    "D13": (25.051065245816822, 23.172099814674574, 23.17215608182742),
    "D14": (26.164842791391187, 22.108248746858482, 23.365781178520713),
}


def _material(mat_id: str, name: str, gamma: float, c: float, phi: float,
              ru: float | None = None, gamma_sat: float | None = None) -> dict:
    return {
        "id": mat_id,
        "name": name,
        "model": "mohr_coulomb",
        "unit_weight": gamma,
        "unit_weight_sat": gamma_sat,
        "cohesion": c,
        "friction_angle": phi,
        "ru": ru,
    }


def _undrained(mat_id: str, name: str, gamma: float, su: float, datum: float | None = None,
               gradient: float | None = None, limit: float | None = None) -> dict:
    """v0.3 `undrained` material (contract F3.2): Su = su + (datum - y)·gradient, an elevation datum."""
    mat: dict = {"id": mat_id, "name": name, "model": "undrained", "unit_weight": gamma, "unit_weight_sat": None,
                 "undrained_strength": su}
    if gradient is not None:
        mat["strength_datum"] = datum
        mat["strength_gradient"] = gradient
        if limit is not None:
            mat["strength_limit"] = limit
    mat["ru"] = None
    return mat


def _region(material: str, polygon: list[tuple[float, float]]) -> dict:
    return {"material": material, "polygon": [[round(x, 6), round(y, 6)] for x, y in polygon]}


def _search(entry: tuple[float, float] | None = None,
            exit_: tuple[float, float] | None = None,
            min_width: float | None = None) -> dict:
    # Defaults of contract §1 (20 x 20 x 20 grid, refine on). Omitted ranges span the whole model.
    block: dict = {
        "type": "circular_entry_exit",
        "n_entry": 20,
        "n_exit": 20,
        "n_radius": 20,
        "max_radius_factor": 5.0,
        "min_width": min_width,
        "refine": True,
    }
    if entry is not None:
        block["entry"] = list(entry)
    if exit_ is not None:
        block["exit"] = list(exit_)
    return block


def _model(case_id: str, title: str, intent: str, direction: str,
           materials: list[dict], regions: list[dict], search: dict,
           piezo: list[tuple[float, float]] | None = None,
           loads: list[dict] | None = None, seismic: dict | None = None) -> dict:
    water: dict = {"unit_weight": GAMMA_W}
    if piezo:
        water["piezometric_line"] = [[x, y] for x, y in piezo]
    analysis: dict = {
        "methods": list(METHODS),
        "slices": SLICES,
        "tolerance": 1e-5,
        "max_iterations": 500,
        "min_m_alpha": 0.2,
        "search": search,
    }
    if seismic is not None:
        analysis["seismic"] = dict(seismic)
    if case_id in FIXED_SURFACES:
        xc, yc, r = FIXED_SURFACES[case_id]
        analysis["surface"] = {"type": "circle", "xc": xc, "yc": yc, "r": r}
    v02 = bool(loads) or seismic is not None
    model: dict = {
        "format": "opengeoslide",
        "version": "0.2" if v02 else "0.1",
        "meta": {"id": case_id, "title": title, "notes": intent},
        "units": "SI",
        "materials": materials,
        "regions": regions,
        "water": water,
    }
    if loads:
        model["loads"] = [dict(load) for load in loads]
    model["slope"] = {"direction": direction}
    model["analysis"] = analysis
    return model


# Shared 1:1 homogeneous profile (height 20 m, crest x in [0, 20], toe at x = 40).
HOMOGENEOUS_1_1 = [(0.0, 0.0), (0.0, 20.0), (20.0, 20.0), (40.0, 0.0)]


def d01() -> dict:
    # Control case: homogeneous 1:1 slope, dry, no pore pressure at all.
    intent = "Talud homogéneo 1:1 de 20 m, seco. Control sin presión de poros: el más simple de los diez."
    return _model(
        "D01", "Talud homogéneo 1:1, seco", intent, "left_to_right",
        [_material("soil", "Suelo", 18.0, 10.0, 25.0)],
        [_region("soil", HOMOGENEOUS_1_1)],
        _search(),
    )


def d02() -> dict:
    # Same slope with r_u = 0.5: pore pressure proportional to the column stress (ru·σv).
    intent = "Igual que D01 con r_u = 0,5 (presión de poros ru·σv, sin línea piezométrica)."
    return _model(
        "D02", "Talud 1:1 con r_u = 0,5", intent, "left_to_right",
        [_material("soil", "Suelo", 18.0, 10.0, 25.0, ru=0.5)],
        [_region("soil", HOMOGENEOUS_1_1)],
        _search(),
    )


def d03() -> dict:
    # Weak clay layer at the base: a thin soft band (c = 2, phi = 12) under a stronger fill, the
    # typical sliding plane of a tailings or embankment foundation.
    intent = ("Relleno sobre una capa débil de arcilla en la base (plano de deslizamiento probable). "
              "Dos materiales, arista compartida a y = 4 m.")
    upper = [(0.0, 4.0), (0.0, 20.0), (20.0, 20.0), (36.0, 4.0)]
    weak = [(0.0, 0.0), (0.0, 4.0), (36.0, 4.0), (40.0, 0.0)]
    return _model(
        "D03", "Dos capas con capa débil en la base", intent, "left_to_right",
        [_material("fill", "Relleno", 19.0, 15.0, 30.0),
         _material("weak", "Arcilla débil de base", 18.0, 2.0, 12.0)],
        [_region("fill", upper), _region("weak", weak)],
        _search(),
    )


def d04() -> dict:
    # Open-pit wall with three benches (10 m faces at ~59 deg, 6 m berms), rock mass. Explicit
    # search ranges: entry on the upper benches, exit on the toe benches.
    intent = ("Pared de rajo con 3 bancos (cara de 10 m, berma de 6 m), macizo rocoso. "
              "Rangos de búsqueda explícitos: entrada en los bancos altos, salida en el pie.")
    profile = [(0.0, 0.0), (0.0, 30.0), (6.0, 30.0), (12.0, 20.0), (18.0, 20.0),
               (24.0, 10.0), (30.0, 10.0), (36.0, 0.0)]
    return _model(
        "D04", "Pared de rajo, 3 bancos", intent, "left_to_right",
        [_material("rock", "Macizo rocoso", 25.0, 50.0, 35.0)],
        [_region("rock", profile)],
        _search(entry=(0.0, 12.0), exit_=(18.0, 36.0)),
    )


def d05() -> dict:
    # Waste dump built at the angle of repose (37 deg), granular, c = 0.
    intent = "Botadero de estéril granular, c = 0, talud al ángulo de reposo de 37°."
    run = 25.0 / math.tan(math.radians(37.0))
    profile = [(0.0, 0.0), (0.0, 25.0), (10.0, 25.0), (10.0 + run, 0.0)]
    return _model(
        "D05", "Botadero, ángulo de reposo 37°", intent, "left_to_right",
        [_material("waste", "Estéril granular", 16.0, 0.0, 37.0)],
        [_region("waste", profile)],
        _search(),
    )


def d06() -> dict:
    # D01 geometry with an inclined piezometric line (from 12 m at the crest to the toe).
    intent = "Talud 1:1 con línea piezométrica inclinada desde (0; 12) hasta el pie (40; 0). γw = 9,807."
    return _model(
        "D06", "Talud con piezométrica inclinada", intent, "left_to_right",
        [_material("soil", "Suelo", 19.0, 5.0, 28.0)],
        [_region("soil", HOMOGENEOUS_1_1)],
        _search(),
        piezo=[(0.0, 12.0), (30.0, 6.0), (40.0, 0.0)],
    )


def d07() -> dict:
    # Soft clay, undrained (phi = 0, c = Su), 2H:1V embankment.
    intent = "Terraplén 2H:1V sobre arcilla blanda no drenada (φ = 0, c = Su = 35 kPa)."
    return _model(
        "D07", "Arcilla blanda, φ = 0", intent, "left_to_right",
        [_material("clay", "Arcilla blanda (φu = 0)", 18.0, 35.0, 0.0)],
        [_region("clay", [(0.0, 0.0), (0.0, 15.0), (10.0, 15.0), (40.0, 0.0)])],
        _search(),
    )


def d08() -> dict:
    # Symmetric dam (2H:1V both faces). No explicit direction: auto resolves it from the search
    # ranges (contract E1): entry on the crest, exit on the downstream face.
    intent = ("Presa simétrica 2H:1V, sin sentido explícito: auto se resuelve con los rangos de búsqueda "
              "(entrada en la coronación, salida en el talud de aguas abajo).")
    profile = [(0.0, 0.0), (40.0, 20.0), (60.0, 20.0), (100.0, 0.0)]
    return _model(
        "D08", "Presa simétrica con rangos de búsqueda", intent, "auto",
        [_material("core", "Núcleo de presa", 20.0, 10.0, 30.0)],
        [_region("core", profile)],
        _search(entry=(40.0, 60.0), exit_=(60.0, 100.0)),
    )


def d09() -> dict:
    # Slope of R2-03 (briefs/W7): c = 2, phi = 45, ru = 0.65, default search. Direction is auto
    # (equal full-range midpoints, so the crest rule of E1 decides: right_to_left).
    intent = ("Talud de R2-03 (briefs/W7): c = 2, φ = 45°, r_u = 0,65. Búsqueda por defecto; "
              "el sentido lo decide la regla 2 de E1 (coronación a la derecha).")
    profile = [(0.0, 0.0), (0.0, 15.0), (15.0, 15.0), (30.0, 25.0), (60.0, 25.0), (60.0, 0.0)]
    return _model(
        "D09", "Talud R2-03 (c = 2, φ = 45°, r_u = 0,65)", intent, "auto",
        [_material("soil", "Suelo", 20.0, 2.0, 45.0, ru=0.65)],
        [_region("soil", profile)],
        _search(),
    )


def d10() -> dict:
    # High cohesion, low friction, steep 1.5H:1V slope on a deeper foundation: deep-seated circles.
    intent = ("Talud 1.5H:1V con c alto (40 kPa) y φ bajo (10°) sobre cimentación de 10 m: "
              "círculos profundos.")
    profile = [(0.0, -10.0), (0.0, 25.0), (8.0, 25.0), (45.5, 0.0), (45.5, -10.0)]
    return _model(
        "D10", "Talud con c alto y φ bajo, círculo profundo", intent, "left_to_right",
        [_material("soil", "Suelo cohesivo", 18.0, 40.0, 10.0)],
        [_region("soil", profile)],
        _search(),
    )


def d11() -> dict:
    # D04's open-pit wall (3 benches) with a horizontal pseudo-static coefficient kh = 0.15, weaker rock mass.
    intent = ("Pared de rajo con 3 bancos (geometría de D04) con sismo pseudoestático kh = 0,15, macizo rocoso "
              "c = 40 kPa, φ = 32°. Rangos de búsqueda explícitos como D04.")
    profile = [(0.0, 0.0), (0.0, 30.0), (6.0, 30.0), (12.0, 20.0), (18.0, 20.0),
               (24.0, 10.0), (30.0, 10.0), (36.0, 0.0)]
    return _model(
        "D11", "Pared de rajo, 3 bancos, kh = 0,15", intent, "left_to_right",
        [_material("rock", "Macizo rocoso", 25.0, 40.0, 32.0)],
        [_region("rock", profile)],
        _search(entry=(0.0, 12.0), exit_=(18.0, 36.0)),
        seismic={"kh": 0.15, "kv": 0.0},
    )


def d12() -> dict:
    # Waste dump with a 50 kPa uniform load on the crest (haul trucks) and an upward vertical coefficient.
    intent = ("Botadero de estéril de 25 m con una carga distribuida de 50 kPa en toda la corona (x de 0 a 10 m) "
              "y kv = −0,05 (fuerza vertical hacia arriba). c = 2 kPa, φ = 35°.")
    run = 25.0 / math.tan(math.radians(37.0))
    profile = [(0.0, 0.0), (0.0, 25.0), (10.0, 25.0), (10.0 + run, 0.0)]
    return _model(
        "D12", "Botadero con sobrecarga en la corona y kv = −0,05", intent, "left_to_right",
        [_material("waste", "Estéril granular", 18.0, 2.0, 35.0)],
        [_region("waste", profile)],
        _search(),
        loads=[{"type": "udl", "id": "u1", "x1": 0.0, "x2": 10.0, "q": 50.0}],
        seismic={"kh": 0.0, "kv": -0.05},
    )


def d13() -> dict:
    # Civil cut: 10 m, 1.5H:1V, on a 8 m foundation; a 100 kN/m line load (footing line) tilted 15 degrees
    # toward +x (the sliding direction) on the crest.
    intent = ("Talud civil de 10 m, 1,5H:1V, con una carga lineal de 100 kN/m en x = 6 m (corona) inclinada 15° "
              "hacia +x (el sentido del deslizamiento), sobre una cimentación de 8 m. c = 15 kPa, φ = 26°. "
              "La búsqueda fija min_width = 5 m para excluir fallas locales bajo la carga.")
    profile = [(0.0, -8.0), (0.0, 10.0), (10.0, 10.0), (25.0, 0.0), (40.0, 0.0), (40.0, -8.0)]
    return _model(
        "D13", "Talud civil con carga lineal de 100 kN/m a 15°", intent, "left_to_right",
        [_material("soil", "Suelo cohesivo-friccional", 19.0, 15.0, 26.0)],
        [_region("soil", profile)],
        # min_width = 5: a line load makes tiny local circles under it degenerate (m_alpha < 0.2); see the
        # D13 finding in README.md. Same convention in both engines: an excluded local failure, not a tolerance.
        _search(min_width=5.0),
        loads=[{"type": "line", "id": "l1", "x": 6.0, "p": 100.0, "angle": 15.0}],
    )


def d14() -> dict:
    # Homogeneous embankment dam, 12 m, 2H:1V, with kh = 0.1 and an inclined piezometric line.
    intent = ("Terraplén homogéneo de 12 m con taludes 2H:1V, sismo kh = 0,1 y línea piezométrica que baja desde "
              "(0; 9) hasta el pie (32; 0). c = 12 kPa, φ = 30°, γ = 19 kN/m³, γw = 9,807.")
    profile = [(0.0, -5.0), (0.0, 12.0), (8.0, 12.0), (32.0, 0.0), (50.0, 0.0), (50.0, -5.0)]
    return _model(
        "D14", "Terraplén con kh = 0,1 y piezométrica", intent, "left_to_right",
        [_material("fill", "Relleno compactado", 19.0, 12.0, 30.0)],
        [_region("fill", profile)],
        _search(),
        piezo=[(0.0, 9.0), (20.0, 5.0), (32.0, 0.0), (50.0, 0.0)],
        seismic={"kh": 0.1, "kv": 0.0},
    )


# ---------------------------------------------------------------- v0.3 models (Phase 3a, contract F3.8)

# Representative fixed circles of D15 and D16. D15: the critical circle of cSlope's own Bishop search (the engine of
# ogs could not run undrained materials in the commit that created these models), unrounded for the reason above.
FIXED_SURFACES_F3: dict[str, tuple[float, float, float]] = {
    "D15": (37.77554433830855, 8.248956174132008, 13.190940630872689),
    # D16: not the search optimum (a circle tangent to the foundation, with a 4e-7 sliver of it, is a trap for any
    # slicer) but a circle that enters at the crest (x = 3.9), dips 0.5 m into the foundation and leaves on its top.
    "D16": (52.0, 82.0, 82.5),
    # D18 (R10): a deep circle that reaches y = -14, under the depth where the Su floor of 25 kPa starts (y = -12.5), so
    # that the floor matters (1.207 with it, 1.189 without it). D19 and D20 (R10): the critical circle of the default
    # Bishop search of ogs on the geometry they share, unrounded for the reason above.
    "D18": (45.0, 32.0, 46.0),
    "D19": (43.6466144187929, 36.352819511930406, 36.37800350484352),
}
# D17: a fixed polyline along a thin weak layer (active wedge, base along the layer). Its ends lie on the ground.
D17_POLYLINE = [(8.0, 20.0), (14.0, 3.0), (37.0, 3.0)]


def _model_f3(case_id: str, title: str, intent: str, direction: str, materials: list[dict], regions: list[dict],
              methods: list[str], search: dict | None, surface: dict | None, *, loads: list[dict] | None = None,
              seismic: dict | None = None, interslice: dict | None = None) -> dict:
    analysis: dict = {
        "methods": methods,
        "slices": SLICES,
        "tolerance": 1e-5,
        "max_iterations": 500,
        "min_m_alpha": 0.2,
    }
    if search is not None:
        analysis["search"] = search
    if surface is not None:
        analysis["surface"] = surface
    if seismic is not None:
        analysis["seismic"] = dict(seismic)
    if interslice is not None:
        analysis["interslice"] = dict(interslice)
    model: dict = {
        "format": "opengeoslide",
        "version": "0.3",
        "meta": {"id": case_id, "title": title, "notes": intent},
        "units": "SI",
        "materials": materials,
        "regions": regions,
        "water": {"unit_weight": GAMMA_W},
    }
    if loads:
        model["loads"] = [dict(load) for load in loads]
    model["slope"] = {"direction": direction}
    model["analysis"] = analysis
    return model


def d15() -> dict:
    # Embankment (6 m, 2H:1V, crest of 10 m) on 12 m of soft clay whose Su grows with depth: Su = 15 kPa at the
    # surface (y = 0), +1.5 kPa per metre. The classic case of an undrained foundation with a linear profile.
    intent = ("Terraplén de 6 m, 2H:1V, sobre 12 m de arcilla blanda con Su lineal: 15 kPa en la superficie "
              "(strength_datum = 0) y 1,5 kPa por metro de profundidad. Relleno friccional. Prueba el gradiente de Su.")
    fill = [(10.0, 0.0), (22.0, 6.0), (32.0, 6.0), (44.0, 0.0)]
    clay = [(0.0, -12.0), (0.0, 0.0), (10.0, 0.0), (44.0, 0.0), (60.0, 0.0), (60.0, -12.0)]
    surface = None
    if "D15" in FIXED_SURFACES_F3:
        xc, yc, r = FIXED_SURFACES_F3["D15"]
        surface = {"type": "circle", "xc": xc, "yc": yc, "r": r}
    return _model_f3(
        "D15", "Terraplén sobre arcilla blanda, Su lineal", intent, "left_to_right",
        [_material("fill", "Relleno compactado", 19.0, 8.0, 34.0),
         _undrained("clay", "Arcilla blanda (Su lineal)", 16.5, 15.0, datum=0.0, gradient=1.5)],
        [_region("fill", fill), _region("clay", clay)],
        ["bishop", "spencer"], _search(entry=(22.0, 32.0), exit_=(44.0, 58.0)), surface)


def d16() -> dict:
    # Tailings deposit: a 15 m stack, 2.5H:1V, with a constant Su of 45 kPa on a firm foundation. Phi = 0 slope in
    # the Taylor sense: the circle goes deep, into the tailings, and its factor depends on Su alone.
    intent = ("Depósito de relaves de 15 m, talud 2,5H:1V, con Su constante de 25 kPa (sin gradiente) sobre una "
              "cimentación firme de 8 m. Talud φ = 0: la superficie crítica va dentro de los relaves y el factor depende "
              "casi solo de Su. Prueba el no drenado constante.")
    found = [(0.0, -8.0), (0.0, 0.0), (85.0, 0.0), (85.0, -8.0)]
    tailings = [(0.0, 0.0), (0.0, 15.0), (15.0, 15.0), (52.5, 0.0)]
    surface = None
    if "D16" in FIXED_SURFACES_F3:
        xc, yc, r = FIXED_SURFACES_F3["D16"]
        surface = {"type": "circle", "xc": xc, "yc": yc, "r": r}
    return _model_f3(
        "D16", "Depósito de relaves, Su constante", intent, "left_to_right",
        [_material("found", "Cimentación firme", 22.0, 40.0, 38.0),
         _undrained("tailings", "Relaves (Su constante)", 17.0, 25.0)],
        [_region("found", found), _region("tailings", tailings)],
        ["bishop", "spencer"], _search(entry=(5.0, 15.0), exit_=(52.5, 75.0)), surface)


def d17() -> dict:
    # Rock slope of 20 m, 1:1, with a thin weak layer (y between 2 and 4) that daylights on the face: a sliding
    # block. Fixed polyline: back scarp, base along the layer, exit on the face. Only Spencer, M-P and Janbu
    # (contract F3.6: no Bishop on a polyline).
    intent = ("Bloque deslizante sobre una capa débil delgada (c = 2 kPa, φ = 10°, cota 2 a 4 m) que aflora en el "
              "talud de 20 m, 1:1. Superficie fija: polilínea de tres puntos (escarpe, base sobre la capa, salida en "
              "la cara). Sin Bishop (F3.6). Prueba Spencer, Morgenstern-Price y Janbu sobre una polilínea.")
    upper = [(0.0, 4.0), (0.0, 20.0), (20.0, 20.0), (36.0, 4.0)]
    weak = [(0.0, 2.0), (0.0, 4.0), (36.0, 4.0), (38.0, 2.0)]
    lower = [(0.0, -10.0), (0.0, 2.0), (38.0, 2.0), (40.0, 0.0), (60.0, 0.0), (60.0, -10.0)]
    return _model_f3(
        "D17", "Bloque sobre capa débil, polilínea fija", intent, "left_to_right",
        [_material("rock", "Roca competente", 25.0, 30.0, 38.0),
         _material("weak", "Capa débil", 19.0, 2.0, 10.0),
         _material("base", "Roca de base", 26.0, 60.0, 40.0)],
        [_region("rock", upper), _region("weak", weak), _region("base", lower)],
        ["spencer", "morgenstern_price", "janbu_corrected"], None,
        {"type": "polyline", "points": [[x, y] for x, y in D17_POLYLINE]})


def _fixed_circle(case_id: str) -> dict | None:
    if case_id not in FIXED_SURFACES_F3:
        return None
    xc, yc, r = FIXED_SURFACES_F3[case_id]
    return {"type": "circle", "xc": xc, "yc": yc, "r": r}


def d18() -> dict:
    # R10 (R10A-11 4): undrained with a NEGATIVE gradient and a limit. A desiccated crust: Su = 70 kPa at the crest
    # (strength_datum = 10) that falls 2 kPa per metre of depth and stops at the limit of 25 kPa (a floor: for a
    # negative gradient `strength_limit` is a minimum). No case of the 93 or of D01-D17 covers it.
    intent = ("Corte de 10 m, 2H:1V, en arcilla preconsolidada con Su decreciente en profundidad: 70 kPa en la cota "
              "del coronamiento (strength_datum = 10), gradiente de −2 kPa/m y piso de 25 kPa (strength_limit); el "
              "piso se alcanza a 22,5 m de profundidad bajo la cota 10. "
              "Prueba el gradiente negativo con límite, que ningún caso cubría.")
    profile = [(0.0, -20.0), (0.0, 10.0), (40.0, 10.0), (60.0, 0.0), (95.0, 0.0), (95.0, -20.0)]
    return _model_f3(
        "D18", "Corte en arcilla con Su decreciente y piso", intent, "left_to_right",
        [_undrained("clay", "Arcilla preconsolidada (Su decreciente)", 18.0, 70.0, datum=10.0, gradient=-2.0,
                    limit=25.0)],
        [_region("clay", profile)],
        ["bishop", "spencer"], _search(entry=(0.0, 40.0), exit_=(55.0, 85.0)), _fixed_circle("D18"))


# D19 and D20 share the geometry: only the function between slices differs.
def _d19_materials() -> list[dict]:
    return [_material("fill", "Relleno", 19.0, 8.0, 30.0), _material("clay", "Arcilla de base", 18.0, 25.0, 22.0)]


def _d19_regions() -> list[dict]:
    fill = [(0.0, 6.0), (0.0, 20.0), (15.0, 20.0), (36.0, 6.0)]
    base = [(0.0, -10.0), (0.0, 6.0), (36.0, 6.0), (45.0, 0.0), (75.0, 0.0), (75.0, -10.0)]
    return [_region("fill", fill), _region("clay", base)]


def d19() -> dict:
    # R10 (R10A-11 4): Morgenstern-Price with `clipped_sine`. Two layers, so that the function between slices matters.
    intent = ("Talud de 20 m, 1,5H:1V, de relleno (c = 8 kPa, φ = 30°) sobre arcilla (c = 25 kPa, φ = 22°) con la "
              "arista compartida a 6 m. Morgenstern-Price con la función `clipped_sine`, que ningún caso cubría. "
              "Comparte la geometría con D20.")
    return _model_f3(
        "D19", "Dos capas, M-P con clipped_sine", intent, "left_to_right", _d19_materials(), _d19_regions(),
        ["bishop", "spencer", "morgenstern_price"], _search(entry=(0.0, 15.0), exit_=(45.0, 70.0)),
        _fixed_circle("D19"), interslice={"function": "clipped_sine"})


def d20() -> dict:
    # R10 (R10A-11 4): the same slope as D19 with `trapezoidal`.
    intent = ("Igual que D19 (talud de 20 m sobre dos capas) con Morgenstern-Price y la función `trapezoidal`, que "
              "ningún caso cubría.")
    return _model_f3(
        "D20", "Dos capas, M-P con trapezoidal", intent, "left_to_right", _d19_materials(), _d19_regions(),
        ["bishop", "spencer", "morgenstern_price"], _search(entry=(0.0, 15.0), exit_=(45.0, 70.0)),
        _fixed_circle("D19"), interslice={"function": "trapezoidal"})


def d21() -> dict:
    # R10 (R10A-04, E13l-5): a polyline whose base runs ALONG the contact between two materials: the roof of a weak
    # layer. The engine chose the upper material; cSlope takes the weaker one (3.630 against 3.018 in R10A-04).
    intent = ("Corte de 20 m, 1:1, en un estrato fuerte (c = 20 kPa, φ = 30°) sobre un estrato débil (c = 2 kPa, "
              "φ = 10°) cuyo techo, en y = 10 m, aflora en el pie. Polilínea fija de tres puntos (escarpe, base y "
              "salida): su tramo central corre exactamente sobre el contacto, y el motor debe tomar el material más "
              "débil (E13l-5).")
    top = [(0.0, 10.0), (0.0, 30.0), (20.0, 30.0), (40.0, 10.0)]
    weak = [(0.0, 0.0), (0.0, 10.0), (40.0, 10.0), (60.0, 10.0), (60.0, 0.0)]
    return _model_f3(
        "D21", "Polilínea sobre el contacto de dos materiales", intent, "left_to_right",
        [_material("strong", "Estrato fuerte", 20.0, 20.0, 30.0), _material("weak", "Estrato débil", 18.0, 2.0, 10.0)],
        [_region("strong", top), _region("weak", weak)],
        ["spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"], None,
        {"type": "polyline", "points": [[10.0, 30.0], [14.0, 10.0], [40.0, 10.0]]})


_FLAT_BLOCK = [[10.0, 10.0], [15.0, 5.0], [25.0, 5.0], [30.0, 10.0]]


def _flat_model(case_id: str, title: str, intent: str, methods: list[str], **extra) -> dict:
    ground = [(0.0, -10.0), (0.0, 10.0), (40.0, 10.0), (40.0, -10.0)]
    return _model_f3(
        case_id, title, intent, "left_to_right",
        [_undrained("clay", "Arcilla (Su constante)", 20.0, 50.0)],
        [_region("clay", ground)],
        methods, None, {"type": "polyline", "points": [list(p) for p in _FLAT_BLOCK]}, **extra)


def d22() -> dict:
    # R10 (R10A-02, E13l-2): a polyline on level ground with kh. The only driving force is the horizontal inertia;
    # the engine said `no_driving` while cSlope converges (Janbu 3.333, Spencer 3.986 in R10A-02).
    intent = ("Terreno horizontal (y = 10) en arcilla con Su = 50 kPa y γ = 20 kN/m³. Polilínea fija simétrica "
              "(bloque de 5 m de profundidad) con kh = 0,3: la única fuerza motriz es el sismo horizontal. "
              "Ejercita E3 con t = W·sen α + H·cos α en superficies no circulares (E13l-2).")
    return _flat_model("D22", "Polilínea en terreno horizontal con kh", intent,
                       ["spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"],
                       seismic={"kh": 0.3, "kv": 0.0})


def d23() -> dict:
    # R10 (R10A-02, E13l-2): the same block with a horizontal line load instead of the seismic coefficient.
    intent = ("Igual que D22 con una carga lineal horizontal de 200 kN/m en x = 15 m (ángulo de 90°) en lugar de "
              "sismo. La única fuerza motriz es la carga horizontal (E13l-2). Solo Janbu: con una fuerza horizontal pura "
              "cSlope no converge en Spencer y da un M-P cuatro veces el de D22, sin referencia fiable.")
    return _flat_model("D23", "Polilínea en terreno horizontal con carga lineal horizontal", intent,
                       ["janbu_simplified", "janbu_corrected"],
                       loads=[{"type": "line", "id": "l1", "x": 15.0, "p": 200.0, "angle": 90.0}])


BUILDERS_F3: list[Callable[[], dict]] = [d15, d16, d17, d18, d19, d20, d21, d22, d23]


BUILDERS: list[Callable[[], dict]] = [d01, d02, d03, d04, d05, d06, d07, d08, d09, d10, d11, d12, d13, d14]


def build_all() -> dict[str, dict]:
    """Model for every case id, keyed by id (D01..D14), in order."""
    models = {}
    for build in BUILDERS:
        model = build()
        models[model["meta"]["id"]] = model
    return models


def build_all_f3() -> dict[str, dict]:
    """The v0.3 models D15-D23, keyed by id, in order."""
    models = {}
    for build in BUILDERS_F3:
        model = build()
        models[model["meta"]["id"]] = model
    return models


def serialize(model: dict) -> str:
    return json.dumps(model, ensure_ascii=False, indent=2) + "\n"


def write_cases(directory: Path = CASES_DIR, f3_directory: Path = CASES_F3_DIR) -> list[Path]:
    directory.mkdir(parents=True, exist_ok=True)
    f3_directory.mkdir(parents=True, exist_ok=True)
    paths = []
    for case_id, model in build_all_f3().items():
        path = f3_directory / f"{case_id}.ogs.json"
        path.write_text(serialize(model), encoding="utf-8")
        paths.append(path)
    for case_id, model in build_all().items():
        path = directory / f"{case_id}.ogs.json"
        path.write_text(serialize(model), encoding="utf-8")
        paths.append(path)
    return paths


if __name__ == "__main__":
    for path in write_cases():
        print(path.relative_to(HERE.parent.parent))
