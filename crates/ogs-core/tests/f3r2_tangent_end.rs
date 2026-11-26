//! F3R-R2 (I1): V065 with Spencer was «sin dato» because the engine rejected its published circle with
//! `NoValidSurface: el círculo no corta el terreno`, for every method and with no reinforcement involved.
//!
//! The circle of V065 has its centre at the crest level (`yc = 15 = y(crest)`), so its lower arc ends on the vertical
//! tangent, at `x = xc + r`, exactly on the crest. `4.658 + 10.934` rounds to `15.591999999999999`, so
//! `(xc + r) − xc` is `r − 1.8e-15` and `sqrt(r² − t²)` is `2.1e-7`, not 0: the clearance at the end of the arc was
//! `−2.1e-7`, over the geometric tolerance (`1e-9 · scale`), and the arc was taken as under the ground at its own end
//! (a loss of precision of the square root, not a geometric fact). The end of the circle is at `y = yc` by
//! construction. Written RED before the fix in `slicer::check_block_ends_circle`.

mod f3_common;

use f3_common::*;
use serde_json::{Value, json};

fn slope(xc: f64, yc: f64, r: f64) -> Value {
    json!({
        "format": "opengeoslide", "version": "0.3",
        "meta": {"id": "tangent-end", "title": "circle with its centre at the crest level"},
        "units": "SI",
        "materials": [{"id": "s", "name": "s", "model": "mohr_coulomb", "unit_weight": 18.0, "cohesion": 5.0, "friction_angle": 25.0}],
        "regions": [{"material": "s", "polygon": [[-6.0, 0.0], [-6.0, 6.0], [6.0, 6.0], [8.7, 15.0], [24.0, 15.0], [24.0, 0.0]]}],
        "slope": {"direction": "right_to_left"},
        "analysis": {
            "methods": ["bishop", "spencer"], "slices": 50, "tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2,
            "surface": {"type": "circle", "xc": xc, "yc": yc, "r": r}
        }
    })
}

#[test]
fn the_circle_of_v065_with_its_centre_at_the_crest_level_is_analysed() {
    let doc = slope(4.658, 15.0, 10.934);
    for i in 0..2 {
        let f = fos(&doc, i);
        assert!(f.is_finite() && f > 0.0, "method {i}: FS {f}");
    }
}

#[test]
fn the_mirrored_model_puts_the_tangent_end_on_the_left_and_gives_the_same_fs() {
    // x → −x moves the tangent end from `xc + r` to `xc − r`: both ends must be admitted, with the same result.
    let doc = slope(4.658, 15.0, 10.934);
    for i in 0..2 {
        let (a, b) = (fos(&doc, i), fos(&mirror(&doc), i));
        assert!((a - b).abs() / a < 1e-6, "method {i}: {a} against mirrored {b}");
    }
}

#[test]
fn every_centre_at_the_crest_level_with_a_rounded_end_is_analysed() {
    // The rounding of `xc + r` is arbitrary: try many decimal pairs, left and right ends alike.
    let mut n = 0;
    for i in 0..40 {
        let xc = 3.0 + 0.137 * f64::from(i);
        let r = 10.0 + 0.0293 * f64::from(i);
        let doc = slope(xc, 15.0, r);
        let rep = run(&doc);
        assert!(
            rep.results[0].fos.is_some_and(f64::is_finite),
            "xc {xc} r {r}: {:?}",
            rep.results[0].status
        );
        n += 1;
    }
    assert_eq!(n, 40);
}
