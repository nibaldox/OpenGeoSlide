//! Simplified Bishop method (§4.2).
//!
//! `F = Σ [(c·b + (W* − u·b)·tan φ) / m_α] / Σ [W*·sin α + M]`, with `m_α = cos α + sin α·tan φ / F`.
//!
//! `W* = W·(1 + kv) + Q + V` is the vertical force of the slice and `M = [kh·W·(yc − ȳ) + H^P·(yc − y_g)] / R` the
//! moment of the horizontal forces about the circle centre, divided by the radius (amendment E12b, see
//! `Slice::weight_extra` and `Slice::driving_extra`). The horizontal force does not enter the normal force: it appears
//! only in the moment. Without seismic force or loads `W* = W` and `M = 0`, which is the §4.2 form.
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
//! Passive reinforcement forces (E14g, F4.7). A passive force is divided by `F`: `W*(F) = W* + passive_v/F` in the normal
//! force and in the numerator, and `Σ [W*(F)·sin α + M(F)]` in the denominator, with `M(F) = driving_extra +
//! passive_driving_extra/F`. With them the iteration is `F = N(F)/D(F)`; the Brent safeguard works on the divisor-free
//! `h(F) = F·D(F) − N(F)` (`D(F)` can vanish below the root, `F·D(F) = F·D₀ + P_d` is linear). **Without passive forces
//! this module runs the code that it ran before, bit for bit.** The guards (`m_α`, E3, the negative normal forces) are
//! evaluated at the converged F with the passive forces included.
//!
//! The converged F is checked against `m_α ≥ min_m_alpha` (E4a): otherwise `Invalid("m_alpha")`.
//! `Invalid` also if `Σ [W*·sin α + M] ≤ 1e-6 · Σ W` (amendments E3 and E12b, message `"no_driving"`). `NotConverged` when the
//! budget is exhausted; such a value is never reported as converged. Air slices (E2) are not tested.
//! A converged result whose effective normal forces are negative keeps its status and carries the class
//! message of E4e and E7d.

use super::{
    M_ALPHA_POLE, MethodResult, SolveOptions, SolveStatus, any_passive, at_fos, effective_normal,
    is_inert, lacks_driving, lift_bound, m_alpha, negative_normal_message,
};
use crate::model::MethodKind;
use crate::slicer::Slice;

/// Reason of the `Invalid` state of Bishop on a non-circular surface (E13f).
const NON_CIRCULAR_MESSAGE: &str = "bishop_non_circular";
/// Upper end of the root search interval (E7b).
const FOS_MAX: f64 = 1e3;
/// Relative margin above `F_adm` (E7b).
const ADM_MARGIN: f64 = 1e-6;
/// Lower end of the search interval when no slice bounds F from below.
const FOS_FLOOR: f64 = 1e-9;
/// Lower end of the bracketing grid with passive forces when no slice bounds F from below (E14o-2).
const GRID_FLOOR: f64 = 1e-3;
/// Intervals of the geometric grid of the bracketing with passive forces (E14o-2): 600 steps over `[1e-3, 1e3]` are a
/// ratio of 1.023 between two neighbouring values of F.
const GRID_STEPS: usize = 600;

/// Starting factor of safety (E4a): Fellenius' ordinary method over the soil slices, floored at 0.1.
/// Falls back to 1 when the Fellenius value is not finite or not positive.
pub(crate) fn start_fos(slices: &[Slice]) -> f64 {
    let mut num = 0.0_f64;
    let mut den = 0.0_f64;
    for s in slices.iter().filter(|s| !is_inert(s)) {
        let (sin, cos) = s.alpha.sin_cos();
        let w = s.total_weight();
        num += s.cohesion * s.base_length + (w * cos - s.pore_pressure * s.base_length) * s.tan_phi;
        den += w * sin + s.driving_extra;
    }
    let fellenius = num / den;
    if fellenius.is_finite() && fellenius > 0.0 {
        fellenius.max(0.1)
    } else {
        1.0
    }
}

/// Starting factor of safety with passive reinforcement forces (E14o-2): Fellenius' value of [`start_fos`] again, with the
/// passive forces of the slices divided by that first value (`W*(F) = W* + passive_v/F`, `M(F) = M + passive_driving_extra/F`
/// in the numerator and the driving term). The result of a force that lifts the mass is a start that sees it, as the form
/// without poles of cSlope does. When it is not finite or not positive, the value without passive forces stays.
pub(super) fn start_fos_passive(slices: &[Slice]) -> f64 {
    let f_ord = start_fos(slices);
    let (mut num, mut den) = (0.0_f64, 0.0_f64);
    for s in slices.iter().filter(|s| !is_inert(s)) {
        let at = at_fos(s, f_ord);
        let (sin, cos) = at.alpha.sin_cos();
        let w = at.total_weight();
        num += at.cohesion * at.base_length
            + (w * cos - at.pore_pressure * at.base_length) * at.tan_phi;
        den += w * sin + at.driving_extra;
    }
    let f = num / den;
    if f.is_finite() && f > 0.0 {
        f.max(0.1)
    } else {
        f_ord
    }
}

/// Bracket of a root of `h` for the bisection with passive forces (E14o-2): a pair `(a, b, h(a))` of neighbouring points of
/// the geometric grid over `[lo, FOS_MAX]` where `h` changes sign, the one nearest to `start` in `ln F`. Points where `h`
/// is not defined (a pole of `m_α`) split the grid: a sign change is only taken between two defined neighbours.
fn bracket_on_grid(
    h: &impl Fn(f64) -> Option<f64>,
    lo: f64,
    start: f64,
) -> Option<(f64, f64, f64)> {
    let ratio = (FOS_MAX / lo).powf(1.0 / GRID_STEPS as f64);
    let mut best: Option<((f64, f64, f64), f64)> = None;
    let mut previous: Option<(f64, f64)> = None;
    for k in 0..=GRID_STEPS {
        let f = if k == GRID_STEPS {
            FOS_MAX
        } else {
            lo * ratio.powi(k as i32)
        };
        let Some(value) = h(f) else {
            previous = None;
            continue;
        };
        if let Some((fp, hp)) = previous
            && (hp * value <= 0.0)
        {
            let distance = (0.5 * (fp.ln() + f.ln()) - start.ln()).abs();
            if best.as_ref().is_none_or(|(_, d)| distance < *d) {
                best = Some(((fp, f, hp), distance));
            }
        }
        previous = Some((f, value));
    }
    best.map(|(bracket, _)| bracket)
}

/// Lower bound `F_adm = max_i (−sin α·tan φ)/(cos α − min_m_alpha)` over the soil slices with `α < 0` (E7b).
/// Shared with Spencer (E8b). `None` when a slice with `α < 0`, `cos α ≤ min_m_alpha` and `tan φ > 0` makes
/// every F inadmissible.
pub(super) fn lower_bound(slices: &[Slice], min_m: f64) -> Option<f64> {
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

/// Right-hand side `g(F) = Σ(c·b + (W* − u·b)·tan φ)/m_α / Σ [W*·sin α + M]`. `None` at a pole (`m_α ≤ 1e-9` or NaN).
fn rhs(slices: &[Slice], driving: f64, fos: f64) -> Option<f64> {
    let mut numerator = 0.0_f64;
    for s in slices.iter().filter(|s| !is_inert(s)) {
        let m = m_alpha(s, fos);
        if m.is_nan() || m <= M_ALPHA_POLE {
            return None;
        }
        numerator +=
            (s.cohesion * s.width + (s.total_weight() - s.pore_pressure * s.width) * s.tan_phi) / m;
    }
    Some(numerator / driving)
}

/// `(N(F), D(F))` of Bishop's iteration `F = N/D` with the passive reinforcement forces divided by `F` (E14g): the
/// numerator `Σ (c·b + (W*(F) − u·b)·tan φ)/m_α` and the driving term `Σ [W*(F)·sin α + M(F)]`, over all the slices as
/// the denominator of [`solve`]. `None` at a pole (`m_α ≤ 1e-9` or NaN).
fn terms_passive(slices: &[Slice], fos: f64) -> Option<(f64, f64)> {
    let (mut numerator, mut driving) = (0.0_f64, 0.0_f64);
    for s in slices {
        let at = at_fos(s, fos);
        driving += at.driving_term();
        if is_inert(s) {
            continue;
        }
        let m = m_alpha(s, fos);
        if m.is_nan() || m <= M_ALPHA_POLE {
            return None;
        }
        numerator += (at.cohesion * at.width
            + (at.total_weight() - at.pore_pressure * at.width) * at.tan_phi)
            / m;
    }
    Some((numerator, driving))
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
    // E13f: Bishop is defined on circles only. The validation already rejects it on a polyline; this is the defence.
    if !opts.circular {
        return MethodResult::new(
            method,
            f64::NAN,
            SolveStatus::Invalid,
            0,
            None,
            Some(NON_CIRCULAR_MESSAGE),
        );
    }
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
    let driving: f64 = slices.iter().map(Slice::driving_term).sum();
    // E14g: with passive forces `g(F) = N(F)/D(F)` has the force divided by F in both; without them it is `rhs`, as always.
    let passive = any_passive(slices);
    let g = |f: f64| -> Option<f64> {
        if passive {
            let (n, d) = terms_passive(slices, f)?;
            (d > 0.0).then(|| n / d)
        } else {
            rhs(slices, driving, f)
        }
    };
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
    // E14o-3: and above the F where the passive forces lift the mass (0 without them).
    let f_adm = f_adm.max(lift_bound(slices));
    let lo = if f_adm > 0.0 {
        f_adm * (1.0 + ADM_MARGIN)
    } else {
        FOS_FLOOR
    };
    let inside = |f: f64| f.is_finite() && f >= lo && f <= FOS_MAX;

    // Fixed-point phase (E7b): F₀ = max(F_ord, 1.05·F_adm, 0.1), budget max_iterations / 2.
    let mut iterations = 0usize;
    let start = if passive {
        start_fos_passive(slices)
    } else {
        start_fos(slices)
    };
    let mut fos = start.max(1.05 * f_adm);
    let mut root: Option<f64> = None;
    while inside(fos) && iterations < opts.max_iterations / 2 {
        let Some(next) = g(fos) else {
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
            // `F − g(F)`; with passive forces its divisor-free form `F·D(F) − N(F)`, which has the same sign where
            // `D(F) > 0` (E14g).
            let h = |f: f64| {
                if passive {
                    terms_passive(slices, f).map(|(n, d)| f * d - n)
                } else {
                    rhs(slices, driving, f).map(|g| f - g)
                }
            };
            let (mut a, mut b) = (lo, FOS_MAX);
            let ends = (h(a), h(b));
            let mut ha = match ends {
                (Some(ha), Some(hb)) if ha * hb <= 0.0 => ha,
                // E14o-2: with passive forces the ends can have the same sign without that meaning that there is no
                // root (`h(lo) > 0` because `passive_v / lo` is huge, the mass lifted): the sign change is bracketed
                // on a geometric grid before the bisection.
                _ if passive => {
                    let floor = if f_adm > 0.0 { lo } else { GRID_FLOOR };
                    match bracket_on_grid(&h, floor, start.max(1.05 * f_adm)) {
                        Some((fa, fb, hfa)) => {
                            a = fa;
                            b = fb;
                            hfa
                        }
                        None => return invalid_m(f64::NAN, iterations),
                    }
                }
                // No sign change in the interval: no root that satisfies m_α ≥ min_m_alpha.
                _ => return invalid_m(f64::NAN, iterations),
            };
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
    // E4e: Bishop has ΔX = 0. The class of the negative normal forces is a note of the converged state (E8d).
    let warning = negative_normal_message(slices, |_, s| effective_normal(s, root, 0.0));
    MethodResult::new(method, root, SolveStatus::Converged, iterations, None, None)
        .with_warnings(warning)
}
