//! Ponded water (free water over the ground; contract F5.3, amendments E15c and E15h).
//!
//! **Wave G1 (M-agua).** [`ponded_terms`] computes the terms of E1 to E4 and E15c-ru. Without water over the ground (no
//! piezometric line, or a line that nowhere goes over the ground by more than the tolerance of the model) every term is
//! [`PondTerms::ZERO`] and nothing changes in the slices, so the output is the one of v0.3.0 (identity, E15e-1).
//!
//! The ponded water has no field in the format and applies in every version (D1, E15a): it is the region between the
//! piezometric line and the ground where `piezo > ground`. It covers the **whole model**, not only the mass of the
//! evaluated surface (X20 §1.6), so the search sees the same water for every candidate.
//!
//! # Where it enters (`lib.rs`)
//!
//! `lib.rs` calls [`ponded_terms`] once per surface, **after** slicing (and after the crack truncation, G2) and before
//! the forces of the reinforcements, on the final surface and on every candidate of the search, and adds the terms
//! with [`PondTerms::add_to`]. It does not need extra nodes: the integral is by tramo of the ground, split at the
//! vertices of the ground, those of the piezometric line and their crossings, with the exact moments of E1.
//!
//! # E15h: no new field in `Slice`
//!
//! The moment `s·V·(xg − xm)` of the weight of the water about the midpoint of the base **fits in the current
//! fields** (see `docs/fase3/g0/NOTAS.md`):
//! - `Slice::weight_extra` takes `V` (vertical, downward);
//! - `Slice::h_force` takes `H = s·H_x`;
//! - `Slice::h_moment_base` is, for Spencer and Morgenstern-Price, the **whole** moment about the midpoint of the base
//!   of the forces that are not `W*`, `N` and `S`: the solvers only sum it (`Σ b(E_k + E_{k+1})(tan α − λ) − 2·Σ
//!   h_moment_base`), so it takes `H·(yg − ym) + s·V·(xg − xm)`;
//! - `Slice::driving_extra` takes, for Bishop, `[H·(yc − yg) − s·V·(xg − xm)]/R` (`0` on a polyline, which has no
//!   centre and does not offer Bishop);
//! - Janbu uses only the forces.
//!
//! With `(xg, yg)` the point of application and `(xm, ym)` the midpoint of the base. `s = +1` if the sliding goes
//! toward `+x` (`Sliding::LeftToRight`), `−1` otherwise: see [`sliding_sign`].

use crate::geometry::{PreparedModel, Sliding};
use crate::slicer::Slice;
use crate::surface::Surface;

/// The terms that the ponded water adds to one slice (E15c). All are in force units per metre of slope (the pore
/// pressure in stress units) and **zero is neutral**: a slice under no ponded water gets [`PondTerms::ZERO`] and is
/// not touched, bit for bit.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct PondTerms {
    /// `V = γw·∫h dx`: weight of the water over the top of the slice, vertical and downward (E1). Added to
    /// `Slice::weight_extra`. No seismic force acts on it (E7).
    pub weight: f64,
    /// `H = s·γw·∫h·y′ dx`: horizontal thrust on the ground in the sliding direction (E1), plus the thrust of a
    /// vertical face (E4) on the slice whose edge is the face, on the high side. Added to `Slice::h_force`.
    pub h_force: f64,
    /// `H·(yg − ym) + s·V·(xg − xm)`: moment of `V` and `H` about the midpoint of the base (E2, Spencer and M-P),
    /// exact (Gauss of 3 points). Added to `Slice::h_moment_base`.
    pub h_moment_base: f64,
    /// `[H·(yc − yg) − s·V·(xg − xm)]/R` (E2, Bishop); `0` with no circle. Added to `Slice::driving_extra`.
    pub driving_extra: f64,
    /// `ru·V/b` for a slice whose base material has `ru` (E15c-ru: `u = ru·(W + V)/b`, with `V` without loads or
    /// seismic force); `0` for the others. Added to `Slice::pore_pressure`. The pressure of a base under the water
    /// with no `ru` does not change (E3: `γw·max(0, piezo − y_base_mid)`, not clipped to the ground, already so).
    pub pore_pressure: f64,
}

impl PondTerms {
    /// No term: the neutral element.
    pub const ZERO: PondTerms = PondTerms {
        weight: 0.0,
        h_force: 0.0,
        h_moment_base: 0.0,
        driving_extra: 0.0,
        pore_pressure: 0.0,
    };

    /// True when every term is zero.
    pub fn is_zero(&self) -> bool {
        *self == Self::ZERO
    }

    /// Adds the terms to the slice. A zero term leaves the slice untouched (it also keeps the sign of a `-0.0`), so a
    /// model without ponded water does not change by a bit.
    pub fn add_to(&self, slice: &mut Slice) {
        if self.is_zero() {
            return;
        }
        slice.weight_extra += self.weight;
        slice.h_force += self.h_force;
        slice.h_moment_base += self.h_moment_base;
        slice.driving_extra += self.driving_extra;
        slice.pore_pressure += self.pore_pressure;
    }
}

/// `s` of the contract: `+1` if the sliding goes toward `+x` (`LeftToRight`), `−1` if it goes toward `−x`.
pub fn sliding_sign(pm: &PreparedModel) -> f64 {
    match pm.sliding {
        Sliding::LeftToRight => 1.0,
        Sliding::RightToLeft => -1.0,
    }
}

/// Nodes and weights of the 3-point Gauss-Legendre rule on `[-1, 1]`. Exact for polynomials up to degree 5; the
/// integrands of E1 (`h·1`, `h·(x − xm)`, `h·y′·(y − ym)`) have degree 2 on a piece where the ground and the piezometric
/// line are both straight.
const GAUSS3: [(f64, f64); 3] = [
    (-0.774_596_669_241_483_4, 5.0 / 9.0),
    (0.0, 8.0 / 9.0),
    (0.774_596_669_241_483_4, 5.0 / 9.0),
];

/// `∫_a^b f dx` with the 3-point Gauss rule.
fn gauss3(a: f64, b: f64, f: impl Fn(f64) -> f64) -> f64 {
    let (half, mid) = (0.5 * (b - a), 0.5 * (a + b));
    half * GAUSS3
        .iter()
        .map(|&(t, w)| w * f(mid + half * t))
        .sum::<f64>()
}

/// A straight piece of the ground, between two consecutive vertex abscissae of the model.
#[derive(Debug, Clone, Copy)]
struct Piece {
    xa: f64,
    xb: f64,
    ya: f64,
    yb: f64,
}

impl Piece {
    fn at(&self, x: f64) -> f64 {
        self.ya + (x - self.xa) * (self.yb - self.ya) / (self.xb - self.xa)
    }
}

/// A vertical face of the ground (dam face, E4): the ground jumps at `x` from `y_lo` to `y_hi`; the soil is on the
/// high side.
#[derive(Debug, Clone, Copy)]
struct Wall {
    x: f64,
    y_lo: f64,
    y_hi: f64,
    /// `+1` if the high side (the soil) is at larger `x`, `−1` if it is at smaller `x`.
    high_side: f64,
}

/// The ground of the model as straight pieces (the upper envelope between consecutive vertex abscissae, which is one
/// single edge there because regions do not cross) and its vertical faces.
fn ground_pieces(pm: &PreparedModel, x0: f64, x1: f64) -> (Vec<Piece>, Vec<Wall>) {
    let xs = &pm.vertex_xs;
    let mut pieces: Vec<Piece> = Vec::new();
    for w in xs.windows(2) {
        let (va, vb) = (w[0], w[1]);
        if vb < x0 || va > x1 {
            continue;
        }
        let xm = 0.5 * (va + vb);
        let mut best: Option<Piece> = None;
        for [p, q] in &pm.edges {
            if p[0] == q[0] {
                continue;
            }
            let (lo, hi) = if p[0] < q[0] { (p, q) } else { (q, p) };
            if xm < lo[0] || xm > hi[0] {
                continue;
            }
            let k = (hi[1] - lo[1]) / (hi[0] - lo[0]);
            let piece = Piece {
                xa: va,
                xb: vb,
                ya: lo[1] + (va - lo[0]) * k,
                yb: lo[1] + (vb - lo[0]) * k,
            };
            if best.is_none_or(|b| piece.at(xm) > b.at(xm)) {
                best = Some(piece);
            }
        }
        pieces.extend(best);
    }
    let tol = pm.tol();
    let walls = pieces
        .windows(2)
        .filter(|w| w[0].xb == w[1].xa && (w[0].yb - w[1].ya).abs() > tol)
        .map(|w| Wall {
            x: w[1].xa,
            y_lo: w[0].yb.min(w[1].ya),
            y_hi: w[0].yb.max(w[1].ya),
            high_side: if w[1].ya > w[0].yb { 1.0 } else { -1.0 },
        })
        .collect();
    (pieces, walls)
}

/// The sums of E1 over one slice (not yet multiplied by `γw`).
#[derive(Debug, Default, Clone, Copy)]
struct Sums {
    /// `∫h dx`
    v: f64,
    /// `∫h·(x − xm) dx`
    vm: f64,
    /// `∫h·y′ dx`
    hx: f64,
    /// `∫h·y′·(y − ym) dx`
    hm: f64,
    /// `∫h·y′·(yc − y) dx` (only with a circle)
    hd: f64,
}

/// Adds to `sums` the water over the straight stretch `[a, b]` of the ground piece `piece`, where the piezometric line
/// is straight too, with `h = max(0, piezo − ground)`.
#[allow(clippy::too_many_arguments)]
fn add_stretch(
    sums: &mut Sums,
    pm: &PreparedModel,
    piece: &Piece,
    a: f64,
    b: f64,
    xm: f64,
    ym: f64,
    yc: f64,
) {
    let (ya, yb) = (piece.at(a), piece.at(b));
    let (Some(wa), Some(wb)) = (pm.piezometric_y(a), pm.piezometric_y(b)) else {
        return;
    };
    // A line that touches the ground (a phreatic line that ends on the slope, V033) is not water over the ground: a
    // depth under the tolerance of the model is zero, so the terms stay exactly zero and the output does not change.
    let tol = pm.tol();
    let clean = |d: f64| if d <= tol { d.min(0.0) } else { d };
    let (da, db) = (clean(wa - ya), clean(wb - yb));
    if da <= 0.0 && db <= 0.0 {
        return;
    }
    // `h(t) = da + (db − da)·t` on `t ∈ [0, 1]`, clipped where it crosses zero.
    let (mut ta, mut tb) = (0.0, 1.0);
    if da <= 0.0 {
        ta = da / (da - db);
    }
    if db <= 0.0 {
        tb = da / (da - db);
    }
    let len = b - a;
    let slope = (yb - ya) / len;
    let h = |t: f64| da + (db - da) * t;
    let x = |t: f64| a + len * t;
    let y = |t: f64| ya + (yb - ya) * t;
    sums.v += len * gauss3(ta, tb, h);
    sums.vm += len * gauss3(ta, tb, |t| h(t) * (x(t) - xm));
    sums.hx += len * gauss3(ta, tb, |t| h(t) * slope);
    sums.hm += len * gauss3(ta, tb, |t| h(t) * slope * (y(t) - ym));
    sums.hd += len * gauss3(ta, tb, |t| h(t) * slope * (yc - y(t)));
}

/// The terms of the ponded water for each slice of `slices`, **in the same order**, one entry per slice (E1 to E4,
/// E15c).
///
/// - `pm`: the prepared model: the ground (`top_at`, its vertices), the piezometric line (`piezometric_y`, extended
///   horizontally outside its range), `γw` (`water.unit_weight`, with the rules of E12e in imperial units) and the
///   materials (`ru` of the base material `Slice::material`);
/// - `surface`: the **fitted** surface of the slices; a circle gives `(yc, R)` for `driving_extra`, a polyline has no
///   centre (`driving_extra = 0`);
/// - `slices`: the final slices of the mass, **toe first**, already truncated by the crack if there is one (G2), and
///   before any ponded term is added (they carry `pore_pressure` of the base, `weight` and the base midpoint);
/// - `s`: `+1` if the sliding goes toward `+x`, `−1` otherwise ([`sliding_sign`]).
///
/// Slices outside the water (and air slices) get [`PondTerms::ZERO`]. A model without a piezometric line, or whose
/// line is nowhere above the ground over the slices, gives all zeros (one entry per slice).
/// The vertical face of a dam (E4) is a jump of the ground at one `x`: its thrust
/// `½·γw·[(yw − ya)² − (yw − yb)²]` goes to the slice whose edge is the face, on the high side.
///
/// Per slice and per straight stretch (the ground is split at its vertices, at those of the piezometric line and at
/// their crossings) the integrals of E1 are exact with 3 Gauss points:
/// `V = γw·∫h dx`, `H = s·γw·∫h·y′ dx`, and the moments of E2 about the midpoint of the base (Spencer, M-P) and about
/// the centre (Bishop). No seismic force acts on the water (E7), and the pore pressure of the base is not touched
/// except for a material with `ru` (E15c-ru).
///
/// Contact materials in raw `slicer::slice_*` results are the material above, not necessarily the weaker one.
/// Consequently `pore_pressure` here uses that unresolved material; the analysis pipeline chooses the contact
/// material in `water::apply_ponded` (E13l-5, E16aa) before applying the final terms.
pub fn ponded_terms(
    pm: &PreparedModel,
    surface: &Surface,
    slices: &[Slice],
    s: f64,
) -> Vec<PondTerms> {
    let mut out = vec![PondTerms::ZERO; slices.len()];
    let (Some(first), Some(last)) = (slices.first(), slices.last()) else {
        return out;
    };
    let Some(line) = pm.piezometric.as_ref() else {
        return out;
    };
    let (x_lo, x_hi) = (
        first.x_left.min(last.x_left),
        first.x_right.max(last.x_right),
    );
    // E15m-2: the pieces are asked for with the span widened by `wall_tol` on each side, only to find the vertical
    // faces (E4): a face that is `wall_tol` or less from the first or the last slice (a polyline that starts 1e-12
    // inside it) is not lost. The pieces of the weight terms stay those of the span `[x_lo, x_hi]` (E15m-2).
    let wall_tol = 1e-7 * pm.scale;
    let (wide, walls) = ground_pieces(pm, x_lo - wall_tol, x_hi + wall_tol);
    let pieces: Vec<Piece> = wide
        .iter()
        .copied()
        .filter(|p| !(p.xb < x_lo || p.xa > x_hi))
        .collect();
    // Fast path: nothing to do if the line is under the ground at every abscissa where it can reach above it, that is
    // at the vertices of the ground and of the line (both are piecewise linear).
    let above = |x: f64| {
        let w = pm.piezometric_y(x).unwrap_or(f64::NEG_INFINITY);
        wide.iter()
            .any(|p| x >= p.xa && x <= p.xb && w - p.at(x) > pm.tol())
    };
    let reaches =
        wide.iter().any(|p| above(p.xa) || above(p.xb)) || line.iter().any(|p| above(p[0]));
    if !reaches {
        return out;
    }
    let (yc, radius) = surface.moment_arm().unwrap_or((0.0, 0.0));
    let gw = pm.gamma_w;
    let tol = pm.tol();
    // E15l-4: each vertical face goes to ONE slice, the soil slice (centre on the high side, E15m-3) whose edge on the
    // high side is the nearest to `wall.x` within `wall_tol` (the first one, toe first, on a tie). Two edges within `wall_tol` of the same face (a
    // node of a load or of a reinforcement beside it) must not apply the thrust twice.
    let owner: Vec<Option<usize>> = walls
        .iter()
        .map(|wall| {
            let mut best: Option<(usize, f64)> = None;
            for (i, slice) in slices.iter().enumerate() {
                if slice.y_top_mid - 0.5 * (slice.y_base_left + slice.y_base_right) <= tol {
                    continue;
                }
                // E15m-3: the thrust goes only to a slice whose centre is on the high side of the face, so a mass on the
                // low side whose edge is within `wall_tol` of the face takes none of it.
                if (0.5 * (slice.x_left + slice.x_right) - wall.x) * wall.high_side <= 0.0 {
                    continue;
                }
                let edge = if wall.high_side > 0.0 {
                    slice.x_left
                } else {
                    slice.x_right
                };
                let dist = (edge - wall.x).abs();
                if dist <= wall_tol && best.is_none_or(|(_, d)| dist < d) {
                    best = Some((i, dist));
                }
            }
            best.map(|(i, _)| i)
        })
        .collect();
    for (si, (slice, term)) in slices.iter().zip(out.iter_mut()).enumerate() {
        let (x0, x1) = (slice.x_left, slice.x_right);
        let xm = 0.5 * (x0 + x1);
        let ym = 0.5 * (slice.y_base_left + slice.y_base_right);
        // An air slice (E2) carries no soil and no water.
        if slice.y_top_mid - ym <= tol {
            continue;
        }
        let mut sums = Sums::default();
        let first_piece = pieces.partition_point(|p| p.xb <= x0);
        for piece in &pieces[first_piece..] {
            if piece.xa >= x1 {
                break;
            }
            let (a, b) = (piece.xa.max(x0), piece.xb.min(x1));
            if b <= a {
                continue;
            }
            // The line is straight between its own vertices: split the piece there.
            let mut cuts = vec![a];
            cuts.extend(line.iter().map(|p| p[0]).filter(|&x| x > a && x < b));
            cuts.push(b);
            for w in cuts.windows(2) {
                if w[1] > w[0] {
                    add_stretch(&mut sums, pm, piece, w[0], w[1], xm, ym, yc);
                }
            }
        }
        let v = gw * sums.v;
        let mut h_moment = s * gw * (sums.hm + sums.vm);
        let mut driving = if radius > 0.0 {
            s * gw * (sums.hd - sums.vm) / radius
        } else {
            0.0
        };
        let mut h = s * gw * sums.hx;
        // E4: the thrust of a vertical face whose edge is this slice, on the high side.
        for wall in walls
            .iter()
            .zip(&owner)
            .filter_map(|(wall, owner)| (*owner == Some(si)).then_some(wall))
        {
            let Some(yw) = pm.piezometric_y(wall.x) else {
                continue;
            };
            let edge_base = if wall.high_side > 0.0 {
                slice.y_base_left
            } else {
                slice.y_base_right
            };
            let ya = wall.y_lo.max(edge_base);
            let yb = yw.min(wall.y_hi);
            if yb <= ya {
                continue;
            }
            let force = 0.5 * gw * ((yw - ya).powi(2) - (yw - yb).powi(2));
            let pressure = gauss3(ya, yb, |y| yw - y);
            let yg = gauss3(ya, yb, |y| y * (yw - y)) / pressure;
            let thrust = s * wall.high_side * force;
            h += thrust;
            h_moment += thrust * (yg - ym);
            if radius > 0.0 {
                driving += thrust * (yc - yg) / radius;
            }
        }
        let ru = pm.materials[slice.material].ru;
        *term = PondTerms {
            weight: v,
            h_force: h,
            h_moment_base: h_moment,
            driving_extra: driving,
            pore_pressure: match ru {
                Some(ru) if slice.width > 0.0 => ru * v / slice.width,
                _ => 0.0,
            },
        };
    }
    out
}

/// Adds [`ponded_terms`] to `slices` (what `lib.rs` calls). It returns whether some slice got a non-zero term of
/// ponded water: a weight above 0 or a thrust different from 0, the vertical faces of E4 included (E15l-5).
pub(crate) fn apply_ponded(
    pm: &PreparedModel,
    surface: &Surface,
    slices: &mut [Slice],
    kv: f64,
) -> bool {
    let terms = ponded_terms(pm, surface, slices, sliding_sign(pm));
    let mut active = false;
    let mut column = Vec::with_capacity(8);
    let mut scratch = Vec::with_capacity(8);
    for (slice, mut term) in slices.iter_mut().zip(terms) {
        active |= term.weight > 0.0 || term.h_force != 0.0;
        crate::slicer::resolve_contact(pm, slice, term.weight, kv, &mut column, &mut scratch);
        term.pore_pressure = pm.materials[slice.material]
            .ru
            .map_or(0.0, |ru| ru * term.weight / slice.width);
        term.add_to(slice);
    }
    active
}
