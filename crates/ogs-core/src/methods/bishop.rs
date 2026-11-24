//! Simplified Bishop method (§4.2).
//!
//! `F = Σ [(c·b + (W − u·b)·tan φ) / m_α] / Σ W·sin α`, with `m_α = cos α + sin α·tan φ / F`.
//! Fixed-point iteration from `F₀ = 1`, stopped when `|ΔF|/F < tolerance`.
//! `Invalid` if some `m_α < min_m_alpha` (message `"m_alpha"`; air slices are not tested, §4.2 and
//! §4.1.8) or if `Σ W·sin α ≤ 1e-6 · Σ W` (amendment E3, message `"no_driving"`).
//! `NotConverged` when `max_iterations` is exhausted; such a value is never reported as converged.

use super::{MethodResult, SolveOptions, SolveStatus, is_inert, lacks_driving};
use crate::model::MethodKind;
use crate::slicer::Slice;

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

    let mut fos = 1.0_f64;
    let mut iterations = 0usize;
    while iterations < opts.max_iterations {
        let mut numerator = 0.0_f64;
        for s in slices {
            if is_inert(s) {
                continue;
            }
            let (sin, cos) = s.alpha.sin_cos();
            let m_alpha = cos + sin * s.tan_phi / fos;
            if m_alpha.is_nan() || m_alpha < opts.min_m_alpha {
                return MethodResult::new(
                    method,
                    fos,
                    SolveStatus::Invalid,
                    iterations,
                    None,
                    Some("m_alpha"),
                );
            }
            numerator += (s.cohesion * s.width + (s.weight - s.pore_pressure * s.width) * s.tan_phi)
                / m_alpha;
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
            return MethodResult::new(method, fos, SolveStatus::Converged, iterations, None, None);
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
