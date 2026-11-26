//! Tension crack (format v0.5; contract F5.4, amendments E15d and E15h).
//!
//! **Stub of wave G0.** The types and signatures are frozen; [`locate`] and [`truncate`] are `todo!("G1: grieta de
//! tracción")`. `lib.rs` calls them **only if `analysis.tension_crack` exists**, so a model without a crack goes
//! through the same code as v0.3.0 (identity, E15e-1). Wave M-grieta (G1 to G9) fills them and the end checks of the
//! slicer.
//!
//! # Flow that `lib.rs` follows for each surface (final surface and every candidate of the search)
//!
//! 1. [`locate`] finds `x_c` and the depth `d` (G1, G6) from the **fitted** surface; `Err(NotReached)` if the surface
//!    never gets to depth `d` (it has no mass). A fixed surface then fails with
//!    `NoValidSurface: tension_crack_not_reached…`; a candidate of the search is **discarded** (G9), and if all are,
//!    `NoValidSurface` (as always).
//! 2. The nodes of [`CrackPlan::breaks`] (`x_c ± 1e-6·width`, like the crossings of E14m) go to
//!    `LoadCase::with_extra_breaks`, together with those of the reinforcements, so the cut has a thin slice at `x_c`.
//! 3. The surface is sliced. The end checks (E10a, E13 and `check_block_ends`) apply to the **truncated** mass, whose
//!    end on the crest side is `(x_c, base(x_c))`, not to the whole arc: this is the part of `slicer.rs` that
//!    M-grieta owns (`sliding_span`, `main_block_range`, `check_block_ends`, `slice_span`).
//! 4. [`truncate`] removes every slice on the crest side of `x_c`, adds the force of the water in the crack to the
//!    adjacent slice (G3) and returns the [`CrackReport`]. The weight that was removed is **not** kept as a load (G2).
//! 5. Then `water::apply_ponded` and the reinforcements act on the remaining slices.
//!
//! # Force of the water (G3, G4, E7)
//!
//! `Pw = ½·γw·hw²`, `hw = d·water_fill`, horizontal and **in the sliding direction**: in the model frame
//! `H_x = s·Pw` (`s = +1` for `LeftToRight`), and in the sliding direction, which is what `Slice::h_force` holds,
//! `H = Pw`. It acts at `y_g = base(x_c) + hw/3`, on the slice adjacent to the face (the last one of the mass). For
//! that slice, with `(xm, ym)` the midpoint of its base: `h_force += Pw`, `h_moment_base += Pw·(y_g − ym)` (Spencer,
//! M-P) and `driving_extra += Pw·(yc − y_g)/R` (Bishop, circle); Janbu uses only the force. It does not change the
//! pore pressure of the base, it has no weight and the face has no strength (G4); no seismic force acts on it (E7).
//! `γw` is the one of the model (`water.unit_weight`, or the default; E12e). It needs no piezometric line.
//!
//! # E15h
//!
//! No new field in `Slice`: the force and its moments go to `weight_extra` (nothing), `h_force`, `h_moment_base` and
//! `driving_extra`. See `docs/fase3/g0/NOTAS.md`.

use crate::geometry::PreparedModel;
use crate::loads::LoadCase;
use crate::model::TensionCrack;
use crate::report::CrackReport;
use crate::slicer::Slice;
use crate::surface::Surface;

/// Reason of the invalid surface when it does not get to the depth of the crack (G1). It is the stable code that the
/// message of `NoValidSurface` starts with.
pub const TENSION_CRACK_NOT_REACHED: &str = "tension_crack_not_reached";

/// Why a surface has no crack mass.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CrackError {
    /// `ground(x) − base(x) < d(x)` everywhere along the surface (G1, G8: no cap by the height of the slope).
    NotReached,
}

/// Where the crack of a surface is (result of [`locate`]).
#[derive(Debug, Clone, PartialEq)]
pub struct CrackPlan {
    /// `x_c`: first point from the entry, on the crest side, where `ground(x) − base(x) ≥ d(x)` (G1). Sweep of 200
    /// steps and a bisection down to the tolerance `tol` of the model.
    pub x_c: f64,
    /// Depth that applies: the fixed one, or the automatic one at `x_c` (G6, G7).
    pub depth: f64,
    /// Extra nodes of the cut (`x_c ± 1e-6·width`): pass them to `LoadCase::with_extra_breaks`.
    pub breaks: Vec<f64>,
    /// Water in the crack, `hw = depth·water_fill`, and `γw` of the model; `truncate` uses them for `Pw`.
    pub water_height: f64,
    pub gamma_w: f64,
}

/// G1 and G6: the position and depth of the crack on `surface` (**fitted**, circle or polyline).
///
/// - `spec`: `analysis.tension_crack`, already validated (`Fixed(d)` with `d > 0` finite, or `Auto`; `water_fill` in
///   `[0, 1]`);
/// - `pm`: the prepared model (ground, materials with `c`, `φ`, `γ` of the layer under the ground at `x`, taken
///   `1e-3·scale` below it; `Su` and `φ = 0` for an undrained material; `γw`, the piezometric line and the ground for
///   the water over it; sliding direction and tolerance);
/// - `loads`: the `udl` that cover `x` add to `q` in `z(x) = max(0, 2c/(γ·tan(45° − φ/2)) − q/γ)`, together with
///   `γw·(piezo − ground)` of the ponded water at `x`. `z` is recomputed for each `x` of the sweep.
///
/// Returns the plan, or `NotReached`. **Stub (G0):** `todo!`.
pub fn locate(
    spec: &TensionCrack,
    pm: &PreparedModel,
    surface: &Surface,
    loads: &LoadCase,
) -> Result<CrackPlan, CrackError> {
    let _ = (spec, pm, surface, loads);
    todo!("G1: grieta de tracción")
}

/// G2 and G3: truncates the slices of the crack and adds the force of its water.
///
/// - `plan`: the result of [`locate`] for the same `surface`;
/// - `pm`, `surface`: as in [`locate`] (a circle gives `(yc, R)` for `driving_extra`, a polyline gives none);
/// - `slices`: the slices of the surface, toe first, cut with the nodes of [`CrackPlan::breaks`] and **before** any
///   force of the ponded water or of the reinforcements. They are modified: every slice on the crest side of
///   `x_c` is removed, and the slice adjacent to the face receives `Pw` (see the module).
///
/// It returns the entry of the report (`x = x_c`, `depth`, `water_force = Pw`; 0 for a dry crack). A reinforcement
/// crossing on the crest side of `x_c` then gets `reinforcement_outside_mass` (it is applied after this call).
/// **Stub (G0):** `todo!`.
pub fn truncate(
    plan: &CrackPlan,
    pm: &PreparedModel,
    surface: &Surface,
    slices: &mut Vec<Slice>,
) -> CrackReport {
    let _ = (plan, pm, surface, slices);
    todo!("G1: grieta de tracción")
}
