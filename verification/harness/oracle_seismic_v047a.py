#!/usr/bin/env python3
"""Reference values of cSlope 0.1.0 for pseudo-static seismic force and surface loads (amendment E12b, criterion iii).

Runs the oracle on the fixed circle of V047a (the Bishop critical circle of X1 §2.2, with exact floats) for a list of
scenarios, and writes `crates/ogs-core/tests/fixtures/oracle_seismic_v047a.json`, which `tests/loads_seismic.rs` reads.
Bishop is compared with Bishop, and Spencer with Morgenstern-Price with a `constant` interslice function.

The model is `verification/cases/V047a.json` with the circle fixed and `slope.direction = right_to_left` (the mass
moves toward -x). The cSlope document comes from `ogs_to_cslope` of the model without loads, and this script adds the
seismic options, `definition.udls` and `definition.lineLoads` by hand (the mapping in `to_cslope.py` belongs to A2):

- `options.seismicHorizontal` / `options.seismicVertical`: kh in the sliding direction and kv downward.
- `definition.udls[]`: `{magnitude, x1, x2, direction: "vertical"}`.
- `definition.lineLoads[]`: `{x, magnitude, angle}`, angle from the downward vertical.

Besides the `rtl` scenarios, the file holds the mirror image of some of them (`ltr`: x -> -x, the line-load angle with
the opposite sign, the circle centre mirrored). cSlope solves them on its own; the file records what it returns so the
test can compare it with ogs, and so A2 can read the angle convention for `ltr`.

Run from the root of the worktree (the shell must not export a PYTHONPATH of another interpreter):

    env -u PYTHONPATH uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \\
        python verification/harness/oracle_seismic_v047a.py
"""

from __future__ import annotations

import copy
import json
import os
import sys

import cslope

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from to_cslope import ogs_to_cslope  # noqa: E402

CASE = os.path.join(ROOT, "verification", "cases", "V047a.json")
OUT = os.path.join(ROOT, "crates", "ogs-core", "tests", "fixtures", "oracle_seismic_v047a.json")

# Fixed circle: critical Bishop circle of V047a (X1 §2.2), exact floats.
CIRCLE = {"xc": 29.54334963719809, "yc": 53.63784815923435, "r": 28.641487934160704}
SLICES = 50
TOLERANCE = 1e-8
MAX_ITERATIONS = 2000

UDL = {"id": "u1", "x1": 50.0, "x2": 70.0, "q": 20.0}


def line(x: float, angle: float, p: float = 20.0, ident: str = "l1") -> dict:
    return {"id": ident, "x": x, "p": p, "angle": angle}


# Ends of the analysed block on the fixed circle (R5-01, E12f): the circle meets the ground at the toe `X_TOE` and at the
# entry point `X_ENTRY`, exact floats of the ogs report. A line load there acts on the end slice (closed interval).
X_TOE = 30.00000164700758
X_ENTRY = 51.29111842105263
UDL2 = {"id": "u1", "x1": 40.0, "x2": 52.0, "q": 15.0}


def mirrored(scenario: tuple) -> tuple:
    """The `ltr` image of an `rtl` scenario: x -> -x, the angle of the line loads with the opposite sign."""
    sid, _, kh, kv, udls, lines = scenario
    return (
        f"ltr_{sid}",
        "ltr",
        kh,
        kv,
        [{**u, "x1": -u["x2"], "x2": -u["x1"]} for u in udls],
        [{**l, "x": -l["x"], "angle": -l["angle"]} for l in lines],
    )


# Line loads of 100 kN/m on the edges of the block and on a terrain vertex / slice boundary (E12f, R5-01).
EDGE_SCENARIOS: list[tuple] = [
    ("line_entry_10", "rtl", 0.0, 0.0, [], [line(X_ENTRY, 10.0, 100.0)]),
    ("line_entry_-10", "rtl", 0.0, 0.0, [], [line(X_ENTRY, -10.0, 100.0)]),
    ("line_toe_10", "rtl", 0.0, 0.0, [], [line(X_TOE, 10.0, 100.0)]),
    ("line_toe_-10", "rtl", 0.0, 0.0, [], [line(X_TOE, -10.0, 100.0)]),
    ("line_crown_15", "rtl", 0.0, 0.0, [], [line(50.0, 15.0, 100.0)]),
    ("line_udl_edge_10", "rtl", 0.0, 0.0, [UDL2], [line(40.0, 10.0, 100.0)]),
]

# (id, direction, kh, kv, udls, lines). Direction `rtl`: the mass moves toward -x (the model of V047a).
SCENARIOS: list[tuple[str, str, float, float, list[dict], list[dict]]] = [
    ("control", "rtl", 0.0, 0.0, [], []),
    ("kh0.05", "rtl", 0.05, 0.0, [], []),
    ("kh0.1", "rtl", 0.1, 0.0, [], []),
    ("kh0.2", "rtl", 0.2, 0.0, [], []),
    ("kv+0.1", "rtl", 0.0, 0.1, [], []),
    ("kv-0.1", "rtl", 0.0, -0.1, [], []),
    ("udl20", "rtl", 0.0, 0.0, [UDL], []),
    ("line40_0", "rtl", 0.0, 0.0, [], [line(40.0, 0.0)]),
    ("line40_10", "rtl", 0.0, 0.0, [], [line(40.0, 10.0)]),
    ("line40_-10", "rtl", 0.0, 0.0, [], [line(40.0, -10.0)]),
    ("kh0.2_udl20", "rtl", 0.2, 0.0, [UDL], []),
    ("kh0.1_kv0.05_line40_10", "rtl", 0.1, 0.05, [], [line(40.0, 10.0)]),
    # A line load outside the mass (x = 60 is not above the circle): no effect, and ogs notes it.
    ("line60_outside", "rtl", 0.0, 0.0, [], [line(60.0, 0.0)]),
    # Mirror images (ltr): x -> -x, angle with the opposite sign.
    ("ltr_control", "ltr", 0.0, 0.0, [], []),
    ("ltr_kh0.1", "ltr", 0.1, 0.0, [], []),
    ("ltr_udl20", "ltr", 0.0, 0.0, [{"id": "u1", "x1": -70.0, "x2": -50.0, "q": 20.0}], []),
    ("ltr_line40_10", "ltr", 0.0, 0.0, [], [line(-40.0, -10.0)]),
    ("ltr_line40_-10", "ltr", 0.0, 0.0, [], [line(-40.0, 10.0)]),
    *EDGE_SCENARIOS,
    *[mirrored(sc) for sc in EDGE_SCENARIOS],
]


def base_model(direction: str) -> dict:
    """V047a with the fixed circle, no search, both methods; mirrored for `ltr`."""
    with open(CASE, encoding="utf-8") as fh:
        model = copy.deepcopy(json.load(fh)["model"])
    analysis = model["analysis"]
    analysis.pop("search", None)
    analysis["methods"] = ["bishop", "spencer"]
    analysis["slices"] = SLICES
    analysis["tolerance"] = TOLERANCE
    analysis["max_iterations"] = MAX_ITERATIONS
    circle = dict(CIRCLE)
    if direction == "ltr":
        for region in model["regions"]:
            region["polygon"] = [[-x, y] for x, y in region["polygon"]]
        circle["xc"] = -circle["xc"]
    analysis["surface"] = {"type": "circle", **circle}
    model["slope"] = {"direction": "right_to_left" if direction == "rtl" else "left_to_right"}
    return model


def run_scenario(sid: str, direction: str, kh: float, kv: float, udls: list, lines: list) -> dict:
    model = base_model(direction)
    out: dict = {"id": sid, "direction": direction, "kh": kh, "kv": kv, "udls": udls, "lines": lines}
    for method in ("bishop", "spencer"):
        conversion = ogs_to_cslope(model, {"method": method, "kind": "fixed", "options": {"slices": SLICES}})
        doc = conversion.document
        definition, options = doc["definition"], doc["options"]
        if kh:
            options["seismicHorizontal"] = kh
        if kv:
            options["seismicVertical"] = kv
        if udls:
            definition["udls"] = [
                {"magnitude": u["q"], "x1": u["x1"], "x2": u["x2"], "direction": "vertical"}
                for u in udls
            ]
        if lines:
            definition["lineLoads"] = [
                {"x": l["x"], "magnitude": l["p"], "angle": l["angle"]} for l in lines
            ]
        errors = [m for m in cslope.validate(doc) if m.get("severity") == "error"]
        if errors:
            raise RuntimeError(f"{sid}/{method}: cSlope rejects the document: {errors}")
        result = cslope.analyse(doc)
        fos = result.get("minFOS")
        if not isinstance(fos, float) or not fos > 0:
            raise RuntimeError(f"{sid}/{method}: no factor of safety in the result: {fos!r}")
        out[method] = fos
        out[f"{method}_warnings"] = [str(w) for w in (result.get("warnings") or [])]
    return out


def main() -> None:
    scenarios = [run_scenario(*s) for s in SCENARIOS]
    document = {
        "oracle": f"cslope {cslope.__version__}",
        "case": "V047a",
        "circle": CIRCLE,
        "slices": SLICES,
        "tolerance": TOLERANCE,
        "spencer_oracle": "Morgenstern-Price, interslice function constant",
        "generator": "verification/harness/oracle_seismic_v047a.py",
        "scenarios": scenarios,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(document, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    for s in scenarios:
        print(f"{s['id']:<28} bishop={s['bishop']:.9f} spencer={s['spencer']:.9f}")
    print("wrote", os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
