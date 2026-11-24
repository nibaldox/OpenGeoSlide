"""Smoke tests for the `opengeoslide` Python package.

Run against the installed wheel (not the source tree), e.g.:
    $TMPDIR/ogs-py-venv/bin/python -m pytest tests -v
"""

import copy
import json
import tomllib
from pathlib import Path

import pytest

import opengeoslide
from opengeoslide import _core

REPO_ROOT = Path(__file__).resolve().parents[3]
CORE_CARGO_TOML = REPO_ROOT / "crates" / "ogs-core" / "Cargo.toml"
WORKSPACE_CARGO_TOML = REPO_ROOT / "Cargo.toml"
ACADS1A = REPO_ROOT / "examples" / "acads1a.ogs.json"


def load_acads1a() -> dict:
    return json.loads(ACADS1A.read_text(encoding="utf-8"))


def test_version_matches_ogs_core_cargo_toml():
    with CORE_CARGO_TOML.open("rb") as f:
        declared = tomllib.load(f)["package"]["version"]
    if isinstance(declared, dict):  # `version.workspace = true`: resolve from the root manifest
        with WORKSPACE_CARGO_TOML.open("rb") as f:
            declared = tomllib.load(f)["workspace"]["package"]["version"]
    assert opengeoslide.version() == declared


def test_invalid_json_raises_value_error():
    with pytest.raises(ValueError):
        opengeoslide.analyze_json("{ esto no es JSON")


def test_model_without_surface_raises_value_error_mentioning_surface():
    model = load_acads1a()
    del model["analysis"]["search"]  # acads1a has no fixed surface either: NoSurface
    with pytest.raises(ValueError, match="surface"):
        opengeoslide.analyze_json(json.dumps(model))


def test_analyze_dict_without_surface_raises_value_error():
    model = copy.deepcopy(load_acads1a())
    del model["analysis"]["search"]
    with pytest.raises(ValueError, match="surface"):
        opengeoslide.analyze(model)


@pytest.mark.xfail(strict=False, reason="motor en stubs hasta W1")
def test_acads1a_bishop_fos_in_expected_range():
    report = opengeoslide.analyze(load_acads1a())
    bishop = [r for r in report["results"] if r["method"] == "bishop"]
    assert len(bishop) == 1
    assert 0.95 <= bishop[0]["fos"] <= 1.03


def test_rust_panic_becomes_runtime_error_not_abort():
    # Goes through the same catch_unwind guard as analyze_json. PanicException (a BaseException)
    # would not match RuntimeError, so this also checks the conversion itself.
    with pytest.raises(RuntimeError, match="boom"):
        _core._panic_for_tests("boom")
    # The interpreter is still alive and usable after the panic.
    assert opengeoslide.version()
