//! R12, writer M-A (F5.12): the tension crack and the water of the engine.
//!
//! One section per amendment, each starting with the test that was RED before the correction (E15l-1 … E15l-10). The
//! documents of the reproductions are in `tests/data/f3g5a/` (copies of `docs/fase3/r12/repro/`).

mod f3_common;

use f3_common::{fos, mirror, run};
use ogs_core::crack;
use ogs_core::report::AnalysisReport;
use serde_json::{Value, json};
use std::path::PathBuf;

fn data(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/data/f3g5a")
        .join(format!("{name}.json"));
    serde_json::from_str(&std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{name}: {e}")))
        .expect("parses")
}

fn tight(mut doc: Value) -> Value {
    doc["analysis"]["tolerance"] = json!(1e-12);
    doc["analysis"]["max_iterations"] = json!(5000);
    doc
}

fn crack_of(report: &AnalysisReport, i: usize) -> (f64, f64, f64) {
    let c = report.results[i]
        .tension_crack
        .expect("the report has a crack");
    (c.x, c.depth, c.water_force)
}

// ------------------------------------------------------------------------------------------------------- E15l-1 (A-01)

/// The automatic crack of a surface that enters at `x_max` (right_to_left) is the one of its mirror image.
#[test]
fn e15l1_entry_at_x_max_rtl_equals_its_mirror() {
    let rtl = tight(data("a01_rtl"));
    let ltr = tight(data("a01_ltr"));
    let (a, b) = (run(&rtl), run(&ltr));
    for i in 0..2 {
        let (fa, fb) = (a.results[i].fos.unwrap(), b.results[i].fos.unwrap());
        assert!(
            (fa - fb).abs() <= 1e-9 * fb.abs(),
            "method {i}: rtl {fa} vs ltr {fb}"
        );
        let ((_, da, pa), (_, db, pb)) = (crack_of(&a, i), crack_of(&b, i));
        assert!(db > 2.0, "the mirror has a real crack: {db}");
        assert!((da - db).abs() <= 1e-9, "depth: rtl {da} vs ltr {db}");
        assert!(
            (pa - pb).abs() <= 1e-9 * pb,
            "water force: rtl {pa} vs ltr {pb}"
        );
    }
}

/// Entry at `x_min` (left_to_right) is the mirror of the same case: the same column rule at the other edge.
#[test]
fn e15l1_entry_at_x_min_ltr_equals_rtl_mirror() {
    let ltr = tight(data("a01_ltr"));
    // The mirror of the document of a01_ltr (which enters at x = -70 = x_min) is a01_rtl.
    let m = tight(mirror(&ltr));
    let (a, b) = (run(&ltr), run(&m));
    for i in 0..2 {
        let (fa, fb) = (a.results[i].fos.unwrap(), b.results[i].fos.unwrap());
        assert!((fa - fb).abs() <= 1e-9 * fa.abs(), "{fa} vs {fb}");
        assert!(crack_of(&b, i).1 > 2.0);
    }
}

/// The search (right_to_left, entry at the edge) does not accept a candidate without crack when `d(x_entry) > 0`, and
/// its best surface is the mirror of the search left_to_right.
#[test]
fn e15l1_search_rtl_never_accepts_depth_zero_and_mirrors() {
    let searching = |mut doc: Value, entry: [f64; 2], exit: [f64; 2]| {
        let an = doc["analysis"].as_object_mut().unwrap();
        an.remove("surface");
        an.insert(
            "search".into(),
            json!({"type": "circular_entry_exit", "entry": entry, "exit": exit,
                   "n_entry": 8, "n_exit": 8, "n_radius": 8}),
        );
        tight(doc)
    };
    let rtl = searching(data("a01_rtl"), [55.0, 70.0], [20.0, 29.0]);
    let ltr = searching(data("a01_ltr"), [-70.0, -55.0], [-29.0, -20.0]);
    let (a, b) = (run(&rtl), run(&ltr));
    for i in 0..2 {
        let (_, depth, _) = crack_of(&a, i);
        assert!(depth > 0.0, "the best candidate has no crack: {depth}");
        let (fa, fb) = (a.results[i].fos.unwrap(), b.results[i].fos.unwrap());
        assert!((fa - fb).abs() <= 1e-9 * fb.abs(), "{fa} vs {fb}");
    }
}

/// Every candidate of a search that enters exactly at `x_max` is judged against the crack of the edge column: the
/// accepted one has `depth = d(x_entry) > 0`, never 0 (before E15l-1 it had `depth 0`).
#[test]
fn e15l1_search_entering_at_the_edge_has_a_crack() {
    let mut doc = tight(data("a01_rtl"));
    doc["materials"][0]["cohesion"] = json!(60.0);
    let an = doc["analysis"].as_object_mut().unwrap();
    an.remove("surface");
    an.insert(
        "search".into(),
        json!({"type": "circular_entry_exit", "entry": [70.0, 70.0], "exit": [20.0, 29.0],
               "n_entry": 1, "n_exit": 10, "n_radius": 10}),
    );
    let report = run(&doc);
    for (i, r) in report.results.iter().enumerate() {
        let (x, depth, force) = crack_of(&report, i);
        assert!(
            depth > 7.0,
            "method {i}: depth {depth} at x = {x}, fos {:?}",
            r.fos
        );
        assert!(force > 100.0, "{force}");
    }
}

/// The model edge only matters for the crack: the surface without a crack is not touched (the same value as before).
#[test]
fn e15l1_without_crack_is_unchanged_at_the_edge() {
    let mut rtl = data("a01_rtl");
    rtl["analysis"]
        .as_object_mut()
        .unwrap()
        .remove("tension_crack");
    let v = fos(&rtl, 0);
    assert!(v.is_finite());
}

// ------------------------------------------------------------------------------------------------------- E15l-2 (A-04)

/// Lower arc of the circle of `a04_udl` at `x`.
fn a04_base(x: f64) -> f64 {
    let (xc, yc, r) = (-42.421052631578945_f64, 55.0_f64, 32.46971740678465_f64);
    yc - (r * r - (x - xc) * (x - xc)).sqrt()
}

/// A `udl` on the crest cancels `d(x)` at its edge. E15m-15 (revises E15l-2): the crack is `d(x_c)` = 0 there, `Pw 0`,
/// as cSlope and the versions before R12; the mass is cut at the edge and the report gives the face (`face_height`).
#[test]
fn e15l2_discontinuity_reports_the_real_face() {
    let doc = tight(data("a04_udl"));
    let report = run(&doc);
    let (x, depth, force) = crack_of(&report, 0);
    let h_face = 35.0 - a04_base(x);
    assert!(h_face > 1.0, "{h_face}");
    assert!(
        (x + 66.5).abs() < 1e-9,
        "the face is at the edge of the udl: {x}"
    );
    assert_eq!((depth, force), (0.0, 0.0), "d(x_c) = 0 under the udl");
    let face = report.results[0].tension_crack.unwrap().face_height;
    assert!(
        (face.unwrap() - h_face).abs() <= 1e-9,
        "face_height {face:?} vs face {h_face}"
    );
    // The mass is cut at the face: the first slice (crest side) ends at x_c, and there is no thrust of water.
    let last = report.results[0].slices.last().unwrap();
    assert!((last.x_left + 66.5).abs() < 1e-9, "{}", last.x_left);
    let sum_h: f64 = report.results[0].slices.iter().map(|s| s.h_force).sum();
    assert_eq!(sum_h, 0.0);
    // The water fill changes nothing: there is no water over a depth of 0.
    let mut half = doc.clone();
    half["analysis"]["tension_crack"]["water_fill"] = json!(0.5);
    let (_, d2, f2) = crack_of(&run(&half), 0);
    assert_eq!((d2, f2), (0.0, 0.0));
}

/// If the face that the discontinuity leaves is nothing (`h_face ≤ tol`), there is no crack: depth 0, no cut and the
/// factor of the model without the crack.
#[test]
fn e15l2_no_face_means_no_crack_and_no_cut() {
    let mut plain = tight(data("a04_udl"));
    plain["analysis"]
        .as_object_mut()
        .unwrap()
        .remove("tension_crack");
    plain["loads"] = json!([]);
    let entry = run(&plain).results[0].slices.last().unwrap().x_left;
    // The udl starts 1e-10 inside the sliding range: d(x_entry) > 0 and the face at the jump is ~1e-10.
    let mut doc = tight(data("a04_udl"));
    doc["loads"] =
        json!([{"type": "udl", "id": "u1", "x1": entry + 1e-10, "x2": -55.0, "q": 100.0}]);
    let mut nocrack = doc.clone();
    nocrack["analysis"]
        .as_object_mut()
        .unwrap()
        .remove("tension_crack");
    let (with, without) = (run(&doc), run(&nocrack));
    let (_, depth, force) = crack_of(&with, 0);
    assert_eq!((depth, force), (0.0, 0.0));
    for i in 0..2 {
        let (a, b) = (
            with.results[i].fos.unwrap(),
            without.results[i].fos.unwrap(),
        );
        assert!((a - b).abs() <= 1e-9 * b, "method {i}: {a} vs {b}");
    }
}

// ------------------------------------------------------------------------------------------------------- E15l-6 (B-01)

const FT_PER_M: f64 = 1.0 / 0.3048;
const LBF_PER_KN: f64 = 1000.0 / 4.4482216152605;

/// The same factors as `apps/web/src/editor/state/units.ts`, applied to a v0.5 document of this file.
fn to_imperial(doc: &Value, label: &str) -> Value {
    let (len, unit_weight, stress) = (
        FT_PER_M,
        LBF_PER_KN / FT_PER_M.powi(3),
        LBF_PER_KN / FT_PER_M.powi(2),
    );
    let scale = |v: &Value, k: f64| json!(v.as_f64().unwrap() * k);
    let mut d = doc.clone();
    d["units"] = json!(label);
    for m in d["materials"].as_array_mut().unwrap() {
        m["unit_weight"] = scale(&m["unit_weight"], unit_weight);
        m["cohesion"] = scale(&m["cohesion"], stress);
    }
    for r in d["regions"].as_array_mut().unwrap() {
        for p in r["polygon"].as_array_mut().unwrap() {
            *p = json!([scale(&p[0], len), scale(&p[1], len)]);
        }
    }
    for k in ["xc", "yc", "r"] {
        d["analysis"]["surface"][k] = scale(&d["analysis"]["surface"][k], len);
    }
    if let Some(t) = d["analysis"]["tension_crack"]["depth"].as_f64() {
        d["analysis"]["tension_crack"]["depth"] = json!(t * len);
    }
    if let Some(line) = d["water"]["piezometric_line"].as_array_mut() {
        for p in line {
            *p = json!([scale(&p[0], len), scale(&p[1], len)]);
        }
    }
    d
}

fn b01_si() -> Value {
    let mut doc = tight(data("a01_ltr"));
    doc["analysis"]["tension_crack"] = json!({"depth": 2.0, "water_fill": 1.0});
    doc
}

fn assert_same_fos(a: &Value, b: &Value, what: &str) {
    let (ra, rb) = (run(a), run(b));
    for i in 0..2 {
        let (fa, fb) = (ra.results[i].fos.unwrap(), rb.results[i].fos.unwrap());
        assert!(
            (fa - fb).abs() <= 1e-9 * fb,
            "{what}, method {i}: {fa} vs {fb}"
        );
        let (ca, cb) = (crack_of(&ra, i), crack_of(&rb, i));
        assert!(cb.2 > 0.0, "{what}: the crack holds water");
        // Pw is a force per metre: it scales with γw·h², in the units of the model (lbf/ft here).
        let k = LBF_PER_KN / FT_PER_M;
        assert!(
            (ca.2 - cb.2 * k).abs() <= 1e-9 * cb.2 * k,
            "{what}: Pw {} vs {}",
            ca.2,
            cb.2 * k
        );
    }
}

/// B-01: a crack with water and no `water` block in imperial units uses γw in pcf (62.45), not 9.81 «pcf».
#[test]
fn e15l6_crack_water_without_water_block_is_unit_invariant() {
    let si = b01_si();
    for label in ["imperial", "Imperial", " IMPERIAL "] {
        assert_same_fos(&to_imperial(&si, label), &si, label);
    }
}

/// The same rule for a `water` block without `unit_weight` (a piezometric line over the ground: ponded water, the
/// pore pressure and the crack all use γw).
#[test]
fn e15l6_piezometric_line_without_unit_weight_is_unit_invariant() {
    let mut si = b01_si();
    si["water"] = json!({"piezometric_line": [[-70.0, 32.0], [-20.0, 24.0]]});
    let imp = to_imperial(&si, "imperial");
    assert_same_fos(&imp, &si, "piezometric line");
    // Explicit γw is never touched: the model written with 62.4493 pcf is the same model.
    let mut explicit = imp.clone();
    explicit["water"]["unit_weight"] = json!(9.81 * LBF_PER_KN / FT_PER_M.powi(3));
    assert_same_fos(&explicit, &si, "explicit");
}

/// In SI the default stays 9.81, and an explicit value always wins (also in imperial).
#[test]
fn e15l6_si_default_and_explicit_value() {
    let si = b01_si();
    let mut explicit = si.clone();
    explicit["water"] = json!({"unit_weight": 9.81});
    assert_eq!(
        run(&si).results[0].tension_crack.unwrap().water_force,
        run(&explicit).results[0].tension_crack.unwrap().water_force
    );
    let mut ten = to_imperial(&si, "imperial");
    ten["water"] = json!({"unit_weight": 62.4});
    let pw = run(&ten).results[0].tension_crack.unwrap().water_force;
    let h = 2.0 * FT_PER_M;
    assert!((pw - 0.5 * 62.4 * h * h).abs() <= 1e-9 * pw, "{pw}");
}

// ------------------------------------------------------------------------------------------------------- E15l-7 (B-06)

fn search_doc(depth: f64) -> Value {
    let mut doc = data("a01_ltr");
    doc["analysis"]["tension_crack"] = json!({"depth": depth, "water_fill": 1.0});
    let an = doc["analysis"].as_object_mut().unwrap();
    an.remove("surface");
    an.insert("search".into(), json!({"type": "circular_entry_exit"}));
    doc
}

fn error_text(doc: &Value) -> String {
    let model: ogs_core::model::Model = serde_json::from_value(doc.clone()).unwrap();
    ogs_core::analyze(&model)
        .expect_err("no surface")
        .to_string()
}

/// A search whose candidates are all discarded by a crack deeper than any surface says so, with the count and the code.
#[test]
fn e15l7_search_message_names_the_crack() {
    let msg = error_text(&search_doc(40.0));
    let re = "NoValidSurface: la búsqueda con bishop no encontró ninguna superficie convergida (";
    assert!(msg.starts_with(re), "{msg}");
    let tail = msg.strip_prefix(re).unwrap();
    // `{e} evaluadas, 0 válidas; {k} no alcanzan la grieta de tracción, tension_crack_not_reached)`
    let (e, rest) = tail
        .split_once(" evaluadas, 0 válidas; ")
        .expect("evaluated, valid");
    let (k, rest) = rest
        .split_once(" no alcanzan la grieta de tracción, ")
        .expect("k");
    assert_eq!(rest, "tension_crack_not_reached)");
    let (e, k): (usize, usize) = (e.parse().unwrap(), k.parse().unwrap());
    assert!(k > 0 && k <= e, "{k} of {e}");
}

/// With no candidate discarded by the crack the message is the one of always, byte by byte.
#[test]
fn e15l7_without_discards_the_message_is_unchanged() {
    // A search that finds nothing for another reason (no candidate is as wide as `min_width`), and no crack.
    let mut doc = data("a01_ltr");
    let an = doc["analysis"].as_object_mut().unwrap();
    an.remove("surface");
    an.remove("tension_crack");
    an.insert(
        "search".into(),
        json!({"type": "circular_entry_exit", "min_width": 1000.0,
               "n_entry": 4, "n_exit": 4, "n_radius": 4}),
    );
    let msg = error_text(&doc);
    assert!(
        msg.starts_with(
            "NoValidSurface: la búsqueda con bishop no encontró ninguna superficie convergida ("
        ),
        "{msg}"
    );
    assert!(
        msg.ends_with(" válidas)") && !msg.contains("grieta"),
        "{msg}"
    );
}

// ------------------------------------------------------------------------------------------------------- E15l-3 (A-08)

fn flat(surface: Value, ground: Value, depth: f64) -> Value {
    json!({
        "format": "opengeoslide", "version": "0.5", "units": "SI",
        "materials": [{"id": "s", "name": "s", "model": "mohr_coulomb", "unit_weight": 18.0,
                       "cohesion": 15.0, "friction_angle": 28.0}],
        "regions": [{"material": "s", "polygon": ground}],
        "slope": {"direction": "left_to_right"},
        "analysis": {"methods": ["bishop"], "slices": 50, "tolerance": 1e-6, "surface": surface,
                     "tension_crack": {"depth": depth, "water_fill": 0.0}}
    })
}

/// A-08: a 86 m span (grid step 0.43 m) and a polyline whose vertex (50.1, 7.0) is 3 m deep, with 0.034 m of surface
/// below the 2.5 m of the crack. The vertex is in the sweep now: the crack is found at the start of that stretch.
#[test]
fn e15l3_polyline_vertex_between_grid_steps_reaches_the_crack() {
    let doc = flat(
        json!({"type": "polyline", "points": [[10, 10], [40, 9.9], [50.0, 9.9], [50.1, 7.0], [50.2, 9.9], [60, 9.9], [76, 10]]}),
        json!([[0, 0], [0, 10], [86, 10], [86, 0]]),
        2.5,
    );
    let mut doc = doc;
    doc["analysis"]["methods"] = json!(["janbu_simplified"]);
    let report = run(&doc);
    let (x, depth, _) = crack_of(&report, 0);
    // 9.9 − 2.9·t = 7.5 on the leg from (50.0, 9.9) to (50.1, 7.0): x = 50.0 + 0.1·(2.4/2.9).
    assert!((x - (50.0 + 0.1 * 2.4 / 2.9)).abs() <= 1e-9, "{x}");
    assert_eq!(depth, 2.5);
}

/// The vertices of the ground are in the sweep too: a narrow bump (0.07 m of ground more than 2.5 m over the arc) that
/// falls between two steps of the grid (39.97 and 40.31) is not stepped over.
#[test]
fn e15l3_terrain_vertex_between_grid_steps_reaches_the_crack() {
    let doc = flat(
        json!({"type": "circle", "xc": 50.0, "yc": 308.0, "r": 300.0}),
        json!([
            [0, 0],
            [0, 10],
            [40.04, 10],
            [40.14, 11.0],
            [40.24, 10],
            [86, 10],
            [86, 0]
        ]),
        2.5,
    );
    let report = run(&doc);
    let (x, depth, _) = crack_of(&report, 0);
    let base = 308.0 - (300.0_f64 * 300.0 - (x - 50.0) * (x - 50.0)).sqrt();
    let ground = 10.0 + (x - 40.04) * 10.0;
    assert!(x > 40.04 && x < 40.14, "{x}");
    assert!((ground - base - 2.5).abs() <= 1e-9, "{}", ground - base);
    assert_eq!(depth, 2.5);
}

/// The edge of a `udl` is in the sweep: with an automatic crack, a strip of surcharge 0.2 m wide that cancels `d(x)` is
/// not stepped over: the crack is at its edge, with `d(x_c)` = 0 and the face in `face_height` (E15m-15).
#[test]
fn e15l3_udl_edge_is_swept() {
    let mut doc = flat(
        json!({"type": "circle", "xc": 50.0, "yc": 308.0, "r": 300.0}),
        json!([[0, 0], [0, 10], [86, 10], [86, 0]]),
        2.5,
    );
    doc["analysis"]["tension_crack"] = json!({"depth": "auto", "water_fill": 0.0});
    doc["loads"] = json!([{"type": "udl", "id": "u", "x1": 30.0, "x2": 30.2, "q": 100.0}]);
    let report = run(&doc);
    let (x, depth, _) = crack_of(&report, 0);
    let base = 308.0 - (300.0_f64 * 300.0 - 20.0 * 20.0).sqrt();
    assert!((x - 30.0).abs() <= 1e-9, "{x}");
    assert_eq!(depth, 0.0);
    let face = report.results[0].tension_crack.unwrap().face_height;
    assert!((face.unwrap() - (10.0 - base)).abs() <= 1e-9, "{face:?}");
}

// ------------------------------------------------------------------------------------------------------- E15l-8 (A-13)

/// A line at `ground + tol/2` is not water over the ground (E15j-4): `d(x)` of the automatic crack does not feel it. The
/// depth is the same as with the line under the crest (before: 1e-8 less, from `q = γw·(w − ground)`).
#[test]
fn e15l8_water_within_the_tolerance_is_not_over_the_ground_in_the_crack() {
    let depth_with = |y: f64| {
        let mut doc = data("a01_rtl");
        doc["water"] = json!({"piezometric_line": [[20.0, y], [70.0, y]]});
        crack_of(&run(&doc), 0).1
    };
    // tol = 1e-9·scale = 5e-8 here: the line 2e-8 over the crest (35) is within it.
    let (dry, within) = (depth_with(34.0), depth_with(35.0 + 2e-8));
    assert!((dry - within).abs() <= 1e-12, "{dry} vs {within}");
    // Beyond the tolerance it does count: the ponded water is a surcharge q = γw·h.
    let over = depth_with(35.0 + 1e-3);
    assert!(over < dry - 1e-4, "{over} vs {dry}");
}

/// `Pw` goes to the last slice with weight, not to an air slice that follows it.
#[test]
fn e15l8_pw_goes_to_the_last_slice_with_weight() {
    use ogs_core::crack::CrackPlan;
    use ogs_core::geometry::PreparedModel;
    use ogs_core::model::{Circle, Model};
    use ogs_core::surface::Surface;
    let mut doc = data("a01_ltr");
    doc["analysis"]
        .as_object_mut()
        .unwrap()
        .remove("tension_crack");
    let report = run(&doc);
    let mut slices = report.results[0].slices.clone();
    let model: Model = serde_json::from_value(doc).unwrap();
    let pm = PreparedModel::new(&model).unwrap();
    let c = Circle {
        xc: 20.0,
        yc: 20.0,
        r: 10.0,
    };
    let surface = Surface::Circle(c);
    // The face-side slice (the last one, toe first) becomes air.
    let n = slices.len();
    slices[n - 1].weight = 0.0;
    let x_c = slices
        .iter()
        .map(|s| s.x_left)
        .fold(f64::INFINITY, f64::min);
    let plan = CrackPlan {
        x_c,
        depth: 1.0,
        breaks: vec![x_c],
        water_height: 1.0,
        gamma_w: 9.81,
    };
    let _ = crack::truncate(&plan, &pm, &surface, &mut slices);
    assert_eq!(slices[n - 1].h_force, 0.0, "the air slice gets no thrust");
    assert!((slices[n - 2].h_force - 0.5 * 9.81).abs() <= 1e-12);
}
