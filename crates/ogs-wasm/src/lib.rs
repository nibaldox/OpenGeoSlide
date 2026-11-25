//! WebAssembly entry points for ogs-core.

use std::sync::Once;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console, js_name = error)]
    fn console_error(message: &str);
}

static PANIC_HOOK: Once = Once::new();

/// Installs a panic hook once. On `wasm32-unknown-unknown` a panic aborts, so the JS side only sees
/// an opaque `WebAssembly.RuntimeError`; the hook keeps the message and location in the console
/// (emitted before the trap). The instance must still be treated as unusable after a panic.
fn ensure_panic_hook() {
    PANIC_HOOK.call_once(|| {
        std::panic::set_hook(Box::new(|info| {
            console_error(&format!("ogs-wasm: pánico en el motor: {info}"));
        }));
    });
}

/// JSON model in, JSON report out. Errors are returned as JS strings (`Display` of `OgsError`, E6).
#[wasm_bindgen]
pub fn analyze_json(input: &str) -> Result<String, JsValue> {
    ensure_panic_hook();
    ogs_core::analyze_json(input).map_err(|e| JsValue::from_str(&e))
}

/// Engine version (`ogs-core` crate version).
#[wasm_bindgen]
pub fn version() -> String {
    ensure_panic_hook();
    ogs_core::VERSION.to_string()
}

/// Test hook, compiled only with the `test-hooks` feature (never in release bundles):
/// panics with `message` so the panic path can be exercised from JS.
#[cfg(feature = "test-hooks")]
#[wasm_bindgen(js_name = panicForTests)]
pub fn panic_for_tests(message: &str) {
    ensure_panic_hook();
    panic!("{message}");
}
