//! SHANSEP strength (F6.3, F6.9). B0 freezes the interface; the writer of B1 (M-SH) fills the physics.
//!
//! `Su = ratio·σ′v·OCR^exponent` at the midpoint of the base, with `φ = 0`; with `pop`, `OCR = (σ′v + pop)/σ′v`;
//! with `ocr_by_elevation`, OCR interpolated linearly at the base midpoint and constant outside the table (F6.9).
//! `σ′v = (W + Q + V)/b − u`, without the seismic term (E16o).

use crate::geometry::PreparedModel;
use crate::report::SliceStrength;
use crate::slicer::Slice;
use crate::strength::{OcrSource, ShansepParams, StrengthLaw};

/// Code of the informative note of F6.7: a `shansep` base slice with `σ′v ≤ 0` (Su = 0).
pub const SHANSEP_NONPOSITIVE_STRESS: &str = "shansep_nonpositive_stress";

/// What [`apply`] reports to `lib.rs` (E16r): the `shansep` entries of `MethodReport.strength` and whether some base
/// slice had `σ′v ≤ 0`. Empty without `shansep` slices (no allocation).
#[derive(Debug, Clone, Default, PartialEq)]
pub(crate) struct ShansepOutcome {
    pub(crate) slices: Vec<SliceStrength>,
    pub(crate) nonpositive_stress: bool,
}

/// Writes `cohesion = Su` and `tan_phi = 0` on the `shansep` base slices (F6.6 hook 1, F6.9).
///
/// Called right after `water::apply_ponded` and before the reinforcements (E16r), when `weight_extra` is exactly
/// `kv·W + Q + V`, so `Q + V = weight_extra − kv·weight` and `σ′v = (W + Q + V)/b − u`, without the seismic term
/// (E16o). `u` is the `pore_pressure` of the slice. `Su` is computed once per slice and does not depend on `F`.
/// A slice with `σ′v ≤ 0` gets `Su = 0` (the OCR is not evaluated, it is reported as 1) and raises
/// `nonpositive_stress`. Without a `shansep` slice it does nothing and returns the default outcome.
pub(crate) fn apply(pm: &PreparedModel, kv: f64, slices: &mut [Slice]) -> ShansepOutcome {
    let mut outcome = ShansepOutcome::default();
    for (index, slice) in slices.iter_mut().enumerate() {
        if crate::methods::is_inert(slice) {
            continue;
        }
        let StrengthLaw::Shansep(params) = &pm.materials[slice.material].law else {
            continue;
        };
        let load_and_water = slice.weight_extra - kv * slice.weight;
        let sigma_v = (slice.weight + load_and_water) / slice.width - slice.pore_pressure;
        let y = 0.5 * (slice.y_base_left + slice.y_base_right);
        let (su, ocr) = if sigma_v > 0.0 {
            let ocr = ocr_at(&params.ocr, sigma_v, y);
            (su_at(params, sigma_v, y), ocr)
        } else {
            outcome.nonpositive_stress = true;
            (0.0, 1.0)
        };
        slice.cohesion = su;
        slice.tan_phi = 0.0;
        outcome.slices.push(SliceStrength::Shansep {
            index,
            vertical_stress: sigma_v,
            ocr,
        });
    }
    outcome
}

/// Undrained strength `Su` of a SHANSEP material at the effective vertical stress `sigma_v` and the elevation `y`
/// (F6.6, F6.9): `ratio·σ′v·OCR^exponent`, or `0` when `σ′v ≤ 0` (the OCR is not evaluated). It is the same formula
/// as [`apply`], used by the interslice faces (F6.5).
pub(crate) fn su_at(params: &ShansepParams, sigma_v: f64, y: f64) -> f64 {
    if sigma_v > 0.0 {
        match &params.ocr {
            OcrSource::Pop(pop) => {
                params.ratio
                    * sigma_v.powf(1.0 - params.exponent)
                    * (sigma_v + pop).powf(params.exponent)
            }
            _ => strength_from(params, sigma_v, ocr_at(&params.ocr, sigma_v, y)),
        }
    } else {
        0.0
    }
}

/// `ratio·σ′v·OCR^exponent` for `σ′v > 0`.
fn strength_from(params: &ShansepParams, sigma_v: f64, ocr: f64) -> f64 {
    params.ratio * sigma_v * ocr.powf(params.exponent)
}

/// OCR at the effective vertical stress `sigma_v > 0` and the elevation `y` (F6.9).
fn ocr_at(source: &OcrSource, sigma_v: f64, y: f64) -> f64 {
    match source {
        OcrSource::Ocr(ocr) => *ocr,
        OcrSource::Pop(pop) => (sigma_v + pop) / sigma_v,
        OcrSource::ByElevation(table) => interpolate(table, y),
    }
}

/// Linear interpolation of the table `[[y, OCR], …]` (at least 2 rows, `y` increasing), constant outside it.
fn interpolate(table: &[[f64; 2]], y: f64) -> f64 {
    let (first, last) = match (table.first(), table.last()) {
        (Some(first), Some(last)) => (first, last),
        _ => return 1.0,
    };
    if y <= first[0] {
        return first[1];
    }
    if y >= last[0] {
        return last[1];
    }
    for pair in table.windows(2) {
        let (lo, hi) = (pair[0], pair[1]);
        if y <= hi[0] {
            return lo[1] + (hi[1] - lo[1]) * (y - lo[0]) / (hi[0] - lo[0]);
        }
    }
    last[1]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Model;
    use crate::slicer::{ZERO_SLICE, interslice_face_strength};
    use serde_json::{Value, json};

    fn params(ocr: OcrSource) -> ShansepParams {
        ShansepParams {
            ratio: 0.25,
            exponent: 0.8,
            ocr,
        }
    }

    /// Material 0 `mohr_coulomb`, material 1 `shansep` (`shansep` is its object), over two horizontal layers
    /// (`mc` from 0 to 4, `sh` from 4 to 10).
    fn model(shansep: Value, water: Value) -> PreparedModel {
        let mut doc = json!({
            "format": "opengeoslide", "version": "0.6",
            "materials": [
                {"id": "mc", "name": "MC", "model": "mohr_coulomb", "unit_weight": 19.0,
                 "cohesion": 7.0, "friction_angle": 25.0},
                {"id": "sh", "name": "SH", "model": "shansep", "unit_weight": 18.0, "shansep": shansep}
            ],
            "regions": [
                {"material": "mc", "polygon": [[0, 0], [0, 4], [10, 4], [10, 0]]},
                {"material": "sh", "polygon": [[0, 4], [0, 10], [10, 10], [10, 4]]}
            ],
            "slope": {"direction": "right_to_left"},
            "analysis": {}
        });
        if !water.is_null() {
            doc["water"] = water;
        }
        let model: Model = serde_json::from_value(doc).expect("test model");
        PreparedModel::new(&model).expect("valid model")
    }

    fn slice(material: usize, weight: f64, extra: f64, pore: f64) -> Slice {
        Slice {
            x_left: 0.0,
            x_right: 2.0,
            y_base_left: 5.0,
            y_base_right: 7.0,
            width: 2.0,
            base_length: 2.0,
            weight,
            weight_extra: extra,
            pore_pressure: pore,
            material,
            cohesion: 3.0,
            tan_phi: 0.4,
            ..ZERO_SLICE
        }
    }

    #[test]
    fn su_is_ratio_sigma_ocr_to_the_exponent() {
        let p = params(OcrSource::Ocr(1.5));
        assert!((su_at(&p, 80.0, 0.0) - 0.25 * 80.0 * 1.5_f64.powf(0.8)).abs() < 1e-12);
        let one = params(OcrSource::Ocr(1.0));
        assert_eq!(su_at(&one, 80.0, 0.0), 0.25 * 80.0);
        // m = 0: the OCR does not matter.
        let flat = ShansepParams {
            exponent: 0.0,
            ..params(OcrSource::Ocr(3.0))
        };
        assert_eq!(su_at(&flat, 80.0, 0.0), 0.25 * 80.0);
    }

    #[test]
    fn su_with_pop_uses_ocr_from_the_stress() {
        let p = params(OcrSource::Pop(30.0));
        let ocr: f64 = (50.0 + 30.0) / 50.0;
        assert!((su_at(&p, 50.0, 0.0) - 0.25 * 50.0 * ocr.powf(0.8)).abs() < 1e-12);
        // POP 0 is OCR 1.
        let zero = params(OcrSource::Pop(0.0));
        assert!((su_at(&zero, 50.0, 0.0) - 0.25 * 50.0).abs() < 1e-12);
    }

    #[test]
    fn pop_without_ocr_quotient_stays_finite_at_tiny_stress() {
        let p = params(OcrSource::Pop(1.0e100));
        let actual = su_at(&p, 1.0e-250, 0.0);
        let expected = 0.25 * (1.0e-250_f64).powf(0.2) * (1.0e100_f64).powf(0.8);
        assert!(actual.is_finite() && (actual / expected - 1.0).abs() < 1e-12);
    }

    #[test]
    fn su_by_elevation_interpolates_and_is_constant_outside() {
        let table = vec![[20.0, 1.0], [30.0, 2.0], [40.0, 2.0]];
        let p = params(OcrSource::ByElevation(table));
        let su = |y: f64, ocr: f64| 0.25 * 100.0 * ocr.powf(0.8) - su_at(&p, 100.0, y);
        assert!(su(10.0, 1.0).abs() < 1e-12, "below the table");
        assert!(su(20.0, 1.0).abs() < 1e-12);
        assert!(su(25.0, 1.5).abs() < 1e-12, "inside");
        assert!(su(30.0, 2.0).abs() < 1e-12);
        assert!(su(35.0, 2.0).abs() < 1e-12);
        assert!(su(90.0, 2.0).abs() < 1e-12, "above the table");
    }

    #[test]
    fn su_is_zero_without_positive_stress() {
        let p = params(OcrSource::Pop(10.0));
        assert_eq!(su_at(&p, 0.0, 0.0), 0.0);
        assert_eq!(su_at(&p, -5.0, 0.0), 0.0);
    }

    #[test]
    fn apply_does_nothing_without_a_shansep_slice() {
        let pm = model(json!({"ratio": 0.25, "ocr": 1.5}), Value::Null);
        let mut slices = [slice(0, 100.0, 0.0, 0.0)];
        let before = slices;
        let out = apply(&pm, 0.1, &mut slices);
        assert_eq!(out, ShansepOutcome::default());
        assert_eq!(slices[0].cohesion, before[0].cohesion);
        assert_eq!(slices[0].tan_phi, before[0].tan_phi);
    }

    /// `σ′v = (W + Q + V)/b − u`, with `Q + V = weight_extra − kv·W` (the seismic term out), at the base midpoint.
    #[test]
    fn apply_writes_su_and_leaves_the_other_materials() {
        let pm = model(json!({"ratio": 0.25, "ocr": 1.5}), Value::Null);
        let kv = 0.1;
        let (w, q, u) = (100.0, 20.0, 5.0);
        let mut slices = [
            slice(0, 80.0, 8.0, 1.0),
            slice(1, w, kv * w + q, u),
            slice(1, 10.0, kv * 10.0, 20.0),
        ];
        let out = apply(&pm, kv, &mut slices);
        let sigma = (w + q) / 2.0 - u;
        assert_eq!(
            slices[0].cohesion, 3.0,
            "the Mohr-Coulomb slice is untouched"
        );
        assert_eq!(slices[0].tan_phi, 0.4);
        let su = 0.25 * sigma * 1.5_f64.powf(0.8);
        assert!(
            (slices[1].cohesion - su).abs() < 1e-12,
            "{}",
            slices[1].cohesion
        );
        assert_eq!(slices[1].tan_phi, 0.0);
        // σ′v = 10/2 − 20 < 0: no strength, and the note.
        assert_eq!(slices[2].cohesion, 0.0);
        assert_eq!(slices[2].tan_phi, 0.0);
        assert!(out.nonpositive_stress);
        assert_eq!(out.slices.len(), 2);
        match (&out.slices[0], &out.slices[1]) {
            (
                SliceStrength::Shansep {
                    index: 1,
                    vertical_stress,
                    ocr,
                },
                SliceStrength::Shansep {
                    index: 2,
                    vertical_stress: negative,
                    ocr: ocr_neg,
                },
            ) => {
                assert!((vertical_stress - sigma).abs() < 1e-12);
                assert_eq!(*ocr, 1.5);
                assert!((negative - (-15.0)).abs() < 1e-12);
                assert_eq!(*ocr_neg, 1.0);
            }
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn apply_does_not_flag_positive_stress() {
        let pm = model(json!({"ratio": 0.25, "pop": 10.0}), Value::Null);
        let mut slices = [slice(1, 100.0, 0.0, 5.0)];
        let out = apply(&pm, 0.0, &mut slices);
        assert!(!out.nonpositive_stress);
        let sigma: f64 = 100.0 / 2.0 - 5.0;
        let ocr = (sigma + 10.0) / sigma;
        assert!((slices[0].cohesion - 0.25 * sigma * ocr.powf(0.8)).abs() < 1e-12);
    }

    #[test]
    fn apply_uses_the_base_midpoint_for_the_elevation_table() {
        // Base from y 5 to 7: midpoint 6, OCR 1.5 by the table [[4, 1], [8, 2]].
        let pm = model(
            json!({"ratio": 0.25, "ocr_by_elevation": [[4.0, 1.0], [8.0, 2.0]]}),
            Value::Null,
        );
        let mut slices = [slice(1, 100.0, 0.0, 0.0)];
        apply(&pm, 0.0, &mut slices);
        let expected = 0.25 * 50.0 * 1.5_f64.powf(0.8);
        assert!((slices[0].cohesion - expected).abs() < 1e-12);
    }

    /// F6.9, caras: with a constant OCR and a dry layer, the strength of the face is
    /// `ratio·OCR^m·σ̄′v·h`, with `σ̄′v` the mean of `σ′v(z) = γ·(ground − z)` over the face (the midpoints rule is
    /// exact for a linear `σ′v`). Face from the base at 6 to the ground at 10: `σ̄′v = 18·4/2`, `h = 4`.
    #[test]
    fn face_strength_of_a_dry_constant_ocr_layer_is_the_closed_form() {
        let pm = model(
            json!({"ratio": 0.25, "exponent": 0.7, "ocr": 1.8}),
            Value::Null,
        );
        let face = |x_left: f64, x_right: f64| Slice {
            x_left,
            x_right,
            y_base_left: 6.0,
            y_base_right: 6.0,
            width: x_right - x_left,
            base_length: x_right - x_left,
            ..ZERO_SLICE
        };
        let strength = interslice_face_strength(&pm, &face(3.0, 5.0), &face(5.0, 7.0));
        let (h, mean_sigma) = (4.0, 18.0 * 4.0 / 2.0);
        let expected = 0.25 * 1.8_f64.powf(0.7) * mean_sigma * h;
        assert!(
            (strength.cohesion_force - expected).abs() < 1e-9 * expected,
            "{strength:?} {expected}"
        );
        assert_eq!(strength.tan_phi, 0.0);
        assert_eq!(strength.water_force, 0.0);
    }

    #[test]
    fn ponded_face_uses_water_overburden() {
        let dry = model(json!({"ratio": 0.25, "ocr": 1.0}), Value::Null);
        let wet = model(
            json!({"ratio": 0.25, "ocr": 1.0}),
            json!({"unit_weight": 10.0, "piezometric_line": [[0, 12], [10, 12]]}),
        );
        let face = |x_left: f64, x_right: f64| Slice {
            x_left,
            x_right,
            y_base_left: 6.0,
            y_base_right: 6.0,
            width: x_right - x_left,
            base_length: x_right - x_left,
            ..ZERO_SLICE
        };
        let d = interslice_face_strength(&dry, &face(3.0, 5.0), &face(5.0, 7.0));
        let w = interslice_face_strength(&wet, &face(3.0, 5.0), &face(5.0, 7.0));
        // With the same total soil unit weight, water reduces the effective gradient by gamma_w.
        assert!((d.cohesion_force - 0.25 * 18.0 * 8.0).abs() < 1e-9);
        assert!((w.cohesion_force - 0.25 * 8.0 * 8.0).abs() < 1e-9);
    }

    /// With a piezometric line, `σ′v(z) = σv(z) − γw·(z_w − z)`: the face of a submerged layer follows the column.
    #[test]
    fn face_strength_subtracts_the_pore_pressure() {
        let water = json!({"unit_weight": 10.0, "piezometric_line": [[0, 8], [10, 8]]});
        let pm = model(json!({"ratio": 0.25, "ocr": 1.0}), water);
        let face = |x_left: f64, x_right: f64| Slice {
            x_left,
            x_right,
            y_base_left: 6.0,
            y_base_right: 6.0,
            width: x_right - x_left,
            base_length: x_right - x_left,
            ..ZERO_SLICE
        };
        let strength = interslice_face_strength(&pm, &face(3.0, 5.0), &face(5.0, 7.0));
        // σv(z) = 18·(10 − z), u(z) = 10·(8 − z) for z < 8: σ′v = 180 − 18 z − 80 + 10 z = 100 − 8 z for z < 8.
        // Mean over [6, 8]: 100 − 8·7 = 44 (·2 m); over [8, 10]: 18·(10 − z), mean 18, (·2 m).
        let expected = 0.25 * (44.0 * 2.0 + 18.0 * 2.0);
        assert!(
            (strength.cohesion_force - expected).abs() < 1e-9 * expected,
            "{strength:?} {expected}"
        );
    }
}
