//! Janbu's simplified and corrected methods (E13e).
//!
//! **Simplified.** `F₀` is the root of the force closure `E_n(F, λ = 0) = 0`: the march of Spencer (`spencer.rs`) with no
//! interslice shear, so `ΔX = 0`, with `H`, `W*` and the loads of E12b included and without the moment equation
//! ([`spencer::force_root_at_zero`]). Guards: E3 (`no_driving`), and E4b at `λ = 0` (`Φ_i/F = m_α ≥ min_m_alpha`, and
//! `Φ_i > 1e-9·F`). The report carries no `lambda`. The result is the horizontal force equilibrium of the whole
//! mass, as Janbu's method asks. When the closure has several admissible roots, the **lowest** one is taken, as in
//! Spencer (E12e, E13j-4), with the note `multiple_admissible_roots` if another lies more than 1 % above it.
//!
//! **Corrected.** `F = f₀·F₀`, with `f₀ = 1 + b₁ (d/L − 1.4 (d/L)²)` (Janbu 1973), as cSlope does (`solvers.rs`):
//! - `L` is the chord between the two ends of the block, `d` the greatest distance of the midpoint of a base
//!   below the chord (`d ≤ 0` gives `d = 0` and `f₀ = 1`);
//! - `b₁` is chosen once for the whole block from its soil slices: 0.69 when some slice has `c > 0` and none has
//!   `tan φ > 0` (an undrained material counts as cohesion only), 0.31 when some has `tan φ > 0` and none has `c > 0`
//!   or when none has either, and 0.50 when both occur.
//!
//! The state, the guards, `N'` and the forces of the slices are those of `F₀`. The report carries `fos = f₀·F₀` and
//! `correction_factor = f₀`. The search minimises the corrected FS.

use super::spencer::{self, spencer_direct_normals, spencer_interslice};
use super::{
    MethodResult, SolveOptions, SolveStatus, air_gap_thrust, converged_notes, is_inert,
    negative_normal_message,
};
use crate::model::MethodKind;
use crate::slicer::Slice;

/// Force closure at `F₀`: `|E_n| ≤ 1e-6·ΣW`, as in Spencer (E10b).
const CLOSURE_FRACTION: f64 = 1e-6;
/// `b₁` of cohesion-only, friction-only (and neither), and mixed soil.
const B1_COHESION: f64 = 0.69;
const B1_FRICTION: f64 = 0.31;
const B1_MIXED: f64 = 0.50;

/// `F₀` of Janbu's simplified method, if it converges. It is the start of Spencer and Morgenstern-Price on a polyline
/// (E13f), where Bishop is not defined.
pub(super) fn start_fos(slices: &[Slice], opts: &SolveOptions) -> Option<f64> {
    spencer::force_root_at_zero(slices, opts, false)
        .ok()
        .map(|(f0, _, _)| f0)
}

/// `b₁` of the block: one value for all its soil slices (E13e).
fn b1(slices: &[Slice]) -> f64 {
    let soil = || slices.iter().filter(|s| !is_inert(s));
    let cohesion = soil().any(|s| s.cohesion > 0.0);
    let friction = soil().any(|s| s.tan_phi > 0.0);
    match (cohesion, friction) {
        (true, true) => B1_MIXED,
        (true, false) => B1_COHESION,
        _ => B1_FRICTION,
    }
}

/// `f₀ = 1 + b₁ (d/L − 1.4 (d/L)²)` of the block (E13e). `L` is the distance from the left end of the base of the first
/// slice to the right end of the last one (the two ends of the block, whatever the sliding direction). `d` is the
/// greatest distance below the chord of the midpoint of a base, over all slices. `1` for an empty block or a chord of
/// zero length.
pub fn janbu_correction_factor(slices: &[Slice]) -> f64 {
    let ends = slices
        .iter()
        .fold(None, |acc: Option<(&Slice, &Slice)>, s| {
            Some(match acc {
                None => (s, s),
                Some((l, r)) => (
                    if s.x_left < l.x_left { s } else { l },
                    if s.x_right > r.x_right { s } else { r },
                ),
            })
        });
    let Some((first, last)) = ends else {
        return 1.0;
    };
    let (xa, ya) = (first.x_left, first.y_base_left);
    let (xb, yb) = (last.x_right, last.y_base_right);
    let length = (xb - xa).hypot(yb - ya);
    if length <= 0.0 || !length.is_finite() {
        return 1.0;
    }
    let mut d = 0.0_f64;
    for s in slices {
        let x = 0.5 * (s.x_left + s.x_right);
        let y = 0.5 * (s.y_base_left + s.y_base_right);
        // Signed distance of the base midpoint below the chord line.
        let depth = ((xb - xa) * (ya - y) - (yb - ya) * (xa - x)) / length;
        if depth > d {
            d = depth;
        }
    }
    let ratio = d / length;
    1.0 + b1(slices) * (ratio - 1.4 * ratio * ratio)
}

/// Janbu's simplified (`corrected == false`) or corrected (`true`) method on the slices of a block.
pub(super) fn solve(slices: &[Slice], opts: &SolveOptions, corrected: bool) -> MethodResult {
    let method = if corrected {
        MethodKind::JanbuCorrected
    } else {
        MethodKind::JanbuSimplified
    };
    let stop = |fos: f64, status: SolveStatus, iterations: usize, message: &str| {
        MethodResult::new(method, fos, status, iterations, None, Some(message))
    };
    let (f0, iterations, multiple) = match spencer::force_root_at_zero(slices, opts, true) {
        Ok(found) => found,
        Err((status, message, used)) => return stop(f64::NAN, status, used, message),
    };
    // The forces at F₀ with ΔX = 0: the exact recurrence of the closure.
    let e = spencer_interslice(slices, f0, 0.0);
    if e.iter().any(|v| !v.is_finite()) {
        return stop(f0, SolveStatus::Invalid, iterations, "non_finite");
    }
    let total_w: f64 = spencer::force_scale(slices);
    if e.last().copied().unwrap_or(0.0).abs() > CLOSURE_FRACTION * total_w {
        return stop(
            f0,
            SolveStatus::NotConverged,
            iterations,
            "no_admissible_root",
        );
    }
    let (fos, correction) = if corrected {
        let f_correction = janbu_correction_factor(slices);
        (f_correction * f0, Some(f_correction))
    } else {
        (f0, None)
    };
    if !fos.is_finite() {
        return stop(fos, SolveStatus::Invalid, iterations, "non_finite");
    }
    let normals = spencer_direct_normals(slices, 0.0, &e);
    let mut notes = Vec::with_capacity(3);
    if multiple {
        notes.push(spencer::MULTIPLE_ROOTS_MESSAGE);
    }
    notes.extend(converged_notes(
        air_gap_thrust(slices, &e),
        negative_normal_message(slices, |k, _| normals[k]),
    ));
    let mut result = MethodResult::new(method, fos, SolveStatus::Converged, iterations, None, None)
        .with_warnings(notes);
    result.correction_factor = correction;
    result
}
