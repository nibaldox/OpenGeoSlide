//! Limit-equilibrium solvers: simplified Bishop (§4.2) and Spencer, i.e. Morgenstern-Price with f = 1 (§4.3).

mod bishop;
pub mod spencer;

use serde::{Deserialize, Serialize};

use crate::model::MethodKind;
use crate::slicer::Slice;

/// Relative driving threshold of amendment E3: `Σ W·sin α ≤ 1e-6 · Σ W` means no driving moment.
const NO_DRIVING_FRACTION: f64 = 1e-6;

/// Pole of the Bishop factor (§4.2): `m_α ≤ 1e-9` in a soil slice.
pub(crate) const M_ALPHA_POLE: f64 = 1e-9;

/// Relative trigger of the negative-normal warning (E4e): `N' < −1e-6 · Σ W`.
const NEGATIVE_NORMAL_FRACTION: f64 = 1e-6;

/// Share of the weight carried by negative normal forces above which the warning is major (E7d, calibrated
/// by E8c). Like the 0.02 it replaces, it classifies the warning; it is not a numerical tolerance.
const NEGATIVE_NORMAL_MAJOR_FRACTION: f64 = 0.05;

/// Relative threshold of the air-gap warning (E7a): `|E_gap| > 1e-3 · Σ W`.
const AIR_GAP_FRACTION: f64 = 1e-3;

/// Informative note: negative effective normal force of minor extent (E5, E7d).
pub(crate) const NEGATIVE_NORMAL_MESSAGE: &str = "negative_effective_normal";
/// Warning: negative effective normal force over a major part of the base (E7d).
pub(crate) const NEGATIVE_NORMAL_MAJOR_MESSAGE: &str = "negative_effective_normal_major";
/// Warning: an interior air run transmits thrust (E7a).
pub(crate) const AIR_GAP_MESSAGE: &str = "air_gap_thrust";

/// An air slice (E2): no weight and no strength. It takes no part in the m_α test, nor in the
/// F sums of the solvers. Spencer still passes the normal force through it (E7a).
pub(crate) fn is_inert(s: &Slice) -> bool {
    s.weight == 0.0 && s.cohesion == 0.0 && s.tan_phi == 0.0
}

/// Bishop's `m_α = cos α + sin α · tan φ / F` (§4.2) of a slice at factor of safety `fos`.
pub(crate) fn m_alpha(s: &Slice, fos: f64) -> f64 {
    let (sin, cos) = s.alpha.sin_cos();
    cos + sin * s.tan_phi / fos
}

/// Effective normal force of a slice (E4e), from the vertical equilibrium
/// `N cos α + S sin α = W − ΔX` with `S = (c·l + N'·tan φ)/F`, `N = N' + u·l`, `l = b·sec α`:
///
/// `N' = (W − ΔX − u·b − c·l·sin α / F) / m_α`.
///
/// `delta_x` is the net interslice shear `X_right − X_left`; Bishop has `ΔX = 0`.
pub fn effective_normal(s: &Slice, fos: f64, delta_x: f64) -> f64 {
    (s.weight
        - delta_x
        - s.pore_pressure * s.width
        - s.cohesion * s.base_length * s.alpha.sin() / fos)
        / m_alpha(s, fos)
}

/// Classification of the negative effective normal forces (E4e, E7d). `normal(k, s)` gives the normal
/// force of slice `k`; air slices are not classified.
///
/// Returns `None` when no soil slice has `N' < −1e-6·ΣW`. Otherwise, with `f = Σ_{N'<0} |N'| / ΣW`:
/// `negative_effective_normal` (note) if `f ≤ 0.05`, `negative_effective_normal_major` (warning) if `f > 0.05`
/// (E8c).
pub(crate) fn negative_normal_message(
    slices: &[Slice],
    normal: impl Fn(usize, &Slice) -> f64,
) -> Option<&'static str> {
    let total_w: f64 = slices.iter().map(|s| s.weight).sum();
    let floor = -NEGATIVE_NORMAL_FRACTION * total_w;
    let mut triggered = false;
    let mut negative_sum = 0.0_f64;
    for (k, s) in slices.iter().enumerate().filter(|(_, s)| !is_inert(s)) {
        let n = normal(k, s);
        if n < floor {
            triggered = true;
        }
        if n < 0.0 {
            negative_sum += -n;
        }
    }
    if !triggered {
        return None;
    }
    let share = if total_w > 0.0 {
        negative_sum / total_w
    } else {
        f64::INFINITY
    };
    Some(if share > NEGATIVE_NORMAL_MAJOR_FRACTION {
        NEGATIVE_NORMAL_MAJOR_MESSAGE
    } else {
        NEGATIVE_NORMAL_MESSAGE
    })
}

/// Air-gap check (E7a): true when an interior run of air slices (soil on both sides) transmits
/// `|E| > 1e-3 · Σ W`. `e[k]` is the normal interslice force on the face below slice `k`, and it is
/// constant across the air run.
pub(crate) fn air_gap_thrust(slices: &[Slice], e: &[f64]) -> bool {
    let total_w: f64 = slices.iter().map(|s| s.weight).sum();
    let limit = AIR_GAP_FRACTION * total_w;
    let n = slices.len();
    let mut k = 0;
    while k < n {
        if !is_inert(&slices[k]) {
            k += 1;
            continue;
        }
        let start = k;
        while k < n && is_inert(&slices[k]) {
            k += 1;
        }
        // The run is `start..k`. It is interior when soil lies on both sides.
        if start > 0 && k < n && e[start].abs() > limit {
            return true;
        }
    }
    false
}

/// The notes of a converged state, in a fixed order: the air-gap warning first (the more severe one), then
/// the negative-normal class (E7a, E8d). A converged result carries them in `MethodResult.warnings`.
pub(crate) fn converged_notes(air: bool, normal: Option<&'static str>) -> Vec<&'static str> {
    let mut codes = Vec::with_capacity(2);
    if air {
        codes.push(AIR_GAP_MESSAGE);
    }
    codes.extend(normal);
    codes
}

/// Amendment E3: true when the surface has no driving moment (`Σ W·sin α ≤ 1e-6 · Σ W`, or non-finite).
pub(crate) fn lacks_driving(slices: &[Slice]) -> bool {
    let total_w: f64 = slices.iter().map(|s| s.weight).sum();
    let driving: f64 = slices.iter().map(|s| s.weight * s.alpha.sin()).sum();
    !(total_w.is_finite() && driving.is_finite()) || driving <= NO_DRIVING_FRACTION * total_w
}

/// Solver tolerances, taken from `AnalysisSettings`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SolveOptions {
    /// Relative tolerance on FS.
    pub tolerance: f64,
    pub max_iterations: usize,
    /// Bishop: `m_α` below this value marks the solution as `Invalid`.
    pub min_m_alpha: f64,
}

/// Outcome of a solve.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SolveStatus {
    Converged,
    NotConverged,
    Invalid,
}

/// Result of one method on one surface.
///
/// `message` is the reason for the status and is set only for `Invalid` and `NotConverged` (E8d). `warnings`
/// are the notes of the state (for example `air_gap_thrust` or the negative-normal class); they can accompany a
/// `Converged` result.
#[derive(Debug, Clone, PartialEq)]
pub struct MethodResult {
    pub method: MethodKind,
    pub fos: f64,
    pub status: SolveStatus,
    pub iterations: usize,
    pub lambda: Option<f64>,
    pub message: Option<String>,
    pub warnings: Vec<String>,
}

impl MethodResult {
    /// Builds a result with no warnings. `message` is the reason of an `Invalid` or `NotConverged` state.
    fn new(
        method: MethodKind,
        fos: f64,
        status: SolveStatus,
        iterations: usize,
        lambda: Option<f64>,
        message: Option<&str>,
    ) -> Self {
        Self {
            method,
            fos,
            status,
            iterations,
            lambda,
            message: message.map(str::to_owned),
            warnings: Vec::new(),
        }
    }

    /// Attaches the notes of a converged state (E8d).
    fn with_warnings(mut self, codes: impl IntoIterator<Item = &'static str>) -> Self {
        self.warnings.extend(codes.into_iter().map(str::to_owned));
        self
    }
}

/// Solves the slices with the given method. Dispatches to `bishop::solve` or `spencer::solve`.
///
/// `slices` must be ordered toe → crest, with `alpha > 0` when the base rises toward the crest.
pub fn solve(slices: &[Slice], method: MethodKind, opts: &SolveOptions) -> MethodResult {
    match method {
        MethodKind::Bishop => bishop::solve(slices, opts),
        MethodKind::Spencer => spencer::solve(slices, opts),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Two soil slices of weight 50 each (ΣW = 100). The first one gets normal force `−f·100`, so the share
    /// `Σ_{N'<0}|N'|/ΣW` is exactly `f`.
    fn class_at(f: f64) -> Option<&'static str> {
        let slice = Slice {
            x_left: 0.0,
            x_right: 1.0,
            y_base_left: 0.0,
            y_base_right: 0.0,
            y_top_mid: 1.0,
            width: 1.0,
            alpha: 0.0,
            base_length: 1.0,
            weight: 50.0,
            cohesion: 1.0,
            tan_phi: 0.5,
            pore_pressure: 0.0,
            material: 0,
        };
        let s = vec![slice, slice];
        negative_normal_message(&s, |k, _| if k == 0 { -f * 100.0 } else { 10.0 })
    }

    /// E8c: the note/warning threshold is 0.05. f = 0.03 is a note; f = 0.105 (R2-04) is the major warning; the
    /// boundary 0.05 belongs to the note (`f ≤ 0.05`). With no negative normal force there is no class.
    #[test]
    fn e8c_negative_normal_threshold_is_five_percent() {
        assert_eq!(class_at(0.03), Some("negative_effective_normal"));
        assert_eq!(class_at(0.05), Some("negative_effective_normal"));
        assert_eq!(class_at(0.105), Some("negative_effective_normal_major"));
        assert_eq!(class_at(0.0), None);
    }

    /// E8d: the notes of a converged state keep a fixed order, the air gap first.
    #[test]
    fn e8d_converged_notes_order_and_content() {
        assert_eq!(
            converged_notes(true, Some(NEGATIVE_NORMAL_MESSAGE)),
            vec![AIR_GAP_MESSAGE, NEGATIVE_NORMAL_MESSAGE]
        );
        assert_eq!(converged_notes(false, None), Vec::<&str>::new());
    }
}
