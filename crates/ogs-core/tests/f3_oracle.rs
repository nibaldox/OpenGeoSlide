//! Phase 3a oracle test (amendment E13h, F3.8): the values of `cslope` 0.1.0 on V047a, with 50 slices and
//! `tolerance 1e-5`, reproduced by the coordinator, and the criteria of the contract that can be tested from the
//! public API.
//!
//! **State at the end of wave 0:**
//! - the undrained values, the Mohr-Coulomb identity and the mirror of the undrained material **pass**;
//! - everything that needs `morgenstern_price`, `janbu_*` or a polyline **fails on purpose** in the stub of the
//!   engine (`not implemented: F3-W1a` / `F3-W1b`), after parsing and validating the document. The waves that
//!   implement them make these tests pass without touching a value or a tolerance.
//!
//! Tolerance of the oracle values: `|Δ| ≤ 0.1 %` on a fixed surface (F3.8).

mod f3_common;

use f3_common::*;
use serde_json::{Value, json};
use std::fs;
use std::path::PathBuf;

/// `|Δ| ≤ 0.1 %` of the published value (F3.8).
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

fn interslice(doc: &mut Value, spec: Value) {
    doc["analysis"]["interslice"] = spec;
}

fn circle_doc(method: &str) -> Value {
    v047a(json!([method]))
}

fn polyline_doc(method: &str) -> Value {
    let mut doc = v047a(json!([method]));
    set_polyline(&mut doc, &POLYLINE);
    doc
}

// ---------------------------------------------------------------------------------------------------------------
// Oracle: undrained material (passes in wave 0)

#[test]
fn oracle_circle_undrained_su25_bishop() {
    let doc = v047a_undrained(json!(["bishop"]), json!({"undrained_strength": 25.0}));
    assert_oracle("V047a undrained Su 25, bishop", fos(&doc, 0), 1.5697595025);
}

#[test]
fn oracle_circle_undrained_su10_datum35_gradient1_bishop() {
    let doc = v047a_undrained(
        json!(["bishop"]),
        json!({"undrained_strength": 10.0, "strength_datum": 35.0, "strength_gradient": 1.0}),
    );
    assert_oracle(
        "V047a undrained Su 10 datum 35 gradient 1, bishop",
        fos(&doc, 0),
        1.0373275799,
    );
}

// ---------------------------------------------------------------------------------------------------------------
// Oracle: new methods on the fixed circle (RED until F3-W1b)

#[test]
fn oracle_circle_morgenstern_price_constant() {
    let mut doc = circle_doc("morgenstern_price");
    interslice(&mut doc, json!({"function": "constant"}));
    assert_oracle("V047a circle, M-P constant", fos(&doc, 0), 0.9841002710);
}

#[test]
fn oracle_circle_morgenstern_price_half_sine() {
    let mut doc = circle_doc("morgenstern_price");
    interslice(&mut doc, json!({"function": "half_sine"}));
    assert_oracle("V047a circle, M-P half_sine", fos(&doc, 0), 0.9840779260);
}

#[test]
fn oracle_circle_morgenstern_price_default_function_is_half_sine() {
    let doc = circle_doc("morgenstern_price");
    assert_oracle(
        "V047a circle, M-P without interslice",
        fos(&doc, 0),
        0.9840779260,
    );
    let report = run(&doc);
    let reported = report.results[0]
        .interslice
        .as_ref()
        .expect("M-P reports its function");
    assert_eq!(
        reported.function,
        ogs_core::model::IntersliceFunction::HalfSine
    );
}

#[test]
fn oracle_circle_janbu_simplified() {
    let doc = circle_doc("janbu_simplified");
    assert_oracle("V047a circle, Janbu simplified", fos(&doc, 0), 0.9452285578);
    let report = run(&doc);
    assert_eq!(
        report.results[0].lambda, None,
        "Janbu does not report lambda"
    );
    assert!(report.results[0].correction_factor.is_none());
}

#[test]
fn oracle_circle_janbu_corrected() {
    let doc = circle_doc("janbu_corrected");
    assert_oracle("V047a circle, Janbu corrected", fos(&doc, 0), 0.9883537594);
    let report = run(&doc);
    let f0 = report.results[0]
        .correction_factor
        .expect("Janbu corrected reports f0");
    assert!(f0 > 1.0, "f0 = {f0}");
    let simplified = fos(&circle_doc("janbu_simplified"), 0);
    let fos_corrected = report.results[0].fos.unwrap();
    assert!(
        (fos_corrected - f0 * simplified).abs() <= 1e-12 * fos_corrected,
        "fos = f0·F0"
    );
}

// ---------------------------------------------------------------------------------------------------------------
// Oracle: fixed polyline (RED until F3-W1a and F3-W1b)

#[test]
fn oracle_polyline_morgenstern_price_constant() {
    let mut doc = polyline_doc("morgenstern_price");
    interslice(&mut doc, json!({"function": "constant"}));
    assert_oracle("V047a polyline, M-P constant", fos(&doc, 0), 0.9991304877);
}

#[test]
fn oracle_polyline_morgenstern_price_half_sine() {
    let mut doc = polyline_doc("morgenstern_price");
    interslice(&mut doc, json!({"function": "half_sine"}));
    assert_oracle("V047a polyline, M-P half_sine", fos(&doc, 0), 0.9999384297);
}

#[test]
fn oracle_polyline_janbu_corrected() {
    let doc = polyline_doc("janbu_corrected");
    assert_oracle(
        "V047a polyline, Janbu corrected",
        fos(&doc, 0),
        0.9993458659,
    );
}

#[test]
fn polyline_report_emits_the_fitted_points_untagged() {
    // E13g: `{"points": [...]}` with the polyline extended/trimmed to the ground; the circle keeps `{xc, yc, r}`.
    let doc = polyline_doc("spencer");
    let report = run(&doc);
    let v = serde_json::to_value(&report.results[0].surface).unwrap();
    let points = v["points"]
        .as_array()
        .expect("a polyline is reported as {points}");
    assert!(v.get("xc").is_none() && v.get("type").is_none());
    assert!(points.len() >= POLYLINE.len());
}

#[test]
fn circle_report_is_still_xc_yc_r() {
    let report = run(&circle_doc("bishop"));
    let v = serde_json::to_value(&report.results[0].surface).unwrap();
    assert_eq!(v, json!({"xc": CIRCLE.0, "yc": CIRCLE.1, "r": CIRCLE.2}));
    let whole = serde_json::to_value(&report.results[0]).unwrap();
    assert!(whole.get("correction_factor").is_none() && whole.get("interslice").is_none());
}

// ---------------------------------------------------------------------------------------------------------------
// Neutrality, identity (F3.1, F3.2, F3.4)

#[test]
fn morgenstern_price_constant_reproduces_spencer_on_the_circle() {
    let spencer = run(&circle_doc("spencer")).results.remove(0);
    let mut doc = circle_doc("morgenstern_price");
    interslice(&mut doc, json!({"function": "constant"}));
    let mp = run(&doc).results.remove(0);
    assert_eq!(mp.status, spencer.status);
    let (f, g) = (mp.fos.unwrap(), spencer.fos.unwrap());
    assert!(
        (f - g).abs() <= 1e-10,
        "M-P constant {f:.12} against Spencer {g:.12}"
    );
    let (l, k) = (mp.lambda.unwrap(), spencer.lambda.unwrap());
    assert!(
        (l - k).abs() <= 1e-10,
        "lambda: M-P constant {l:.12} against Spencer {k:.12}"
    );
}

/// Cases of `verification/cases/`. The number is whatever the directory holds, never a literal.
fn case_models() -> Vec<(String, Value)> {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../verification/cases");
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir).expect("verification/cases exists") {
        let path = entry.unwrap().path();
        let name = path.file_name().unwrap().to_string_lossy().to_string();
        if !(name.starts_with('V') && name.ends_with(".json")) {
            continue;
        }
        let case: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        out.push((name, case["model"].clone()));
    }
    out.sort_by(|a, b| a.0.cmp(&b.0));
    assert!(
        !out.is_empty(),
        "an empty case set is a failure, never a silent pass"
    );
    out
}

#[test]
fn morgenstern_price_constant_reproduces_spencer_on_every_verification_case() {
    let mut compared = 0;
    for (name, model) in case_models() {
        let mut spencer_doc = model.clone();
        spencer_doc["analysis"]["methods"] = json!(["spencer"]);
        let Ok(spencer_json) = ogs_core::analyze_json(&spencer_doc.to_string()) else {
            continue; // Spencer itself has no valid surface in this case: nothing to compare.
        };
        let spencer: Value = serde_json::from_str(&spencer_json).unwrap();
        let mut mp_doc = model.clone();
        // M-P and `interslice` need v0.3 at least; a case with reinforcements keeps its v0.4 and stays covered.
        let version = model["version"]
            .as_str()
            .filter(|v| *v >= "0.3")
            .unwrap_or("0.3");
        mp_doc["version"] = json!(version);
        mp_doc["analysis"]["methods"] = json!(["morgenstern_price"]);
        mp_doc["analysis"]["interslice"] = json!({"function": "constant"});
        let mp: Value = serde_json::from_str(&run_json(&mp_doc)).unwrap();
        let (a, b) = (&spencer["results"][0], &mp["results"][0]);
        assert_eq!(a["status"], b["status"], "{name}: status");
        let (f, g) = (a["fos"].as_f64(), b["fos"].as_f64());
        match (f, g) {
            (Some(f), Some(g)) => assert!(
                (f - g).abs() <= 1e-10,
                "{name}: Spencer {f:.12}, M-P constant {g:.12}"
            ),
            (None, None) => {}
            _ => panic!("{name}: Spencer {f:?}, M-P constant {g:?}"),
        }
        compared += 1;
    }
    assert!(compared > 0);
    println!("M-P constant == Spencer on {compared} cases");
}

fn run_json(doc: &Value) -> String {
    ogs_core::analyze_json(&doc.to_string()).unwrap_or_else(|e| panic!("{e}"))
}

// ---------------------------------------------------------------------------------------------------------------
// Mirror (criterion 4): x → −x with the direction inverted gives the same FS

fn mirror_equal(doc: &Value, label: &str) {
    let (a, b) = (fos(doc, 0), fos(&mirror(doc), 0));
    assert!(
        (a - b).abs() <= 1e-9 * a,
        "{label}: {a:.12} against its mirror {b:.12}"
    );
}

#[test]
fn mirror_new_methods_on_the_circle() {
    for (method, spec) in [
        ("morgenstern_price", Some(json!({"function": "constant"}))),
        ("morgenstern_price", Some(json!({"function": "half_sine"}))),
        (
            "morgenstern_price",
            Some(json!({"function": "clipped_sine"})),
        ),
        (
            "morgenstern_price",
            Some(json!({"function": "trapezoidal"})),
        ),
        // A data_points function symmetric in ξ, so that the mirror (ξ → 1 − ξ) does not change it.
        (
            "morgenstern_price",
            Some(
                json!({"function": "data_points", "points": [[0.0, 0.2], [0.5, 1.0], [1.0, 0.2]]}),
            ),
        ),
        ("janbu_simplified", None),
        ("janbu_corrected", None),
    ] {
        let mut doc = circle_doc(method);
        if let Some(s) = &spec {
            interslice(&mut doc, s.clone());
        }
        mirror_equal(&doc, &format!("circle {method} {spec:?}"));
    }
}

#[test]
fn mirror_new_methods_on_the_polyline() {
    for (method, spec) in [
        ("spencer", None),
        ("morgenstern_price", Some(json!({"function": "constant"}))),
        ("morgenstern_price", Some(json!({"function": "half_sine"}))),
        ("janbu_simplified", None),
        ("janbu_corrected", None),
    ] {
        let mut doc = polyline_doc(method);
        if let Some(s) = &spec {
            interslice(&mut doc, s.clone());
        }
        mirror_equal(&doc, &format!("polyline {method} {spec:?}"));
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Geometric convergence (criterion 6): a polyline of N chords inscribed in the circle tends to the circle

/// `n` chords inscribed in the lower arc of the circle, from the toe (x = 30) to the crest crossing.
fn inscribed(n: usize) -> Vec<[f64; 2]> {
    let (xc, yc, r) = CIRCLE;
    let y = |x: f64| yc - (r * r - (x - xc) * (x - xc)).sqrt();
    let (x0, x1) = (30.0, 51.29111842105263);
    (0..=n)
        .map(|i| {
            let x = x0 + (x1 - x0) * i as f64 / n as f64;
            [x, y(x)]
        })
        .collect()
}

#[test]
fn inscribed_polyline_converges_to_the_circle_with_order_two() {
    let reference = fos(&circle_doc("spencer"), 0);
    let mut errors = Vec::new();
    for n in [4usize, 8, 16, 32] {
        let mut doc = v047a(json!(["morgenstern_price"]));
        interslice(&mut doc, json!({"function": "constant"}));
        set_polyline(&mut doc, &inscribed(n));
        let f = fos(&doc, 0);
        errors.push((n, (f - reference).abs()));
        println!(
            "N = {n:3}: M-P constant {f:.10}, |Δ| against Spencer on the circle {:.3e}",
            errors.last().unwrap().1
        );
    }
    for w in errors.windows(2) {
        let (e0, e1) = (w[0].1, w[1].1);
        let ratio = e1 / e0;
        // Order two: halving the chord length divides the error by about 4.
        assert!(
            (0.1..=0.5).contains(&ratio),
            "N {} → {}: error {e0:.3e} → {e1:.3e} (ratio {ratio:.3}, expected about 0.25)",
            w[0].0,
            w[1].0
        );
    }
    assert!(errors.last().unwrap().1 < 1e-3 * reference);
}
