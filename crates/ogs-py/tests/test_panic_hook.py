"""Tests de pánicos: el hook `_panic_for_tests` solo existe en builds con la feature `test-hooks`.

Variable de entorno ``OGS_PY_TEST_HOOKS``:
- ``1``: el wheel se compiló con ``--features test-hooks``; el hook debe existir.
- ``0``: wheel de producción; el hook no debe existir.
- sin definir: se acepta cualquiera de las dos y los tests de pánico se omiten si no hay hook.
"""

import os

import pytest

import opengeoslide
from opengeoslide import _core

HAS_HOOK = hasattr(_core, "_panic_for_tests")
EXPECTED = os.environ.get("OGS_PY_TEST_HOOKS")

requires_test_hooks = pytest.mark.skipif(
    not HAS_HOOK,
    reason="requiere un wheel compilado con --features test-hooks",
)


def test_test_hooks_match_the_build_flavour():
    if EXPECTED == "1":
        assert HAS_HOOK, "OGS_PY_TEST_HOOKS=1 pero el wheel no tiene _panic_for_tests"
    elif EXPECTED == "0":
        assert not HAS_HOOK, "wheel de producción con _panic_for_tests expuesto"


@requires_test_hooks
def test_rust_panic_becomes_runtime_error_not_abort():
    # Goes through the same catch_unwind guard as analyze_json. PanicException (a BaseException)
    # would not match RuntimeError, so this also checks the conversion itself.
    with pytest.raises(RuntimeError, match="boom"):
        _core._panic_for_tests("boom")
    # The interpreter is still alive and usable after the panic.
    assert opengeoslide.version()


@requires_test_hooks
def test_panic_is_catchable_as_exception():
    # RuntimeError derives from Exception, so `except Exception` handles it.
    try:
        _core._panic_for_tests("otra vez")
    except Exception as exc:  # noqa: BLE001 - the point of the test
        assert isinstance(exc, RuntimeError)
        assert "otra vez" in str(exc)
    else:
        pytest.fail("el pánico no lanzó excepción")
