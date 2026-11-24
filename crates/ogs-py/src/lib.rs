//! Python bindings for OpenGeoSlide (`import opengeoslide`), built with PyO3 and maturin.
//!
//! Panics raised inside `ogs-core` are caught at the FFI boundary with `std::panic::catch_unwind`
//! and re-raised as Python `RuntimeError`, so they never abort the interpreter.
//! PyO3's own `PanicException` is deliberately not used: it derives from `BaseException`, so
//! `except Exception` and `pytest.raises(RuntimeError)` would not catch it.

use std::any::Any;
use std::panic::{AssertUnwindSafe, catch_unwind};

use pyo3::exceptions::{PyRuntimeError, PyValueError};
use pyo3::prelude::*;

/// Runs `f` and turns a panic into an error message.
fn guard<T>(f: impl FnOnce() -> T) -> Result<T, String> {
    catch_unwind(AssertUnwindSafe(f)).map_err(panic_message)
}

/// Extracts the human-readable message from a panic payload.
fn panic_message(payload: Box<dyn Any + Send>) -> String {
    let text = if let Some(s) = payload.downcast_ref::<&str>() {
        (*s).to_string()
    } else if let Some(s) = payload.downcast_ref::<String>() {
        s.clone()
    } else {
        "unknown panic payload".to_string()
    };
    format!("Rust panic: {text}")
}

/// Crate version of `ogs-core`, as declared in `crates/ogs-core/Cargo.toml`.
#[pyfunction]
fn version() -> &'static str {
    ogs_core::VERSION
}

/// Analyzes a `.ogs.json` model (JSON string in, JSON report out).
///
/// Raises `ValueError` when the engine rejects the model and `RuntimeError` when it panics.
#[pyfunction]
fn analyze_json(py: Python<'_>, model_json: &str) -> PyResult<String> {
    // Release the GIL while the engine runs; the closure only captures `&str`.
    let outcome = py.detach(|| guard(|| ogs_core::analyze_json(model_json)));
    match outcome {
        Ok(Ok(report)) => Ok(report),
        Ok(Err(message)) => Err(PyValueError::new_err(message)),
        Err(message) => Err(PyRuntimeError::new_err(message)),
    }
}

/// Test hook: panics with `message` through the same `guard` used by `analyze_json`.
///
/// Private (underscore) and not re-exported by the package; it exists so the panic path
/// can be tested deterministically regardless of the engine's state.
#[pyfunction]
fn _panic_for_tests(message: String) -> PyResult<()> {
    let outcome: Result<(), String> = guard(|| -> () { panic!("{message}") });
    outcome.map_err(PyRuntimeError::new_err)
}

#[pymodule]
fn _core(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(version, m)?)?;
    m.add_function(wrap_pyfunction!(analyze_json, m)?)?;
    m.add_function(wrap_pyfunction!(_panic_for_tests, m)?)?;
    Ok(())
}
