//! E16y: nonfinite SHANSEP is an InvalidModel, including during search.
use serde_json::{Value, json};

const ERROR: &str = "InvalidModel: la resistencia SHANSEP del material 'soil' no es finita (revise shansep.ocr, pop u ocr_by_elevation)";
fn fixture() -> Value {
    serde_json::from_str(include_str!("data/f3b/r15/sh/huge_ocr.json")).unwrap()
}
#[test]
fn huge_ocr_at_fixed_surface_is_invalid() {
    assert_eq!(
        ogs_core::analyze_json(&fixture().to_string()).unwrap_err(),
        ERROR
    );
}
#[test]
fn overflowing_pop_in_search_is_invalid() {
    let mut doc = fixture();
    doc["materials"][0]["shansep"] = json!({"ratio":10.0,"pop":1e308,"exponent":1.0});
    doc["analysis"]["search"] =
        json!({"type":"circular_entry_exit", "n_entry":3, "n_exit":3, "n_radius":3});
    assert_eq!(ogs_core::analyze_json(&doc.to_string()).unwrap_err(), ERROR);
}
#[test]
fn huge_pop_with_finite_strength_is_not_rejected() {
    let mut doc = fixture();
    doc["materials"][0]["shansep"] = json!({"ratio":0.25,"pop":1e308,"exponent":1.0});
    assert!(ogs_core::analyze_json(&doc.to_string()).is_ok());
}
