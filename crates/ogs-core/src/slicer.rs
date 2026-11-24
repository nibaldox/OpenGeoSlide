//! Slicing of a circular surface into slices (§4.1). Implementation: W1a.

use serde::Serialize;

use crate::geometry::PreparedModel;
use crate::model::Circle;

/// One slice, in the ORIGINAL model frame.
///
/// Sign convention: `alpha` is positive when the base rises toward the crest (driving component `W·sin α > 0`).
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
}

/// Slices the circle into `n` uniform divisions plus breakpoints. Implementation: W1a.
///
/// ORDER: `slices[0]` is the toe slice (exit); `slices[last]` is the crest slice (entry), regardless of sliding direction.
pub fn slice_circle(
    _pm: &PreparedModel,
    _circle: &Circle,
    _n: usize,
) -> Result<Vec<Slice>, SurfaceError> {
    todo!("W1a")
}
