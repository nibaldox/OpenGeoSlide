//! Simplified Bishop method (§4.2).
//!
//! `F = Σ [(c·b + (W − u·b)·tan φ) / m_α] / Σ W·sin α`, with `m_α = cos α + sin α·tan φ / F`.
//! Fixed-point iteration (amendment E4a). The start is `F₀ = max(F_Fellenius, 0.1)`, or 1 when the Fellenius
//! value is not finite or not positive. During the iterations only a pole (`m_α ≤ 1e-9` in a soil slice)
//! aborts, with `Invalid` and message `"m_alpha_pole"`. The iteration stops when `|ΔF|/F < tolerance`.
//! `m_α ≥ min_m_alpha` is then checked on the converged F: otherwise `Invalid` with message `"m_alpha"`.
//! A converged result whose effective normal force is negative keeps its status and carries the message
//! `"negative_effective_normal"` (E4e). Air slices (E2) are not tested.
//! `Invalid` also if `Σ W·sin α ≤ 1e-6 · Σ W` (amendment E3, message `"no_driving"`).
//! `NotConverged` when `max_iterations` is exhausted; such a value is never reported as converged.

use super::{
    M_ALPHA_POLE, MethodResult, NEGATIVE_NORMAL_MESSAGE, SolveOptions, SolveStatus,
    effective_normal, has_negative_normal, is_inert, lacks_driving, m_alpha,
};
use crate::model::MethodKind;
use crate::slicer::Slice;

/// Starting factor of safety (E4a): Fellenius' ordinary method over the soil slices, floored at 0.1.
/// Falls back to 1 when the Fellenius value is not finite or not positive.
pub(crate) fn start_fos(slices: &[Slice]) -> f64 {
    let mut num = 0.0_f64;
    let mut den = 0.0_f64;
    for s in slices.iter().filter(|s| !is_inert(s)) {
        let (sin, cos) = s.alpha.sin_cos();
        num += s.cohesion * s.base_length
            + (s.weight * cos - s.pore_pressure * s.base_length) * s.tan_phi;
        den += s.weight * sin;
    }
    let fellenius = num / den;
    if fellenius.is_finite() && fellenius > 0.0 {
        fellenius.max(0.1)
    } else {
        1.0
    }
}

pub(super) fn solve(slices: &[Slice], opts: &SolveOptions) -> MethodResult {
    let method = MethodKind::Bishop;
    if lacks_driving(slices) {
        return MethodResult::new(
            method,
            f64::NAN,
            SolveStatus::Invalid,
            0,
            None,
            Some("no_driving"),
        );
    }
    let driving: f64 = slices.iter().map(|s| s.weight * s.alpha.sin()).sum();

    let mut fos = start_fos(slices);
    let mut iterations = 0usize;
    while iterations < opts.max_iterations {
        let mut numerator = 0.0_f64;
        for s in slices.iter().filter(|s| !is_inert(s)) {
            let m = m_alpha(s, fos);
            // E4a: during the iterations only a pole aborts. The NaN test is explicit.
            if m.is_nan() || m <= M_ALPHA_POLE {
                return MethodResult::new(
                    method,
                    fos,
                    SolveStatus::Invalid,
                    iterations,
                    None,
                    Some("m_alpha_pole"),
                );
            }
            numerator +=
                (s.cohesion * s.width + (s.weight - s.pore_pressure * s.width) * s.tan_phi) / m;
        }
        let next = numerator / driving;
        iterations += 1;
        if !next.is_finite() {
            return MethodResult::new(
                method,
                next,
                SolveStatus::Invalid,
                iterations,
                None,
                Some("non_finite"),
            );
        }
        if next <= 0.0 {
            return MethodResult::new(
                method,
                next,
                SolveStatus::Invalid,
                iterations,
                None,
                Some("fos_nonpositive"),
            );
        }
        let delta = (next - fos).abs() / fos;
        fos = next;
        if delta < opts.tolerance {
            // E4a: the m_α limit applies to the converged F. NaN fails the comparison and is rejected.
            let admissible = slices
                .iter()
                .filter(|s| !is_inert(s))
                .all(|s| m_alpha(s, fos) >= opts.min_m_alpha);
            if !admissible {
                return MethodResult::new(
                    method,
                    fos,
                    SolveStatus::Invalid,
                    iterations,
                    None,
                    Some("m_alpha"),
                );
            }
            // E4e: Bishop has ΔX = 0.
            let warning = has_negative_normal(slices, |_, s| effective_normal(s, fos, 0.0))
                .then_some(NEGATIVE_NORMAL_MESSAGE);
            return MethodResult::new(
                method,
                fos,
                SolveStatus::Converged,
                iterations,
                None,
                warning,
            );
        }
    }
    MethodResult::new(
        method,
        fos,
        SolveStatus::NotConverged,
        iterations,
        None,
        Some("max_iterations reached"),
    )
}
