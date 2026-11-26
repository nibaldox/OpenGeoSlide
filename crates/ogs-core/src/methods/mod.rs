//! Limit-equilibrium solvers: simplified Bishop (§4.2), Spencer, i.e. Morgenstern-Price with f = 1 (§4.3), Morgenstern-Price
//! with the interslice functions of E13d, and Janbu simplified and corrected (E13e).

mod bishop;
mod janbu;
pub mod morgenstern_price;
pub mod spencer;

use std::borrow::Cow;

use serde::{Deserialize, Serialize};

use crate::geometry::PreparedModel;
use crate::model::{self, IntersliceSpec, MethodKind};
use crate::slicer::{FaceStrength, Slice, interslice_face_strength};

/// Relative driving threshold of amendment E3: `Σ W·sin α ≤ 1e-6 · Σ W` means no driving moment.
const NO_DRIVING_FRACTION: f64 = 1e-6;

/// Pole of the Bishop factor (§4.2): `m_α ≤ 1e-9` in a soil slice.
pub(crate) const M_ALPHA_POLE: f64 = 1e-9;

/// Relative trigger of the negative-normal warning (E4e): `N' < −1e-6 · Σ W`.
const NEGATIVE_NORMAL_FRACTION: f64 = 1e-6;

/// Share of the weight carried by negative normal forces above which the warning is major (E7d, calibrated
/// by E8c). Like the 0.02 it replaces, it classifies the warning; it is not a numerical tolerance.
const NEGATIVE_NORMAL_MAJOR_FRACTION: f64 = 0.05;

/// Share of the soil base length with `N' < 0` above which the warning is major (E11f, review R3-06). It is an
/// alternative to the weight share: a negative normal force over a large part of the base is major even when its
/// weight share is small (for example, a hydraulic uplift that leaves most of the base in tension).
const NEGATIVE_NORMAL_LENGTH_FRACTION: f64 = 0.25;

/// Relative threshold of the air-gap warning (E7a): `|E_gap| > 1e-3 · Σ W`.
const AIR_GAP_FRACTION: f64 = 1e-3;

/// Informative note: negative effective normal force of minor extent (E5, E7d).
pub(crate) const NEGATIVE_NORMAL_MESSAGE: &str = "negative_effective_normal";
/// Warning: negative effective normal force over a major part of the base (E7d).
pub(crate) const NEGATIVE_NORMAL_MAJOR_MESSAGE: &str = "negative_effective_normal_major";
/// Warning: an interior air run transmits thrust (E7a).
pub(crate) const AIR_GAP_MESSAGE: &str = "air_gap_thrust";

/// Warning: the interslice shear exceeds the strength of the vertical faces, `r_v > 3` (E13k).
pub(crate) const INTERSLICE_SHEAR_MESSAGE: &str = "interslice_shear_exceeds_strength";

/// Classification threshold of `interslice_shear_exceeds_strength` (E13k): the warning is raised when `r_v` is above
/// it. Calibrated, like E8c, between the largest `r_v` of the reference cases (1.63, D13) and the smallest of the
/// inadmissible solutions of D-1 (3.88); it classifies a warning, it is not a numerical tolerance.
pub(crate) const INTERSLICE_SHEAR_LIMIT: f64 = 3.0;

/// Faces with `|E|` below this share of the largest `|E|` are not evaluated by `r_v` (E13k).
const INTERSLICE_FACE_MIN_FRACTION: f64 = 0.02;

/// An air slice (E2): no weight and no strength. It takes no part in the m_α test, nor in the
/// F sums of the solvers. Spencer still passes the normal force through it (E7a).
pub(crate) fn is_inert(s: &Slice) -> bool {
    s.weight == 0.0 && s.cohesion == 0.0 && s.tan_phi == 0.0
}

/// A slice that carries a passive reinforcement force (E14g): one of the four `passive_*` fields is not zero. A model
/// without reinforcements has none, and every method then runs the code that it ran before (E14a).
#[inline]
pub(crate) fn has_passive(s: &Slice) -> bool {
    s.passive_v != 0.0
        || s.passive_h != 0.0
        || s.passive_h_moment_base != 0.0
        || s.passive_driving_extra != 0.0
}

/// Whether any slice of the block carries a passive force (E14g).
pub(crate) fn any_passive(slices: &[Slice]) -> bool {
    slices.iter().any(has_passive)
}

/// The slice as the equilibrium sees it at the factor of safety `fos` (E14g, F4.7): each passive force enters in the
/// same terms as an active one of F4.6, **divided by `F`** (Duncan and Wright, method B):
///
/// `W* + passive_v/F`, `H + passive_h/F`, `h_moment_base + passive_h_moment_base/F` and
/// `driving_extra + passive_driving_extra/F`.
///
/// A slice with no passive force is returned as it is (borrowed), so that the arithmetic of a model without
/// reinforcements does not change by a bit.
pub(crate) fn at_fos(s: &Slice, fos: f64) -> Cow<'_, Slice> {
    if !has_passive(s) {
        return Cow::Borrowed(s);
    }
    Cow::Owned(Slice {
        weight_extra: s.weight_extra + s.passive_v / fos,
        h_force: s.h_force + s.passive_h / fos,
        h_moment_base: s.h_moment_base + s.passive_h_moment_base / fos,
        driving_extra: s.driving_extra + s.passive_driving_extra / fos,
        ..*s
    })
}

/// [`at_fos`] by value: the slice at the factor of safety `fos`, with the passive forces divided by `F` and added to
/// the active fields (the passive fields keep their value, which is the force **before** dividing).
pub fn slice_at_fos(s: &Slice, fos: f64) -> Slice {
    *at_fos(s, fos)
}

/// Bishop's `m_α = cos α + sin α · tan φ / F` (§4.2) of a slice at factor of safety `fos`.
pub(crate) fn m_alpha(s: &Slice, fos: f64) -> f64 {
    let (sin, cos) = s.alpha.sin_cos();
    cos + sin * s.tan_phi / fos
}

/// Effective normal force of a slice (E4e), from the vertical equilibrium
/// `N cos α + S sin α = W* − ΔX` with `S = (c·l + N'·tan φ)/F`, `N = N' + u·l`, `l = b·sec α`:
///
/// `N' = (W* − ΔX − u·b − c·l·sin α / F) / m_α`.
///
/// `W* = W·(1 + kv) + Q + V` is the vertical force of the slice (E12b; it is `W` without seismic force or loads).
/// The horizontal force `H` does not appear in the vertical equilibrium: in Bishop it enters only the moment, and in
/// Spencer it acts through `ΔX = λ·ΔE`. `delta_x` is the net interslice shear `X_right − X_left`; Bishop has `ΔX = 0`.
/// A passive reinforcement force (E14g) enters `W*` divided by `fos`.
pub fn effective_normal(s: &Slice, fos: f64, delta_x: f64) -> f64 {
    // E14g: a passive force enters `W*` divided by `F`.
    let s = &*at_fos(s, fos);
    (s.total_weight()
        - delta_x
        - s.pore_pressure * s.width
        - s.cohesion * s.base_length * s.alpha.sin() / fos)
        / m_alpha(s, fos)
}

/// Classification of the negative effective normal forces (E4e, E7d). `normal(k, s)` gives the normal
/// force of slice `k`; air slices are not classified.
///
/// Returns `None` when no soil slice has `N' < −1e-6·ΣW`. Otherwise, with `f = Σ_{N'<0} |N'| / ΣW` (`ΣW` is the force
/// scale of E13j-6 limited by the driving scale (E13l-3, [`spencer::force_scale`]), which is the soil weight when there are no loads) and
/// `λ_neg = Σ_{N'<0} b / Σ_soil b` (share of the soil base length): `negative_effective_normal` (note) if
/// `f ≤ 0.05` **and** `λ_neg ≤ 0.25`; `negative_effective_normal_major` (warning) otherwise (E8c, E11f).
pub(crate) fn negative_normal_message(
    slices: &[Slice],
    normal: impl Fn(usize, &Slice) -> f64,
) -> Option<&'static str> {
    // E13j-6, E13l-3: the scale is `spencer::force_scale`, as in the closure of the solvers. With a nearly weightless soil under loads
    // (V018: ΣW = 6.3e-5, ΣW* = 1.5e3) the normal forces come from the loads, and over ΣW alone `f` is 1.6e4.
    let total_w: f64 = spencer::force_scale(slices);
    let floor = -NEGATIVE_NORMAL_FRACTION * total_w;
    let mut triggered = false;
    let mut negative_sum = 0.0_f64;
    let mut soil_length = 0.0_f64;
    let mut negative_length = 0.0_f64;
    // E14n-1: the thin slice of a reinforcement crossing, with the slice before and the one after it (the three that
    // came from the same slice before the nodes of the crossing), is one slice: its `N'` is the sum of theirs. Without
    // a crossing every range is one slice and the loop is the plain one, term by term.
    for (start, end) in classification_ranges(slices) {
        let (mut n, mut length, mut any) = (0.0_f64, 0.0_f64, false);
        for (j, s) in slices.iter().enumerate().take(end).skip(start) {
            if is_inert(s) {
                continue;
            }
            n += normal(j, s);
            length += s.base_length;
            any = true;
        }
        if !any {
            continue;
        }
        soil_length += length;
        if n < floor {
            triggered = true;
        }
        if n < 0.0 {
            negative_sum += -n;
            negative_length += length;
        }
    }
    if !triggered {
        return None;
    }
    let share = if total_w > 0.0 {
        negative_sum / total_w
    } else {
        f64::INFINITY
    };
    let length_share = if soil_length > 0.0 {
        negative_length / soil_length
    } else {
        0.0
    };
    Some(
        if share > NEGATIVE_NORMAL_MAJOR_FRACTION || length_share > NEGATIVE_NORMAL_LENGTH_FRACTION
        {
            NEGATIVE_NORMAL_MAJOR_MESSAGE
        } else {
            NEGATIVE_NORMAL_MESSAGE
        },
    )
}

/// The ranges `[start, end)` of the slices that are classified as one (E14n-1). A slice without a reinforcement crossing
/// next to it is a range of its own. The thin slice of a crossing (`Slice::crossing`) is joined with the slice before it
/// and the one after it, which came from the same slice before the nodes `x_c ± 1e-6·width` were added; thin slices that
/// follow each other (two crossings together) are one run, with the slice before the first and the one after the last.
/// A slice belongs to one range only.
fn classification_ranges(slices: &[Slice]) -> Vec<(usize, usize)> {
    let n = slices.len();
    let mut ranges = Vec::with_capacity(n);
    let mut k = 0;
    while k < n {
        let start = k;
        let mut end = k;
        if !slices[end].crossing && slices.get(end + 1).is_some_and(|s| s.crossing) {
            end += 1; // the slice before the crossing
        }
        while end < n && slices[end].crossing {
            end += 1;
        }
        if end > start && end < n {
            end += 1; // the slice after the last crossing of the run
        }
        if end == start {
            end += 1;
        }
        ranges.push((start, end.min(n)));
        k = end.min(n);
    }
    ranges
}

/// Air-gap check (E7a): true when an interior run of air slices (soil on both sides) transmits
/// `|E| > 1e-3 · Σ W`. `e[k]` is the normal interslice force on the face below slice `k`, and it is
/// constant across the air run.
pub(crate) fn air_gap_thrust(slices: &[Slice], e: &[f64]) -> bool {
    let total_w: f64 = slices.iter().map(|s| s.weight).sum();
    let limit = AIR_GAP_FRACTION * total_w;
    let n = slices.len();
    let mut k = 0;
    while k < n {
        if !is_inert(&slices[k]) {
            k += 1;
            continue;
        }
        let start = k;
        while k < n && is_inert(&slices[k]) {
            k += 1;
        }
        // The run is `start..k`. It is interior when soil lies on both sides.
        if start > 0 && k < n && e[start].abs() > limit {
            return true;
        }
    }
    false
}

/// The notes of a converged state, in a fixed order: the air-gap warning first (the more severe one), then
/// the negative-normal class (E7a, E8d). A converged result carries them in `MethodResult.warnings`.
pub(crate) fn converged_notes(air: bool, normal: Option<&'static str>) -> Vec<&'static str> {
    let mut codes = Vec::with_capacity(2);
    if air {
        codes.push(AIR_GAP_MESSAGE);
    }
    codes.extend(normal);
    codes
}

/// `r_v` of E13k, the ratio of the interslice shear to the shear that the vertical faces can mobilize at the same F
/// (criterion of Chen and Morgenstern 1983, in the form (d) of Zhu, Lee and Jiang 2003):
///
/// `r_v = max_faces |X|·F / (c_v·h + max(E′, 0)·tan φ_v)`, with `X = λ·f·E` and `E′ = −E − P_w`
///
/// (compression is positive in `E′`, negative in `E`). `e[0..=n]` are the interslice normal forces at `(fos, lambda)`,
/// `faces[0..=n]` the values of the interslice function (all `1` in Spencer) and `strength(j)` the
/// [`FaceStrength`] of the face below slice `j`, for `1 ≤ j ≤ n − 1` (the first and the last faces, with `E = 0`, are
/// not evaluated).
///
/// Only faces with `|E| ≥ 2 %` of `max|E|` and `E′ > 0` count. A face **without strength** (`c_v·h + E′·tan φ_v = 0`,
/// as the material of Su = 0 of V021) is excluded: it has no capacity to compare with. Returns `0` when no face counts.
pub fn interslice_shear_ratio(
    e: &[f64],
    faces: &[f64],
    lambda: f64,
    fos: f64,
    strength: impl Fn(usize) -> FaceStrength,
) -> f64 {
    let e_max = e.iter().fold(0.0_f64, |a, v| a.max(v.abs()));
    let mut worst = 0.0_f64;
    for j in 1..e.len().saturating_sub(1) {
        if e[j].abs() < INTERSLICE_FACE_MIN_FRACTION * e_max {
            continue;
        }
        let face = strength(j);
        let effective = -e[j] - face.water_force;
        if effective <= 0.0 {
            continue;
        }
        let capacity = face.cohesion_force + effective * face.tan_phi;
        if capacity > 0.0 {
            worst = worst.max((lambda * faces[j] * e[j]).abs() * fos / capacity);
        }
    }
    worst
}

/// `r_v` (E13k) of a converged Spencer or Morgenstern-Price result on `slices`: the interslice forces at `(fos, lambda)`
/// and the strength of each face read on `pm`. `spec` is `analysis.interslice` (Morgenstern-Price only).
pub(crate) fn shear_ratio_of(
    pm: &PreparedModel,
    method: MethodKind,
    spec: Option<&IntersliceSpec>,
    slices: &[Slice],
    fos: f64,
    lambda: f64,
) -> f64 {
    let faces = match method {
        MethodKind::MorgensternPrice => {
            let (function, points) = match spec {
                Some(s) => (s.function, s.points.as_deref()),
                None => (model::IntersliceFunction::HalfSine, None),
            };
            morgenstern_price::interslice_faces(slices, function, points)
        }
        _ => vec![1.0; slices.len() + 1],
    };
    let e = spencer::interslice_forces(slices, &faces, fos, lambda);
    interslice_shear_ratio(&e, &faces, lambda, fos, |j| {
        interslice_face_strength(pm, &slices[j - 1], &slices[j])
    })
}

/// Amendment E3 (with E12b) on a **circle**: true when the surface has no driving moment
/// (`Σ [W*·sin α + M] ≤ 1e-6 · Σ W`, or non-finite). Without seismic force or loads this is
/// `Σ W·sin α ≤ 1e-6 · Σ W`. `M` is the moment of the horizontal forces about the centre, divided by the radius.
pub(crate) fn lacks_driving(slices: &[Slice]) -> bool {
    let total_w: f64 = slices.iter().map(|s| s.weight).sum();
    let driving: f64 = slices.iter().map(Slice::driving_term).sum();
    !(total_w.is_finite() && driving.is_finite()) || driving <= NO_DRIVING_FRACTION * total_w
}

/// Amendment E3 for the surface that is solved (E13l-2). On a circle it is [`lacks_driving`]. On a polyline there is no
/// centre, so `M = 0` and the horizontal force `H = kh·W + H^P` is missing from `Σ W*·sin α` (a horizontal or a
/// symmetric polyline under `kh` or a horizontal line load was rejected as `no_driving`, R10A-02). The sum is the one
/// of the force equilibrium of Spencer, Morgenstern-Price and Janbu, `Σ t`, with `t = W*·sin α + H·cos α` in the sense
/// of the slide. Without `H` the terms are the same bits as before.
pub(crate) fn lacks_driving_on(slices: &[Slice], circular: bool) -> bool {
    if circular {
        return lacks_driving(slices);
    }
    let total_w: f64 = slices.iter().map(|s| s.weight).sum();
    let driving: f64 = slices
        .iter()
        .map(|s| s.total_weight() * s.alpha.sin() + s.h_force * s.alpha.cos())
        .sum();
    !(total_w.is_finite() && driving.is_finite()) || driving <= NO_DRIVING_FRACTION * total_w
}

/// Lower bound of F where the passive forces do not lift the mass (E14o-3): the net vertical load at `F`,
/// `Σ W* + Σ passive_v / F` (E14g, downward), is positive iff `F > −Σ passive_v / Σ W*` when the passive forces point up
/// (`Σ passive_v < 0`) and the load `Σ W*` is positive. Below that bound the mass is lifted off its base and a root of
/// the closure of a method is an artefact of the `1/F` of the passive force at a small F, no equilibrium on the base (a
/// force of 2000 kN/m at 45° gave a Janbu root of 0.127 for a state of 3.08). Returns 0 without passive forces and
/// whenever there is no such bound, so the models without them do not change.
pub(crate) fn lift_bound(slices: &[Slice]) -> f64 {
    let (load, passive): (f64, f64) = slices.iter().fold((0.0, 0.0), |(w, p), s| {
        (w + s.total_weight(), p + s.passive_v)
    });
    if passive < 0.0 && load > 0.0 {
        -passive / load
    } else {
        0.0
    }
}

/// Solver tolerances, taken from `AnalysisSettings`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SolveOptions {
    /// Relative tolerance on FS.
    pub tolerance: f64,
    pub max_iterations: usize,
    /// Bishop: `m_α` below this value marks the solution as `Invalid`.
    pub min_m_alpha: f64,
    /// `true` when the slices come from a circle (E13f). On a polyline (`false`) Bishop is not admissible (`Invalid`)
    /// and Spencer / Morgenstern-Price start from Janbu's F₀ instead of Bishop's FS. Set by `lib.rs`.
    pub circular: bool,
}

/// Outcome of a solve.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SolveStatus {
    Converged,
    NotConverged,
    Invalid,
}

/// Result of one method on one surface.
///
/// `message` is the reason for the status and is set only for `Invalid` and `NotConverged` (E8d). `warnings`
/// are the notes of the state (for example `air_gap_thrust` or the negative-normal class); they can accompany a
/// `Converged` result.
#[derive(Debug, Clone, PartialEq)]
pub struct MethodResult {
    pub method: MethodKind,
    pub fos: f64,
    pub status: SolveStatus,
    pub iterations: usize,
    pub lambda: Option<f64>,
    pub message: Option<String>,
    pub warnings: Vec<String>,
    /// `f₀` of `janbu_corrected` (E13e); `None` for every other method.
    pub correction_factor: Option<f64>,
}

impl MethodResult {
    /// Builds a result with no warnings. `message` is the reason of an `Invalid` or `NotConverged` state.
    fn new(
        method: MethodKind,
        fos: f64,
        status: SolveStatus,
        iterations: usize,
        lambda: Option<f64>,
        message: Option<&str>,
    ) -> Self {
        Self {
            method,
            fos,
            status,
            iterations,
            lambda,
            message: message.map(str::to_owned),
            warnings: Vec::new(),
            correction_factor: None,
        }
    }

    /// Attaches the notes of a converged state (E8d).
    fn with_warnings(mut self, codes: impl IntoIterator<Item = &'static str>) -> Self {
        self.warnings.extend(codes.into_iter().map(str::to_owned));
        self
    }
}

/// Reason of a result that would be `converged` with a factor of safety that is not positive or not finite (E13l-1).
pub(crate) const NON_POSITIVE_FOS_MESSAGE: &str = "non_positive_fos";

/// Guard of E13l-1, for every method: no result is `converged` with an FS that is not finite and positive. It becomes
/// `NotConverged` with the reason `non_positive_fos`; no FS, no λ, no notes and no correction factor are reported with
/// it, because there is no solution to qualify (R10A-01 gave FS = −23.43 as `converged`).
pub(crate) fn guard_positive_fos(result: MethodResult) -> MethodResult {
    if result.status == SolveStatus::Converged && !(result.fos.is_finite() && result.fos > 0.0) {
        return MethodResult::new(
            result.method,
            f64::NAN,
            SolveStatus::NotConverged,
            result.iterations,
            None,
            Some(NON_POSITIVE_FOS_MESSAGE),
        );
    }
    result
}

/// Solves the slices with the given method; Morgenstern-Price uses its default function (`half_sine`). See
/// [`solve_with`].
pub fn solve(slices: &[Slice], method: MethodKind, opts: &SolveOptions) -> MethodResult {
    solve_with(slices, method, opts, None)
}

/// Solves the slices with the given method. `interslice` is `analysis.interslice` (E13d) and only
/// `morgenstern_price` reads it: without it the function is `half_sine`.
///
/// `slices` must be ordered toe → crest, with `alpha > 0` when the base rises toward the crest.
pub fn solve_with(
    slices: &[Slice],
    method: MethodKind,
    opts: &SolveOptions,
    interslice: Option<&IntersliceSpec>,
) -> MethodResult {
    guard_positive_fos(match method {
        MethodKind::Bishop => bishop::solve(slices, opts),
        MethodKind::Spencer => spencer::solve(slices, opts),
        MethodKind::MorgensternPrice => morgenstern_price::solve(slices, opts, interslice),
        MethodKind::JanbuSimplified => janbu::solve(slices, opts, false),
        MethodKind::JanbuCorrected => janbu::solve(slices, opts, true),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Two soil slices of weight 50 each (ΣW = 100). The first one gets normal force `−f·100`, so the share
    /// `Σ_{N'<0}|N'|/ΣW` is exactly `f`. Its base length is 1 out of 10, so the length share is 0.1 and E11f does not
    /// decide the class.
    fn class_at(f: f64) -> Option<&'static str> {
        let base = Slice {
            x_left: 0.0,
            x_right: 1.0,
            y_base_left: 0.0,
            y_base_right: 0.0,
            y_top_mid: 1.0,
            width: 1.0,
            alpha: 0.0,
            base_length: 1.0,
            weight: 50.0,
            cohesion: 1.0,
            tan_phi: 0.5,
            pore_pressure: 0.0,
            material: 0,
            ..crate::slicer::ZERO_SLICE
        };
        let long = Slice {
            base_length: 9.0,
            ..base
        };
        let s = vec![base, long];
        negative_normal_message(&s, |k, _| if k == 0 { -f * 100.0 } else { 10.0 })
    }

    /// Soil slices of weight 10 with base lengths `lengths`, and the normal forces `normals` (E11f).
    fn class_of(lengths: &[f64], normals: &[f64]) -> Option<&'static str> {
        let s: Vec<Slice> = lengths
            .iter()
            .map(|&l| Slice {
                x_left: 0.0,
                x_right: 1.0,
                y_base_left: 0.0,
                y_base_right: 0.0,
                y_top_mid: 1.0,
                width: 1.0,
                alpha: 0.0,
                base_length: l,
                weight: 10.0,
                cohesion: 1.0,
                tan_phi: 0.5,
                pore_pressure: 0.0,
                material: 0,
                ..crate::slicer::ZERO_SLICE
            })
            .collect();
        negative_normal_message(&s, |k, _| normals[k])
    }

    /// E8c: the note/warning threshold is 0.05. f = 0.03 is a note; f = 0.105 (R2-04) is the major warning; the
    /// boundary 0.05 belongs to the note (`f ≤ 0.05`). With no negative normal force there is no class.
    #[test]
    fn e8c_negative_normal_threshold_is_five_percent() {
        assert_eq!(class_at(0.03), Some("negative_effective_normal"));
        assert_eq!(class_at(0.05), Some("negative_effective_normal"));
        assert_eq!(class_at(0.105), Some("negative_effective_normal_major"));
        assert_eq!(class_at(0.0), None);
    }

    /// E11f: the major class also comes from the share of the base length with `N' < 0` above 0.25, even when
    /// the weight share is small. Two soil slices of weight 10 (ΣW = 20) with normal forces −0.2 and 90, so f = 0.01
    /// in all three cases. The negative slice has length share 0.1 (note), 0.5 (major) or exactly 0.25 (note).
    #[test]
    fn e11f_length_share_above_a_quarter_is_major() {
        assert_eq!(
            class_of(&[1.0, 9.0], &[-0.2, 90.0]),
            Some("negative_effective_normal")
        );
        assert_eq!(
            class_of(&[5.0, 5.0], &[-0.2, 90.0]),
            Some("negative_effective_normal_major")
        );
        assert_eq!(
            class_of(&[1.0, 3.0], &[-0.2, 90.0]),
            Some("negative_effective_normal")
        );
    }

    /// E13j-6 applied to E7d: `f = Σ_{N'<0}|N'| / ΣW` is measured over the force scale. Two soil slices that weigh 5e-5
    /// each (V018, γ = 1e-6) carry vertical loads of 750 each on inclined bases (α = 0.5, so the loads drive the mass);
    /// one normal force is −1 (and the other 10). Over the soil weight `f` would be 1e4 (major); over the force scale
    /// `ΣW* ≈ 1.5e3` it is 6.7e-4 (note). With a negative force of 100 the share over the force scale is 0.067, still
    /// above the threshold, so the loads do not silence the major class; without loads the scale is the soil weight, as
    /// before; and (E13l-3) loads on flat bases (α = 0), which drive nothing, do not enlarge the scale: `−1` is major.
    #[test]
    fn e13j6_the_negative_normal_share_is_over_the_force_scale() {
        let slice_at = |alpha: f64, weight: f64, extra: f64| Slice {
            x_left: 0.0,
            x_right: 1.0,
            y_base_left: 0.0,
            y_base_right: 0.0,
            y_top_mid: 1.0,
            width: 1.0,
            alpha,
            base_length: 1.0,
            weight,
            weight_extra: extra,
            cohesion: 1.0,
            tan_phi: 0.5,
            material: 0,
            ..crate::slicer::ZERO_SLICE
        };
        let slice = |weight: f64, extra: f64| slice_at(0.5, weight, extra);
        // The negative slice is 1 of 10 base lengths, so E11f (length share) does not decide the class.
        let long = |s: Slice| Slice {
            base_length: 9.0,
            ..s
        };
        let loaded = vec![slice(5e-5, 750.0), long(slice(5e-5, 750.0))];
        let class =
            |s: &[Slice], n: f64| negative_normal_message(s, |k, _| if k == 0 { n } else { 10.0 });
        assert_eq!(class(&loaded, -1.0), Some("negative_effective_normal"));
        assert_eq!(
            class(&loaded, -100.0),
            Some("negative_effective_normal_major")
        );
        // Without loads the scale is ΣW, as before: f = 1/1e-4.
        let bare = vec![slice(5e-5, 0.0), long(slice(5e-5, 0.0))];
        assert_eq!(class(&bare, -1.0), Some("negative_effective_normal_major"));
        // E13l-3: the same loads on flat bases drive nothing, and the scale stays the soil weight.
        let flat = vec![slice_at(0.0, 5e-5, 750.0), long(slice_at(0.0, 5e-5, 750.0))];
        assert_eq!(class(&flat, -1.0), Some("negative_effective_normal_major"));
    }

    /// E13l-1: a `converged` result with an FS that is not positive, or not finite, becomes `not_converged` with the
    /// reason `non_positive_fos`, with no FS, no λ, no notes and no `f₀`; a valid result and a result that did not
    /// converge pass unchanged.
    #[test]
    fn e13l1_non_positive_fos_is_never_converged() {
        for bad in [
            -23.43,
            0.0,
            -0.0,
            f64::NEG_INFINITY,
            f64::INFINITY,
            f64::NAN,
        ] {
            let mut r = MethodResult::new(
                MethodKind::JanbuCorrected,
                bad,
                SolveStatus::Converged,
                7,
                Some(0.3),
                None,
            )
            .with_warnings([NEGATIVE_NORMAL_MESSAGE]);
            r.correction_factor = Some(-1.57);
            let g = guard_positive_fos(r);
            assert_eq!(g.status, SolveStatus::NotConverged, "fos = {bad}");
            assert_eq!(g.message.as_deref(), Some("non_positive_fos"));
            assert!(g.fos.is_nan() && g.lambda.is_none() && g.warnings.is_empty());
            assert_eq!((g.correction_factor, g.iterations), (None, 7));
        }
        let ok = MethodResult::new(
            MethodKind::Spencer,
            1.2,
            SolveStatus::Converged,
            3,
            Some(0.2),
            None,
        )
        .with_warnings([NEGATIVE_NORMAL_MESSAGE]);
        assert_eq!(guard_positive_fos(ok.clone()), ok);
        let failed = MethodResult::new(
            MethodKind::Spencer,
            f64::NAN,
            SolveStatus::Invalid,
            0,
            None,
            Some("no_driving"),
        );
        assert_eq!(guard_positive_fos(failed.clone()).message, failed.message);
        assert_eq!(guard_positive_fos(failed).status, SolveStatus::Invalid);
    }

    /// E8d: the notes of a converged state keep a fixed order, the air gap first.
    #[test]
    fn e8d_converged_notes_order_and_content() {
        assert_eq!(
            converged_notes(true, Some(NEGATIVE_NORMAL_MESSAGE)),
            vec![AIR_GAP_MESSAGE, NEGATIVE_NORMAL_MESSAGE]
        );
        assert_eq!(converged_notes(false, None), Vec::<&str>::new());
    }

    /// E13k: `r_v = max |λ f E|·F / (c_v h + max(E′, 0) tan φ_v)` over the faces `1..n`, with the faces of
    /// `|E| < 2 %` of the largest, those with `E′ ≤ 0` and those without strength left out.
    #[test]
    fn e13k_r_v_is_the_largest_ratio_of_the_evaluated_faces() {
        // E (compression negative); faces 1..=4 are evaluated, the ends are not.
        let e = [0.0, -100.0, -50.0, -1.0, 40.0, 0.0];
        let faces = [0.0, 1.0, 0.5, 1.0, 1.0, 0.0];
        let strength = |j: usize| match j {
            1 => FaceStrength {
                cohesion_force: 10.0,
                tan_phi: 0.5,
                water_force: 20.0,
            },
            2 => FaceStrength {
                cohesion_force: 8.0,
                tan_phi: 0.0,
                water_force: 0.0,
            },
            _ => FaceStrength {
                cohesion_force: 1.0,
                tan_phi: 0.1,
                water_force: 0.0,
            },
        };
        // Face 1: E′ = 100 − 20 = 80, capacity 10 + 40 = 50, |X| = 0.3·100 = 30 → 30·1.5/50 = 0.9.
        // Face 2: capacity 8, |X| = 0.3·0.5·50 = 7.5 → 7.5·1.5/8 = 1.40625 (the largest).
        // Face 3: |E| = 1 is 1 % of 100, not evaluated. Face 4: tension (E > 0), E′ < 0, not evaluated.
        let r = interslice_shear_ratio(&e, &faces, 0.3, 1.5, strength);
        assert!((r - 1.40625).abs() < 1e-12, "{r}");
        // Without any evaluated face: 0.
        assert_eq!(
            interslice_shear_ratio(&[0.0, 0.0, 0.0], &[1.0; 3], 0.5, 1.0, |_| {
                FaceStrength::NONE
            }),
            0.0
        );
    }

    /// E13k: a face without strength (`c_v·h + E′·tan φ_v = 0`: the material of Su = 0 of V021) is excluded, not
    /// counted as infinite; a face with water that leaves `E′ ≤ 0` is not evaluated either; and the weakest face that
    /// does have strength still counts.
    #[test]
    fn e13k_faces_without_strength_are_excluded() {
        let e = [0.0, -100.0, -100.0, 0.0];
        let faces = [1.0; 4];
        let none = |_: usize| FaceStrength::NONE;
        assert_eq!(interslice_shear_ratio(&e, &faces, 0.5, 1.0, none), 0.0);
        // `tan φ_v > 0` with water that cancels the thrust: capacity 0 too.
        let drowned = |_: usize| FaceStrength {
            cohesion_force: 0.0,
            tan_phi: 0.6,
            water_force: 100.0,
        };
        assert_eq!(interslice_shear_ratio(&e, &faces, 0.5, 1.0, drowned), 0.0);
        // Face 1 has no strength, face 2 has: only face 2 gives r_v = 0.5·100·2 / 25 = 4.
        let mixed = |j: usize| {
            if j == 1 {
                FaceStrength::NONE
            } else {
                FaceStrength {
                    cohesion_force: 25.0,
                    tan_phi: 0.0,
                    water_force: 0.0,
                }
            }
        };
        assert_eq!(interslice_shear_ratio(&e, &faces, 0.5, 2.0, mixed), 4.0);
        assert!(interslice_shear_ratio(&e, &faces, 0.5, 2.0, mixed) > INTERSLICE_SHEAR_LIMIT);
    }
}
