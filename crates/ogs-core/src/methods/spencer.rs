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

use super::{MethodResult, SolveOptions, SolveStatus};
use crate::model::MethodKind;
use crate::slicer::Slice;

/// Below this magnitude a recurrence pole is treated as zero (`|Φ_i| < 1e-12`).
const POLE_EPS: f64 = 1e-12;

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
pub fn spencer_interslice(slices: &[Slice], fos: f64, lambda: f64) -> Vec<f64> {
    let mut e = Vec::with_capacity(slices.len() + 1);
    e.push(0.0);
    for (k, s) in slices.iter().enumerate() {
        let prev = e[k];
        let d = pole(s, fos, lambda);
        e.push(prev + (fos * driving(s) - resisting(s)) / d);
    }
    e
}

/// One fixed-point step for `F` with `λ` fixed: `F = Σ(R/D) / Σ(T/D)`, evaluated at the current `F`.
fn fos_step(slices: &[Slice], fos: f64, lambda: f64) -> Option<f64> {
    let mut num = 0.0;
    let mut den = 0.0;
    for s in slices {
        let d = pole(s, fos, lambda);
        if d.is_nan() || d.abs() < POLE_EPS {
            return None;
        }
        num += resisting(s) / d;
        den += driving(s) / d;
    }
    let next = num / den;
    next.is_finite().then_some(next)
}

/// Moment update (f = 1): `λ = Σ b (E_i + E_{i−1}) tan α_i / Σ b (E_i + E_{i−1})`.
fn lambda_step(slices: &[Slice], e: &[f64]) -> Option<f64> {
    let mut num = 0.0;
    let mut den = 0.0;
    for (k, s) in slices.iter().enumerate() {
        let sum_e = e[k] + e[k + 1];
        num += s.width * sum_e * s.alpha.tan();
        den += s.width * sum_e;
    }
    if den.is_nan() || den.abs() <= POLE_EPS {
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
/// Stop when `|Δλ| < tol`. Every `F` update counts toward `max_iterations`.
pub(super) fn solve(slices: &[Slice], opts: &SolveOptions) -> MethodResult {
    if slices.is_empty() {
        return outcome(f64::NAN, SolveStatus::Invalid, 0, None, Some("no_slices"));
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
        let mut f_converged = false;
        while iterations < opts.max_iterations {
            let Some(next) = fos_step(slices, fos, lambda) else {
                return outcome(
                    fos,
                    SolveStatus::Invalid,
                    iterations,
                    Some(lambda),
                    Some("pole_vanishing"),
                );
            };
            iterations += 1;
            let delta = (next - fos).abs() / fos.abs();
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
                Some("max_iterations reached"),
            );
        }
        if fos.is_nan() || fos <= 0.0 {
            return outcome(
                fos,
                SolveStatus::Invalid,
                iterations,
                Some(lambda),
                Some("fos_nonpositive"),
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
        if delta_lambda < opts.tolerance {
            return outcome(fos, SolveStatus::Converged, iterations, Some(lambda), None);
        }
    }
}
