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

/// Sliding range of the lower arc: its two ground crossings, plus the arc breakpoints.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Tramo {
    /// Left crossing (smaller x).
    pub(crate) p: f64,
    /// Right crossing (larger x).
    pub(crate) q: f64,
    /// Lower-arc breakpoints over the arc's span inside the model (vertices, piezometric
    /// vertices and arc–edge crossings).
    pub(crate) breaks: Vec<f64>,
}

/// Finds the sliding range of the lower arc of `c` (contract §4.1, steps 1–3).
pub(crate) fn lower_arc_tramo(pm: &PreparedModel, c: &Circle) -> Result<Tramo, SurfaceError> {
    if !(c.xc.is_finite() && c.yc.is_finite() && c.r.is_finite()) || c.r <= 0.0 {
        return Err(SurfaceError::NoIntersection);
    }
    let (x_min, x_max) = (pm.x_min, pm.x_max);
    let tol = pm.tol();
    let (ap, bp) = (c.xc - c.r, c.xc + c.r);
    let (a, b) = (ap.max(x_min), bp.min(x_max));
    if a >= b {
        return Err(SurfaceError::NoIntersection);
    }
    let (xs, under) = pm.arc_profile(c, true, a, b);
    if !under.iter().any(|&u| u) {
        return Err(SurfaceError::NoIntersection);
    }
    // The arc leaves the model through a side wall while under the ground.
    let first_under = under[0];
    let last_under = under[under.len() - 1];
    if (first_under && ap < x_min - tol) || (last_under && bp > x_max + tol) {
        return Err(SurfaceError::OutsideModel);
    }
    if pm.arc_below_base(c, &xs) {
        return Err(SurfaceError::OutsideModel);
    }

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
    // ground between them; those slices are air slices (see `slice_circle`).
    let (Some(&(p, _)), Some(&(_, q))) = (intervals.first(), intervals.last()) else {
        return Err(SurfaceError::NoIntersection);
    };
    // One end of the sliding range is not a crossing of the lower arc: the arc is under the
    // ground at the edge of its span. The entry/exit then has to lie on the upper half.
    if p <= a || q >= b {
        let (_, upper_under) = pm.arc_profile(c, false, a, b);
        let upper_cross = upper_under.windows(2).any(|w| w[0] != w[1]);
        return Err(if upper_cross {
            SurfaceError::UpperArc
        } else {
            SurfaceError::NoIntersection
        });
    }
    Ok(Tramo { p, q, breaks: xs })
}

/// Slices the circle into `n` uniform divisions plus breakpoints (contract §4.1).
///
/// ORDER: `slices[0]` is the toe slice (exit); `slices[last]` is the crest slice (entry), regardless of sliding direction.
pub fn slice_circle(
    pm: &PreparedModel,
    circle: &Circle,
    n: usize,
) -> Result<Vec<Slice>, SurfaceError> {
    if n == 0 {
        return Err(SurfaceError::TooFewSlices);
    }
    let tramo = lower_arc_tramo(pm, circle)?;
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
            return Err(SurfaceError::NoMaterial);
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
    }

    // Degenerate case (E2): every slice has its base above the ground, so there is no soil to slide.
    if !slices.iter().any(|s| s.weight > 0.0) {
        return Err(SurfaceError::AboveGround);
    }

    // Built left to right; the toe is on the left for RightToLeft and on the right otherwise.
    if sliding == Sliding::LeftToRight {
        slices.reverse();
    }
    Ok(slices)
}
