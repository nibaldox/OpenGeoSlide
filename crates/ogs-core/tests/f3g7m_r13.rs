//! R13, writer M (F5.13): the tension crack, the water and the Ito-Matsui piles of the engine.
//!
//! One section per amendment, each starting with the test that was RED before the correction (E15m-1 … E15m-8). The
//! documents of the reproductions are in `tests/data/f3g7m/` (copies of `docs/fase3/r13/repro/`).

mod f3_common;

use f3_common::run;
use ogs_core::report::AnalysisReport;
use serde_json::{Value, json};
use std::path::PathBuf;

fn data(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/data/f3g7m")
        .join(format!("{name}.json"));
    serde_json::from_str(&std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{name}: {e}")))
        .expect("parses")
}

fn crack_of(report: &AnalysisReport, i: usize) -> (f64, f64, f64) {
    let c = report.results[i]
        .tension_crack
        .expect("the report has a crack");
    (c.x, c.depth, c.water_force)
}

// ------------------------------------------------------------------------------------------------------- E15m-1 (A-03)

/// A fixed depth is the one of the user, on a vertical step of the ground too (before: `depth 4.9707`, `Pw 121.19`).
#[test]
fn e15m1_fixed_depth_on_a_vertical_step_is_not_rewritten() {
    let report = run(&data("a03_escalon_fija"));
    let pw = 0.5 * 9.81 * 2.0 * 2.0;
    for i in 0..2 {
        let (x, depth, force) = crack_of(&report, i);
        assert!((x - 5.0).abs() < 1e-6, "the crack is at the step: {x}");
        assert_eq!(depth, 2.0, "method {i}: the depth is the fixed one");
        assert!((force - pw).abs() <= 1e-12 * pw, "Pw {force} vs {pw}");
    }
    // Value of the binary before R12 (the fixed crack was never rewritten there), tolerance 1e-6 of the document.
    let bishop = report.results[0].fos.unwrap();
    let before_r12 = 1.8820658923047255;
    assert!(
        (bishop - before_r12).abs() <= 1e-9,
        "Bishop {bishop} vs {before_r12}"
    );
    let spencer = report.results[1].fos.unwrap();
    assert!(
        (spencer - 1.880685623188902).abs() <= 1e-9,
        "Spencer {spencer}"
    );
}

/// The face rule of E15l-2 stays with `depth: "auto"`: the `udl` of `a04_udl` (copy in `tests/data/f3g5a`) is the same.
#[test]
fn e15m1_auto_keeps_the_face_rule_of_e15l2() {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/data/f3g5a/a04_udl.json");
    let doc: Value = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
    let report = run(&doc);
    let (x, depth, force) = crack_of(&report, 0);
    assert!((x + 66.5).abs() < 1e-9, "{x}");
    assert!((depth - 1.7827).abs() < 1e-4, "{depth}");
    assert!((force - 15.5885).abs() < 1e-3, "{force}");
    let bishop = report.results[0].fos.unwrap();
    assert!((bishop - 1.0953480195260576).abs() <= 1e-12, "{bishop}");
}

/// Auto over the vertical step of `a03`: E15l-2 keeps the face over the base seen from the crest side (4.9707). cSlope
/// (Bishop 1.862416, d = d(x_c) = 2.6161) matches neither that face nor the face on the entry side (0.9707, Bishop
/// 1.904136): the variant of the entry side of E15m-1 is not implemented (see the report of R13-M).
#[test]
fn e15m1_auto_at_a_step_is_unchanged_by_this_amendment() {
    let mut doc = data("a03_escalon_fija");
    doc["analysis"]["tension_crack"]["depth"] = json!("auto");
    let report = run(&doc);
    let (x, depth, _) = crack_of(&report, 0);
    assert!((x - 5.0).abs() < 1e-6, "{x}");
    assert!((depth - 4.970675496255023).abs() < 1e-9, "{depth}");
}

// ------------------------------------------------------------------------------------------------------- E15m-2 (A-02)

fn sum_h(report: &AnalysisReport, i: usize) -> f64 {
    report.results[i].slices.iter().map(|s| s.h_force).sum()
}

/// A polyline that starts `dx` inside the vertical face (`dx` ≪ `wall_tol`) keeps the thrust of the face: same FS and
/// same `Σ h_force` as `dx = 0` (before: `Σ h_force = 0`, Spencer 2.66591 → 3.49275, 31 % on the unsafe side).
#[test]
fn e15m2_wall_thrust_is_not_lost_by_rounding() {
    let reference = run(&data("a02_paramento_dx0"));
    let h0 = sum_h(&reference, 0);
    assert!(h0.abs() > 100.0, "the reference carries the thrust: {h0}");
    let mut docs = vec![("1e-12", data("a02_paramento_dx1e-12"))];
    let mut doc9 = data("a02_paramento_dx0");
    doc9["analysis"]["surface"]["points"][0] = json!([20.0 + 1e-9, 6.0]);
    docs.push(("1e-9", doc9));
    for (label, doc) in docs {
        let report = run(&doc);
        for i in 0..2 {
            let (a, b) = (
                report.results[i].fos.unwrap(),
                reference.results[i].fos.unwrap(),
            );
            assert!(
                (a - b).abs() <= 1e-6 * b,
                "dx {label}, method {i}: {a} vs {b}"
            );
            assert!(
                report.results[i]
                    .warnings
                    .iter()
                    .any(|w| w == "water_above_ground"),
                "dx {label}, method {i}: the warning of the face"
            );
        }
        let h = sum_h(&report, 0);
        assert!(
            (h - h0).abs() <= 1e-6 * h0.abs(),
            "dx {label}: Σh_force {h} vs {h0}"
        );
    }
}

// ------------------------------------------------------------------------------------------------------- E15m-7 (A-01)

/// `S/D = 1.0023` makes the profile of Ito-Matsui huge but finite (`soil_force 1.1e308`): the arm is not `zf·soil` (that
/// overflowed to `∞` and was serialized as `null`, with `no_capacity`). The analysis either ends with the error of
/// E15l-11 or gives finite numbers with `arm > 0` and a coherent `governs`.
#[test]
fn e15m7_a_huge_finite_profile_never_gives_a_null_arm() {
    let doc = data("a01_arm_null");
    let model: ogs_core::model::Model = serde_json::from_value(doc.clone()).unwrap();
    match ogs_core::analyze(&model) {
        Err(e) => {
            let text = e.to_string();
            assert!(
                text.starts_with("InvalidModel: reinforcements[0].lateral_pressure: la presión de Ito-Matsui no es finita con S/D = ")
                    && text.contains("φ = 35°")
                    && text.ends_with("aumente spacing"),
                "{text}"
            );
        }
        Ok(report) => {
            for r in &report.results {
                assert!(r.fos.is_some_and(f64::is_finite), "{:?}", r.method);
                for f in &r.reinforcement_forces {
                    let arm = f.arm.expect("the arm is serialized");
                    assert!(arm.is_finite() && arm > 0.0, "arm {arm}");
                    assert!(f.available.is_finite() && f.fx.is_finite() && f.fy.is_finite());
                    assert!(f.soil_force.is_some_and(f64::is_finite));
                    assert!(
                        f.status != ogs_core::report::ForceStatus::NoCapacity,
                        "{:?}",
                        f.status
                    );
                }
            }
        }
    }
}

// ------------------------------------------------------------------------------------------------------- E15m-6 (B-01)

const DEFAULT_GAMMA_W: &str = "water_unit_weight_default";

fn count(report: &AnalysisReport, i: usize, code: &str) -> usize {
    report.results[i]
        .warnings
        .iter()
        .filter(|w| w.as_str() == code)
        .count()
}

/// The model of `a03` with a piezometric line under the ground and no `water.unit_weight`, in the given units.
fn piezo_doc(units: &str) -> Value {
    let mut doc = data("a03_escalon_fija");
    doc["units"] = json!(units);
    doc["analysis"]
        .as_object_mut()
        .unwrap()
        .remove("tension_crack");
    doc["water"] = json!({"piezometric_line": [[-10, 0], [45, 0]]});
    doc
}

/// Imperial units, water in use and no `water.unit_weight`: the note, once per method (before: no note).
#[test]
fn e15m6_imperial_piezometric_line_without_unit_weight_emits_the_note() {
    for label in ["imperial", "imp", " IMPERIAL "] {
        let report = run(&piezo_doc(label));
        for i in 0..2 {
            assert_eq!(count(&report, i, DEFAULT_GAMMA_W), 1, "{label}, method {i}");
        }
    }
}

/// Water in the crack only (no `water` block) is also use of the water.
#[test]
fn e15m6_imperial_crack_water_without_water_block_emits_the_note() {
    let mut doc = data("a03_escalon_fija");
    doc["units"] = json!("imperial");
    let report = run(&doc);
    assert_eq!(count(&report, 0, DEFAULT_GAMMA_W), 1);
    // A dry crack does not use the water.
    doc["analysis"]["tension_crack"]["water_fill"] = json!(0.0);
    assert_eq!(count(&run(&doc), 0, DEFAULT_GAMMA_W), 0);
}

/// With `water.unit_weight` declared, in SI, or without any use of the water there is no note.
#[test]
fn e15m6_no_note_when_gamma_is_declared_or_si_or_no_water() {
    let mut declared = piezo_doc("imperial");
    declared["water"]["unit_weight"] = json!(62.4);
    assert_eq!(count(&run(&declared), 0, DEFAULT_GAMMA_W), 0);
    assert_eq!(count(&run(&piezo_doc("SI")), 0, DEFAULT_GAMMA_W), 0);
    let mut dry = data("a03_escalon_fija");
    dry["units"] = json!("imperial");
    dry["analysis"]
        .as_object_mut()
        .unwrap()
        .remove("tension_crack");
    assert_eq!(count(&run(&dry), 0, DEFAULT_GAMMA_W), 0);
}

/// In SI the output is the one of always: the same warnings as the document with `unit_weight 9.81` declared.
#[test]
fn e15m6_si_output_is_unchanged() {
    let plain = run(&piezo_doc("SI"));
    let mut declared = piezo_doc("SI");
    declared["water"]["unit_weight"] = json!(9.81);
    let declared = run(&declared);
    for i in 0..2 {
        assert_eq!(plain.results[i].warnings, declared.results[i].warnings);
        assert_eq!(plain.results[i].fos, declared.results[i].fos);
    }
}

// ------------------------------------------------------------------------------------------------------- E15m-3 (A-05)

/// Slender dam (width 10, height 200, `wall_tol = 2e-5`): vertical face at `x = 6` (`y` 16 → 200, the soil on the
/// side of `+x`), reservoir at `y = 100` on the low side, and a polyline that stays entirely on the low side.
fn slender_wall(load_x: Option<f64>) -> Value {
    let mut doc = json!({
        "format": "opengeoslide", "version": "0.5", "units": "SI",
        "materials": [{"id": "s", "name": "s", "model": "mohr_coulomb", "unit_weight": 20.0,
                       "cohesion": 10.0, "friction_angle": 30.0}],
        "regions": [{"material": "s", "polygon": [[0,0],[0,16],[6,16],[6,200],[10,200],[10,0]]}],
        "slope": {"direction": "right_to_left"},
        "water": {"unit_weight": 9.81, "piezometric_line": [[0,100],[6,100],[6.1,16],[10,16]]},
        "analysis": {"methods": ["spencer", "janbu_simplified"], "slices": 50, "tolerance": 1e-6,
                     "surface": {"type": "polyline",
                                 "points": [[0.5, 16], [1.5, 14], [4.5, 13], [6.0, 16]]}}
    });
    if let Some(x) = load_x {
        doc["loads"] = json!([{"type": "line", "id": "l1", "x": x, "p": 1.0, "angle": 0.0}]);
    }
    doc
}

/// A mass entirely on the low side of the face takes no thrust of it, with or without a load beside the face (before:
/// the slice `[5.999985, 6]`, whose edge is 1.5e-5 < `wall_tol` from the face, took the whole thrust: Σh_force 0 →
/// −34609.68 kN/m).
#[test]
fn e15m3_the_thrust_of_the_face_never_goes_to_a_slice_on_the_low_side() {
    let without = run(&slender_wall(None));
    let with = run(&slender_wall(Some(5.999995)));
    assert_eq!(
        with.results[0].slices.len(),
        without.results[0].slices.len() + 1
    );
    for i in 0..2 {
        let (a, b) = (sum_h(&without, i), sum_h(&with, i));
        assert!(
            (a - b).abs() <= 1e-9 * a.abs().max(1.0),
            "method {i}: Σh_force {a} vs {b}"
        );
        assert!(
            !with.results[i]
                .slices
                .iter()
                .any(|s| s.h_force.abs() > 1000.0),
            "no slice carries the thrust of the face"
        );
    }
}
