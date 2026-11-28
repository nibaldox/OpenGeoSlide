//! `.ogs.json` model v0.1, v0.2, v0.3, v0.4 and v0.5 (contract §1, amendments E12a, E13a, E14a-E14b and E15a-E15b). Field
//! names are snake_case and frozen. Angles are in degrees. Units are not converted by the engine.
//!
//! v0.2 adds `loads` (surface loads) and `analysis.seismic` (pseudo-static `kh`, `kv`). v0.3 adds the undrained
//! material, the polyline surface, the methods Morgenstern-Price and Janbu, and `analysis.interslice`. v0.4 adds
//! `reinforcements` (anchors, nails, geosynthetics, piles and sheet piles). v0.5 adds `analysis.tension_crack` (a
//! tension crack, dry or with water; E15b). A document without the fields of a later version gives the same result in
//! every version.

use serde::{Deserialize, Serialize};

/// A point `[x, y]`.
pub type Point = [f64; 2];

/// Required value of `Model.format`.
pub const FORMAT: &str = "opengeoslide";
/// Base value of `Model.version` (the model format version, not the crate version).
pub const FORMAT_VERSION: &str = "0.1";
/// Version that admits `loads` and `analysis.seismic` (amendment E12a).
pub const FORMAT_VERSION_V02: &str = "0.2";
/// Version that admits the undrained material, the polyline surface, `morgenstern_price`, `janbu_simplified`,
/// `janbu_corrected` and `analysis.interslice` (amendment E13a).
pub const FORMAT_VERSION_V03: &str = "0.3";
/// Version that admits `reinforcements` (amendment E14a).
pub const FORMAT_VERSION_V04: &str = "0.4";
/// Version that admits `analysis.tension_crack` (amendment E15a).
pub const FORMAT_VERSION_V05: &str = "0.5";
/// Version that admits the Hoek-Brown and SHANSEP materials and `analysis.search.non_circular` (F6.1).
pub const FORMAT_VERSION_V06: &str = "0.6";
/// Version that admits global non-circular search (F7.1).
pub const FORMAT_VERSION_V07: &str = "0.7";

/// `γw` by default in kN/m³ (SI), contract §1.
pub const DEFAULT_WATER_UNIT_WEIGHT_SI: f64 = 9.81;

/// Feet per metre, with the same constant as `apps/web/src/editor/state/units.ts` (`FT_PER_M = 1 / 0.3048`).
const FT_PER_M: f64 = 1.0 / 0.3048;
/// Pounds-force per kN, as `LBF_PER_KN = 1000 / N_PER_LBF` of `units.ts` (`N_PER_LBF = 4.4482216152605`).
const LBF_PER_KN: f64 = 1000.0 / 4.4482216152605;

/// Whether the `units` label of the model is imperial. The same detection as the web application
/// (`isImperialUnits`): case and leading spaces do not matter, and it accepts the abbreviation `imp…`.
pub fn is_imperial_units(units: Option<&str>) -> bool {
    units.is_some_and(|u| {
        u.trim_start()
            .get(..3)
            .is_some_and(|p| p.eq_ignore_ascii_case("imp"))
    })
}

/// `γw` when `water.unit_weight` is absent (E15l-6): 9.81 kN/m³ in `SI`, and in imperial units the same 9.81 kN/m³
/// converted with the factor of `units.ts` (`UNIT_FACTORS.unitWeight = LBF_PER_KN / FT_PER_M³`, ≈ 62.45 pcf).
pub fn default_water_unit_weight(units: Option<&str>) -> f64 {
    if is_imperial_units(units) {
        DEFAULT_WATER_UNIT_WEIGHT_SI * (LBF_PER_KN / FT_PER_M.powi(3))
    } else {
        DEFAULT_WATER_UNIT_WEIGHT_SI
    }
}

/// Informative note (E15m-6): the model is imperial, uses water and does not declare `water.unit_weight`, so the engine
/// takes `γw = 62.4 pcf` (9.81 kN/m³). Before the v0.4.0 it took 9.81 in imperial units too.
pub const WATER_UNIT_WEIGHT_DEFAULT: &str = "water_unit_weight_default";

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
    /// Reinforcements (v0.4, E14b). Empty when absent; a non-empty list needs `version: "0.4"`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub reinforcements: Vec<Reinforcement>,
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

/// Constitutive model. `Undrained` needs `version: "0.3"` (E13a).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MaterialModel {
    MohrCoulomb,
    /// φ = 0 with undrained strength `Su` (constant, or linear with the elevation; E13b).
    Undrained,
    /// Generalized Hoek-Brown rock mass (F6.2).
    HoekBrown,
    /// Stress-history normalized undrained strength (F6.3).
    Shansep,
}

/// SHANSEP parameters and the source of OCR (F6.3).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ShansepSpec {
    pub ratio: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exponent: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ocr: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pop: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ocr_by_elevation: Option<Vec<[f64; 2]>>,
}

impl ShansepSpec {
    pub fn exponent(&self) -> f64 {
        self.exponent.unwrap_or(0.8)
    }
}

/// Global generator, chosen automatically unless explicitly specified (F7.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum GlobalAlgorithm {
    #[default]
    Auto,
    Block,
    Annealing,
}

/// Default number of generated candidates (F7.1).
pub const DEFAULT_GLOBAL_GENERATED: usize = 500;
/// Maximum JSON-safe seed.
pub const MAX_GLOBAL_SEED: u64 = 9_007_199_254_740_991;

/// Deserializes `T` only from a JSON object: serde would also take an array as the fields in order, and the schema
/// does not (E17e §5).
fn only_object<'de, D, T>(deserializer: D, expecting: &'static str) -> Result<T, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    struct OnlyMap<T>(&'static str, std::marker::PhantomData<T>);
    impl<'de, T: Deserialize<'de>> serde::de::Visitor<'de> for OnlyMap<T> {
        type Value = T;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str(self.0)
        }
        fn visit_map<A: serde::de::MapAccess<'de>>(self, map: A) -> Result<T, A::Error> {
            T::deserialize(serde::de::value::MapAccessDeserializer::new(map))
        }
    }
    deserializer.deserialize_map(OnlyMap(expecting, std::marker::PhantomData))
}

/// Global search settings. Absent fields are preserved in round trips.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
pub struct GlobalSpec {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub algorithm: Option<GlobalAlgorithm>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub generated: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seed: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub polish: Option<bool>,
}

impl<'de> Deserialize<'de> for GlobalSpec {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Raw {
            #[serde(default)]
            algorithm: Option<GlobalAlgorithm>,
            #[serde(default)]
            generated: Option<usize>,
            #[serde(default)]
            seed: Option<u64>,
            #[serde(default)]
            polish: Option<bool>,
        }
        let raw: Raw = only_object(
            deserializer,
            "un objeto analysis.search.non_circular.global con algorithm, generated, seed y polish",
        )?;
        Ok(GlobalSpec {
            algorithm: raw.algorithm,
            generated: raw.generated,
            seed: raw.seed,
            polish: raw.polish,
        })
    }
}

impl GlobalSpec {
    pub fn algorithm(&self) -> GlobalAlgorithm {
        self.algorithm.unwrap_or_default()
    }
    pub fn generated(&self) -> usize {
        self.generated.unwrap_or(DEFAULT_GLOBAL_GENERATED)
    }
    pub fn seed(&self) -> u64 {
        self.seed.unwrap_or(0)
    }
    pub fn polish(&self) -> bool {
        self.polish.unwrap_or(true)
    }
}

/// Non-circular search refinement parameters (F6.4).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct NonCircularSpec {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seeds: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_vertices: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub global: Option<GlobalSpec>,
}

impl<'de> Deserialize<'de> for NonCircularSpec {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Raw {
            #[serde(default)]
            seeds: Option<usize>,
            #[serde(default)]
            max_vertices: Option<usize>,
            #[serde(default)]
            global: Option<GlobalSpec>,
        }
        let raw: Raw = only_object(
            deserializer,
            "un objeto analysis.search.non_circular con seeds, max_vertices y global",
        )?;
        Ok(NonCircularSpec {
            seeds: raw.seeds,
            max_vertices: raw.max_vertices,
            global: raw.global,
        })
    }
}

impl NonCircularSpec {
    pub fn seeds(&self) -> usize {
        self.seeds.unwrap_or(3)
    }
    pub fn max_vertices(&self) -> usize {
        self.max_vertices.unwrap_or(33)
    }
}

/// Soil material. `friction_angle` in degrees; for φ = 0 use `friction_angle: 0` and `cohesion = Su`, or the
/// `undrained` model (v0.3).
///
/// Which fields are required or forbidden depends on `model` (F3.2), so the type keeps them optional and
/// `strength::resolve_materials` checks them:
/// - `mohr_coulomb`: `cohesion` and `friction_angle` required; the four `undrained_*`/`strength_*` fields forbidden;
/// - `undrained`: `undrained_strength` required; `cohesion` and `friction_angle` forbidden. `strength_datum` (an
///   elevation, not a depth) and `strength_gradient` go together; `strength_limit` needs the gradient.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Material {
    pub id: String,
    pub name: String,
    pub model: MaterialModel,
    pub unit_weight: f64,
    #[serde(default)]
    pub unit_weight_sat: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cohesion: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub friction_angle: Option<f64>,
    #[serde(default)]
    pub ru: Option<f64>,
    /// `Su` at the datum elevation (or everywhere, without `strength_datum`). v0.3, `undrained` only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub undrained_strength: Option<f64>,
    /// Elevation `y` where the strength is `undrained_strength`. v0.3, `undrained` only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strength_datum: Option<f64>,
    /// Increase of `Su` per unit of depth below the datum (stress per length; any sign). v0.3, `undrained` only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strength_gradient: Option<f64>,
    /// Cap of `Su` (a maximum for a gradient ≥ 0, a minimum for a gradient < 0). v0.3, `undrained` only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strength_limit: Option<f64>,
    /// Uniaxial compressive strength σci of the intact rock, in the stress unit of the model (F6.2, `hoek_brown` only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ucs: Option<f64>,
    /// Geological Strength Index, in [0, 100] (F6.2, `hoek_brown` only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gsi: Option<f64>,
    /// Hoek-Brown material constant `mi` (F6.2, `hoek_brown` only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mi: Option<f64>,
    /// Disturbance factor D, in [0, 1], with no default (F6.2, `hoek_brown` only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub disturbance: Option<f64>,
    /// SHANSEP parameters and the source of OCR (F6.3, `shansep` only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shansep: Option<ShansepSpec>,
}

/// Simple polygon assigned to a material. Closed implicitly; the first vertex is not repeated.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Region {
    pub material: String,
    pub polygon: Vec<Point>,
}

/// Deserializes a number that may be absent (`#[serde(default)]` gives `None`) but never `null`: the schema declares
/// `water.unit_weight` as `number`, so `"unit_weight": null` stays an error as it was before E15l-6 made the field optional.
fn deserialize_present_f64<'de, D>(deserializer: D) -> Result<Option<f64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    f64::deserialize(deserializer).map(Some)
}

/// Water data. `unit_weight` absent means the default of the units of the model: 9.81 kN/m³ in `SI`, the equivalent
/// (≈ 62.45 pcf) in imperial (see [`default_water_unit_weight`], E15l-6).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Water {
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_present_f64"
    )]
    pub unit_weight: Option<f64>,
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

// ------------------------------------------------------------------------------------------------ reinforcements

/// How a reinforcement acts (E14b): `Active` is a known external force (not divided by `F`), `Passive` is mobilised
/// by the sliding (divided by `F`). Required in every reinforcement, with no default.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Application {
    Active,
    Passive,
}

/// Direction of the force of an `anchor`, a `nail` or a `geosynthetic` (E14b; the exact vectors are E14e, X17).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TensionDirection {
    Axial,
    Tangent,
    Bisector,
}

/// Direction of the force of a `pile` or a `sheet_pile`. `Angle` needs the field `angle`; the other two forbid it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PileDirection {
    Angle,
    Tangent,
    Perpendicular,
}

/// Pull-out model of a tension element (E14b), tagged by `model`. Without it the element is fully anchored at both
/// ends: `T(s) = tensile_capacity`.
///
/// - `bond`: `strength` is the force per metre of element; with `bonded_length` only the last `ℓ ≤ L` metres towards
///   the tip (end 2) are bonded;
/// - `interface`: soil-geosynthetic interaction on both faces (formula: E14c, X17);
/// - `development`: the capacity grows linearly from each end to `tensile_capacity` over `length1` and `length2`
///   (shape: E14c, X17).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "model", rename_all = "snake_case", deny_unknown_fields)]
pub enum Pullout {
    Bond {
        strength: f64,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        bonded_length: Option<f64>,
    },
    Interface {
        adhesion: f64,
        friction_angle: f64,
        coverage: f64,
    },
    Development {
        length1: f64,
        length2: f64,
    },
}

/// `anchor`, `nail` and `geosynthetic` (E14b): a segment from the head `(x1, y1)` to the tip `(x2, y2)`.
/// Forces are per element; the force per metre of slope is divided by `spacing` (1 by default).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TensionElement {
    pub id: String,
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
    pub application: Application,
    /// Cap of the bar or strip, per element, ≥ 0.
    pub tensile_capacity: f64,
    /// Plate or anchor at the head, ≥ 0 (0 by default).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end1_capacity: Option<f64>,
    /// Anchor at the tip, ≥ 0 (0 by default).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end2_capacity: Option<f64>,
    /// Out-of-plane centre-to-centre spacing, > 0 (1 by default).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spacing: Option<f64>,
    pub direction: TensionDirection,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pullout: Option<Pullout>,
}

/// Model of the lateral pressure of the soil on a pile (E15i-1). Only Ito and Matsui (1975) exists.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LateralPressureModel {
    ItoMatsui,
}

/// Where the force of a pile with `lateral_pressure` acts (E15i-5): `Centroid`, on the axis of the pile at the arm
/// `L_m` of the resultant of the pressure above the crossing (Cai and Ugai 2000, eq. 9; the rule of cSlope), or
/// `SlipSurface`, at the crossing (E14e).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PileLocation {
    Centroid,
    SlipSurface,
}

/// `lateral_pressure` of a `pile` (v0.5, E15i-1): the force comes from the pressure of the soil between the piles
/// (Ito and Matsui 1975) and not from a given `force`. `diameter` is finite and > 0 and `spacing > diameter`;
/// `location` is mandatory. The pile is vertical.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LateralPressure {
    pub model: LateralPressureModel,
    pub diameter: f64,
    pub location: PileLocation,
}

/// `capacity` of a `pile` with `lateral_pressure` (v0.5, E15i-1): the force of the soil is capped by the shear
/// (`shear`, force per pile) and by the bending moment (`moment`, force times length per pile, E15i-4). At least one,
/// each finite and > 0.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PileCapacity {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shear: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub moment: Option<f64>,
}

/// `pile` (E14b): a vertical or inclined shear element with a constant force per pile; the head is the upper end.
/// `angle` (degrees in (−90, 90), 0 horizontal) is required with `direction: "angle"` and forbidden otherwise; the
/// engine checks it (`reinforcement::validate`), not serde.
///
/// v0.5 (E15i-1): `force` is optional and **exactly one** of `force` and `lateral_pressure` is present (the engine
/// checks it); `capacity` only goes with `lateral_pressure`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Pile {
    pub id: String,
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
    pub application: Application,
    /// Constant shear force per pile, ≥ 0. Absent with `lateral_pressure`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub force: Option<f64>,
    /// Out-of-plane centre-to-centre spacing, > 0 (1 by default).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spacing: Option<f64>,
    pub direction: PileDirection,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub angle: Option<f64>,
    /// The force from the pressure of the soil (v0.5, E15i-1).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lateral_pressure: Option<LateralPressure>,
    /// Caps of the force of the soil (v0.5, E15i-1); only with `lateral_pressure`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capacity: Option<PileCapacity>,
}

/// `sheet_pile` (E14b): a continuous row of piles, vertical (`x1 = x2`). `force` is per metre of wall, with no
/// `spacing`. `angle` as in [`Pile`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SheetPile {
    pub id: String,
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
    pub application: Application,
    /// Constant shear force per metre of wall, ≥ 0.
    pub force: f64,
    pub direction: PileDirection,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub angle: Option<f64>,
}

/// Reinforcement (v0.4, E14b). Serialized with a `"type"` tag: `anchor`, `nail`, `geosynthetic`, `pile` or
/// `sheet_pile`. Needs `version: "0.4"` (E14a).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Reinforcement {
    Anchor(TensionElement),
    Nail(TensionElement),
    Geosynthetic(TensionElement),
    Pile(Pile),
    SheetPile(SheetPile),
}

impl Reinforcement {
    /// Name of the type, as written in the JSON.
    pub fn type_name(&self) -> &'static str {
        match self {
            Reinforcement::Anchor(_) => "anchor",
            Reinforcement::Nail(_) => "nail",
            Reinforcement::Geosynthetic(_) => "geosynthetic",
            Reinforcement::Pile(_) => "pile",
            Reinforcement::SheetPile(_) => "sheet_pile",
        }
    }

    pub fn id(&self) -> &str {
        match self {
            Reinforcement::Anchor(t) | Reinforcement::Nail(t) | Reinforcement::Geosynthetic(t) => {
                &t.id
            }
            Reinforcement::Pile(p) => &p.id,
            Reinforcement::SheetPile(p) => &p.id,
        }
    }

    /// Head `(x1, y1)` and tip `(x2, y2)`.
    pub fn ends(&self) -> (Point, Point) {
        let (x1, y1, x2, y2) = match self {
            Reinforcement::Anchor(t) | Reinforcement::Nail(t) | Reinforcement::Geosynthetic(t) => {
                (t.x1, t.y1, t.x2, t.y2)
            }
            Reinforcement::Pile(p) => (p.x1, p.y1, p.x2, p.y2),
            Reinforcement::SheetPile(p) => (p.x1, p.y1, p.x2, p.y2),
        };
        ([x1, y1], [x2, y2])
    }

    pub fn application(&self) -> Application {
        match self {
            Reinforcement::Anchor(t) | Reinforcement::Nail(t) | Reinforcement::Geosynthetic(t) => {
                t.application
            }
            Reinforcement::Pile(p) => p.application,
            Reinforcement::SheetPile(p) => p.application,
        }
    }

    /// Length `L = ‖(x2 − x1, y2 − y1)‖`.
    pub fn length(&self) -> f64 {
        let ([x1, y1], [x2, y2]) = self.ends();
        (x2 - x1).hypot(y2 - y1)
    }

    /// True for `pile` and `sheet_pile` (the note `structural_checks_not_covered`, E14h).
    pub fn is_pile(&self) -> bool {
        matches!(self, Reinforcement::Pile(_) | Reinforcement::SheetPile(_))
    }

    /// `spacing` with its default of 1; a `sheet_pile` has none, so 1.
    pub fn spacing(&self) -> f64 {
        match self {
            Reinforcement::Anchor(t) | Reinforcement::Nail(t) | Reinforcement::Geosynthetic(t) => {
                t.spacing.unwrap_or(1.0)
            }
            Reinforcement::Pile(p) => p.spacing.unwrap_or(1.0),
            Reinforcement::SheetPile(_) => 1.0,
        }
    }
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
    /// Morgenstern-Price (v0.3, E13d). The interslice function is `analysis.interslice`.
    MorgensternPrice,
    /// Janbu simplified, `F₀` (v0.3, E13e).
    JanbuSimplified,
    /// Janbu corrected, `F = f₀·F₀` (v0.3, E13e).
    JanbuCorrected,
}

/// Function `f(ξ)` of the interslice forces of Morgenstern-Price, `X = λ·f(ξ)·E` (v0.3, E13d).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntersliceFunction {
    Constant,
    HalfSine,
    ClippedSine,
    Trapezoidal,
    DataPoints,
}

/// `analysis.interslice` (v0.3, E13d): the function of the interslice forces. `points` is `[[ξ, f], …]` and only
/// exists, and is required, with `data_points`. Also the form that the report uses.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct IntersliceSpec {
    pub function: IntersliceFunction,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub points: Option<Vec<Point>>,
}

/// Circle `(xc, yc, r)`.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Circle {
    pub xc: f64,
    pub yc: f64,
    pub r: f64,
}

/// Fixed surface. Serialized as `{"type": "circle", ...}` or `{"type": "polyline", "points": [[x, y], …]}`.
///
/// `Polyline` needs `version: "0.3"` (E13a). Its format (at least 2 finite points, `x` strictly increasing) and its
/// fit to the ground are E13c.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum SurfaceSpec {
    Circle(Circle),
    Polyline { points: Vec<Point> },
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
    /// Non-circular refinement of the critical circle (F6.4). `None` keeps the circular search of v0.5.
    pub non_circular: Option<NonCircularSpec>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    non_circular: Option<NonCircularSpec>,
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
            non_circular: None,
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
            non_circular: w.non_circular,
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
            non_circular: s.non_circular,
        }
    }
}

/// Depth of the tension crack (v0.5, E15b): a finite number `> 0` in the length unit of the model, or the string
/// `"auto"` (G6: `z = max(0, 2c/(γ·tan(45° − φ/2)) − q/γ)`, recomputed for each `x`).
///
/// Untagged in JSON: `2.0` is `Fixed(2.0)` and `"auto"` is `Auto`. `Auto` is not a derivable untagged variant (a unit
/// variant would be `null`), so the serde impls are written by hand. Any other value is an error that names the path.
/// The range of `Fixed` (`> 0`, finite) is checked by `loads::validate_document`, not here.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CrackDepth {
    Fixed(f64),
    Auto,
}

impl Serialize for CrackDepth {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            CrackDepth::Fixed(d) => serializer.serialize_f64(*d),
            CrackDepth::Auto => serializer.serialize_str("auto"),
        }
    }
}

impl<'de> Deserialize<'de> for CrackDepth {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Raw {
            Number(f64),
            Text(String),
        }
        const MSG: &str = "analysis.tension_crack.depth debe ser un número mayor que 0 o \"auto\"";
        match Raw::deserialize(deserializer) {
            Ok(Raw::Number(d)) => Ok(CrackDepth::Fixed(d)),
            Ok(Raw::Text(t)) if t == "auto" => Ok(CrackDepth::Auto),
            _ => Err(serde::de::Error::custom(MSG)),
        }
    }
}

/// `analysis.tension_crack` (v0.5, E15b): a vertical tension crack at the crest of the sliding mass.
///
/// - `depth`: a finite number `> 0` or `"auto"` (G6).
/// - `water_fill`: the fraction of the crack filled with water, in `[0, 1]`. **Required, with no default**: 0 is the
///   dry crack and 1 the full one. The water force is `Pw = ½·γw·hw²`, `hw = depth·water_fill` (G3).
///
/// There is no position field: `x_c` comes from the surface and the depth (G1). The fields are optional for serde
/// only so that a missing one is reported with its path (`analysis.tension_crack.<campo> es obligatorio`); the
/// finished type always has both. The ranges are checked by `loads::validate_document`.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct TensionCrack {
    pub depth: CrackDepth,
    pub water_fill: f64,
}

impl<'de> Deserialize<'de> for TensionCrack {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(
            deny_unknown_fields,
            expecting = "un objeto analysis.tension_crack con depth y water_fill"
        )]
        struct Raw {
            #[serde(default)]
            depth: Option<CrackDepth>,
            #[serde(default, deserialize_with = "number_with_path")]
            water_fill: Option<f64>,
        }
        /// A number, or `null` (absent); anything else is an error that names the path of the field.
        fn number_with_path<'de, D: serde::Deserializer<'de>>(
            deserializer: D,
        ) -> Result<Option<f64>, D::Error> {
            #[derive(Deserialize)]
            #[serde(untagged)]
            enum Either {
                Number(f64),
                Other(serde::de::IgnoredAny),
            }
            match Option::<Either>::deserialize(deserializer)? {
                Some(Either::Number(n)) => Ok(Some(n)),
                Some(Either::Other(_)) => Err(serde::de::Error::custom(
                    "analysis.tension_crack.water_fill debe ser un número en [0, 1]",
                )),
                None => Ok(None),
            }
        }
        /// Only a JSON object: serde would also take an array as the fields in order, and the schema would not.
        struct OnlyMap;
        impl<'de> serde::de::Visitor<'de> for OnlyMap {
            type Value = Raw;
            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("un objeto analysis.tension_crack con depth y water_fill")
            }
            fn visit_map<A: serde::de::MapAccess<'de>>(self, map: A) -> Result<Raw, A::Error> {
                Raw::deserialize(serde::de::value::MapAccessDeserializer::new(map))
            }
        }
        let raw = deserializer.deserialize_map(OnlyMap)?;
        let missing = |field: &str| {
            serde::de::Error::custom(format!("analysis.tension_crack.{field} es obligatorio"))
        };
        Ok(TensionCrack {
            depth: raw.depth.ok_or_else(|| missing("depth"))?,
            water_fill: raw.water_fill.ok_or_else(|| missing("water_fill"))?,
        })
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
    /// Interslice force function of `morgenstern_price` (v0.3, E13d). `None` is `half_sine`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interslice: Option<IntersliceSpec>,
    /// Tension crack (v0.5, E15b). `None` is no crack; a crack needs `version: "0.5"`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tension_crack: Option<TensionCrack>,
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
            interslice: None,
            tension_crack: None,
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
    fn water_unit_weight_null_is_still_rejected() {
        // E15l-6 made the field optional; the schema (`type: number`) still rejects `null`, and so must the engine.
        assert!(serde_json::from_str::<Water>(r#"{"unit_weight": null}"#).is_err());
        let w: Water = serde_json::from_str(r#"{"unit_weight": 9.5}"#).unwrap();
        assert_eq!(w.unit_weight, Some(9.5));
    }

    #[test]
    fn water_unit_weight_defaults_by_units() {
        let w: Water =
            serde_json::from_str(r#"{"piezometric_line": [[0, 12.0], [55, 6.0]]}"#).unwrap();
        assert_eq!(w.unit_weight, None);
        assert_eq!(default_water_unit_weight(None), 9.81);
        assert_eq!(default_water_unit_weight(Some("SI")), 9.81);
        for label in ["imperial", "Imperial", " IMPERIAL ", "imp"] {
            let g = default_water_unit_weight(Some(label));
            assert!((g - 62.4493).abs() < 1e-3, "{label}: {g}");
        }
        assert_eq!(default_water_unit_weight(Some("metric")), 9.81);
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
        let SurfaceSpec::Circle(c) = s else {
            panic!("expected a circle")
        };
        assert_eq!((c.xc, c.yc, c.r), (120.0, 90.0, 80.0));
    }

    #[test]
    fn acads_example_round_trips() {
        let m: Model = serde_json::from_str(ACADS_1A).expect("example must parse");
        assert_eq!(m.format, "opengeoslide");
        assert_eq!(m.version, "0.1");
        assert_eq!(m.meta.id.as_deref(), Some("V047a"));
        assert_eq!(m.materials[0].unit_weight, 20.0);
        assert_eq!(m.materials[0].cohesion, Some(3.0));
        assert_eq!(m.materials[0].friction_angle, Some(19.6));
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
