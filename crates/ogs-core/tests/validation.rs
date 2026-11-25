//! Regression tests for input validation and reporting (contract §4.5; revision R1-05, R1-08, R1-09).
//! Each test names the finding it covers. They use only the public API (`analyze`, `analyze_json`).

use ogs_core::geometry::{Ground, PreparedModel};
use ogs_core::methods::SolveStatus;
use ogs_core::model::Model;
use ogs_core::{OgsError, analyze, analyze_json};
use serde_json::{Value, json};

const ACADS: &str = include_str!("../../../examples/acads1a.ogs.json");

fn acads() -> Value {
    serde_json::from_str(ACADS).expect("the example is valid JSON")
}

/// Runs `analyze_json` on a document that must be rejected and returns the error text.
fn reject(doc: &Value) -> String {
    match analyze_json(&doc.to_string()) {
        Ok(_) => panic!("the document must be rejected, but it was analyzed: {doc}"),
        Err(e) => e,
    }
}

fn expect_invalid_model(doc: &Value, needle: &str) {
    let msg = reject(doc);
    assert!(
        msg.starts_with("InvalidModel:") && msg.contains(needle),
        "expected InvalidModel mentioning {needle:?}, got {msg:?}"
    );
}

/// The JSON of the adversarial review (R1-05): misspelled fields, a bogus format and absurd
/// parameters. Rebuilt from the description in `docs/reviews/R1_agy.md`, on ACADS 1(a).
const REVIEW_R1_05: &str = r#"{
  "format": "BOGUS_FORMAT",
  "version": "99.9",
  "meta": {"id": "V047a", "title": "ACADS 1(a)"},
  "units": "SI",
  "materials": [{"id": "soil", "name": "Soil", "model": "mohr_coulomb",
                 "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6,
                 "r_u": 0.5, "unitWeightSat": 25.0}],
  "regions": [{"material": "soil",
               "polygon": [[20,20],[20,25],[30,25],[50,35],[70,35],[70,20]]}],
  "water": {"unit_weight": 9.807, "piezometricLine": [[20,35],[70,35]]},
  "seismic_kh": 0.3,
  "slope": {"direction": "auto"},
  "analysis": {
    "methods": ["bishop", "spencer"], "slices": 50, "tolerance": 10.0,
    "max_iterations": 500, "min_m_alpha": -5.0,
    "search": {"type": "circular_entry_exit", "n_entry": 20, "n_exit": 20,
               "n_radius": 20, "max_radius_factor": 5.0, "refine": true}
  }
}"#;

#[test]
fn r1_05_review_input_is_rejected_as_invalid_model() {
    let msg = analyze_json(REVIEW_R1_05).expect_err("the review input must be rejected");
    assert!(msg.starts_with("InvalidModel:"), "{msg}");
    assert!(msg.contains("unknown field"), "{msg}");
}

#[test]
fn r1_05_bad_format_and_version_are_invalid_model() {
    let mut doc = acads();
    doc["format"] = json!("BOGUS_FORMAT");
    expect_invalid_model(&doc, "format");
    let mut doc = acads();
    doc["version"] = json!("99.9");
    expect_invalid_model(&doc, "version");
}

#[test]
fn r1_05_absurd_analysis_parameters_are_invalid_model() {
    type Mutation = fn(&mut Value);
    let cases: &[(&str, Mutation, &str)] = &[
        (
            "methods vacío",
            |v| v["analysis"]["methods"] = json!([]),
            "methods",
        ),
        (
            "método repetido",
            |v| v["analysis"]["methods"] = json!(["bishop", "bishop"]),
            "repetido",
        ),
        ("slices 0", |v| v["analysis"]["slices"] = json!(0), "slices"),
        (
            "slices 2001",
            |v| v["analysis"]["slices"] = json!(2001),
            "slices",
        ),
        (
            "tolerance 10",
            |v| v["analysis"]["tolerance"] = json!(10.0),
            "tolerance",
        ),
        (
            "tolerance 0",
            |v| v["analysis"]["tolerance"] = json!(0.0),
            "tolerance",
        ),
        (
            "max_iterations 0",
            |v| v["analysis"]["max_iterations"] = json!(0),
            "max_iterations",
        ),
        (
            "min_m_alpha -5",
            |v| v["analysis"]["min_m_alpha"] = json!(-5.0),
            "min_m_alpha",
        ),
        (
            "min_m_alpha 1.5",
            |v| v["analysis"]["min_m_alpha"] = json!(1.5),
            "min_m_alpha",
        ),
        (
            "max_radius_factor -1",
            |v| v["analysis"]["search"]["max_radius_factor"] = json!(-1.0),
            "max_radius_factor",
        ),
        (
            "max_radius_factor 0.5",
            |v| v["analysis"]["search"]["max_radius_factor"] = json!(0.5),
            "max_radius_factor",
        ),
        (
            "n_entry 0",
            |v| v["analysis"]["search"]["n_entry"] = json!(0),
            "n_entry",
        ),
        (
            "n_radius 201",
            |v| v["analysis"]["search"]["n_radius"] = json!(201),
            "n_radius",
        ),
        (
            "grilla 200³ > 2e6",
            |v| {
                v["analysis"]["search"]["n_entry"] = json!(200);
                v["analysis"]["search"]["n_exit"] = json!(200);
                v["analysis"]["search"]["n_radius"] = json!(200);
            },
            "candidatos",
        ),
        (
            "min_width -1",
            |v| v["analysis"]["search"]["min_width"] = json!(-1.0),
            "min_width",
        ),
        (
            "entry con lo > hi",
            |v| v["analysis"]["search"]["entry"] = json!([30.0, 20.0]),
            "lo debe ser",
        ),
        (
            "entry fuera del modelo",
            |v| v["analysis"]["search"]["entry"] = json!([-100.0, 30.0]),
            "extensión",
        ),
        (
            "exit fuera del modelo",
            |v| v["analysis"]["search"]["exit"] = json!([20.0, 500.0]),
            "extensión",
        ),
        (
            "círculo con r = 0",
            |v| {
                v["analysis"]["surface"] =
                    json!({"type": "circle", "xc": 30.0, "yc": 50.0, "r": 0.0});
            },
            "r > 0",
        ),
    ];
    for (name, mutate, needle) in cases {
        let mut doc = acads();
        mutate(&mut doc);
        println!("caso: {name}");
        expect_invalid_model(&doc, needle);
    }
}

#[test]
fn r1_05_unknown_fields_are_errors_at_every_level() {
    type Mutation = fn(&mut Value);
    let cases: &[(&str, Mutation)] = &[
        // E12a: v0.2 brings `analysis.seismic` and `loads`; the old `seismic_kh` at the top level stays unknown.
        ("top", |v| v["seismic_kh"] = json!(0.3)),
        ("meta", |v| v["meta"]["autor"] = json!("x")),
        ("material", |v| v["materials"][0]["r_u"] = json!(0.5)),
        ("region", |v| v["regions"][0]["label"] = json!("x")),
        ("water", |v| {
            v["water"] = json!({"piezometricLine": [[20, 35], [70, 35]]})
        }),
        ("slope", |v| v["slope"]["dirección"] = json!("auto")),
        ("analysis", |v| v["analysis"]["tolerence"] = json!(1e-5)),
        ("search", |v| {
            v["analysis"]["search"]["n_radiuss"] = json!(20)
        }),
        ("surface", |v| {
            v["analysis"]["surface"] =
                json!({"type": "circle", "xc": 1.0, "yc": 1.0, "r": 1.0, "rr": 2.0});
        }),
    ];
    for (level, mutate) in cases {
        let mut doc = acads();
        mutate(&mut doc);
        println!("nivel: {level}");
        let msg = reject(&doc);
        assert!(
            msg.starts_with("InvalidModel:") && msg.contains("unknown field"),
            "{level}: expected an unknown-field InvalidModel, got {msg:?}"
        );
    }
}

#[test]
fn r1_05_empty_methods_is_invalid_model_not_an_empty_success() {
    let mut doc = acads();
    doc["analysis"]["methods"] = json!([]);
    let model: Model = serde_json::from_value(doc).expect("structurally valid");
    match analyze(&model) {
        Err(OgsError::InvalidModel(msg)) => assert!(msg.contains("methods"), "{msg}"),
        other => panic!("expected InvalidModel, got {other:?}"),
    }
}

#[test]
fn r1_05_malformed_and_incomplete_json_keep_their_error_kinds() {
    let msg = analyze_json("{ esto no es JSON").expect_err("syntax error");
    assert!(msg.starts_with("Json:"), "{msg}");
    let mut doc = acads();
    doc.as_object_mut().unwrap().remove("materials");
    expect_invalid_model(&doc, "materials");
}

#[test]
fn r1_05_the_valid_example_still_runs() {
    let report: Value =
        serde_json::from_str(&analyze_json(ACADS).expect("the example is valid")).unwrap();
    let results = report["results"].as_array().unwrap();
    assert_eq!(results.len(), 2);
    for r in results {
        assert_eq!(r["status"], "converged", "{r}");
        assert!(r["fos"].as_f64().is_some_and(f64::is_finite), "{r}");
        // Only the informative codes of the contract (E5, E10a) may appear; any other warning fails the example.
        let allowed = [
            "negative_effective_normal",
            "truncated_mass",
            "negative_lambda",
            "load_outside_mass",
        ];
        for w in r["warnings"].as_array().expect("warnings array") {
            let code = w.as_str().expect("warning code");
            assert!(allowed.contains(&code), "unexpected warning {code}: {r}");
        }
    }
}

// ---------------------------------------------------------------- R1-09

/// Flat terrain `[0,40]×[0,10]` with a fixed circle: the mass has no driving moment.
fn flat_fixed_doc(methods: &[&str], circle: Value) -> Value {
    json!({
        "format": "opengeoslide",
        "version": "0.1",
        "materials": [{"id": "soil", "name": "Soil", "model": "mohr_coulomb",
                       "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6}],
        "regions": [{"material": "soil", "polygon": [[0,0],[0,10],[40,10],[40,0]]}],
        "slope": {"direction": "left_to_right"},
        "analysis": {"methods": methods, "surface": circle}
    })
}

#[test]
fn r1_09_no_driving_fixed_surface_is_reported_with_status_not_as_error() {
    let doc = flat_fixed_doc(
        &["bishop", "spencer"],
        json!({"type": "circle", "xc": 20.0, "yc": 20.0, "r": 15.0}),
    );
    let model: Model = serde_json::from_value(doc.clone()).unwrap();
    let report = analyze(&model).expect("a method failure on a fixed surface is not an error");
    assert_eq!(report.results.len(), 2);
    for r in &report.results {
        assert_eq!(r.status, SolveStatus::Invalid, "{r:?}");
        assert_eq!(r.fos, None, "a non-finite FS is reported as None: {r:?}");
        assert!(r.warnings.iter().any(|w| w == "no_driving"), "{r:?}");
    }
    let text = analyze_json(&doc.to_string()).unwrap();
    let json: Value = serde_json::from_str(&text).unwrap();
    assert_eq!(json["results"][0]["fos"], Value::Null, "{text}");
    assert_eq!(json["results"][0]["status"], "invalid", "{text}");
}

#[test]
fn r1_09_not_converged_fixed_surface_is_reported_with_status() {
    // The critical circle of ACADS 1(a) (from `ogs analyze`), with a budget of one iteration.
    let mut doc = acads();
    doc["analysis"]["search"] = Value::Null;
    doc["analysis"]["methods"] = json!(["bishop"]);
    doc["analysis"]["max_iterations"] = json!(1);
    doc["analysis"]["surface"] = json!({
        "type": "circle", "xc": 29.671747720494295, "yc": 53.36755872856064, "r": 28.36836976520301
    });
    let model: Model = serde_json::from_value(doc).unwrap();
    let report =
        analyze(&model).expect("NotConverged on a fixed surface is a report, not an error");
    let r = &report.results[0];
    assert_eq!(r.status, SolveStatus::NotConverged, "{r:?}");
    assert_eq!(r.iterations, 1);
}

#[test]
fn r1_09_unsliceable_fixed_surface_gives_the_reason() {
    let doc = flat_fixed_doc(
        &["bishop"],
        json!({"type": "circle", "xc": 200.0, "yc": 200.0, "r": 5.0}),
    );
    let model: Model = serde_json::from_value(doc).unwrap();
    match analyze(&model) {
        Err(OgsError::NoValidSurface(reason)) => {
            assert!(reason.contains("no corta el terreno"), "{reason}");
        }
        other => panic!("expected NoValidSurface with a reason, got {other:?}"),
    }
}

// ---------------------------------------------------------------- R1-08

#[test]
fn r1_08_v003_has_no_water_warning() {
    // V003: the piezometric line touches the ground within rounding error (about 3.6e-15 at x = 29.2475,
    // one ULP of the ordinate; the sign depends on the evaluation order).
    let text = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../verification/cases/V003.json"
    ))
    .expect("V003 exists");
    let case: Value = serde_json::from_str(&text).unwrap();
    let mut model: Model = serde_json::from_value(case["model"].clone()).unwrap();

    let pm = PreparedModel::new(&model).unwrap();
    let (water, ground) = (
        pm.piezometric_y(29.2475).unwrap(),
        pm.y_top(29.2475).unwrap(),
    );
    assert!(
        (water - ground).abs() < 1e-9 * 66.0,
        "the difference must be rounding error only: {:e}",
        water - ground
    );

    model.analysis.methods = vec![ogs_core::model::MethodKind::Bishop];
    model.analysis.slices = 40;
    let report = analyze(&model).expect("V003 analyzes");
    let r = &report.results[0];
    assert_eq!(r.status, SolveStatus::Converged);
    assert!(
        r.warnings.iter().all(|w| !w.contains("piezometric")),
        "V003 must not warn about water over the ground: {:?}",
        r.warnings
    );
}

/// ACADS 1(a) with the water line at the ground elevation plus `eps` (the ground is piecewise linear
/// with breaks at x = 30, 50, so the line uses the same breaks).
fn acads_water_offset(eps: f64) -> Value {
    let mut doc = acads();
    doc["analysis"]["search"] = Value::Null;
    doc["analysis"]["methods"] = json!(["bishop"]);
    doc["analysis"]["surface"] = json!({
        "type": "circle", "xc": 29.671747720494295, "yc": 53.36755872856064, "r": 28.36836976520301
    });
    doc["water"] = json!({"piezometric_line": [
        [20.0, 25.0 + eps], [30.0, 25.0 + eps], [50.0, 35.0 + eps], [70.0, 35.0 + eps]
    ]});
    doc
}

fn water_warnings(doc: &Value) -> Vec<String> {
    let model: Model = serde_json::from_value(doc.clone()).unwrap();
    let report = analyze(&model).expect("the model is valid");
    report.results[0].warnings.clone()
}

#[test]
fn r1_08_rounding_level_water_does_not_warn() {
    // 1e-12 above the ground is rounding error (tolerance 1e-9 · scale = 5e-8 for this model).
    let warnings = water_warnings(&acads_water_offset(1e-12));
    assert!(
        warnings.iter().all(|w| !w.contains("water_above_ground")),
        "rounding-level water must not warn: {warnings:?}"
    );
}

#[test]
fn r1_08_water_above_the_tolerance_warns_on_a_fixed_surface() {
    // 1e-6 above the ground is above the tolerance: the slices of the mass see water over the ground.
    let warnings = water_warnings(&acads_water_offset(1e-6));
    assert!(
        warnings.iter().any(|w| w.contains("water_above_ground")),
        "{warnings:?}"
    );
}

#[test]
fn r1_08_real_water_over_the_ground_still_warns() {
    // Water at elevation 35 is above the ACADS terrain for x < 50: the mass contains such slices.
    let mut doc = acads();
    doc["water"] = json!({"piezometric_line": [[0, 35.0], [100, 35.0]]});
    doc["analysis"]["search"]["n_entry"] = json!(5);
    doc["analysis"]["search"]["n_exit"] = json!(5);
    doc["analysis"]["search"]["n_radius"] = json!(5);
    doc["analysis"]["methods"] = json!(["bishop"]);
    let text = analyze_json(&doc.to_string()).expect("the model is valid");
    let report: Value = serde_json::from_str(&text).unwrap();
    let warnings = report["results"][0]["warnings"].as_array().unwrap();
    assert!(
        warnings
            .iter()
            .any(|w| w.as_str().unwrap().contains("water_above_ground")),
        "{warnings:?}"
    );
}

#[test]
fn circle_struct_still_rejects_unknown_type_tags() {
    // The `type` tag of a surface is a closed set (only "circle").
    let mut doc = acads();
    doc["analysis"]["surface"] = json!({"type": "polyline", "xc": 1.0, "yc": 1.0, "r": 1.0});
    let msg = reject(&doc);
    assert!(msg.starts_with("InvalidModel:"), "{msg}");
}
