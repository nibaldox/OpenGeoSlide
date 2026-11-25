//! Slicing of a circular surface into slices (§4.1).

use serde::Serialize;

use crate::geometry::{PreparedModel, Sliding};
use crate::model::Circle;

/// One slice, in the ORIGINAL model frame.
///
/// Sign convention: `alpha` is positive when the base rises toward the crest (driving component `W·sin α > 0`).
///
/// Air slices (contract §4.1.8, E2) have their base on or above the ground: `weight`, `cohesion`,
/// `tan_phi` and `pore_pressure` are exactly zero, and they contribute no driving or resisting force.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Slice {
    pub x_left: f64,
    pub x_right: f64,
    pub y_base_left: f64,
    pub y_base_right: f64,
    /// Ground elevation at `x_mid`.
    pub y_top_mid: f64,
    /// Slice width `b > 0`.
    pub width: f64,
    /// Base inclination in radians.
    pub alpha: f64,
    /// `b / cos α`.
    pub base_length: f64,
    /// Weight per metre of width.
    pub weight: f64,
    /// Cohesion of the base material.
    pub cohesion: f64,
    /// `tan φ` of the base material.
    pub tan_phi: f64,
    /// Pore pressure at the midpoint of the base.
    pub pore_pressure: f64,
    /// Index into `Model.materials`.
    pub material: usize,
}

/// Reasons a circle cannot be sliced.
#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum SurfaceError {
    #[error("the circle does not intersect the ground")]
    NoIntersection,
    #[error("a required intersection lies on the upper half of the circle")]
    UpperArc,
    #[error("the sliding arc rises above the ground between entry and exit")]
    AboveGround,
    #[error("the sliding arc leaves the model")]
    OutsideModel,
    #[error("too few slices")]
    TooFewSlices,
    #[error("no material at the base of a slice")]
    NoMaterial,
    #[error("the sliding surface divides the soil into detached masses")]
    DisconnectedMass,
}

/// E8a: a soil block other than the main one, heavier than this fraction of `ΣW`, makes the surface
/// invalid. A lighter block (a toe lens such as V019's) is accepted.
const DETACHED_MASS_FRACTION: f64 = 1e-3;

/// E8a. `air[k]` tells whether slice `k` is an air slice. Soil blocks are maximal runs of soil slices;
/// an interior air run is what separates two of them. The surface is rejected when a block other than
/// the largest one weighs more than `1e-3·ΣW`. Air runs at the toe or the crest do not separate blocks.
pub(crate) fn check_connected(slices: &[Slice], air: &[bool]) -> Result<(), SurfaceError> {
    let total_w: f64 = slices.iter().map(|s| s.weight).sum();
    let mut blocks: Vec<f64> = Vec::new();
    let mut current: Option<f64> = None;
    for (s, &is_air) in slices.iter().zip(air) {
        if is_air {
            blocks.extend(current.take());
        } else {
            *current.get_or_insert(0.0) += s.weight;
        }
    }
    blocks.extend(current);
    if blocks.len() < 2 {
        return Ok(());
    }
    blocks.sort_by(|a, b| b.total_cmp(a));
    let limit = DETACHED_MASS_FRACTION * total_w;
    if blocks[1..].iter().any(|&w| w > limit) {
        Err(SurfaceError::DisconnectedMass)
    } else {
        Ok(())
    }
}

/// Sliding range of the lower arc: its two ground crossings, plus the arc breakpoints.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Tramo {
    /// Left crossing (smaller x).
    pub(crate) p: f64,
    /// Right crossing (larger x).
    pub(crate) q: f64,
    /// Lower-arc breakpoints over the arc's span inside the model (vertices, piezometric
    /// vertices and arc–edge crossings).
    pub(crate) breaks: Vec<f64>,
}

/// Finds the sliding range of the lower arc of `c` (contract §4.1, steps 1–3).
pub(crate) fn lower_arc_tramo(pm: &PreparedModel, c: &Circle) -> Result<Tramo, SurfaceError> {
    if !(c.xc.is_finite() && c.yc.is_finite() && c.r.is_finite()) || c.r <= 0.0 {
        return Err(SurfaceError::NoIntersection);
    }
    let (x_min, x_max) = (pm.x_min, pm.x_max);
    let tol = pm.tol();
    let (ap, bp) = (c.xc - c.r, c.xc + c.r);
    let (a, b) = (ap.max(x_min), bp.min(x_max));
    if a >= b {
        return Err(SurfaceError::NoIntersection);
    }
    let (xs, under) = pm.arc_profile(c, true, a, b);
    if !under.iter().any(|&u| u) {
        return Err(SurfaceError::NoIntersection);
    }
    // The arc leaves the model through a side wall. It is an error only if the arc is under the ground
    // at that wall; touching the ground there (within tol) is a valid crossing at the wall (R1-06).
    let leaves_left = ap < x_min - tol && pm.arc_clearance(c, x_min).is_some_and(|d| d < -tol);
    let leaves_right = bp > x_max + tol && pm.arc_clearance(c, x_max).is_some_and(|d| d < -tol);
    if leaves_left || leaves_right {
        return Err(SurfaceError::OutsideModel);
    }
    if pm.arc_below_base(c, &xs) {
        return Err(SurfaceError::OutsideModel);
    }

    // Maximal intervals where the arc is under the ground.
    let mut intervals: Vec<(f64, f64)> = Vec::new();
    let mut start: Option<f64> = None;
    for (i, &u) in under.iter().enumerate() {
        if u {
            start.get_or_insert(xs[i]);
        } else if let Some(s) = start.take() {
            intervals.push((s, xs[i]));
        }
    }
    if let Some(s) = start {
        intervals.push((s, xs[xs.len() - 1]));
    }
    // E2: the sliding range runs between the outermost ground crossings. The arc may rise above the
    // ground between them; those slices are air slices (see `slice_circle`).
    let (Some(&(p, _)), Some(&(_, q))) = (intervals.first(), intervals.last()) else {
        return Err(SurfaceError::NoIntersection);
    };
    // A sliding end on the model's side wall (p == a or q == b) is a crossing only when the arc touches
    // the ground there. Otherwise the arc is under the ground at a non-wall end of its span, so the
    // entry/exit has to lie on the upper half.
    let touches_left = a - x_min <= tol && pm.arc_clearance(c, a).is_some_and(|d| d.abs() <= tol);
    let touches_right = x_max - b <= tol && pm.arc_clearance(c, b).is_some_and(|d| d.abs() <= tol);
    if (p <= a && !touches_left) || (q >= b && !touches_right) {
        let (_, upper_under) = pm.arc_profile(c, false, a, b);
        let upper_cross = upper_under.windows(2).any(|w| w[0] != w[1]);
        return Err(if upper_cross {
            SurfaceError::UpperArc
        } else {
            SurfaceError::NoIntersection
        });
    }
    Ok(Tramo { p, q, breaks: xs })
}

/// Slices the circle into `n` uniform divisions plus breakpoints (contract §4.1).
///
/// ORDER: `slices[0]` is the toe slice (exit); `slices[last]` is the crest slice (entry), regardless of sliding direction.
/// E8a: the surface is rejected with `DisconnectedMass` when an interior air run splits the soil into masses heavier
/// than `1e-3·ΣW` (see [`check_connected`]).
pub fn slice_circle(
    pm: &PreparedModel,
    circle: &Circle,
    n: usize,
) -> Result<Vec<Slice>, SurfaceError> {
    let (mut slices, air) = build_slices(pm, circle, n)?;
    check_connected(&slices, &air)?;
    // Built left to right; the toe is on the left for RightToLeft and on the right otherwise.
    if pm.sliding == Sliding::LeftToRight {
        slices.reverse();
    }
    Ok(slices)
}

/// Builds the slices of `circle` in model order (left to right), with `air[k]` true for air slices, without the
/// E8a connectivity check. `slice_circle` applies that check; the tests of E2 geometry use this function directly.
pub(crate) fn build_slices(
    pm: &PreparedModel,
    circle: &Circle,
    n: usize,
) -> Result<(Vec<Slice>, Vec<bool>), SurfaceError> {
    if n == 0 {
        return Err(SurfaceError::TooFewSlices);
    }
    let tramo = lower_arc_tramo(pm, circle)?;
    let (p, q) = (tramo.p, tramo.q);
    let span = q - p;
    let min_width = 1e-9 * span;

    // Slice boundaries: n uniform divisions plus the breakpoints, sorted and merged.
    let mut nodes: Vec<f64> = Vec::with_capacity(n + tramo.breaks.len());
    nodes.extend((1..n).map(|k| p + span * (k as f64) / (n as f64)));
    nodes.extend(tramo.breaks.iter().copied().filter(|&x| x > p && x < q));
    nodes.sort_by(f64::total_cmp);
    let mut bounds: Vec<f64> = Vec::with_capacity(nodes.len() + 2);
    bounds.push(p);
    for x in nodes {
        if x - bounds[bounds.len() - 1] >= min_width && q - x >= min_width {
            bounds.push(x);
        }
    }
    bounds.push(q);

    let sliding = pm.sliding;
    // Base rising toward the crest is positive: the crest is on the right for RightToLeft.
    let sign = match sliding {
        Sliding::RightToLeft => 1.0,
        Sliding::LeftToRight => -1.0,
    };
    let tol = pm.tol();
    let eps = 1e-9 * pm.scale;
    let mut column = Vec::with_capacity(8);
    let mut scratch = Vec::with_capacity(8);
    let mut slices = Vec::with_capacity(bounds.len() - 1);
    let mut air_flags = Vec::with_capacity(bounds.len() - 1);

    for w in bounds.windows(2) {
        let (xl, xr) = (w[0], w[1]);
        let width = xr - xl;
        let xm = 0.5 * (xl + xr);
        let yl = pm.arc_y(circle, true, xl);
        let yr = pm.arc_y(circle, true, xr);
        let y_base_mid = 0.5 * (yl + yr);
        let Some(y_top_mid) = pm.top_at(xm) else {
            return Err(SurfaceError::OutsideModel);
        };
        pm.column(xm, &mut column, &mut scratch);

        let slope = (yr - yl) / width;
        let alpha = sign * slope.atan();
        let base_length = width / alpha.cos();

        // Air slice (E2): the base lies on or above the ground. It carries no soil, so weight,
        // cohesion, tan φ and pore pressure are zero. Its material is the region nearest below the
        // base, or region 0 if there is none.
        if y_top_mid - y_base_mid <= tol {
            let nearest = column
                .iter()
                .filter(|&&(_, hi, _)| hi <= y_base_mid + tol)
                .max_by(|a, b| a.1.total_cmp(&b.1));
            slices.push(Slice {
                x_left: xl,
                x_right: xr,
                y_base_left: yl,
                y_base_right: yr,
                y_top_mid,
                width,
                alpha,
                base_length,
                weight: 0.0,
                cohesion: 0.0,
                tan_phi: 0.0,
                pore_pressure: 0.0,
                material: nearest.map_or(0, |&(_, _, mat)| mat),
            });
            air_flags.push(true);
            continue;
        }

        let piezo = pm.piezometric_y(xm);

        // Σ γ_k h_k along the column between the base midpoint and the ground.
        let mut col = 0.0;
        let probe = y_base_mid + eps;
        let mut base_material = None;
        for &(lo, hi, mat) in &column {
            if lo <= probe && probe < hi {
                base_material = Some(mat);
            }
            let lo_c = lo.max(y_base_mid);
            let hi_c = hi.min(y_top_mid);
            if hi_c <= lo_c {
                continue;
            }
            let m = &pm.materials[mat];
            col += match (m.unit_weight_sat, piezo) {
                (Some(gs), Some(z)) => {
                    let below = (hi_c.min(z) - lo_c).max(0.0);
                    let above = (hi_c - lo_c) - below;
                    gs * below + m.unit_weight * above
                }
                _ => m.unit_weight * (hi_c - lo_c),
            };
        }
        let Some(mat) = base_material else {
            return Err(SurfaceError::NoMaterial);
        };
        let m = &pm.materials[mat];

        let weight = width * col;
        let sigma_v = col;
        let pore_pressure = if let Some(ru) = m.ru {
            ru * sigma_v
        } else if let Some(z) = piezo {
            pm.gamma_w * (z - y_base_mid).max(0.0)
        } else {
            0.0
        };

        slices.push(Slice {
            x_left: xl,
            x_right: xr,
            y_base_left: yl,
            y_base_right: yr,
            y_top_mid,
            width,
            alpha,
            base_length,
            weight,
            cohesion: m.cohesion,
            tan_phi: m.tan_phi,
            pore_pressure,
            material: mat,
        });
        air_flags.push(false);
    }

    // Degenerate case (E2): every slice has its base above the ground, so there is no soil to slide.
    if !slices.iter().any(|s| s.weight > 0.0) {
        return Err(SurfaceError::AboveGround);
    }
    // E8a is checked by the caller (`slice_circle`), not here.
    Ok((slices, air_flags))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Model;
    use serde_json::{Value, json};

    fn soil(weight: f64) -> Slice {
        Slice {
            x_left: 0.0,
            x_right: 1.0,
            y_base_left: 0.0,
            y_base_right: 0.0,
            y_top_mid: 1.0,
            width: 1.0,
            alpha: 0.0,
            base_length: 1.0,
            weight,
            cohesion: 1.0,
            tan_phi: 0.5,
            pore_pressure: 0.0,
            material: 0,
        }
    }

    fn air() -> Slice {
        Slice {
            weight: 0.0,
            cohesion: 0.0,
            tan_phi: 0.0,
            ..soil(0.0)
        }
    }

    /// Soil of weight `w_soil` alone and a lens of total fraction `f` of ΣW, separated by one air slice.
    fn lens_fraction(f: f64, lens_first: bool) -> Vec<Slice> {
        let main = 1.0;
        // lens = f·(main + lens)  ⇒  lens = f·main/(1 − f)
        let lens = f * main / (1.0 - f);
        if lens_first {
            vec![soil(lens), air(), soil(main)]
        } else {
            vec![soil(main), air(), soil(lens)]
        }
    }

    /// E8a: a lens just below the threshold (0.9e-3·ΣW) is accepted, a lens just above it (1.1e-3·ΣW) is rejected.
    /// The order of the blocks does not matter.
    #[test]
    fn lens_around_the_threshold_is_accepted_or_rejected() {
        for lens_first in [false, true] {
            let below = lens_fraction(0.9e-3, lens_first);
            let air_flags = [false, true, false];
            assert_eq!(check_connected(&below, &air_flags), Ok(()));
            let above = lens_fraction(1.1e-3, lens_first);
            assert_eq!(
                check_connected(&above, &air_flags),
                Err(SurfaceError::DisconnectedMass),
                "lens_first={lens_first}"
            );
        }
    }

    /// E8a: air at the toe or the crest does not separate blocks, and one soil run is always connected.
    #[test]
    fn air_at_the_ends_does_not_split_the_mass() {
        let s = vec![air(), soil(1.0), air()];
        assert_eq!(check_connected(&s, &[true, false, true]), Ok(()));
        let one = vec![soil(1.0)];
        assert_eq!(check_connected(&one, &[false]), Ok(()));
    }

    /// E8a: with three blocks, every block other than the largest is tested, so the second-largest one decides.
    #[test]
    fn every_block_besides_the_main_one_is_tested() {
        let flags = [false, true, false, true, false];
        let big_two = vec![soil(0.5), air(), soil(0.3), air(), soil(0.2)];
        assert_eq!(
            check_connected(&big_two, &flags),
            Err(SurfaceError::DisconnectedMass)
        );
        let light = vec![soil(0.99), air(), soil(0.0005), air(), soil(0.0005)];
        // Each light block is 0.0005 ≤ 1e-3·0.9910: accepted.
        assert_eq!(check_connected(&light, &flags), Ok(()));
    }

    fn pm_of(polygon: Value, direction: &str) -> PreparedModel {
        let doc = json!({
            "format": "opengeoslide",
            "version": "0.1",
            "materials": [{
                "id": "soil", "name": "Soil", "model": "mohr_coulomb",
                "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6
            }],
            "regions": [{"material": "soil", "polygon": polygon}],
            "slope": {"direction": direction},
            "analysis": {}
        });
        let model: Model = serde_json::from_value(doc).expect("test model");
        PreparedModel::new(&model).expect("valid model")
    }

    /// E2 geometry (moved from `slicer_geometry`, which now expects `DisconnectedMass` for this surface):
    /// a valley notch whose arc leaves the soil. The notch is air, not an error, and the air slices carry nothing.
    #[test]
    fn valley_notch_arc_produces_air_slices_at_the_notch() {
        let pm = pm_of(
            json!([
                [0, 10],
                [0, 20],
                [10, 20],
                [20, 12],
                [30, 20],
                [40, 20],
                [40, 10]
            ]),
            "right_to_left",
        );
        let c = Circle {
            xc: 20.0,
            yc: 60.0,
            r: 44.0,
        };
        let (sl, flags) = build_slices(&pm, &c, 50).expect("the notch is air, not an error (E2)");
        let air_count = sl.iter().filter(|s| s.weight == 0.0).count();
        assert!(air_count > 0, "the notch must produce air slices");
        for (s, &is_air) in sl.iter().zip(&flags) {
            assert_eq!(is_air, s.weight == 0.0);
            if is_air {
                assert_eq!((s.cohesion, s.tan_phi, s.pore_pressure), (0.0, 0.0, 0.0));
                let base_mid = 0.5 * (s.y_base_left + s.y_base_right);
                assert!(base_mid >= s.y_top_mid - 1e-9, "air base below the ground");
            } else {
                let base_mid = 0.5 * (s.y_base_left + s.y_base_right);
                assert!(
                    base_mid < s.y_top_mid,
                    "soil slice with its base in the air"
                );
                assert_eq!(s.cohesion, 3.0);
            }
        }
        assert!(sl[0].weight > 0.0 && sl[sl.len() - 1].weight > 0.0);
        // The soil lies on both sides of the notch: E8a rejects the surface.
        assert_eq!(
            check_connected(&sl, &flags),
            Err(SurfaceError::DisconnectedMass)
        );
    }

    /// E2 geometry (moved from `slicer_geometry`): the circle leaves the flat toe and re-enters the 2:1 face. The air
    /// slices lie only in that gap, and the summed weight equals the soil area under the arc (independent midpoint
    /// rule, 400 000 strips, relative tolerance 1e-3). E8a then rejects it: the toe and the face are separate masses.
    #[test]
    fn toe_gap_produces_air_slices_and_the_exact_soil_area() {
        let pm = pm_of(
            json!([[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]]),
            "auto",
        );
        let c = Circle {
            xc: 25.0,
            yc: 44.0,
            r: 19.5,
        };
        let (sl, flags) = build_slices(&pm, &c, 2000).expect("the gap is air (E2)");
        let air_count = flags.iter().filter(|&&a| a).count();
        assert!(air_count > 0, "the gap above the ground must be air slices");
        for (s, &is_air) in sl.iter().zip(&flags) {
            if !is_air {
                continue;
            }
            assert_eq!((s.cohesion, s.tan_phi, s.pore_pressure), (0.0, 0.0, 0.0));
            let base_mid = 0.5 * (s.y_base_left + s.y_base_right);
            assert!(base_mid >= s.y_top_mid - 1e-9);
            assert!(
                s.x_left > 29.0 && s.x_right < 31.5,
                "air only in the gap near the toe: {s:?}"
            );
        }

        let terrain = |x: f64| {
            if x <= 30.0 {
                25.0
            } else if x <= 50.0 {
                25.0 + (x - 30.0) / 2.0
            } else {
                35.0
            }
        };
        let arc = |x: f64| c.yc - (c.r * c.r - (x - c.xc).powi(2)).max(0.0).sqrt();
        let (x0, x1) = (20.0_f64.max(c.xc - c.r), c.xc + c.r);
        let strips = 400_000;
        let h = (x1 - x0) / strips as f64;
        let exact: f64 = (0..strips)
            .map(|i| {
                let x = x0 + (i as f64 + 0.5) * h;
                (terrain(x) - arc(x)).max(0.0)
            })
            .sum::<f64>()
            * h;
        let sum_w_over_gamma: f64 = sl.iter().map(|s| s.weight / 20.0).sum();
        let rel = (sum_w_over_gamma - exact).abs() / exact;
        assert!(
            rel < 1e-3,
            "sum W/γ = {sum_w_over_gamma}, exact = {exact}, rel = {rel}"
        );
        assert_eq!(
            check_connected(&sl, &flags),
            Err(SurfaceError::DisconnectedMass)
        );
    }
}
