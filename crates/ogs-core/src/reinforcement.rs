//! Reinforcements (format v0.4, amendments E14a-E14j): validation of the fields and the **stub** of the force
//! computation (R0 freezes the types and the signatures; the wave R1 fills the stubs).
//!
//! - [`validate`] checks every rule of F4.2 that serde does not: ids, finiteness, ranges, `L > 0`, `x1 = x2` of a
//!   `sheet_pile`, `bonded_length ≤ L` and `angle`. The error is `InvalidModel` with the **JSON path** of the field,
//!   e.g. `reinforcements[2].pullout.coverage debe estar en (0, 1], no 1.5`. A length 0 is reported on the element
//!   itself (`reinforcements[i]`); the vertical sheet pile, on `reinforcements[i].x2`. The version gate
//!   (`reinforcements requiere version "0.4"`) is in `loads::validate_document`, next to the v0.3 one.
//! - [`crossing_nodes`] and [`apply_to_slices`] are called by `lib.rs` **only when `model.reinforcements` is not
//!   empty**, so a model without reinforcements goes through exactly the code of v0.2.0 (identity byte for byte, E14a).
//!   Both are `todo!("R1: fuerzas de refuerzo")` for now.
//!
//! Flow that `lib.rs` follows for each surface (the search repeats it for every candidate, E14d.4, with no change of
//! signature of any existing function):
//! 1. `crossing_nodes` gives the abscissae `x_c ± 1e-6·width` of every crossing of a reinforcement with the surface;
//!    `LoadCase::with_extra_breaks` adds them to the cut, so the force acts on a thin slice centred on `x_c` and the arm
//!    of its vertical component about the midpoint of the base is 0 (like a line load, E12f);
//! 2. the surface is sliced with that load case;
//! 3. `apply_to_slices` adds the forces to the slices (active ones to `weight_extra`, `h_force`, `h_moment_base` and
//!    `driving_extra`, E14f; passive ones to the `passive_*` fields, E14g) and returns the forces of the report.

use crate::OgsError;
use crate::geometry::PreparedModel;
use crate::model::{Pullout, Reinforcement};
use crate::report::ReinforcementForce;
use crate::slicer::Slice;
use crate::surface::Surface;

/// Informative note (E14d): no crossing of a reinforcement applies a force on the reported surface.
pub const REINFORCEMENT_OUTSIDE_MASS: &str = "reinforcement_outside_mass";
/// Informative note (E14e): a passive reinforcement would be compressed by the sliding and gives no force.
pub const REINFORCEMENT_COMPRESSION_IGNORED: &str = "reinforcement_compression_ignored";
/// Informative note (E14h): the model has a `pile` or a `sheet_pile`, crossed or not.
pub const STRUCTURAL_CHECKS_NOT_COVERED: &str = "structural_checks_not_covered";

/// Offset of the nodes around a crossing, relative to the model width (E14d.2): `x_c ± 1e-6 · width`.
pub const CROSSING_BREAK_FRACTION: f64 = 1e-6;

fn invalid(msg: impl Into<String>) -> OgsError {
    OgsError::InvalidModel(msg.into())
}

/// `value` finite and `≥ 0`.
fn non_negative(path: &str, value: f64) -> Result<(), OgsError> {
    if value.is_finite() && value >= 0.0 {
        Ok(())
    } else {
        Err(invalid(format!(
            "{path} debe ser finito y mayor o igual que 0, no {value}"
        )))
    }
}

/// `value` finite and `> 0`.
fn positive(path: &str, value: f64) -> Result<(), OgsError> {
    if value.is_finite() && value > 0.0 {
        Ok(())
    } else {
        Err(invalid(format!(
            "{path} debe ser finito y mayor que 0, no {value}"
        )))
    }
}

/// Checks `angle` against `direction` (E14b): required with `"angle"`, in `(−90, 90)`, and forbidden otherwise.
fn check_angle(
    path: &str,
    is_angle_direction: bool,
    direction: &str,
    angle: Option<f64>,
) -> Result<(), OgsError> {
    match (is_angle_direction, angle) {
        (true, None) => Err(invalid(format!(
            "{path}.angle es obligatorio con direction \"angle\""
        ))),
        (true, Some(a)) if !(a.is_finite() && a > -90.0 && a < 90.0) => Err(invalid(format!(
            "{path}.angle debe estar en (-90, 90) grados, no {a}"
        ))),
        (false, Some(_)) => Err(invalid(format!(
            "{path}.angle solo se admite con direction \"angle\", no con \"{direction}\""
        ))),
        _ => Ok(()),
    }
}

fn check_pullout(path: &str, pullout: &Pullout, length: f64) -> Result<(), OgsError> {
    match pullout {
        Pullout::Bond {
            strength,
            bonded_length,
        } => {
            non_negative(&format!("{path}.pullout.strength"), *strength)?;
            if let Some(l) = bonded_length {
                let p = format!("{path}.pullout.bonded_length");
                positive(&p, *l)?;
                if *l > length {
                    return Err(invalid(format!(
                        "{p} debe ser menor o igual que la longitud del elemento {length}, no {l}"
                    )));
                }
            }
        }
        Pullout::Interface {
            adhesion,
            friction_angle,
            coverage,
        } => {
            non_negative(&format!("{path}.pullout.adhesion"), *adhesion)?;
            if !(friction_angle.is_finite() && (0.0..90.0).contains(friction_angle)) {
                return Err(invalid(format!(
                    "{path}.pullout.friction_angle debe estar en [0, 90) grados, no {friction_angle}"
                )));
            }
            if !(coverage.is_finite() && *coverage > 0.0 && *coverage <= 1.0) {
                return Err(invalid(format!(
                    "{path}.pullout.coverage debe estar en (0, 1], no {coverage}"
                )));
            }
        }
        Pullout::Development { length1, length2 } => {
            non_negative(&format!("{path}.pullout.length1"), *length1)?;
            non_negative(&format!("{path}.pullout.length2"), *length2)?;
        }
    }
    Ok(())
}

/// The rules of F4.2 that do not need the geometry of the model (it runs after the version gate). Returns the first
/// error, with the JSON path of the field.
pub fn validate(reinforcements: &[Reinforcement]) -> Result<(), OgsError> {
    let mut seen: Vec<&str> = Vec::new();
    for (i, r) in reinforcements.iter().enumerate() {
        let path = format!("reinforcements[{i}]");
        let id = r.id();
        if id.is_empty() {
            return Err(invalid(format!("{path}.id no puede estar vacío")));
        }
        if seen.contains(&id) {
            return Err(invalid(format!("{path}.id: el id '{id}' está repetido")));
        }
        seen.push(id);
        let ([x1, y1], [x2, y2]) = r.ends();
        for (name, v) in [("x1", x1), ("y1", y1), ("x2", x2), ("y2", y2)] {
            if !v.is_finite() {
                return Err(invalid(format!("{path}.{name} debe ser finito, no {v}")));
            }
        }
        let length = r.length();
        if length <= 0.0 {
            return Err(invalid(format!(
                "{path} tiene longitud 0: (x1, y1) y (x2, y2) coinciden"
            )));
        }
        match r {
            Reinforcement::Anchor(t) | Reinforcement::Nail(t) | Reinforcement::Geosynthetic(t) => {
                non_negative(&format!("{path}.tensile_capacity"), t.tensile_capacity)?;
                for (name, v) in [
                    ("end1_capacity", t.end1_capacity),
                    ("end2_capacity", t.end2_capacity),
                ] {
                    if let Some(v) = v {
                        non_negative(&format!("{path}.{name}"), v)?;
                    }
                }
                if let Some(s) = t.spacing {
                    positive(&format!("{path}.spacing"), s)?;
                }
                if let Some(p) = &t.pullout {
                    check_pullout(&path, p, length)?;
                }
            }
            Reinforcement::Pile(p) => {
                non_negative(&format!("{path}.force"), p.force)?;
                if let Some(s) = p.spacing {
                    positive(&format!("{path}.spacing"), s)?;
                }
                check_angle(
                    &path,
                    p.direction == crate::model::PileDirection::Angle,
                    pile_direction_name(p.direction),
                    p.angle,
                )?;
            }
            Reinforcement::SheetPile(p) => {
                non_negative(&format!("{path}.force"), p.force)?;
                if x1 != x2 {
                    return Err(invalid(format!(
                        "{path}.x2 debe ser igual a x1 (la tablestaca es vertical), no {x2} frente a {x1}"
                    )));
                }
                check_angle(
                    &path,
                    p.direction == crate::model::PileDirection::Angle,
                    pile_direction_name(p.direction),
                    p.angle,
                )?;
            }
        }
    }
    Ok(())
}

fn pile_direction_name(d: crate::model::PileDirection) -> &'static str {
    match d {
        crate::model::PileDirection::Angle => "angle",
        crate::model::PileDirection::Tangent => "tangent",
        crate::model::PileDirection::Perpendicular => "perpendicular",
    }
}

/// STUB (R1). The abscissae to add to the cut of `surface` (the surface already fitted to the ground): for every
/// crossing `(x_c, y_c)` of a reinforcement with the surface (E14d.1; a crossing at an end of the element, `t_c = 0` or
/// `1` within the tolerance, does not count), the two nodes `x_c ± CROSSING_BREAK_FRACTION · width`.
///
/// Called by `lib.rs` for each surface (and each search candidate) when `reinforcements` is not empty; the result goes
/// to `LoadCase::with_extra_breaks` before slicing.
pub fn crossing_nodes(
    reinforcements: &[Reinforcement],
    pm: &PreparedModel,
    surface: &Surface,
) -> Vec<f64> {
    let _ = (reinforcements, pm, surface);
    todo!("R1: fuerzas de refuerzo")
}

/// STUB (R1). Adds the forces of the reinforcements to `slices`, which were cut with the nodes of
/// [`crossing_nodes`] on the same `surface`, and returns one [`ReinforcementForce`] per crossing, in the order
/// `(reinforcement, crossing from the head)` (E14d, E14f, E14g, E14h, E14i).
///
/// - `reinforcements`: `model.reinforcements`, already validated and not empty;
/// - `pm`: the prepared model (sliding direction `pm.sliding`, tolerance `pm.tol()`, ground);
/// - `surface`: the fitted surface of the slices (a circle gives the moment arm `(yc, r)` of Bishop);
/// - `slices`: they are modified. An **active** force goes to `weight_extra`, `h_force`, `h_moment_base` and (circle)
///   `driving_extra`; a **passive** one to `passive_v`, `passive_h`, `passive_h_moment_base` and
///   `passive_driving_extra`, **before** dividing by `F` (the method divides). A crossing on an air slice or a
///   discarded block applies nothing and returns `status: OutsideMass`; a passive one that would be compressed,
///   `CompressionIgnored`.
///
/// It returns the forces for any surface; `lib.rs` keeps them in the report only for a converged method. It does not
/// emit the notes: `lib.rs` derives `reinforcement_outside_mass` (no crossing with `Applied`),
/// `reinforcement_compression_ignored` and `structural_checks_not_covered` from the returned forces and from
/// `Reinforcement::is_pile`.
pub fn apply_to_slices(
    reinforcements: &[Reinforcement],
    pm: &PreparedModel,
    surface: &Surface,
    slices: &mut [Slice],
) -> Vec<ReinforcementForce> {
    let _ = (reinforcements, pm, surface, slices);
    todo!("R1: fuerzas de refuerzo")
}
