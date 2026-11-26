"""Comparación por cruce de las fuerzas de refuerzo: ogs (`reinforcement_forces`) frente al oráculo
(`criticalSurface.reinforcementForces`), F3R-R2 (I1).

Todo es puro (sin motores): `compare_forces` recibe las dos listas ya leídas y devuelve, por cruce, la posición, la
fuerza y la dirección de cada lado, la diferencia y su explicación. El harness (`run.py`) la llama por cada check de
un caso con `reinforcements` y la escribe en `report.json` y en `REPORT.md`.

Correspondencia de índices: el oráculo numera los elementos de tracción (`anchor`, `nail`, `geosynthetic`) y los
pilotes (`pile`, `sheet_pile`) por separado, en el orden del modelo (`to_cslope.reinforcements_to_cslope`).
Los cruces de un mismo elemento se ordenan por `x` y se emparejan en ese orden; si los conteos difieren, lo que sobra
de un lado queda como «solo ogs» o «solo oráculo».
"""

from __future__ import annotations

import math

TENSION_TYPES = ("anchor", "nail", "geosynthetic")

# Por debajo de esto dos fuerzas son la misma (1e-9 de la escala de la fuerza del elemento).
SAME_REL = 1e-9
# Una diferencia de fuerza se atribuye a la rampa si la explica a este margen relativo.
RAMP_MARGIN = 0.05
# Ángulo (rad) por debajo del cual dos direcciones son la misma.
SAME_ANGLE = 1e-6


def element_ids(model: dict) -> tuple[list[str], list[str]]:
    """Ids de los elementos de tracción y de los pilotes, en el orden con que los numera el oráculo."""
    items = model.get("reinforcements") or []
    tension = [e["id"] for e in items if e["type"] in TENSION_TYPES]
    piles = [e["id"] for e in items if e["type"] not in TENSION_TYPES]
    return tension, piles


def oracle_forces_by_id(model: dict, oracle_forces: list[dict]) -> list[tuple[str, dict]]:
    """Las fuerzas del oráculo con el id de ogs del elemento."""
    tension, piles = element_ids(model)
    out = []
    for f in oracle_forces or []:
        ids = piles if f.get("pile") else tension
        out.append((ids[f["index"]], f))
    return out


def _angle(fx: float, fy: float) -> float | None:
    return None if math.hypot(fx, fy) == 0 else math.atan2(fy, fx)


def _explain(element: dict, o: dict, c: dict, scale: float) -> tuple[str, dict]:
    """Clasifica la diferencia de un cruce emparejado: devuelve `(código, detalle)`."""
    dfx, dfy = c["fx"] - o["fx"], c["fy"] - o["fy"]
    df = math.hypot(dfx, dfy)
    fo, fc = math.hypot(o["fx"], o["fy"]), math.hypot(c["fx"], c["fy"])
    detail: dict = {"dF": df}
    if df <= SAME_REL * max(scale, 1e-300):
        return "igual", detail
    ao, ac = _angle(o["fx"], o["fy"]), _angle(c["fx"], c["fy"])
    if ao is not None and ac is not None:
        detail["dangle_deg"] = math.degrees(ac - ao)
    # Misma magnitud y otra dirección: `tangent` o `bisector` miden la base en otro punto (cuerda frente a tangente).
    if abs(fo - fc) <= SAME_REL * max(scale, 1e-300) and detail.get("dangle_deg") is not None:
        return "direccion", detail
    # `development`: la fuerza es una rampa de la estación; la posición difiere por la cuerda del oráculo.
    pullout = element.get("pullout") or {}
    if pullout.get("model") == "development":
        length = math.hypot(element["x2"] - element["x1"], element["y2"] - element["y1"])
        cos_a = abs(element["x2"] - element["x1"]) / length if length else 0.0
        if cos_a > 1e-9:
            ds = (c["x"] - o["x"]) / ((element["x2"] - element["x1"]) / length)
            detail["ds"] = ds
            tmax = element["tensile_capacity"]
            for key in ("length1", "length2"):
                ell = pullout.get(key)
                if ell and abs(abs(df) - tmax / ell * abs(ds)) <= RAMP_MARGIN * df:
                    detail["slope"] = tmax / ell
                    return "rampa", detail
    return "sin explicar", detail


def compare_forces(model: dict, ogs_forces: list[dict], oracle_forces: list[dict],
                   circle: dict | None = None) -> dict:
    """Compara los cruces aplicados por ogs con los del oráculo.

    `ogs_forces`: `reinforcement_forces` del informe de ogs; solo los de estado `applied` cuentan como aplicados (los
    otros estados se listan en `ogs_not_applied`). `oracle_forces`: `reinforcementForces` de cSlope. `circle`
    (`xc`, `yc`, `r`, opcional): si se da, cada par lleva `radial_oracle`, la distancia del punto del oráculo a la
    circunferencia exacta (el oráculo cruza con la poligonal de sus dovelas, no con el arco).
    """
    elements = {e["id"]: e for e in model.get("reinforcements") or []}
    applied = [f for f in ogs_forces or [] if f.get("status") == "applied"]
    not_applied = [{"id": f["id"], "status": f["status"]} for f in ogs_forces or [] if f.get("status") != "applied"]
    by_ogs: dict[str, list[dict]] = {}
    for f in applied:
        by_ogs.setdefault(f["id"], []).append(f)
    by_oracle: dict[str, list[dict]] = {}
    for eid, f in oracle_forces_by_id(model, oracle_forces):
        by_oracle.setdefault(eid, []).append(f)

    pairs: list[dict] = []
    only_ogs: list[dict] = []
    only_oracle: list[dict] = []
    for eid in [e for e in elements if e in by_ogs or e in by_oracle]:
        a = sorted(by_ogs.get(eid, []), key=lambda f: f["x"])
        b = sorted(by_oracle.get(eid, []), key=lambda f: f["x"])
        k = min(len(a), len(b))
        for o, c in zip(a[:k], b[:k]):
            scale = max(math.hypot(o["fx"], o["fy"]), math.hypot(c["fx"], c["fy"]))
            code, detail = _explain(elements[eid], o, c, scale)
            pair = {
                "id": eid,
                "ogs": {k_: o[k_] for k_ in ("x", "y", "fx", "fy")},
                "oracle": {k_: c[k_] for k_ in ("x", "y", "fx", "fy")},
                "dx": c["x"] - o["x"], "dy": c["y"] - o["y"],
                "dfx": c["fx"] - o["fx"], "dfy": c["fy"] - o["fy"],
                "explanation": code, **detail,
            }
            if circle:
                pair["radial_oracle"] = math.hypot(c["x"] - circle["xc"], c["y"] - circle["yc"]) - circle["r"]
            pairs.append(pair)
        only_ogs += [{"id": eid, "application": f.get("application"),
                      **{k_: f[k_] for k_ in ("x", "y", "fx", "fy")}} for f in a[k:]]
        only_oracle += [{"id": eid, **{k_: f[k_] for k_ in ("x", "y", "fx", "fy")}} for f in b[k:]]

    return {
        "n_ogs": len(applied), "n_oracle": len(oracle_forces or []),
        "pairs": pairs, "only_ogs": only_ogs, "only_oracle": only_oracle, "ogs_not_applied": not_applied,
        "max_dxy": max((max(abs(p["dx"]), abs(p["dy"])) for p in pairs), default=0.0),
        "max_dF": max((math.hypot(p["dfx"], p["dfy"]) for p in pairs), default=0.0),
        "max_radial_oracle": max((abs(p["radial_oracle"]) for p in pairs if "radial_oracle" in p), default=None),
        "unexplained": sum(1 for p in pairs if p["explanation"] == "sin explicar") + len(only_ogs) + len(only_oracle),
    }

