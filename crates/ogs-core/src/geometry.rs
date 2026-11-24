//! Ground geometry: prepared model and the `Ground` trait used by the circular search.
//! Implementation: W1a.

use crate::OgsError;
use crate::model::{Model, Point};

/// Direction in which the sliding mass moves (resolved; `Auto` is decided by `PreparedModel::new`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Sliding {
    LeftToRight,
    RightToLeft,
}

/// Terrain queries needed by the circular search.
pub trait Ground {
    /// Ground surface elevation at `x`; `None` outside the model.
    fn y_top(&self, x: f64) -> Option<f64>;
    /// Horizontal extent of the model `(x_min, x_max)`.
    fn x_range(&self) -> (f64, f64);
    /// Resolved sliding direction.
    fn sliding(&self) -> Sliding;
}

/// Material with precomputed `tan φ` (fields consumed by the W1a implementation).
#[allow(dead_code)]
struct ResolvedMaterial {
    unit_weight: f64,
    unit_weight_sat: Option<f64>,
    cohesion: f64,
    tan_phi: f64,
    ru: Option<f64>,
}

/// Region with its material resolved to an index into `ResolvedMaterial`.
#[allow(dead_code)]
struct PreparedRegion {
    material: usize,
    polygon: Vec<Point>,
}

/// Model prepared for evaluation. Its fields are filled by W1a, so they are unread until then.
#[allow(dead_code)]
pub struct PreparedModel {
    materials: Vec<ResolvedMaterial>,
    regions: Vec<PreparedRegion>,
    piezometric: Option<Vec<Point>>,
    gamma_w: f64,
    sliding: Sliding,
}

impl PreparedModel {
    /// Validates and prepares the model. W1a.
    pub fn new(_model: &Model) -> Result<Self, OgsError> {
        todo!("W1a")
    }

    /// Piezometric elevation at `x` (constant extrapolation outside its range); `None` if there is no line. W1a.
    pub fn piezometric_y(&self, _x: f64) -> Option<f64> {
        todo!("W1a")
    }
}

impl Ground for PreparedModel {
    fn y_top(&self, _x: f64) -> Option<f64> {
        todo!("W1a")
    }

    fn x_range(&self) -> (f64, f64) {
        todo!("W1a")
    }

    fn sliding(&self) -> Sliding {
        todo!("W1a")
    }
}
