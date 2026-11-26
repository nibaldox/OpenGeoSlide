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
