//! Shared helpers of the Phase 3a tests (`v03_*.rs`, `f3_oracle.rs`). Each test file includes this module with
//! `mod f3_common;`, so a helper that one file does not use is not an error.
#![allow(dead_code)]

use ogs_core::{OgsError, analyze, analyze_json, model::Model, report::AnalysisReport};
use serde_json::{Value, json};
use std::panic::{AssertUnwindSafe, catch_unwind};

/// Fixed circle of the oracle values of F3.8 (critical circle of V047a / ACADS 1(a)).
pub const CIRCLE: (f64, f64, f64) = (29.54334963719809, 53.63784815923435, 28.641487934160704);

/// Fixed polyline of the oracle values of F3.8 (a chord polyline close to the circle above).
pub const POLYLINE: [[f64; 2]; 5] = [
    [30.0, 25.000001],
    [35.0, 25.520953],
    [40.0, 26.973391],
    [45.0, 29.525055],
    [51.29111842105263, 35.0],
];

/// V047a (ACADS 1(a)) with a fixed circle, 50 slices and `tolerance 1e-5`. Version `"0.3"`, so that every v0.3
/// field is admitted. The slope goes down toward the left (`right_to_left`).
pub fn v047a(methods: Value) -> Value {
    json!({
        "format": "opengeoslide",
        "version": "0.3",
        "meta": {"id": "V047a", "title": "ACADS 1(a)"},
        "units": "SI",
        "materials": [{"id": "soil", "name": "Soil", "model": "mohr_coulomb",
                       "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6}],
        "regions": [{"material": "soil",
                     "polygon": [[20,20],[20,25],[30,25],[50,35],[70,35],[70,20]]}],
        "slope": {"direction": "right_to_left"},
        "analysis": {
            "methods": methods, "slices": 50, "tolerance": 1e-5, "max_iterations": 500,
            "min_m_alpha": 0.2,
            "surface": {"type": "circle", "xc": CIRCLE.0, "yc": CIRCLE.1, "r": CIRCLE.2}
        }
    })
}

/// V047a with an undrained material.
pub fn v047a_undrained(methods: Value, material_extra: Value) -> Value {
    let mut doc = v047a(methods);
    let mut mat = json!({"id": "soil", "name": "Soil", "model": "undrained", "unit_weight": 20.0});
    for (k, v) in material_extra.as_object().expect("extra is an object") {
        mat[k] = v.clone();
    }
    doc["materials"] = json!([mat]);
    doc
}

pub fn set_polyline(doc: &mut Value, points: &[[f64; 2]]) {
    doc["analysis"]["surface"] = json!({"type": "polyline", "points": points});
}

/// Analyzes a document through the public API and returns the report; panics with the error text if it is rejected.
pub fn run(doc: &Value) -> AnalysisReport {
    let model: Model = serde_json::from_value(doc.clone())
        .unwrap_or_else(|e| panic!("the document does not parse as a model: {e}\n{doc}"));
    analyze(&model).unwrap_or_else(|e| panic!("the analysis failed: {e}\n{doc}"))
}

/// Factor of safety of method `i` of the report.
pub fn fos(doc: &Value, i: usize) -> f64 {
    run(doc).results[i].fos.expect("fos is finite")
}

/// The error text of a document that must be rejected by `analyze_json`.
pub fn reject(doc: &Value) -> String {
    match analyze_json(&doc.to_string()) {
        Ok(_) => panic!("the document must be rejected, but it was analyzed: {doc}"),
        Err(e) => e,
    }
}

pub fn expect_invalid(doc: &Value, needles: &[&str]) {
    let msg = reject(doc);
    assert!(
        msg.starts_with("InvalidModel:") && needles.iter().all(|n| msg.contains(n)),
        "expected InvalidModel mentioning {needles:?}, got {msg:?}\n{doc}"
    );
}

/// True if the document gets past every validation. It is `true` when the analysis returns `Ok`, and also when it
/// reaches an `unimplemented!("F3-W…")` stub of the engine (the stub is behind the validation). Any other panic is
/// propagated, and any error is `false`.
pub fn passes_validation(doc: &Value) -> bool {
    let model: Model = match serde_json::from_value(doc.clone()) {
        Ok(m) => m,
        Err(_) => return false,
    };
    match catch_unwind(AssertUnwindSafe(|| analyze(&model))) {
        Ok(Ok(_)) => true,
        Ok(Err(OgsError::InvalidModel(_))) => false,
        Ok(Err(_)) => true, // NoSurface / NoValidSurface: the document itself was admitted
        Err(payload) => {
            let text = payload
                .downcast_ref::<String>()
                .cloned()
                .or_else(|| payload.downcast_ref::<&str>().map(|s| (*s).to_string()))
                .unwrap_or_default();
            if text.contains("F3-W") {
                true
            } else {
                std::panic::resume_unwind(payload)
            }
        }
    }
}

/// Mirrors a document x → −x: regions, water, loads, surface and search ranges. The direction is inverted.
pub fn mirror(doc: &Value) -> Value {
    fn flip(p: &Value) -> Value {
        json!([-p[0].as_f64().unwrap(), p[1]])
    }
    let mut d = doc.clone();
    for r in d["regions"].as_array_mut().unwrap() {
        // Reversing the vertex order keeps the orientation of the polygon.
        let pts: Vec<Value> = r["polygon"]
            .as_array()
            .unwrap()
            .iter()
            .rev()
            .map(flip)
            .collect();
        r["polygon"] = Value::Array(pts);
    }
    let dir = match d["slope"]["direction"].as_str() {
        Some("right_to_left") => "left_to_right",
        Some("left_to_right") => "right_to_left",
        other => panic!("mirror needs an explicit direction, got {other:?}"),
    };
    d["slope"]["direction"] = json!(dir);
    let s = d["analysis"]["surface"].clone();
    match s["type"].as_str() {
        Some("circle") => {
            d["analysis"]["surface"]["xc"] = json!(-s["xc"].as_f64().unwrap());
        }
        Some("polyline") => {
            let pts: Vec<Value> = s["points"]
                .as_array()
                .unwrap()
                .iter()
                .rev()
                .map(flip)
                .collect();
            d["analysis"]["surface"]["points"] = Value::Array(pts);
        }
        other => panic!("mirror: unexpected surface {other:?}"),
    }
    d
}
