//! Seismic coefficients and surface loads (schema v0.2, amendments E12a and E12b).
//!
//! - [`validate_document`] checks the new fields that do not need the geometry: the version, finiteness, ranges and
//!   repeated ids. [`validate_range`] checks the x positions against the model extent, once the model is prepared.
//! - [`LoadCase`] is the resolved form the slicer works with: `kh`, `kv`, the distributed loads and the line loads,
//!   with the angle in radians. `LoadCase::default()` is neutral (no seismic force, no loads) and leaves the slices
//!   exactly as before v0.2.
//! - [`LoadCase::unused`] tells whether a declared load does not act on any analysed soil slice (note
//!   `load_outside_mass`).

use crate::OgsError;
use crate::model::{FORMAT_VERSION, FORMAT_VERSION_V02, Load, Model};
use crate::slicer::Slice;

/// Informative note (E12b): a declared load does not act on any soil slice of the reported surface.
pub const LOAD_OUTSIDE_MASS: &str = "load_outside_mass";

/// Offset of the breakpoints around a line load, relative to the model width (E12b): `x ± 1e-6 · width`.
const LINE_BREAK_FRACTION: f64 = 1e-6;

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

    /// True when there is no seismic force and no load: the slices are those of v0.1.
    pub fn is_neutral(&self) -> bool {
        self.kh == 0.0 && self.kv == 0.0 && self.udls.is_empty() && self.lines.is_empty()
    }

    /// Extra slice boundaries (E12b): `x1` and `x2` of every `udl`, and `x ± 1e-6·width` of every `line`.
    pub(crate) fn break_points(&self, model_width: f64) -> Vec<f64> {
        let d = LINE_BREAK_FRACTION * model_width;
        let mut xs = Vec::with_capacity(2 * self.udls.len() + 2 * self.lines.len());
        for u in &self.udls {
            xs.push(u.x1);
            xs.push(u.x2);
        }
        for l in &self.lines {
            xs.push(l.x - d);
            xs.push(l.x + d);
        }
        xs
    }

    /// True when some declared load acts on no soil slice of `slices` (note `load_outside_mass`, E12b).
    ///
    /// A `udl` acts if it overlaps the x extent of a soil slice with positive length; a `line` acts if its `x` lies in
    /// `[x_left, x_right)` of a soil slice. Air slices carry no load, so they do not count.
    pub fn unused(&self, slices: &[Slice]) -> bool {
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
                .any(|s| s.x_left <= l.x && l.x < s.x_right)
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

/// `version`, finiteness, ranges and ids of the v0.2 fields (E12a). It does not need the geometry.
///
/// Version `"0.1"` admits no `loads` and no `analysis.seismic`; an empty `loads` list counts as absent.
pub fn validate_document(model: &Model) -> Result<(), OgsError> {
    let has_loads = !model.loads.is_empty();
    let has_seismic = model.analysis.seismic.is_some();
    if model.version != FORMAT_VERSION && model.version != FORMAT_VERSION_V02 {
        return Err(invalid(format!(
            "version debe ser \"{FORMAT_VERSION}\" o \"{FORMAT_VERSION_V02}\", no \"{}\"",
            model.version
        )));
    }
    if model.version == FORMAT_VERSION && (has_loads || has_seismic) {
        return Err(invalid(format!(
            "los campos 'loads' y 'analysis.seismic' requieren version \"{FORMAT_VERSION_V02}\""
        )));
    }
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
    Ok(())
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
