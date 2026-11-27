//! Non-circular search refinement (F6.4, F6.10). B0 freezes the interface; the writer of B1 (M-NC) fills the algorithm.
//!
//! The seeds are the `seeds` best distinct circles of the circular search of the same method (with their FS); each one
//! is converted into a polyline with nodes in `x` between the entry and the exit, and refined by the alternating
//! variation of its vertices (D4, X24 §6; the conversion and the budget are fixed by X29). The refined FS is never
//! larger than that of its seed (F6.10).

use crate::geometry::PreparedModel;
use crate::model::{Circle, MethodKind, NonCircularSpec};
use crate::search::NonCircularStats;
use crate::surface::Surface;

/// Refines the circular seeds into the critical polyline (F6.6 hook 3, F6.10).
///
/// `seeds` are the best distinct circles with their FS; `eval` evaluates a candidate polyline (already fitted to the
/// ground) with the same steps that `lib.rs` runs on a fixed surface, and returns `Some(FS)` only for a valid,
/// converged surface. Returns the refined surface and the statistics of the refinement.
///
/// B0 stub: [`todo!("F3B-M-NC")`]. The writer of B1 replaces it; the signature cannot change without an amendment.
pub(crate) fn refine(
    pm: &PreparedModel,
    method: MethodKind,
    spec: &NonCircularSpec,
    seeds: Vec<(Circle, f64)>,
    mut eval: impl FnMut(&Surface) -> Option<f64>,
) -> (Surface, NonCircularStats) {
    let _ = (&pm, method, spec, &seeds, &mut eval);
    todo!("F3B-M-NC")
}
