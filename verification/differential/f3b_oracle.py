#!/usr/bin/env python3
"""Cifras de cSlope 0.1.0 para la batería F3B: escribe `cases_f3b/oracle.json`.

Cada check del plan (`run.f3b_plan`) se convierte con `ogs_to_cslope` y se corre con `cslope.analyse` (vía `run_cslope`).
Un check que cSlope no resuelve (EngineError o `converged: false`) no es una cifra de referencia: va a
`no_solution` con su causa, como en el runner (`cslope_declares_no_solution`). No necesita ogs.

    $TMPDIR/oracle-venv/bin/python verification/differential/f3b_oracle.py
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE.parent / "harness"), str(HERE)]

import build_f3b  # noqa: E402
import cslope  # noqa: E402
from to_cslope import ogs_to_cslope  # noqa: E402

spec = importlib.util.spec_from_file_location("differential_run", HERE / "run.py")
run = importlib.util.module_from_spec(spec)
spec.loader.exec_module(run)


def main() -> int:
    cases = [{"id": m["meta"]["id"], "title": m["meta"]["title"], "model": m} for m in build_f3b.models()]
    rows, no_solution = [], []
    for case, method, kind in run.f3b_plan(cases):
        result = run.run_cslope(cslope, ogs_to_cslope(case["model"], {"method": method, "kind": kind}).document)
        key = {"id": case["id"], "method": method, "kind": kind}
        if run.cslope_declares_no_solution(result):
            no_solution.append({**key, "status": result["status"], "reason": run.cslope_no_solution_text(result)})
        else:
            rows.append({**key, "fos": result["fos"], "converged": True})
    data = {"source": f"cslope {cslope.__version__} mediante ogs_to_cslope", "fixed_max_rel": run.FIXED_MAX_REL,
            "search_max_rel": run.SEARCH_MAX_REL, "no_solution": no_solution, "rows": rows}
    (HERE / "cases_f3b" / "oracle.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(rows)} filas con FS, {len(no_solution)} sin solución")
    return 0


if __name__ == "__main__":
    sys.exit(main())
