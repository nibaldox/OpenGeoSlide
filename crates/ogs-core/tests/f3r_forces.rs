//! R1-C: crossings, capacity `T(s)`, direction and forces of the reinforcements (amendments E14d-E14i, E14m).
//!
//! The expected forces are the ones of the oracle `cslope` 0.1.0 on V047a with the fixed circle of F3.8, in X17 §4.4
//! (`x`, `y`, available force, `Px`, `Py`) and §4.5 (capacity). The factors of safety of the **active** rows are the
//! oracle's, within 0.1 %: an active force only uses the fields of always (`weight_extra`, `h_force`,
//! `h_moment_base`, `driving_extra`). The passive rows need the methods of R1-M (`passive_*` divided by `F`): here they
//! are checked only on the forces and on the `passive_*` fields of the slices, not on the FS.
//!
//! `location` of a `pile` was removed by R1-V (E14m-3). Until the two branches meet, the helper `analyze_doc` adds
//! `"location": "slip_surface"` only when the model of this branch asks for it.

mod f3_common;

use f3_common::*;
use ogs_core::model::Model;
use ogs_core::report::{AnalysisReport, ForceStatus, ReinforcementForce};
use serde_json::{Value, json};

const METHODS: [&str; 4] = [
    "bishop",
    "morgenstern_price",
    "janbu_simplified",
    "janbu_corrected",
];

/// V047a with the four methods (M-P with the `constant` function), `version "0.4"` and the given reinforcements.
fn doc_with(reinforcements: Value) -> Value {
    let mut doc = v047a(json!(METHODS));
    doc["version"] = json!("0.4");
    doc["analysis"]["interslice"] = json!({"function": "constant"});
    doc["reinforcements"] = reinforcements;
    doc
}

/// Parses `doc`; if the model of this branch still requires `location` in a pile, adds it (see the module doc).
fn parse(doc: &Value) -> Model {
    match serde_json::from_value::<Model>(doc.clone()) {
        Ok(m) => m,
        Err(e) if e.to_string().contains("location") => {
            let mut d = doc.clone();
            for r in d["reinforcements"].as_array_mut().unwrap() {
                if matches!(r["type"].as_str(), Some("pile" | "sheet_pile")) {
                    r["location"] = json!("slip_surface");
                }
            }
            serde_json::from_value(d).unwrap_or_else(|e| panic!("the document does not parse: {e}"))
        }
        Err(e) => panic!("the document does not parse: {e}\n{doc}"),
    }
}

pub fn analyze_doc(doc: &Value) -> AnalysisReport {
    ogs_core::analyze(&parse(doc)).unwrap_or_else(|e| panic!("the analysis failed: {e}\n{doc}"))
}

fn forces_of(doc: &Value, method: usize) -> Vec<ReinforcementForce> {
    analyze_doc(doc).results[method].reinforcement_forces.clone()
}

fn close(label: &str, got: f64, want: f64, tol: f64) {
    assert!(
        (got - want).abs() <= tol,
        "{label}: got {got:.6}, want {want:.6} (tol {tol})"
    );
}

// ------------------------------------------------------------------------------------------- elements of X17

fn anchor(id: &str, application: &str, direction: &str, tip: [f64; 2]) -> Value {
    json!({"type": "anchor", "id": id, "x1": 36, "y1": 28, "x2": tip[0], "y2": tip[1],
           "application": application, "tensile_capacity": 100, "direction": direction})
}

/// Horizontal element of rows 1 to 5: head (52; 28), tip (25; 28).
fn horizontal(kind: &str, application: &str, direction: &str, extra: Value) -> Value {
    let mut e = json!({"type": kind, "id": "E1", "x1": 52, "y1": 28, "x2": 25, "y2": 28,
                       "application": application, "direction": direction});
    for (k, v) in extra.as_object().unwrap() {
        e[k] = v.clone();
    }
    e
}

fn pile(application: &str, wall: bool) -> Value {
    if wall {
        json!({"type": "sheet_pile", "id": "S1", "x1": 40, "y1": 33, "x2": 40, "y2": 22,
               "application": application, "force": 120, "direction": "angle", "angle": 0})
    } else {
        json!({"type": "pile", "id": "P1", "x1": 40, "y1": 33, "x2": 40, "y2": 22,
               "application": application, "force": 60, "spacing": 1.5, "direction": "angle", "angle": 0})
    }
}

/// One row of X17 §4.4: the element, the crossing `(x, y)`, the available force and the force `(Px, Py)`.
struct Row {
    label: &'static str,
    element: Value,
    x: f64,
    y: f64,
    available: f64,
    px: f64,
    py: f64,
    /// FS of the oracle (`bishop`, `morgenstern_price`, `janbu_simplified`, `janbu_corrected`) for an active row.
    fos: Option<[f64; 4]>,
}

fn rows() -> Vec<Row> {
    let anchor_h = |app: &str| {
        let mut e = horizontal("anchor", app, "axial", json!({"tensile_capacity": 100}));
        e["id"] = json!("A1");
        e
    };
    let r = |label, element, x, y, available, px, py, fos| Row {
        label,
        element,
        x,
        y,
        available,
        px,
        py,
        fos,
    };
    vec![
        r(
            "F4.13-1",
            anchor_h("active"),
            42.3119,
            28.0,
            100.0,
            100.0,
            0.0,
            Some([1.333661, 1.329252, 1.261727, 1.319292]),
        ),
        r("F4.13-2", anchor_h("passive"), 42.3119, 28.0, 100.0, 100.0, 0.0, None),
        r(
            "F4.13-3",
            horizontal(
                "nail",
                "passive",
                "axial",
                json!({"tensile_capacity": 150, "pullout": {"model": "bond", "strength": 30}}),
            ),
            42.3119,
            28.0,
            150.0,
            150.0,
            0.0,
            None,
        ),
        r(
            "F4.13-5",
            horizontal(
                "geosynthetic",
                "passive",
                "tangent",
                json!({"tensile_capacity": 60, "pullout": {"model": "interface", "adhesion": 10,
                                                           "friction_angle": 20, "coverage": 1}}),
            ),
            42.3119,
            28.0,
            60.0,
            53.7078,
            26.7483,
            None,
        ),
        r(
            "F4.13-7",
            pile("active", false),
            40.0,
            26.9734,
            40.0,
            40.0,
            0.0,
            Some([1.108256, 1.105923, 1.053426, 1.101488]),
        ),
        r("F4.13-9", pile("passive", false), 40.0, 26.9734, 40.0, 40.0, 0.0, None),
        r(
            "F4.13-11",
            pile("active", true),
            40.0,
            26.9734,
            120.0,
            120.0,
            0.0,
            Some([1.455483, 1.448712, 1.347821, 1.409314]),
        ),
        r(
            "X17-inc-down15-act",
            anchor("A1", "active", "axial", [62.079997, 21.011886]),
            39.9314,
            26.9466,
            100.0,
            96.5926,
            -25.8819,
            Some([1.322996, 1.318077, 1.238390, 1.294890]),
        ),
        r(
            "X17-inc-down15-pas",
            anchor("A1", "passive", "axial", [62.079997, 21.011886]),
            39.9314,
            26.9466,
            100.0,
            96.5926,
            -25.8819,
            None,
        ),
        r(
            "X17-inc-down30-act",
            anchor("A1", "active", "axial", [59.382686, 14.5]),
            38.6361,
            26.478,
            100.0,
            86.6025,
            -50.0,
            Some([1.285084, 1.280634, 1.202115, 1.256961]),
        ),
        r(
            "X17-inc-down30-pas",
            anchor("A1", "passive", "axial", [59.382686, 14.5]),
            38.6361,
            26.478,
            100.0,
            86.6025,
            -50.0,
            None,
        ),
        r(
            "X17-inc-down45-act",
            anchor("A1", "active", "axial", [55.091883, 8.908117]),
            37.7906,
            26.2094,
            100.0,
            70.7107,
            -70.7107,
            Some([1.227727, 1.224093, 1.152974, 1.205578]),
        ),
        r(
            "X17-inc-down45-pas",
            anchor("A1", "passive", "axial", [55.091883, 8.908117]),
            37.7906,
            26.2094,
            100.0,
            70.7107,
            -70.7107,
            None,
        ),
        r(
            "X17-inc-down30-tangent-act",
            anchor("A1", "active", "tangent", [59.382686, 14.5]),
            38.6361,
            26.478,
            100.0,
            94.8269,
            31.7469,
            Some([1.345237, 1.339658, 1.246721, 1.303601]),
        ),
        r(
            "X17-inc-down30-tangent-pas",
            anchor("A1", "passive", "tangent", [59.382686, 14.5]),
            38.6361,
            26.478,
            100.0,
            94.8269,
            31.7469,
            None,
        ),
        r(
            "X17-inc-down30-bisector-act",
            anchor("A1", "active", "bisector", [59.382686, 14.5]),
            38.6361,
            26.478,
            100.0,
            99.4977,
            -10.0102,
            Some([1.355457, 1.349912, 1.257745, 1.315129]),
        ),
        r(
            "X17-inc-down30-bisector-pas",
            anchor("A1", "passive", "bisector", [59.382686, 14.5]),
            38.6361,
            26.478,
            100.0,
            99.4977,
            -10.0102,
            None,
        ),
        r(
            "X17-inc-up15-act",
            anchor("A1", "active", "axial", [62.079997, 34.988114]),
            47.0327,
            30.9562,
            100.0,
            96.5926,
            25.8819,
            Some([1.310751, 1.310450, 1.292607, 1.351581]),
        ),
        r(
            "X17-inc-up15-pas",
            anchor("A1", "passive", "axial", [62.079997, 34.988114]),
            47.0327,
            30.9562,
            100.0,
            96.5926,
            25.8819,
            None,
        ),
    ]
}

// --------------------------------------------------------------------------------------------------- forces

/// X17 §4.4: the crossing, the available force and the applied force of every row of the oracle, in model
/// coordinates (`fx` is `+Px` although the slide goes toward −x), with the status `applied`.
#[test]
fn forces_match_the_oracle_rows_of_x17() {
    for row in rows() {
        let doc = doc_with(json!([row.element]));
        let f = forces_of(&doc, 0);
        assert_eq!(f.len(), 1, "{}: one crossing, got {f:?}", row.label);
        let f = &f[0];
        assert_eq!(f.status, ForceStatus::Applied, "{}", row.label);
        close(&format!("{} x", row.label), f.x, row.x, 2e-4);
        close(&format!("{} y", row.label), f.y, row.y, 2e-4);
        close(&format!("{} available", row.label), f.available, row.available, 2e-4);
        close(&format!("{} fx", row.label), f.fx, row.px, 2e-4);
        close(&format!("{} fy", row.label), f.fy, row.py, 2e-4);
        assert_eq!(f.crossing, 0, "{}", row.label);
        assert!(f.station > 0.0, "{}", row.label);
    }
}

/// The four methods of the **active** rows against the oracle, 0.1 % (F4.13). The rows with `along < 0` are the ones
/// where the installed binary and the current cSlope agree (E14m-1).
#[test]
fn active_rows_match_the_oracle_factors_of_safety() {
    let mut worst = 0.0_f64;
    for row in rows() {
        let Some(want) = row.fos else { continue };
        let report = analyze_doc(&doc_with(json!([row.element])));
        for (i, method) in METHODS.iter().enumerate() {
            let got = report.results[i].fos.expect("fos");
            let rel = (got - want[i]).abs() / want[i];
            println!(
                "{:<28} {:<18} ogs {got:.6} cslope {:.6} Δ {:.4} %",
                row.label,
                method,
                want[i],
                100.0 * rel
            );
            worst = worst.max(rel);
            assert!(
                rel <= 1e-3,
                "{} {method}: ogs {got:.6} against {:.6}: Δ = {:.4} %",
                row.label,
                want[i],
                100.0 * rel
            );
        }
    }
    println!("worst Δ = {:.4} %", 100.0 * worst);
}

/// A passive force goes to the `passive_*` fields and an active one to the fields of always, on the thin slice that
/// is centred on the crossing; the other slices carry nothing.
#[test]
fn active_goes_to_the_usual_fields_and_passive_to_the_passive_ones() {
    for (app, active) in [("active", true), ("passive", false)] {
        let doc = doc_with(json!([anchor("A1", app, "axial", [59.382686, 14.5])]));
        let report = analyze_doc(&doc);
        let r = &report.results[0];
        let f = &r.reinforcement_forces[0];
        let carriers: Vec<_> = r
            .slices
            .iter()
            .filter(|s| {
                s.weight_extra != 0.0
                    || s.h_force != 0.0
                    || s.passive_v != 0.0
                    || s.passive_h != 0.0
            })
            .collect();
        assert_eq!(carriers.len(), 1, "{app}: one slice carries the force");
        let s = carriers[0];
        let xm = 0.5 * (s.x_left + s.x_right);
        assert!((xm - f.x).abs() < 1e-12, "{app}: the slice is centred on x_c");
        assert!(s.width < 1e-3, "{app}: it is a thin slice, {}", s.width);
        // s = -1 (right to left): V = -Py, H = s·Px.
        let (v, h, m) = if active {
            (s.weight_extra, s.h_force, s.h_moment_base)
        } else {
            (s.passive_v, s.passive_h, s.passive_h_moment_base)
        };
        close(&format!("{app} V"), v, -f.fy, 1e-12);
        close(&format!("{app} H"), h, -f.fx, 1e-12);
        let y_base = 0.5 * (s.y_base_left + s.y_base_right);
        close(&format!("{app} M"), m, -f.fx * (f.y - y_base), 1e-12);
        let (yc, rad) = (v047a_circle_yc(), 28.641487934160704);
        let de = if active { s.driving_extra } else { s.passive_driving_extra };
        close(&format!("{app} driving_extra"), de, -f.fx * (yc - f.y) / rad, 1e-12);
        // The other fields stay at zero.
        if active {
            assert_eq!((s.passive_v, s.passive_h), (0.0, 0.0));
        } else {
            assert_eq!((s.weight_extra, s.h_force, s.driving_extra), (0.0, 0.0, 0.0));
        }
    }
}

fn v047a_circle_yc() -> f64 {
    CIRCLE.1
}

// ----------------------------------------------------------------------------------------------- capacity

/// X17 §4.5: `(label, element, oracle force, force of the prototype with the exact integral)`.
fn capacity_rows() -> Vec<(&'static str, Value, f64, f64)> {
    let g = |extra: Value| horizontal("geosynthetic", "passive", "axial", extra);
    let tieback = |pullout: Value| {
        json!({"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 63, "y2": 28,
               "application": "active", "tensile_capacity": 150, "direction": "axial", "pullout": pullout})
    };
    vec![
        (
            "interface",
            g(json!({"tensile_capacity": 1000, "pullout": {"model": "interface", "adhesion": 10,
                                                          "friction_angle": 20, "coverage": 1}})),
            272.5028,
            271.2091,
        ),
        (
            "interface-cov.5-sp2",
            g(json!({"tensile_capacity": 1000, "spacing": 2, "pullout": {"model": "interface",
                     "adhesion": 10, "friction_angle": 20, "coverage": 0.5}})),
            136.2514,
            135.6046,
        ),
        (
            "interface-a0-d30",
            g(json!({"tensile_capacity": 1000, "pullout": {"model": "interface", "adhesion": 0,
                                                          "friction_angle": 30, "coverage": 1}})),
            229.9695,
            230.0159,
        ),
        (
            "bond20-all",
            horizontal(
                "nail",
                "passive",
                "axial",
                json!({"tensile_capacity": 1000, "pullout": {"model": "bond", "strength": 20}}),
            ),
            126.2266,
            126.2037,
        ),
        (
            "tieback-bonded25",
            tieback(json!({"model": "bond", "strength": 20, "bonded_length": 25})),
            86.2266,
            86.2520,
        ),
        (
            "dev10/10",
            g(json!({"tensile_capacity": 100, "pullout": {"model": "development",
                                                         "length1": 10, "length2": 10}})),
            96.8867,
            96.8811,
        ),
        (
            "dev15/20-end1=10",
            g(json!({"tensile_capacity": 100, "end1_capacity": 10, "pullout": {"model": "development",
                                                                              "length1": 15, "length2": 20}})),
            74.5911,
            74.5874,
        ),
        (
            "dev30/30-end2=5",
            g(json!({"tensile_capacity": 100, "end2_capacity": 5, "pullout": {"model": "development",
                                                                             "length1": 30, "length2": 30}})),
            32.2956,
            32.2937,
        ),
    ]
}

/// The capacity with the **exact** integral against the prototype of X17 §4.5, at `1e-4` (relative); and against the
/// oracle, which discretises `interface` in 200 steps (up to 0.5 % in `T`).
#[test]
fn capacity_with_the_exact_integral_matches_the_prototype() {
    for (label, element, oracle, proto) in capacity_rows() {
        let doc = doc_with(json!([element]));
        let f = forces_of(&doc, 0);
        assert_eq!(f.len(), 1, "{label}: {f:?}");
        assert_eq!(f[0].status, ForceStatus::Applied, "{label}");
        let got = f[0].available;
        println!("{label}: ogs {got:.4}, prototype {proto:.4}, oracle {oracle:.4}");
        assert!(
            (got - proto).abs() <= 1e-4 * proto,
            "{label}: {got:.5} against the prototype {proto:.5}"
        );
        assert!(
            (got - oracle).abs() <= 5e-3 * oracle,
            "{label}: {got:.5} against the oracle {oracle:.5}"
        );
        // The applied force is the available one, along the axis (these rows are axial or head-on).
        assert!((f[0].fx.hypot(f[0].fy) - got).abs() <= 1e-9 * got, "{label}");
    }
}

/// `tieback` with `bonded_length 10` and no `end1_capacity`: the free length carries nothing (E14m-2), so the
/// crossing is `no_capacity`, no force is applied and the factor is the one of the slope without the element. No note.
#[test]
fn free_length_without_a_plate_is_no_capacity() {
    let element = json!({"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 63, "y2": 28,
        "application": "active", "tensile_capacity": 150, "direction": "axial",
        "pullout": {"model": "bond", "strength": 20, "bonded_length": 10}});
    let report = analyze_doc(&doc_with(json!([element])));
    let bare = {
        let mut d = v047a(json!(METHODS));
        d["analysis"]["interslice"] = json!({"function": "constant"});
        run(&d)
    };
    for (i, r) in report.results.iter().enumerate() {
        assert_eq!(r.reinforcement_forces.len(), 1);
        let f = &r.reinforcement_forces[0];
        assert_eq!(f.status, ForceStatus::NoCapacity);
        assert_eq!((f.available, f.fx, f.fy), (0.0, 0.0, 0.0));
        let (a, b) = (r.fos.unwrap(), bare.results[i].fos.unwrap());
        assert!((a - b).abs() <= 1e-12, "{}: {a} against {b}", METHODS[i]);
        assert!(
            !r.warnings.iter().any(|w| w.starts_with("reinforcement_")),
            "no note: {:?}",
            r.warnings
        );
    }
    // With the plate (end1 = tensile capacity) the whole force is there.
    let mut with_plate = element.clone();
    with_plate["end1_capacity"] = json!(150);
    let f = forces_of(&doc_with(json!([with_plate])), 0);
    assert_eq!(f[0].status, ForceStatus::Applied);
    close("plate", f[0].available, 150.0, 1e-9);
}

/// Active rows of capacity: the FS of the oracle with the force of the oracle (0.1 %).
#[test]
fn active_capacity_row_factors() {
    let element = json!({"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 63, "y2": 28,
        "application": "active", "tensile_capacity": 150, "direction": "axial",
        "pullout": {"model": "bond", "strength": 20, "bonded_length": 25}});
    let want = [1.273594, 1.269798, 1.207886, 1.262995];
    let report = analyze_doc(&doc_with(json!([element])));
    for (i, w) in want.iter().enumerate() {
        let got = report.results[i].fos.unwrap();
        assert!(
            (got - w).abs() / w <= 1e-3,
            "{}: {got:.6} against {w:.6}",
            METHODS[i]
        );
    }
}

// ----------------------------------------------------------------------------------------- directions

/// E14m-1: an active element with `along > 0` (it climbs toward the massif more steeply than the base) applies
/// `u = d` whatever its `direction`, with the whole force. A passive one is `compression_ignored`.
#[test]
fn compressed_active_applies_u_equal_d_and_passive_is_ignored() {
    // up30: head (36; 28), tip (59.38; 41.5): the part under the surface is toward the head, d = -a.
    let tip = [59.382686, 41.5];
    let a = {
        let (dx, dy): (f64, f64) = (tip[0] - 36.0, tip[1] - 28.0);
        let l = dx.hypot(dy);
        [dx / l, dy / l]
    };
    for direction in ["axial", "tangent", "bisector"] {
        let f = forces_of(&doc_with(json!([anchor("A1", "active", direction, tip)])), 0);
        assert_eq!(f.len(), 1, "{direction}");
        assert_eq!(f[0].status, ForceStatus::Applied, "{direction}");
        // d = -a (the element enters the mass up and to the right; the stable side is down and to the left).
        close(&format!("{direction} fx"), f[0].fx, -100.0 * a[0], 1e-9);
        close(&format!("{direction} fy"), f[0].fy, -100.0 * a[1], 1e-9);
    }
    let report = analyze_doc(&doc_with(json!([anchor("A1", "passive", "axial", tip)])));
    for (i, r) in report.results.iter().enumerate() {
        let f = &r.reinforcement_forces[0];
        assert_eq!(f.status, ForceStatus::CompressionIgnored, "{}", METHODS[i]);
        assert_eq!((f.fx, f.fy), (0.0, 0.0));
        assert!(f.available > 0.0, "the available force is still reported");
        assert!(
            r.warnings.iter().any(|w| w == "reinforcement_compression_ignored"),
            "{:?}",
            r.warnings
        );
        // Nothing reaches the slices: FS of the slope without the element.
        assert!(r.slices.iter().all(|s| s.passive_v == 0.0 && s.passive_h == 0.0));
    }
}

/// Piles: `angle` is measured from the horizontal, positive upward, and the horizontal part opposes the sliding;
/// `tangent` is `-m`; `perpendicular` is the normal of the axis that opposes the movement. No compression rule.
#[test]
fn pile_directions_oppose_the_movement() {
    let p = |direction: &str, angle: Option<f64>, tip: [f64; 2]| {
        let mut e = json!({"type": "pile", "id": "P1", "x1": 38, "y1": 33, "x2": tip[0], "y2": tip[1],
                           "application": "active", "force": 40, "direction": direction});
        if let Some(a) = angle {
            e["angle"] = json!(a);
        }
        e
    };
    let get = |e: Value| forces_of(&doc_with(json!([e])), 0)[0].clone();
    // angle +20: (37.59; +13.68) for 40 kN/m (X17 §1.3); -20: (37.59; -13.68).
    let up = get(p("angle", Some(20.0), [38.0, 22.0]));
    close("angle 20 fx", up.fx, 40.0 * 20f64.to_radians().cos(), 1e-9);
    close("angle 20 fy", up.fy, 40.0 * 20f64.to_radians().sin(), 1e-9);
    let down = get(p("angle", Some(-20.0), [38.0, 22.0]));
    close("angle -20 fy", down.fy, -40.0 * 20f64.to_radians().sin(), 1e-9);
    // Perpendicular of the inclined pile (38; 33) -> (42; 22): (37.59; 13.67), 20° up (X17 §1.3).
    let perp = get(p("perpendicular", None, [42.0, 22.0]));
    let theta = (4.0f64).atan2(11.0);
    close("perp fx", perp.fx, 40.0 * theta.cos(), 1e-9);
    close("perp fy", perp.fy, 40.0 * theta.sin(), 1e-9);
    assert_eq!(perp.status, ForceStatus::Applied);
    // The perpendicular of a vertical pile is the horizontal one.
    let vert = get(p("perpendicular", None, [38.0, 22.0]));
    close("vertical perp fx", vert.fx, 40.0, 1e-9);
    close("vertical perp fy", vert.fy, 0.0, 1e-9);
    // Tangent: u = -m, a unit vector against the movement: fx > 0 (the slide goes toward -x), |P| = 40.
    let tan = get(p("tangent", None, [38.0, 22.0]));
    assert!(tan.fx > 0.0 && tan.fy > 0.0);
    close("tangent |P|", tan.fx.hypot(tan.fy), 40.0, 1e-9);
}

/// Mirror x -> -x: the reinforcement is mirrored, the factors are the same and the force `fx` changes sign.
#[test]
fn mirror_gives_the_same_factors_and_the_mirrored_forces() {
    for row in rows() {
        if row.label.contains("pas") || !(row.label.starts_with("F4.13") || row.label.contains("down30")) {
            continue;
        }
        let doc = doc_with(json!([row.element]));
        let mut mdoc = mirror(&doc);
        let mut els = doc["reinforcements"].clone();
        for e in els.as_array_mut().unwrap() {
            for k in ["x1", "x2"] {
                e[k] = json!(-e[k].as_f64().unwrap());
            }
        }
        mdoc["reinforcements"] = els;
        mdoc["version"] = json!("0.4");
        let (a, b) = (analyze_doc(&doc), analyze_doc(&mdoc));
        for i in 0..METHODS.len() {
            let (fa, fb) = (a.results[i].fos.unwrap(), b.results[i].fos.unwrap());
            assert!(
                (fa - fb).abs() <= 1e-9 * fa,
                "{} {}: {fa} against {fb}",
                row.label,
                METHODS[i]
            );
        }
        let (fa, fb) = (&a.results[0].reinforcement_forces[0], &b.results[0].reinforcement_forces[0]);
        close(&format!("{} mirrored x", row.label), fb.x, -fa.x, 1e-6);
        close(&format!("{} mirrored y", row.label), fb.y, fa.y, 1e-6);
        close(&format!("{} mirrored fx", row.label), fb.fx, -fa.fx, 1e-6);
        close(&format!("{} mirrored fy", row.label), fb.fy, fa.fy, 1e-6);
    }
}

// ------------------------------------------------------------------------- crossings, statuses and notes

/// A line that crosses the circle twice gives two forces, in order from the head, each with its own `along` and
/// `T(s_c)`. A 60 m line through (42; 27.88) at 20° crosses the lower arc twice (X17 §1.4).
#[test]
fn two_crossings_give_two_forces() {
    // Active: both are applied (the compressed one with u = d, E14m-1).
    let element = json!({"type": "anchor", "id": "A1", "x1": 20, "y1": 20.0, "x2": 62.0, "y2": 29.0,
        "application": "active", "tensile_capacity": 50, "direction": "axial",
        "pullout": {"model": "development", "length1": 10, "length2": 5}});
    let f = forces_of(&doc_with(json!([element])), 0);
    println!("{f:#?}");
    assert!(f.len() >= 2, "expected two crossings, got {f:?}");
    for (i, c) in f.iter().enumerate() {
        assert_eq!(c.crossing, i);
        assert_eq!(c.id, "A1");
    }
    assert!(f.windows(2).all(|w| w[0].station < w[1].station));
}

/// A crossing in the air: the element crosses the circle where the arc is above the ground. `outside_mass`, no force,
/// and the note `reinforcement_outside_mass`. An element that does not cross the surface gives no entry, but the note.
#[test]
fn crossing_in_the_air_is_outside_mass() {
    // The circle rises above the ground to the left of the toe (x < 29.7): an element at y = 40 over x in [22, 28]
    // crosses the circle (yc - r = 25.0 at the bottom; the upper half is not a surface) nowhere; one at y = 26 crosses
    // the lower arc in the air region x < 29.7? The arc at x = 25 is at y = 53.64 - sqrt(r^2 - 4.54^2) = 25.1 > ground 25.
    let element = json!({"type": "anchor", "id": "A1", "x1": 22.0, "y1": 25.5, "x2": 27.0, "y2": 25.5,
        "application": "active", "tensile_capacity": 100, "direction": "axial"});
    let report = analyze_doc(&doc_with(json!([element])));
    for r in &report.results {
        let f = &r.reinforcement_forces;
        assert!(
            f.iter().all(|c| c.status == ForceStatus::OutsideMass),
            "{f:?}"
        );
        assert!(
            r.warnings.iter().any(|w| w == "reinforcement_outside_mass"),
            "{:?}",
            r.warnings
        );
    }
    // No effect on the factors.
    let bare = {
        let mut d = v047a(json!(METHODS));
        d["analysis"]["interslice"] = json!({"function": "constant"});
        run(&d)
    };
    for i in 0..METHODS.len() {
        assert_eq!(
            report.results[i].fos.unwrap().to_bits(),
            bare.results[i].fos.unwrap().to_bits(),
            "{}",
            METHODS[i]
        );
    }
    // An element far from the surface: no crossing, no entry, and the note.
    let far = json!({"type": "nail", "id": "N1", "x1": 60, "y1": 34, "x2": 66, "y2": 34,
        "application": "passive", "tensile_capacity": 100, "direction": "axial"});
    let r = analyze_doc(&doc_with(json!([far])));
    assert!(r.results[0].reinforcement_forces.is_empty());
    assert!(r.results[0].warnings.iter().any(|w| w == "reinforcement_outside_mass"));
}

/// `structural_checks_not_covered` appears whenever a pile or a sheet pile is in the model, crossed or not; not
/// for tension elements.
#[test]
fn structural_note_for_piles() {
    let crossed = analyze_doc(&doc_with(json!([pile("active", false)])));
    assert!(
        crossed.results[0]
            .warnings
            .iter()
            .any(|w| w == "structural_checks_not_covered")
    );
    let mut far = pile("passive", true);
    far["x1"] = json!(66);
    far["x2"] = json!(66);
    let r = analyze_doc(&doc_with(json!([far])));
    assert!(
        r.results[0]
            .warnings
            .iter()
            .any(|w| w == "structural_checks_not_covered")
    );
    let tension = analyze_doc(&doc_with(json!([anchor("A1", "active", "axial", [59.38, 14.5])])));
    assert!(
        !tension.results[0]
            .warnings
            .iter()
            .any(|w| w == "structural_checks_not_covered")
    );
}

/// A crossing at an end of the element, within `tol`, does not count (E14d.1).
#[test]
fn crossing_at_the_end_of_the_element_does_not_count() {
    // The element ends exactly on the circle: head at the crossing point of the row 1 (42.3119; 28).
    let x_c = {
        let f = forces_of(&doc_with(json!([rows()[0].element.clone()])), 0);
        f[0].x
    };
    let element = json!({"type": "anchor", "id": "A1", "x1": 52.0, "y1": 28.0, "x2": x_c, "y2": 28.0,
        "application": "active", "tensile_capacity": 100, "direction": "axial"});
    let r = analyze_doc(&doc_with(json!([element])));
    assert!(r.results[0].reinforcement_forces.is_empty());
}

/// Search: the forces of the report are those of the final surface and the engine runs with the reinforcements.
#[test]
fn search_with_an_anchor_runs_and_reports_the_final_surface() {
    let mut doc = doc_with(json!([rows()[0].element.clone()]));
    doc["analysis"].as_object_mut().unwrap().remove("surface");
    doc["analysis"]["methods"] = json!(["bishop"]);
    doc["analysis"]["search"] = json!({"type": "circular_entry_exit", "entry": [40.0, 60.0], "exit": [20.0, 40.0],
        "n_entry": 5, "n_exit": 5, "n_radius": 4});
    let report = match serde_json::from_value::<Model>(doc.clone()) {
        Ok(m) => ogs_core::analyze(&m),
        Err(e) => panic!("search spec does not parse: {e}"),
    };
    let report = report.expect("search with a reinforcement");
    let r = &report.results[0];
    assert!(r.fos.is_some());
    assert!(r.search.is_some());
}
