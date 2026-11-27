#!/usr/bin/env python3
"""Referencia del producto para los checks fijos de Hoek-Brown de la batería F3B (F6.8, E16q).

cSlope usa la tangente de σ3 = 0 para todo σ′n ≤ sn(0); el producto usa la envolvente completa. Donde hay dovelas en
bajo confinamiento la diferencia es conservadora y de hasta -3 % (tabla de F6.8). Este script calcula, con el
prototipo independiente de X28 (`docs/fase3/exploracion/X28_proto`, reglas `cut` y `cslope`, 1e-8, w = 0,5), el FS de
cada check fijo de Hoek-Brown: la regla `cut` es la referencia del producto (≤ 0,1 %) y `cslope` comprueba que el
prototipo reproduce al oráculo. Escribe `cases_f3b/prototype.json`.

Necesita un ogs que no tenga la física v0.6, por ejemplo el binario base v0.4.0, porque el prototipo solo usa su
geometría de dovelas con un material Mohr-Coulomb de reemplazo:

    OGS_BIN=$TMPDIR/f3b-base/ogs python3 verification/differential/f3b_prototype.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PROTO = ROOT / "docs" / "fase3" / "exploracion" / "X28_proto"
sys.path[:0] = [str(PROTO), str(HERE)]

TOL, W, MAX_PASS = 1e-8, 0.5, 200
OUT = HERE / "cases_f3b" / "prototype.json"


def rows() -> list[dict]:
    import build_f3b
    import hb
    import hbsolve
    import models
    import x28_run

    out = []
    for model in build_f3b.models():
        mat = model["materials"][0]
        surface = model["analysis"].get("surface")
        if mat["model"] != "hoek_brown" or not surface:
            continue
        doc = models.ogs_doc("SB", circle=[surface["xc"], surface["yc"], surface["r"]],
                             wt=(model.get("water") or {}).get("piezometric_line"),
                             hb={k: mat[k] for k in ("ucs", "gsi", "mi", "disturbance")},
                             poly=model["regions"][0]["polygon"], direction=model["slope"]["direction"],
                             unit_weight=mat["unit_weight"], methods=model["analysis"]["methods"])
        slices, params, gamma = x28_run.setup_doc(doc)
        solved = {rule: hbsolve.solve_all(slices, gamma, params, rule=rule, tol=TOL, max_pass=MAX_PASS, w=W,
                                          methods=model["analysis"]["methods"], keep_hist=False)
                  for rule in ("cut", "cslope")}
        for method in model["analysis"]["methods"]:
            row = {"id": model["meta"]["id"], "method": method, "kind": "fixed"}
            for rule, key in (("cut", "product"), ("cslope", "compat")):
                res = solved[rule][method]
                row[key] = res["F"] if res["status"] == "converged" else None
                row[key + "_status"] = res["status"]
            row["low_confinement_slices"] = sum(1 for s in solved["cut"][method]["slices"]
                                                if s.get("sn_last", 1e9) <= hb.sn_zero(params))
            out.append(row)
    return out


def main() -> int:
    if "OGS_BIN" not in os.environ:
        print("error: OGS_BIN debe apuntar a un ogs v0.4.0 (geometría de dovelas)", file=sys.stderr)
        return 1
    data = {"source": "X28_proto (reglas cut y cslope, tol 1e-8, w 0,5), F6.8 y E16q", "rows": rows()}
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(data['rows'])} filas en {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
