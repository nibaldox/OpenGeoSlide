//! Regression tests for review R3 (`docs/reviews/R3_agy.md`), methods block (W10a): E11a, E11b, E11c and E11f.
//!
//! Each counterexample of R3 is a test, run through the public `analyze` API with the data of the review:
//! R3-01 (λ selection and asymptotes), R3-02 (admissibility near the pole), R3-04 (Brent stop versus the final
//! cut) and R3-06 (classification of the negative effective normal forces).

use ogs_core::analyze;
use ogs_core::methods::SolveStatus;
use ogs_core::model::Model;
use ogs_core::report::MethodReport;
use serde_json::{Value, json};

/// Loads a JSON file under the repository root (`verification/...`).
fn load(path: &str) -> Value {
    let text = std::fs::read_to_string(format!("{}/../../{path}", env!("CARGO_MANIFEST_DIR")))
        .expect("case file");
    serde_json::from_str(&text).expect("json")
}

/// Runs one method on a fixed circle `(xc, yc, r)` of the model document `doc` (with `search` removed).
fn fixed_run(doc: &Value, method: &str, tolerance: f64, circle: (f64, f64, f64)) -> MethodReport {
    let mut m = doc.get("model").unwrap_or(doc).clone();
    m["analysis"]["methods"] = json!([method]);
    m["analysis"]["tolerance"] = json!(tolerance);
    m["analysis"]
        .as_object_mut()
        .expect("analysis")
        .remove("search");
    m["analysis"]["surface"] =
        json!({"type": "circle", "xc": circle.0, "yc": circle.1, "r": circle.2});
    run(&m)
}

fn run(value: &Value) -> MethodReport {
    let model: Model = serde_json::from_value(value.clone()).expect("model");
    let report = analyze(&model).expect("analyze");
    report.results.into_iter().next().expect("one method")
}

/// Two-layer slope of the R3-01/R3-02 counterexamples: the terrain `[[0,0],[0,10],[10,10],[30,25],[60,25],[60,0]]`
/// split at height `y_split` into an upper layer `top` and a lower layer `bot`. `top` and `bot` are
/// `(c, φ, γ, r_u)`. The split is the point where the terrain (slope 0.75 from (10,10) to (30,25)) reaches `y_split`.
fn two_layer_model(
    id: &str,
    y_split: f64,
    top: (f64, f64, f64, Option<f64>),
    bot: (f64, f64, f64, Option<f64>),
) -> Value {
    let x_split = 10.0 + (y_split - 10.0) * 20.0 / 15.0;
    let material = |name: &str, (c, phi, gamma, ru): (f64, f64, f64, Option<f64>)| {
        json!({
            "id": name, "name": name, "model": "mohr_coulomb",
            "unit_weight": gamma, "unit_weight_sat": null,
            "cohesion": c, "friction_angle": phi, "ru": ru
        })
    };
    json!({
        "format": "opengeoslide", "version": "0.1",
        "meta": {"id": id, "title": "R3 two-layer slope"},
        "units": "SI",
        "materials": [material("top", top), material("bot", bot)],
        "regions": [
            {"material": "top", "polygon": [[x_split, y_split], [30.0, 25.0], [60.0, 25.0], [60.0, y_split]]},
            {"material": "bot", "polygon": [[0.0, 0.0], [0.0, 10.0], [10.0, 10.0], [x_split, y_split],
                                             [60.0, y_split], [60.0, 0.0]]}
        ],
        "slope": {"direction": "auto"},
        "analysis": {
            "methods": ["spencer"], "slices": 50, "tolerance": 1e-5, "max_iterations": 500,
            "min_m_alpha": 0.2
        }
    })
}

/// Single-material slope of the R3-06 counterexamples: `[[0,0],[0,10],[10,10],[30,20],[60,20],[60,0]]`, γ = 20.
fn single_layer_model(id: &str, c: f64, phi: f64, ru: f64) -> Value {
    json!({
        "format": "opengeoslide", "version": "0.1",
        "meta": {"id": id, "title": "R3 single layer"},
        "units": "SI",
        "materials": [{
            "id": "soil", "name": "soil", "model": "mohr_coulomb",
            "unit_weight": 20.0, "unit_weight_sat": null,
            "cohesion": c, "friction_angle": phi, "ru": ru
        }],
        "regions": [{"material": "soil",
                     "polygon": [[0.0, 0.0], [0.0, 10.0], [10.0, 10.0], [30.0, 20.0], [60.0, 20.0], [60.0, 0.0]]}],
        "slope": {"direction": "auto"},
        "analysis": {
            "methods": ["spencer"], "slices": 50, "tolerance": 1e-5, "max_iterations": 500,
            "min_m_alpha": 0.2
        }
    })
}

fn method(r: &MethodReport, name: &str) -> String {
    format!("{name}: {r:?}")
}

/// R3-01a (E11a). Toe and crest layers of the review: the scan of the old solver stopped at the spurious root
/// λ = −0.371 (FS 1.517769, −5 % against cSlope 1.597387). The physical root is λ ≈ +0.402 with FS ≈ 1.5974.
#[test]
fn r3_01a_spencer_picks_the_physical_lambda_not_the_negative_one() {
    let doc = two_layer_model(
        "R3-01a",
        16.0,
        (40.0, 0.0, 20.0, None),
        (5.0, 35.0, 20.0, None),
    );
    let r = fixed_run(&doc, "spencer", 1e-5, (12.0, 35.0, 26.0));
    assert_eq!(r.status, SolveStatus::Converged, "{}", method(&r, "R3-01a"));
    let fos = r.fos.expect("finite");
    let lambda = r.lambda.expect("λ");
    let cslope = 1.597_387;
    assert!(
        (fos - cslope).abs() / cslope <= 1e-3,
        "FS {fos} vs cSlope {cslope}"
    );
    assert!((lambda - 0.402).abs() <= 0.01, "λ {lambda}");
    assert!(!r.warnings.iter().any(|w| w == "negative_lambda"), "{r:?}");
}

/// R3-01b (E11a, asymptote trap). The denominator `Σ b (E_k + E_{k+1})` of Zhu's update changes sign between
/// λ = −0.40 and −0.50, so the old scan aborted with `no_lambda_root`. The physical root is λ* = +0.766074 with
/// F* = 0.268487 (admissible: min Φ/F = 0.900, min m_α = 0.825).
#[test]
fn r3_01b_spencer_is_not_trapped_by_the_denominator_asymptote() {
    let doc = two_layer_model(
        "R3-01b",
        15.0,
        (20.0, 40.0, 20.0, Some(0.4)),
        (2.0, 0.0, 20.0, None),
    );
    let r = fixed_run(&doc, "spencer", 1e-5, (14.0, 38.0, 28.0));
    assert_eq!(r.status, SolveStatus::Converged, "{}", method(&r, "R3-01b"));
    let fos = r.fos.expect("finite");
    let lambda = r.lambda.expect("λ");
    assert!((fos - 0.268_487).abs() <= 1e-4, "FS {fos}");
    assert!((lambda - 0.766_074).abs() <= 1e-3, "λ {lambda}");
    assert!(!r.warnings.iter().any(|w| w == "negative_lambda"), "{r:?}");
}

/// R3-02 (E11b), case (1): the review reports Spencer `Converged` at 0.357100 (+233 % against its cSlope 0.107293),
/// with `min Φ/F = 0.000434`. Admissibility E11b rejects that root. The numbers of the review are not reproduced by
/// the geometry described in `R3_agy.md` (Bishop 0.074492 here against 0.082152 published, and cSlope 0.1.0 gives
/// Bishop 0.074469 on the same model). So the test checks the contract, not the published values: the spurious
/// 0.357100 must not come back, and a converged value must be near cSlope's 0.1.0 Spencer of the same model
/// (0.346323), or the result is `NotConverged`.
#[test]
fn r3_02_case1_no_spurious_pole_root_is_converged() {
    let doc = two_layer_model(
        "R3-02-1",
        17.0,
        (5.0, 0.0, 20.0, None),
        (0.0, 45.0, 20.0, Some(0.90)),
    );
    let r = fixed_run(&doc, "spencer", 1e-5, (10.0, 36.0, 26.0));
    match r.status {
        SolveStatus::Converged => {
            let fos = r.fos.expect("finite");
            assert!(
                (fos - 0.357_100).abs() > 1e-3,
                "the spurious root 0.357100 is back: {r:?}"
            );
            let cslope = 0.346_323;
            assert!(
                (fos - cslope).abs() / cslope <= 0.25,
                "converged FS {fos} far from cSlope {cslope}: {r:?}"
            );
        }
        SolveStatus::NotConverged => {
            assert!(r.fos.is_none(), "{r:?}");
        }
        SolveStatus::Invalid => panic!("unexpected Invalid: {r:?}"),
    }
}

/// R3-02 (E11b), case (2): the review reports Spencer 0.245024 (−26.8 % against Bishop 0.334603). On the geometry
/// described there, Bishop is 0.373360 here and cSlope 0.1.0 gives 0.373228, so the published Bishop is not
/// reproduced either. The contract: a converged Spencer must stay within 10 % of Bishop; otherwise `NotConverged`
/// (cSlope 0.1.0 reports EngineError for Spencer on this circle).
#[test]
fn r3_02_case2_spencer_is_not_far_below_bishop() {
    let doc = two_layer_model(
        "R3-02-2",
        17.0,
        (5.0, 0.0, 20.0, None),
        (2.0, 45.0, 20.0, Some(0.65)),
    );
    let circle = (12.0, 34.0, 24.0);
    let r = fixed_run(&doc, "spencer", 1e-5, circle);
    let b = fixed_run(&doc, "bishop", 1e-5, circle);
    let bishop = b.fos.expect("Bishop converges on this circle");
    assert!(
        (bishop - 0.373_228).abs() / 0.373_228 <= 1e-3,
        "Bishop {bishop} vs cSlope 0.373228"
    );
    match r.status {
        SolveStatus::Converged => {
            let fos = r.fos.expect("finite");
            assert!(
                (fos - 0.245_024).abs() > 1e-3,
                "the spurious root 0.245024 is back: {r:?}"
            );
            assert!(
                (fos - bishop).abs() / bishop <= 0.10,
                "converged FS {fos} is more than 10 % from Bishop {bishop}: {r:?}"
            );
        }
        SolveStatus::NotConverged => assert!(r.fos.is_none(), "{r:?}"),
        SolveStatus::Invalid => panic!("unexpected Invalid: {r:?}"),
    }
}

/// R3-04 (E11c). With `tolerance = 0.01` (allowed by §4.5) the fixed-surface Spencer of D01 and D06 did not
/// converge (`no_lambda_root`). They must converge, and the FS must agree with the value at `tolerance = 1e-5` to 1e-3.
#[test]
fn r3_04_spencer_converges_for_the_widest_legal_tolerance() {
    for path in [
        "verification/differential/cases/D01.ogs.json",
        "verification/differential/cases/D06.ogs.json",
    ] {
        let doc = load(path);
        let circle = {
            let s = &doc["analysis"]["surface"];
            (
                s["xc"].as_f64().expect("xc"),
                s["yc"].as_f64().expect("yc"),
                s["r"].as_f64().expect("r"),
            )
        };
        let tight = fixed_run(&doc, "spencer", 1e-5, circle);
        let loose = fixed_run(&doc, "spencer", 0.01, circle);
        assert_eq!(tight.status, SolveStatus::Converged, "{path}: {tight:?}");
        assert_eq!(loose.status, SolveStatus::Converged, "{path}: {loose:?}");
        let (a, b) = (tight.fos.expect("finite"), loose.fos.expect("finite"));
        assert!(
            (a - b).abs() / a <= 1e-3,
            "{path}: FS at 0.01 = {b}, at 1e-5 = {a}"
        );
    }
}

/// R3-06 (E11f). Three counterexamples of the review: the negative normal forces cover most of the base (44 of 51,
/// 27 of 51 and 15 of 51 slices) with `f ≤ 0.05`. They must be the major warning, not a note. The Bishop values
/// are the ones of the review (B_ogs), so the change is only the classification.
#[test]
fn r3_06_major_negative_normal_for_extensive_uplift() {
    let circle = (12.0, 38.0, 28.0);
    let cases = [
        ("R3-06-1", 5.0, 45.0, 0.95, 0.133_354),
        ("R3-06-2", 10.0, 40.0, 0.90, 0.431_514),
        ("R3-06-3", 25.0, 35.0, 0.85, 1.243_127),
    ];
    for (id, c, phi, ru, bishop_value) in cases {
        let doc = single_layer_model(id, c, phi, ru);
        let b = fixed_run(&doc, "bishop", 1e-5, circle);
        println!("[{id}] bishop {b:?}");
        assert_eq!(b.status, SolveStatus::Converged, "{id}: {b:?}");
        let fos = b.fos.expect("finite");
        assert!(
            (fos - bishop_value).abs() / bishop_value <= 1e-4,
            "{id}: {fos}"
        );
        assert!(
            b.warnings
                .iter()
                .any(|w| w == "negative_effective_normal_major"),
            "{id}: the uplift must be major, got {:?}",
            b.warnings
        );
    }
}

/// E11f: V002, V003 and V101 carry tension zones of the crest (f ≈ 0.02–0.04, negative normal forces on 13 % of the
/// base length at most). Every check of them keeps the note `negative_effective_normal`, not the major warning.
#[test]
fn e11f_published_cases_v002_v003_v101_stay_as_notes() {
    for id in ["V002", "V003", "V101"] {
        let case = load(&format!("verification/cases/{id}.json"));
        for chk in case["checks"].as_array().expect("checks") {
            let method = chk["method"].as_str().expect("method");
            let kind = chk["kind"].as_str().expect("kind");
            let mut m = case["model"].clone();
            m["analysis"]["methods"] = json!([method]);
            if let Some(n) = chk["options"]["slices"].as_u64() {
                m["analysis"]["slices"] = json!(n);
            }
            if kind == "search" {
                m["analysis"]
                    .as_object_mut()
                    .expect("analysis")
                    .remove("surface");
            } else {
                m["analysis"]
                    .as_object_mut()
                    .expect("analysis")
                    .remove("search");
            }
            let r = run(&m);
            assert_eq!(
                r.status,
                SolveStatus::Converged,
                "{id} {method} {kind}: {r:?}"
            );
            assert!(
                r.warnings.iter().any(|w| w == "negative_effective_normal"),
                "{id} {method} {kind}: the note is expected, got {:?}",
                r.warnings
            );
            assert!(
                !r.warnings
                    .iter()
                    .any(|w| w == "negative_effective_normal_major"),
                "{id} {method} {kind}: {:?}",
                r.warnings
            );
        }
    }
}
