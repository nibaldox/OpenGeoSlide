//! M-agua (wave G1): the ponded water of `water::ponded_terms` (contract F5.3, E1 to E4, E7 and E15c-ru).
//!
//! The checks do **not** use `water.rs` to know what the water does:
//! - `Reference` recomputes the pressure of the water on the ground (and on a vertical face) from the polygons of the
//!   document, with Simpson's rule on stretches where everything is straight (the engine uses 3 Gauss points on the
//!   pieces of its own `PreparedModel`), and gives the force and its moment **about a real point**;
//! - the global equilibrium sums the forces of the whole mass (`N` and `S` at the midpoint of each base, the soil
//!   weight at the midpoint, the water at its real points) and does not read `h_moment_base` nor the recurrence of
//!   the solver for the water: the interslice forces `E` are rebuilt here from the slice fields.

use ogs_core::analyze;
use ogs_core::geometry::PreparedModel;
use ogs_core::methods::{SolveOptions, SolveStatus, solve};
use ogs_core::model::{MethodKind, Model};
use ogs_core::report::{AnalysisReport, MethodReport};
use ogs_core::slicer::Slice;
use ogs_core::surface::Surface;
use ogs_core::water::{self, PondTerms};
use serde_json::{Value, json};
use std::path::PathBuf;

const GAMMA_W: f64 = 9.807;

fn data_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/data/f3g")
}

fn expected() -> Value {
    let text = std::fs::read_to_string(data_dir().join("expected.json")).expect("expected.json");
    serde_json::from_str(&text).expect("expected.json parses")
}

fn row_doc(id: &str) -> Value {
    let text = std::fs::read_to_string(data_dir().join("rows").join(format!("{id}.json")))
        .unwrap_or_else(|e| panic!("{id}: {e}"));
    serde_json::from_str(&text).expect("row parses")
}

fn run(doc: &Value) -> AnalysisReport {
    let model: Model = serde_json::from_value(doc.clone())
        .unwrap_or_else(|e| panic!("the document does not parse as a model: {e}"));
    analyze(&model).unwrap_or_else(|e| panic!("the analysis failed: {e}"))
}

fn method_name(m: MethodKind) -> String {
    serde_json::to_value(m)
        .unwrap()
        .as_str()
        .unwrap()
        .to_string()
}

fn result<'a>(r: &'a AnalysisReport, method: &str) -> &'a MethodReport {
    r.results
        .iter()
        .find(|x| method_name(x.method) == method)
        .unwrap_or_else(|| panic!("no result for {method}"))
}

/// The 20 rows of ponded water without a crack (kind `pond` of `expected.json`).
fn pond_rows() -> Vec<String> {
    let exp = expected();
    exp["rows"]
        .as_object()
        .unwrap()
        .iter()
        .filter(|(_, v)| v["kind"] == "pond")
        .map(|(k, _)| k.clone())
        .collect()
}

fn has_seismic(doc: &Value) -> bool {
    doc["analysis"].get("seismic").is_some_and(|s| {
        s["kh"].as_f64().unwrap_or(0.0) != 0.0 || s["kv"].as_f64().unwrap_or(0.0) != 0.0
    })
}

// ------------------------------------------------------------------------------------------------ the oracle

#[test]
fn the_ponded_rows_match_the_oracle_within_0_1_percent() {
    let exp = expected();
    let mut worst = 0.0_f64;
    let mut bad = Vec::new();
    for id in pond_rows() {
        let report = run(&row_doc(&id));
        let mut row_worst = (0.0_f64, String::new());
        for (method, oracle) in exp["rows"][&id]["oracle"].as_object().unwrap() {
            let oracle = oracle.as_f64().unwrap();
            let fos = result(&report, method).fos.expect("a finite FS");
            let diff = (fos / oracle - 1.0) * 100.0;
            println!("{id:<14} {method:<18} {fos:.6} against {oracle:.6}: {diff:+.4} %");
            if diff.abs() > row_worst.0 {
                row_worst = (diff.abs(), method.clone());
            }
        }
        worst = worst.max(row_worst.0);
        if row_worst.0 > 0.1 {
            bad.push(format!("{id}: {:.4} % ({})", row_worst.0, row_worst.1));
        }
    }
    println!("20 rows, worst |Δ| = {worst:.4} %");
    assert!(bad.is_empty(), "{}", bad.join("\n"));
}

// ------------------------------------------------------------------------------------------------ neutrality

/// The terms of the water for the slices of the first method of a document.
fn terms_of(doc: &Value) -> Vec<PondTerms> {
    let model: Model = serde_json::from_value(doc.clone()).unwrap();
    let pm = PreparedModel::new(&model).unwrap();
    let report = run(doc);
    let r = &report.results[0];
    let surface = match &r.surface {
        ogs_core::report::SurfaceOut::Circle(c) => Surface::Circle(*c),
        ogs_core::report::SurfaceOut::Polyline { points } => {
            Surface::Polyline(ogs_core::surface::Polyline {
                points: points.clone(),
            })
        }
    };
    water::ponded_terms(&pm, &surface, &r.slices, water::sliding_sign(&pm))
}

#[test]
fn without_water_over_the_ground_every_term_is_zero_and_the_slices_do_not_change() {
    // X21-N01: no water. X21-N02: the line at y = 24, under the ground. Plus the line exactly at the ground level of
    // the toe bench (y = 25) and a line under the whole model.
    for (label, line) in [
        ("none", None),
        ("y = 24", Some(json!([[0, 24.0], [100, 24.0]]))),
        ("y = 25 (at the toe)", Some(json!([[0, 25.0], [100, 25.0]]))),
        (
            "inclined under the ground",
            Some(json!([[0, 21.0], [100, 33.0]])),
        ),
    ] {
        let mut doc = row_doc("X21-N01");
        if let Some(line) = line {
            doc["water"] = json!({"unit_weight": GAMMA_W, "piezometric_line": line});
        }
        let terms = terms_of(&doc);
        assert!(!terms.is_empty());
        assert!(terms.iter().all(PondTerms::is_zero), "{label}");
        // The report of a model with the line under the ground has the same slices as without any water, except for
        // the pore pressure of the base (the line is inside the soil there): the geometry and the forces are the same.
        let with = run(&doc);
        let dry = run(&row_doc("X21-N01"));
        for (a, b) in with.results.iter().zip(&dry.results) {
            for (sa, sb) in a.slices.iter().zip(&b.slices) {
                assert_eq!(
                    (
                        sa.weight,
                        sa.weight_extra,
                        sa.h_force,
                        sa.h_moment_base,
                        sa.driving_extra
                    ),
                    (
                        sb.weight,
                        sb.weight_extra,
                        sb.h_force,
                        sb.h_moment_base,
                        sb.driving_extra
                    ),
                    "{label}"
                );
            }
        }
    }
}

#[test]
fn zero_terms_leave_the_slices_bit_for_bit_and_the_neutral_fields_stay_zero() {
    let doc = row_doc("X21-N02");
    let report = run(&doc);
    for r in &report.results {
        for s in &r.slices {
            assert_eq!(s.weight_extra.to_bits(), 0.0_f64.to_bits());
            assert_eq!(s.h_force.to_bits(), 0.0_f64.to_bits());
            assert_eq!(s.h_moment_base.to_bits(), 0.0_f64.to_bits());
            assert_eq!(s.driving_extra.to_bits(), 0.0_f64.to_bits());
        }
    }
}

// ------------------------------------------------------------------------------------------------ the reference

/// Simpson's rule on `[p, q]`: exact up to degree 3.
fn simpson(p: f64, q: f64, f: impl Fn(f64) -> f64) -> f64 {
    (q - p) / 6.0 * (f(p) + 4.0 * f(0.5 * (p + q)) + f(q))
}

/// Edges `(x1, y1, x2, y2)` of every polygon of the document.
fn edges_of(doc: &Value) -> Vec<[f64; 4]> {
    let mut out = Vec::new();
    for region in doc["regions"].as_array().unwrap() {
        let pts: Vec<[f64; 2]> = region["polygon"]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| [p[0].as_f64().unwrap(), p[1].as_f64().unwrap()])
            .collect();
        for i in 0..pts.len() {
            let (a, b) = (pts[i], pts[(i + 1) % pts.len()]);
            out.push([a[0], a[1], b[0], b[1]]);
        }
    }
    out
}

fn piezo_of(doc: &Value) -> Vec<[f64; 2]> {
    doc["water"]["piezometric_line"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| [p[0].as_f64().unwrap(), p[1].as_f64().unwrap()])
        .collect()
}

fn piezo_at(line: &[[f64; 2]], x: f64) -> f64 {
    if x <= line[0][0] {
        return line[0][1];
    }
    if x >= line[line.len() - 1][0] {
        return line[line.len() - 1][1];
    }
    let i = line.iter().position(|p| p[0] > x).unwrap();
    let (a, b) = (line[i - 1], line[i]);
    a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0])
}

/// Line `(y at x = a, slope)` of the highest non-vertical edge that covers the interval around `mid`.
fn ground_line(edges: &[[f64; 4]], a: f64, mid: f64) -> (f64, f64) {
    let mut best: Option<(f64, f64, f64)> = None; // (y at mid, y at a, k)
    for e in edges {
        if e[0] == e[2] {
            continue;
        }
        let (lo, hi) = if e[0] < e[2] {
            (e[0], e[2])
        } else {
            (e[2], e[0])
        };
        if mid < lo || mid > hi {
            continue;
        }
        let k = (e[3] - e[1]) / (e[2] - e[0]);
        let ym = e[1] + k * (mid - e[0]);
        if best.is_none_or(|b| ym > b.0) {
            best = Some((ym, e[1] + k * (a - e[0]), k));
        }
    }
    let b = best.expect("ground under the slice");
    (b.1, b.2)
}

/// The water on one slice with its real points of application (forces in the model frame, `+x` right).
#[derive(Debug, Default, Clone, Copy)]
struct Reference {
    /// Vertical weight, downward (positive).
    v: f64,
    /// Horizontal force, `+x` (the walls included).
    fx: f64,
    /// Counter-clockwise moment about `O`, of the forces at their real points.
    m_o: f64,
    /// Counter-clockwise moment about the midpoint of the base.
    m_mid: f64,
}

/// Pressure of the water on the ground of the slice `[x0, x1]` and on the vertical faces whose edge is the slice.
fn reference(doc: &Value, slice: &Slice, o: (f64, f64)) -> Reference {
    let edges = edges_of(doc);
    let line = piezo_of(doc);
    let (x0, x1) = (slice.x_left, slice.x_right);
    let (xm, ym) = (
        0.5 * (x0 + x1),
        0.5 * (slice.y_base_left + slice.y_base_right),
    );
    let mut cuts = vec![x0, x1];
    for e in &edges {
        for x in [e[0], e[2]] {
            if x > x0 && x < x1 {
                cuts.push(x);
            }
        }
    }
    cuts.extend(line.iter().map(|p| p[0]).filter(|&x| x > x0 && x < x1));
    cuts.sort_by(f64::total_cmp);
    cuts.dedup();
    let mut out = Reference::default();
    for w in cuts.windows(2) {
        let (a, b) = (w[0], w[1]);
        let (ya, k) = ground_line(&edges, a, 0.5 * (a + b));
        let ground = |x: f64| ya + k * (x - a);
        let h = |x: f64| piezo_at(&line, x) - ground(x);
        // `h` is straight on `[a, b]`; clip it where it crosses zero.
        let (ha, hb) = (h(a), h(b));
        if ha <= 0.0 && hb <= 0.0 {
            continue;
        }
        let (mut p, mut q) = (a, b);
        if ha <= 0.0 {
            p = a + (b - a) * ha / (ha - hb);
        }
        if hb <= 0.0 {
            q = a + (b - a) * ha / (ha - hb);
        }
        out.v += GAMMA_W * simpson(p, q, h);
        out.fx += GAMMA_W * simpson(p, q, |x| h(x) * k);
        let moment = |c: (f64, f64)| {
            -GAMMA_W * simpson(p, q, |x| h(x) * ((x - c.0) + k * (ground(x) - c.1)))
        };
        out.m_o += moment(o);
        out.m_mid += moment((xm, ym));
    }
    // Vertical faces: a jump of the ground at a vertex, with the soil on the high side.
    let limit = |x: f64, side: f64| -> Option<f64> {
        edges
            .iter()
            .filter(|e| e[0] != e[2])
            .filter_map(|e| {
                let (lo, hi) = if e[0] < e[2] {
                    (e[0], e[2])
                } else {
                    (e[2], e[0])
                };
                let covers = if side < 0.0 {
                    lo < x && x <= hi
                } else {
                    lo <= x && x < hi
                };
                covers.then(|| e[1] + (e[3] - e[1]) / (e[2] - e[0]) * (x - e[0]))
            })
            .fold(None, |m: Option<f64>, y| Some(m.map_or(y, |m| m.max(y))))
    };
    let mut xs: Vec<f64> = edges.iter().flat_map(|e| [e[0], e[2]]).collect();
    xs.sort_by(f64::total_cmp);
    xs.dedup();
    for xw in xs {
        let (Some(yl), Some(yr)) = (limit(xw, -1.0), limit(xw, 1.0)) else {
            continue;
        };
        if (yl - yr).abs() <= 1e-9 {
            continue;
        }
        let (y_lo, y_hi, high) = if yr > yl {
            (yl, yr, 1.0)
        } else {
            (yr, yl, -1.0)
        };
        let (edge, base) = if high > 0.0 {
            (x0, slice.y_base_left)
        } else {
            (x1, slice.y_base_right)
        };
        if (edge - xw).abs() > 1e-7 {
            continue;
        }
        let yw = piezo_at(&line, xw);
        let (ya, yb) = (y_lo.max(base), yw.min(y_hi));
        if yb <= ya {
            continue;
        }
        // Pressure `γw·(yw − y)` on the face, pushing toward the soil (the high side).
        let fx = high * GAMMA_W * simpson(ya, yb, |y| yw - y);
        out.fx += fx;
        out.m_o += -high * GAMMA_W * simpson(ya, yb, |y| (yw - y) * (y - o.1));
        out.m_mid += -high * GAMMA_W * simpson(ya, yb, |y| (yw - y) * (y - ym));
    }
    out
}

// ------------------------------------------------------------------------------------------------ the terms

/// The point `O` of the moments: the centre of a circle, or the first base midpoint of a polyline.
fn pivot(r: &MethodReport) -> (f64, f64) {
    match &r.surface {
        ogs_core::report::SurfaceOut::Circle(c) => (c.xc, c.yc),
        ogs_core::report::SurfaceOut::Polyline { .. } => {
            let s = &r.slices[0];
            (
                0.5 * (s.x_left + s.x_right),
                0.5 * (s.y_base_left + s.y_base_right),
            )
        }
    }
}

fn sign_of(doc: &Value) -> f64 {
    let model: Model = serde_json::from_value(doc.clone()).unwrap();
    water::sliding_sign(&PreparedModel::new(&model).unwrap())
}

fn is_air(s: &Slice) -> bool {
    s.weight == 0.0 && s.cohesion == 0.0 && s.tan_phi == 0.0
}

#[test]
fn the_terms_of_every_ponded_slice_are_the_real_forces_at_their_real_points() {
    // For the 17 rows without seismic force: `weight_extra = V`, `h_force = s·H_x`, `h_moment_base` the moment of the
    // water about the midpoint of the base (E2, Spencer and M-P) and `R·driving_extra` the moment about the centre
    // minus the chord term of Bishop (E2).
    let mut worst = 0.0_f64;
    let mut checked = 0;
    for id in pond_rows() {
        let doc = row_doc(&id);
        if has_seismic(&doc) {
            continue;
        }
        let s = sign_of(&doc);
        let report = run(&doc);
        let r = &report.results[0];
        let o = pivot(r);
        let scale: f64 = r.slices.iter().map(|x| x.weight.abs()).sum::<f64>() * 10.0;
        let circle = matches!(r.surface, ogs_core::report::SurfaceOut::Circle(_));
        for sl in r.slices.iter().filter(|x| !is_air(x)) {
            let re = reference(&doc, sl, o);
            let xm = 0.5 * (sl.x_left + sl.x_right);
            let mut errs = vec![
                (sl.weight_extra - re.v).abs() / scale,
                (sl.h_force - s * re.fx).abs() / scale,
                (sl.h_moment_base + s * re.m_mid).abs() / scale / 10.0,
            ];
            if circle {
                let radius = match &r.surface {
                    ogs_core::report::SurfaceOut::Circle(c) => c.r,
                    _ => unreachable!(),
                };
                let expected = s * re.m_o + s * re.v * (xm - o.0);
                errs.push((radius * sl.driving_extra - expected).abs() / (scale * radius));
            }
            for e in errs {
                worst = worst.max(e);
                assert!(e <= 1e-9, "{id} slice at x = {}: relative error {e:e}", xm);
            }
            checked += 1;
        }
    }
    println!("{checked} slices checked, worst relative error {worst:e}");
    assert!(checked > 500);
}

#[test]
fn the_pore_pressure_of_the_base_under_the_water_is_not_clipped_to_the_ground() {
    // E3: `u = γw·max(0, piezo − y_base_mid)` also on a base under the pond (X21-P01: the line at y = 27).
    let report = run(&row_doc("X21-P01"));
    for sl in &report.results[0].slices {
        let ym = 0.5 * (sl.y_base_left + sl.y_base_right);
        let expect = GAMMA_W * (27.0 - ym).max(0.0);
        assert!((sl.pore_pressure - expect).abs() <= 1e-12, "{sl:?}");
    }
}

#[test]
fn the_vertical_face_of_a_dam_pushes_the_slice_that_has_it_as_its_edge() {
    // X21-D01 (E4): the circle leaves through the toe (0, 0) under a vertical face of 12 m with 9 m of water. The
    // thrust is `½·γw·9²`, horizontal, toward the soil, so against the sliding (right_to_left): H = −397,18 kN/m, at
    // `y = 3 m` (the centroid of the triangle).
    let doc = row_doc("X21-D01");
    let report = run(&doc);
    let r = result(&report, "spencer");
    let force = 0.5 * GAMMA_W * 81.0;
    let faced: Vec<&Slice> = r.slices.iter().filter(|s| s.x_left == 0.0).collect();
    assert_eq!(faced.len(), 1, "one slice has the face as its edge");
    let sl = faced[0];
    assert!(
        (sl.h_force + force).abs() <= 1e-9 * force,
        "{} against {}",
        sl.h_force,
        -force
    );
    // No water over the ground on that slice (the ground is the top of the dam): only the face.
    assert_eq!(sl.weight_extra, 0.0);
    let ym = 0.5 * (sl.y_base_left + sl.y_base_right);
    assert!((sl.h_moment_base - (-force) * (3.0 - ym)).abs() <= 1e-9 * force * 12.0);
    // The other slices have no horizontal force.
    assert!(
        r.slices
            .iter()
            .filter(|s| s.x_left != 0.0)
            .all(|s| s.h_force == 0.0)
    );
}

#[test]
fn the_seismic_force_does_not_act_on_the_water() {
    // E7: P04 (kh), P05 (kv) and P06 (both) differ from P01 only in the soil terms `kh·W` and `kv·W`.
    let base = run(&row_doc("X21-P01"));
    let base = &result(&base, "spencer").slices;
    for (id, kh, kv) in [
        ("X21-P04", 0.1, 0.0),
        ("X21-P05", 0.0, 0.05),
        ("X21-P06", 0.1, 0.05),
    ] {
        let report = run(&row_doc(id));
        let seismic = &result(&report, "spencer").slices;
        assert_eq!(seismic.len(), base.len(), "{id}");
        for (a, b) in seismic.iter().zip(base) {
            assert!(
                (a.weight_extra - (b.weight_extra + kv * a.weight)).abs()
                    <= 1e-9 * (1.0 + a.weight),
                "{id}: kv"
            );
            assert!(
                (a.h_force - (b.h_force + kh * a.weight)).abs() <= 1e-9 * (1.0 + a.weight),
                "{id}: kh"
            );
        }
    }
}

// ------------------------------------------------------------------------------------------------ equilibrium

fn interslice(slices: &[Slice], fos: f64, lambda: f64) -> Vec<f64> {
    let mut e = vec![0.0];
    for s in slices {
        let (sin, cos) = s.alpha.sin_cos();
        let w = s.total_weight();
        let d = (sin - lambda * cos) * s.tan_phi + (cos + lambda * sin) * fos;
        let t = w * sin;
        let r =
            (w * cos - s.pore_pressure * s.base_length) * s.tan_phi + s.cohesion * s.base_length;
        let thrust = (fos * cos + s.tan_phi * sin) * s.h_force;
        let last = *e.last().unwrap();
        e.push(last + (fos * t - r + thrust) / d);
    }
    e
}

/// `(Fx, Fy, M)` residuals of the whole mass, normalised: forces by `Σ W*`, the moment by `Σ |W*·rx|`.
/// `N'` and `S` are the ones of the slices of the method (from `E`, the interslice forces); the soil weight acts at
/// the midpoint of the base, the water at its real points (`Reference`), and the interslice forces cancel.
fn residuals(
    doc: &Value,
    slices: &[Slice],
    fos: f64,
    lambda: f64,
    s_dir: f64,
    o: (f64, f64),
) -> (f64, f64, f64) {
    let e = interslice(slices, fos, lambda);
    let (mut fx, mut fy, mut mo, mut sw, mut sm) = (0.0, 0.0, 0.0, 0.0, 0.0);
    for (k, sl) in slices.iter().enumerate() {
        if is_air(sl) {
            continue;
        }
        let (sin, cos) = sl.alpha.sin_cos();
        let w = sl.total_weight();
        let n_eff = w * cos - sl.pore_pressure * sl.base_length - sl.h_force * sin
            + (sin - lambda * cos) * (e[k + 1] - e[k]);
        let shear = (sl.cohesion * sl.base_length + n_eff * sl.tan_phi) / fos;
        let n = n_eff + sl.pore_pressure * sl.base_length;
        let (dx, dy) = (sl.x_right - sl.x_left, sl.y_base_right - sl.y_base_left);
        let len = dx.hypot(dy);
        let (tx, ty) = (dx / len, dy / len);
        let (nx, ny) = (-dy / len, dx / len);
        let (xm, ym) = (
            0.5 * (sl.x_left + sl.x_right),
            0.5 * (sl.y_base_left + sl.y_base_right),
        );
        // Base forces: N toward the slice, S against the sliding.
        let (bx, by) = (n * nx - shear * s_dir * tx, n * ny - shear * s_dir * ty);
        let re = reference(doc, sl, o);
        fx += bx + re.fx;
        fy += by - sl.weight - re.v;
        mo += (xm - o.0) * by - (ym - o.1) * bx;
        mo += -(xm - o.0) * sl.weight + re.m_o;
        sw += sl.weight + re.v;
        sm += (sl.weight * (xm - o.0)).abs() + re.v * (xm - o.0).abs();
    }
    (fx / sw, fy / sw, mo / sm)
}

fn with_tight_tolerance(id: &str) -> Value {
    let mut doc = row_doc(id);
    doc["analysis"]["tolerance"] = json!(1e-12);
    doc["analysis"]["max_iterations"] = json!(2000);
    doc
}

/// Spencer, M-P and Janbu simplified: residuals of the whole mass with the water at its real points. Returns the
/// number of solutions checked and the worst residual; each one must be ≤ 1e-6 (E15e-2).
fn check_global_equilibrium(label: &str, doc: &Value) -> (usize, f64) {
    let s = sign_of(doc);
    let report = run(doc);
    let (mut worst, mut n) = (0.0_f64, 0);
    for r in &report.results {
        let name = method_name(r.method);
        let o = pivot(r);
        let (Some(fos), true) = (r.fos, r.status == SolveStatus::Converged) else {
            continue;
        };
        match name.as_str() {
            "spencer" | "morgenstern_price" => {
                let lambda = r.lambda.expect("lambda");
                let (fx, fy, m) = residuals(doc, &r.slices, fos, lambda, s, o);
                let res = fx.abs().max(fy.abs()).max(m.abs());
                println!(
                    "{label:<14} {name:<18} F {fos:.9} λ {lambda:+.5}: Fx {fx:+.1e} Fy {fy:+.1e} M {m:+.1e}"
                );
                worst = worst.max(res);
                assert!(res <= 1e-6, "{label} {name}: {fx:e} {fy:e} {m:e}");
                n += 1;
            }
            "janbu_simplified" => {
                let (fx, _, _) = residuals(doc, &r.slices, fos, 0.0, s, o);
                println!("{label:<14} {name:<18} F {fos:.9}: Fx {fx:+.1e}");
                worst = worst.max(fx.abs());
                assert!(fx.abs() <= 1e-6, "{label} {name}: {fx:e}");
                n += 1;
            }
            _ => {}
        }
    }
    (n, worst)
}

/// Bishop: `Σ R·S = Σ R·(W*·sin α + driving_extra)`, with `N'` of the vertical equilibrium of Bishop and the same
/// `R·sin α` of the engine, and the per-slice moment of the water about the centre (E15e-2): the residual.
fn bishop_residual(doc: &Value) -> f64 {
    let report = run(doc);
    let r = result(&report, "bishop");
    let fos = r.fos.expect("Bishop converges");
    let (mut resisting, mut driving) = (0.0, 0.0);
    for sl in r.slices.iter().filter(|x| !is_air(x)) {
        let (sin, cos) = sl.alpha.sin_cos();
        let w = sl.total_weight();
        let m = cos + sin * sl.tan_phi / fos;
        let n_eff = (w
            - (sl.cohesion * sl.base_length - sl.pore_pressure * sl.base_length * sl.tan_phi)
                * sin
                / fos)
            / m
            - sl.pore_pressure * sl.base_length;
        resisting += (sl.cohesion * sl.base_length + n_eff * sl.tan_phi) / fos;
        driving += w * sin + sl.driving_extra;
    }
    (resisting - driving).abs() / driving.abs()
}

#[test]
fn global_equilibrium_of_spencer_mp_and_janbu_with_the_water_at_its_real_points() {
    let (mut worst, mut n) = (0.0_f64, 0);
    for id in pond_rows() {
        let doc = with_tight_tolerance(&id);
        if has_seismic(&doc) {
            continue;
        }
        let (k, w) = check_global_equilibrium(&id, &doc);
        n += k;
        worst = worst.max(w);
    }
    println!("{n} solutions, worst residual {worst:e}");
    assert!(n >= 40);
}

#[test]
fn bishop_balance_of_moments_in_its_own_formulation() {
    // ≤ 1e-9 with the iteration tolerance at 1e-12.
    let mut worst = 0.0_f64;
    let mut n = 0;
    for id in pond_rows() {
        let doc = with_tight_tolerance(&id);
        if doc["analysis"]["surface"]["type"] != "circle" {
            continue;
        }
        let residual = bishop_residual(&doc);
        println!("{id:<14} Bishop: residual {residual:.1e}");
        worst = worst.max(residual);
        assert!(residual <= 1e-9, "{id}: {residual:e}");
        n += 1;
    }
    println!("{n} circles, worst {worst:e}");
    assert!(n >= 15);
}

/// X21-D02 with a sloping line over the flat bench: the depth changes along the bench, so a slice has weight, no
/// horizontal force (flat ground) and a moment about the midpoint of its base (the risk that G0 noted).
fn d02_sloping_line() -> Value {
    let mut doc = with_tight_tolerance("X21-D02");
    doc["water"]["piezometric_line"] = json!([[-30, 9.0], [0, 3.0], [10, 0.0], [40, 0.0]]);
    doc
}

#[test]
fn flat_ground_under_a_sloping_water_has_weight_and_moment_but_no_horizontal_force() {
    let doc = d02_sloping_line();
    let report = run(&doc);
    let r = result(&report, "spencer");
    let flat: Vec<&Slice> = r
        .slices
        .iter()
        .filter(|s| s.weight_extra > 0.0 && s.h_force == 0.0)
        .collect();
    assert!(
        flat.len() > 10,
        "the bench carries water ({} slices)",
        flat.len()
    );
    assert!(flat.iter().all(|s| s.h_moment_base != 0.0));
    // And the equilibrium holds there, with the real points of the water.
    let (n, worst) = check_global_equilibrium("D02 sloping", &doc);
    assert!(n >= 3);
    assert!(worst <= 1e-6);
    assert!(bishop_residual(&doc) <= 1e-9);
}

#[test]
fn a_line_that_crosses_the_ground_inside_a_slice_and_a_polyline_keep_the_equilibrium() {
    // V047a with an inclined line that crosses the slope face (the water ends in the middle of a slice).
    let mut doc = with_tight_tolerance("X21-P01");
    doc["water"]["piezometric_line"] = json!([[0, 22.0], [40, 31.0], [100, 40.0]]);
    let (n, worst) = check_global_equilibrium("V047a inclined", &doc);
    assert!(n >= 3);
    assert!(worst <= 1e-6);
    assert!(bishop_residual(&doc) <= 1e-9);
}

// ------------------------------------------------------------------------------------------------ mirror

#[test]
fn the_mirror_rows_of_the_pond_agree_to_1e_9() {
    for (a, b) in [
        ("X21-P01", "X21-P03"),
        ("X21-D01", "X21-D03"),
        ("X21-D02", "X21-D04"),
    ] {
        let (ra, rb) = (run(&row_doc(a)), run(&row_doc(b)));
        assert_eq!(ra.results.len(), rb.results.len());
        for (x, y) in ra.results.iter().zip(&rb.results) {
            let (fx, fy) = (x.fos.unwrap(), y.fos.unwrap());
            assert!(
                (fx - fy).abs() <= 1e-9,
                "{a} / {b} {:?}: {fx} against {fy}",
                x.method
            );
        }
    }
}

// ------------------------------------------------------------------------------------------------ ru

fn v047a_ru(ru: f64) -> Value {
    let mut doc = row_doc("X21-P01");
    doc["materials"][0]["ru"] = json!(ru);
    doc["analysis"]["methods"] = json!(["bishop", "spencer", "janbu_simplified"]);
    doc["analysis"]
        .as_object_mut()
        .unwrap()
        .remove("interslice");
    doc
}

#[test]
fn ru_under_the_pond_counts_the_weight_of_the_water_in_the_pressure() {
    // E15c-ru: `u = ru·(W + V)/b`, with `V` the weight of the pond above the slice, without loads or seismic force.
    let doc = v047a_ru(0.2);
    let report = run(&doc);
    let r = result(&report, "bishop");
    let mut under = 0;
    for sl in &r.slices {
        let expect = 0.2 * (sl.weight + sl.weight_extra) / sl.width;
        assert!(
            (sl.pore_pressure - expect).abs() <= 1e-9 * (1.0 + expect),
            "{} against {expect}",
            sl.pore_pressure
        );
        if sl.weight_extra > 0.0 {
            under += 1;
            assert!(sl.pore_pressure > 0.2 * sl.weight / sl.width);
        }
    }
    assert!(under > 3, "the pond covers some slices");
}

#[test]
fn ru_with_a_pond_gives_a_lower_fs_than_ru_over_the_soil_alone() {
    let doc = v047a_ru(0.2);
    let model: Model = serde_json::from_value(doc.clone()).unwrap();
    let pm = PreparedModel::new(&model).unwrap();
    let report = run(&doc);
    let opts = SolveOptions {
        tolerance: 1e-10,
        max_iterations: 500,
        min_m_alpha: 0.2,
        circular: true,
    };
    for (method, kind) in [
        ("bishop", MethodKind::Bishop),
        ("spencer", MethodKind::Spencer),
        ("janbu_simplified", MethodKind::JanbuSimplified),
    ] {
        let r = result(&report, method);
        let surface = match &r.surface {
            ogs_core::report::SurfaceOut::Circle(c) => Surface::Circle(*c),
            _ => unreachable!(),
        };
        let terms = water::ponded_terms(&pm, &surface, &r.slices, water::sliding_sign(&pm));
        // The same slices, with `ru` over the soil alone: the pressure that the water adds is taken away.
        let soil_only: Vec<Slice> = r
            .slices
            .iter()
            .zip(&terms)
            .map(|(s, t)| Slice {
                pore_pressure: s.pore_pressure - t.pore_pressure,
                ..*s
            })
            .collect();
        let with_water = solve(&r.slices, kind, &opts);
        let without = solve(&soil_only, kind, &opts);
        assert_eq!(with_water.status, SolveStatus::Converged);
        assert_eq!(without.status, SolveStatus::Converged);
        println!(
            "ru = 0.2, {method}: FS {:.6} with the water in u, {:.6} with the soil alone ({:+.2} %)",
            with_water.fos,
            without.fos,
            (with_water.fos / without.fos - 1.0) * 100.0
        );
        assert!(with_water.fos < without.fos, "{method}");
    }
}

#[test]
fn a_material_without_ru_keeps_the_pressure_of_the_line_and_the_pond_does_not_change_it() {
    let report = run(&row_doc("X21-P01"));
    let model: Model = serde_json::from_value(row_doc("X21-P01")).unwrap();
    let pm = PreparedModel::new(&model).unwrap();
    let r = result(&report, "bishop");
    let surface = match &r.surface {
        ogs_core::report::SurfaceOut::Circle(c) => Surface::Circle(*c),
        _ => unreachable!(),
    };
    let terms = water::ponded_terms(&pm, &surface, &r.slices, water::sliding_sign(&pm));
    assert!(terms.iter().any(|t| t.weight > 0.0));
    assert!(terms.iter().all(|t| t.pore_pressure == 0.0));
}

// ------------------------------------------------------------------------------------------------ search

#[test]
fn the_search_with_the_line_2_m_over_the_toe_gives_0_924_and_not_0_132() {
    // X20 §1.2 (V047a with the line at y = 27, 2 m over the toe): cSlope with the search gives 0.92433 / 0.92400 /
    // 0.92375 / 0.90803; the engine without the pond gave 0.13209 (Bishop). The pond is the same for every candidate.
    let text = std::fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../verification/cases/V047a.json"),
    )
    .expect("V047a");
    let case: Value = serde_json::from_str(&text).unwrap();
    let mut doc = case["model"].clone();
    doc["water"] = json!({"unit_weight": GAMMA_W, "piezometric_line": [[0, 27.0], [100, 27.0]]});
    let report = run(&doc);
    for (method, oracle) in [
        ("bishop", 0.92433),
        ("spencer", 0.92400),
        ("morgenstern_price", 0.92375),
        ("janbu_corrected", 0.90803),
    ] {
        let r = result(&report, method);
        let fos = r.fos.expect("a finite FS");
        println!(
            "search {method}: {fos:.5} against {oracle:.5} ({:+.3} %)",
            (fos / oracle - 1.0) * 100.0
        );
        assert!(
            (fos / oracle - 1.0).abs() <= 1e-3,
            "{method}: {fos} against {oracle}"
        );
        assert!(fos > 0.5, "not the 0.132 of the engine without the pond");
        assert!(r.warnings.iter().any(|w| w == "water_above_ground"));
    }
}
