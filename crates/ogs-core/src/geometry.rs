//! Ground geometry: prepared model and the `Ground` trait used by the circular search.
//!
//! Terrain envelopes come from the region edges (contract §1). `slope.direction: auto` is
//! resolved in `PreparedModel::new` with the rule of amendment E1.

use crate::OgsError;
use crate::model::{Circle, Direction, Model, Point, SurfaceSpec, default_water_unit_weight};
use crate::slicer::sliding_span;
use crate::strength::{ResolvedMaterial, resolve_materials};
use crate::surface::Surface;

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
    /// Abscissae of the ground-surface vertices (breakpoints of `y_top`), sorted and unique.
    /// The search adds them as entry and exit candidates (E9a). Default: none.
    fn ground_vertices_x(&self) -> Vec<f64> {
        Vec::new()
    }
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

fn resolve_water(model: &Model) -> Result<(f64, Option<Vec<Point>>), OgsError> {
    // E15l-6: without `water.unit_weight` (or without `water`), 9.81 kN/m³ in SI and its equivalent in imperial units.
    let default = default_water_unit_weight(model.units.as_deref());
    let Some(water) = &model.water else {
        return Ok((default, None));
    };
    let gamma_w = water.unit_weight.unwrap_or(default);
    if !(gamma_w.is_finite() && gamma_w > 0.0) {
        return Err(invalid("water.unit_weight debe ser > 0"));
    }
    let Some(line) = &water.piezometric_line else {
        return Ok((gamma_w, None));
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
    Ok((gamma_w, Some(line.clone())))
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

/// Relative geometric tolerance of the region checks (contract E12c): `tol = 1e-9 · scale`.
const REGION_TOLERANCE: f64 = 1e-9;

fn sub(a: Point, b: Point) -> Point {
    [a[0] - b[0], a[1] - b[1]]
}

fn cross(u: Point, v: Point) -> f64 {
    u[0] * v[1] - u[1] * v[0]
}

fn dot(u: Point, v: Point) -> f64 {
    u[0] * v[0] + u[1] * v[1]
}

fn norm(u: Point) -> f64 {
    u[0].hypot(u[1])
}

/// Distance from `p` to the closed segment `[a, b]`.
fn point_segment_distance(p: Point, a: Point, b: Point) -> f64 {
    let d = sub(b, a);
    let len2 = dot(d, d);
    let t = if len2 > 0.0 {
        (dot(sub(p, a), d) / len2).clamp(0.0, 1.0)
    } else {
        0.0
    };
    norm(sub(p, [a[0] + t * d[0], a[1] + t * d[1]]))
}

/// Distance between the closed segments `[a, b]` and `[c, d]` (0 if they cross).
fn segment_distance(a: Point, b: Point, c: Point, d: Point) -> f64 {
    let (o1, o2) = (cross(sub(b, a), sub(c, a)), cross(sub(b, a), sub(d, a)));
    let (o3, o4) = (cross(sub(d, c), sub(a, c)), cross(sub(d, c), sub(b, c)));
    if o1 * o2 < 0.0 && o3 * o4 < 0.0 {
        return 0.0;
    }
    point_segment_distance(a, c, d)
        .min(point_segment_distance(b, c, d))
        .min(point_segment_distance(c, a, b))
        .min(point_segment_distance(d, a, b))
}

/// True if the interiors of `[a, b]` and `[c, d]` cross at one point and the segments are not collinear:
/// each segment's end points lie on opposite sides of the other's line, more than `tol` away from it.
/// A segment end that touches the other segment (a T junction) is not a proper crossing.
fn proper_crossing(a: Point, b: Point, c: Point, d: Point, tol: f64) -> bool {
    let (lab, lcd) = (norm(sub(b, a)), norm(sub(d, c)));
    if lab <= tol || lcd <= tol {
        return false;
    }
    let (s1, s2) = (
        cross(sub(b, a), sub(c, a)) / lab,
        cross(sub(b, a), sub(d, a)) / lab,
    );
    let (s3, s4) = (
        cross(sub(d, c), sub(a, c)) / lcd,
        cross(sub(d, c), sub(b, c)) / lcd,
    );
    s1 * s2 < 0.0 && s3 * s4 < 0.0 && s1.abs().min(s2.abs()) > tol && s3.abs().min(s4.abs()) > tol
}

/// Polygon edges, closed implicitly.
fn polygon_edges(poly: &[Point]) -> impl Iterator<Item = (Point, Point)> + '_ {
    poly.iter()
        .zip(poly.iter().cycle().skip(1))
        .map(|(&a, &b)| (a, b))
}

fn boundary_distance(p: Point, poly: &[Point]) -> f64 {
    polygon_edges(poly)
        .map(|(a, b)| point_segment_distance(p, a, b))
        .fold(f64::INFINITY, f64::min)
}

/// Even-odd point-in-polygon test (half-open rule at the vertices).
fn point_in_polygon(p: Point, poly: &[Point]) -> bool {
    let mut inside = false;
    for (a, b) in polygon_edges(poly) {
        if (a[1] > p[1]) != (b[1] > p[1]) {
            let x_cross = a[0] + (p[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1]);
            if p[0] < x_cross {
                inside = !inside;
            }
        }
    }
    inside
}

/// `p` is inside `poly` and farther than `tol` from its boundary.
fn strictly_inside(p: Point, poly: &[Point], tol: f64) -> bool {
    boundary_distance(p, poly) > tol && point_in_polygon(p, poly)
}

fn bbox(poly: &[Point]) -> [f64; 4] {
    poly.iter().fold(
        [
            f64::INFINITY,
            f64::INFINITY,
            f64::NEG_INFINITY,
            f64::NEG_INFINITY,
        ],
        |b, p| {
            [
                b[0].min(p[0]),
                b[1].min(p[1]),
                b[2].max(p[0]),
                b[3].max(p[1]),
            ]
        },
    )
}

fn bboxes_apart(a: &[f64; 4], b: &[f64; 4], tol: f64) -> bool {
    a[0] > b[2] + tol || b[0] > a[2] + tol || a[1] > b[3] + tol || b[1] > a[3] + tol
}

/// First pair of edges of a polygon that touch or cross where they must not (contract E12c).
///
/// Non-adjacent edges must stay more than `tol` apart. Adjacent edges only share their common vertex:
/// a spike (the second edge doubles back over the first) is a collinear overlap. Zero-length edges
/// (repeated vertices) are skipped: they are not geometric features. `poly` must be normalized.
/// Returns the indices of the two edges in the polygon as given (edge `i` goes from vertex `i` to `i + 1`).
fn find_self_intersection(poly: &[Point], tol: f64) -> Option<(usize, usize)> {
    let edges: Vec<(usize, Point, Point)> = polygon_edges(poly)
        .enumerate()
        .filter(|(_, (a, b))| norm(sub(*b, *a)) > tol)
        .map(|(i, (a, b))| (i, a, b))
        .collect();
    let m = edges.len();
    for i in 0..m {
        for j in i + 1..m {
            let (ei, ai, bi) = edges[i];
            let (ej, aj, bj) = edges[j];
            let hit = if j == i + 1 || (i == 0 && j == m - 1) {
                // `shared` is the common vertex, `p` and `q` the far end of each edge.
                let (p, shared, q) = if j == i + 1 {
                    (ai, bi, bj)
                } else {
                    (aj, bj, bi)
                };
                point_segment_distance(q, p, shared) <= tol
                    || point_segment_distance(p, shared, q) <= tol
            } else {
                segment_distance(ai, bi, aj, bj) <= tol
            };
            if hit {
                return Some((ei, ej));
            }
        }
    }
    None
}

/// Absolute area of a polygon (shoelace formula).
fn polygon_area(poly: &[Point]) -> f64 {
    0.5 * polygon_edges(poly)
        .map(|(a, b)| cross(a, b))
        .sum::<f64>()
        .abs()
}

/// True if the polygons are the same figure: every vertex of each lies on the other's boundary
/// and the areas coincide. Independent of the starting vertex, the orientation and extra collinear vertices.
fn same_polygon(a: &[Point], b: &[Point], tol: f64) -> bool {
    (polygon_area(a) - polygon_area(b)).abs() <= tol
        && a.iter().all(|&p| boundary_distance(p, b) <= tol)
        && b.iter().all(|&p| boundary_distance(p, a) <= tol)
}

/// True if some part of the boundary of `a` runs through the strict interior of `b`.
///
/// Each edge of `a` is split where it meets the boundary of `b` and the midpoint of every piece is
/// tested. Pieces on the boundary of `b` (shared edges, collinear stretches) never count.
fn boundary_enters(a: &[Point], b: &[Point], tol: f64) -> bool {
    for (p, q) in polygon_edges(a) {
        let r = sub(q, p);
        let len = norm(r);
        if len <= tol {
            continue;
        }
        let mut ts = vec![0.0, 1.0];
        for (c, d) in polygon_edges(b) {
            let s = sub(d, c);
            let den = cross(r, s);
            if den != 0.0 {
                let t = cross(sub(c, p), s) / den;
                let u = cross(sub(c, p), r) / den;
                if (0.0..=1.0).contains(&t) && (0.0..=1.0).contains(&u) {
                    ts.push(t);
                }
            }
            for v in [c, d] {
                if point_segment_distance(v, p, q) <= tol {
                    ts.push((dot(sub(v, p), r) / (len * len)).clamp(0.0, 1.0));
                }
            }
        }
        ts.sort_by(f64::total_cmp);
        for w in ts.windows(2) {
            if (w[1] - w[0]) * len <= tol {
                continue;
            }
            let t = 0.5 * (w[0] + w[1]);
            if strictly_inside([p[0] + t * r[0], p[1] + t * r[1]], b, tol) {
                return true;
            }
        }
    }
    false
}

/// Whether two regions overlap (contract E12c). Shared edges, shared collinear stretches and T junctions
/// are allowed. Overlap is any of: a proper edge crossing; a vertex strictly inside the other region;
/// identical polygons; or, beyond the contract's list, a stretch of boundary running through the strict
/// interior of the other region (for example a diagonal across a square that shares two of its sides).
fn regions_overlap(a: &[Point], b: &[Point], tol: f64) -> bool {
    if bboxes_apart(&bbox(a), &bbox(b), tol) {
        return false;
    }
    if polygon_edges(a)
        .any(|(p, q)| polygon_edges(b).any(|(c, d)| proper_crossing(p, q, c, d, tol)))
    {
        return true;
    }
    a.iter().any(|&p| strictly_inside(p, b, tol))
        || b.iter().any(|&p| strictly_inside(p, a, tol))
        || same_polygon(a, b, tol)
        || boundary_enters(a, b, tol)
        || boundary_enters(b, a, tol)
}

/// Polygon coordinates measured from `origin` in units of `scale`.
fn normalize(poly: &[Point], origin: Point, scale: f64) -> Vec<Point> {
    poly.iter()
        .map(|p| [(p[0] - origin[0]) / scale, (p[1] - origin[1]) / scale])
        .collect()
}

/// True if all the vertices lie within `tol` of the line through the two that are farthest apart.
fn is_collinear(poly: &[Point], tol: f64) -> bool {
    let (mut a, mut b, mut best) = (poly[0], poly[0], 0.0);
    for &p in poly {
        for &q in poly {
            let d = norm(sub(p, q));
            if d > best {
                (a, b, best) = (p, q, d);
            }
        }
    }
    best <= tol
        || poly
            .iter()
            .all(|&p| cross(sub(b, a), sub(p, a)).abs() / best <= tol)
}

/// A polygon whose signed area cancels to zero (a symmetric figure eight) is not degenerate: it crosses
/// itself, and E12c reports that. A polygon with all its vertices on one line is degenerate.
fn crosses_itself_with_zero_area(poly: &[Point], origin: Point, scale: f64) -> bool {
    let poly = normalize(poly, origin, scale);
    !is_collinear(&poly, REGION_TOLERANCE)
        && find_self_intersection(&poly, REGION_TOLERANCE).is_some()
}

/// Checks that every region is a simple polygon and that no two regions overlap (contract E12c).
/// Works on coordinates normalized to the unit of `scale` and measured from `(x_min, y_min)`, so the
/// tolerance is `1e-9` and no product overflows.
fn validate_regions(regions: &[PreparedRegion], origin: Point, scale: f64) -> Result<(), OgsError> {
    let tol = REGION_TOLERANCE;
    let polys: Vec<Vec<Point>> = regions
        .iter()
        .map(|r| normalize(&r.polygon, origin, scale))
        .collect();
    for (k, poly) in polys.iter().enumerate() {
        if let Some((i, j)) = find_self_intersection(poly, tol) {
            return Err(invalid(format!(
                "la región {k} se auto-intersecta (aristas {i} y {j})"
            )));
        }
    }
    for a in 0..polys.len() {
        for b in a + 1..polys.len() {
            if regions_overlap(&polys[a], &polys[b], tol) {
                return Err(invalid(format!("las regiones {a} y {b} se solapan")));
            }
        }
    }
    Ok(())
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
            if polygon_is_degenerate(&region.polygon, scale)
                && !crosses_itself_with_zero_area(&region.polygon, [x_min, y_min], scale)
            {
                return Err(invalid(format!(
                    "la región {k} es degenerada: su área es nula"
                )));
            }
        }
        validate_regions(&regions, [x_min, y_min], scale)?;
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

    /// Upper envelope (terrain) at `x` **seen from the side** `side` (E15n-1): the limit of the ground when the abscissa
    /// approaches `x` from `x + side·0⁺` (`side > 0`: from the right; `side < 0`: from the left). On a vertical step of
    /// the ground it is the ground of that side, never the closed envelope of [`PreparedModel::top_at`] (which takes the
    /// highest of both). Away from a step it is `top_at(x)`. At the end of the model on the side of the limit (nothing
    /// beyond), it falls back to `top_at(x)`.
    pub(crate) fn top_toward(&self, x: f64, side: f64) -> Option<f64> {
        if x.is_nan() {
            return None;
        }
        let mut best = None;
        for [a, b] in &self.edges {
            if a[0] == b[0] {
                continue;
            }
            let (x0, x1) = if a[0] <= b[0] {
                (a[0], b[0])
            } else {
                (b[0], a[0])
            };
            let covers = if side >= 0.0 {
                x0 <= x && x < x1
            } else {
                x0 < x && x <= x1
            };
            if covers {
                let y = a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
                best = pick(best, y, true);
            }
        }
        best.or_else(|| self.top_at(x))
    }

    /// Soil intervals `(lo, hi, material)` on the vertical line at `x`, per region.
    /// `x` must not coincide with a vertex abscissa; slice midpoints never do.
    /// Buffers are reused between calls to avoid allocation.
    pub(crate) fn column(&self, x: f64, out: &mut Vec<(f64, f64, usize)>, scratch: &mut Vec<f64>) {
        self.column_toward(x, 1.0, out, scratch);
    }

    /// [`PreparedModel::column`] seen from the side `side` (E15n-1): the regions that cover `x + side·0⁺`. With
    /// `side > 0` the rule is the half-open `[x0, x1)` of `column`; with `side < 0` it is `(x0, x1]`, so that at a
    /// vertical step or a vertical boundary between materials the column is that of the chosen side.
    pub(crate) fn column_toward(
        &self,
        x: f64,
        side: f64,
        out: &mut Vec<(f64, f64, usize)>,
        scratch: &mut Vec<f64>,
    ) {
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
                let outside = if side >= 0.0 {
                    x < x0 || x >= x1
                } else {
                    x <= x0 || x > x1
                };
                if outside {
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
        // 3. Fixed surface (only when it is the surface analyzed, i.e. no search): the higher of its two ground
        //    crossings is the entry. For a circle the crossings come from the sliding span alone (R3-07): the ends of
        //    the analysed block are checked later, in `slice_surface` (E10a′), so a discarded block may leave the
        //    model here. For a polyline (E13c) they are the ends of the polyline fitted to the ground; if it cannot be
        //    fitted, the ends as written decide the direction, so that the analysis reports the reason of the
        //    `Invalid` status (`polyline_no_ground_crossing`, `polyline_outside_ground`) and not a missing direction.
        let fixed = if model.analysis.search.is_none() {
            model.analysis.surface.as_ref()
        } else {
            None
        };
        let ends = match fixed {
            Some(&SurfaceSpec::Circle(circle)) => sliding_span(self, &circle).ok().map(|tramo| {
                (
                    self.arc_y(&circle, true, tramo.p),
                    self.arc_y(&circle, true, tramo.q),
                )
            }),
            Some(spec @ SurfaceSpec::Polyline { points }) => {
                match Surface::from_spec(spec).fit_to_ground(self) {
                    Ok(Surface::Polyline(fitted)) => fitted
                        .points
                        .first()
                        .zip(fitted.points.last())
                        .map(|(first, last)| (first[1], last[1])),
                    _ => points.first().zip(points.last()).map(|(f, l)| (f[1], l[1])),
                }
            }
            None => None,
        };
        if let Some((y_p, y_q)) = ends {
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

    /// x of every region vertex that lies on the terrain, i.e. `y_top(x) = y` (within `1e-9 · scale`).
    fn ground_vertices_x(&self) -> Vec<f64> {
        let tol = 1e-9 * self.scale;
        let mut xs: Vec<f64> = self
            .edges
            .iter()
            .flat_map(|edge| edge.iter())
            .filter(|p| {
                self.top_at(p[0])
                    .is_some_and(|top| (p[1] - top).abs() <= tol)
            })
            .map(|p| p[0])
            .collect();
        xs.sort_by(f64::total_cmp);
        xs.dedup();
        xs
    }
}
