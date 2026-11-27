//! R13, writer M2 (F5.13, E15m-15): the crack over a discontinuity of `d(x)` takes the depth and the water of `d(x_c)`
//! (the convention of cSlope, the one before R12), and the report adds `face_height` when the face that the crack cuts
//! is not the depth. Reproductions in `tests/data/f3g8m/` (copies of `docs/fase3/r12/repro/` and `r13/repro/`).
//! cSlope values: `r13-coord-oracle.py` (`to_cslope`, fixed surface), cSlope 0.1.0.

mod f3_common;

use f3_common::run;
use ogs_core::report::AnalysisReport;
use serde_json::{Value, json};
use std::path::PathBuf;

fn data(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/data/f3g8m")
        .join(format!("{name}.json"));
    serde_json::from_str(&std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{name}: {e}")))
        .expect("parses")
}

fn crack(report: &AnalysisReport, i: usize) -> ogs_core::report::CrackReport {
    report.results[i]
        .tension_crack
        .expect("the report has a crack")
}

fn within(a: f64, b: f64, rel: f64) -> bool {
    (a - b).abs() <= rel * b.abs()
}

/// `a04_udl`: the `udl` cancels `d(x)` at its edge. The crack is `depth 0`, `Pw 0` (no cut, as before R12 and as
/// cSlope) and the report says that the mass meets a face of 1.7827 m. Before: `depth 1.7827`, `Pw 15.59`, Bishop
/// 1.095348 (−0.63 % from cSlope 1.1023105).
#[test]
fn e15m15_udl_edge_follows_cslope_and_reports_the_face() {
    let report = run(&data("a04_udl"));
    let c = crack(&report, 0);
    assert!((c.x + 66.5).abs() < 1e-9, "{}", c.x);
    assert_eq!((c.depth, c.water_force), (0.0, 0.0));
    let face = c.face_height.expect("face_height is reported");
    assert!((face - 1.7827).abs() < 1e-4, "{face}");
    let bishop = report.results[0].fos.unwrap();
    assert!((bishop - 1.102248).abs() <= 1e-6, "Bishop {bishop}");
    assert!(within(bishop, 1.1023105124052142, 1e-3), "{bishop}");
    let spencer = report.results[1].fos.unwrap();
    assert!(within(spencer, 1.1009410561755753, 1e-3), "{spencer}");
}

/// `a03_escalon_auto`: the bisection ends at the vertical step; `d(x_c)` = 2.616 is the depth and the water, and the
/// face over the base seen from the mass is 4.9707. Before: `depth 4.9707`, `Pw 121.19`, Bishop 1.751144 (−6.0 %).
#[test]
fn e15m15_step_with_auto_follows_cslope_and_reports_the_face() {
    let report = run(&data("a03_escalon_auto"));
    let c = crack(&report, 0);
    assert!((c.x - 5.0).abs() < 1e-6, "{}", c.x);
    assert!((c.depth - 2.6161).abs() < 1e-3, "{}", c.depth);
    let pw = 0.5 * 9.81 * c.depth * c.depth;
    assert!((c.water_force - pw).abs() <= 1e-9 * pw, "{}", c.water_force);
    let face = c.face_height.expect("face_height is reported");
    assert!((face - 4.970675496255023).abs() < 1e-9, "{face}");
    let bishop = report.results[0].fos.unwrap();
    assert!((bishop - 1.86234).abs() <= 1e-5, "Bishop {bishop}");
    assert!(within(bishop, 1.8624155439610244, 1e-3), "{bishop}");
    let spencer = report.results[1].fos.unwrap();
    assert!(within(spencer, 1.8608931982387384, 1e-3), "{spencer}");
}

/// `a03_escalon_fija` does not change (E15m-1): `depth 2`, `Pw 19.62`, Bishop 1.882066; and within 0.1 % of cSlope.
#[test]
fn e15m15_fixed_depth_at_the_step_does_not_change() {
    let report = run(&data("a03_escalon_fija"));
    let c = crack(&report, 0);
    assert_eq!(c.depth, 2.0);
    assert!((c.water_force - 19.62).abs() < 1e-9);
    let bishop = report.results[0].fos.unwrap();
    assert!((bishop - 1.8820658923047255).abs() <= 1e-9, "{bishop}");
    assert!(within(bishop, 1.8821380430910337, 1e-3), "{bishop}");
    // The fixed crack is cut where the ground is 2 m over the base, which is not the face at the step.
    let face = c.face_height.expect("the face of the step is reported");
    assert!((face - 4.970675496255023).abs() < 1e-9, "{face}");
}

/// `face_height` is omitted from the output of a crack whose face is its depth (the normal crack), so that its output
/// does not change; and it is serialized when reported.
#[test]
fn e15m15_face_height_is_omitted_for_a_normal_crack() {
    let mut doc = data("a03_escalon_fija");
    // Crest at the same level on both sides of the former step: a plain flat crest and a fixed depth.
    doc["regions"][0]["polygon"] =
        json!([[-10, -5], [-10, 14], [15, 14], [30, 2], [45, 2], [45, -5]]);
    let report = run(&doc);
    let c = crack(&report, 0);
    assert_eq!(c.face_height, None, "{c:?}");
    assert_eq!(c.depth, 2.0);
    let out = serde_json::to_value(&report).unwrap();
    assert!(
        out["results"][0]["tension_crack"]
            .get("face_height")
            .is_none()
    );
    // And with auto on the same flat crest: d(x) is continuous, no face_height either.
    doc["analysis"]["tension_crack"]["depth"] = json!("auto");
    let report = run(&doc);
    assert_eq!(crack(&report, 0).face_height, None);
    // With a discontinuity the key is there.
    let out = serde_json::to_value(run(&data("a04_udl"))).unwrap();
    let key = &out["results"][0]["tension_crack"]["face_height"];
    assert!((key.as_f64().unwrap() - 1.7827).abs() < 1e-4, "{key}");
}

/// The case without a face (a `udl` that starts 1e-10 inside the entry) keeps E15l-2: no crack, no cut, and it is
/// the same as the model without a crack; it agrees with cSlope too (Bishop 1.0632531 here vs 1.0632227 of the engine).
#[test]
fn e15m15_no_face_case_stays_without_crack_and_agrees_with_cslope() {
    let mut plain = data("a04_udl");
    plain["analysis"]
        .as_object_mut()
        .unwrap()
        .remove("tension_crack");
    plain["loads"] = json!([]);
    let entry = run(&plain).results[0].slices.last().unwrap().x_left;
    let mut doc = data("a04_udl");
    doc["loads"] =
        json!([{"type": "udl", "id": "u1", "x1": entry + 1e-10, "x2": -55.0, "q": 100.0}]);
    let report = run(&doc);
    let c = crack(&report, 0);
    assert_eq!((c.depth, c.water_force), (0.0, 0.0));
    assert_eq!(c.face_height, None, "{c:?}");
    let bishop = report.results[0].fos.unwrap();
    assert!(within(bishop, 1.0632530544532388, 1e-3), "{bishop}");
    let spencer = report.results[1].fos.unwrap();
    assert!(within(spencer, 1.061519753860607, 1e-3), "{spencer}");
}
