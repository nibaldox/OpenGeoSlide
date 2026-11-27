//! OpenGeoSlide core: 2D limit-equilibrium slope stability (contracts: `briefs/00_CONTRATOS.md`).
//!
//! What the crate does (formats v0.1 to v0.5):
//! - Reads the `.ogs.json` model (`model`, §1). Input is strict: an unknown field is an error, never
//!   ignored (`deny_unknown_fields`).
//! - `analyze` validates `format`, `version` and every `analysis` parameter before computing (§4.5).
//! - v0.2 (amendments E12a, E12b): `loads` (distributed and line loads) and `analysis.seismic` (pseudo-static `kh`,
//!   `kv`), validated in `loads` and applied by the slicer and both methods. A model without them gives the same
//!   result in v0.1 and in v0.2.
//! - v0.3 (amendments E13a-E13g): the `undrained` material (`strength`), the polyline surface (`surface`), the
//!   methods `morgenstern_price`, `janbu_simplified` and `janbu_corrected`, and `analysis.interslice`. The format,
//!   the version gate and the validations are complete. The fixed polyline (E13c) is fitted to the ground, sliced and
//!   solved here, and the methods of v0.3 (Morgenstern-Price and Janbu) are dispatched by `methods::solve_with`.
//! - v0.4 (amendments E14a-E14l): `reinforcements` (anchors, nails, geosynthetics, piles and sheet piles). The types,
//!   the version gate and the validation are in `model` and `reinforcement`; the forces (`reinforcement`, wave R1)
//!   are called only when the list is not empty, so a model without them goes through the code of v0.2.0.
//! - v0.5 (amendments E15a-E15h): `analysis.tension_crack` (a tension crack, dry or with water; `crack`) and the ponded
//!   water, which has no field and applies in every version (`water`). `crack::locate` and `crack::truncate` are
//!   called only when `analysis.tension_crack` exists; `water::apply_ponded` runs on every surface and adds nothing
//!   without water over the ground, so a model without them gives the output of v0.3.0 (E15e-1).
//! - Builds the ground geometry and resolves the sliding direction (`geometry`, §1 and amendment E1).
//! - Slices circular surfaces and fixed polylines (`slicer`, §4.1) and solves them with simplified Bishop and Spencer
//!   (`methods`, §4.2 and §4.3).
//! - Searches the critical circle with the circular entry/exit search (`search`, §4.4).
//! - Reports one `MethodReport` per method (`report`). `fos` is `None` when it is not finite; the
//!   status and the warnings explain why.
//!
//! Water over the ground: the ponded water enters with its weight and thrust (`water`); the note `water_above_ground`
//! stays as an informative note.

pub mod crack;
pub mod geometry;
pub mod loads;
pub mod methods;
pub mod model;
pub mod reinforcement;
pub mod report;
pub mod search;
pub mod slicer;
pub mod strength;
pub mod surface;
pub mod water;

use geometry::{Ground, PreparedModel};
use loads::{LOAD_OUTSIDE_MASS, LoadCase};
use methods::{SolveOptions, SolveStatus, is_inert, solve_with};
use model::{
    AnalysisSettings, FORMAT, IntersliceFunction, IntersliceSpec, MethodKind, Model, SearchSpec,
    SurfaceSpec,
};
use report::{AnalysisReport, CrackReport, MethodReport};
use search::{
    ElementEnd, MAX_AXIS_POINTS, MAX_GRID_CANDIDATES, effective_block_warnings,
    search_circular_reinforced,
};
use slicer::{Slice, SurfaceError, slice_surface_cracked};
use std::sync::atomic::{AtomicUsize, Ordering};
use surface::{Surface, validate_polyline};

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
    let (x_min, x_max) = pm.x_range();
    loads::validate_range(model, x_min, x_max, pm.tol())?;
    // E13c: the separation of the `x` of a polyline needs the model width.
    if let Some(SurfaceSpec::Polyline { points }) = &analysis.surface {
        validate_polyline(points, Some(x_max - x_min))?;
    }
    let load_case = LoadCase::from_model(model);
    if let Some(spec) = &analysis.search {
        validate_search_ranges(spec, &pm)?;
    }
    let opts = SolveOptions {
        tolerance: analysis.tolerance,
        max_iterations: analysis.max_iterations,
        min_m_alpha: analysis.min_m_alpha,
        // E13f: the analysed surface is a polyline only when it is fixed and there is no search (`search` wins).
        circular: !(analysis.search.is_none()
            && matches!(analysis.surface, Some(SurfaceSpec::Polyline { .. }))),
    };
    let results = analysis
        .methods
        .iter()
        .map(|&method| analyze_method(model, &pm, &load_case, method, &opts))
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
        MethodKind::MorgensternPrice => "morgenstern_price",
        MethodKind::JanbuSimplified => "janbu_simplified",
        MethodKind::JanbuCorrected => "janbu_corrected",
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
    // `version` (0.1, 0.2 or 0.3), the v0.2 fields `loads` and `analysis.seismic` (E12a) and the gate of the v0.3
    // fields (E13a).
    loads::validate_document(model)?;
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
    match &a.surface {
        Some(SurfaceSpec::Circle(c))
            if !(c.xc.is_finite() && c.yc.is_finite() && c.r.is_finite() && c.r > 0.0) =>
        {
            return Err(invalid(
                "analysis.surface: xc, yc y r deben ser finitos, con r > 0",
            ));
        }
        // E13c: format of the polyline (the separation against the model width is checked once it is prepared).
        Some(SurfaceSpec::Polyline { points }) => {
            validate_polyline(points, None)?;
            // E13f: Bishop needs a circle, because with a polyline its FS depends on the moment axis. It only
            // matters when the polyline is the surface that is analysed, i.e. there is no search (`search` wins).
            if a.search.is_none() && a.methods.contains(&MethodKind::Bishop) {
                return Err(invalid(
                    "el método 'bishop' solo admite superficies circulares; \
                     use spencer, morgenstern_price o janbu",
                ));
            }
        }
        _ => {}
    }
    validate_interslice(a)?;
    if let Some(spec) = &a.search {
        validate_search_counts(spec)?;
    }
    Ok(())
}

/// `analysis.interslice` (E13d): only with `morgenstern_price`, and `points` only (and always) with `data_points`.
fn validate_interslice(a: &AnalysisSettings) -> Result<(), OgsError> {
    let Some(spec) = &a.interslice else {
        return Ok(());
    };
    if !a.methods.contains(&MethodKind::MorgensternPrice) {
        return Err(invalid(
            "analysis.interslice requiere el método \"morgenstern_price\" en analysis.methods",
        ));
    }
    match (spec.function, &spec.points) {
        (IntersliceFunction::DataPoints, None) => Err(invalid(
            "analysis.interslice: la función data_points requiere 'points'",
        )),
        (IntersliceFunction::DataPoints, Some(points)) => validate_interslice_points(points),
        (_, Some(_)) => Err(invalid(
            "analysis.interslice: 'points' solo se admite con la función data_points",
        )),
        (_, None) => Ok(()),
    }
}

/// `data_points` (E13d): at least 2 points `[ξ, f]`, ξ strictly increasing from 0 to 1, `f ≥ 0`, `max f > 0`, all
/// finite.
fn validate_interslice_points(points: &[model::Point]) -> Result<(), OgsError> {
    if points.len() < 2 {
        return Err(invalid(format!(
            "analysis.interslice.points necesita al menos 2 puntos, no {}",
            points.len()
        )));
    }
    if points
        .iter()
        .any(|p| !(p[0].is_finite() && p[1].is_finite()))
    {
        return Err(invalid(
            "analysis.interslice.points tiene valores no finitos",
        ));
    }
    if points[0][0] != 0.0 {
        return Err(invalid("analysis.interslice.points debe empezar en ξ = 0"));
    }
    if points[points.len() - 1][0] != 1.0 {
        return Err(invalid("analysis.interslice.points debe terminar en ξ = 1"));
    }
    if points.windows(2).any(|w| w[1][0] <= w[0][0]) {
        return Err(invalid(
            "analysis.interslice.points debe tener ξ estrictamente creciente",
        ));
    }
    if points.iter().any(|p| p[1] < 0.0) {
        return Err(invalid("analysis.interslice.points debe tener f ≥ 0"));
    }
    if !points.iter().any(|p| p[1] > 0.0) {
        return Err(invalid("analysis.interslice.points debe tener algún f > 0"));
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

/// Heads and tips of the reinforcements, with the unit vector that points away from the element (E14o-7).
fn reinforcement_ends(reinforcements: &[model::Reinforcement]) -> Vec<ElementEnd> {
    let mut ends = Vec::new();
    for r in reinforcements {
        let ([x1, y1], [x2, y2]) = r.ends();
        let len = (x2 - x1).hypot(y2 - y1);
        if !(len.is_finite() && len > 0.0) {
            continue;
        }
        let (ux, uy) = ((x2 - x1) / len, (y2 - y1) / len);
        ends.push(ElementEnd {
            x: x1,
            y: y1,
            ux: -ux,
            uy: -uy,
        });
        ends.push(ElementEnd {
            x: x2,
            y: y2,
            ux,
            uy,
        });
    }
    ends
}

fn analyze_method(
    model: &Model,
    pm: &PreparedModel,
    load_case: &LoadCase,
    method: MethodKind,
    opts: &SolveOptions,
) -> Result<MethodReport, OgsError> {
    let analysis = &model.analysis;
    let n = analysis.slices;

    // E15i-3: the profile of pressure of each pile with `lateral_pressure`, once per analysis (it does not depend on
    // the surface); empty, and free, without such a pile.
    let pile_profiles = reinforcement::PileProfiles::try_with_step(
        &model.reinforcements,
        pm,
        reinforcement::pressure_step(model.units.as_deref()),
    )?;
    // 1. Choose the surface: search (if present) takes precedence over a fixed surface.
    let (surface, search) = match (&analysis.search, &analysis.surface) {
        (Some(spec), _) => {
            // E14o-7: with reinforcements the search also tries circles through their heads and tips.
            let ends = reinforcement_ends(&model.reinforcements);
            // E15l-7: how many evaluated candidates were discarded because they do not get to the crack.
            let not_reached = AtomicUsize::new(0);
            let result = search_circular_reinforced(pm, spec, &ends, |candidate| {
                // E14d.4: the crossings of the reinforcements are computed for each candidate. E15d (G9): a candidate
                // that does not get to the crack is discarded.
                let surface = Surface::Circle(*candidate);
                let plan = match &analysis.tension_crack {
                    // A candidate that cannot be sliced is discarded below, with or without a crack.
                    Some(tc) => match crack::locate(tc, pm, &surface, load_case) {
                        Ok(plan) => Some(plan),
                        Err(crack::CrackError::NoGround) => None,
                        Err(crack::CrackError::NotReached) => {
                            not_reached.fetch_add(1, Ordering::Relaxed);
                            return None;
                        }
                    },
                    None => None,
                };
                let case;
                let mut crossings = 0;
                let load_case = if model.reinforcements.is_empty() && plan.is_none() {
                    load_case
                } else {
                    let mut nodes = if model.reinforcements.is_empty() {
                        Vec::new()
                    } else {
                        reinforcement::crossing_nodes_with(
                            &model.reinforcements,
                            pm,
                            &surface,
                            &pile_profiles,
                        )
                    };
                    crossings = (nodes.len() / 2) as u32;
                    if let Some(plan) = &plan {
                        nodes.extend_from_slice(&plan.breaks);
                    }
                    case = load_case.with_extra_breaks(nodes);
                    &case
                };
                let crack_x = plan
                    .as_ref()
                    .filter(|plan| !plan.breaks.is_empty())
                    .map(|plan| plan.x_c);
                let mut slices = slice_surface_cracked(pm, &surface, n, load_case, crack_x)
                    .ok()?
                    .slices;
                if let Some(plan) = &plan {
                    crack::truncate(plan, pm, &surface, &mut slices);
                }
                let _ = water::apply_ponded(pm, &surface, &mut slices);
                if !model.reinforcements.is_empty() {
                    reinforcement::apply_to_slices_with(
                        &model.reinforcements,
                        pm,
                        &surface,
                        &mut slices,
                        &pile_profiles,
                    );
                }
                let res = solve_with(&slices, method, opts, analysis.interslice.as_ref());
                let valid =
                    res.status == SolveStatus::Converged && res.fos.is_finite() && res.fos > 0.0;
                valid.then_some((res.fos, crossings))
            });
            let (circle, _fos) = result.best.ok_or_else(|| {
                // E15l-7: with k > 0 candidates discarded by the crack, the message says so; with k = 0 it is the usual one.
                let k = not_reached.load(Ordering::Relaxed);
                let by_crack = if k > 0 {
                    format!(
                        "; {k} no alcanzan la grieta de tracción, {}",
                        crack::TENSION_CRACK_NOT_REACHED
                    )
                } else {
                    String::new()
                };
                OgsError::NoValidSurface(format!(
                    "la búsqueda con {} no encontró ninguna superficie convergida \
                     ({} evaluadas, {} válidas{by_crack})",
                    method_name(method),
                    result.stats.evaluated,
                    result.stats.valid
                ))
            })?;
            (Surface::Circle(circle), Some(result.stats))
        }
        (None, Some(spec)) => (Surface::from_spec(spec), None),
        (None, None) => return Err(OgsError::NoSurface),
    };
    // E13c: a fixed polyline is fitted to the ground (extended or trimmed at each end) and the report carries the
    // fitted one. If it cannot be fitted, the method is `Invalid` with the reason, like any method on a fixed surface
    // that fails, and the report keeps the polyline as it was written, with no slices.
    let declared = surface;
    let surface = match declared.fit_to_ground(pm) {
        Ok(fitted) => fitted,
        Err(reason) => {
            return Ok(MethodReport {
                method,
                fos: None,
                status: SolveStatus::Invalid,
                iterations: 0,
                lambda: None,
                surface: declared.to_report(),
                slices: Vec::new(),
                search,
                warnings: std::iter::once(reason.to_string())
                    // E15n-3: the note of the model (declarative, as in the main path) is not lost on the early return.
                    .chain(
                        uses_default_water_unit_weight(model)
                            .then(|| model::WATER_UNIT_WEIGHT_DEFAULT.to_string()),
                    )
                    .chain(
                        model
                            .reinforcements
                            .iter()
                            .any(model::Reinforcement::is_pile)
                            .then(|| reinforcement::STRUCTURAL_CHECKS_NOT_COVERED.to_string()),
                    )
                    .chain(
                        reinforcement::ito_matsui_out_of_range(&model.reinforcements)
                            .then(|| reinforcement::ITO_MATSUI_SPACING_RANGE.to_string()),
                    )
                    .collect(),
                correction_factor: None,
                interslice: interslice_report(analysis, method),
                reinforcement_forces: Vec::new(),
                tension_crack: None,
            });
        }
    };

    // 2. Slice the chosen surface and solve it. A method that fails (`Invalid`, `NotConverged`) is
    //    reported through its status; only a surface that cannot be sliced is an error.
    // E15d (G1): the position of the crack on the fitted surface. A surface that does not get to it has no mass: the
    // analysis fails with the stable reason (the search discards such candidates instead, G9).
    let crack_plan = match &analysis.tension_crack {
        Some(tc) => match crack::locate(tc, pm, &surface, load_case) {
            Ok(plan) => Some(plan),
            // No sliding range: the slicing below gives the usual reason.
            Err(crack::CrackError::NoGround) => None,
            Err(crack::CrackError::NotReached) => {
                return Err(OgsError::NoValidSurface(format!(
                    "{}: la superficie no alcanza la profundidad de la grieta de tracción",
                    crack::TENSION_CRACK_NOT_REACHED
                )));
            }
        },
        None => None,
    };
    let reinforced_case;
    let slicing_case = if model.reinforcements.is_empty() && crack_plan.is_none() {
        load_case
    } else {
        let mut nodes = if model.reinforcements.is_empty() {
            Vec::new()
        } else {
            reinforcement::crossing_nodes_with(&model.reinforcements, pm, &surface, &pile_profiles)
        };
        if let Some(plan) = &crack_plan {
            nodes.extend_from_slice(&plan.breaks);
        }
        reinforced_case = load_case.with_extra_breaks(nodes);
        &reinforced_case
    };
    let sliced = slice_surface_cracked(
        pm,
        &surface,
        n,
        slicing_case,
        crack_plan
            .as_ref()
            .filter(|plan| !plan.breaks.is_empty())
            .map(|plan| plan.x_c),
    )
    .map_err(|e| OgsError::NoValidSurface(surface_reason(e, &surface)))?;
    let mut slices = sliced.slices;
    // E15d (G2, G3): the slices on the crest side of the crack go, and the water of the crack acts on the face.
    let crack_report: Option<CrackReport> = crack_plan
        .as_ref()
        .map(|plan| crack::truncate(plan, pm, &surface, &mut slices));
    // E15c: the weight and the thrust of the ponded water (zero terms without water over the ground).
    let ponded = water::apply_ponded(pm, &surface, &mut slices);
    // E14d: the forces of the reinforcements on the final surface (reported only for a converged method, E14i).
    let (mut reinforcement_forces, active_compressed) = if model.reinforcements.is_empty() {
        (Vec::new(), false)
    } else {
        reinforcement::apply_with_state_using(
            &model.reinforcements,
            pm,
            &surface,
            &mut slices,
            &pile_profiles,
        )
    };
    // E14d.3, E14e, E14h: the notes come from the forces of the final surface (also for a method that did not
    // converge), before they are cleared below.
    let reinforcement_notes = if model.reinforcements.is_empty() {
        Vec::new()
    } else {
        reinforcement::notes_with(
            &model.reinforcements,
            &reinforcement_forces,
            active_compressed,
        )
    };
    // E13l-7: a mass that was truncated is reported over the range that was analysed.
    let truncated = !sliced.notes.is_empty() || crack_report.is_some();
    let mut result = solve_with(&slices, method, opts, analysis.interslice.as_ref());
    if result.status != SolveStatus::Converged {
        reinforcement_forces.clear();
    }
    // E13k: a converged Spencer or Morgenstern-Price whose interslice shear exceeds the strength of the faces.
    if let Some(ratio) =
        interslice_shear_ratio_of(pm, method, analysis.interslice.as_ref(), &slices, &result)
        && ratio > methods::INTERSLICE_SHEAR_LIMIT
    {
        result
            .warnings
            .push(methods::INTERSLICE_SHEAR_MESSAGE.to_string());
    }

    // 3. Warnings (stable codes, contract E6). Water over the ground inside the sliding mass is ignored in v0.1.
    //    The list is the water note, then the slicing notes (E10a: `truncated_mass`), then the reason of the
    //    status (E8d), then the notes of the state, without duplicates and in a fixed order.
    let mut warnings: Vec<String> = Vec::new();
    // E15l-5: also when the ponded terms applied to the surface are not zero (the vertical face of E4 included, where
    // the ground at the face is the crest and the line is under it).
    if ponded || water_over_ground(pm, &slices) {
        warnings.push("water_above_ground".to_string());
    }
    // E15m-6: imperial units, water in use (a piezometric line, or water in the crack) and no `water.unit_weight`.
    if uses_default_water_unit_weight(model) {
        warnings.push(model::WATER_UNIT_WEIGHT_DEFAULT.to_string());
    }
    // E12b: a declared load that acts on no soil slice of the reported surface (informative note).
    if load_case.unused(&slices, pm.x_max - pm.x_min) {
        warnings.push(LOAD_OUTSIDE_MASS.to_string());
    }
    // E14: the notes of the reinforcements (informative).
    warnings.extend(reinforcement_notes.iter().map(|code| code.to_string()));
    // E11d′: on a searched surface, the effective soil ends are checked against `min_width` and the ranges (advisory).
    let effective: Vec<String> = match &analysis.search {
        Some(spec) => effective_block_warnings(pm, spec, &slices)
            .into_iter()
            .map(str::to_string)
            .collect(),
        None => Vec::new(),
    };
    for code in sliced
        .notes
        .into_iter()
        .chain(effective)
        .chain(result.message)
        .chain(result.warnings)
    {
        if !warnings.contains(&code) {
            warnings.push(code);
        }
    }

    Ok(MethodReport {
        method,
        fos: result.fos.is_finite().then_some(result.fos),
        status: result.status,
        iterations: result.iterations,
        lambda: result.lambda,
        surface: match (truncated, slices.first(), slices.last()) {
            (true, Some(_), Some(_)) => {
                let x0 = slices
                    .iter()
                    .map(|s| s.x_left)
                    .fold(f64::INFINITY, f64::min);
                let x1 = slices
                    .iter()
                    .map(|s| s.x_right)
                    .fold(f64::NEG_INFINITY, f64::max);
                surface.to_report_within(x0, x1)
            }
            _ => surface.to_report(),
        },
        slices,
        search,
        warnings,
        correction_factor: result.correction_factor,
        interslice: interslice_report(analysis, method),
        reinforcement_forces,
        tension_crack: crack_report,
    })
}

/// E15m-6: the model is imperial, uses water and takes the default `γw` (no `water.unit_weight`). The water is in use
/// with a piezometric line (under the ground or over it) or with `tension_crack.water_fill > 0`.
fn uses_default_water_unit_weight(model: &Model) -> bool {
    if !model::is_imperial_units(model.units.as_deref()) {
        return false;
    }
    let water = model.water.as_ref();
    if water.is_some_and(|w| w.unit_weight.is_some()) {
        return false;
    }
    water.is_some_and(|w| w.piezometric_line.is_some())
        || model
            .analysis
            .tension_crack
            .is_some_and(|tc| tc.water_fill > 0.0)
}

/// `r_v` of E13k (see `methods::interslice_shear_ratio`) of a converged Spencer or Morgenstern-Price result; `None` for
/// the other methods (Janbu has `X = 0`, Bishop has no interslice forces) and for a result that did not converge.
fn interslice_shear_ratio_of(
    pm: &PreparedModel,
    method: MethodKind,
    spec: Option<&IntersliceSpec>,
    slices: &[Slice],
    result: &methods::MethodResult,
) -> Option<f64> {
    let applies = matches!(method, MethodKind::Spencer | MethodKind::MorgensternPrice);
    let lambda = result.lambda.filter(|_| applies)?;
    (result.status == SolveStatus::Converged && result.fos.is_finite() && result.fos > 0.0)
        .then(|| methods::shear_ratio_of(pm, method, spec, slices, result.fos, lambda))
}

/// `r_v` of E13k for the result of `report` on `model`: the ratio of the interslice shear to the shear that the
/// vertical faces can mobilize (Chen and Morgenstern 1983). The warning `interslice_shear_exceeds_strength` is raised
/// when it is above 3. `None` unless the method is Spencer or Morgenstern-Price and the result converged. It re-reads
/// the slices of the report, so it is the value of the report, not a new analysis.
pub fn interslice_shear_ratio(
    model: &Model,
    report: &MethodReport,
) -> Result<Option<f64>, OgsError> {
    let (Some(fos), Some(lambda)) = (report.fos, report.lambda) else {
        return Ok(None);
    };
    if report.status != SolveStatus::Converged
        || !matches!(
            report.method,
            MethodKind::Spencer | MethodKind::MorgensternPrice
        )
    {
        return Ok(None);
    }
    let pm = PreparedModel::new(model)?;
    Ok(Some(methods::shear_ratio_of(
        &pm,
        report.method,
        model.analysis.interslice.as_ref(),
        &report.slices,
        fos,
        lambda,
    )))
}

/// The interslice function reported by `morgenstern_price`: the declared one, or `half_sine` by default (E13d).
fn interslice_report(analysis: &AnalysisSettings, method: MethodKind) -> Option<IntersliceSpec> {
    (method == MethodKind::MorgensternPrice).then(|| {
        analysis.interslice.clone().unwrap_or(IntersliceSpec {
            function: IntersliceFunction::HalfSine,
            points: None,
        })
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
fn surface_reason(e: SurfaceError, surface: &Surface) -> String {
    if surface.is_polyline() {
        return match e {
            SurfaceError::NoIntersection => "la polilínea no corta el terreno".to_string(),
            SurfaceError::UpperArc | SurfaceError::AboveGround => {
                "la polilínea sale sobre el terreno entre la entrada y la salida".to_string()
            }
            SurfaceError::OutsideModel => "la polilínea sale del modelo".to_string(),
            SurfaceError::TooFewSlices => "número de dovelas insuficiente".to_string(),
            SurfaceError::NoMaterial => "alguna dovela de la base no tiene material".to_string(),
        };
    }
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
