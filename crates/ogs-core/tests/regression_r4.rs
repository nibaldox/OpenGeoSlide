//! Regression tests for the R4 review (docs/reviews/R4_agy.md), slicer side (W11, contract E11e′).
//!
//! Each test uses the counterexample of its finding, with the exact data of the review where it gives them.

use ogs_core::analyze;
use ogs_core::geometry::PreparedModel;
use ogs_core::methods::SolveStatus;
use ogs_core::model::{Circle, Model};
use ogs_core::slicer::slice_surface;
use serde_json::{Value, json};

/// Driving-block warning of E11e′.
const TRUNCATED_DRIVING_MASS: &str = "truncated_driving_mass";
/// Informative note of E10a.
const TRUNCATED_MASS: &str = "truncated_mass";

fn material(id: &str, c: f64, phi: f64, gamma: f64) -> Value {
    json!({
        "id": id, "name": id, "model": "mohr_coulomb",
        "unit_weight": gamma, "cohesion": c, "friction_angle": phi
    })
}

fn model(materials: Vec<Value>, regions: Vec<Value>, direction: &str, analysis: Value) -> Model {
    let doc = json!({
        "format": "opengeoslide", "version": "0.1", "meta": {"id": "R4"}, "units": "SI",
        "materials": materials, "regions": regions,
        "slope": {"direction": direction}, "analysis": analysis
    });
    serde_json::from_value(doc).expect("test model is a valid .ogs.json document")
}

fn region(material: &str, polygon: Value) -> Value {
    json!({"material": material, "polygon": polygon})
}

fn fixed(methods: &[&str], circle: (f64, f64, f64)) -> Value {
    json!({
        "methods": methods, "slices": 50, "tolerance": 1e-8,
        "max_iterations": 2000, "min_m_alpha": 0.2,
        "surface": {"type": "circle", "xc": circle.0, "yc": circle.1, "r": circle.2}
    })
}

fn prepared(m: &Model) -> PreparedModel {
    PreparedModel::new(m).expect("valid model")
}

/// The D09 differential model, as the oracle runs it (verification/differential/cases/D09.ogs.json).
const D09_MODEL: &str = include_str!("../../../verification/differential/cases/D09.ogs.json");

/// The D09 model with its search and one method. The toe lens is cut by the wall `x = 0`.
fn d09_search(method: &str) -> Model {
    let mut value: Value = serde_json::from_str(D09_MODEL).expect("D09 model is valid JSON");
    value["analysis"]["methods"] = json!([method]);
    serde_json::from_value(value).expect("D09 search model")
}

/// R4-04. In the search on D09, the foot lens is clipped by the wall `x = 0`, so its driving sum is an artefact of the
/// clipping. It must not raise `truncated_driving_mass`; the note `truncated_mass` stays. The FS values are those of
/// the commit before E11e′ (HEAD 89f1bfe, with the case's own settings): the notes do not change the FS.
#[test]
fn r4_04_d09_search_does_not_raise_truncated_driving_mass() {
    for (method, fos_before) in [
        ("bishop", 0.3307295928067804),
        ("spencer", 0.38755542342271615),
    ] {
        let report = analyze(&d09_search(method)).expect("valid");
        let r = &report.results[0];
        assert_eq!(r.status, SolveStatus::Converged, "{method}: {r:?}");
        let fos = r.fos.expect("finite");
        assert!(
            (fos - fos_before).abs() <= 1e-9 * fos_before,
            "{method}: FS {fos} vs {fos_before}"
        );
        assert!(
            !r.warnings.iter().any(|w| w == TRUNCATED_DRIVING_MASS),
            "{method}: {:?}",
            r.warnings
        );
        assert!(
            r.warnings.iter().any(|w| w == TRUNCATED_MASS),
            "{method}: {:?}",
            r.warnings
        );
    }
}

/// R4-04, slicer level: the cSlope circle of D09 leaves through `x = 0` inside the discarded lens. The lens is not
/// classified, so the note is `truncated_mass`.
#[test]
fn r4_04_d09_lens_clipped_by_the_wall_is_a_note() {
    let m = d09_search("spencer");
    let pm = prepared(&m);
    let c = Circle {
        xc: 1.302373757508704,
        yc: 55.1690164837531,
        r: 42.44024115833943,
    };
    let sliced = slice_surface(&pm, &c, 2000).expect("valid (E10a′)");
    assert_eq!(sliced.notes, vec![TRUNCATED_MASS.to_string()]);
}

/// R4-03b. A 70 m bench over a 10 m bench (exact data of the review; γ = 25 kN/m³ upper, 20 lower, which reproduces the
/// review's Σ W·sin α = 23506.1 of the analysed block). The lower bench is unstable (FS 0.8156) with 0.36 % of the
/// driving sum of the analysed block, below the old 5 % threshold. Under E11e′ it is judged on its own weight:
/// `truncated_driving_mass`.
#[test]
fn r4_03b_small_unstable_lower_bench_raises_truncated_driving_mass() {
    let m = model(
        vec![
            material("upper", 200.0, 40.0, 25.0),
            material("lower", 2.0, 10.0, 20.0),
        ],
        vec![
            region("upper", json!([[0, 10], [0, 80], [30, 80], [60, 10]])),
            region(
                "lower",
                json!([[0, -15], [0, 10], [75, 10], [85, 0], [110, 0], [110, -15]]),
            ),
        ],
        "auto",
        fixed(&["bishop", "spencer"], (105.0, 105.0, 102.0)),
    );
    let pm = prepared(&m);
    let c = Circle {
        xc: 105.0,
        yc: 105.0,
        r: 102.0,
    };
    let sliced = slice_surface(&pm, &c, 50).expect("valid surface");
    assert_eq!(sliced.notes, vec![TRUNCATED_DRIVING_MASS.to_string()]);

    let report = analyze(&m).expect("valid");
    let bishop = &report.results[0];
    assert_eq!(bishop.status, SolveStatus::Converged, "{bishop:?}");
    // FS of the commit before E11e′ at tolerance 1e-8 (the review's 1.4976 is the same block at tolerance 1e-5).
    let fos = bishop.fos.expect("finite");
    assert!(
        (fos - 1.49762996035602).abs() <= 1e-9 * 1.49762996035602,
        "Bishop FS {fos} vs 1.4976300 (analysed block of the review)"
    );
    for r in &report.results {
        assert!(
            r.warnings.iter().any(|w| w == TRUNCATED_DRIVING_MASS),
            "{:?}: {:?}",
            r.method,
            r.warnings
        );
    }
}

/// R3-03c. The rajo with the fixed circle (53; 46.5; 45): the discarded block is driving and does not touch a wall, so
/// it keeps `truncated_driving_mass` under E11e′ (the same model as `r3_03c` in regression_r3_geometry.rs).
#[test]
fn r3_03c_rajo_fixed_circle_keeps_truncated_driving_mass() {
    let m = model(
        vec![
            material("upper", 60.0, 40.0, 25.0),
            material("lower", 3.0, 15.0, 20.0),
        ],
        vec![
            region("upper", json!([[0, 12], [0, 30], [10, 30], [23, 12]])),
            region(
                "lower",
                json!([[0, -10], [0, 12], [36, 12], [46, 0], [70, 0], [70, -10]]),
            ),
        ],
        "auto",
        fixed(&["bishop"], (53.0, 46.5, 45.0)),
    );
    let pm = prepared(&m);
    let c = Circle {
        xc: 53.0,
        yc: 46.5,
        r: 45.0,
    };
    let sliced = slice_surface(&pm, &c, 50).expect("valid surface (E10a)");
    assert_eq!(sliced.notes, vec![TRUNCATED_DRIVING_MASS.to_string()]);
    let report = analyze(&m).expect("valid");
    let r = &report.results[0];
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    assert!(
        r.warnings.iter().any(|w| w == TRUNCATED_DRIVING_MASS),
        "{:?}",
        r.warnings
    );
}
