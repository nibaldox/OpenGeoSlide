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
//! vertex of the polyline counts once. The station is `s_c = t_c·L`. The thin slice that receives the force is the
//! first soil slice from the toe whose closed interval contains `x_c` (`1e-9·width`): with the nodes of
//! `crossing_nodes` it is the one centred on `x_c`.
//!
//! Capacity (E14c, E14m-2): `bond` and `interface` integrate `r` **exactly** along the element (piecewise linear
//! between the cuts at the ground, the contacts and the water, and where `σ′v` changes sign); `development` is the
//! closed ramp; without `pullout`, `T = Tmax/spacing`. Direction and compression: E14m-1 (see `apply_to_slices`).

use crate::OgsError;
use crate::geometry::{PreparedModel, Sliding};
use crate::loads::LINE_TOUCH_FRACTION;
use crate::model::{
    Application, PileDirection, Point, Pullout, Reinforcement, TensionDirection, TensionElement,
};
use crate::report::{ForceStatus, ReinforcementForce};
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

// ------------------------------------------------------------------------------------------------ crossings

/// A crossing of the segment of a reinforcement with the slip surface: the station `s` from the head (`s = t·L`) and
/// the point `(x, y)`.
#[derive(Debug, Clone, Copy, PartialEq)]
struct Crossing {
    s: f64,
    x: f64,
    y: f64,
}

/// Crossings of the segment `head → tip` (length `len`) with the **fitted** surface, from the head, E14d.1:
/// - circle: the intersections with the lower arc (`y ≤ yc`);
/// - polyline: the intersections with each of its segments (a crossing at a vertex is counted once).
///
/// A crossing at an end of the element (`s ≤ tol` or `len − s ≤ tol`) does not count. `tol` is the model tolerance.
fn crossings(head: Point, tip: Point, len: f64, surface: &Surface, tol: f64) -> Vec<Crossing> {
    let (dx, dy) = (tip[0] - head[0], tip[1] - head[1]);
    let (ux, uy) = (dx / len, dy / len);
    let mut out: Vec<Crossing> = Vec::new();
    let mut push = |s: f64| {
        if s > tol && s < len - tol {
            out.push(Crossing {
                s,
                x: head[0] + s * ux,
                y: head[1] + s * uy,
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
            if h2 >= 0.0 {
                let h = h2.sqrt();
                for s in [proj - h, proj + h] {
                    let y = head[1] + s * uy;
                    if y <= c.yc + tol {
                        push(s);
                    }
                }
            }
        }
        Surface::Polyline(poly) => {
            for w in poly.points.windows(2) {
                let (c, d) = (w[0], w[1]);
                let (sx, sy) = (d[0] - c[0], d[1] - c[1]);
                let den = dx * sy - dy * sx;
                if den == 0.0 {
                    continue;
                }
                let (cx, cy) = (c[0] - head[0], c[1] - head[1]);
                let t = (cx * sy - cy * sx) / den;
                let u = (cx * dy - cy * dx) / den;
                if (-1e-12..=1.0 + 1e-12).contains(&u) {
                    push(t * len);
                }
            }
        }
    }
    out.sort_by(|a, b| a.s.total_cmp(&b.s));
    // A crossing at a vertex of the polyline is found on both segments.
    out.dedup_by(|b, a| (b.s - a.s).abs() <= tol);
    out
}

/// The abscissae to add to the cut of `surface` (the surface already fitted to the ground): for every crossing
/// `(x_c, y_c)` of a reinforcement with the surface (E14d.1; a crossing at an end of the element, within the
/// tolerance, does not count), the two nodes `x_c ± CROSSING_BREAK_FRACTION · width`.
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
    let d = CROSSING_BREAK_FRACTION * (pm.x_max - pm.x_min);
    let tol = pm.tol();
    let mut xs = Vec::new();
    for r in reinforcements {
        let (head, tip) = r.ends();
        for c in crossings(head, tip, r.length(), surface, tol) {
            xs.push(c.x - d);
            xs.push(c.x + d);
        }
    }
    xs
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

/// Vertical effective stress `σ′v` before the clamp at 0 (E14m-2), at the point `(x, y)` of the soil; `None` if the
/// point is not in soil. `σ` is the soil column over the point (with `γsat` under the water line of the material),
/// plus the free water over the ground; `u` follows the rule of the slicer (`ru·σ` if the material has `ru`, else the
/// piezometric line). Loads are not included.
fn effective_vertical_stress(
    pm: &PreparedModel,
    x: f64,
    y: f64,
    column: &mut Vec<(f64, f64, usize)>,
    scratch: &mut Vec<f64>,
) -> Option<f64> {
    let tol = pm.tol();
    pm.column(x, column, scratch);
    let here = column
        .iter()
        .find(|&&(lo, hi, _)| lo - tol <= y && y <= hi + tol)?;
    let material = &pm.materials[here.2];
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
    let u = if let Some(ru) = material.ru {
        ru * sigma_soil
    } else {
        piezo.map_or(0.0, |z| pm.gamma_w * (z - y).max(0.0))
    };
    Some(sigma_soil + free_water - u)
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
/// - a crossing on an air slice or a discarded block applies nothing and returns `OutsideMass`; a passive tension
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
    let s_dir = match pm.sliding {
        Sliding::LeftToRight => 1.0,
        Sliding::RightToLeft => -1.0,
    };
    let tol = pm.tol();
    let touch = LINE_TOUCH_FRACTION * (pm.x_max - pm.x_min);
    let arm = surface.moment_arm();
    let compressed_from = near_normal();
    let mut out = Vec::new();
    for r in reinforcements {
        let (head, tip) = r.ends();
        let len = r.length();
        let found = crossings(head, tip, len, surface, tol);
        if found.is_empty() {
            continue;
        }
        let a = [(tip[0] - head[0]) / len, (tip[1] - head[1]) / len];
        let application = r.application();
        // The profile of `bond` and `interface` is built once per element, and only if it crosses.
        let profile = match r {
            Reinforcement::Anchor(el)
            | Reinforcement::Nail(el)
            | Reinforcement::Geosynthetic(el) => rate_profile(pm, el, head, tip, len),
            _ => None,
        };
        for (crossing, c) in found.iter().enumerate() {
            let available = match r {
                Reinforcement::Anchor(el)
                | Reinforcement::Nail(el)
                | Reinforcement::Geosynthetic(el) => {
                    tension_capacity(el, len, c.s, profile.as_ref())
                }
                Reinforcement::Pile(p) => p.force / p.spacing.unwrap_or(1.0),
                Reinforcement::SheetPile(p) => p.force,
            };
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
            };
            let Some(k) = slice_at(slices, c.x, touch) else {
                out.push(force);
                continue;
            };
            // Movement `m` of the base and its normal `n` toward the mass (E14m-1).
            let (sin_a, cos_a) = slices[k].alpha.sin_cos();
            let m = [s_dir * cos_a, -sin_a];
            let n = [s_dir * sin_a, cos_a];
            // `d`: the part of the element under the surface, toward the stable side.
            let d = if dot(a, n) > 0.0 { [-a[0], -a[1]] } else { a };
            let along = dot(d, m);
            let u = match r {
                Reinforcement::Anchor(el)
                | Reinforcement::Nail(el)
                | Reinforcement::Geosynthetic(el) => {
                    if application == Application::Passive && along >= compressed_from {
                        force.status = ForceStatus::CompressionIgnored;
                        out.push(force);
                        continue;
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
            let (v, hm, de) = (
                -py,
                h * (c.y - y_base),
                arm.map_or(0.0, |(yc, rad)| h * (yc - c.y) / rad),
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
    out
}

/// The informative notes of a surface (E14d.3, E14e, E14h), from the forces of [`apply_to_slices`] on it, in this
/// order and without repetition:
/// - `reinforcement_outside_mass`: some reinforcement has no crossing, or all its crossings are outside the mass;
/// - `reinforcement_compression_ignored`: some crossing is `compression_ignored`;
/// - `structural_checks_not_covered`: the model has a `pile` or a `sheet_pile`, crossed or not.
///
/// `no_capacity` raises no note (E14m-2).
pub fn notes(reinforcements: &[Reinforcement], forces: &[ReinforcementForce]) -> Vec<&'static str> {
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
    if reinforcements.iter().any(Reinforcement::is_pile) {
        out.push(STRUCTURAL_CHECKS_NOT_COVERED);
    }
    out
}
