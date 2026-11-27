//! E16ab: an overflowing reported OCR is invalid even when Su stays finite.
mod f3_common;
use serde_json::Value;

#[test]
fn pop_overflow_rejects_nonfinite_ocr() {
    let model: Value =
        serde_json::from_str(include_str!("data/f3b/r16/ocr_overflow.json")).unwrap();
    f3_common::expect_invalid(
        &model,
        &["la resistencia SHANSEP", "clay_pop", "no es finita"],
    );
}
