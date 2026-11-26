//! E13k: the warning `interslice_shear_exceeds_strength` (`r_v > 3`) of Spencer and Morgenstern-Price.
//!
//! `r_v = max_faces |X|·F / (c_v·h + max(E′, 0)·tan φ_v)`, the criterion of Chen and Morgenstern (1983) in the form (d) of
//! Zhu, Lee and Jiang (2003). The reference values below are those of the D-1 implementation in Python
//! (`docs/fase3/d1/tools/admiss.py`, run with the binary of the base on the same models); the engine must give them to
//! 1e-6 relative. The three polylines of D-1 (A, B, C: Spencer FS of 49 to 130 against 4 to 5 of Janbu) receive the
//! warning; V047a and the rest of the reference cases do not, and their reports are unchanged.

use ogs_core::methods::SolveStatus;
use ogs_core::model::Model;
use ogs_core::report::MethodReport;
use ogs_core::{analyze, interslice_shear_ratio};
use serde_json::{Value, json};
use std::path::PathBuf;

const WARNING: &str = "interslice_shear_exceeds_strength";

/// (label, polyline in the frame of the D-1 generator, `r_v` of `admiss.py`).
fn d1_cases() -> Vec<(&'static str, Vec<[f64; 2]>, f64)> {
    vec![
        (
            "A",
            vec![[9.63, 9.95], [21.796, -2.571], [26.067, -0.05]],
            122.01721314903094,
        ),
        (
            "B",
            vec![[8.091, 9.95], [24.156, -5.734], [33.598, -0.05]],
            33.97627854000245,
        ),
        (
            "C",
            vec![
                [13.132, 6.818],
                [13.273, 6.502],
                [15.729, 1.233],
                [16.332, 0.79],
                [20.439, -5.871],
                [23.337, -6.659],
                [31.391, -0.05],
            ],
            53.31729962857037,
        ),
    ]
}

/// The model of `d1_spencer_absurd_fs.rs`: the mirror image (x → −x, `right_to_left`) of the generator of D-1.
fn d1_doc(points: &[[f64; 2]]) -> Value {
    let pts: Vec<[f64; 2]> = points.iter().rev().map(|p| [-p[0], p[1]]).collect();
    json!({
        "format": "opengeoslide", "version": "0.3",
        "meta": {"id": "d1", "title": "D-1"}, "units": "SI",
        "materials": [{"id": "suelo", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 10.0, "friction_angle": 30.0}],
        "regions": [{"material": "suelo", "polygon": [[0.0, -10.0], [-40.0, -10.0], [-40.0, 0.0], [-20.0, 0.0], [-10.0, 10.0], [0.0, 10.0]]}],
        "slope": {"direction": "right_to_left"},
        "analysis": {"methods": ["spencer", "morgenstern_price", "janbu_simplified"], "slices": 50, "tolerance": 1e-5,
                     "max_iterations": 500, "min_m_alpha": 0.2,
                     "surface": {"type": "polyline", "points": pts},
                     "interslice": {"function": "constant"}}
    })
}

fn model_of(doc: &Value) -> Model {
    serde_json::from_value(doc.clone()).expect("model")
}

fn run(model: &Model) -> Vec<MethodReport> {
    analyze(model).expect("analysis").results
}

fn rv(model: &Model, report: &MethodReport) -> f64 {
    interslice_shear_ratio(model, report)
        .expect("r_v")
        .expect("Spencer or M-P converged")
}

fn assert_close(label: &str, got: f64, want: f64) {
    assert!(
        (got - want).abs() <= 1e-6 * want.abs(),
        "{label}: r_v {got} against the reference {want}"
    );
}

/// A, B, C: `r_v` equals the one of `admiss.py` to 1e-6 (Spencer and M-P `constant` are the same solution), and the
/// warning is raised. Janbu has `X = 0`: no warning, no `r_v`.
#[test]
fn the_d1_polylines_match_the_reference_r_v_and_get_the_warning() {
    for (label, pts, reference) in d1_cases() {
        let model = model_of(&d1_doc(&pts));
        let reports = run(&model);
        for r in &reports[..2] {
            assert_eq!(r.status, SolveStatus::Converged, "{label}");
            let value = rv(&model, r);
            println!("{label} {:?}: r_v = {value}", r.method);
            assert_close(label, value, reference);
            assert!(
                r.warnings.iter().any(|w| w == WARNING),
                "{label}: {:?}",
                r.warnings
            );
        }
        let janbu = &reports[2];
        assert!(janbu.warnings.iter().all(|w| w != WARNING), "{label}");
        assert_eq!(interslice_shear_ratio(&model, janbu).unwrap(), None);
    }
}

fn case_model(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../verification/cases")
        .join(format!("{name}.json"));
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path:?}: {e}"));
    let doc: Value = serde_json::from_str(&text).expect("case");
    doc["model"].clone()
}

/// V047a (ACADS 1(a), search, 50 slices): `r_v` of Spencer and of M-P half sine equal the reference to 1e-6, both below
/// the limit, so there is no warning (they keep `truncated_mass` only).
#[test]
fn v047a_matches_the_reference_r_v_and_has_no_warning() {
    let mut doc = case_model("V047a");
    doc["analysis"]["methods"] = json!(["spencer", "morgenstern_price"]);
    let model = model_of(&doc);
    let reports = run(&model);
    let want = [0.8920141971213524, 1.0866463257359185];
    for (r, want) in reports.iter().zip(want) {
        let value = rv(&model, r);
        println!("V047a {:?}: r_v = {value}", r.method);
        assert_close("V047a", value, want);
        assert!(r.warnings.iter().all(|w| w != WARNING), "{:?}", r.warnings);
    }
}

/// V021 (a strengthless sand cap, Su = 0): the faces in the sand have no strength at all and are excluded, so `r_v`
/// is finite and below the limit and the published FS carries no warning.
#[test]
fn v021_faces_without_strength_are_excluded() {
    for suffix in ["a", "b", "c", "d", "e", "f", "g"] {
        let name = format!("V021{suffix}");
        let mut doc = case_model(&name);
        doc["analysis"]["methods"] = json!(["spencer", "morgenstern_price"]);
        let model = model_of(&doc);
        for r in run(&model) {
            assert_eq!(r.status, SolveStatus::Converged, "{name} {:?}", r.method);
            let value = rv(&model, &r);
            assert!(
                value.is_finite() && value <= 3.0,
                "{name} {:?}: r_v {value}",
                r.method
            );
            assert!(r.warnings.iter().all(|w| w != WARNING), "{name}");
        }
    }
}

/// Effect on the reference cases: no case of `verification/cases` (93, as written, with Spencer and M-P) receives the
/// warning (Spencer and M-P, searched or fixed as each case says).
#[test]
fn no_reference_case_receives_the_warning() {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../verification/cases");
    let mut names: Vec<String> = std::fs::read_dir(&dir)
        .unwrap()
        .filter_map(|e| e.ok()?.file_name().into_string().ok())
        .filter(|n| n.starts_with('V') && n.ends_with(".json"))
        .collect();
    names.sort();
    assert!(names.len() >= 90, "{}", names.len());
    // One result per case and method; a case that the engine rejects as written (an invalid model, a surface that cannot
    // be sliced) has none, and the warning is about results. The cases are spread over the cores: they are searches.
    let next = std::sync::atomic::AtomicUsize::new(0);
    let outcomes = std::sync::Mutex::new((0_usize, Vec::<String>::new()));
    std::thread::scope(|scope| {
        for _ in 0..std::thread::available_parallelism().map_or(4, |n| n.get().min(8)) {
            scope.spawn(|| {
                loop {
                    let i = next.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    let Some(file) = names.get(i) else { break };
                    let name = file.trim_end_matches(".json");
                    let mut doc = case_model(name);
                    doc["analysis"]["methods"] = json!(["spencer", "morgenstern_price"]);
                    // The methods of v0.3 need the version of the format that has them.
                    doc["version"] = json!("0.3");
                    let model = model_of(&doc);
                    let Ok(analysis) = analyze(&model) else {
                        outcomes.lock().unwrap().1.push(name.to_string());
                        continue;
                    };
                    for r in &analysis.results {
                        assert!(
                            r.warnings.iter().all(|w| w != WARNING),
                            "{name} {:?}: {:?}",
                            r.method,
                            r.warnings
                        );
                    }
                    outcomes.lock().unwrap().0 += analysis.results.len();
                }
            });
        }
    });
    let (evaluated, rejected) = outcomes.into_inner().unwrap();
    println!("{evaluated} results evaluated, rejected as written: {rejected:?}");
    assert_eq!(evaluated + 2 * rejected.len(), 2 * names.len());
    assert!(evaluated >= 150, "{evaluated} results evaluated");
}

/// `r_v` of `admiss.py` (D-1) on the differential battery D01 to D17 and `acads1a`, Spencer and M-P (`half_sine`, the
/// default), as written but with these two methods. It covers layered soils (D03, D15 to D17), a piezometric line
/// (D06, D14) and `ru` (D02, D09), which the reference integrates by sampling the face (2000 midpoints, 40 in D02 and
/// D09; the 40 of its default give up to 0.8 % in D15). The largest is D13 Spencer, 1.63, the one that fixes the limit at 3.
const BATTERY_R_V: [(&str, &str, f64); 36] = [
    ("D01", "spencer", 0.740560924275905),
    ("D01", "morgenstern_price", 0.8461163976106287),
    ("D02", "spencer", 0.8364279418278842),
    ("D02", "morgenstern_price", 0.847602069429624),
    ("D03", "spencer", 0.13373100866189094),
    ("D03", "morgenstern_price", 0.31308690428478364),
    ("D04", "spencer", 0.8110630923516594),
    ("D04", "morgenstern_price", 0.832540069646304),
    ("D05", "spencer", 1.0026966150012468),
    ("D05", "morgenstern_price", 1.201738683385841),
    ("D06", "spencer", 0.8330224666392125),
    ("D06", "morgenstern_price", 0.9969817204544492),
    ("D07", "spencer", 0.3011899592999714),
    ("D07", "morgenstern_price", 0.293409625489546),
    ("D08", "spencer", 0.8903383622937059),
    ("D08", "morgenstern_price", 1.08455184995674),
    ("D09", "spencer", 0.9336825428328506),
    ("D09", "morgenstern_price", 0.4701705567315261),
    ("D10", "spencer", 0.4997978662146211),
    ("D10", "morgenstern_price", 0.5189664461982327),
    ("D11", "spencer", 1.0597115865423048),
    ("D11", "morgenstern_price", 1.109262941744515),
    ("D12", "spencer", 0.9626882815849858),
    ("D12", "morgenstern_price", 1.2270108396954074),
    ("D13", "spencer", 1.6332266854112891),
    ("D13", "morgenstern_price", 1.1764467241212362),
    ("D14", "spencer", 0.8607183193379055),
    ("D14", "morgenstern_price", 1.0616716100717323),
    ("D15", "spencer", 0.37245869591602904),
    ("D15", "morgenstern_price", 0.2577732715156895),
    ("D16", "spencer", 0.5771160106773174),
    ("D16", "morgenstern_price", 0.5445138986297446),
    ("D17", "spencer", 0.4794754022968632),
    ("D17", "morgenstern_price", 0.43144573470320624),
    ("acads1a", "spencer", 0.8920141971213494),
    ("acads1a", "morgenstern_price", 1.0866463257359222),
];

fn battery_model(name: &str) -> Value {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let path = if name == "acads1a" {
        root.join("examples/acads1a.ogs.json")
    } else {
        let dir = if name <= "D14" { "cases" } else { "cases_f3" };
        root.join(format!("verification/differential/{dir}/{name}.ogs.json"))
    };
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path:?}: {e}"));
    let doc: Value = serde_json::from_str(&text).expect("model");
    doc.get("model").cloned().unwrap_or(doc)
}

/// Models of the battery whose faces the reference integrates without discretization error: one material, no water.
fn exact_reference(name: &str) -> bool {
    !matches!(
        name,
        "D02" | "D03" | "D06" | "D09" | "D14" | "D15" | "D16" | "D17"
    )
}

/// `r_v` of the engine against `admiss.py` on the battery: the same value to 1e-6 relative in homogeneous dry soil (to
/// 1e-3 with layers, water or `ru`, where the reference samples the face), and no result above the limit (no warning).
#[test]
fn the_battery_matches_the_reference_r_v_and_has_no_warning() {
    let mut names: Vec<&str> = BATTERY_R_V.iter().map(|r| r.0).collect();
    names.dedup();
    let mut worst = 0.0_f64;
    for name in names {
        let mut doc = battery_model(name);
        doc["version"] = json!("0.3");
        doc["analysis"]["methods"] = json!(["spencer", "morgenstern_price"]);
        if doc["analysis"].get("interslice").is_none() {
            doc["analysis"]["interslice"] = json!({"function": "half_sine"});
        }
        let model = model_of(&doc);
        for r in run(&model) {
            let key = if r.method == ogs_core::model::MethodKind::Spencer {
                "spencer"
            } else {
                "morgenstern_price"
            };
            let want = BATTERY_R_V
                .iter()
                .find(|row| row.0 == name && row.1 == key)
                .unwrap_or_else(|| panic!("{name} {key}"))
                .2;
            let value = rv(&model, &r);
            worst = worst.max((value - want).abs() / want);
            println!("{name} {key}: r_v {value:.9} against {want:.9}");
            // The reference samples the face (the kink of the water level and the interfaces of the layers are
            // discretized there); the engine integrates them exactly.
            let tolerance = if exact_reference(name) { 1e-6 } else { 1e-3 };
            assert!(
                (value - want).abs() <= tolerance * want,
                "{name} {key}: r_v {value} against the reference {want}"
            );
            assert!(value <= 3.0 && r.warnings.iter().all(|w| w != WARNING));
        }
    }
    println!("largest relative difference: {worst:e}");
}
