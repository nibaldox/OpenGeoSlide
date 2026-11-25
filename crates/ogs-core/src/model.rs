//! `.ogs.json` model v0.1 and v0.2 (contract §1, amendment E12a). Field names are snake_case and frozen.
//! Angles are in degrees. Units are not converted by the engine.
//!
//! v0.2 adds `loads` (surface loads) and `analysis.seismic` (pseudo-static `kh`, `kv`). A document without them
//! gives the same result in both versions.

use serde::{Deserialize, Serialize};

/// A point `[x, y]`.
pub type Point = [f64; 2];

/// Required value of `Model.format`.
pub const FORMAT: &str = "opengeoslide";
/// Base value of `Model.version` (the model format version, not the crate version).
pub const FORMAT_VERSION: &str = "0.1";
/// Version that admits `loads` and `analysis.seismic` (amendment E12a).
pub const FORMAT_VERSION_V02: &str = "0.2";

fn default_water_unit_weight() -> f64 {
    9.81
}

/// Complete model document.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Model {
    pub format: String,
    pub version: String,
    #[serde(default)]
    pub meta: Meta,
    #[serde(default)]
    pub units: Option<String>,
    pub materials: Vec<Material>,
    pub regions: Vec<Region>,
    #[serde(default)]
    pub water: Option<Water>,
    /// Surface loads (v0.2). Empty when absent; a non-empty list needs `version: "0.2"`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub loads: Vec<Load>,
    #[serde(default)]
    pub slope: SlopeSettings,
    #[serde(default)]
    pub analysis: AnalysisSettings,
}

/// Free-form metadata.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Meta {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

/// Constitutive model. Only Mohr-Coulomb exists in v0.1.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MaterialModel {
    MohrCoulomb,
}

/// Soil material. `friction_angle` in degrees; for φ = 0 use `friction_angle: 0` and `cohesion = Su`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Material {
    pub id: String,
    pub name: String,
    pub model: MaterialModel,
    pub unit_weight: f64,
    #[serde(default)]
    pub unit_weight_sat: Option<f64>,
    pub cohesion: f64,
    pub friction_angle: f64,
    #[serde(default)]
    pub ru: Option<f64>,
}

/// Simple polygon assigned to a material. Closed implicitly; the first vertex is not repeated.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Region {
    pub material: String,
    pub polygon: Vec<Point>,
}

/// Water data. `unit_weight` defaults to 9.81.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Water {
    #[serde(default = "default_water_unit_weight")]
    pub unit_weight: f64,
    #[serde(default)]
    pub piezometric_line: Option<Vec<Point>>,
}

/// Surface load (v0.2). Serialized with a `"type"` tag: `"udl"` or `"line"`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Load {
    Udl(UdlLoad),
    Line(LineLoad),
}

/// Vertical distributed load `q` (kPa, or psf in imperial units) on the ground between `x1` and `x2`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UdlLoad {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub x1: f64,
    pub x2: f64,
    pub q: f64,
}

/// Line load `p` (kN/m, or lbf/ft in imperial units) applied at `(x, y_top(x))`. `angle` is in degrees, measured from
/// the downward vertical; positive tilts the load toward +x of the model.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LineLoad {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub x: f64,
    pub p: f64,
    #[serde(default)]
    pub angle: f64,
}

/// Pseudo-static seismic coefficients (v0.2). Both default to 0.
///
/// `kh` in [0, 1): the horizontal force `kh·W` acts in the sliding direction. `kv` in (−1, 1): with `kv > 0` the force
/// `kv·W` acts downward. They apply to the soil weight `W` of each slice, never to the loads.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct SeismicSettings {
    pub kh: f64,
    pub kv: f64,
}

/// Direction in which the sliding mass moves.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    #[default]
    Auto,
    LeftToRight,
    RightToLeft,
}

/// Slope settings.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SlopeSettings {
    #[serde(default)]
    pub direction: Direction,
}

/// Limit-equilibrium method.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MethodKind {
    Bishop,
    Spencer,
}

/// Circle `(xc, yc, r)`.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Circle {
    pub xc: f64,
    pub yc: f64,
    pub r: f64,
}

/// Fixed surface. Serialized as `{"type": "circle", ...}`.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum SurfaceSpec {
    Circle(Circle),
}

/// Circular entry/exit search (§4.4). Serialized with `"type": "circular_entry_exit"`.
///
/// `entry` and `exit` are x-ranges `[x_min, x_max]`. Defaults are documented on `SearchSpecWire`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(from = "SearchSpecWire", into = "SearchSpecWire")]
pub struct SearchSpec {
    pub entry: Option<[f64; 2]>,
    pub exit: Option<[f64; 2]>,
    pub n_entry: usize,
    pub n_exit: usize,
    pub n_radius: usize,
    pub max_radius_factor: f64,
    pub min_width: Option<f64>,
    pub refine: bool,
}

/// Wire format of [`SearchSpec`]: carries the `type` tag, which has no field in the public struct.
///
/// Defaults: `entry`/`exit` omitted (full x-extent), `n_entry = n_exit = n_radius = 20`,
/// `max_radius_factor = 5.0`, `min_width` omitted (1 % of model width, resolved by W1c), `refine = true`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct SearchSpecWire {
    #[serde(rename = "type")]
    kind: SearchKind,
    entry: Option<[f64; 2]>,
    exit: Option<[f64; 2]>,
    n_entry: usize,
    n_exit: usize,
    n_radius: usize,
    max_radius_factor: f64,
    min_width: Option<f64>,
    refine: bool,
}

impl Default for SearchSpecWire {
    fn default() -> Self {
        Self {
            kind: SearchKind::default(),
            entry: None,
            exit: None,
            n_entry: 20,
            n_exit: 20,
            n_radius: 20,
            max_radius_factor: 5.0,
            min_width: None,
            refine: true,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum SearchKind {
    #[default]
    CircularEntryExit,
}

impl From<SearchSpecWire> for SearchSpec {
    fn from(w: SearchSpecWire) -> Self {
        Self {
            entry: w.entry,
            exit: w.exit,
            n_entry: w.n_entry,
            n_exit: w.n_exit,
            n_radius: w.n_radius,
            max_radius_factor: w.max_radius_factor,
            min_width: w.min_width,
            refine: w.refine,
        }
    }
}

impl From<SearchSpec> for SearchSpecWire {
    fn from(s: SearchSpec) -> Self {
        Self {
            kind: SearchKind::CircularEntryExit,
            entry: s.entry,
            exit: s.exit,
            n_entry: s.n_entry,
            n_exit: s.n_exit,
            n_radius: s.n_radius,
            max_radius_factor: s.max_radius_factor,
            min_width: s.min_width,
            refine: s.refine,
        }
    }
}

/// Analysis settings. If `surface` is set and `search` is not, that surface is analyzed.
/// If `search` is set, `surface` is ignored. If neither is set, the analysis fails with `NoSurface`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct AnalysisSettings {
    pub methods: Vec<MethodKind>,
    pub slices: usize,
    pub tolerance: f64,
    pub max_iterations: usize,
    pub min_m_alpha: f64,
    pub surface: Option<SurfaceSpec>,
    pub search: Option<SearchSpec>,
    /// Pseudo-static coefficients (v0.2). `None` is the same as `kh = kv = 0`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seismic: Option<SeismicSettings>,
}

impl Default for AnalysisSettings {
    fn default() -> Self {
        Self {
            methods: vec![MethodKind::Bishop],
            slices: 50,
            tolerance: 1e-5,
            max_iterations: 500,
            min_m_alpha: 0.2,
            surface: None,
            search: None,
            seismic: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ACADS_1A: &str = include_str!("../../../examples/acads1a.ogs.json");

    #[test]
    fn minimal_model_gets_section1_defaults() {
        let json = r#"{
            "format": "opengeoslide",
            "version": "0.1",
            "materials": [{"id": "soil", "name": "Soil", "model": "mohr_coulomb",
                           "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6}],
            "regions": [{"material": "soil", "polygon": [[0, 0], [10, 0], [10, 5]]}],
            "analysis": {}
        }"#;
        let m: Model = serde_json::from_str(json).expect("minimal model must parse");
        assert!(m.water.is_none());
        assert!(m.meta.id.is_none() && m.units.is_none());
        assert_eq!(m.slope.direction, Direction::Auto);
        let a = &m.analysis;
        assert_eq!(a.methods, vec![MethodKind::Bishop]);
        assert_eq!(a.slices, 50);
        assert_eq!(a.tolerance, 1e-5);
        assert_eq!(a.max_iterations, 500);
        assert_eq!(a.min_m_alpha, 0.2);
        assert!(a.surface.is_none() && a.search.is_none());
        assert!(m.materials[0].unit_weight_sat.is_none() && m.materials[0].ru.is_none());
    }

    #[test]
    fn water_unit_weight_defaults_to_9_81() {
        let w: Water =
            serde_json::from_str(r#"{"piezometric_line": [[0, 12.0], [55, 6.0]]}"#).unwrap();
        assert_eq!(w.unit_weight, 9.81);
        assert_eq!(w.piezometric_line.as_ref().map(Vec::len), Some(2));
    }

    #[test]
    fn search_defaults_and_type_tag() {
        let s: SearchSpec = serde_json::from_str(r#"{"type": "circular_entry_exit"}"#).unwrap();
        assert_eq!((s.n_entry, s.n_exit, s.n_radius), (20, 20, 20));
        assert_eq!(s.max_radius_factor, 5.0);
        assert!(s.refine);
        assert!(s.entry.is_none() && s.exit.is_none() && s.min_width.is_none());
        let out = serde_json::to_string(&s).unwrap();
        assert!(out.contains(r#""type":"circular_entry_exit""#), "{out}");
    }

    #[test]
    fn surface_circle_is_tagged() {
        let s: SurfaceSpec =
            serde_json::from_str(r#"{"type": "circle", "xc": 120.0, "yc": 90.0, "r": 80.0}"#)
                .unwrap();
        let SurfaceSpec::Circle(c) = s;
        assert_eq!((c.xc, c.yc, c.r), (120.0, 90.0, 80.0));
    }

    #[test]
    fn acads_example_round_trips() {
        let m: Model = serde_json::from_str(ACADS_1A).expect("example must parse");
        assert_eq!(m.format, "opengeoslide");
        assert_eq!(m.version, "0.1");
        assert_eq!(m.meta.id.as_deref(), Some("V047a"));
        assert_eq!(m.materials[0].unit_weight, 20.0);
        assert_eq!(m.materials[0].cohesion, 3.0);
        assert_eq!(m.materials[0].friction_angle, 19.6);
        assert_eq!(m.regions[0].polygon.len(), 6);
        assert_eq!(
            m.analysis.methods,
            vec![MethodKind::Bishop, MethodKind::Spencer]
        );
        let s = m
            .analysis
            .search
            .as_ref()
            .expect("example uses default search");
        assert_eq!((s.n_entry, s.n_exit, s.n_radius), (20, 20, 20));
        assert!(s.entry.is_none() && s.exit.is_none());

        let json = serde_json::to_string(&m).unwrap();
        let back: Model = serde_json::from_str(&json).unwrap();
        assert_eq!(m, back);
    }
}
