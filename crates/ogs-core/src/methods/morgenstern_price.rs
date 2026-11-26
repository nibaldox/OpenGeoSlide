//! Morgenstern-Price method (E13d), the general form of Spencer's scheme (`spencer.rs`).
//!
//! The interslice shear is `X_k = λ·f(ξ_k)·E_k`, with `ξ = (x − x₀)/(x₁ − x₀)` the position along the analysed block
//! (E11): `x₀` is the toe end of the first slice and `x₁` the crest end of the last one. Slices run toe → crest in every
//! sliding direction, so `ξ` grows toward the crest and the mirror image of a model has the same factor of safety.
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

/// Values of `f` on the `n + 1` faces of the block (`faces[k]` is the face below slice `k`, `faces[n]` the crest
/// face), in the toe → crest order of the slices (E13d). `ξ` is the cumulative width over the total width, with
/// `ξ = 0` at the toe face and `ξ = 1` at the crest face exactly. Along an air run (E7a) the value is frozen at the
/// face on the toe side of the run.
pub fn interslice_faces(
    slices: &[Slice],
    function: IntersliceFunction,
    points: Option<&[Point]>,
) -> Vec<f64> {
    let n = slices.len();
    let total: f64 = slices.iter().map(|s| s.width).sum();
    let mut faces = Vec::with_capacity(n + 1);
    faces.push(interslice_value(function, points, 0.0));
    let mut cumulative = 0.0_f64;
    for (k, s) in slices.iter().enumerate() {
        cumulative += s.width;
        let value = if is_inert(s) {
            faces[k]
        } else {
            let xi = if k + 1 == n {
                1.0
            } else {
                (cumulative / total).clamp(0.0, 1.0)
            };
            interslice_value(function, points, xi)
        };
        faces.push(value);
    }
    faces
}

/// Morgenstern-Price solver on the slices of a block. `spec` is `analysis.interslice`; without it the function is
/// `half_sine` (E13d). On a polyline (`opts.circular == false`) the F scan starts from Janbu's F₀ (E13f).
pub(super) fn solve(
    slices: &[Slice],
    opts: &SolveOptions,
    spec: Option<&IntersliceSpec>,
) -> MethodResult {
    let (function, points) = match spec {
        Some(s) => (s.function, s.points.as_deref()),
        None => (IntersliceFunction::HalfSine, None),
    };
    let faces = interslice_faces(slices, function, points);
    spencer::solve_with_faces(MethodKind::MorgensternPrice, slices, opts, Some(&faces))
}
