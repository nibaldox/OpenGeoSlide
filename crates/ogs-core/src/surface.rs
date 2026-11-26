//! Slip surface of the engine: a circle or a fixed polyline (contract F3.3, amendment E13c).
//!
//! **Interfaces frozen in wave 0.** The signatures below are the contract with the writers of wave 1:
//! - `F3-W1a` implements the polyline operations (they are `unimplemented!("F3-W1a")` here) and rewires `slicer.rs`,
//!   `geometry.rs` (`arc_below_base`, `resolve_sliding` step 3) and the checks of the block ends to go through
//!   [`Surface`].
//! - On a circle, every operation delegates to the existing code and changes no bit: `y_at` is
//!   `PreparedModel::arc_y(c, true, x)`, `ground_crossings` is `slicer::sliding_span`, `break_points` is
//!   `PreparedModel::arc_profile(c, true, a, b)`.
//!
//! [`validate_polyline`] is not a stub: the format of the polyline (F3.3) is validated in wave 0.

use crate::OgsError;
use crate::geometry::PreparedModel;
use crate::model::{Circle, Point, SurfaceSpec};
use crate::report::SurfaceOut;
use crate::slicer::{SurfaceError, Tramo, sliding_span};

/// Status reason (`Invalid`, E13c): the extension of the polyline leaves the model without cutting the ground.
pub const POLYLINE_NO_GROUND_CROSSING: &str = "polyline_no_ground_crossing";
/// Status reason (`Invalid`, E13c): an interior vertex is not strictly under the ground, or a segment passes over it.
pub const POLYLINE_OUTSIDE_GROUND: &str = "polyline_outside_ground";

/// Minimum separation of the `x` of two consecutive vertices of a polyline, relative to the model width (F3.3).
pub const POLYLINE_MIN_DX_FRACTION: f64 = 1e-9;

/// Polyline `[[x, y], …]` with `x` strictly increasing (validated by [`validate_polyline`]).
///
/// The one in a `Surface` that is analysed is the **fitted** one (see [`Surface::fit_to_ground`]).
#[derive(Debug, Clone, PartialEq)]
pub struct Polyline {
    pub points: Vec<Point>,
}

/// The slip surface: a circle (fixed, or the result of the search) or a fixed polyline.
#[derive(Debug, Clone, PartialEq)]
pub enum Surface {
    Circle(Circle),
    Polyline(Polyline),
}

// The geometry operations are the frozen interface of wave 1: nothing calls them until F3-W1a rewires the slicer.
#[allow(dead_code)]
impl Surface {
    /// The surface that a `analysis.surface` declares. The polyline keeps its points as written; it is not fitted
    /// to the ground yet.
    pub fn from_spec(spec: &SurfaceSpec) -> Self {
        match spec {
            SurfaceSpec::Circle(c) => Surface::Circle(*c),
            SurfaceSpec::Polyline { points } => Surface::Polyline(Polyline {
                points: points.clone(),
            }),
        }
    }

    /// Ordinate of the **lower** surface at `x`.
    ///
    /// - Circle: `PreparedModel::arc_y(c, true, x)`, clamped to the circle (the `y` of the lower arc).
    /// - Polyline: linear interpolation between its two vertices around `x`. Outside `[x_first, x_last]` the
    ///   extrapolation is that of the end segment (the fitted polyline ends at the ground).
    pub(crate) fn y_at(&self, pm: &PreparedModel, x: f64) -> f64 {
        match self {
            Surface::Circle(c) => pm.arc_y(c, true, x),
            Surface::Polyline(_) => unimplemented!("F3-W1a"),
        }
    }

    /// Sliding range of the surface: its outermost crossings with the ground `p < q`, plus the slice breakpoints
    /// over `[a, b]` (the [`Tramo`] of the slicer, step 1-3 of contract §4.1). Only `NoIntersection` is raised here;
    /// the checks of the block ends belong to the analysed block (E10a′).
    ///
    /// - Circle: `slicer::sliding_span(pm, c)`.
    /// - Polyline (already fitted): its two ends are the crossings; `breaks` come from [`Surface::break_points`].
    pub(crate) fn ground_crossings(&self, pm: &PreparedModel) -> Result<Tramo, SurfaceError> {
        match self {
            Surface::Circle(c) => sliding_span(pm, c),
            Surface::Polyline(_) => unimplemented!("F3-W1a"),
        }
    }

    /// Slice breakpoints in `[a, b]` (both ends included, sorted, near-duplicates merged) and, for each piece
    /// between them, whether the surface lies under the ground.
    ///
    /// - Circle: `PreparedModel::arc_profile(c, true, a, b)`: region and piezometric vertices and arc–edge crossings.
    /// - Polyline: the same vertices, **plus the vertices of the polyline** (they are obligatory nodes of the cut,
    ///   so the base of each slice is straight) and the segment–edge crossings.
    pub(crate) fn break_points(&self, pm: &PreparedModel, a: f64, b: f64) -> (Vec<f64>, Vec<bool>) {
        match self {
            Surface::Circle(c) => pm.arc_profile(c, true, a, b),
            Surface::Polyline(_) => unimplemented!("F3-W1a"),
        }
    }

    /// The surface that is analysed: a circle is itself; a polyline is **extended** at each end, along its end
    /// segment, to its first crossing with the ground, or **trimmed** at the crossing if the end point is already on
    /// or over the ground (`fit_polyline_to_ground` of cSlope, F3.3). The result is what the report emits.
    ///
    /// Errors, the reasons of the `Invalid` status: [`POLYLINE_NO_GROUND_CROSSING`] if an extension leaves the model
    /// x range without cutting the ground, and [`POLYLINE_OUTSIDE_GROUND`] if an interior vertex is not strictly
    /// under the ground or inside the model, or a segment passes over the ground (grazing a ground vertex is allowed).
    pub(crate) fn fit_to_ground(&self, _pm: &PreparedModel) -> Result<Surface, &'static str> {
        match self {
            Surface::Circle(_) => Ok(self.clone()),
            Surface::Polyline(_) => unimplemented!("F3-W1a"),
        }
    }

    /// The surface as the report emits it: `{xc, yc, r}` for a circle, `{points}` for a polyline.
    pub fn to_report(&self) -> SurfaceOut {
        match self {
            Surface::Circle(c) => SurfaceOut::Circle(*c),
            Surface::Polyline(p) => SurfaceOut::Polyline {
                points: p.points.clone(),
            },
        }
    }
}

/// Format of the points of a polyline (F3.3): at least 2 points, all finite, `x` strictly increasing.
///
/// `model_width` is the width of the model, when it is known (after `PreparedModel::new`): then the separation of
/// the `x` of two consecutive points must be at least `1e-9 · model_width`. With `None`, only the order is checked.
/// Every failure is `InvalidModel`.
pub fn validate_polyline(points: &[Point], model_width: Option<f64>) -> Result<(), OgsError> {
    let invalid = OgsError::InvalidModel;
    if points.len() < 2 {
        return Err(invalid(format!(
            "analysis.surface: la polilínea necesita al menos 2 puntos, no {}",
            points.len()
        )));
    }
    if points
        .iter()
        .any(|p| !(p[0].is_finite() && p[1].is_finite()))
    {
        return Err(invalid(
            "analysis.surface: la polilínea tiene coordenadas no finitas".to_string(),
        ));
    }
    let min_dx = model_width.map_or(0.0, |w| POLYLINE_MIN_DX_FRACTION * w);
    let bad = |w: &[Point]| {
        let dx = w[1][0] - w[0][0];
        !(dx > 0.0 && dx >= min_dx)
    };
    if let Some(k) = points.windows(2).position(bad) {
        return Err(invalid(format!(
            "analysis.surface: la x de la polilínea debe ser estrictamente creciente \
             (con una separación de al menos 1e-9 por el ancho del modelo); fallan los puntos {k} y {}",
            k + 1
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn polyline_format_is_checked() {
        assert!(validate_polyline(&[[0.0, 0.0], [1.0, 1.0]], None).is_ok());
        assert!(validate_polyline(&[[0.0, 0.0]], None).is_err());
        assert!(validate_polyline(&[[0.0, 0.0], [0.0, 1.0]], None).is_err());
        assert!(validate_polyline(&[[0.0, 0.0], [f64::NAN, 1.0]], None).is_err());
        // 1e-9 · 100 = 1e-7.
        assert!(validate_polyline(&[[0.0, 0.0], [5e-8, 1.0]], Some(100.0)).is_err());
        assert!(validate_polyline(&[[0.0, 0.0], [2e-7, 1.0]], Some(100.0)).is_ok());
    }

    #[test]
    fn a_polyline_reports_its_points() {
        let s = Surface::from_spec(&SurfaceSpec::Polyline {
            points: vec![[0.0, 1.0], [2.0, 3.0]],
        });
        assert_eq!(
            s.to_report(),
            SurfaceOut::Polyline {
                points: vec![[0.0, 1.0], [2.0, 3.0]]
            }
        );
    }
}
