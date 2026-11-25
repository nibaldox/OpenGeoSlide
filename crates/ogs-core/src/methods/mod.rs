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

/// Share of the weight carried by negative normal forces above which the warning is major (E7d).
const NEGATIVE_NORMAL_MAJOR_FRACTION: f64 = 0.02;

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
/// `negative_effective_normal` (note) if `f ≤ 0.02`, `negative_effective_normal_major` (warning) if `f > 0.02`.
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

/// `MethodResult.message` is a single slot. The air-gap warning takes it first, because it is the
/// more severe one; otherwise the negative-normal class is used.
pub(crate) fn pick_warning(air: bool, normal: Option<&'static str>) -> Option<&'static str> {
    if air { Some(AIR_GAP_MESSAGE) } else { normal }
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
#[derive(Debug, Clone, PartialEq)]
pub struct MethodResult {
    pub method: MethodKind,
    pub fos: f64,
    pub status: SolveStatus,
    pub iterations: usize,
    pub lambda: Option<f64>,
    pub message: Option<String>,
}

impl MethodResult {
    /// Builds a result; `message` is `None` for a clean convergence.
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
        }
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
