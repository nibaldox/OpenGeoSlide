//! Format v0.6 (F6.1 to F6.7) in the engine: the version gate, the validation of the Hoek-Brown and SHANSEP
//! materials and of `analysis.search.non_circular`, the serde round trip, the derived Hoek-Brown parameters, the B0
//! stubs, and the identity of a v0.5 model raised to v0.6.
//!
//! `verdict` counts a document as accepted when it is analysed, when it reaches a B0 stub (`todo!("F3B-M-…")`), or
//! when it fails only because there is no valid surface (`NoSurface` / `NoValidSurface`): the validation passed.

mod f3_common;

use f3_common::*;
use ogs_core::analyze_json;
use ogs_core::model::{Model, NonCircularSpec, SearchSpec, ShansepSpec};
use ogs_core::strength::hoek_brown_mb_s_a;
use serde_json::{Value, json};
use std::panic::{AssertUnwindSafe, catch_unwind};

// --------------------------------------------------------------------------------------------------- helpers

/// `Accepted` when the document passes the validation; `Rejected(text)` with the engine error otherwise.
enum Verdict {
    Accepted,
    Rejected(String),
}

fn panic_text(payload: Box<dyn std::any::Any + Send>) -> String {
    payload
        .downcast_ref::<String>()
        .cloned()
        .or_else(|| payload.downcast_ref::<&str>().map(|s| (*s).to_string()))
        .unwrap_or_default()
}

fn verdict(doc: &Value) -> Verdict {
    match catch_unwind(AssertUnwindSafe(|| analyze_json(&doc.to_string()))) {
        Ok(Ok(_)) => Verdict::Accepted,
        Ok(Err(e)) if e.starts_with("NoValidSurface:") || e.starts_with("NoSurface:") => {
            Verdict::Accepted
        }
        Ok(Err(e)) => Verdict::Rejected(e),
        Err(payload) => {
            let text = panic_text(payload);
            if text.contains("F3B-M") {
                Verdict::Accepted
            } else {
                panic!("unexpected panic: {text}");
            }
        }
    }
}

fn expect_accepted(doc: &Value) {
    match verdict(doc) {
        Verdict::Accepted => {}
        Verdict::Rejected(e) => panic!("debe aceptarse, dio {e}\n{doc}"),
    }
}

fn expect_rejected(doc: &Value, needles: &[&str]) {
    match verdict(doc) {
        Verdict::Rejected(e) => assert!(
            e.starts_with("InvalidModel:") && needles.iter().all(|n| e.contains(n)),
            "se esperaba InvalidModel con {needles:?}, dio {e}\n{doc}"
        ),
        _ => panic!("debe rechazarse, se aceptó: {doc}"),
    }
}

/// V047a raised to version 0.6 (a plain model, no 0.6 field).
fn v06(methods: Value) -> Value {
    let mut doc = v047a(methods);
    doc["version"] = json!("0.6");
    doc
}

fn hoek_brown_material() -> Value {
    json!({"id": "soil", "name": "Soil", "model": "hoek_brown", "unit_weight": 20.0,
           "ucs": 30000.0, "gsi": 50.0, "mi": 10.0, "disturbance": 0.7})
}

fn shansep_material() -> Value {
    json!({"id": "soil", "name": "Soil", "model": "shansep", "unit_weight": 18.0,
           "shansep": {"ratio": 0.25, "ocr": 1.5}})
}

fn hoek_brown_doc() -> Value {
    let mut doc = v06(json!(["bishop"]));
    doc["materials"] = json!([hoek_brown_material()]);
    doc
}

fn shansep_doc() -> Value {
    let mut doc = v06(json!(["bishop"]));
    doc["materials"] = json!([shansep_material()]);
    doc
}

/// Sets or (for the sentinel `_DEL`) removes a field of `materials[0]`.
fn mat_field(mut doc: Value, field: &str, value: Value) -> Value {
    if value.is_null() && field.starts_with('-') {
        doc["materials"][0]
            .as_object_mut()
            .unwrap()
            .remove(&field[1..]);
    } else {
        doc["materials"][0][field] = value;
    }
    doc
}

// --------------------------------------------------------------------------------------------------- F6.1: the gate

#[test]
fn every_v06_field_needs_version_0_6() {
    // The two material models.
    for (model, extra) in [
        ("hoek_brown", hoek_brown_material()),
        ("shansep", shansep_material()),
    ] {
        let mut doc = v047a(json!(["bishop"]));
        doc["version"] = json!("0.5");
        doc["materials"] = json!([extra]);
        expect_rejected(
            &doc,
            &[
                &format!("materials[0].model = \"{model}\""),
                "requiere version \"0.6\"",
            ],
        );
    }
    // The five fields, in any material.
    for (field, value) in [
        ("ucs", json!(30000.0)),
        ("gsi", json!(50.0)),
        ("mi", json!(10.0)),
        ("disturbance", json!(0.7)),
        ("shansep", json!({"ratio": 0.25, "ocr": 1.5})),
    ] {
        let mut doc = v047a(json!(["bishop"]));
        doc["version"] = json!("0.5");
        doc["materials"][0][field] = value;
        expect_rejected(
            &doc,
            &[&format!("materials[0].{field}"), "requiere version \"0.6\""],
        );
    }
    // `analysis.search.non_circular` is last.
    let mut doc = v047a(json!(["spencer"]));
    doc["version"] = json!("0.5");
    doc["analysis"]["search"] = json!({"type": "circular_entry_exit", "non_circular": {}});
    expect_rejected(
        &doc,
        &["analysis.search.non_circular", "requiere version \"0.6\""],
    );
}

#[test]
fn the_v06_gate_names_the_first_field_in_contract_order() {
    // `model` comes before its fields.
    let mut doc = v047a(json!(["bishop"]));
    doc["version"] = json!("0.5");
    doc["materials"] = json!([hoek_brown_material()]);
    let Verdict::Rejected(msg) = verdict(&doc) else {
        panic!("must be rejected");
    };
    assert!(msg.contains("materials[0].model = \"hoek_brown\""), "{msg}");
    assert!(!msg.contains("ucs"), "{msg}");

    // `ucs` before `gsi`.
    let mut doc = v047a(json!(["bishop"]));
    doc["version"] = json!("0.5");
    doc["materials"][0]["gsi"] = json!(50.0);
    doc["materials"][0]["ucs"] = json!(30000.0);
    expect_rejected(&doc, &["materials[0].ucs"]);

    // A field of a later material does not hide the model of an earlier one.
    let mut doc = v047a(json!(["bishop"]));
    doc["version"] = json!("0.5");
    doc["materials"].as_array_mut().unwrap().push(json!(
        {"id": "m2", "name": "M2", "model": "mohr_coulomb", "unit_weight": 20.0,
         "cohesion": 3.0, "friction_angle": 19.6, "ucs": 30000.0}
    ));
    doc["materials"][0] = json!({"id": "soil", "name": "Soil", "model": "shansep",
                                 "unit_weight": 18.0, "shansep": {"ratio": 0.25, "ocr": 1.5}});
    expect_rejected(&doc, &["materials[0].model = \"shansep\""]);

    // `non_circular` comes after every material field.
    let mut doc = v047a(json!(["spencer"]));
    doc["version"] = json!("0.5");
    doc["materials"][0]["shansep"] = json!({"ratio": 0.25, "ocr": 1.5});
    doc["analysis"]["search"] = json!({"type": "circular_entry_exit", "non_circular": {}});
    expect_rejected(&doc, &["materials[0].shansep"]);
}

#[test]
fn the_previous_gates_open_to_0_6() {
    // A v0.3, v0.4 and v0.5 field is admitted in 0.6.
    let mut doc = v047a_undrained(json!(["bishop"]), json!({"undrained_strength": 20.0}));
    doc["version"] = json!("0.6");
    expect_accepted(&doc);

    let mut doc = v047a(json!(["bishop"]));
    doc["version"] = json!("0.6");
    doc["reinforcements"] = json!([{"id": "a1", "type": "anchor", "x1": 52.0, "y1": 28.0,
        "x2": 25.0, "y2": 28.0, "tensile_capacity": 100.0, "application": "active", "direction": "axial"}]);
    expect_accepted(&doc);

    let mut doc = v047a(json!(["bishop"]));
    doc["version"] = json!("0.6");
    doc["analysis"]["tension_crack"] = json!({"depth": 2.0, "water_fill": 1.0});
    expect_accepted(&doc);
}

// --------------------------------------------------------------------------------------------------- F6.2: Hoek-Brown

#[test]
fn hoek_brown_validation() {
    expect_accepted(&hoek_brown_doc());
    // Required fields.
    for field in ["ucs", "gsi", "mi", "disturbance"] {
        expect_rejected(
            &mat_field(hoek_brown_doc(), &format!("-{field}"), Value::Null),
            &[field, "requiere el campo"],
        );
    }
    // Forbidden fields.
    for field in [
        "cohesion",
        "friction_angle",
        "undrained_strength",
        "strength_datum",
        "strength_gradient",
        "strength_limit",
        "shansep",
    ] {
        let value = match field {
            "cohesion" | "undrained_strength" => json!(5.0),
            "friction_angle" => json!(20.0),
            "strength_datum" => json!(30.0),
            "strength_gradient" => json!(1.0),
            "strength_limit" => json!(50.0),
            _ => json!({"ratio": 0.25, "ocr": 1.5}),
        };
        expect_rejected(
            &mat_field(hoek_brown_doc(), field, value),
            &[field, "no admite el campo"],
        );
    }
    // Ranges.
    expect_rejected(
        &mat_field(hoek_brown_doc(), "ucs", json!(0.0)),
        &["ucs", "> 0"],
    );
    expect_rejected(
        &mat_field(hoek_brown_doc(), "ucs", json!(-1.0)),
        &["ucs", "> 0"],
    );
    expect_rejected(
        &mat_field(hoek_brown_doc(), "gsi", json!(-0.1)),
        &["GSI", "[0, 100]"],
    );
    expect_rejected(
        &mat_field(hoek_brown_doc(), "gsi", json!(100.1)),
        &["GSI", "[0, 100]"],
    );
    expect_rejected(
        &mat_field(hoek_brown_doc(), "mi", json!(0.0)),
        &["mi", "> 0"],
    );
    expect_rejected(
        &mat_field(hoek_brown_doc(), "disturbance", json!(-0.1)),
        &["disturbance", "[0, 1]"],
    );
    expect_rejected(
        &mat_field(hoek_brown_doc(), "disturbance", json!(1.1)),
        &["disturbance", "[0, 1]"],
    );
    // Boundaries are admitted.
    expect_accepted(&mat_field(hoek_brown_doc(), "gsi", json!(0.0)));
    expect_accepted(&mat_field(hoek_brown_doc(), "gsi", json!(100.0)));
    expect_accepted(&mat_field(hoek_brown_doc(), "disturbance", json!(0.0)));
    expect_accepted(&mat_field(hoek_brown_doc(), "disturbance", json!(1.0)));
}

#[test]
fn hoek_brown_fields_are_forbidden_in_the_other_models() {
    for base in [
        v047a(json!(["bishop"])),
        v047a_undrained(json!(["bishop"]), json!({"undrained_strength": 20.0})),
    ] {
        let mut doc = base.clone();
        doc["version"] = json!("0.6");
        for (field, value) in [
            ("ucs", json!(30000.0)),
            ("gsi", json!(50.0)),
            ("mi", json!(10.0)),
            ("disturbance", json!(0.7)),
        ] {
            let mut d = doc.clone();
            d["materials"][0][field] = value;
            expect_rejected(&d, &[field, "no admite el campo"]);
        }
    }
    // `shansep` field is forbidden in mohr_coulomb, undrained and hoek_brown.
    for doc in [
        v047a(json!(["bishop"])),
        v047a_undrained(json!(["bishop"]), json!({"undrained_strength": 20.0})),
        hoek_brown_doc(),
    ] {
        let mut d = doc;
        d["version"] = json!("0.6");
        d["materials"][0]["shansep"] = json!({"ratio": 0.25, "ocr": 1.5});
        expect_rejected(&d, &["shansep", "no admite el campo"]);
    }
}

// --------------------------------------------------------------------------------------------------- F6.3: SHANSEP

#[test]
fn shansep_validation() {
    expect_accepted(&shansep_doc());
    // Required.
    expect_rejected(
        &mat_field(shansep_doc(), "-shansep", Value::Null),
        &["shansep", "requiere el campo"],
    );
    // Forbidden.
    for field in [
        "cohesion",
        "friction_angle",
        "undrained_strength",
        "strength_datum",
        "strength_gradient",
        "strength_limit",
        "ucs",
        "gsi",
        "mi",
        "disturbance",
    ] {
        let value = match field {
            "cohesion" | "undrained_strength" | "ucs" => json!(5.0),
            "friction_angle" | "gsi" | "mi" => json!(20.0),
            "strength_datum" => json!(30.0),
            "strength_gradient" => json!(1.0),
            "strength_limit" => json!(50.0),
            _ => json!(0.7),
        };
        expect_rejected(
            &mat_field(shansep_doc(), field, value),
            &[field, "no admite el campo"],
        );
    }
    // `ratio`.
    expect_rejected(
        &mat_field(shansep_doc(), "shansep", json!({"ratio": 0.0, "ocr": 1.5})),
        &["shansep.ratio", "> 0"],
    );
    // `exponent`.
    expect_accepted(&mat_field(
        shansep_doc(),
        "shansep",
        json!({"ratio": 0.25, "exponent": 0.8, "ocr": 1.5}),
    ));
    expect_rejected(
        &mat_field(
            shansep_doc(),
            "shansep",
            json!({"ratio": 0.25, "exponent": 1.1, "ocr": 1.5}),
        ),
        &["shansep.exponent", "[0, 1]"],
    );
    // Exactly one OCR source.
    expect_rejected(
        &mat_field(shansep_doc(), "shansep", json!({"ratio": 0.25})),
        &["exactamente uno de shansep.ocr, shansep.pop o shansep.ocr_by_elevation"],
    );
    expect_rejected(
        &mat_field(
            shansep_doc(),
            "shansep",
            json!({"ratio": 0.25, "ocr": 1.5, "pop": 30.0}),
        ),
        &["exactamente uno"],
    );
    expect_accepted(&mat_field(
        shansep_doc(),
        "shansep",
        json!({"ratio": 0.25, "pop": 30.0}),
    ));
    expect_accepted(&mat_field(
        shansep_doc(),
        "shansep",
        json!({"ratio": 0.25, "ocr_by_elevation": [[0.0, 2.0], [10.0, 1.0]]}),
    ));
    // `ocr`, `pop` and `ocr_by_elevation` ranges.
    expect_rejected(
        &mat_field(shansep_doc(), "shansep", json!({"ratio": 0.25, "ocr": 0.9})),
        &["shansep.ocr", "≥ 1"],
    );
    expect_rejected(
        &mat_field(
            shansep_doc(),
            "shansep",
            json!({"ratio": 0.25, "pop": -1.0}),
        ),
        &["shansep.pop", "≥ 0"],
    );
    expect_rejected(
        &mat_field(
            shansep_doc(),
            "shansep",
            json!({"ratio": 0.25, "ocr_by_elevation": [[0.0, 2.0]]}),
        ),
        &["ocr_by_elevation", "al menos 2 filas"],
    );
    expect_rejected(
        &mat_field(
            shansep_doc(),
            "shansep",
            json!({"ratio": 0.25, "ocr_by_elevation": [[0.0, 2.0], [10.0, 0.5]]}),
        ),
        &["ocr_by_elevation", "OCR < 1"],
    );
    expect_rejected(
        &mat_field(
            shansep_doc(),
            "shansep",
            json!({"ratio": 0.25, "ocr_by_elevation": [[0.0, 2.0], [0.0, 1.5]]}),
        ),
        &["ocr_by_elevation", "estrictamente creciente"],
    );
}

// --------------------------------------------------------------------------------------------------- F6.4: non-circular

fn non_circular_doc(spec: Value) -> Value {
    let mut doc = v06(json!(["spencer"]));
    doc["analysis"]["surface"] = Value::Null;
    doc["analysis"]["search"] = json!({"type": "circular_entry_exit", "non_circular": spec});
    doc
}

#[test]
fn non_circular_validation() {
    // An empty object is valid, and both fields are optional.
    expect_accepted(&non_circular_doc(json!({})));
    expect_accepted(&non_circular_doc(json!({"seeds": 3, "max_vertices": 33})));
    expect_accepted(&non_circular_doc(json!({"seeds": 1})));
    expect_accepted(&non_circular_doc(json!({"seeds": 10})));
    expect_accepted(&non_circular_doc(json!({"max_vertices": 9})));
    expect_accepted(&non_circular_doc(json!({"max_vertices": 17})));
    // Ranges.
    expect_rejected(
        &non_circular_doc(json!({"seeds": 0})),
        &["seeds", "[1, 10]"],
    );
    expect_rejected(
        &non_circular_doc(json!({"seeds": 11})),
        &["seeds", "[1, 10]"],
    );
    expect_rejected(
        &non_circular_doc(json!({"max_vertices": 8})),
        &["max_vertices", "9, 17 o 33"],
    );
    // Unknown field.
    let doc = non_circular_doc(json!({"seeds": 3, "extra": 1}));
    // serde rejects the unknown field before the engine runs.
    let Verdict::Rejected(e) = verdict(&doc) else {
        panic!("must be rejected");
    };
    assert!(
        e.contains("extra") || e.contains("no coincide con el esquema"),
        "{e}"
    );
    // Bishop is not admitted with `non_circular`.
    let mut doc = non_circular_doc(json!({}));
    doc["analysis"]["methods"] = json!(["bishop"]);
    expect_rejected(
        &doc,
        &[
            "el método bishop no se admite con analysis.search.non_circular",
            "polilínea",
        ],
    );
}

// --------------------------------------------------------------------------------------------------- F6.5: rejections

#[test]
fn f65_rejections() {
    // Crack with automatic depth and a new material.
    for doc in [hoek_brown_doc(), shansep_doc()] {
        let mut auto = doc.clone();
        auto["analysis"]["tension_crack"] = json!({"depth": "auto", "water_fill": 0.5});
        expect_rejected(
            &auto,
            &[
                "analysis.tension_crack.depth \"auto\" no se admite con materiales hoek_brown o shansep",
            ],
        );
        // A fixed depth is still allowed.
        let mut fixed = doc;
        fixed["analysis"]["tension_crack"] = json!({"depth": 2.0, "water_fill": 0.5});
        expect_accepted(&fixed);
    }
    // Ito-Matsui with a new material.
    for doc in [hoek_brown_doc(), shansep_doc()] {
        let mut d = doc;
        d["reinforcements"] = json!([{"id": "p1", "type": "pile", "x1": 40.0, "y1": 30.0,
            "x2": 40.0, "y2": 22.0, "application": "passive", "spacing": 2.0,
            "direction": "angle", "angle": 0.0,
            "lateral_pressure": {"model": "ito_matsui", "diameter": 0.8, "location": "centroid"}}]);
        expect_rejected(
            &d,
            &["lateral_pressure (Ito-Matsui) no se admite con materiales hoek_brown o shansep"],
        );
    }
    // A pile with a fixed `force` (no lateral_pressure) is allowed with a new material.
    for doc in [hoek_brown_doc(), shansep_doc()] {
        let mut d = doc;
        d["reinforcements"] = json!([{"id": "p1", "type": "pile", "x1": 40.0, "y1": 30.0,
            "x2": 40.0, "y2": 22.0, "application": "passive", "force": 60.0,
            "direction": "angle", "angle": 0.0}]);
        expect_accepted(&d);
    }
}

// --------------------------------------------------------------------------------------------------- serde round trips

#[test]
fn the_new_types_round_trip_without_loss() {
    // ShansepSpec, optional exponent present and absent.
    let spec: ShansepSpec =
        serde_json::from_value(json!({"ratio": 0.25, "exponent": 0.8, "ocr": 1.5})).unwrap();
    assert_eq!(spec.exponent(), 0.8);
    assert_eq!(
        serde_json::to_value(&spec).unwrap(),
        json!({"ratio": 0.25, "exponent": 0.8, "ocr": 1.5})
    );
    let spec: ShansepSpec = serde_json::from_value(json!({"ratio": 0.25, "pop": 30.0})).unwrap();
    assert_eq!(spec.exponent(), 0.8, "exponent defaults to 0.8");
    assert_eq!(
        serde_json::to_value(&spec).unwrap(),
        json!({"ratio": 0.25, "pop": 30.0})
    );

    // NonCircularSpec, with and without the fields, and the accessors' defaults.
    let nc: NonCircularSpec = serde_json::from_value(json!({})).unwrap();
    assert_eq!(nc.seeds(), 3);
    assert_eq!(nc.max_vertices(), 33);
    assert_eq!(serde_json::to_value(&nc).unwrap(), json!({}));
    let nc: NonCircularSpec =
        serde_json::from_value(json!({"seeds": 5, "max_vertices": 17})).unwrap();
    assert_eq!(nc.seeds(), 5);
    assert_eq!(nc.max_vertices(), 17);
    assert_eq!(
        serde_json::to_value(&nc).unwrap(),
        json!({"seeds": 5, "max_vertices": 17})
    );

    // A full v0.6 model round trips and keeps every new field.
    let doc = {
        let mut d = v06(json!(["spencer"]));
        d["materials"] = json!([
            hoek_brown_material(),
            json!({"id": "arcilla", "name": "Arcilla", "model": "shansep", "unit_weight": 18.0,
                   "shansep": {"ratio": 0.25, "exponent": 0.8, "ocr_by_elevation": [[0.0, 2.0], [10.0, 1.0]]}}),
        ]);
        d["analysis"]["search"] = json!({"type": "circular_entry_exit",
                                          "non_circular": {"seeds": 4, "max_vertices": 17}});
        d
    };
    let model: Model = serde_json::from_value(doc).expect("parses");
    assert_eq!(model.materials[0].ucs, Some(30000.0));
    assert_eq!(model.materials[0].gsi, Some(50.0));
    assert_eq!(model.materials[0].mi, Some(10.0));
    assert_eq!(model.materials[0].disturbance, Some(0.7));
    assert_eq!(model.materials[0].shansep, None);
    assert_eq!(
        model.materials[1].shansep,
        Some(ShansepSpec {
            ratio: 0.25,
            exponent: Some(0.8),
            ocr: None,
            pop: None,
            ocr_by_elevation: Some(vec![[0.0, 2.0], [10.0, 1.0]]),
        })
    );
    let search = model.analysis.search.as_ref().expect("the search parses");
    let nc = search.non_circular.as_ref().expect("non_circular parses");
    assert_eq!(nc.seeds, Some(4));
    assert_eq!(nc.max_vertices, Some(17));
    // The whole document round trips without loss.
    let back = serde_json::to_value(&model).unwrap();
    let again: Model = serde_json::from_value(back).unwrap();
    assert_eq!(model, again);

    // Without new fields nothing new is serialized.
    let plain: Model = serde_json::from_value(v047a(json!(["bishop"]))).unwrap();
    let v = serde_json::to_value(&plain).unwrap();
    for key in ["ucs", "gsi", "mi", "disturbance", "shansep"] {
        assert!(v["materials"][0].get(key).is_none(), "{key}");
    }
    // A search without `non_circular` does not serialize it.
    let s: SearchSpec = serde_json::from_value(json!({"type": "circular_entry_exit"})).unwrap();
    assert!(
        serde_json::to_value(&s)
            .unwrap()
            .get("non_circular")
            .is_none()
    );
}

// --------------------------------------------------------------------------------------------------- mb, s, a

#[test]
fn hoek_brown_parameters_match_the_published_values() {
    // X25 §1.2: GSI 20, mi 10, D 1.
    let (mb, s, a) = hoek_brown_mb_s_a(20.0, 10.0, 1.0);
    assert!((mb - 0.0329851).abs() < 1e-7, "{mb}");
    assert!((s - 1.6196e-6).abs() < 1e-10, "{s}");
    assert!((a - 0.543721).abs() < 1e-6, "{a}");
    // X25 §1.3 (Hammah example 1): GSI 5, mi 2, D 0.
    let (mb, s, a) = hoek_brown_mb_s_a(5.0, 2.0, 0.0);
    assert!((mb - 0.067225).abs() < 1e-6, "{mb}");
    assert!((s - 2.6048e-5).abs() < 1e-9, "{s}");
    assert!((a - 0.61921).abs() < 1e-5, "{a}");
}

// --------------------------------------------------------------------------------------------------- the B0 stubs

#[test]
fn a_valid_hoek_brown_model_reaches_its_stub() {
    let doc = hoek_brown_doc();
    let payload = catch_unwind(AssertUnwindSafe(|| analyze_json(&doc.to_string())))
        .expect_err("un modelo Hoek-Brown válido llega al stub de B0");
    assert!(panic_text(payload).contains("F3B-M-HB"));
}

#[test]
fn a_valid_shansep_model_reaches_its_stub() {
    let doc = shansep_doc();
    let payload = catch_unwind(AssertUnwindSafe(|| analyze_json(&doc.to_string())))
        .expect_err("un modelo SHANSEP válido llega al stub de B0");
    assert!(panic_text(payload).contains("F3B-M-SH"));
}

#[test]
fn a_valid_non_circular_model_reaches_its_stub() {
    let doc = non_circular_doc(json!({}));
    let payload = catch_unwind(AssertUnwindSafe(|| analyze_json(&doc.to_string())))
        .expect_err("un modelo non_circular válido llega al stub de B0");
    assert!(panic_text(payload).contains("F3B-M-NC"));
}

// --------------------------------------------------------------------------------------------------- identity v0.5 → v0.6

#[test]
fn a_v05_case_raised_to_0_6_gives_the_same_output() {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../verification/cases/V072a.json"
    );
    let doc: Value =
        serde_json::from_str(&std::fs::read_to_string(path).expect("V072a.json")).unwrap();
    let model = doc["model"].clone();
    let base = analyze_json(&model.to_string()).expect("v0.5 output");
    let mut bumped = model;
    bumped["version"] = json!("0.6");
    let out = analyze_json(&bumped.to_string()).expect("v0.6 output");
    assert_eq!(
        out, base,
        "la salida no cambia al subir un modelo v0.5 a v0.6"
    );
}

#[test]
fn e16p_polyline_fos_is_omitted_only_when_absent() {
    use ogs_core::search::NonCircularStats;
    let mut stats = NonCircularStats {
        seeds: 3,
        evaluated: 7,
        seed_fos: 1.2,
        polyline_fos: None,
    };
    assert_eq!(
        serde_json::to_value(stats).unwrap(),
        json!({"seeds": 3, "evaluated": 7, "seed_fos": 1.2})
    );
    stats.polyline_fos = Some(1.1);
    assert_eq!(
        serde_json::to_value(stats).unwrap()["polyline_fos"],
        json!(1.1)
    );
}
