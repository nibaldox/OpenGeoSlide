//! Simplified Bishop method (§4.2).
//!
//! `F = Σ [(c·b + (W − u·b)·tan φ) / m_α] / Σ W·sin α`, with `m_α = cos α + sin α·tan φ / F`.
//!
//! Admissible interval (amendment E7b, review R2-02). For each soil slice with `α < 0`,
//! `m_α(F) ≥ min_m_alpha` holds iff `F ≥ F_adm,i = (−sin α · tan φ) / (cos α − min_m_alpha)`. With
//! `F_adm = max_i F_adm,i` (0 if there is no such slice) the root is sought only in `[F_adm·(1+1e-6), 1e3]`.
//! A slice with `cos α ≤ min_m_alpha` and `tan φ > 0` makes the surface `Invalid("m_alpha")`.
//!
//! Start (E7b): `F₀ = max(F_ord, 1.05·F_adm, 0.1)`, where `F_ord` is Fellenius' value (E4a), or 1 when that
//! value is not finite or not positive. The fixed-point iteration runs at most `max_iterations / 2` steps
//! inside the interval. If an iterate leaves the interval, or the iteration does not converge in that budget,
//! the root of `h(F) = F − g(F)` is bracketed in the interval and bisected. No sign change means no root:
//! `Invalid("m_alpha")`. A pole (`m_α ≤ 1e-9`) is never an abort; it is an iterate outside the interval.
//!
//! The converged F is checked against `m_α ≥ min_m_alpha` (E4a): otherwise `Invalid("m_alpha")`.
//! `Invalid` also if `Σ W·sin α ≤ 1e-6 · Σ W` (amendment E3, message `"no_driving"`). `NotConverged` when the
//! budget is exhausted; such a value is never reported as converged. Air slices (E2) are not tested.
//! A converged result whose effective normal forces are negative keeps its status and carries the class
//! message of E4e and E7d.

use super::{
    M_ALPHA_POLE, MethodResult, SolveOptions, SolveStatus, effective_normal, is_inert,
    lacks_driving, m_alpha, negative_normal_message,
};
use crate::model::MethodKind;
use crate::slicer::Slice;

/// Upper end of the root search interval (E7b).
const FOS_MAX: f64 = 1e3;
/// Relative margin above `F_adm` (E7b).
const ADM_MARGIN: f64 = 1e-6;
/// Lower end of the search interval when no slice bounds F from below.
const FOS_FLOOR: f64 = 1e-9;

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

/// Lower bound `F_adm = max_i (−sin α·tan φ)/(cos α − min_m_alpha)` over the soil slices with `α < 0` (E7b).
/// `None` when a slice with `α < 0`, `cos α ≤ min_m_alpha` and `tan φ > 0` makes every F inadmissible.
fn lower_bound(slices: &[Slice], min_m: f64) -> Option<f64> {
    let mut bound = 0.0_f64;
    for s in slices.iter().filter(|s| !is_inert(s) && s.alpha < 0.0) {
        let (sin, cos) = s.alpha.sin_cos();
        if cos <= min_m {
            if s.tan_phi > 0.0 {
                return None;
            }
            // tan φ = 0: m_α = cos α for every F. The final check rejects the surface.
            continue;
        }
        bound = bound.max(-sin * s.tan_phi / (cos - min_m));
    }
    Some(bound)
}

/// Right-hand side `g(F) = Σ(c·b + (W − u·b)·tan φ)/m_α / Σ W·sin α`. `None` at a pole (`m_α ≤ 1e-9` or NaN).
fn rhs(slices: &[Slice], driving: f64, fos: f64) -> Option<f64> {
    let mut numerator = 0.0_f64;
    for s in slices.iter().filter(|s| !is_inert(s)) {
        let m = m_alpha(s, fos);
        if m.is_nan() || m <= M_ALPHA_POLE {
            return None;
        }
        numerator +=
            (s.cohesion * s.width + (s.weight - s.pore_pressure * s.width) * s.tan_phi) / m;
    }
    Some(numerator / driving)
}

/// E4a admissibility of a converged F: `m_α(F) ≥ min_m_alpha` on every soil slice. NaN fails.
fn admissible(slices: &[Slice], fos: f64, min_m: f64) -> bool {
    slices
        .iter()
        .filter(|s| !is_inert(s))
        .all(|s| m_alpha(s, fos) >= min_m)
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
    let min_m = opts.min_m_alpha;
    let invalid_m = |fos: f64, iterations: usize| {
        MethodResult::new(
            method,
            fos,
            SolveStatus::Invalid,
            iterations,
            None,
            Some("m_alpha"),
        )
    };

    let Some(f_adm) = lower_bound(slices, min_m) else {
        return invalid_m(f64::NAN, 0);
    };
    let lo = if f_adm > 0.0 {
        f_adm * (1.0 + ADM_MARGIN)
    } else {
        FOS_FLOOR
    };
    let inside = |f: f64| f.is_finite() && f >= lo && f <= FOS_MAX;

    // Fixed-point phase (E7b): F₀ = max(F_ord, 1.05·F_adm, 0.1), budget max_iterations / 2.
    let mut iterations = 0usize;
    let mut fos = start_fos(slices).max(1.05 * f_adm);
    let mut root: Option<f64> = None;
    while inside(fos) && iterations < opts.max_iterations / 2 {
        let Some(next) = rhs(slices, driving, fos) else {
            break;
        };
        iterations += 1;
        if !inside(next) {
            break;
        }
        let delta = (next - fos).abs() / fos;
        fos = next;
        if delta < opts.tolerance {
            root = Some(fos);
            break;
        }
    }

    // Safeguard (E7b): bisection of h(F) = F − g(F) in the admissible interval.
    let root = match root {
        Some(r) => r,
        None => {
            let h = |f: f64| rhs(slices, driving, f).map(|g| f - g);
            let (mut a, mut b) = (lo, FOS_MAX);
            let (Some(mut ha), Some(hb)) = (h(a), h(b)) else {
                return invalid_m(f64::NAN, iterations);
            };
            if ha * hb > 0.0 {
                // No sign change in the interval: no root that satisfies m_α ≥ min_m_alpha.
                return invalid_m(f64::NAN, iterations);
            }
            loop {
                if iterations >= opts.max_iterations {
                    return MethodResult::new(
                        method,
                        0.5 * (a + b),
                        SolveStatus::NotConverged,
                        iterations,
                        None,
                        Some("max_iterations"),
                    );
                }
                let mid = 0.5 * (a + b);
                iterations += 1;
                match h(mid) {
                    // A pole above the admissible range (an α > 0 slice with cos α ≤ min) is treated as too large.
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
            0.5 * (a + b)
        }
    };

    // E4a: the m_α limit applies to the converged F.
    if !admissible(slices, root, min_m) {
        return invalid_m(root, iterations);
    }
    // E4e: Bishop has ΔX = 0.
    let warning = negative_normal_message(slices, |_, s| effective_normal(s, root, 0.0));
    MethodResult::new(
        method,
        root,
        SolveStatus::Converged,
        iterations,
        None,
        warning,
    )
}
