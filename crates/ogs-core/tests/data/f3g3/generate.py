#!/usr/bin/env python3
"""Regenerates `rows/*.json` and `expected.json` from `docs/fase3/exploracion/X22_filas/` (F3G-G3, M-ito).

Run from the repository root:  env -u PYTHONPATH -u PYTHONHOME python3 crates/ogs-core/tests/data/f3g3/generate.py

Migration of the 28 rows of X22 to the final format of E15i-1 (briefs/04, F5.10):
  * `version` becomes `"0.5"` (`lateral_pressure` and `capacity` need it);
  * the piles keep `lateral_pressure = {model, diameter, location}` (`location` is mandatory) and `capacity`;
  * G01-G03 keep their `force` (they validate the passive and active terms with a given force);
  * nothing else changes. The oracle figures (cSlope 0.1.0, fixed circle, 50 slices) are those of
    `X22_filas/resultados.json`; `expected.json` also keeps the oracle force per metre of the crossing and the
    `governs` that X22 saw.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[5]
SRC = ROOT / "docs/fase3/exploracion/X22_filas"
OUT = pathlib.Path(__file__).resolve().parent
ROWS = OUT / "rows"
METHODS = ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]


def main():
    res = json.loads((SRC / "resultados.json").read_text())
    ROWS.mkdir(exist_ok=True)
    expected = {
        "source": "docs/fase3/exploracion/X22_filas/resultados.json (cSlope 0.1.0, fixed circle, 50 slices)",
        "tolerance_pct": 0.1,
        "rows": {},
    }
    for rid, row in sorted(res["filas"].items()):
        doc = json.loads((SRC / f"{rid}.json").read_text())
        doc["version"] = "0.5"
        (ROWS / f"{rid}.json").write_text(json.dumps(doc, indent=1) + "\n")
        entry = {
            "note": row["nota"],
            "oracle": {m: row["metodos"][m]["oracle"] for m in METHODS},
        }
        f = row.get("fuerza_por_metro")
        if f:
            entry["force_per_metre"] = {k: f[k] for k in ("estado", "oracle", "gobierna") if k in f}
        expected["rows"][rid] = entry
    (OUT / "expected.json").write_text(json.dumps(expected, indent=1) + "\n")
    print(len(expected["rows"]), "rows")


if __name__ == "__main__":
    main()
