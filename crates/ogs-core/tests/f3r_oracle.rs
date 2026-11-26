//! Reinforcement oracle test (amendment E14l, F4.13): the values of `cslope` 0.1.0 on V047a with the fixed circle of
//! F3.8 (50 slices, `tolerance 1e-5`), within `0.1 %`.
//!
//! **State at the end of R0:** these tests are **RED on purpose**. A valid v0.4 document gets past the parser and the
//! validation and stops in the stub of the engine, `reinforcement::crossing_nodes`
//! (`not implemented: R1: fuerzas de refuerzo`). The wave R1 makes them pass without touching a value or a
//! tolerance. The coordinator adds the other rows of F4.13 (3, 5, 7, 9, 11 and the inclined ones) with the exact
//! inputs of X17.
//!
//! Rows (X14 §2.2): a horizontal anchor from (52, 28) to (25, 28), `T = 100`, `axial`, with no `pullout`.

mod f3_common;

use f3_common::*;
use serde_json::{Value, json};

/// `|Δ| ≤ 0.1 %` of the published value (F4.13).
const ORACLE_TOLERANCE: f64 = 1e-3;

fn assert_oracle(label: &str, got: f64, want: f64) {
    let rel = (got - want).abs() / want.abs();
    println!(
        "{label}: ogs {got:.10}, cslope {want:.10}, Δ {:.4} %",
        100.0 * rel
    );
    assert!(
        rel <= ORACLE_TOLERANCE,
        "{label}: ogs {got:.10} against cslope {want:.10}: Δ = {:.4} % (> 0.1 %)",
        100.0 * rel
    );
}

/// V047a, fixed circle, `version "0.4"`, one method and the horizontal anchor of rows 1 and 2.
fn anchor_doc(method: &str, interslice: bool, application: &str) -> Value {
    let mut doc = v047a(json!([method]));
    doc["version"] = json!("0.4");
    if interslice {
        doc["analysis"]["interslice"] = json!({"function": "constant"});
    }
    doc["reinforcements"] = json!([{
        "id": "ancla-1", "type": "anchor",
        "x1": 52.0, "y1": 28.0, "x2": 25.0, "y2": 28.0,
        "tensile_capacity": 100.0, "application": application, "direction": "axial"
    }]);
    doc
}

fn bishop(application: &str) -> f64 {
    fos(&anchor_doc("bishop", false, application), 0)
}

fn morgenstern_price_constant(application: &str) -> f64 {
    fos(&anchor_doc("morgenstern_price", true, application), 0)
}

fn janbu_corrected(application: &str) -> f64 {
    fos(&anchor_doc("janbu_corrected", false, application), 0)
}

// Row 1: active anchor.

#[test]
fn row1_active_anchor_bishop() {
    assert_oracle("row 1, bishop", bishop("active"), 1.333661);
}

#[test]
fn row1_active_anchor_morgenstern_price_constant() {
    assert_oracle(
        "row 1, M-P constant",
        morgenstern_price_constant("active"),
        1.329252,
    );
}

#[test]
fn row1_active_anchor_janbu_corrected() {
    assert_oracle(
        "row 1, janbu corrected",
        janbu_corrected("active"),
        1.319292,
    );
}

// Row 2: passive anchor.

#[test]
fn row2_passive_anchor_bishop() {
    assert_oracle("row 2, bishop", bishop("passive"), 1.248405);
}

#[test]
fn row2_passive_anchor_morgenstern_price_constant() {
    assert_oracle(
        "row 2, M-P constant",
        morgenstern_price_constant("passive"),
        1.245588,
    );
}

#[test]
fn row2_passive_anchor_janbu_corrected() {
    assert_oracle(
        "row 2, janbu corrected",
        janbu_corrected("passive"),
        1.252327,
    );
}
