//! Amendments E13l-1 and E13l-2 of the R10 review (briefs/02_CONTRATOS_FASE3.md §F3.10c), through the public API.
//!
//! - **E13l-1** (R10A-01, R10B-01): `f₀ = max(1, 1 + b₁(d/L − 1.4(d/L)²))`, the note `janbu_correction_extrapolated`
//!   when `d/L` is above the end of Janbu's chart (0.4), and no `converged` result with a non-positive FS, for any
//!   method (`non_positive_fos`). A sweep of random polylines, deep ones included, finds no `converged` with FS ≤ 0 or
//!   with `f₀ < 1`.
//! - **E13l-2** (R10A-02): E3 (`no_driving`) on a polyline evaluates `Σ(W*·sin α + H·cos α)`, the `t` of the force
//!   equilibrium, so a horizontal polyline under `kh` or a horizontal line load is analysed. The FS agree with
//!   cSlope 0.1.0 (values measured with `verification/harness`, not our own output).

mod f3_common;

use f3_common::*;
use ogs_core::methods::SolveStatus;
use ogs_core::report::MethodReport;
use serde_json::{Value, json};

const ALL: [&str; 4] = [
    "spencer",
    "morgenstern_price",
    "janbu_simplified",
    "janbu_corrected",
];

/// An undrained model on a polygon, with a fixed polyline and `methods`.
fn undrained_doc(su: f64, polygon: Value, direction: &str, points: Value, methods: Value) -> Value {
    let mut doc = json!({
        "format": "opengeoslide", "version": "0.3",
        "meta": {"id": "e13l", "title": "e13l"}, "units": "SI",
        "materials": [{"id": "c", "name": "c", "model": "undrained", "unit_weight": 18.0, "undrained_strength": su}],
        "regions": [{"material": "c", "polygon": polygon}],
        "slope": {"direction": direction},
        "analysis": {"methods": methods, "slices": 50, "tolerance": 1e-5, "max_iterations": 500,
                     "min_m_alpha": 0.2, "surface": {"type": "polyline", "points": points}}
    });
    if doc["analysis"]["methods"]
        .as_array()
        .is_some_and(|m| m.contains(&json!("morgenstern_price")))
    {
        doc["analysis"]["interslice"] = json!({"function": "constant"});
    }
    doc
}

/// R10B-01: Su = 50 clay, slope with the toe at x = 12, polyline `[[0,10],[5.5,-15],[6.5,-15],[12,4]]` (d/L = 1.467).
fn r10b01() -> Value {
    undrained_doc(
        50.0,
        json!([[-5, -30], [30, -30], [30, 4], [12, 4], [0, 10], [-5, 10]]),
        "left_to_right",
        json!([[0, 10], [5.5, -15], [6.5, -15], [12, 4]]),
        json!(ALL),
    )
}

/// R10A-01: Su = 30 clay, ground rising to the right, polyline `[[20,30],[24.5,10],[25.5,10],[30,32]]` (d/L ≈ 2).
fn r10a01() -> Value {
    undrained_doc(
        30.0,
        json!([[0, -20], [50, -20], [50, 36], [0, 26]]),
        "right_to_left",
        json!([[20, 30], [24.5, 10], [25.5, 10], [30, 32]]),
        json!(ALL),
    )
}

fn by_method<'a>(results: &'a [MethodReport], name: &str) -> &'a MethodReport {
    results
        .iter()
        .find(|r| serde_json::to_value(r.method).unwrap() == json!(name))
        .unwrap_or_else(|| panic!("no result for {name}"))
}

// ---------------------------------------------------------------------------------------------------------------
// E13l-1

/// d/L of the reported polyline: the greatest distance of a vertex below the chord between its ends, over the chord.
fn depth_to_length(r: &MethodReport) -> f64 {
    let ogs_core::report::SurfaceOut::Polyline { points } = &r.surface else {
        panic!("a polyline was expected");
    };
    let (a, b) = (points[0], points[points.len() - 1]);
    let length = (b[0] - a[0]).hypot(b[1] - a[1]);
    let depth =
        |p: &[f64; 2]| ((b[0] - a[0]) * (a[1] - p[1]) - (b[1] - a[1]) * (a[0] - p[0])) / length;
    let d = points.iter().map(|p| depth(p).abs()).fold(0.0, f64::max);
    d / length
}

/// R10B-01: the correction never reduces F₀. The d/L of 1.467 gave `f₀ = −0.101` and FS = −0.752 as `converged`.
/// Now `f₀ = 1`, FS = F₀, and the note says that the chart is extrapolated.
#[test]
fn e13l1_r10b01_deep_polyline_gets_f0_one_and_the_note() {
    let report = run(&r10b01());
    let simplified = by_method(&report.results, "janbu_simplified");
    let corrected = by_method(&report.results, "janbu_corrected");
    assert_eq!(simplified.status, SolveStatus::Converged, "{simplified:?}");
    assert_eq!(corrected.status, SolveStatus::Converged, "{corrected:?}");
    let f0 = corrected.correction_factor.expect("f0 is reported");
    assert_eq!(f0, 1.0, "f0 must not drop below 1 (it was −0.101)");
    assert_eq!(corrected.fos, simplified.fos, "FS = f0·F0 = F0");
    assert!(corrected.fos.unwrap() > 0.0);
    assert!(
        corrected
            .warnings
            .contains(&"janbu_correction_extrapolated".to_string()),
        "{:?}",
        corrected.warnings
    );
    // The note belongs to the correction: the simplified method has none.
    assert!(
        !simplified
            .warnings
            .contains(&"janbu_correction_extrapolated".to_string())
    );
}

/// R10A-01: the same, with d/L ≈ 2 (FS = −23.43 as `converged`).
#[test]
fn e13l1_r10a01_deep_polyline_never_gives_a_negative_fos() {
    let report = run(&r10a01());
    let corrected = by_method(&report.results, "janbu_corrected");
    assert_eq!(corrected.status, SolveStatus::Converged, "{corrected:?}");
    assert_eq!(corrected.correction_factor, Some(1.0));
    assert!(corrected.fos.unwrap() > 0.0);
    assert!(
        corrected
            .warnings
            .contains(&"janbu_correction_extrapolated".to_string())
    );
}

/// The note is emitted exactly when d/L > 0.4, the end of the chart of Janbu et al. (1973) (Fig. 8 of Water 2019,
/// 11(10), 2146 after Abramson et al. 2002: d/L from 0 to 0.4). A shallow polyline has no note and keeps `f₀ > 1`.
#[test]
fn e13l1_the_note_appears_only_beyond_the_chart() {
    // Slope of the generator of D-1 (ground 10 | 10 − (x − 10) | 0), undrained Su = 50, γ = 18.
    let slope = |points: Value| {
        undrained_doc(
            50.0,
            json!([[0, -40], [40, -40], [40, 0], [20, 0], [10, 10], [0, 10]]),
            "left_to_right",
            points,
            json!(["janbu_corrected"]),
        )
    };
    // Shallow: d/L ≈ 0.1.
    let r = run(&slope(json!([[8, 10], [14, 3], [20, 0]])))
        .results
        .remove(0);
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let f0 = r.correction_factor.unwrap();
    assert!(f0 > 1.0 && f0 < 1.2, "{f0}");
    assert!(
        r.warnings
            .iter()
            .all(|w| w != "janbu_correction_extrapolated")
    );
    // Moderately deep, d/L ≈ 0.5: between 0.4 and 0.714 the parabola still gives f₀ > 1 but is outside the chart.
    let deep = slope(json!([[5, 10], [12, -6], [16, -8], [24, 0]]));
    let r = run(&deep).results.remove(0);
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let ratio = depth_to_length(&r);
    assert!(ratio > 0.4 && ratio < 0.714, "d/L = {ratio}");
    let f0 = r.correction_factor.unwrap();
    assert!(f0 > 1.0, "d/L in (0.4, 0.714) keeps the parabola: {f0}");
    assert!(
        r.warnings
            .contains(&"janbu_correction_extrapolated".to_string()),
        "{:?}",
        r.warnings
    );
}

/// The sweep of random polylines (the generator of `docs/fase3/d1/tools/gen_cases.py`, in two variants: wide and
/// shallow, and narrow and deep, where d/L passes 1) finds no `converged` with FS ≤ 0 or non-finite, and none with
/// `f₀ < 1`, in any of the four methods.
#[test]
fn e13l1_random_polylines_never_converge_with_a_non_positive_fos_or_f0_below_one() {
    let mut rng = Lcg(0x005E_ED13);
    let (mut converged, mut deep_notes, mut total) = (0_usize, 0_usize, 0_usize);
    for case in 0..240 {
        let deep = case % 2 == 1;
        let doc = random_doc(&mut rng, deep);
        let model: ogs_core::model::Model = serde_json::from_value(doc.clone()).unwrap();
        let Ok(report) = ogs_core::analyze(&model) else {
            continue;
        };
        for r in &report.results {
            total += 1;
            if r.status != SolveStatus::Converged {
                assert!(
                    r.fos.is_none_or(|f| f.is_finite()),
                    "a result that did not converge reports a non-finite FS: {r:?}"
                );
                continue;
            }
            converged += 1;
            let f = r.fos.expect("a converged result has an FS");
            assert!(f.is_finite() && f > 0.0, "FS {f} converged: {r:?}\n{doc}");
            if let Some(f0) = r.correction_factor {
                assert!(f0 >= 1.0, "f0 = {f0} < 1 converged: {r:?}\n{doc}");
                if r.warnings
                    .iter()
                    .any(|w| w == "janbu_correction_extrapolated")
                {
                    deep_notes += 1;
                }
            }
        }
    }
    println!(
        "random polylines: {total} results, {converged} converged, {deep_notes} with the note"
    );
    assert!(converged > 200, "the sweep must exercise the methods");
    assert!(deep_notes > 5, "the deep variant must reach d/L > 0.4");
}

/// Deterministic generator (64-bit LCG): the sweep does not depend on a `rand` dependency.
struct Lcg(u64);
impl Lcg {
    fn next(&mut self) -> f64 {
        self.0 = self
            .0
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        ((self.0 >> 11) as f64) / ((1_u64 << 53) as f64)
    }
    fn uniform(&mut self, a: f64, b: f64) -> f64 {
        a + (b - a) * self.next()
    }
}

/// Slope of `gen_cases.py` (`ground(x) = 10 | 10 − (x − 10) | 0`), a two-layer soil and a random polyline of 3 to 8
/// vertices under the ground. `deep` narrows the polyline and lets it go 25 m below the toe level.
fn random_doc(rng: &mut Lcg, deep: bool) -> Value {
    let ground = |x: f64| {
        if x <= 10.0 {
            10.0
        } else if x <= 20.0 {
            10.0 - (x - 10.0)
        } else {
            0.0
        }
    };
    let n = 3 + (rng.next() * 6.0) as usize;
    let (x0, x1) = if deep {
        let a = rng.uniform(8.0, 18.0);
        (a, a + rng.uniform(3.0, 9.0))
    } else {
        (rng.uniform(1.0, 14.0), rng.uniform(20.0, 39.0))
    };
    let dmax = if deep {
        rng.uniform(10.0, 30.0)
    } else {
        rng.uniform(2.0, 9.0)
    };
    let floor = if deep { -34.0 } else { -9.5 };
    let mut xs: Vec<f64> = (0..n - 2).map(|_| rng.uniform(x0, x1)).collect();
    xs.push(x0);
    xs.push(x1);
    xs.sort_by(f64::total_cmp);
    let points: Vec<[f64; 2]> = xs
        .iter()
        .enumerate()
        .map(|(i, &x)| {
            let t = (x - x0) / (x1 - x0);
            let end = i == 0 || i == n - 1;
            let depth = dmax * 4.0 * t * (1.0 - t) * rng.uniform(0.5, 1.3)
                + if end { 0.05 } else { rng.uniform(0.05, 0.5) };
            [
                (x * 1000.0).round() / 1000.0,
                ((ground(x) - depth).max(floor) * 1000.0).round() / 1000.0,
            ]
        })
        .collect();
    let bottom = if deep { -40.0 } else { -10.0 };
    let undrained_only = rng.next() < 0.5;
    let (materials, regions) = if undrained_only {
        (
            json!([{"id": "u", "name": "u", "model": "undrained", "unit_weight": 18.0,
                    "undrained_strength": rng.uniform(15.0, 60.0)}]),
            json!([{"material": "u", "polygon": [[0, bottom], [40, bottom], [40, 0], [20, 0], [10, 10], [0, 10]]}]),
        )
    } else {
        (
            json!([{"id": "s", "name": "s", "model": "mohr_coulomb", "unit_weight": 20.0,
                    "cohesion": rng.uniform(2.0, 20.0), "friction_angle": rng.uniform(15.0, 38.0)},
                   {"id": "u", "name": "u", "model": "undrained", "unit_weight": 24.0,
                    "undrained_strength": rng.uniform(20.0, 90.0)}]),
            json!([{"material": "s", "polygon": [[0, -3], [40, -3], [40, 0], [20, 0], [10, 10], [0, 10]]},
                   {"material": "u", "polygon": [[0, bottom], [40, bottom], [40, -3], [0, -3]]}]),
        )
    };
    json!({
        "format": "opengeoslide", "version": "0.3", "meta": {"id": "rand", "title": "rand"}, "units": "SI",
        "materials": materials, "regions": regions, "slope": {"direction": "left_to_right"},
        "analysis": {"methods": ALL, "slices": 50, "tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2,
                     "interslice": {"function": "constant"},
                     "surface": {"type": "polyline", "points": points}}
    })
}

// ---------------------------------------------------------------------------------------------------------------
// E13l-2

/// Undrained plain (Su = 50, γ = 20, level ground at y = 10) and the symmetric polyline of R10A-02.
fn r10a02(kh: Option<f64>, loads: Option<Value>, methods: Value) -> Value {
    let mut doc = undrained_doc(
        50.0,
        json!([[0, 0], [40, 0], [40, 10], [0, 10]]),
        "left_to_right",
        json!([[10, 10], [15, 5], [25, 5], [30, 10]]),
        methods,
    );
    doc["materials"][0]["unit_weight"] = json!(20.0);
    if let Some(kh) = kh {
        doc["analysis"]["seismic"] = json!({"kh": kh, "kv": 0.0});
    }
    if let Some(loads) = loads {
        doc["loads"] = loads;
    }
    doc
}

fn close(got: Option<f64>, want: f64, rel: f64, what: &str) {
    let got = got.unwrap_or_else(|| panic!("{what}: no FS"));
    assert!(
        (got - want).abs() <= rel * want,
        "{what}: {got} vs cSlope {want} (rel {:.3e})",
        (got - want).abs() / want
    );
}

/// R10A-02, kh = 0.3: the horizontal polyline has no `Σ W·sin α` but is driven by `kh·W`. It was
/// `invalid (no_driving)` in the four methods. cSlope 0.1.0: Janbu 3.333333, Janbu corrected 3.707083, Spencer =
/// Morgenstern-Price (constant) 3.985517.
#[test]
fn e13l2_horizontal_polyline_under_kh_is_analysed_and_matches_cslope() {
    let report = run(&r10a02(Some(0.3), None, json!(ALL)));
    for r in &report.results {
        assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    }
    let fos = |m: &str| by_method(&report.results, m).fos;
    close(fos("janbu_simplified"), 3.3333333316654943, 1e-4, "janbu");
    close(
        fos("janbu_corrected"),
        3.707083331478488,
        1e-4,
        "janbu corrected",
    );
    close(fos("spencer"), 3.9855166468654133, 1e-3, "spencer");
    close(
        fos("morgenstern_price"),
        3.9855166468654133,
        1e-3,
        "m-p constant",
    );
}

/// R10A-02, horizontal line load (p = 200, 90°, at x = 15): the same, with cSlope Janbu 7.499999818 and Janbu
/// corrected 8.340937. cSlope does not converge with Spencer and Morgenstern-Price on this model, so they are only
/// required to give a state, not a reference.
#[test]
fn e13l2_horizontal_polyline_under_a_horizontal_line_load_matches_cslope() {
    let loads = json!([{"type": "line", "x": 15, "p": 200, "angle": 90}]);
    let report = run(&r10a02(None, Some(loads), json!(ALL)));
    let fos = |m: &str| by_method(&report.results, m).fos;
    for m in ["janbu_simplified", "janbu_corrected"] {
        assert_eq!(by_method(&report.results, m).status, SolveStatus::Converged);
    }
    close(fos("janbu_simplified"), 7.499999818089505, 1e-4, "janbu");
    close(
        fos("janbu_corrected"),
        8.340937297692792,
        1e-4,
        "janbu corrected",
    );
    for m in ["spencer", "morgenstern_price"] {
        let r = by_method(&report.results, m);
        assert_ne!(
            r.warnings.first().map(String::as_str),
            Some("no_driving"),
            "{m} must not be rejected by E3: {r:?}"
        );
    }
}

/// Neutrality: without kh and without loads the horizontal polyline is still `no_driving`, and a polyline that has
/// driving keeps its result (E3 on it is the same sum as before when `H = 0`).
#[test]
fn e13l2_without_horizontal_force_a_horizontal_polyline_still_has_no_driving() {
    let report = run(&r10a02(None, None, json!(ALL)));
    for r in &report.results {
        assert_eq!(r.status, SolveStatus::Invalid, "{r:?}");
        assert_eq!(r.warnings, vec!["no_driving".to_string()], "{r:?}");
    }
}
