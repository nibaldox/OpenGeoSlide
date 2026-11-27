//! Outer loop of the Hoek-Brown strength (F6.6 hook 2, F6.8). B0 freezes the interface; the writer of B1 (M-HB) fills
//! the loop.
//!
//! The loop repeatedly calls [`crate::methods::solve_with`] and rewrites `cohesion`/`tan_phi` of each `Slice` with the
//! instantaneous values at the `σ′n` of the previous pass (X27 §1.4, option A). The methods do not change; without a
//! `hoek_brown` slice the loop does not run, so the identity holds by construction.

use crate::geometry::PreparedModel;
use crate::methods::{MethodResult, SolveOptions, solve_with};
use crate::model::{IntersliceSpec, MethodKind};
use crate::report::StrengthReport;
use crate::slicer::Slice;
use crate::strength::StrengthLaw;

/// Solves the slices with `method`, running the Hoek-Brown loop when some base slice is `hoek_brown` (F6.6).
///
/// Returns the [`MethodResult`] plus the [`StrengthReport`] of that method (the passes of the loop and the strength of
/// the `hoek_brown`/`shansep` base slices). Without a `hoek_brown` slice it is [`solve_with`] verbatim.
///
/// B0 stub: [`todo!("F3B-M-HB")`] when there is a `hoek_brown` slice. The writer of B1 replaces it; the signature
/// cannot change without an amendment.
pub(crate) fn solve(
    pm: &PreparedModel,
    slices: &mut [Slice],
    method: MethodKind,
    opts: &SolveOptions,
    interslice: Option<&IntersliceSpec>,
) -> (MethodResult, StrengthReport) {
    let any = slices.iter().any(|s| {
        !crate::methods::is_inert(s)
            && matches!(pm.materials[s.material].law, StrengthLaw::HoekBrown(_))
    });
    if !any {
        return (
            solve_with(slices, method, opts, interslice),
            StrengthReport::default(),
        );
    }
    let _ = (method, opts, interslice);
    todo!("F3B-M-HB")
}
