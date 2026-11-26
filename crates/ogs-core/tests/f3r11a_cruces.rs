//! R11 M-A (amendments E14o-1, E14o-4, E14o-5, E14o-8 and E14o-11, first point): crossings, capacity and notes.
//!
//! Every test is the counterexample of the reviewer (`docs/reviews/R11_agy_A.md`, R11A-01, R11A-04, R11A-05, R11A-08
//! and R11A-11) and was RED on the base `3aa3369` before the change.
//!
//! The numbers quoted in the comments are real outputs of `target/release/ogs` on the base `3aa3369` ("base") and on
//! the corrected engine ("now"), and of `cslope` 0.1.0 through `verification/harness/to_cslope.py` where it applies.

mod f3_common;

use f3_common::*;
use ogs_core::model::Model;
use ogs_core::report::{AnalysisReport, ForceStatus, ReinforcementForce};
use serde_json::{Value, json};

const XC: f64 = CIRCLE.0;
const YC: f64 = CIRCLE.1;

fn report(doc: &Value) -> AnalysisReport {
    let model: Model = serde_json::from_value(doc.clone())
        .unwrap_or_else(|e| panic!("the document does not parse: {e}\n{doc}"));
    ogs_core::analyze(&model).unwrap_or_else(|e| panic!("analysis failed: {e}\n{doc}"))
}

fn forces(doc: &Value) -> Vec<ReinforcementForce> {
    report(doc).results[0].reinforcement_forces.clone()
}

fn warnings(doc: &Value) -> Vec<String> {
    report(doc).results[0].warnings.clone()
}

/// V047a, version 0.4, fixed circle `(xc, yc, r)`, one method.
fn v047a_circle(method: &str, circle: (f64, f64, f64)) -> Value {
    let mut doc = v047a(json!([method]));
    doc["version"] = json!("0.4");
    doc["analysis"]["surface"] =
        json!({"type": "circle", "xc": circle.0, "yc": circle.1, "r": circle.2});
    doc
}

fn with(mut doc: Value, reinforcements: Value) -> Value {
    doc["version"] = json!("0.4");
    doc["reinforcements"] = reinforcements;
    doc
}

fn anchor(id: &str, head: [f64; 2], tip: [f64; 2], application: &str, capacity: f64) -> Value {
    json!({"type": "anchor", "id": id, "x1": head[0], "y1": head[1], "x2": tip[0], "y2": tip[1],
        "application": application, "tensile_capacity": capacity, "direction": "axial"})
}

// ---------------------------------------------------------------------------------------------- E14o-1: tangency

/// The point `p` of the circle of F3.8 where the anchor touches it, and the unit tangent there (toward `+x`).
fn tangent_at(p: [f64; 2]) -> ([f64; 2], f64) {
    let big_r = (p[0] - XC).hypot(p[1] - YC);
    let (rx, ry) = ((p[0] - XC) / big_r, (p[1] - YC) / big_r);
    let t = if -ry > 0.0 { [-ry, rx] } else { [ry, -rx] };
    (t, big_r)
}

/// R11A-01, first part. V047a, the anchor `T = 100` tangent to the circle at `(40, 26.973391)`, with the circle
/// grown by `-eps` (so `eps < 0` penetrates by `|eps|`). Base, Bishop active (`unreinforced = 0.985123`):
/// `eps = 0` → one crossing, `fx = -93.1`, FS 0.7777 (−21 %); `eps = -1e-12` → two crossings of the same sense, FS 2.0768
/// (+111 %); passive: 1.5129 (+54 %). `eps = -1e-6` → passive 1.2498 (+27 %).
/// Now: the four cases give the slope without reinforcement, with no force.
#[test]
fn tangent_anchor_applies_no_force_active_and_passive() {
    let p = [40.0, 26.973391];
    let (t, big_r) = tangent_at(p);
    for application in ["active", "passive"] {
        for eps in [1e-12, 0.0, -1e-12, -1e-6] {
            let circle = (XC, YC, big_r - eps);
            let none = v047a_circle("bishop", circle);
            let reinforced = with(
                none.clone(),
                json!([anchor(
                    "A1",
                    [p[0] + 5.0 * t[0], p[1] + 5.0 * t[1]],
                    [p[0] - 5.0 * t[0], p[1] - 5.0 * t[1]],
                    application,
                    100.0
                )]),
            );
            let (fs_none, fs_with) = (fos(&none, 0), fos(&reinforced, 0));
            assert_eq!(
                fs_with.to_bits(),
                fs_none.to_bits(),
                "{application}, eps {eps:e}: FS {fs_with} against {fs_none} without the anchor"
            );
            let applied = forces(&reinforced)
                .iter()
                .filter(|f| f.status == ForceStatus::Applied)
                .count();
            assert_eq!(
                applied, 0,
                "{application}, eps {eps:e}: a ghost force was applied"
            );
        }
    }
}

/// R11A-01, second part: `V047a_1anchor`. Circle `yc = 46.5795`, `xc = 36.55`, the horizontal active anchor
/// `(36, 28)-(52, 28)`, `T = 100`, with the bottom of the circle at `y = 28 + off`. Base: `off = 1e-6` → 1.061914 (no crossing), `off = 0` →
/// **2.18082**, `off = -1e-12` → **25.52327** (two forces `+100`). Now: the three give 1.061914, continuous.
#[test]
fn grazing_horizontal_anchor_is_continuous() {
    let yc = 46.5795;
    let fs_at = |off: f64| {
        let mut doc = v047a_circle("bishop", (36.55, yc, yc - 28.0 - off));
        doc = with(
            doc,
            json!([anchor("A1", [36.0, 28.0], [52.0, 28.0], "active", 100.0)]),
        );
        fos(&doc, 0)
    };
    let reference = fs_at(1e-6);
    for off in [0.0, -1e-12, -1e-9] {
        let got = fs_at(off);
        assert!(
            (got - reference).abs() < 1e-6,
            "off {off:e}: FS {got} against {reference} (the anchor does not penetrate the mass)"
        );
    }
}

/// E14o-1: with a real penetration the pair of crossings is kept and `n`, `m` are the exact ones **at the point**,
/// not the `alpha` of the thin slice. `tangent` direction: `u = −m = (cos α, sin α)` on the right branch of
/// V047a (`right_to_left`, base rising toward +x), with `α = atan((x − xc)/(yc − y))`. Base: the `alpha` of the
/// thin slice (width 1e-4) differs by ~1e-6 rad, so `fx` differed by 1e-4 kN/m.
#[test]
fn crossing_direction_uses_the_normal_at_the_point() {
    let mut doc = v047a_circle("bishop", CIRCLE);
    let mut a = anchor("A1", [52.0, 28.0], [25.0, 28.0], "active", 100.0);
    a["direction"] = json!("tangent");
    doc = with(doc, json!([a]));
    let f = forces(&doc);
    let f = f
        .iter()
        .find(|f| f.status == ForceStatus::Applied)
        .expect("one applied crossing");
    let alpha = (f.x - XC).atan2(YC - f.y);
    let (want_x, want_y) = (100.0 * alpha.cos(), 100.0 * alpha.sin());
    assert!((f.fx - want_x).abs() < 1e-9, "fx {} against {want_x}", f.fx);
    assert!((f.fy - want_y).abs() < 1e-9, "fy {} against {want_y}", f.fy);
}

/// E14o-1, polyline: an element that touches a vertex without crossing the surface does not count. The chord polyline
/// of F3.8 has the vertex `(40, 26.973391)`, with segments of slope 0.2905 and 0.5103; a line of slope 0.4 through
/// it has both neighbours above it. Base: one crossing, `applied`, FS 1.0233 against 0.9841 (Spencer). Now: no crossing.
#[test]
fn polyline_vertex_touch_is_not_a_crossing() {
    let mut none = v047a(json!(["spencer"]));
    none["version"] = json!("0.4");
    set_polyline(&mut none, &POLYLINE);
    let head = [36.0, 26.973391 - 4.0 * 0.4];
    let tip = [44.0, 26.973391 + 4.0 * 0.4];
    for application in ["active", "passive"] {
        let reinforced = with(
            none.clone(),
            json!([anchor("A1", head, tip, application, 100.0)]),
        );
        let (a, b) = (fos(&none, 0), fos(&reinforced, 0));
        assert_eq!(
            a.to_bits(),
            b.to_bits(),
            "{application}: FS {b} against {a}"
        );
        assert!(
            forces(&reinforced).is_empty(),
            "{application}: a crossing was reported"
        );
    }
}

/// A real crossing of the polyline through a vertex still counts, once (the line of slope 0.2 through the same vertex
/// has the neighbours on both sides).
#[test]
fn polyline_vertex_crossing_counts_once() {
    let mut none = v047a(json!(["spencer"]));
    none["version"] = json!("0.4");
    set_polyline(&mut none, &POLYLINE);
    let head = [36.0, 26.973391 - 4.0 * 0.4];
    let tip = [44.0, 26.973391 + 4.0 * 0.4];
    // slope 0.4 is between 0.2905 and 0.5103 (touch); a slope outside them crosses.
    let (head, tip) = (
        [head[0], 26.973391 - 4.0 * 0.15],
        [tip[0], 26.973391 + 4.0 * 0.15],
    );
    let reinforced = with(none, json!([anchor("A1", head, tip, "active", 100.0)]));
    let f = forces(&reinforced);
    assert_eq!(f.len(), 1, "{f:?}");
    assert_eq!(f[0].status, ForceStatus::Applied);
}

// ---------------------------------------------------------------------------------- E14o-11: no node, no change

/// R11A-11, first point. No node for a crossing that applies nothing, so the FS is the one of the slope without
/// reinforcement **to the last bit**: `sheet_pile` with `force = 0` (base: 53 slices against 51, ΔFS −4.8e-7 in
/// Bishop), a nail with `tensile_capacity = 0`, a passive anchor that the sliding compresses (`compression_ignored`),
/// and an anchor whose crossing is over the ground (`INC_UP30_ACT` of the oracle file: base ΔFS 4e-5).
#[test]
fn no_node_without_capacity_compression_or_over_the_ground() {
    let cases: Vec<(&str, Value)> = vec![
        (
            "sheet_pile force 0",
            json!([{"type": "sheet_pile", "id": "S1", "x1": 40, "y1": 33, "x2": 40, "y2": 22,
                "application": "active", "force": 0, "direction": "angle", "angle": 0}]),
        ),
        (
            "nail tensile_capacity 0",
            json!([anchor("N1", [52.0, 28.0], [25.0, 28.0], "active", 0.0)]),
        ),
        (
            "passive compressed",
            json!([anchor("A1", [36.0, 28.0], [28.0, 20.0], "passive", 100.0)]),
        ),
        (
            "crossing over the ground",
            json!([anchor(
                "A1",
                [36.0, 28.0],
                [59.382686, 41.5],
                "active",
                100.0
            )]),
        ),
    ];
    for method in ["bishop", "spencer", "janbu_corrected"] {
        let none = v047a_circle(method, CIRCLE);
        let fs_none = fos(&none, 0);
        for (label, reinforcements) in &cases {
            let doc = with(none.clone(), reinforcements.clone());
            let got = fos(&doc, 0);
            assert_eq!(
                got.to_bits(),
                fs_none.to_bits(),
                "{label}, {method}: FS {got} against {fs_none} without reinforcement"
            );
            let applied = forces(&doc)
                .iter()
                .filter(|f| f.status == ForceStatus::Applied)
                .count();
            assert_eq!(applied, 0, "{label}, {method}");
        }
    }
}

// ---------------------------------------------------------------------------------------------- E14o-8: the note

/// R11A-08. A passive anchor that the sliding compresses is ignored (`reinforcement_compression_ignored`); the same
/// anchor, active, is applied with its full force and the note `reinforcement_active_compression` says so. An active
/// anchor in tension, a pile and a passive one never raise it.
#[test]
fn active_compression_note() {
    let none = v047a_circle("bishop", CIRCLE);
    let compressed = |app: &str| {
        with(
            none.clone(),
            json!([anchor("A1", [36.0, 28.0], [28.0, 20.0], app, 100.0)]),
        )
    };

    let w = warnings(&compressed("active"));
    assert!(
        w.iter().any(|c| c == "reinforcement_active_compression"),
        "{w:?}"
    );
    let f = forces(&compressed("active"));
    assert_eq!(f[0].status, ForceStatus::Applied);

    let w = warnings(&compressed("passive"));
    assert!(
        w.iter().any(|c| c == "reinforcement_compression_ignored"),
        "{w:?}"
    );
    assert!(
        !w.iter().any(|c| c == "reinforcement_active_compression"),
        "{w:?}"
    );

    // Row 1 of F4.13: the horizontal active anchor works in tension at its crossing.
    let tension = with(
        none.clone(),
        json!([anchor("A1", [52.0, 28.0], [25.0, 28.0], "active", 100.0)]),
    );
    assert!(
        !warnings(&tension)
            .iter()
            .any(|c| c == "reinforcement_active_compression")
    );

    let pile = with(
        none,
        json!([{"type": "pile", "id": "P1", "x1": 40, "y1": 33, "x2": 40, "y2": 22, "application": "active",
            "force": 60, "direction": "angle", "spacing": 1.5, "angle": 0}]),
    );
    assert!(
        !warnings(&pile)
            .iter()
            .any(|c| c == "reinforcement_active_compression")
    );
}

/// The order of the notes (E6): outside, compression ignored, active compression, structural checks.
#[test]
fn active_compression_note_order() {
    let none = v047a_circle("bishop", CIRCLE);
    let doc = with(
        none,
        json!([
            anchor("A1", [36.0, 28.0], [28.0, 20.0], "active", 100.0),
            anchor("A2", [36.0, 28.0], [28.0, 20.0], "passive", 100.0),
            anchor("A3", [36.0, 28.0], [59.382686, 41.5], "passive", 100.0),
            {"type": "pile", "id": "P1", "x1": 40, "y1": 33, "x2": 40, "y2": 22, "application": "active",
             "force": 60, "direction": "angle", "spacing": 1.5, "angle": 0}
        ]),
    );
    let w = warnings(&doc);
    let pos = |code: &str| {
        w.iter()
            .position(|c| c == code)
            .unwrap_or_else(|| panic!("{code} in {w:?}"))
    };
    let order = [
        "reinforcement_compression_ignored",
        "reinforcement_active_compression",
        "structural_checks_not_covered",
    ];
    for pair in order.windows(2) {
        assert!(pos(pair[0]) < pos(pair[1]), "{w:?}");
    }
}

// ---------------------------------------------------------------------------- E14o-4 and E14o-5: interface stress

/// V047a with `ru = 0.3`, `piezometric_line y = 32` (over the ground on the slope: ground 31.15 at the crossing), and the geosynthetic `interface`
/// `a = 0`, `δ = 30°`, `Rc = 1`, `T = 1000`, horizontal at `y = 28`.
fn ru_interface(piezo: bool) -> Value {
    let mut doc = v047a_circle("bishop", CIRCLE);
    doc["materials"][0]["ru"] = json!(0.3);
    if piezo {
        doc["water"] = json!({"piezometric_line": [[20, 32], [70, 32]]});
    }
    with(
        doc,
        json!([{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28,
            "application": "passive", "tensile_capacity": 1000, "direction": "axial",
            "pullout": {"model": "interface", "adhesion": 0, "friction_angle": 30, "coverage": 1}}]),
    )
}

fn crossing_capacity(doc: &Value) -> f64 {
    forces(doc)
        .iter()
        .find(|f| f.status == ForceStatus::Applied)
        .expect("an applied crossing")
        .available
}

/// R11A-04. A material with `ru` takes no water from the piezometric line: the free water over the ground is not
/// added. Base: `available = 334.18` with the line and 161.01 without it (cSlope: 160.9983); FS 1.5549 against cSlope 1.1247
/// (reviewer's numbers; the capacity here is the same element). Now: both are the same number.
#[test]
fn interface_with_ru_ignores_the_piezometric_line() {
    let (with_line, without) = (
        crossing_capacity(&ru_interface(true)),
        crossing_capacity(&ru_interface(false)),
    );
    assert!(
        (with_line - without).abs() < 1e-9 * without,
        "{with_line} with the line, {without} without it"
    );
    let (a, b) = (fos(&ru_interface(true), 0), fos(&ru_interface(false), 0));
    assert!((a - b).abs() < 1e-12, "FS {a} against {b}");
}

/// A material without `ru` keeps using the piezometric line, and the free water over the ground counts (E14m-2): the
/// capacity with the line over the ground is bigger than the one with the line under the crossing.
#[test]
fn interface_without_ru_keeps_the_free_water() {
    let mut over = ru_interface(true);
    over["materials"][0]["ru"] = Value::Null;
    let mut under = over.clone();
    under["water"] = json!({"piezometric_line": [[20, 20], [70, 20]]});
    let (a, b) = (crossing_capacity(&over), crossing_capacity(&under));
    // σ′v = σ + γw·(z − top) − γw·(z − y) = σ − γw·(top − y): the water over the ground and under it cancel.
    assert!(a > 0.0 && b > 0.0);
    let dry = {
        let mut d = over.clone();
        d.as_object_mut().unwrap().remove("water");
        crossing_capacity(&d)
    };
    assert!(
        a < dry,
        "a line over the ground gives u = γw·(z − y) over the dry σ′v: {a} against dry {dry}"
    );
}

/// Two strata with a horizontal contact at `y = 28`: `bot` (`y ∈ [20, 28]`, `ru = 0.5`) and `top` (`ru = 0`), the
/// geosynthetic `interface` at `y = 28`. `top_first` swaps the order of `regions`.
fn contact_doc(top_first: bool) -> Value {
    let mut doc = v047a_circle("bishop", CIRCLE);
    doc["materials"] = json!([
        {"id": "bot", "name": "Bot", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6, "ru": 0.5},
        {"id": "top", "name": "Top", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6, "ru": 0.0}
    ]);
    let bot = json!({"material": "bot", "polygon": [[20, 20], [20, 25], [30, 25], [36, 28], [70, 28], [70, 20]]});
    let top = json!({"material": "top", "polygon": [[36, 28], [50, 35], [70, 35], [70, 28]]});
    doc["regions"] = if top_first {
        json!([top, bot])
    } else {
        json!([bot, top])
    };
    with(
        doc,
        json!([{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28,
            "application": "passive", "tensile_capacity": 1000, "direction": "axial",
            "pullout": {"model": "interface", "adhesion": 0, "friction_angle": 30, "coverage": 1}}]),
    )
}

/// R11A-05, horizontal contact. Base: `regions = [bot, top]` → `available = 115.0080`, `FS = 1.327842`;
/// `[top, bot]` → `230.0159`, `FS = 1.625803` (+22.4 %). Now: both take the smaller σ′v (`ru = 0.5`).
#[test]
fn interface_on_a_horizontal_contact_does_not_depend_on_the_order_of_regions() {
    let (a, b) = (contact_doc(false), contact_doc(true));
    let (ca, cb) = (crossing_capacity(&a), crossing_capacity(&b));
    assert!((ca - cb).abs() < 1e-9 * ca, "{ca} against {cb}");
    let (fa, fb) = (fos(&a, 0), fos(&b, 0));
    assert!((fa - fb).abs() < 1e-12, "FS {fa} against {fb}");
    // The minimum is the one of the material with `ru = 0.5`: half of the dry stress.
    let mut dry = contact_doc(false);
    dry["materials"][0]["ru"] = json!(0.0);
    let c_dry = crossing_capacity(&dry);
    assert!(
        (ca - 0.5 * c_dry).abs() < 1e-9 * c_dry,
        "{ca} against half of {c_dry}"
    );
}

/// A vertical contact at `x = 40` (`left: ru = 0.5`, `right: ru = 0`) and a vertical geosynthetic `interface` on it.
/// `mirror` reflects the whole model through `x → −x` (and the direction of the slope).
fn vertical_contact_doc(mirror: bool) -> Value {
    let mut doc = v047a_circle("bishop", CIRCLE);
    doc["materials"] = json!([
        {"id": "left", "name": "Left", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6, "ru": 0.5},
        {"id": "right", "name": "Right", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6, "ru": 0.0}
    ]);
    let left: Vec<[f64; 2]> = vec![
        [20.0, 20.0],
        [20.0, 25.0],
        [30.0, 25.0],
        [40.0, 30.0],
        [40.0, 20.0],
    ];
    let right: Vec<[f64; 2]> = vec![
        [40.0, 20.0],
        [40.0, 30.0],
        [50.0, 35.0],
        [70.0, 35.0],
        [70.0, 20.0],
    ];
    let flip = |pts: &[[f64; 2]]| -> Vec<[f64; 2]> {
        if mirror {
            pts.iter().rev().map(|p| [-p[0], p[1]]).collect()
        } else {
            pts.to_vec()
        }
    };
    doc["regions"] = json!([
        {"material": "left", "polygon": flip(&left)},
        {"material": "right", "polygon": flip(&right)}
    ]);
    let sx = if mirror { -1.0 } else { 1.0 };
    if mirror {
        doc["slope"] = json!({"direction": "left_to_right"});
        doc["analysis"]["surface"] = json!({"type": "circle", "xc": -XC, "yc": YC, "r": CIRCLE.2});
    }
    with(
        doc,
        json!([{"type": "geosynthetic", "id": "G1", "x1": sx * 40.0, "y1": 29.0, "x2": sx * 40.0, "y2": 21.0,
            "application": "active", "tensile_capacity": 1000, "direction": "axial",
            "pullout": {"model": "interface", "adhesion": 0, "friction_angle": 30, "coverage": 1}}]),
    )
}

/// R11A-05, vertical contact. Base: original `available = 105.7748`, FS 1.117566; mirror `52.8874`, FS 1.114022.
/// Now: both take the smaller side and the mirror gives the same number.
#[test]
fn interface_on_a_vertical_contact_is_mirror_invariant() {
    let (a, b) = (vertical_contact_doc(false), vertical_contact_doc(true));
    let (fa, fb) = (forces(&a), forces(&b));
    assert_eq!(fa.len(), fb.len(), "{fa:?} {fb:?}");
    for (p, q) in fa.iter().zip(&fb) {
        assert!(
            (p.available - q.available).abs() < 1e-9 * p.available.max(1.0),
            "{p:?} against {q:?}"
        );
    }
    let (sa, sb) = (fos(&a, 0), fos(&b, 0));
    assert!((sa - sb).abs() < 1e-9, "FS {sa} against {sb}");
}

// ------------------------------------------------------------------------------------ the exact normal, both signs

/// E14o-1, the sign of `alpha` at the crossing, on a polyline and in the mirror image. A `tangent` active anchor that
/// crosses the segment `(35; 25.520953)-(40; 26.973391)` (slope 0.290488) of the chord polyline of F3.8 gives
/// `u = −m = (cos α, sin α)`, `α = atan(slope)`, in `right_to_left`; the mirror model (`x → −x`, `left_to_right`) gives
/// `(−cos α, sin α)`, and the same FS.
#[test]
fn tangent_force_on_a_polyline_and_its_mirror() {
    let slope = (26.973391_f64 - 25.520953) / 5.0;
    let alpha = slope.atan();
    let build = |mirror: bool| {
        let mut doc = v047a(json!(["spencer"]));
        doc["version"] = json!("0.4");
        set_polyline(&mut doc, &POLYLINE);
        let mut a = anchor("A1", [44.0, 26.1], [33.0, 26.1], "active", 100.0);
        a["direction"] = json!("tangent");
        doc["reinforcements"] = json!([a]);
        if !mirror {
            return doc;
        }
        doc["slope"] = json!({"direction": "left_to_right"});
        doc["regions"][0]["polygon"] = json!([
            [-20, 20],
            [-20, 25],
            [-30, 25],
            [-50, 35],
            [-70, 35],
            [-70, 20]
        ]);
        let pts: Vec<[f64; 2]> = POLYLINE.iter().rev().map(|p| [-p[0], p[1]]).collect();
        set_polyline(&mut doc, &pts);
        doc["reinforcements"][0]["x1"] = json!(-44.0);
        doc["reinforcements"][0]["x2"] = json!(-33.0);
        doc
    };
    let (f, g) = (forces(&build(false)), forces(&build(true)));
    let (f, g) = (&f[0], &g[0]);
    assert_eq!(f.status, ForceStatus::Applied);
    assert!(
        (f.fx - 100.0 * alpha.cos()).abs() < 1e-9 && (f.fy - 100.0 * alpha.sin()).abs() < 1e-9,
        "{f:?}"
    );
    assert!(
        (g.fx + f.fx).abs() < 1e-9 && (g.fy - f.fy).abs() < 1e-9,
        "{g:?} against {f:?}"
    );
    let (a, b) = (fos(&build(false), 0), fos(&build(true), 0));
    assert!((a - b).abs() < 1e-9, "FS {a} against {b}");
}
