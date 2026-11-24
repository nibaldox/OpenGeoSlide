//! Ground geometry: prepared model and the `Ground` trait used by the circular search.
//!
//! Terrain envelopes come from the region edges (contract §1). `slope.direction: auto` is
//! resolved in `PreparedModel::new` with the rule of amendment E1.

use crate::OgsError;
use crate::model::{Circle, Direction, Model, Point, SurfaceSpec};
use crate::slicer::lower_arc_tramo;

/// Default water unit weight when the `water` block is absent (contract §1).
const DEFAULT_WATER_UNIT_WEIGHT: f64 = 9.81;

/// A region polygon is degenerate when its area is at most this fraction of `scale²` (R1-11).
const DEGENERATE_AREA_FRACTION: f64 = 1e-12;

/// Direction in which the sliding mass moves (resolved; `Auto` is decided by `PreparedModel::new`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Sliding {
    LeftToRight,
    RightToLeft,
}

/// Terrain queries needed by the circular search.
pub trait Ground {
    /// Ground surface elevation at `x`; `None` outside the model.
    fn y_top(&self, x: f64) -> Option<f64>;
    /// Horizontal extent of the model `(x_min, x_max)`.
    fn x_range(&self) -> (f64, f64);
    /// Resolved sliding direction.
    fn sliding(&self) -> Sliding;
}

/// Material with precomputed `tan φ`.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ResolvedMaterial {
    pub(crate) unit_weight: f64,
    pub(crate) unit_weight_sat: Option<f64>,
    pub(crate) cohesion: f64,
    pub(crate) tan_phi: f64,
    pub(crate) ru: Option<f64>,
}

/// Region with its material resolved to an index into `PreparedModel::materials`.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct PreparedRegion {
    pub(crate) material: usize,
    pub(crate) polygon: Vec<Point>,
}

/// Model prepared for evaluation.
#[derive(Debug)]
pub struct PreparedModel {
    /// Same order as `Model.materials`, so slice material indices match the model.
    pub(crate) materials: Vec<ResolvedMaterial>,
    pub(crate) regions: Vec<PreparedRegion>,
    pub(crate) piezometric: Option<Vec<Point>>,
    pub(crate) gamma_w: f64,
    pub(crate) sliding: Sliding,
    /// Every polygon edge, closed implicitly.
    pub(crate) edges: Vec<[Point; 2]>,
    /// Sorted, unique abscissae of all region vertices.
    pub(crate) vertex_xs: Vec<f64>,
    pub(crate) x_min: f64,
    pub(crate) x_max: f64,
    pub(crate) y_min: f64,
    pub(crate) y_max: f64,
    /// Characteristic model size; all geometric tolerances are relative to it.
    pub(crate) scale: f64,
}

fn invalid(msg: impl Into<String>) -> OgsError {
    OgsError::InvalidModel(msg.into())
}

fn resolve_materials(model: &Model) -> Result<Vec<ResolvedMaterial>, OgsError> {
    let mut out = Vec::with_capacity(model.materials.len());
    for (i, m) in model.materials.iter().enumerate() {
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
        if !(m.cohesion.is_finite() && m.cohesion >= 0.0) {
            return Err(invalid(format!(
                "la cohesión del material '{}' debe ser ≥ 0",
                m.id
            )));
        }
        if !(0.0..90.0).contains(&m.friction_angle) {
            return Err(invalid(format!(
                "el ángulo de fricción del material '{}' debe estar en [0, 90)",
                m.id
            )));
        }
        if let Some(ru) = m.ru
            && !(0.0..1.0).contains(&ru)
        {
            return Err(invalid(format!(
                "ru del material '{}' debe estar en [0, 1)",
                m.id
            )));
        }
        out.push(ResolvedMaterial {
            unit_weight: m.unit_weight,
            unit_weight_sat: m.unit_weight_sat,
            cohesion: m.cohesion,
            tan_phi: m.friction_angle.to_radians().tan(),
            ru: m.ru,
        });
    }
    Ok(out)
}

fn resolve_water(model: &Model) -> Result<(f64, Option<Vec<Point>>), OgsError> {
    let Some(water) = &model.water else {
        return Ok((DEFAULT_WATER_UNIT_WEIGHT, None));
    };
    if !(water.unit_weight.is_finite() && water.unit_weight > 0.0) {
        return Err(invalid("water.unit_weight debe ser > 0"));
    }
    let Some(line) = &water.piezometric_line else {
        return Ok((water.unit_weight, None));
    };
    if line.len() < 2 {
        return Err(invalid("la piezométrica necesita al menos 2 puntos"));
    }
    if line.iter().any(|p| !(p[0].is_finite() && p[1].is_finite())) {
        return Err(invalid("coordenadas no finitas en la piezométrica"));
    }
    if line.windows(2).any(|w| w[1][0] <= w[0][0]) {
        return Err(invalid(
            "la piezométrica debe tener x estrictamente creciente",
        ));
    }
    Ok((water.unit_weight, Some(line.clone())))
}

/// True if the polygon's area is at most `DEGENERATE_AREA_FRACTION · scale²` (or NaN).
///
/// The shoelace sum is taken relative to the first vertex and in units of `scale`, so the products
/// stay bounded: no overflow for huge models and no cancellation far from the origin.
/// `scale` must be finite and > 0.
fn polygon_is_degenerate(poly: &[Point], scale: f64) -> bool {
    let o = poly[0];
    let twice_area: f64 = poly
        .iter()
        .zip(poly.iter().cycle().skip(1))
        .map(|(a, b)| {
            let (ax, ay) = ((a[0] - o[0]) / scale, (a[1] - o[1]) / scale);
            let (bx, by) = ((b[0] - o[0]) / scale, (b[1] - o[1]) / scale);
            ax * by - bx * ay
        })
        .sum();
    let area = 0.5 * twice_area.abs();
    // NaN (never expected for finite input) is treated as degenerate rather than accepted.
    area.is_nan() || area <= DEGENERATE_AREA_FRACTION
}

/// Keeps the larger of two envelope candidates (`upper`) or the smaller one.
fn pick(best: Option<f64>, y: f64, upper: bool) -> Option<f64> {
    Some(match best {
        None => y,
        Some(v) if upper => v.max(y),
        Some(v) => v.min(y),
    })
}

/// Intersections of the circle with one segment, restricted to the requested half
/// (`lower`: y ≤ yc, otherwise y ≥ yc). Returns up to two abscissae.
fn circle_edge_xs(c: &Circle, seg: &[Point; 2], lower: bool, tol: f64) -> [Option<f64>; 2] {
    let [a, b] = *seg;
    let (dx, dy) = (b[0] - a[0], b[1] - a[1]);
    let aa = dx * dx + dy * dy;
    let mut out = [None, None];
    if aa <= 0.0 {
        return out;
    }
    let (fx, fy) = (a[0] - c.xc, a[1] - c.yc);
    let bb = 2.0 * (fx * dx + fy * dy);
    let cc = fx * fx + fy * fy - c.r * c.r;
    let disc = bb * bb - 4.0 * aa * cc;
    if disc < 0.0 {
        return out;
    }
    let sq = disc.sqrt();
    let roots = [(-bb - sq) / (2.0 * aa), (-bb + sq) / (2.0 * aa)];
    let mut k = 0;
    for t in roots
        .into_iter()
        .filter(|t| (-1e-12..=1.0 + 1e-12).contains(t))
    {
        let x = a[0] + t * dx;
        let y = a[1] + t * dy;
        let on_half = if lower {
            y <= c.yc + tol
        } else {
            y >= c.yc - tol
        };
        if on_half {
            out[k] = Some(x);
            k += 1;
        }
    }
    out
}

impl PreparedModel {
    /// Validates and prepares the model.
    ///
    /// Also resolves `slope.direction` (contract §1, amendment E1). Errors are `InvalidModel`.
    pub fn new(model: &Model) -> Result<Self, OgsError> {
        let materials = resolve_materials(model)?;
        if model.regions.is_empty() {
            return Err(invalid("el modelo no tiene regiones"));
        }
        let mut regions = Vec::with_capacity(model.regions.len());
        let mut edges = Vec::new();
        let mut vertex_xs = Vec::new();
        let (mut x_min, mut x_max) = (f64::INFINITY, f64::NEG_INFINITY);
        let (mut y_min, mut y_max) = (f64::INFINITY, f64::NEG_INFINITY);
        for (k, region) in model.regions.iter().enumerate() {
            let material = model
                .materials
                .iter()
                .position(|m| m.id == region.material)
                .ok_or_else(|| {
                    invalid(format!(
                        "la región {k} usa el material '{}', que no existe",
                        region.material
                    ))
                })?;
            let poly = &region.polygon;
            if poly.len() < 3 {
                return Err(invalid(format!("la región {k} tiene menos de 3 vértices")));
            }
            for p in poly {
                if !(p[0].is_finite() && p[1].is_finite()) {
                    return Err(invalid(format!(
                        "la región {k} tiene coordenadas no finitas"
                    )));
                }
                x_min = x_min.min(p[0]);
                x_max = x_max.max(p[0]);
                y_min = y_min.min(p[1]);
                y_max = y_max.max(p[1]);
                vertex_xs.push(p[0]);
            }
            edges.extend(
                poly.iter()
                    .zip(poly.iter().cycle().skip(1))
                    .map(|(&a, &b)| [a, b]),
            );
            regions.push(PreparedRegion {
                material,
                polygon: poly.clone(),
            });
        }
        vertex_xs.sort_by(f64::total_cmp);
        vertex_xs.dedup();
        // Width and height must be finite and strictly positive (contract §4.5, R1-11): a zero extent
        // is a one-dimensional polygon, and an overflowing extent makes every tolerance infinite.
        let (width, height) = (x_max - x_min, y_max - y_min);
        if !(width.is_finite() && height.is_finite() && width > 0.0 && height > 0.0) {
            return Err(invalid(format!(
                "el modelo debe tener ancho y alto finitos y > 0 (ancho = {width}, alto = {height})"
            )));
        }
        let scale = width.max(height);
        for (k, region) in regions.iter().enumerate() {
            if polygon_is_degenerate(&region.polygon, scale) {
                return Err(invalid(format!(
                    "la región {k} es degenerada: su área es nula"
                )));
            }
        }
        let (gamma_w, piezometric) = resolve_water(model)?;
        let mut pm = PreparedModel {
            materials,
            regions,
            piezometric,
            gamma_w,
            sliding: Sliding::LeftToRight,
            edges,
            vertex_xs,
            x_min,
            x_max,
            y_min,
            y_max,
            scale,
        };
        pm.sliding = pm.resolve_sliding(model)?;
        Ok(pm)
    }

    /// Piezometric elevation at `x`; `None` if there is no line or `x` is NaN.
    ///
    /// Outside the line's x-range the nearest end value is used, so `±∞` return the end values
    /// (contract §4.5, R1-04). A NaN abscissa is not a position on the line, so it gives `None`.
    pub fn piezometric_y(&self, x: f64) -> Option<f64> {
        let line = self.piezometric.as_ref()?;
        if x.is_nan() {
            return None;
        }
        let (first, last) = (line[0], line[line.len() - 1]);
        if x <= first[0] {
            return Some(first[1]);
        }
        if x >= last[0] {
            return Some(last[1]);
        }
        // First point with abscissa > x. Since first[0] < x < last[0] and the abscissae are
        // strictly increasing, the partition point is in 1..len, so both indices are valid.
        let i = line.partition_point(|p| p[0] <= x);
        let (a, b) = (line[i - 1], line[i]);
        Some(a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]))
    }

    /// Lower envelope of the regions at `x` (the model base); `None` outside the model.
    pub fn y_bottom(&self, x: f64) -> Option<f64> {
        self.bottom_at(x)
    }

    /// Geometric tolerance of the model (absolute length).
    pub(crate) fn tol(&self) -> f64 {
        1e-9 * self.scale
    }

    /// Upper envelope (terrain) at `x`.
    pub(crate) fn top_at(&self, x: f64) -> Option<f64> {
        self.envelope(x, true)
    }

    /// Lower envelope (base) at `x`.
    pub(crate) fn bottom_at(&self, x: f64) -> Option<f64> {
        self.envelope(x, false)
    }

    /// Max (`upper`) or min over all edge intersections with the vertical line at `x`.
    /// Vertical edges contribute both endpoints. `None` for NaN or outside the model.
    fn envelope(&self, x: f64, upper: bool) -> Option<f64> {
        if x.is_nan() {
            return None;
        }
        let mut best = None;
        for [a, b] in &self.edges {
            let (x0, x1) = if a[0] <= b[0] {
                (a[0], b[0])
            } else {
                (b[0], a[0])
            };
            if x < x0 || x > x1 {
                continue;
            }
            if a[0] == b[0] {
                best = pick(best, a[1], upper);
                best = pick(best, b[1], upper);
            } else {
                let y = a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
                best = pick(best, y, upper);
            }
        }
        best
    }

    /// Soil intervals `(lo, hi, material)` on the vertical line at `x`, per region.
    /// `x` must not coincide with a vertex abscissa; slice midpoints never do.
    /// Buffers are reused between calls to avoid allocation.
    pub(crate) fn column(&self, x: f64, out: &mut Vec<(f64, f64, usize)>, scratch: &mut Vec<f64>) {
        out.clear();
        for region in &self.regions {
            scratch.clear();
            let poly = &region.polygon;
            for (a, b) in poly.iter().zip(poly.iter().cycle().skip(1)) {
                if a[0] == b[0] {
                    continue;
                }
                let (x0, x1) = if a[0] < b[0] {
                    (a[0], b[0])
                } else {
                    (b[0], a[0])
                };
                if x < x0 || x >= x1 {
                    continue;
                }
                scratch.push(a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]));
            }
            scratch.sort_by(f64::total_cmp);
            out.extend(
                scratch
                    .chunks_exact(2)
                    .map(|h| (h[0], h[1], region.material)),
            );
        }
    }

    /// Height of the lower (`lower = true`) or upper arc of `c` at `x`, clamped to the circle.
    pub(crate) fn arc_y(&self, c: &Circle, lower: bool, x: f64) -> f64 {
        let t = x - c.xc;
        let s = (c.r * c.r - t * t).max(0.0).sqrt();
        if lower { c.yc - s } else { c.yc + s }
    }

    /// Height of the lower arc of `c` above the ground at `x`, i.e. `arc − ground` (negative when the
    /// arc is under the ground). `None` outside the model.
    pub(crate) fn arc_clearance(&self, c: &Circle, x: f64) -> Option<f64> {
        self.top_at(x).map(|g| self.arc_y(c, true, x) - g)
    }

    /// Breakpoints in `[a, b]` (both ends included, sorted, near-duplicates merged) and, for
    /// each piece between them, whether the arc (`lower` or upper) lies under the ground.
    /// Breakpoints are the region vertices, the piezometric vertices and the arc–edge
    /// crossings on the requested half, so the ground is linear on each piece and the arc
    /// does not touch it inside a piece.
    pub(crate) fn arc_profile(
        &self,
        c: &Circle,
        lower: bool,
        a: f64,
        b: f64,
    ) -> (Vec<f64>, Vec<bool>) {
        let tol = self.tol();
        let mut raw: Vec<f64> = Vec::with_capacity(self.vertex_xs.len() + 32);
        raw.extend(self.vertex_xs.iter().copied().filter(|&x| x > a && x < b));
        if let Some(line) = &self.piezometric {
            raw.extend(line.iter().map(|p| p[0]).filter(|&x| x > a && x < b));
        }
        for e in &self.edges {
            for x in circle_edge_xs(c, e, lower, tol).into_iter().flatten() {
                if x > a && x < b {
                    raw.push(x);
                }
            }
        }
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
                let ya = self.arc_y(c, lower, xm);
                matches!(self.top_at(xm), Some(g) if ya < g)
            })
            .collect();
        (xs, under)
    }

    /// True if the lower arc goes below the model base somewhere on the breakpoints' span.
    /// The base is linear on each piece and `arc − base` is convex there, so the minimum is at
    /// a piece end or at the closed-form stationary point `x* = xc + r·s/√(1+s²)`.
    pub(crate) fn arc_below_base(&self, c: &Circle, xs: &[f64]) -> bool {
        let tol = self.tol();
        xs.windows(2).any(|w| {
            let (p, q) = (w[0], w[1]);
            let p1 = p + 0.25 * (q - p);
            let q1 = p + 0.75 * (q - p);
            let (Some(b1), Some(b2)) = (self.bottom_at(p1), self.bottom_at(q1)) else {
                return false;
            };
            let s = (b2 - b1) / (q1 - p1);
            let f = |x: f64| self.arc_y(c, true, x) - (b1 + s * (x - p1));
            let mut m = f(p).min(f(q));
            let x_star = c.xc + c.r * s / (1.0 + s * s).sqrt();
            if x_star > p && x_star < q {
                m = m.min(f(x_star));
            }
            m < -tol
        })
    }

    /// Resolves `slope.direction` (contract §1, amendment E1). An explicit value always wins.
    fn resolve_sliding(&self, model: &Model) -> Result<Sliding, OgsError> {
        match model.slope.direction {
            Direction::LeftToRight => return Ok(Sliding::LeftToRight),
            Direction::RightToLeft => return Ok(Sliding::RightToLeft),
            Direction::Auto => {}
        }
        // 1. Both search ranges: the mass goes from the entry range to the exit range. Only when
        //    their midpoints differ by more than 1e-9 · model width (E1b); otherwise go on to 2.
        if let Some(search) = &model.analysis.search
            && let (Some(entry), Some(exit)) = (search.entry, search.exit)
        {
            let mid_entry = 0.5 * (entry[0] + entry[1]);
            let mid_exit = 0.5 * (exit[0] + exit[1]);
            let width = self.x_max - self.x_min;
            if (mid_entry - mid_exit).abs() > 1e-9 * width {
                return Ok(if mid_entry < mid_exit {
                    Sliding::LeftToRight
                } else {
                    Sliding::RightToLeft
                });
            }
        }
        let threshold = 1e-6 * (self.y_max - self.y_min);
        // 2. The higher end of the terrain is the crest.
        if let (Some(y_left), Some(y_right)) = (self.top_at(self.x_min), self.top_at(self.x_max))
            && (y_left - y_right).abs() > threshold
        {
            return Ok(if y_left > y_right {
                Sliding::LeftToRight
            } else {
                Sliding::RightToLeft
            });
        }
        // 3. Fixed circle (only when it is the surface analyzed, i.e. no search): the
        //    higher of its two ground crossings is the entry.
        let fixed = if model.analysis.search.is_none() {
            model.analysis.surface
        } else {
            None
        };
        if let Some(SurfaceSpec::Circle(circle)) = fixed
            && let Ok(tramo) = lower_arc_tramo(self, &circle)
        {
            let y_p = self.arc_y(&circle, true, tramo.p);
            let y_q = self.arc_y(&circle, true, tramo.q);
            if (y_p - y_q).abs() > threshold {
                return Ok(if y_p > y_q {
                    Sliding::LeftToRight
                } else {
                    Sliding::RightToLeft
                });
            }
        }
        // 4. Undetermined.
        Err(invalid(
            "no se puede determinar el sentido del deslizamiento: indique slope.direction",
        ))
    }
}

impl Ground for PreparedModel {
    fn y_top(&self, x: f64) -> Option<f64> {
        self.top_at(x)
    }

    fn x_range(&self) -> (f64, f64) {
        (self.x_min, self.x_max)
    }

    fn sliding(&self) -> Sliding {
        self.sliding
    }
}
