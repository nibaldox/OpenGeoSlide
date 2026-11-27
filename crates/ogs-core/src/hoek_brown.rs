//! Hoek-Brown strength (F6.2, F6.8). B0 freezes the interface; the writer of B1 (M-HB) fills the physics.
//!
//! The envelope and its instantaneous tangent at `σ′n` are frozen in F6.8 (Hoek et al. 2002, eqs. 2 and 8 to 10); the
//! derived parameters `mb`, `s` and `a` are computed in [`crate::strength::hoek_brown_mb_s_a`] (F6.2, eqs. 3 to 5).

use crate::strength::HoekBrownParams;

/// Shear strength of the Hoek-Brown envelope at the effective normal stress `sigma_n` (F6.5, F6.8; X25 §1.1).
///
/// B0 stub: [`todo!("F3B-M-HB")`]. The writer of B1 replaces it; the signature cannot change without an amendment.
pub(crate) fn tau_at_normal(params: &HoekBrownParams, sigma_n: f64) -> f64 {
    let _ = (params, sigma_n);
    todo!("F3B-M-HB")
}
