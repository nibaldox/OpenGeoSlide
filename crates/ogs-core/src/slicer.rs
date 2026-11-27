//! Slicing of a slip surface into slices (§4.1): a circle, or a fixed polyline already fitted to the ground (F3.3).
//!
//! The slicer works on a [`Surface`]. On a circle every step is the code of before the polyline, with the same
//! arithmetic, so the slices do not change by a bit. On a polyline:
//! - its vertices are obligatory nodes of the cut, so the base of each slice is a straight stretch of the surface,
//!   with `alpha`, `base_length` and `y_base_*` exact;
//! - `driving_extra` is 0 in every slice, and so is the part of `h_moment_base` that depends on a centre: a polyline
//!   has no centre, Bishop is not offered on it (F3.6), and the methods that remain take moments about the midpoints
//!   of the bases;
//! - the guards of the block and of the method are the same ones: E2 (air slices), E10a (`truncated_mass`), E11
//!   (re-slicing of the kept block, minimum soil slices) and the checks of the ends.

use serde::Serialize;

use crate::geometry::{PreparedModel, Sliding};
use crate::loads::{LINE_TOUCH_FRACTION, LoadCase};
use crate::model::Circle;
use crate::surface::Surface;

/// One slice, in the ORIGINAL model frame.
///
/// Sign convention: `alpha` is positive when the base rises toward the crest (driving component `W·sin α > 0`).
///
/// Air slices (contract §4.1.8, E2) have their base on or above the ground: `weight`, `cohesion`,
/// `tan_phi` and `pore_pressure` are exactly zero, and they contribute no driving or resisting force.
///
/// Seismic force and surface loads (amendment E12b) are resolved by the slicer into `weight_extra`, `h_force`,
/// `h_moment_base`, `driving_extra` and `y_centroid`; the passive reinforcements (E14g) go into the `passive_*` fields. `weight`
/// stays the soil weight `W` and keeps its meaning. They are all zero in an air slice and in any model without
/// `kh`, `kv` or loads.
///
/// Adjacent slices share an edge (`slices[k].x_right == slices[k + 1].x_left`) **except** after the removal of a hairline
/// of air (E15j-8, `drop_hairline_air`): there the two soil neighbours of the removed run stay as they are, and a hole
/// of at most `1e-6 · width` (`HAIRLINE_WIDTH_FRACTION`) may be left between them (E15l-9). It carries no weight,
/// strength or water; a consumer that walks the slices and needs them contiguous must allow for it.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Slice {
    pub x_left: f64,
    pub x_right: f64,
    pub y_base_left: f64,
    pub y_base_right: f64,
    /// Ground elevation at `x_mid`.
    pub y_top_mid: f64,
    /// Slice width `b > 0`.
    pub width: f64,
    /// Base inclination in radians.
    pub alpha: f64,
    /// `b / cos α`.
    pub base_length: f64,
    /// Weight per metre of width.
    pub weight: f64,
    /// Cohesion of the base material.
    pub cohesion: f64,
    /// `tan φ` of the base material.
    pub tan_phi: f64,
    /// Pore pressure at the midpoint of the base.
    pub pore_pressure: f64,
    /// Index into `Model.materials`.
    pub material: usize,
    /// Vertical force added to the soil weight, downward: `kv·W + Q + V` (E12b). `Q` is the distributed load on the
    /// slice and `V` the vertical part of the line loads. The vertical force of the slice is `W* = weight + this`.
    pub weight_extra: f64,
    /// Horizontal force in the sliding direction: `H = kh·W + H^P` (E12b), with `H^P = s·p·sin θ` of the line loads.
    pub h_force: f64,
    /// Moment of `H` about the midpoint of the base: `kh·W·(ȳ − y_b) + Σ H^P·(y_g − y_b)` (E12b, Spencer).
    pub h_moment_base: f64,
    /// Contribution of `H` to the driving moment about the circle centre, divided by the radius:
    /// `M = [kh·W·(yc − ȳ) + Σ H^P·(yc − y_g)] / R` (E12b, Bishop).
    pub driving_extra: f64,
    /// Ordinate `ȳ` of the weight-weighted centroid of the soil of the slice. It is computed only when `kh > 0`, and it
    /// is `0` otherwise (it is not used then).
    pub y_centroid: f64,
    /// Vertical force of the passive reinforcements, downward and **before** dividing by `F` (E14g): each method
    /// evaluates `W* + passive_v / F`. Zero without reinforcements, and then it is not serialized.
    #[serde(skip_serializing_if = "is_zero")]
    pub passive_v: f64,
    /// Horizontal force of the passive reinforcements in the sliding direction, before dividing by `F` (E14g).
    #[serde(skip_serializing_if = "is_zero")]
    pub passive_h: f64,
    /// Moment of `passive_h` about the midpoint of the base, before dividing by `F` (E14g, Spencer and M-P).
    #[serde(skip_serializing_if = "is_zero")]
    pub passive_h_moment_base: f64,
    /// Contribution of `passive_h` to the driving moment about the circle centre, divided by the radius and before
    /// dividing by `F` (E14g, Bishop).
    #[serde(skip_serializing_if = "is_zero")]
    pub passive_driving_extra: f64,
    /// E14n-1: this slice carries the force of a reinforcement crossing (`reinforcement::apply_to_slices` sets it on the
    /// thin slice `x_c ± 1e-6·width` that receives the force). It is only read by the classification of the negative
    /// effective normal forces, which adds it to the two slices around it; it does not enter any equilibrium. It is
    /// never serialized, so the report is the same.
    #[serde(skip)]
    pub crossing: bool,
}

/// `skip_serializing_if` of the passive fields: they are 0 without reinforcements, and the slices are part of the
/// JSON report, which must not change by a byte (E14a).
fn is_zero(v: &f64) -> bool {
    *v == 0.0
}

impl Slice {
    /// Vertical force of the slice, `W* = W·(1 + kv) + Q + V` (E12b).
    #[inline]
    pub fn total_weight(&self) -> f64 {
        self.weight + self.weight_extra
    }

    /// Driving term of the slice in Bishop's denominator, `W*·sin α + M` (E12b).
    #[inline]
    pub fn driving_term(&self) -> f64 {
        self.total_weight() * self.alpha.sin() + self.driving_extra
    }
}

/// A slice with every field zero: the base of the struct updates of the air and unsupported slices (no loads).
pub(crate) const ZERO_SLICE: Slice = Slice {
    x_left: 0.0,
    x_right: 0.0,
    y_base_left: 0.0,
    y_base_right: 0.0,
    y_top_mid: 0.0,
    width: 0.0,
    alpha: 0.0,
    base_length: 0.0,
    weight: 0.0,
    cohesion: 0.0,
    tan_phi: 0.0,
    pore_pressure: 0.0,
    material: 0,
    weight_extra: 0.0,
    h_force: 0.0,
    h_moment_base: 0.0,
    driving_extra: 0.0,
    y_centroid: 0.0,
    passive_v: 0.0,
    passive_h: 0.0,
    passive_h_moment_base: 0.0,
    passive_driving_extra: 0.0,
    crossing: false,
};

/// Reasons a circle cannot be sliced.
#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum SurfaceError {
    #[error("the circle does not intersect the ground")]
    NoIntersection,
    #[error("a required intersection lies on the upper half of the circle")]
    UpperArc,
    #[error("the sliding arc rises above the ground between entry and exit")]
    AboveGround,
    #[error("the sliding arc leaves the model")]
    OutsideModel,
    #[error("too few slices")]
    TooFewSlices,
    #[error("no material at the base of a slice")]
    NoMaterial,
}

/// Informative note (contract E10a, code `truncated_mass`): only the main soil block was analysed.
pub const TRUNCATED_MASS: &str = "truncated_mass";
/// Warning (contract E11e, code `truncated_driving_mass`): a discarded block is driving, so it may be a more critical
/// mechanism than the analysed one. Replaces `truncated_mass` when it applies.
pub const TRUNCATED_DRIVING_MASS: &str = "truncated_driving_mass";
/// A discarded block is driving when its `Σ W·sin α` exceeds this fraction of its own `Σ W` (contract E11e′).
const DRIVING_FRACTION: f64 = 1e-3;
/// The analysed block needs at least this many soil slices (contract E11d).
const MIN_SOIL_SLICES: usize = 3;
/// Hairline of the ground (E2′), in geometric tolerances (`tol = 1e-9 · scale`): an interior air run whose arc is at most
/// `HAIRLINE_TOLS · tol` above the ground is a touch, not a gap. It is far under the nodes that the search puts around a
/// vertex (`1e-6 · width`), so the circles of a search keep their slicing, and it covers a circle through a vertex that
/// misses it by a few ulps of the arithmetic of the circle (D30: 5 tol).
const HAIRLINE_TOLS: f64 = 10.0;
/// Longest hairline run, relative to the model width: a surface that runs along the ground over a length (a polyline on
/// the bottom of a notch, a circle tangent to a bench) is a real gap in the mass, not the touch of a vertex.
const HAIRLINE_WIDTH_FRACTION: f64 = 1e-6;

/// A sliced surface: the slices (toe first) and the informative notes raised while slicing.
#[derive(Debug, Clone, PartialEq)]
pub struct SlicedSurface {
    pub slices: Vec<Slice>,
    /// Stable note codes (contract E6). `"truncated_mass"` when the surface was truncated to its main block.
    pub notes: Vec<String>,
}

/// Soil blocks of a toe-first sequence: maximal runs of soil slices, as `(start, end)` with `end` exclusive.
/// `air[k]` tells whether slice `k` is an air slice.
fn soil_blocks(air: &[bool]) -> Vec<(usize, usize)> {
    let mut blocks = Vec::new();
    let mut k = 0;
    while k < air.len() {
        if air[k] {
            k += 1;
            continue;
        }
        let start = k;
        while k < air.len() && !air[k] {
            k += 1;
        }
        blocks.push((start, k));
    }
    blocks
}

/// Index range `[lo, hi)` of the main soil block of a toe-first sequence (E10a″): the block that contains the entry
/// point, on the crest side. `slices[last]` is the crest slice, and the sliding range ends on soil, so the entry block
/// is the last soil block in toe-first order. Its own weight does not matter, and no tie rule is needed. The other
/// blocks are dropped; air slices at the crest end are kept, since they touch the main block. `None` when there is at
/// most one soil block: nothing to remove.
pub(crate) fn main_block_range(air: &[bool]) -> Option<(usize, usize)> {
    let blocks = soil_blocks(air);
    if blocks.len() < 2 {
        return None;
    }
    let (start, _) = blocks[blocks.len() - 1];
    Some((start, air.len()))
}

/// Slices of a span in model order (left to right), before E10a.
pub(crate) struct Built {
    pub(crate) slices: Vec<Slice>,
    /// `true` for air slices (E2).
    pub(crate) air: Vec<bool>,
    /// `true` for soil slices whose base lies outside the model (no material). They are an error only when they
    /// stay in the analysed block (E10a′, see [`slice_surface`]).
    pub(crate) unsupported: Vec<bool>,
}

/// Sliding range of the lower arc: its two ground crossings, plus the arc breakpoints (contract §4.1, steps 1–3).
///
/// Only `NoIntersection` is raised here. The checks of the ends of the arc apply to the analysed block (E10a′,
/// [`check_block_ends`]), so a discarded block may leave the model through a side wall.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Tramo {
    /// Left crossing (smaller x).
    pub(crate) p: f64,
    /// Right crossing (larger x).
    pub(crate) q: f64,
    /// Lower-arc breakpoints over `[a, b]` (vertices, piezometric vertices and arc–edge crossings).
    pub(crate) breaks: Vec<f64>,
    /// Span of the arc inside the model: the circle's x-range clipped to the model's, `[a, b]`.
    pub(crate) a: f64,
    pub(crate) b: f64,
}

/// Finds the sliding range of the lower arc of `c`. See [`Tramo`].
pub(crate) fn sliding_span(pm: &PreparedModel, c: &Circle) -> Result<Tramo, SurfaceError> {
    if !(c.xc.is_finite() && c.yc.is_finite() && c.r.is_finite()) || c.r <= 0.0 {
        return Err(SurfaceError::NoIntersection);
    }
    let (ap, bp) = (c.xc - c.r, c.xc + c.r);
    let (a, b) = (ap.max(pm.x_min), bp.min(pm.x_max));
    if a >= b {
        return Err(SurfaceError::NoIntersection);
    }
    let (xs, under) = pm.arc_profile(c, true, a, b);
    // Maximal intervals where the arc is under the ground.
    let mut intervals: Vec<(f64, f64)> = Vec::new();
    let mut start: Option<f64> = None;
    for (i, &u) in under.iter().enumerate() {
        if u {
            start.get_or_insert(xs[i]);
        } else if let Some(s) = start.take() {
            intervals.push((s, xs[i]));
        }
    }
    if let Some(s) = start {
        intervals.push((s, xs[xs.len() - 1]));
    }
    // E2: the sliding range runs between the outermost ground crossings. The arc may rise above the
    // ground between them; those slices are air slices (see `slice_surface`).
    let (Some(&(p, _)), Some(&(_, q))) = (intervals.first(), intervals.last()) else {
        return Err(SurfaceError::NoIntersection);
    };
    Ok(Tramo {
        p,
        q,
        breaks: xs,
        a,
        b,
    })
}

/// Checks of the ends of the analysed arc span `[l, r]` (contract §4.1.3, E10a′): the whole sliding range, or the main
/// block when the surface was truncated. Errors:
/// - `OutsideModel` if the arc leaves the model under the ground through a side wall, or below the base;
/// - `UpperArc` / `NoIntersection` if an end of the span lies under the ground at a point that is not a crossing.
///
/// Discarded blocks are never checked, so their arc may leave the model.
pub(crate) fn check_block_ends(
    pm: &PreparedModel,
    surface: &Surface,
    t: &Tramo,
    l: f64,
    r: f64,
) -> Result<(), SurfaceError> {
    match surface {
        Surface::Circle(c) => check_block_ends_circle(pm, c, t, l, r),
        Surface::Polyline(_) => {
            // A fitted polyline starts and ends on the ground and stays inside the model in x, so only the model base
            // can be crossed: no side wall, no upper arc.
            let mut xs = Vec::with_capacity(t.breaks.len() + 2);
            xs.push(l);
            xs.extend(t.breaks.iter().copied().filter(|&x| x > l && x < r));
            xs.push(r);
            if surface.below_base(pm, &xs) {
                return Err(SurfaceError::OutsideModel);
            }
            Ok(())
        }
    }
}

/// [`check_block_ends`] of a circle: the code of before the polyline.
fn check_block_ends_circle(
    pm: &PreparedModel,
    c: &Circle,
    t: &Tramo,
    l: f64,
    r: f64,
) -> Result<(), SurfaceError> {
    let (x_min, x_max) = (pm.x_min, pm.x_max);
    let tol = pm.tol();
    let (ap, bp) = (c.xc - c.r, c.xc + c.r);
    // The arc leaves the model through a side wall. It is an error only if the arc is under the ground at that
    // wall; touching the ground there (within tol) is a valid crossing at the wall (R1-06).
    let leaves_left = ap < x_min - tol
        && l - x_min <= tol
        && pm.arc_clearance(c, x_min).is_some_and(|d| d < -tol);
    let leaves_right = bp > x_max + tol
        && x_max - r <= tol
        && pm.arc_clearance(c, x_max).is_some_and(|d| d < -tol);
    if leaves_left || leaves_right {
        return Err(SurfaceError::OutsideModel);
    }
    let mut xs = Vec::with_capacity(t.breaks.len() + 2);
    xs.push(l);
    xs.extend(t.breaks.iter().copied().filter(|&x| x > l && x < r));
    xs.push(r);
    if pm.arc_below_base(c, &xs) {
        return Err(SurfaceError::OutsideModel);
    }
    // An end of `[a, b]` is a crossing only when the arc touches the ground there (see R1-06).
    // I-M (V068): the end of the span may also be the circle's own end `xc ± r` (its vertical tangent, inside the
    // model) when the arc touches the ground there (`|d| ≤ tol`), for example a circle whose centre is at the crest
    // level. The same rule as at a model wall (R1-06). An arc under the ground at its own end (`d < −tol`) is the
    // upper-arc case and stays an error. Only a touch counts: also admitting an arc above the ground (`d > tol`)
    // changed the winner of a search of the battery (D03), which breaks the identity of F3.1.
    //
    // F3R-R2 (I1, V065): at the circle's own end the height of the arc is `yc` by construction. Evaluating it as
    // `yc − sqrt(r² − (x − xc)²)` loses the digits: `(xc + r) − xc` differs from `r` by 1 ulp, so the root of a
    // difference of order 1e-14 is of order 1e-7, over `tol`, and a circle that touches the crest was rejected.
    let end_clearance = |x: f64| {
        let own_end = x == ap || x == bp;
        pm.top_at(x)
            .map(|g| if own_end { c.yc } else { pm.arc_y(c, true, x) } - g)
    };
    let touches_left = end_clearance(t.a).is_some_and(|d| {
        (t.a - x_min <= tol && d.abs() <= tol) || (ap > x_min + tol && d.abs() <= tol)
    });
    let touches_right = end_clearance(t.b).is_some_and(|d| {
        (x_max - t.b <= tol && d.abs() <= tol) || (bp < x_max - tol && d.abs() <= tol)
    });
    if (l <= t.a && !touches_left) || (r >= t.b && !touches_right) {
        let (_, upper_under) = pm.arc_profile(c, false, t.a, t.b);
        let upper_cross = upper_under.windows(2).any(|w| w[0] != w[1]);
        return Err(if upper_cross {
            SurfaceError::UpperArc
        } else {
            SurfaceError::NoIntersection
        });
    }
    Ok(())
}

/// Slices the circle into `n` uniform divisions plus breakpoints (contract §4.1).
///
/// ORDER: `slices[0]` is the toe slice (exit); `slices[last]` is the crest slice (entry), regardless of sliding direction.
/// E10a/E10a″: only the main soil block (the entry block) is kept (see [`slice_surface`]); this function drops the notes.
pub fn slice_circle(
    pm: &PreparedModel,
    circle: &Circle,
    n: usize,
) -> Result<Vec<Slice>, SurfaceError> {
    slice_circle_with(pm, circle, n, &LoadCase::default())
}

/// Like [`slice_circle`], with the seismic coefficients and the loads of `loads` (E12b).
pub fn slice_circle_with(
    pm: &PreparedModel,
    circle: &Circle,
    n: usize,
    loads: &LoadCase,
) -> Result<Vec<Slice>, SurfaceError> {
    slice_surface_with(pm, circle, n, loads).map(|sliced| sliced.slices)
}

/// Slices the circle like [`slice_circle`] and returns the notes of the slicing too (E10a).
///
/// An interior air run splits the soil into blocks (E10a). Only the main block, the one with the entry point (E10a″),
/// is analysed: the other blocks and every interior air slice are removed. The arc's ends are checked on the analysed
/// block only (E10a′). The kept block is then sliced again into `n` uniform divisions plus breakpoints (E11d), and it
/// must keep at least [`MIN_SOIL_SLICES`] soil slices, otherwise `TooFewSlices`. The same minimum applies to a surface
/// that is not truncated.
///
/// Notes: `truncated_mass` when only the main block is analysed. `truncated_driving_mass` (E11e′) replaces it when a
/// discarded block is driving (see [`discards_driving`]).
pub fn slice_surface(
    pm: &PreparedModel,
    circle: &Circle,
    n: usize,
) -> Result<SlicedSurface, SurfaceError> {
    slice_surface_with(pm, circle, n, &LoadCase::default())
}

/// Like [`slice_surface`], with the seismic coefficients and the loads of `loads` (E12b).
///
/// The loads act only on the soil slices that remain in the analysed block: air slices and discarded blocks (E10a)
/// carry none. The breakpoints of the loads also apply to the second slicing of E11d.
pub fn slice_surface_with(
    pm: &PreparedModel,
    circle: &Circle,
    n: usize,
    loads: &LoadCase,
) -> Result<SlicedSurface, SurfaceError> {
    slice_surface_of(pm, &Surface::Circle(*circle), n, loads)
}

/// [`slice_surface_with`] on any surface (E13c): a circle, or a polyline **already fitted** to the ground
/// ([`Surface::fit_to_ground`]); the fitted ends are the sliding range, so the polyline itself must not be extended
/// or trimmed here.
///
/// Everything described in [`slice_surface`] applies to the polyline too. Its vertices are obligatory nodes, so the
/// base of each slice is straight.
pub fn slice_surface_of(
    pm: &PreparedModel,
    surface: &Surface,
    n: usize,
    loads: &LoadCase,
) -> Result<SlicedSurface, SurfaceError> {
    slice_surface_cracked(pm, surface, n, loads, None)
}

/// [`slice_surface_of`] of the mass that a tension crack leaves (E15d, G2). With `crack_x = Some(x_c)` the mass ends in
/// the vertical face at `x_c`: the span that is sliced runs from the toe to `x_c` (the node of the cut is the face
/// itself), so the `n` divisions apply to the mass and everything on the crest side is gone. Every later check (E10a,
/// E10a′, E11d, `check_block_ends`) then applies to that mass, whose crest end is `(x_c, base(x_c))`, not to the whole
/// arc: a circle that leaves the model past the crack is valid. `None`, or an `x_c` at the entry crossing, is
/// [`slice_surface_of`] as it always was.
pub fn slice_surface_cracked(
    pm: &PreparedModel,
    surface: &Surface,
    n: usize,
    loads: &LoadCase,
    crack_x: Option<f64>,
) -> Result<SlicedSurface, SurfaceError> {
    let (built, tramo) = build_slices_cracked(pm, surface, n, loads, crack_x)?;
    let Built {
        mut slices,
        mut air,
        mut unsupported,
    } = built;
    // Built left to right; the toe is on the left for RightToLeft and on the right otherwise.
    if pm.sliding == Sliding::LeftToRight {
        slices.reverse();
        air.reverse();
        unsupported.reverse();
    }
    let (lo, hi, truncated) = match main_block_range(&air) {
        Some((lo, hi)) => (lo, hi, true),
        None => (0, slices.len(), false),
    };
    let l = slices[lo..hi]
        .iter()
        .map(|s| s.x_left)
        .fold(f64::INFINITY, f64::min);
    let r = slices[lo..hi]
        .iter()
        .map(|s| s.x_right)
        .fold(f64::NEG_INFINITY, f64::max);
    // The arc's ends are checked before the materials, as before E10a: an arc under the base is `OutsideModel`.
    check_block_ends(pm, surface, &tramo, l, r)?;
    let driving = truncated && discards_driving(pm, &slices, &air);

    // E11d: the kept block is sliced again over its own span, so `n` divisions apply to it and not to the whole arc.
    let (block, block_air, block_unsupported) = if truncated {
        let re = slice_span(pm, surface, l, r, &tramo.breaks, n, loads)?;
        let Built {
            mut slices,
            mut air,
            mut unsupported,
        } = re;
        if pm.sliding == Sliding::LeftToRight {
            slices.reverse();
            air.reverse();
            unsupported.reverse();
        }
        (slices, air, unsupported)
    } else {
        (
            slices[lo..hi].to_vec(),
            air[lo..hi].to_vec(),
            unsupported[lo..hi].to_vec(),
        )
    };
    if block_air.iter().filter(|&&a| !a).count() < MIN_SOIL_SLICES {
        return Err(SurfaceError::TooFewSlices);
    }
    if block_unsupported.iter().any(|&u| u) {
        return Err(SurfaceError::NoMaterial);
    }
    let notes = match (truncated, driving) {
        (false, _) => Vec::new(),
        (true, true) => vec![TRUNCATED_DRIVING_MASS.to_string()],
        (true, false) => vec![TRUNCATED_MASS.to_string()],
    };
    Ok(SlicedSurface {
        slices: block,
        notes,
    })
}

/// `W·sin α` of one slice: its driving component (positive when the base rises toward the crest).
fn driving_moment(s: &Slice) -> f64 {
    s.weight * s.alpha.sin()
}

/// E11e′: true if a discarded soil block is driving: its `Σ W·sin α` exceeds `DRIVING_FRACTION` times its own `Σ W`,
/// and it does not touch a side wall of the model. A block that touches a wall is clipped by the model's edge and
/// cannot be classified, so it only adds the note `truncated_mass` (see [`slice_surface`]). `slices` and `air` are toe
/// first, before truncation. The analysed block is the last soil block (the entry block, E10a″); with a single block
/// nothing is discarded.
fn discards_driving(pm: &PreparedModel, slices: &[Slice], air: &[bool]) -> bool {
    let blocks = soil_blocks(air);
    let Some((_, discarded)) = blocks.split_last() else {
        return false;
    };
    let tol = pm.tol();
    discarded.iter().any(|&(lo, hi)| {
        let block = &slices[lo..hi];
        let touches_wall = block
            .iter()
            .any(|s| s.x_left <= pm.x_min + tol || s.x_right >= pm.x_max - tol);
        if touches_wall {
            return false;
        }
        let weight: f64 = block.iter().map(|s| s.weight).sum();
        let moment: f64 = block.iter().map(driving_moment).sum();
        moment > DRIVING_FRACTION * weight
    })
}

/// Builds the slices of `circle` in model order (left to right), over the full sliding range, and its sliding range.
/// Nothing is truncated and the ends of the arc are not checked here: `slice_surface` applies E10a, E10a′ and E11d.
/// The tests of E2 geometry use this function directly.
#[cfg(test)]
pub(crate) fn build_slices(
    pm: &PreparedModel,
    circle: &Circle,
    n: usize,
) -> Result<(Built, Tramo), SurfaceError> {
    build_slices_cracked(pm, &Surface::Circle(*circle), n, &LoadCase::default(), None)
}

/// [`build_slices_cracked`] without a crack, for the geometry tests of any surface.
#[cfg(test)]
fn build_slices_with(
    pm: &PreparedModel,
    surface: &Surface,
    n: usize,
    loads: &LoadCase,
) -> Result<(Built, Tramo), SurfaceError> {
    build_slices_cracked(pm, surface, n, loads, None)
}

/// [`build_slices`] with the loads of `loads`, on any surface, over the span that a crack at `crack_x` leaves: the crest end of the sliding range moves to
/// the face (see [`slice_surface_cracked`]).
fn build_slices_cracked(
    pm: &PreparedModel,
    surface: &Surface,
    n: usize,
    loads: &LoadCase,
    crack_x: Option<f64>,
) -> Result<(Built, Tramo), SurfaceError> {
    if n == 0 {
        return Err(SurfaceError::TooFewSlices);
    }
    let tramo = surface.ground_crossings(pm)?;
    let (mut p, mut q) = (tramo.p, tramo.q);
    if let Some(x_c) = crack_x.filter(|x| x.is_finite()) {
        let tol = pm.tol();
        match pm.sliding {
            // The crest is on the right when the mass slides toward -x.
            Sliding::RightToLeft if x_c < q - tol => q = x_c.max(p),
            Sliding::LeftToRight if x_c > p + tol => p = x_c.min(q),
            _ => {}
        }
    }
    let built = slice_span(pm, surface, p, q, &tramo.breaks, n, loads)?;
    // Degenerate case (E2): every slice has its base above the ground, so there is no soil to slide.
    if !built.slices.iter().any(|s| s.weight > 0.0) {
        return Err(SurfaceError::AboveGround);
    }
    Ok((built, tramo))
}

/// Slices the arc of `circle` over `[p, q]` into `n` uniform divisions plus the breakpoints inside the span, left to
/// right. Used for the whole sliding range (see [`build_slices`]) and again for the kept block (E11d).
fn slice_span(
    pm: &PreparedModel,
    surface: &Surface,
    p: f64,
    q: f64,
    breaks: &[f64],
    n: usize,
    loads: &LoadCase,
) -> Result<Built, SurfaceError> {
    let span = q - p;
    let min_width = 1e-9 * span;

    // Slice boundaries: n uniform divisions plus the breakpoints, sorted and merged.
    let mut nodes: Vec<f64> = Vec::with_capacity(n + breaks.len());
    let uniform_start = nodes.len();
    nodes.extend((1..n).map(|k| p + span * (k as f64) / (n as f64)));
    let uniform_end = nodes.len();
    nodes.extend(breaks.iter().copied().filter(|&x| x > p && x < q));
    // E12b: a breakpoint at the ends of every distributed load and around every line load.
    let active = !loads.is_neutral();
    if active {
        let width = pm.x_max - pm.x_min;
        nodes.extend(
            loads
                .break_points(width)
                .into_iter()
                .filter(|&x| x > p && x < q),
        );
    }
    // E13c: the vertices of a polyline are obligatory nodes. A uniform division that falls within `min_width` of a
    // breakpoint would make the merge below drop the breakpoint when it comes second, and the base of the slice would
    // be a chord across the vertex. So the uniform division gives way. A circle keeps every node as before.
    if surface.is_polyline() {
        let mut fixed: Vec<f64> = nodes[uniform_end..].to_vec();
        // E13l-6: the vertices of the polyline win over every other fixed node (a load boundary, a region vertex): one
        // within `min_width` of a vertex would make the merge below drop the vertex when it comes first.
        if let Surface::Polyline(poly) = surface {
            let vertices: Vec<f64> = poly
                .points
                .iter()
                .map(|p| p[0])
                .filter(|&x| x > p && x < q)
                .collect();
            fixed.retain(|&f| {
                vertices
                    .iter()
                    .all(|&v| f == v || (f - v).abs() >= min_width)
            });
        }
        let mut kept: Vec<f64> = nodes[uniform_start..uniform_end]
            .iter()
            .copied()
            .filter(|&x| fixed.iter().all(|&f| (x - f).abs() >= min_width))
            .collect();
        kept.extend(fixed);
        nodes = kept;
    }
    nodes.sort_by(f64::total_cmp);
    let mut bounds: Vec<f64> = Vec::with_capacity(nodes.len() + 2);
    bounds.push(p);
    for x in nodes {
        if x - bounds[bounds.len() - 1] >= min_width && q - x >= min_width {
            bounds.push(x);
        }
    }
    bounds.push(q);

    let sliding = pm.sliding;
    // Base rising toward the crest is positive: the crest is on the right for RightToLeft.
    let sign = match sliding {
        Sliding::RightToLeft => 1.0,
        Sliding::LeftToRight => -1.0,
    };
    let tol = pm.tol();
    let eps = 1e-9 * pm.scale;
    let mut column = Vec::with_capacity(8);
    let mut scratch = Vec::with_capacity(8);
    let mut slices = Vec::with_capacity(bounds.len() - 1);
    let mut air_flags = Vec::with_capacity(bounds.len() - 1);
    let mut unsupported = Vec::with_capacity(bounds.len() - 1);

    for w in bounds.windows(2) {
        let (xl, xr) = (w[0], w[1]);
        let width = xr - xl;
        let xm = 0.5 * (xl + xr);
        let yl = surface.y_at(pm, xl);
        let yr = surface.y_at(pm, xr);
        let y_base_mid = 0.5 * (yl + yr);
        let Some(y_top_mid) = pm.top_at(xm) else {
            return Err(SurfaceError::OutsideModel);
        };
        pm.column(xm, &mut column, &mut scratch);

        let slope = (yr - yl) / width;
        let alpha = sign * slope.atan();
        let base_length = width / alpha.cos();

        // Air slice (E2): the base lies on or above the ground. It carries no soil, so weight,
        // cohesion, tan φ and pore pressure are zero. Its material is the region nearest below the
        // base, or region 0 if there is none.
        if y_top_mid - y_base_mid <= tol {
            let nearest = column
                .iter()
                .filter(|&&(_, hi, _)| hi <= y_base_mid + tol)
                .max_by(|a, b| a.1.total_cmp(&b.1));
            slices.push(Slice {
                x_left: xl,
                x_right: xr,
                y_base_left: yl,
                y_base_right: yr,
                y_top_mid,
                width,
                alpha,
                base_length,
                weight: 0.0,
                cohesion: 0.0,
                tan_phi: 0.0,
                pore_pressure: 0.0,
                material: nearest.map_or(0, |&(_, _, mat)| mat),
                ..ZERO_SLICE
            });
            air_flags.push(true);
            unsupported.push(false);
            continue;
        }

        let piezo = pm.piezometric_y(xm);

        // Σ γ_k h_k along the column between the base midpoint and the ground.
        let mut col = 0.0;
        let probe = y_base_mid + eps;
        let mut base_material = None;
        for &(lo, hi, mat) in &column {
            if lo <= probe && probe < hi {
                base_material = Some(mat);
            }
            let lo_c = lo.max(y_base_mid);
            let hi_c = hi.min(y_top_mid);
            if hi_c <= lo_c {
                continue;
            }
            let m = &pm.materials[mat];
            col += match (m.unit_weight_sat, piezo) {
                (Some(gs), Some(z)) => {
                    let below = (hi_c.min(z) - lo_c).max(0.0);
                    let above = (hi_c - lo_c) - below;
                    gs * below + m.unit_weight * above
                }
                _ => m.unit_weight * (hi_c - lo_c),
            };
        }
        // E13l-5: a base on a contact of two materials takes the weaker one.
        let base_material = base_material.map(|above| {
            weaker_at_contact(pm, &column, above, y_base_mid, col, alpha, piezo).unwrap_or(above)
        });
        let Some(mat) = base_material else {
            // The base lies outside the model: no material. Checked only if the slice stays in the main block (E10a′).
            slices.push(Slice {
                x_left: xl,
                x_right: xr,
                y_base_left: yl,
                y_base_right: yr,
                y_top_mid,
                width,
                alpha,
                base_length,
                weight: 0.0,
                cohesion: 0.0,
                tan_phi: 0.0,
                pore_pressure: 0.0,
                material: 0,
                ..ZERO_SLICE
            });
            air_flags.push(false);
            unsupported.push(true);
            continue;
        };
        let m = &pm.materials[mat];
        // E13b: the strength of the base, at the elevation of its midpoint.
        let (cohesion, tan_phi) = crate::strength::resolve(m, y_base_mid);

        let weight = width * col;
        let sigma_v = col;
        let pore_pressure = if let Some(ru) = m.ru {
            ru * sigma_v
        } else if let Some(z) = piezo {
            pm.gamma_w * (z - y_base_mid).max(0.0)
        } else {
            0.0
        };

        // E12b: seismic force and surface loads, resolved on this soil slice. Skipped in a model without them.
        let mut extra = ZERO_SLICE;
        if active {
            extra = slice_loads(
                pm,
                surface,
                loads,
                &SoilSlice {
                    xl,
                    xr,
                    y_base_left: yl,
                    y_base_right: yr,
                    weight,
                },
                &mut column,
                &mut scratch,
            );
        }

        slices.push(Slice {
            x_left: xl,
            x_right: xr,
            y_base_left: yl,
            y_base_right: yr,
            y_top_mid,
            width,
            alpha,
            base_length,
            weight,
            cohesion,
            tan_phi,
            pore_pressure,
            material: mat,
            ..extra
        });
        air_flags.push(false);
        unsupported.push(false);
    }

    // E12f: the line loads, once the slices of the span are known (a load on a shared boundary needs both neighbours).
    if active && !loads.lines.is_empty() {
        let soil: Vec<bool> = air_flags
            .iter()
            .zip(&unsupported)
            .map(|(&a, &u)| !a && !u)
            .collect();
        apply_line_loads(pm, surface, loads, &mut slices, &soil);
    }

    let mut built = Built {
        slices,
        air: air_flags,
        unsupported,
    };
    drop_hairline_air(pm, &mut built);
    Ok(built)
}

/// How far the base of an air slice is above the ground, at its worst end: the ground is straight inside a slice (the
/// vertices are nodes), so its height at the ends comes from two interior points; the base is the chord.
fn clearance_above_ground(pm: &PreparedModel, s: &Slice) -> f64 {
    let w = s.width;
    let mid = 0.5 * (s.y_base_left + s.y_base_right) - s.y_top_mid;
    let (Some(t1), Some(t2)) = (
        pm.top_at(s.x_left + 0.25 * w),
        pm.top_at(s.x_right - 0.25 * w),
    ) else {
        return mid;
    };
    // The ground rises `t2 − t1` over half the slice, so it is `half_rise` higher at the right end than at the middle.
    let half_rise = t2 - t1;
    let (top_l, top_r) = (s.y_top_mid - half_rise, s.y_top_mid + half_rise);
    (s.y_base_left - top_l).max(s.y_base_right - top_r).max(mid)
}

/// E2′ (M-D30): an interior air run whose arc is at most [`HAIRLINE_TOLS`]` · tol` above the ground is a touch of
/// the ground, not a gap, so it does not split the mass: its slices are removed from `built` and the two soil
/// neighbours stay adjacent (they are separated by less than a hair, and a hair carries no weight, strength or water).
///
/// The arc of a circle printed with 6 decimals misses a ground vertex by that much, and cSlope's own critical circle
/// of D30 passes 3.6e-7 m above the toe `(30, 0)` of a vertical cut: over the 1.6e-6 m between the arc's crossing of
/// the bench and the vertex the arc is above the ground, one air slice, and E10a kept only the entry block and lost
/// the 0.32 m lens under the bench (117.9 kN/m of cohesion, FS −15.4 %), while 5e-7 m lower, under the vertex, the
/// whole mass gave +0.13 %. Only interior runs count (soil on both sides, as E10a looks at them); the air at either
/// end of the sequence is the crest or the toe and stays. The clearance is that of the base of each
/// slice, at its worse end ([`clearance_above_ground`]); a run whose every slice is within the band and whose total width is
/// at most [`HAIRLINE_WIDTH_FRACTION`]` · width` is bridged. A run over either bound is a gap, as before.
fn drop_hairline_air(pm: &PreparedModel, built: &mut Built) {
    let hair = HAIRLINE_TOLS * pm.tol();
    let longest = HAIRLINE_WIDTH_FRACTION * (pm.x_max - pm.x_min);
    let n = built.slices.len();
    let mut keep = vec![true; n];
    let mut k = 0;
    while k < n {
        if !built.air[k] {
            k += 1;
            continue;
        }
        let start = k;
        while k < n && built.air[k] {
            k += 1;
        }
        let interior = start > 0 && k < n;
        let hairline = built.slices[start..k].iter().map(|s| s.width).sum::<f64>() <= longest
            && built.slices[start..k]
                .iter()
                .all(|s| clearance_above_ground(pm, s) <= hair);
        if interior && hairline {
            keep[start..k].fill(false);
        }
    }
    if keep.iter().all(|&b| b) {
        return;
    }
    let mut it = keep.iter();
    built.slices.retain(|_| *it.next().unwrap_or(&true));
    let mut it = keep.iter();
    built.air.retain(|_| *it.next().unwrap_or(&true));
    let mut it = keep.iter();
    built.unsupported.retain(|_| *it.next().unwrap_or(&true));
}

/// E13l-5: the material of a base that lies on a contact between two materials.
///
/// `above` is the material just over the base midpoint (the one the column gives at `y_base_mid + tol`). When the
/// point just under it, at `y_base_mid − tol`, belongs to other materials only, the base is on a contact (a polyline
/// run along it, a circle that grazes it at the midpoint). Then it takes the weaker of the two, compared with the
/// strength `c + max(0, σ′)·tan φ` (`Su` for an undrained material) at the stress of the ordinary method of slices,
/// `σ′ = W·cos²α/b − u`, so that a surface along the top or the bottom of a weak layer is analysed in the weak layer.
/// A tie keeps `above`. Returns `None` when the base is not on a contact.
fn weaker_at_contact(
    pm: &PreparedModel,
    column: &[(f64, f64, usize)],
    above: usize,
    y_base_mid: f64,
    col: f64,
    alpha: f64,
    piezo: Option<f64>,
) -> Option<usize> {
    let y_under = y_base_mid - pm.tol();
    let holds_under = |&&(lo, hi, _): &&(f64, f64, usize)| lo <= y_under && y_under < hi;
    if column
        .iter()
        .filter(holds_under)
        .any(|&(_, _, mat)| mat == above)
    {
        return None;
    }
    let below = column
        .iter()
        .filter(holds_under)
        .map(|&(_, _, mat)| mat)
        .next()?;
    let sigma = col * alpha.cos().powi(2);
    let strength = |mat: usize| {
        let m = &pm.materials[mat];
        let (c, tan_phi) = crate::strength::resolve(m, y_base_mid);
        let u = if let Some(ru) = m.ru {
            ru * col
        } else if let Some(z) = piezo {
            pm.gamma_w * (z - y_base_mid).max(0.0)
        } else {
            0.0
        };
        c + (sigma - u).max(0.0) * tan_phi
    };
    (strength(below) < strength(above)).then_some(below)
}

/// Adds the line loads to the soil slices of a span (E12f).
///
/// A line load at `x` acts on the soil slices whose closed interval `[x_l, x_r]` contains `x`, within
/// `1e-9·model width`. Each of the `n` slices that contain it takes `1/n` of the load: all of it in the interior of a
/// slice or at an end of the span (entry or exit of the block, or next to an air slice), and half on each side of a
/// boundary shared by two soil slices. The rule is the same in both sliding directions, so the mirror image of a
/// model gives the same forces. A load that touches no soil slice is dropped (`load_outside_mass` is noted by the
/// caller). `V = p·cos θ` is added to `weight_extra`, `H^P = s·p·sin θ` to `h_force`, applied at `y_g = y_top(x)`.
fn apply_line_loads(
    pm: &PreparedModel,
    surface: &Surface,
    loads: &LoadCase,
    slices: &mut [Slice],
    soil: &[bool],
) {
    let tol = LINE_TOUCH_FRACTION * (pm.x_max - pm.x_min);
    let direction = match pm.sliding {
        Sliding::LeftToRight => 1.0,
        Sliding::RightToLeft => -1.0,
    };
    let arm = surface.moment_arm();
    for l in &loads.lines {
        let touched: Vec<usize> = (0..slices.len())
            .filter(|&i| soil[i] && slices[i].x_left - tol <= l.x && l.x <= slices[i].x_right + tol)
            .collect();
        if touched.is_empty() {
            continue;
        }
        let share = 1.0 / touched.len() as f64;
        let (sin, cos) = l.angle.sin_cos();
        for i in touched {
            let sl = &mut slices[i];
            let y_base = 0.5 * (sl.y_base_left + sl.y_base_right);
            let y_g = pm.top_at(l.x).unwrap_or(y_base);
            let h = share * direction * l.p * sin;
            sl.weight_extra += share * l.p * cos;
            sl.h_force += h;
            sl.h_moment_base += h * (y_g - y_base);
            // A polyline has no centre: `driving_extra` stays 0 (see the module doc).
            if let Some((yc, r)) = arm {
                sl.driving_extra += h * (yc - y_g) / r;
            }
        }
    }
}

/// The data of a soil slice that the load resolution needs.
struct SoilSlice {
    xl: f64,
    xr: f64,
    y_base_left: f64,
    y_base_right: f64,
    weight: f64,
}

/// Ordinate of the weight-weighted centroid of the soil of a slice (E12b).
///
/// Per material layer (split at the piezometric level when `unit_weight_sat` applies), the area and its first moment
/// `γ·(y_hi² − y_lo²)/2` are integrated over the slice with the two-point Gauss rule at `x_mid ± b/(2√3)`. Within a
/// slice the ground, the layer boundaries and the chord of the base are straight, so the rule is exact: the first
/// moment is quadratic in x. The ordinate is the ratio of the two integrals, never the average of two heights.
fn soil_centroid(
    pm: &PreparedModel,
    s: &SoilSlice,
    column: &mut Vec<(f64, f64, usize)>,
    scratch: &mut Vec<f64>,
) -> f64 {
    let width = s.xr - s.xl;
    let offset = width / (2.0 * 3.0_f64.sqrt());
    let xm = 0.5 * (s.xl + s.xr);
    let (mut mass, mut moment) = (0.0_f64, 0.0_f64);
    for x in [xm - offset, xm + offset] {
        let y_base = s.y_base_left + (s.y_base_right - s.y_base_left) * (x - s.xl) / width;
        let Some(y_top) = pm.top_at(x) else { continue };
        let piezo = pm.piezometric_y(x);
        pm.column(x, column, scratch);
        for &(lo, hi, mat) in column.iter() {
            let (lo, hi) = (lo.max(y_base), hi.min(y_top));
            if hi <= lo {
                continue;
            }
            let m = &pm.materials[mat];
            // (lower, upper, unit weight) pieces of the layer.
            let mut piece = |a: f64, b: f64, gamma: f64| {
                if b > a {
                    mass += gamma * (b - a);
                    moment += gamma * 0.5 * (b * b - a * a);
                }
            };
            match (m.unit_weight_sat, piezo) {
                (Some(gs), Some(z)) => {
                    piece(lo, hi.min(z).max(lo), gs);
                    piece(lo.max(z).min(hi), hi, m.unit_weight);
                }
                _ => piece(lo, hi, m.unit_weight),
            }
        }
    }
    if mass > 0.0 {
        moment / mass
    } else {
        0.5 * (s.y_base_left + s.y_base_right)
    }
}

/// Seismic force and surface loads of one soil slice (E12b), as the last fields of a [`Slice`] (the rest is zero).
///
/// With `s = +1` for `LeftToRight` and `−1` for `RightToLeft`, `y_b` the base midpoint, and `θ` the angle of a line
/// load: `Q = Σ q·|[x_l, x_r] ∩ [x1, x2]|`. The line loads, `V = p·cos θ` and `H^P = s·p·sin θ` applied at
/// `y_g = y_top(x)`, are added afterwards by [`apply_line_loads`] (E12f). Then `W* = W·(1 + kv) + Q + V` and
/// `H = kh·W + H^P`.
fn slice_loads(
    pm: &PreparedModel,
    surface: &Surface,
    loads: &LoadCase,
    s: &SoilSlice,
    column: &mut Vec<(f64, f64, usize)>,
    scratch: &mut Vec<f64>,
) -> Slice {
    let y_base = 0.5 * (s.y_base_left + s.y_base_right);
    let arm = surface.moment_arm();
    let mut vertical = 0.0_f64;
    for u in &loads.udls {
        let overlap = s.xr.min(u.x2) - s.xl.max(u.x1);
        if overlap > 0.0 {
            vertical += u.q * overlap;
        }
    }
    let (mut moment_base, mut driving) = (0.0_f64, 0.0_f64);
    let h_seismic = loads.kh * s.weight;
    let mut y_centroid = 0.0;
    if h_seismic > 0.0 {
        y_centroid = soil_centroid(pm, s, column, scratch);
        moment_base += h_seismic * (y_centroid - y_base);
        if let Some((yc, r)) = arm {
            driving += h_seismic * (yc - y_centroid) / r;
        }
    }
    Slice {
        weight_extra: loads.kv * s.weight + vertical,
        h_force: h_seismic,
        h_moment_base: moment_base,
        driving_extra: driving,
        y_centroid,
        ..ZERO_SLICE
    }
}

/// Samples per soil interval of the integral of an undrained strength that varies with the elevation (E13k).
const FACE_STRENGTH_SAMPLES: usize = 40;

/// Strength mobilizable on the vertical face between two consecutive slices (E13k): the ingredients of the denominator
/// of `r_v = |X|·F / (c_v·h + max(E′, 0)·tan φ_v)`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FaceStrength {
    /// `c_v·h = ∫ c dy` over the soil of the face, from the base of the slice to the ground (`Su` for an undrained
    /// material, at the elevation of each point).
    pub cohesion_force: f64,
    /// `tan φ_v`: the height average of `tan φ` over the soil of the face.
    pub tan_phi: f64,
    /// Resultant of the water on the face, `P_w` (piezometric line, or `ru·σv` in a material with `ru`), with the
    /// same `σv` as the pore pressure of the slice bases. `E′ = −E − P_w`.
    pub water_force: f64,
}

impl FaceStrength {
    /// A face without soil (zero height): no strength and no water.
    pub const NONE: FaceStrength = FaceStrength {
        cohesion_force: 0.0,
        tan_phi: 0.0,
        water_force: 0.0,
    };
}

/// [`FaceStrength`] of the face shared by `toe` and `crest`, two consecutive slices of a block in toe → crest order
/// (E13k). The face runs from the base of `toe` at the shared abscissa up to the ground.
///
/// The soil is read on the column of the model just inside `toe` (by `1e-9·scale`, never beyond half its width), so a
/// face on a vertex of the regions takes the materials of the toe side. The integrals over the soil are exact; the
/// strength of an `undrained` material with a profile is integrated over `FACE_STRENGTH_SAMPLES` midpoints per
/// interval. A face of zero height (air slice, base on the ground) has no strength.
pub(crate) fn interslice_face_strength(
    pm: &PreparedModel,
    toe: &Slice,
    crest: &Slice,
) -> FaceStrength {
    // Shared abscissa: the left side of `toe` when the block runs toward −x, the right one otherwise.
    let on_left = (toe.x_left - crest.x_right).abs() <= (toe.x_right - crest.x_left).abs();
    let (x, y_base, inward) = if on_left {
        (toe.x_left, toe.y_base_left, 1.0)
    } else {
        (toe.x_right, toe.y_base_right, -1.0)
    };
    let x_in = x + inward * pm.tol().min(0.5 * toe.width);
    let Some(near) = face_side(pm, x, x_in, y_base, None) else {
        return FaceStrength::NONE;
    };
    // E13l-6: on a vertical contact of two materials the face takes the weaker side. The crest side is read with the
    // ground of the toe side, so that only a different material (not a step of the ground) can make it weaker. The
    // sides are compared by `c·h + max(∫σv dy − P_w, 0)·tan φ`, the capacity under the overburden of the face
    // (`K = 1`), because `E′` is not known here. A face with the same materials on both sides keeps the toe side.
    let x_out = x - inward * pm.tol().min(0.5 * crest.width);
    if let Some(far) = face_side(pm, x, x_out, y_base, Some(near.top))
        && far.materials != near.materials
        && (far.soil - near.soil).abs() <= pm.tol()
        && far.capacity() < near.capacity()
    {
        return far.strength;
    }
    near.strength
}

/// One side of a face (see [`interslice_face_strength`]): its strength and what decides the weaker side.
struct FaceSide {
    strength: FaceStrength,
    /// Materials of the soil intervals of the face, from the top down.
    materials: Vec<usize>,
    /// Soil height of the face.
    soil: f64,
    /// Ground at the face.
    top: f64,
    /// `∫σv dy` over the face: the horizontal force of the overburden with `K = 1`.
    overburden: f64,
}

impl FaceSide {
    fn capacity(&self) -> f64 {
        self.strength.cohesion_force
            + (self.overburden - self.strength.water_force).max(0.0) * self.strength.tan_phi
    }
}

/// The face at `x`, read on the column of the model at `x_in` (just beside `x`), from `y_base` up to the ground of the
/// column, or up to `top` when it is given. `None` for a face of zero height (a base on the ground, no column).
fn face_side(
    pm: &PreparedModel,
    x: f64,
    x_in: f64,
    y_base: f64,
    top: Option<f64>,
) -> Option<FaceSide> {
    let mut column = Vec::with_capacity(8);
    let mut scratch = Vec::with_capacity(8);
    pm.column(x_in, &mut column, &mut scratch);
    let top = match top {
        Some(top) => top,
        None => column.iter().map(|c| c.1).max_by(f64::total_cmp)?,
    };
    if top - y_base <= pm.tol() {
        return None;
    }
    // Soil intervals clipped to [base, ground], from the top down, so the overburden accumulates. A sliver thinner than
    // the model tolerance is float noise of a base on a layer interface, not soil (V021: it would make a sand face
    // look as if it had strength).
    let mut intervals: Vec<(f64, f64, usize)> = column
        .iter()
        .map(|&(lo, hi, mat)| (lo.max(y_base), hi.min(top), mat))
        .filter(|&(lo, hi, _)| hi - lo > pm.tol())
        .collect();
    intervals.sort_by(|a, b| b.1.total_cmp(&a.1));
    let piezo = pm.piezometric_y(x);
    let (mut cohesion_force, mut tan_sum, mut soil, mut water) =
        (0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64);
    let mut sigma_v = 0.0_f64;
    let mut overburden = 0.0_f64;
    for &(lo, hi, mat) in &intervals {
        let m = &pm.materials[mat];
        let length = hi - lo;
        soil += length;
        // Pieces of constant unit weight, top first: above and below the piezometric level when `unit_weight_sat`
        // applies (as in the weight of the slice), the whole interval otherwise.
        let pieces: [(f64, f64, f64); 2] = match (m.unit_weight_sat, piezo) {
            (Some(sat), Some(z)) => {
                let split = z.clamp(lo, hi);
                [(split, hi, m.unit_weight), (lo, split, sat)]
            }
            _ => [(lo, hi, m.unit_weight), (lo, lo, 0.0)],
        };
        // Strength of the interval (F6.6). For `Linear` the closed form of today, byte for byte; for `hoek_brown` and
        // `shansep` the envelope integrated at the effective vertical stress of each point (K = 1) with
        // `FACE_STRENGTH_SAMPLES` midpoints, like the undrained profile (F6.5). `face_tau` is `todo!()` in B0.
        match &m.law {
            crate::strength::StrengthLaw::Linear => {
                if m.profile.is_some() {
                    let step = length / FACE_STRENGTH_SAMPLES as f64;
                    for i in 0..FACE_STRENGTH_SAMPLES {
                        let y = lo + (i as f64 + 0.5) * step;
                        let (c, t) = crate::strength::resolve(m, y);
                        cohesion_force += c * step;
                        tan_sum += t * step;
                    }
                } else {
                    cohesion_force += m.cohesion * length;
                    tan_sum += m.tan_phi * length;
                }
            }
            crate::strength::StrengthLaw::HoekBrown(_)
            | crate::strength::StrengthLaw::Shansep(_) => {
                let step = length / FACE_STRENGTH_SAMPLES as f64;
                for i in 0..FACE_STRENGTH_SAMPLES {
                    let y = lo + (i as f64 + 0.5) * step;
                    // Total vertical stress at `y`: the overburden above the interval plus the pieces above `y`.
                    let mut sigma_v_y = sigma_v;
                    for &(p_lo, p_hi, gamma) in &pieces {
                        let above = p_hi - p_lo.max(y);
                        if above > 0.0 {
                            sigma_v_y += gamma * above;
                        }
                    }
                    let u = if let Some(ru) = m.ru {
                        ru * sigma_v_y
                    } else if let Some(z) = piezo {
                        pm.gamma_w * (z - y).max(0.0)
                    } else {
                        0.0
                    };
                    cohesion_force += crate::strength::face_tau(m, sigma_v_y - u, y) * step;
                }
            }
        }
        for (p_lo, p_hi, gamma) in pieces {
            let len = p_hi - p_lo;
            if len <= 0.0 {
                continue;
            }
            if let Some(ru) = m.ru {
                water += ru * (sigma_v * len + 0.5 * gamma * len * len);
            } else if let Some(z) = piezo {
                let wet_hi = p_hi.min(z);
                if wet_hi > p_lo {
                    water += 0.5 * pm.gamma_w * ((z - p_lo).powi(2) - (z - wet_hi).powi(2));
                }
            }
            overburden += sigma_v * len + 0.5 * gamma * len * len;
            sigma_v += gamma * len;
        }
    }
    Some(FaceSide {
        strength: FaceStrength {
            cohesion_force,
            tan_phi: if soil > 0.0 { tan_sum / soil } else { 0.0 },
            water_force: water,
        },
        materials: intervals.iter().map(|i| i.2).collect(),
        soil,
        top,
        overburden,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Model;
    use serde_json::{Value, json};

    /// E10a on a toe-first sequence: the sequence cut to its main block, and whether anything was removed.
    fn truncate_to_main_block(slices: Vec<Slice>, air: &[bool]) -> (Vec<Slice>, bool) {
        match main_block_range(air) {
            Some((lo, hi)) => (slices[lo..hi].to_vec(), true),
            None => (slices, false),
        }
    }

    fn soil(weight: f64) -> Slice {
        Slice {
            x_left: 0.0,
            x_right: 1.0,
            y_base_left: 0.0,
            y_base_right: 0.0,
            y_top_mid: 1.0,
            width: 1.0,
            alpha: 0.0,
            base_length: 1.0,
            weight,
            cohesion: 1.0,
            tan_phi: 0.5,
            pore_pressure: 0.0,
            material: 0,
            ..ZERO_SLICE
        }
    }

    fn air() -> Slice {
        Slice {
            weight: 0.0,
            cohesion: 0.0,
            tan_phi: 0.0,
            ..soil(0.0)
        }
    }

    /// Two soil blocks of weights `w_first` and `w_second` (toe first) separated by one interior air slice.
    fn two_blocks(w_first: f64, w_second: f64) -> (Vec<Slice>, Vec<bool>) {
        (
            vec![soil(w_first), air(), soil(w_second)],
            vec![false, true, false],
        )
    }

    /// E10a″: the block that contains the entry is kept whatever its weight. A heavier toe block is dropped, and a light
    /// entry block is kept (the D09 foot lens is heavier than the face, and the face is the entry block).
    #[test]
    fn entry_block_is_kept_whatever_its_weight() {
        for (w_toe, w_entry) in [(0.9, 0.001), (1.0, 1.1e-3), (0.001, 0.9)] {
            let (s, flags) = two_blocks(w_toe, w_entry);
            let (out, truncated) = truncate_to_main_block(s, &flags);
            assert!(truncated);
            assert_eq!(out.len(), 1, "w_toe={w_toe} w_entry={w_entry}");
            assert_eq!(out[0].weight, w_entry);
        }
    }

    /// E10a: one soil block is never truncated, and air at the ends of a single block is left as it is.
    #[test]
    fn single_block_is_not_truncated() {
        let (out, truncated) = truncate_to_main_block(vec![soil(1.0)], &[false]);
        assert!(!truncated);
        assert_eq!(out.len(), 1);
        let s = vec![air(), soil(1.0), air()];
        let (out, truncated) = truncate_to_main_block(s.clone(), &[true, false, true]);
        assert!(!truncated);
        assert_eq!(out, s);
    }

    /// E10a″: with three blocks the one containing the entry (the last in toe-first order) wins, whatever its weight.
    #[test]
    fn entry_block_of_three_is_the_main_one() {
        let flags = [false, true, false, true, false];
        let s = vec![soil(0.3), air(), soil(0.5), air(), soil(0.2)];
        let (out, truncated) = truncate_to_main_block(s, &flags);
        assert!(truncated);
        assert_eq!(out.iter().map(|x| x.weight).collect::<Vec<_>>(), vec![0.2]);
    }

    /// E10a″: equal weights do not change the choice. The entry block is the last one, on the crest side.
    #[test]
    fn equal_weights_keep_the_entry_block() {
        let (s, flags) = two_blocks(0.5, 0.5);
        let mut marked = s.clone();
        marked[0].x_left = -1.0; // toe-side block
        marked[2].x_left = -2.0; // entry-side block
        let (out, truncated) = truncate_to_main_block(marked, &flags);
        assert!(truncated);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].x_left, -2.0, "the entry-side block is kept");
    }

    /// E10a: air slices at the ends are kept only when they touch the main block. Toe air beyond a removed block is
    /// dropped; crest air next to the entry block is kept.
    #[test]
    fn end_air_is_kept_only_next_to_the_main_block() {
        // Toe air, a heavy toe block, an interior air slice, the light entry block, crest air.
        let s = vec![air(), soil(1.0), air(), soil(0.1), air()];
        let flags = [true, false, true, false, true];
        let (out, truncated) = truncate_to_main_block(s, &flags);
        assert!(truncated);
        let kinds: Vec<bool> = out.iter().map(|x| x.weight == 0.0).collect();
        assert_eq!(
            kinds,
            vec![false, true],
            "entry block and crest air kept; toe air, toe block and interior air removed"
        );
    }

    fn pm_of(polygon: Value, direction: &str) -> PreparedModel {
        let doc = json!({
            "format": "opengeoslide",
            "version": "0.1",
            "materials": [{
                "id": "soil", "name": "Soil", "model": "mohr_coulomb",
                "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6
            }],
            "regions": [{"material": "soil", "polygon": polygon}],
            "slope": {"direction": direction},
            "analysis": {}
        });
        let model: Model = serde_json::from_value(doc).expect("test model");
        PreparedModel::new(&model).expect("valid model")
    }

    /// The guards of the block hold on a polyline (E13c). The polyline here is **not** fitted: it rises over the valley
    /// notch of the ground (`(20, 13.5)` is over the ground at 12), which a fitted polyline never does, so the slicer's
    /// own handling of air shows: E2 turns the slices over the notch into air slices (no weight, no strength), and E10a
    /// keeps the entry block, on the crest side, with the note `truncated_mass`. A polyline has no centre, so no slice
    /// carries a moment arm for Bishop.
    #[test]
    fn a_polyline_over_the_notch_gives_air_slices_and_keeps_the_entry_block() {
        let pm = pm_of(
            json!([
                [0, 10],
                [0, 20],
                [10, 20],
                [20, 12],
                [30, 20],
                [40, 20],
                [40, 10]
            ]),
            "right_to_left",
        );
        let surface = Surface::Polyline(crate::surface::Polyline {
            points: vec![
                [3.0, 19.0],
                [8.0, 18.0],
                [14.0, 13.5],
                [20.0, 13.5],
                [26.0, 13.5],
                [32.0, 18.0],
                [37.0, 19.0],
            ],
        });
        let (built, tramo) = build_slices_with(&pm, &surface, 50, &LoadCase::default())
            .expect("the notch is air, not an error (E2)");
        assert_eq!((tramo.p, tramo.q), (3.0, 37.0));
        let air = built.air.iter().filter(|&&a| a).count();
        assert!(air > 0, "the slices over the notch are air slices");
        for (s, &is_air) in built.slices.iter().zip(&built.air) {
            assert_eq!(s.driving_extra, 0.0);
            if is_air {
                assert_eq!(
                    (s.weight, s.cohesion, s.tan_phi, s.pore_pressure),
                    (0.0, 0.0, 0.0, 0.0)
                );
                assert!(
                    s.x_left > 18.0 && s.x_right < 22.0,
                    "air only over the notch: {s:?}"
                );
            }
        }
        // The vertices are nodes of the cut, so the bases are straight.
        for v in [8.0, 14.0, 20.0, 26.0, 32.0] {
            assert!(
                built.slices.iter().any(|s| s.x_left == v),
                "the vertex {v} is not a node"
            );
        }
        let sliced = slice_surface_of(&pm, &surface, 50, &LoadCase::default()).expect("main block");
        assert_eq!(sliced.notes, vec![TRUNCATED_MASS.to_string()]);
        assert!(
            sliced.slices.iter().all(|s| s.weight > 0.0),
            "no air in the main block"
        );
        assert!(
            sliced.slices[0].x_left > 21.0 && sliced.slices.last().unwrap().x_right == 37.0,
            "the kept block is the one with the entry, on the crest side"
        );
    }

    /// E2 geometry (moved from `slicer_geometry`, which now expects `DisconnectedMass` for this surface):
    /// a valley notch whose arc leaves the soil. The notch is air, not an error, and the air slices carry nothing.
    #[test]
    fn valley_notch_arc_produces_air_slices_at_the_notch() {
        let pm = pm_of(
            json!([
                [0, 10],
                [0, 20],
                [10, 20],
                [20, 12],
                [30, 20],
                [40, 20],
                [40, 10]
            ]),
            "right_to_left",
        );
        let c = Circle {
            xc: 20.0,
            yc: 60.0,
            r: 44.0,
        };
        let (built, _) = build_slices(&pm, &c, 50).expect("the notch is air, not an error (E2)");
        let (sl, flags) = (built.slices, built.air);
        let air_count = sl.iter().filter(|s| s.weight == 0.0).count();
        assert!(air_count > 0, "the notch must produce air slices");
        for (s, &is_air) in sl.iter().zip(&flags) {
            assert_eq!(is_air, s.weight == 0.0);
            if is_air {
                assert_eq!((s.cohesion, s.tan_phi, s.pore_pressure), (0.0, 0.0, 0.0));
                let base_mid = 0.5 * (s.y_base_left + s.y_base_right);
                assert!(base_mid >= s.y_top_mid - 1e-9, "air base below the ground");
            } else {
                let base_mid = 0.5 * (s.y_base_left + s.y_base_right);
                assert!(
                    base_mid < s.y_top_mid,
                    "soil slice with its base in the air"
                );
                assert_eq!(s.cohesion, 3.0);
            }
        }
        assert!(sl[0].weight > 0.0 && sl[sl.len() - 1].weight > 0.0);
        // E10a″: the main block is the one with the entry point, the last soil block in toe-first order. The notch
        // runs right to left, so `sl` is toe-first. No air is left in the main block, and its weight is the weight of the
        // entry block (independent of the other block).
        let (main, truncated) = truncate_to_main_block(sl.clone(), &flags);
        assert!(truncated);
        assert!(
            main.iter().all(|s| s.weight > 0.0),
            "no air in the main block"
        );
        let blocks = soil_blocks(&flags);
        assert_eq!(blocks.len(), 2, "the notch splits the soil in two blocks");
        let (start, end) = blocks[1];
        let w_entry: f64 = sl[start..end].iter().map(|s| s.weight).sum();
        let w_main: f64 = main.iter().map(|s| s.weight).sum();
        assert!(
            (w_main - w_entry).abs() <= 1e-12 * w_entry,
            "main block weight {w_main} vs entry block {w_entry}"
        );
        assert_eq!(
            main.last().map(|s| s.x_right),
            sl.last().map(|s| s.x_right),
            "the main block ends at the entry (crest side)"
        );
    }

    /// E2 geometry (moved from `slicer_geometry`): the circle leaves the flat toe and re-enters the 2:1 face. The air
    /// slices lie only in that gap, and the summed weight equals the soil area under the arc (independent midpoint
    /// rule, 400 000 strips, relative tolerance 1e-3). E8a then rejects it: the toe and the face are separate masses.
    #[test]
    fn toe_gap_produces_air_slices_and_the_exact_soil_area() {
        let pm = pm_of(
            json!([[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]]),
            "auto",
        );
        let c = Circle {
            xc: 25.0,
            yc: 44.0,
            r: 19.5,
        };
        let (built, _) = build_slices(&pm, &c, 2000).expect("the gap is air (E2)");
        let (sl, flags) = (built.slices, built.air);
        let air_count = flags.iter().filter(|&&a| a).count();
        assert!(air_count > 0, "the gap above the ground must be air slices");
        for (s, &is_air) in sl.iter().zip(&flags) {
            if !is_air {
                continue;
            }
            assert_eq!((s.cohesion, s.tan_phi, s.pore_pressure), (0.0, 0.0, 0.0));
            let base_mid = 0.5 * (s.y_base_left + s.y_base_right);
            assert!(base_mid >= s.y_top_mid - 1e-9);
            assert!(
                s.x_left > 29.0 && s.x_right < 31.5,
                "air only in the gap near the toe: {s:?}"
            );
        }

        let terrain = |x: f64| {
            if x <= 30.0 {
                25.0
            } else if x <= 50.0 {
                25.0 + (x - 30.0) / 2.0
            } else {
                35.0
            }
        };
        let arc = |x: f64| c.yc - (c.r * c.r - (x - c.xc).powi(2)).max(0.0).sqrt();
        let (x0, x1) = (20.0_f64.max(c.xc - c.r), c.xc + c.r);
        let strips = 400_000;
        let h = (x1 - x0) / strips as f64;
        let exact: f64 = (0..strips)
            .map(|i| {
                let x = x0 + (i as f64 + 0.5) * h;
                (terrain(x) - arc(x)).max(0.0)
            })
            .sum::<f64>()
            * h;
        let sum_w_over_gamma: f64 = sl.iter().map(|s| s.weight / 20.0).sum();
        let rel = (sum_w_over_gamma - exact).abs() / exact;
        assert!(
            rel < 1e-3,
            "sum W/γ = {sum_w_over_gamma}, exact = {exact}, rel = {rel}"
        );
        // E10a″: the slope rises to the right, so the entry is on the right and the face is the main block. The toe
        // lens (x < 30) is dropped whatever its weight.
        let (main, truncated) = truncate_to_main_block(sl.clone(), &flags);
        assert!(truncated);
        assert!(main.len() < sl.len());
        assert!(main.iter().all(|s| s.weight > 0.0));
        assert!(
            main[0].x_left >= 30.0 - 1e-6,
            "the toe lens is dropped: main starts at {}",
            main[0].x_left
        );
    }

    /// E13k: the strength and the water of a vertical face, on two horizontal layers (`a` over `b`, ground at 10, the
    /// interface at 6) and a piezometric line at 7. Face from the base at 2 up to the ground:
    /// `∫c dy = 5·4 + 10·4`, `tan φ_v = (0·4 + tan 30°·4) / 8`, and `P_w = γw·(7 − 2)²/2` (the whole face is under 7).
    /// With `ru = 0.3` in `b`, that material takes `ru·σv` (`σv = 18·4 + 20·(6 − y)`, integral 448 over `[2, 6]`) and the
    /// water of the line acts only on `a`, over `[6, 7]`: `γw·0.5`.
    #[test]
    fn e13k_the_face_strength_integrates_layers_and_water() {
        let model = |ru: Value| -> PreparedModel {
            let doc = json!({
                "format": "opengeoslide", "version": "0.1",
                "materials": [
                    {"id": "a", "name": "A", "model": "mohr_coulomb", "unit_weight": 18.0,
                     "cohesion": 5.0, "friction_angle": 0.0},
                    {"id": "b", "name": "B", "model": "mohr_coulomb", "unit_weight": 20.0,
                     "cohesion": 10.0, "friction_angle": 30.0, "ru": ru}
                ],
                "regions": [
                    {"material": "a", "polygon": [[0, 6], [0, 10], [10, 10], [10, 6]]},
                    {"material": "b", "polygon": [[0, 0], [0, 6], [10, 6], [10, 0]]}
                ],
                "water": {"unit_weight": 10.0, "piezometric_line": [[0, 7], [10, 7]]},
                "slope": {"direction": "right_to_left"},
                "analysis": {}
            });
            let model: Model = serde_json::from_value(doc).expect("test model");
            PreparedModel::new(&model).expect("valid model")
        };
        let slice = |x_left: f64, x_right: f64| Slice {
            x_left,
            x_right,
            y_base_left: 2.0,
            y_base_right: 2.0,
            width: x_right - x_left,
            base_length: x_right - x_left,
            ..ZERO_SLICE
        };
        // Toe first, running toward +x: the face is the right side of the toe slice.
        let face =
            interslice_face_strength(&model(Value::Null), &slice(3.0, 5.0), &slice(5.0, 7.0));
        let tan30 = 30.0_f64.to_radians().tan();
        assert!((face.cohesion_force - 60.0).abs() < 1e-9, "{face:?}");
        assert!((face.tan_phi - 0.5 * tan30).abs() < 1e-12, "{face:?}");
        assert!((face.water_force - 10.0 * 12.5).abs() < 1e-9, "{face:?}");
        // Same face, mirrored order (toe on the right): the face is the left side of the toe slice.
        let mirrored =
            interslice_face_strength(&model(Value::Null), &slice(5.0, 7.0), &slice(3.0, 5.0));
        assert_eq!(mirrored, face);
        let with_ru =
            interslice_face_strength(&model(json!(0.3)), &slice(3.0, 5.0), &slice(5.0, 7.0));
        assert!(
            (with_ru.water_force - (0.3 * 448.0 + 10.0 * 0.5)).abs() < 1e-9,
            "{with_ru:?}"
        );
        assert_eq!(with_ru.cohesion_force, face.cohesion_force);
        // A base on the ground: no soil on the face, no strength.
        let flat = Slice {
            y_base_left: 10.0,
            y_base_right: 10.0,
            ..slice(3.0, 5.0)
        };
        assert_eq!(
            interslice_face_strength(&model(Value::Null), &flat, &slice(5.0, 7.0)),
            FaceStrength::NONE
        );
    }

    /// E13l-6 (R10A-06-3): a vertical face on a vertical contact of two materials takes the weaker side, whichever of
    /// the two the toe slice is on. `a` (c = 40, φ = 30°) on the left of `x = 5`, `b` (c = 5, φ = 0) on the right;
    /// ground at 10, base at 2, so `h = 8`. The face is weak: `c·h = 40`, `tan φ = 0`, never `a`'s `320`.
    #[test]
    fn e13l6_a_face_on_a_vertical_contact_takes_the_weaker_side() {
        let model: PreparedModel = {
            let doc = json!({
                "format": "opengeoslide", "version": "0.1",
                "materials": [
                    {"id": "a", "name": "A", "model": "mohr_coulomb", "unit_weight": 18.0,
                     "cohesion": 40.0, "friction_angle": 30.0},
                    {"id": "b", "name": "B", "model": "mohr_coulomb", "unit_weight": 18.0,
                     "cohesion": 5.0, "friction_angle": 0.0}
                ],
                "regions": [
                    {"material": "a", "polygon": [[0, 0], [0, 10], [5, 10], [5, 0]]},
                    {"material": "b", "polygon": [[5, 0], [5, 10], [10, 10], [10, 0]]}
                ],
                "slope": {"direction": "right_to_left"},
                "analysis": {}
            });
            let model: Model = serde_json::from_value(doc).expect("test model");
            PreparedModel::new(&model).expect("valid model")
        };
        let slice = |x_left: f64, x_right: f64| Slice {
            x_left,
            x_right,
            y_base_left: 2.0,
            y_base_right: 2.0,
            width: x_right - x_left,
            base_length: x_right - x_left,
            ..ZERO_SLICE
        };
        // The toe slice is on the strong side, then on the weak side.
        let strong_toe = interslice_face_strength(&model, &slice(3.0, 5.0), &slice(5.0, 7.0));
        let weak_toe = interslice_face_strength(&model, &slice(5.0, 7.0), &slice(3.0, 5.0));
        for face in [strong_toe, weak_toe] {
            assert!((face.cohesion_force - 40.0).abs() < 1e-9, "{face:?}");
            assert_eq!(face.tan_phi, 0.0, "{face:?}");
        }
    }
}
