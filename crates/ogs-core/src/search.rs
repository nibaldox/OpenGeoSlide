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
//! - Refinement: the 5 best grid candidates (by FS, ties by grid index) seed a Hooke-Jeeves pattern
//!   search over `(x_e, x_s, ρ)`. An exploratory move tries `±step` on each axis and keeps every strict
//!   improvement. If it improves, pattern moves jump along the direction of success
//!   (`new + (new − old)`) and explore from there while they keep improving. If it does not, all steps
//!   are halved. The search stops when every step is below its threshold (`1e-3·model width` for x,
//!   `1e-3` for ρ) or after 300 `eval` calls per seed. Neighbours outside the ranges (or infeasible)
//!   are skipped without calling `eval`.
//! - `NaN` FS values count as `valid` (`eval` returned `Some`) but are never selected.
//! - Determinism: candidates are produced by an order-preserving indexed map (rayon with feature
//!   `parallel`, plain iterator otherwise). All reductions run serially in index order with strict `<`,
//!   so ties resolve to the lowest index and both builds return the same result.

use serde::Serialize;

use crate::geometry::{Ground, Sliding};
use crate::model::{Circle, SearchSpec};

/// Number of grid candidates refined by the pattern search.
const N_SEEDS: usize = 5;
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

/// Search counters.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct SearchStats {
    /// Number of calls to `eval`.
    pub evaluated: usize,
    /// Number of calls that returned `Some`.
    pub valid: usize,
}

/// Best surface found and its statistics.
#[derive(Debug, Clone, PartialEq)]
pub struct SearchResult {
    pub best: Option<(Circle, f64)>,
    pub stats: SearchStats,
}

/// Searches the critical circle. `eval` returns `Some(FS)` only for valid, converged surfaces.
pub fn search_circular<G, E>(ground: &G, spec: &SearchSpec, eval: E) -> SearchResult
where
    G: Ground + Sync,
    E: Fn(&Circle) -> Option<f64> + Sync,
{
    let (x_min, x_max) = ground.x_range();
    let width = x_max - x_min;
    let full = [x_min, x_max];
    let entry = normalized(spec.entry.unwrap_or(full));
    let exit = normalized(spec.exit.unwrap_or(full));
    let rho = [RATIO_MIN.ln(), (2.0 * spec.max_radius_factor).ln()];
    let space = Space {
        ground,
        sliding: ground.sliding(),
        entry,
        exit,
        min_width: spec.min_width.unwrap_or(DEFAULT_MIN_WIDTH_FRACTION * width),
        rho,
        tol_x: STEP_TOL_X * width,
    };

    // 1. Grid: entry × exit × radius, in lexicographic index order.
    let entries = grid_axis(entry, spec.n_entry);
    let exits = grid_axis(exit, spec.n_exit);
    let rhos = grid_axis(rho, spec.n_radius);
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
        let Some(fs) = cand.fs else { continue };
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
            },
        ));
    }

    // 3. Pattern-search refinement from the best grid seeds.
    if spec.refine && !scored.is_empty() {
        scored.sort_by(|a, b| a.0.total_cmp(&b.0).then(a.1.cmp(&b.1)));
        let seeds: Vec<Scored> = scored
            .into_iter()
            .take(N_SEEDS)
            .map(|(_, _, s)| s)
            .collect();
        let steps0 = [
            spacing(entry, spec.n_entry),
            spacing(exit, spec.n_exit),
            spacing(rho, spec.n_radius),
        ];
        let refined = map_range(seeds.len(), |i| refine(&space, &eval, seeds[i], steps0));
        for r in refined {
            stats.evaluated += r.evaluated;
            stats.valid += r.valid;
            if let Some((circle, fs)) = r.best {
                consider(&mut best, circle, fs);
            }
        }
    }

    SearchResult { best, stats }
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
    fs: Option<f64>,
}

/// A valid candidate with its FS (never NaN).
#[derive(Debug, Clone, Copy)]
struct Scored {
    params: Params,
    circle: Circle,
    fs: f64,
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
}

impl<G: Ground> Space<'_, G> {
    /// The circle through the ground points at `p`, or `None` if `p` is infeasible.
    /// Does not call `eval`.
    fn circle(&self, p: Params) -> Option<Circle> {
        let Params { xe, xs, rho } = p;
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
    E: Fn(&Circle) -> Option<f64>,
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
    E: Fn(&Circle) -> Option<f64>,
{
    if acc.evaluated >= MAX_REFINE_EVALS {
        return None;
    }
    let circle = space.circle(p)?;
    acc.evaluated += 1;
    let fs = eval(&circle)?;
    acc.valid += 1;
    if fs.is_nan() {
        return None;
    }
    consider(&mut acc.best, circle, fs);
    Some(Scored {
        params: p,
        circle,
        fs,
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
    E: Fn(&Circle) -> Option<f64>,
{
    let mut cur = start;
    for (axis, &step) in steps.iter().enumerate() {
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
    E: Fn(&Circle) -> Option<f64>,
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
    E: Fn(&Circle) -> Option<f64>,
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
