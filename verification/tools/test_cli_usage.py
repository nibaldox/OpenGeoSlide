"""El mensaje de uso de `ogs` (R10B-10): lista los cinco métodos que `ogs bench` acepta, no solo Bishop y Spencer.

    OGS_BIN=target/release/ogs env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with pytest \\
        python -m pytest -q verification/tools/test_cli_usage.py
"""

from __future__ import annotations

import os
import shutil
import subprocess

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OGS_BIN = os.environ.get("OGS_BIN", os.path.join(ROOT, "target", "release", "ogs"))
METHODS = ("bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected")


def _ogs() -> str:
    exe = OGS_BIN if os.path.isfile(OGS_BIN) else shutil.which(OGS_BIN)
    if not exe:
        pytest.fail(f"binario ogs no encontrado: {OGS_BIN} (definir OGS_BIN)")
    return exe


def test_usage_lists_the_five_methods_of_bench_and_exits_with_2():
    proc = subprocess.run([_ogs()], capture_output=True, text=True, timeout=30)
    assert proc.returncode == 2
    assert proc.stderr.startswith("uso: ogs ")
    for method in METHODS:
        assert method in proc.stderr, f"falta {method} en el uso: {proc.stderr!r}"
    assert "all" in proc.stderr


def test_usage_of_ogs_matches_the_one_of_bench():
    root = subprocess.run([_ogs()], capture_output=True, text=True, timeout=30).stderr
    bench = subprocess.run([_ogs(), "bench"], capture_output=True, text=True, timeout=30).stderr
    for method in METHODS:
        assert (method in root) == (method in bench), method
