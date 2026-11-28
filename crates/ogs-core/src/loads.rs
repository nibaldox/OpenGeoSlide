//! Seismic coefficients and surface loads (schema v0.2, amendments E12a and E12b), and the version gate of the
//! document (the v0.2, v0.3 and v0.4 fields, E13a and E14a).
//!
//! - [`validate_document`] checks the new fields that do not need the geometry: the version (and which fields each
//!   version admits), finiteness, ranges and repeated ids. [`validate_range`] checks the x positions against the model extent, once the model is prepared.
//! - [`LoadCase`] is the resolved form the slicer works with: `kh`, `kv`, the distributed loads and the line loads,
//!   with the angle in radians. `LoadCase::default()` is neutral (no seismic force, no loads) and leaves the slices
//!   exactly as before v0.2.
//! - [`LoadCase::unused`] tells whether a declared load does not act on any analysed soil slice (note
//!   `load_outside_mass`).

use crate::OgsError;
use crate::model::{
    CrackDepth, FORMAT_VERSION, FORMAT_VERSION_V02, FORMAT_VERSION_V03, FORMAT_VERSION_V04,
    FORMAT_VERSION_V05, FORMAT_VERSION_V06, FORMAT_VERSION_V07, Load, MAX_GLOBAL_SEED,
    MaterialModel, MethodKind, Model, SurfaceSpec,
};
use crate::slicer::Slice;

/// Informative note (E12b): a declared load does not act on any soil slice of the reported surface.
pub const LOAD_OUTSIDE_MASS: &str = "load_outside_mass";

/// Offset of the breakpoints around a line load, relative to the model width (E12b): `x ± 1e-6 · width`.
const LINE_BREAK_FRACTION: f64 = 1e-6;

/// Tolerance of the position of a line load against the ends of a slice, relative to the model width (E12f).
pub(crate) const LINE_TOUCH_FRACTION: f64 = 1e-9;

/// A vertical distributed load on the ground between `x1` and `x2`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Udl {
    pub x1: f64,
    pub x2: f64,
    pub q: f64,
}

/// A line load at `(x, y_top(x))`. `angle` is in radians from the downward vertical, positive toward +x.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Line {
    pub x: f64,
    pub p: f64,
    pub angle: f64,
}

/// Seismic coefficients and loads of an analysis, resolved for the slicer.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct LoadCase {
    pub kh: f64,
    pub kv: f64,
    pub udls: Vec<Udl>,
    pub lines: Vec<Line>,
    /// Extra slice boundaries of the crossings of the reinforcements with the surface (E14d.2), supplied per surface
    /// by `reinforcement::crossing_nodes` through [`LoadCase::with_extra_breaks`]. Empty without reinforcements.
    pub extra_breaks: Vec<f64>,
}

impl LoadCase {
    /// Resolves `analysis.seismic` and `loads` of a model (already validated).
    pub fn from_model(model: &Model) -> Self {
        let seismic = model.analysis.seismic.unwrap_or_default();
        let mut case = LoadCase {
            kh: seismic.kh,
            kv: seismic.kv,
            ..LoadCase::default()
        };
        for load in &model.loads {
            match load {
                Load::Udl(u) => case.udls.push(Udl {
                    x1: u.x1,
                    x2: u.x2,
                    q: u.q,
                }),
                Load::Line(l) => case.lines.push(Line {
                    x: l.x,
                    p: l.p,
                    angle: l.angle.to_radians(),
                }),
            }
        }
        case
    }

    /// True when there is no seismic force, no load and no extra boundary: the slices are those of v0.1.
    pub fn is_neutral(&self) -> bool {
        self.kh == 0.0
            && self.kv == 0.0
            && self.udls.is_empty()
            && self.lines.is_empty()
            && self.extra_breaks.is_empty()
    }

    /// A copy with the slice boundaries `xs` added (the crossings of the reinforcements, E14d.2).
    pub fn with_extra_breaks(&self, xs: Vec<f64>) -> LoadCase {
        LoadCase {
            extra_breaks: xs,
            ..self.clone()
        }
    }

    /// Extra slice boundaries (E12b): `x1` and `x2` of every `udl`, and `x ± 1e-6·width` of every `line`.
    pub(crate) fn break_points(&self, model_width: f64) -> Vec<f64> {
        let d = LINE_BREAK_FRACTION * model_width;
        let mut xs = Vec::with_capacity(
            2 * self.udls.len() + 2 * self.lines.len() + self.extra_breaks.len(),
        );
        for u in &self.udls {
            xs.push(u.x1);
            xs.push(u.x2);
        }
        for l in &self.lines {
            xs.push(l.x - d);
            xs.push(l.x + d);
        }
        xs.extend_from_slice(&self.extra_breaks);
        xs
    }

    /// True when some declared load acts on no soil slice of `slices` (note `load_outside_mass`, E12b).
    ///
    /// A `udl` acts if it overlaps the x extent of a soil slice with positive length; a `line` acts if its `x` lies in
    /// the closed interval `[x_left, x_right]` of a soil slice, within `tol = 1e-9·model width` (E12f). Air slices
    /// carry no load, so they do not count.
    pub fn unused(&self, slices: &[Slice], model_width: f64) -> bool {
        let tol = LINE_TOUCH_FRACTION * model_width;
        let soil = |s: &&Slice| s.weight > 0.0;
        let udl_unused = |u: &Udl| {
            !slices
                .iter()
                .filter(soil)
                .any(|s| s.x_right.min(u.x2) - s.x_left.max(u.x1) > 0.0)
        };
        let line_unused = |l: &Line| {
            !slices
                .iter()
                .filter(soil)
                .any(|s| s.x_left - tol <= l.x && l.x <= s.x_right + tol)
        };
        self.udls.iter().any(udl_unused) || self.lines.iter().any(line_unused)
    }
}

fn invalid(msg: impl Into<String>) -> OgsError {
    OgsError::InvalidModel(msg.into())
}

/// Name of a load in the messages: its id, or its position when it has none.
fn label(id: &Option<String>, index: usize) -> String {
    match id {
        Some(id) => format!("'{id}'"),
        None => format!("#{index}"),
    }
}

/// The first field of the document that needs version `"0.3"` (E13a), named as in the JSON, or `None`.
///
/// The order is the one of the contract (F3.1): the undrained model and its fields (material by material), the
/// polyline surface, the new methods and `analysis.interslice`. Serde cannot depend on the version, so the gate is
/// here, like the one of v0.2.
fn first_v03_field(model: &Model) -> Option<String> {
    for (i, m) in model.materials.iter().enumerate() {
        if m.model == MaterialModel::Undrained {
            return Some(format!("materials[{i}].model = \"undrained\""));
        }
        for (name, present) in [
            ("undrained_strength", m.undrained_strength.is_some()),
            ("strength_datum", m.strength_datum.is_some()),
            ("strength_gradient", m.strength_gradient.is_some()),
            ("strength_limit", m.strength_limit.is_some()),
        ] {
            if present {
                return Some(format!("materials[{i}].{name}"));
            }
        }
    }
    let a = &model.analysis;
    if matches!(a.surface, Some(SurfaceSpec::Polyline { .. })) {
        return Some("analysis.surface.type = \"polyline\"".to_string());
    }
    for (name, kind) in [
        ("morgenstern_price", MethodKind::MorgensternPrice),
        ("janbu_simplified", MethodKind::JanbuSimplified),
        ("janbu_corrected", MethodKind::JanbuCorrected),
    ] {
        if a.methods.contains(&kind) {
            return Some(format!("analysis.methods = \"{name}\""));
        }
    }
    a.interslice
        .is_some()
        .then(|| "analysis.interslice".to_string())
}

/// The first field of the document that needs version `"0.4"` (E14a), named as in the JSON, or `None`: a non-empty
/// `reinforcements` (an empty list counts as absent, like `loads`).
fn first_v04_field(model: &Model) -> Option<&'static str> {
    (!model.reinforcements.is_empty()).then_some("reinforcements")
}

/// The first field of the document that needs version `"0.5"` (E15a, E15i-1), named as in the JSON, or `None`:
/// `analysis.tension_crack` (the ponded water has no field and applies in every version, D1), and in a `pile` the
/// fields `lateral_pressure` and `capacity`.
fn first_v05_field(model: &Model) -> Option<&'static str> {
    if model.analysis.tension_crack.is_some() {
        return Some("tension_crack");
    }
    model.reinforcements.iter().find_map(|r| match r {
        crate::model::Reinforcement::Pile(p) if p.lateral_pressure.is_some() => {
            Some("lateral_pressure")
        }
        crate::model::Reinforcement::Pile(p) if p.capacity.is_some() => Some("capacity"),
        _ => None,
    })
}

/// `analysis.tension_crack` (E15b): `depth` finite and `> 0` (or `"auto"`), `water_fill` finite and in `[0, 1]`. The
/// error carries the path `analysis.tension_crack.<campo>`; a missing field is reported by the deserializer with the
/// same path.
fn validate_tension_crack(model: &Model) -> Result<(), OgsError> {
    let Some(tc) = &model.analysis.tension_crack else {
        return Ok(());
    };
    if let CrackDepth::Fixed(d) = tc.depth
        && !(d.is_finite() && d > 0.0)
    {
        return Err(invalid(format!(
            "analysis.tension_crack.depth debe ser finito y mayor que 0 (o \"auto\"), no {d}"
        )));
    }
    let w = tc.water_fill;
    if !(w.is_finite() && (0.0..=1.0).contains(&w)) {
        return Err(invalid(format!(
            "analysis.tension_crack.water_fill debe ser finito y estar en [0, 1], no {w}"
        )));
    }
    Ok(())
}

/// The first field of the document that needs version `"0.6"` (F6.1), named as in the JSON, or `None`: per material,
/// in the order of the list, `model = "hoek_brown"` or `model = "shansep"`, then the fields `ucs`, `gsi`, `mi`,
/// `disturbance` and `shansep` (in that order, present in any material), and last `analysis.search.non_circular`.
fn first_v06_field(model: &Model) -> Option<String> {
    for (i, m) in model.materials.iter().enumerate() {
        if m.model == MaterialModel::HoekBrown {
            return Some(format!("materials[{i}].model = \"hoek_brown\""));
        }
        if m.model == MaterialModel::Shansep {
            return Some(format!("materials[{i}].model = \"shansep\""));
        }
        for (name, present) in [
            ("ucs", m.ucs.is_some()),
            ("gsi", m.gsi.is_some()),
            ("mi", m.mi.is_some()),
            ("disturbance", m.disturbance.is_some()),
            ("shansep", m.shansep.is_some()),
        ] {
            if present {
                return Some(format!("materials[{i}].{name}"));
            }
        }
    }
    if model
        .analysis
        .search
        .as_ref()
        .is_some_and(|s| s.non_circular.is_some())
    {
        return Some("analysis.search.non_circular".to_string());
    }
    None
}

fn first_v07_field(model: &Model) -> Option<&'static str> {
    model
        .analysis
        .search
        .as_ref()
        .and_then(|s| s.non_circular.as_ref())
        .and_then(|n| n.global.as_ref())
        .map(|_| "analysis.search.non_circular.global")
}

fn validate_v07(model: &Model) -> Result<(), OgsError> {
    if let Some(g) = model
        .analysis
        .search
        .as_ref()
        .and_then(|s| s.non_circular.as_ref())
        .and_then(|n| n.global.as_ref())
    {
        if !(50..=2000).contains(&g.generated()) {
            return Err(invalid(format!(
                "analysis.search.non_circular.global.generated debe estar en [50, 2000], no {}",
                g.generated()
            )));
        }
        if g.seed() > MAX_GLOBAL_SEED {
            return Err(invalid(format!(
                "analysis.search.non_circular.global.seed debe estar en [0, 9007199254740991], no {}",
                g.seed()
            )));
        }
    }
    Ok(())
}

/// True when some material of the model is `hoek_brown` or `shansep` (F6.5).
fn has_new_material(model: &Model) -> bool {
    model
        .materials
        .iter()
        .any(|m| matches!(m.model, MaterialModel::HoekBrown | MaterialModel::Shansep))
}

/// The interactions and rejections of F6.4 and F6.5: Bishop with `non_circular`, a crack with automatic depth and
/// Ito-Matsui with a `hoek_brown` or `shansep` material, and the ranges of `non_circular`.
fn validate_v06(model: &Model) -> Result<(), OgsError> {
    let nc = model
        .analysis
        .search
        .as_ref()
        .and_then(|s| s.non_circular.as_ref());
    if let Some(nc) = nc {
        if let Some(seeds) = nc.seeds
            && !(1..=10).contains(&seeds)
        {
            return Err(invalid(format!(
                "analysis.search.non_circular.seeds debe estar en [1, 10], no {seeds}"
            )));
        }
        if let Some(max_vertices) = nc.max_vertices
            && !matches!(max_vertices, 9 | 17 | 33)
        {
            return Err(invalid(format!(
                "analysis.search.non_circular.max_vertices debe ser 9, 17 o 33, no {max_vertices}"
            )));
        }
        if model.analysis.methods.contains(&MethodKind::Bishop) {
            return Err(invalid(
                "el método bishop no se admite con analysis.search.non_circular \
                 (la superficie crítica es una polilínea)",
            ));
        }
    }
    if has_new_material(model)
        && model
            .analysis
            .tension_crack
            .as_ref()
            .is_some_and(|tc| tc.depth == CrackDepth::Auto)
    {
        return Err(invalid(
            "analysis.tension_crack.depth \"auto\" no se admite con materiales hoek_brown o shansep; \
             use una profundidad fija",
        ));
    }
    if has_new_material(model)
        && model.reinforcements.iter().any(|r| {
            matches!(
                r,
                crate::model::Reinforcement::Pile(p) if p.lateral_pressure.is_some()
            )
        })
    {
        return Err(invalid(
            "lateral_pressure (Ito-Matsui) no se admite con materiales hoek_brown o shansep",
        ));
    }
    Ok(())
}

/// `version`, finiteness, ranges and ids of the v0.2 fields (E12a), the version gate of the v0.3 fields (E13a), of
/// the v0.4 fields (E14a), of the v0.5 fields (E15a) and of the v0.6 fields (F6.1), the rules of `reinforcements`
/// (E14b), of `analysis.tension_crack` (E15b) and the interactions of F6.4 and F6.5. It does not need the geometry.
///
/// Version `"0.1"` admits no `loads` and no `analysis.seismic`; an empty `loads` list counts as absent. Versions
/// `"0.1"` and `"0.2"` admit no v0.3 field: the error names the first one, `<campo> requiere version "0.3"`. A
/// version below `"0.4"` admits no `reinforcements`: `reinforcements requiere version "0.4"` (the v0.3 gate goes
/// first). A version below `"0.6"` admits no v0.6 field (F6.1).
pub fn validate_document(model: &Model) -> Result<(), OgsError> {
    let has_loads = !model.loads.is_empty();
    let has_seismic = model.analysis.seismic.is_some();
    if ![
        FORMAT_VERSION,
        FORMAT_VERSION_V02,
        FORMAT_VERSION_V03,
        FORMAT_VERSION_V04,
        FORMAT_VERSION_V05,
        FORMAT_VERSION_V06,
        FORMAT_VERSION_V07,
    ]
    .contains(&model.version.as_str())
    {
        return Err(invalid(format!(
            "version debe ser \"{FORMAT_VERSION}\", \"{FORMAT_VERSION_V02}\", \"{FORMAT_VERSION_V03}\", \"{FORMAT_VERSION_V04}\", \"{FORMAT_VERSION_V05}\", \"{FORMAT_VERSION_V06}\" o \"{FORMAT_VERSION_V07}\", no \"{}\"",
            model.version
        )));
    }
    if model.version == FORMAT_VERSION && (has_loads || has_seismic) {
        return Err(invalid(format!(
            "los campos 'loads' y 'analysis.seismic' requieren version \"{FORMAT_VERSION_V02}\""
        )));
    }
    if ![
        FORMAT_VERSION_V03,
        FORMAT_VERSION_V04,
        FORMAT_VERSION_V05,
        FORMAT_VERSION_V06,
        FORMAT_VERSION_V07,
    ]
    .contains(&model.version.as_str())
        && let Some(field) = first_v03_field(model)
    {
        return Err(invalid(format!(
            "{field} requiere version \"{FORMAT_VERSION_V03}\""
        )));
    }
    if ![
        FORMAT_VERSION_V04,
        FORMAT_VERSION_V05,
        FORMAT_VERSION_V06,
        FORMAT_VERSION_V07,
    ]
    .contains(&model.version.as_str())
        && let Some(field) = first_v04_field(model)
    {
        return Err(invalid(format!(
            "{field} requiere version \"{FORMAT_VERSION_V04}\""
        )));
    }
    if ![FORMAT_VERSION_V05, FORMAT_VERSION_V06, FORMAT_VERSION_V07]
        .contains(&model.version.as_str())
        && let Some(field) = first_v05_field(model)
    {
        return Err(invalid(format!(
            "{field} requiere version \"{FORMAT_VERSION_V05}\""
        )));
    }
    if ![FORMAT_VERSION_V06, FORMAT_VERSION_V07].contains(&model.version.as_str())
        && let Some(field) = first_v06_field(model)
    {
        return Err(invalid(format!(
            "{field} requiere version \"{FORMAT_VERSION_V06}\""
        )));
    }
    if model.version != FORMAT_VERSION_V07
        && let Some(field) = first_v07_field(model)
    {
        return Err(invalid(format!(
            "{field} requiere version \"{FORMAT_VERSION_V07}\""
        )));
    }
    validate_v06(model)?;
    validate_v07(model)?;
    if let Some(s) = &model.analysis.seismic {
        if !(s.kh.is_finite() && (0.0..1.0).contains(&s.kh)) {
            return Err(invalid("analysis.seismic.kh debe estar en [0, 1)"));
        }
        if !(s.kv.is_finite() && s.kv > -1.0 && s.kv < 1.0) {
            return Err(invalid("analysis.seismic.kv debe estar en (-1, 1)"));
        }
    }
    let mut seen: Vec<&str> = Vec::new();
    for (i, load) in model.loads.iter().enumerate() {
        let id = match load {
            Load::Udl(u) => &u.id,
            Load::Line(l) => &l.id,
        };
        if let Some(id) = id {
            if seen.contains(&id.as_str()) {
                return Err(invalid(format!("el id de carga '{id}' está repetido")));
            }
            seen.push(id);
        }
        let name = label(id, i);
        match load {
            Load::Udl(u) => {
                if !(u.x1.is_finite() && u.x2.is_finite()) {
                    return Err(invalid(format!(
                        "la carga {name} tiene coordenadas no finitas"
                    )));
                }
                if u.x1 >= u.x2 {
                    return Err(invalid(format!("la carga {name} tiene x1 >= x2")));
                }
                if !(u.q.is_finite() && u.q >= 0.0) {
                    return Err(invalid(format!(
                        "la carga {name} debe tener q finito y mayor o igual que 0"
                    )));
                }
            }
            Load::Line(l) => {
                if !l.x.is_finite() {
                    return Err(invalid(format!(
                        "la carga {name} tiene coordenadas no finitas"
                    )));
                }
                if !(l.p.is_finite() && l.p >= 0.0) {
                    return Err(invalid(format!(
                        "la carga {name} debe tener p finito y mayor o igual que 0"
                    )));
                }
                if !(l.angle.is_finite() && (-90.0..=90.0).contains(&l.angle)) {
                    return Err(invalid(format!(
                        "la carga {name} debe tener angle en [-90, 90] grados"
                    )));
                }
            }
        }
    }
    validate_tension_crack(model)?;
    crate::reinforcement::validate(&model.reinforcements)
}

/// The positions of the loads against the model extent `[x_min, x_max]`, with tolerance `tol` (E12a).
pub fn validate_range(model: &Model, x_min: f64, x_max: f64, tol: f64) -> Result<(), OgsError> {
    let inside = |x: f64| x >= x_min - tol && x <= x_max + tol;
    for (i, load) in model.loads.iter().enumerate() {
        let (id, xs): (&Option<String>, Vec<f64>) = match load {
            Load::Udl(u) => (&u.id, vec![u.x1, u.x2]),
            Load::Line(l) => (&l.id, vec![l.x]),
        };
        if !xs.iter().all(|&x| inside(x)) {
            return Err(invalid(format!(
                "la carga {} sale del rango x del modelo [{x_min}, {x_max}]",
                label(id, i)
            )));
        }
    }
    Ok(())
}
