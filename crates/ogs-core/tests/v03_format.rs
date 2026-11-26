//! Format v0.3 (amendments E13a-E13d, E13f): the version gate, the new types and their validation, and the
//! serialization of the new fields. Public API only. See `briefs/02_CONTRATOS_FASE3.md`, F3.1 to F3.6.

mod f3_common;

use f3_common::*;
use ogs_core::model::{
    AnalysisSettings, IntersliceFunction, IntersliceSpec, MaterialModel, MethodKind, Model,
    SurfaceSpec,
};
use serde_json::{Value, json};

const GATE: &str = "requiere version \"0.3\"";

fn with_version(mut doc: Value, v: &str) -> Value {
    doc["version"] = json!(v);
    doc
}

/// One document per v0.3 field, in the order in which the contract lists them (F3.1), with the token that the
/// error must name.
fn gated_documents() -> Vec<(&'static str, Value)> {
    let mut out: Vec<(&'static str, Value)> = Vec::new();
    // model: "undrained" (with its required field: the first field that needs 0.3 is `model`).
    out.push((
        "undrained",
        v047a_undrained(json!(["bishop"]), json!({"undrained_strength": 25.0})),
    ));
    for (field, extra) in [
        ("undrained_strength", json!({"undrained_strength": 5.0})),
        ("strength_datum", json!({"strength_datum": 30.0})),
        ("strength_gradient", json!({"strength_gradient": 1.0})),
        ("strength_limit", json!({"strength_limit": 50.0})),
    ] {
        // On a Mohr-Coulomb material, so that `model: "undrained"` is not the first field that needs 0.3.
        let mut doc = v047a(json!(["bishop"]));
        for (k, v) in extra.as_object().unwrap() {
            doc["materials"][0][k] = v.clone();
        }
        out.push((field, doc));
    }
    let mut doc = v047a(json!(["spencer"]));
    set_polyline(&mut doc, &POLYLINE);
    out.push(("polyline", doc));
    for m in ["morgenstern_price", "janbu_simplified", "janbu_corrected"] {
        out.push((m, v047a(json!([m]))));
    }
    let mut doc = v047a(json!(["bishop"]));
    doc["analysis"]["interslice"] = json!({"function": "constant"});
    out.push(("interslice", doc));
    out
}

#[test]
fn every_new_field_needs_version_03() {
    for (token, doc) in gated_documents() {
        for old in ["0.1", "0.2"] {
            let msg = reject(&with_version(doc.clone(), old));
            assert!(
                msg.starts_with("InvalidModel:") && msg.contains(GATE) && msg.contains(token),
                "version {old}, field {token}: got {msg:?}"
            );
        }
    }
}

#[test]
fn the_gate_names_the_first_field_that_needs_version_03() {
    // `model: "undrained"` comes before `undrained_strength`, and `undrained_strength` before `strength_datum`.
    let doc = v047a_undrained(
        json!(["bishop"]),
        json!({"undrained_strength": 20.0, "strength_datum": 30.0, "strength_gradient": 1.0}),
    );
    let msg = reject(&with_version(doc, "0.2"));
    assert!(
        msg.contains("model") && msg.contains("undrained") && msg.contains(GATE),
        "{msg}"
    );
    assert!(!msg.contains("strength_datum"), "{msg}");
    // A polyline comes before a new method, and a new method before `interslice`.
    let mut doc = v047a(json!(["morgenstern_price"]));
    set_polyline(&mut doc, &POLYLINE);
    doc["analysis"]["interslice"] = json!({"function": "constant"});
    let msg = reject(&with_version(doc.clone(), "0.2"));
    assert!(msg.contains("polyline") && msg.contains(GATE), "{msg}");
    doc["analysis"]["surface"] = Value::Null;
    doc["analysis"]["surface"] = json!({"type": "circle", "xc": 30.0, "yc": 50.0, "r": 30.0});
    let msg = reject(&with_version(doc, "0.2"));
    assert!(
        msg.contains("morgenstern_price") && msg.contains(GATE),
        "{msg}"
    );
}

#[test]
fn unknown_versions_are_rejected_and_the_message_lists_the_three() {
    let msg = reject(&with_version(v047a(json!(["bishop"])), "0.6"));
    assert!(
        msg.starts_with("InvalidModel:")
            && msg.contains("0.1")
            && msg.contains("0.2")
            && msg.contains("0.3"),
        "{msg}"
    );
}

#[test]
fn a_model_without_new_fields_gives_the_same_report_in_0_1_0_2_and_0_3() {
    // Bit-identical `fos`, `status`, `iterations`, `lambda`, `warnings` and surface, and also the slices.
    let base = v047a(json!(["bishop", "spencer"]));
    let r1 = run(&with_version(base.clone(), "0.1"));
    for v in ["0.2", "0.3"] {
        let r = run(&with_version(base.clone(), v));
        assert_eq!(r.results.len(), r1.results.len());
        for (a, b) in r.results.iter().zip(&r1.results) {
            assert_eq!(a.fos.map(f64::to_bits), b.fos.map(f64::to_bits));
            assert_eq!(a.status, b.status);
            assert_eq!(a.iterations, b.iterations);
            assert_eq!(a.lambda.map(f64::to_bits), b.lambda.map(f64::to_bits));
            assert_eq!(a.warnings, b.warnings);
            assert_eq!(a, b);
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// F3.2: undrained material

fn undrained_doc(extra: Value) -> Value {
    v047a_undrained(json!(["bishop"]), extra)
}

#[test]
fn undrained_material_validation() {
    // (description, document, tokens of the message)
    let mut cases: Vec<(&str, Value, Vec<&str>)> = vec![
        (
            "falta undrained_strength",
            undrained_doc(json!({})),
            vec!["undrained_strength", "'soil'"],
        ),
        (
            "cohesion prohibida",
            undrained_doc(json!({"undrained_strength": 20.0, "cohesion": 3.0})),
            vec!["cohesion", "'soil'"],
        ),
        (
            "friction_angle prohibido",
            undrained_doc(json!({"undrained_strength": 20.0, "friction_angle": 0.0})),
            vec!["friction_angle", "'soil'"],
        ),
        (
            "Su negativa",
            undrained_doc(json!({"undrained_strength": -1.0})),
            vec!["undrained_strength", "≥ 0"],
        ),
        (
            "datum sin gradient",
            undrained_doc(json!({"undrained_strength": 20.0, "strength_datum": 30.0})),
            vec!["strength_datum", "strength_gradient"],
        ),
        (
            "gradient sin datum",
            undrained_doc(json!({"undrained_strength": 20.0, "strength_gradient": 1.0})),
            vec!["strength_gradient", "strength_datum"],
        ),
        (
            "limit sin gradient",
            undrained_doc(json!({"undrained_strength": 20.0, "strength_limit": 40.0})),
            vec!["strength_limit", "strength_gradient"],
        ),
        (
            "limit negativo",
            undrained_doc(json!({"undrained_strength": 20.0, "strength_datum": 30.0,
                                 "strength_gradient": 1.0, "strength_limit": -5.0})),
            vec!["strength_limit", "≥ 0"],
        ),
        (
            "unit_weight_sat no positivo",
            undrained_doc(json!({"undrained_strength": 20.0, "unit_weight_sat": 0.0})),
            vec!["saturado"],
        ),
        (
            "ru fuera de rango",
            undrained_doc(json!({"undrained_strength": 20.0, "ru": 1.0})),
            vec!["ru"],
        ),
    ];
    // A Mohr-Coulomb material may not carry undrained fields, and must have its own.
    for (field, value) in [
        ("undrained_strength", json!(5.0)),
        ("strength_datum", json!(30.0)),
        ("strength_gradient", json!(1.0)),
        ("strength_limit", json!(50.0)),
    ] {
        let mut doc = v047a(json!(["bishop"]));
        doc["materials"][0][field] = value;
        cases.push((
            "mohr_coulomb con campo no drenado",
            doc,
            vec![field, "mohr_coulomb"],
        ));
    }
    for field in ["cohesion", "friction_angle"] {
        let mut doc = v047a(json!(["bishop"]));
        doc["materials"][0].as_object_mut().unwrap().remove(field);
        cases.push(("mohr_coulomb sin campo", doc, vec![field, "mohr_coulomb"]));
    }
    for (what, doc, tokens) in cases {
        let msg = reject(&doc);
        assert!(
            msg.starts_with("InvalidModel:") && tokens.iter().all(|t| msg.contains(t)),
            "{what}: expected InvalidModel mentioning {tokens:?}, got {msg:?}"
        );
    }
}

#[test]
fn undrained_material_variants_that_are_valid() {
    for extra in [
        json!({"undrained_strength": 0.0}),
        json!({"undrained_strength": 25.0}),
        json!({"undrained_strength": 25.0, "unit_weight_sat": 21.0, "ru": 0.3}),
        json!({"undrained_strength": 10.0, "strength_datum": 35.0, "strength_gradient": 1.0}),
        json!({"undrained_strength": 10.0, "strength_datum": 35.0, "strength_gradient": -1.0}),
        json!({"undrained_strength": 10.0, "strength_datum": 35.0, "strength_gradient": 0.0,
               "strength_limit": 0.0}),
        json!({"undrained_strength": 10.0, "strength_datum": 35.0, "strength_gradient": 1.5,
               "strength_limit": 60.0}),
    ] {
        let doc = undrained_doc(extra.clone());
        assert!(passes_validation(&doc), "must be admitted: {extra}");
    }
}

#[test]
fn undrained_non_finite_values_are_rejected_through_the_struct() {
    use ogs_core::analyze;
    let doc = undrained_doc(json!({"undrained_strength": 10.0, "strength_datum": 35.0,
                                   "strength_gradient": 1.0, "strength_limit": 60.0}));
    for field in [
        "undrained_strength",
        "strength_datum",
        "strength_gradient",
        "strength_limit",
    ] {
        for bad in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            let mut m: Model = serde_json::from_value(doc.clone()).unwrap();
            let mat = &mut m.materials[0];
            match field {
                "undrained_strength" => mat.undrained_strength = Some(bad),
                "strength_datum" => mat.strength_datum = Some(bad),
                "strength_gradient" => mat.strength_gradient = Some(bad),
                _ => mat.strength_limit = Some(bad),
            }
            let err = analyze(&m).expect_err(&format!("{field} = {bad} must be rejected"));
            let text = err.to_string();
            assert!(
                text.starts_with("InvalidModel:") && text.contains(field),
                "{text}"
            );
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// F3.3 / F3.6: polyline format and methods

#[test]
fn polyline_format_validation() {
    let cases: Vec<(&str, Vec<[f64; 2]>, &str)> = vec![
        ("un punto", vec![[30.0, 25.0]], "al menos 2 puntos"),
        (
            "x repetida",
            vec![[30.0, 25.0], [30.0, 26.0], [40.0, 27.0]],
            "estrictamente creciente",
        ),
        (
            "x decreciente",
            vec![[40.0, 25.0], [35.0, 26.0], [30.0, 27.0]],
            "estrictamente creciente",
        ),
        // The model is 50 wide: the minimum separation is 1e-9 · 50 = 5e-8.
        (
            "separación bajo 1e-9·ancho",
            vec![[30.0, 25.0], [30.00000001, 26.0], [40.0, 30.0]],
            "estrictamente creciente",
        ),
    ];
    for (what, pts, needle) in cases {
        let mut doc = v047a(json!(["spencer"]));
        set_polyline(&mut doc, &pts);
        let msg = reject(&doc);
        assert!(
            msg.starts_with("InvalidModel:") && msg.contains("polilínea") && msg.contains(needle),
            "{what}: got {msg:?}"
        );
    }
    // Non-finite coordinates, through the struct.
    let mut doc = v047a(json!(["spencer"]));
    set_polyline(&mut doc, &POLYLINE);
    let mut m: Model = serde_json::from_value(doc).unwrap();
    m.analysis.surface = Some(SurfaceSpec::Polyline {
        points: vec![[30.0, f64::NAN], [40.0, 30.0]],
    });
    let err = ogs_core::analyze(&m)
        .expect_err("NaN in a polyline")
        .to_string();
    assert!(
        err.starts_with("InvalidModel:") && err.contains("polilínea"),
        "{err}"
    );
    // Valid: separation just above 1e-9 · width.
    let mut doc = v047a(json!(["spencer"]));
    set_polyline(
        &mut doc,
        &[[30.0, 25.0], [30.0001, 25.1], [40.0, 30.0], [51.0, 35.0]],
    );
    assert!(passes_validation(&doc));
}

#[test]
fn polyline_is_ignored_and_not_a_format_error_when_a_search_is_declared_but_still_validated() {
    // The format of the polyline is checked even if `search` takes precedence.
    let mut doc = v047a(json!(["spencer"]));
    set_polyline(&mut doc, &[[30.0, 25.0]]);
    doc["analysis"]["search"] = json!({"type": "circular_entry_exit"});
    expect_invalid(&doc, &["polilínea"]);
}

#[test]
fn bishop_does_not_admit_a_polyline() {
    for methods in [json!(["bishop"]), json!(["spencer", "bishop"])] {
        let mut doc = v047a(methods);
        set_polyline(&mut doc, &POLYLINE);
        let msg = reject(&doc);
        assert_eq!(
            msg,
            "InvalidModel: el método 'bishop' solo admite superficies circulares; \
             use spencer, morgenstern_price o janbu"
        );
    }
    // The other methods are admitted by the validation with a polyline (they stop at the stub of F3-W1a/W1b).
    for m in [
        "spencer",
        "morgenstern_price",
        "janbu_simplified",
        "janbu_corrected",
    ] {
        let mut doc = v047a(json!([m]));
        set_polyline(&mut doc, &POLYLINE);
        assert!(
            passes_validation(&doc),
            "{m} with a polyline must pass the validation"
        );
    }
}

// ---------------------------------------------------------------------------------------------------------------
// F3.4: interslice

fn mp_doc(interslice: Value) -> Value {
    let mut doc = v047a(json!(["morgenstern_price"]));
    doc["analysis"]["interslice"] = interslice;
    doc
}

#[test]
fn interslice_validation() {
    let cases: Vec<(&str, Value, &str)> = vec![
        (
            "sin morgenstern_price",
            json!({"function": "constant"}),
            "morgenstern_price",
        ),
        (
            "points con half_sine",
            json!({"function": "half_sine", "points": [[0, 0], [1, 1]]}),
            "data_points",
        ),
        (
            "data_points sin points",
            json!({"function": "data_points"}),
            "points",
        ),
        (
            "un solo punto",
            json!({"function": "data_points", "points": [[0.0, 1.0]]}),
            "al menos 2",
        ),
        (
            "no empieza en 0",
            json!({"function": "data_points", "points": [[0.1, 1.0], [1.0, 1.0]]}),
            "ξ = 0",
        ),
        (
            "no termina en 1",
            json!({"function": "data_points", "points": [[0.0, 1.0], [0.9, 1.0]]}),
            "ξ = 1",
        ),
        (
            "ξ no creciente",
            json!({"function": "data_points", "points": [[0.0, 1.0], [0.5, 1.0], [0.5, 2.0], [1.0, 1.0]]}),
            "estrictamente creciente",
        ),
        (
            "f negativa",
            json!({"function": "data_points", "points": [[0.0, 0.0], [0.5, -1.0], [1.0, 1.0]]}),
            "f ≥ 0",
        ),
        (
            "f idénticamente 0",
            json!({"function": "data_points", "points": [[0.0, 0.0], [1.0, 0.0]]}),
            "f > 0",
        ),
    ];
    for (what, interslice, needle) in cases {
        let doc = if what == "sin morgenstern_price" {
            let mut d = v047a(json!(["spencer"]));
            d["analysis"]["interslice"] = interslice;
            d
        } else {
            mp_doc(interslice)
        };
        let msg = reject(&doc);
        assert!(
            msg.starts_with("InvalidModel:") && msg.contains("interslice") && msg.contains(needle),
            "{what}: got {msg:?}"
        );
    }
    // Unknown function and unknown field: serde (`InvalidModel` through `analyze_json`).
    expect_invalid(&mp_doc(json!({"function": "parabola"})), &["parabola"]);
    expect_invalid(
        &mp_doc(json!({"function": "constant", "scale": 2.0})),
        &["scale"],
    );
    expect_invalid(&mp_doc(json!({})), &["function"]);
}

#[test]
fn interslice_non_finite_values_are_rejected_through_the_struct() {
    let mut m: Model = serde_json::from_value(mp_doc(json!({"function": "constant"}))).unwrap();
    m.analysis.interslice = Some(IntersliceSpec {
        function: IntersliceFunction::DataPoints,
        points: Some(vec![[0.0, 1.0], [0.5, f64::NAN], [1.0, 1.0]]),
    });
    let err = ogs_core::analyze(&m)
        .expect_err("NaN in data_points")
        .to_string();
    assert!(
        err.starts_with("InvalidModel:") && err.contains("interslice"),
        "{err}"
    );
}

#[test]
fn interslice_valid_variants() {
    for interslice in [
        json!({"function": "constant"}),
        json!({"function": "half_sine"}),
        json!({"function": "clipped_sine"}),
        json!({"function": "trapezoidal"}),
        json!({"function": "data_points", "points": [[0.0, 0.0], [0.5, 1.0], [1.0, 0.0]]}),
        json!({"function": "data_points", "points": [[0.0, 1.0], [1.0, 1.0]]}),
        json!({"function": "data_points", "points": [[0.0, 0.0], [1.0, 1.0]]}),
    ] {
        assert!(
            passes_validation(&mp_doc(interslice.clone())),
            "must be admitted: {interslice}"
        );
    }
    // `morgenstern_price` without `interslice` is admitted (half_sine by default).
    assert!(passes_validation(&v047a(json!(["morgenstern_price"]))));
}

// ---------------------------------------------------------------------------------------------------------------
// Types and serialization

#[test]
fn new_types_parse_and_serialize_with_the_contract_names() {
    let doc = json!({
        "format": "opengeoslide", "version": "0.3",
        "materials": [{"id": "arcilla", "name": "Arcilla blanda", "model": "undrained", "unit_weight": 18.0,
                       "undrained_strength": 20.0, "strength_datum": 30.0, "strength_gradient": 1.5,
                       "strength_limit": 60.0}],
        "regions": [{"material": "arcilla", "polygon": [[0, 0], [10, 0], [10, 5]]}],
        "analysis": {
            "methods": ["spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"],
            "interslice": {"function": "data_points", "points": [[0.0, 0.0], [0.5, 1.0], [1.0, 0.0]]},
            "surface": {"type": "polyline", "points": [[30.0, 25.0], [40.0, 26.9], [51.3, 35.0]]}
        }
    });
    let m: Model = serde_json::from_value(doc.clone()).expect("the contract example parses");
    assert_eq!(m.materials[0].model, MaterialModel::Undrained);
    assert_eq!(m.materials[0].undrained_strength, Some(20.0));
    assert_eq!(m.materials[0].strength_datum, Some(30.0));
    assert_eq!(m.materials[0].strength_gradient, Some(1.5));
    assert_eq!(m.materials[0].strength_limit, Some(60.0));
    assert!(m.materials[0].cohesion.is_none() && m.materials[0].friction_angle.is_none());
    assert_eq!(
        m.analysis.methods,
        vec![
            MethodKind::Spencer,
            MethodKind::MorgensternPrice,
            MethodKind::JanbuSimplified,
            MethodKind::JanbuCorrected
        ]
    );
    assert_eq!(
        m.analysis.interslice,
        Some(IntersliceSpec {
            function: IntersliceFunction::DataPoints,
            points: Some(vec![[0.0, 0.0], [0.5, 1.0], [1.0, 0.0]])
        })
    );
    assert!(
        matches!(&m.analysis.surface, Some(SurfaceSpec::Polyline { points }) if points.len() == 3)
    );
    // Round trip: the same value comes back, with the same names.
    let back = serde_json::to_value(&m).unwrap();
    assert_eq!(back["analysis"]["methods"], doc["analysis"]["methods"]);
    assert_eq!(
        back["analysis"]["interslice"],
        doc["analysis"]["interslice"]
    );
    assert_eq!(back["analysis"]["surface"], doc["analysis"]["surface"]);
    assert_eq!(back["materials"][0]["undrained_strength"], json!(20.0));
    assert!(
        back["materials"][0].get("cohesion").is_none(),
        "an absent cohesion is not written"
    );
    let again: Model = serde_json::from_value(back).unwrap();
    assert_eq!(m, again);
}

#[test]
fn a_model_without_new_fields_does_not_serialize_any_of_them() {
    let m: Model = serde_json::from_value(v047a(json!(["bishop"]))).unwrap();
    let v = serde_json::to_value(&m).unwrap();
    for key in [
        "undrained_strength",
        "strength_datum",
        "strength_gradient",
        "strength_limit",
    ] {
        assert!(v["materials"][0].get(key).is_none(), "{key}");
    }
    assert!(v["analysis"].get("interslice").is_none());
    assert_eq!(v["materials"][0]["cohesion"], json!(3.0));
    assert_eq!(v["materials"][0]["friction_angle"], json!(19.6));
    let d = AnalysisSettings::default();
    assert!(
        serde_json::to_value(&d)
            .unwrap()
            .get("interslice")
            .is_none()
    );
}

#[test]
fn new_types_keep_deny_unknown_fields() {
    let mut doc = v047a(json!(["bishop"]));
    doc["materials"][0]["undrained_stength"] = json!(1.0);
    expect_invalid(&doc, &["undrained_stength"]);
    let mut doc = v047a(json!(["spencer"]));
    doc["analysis"]["surface"] =
        json!({"type": "polyline", "points": [[30.0, 25.0], [40.0, 30.0]], "closed": true});
    expect_invalid(&doc, &["closed"]);
    let mut doc = v047a(json!(["spencer"]));
    doc["analysis"]["surface"] = json!({"type": "polyline"});
    expect_invalid(&doc, &["points"]);
}
