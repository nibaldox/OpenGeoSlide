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

// ------------------------------------------------------------------------------------------------------- E15m-5 (A-06)

/// The circle of `a04_udl` (entry at `x = −68`) with a `udl` that ends at `x_entry − δ`, entirely outside the mass.
fn udl_outside(delta: f64) -> Value {
    let mut doc = data("a04_udl");
    doc["loads"] =
        json!([{"type": "udl", "id": "u1", "x1": -70.0, "x2": -68.0 - delta, "q": 100.0}]);
    doc
}

/// A `udl` that only touches the entry from outside does not cancel the automatic crack: `δ = 0` is `δ = 1e-6` (before:
/// `depth 0`, `Pw 0` and Bishop 1.609392, +2.84 % over cSlope 1.564943).
#[test]
fn e15m5_a_udl_that_only_touches_the_entry_from_outside_keeps_the_crack() {
    let (touching, apart) = (run(&udl_outside(0.0)), run(&udl_outside(1e-6)));
    for i in 0..2 {
        let ((_, d0, p0), (_, d1, p1)) = (crack_of(&touching, i), crack_of(&apart, i));
        assert!(d1 > 2.0, "the crack of δ = 1e-6: {d1}");
        assert!((d0 - d1).abs() <= 1e-6, "depth {d0} vs {d1}");
        assert!((p0 - p1).abs() <= 1e-6 * p1, "Pw {p0} vs {p1}");
        let (a, b) = (
            touching.results[i].fos.unwrap(),
            apart.results[i].fos.unwrap(),
        );
        assert!((a - b).abs() <= 1e-6 * b, "method {i}: {a} vs {b}");
    }
    // cSlope 0.1.0, Bishop and Spencer of the same document (the oracle is the same for both δ).
    for (i, oracle) in [(0, 1.5649432546866269), (1, 1.563680718758391)] {
        let a = touching.results[i].fos.unwrap();
        assert!(
            (a - oracle).abs() <= 1e-3 * oracle,
            "{a} vs cSlope {oracle}"
        );
    }
}

/// A `udl` that does cover the entry from inside still cancels the crack there (the shortcut keeps its meaning).
#[test]
fn e15m5_a_udl_over_the_entry_still_cancels_the_automatic_depth() {
    let mut doc = data("a04_udl");
    doc["loads"] = json!([{"type": "udl", "id": "u1", "x1": -70.0, "x2": -60.0, "q": 100.0}]);
    let report = run(&doc);
    let (_, depth, force) = crack_of(&report, 0);
    assert!(depth < 2.0, "{depth}");
    assert!(force <= 0.5 * 9.81 * depth * depth + 1e-12);
}

/// The same case in its mirror image (right_to_left): the shortcut looks inward at the other edge too.
#[test]
fn e15m5_mirror_image_gives_the_same_crack() {
    let doc = udl_outside(0.0);
    let mut mirrored = f3_common::mirror(&doc);
    mirrored["loads"] = json!([{"type": "udl", "id": "u1", "x1": 68.0, "x2": 70.0, "q": 100.0}]);
    let (a, b) = (run(&doc), run(&mirrored));
    for i in 0..2 {
        let ((_, da, pa), (_, db, pb)) = (crack_of(&a, i), crack_of(&b, i));
        assert!(da > 2.0 && (da - db).abs() <= 1e-9, "{da} vs {db}");
        assert!((pa - pb).abs() <= 1e-9 * pb);
        let (fa, fb) = (a.results[i].fos.unwrap(), b.results[i].fos.unwrap());
        assert!((fa - fb).abs() <= 1e-9 * fa, "{fa} vs {fb}");
    }
}

// ------------------------------------------------------------------------------------------------------- E15m-4 (A-04)

/// Crest `y = 15` up to `x = 52`, then a slope; circle that enters the crest at `x = 49.95624`; narrow peak of
/// ponded water (6 m over the ground, 0.13 m wide) at `apex`. The uniform sweep of the crack has a step of
/// `0.121292` from the entry: its abscissae are 50.4414 (k = 4) and 50.5627 (k = 5).
fn narrow_peak(apex: f64) -> Value {
    json!({
        "format": "opengeoslide", "version": "0.5", "units": "SI",
        "materials": [{"id": "s", "name": "s", "model": "mohr_coulomb", "unit_weight": 18.0,
                       "cohesion": 15.0, "friction_angle": 25.0}],
        "regions": [{"material": "s", "polygon": [[0,0],[0,15],[52,15],[72,5],[100,5],[100,0]]}],
        "slope": {"direction": "left_to_right"},
        "water": {"unit_weight": 9.81,
                  "piezometric_line": [[0,12],[apex-0.1,12],[apex,21],[apex+0.1,12],[52,12],[72,2],[100,2]]},
        "analysis": {"methods": ["bishop", "spencer"], "slices": 50, "tolerance": 1e-6,
                     "surface": {"type": "circle", "xc": 70.33, "yc": 30.0, "r": 25.3},
                     "tension_crack": {"depth": "auto", "water_fill": 1.0}}
    })
}

/// A narrow peak of the piezometric line between two steps of the sweep is found like one that falls on a step (before:
/// the sweep skipped it and the crack went 1.9 m down the slope, `x = 52.33`, `depth 2.616`, Bishop 1.837890 against
/// 1.885066 with the peak on a step).
#[test]
fn e15m4_a_piezometric_peak_between_two_steps_is_swept() {
    let (on_step, between) = (
        50.4414092201801,
        0.5 * (50.4414092201801 + 50.56270093293383),
    );
    let a = run(&narrow_peak(on_step));
    let b = run(&narrow_peak(between));
    for i in 0..2 {
        let ((xa, da, _), (xb, db, _)) = (crack_of(&a, i), crack_of(&b, i));
        assert!(
            (xa - on_step).abs() < 0.07 && da < 1.0,
            "on a step: x {xa}, depth {da}"
        );
        assert!(
            (xb - between).abs() < 0.07 && db < 1.0,
            "between steps: x {xb}, depth {db}"
        );
        // The crack follows the peak: the same shape moved by 0.06 m gives a depth of the same order.
        assert!((da - db).abs() < 0.15, "depth {da} vs {db}");
        let (fa, fb) = (a.results[i].fos.unwrap(), b.results[i].fos.unwrap());
        assert!((fa - fb).abs() < 5e-3 * fa, "FS {fa} vs {fb}");
    }
}

// ------------------------------------------------------------------------------------------------------- E15m-8 (A-07)

/// A pile of Ito-Matsui in a model whose `units` is the given label (the numbers are the same).
fn ito_units(label: &str) -> Value {
    let mut doc = data("a01_arm_null");
    doc["units"] = json!(label);
    doc["reinforcements"][0]["spacing"] = json!(3.0);
    doc["reinforcements"][0]["y2"] = json!(0.0);
    doc["reinforcements"][0]["capacity"] = json!({"shear": 400.0, "moment": 900.0});
    doc
}

/// `"imp"` and `" IMPERIAL "` are imperial for the grid of the pressure too: the result is that of `"imperial"` (before:
/// the grid was 0.05 for them and 0.16404 for `"imperial"`, 8e-4 apart in Bishop).
#[test]
fn e15m8_imperial_labels_use_the_same_pressure_grid() {
    let reference = run(&ito_units("imperial"));
    for label in ["imp", " IMPERIAL ", "Imp."] {
        let report = run(&ito_units(label));
        for i in 0..reference.results.len() {
            let (a, b) = (
                report.results[i].fos.unwrap(),
                reference.results[i].fos.unwrap(),
            );
            assert!((a - b).abs() <= 1e-12, "{label}, method {i}: {a} vs {b}");
            for (f, g) in report.results[i]
                .reinforcement_forces
                .iter()
                .zip(&reference.results[i].reinforcement_forces)
            {
                assert!((f.available - g.available).abs() <= 1e-12 * g.available.abs().max(1.0));
            }
        }
    }
}
