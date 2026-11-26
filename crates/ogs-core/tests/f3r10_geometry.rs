//! R10, writer M2: geometry and polyline (amendments E13l-5, E13l-6 and E13l-7 of `briefs/02_CONTRATOS_FASE3.md`).
//!
//! - E13l-5 (R10A-04): the base of a slice on a contact of two materials takes the weaker one;
//! - E13l-6 (R10A-05, R10A-09): 2D distance at the ends of a polyline, vertices before loads and merges, the strength of
//!   a vertical face on a vertical contact;
//! - E13l-7 (R10B-05): `report.surface` of a truncated polyline is cut to the analysed range.
//!
//! Every reference value of cSlope 0.1.0 below was computed with `verification/harness/to_cslope.py` on the same
//! model (see the comment of each test).

mod f3_common;

use f3_common::*;
use ogs_core::methods::SolveStatus;
use ogs_core::report::MethodReport;
use serde_json::{Value, json};

fn result(doc: &Value, i: usize) -> MethodReport {
    run(doc).results.remove(i)
}

fn fos_of(doc: &Value, i: usize) -> f64 {
    let r = result(doc, i);
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    r.fos.unwrap()
}

/// Two layers, `top` (c = 20, φ = 30°) over `bot` (c = 2, φ = 10°) with the contact at `y = 10`, under a ground that
/// rises from `(0, 18)` to `(30, 30)` and is flat after that. The slope goes down toward the left.
fn bilayer(points: &[[f64; 2]], methods: Value) -> Value {
    json!({
        "format": "opengeoslide", "version": "0.3",
        "meta": {"id": "R10A-04", "title": "bicapa"},
        "units": "SI",
        "materials": [
            {"id": "top", "name": "top", "model": "mohr_coulomb", "unit_weight": 19.0, "cohesion": 20.0,
             "friction_angle": 30.0, "ru": null},
            {"id": "bot", "name": "bot", "model": "mohr_coulomb", "unit_weight": 19.0, "cohesion": 2.0,
             "friction_angle": 10.0, "ru": null}
        ],
        "regions": [
            {"material": "top", "polygon": [[0, 10], [0, 18], [30, 30], [40, 30], [40, 10]]},
            {"material": "bot", "polygon": [[0, 0], [0, 10], [40, 10], [40, 0]]}
        ],
        "water": {"unit_weight": 9.807},
        "slope": {"direction": "right_to_left"},
        "analysis": {"methods": methods, "slices": 50, "tolerance": 1e-5, "max_iterations": 500,
                     "min_m_alpha": 0.2,
                     "surface": {"type": "polyline", "points": points}}
    })
}

// ---------------------------------------------------------------------------------------------------------------
// E13l-5: base on a contact of materials

/// R10A-04: a polyline whose flat stretch runs along the top of the weak layer is analysed in the weak layer.
///
/// cSlope 0.1.0 (same model, `janbu_corrected`, fixed polyline): 4.112915.
/// The engine of the base gave 4.870764 (+18.4 %), the strength of the strong layer on the whole stretch.
#[test]
fn polyline_along_a_contact_takes_the_weaker_material_e13l5() {
    let doc = bilayer(
        &[[5.0, 20.0], [12.0, 10.0], [22.0, 10.0], [30.0, 30.0]],
        json!(["janbu_corrected"]),
    );
    let r = result(&doc, 0);
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let on_contact: Vec<_> = r
        .slices
        .iter()
        .filter(|s| s.y_base_left == 10.0 && s.y_base_right == 10.0)
        .collect();
    assert!(!on_contact.is_empty());
    assert!(
        on_contact
            .iter()
            .all(|s| s.material == 1 && s.cohesion == 2.0),
        "the base on the contact must take the weak material `bot`: {on_contact:?}"
    );
    let fos = r.fos.unwrap();
    assert!(
        (fos - 4.112915).abs() / 4.112915 < 1e-3,
        "cSlope gives 4.112915, the engine {fos}"
    );
}

/// A surface just inside the weak layer is the limit that the contact rule approaches.
#[test]
fn polyline_on_the_contact_equals_one_just_inside_the_weak_layer_e13l5() {
    let on = fos_of(
        &bilayer(
            &[[5.0, 20.0], [12.0, 10.0], [22.0, 10.0], [30.0, 30.0]],
            json!(["janbu_corrected"]),
        ),
        0,
    );
    let inside = fos_of(
        &bilayer(
            &[
                [5.0, 20.0],
                [12.0, 9.9999999],
                [22.0, 9.9999999],
                [30.0, 30.0],
            ],
            json!(["janbu_corrected"]),
        ),
        0,
    );
    assert!(
        (on - inside).abs() / inside < 1e-3,
        "on the contact {on}, just inside {inside}"
    );
}
