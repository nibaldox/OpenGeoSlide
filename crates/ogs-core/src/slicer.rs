//! Slicing of a circular surface into slices (§4.1).

use serde::Serialize;

use crate::geometry::{PreparedModel, Sliding};
use crate::model::Circle;

/// One slice, in the ORIGINAL model frame.
///
/// Sign convention: `alpha` is positive when the base rises toward the crest (driving component `W·sin α > 0`).
///
/// Air slices (contract §4.1.8, E2) have their base on or above the ground: `weight`, `cohesion`,
/// `tan_phi` and `pore_pressure` are exactly zero, and they contribute no driving or resisting force.
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
}

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

/// A sliced surface: the slices (toe first) and the informative notes raised while slicing.
#[derive(Debug, Clone, PartialEq)]
pub struct SlicedSurface {
    pub slices: Vec<Slice>,
    /// Stable note codes (contract E6). `"truncated_mass"` when the surface was truncated to its main block.
    pub notes: Vec<String>,
}

/// Soil blocks of a toe-first sequence: maximal runs of soil slices, as `(start, end, weight)` with `end`
/// exclusive. `air[k]` tells whether slice `k` is an air slice.
fn soil_blocks(slices: &[Slice], air: &[bool]) -> Vec<(usize, usize, f64)> {
    let mut blocks = Vec::new();
    let mut k = 0;
    while k < slices.len() {
        if air[k] {
            k += 1;
            continue;
        }
        let start = k;
        let mut weight = 0.0;
        while k < slices.len() && !air[k] {
            weight += slices[k].weight;
            k += 1;
        }
        blocks.push((start, k, weight));
    }
    blocks
}

/// Index range `[lo, hi)` of the main soil block of a toe-first sequence (E10a): the block with the largest soil
/// weight, and on a tie the one nearest the entry (the last in toe-first order). Air slices at the ends of the sequence
/// are kept only when they touch the main block. `None` when there is at most one soil block: nothing to remove.
pub(crate) fn main_block_range(slices: &[Slice], air: &[bool]) -> Option<(usize, usize)> {
    let blocks = soil_blocks(slices, air);
    if blocks.len() < 2 {
        return None;
    }
    let mut main = 0;
    for (k, block) in blocks.iter().enumerate().skip(1) {
        if block.2 >= blocks[main].2 {
            main = k;
        }
    }
    let (start, end, _) = blocks[main];
    let lo = if main == 0 { 0 } else { start };
    let hi = if main == blocks.len() - 1 {
        slices.len()
    } else {
        end
    };
    Some((lo, hi))
}

/// Slices of a circle in model order (left to right), before E10a.
pub(crate) struct Built {
    pub(crate) slices: Vec<Slice>,
    /// `true` for air slices (E2).
    pub(crate) air: Vec<bool>,
    /// `true` for soil slices whose base lies outside the model (no material). They are an error only when they
    /// stay in the main block (E10a′, see [`slice_surface`]).
    pub(crate) unsupported: Vec<bool>,
    pub(crate) tramo: Tramo,
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
    let touches_left =
        t.a - x_min <= tol && pm.arc_clearance(c, t.a).is_some_and(|d| d.abs() <= tol);
    let touches_right =
        x_max - t.b <= tol && pm.arc_clearance(c, t.b).is_some_and(|d| d.abs() <= tol);
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

/// Sliding range of the lower arc with the checks of [`check_block_ends`] over the whole range `[p, q]`. Used for the
/// entry of a fixed circle when the slope direction is `auto` (geometry).
pub(crate) fn lower_arc_tramo(pm: &PreparedModel, c: &Circle) -> Result<Tramo, SurfaceError> {
    let t = sliding_span(pm, c)?;
    check_block_ends(pm, c, &t, t.p, t.q)?;
    Ok(t)
}

/// Slices the circle into `n` uniform divisions plus breakpoints (contract §4.1).
///
/// ORDER: `slices[0]` is the toe slice (exit); `slices[last]` is the crest slice (entry), regardless of sliding direction.
/// E10a: only the main soil block is kept (see [`slice_surface`]); this function drops the notes.
pub fn slice_circle(
    pm: &PreparedModel,
    circle: &Circle,
    n: usize,
) -> Result<Vec<Slice>, SurfaceError> {
    slice_surface(pm, circle, n).map(|sliced| sliced.slices)
}

/// Slices the circle like [`slice_circle`] and returns the notes of the slicing too (E10a).
///
/// An interior air run splits the soil into blocks (E10a). Only the main block (the heaviest one) is analysed: the
/// other blocks and every interior air slice are removed, and the note `truncated_mass` is raised. The checks of the
/// arc's ends (E10a′) apply to the analysed block only.
pub fn slice_surface(
    pm: &PreparedModel,
    circle: &Circle,
    n: usize,
) -> Result<SlicedSurface, SurfaceError> {
    let Built {
        mut slices,
        mut air,
        mut unsupported,
        tramo,
    } = build_slices(pm, circle, n)?;
    // Built left to right; the toe is on the left for RightToLeft and on the right otherwise.
    if pm.sliding == Sliding::LeftToRight {
        slices.reverse();
        air.reverse();
        unsupported.reverse();
    }
    let (lo, hi, truncated) = match main_block_range(&slices, &air) {
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
    check_block_ends(pm, circle, &tramo, l, r)?;
    if unsupported[lo..hi].iter().any(|&u| u) {
        return Err(SurfaceError::NoMaterial);
    }
    let notes = if truncated {
        vec![TRUNCATED_MASS.to_string()]
    } else {
        Vec::new()
    };
    Ok(SlicedSurface {
        slices: slices[lo..hi].to_vec(),
        notes,
    })
}

/// Builds the slices of `circle` in model order (left to right). Nothing is truncated and the ends of the arc are not
/// checked here: `slice_surface` applies E10a and E10a′. The tests of E2 geometry use this function directly.
pub(crate) fn build_slices(
    pm: &PreparedModel,
    circle: &Circle,
    n: usize,
) -> Result<Built, SurfaceError> {
    if n == 0 {
        return Err(SurfaceError::TooFewSlices);
    }
    let tramo = sliding_span(pm, circle)?;
    let (p, q) = (tramo.p, tramo.q);
    let span = q - p;
    let min_width = 1e-9 * span;

    // Slice boundaries: n uniform divisions plus the breakpoints, sorted and merged.
    let mut nodes: Vec<f64> = Vec::with_capacity(n + tramo.breaks.len());
    nodes.extend((1..n).map(|k| p + span * (k as f64) / (n as f64)));
    nodes.extend(tramo.breaks.iter().copied().filter(|&x| x > p && x < q));
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
        let yl = pm.arc_y(circle, true, xl);
        let yr = pm.arc_y(circle, true, xr);
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
            });
            air_flags.push(false);
            unsupported.push(true);
            continue;
        };
        let m = &pm.materials[mat];

        let weight = width * col;
        let sigma_v = col;
        let pore_pressure = if let Some(ru) = m.ru {
            ru * sigma_v
        } else if let Some(z) = piezo {
            pm.gamma_w * (z - y_base_mid).max(0.0)
        } else {
            0.0
        };

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
            cohesion: m.cohesion,
            tan_phi: m.tan_phi,
            pore_pressure,
            material: mat,
        });
        air_flags.push(false);
        unsupported.push(false);
    }

    // Degenerate case (E2): every slice has its base above the ground, so there is no soil to slide.
    if !slices.iter().any(|s| s.weight > 0.0) {
        return Err(SurfaceError::AboveGround);
    }
    Ok(Built {
        slices,
        air: air_flags,
        unsupported,
        tramo,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Model;
    use serde_json::{Value, json};

    /// E10a on a toe-first sequence: the sequence cut to its main block, and whether anything was removed.
    fn truncate_to_main_block(slices: Vec<Slice>, air: &[bool]) -> (Vec<Slice>, bool) {
        match main_block_range(&slices, air) {
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

    /// E10a: the lighter block is removed, however small; the heavier one is the main block and is kept whole.
    #[test]
    fn lighter_block_is_removed_at_any_size() {
        for (w_first, w_second, kept_weight) in [(0.9, 0.001, 0.9), (1.0, 1.1e-3, 1.0)] {
            let (s, flags) = two_blocks(w_first, w_second);
            let (out, truncated) = truncate_to_main_block(s, &flags);
            assert!(truncated);
            assert_eq!(out.len(), 1);
            assert_eq!(out[0].weight, kept_weight);
        }
        // Order does not matter: a light first block is dropped as well.
        let (s, flags) = two_blocks(0.001, 0.9);
        let (out, truncated) = truncate_to_main_block(s, &flags);
        assert!(truncated);
        assert_eq!(out.iter().map(|x| x.weight).collect::<Vec<_>>(), vec![0.9]);
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

    /// E10a: with three blocks the heaviest one wins, whichever position it has.
    #[test]
    fn heaviest_of_three_blocks_is_the_main_one() {
        let flags = [false, true, false, true, false];
        let big_middle = vec![soil(0.3), air(), soil(0.5), air(), soil(0.2)];
        let (out, truncated) = truncate_to_main_block(big_middle, &flags);
        assert!(truncated);
        assert_eq!(out.iter().map(|x| x.weight).collect::<Vec<_>>(), vec![0.5]);
    }

    /// E10a: on a tie the block nearest the entry wins. In toe-first order the entry is the last index.
    #[test]
    fn tie_goes_to_the_block_nearest_the_entry() {
        let (s, flags) = two_blocks(0.5, 0.5);
        let mut marked = s.clone();
        marked[0].x_left = -1.0; // toe-side block
        marked[2].x_left = -2.0; // entry-side block
        let (out, truncated) = truncate_to_main_block(marked, &flags);
        assert!(truncated);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].x_left, -2.0, "the entry-side block must win the tie");
    }

    /// E10a: air slices at the ends are kept only when they touch the main block. Toe air next to the main
    /// block is kept; crest air that sits beyond a removed block is dropped.
    #[test]
    fn end_air_is_kept_only_next_to_the_main_block() {
        // Toe air, the main block (heaviest, first soil block), an interior air slice, a light block, crest air.
        let s = vec![air(), soil(1.0), air(), soil(0.1), air()];
        let flags = [true, false, true, false, true];
        let (out, truncated) = truncate_to_main_block(s, &flags);
        assert!(truncated);
        let kinds: Vec<bool> = out.iter().map(|x| x.weight == 0.0).collect();
        assert_eq!(
            kinds,
            vec![true, false],
            "toe air kept, block 2 and its air removed"
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
        let built = build_slices(&pm, &c, 50).expect("the notch is air, not an error (E2)");
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
        // The soil lies on both sides of the notch: E10a keeps only the heavier block, and no air is left inside it.
        let (main, truncated) = truncate_to_main_block(sl.clone(), &flags);
        assert!(truncated);
        assert!(
            main.iter().all(|s| s.weight > 0.0),
            "no air in the main block"
        );
        let w_main: f64 = main.iter().map(|s| s.weight).sum();
        let blocks = soil_blocks(&sl, &flags);
        let w_max = blocks.iter().map(|b| b.2).fold(0.0, f64::max);
        assert!(
            (w_main - w_max).abs() <= 1e-12 * w_max,
            "main block is the heaviest"
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
        let built = build_slices(&pm, &c, 2000).expect("the gap is air (E2)");
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
        // E10a: the toe lens and the face are two blocks; only the heavier one is analysed.
        let (main, truncated) = truncate_to_main_block(sl.clone(), &flags);
        assert!(truncated);
        assert!(main.len() < sl.len());
        assert!(main.iter().all(|s| s.weight > 0.0));
    }
}
