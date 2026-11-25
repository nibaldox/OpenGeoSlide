//! OpenGeoSlide core: 2D limit-equilibrium slope stability (contracts: `briefs/00_CONTRATOS.md`).
//!
//! What the crate does in v0.1:
//! - Reads the `.ogs.json` model (`model`, §1). Input is strict: an unknown field is an error, never
//!   ignored (`deny_unknown_fields`).
//! - `analyze` validates `format`, `version` and every `analysis` parameter before computing (§4.5).
//! - Builds the ground geometry and resolves the sliding direction (`geometry`, §1 and amendment E1).
//! - Slices circular surfaces (`slicer`, §4.1) and solves them with simplified Bishop and Spencer
//!   (`methods`, §4.2 and §4.3).
//! - Searches the critical circle with the circular entry/exit search (`search`, §4.4).
//! - Reports one `MethodReport` per method (`report`). `fos` is `None` when it is not finite; the
//!   status and the warnings explain why.
//!
//! Not in v0.1: non-circular surfaces, materials other than Mohr-Coulomb, and water over the ground
//! (it is ignored and reported as a warning).

pub mod geometry;
pub mod methods;
pub mod model;
pub mod report;
pub mod search;
pub mod slicer;

use geometry::{Ground, PreparedModel};
use methods::{SolveOptions, SolveStatus, is_inert, solve};
use model::{AnalysisSettings, FORMAT, FORMAT_VERSION, MethodKind, Model, SearchSpec, SurfaceSpec};
use report::{AnalysisReport, MethodReport};
use search::{MAX_AXIS_POINTS, MAX_GRID_CANDIDATES, search_circular};
use slicer::{Slice, SurfaceError, slice_circle};

/// Crate version, as declared in `Cargo.toml`.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Limits of `analysis` (contract §4.5).
const MIN_SLICES: usize = 3;
const MAX_SLICES: usize = 2000;
const MAX_TOLERANCE: f64 = 0.01;
const MAX_ITERATIONS: usize = 100_000;
/// `max_radius_factor` must be strictly greater than this: below it the radius range is empty
/// (`R_min = L/2 · 1.0001` is `0.50005·L`).
const MIN_RADIUS_FACTOR_EXCLUSIVE: f64 = 0.51;

/// Errors produced by the engine.
///
/// `Display` is `"<Código>: <mensaje en español>"` (contract E6). The code is stable: the web and
/// Python classify errors by that prefix.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum OgsError {
    #[error("InvalidModel: {0}")]
    InvalidModel(String),
    #[error("NoSurface: no hay superficie definida; indique analysis.surface o analysis.search")]
    NoSurface,
    /// Carries the reason in Spanish (the slicer error, or the search outcome).
    #[error("NoValidSurface: {0}")]
    NoValidSurface(String),
    #[error("Json: el texto no es un JSON válido: {0}")]
    Json(String),
}

/// Runs the analysis for every method listed in `model.analysis.methods`.
///
/// Input is validated first (`InvalidModel` with a Spanish message). Each method is resolved
/// separately; with `search`, the critical surface is searched per method. A method that fails on a
/// fixed surface is reported with its status (`Invalid`, `NotConverged`), not as an error.
pub fn analyze(model: &Model) -> Result<AnalysisReport, OgsError> {
    validate_document(model)?;
    let analysis = &model.analysis;
    if analysis.search.is_none() && analysis.surface.is_none() {
        return Err(OgsError::NoSurface);
    }
    let pm = PreparedModel::new(model)?;
    if let Some(spec) = &analysis.search {
        validate_search_ranges(spec, &pm)?;
    }
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

fn invalid(msg: impl Into<String>) -> OgsError {
    OgsError::InvalidModel(msg.into())
}

/// Name of a method, as written in the JSON.
fn method_name(method: MethodKind) -> &'static str {
    match method {
        MethodKind::Bishop => "bishop",
        MethodKind::Spencer => "spencer",
    }
}

/// `format`, `version` and `analysis` (contract §4.5). Runs before any geometry.
fn validate_document(model: &Model) -> Result<(), OgsError> {
    if model.format != FORMAT {
        return Err(invalid(format!(
            "format debe ser \"{FORMAT}\", no \"{}\"",
            model.format
        )));
    }
    if model.version != FORMAT_VERSION {
        return Err(invalid(format!(
            "version debe ser \"{FORMAT_VERSION}\", no \"{}\"",
            model.version
        )));
    }
    validate_analysis(&model.analysis)
}

fn validate_analysis(a: &AnalysisSettings) -> Result<(), OgsError> {
    if a.methods.is_empty() {
        return Err(invalid("analysis.methods está vacío"));
    }
    for (i, method) in a.methods.iter().enumerate() {
        if a.methods[..i].contains(method) {
            return Err(invalid(format!(
                "el método \"{}\" aparece repetido en analysis.methods",
                method_name(*method)
            )));
        }
    }
    if !(MIN_SLICES..=MAX_SLICES).contains(&a.slices) {
        return Err(invalid(format!(
            "analysis.slices debe estar en [{MIN_SLICES}, {MAX_SLICES}], no {}",
            a.slices
        )));
    }
    if !(a.tolerance.is_finite() && a.tolerance > 0.0 && a.tolerance <= MAX_TOLERANCE) {
        return Err(invalid(format!(
            "analysis.tolerance debe ser finita y estar en (0, {MAX_TOLERANCE}], no {}",
            a.tolerance
        )));
    }
    if !(1..=MAX_ITERATIONS).contains(&a.max_iterations) {
        return Err(invalid(format!(
            "analysis.max_iterations debe estar en [1, {MAX_ITERATIONS}], no {}",
            a.max_iterations
        )));
    }
    if !(a.min_m_alpha.is_finite() && a.min_m_alpha > 0.0 && a.min_m_alpha <= 1.0) {
        return Err(invalid(format!(
            "analysis.min_m_alpha debe ser finito y estar en (0, 1], no {}",
            a.min_m_alpha
        )));
    }
    if let Some(SurfaceSpec::Circle(c)) = &a.surface
        && !(c.xc.is_finite() && c.yc.is_finite() && c.r.is_finite() && c.r > 0.0)
    {
        return Err(invalid(
            "analysis.surface: xc, yc y r deben ser finitos, con r > 0",
        ));
    }
    if let Some(spec) = &a.search {
        validate_search_counts(spec)?;
    }
    Ok(())
}

/// The search parameters that do not depend on the model geometry.
fn validate_search_counts(s: &SearchSpec) -> Result<(), OgsError> {
    for (name, n) in [
        ("n_entry", s.n_entry),
        ("n_exit", s.n_exit),
        ("n_radius", s.n_radius),
    ] {
        if !(1..=MAX_AXIS_POINTS).contains(&n) {
            return Err(invalid(format!(
                "search.{name} debe estar en [1, {MAX_AXIS_POINTS}], no {n}"
            )));
        }
    }
    // Each factor is at most MAX_AXIS_POINTS, so the product cannot overflow.
    let candidates = s.n_entry * s.n_exit * s.n_radius;
    if candidates > MAX_GRID_CANDIDATES {
        return Err(invalid(format!(
            "la grilla de búsqueda tendría {candidates} candidatos (máximo {MAX_GRID_CANDIDATES}); \
             reduzca n_entry, n_exit o n_radius"
        )));
    }
    if !(s.max_radius_factor.is_finite() && s.max_radius_factor > MIN_RADIUS_FACTOR_EXCLUSIVE) {
        return Err(invalid(format!(
            "search.max_radius_factor debe ser finito y mayor que {MIN_RADIUS_FACTOR_EXCLUSIVE}, no {}",
            s.max_radius_factor
        )));
    }
    if let Some(w) = s.min_width
        && !(w.is_finite() && w >= 0.0)
    {
        return Err(invalid(format!(
            "search.min_width debe ser finito y ≥ 0, no {w}"
        )));
    }
    Ok(())
}

/// The search ranges, checked against the model extent (needs the prepared model).
fn validate_search_ranges(s: &SearchSpec, pm: &PreparedModel) -> Result<(), OgsError> {
    let (x_min, x_max) = pm.x_range();
    let tol = pm.tol();
    for (name, range) in [("entry", s.entry), ("exit", s.exit)] {
        let Some([lo, hi]) = range else { continue };
        if !(lo.is_finite() && hi.is_finite()) {
            return Err(invalid(format!(
                "search.{name} tiene coordenadas no finitas"
            )));
        }
        if lo > hi {
            return Err(invalid(format!(
                "search.{name} = [{lo}, {hi}]: lo debe ser ≤ hi"
            )));
        }
        if lo < x_min - tol || hi > x_max + tol {
            return Err(invalid(format!(
                "search.{name} = [{lo}, {hi}] sale de la extensión del modelo [{x_min}, {x_max}]"
            )));
        }
    }
    Ok(())
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
            let (circle, _fos) = result.best.ok_or_else(|| {
                OgsError::NoValidSurface(format!(
                    "la búsqueda con {} no encontró ninguna superficie convergida \
                     ({} evaluadas, {} válidas)",
                    method_name(method),
                    result.stats.evaluated,
                    result.stats.valid
                ))
            })?;
            (circle, Some(result.stats))
        }
        (None, Some(SurfaceSpec::Circle(circle))) => (*circle, None),
        (None, None) => return Err(OgsError::NoSurface),
    };

    // 2. Slice the chosen surface and solve it. A method that fails (`Invalid`, `NotConverged`) is
    //    reported through its status; only a surface that cannot be sliced is an error.
    let slices =
        slice_circle(pm, &circle, n).map_err(|e| OgsError::NoValidSurface(surface_reason(e)))?;
    let result = solve(&slices, method, opts);

    // 3. Warnings (stable codes, contract E6). Water over the ground inside the sliding mass is
    //    ignored in v0.1.
    let mut warnings = Vec::new();
    if water_over_ground(pm, &slices) {
        warnings.push("water_above_ground".to_string());
    }
    warnings.extend(result.message);

    Ok(MethodReport {
        method,
        fos: result.fos.is_finite().then_some(result.fos),
        status: result.status,
        iterations: result.iterations,
        lambda: result.lambda,
        surface: circle,
        slices,
        search,
        warnings,
    })
}

/// True when the piezometric line is above the ground at the ends or the midpoint of a soil slice,
/// by more than the model tolerance (`1e-9 · scale`, contract §4.5). Air slices are excluded.
fn water_over_ground(pm: &PreparedModel, slices: &[Slice]) -> bool {
    let tol = pm.tol();
    slices.iter().filter(|s| !is_inert(s)).any(|s| {
        let x_mid = 0.5 * (s.x_left + s.x_right);
        [s.x_left, x_mid, s.x_right].into_iter().any(|x| {
            match (pm.piezometric_y(x), pm.top_at(x)) {
                (Some(water), Some(ground)) => water > ground + tol,
                _ => false,
            }
        })
    })
}

/// Spanish reason for a surface that cannot be sliced.
fn surface_reason(e: SurfaceError) -> String {
    match e {
        SurfaceError::NoIntersection => "el círculo no corta el terreno".to_string(),
        SurfaceError::UpperArc => {
            "un cruce necesario cae en la mitad superior del círculo".to_string()
        }
        SurfaceError::AboveGround => {
            "el arco de deslizamiento sale sobre el terreno entre la entrada y la salida"
                .to_string()
        }
        SurfaceError::OutsideModel => "el arco de deslizamiento sale del modelo".to_string(),
        SurfaceError::TooFewSlices => "número de dovelas insuficiente".to_string(),
        SurfaceError::NoMaterial => "alguna dovela de la base no tiene material".to_string(),
    }
}

/// JSON in, JSON out: parses a `.ogs.json` document, analyzes it and returns the pretty-printed report.
///
/// Malformed JSON is a `Json` error. Well-formed JSON that does not fit the model (unknown field,
/// missing field, wrong type or value) is an `InvalidModel` error.
pub fn analyze_json(input: &str) -> Result<String, String> {
    let model: Model = serde_json::from_str(input).map_err(|e| json_error(&e).to_string())?;
    let report = analyze(&model).map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&report).map_err(|e| e.to_string())
}

fn json_error(e: &serde_json::Error) -> OgsError {
    match e.classify() {
        serde_json::error::Category::Data => {
            invalid(format!("el documento no coincide con el esquema: {e}"))
        }
        _ => OgsError::Json(e.to_string()),
    }
}
