//! Analysis report (serialized to JSON by `analyze_json`).

use serde::Serialize;

use crate::methods::SolveStatus;
use crate::model::{Application, Circle, IntersliceSpec, MethodKind, Point};
use crate::search::SearchStats;
use crate::slicer::Slice;

/// Surface of a report (E13g). Untagged, with the circle first so that its output is the same as before v0.3:
/// `{"xc", "yc", "r"}` for a circle and `{"points": [[x, y], …]}` for a polyline (the **fitted** one, already
/// extended or trimmed to the ground).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(untagged)]
pub enum SurfaceOut {
    Circle(Circle),
    Polyline { points: Vec<Point> },
}

/// What happened to one crossing of a reinforcement with the final slip surface (E14i).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ForceStatus {
    /// The force acts on a soil slice.
    Applied,
    /// The crossing falls in the air or on a block discarded by truncation (E7a): no force.
    OutsideMass,
    /// A passive reinforcement that the sliding would compress (E14e): no force.
    CompressionIgnored,
}

/// Force of a reinforcement at one crossing with the final slip surface (E14i), per metre of slope.
///
/// `available` is `T(s_c)` per metre, or the force of the pile per metre. `fx`, `fy` are the **applied** force per
/// metre, in model coordinates (y upward); for a passive reinforcement it is the available force, **before** dividing
/// by `F` (the report says "pasiva: se moviliza dividida por F"). An element that crosses twice has two entries
/// (`crossing` 0 and 1). Emitted only for converged methods, on the final surface, never per search candidate.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ReinforcementForce {
    /// `id` of the reinforcement.
    pub id: String,
    /// Order of the crossing along the element, from the head (0, 1, …).
    pub crossing: usize,
    /// Crossing point with the slip surface.
    pub x: f64,
    pub y: f64,
    /// Distance from the head along the element, `s_c = t_c·L`.
    pub station: f64,
    pub available: f64,
    pub fx: f64,
    pub fy: f64,
    pub application: Application,
    pub status: ForceStatus,
}

/// Result of one method.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MethodReport {
    pub method: MethodKind,
    /// Factor of safety; `None` (JSON `null`) when it is not finite. `status` and `warnings` say why.
    pub fos: Option<f64>,
    pub status: SolveStatus,
    pub iterations: usize,
    pub lambda: Option<f64>,
    /// Surface analyzed: the critical one when searching, otherwise the fixed one.
    pub surface: SurfaceOut,
    pub slices: Vec<Slice>,
    /// Present only when the surface was searched.
    pub search: Option<SearchStats>,
    pub warnings: Vec<String>,
    /// `f₀` of `janbu_corrected` (`fos = f₀·F₀`, E13e); only that method has it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correction_factor: Option<f64>,
    /// Interslice function used by `morgenstern_price` (E13d); only that method has it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interslice: Option<IntersliceSpec>,
    /// Forces of the reinforcements on the final surface (v0.4, E14i); omitted when there are none.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub reinforcement_forces: Vec<ReinforcementForce>,
}

/// Full report: one entry per method, in the order of `analysis.methods`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AnalysisReport {
    /// `"ogs-core <version>"`.
    pub engine: String,
    pub results: Vec<MethodReport>,
}
