//! F3a integration (I-M): regression tests for the checks of `verification/pending/F3` that the engine did not
//! reproduce, each one written RED before its fix. Every model here is inline (no file under `verification/`), so
//! the tests keep working after the cases are promoted.

mod f3_common;

use f3_common::*;
use serde_json::{Value, json};

/// V068 (Low 1989, example 2, fig. 11): the published circle has its centre at the crest level, `yc = 16`, so its
/// lower arc ends on the vertical tangent (x = xc + r = 33.557) exactly on the flat crest `y = 16`.
fn v068(yc: f64) -> Value {
    json!({
        "format": "opengeoslide", "version": "0.3",
        "meta": {"id": "V068", "title": "Low (1989), stiff crust over soft clays, published circle"},
        "units": "SI",
        "materials": [
            {"id": "upper", "name": "Upper", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 95.0, "friction_angle": 15.0},
            {"id": "middle", "name": "Middle", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 15.0, "friction_angle": 0.0},
            {"id": "lower", "name": "Lower", "model": "undrained", "unit_weight": 20.0,
             "undrained_strength": 15.0, "strength_datum": 4.0, "strength_gradient": 3.75}
        ],
        "regions": [
            {"material": "lower", "polygon": [[0.0, 0.0], [0.0, 4.0], [40.0, 4.0], [40.0, 0.0]]},
            {"material": "middle", "polygon": [[0.0, 4.0], [0.0, 8.0], [10.0, 8.0], [40.0, 8.0], [40.0, 4.0]]},
            {"material": "upper", "polygon": [[10.0, 8.0], [26.0, 16.0], [40.0, 16.0], [40.0, 8.0]]}
        ],
        "slope": {"direction": "right_to_left"},
        "analysis": {
            "methods": ["bishop"], "slices": 50, "tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2,
            "surface": {"type": "circle", "xc": 18.001, "yc": yc, "r": 15.556}
        }
    })
}

#[test]
fn a_circle_whose_arc_ends_on_the_ground_at_its_vertical_tangent_is_analysed() {
    // Published 1.14, tolerance 2.44 % (V068); cSlope gives 1.1429 on this circle.
    let f = fos(&v068(16.0), 0);
    assert!((f - 1.14).abs() / 1.14 <= 0.0244, "Bishop {f} against 1.14 (tolerance 2.44 %)");
}

#[test]
fn the_same_circle_a_hair_above_the_crest_level_within_tolerance_agrees_with_the_tangent_one() {
    // yc = 16 + 1e-9, inside the geometric tolerance (1e-9 · scale): the same touch, so the same result.
    let (a, b) = (fos(&v068(16.0), 0), fos(&v068(16.000000001), 0));
    assert!((a - b).abs() / a < 1e-6, "tangent {a} against 1e-9 above {b}");
}
