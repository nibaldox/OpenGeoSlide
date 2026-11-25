//! Spencer method, i.e. Morgenstern-Price with f(x) = 1 (§4.3), solved as the two-equation GLE scheme of
//! Fredlund & Krahn (1977), amendment E10b. The fixed-point loop in λ of Zhu, Lee, Qian & Chen (2005) is retired.
//!
//! Sign convention (§4.3 leaves it to the implementer):
//! - Slices run toe → crest, with `alpha > 0` when the base rises toward the crest, so `W·sin α > 0` drives the slide.
//! - `E[k]` is the normal interslice force on the face below slice `k` (`E[0]` toe face, `E[n]` crest face).
//!   `E > 0` is tension. The horizontal equilibrium of slice `k` is `E[k+1] − E[k] = N sin α − S cos α`, with `N` the
//!   total normal force on the base and `S = (c·l + (N − u·l)·tan φ) / F` the mobilised shear.
//! - Interslice shear `X = λ·f·E` with f = 1, same sign as E. Net shear of slice `k`: `ΔX_k = λ·ΔE_k`.
//! - Vertical equilibrium `N cos α + S sin α = W − ΔX`. Eliminating `N` and `S` gives the recurrence of
//!   [`spencer_interslice`]: `ΔE = (F·W sin α − R) / D`, with `D = (sin α − λ cos α) tan φ + (cos α + λ sin α) F` and
//!   `R = (W cos α − u·l) tan φ + c·l`. For given `(F, λ)` the forces E are therefore unique, and `E[0] = 0` fixes them.
//! - Effective normal force (E4e, E7d): `N' = N − u·l`, in the direct form `N' = W cos α − u·l + (sin α − λ cos α)·ΔE`
//!   (free of `m_α`). With `ΔX = 0` it is Bishop's `N'` (tests); the base-equation form
//!   `N' = (W − ΔX − u·b − c·l·sin α / F) / m_α` agrees on slices without a pole.
//!
//! GLE scheme (E10b). For a given λ, two factors of safety:
//! - `F_m(λ) = Σ (c·l + N'·tan φ) / Σ W sin α` (moments about the centre),
//! - `F_f(λ) = Σ (c·l + N'·tan φ) cos α / Σ N sin α` (global horizontal equilibrium).
//!
//! Both are fixed points in `F`. Their interslice forces are the exact recurrence at `(F, λ)`, which is the limit of
//! the pass-by-pass update of E10b (`ΔX` from the previous pass). Each fixed point is a root of `F − F_m(F)` (or of
//! `F − F_f(F)`) on `[lower bound, 1e3]`, found by a bracket search outward from the previous root along the scan
//! (continuation) and refined with Brent. Bishop's F starts the scan at `λ = 0`, where `F_m` is Bishop's F.
//!
//! `g(λ) = F_m(λ) − F_f(λ)` is scanned at `λ = 0, 0.1, …, 1.5` and `−0.1, …, −0.5`. The sign change nearest to
//! `λ = 0` is refined with Brent until `|g| ≤ 1e-3 · tolerance · F`. λ* is accepted only if the state is admissible
//! (E4b as amended by E8b) and the force closure `|E_n| ≤ 1e-6 · ΣW` holds.
//!
//! Air slices (E2, E7a): no weight, no strength, `N = S = 0`, so `E` passes through unchanged. An interior air run
//! that carries `|E| > 1e-3·ΣW` adds the note `air_gap_thrust`. Surfaces that split the soil into detached masses
//! never reach this solver (E10a, in the slicer).
//!
//! Budget: each evaluation of `g(λ)` (both factors) counts once toward `max_iterations`. Exhausting it gives
//! `NotConverged("max_iterations")`; a scan without sign change, or a root that fails the closure, gives
//! `NotConverged("no_lambda_root")`. A root that fails the admissibility gives `Invalid` with the reason (`pole`
//! or `m_alpha`).

use super::{
    MethodResult, SolveOptions, SolveStatus, air_gap_thrust, bishop, converged_notes, is_inert,
    lacks_driving, m_alpha, negative_normal_message,
};
use crate::model::MethodKind;
use crate::slicer::Slice;

/// Relative pole threshold (E4b): a soil slice with `Φ_i ≤ 1e-9 · F` is a pole.
const POLE_FRACTION: f64 = 1e-9;
/// Upper end of the F search interval (E7c, as in Bishop E7b).
const FOS_MAX: f64 = 1e3;
/// Relative margin above the lower bound of F (E7c).
const ADM_MARGIN: f64 = 1e-6;
/// Lower end of the F interval when no slice bounds F from below.
const FOS_FLOOR: f64 = 1e-9;
/// Brent steps of one root in F (E10b: at most 100 passes).
const ROOT_BRENT_LIMIT: usize = 100;
/// Outward steps of the bracket search for one root in F. The step grows by `ROOT_STEP_GROWTH` each time.
const ROOT_WALK_LIMIT: usize = 60;
const ROOT_STEP0: f64 = 0.01;
const ROOT_STEP_GROWTH: f64 = 1.5;
/// Absolute width at which Brent stops in F (relative to F it is far below the residual tolerance).
const ROOT_XTOL: f64 = 1e-13;
/// Relative residual `|F − F_m(F)| / F` that stops Brent in F.
const ROOT_STOP: f64 = 1e-12;
/// Largest relative residual accepted as a root in F. Above it the bracket crossed a pole.
const ROOT_ACCEPT: f64 = 1e-9;
/// Brent stops when `|g| ≤ ROOT_FRACTION · tolerance · F` (E10b).
const ROOT_FRACTION: f64 = 1e-3;
/// Force closure at λ*: `|E_n| ≤ CLOSURE_FRACTION · ΣW` (E10b).
const CLOSURE_FRACTION: f64 = 1e-6;
/// Scan of λ (E10b): step 0.1, up to 15 steps above 0 (λ = 1.5) and 5 below (λ = −0.5).
const SCAN_STEP: f64 = 0.1;
const SCAN_POS_STEPS: usize = 15;
const SCAN_NEG_STEPS: usize = 5;
/// Absolute width of the λ bracket below which Brent gives up.
const LAMBDA_EPS: f64 = 1e-13;
/// Brent steps of λ* (each one is a budget evaluation).
const LAMBDA_BRENT_LIMIT: usize = 100;
/// Minimum `m_α` of the diagnostic curves (`spencer_gle_curves`), as the default of the analysis.
const DIAGNOSTIC_MIN_M: f64 = 0.2;
/// Internal reason of a point that cannot be evaluated (a pole, or no sign change inside the walk).
const UNDEFINED: &str = "undefined";

/// Recurrence pole `D = (sin α − λ cos α) tan φ + (cos α + λ sin α) F` (f = 1).
fn pole(s: &Slice, fos: f64, lambda: f64) -> f64 {
    let (sin, cos) = s.alpha.sin_cos();
    (sin - lambda * cos) * s.tan_phi + (cos + lambda * sin) * fos
}

/// Resisting term `R = (W cos α − U) tan φ + c·l`, with `U = u·l` and `l = b / cos α`.
fn resisting(s: &Slice) -> f64 {
    (s.weight * s.alpha.cos() - s.pore_pressure * s.base_length) * s.tan_phi
        + s.cohesion * s.base_length
}

/// Driving term `T = W sin α`.
fn driving(s: &Slice) -> f64 {
    s.weight * s.alpha.sin()
}

/// Interslice normal forces `E[0..=n]` for the given `F` and `λ` (f = 1), with `E[0] = 0`.
///
/// `E[k+1] = E[k] + (F·T_k − R_k) / D_k`, the exact solution of the vertical and horizontal equilibrium of slice
/// `k` with `X = λE`. At convergence `E[n] ≈ 0`. Values are non-finite if a pole vanishes.
/// Air slices (E2) have `T = R = 0`, so the normal force passes through them unchanged: `E[k+1] = E[k]`.
pub fn spencer_interslice(slices: &[Slice], fos: f64, lambda: f64) -> Vec<f64> {
    let mut e = Vec::with_capacity(slices.len() + 1);
    e.push(0.0);
    for (k, s) in slices.iter().enumerate() {
        let prev = e[k];
        if is_inert(s) {
            e.push(prev);
            continue;
        }
        let d = pole(s, fos, lambda);
        e.push(prev + (fos * driving(s) - resisting(s)) / d);
    }
    e
}

/// Effective normal forces `N'` of all slices from the E4e formula (with `ΔX_k = λ (E_{k+1} − E_k)`).
///
/// With `λ = 0` the interslice shear vanishes and the values are exactly Bishop's `N'` (§4.2).
/// Kept as the cross-check of the direct form of E7d.
pub fn spencer_effective_normals(slices: &[Slice], fos: f64, lambda: f64) -> Vec<f64> {
    let e = spencer_interslice(slices, fos, lambda);
    slices
        .iter()
        .enumerate()
        .map(|(k, s)| {
            let delta_x = if lambda == 0.0 {
                0.0
            } else {
                lambda * (e[k + 1] - e[k])
            };
            super::effective_normal(s, fos, delta_x)
        })
        .collect()
}

/// Effective normal forces `N'` in the direct form of E7d, free of `m_α`:
/// `N' = W cos α − U + (sin α − λ cos α)·ΔE`, with `ΔE = E_{k+1} − E_k` and `U = u·l`.
/// `e` are the interslice forces of [`spencer_interslice`] at the same `(F, λ)`.
pub fn spencer_direct_normals(slices: &[Slice], lambda: f64, e: &[f64]) -> Vec<f64> {
    slices
        .iter()
        .enumerate()
        .map(|(k, s)| {
            let (sin, cos) = s.alpha.sin_cos();
            let de = e[k + 1] - e[k];
            s.weight * cos - s.pore_pressure * s.base_length + (sin - lambda * cos) * de
        })
        .collect()
}

/// Lower bound of F from the poles at `λ` (E7c, E8b). `Φ_i > 1e-9·F` reads `p_i + (a_i − 1e-9)·F > 0`, with
/// `p_i = (sin α − λ cos α) tan φ` and `a_i = cos α + λ sin α`. For `a_i > 1e-9` it gives
/// `F > −p_i/(a_i − 1e-9)`; the bound is the largest of these (0 if none).
fn pole_bound(slices: &[Slice], lambda: f64) -> f64 {
    let mut bound = 0.0_f64;
    for s in slices.iter().filter(|s| !is_inert(s)) {
        let (sin, cos) = s.alpha.sin_cos();
        let p = (sin - lambda * cos) * s.tan_phi;
        let a = cos + lambda * sin;
        if a - POLE_FRACTION > 0.0 {
            bound = bound.max(-p / (a - POLE_FRACTION));
        }
    }
    bound
}

/// Reason why `F` at `λ` is not admissible (E4b as amended by E8b), or `None` if it is. On every soil slice:
/// `Φ_i > 1e-9·F` (no pole and no negative divisor: `"pole"`), and Bishop's `m_α(F) ≥ min_m_alpha` at this same
/// F (`"m_alpha"`). NaN fails.
fn inadmissibility(slices: &[Slice], fos: f64, lambda: f64, min_m: f64) -> Option<&'static str> {
    if fos.is_nan() || fos <= 0.0 {
        return Some("pole");
    }
    let soil = || slices.iter().filter(|s| !is_inert(s));
    if soil().any(|s| {
        let phi = pole(s, fos, lambda);
        phi.is_nan() || phi <= POLE_FRACTION * fos
    }) {
        return Some("pole");
    }
    if soil().any(|s| {
        let m = m_alpha(s, fos);
        m.is_nan() || m < min_m
    }) {
        return Some("m_alpha");
    }
    None
}

/// The two factors `(F_m, F_f)` at `(fos, λ)` with the exact interslice forces of the recurrence (E10b).
///
/// Allocation-free. `None` at a pole (`D ≤ 1e-9·F`) or when a sum vanishes.
fn factors_at(slices: &[Slice], lambda: f64, fos: f64) -> Option<(f64, f64)> {
    let (mut wsin, mut r, mut rcos, mut nsin) = (0.0, 0.0, 0.0, 0.0);
    for s in slices {
        if is_inert(s) {
            continue;
        }
        // One sin/cos per slice: the same terms as `pole`, `resisting` and `driving`.
        let (sin, cos) = s.alpha.sin_cos();
        let (t, u) = (s.weight * sin, s.pore_pressure * s.base_length);
        wsin += t;
        let d = (sin - lambda * cos) * s.tan_phi + (cos + lambda * sin) * fos;
        if d.is_nan() || d <= POLE_FRACTION * fos {
            return None;
        }
        let res = (s.weight * cos - u) * s.tan_phi + s.cohesion * s.base_length;
        let de = (fos * t - res) / d;
        let n_eff = s.weight * cos - s.pore_pressure * s.base_length + (sin - lambda * cos) * de;
        let shear = s.cohesion * s.base_length + n_eff * s.tan_phi;
        r += shear;
        rcos += shear * cos;
        nsin += (n_eff + u) * sin;
    }
    let (moment, force) = (r / wsin, rcos / nsin);
    (moment.is_finite() && force.is_finite()).then_some((moment, force))
}

/// Brent's method (Brent 1973, as in Numerical Recipes `zbrent`) on a value `T` with a sign change between
/// `a0` and `b0`. Stops when `stop(x, t)` holds, when the value is exactly zero, or when the bracket is narrower than
/// `xtol`. `eval` gives `Ok(None)` at an undefined point (`UNDEFINED`), and `Err` passes through (budget).
fn brent<T: Copy>(
    mut eval: impl FnMut(f64) -> Result<Option<T>, &'static str>,
    value: impl Fn(&T) -> f64,
    stop: impl Fn(f64, &T) -> bool,
    (mut a, mut pa): (f64, T),
    (mut b, mut pb): (f64, T),
    xtol: f64,
    max_steps: usize,
) -> Result<(f64, T), &'static str> {
    let (mut fa, mut fb) = (value(&pa), value(&pb));
    let (mut c, mut pc, mut fc) = (b, pb, fb);
    let mut d = b - a;
    let mut e = d;
    for _ in 0..max_steps {
        if (fb > 0.0 && fc > 0.0) || (fb < 0.0 && fc < 0.0) {
            c = a;
            pc = pa;
            fc = fa;
            d = b - a;
            e = d;
        }
        if fc.abs() < fb.abs() {
            a = b;
            pa = pb;
            fa = fb;
            b = c;
            pb = pc;
            fb = fc;
            c = a;
            pc = pa;
            fc = fa;
        }
        let tol1 = 2.0 * f64::EPSILON * b.abs() + 0.5 * xtol;
        let xm = 0.5 * (c - b);
        if fb == 0.0 || stop(b, &pb) || xm.abs() <= tol1 {
            return Ok((b, pb));
        }
        if e.abs() >= tol1 && fa.abs() > fb.abs() {
            let s = fb / fa;
            let mut p;
            let mut q;
            if a == c {
                p = 2.0 * xm * s;
                q = 1.0 - s;
            } else {
                let qa = fa / fc;
                let r = fb / fc;
                p = s * (2.0 * xm * qa * (qa - r) - (b - a) * (r - 1.0));
                q = (qa - 1.0) * (r - 1.0) * (s - 1.0);
            }
            if p > 0.0 {
                q = -q;
            } else {
                p = -p;
            }
            let min1 = 3.0 * xm * q - (tol1 * q).abs();
            let min2 = (e * q).abs();
            if 2.0 * p < min1.min(min2) {
                e = d;
                d = p / q;
            } else {
                d = xm;
                e = d;
            }
        } else {
            d = xm;
            e = d;
        }
        a = b;
        pa = pb;
        fa = fb;
        b += if d.abs() > tol1 { d } else { tol1.copysign(xm) };
        pb = eval(b)?.ok_or(UNDEFINED)?;
        fb = value(&pb);
    }
    Err(UNDEFINED)
}

/// Root of `h(F) = F − Φ(F)` nearest to `start` on `[lo, FOS_MAX]` (E10b, continuation along the λ scan).
///
/// The bracket is searched outward from `start`, both sides at the same distance, with growing steps. The first
/// sign change wins, and it is refined with Brent. A bracket that holds a pole gives a residual above
/// `ROOT_ACCEPT·F` and is discarded. `None` if no admissible root is found.
fn root_near(h: &dyn Fn(f64) -> Option<f64>, start: f64, lo: f64) -> Option<f64> {
    if lo > FOS_MAX {
        return None;
    }
    let x0 = start.clamp(lo, FOS_MAX);
    let h0 = h(x0);
    if h0 == Some(0.0) {
        return Some(x0);
    }
    let mut up = (x0, h0);
    let mut down = (x0, h0);
    let mut up_done = false;
    let mut down_done = false;
    let mut step = ROOT_STEP0;
    for _ in 0..ROOT_WALK_LIMIT {
        for side in [1.0_f64, -1.0] {
            let (prev, done) = if side > 0.0 {
                (&mut up, &mut up_done)
            } else {
                (&mut down, &mut down_done)
            };
            if *done {
                continue;
            }
            let x = (x0 * (1.0 + side * step)).clamp(lo, FOS_MAX);
            if x == prev.0 {
                // Clamped at the admissible end: nothing new to bracket on this side.
                *done = true;
                continue;
            }
            let hx = h(x);
            if let (Some(hp), Some(hv)) = (prev.1, hx)
                && hp * hv <= 0.0
            {
                let bracket = (prev.0, hp, x, hv);
                if let Some(root) = refine_root(h, bracket) {
                    return Some(root);
                }
            }
            *prev = (x, hx);
        }
        if up_done && down_done {
            break;
        }
        step *= ROOT_STEP_GROWTH;
    }
    None
}

/// Brent refinement of a root bracket of `h`. `None` if the bracket crosses a pole (residual above `ROOT_ACCEPT`).
fn refine_root(h: &dyn Fn(f64) -> Option<f64>, bracket: (f64, f64, f64, f64)) -> Option<f64> {
    let (xa, ha, xb, hb) = bracket;
    let (x, residual) = brent(
        |x| Ok(h(x)),
        |v: &f64| *v,
        |x, v: &f64| v.abs() <= ROOT_STOP * x,
        (xa, ha),
        (xb, hb),
        ROOT_XTOL,
        ROOT_BRENT_LIMIT,
    )
    .ok()?;
    (residual.abs() <= ROOT_ACCEPT * x).then_some(x)
}

/// The two factors at one λ and their difference `g = F_m − F_f`.
#[derive(Clone, Copy, Debug)]
struct Point {
    g: f64,
    moment: f64,
    force: f64,
}

/// State of the λ search: the slices, Bishop's lower bound and start value, and the evaluation budget.
struct Scheme<'a> {
    slices: &'a [Slice],
    m_bound: f64,
    start: f64,
    budget: usize,
    evaluations: usize,
}

impl Scheme<'_> {
    /// Roots `(F_m, F_f)` at `λ`, each searched from its warm start `warm`. `None` for a factor with no root.
    fn roots(&self, lambda: f64, warm: (f64, f64)) -> (Option<f64>, Option<f64>) {
        let bound = self.m_bound.max(pole_bound(self.slices, lambda));
        let lo = if bound > 0.0 {
            bound * (1.0 + ADM_MARGIN)
        } else {
            FOS_FLOOR
        };
        let slices = self.slices;
        let h_moment = |x: f64| factors_at(slices, lambda, x).map(|(m, _)| x - m);
        let h_force = |x: f64| factors_at(slices, lambda, x).map(|(_, f)| x - f);
        (
            root_near(&h_moment, warm.0, lo),
            root_near(&h_force, warm.1, lo),
        )
    }
}

/// Evaluates `g(λ)` from the warm start `warm`, refusing once the budget is spent (`Err("max_iterations")`).
/// `Ok(None)` when the point is undefined. Each call counts once toward the budget.
fn eval(scheme: &mut Scheme, lambda: f64, warm: (f64, f64)) -> Result<Option<Point>, &'static str> {
    if scheme.evaluations >= scheme.budget {
        return Err("max_iterations");
    }
    scheme.evaluations += 1;
    Ok(match scheme.roots(lambda, warm) {
        (Some(moment), Some(force)) => Some(Point {
            g: moment - force,
            moment,
            force,
        }),
        _ => None,
    })
}

/// True when two defined points of the scan bracket a sign change of `g` (zero included).
fn sign_change(a: Option<Point>, b: Option<Point>) -> Option<(Point, Point)> {
    match (a, b) {
        (Some(pa), Some(pb)) if pa.g * pb.g <= 0.0 => Some((pa, pb)),
        _ => None,
    }
}

/// Finds λ* (E10b): scans outward from 0 on both sides (`0, ±0.1, ±0.2, …`), so the first sign change is the one
/// nearest to 0, and refines it with Brent until `|g| ≤ ROOT_FRACTION·tolerance·F`. Ties at equal distance go to
/// the positive side. Each side carries its roots along the scan (continuation).
fn find_lambda(scheme: &mut Scheme, tolerance: f64) -> Result<(f64, Point), &'static str> {
    let start = (scheme.start, scheme.start);
    let g0 = eval(scheme, 0.0, start)?;
    let warm_of =
        |p: Option<Point>, fallback: (f64, f64)| p.map_or(fallback, |p| (p.moment, p.force));
    let mut pos = vec![g0];
    let mut neg = vec![g0];
    let mut warm_pos = warm_of(g0, start);
    let mut warm_neg = warm_pos;
    let steps = SCAN_POS_STEPS.max(SCAN_NEG_STEPS);
    for k in 0..steps {
        if k < SCAN_POS_STEPS {
            let next = eval(scheme, SCAN_STEP * (k + 1) as f64, warm_pos)?;
            if next.is_some() {
                warm_pos = warm_of(next, warm_pos);
            }
            pos.push(next);
            if let Some((pa, pb)) = sign_change(pos[k], next) {
                return refine_lambda(
                    scheme,
                    tolerance,
                    (SCAN_STEP * k as f64, pa),
                    (SCAN_STEP * (k + 1) as f64, pb),
                );
            }
        }
        if k < SCAN_NEG_STEPS {
            let next = eval(scheme, -SCAN_STEP * (k + 1) as f64, warm_neg)?;
            if next.is_some() {
                warm_neg = warm_of(next, warm_neg);
            }
            neg.push(next);
            if let Some((pa, pb)) = sign_change(neg[k], next) {
                return refine_lambda(
                    scheme,
                    tolerance,
                    (-SCAN_STEP * k as f64, pa),
                    (-SCAN_STEP * (k + 1) as f64, pb),
                );
            }
        }
    }
    Err("no_lambda_root")
}

/// Brent on `g(λ)` over the bracket of the scan, with the warm start of the latest defined point.
fn refine_lambda(
    scheme: &mut Scheme,
    tolerance: f64,
    left: (f64, Point),
    right: (f64, Point),
) -> Result<(f64, Point), &'static str> {
    let mut warm = (left.1.moment, left.1.force);
    brent(
        |x| {
            let p = eval(scheme, x, warm)?;
            if let Some(q) = p {
                warm = (q.moment, q.force);
            }
            Ok(p)
        },
        |p: &Point| p.g,
        |_, p: &Point| p.g.abs() <= ROOT_FRACTION * tolerance * p.moment.abs(),
        left,
        right,
        LAMBDA_EPS,
        LAMBDA_BRENT_LIMIT,
    )
    .map_err(|msg| {
        if msg == UNDEFINED {
            "no_lambda_root"
        } else {
            msg
        }
    })
}

/// Diagnostic curves of the scheme (E10b): for each λ, `(λ, F_m(λ), F_f(λ))`.
///
/// The roots are searched along the list, each λ warm-started from the previous one. The first λ starts from
/// Bishop's F (with `min_m_alpha = 0.2`), or from 1 if Bishop is invalid. A factor with no admissible root is `NaN`.
/// The curves do not use the evaluation budget and do not check admissibility or closure.
pub fn spencer_gle_curves(slices: &[Slice], lambdas: &[f64]) -> Vec<(f64, f64, f64)> {
    let Some(m_bound) = bishop::lower_bound(slices, DIAGNOSTIC_MIN_M) else {
        return lambdas.iter().map(|&l| (l, f64::NAN, f64::NAN)).collect();
    };
    let opts = SolveOptions {
        tolerance: 1e-8,
        max_iterations: 500,
        min_m_alpha: DIAGNOSTIC_MIN_M,
    };
    let start = bishop::solve(slices, &opts);
    let start_fos =
        if start.status != SolveStatus::Invalid && start.fos.is_finite() && start.fos > 0.0 {
            start.fos
        } else {
            1.0
        };
    let scheme = Scheme {
        slices,
        m_bound,
        start: start_fos,
        budget: usize::MAX,
        evaluations: 0,
    };
    let mut warm = (start_fos, start_fos);
    lambdas
        .iter()
        .map(|&lambda| {
            let (moment, force) = scheme.roots(lambda, warm);
            if let (Some(m), Some(f)) = (moment, force) {
                warm = (m, f);
            }
            (
                lambda,
                moment.unwrap_or(f64::NAN),
                force.unwrap_or(f64::NAN),
            )
        })
        .collect()
}

fn outcome(
    fos: f64,
    status: SolveStatus,
    iterations: usize,
    lambda: Option<f64>,
    message: Option<&str>,
) -> MethodResult {
    MethodResult::new(
        MethodKind::Spencer,
        fos,
        status,
        iterations,
        lambda,
        message,
    )
}

/// Spencer solver (E10b). Start: `F` from Bishop (or 1 if Bishop is invalid).
///
/// 1. `no_driving` (E3) and the Bishop lower bound (E8b) are checked first.
/// 2. λ* is found by the scan and Brent on `g = F_m − F_f`.
/// 3. At λ*, `F = F_m`. The interslice forces come from the exact recurrence, and the admissibility (E8b) and the
///    closure `|E_n| ≤ 1e-6·ΣW` are checked.
/// 4. The normal forces (E7d) and the notes (E7a, E7d) are attached to a `Converged` result.
pub(super) fn solve(slices: &[Slice], opts: &SolveOptions) -> MethodResult {
    if slices.is_empty() {
        return outcome(f64::NAN, SolveStatus::Invalid, 0, None, Some("no_slices"));
    }
    // Amendment E3: a surface without driving moment is invalid for Spencer too.
    if lacks_driving(slices) {
        return outcome(f64::NAN, SolveStatus::Invalid, 0, None, Some("no_driving"));
    }
    // E8b: a slice that Bishop's criterion rejects for every F makes every Spencer state inadmissible too.
    let Some(m_bound) = bishop::lower_bound(slices, opts.min_m_alpha) else {
        return outcome(f64::NAN, SolveStatus::Invalid, 0, None, Some("m_alpha"));
    };
    let start = bishop::solve(slices, opts);
    let start_fos =
        if start.status != SolveStatus::Invalid && start.fos.is_finite() && start.fos > 0.0 {
            start.fos
        } else {
            1.0
        };
    let total_w: f64 = slices.iter().map(|s| s.weight).sum();
    let mut scheme = Scheme {
        slices,
        m_bound,
        start: start_fos,
        budget: opts.max_iterations,
        evaluations: 0,
    };

    let (lambda, point) = match find_lambda(&mut scheme, opts.tolerance) {
        Ok(found) => found,
        Err(msg) => {
            return outcome(
                f64::NAN,
                SolveStatus::NotConverged,
                scheme.evaluations,
                None,
                Some(msg),
            );
        }
    };
    let iterations = scheme.evaluations;
    let fos = point.moment;

    // Forces at the root: the exact recurrence at (F, λ*).
    let e = spencer_interslice(slices, fos, lambda);
    if e.iter().any(|v| !v.is_finite()) {
        return outcome(
            fos,
            SolveStatus::Invalid,
            iterations,
            Some(lambda),
            Some("non_finite"),
        );
    }
    if let Some(reason) = inadmissibility(slices, fos, lambda, opts.min_m_alpha) {
        return outcome(
            fos,
            SolveStatus::Invalid,
            iterations,
            Some(lambda),
            Some(reason),
        );
    }
    let closure = e.last().copied().unwrap_or(0.0).abs();
    if closure > CLOSURE_FRACTION * total_w {
        return outcome(
            fos,
            SolveStatus::NotConverged,
            iterations,
            Some(lambda),
            Some("no_lambda_root"),
        );
    }

    let normals = spencer_direct_normals(slices, lambda, &e);
    let normal_class = negative_normal_message(slices, |k, _| normals[k]);
    let air = air_gap_thrust(slices, &e);
    outcome(fos, SolveStatus::Converged, iterations, Some(lambda), None)
        .with_warnings(converged_notes(air, normal_class))
}
