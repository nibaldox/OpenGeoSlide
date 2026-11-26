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

/// V077 (Prandtl bearing capacity on level ground): a strip load of 102.83 kPa over 10 m on a soil of Su = 20 whose
/// unit weight `gamma` is (nearly) zero, with the fixed polyline of the mechanism. Published 0.94 (tolerance 1.53 %),
/// cSlope 0.9428.
fn v077(gamma: f64) -> Value {
    json!({
        "format": "opengeoslide", "version": "0.3",
        "meta": {"id": "V077", "title": "Prandtl bearing capacity on level ground"},
        "units": "SI",
        "materials": [{"id": "soil", "name": "soil", "model": "undrained", "unit_weight": gamma, "undrained_strength": 20.0}],
        "regions": [{"material": "soil", "polygon": [[-20.0, 0.0], [-20.0, 10.0], [20.0, 10.0], [20.0, 0.0]]}],
        "loads": [{"type": "udl", "id": "u1", "x1": -5.0, "x2": 5.0, "q": 102.83}],
        "slope": {"direction": "left_to_right"},
        "analysis": {
            "methods": ["spencer"], "slices": 60, "tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2,
            "surface": {"type": "polyline", "points": [
                [-5.05, 10.05], [0.0, 5.0], [0.33772, 4.68369], [0.69541, 4.39014], [1.07153, 4.12062],
                [1.46447, 3.87628], [1.87255, 3.65815], [2.29402, 3.46719], [2.72708, 3.30419], [3.16987, 3.16987],
                [3.6205, 3.0648], [4.07704, 2.98943], [4.53753, 2.94407], [5.0, 2.92893], [5.46247, 2.94407],
                [5.92296, 2.98943], [6.3795, 3.0648], [6.83013, 3.16987], [7.27292, 3.30419], [7.70598, 3.46719],
                [8.12745, 3.65815], [8.53553, 3.87628], [8.92847, 4.12062], [9.30459, 4.39014], [9.66228, 4.68369],
                [10.0, 5.0], [15.05, 10.05]]}
        }
    })
}

#[test]
fn a_weightless_soil_under_a_strip_load_converges_when_the_weight_is_not_negligible() {
    // Control: with gamma = 1e-4 the soil weight is still a usable scale and Spencer closes (0.9428, as cSlope).
    let f = fos(&v077(1e-4), 0);
    assert!((f - 0.94).abs() / 0.94 <= 0.0153, "Spencer {f} against 0.94 (tolerance 1.53 %)");
}

#[test]
#[ignore = "I-M: pendiente de la decisión del coordinador sobre la escala de los residuos (docs/fase3/im/escala_fuerzas.patch)"]
fn a_weightless_soil_under_a_strip_load_converges_with_gamma_1e_minus_6() {
    // gamma = 1e-6 (the published input): ΣW ≈ 1e-4 against loads of 1e3, so `|E_n| ≤ 1e-6·ΣW` asks for 1e-13 relative
    // and closure fails with `no_lambda_root`. With the scale `ΣW*` (W + loads) it converges to 0.9428.
    let f = fos(&v077(1e-6), 0);
    assert!((f - 0.94).abs() / 0.94 <= 0.0153, "Spencer {f} against 0.94 (tolerance 1.53 %)");
}
