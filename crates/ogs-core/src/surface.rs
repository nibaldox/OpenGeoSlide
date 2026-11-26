//! Slip surface of the engine: a circle or a fixed polyline (contract F3.3, amendment E13c).
//!
//! The slicer, the checks of the block ends and `resolve_sliding` (step 3) go through [`Surface`]:
//! - On a circle, every operation delegates to the existing code and changes no bit: `y_at` is
//!   `PreparedModel::arc_y(c, true, x)`, `ground_crossings` is `slicer::sliding_span`, `break_points` is
//!   `PreparedModel::arc_profile(c, true, a, b)`, `below_base` is `PreparedModel::arc_below_base`.
//! - On a polyline (F3.3, wave 1): the terrain is cut into pieces between the vertex abscissae of the model, where it
//!   is a straight line (`GroundPiece`), and the polyline is fitted to it with the rules of cSlope's
//!   `fit_polyline_to_ground`: each end is extended to its first crossing with the ground or trimmed at it, and the
//!   result is checked for admissibility. The vertices of the fitted polyline are obligatory nodes of the cut.
//!
//! [`validate_polyline`] checks the format of the polyline (F3.3).

use crate::OgsError;
use crate::geometry::PreparedModel;
use crate::model::{Circle, Point, SurfaceSpec};
use crate::report::SurfaceOut;
use crate::slicer::{SurfaceError, Tramo, sliding_span};

/// Status reason (`Invalid`, E13c): the extension of the polyline leaves the model without cutting the ground.
pub const POLYLINE_NO_GROUND_CROSSING: &str = "polyline_no_ground_crossing";
/// Status reason (`Invalid`, E13c): an interior vertex is not strictly under the ground, or a segment passes over it.
pub const POLYLINE_OUTSIDE_GROUND: &str = "polyline_outside_ground";

/// Minimum separation of the `x` of two consecutive vertices of a polyline, relative to the model width (F3.3).
pub const POLYLINE_MIN_DX_FRACTION: f64 = 1e-9;

/// Polyline `[[x, y], …]` with `x` strictly increasing (validated by [`validate_polyline`]).
///
/// The one in a `Surface` that is analysed is the **fitted** one (see [`Surface::fit_to_ground`]).
#[derive(Debug, Clone, PartialEq)]
pub struct Polyline {
    pub points: Vec<Point>,
}

/// The slip surface: a circle (fixed, or the result of the search) or a fixed polyline.
#[derive(Debug, Clone, PartialEq)]
pub enum Surface {
    Circle(Circle),
    Polyline(Polyline),
}

impl Surface {
    /// The surface that a `analysis.surface` declares. The polyline keeps its points as written; it is not fitted
    /// to the ground yet.
    pub fn from_spec(spec: &SurfaceSpec) -> Self {
        match spec {
            SurfaceSpec::Circle(c) => Surface::Circle(*c),
            SurfaceSpec::Polyline { points } => Surface::Polyline(Polyline {
                points: points.clone(),
            }),
        }
    }

    /// Ordinate of the **lower** surface at `x`.
    ///
    /// - Circle: `PreparedModel::arc_y(c, true, x)`, clamped to the circle (the `y` of the lower arc).
    /// - Polyline: linear interpolation between its two vertices around `x`, exact at the vertices. Outside
    ///   `[x_first, x_last]` the extrapolation is that of the end segment (the fitted polyline ends at the ground).
    pub(crate) fn y_at(&self, pm: &PreparedModel, x: f64) -> f64 {
        match self {
            Surface::Circle(c) => pm.arc_y(c, true, x),
            Surface::Polyline(p) => polyline_y(&p.points, x),
        }
    }

    /// Sliding range of the surface: its outermost crossings with the ground `p < q`, plus the slice breakpoints
    /// over `[a, b]` (the [`Tramo`] of the slicer, step 1-3 of contract §4.1). Only `NoIntersection` is raised here;
    /// the checks of the block ends belong to the analysed block (E10a′).
    ///
    /// - Circle: `slicer::sliding_span(pm, c)`.
    /// - Polyline (already fitted): `[a, b]` is the span of its vertices; `p` and `q` are the outermost ends of the
    ///   pieces that lie under the ground (the ends of the fitted polyline, unless an end segment runs along the
    ///   ground); `breaks` come from [`Surface::break_points`].
    pub(crate) fn ground_crossings(&self, pm: &PreparedModel) -> Result<Tramo, SurfaceError> {
        match self {
            Surface::Circle(c) => sliding_span(pm, c),
            Surface::Polyline(poly) => {
                let pts = &poly.points;
                let (Some(first), Some(last)) = (pts.first(), pts.last()) else {
                    return Err(SurfaceError::NoIntersection);
                };
                let (a, b) = (first[0], last[0]);
                if a >= b {
                    return Err(SurfaceError::NoIntersection);
                }
                let (xs, under) = self.break_points(pm, a, b);
                // Maximal intervals where the surface is under the ground; E2: the range runs between the outermost
                // ones, and what lies above the ground in between is made of air slices.
                let first_under = under.iter().position(|&u| u);
                let last_under = under.iter().rposition(|&u| u);
                let (Some(i), Some(j)) = (first_under, last_under) else {
                    return Err(SurfaceError::NoIntersection);
                };
                Ok(Tramo {
                    p: xs[i],
                    q: xs[j + 1],
                    breaks: xs,
                    a,
                    b,
                })
            }
        }
    }

    /// Slice breakpoints in `[a, b]` (both ends included, sorted, near-duplicates merged) and, for each piece
    /// between them, whether the surface lies under the ground.
    ///
    /// - Circle: `PreparedModel::arc_profile(c, true, a, b)`: region and piezometric vertices and arc–edge crossings.
    /// - Polyline: the same vertices, **plus the vertices of the polyline** (they are obligatory nodes of the cut,
    ///   so the base of each slice is straight) and the segment–edge crossings. A vertex of the polyline wins over a
    ///   region vertex that is within `1e-9·scale` of it.
    pub(crate) fn break_points(&self, pm: &PreparedModel, a: f64, b: f64) -> (Vec<f64>, Vec<bool>) {
        match self {
            Surface::Circle(c) => pm.arc_profile(c, true, a, b),
            Surface::Polyline(p) => polyline_break_points(pm, &p.points, a, b),
        }
    }

    /// True if the surface goes below the model base somewhere on the span of the breakpoints `xs`.
    ///
    /// - Circle: `PreparedModel::arc_below_base`.
    /// - Polyline: `surface − base` is linear on each piece between consecutive breakpoints, so its minimum is at a
    ///   piece end.
    pub(crate) fn below_base(&self, pm: &PreparedModel, xs: &[f64]) -> bool {
        match self {
            Surface::Circle(c) => pm.arc_below_base(c, xs),
            Surface::Polyline(p) => {
                let tol = pm.tol();
                xs.windows(2).any(|w| {
                    let (lo, hi) = (w[0], w[1]);
                    let p1 = lo + 0.25 * (hi - lo);
                    let q1 = lo + 0.75 * (hi - lo);
                    let (Some(b1), Some(b2)) = (pm.bottom_at(p1), pm.bottom_at(q1)) else {
                        return false;
                    };
                    let s = (b2 - b1) / (q1 - p1);
                    let f = |x: f64| polyline_y(&p.points, x) - (b1 + s * (x - p1));
                    f(lo).min(f(hi)) < -tol
                })
            }
        }
    }

    /// `(yc, r)`, the centre height and the radius that Bishop's moment arm needs (`driving_extra`, E12b): `Some`
    /// for a circle and `None` for a polyline.
    ///
    /// A polyline has no centre, and the FS of Bishop would depend on the point where the moments are taken, which
    /// is not a physical parameter. That is why Bishop is not offered on a polyline (F3.6, E13f), and why the slicer
    /// leaves `driving_extra` at 0 there. Spencer, Morgenstern-Price and Janbu take moments about the midpoints of
    /// the bases and do not read `driving_extra`.
    pub(crate) fn moment_arm(&self) -> Option<(f64, f64)> {
        match self {
            Surface::Circle(c) => Some((c.yc, c.r)),
            Surface::Polyline(_) => None,
        }
    }

    /// The vertices of a polyline are obligatory nodes of the cut (E13c); a circle has none.
    pub(crate) fn is_polyline(&self) -> bool {
        matches!(self, Surface::Polyline(_))
    }

    /// The surface that is analysed: a circle is itself; a polyline is **extended** at each end, along its end
    /// segment, to its first crossing with the ground, or **trimmed** at the crossing if the end point is already on
    /// or over the ground (`fit_polyline_to_ground` of cSlope, F3.3). The result is what the report emits.
    ///
    /// Errors, the reasons of the `Invalid` status: [`POLYLINE_NO_GROUND_CROSSING`] if an extension leaves the model
    /// x range without cutting the ground, and [`POLYLINE_OUTSIDE_GROUND`] if an interior vertex is not strictly
    /// under the ground or inside the model, or a segment passes over the ground (grazing a ground vertex is allowed).
    ///
    /// Tolerance: `1e-9·scale` (`PreparedModel::tol`). An end within that distance of the ground is on it and stays
    /// as written.
    pub(crate) fn fit_to_ground(&self, pm: &PreparedModel) -> Result<Surface, &'static str> {
        match self {
            Surface::Circle(_) => Ok(self.clone()),
            Surface::Polyline(p) => {
                fit_polyline(pm, &p.points).map(|points| Surface::Polyline(Polyline { points }))
            }
        }
    }

    /// The surface as the report emits it: `{xc, yc, r}` for a circle, `{points}` for a polyline.
    pub fn to_report(&self) -> SurfaceOut {
        match self {
            Surface::Circle(c) => SurfaceOut::Circle(*c),
            Surface::Polyline(p) => SurfaceOut::Polyline {
                points: p.points.clone(),
            },
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Polyline operations

/// Height of the polyline at `x`: the linear interpolation of the segment that contains `x`, exact at the vertices.
/// Outside the first and the last vertex, the end segments are extended.
fn polyline_y(pts: &[Point], x: f64) -> f64 {
    let n = pts.len();
    if n == 0 {
        return f64::NAN;
    }
    if n == 1 {
        return pts[0][1];
    }
    if x == pts[n - 1][0] {
        return pts[n - 1][1];
    }
    let i = pts.partition_point(|p| p[0] <= x).clamp(1, n - 1) - 1;
    segment_y(pts, i, x)
}

/// Height at `x` of the line through the segment `i` (vertices `i` and `i + 1`).
fn segment_y(pts: &[Point], i: usize, x: f64) -> f64 {
    let (a, b) = (pts[i], pts[i + 1]);
    a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0])
}

/// A stretch of the ground between two consecutive vertex abscissae of the model, where the terrain (the upper
/// envelope of the regions) is a straight line. `y0` and `y1` are the **one-sided limits** at `x0` and `x1`: they
/// differ from the other side of the abscissa at a vertical face.
#[derive(Debug, Clone, Copy)]
struct GroundPiece {
    x0: f64,
    x1: f64,
    y0: f64,
    y1: f64,
}

impl GroundPiece {
    fn y(&self, x: f64) -> f64 {
        self.y0 + (x - self.x0) * (self.y1 - self.y0) / (self.x1 - self.x0)
    }
}

/// The ground of the model as pieces between consecutive vertex abscissae, left to right. An interval that no region
/// covers (a gap between regions) has no piece.
fn ground_pieces(pm: &PreparedModel) -> Vec<GroundPiece> {
    let mut pieces = Vec::with_capacity(pm.vertex_xs.len());
    for w in pm.vertex_xs.windows(2) {
        let (x0, x1) = (w[0], w[1]);
        let xm = 0.5 * (x0 + x1);
        // The edge that is the top at the middle of the interval is the top over the whole interval: no two edges
        // of the regions cross in it.
        let mut best: Option<(f64, [Point; 2])> = None;
        for e in &pm.edges {
            let [a, b] = *e;
            if a[0] == b[0] || xm < a[0].min(b[0]) || xm > a[0].max(b[0]) {
                continue;
            }
            let y = a[1] + (xm - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
            if best.is_none_or(|(by, _)| y > by) {
                best = Some((y, *e));
            }
        }
        if let Some((_, [a, b])) = best {
            let line = |x: f64| a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
            pieces.push(GroundPiece {
                x0,
                x1,
                y0: line(x0),
                y1: line(x1),
            });
        }
    }
    pieces
}

/// The same ground seen in the mirror `x → −x` (pieces in left-to-right order).
fn mirror_pieces(pieces: &[GroundPiece]) -> Vec<GroundPiece> {
    pieces
        .iter()
        .rev()
        .map(|g| GroundPiece {
            x0: -g.x1,
            x1: -g.x0,
            y0: g.y1,
            y1: g.y0,
        })
        .collect()
}

fn mirror_points(pts: &[Point]) -> Vec<Point> {
    pts.iter().rev().map(|p| [-p[0], p[1]]).collect()
}

/// A stretch `[u, v]` of the polyline over one segment and one ground piece, with `h = polyline − ground` at both
/// ends (the ground limits taken inside the stretch). `h` is linear on it.
#[derive(Debug, Clone, Copy)]
struct Stretch {
    u: f64,
    v: f64,
    hu: f64,
    hv: f64,
}

/// The stretches of `pts` over `[x_first, x_last]`, split at the vertices of the polyline and of the ground. `None`
/// if the ground has a gap somewhere under the polyline.
fn stretches(pts: &[Point], pieces: &[GroundPiece]) -> Option<Vec<Stretch>> {
    let (x_first, x_last) = (pts[0][0], pts[pts.len() - 1][0]);
    let mut xs: Vec<f64> = pts
        .iter()
        .map(|p| p[0])
        .chain(pieces.iter().flat_map(|g| [g.x0, g.x1]))
        .filter(|&x| x >= x_first && x <= x_last)
        .collect();
    xs.sort_by(f64::total_cmp);
    xs.dedup();
    let mut out = Vec::with_capacity(xs.len());
    for w in xs.windows(2) {
        let (u, v) = (w[0], w[1]);
        let xm = 0.5 * (u + v);
        let g = pieces.iter().find(|g| g.x0 <= xm && xm <= g.x1)?;
        let i = pts.partition_point(|p| p[0] <= xm).clamp(1, pts.len() - 1) - 1;
        out.push(Stretch {
            u,
            v,
            hu: segment_y(pts, i, u) - g.y(u),
            hv: segment_y(pts, i, v) - g.y(v),
        });
    }
    Some(out)
}

/// Fits the first end of `pts` (the one with the smallest `x`) to the ground: it is extended to the first crossing if
/// it is under the ground, trimmed at the first crossing from over to under if it is over, and kept if it is on it.
/// The other end is fitted by calling this on the mirror image.
fn fit_start(pts: &[Point], pieces: &[GroundPiece], tol: f64) -> Result<Vec<Point>, &'static str> {
    let (p0, p1) = (pts[0], pts[1]);
    // The surface runs to the right of p0, so the ground that matters at p0 is the one on its right.
    let Some(g0) = pieces
        .iter()
        .find(|g| g.x0 <= p0[0] && p0[0] < g.x1)
        .map(|g| g.y(p0[0]))
    else {
        return Err(POLYLINE_NO_GROUND_CROSSING);
    };
    let h0 = p0[1] - g0;
    if h0.abs() <= tol {
        return Ok(pts.to_vec());
    }
    if h0 < 0.0 {
        // Extension along the end segment, toward smaller x, to the first crossing with the ground.
        let slope = (p1[1] - p0[1]) / (p1[0] - p0[0]);
        let line = |x: f64| p0[1] + slope * (x - p0[0]);
        let mut reach = p0[0];
        let mut found = None;
        for g in pieces.iter().rev().filter(|g| g.x0 < p0[0]) {
            if g.x1 < reach - tol {
                break; // a gap in the ground
            }
            let hi = g.x1.min(p0[0]);
            let hb = line(hi) - g.y(hi);
            if hb >= -tol {
                // At a vertical face the ground drops: the surface comes out through the face.
                found = Some(hi);
                break;
            }
            let lo = g.x0;
            let ha = line(lo) - g.y(lo);
            if ha >= -tol {
                found = Some(if ha > 0.0 {
                    hi - (hi - lo) * (-hb) / (ha - hb)
                } else {
                    lo
                });
                break;
            }
            reach = lo;
        }
        let xc = found.ok_or(POLYLINE_NO_GROUND_CROSSING)?;
        if p0[0] - xc <= tol {
            // The end was already on the ground, at a face.
            return Ok(pts.to_vec());
        }
        let mut out = Vec::with_capacity(pts.len() + 1);
        out.push([xc, line(xc)]);
        out.extend_from_slice(pts);
        return Ok(out);
    }
    // Trim: the first place where the polyline goes from over (or on) the ground to under it.
    let subs = stretches(pts, pieces).ok_or(POLYLINE_NO_GROUND_CROSSING)?;
    for s in subs {
        if s.hv < -tol || s.hu < -tol {
            let xc = if s.hu > 0.0 && s.hv < -tol {
                s.u + (s.v - s.u) * s.hu / (s.hu - s.hv)
            } else {
                s.u
            };
            let mut out = vec![[xc, polyline_y(pts, xc)]];
            out.extend(pts.iter().filter(|p| p[0] > xc + tol).copied());
            if out.len() < 2 {
                return Err(POLYLINE_NO_GROUND_CROSSING);
            }
            return Ok(out);
        }
    }
    Err(POLYLINE_NO_GROUND_CROSSING)
}

/// `fit_to_ground` of a polyline (F3.3): see [`Surface::fit_to_ground`].
fn fit_polyline(pm: &PreparedModel, points: &[Point]) -> Result<Vec<Point>, &'static str> {
    let n = points.len();
    if n < 2
        || points
            .iter()
            .any(|p| !(p[0].is_finite() && p[1].is_finite()))
    {
        return Err(POLYLINE_NO_GROUND_CROSSING);
    }
    let tol = pm.tol();
    // A vertex outside the model in x: an end enters through a side wall (no crossing with the ground), an interior
    // one is not inside the model.
    for (i, p) in points.iter().enumerate() {
        if p[0] < pm.x_min - tol || p[0] > pm.x_max + tol {
            return Err(if i == 0 || i == n - 1 {
                POLYLINE_NO_GROUND_CROSSING
            } else {
                POLYLINE_OUTSIDE_GROUND
            });
        }
    }
    let pieces = ground_pieces(pm);
    let start = fit_start(points, &pieces, tol)?;
    let end = fit_start(&mirror_points(&start), &mirror_pieces(&pieces), tol)?;
    let fitted = mirror_points(&end);
    if fitted.len() < 2 || fitted.windows(2).any(|w| w[1][0] <= w[0][0]) {
        return Err(POLYLINE_NO_GROUND_CROSSING);
    }
    check_admissible(pm, &fitted, &pieces, tol)?;
    Ok(fitted)
}

/// Admissibility of a fitted polyline (F3.3): the interior vertices are strictly under the ground and inside the
/// model, and no segment passes over the ground. Touching a vertex of the ground is allowed (within `tol`).
fn check_admissible(
    pm: &PreparedModel,
    fitted: &[Point],
    pieces: &[GroundPiece],
    tol: f64,
) -> Result<(), &'static str> {
    let n = fitted.len();
    for p in &fitted[1..n - 1] {
        if !(p[0] > pm.x_min && p[0] < pm.x_max) {
            return Err(POLYLINE_OUTSIDE_GROUND);
        }
        // Both sides of a vertical face count: the vertex must be under the lower one.
        let left = pieces
            .iter()
            .find(|g| g.x0 < p[0] && p[0] <= g.x1)
            .map(|g| g.y(p[0]));
        let right = pieces
            .iter()
            .find(|g| g.x0 <= p[0] && p[0] < g.x1)
            .map(|g| g.y(p[0]));
        let ground = match (left, right) {
            (Some(l), Some(r)) => l.min(r),
            (Some(g), None) | (None, Some(g)) => g,
            (None, None) => return Err(POLYLINE_OUTSIDE_GROUND),
        };
        if p[1] >= ground - tol {
            return Err(POLYLINE_OUTSIDE_GROUND);
        }
    }
    let subs = stretches(fitted, pieces).ok_or(POLYLINE_OUTSIDE_GROUND)?;
    if subs.iter().any(|s| s.hu > tol || s.hv > tol) {
        return Err(POLYLINE_OUTSIDE_GROUND);
    }
    Ok(())
}

/// Abscissae where the segment `a → b` meets the edge `c → d` (at most one, none if they are parallel).
fn segment_edge_x(a: Point, b: Point, c: Point, d: Point) -> Option<f64> {
    let (r, s) = ([b[0] - a[0], b[1] - a[1]], [d[0] - c[0], d[1] - c[1]]);
    let den = r[0] * s[1] - r[1] * s[0];
    if den == 0.0 {
        return None;
    }
    let ca = [c[0] - a[0], c[1] - a[1]];
    let t = (ca[0] * s[1] - ca[1] * s[0]) / den;
    let u = (ca[0] * r[1] - ca[1] * r[0]) / den;
    let range = -1e-12..=1.0 + 1e-12;
    (range.contains(&t) && range.contains(&u)).then(|| a[0] + t * r[0])
}

/// `break_points` of a polyline: see [`Surface::break_points`].
fn polyline_break_points(
    pm: &PreparedModel,
    pts: &[Point],
    a: f64,
    b: f64,
) -> (Vec<f64>, Vec<bool>) {
    let tol = pm.tol();
    let inside = |x: f64| x > a && x < b;
    // The vertices of the polyline are obligatory.
    let vertices: Vec<f64> = pts.iter().map(|p| p[0]).filter(|&x| inside(x)).collect();
    let mut others: Vec<f64> = Vec::with_capacity(pm.vertex_xs.len() + 16);
    others.extend(pm.vertex_xs.iter().copied().filter(|&x| inside(x)));
    if let Some(line) = &pm.piezometric {
        others.extend(line.iter().map(|p| p[0]).filter(|&x| inside(x)));
    }
    for w in pts.windows(2) {
        for e in &pm.edges {
            if let Some(x) = segment_edge_x(w[0], w[1], e[0], e[1])
                && inside(x)
                && x >= w[0][0]
                && x <= w[1][0]
            {
                others.push(x);
            }
        }
    }
    // A breakpoint within `tol` of a vertex of the polyline is the vertex.
    others.retain(|&x| vertices.iter().all(|&v| (x - v).abs() > tol));
    let mut raw = vertices;
    raw.extend(others);
    raw.sort_by(f64::total_cmp);

    let mut xs = Vec::with_capacity(raw.len() + 2);
    xs.push(a);
    for &x in &raw {
        if x - xs[xs.len() - 1] > tol {
            xs.push(x);
        }
    }
    if b - xs[xs.len() - 1] <= tol && xs.len() > 1 {
        xs.pop();
    }
    xs.push(b);

    let under = xs
        .windows(2)
        .map(|w| {
            let xm = 0.5 * (w[0] + w[1]);
            let y = polyline_y(pts, xm);
            matches!(pm.top_at(xm), Some(g) if y < g)
        })
        .collect();
    (xs, under)
}

/// Format of the points of a polyline (F3.3): at least 2 points, all finite, `x` strictly increasing.
///
/// `model_width` is the width of the model, when it is known (after `PreparedModel::new`): then the separation of
/// the `x` of two consecutive points must be at least `1e-9 · model_width`. With `None`, only the order is checked.
/// Every failure is `InvalidModel`.
pub fn validate_polyline(points: &[Point], model_width: Option<f64>) -> Result<(), OgsError> {
    let invalid = OgsError::InvalidModel;
    if points.len() < 2 {
        return Err(invalid(format!(
            "analysis.surface: la polilínea necesita al menos 2 puntos, no {}",
            points.len()
        )));
    }
    if points
        .iter()
        .any(|p| !(p[0].is_finite() && p[1].is_finite()))
    {
        return Err(invalid(
            "analysis.surface: la polilínea tiene coordenadas no finitas".to_string(),
        ));
    }
    let min_dx = model_width.map_or(0.0, |w| POLYLINE_MIN_DX_FRACTION * w);
    let bad = |w: &[Point]| {
        let dx = w[1][0] - w[0][0];
        !(dx > 0.0 && dx >= min_dx)
    };
    if let Some(k) = points.windows(2).position(bad) {
        return Err(invalid(format!(
            "analysis.surface: la x de la polilínea debe ser estrictamente creciente \
             (con una separación de al menos 1e-9 por el ancho del modelo); fallan los puntos {k} y {}",
            k + 1
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn polyline_format_is_checked() {
        assert!(validate_polyline(&[[0.0, 0.0], [1.0, 1.0]], None).is_ok());
        assert!(validate_polyline(&[[0.0, 0.0]], None).is_err());
        assert!(validate_polyline(&[[0.0, 0.0], [0.0, 1.0]], None).is_err());
        assert!(validate_polyline(&[[0.0, 0.0], [f64::NAN, 1.0]], None).is_err());
        // 1e-9 · 100 = 1e-7.
        assert!(validate_polyline(&[[0.0, 0.0], [5e-8, 1.0]], Some(100.0)).is_err());
        assert!(validate_polyline(&[[0.0, 0.0], [2e-7, 1.0]], Some(100.0)).is_ok());
    }

    use crate::model::Model;
    use serde_json::{Value, json};

    /// V047a ground: flat at 25 for x ≤ 30, a ramp to 35 at x = 50, flat at 35 up to x = 70.
    fn pm_v047a() -> PreparedModel {
        pm_of(json!([
            [20, 20],
            [20, 25],
            [30, 25],
            [50, 35],
            [70, 35],
            [70, 20]
        ]))
    }

    /// A V-shaped valley: the ground falls to (15, 6) and rises again.
    fn pm_valley() -> PreparedModel {
        pm_of(json!([
            [0, 0],
            [0, 10],
            [10, 10],
            [15, 6],
            [20, 10],
            [30, 10],
            [30, 0]
        ]))
    }

    fn pm_of(polygon: Value) -> PreparedModel {
        let doc = json!({
            "format": "opengeoslide", "version": "0.1",
            "materials": [{"id": "soil", "name": "Soil", "model": "mohr_coulomb",
                           "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6}],
            "regions": [{"material": "soil", "polygon": polygon}],
            "slope": {"direction": "right_to_left"},
            "analysis": {}
        });
        let model: Model = serde_json::from_value(doc).expect("test model");
        PreparedModel::new(&model).expect("valid model")
    }

    fn polyline(points: &[[f64; 2]]) -> Surface {
        Surface::Polyline(Polyline {
            points: points.to_vec(),
        })
    }

    fn fitted_points(pm: &PreparedModel, points: &[[f64; 2]]) -> Vec<[f64; 2]> {
        match polyline(points).fit_to_ground(pm) {
            Ok(Surface::Polyline(p)) => p.points,
            other => panic!("expected a fitted polyline, got {other:?}"),
        }
    }

    fn assert_points(got: &[[f64; 2]], want: &[[f64; 2]], eps: f64) {
        assert_eq!(got.len(), want.len(), "{got:?} against {want:?}");
        for (g, w) in got.iter().zip(want) {
            assert!(
                (g[0] - w[0]).abs() <= eps && (g[1] - w[1]).abs() <= eps,
                "{got:?} against {want:?}"
            );
        }
    }

    #[test]
    fn y_at_interpolates_between_vertices_and_is_exact_at_them() {
        let pm = pm_v047a();
        let s = polyline(&[[31.0, 24.0], [40.0, 22.0], [46.0, 25.0]]);
        assert_eq!(s.y_at(&pm, 31.0), 24.0);
        assert_eq!(s.y_at(&pm, 40.0), 22.0);
        assert_eq!(s.y_at(&pm, 46.0), 25.0, "exact at the last vertex");
        assert!((s.y_at(&pm, 35.5) - 23.0).abs() < 1e-15);
        // Outside the vertices the end segments are extended.
        assert!((s.y_at(&pm, 28.0) - (24.0 + 3.0 * 2.0 / 9.0)).abs() < 1e-12);
        assert!((s.y_at(&pm, 49.0) - 26.5).abs() < 1e-12);
        let c = Surface::Circle(Circle {
            xc: 40.0,
            yc: 60.0,
            r: 40.0,
        });
        assert_eq!(
            c.y_at(&pm, 30.0),
            pm.arc_y(
                &Circle {
                    xc: 40.0,
                    yc: 60.0,
                    r: 40.0
                },
                true,
                30.0
            )
        );
    }

    /// Both ends under the ground are extended along their end segments to the first crossing with the ground.
    #[test]
    fn fit_extends_ends_that_are_under_the_ground() {
        let pm = pm_v047a();
        // Left: slope −2/9 rises toward the left and reaches the flat ground y = 25 at x = 26.5. Right: slope 0.5
        // reaches the flat ground y = 35 at x = 66.
        let got = fitted_points(&pm, &[[31.0, 24.0], [40.0, 22.0], [46.0, 25.0]]);
        assert_points(
            &got,
            &[
                [26.5, 25.0],
                [31.0, 24.0],
                [40.0, 22.0],
                [46.0, 25.0],
                [66.0, 35.0],
            ],
            1e-12,
        );
    }

    /// An end over the ground is trimmed at its first crossing, and the vertices outside it are dropped.
    #[test]
    fn fit_trims_ends_that_are_over_the_ground() {
        let pm = pm_v047a();
        let got = fitted_points(
            &pm,
            &[
                [28.0, 27.0],
                [35.0, 24.0],
                [41.0, 23.0],
                [46.0, 30.0],
                [53.0, 37.0],
            ],
        );
        let x_entry = 29.0 * 14.0 / 13.0; // (39 − 3x/7) = 10 + x/2
        assert_points(
            &got,
            &[
                [x_entry, 10.0 + 0.5 * x_entry],
                [35.0, 24.0],
                [41.0, 23.0],
                [46.0, 30.0],
                [51.0, 35.0],
            ],
            1e-12,
        );
        // An end vertex that is over the ground with the rest of the vertices under it is dropped too.
        let got = fitted_points(
            &pm,
            &[
                [28.0, 27.0],
                [29.0, 26.0],
                [35.0, 24.0],
                [41.0, 23.0],
                [46.0, 30.0],
                [51.0, 35.0],
            ],
        );
        assert!(
            got[0][0] > 29.0,
            "the vertex (29, 26) is outside the entry: {got:?}"
        );
        assert_eq!(got[got.len() - 1], [51.0, 35.0]);
    }

    /// An end that is already on the ground (within `1e-9·scale`) is kept as written.
    #[test]
    fn fit_keeps_an_end_that_is_on_the_ground() {
        let pm = pm_v047a();
        let pts = [
            [30.0, 25.0],
            [40.0, 24.0],
            [45.0, 27.0],
            [51.29111842105263, 35.0],
        ];
        assert_eq!(fitted_points(&pm, &pts), pts.to_vec());
    }

    /// An extension that leaves the model without cutting the ground is `polyline_no_ground_crossing`.
    #[test]
    fn polyline_no_ground_crossing() {
        let pm = pm_v047a();
        // The right end extends with slope 0.25 and only reaches y = 29.5 at the wall x = 70.
        assert_eq!(
            polyline(&[[32.0, 20.0], [40.0, 22.0]]).fit_to_ground(&pm),
            Err(POLYLINE_NO_GROUND_CROSSING)
        );
        // Left end: the surface goes down toward the left, away from the flat ground at y = 25.
        assert_eq!(
            polyline(&[[35.0, 22.0], [45.0, 27.0], [55.0, 34.0]]).fit_to_ground(&pm),
            Err(POLYLINE_NO_GROUND_CROSSING)
        );
        // A polyline that is over the ground everywhere never goes under it.
        assert_eq!(
            polyline(&[[35.0, 40.0], [45.0, 41.0]]).fit_to_ground(&pm),
            Err(POLYLINE_NO_GROUND_CROSSING)
        );
        // An end point beyond the model wall enters through the wall, not through the ground.
        assert_eq!(
            polyline(&[[15.0, 22.0], [40.0, 20.0], [55.0, 35.0]]).fit_to_ground(&pm),
            Err(POLYLINE_NO_GROUND_CROSSING)
        );
    }

    /// An interior vertex over the ground, or on it, or a segment over a valley, is `polyline_outside_ground`.
    #[test]
    fn polyline_outside_ground() {
        let pm = pm_v047a();
        // A vertex over the ground (the ground at x = 40 is 30).
        assert_eq!(
            polyline(&[[30.0, 25.0], [40.0, 32.0], [51.3, 35.0]]).fit_to_ground(&pm),
            Err(POLYLINE_OUTSIDE_GROUND)
        );
        // A vertex exactly on the ground is not strictly under it.
        assert_eq!(
            polyline(&[[30.0, 25.0], [40.0, 30.0], [51.0, 35.0]]).fit_to_ground(&pm),
            Err(POLYLINE_OUTSIDE_GROUND)
        );
        // Both vertices are under the ground, but the segment passes over the valley at (15, 6).
        let valley = pm_valley();
        assert_eq!(
            polyline(&[[4.0, 10.0], [12.0, 8.0], [18.0, 8.0], [26.0, 10.0]]).fit_to_ground(&valley),
            Err(POLYLINE_OUTSIDE_GROUND)
        );
        // The same polyline under the valley is admitted.
        assert!(
            polyline(&[[4.0, 10.0], [12.0, 5.0], [18.0, 5.0], [26.0, 10.0]])
                .fit_to_ground(&valley)
                .is_ok()
        );
        // A vertex outside the model in x, in the interior of the polyline.
        assert_eq!(
            polyline(&[[25.0, 25.0], [90.0, 20.0], [95.0, 35.0]]).fit_to_ground(&pm),
            Err(POLYLINE_OUTSIDE_GROUND)
        );
    }

    /// A segment that touches a vertex of the ground (the toe, here) is admitted (F3.3), and so is an extension that
    /// reaches a ground vertex exactly.
    #[test]
    fn grazing_a_ground_vertex_is_admitted() {
        let pm = pm_v047a();
        // The segment (26, 24) → (34, 26) has slope 0.25 and passes through the toe (30, 25), where the ground turns
        // from flat to a ramp of slope 0.5: it stays under the ground on both sides.
        let got = fitted_points(
            &pm,
            &[[22.0, 25.0], [26.0, 24.0], [34.0, 26.0], [44.0, 30.0]],
        );
        assert_eq!(got[0], [22.0, 25.0]);
        let last = got[got.len() - 1];
        assert!(
            (last[1] - 35.0).abs() < 1e-12 && (last[0] - 56.5).abs() < 1e-12,
            "{last:?}"
        );
        // The left extension of slope 0.25 reaches exactly the toe vertex (30, 25).
        let got = fitted_points(&pm, &[[34.0, 26.0], [38.0, 27.0], [46.0, 32.0]]);
        assert!(
            (got[0][0] - 30.0).abs() < 1e-9 && (got[0][1] - 25.0).abs() < 1e-9,
            "{got:?}"
        );
        assert_eq!(got.len(), 5, "both ends are extended: {got:?}");
    }

    /// A bench with a vertical face: the upper ground is 30 for x ≤ 20, the face drops to 20 at x = 20, and the lower
    /// ground is flat at 20 up to x = 30, climbs to 26 at x = 40 and is flat to x = 50.
    fn pm_face() -> PreparedModel {
        pm_of(json!([
            [0, 0],
            [0, 30],
            [20, 30],
            [20, 20],
            [30, 20],
            [40, 26],
            [50, 26],
            [50, 0]
        ]))
    }

    /// An end extends to its **first** crossing with the ground (F3.3), even if the line is under the ground again
    /// farther on, toward the wall of the model. (cSlope looks at the sign of the line at the wall and rejects such a
    /// polyline; the contract asks for the first crossing.) The right end is over the flat ground y = 35 and is trimmed.
    #[test]
    fn the_extension_stops_at_the_first_crossing_even_if_the_line_is_under_the_ground_again() {
        let pm = pm_v047a();
        // Slope 0.4327 < 0.5: going left the line meets the ramp at x = 47.449 and would be under the flat toe (25)
        // again at the wall x = 20.
        let got = fitted_points(&pm, &[[49.376544, 34.558057], [55.169382, 37.063078]]);
        assert_eq!(
            got.len(),
            3,
            "extended at the start, trimmed at the end: {got:?}"
        );
        assert_eq!(got[1], [49.376544, 34.558057]);
        assert!((got[0][0] - 47.449_312_894_65).abs() < 1e-8, "{got:?}");
        assert!(
            (got[0][1] - (10.0 + 0.5 * got[0][0])).abs() < 1e-9,
            "{got:?}"
        );
        assert!(
            (got[2][0] - 50.398_533_118_75).abs() < 1e-8 && (got[2][1] - 35.0).abs() < 1e-9,
            "{got:?}"
        );
    }

    /// The surface comes out through a vertical face of the ground: the extension ends on the face, at the ordinate of
    /// the line (not at the foot or at the top of the face).
    #[test]
    fn an_extension_comes_out_through_a_vertical_face() {
        let pm = pm_face();
        // Left: slope −5/12 reaches the upper ground y = 30 at x = 4.4. Right: slope −1/3, and at x = 20 the line is at
        // y = 24, between the foot (20) and the top (30) of the face.
        let got = fitted_points(&pm, &[[8.0, 28.5], [14.0, 26.0], [17.0, 25.0]]);
        assert_points(
            &got,
            &[
                [4.4, 30.0],
                [8.0, 28.5],
                [14.0, 26.0],
                [17.0, 25.0],
                [20.0, 24.0],
            ],
            1e-9,
        );
    }

    /// A polyline that goes through the face and over the lower ground leaves the soil in the middle: it is
    /// `polyline_outside_ground` and is not cut at the face (cSlope drops the rest of the polyline and analyses the
    /// first block; the contract says that no segment passes over the ground).
    #[test]
    fn a_polyline_that_leaves_through_a_vertical_face_is_outside_ground() {
        let pm = pm_face();
        assert_eq!(
            polyline(&[
                [14.807276, 28.907264],
                [16.854317, 28.679223],
                [18.803038, 28.189081],
                [23.634029, 12.021849],
                [33.59807, 21.859028]
            ])
            .fit_to_ground(&pm),
            Err(POLYLINE_OUTSIDE_GROUND)
        );
    }

    /// The breakpoints of a polyline: its vertices (obligatory nodes), the vertices of the regions that fall inside,
    /// and the crossings of its segments with the region edges.
    #[test]
    fn break_points_contain_the_vertices_of_the_polyline_and_of_the_model() {
        let pm = pm_v047a();
        let s = polyline(&[[31.0, 24.0], [37.0, 25.0], [44.0, 27.0], [60.0, 35.0]]);
        let (xs, under) = s.break_points(&pm, 31.0, 60.0);
        assert_eq!(xs, vec![31.0, 37.0, 44.0, 50.0, 60.0]);
        assert_eq!(under, vec![true; 4]);
        let tramo = s.ground_crossings(&pm).unwrap();
        assert_eq!(
            (tramo.p, tramo.q, tramo.a, tramo.b),
            (31.0, 60.0, 31.0, 60.0)
        );
        assert_eq!(tramo.breaks, xs);
    }

    /// A polyline that does not go under the ground has no sliding range.
    #[test]
    fn a_polyline_on_the_ground_has_no_intersection() {
        let pm = pm_v047a();
        let s = polyline(&[[52.0, 35.0], [60.0, 35.0]]);
        assert_eq!(s.ground_crossings(&pm), Err(SurfaceError::NoIntersection));
    }

    #[test]
    fn a_polyline_reports_its_points() {
        let s = Surface::from_spec(&SurfaceSpec::Polyline {
            points: vec![[0.0, 1.0], [2.0, 3.0]],
        });
        assert_eq!(
            s.to_report(),
            SurfaceOut::Polyline {
                points: vec![[0.0, 1.0], [2.0, 3.0]]
            }
        );
    }
}
