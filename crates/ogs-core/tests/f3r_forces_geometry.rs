//! R1-C: the exact integral of `interface` (water, layers), polyline surfaces, truncated blocks (E10a) and the search.
//!
//! The expected integrals are computed here by a brute-force quadrature of an independent `σ′v(x, y)`, written for
//! each model from its geometry, so they do not share code with `reinforcement.rs`.

mod f3_common;

use f3_common::*;
use ogs_core::model::Model;
use ogs_core::report::{AnalysisReport, ForceStatus, ReinforcementForce};
use serde_json::{Value, json};

fn analyze_doc(doc: &Value) -> AnalysisReport {
    let model: Model = serde_json::from_value(doc.clone())
        .unwrap_or_else(|e| panic!("the document does not parse: {e}\n{doc}"));
    ogs_core::analyze(&model).unwrap_or_else(|e| panic!("analysis failed: {e}"))
}

fn forces(doc: &Value, i: usize) -> Vec<ReinforcementForce> {
    analyze_doc(doc).results[i].reinforcement_forces.clone()
}

/// Midpoint rule of `f` on `[a, b]` with `n` steps.
fn integrate(f: impl Fn(f64) -> f64, a: f64, b: f64, n: usize) -> f64 {
    let h = (b - a) / n as f64;
    (0..n).map(|i| f(a + (i as f64 + 0.5) * h)).sum::<f64>() * h
}

/// `T(s_c)` of an `interface` element from `(head, tip)` with `Tmax` large, by quadrature of `sigma(x, y)`
/// (the effective vertical stress, 0 where the point is above the ground `ground(x)`). `s_c` is the station.
#[allow(clippy::too_many_arguments)]
fn interface_by_quadrature(
    head: [f64; 2],
    tip: [f64; 2],
    s_c: f64,
    a: f64,
    delta_deg: f64,
    rc: f64,
    ground: impl Fn(f64) -> f64,
    sigma: impl Fn(f64, f64) -> f64,
) -> f64 {
    let len = (tip[0] - head[0]).hypot(tip[1] - head[1]);
    let (ux, uy) = ((tip[0] - head[0]) / len, (tip[1] - head[1]) / len);
    let tan = delta_deg.to_radians().tan();
    let rate = |s: f64| {
        let (x, y) = (head[0] + s * ux, head[1] + s * uy);
        if y >= ground(x) {
            0.0
        } else {
            2.0 * rc * (a + sigma(x, y).max(0.0) * tan)
        }
    };
    let before = integrate(rate, 0.0, s_c, 2_000_000);
    let after = integrate(rate, s_c, len, 2_000_000);
    before.min(after)
}

fn interface_element(head: [f64; 2], tip: [f64; 2], a: f64, delta: f64) -> Value {
    json!({"type": "geosynthetic", "id": "G1", "x1": head[0], "y1": head[1], "x2": tip[0], "y2": tip[1],
        "application": "passive", "tensile_capacity": 1.0e6, "direction": "axial",
        "pullout": {"model": "interface", "adhesion": a, "friction_angle": delta, "coverage": 1}})
}

fn with(mut doc: Value, reinforcements: Value) -> Value {
    doc["version"] = json!("0.4");
    doc["reinforcements"] = reinforcements;
    doc
}

/// V047a ground: `y = 25` for `x ≤ 30`, `25 + (x − 30)/2` up to 50, then 35.
fn ground_v047a(x: f64) -> f64 {
    if x <= 30.0 {
        25.0
    } else if x <= 50.0 {
        25.0 + 0.5 * (x - 30.0)
    } else {
        35.0
    }
}

/// With a water line: `σ′v = σ − u`, with `γsat` under the water, in the column over the point (E14m-2). The water
/// line is `[[20, 25], [30, 25], [50, 31], [70, 31]]`, always under the ground. The exact integral cuts at `x = 40`,
/// where the water crosses the element (`y = 28`), and at the ground.
#[test]
fn interface_with_water_integrates_exactly() {
    let mut doc = v047a(json!(["bishop"]));
    doc["materials"][0]["unit_weight_sat"] = json!(21.0);
    doc["water"] =
        json!({"unit_weight": 9.81, "piezometric_line": [[20, 25], [30, 25], [50, 31], [70, 31]]});
    let water = |x: f64| -> f64 {
        if x <= 30.0 {
            25.0
        } else if x <= 50.0 {
            25.0 + 0.3 * (x - 30.0)
        } else {
            31.0
        }
    };
    let sigma = |x: f64, y: f64| {
        let top = ground_v047a(x);
        let z = water(x);
        let below = (z.min(top) - y).max(0.0);
        let above = (top - y) - below;
        let sig = 21.0 * below + 20.0 * above;
        sig - 9.81 * (z - y).max(0.0)
    };
    let (head, tip) = ([52.0, 28.0], [25.0, 28.0]);
    let doc = with(doc, json!([interface_element(head, tip, 10.0, 20.0)]));
    let f = forces(&doc, 0);
    assert_eq!(f.len(), 1);
    let want = interface_by_quadrature(
        head,
        tip,
        f[0].station,
        10.0,
        20.0,
        1.0,
        ground_v047a,
        sigma,
    );
    println!(
        "with water: ogs {:.8}, quadrature {want:.8}",
        f[0].available
    );
    assert!(
        (f[0].available - want).abs() <= 1e-6 * want,
        "{} against {want}",
        f[0].available
    );
    // The dry model gives a larger force (X17 §2.1: the ratio is 0.981).
    let dry = with(
        v047a(json!(["bishop"])),
        json!([interface_element(head, tip, 10.0, 20.0)]),
    );
    let fd = forces(&dry, 0)[0].available;
    assert!(fd > f[0].available);
}

/// Two materials with a horizontal contact at `y = 29` (the upper one is lighter): the element is inclined and
/// crosses the contact and the vertex of the ground at `x = 38`, so `σ′v` has kinks that the integral must cut at.
#[test]
fn interface_across_a_contact_integrates_exactly() {
    let mut doc = v047a(json!(["bishop"]));
    doc["materials"] = json!([
        {"id": "lower", "name": "Lower", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6},
        {"id": "upper", "name": "Upper", "model": "mohr_coulomb", "unit_weight": 17.0, "cohesion": 3.0, "friction_angle": 19.6}
    ]);
    doc["regions"] = json!([
        {"material": "lower", "polygon": [[20, 20], [20, 25], [30, 25], [38, 29], [70, 29], [70, 20]]},
        {"material": "upper", "polygon": [[38, 29], [50, 35], [70, 35], [70, 29]]}
    ]);
    let sigma = |x: f64, y: f64| {
        let top = ground_v047a(x);
        let upper = (top - 29.0f64.max(y)).max(0.0);
        let lower = (top.min(29.0) - y).max(0.0);
        17.0 * upper + 20.0 * lower
    };
    // (i) Inclined: it crosses the contact (y = 29) at x = 40.8, after the crossing with the circle.
    // (ii) Horizontal at y = 27: from the crossing to the ground it passes under the vertex (38; 29) where the upper
    // layer starts, so `σ′v` has a kink there.
    for (head, tip) in [([52.0, 22.0], [40.0, 29.5]), ([52.0, 27.0], [25.0, 27.0])] {
        for (a, delta) in [(5.0, 25.0), (0.0, 30.0)] {
            let doc = with(doc.clone(), json!([interface_element(head, tip, a, delta)]));
            let f = forces(&doc, 0);
            assert_eq!(f.len(), 1, "{head:?}: {f:?}");
            let want = interface_by_quadrature(
                head,
                tip,
                f[0].station,
                a,
                delta,
                1.0,
                ground_v047a,
                sigma,
            );
            println!(
                "contact {head:?} a={a}: ogs {:.8}, quadrature {want:.8}",
                f[0].available
            );
            assert!(
                (f[0].available - want).abs() <= 1e-6 * want,
                "{head:?} a={a}: {} against {want}",
                f[0].available
            );
        }
    }
}

/// `ru` material: `σ′v = (1 − ru)·σ`.
#[test]
fn interface_with_ru_uses_the_effective_stress() {
    let mut doc = v047a(json!(["bishop"]));
    doc["materials"][0]["ru"] = json!(0.3);
    let sigma = |x: f64, y: f64| 0.7 * 20.0 * (ground_v047a(x) - y);
    let (head, tip) = ([52.0, 28.0], [25.0, 28.0]);
    let doc = with(doc, json!([interface_element(head, tip, 4.0, 28.0)]));
    let f = forces(&doc, 0);
    let want =
        interface_by_quadrature(head, tip, f[0].station, 4.0, 28.0, 1.0, ground_v047a, sigma);
    assert!(
        (f[0].available - want).abs() <= 1e-6 * want,
        "{} against {want}",
        f[0].available
    );
}

// ------------------------------------------------------------------------------------------ polyline

/// A fixed polyline: the crossings are those with its segments, the force acts on the thin slice and the
/// factor grows with an active anchor; Bishop is not offered, the other methods are.
#[test]
fn polyline_surface_crossing_and_force() {
    let mut doc = v047a(json!(["spencer", "janbu_simplified", "morgenstern_price"]));
    set_polyline(&mut doc, &POLYLINE);
    let bare = run(&doc);
    let element = json!({"type": "anchor", "id": "A1", "x1": 52, "y1": 28, "x2": 25, "y2": 28,
        "application": "active", "tensile_capacity": 100, "direction": "axial"});
    let doc = with(doc, json!([element]));
    let report = analyze_doc(&doc);
    // y = 28 on the segment (40; 26.973391) - (45; 29.525055).
    let (p, q) = (POLYLINE[2], POLYLINE[3]);
    let x_c = p[0] + (q[0] - p[0]) * (28.0 - p[1]) / (q[1] - p[1]);
    for (i, r) in report.results.iter().enumerate() {
        let f = &r.reinforcement_forces;
        assert_eq!(f.len(), 1, "{:?}", r.method);
        assert!((f[0].x - x_c).abs() < 1e-9 && (f[0].y - 28.0).abs() < 1e-9);
        assert_eq!(f[0].status, ForceStatus::Applied);
        assert!((f[0].fx - 100.0).abs() < 1e-9 && f[0].fy.abs() < 1e-9);
        assert!(
            r.fos.unwrap() > bare.results[i].fos.unwrap() + 0.1,
            "{:?}: {} against {}",
            r.method,
            r.fos.unwrap(),
            bare.results[i].fos.unwrap()
        );
        // The force is on a thin slice centred on x_c, `driving_extra` stays 0 (no centre).
        let carrier: Vec<_> = r.slices.iter().filter(|s| s.h_force != 0.0).collect();
        assert_eq!(carrier.len(), 1);
        assert!((0.5 * (carrier[0].x_left + carrier[0].x_right) - x_c).abs() < 1e-9);
        assert!(r.slices.iter().all(|s| s.driving_extra == 0.0));
    }
    // A vertex of the polyline is a crossing counted once: a vertical sheet pile at the vertex x = 40.
    let wall = json!({"type": "sheet_pile", "id": "S1", "x1": 40, "y1": 33, "x2": 40, "y2": 22,
        "application": "active", "force": 50, "direction": "tangent"});
    let at_vertex = with(
        {
            let mut d = v047a(json!(["spencer"]));
            set_polyline(&mut d, &POLYLINE);
            d
        },
        json!([wall]),
    );
    let mut parsed = at_vertex.clone();
    if serde_json::from_value::<Model>(parsed.clone()).is_err() {
        parsed["reinforcements"][0]["location"] = json!("slip_surface");
    }
    let f = forces(&parsed, 0);
    assert_eq!(f.len(), 1, "a crossing at a vertex counts once: {f:?}");
}

// --------------------------------------------------------------------------------------- truncation

/// E10a: a crossing in the discarded toe lens is `outside_mass`, applies nothing and leaves the factor as it was; a
/// crossing in the main block is applied.
#[test]
fn crossing_in_a_discarded_block_is_outside_mass() {
    let doc = json!({
        "format": "opengeoslide", "version": "0.4",
        "materials": [{"id": "soil", "name": "Soil", "model": "mohr_coulomb",
                       "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6}],
        "regions": [{"material": "soil", "polygon": [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]]}],
        "slope": {"direction": "right_to_left"},
        "analysis": {"methods": ["bishop", "spencer"], "slices": 60,
                     "surface": {"type": "circle", "xc": 25.0, "yc": 44.0, "r": 19.5}}
    });
    let bare = analyze_doc(&doc);
    assert!(
        bare.results[0]
            .warnings
            .iter()
            .any(|w| w == "truncated_mass")
    );
    let lens = json!({"type": "nail", "id": "N1", "x1": 40.0, "y1": 24.8, "x2": 22.0, "y2": 24.8,
        "application": "active", "tensile_capacity": 10, "direction": "axial"});
    let main = json!({"type": "nail", "id": "N2", "x1": 45.0, "y1": 28.0, "x2": 20.0, "y2": 28.0,
        "application": "active", "tensile_capacity": 10, "direction": "axial"});
    let only_lens = analyze_doc(&with(doc.clone(), json!([lens.clone()])));
    for (i, r) in only_lens.results.iter().enumerate() {
        assert!(!r.reinforcement_forces.is_empty());
        assert!(
            r.reinforcement_forces
                .iter()
                .all(|f| f.status == ForceStatus::OutsideMass && f.fx == 0.0 && f.fy == 0.0),
            "{:?}",
            r.reinforcement_forces
        );
        assert!(r.warnings.iter().any(|w| w == "reinforcement_outside_mass"));
        let (a, b) = (r.fos.unwrap(), bare.results[i].fos.unwrap());
        assert!((a - b).abs() <= 1e-12 * b, "{a} against {b}");
    }
    let both = analyze_doc(&with(doc, json!([lens, main])));
    for (i, r) in both.results.iter().enumerate() {
        let n1: Vec<_> = r
            .reinforcement_forces
            .iter()
            .filter(|f| f.id == "N1")
            .collect();
        let n2: Vec<_> = r
            .reinforcement_forces
            .iter()
            .filter(|f| f.id == "N2")
            .collect();
        assert!(n1.iter().all(|f| f.status == ForceStatus::OutsideMass));
        assert_eq!(n2.len(), 1);
        assert_eq!(n2[0].status, ForceStatus::Applied);
        // The note is per reinforcement: N2 applies, so there is no note from it, and N1 raises it.
        assert!(r.warnings.iter().any(|w| w == "reinforcement_outside_mass"));
        assert!(r.fos.unwrap() > bare.results[i].fos.unwrap());
    }
}

// ----------------------------------------------------------------------------------------------- search

/// The search evaluates the crossings of every candidate: the active anchor raises the factor of the critical
/// circle, and the report carries the forces of the final surface only.
#[test]
fn search_with_reinforcements_uses_the_crossings_of_each_candidate() {
    let mut doc = v047a(json!(["bishop", "spencer"]));
    doc["analysis"].as_object_mut().unwrap().remove("surface");
    doc["analysis"]["search"] = json!({"type": "circular_entry_exit", "entry": [40.0, 60.0],
        "exit": [20.0, 40.0], "n_entry": 6, "n_exit": 6, "n_radius": 5});
    let bare = analyze_doc(&doc);
    let element = json!({"type": "anchor", "id": "A1", "x1": 52, "y1": 28, "x2": 25, "y2": 28,
        "application": "active", "tensile_capacity": 100, "direction": "axial"});
    let with_anchor = analyze_doc(&with(doc, json!([element])));
    for (r, b) in with_anchor.results.iter().zip(&bare.results) {
        assert!(r.fos.unwrap() > b.fos.unwrap(), "{:?}", r.method);
        assert!(r.search.is_some());
        // The forces are those of the reported surface (one entry per crossing, at most two for a horizontal line).
        assert!(r.reinforcement_forces.len() <= 2);
        for f in &r.reinforcement_forces {
            assert!((f.y - 28.0).abs() < 1e-9);
        }
    }
}
