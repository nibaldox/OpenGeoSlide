//! Analysis report (serialized to JSON by `analyze_json`).

use serde::Serialize;

use crate::methods::SolveStatus;
use crate::model::{Circle, MethodKind};
use crate::search::SearchStats;
use crate::slicer::Slice;

/// Result of one method.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MethodReport {
    pub method: MethodKind,
    pub fos: f64,
    pub status: SolveStatus,
    pub iterations: usize,
    pub lambda: Option<f64>,
    /// Surface analyzed: the critical one when searching, otherwise the fixed one.
    pub surface: Circle,
    pub slices: Vec<Slice>,
    /// Present only when the surface was searched.
    pub search: Option<SearchStats>,
    pub warnings: Vec<String>,
}

/// Full report: one entry per method, in the order of `analysis.methods`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AnalysisReport {
    /// `"ogs-core <version>"`.
    pub engine: String,
    pub results: Vec<MethodReport>,
}
