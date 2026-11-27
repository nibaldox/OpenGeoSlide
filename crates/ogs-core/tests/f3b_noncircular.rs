//! F6.10 and E16u: published and cSlope search and fixed-surface rows.
use serde_json::{Value, json};
use std::{fs, path::PathBuf};

fn run(model: &Value) -> Value {
    let out = ogs_core::analyze_json(&model.to_string()).expect("valid analysis");
    serde_json::from_str::<Value>(&out).unwrap()["results"][0].clone()
}
fn fixtures(prefix: &str) -> Vec<PathBuf> {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/data/f3b/nc");
    let mut files: Vec<_> = fs::read_dir(dir)
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| p.file_name().unwrap().to_str().unwrap().starts_with(prefix))
        .collect();
    files.sort();
    assert_eq!(files.len(), 10);
    files
}
fn read(p: &PathBuf) -> Value {
    serde_json::from_str(&fs::read_to_string(p).unwrap()).unwrap()
}

#[test]
fn ten_search_rows() {
    for file in fixtures("V") {
        let row = read(&file);
        let name = file.file_name().unwrap().to_str().unwrap();
        let model = &row["model"];
        let result = run(model);
        assert_eq!(result["status"], "converged", "{name}");
        let f = result["fos"].as_f64().unwrap();
        let reference = row["oracle"]["fos"]["morgenstern_price_constante"]
            .as_f64()
            .unwrap();
        assert!(f <= 1.01 * reference, "A2 {name}: {f} vs {reference}");
        let pubv = row["oracle"]["publicado"]["valor"].as_f64().unwrap();
        // E16u: despite the fixture's historical label, this is a relative tolerance.
        let tol = row["oracle"]["publicado"]["tolerancia_abs"]
            .as_f64()
            .unwrap();
        if name.starts_with("V002-") {
            assert!(
                result["warnings"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .any(|w| w == "negative_effective_normal_major")
            );
            assert!(f <= pubv * (1.0 + tol), "E16u A3 {name}: {f}");
        } else {
            assert!(
                (f - pubv).abs() / pubv <= tol,
                "A3 {name}: {f} published {pubv} tolerance {tol}"
            );
        }
        let nc = &result["search"]["non_circular"];
        assert!(nc["evaluated"].as_u64().unwrap() <= nc["seeds"].as_u64().unwrap() * 1500);
        let mut circ = model.clone();
        circ["analysis"]["search"]
            .as_object_mut()
            .unwrap()
            .remove("non_circular");
        let c = run(&circ);
        let cf = c["fos"].as_f64().unwrap();
        assert!(f <= cf + 1e-12, "A1 {name}: {f} > {cf}");
        if let Some(points) = result["surface"]["points"].as_array() {
            assert!(points.len() <= 33, "A4 {name}");
        }
        println!(
            "{name} search oracle={reference:.9} engine={f:.9} published={pubv:.9} margin={:.6}%",
            100.0
                * if name.starts_with("V002-") {
                    tol - (f - pubv) / pubv
                } else {
                    tol - (f - pubv).abs() / pubv
                }
        );
    }
}

#[test]
fn ten_evaluator_rows() {
    for file in fixtures("evaluador-") {
        let row = read(&file);
        let name = file.file_name().unwrap().to_str().unwrap();
        let result = run(&row["model"]);
        assert_eq!(result["status"], "converged", "{name}");
        let f = result["fos"].as_f64().unwrap();
        let reference = row["oracle"]["fos"]["morgenstern_price_constante"]
            .as_f64()
            .unwrap();
        assert!(
            (f - reference).abs() / reference <= 0.001,
            "{name}: {f} vs {reference}"
        );
        println!(
            "{name} fixed oracle={reference:.9} engine={f:.9} diff={:.6}%",
            100.0 * (f - reference) / reference
        );
    }
}

#[test]
fn deterministic_and_janbu() {
    let row = read(&fixtures("V")[0]);
    let m = &row["model"];
    assert_eq!(run(m), run(m));
    let path = fixtures("V")
        .into_iter()
        .find(|p| {
            p.file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .starts_with("V093-")
        })
        .unwrap();
    let mut m = read(&path)["model"].clone();
    m["analysis"]["methods"] = json!(["janbu_simplified"]);
    m["analysis"].as_object_mut().unwrap().remove("interslice");
    let nc = run(&m);
    m["analysis"]["search"]
        .as_object_mut()
        .unwrap()
        .remove("non_circular");
    let c = run(&m);
    assert_eq!(nc["status"], "converged");
    assert!(nc["fos"].as_f64().unwrap() <= c["fos"].as_f64().unwrap() + 1e-12);
    if let Some(p) = nc["surface"]["points"].as_array() {
        assert!(p.len() <= 33);
    }
}
