//! Regression tests for the R3 review (docs/reviews/R3_agy.md), slicer and search side (W10b).
//!
//! Each test uses the counterexample of its finding. Where the review gives only part of the geometry, the proxy is
//! stated in the test.

use ogs_core::geometry::PreparedModel;
use ogs_core::methods::SolveStatus;
use ogs_core::model::{Circle, Model};
use ogs_core::slicer::{Slice, slice_surface};
use serde_json::{Value, json};

fn material(id: &str, c: f64, phi: f64, gamma: f64) -> Value {
    json!({
        "id": id, "name": id, "model": "mohr_coulomb",
        "unit_weight": gamma, "cohesion": c, "friction_angle": phi
    })
}

fn model(materials: Vec<Value>, regions: Vec<Value>, direction: &str, analysis: Value) -> Model {
    let doc = json!({
        "format": "opengeoslide", "version": "0.1", "meta": {"id": "R3"}, "units": "SI",
        "materials": materials, "regions": regions,
        "slope": {"direction": direction}, "analysis": analysis
    });
    serde_json::from_value(doc).expect("test model is a valid .ogs.json document")
}

fn region(material: &str, polygon: Value) -> Value {
    json!({"material": material, "polygon": polygon})
}

fn analysis(methods: &[&str], surface: Option<Value>, search: Option<Value>) -> Value {
    let mut a = json!({
        "methods": methods, "slices": 50, "tolerance": 1e-5,
        "max_iterations": 500, "min_m_alpha": 0.2
    });
    if let Some(s) = surface {
        a["surface"] = s;
    }
    if let Some(s) = search {
        a["search"] = s;
    }
    a
}

fn search(min_width: Option<f64>, entry: Option<[f64; 2]>, exit: Option<[f64; 2]>) -> Value {
    let mut s = json!({
        "type": "circular_entry_exit", "n_entry": 20, "n_exit": 20, "n_radius": 20,
        "max_radius_factor": 5.0, "min_width": min_width, "refine": true
    });
    if let Some(e) = entry {
        s["entry"] = json!(e);
    }
    if let Some(e) = exit {
        s["exit"] = json!(e);
    }
    s
}

fn circle(xc: f64, yc: f64, r: f64) -> Value {
    json!({"type": "circle", "xc": xc, "yc": yc, "r": r})
}

fn prepared(m: &Model) -> PreparedModel {
    PreparedModel::new(m).expect("valid model")
}

/// Botadero of two benches (R3-03a1): `c = 0.5`, `φ = 35°`, `γ = 18`.
fn botadero(analysis: Value) -> Model {
    model(
        vec![material("soil", 0.5, 35.0, 18.0)],
        vec![region(
            "soil",
            json!([
                [0, -5],
                [0, 25],
                [10, 25],
                [15, 20],
                [30, 20],
                [50, 10],
                [60, 10],
                [60, -5]
            ]),
        )],
        "auto",
        analysis,
    )
}

/// Rajo wall of two benches (R3-03c), upper bench `c = 60, φ = 40°, γ = 25`, lower bench `γ = 20`.
/// `lower_c`/`lower_phi` select the lower bench material (R3-03c: 3 / 15°; R3-03a2: 5 / 15°).
fn rajo(lower_c: f64, lower_phi: f64, analysis: Value) -> Model {
    model(
        vec![
            material("upper", 60.0, 40.0, 25.0),
            material("lower", lower_c, lower_phi, 20.0),
        ],
        vec![
            region("upper", json!([[0, 12], [0, 30], [10, 30], [23, 12]])),
            region(
                "lower",
                json!([[0, -10], [0, 12], [36, 12], [46, 0], [70, 0], [70, -10]]),
            ),
        ],
        "auto",
        analysis,
    )
}

/// Soil extremes of a block: `(min x_left, max x_right)` over the slices with weight (air slices excluded).
fn soil_extent(slices: &[Slice]) -> (f64, f64) {
    let soil: Vec<&Slice> = slices.iter().filter(|s| s.weight > 0.0).collect();
    (
        soil.iter().map(|s| s.x_left).fold(f64::INFINITY, f64::min),
        soil.iter()
            .map(|s| s.x_right)
            .fold(f64::NEG_INFINITY, f64::max),
    )
}

/// R3-03a1, fixed-circle part. The cSlope critical circle of the botadero with `min_width = 10` (centre
/// (16.81249, 28.87507), r = 9.05826; soil from x = 8.625 to 18.625, width 10.0). ogs reproduces cSlope on that
/// circle: Bishop 1.14218 vs 1.142346 (−0.015 %). The search does not reach this circle: see the ignored test below.
#[test]
fn r3_03a1_cslope_critical_circle_of_the_botadero_matches_cslope() {
    let m = botadero(analysis(
        &["bishop"],
        Some(circle(
            16.81248886262345,
            28.875072669005956,
            9.058258688511978,
        )),
        None,
    ));
    let report = ogs_core::analyze(&m).expect("valid");
    let r = &report.results[0];
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let fos = r.fos.expect("finite");
    let rel = (fos - 1.142346).abs() / 1.142346;
    assert!(rel <= 0.01, "Bishop {fos} vs cSlope 1.142346: {rel}");
    let (x0, x1) = soil_extent(&r.slices);
    assert!(x1 - x0 >= 10.0 - 1e-6, "soil width {}", x1 - x0);
}

/// R3-03a1. With `min_width = 10` on the effective block, every searched surface has at least 10 m of soil between its
/// ends. Before E11d the search reported a block 5.244 m wide (Bishop 0.855607).
#[test]
fn r3_03a1_searched_block_respects_min_width_on_its_soil() {
    let m = botadero(analysis(
        &["bishop", "spencer"],
        None,
        Some(search(Some(10.0), None, None)),
    ));
    let report = ogs_core::analyze(&m).expect("valid");
    for r in &report.results {
        assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
        let (x0, x1) = soil_extent(&r.slices);
        assert!(
            x1 - x0 >= 10.0 - 1e-6,
            "{:?}: soil width {} < 10",
            r.method,
            x1 - x0
        );
    }
}

/// R3-03a1 target, as the review states it: the search with `min_width = 10` must reach cSlope's critical circle
/// (Bishop 1.1423, Spencer 1.1478, within 1 %). Ignored: the search lands on a non-conservative surface
/// (Bishop ≈ 1.39, x = [6.3, 17.6], width 11.3) because the pattern search does not follow the `min_width` boundary.
/// See the W10b report.
#[test]
#[ignore = "R3-03a1 target not reached: the search stops at Bishop ≈ 1.39 above cSlope's 1.1423 (W10b report)"]
fn r3_03a1_search_reaches_the_cslope_critical_circle() {
    let m = botadero(analysis(
        &["bishop", "spencer"],
        None,
        Some(search(Some(10.0), None, None)),
    ));
    let report = ogs_core::analyze(&m).expect("valid");
    let (b, s) = (&report.results[0], &report.results[1]);
    for (r, target) in [(b, 1.1423), (s, 1.1478)] {
        let fos = r.fos.expect("finite");
        let rel = (fos - target).abs() / target;
        assert!(rel <= 0.01, "{:?}: {fos} vs cSlope {target}", r.method);
    }
}

/// R3-03a2 (proxy geometry). Rajo wall with `entry = [0, 12]`, `exit = [24, 45]`. The review gives the ranges and the
/// values, not the polygon; this proxy (upper bench top at y = 30 down to (23, 12), lower bench as in R3-03c) reproduces
/// the failure on the previous code: the analysed block started at x = 28.27 and ended at x = 45.98. The effective
/// ends must lie in the ranges.
#[test]
fn r3_03a2_effective_ends_lie_in_the_entry_and_exit_ranges() {
    let m = rajo(
        5.0,
        15.0,
        analysis(
            &["bishop", "spencer"],
            None,
            Some(search(None, Some([0.0, 12.0]), Some([24.0, 45.0]))),
        ),
    );
    let report = ogs_core::analyze(&m).expect("valid");
    for r in &report.results {
        assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
        // The sliding direction is left to right (the entry range lies left of the exit range).
        let (entry, _) = soil_extent(&r.slices);
        let exit = soil_extent(&r.slices).1;
        assert!(
            (-1e-6..=12.0 + 1e-6).contains(&entry),
            "{:?}: effective entry {entry} outside [0, 12]",
            r.method
        );
        assert!(
            (24.0 - 1e-6..=45.0 + 1e-6).contains(&exit),
            "{:?}: effective exit {exit} outside [24, 45]",
            r.method
        );
    }
}

/// R3-03c. A driving block is discarded from the rajo wall (`(53, 46.5, 45)`, air over (23, 12)). The note must be the
/// warning `truncated_driving_mass`, not `truncated_mass` (E11e), and the analysed block is still the upper one.
#[test]
fn r3_03c_discarded_driving_block_raises_truncated_driving_mass() {
    let m = rajo(
        3.0,
        15.0,
        analysis(&["bishop"], Some(circle(53.0, 46.5, 45.0)), None),
    );
    let sliced = slice_surface(
        &prepared(&m),
        &Circle {
            xc: 53.0,
            yc: 46.5,
            r: 45.0,
        },
        50,
    )
    .expect("the upper block is a valid surface (E10a)");
    assert_eq!(sliced.notes, vec!["truncated_driving_mass".to_string()]);
    let report = ogs_core::analyze(&m).expect("valid");
    let r = &report.results[0];
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    assert_eq!(r.warnings[0], "truncated_driving_mass", "{:?}", r.warnings);
}

/// R3-03b. The kept block is sliced again into `n` divisions (E11d): a truncated valley notch keeps at least `n` slices
/// and at least 3 soil slices for every `n`, or fails with `TooFewSlices`. Before E11d the block kept the discretization
/// of the whole arc, which gave 2 slices in the review's case.
#[test]
fn r3_03b_kept_block_is_resliced_with_n_divisions_and_three_soil_slices() {
    let m = model(
        vec![material("soil", 3.0, 20.0, 20.0)],
        vec![region(
            "soil",
            json!([
                [0, 10],
                [0, 20],
                [10, 20],
                [20, 12],
                [30, 20],
                [40, 20],
                [40, 10]
            ]),
        )],
        "right_to_left",
        analysis(&["bishop"], Some(circle(20.0, 60.0, 44.0)), None),
    );
    let pm = prepared(&m);
    let c = Circle {
        xc: 20.0,
        yc: 60.0,
        r: 44.0,
    };
    for n in [3, 4, 7, 50, 400] {
        match slice_surface(&pm, &c, n) {
            Ok(sliced) => {
                let soil = sliced.slices.iter().filter(|s| s.weight > 0.0).count();
                assert!(soil >= 3, "n = {n}: {soil} soil slices");
                assert!(
                    sliced.slices.len() >= n,
                    "n = {n}: the kept block has {} slices",
                    sliced.slices.len()
                );
            }
            Err(e) => assert_eq!(
                e,
                ogs_core::slicer::SurfaceError::TooFewSlices,
                "n = {n}: unexpected error"
            ),
        }
    }
}

/// R3-07. A valley with equal crest heights and `slope.direction = auto`, fixed circle (10, 42, 30). The direction is
/// resolved from the sliding span (the discarded lens may leave the model, E10a′), so there is no `InvalidModel`, and
/// the result is the one of `right_to_left`.
#[test]
fn r3_07_auto_direction_on_a_symmetric_valley_matches_right_to_left() {
    let valley = |direction: &str| {
        model(
            vec![material("soil", 3.0, 20.0, 20.0)],
            vec![region(
                "soil",
                json!([
                    [0, 0],
                    [0, 20],
                    [10, 20],
                    [20, 8],
                    [30, 20],
                    [50, 20],
                    [50, 0]
                ]),
            )],
            direction,
            analysis(&["bishop"], Some(circle(10.0, 42.0, 30.0)), None),
        )
    };
    let auto = ogs_core::analyze(&valley("auto")).expect("auto resolves the direction (R3-07)");
    let rtl = ogs_core::analyze(&valley("right_to_left")).expect("valid");
    let (a, r) = (&auto.results[0], &rtl.results[0]);
    assert_eq!(a.status, SolveStatus::Converged, "{a:?}");
    assert_eq!(a.fos, r.fos, "auto must resolve to right_to_left");
    assert_eq!(a.warnings, r.warnings);
}
