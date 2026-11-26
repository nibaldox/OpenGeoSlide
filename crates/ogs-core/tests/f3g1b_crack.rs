//! Wave G1, writer M-grieta: the tension crack (F5.4, E15d) in the engine. The oracle rows themselves are in
//! `f3g_rows.rs`; this file tests what the rows cannot: the position and the face, the force of the water, the
//! independent global equilibrium (F5.5-2), the mirror (F5.5-4), the monotony and the continuity (F5.5-5), the
//! automatic depth, the search (G9), the polylines, the end checks of the truncated mass (G2) and the reinforcements
//! on the crest side of the crack.
//!
//! The documents are the rows of `tests/data/f3g/rows/` (V047a and V079), with `tolerance 1e-12` where the test needs
//! the solver to close the equilibrium much tighter than 1e-5.

mod f3_common;

use f3_common::{CIRCLE, fos, run};
use ogs_core::crack::{self, CrackError};
use ogs_core::geometry::PreparedModel;
use ogs_core::loads::LoadCase;
use ogs_core::methods::SolveStatus;
use ogs_core::model::{CrackDepth, Model, TensionCrack};
use ogs_core::report::{AnalysisReport, MethodReport};
use ogs_core::surface::Surface;
use ogs_core::{OgsError, analyze};
use serde_json::{Value, json};
use std::path::PathBuf;

const GAMMA_W: f64 = 9.81;

fn row(id: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/data/f3g/rows")
        .join(format!("{id}.json"));
    serde_json::from_str(&std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{id}: {e}")))
        .expect("row parses")
}

fn tight(mut doc: Value) -> Value {
    doc["analysis"]["tolerance"] = json!(1e-12);
    doc["analysis"]["max_iterations"] = json!(5000);
    doc
}

fn with_crack(mut doc: Value, depth: Value, fill: f64) -> Value {
    doc["analysis"]["tension_crack"] = json!({"depth": depth, "water_fill": fill});
    doc
}

fn without_crack(mut doc: Value) -> Value {
    doc["analysis"]
        .as_object_mut()
        .unwrap()
        .remove("tension_crack");
    doc
}

fn only(mut doc: Value, methods: &[&str]) -> Value {
    doc["analysis"]["methods"] = json!(methods);
    if !methods.contains(&"morgenstern_price") {
        doc["analysis"]
            .as_object_mut()
            .unwrap()
            .remove("interslice");
    }
    doc
}

fn error_of(doc: &Value) -> OgsError {
    let model: Model = serde_json::from_value(doc.clone()).expect("parses");
    analyze(&model).expect_err("the analysis must fail")
}

fn by_method<'a>(report: &'a AnalysisReport, name: &str) -> &'a MethodReport {
    report
        .results
        .iter()
        .find(|r| serde_json::to_value(r.method).unwrap() == name)
        .unwrap_or_else(|| panic!("no {name}"))
}

// ---------------------------------------------------------------------------------------------- the geometry (G1, G2)

/// Ground of V047a (`right_to_left`, crest on the right): 25 up to x = 30, then 1:2 up to 35 at x = 50.
fn v047a_ground(x: f64) -> f64 {
    if x <= 30.0 {
        25.0
    } else if x <= 50.0 {
        25.0 + 0.5 * (x - 30.0)
    } else {
        35.0
    }
}

fn circle_base(x: f64) -> f64 {
    CIRCLE.1
        - (CIRCLE.2 * CIRCLE.2 - (x - CIRCLE.0).powi(2))
            .max(0.0)
            .sqrt()
}

/// First `x` from the crest end (51.29) where the ground is `d` above the arc: a fine scan and a bisection, written
/// apart from `crack::locate`.
fn expected_crack_x(d: f64) -> f64 {
    let gap = |x: f64| v047a_ground(x) - circle_base(x) - d;
    let entry = CIRCLE.0 + (CIRCLE.2 * CIRCLE.2 - (CIRCLE.1 - 35.0).powi(2)).sqrt();
    let n = 100_000;
    let mut prev = entry;
    for k in 1..=n {
        let x = entry - (entry - 30.0) * (k as f64) / (n as f64);
        if gap(x) >= 0.0 {
            let (mut lo, mut hi) = (x, prev); // gap(lo) >= 0 > gap(hi)
            for _ in 0..200 {
                let mid = 0.5 * (lo + hi);
                if gap(mid) >= 0.0 {
                    lo = mid;
                } else {
                    hi = mid;
                }
            }
            return lo;
        }
        prev = x;
    }
    panic!("the circle never gets {d} m deep");
}

#[test]
fn the_crack_is_where_the_ground_is_d_over_the_surface_and_the_mass_ends_there() {
    // X21 §1.1: d = 2 gives x_c = 48.7109 and d = 3 gives 44.8153.
    for (d, x_ref) in [(2.0, 48.7109), (3.0, 44.8153), (1.0, expected_crack_x(1.0))] {
        let doc = with_crack(only(row("X21-C20"), &["spencer"]), json!(d), 0.0);
        let report = run(&doc);
        let r = &report.results[0];
        let c = r.tension_crack.expect("the crack is reported");
        let x_c = expected_crack_x(d);
        assert!(
            (x_c - x_ref).abs() < 1e-3,
            "d = {d}: the check itself {x_c} against {x_ref}"
        );
        assert!(
            (c.x - x_c).abs() <= 1e-9,
            "d = {d}: x_c {} against {x_c}",
            c.x
        );
        assert_eq!(c.depth, d);
        assert_eq!(c.water_force, 0.0);
        // The mass ends in the vertical face at x_c, where the ground is d above the surface (G2).
        let crest = r.slices.last().unwrap();
        assert!((crest.x_right - x_c).abs() <= 1e-9, "the face of the mass");
        assert!(r.slices.iter().all(|s| s.x_right <= x_c + 1e-9));
        let gap = v047a_ground(crest.x_right) - crest.y_base_right;
        assert!((gap - d).abs() <= 1e-8, "ground − base at the face {gap}");
        // The weight that was removed is not kept as a load.
        assert!(
            r.slices
                .iter()
                .all(|s| s.weight_extra == 0.0 && s.h_force == 0.0)
        );
    }
}

#[test]
fn locate_gives_the_plan_and_reports_what_it_cannot_do() {
    let model: Model = serde_json::from_value(only(row("X21-C20"), &["spencer"])).unwrap();
    let pm = PreparedModel::new(&model).unwrap();
    let circle = ogs_core::model::Circle {
        xc: CIRCLE.0,
        yc: CIRCLE.1,
        r: CIRCLE.2,
    };
    let surface = Surface::Circle(circle);
    let loads = LoadCase::default();
    let spec = |depth, water_fill| TensionCrack { depth, water_fill };

    let plan = crack::locate(&spec(CrackDepth::Fixed(2.0), 0.5), &pm, &surface, &loads).unwrap();
    assert!((plan.x_c - expected_crack_x(2.0)).abs() <= 1e-9);
    assert_eq!(plan.depth, 2.0);
    assert_eq!(plan.water_height, 1.0);
    assert_eq!(plan.gamma_w, GAMMA_W);
    assert_eq!(plan.breaks, vec![plan.x_c]);
    // Deeper than the circle (4.24 m of V047a, X21-A07): the surface has no mass.
    let deep = spec(CrackDepth::Fixed(4.24), 0.0);
    assert_eq!(
        crack::locate(&deep, &pm, &surface, &loads),
        Err(CrackError::NotReached)
    );
    // A circle that does not cut the ground has no sliding range.
    let far = Surface::Circle(ogs_core::model::Circle {
        xc: 40.0,
        yc: 200.0,
        r: 10.0,
    });
    assert_eq!(
        crack::locate(&spec(CrackDepth::Fixed(2.0), 0.0), &pm, &far, &loads),
        Err(CrackError::NoGround)
    );
}

#[test]
fn a_crack_deeper_than_the_surface_is_tension_crack_not_reached() {
    // A07 through the CLI path: the fixed surface fails with the stable code.
    let err = error_of(&with_crack(row("X21-C20"), json!(4.24), 0.0));
    assert!(
        matches!(&err, OgsError::NoValidSurface(m) if m.starts_with(crack::TENSION_CRACK_NOT_REACHED)),
        "{err}"
    );
    // The same for a depth of the order of the height of the slope: G8, no cap.
    let err = error_of(&with_crack(row("X21-C20"), json!(14.2), 0.0));
    assert!(
        matches!(&err, OgsError::NoValidSurface(m) if m.starts_with("tension_crack_not_reached"))
    );
}

// ------------------------------------------------------------------------------------------- the water force (G3, G4, E7)

/// The surface of a row at `x`: a circle or a polyline.
fn base_y_of(doc: &Value, x: f64) -> f64 {
    let s = &doc["analysis"]["surface"];
    if s["type"] == "circle" {
        let (xc, yc, r) = (
            s["xc"].as_f64().unwrap(),
            s["yc"].as_f64().unwrap(),
            s["r"].as_f64().unwrap(),
        );
        yc - (r * r - (x - xc).powi(2)).max(0.0).sqrt()
    } else {
        let pts: Vec<(f64, f64)> = s["points"]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| (p[0].as_f64().unwrap(), p[1].as_f64().unwrap()))
            .collect();
        let k = pts
            .windows(2)
            .position(|w| w[0].0 <= x && x <= w[1].0)
            .or_else(|| (x < pts[0].0).then_some(0))
            .unwrap_or(pts.len() - 2);
        let ((x1, y1), (x2, y2)) = (pts[k], pts[k + 1]);
        y1 + (y2 - y1) * (x - x1) / (x2 - x1)
    }
}

fn gamma_w_of(doc: &Value) -> f64 {
    doc["water"]["unit_weight"].as_f64().unwrap_or(GAMMA_W)
}

#[test]
fn the_water_of_the_crack_is_a_horizontal_force_on_the_slice_of_the_face() {
    for (id, depth) in [("X21-C20", 2.0), ("X21-CP-V079-w000", 15.0)] {
        for fill in [0.25, 0.5, 1.0] {
            let doc = with_crack(row(id), json!(depth), fill);
            let report = run(&doc);
            for r in &report.results {
                let c = r.tension_crack.unwrap();
                let hw = depth * fill;
                let pw = 0.5 * gamma_w_of(&doc) * hw * hw;
                assert!((c.water_force - pw).abs() <= 1e-9 * pw, "{id} {fill}");
                let face = r.slices.last().unwrap();
                let y_g = base_y_of(&doc, c.x) + hw / 3.0;
                let y_mid = 0.5 * (face.y_base_left + face.y_base_right);
                assert!((face.h_force - pw).abs() <= 1e-9 * pw, "{id} {fill}: H");
                assert!(
                    (face.h_moment_base - pw * (y_g - y_mid)).abs() <= 1e-9 * pw,
                    "{id} {fill}: moment about the midpoint of the base"
                );
                // G4: it does not weigh, and the pore pressure of the base is the one of the dry crack.
                assert_eq!(face.weight_extra, 0.0);
                // E7: no seismic force on the water, and no other slice has a horizontal force.
                assert!(
                    r.slices[..r.slices.len() - 1]
                        .iter()
                        .all(|s| s.h_force == 0.0)
                );
                // The slices are the same for every method: a circle has the arm about its centre, a polyline none.
                let moment_arm = if doc["analysis"]["surface"]["type"] == "circle" {
                    let s = &doc["analysis"]["surface"];
                    let (yc, rad) = (s["yc"].as_f64().unwrap(), s["r"].as_f64().unwrap());
                    pw * (yc - y_g) / rad
                } else {
                    0.0
                };
                assert!((face.driving_extra - moment_arm).abs() <= 1e-9 * pw.max(1.0));
            }
        }
    }
}

#[test]
fn the_crack_uses_the_unit_weight_of_the_water_without_a_piezometric_line() {
    // F5.2: no piezometric line is needed. γw is `water.unit_weight` if it is there, and the model's default if not.
    let mut doc = with_crack(only(row("X21-C20"), &["spencer"]), json!(2.0), 1.0);
    doc.as_object_mut().unwrap().remove("water");
    let default = run(&doc).results[0].tension_crack.unwrap().water_force;
    assert!((default - 0.5 * 9.81 * 4.0).abs() < 1e-9, "{default}");
    doc["water"] = json!({"unit_weight": 9.807});
    let given = run(&doc).results[0].tension_crack.unwrap().water_force;
    assert!((given - 0.5 * 9.807 * 4.0).abs() < 1e-9, "{given}");
    // `water_fill = 0` is the dry crack: the force is 0 and the slices have no extra field.
    let dry = run(&with_crack(
        only(row("X21-C20"), &["spencer"]),
        json!(2.0),
        0.0,
    ));
    assert_eq!(dry.results[0].tension_crack.unwrap().water_force, 0.0);
    assert!(
        dry.results[0]
            .slices
            .iter()
            .all(|s| s.h_force == 0.0 && s.h_moment_base == 0.0)
    );
}

// ------------------------------------------------------------------------------------ independent equilibrium (F5.5-2)

/// What an independent global equilibrium needs: the sliding sign (`+1` toward +x), the point where the water of the
/// crack acts and its force, written from the definition (G3), and the centre of the circle if there is one.
struct Frame {
    s: f64,
    pw: f64,
    point: (f64, f64),
    circle: Option<(f64, f64, f64)>,
}

fn frame_of(doc: &Value, r: &MethodReport, depth: f64, fill: f64) -> Frame {
    let c = r.tension_crack.unwrap();
    let hw = depth * fill;
    let s = match doc["slope"]["direction"].as_str().unwrap() {
        "left_to_right" => 1.0,
        _ => -1.0,
    };
    let circle = (doc["analysis"]["surface"]["type"] == "circle").then(|| {
        let a = &doc["analysis"]["surface"];
        (
            a["xc"].as_f64().unwrap(),
            a["yc"].as_f64().unwrap(),
            a["r"].as_f64().unwrap(),
        )
    });
    Frame {
        s,
        pw: 0.5 * gamma_w_of(doc) * hw * hw,
        point: (c.x, base_y_of(doc, c.x) + hw / 3.0),
        circle,
    }
}

/// `E_k` of the force recurrence (`λ` for Spencer and Morgenstern-Price with a constant function, `0` for Janbu): the
/// thrust of the force of the crack goes in as it is, a horizontal force `H` of the slice.
fn interslice(r: &MethodReport, f: f64, lambda: f64) -> Vec<f64> {
    let mut e = vec![0.0];
    for s in &r.slices {
        let (sin, cos) = s.alpha.sin_cos();
        let w = s.total_weight();
        let d = (sin - lambda * cos) * s.tan_phi + (cos + lambda * sin) * f;
        let t = w * sin;
        let res =
            (w * cos - s.pore_pressure * s.base_length) * s.tan_phi + s.cohesion * s.base_length;
        let thrust = (f * cos + s.tan_phi * sin) * s.h_force;
        let last = *e.last().unwrap();
        e.push(last + (f * t - res + thrust) / d);
    }
    e
}

/// Residuals `(Fx, Fy, M)`, normalised, of the forces on the whole mass: `W*` at the midpoint of the base, `N` and `S`
/// at the midpoint of each base, and the force of the crack at its real point. The interslice forces are internal and
/// cancel; the moment equation of the method and `h_moment_base` are not used.
fn global_residuals(r: &MethodReport, fr: &Frame, f: f64, lambda: f64) -> (f64, f64, f64, f64) {
    let e = interslice(r, f, lambda);
    let (xo, yo) = fr.circle.map_or_else(
        || (r.slices[0].x_left, r.slices[0].y_base_left),
        |(xc, yc, _)| (xc, yc),
    );
    let (mut fx, mut fy, mut mo, mut sum_w) = (0.0, 0.0, 0.0, 0.0);
    let (xmin, xmax) = r
        .slices
        .iter()
        .fold((f64::INFINITY, f64::NEG_INFINITY), |a, s| {
            (a.0.min(s.x_left), a.1.max(s.x_right))
        });
    for (k, s) in r.slices.iter().enumerate() {
        let (sin, cos) = s.alpha.sin_cos();
        let w = s.total_weight();
        let n_eff = w * cos - s.pore_pressure * s.base_length - s.h_force * sin
            + (sin - lambda * cos) * (e[k + 1] - e[k]);
        let n = n_eff + s.pore_pressure * s.base_length;
        let shear = (s.cohesion * s.base_length + n_eff * s.tan_phi) / f;
        // Base direction (from left to right) and its upward normal; the shear resists the movement.
        let (dx, dy) = (s.x_right - s.x_left, s.y_base_right - s.y_base_left);
        let len = dx.hypot(dy);
        let (tx, ty) = (dx / len, dy / len);
        let (nx, ny) = (-ty, tx);
        let (xm, ym) = (
            0.5 * (s.x_left + s.x_right),
            0.5 * (s.y_base_left + s.y_base_right),
        );
        let (bx, by) = (n * nx - shear * fr.s * tx, n * ny - shear * fr.s * ty);
        fx += bx;
        fy += by - w;
        mo += (xm - xo) * (by - w) - (ym - yo) * bx;
        sum_w += w;
    }
    // The water of the crack, at its real point (x_c, y_g), horizontal and in the sliding direction.
    let h = fr.s * fr.pw;
    fx += h;
    mo += -(fr.point.1 - yo) * h;
    let l = xmax - xmin;
    (
        fx / sum_w,
        fy / sum_w,
        mo / (sum_w * l),
        e[r.slices.len()] / sum_w,
    )
}

#[test]
fn the_global_equilibrium_with_the_force_of_the_crack_closes() {
    // F5.5-2: Spencer, M-P and Janbu simplified within 1e-6 of the driving scale (the prototype gets 2e-16).
    let cases = [
        ("X21-C20", 2.0, 0.0),
        ("X21-W100", 2.0, 1.0),
        ("X21-W100m", 2.0, 1.0),
        ("X21-W050", 2.0, 0.5),
        ("X21-CP-V096c", 1.015, 0.0),
        ("X21-CP-V079-w100", 15.0, 1.0),
        ("X21-CP-V079-w050", 15.0, 0.5),
        ("X21-CP-V080", 15.0, 0.25),
    ];
    for (id, depth, fill) in cases {
        let doc = explicit_direction(tight(row(id)));
        assert_eq!(
            doc["analysis"]["tension_crack"]["depth"].as_f64(),
            Some(depth),
            "{id}"
        );
        let report = run(&doc);
        for r in &report.results {
            assert_eq!(r.status, SolveStatus::Converged, "{id}");
            let name = serde_json::to_value(r.method).unwrap();
            let fr = frame_of(&doc, r, depth, fill);
            let f = r.fos.unwrap();
            match name.as_str().unwrap() {
                "spencer" | "morgenstern_price" => {
                    let (fx, fy, m, closure) = global_residuals(r, &fr, f, r.lambda.unwrap());
                    println!(
                        "{id:<18} {name}: Fx {fx:+.1e} Fy {fy:+.1e} M {m:+.1e} E_n {closure:+.1e}"
                    );
                    assert!(
                        fx.abs() <= 1e-6
                            && fy.abs() <= 1e-6
                            && m.abs() <= 1e-6
                            && closure.abs() <= 1e-6,
                        "{id} {name}: {fx} {fy} {m} {closure}"
                    );
                }
                "janbu_simplified" => {
                    let (fx, _, _, closure) = global_residuals(r, &fr, f, 0.0);
                    println!("{id:<18} {name}: Fx {fx:+.1e} E_n {closure:+.1e}");
                    assert!(
                        fx.abs() <= 1e-6 && closure.abs() <= 1e-6,
                        "{id} {name}: {fx} {closure}"
                    );
                }
                "bishop" => {
                    // Its own formulation, with the same `R·sin α` as the engine: F·ΣM_driving = ΣM_resisting, the
                    // moment of the water of the crack taken from its real point.
                    let (_, yc, rad) = fr.circle.expect("Bishop is only on circles");
                    let (mut driving, mut resisting) = (0.0, 0.0);
                    for s in &r.slices {
                        let (sin, cos) = s.alpha.sin_cos();
                        let w = s.total_weight();
                        let m_alpha = cos + sin * s.tan_phi / f;
                        resisting += (s.cohesion * s.width
                            + (w - s.pore_pressure * s.width) * s.tan_phi)
                            / m_alpha;
                        driving += w * sin;
                    }
                    driving += fr.pw * (yc - fr.point.1) / rad;
                    let residual = (f * driving - resisting) / resisting;
                    println!("{id:<18} {name}: moment {residual:+.1e}");
                    assert!(residual.abs() <= 1e-9, "{id} bishop: {residual}");
                }
                _ => {}
            }
        }
    }
}

#[test]
fn a_wrong_sign_of_the_force_of_the_crack_breaks_the_equilibrium() {
    // The test discriminates: with the force on the other side the global residual is not small.
    let doc = tight(row("X21-W100"));
    let report = run(&doc);
    let r = by_method(&report, "spencer");
    let mut fr = frame_of(&doc, r, 2.0, 1.0);
    fr.pw = -fr.pw;
    let (fx, _, m, _) = global_residuals(r, &fr, r.fos.unwrap(), r.lambda.unwrap());
    assert!(fx.abs() > 1e-3 && m.abs() > 1e-4, "{fx} {m}");
}

// -------------------------------------------------------------------------------------------------- mirror (F5.5-4, G5)

/// Mirrors a row x → −x: the regions, the water, the loads and the surface. The direction is inverted.
fn mirrored(doc: &Value) -> Value {
    let mut d = f3_common::mirror(doc);
    if let Some(line) = doc["water"]["piezometric_line"].as_array() {
        let pts: Vec<Value> = line
            .iter()
            .rev()
            .map(|p| json!([-p[0].as_f64().unwrap(), p[1]]))
            .collect();
        d["water"]["piezometric_line"] = Value::Array(pts);
    }
    if let Some(loads) = doc["loads"].as_array() {
        let flipped: Vec<Value> = loads
            .iter()
            .map(|l| {
                let mut l = l.clone();
                let (x1, x2) = (l["x1"].as_f64().unwrap(), l["x2"].as_f64().unwrap());
                l["x1"] = json!(-x2);
                l["x2"] = json!(-x1);
                l
            })
            .collect();
        d["loads"] = Value::Array(flipped);
    }
    d
}

/// The rows of the corpus have `direction: auto`; the mirror needs the direction written. It is the one that gives the
/// FS of the document as it is.
fn explicit_direction(mut doc: Value) -> Value {
    if doc["slope"]["direction"] != "auto" {
        return doc;
    }
    let auto = run(&doc).results[0].fos.unwrap();
    for dir in ["right_to_left", "left_to_right"] {
        doc["slope"]["direction"] = json!(dir);
        if run(&doc).results[0].fos == Some(auto) {
            return doc;
        }
    }
    panic!("no direction gives the FS of `auto`");
}

#[test]
fn the_mirror_gives_the_same_fs_with_the_crack_dry_wet_automatic_and_on_a_polyline() {
    for id in [
        "X21-W100",
        "X21-W025",
        "X21-C30",
        "X21-A02",
        "X21-A05",
        "X21-A03",
        "X21-CP-V096c",
        "X21-CP-V079-w100",
        "X21-CP-V079-d10",
        "X21-CP-V088",
    ] {
        let doc = explicit_direction(tight(row(id)));
        let (a, b) = (run(&doc), run(&mirrored(&doc)));
        for (ra, rb) in a.results.iter().zip(&b.results) {
            let (x, y) = (ra.fos.unwrap(), rb.fos.unwrap());
            println!("mirror {id} {:?}: |ΔFS| = {:.2e}", ra.method, (x - y).abs());
            assert!(
                (x - y).abs() <= 1e-9,
                "{id} {:?}: {x} against {y}",
                ra.method
            );
            let (ca, cb) = (ra.tension_crack.unwrap(), rb.tension_crack.unwrap());
            assert!(
                (ca.x + cb.x).abs() <= 1e-9 && (ca.depth - cb.depth).abs() <= 1e-9,
                "{id}"
            );
            assert!((ca.water_force - cb.water_force).abs() <= 1e-9, "{id}");
        }
    }
}

// ---------------------------------------------------------------------------------- monotony and continuity (F5.5-5)

#[test]
fn the_fs_falls_with_the_fill_of_the_crack_in_every_method_and_in_a_search() {
    for (id, depth) in [
        ("X21-C20", 2.0),
        ("X21-CP-V079-w000", 15.0),
        ("X21-CP-V096c", 1.015),
    ] {
        let fills = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
        let figures: Vec<AnalysisReport> = fills
            .iter()
            .map(|&f| run(&with_crack(row(id), json!(depth), f)))
            .collect();
        for k in 0..figures[0].results.len() {
            for w in figures.windows(2) {
                let (a, b) = (w[0].results[k].fos.unwrap(), w[1].results[k].fos.unwrap());
                assert!(
                    b < a,
                    "{id} {:?}: {b} is not below {a}",
                    w[0].results[k].method
                );
            }
        }
    }
    // With a search the minimum over the surfaces cannot rise with the fill either.
    let mut base = only(row("X21-C20"), &["bishop", "spencer"]);
    base["analysis"].as_object_mut().unwrap().remove("surface");
    base["analysis"]["search"] = json!({"type": "circular_entry_exit"});
    let fs: Vec<Vec<f64>> = [0.0, 0.5, 1.0]
        .iter()
        .map(|&f| {
            run(&with_crack(base.clone(), json!(2.0), f))
                .results
                .iter()
                .map(|r| r.fos.unwrap())
                .collect()
        })
        .collect();
    for k in 0..2 {
        assert!(
            fs[0][k] > fs[1][k] && fs[1][k] > fs[2][k],
            "search {k}: {fs:?}"
        );
    }
}

#[test]
fn the_fs_tends_to_the_surface_without_a_crack_as_the_depth_goes_to_zero() {
    for fill in [0.0, 1.0] {
        let reference = run(&without_crack(row("X21-C20")));
        let mut last = vec![f64::INFINITY; 5];
        for depth in [1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6] {
            let report = run(&with_crack(row("X21-C20"), json!(depth), fill));
            for (k, r) in report.results.iter().enumerate() {
                let gap = (r.fos.unwrap() / reference.results[k].fos.unwrap() - 1.0).abs();
                assert!(
                    gap < last[k],
                    "fill {fill} {:?} depth {depth}: {gap} after {}",
                    r.method,
                    last[k]
                );
                last[k] = gap;
            }
        }
        println!("continuity, fill {fill}: |FS/FS0 − 1| at depth 1e-6 = {last:?}");
        assert!(last.iter().all(|&g| g < 2e-6), "fill {fill}: {last:?}");
    }
}

// ----------------------------------------------------------------------------------------- the automatic depth (G6, G7)

fn rankine(c: f64, phi_deg: f64, gamma: f64, q: f64) -> f64 {
    (2.0 * c / (gamma * (std::f64::consts::FRAC_PI_4 - phi_deg.to_radians() / 2.0).tan())
        - q / gamma)
        .max(0.0)
}

#[test]
fn the_automatic_depth_is_rankine_with_the_material_under_the_ground() {
    // V047a: c = 3, φ = 19.6°, γ = 20 → 0.4253 m; with a surcharge `udl` over the crest, minus q/γ.
    let base = with_crack(only(row("X21-C20"), &["spencer"]), json!("auto"), 0.0);
    let depth = run(&base).results[0].tension_crack.unwrap().depth;
    assert!(
        (depth - rankine(3.0, 19.6, 20.0, 0.0)).abs() < 1e-9,
        "{depth}"
    );
    let mut loaded = base.clone();
    loaded["loads"] = json!([{"type": "udl", "x1": 45.0, "x2": 70.0, "q": 4.0}]);
    let depth_q = run(&loaded).results[0].tension_crack.unwrap().depth;
    assert!(
        (depth_q - rankine(3.0, 19.6, 20.0, 4.0)).abs() < 1e-9,
        "{depth_q}"
    );
    // X21-A01: c = 10 → 1.4176 m.
    let a01 = run(&only(row("X21-A01"), &["spencer"]));
    let d = a01.results[0].tension_crack.unwrap().depth;
    assert!((d - rankine(10.0, 19.6, 20.0, 0.0)).abs() < 1e-3, "{d}");
    // The crack is where the surface is as deep as that depth.
    let c = a01.results[0].tension_crack.unwrap();
    let r = &a01.results[0];
    let crest = r.slices.last().unwrap();
    assert!((v047a_ground(c.x) - crest.y_base_right - c.depth).abs() < 1e-6);
}

#[test]
fn undrained_and_mohr_coulomb_with_phi_zero_give_the_same_automatic_crack() {
    // G7: φ = 0 → z = 2c/γ, and the two material models give the same FS.
    let undrained = with_crack(row("X21-A03"), json!("auto"), 1.0);
    let mut mc = undrained.clone();
    mc["materials"] = json!([{"id": "soil", "name": "Soil", "model": "mohr_coulomb", "unit_weight": 20.0,
                              "cohesion": 25.0, "friction_angle": 0.0}]);
    let (a, b) = (run(&undrained), run(&mc));
    for (ra, rb) in a.results.iter().zip(&b.results) {
        assert!(
            (ra.fos.unwrap() - rb.fos.unwrap()).abs() <= 1e-12,
            "{:?}",
            ra.method
        );
        let (ca, cb) = (ra.tension_crack.unwrap(), rb.tension_crack.unwrap());
        assert_eq!(ca.depth, cb.depth);
        assert!(
            (ca.depth - 2.5).abs() < 1e-9,
            "2·Su/γ = 2.5, got {}",
            ca.depth
        );
    }
}

#[test]
fn an_automatic_depth_of_zero_is_no_crack() {
    // Without cohesion the Rankine depth is 0: nothing is cut, and the FS is the one without the crack.
    let mut doc = with_crack(row("X21-C20"), json!("auto"), 1.0);
    doc["materials"][0]["cohesion"] = json!(0.0);
    let with = run(&doc);
    let without = run(&without_crack(doc));
    for (a, b) in with.results.iter().zip(&without.results) {
        assert_eq!(a.fos, b.fos, "{:?}", a.method);
        let c = a.tension_crack.unwrap();
        assert_eq!((c.depth, c.water_force), (0.0, 0.0));
        assert_eq!(a.slices.len(), b.slices.len());
    }
}

// ------------------------------------------------------------------------------------------------ the search (G9)

#[test]
fn the_search_discards_the_candidates_that_do_not_reach_the_crack() {
    let mut base = only(row("X21-C20"), &["bishop"]);
    base["analysis"].as_object_mut().unwrap().remove("surface");
    base["analysis"]["search"] = json!({"type": "circular_entry_exit"});
    let plain = run(&without_crack(base.clone()));
    let deep = run(&with_crack(base.clone(), json!(12.0), 1.0));
    let stats = |r: &AnalysisReport| r.results[0].search.unwrap();
    // Candidates that stay shallower than 12 m are dropped: far fewer valid surfaces, and none of them is analysed
    // without the cut.
    assert!(
        stats(&deep).valid < stats(&plain).valid / 4,
        "{:?} {:?}",
        stats(&deep),
        stats(&plain)
    );
    let r = &deep.results[0];
    let c = r.tension_crack.unwrap();
    assert_eq!(c.depth, 12.0);
    let crit = &doc_circle(r);
    // The critical circle does get 12 m under the ground at x_c, and it is the one that is reported.
    let ground = v047a_ground(c.x).min(35.0);
    let base_y = crit.1 - (crit.2 * crit.2 - (c.x - crit.0).powi(2)).sqrt();
    assert!((ground - base_y - 12.0).abs() < 1e-6, "{ground} {base_y}");
    // If every candidate is discarded, it is the usual NoValidSurface.
    let err = error_of(&with_crack(base, json!(40.0), 1.0));
    assert!(
        matches!(&err, OgsError::NoValidSurface(m) if m.contains("ninguna superficie convergida")),
        "{err}"
    );
}

fn doc_circle(r: &MethodReport) -> (f64, f64, f64) {
    match &r.surface {
        ogs_core::report::SurfaceOut::Circle(c) => (c.xc, c.yc, c.r),
        other => panic!("{other:?}"),
    }
}

#[test]
fn the_search_with_the_automatic_crack_reports_where_it_is() {
    let mut base = with_crack(
        only(row("X21-A01"), &["bishop", "spencer"]),
        json!("auto"),
        1.0,
    );
    base["analysis"].as_object_mut().unwrap().remove("surface");
    base["analysis"]["search"] = json!({"type": "circular_entry_exit"});
    let report = run(&base);
    for r in &report.results {
        let c = r.tension_crack.unwrap();
        assert!(
            (c.depth - rankine(10.0, 19.6, 20.0, 0.0)).abs() < 1e-3,
            "{c:?}"
        );
        assert!(c.water_force > 0.0);
        assert!(r.slices.iter().all(|s| s.x_right <= c.x + 1e-9));
    }
    // The crack of the search is the one of the same circle fixed: re-analysing it gives the same FS.
    let circle = doc_circle(&report.results[1]);
    let mut fixed = base.clone();
    fixed["analysis"].as_object_mut().unwrap().remove("search");
    fixed["analysis"]["surface"] =
        json!({"type": "circle", "xc": circle.0, "yc": circle.1, "r": circle.2});
    let again = run(&fixed);
    assert!((again.results[1].fos.unwrap() - report.results[1].fos.unwrap()).abs() <= 1e-9);
}

// ----------------------------------------------------------------------------------------------------- polylines

#[test]
fn the_crack_of_a_polyline_is_cut_after_the_fit_to_the_ground() {
    // V079: the plane is the polyline (0, 0) → (51.96, 30), fitted to the ground; the crack of 15 m cuts it.
    let report = run(&row("X21-CP-V079-w000"));
    for r in &report.results {
        let c = r.tension_crack.unwrap();
        assert_eq!(c.depth, 15.0);
        // The ground is 30 up there (y = 30 from x = 17), the plane gets 15 m under it at y = 15, x = 25.98.
        assert!((c.x - 25.981).abs() < 2e-3, "{}", c.x);
        let ogs_core::report::SurfaceOut::Polyline { points } = &r.surface else {
            panic!("a polyline");
        };
        // The reported surface is cut to the slices that remain (E13l-7): it ends on the face.
        let last = points.last().unwrap();
        assert!(
            (last[0] - c.x).abs() < 1e-6 && (last[1] - 15.0).abs() < 2e-3,
            "{points:?}"
        );
    }
    // Bishop is still not offered on a polyline.
    let mut doc = row("X21-CP-V079-w000");
    doc["analysis"]["methods"] = json!(["bishop"]);
    doc["analysis"]
        .as_object_mut()
        .unwrap()
        .remove("interslice");
    let err = ogs_core::analyze_json(&doc.to_string()).unwrap_err();
    assert!(err.contains("solo admite superficies circulares"), "{err}");
}

// --------------------------------------------------------------------------- G2: the end checks of the truncated mass

#[test]
fn a_circle_that_leaves_the_model_past_the_crack_is_a_valid_mass() {
    // V047a with the right wall at x = 50.5: the circle enters the ground at 51.29, beyond the wall, so without the
    // crack the arc is under the ground at the wall and leaves the model. The crack of 2 m cuts at x = 48.71: the
    // mass does not touch the wall.
    let mut doc = only(row("X21-C20"), &["bishop", "spencer"]);
    doc["regions"][0]["polygon"] = json!([
        [20, 20],
        [20, 25],
        [30, 25],
        [50, 35],
        [50.5, 35],
        [50.5, 20]
    ]);
    let err = error_of(&without_crack(doc.clone()));
    assert!(
        matches!(&err, OgsError::NoValidSurface(m) if m.contains("sale del modelo")),
        "{err}"
    );
    let with = run(&doc);
    let reference = run(&only(row("X21-C20"), &["bishop", "spencer"]));
    for (a, b) in with.results.iter().zip(&reference.results) {
        // The mass is the same one as in the model without the wall: the same FS.
        assert!(
            (a.fos.unwrap() / b.fos.unwrap() - 1.0).abs() < 1e-9,
            "{:?}",
            a.method
        );
        assert_eq!(a.slices.len(), b.slices.len());
    }
}

#[test]
fn the_toe_ends_of_the_circles_that_touch_the_bottom_keep_their_rule() {
    // E15f. The critical circles of V096a and V086b of X21 §5 pass 8.4e-7 and 9.8e-7 under the bottom of the model
    // (`yc − r`), 12 and 33 times the tolerance `1e-9·scale` of the engine. It is not the rounding of the contact, as
    // in V065 (1 ulp of `xc + r`): the circle of the oracle really goes under the base. The rule stays, with or
    // without the crack (the baseline gives the same error), and the circle is valid as soon as the model goes 1e-6
    // lower. The 2 m of the rows of X21 were not necessary.
    for (id, old_bottom, bottom) in [
        ("X21-S-V096a-fija", -11.0, -9.0),
        ("X21-S-V086b-fija", -2.0, 0.0),
    ] {
        let doc = row(id);
        let c = &doc["analysis"]["surface"];
        let over = bottom - (c["yc"].as_f64().unwrap() - c["r"].as_f64().unwrap());
        assert!(
            over > 8e-7 && over < 1e-6,
            "{id}: the circle is {over} under the bottom"
        );
        let set_bottom = |level: f64| {
            let mut d = doc.clone();
            for region in d["regions"].as_array_mut().unwrap() {
                for p in region["polygon"].as_array_mut().unwrap() {
                    if p[1] == json!(old_bottom) {
                        p[1] = json!(level);
                    }
                }
            }
            d
        };
        for with_crack in [true, false] {
            let probe = if with_crack {
                set_bottom(bottom)
            } else {
                without_crack(set_bottom(bottom))
            };
            let err = error_of(&probe);
            assert!(
                matches!(&err, OgsError::NoValidSurface(m) if m.contains("sale del modelo")),
                "{id} crack {with_crack}: {err}"
            );
        }
        let ok = run(&set_bottom(bottom - 1e-6));
        let oracle = row(id);
        assert!(
            ok.results
                .iter()
                .all(|r| r.status == SolveStatus::Converged && r.fos.is_some())
        );
        assert!(oracle["analysis"]["tension_crack"].is_object());
    }
    // V086b with the automatic crack: its circle does not touch the bottom (7.8e-5 over it), and with the original
    // bottom it is valid now. Oracle X21-S-V086b-auto: 0.966460 (Bishop); the model with the bottom at 0.
    let mut doc = row("X21-S-V086b-auto");
    for region in doc["regions"].as_array_mut().unwrap() {
        for p in region["polygon"].as_array_mut().unwrap() {
            if p[1] == json!(-2.0) {
                p[1] = json!(0.0);
            }
        }
    }
    let r = run(&doc);
    assert!((by_method(&r, "bishop").fos.unwrap() / 0.966_459_703_523_008_1 - 1.0).abs() < 1e-3);
}

// ------------------------------------------------------------------------------------------- reinforcements (F5.4)

#[test]
fn a_reinforcement_that_crosses_on_the_crest_side_of_the_crack_is_outside_the_mass() {
    // A horizontal passive nail at y = 34 crosses the circle of V047a at x = 50.39, on the crest side of the crack
    // (x_c = 48.71 for 2 m). With the crack it is outside the mass and the FS is the one without the nail.
    let nail = json!([{"type": "nail", "id": "N1", "x1": 45.0, "y1": 34.0, "x2": 60.0, "y2": 34.0,
                       "application": "passive", "tensile_capacity": 300, "direction": "axial"}]);
    let mut cracked = with_crack(only(row("X21-C20"), &["spencer"]), json!(2.0), 0.0);
    cracked["version"] = json!("0.5");
    let alone = fos(&cracked, 0);
    cracked["reinforcements"] = nail.clone();
    let report = run(&cracked);
    let r = &report.results[0];
    assert!(
        r.warnings.iter().any(|w| w == "reinforcement_outside_mass"),
        "{:?}",
        r.warnings
    );
    assert!((r.fos.unwrap() - alone).abs() <= 1e-12);
    // The same nail on the surface without the crack does act.
    let mut plain = without_crack(cracked.clone());
    plain["reinforcements"] = nail;
    let with_nail = run(&plain);
    let r = &with_nail.results[0];
    assert!(
        !r.warnings.iter().any(|w| w == "reinforcement_outside_mass"),
        "{:?}",
        r.warnings
    );
    assert!(r.fos.unwrap() > fos(&without_crack(row("X21-C20")), 0) + 1e-3);
}
