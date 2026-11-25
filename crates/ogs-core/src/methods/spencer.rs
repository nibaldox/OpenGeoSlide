//! Spencer method, i.e. Morgenstern-Price with f(x) = 1 (§4.3), amendments E10c, E11a, E11b, E11c and E12e.
//!
//! Sign convention (§4.3 leaves it to the implementer):
//! - Slices run toe → crest, with `alpha > 0` when the base rises toward the crest, so `W·sin α > 0` drives the slide.
//! - `E[k]` is the normal interslice force on the face below slice `k` (`E[0]` toe face, `E[n]` crest face).
//!   `E > 0` is tension. The horizontal equilibrium of slice `k` is `E[k+1] − E[k] = N sin α − S cos α`, with `N` the
//!   total normal force on the base and `S = (c·l + (N − u·l)·tan φ) / F` the mobilised shear.
//! - Interslice shear `X = λ·f·E` with f = 1, same sign as E. Net shear of slice `k`: `ΔX_k = λ·ΔE_k`.
//! - Vertical equilibrium `N cos α + S sin α = W − ΔX`. Eliminating `N` and `S` gives the recurrence of
//!   [`spencer_interslice`]: `ΔE = (F·W sin α − R) / D`, with `D = (sin α − λ cos α) tan φ + (cos α + λ sin α) F` and
//!   `R = (W cos α − u·l) tan φ + c·l`. For given `(F, λ)` the forces E are unique, and `E[0] = 0` fixes them.
//! - Effective normal force (E4e, E7d): `N' = N − u·l`, in the direct form `N' = W cos α − u·l + (sin α − λ cos α)·ΔE`
//!   (free of `m_α`). With `ΔX = 0` it is Bishop's `N'` (tests).
//!
//! Seismic force and loads (E12b). A slice carries `W* = W·(1 + kv) + Q + V` in place of `W`, and a horizontal force
//! `H = kh·W + H^P` in the sliding direction (`Slice::weight_extra`, `Slice::h_force`). Derivation, in the frame where
//! the crest is on the right and the slide goes toward −x (a left-to-right slide is the mirror image, and `α` is
//! already signed toward the crest):
//! - Horizontal equilibrium: `E[k+1] − E[k] = N sin α − S cos α + H`.
//! - Vertical equilibrium: `N cos α + S sin α = W* − λ·ΔE` (`H` has no vertical component).
//! - Eliminating `N'` as before gives `ΔE = [F·W* sin α − R + (F cos α + tan φ sin α)·H] / D`, with
//!   `R = (W* cos α − U) tan φ + c·l` and the same `D`. Note `F cos α + tan φ sin α = F·m_α`. With `H = 0` this is the
//!   recurrence above.
//! - Direct normal: `N' = W* cos α − U − H sin α + (sin α − λ cos α)·ΔE`.
//! - Moment of the slice about the midpoint of its base, with the thrust line on the base (Zhu): the interslice
//!   forces give `(b/2)(λ − tan α)(E_k + E_{k+1})`, `W*`, `N` and `S` give nothing, and `H` gives
//!   `H·(y_application − y_base)`, which the slicer sums in `Slice::h_moment_base`. The sum over the slices is zero:
//!   `Σ b (E_k + E_{k+1})(tan α − λ) − 2·Σ h_moment_base = 0`.
//!
//! Since every slice is in force equilibrium, the sum of the moments about the base midpoints is the moment about
//! the circle centre, so the same equation is the global moment equilibrium about O (E12b criterion ii).
//!
//! Scheme (E11a, E11b, E11c). For each λ of the scan:
//! - **Force closure** `E_n(F, λ) = 0` (`|E_n| ≤ 1e-6·ΣW`). Its root `F_f(λ)` is the one nearest to the previous point
//!   of the scan (continuation), searched above the lower bound of F given by the admissibility at this λ.
//! - **Moment residual without divisor** `r(λ) = Σ b (E_k + E_{k+1}) (tan α_k − λ)`, evaluated at `F_f(λ)` and
//!   normalised as `ρ(λ) = r / (ΣW · Σb)`. It has no asymptotes from the denominator of Zhu's update.
//!
//! The scan covers the whole range λ ∈ [−0.5; 1.5] with step 0.05 (E12e), outward and symmetrically from 0 by levels
//! `|λ| = 0.05·k`, with no early stop. Every sign change of ρ between two adjacent defined points is refined with Brent
//! until `|ρ| ≤ tol_r = min(1e-3·tolerance, 1e-6)` (E11c). The final acceptance is `|ρ| ≤ 1e-6`, so every root that
//! Brent accepts passes it. A bracket that closes on a jump of the closure root is not a root.
//!
//! Candidates are the roots that are admissible at their F (E11b): on every soil slice `Φᵢ/F ≥ min_m_alpha`, which is
//! Bishop's `m_α` at λ = 0, and `m_α(F) ≥ min_m_alpha`. Selection (E12e, replaces E11a′): the candidate of smallest F
//! (the conservative one); a tie within 1e-9 relative goes to the smaller `|λ|`. A negative λ adds the note
//! `negative_lambda`, and a second admissible root whose F is more than 1 % above the chosen one adds the note
//! `multiple_admissible_roots`. With no candidate: `NotConverged("no_admissible_root")` if some root existed,
//! otherwise `NotConverged("no_lambda_root")`.
//!
//! Air slices (E2, E7a): no weight, no strength, `E` passes through unchanged. They take part in the moment sum with
//! their own α. An interior air run carrying `|E| > 1e-3·ΣW` adds the note `air_gap_thrust`. Surfaces that split the
//! soil into detached masses never reach this solver (E10a, in the slicer).
//!
//! Budget: each evaluation of ρ(λ) (one closure root) and each Brent step counts once toward `max_iterations`.
//! Exhausting it gives `NotConverged("max_iterations")`.

use super::{
    MethodResult, SolveOptions, SolveStatus, air_gap_thrust, bishop, converged_notes, is_inert,
    lacks_driving, m_alpha, negative_normal_message,
};
use crate::model::MethodKind;
use crate::slicer::Slice;

/// Relative pole threshold of the recurrence: a soil slice with `Φ_i ≤ 1e-9 · F` is a numerical pole.
const POLE_FRACTION: f64 = 1e-9;
/// Upper end of the F search interval (E7c, as in Bishop E7b).
const FOS_MAX: f64 = 1e3;
/// Relative margin above the lower bound of F (E7c).
const ADM_MARGIN: f64 = 1e-6;
/// Lower end of the F interval when no slice bounds F from below.
const FOS_FLOOR: f64 = 1e-9;
/// Below this magnitude the moment denominator `Σ b (E_k + E_{k+1})` is treated as zero (diagnostics only).
const MOMENT_DENOM_EPS: f64 = 1e-12;
/// Brent steps of one root in F (E10c).
const ROOT_BRENT_LIMIT: usize = 100;
/// Outward steps of the bracket search for one root in F. The step grows by `ROOT_STEP_GROWTH` each time.
const ROOT_WALK_LIMIT: usize = 60;
const ROOT_STEP0: f64 = 0.01;
/// Newton steps of the fast path of the root in F.
const NEWTON_LIMIT: usize = 8;
/// Closure residual (`E_n / ΣW`) below which one more Newton step is taken without re-evaluating.
const NEWTON_TRUST: f64 = 1e-6;
const ROOT_STEP_GROWTH: f64 = 1.5;
/// Absolute width at which Brent stops in F.
const ROOT_XTOL: f64 = 1e-13;
/// Residual of the closure (`E_n / ΣW`, dimensionless) at which Brent stops in F.
const ROOT_STOP: f64 = 1e-12;
/// Largest residual (`E_n / ΣW`) accepted as a closed root in F. Above it the bracket crossed a pole.
const ROOT_ACCEPT: f64 = 1e-9;
/// Force closure at λ*: `|E_n| ≤ CLOSURE_FRACTION · ΣW` (E10b, E10c).
const CLOSURE_FRACTION: f64 = 1e-6;
/// Brent stops on ρ(λ) when `|ρ| ≤ min(ROOT_FRACTION · tolerance, MOMENT_ACCEPT)` (E11c).
const ROOT_FRACTION: f64 = 1e-3;
/// Final acceptance of a moment root: `|ρ(λ*)| ≤ MOMENT_ACCEPT` (E11c). Brent stops at a tighter `tol_r ≤ MOMENT_ACCEPT`,
/// so every root that Brent accepts passes this cut. A closed-form tolerance below machine precision cannot stall it.
const MOMENT_ACCEPT: f64 = 1e-6;
/// Scan of λ (E11a): step 0.05 over [−0.5; 1.5], that is 10 steps below 0 and 30 steps above it.
const SCAN_STEP: f64 = 0.05;
const SCAN_NEG_STEPS: i32 = 10;
const SCAN_POS_STEPS: i32 = 30;
/// Absolute width of the λ bracket below which Brent gives up.
const LAMBDA_EPS: f64 = 1e-13;
/// Brent steps of one λ root (each one is a budget evaluation).
const LAMBDA_BRENT_LIMIT: usize = 100;
/// Minimum `m_α` of the diagnostic curves (`spencer_gle_curves`), as the default of the analysis.
const DIAGNOSTIC_MIN_M: f64 = 0.2;
/// Internal reason of a point that cannot be evaluated (a pole, or no closure root in the admissible region).
const UNDEFINED: &str = "undefined";
/// Note of a converged state whose λ is negative (E11a).
const NEGATIVE_LAMBDA_MESSAGE: &str = "negative_lambda";
/// Note of a converged state with several admissible roots whose F differ by more than `MULTIPLE_ROOTS_FRACTION` (E12e).
const MULTIPLE_ROOTS_MESSAGE: &str = "multiple_admissible_roots";
/// Relative F difference above which a second admissible root is reported (1 %, E12e).
const MULTIPLE_ROOTS_FRACTION: f64 = 0.01;
/// Relative F difference within which two admissible roots tie, and the smaller `|λ|` wins (E12e).
const TIE_FRACTION: f64 = 1e-9;

/// Recurrence pole `D = (sin α − λ cos α) tan φ + (cos α + λ sin α) F` (f = 1).
fn pole(s: &Slice, fos: f64, lambda: f64) -> f64 {
    let (sin, cos) = s.alpha.sin_cos();
    (sin - lambda * cos) * s.tan_phi + (cos + lambda * sin) * fos
}

/// Resisting term `R = (W* cos α − U) tan φ + c·l`, with `U = u·l` and `l = b / cos α`.
fn resisting(s: &Slice) -> f64 {
    (s.total_weight() * s.alpha.cos() - s.pore_pressure * s.base_length) * s.tan_phi
        + s.cohesion * s.base_length
}

/// Driving term `T = W* sin α`.
fn driving(s: &Slice) -> f64 {
    s.total_weight() * s.alpha.sin()
}

/// Interslice normal forces `E[0..=n]` for the given `F` and `λ` (f = 1), with `E[0] = 0`.
///
/// `E[k+1] = E[k] + (F·T_k − R_k + (F cos α + tan φ sin α)·H_k) / D_k`, the exact solution of the vertical and
/// horizontal equilibrium of slice `k` with `X = λE` (E12b: `T` and `R` use `W*`, and `H` is the horizontal force in the
/// sliding direction). Values are non-finite if a pole vanishes. Air slices (E2) have `T = R = H = 0`, so the normal
/// force passes through them unchanged: `E[k+1] = E[k]`.
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
        let (sin, cos) = s.alpha.sin_cos();
        let thrust = (fos * cos + s.tan_phi * sin) * s.h_force;
        e.push(prev + (fos * driving(s) - resisting(s) + thrust) / d);
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
/// `N' = W* cos α − U − H sin α + (sin α − λ cos α)·ΔE`, with `ΔE = E_{k+1} − E_k` and `U = u·l` (E12b).
/// `e` are the interslice forces of [`spencer_interslice`] at the same `(F, λ)`.
pub fn spencer_direct_normals(slices: &[Slice], lambda: f64, e: &[f64]) -> Vec<f64> {
    slices
        .iter()
        .enumerate()
        .map(|(k, s)| {
            let (sin, cos) = s.alpha.sin_cos();
            let de = e[k + 1] - e[k];
            s.total_weight() * cos - s.pore_pressure * s.base_length - s.h_force * sin
                + (sin - lambda * cos) * de
        })
        .collect()
}

/// Lower bound of F from the admissibility at `λ` (E11b): `Φ_i / F ≥ min_m` reads `p_i + (a_i − min_m)·F ≥ 0`, with
/// `p_i = (sin α − λ cos α) tan φ` and `a_i = cos α + λ sin α`. For `a_i > min_m` it gives
/// `F ≥ −p_i/(a_i − min_m)`; the bound is the largest of these (0 if none). Slices with `a_i ≤ min_m` give an upper
/// bound, which the admissibility test of the candidates checks.
fn pole_bound(slices: &[Slice], lambda: f64, min_m: f64) -> f64 {
    let mut bound = 0.0_f64;
    for s in slices.iter().filter(|s| !is_inert(s)) {
        let (sin, cos) = s.alpha.sin_cos();
        let p = (sin - lambda * cos) * s.tan_phi;
        let a = cos + lambda * sin;
        if a - min_m > 0.0 {
            bound = bound.max(-p / (a - min_m));
        }
    }
    bound
}

/// Admissibility of a root at `(F, λ)` (E11b). On every soil slice: `Φ_i / F ≥ min_m_alpha` (at λ = 0 this is
/// Bishop's `m_α`), and `m_α(F) ≥ min_m_alpha`. NaN fails.
fn admissible(slices: &[Slice], fos: f64, lambda: f64, min_m: f64) -> bool {
    fos.is_finite()
        && fos > 0.0
        && slices
            .iter()
            .filter(|s| !is_inert(s))
            .all(|s| pole(s, fos, lambda) / fos >= min_m && m_alpha(s, fos) >= min_m)
}

/// Per-slice terms that do not depend on `(F, λ)`, computed once per solve (E10c, performance). With `H` the horizontal
/// force of the slice (E12b), the recurrence reads `ΔE = (F·t − res) / D`, where `t = W* sin α + H cos α` and
/// `res = (W* cos α − U) tan φ + c·l − H sin α tan φ`: the terms of `H` are folded in, so the loop costs the same.
#[derive(Clone, Copy, Debug)]
struct Prep {
    sin: f64,
    cos: f64,
    tan: f64,
    tan_phi: f64,
    width: f64,
    t: f64,
    res: f64,
    inert: bool,
}

fn prepare(slices: &[Slice]) -> Vec<Prep> {
    slices
        .iter()
        .map(|s| {
            let (sin, cos) = s.alpha.sin_cos();
            Prep {
                sin,
                cos,
                tan: sin / cos,
                tan_phi: s.tan_phi,
                width: s.width,
                t: s.total_weight() * sin + s.h_force * cos,
                res: (s.total_weight() * cos - s.pore_pressure * s.base_length) * s.tan_phi
                    + s.cohesion * s.base_length
                    - s.h_force * sin * s.tan_phi,
                inert: is_inert(s),
            }
        })
        .collect()
}

/// The sums of the recurrence at `(F, λ)` (E10c, E11a). Allocation-free.
#[derive(Clone, Copy, Debug)]
struct Balance {
    /// Interslice force at the crest, `E_n`. The force closure is `E_n = 0`.
    closure: f64,
    /// `Σ b (E_k + E_{k+1}) tan α_k`: the numerator of Zhu's moment update, without divisor.
    num: f64,
    /// `Σ b (E_k + E_{k+1})`: the denominator of Zhu's update.
    den: f64,
}

/// Balance at `(fos, λ)`, or `None` at a pole (`D ≤ 1e-9·F` on a soil slice) or a non-finite recurrence.
fn balance_at(preps: &[Prep], lambda: f64, fos: f64) -> Option<Balance> {
    let mut e = 0.0_f64;
    let (mut num, mut den) = (0.0_f64, 0.0_f64);
    for p in preps {
        let e_prev = e;
        if !p.inert {
            let d = (p.sin - lambda * p.cos) * p.tan_phi + (p.cos + lambda * p.sin) * fos;
            if d.is_nan() || d <= POLE_FRACTION * fos {
                return None;
            }
            e = e_prev + (fos * p.t - p.res) / d;
        }
        // Air slices keep E, and they take part in the sums with their own α (E7a).
        let sum_e = e_prev + e;
        num += p.width * sum_e * p.tan;
        den += p.width * sum_e;
    }
    if !(e.is_finite() && num.is_finite() && den.is_finite()) {
        return None;
    }
    Some(Balance {
        closure: e,
        num,
        den,
    })
}

/// Closure `E_n` and its derivative `dE_n/dF` at `(fos, λ)`, or `None` at a pole or a non-finite value. The derivative
/// is exact: `D = a + b·F` is linear in F, so `d(ΔE)/dF = (t·D − (F·t − res)·b) / D²`. Used by the Newton fast path of
/// the force root only (allocation-free).
fn closure_slope(preps: &[Prep], lambda: f64, fos: f64) -> Option<(f64, f64)> {
    let (mut e, mut de) = (0.0_f64, 0.0_f64);
    for p in preps.iter().filter(|p| !p.inert) {
        let b = p.cos + lambda * p.sin;
        let d = (p.sin - lambda * p.cos) * p.tan_phi + b * fos;
        if d.is_nan() || d <= POLE_FRACTION * fos {
            return None;
        }
        let q = fos * p.t - p.res;
        let inv = 1.0 / d;
        e += q * inv;
        de += (p.t * d - q * b) * inv * inv;
    }
    (e.is_finite() && de.is_finite()).then_some((e, de))
}

/// Zhu's moment update `[Σ b (E_k + E_{k+1}) tan α − 2·Σ h_moment_base] / Σ b (E_k + E_{k+1})`, for the diagnostic
/// curves only. `moment_h` is `2·Σ h_moment_base` (E12b), zero without seismic force or line loads.
fn moment_ratio(b: &Balance, moment_h: f64) -> Option<f64> {
    (b.den.abs() > MOMENT_DENOM_EPS)
        .then(|| (b.num - moment_h) / b.den)
        .filter(|v| v.is_finite())
}

/// Value and derivative of the closure `h(F)`, for the Newton fast path.
type SlopeFn<'a> = dyn Fn(f64) -> Option<(f64, f64)> + 'a;

/// Root of `h(F) = 0` nearest to `start` on `[lo, FOS_MAX]` (continuation along the λ scan, E10c).
///
/// Fast path: when `fast = (slope, guess)` is given (`slope` is the value and derivative of `h`, `guess` a better start
/// than `start`, e.g. extrapolated along the scan), Newton's method from `guess` is tried first. Its root is accepted only
/// if it stays on `[lo, FOS_MAX]` and within `ROOT_STEP0` (relative) of `start`, which is the first bracket of the walk
/// below, so the root is the one the walk finds; otherwise the walk runs as usual.
///
/// The bracket is searched outward from `start`, both sides at the same distance, with growing steps. The first
/// sign change wins, and it is refined with Brent. A bracket that holds a pole leaves a residual above `ROOT_ACCEPT`
/// and is discarded. `None` if no admissible root is found.
fn root_near(
    h: &dyn Fn(f64) -> Option<f64>,
    fast: Option<(&SlopeFn<'_>, f64)>,
    start: f64,
    lo: f64,
) -> Option<f64> {
    if lo > FOS_MAX {
        return None;
    }
    let x0 = start.clamp(lo, FOS_MAX);
    if let Some((slope, guess)) = fast
        && let Some(root) = newton_near(slope, guess.clamp(lo, FOS_MAX), x0, lo)
    {
        return Some(root);
    }
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

/// Newton iteration on `h` from `guess`, around the start `x0` (see [`root_near`]). `None` when it does not settle within a few steps or leaves
/// `[lo, FOS_MAX]` or the `ROOT_STEP0` neighbourhood of `x0`.
///
/// The step taken from a point with `|h| ≤ NEWTON_TRUST` is returned without evaluating `h` again: Newton's error is
/// quadratic there (about 1e-12 or less), and the caller checks the closure at the returned point (`ROOT_ACCEPT`).
fn newton_near(slope: &SlopeFn<'_>, guess: f64, x0: f64, lo: f64) -> Option<f64> {
    let mut x = guess;
    for _ in 0..NEWTON_LIMIT {
        let (h, dh) = slope(x)?;
        if h.abs() <= ROOT_STOP {
            return Some(x);
        }
        if dh == 0.0 {
            return None;
        }
        let next = x - h / dh;
        if !(lo..=FOS_MAX).contains(&next) || (next - x0).abs() > ROOT_STEP0 * x0 {
            return None;
        }
        if h.abs() <= NEWTON_TRUST {
            return Some(next);
        }
        x = next;
    }
    None
}

/// Brent refinement of a root bracket of `h`. `None` if the bracket crosses a pole (residual above `ROOT_ACCEPT`).
fn refine_root(h: &dyn Fn(f64) -> Option<f64>, bracket: (f64, f64, f64, f64)) -> Option<f64> {
    let (xa, ha, xb, hb) = bracket;
    let (x, residual) = brent(
        |x| Ok(h(x)),
        |v: &f64| *v,
        |_, v: &f64| v.abs() <= ROOT_STOP,
        (xa, ha),
        (xb, hb),
        ROOT_XTOL,
        ROOT_BRENT_LIMIT,
    )
    .ok()?;
    (residual.abs() <= ROOT_ACCEPT).then_some(x)
}

/// Brent's method (Brent 1973, as in Numerical Recipes `zbrent`) on a value `T` with a sign change between `a0` and
/// `b0`. Stops when `stop(x, t)` holds, when the value is exactly zero, or when the bracket is narrower than `xtol`.
/// `eval` gives `Ok(None)` at an undefined point (`UNDEFINED`), and `Err` passes through (budget).
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

/// A point of the λ scan: the moment residual `ρ(λ)` at the force root `fos = F_f(λ)`.
#[derive(Clone, Copy, Debug)]
struct Point {
    rho: f64,
    fos: f64,
}

/// A root of the scan: `ρ(λ) ≈ 0` at `λ`, with the force root `fos = F_f(λ)`.
#[derive(Clone, Copy, Debug)]
struct Root {
    lambda: f64,
    fos: f64,
}

/// State of the λ search: the slices, their per-slice terms, Bishop's lower bound and start value, and the budget.
struct Scheme<'a> {
    slices: &'a [Slice],
    preps: Vec<Prep>,
    m_bound: f64,
    /// `min_m_alpha` of the admissibility (E11b).
    min_m: f64,
    start: f64,
    total_w: f64,
    total_width: f64,
    /// `2·Σ h_moment_base`: twice the moment of the horizontal forces about the base midpoints (E12b).
    moment_h: f64,
    budget: usize,
    evaluations: usize,
}

impl Scheme<'_> {
    /// Lower bound of F at `λ`: Bishop's `m_α` bound (E8b) and the admissibility of the poles (E11b).
    fn lower(&self, lambda: f64) -> f64 {
        let bound = self
            .m_bound
            .max(pole_bound(self.slices, lambda, self.min_m));
        if bound > 0.0 {
            bound * (1.0 + ADM_MARGIN)
        } else {
            FOS_FLOOR
        }
    }

    /// Normalised moment residual `ρ = [Σb(E_k + E_{k+1})(tan α_k − λ) − 2·Σ h_moment_base] / (ΣW · Σb)` (E11a, E12b).
    fn residual(&self, b: &Balance, lambda: f64) -> f64 {
        (b.num - lambda * b.den - self.moment_h) / (self.total_w * self.total_width)
    }

    /// Force root `F_f(λ)` from the warm start `warm`, and the moment residual at it.
    fn point(&self, lambda: f64, warm: f64, guess: f64) -> Option<Point> {
        let preps = &self.preps;
        let total_w = self.total_w;
        let closure = |x: f64| balance_at(preps, lambda, x).map(|b| b.closure / total_w);
        let slope =
            |x: f64| closure_slope(preps, lambda, x).map(|(e, de)| (e / total_w, de / total_w));
        let lower = self.lower(lambda);
        let mut fos = root_near(&closure, Some((&slope, guess)), warm, lower)?;
        let mut b = balance_at(preps, lambda, fos)?;
        if b.closure.abs() / total_w > ROOT_ACCEPT {
            // The Newton fast path did not close (a pole nearby): redo it with the bracketing walk.
            fos = root_near(&closure, None, warm, lower)?;
            b = balance_at(preps, lambda, fos)?;
        }
        Some(Point {
            rho: self.residual(&b, lambda),
            fos,
        })
    }
}

/// Evaluates `ρ(λ)` from the warm start `warm`, refusing once the budget is spent (`Err("max_iterations")`).
/// `Ok(None)` when the point is undefined. Each call counts once toward the budget.
fn eval(
    scheme: &mut Scheme,
    lambda: f64,
    warm: f64,
    guess: f64,
) -> Result<Option<Point>, &'static str> {
    if scheme.evaluations >= scheme.budget {
        return Err("max_iterations");
    }
    scheme.evaluations += 1;
    Ok(scheme.point(lambda, warm, guess))
}

/// Refines one sign change of ρ with Brent (E11a, E11c). `Ok(None)` when the bracket does not close on a zero:
/// it closes on a pole or on a jump of the closure root (`|ρ| > MOMENT_ACCEPT` there), or it meets an undefined point.
fn refine(
    scheme: &mut Scheme,
    tol_r: f64,
    left: (f64, Point),
    right: (f64, Point),
) -> Result<Option<Root>, &'static str> {
    let mut warm = left.1.fos;
    let found = brent(
        |x| {
            let p = eval(scheme, x, warm, warm)?;
            if let Some(q) = p {
                warm = q.fos;
            }
            Ok(p)
        },
        |p: &Point| p.rho,
        |_, p: &Point| p.rho.abs() <= tol_r,
        left,
        right,
        LAMBDA_EPS,
        LAMBDA_BRENT_LIMIT,
    );
    match found {
        Ok((lambda, p)) if p.rho.abs() <= MOMENT_ACCEPT => Ok(Some(Root { lambda, fos: p.fos })),
        Ok(_) => Ok(None),
        Err(msg) if msg == UNDEFINED => Ok(None),
        Err(msg) => Err(msg),
    }
}

/// Result of the λ scan (E12e): every root of ρ found over [−0.5; 1.5], admissible or not.
struct Scan {
    roots: Vec<Root>,
}

/// Admissible root of smallest F (E12e). A tie within `TIE_FRACTION` (relative) goes to the smaller `|λ|`, and then to
/// the positive λ. Also returns whether a second admissible root exists whose F differs from the chosen one by more
/// than `MULTIPLE_ROOTS_FRACTION` (the note `multiple_admissible_roots`).
fn select_root(roots: &[Root], admissible: &dyn Fn(&Root) -> bool) -> Option<(Root, bool)> {
    let candidates: Vec<Root> = roots.iter().copied().filter(|r| admissible(r)).collect();
    let (fmin, fmax) = candidates
        .iter()
        .fold((f64::INFINITY, f64::NEG_INFINITY), |(lo, hi), r| {
            (lo.min(r.fos), hi.max(r.fos))
        });
    let chosen = candidates
        .iter()
        .copied()
        .filter(|r| r.fos <= fmin * (1.0 + TIE_FRACTION))
        .min_by(|a, b| {
            a.lambda
                .abs()
                .total_cmp(&b.lambda.abs())
                .then(b.lambda.total_cmp(&a.lambda))
        })?;
    Some((
        chosen,
        candidates.len() > 1 && fmax > fmin * (1.0 + MULTIPLE_ROOTS_FRACTION),
    ))
}

/// Records the grid point at `λ` as a root when `|ρ| ≤ tol_r` (E11a).
fn point_root(level: &mut Vec<Root>, lambda: f64, point: Option<Point>, tol_r: f64) {
    if let Some(p) = point
        && p.rho.abs() <= tol_r
    {
        level.push(Root { lambda, fos: p.fos });
    }
}

/// Refines the sign change of ρ between two adjacent grid points, when both are defined and off the root (E11a).
fn bracket(
    scheme: &mut Scheme,
    tol_r: f64,
    a: Option<(f64, Point)>,
    b: Option<(f64, Point)>,
    level: &mut Vec<Root>,
) -> Result<(), &'static str> {
    if let (Some((xa, pa)), Some((xb, pb))) = (a, b)
        && pa.rho.abs() > tol_r
        && pb.rho.abs() > tol_r
        && pa.rho * pb.rho < 0.0
        && let Some(root) = refine(scheme, tol_r, (xa, pa), (xb, pb))?
    {
        level.push(root);
    }
    Ok(())
}

/// Scans the whole range λ ∈ [−0.5; 1.5] (E12e), outward and symmetrically from 0 by levels `|λ| = 0.05·k` (both signs
/// in each level, each side warm-started from its previous level), and refines every sign change of ρ between adjacent
/// defined points with Brent. It returns every root; the choice among them is [`select_root`]. There is no early stop:
/// the root of smallest F can be at any λ.
fn scan(scheme: &mut Scheme, tol_r: f64) -> Result<Scan, &'static str> {
    let at = |k: i32| k as f64 * SCAN_STEP;
    let zero = eval(scheme, 0.0, scheme.start, scheme.start)?;
    let mut roots = Vec::new();
    point_root(&mut roots, 0.0, zero, tol_r);
    let (mut prev_pos, mut prev_neg) = (zero.map(|p| (0.0, p)), zero.map(|p| (0.0, p)));
    let mut warm_pos = zero.map_or(scheme.start, |p| p.fos);
    let mut warm_neg = warm_pos;
    // F of the point before the previous one on each side, for the linear extrapolation of the Newton start.
    let (mut before_pos, mut before_neg): (Option<f64>, Option<f64>) = (None, None);
    let extrapolate =
        |prev: Option<(f64, Point)>, before: Option<f64>, warm: f64| match (prev, before) {
            (Some((_, p)), Some(b)) => 2.0 * p.fos - b,
            _ => warm,
        };
    for k in 1..=SCAN_POS_STEPS.max(SCAN_NEG_STEPS) {
        let mut cur_pos = None;
        let mut cur_neg = None;
        if k <= SCAN_POS_STEPS {
            let guess = extrapolate(prev_pos, before_pos, warm_pos);
            cur_pos = eval(scheme, at(k), warm_pos, guess)?;
            if let Some(q) = cur_pos {
                warm_pos = q.fos;
            }
            point_root(&mut roots, at(k), cur_pos, tol_r);
        }
        if k <= SCAN_NEG_STEPS {
            let guess = extrapolate(prev_neg, before_neg, warm_neg);
            cur_neg = eval(scheme, at(-k), warm_neg, guess)?;
            if let Some(q) = cur_neg {
                warm_neg = q.fos;
            }
            point_root(&mut roots, at(-k), cur_neg, tol_r);
        }
        bracket(
            scheme,
            tol_r,
            prev_pos,
            cur_pos.map(|p| (at(k), p)),
            &mut roots,
        )?;
        bracket(
            scheme,
            tol_r,
            prev_neg,
            cur_neg.map(|p| (at(-k), p)),
            &mut roots,
        )?;
        before_pos = prev_pos.map(|(_, p)| p.fos);
        before_neg = prev_neg.map(|(_, p)| p.fos);
        prev_pos = cur_pos.map(|p| (at(k), p));
        prev_neg = cur_neg.map(|p| (at(-k), p));
    }
    Ok(Scan { roots })
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

/// Diagnostic curves of the scheme (E10c): for each λ, `(λ, F_m(λ), F_f(λ))`.
///
/// `F_f(λ)` is the root of the force closure. `F_m(λ)` is the root in F of Zhu's moment equation `λ_upd(F, λ) = λ`.
/// Both are searched along the list, each λ warm-started from the previous one. The first λ starts from Bishop's F
/// (with `min_m_alpha = 0.2`), or from 1 if Bishop is invalid. A factor with no admissible root is `NaN`.
/// The curves do not use the evaluation budget and do not check admissibility or closure at λ.
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
        preps: prepare(slices),
        m_bound,
        min_m: DIAGNOSTIC_MIN_M,
        start: start_fos,
        total_w: slices.iter().map(|s| s.weight).sum(),
        total_width: slices.iter().map(|s| s.width).sum(),
        moment_h: 2.0 * slices.iter().map(|s| s.h_moment_base).sum::<f64>(),
        budget: usize::MAX,
        evaluations: 0,
    };
    let total_w = scheme.total_w;
    let mut warm = (start_fos, start_fos);
    lambdas
        .iter()
        .map(|&lambda| {
            let preps = &scheme.preps;
            let closure = |x: f64| balance_at(preps, lambda, x).map(|b| b.closure / total_w);
            let force = root_near(&closure, None, warm.1, scheme.lower(lambda));
            let moment_residual = |x: f64| {
                balance_at(preps, lambda, x)
                    .and_then(|b| moment_ratio(&b, scheme.moment_h))
                    .map(|m| m - lambda)
            };
            let moment = root_near(&moment_residual, None, warm.0, scheme.lower(lambda));
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

/// Spencer solver (E10c, E11a, E11b, E11c, E12e). Start: `F` from Bishop (or 1 if Bishop is invalid).
///
/// 1. `no_driving` (E3) and the Bishop lower bound (E8b) are checked first.
/// 2. The λ scan covers the whole range [−0.5; 1.5], and each root is refined to `|ρ| ≤ tol_r` (E11c).
/// 3. The candidates are the admissible roots (E11b). λ* is the admissible root of smallest F (E12e), with the notes
///    `negative_lambda` when it is negative and `multiple_admissible_roots` when another candidate is more than 1 %
///    above it.
/// 4. At λ*, the closure `|E_n| ≤ 1e-6·ΣW` is checked, and the normal forces (E7d) and the notes (E7a, E7d) are
///    attached to the `Converged` result.
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
    let total_width: f64 = slices.iter().map(|s| s.width).sum();
    let mut scheme = Scheme {
        slices,
        preps: prepare(slices),
        m_bound,
        min_m: opts.min_m_alpha,
        start: start_fos,
        total_w,
        total_width,
        moment_h: 2.0 * slices.iter().map(|s| s.h_moment_base).sum::<f64>(),
        budget: opts.max_iterations,
        evaluations: 0,
    };
    // E11c: Brent stops at tol_r; a root is accepted at MOMENT_ACCEPT, which is never below tol_r.
    let tol_r = (ROOT_FRACTION * opts.tolerance).min(MOMENT_ACCEPT);

    let admissible_at = |r: &Root| admissible(slices, r.fos, r.lambda, opts.min_m_alpha);
    let search = match scan(&mut scheme, tol_r) {
        Ok(search) => search,
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
    // E12e: the admissible root of smallest F (ties: smallest |λ|).
    let Some((root, multiple)) = select_root(&search.roots, &admissible_at) else {
        let msg = if !search.roots.is_empty() {
            "no_admissible_root"
        } else {
            "no_lambda_root"
        };
        return outcome(
            f64::NAN,
            SolveStatus::NotConverged,
            iterations,
            None,
            Some(msg),
        );
    };
    let (lambda, fos) = (root.lambda, root.fos);

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
    let mut notes = Vec::with_capacity(3);
    if lambda < 0.0 {
        notes.push(NEGATIVE_LAMBDA_MESSAGE);
    }
    if multiple {
        notes.push(MULTIPLE_ROOTS_MESSAGE);
    }
    notes.extend(converged_notes(air, normal_class));
    outcome(fos, SolveStatus::Converged, iterations, Some(lambda), None).with_warnings(notes)
}
