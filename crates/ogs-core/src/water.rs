//! Ponded water (free water over the ground; contract F5.3, amendments E15c and E15h).
//!
//! **Stub of wave G0.** The signatures and the types below are frozen; [`ponded_terms`] returns zero terms. Wave
//! M-agua (E1 to E4 of X21) fills it. With zero terms nothing changes in the slices, so a model without ponded water
//! gives the same output as v0.3.0 (identity, E15e-1), and the rows of ponded water fail **by value** (0,848 against
//! 0,939 in X21-P01), not by a panic.
//!
//! The ponded water has no field in the format and applies in every version (D1, E15a): it is the region between the
//! piezometric line and the ground where `piezo > ground`. It covers the **whole model**, not only the mass of the
//! evaluated surface (X20 §1.6), so the search sees the same water for every candidate.
//!
//! # Where it enters (`lib.rs`)
//!
//! `lib.rs` calls [`ponded_terms`] once per surface, **after** slicing (and after the crack truncation, G2) and before
//! the forces of the reinforcements, on the final surface and on every candidate of the search, and adds the terms
//! with [`PondTerms::add_to`]. It does not need extra nodes: the integral is by tramo of the ground, split at the
//! vertices of the ground, those of the piezometric line and their crossings, with the exact moments of E1.
//!
//! # E15h: no new field in `Slice`
//!
//! The moment `s·V·(xg − xm)` of the weight of the water about the midpoint of the base **fits in the current
//! fields** (see `docs/fase3/g0/NOTAS.md`):
//! - `Slice::weight_extra` takes `V` (vertical, downward);
//! - `Slice::h_force` takes `H = s·H_x`;
//! - `Slice::h_moment_base` is, for Spencer and Morgenstern-Price, the **whole** moment about the midpoint of the base
//!   of the forces that are not `W*`, `N` and `S`: the solvers only sum it (`Σ b(E_k + E_{k+1})(tan α − λ) − 2·Σ
//!   h_moment_base`), so it takes `H·(yg − ym) + s·V·(xg − xm)`;
//! - `Slice::driving_extra` takes, for Bishop, `[H·(yc − yg) − s·V·(xg − xm)]/R` (`0` on a polyline, which has no
//!   centre and does not offer Bishop);
//! - Janbu uses only the forces.
//!
//! With `(xg, yg)` the point of application and `(xm, ym)` the midpoint of the base. `s = +1` if the sliding goes
//! toward `+x` (`Sliding::LeftToRight`), `−1` otherwise: see [`sliding_sign`].

use crate::geometry::{PreparedModel, Sliding};
use crate::slicer::Slice;
use crate::surface::Surface;

/// The terms that the ponded water adds to one slice (E15c). All are in force units per metre of slope (the pore
/// pressure in stress units) and **zero is neutral**: a slice under no ponded water gets [`PondTerms::ZERO`] and is
/// not touched, bit for bit.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct PondTerms {
    /// `V = γw·∫h dx`: weight of the water over the top of the slice, vertical and downward (E1). Added to
    /// `Slice::weight_extra`. No seismic force acts on it (E7).
    pub weight: f64,
    /// `H = s·γw·∫h·y′ dx`: horizontal thrust on the ground in the sliding direction (E1), plus the thrust of a
    /// vertical face (E4) on the slice whose edge is the face, on the high side. Added to `Slice::h_force`.
    pub h_force: f64,
    /// `H·(yg − ym) + s·V·(xg − xm)`: moment of `V` and `H` about the midpoint of the base (E2, Spencer and M-P),
    /// exact (Gauss of 3 points). Added to `Slice::h_moment_base`.
    pub h_moment_base: f64,
    /// `[H·(yc − yg) − s·V·(xg − xm)]/R` (E2, Bishop); `0` with no circle. Added to `Slice::driving_extra`.
    pub driving_extra: f64,
    /// `ru·V/b` for a slice whose base material has `ru` (E15c-ru: `u = ru·(W + V)/b`, with `V` without loads or
    /// seismic force); `0` for the others. Added to `Slice::pore_pressure`. The pressure of a base under the water
    /// with no `ru` does not change (E3: `γw·max(0, piezo − y_base_mid)`, not clipped to the ground, already so).
    pub pore_pressure: f64,
}

impl PondTerms {
    /// No term: the neutral element.
    pub const ZERO: PondTerms = PondTerms {
        weight: 0.0,
        h_force: 0.0,
        h_moment_base: 0.0,
        driving_extra: 0.0,
        pore_pressure: 0.0,
    };

    /// True when every term is zero.
    pub fn is_zero(&self) -> bool {
        *self == Self::ZERO
    }

    /// Adds the terms to the slice. A zero term leaves the slice untouched (it also keeps the sign of a `-0.0`), so a
    /// model without ponded water does not change by a bit.
    pub fn add_to(&self, slice: &mut Slice) {
        if self.is_zero() {
            return;
        }
        slice.weight_extra += self.weight;
        slice.h_force += self.h_force;
        slice.h_moment_base += self.h_moment_base;
        slice.driving_extra += self.driving_extra;
        slice.pore_pressure += self.pore_pressure;
    }
}

/// `s` of the contract: `+1` if the sliding goes toward `+x` (`LeftToRight`), `−1` if it goes toward `−x`.
pub fn sliding_sign(pm: &PreparedModel) -> f64 {
    match pm.sliding {
        Sliding::LeftToRight => 1.0,
        Sliding::RightToLeft => -1.0,
    }
}

/// The terms of the ponded water for each slice of `slices`, **in the same order**, one entry per slice (E1 to E4,
/// E15c).
///
/// - `pm`: the prepared model: the ground (`top_at`, its vertices), the piezometric line (`piezometric_y`, extended
///   horizontally outside its range), `γw` (`water.unit_weight`, with the rules of E12e in imperial units) and the
///   materials (`ru` of the base material `Slice::material`);
/// - `surface`: the **fitted** surface of the slices; a circle gives `(yc, R)` for `driving_extra`, a polyline has no
///   centre (`driving_extra = 0`);
/// - `slices`: the final slices of the mass, **toe first**, already truncated by the crack if there is one (G2), and
///   before any ponded term is added (they carry `pore_pressure` of the base, `weight` and the base midpoint);
/// - `s`: `+1` if the sliding goes toward `+x`, `−1` otherwise ([`sliding_sign`]).
///
/// Slices outside the water (and air slices) get [`PondTerms::ZERO`]. An implementation may return an **empty**
/// vector as a fast path when the model has no water over the ground; the caller treats it as all zeros.
/// The vertical face of a dam (E4) is a vertex pair with the same `x`: its thrust
/// `½·γw·[(yw − ya)² − (yw − yb)²]` goes to the slice whose edge is the face, on the high side.
///
/// **Stub (G0):** it returns zero terms.
pub fn ponded_terms(
    pm: &PreparedModel,
    surface: &Surface,
    slices: &[Slice],
    s: f64,
) -> Vec<PondTerms> {
    let _ = (pm, surface, s);
    vec![PondTerms::ZERO; slices.len()]
}

/// Adds [`ponded_terms`] to `slices` (what `lib.rs` calls).
pub(crate) fn apply_ponded(pm: &PreparedModel, surface: &Surface, slices: &mut [Slice]) {
    let terms = ponded_terms(pm, surface, slices, sliding_sign(pm));
    for (slice, term) in slices.iter_mut().zip(&terms) {
        term.add_to(slice);
    }
}
