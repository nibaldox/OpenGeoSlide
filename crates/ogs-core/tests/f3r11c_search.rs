//! E14o-7 (R11A-07): circular search with reinforcements. The default search (`20×20×20 + refine`) must stay
//! within 1 % of the fine grid (`60×60×40 + refine`, measured with the binary of the base commit 3aa3369) when the
//! reinforcements make the FS jump, and without reinforcements it must stay byte-identical to that binary.
//!
//! The reference values below come from `target/release/ogs analyze` of the base commit, with the models of this
//! file; they are not snapshots of the code under test (see `docs/fase3/r11c/NOTAS.md`).

use ogs_core::geometry::{Ground, Sliding};
use ogs_core::model::{Circle, SearchSpec};
use ogs_core::search::{ElementEnd, search_circular, search_circular_reinforced};
use serde_json::{Value, json};

mod f3_common;
use f3_common::fos;

/// Gap allowed with respect to the fine grid of the base commit.
const GAP: f64 = 0.01;

fn anchor(id: &str, head: [f64; 2], tip: [f64; 2], t: f64, application: &str) -> Value {
    json!({"id": id, "type": "anchor", "x1": head[0], "y1": head[1], "x2": tip[0], "y2": tip[1],
           "application": application, "tensile_capacity": t, "direction": "axial",
           "end1_capacity": 0.0, "end2_capacity": 0.0, "spacing": 1.0})
}

/// V047a with a search, version 0.4 and the given reinforcements.
fn search_doc(
    reinforcements: Vec<Value>,
    entry: Option<[f64; 2]>,
    exit: Option<[f64; 2]>,
    method: &str,
    n: [usize; 3],
) -> Value {
    let mut doc = f3_common::v047a(json!([method]));
    doc["version"] = json!("0.4");
    doc["reinforcements"] = json!(reinforcements);
    let mut search = json!({"type": "circular_entry_exit", "n_entry": n[0], "n_exit": n[1],
        "n_radius": n[2], "max_radius_factor": 5.0, "min_width": null, "refine": true});
    if let Some(e) = entry {
        search["entry"] = json!(e);
    }
    if let Some(x) = exit {
        search["exit"] = json!(x);
    }
    doc["analysis"].as_object_mut().unwrap().remove("surface");
    doc["analysis"]["search"] = search;
    doc
}

fn gap(found: f64, reference: f64) -> f64 {
    found / reference - 1.0
}

/// R11A-07, counterexample 1: two passive anchors. Base: 1.684177 against 1.571733 of the fine grid (+7.15 %).
#[test]
fn two_passive_anchors_stay_within_one_percent_of_the_fine_grid() {
    let reinforcements = vec![
        anchor("A1", [31.0, 25.5], [56.0, 25.5], 400.0, "passive"),
        anchor("A2", [40.0, 30.0], [65.0, 30.0], 400.0, "passive"),
    ];
    let doc = search_doc(
        reinforcements,
        Some([42.0, 68.0]),
        Some([22.0, 38.0]),
        "bishop",
        [20; 3],
    );
    let found = fos(&doc, 0);
    assert!(
        gap(found, 1.571_733_332) < GAP,
        "FS {found} against 1.571733 of the fine grid: {:+.3} %",
        100.0 * gap(found, 1.571_733_332)
    );
}

/// R11A-07, counterexample 2: an active anchor. Base: 0.962132 against 0.942722 (+2.06 %).
#[test]
fn active_anchor_stays_within_one_percent_of_the_fine_grid() {
    let reinforcements = vec![anchor("A1", [33.0, 26.5], [48.0, 26.5], 300.0, "active")];
    let doc = search_doc(
        reinforcements,
        Some([45.0, 65.0]),
        Some([22.0, 35.0]),
        "bishop",
        [20; 3],
    );
    let found = fos(&doc, 0);
    assert!(
        gap(found, 0.942_722_132) < GAP,
        "FS {found} against 0.942722 of the fine grid: {:+.3} %",
        100.0 * gap(found, 0.942_722_132)
    );
}

/// Two active anchors, one of them with its tip on the critical circle (found by a random sweep, seed 22).
/// Base: 1.222402 against 1.093434 (+11.8 %), with two crossings of the same anchor that cancel each other.
#[test]
fn active_anchor_tip_crossing_is_found() {
    let reinforcements = vec![
        anchor("R1", [41.65, 30.82], [62.41, 31.94], 200.0, "active"),
        anchor("R2", [35.12, 24.63], [51.34, 19.41], 600.0, "active"),
    ];
    let doc = search_doc(reinforcements, Some([42.0, 68.0]), None, "spencer", [20; 3]);
    let found = fos(&doc, 0);
    assert!(gap(found, 1.093_434_079) < GAP, "FS {found}");
}

fn case_model(name: &str) -> Value {
    let path = format!(
        "{}/../../verification/cases/{name}.json",
        env!("CARGO_MANIFEST_DIR")
    );
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path}: {e}"));
    let case: Value = serde_json::from_str(&text).unwrap();
    case["model"].clone()
}

/// V037 (a published search case with five geosynthetics): the default search matches the fine grid.
#[test]
fn v037_default_search_matches_the_fine_grid() {
    for (method, reference) in [("bishop", 1.613_485_828), ("spencer", 1.607_871_806)] {
        let mut doc = case_model("V037");
        doc["analysis"]["methods"] = json!([method]);
        let found = fos(&doc, 0);
        assert!(gap(found, reference) < GAP, "{method}: FS {found}");
        assert!(gap(found, reference) > -GAP, "{method}: FS {found}");
    }
}

/// V084a (seven passive nails in a 7 m cut), searched with a circle around its plane.
#[test]
fn v084a_circular_search_matches_the_fine_grid() {
    let mut doc = case_model("V084a");
    doc["analysis"].as_object_mut().unwrap().remove("surface");
    doc["analysis"]["methods"] = json!(["bishop"]);
    doc["analysis"]["search"] = json!({"type": "circular_entry_exit", "n_entry": 20, "n_exit": 20,
        "n_radius": 20, "max_radius_factor": 5.0, "min_width": null, "refine": true,
        "entry": [5.148115, 8.448985], "exit": [10.649565, 13.950435]});
    let found = fos(&doc, 0);
    assert!((gap(found, 0.921_642_076)).abs() < GAP, "FS {found}");
}

/// Without reinforcements the search is the one of the base commit: same FS to the last digit, same counters.
#[test]
fn without_reinforcements_the_search_is_identical_to_the_base() {
    let doc = {
        let mut d = search_doc(vec![], None, None, "bishop", [20; 3]);
        d["version"] = json!("0.3");
        d.as_object_mut().unwrap().remove("reinforcements");
        d
    };
    let report = f3_common::run(&doc);
    let r = &report.results[0];
    assert_eq!(r.fos, Some(0.985_123_361_923_289_8));
    let stats = r.search.expect("search counters");
    assert_eq!((stats.evaluated, stats.valid), (8543, 6440));
    // The same model with an empty `reinforcements` list takes the same path.
    let mut with_empty = doc.clone();
    with_empty["version"] = json!("0.4");
    with_empty["reinforcements"] = json!([]);
    let r2 = &f3_common::run(&with_empty).results[0];
    assert_eq!(r2.fos, r.fos);
    assert_eq!(r2.search, r.search);
}

// ------------------------------------------------------------------------------------------ unit level

/// Slope 2:1 (H = 10) on the left, flat on the right; the mass moves to +x.
struct Profile;

impl Ground for Profile {
    fn y_top(&self, x: f64) -> Option<f64> {
        let v = [(-20.0, 10.0), (0.0, 10.0), (20.0, 0.0), (60.0, 0.0)];
        v.windows(2).find_map(|w| {
            let ((xa, ya), (xb, yb)) = (w[0], w[1]);
            (x >= xa && x <= xb).then(|| ya + (yb - ya) * (x - xa) / (xb - xa))
        })
    }
    fn x_range(&self) -> (f64, f64) {
        (-20.0, 60.0)
    }
    fn sliding(&self) -> Sliding {
        Sliding::LeftToRight
    }
}

fn spec() -> SearchSpec {
    SearchSpec {
        entry: None,
        exit: None,
        n_entry: 10,
        n_exit: 10,
        n_radius: 10,
        max_radius_factor: 5.0,
        min_width: None,
        refine: true,
        non_circular: None,
    }
}

fn bowl(c: &Circle) -> Option<f64> {
    Some(1.0 + ((c.xc - 40.0) / 10.0).powi(2) + ((c.yc - 45.0) / 10.0).powi(2))
}

/// With no element ends, `search_circular_reinforced` is `search_circular`.
#[test]
fn reinforced_search_without_ends_is_the_plain_search() {
    let plain = search_circular(&Profile, &spec(), bowl);
    let reinforced =
        search_circular_reinforced(&Profile, &spec(), &[], |c| bowl(c).map(|f| (f, 7)));
    assert_eq!(plain, reinforced);
}

/// The extra candidates are circles through the points `end ± 1e-4·width·u`, on both sides of each end.
#[test]
fn candidates_pass_through_both_sides_of_each_end() {
    let end = ElementEnd {
        x: 30.0,
        y: 2.0,
        ux: 1.0,
        uy: 0.0,
    };
    let offset = 1e-4 * 80.0;
    let circles = std::sync::Mutex::new(Vec::<Circle>::new());
    search_circular_reinforced(&Profile, &spec(), &[end], |c| {
        circles.lock().unwrap().push(*c);
        bowl(c).map(|f| (f, 0))
    });
    let circles = circles.into_inner().unwrap();
    for sign in [1.0_f64, -1.0] {
        let p = (
            end.x + sign * offset * end.ux,
            end.y + sign * offset * end.uy,
        );
        let through = circles
            .iter()
            .filter(|c| ((p.0 - c.xc).hypot(p.1 - c.yc) - c.r).abs() < 1e-9 * c.r.max(1.0))
            .count();
        assert!(through >= 50, "only {through} circles through {p:?}");
    }
}

/// The class of a candidate seeds the refinement: a class that the best seeds do not cover gets its own refinement
/// (more evaluations than when every candidate has the same class), and the result is never worse.
#[test]
fn rare_classes_get_their_own_seeds() {
    let fs = |c: &Circle| 1.0 + ((c.xc - 40.0) / 10.0).powi(2) + ((c.yc - 45.0) / 10.0).powi(2);
    let end = ElementEnd {
        x: 5.0,
        y: 8.0,
        ux: 1.0,
        uy: 0.0,
    };
    let uniform = search_circular_reinforced(&Profile, &spec(), &[end], |c| Some((fs(c), 0)));
    // Candidates with a small radius are a class of their own; the best of them is far from the best 20.
    let mixed = search_circular_reinforced(&Profile, &spec(), &[end], |c| {
        Some((fs(c), u32::from(c.r < 15.0) + 2 * u32::from(c.r > 60.0)))
    });
    assert!(
        mixed.stats.evaluated > uniform.stats.evaluated,
        "classes add seeds: {} against {}",
        mixed.stats.evaluated,
        uniform.stats.evaluated
    );
    assert!(mixed.best.unwrap().1 <= uniform.best.unwrap().1);
}
