//! Amendment E13l-3 (R10A-03, R10A-07): the scale of the force residuals is `max(D, min(max(ΣW, ΣW*), 3·D))`, with the
//! **driving scale** `D = max(ΣW, Σ|t_i|, Σ|H_i|)`, `t = W*·sin α + H·cos α` and `H = kh·W + H^P`.
//!
//! The candidate of the contract, `D` alone, was measured and **does not meet** criterion 2: it changes V018, V077 and
//! V078 in the 10th digit and D13 with `data_points` in the 12th (scale 0.55 and 0.92 times the old one; see
//! `docs/fase3/r10m1/NOTAS.md`). The old scale `max(ΣW, ΣW*)` (E13j-6) is kept while it does not exceed `3·D`, so that
//! every model of the repository (largest ratio 1.89, in the Prandtl cases) stays identical bit for bit; beyond `3·D`
//! it is limited. A vertical load on a flat base (`α = 0`) adds to `ΣW*` but drives nothing, and it used to inflate the
//! scale: the moment residual and the closure fell below their tolerances at states without equilibrium (R10A-03), and
//! the share of the negative normal forces of E7d fell below 0.05 (R10A-07). The four criteria of the contract:
//!
//! 1. V018, V077 and V078 (Prandtl, γ = 1e-6) converge with the same FS, here pinned bit for bit (ratio 1.80–1.89 < 3);
//! 2. every other model is identical byte for byte (measured outside, over 3350 runs: 0 differences);
//! 3. the inert overload of R10A-03 does not converge falsely;
//! 4. V068 with a load on the flat toe keeps `negative_effective_normal_major` (R10A-07).
//!
//! It also fixes the second half of R10A-03: a nearly weightless soil under a **horizontal** line load (the scale
//! `ΣW*` has no horizontal term), where Spencer did not converge and cSlope 0.1.0 does.

mod f3_common;

use f3_common::*;
use ogs_core::methods::SolveStatus;
use ogs_core::report::MethodReport;
use serde_json::{Value, json};
use std::path::PathBuf;

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn case_model(path: &str) -> Value {
    let text = std::fs::read_to_string(root().join(path)).unwrap_or_else(|e| panic!("{path}: {e}"));
    let case: Value = serde_json::from_str(&text).unwrap();
    case["model"].clone()
}

fn first(doc: &Value) -> MethodReport {
    run(doc).results.remove(0)
}

// ---------------------------------------------------------------------------------------------------------------
// Criterion 3: the inert overload

/// Undrained slope (Su = 40, γ = 18) and a polyline with a flat stretch at y = 5 over `[10, 20]`, with a vertical UDL `q`
/// on that stretch. The UDL adds to `W*` but does not enter `T = W*·sin α` (α = 0), nor `R = c·l` (φ = 0), nor `E`: the
/// FS of Spencer does not depend on it. Spencer with the old scale: 1.68263 (q = 0), 1.70829 (q = 1e8, λ = −0.1 on
/// the grid, `|ρ|` = 4 % of the moment), 1.54609 (q = 1e9, λ = −0.2).
fn overload_doc(q: f64, tolerance: f64) -> Value {
    let mut doc = json!({
        "format": "opengeoslide", "version": "0.3", "meta": {"id": "r10a03", "title": "r10a03"}, "units": "SI",
        "materials": [{"id": "c", "name": "c", "model": "undrained", "unit_weight": 18.0, "undrained_strength": 40.0}],
        "regions": [{"material": "c", "polygon": [[0, -20], [60, -20], [60, 0], [40, 0], [0, 20]]}],
        "slope": {"direction": "left_to_right"},
        "analysis": {"methods": ["spencer", "morgenstern_price"], "slices": 50, "tolerance": tolerance,
                     "max_iterations": 500, "min_m_alpha": 0.2,
                     "interslice": {"function": "constant"},
                     "surface": {"type": "polyline", "points": [[4, 18], [10, 5], [20, 5], [26, 7]]}}
    });
    if q > 0.0 {
        doc["loads"] = json!([{"type": "udl", "x1": 10, "x2": 20, "q": q}]);
    }
    doc
}

#[test]
fn e13l3_an_inert_overload_does_not_change_the_fos_nor_converge_falsely() {
    for tolerance in [1e-5, 0.01] {
        let reference = run(&overload_doc(0.0, tolerance));
        for (i, method) in ["spencer", "morgenstern_price"].into_iter().enumerate() {
            let r0 = &reference.results[i];
            assert_eq!(r0.status, SolveStatus::Converged, "{method}: {r0:?}");
            let fos0 = r0.fos.unwrap();
            for q in [1e7, 1e8, 1e9, 1e10, 1e11] {
                let report = run(&overload_doc(q, tolerance));
                let r = &report.results[i];
                // Either it converges to the FS that the overload cannot change, or it does not converge.
                if r.status == SolveStatus::Converged {
                    let fos = r.fos.unwrap();
                    assert!(
                        (fos - fos0).abs() <= 1e-4 * fos0,
                        "{method}, tol {tolerance}, q = {q:e}: FS {fos} vs {fos0}, λ = {:?}",
                        r.lambda
                    );
                    assert!(
                        (r.lambda.unwrap() - r0.lambda.unwrap()).abs() <= 1e-3,
                        "{method}, q = {q:e}: λ {:?} vs {:?}",
                        r.lambda,
                        r0.lambda
                    );
                }
                assert_eq!(
                    r.status,
                    SolveStatus::Converged,
                    "{method}, q = {q:e}: {r:?}"
                );
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Second half of R10A-03: nearly weightless soil under a horizontal load

/// V047a's slope and circle with γ = 1e-6, a horizontal line load (angle −90°, in the sliding direction of
/// `right_to_left`), and `c`, `φ`. cSlope 0.1.0 (Spencer and Bishop on the same circle): 0.5312263525648053 (c = 10,
/// φ = 0, p = 500 at x = 35) and 0.9784504160129208 (c = 20, φ = 10, p = 500 at x = 35). Spencer with the old scale:
/// `not_converged (no_lambda_root)`.
fn weightless(cohesion: f64, friction: f64) -> Value {
    let mut doc = v047a(json!(["spencer", "morgenstern_price"]));
    doc["materials"][0]["unit_weight"] = json!(1e-6);
    doc["materials"][0]["cohesion"] = json!(cohesion);
    doc["materials"][0]["friction_angle"] = json!(friction);
    doc["loads"] = json!([{"type": "line", "x": 35, "p": 500, "angle": -90}]);
    doc["analysis"]["interslice"] = json!({"function": "constant"});
    doc
}

#[test]
fn e13l3_a_weightless_soil_under_a_horizontal_load_converges_and_matches_cslope() {
    for (cohesion, friction, cslope) in [
        (10.0, 0.0, 0.5312263525648053),
        (20.0, 10.0, 0.9784504160129208),
    ] {
        let report = run(&weightless(cohesion, friction));
        for r in &report.results {
            assert_eq!(r.status, SolveStatus::Converged, "c = {cohesion}: {r:?}");
            let fos = r.fos.unwrap();
            assert!(
                (fos - cslope).abs() <= 1e-3 * cslope,
                "c = {cohesion}, φ = {friction}: {fos} vs cSlope {cslope}"
            );
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Criterion 4: V068 and a load on the flat toe

/// V068 (retained, `verification/pending/F3`) with Bishop on its fixed circle, and a UDL of 5000 on `x ∈ [15.64, 20.26]`,
/// the flat stretch of the toe (R10A-07). `Σ|N'<0| / ΣW*` was 0.035 (note); with the scale limited to `3·D` it is above 0.05 (0.064).
fn v068_doc(q: f64) -> Value {
    let mut doc = case_model("verification/pending/F3/V068.json");
    doc["version"] = json!("0.3");
    if q > 0.0 {
        doc["loads"] = json!([{"type": "udl", "x1": 15.64, "x2": 20.26, "q": q}]);
    }
    doc
}

#[test]
fn e13l3_v068_keeps_the_major_warning_with_a_load_on_the_toe() {
    for q in [0.0, 5000.0] {
        let mut doc = v068_doc(q);
        doc["analysis"]["methods"] = json!(["bishop"]);
        let r = first(&doc);
        assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
        assert!(
            r.warnings
                .contains(&"negative_effective_normal_major".to_string()),
            "q = {q}: {:?}",
            r.warnings
        );
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Criterion 1: the Prandtl cases

/// V018, V077 and V078 (Spencer and Morgenstern-Price with half sine) converge, with the FS that E13j-6 gave, bit for bit (the published checks of `acceptance.rs` pin
/// them to 1 %). Their `ΣW*` is 1.8–1.9 times the driving scale, below the limit 3, so the scale does not change.
#[test]
fn e13l3_the_prandtl_cases_still_converge_with_their_fos() {
    for (path, fos_pinned) in [
        (
            "verification/cases/V018.json",
            [1.0520418941171956, 1.0686429900466887],
        ),
        (
            "verification/cases/V077.json",
            [0.9428402332910114, 0.9581045101516602],
        ),
        (
            "verification/cases/V078.json",
            [0.9426057940267945, 0.9578270695425091],
        ),
    ] {
        let mut doc = case_model(path);
        doc["analysis"]["methods"] = json!(["spencer", "morgenstern_price"]);
        doc["analysis"]["interslice"] = json!({"function": "half_sine"});
        let report = run(&doc);
        for (r, want) in report.results.iter().zip(fos_pinned) {
            assert_eq!(r.status, SolveStatus::Converged, "{path}: {r:?}");
            let fos = r.fos.unwrap();
            assert!(
                (fos - want).abs() <= 1e-6 * want,
                "{path} {:?}: {fos} vs {want}",
                r.method
            );
        }
    }
}
