//! Material strength: validation and resolution of the materials, and the strength of a slice base and of an
//! interslice face.
//!
//! - [`resolve_materials`] validates every material of a model (ids, unit weights, `ru` and the fields of its
//!   constitutive `model`, contract F3.2 and F6.2/F6.3) and turns it into a [`ResolvedMaterial`]. It was `geometry.rs`.
//! - [`resolve`] gives `(c, tan φ)` of a slice base from its material and the elevation of the base midpoint. It is
//!   the only place that knows how the strength depends on the model. The slicer calls it for each slice.
//! - [`face_tau`] gives the shear strength of one point of an interslice face (F6.6).
//!
//! In Mohr-Coulomb `resolve` returns exactly `(cohesion, tan(φ))`, the same bits as before v0.3. An `undrained`
//! material without gradient is the Mohr-Coulomb material `cohesion = Su`, `φ = 0`, bit for bit (E13b). The new
//! `hoek_brown` and `shansep` laws (F6.2, F6.3) resolve to `(0, 0)`: the slicer leaves those slices with zero strength
//! and the hooks of `lib.rs` write it before solving (F6.6).

use crate::OgsError;
use crate::model::{Material, MaterialModel, Model};

/// Linear variation of the undrained strength with the elevation (E13b).
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct SuProfile {
    /// Elevation `y` where the strength is `undrained_strength` (an elevation, not a depth).
    pub(crate) datum: f64,
    /// Increase of `Su` per unit of depth below the datum.
    pub(crate) gradient: f64,
    /// Cap of `Su` (a maximum for a gradient ≥ 0, a minimum for a gradient < 0).
    pub(crate) limit: Option<f64>,
}

/// Hoek-Brown parameters already derived from `ucs`, `gsi`, `mi` and `disturbance` (F6.2).
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct HoekBrownParams {
    /// σci, the uniaxial compressive strength of the intact rock.
    pub(crate) ucs: f64,
    /// `mb = mi·exp((GSI − 100)/(28 − 14·D))` (Hoek, Carranza-Torres and Corkum 2002, eq. 3).
    pub(crate) mb: f64,
    /// `s = exp((GSI − 100)/(9 − 3·D))` (eq. 4).
    pub(crate) s: f64,
    /// `a = 1/2 + (exp(−GSI/15) − exp(−20/3))/6` (eq. 5).
    pub(crate) a: f64,
    pub(crate) sn_zero: f64,
    pub(crate) tension: f64,
}

impl HoekBrownParams {
    pub(crate) fn new(ucs: f64, mb: f64, s: f64, a: f64) -> Self {
        let base = s.max(1e-12);
        let ba = base.powf(a);
        let k = 1.0 + a * mb * (ba / base);
        Self {
            ucs,
            mb,
            s,
            a,
            sn_zero: ucs * ba / (k + 1.0),
            tension: -s * ucs / mb,
        }
    }
}

/// Source of the OCR of a SHANSEP material (F6.3), already validated: exactly one of the three.
#[derive(Debug, Clone, PartialEq)]
pub(crate) enum OcrSource {
    /// A constant OCR `≥ 1`.
    Ocr(f64),
    /// A pre-consolidation pressure `≥ 0` (the OCR is derived from it, F6.9).
    Pop(f64),
    /// A table `[[y, OCR], …]` of OCR by elevation, interpolated linearly (F6.9).
    ByElevation(Vec<[f64; 2]>),
}

/// SHANSEP parameters and the source of OCR, already validated (F6.3).
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ShansepParams {
    /// The ratio S.
    pub(crate) ratio: f64,
    /// The exponent m (with its default of 0.8 resolved).
    pub(crate) exponent: f64,
    /// The source of OCR.
    pub(crate) ocr: OcrSource,
}

/// Constitutive law of a resolved material (F6.6). `Linear` is the Mohr-Coulomb and undrained strength of today;
/// `HoekBrown` and `Shansep` carry their already-derived parameters.
#[derive(Debug, Clone, PartialEq)]
pub(crate) enum StrengthLaw {
    Linear,
    HoekBrown(HoekBrownParams),
    Shansep(ShansepParams),
}

/// Material with precomputed `tan φ`.
///
/// `cohesion` and `tan_phi` are the strength of the base: for `mohr_coulomb`, `c` and `tan φ`; for `undrained`,
/// `Su` (at the datum, or everywhere without `profile`) and `0`. For `hoek_brown` and `shansep` they are `(0, 0)` and
/// `law` carries the parameters (F6.6).
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ResolvedMaterial {
    pub(crate) unit_weight: f64,
    pub(crate) unit_weight_sat: Option<f64>,
    pub(crate) cohesion: f64,
    pub(crate) tan_phi: f64,
    pub(crate) ru: Option<f64>,
    /// `Some` only for an undrained material with `strength_datum` and `strength_gradient`.
    pub(crate) profile: Option<SuProfile>,
    /// The constitutive law (F6.6): `Linear` for `mohr_coulomb` and `undrained`.
    pub(crate) law: StrengthLaw,
}

/// Strength of a slice base (contract F3.2, frozen in wave 0): `(c, tan φ)` for the material and the elevation
/// `y_base_mid` of the midpoint of the base.
///
/// - Mohr-Coulomb, and undrained without gradient: `(cohesion, tan_phi)`, the stored values, untouched.
/// - Undrained with gradient: `Su(y) = max(0, Su₀ + (datum − y)·gradient)`, then the cap: with `limit`,
///   `min(Su, limit)` if `gradient ≥ 0` and `max(Su, limit)` if `gradient < 0`. The result is `(Su(y), 0)`.
/// - Hoek-Brown and SHANSEP: `(0, 0)`; the hooks of `lib.rs` write the real strength before solving (F6.6).
pub(crate) fn resolve(
    material: &ResolvedMaterial,
    y_base_mid: f64,
) -> (f64 /* c */, f64 /* tan_phi */) {
    match &material.law {
        StrengthLaw::Linear => {
            let Some(p) = material.profile else {
                return (material.cohesion, material.tan_phi);
            };
            let mut su = (material.cohesion + (p.datum - y_base_mid) * p.gradient).max(0.0);
            if let Some(limit) = p.limit {
                su = if p.gradient >= 0.0 {
                    su.min(limit)
                } else {
                    su.max(limit)
                };
            }
            (su, 0.0)
        }
        StrengthLaw::HoekBrown(_) | StrengthLaw::Shansep(_) => (0.0, 0.0),
    }
}

/// Derived Hoek-Brown parameters (Hoek, Carranza-Torres and Corkum 2002, eqs. 3 to 5; F6.2), `(mb, s, a)`:
///
/// - `mb = mi·exp((GSI − 100)/(28 − 14·D))`;
/// - `s = exp((GSI − 100)/(9 − 3·D))`;
/// - `a = 1/2 + (exp(−GSI/15) − exp(−20/3))/6`.
///
/// Public for the parity with the calculator of the web (F6.13) and for the tests.
pub fn hoek_brown_mb_s_a(gsi: f64, mi: f64, disturbance: f64) -> (f64, f64, f64) {
    let mb = mi * ((gsi - 100.0) / (28.0 - 14.0 * disturbance)).exp();
    let s = ((gsi - 100.0) / (9.0 - 3.0 * disturbance)).exp();
    let a = 0.5 + (((-gsi / 15.0).exp() - (-20.0_f64 / 3.0).exp()) / 6.0);
    (mb, s, a)
}

/// Shear strength of one point of an interslice face (F6.6): the material envelope evaluated at the effective vertical
/// stress `sigma_eff` (K = 1). For `Linear` it is `c + sigma_eff·tan φ` (with `c = Su(y)` for an undrained profile), the
/// same as today. For `HoekBrown` it calls [`crate::hoek_brown::tau_at_normal`] and for `Shansep`
/// [`crate::shansep::su_at`] (both stubs in B0).
pub(crate) fn face_tau(material: &ResolvedMaterial, sigma_eff: f64, y: f64) -> f64 {
    match &material.law {
        StrengthLaw::Linear => {
            let (c, tan_phi) = resolve(material, y);
            c + sigma_eff * tan_phi
        }
        StrengthLaw::HoekBrown(params) => crate::hoek_brown::tau_at_normal(params, sigma_eff),
        StrengthLaw::Shansep(params) => crate::shansep::su_at(params, sigma_eff, y),
    }
}

fn invalid(msg: impl Into<String>) -> OgsError {
    OgsError::InvalidModel(msg.into())
}

fn finite(x: Option<f64>) -> bool {
    x.is_none_or(f64::is_finite)
}

/// Name of a model in the messages, as written in the JSON.
fn model_name(m: MaterialModel) -> &'static str {
    match m {
        MaterialModel::MohrCoulomb => "mohr_coulomb",
        MaterialModel::Undrained => "undrained",
        MaterialModel::HoekBrown => "hoek_brown",
        MaterialModel::Shansep => "shansep",
    }
}

/// The fields of a material that its `model` allows, requires or forbids (F3.2, F6.2, F6.3), and their ranges.
fn validate_model_fields(m: &Material) -> Result<(), OgsError> {
    let name = model_name(m.model);
    let forbidden = |fields: &[(&str, bool)]| -> Result<(), OgsError> {
        match fields.iter().find(|(_, present)| *present) {
            Some((field, _)) => Err(invalid(format!(
                "el material '{}' con model \"{name}\" no admite el campo '{field}'",
                m.id
            ))),
            None => Ok(()),
        }
    };
    let required = |field: &str, present: bool| -> Result<(), OgsError> {
        if present {
            Ok(())
        } else {
            Err(invalid(format!(
                "el material '{}' con model \"{name}\" requiere el campo '{field}'",
                m.id
            )))
        }
    };
    match m.model {
        MaterialModel::MohrCoulomb => {
            forbidden(&[
                ("undrained_strength", m.undrained_strength.is_some()),
                ("strength_datum", m.strength_datum.is_some()),
                ("strength_gradient", m.strength_gradient.is_some()),
                ("strength_limit", m.strength_limit.is_some()),
                ("ucs", m.ucs.is_some()),
                ("gsi", m.gsi.is_some()),
                ("mi", m.mi.is_some()),
                ("disturbance", m.disturbance.is_some()),
                ("shansep", m.shansep.is_some()),
            ])?;
            required("cohesion", m.cohesion.is_some())?;
            required("friction_angle", m.friction_angle.is_some())?;
            let c = m.cohesion.unwrap_or_default();
            if !(c.is_finite() && c >= 0.0) {
                return Err(invalid(format!(
                    "la cohesión del material '{}' debe ser ≥ 0",
                    m.id
                )));
            }
            let phi = m.friction_angle.unwrap_or_default();
            if !(0.0..90.0).contains(&phi) {
                return Err(invalid(format!(
                    "el ángulo de fricción del material '{}' debe estar en [0, 90)",
                    m.id
                )));
            }
        }
        MaterialModel::Undrained => {
            forbidden(&[
                ("cohesion", m.cohesion.is_some()),
                ("friction_angle", m.friction_angle.is_some()),
                ("ucs", m.ucs.is_some()),
                ("gsi", m.gsi.is_some()),
                ("mi", m.mi.is_some()),
                ("disturbance", m.disturbance.is_some()),
                ("shansep", m.shansep.is_some()),
            ])?;
            required("undrained_strength", m.undrained_strength.is_some())?;
            let su = m.undrained_strength.unwrap_or_default();
            if !(su.is_finite() && su >= 0.0) {
                return Err(invalid(format!(
                    "undrained_strength del material '{}' debe ser finito y ≥ 0",
                    m.id
                )));
            }
            if !(finite(m.strength_datum)
                && finite(m.strength_gradient)
                && finite(m.strength_limit))
            {
                return Err(invalid(format!(
                    "strength_datum, strength_gradient y strength_limit del material '{}' deben ser finitos",
                    m.id
                )));
            }
            if m.strength_datum.is_some() != m.strength_gradient.is_some() {
                return Err(invalid(format!(
                    "el material '{}': strength_datum y strength_gradient van juntos o no van",
                    m.id
                )));
            }
            if m.strength_limit.is_some() && m.strength_gradient.is_none() {
                return Err(invalid(format!(
                    "el material '{}': strength_limit solo se admite con strength_gradient",
                    m.id
                )));
            }
            if let Some(limit) = m.strength_limit
                && limit < 0.0
            {
                return Err(invalid(format!(
                    "strength_limit del material '{}' debe ser ≥ 0",
                    m.id
                )));
            }
        }
        MaterialModel::HoekBrown => {
            forbidden(&[
                ("cohesion", m.cohesion.is_some()),
                ("friction_angle", m.friction_angle.is_some()),
                ("undrained_strength", m.undrained_strength.is_some()),
                ("strength_datum", m.strength_datum.is_some()),
                ("strength_gradient", m.strength_gradient.is_some()),
                ("strength_limit", m.strength_limit.is_some()),
                ("shansep", m.shansep.is_some()),
            ])?;
            required("ucs", m.ucs.is_some())?;
            required("gsi", m.gsi.is_some())?;
            required("mi", m.mi.is_some())?;
            required("disturbance", m.disturbance.is_some())?;
            let ucs = m.ucs.unwrap_or_default();
            if !(ucs.is_finite() && ucs > 0.0) {
                return Err(invalid(format!(
                    "el ucs del material '{}' debe ser finito y > 0",
                    m.id
                )));
            }
            let gsi = m.gsi.unwrap_or_default();
            if !(gsi.is_finite() && (0.0..=100.0).contains(&gsi)) {
                return Err(invalid(format!(
                    "el GSI del material '{}' debe estar en [0, 100]",
                    m.id
                )));
            }
            let mi = m.mi.unwrap_or_default();
            if !(mi.is_finite() && mi > 0.0) {
                return Err(invalid(format!(
                    "el mi del material '{}' debe ser finito y > 0",
                    m.id
                )));
            }
            let d = m.disturbance.unwrap_or_default();
            if !(d.is_finite() && (0.0..=1.0).contains(&d)) {
                return Err(invalid(format!(
                    "el disturbance del material '{}' debe estar en [0, 1]",
                    m.id
                )));
            }
        }
        MaterialModel::Shansep => {
            forbidden(&[
                ("cohesion", m.cohesion.is_some()),
                ("friction_angle", m.friction_angle.is_some()),
                ("undrained_strength", m.undrained_strength.is_some()),
                ("strength_datum", m.strength_datum.is_some()),
                ("strength_gradient", m.strength_gradient.is_some()),
                ("strength_limit", m.strength_limit.is_some()),
                ("ucs", m.ucs.is_some()),
                ("gsi", m.gsi.is_some()),
                ("mi", m.mi.is_some()),
                ("disturbance", m.disturbance.is_some()),
            ])?;
            required("shansep", m.shansep.is_some())?;
            let spec = m.shansep.as_ref().expect("shansep is present");
            if !(spec.ratio.is_finite() && spec.ratio > 0.0) {
                return Err(invalid(format!(
                    "el shansep.ratio del material '{}' debe ser finito y > 0",
                    m.id
                )));
            }
            if let Some(e) = spec.exponent
                && !(e.is_finite() && (0.0..=1.0).contains(&e))
            {
                return Err(invalid(format!(
                    "el shansep.exponent del material '{}' debe estar en [0, 1]",
                    m.id
                )));
            }
            let sources = [
                spec.ocr.is_some(),
                spec.pop.is_some(),
                spec.ocr_by_elevation.is_some(),
            ];
            if sources.iter().filter(|&&b| b).count() != 1 {
                return Err(invalid(format!(
                    "el material '{}' requiere exactamente uno de shansep.ocr, shansep.pop o shansep.ocr_by_elevation",
                    m.id
                )));
            }
            if let Some(ocr) = spec.ocr
                && !(ocr.is_finite() && ocr >= 1.0)
            {
                return Err(invalid(format!(
                    "el shansep.ocr del material '{}' debe ser finito y ≥ 1",
                    m.id
                )));
            }
            if let Some(pop) = spec.pop
                && !(pop.is_finite() && pop >= 0.0)
            {
                return Err(invalid(format!(
                    "el shansep.pop del material '{}' debe ser finito y ≥ 0",
                    m.id
                )));
            }
            if let Some(table) = &spec.ocr_by_elevation {
                if table.len() < 2 {
                    return Err(invalid(format!(
                        "el shansep.ocr_by_elevation del material '{}' necesita al menos 2 filas",
                        m.id
                    )));
                }
                if table
                    .iter()
                    .any(|&[y, ocr]| !(y.is_finite() && ocr.is_finite() && ocr >= 1.0))
                {
                    return Err(invalid(format!(
                        "el shansep.ocr_by_elevation del material '{}' tiene valores no finitos o OCR < 1",
                        m.id
                    )));
                }
                if table.windows(2).any(|w| w[1][0] <= w[0][0]) {
                    return Err(invalid(format!(
                        "el shansep.ocr_by_elevation del material '{}' debe tener y estrictamente creciente",
                        m.id
                    )));
                }
            }
        }
    }
    Ok(())
}

/// Validates and resolves the materials of a model, in the order of `Model.materials` (slice material indices
/// match the model).
pub(crate) fn resolve_materials(model: &Model) -> Result<Vec<ResolvedMaterial>, OgsError> {
    let mut out = Vec::with_capacity(model.materials.len());
    for (i, m) in model.materials.iter().enumerate() {
        // E12j (R5-10): an empty id cannot be told apart from "no material" by the editor, and no region can name it.
        if m.id.is_empty() {
            return Err(invalid(format!(
                "el id del material {i} está vacío: debe tener al menos un carácter"
            )));
        }
        if model.materials[..i].iter().any(|other| other.id == m.id) {
            return Err(invalid(format!("id de material duplicado: '{}'", m.id)));
        }
        if !(m.unit_weight.is_finite() && m.unit_weight > 0.0) {
            return Err(invalid(format!(
                "el material '{}' debe tener peso unitario > 0",
                m.id
            )));
        }
        if let Some(gs) = m.unit_weight_sat
            && !(gs.is_finite() && gs > 0.0)
        {
            return Err(invalid(format!(
                "el peso unitario saturado del material '{}' debe ser > 0",
                m.id
            )));
        }
        validate_model_fields(m)?;
        if let Some(ru) = m.ru
            && !(0.0..1.0).contains(&ru)
        {
            return Err(invalid(format!(
                "ru del material '{}' debe estar en [0, 1)",
                m.id
            )));
        }
        let (cohesion, tan_phi, profile, law) = match m.model {
            MaterialModel::MohrCoulomb => (
                m.cohesion.unwrap_or_default(),
                m.friction_angle.unwrap_or_default().to_radians().tan(),
                None,
                StrengthLaw::Linear,
            ),
            MaterialModel::Undrained => (
                m.undrained_strength.unwrap_or_default(),
                // The same value as `0.0_f64.to_radians().tan()` of a Mohr-Coulomb material with φ = 0.
                0.0_f64.to_radians().tan(),
                match (m.strength_datum, m.strength_gradient) {
                    (Some(datum), Some(gradient)) => Some(SuProfile {
                        datum,
                        gradient,
                        limit: m.strength_limit,
                    }),
                    _ => None,
                },
                StrengthLaw::Linear,
            ),
            MaterialModel::HoekBrown => {
                let ucs = m.ucs.unwrap_or_default();
                let gsi = m.gsi.unwrap_or_default();
                let mi = m.mi.unwrap_or_default();
                let disturbance = m.disturbance.unwrap_or_default();
                let (mb, s, a) = hoek_brown_mb_s_a(gsi, mi, disturbance);
                (
                    0.0,
                    0.0,
                    None,
                    StrengthLaw::HoekBrown(HoekBrownParams::new(ucs, mb, s, a)),
                )
            }
            MaterialModel::Shansep => {
                let spec = m.shansep.as_ref().expect("validated: shansep is present");
                let ocr = if let Some(ocr) = spec.ocr {
                    OcrSource::Ocr(ocr)
                } else if let Some(pop) = spec.pop {
                    OcrSource::Pop(pop)
                } else {
                    OcrSource::ByElevation(spec.ocr_by_elevation.clone().unwrap_or_default())
                };
                (
                    0.0,
                    0.0,
                    None,
                    StrengthLaw::Shansep(ShansepParams {
                        ratio: spec.ratio,
                        exponent: spec.exponent(),
                        ocr,
                    }),
                )
            }
        };
        out.push(ResolvedMaterial {
            unit_weight: m.unit_weight,
            unit_weight_sat: m.unit_weight_sat,
            cohesion,
            tan_phi,
            ru: m.ru,
            profile,
            law,
        });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn material(cohesion: f64, tan_phi: f64, profile: Option<SuProfile>) -> ResolvedMaterial {
        ResolvedMaterial {
            unit_weight: 20.0,
            unit_weight_sat: None,
            cohesion,
            tan_phi,
            ru: None,
            profile,
            law: StrengthLaw::Linear,
        }
    }

    #[test]
    fn mohr_coulomb_returns_the_stored_values() {
        let m = material(3.0, 19.6_f64.to_radians().tan(), None);
        for y in [-1e9, 0.0, 12.5, 1e9] {
            let (c, t) = resolve(&m, y);
            assert_eq!(c.to_bits(), 3.0_f64.to_bits());
            assert_eq!(t.to_bits(), 19.6_f64.to_radians().tan().to_bits());
        }
    }

    #[test]
    fn constant_undrained_is_cohesion_with_zero_friction() {
        let m = material(25.0, 0.0_f64.to_radians().tan(), None);
        assert_eq!(resolve(&m, 31.0), (25.0, 0.0));
        assert_eq!(resolve(&m, -1e6), (25.0, 0.0));
    }

    #[test]
    fn linear_profile_is_su_at_the_datum_and_grows_downward() {
        let p = SuProfile {
            datum: 35.0,
            gradient: 1.0,
            limit: None,
        };
        let m = material(10.0, 0.0, Some(p));
        assert_eq!(resolve(&m, 35.0), (10.0, 0.0));
        assert_eq!(resolve(&m, 25.0), (20.0, 0.0));
        assert_eq!(resolve(&m, 40.0), (5.0, 0.0));
        // Above the datum it never goes below 0.
        assert_eq!(resolve(&m, 60.0), (0.0, 0.0));
    }

    #[test]
    fn limit_is_a_maximum_for_a_positive_gradient_and_a_minimum_for_a_negative_one() {
        let up = material(
            10.0,
            0.0,
            Some(SuProfile {
                datum: 35.0,
                gradient: 2.0,
                limit: Some(30.0),
            }),
        );
        assert_eq!(resolve(&up, 30.0).0, 20.0);
        assert_eq!(resolve(&up, 20.0).0, 30.0);
        assert_eq!(resolve(&up, 0.0).0, 30.0);
        let down = material(
            50.0,
            0.0,
            Some(SuProfile {
                datum: 35.0,
                gradient: -2.0,
                limit: Some(20.0),
            }),
        );
        assert_eq!(resolve(&down, 30.0).0, 40.0);
        assert_eq!(resolve(&down, 20.0).0, 20.0);
        assert_eq!(resolve(&down, 0.0).0, 20.0);
        // A limit of 0 with a positive gradient makes Su = 0 everywhere.
        let zero = material(
            10.0,
            0.0,
            Some(SuProfile {
                datum: 35.0,
                gradient: 1.0,
                limit: Some(0.0),
            }),
        );
        assert_eq!(resolve(&zero, 10.0), (0.0, 0.0));
    }

    #[test]
    fn the_new_laws_resolve_to_zero_strength() {
        let hb = ResolvedMaterial {
            law: StrengthLaw::HoekBrown(HoekBrownParams::new(30_000.0, 0.5, 1e-4, 0.5)),
            ..material(0.0, 0.0, None)
        };
        assert_eq!(resolve(&hb, 10.0), (0.0, 0.0));
        let sh = ResolvedMaterial {
            law: StrengthLaw::Shansep(ShansepParams {
                ratio: 0.25,
                exponent: 0.8,
                ocr: OcrSource::Ocr(1.5),
            }),
            ..material(0.0, 0.0, None)
        };
        assert_eq!(resolve(&sh, 10.0), (0.0, 0.0));
    }

    #[test]
    fn hoek_brown_mb_s_a_matches_the_published_values() {
        // X25 §1.2: GSI 20, mi 10, D 1.
        let (mb, s, a) = hoek_brown_mb_s_a(20.0, 10.0, 1.0);
        assert!((mb - 0.0329851).abs() < 1e-7, "{mb}");
        assert!((s - 1.6196e-6).abs() < 1e-10, "{s}");
        assert!((a - 0.543721).abs() < 1e-6, "{a}");
        // X25 §1.3 (Hammah example 1): GSI 5, mi 2, D 0.
        let (mb, s, a) = hoek_brown_mb_s_a(5.0, 2.0, 0.0);
        assert!((mb - 0.067225).abs() < 1e-6, "{mb}");
        assert!((s - 2.6048e-5).abs() < 1e-9, "{s}");
        assert!((a - 0.61921).abs() < 1e-5, "{a}");
    }
}
