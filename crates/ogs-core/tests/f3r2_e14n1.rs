//! F3R-R2 (I1b), E14n-1: the classification of the negative effective normal forces adds the thin slice of a
//! reinforcement crossing to the slice before and the slice after it. Criterion 3 of F4.17: a real tension on slices of
//! a normal width keeps the major warning; the artifact of a point force on a base of 1e-4 m does not.

mod f3_common;

use f3_common::*;
use serde_json::{Value, json};

fn model(x: f64, angle: f64, force: f64) -> Value {
    json!({
        "format": "opengeoslide", "version": "0.4",
        "meta": {"id": "e14n1", "title": "active pile pulling the mass up"},
        "units": "SI",
        "materials": [{"id": "s", "name": "s", "model": "mohr_coulomb", "unit_weight": 18.0, "cohesion": 5.0, "friction_angle": 25.0}],
        "regions": [{"material": "s", "polygon": [[-6.0, 0.0], [-6.0, 6.0], [6.0, 6.0], [8.7, 15.0], [24.0, 15.0], [24.0, 0.0]]}],
        "reinforcements": [{"id": "P1", "type": "pile", "x1": x, "y1": 14.0, "x2": x, "y2": -5.0, "application": "active",
                            "force": force, "direction": "angle", "angle": angle, "spacing": 1.0}],
        "slope": {"direction": "right_to_left"},
        "analysis": {
            "methods": ["bishop", "spencer"], "slices": 10, "tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2,
            "surface": {"type": "circle", "xc": 4.658, "yc": 15.0, "r": 10.934}
        }
    })
}

fn warnings(doc: &Value, i: usize) -> Vec<String> {
    run(doc).results[i].warnings.clone()
}

fn has(w: &[String], code: &str) -> bool {
    w.iter().any(|c| c == code)
}

/// 400 kN/m at 80° from the horizontal, over slices of 1.7 m: the weight of a slice is 40 to 200 kN, so the force
/// lifts the mass and the normal of the slice (and of its neighbours) is negative: the major warning stays.
#[test]
fn a_real_tension_on_slices_of_normal_width_keeps_the_major_warning() {
    let doc = model(6.0, 80.0, 400.0);
    for i in 0..2 {
        let w = warnings(&doc, i);
        assert!(
            has(&w, "negative_effective_normal_major"),
            "method {i}: {w:?}"
        );
    }
}

/// 100 kN/m at 80° at x = 9 crosses where the slices weigh more than the force: the only negative normal was the one of
/// the thin slice (base 1e-4 m, W 0.005 kN), and with its neighbours the sum is positive: no note.
#[test]
fn the_point_force_on_a_thin_slice_is_not_a_negative_normal() {
    let doc = model(9.0, 80.0, 100.0);
    for i in 0..2 {
        let w = warnings(&doc, i);
        assert!(
            !has(&w, "negative_effective_normal_major") && !has(&w, "negative_effective_normal"),
            "method {i}: {w:?}"
        );
    }
}

/// The model of a published case of `verification` (`cases/` or, when held, `pending/F3R/`), with its methods replaced.
fn published(id: &str, methods: Value, reinforced: bool) -> Value {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../verification");
    let path = [root.join("cases"), root.join("pending/F3R")]
        .into_iter()
        .map(|d| d.join(format!("{id}.json")))
        .find(|p| p.is_file())
        .unwrap_or_else(|| panic!("{id}.json is neither in cases/ nor in pending/F3R/"));
    let case: Value = serde_json::from_str(&std::fs::read_to_string(&path).expect("case file"))
        .expect("case json");
    let mut doc = case["model"].clone();
    doc["analysis"]["methods"] = methods;
    if !reinforced {
        doc["reinforcements"] = json!([]);
    }
    doc
}

/// V014 (Caltrans nailed wall, 14 rows): the negative normals of Janbu corrected were 8 slices of 7.6e-5 m that carry
/// the point force of a crossing, with the neighbours the sum is positive: no note. Without nails there was none either.
#[test]
fn v014_janbu_corrected_has_no_negative_normal_warning_with_the_nails() {
    let doc = published("V014", json!(["janbu_corrected", "spencer"]), true);
    for i in 0..2 {
        let w = warnings(&doc, i);
        assert!(
            !has(&w, "negative_effective_normal_major") && !has(&w, "negative_effective_normal"),
            "method {i}: {w:?}"
        );
    }
    let bare = published("V014", json!(["janbu_corrected"]), false);
    assert!(!has(&warnings(&bare, 0), "negative_effective_normal_major"));
}

/// V035b (Bishop) and V083 (Janbu corrected): the negative normals are on slices of 0.133 m and 0.126 m. They are the
/// same with E14n-1 and without it, and the model without reinforcements has the warning too (FS 0.929 and 0.834): a real
/// tension of the model, not the artifact of a crossing. The warning stays.
#[test]
fn v035b_and_v083_keep_the_major_warning_because_the_tension_is_the_model_s() {
    for (id, method, bare_fos) in [
        ("V035b", "bishop", 0.929),
        ("V083", "janbu_corrected", 0.834),
    ] {
        let with = published(id, json!([method]), true);
        let w = warnings(&with, 0);
        assert!(
            has(&w, "negative_effective_normal_major"),
            "{id} with reinforcements: {w:?}"
        );
        let bare = published(id, json!([method]), false);
        let w = warnings(&bare, 0);
        assert!(
            has(&w, "negative_effective_normal_major"),
            "{id} without reinforcements: {w:?}"
        );
        let f = fos(&bare, 0);
        assert!(
            (f - bare_fos).abs() < 5e-4,
            "{id} without reinforcements: FS {f}, expected {bare_fos}"
        );
    }
}
