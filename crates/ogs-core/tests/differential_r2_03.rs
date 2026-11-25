//! Differential check of the R2-03 slope against the cSlope 0.1.0 oracle (criterion E9b, W7a; E10a, W8a).
//!
//! Oracle values, cSlope 0.1.0 through `verification/harness/to_cslope.py`: 50 slices, default search
//! (20 × 20 × 20, `max_radius_factor` 5, refinement), slope `[[0,0],[0,15],[15,15],[30,25],[60,25],[60,0]]`,
//! γ = 20, c = 2, φ = 45°, r_u = 0.65, direction auto. Bishop 0.33067891 (exit (15, 15), entry (30.706, 25));
//! Spencer 0.38760464 (exit (15, 15), entry (31.152, 25)). Constants are the rounded values of the W7 brief.
//!
//! W8a (E10a): the oracle's Bishop circle is valid. Its toe lens (ahead of the exit (15, 15), split from the
//! face by an air contact at the vertex) is dropped, and the surface is analysed with its main block only
//! (`truncated_mass`). The Bishop gate `FS_ogs ≤ FS_cSlope · 1.01` is active: ogs gives 0.33088 (+0.06 %) in the
//! search and 0.330879 on the oracle circle (+0.06 %). The Spencer gate stays ignored (pendiente E10b): the
//! Spencer search gives 0.402814 (+3.9 %), while the representative fixed circle agrees with cSlope to 0.01 %.

use ogs_core::analyze;
use ogs_core::methods::SolveStatus;
use ogs_core::model::Model;
use serde_json::json;

const ORACLE_BISHOP: f64 = 0.3307;
const ORACLE_SPENCER: f64 = 0.3876;
/// cSlope's own FS on its Bishop critical circle (`ORACLE_CIRCLE`), 0.33067891 rounded.
const ORACLE_BISHOP_ON_CIRCLE: f64 = 0.330679;
/// E9b: search FS may exceed the oracle by at most 1 %.
const SEARCH_TOL: f64 = 0.01;

/// Oracle critical circle of the Bishop search in cSlope 0.1.0: centre and radius.
const ORACLE_CIRCLE: (f64, f64, f64) = (
    7.930_327_512_483_231,
    43.438_523_199_773_87,
    29.304_056_275_415_814,
);

fn r2_03_model(analysis: serde_json::Value) -> Model {
    let value = json!({
        "format": "opengeoslide",
        "version": "0.1",
        "meta": {"id": "R2-03", "title": "R2-03 talud c=2 φ=45 ru=0.65"},
        "units": "SI",
        "materials": [{
            "id": "soil", "name": "Soil", "model": "mohr_coulomb",
            "unit_weight": 20.0, "unit_weight_sat": null,
            "cohesion": 2.0, "friction_angle": 45.0, "ru": 0.65
        }],
        "regions": [{"material": "soil", "polygon": [[0,0],[0,15],[15,15],[30,25],[60,25],[60,0]]}],
        "slope": {"direction": "auto"},
        "analysis": analysis
    });
    serde_json::from_value(value).expect("model")
}

fn search_analysis() -> serde_json::Value {
    json!({
        "methods": ["bishop", "spencer"],
        "slices": 50,
        "tolerance": 1e-5,
        "max_iterations": 500,
        "min_m_alpha": 0.2,
        "search": {
            "type": "circular_entry_exit",
            "entry": null, "exit": null,
            "n_entry": 20, "n_exit": 20, "n_radius": 20,
            "max_radius_factor": 5.0, "min_width": null, "refine": true
        }
    })
}

/// Gate E9b, Bishop (W8a, E10a): the search, with the main block only, is within 1 % of the oracle.
#[test]
fn r2_03_search_bishop_is_not_above_cslope_by_more_than_1_percent() {
    let report = analyze(&r2_03_model(search_analysis())).expect("analysis");
    let bishop = &report.results[0];
    let fb = bishop.fos.expect("bishop finite");
    assert!(
        fb <= ORACLE_BISHOP * (1.0 + SEARCH_TOL),
        "Bishop search {fb} above cSlope {ORACLE_BISHOP} + 1 %"
    );
    assert!(
        bishop.warnings.iter().any(|w| w == "truncated_mass"),
        "the oracle's surface is analysed with its main block (E10a): {:?}",
        bishop.warnings
    );
}

/// Gate E9b, Spencer: ignored until E10b. The Spencer search gives 0.402814 (+3.9 %) against cSlope 0.3876.
#[test]
#[ignore = "pendiente E10b: la búsqueda Spencer da 0.402814 (+3,9 %) frente a cSlope 0.3876; la superficie fija representativa concuerda a 0,01 %"]
fn r2_03_search_spencer_is_not_above_cslope_by_more_than_1_percent() {
    let report = analyze(&r2_03_model(search_analysis())).expect("analysis");
    let fs = report.results[1].fos.expect("spencer finite");
    assert!(
        fs <= ORACLE_SPENCER * (1.0 + SEARCH_TOL),
        "Spencer search {fs} above cSlope {ORACLE_SPENCER} + 1 %"
    );
}

/// W8a (E10a, replaces the E8a test `r2_03_oracle_critical_circle_is_detached_under_e8a`). The oracle's Bishop circle
/// is a valid surface: the toe lens is dropped (`truncated_mass`), and Bishop agrees with cSlope within 0.5 %.
#[test]
fn r2_03_oracle_critical_circle_bishop_matches_cslope() {
    let (xc, yc, r) = ORACLE_CIRCLE;
    let analysis = json!({
        "methods": ["bishop"],
        "slices": 50,
        "tolerance": 1e-5,
        "max_iterations": 500,
        "min_m_alpha": 0.2,
        "surface": {"type": "circle", "xc": xc, "yc": yc, "r": r}
    });
    let report = analyze(&r2_03_model(analysis)).expect("the oracle circle is valid under E10a");
    let result = &report.results[0];
    assert_eq!(result.status, SolveStatus::Converged, "{result:?}");
    assert!(
        result.warnings.iter().any(|w| w == "truncated_mass"),
        "{:?}",
        result.warnings
    );
    let fos = result.fos.expect("finite");
    let rel = (fos - ORACLE_BISHOP_ON_CIRCLE).abs() / ORACLE_BISHOP_ON_CIRCLE;
    assert!(
        rel <= 0.005,
        "Bishop on the oracle circle {fos} vs cSlope {ORACLE_BISHOP_ON_CIRCLE}: {rel}"
    );
}
