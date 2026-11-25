//! Spencer method, i.e. Morgenstern-Price with f(x) = 1 (§4.3), following Zhu, Lee, Qian & Chen (2005),
//! *Can. Geotech. J.* 42: 272–278.
//!
//! Sign convention (§4.3 leaves it to the implementer):
//! - Slices run toe → crest, with `alpha > 0` when the base rises toward the crest, so `W·sin α > 0` drives the slide.
//! - `E[k]` is the normal interslice force on the face below slice `k` (`E[0]` toe face, `E[n]` crest face).
//!   `E > 0` is tension (the crest-side neighbour pulls toward the crest), which is the sign the recurrence
//!   `E_i Φ_i = Ψ_{i−1} E_{i−1} Φ_{i−1} + F T_i − R_i` of §4.3 implies. F and λ are invariant under `E → −E`.
//! - Interslice shear is `X = λ f E`, same sign as E. Summing the per-slice moments about the base midpoints
//!   gives `Σ b (E_i + E_{i−1}) tan α_i = λ Σ b f (E_i + E_{i−1})`, which is the λ update.
//! - With f = 1 the products Ψ telescope (`Ψ_{i−1} = D_i / D_{i−1}`), so `E_i = E_{i−1} + (F T_i − R_i) / D_i`
//!   with `D_i = (sin α_i − λ cos α_i) tan φ_i + (cos α_i + λ sin α_i) F`. `E_n = 0` gives
//!   `F = Σ(R_i / D_i) / Σ(T_i / D_i)`. Each slice also satisfies its base equilibrium (checked in tests).
//! - Effective normal force (E4e, E7d): `N' = W cos α − U + (sin α − λ cos α)·ΔE`, with `ΔE = E_{i+1} − E_i`
//!   (the direct form, free of m_α), and `N' = (W − ΔX − u·b − c·l·sin α / F) / m_α` with `ΔX = λ ΔE` (E4e,
//!   used by tests as the cross-check). They agree on slices without a pole.
//!
//! Air slices (E2) have no weight and no strength. Their normal force passes through unchanged
//! (`E_{i+1} = E_i`). Amendment E7a restores them in the λ sums with their own α (E4c is derogated): they are
//! massless bodies that transmit `E` and `X = λE`, which keeps the global moment balance (review R2-01).
//! A run of air slices between two soil slices that carries `|E| > 1e-3·ΣW` adds the warning `air_gap_thrust`.
//!
//! Solver (E7c, review R2-03): the F loop with λ fixed uses the closed form with the safeguard of bisection in
//! `[F_adm(λ)·(1+1e-6), 1e3]`. A λ step that leaves the admissible region is halved, up to 12 times, before the
//! solver aborts with `Invalid("pole")`.
//!
//! Admissibility (E4b, E4d): the solution is `Converged` only if, with the final λ, the F equation still holds to
//! `tolerance` (E4d), and every soil slice has `Φ_i / F ≥ min_m_alpha` (E4b). `NotConverged` when the budget
//! is exhausted.

use super::{
    MethodResult, SolveOptions, SolveStatus, air_gap_thrust, bishop, is_inert, lacks_driving,
    negative_normal_message, pick_warning,
};
use crate::model::MethodKind;
use crate::slicer::Slice;

/// Relative pole threshold (E4b): a soil slice with `Φ_i ≤ 1e-9 · F` is a pole.
const POLE_FRACTION: f64 = 1e-9;

/// Below this magnitude the moment denominator `Σ b (E_i + E_{i−1})` is treated as zero.
const LAMBDA_DENOM_EPS: f64 = 1e-12;

/// Upper end of the F search interval (E7c, as in Bishop E7b).
const FOS_MAX: f64 = 1e3;
/// Relative margin above `F_adm(λ)` (E7c).
const ADM_MARGIN: f64 = 1e-6;
/// Lower end of the search interval when no slice bounds F from below.
const FOS_FLOOR: f64 = 1e-9;
/// Halvings of a λ step before the solver aborts with `pole` (E7c).
const MAX_LAMBDA_HALVINGS: usize = 12;

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
/// `E[k+1] = E[k] + (F·T_k − R_k) / D_k`. At convergence `E[n] ≈ 0`. Values are non-finite if a pole vanishes.
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

/// Moment update (f = 1): `λ = Σ b (E_i + E_{i−1}) tan α_i / Σ b (E_i + E_{i−1})`.
/// Air slices take part with their own α (E7a).
fn lambda_step(slices: &[Slice], e: &[f64]) -> Option<f64> {
    let mut num = 0.0;
    let mut den = 0.0;
    for (k, s) in slices.iter().enumerate() {
        let sum_e = e[k] + e[k + 1];
        num += s.width * sum_e * s.alpha.tan();
        den += s.width * sum_e;
    }
    if den.is_nan() || den.abs() <= LAMBDA_DENOM_EPS {
        return None;
    }
    let lambda = num / den;
    lambda.is_finite().then_some(lambda)
}

/// Lower bound of the admissible F for a fixed λ (E7c). The condition `Φ_i/F ≥ min` reads
/// `p_i + (a_i − min)·F ≥ 0`, with `p_i = (sin α − λ cos α) tan φ` and `a_i = cos α + λ sin α`.
/// For `a_i > min` it gives `F ≥ −p_i/(a_i − min)`; the bound is the largest of these (0 if none).
fn lower_bound(slices: &[Slice], lambda: f64, min_m: f64) -> f64 {
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

/// E4b admissibility of `F` at `λ`: `Φ_i / F ≥ min_m_alpha` on every soil slice. NaN fails.
fn admissible_at(slices: &[Slice], fos: f64, lambda: f64, min_m: f64) -> bool {
    fos > 0.0
        && slices
            .iter()
            .filter(|s| !is_inert(s))
            .all(|s| pole(s, fos, lambda) / fos >= min_m)
}

/// Closed-form right-hand side `F = Σ(R/D)/Σ(T/D)` with λ fixed, over the soil slices.
/// `None` at a pole (`Φ ≤ 1e-9·F` or NaN) or when the result is not finite.
fn closed_form(slices: &[Slice], fos: f64, lambda: f64) -> Option<f64> {
    let mut num = 0.0;
    let mut den = 0.0;
    for s in slices.iter().filter(|s| !is_inert(s)) {
        let d = pole(s, fos, lambda);
        // NaN is caught explicitly.
        if d.is_nan() || d <= POLE_FRACTION * fos {
            return None;
        }
        num += resisting(s) / d;
        den += driving(s) / d;
    }
    let next = num / den;
    next.is_finite().then_some(next)
}

/// Solves `F` for a fixed `λ` (E7c). Fixed-point iterations on the closed form; when an iterate leaves the
/// admissible region, bisection of `h(F) = F − g(F)` in `[F_adm(λ)·(1+1e-6), 1e3]`. Every evaluation counts
/// toward `max_iterations`.
///
/// Errors: `"pole"` (no admissible root in the interval), `"m_alpha"` (the root is not admissible),
/// `"max_iterations"` (budget exhausted).
fn solve_fos(
    slices: &[Slice],
    start: f64,
    lambda: f64,
    opts: &SolveOptions,
    iterations: &mut usize,
) -> Result<f64, &'static str> {
    let min_m = opts.min_m_alpha;
    let bound = lower_bound(slices, lambda, min_m);
    let lo = if bound > 0.0 {
        bound * (1.0 + ADM_MARGIN)
    } else {
        FOS_FLOOR
    };
    let inside = |f: f64| f.is_finite() && f >= lo && f <= FOS_MAX;

    // Fixed-point phase. Any iterate that leaves the admissible region hands over to the bisection.
    let mut fos = start;
    while inside(fos) && *iterations < opts.max_iterations {
        let Some(next) = closed_form(slices, fos, lambda) else {
            break;
        };
        *iterations += 1;
        if !(next > 0.0 && inside(next) && admissible_at(slices, next, lambda, min_m)) {
            break;
        }
        let delta = (next - fos).abs() / fos;
        fos = next;
        if delta < opts.tolerance {
            return Ok(fos);
        }
    }

    // Safeguard (E7c): bisection in the admissible interval.
    let h = |f: f64| closed_form(slices, f, lambda).map(|g| f - g);
    let (mut a, mut b) = (lo, FOS_MAX);
    let (Some(mut ha), Some(hb)) = (h(a), h(b)) else {
        return Err("pole");
    };
    if ha * hb > 0.0 {
        return Err("pole");
    }
    loop {
        if *iterations >= opts.max_iterations {
            return Err("max_iterations");
        }
        let mid = 0.5 * (a + b);
        *iterations += 1;
        match h(mid) {
            // A pole above the admissible range (an α > 0 slice with a_i < min) is treated as too large.
            None => b = mid,
            Some(hm) => {
                if hm * ha > 0.0 {
                    a = mid;
                    ha = hm;
                } else {
                    b = mid;
                }
            }
        }
        if (b - a) <= opts.tolerance * 0.5 * (a + b) {
            break;
        }
    }
    let root = 0.5 * (a + b);
    if admissible_at(slices, root, lambda, min_m) {
        Ok(root)
    } else {
        Err("m_alpha")
    }
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

/// Spencer solver. Start: `F` from Bishop (or 1 if Bishop is invalid), `λ = 0`.
///
/// Outer loop: solve `F` for the current `λ` (E7c), then recompute `E`, then the λ update. The update is
/// applied with halvings (up to 12) when the new λ produces a pole or an inadmissible F. The loop ends when
/// the full step is below `tol` (E4d: `F` was solved for the final λ). Finally every soil slice must have
/// `Φ_i / F ≥ min_m_alpha` (E4b).
pub(super) fn solve(slices: &[Slice], opts: &SolveOptions) -> MethodResult {
    if slices.is_empty() {
        return outcome(f64::NAN, SolveStatus::Invalid, 0, None, Some("no_slices"));
    }
    // Amendment E3: a surface without driving moment is invalid for Spencer too.
    if lacks_driving(slices) {
        return outcome(f64::NAN, SolveStatus::Invalid, 0, None, Some("no_driving"));
    }
    let start = bishop::solve(slices, opts);
    let mut fos =
        if start.status != SolveStatus::Invalid && start.fos.is_finite() && start.fos > 0.0 {
            start.fos
        } else {
            1.0
        };
    let mut lambda = 0.0_f64;
    let mut iterations = 0usize;

    // The F of λ = 0 is the first state of the chain.
    let failed = |msg: &'static str, iterations: usize, lambda: f64| {
        let status = if msg == "max_iterations" {
            SolveStatus::NotConverged
        } else {
            SolveStatus::Invalid
        };
        outcome(f64::NAN, status, iterations, Some(lambda), Some(msg))
    };
    match solve_fos(slices, fos, lambda, opts, &mut iterations) {
        Ok(value) => fos = value,
        Err(msg) => return failed(msg, iterations, lambda),
    }

    loop {
        if iterations >= opts.max_iterations {
            return outcome(
                fos,
                SolveStatus::NotConverged,
                iterations,
                Some(lambda),
                Some("max_iterations"),
            );
        }
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
        let Some(lambda_next) = lambda_step(slices, &e) else {
            return outcome(
                fos,
                SolveStatus::Invalid,
                iterations,
                Some(lambda),
                Some("lambda_undefined"),
            );
        };
        let delta = lambda_next - lambda;

        // E7c: the full step first, then up to 12 halvings. A step whose F has a pole or is inadmissible is damped.
        let mut accepted: Option<(f64, f64, bool)> = None;
        let mut factor = 1.0_f64;
        for attempt in 0..=MAX_LAMBDA_HALVINGS {
            let lambda_try = lambda + factor * delta;
            match solve_fos(slices, fos, lambda_try, opts, &mut iterations) {
                Ok(value) => {
                    accepted = Some((value, lambda_try, attempt == 0));
                    break;
                }
                Err("max_iterations") => {
                    return outcome(
                        fos,
                        SolveStatus::NotConverged,
                        iterations,
                        Some(lambda),
                        Some("max_iterations"),
                    );
                }
                Err(_) => factor *= 0.5,
            }
        }
        let Some((fos_new, lambda_new, full_step)) = accepted else {
            return outcome(
                fos,
                SolveStatus::Invalid,
                iterations,
                Some(lambda),
                Some("pole"),
            );
        };
        fos = fos_new;
        lambda = lambda_new;
        // E4d: F was solved for the final λ. The λ update is converged when the full step is below tol.
        if full_step && delta.abs() < opts.tolerance {
            break;
        }
    }

    // Converged: the final E at (F, λ) gives the admissibility test (E4b) and the normal forces (E4e, E7d).
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
    if !admissible_at(slices, fos, lambda, opts.min_m_alpha) {
        return outcome(
            fos,
            SolveStatus::Invalid,
            iterations,
            Some(lambda),
            Some("m_alpha"),
        );
    }
    let normals = spencer_direct_normals(slices, lambda, &e);
    let normal_class = negative_normal_message(slices, |k, _| normals[k]);
    let air = air_gap_thrust(slices, &e);
    outcome(
        fos,
        SolveStatus::Converged,
        iterations,
        Some(lambda),
        pick_warning(air, normal_class),
    )
}
