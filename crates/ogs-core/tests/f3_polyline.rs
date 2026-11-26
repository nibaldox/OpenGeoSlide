//! Fixed polyline surface in the engine (F3.3, amendment E13c), through the public API with **Spencer**, the only new
//! capability that W1a can exercise (Morgenstern-Price and Janbu come with W1b).
//!
//! - geometry of the slices: vertices as obligatory nodes, straight bases, exact `alpha`, `base_length` and `y_base_*`,
//!   exact weight, `driving_extra = 0` (a polyline has no centre);
//! - the report carries the **fitted** polyline, and an unfittable one is an `Invalid` status with its reason;
//! - the direction `auto` reads the fitted ends (step 3 of `resolve_sliding`);
//! - the guards of the block and of the method stay: E3 `no_driving`, `OutsideModel`, `water_above_ground`;
//! - criterion 6 of F3.8: a polyline of N chords inscribed in the circle of V047a tends to the Spencer FS of the
//!   circle with order O(1/N²) (table printed with `--nocapture`);
//! - criterion 4: the mirror;
//! - criterion 2: the global equilibrium of Spencer on a polyline, computed here from the forces with
//!   `spencer_interslice`, independently of the solver, about two different points.

mod f3_common;

use f3_common::*;
use ogs_core::methods::SolveStatus;
use ogs_core::methods::spencer::{spencer_direct_normals, spencer_interslice};
use ogs_core::report::{MethodReport, SurfaceOut};
use serde_json::{Value, json};

/// V047a with Spencer on the fixed polyline `points`.
fn spencer_doc(points: &[[f64; 2]]) -> Value {
    let mut doc = v047a(json!(["spencer"]));
    set_polyline(&mut doc, points);
    doc
}

fn result(doc: &Value) -> MethodReport {
    run(doc).results.remove(0)
}

fn fitted(report: &MethodReport) -> Vec<[f64; 2]> {
    match &report.surface {
        SurfaceOut::Polyline { points } => points.clone(),
        other => panic!("a polyline was expected in the report, got {other:?}"),
    }
}

/// Ground of V047a.
fn ground(x: f64) -> f64 {
    if x <= 30.0 {
        25.0
    } else if x <= 50.0 {
        25.0 + 0.5 * (x - 30.0)
    } else {
        35.0
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry of the slices

/// The vertices are obligatory nodes: no slice spans a vertex, and each base is the straight stretch of the polyline.
/// `alpha`, `base_length` and `y_base_*` are exact, and `driving_extra` is 0.
#[test]
fn slices_follow_the_polyline_with_exact_bases() {
    let doc = spencer_doc(&POLYLINE);
    let r = result(&doc);
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let pts = fitted(&r);
    let y_polyline = |x: f64| {
        let i = pts.partition_point(|p| p[0] <= x).clamp(1, pts.len() - 1) - 1;
        let (a, b) = (pts[i], pts[i + 1]);
        a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0])
    };
    // Every vertex is the boundary of two slices (or the end of the first and of the last one).
    for p in &pts {
        assert!(
            r.slices
                .iter()
                .any(|s| s.x_left == p[0] || s.x_right == p[0]),
            "the vertex {p:?} is not a slice boundary"
        );
    }
    assert_eq!(r.slices[0].x_left, pts[0][0]);
    assert_eq!(r.slices.last().unwrap().x_right, pts.last().unwrap()[0]);
    for s in &r.slices {
        // The base ends lie on the polyline, and the polyline is straight between them.
        assert!(
            (s.y_base_left - y_polyline(s.x_left)).abs() <= 1e-12,
            "{s:?}"
        );
        assert!(
            (s.y_base_right - y_polyline(s.x_right)).abs() <= 1e-12,
            "{s:?}"
        );
        let xm = 0.5 * (s.x_left + s.x_right);
        let y_mid = 0.5 * (s.y_base_left + s.y_base_right);
        assert!(
            (y_mid - y_polyline(xm)).abs() <= 1e-12,
            "the base is a chord across a vertex: {s:?}"
        );
        // RightToLeft: the crest is on the right, α > 0 when the base rises toward +x.
        let slope = (s.y_base_right - s.y_base_left) / s.width;
        assert!((s.alpha - slope.atan()).abs() <= 1e-15, "{s:?}");
        assert!(
            (s.base_length - s.width / s.alpha.cos()).abs() <= 1e-12,
            "{s:?}"
        );
        assert_eq!(s.driving_extra, 0.0, "a polyline has no centre: {s:?}");
    }
}

/// A vertex that falls within `1e-9·span` of a uniform division stays a node: the uniform division gives way. Without
/// it the merge of the nodes would drop the vertex when the division came first, and the base would be a chord across it.
#[test]
fn a_vertex_wins_over_a_uniform_division_next_to_it() {
    let (a, b) = (30.0, 51.29111842105263);
    let span = b - a;
    let n = 4;
    let mut points = vec![[a, 25.0]];
    for k in 1..n {
        // 1e-9 over the division k: closer than `1e-9·span` = 2e-8 to it.
        let x = a + span * (k as f64) / (n as f64) + 1e-9;
        points.push([x, ground(x) - 2.0]);
    }
    points.push([b, 35.0]);
    let mut doc = spencer_doc(&points);
    doc["analysis"]["slices"] = json!(n);
    let r = result(&doc);
    assert_eq!(
        fitted(&r),
        points,
        "the polyline is already on the ground at both ends"
    );
    for p in &points {
        assert!(
            r.slices
                .iter()
                .any(|s| s.x_left == p[0] || s.x_right == p[0]),
            "the vertex {p:?} is not a node: {:?}",
            r.slices.iter().map(|s| s.x_left).collect::<Vec<_>>()
        );
    }
}

/// With a `search` the fixed surface is not the one that is analysed (the search wins), so the polyline is ignored and
/// the report carries the circle that was found.
#[test]
fn a_search_wins_over_a_fixed_polyline() {
    let mut doc = spencer_doc(&POLYLINE);
    doc["analysis"]["search"] = json!({"type": "circular_entry_exit"});
    let r = result(&doc);
    assert!(
        matches!(r.surface, SurfaceOut::Circle(_)),
        "{:?}",
        r.surface
    );
    assert!(r.search.is_some());
}

/// The weight is the exact area between the ground and the fitted polyline: the base is straight inside each slice
/// and the ground is straight too (its vertices are nodes), so the rule of the midpoint is exact.
#[test]
fn slices_weigh_the_exact_area_under_the_ground() {
    let doc = spencer_doc(&POLYLINE);
    let r = result(&doc);
    let pts = fitted(&r);
    // Exact area by the trapezoids of (ground − polyline) between the vertices and the ground vertex x = 50.
    let mut xs: Vec<f64> = pts.iter().map(|p| p[0]).collect();
    xs.push(50.0);
    xs.sort_by(f64::total_cmp);
    let y_polyline = |x: f64| {
        let i = pts.partition_point(|p| p[0] <= x).clamp(1, pts.len() - 1) - 1;
        let (a, b) = (pts[i], pts[i + 1]);
        a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0])
    };
    let area: f64 = xs
        .windows(2)
        .map(|w| {
            let (g0, g1) = (ground(w[0]), ground(w[1]));
            let (p0, p1) = (y_polyline(w[0]), y_polyline(w[1]));
            0.5 * ((g0 - p0) + (g1 - p1)) * (w[1] - w[0])
        })
        .sum();
    let weight: f64 = r.slices.iter().map(|s| s.weight).sum();
    assert!(
        (weight / 20.0 - area).abs() <= 1e-9 * area,
        "ΣW/γ = {}, exact area = {area}",
        weight / 20.0
    );
}

/// The report carries the polyline fitted to the ground: the end that was a hair over the ground is trimmed at the
/// crossing (the oracle writes the first point 1e-6 over the toe on purpose), and the end on the ground is kept.
#[test]
fn the_report_emits_the_fitted_polyline() {
    let r = result(&spencer_doc(&POLYLINE));
    let pts = fitted(&r);
    assert_eq!(pts.len(), POLYLINE.len());
    // (30, 25.000001) is 1e-6 over the ramp: the polyline crosses it at x = 30 + 1e-6/(0.5 − 0.104…) ≈ 30.0000025.
    assert!(pts[0][0] > 30.0 && pts[0][0] < 30.00001, "{:?}", pts[0]);
    assert!(
        (pts[0][1] - ground(pts[0][0])).abs() <= 1e-9,
        "{:?}",
        pts[0]
    );
    assert_eq!(&pts[1..], &POLYLINE[1..]);

    // Both ends under the ground are extended along their segments.
    let r = result(&spencer_doc(&[[31.0, 24.0], [40.0, 22.0], [46.0, 25.0]]));
    let pts = fitted(&r);
    assert_eq!(pts.len(), 5);
    assert!((pts[0][0] - 26.5).abs() < 1e-12 && (pts[0][1] - 25.0).abs() < 1e-12);
    assert!((pts[4][0] - 66.0).abs() < 1e-12 && (pts[4][1] - 35.0).abs() < 1e-12);
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
}

/// A model with kh: the force and its moment about the base midpoint are there, but the arm of Bishop is 0, since a
/// polyline has no centre. On the circle of the same model it is not.
#[test]
fn seismic_has_no_centre_on_a_polyline() {
    let mut doc = spencer_doc(&POLYLINE);
    doc["analysis"]["seismic"] = json!({"kh": 0.15});
    let r = result(&doc);
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    for s in &r.slices {
        assert_eq!(s.driving_extra, 0.0);
        assert!((s.h_force - 0.15 * s.weight).abs() <= 1e-12 * s.weight);
        assert!(s.h_moment_base != 0.0 && s.y_centroid > s.y_base_left.min(s.y_base_right));
    }
    let mut circle = v047a(json!(["spencer"]));
    circle["analysis"]["seismic"] = json!({"kh": 0.15});
    assert!(
        result(&circle)
            .slices
            .iter()
            .any(|s| s.driving_extra != 0.0),
        "on the circle the arm of Bishop is there"
    );
}

// ---------------------------------------------------------------------------------------------------------------
// Statuses of a polyline that cannot be fitted, and guards that stay

#[test]
fn a_polyline_that_cannot_be_fitted_is_invalid_with_its_reason() {
    for (points, reason) in [
        // The extension of the right end only reaches y = 29.5 at the wall.
        (
            vec![[32.0, 20.0], [40.0, 22.0]],
            "polyline_no_ground_crossing",
        ),
        // A vertex over the ground.
        (
            vec![[30.0, 25.0], [40.0, 32.0], [51.3, 35.0]],
            "polyline_outside_ground",
        ),
    ] {
        let r = result(&spencer_doc(&points));
        assert_eq!(r.status, SolveStatus::Invalid, "{reason}: {r:?}");
        assert_eq!(r.fos, None);
        assert_eq!(r.warnings, vec![reason.to_string()]);
        assert!(r.slices.is_empty());
        // The report keeps the polyline as it was written.
        assert_eq!(fitted(&r), points);
    }
}

/// The direction `auto` takes the ends of the **fitted** polyline (step 3 of `resolve_sliding`, F3.3).
#[test]
fn auto_direction_reads_the_fitted_ends() {
    // Written, the left end (31, 24) is higher than the right end (44, 23.9); fitted, the right end reaches the flat
    // ground y = 35 at x = 67.4 and the left end the flat ground y = 25 at x = 26.5, so the crest is on the right.
    let points = [[31.0, 24.0], [40.0, 22.0], [44.0, 23.9]];
    let explicit = spencer_doc(&points);
    let mut auto = explicit.clone();
    auto["slope"]["direction"] = json!("auto");
    let (a, b) = (result(&explicit), result(&auto));
    assert_eq!(b.status, SolveStatus::Converged, "{b:?}");
    assert_eq!(a.fos, b.fos, "auto resolves to right_to_left");
    assert_eq!(a.slices, b.slices);
    // The mirror resolves to the other direction, and gives the same FS.
    let mut mirrored = mirror(&explicit);
    mirrored["slope"]["direction"] = json!("auto");
    let m = result(&mirrored);
    assert!((m.fos.unwrap() - a.fos.unwrap()).abs() <= 1e-9 * a.fos.unwrap());
    // A polyline that cannot be fitted still resolves its direction (from the written ends) and reports the reason.
    let mut bad = spencer_doc(&[[32.0, 20.0], [40.0, 22.0]]);
    bad["slope"]["direction"] = json!("auto");
    let r = result(&bad);
    assert_eq!(r.status, SolveStatus::Invalid);
    assert_eq!(r.warnings, vec!["polyline_no_ground_crossing".to_string()]);
}

/// E3: with the direction reversed the surface rises toward the toe, so there is no driving moment.
#[test]
fn a_reversed_direction_is_no_driving() {
    let mut doc = spencer_doc(&POLYLINE);
    doc["slope"]["direction"] = json!("left_to_right");
    let r = result(&doc);
    assert_eq!(r.status, SolveStatus::Invalid, "{r:?}");
    assert!(r.warnings.iter().any(|w| w == "no_driving"), "{r:?}");
    assert_eq!(r.fos, None);
}

/// A polyline under the base of the model is an error of the surface, with a message that speaks of the polyline.
#[test]
fn a_polyline_below_the_model_base_is_no_valid_surface() {
    // The base of V047a is y = 20 and the vertex (40, 15) is under it, still under the ground.
    let doc = spencer_doc(&[
        [30.0, 25.0],
        [35.0, 19.0],
        [40.0, 15.0],
        [45.0, 22.0],
        [51.3, 35.0],
    ]);
    let msg = reject(&doc);
    assert!(
        msg.starts_with("NoValidSurface:") && msg.contains("la polilínea sale del modelo"),
        "{msg}"
    );
}

/// `water_above_ground` is raised on a polyline as on a circle: the piezometric line is over the ground.
#[test]
fn water_above_ground_is_reported_on_a_polyline() {
    let mut doc = spencer_doc(&POLYLINE);
    doc["water"] = json!({"unit_weight": 9.81, "piezometric_line": [[20.0, 40.0], [70.0, 40.0]]});
    let r = result(&doc);
    assert!(
        r.warnings.iter().any(|w| w == "water_above_ground"),
        "{r:?}"
    );
}

// ---------------------------------------------------------------------------------------------------------------
// Criterion 6: a polyline inscribed in the circle tends to the circle

/// The ordinate of the lower arc of the circle of V047a.
fn arc_y(x: f64) -> f64 {
    let (xc, yc, r) = CIRCLE;
    yc - (r * r - (x - xc) * (x - xc)).max(0.0).sqrt()
}

/// The ends of the main block of the circle of V047a: where the lower arc re-enters the ramp of the toe, and where it
/// leaves the flat crest.
///
/// The arc dips under the flat toe (y = 25) for 29.09 < x < 29.99, comes out over it for a sliver up to x = 30, and
/// goes under the ramp again at x ≈ 30.0014. The slicer drops the first stretch (E10a, `truncated_mass`: it is a lens
/// of 0.0036 m of depth), so the mass that the circle analyses starts at that crossing, which is the toe of the
/// polyline too (the oracle writes it as `[30, 25.000001]`).
fn circle_crossings() -> (f64, f64) {
    let (xc, yc, r) = CIRCLE;
    // Bisection of arc(x) − ramp(x), which changes sign on [30, 31].
    let (mut lo, mut hi) = (30.0, 31.0);
    assert!(arc_y(lo) > ground(lo) && arc_y(hi) < ground(hi));
    for _ in 0..200 {
        let mid = 0.5 * (lo + hi);
        if arc_y(mid) > ground(mid) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    let crest = xc + (r * r - (yc - 35.0).powi(2)).sqrt();
    (0.5 * (lo + hi), crest)
}

/// `n` chords with their vertices on the lower arc, between the two ends of its main block.
fn inscribed(n: usize) -> Vec<[f64; 2]> {
    let (x0, x1) = circle_crossings();
    (0..=n)
        .map(|i| {
            let x = x0 + (x1 - x0) * i as f64 / n as f64;
            [x, arc_y(x)]
        })
        .collect()
}

/// Spencer on the polyline of `n` chords, against Spencer on the circle itself, with 2000 slices in both so that the
/// error of the slicing does not hide that of the geometry. The error falls with order two: each doubling of N divides
/// it by about 4.
#[test]
fn inscribed_polyline_converges_to_the_spencer_fos_of_the_circle() {
    let with_slices = |mut doc: Value| {
        doc["analysis"]["slices"] = json!(2000);
        doc["analysis"]["tolerance"] = json!(1e-8);
        doc
    };
    let reference = result(&with_slices(v047a(json!(["spencer"]))));
    assert_eq!(reference.status, SolveStatus::Converged);
    let reference = reference.fos.unwrap();
    println!("Spencer on the circle of V047a (2000 slices): FS = {reference:.10}");
    println!("   N |          FS          |  error vs circle  | error ratio");
    let mut errors: Vec<(usize, f64)> = Vec::new();
    for n in [8usize, 16, 32, 64] {
        let r = result(&with_slices(spencer_doc(&inscribed(n))));
        assert_eq!(r.status, SolveStatus::Converged, "N = {n}: {r:?}");
        let f = r.fos.unwrap();
        let e = f - reference;
        let ratio = errors.last().map_or(f64::NAN, |&(_, p)| p / e.abs());
        println!("{n:4} | {f:.12} | {e:+.4e} | {ratio:.3}");
        errors.push((n, e.abs()));
    }
    // Inscribed chords leave out a sliver of soil on the arc side: the FS is above the circle's (e > 0), and the error
    // falls monotonically.
    for w in errors.windows(2) {
        let ratio = w[0].1 / w[1].1;
        assert!(
            (3.0..=5.0).contains(&ratio),
            "N {} → {}: error {:.3e} → {:.3e} (ratio {ratio:.3}, expected about 4)",
            w[0].0,
            w[1].0,
            w[0].1,
            w[1].1
        );
    }
    assert!(errors.last().unwrap().1 < 1e-4 * reference);
}

// ---------------------------------------------------------------------------------------------------------------
// Criterion 4: mirror

#[test]
fn mirror_spencer_on_polylines() {
    let polylines: Vec<(&str, Vec<[f64; 2]>)> = vec![
        ("F3.8", POLYLINE.to_vec()),
        (
            "extended ends",
            vec![[31.0, 24.0], [40.0, 22.0], [46.0, 25.0]],
        ),
        (
            "trimmed ends",
            vec![
                [28.0, 27.0],
                [35.0, 24.0],
                [41.0, 23.0],
                [46.0, 30.0],
                [53.0, 37.0],
            ],
        ),
        ("inscribed N = 16", inscribed(16)),
    ];
    for (label, points) in polylines {
        for kh in [0.0, 0.15] {
            let mut doc = spencer_doc(&points);
            if kh > 0.0 {
                doc["analysis"]["seismic"] = json!({"kh": kh});
            }
            let (a, b) = (result(&doc), result(&mirror(&doc)));
            assert_eq!(a.status, SolveStatus::Converged, "{label}: {a:?}");
            assert_eq!(b.status, SolveStatus::Converged, "{label} mirrored: {b:?}");
            let (f, g) = (a.fos.unwrap(), b.fos.unwrap());
            println!("mirror {label:<14} kh {kh:.2}: {f:.12} against {g:.12}");
            assert!(
                (f - g).abs() <= 1e-9 * f,
                "{label} kh {kh}: {f} against {g}"
            );
            // The fitted polyline is the mirror image too.
            let (pa, pb) = (fitted(&a), fitted(&b));
            assert_eq!(pa.len(), pb.len(), "{label}");
            for (p, q) in pa.iter().zip(pb.iter().rev()) {
                assert!(
                    (p[0] + q[0]).abs() <= 1e-9 && (p[1] - q[1]).abs() <= 1e-9,
                    "{label}"
                );
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Criterion 2: global equilibrium of Spencer, computed here from the forces

/// What the converged slices of Spencer must satisfy as a whole: `E_n`, the global force balance and the moment of all
/// forces about each of `points`, from the physics and not from the solver.
struct Balance {
    e_n: f64,
    total_w: f64,
    /// Residual of the horizontal and the vertical force.
    force_x: f64,
    force_y: f64,
    /// `(residual moment, driving moment)` about each point.
    moments: Vec<(f64, f64)>,
}

/// Forces on the mass: the weight of each slice at its mid abscissa, and at the midpoint of each base the normal
/// force (along the inward normal) and the shear force (along the chord, toward the crest). The interslice forces are
/// internal and cancel, except at the ends, where `E_0 = 0` and `E_n = 0` is checked.
///
/// `ltr` is the sliding direction: the crest is on the side opposite to it. `N'` comes from the direct form of E7d with
/// the interslice forces of [`spencer_interslice`].
fn balance(r: &MethodReport, ltr: bool, points: &[[f64; 2]]) -> Balance {
    let (f, lambda) = (r.fos.unwrap(), r.lambda.unwrap());
    let crest = if ltr { -1.0 } else { 1.0 };
    let e = spencer_interslice(&r.slices, f, lambda);
    let n_eff = spencer_direct_normals(&r.slices, lambda, &e);
    let (mut fx, mut fy, mut total_w) = (0.0_f64, 0.0_f64, 0.0_f64);
    let mut base = vec![0.0_f64; points.len()];
    let mut weights = vec![0.0_f64; points.len()];
    for (k, s) in r.slices.iter().enumerate() {
        let (sin, cos) = s.alpha.sin_cos();
        let normal = n_eff[k] + s.pore_pressure * s.base_length;
        let shear = (s.cohesion * s.base_length + n_eff[k] * s.tan_phi) / f;
        let (bx, by) = (
            normal * (-crest * sin) + shear * (crest * cos),
            normal * cos + shear * sin,
        );
        let (px, py) = (
            0.5 * (s.x_left + s.x_right),
            0.5 * (s.y_base_left + s.y_base_right),
        );
        fx += bx;
        fy += by;
        total_w += s.weight;
        for (i, p) in points.iter().enumerate() {
            // z component of (P − O) × F, O being the point of the moments.
            weights[i] += (px - p[0]) * (-s.weight);
            base[i] += (px - p[0]) * by - (py - p[1]) * bx;
        }
    }
    Balance {
        e_n: e[e.len() - 1],
        total_w,
        force_x: fx,
        force_y: fy - total_w,
        moments: (0..points.len())
            .map(|i| (weights[i] + base[i], weights[i].abs()))
            .collect(),
    }
}

/// Spencer with `tolerance 1e-8`, as the tests of the global equilibrium of the loads (E12b): the residual of the
/// solver is then far below the 1e-6 that the criterion asks for.
fn tight(mut doc: Value) -> Value {
    doc["analysis"]["tolerance"] = json!(1e-8);
    doc
}

#[test]
fn spencer_is_in_global_equilibrium_on_a_polyline() {
    // Two points that are not on a vertical line through the centroid of the mass, so that neither moment is small.
    let about = [[20.0, 15.0], [75.0, 60.0]];
    let cases: Vec<(&str, Vec<[f64; 2]>)> = vec![
        ("F3.8", POLYLINE.to_vec()),
        (
            "extended ends",
            vec![[31.0, 24.0], [40.0, 22.0], [46.0, 25.0]],
        ),
        ("inscribed N = 16", inscribed(16)),
    ];
    let mut worst = 0.0_f64;
    for (label, points) in &cases {
        for ltr in [false, true] {
            let mut doc = tight(spencer_doc(points));
            if ltr {
                doc = mirror(&doc);
            }
            let r = result(&doc);
            assert_eq!(r.status, SolveStatus::Converged, "{label}: {r:?}");
            let b = balance(&r, ltr, &about);
            println!(
                "[ii] {label:<16} {} F={:.6} λ={:+.4} E_n/ΣW={:+.1e} Fx/ΣW={:+.1e} Fy/ΣW={:+.1e} M1/M={:+.1e} M2/M={:+.1e}",
                if ltr { "ltr" } else { "rtl" },
                r.fos.unwrap(),
                r.lambda.unwrap(),
                b.e_n / b.total_w,
                b.force_x / b.total_w,
                b.force_y / b.total_w,
                b.moments[0].0 / b.moments[0].1,
                b.moments[1].0 / b.moments[1].1,
            );
            assert!(
                b.e_n.abs() <= 1e-6 * b.total_w,
                "{label}: E_n = {:e}",
                b.e_n
            );
            assert!(
                b.force_x.abs() <= 1e-6 * b.total_w,
                "{label}: Fx = {:e}",
                b.force_x
            );
            assert!(
                b.force_y.abs() <= 1e-6 * b.total_w,
                "{label}: Fy = {:e}",
                b.force_y
            );
            for (i, &(residual, motor)) in b.moments.iter().enumerate() {
                assert!(
                    residual.abs() < 1e-6 * motor,
                    "{label}: moment about {:?}: residual {residual:e}, driving {motor:e}",
                    about[i]
                );
                worst = worst.max((residual / motor).abs());
            }
            // The test discriminates: with the crest on the wrong side the moments do not balance.
            let wrong = balance(&r, !ltr, &about);
            assert!(
                wrong.moments[0].0.abs() > 1e-3 * wrong.moments[0].1,
                "{label}: the check does not detect a wrong direction"
            );
        }
    }
    println!("[ii] worst |M_res/M_motor| = {worst:.2e}");
}

// ---------------------------------------------------------------------------------------------------------------
// The polyline of F3.8 with Spencer

/// No oracle value exists for Spencer on a polyline, but Spencer is Morgenstern-Price with `constant` (F3.4), and the
/// oracle gives M-P `constant` on this polyline: 0.9991304877 (F3.8). The value is reported; it is checked at the
/// tolerance of the oracle on a fixed surface.
#[test]
fn spencer_on_the_polyline_of_f3_8() {
    let r = result(&spencer_doc(&POLYLINE));
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let f = r.fos.unwrap();
    let oracle = 0.9991304877;
    println!(
        "Spencer on the polyline of V047a: FS = {f:.10}, λ = {:.6}, iterations {}; cslope M-P constant {oracle:.10}, Δ = {:.4} %",
        r.lambda.unwrap(),
        r.iterations,
        100.0 * (f - oracle).abs() / oracle
    );
    assert!(
        (f - oracle).abs() / oracle <= 1e-3,
        "FS {f} against {oracle}"
    );
}
