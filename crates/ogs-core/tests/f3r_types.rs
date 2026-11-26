//! Format v0.4 (F4.1, F4.2) in the engine: the version gate, the validation with the JSON path of the field, the
//! serde round trip, the passive fields of `Slice` and the report, which must not change a byte without
//! reinforcements, and the stub that a valid model reaches.
//!
//! Every test here is **green** at the end of R0. `valid_model_reaches_the_stub_of_r1` is the guard that the RED tests
//! of `f3r_oracle.rs` fail in the stub and not in serde; R1 deletes it when the stub is gone.

mod f3_common;

use f3_common::*;
use ogs_core::model::{Model, Reinforcement};
use ogs_core::{analyze_json, reinforcement};
use serde_json::{Value, json};
use std::panic::{AssertUnwindSafe, catch_unwind};

const STUB: &str = "R1: fuerzas de refuerzo";

/// `Ok` when the document gets past the parser and every validation (it is analyzed, or it reaches the stub of R1);
/// `Err(text)` with the error of the engine otherwise. Any other panic is propagated.
fn verdict(doc: &Value) -> Result<(), String> {
    match catch_unwind(AssertUnwindSafe(|| analyze_json(&doc.to_string()))) {
        Ok(Ok(_)) => Ok(()),
        Ok(Err(e)) => Err(e),
        Err(payload) => {
            let text = payload
                .downcast_ref::<String>()
                .cloned()
                .or_else(|| payload.downcast_ref::<&str>().map(|s| (*s).to_string()))
                .unwrap_or_default();
            if text.contains(STUB) {
                Ok(())
            } else {
                std::panic::resume_unwind(payload)
            }
        }
    }
}

fn anchor() -> Value {
    json!({"id": "a1", "type": "anchor", "x1": 52.0, "y1": 28.0, "x2": 25.0, "y2": 28.0,
           "tensile_capacity": 100.0, "application": "active", "direction": "axial"})
}

fn pile() -> Value {
    json!({"id": "p1", "type": "pile", "x1": 40.0, "y1": 30.0, "x2": 40.0, "y2": 22.0,
           "application": "passive", "force": 60.0, "spacing": 1.5, "direction": "angle", "angle": 0.0})
}

fn sheet_pile() -> Value {
    json!({"id": "s1", "type": "sheet_pile", "x1": 45.0, "y1": 33.0, "x2": 45.0, "y2": 14.0,
           "application": "active", "force": 120.0, "direction": "perpendicular"})
}

fn doc_with(items: Vec<Value>) -> Value {
    let mut doc = v047a(json!(["bishop"]));
    doc["version"] = json!("0.4");
    doc["reinforcements"] = Value::Array(items);
    doc
}

fn with(mut item: Value, key: &str, value: Value) -> Value {
    if value.is_null() && key.starts_with('-') {
        item.as_object_mut().unwrap().remove(&key[1..]);
    } else {
        item[key] = value;
    }
    item
}

fn pullout(item: Value, p: Value) -> Value {
    with(item, "pullout", p)
}

#[test]
fn valid_model_reaches_the_stub_of_r1() {
    // Parses as a Model (serde), passes the validation, and the first call of the stub panics.
    let doc = doc_with(vec![anchor()]);
    let model: Model = serde_json::from_value(doc.clone()).expect("a valid v0.4 model parses");
    assert_eq!(model.reinforcements.len(), 1);
    let panic = catch_unwind(AssertUnwindSafe(|| ogs_core::analyze(&model)))
        .expect_err("the stub must panic");
    let text = panic
        .downcast_ref::<String>()
        .cloned()
        .or_else(|| panic.downcast_ref::<&str>().map(|s| (*s).to_string()))
        .unwrap_or_default();
    assert!(
        text.contains(&format!("not yet implemented: {STUB}")),
        "{text}"
    );
}

// ------------------------------------------------------------------------------------------------ the version gate

#[test]
fn reinforcements_need_version_0_4() {
    for version in ["0.1", "0.2", "0.3"] {
        let mut doc = doc_with(vec![anchor()]);
        doc["version"] = json!(version);
        let err = verdict(&doc).expect_err(version);
        assert!(
            err.starts_with("InvalidModel: ")
                && err.contains("reinforcements requiere version \"0.4\""),
            "{version}: {err}"
        );
    }
}

#[test]
fn an_empty_list_counts_as_absent_in_every_version() {
    for version in ["0.1", "0.2", "0.3", "0.4"] {
        let mut doc = doc_with(vec![]);
        doc["version"] = json!(version);
        assert_eq!(verdict(&doc), Ok(()), "{version}");
    }
}

#[test]
fn version_0_4_without_reinforcements_is_a_plain_model() {
    let mut doc = v047a(json!(["bishop"]));
    doc["version"] = json!("0.4");
    assert_eq!(verdict(&doc), Ok(()));
    doc["version"] = json!("0.5");
    let err = verdict(&doc).expect_err("0.5");
    assert!(
        err.contains("version debe ser") && err.contains("\"0.4\""),
        "{err}"
    );
}

#[test]
fn the_v0_3_gate_goes_first() {
    let mut doc = doc_with(vec![anchor()]);
    doc["version"] = json!("0.2");
    doc["analysis"]["methods"] = json!(["janbu_corrected"]);
    let err = verdict(&doc).expect_err("0.2");
    assert!(
        err.contains("janbu_corrected\" requiere version \"0.3\""),
        "{err}"
    );
}

// ------------------------------------------------------------------------------------------ validation of the fields

/// `(name, reinforcements, expected)`: `None` accepts; `Some(texts)` rejects with an `InvalidModel` that has all texts.
type Row = (&'static str, Vec<Value>, Option<Vec<&'static str>>);

fn table() -> Vec<Row> {
    let bond = |extra: Value| {
        let mut p = json!({"model": "bond", "strength": 30.0});
        for (k, v) in extra.as_object().unwrap() {
            p[k] = v.clone();
        }
        p
    };
    let interface = |extra: Value| {
        let mut p = json!({"model": "interface", "adhesion": 10.0, "friction_angle": 20.0, "coverage": 0.8});
        for (k, v) in extra.as_object().unwrap() {
            p[k] = v.clone();
        }
        p
    };
    let dev = |l1: f64, l2: f64| json!({"model": "development", "length1": l1, "length2": l2});
    vec![
        // accepted
        ("anchor", vec![anchor()], None),
        (
            "nail with every optional field",
            vec![with(
                with(
                    with(
                        with(anchor(), "type", json!("nail")),
                        "end1_capacity",
                        json!(5.0),
                    ),
                    "end2_capacity",
                    json!(7.0),
                ),
                "spacing",
                json!(2.5),
            )],
            None,
        ),
        (
            "geosynthetic tangent",
            vec![with(
                with(anchor(), "type", json!("geosynthetic")),
                "direction",
                json!("tangent"),
            )],
            None,
        ),
        (
            "bisector",
            vec![with(anchor(), "direction", json!("bisector"))],
            None,
        ),
        (
            "null optionals",
            vec![with(
                with(
                    with(
                        with(anchor(), "end1_capacity", Value::Null),
                        "end2_capacity",
                        Value::Null,
                    ),
                    "spacing",
                    Value::Null,
                ),
                "pullout",
                Value::Null,
            )],
            None,
        ),
        (
            "capacity 0",
            vec![with(anchor(), "tensile_capacity", json!(0.0))],
            None,
        ),
        (
            "pullout bond",
            vec![pullout(anchor(), bond(json!({})))],
            None,
        ),
        (
            "pullout bond with bonded_length = L",
            vec![pullout(anchor(), bond(json!({"bonded_length": 27.0})))],
            None,
        ),
        (
            "pullout bond with null bonded_length",
            vec![pullout(anchor(), bond(json!({"bonded_length": null})))],
            None,
        ),
        (
            "pullout bond strength 0",
            vec![pullout(anchor(), bond(json!({"strength": 0.0})))],
            None,
        ),
        (
            "pullout interface",
            vec![pullout(anchor(), interface(json!({})))],
            None,
        ),
        (
            "pullout interface coverage 1, friction 0",
            vec![pullout(
                anchor(),
                interface(json!({"coverage": 1.0, "friction_angle": 0.0, "adhesion": 0.0})),
            )],
            None,
        ),
        (
            "pullout development",
            vec![pullout(anchor(), dev(3.0, 4.0))],
            None,
        ),
        (
            "pullout development 0 and 0",
            vec![pullout(anchor(), dev(0.0, 0.0))],
            None,
        ),
        ("pile angle 0", vec![pile()], None),
        (
            "pile angle -89.9",
            vec![with(pile(), "angle", json!(-89.9))],
            None,
        ),
        (
            "pile tangent without angle",
            vec![with(
                with(pile(), "direction", json!("tangent")),
                "-angle",
                Value::Null,
            )],
            None,
        ),
        (
            "pile perpendicular with angle null",
            vec![with(
                with(pile(), "direction", json!("perpendicular")),
                "angle",
                Value::Null,
            )],
            None,
        ),
        (
            "pile inclined",
            vec![with(with(pile(), "x2", json!(43.0)), "y2", json!(24.0))],
            None,
        ),
        (
            "pile without spacing",
            vec![with(pile(), "-spacing", Value::Null)],
            None,
        ),
        (
            "pile force 0",
            vec![with(pile(), "force", json!(0.0))],
            None,
        ),
        ("sheet_pile", vec![sheet_pile()], None),
        (
            "sheet_pile with angle direction",
            vec![with(
                with(sheet_pile(), "direction", json!("angle")),
                "angle",
                json!(10.0),
            )],
            None,
        ),
        (
            "the five types",
            vec![
                anchor(),
                with(with(anchor(), "type", json!("nail")), "id", json!("n")),
                with(
                    with(anchor(), "type", json!("geosynthetic")),
                    "id",
                    json!("g"),
                ),
                with(pile(), "id", json!("pp")),
                sheet_pile(),
            ],
            None,
        ),
        // rejected by serde (the document does not match the schema)
        (
            "unknown type",
            vec![with(anchor(), "type", json!("strut"))],
            Some(vec!["no coincide con el esquema"]),
        ),
        (
            "unknown field",
            vec![with(anchor(), "prestress", json!(50.0))],
            Some(vec!["no coincide con el esquema", "prestress"]),
        ),
        (
            "without application",
            vec![with(anchor(), "-application", Value::Null)],
            Some(vec!["application"]),
        ),
        (
            "without direction",
            vec![with(anchor(), "-direction", Value::Null)],
            Some(vec!["direction"]),
        ),
        (
            "without tensile_capacity",
            vec![with(anchor(), "-tensile_capacity", Value::Null)],
            Some(vec!["tensile_capacity"]),
        ),
        (
            "without id",
            vec![with(anchor(), "-id", Value::Null)],
            Some(vec!["id"]),
        ),
        (
            "application 'both'",
            vec![with(anchor(), "application", json!("both"))],
            Some(vec!["no coincide con el esquema"]),
        ),
        (
            "anchor with direction angle",
            vec![with(anchor(), "direction", json!("angle"))],
            Some(vec!["no coincide con el esquema"]),
        ),
        (
            "pile with direction axial",
            vec![with(pile(), "direction", json!("axial"))],
            Some(vec!["no coincide con el esquema"]),
        ),
        (
            // E14m-3: `location` was dropped in v0.4; it is an unknown field, in a pile and in a sheet_pile
            "pile with location",
            vec![with(pile(), "location", json!("slip_surface"))],
            Some(vec!["location"]),
        ),
        (
            "sheet_pile with location",
            vec![with(sheet_pile(), "location", json!("centroid"))],
            Some(vec!["location"]),
        ),
        (
            "pile with tensile_capacity",
            vec![with(pile(), "tensile_capacity", json!(5.0))],
            Some(vec!["tensile_capacity"]),
        ),
        (
            "sheet_pile with spacing",
            vec![with(sheet_pile(), "spacing", json!(1.0))],
            Some(vec!["spacing"]),
        ),
        (
            "anchor with force",
            vec![with(anchor(), "force", json!(5.0))],
            Some(vec!["force"]),
        ),
        (
            "pullout unknown model",
            vec![pullout(anchor(), json!({"model": "grout"}))],
            Some(vec!["no coincide con el esquema"]),
        ),
        (
            "pullout bond with adhesion",
            vec![pullout(anchor(), bond(json!({"adhesion": 1.0})))],
            Some(vec!["adhesion"]),
        ),
        (
            "pullout interface without coverage",
            vec![pullout(anchor(), interface(json!({"coverage": null})))],
            Some(vec!["no coincide con el esquema"]),
        ),
        (
            "pullout development without length2",
            vec![pullout(
                anchor(),
                json!({"model": "development", "length1": 1.0}),
            )],
            Some(vec!["length2"]),
        ),
        // rejected by the validation of the engine, with the JSON path
        (
            "empty id",
            vec![with(anchor(), "id", json!(""))],
            Some(vec!["reinforcements[0].id"]),
        ),
        (
            "repeated id",
            vec![anchor(), with(pile(), "id", json!("a1"))],
            Some(vec!["reinforcements[1].id", "a1", "repetido"]),
        ),
        (
            "tensile_capacity < 0",
            vec![with(anchor(), "tensile_capacity", json!(-1.0))],
            Some(vec!["reinforcements[0].tensile_capacity"]),
        ),
        (
            "end1_capacity < 0",
            vec![with(anchor(), "end1_capacity", json!(-0.5))],
            Some(vec!["reinforcements[0].end1_capacity"]),
        ),
        (
            "end2_capacity < 0",
            vec![with(anchor(), "end2_capacity", json!(-0.5))],
            Some(vec!["reinforcements[0].end2_capacity"]),
        ),
        (
            "spacing 0",
            vec![with(anchor(), "spacing", json!(0.0))],
            Some(vec!["reinforcements[0].spacing"]),
        ),
        (
            "spacing < 0",
            vec![with(pile(), "spacing", json!(-1.0))],
            Some(vec!["reinforcements[0].spacing"]),
        ),
        (
            "length 0",
            vec![with(with(anchor(), "x2", json!(52.0)), "y2", json!(28.0))],
            Some(vec!["reinforcements[0]", "longitud 0"]),
        ),
        (
            "bond strength < 0",
            vec![pullout(anchor(), bond(json!({"strength": -1.0})))],
            Some(vec!["reinforcements[0].pullout.strength"]),
        ),
        (
            "bonded_length 0",
            vec![pullout(anchor(), bond(json!({"bonded_length": 0.0})))],
            Some(vec!["reinforcements[0].pullout.bonded_length"]),
        ),
        (
            "bonded_length > L",
            vec![pullout(anchor(), bond(json!({"bonded_length": 27.5})))],
            Some(vec!["reinforcements[0].pullout.bonded_length", "27"]),
        ),
        (
            "interface adhesion < 0",
            vec![pullout(anchor(), interface(json!({"adhesion": -1.0})))],
            Some(vec!["reinforcements[0].pullout.adhesion"]),
        ),
        (
            "interface friction_angle 90",
            vec![pullout(
                anchor(),
                interface(json!({"friction_angle": 90.0})),
            )],
            Some(vec!["reinforcements[0].pullout.friction_angle"]),
        ),
        (
            "interface friction_angle < 0",
            vec![pullout(
                anchor(),
                interface(json!({"friction_angle": -1.0})),
            )],
            Some(vec!["reinforcements[0].pullout.friction_angle"]),
        ),
        (
            "interface coverage 0",
            vec![pullout(anchor(), interface(json!({"coverage": 0.0})))],
            Some(vec!["reinforcements[0].pullout.coverage"]),
        ),
        (
            "interface coverage 1.5",
            vec![pullout(anchor(), interface(json!({"coverage": 1.5})))],
            Some(vec!["reinforcements[0].pullout.coverage"]),
        ),
        (
            "development length1 < 0",
            vec![pullout(anchor(), dev(-1.0, 0.0))],
            Some(vec!["reinforcements[0].pullout.length1"]),
        ),
        (
            "development length2 < 0",
            vec![pullout(anchor(), dev(0.0, -1.0))],
            Some(vec!["reinforcements[0].pullout.length2"]),
        ),
        (
            "pile force < 0",
            vec![with(pile(), "force", json!(-1.0))],
            Some(vec!["reinforcements[0].force"]),
        ),
        (
            "pile angle required with direction angle",
            vec![with(pile(), "-angle", Value::Null)],
            Some(vec!["reinforcements[0].angle", "obligatorio"]),
        ),
        (
            "pile angle null with direction angle",
            vec![with(pile(), "angle", Value::Null)],
            Some(vec!["reinforcements[0].angle", "obligatorio"]),
        ),
        (
            "pile angle forbidden with tangent",
            vec![with(pile(), "direction", json!("tangent"))],
            Some(vec!["reinforcements[0].angle", "tangent"]),
        ),
        (
            "pile angle forbidden with perpendicular",
            vec![with(pile(), "direction", json!("perpendicular"))],
            Some(vec!["reinforcements[0].angle", "perpendicular"]),
        ),
        (
            "pile angle 90",
            vec![with(pile(), "angle", json!(90.0))],
            Some(vec!["reinforcements[0].angle"]),
        ),
        (
            "pile angle -90",
            vec![with(pile(), "angle", json!(-90.0))],
            Some(vec!["reinforcements[0].angle"]),
        ),
        (
            "pile length 0",
            vec![with(with(pile(), "y2", json!(30.0)), "x2", json!(40.0))],
            Some(vec!["reinforcements[0]", "longitud 0"]),
        ),
        (
            "sheet_pile force < 0",
            vec![with(sheet_pile(), "force", json!(-1.0))],
            Some(vec!["reinforcements[0].force"]),
        ),
        (
            "sheet_pile inclined",
            vec![with(sheet_pile(), "x2", json!(45.5))],
            Some(vec!["reinforcements[0].x2", "vertical"]),
        ),
        (
            "sheet_pile angle required",
            vec![with(sheet_pile(), "direction", json!("angle"))],
            Some(vec!["reinforcements[0].angle"]),
        ),
        (
            "sheet_pile angle forbidden",
            vec![with(sheet_pile(), "angle", json!(10.0))],
            Some(vec!["reinforcements[0].angle"]),
        ),
        (
            "path of the third element",
            vec![
                anchor(),
                with(pile(), "id", json!("p")),
                pullout(
                    with(anchor(), "id", json!("a3")),
                    interface(json!({"coverage": 0.0})),
                ),
            ],
            Some(vec!["reinforcements[2].pullout.coverage"]),
        ),
    ]
}

#[test]
fn the_validation_table_of_f4_2() {
    let rows = table();
    assert!(rows.len() >= 60, "{} rows", rows.len());
    for (name, items, expected) in rows {
        let doc = doc_with(items);
        match (verdict(&doc), expected) {
            (Ok(()), None) => {}
            (Err(e), Some(texts)) => {
                assert!(
                    e.starts_with("InvalidModel: ") && texts.iter().all(|t| e.contains(t)),
                    "{name}: expected InvalidModel with {texts:?}, got {e}"
                );
            }
            (Ok(()), Some(_)) => panic!("{name}: must be rejected"),
            (Err(e), None) => panic!("{name}: must be accepted, got {e}"),
        }
    }
}

// ---------------------------------------------------------------------------------------- serde and the output

#[test]
fn reinforcements_round_trip_without_loss() {
    let doc = doc_with(vec![
        with(
            pullout(
                anchor(),
                json!({"model": "bond", "strength": 30.0, "bonded_length": 5.0}),
            ),
            "spacing",
            json!(2.0),
        ),
        pile(),
        sheet_pile(),
        pullout(
            with(anchor(), "id", json!("g")),
            json!({"model": "interface", "adhesion": 10.0, "friction_angle": 20.0, "coverage": 0.8}),
        ),
        pullout(
            with(anchor(), "id", json!("d")),
            json!({"model": "development", "length1": 3.0, "length2": 4.0}),
        ),
    ]);
    let model: Model = serde_json::from_value(doc.clone()).unwrap();
    assert!(matches!(model.reinforcements[1], Reinforcement::Pile(_)));
    let back: Value = serde_json::to_value(&model).unwrap();
    assert_eq!(back["reinforcements"], doc["reinforcements"]);
    // omitted when empty
    let plain: Model = serde_json::from_value(v047a(json!(["bishop"]))).unwrap();
    assert!(
        serde_json::to_value(&plain)
            .unwrap()
            .get("reinforcements")
            .is_none()
    );
}

#[test]
fn without_reinforcements_the_report_has_no_new_keys() {
    // The slices go out in the JSON of the report: the passive fields and `reinforcement_forces` must not appear.
    let mut doc = v047a(json!(["bishop", "spencer", "janbu_corrected"]));
    doc["loads"] = json!([{"type": "udl", "x1": 40.0, "x2": 45.0, "q": 20.0}]);
    doc["analysis"]["seismic"] = json!({"kh": 0.1, "kv": 0.05});
    for version in ["0.3", "0.4"] {
        doc["version"] = json!(version);
        let out = analyze_json(&doc.to_string()).expect("analysis");
        for key in ["passive_", "reinforcement_forces"] {
            assert!(!out.contains(key), "{version}: the report has {key}");
        }
        assert!(out.contains("\"y_centroid\"") && out.contains("\"driving_extra\""));
    }
}

#[test]
fn the_stub_signatures_are_frozen() {
    // A compile-time check of the signatures that R1 implements.
    let _nodes: fn(
        &[Reinforcement],
        &ogs_core::geometry::PreparedModel,
        &ogs_core::surface::Surface,
    ) -> Vec<f64> = reinforcement::crossing_nodes;
    let _apply: fn(
        &[Reinforcement],
        &ogs_core::geometry::PreparedModel,
        &ogs_core::surface::Surface,
        &mut [ogs_core::slicer::Slice],
    ) -> Vec<ogs_core::report::ReinforcementForce> = reinforcement::apply_to_slices;
}
