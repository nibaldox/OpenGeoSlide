//! Analysis report (serialized to JSON by `analyze_json`).

use serde::Serialize;

use crate::methods::SolveStatus;
use crate::model::{Circle, IntersliceSpec, MethodKind, Point};
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
}

/// Full report: one entry per method, in the order of `analysis.methods`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AnalysisReport {
    /// `"ogs-core <version>"`.
    pub engine: String,
    pub results: Vec<MethodReport>,
}
