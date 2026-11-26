//! Material strength: validation and resolution of the materials, and the strength of a slice base.
//!
//! - [`resolve_materials`] validates every material of a model (ids, unit weights, `ru` and the fields of its
//!   constitutive `model`, contract F3.2) and turns it into a [`ResolvedMaterial`]. It was `geometry.rs`.
//! - [`resolve`] gives `(c, tan φ)` of a slice base from its material and the elevation of the base midpoint. It is
//!   the only place that knows how the strength depends on the model. The slicer calls it for each slice.
//!
//! In Mohr-Coulomb `resolve` returns exactly `(cohesion, tan(φ))`, the same bits as before v0.3. An `undrained`
//! material without gradient is the Mohr-Coulomb material `cohesion = Su`, `φ = 0`, bit for bit (E13b).

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

/// Material with precomputed `tan φ`.
///
/// `cohesion` and `tan_phi` are the strength of the base: for `mohr_coulomb`, `c` and `tan φ`; for `undrained`,
/// `Su` (at the datum, or everywhere without `profile`) and `0`.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ResolvedMaterial {
    pub(crate) unit_weight: f64,
    pub(crate) unit_weight_sat: Option<f64>,
    pub(crate) cohesion: f64,
    pub(crate) tan_phi: f64,
    pub(crate) ru: Option<f64>,
    /// `Some` only for an undrained material with `strength_datum` and `strength_gradient`.
    pub(crate) profile: Option<SuProfile>,
}

/// Strength of a slice base (contract F3.2, frozen in wave 0): `(c, tan φ)` for the material and the elevation
/// `y_base_mid` of the midpoint of the base.
///
/// - Mohr-Coulomb, and undrained without gradient: `(cohesion, tan_phi)`, the stored values, untouched.
/// - Undrained with gradient: `Su(y) = max(0, Su₀ + (datum − y)·gradient)`, then the cap: with `limit`,
///   `min(Su, limit)` if `gradient ≥ 0` and `max(Su, limit)` if `gradient < 0`. The result is `(Su(y), 0)`.
pub(crate) fn resolve(
    material: &ResolvedMaterial,
    y_base_mid: f64,
) -> (f64 /* c */, f64 /* tan_phi */) {
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
    }
}

/// The fields of a material that its `model` allows, requires or forbids (F3.2), and their ranges.
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
        let (cohesion, tan_phi, profile) = match m.model {
            MaterialModel::MohrCoulomb => (
                m.cohesion.unwrap_or_default(),
                m.friction_angle.unwrap_or_default().to_radians().tan(),
                None,
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
            ),
        };
        out.push(ResolvedMaterial {
            unit_weight: m.unit_weight,
            unit_weight_sat: m.unit_weight_sat,
            cohesion,
            tan_phi,
            ru: m.ru,
            profile,
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
}
