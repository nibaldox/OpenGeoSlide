//! OpenGeoSlide core: 2D limit-equilibrium slope stability (Bishop simplified, Spencer).
//!
//! Phase 0 skeleton: frozen public types and signatures, orchestration of `analyze`.
//! The numerical functions are `todo!()` stubs tagged with the work package that fills them
//! (W1a geometry/slicing, W1b solvers, W1c circular search).

pub mod geometry;
pub mod methods;
pub mod model;
pub mod report;
pub mod search;
pub mod slicer;

use geometry::PreparedModel;
use methods::{SolveOptions, SolveStatus, solve};
use model::{MethodKind, Model, SurfaceSpec};
use report::{AnalysisReport, MethodReport};
use search::search_circular;
use slicer::slice_circle;

/// Crate version, as declared in `Cargo.toml`.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Errors produced by the engine.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum OgsError {
    #[error("invalid model: {0}")]
    InvalidModel(String),
    #[error("no surface defined: set analysis.surface or analysis.search")]
    NoSurface,
    #[error("no valid surface found")]
    NoValidSurface,
    #[error("invalid model JSON: {0}")]
    Json(String),
}

/// Runs the analysis for every method listed in `model.analysis.methods`.
///
/// Each method is resolved separately; with `search`, the critical surface is searched per method.
pub fn analyze(model: &Model) -> Result<AnalysisReport, OgsError> {
    let analysis = &model.analysis;
    if analysis.search.is_none() && analysis.surface.is_none() {
        return Err(OgsError::NoSurface);
    }
    let pm = PreparedModel::new(model)?;
    let opts = SolveOptions {
        tolerance: analysis.tolerance,
        max_iterations: analysis.max_iterations,
        min_m_alpha: analysis.min_m_alpha,
    };
    let results = analysis
        .methods
        .iter()
        .map(|&method| analyze_method(model, &pm, method, &opts))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(AnalysisReport {
        engine: format!("ogs-core {VERSION}"),
        results,
    })
}

fn analyze_method(
    model: &Model,
    pm: &PreparedModel,
    method: MethodKind,
    opts: &SolveOptions,
) -> Result<MethodReport, OgsError> {
    let analysis = &model.analysis;
    let n = analysis.slices;

    // 1. Choose the surface: search (if present) takes precedence over a fixed surface.
    let (circle, search) = match (&analysis.search, &analysis.surface) {
        (Some(spec), _) => {
            let result = search_circular(pm, spec, |candidate| {
                let slices = slice_circle(pm, candidate, n).ok()?;
                let res = solve(&slices, method, opts);
                let valid =
                    res.status == SolveStatus::Converged && res.fos.is_finite() && res.fos > 0.0;
                valid.then_some(res.fos)
            });
            let (circle, _fos) = result.best.ok_or(OgsError::NoValidSurface)?;
            (circle, Some(result.stats))
        }
        (None, Some(SurfaceSpec::Circle(circle))) => (*circle, None),
        (None, None) => return Err(OgsError::NoSurface),
    };

    // 2. Recompute the slices and the solution for the chosen surface.
    let slices = slice_circle(pm, &circle, n).map_err(|_| OgsError::NoValidSurface)?;
    let result = solve(&slices, method, opts);

    // 3. Warnings: water above the ground inside the sliding mass is ignored in v0.1.
    let mut warnings = Vec::new();
    let water_above_ground = slices.iter().any(|s| {
        let x_mid = 0.5 * (s.x_left + s.x_right);
        pm.piezometric_y(x_mid).is_some_and(|y| y > s.y_top_mid)
    });
    if water_above_ground {
        warnings.push(
            "piezometric line above the ground inside the sliding mass: \
             water over ground is ignored in v0.1"
                .to_string(),
        );
    }
    warnings.extend(result.message);

    Ok(MethodReport {
        method,
        fos: result.fos,
        status: result.status,
        iterations: result.iterations,
        lambda: result.lambda,
        surface: circle,
        slices,
        search,
        warnings,
    })
}

/// JSON in, JSON out: parses a `.ogs.json` document, analyzes it and returns the pretty-printed report.
pub fn analyze_json(input: &str) -> Result<String, String> {
    let model: Model =
        serde_json::from_str(input).map_err(|e| OgsError::Json(e.to_string()).to_string())?;
    let report = analyze(&model).map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&report).map_err(|e| e.to_string())
}
