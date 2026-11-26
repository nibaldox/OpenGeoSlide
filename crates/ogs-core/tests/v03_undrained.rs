//! Undrained material (amendment E13b, F3.2): the strength per slice, and the identity with Mohr-Coulomb.
//! Public API only.

mod f3_common;

use f3_common::*;
use serde_json::{Value, json};

fn as_mc(mut doc: Value, c: f64, phi: f64) -> Value {
    doc["materials"] = json!([{"id": "soil", "name": "Soil", "model": "mohr_coulomb",
                               "unit_weight": 20.0, "cohesion": c, "friction_angle": phi}]);
    doc
}

fn bits(x: Option<f64>) -> Option<u64> {
    x.map(f64::to_bits)
}

#[test]
fn mohr_coulomb_is_bit_identical_to_the_engine_before_v03() {
    // Values of V047a on the fixed circle, produced by the binary of `main` before the Phase 3 (`a970984`), in
    // versions 0.1 and 0.2.
    let golden: [(&str, f64, usize, Option<f64>); 2] = [
        ("bishop", 0.9851233619232898, 6, None),
        ("spencer", 0.9841447922361185, 43, Some(0.43241238814607363)),
    ];
    for version in ["0.1", "0.2", "0.3"] {
        let mut doc = v047a(json!(["bishop", "spencer"]));
        doc["version"] = json!(version);
        let report = run(&doc);
        for (res, (name, fos, iterations, lambda)) in report.results.iter().zip(golden) {
            assert_eq!(
                res.fos.map(f64::to_bits),
                Some(fos.to_bits()),
                "{name} {version}"
            );
            assert_eq!(res.iterations, iterations, "{name} {version}");
            assert_eq!(bits(res.lambda), bits(lambda), "{name} {version}");
            assert_eq!(res.warnings, vec!["truncated_mass".to_string()]);
            // Every slice of soil carries exactly (c, tan φ) of the material.
            let tan_phi = 19.6_f64.to_radians().tan();
            for s in res.slices.iter().filter(|s| s.weight > 0.0) {
                assert_eq!(s.cohesion.to_bits(), 3.0_f64.to_bits());
                assert_eq!(s.tan_phi.to_bits(), tan_phi.to_bits());
            }
        }
    }
}

#[test]
fn undrained_without_gradient_is_mohr_coulomb_with_phi_zero_bit_for_bit() {
    for su in [0.0, 0.5, 10.0, 25.0, 137.25] {
        for methods in [json!(["bishop", "spencer"]), json!(["spencer", "bishop"])] {
            let undrained = v047a_undrained(methods.clone(), json!({"undrained_strength": su}));
            let mc = as_mc(v047a(methods), su, 0.0);
            let (a, b) = (run(&undrained), run(&mc));
            assert_eq!(a, b, "Su = {su}: the whole report must be identical");
            // The comparison above is exact for floats; also compare the serialized text.
            assert_eq!(
                serde_json::to_string(&a).unwrap(),
                serde_json::to_string(&b).unwrap(),
                "Su = {su}"
            );
        }
    }
    // Also in a search, with water and a surcharge (so that every branch of the slicer is used).
    for method in ["bishop", "spencer"] {
        let mut mc = as_mc(v047a(json!([method])), 20.0, 0.0);
        mc["analysis"]["surface"] = Value::Null;
        mc["analysis"]["search"] =
            json!({"type": "circular_entry_exit", "n_entry": 6, "n_exit": 6, "n_radius": 4});
        mc["water"] = json!({"piezometric_line": [[20.0, 30.0], [70.0, 33.0]]});
        mc["loads"] = json!([{"type": "udl", "x1": 50.0, "x2": 60.0, "q": 10.0}]);
        let mut un = v047a_undrained(
            json!([method]),
            json!({"undrained_strength": 20.0, "ru": null}),
        );
        for k in ["water", "loads"] {
            un[k] = mc[k].clone();
        }
        un["analysis"] = mc["analysis"].clone();
        assert_eq!(run(&un), run(&mc), "{method} in a search");
    }
}

#[test]
fn ru_does_not_change_an_undrained_material() {
    // φ = 0: `ru` only changes the classification of N′ (warnings), never the strength or the FS.
    let base = v047a_undrained(
        json!(["bishop", "spencer"]),
        json!({"undrained_strength": 20.0}),
    );
    let with_ru = v047a_undrained(
        json!(["bishop", "spencer"]),
        json!({"undrained_strength": 20.0, "ru": 0.3}),
    );
    let (a, b) = (run(&base), run(&with_ru));
    for (x, y) in a.results.iter().zip(&b.results) {
        assert_eq!(bits(x.fos), bits(y.fos));
        assert_eq!(x.iterations, y.iterations);
    }
}

#[test]
fn slice_strength_follows_su_at_the_base_midpoint() {
    // Su(y) = max(0, Su0 + (datum − y)·g), then the cap. `cohesion` of each soil slice is Su at its base midpoint.
    let cases: [(f64, f64, f64, Option<f64>); 6] = [
        // (Su0, datum, gradient, limit)
        (10.0, 35.0, 1.0, None),
        (10.0, 35.0, 1.5, Some(25.0)),
        (10.0, 35.0, 1.5, Some(0.0)),
        (40.0, 35.0, -1.0, Some(30.0)),
        (40.0, 35.0, -1.0, None),
        (5.0, 30.0, 2.0, Some(60.0)), // above y = 32.5 the linear Su is negative: it is clamped to 0
    ];
    for (su0, datum, g, limit) in cases {
        let mut extra =
            json!({"undrained_strength": su0, "strength_datum": datum, "strength_gradient": g});
        if let Some(l) = limit {
            extra["strength_limit"] = json!(l);
        }
        let doc = v047a_undrained(json!(["bishop"]), extra);
        let report = run(&doc);
        let mut distinct = std::collections::BTreeSet::new();
        for s in report.results[0].slices.iter().filter(|s| s.weight > 0.0) {
            let y = 0.5 * (s.y_base_left + s.y_base_right);
            let mut want = (su0 + (datum - y) * g).max(0.0);
            if let Some(l) = limit {
                want = if g >= 0.0 { want.min(l) } else { want.max(l) };
            }
            assert_eq!(
                s.cohesion.to_bits(),
                want.to_bits(),
                "Su0 {su0} datum {datum} g {g} {limit:?} at y {y}"
            );
            assert_eq!(s.tan_phi, 0.0);
            distinct.insert(s.cohesion.to_bits());
        }
        assert!(
            distinct.len() > 1 || limit == Some(0.0),
            "the strength must vary: {su0} {g} {limit:?}"
        );
    }
}

#[test]
fn zero_gradient_with_datum_is_the_constant_strength() {
    let constant = v047a_undrained(json!(["bishop"]), json!({"undrained_strength": 18.0}));
    let flat = v047a_undrained(
        json!(["bishop"]),
        json!({"undrained_strength": 18.0, "strength_datum": 30.0, "strength_gradient": 0.0}),
    );
    assert_eq!(
        bits(run(&constant).results[0].fos),
        bits(run(&flat).results[0].fos)
    );
}

#[test]
fn fs_grows_with_su_and_with_a_positive_gradient() {
    for method in [0usize, 1] {
        let methods = json!(["bishop", "spencer"]);
        let mut last = 0.0;
        for su in [5.0, 10.0, 20.0, 40.0, 80.0] {
            let f = fos(
                &v047a_undrained(methods.clone(), json!({"undrained_strength": su})),
                method,
            );
            assert!(f > last, "method {method}: Su {su} gave {f} after {last}");
            last = f;
        }
        let mut last = 0.0;
        for g in [0.0, 0.5, 1.0, 2.0, 4.0] {
            let f = fos(
                &v047a_undrained(
                    methods.clone(),
                    json!({"undrained_strength": 10.0, "strength_datum": 35.0, "strength_gradient": g}),
                ),
                method,
            );
            assert!(
                f > last,
                "method {method}: gradient {g} gave {f} after {last}"
            );
            last = f;
        }
    }
}

#[test]
fn mirror_gives_the_same_fs_for_the_undrained_material() {
    let doc = v047a_undrained(
        json!(["bishop", "spencer"]),
        json!({"undrained_strength": 10.0, "strength_datum": 35.0, "strength_gradient": 1.0, "strength_limit": 30.0}),
    );
    let (a, b) = (run(&doc), run(&mirror(&doc)));
    for (x, y) in a.results.iter().zip(&b.results) {
        let (fx, fy) = (x.fos.unwrap(), y.fos.unwrap());
        assert!((fx - fy).abs() <= 1e-9 * fx, "{:?}: {fx} vs {fy}", x.method);
    }
}
