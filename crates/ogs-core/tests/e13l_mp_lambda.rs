//! Amendment E13l-4 (R10A-08): the step of λ and the normalization of the interslice function in Morgenstern-Price.
//!
//! - **Narrow peak.** The scan of λ had the step `0.05/f̄`; with `f̄ ≈ 0.02` and `f_max = 1` the first step moved `λ·f`
//!   to 2.5 and the root was lost. Now it is `0.05/max(f̄, f_max/2)`. The reference is cSlope 0.1.0 (D10, fixed circle,
//!   `data_points` with a peak at ξ = 0.9 that is 0.1 wide: cSlope 1.047543; ogs went from `no_lambda_root` to 1.047929,
//!   +0.04 %).
//! - **Two passes.** Pass 1 is the old scheme, unchanged: what converged before is the same result bit for bit (D09 with a
//!   ramp, where the fine grid had moved the 13th digit). Only what did not converge goes to pass 2, which works with
//!   `f/f_max` on the fine grid and reports λ in the scale of the user's `f` (`λ = λ_n/f_max`). The FS does not depend
//!   on the scale of `f`; `1e-310` (a subnormal) cannot be reported in λ and is `invalid (non_finite)`.
//! - **Limit that stays.** D10 with a peak of width 0.04 (a single face with `f = 1`, so `λ·f` ≈ 2.8 on one slice):
//!   the root of the moment equilibrium exists (FS ≈ 1.05, cSlope 1.047735), but E11b (`Φ/F ≥ min_m_alpha`) rejects it at
//!   `λ·f = 2.4` onward, and cSlope warns that the solution relies on tension. The guard is not relaxed.

mod f3_common;

use f3_common::*;
use ogs_core::methods::SolveStatus;
use ogs_core::report::MethodReport;
use serde_json::{Value, json};
use std::path::PathBuf;

/// D10 of the differential battery, with a fixed circle and Morgenstern-Price with the given `data_points`.
fn d10(points: Value) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../verification/differential/cases/D10.ogs.json");
    let mut doc: Value =
        serde_json::from_str(&std::fs::read_to_string(&path).expect("D10 exists")).unwrap();
    doc["version"] = json!("0.3");
    doc["analysis"]["methods"] = json!(["morgenstern_price"]);
    doc["analysis"]["interslice"] = json!({"function": "data_points", "points": points});
    doc["analysis"].as_object_mut().unwrap().remove("search");
    doc
}

fn result(doc: &Value) -> MethodReport {
    run(doc).results.remove(0)
}

/// R10A-08 (1): a peak that falls on a few faces. Base: `not_converged (no_lambda_root)`. cSlope 1.047543.
#[test]
fn e13l4_narrow_peak_converges_and_matches_cslope() {
    let r = result(&d10(json!([[0, 0], [0.8, 0], [0.9, 1], [1.0, 0]])));
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let fos = r.fos.unwrap();
    let cslope = 1.0475427535542634;
    assert!(
        (fos - cslope).abs() <= 1e-3 * cslope,
        "FS {fos} vs cSlope {cslope}"
    );
    assert!(r.lambda.unwrap() > 0.0);
}

/// The peaks that already converged keep their FS (the grid contains the old one: the old points beyond the fine range
/// stay), within the tolerance of the solver. cSlope: 1.045021 and 1.045938.
#[test]
fn e13l4_peaks_that_converged_before_still_do() {
    for (points, cslope, base) in [
        (
            json!([[0, 0], [0.6, 0], [0.75, 1], [0.9, 0], [1, 0]]),
            1.0450210375823517,
            1.0454057441746756,
        ),
        (
            json!([[0, 0], [0.7, 0], [0.8, 1], [0.9, 0], [1, 0]]),
            1.0459381054404482,
            1.0463237763317714,
        ),
        // λ·f_max = 3.35 here: beyond the fine range (λ·f_max ≤ 3), so the old points must still be in the grid.
        (
            json!([[0, 0], [0.2, 0], [0.3, 1], [0.4, 0], [1, 0]]),
            1.0385253215441208,
            1.0388386082911916,
        ),
    ] {
        let r = result(&d10(points.clone()));
        assert_eq!(r.status, SolveStatus::Converged, "{points}: {r:?}");
        let fos = r.fos.unwrap();
        assert!(
            (fos - base).abs() <= 1e-6 * base,
            "{points}: {fos} vs {base}"
        );
        assert!(
            (fos - cslope).abs() <= 1e-3 * cslope,
            "{points}: {fos} vs {cslope}"
        );
    }
}

/// V047a (fixed circle, 50 slices) with the triangle `[[0,0],[0.5,s],[1,0]]`.
fn triangle(scale: f64) -> Value {
    let mut doc = v047a(json!(["morgenstern_price"]));
    doc["analysis"]["interslice"] =
        json!({"function": "data_points", "points": [[0.0, 0.0], [0.5, scale], [1.0, 0.0]]});
    doc
}

/// R10A-08 (2): the FS does not depend on the scale of `f`, and `λ·s` does not either. `s = 1e-310` was
/// `no_lambda_root`; `1e-300` gave λ = 6.5e299. `λ = λ_n/s` of `1e-310` does not fit in an f64: `invalid (non_finite)`.
#[test]
fn e13l4_the_scale_of_f_changes_neither_the_fos_nor_the_product_lambda_f() {
    let unit = result(&triangle(1.0));
    assert_eq!(unit.status, SolveStatus::Converged, "{unit:?}");
    let (fos1, lambda1) = (unit.fos.unwrap(), unit.lambda.unwrap());
    for scale in [1e-3, 1e3, 1e-300, 7.5e-200] {
        let r = result(&triangle(scale));
        assert_eq!(r.status, SolveStatus::Converged, "s = {scale}: {r:?}");
        assert!(
            (r.fos.unwrap() - fos1).abs() <= 1e-9 * fos1,
            "s = {scale}: {} vs {fos1}",
            r.fos.unwrap()
        );
        let product = r.lambda.unwrap() * scale;
        assert!(
            (product - lambda1).abs() <= 1e-9 * lambda1.abs(),
            "s = {scale}: λ·s = {product} vs {lambda1}"
        );
    }
    // `λ = λ_n/s` of `1e-310` is above the largest f64: the result is `invalid (non_finite)`, never a `converged` with
    // `λ = None` (nor a NaN that looks like a result).
    let tiny = result(&triangle(1e-310));
    assert_eq!(tiny.status, SolveStatus::Invalid, "{tiny:?}");
    assert!(
        tiny.warnings.contains(&"non_finite".to_string()),
        "{:?}",
        tiny.warnings
    );
    assert_eq!((tiny.fos, tiny.lambda), (None, None));
}

/// The solver is unchanged for a function whose maximum is 1: the named ones and `data_points` with `max f = 1` give the
/// same result as `constant`-like scaling. Here: scaling a `data_points` of maximum 1 by 1 is the identity.
#[test]
fn e13l4_a_function_with_maximum_one_is_not_rescaled() {
    let a = result(&triangle(1.0));
    let mut doc = v047a(json!(["morgenstern_price"]));
    doc["analysis"]["interslice"] = json!({"function": "data_points",
        "points": [[0.0, 0.0], [0.25, 0.5], [0.5, 1.0], [0.75, 0.5], [1.0, 0.0]]});
    let b = result(&doc);
    assert_eq!(a.fos, b.fos, "the same piecewise-linear function");
    assert_eq!(a.lambda, b.lambda);
}

/// Pass 1 is the old scheme: a `data_points` that converged before gives the same result bit for bit. D09 (fixed surface)
/// with the ramp `[[0, 0.2], [1, 1]]` has aerial faces (`f = 0`) at the toe, so `f̄ < f_max/2` and the fine grid, added to
/// the old one, had moved the 13th digit of λ: with `694f13a` it was λ = 1.0148290331364727, FS = 0.4139749819860002.
#[test]
fn e13l4_a_data_points_that_converged_is_identical_to_the_old_scheme() {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../verification/differential/cases/D09.ogs.json");
    let mut doc: Value =
        serde_json::from_str(&std::fs::read_to_string(&path).expect("D09 exists")).unwrap();
    doc["version"] = json!("0.3");
    doc["analysis"]["methods"] = json!(["morgenstern_price"]);
    doc["analysis"]["interslice"] =
        json!({"function": "data_points", "points": [[0, 0.2], [1, 1]]});
    doc["analysis"].as_object_mut().unwrap().remove("search");
    let r = result(&doc);
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    assert_eq!(r.fos, Some(0.4139749819860002));
    assert_eq!(r.lambda, Some(1.0148290331364727));
}

/// A peak that falls between two faces has `f̄ = 0`: there is nothing to solve with, and it is `invalid (no_lambda_root)`.
#[test]
fn e13l4_a_peak_between_two_faces_is_invalid_with_its_reason() {
    let mut doc = v047a(json!(["morgenstern_price"]));
    doc["analysis"]["interslice"] = json!({"function": "data_points",
        "points": [[0, 0], [0.505, 0], [0.51, 1], [0.515, 0], [1, 0]]});
    let r = result(&doc);
    assert_eq!(r.status, SolveStatus::Invalid, "{r:?}");
    assert!(
        r.warnings.contains(&"no_lambda_root".to_string()),
        "{:?}",
        r.warnings
    );
}
