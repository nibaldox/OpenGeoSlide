//! F3G-R12 (M-B): corrections of the pile of Ito and Matsui, contract F5.12 (E15l-11, E15l-12, E15l-13).
//!
//! * E15l-11 (A-02): a profile of pressure that is not finite is an `InvalidModel` error before solving.
//! * E15l-12 (A-06): in a material with `ru`, `σ′v = σv − ru·σ_soil` (no `u` of the piezometric line).
//! * E15l-13 (A-07): `Q(zf)` is interpolated with the same fraction as `F(zf)`: `0 < arm ≤ zf − z_top`.
//!
//! The rows are those of `tests/data/f3g3/` (the model of `docs/fase3/r12/repro/a02_fixed.json` is the row
//! `X22-S02-cphi` with `φ = 35°`, `spacing = 0.801` and a capacity).

use ogs_core::geometry::PreparedModel;
use ogs_core::model::{MethodKind, Model};
use ogs_core::reinforcement::PileProfiles;
use ogs_core::report::{AnalysisReport, MethodReport};
use ogs_core::{OgsError, analyze, analyze_json};
use serde_json::{Value, json};
use std::path::PathBuf;

const TOLERANCE_PCT: f64 = 0.1;
const METHODS: [&str; 5] = [
    "bishop",
    "spencer",
    "morgenstern_price",
    "janbu_simplified",
    "janbu_corrected",
];

fn data_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/data/f3g3")
}

fn row_doc(id: &str) -> Value {
    let text = std::fs::read_to_string(data_dir().join("rows").join(format!("{id}.json")))
        .unwrap_or_else(|e| panic!("{id}: {e}"));
    serde_json::from_str(&text).expect("row parses")
}

fn expected_r12() -> Value {
    let text = std::fs::read_to_string(data_dir().join("expected_r12.json")).expect("expected_r12");
    serde_json::from_str(&text).expect("expected_r12.json parses")
}

fn try_run(doc: &Value) -> Result<AnalysisReport, String> {
    let model: Model = serde_json::from_value(doc.clone()).map_err(|e| e.to_string())?;
    analyze(&model).map_err(|e: OgsError| e.to_string())
}

fn run(doc: &Value) -> AnalysisReport {
    try_run(doc).unwrap_or_else(|e| panic!("the analysis failed: {e}"))
}

fn method_name(m: MethodKind) -> String {
    serde_json::to_value(m)
        .unwrap()
        .as_str()
        .unwrap()
        .to_string()
}

fn result<'a>(report: &'a AnalysisReport, method: &str) -> &'a MethodReport {
    report
        .results
        .iter()
        .find(|r| method_name(r.method) == method)
        .unwrap_or_else(|| panic!("no {method}"))
}

fn forces(r: &MethodReport) -> Vec<Value> {
    r.reinforcement_forces
        .iter()
        .map(|f| serde_json::to_value(f).unwrap())
        .collect()
}

fn pile_mut(doc: &mut Value) -> &mut Value {
    &mut doc["reinforcements"][0]
}

fn pct(got: f64, want: f64) -> f64 {
    (got / want - 1.0) * 100.0
}

/// The model of A-02 (`a02_fixed.json`): `S/D = 1.00125`, `φ = 35°`, `capacity {shear 150, moment 300}`.
fn a02() -> Value {
    let mut doc = row_doc("X22-S02-cphi");
    doc["materials"][0]["friction_angle"] = json!(35.0);
    let p = pile_mut(&mut doc);
    p["spacing"] = json!(0.801);
    p["capacity"] = json!({"shear": 150.0, "moment": 300.0});
    doc["analysis"]["methods"] =
        json!(["bishop", "spencer", "janbu_simplified", "morgenstern_price"]);
    doc
}

/// The error of `analyze_json` (the `Ok` report is never printed: it is huge).
fn error_of(doc: &Value) -> String {
    match analyze_json(&doc.to_string()) {
        Err(e) => e,
        Ok(_) => panic!("the analysis should fail"),
    }
}

/// No `NaN` or `∞` in the serialized report (serde writes them as `null`).
fn assert_finite_output(report: &AnalysisReport, what: &str) {
    let v = serde_json::to_value(report).unwrap();
    for r in v["results"].as_array().unwrap() {
        for f in r["reinforcement_forces"].as_array().into_iter().flatten() {
            for (k, x) in f.as_object().unwrap() {
                assert!(!x.is_null(), "{what}: `{k}` is null in {f}");
            }
        }
    }
}

// ------------------------------------------------------------------------------------------------ E15l-11

#[test]
fn e15l_11_a_profile_that_is_not_finite_is_a_clear_error() {
    let err = error_of(&a02());
    let want = "InvalidModel: reinforcements[0].lateral_pressure: la presión de Ito-Matsui no es finita \
con S/D = 1.00125 y φ = 35°";
    assert!(err.starts_with(want), "{err}");
    assert!(
        err.ends_with(
            "(las ecuaciones 13 y 14 desbordan cuando S/D se acerca a 1); aumente spacing"
        ),
        "{err}"
    );
}

#[test]
fn e15l_11_the_error_does_not_depend_on_the_capacity_nor_the_head() {
    // A-02, second reproduction: the head at y1 = 1.88 (the crossing at k = 1, f[0] = 0, f[1] = ∞), capacity moment 10.
    let mut doc = a02();
    let p = pile_mut(&mut doc);
    p["y1"] = json!(1.88);
    p["capacity"] = json!({"shear": 150.0, "moment": 10.0});
    let err = error_of(&doc);
    assert!(err.contains("no es finita con S/D = 1.00125"), "{err}");
    // without capacity either
    pile_mut(&mut doc)
        .as_object_mut()
        .unwrap()
        .remove("capacity");
    error_of(&doc);
    // S/D = 3 and φ = 89°: the overflow of the exponential
    let mut doc = a02();
    doc["materials"][0]["friction_angle"] = json!(89.0);
    let p = pile_mut(&mut doc);
    p["spacing"] = json!(2.4);
    let err = error_of(&doc);
    assert!(err.contains("S/D = 3 y φ = 89°"), "{err}");
}

#[test]
fn e15l_11_the_checked_constructor_reports_the_pile_and_the_unchecked_one_still_builds() {
    let model: Model = serde_json::from_value(a02()).unwrap();
    let pm = PreparedModel::new(&model).unwrap();
    let err = match PileProfiles::try_with_step(&model.reinforcements, &pm, 0.05) {
        Err(e) => e,
        Ok(_) => panic!("the profile overflows"),
    };
    assert!(
        matches!(&err, OgsError::InvalidModel(m) if m.starts_with("reinforcements[0].lateral_pressure:")),
        "{err}"
    );
    // a finite profile builds
    let ok: Model = serde_json::from_value(row_doc("X22-S02-cphi")).unwrap();
    let pm = PreparedModel::new(&ok).unwrap();
    assert!(PileProfiles::try_with_step(&ok.reinforcements, &pm, 0.05).is_ok());
    // the unchecked constructor of always keeps building (it is the one of the tests of the module)
    let _ = PileProfiles::with_step(
        &model.reinforcements,
        &PreparedModel::new(&model).unwrap(),
        0.05,
    );
}

#[test]
fn e15l_11_a_huge_but_finite_profile_keeps_computing() {
    // φ = 25°, S = 0.8019, D = 0.8: the pressure is ~1e141 kN/m and still finite (the capacities cap the force).
    let mut doc = a02();
    doc["materials"][0]["friction_angle"] = json!(25.0);
    pile_mut(&mut doc)["spacing"] = json!(0.8019);
    let report = run(&doc);
    assert_finite_output(&report, "1e141");
    for m in ["bishop", "spencer", "morgenstern_price", "janbu_simplified"] {
        let r = result(&report, m);
        assert_eq!(r.status, ogs_core::methods::SolveStatus::Converged, "{m}");
        assert!(r.fos.is_some_and(f64::is_finite), "{m}");
        let f = &forces(r)[0];
        let soil = f["soil_force"].as_f64().unwrap();
        assert!(soil.is_finite() && soil > 1e100, "{m}: {soil}");
        assert_eq!(f["governs"], "shear", "{m}");
    }
}

// ------------------------------------------------------------------------------------------------ E15l-12

#[test]
fn e15l_12_ru_and_a_piezometric_line_follow_the_oracle_within_0_1_percent() {
    let exp = expected_r12();
    let id = "X22-S16-ru-piezo";
    let report = run(&row_doc(id));
    let mut worst = 0.0_f64;
    for m in METHODS {
        let want = exp["rows"][id]["oracle"][m].as_f64().unwrap();
        let got = result(&report, m).fos.expect("fos");
        let d = pct(got, want);
        println!("{id} {m:<18} {got:.6} against {want:.6} ({d:+.4} %)");
        worst = worst.max(d.abs());
    }
    let f = &forces(result(&report, "bishop"))[0];
    let got = f["available"].as_f64().unwrap();
    let want = exp["rows"][id]["force_per_metre"]["oracle"]
        .as_f64()
        .unwrap();
    let df = pct(got, want);
    println!("{id} force per metre {got:.4} against {want:.4} ({df:+.4} %); worst FS {worst:.4} %");
    assert!(worst <= TOLERANCE_PCT, "FS: {worst} %");
    assert!(df.abs() <= TOLERANCE_PCT, "force: {df} %");
}

#[test]
fn e15l_12_the_piezometric_line_does_not_change_a_pile_in_a_material_with_ru() {
    // With `ru` the line is not applied (E14o-4): the pile of the row with the line is the one of the row without it.
    let with = row_doc("X22-S16-ru-piezo");
    let mut without = with.clone();
    without.as_object_mut().unwrap().remove("water");
    let (a, b) = (run(&with), run(&without));
    let (fa, fb) = (
        &forces(result(&a, "bishop"))[0],
        &forces(result(&b, "bishop"))[0],
    );
    assert_eq!(fa["soil_force"], fb["soil_force"]);
    assert_eq!(fa["arm"], fb["arm"]);
    // and a material without `ru` does subtract `u` of the line (E15l-12, `σ′v = σv − u`)
    let mut dry = with.clone();
    dry["materials"][0]["ru"] = Value::Null;
    let mut no_line = dry.clone();
    no_line.as_object_mut().unwrap().remove("water");
    let (c, d) = (run(&dry), run(&no_line));
    let soil = |r: &AnalysisReport| {
        forces(result(r, "bishop"))[0]["soil_force"]
            .as_f64()
            .unwrap()
    };
    assert!(soil(&c) < soil(&d), "{} against {}", soil(&c), soil(&d));
}

// ------------------------------------------------------------------------------------------------ E15l-13

/// A-07: the head at y1 = 1.87 and the crossing at 1.8576 (Δz = 0.0124 m), `capacity.moment`.
fn a07(moment: f64) -> Value {
    let mut doc = row_doc("X22-S02-cphi");
    let p = pile_mut(&mut doc);
    p["y1"] = json!(1.87);
    p["spacing"] = json!(2.4);
    p["capacity"] = json!({ "moment": moment });
    doc["analysis"]["methods"] = json!(["bishop"]);
    doc["analysis"]
        .as_object_mut()
        .unwrap()
        .remove("interslice");
    doc
}

#[test]
fn e15l_13_the_arm_in_the_first_step_is_positive_and_the_moment_capacity_applies() {
    let report = run(&a07(0.01));
    let f = &forces(result(&report, "bishop"))[0];
    let arm = f["arm"].as_f64().unwrap();
    let soil = f["soil_force"].as_f64().unwrap();
    let available = f["available"].as_f64().unwrap();
    println!(
        "A-07: arm {arm}, soil {soil}, available {available}, governs {}",
        f["governs"]
    );
    // the crossing of the fixed circle at x = 17.5 is at y ≈ 1.8576: Δz = 1.87 − 1.8576 ≈ 0.0124 m
    assert!(arm > 0.0 && arm <= 0.0125, "arm {arm}");
    assert_eq!(f["governs"], "bending");
    // the moment per pile / arm, per metre of the spacing 2.4
    assert!((available - 0.01 / arm / 2.4).abs() < 1e-12, "{available}");
    assert!(available < soil);
}

#[test]
fn e15l_13_the_arm_is_half_the_step_when_the_pressure_is_constant() {
    // The first step: F(zf) is linear and Q uses the midpoint of the fraction, so L_m = (zf − z_top)/2 exactly when
    // the pressure is constant between the head and the crossing.
    let report = run(&a07(250.0));
    let f = &forces(result(&report, "bishop"))[0];
    let arm = f["arm"].as_f64().unwrap();
    let dz = 1.87 - 1.8576;
    assert!(
        arm > 0.0 && (arm - dz / 2.0).abs() < 6e-4,
        "{arm} against {}",
        dz / 2.0
    );
    assert_eq!(f["governs"], "soil");
}

#[test]
fn e15l_13_the_arm_never_exceeds_the_depth_of_the_crossing_under_the_head() {
    // 0 < arm ≤ zf − z_top for every head over the crossing; sweeps heads from 0.2 mm to 0.5 m over it.
    for over in [
        0.0002_f64, 0.001, 0.0124, 0.024, 0.026, 0.049, 0.051, 0.11, 0.5,
    ] {
        let mut doc = a07(250.0);
        let y_cross = {
            // the crossing of the row without a head cut: the full pile
            let mut d = a07(250.0);
            pile_mut(&mut d)["y1"] = json!(5.0);
            let r = run(&d);
            forces(result(&r, "bishop"))[0]["y"].as_f64().unwrap()
        };
        pile_mut(&mut doc)["y1"] = json!(y_cross + over);
        let report = run(&doc);
        let fs = forces(result(&report, "bishop"));
        let arm = fs[0]["arm"].as_f64().unwrap();
        assert!(
            arm > 0.0 && arm <= over * (1.0 + 1e-9) + 1e-12,
            "over {over}: arm {arm}"
        );
    }
}
