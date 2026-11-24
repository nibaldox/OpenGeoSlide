//! WebAssembly entry points for ogs-core.

use wasm_bindgen::prelude::*;

/// JSON model in, JSON report out. Errors are returned as JS strings.
#[wasm_bindgen]
pub fn analyze_json(input: &str) -> Result<String, JsValue> {
    ogs_core::analyze_json(input).map_err(|e| JsValue::from_str(&e))
}

/// Engine version (`ogs-core` crate version).
#[wasm_bindgen]
pub fn version() -> String {
    ogs_core::VERSION.to_string()
}
