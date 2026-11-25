#!/usr/bin/env python3
"""Fourteen synthetic OpenGeoSlide models for the differential battery (ogs vs cSlope 0.1.0).

D01-D10 are v0.1 models. D11-D14 are v0.2 models with pseudo-static seismic coefficients and surface loads
(briefs/01_CONTRATOS_FASE1.md F1.1).

Writes verification/differential/cases/<id>.ogs.json. Nothing here is a published value: the
models only feed two engines, and run.py compares the engines with each other (contract E9b).

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


def _region(material: str, polygon: list[tuple[float, float]]) -> dict:
    return {"material": material, "polygon": [[round(x, 6), round(y, 6)] for x, y in polygon]}


def _search(entry: tuple[float, float] | None = None,
            exit_: tuple[float, float] | None = None) -> dict:
    # Defaults of contract §1 (20 x 20 x 20 grid, refine on). Omitted ranges span the whole model.
    block: dict = {
        "type": "circular_entry_exit",
        "n_entry": 20,
        "n_exit": 20,
        "n_radius": 20,
        "max_radius_factor": 5.0,
        "min_width": None,
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
              "hacia +x (el sentido del deslizamiento), sobre una cimentación de 8 m. c = 15 kPa, φ = 26°.")
    profile = [(0.0, -8.0), (0.0, 10.0), (10.0, 10.0), (25.0, 0.0), (40.0, 0.0), (40.0, -8.0)]
    return _model(
        "D13", "Talud civil con carga lineal de 100 kN/m a 15°", intent, "left_to_right",
        [_material("soil", "Suelo cohesivo-friccional", 19.0, 15.0, 26.0)],
        [_region("soil", profile)],
        _search(),
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


BUILDERS: list[Callable[[], dict]] = [d01, d02, d03, d04, d05, d06, d07, d08, d09, d10, d11, d12, d13, d14]


def build_all() -> dict[str, dict]:
    """Model for every case id, keyed by id (D01..D14), in order."""
    models = {}
    for build in BUILDERS:
        model = build()
        models[model["meta"]["id"]] = model
    return models


def serialize(model: dict) -> str:
    return json.dumps(model, ensure_ascii=False, indent=2) + "\n"


def write_cases(directory: Path = CASES_DIR) -> list[Path]:
    directory.mkdir(parents=True, exist_ok=True)
    paths = []
    for case_id, model in build_all().items():
        path = directory / f"{case_id}.ogs.json"
        path.write_text(serialize(model), encoding="utf-8")
        paths.append(path)
    return paths


if __name__ == "__main__":
    for path in write_cases():
        print(path.relative_to(HERE.parent.parent))
