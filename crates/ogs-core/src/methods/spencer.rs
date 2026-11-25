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
//! - Air slices (E2, no weight and no strength) take no part in the F sums nor in the λ sums (E4c); the normal
//!   force passes through them unchanged (`E_{i+1} = E_i`).
//! - With f = 1 the products Ψ telescope (`Ψ_{i−1} = D_i / D_{i−1}`), so `E_i = E_{i−1} + (F T_i − R_i) / D_i`
//!   with `D_i = (sin α_i − λ cos α_i) tan φ_i + (cos α_i + λ sin α_i) F`. `E_n = 0` gives
//!   `F = Σ(R_i / D_i) / Σ(T_i / D_i)`. Each slice also satisfies its base equilibrium (checked in tests).
//! - Effective normal force (E4e): `N' = (W − ΔX − u·b − c·l·sin α / F) / m_α` with `ΔX = λ (E_{i+1} − E_i)`,
//!   the net interslice shear `X_right − X_left` in the sign of E.
//!
//! Admissibility (E4b, E4c, E4d): the solution is `Converged` only if, with the final λ, the F equation still
//! holds to `tolerance` (E4d), and every soil slice has `Φ_i / F ≥ min_m_alpha` (E4b). A pole (`Φ_i ≤ 1e-9·F`)
//! or a non-positive iterate of F during the iterations is `Invalid`.

use super::{
    MethodResult, NEGATIVE_NORMAL_MESSAGE, SolveOptions, SolveStatus, effective_normal,
    has_negative_normal, is_inert, lacks_driving,
};
use crate::model::MethodKind;
use crate::slicer::Slice;

/// Relative pole threshold (E4b): a soil slice with `Φ_i ≤ 1e-9 · F` during the iterations is a pole.
const POLE_FRACTION: f64 = 1e-9;

/// Below this magnitude the moment denominator `Σ b (E_i + E_{i−1})` is treated as zero.
const LAMBDA_DENOM_EPS: f64 = 1e-12;

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

/// Effective normal forces `N'` of all slices (E4e) at `(F, λ)`, with `ΔX_k = λ (E_{k+1} − E_k)`.
///
/// With `λ = 0` the interslice shear vanishes and the values are exactly Bishop's `N'` (§4.2).
/// Air slices get the value of the formula too (their weight, cohesion and pore pressure are zero).
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
            effective_normal(s, fos, delta_x)
        })
        .collect()
}

/// One fixed-point step for `F` with `λ` fixed: `F = Σ(R/D) / Σ(T/D)`, evaluated at the current `F`.
/// Air slices contribute nothing and are skipped, so their pole cannot invalidate the step.
///
/// Errors with the message of the failure: `"pole"` for a soil pole (`Φ ≤ 1e-9·F`) or a non-positive iterate,
/// `"non_finite"` for a NaN or infinite iterate.
fn fos_step(slices: &[Slice], fos: f64, lambda: f64) -> Result<f64, &'static str> {
    let mut num = 0.0;
    let mut den = 0.0;
    for s in slices.iter().filter(|s| !is_inert(s)) {
        let d = pole(s, fos, lambda);
        // NaN is caught explicitly.
        if d.is_nan() || d <= POLE_FRACTION * fos {
            return Err("pole");
        }
        num += resisting(s) / d;
        den += driving(s) / d;
    }
    let next = num / den;
    if !next.is_finite() {
        return Err("non_finite");
    }
    if next <= 0.0 {
        return Err("pole");
    }
    Ok(next)
}

/// Moment update (f = 1): `λ = Σ b (E_i + E_{i−1}) tan α_i / Σ b (E_i + E_{i−1})`.
/// Air slices (E4c) are excluded from both sums.
fn lambda_step(slices: &[Slice], e: &[f64]) -> Option<f64> {
    let mut num = 0.0;
    let mut den = 0.0;
    for (k, s) in slices.iter().enumerate().filter(|(_, s)| !is_inert(s)) {
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
/// Outer loop: iterate `F` with `λ` fixed until `|ΔF|/F < tol`; then recompute `E`, then `λ`.
/// When `|Δλ| < tol`, recompute `F` with the final `λ` (E4d): the result is `Converged` only if that value
/// agrees with `F` to `tol`; otherwise the loop continues. Every `F` evaluation counts toward `max_iterations`.
/// Finally every soil slice must have `Φ_i / F ≥ min_m_alpha` (E4b).
pub(super) fn solve(slices: &[Slice], opts: &SolveOptions) -> MethodResult {
    if slices.is_empty() {
        return outcome(f64::NAN, SolveStatus::Invalid, 0, None, Some("no_slices"));
    }
    // Amendment E3: a surface without driving moment is invalid for Spencer too.
    if lacks_driving(slices) {
        return outcome(f64::NAN, SolveStatus::Invalid, 0, None, Some("no_driving"));
    }
    let start = super::bishop::solve(slices, opts);
    let mut fos =
        if start.status != SolveStatus::Invalid && start.fos.is_finite() && start.fos > 0.0 {
            start.fos
        } else {
            1.0
        };
    let mut lambda = 0.0_f64;
    let mut iterations = 0usize;

    loop {
        // Inner loop: F with λ fixed.
        let mut f_converged = false;
        while iterations < opts.max_iterations {
            let next = match fos_step(slices, fos, lambda) {
                Ok(value) => value,
                Err(message) => {
                    return outcome(
                        fos,
                        SolveStatus::Invalid,
                        iterations,
                        Some(lambda),
                        Some(message),
                    );
                }
            };
            iterations += 1;
            let delta = (next - fos).abs() / fos;
            fos = next;
            if delta < opts.tolerance {
                f_converged = true;
                break;
            }
        }
        if !f_converged {
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
        let delta_lambda = (lambda_next - lambda).abs();
        lambda = lambda_next;
        if delta_lambda >= opts.tolerance {
            continue;
        }

        // E4d: F must be consistent with the final λ before the result is declared converged.
        if iterations >= opts.max_iterations {
            return outcome(
                fos,
                SolveStatus::NotConverged,
                iterations,
                Some(lambda),
                Some("max_iterations"),
            );
        }
        let check = match fos_step(slices, fos, lambda) {
            Ok(value) => value,
            Err(message) => {
                return outcome(
                    fos,
                    SolveStatus::Invalid,
                    iterations,
                    Some(lambda),
                    Some(message),
                );
            }
        };
        iterations += 1;
        let consistency = (check - fos).abs() / fos;
        fos = check;
        if consistency < opts.tolerance {
            break;
        }
    }

    // Converged: the final E at (F, λ) gives the admissibility test (E4b) and the normal forces (E4e).
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
    // NaN fails the comparison and is rejected.
    let admissible = slices
        .iter()
        .filter(|s| !is_inert(s))
        .all(|s| pole(s, fos, lambda) / fos >= opts.min_m_alpha);
    if !admissible {
        return outcome(
            fos,
            SolveStatus::Invalid,
            iterations,
            Some(lambda),
            Some("m_alpha"),
        );
    }
    let warning = has_negative_normal(slices, |k, s| {
        effective_normal(s, fos, lambda * (e[k + 1] - e[k]))
    })
    .then_some(NEGATIVE_NORMAL_MESSAGE);
    outcome(
        fos,
        SolveStatus::Converged,
        iterations,
        Some(lambda),
        warning,
    )
}
