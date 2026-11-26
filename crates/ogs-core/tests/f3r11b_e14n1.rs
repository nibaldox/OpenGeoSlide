//! F3R-R11 (M-B), E14o-6 (R11A-06): the fine slices of a crossing are classified with **all** the pieces of the original
//! slice, between the cuts that existed before the nodes of the crossings, and not with a fixed index on each side.
//!
//! The counter-examples of the review are on V014 (`verification/cases/V014.json`, Janbu corrected): a negligible line
//! load at `1e-5 m` of each crossing, and extra reinforcements at `2e-5 m`. Both cut one more fine slice next to the
//! crossing, and the sum of the three slices of E14n-1 was still a point force on a base of ~1e-5 m, so
//! `negative_effective_normal_major` came back. A real tension on slices of a normal width keeps the warning.

mod f3_common;

use f3_common::*;
use serde_json::{Value, json};

const MAJOR: &str = "negative_effective_normal_major";

fn published(id: &str, methods: Value) -> Value {
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
    doc
}

fn warnings(doc: &Value, i: usize) -> Vec<String> {
    run(doc).results[i].warnings.clone()
}

fn has(w: &[String], code: &str) -> bool {
    w.iter().any(|c| c == code)
}

/// `(x, y)` of the crossings of the first method of `doc`.
fn crossings(doc: &Value) -> Vec<(f64, f64)> {
    run(doc).results[0]
        .reinforcement_forces
        .iter()
        .map(|f| (f.x, f.y))
        .collect()
}

fn v014_with_loads_next_to_the_crossings(offset: f64) -> Value {
    let mut doc = published("V014", json!(["janbu_corrected"]));
    let xs: Vec<f64> = crossings(&doc).iter().map(|c| c.0).collect();
    doc["loads"] = json!(xs
        .iter()
        .enumerate()
        .map(|(i, x)| json!({"type": "line", "id": format!("L{i}"), "x": x + offset, "p": 0.001, "angle": 0.0}))
        .collect::<Vec<_>>());
    doc
}

fn v014_with_more_reinforcements(offset: f64) -> Value {
    let mut doc = published("V014", json!(["janbu_corrected"]));
    let at = crossings(&doc);
    let extra: Vec<Value> = at
        .iter()
        .enumerate()
        .map(|(i, (x, y))| {
            json!({"id": format!("X{i}"), "type": "pile", "x1": x + offset, "y1": y + 1.0, "x2": x + offset, "y2": y - 1.0,
                   "application": "passive", "force": 0.5, "direction": "perpendicular", "spacing": 1.0})
        })
        .collect();
    doc["reinforcements"]
        .as_array_mut()
        .expect("reinforcements")
        .extend(extra);
    doc
}

/// First counter-example: V014 with a line load of 0.001 kN/m at 1e-5 m of every crossing. FS 1.448441, as without it.
#[test]
fn v014_with_a_negligible_load_next_to_the_crossings_has_no_major_warning() {
    let doc = v014_with_loads_next_to_the_crossings(1e-5);
    let w = warnings(&doc, 0);
    assert!(!has(&w, MAJOR), "{w:?}");
}

/// Second counter-example: extra reinforcements at 2e-5 m of the crossings.
#[test]
fn v014_with_more_reinforcements_next_to_the_crossings_has_no_major_warning() {
    let doc = v014_with_more_reinforcements(2e-5);
    let w = warnings(&doc, 0);
    assert!(!has(&w, MAJOR), "{w:?}");
}

/// The same neighbours on the left of the crossings (the fine slice before the crossing is the one that is next to it).
#[test]
fn v014_with_the_neighbours_on_the_other_side_has_no_major_warning() {
    for doc in [
        v014_with_loads_next_to_the_crossings(-1e-5),
        v014_with_more_reinforcements(-2e-5),
    ] {
        let w = warnings(&doc, 0);
        assert!(!has(&w, MAJOR), "{w:?}");
    }
}

fn pile_model(angle: f64, force: f64, x: f64) -> Value {
    json!({
        "format": "opengeoslide", "version": "0.4",
        "meta": {"id": "e14o6", "title": "active pile pulling the mass up"},
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

/// A real tension keeps the major warning with the grouping of E14o-6, also with a negligible load that cuts one more
/// fine slice next to the crossing: the force of 400 kN/m lifts slices of 1.7 m.
#[test]
fn a_real_tension_keeps_the_major_warning_with_a_fine_neighbour() {
    let doc = pile_model(80.0, 400.0, 6.0);
    let x = crossings(&doc)[0].0;
    for offset in [0.0, 1e-5, -1e-5] {
        let mut doc = doc.clone();
        if offset != 0.0 {
            doc["loads"] =
                json!([{"type": "line", "id": "L", "x": x + offset, "p": 0.001, "angle": 0.0}]);
        }
        for i in 0..2 {
            let w = warnings(&doc, i);
            assert!(has(&w, MAJOR), "offset {offset}, method {i}: {w:?}");
        }
    }
}

/// The point force on a thin slice with a fine neighbour is not a negative normal either (the model of E14n-1).
#[test]
fn the_point_force_with_a_fine_neighbour_is_not_a_negative_normal() {
    let doc = pile_model(80.0, 100.0, 9.0);
    let x = crossings(&doc)[0].0;
    for offset in [1e-5, -1e-5] {
        let mut doc = doc.clone();
        doc["loads"] =
            json!([{"type": "line", "id": "L", "x": x + offset, "p": 0.001, "angle": 0.0}]);
        for i in 0..2 {
            let w = warnings(&doc, i);
            assert!(!has(&w, MAJOR), "offset {offset}, method {i}: {w:?}");
        }
    }
}
