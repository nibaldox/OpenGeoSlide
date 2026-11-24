//! Circular entry/exit search (§4.4). Implementation: W1c.

use serde::Serialize;

use crate::geometry::Ground;
use crate::model::{Circle, SearchSpec};

/// Search counters.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct SearchStats {
    /// Number of calls to `eval`.
    pub evaluated: usize,
    /// Number of calls that returned `Some`.
    pub valid: usize,
}

/// Best surface found and its statistics.
#[derive(Debug, Clone, PartialEq)]
pub struct SearchResult {
    pub best: Option<(Circle, f64)>,
    pub stats: SearchStats,
}

/// Searches the critical circle. `eval` returns `Some(FS)` only for valid, converged surfaces.
pub fn search_circular<G, E>(_ground: &G, _spec: &SearchSpec, _eval: E) -> SearchResult
where
    G: Ground + Sync,
    E: Fn(&Circle) -> Option<f64> + Sync,
{
    todo!("W1c")
}
