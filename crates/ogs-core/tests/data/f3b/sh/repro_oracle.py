"""Reproduce los métodos adicionales de sismo y círculo profundo con cSlope 0.1.0.

Ejecutar desde la raíz con env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python
crates/ogs-core/tests/data/f3b/sh/repro_oracle.py. No modifica las filas originales.
"""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[6]
sys.path.insert(0, str(root / "docs/fase3/exploracion/X30_proto"))
import cslope  # noqa: E402
import x30_oracle as oracle  # noqa: E402

for case in ("X30-F-sismo-kh0.1", "X30-F-sismo-kv0.1", "X30-S-V047a-profundo"):
    row = json.loads((Path(__file__).parent / f"{case}.json").read_text())
    for method in ("spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"):
        result = cslope.analyse(oracle.oracle_doc(row["model"], method))
        assert result["criticalSurface"]["converged"] and not result.get("warnings")
        value = result["minFOS"]
        assert abs(value - row["oracle"][method]) < 1e-12
        print(case, method, value, "converged")
