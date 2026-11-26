//! F3R-R11 (M-B): amendments E14o-2 and E14o-3 of `briefs/03_CONTRATOS_REFUERZOS.md` §F4.18, with the counter-examples of
//! R11A-02 and R11A-03 (`docs/reviews/R11_agy_A.md`).
//!
//! - E14o-2: Bishop converges with passive forces that have a vertical component (`passive_v < 0`): the sign change of
//!   `h(F) = F·D(F) − N(F)` is bracketed on a geometric grid before the bisection.
//! - E14o-3: E3 (`no_driving`) is evaluated only before the solve, with the active forces. A passive force is a
//!   resisting force and does not enter it; the check after the solve (and with it the moment of Bishop inside
//!   Janbu) is gone.
//!
//! The reference values are cSlope 0.1.0 (`$TMPDIR/oracle-venv`, `verification/harness/to_cslope.py`) on the same
//! models and the same fixed circle, at 50 slices.

mod f3_common;

use f3_common::*;
use ogs_core::methods::SolveStatus;
use serde_json::{Value, json};

const METHODS: [&str; 5] = [
    "bishop",
    "spencer",
    "morgenstern_price",
    "janbu_simplified",
    "janbu_corrected",
];

/// Relative tolerance of the criteria of E14o-2 and E14o-3.
const REL: f64 = 5e-3;

fn close(label: &str, got: f64, want: f64) {
    let rel = (got - want).abs() / want;
    assert!(
        rel <= REL,
        "{label}: ogs {got:.6}, cSlope {want:.6} ({:+.3} %)",
        100.0 * (got - want) / want
    );
}

/// FS of every method of `doc`, `None` for the ones that did not converge (with their warnings for the message).
fn five(mut doc: Value) -> Vec<(String, Option<f64>, Vec<String>)> {
    doc["analysis"]["methods"] = json!(METHODS);
    run(&doc)
        .results
        .iter()
        .map(|r| {
            let ok = r.status == SolveStatus::Converged;
            (
                format!("{:?}", r.method),
                if ok { r.fos } else { None },
                r.warnings.clone(),
            )
        })
        .collect()
}

fn expect(doc: &Value, want: [Option<f64>; 5]) {
    let got = five(doc.clone());
    for (i, w) in want.iter().enumerate() {
        let Some(w) = w else { continue };
        let (name, fos, warnings) = &got[i];
        let fos = fos.unwrap_or_else(|| panic!("{name} did not converge: {warnings:?}"));
        close(name, fos, *w);
    }
}

// ---------------------------------------------------------------------------------------------------------------
// R11A-02: slope 1:1, c = 2, φ = 25°, γ = 20, circle (8, 35, 25.5), passive pile at 45°, upward component.

fn slope_pile(with_pile: bool) -> Value {
    let mut doc = json!({
        "format": "opengeoslide", "version": "0.4",
        "meta": {"id": "r11a02", "title": "passive pile with an upward component"},
        "units": "SI",
        "materials": [{"id": "s", "name": "s", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 2.0, "friction_angle": 25.0}],
        "regions": [{"material": "s", "polygon": [[-10, 0], [-10, 5], [3, 5], [18, 20], [40, 20], [40, 0]]}],
        "reinforcements": [],
        "slope": {"direction": "right_to_left"},
        "analysis": {
            "methods": ["bishop"], "slices": 50, "tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2,
            "surface": {"type": "circle", "xc": 8.0, "yc": 35.0, "r": 25.5}
        }
    });
    if with_pile {
        doc["reinforcements"] = json!([{"id": "P1", "type": "pile", "x1": 18.0, "y1": 20.0, "x2": 18.0, "y2": 5.0,
            "application": "passive", "force": 2000.0, "direction": "angle", "angle": 45.0, "spacing": 1.0}]);
    }
    doc
}

/// Before E14o-2 Bishop answered `invalid ("m_alpha")` here. cSlope: 3.287945.
#[test]
fn e14o2_bishop_converges_with_a_passive_force_that_lifts() {
    let doc = slope_pile(true);
    let got = five(doc);
    let (_, fos, warnings) = &got[0];
    let fos = fos.unwrap_or_else(|| panic!("bishop did not converge: {warnings:?}"));
    close("bishop", fos, 3.287945);
    assert!(!warnings.iter().any(|w| w == "m_alpha"), "{warnings:?}");
}

/// The three force-equilibrium methods already answered; Bishop now agrees with them and with cSlope.
#[test]
fn e14o2_bishop_agrees_with_cslope_and_with_spencer() {
    let doc = slope_pile(true);
    let got = five(doc);
    let bishop = got[0].1.expect("bishop converged");
    let spencer = got[1].1.expect("spencer converged");
    assert!(
        (bishop - spencer).abs() / spencer < 5e-3,
        "{bishop} vs {spencer}"
    );
}

/// Without passive forces nothing changes: the five methods return the bits of the v0.2.0 solvers (base 3aa3369).
#[test]
fn e14o2_without_passive_forces_the_solution_is_the_same_to_the_bit() {
    let got = five(slope_pile(false));
    let want = [
        1.1429707175479369,
        1.1421897677796522,
        1.1421928613356969,
        1.089682887619632,
        1.144961940955362,
    ];
    for (i, w) in want.iter().enumerate() {
        assert_eq!(got[i].1, Some(*w), "{}", got[i].0);
    }
}

// ---------------------------------------------------------------------------------------------------------------
// R11A-03: V047a with a passive sheet pile (the three materials of the review).

fn v047a_pile(material: Value, force: f64, x: f64) -> Value {
    let mut doc = v047a(json!(["bishop"]));
    doc["version"] = json!("0.4");
    doc["materials"] = json!([material]);
    doc["reinforcements"] = json!([{"id": "SP", "type": "sheet_pile", "x1": x, "y1": 30.0, "x2": x, "y2": 20.0,
        "application": "passive", "force": force, "direction": "perpendicular"}]);
    doc
}

fn mohr(c: f64, phi: f64) -> Value {
    json!({"id": "soil", "name": "s", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": c, "friction_angle": phi})
}

/// Before E14o-3: Janbu (simplified and corrected) gave `no_driving`, because the check after the solve evaluated the
/// moment of Bishop at the F of the force equilibrium and subtracted the passive moment from it.
#[test]
fn e14o3_janbu_on_the_slope_with_the_45_degree_pile() {
    expect(
        &slope_pile(true),
        [
            Some(3.287945),
            Some(3.274569),
            Some(3.274965),
            Some(3.080659),
            Some(3.237005),
        ],
    );
}

/// V047a with c = 1, φ = 0 and a passive sheet pile of 2000 kN/m. cSlope: Janbu 4.456717 and 4.737317.
#[test]
fn e14o3_cohesive_soil_with_a_sheet_pile() {
    expect(
        &v047a_pile(mohr(1.0, 0.0), 2000.0, 40.0),
        [
            Some(4.885826),
            Some(4.885826),
            Some(4.885826),
            Some(4.456717),
            Some(4.737317),
        ],
    );
}

/// V047a with c = 0, φ = 10° and 3000 kN/m. cSlope: Janbu 7.054491 and 7.254041.
#[test]
fn e14o3_frictional_soil_with_a_sheet_pile() {
    expect(
        &v047a_pile(mohr(0.0, 10.0), 3000.0, 40.0),
        [
            Some(7.710283),
            Some(7.701415),
            Some(7.701728),
            Some(7.054491),
            Some(7.254041),
        ],
    );
}

/// A soil without strength (Su = 0) held only by the passive sheet pile of 500 kN/m: the resistance is the pile alone.
/// Before E14o-3 Bishop and the two Janbu answered `no_driving`. cSlope: 1.271456, 1.09878 and 1.129862.
#[test]
fn e14o3_soil_without_strength_held_by_the_sheet_pile() {
    let su0 = json!({"id": "soil", "name": "s", "model": "undrained", "unit_weight": 20.0, "undrained_strength": 0.0});
    expect(
        &v047a_pile(su0, 500.0, 35.0),
        [
            Some(1.271456),
            Some(1.271456),
            Some(1.271456),
            Some(1.09878),
            Some(1.129862),
        ],
    );
}

/// The guard of E3 stays where it is physical: a symmetric circle under a flat top does not drive (before the solve, with
/// the weight and the **active** forces), and it is `no_driving` with a passive force or without it.
#[test]
fn e14o3_a_surface_without_driving_stays_no_driving() {
    for with_pile in [false, true] {
        let mut doc = slope_pile(with_pile);
        doc["regions"] =
            json!([{"material": "s", "polygon": [[-10, 0], [-10, 20], [40, 20], [40, 0]]}]);
        doc["analysis"]["surface"] = json!({"type": "circle", "xc": 15.0, "yc": 20.0, "r": 12.0});
        doc["analysis"]["methods"] = json!(["bishop", "spencer", "janbu_simplified"]);
        for r in &run(&doc).results {
            assert_eq!(
                r.status,
                SolveStatus::Invalid,
                "pile {with_pile}, {:?}: {:?}",
                r.method,
                r.fos
            );
            assert!(
                r.warnings.iter().any(|w| w == "no_driving"),
                "pile {with_pile}, {:?}: {:?}",
                r.method,
                r.warnings
            );
        }
    }
}
