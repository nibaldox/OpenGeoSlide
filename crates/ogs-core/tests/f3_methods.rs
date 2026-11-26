//! Phase 3a, wave 1, W1b: Morgenstern-Price with five interslice functions (E13d), Janbu simplified and corrected
//! (E13e), and the start from Janbu on a non-circular surface (E13f). Criteria of F3.8 that the circle can show:
//! the oracle values (`cslope` 0.1.0, 50 slices, `tolerance 1e-5`, `|Δ| ≤ 0.1 %`), the identity of M-P `constant`
//! with Spencer, the independent global equilibrium, the mirror image and the known values of the functions.
//!
//! The reference values are the output of `cslope` 0.1.0 on the fixed circle of V047a (`CIRCLE`), obtained by the
//! writer with the harness converter (`verification/harness/to_cslope.py`) and the options
//! `method`, `intersliceFunction`, `intersliceDataPoints` and `janbuCorrection`. The polyline needs the slicer of
//! W1a and is tested there.

mod f3_common;

use f3_common::*;
use ogs_core::geometry::PreparedModel;
use ogs_core::methods::morgenstern_price::{interslice_faces, interslice_value};
use ogs_core::methods::spencer::{interslice_forces, spencer_interslice};
use ogs_core::methods::{SolveOptions, SolveStatus, effective_normal, solve};
use ogs_core::model::{Circle, IntersliceFunction as F, MethodKind, Model};
use ogs_core::slicer::{Slice, slice_circle};
use serde_json::{Value, json};
use std::fs;
use std::path::PathBuf;

/// `|Δ| ≤ 0.1 %` (F3.8).
const ORACLE_TOLERANCE: f64 = 1e-3;

fn assert_oracle(label: &str, got: f64, want: f64) {
    let rel = (got - want).abs() / want.abs();
    println!(
        "{label}: ogs {got:.10}, cslope {want:.10}, Δ {:+.4} %",
        100.0 * (got - want) / want
    );
    assert!(
        rel <= ORACLE_TOLERANCE,
        "{label}: ogs {got:.10} against cslope {want:.10}: Δ = {:.4} % (> 0.1 %)",
        100.0 * rel
    );
}

fn with_interslice(method: &str, spec: Value) -> Value {
    let mut doc = v047a(json!([method]));
    doc["analysis"]["interslice"] = spec;
    doc
}

fn undrained_su25(methods: Value) -> Value {
    v047a_undrained(methods, json!({"undrained_strength": 25.0}))
}

// ---------------------------------------------------------------------------------------------------------------
// The functions of the interface forces (E13d)

#[test]
fn interslice_functions_have_their_known_values() {
    let pi = std::f64::consts::PI;
    let xis = [0.0, 0.1, 0.2, 0.5, 0.8, 1.0];
    let sine = |x: f64| (pi * x).sin();
    let triangle: Vec<[f64; 2]> = vec![[0.0, 0.0], [0.5, 1.0], [1.0, 0.0]];
    type Row<'a> = (F, Option<&'a [[f64; 2]]>, [f64; 6]);
    let table: [Row; 5] = [
        (F::Constant, None, [1.0; 6]),
        (
            F::HalfSine,
            None,
            [0.0, sine(0.1), sine(0.2), 1.0, sine(0.8), sine(1.0)],
        ),
        (
            F::ClippedSine,
            None,
            [0.35, 0.35, sine(0.2), 1.0, sine(0.8), 0.35],
        ),
        (F::Trapezoidal, None, [0.0, 0.5, 1.0, 1.0, 1.0, 0.0]),
        (
            F::DataPoints,
            Some(&triangle),
            [0.0, 0.2, 0.4, 1.0, 0.4, 0.0],
        ),
    ];
    for (function, points, want) in table {
        for (xi, want) in xis.iter().zip(want) {
            let got = interslice_value(function, points, *xi);
            assert!(
                (got - want).abs() <= 1e-15,
                "{function:?} at ξ = {xi}: {got} against {want}"
            );
        }
    }
    // The closed values at the ends, spelled out: half_sine of 0.1 and 0.2, and the clipped floor.
    assert!((interslice_value(F::HalfSine, None, 0.1) - 0.309_016_994_374_947_4).abs() < 1e-15);
    assert!((interslice_value(F::HalfSine, None, 0.2) - 0.587_785_252_292_473_1).abs() < 1e-15);
    assert_eq!(interslice_value(F::ClippedSine, None, 0.1), 0.35);
    // Outside [0, 1] and for a NaN: zero, for every function.
    for function in [
        F::Constant,
        F::HalfSine,
        F::ClippedSine,
        F::Trapezoidal,
        F::DataPoints,
    ] {
        for xi in [-0.1, 1.0 + 1e-12, 2.0, f64::NAN, f64::INFINITY] {
            assert_eq!(
                interslice_value(function, Some(&triangle), xi),
                0.0,
                "{function:?} at ξ = {xi}"
            );
        }
    }
}

#[test]
fn data_points_interpolate_linearly_between_their_points() {
    let points = [[0.0, 0.2], [0.25, 1.0], [0.6, 0.4], [1.0, 0.9]];
    let f = |xi: f64| interslice_value(F::DataPoints, Some(&points), xi);
    assert_eq!(f(0.0), 0.2);
    assert_eq!(f(0.25), 1.0);
    assert_eq!(f(0.6), 0.4);
    assert_eq!(f(1.0), 0.9);
    // Midpoints of each segment, and a generic one.
    assert!((f(0.125) - 0.6).abs() < 1e-15);
    assert!((f(0.425) - 0.7).abs() < 1e-15);
    assert!((f(0.8) - 0.65).abs() < 1e-15);
    assert!((f(0.3) - (1.0 + (0.4 - 1.0) * (0.05 / 0.35))).abs() < 1e-15);
}

/// A slice with the geometry that the face values read: only the width and the soil / air state matter.
fn strip(width: f64, soil: bool) -> Slice {
    Slice {
        x_left: 0.0,
        x_right: width,
        y_base_left: 0.0,
        y_base_right: 0.0,
        y_top_mid: 1.0,
        width,
        alpha: 0.0,
        base_length: width,
        weight: if soil { 10.0 } else { 0.0 },
        cohesion: if soil { 5.0 } else { 0.0 },
        tan_phi: 0.0,
        pore_pressure: 0.0,
        material: 0,
        weight_extra: 0.0,
        h_force: 0.0,
        h_moment_base: 0.0,
        driving_extra: 0.0,
        y_centroid: 0.0,
        passive_v: 0.0,
        passive_h: 0.0,
        passive_h_moment_base: 0.0,
        passive_driving_extra: 0.0,
    }
}

#[test]
fn faces_follow_the_cumulative_width_and_freeze_along_an_air_run() {
    // Five strips of width 1, 2, 1, 1, 5 (total 10): the faces are at ξ = 0, 0.1, 0.3, 0.4, 0.5, 1.
    let all_soil: Vec<Slice> = [1.0, 2.0, 1.0, 1.0, 5.0]
        .iter()
        .map(|&w| strip(w, true))
        .collect();
    let faces = interslice_faces(&all_soil, F::Trapezoidal, None);
    let xi = [0.0, 0.1, 0.3, 0.4, 0.5, 1.0];
    assert_eq!(faces.len(), 6);
    for (k, x) in xi.iter().enumerate() {
        let want = interslice_value(F::Trapezoidal, None, *x);
        assert!((faces[k] - want).abs() < 1e-15, "face {k}: {faces:?}");
    }
    // The slices 2 and 3 are air (E7a): the faces 3 and 4 take the value of the face 2, on the toe side of the run.
    let mut gap = all_soil.clone();
    gap[2] = strip(1.0, false);
    gap[3] = strip(1.0, false);
    let frozen = interslice_faces(&gap, F::HalfSine, None);
    let free = interslice_faces(&all_soil, F::HalfSine, None);
    assert_eq!(frozen[2], free[2]);
    assert_eq!(frozen[3], free[2]);
    assert_eq!(frozen[4], free[2]);
    assert_eq!(frozen[5], free[5]);
    assert_eq!(frozen[1], free[1]);
}

// ---------------------------------------------------------------------------------------------------------------
// Oracle on the circle (F3.8)

#[test]
fn circle_values_of_f38_and_the_other_functions_against_cslope() {
    let table: [(&str, Value, f64); 11] = [
        (
            "M-P constant",
            with_interslice("morgenstern_price", json!({"function": "constant"})),
            0.9841002710,
        ),
        (
            "M-P half_sine",
            with_interslice("morgenstern_price", json!({"function": "half_sine"})),
            0.9840779260,
        ),
        (
            "M-P clipped_sine",
            with_interslice("morgenstern_price", json!({"function": "clipped_sine"})),
            0.9840846639,
        ),
        (
            "M-P trapezoidal",
            with_interslice("morgenstern_price", json!({"function": "trapezoidal"})),
            0.9840713928,
        ),
        (
            "M-P data_points triangle",
            with_interslice(
                "morgenstern_price",
                json!({"function": "data_points", "points": [[0.0, 0.0], [0.5, 1.0], [1.0, 0.0]]}),
            ),
            0.9840869415,
        ),
        (
            "M-P data_points asymmetric",
            with_interslice(
                "morgenstern_price",
                json!({"function": "data_points",
                       "points": [[0.0, 0.2], [0.25, 1.0], [0.6, 0.4], [1.0, 0.9]]}),
            ),
            0.9844301398,
        ),
        (
            "Janbu simplified",
            v047a(json!(["janbu_simplified"])),
            0.9452285578,
        ),
        (
            "Janbu corrected",
            v047a(json!(["janbu_corrected"])),
            0.9883537594,
        ),
        // b1 = 0.69 (cohesion only): the undrained material.
        (
            "undrained Janbu simplified",
            undrained_su25(json!(["janbu_simplified"])),
            1.5398815256,
        ),
        (
            "undrained Janbu corrected",
            undrained_su25(json!(["janbu_corrected"])),
            1.6368344022,
        ),
        (
            "undrained M-P half_sine",
            undrained_su25(json!(["morgenstern_price"])),
            1.5697595025,
        ),
    ];
    for (label, doc, want) in table {
        assert_oracle(&format!("V047a circle, {label}"), fos(&doc, 0), want);
    }
}

#[test]
fn janbu_corrected_is_f0_times_the_simplified_value_with_the_right_b1() {
    // f0 = 1 + b1 (d/L − 1.4 (d/L)²), with d, L and b1 recomputed here from the slices of the report.
    let cases = [
        (
            "mohr-coulomb c, φ > 0",
            v047a(json!(["janbu_corrected"])),
            0.50,
        ),
        (
            "undrained (c only)",
            undrained_su25(json!(["janbu_corrected"])),
            0.69,
        ),
        (
            "friction only (c = 0)",
            {
                let mut doc = v047a(json!(["janbu_corrected"]));
                doc["materials"][0]["cohesion"] = json!(0.0);
                doc
            },
            0.31,
        ),
    ];
    for (label, doc, b1) in cases {
        let report = run(&doc);
        let r = &report.results[0];
        let slices = &r.slices;
        let first = slices
            .iter()
            .min_by(|a, b| a.x_left.total_cmp(&b.x_left))
            .unwrap();
        let last = slices
            .iter()
            .max_by(|a, b| a.x_right.total_cmp(&b.x_right))
            .unwrap();
        let (xa, ya, xb, yb) = (
            first.x_left,
            first.y_base_left,
            last.x_right,
            last.y_base_right,
        );
        let l = ((xb - xa).powi(2) + (yb - ya).powi(2)).sqrt();
        let d = slices
            .iter()
            .map(|s| {
                let (x, y) = (
                    0.5 * (s.x_left + s.x_right),
                    0.5 * (s.y_base_left + s.y_base_right),
                );
                // Distance below the chord: the chord height at x minus the height of the base midpoint, times cos of
                // the chord inclination.
                let chord_y = ya + (yb - ya) * (x - xa) / (xb - xa);
                (chord_y - y) * (xb - xa) / l
            })
            .fold(0.0_f64, f64::max);
        let f0 = 1.0 + b1 * (d / l - 1.4 * (d / l).powi(2));
        let got = r.correction_factor.expect("corrected reports f0");
        println!(
            "{label}: f0 {got:.10} (independent {f0:.10}), d/L = {:.6}",
            d / l
        );
        assert!((got - f0).abs() <= 1e-12, "{label}: f0 {got} against {f0}");
        let mut simplified = doc.clone();
        simplified["analysis"]["methods"] = json!(["janbu_simplified"]);
        let f_simple = fos(&simplified, 0);
        assert!(
            (r.fos.unwrap() - f0 * f_simple).abs() <= 1e-12 * f_simple,
            "{label}: fos = f0·F0"
        );
    }
}

#[test]
fn janbu_reports_no_lambda_and_only_the_corrected_one_has_f0() {
    for (method, has_f0) in [("janbu_simplified", false), ("janbu_corrected", true)] {
        let report = run(&v047a(json!([method])));
        let r = &report.results[0];
        assert_eq!(r.status, SolveStatus::Converged);
        assert_eq!(r.lambda, None, "{method}");
        assert_eq!(r.correction_factor.is_some(), has_f0, "{method}");
        assert!(r.interslice.is_none(), "{method}");
    }
    // M-P reports lambda and its function, and no correction factor.
    let report = run(&with_interslice(
        "morgenstern_price",
        json!({"function": "trapezoidal"}),
    ));
    let r = &report.results[0];
    assert!(r.lambda.is_some() && r.correction_factor.is_none());
    assert_eq!(r.interslice.as_ref().unwrap().function, F::Trapezoidal);
}

// ---------------------------------------------------------------------------------------------------------------
// Identity of M-P `constant` with Spencer (F3.4)

fn models_of(dir: &str, suffix: &str, wrapped: bool) -> Vec<(String, Value)> {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(dir);
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir).expect("directory") {
        let path = entry.unwrap().path();
        let name = path.file_name().unwrap().to_string_lossy().to_string();
        if !name.ends_with(suffix) || name == "INDEX.md" {
            continue;
        }
        let v: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        out.push((name, if wrapped { v["model"].clone() } else { v }));
    }
    out.sort_by(|a, b| a.0.cmp(&b.0));
    assert!(!out.is_empty(), "an empty set is a failure, never a pass");
    out
}

#[test]
fn constant_reproduces_spencer_on_the_battery_and_acads_bit_for_bit() {
    let mut models = models_of("../../verification/differential/cases", ".ogs.json", false);
    models.extend(models_of("../../examples", ".ogs.json", false));
    let mut worst: f64 = 0.0;
    for (name, model) in &models {
        let mut spencer_doc = model.clone();
        spencer_doc["analysis"]["methods"] = json!(["spencer"]);
        let mut mp_doc = model.clone();
        mp_doc["version"] = json!("0.3");
        mp_doc["analysis"]["methods"] = json!(["morgenstern_price"]);
        mp_doc["analysis"]["interslice"] = json!({"function": "constant"});
        let a: Value =
            serde_json::from_str(&ogs_core::analyze_json(&spencer_doc.to_string()).unwrap())
                .unwrap();
        let b: Value =
            serde_json::from_str(&ogs_core::analyze_json(&mp_doc.to_string()).unwrap()).unwrap();
        let (a, b) = (&a["results"][0], &b["results"][0]);
        assert_eq!(a["status"], b["status"], "{name}: status");
        assert_eq!(a["warnings"], b["warnings"], "{name}: warnings");
        assert_eq!(a["lambda"], b["lambda"], "{name}: lambda");
        assert_eq!(a["iterations"], b["iterations"], "{name}: iterations");
        let (f, g) = (a["fos"].as_f64().unwrap(), b["fos"].as_f64().unwrap());
        worst = worst.max((f - g).abs());
        assert!(
            (f - g).abs() <= 1e-10,
            "{name}: Spencer {f:.12}, M-P {g:.12}"
        );
        assert_eq!(a["surface"], b["surface"], "{name}: surface");
    }
    println!(
        "M-P constant vs Spencer on {} models: worst |ΔF| = {worst:e}",
        models.len()
    );
}

#[test]
fn constant_reproduces_spencer_on_the_verification_cases_with_lambda_and_iterations() {
    let mut worst: f64 = 0.0;
    let cases = models_of("../../verification/cases", ".json", true);
    for (name, model) in &cases {
        let mut spencer_doc = model.clone();
        spencer_doc["analysis"]["methods"] = json!(["spencer"]);
        let Ok(a) = ogs_core::analyze_json(&spencer_doc.to_string()) else {
            continue;
        };
        let a: Value = serde_json::from_str(&a).unwrap();
        let mut mp_doc = model.clone();
        mp_doc["version"] = json!("0.3");
        mp_doc["analysis"]["methods"] = json!(["morgenstern_price"]);
        mp_doc["analysis"]["interslice"] = json!({"function": "constant"});
        let b: Value =
            serde_json::from_str(&ogs_core::analyze_json(&mp_doc.to_string()).unwrap()).unwrap();
        let (a, b) = (&a["results"][0], &b["results"][0]);
        assert_eq!(a["status"], b["status"], "{name}");
        assert_eq!(a["lambda"], b["lambda"], "{name}: lambda");
        assert_eq!(a["fos"], b["fos"], "{name}: fos");
        if let (Some(f), Some(g)) = (a["fos"].as_f64(), b["fos"].as_f64()) {
            worst = worst.max((f - g).abs());
        }
    }
    println!(
        "M-P constant vs Spencer on {} cases: worst |ΔF| = {worst:e}",
        cases.len()
    );
}

#[test]
fn interslice_forces_with_unit_faces_are_the_spencer_recurrence_bit_for_bit() {
    let slices = slices_of_v047a();
    let faces = vec![1.0; slices.len() + 1];
    for (fos, lambda) in [(0.98, 0.43), (1.3, -0.2), (0.9, 0.0)] {
        assert_eq!(
            interslice_forces(&slices, &faces, fos, lambda),
            spencer_interslice(&slices, fos, lambda)
        );
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Global equilibrium, independent of the solver (F3.8 criterion 2)

/// The 50 slices of the fixed circle of V047a, with the seismic coefficient `kh` when it is given.
fn slices_of_doc(doc: &Value) -> Vec<Slice> {
    let model: Model = serde_json::from_value(doc.clone()).expect("model");
    let pm = PreparedModel::new(&model).expect("prepared model");
    let c = Circle {
        xc: CIRCLE.0,
        yc: CIRCLE.1,
        r: CIRCLE.2,
    };
    slice_circle(&pm, &c, 50).expect("slices")
}

fn slices_of_v047a() -> Vec<Slice> {
    slices_of_doc(&v047a(json!(["spencer"])))
}

/// Resultant moment, about `p`, of the forces that act on the whole mass: `W*` at the vertical through the base
/// midpoint, `H` (with its own moment `h_moment_base` about that midpoint), and the base forces `N` and `S` at the
/// midpoint of each base (the slide goes toward −x). The interslice forces are internal and cancel, so the residual
/// does not use the moment equation of the solver. `N'` is taken from the `m_α` form of the vertical equilibrium
/// (`effective_normal`), not from the direct form, and `S = (c·l + N' tan φ)/F`.
fn global_moment(slices: &[Slice], e: &[f64], x: &[f64], fos: f64, p: (f64, f64)) -> (f64, f64) {
    let (mut moment, mut scale) = (0.0_f64, 0.0_f64);
    for (k, s) in slices.iter().enumerate() {
        if s.weight == 0.0 && s.cohesion == 0.0 && s.tan_phi == 0.0 {
            continue;
        }
        let (sin, cos) = s.alpha.sin_cos();
        let dx = x[k + 1] - x[k];
        let n_eff = effective_normal(s, fos, dx);
        let n = n_eff + s.pore_pressure * s.base_length;
        let shear = (s.cohesion * s.base_length + n_eff * s.tan_phi) / fos;
        let (xm, ym) = (
            0.5 * (s.x_left + s.x_right),
            0.5 * (s.y_base_left + s.y_base_right),
        );
        let (rx, ry) = (xm - p.0, ym - p.1);
        let w = s.total_weight();
        moment += -rx * w; // weight, downward
        moment += s.h_force * ry + s.h_moment_base; // H toward −x, plus its moment about the base midpoint
        moment += n * (rx * cos + ry * sin); // N along (−sin α, cos α)
        moment += shear * (rx * sin - ry * cos); // S along (cos α, sin α)
        scale += (w * rx).abs();
    }
    // The ends carry no interslice force: E_0 = 0 and E_n = 0 (the closure).
    debug_assert!(e[0] == 0.0);
    (moment, scale)
}

/// `X_k = λ f_k E_k` on the faces.
fn shear_forces(e: &[f64], faces: &[f64], lambda: f64) -> Vec<f64> {
    e.iter().zip(faces).map(|(e, f)| lambda * f * e).collect()
}

fn assert_global_moment(label: &str, doc: &Value, function: Option<(F, Option<Vec<[f64; 2]>>)>) {
    let report = run(doc);
    let r = &report.results[0];
    assert_eq!(r.status, SolveStatus::Converged, "{label}");
    let (fos, lambda) = (r.fos.unwrap(), r.lambda.unwrap());
    let slices = &r.slices;
    let faces = match &function {
        Some((f, points)) => interslice_faces(slices, *f, points.as_deref()),
        None => vec![1.0; slices.len() + 1],
    };
    let e = interslice_forces(slices, &faces, fos, lambda);
    let total_w: f64 = slices.iter().map(|s| s.weight).sum();
    assert!(
        e[slices.len()].abs() <= 1e-6 * total_w,
        "{label}: closure {}",
        e[slices.len()]
    );
    let x = shear_forces(&e, &faces, lambda);
    // Two distinct points: the centre of the circle and a point beside the slope.
    for p in [(CIRCLE.0, CIRCLE.1), (45.0, 40.0), (10.0, 5.0)] {
        let (moment, scale) = global_moment(slices, &e, &x, fos, p);
        println!(
            "{label}: F {fos:.9} λ {lambda:.6}, about ({:.1}, {:.1}) residual {moment:+.3e} of {scale:.3e} = {:.2e}",
            p.0,
            p.1,
            (moment / scale).abs()
        );
        assert!(
            (moment / scale).abs() < 1e-6,
            "{label}: moment about {p:?}: {moment} of {scale}"
        );
    }
}

#[test]
fn global_moment_equilibrium_of_morgenstern_price_about_two_points() {
    for (function, points) in [
        (F::HalfSine, None),
        (F::Constant, None),
        (F::ClippedSine, None),
        (F::Trapezoidal, None),
        (
            F::DataPoints,
            Some(vec![[0.0, 0.2], [0.25, 1.0], [0.6, 0.4], [1.0, 0.9]]),
        ),
    ] {
        let mut spec = json!({"function": serde_json::to_value(function).unwrap()});
        if let Some(p) = &points {
            spec["points"] = json!(p);
        }
        let doc = with_interslice("morgenstern_price", spec);
        assert_global_moment(&format!("M-P {function:?}"), &doc, Some((function, points)));
    }
}

#[test]
fn global_moment_equilibrium_of_morgenstern_price_with_seismic_force_and_a_load() {
    // E12b: H and the surface loads enter the force closure and the moment of M-P as they do in Spencer.
    let mut doc = with_interslice("morgenstern_price", json!({"function": "half_sine"}));
    doc["analysis"]["seismic"] = json!({"kh": 0.1, "kv": 0.05});
    doc["loads"] = json!([{"type": "udl", "x1": 50.0, "x2": 60.0, "q": 20.0}]);
    assert_global_moment(
        "M-P half_sine, kh 0.1, kv 0.05, udl",
        &doc,
        Some((F::HalfSine, None)),
    );
}

#[test]
fn global_moment_equilibrium_of_spencer_is_the_same_criterion() {
    assert_global_moment("Spencer", &v047a(json!(["spencer"])), None);
}

#[test]
fn global_horizontal_force_equilibrium_of_janbu() {
    // Σ(−N sin α + S cos α − H) = 0: no interslice shear, and the end thrusts are zero. `N'` from the m_α form.
    let kh_doc = {
        let mut doc = v047a(json!(["janbu_simplified"]));
        doc["analysis"]["seismic"] = json!({"kh": 0.1});
        doc
    };
    for (label, doc) in [
        ("Mohr-Coulomb", v047a(json!(["janbu_simplified"]))),
        ("undrained", undrained_su25(json!(["janbu_simplified"]))),
        ("kh = 0.1", kh_doc),
    ] {
        let report = run(&doc);
        let r = &report.results[0];
        let f0 = r.fos.unwrap();
        let total_w: f64 = r.slices.iter().map(|s| s.weight).sum();
        let residual: f64 = r
            .slices
            .iter()
            .map(|s| {
                let (sin, cos) = s.alpha.sin_cos();
                let n_eff = effective_normal(s, f0, 0.0);
                let n = n_eff + s.pore_pressure * s.base_length;
                let shear = (s.cohesion * s.base_length + n_eff * s.tan_phi) / f0;
                -n * sin + shear * cos - s.h_force
            })
            .sum();
        println!(
            "Janbu {label}: F0 {f0:.9}, horizontal residual {residual:+.3e} (ΣW {total_w:.1})"
        );
        assert!(residual.abs() < 1e-6 * total_w, "{label}: {residual}");
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Mirror image, start from Janbu, guards

const ASYMMETRIC: [[f64; 2]; 4] = [[0.0, 0.2], [0.25, 1.0], [0.6, 0.4], [1.0, 0.9]];

#[test]
fn mirror_with_a_symmetric_function_and_the_oracle_orientation_of_an_asymmetric_one() {
    // ξ is measured in the x of the model, as in cSlope: the mirror image keeps the FS for a function symmetric in ξ,
    // and an asymmetric one is evaluated the other way round in the other direction.
    let symmetric = with_interslice(
        "morgenstern_price",
        json!({"function": "data_points", "points": [[0.0, 0.2], [0.3, 1.0], [0.7, 1.0], [1.0, 0.2]]}),
    );
    let (a, b) = (fos(&symmetric, 0), fos(&mirror(&symmetric), 0));
    assert!(
        (a - b).abs() <= 1e-9 * a,
        "{a:.12} against its mirror {b:.12}"
    );
    let doc = with_interslice(
        "morgenstern_price",
        json!({"function": "data_points", "points": ASYMMETRIC}),
    );
    let (rtl, ltr) = (fos(&doc, 0), fos(&mirror(&doc), 0));
    println!("asymmetric data_points: right_to_left {rtl:.10}, left_to_right {ltr:.10}");
    // cSlope 0.1.0 on V047a (the circle mirrored for left_to_right, `oracle_ltr.py`): 0.9844301398 and 0.9837948572.
    assert_oracle("asymmetric, right_to_left", rtl, 0.9844301398);
    assert_oracle("asymmetric, left_to_right", ltr, 0.9837948572);
    // Fine check of the orientation: the FS minus that of `constant` (0.9841002710 and 0.9841002710 in the mirror).
    let constant = fos(
        &with_interslice("morgenstern_price", json!({"function": "constant"})),
        0,
    );
    assert!(((rtl - constant) - (0.9844301398 - 0.9841002710)).abs() < 5e-7);
    assert!(((ltr - constant) - (0.9837948572 - 0.9841002710)).abs() < 5e-7);
}

#[test]
fn the_functions_differ_from_constant_as_in_the_oracle_to_five_decimals() {
    // The oracle tolerance (0.1 %) is wider than the effect of the function (about 0.03 %). The difference with the
    // `constant` function, in which the +0.0045 % offset of the slicer cancels, is checked to 5e-7 absolute.
    let constant = fos(
        &with_interslice("morgenstern_price", json!({"function": "constant"})),
        0,
    );
    for (label, spec, want) in [
        (
            "half_sine",
            json!({"function": "half_sine"}),
            0.9840779260 - 0.9841002710,
        ),
        (
            "clipped_sine",
            json!({"function": "clipped_sine"}),
            0.9840846639 - 0.9841002710,
        ),
        (
            "trapezoidal",
            json!({"function": "trapezoidal"}),
            0.9840713928 - 0.9841002710,
        ),
        (
            "data_points triangle",
            json!({"function": "data_points", "points": [[0.0, 0.0], [0.5, 1.0], [1.0, 0.0]]}),
            0.9840869415 - 0.9841002710,
        ),
        (
            "data_points asymmetric",
            json!({"function": "data_points", "points": ASYMMETRIC}),
            0.9844301398 - 0.9841002710,
        ),
    ] {
        let got = fos(&with_interslice("morgenstern_price", spec), 0) - constant;
        println!("{label}: F − F(constant) = {got:+.8}, cslope {want:+.8}");
        assert!((got - want).abs() < 5e-7, "{label}: {got} against {want}");
    }
}

#[test]
fn data_points_of_a_constant_function_are_the_constant_function() {
    let constant = fos(
        &with_interslice("morgenstern_price", json!({"function": "constant"})),
        0,
    );
    let points = fos(
        &with_interslice(
            "morgenstern_price",
            json!({"function": "data_points", "points": [[0.0, 1.0], [0.3, 1.0], [1.0, 1.0]]}),
        ),
        0,
    );
    assert_eq!(
        constant, points,
        "f ≡ 1 by points is the constant function, bit for bit"
    );
    // A scale of f only rescales λ: f ≡ 2 gives the same FS.
    let twice = fos(
        &with_interslice(
            "morgenstern_price",
            json!({"function": "data_points", "points": [[0.0, 2.0], [1.0, 2.0]]}),
        ),
        0,
    );
    assert!(
        (constant - twice).abs() <= 1e-9,
        "{constant} against {twice}"
    );
}

fn options(circular: bool) -> SolveOptions {
    SolveOptions {
        tolerance: 1e-5,
        max_iterations: 500,
        min_m_alpha: 0.2,
        circular,
    }
}

#[test]
fn a_non_circular_start_from_janbu_reaches_the_same_root() {
    // E13f: the slices of the circle with `circular = false`: the scan starts from Janbu's F0 instead of Bishop's FS.
    let slices = slices_of_v047a();
    for method in [MethodKind::Spencer, MethodKind::MorgensternPrice] {
        let on_circle = solve(&slices, method, &options(true));
        let off_circle = solve(&slices, method, &options(false));
        assert_eq!(off_circle.status, SolveStatus::Converged, "{method:?}");
        println!(
            "{method:?}: Bishop start F {:.12}, Janbu start F {:.12} (iterations {} / {})",
            on_circle.fos, off_circle.fos, on_circle.iterations, off_circle.iterations
        );
        assert!((on_circle.fos - off_circle.fos).abs() <= 1e-8, "{method:?}");
        assert!((on_circle.lambda.unwrap() - off_circle.lambda.unwrap()).abs() <= 1e-6);
    }
    // Janbu does not depend on the flag.
    for method in [MethodKind::JanbuSimplified, MethodKind::JanbuCorrected] {
        assert_eq!(
            solve(&slices, method, &options(true)),
            solve(&slices, method, &options(false))
        );
    }
}

#[test]
fn bishop_on_a_non_circular_surface_is_invalid() {
    let slices = slices_of_v047a();
    let r = solve(&slices, MethodKind::Bishop, &options(false));
    assert_eq!(r.status, SolveStatus::Invalid);
    assert!(r.fos.is_nan());
    assert!(r.message.is_some());
    // On a circle nothing changes.
    assert_eq!(
        solve(&slices, MethodKind::Bishop, &options(true)).status,
        SolveStatus::Converged
    );
}

#[test]
fn a_function_with_no_mass_inside_the_block_is_no_lambda_root() {
    // f is zero on every interior face and 1 only at the crest end: f̄ = 0 (E13d).
    let doc = with_interslice(
        "morgenstern_price",
        json!({"function": "data_points", "points": [[0.0, 0.0], [0.999, 0.0], [1.0, 1.0]]}),
    );
    let report = run(&doc);
    let r = &report.results[0];
    assert_eq!(r.status, SolveStatus::Invalid);
    assert_eq!(r.fos, None);
    assert!(
        r.warnings.contains(&"no_lambda_root".to_string()),
        "{:?}",
        r.warnings
    );
}

#[test]
fn janbu_has_no_driving_when_the_slide_goes_uphill() {
    // The same circle with the opposite direction: the mass would slide toward the crest, with no driving force.
    let mut doc = v047a(json!([
        "janbu_simplified",
        "janbu_corrected",
        "morgenstern_price"
    ]));
    doc["slope"]["direction"] = json!("left_to_right");
    let Ok(text) = ogs_core::analyze_json(&doc.to_string()) else {
        return; // the surface may be rejected before the solver: nothing to check then
    };
    let report: Value = serde_json::from_str(&text).unwrap();
    for r in report["results"].as_array().unwrap() {
        println!(
            "opposite direction {}: {} {:?}",
            r["method"], r["status"], r["warnings"]
        );
        assert_ne!(r["status"], "converged", "{}", r["method"]);
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Guards (E4b, E7c, E9c with λ·f) and search

fn with_min_m_alpha(mut doc: Value, min_m: f64) -> Value {
    doc["analysis"]["min_m_alpha"] = json!(min_m);
    doc
}

#[test]
fn a_surface_that_the_m_alpha_guard_rejects_is_never_converged() {
    // min_m_alpha = 0.99 rejects the surface for every method: no FS is reported as converged.
    for method in [
        "spencer",
        "morgenstern_price",
        "janbu_simplified",
        "janbu_corrected",
    ] {
        let report = run(&with_min_m_alpha(v047a(json!([method])), 0.99));
        let r = &report.results[0];
        println!(
            "min_m_alpha 0.99, {method}: {:?} {:?}",
            r.status, r.warnings
        );
        assert_eq!(r.status, SolveStatus::NotConverged, "{method}");
        assert_eq!(r.fos, None, "{method}");
        assert!(r.correction_factor.is_none(), "{method}");
    }
    let bishop = run(&with_min_m_alpha(v047a(json!(["bishop"])), 0.99));
    assert_eq!(bishop.results[0].status, SolveStatus::Invalid);
}

#[test]
fn the_pole_guard_of_morgenstern_price_uses_lambda_times_f() {
    // At min_m_alpha = 0.9 Spencer (f = 1) has no admissible root, but the half sine makes λ·f small near the ends of
    // the block, so the poles Φ_i of M-P are those of λ·f (E13d) and its root is admissible.
    let spencer = run(&with_min_m_alpha(v047a(json!(["spencer"])), 0.9));
    assert_eq!(spencer.results[0].status, SolveStatus::NotConverged);
    let mp = run(&with_min_m_alpha(v047a(json!(["morgenstern_price"])), 0.9));
    let r = &mp.results[0];
    assert_eq!(r.status, SolveStatus::Converged);
    let (fos, lambda) = (r.fos.unwrap(), r.lambda.unwrap());
    // The admissibility of the reported state, checked here: Φ_i/F ≥ min_m on every soil slice, with the f of the face
    // that the march resolves in the slice.
    let faces = interslice_faces(&r.slices, F::HalfSine, None);
    for (k, s) in r.slices.iter().enumerate() {
        if s.weight == 0.0 && s.cohesion == 0.0 && s.tan_phi == 0.0 {
            continue;
        }
        let (sin, cos) = s.alpha.sin_cos();
        let sf = lambda * faces[k + 1];
        let phi = ((sin - sf * cos) * s.tan_phi + (cos + sf * sin) * fos) / fos;
        assert!(phi >= 0.9, "slice {k}: Φ/F = {phi}");
    }
}

#[test]
fn search_with_the_new_methods_is_within_one_percent_of_cslope() {
    // V047a with its search (20 × 20 × 20, refinement) and 50 slices. cSlope 0.1.0 with the same search settings
    // (`to_cslope.py` options, `oracle_search.py`): the criterion of the searches is FS_ogs ≤ 1.01·FS_cSlope.
    let case: Value = serde_json::from_str(
        &fs::read_to_string(
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../verification/cases/V047a.json"),
        )
        .unwrap(),
    )
    .unwrap();
    for (label, method, spec, cslope) in [
        (
            "M-P half_sine",
            "morgenstern_price",
            Some(json!({"function": "half_sine"})),
            0.9840741753,
        ),
        (
            "M-P constant",
            "morgenstern_price",
            Some(json!({"function": "constant"})),
            0.9840960685,
        ),
        ("Janbu simplified", "janbu_simplified", None, 0.9350919434),
        ("Janbu corrected", "janbu_corrected", None, 0.9854548680),
    ] {
        let mut doc = case["model"].clone();
        doc["version"] = json!("0.3");
        doc["analysis"]["methods"] = json!([method]);
        if let Some(spec) = spec {
            doc["analysis"]["interslice"] = spec;
        }
        let f = fos(&doc, 0);
        println!(
            "search V047a, {label}: ogs {f:.10}, cslope {cslope:.10}, Δ {:+.4} %",
            100.0 * (f - cslope) / cslope
        );
        assert!(f <= 1.01 * cslope, "{label}: {f} above 1.01·{cslope}");
        assert!(
            f >= 0.99 * cslope,
            "{label}: {f} more than 1 % below {cslope}"
        );
    }
}

// ---------------------------------------------------------------------------------------------------------------
// The fixed polyline of F3.8 with slices built here (the slicer of polylines is W1a's, merged later): the solvers
// with `circular = false`, against the oracle, the global equilibrium and the mirror image.

/// Slices of V047a between a polyline `points` (x increasing, ground-to-ground) and the ground of V047a
/// (y = 25 for x ≤ 30, then the 2:1 slope up to y = 35 at x = 50, flat after). `n` uniform divisions plus the
/// vertices of the polyline and of the ground. Toe first for a slide toward −x (`right_to_left`), as the slicer gives
/// them: the toe is on the left.
fn polyline_slices(points: &[[f64; 2]], n: usize) -> Vec<Slice> {
    let (x0, x1) = (points[0][0], points[points.len() - 1][0]);
    let ground = |x: f64| 25.0 + 0.5 * (x - 30.0).clamp(0.0, 20.0);
    let base = |x: f64| {
        let i = points
            .partition_point(|p| p[0] <= x)
            .clamp(1, points.len() - 1);
        let (a, b) = (points[i - 1], points[i]);
        a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])
    };
    let mut xs: Vec<f64> = (0..=n)
        .map(|i| x0 + (x1 - x0) * i as f64 / n as f64)
        .collect();
    xs.extend(points.iter().map(|p| p[0]));
    xs.push(50.0);
    xs.sort_by(f64::total_cmp);
    xs.dedup_by(|a, b| (*a - *b).abs() < 1e-9);
    xs.windows(2)
        .map(|w| {
            let (xl, xr) = (w[0], w[1]);
            let (yl, yr) = (base(xl), base(xr));
            let xm = 0.5 * (xl + xr);
            // The ground is linear inside the slice (50 is a node), so the trapezoid is exact.
            let height = 0.5 * (ground(xl) - yl + ground(xr) - yr);
            let width = xr - xl;
            Slice {
                x_left: xl,
                x_right: xr,
                y_base_left: yl,
                y_base_right: yr,
                y_top_mid: ground(xm),
                width,
                alpha: (yr - yl).atan2(width),
                base_length: width.hypot(yr - yl),
                weight: 20.0 * height * width,
                cohesion: 3.0,
                tan_phi: 19.6_f64.to_radians().tan(),
                pore_pressure: 0.0,
                material: 0,
                weight_extra: 0.0,
                h_force: 0.0,
                h_moment_base: 0.0,
                driving_extra: 0.0,
                y_centroid: 0.0,
                passive_v: 0.0,
                passive_h: 0.0,
                passive_h_moment_base: 0.0,
                passive_driving_extra: 0.0,
            }
        })
        .collect()
}

/// The same slices for a slide toward +x: x → −x and the toe first (the mirror image of the polyline).
fn mirrored_slices(slices: &[Slice]) -> Vec<Slice> {
    // Reversing the order puts the former crest first; the mirror of a toe-first list is read from the right.
    slices
        .iter()
        .map(|s| Slice {
            x_left: -s.x_right,
            x_right: -s.x_left,
            y_base_left: s.y_base_right,
            y_base_right: s.y_base_left,
            alpha: s.alpha,
            ..*s
        })
        .collect()
}

#[test]
fn polyline_values_of_f38_with_slices_built_in_the_test() {
    // Oracle values of F3.8 on the polyline (0.1 %): M-P constant and half sine, and Janbu corrected. The slices are
    // built here with 50 divisions, not by the slicer of W1a, so the criterion is that of the oracle (0.1 %).
    let slices = polyline_slices(&POLYLINE, 50);
    let spec = |f: F| ogs_core::model::IntersliceSpec {
        function: f,
        points: None,
    };
    let opts = options(false);
    let run_method = |m: MethodKind, f: Option<F>| {
        let r = ogs_core::methods::solve_with(&slices, m, &opts, f.map(spec).as_ref());
        assert_eq!(r.status, SolveStatus::Converged, "{m:?} {r:?}");
        r.fos
    };
    assert_oracle(
        "V047a polyline, M-P constant",
        run_method(MethodKind::MorgensternPrice, Some(F::Constant)),
        0.9991304877,
    );
    assert_oracle(
        "V047a polyline, M-P half_sine",
        run_method(MethodKind::MorgensternPrice, Some(F::HalfSine)),
        0.9999384297,
    );
    assert_oracle(
        "V047a polyline, Janbu corrected",
        run_method(MethodKind::JanbuCorrected, None),
        0.9993458659,
    );
    // Spencer starts from Janbu's F0 and gives M-P constant; Bishop is not defined on a polyline.
    let spencer = run_method(MethodKind::Spencer, None);
    let constant = run_method(MethodKind::MorgensternPrice, Some(F::Constant));
    assert_eq!(
        spencer, constant,
        "Spencer = M-P constant, bit for bit, also on a polyline"
    );
    assert_eq!(
        solve(&slices, MethodKind::Bishop, &opts).status,
        SolveStatus::Invalid
    );
}

#[test]
fn polyline_global_equilibrium_and_mirror_of_the_solvers() {
    let slices = polyline_slices(&POLYLINE, 50);
    let opts = options(false);
    let mirrored = mirrored_slices(&slices);
    for (method, function) in [
        (MethodKind::Spencer, None),
        (MethodKind::MorgensternPrice, Some(F::HalfSine)),
        (MethodKind::MorgensternPrice, Some(F::Trapezoidal)),
    ] {
        let spec = function.map(|f| ogs_core::model::IntersliceSpec {
            function: f,
            points: None,
        });
        let r = ogs_core::methods::solve_with(&slices, method, &opts, spec.as_ref());
        assert_eq!(r.status, SolveStatus::Converged, "{method:?}");
        let (fos, lambda) = (r.fos, r.lambda.unwrap());
        let faces = match function {
            Some(f) => interslice_faces(&slices, f, None),
            None => vec![1.0; slices.len() + 1],
        };
        let e = interslice_forces(&slices, &faces, fos, lambda);
        let x = shear_forces(&e, &faces, lambda);
        for p in [(40.0, 45.0), (30.0, 20.0)] {
            let (moment, scale) = global_moment(&slices, &e, &x, fos, p);
            println!(
                "polyline {method:?} {function:?}: F {fos:.9}, residual about {p:?} = {:.2e}",
                (moment / scale).abs()
            );
            assert!(
                (moment / scale).abs() < 1e-6,
                "{method:?} {function:?} about {p:?}"
            );
        }
        // Mirror image: the same FS with the slices mirrored and the slide toward +x.
        let m = ogs_core::methods::solve_with(&mirrored, method, &opts, spec.as_ref());
        assert!(
            (m.fos - fos).abs() <= 1e-9 * fos,
            "{method:?} {function:?}: {fos} against {}",
            m.fos
        );
    }
    // Janbu: horizontal force and mirror image.
    let r = ogs_core::methods::solve_with(&slices, MethodKind::JanbuSimplified, &opts, None);
    let f0 = r.fos;
    let residual: f64 = slices
        .iter()
        .map(|s| {
            let (sin, cos) = s.alpha.sin_cos();
            let n_eff = effective_normal(s, f0, 0.0);
            -n_eff * sin + (s.cohesion * s.base_length + n_eff * s.tan_phi) / f0 * cos
        })
        .sum();
    let total_w: f64 = slices.iter().map(|s| s.weight).sum();
    assert!(
        residual.abs() < 1e-6 * total_w,
        "horizontal residual {residual}"
    );
    for method in [MethodKind::JanbuSimplified, MethodKind::JanbuCorrected] {
        let (a, b) = (
            solve(&slices, method, &opts),
            solve(&mirrored, method, &opts),
        );
        assert!(
            (a.fos - b.fos).abs() <= 1e-9 * a.fos,
            "{method:?}: {} against {}",
            a.fos,
            b.fos
        );
    }
}
