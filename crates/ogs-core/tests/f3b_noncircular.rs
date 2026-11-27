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

// ---------------------------------------------------------------------------------------------------------------
// R15 (E16x): the conversion of the seed, the windows and the scale.

fn r15_nc(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/data/f3b/r15/nc")
        .join(name);
    serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
}
fn circular_only(model: &Value) -> Value {
    let mut c = model.clone();
    c["analysis"]["search"]
        .as_object_mut()
        .unwrap()
        .remove("non_circular");
    run(&c)
}
fn has_note(result: &Value, code: &str) -> bool {
    result["warnings"]
        .as_array()
        .unwrap()
        .iter()
        .any(|w| w == code)
}

/// R15A-02: in a plain 10 m, 45° slope the search used to discard all the seeds (`evaluated = 0`, 14 of 16) and give
/// back the circle with no note. The 16 slopes now refine, and never end above the circle.
#[test]
fn r15_sixteen_homogeneous_slopes_refine() {
    let mut files: Vec<_> =
        fs::read_dir(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/data/f3b/r15/nc"))
            .unwrap()
            .map(|e| e.unwrap().file_name().into_string().unwrap())
            .filter(|n| n.starts_with("diag_u_"))
            .collect();
    files.sort();
    assert_eq!(files.len(), 16);
    for name in files {
        let model = r15_nc(&name);
        let r = run(&model);
        assert_eq!(r["status"], "converged", "{name}");
        let nc = &r["search"]["non_circular"];
        assert!(
            nc["evaluated"].as_u64().unwrap() > 0,
            "{name}: evaluated = 0"
        );
        assert!(!has_note(&r, "non_circular_not_refined"), "{name}");
        let f = r["fos"].as_f64().unwrap();
        let c = circular_only(&model)["fos"].as_f64().unwrap();
        assert!(f <= c + 1e-12, "{name}: {f} > circle {c}");
    }
}

/// R15A-02: the bench with a weak layer. The search is no longer silent. cSlope's 1,8560 is not the bar here: its
/// own circular search (1,8619) is `converged = false` (gap 0,0084), and Spencer finds no root on its circle and its
/// polyline in this engine, so the comparison with it is not an A2 row (reported in R15-M3).
#[test]
fn r15_steep_bench_is_refined() {
    let model = r15_nc("steep_bench.json");
    let r = run(&model);
    let nc = &r["search"]["non_circular"];
    assert!(nc["evaluated"].as_u64().unwrap() > 0);
    let seed = nc["seed_fos"].as_f64().unwrap();
    let f = r["fos"].as_f64().unwrap();
    assert!(f < seed, "{f} vs circle {seed}");
    assert!(r["surface"]["points"].is_array());
    assert!(!has_note(&r, "non_circular_not_refined"));
}

/// R15A-08c: the floor of the seed selection is in the scale of the model, not 1.0. A model scaled by 1e-3, 1e-5 or
/// 1e5 gives the same seeds and the same FS.
#[test]
fn r15_scale_invariance() {
    let build = |s: f64| {
        json!({
            "format": "opengeoslide", "version": "0.6", "units": "SI",
            "materials": [{"id": "s", "name": "s", "model": "mohr_coulomb",
                "unit_weight": 20.0 / s, "cohesion": 5.0, "friction_angle": 25.0}],
            "regions": [{"material": "s", "polygon": [[0.0, 0.0], [50.0 * s, 0.0], [50.0 * s, 15.0 * s],
                [30.0 * s, 15.0 * s], [20.0 * s, 5.0 * s], [0.0, 5.0 * s]]}],
            "slope": {"direction": "right_to_left"},
            "analysis": {"methods": ["spencer"], "slices": 30, "tolerance": 1e-5, "max_iterations": 1000,
                "min_m_alpha": 0.2,
                "search": {"type": "circular_entry_exit", "n_entry": 10, "n_exit": 10, "n_radius": 10,
                    "non_circular": {"seeds": 3, "max_vertices": 17}}}
        })
    };
    let base = run(&build(1.0));
    let f0 = base["fos"].as_f64().unwrap();
    assert_eq!(base["search"]["non_circular"]["seeds"], 3);
    assert!(
        base["search"]["non_circular"]["evaluated"]
            .as_u64()
            .unwrap()
            > 0
    );
    for s in [1e-3, 1e-5, 1e5] {
        let r = run(&build(s));
        let nc = &r["search"]["non_circular"];
        assert_eq!(nc["seeds"], 3, "scale {s}");
        assert!(nc["evaluated"].as_u64().unwrap() > 0, "scale {s}");
        let f = r["fos"].as_f64().unwrap();
        assert!((f - f0).abs() / f0 < 1e-6, "scale {s}: {f} vs {f0}");
    }
}

/// E16x, point 4: with `non_circular` and no admissible polyline, the circle is the result and the note says so, once.
/// The berm with the exit window `[10, 20]`: the block that the slicer analyses starts at 20.00000955, outside the
/// window by more than the margin of `pm.tol()`, so no polyline has an end inside it.
#[test]
fn r15_not_refined_note() {
    let model = r15_nc("berm_window.json");
    let r = run(&model);
    assert_eq!(r["search"]["non_circular"]["evaluated"], 0);
    assert!(r["surface"]["points"].is_null());
    let count = r["warnings"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|w| *w == "non_circular_not_refined")
        .count();
    assert_eq!(count, 1);
    let c = circular_only(&model);
    assert_eq!(r["fos"], c["fos"]);
    assert!(!has_note(&c, "non_circular_not_refined"));
}
