//! SHANSEP strength (F6.3, F6.9). B0 freezes the interface; the writer of B1 (M-SH) fills the physics.
//!
//! `Su = ratio·σ′v·OCR^exponent` at the midpoint of the base, with `φ = 0`; with `pop`, `OCR = (σ′v + pop)/σ′v`;
//! with `ocr_by_elevation`, OCR interpolated linearly at the base midpoint (F6.9). What enters `σ′v` is fixed by X30.

use crate::geometry::PreparedModel;
use crate::slicer::Slice;
use crate::strength::ShansepParams;

/// Writes `cohesion = Su` and `tan_phi = 0` on the `shansep` base slices (F6.6 hook 1, F6.9).
///
/// Without a `shansep` slice it does nothing. B0 stub: [`todo!("F3B-M-SH")`] when there is one. The writer of B1
/// replaces it; the signature cannot change without an amendment.
pub(crate) fn apply(pm: &PreparedModel, slices: &mut [Slice]) {
    let any = slices.iter().any(|s| {
        !crate::methods::is_inert(s)
            && matches!(
                pm.materials[s.material].law,
                crate::strength::StrengthLaw::Shansep(_)
            )
    });
    if !any {
        return;
    }
    todo!("F3B-M-SH")
}

/// Undrained strength `Su` of a SHANSEP material at the effective vertical stress `sigma_v` (F6.6, F6.9).
///
/// B0 stub: [`todo!("F3B-M-SH")`]. The writer of B1 replaces it; the signature cannot change without an amendment.
pub(crate) fn su_at(params: &ShansepParams, sigma_v: f64, y: f64) -> f64 {
    let _ = (params, sigma_v, y);
    todo!("F3B-M-SH")
}
