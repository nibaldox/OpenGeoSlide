//! Regression tests for review R2 (`docs/reviews/R2_agy.md`, amendments E7a–E7d of `briefs/00_CONTRATOS.md`).
//!
//! Each counterexample of R2 is a test. The models are the ones of the review, run through the public `analyze`
//! API. The checks that need the internals (global moment residual, direct form of N') are computed here from
//! the public slice data, not from the solver code.

use ogs_core::analyze;
use ogs_core::methods::spencer::{
    spencer_direct_normals, spencer_effective_normals, spencer_interslice,
};
use ogs_core::methods::{SolveStatus, effective_normal};
use ogs_core::model::Model;
use ogs_core::report::MethodReport;
use ogs_core::slicer::Slice;
use serde_json::{Value, json};

/// R2-01 geometry: clay with a notch (the crest is cut by a void).
const P_R201: [[f64; 2]; 9] = [
    [0.0, 0.0],
    [0.0, 10.0],
    [10.0, 10.0],
    [25.0, 18.0],
    [26.0, 6.0],
    [38.0, 14.0],
    [40.0, 28.0],
    [60.0, 28.0],
    [60.0, 0.0],
];
/// R2-02 and R2-03 geometry: 15 m high slope with a 25 m crest (search and fixed circles).
const P_R202: [[f64; 2]; 6] = [
    [0.0, 0.0],
    [0.0, 15.0],
    [15.0, 15.0],
    [30.0, 25.0],
    [60.0, 25.0],
    [60.0, 0.0],
];
/// R2-03 fixed-circle geometry (the review's counterexample).
const P_R203: [[f64; 2]; 6] = [
    [0.0, 0.0],
    [0.0, 10.0],
    [10.0, 10.0],
    [20.0, 25.0],
    [50.0, 25.0],
    [50.0, 0.0],
];
/// R2-04 geometry: 10 m high slope with a 30 m crest.
const P_R204: [[f64; 2]; 6] = [
    [0.0, 0.0],
    [0.0, 10.0],
    [10.0, 10.0],
    [30.0, 20.0],
    [60.0, 20.0],
    [60.0, 0.0],
];

/// Bishop's critical circle of the R2-03 search (a Bishop FS of 0.340806 on the search grid).
const BISHOP_CRITICAL_R203: (f64, f64, f64) = (10.772, 39.641, 24.642);

/// Builds a `.ogs.json` model with one soil material (γ in kN/m³, c in kPa, φ in degrees, r_u optional).
fn model(
    polygon: &[[f64; 2]],
    cohesion: f64,
    phi: f64,
    gamma: f64,
    ru: Option<f64>,
    analysis: Value,
) -> Model {
    let value = json!({
        "format": "opengeoslide",
        "version": "0.1",
        "meta": {"id": "R2", "title": "regresión revisión R2"},
        "units": "SI",
        "materials": [{
            "id": "soil", "name": "Soil", "model": "mohr_coulomb",
            "unit_weight": gamma, "unit_weight_sat": null,
            "cohesion": cohesion, "friction_angle": phi, "ru": ru
        }],
        "regions": [{"material": "soil", "polygon": polygon}],
        "slope": {"direction": "auto"},
        "analysis": analysis
    });
    serde_json::from_value(value).expect("model")
}

/// Analysis block with a fixed circle `(xc, yc, r)`.
fn fixed(methods: &[&str], slices: usize, tolerance: f64, circle: (f64, f64, f64)) -> Value {
    json!({
        "methods": methods,
        "slices": slices,
        "tolerance": tolerance,
        "max_iterations": 2000,
        "min_m_alpha": 0.2,
        "surface": {"type": "circle", "xc": circle.0, "yc": circle.1, "r": circle.2}
    })
}

/// Analysis block with the circular entry/exit search (defaults of §4.4).
fn search(methods: &[&str], tolerance: f64) -> Value {
    json!({
        "methods": methods,
        "slices": 50,
        "tolerance": tolerance,
        "max_iterations": 2000,
        "min_m_alpha": 0.2,
        "search": {
            "type": "circular_entry_exit",
            "entry": null, "exit": null,
            "n_entry": 20, "n_exit": 20, "n_radius": 20,
            "max_radius_factor": 5.0, "min_width": null, "refine": true
        }
    })
}

/// Runs the analysis and returns the first (and only) method result.
fn run_one(m: &Model) -> MethodReport {
    let report = analyze(m).expect("analysis");
    report.results.into_iter().next().expect("one method")
}

/// Runs the analysis and returns the results in the order of `methods`.
fn run_all(m: &Model) -> Vec<MethodReport> {
    analyze(m).expect("analysis").results
}

/// Bishop's `m_α` of a slice at `fos` (§4.2), written here, not taken from the crate.
fn m_alpha(s: &Slice, fos: f64) -> f64 {
    s.alpha.cos() + s.alpha.sin() * s.tan_phi / fos
}

fn is_air(s: &Slice) -> bool {
    s.weight == 0.0 && s.cohesion == 0.0 && s.tan_phi == 0.0
}

/// Minimum of `Φ_i / F` over the soil slices, with Spencer's pole `Φ = (sin α − λ cos α) tan φ + (cos α + λ sin α) F`.
fn min_phi_over_fos(slices: &[Slice], fos: f64, lambda: f64) -> f64 {
    slices
        .iter()
        .filter(|s| !is_air(s))
        .map(|s| {
            let (sin, cos) = s.alpha.sin_cos();
            ((sin - lambda * cos) * s.tan_phi + (cos + lambda * sin) * fos) / fos
        })
        .fold(f64::INFINITY, f64::min)
}

/// R2-01 (E8a). The notch surface of R2-01 (φ = 0, c = 30, γ = 20, circle (16, 42, 34)) has an interior air void
/// that splits the soil into two masses, both heavier than 1e-3·ΣW. `slice_circle` returns `DisconnectedMass`,
/// and both methods report the surface as `NoValidSurface` through `analyze`. The global-moment and φ = 0 identities
/// of E7a are checked at the level of the methods, with synthetic slices, in `tests/methods.rs`.
#[test]
fn r2_01_notch_surface_is_disconnected_mass() {
    let m = model(
        &P_R201,
        30.0,
        0.0,
        20.0,
        None,
        fixed(&["bishop", "spencer"], 50, 1e-10, (16.0, 42.0, 34.0)),
    );
    let pm = ogs_core::geometry::PreparedModel::new(&m).expect("valid model");
    let circle = ogs_core::model::Circle {
        xc: 16.0,
        yc: 42.0,
        r: 34.0,
    };
    assert_eq!(
        ogs_core::slicer::slice_circle(&pm, &circle, 50).unwrap_err(),
        ogs_core::slicer::SurfaceError::DisconnectedMass
    );
    let err = analyze(&m).expect_err("the notch surface is not valid");
    match err {
        ogs_core::OgsError::NoValidSurface(msg) => {
            assert!(msg.contains("desconectados"), "{msg}")
        }
        other => panic!("expected NoValidSurface, got {other:?}"),
    }
}

/// R2-02a (E7b). Bishop with high pore pressure: Fellenius' start lies below the pole. Expected FS 1.394117 with
/// `min m_α ≥ 0.2` on the converged F (review: min m_α = 0.4028).
#[test]
fn r2_02a_bishop_converges_when_fellenius_starts_below_the_pole() {
    let m = model(
        &P_R202,
        1.0,
        45.0,
        20.0,
        Some(0.65),
        fixed(&["bishop"], 50, 1e-8, (25.0, 29.5, 18.0)),
    );
    let r = run_one(&m);
    println!("[R2-02a] {r:?}");
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let fos = r.fos.expect("finite");
    assert!(
        (fos - 1.394_117).abs() / 1.394_117 < 1e-5,
        "FS {fos} vs 1.394117"
    );
    let min_m = r
        .slices
        .iter()
        .filter(|s| !is_air(s))
        .map(|s| m_alpha(s, fos))
        .fold(f64::INFINITY, f64::min);
    assert!(min_m >= 0.2, "min m_α(F) = {min_m}");
}

/// R2-02b (E7b). Bishop with c = 50 and r_u = 0.90. Expected FS 1.936086 with `min m_α ≥ 0.2` (review: 0.2762).
#[test]
fn r2_02b_bishop_converges_with_high_cohesion_and_pore_pressure() {
    let m = model(
        &P_R202,
        50.0,
        45.0,
        20.0,
        Some(0.90),
        fixed(&["bishop"], 50, 1e-8, (25.0, 26.57, 18.0)),
    );
    let r = run_one(&m);
    println!("[R2-02b] {r:?}");
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let fos = r.fos.expect("finite");
    assert!(
        (fos - 1.936_086).abs() / 1.936_086 < 1e-5,
        "FS {fos} vs 1.936086"
    );
    let min_m = r
        .slices
        .iter()
        .filter(|s| !is_air(s))
        .map(|s| m_alpha(s, fos))
        .fold(f64::INFINITY, f64::min);
    assert!(min_m >= 0.2, "min m_α(F) = {min_m}");
}

/// R2-03 fixed circle (E7c). Spencer with a λ update that overshoots into a pole without damping. Expected
/// FS 0.623919 and λ 0.540962, `Converged`, every soil slice with `Φ/F ≥ 0.2` (review: min Φ/F = 0.2897).
#[test]
fn r2_03_spencer_fixed_circle_converges_with_damped_lambda() {
    let m = model(
        &P_R203,
        1.0,
        40.0,
        20.0,
        Some(0.536),
        fixed(&["spencer"], 50, 1e-8, (10.0, 35.0, 25.0)),
    );
    let r = run_one(&m);
    println!("[R2-03 fixed] {r:?}");
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let fos = r.fos.expect("finite");
    let lambda = r.lambda.expect("lambda");
    assert!(
        (fos - 0.623_919).abs() / 0.623_919 < 1e-5,
        "FS {fos} vs 0.623919"
    );
    assert!((lambda - 0.540_962).abs() < 1e-5, "λ {lambda} vs 0.540962");
    assert!(min_phi_over_fos(&r.slices, fos, lambda) >= 0.2);
    assert!(
        !r.warnings.iter().any(|w| w == "air_gap_thrust"),
        "no interior air here: {:?}",
        r.warnings
    );
}

/// R2-03 search (E7c). The search result for Spencer is a converged state that satisfies the E4b admissibility
/// (`Φ/F ≥ 0.2`). Its FS is 0.413197 on the circle (8.331, 45.665, 30.665), with Bishop at 0.340806.
#[test]
fn r2_03_search_spencer_result_is_admissible() {
    let m = model(
        &P_R202,
        2.0,
        45.0,
        20.0,
        Some(0.65),
        search(&["spencer"], 1e-5),
    );
    let r = run_one(&m);
    println!("[R2-03 search] {r:?}");
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let fos = r.fos.expect("finite");
    let lambda = r.lambda.expect("lambda");
    assert!(min_phi_over_fos(&r.slices, fos, lambda) > 0.0);
    let min_m = r
        .slices
        .iter()
        .filter(|s| !is_air(s))
        .map(|s| m_alpha(s, fos))
        .fold(f64::INFINITY, f64::min);
    assert!(min_m >= 0.2 - 1e-9, "min m_α(F) = {min_m}");
}

// The W5a target `r2_03_search_spencer_within_5_percent_of_bishop` (ignored) was removed in W7a. Its premise, Spencer
// within 5 % of Bishop, is retired: cSlope 0.1.0 gives Spencer 0.3876 and Bishop 0.3307 on this slope (+17 %, a real
// difference). The differential check against the oracle replaces it in `tests/differential_r2_03.rs`.

/// R2-03 Bishop-critical circle under E8b. The λ fixed point lies at λ ≈ 0.4587, where Φ/F < 0.2 on some slice, so
/// the old E4b rejected it. E8b asks for Bishop's m_α ≥ min_m_alpha and Φ > 1e-9·F, which the state satisfies:
/// Spencer is `Converged` at FS 0.480195. Bishop converges on the same circle.
#[test]
fn r2_03_bishop_critical_circle_spencer_is_admissible_under_e8b() {
    let m = model(
        &P_R202,
        2.0,
        45.0,
        20.0,
        Some(0.65),
        fixed(&["bishop", "spencer"], 50, 1e-8, BISHOP_CRITICAL_R203),
    );
    let results = run_all(&m);
    let (bishop, spencer) = (&results[0], &results[1]);
    assert_eq!(bishop.status, SolveStatus::Converged, "{bishop:?}");
    assert_eq!(spencer.status, SolveStatus::Converged, "{spencer:?}");
    let fos = spencer.fos.expect("finite");
    assert!(
        (fos - 0.480_195).abs() / 0.480_195 < 1e-5,
        "FS {fos} vs 0.480195"
    );
    let min_m = spencer
        .slices
        .iter()
        .filter(|s| !is_air(s))
        .map(|s| m_alpha(s, fos))
        .fold(f64::INFINITY, f64::min);
    assert!(min_m >= 0.2, "min m_α(F) = {min_m}");
    // Under E8b this state transmits thrust through an interior air run (|E| > 1e-3·ΣW): the warning is reported.
    assert!(
        spencer.warnings.iter().any(|w| w == "air_gap_thrust"),
        "{:?}",
        spencer.warnings
    );
}

/// R2-04 (E7d). Uniform r_u = 0.95 with c = 25 kPa: negative normal forces over most of the base (review: 42 of 51
/// slices, Σ_{N'<0}|N'| ≈ 10.5 % of ΣW). The warning is the major one, not the note. Expected FS: Bishop 1.047493
/// and Spencer 1.060891 (review).
#[test]
fn r2_04_subpressure_is_negative_normal_major() {
    let m = model(
        &P_R204,
        25.0,
        35.0,
        20.0,
        Some(0.95),
        fixed(&["bishop", "spencer"], 50, 1e-8, (12.0, 38.0, 28.0)),
    );
    let results = run_all(&m);
    for r in &results {
        println!(
            "[R2-04] {:?} fos={:?} warnings={:?}",
            r.method, r.fos, r.warnings
        );
        assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
        assert!(
            r.warnings
                .iter()
                .any(|w| w == "negative_effective_normal_major"),
            "{:?}: {:?}",
            r.method,
            r.warnings
        );
        assert!(
            !r.warnings.iter().any(|w| w == "negative_effective_normal"),
            "the major warning replaces the note: {:?}",
            r.warnings
        );
    }
    let fb = results[0].fos.expect("finite");
    let fs = results[1].fos.expect("finite");
    assert!(
        (fb - 1.047_493).abs() / 1.047_493 < 1e-5,
        "Bishop {fb} vs 1.047493"
    );
    assert!(
        (fs - 1.060_891).abs() / 1.060_891 < 1e-5,
        "Spencer {fs} vs 1.060891"
    );

    // Share f = Σ_{N'<0} |N'| / ΣW with the Bishop normal force (E4e). Must exceed the 5 % threshold of E7d (E8c).
    let b = &results[0];
    let total_w: f64 = b.slices.iter().map(|s| s.weight).sum();
    let f_share: f64 = b
        .slices
        .iter()
        .filter(|s| !is_air(s))
        .map(|s| effective_normal(s, fb, 0.0))
        .filter(|n| *n < 0.0)
        .map(|n| -n)
        .sum::<f64>()
        / total_w;
    println!("[R2-04] f = {f_share:.4} (Σ_{{N'<0}}|N'|/ΣW)");
    assert!(f_share > 0.05, "f = {f_share}");
}

/// E7d. The direct form of N' for Spencer, `W cos α − U + (sin α − λ cos α)·ΔE`, equals the E4e formula
/// (`(W − ΔX − u·b − c·l·sin α/F)/m_α`) within 1e-9 · ΣW on the converged R2-03 state (no polar slice).
#[test]
fn e7d_spencer_direct_normal_matches_e4e() {
    let m = model(
        &P_R203,
        1.0,
        40.0,
        20.0,
        Some(0.536),
        fixed(&["spencer"], 50, 1e-11, (10.0, 35.0, 25.0)),
    );
    let r = run_one(&m);
    let fos = r.fos.expect("finite");
    let lambda = r.lambda.expect("lambda");
    let total_w: f64 = r.slices.iter().map(|s| s.weight).sum();
    let e = spencer_interslice(&r.slices, fos, lambda);
    let direct = spencer_direct_normals(&r.slices, lambda, &e);
    let e4e = spencer_effective_normals(&r.slices, fos, lambda);
    let mut worst = 0.0_f64;
    for (a, b) in direct.iter().zip(&e4e) {
        worst = worst.max((a - b).abs());
    }
    println!("[E7d] worst |N'_direct − N'_E4e| = {worst:.3e} (ΣW {total_w:.3})");
    assert!(worst <= 1e-9 * total_w, "worst {worst:e} vs ΣW {total_w}");
}
