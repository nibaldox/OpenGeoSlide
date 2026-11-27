#!/usr/bin/env python3
"""Row of R12 (E15l-12, M-B) of the Ito-Matsui pile: `ru` and a piezometric line in the same model.

Needs the oracle venv (cslope, shapely). From the repository root:

  env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python crates/ogs-core/tests/data/f3g3/generate_r12.py

Writes `rows/X22-S16-ru-piezo.json` and `expected_r12.json` (same layout as `expected.json`: the oracle FS of the five
methods and the force per metre of the crossing). The oracle goes through `verification/harness/to_cslope.py`, which
maps a material with `ru` to a dry water line of cSlope (OpenGeoSlide: `ru` replaces the piezometric pressure).
"""
import copy
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[5]
OUT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "docs/fase3/exploracion/X22_proto"))
os.environ["OGS_HARNESS"] = str(ROOT / "verification/harness")
import oracle  # noqa: E402

METHODS = ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]


def s16():
    doc = json.loads((OUT / "rows/X22-S14-ru.json").read_text())
    doc["meta"] = {
        "id": "X22-S16-ru-piezo",
        "title": "X22-S16-ru-piezo",
        "notes": "ru = 0,2 y línea piezométrica en el mismo modelo (c = 10, φ = 20, γ = 20): "
        "σ'v = σv − ru·σ_suelo, sin restar la u de la piezométrica (E15l-12)",
    }
    doc["materials"][0]["ru"] = 0.2
    doc["water"] = {"unit_weight": 9.807, "piezometric_line": [[0.0, 0.0], [10.0, 0.0], [25.0, 7.0], [35.0, 7.0]]}
    return doc


def main():
    doc = s16()
    rid = doc["meta"]["id"]
    (OUT / "rows" / f"{rid}.json").write_text(json.dumps(doc, indent=1) + "\n")
    res = oracle.run_all(copy.deepcopy(doc))
    entry = {"note": doc["meta"]["notes"], "oracle": {m: res[m]["fos"] for m in METHODS}}
    f = res["bishop"]["forces"][0]
    # the force of the oracle at the crossing is per metre of the slope (cSlope divides by the spacing)
    entry["force_per_metre"] = {"estado": "applied", "oracle": f["force"], "gobierna": "soil"}
    out = {
        "source": "cSlope 0.1.0 through verification/harness/to_cslope.py (fixed circle, 50 slices), generate_r12.py",
        "tolerance_pct": 0.1,
        "rows": {rid: entry},
    }
    (OUT / "expected_r12.json").write_text(json.dumps(out, indent=1) + "\n")
    print(json.dumps(out, indent=1))
    print(json.dumps(res["bishop"]["forces"]))


if __name__ == "__main__":
    main()
