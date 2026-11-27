//! R12, writer M-A (F5.12): the ponded water of the engine. E15l-4 (one slice for each vertical face), E15l-5 (the
//! warning `water_above_ground` with the ponded terms) and the rows of E15l-10 live next to the tests of `f3g5a_crack`.

mod f3_common;

use f3_common::run;
use ogs_core::report::AnalysisReport;
use serde_json::{Value, json};

/// The dam of B-03: a vertical face at `x = 20` from `y = 2` to `y = 14`, a reservoir at `y = 10` on the low side and a
/// circle that leaves the model through the face (the mass is on the high side, `x ≥ 20`). `depth` is how far under the
/// toe the model goes: a deep model has a large `scale` and a wide `wall_tol = 1e-7·scale` (A-03).
fn dam(depth: f64, loads: Value) -> Value {
    json!({
        "format": "opengeoslide", "version": "0.5", "units": "SI",
        "materials": [{"id": "s", "name": "s", "model": "mohr_coulomb", "unit_weight": 20.0,
                       "cohesion": 10.0, "friction_angle": 25.0}],
        "regions": [{"material": "s",
                     "polygon": [[0, -depth], [0, 2], [20, 2], [20, 14], [40, 14], [40, -depth]]}],
        "slope": {"direction": "right_to_left"},
        "water": {"piezometric_line": [[0, 10], [40, 10]]},
        "loads": loads,
        "analysis": {"methods": ["bishop", "spencer"], "slices": 50, "tolerance": 1e-9,
                     "surface": {"type": "circle", "xc": 19.0, "yc": 18.0, "r": 13.0}}
    })
}

fn sum_h(report: &AnalysisReport, i: usize) -> f64 {
    report.results[i].slices.iter().map(|s| s.h_force).sum()
}

fn has_warning(report: &AnalysisReport, code: &str) -> bool {
    report
        .results
        .iter()
        .all(|r| r.warnings.iter().any(|w| w == code))
}

// ------------------------------------------------------------------------------------------------------- E15l-4 (A-03)

/// A line load 5e-6 from the face puts a node (and so a second edge) within `wall_tol` of it: the thrust of the face
/// is applied to one slice, never to both. `Σ h_force` does not change (a vertical load has no horizontal part).
#[test]
fn e15l4_a_node_beside_the_face_does_not_double_the_thrust() {
    let plain = run(&dam(1000.0, json!([])));
    let loaded = run(&dam(
        1000.0,
        json!([{"type": "line", "id": "l1", "x": 20.000005, "p": 1.0}]),
    ));
    // The node really is a second edge within wall_tol (1e-7·scale ≈ 1e-4): the slices are [20, 20.000045], …
    let edges: Vec<f64> = loaded.results[0].slices.iter().map(|s| s.x_left).collect();
    assert!(edges[1] - edges[0] < 1e-4, "{edges:?}");
    for i in 0..2 {
        let (a, b) = (sum_h(&plain, i), sum_h(&loaded, i));
        assert!(a.abs() > 100.0, "the face pushes: {a}");
        assert!((a - b).abs() <= 1e-9 * a.abs(), "method {i}: {a} vs {b}");
    }
}

// ------------------------------------------------------------------------------------------------------- E15l-5 (A-09, B-03)

/// B-03: the dam, whose only ponded term is the thrust on the face (the line is under the crest of the ground at the
/// face and at every slice), emits `water_above_ground`.
#[test]
fn e15l5_dam_with_only_the_face_thrust_warns() {
    let report = run(&dam(0.0 + 14.0, json!([])));
    assert!(sum_h(&report, 0).abs() > 100.0);
    assert!(
        has_warning(&report, "water_above_ground"),
        "{:?}",
        report.results[0].warnings
    );
}

/// A-09: a vertical face at `x = 10` (`y` from 0 to 10), water at `y = 8` on the low side and the whole mass on the high
/// side. The thrust is applied (320 kN/m on the face) and the warning is emitted.
#[test]
fn e15l5_a09_wall_warns() {
    let doc = json!({
        "format": "opengeoslide", "version": "0.5", "units": "SI",
        "materials": [{"id": "s", "name": "s", "model": "mohr_coulomb", "unit_weight": 20.0,
                       "cohesion": 10.0, "friction_angle": 25.0}],
        "regions": [{"material": "s",
                     "polygon": [[0, -5], [0, 0], [10, 0], [10, 10], [30, 10], [30, -5]]}],
        "slope": {"direction": "right_to_left"},
        "water": {"piezometric_line": [[0, 8], [30, 8]]},
        "analysis": {"methods": ["bishop"], "slices": 50, "tolerance": 1e-9,
                     "surface": {"type": "circle", "xc": 12.0, "yc": 14.0, "r": 11.0}}
    });
    let report = run(&doc);
    let h = sum_h(&report, 0);
    assert!(h.abs() > 100.0, "{h}");
    assert!(
        has_warning(&report, "water_above_ground"),
        "{:?}",
        report.results[0].warnings
    );
}

/// The criterion that was there stays, and a model without water does not get the warning.
#[test]
fn e15l5_no_water_no_warning() {
    let mut doc = dam(14.0, json!([]));
    doc.as_object_mut().unwrap().remove("water");
    let report = run(&doc);
    assert!(
        !report
            .results
            .iter()
            .any(|r| r.warnings.iter().any(|w| w == "water_above_ground"))
    );
    // The line under the ground everywhere (and no face above it): nothing is ponded, no warning either.
    let mut under = dam(14.0, json!([]));
    under["water"] = json!({"piezometric_line": [[0, 1.0], [40, 1.0]]});
    let report = run(&under);
    assert!(
        !report
            .results
            .iter()
            .any(|r| r.warnings.iter().any(|w| w == "water_above_ground"))
    );
}
