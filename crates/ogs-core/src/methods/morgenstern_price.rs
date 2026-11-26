//! Morgenstern-Price method (E13d), the general form of Spencer's scheme (`spencer.rs`).
//!
//! The interslice shear is `X_k = λ·f(ξ_k)·E_k`, with `ξ = (x − x₀)/(x₁ − x₀)` the position along the analysed block
//! (E11) **in the x of the model**: `x₀` is the left end of the block (`x_left` of its first slice in x order) and `x₁` the
//! right end, as in cSlope (`solvers.rs`: `x0 = slices[0].x_left`, `x1 = slices[last].x_right`, with the slices in x
//! order). The solver marches toe → crest, so with a slide toward −x (`right_to_left`) `ξ` grows toward the crest, and
//! with a slide toward +x it decreases toward the crest. Checked against the oracle in both directions: an asymmetric
//! `data_points` function gives different FS in the two directions (cSlope 0.98443 and 0.98379 on V047a), so the mirror
//! image of a model has the same FS only for a function symmetric in ξ (the four named ones are).
//! The five functions are the exact definitions of cSlope (`math/helpers.rs`), with `f = 0` outside `[0, 1]`:
//!
//! | function | f(ξ) |
//! |---|---|
//! | `constant` | 1 |
//! | `half_sine` | sin(π ξ) |
//! | `clipped_sine` | max(0.35, sin(π ξ)) |
//! | `trapezoidal` | ξ/0.2 on [0, 0.2], 1 on [0.2, 0.8], (1 − ξ)/0.2 on [0.8, 1] |
//! | `data_points` | piecewise linear over `points` |
//!
//! Along an air run (E7a) `f` is frozen at the value of the face on the toe side of the run, so an air slice passes `E`
//! and `X` unchanged, as in Spencer.
//!
//! With the shear `X` in place of `λE`, the force closure of a slice reads `E_{k+1} D_r = E_k D_l + q`, with
//! `D = (sin α − λ f cos α) tan φ + (cos α + λ f sin α) F` on the right (`D_r`) and left (`D_l`) face of the slice,
//! and the moment residual is `ρ(λ) = Σ b [(E_k + E_{k+1}) tan α − (X_k + X_{k+1})] − 2·Σ h_moment_base`
//! (the thrust line on the base, Zhu et al. 2005). The scheme (scan of `λ·f̄ ∈ [−0.5; 1.5]` with step `0.05/f̄`, Brent,
//! the guards E4b, E7c, E9c with `λ f` in `Φ_i`, and the root of smallest F of E12e) is the one of `spencer.rs`, which
//! implements it once for both methods: with `f ≡ 1` every product by `f` is exact and Spencer is reproduced bit for
//! bit. The note `multiple_admissible_roots` and the status `no_lambda_root` / `no_admissible_root` are the same.
//!
//! The values `f` of the faces are computed here ([`interslice_faces`]); the solver is `spencer::solve_with_faces`.

use super::{MethodResult, SolveOptions, is_inert, spencer};
use crate::model::{IntersliceFunction, IntersliceSpec, MethodKind, Point};
use crate::slicer::Slice;

/// Lower value of `clipped_sine`.
const CLIPPED_SINE_FLOOR: f64 = 0.35;
/// Ramp of `trapezoidal`: it rises on `[0, 0.2]` and falls on `[0.8, 1]`.
const TRAPEZOID_RAMP: f64 = 0.2;

/// The interslice function `f(ξ)` (E13d). `0` outside `[0, 1]` and for a NaN. `points` is `[[ξ, f], …]`, used only by
/// `data_points` (validated: at least 2 points, `ξ` strictly increasing from 0 to 1, `f ≥ 0`); without them
/// `data_points` falls back to the half sine, as cSlope does.
pub fn interslice_value(function: IntersliceFunction, points: Option<&[Point]>, xi: f64) -> f64 {
    if !(0.0..=1.0).contains(&xi) {
        return 0.0;
    }
    let half_sine = (std::f64::consts::PI * xi).sin();
    match function {
        IntersliceFunction::Constant => 1.0,
        IntersliceFunction::HalfSine => half_sine,
        IntersliceFunction::ClippedSine => half_sine.max(CLIPPED_SINE_FLOOR),
        IntersliceFunction::Trapezoidal => {
            if xi < TRAPEZOID_RAMP {
                xi / TRAPEZOID_RAMP
            } else if xi <= 1.0 - TRAPEZOID_RAMP {
                1.0
            } else {
                (1.0 - xi) / TRAPEZOID_RAMP
            }
        }
        IntersliceFunction::DataPoints => match points {
            Some(p) if p.len() >= 2 => piecewise_linear(p, xi),
            _ => half_sine,
        },
    }
}

/// Linear interpolation over points sorted by `ξ`; the end values hold outside their range.
fn piecewise_linear(points: &[Point], xi: f64) -> f64 {
    let (first, last) = (points[0], points[points.len() - 1]);
    if xi <= first[0] {
        return first[1];
    }
    if xi >= last[0] {
        return last[1];
    }
    // The first point whose ξ is above `xi` closes the segment (`xi` is strictly inside the range here).
    let hi = points.partition_point(|p| p[0] <= xi);
    let (a, b) = (points[hi - 1], points[hi]);
    a[1] + (b[1] - a[1]) * (xi - a[0]) / (b[0] - a[0])
}

/// Values of `f` on the `n + 1` faces of the block (`faces[k]` is the face below slice `k` in the toe → crest order of
/// the slices, `faces[n]` the crest face) (E13d). `ξ` is the position of the face over the block in the x of the model
/// (cumulative width over the total width from the left end), so it grows toward the crest when the slide goes toward
/// −x and decreases toward it otherwise; the left end of the block is exactly `ξ = 0` and the right end exactly
/// `ξ = 1`. Along an air run (E7a) the value is frozen at the face on the toe side of the run (the upstream face of the
/// march), so an air slice passes `E` and `X` unchanged.
pub fn interslice_faces(
    slices: &[Slice],
    function: IntersliceFunction,
    points: Option<&[Point]>,
) -> Vec<f64> {
    let n = slices.len();
    // The domain of ξ is the **soil block**: the aerial slices at the ends of the arc (E7a: a circle that grazes the
    // ground near the toe keeps them) are no part of the sliding mass, and cSlope, which has none, measures `x₀` and
    // `x₁` on the soil (D09 half sine ran +3.39 % over it with the aerial slices in the domain). Runs of inert slices at
    // the two ends hold `ξ = 0` (toe side) and `ξ = 1` (crest side); inside the block the cumulative width starts at
    // the first soil slice. Without aerial ends this is exactly the former computation.
    let lead = slices.iter().take_while(|s| is_inert(s)).count();
    let trail = if lead == n {
        0
    } else {
        slices.iter().rev().take_while(|s| is_inert(s)).count()
    };
    let (first, end) = (lead, n - trail);
    let total: f64 = slices[first..end].iter().map(|s| s.width).sum();
    // The slices come toe first: a slide toward +x lists them from the right.
    let descending = n > 1 && slices[0].x_left > slices[n - 1].x_left;
    let xi_at = |k: usize, cumulative: f64| {
        let from_toe = if k <= first {
            0.0
        } else if k >= end {
            1.0
        } else {
            (cumulative / total).clamp(0.0, 1.0)
        };
        if descending { 1.0 - from_toe } else { from_toe }
    };
    let mut faces = Vec::with_capacity(n + 1);
    faces.push(interslice_value(function, points, xi_at(0, 0.0)));
    let mut cumulative = 0.0_f64;
    for (k, s) in slices.iter().enumerate() {
        if k >= first {
            cumulative += s.width;
        }
        let value = if is_inert(s) {
            faces[k]
        } else {
            interslice_value(function, points, xi_at(k + 1, cumulative))
        };
        faces.push(value);
    }
    faces
}

/// Scale `s` of the interslice function (E13l-4): the largest `f` of `data_points`, and `1` for the four named functions
/// (whose maximum is 1) and for a `data_points` whose maximum is 1, a non-finite one or one that is not positive.
/// The solver works with `f/s`, so that `max f = 1` and the scan of λ does not depend on the units of `f`.
fn function_scale(function: IntersliceFunction, points: Option<&[Point]>) -> f64 {
    match (function, points) {
        (IntersliceFunction::DataPoints, Some(p)) if p.len() >= 2 => {
            let max = p.iter().fold(0.0_f64, |m, q| m.max(q[1]));
            if max.is_finite() && max > 0.0 {
                max
            } else {
                1.0
            }
        }
        _ => 1.0,
    }
}

/// Morgenstern-Price solver on the slices of a block. `spec` is `analysis.interslice`; without it the function is
/// `half_sine` (E13d). On a polyline (`opts.circular == false`) the F scan starts from Janbu's F₀ (E13f).
///
/// **Normalization (E13l-4).** With `data_points` of maximum `s ≠ 1` the solver runs on `f/s` and the scan finds
/// `λ_n = λ·s`; the result reports `λ = λ_n/s`, in the scale of the user's function (`X = λ·f·E = λ_n·(f/s)·E`). The
/// factor of safety does not depend on `s`. A `λ` that does not fit in an `f64` (`s` below 1e-300, where
/// `λ = λ_n/s` overflows) is not reported (`None`). The named functions have `s = 1` and run unchanged, bit for bit.
pub(super) fn solve(
    slices: &[Slice],
    opts: &SolveOptions,
    spec: Option<&IntersliceSpec>,
) -> MethodResult {
    let (function, points) = match spec {
        Some(s) => (s.function, s.points.as_deref()),
        None => (IntersliceFunction::HalfSine, None),
    };
    // E13l-4: only `data_points` can concentrate `f` on a few faces; the named functions keep the old λ grid.
    let fine = function == IntersliceFunction::DataPoints && points.is_some();
    let scale = function_scale(function, points);
    if scale == 1.0 {
        let faces = interslice_faces(slices, function, points);
        return spencer::solve_with_faces(
            MethodKind::MorgensternPrice,
            slices,
            opts,
            Some(&faces),
            fine,
        );
    }
    let normalized: Vec<Point> = points
        .unwrap_or(&[])
        .iter()
        .map(|p| [p[0], p[1] / scale])
        .collect();
    let faces = interslice_faces(slices, function, Some(&normalized));
    let mut result = spencer::solve_with_faces(
        MethodKind::MorgensternPrice,
        slices,
        opts,
        Some(&faces),
        fine,
    );
    result.lambda = result.lambda.map(|l| l / scale).filter(|l| l.is_finite());
    result
}
