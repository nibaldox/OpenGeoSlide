//! Format v0.5 (F5.1, F5.2) in the engine: the version gate, the validation of `analysis.tension_crack` with the JSON
//! path of the field, the serde round trip, the report that must not change a byte without a crack, and the
//! signatures of the stubs of wave G0.
//!
//! Every test here is green: a valid v0.5 model reaches the stub of `crack` (`todo!("G1: grieta de tracción")`) once it
//! has passed the validation; `verdict` counts that as accepted. When M-grieta replaces the stub, `verdict` keeps
//! working because it also accepts an analysis that returns.

mod f3_common;

use f3_common::*;
use ogs_core::crack::{self, CrackError, CrackPlan};
use ogs_core::geometry::PreparedModel;
use ogs_core::loads::LoadCase;
use ogs_core::model::{CrackDepth, Model, TensionCrack};
use ogs_core::report::CrackReport;
use ogs_core::slicer::Slice;
use ogs_core::surface::Surface;
use ogs_core::water::{self, PondTerms};
use ogs_core::{OgsError, analyze, analyze_json};
use serde_json::{Value, json};
use std::panic::{AssertUnwindSafe, catch_unwind};

const STUB: &str = "G1: grieta de tracción";

/// `Ok` when the document gets past the parser and every validation (it is analyzed, it fails with `NoValidSurface`,
/// or it reaches the stub of G1); `Err(text)` with the error of the engine otherwise. Any other panic is propagated.
fn verdict(doc: &Value) -> Result<(), String> {
    match catch_unwind(AssertUnwindSafe(|| analyze_json(&doc.to_string()))) {
        Ok(Ok(_)) => Ok(()),
        Ok(Err(e)) if e.starts_with("NoValidSurface:") => Ok(()),
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

fn doc_with(version: &str, crack: Value) -> Value {
    let mut doc = v047a(json!(["bishop"]));
    doc["version"] = json!(version);
    if !crack.is_null() {
        doc["analysis"]["tension_crack"] = crack;
    }
    doc
}

fn ok_crack() -> Value {
    json!({"depth": 2.0, "water_fill": 1.0})
}

// ------------------------------------------------------------------------------------------------ the version gate

#[test]
fn tension_crack_needs_version_0_5() {
    for version in ["0.1", "0.2", "0.3", "0.4"] {
        let err = verdict(&doc_with(version, ok_crack())).expect_err(version);
        assert_eq!(
            err, "InvalidModel: tension_crack requiere version \"0.5\"",
            "{version}"
        );
    }
    assert_eq!(verdict(&doc_with("0.5", ok_crack())), Ok(()));
}

#[test]
fn a_null_crack_counts_as_absent_in_every_version() {
    for version in ["0.1", "0.2", "0.3", "0.4", "0.5"] {
        let mut doc = doc_with(version, Value::Null);
        doc["analysis"]["tension_crack"] = Value::Null;
        assert_eq!(verdict(&doc), Ok(()), "{version}");
    }
}

#[test]
fn version_0_5_without_a_crack_is_a_plain_model_and_0_7_is_unknown() {
    assert_eq!(verdict(&doc_with("0.5", Value::Null)), Ok(()));
    assert_eq!(verdict(&doc_with("0.6", Value::Null)), Ok(()));
    let err = verdict(&doc_with("0.7", ok_crack())).expect_err("0.7");
    assert!(
        err.starts_with("InvalidModel: version debe ser") && err.contains("\"0.6\""),
        "{err}"
    );
}

#[test]
fn the_gates_of_the_earlier_versions_go_first() {
    // v0.3 before v0.4 before v0.5, as the version of each field says.
    let mut doc = doc_with("0.2", ok_crack());
    doc["analysis"]["methods"] = json!(["janbu_corrected"]);
    let err = verdict(&doc).expect_err("0.2");
    assert!(
        err.contains("janbu_corrected\" requiere version \"0.3\""),
        "{err}"
    );
    let mut doc = doc_with("0.3", ok_crack());
    doc["reinforcements"] = json!([{"id": "a1", "type": "anchor", "x1": 52.0, "y1": 28.0, "x2": 25.0, "y2": 28.0,
        "tensile_capacity": 100.0, "application": "active", "direction": "axial"}]);
    let err = verdict(&doc).expect_err("0.3");
    assert!(
        err.contains("reinforcements requiere version \"0.4\""),
        "{err}"
    );
}

// ------------------------------------------------------------------------------------------ validation of the fields

/// `(name, tension_crack, expected)`: `None` accepts; `Some(texts)` rejects with an `InvalidModel` with every text.
type Row = (&'static str, Value, Option<Vec<&'static str>>);

fn table() -> Vec<Row> {
    let d = "analysis.tension_crack.depth";
    let w = "analysis.tension_crack.water_fill";
    vec![
        // accepted
        ("depth and full water", ok_crack(), None),
        ("dry crack", json!({"depth": 0.5, "water_fill": 0}), None),
        ("integer depth", json!({"depth": 2, "water_fill": 1}), None),
        ("half full", json!({"depth": 2.0, "water_fill": 0.5}), None),
        (
            "auto depth",
            json!({"depth": "auto", "water_fill": 0.25}),
            None,
        ),
        (
            "auto and dry",
            json!({"depth": "auto", "water_fill": 0.0}),
            None,
        ),
        (
            "tiny depth",
            json!({"depth": 1e-9, "water_fill": 1.0}),
            None,
        ),
        (
            "huge depth (not capped by the slope, G8)",
            json!({"depth": 1.0e6, "water_fill": 1.0}),
            None,
        ),
        // depth
        (
            "depth 0",
            json!({"depth": 0.0, "water_fill": 1.0}),
            Some(vec![d, "mayor que 0"]),
        ),
        (
            "negative depth",
            json!({"depth": -2.0, "water_fill": 1.0}),
            Some(vec![d, "mayor que 0"]),
        ),
        (
            "text that is not auto",
            json!({"depth": "deep", "water_fill": 1.0}),
            Some(vec![d, "\"auto\""]),
        ),
        (
            "AUTO is not auto",
            json!({"depth": "AUTO", "water_fill": 1.0}),
            Some(vec![d, "\"auto\""]),
        ),
        (
            "boolean depth",
            json!({"depth": true, "water_fill": 1.0}),
            Some(vec![d, "\"auto\""]),
        ),
        (
            "array depth",
            json!({"depth": [2.0], "water_fill": 1.0}),
            Some(vec![d]),
        ),
        (
            "null depth",
            json!({"depth": null, "water_fill": 1.0}),
            Some(vec![d, "obligatorio"]),
        ),
        (
            "missing depth",
            json!({"water_fill": 1.0}),
            Some(vec![d, "obligatorio"]),
        ),
        // water_fill
        (
            "missing water_fill (no default)",
            json!({"depth": 2.0}),
            Some(vec![w, "obligatorio"]),
        ),
        (
            "null water_fill",
            json!({"depth": 2.0, "water_fill": null}),
            Some(vec![w, "obligatorio"]),
        ),
        (
            "negative water_fill",
            json!({"depth": 2.0, "water_fill": -0.1}),
            Some(vec![w, "[0, 1]"]),
        ),
        (
            "water_fill above 1",
            json!({"depth": 2.0, "water_fill": 1.1}),
            Some(vec![w, "[0, 1]"]),
        ),
        (
            "water_fill 100 (percent)",
            json!({"depth": 2.0, "water_fill": 100}),
            Some(vec![w, "[0, 1]"]),
        ),
        (
            "text water_fill",
            json!({"depth": 2.0, "water_fill": "1"}),
            Some(vec![w]),
        ),
        (
            "boolean water_fill",
            json!({"depth": 2.0, "water_fill": true}),
            Some(vec![w]),
        ),
        // shape
        (
            "empty object",
            json!({}),
            Some(vec!["analysis.tension_crack.depth", "obligatorio"]),
        ),
        (
            "unknown field",
            json!({"depth": 2.0, "water_fill": 1.0, "x": 50.0}),
            Some(vec!["unknown field `x`"]),
        ),
        (
            "the old name of water_fill",
            json!({"depth": 2.0, "water": 1.0}),
            Some(vec!["unknown field `water`"]),
        ),
        (
            "the boolean of X20",
            json!({"depth": 2.0, "filled": true}),
            Some(vec!["unknown field `filled`"]),
        ),
        ("number", json!(2.0), Some(vec!["tension_crack"])),
        ("text", json!("auto"), Some(vec!["tension_crack"])),
        ("array", json!([2.0, 1.0]), Some(vec!["tension_crack"])),
        ("boolean", json!(true), Some(vec!["tension_crack"])),
    ]
}

#[test]
fn the_validation_table_of_f5_2() {
    let rows = table();
    assert!(rows.len() >= 30, "{} rows", rows.len());
    for (name, crack, expected) in rows {
        let doc = doc_with("0.5", crack);
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

#[test]
fn non_finite_numbers_are_rejected_with_the_path() {
    // JSON cannot carry them; the Rust API can.
    for (depth, fill, path) in [
        (
            CrackDepth::Fixed(f64::NAN),
            1.0,
            "analysis.tension_crack.depth",
        ),
        (
            CrackDepth::Fixed(f64::INFINITY),
            1.0,
            "analysis.tension_crack.depth",
        ),
        (
            CrackDepth::Auto,
            f64::NAN,
            "analysis.tension_crack.water_fill",
        ),
        (
            CrackDepth::Fixed(2.0),
            f64::INFINITY,
            "analysis.tension_crack.water_fill",
        ),
    ] {
        let mut model: Model = serde_json::from_value(doc_with("0.5", Value::Null)).unwrap();
        model.analysis.tension_crack = Some(TensionCrack {
            depth,
            water_fill: fill,
        });
        match analyze(&model) {
            Err(OgsError::InvalidModel(msg)) => assert!(msg.contains(path), "{msg}"),
            other => panic!("{depth:?}, {fill}: {other:?}"),
        }
    }
}

// ---------------------------------------------------------------------------------------- serde and the output

#[test]
fn the_crack_round_trips_without_loss() {
    for crack in [
        json!({"depth": 2.0, "water_fill": 1.0}),
        json!({"depth": "auto", "water_fill": 0.25}),
        json!({"depth": 0.5, "water_fill": 0.0}),
    ] {
        let doc = doc_with("0.5", crack.clone());
        let model: Model = serde_json::from_value(doc).unwrap();
        let tc = model.analysis.tension_crack.expect("parsed");
        assert!(matches!(
            (&crack["depth"], tc.depth),
            (Value::String(_), CrackDepth::Auto) | (Value::Number(_), CrackDepth::Fixed(_))
        ));
        let back: Value = serde_json::to_value(&model).unwrap();
        assert_eq!(back["analysis"]["tension_crack"], crack);
    }
    // Omitted when absent (identity of the serialized model).
    let plain: Model = serde_json::from_value(doc_with("0.5", Value::Null)).unwrap();
    let back = serde_json::to_value(&plain).unwrap();
    assert!(back["analysis"].get("tension_crack").is_none());
    assert_eq!(plain.analysis.tension_crack, None);
}

#[test]
fn without_a_crack_the_report_has_no_new_keys() {
    let doc = doc_with("0.5", Value::Null);
    let out = analyze_json(&doc.to_string()).expect("analysis");
    assert!(!out.contains("tension_crack"), "the report has a crack");
    assert!(out.contains("\"y_centroid\"") && out.contains("\"driving_extra\""));
    // The slices do not carry any new field either (E15h: the moment of the water fits the current ones).
    for key in ["pond", "water_moment", "weight_moment"] {
        assert!(!out.contains(key), "the report has {key}");
    }
}

#[test]
fn the_crack_report_serializes_with_its_three_numbers() {
    let r = CrackReport {
        x: 48.7109,
        depth: 2.0,
        water_force: 19.614,
        face_height: None,
    };
    assert_eq!(
        serde_json::to_value(r).unwrap(),
        json!({"x": 48.7109, "depth": 2.0, "water_force": 19.614})
    );
}

// ------------------------------------------------------------------------------------------------ the stubs

#[test]
fn a_valid_crack_model_reaches_the_stub_and_not_before() {
    let model: Model = serde_json::from_value(doc_with("0.5", ok_crack())).unwrap();
    let outcome = catch_unwind(AssertUnwindSafe(|| analyze(&model)));
    match outcome {
        Err(payload) => {
            let text = payload
                .downcast_ref::<String>()
                .cloned()
                .or_else(|| payload.downcast_ref::<&str>().map(|s| (*s).to_string()))
                .unwrap_or_default();
            assert!(text.contains(STUB), "{text}");
            assert!(text.contains("not yet implemented"), "{text}");
        }
        // M-grieta has replaced the stub: the analysis runs.
        Ok(result) => {
            result.expect("a valid crack model is analysed");
        }
    }
}

#[test]
fn the_stub_signatures_are_frozen() {
    // A compile-time check of the signatures that G1 and the water writer implement.
    let _locate: fn(
        &TensionCrack,
        &PreparedModel,
        &Surface,
        &LoadCase,
    ) -> Result<CrackPlan, CrackError> = crack::locate;
    let _truncate: fn(&CrackPlan, &PreparedModel, &Surface, &mut Vec<Slice>) -> CrackReport =
        crack::truncate;
    let _terms: fn(&PreparedModel, &Surface, &[Slice], f64) -> Vec<PondTerms> = water::ponded_terms;
    let _sign: fn(&PreparedModel) -> f64 = water::sliding_sign;
    assert_eq!(
        crack::TENSION_CRACK_NOT_REACHED,
        "tension_crack_not_reached"
    );
    let _ = CrackError::NotReached;
    assert_eq!(PondTerms::default(), PondTerms::ZERO);
    assert!(PondTerms::ZERO.is_zero());
}

#[test]
fn zero_pond_terms_leave_the_slices_bit_for_bit() {
    // The identity (E15e-1) depends on it: a zero term must not turn a `-0.0` into `0.0`.
    let report = run(&v047a(json!(["spencer"])));
    let mut slice: Slice = report.results[0].slices[3];
    slice.h_moment_base = -0.0;
    slice.driving_extra = -0.0;
    let before = slice;
    PondTerms::ZERO.add_to(&mut slice);
    assert_eq!(
        slice.h_moment_base.to_bits(),
        before.h_moment_base.to_bits()
    );
    assert_eq!(
        slice.driving_extra.to_bits(),
        before.driving_extra.to_bits()
    );
    assert_eq!(slice, before);
    // A non-zero term adds to the five fields.
    let t = PondTerms {
        weight: 1.0,
        h_force: 2.0,
        h_moment_base: 3.0,
        driving_extra: 4.0,
        pore_pressure: 5.0,
    };
    t.add_to(&mut slice);
    assert_eq!(slice.weight_extra, before.weight_extra + 1.0);
    assert_eq!(slice.h_force, before.h_force + 2.0);
    assert_eq!(slice.h_moment_base, 3.0);
    assert_eq!(slice.driving_extra, 4.0);
    assert_eq!(slice.pore_pressure, before.pore_pressure + 5.0);
}

#[test]
fn the_pond_stub_returns_one_zero_term_per_slice() {
    let doc = v047a(json!(["spencer"]));
    let model: Model = serde_json::from_value(doc).unwrap();
    let pm = PreparedModel::new(&model).unwrap();
    let report = run(&v047a(json!(["spencer"])));
    let slices = &report.results[0].slices;
    let surface = Surface::Circle(ogs_core::model::Circle {
        xc: CIRCLE.0,
        yc: CIRCLE.1,
        r: CIRCLE.2,
    });
    let terms = water::ponded_terms(&pm, &surface, slices, water::sliding_sign(&pm));
    assert_eq!(terms.len(), slices.len());
    assert!(terms.iter().all(PondTerms::is_zero));
    // V047a goes down toward the left: the sliding goes toward −x.
    assert_eq!(water::sliding_sign(&pm), -1.0);
}
