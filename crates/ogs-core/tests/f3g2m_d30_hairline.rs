//! M-D30 (wave G2): a circle that passes a hair above a ground vertex does not split the mass (E2, E10a, E10a″).
//!
//! D30 is a 12 m vertical cut at `x = 30` on a bench at `y = 0`. cSlope's critical circle runs through the toe vertex:
//! at `x = 30` its arc is 3.6e-7 m above `(30, 0)`, so over the 1.6e-6 m between the arc's crossing of the bench and
//! the vertex the arc is *above* the ground (an air slice 5·tol high). Before the fix that one air slice separated
//! the mass into the entry block (x ≥ 30) and the 0.32 m lens under the bench (24.15 ≤ x ≤ 30), `main_block_range`
//! kept only the entry block, and the 117.9 kN/m of cohesion of the lens was gone: FS 1.2807 against cSlope's 1.5143
//! (−15.4 %). Moving the arc 5e-7 down, under the vertex, gave 1.5163 (+0.13 %), so the answer jumped 18 % over a
//! displacement of the circle of 1e-6 m. An interior air run whose arc is at most 10 tol (`10 · 1e-9 · scale`, 7e-7 m
//! here) above the ground is a touch, not a gap: it does not split the mass. The nodes that the search puts around a
//! vertex (`1e-6 · width`) are far over that, so the search keeps its slicing. A gap above the hairline stays a gap: the lens is a separate block and is dropped, as before.

use ogs_core::analyze;
use ogs_core::model::Model;
use ogs_core::report::{AnalysisReport, MethodReport};
use serde_json::{Value, json};

const XC: f64 = 27.076448878025104;
const YC: f64 = 13.339637575128545;
const R: f64 = 13.656246640307726;

/// D30 (verification/differential/cases_f3g/D30.ogs.json) with the circle `(xc, yc, r)`, in one method. `mirror`
/// gives the same model reflected about `x = 35` (sliding toward +x).
fn doc(r: f64, method: &str, wet: bool, mirror: bool) -> Value {
    let poly: Vec<[f64; 2]> = vec![
        [0.0, -15.0],
        [0.0, 0.0],
        [30.0, 0.0],
        [30.0, 12.0],
        [70.0, 12.0],
        [70.0, -15.0],
    ];
    let (poly, xc, dir, piezo): (Vec<[f64; 2]>, f64, &str, Vec<[f64; 2]>) = if mirror {
        (
            poly.iter().rev().map(|p| [70.0 - p[0], p[1]]).collect(),
            70.0 - XC,
            "left_to_right",
            vec![[-30.0, 8.0], [70.0, 8.0]],
        )
    } else {
        (poly, XC, "right_to_left", vec![[0.0, 8.0], [100.0, 8.0]])
    };
    let mut d = json!({
        "format": "opengeoslide", "version": "0.1",
        "materials": [{"id": "soil", "name": "Suelo", "model": "mohr_coulomb",
                       "unit_weight": 19.0, "cohesion": 20.0, "friction_angle": 28.0}],
        "regions": [{"material": "soil", "polygon": poly}],
        "slope": {"direction": dir},
        "analysis": {"methods": [method], "slices": 50, "tolerance": 1e-5, "max_iterations": 500,
                     "min_m_alpha": 0.2,
                     "surface": {"type": "circle", "xc": xc, "yc": YC, "r": r}}
    });
    if wet {
        d["water"] = json!({"unit_weight": 9.807, "piezometric_line": piezo});
    }
    d
}

fn run(r: f64, method: &str, wet: bool, mirror: bool) -> MethodReport {
    let model: Model = serde_json::from_value(doc(r, method, wet, mirror)).expect("model parses");
    let report: AnalysisReport = analyze(&model).expect("the analysis runs");
    report.results.into_iter().next().expect("one method")
}

fn fos(r: f64, method: &str, wet: bool) -> f64 {
    run(r, method, wet, false).fos.expect("finite FS")
}

fn truncated(m: &MethodReport) -> bool {
    m.warnings
        .iter()
        .any(|w| w == "truncated_mass" || w == "truncated_driving_mass")
}

fn rel(a: f64, b: f64) -> f64 {
    (a / b - 1.0).abs()
}

/// The circle of cSlope, through the toe, keeps the lens under the bench: the whole mass, from x = 24.15.
#[test]
fn the_toe_circle_of_d30_keeps_the_lens_under_the_bench() {
    for wet in [true, false] {
        for method in ["bishop", "spencer"] {
            let m = run(R, method, wet, false);
            assert!(!truncated(&m), "{method} wet={wet}: {:?}", m.warnings);
            let x0 = m
                .slices
                .iter()
                .map(|s| s.x_left)
                .fold(f64::INFINITY, f64::min);
            assert!(x0 < 24.2, "{method} wet={wet}: the mass starts at x = {x0}");
        }
    }
}

/// The FS does not jump while the circle moves through the hair-thin band around the vertex: the circle of cSlope,
/// the same circle 5e-7 under the vertex, 3e-7 over it and 1e-5 (arc up to 1e-5 above the toe).
#[test]
fn the_fs_is_continuous_across_the_hairline_band() {
    for wet in [true, false] {
        for method in ["bishop", "spencer"] {
            let under = fos(R + 1e-3, method, wet); // arc 1e-3 under the vertex: the whole mass, no doubt
            for d in [-3e-7, -1e-7, 0.0, 3e-7, 5e-7, 1e-6, 1e-5] {
                let f = fos(R + d, method, wet);
                assert!(
                    rel(f, under) < 5e-3,
                    "{method} wet={wet} dr={d:e}: {f} against {under} under the vertex"
                );
            }
        }
    }
}

/// A gap over the band is a gap: the circle 1e-3 above the vertex (and 1e-4) still drops the lens, as before.
#[test]
fn a_real_gap_still_separates_the_lens() {
    for wet in [true, false] {
        for d in [-1e-5, -1e-4, -1e-3, -1e-2] {
            let m = run(R + d, "bishop", wet, false);
            assert!(truncated(&m), "wet={wet} dr={d:e}: {:?}", m.warnings);
            let x0 = m
                .slices
                .iter()
                .map(|s| s.x_left)
                .fold(f64::INFINITY, f64::min);
            assert!(
                x0 > 29.99,
                "wet={wet} dr={d:e}: the mass starts at x = {x0}"
            );
        }
    }
}

/// Mirror symmetry (sliding toward +x) at the band, in Bishop and Spencer.
#[test]
fn the_band_is_mirror_symmetric() {
    for wet in [true, false] {
        for method in ["bishop", "spencer"] {
            for d in [-3e-7, 0.0, 1e-6] {
                let a = fos(R + d, method, wet);
                let b = run(R + d, method, wet, true).fos.expect("finite FS");
                assert!(
                    rel(a, b) < 1e-9,
                    "{method} wet={wet} dr={d:e}: {a} against {b}"
                );
            }
        }
    }
}
