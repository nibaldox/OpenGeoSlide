//! Circular entry/exit search (§4.4). Implementation: W1c.
//!
//! Conventions (see `briefs/00_CONTRATOS.md` §4.4):
//! - Entry and exit are points on the ground surface (`y_top`). With `Sliding::LeftToRight` the entry
//!   has `x_e < x_s`; with `Sliding::RightToLeft` it has `x_e > x_s`. The x-distance must be `>= min_width`.
//! - The circle passes through both points. Radii form a geometric series `R = (L/2)·exp(ρ)` with
//!   `ρ ∈ [ln 1.0001, ln(2·max_radius_factor)]`, i.e. `R ∈ [L/2·1.0001, max_radius_factor·L]`.
//! - The center lies on the perpendicular bisector of the chord, on the side with `n_y > 0`
//!   (above the chord), so the minor arc is the one below the chord. Whether the arc really lies on the
//!   lower semicircle is decided by the slicer (`UpperArc`), not here: `eval` returns `None` for those.
//! - Grid axes include both endpoints; with `n = 1` the midpoint of the range is used.
//!   A grid point where `y_top` is `None` (or otherwise infeasible) is skipped and not evaluated.
//! - Entry and exit candidates (E9a): the uniform axis is extended with every ground vertex inside the range,
//!   and for each vertex the points `x ± 1e-6·width`. Sorted; duplicates closer than `1e-9·width` are dropped.
//!   If the extended grid would exceed `MAX_GRID_CANDIDATES`, the uniform axes are used alone.
//! - Refinement: the 10 best grid candidates (by FS, ties by grid index) seed a Hooke-Jeeves pattern
//!   search over `(x_e, x_s, ρ)`, with at least two distinct entry-exit pairs among the seeds (E9a). An exploratory move tries `±step` on each axis and keeps every strict
//!   improvement; an axis whose step is 0 is skipped. If it improves, pattern moves jump along the
//!   direction of success (`new + (new − old)`) and explore from there while they keep improving. If it
//!   does not, all steps are halved. The search stops when every step is below its threshold
//!   (`1e-3·model width` for x, `1e-3` for ρ) or after 300 `eval` calls per seed. Neighbours outside
//!   the ranges (or infeasible) are skipped without calling `eval`.
//! - Degenerate specs (grid above `MAX_GRID_CANDIDATES`, or an empty radius range) return no candidate
//!   and call `eval` zero times. `analyze` rejects them earlier with `InvalidModel`.
//! - `NaN` FS values count as `valid` (`eval` returned `Some`) but are never selected.
//! - Determinism: candidates are produced by an order-preserving indexed map (rayon with feature
//!   `parallel`, plain iterator otherwise). All reductions run serially in index order with strict `<`,
//!   so ties resolve to the lowest index and both builds return the same result.

use serde::Serialize;

use crate::geometry::{Ground, Sliding};
use crate::model::{Circle, SearchSpec};
use crate::slicer::Slice;

/// Number of grid candidates refined by the pattern search (E9a: 10, with at least two entry-exit pairs).
const N_SEEDS: usize = 10;
/// Offset of the candidates placed beside each ground vertex, as a fraction of the model width (E9a).
const VERTEX_OFFSET: f64 = 1e-6;
/// Entry or exit candidates closer than this fraction of the model width are duplicates (E9a).
const DEDUP_FRACTION: f64 = 1e-9;
/// Maximum number of `eval` calls per refinement seed.
const MAX_REFINE_EVALS: usize = 300;
/// Pattern-search step threshold for x, as a fraction of the model width.
const STEP_TOL_X: f64 = 1e-3;
/// Pattern-search step threshold for ρ (dimensionless).
const STEP_TOL_RHO: f64 = 1e-3;
/// Smallest allowed ratio `R / (L/2)`.
const RATIO_MIN: f64 = 1.0001;
/// Default `min_width` as a fraction of the model width.
const DEFAULT_MIN_WIDTH_FRACTION: f64 = 0.01;
/// Tolerance of the effective-end checks, as a fraction of the model width (see [`block_ends_admissible`]).
const END_TOLERANCE_FRACTION: f64 = 1e-9;
/// Distance from an element end to the points of the through-candidates (E14o-7), as a fraction of the model width.
const END_OFFSET: f64 = 1e-4;
/// Seeds of the refinement through the element ends: the best by FS.
const N_THROUGH_SEEDS: usize = 6;
/// Largest number of seeds added for crossing counts that the best seeds do not cover (E14o-7).
const MAX_CLASS_SEEDS: usize = 8;
/// Seeds of the grid refinement when there are reinforcements (E14o-7); without them it is [`N_SEEDS`].
const N_SEEDS_REINFORCED: usize = 20;
/// Largest number of through-candidates evaluated, as a multiple of the grid size.
const THROUGH_BUDGET_FACTOR: f64 = 0.5;
/// Largest number of points per grid axis (`n_entry`, `n_exit`, `n_radius`) accepted by `analyze`.
pub const MAX_AXIS_POINTS: usize = 200;
/// Largest grid (`n_entry · n_exit · n_radius`) accepted by `analyze`. Checked before any allocation.
pub const MAX_GRID_CANDIDATES: usize = 2_000_000;

/// An end of a reinforcement (head or tip): its position and the unit vector that points away from the element
/// along its axis (E14o-7).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ElementEnd {
    pub x: f64,
    pub y: f64,
    pub ux: f64,
    pub uy: f64,
}

/// Search counters.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize)]
pub struct SearchStats {
    /// Number of calls to `eval`.
    pub evaluated: usize,
    /// Number of calls that returned `Some`.
    pub valid: usize,
    /// Statistics of the non-circular refinement (F6.6); omitted without `non_circular`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub non_circular: Option<NonCircularStats>,
}

/// Statistics of the non-circular refinement (F6.6): `seed_fos` is the FS of the best circle before refining.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct NonCircularStats {
    /// Number of seeds refined.
    pub seeds: usize,
    /// Number of candidate polylines evaluated.
    pub evaluated: usize,
    /// FS of the best circle before refining.
    pub seed_fos: f64,
    /// FS of the best admissible refined polyline, if any (E16p).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub polyline_fos: Option<f64>,
}

/// Best surface found and its statistics.
#[derive(Debug, Clone, PartialEq)]
pub struct SearchResult {
    pub best: Option<(Circle, f64)>,
    pub stats: SearchStats,
    /// The best distinct circles with their FS, the seeds of the non-circular refinement (F6.6). B0 leaves it empty;
    /// M-NC fills it.
    pub seeds: Vec<(Circle, f64)>,
}

/// Searches the critical circle. `eval` returns `Some(FS)` only for valid, converged surfaces.
///
/// A spec that `analyze` would reject (grid larger than `MAX_GRID_CANDIDATES`, or a radius range
/// that is empty because `max_radius_factor` is too small, or not finite) yields no candidate and
/// no `eval` call, instead of overflowing or allocating without bound.
pub fn search_circular<G, E>(ground: &G, spec: &SearchSpec, eval: E) -> SearchResult
where
    G: Ground + Sync,
    E: Fn(&Circle) -> Option<f64> + Sync,
{
    search_core(ground, spec, &[], |c| eval(c).map(|fs| (fs, 0)))
}

/// Search with reinforcements (E14o-7). `ends` are the heads and tips of the elements; `eval` returns the FS and the
/// number of crossings the circle has with the elements. Besides the search of [`search_circular`], it:
/// - adds candidates whose circle passes just inside or just outside each end (the FS jumps there), and
/// - seeds the refinement with the best candidate of each crossing count not already seeded.
///
/// With no `ends` it is exactly [`search_circular`].
pub fn search_circular_reinforced<G, E>(
    ground: &G,
    spec: &SearchSpec,
    ends: &[ElementEnd],
    eval: E,
) -> SearchResult
where
    G: Ground + Sync,
    E: Fn(&Circle) -> Option<(f64, u32)> + Sync,
{
    search_core(ground, spec, ends, eval)
}

fn search_core<G, E>(ground: &G, spec: &SearchSpec, ends: &[ElementEnd], eval: E) -> SearchResult
where
    G: Ground + Sync,
    E: Fn(&Circle) -> Option<(f64, u32)> + Sync,
{
    let empty = SearchResult {
        best: None,
        stats: SearchStats::default(),
        seeds: Vec::new(),
    };
    if grid_size(spec).is_none() {
        return empty;
    }
    let rho = [RATIO_MIN.ln(), (2.0 * spec.max_radius_factor).ln()];
    if !(rho[0].is_finite() && rho[1].is_finite() && rho[0] <= rho[1]) {
        return empty;
    }
    let (x_min, x_max) = ground.x_range();
    let width = x_max - x_min;
    let full = [x_min, x_max];
    let entry = normalized(spec.entry.unwrap_or(full));
    let exit = normalized(spec.exit.unwrap_or(full));
    let space = Space {
        ground,
        sliding: ground.sliding(),
        entry,
        exit,
        min_width: spec.min_width.unwrap_or(DEFAULT_MIN_WIDTH_FRACTION * width),
        rho,
        tol_x: STEP_TOL_X * width,
        through: None,
    };

    // 1. Grid: entry × exit × radius, in lexicographic index order. The entry and exit axes also
    //    carry the ground vertices (E9a), unless that would exceed the grid limit.
    let vertices = ground.ground_vertices_x();
    let rhos = grid_axis(rho, spec.n_radius);
    let (entries, exits) = {
        let e = candidate_axis(entry, spec.n_entry, &vertices, width);
        let x = candidate_axis(exit, spec.n_exit, &vertices, width);
        if e.len() * x.len() * rhos.len() <= MAX_GRID_CANDIDATES {
            (e, x)
        } else {
            (grid_axis(entry, spec.n_entry), grid_axis(exit, spec.n_exit))
        }
    };
    let (n_s, n_r) = (exits.len(), rhos.len());
    let total = entries.len() * n_s * n_r;
    let grid = map_range(total, |idx| {
        let (i_e, rest) = (idx / (n_s * n_r), idx % (n_s * n_r));
        let p = Params {
            xe: entries[i_e],
            xs: exits[rest / n_r],
            rho: rhos[rest % n_r],
        };
        try_eval(&space, &eval, p)
    });

    // 2. Fold the grid serially, in index order.
    let mut stats = SearchStats::default();
    let mut best: Option<(Circle, f64)> = None;
    let mut scored: Vec<(f64, usize, Scored)> = Vec::new();
    for (idx, cand) in grid.into_iter().enumerate() {
        let Some(cand) = cand else { continue };
        stats.evaluated += 1;
        let Some((fs, class)) = cand.fs else { continue };
        stats.valid += 1;
        if fs.is_nan() {
            continue;
        }
        consider(&mut best, cand.circle, fs);
        scored.push((
            fs,
            idx,
            Scored {
                params: cand.params,
                circle: cand.circle,
                fs,
                class,
            },
        ));
    }

    // 3. Pattern-search refinement from the best grid seeds.
    let steps0 = [
        spacing(entry, spec.n_entry),
        spacing(exit, spec.n_exit),
        spacing(rho, spec.n_radius),
    ];
    if spec.refine && !scored.is_empty() {
        scored.sort_by(|a, b| a.0.total_cmp(&b.0).then(a.1.cmp(&b.1)));
        let ordered: Vec<Scored> = scored.into_iter().map(|(_, _, s)| s).collect();
        let mut seeds = pick_seeds(&ordered, N_SEEDS);
        if !ends.is_empty() {
            seeds = pick_seeds(&ordered, N_SEEDS_REINFORCED);

            let covered: Vec<u32> = seeds.iter().map(|s| s.class).collect();
            let extra = class_extra(&ordered, &covered, MAX_CLASS_SEEDS);
            seeds.extend(extra.into_iter().map(|i| ordered[i]));
        }
        let refined = map_range(seeds.len(), |i| refine(&space, &eval, seeds[i], steps0));
        for r in refined {
            stats.evaluated += r.evaluated;
            stats.valid += r.valid;
            if let Some((circle, fs)) = r.best {
                consider(&mut best, circle, fs);
            }
        }
    }

    // 4. E14o-7: circles that pass just inside and just outside each reinforcement end. The FS jumps when a
    //    circle gains or loses a crossing, and its minimum sits on that edge, which the three axes of the
    //    grid cannot follow: here the circle keeps the point and only (x_e, x_s) vary.
    if !ends.is_empty() {
        let points = end_points(ends, END_OFFSET * width);
        let cap = ((THROUGH_BUDGET_FACTOR * total as f64) as usize).max(1);
        let k = ((cap / points.len().max(1)).max(16) as f64).sqrt().floor() as usize;
        let (es, xs) = (thin(&entries, k.max(4)), thin(&exits, k.max(4)));
        let (ne, nx) = (es.len(), xs.len());
        let cands = map_range(points.len() * ne * nx, |idx| {
            let (pi, rest) = (idx / (ne * nx), idx % (ne * nx));
            let p = Params {
                xe: es[rest / nx],
                xs: xs[rest % nx],
                rho: 0.0,
            };
            try_eval(&space.via(points[pi]), &eval, p).map(|c| (pi, c))
        });
        let mut pool: Vec<(usize, Scored)> = Vec::new();
        for (pi, cand) in cands.into_iter().flatten() {
            stats.evaluated += 1;
            let Some((fs, class)) = cand.fs else { continue };
            stats.valid += 1;
            if fs.is_nan() {
                continue;
            }
            consider(&mut best, cand.circle, fs);
            pool.push((
                pi,
                Scored {
                    params: cand.params,
                    circle: cand.circle,
                    fs,
                    class,
                },
            ));
        }
        if spec.refine {
            pool.sort_by(|a, b| a.1.fs.total_cmp(&b.1.fs));
            let ordered: Vec<Scored> = pool.iter().map(|(_, s)| *s).collect();
            let mut picks: Vec<usize> = (0..ordered.len().min(N_THROUGH_SEEDS)).collect();
            let covered: Vec<u32> = picks.iter().map(|&i| ordered[i].class).collect();
            picks.extend(class_extra(&ordered, &covered, MAX_CLASS_SEEDS));
            let steps = [steps0[0], steps0[1], 0.0];
            let refined = map_range(picks.len(), |i| {
                let (pi, seed) = pool[picks[i]];
                refine(&space.via(points[pi]), &eval, seed, steps)
            });
            for r in refined {
                stats.evaluated += r.evaluated;
                stats.valid += r.valid;
                if let Some((circle, fs)) = r.best {
                    consider(&mut best, circle, fs);
                }
            }
        }
    }

    SearchResult {
        best,
        stats,
        seeds: Vec::new(),
    }
}

/// Advisory codes of the effective block of a searched surface (contract E11d′). The chord `(x_e, x_s)` is what
/// `min_width` and the ranges check during the search. The effective ends are the outer soil slices (air slices have
/// `weight == 0`): the points where the soil mass really starts and ends. The result keeps its state and gets:
/// - `effective_width_below_min` if the soil between those ends is narrower than `min_width`;
/// - `effective_ends_outside_range` if an effective end falls outside the `entry` or `exit` range.
///
/// `slices` are toe first. A block without soil gives no codes (it is rejected by the slicer).
pub fn effective_block_warnings<G: Ground>(
    ground: &G,
    spec: &SearchSpec,
    slices: &[Slice],
) -> Vec<&'static str> {
    let soil = || slices.iter().filter(|s| s.weight > 0.0);
    let (Some(toe), Some(crest)) = (soil().next(), soil().next_back()) else {
        return Vec::new();
    };
    let (x_min, x_max) = ground.x_range();
    let width = x_max - x_min;
    let tol = END_TOLERANCE_FRACTION * width;
    let full = [x_min, x_max];
    let (exit_x, entry_x, span) = match ground.sliding() {
        Sliding::LeftToRight => (toe.x_right, crest.x_left, toe.x_right - crest.x_left),
        Sliding::RightToLeft => (toe.x_left, crest.x_right, crest.x_right - toe.x_left),
    };
    let min_width = spec.min_width.unwrap_or(DEFAULT_MIN_WIDTH_FRACTION * width);
    let in_axis = |v: f64, [lo, hi]: [f64; 2]| v >= lo - tol && v <= hi + tol;
    let mut out = Vec::new();
    if span < min_width - tol {
        out.push("effective_width_below_min");
    }
    if !(in_axis(entry_x, normalized(spec.entry.unwrap_or(full)))
        && in_axis(exit_x, normalized(spec.exit.unwrap_or(full))))
    {
        out.push("effective_ends_outside_range");
    }
    out
}

/// Refinement seeds (E9a): the `N_SEEDS` best candidates, in order. If they all share the entry-exit pair of
/// the best one, the best candidate with another pair takes the last place, so at least two pairs are seeded.
fn pick_seeds(ordered: &[Scored], n: usize) -> Vec<Scored> {
    let mut seeds: Vec<Scored> = ordered.iter().take(n).copied().collect();
    let Some(first) = seeds.first().copied() else {
        return seeds;
    };
    let same_pair = |s: &Scored| s.params.xe == first.params.xe && s.params.xs == first.params.xs;
    if seeds.iter().all(&same_pair)
        && let Some(other) = ordered.iter().find(|s| !same_pair(s))
    {
        if seeds.len() == n {
            seeds.pop();
        }
        seeds.push(*other);
    }
    seeds
}

/// Indices into `ordered` (best first) of the best candidate of each crossing count that `covered` lacks, at most `max`.
fn class_extra(ordered: &[Scored], covered: &[u32], max: usize) -> Vec<usize> {
    let mut seen: Vec<u32> = covered.to_vec();
    let mut extra = Vec::new();
    for (i, cand) in ordered.iter().enumerate() {
        if extra.len() >= max {
            break;
        }
        if !seen.contains(&cand.class) {
            seen.push(cand.class);
            extra.push(i);
        }
    }
    extra
}

/// Points `end ± offset·u` for each element end: just outside and just inside the element. Near-duplicates dropped.
fn end_points(ends: &[ElementEnd], offset: f64) -> Vec<[f64; 2]> {
    let mut points: Vec<[f64; 2]> = Vec::new();
    for e in ends {
        for sign in [1.0, -1.0] {
            let p = [e.x + sign * offset * e.ux, e.y + sign * offset * e.uy];
            if p.iter().all(|v| v.is_finite())
                && !points
                    .iter()
                    .any(|q| (q[0] - p[0]).hypot(q[1] - p[1]) < 0.5 * offset)
            {
                points.push(p);
            }
        }
    }
    points
}

/// At most `k` evenly spread values of a sorted axis, always including both ends.
fn thin(axis: &[f64], k: usize) -> Vec<f64> {
    if axis.len() <= k || k < 2 {
        return axis.to_vec();
    }
    (0..k)
        .map(|i| axis[(i * (axis.len() - 1) + (k - 1) / 2) / (k - 1)])
        .collect()
}

/// Entry or exit candidates (E9a): the uniform axis of [`grid_axis`], plus every ground vertex inside the range
/// with the points `vertex ± 1e-6·width` that lie in the range. Sorted; near-duplicates are dropped. Empty if `n = 0`.
fn candidate_axis(range: [f64; 2], n: usize, vertices: &[f64], width: f64) -> Vec<f64> {
    let mut xs = grid_axis(range, n);
    if xs.is_empty() {
        return xs;
    }
    let offset = VERTEX_OFFSET * width;
    for &v in vertices.iter().filter(|&&v| in_range(v, range)) {
        xs.extend(
            [v - offset, v, v + offset]
                .into_iter()
                .filter(|&x| in_range(x, range)),
        );
    }
    xs.sort_by(f64::total_cmp);
    xs.dedup_by(|later, kept| (*later - *kept).abs() < DEDUP_FRACTION * width);
    xs
}

/// `n_entry · n_exit · n_radius`, or `None` when the product overflows or exceeds `MAX_GRID_CANDIDATES`.
fn grid_size(spec: &SearchSpec) -> Option<usize> {
    let total = spec
        .n_entry
        .checked_mul(spec.n_exit)?
        .checked_mul(spec.n_radius)?;
    (total <= MAX_GRID_CANDIDATES).then_some(total)
}

/// Parameters of a candidate: entry x, exit x and `ρ = ln(R / (L/2))`.
#[derive(Debug, Clone, Copy)]
struct Params {
    xe: f64,
    xs: f64,
    rho: f64,
}

/// A feasible grid candidate together with the result of `eval` (`None` = not valid).
#[derive(Debug, Clone, Copy)]
struct Candidate {
    params: Params,
    circle: Circle,
    fs: Option<(f64, u32)>,
}

/// A valid candidate with its FS (never NaN).
#[derive(Debug, Clone, Copy)]
struct Scored {
    params: Params,
    circle: Circle,
    fs: f64,
    /// Number of crossings with the reinforcements (0 without reinforcements).
    class: u32,
}

/// Refinement outcome of one seed.
struct Refined {
    evaluated: usize,
    valid: usize,
    best: Option<(Circle, f64)>,
}

/// Immutable search context shared by the grid and the refinement.
struct Space<'a, G: Ground> {
    ground: &'a G,
    sliding: Sliding,
    entry: [f64; 2],
    exit: [f64; 2],
    min_width: f64,
    rho: [f64; 2],
    tol_x: f64,
    /// E14o-7: when set, `ρ` is not free: the circle of `(x_e, x_s)` is the one that passes through this point.
    through: Option<[f64; 2]>,
}

impl<'a, G: Ground> Space<'a, G> {
    /// The same space with the circles forced through `point`.
    fn via(&self, point: [f64; 2]) -> Space<'a, G> {
        Space {
            ground: self.ground,
            sliding: self.sliding,
            entry: self.entry,
            exit: self.exit,
            min_width: self.min_width,
            rho: self.rho,
            tol_x: self.tol_x,
            through: Some(point),
        }
    }

    /// `ρ` of the circle through the ground points at `x_e`, `x_s` and through `point`, if there is one with its
    /// centre above the chord.
    fn rho_through(&self, xe: f64, xs: f64, point: [f64; 2]) -> Option<f64> {
        let (ye, ys) = (self.ground.y_top(xe)?, self.ground.y_top(xs)?);
        let s = match self.sliding {
            Sliding::LeftToRight => 1.0,
            Sliding::RightToLeft => -1.0,
        };
        let (dx, dy) = (xs - xe, ys - ye);
        let chord = dx.hypot(dy);
        let half = 0.5 * chord;
        let (nx, ny) = (-s * dy / chord, s * dx / chord);
        let (px, py) = (point[0] - 0.5 * (xe + xs), point[1] - 0.5 * (ye + ys));
        let b = px * nx + py * ny;
        let dist = (px * px + py * py - half * half) / (2.0 * b);
        (dist.is_finite() && dist > 0.0).then(|| (dist / half).hypot(1.0).ln())
    }

    /// The circle through the ground points at `p`, or `None` if `p` is infeasible.
    /// Does not call `eval`.
    fn circle(&self, p: Params) -> Option<Circle> {
        let Params { xe, xs, mut rho } = p;
        if let Some(point) = self.through {
            rho = self.rho_through(xe, xs, point)?;
        }
        if !(in_range(xe, self.entry) && in_range(xs, self.exit) && in_range(rho, self.rho)) {
            return None;
        }
        // `s` maps the sliding direction to +x: the entry must be uphill, i.e. `s·(x_s − x_e) > 0`.
        let s = match self.sliding {
            Sliding::LeftToRight => 1.0,
            Sliding::RightToLeft => -1.0,
        };
        let width = s * (xs - xe);
        if !(width > 0.0 && width >= self.min_width) {
            return None;
        }
        let ye = self.ground.y_top(xe)?;
        let ys = self.ground.y_top(xs)?;
        let (dx, dy) = (xs - xe, ys - ye);
        let chord = dx.hypot(dy);
        let half = 0.5 * chord;
        // Unit normal (−dy, dx)·s / L: its y component is width / L > 0 (upper side of the chord).
        let (nx, ny) = (-s * dy / chord, s * dx / chord);
        // Center distance from the chord midpoint: D = sqrt(R² − h²) = h·sqrt(e^{2ρ} − 1).
        let dist = half * (2.0 * rho).exp_m1().sqrt();
        let radius = half * rho.exp();
        Some(Circle {
            xc: 0.5 * (xe + xs) + dist * nx,
            yc: 0.5 * (ye + ys) + dist * ny,
            r: radius,
        })
    }
}

fn in_range(v: f64, [lo, hi]: [f64; 2]) -> bool {
    v >= lo && v <= hi
}

fn normalized([a, b]: [f64; 2]) -> [f64; 2] {
    if a <= b { [a, b] } else { [b, a] }
}

/// `n` uniformly spaced values including both ends; the midpoint when `n = 1`; none when `n = 0`.
fn grid_axis([lo, hi]: [f64; 2], n: usize) -> Vec<f64> {
    match n {
        0 => Vec::new(),
        1 => vec![0.5 * (lo + hi)],
        _ => (0..n)
            .map(|i| {
                (lo + (hi - lo) * (i as f64 / (n - 1) as f64))
                    .max(lo)
                    .min(hi)
            })
            .collect(),
    }
}

/// Initial pattern-search step for an axis: the grid spacing (the full range when `n <= 1`).
fn spacing([lo, hi]: [f64; 2], n: usize) -> f64 {
    if n > 1 {
        (hi - lo) / (n - 1) as f64
    } else {
        hi - lo
    }
}

/// Builds the candidate at `p` and calls `eval` if it is feasible.
fn try_eval<G, E>(space: &Space<G>, eval: &E, p: Params) -> Option<Candidate>
where
    G: Ground,
    E: Fn(&Circle) -> Option<(f64, u32)>,
{
    let circle = space.circle(p)?;
    Some(Candidate {
        params: p,
        circle,
        fs: eval(&circle),
    })
}

/// Keeps `(circle, fs)` if `fs` is strictly lower than the current best.
fn consider(best: &mut Option<(Circle, f64)>, circle: Circle, fs: f64) {
    if best.is_none_or(|(_, b)| fs < b) {
        *best = Some((circle, fs));
    }
}

/// Evaluates `p` during the refinement. Returns the candidate only if it is feasible, within the
/// budget, and valid (not `None`, not NaN). Every `eval` call is counted in `acc`.
fn probe<G, E>(space: &Space<G>, eval: &E, acc: &mut Refined, p: Params) -> Option<Scored>
where
    G: Ground,
    E: Fn(&Circle) -> Option<(f64, u32)>,
{
    if acc.evaluated >= MAX_REFINE_EVALS {
        return None;
    }
    let circle = space.circle(p)?;
    acc.evaluated += 1;
    let (fs, class) = eval(&circle)?;
    acc.valid += 1;
    if fs.is_nan() {
        return None;
    }
    consider(&mut acc.best, circle, fs);
    Some(Scored {
        params: p,
        circle,
        fs,
        class,
    })
}

/// Exploratory move: for each axis, tries `+step` then `−step` and keeps the first strict improvement.
fn explore<G, E>(
    space: &Space<G>,
    eval: &E,
    acc: &mut Refined,
    start: Scored,
    steps: [f64; 3],
) -> Scored
where
    G: Ground,
    E: Fn(&Circle) -> Option<(f64, u32)>,
{
    let mut cur = start;
    for (axis, &step) in steps.iter().enumerate() {
        // A zero step (a degenerate range, or a single grid point) has no neighbour on this axis.
        // Probing it would re-evaluate `cur` itself.
        if step.is_nan() || step <= 0.0 {
            continue;
        }
        for sign in [1.0, -1.0] {
            let mut q = cur.params;
            let delta = sign * step;
            match axis {
                0 => q.xe += delta,
                1 => q.xs += delta,
                _ => q.rho += delta,
            }
            if let Some(c) = probe(space, eval, acc, q)
                && c.fs < cur.fs
            {
                cur = c;
                break;
            }
        }
    }
    cur
}

/// Pattern moves: while exploration keeps improving, jump from `cur` to `cur + (cur − prev)`,
/// explore from there, and accept only if the result beats `cur`.
fn pattern<G, E>(
    space: &Space<G>,
    eval: &E,
    acc: &mut Refined,
    mut prev: Scored,
    mut cur: Scored,
    steps: [f64; 3],
) -> Scored
where
    G: Ground,
    E: Fn(&Circle) -> Option<(f64, u32)>,
{
    loop {
        let (a, b) = (cur.params, prev.params);
        let jump = Params {
            xe: 2.0 * a.xe - b.xe,
            xs: 2.0 * a.xs - b.xs,
            rho: 2.0 * a.rho - b.rho,
        };
        let Some(start) = probe(space, eval, acc, jump) else {
            break;
        };
        let explored = explore(space, eval, acc, start, steps);
        if explored.fs < cur.fs {
            prev = cur;
            cur = explored;
        } else {
            break;
        }
    }
    cur
}

/// Hooke-Jeeves pattern search over `(x_e, x_s, ρ)` from one valid seed.
/// Budget: `MAX_REFINE_EVALS` eval calls.
fn refine<G, E>(space: &Space<G>, eval: &E, seed: Scored, steps0: [f64; 3]) -> Refined
where
    G: Ground,
    E: Fn(&Circle) -> Option<(f64, u32)>,
{
    let mut acc = Refined {
        evaluated: 0,
        valid: 0,
        best: Some((seed.circle, seed.fs)),
    };
    let tol = [space.tol_x, space.tol_x, STEP_TOL_RHO];
    let mut base = seed;
    let mut steps = steps0;
    while acc.evaluated < MAX_REFINE_EVALS
        && steps.iter().zip(tol).any(|(s, t)| *s >= t && *s > 0.0)
    {
        let explored = explore(space, eval, &mut acc, base, steps);
        if explored.fs < base.fs {
            base = pattern(space, eval, &mut acc, base, explored, steps);
        } else {
            steps.iter_mut().for_each(|s| *s *= 0.5);
        }
    }
    acc
}

/// Maps `0..n` to a vector in index order. Parallel with feature `parallel`; the output order is
/// the same in both builds.
#[cfg(feature = "parallel")]
fn map_range<R, F>(n: usize, f: F) -> Vec<R>
where
    R: Send,
    F: Fn(usize) -> R + Sync + Send,
{
    use rayon::prelude::*;
    (0..n).into_par_iter().map(f).collect()
}

#[cfg(not(feature = "parallel"))]
fn map_range<R, F>(n: usize, f: F) -> Vec<R>
where
    F: Fn(usize) -> R + Sync,
{
    (0..n).map(f).collect()
}
