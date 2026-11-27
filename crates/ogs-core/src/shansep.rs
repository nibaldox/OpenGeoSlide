//! SHANSEP strength (F6.3, F6.9). B0 freezes the interface; the writer of B1 (M-SH) fills the physics.
//!
//! `Su = ratio·σ′v·OCR^exponent` at the midpoint of the base, with `φ = 0`; with `pop`, `OCR = (σ′v + pop)/σ′v`;
//! with `ocr_by_elevation`, OCR interpolated linearly at the base midpoint and constant outside the table (F6.9).
//! `σ′v = (W + Q + V)/b − u`, without the seismic term (E16o).

use crate::geometry::PreparedModel;
use crate::report::SliceStrength;
use crate::slicer::Slice;
use crate::strength::ShansepParams;

/// Code of the informative note of F6.7: a `shansep` base slice with `σ′v ≤ 0` (Su = 0).
pub const SHANSEP_NONPOSITIVE_STRESS: &str = "shansep_nonpositive_stress";

/// What [`apply`] reports to `lib.rs` (E16r): the `shansep` entries of `MethodReport.strength` and whether some base
/// slice had `σ′v ≤ 0`. Empty without `shansep` slices (no allocation).
#[derive(Debug, Clone, Default, PartialEq)]
pub(crate) struct ShansepOutcome {
    pub(crate) slices: Vec<SliceStrength>,
    pub(crate) nonpositive_stress: bool,
}

/// Writes `cohesion = Su` and `tan_phi = 0` on the `shansep` base slices (F6.6 hook 1, F6.9).
///
/// Called right after `water::apply_ponded` and before the reinforcements (E16r), when `weight_extra` is exactly
/// `kv·W + Q + V`, so `Q + V = weight_extra − kv·weight`. Without a `shansep` slice it does nothing and returns the
/// default outcome. B0 stub: [`todo!("F3B-M-SH")`] when there is one. The writer of B1 replaces it; the signature
/// cannot change without an amendment.
pub(crate) fn apply(pm: &PreparedModel, kv: f64, slices: &mut [Slice]) -> ShansepOutcome {
    let any = slices.iter().any(|s| {
        !crate::methods::is_inert(s)
            && matches!(
                pm.materials[s.material].law,
                crate::strength::StrengthLaw::Shansep(_)
            )
    });
    if !any {
        return ShansepOutcome::default();
    }
    let _ = kv;
    todo!("F3B-M-SH")
}

/// Undrained strength `Su` of a SHANSEP material at the effective vertical stress `sigma_v` (F6.6, F6.9).
///
/// B0 stub: [`todo!("F3B-M-SH")`]. The writer of B1 replaces it; the signature cannot change without an amendment.
pub(crate) fn su_at(params: &ShansepParams, sigma_v: f64, y: f64) -> f64 {
    let _ = (params, sigma_v, y);
    todo!("F3B-M-SH")
}
