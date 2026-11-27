//! R14, writer M3 (F5.14): E15n-1 (the crack at a step is evaluated on the side of the mass), E15n-2 (`soil_force` is
//! never `null`) and E15n-3 (`water_unit_weight_default` also on an invalid polyline). One section per amendment, each
//! starting with the tests that were RED before the correction. The documents are in `tests/data/f3gam/` (copies of
//! `docs/fase3/r12/repro/`, `r13/repro/` and `r14/repro/`; the descending steps are `escalon_desc_*`).
//!
//! cSlope values: `r13-coord-oracle.py` (`to_cslope`, fixed surface), cSlope 0.1.0.

mod f3_common;

use f3_common::{mirror, run};
use ogs_core::report::{AnalysisReport, CrackReport};
use serde_json::{Value, json};
use std::path::PathBuf;

fn data(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/data/f3gam")
        .join(format!("{name}.json"));
    serde_json::from_str(&std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{name}: {e}")))
        .expect("parses")
}

/// `mirror` of the helpers, plus the edges of the `udl`.
fn flip(doc: &Value) -> Value {
    let mut d = mirror(doc);
    if let Some(loads) = d.get_mut("loads").and_then(Value::as_array_mut) {
        for l in loads {
            let (x1, x2) = (l["x1"].as_f64().unwrap(), l["x2"].as_f64().unwrap());
            l["x1"] = json!(-x2);
            l["x2"] = json!(-x1);
        }
    }
    d
}

fn crack(report: &AnalysisReport, i: usize) -> CrackReport {
    report.results[i]
        .tension_crack
        .expect("the report has a crack")
}

fn fos(report: &AnalysisReport, i: usize) -> f64 {
    report.results[i].fos.expect("fos")
}

fn within(a: f64, b: f64, rel: f64) -> bool {
    (a - b).abs() <= rel * b.abs()
}

/// LTR and its mirror give the same crack and the same FS (≤ 1e-9) in both methods; returns the pair of reports.
fn assert_mirror(doc: &Value) -> (AnalysisReport, AnalysisReport) {
    let (a, b) = (run(doc), run(&flip(doc)));
    for i in 0..2 {
        let (ca, cb) = (crack(&a, i), crack(&b, i));
        assert!(
            (ca.x + cb.x).abs() <= 1e-9,
            "method {i}: x {} vs {}",
            ca.x,
            cb.x
        );
        assert!(
            (ca.depth - cb.depth).abs() <= 1e-9,
            "depth {} vs {}",
            ca.depth,
            cb.depth
        );
        assert!((ca.water_force - cb.water_force).abs() <= 1e-9);
        assert_eq!(
            ca.face_height.is_some(),
            cb.face_height.is_some(),
            "face_height {:?} vs {:?}",
            ca.face_height,
            cb.face_height
        );
        if let (Some(fa), Some(fb)) = (ca.face_height, cb.face_height) {
            assert!((fa - fb).abs() <= 1e-9, "face_height {fa} vs {fb}");
        }
        let (fa, fb) = (fos(&a, i), fos(&b, i));
        assert!((fa - fb).abs() <= 1e-9, "method {i}: FS {fa} vs {fb}");
    }
    (a, b)
}

// ------------------------------------------------------------------------------------------------------- E15n-1 (R14-01)

/// The RTL mirror of `a03_escalon_auto` (the file of the coordinator) gives the LTR result, `depth 2.616` and `Pw`
/// included, and is within 0.1 % of cSlope (before: `depth 0`, `Pw 0`, Bishop 1.911188, +2.6 %).
#[test]
fn e15n1_rtl_mirror_of_the_ascending_step_equals_the_ltr() {
    let rtl = run(&data("a03_escalon_auto_rtl"));
    let ltr = run(&data("a03_escalon_auto"));
    for (i, c_slope) in [(0, 1.8624155439610244), (1, 1.8608931982387384)] {
        let c = crack(&rtl, i);
        assert!(
            (c.depth - 2.6161426285291505).abs() < 1e-9,
            "depth {}",
            c.depth
        );
        let pw = 0.5 * 9.81 * c.depth * c.depth;
        assert!(
            (c.water_force - pw).abs() <= 1e-9 * pw,
            "Pw {}",
            c.water_force
        );
        assert!((c.x + 5.0).abs() < 1e-6, "{}", c.x);
        let face = c.face_height.expect("face_height is reported");
        assert!((face - 4.970675496255023).abs() < 1e-9, "{face}");
        let (a, b) = (fos(&rtl, i), fos(&ltr, i));
        assert!((a - b).abs() <= 1e-9, "method {i}: RTL {a} vs LTR {b}");
        assert!(
            within(a, c_slope, 1e-3),
            "method {i}: {a} vs cSlope {c_slope}"
        );
    }
}

/// Descending step 14 → 12 at `x = 5`, base 11.7 there: the ground on the side of the mass is 12 and the face 0.30.
/// With a `udl` `q = 100` on `[5, 15]` the mass-side `d` is 0: the crack is `depth 0` and cuts a face of 0.30 (before:
/// `face_height 2.30`, the crest that is discarded).
#[test]
fn e15n1_descending_step_with_udl_reports_the_real_face() {
    let (ltr, rtl) = assert_mirror(&data("desc_udl_ltr"));
    for report in [&ltr, &rtl] {
        for (i, c_slope) in [(0, 1.5876057914358583), (1, 1.586073089202144)] {
            let c = crack(report, i);
            assert_eq!((c.depth, c.water_force), (0.0, 0.0));
            let face = c.face_height.expect("face_height is reported");
            assert!((face - 0.30).abs() < 1e-9, "face_height {face}");
            let f = fos(report, i);
            assert!(
                within(f, c_slope, 1e-3),
                "method {i}: {f} vs cSlope {c_slope}"
            );
        }
    }
    assert!((crack(&ltr, 0).x - 5.0).abs() < 1e-6);
}

/// The pure descending step: the crack is where the mass-side ground is `d` over the base, not at the step (before, LTR:
/// `x_c = 5`, `depth 0`, `face_height 2.30`, Bishop 2.5317 against its RTL 2.4602).
#[test]
fn e15n1_pure_descending_step_is_symmetric_and_follows_cslope() {
    let (ltr, rtl) = assert_mirror(&data("desc_pure_ltr"));
    for report in [&ltr, &rtl] {
        for (i, c_slope) in [(0, 2.460247654911494), (1, 2.457751561705387)] {
            let c = crack(report, i);
            assert!(
                (c.depth - 2.6161426285291505).abs() < 1e-9,
                "depth {}",
                c.depth
            );
            assert!(c.face_height.is_none(), "a normal crack has no face_height");
            let f = fos(report, i);
            assert!(
                within(f, c_slope, 1e-3),
                "method {i}: {f} vs cSlope {c_slope}"
            );
        }
    }
}

/// Descending step with `c = 15 → 1` at the step: the material is the one of the mass side (`c = 1`), `d = 0.1744`,
/// the face is 0.30, and LTR and RTL agree (before: LTR `depth 0`, `face_height 2.30`, Bishop 1.7539 vs RTL 1.7534).
#[test]
fn e15n1_descending_step_with_a_lateral_change_is_symmetric() {
    let (ltr, rtl) = assert_mirror(&data("desc_lateral_ltr"));
    for report in [&ltr, &rtl] {
        let c = crack(report, 0);
        assert!(
            (c.depth - 0.17440950856861004).abs() < 1e-9,
            "depth {}",
            c.depth
        );
        let pw = 0.5 * 9.81 * c.depth * c.depth;
        assert!((c.water_force - pw).abs() <= 1e-9 * pw);
        let face = c.face_height.expect("face_height is reported");
        assert!((face - 0.30).abs() < 1e-9, "face_height {face}");
    }
    // cSlope (0.1.0, fixed surface): 1.7538893233306418 / 1.7529593560897654.
    for (i, c_slope) in [(0, 1.7538893233306418), (1, 1.7529593560897654)] {
        let f = fos(&ltr, i);
        println!(
            "lateral change, method {i}: {f} vs cSlope {c_slope}: {:+.5} %",
            100.0 * (f / c_slope - 1.0)
        );
        assert!(
            within(f, c_slope, 1e-3),
            "method {i}: {f} vs cSlope {c_slope}"
        );
    }
}

/// A descending step whose real face is `1e-11 < tol`: nothing is cut and no face is reported, in both senses.
#[test]
fn e15n1_descending_step_with_a_face_under_tol_cuts_nothing() {
    let mut doc = data("desc_udl_ltr");
    doc["regions"][0]["polygon"][3] = json!([5, 11.7 + 1e-11]);
    doc["regions"][0]["polygon"][4] = json!([15, 11.7 + 1e-11]);
    let (ltr, _) = assert_mirror(&doc);
    for i in 0..2 {
        let c = crack(&ltr, i);
        assert_eq!((c.depth, c.water_force), (0.0, 0.0));
        assert!(c.face_height.is_none(), "face_height {:?}", c.face_height);
    }
}

/// `a04_udl` and `a03_escalon_fija` do not change (the same figures as `f3g8m_r13.rs`).
#[test]
fn e15n1_udl_and_fixed_step_do_not_change() {
    let udl = run(&data("a04_udl"));
    assert!((fos(&udl, 0) - 1.102248).abs() <= 1e-6, "{}", fos(&udl, 0));
    let c = crack(&udl, 0);
    assert!((c.x + 66.5).abs() < 1e-9 && c.depth == 0.0, "{c:?}");
    let fixed = run(&data("a03_escalon_fija"));
    assert!((fos(&fixed, 0) - 1.8820658923047255).abs() <= 1e-9);
    let ltr = run(&data("a03_escalon_auto"));
    assert!((fos(&ltr, 0) - 1.862343167015826).abs() <= 1e-9);
}

// ------------------------------------------------------------------------------------------------------- E15n-2 (R14-02)

/// R14-02: `spacing = 0.40091756815052138`, `diameter = 0.4`, `capacity`: `soil_per_pile / spacing` overflowed to `∞` and
/// was serialized as `null`. The analysis ends with the error of E15l-11 or every `soil_force` is finite (before: Bishop
/// converged with `"soil_force": null`).
#[test]
fn e15n2_a_huge_soil_force_is_never_null() {
    let doc = data("r14_02_soil_force_null");
    let model: ogs_core::model::Model = serde_json::from_value(doc).unwrap();
    match ogs_core::analyze(&model) {
        Err(e) => {
            let text = e.to_string();
            assert!(
                text.starts_with("InvalidModel: reinforcements[0].lateral_pressure: la presión de Ito-Matsui no es finita con S/D = ")
                    && text.ends_with("aumente spacing"),
                "{text}"
            );
        }
        Ok(report) => {
            for r in &report.results {
                for f in &r.reinforcement_forces {
                    assert!(
                        f.soil_force.is_some_and(f64::is_finite),
                        "soil_force {:?}",
                        f.soil_force
                    );
                    assert!(f.arm.is_some_and(f64::is_finite));
                }
            }
        }
    }
}

// ------------------------------------------------------------------------------------------------------- E15n-3 (R14-04)

const DEFAULT_GAMMA_W: &str = "water_unit_weight_default";
const NO_CROSSING: &str = "polyline_no_ground_crossing";

/// `a03` as an imperial model with a piezometric line (no `water.unit_weight`) and a polyline surface that never meets
/// the ground (`Invalid`: the early return).
fn invalid_polyline(units: &str) -> Value {
    let mut doc = data("a03_escalon_fija");
    doc["units"] = json!(units);
    doc["analysis"]["methods"] = json!(["spencer", "janbu_simplified"]);
    doc["analysis"]
        .as_object_mut()
        .unwrap()
        .remove("tension_crack");
    doc["analysis"]["surface"] =
        json!({"type": "polyline", "points": [[0, 20], [5, 21], [10, 22]]});
    doc["water"] = json!({"piezometric_line": [[-10, 0], [45, 0]]});
    doc
}

fn count(report: &AnalysisReport, i: usize, code: &str) -> usize {
    report.results[i]
        .warnings
        .iter()
        .filter(|w| w.as_str() == code)
        .count()
}

/// An invalid polyline in an imperial model with water and no `water.unit_weight` keeps the note (before: only
/// `polyline_no_ground_crossing`).
#[test]
fn e15n3_invalid_polyline_emits_the_default_water_note() {
    for label in ["imperial", "imp", " IMPERIAL "] {
        let report = run(&invalid_polyline(label));
        for i in 0..2 {
            assert_eq!(count(&report, i, NO_CROSSING), 1, "{label}, method {i}");
            assert_eq!(count(&report, i, DEFAULT_GAMMA_W), 1, "{label}, method {i}");
        }
    }
    // Water in the crack only.
    let mut doc = invalid_polyline("imperial");
    doc.as_object_mut().unwrap().remove("water");
    doc["analysis"]["tension_crack"] = json!({"depth": 2.0, "water_fill": 1.0});
    assert_eq!(count(&run(&doc), 0, DEFAULT_GAMMA_W), 1);
}

/// The criterion is declarative and the early return follows it: no note in SI, with `water.unit_weight`, without water
/// or with a dry crack.
#[test]
fn e15n3_invalid_polyline_has_no_note_without_the_condition() {
    let si = run(&invalid_polyline("SI"));
    let mut declared = invalid_polyline("imperial");
    declared["water"]["unit_weight"] = json!(62.4);
    let mut dry = invalid_polyline("imperial");
    dry.as_object_mut().unwrap().remove("water");
    for report in [&si, &run(&declared), &run(&dry)] {
        for i in 0..2 {
            assert_eq!(count(report, i, DEFAULT_GAMMA_W), 0);
            assert_eq!(count(report, i, NO_CROSSING), 1);
        }
    }
}

/// The note is also given when the calculation does not use `γw` (`c = 0` with a full crack: `depth 0`), because it
/// warns about a missing datum of the model (E15n-3, declarative criterion).
#[test]
fn e15n3_the_note_is_declarative() {
    let mut doc = data("a03_escalon_auto");
    doc["units"] = json!("imperial");
    doc["materials"][0]["cohesion"] = json!(0.0);
    let report = run(&doc);
    assert_eq!(crack(&report, 0).depth, 0.0);
    assert_eq!(count(&report, 0, DEFAULT_GAMMA_W), 1);
}
