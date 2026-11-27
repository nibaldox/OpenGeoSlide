//! Tension crack (format v0.5; contract F5.4, amendments E15d and E15h).
//!
//! Wave G1 (M-grieta). `lib.rs` calls [`locate`] and [`truncate`] **only if `analysis.tension_crack` exists**, so a
//! model without a crack goes through the same code as v0.3.0 (identity, E15e-1).
//!
//! # Flow that `lib.rs` follows for each surface (final surface and every candidate of the search)
//!
//! 1. [`locate`] finds `x_c` and the depth `d` (G1, G6) from the **fitted** surface; `Err(NotReached)` if the surface
//!    never gets to depth `d` (it has no mass). A fixed surface then fails with
//!    `NoValidSurface: tension_crack_not_reached…`; a candidate of the search is **discarded** (G9), and if all are,
//!    `NoValidSurface` (as always). `Err(NoGround)` means that the surface has no sliding range: the slicer gives the
//!    usual reason.
//! 2. [`CrackPlan::breaks`] (a node at `x_c`) goes to `LoadCase::with_extra_breaks`, together with those of the
//!    reinforcements.
//! 3. `slicer::slice_surface_cracked` slices the mass that the crack leaves: the span of the cut runs from the toe to
//!    `x_c` (the face is the end of the span), so the `n` divisions apply to the mass and the end checks (E10a, E13 and
//!    `check_block_ends`) are those of the **truncated** mass, whose end on the crest side is `(x_c, base(x_c))`. A
//!    circle that leaves the model past the crack is a valid mass.
//! 4. [`truncate`] removes every slice on the crest side of `x_c` (none, after the slicer; it also works on the slices
//!    of the whole arc cut at `x_c`), adds the force of the water in the crack to the adjacent slice (G3) and returns
//!    the [`CrackReport`]. The weight that was removed is **not** kept as a load (G2).
//! 5. Then `water::apply_ponded` and the reinforcements act on the remaining slices. A reinforcement that crosses on
//!    the crest side of `x_c` finds no slice: `reinforcement_outside_mass`.
//!
//! # Position and depth (G1, G6)
//!
//! A sweep of 200 steps from the entry (the crest end of the sliding range), plus the vertices of a polyline surface, of
//! the ground and of the regions, the edges of the `udl` and the vertices of the piezometric line inside that range
//! (E15l-3, E15m-4), looks for the first `x` with
//! `ground(x) − base(x) ≥ d(x)`, and a bisection of 60 steps refines it. A depth that is only reached at the exit end
//! is not reached. The automatic `d(x)` is `max(0, 2c/(γ·tan(45° − φ/2)) − q/γ)` with `c`, `φ` and `γ` of the material
//! at `2e-5·scale` under the ground at `x` (1e-3 model units in the models of the rows, as the oracle), recomputed at
//! each `x`; `q` is the sum of the `udl` over `x` and `γw·(piezo − ground)` of the ponded water, written here and not
//! taken from `water.rs`. An automatic depth of 0 at the entry cuts nothing: `x_c` is the entry and the report has
//! `depth = 0`.
//!
//! E15n-1: `x_c` can sit on a discontinuity (a vertical step of the ground, an edge of a `udl`, a change of material).
//! The ground, `d(x)` (material, `udl`), the face and the cut are then evaluated on **one side**, the one of the mass
//! (`x_c + s·0⁺`, `s` from the crack toward the toe; `PreparedModel::top_toward` and `column_toward`), so that the result
//! is the same in a model and in its mirror image and `face_height` is the face that the mass meets, not the crest that
//! the crack discards.
//!
//! # Force of the water (G3, G4, E7)
//!
//! `Pw = ½·γw·hw²`, `hw = d·water_fill`, horizontal and **in the sliding direction**: in the model frame
//! `H_x = s·Pw` (`s = +1` for `LeftToRight`), and in the sliding direction, which is what `Slice::h_force` holds,
//! `H = Pw`. It acts at `y_g = base(x_c) + hw/3`, on the slice adjacent to the face (the last one of the mass with weight above 0, E15l-8). For
//! that slice, with `(xm, ym)` the midpoint of its base: `h_force += Pw`, `h_moment_base += Pw·(y_g − ym)` (Spencer,
//! M-P) and `driving_extra += Pw·(yc − y_g)/R` (Bishop, circle); Janbu uses only the force. It does not change the
//! pore pressure of the base, it has no weight and the face has no strength (G4); no seismic force acts on it (E7).
//! `γw` is the one of the model (`water.unit_weight`, or the default; E12e). It needs no piezometric line.
//!
//! # E15h
//!
//! No new field in `Slice`: the force and its moments go to `weight_extra` (nothing), `h_force`, `h_moment_base` and
//! `driving_extra`. See `docs/fase3/g0/NOTAS.md`.

use crate::geometry::{PreparedModel, Sliding};
use crate::loads::LoadCase;
use crate::model::{CrackDepth, TensionCrack};
use crate::report::CrackReport;
use crate::slicer::Slice;
use crate::strength;
use crate::surface::Surface;

/// Reason of the invalid surface when it does not get to the depth of the crack (G1). It is the stable code that the
/// message of `NoValidSurface` starts with.
pub const TENSION_CRACK_NOT_REACHED: &str = "tension_crack_not_reached";

/// Steps of the sweep of G1 (the bisection refines the first step that reaches the depth).
const SWEEP_STEPS: usize = 200;
/// Iterations of the bisection of G1: the interval shrinks to `2⁻⁶⁰` of a step, far under the tolerance.
const BISECTION_ITERATIONS: usize = 60;
/// Distance under the ground, relative to the model scale, of the point whose material gives `c`, `φ` and `γ` of the
/// automatic depth (G6). The oracle takes 1e-3 model units; `2e-5·scale` is that distance in the models of the rows
/// (scale 50) and does not depend on the unit. With `1e-3·scale` (0.05 m there) the depth under a gradient of `Su`
/// moves by 0.6 % (X21-A04).
const PROBE_FRACTION: f64 = 2e-5;

/// Why a surface has no crack mass.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CrackError {
    /// `ground(x) − base(x) < d(x)` everywhere along the surface (G1, G8: no cap by the height of the slope).
    NotReached,
    /// The surface does not cut the ground, so it has no sliding range to look for the crack in. The slicer reports
    /// the real reason; `lib.rs` goes on without a plan.
    NoGround,
}

/// Where the crack of a surface is (result of [`locate`]).
#[derive(Debug, Clone, PartialEq)]
pub struct CrackPlan {
    /// `x_c`: first point from the entry, on the crest side, where `ground(x) − base(x) ≥ d(x)` (G1). Sweep of 200
    /// steps and a bisection down to the tolerance `tol` of the model. When the automatic depth is 0 at the entry
    /// (nothing to cut), `x_c` is the entry itself and nothing is truncated.
    pub x_c: f64,
    /// Depth that applies: the fixed one, **always** (E15m-1), or the automatic one `d(x_c)` at `x_c` (G6, G7). E15m-15:
    /// also where the bisection ends on a jump of `d(x)` (a `udl` edge, a step of the ground, a change of material),
    /// which is the convention of cSlope; the face that the crack cuts there goes to `CrackReport::face_height`. With
    /// `0` the mass is cut at `x_c` only if there is a face over the base there (see `breaks`).
    pub depth: f64,
    /// Extra nodes of the cut: a node at `x_c` (pass them to `LoadCase::with_extra_breaks`). The slicer of the
    /// cracked mass ends its span at `x_c`, so the node is the face itself; empty when nothing is cut: `x_c` is the
    /// entry, or the depth is 0 and the face over the base is not larger than `tol` (E15m-15).
    pub breaks: Vec<f64>,
    /// Water in the crack, `hw = depth·water_fill`, and `γw` of the model; `truncate` uses them for `Pw`.
    pub water_height: f64,
    pub gamma_w: f64,
}

/// Sense from the crack toward the sliding mass (the toe): `+1` for `LeftToRight`, `-1` for `RightToLeft` (E15n-1).
fn mass_side(pm: &PreparedModel) -> f64 {
    match pm.sliding {
        Sliding::LeftToRight => 1.0,
        Sliding::RightToLeft => -1.0,
    }
}

/// Depth of the crack at `x` (G6 for `Auto`), with the buffers of the column reused between calls.
struct DepthAt<'a> {
    /// Side of the mass (E15n-1): `+1` toward `+x`, `-1` toward `-x`. The ground, the material and the loads of `d(x)` are
    /// those of that side of `x`.
    side: f64,
    spec: &'a TensionCrack,
    pm: &'a PreparedModel,
    loads: &'a LoadCase,
    column: Vec<(f64, f64, usize)>,
    scratch: Vec<f64>,
}

impl DepthAt<'_> {
    fn at(&mut self, x: f64) -> f64 {
        match self.spec.depth {
            CrackDepth::Fixed(d) => d,
            CrackDepth::Auto => self.rankine(x),
        }
    }

    /// `z(x) = max(0, 2c/(γ·tan(45° − φ/2)) − q/γ)` with the material under the ground at `x` (G6).
    ///
    /// E15l-1: `x` is bounded to `[x_min + tol, x_max − tol]`, so that the model edge gives the column next to it and
    /// not an empty one (`PreparedModel::column` is half-open). The rest of the model is not touched.
    fn rankine(&mut self, x: f64) -> f64 {
        let pm = self.pm;
        let tol = pm.tol();
        let x = if pm.x_max - pm.x_min > 2.0 * tol {
            x.clamp(pm.x_min + tol, pm.x_max - tol)
        } else {
            x
        };
        // E15n-1: the ground, the column and the `udl` of the side of the mass, never a mix of the closed envelope with
        // the half-open column (which differ at a vertical step, and are not mirror images of each other).
        let side = self.side;
        let Some(ground) = pm.top_toward(x, side) else {
            return 0.0;
        };
        let y = ground - PROBE_FRACTION * pm.scale;
        pm.column_toward(x, side, &mut self.column, &mut self.scratch);
        let Some(&(_, _, mat)) = self.column.iter().find(|&&(lo, hi, _)| lo <= y && y < hi) else {
            return 0.0;
        };
        let m = &pm.materials[mat];
        let gamma = m.unit_weight;
        let (c, tan_phi) = strength::resolve(m, y);
        if !(c > 0.0 && gamma > 0.0) {
            return 0.0;
        }
        // q: the `udl` that cover x, and the ponded water over the ground at x.
        let mut q: f64 = self
            .loads
            .udls
            .iter()
            .filter(|u| {
                if side >= 0.0 {
                    u.x1 <= x && x < u.x2
                } else {
                    u.x1 < x && x <= u.x2
                }
            })
            .map(|u| u.q)
            .sum();
        // E15l-8: the water counts over the ground only beyond the tolerance of the model (E15j-4), as in `water.rs`.
        if let Some(w) = pm.piezometric_y(x)
            && w > ground + pm.tol()
        {
            q += pm.gamma_w * (w - ground);
        }
        let phi = tan_phi.atan();
        let z = 2.0 * c / (gamma * (std::f64::consts::FRAC_PI_4 - 0.5 * phi).tan()) - q / gamma;
        z.max(0.0)
    }
}

/// The abscissae of the sweep of G1, from the entry (excluded) to the exit (included), in that order: the uniform grid
/// of [`SWEEP_STEPS`] steps plus (E15l-3) the abscissae inside the sliding range where `ground − base − d` can have a
/// narrow peak that the grid steps over: the vertices of a polyline surface, the vertices of the regions (the ground),
/// the edges of the `udl` and (E15m-4) the vertices of the piezometric line.
fn sweep_abscissae(
    pm: &PreparedModel,
    surface: &Surface,
    loads: &LoadCase,
    x_entry: f64,
    x_exit: f64,
) -> Vec<f64> {
    let (lo, hi) = (x_entry.min(x_exit), x_entry.max(x_exit));
    let tol = pm.tol();
    let mut extra: Vec<f64> = Vec::new();
    if let Surface::Polyline(line) = surface {
        extra.extend(line.points.iter().map(|p| p[0]));
    }
    extra.extend(pm.vertex_xs.iter().copied());
    extra.extend(loads.udls.iter().flat_map(|u| [u.x1, u.x2]));
    // E15m-4: the vertices of the piezometric line, where the ponded water (and so `d(x)`) has a corner.
    if let Some(line) = &pm.piezometric {
        extra.extend(line.iter().map(|p| p[0]));
    }
    extra.retain(|&x| x > lo + tol && x < hi - tol);
    // Distance from the entry, the order of the sweep.
    let mut all: Vec<f64> = (1..=SWEEP_STEPS)
        .map(|k| (x_exit - x_entry) * (k as f64) / (SWEEP_STEPS as f64))
        .chain(extra.into_iter().map(|x| x - x_entry))
        .map(f64::abs)
        .collect();
    all.sort_by(f64::total_cmp);
    all.dedup_by(|a, b| (*a - *b).abs() <= tol);
    let sign = if x_exit >= x_entry { 1.0 } else { -1.0 };
    all.into_iter().map(|d| x_entry + sign * d).collect()
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
/// Returns the plan, `NotReached` if the surface never gets to the depth, or `NoGround` if it has no sliding range.
pub fn locate(
    spec: &TensionCrack,
    pm: &PreparedModel,
    surface: &Surface,
    loads: &LoadCase,
) -> Result<CrackPlan, CrackError> {
    let tramo = surface
        .ground_crossings(pm)
        .map_err(|_| CrackError::NoGround)?;
    // The entry is the end on the crest side: the right one when the mass slides toward -x.
    let (x_entry, x_exit) = match pm.sliding {
        Sliding::RightToLeft => (tramo.q, tramo.p),
        Sliding::LeftToRight => (tramo.p, tramo.q),
    };
    // E15n-1: the side of the mass, from the crack toward the toe. The ground, `d(x)`, the face and the cut are all
    // evaluated on that side of `x_c`, so that a vertical step (or an edge of a `udl`, or a change of material) at
    // `x_c` gives the same in a model and in its mirror image.
    let inward = mass_side(pm);
    let mut depth = DepthAt {
        side: inward,
        spec,
        pm,
        loads,
        column: Vec::with_capacity(8),
        scratch: Vec::with_capacity(8),
    };
    // `cut`: whether the mass ends at `x_c`. A crack with depth cuts; a depth of 0 cuts only if there is a face (E15m-15).
    let finish = |x_c: f64, d: f64, cut: bool| {
        let water_height = d * spec.water_fill;
        CrackPlan {
            x_c,
            depth: d,
            breaks: if cut { vec![x_c] } else { Vec::new() },
            water_height,
            gamma_w: pm.gamma_w,
        }
    };
    // An automatic depth of 0 at the entry (no cohesion, or a surcharge that cancels it): nothing to cut.
    // E15m-5: evaluated at `x_entry + s·tol`, with `s` the sense toward the mass, so that a `udl` that only touches the
    // entry from outside (its closed end at `x_entry`) does not cancel the crack.
    if matches!(spec.depth, CrackDepth::Auto) && depth.at(x_entry + inward * pm.tol()) <= 0.0 {
        return Ok(finish(x_entry, 0.0, false));
    }
    let below = |depth: &mut DepthAt, x: f64| -> f64 {
        match pm.top_toward(x, inward) {
            Some(ground) => ground - surface.y_at(pm, x) - depth.at(x),
            None => f64::NEG_INFINITY,
        }
    };
    let mut prev = x_entry;
    for x in sweep_abscissae(pm, surface, loads, x_entry, x_exit) {
        if below(&mut depth, x) >= 0.0 {
            let (mut lo, mut hi) = (prev, x);
            for _ in 0..BISECTION_ITERATIONS {
                let mid = 0.5 * (lo + hi);
                if below(&mut depth, mid) >= 0.0 {
                    hi = mid;
                } else {
                    lo = mid;
                }
            }
            // A surface that only reaches the depth at its exit end has no mass.
            if (hi - x_exit).abs() <= pm.tol() {
                return Err(CrackError::NotReached);
            }
            // E15m-15 (revises E15l-2): the depth and the water are `d(x_c)` at the `x_c` of the bisection, for `auto` and
            // for a fixed depth (the one of the user, E15m-1), as cSlope does. Across a discontinuity of `d(x)` the face
            // that the crack cuts is not `d`; `truncate` says it in `face_height`.
            let d = depth.at(hi);
            // The mass ends at `x_c` with a depth of 0 too, when the discontinuity leaves a face over the base (the cut
            // of cSlope, and of the versions before R12: `a04_udl`, 1.102248). If that face is not larger than the
            // tolerance (a `udl` that starts 1e-10 inside the entry) nothing is cut (E15l-2, which stays).
            let face = pm
                .top_toward(hi, inward)
                .map_or(0.0, |g| g - surface.y_at(pm, hi));
            return Ok(finish(hi, d, d > 0.0 || face > pm.tol()));
        }
        prev = x;
    }
    Err(CrackError::NotReached)
}

/// G2 and G3: truncates the slices of the crack and adds the force of its water.
///
/// - `plan`: the result of [`locate`] for the same `surface`;
/// - `pm`, `surface`: as in [`locate`] (a circle gives `(yc, R)` for `driving_extra`, a polyline gives none);
/// - `slices`: the slices of the surface, toe first, **before** any force of the ponded water or of the
///   reinforcements. They are modified: every slice on the crest side of `x_c` is removed (none, when the slicer
///   already ended the mass there), and the slice adjacent to the face receives `Pw` (see the module).
///
/// It returns the entry of the report (`x = x_c`, `depth`, `water_force = Pw`; 0 for a dry crack). A reinforcement
/// crossing on the crest side of `x_c` then finds no slice and gets `reinforcement_outside_mass` (it is applied after
/// this call).
pub fn truncate(
    plan: &CrackPlan,
    pm: &PreparedModel,
    surface: &Surface,
    slices: &mut Vec<Slice>,
) -> CrackReport {
    let tol = pm.tol();
    // G2: nothing on the crest side of the face stays, and its weight is not kept as a load.
    if !plan.breaks.is_empty() {
        match pm.sliding {
            Sliding::RightToLeft => slices.retain(|s| s.x_right <= plan.x_c + tol),
            Sliding::LeftToRight => slices.retain(|s| s.x_left >= plan.x_c - tol),
        }
    }
    let hw = plan.water_height;
    let mut water_force = 0.0;
    // E15l-8: the slice of the face is the last one with soil (weight above 0), never an air slice.
    if hw > 0.0
        && let Some(face) = slices.iter_mut().rev().find(|s| s.weight > 0.0)
    {
        // G3: horizontal, in the sliding direction, at hw/3 over the base of the crack, on the slice of the face.
        water_force = 0.5 * plan.gamma_w * hw * hw;
        let y_g = surface.y_at(pm, plan.x_c) + hw / 3.0;
        let y_mid = 0.5 * (face.y_base_left + face.y_base_right);
        face.h_force += water_force;
        face.h_moment_base += water_force * (y_g - y_mid);
        if let Some((yc, r)) = surface.moment_arm() {
            face.driving_extra += water_force * (yc - y_g) / r;
        }
    }
    // E15m-15, E15n-1: the face that the crack cuts, `ground(x_c) − base(x_c)` with the ground on the side of the mass
    // (`x_c + s·0⁺`, `s` toward the toe, the one that `locate` used); reported only when it is not the depth.
    let face_height = pm
        .top_toward(plan.x_c, mass_side(pm))
        .map(|g| g - surface.y_at(pm, plan.x_c))
        .filter(|face| face.is_finite() && (face - plan.depth).abs() > tol);
    CrackReport {
        x: plan.x_c,
        depth: plan.depth,
        water_force,
        face_height,
    }
}
