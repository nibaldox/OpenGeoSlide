//! W8b tests of the Spencer solver (E10c): equivalence with the former Zhu solver on fixed surfaces, and the D03
//! differential checks against cSlope.

use ogs_core::analyze;
use ogs_core::methods::SolveStatus;
use ogs_core::model::Model;
use ogs_core::report::MethodReport;
use serde_json::Value;

/// Loads a JSON file under the repository root (`verification/...`).
fn load(path: &str) -> Value {
    let text = std::fs::read_to_string(format!("{}/../../{path}", env!("CARGO_MANIFEST_DIR")))
        .expect("case file");
    serde_json::from_str(&text).expect("json")
}

/// Runs Spencer alone on the model of `doc` (a `.ogs.json` or a verification case with `model`). With `fixed`,
/// the search is removed and the circle `fixed` (a JSON `surface`) is analysed instead.
fn spencer(doc: &Value, fixed: Option<Value>) -> MethodReport {
    let mut m = doc.get("model").unwrap_or(doc).clone();
    m["analysis"]["methods"] = serde_json::json!(["spencer"]);
    if let Some(surface) = fixed {
        m["analysis"]
            .as_object_mut()
            .expect("analysis")
            .remove("search");
        m["analysis"]["surface"] = surface;
    }
    let model: Model = serde_json::from_value(m).expect("model");
    let report = analyze(&model).expect("analyze");
    report.results.into_iter().next().expect("one method")
}

/// Equivalence with the former Zhu solver on fixed surfaces V044, V045 and V016a (E10c, ≤ 1e-6 relative). The former
/// values are those of the commit before W8b.
#[test]
fn equivalence_with_former_zhu_solver_on_fixed_surfaces() {
    let cases = [
        ("verification/cases/V044.json", 2.072_769_312_990_772),
        ("verification/cases/V045.json", 1.828_371_325_016_601),
        ("verification/cases/V016a.json", 1.798_113_431_117_688_7),
    ];
    for (path, former) in cases {
        let doc = load(path);
        let fixed = doc["model"]["analysis"]["surface"].clone();
        let r = spencer(&doc, Some(fixed));
        assert_eq!(r.status, SolveStatus::Converged, "{path}: {r:?}");
        let fos = r.fos.expect("finite");
        assert!(
            (fos - former).abs() / former <= 1e-6,
            "{path}: E10c {fos} vs former {former}"
        );
    }
}

/// D03 (weak layer), differential. The fixed circle of the model is cSlope's Bishop-critical circle. cSlope cannot
/// solve Spencer on it either (`EngineError`: tension at the 90° entry). The Zhu moment has no root in the scan range
/// on that circle, so the status is `NotConverged("no_lambda_root")` and not a value.
#[test]
fn d03_model_circle_has_no_root_in_scan_range_as_cslope() {
    let doc = load("verification/differential/cases/D03.ogs.json");
    let fixed = doc["analysis"]["surface"].clone();
    let r = spencer(&doc, Some(fixed));
    assert_eq!(r.status, SolveStatus::NotConverged, "{r:?}");
    assert!(r.warnings.iter().any(|w| w == "no_lambda_root"), "{r:?}");
    assert!(r.fos.is_none());
}

/// D03: Spencer search against cSlope 0.5466738 (E9b: ogs ≤ cSlope·1.01), with the note
/// `negative_effective_normal_major` (f > 5 %, E7d).
#[test]
fn d03_search_is_within_one_percent_above_cslope() {
    let doc = load("verification/differential/cases/D03.ogs.json");
    let r = spencer(&doc, None);
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let fos = r.fos.expect("finite");
    let cslope = 0.546_673_842_037_715_4;
    assert!(fos <= cslope * 1.01, "ogs {fos} vs cSlope {cslope}");
    assert!(
        r.warnings
            .iter()
            .any(|w| w == "negative_effective_normal_major"),
        "{:?}",
        r.warnings
    );
}

/// D03: the circle of the Spencer search (ogs), fixed. Spencer converges and stays within 2 % of cSlope 0.5466738
/// (target of W8b). The circle is ogs' own, because cSlope's Spencer circle is not in `report.json`.
#[test]
fn d03_foot_circle_converges_within_two_percent_of_cslope() {
    let doc = load("verification/differential/cases/D03.ogs.json");
    let circle = serde_json::json!({
        "type": "circle",
        "xc": 40.153_004_421_498_97,
        "yc": 4.185_859_158_341_072,
        "r": 4.188_654_586_674_111
    });
    let r = spencer(&doc, Some(circle));
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let fos = r.fos.expect("finite");
    let cslope = 0.546_673_842_037_715_4;
    assert!(
        (fos - cslope).abs() / cslope <= 0.02,
        "FS {fos} vs cSlope {cslope}"
    );
}
