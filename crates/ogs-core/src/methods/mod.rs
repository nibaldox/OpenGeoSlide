//! Limit-equilibrium solvers: simplified Bishop (§4.2) and Spencer, i.e. Morgenstern-Price with f = 1 (§4.3).

mod bishop;
pub mod spencer;

use serde::{Deserialize, Serialize};

use crate::model::MethodKind;
use crate::slicer::Slice;

/// Relative driving threshold of amendment E3: `Σ W·sin α ≤ 1e-6 · Σ W` means no driving moment.
const NO_DRIVING_FRACTION: f64 = 1e-6;

/// An air slice (E2): no weight and no strength. It takes no part in the m_α test or in the
/// force sums of the solvers.
pub(crate) fn is_inert(s: &Slice) -> bool {
    s.weight == 0.0 && s.cohesion == 0.0 && s.tan_phi == 0.0
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
