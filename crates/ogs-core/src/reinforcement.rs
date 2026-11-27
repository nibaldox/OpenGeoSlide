//! Reinforcements (format v0.4, amendments E14a-E14m): validation of the fields, the crossings with the slip surface,
//! the capacity `T(s)`, the direction of the force and its writing into the slices.
//!
//! - [`validate`] checks every rule of F4.2 that serde does not: ids, finiteness, ranges, `L > 0`, `x1 = x2` of a
//!   `sheet_pile`, `bonded_length ≤ L` and `angle`. The error is `InvalidModel` with the **JSON path** of the field,
//!   e.g. `reinforcements[2].pullout.coverage debe estar en (0, 1], no 1.5`. A length 0 is reported on the element
//!   itself (`reinforcements[i]`); the vertical sheet pile, on `reinforcements[i].x2`. The version gate
//!   (`reinforcements requiere version "0.4"`) is in `loads::validate_document`, next to the v0.3 one.
//! - [`crossing_nodes`] and [`apply_to_slices`] are called by `lib.rs` **only when `model.reinforcements` is not
//!   empty**, so a model without reinforcements goes through exactly the code of v0.2.0 (identity byte for byte, E14a).
//!   [`notes`] derives the informative notes from the forces they return.
//!
//! Flow that `lib.rs` follows for each surface (the search repeats it for every candidate, E14d.4, with no change of
//! signature of any existing function):
//! 1. `crossing_nodes` gives the abscissae `x_c ± 1e-6·width` of every crossing of a reinforcement with the surface;
//!    `LoadCase::with_extra_breaks` adds them to the cut, so the force acts on a thin slice centred on `x_c` and the arm
//!    of its vertical component about the midpoint of the base is 0 (like a line load, E12f);
//! 2. the surface is sliced with that load case;
//! 3. `apply_to_slices` adds the forces to the slices (active ones to `weight_extra`, `h_force`, `h_moment_base` and
//!    `driving_extra`, E14f; passive ones to the `passive_*` fields, E14g) and returns the forces of the report.
//!
//! Algorithm of the crossings (E14d.1): the segment `head → tip` against the lower arc of the circle (the line is
//! reduced to its closest point to the centre and the half chord `√(r² − d²)`, so no cancellation) or against each
//! segment of the fitted polyline; a crossing at an end of the element, within `1e-9·scale`, does not count; one at a
//! vertex of the polyline counts once, and not at all if the element only touches the vertex. A circle that the line
//! enters less than `1e-6·width` deep (a tangency) gives no crossing (E14o-1). The normal `n` and the movement `m` are
//! those of the surface **at the crossing** (the radius of the circle, the segment of the polyline), not the `alpha`
//! of the thin slice that receives the force. The station is `s_c = t_c·L`. The thin slice that receives the force is the
//! first soil slice from the toe whose closed interval contains `x_c` (`1e-9·width`): with the nodes of
//! `crossing_nodes` it is the one centred on `x_c`. A crossing that cannot apply a force and that is decided before
//! slicing (over the ground, no capacity, a passive element that the sliding compresses) adds no nodes (E14o-11).
//!
//! Pile with `lateral_pressure` (v0.5, E15i): the force is not given but comes from the pressure of the soil between
//! the piles (Ito and Matsui 1975, equations 13, 14 and 23, with the floor of `φ = 0` of cSlope and XSLOPE). The
//! profile `F(z) = ∫p dz`, `Q(z) = ∫p·z dz` of each such pile is built **once per analysis** ([`PileProfiles`]); at a
//! crossing, `F(zf)` and the arm `L_m = (zf·F − Q)/F` of the resultant above it give the force, capped by the shear and
//! the bending capacity (`min(F, shear, moment/L_m)`), at the arm `L_m` over the crossing with `centroid` and at the
//! crossing with `slip_surface`. The report adds `soil_force`, `governs` and `arm` to those crossings only, and the
//! note `ito_matsui_spacing_range` goes with `S/D` outside 2 to 8. Without such a pile the code is the one of v0.4
//! (identity byte for byte). R12 (E15l-11 to E15l-13): a profile with a node that is not finite is the `InvalidModel`
//! error of [`PileProfiles::try_with_step`]; in a material with `ru`, `σ′v = σv − ru·σ_soil` (no `u` of the
//! piezometric line, like the slicer); `Q(zf)` takes the fraction of `F(zf)`, so `0 < L_m ≤ zf − z_top`.
//!
//! Capacity (E14c, E14m-2): `bond` and `interface` integrate `r` **exactly** along the element (piecewise linear
//! between the cuts at the ground, the contacts and the water, and where `σ′v` changes sign); `development` is the
//! closed ramp; without `pullout`, `T = Tmax/spacing`. Direction and compression: E14m-1 (see `apply_to_slices`).

use crate::OgsError;
use crate::geometry::{PreparedModel, Sliding};
use crate::loads::LINE_TOUCH_FRACTION;
use crate::model::{
    Application, Pile, PileCapacity, PileDirection, PileLocation, Point, Pullout, Reinforcement,
    TensionDirection, TensionElement,
};
use crate::report::{ForceStatus, Governs, ReinforcementForce};
use crate::slicer::Slice;
use crate::surface::Surface;

/// Informative note (E14d): no crossing of a reinforcement applies a force on the reported surface.
pub const REINFORCEMENT_OUTSIDE_MASS: &str = "reinforcement_outside_mass";
/// Informative note (E14e): a passive reinforcement would be compressed by the sliding and gives no force.
pub const REINFORCEMENT_COMPRESSION_IGNORED: &str = "reinforcement_compression_ignored";
/// Informative note (E14h): the model has a `pile` or a `sheet_pile`, crossed or not.
pub const STRUCTURAL_CHECKS_NOT_COVERED: &str = "structural_checks_not_covered";

/// Informative note (E14o-8): an active tension element is applied with its full force although the sliding would
/// compress it (`along ≥ cos 88°`); with `φ > 0` its normal component confines the base and can raise the FS.
pub const REINFORCEMENT_ACTIVE_COMPRESSION: &str = "reinforcement_active_compression";

/// Offset of the nodes around a crossing, relative to the model width (E14d.2): `x_c ± 1e-6 · width`.
pub const CROSSING_BREAK_FRACTION: f64 = 1e-6;

/// A pile with `lateral_pressure` is vertical if `|x2 − x1| ≤ 1e-9·L` (E15i-1).
pub const VERTICAL_TOLERANCE: f64 = 1e-9;

/// Tangency tolerance of a circle (E14o-1), relative to the model width: an element that enters the circle less than
/// `1e-6 · width` deep (the sagitta `r − |perp|`, the same scale as the nodes around a crossing, so the whole
/// sliver would fit in one thin slice) only touches it, and its two crossings are discarded.
pub const TANGENCY_FRACTION: f64 = 1e-6;

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
                check_pile_source(&path, p, length)?;
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

/// `force` or `lateral_pressure`, exactly one (E15i-1), and the rules of `lateral_pressure` and `capacity`, with the
/// JSON path of each field: `diameter` finite and > 0, a vertical pile (`|x2 − x1| ≤ 1e-9·L`), `spacing > diameter`,
/// and a `capacity` that is not empty, with `shear` and `moment` finite and > 0 and only with `lateral_pressure`.
fn check_pile_source(path: &str, p: &Pile, length: f64) -> Result<(), OgsError> {
    match (&p.force, &p.lateral_pressure) {
        (Some(_), Some(_)) => {
            return Err(invalid(format!(
                "{path}: force y lateral_pressure se excluyen; el pilote debe tener exactamente uno"
            )));
        }
        (None, None) => {
            return Err(invalid(format!(
                "{path}.force: el pilote necesita force o lateral_pressure (exactamente uno)"
            )));
        }
        (Some(force), None) => {
            non_negative(&format!("{path}.force"), *force)?;
            if p.capacity.is_some() {
                return Err(invalid(format!(
                    "{path}.capacity solo se admite junto con lateral_pressure"
                )));
            }
            return Ok(());
        }
        (None, Some(_)) => {}
    }
    let lp = p
        .lateral_pressure
        .as_ref()
        .expect("lateral_pressure checked above");
    positive(&format!("{path}.lateral_pressure.diameter"), lp.diameter)?;
    if (p.x2 - p.x1).abs() > VERTICAL_TOLERANCE * length {
        return Err(invalid(format!(
            "{path}.x2 debe ser igual a x1 (lateral_pressure exige un pilote vertical), no {} frente a {}",
            p.x2, p.x1
        )));
    }
    let spacing = p.spacing.unwrap_or(1.0);
    if spacing.is_finite() && spacing <= lp.diameter {
        return Err(invalid(format!(
            "{path}.spacing debe ser mayor que lateral_pressure.diameter {}, no {spacing}",
            lp.diameter
        )));
    }
    if let Some(cap) = &p.capacity {
        if cap.shear.is_none() && cap.moment.is_none() {
            return Err(invalid(format!(
                "{path}.capacity debe tener shear, moment o ambos"
            )));
        }
        for (name, v) in [("shear", cap.shear), ("moment", cap.moment)] {
            if let Some(v) = v {
                positive(&format!("{path}.capacity.{name}"), v)?;
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

// ------------------------------------------------------------------------------------------------ crossings

/// A crossing of the segment of a reinforcement with the slip surface: the station `s` from the head (`s = t·L`), the
/// point `(x, y)` and the inclination `alpha` of the surface **at that point** (E14o-1), with the sign convention of
/// `Slice::alpha` (positive when the base rises toward the crest).
#[derive(Debug, Clone, Copy, PartialEq)]
struct Crossing {
    s: f64,
    x: f64,
    y: f64,
    alpha: f64,
}

/// What `crossings` needs of the model: the geometric tolerance, the tangency tolerance of a circle and the sign of
/// `alpha` (`+1` when the crest is on the right, `Sliding::RightToLeft`).
#[derive(Debug, Clone, Copy)]
struct CrossingRule {
    tol: f64,
    tangency: f64,
    sign: f64,
}

impl CrossingRule {
    fn new(pm: &PreparedModel) -> Self {
        let width = pm.x_max - pm.x_min;
        CrossingRule {
            tol: pm.tol(),
            tangency: TANGENCY_FRACTION * width,
            sign: match pm.sliding {
                Sliding::RightToLeft => 1.0,
                Sliding::LeftToRight => -1.0,
            },
        }
    }
}

/// Crossings of the segment `head → tip` (length `len`) with the **fitted** surface, from the head, E14d.1 and E14o-1:
/// - circle: the intersections with the lower arc (`y ≤ yc`), **only if the element penetrates the circle**: a line
///   whose sagitta `r − |perp|` is at most `rule.tangency` touches it and gives no crossing (a tangency would put the
///   two crossings in the same thin slice and apply the full capacity twice, or once with the sign of a rounding);
///   `alpha` is the one of the radius through the crossing;
/// - polyline: the intersections with each of its segments (a crossing at a vertex is counted once, and **not at all**
///   if the element only touches the vertex, with both neighbours on the same side of it); `alpha` is the one of
///   the segment.
///
/// A crossing at an end of the element (`s ≤ tol` or `len − s ≤ tol`) does not count.
fn crossings(
    head: Point,
    tip: Point,
    len: f64,
    surface: &Surface,
    rule: CrossingRule,
) -> Vec<Crossing> {
    let tol = rule.tol;
    let (dx, dy) = (tip[0] - head[0], tip[1] - head[1]);
    let (ux, uy) = (dx / len, dy / len);
    let mut out: Vec<Crossing> = Vec::new();
    let mut push = |s: f64, alpha: f64| {
        if s > tol && s < len - tol {
            out.push(Crossing {
                s,
                x: head[0] + s * ux,
                y: head[1] + s * uy,
                alpha,
            });
        }
    };
    match surface {
        Surface::Circle(c) => {
            // Closest point of the line to the centre, at `proj` along the element, `perp` away from it.
            let (fx, fy) = (c.xc - head[0], c.yc - head[1]);
            let proj = fx * ux + fy * uy;
            let perp = fx * uy - fy * ux;
            let h2 = c.r * c.r - perp * perp;
            if c.r - perp.abs() > rule.tangency && h2 > 0.0 {
                let h = h2.sqrt();
                for s in [proj - h, proj + h] {
                    let y = head[1] + s * uy;
                    if y <= c.yc + tol {
                        // The lower arc `y = yc − √(r² − (x − xc)²)` has slope `(x − xc)/(yc − y)`.
                        let x = head[0] + s * ux;
                        let alpha = rule.sign * (x - c.xc).atan2((c.yc - y).max(0.0));
                        push(s, alpha);
                    }
                }
            }
        }
        Surface::Polyline(poly) => {
            let pts = &poly.points;
            // Side of a point of the polyline with respect to the line of the element.
            let side = |p: Point| ux * (p[1] - head[1]) - uy * (p[0] - head[0]);
            for (i, w) in pts.windows(2).enumerate() {
                let (c, d) = (w[0], w[1]);
                let (sx, sy) = (d[0] - c[0], d[1] - c[1]);
                let den = dx * sy - dy * sx;
                if den == 0.0 {
                    continue;
                }
                let (cx, cy) = (c[0] - head[0], c[1] - head[1]);
                let t = (cx * sy - cy * sx) / den;
                let u = (cx * dy - cy * dx) / den;
                if !(-1e-12..=1.0 + 1e-12).contains(&u) {
                    continue;
                }
                // The neighbours of the vertex that the element passes through, if it does.
                let neighbours = if u <= 1e-12 && i > 0 {
                    Some((pts[i - 1], pts[i + 1]))
                } else if u >= 1.0 - 1e-12 && i + 2 < pts.len() {
                    Some((pts[i], pts[i + 2]))
                } else {
                    None
                };
                if let Some((before, after)) = neighbours
                    && side(before) * side(after) > 0.0
                {
                    continue; // touches the vertex without crossing the surface
                }
                push(t * len, rule.sign * (sy / sx).atan());
            }
        }
    }
    out.sort_by(|a, b| a.s.total_cmp(&b.s));
    // A crossing at a vertex of the polyline is found on both segments.
    out.dedup_by(|b, a| (b.s - a.s).abs() <= tol);
    out
}

/// Whether a crossing is on the ground (E14o-11): the point of the surface is at most `tol` under the terrain, or
/// above it, or outside the model. No soil slice carries its force, so it is `outside_mass` without slicing.
fn on_ground(pm: &PreparedModel, c: &Crossing, tol: f64) -> bool {
    match pm.top_at(c.x) {
        Some(top) => c.y >= top - tol,
        None => true,
    }
}

/// The abscissae to add to the cut of `surface` (the surface already fitted to the ground): for every crossing
/// `(x_c, y_c)` of a reinforcement with the surface (E14d.1; a crossing at an end of the element, within the
/// tolerance, does not count; a tangency does not count either, E14o-1), the two nodes
/// `x_c ± CROSSING_BREAK_FRACTION · width`.
///
/// **No node** is added for a crossing that cannot apply a force and that is decided before slicing (E14o-11): one on
/// the ground, one with no capacity (`available = 0`) and a passive tension element that the sliding compresses. So
/// the cut, and the FS, are exactly those of the slope without reinforcement.
///
/// Called by `lib.rs` for each surface (and each search candidate) when `reinforcements` is not empty; the result goes
/// to `LoadCase::with_extra_breaks` before slicing, so the force acts on a thin slice centred on `x_c` and the arm of
/// its vertical component about the midpoint of the base is 0 (like a line load, E12f). A surface that no element
/// crosses gives no node, and the slicing is the one of always.
pub fn crossing_nodes(
    reinforcements: &[Reinforcement],
    pm: &PreparedModel,
    surface: &Surface,
) -> Vec<f64> {
    crossing_nodes_with(
        reinforcements,
        pm,
        surface,
        &PileProfiles::new(reinforcements, pm),
    )
}

/// [`crossing_nodes`] with the profiles of pressure of the piles with `lateral_pressure`, built once per analysis by
/// [`PileProfiles::new`] (E15i-3): the search calls it for each candidate, and only the depth of the crossing changes.
pub fn crossing_nodes_with(
    reinforcements: &[Reinforcement],
    pm: &PreparedModel,
    surface: &Surface,
    profiles: &PileProfiles,
) -> Vec<f64> {
    let d = CROSSING_BREAK_FRACTION * (pm.x_max - pm.x_min);
    let rule = CrossingRule::new(pm);
    let s_dir = -rule.sign;
    let mut xs = Vec::new();
    for (i, r) in reinforcements.iter().enumerate() {
        let (head, tip) = r.ends();
        let len = r.length();
        let found = crossings(head, tip, len, surface, rule);
        if found.is_empty() {
            continue;
        }
        let a = [(tip[0] - head[0]) / len, (tip[1] - head[1]) / len];
        let mut profile = LazyProfile::new(profiles.get(i));
        for c in &found {
            if on_ground(pm, c, rule.tol) {
                continue;
            }
            if r.application() == Application::Passive
                && is_tension(r)
                && Frame::at(a, c.alpha, s_dir).along >= near_normal()
            {
                continue;
            }
            if profile.available(pm, r, head, tip, len, c) <= 0.0 {
                continue;
            }
            xs.push(c.x - d);
            xs.push(c.x + d);
        }
    }
    xs
}

/// The profile of `bond` and `interface` of an element, built the first time that a capacity needs it (the
/// profile does not depend on the surface, only on the element and the ground). A pile with `lateral_pressure` brings
/// its profile of pressure, built once per analysis by [`PileProfiles`] (E15i-3).
struct LazyProfile<'a> {
    built: Option<Option<RateProfile>>,
    pressure: Option<&'a PileProfile>,
}

impl<'a> LazyProfile<'a> {
    fn new(pressure: Option<&'a PileProfile>) -> Self {
        LazyProfile {
            built: None,
            pressure,
        }
    }

    /// `T(s)` per metre of slope, or the force of a pile or a sheet pile, at the crossing `c` of `r`; and, for a pile
    /// with `lateral_pressure`, the detail of its force (E15i-4).
    fn evaluate(
        &mut self,
        pm: &PreparedModel,
        r: &Reinforcement,
        head: Point,
        tip: Point,
        len: f64,
        c: &Crossing,
    ) -> (f64, Option<PileForce>) {
        match r {
            Reinforcement::Anchor(el)
            | Reinforcement::Nail(el)
            | Reinforcement::Geosynthetic(el) => {
                if el.tensile_capacity <= 0.0 {
                    return (0.0, None);
                }
                let profile = self
                    .built
                    .get_or_insert_with(|| rate_profile(pm, el, head, tip, len));
                (tension_capacity(el, len, c.s, profile.as_ref()), None)
            }
            Reinforcement::Pile(p) => match (p.lateral_pressure.as_ref(), self.pressure) {
                (Some(_), Some(profile)) => {
                    let force = profile.force_at(c.y);
                    (force.per_pile / profile.spacing, Some(force))
                }
                // `lateral_pressure` on a pile outside the model: no soil, no force.
                (Some(_), None) => (0.0, None),
                (None, _) => (p.force.unwrap_or(0.0) / p.spacing.unwrap_or(1.0), None),
            },
            Reinforcement::SheetPile(p) => (p.force, None),
        }
    }

    fn available(
        &mut self,
        pm: &PreparedModel,
        r: &Reinforcement,
        head: Point,
        tip: Point,
        len: f64,
        c: &Crossing,
    ) -> f64 {
        self.evaluate(pm, r, head, tip, len, c).0
    }
}

// ------------------------------------------------------------------------------------------------ capacity

/// Resistance per metre of slope along the element, piecewise linear, for `bond` and `interface` (E14m-2): the
/// pieces are `(s_a, s_b, r_a, r_b)` with `r` linear between `s_a` and `s_b`, `0` where the element is not in soil.
struct RateProfile {
    pieces: Vec<[f64; 4]>,
}

impl RateProfile {
    /// `∫₀ˢ r dσ`, exact.
    fn upto(&self, s: f64) -> f64 {
        let mut acc = 0.0;
        for &[sa, sb, ra, rb] in &self.pieces {
            if s >= sb {
                acc += 0.5 * (ra + rb) * (sb - sa);
            } else if s > sa {
                let r = ra + (rb - ra) * (s - sa) / (sb - sa);
                acc += 0.5 * (ra + r) * (s - sa);
                break;
            } else {
                break;
            }
        }
        acc
    }

    fn total(&self) -> f64 {
        self.pieces
            .iter()
            .map(|&[sa, sb, ra, rb]| 0.5 * (ra + rb) * (sb - sa))
            .sum()
    }
}

/// Parameter `t` on `a → b` of the crossing with the segment `c → d` (`None` if parallel or if they do not meet).
fn segment_t(a: Point, b: Point, c: Point, d: Point) -> Option<f64> {
    let (r, s) = ([b[0] - a[0], b[1] - a[1]], [d[0] - c[0], d[1] - c[1]]);
    let den = r[0] * s[1] - r[1] * s[0];
    if den == 0.0 {
        return None;
    }
    let ca = [c[0] - a[0], c[1] - a[1]];
    let t = (ca[0] * s[1] - ca[1] * s[0]) / den;
    let u = (ca[0] * r[1] - ca[1] * r[0]) / den;
    let range = -1e-12..=1.0 + 1e-12;
    (range.contains(&t) && range.contains(&u)).then_some(t)
}

/// The piezometric line extended flat to the ends of the model, like `PreparedModel::piezometric_y`.
fn extended_piezometric(pm: &PreparedModel) -> Option<Vec<Point>> {
    let line = pm.piezometric.as_ref()?;
    let mut pts = Vec::with_capacity(line.len() + 2);
    let (first, last) = (line[0], line[line.len() - 1]);
    if first[0] > pm.x_min {
        pts.push([pm.x_min, first[1]]);
    }
    pts.extend(line.iter().copied());
    if last[0] < pm.x_max {
        pts.push([pm.x_max, last[1]]);
    }
    Some(pts)
}

/// Vertical effective stress `σ′v` before the clamp at 0 (E14m-2, E14o-4, E14o-5), at the point `(x, y)` of the soil;
/// `None` if the point is not in soil. `σ` is the soil column over the point (with `γsat` under the water line of the
/// material). `u` follows the precedence of the slicer: a material with `ru` has `u = ru·σ_soil` and takes **no** water
/// from the piezometric line (neither the water under the ground nor the free water over it); a material without `ru`
/// takes the piezometric line, and the free water over the ground counts. On a contact between two materials (within
/// `tol` in `y` for a horizontal one, in `x` for a vertical one) it is the **smaller** value of the two, whatever the
/// order of `regions`. Loads are not included.
fn effective_vertical_stress(
    pm: &PreparedModel,
    x: f64,
    y: f64,
    column: &mut Vec<(f64, f64, usize)>,
    scratch: &mut Vec<f64>,
) -> Option<f64> {
    // E14o-5: on a vertical contact (x within `tol` of a vertex abscissa) both sides count, and the smaller `σ′v`
    // is taken (the conservative one, like E13l-5). A model edge has only its inner side.
    let tol = pm.tol();
    if pm.vertex_xs.iter().any(|&v| (v - x).abs() <= tol) {
        let eps = 4.0 * tol;
        let left = effective_vertical_stress_at(pm, x - eps, y, column, scratch);
        let right = effective_vertical_stress_at(pm, x + eps, y, column, scratch);
        return match (left, right) {
            (Some(a), Some(b)) => Some(a.min(b)),
            (a, b) => a.or(b),
        };
    }
    effective_vertical_stress_at(pm, x, y, column, scratch)
}

/// `σ′v` on one vertical line `x` (not on a vertex abscissa). If `y` is within `tol` of a **horizontal** contact
/// between two materials (E14o-5), it is the smaller of the stresses of the two materials: the total stress is the
/// same, only `u` differs (`ru` of the material, E14o-4). Order of `regions` does not matter.
fn effective_vertical_stress_at(
    pm: &PreparedModel,
    x: f64,
    y: f64,
    column: &mut Vec<(f64, f64, usize)>,
    scratch: &mut Vec<f64>,
) -> Option<f64> {
    let tol = pm.tol();
    pm.column(x, column, scratch);
    let top = pm.top_at(x)?;
    let piezo = pm.piezometric_y(x);
    let mut sigma_soil = 0.0;
    for &(lo, hi, mat) in column.iter() {
        let (lo_c, hi_c) = (lo.max(y), hi.min(top));
        if hi_c <= lo_c {
            continue;
        }
        let m = &pm.materials[mat];
        sigma_soil += match (m.unit_weight_sat, piezo) {
            (Some(gs), Some(z)) => {
                let below = (hi_c.min(z) - lo_c).max(0.0);
                gs * below + m.unit_weight * ((hi_c - lo_c) - below)
            }
            _ => m.unit_weight * (hi_c - lo_c),
        };
    }
    let free_water = piezo.map_or(0.0, |z| pm.gamma_w * (z - top).max(0.0));
    let mut found: Option<f64> = None;
    for &(lo, hi, mat) in column.iter() {
        if !(lo - tol <= y && y <= hi + tol) {
            continue;
        }
        // E14o-4, the precedence of the slicer: a material with `ru` has `u = ru·σ` and takes no water from the
        // piezometric line (neither the one under the ground nor the free water over it); the others take both.
        let sigma_v = match pm.materials[mat].ru {
            Some(ru) => sigma_soil - ru * sigma_soil,
            None => {
                let u = piezo.map_or(0.0, |z| pm.gamma_w * (z - y).max(0.0));
                sigma_soil + free_water - u
            }
        };
        found = Some(found.map_or(sigma_v, |f: f64| f.min(sigma_v)));
    }
    found
}

/// Builds the profile of the resistance of `bond` and `interface` along the element, with the **exact** integral
/// (E14m-2): the element is cut at every crossing with the edges of the regions (the ground and the contacts), at the
/// vertices of the model and at the water line, so `σ′v` is linear on each piece (it is sampled at ¼ and ¾ of it), and
/// the piece is cut again where `σ′v` changes sign. The oracle discretises in 200 steps instead.
///
/// `None` for the models that have no profile (`development`, no `pullout`).
fn rate_profile(
    pm: &PreparedModel,
    el: &TensionElement,
    head: Point,
    tip: Point,
    len: f64,
) -> Option<RateProfile> {
    let (strength_rate, bonded_from, interface) = match el.pullout.as_ref()? {
        Pullout::Bond {
            strength,
            bonded_length,
        } => (
            strength / el.spacing.unwrap_or(1.0),
            bonded_length.map_or(0.0, |l| len - l),
            None,
        ),
        Pullout::Interface {
            adhesion,
            friction_angle,
            coverage,
        } => (
            0.0,
            0.0,
            Some((
                2.0 * adhesion * coverage,
                2.0 * coverage * friction_angle.to_radians().tan(),
            )),
        ),
        Pullout::Development { .. } => return None,
    };
    let (dx, dy) = (tip[0] - head[0], tip[1] - head[1]);
    let piezo = if interface.is_some() {
        extended_piezometric(pm)
    } else {
        None
    };

    // Breakpoints `t` in (0, 1).
    let mut ts: Vec<f64> = vec![0.0, 1.0];
    let mut add = |t: f64| {
        if t > 0.0 && t < 1.0 {
            ts.push(t);
        }
    };
    if dx != 0.0 {
        for &x in &pm.vertex_xs {
            add((x - head[0]) / dx);
        }
        if let Some(line) = &piezo {
            for p in line {
                add((p[0] - head[0]) / dx);
            }
            // The water line against the edges: where the column changes between "over" and "under" the water.
            for w in line.windows(2) {
                for e in &pm.edges {
                    if let Some(x) =
                        segment_t(w[0], w[1], e[0], e[1]).map(|t| w[0][0] + t * (w[1][0] - w[0][0]))
                    {
                        add((x - head[0]) / dx);
                    }
                }
            }
        }
    }
    for e in &pm.edges {
        if let Some(t) = segment_t(head, tip, e[0], e[1]) {
            add(t);
        }
    }
    if let Some(line) = &piezo {
        for w in line.windows(2) {
            if let Some(t) = segment_t(head, tip, w[0], w[1]) {
                add(t);
            }
        }
    }
    if bonded_from > 0.0 {
        add(bonded_from / len);
    }
    ts.sort_by(f64::total_cmp);
    ts.dedup_by(|b, a| (*b - *a).abs() <= 1e-13);

    let tol = pm.tol();
    let mut column = Vec::with_capacity(8);
    let mut scratch = Vec::with_capacity(8);
    let at = |t: f64| (head[0] + t * dx, head[1] + t * dy);
    let mut pieces: Vec<[f64; 4]> = Vec::with_capacity(ts.len());
    for w in ts.windows(2) {
        let (ta, tb) = (w[0], w[1]);
        let (sa, sb) = (ta * len, tb * len);
        let (xm, ym) = at(0.5 * (ta + tb));
        pm.column(xm, &mut column, &mut scratch);
        let in_soil = column
            .iter()
            .any(|&(lo, hi, _)| lo - tol <= ym && ym <= hi + tol);
        if !in_soil {
            continue;
        }
        match interface {
            None => {
                // Bond: only the part bonded (the last `bonded_length` metres toward the tip).
                if 0.5 * (sa + sb) >= bonded_from {
                    pieces.push([sa, sb, strength_rate, strength_rate]);
                }
            }
            Some((c0, c1)) => {
                let (t1, t2) = (ta + 0.25 * (tb - ta), ta + 0.75 * (tb - ta));
                let sample = |t: f64, column: &mut Vec<_>, scratch: &mut Vec<_>| {
                    let (x, y) = at(t);
                    effective_vertical_stress(pm, x, y, column, scratch)
                };
                let (Some(g1), Some(g2)) = (
                    sample(t1, &mut column, &mut scratch),
                    sample(t2, &mut column, &mut scratch),
                ) else {
                    continue;
                };
                // σ′v is the line through (t1, g1) and (t2, g2): its values at the ends of the piece.
                let slope = (g2 - g1) / (t2 - t1);
                let (ga, gb) = (g1 + slope * (ta - t1), g1 + slope * (tb - t1));
                let rate = |g: f64| c0 + c1 * g.max(0.0);
                if (ga >= 0.0) == (gb >= 0.0) {
                    pieces.push([sa, sb, rate(ga), rate(gb)]);
                } else {
                    // Sign change: cut where σ′v = 0.
                    let sc = sa + (sb - sa) * ga / (ga - gb);
                    pieces.push([sa, sc, rate(ga), rate(0.0)]);
                    pieces.push([sc, sb, rate(0.0), rate(gb)]);
                }
            }
        }
    }
    Some(RateProfile { pieces })
}

/// `T(s)` per metre of slope of a tension element at the station `s` from the head (E14c, E14m-2):
/// - without `pullout`: `Tmax / spacing`;
/// - `bond` and `interface`: `min(Tmax, T1 + ∫₀ˢ r, T2 + ∫ₛᴸ r) / spacing`, with `profile` already per metre of slope;
/// - `development`: `min(Tmax, T1 + Tmax·s/ℓ1, T2 + Tmax·(L − s)/ℓ2) / spacing` (ℓ = 0 is +∞).
fn tension_capacity(el: &TensionElement, len: f64, s: f64, profile: Option<&RateProfile>) -> f64 {
    let sp = el.spacing.unwrap_or(1.0);
    let tmax = el.tensile_capacity;
    let t1 = el.end1_capacity.unwrap_or(0.0);
    let t2 = el.end2_capacity.unwrap_or(0.0);
    let t = match (&el.pullout, profile) {
        (Some(Pullout::Development { length1, length2 }), _) => {
            let f1 = if *length1 > 0.0 {
                t1 + tmax * s / length1
            } else {
                f64::INFINITY
            };
            let f2 = if *length2 > 0.0 {
                t2 + tmax * (len - s) / length2
            } else {
                f64::INFINITY
            };
            tmax.min(f1).min(f2) / sp
        }
        (Some(_), Some(p)) => {
            let before = p.upto(s);
            let after = p.total() - before;
            (tmax / sp).min(t1 / sp + before).min(t2 / sp + after)
        }
        _ => tmax / sp,
    };
    t.max(0.0)
}

// ------------------------------------------------------------------------------------------------ forces

/// `cos 88°`: a passive element whose `along` is at least this one is compressed (more than 2° past the normal to
/// the base, Clouterre 1991 and FHWA GEC 7), E14m-1.
fn near_normal() -> f64 {
    88f64.to_radians().cos()
}

fn dot(a: [f64; 2], b: [f64; 2]) -> f64 {
    a[0] * b[0] + a[1] * b[1]
}

/// `anchor`, `nail` and `geosynthetic`: the elements with the compression rule (E14m-1).
fn is_tension(r: &Reinforcement) -> bool {
    matches!(
        r,
        Reinforcement::Anchor(_) | Reinforcement::Nail(_) | Reinforcement::Geosynthetic(_)
    )
}

/// The frame of a crossing (E14m-1, E14o-1), from the inclination `alpha` of the surface **at the crossing**:
/// `m` the movement of the base, `n` its normal toward the mass, `d` the unit vector of the part of the element under
/// the surface (toward the stable side) and `along = d·m`.
struct Frame {
    m: [f64; 2],
    d: [f64; 2],
    along: f64,
}

impl Frame {
    /// `a` is the unit axis of the element from the head, `s_dir` is `+1` if the sliding goes toward `+x`.
    fn at(a: [f64; 2], alpha: f64, s_dir: f64) -> Self {
        let (sin_a, cos_a) = alpha.sin_cos();
        let m = [s_dir * cos_a, -sin_a];
        let n = [s_dir * sin_a, cos_a];
        let d = if dot(a, n) > 0.0 { [-a[0], -a[1]] } else { a };
        Frame {
            m,
            d,
            along: dot(d, m),
        }
    }
}

/// Direction `u` of the force on the mass of a tension element (E14m-1), and whether the element is compressed.
/// `d` is the unit vector of the part of the element under the surface, `m` the movement of the base.
fn tension_direction(direction: TensionDirection, d: [f64; 2], m: [f64; 2]) -> [f64; 2] {
    if dot(d, m) > 0.0 {
        return d;
    }
    match direction {
        TensionDirection::Axial => d,
        TensionDirection::Tangent => [-m[0], -m[1]],
        TensionDirection::Bisector => {
            let v = [d[0] - m[0], d[1] - m[1]];
            let n = v[0].hypot(v[1]);
            [v[0] / n, v[1] / n]
        }
    }
}

/// Direction of the force of a pile or a sheet pile (E14m-1): always against the movement, with no compression rule.
/// `s` is `+1` if the sliding goes toward `+x`; `a` the unit axis of the element.
fn pile_direction(
    direction: PileDirection,
    angle: Option<f64>,
    s: f64,
    a: [f64; 2],
    m: [f64; 2],
) -> [f64; 2] {
    match direction {
        PileDirection::Angle => {
            let ang = angle.unwrap_or(0.0).to_radians();
            [-s * ang.cos(), ang.sin()]
        }
        PileDirection::Tangent => [-m[0], -m[1]],
        PileDirection::Perpendicular => {
            let mut v = [-a[1], a[0]];
            let along = dot(v, m);
            if along > 0.0 || (along == 0.0 && v[1] < 0.0) {
                v = [-v[0], -v[1]];
            }
            v
        }
    }
}

/// Index of the soil slice that takes a force at `x`: the first one from the toe whose closed interval contains `x`
/// within the tolerance (E14d.2; on a shared boundary, the toe side). `None` for the air and for what is outside the
/// analysed block.
fn slice_at(slices: &[Slice], x: f64, touch: f64) -> Option<usize> {
    slices
        .iter()
        .position(|s| s.weight > 0.0 && s.x_left - touch <= x && x <= s.x_right + touch)
}

/// Adds the forces of the reinforcements to `slices`, which were cut with the nodes of [`crossing_nodes`] on the same
/// `surface`, and returns one [`ReinforcementForce`] per crossing, in the order `(reinforcement, crossing from the
/// head)` (E14d, E14f, E14g, E14h, E14i).
///
/// - `reinforcements`: `model.reinforcements`, already validated and not empty;
/// - `pm`: the prepared model (sliding direction `pm.sliding`, tolerance `pm.tol()`, ground);
/// - `surface`: the fitted surface of the slices (a circle gives the moment arm `(yc, r)` of Bishop);
/// - `slices`: they are modified. With `s = +1` if the sliding goes toward `+x` and `P = (Px, Py)` the force on the
///   mass at `(x_c, y_c)` (model coordinates, `y` upward), an **active** force adds `−Py` to `weight_extra`, `s·Px`
///   to `h_force`, `s·Px·(y_c − y_base_mid)` to `h_moment_base` and (circle) `s·Px·(yc − y_c)/R` to `driving_extra`
///   (E14f); a **passive** one adds the same four terms to `passive_v`, `passive_h`, `passive_h_moment_base` and
///   `passive_driving_extra`, **before** dividing by `F` (the methods divide, E14g). The seismic force and the loads
///   do not act on them.
/// - a crossing on the ground (E14o-11), on an air slice or in a discarded block applies nothing and returns
///   `OutsideMass`; a passive tension
///   element that the sliding compresses, `CompressionIgnored`; a capacity `T(s_c) = 0`, `NoCapacity`.
///
/// It returns the forces for any surface; `lib.rs` keeps them in the report only for a converged method. The notes
/// are derived by [`notes`].
pub fn apply_to_slices(
    reinforcements: &[Reinforcement],
    pm: &PreparedModel,
    surface: &Surface,
    slices: &mut [Slice],
) -> Vec<ReinforcementForce> {
    apply_with_state(reinforcements, pm, surface, slices).0
}

/// [`apply_to_slices`], and whether some **active** tension element was applied with its force although the sliding
/// compresses it (`along ≥ cos 88°`, E14o-8): `lib.rs` turns it into the note `reinforcement_active_compression`
/// through [`notes_with`].
pub fn apply_with_state(
    reinforcements: &[Reinforcement],
    pm: &PreparedModel,
    surface: &Surface,
    slices: &mut [Slice],
) -> (Vec<ReinforcementForce>, bool) {
    apply_with_state_using(
        reinforcements,
        pm,
        surface,
        slices,
        &PileProfiles::new(reinforcements, pm),
    )
}

/// [`apply_to_slices`] with the profiles of pressure built once per analysis (see [`crossing_nodes_with`]).
pub fn apply_to_slices_with(
    reinforcements: &[Reinforcement],
    pm: &PreparedModel,
    surface: &Surface,
    slices: &mut [Slice],
    profiles: &PileProfiles,
) -> Vec<ReinforcementForce> {
    apply_with_state_using(reinforcements, pm, surface, slices, profiles).0
}

/// [`apply_with_state`] with the profiles of pressure built once per analysis (see [`crossing_nodes_with`]).
pub fn apply_with_state_using(
    reinforcements: &[Reinforcement],
    pm: &PreparedModel,
    surface: &Surface,
    slices: &mut [Slice],
    profiles: &PileProfiles,
) -> (Vec<ReinforcementForce>, bool) {
    let rule = CrossingRule::new(pm);
    let s_dir = -rule.sign;
    let touch = LINE_TOUCH_FRACTION * (pm.x_max - pm.x_min);
    let arm = surface.moment_arm();
    let compressed_from = near_normal();
    let mut out = Vec::new();
    let mut active_compressed = false;
    for (index, r) in reinforcements.iter().enumerate() {
        let (head, tip) = r.ends();
        let len = r.length();
        let found = crossings(head, tip, len, surface, rule);
        if found.is_empty() {
            continue;
        }
        let a = [(tip[0] - head[0]) / len, (tip[1] - head[1]) / len];
        let application = r.application();
        // The profile of `bond` and `interface` is built once per element, and only if it crosses.
        let mut profile = LazyProfile::new(profiles.get(index));
        for (crossing, c) in found.iter().enumerate() {
            let (available, pile_force) = profile.evaluate(pm, r, head, tip, len, c);
            let mut force = ReinforcementForce {
                id: r.id().to_string(),
                crossing,
                x: c.x,
                y: c.y,
                station: c.s,
                available,
                fx: 0.0,
                fy: 0.0,
                application,
                status: ForceStatus::OutsideMass,
                soil_force: pile_force.map(|f| f.soil_per_pile / f.spacing),
                governs: pile_force.map(|f| f.governs),
                arm: pile_force.map(|f| f.arm),
            };
            // On the ground there is no soil slice to take the force, and `crossing_nodes` added no nodes (E14o-11).
            if on_ground(pm, c, rule.tol) {
                out.push(force);
                continue;
            }
            let Some(k) = slice_at(slices, c.x, touch) else {
                out.push(force);
                continue;
            };
            // Movement `m` of the base and its normal `n` toward the mass, **at the crossing** (E14m-1, E14o-1).
            let Frame { m, d, along } = Frame::at(a, c.alpha, s_dir);
            let u = match r {
                Reinforcement::Anchor(el)
                | Reinforcement::Nail(el)
                | Reinforcement::Geosynthetic(el) => {
                    if along >= compressed_from {
                        if application == Application::Passive {
                            force.status = ForceStatus::CompressionIgnored;
                            out.push(force);
                            continue;
                        }
                        // An active element is applied (a known external load), E14o-8.
                        active_compressed |= available > 0.0;
                    }
                    tension_direction(el.direction, d, m)
                }
                Reinforcement::Pile(p) => pile_direction(p.direction, p.angle, s_dir, a, m),
                Reinforcement::SheetPile(p) => pile_direction(p.direction, p.angle, s_dir, a, m),
            };
            if available <= 0.0 {
                force.status = ForceStatus::NoCapacity;
                out.push(force);
                continue;
            }
            let (px, py) = (available * u[0], available * u[1]);
            force.fx = px;
            force.fy = py;
            force.status = ForceStatus::Applied;
            let sl = &mut slices[k];
            sl.crossing = true; // E14n-1
            let y_base = 0.5 * (sl.y_base_left + sl.y_base_right);
            let h = s_dir * px;
            // E15i-5: with `centroid` the force of a pile with `lateral_pressure` acts on the axis of the pile at the
            // arm `L_m` of the resultant above the crossing; in every other case, at the crossing.
            let y_app = match (r, pile_force) {
                (Reinforcement::Pile(p), Some(f))
                    if f.arm > 0.0
                        && p.lateral_pressure.map(|lp| lp.location)
                            == Some(PileLocation::Centroid) =>
                {
                    c.y + f.arm
                }
                _ => c.y,
            };
            let (v, hm, de) = (
                -py,
                h * (y_app - y_base),
                arm.map_or(0.0, |(yc, rad)| h * (yc - y_app) / rad),
            );
            match application {
                Application::Active => {
                    sl.weight_extra += v;
                    sl.h_force += h;
                    sl.h_moment_base += hm;
                    sl.driving_extra += de;
                }
                Application::Passive => {
                    sl.passive_v += v;
                    sl.passive_h += h;
                    sl.passive_h_moment_base += hm;
                    sl.passive_driving_extra += de;
                }
            }
            out.push(force);
        }
    }
    (out, active_compressed)
}

/// The informative notes of a surface (E14d.3, E14e, E14h, E14o-8), from the forces of [`apply_to_slices`] on it, in
/// this order and without repetition:
/// - `reinforcement_outside_mass`: some reinforcement has no crossing, or all its crossings are outside the mass;
/// - `reinforcement_compression_ignored`: some crossing is `compression_ignored`;
/// - `reinforcement_active_compression`: `active_compressed` of [`apply_with_state`], an active element applied while
///   the sliding compresses it;
/// - `structural_checks_not_covered`: the model has a `pile` or a `sheet_pile`, crossed or not;
/// - `ito_matsui_spacing_range`: some pile with `lateral_pressure` has `S/D` outside 2 to 8 (E15i-8), crossed or not.
///
/// `no_capacity` raises no note (E14m-2).
pub fn notes_with(
    reinforcements: &[Reinforcement],
    forces: &[ReinforcementForce],
    active_compressed: bool,
) -> Vec<&'static str> {
    let mut out = Vec::new();
    let outside = reinforcements.iter().any(|r| {
        let mut own = forces.iter().filter(|f| f.id == r.id());
        own.all(|f| f.status == ForceStatus::OutsideMass)
    });
    if outside {
        out.push(REINFORCEMENT_OUTSIDE_MASS);
    }
    if forces
        .iter()
        .any(|f| f.status == ForceStatus::CompressionIgnored)
    {
        out.push(REINFORCEMENT_COMPRESSION_IGNORED);
    }
    if active_compressed {
        out.push(REINFORCEMENT_ACTIVE_COMPRESSION);
    }
    if reinforcements.iter().any(Reinforcement::is_pile) {
        out.push(STRUCTURAL_CHECKS_NOT_COVERED);
    }
    if ito_matsui_out_of_range(reinforcements) {
        out.push(ITO_MATSUI_SPACING_RANGE);
    }
    out
}

/// [`notes_with`] without the note of the active compressed element.
pub fn notes(reinforcements: &[Reinforcement], forces: &[ReinforcementForce]) -> Vec<&'static str> {
    notes_with(reinforcements, forces, false)
}

// ------------------------------------------------------------------------------------------------ Ito-Matsui

/// Note (E15i-8): `S/D` of a pile with `lateral_pressure` outside 2 to 8, where the formula loses validity.
pub const ITO_MATSUI_SPACING_RANGE: &str = "ito_matsui_spacing_range";

/// Range of `S/D` of the formula of Ito and Matsui (E15i-8): below 2 it overestimates the force, above 8 it
/// underestimates it (Ukritchon and Keawsawasvong 2017).
pub const ITO_MATSUI_SD_RANGE: (f64, f64) = (2.0, 8.0);

/// Step of the grid of the profile of pressure (E15i-3): 0.05 m, or its equivalent in feet in an imperial model.
const PRESSURE_STEP_M: f64 = 0.05;

/// The step of the grid of the profile of pressure in the length unit of the model (`units`): 0.05 m, or 0.05 m in
/// feet (`0.164 ft`) in an imperial model (E15i-3, E15m-8).
pub fn pressure_step(units: Option<&str>) -> f64 {
    // E15m-8: the same detection as the default `γw` (`is_imperial_units`: `"imp"`, case and leading spaces).
    if crate::model::is_imperial_units(units) {
        PRESSURE_STEP_M / 0.3048
    } else {
        PRESSURE_STEP_M
    }
}

/// `φ` under which the formula of `φ = 0` and the total stress are used (E15i-2): 0.01°, as cSlope.
const PHI_ZERO_DEG: f64 = 0.01;

/// `(A1, A2)` of `p(z) = c·A1 + σ′v·A2`, force per pile per unit of depth, from the equations 13 and 14 of Ito and
/// Matsui (1975) with `φ > 0` and the equation 23 with `φ = 0`, **without** the floor of `φ = 0`. `spacing` is
/// `S = D1` of the paper (between axes), `d` the diameter, `D2 = S − d`, `Nφ = tan²(45° + φ/2)` and
/// `X = √Nφ·tanφ + Nφ − 1`:
///
/// ```text
/// A2 = (S·(S/D2)^X·exp[(d/D2)·Nφ·tanφ·tan(π/8 + φ/4)] − D2) / Nφ
/// A1 = S·(S/D2)^X·[(E − 2√Nφ·tanφ − 1)/(Nφ·tanφ) + G] − S·G + 2·D2/√Nφ,   G = (2tanφ + 2√Nφ + Nφ^-½)/X
/// φ = 0:  A1 = S·(3·ln(S/D2) + (d/D2)·tan(π/8)) − 2d,  A2 = d
/// ```
fn ito_matsui_paper(spacing: f64, d: f64, phi_deg: f64) -> (f64, f64) {
    let (s, d2) = (spacing, spacing - d);
    if phi_deg < PHI_ZERO_DEG {
        let tan_pi8 = (std::f64::consts::FRAC_PI_8).tan();
        return (s * (3.0 * (s / d2).ln() + d / d2 * tan_pi8) - 2.0 * d, d);
    }
    let phi = phi_deg.to_radians();
    let n = (std::f64::consts::FRAC_PI_4 + 0.5 * phi).tan().powi(2);
    let (sn, tp) = (n.sqrt(), phi.tan());
    let x = sn * tp + n - 1.0;
    let ratio = (s / d2).powf(x);
    let e = (d / d2 * n * tp * (std::f64::consts::FRAC_PI_8 + 0.25 * phi).tan()).exp();
    let g = (2.0 * tp + 2.0 * sn + 1.0 / sn) / x;
    let a1 = s * ratio * ((e - 2.0 * sn * tp - 1.0) / (n * tp) + g) - (s * g - 2.0 * d2 / sn);
    let a2 = (s * ratio * e - d2) / n;
    (a1, a2)
}

/// `(A1, A2)` of the pressure of Ito and Matsui (E15i-2): the equations 13, 14 and 23 of the paper with the **floor of
/// `φ = 0`**, `A = max(A_cφ, A_φ=0)`. The floor is not in the paper: it is the rule of cSlope and XSLOPE; it keeps the
/// force from dropping when `φ` grows and only acts with `S/D ≥ 8` (X22 §1.3). `spacing > d`.
pub fn ito_matsui_coefficients(spacing: f64, d: f64, phi_deg: f64) -> (f64, f64) {
    let (a1, a2) = ito_matsui_paper(spacing, d, phi_deg);
    if phi_deg < PHI_ZERO_DEG {
        return (a1, a2);
    }
    let (b1, b2) = ito_matsui_paper(spacing, d, 0.0);
    // `f64::max` ignores a `NaN`: a coefficient that is not finite goes out as it is, so E15l-11 can see it.
    let floor = |a: f64, b: f64| if a.is_finite() { a.max(b) } else { a };
    (floor(a1, b1), floor(a2, b2))
}

/// `S/D` outside 2 to 8 of some pile with `lateral_pressure` (E15i-8): the model gets the note
/// [`ITO_MATSUI_SPACING_RANGE`], crossed or not.
pub fn ito_matsui_out_of_range(reinforcements: &[Reinforcement]) -> bool {
    reinforcements.iter().any(|r| match r {
        Reinforcement::Pile(p) => p.lateral_pressure.is_some_and(|lp| {
            let ratio = p.spacing.unwrap_or(1.0) / lp.diameter;
            ratio < ITO_MATSUI_SD_RANGE.0 || ratio > ITO_MATSUI_SD_RANGE.1
        }),
        _ => false,
    })
}

/// The force of a pile with `lateral_pressure` at one crossing (E15i-4), per pile unless it says otherwise.
#[derive(Debug, Clone, Copy, PartialEq)]
struct PileForce {
    /// `∫p dz` from the head (or the ground) to the crossing, before the caps.
    soil_per_pile: f64,
    /// `min(∫p dz, shear, moment / L_m)`.
    per_pile: f64,
    /// `L_m`, the arm of the resultant above the crossing; 0 if there is no pressure.
    arm: f64,
    governs: Governs,
    spacing: f64,
}

/// Profile of the pressure of the soil on one pile with `lateral_pressure`, from the head (or the ground) down to the
/// tip, integrated **once per analysis** (the pressure does not depend on the surface, E15i-3): the depth `z` under
/// the ground, `F(z) = ∫p dz` and `Q(z) = ∫p·z dz` at the nodes of the grid, with the rule of the midpoint and a step
/// of at most 0.05 m. The force at a crossing is `F(zf)` by linear interpolation between nodes, and the arm of the
/// resultant above it `L_m = (zf·F − Q)/F`, with `Q(zf) = Q[k−1] + (F(zf) − F[k−1])·(z[k−1] + zf)/2` (E15l-13).
#[derive(Debug, Clone)]
pub struct PileProfile {
    z: Vec<f64>,
    f: Vec<f64>,
    q: Vec<f64>,
    ground: f64,
    spacing: f64,
    capacity: Option<PileCapacity>,
    /// `φ` (degrees) at the first node whose `p`, `F` or `Q` is not finite (E15l-11); `None` if the profile is finite.
    non_finite_phi: Option<f64>,
}

impl PileProfile {
    /// The force at the crossing at height `y_c` (E15i-3, E15i-4).
    fn force_at(&self, y_c: f64) -> PileForce {
        self.force_at_depth(self.ground - y_c)
    }

    /// [`PileProfile::force_at`] at the depth `zf` under the ground.
    fn force_at_depth(&self, zf: f64) -> PileForce {
        let none = PileForce {
            soil_per_pile: 0.0,
            per_pile: 0.0,
            arm: 0.0,
            governs: Governs::Soil,
            spacing: self.spacing,
        };
        // `zf ≤ z_top`: the crossing is over the head of the pile (or over the ground), no force.
        if zf.partial_cmp(&self.z[0]) != Some(std::cmp::Ordering::Greater) {
            return none;
        }
        let last = self.z.len() - 1;
        let mut k = 1;
        while k < last && self.z[k] < zf {
            k += 1;
        }
        let span = self.z[k] - self.z[k - 1];
        let t = if span > 0.0 {
            ((zf - self.z[k - 1]) / span).min(1.0)
        } else {
            1.0
        };
        let soil = self.f[k - 1] + t * (self.f[k] - self.f[k - 1]);
        if soil <= 0.0 {
            return none;
        }
        // E15l-13: `F` is linear between nodes (as in cSlope) and `Q` takes the same fraction: the increment of the
        // force `F(zf) − F[k−1]` acts at the midpoint of `[z[k−1], zf]`. So `0 < L_m ≤ zf − z_top` whenever
        // `zf > z_top`, and the moment capacity applies whenever there is a force.
        let q = self.q[k - 1] + (soil - self.f[k - 1]) * 0.5 * (self.z[k - 1] + zf);
        // E15m-7: `(zf·F − Q)/F` written as `zf − Q/F`: `zf·F` overflowed to `∞` with a finite `F` near `f64::MAX`.
        let arm = (zf - q / soil).max(0.0);
        let (mut per_pile, mut governs) = (soil, Governs::Soil);
        if let Some(cap) = &self.capacity {
            if let Some(shear) = cap.shear
                && shear < per_pile
            {
                (per_pile, governs) = (shear, Governs::Shear);
            }
            if let Some(m) = cap.moment
                && arm > 0.0
                && m / arm < per_pile
            {
                (per_pile, governs) = (m / arm, Governs::Bending);
            }
        }
        PileForce {
            soil_per_pile: soil,
            per_pile,
            arm,
            governs,
            spacing: self.spacing,
        }
    }
}

/// The profiles of pressure of the piles with `lateral_pressure`, one per reinforcement (`None` for the others and for
/// a pile outside the ground of the model). Built once per analysis by `lib.rs` and passed to
/// [`crossing_nodes_with`] and [`apply_with_state_using`] for every candidate; without such a pile it is empty and
/// costs nothing.
#[derive(Debug, Clone, Default)]
pub struct PileProfiles {
    by_reinforcement: Vec<Option<PileProfile>>,
}

impl PileProfiles {
    /// With the grid of 0.05 m (a model in SI units).
    pub fn new(reinforcements: &[Reinforcement], pm: &PreparedModel) -> Self {
        Self::with_step(reinforcements, pm, PRESSURE_STEP_M)
    }

    /// With the step of the grid in the length unit of the model: [`pressure_step`] of its `units`.
    pub fn with_step(reinforcements: &[Reinforcement], pm: &PreparedModel, step: f64) -> Self {
        let by_reinforcement = reinforcements
            .iter()
            .map(|r| match r {
                Reinforcement::Pile(p) if p.lateral_pressure.is_some() => {
                    build_profile(pm, p, step)
                }
                _ => None,
            })
            .collect();
        PileProfiles { by_reinforcement }
    }

    /// [`PileProfiles::with_step`] that refuses a profile that is not finite (E15l-11): if a node of `p`, `F` or `Q`
    /// of a pile is `NaN` or `±∞` (the equations 13 and 14 overflow when `S/D` gets close to 1 or `φ` is high), the
    /// analysis ends with the `InvalidModel` error below, before any solver runs:
    ///
    /// ```text
    /// reinforcements[i].lateral_pressure: la presión de Ito-Matsui no es finita con S/D = {S/D} y φ = {φ}° (las
    /// ecuaciones 13 y 14 desbordan cuando S/D se acerca a 1); aumente spacing
    /// ```
    ///
    /// `lib.rs` builds the profiles of an analysis with this function.
    pub fn try_with_step(
        reinforcements: &[Reinforcement],
        pm: &PreparedModel,
        step: f64,
    ) -> Result<Self, OgsError> {
        let profiles = Self::with_step(reinforcements, pm, step);
        for (i, (r, profile)) in reinforcements
            .iter()
            .zip(&profiles.by_reinforcement)
            .enumerate()
        {
            let (Reinforcement::Pile(p), Some(profile)) = (r, profile) else {
                continue;
            };
            let (Some(phi), Some(lp)) = (profile.non_finite_phi, p.lateral_pressure) else {
                continue;
            };
            let ratio = p.spacing.unwrap_or(1.0) / lp.diameter;
            return Err(OgsError::InvalidModel(format!(
                "reinforcements[{i}].lateral_pressure: la presión de Ito-Matsui no es finita con S/D = {} y φ = {}° \
(las ecuaciones 13 y 14 desbordan cuando S/D se acerca a 1); aumente spacing",
                short(ratio),
                short(phi)
            )));
        }
        Ok(profiles)
    }

    fn get(&self, i: usize) -> Option<&PileProfile> {
        self.by_reinforcement.get(i).and_then(Option::as_ref)
    }
}

/// A number for a message: up to 6 decimals, without trailing zeros (`1.00125`, `35`).
fn short(x: f64) -> String {
    let text = format!("{x:.6}");
    text.trim_end_matches('0').trim_end_matches('.').to_string()
}

/// The material, its strength and the vertical stress on the column `x` at a height `y`: `p(y)` of E15i-2 and E15i-3
/// and the `φ` (degrees) of that point, or `None` if there is no soil at that point. `p` is **not** checked: it can be
/// `NaN` or `∞` (E15l-11 is checked by [`build_profile`]).
fn pressure_at(
    pm: &PreparedModel,
    x: f64,
    y: f64,
    spacing: f64,
    diameter: f64,
    column: &mut Vec<(f64, f64, usize)>,
    scratch: &mut Vec<f64>,
) -> Option<(f64, f64)> {
    pm.column(x, column, scratch);
    let top = pm.top_at(x)?;
    let tol = pm.tol();
    let &(_, _, mat_index) = column
        .iter()
        .find(|&&(lo, hi, _)| lo - tol <= y && y <= hi + tol)?;
    let piezo = pm.piezometric_y(x);
    let mut sigma_soil = 0.0;
    for &(lo, hi, mat) in column.iter() {
        let (lo_c, hi_c) = (lo.max(y), hi.min(top));
        if hi_c <= lo_c {
            continue;
        }
        let m = &pm.materials[mat];
        sigma_soil += match (m.unit_weight_sat, piezo) {
            (Some(gs), Some(z)) => {
                let below = (hi_c.min(z) - lo_c).max(0.0);
                gs * below + m.unit_weight * ((hi_c - lo_c) - below)
            }
            _ => m.unit_weight * (hi_c - lo_c),
        };
    }
    // The ponded water over the ground adds its weight to `σv` (E15c, E15i-3); loads do not.
    let sigma_total = sigma_soil + piezo.map_or(0.0, |z| pm.gamma_w * (z - top).max(0.0));
    let material = &pm.materials[mat_index];
    let (c, tan_phi) = crate::strength::resolve(material, y);
    let phi_deg = tan_phi.atan().to_degrees();
    let (a1, a2) = ito_matsui_coefficients(spacing, diameter, phi_deg);
    // φ < 0.01° (or undrained): the equation 23 with the **total** stress. Otherwise the effective stress, with the
    // precedence of the slicer (E15l-12, E14o-4): a material with `ru` has `u = ru·σ_soil` and takes **no** `u` from
    // the piezometric line, `σ′v = σv − ru·σ_soil`; the others take `σ′v = σv − u`.
    let sigma = if phi_deg < PHI_ZERO_DEG {
        sigma_total
    } else if let Some(ru) = material.ru {
        (sigma_total - ru * sigma_soil).max(0.0)
    } else {
        let u = piezo.map_or(0.0, |z| pm.gamma_w * (z - y).max(0.0));
        (sigma_total - u).max(0.0)
    };
    Some((c * a1 + sigma * a2, phi_deg))
}

/// The profile of a pile with `lateral_pressure` (E15i-3). `None` if the pile is outside the ground of the model.
fn build_profile(pm: &PreparedModel, pile: &Pile, step: f64) -> Option<PileProfile> {
    let lp = pile.lateral_pressure?;
    let (x, spacing, d) = (pile.x1, pile.spacing.unwrap_or(1.0), lp.diameter);
    let ground = pm.top_at(x)?;
    let (head, tip) = (pile.y1.max(pile.y2), pile.y1.min(pile.y2));
    let z_top = (ground - head).max(0.0);
    let z_tip = (ground - tip).max(z_top);
    let n = (((z_tip - z_top) / step).ceil() as usize).max(1);
    let dz = (z_tip - z_top) / n as f64;
    // On a vertical contact (`x` on the abscissa of a vertex) both sides count and the smaller pressure is taken
    // (the conservative one, like E14o-5); a model edge has only its inner side.
    let tol = pm.tol();
    let xs: Vec<f64> = if pm.vertex_xs.iter().any(|&v| (v - x).abs() <= tol) {
        vec![x - 4.0 * tol, x + 4.0 * tol]
    } else {
        vec![x]
    };
    let mut column = Vec::with_capacity(8);
    let mut scratch = Vec::with_capacity(8);
    let (mut z, mut f, mut q) = (vec![z_top], vec![0.0], vec![0.0]);
    let mut non_finite_phi = None;
    for k in 0..n {
        let zm = z_top + (k as f64 + 0.5) * dz;
        let y = ground - zm;
        // The smaller pressure of the sides (the conservative one); a pressure that is not finite is kept as it is
        // (`f64::min` would drop a `NaN`, E15l-11). No soil on either side: no pressure.
        let mut best: Option<(f64, f64)> = None;
        for &xe in &xs {
            let Some((pe, phi_e)) = pressure_at(pm, xe, y, spacing, d, &mut column, &mut scratch)
            else {
                continue;
            };
            if !pe.is_finite() {
                best = Some((pe, phi_e));
                break;
            }
            if best.is_none_or(|(p, _)| pe < p) {
                best = Some((pe, phi_e));
            }
        }
        let (p, phi) = best.unwrap_or((0.0, 0.0));
        z.push(z_top + (k as f64 + 1.0) * dz);
        f.push(f[k] + p * dz);
        q.push(q[k] + p * zm * dz);
        if non_finite_phi.is_none()
            && !(p.is_finite() && f[k + 1].is_finite() && q[k + 1].is_finite())
        {
            non_finite_phi = Some(phi);
        }
    }
    let mut profile = PileProfile {
        z,
        f,
        q,
        ground,
        spacing,
        capacity: pile.capacity,
        non_finite_phi,
    };
    // E15m-7, E15n-2: a profile whose nodes are finite can still give a force, an arm or an `available` that are not
    // finite at a crossing (the force per pile divided by `spacing`, the soil force per pile divided by `spacing`, which
    // is the `soil_force` that is serialized, the arm of the resultant). The force of a crossing is
    // bounded by its values at the nodes, so they are tried here and the error of E15l-11 is raised before solving.
    if profile.non_finite_phi.is_none() {
        let tried = (1..profile.z.len()).find(|&k| {
            let force = profile.force_at_depth(profile.z[k]);
            !(force.soil_per_pile.is_finite()
                && force.arm.is_finite()
                && (force.per_pile / spacing).is_finite()
                && (force.soil_per_pile / spacing).is_finite())
        });
        if let Some(k) = tried {
            profile.non_finite_phi = Some(phi_at_node(
                pm,
                x,
                ground - profile.z[k],
                spacing,
                d,
                &mut column,
                &mut scratch,
            ));
        }
    }
    Some(profile)
}

/// `φ` (degrees) of the soil at `(x, y)`, for the message of E15l-11 (`0` if there is no soil there).
fn phi_at_node(
    pm: &PreparedModel,
    x: f64,
    y: f64,
    spacing: f64,
    diameter: f64,
    column: &mut Vec<(f64, f64, usize)>,
    scratch: &mut Vec<f64>,
) -> f64 {
    pressure_at(pm, x, y, spacing, diameter, column, scratch).map_or(0.0, |(_, phi)| phi)
}
