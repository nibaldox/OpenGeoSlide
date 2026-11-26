#!/usr/bin/env python3
"""Regenerates `rows/*.json` and `expected.json` from `docs/fase3/exploracion/X21_filas/` (F3G-G0).

Run from the repository root:  env -u PYTHONPATH -u PYTHONHOME python3 crates/ogs-core/tests/data/f3g/generate.py

Migration of the rows to the final format (briefs/04, F5.5-3):
  * `water.free_water` is removed (the ponded water has no field);
  * `analysis.tension_crack.water` is renamed `water_fill`;
  * X21-N03 has `depth: 0`, which F5.2 rejects (`depth > 0`): it becomes `depth: 1e-6` (the limit `depth -> 0+` of F5.5-5),
    and the expected values stay those of the oracle for depth 0, i.e. the dry slope.
The documents keep `version: "0.5"`. Nothing else changes (the 5 methods and the interslice function are set by the test).
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[5]
SRC = ROOT / "docs/fase3/exploracion/X21_filas"
OUT = pathlib.Path(__file__).resolve().parent
ROWS = OUT / "rows"
METHODS = ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]
MIRRORS = {"X21-P03": "X21-P01", "X21-D03": "X21-D01", "X21-D04": "X21-D02", "X21-W100m": "X21-W100"}


def descriptions():
    out = {}
    for line in (ROOT / "docs/fase3/exploracion/X21.md").read_text().splitlines():
        m = re.match(r"\| (X21-[\w-]+) \| (.+?) \|", line)
        if m and m.group(1) not in out:
            out[m.group(1)] = m.group(2)
    return out


def top(poly, x):
    ys = []
    for i, (a, b) in enumerate(zip(poly, poly[1:] + poly[:1])):
        (x1, y1), (x2, y2) = a, b
        if x1 == x2:
            if x == x1:
                ys += [y1, y2]
        elif min(x1, x2) <= x <= max(x1, x2):
            ys.append(y1 + (y2 - y1) * (x - x1) / (x2 - x1))
    return max(ys) if ys else None


def piezo(line, x):
    if x <= line[0][0]:
        return line[0][1]
    if x >= line[-1][0]:
        return line[-1][1]
    for a, b in zip(line, line[1:]):
        if a[0] <= x <= b[0]:
            return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])


def has_pond(doc):
    """True if the piezometric line passes over the ground somewhere (the model has ponded water)."""
    w = doc.get("water") or {}
    line = w.get("piezometric_line")
    if not line:
        return False
    xs = [p[0] for r in doc["regions"] for p in r["polygon"]]
    lo, hi = min(xs), max(xs)
    for i in range(4001):
        x = lo + (hi - lo) * i / 4000
        tops = [t for t in (top(r["polygon"], x) for r in doc["regions"]) if t is not None]
        if tops and piezo(line, x) > max(tops) + 1e-9:
            return True
    return False


def main():
    ROWS.mkdir(exist_ok=True)
    res = json.loads((SRC / "resultados.json").read_text())
    desc = descriptions()
    rows = {}
    for f in sorted(SRC.glob("X21-*.json")):
        rid = f.stem
        doc = json.loads(f.read_text())
        assert doc["version"] == "0.5", rid
        migration = []
        if "free_water" in (doc.get("water") or {}):
            del doc["water"]["free_water"]
            migration.append("free_water removed")
        tc = doc["analysis"].get("tension_crack")
        if tc is not None:
            assert set(tc) == {"depth", "water"}, (rid, tc)
            doc["analysis"]["tension_crack"] = {"depth": tc["depth"], "water_fill": tc["water"]}
            migration.append("tension_crack.water renamed water_fill")
            if tc["depth"] == 0:
                doc["analysis"]["tension_crack"]["depth"] = 1e-6
                migration.append("depth 0 -> 1e-6 (F5.2 requires depth > 0)")
        (ROWS / f.name).write_text(json.dumps(doc, indent=1) + "\n")
        r = res[rid]
        oracle = {m: v["fos"] for m, v in r["oraculo"].items() if v["fos"] is not None}
        crack = tc is not None
        pond = has_pond(doc)
        kind = "state" if rid == "X21-A07" else "crack" if crack else "pond" if pond else "control"
        info = r.get("info") or {}
        row = {
            "kind": kind,
            "description": desc.get(rid, ""),
            "oracle": oracle,
            "oracle_proto_max_dif_pct": max(
                (abs(v["dif_pct"]) for v in r["oraculo"].values() if v["dif_pct"] is not None), default=None
            ),
            "migration": migration,
        }
        if rid == "X21-A07":
            row["expect_error"] = "tension_crack_not_reached"
        if rid in MIRRORS:
            row["mirror_of"] = MIRRORS[rid]
        if crack and "crack_x" in info:
            row["proto_crack"] = {"x": info["crack_x"], "depth": info["crack_depth"]}
        rows[rid] = row
    expected = {
        "source": "docs/fase3/exploracion/X21_filas/resultados.json (oracle cSlope 0.1.0, key `oraculo`)",
        "tolerance_pct": 0.1,
        "methods": METHODS,
        "rows": rows,
    }
    (OUT / "expected.json").write_text(json.dumps(expected, indent=1) + "\n")
    kinds = {}
    for r in rows.values():
        kinds[r["kind"]] = kinds.get(r["kind"], 0) + 1
    print(len(rows), "rows", kinds)


if __name__ == "__main__":
    main()
