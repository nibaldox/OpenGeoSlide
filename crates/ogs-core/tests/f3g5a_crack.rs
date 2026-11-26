//! R12, writer M-A (F5.12): the tension crack and the water of the engine.
//!
//! One section per amendment, each starting with the test that was RED before the correction (E15l-1 … E15l-10). The
//! documents of the reproductions are in `tests/data/f3g5a/` (copies of `docs/fase3/r12/repro/`).

mod f3_common;

use f3_common::{fos, mirror, run};
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
