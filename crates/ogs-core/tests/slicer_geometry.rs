//! Geometry and slicing tests (brief W1a, contract §1, §4.1 and amendment E1).

use ogs_core::OgsError;
use ogs_core::geometry::{Ground, PreparedModel, Sliding};
use ogs_core::model::{Circle, Model};
use ogs_core::slicer::{Slice, SurfaceError, slice_circle};

const SOIL: &str = r#"{"id":"soil","name":"Soil","model":"mohr_coulomb","unit_weight":20.0,"cohesion":3.0,"friction_angle":19.6}"#;
const TOP: &str = r#"{"id":"top","name":"Top","model":"mohr_coulomb","unit_weight":18.0,"cohesion":10.0,"friction_angle":30.0}"#;
const ACADS_POLY: &str = "[[20,20],[20,25],[30,25],[50,35],[70,35],[70,20]]";
const ACADS_POLY_MIRROR: &str = "[[-20,20],[-20,25],[-30,25],[-50,35],[-70,35],[-70,20]]";
const CIRCLE: Circle = Circle {
    xc: 36.0,
    yc: 60.0,
    r: 35.5,
};

fn region(material: &str, poly: &str) -> String {
    format!(r#"{{"material":"{material}","polygon":{poly}}}"#)
}

/// Builds a `.ogs.json` document. `water` is either empty or a full `"water":{...},` member.
fn doc(materials: &str, regions: &str, water: &str, direction: &str, analysis: &str) -> String {
    format!(
        r#"{{"format":"opengeoslide","version":"0.1","materials":[{materials}],"regions":[{regions}],{water}"slope":{{"direction":"{direction}"}},"analysis":{analysis}}}"#
    )
}

fn circle_json(c: Circle) -> String {
    format!(
        r#"{{"type":"circle","xc":{},"yc":{},"r":{}}}"#,
        c.xc, c.yc, c.r
    )
}

fn acads(direction: &str, surface: &str) -> String {
    doc(
        SOIL,
        &region("soil", ACADS_POLY),
        "",
        direction,
        &format!(r#"{{"surface":{surface}}}"#),
    )
}

fn prepare(json: &str) -> Result<PreparedModel, OgsError> {
    let model: Model = serde_json::from_str(json).expect("test JSON must parse");
    PreparedModel::new(&model)
}

fn prepared(json: &str) -> PreparedModel {
    prepare(json).expect("model must be valid")
}

fn slices_of(pm: &PreparedModel, c: &Circle, n: usize) -> Vec<Slice> {
    slice_circle(pm, c, n).expect("circle must slice")
}

fn rel_close(a: f64, b: f64, rel: f64) -> bool {
    (a - b).abs() <= rel * a.abs().max(b.abs()).max(1e-300)
}

#[test]
fn envelopes_of_acads_1a() {
    let pm = prepared(&acads(r#"auto"#, "null"));
    assert_eq!(pm.y_top(25.0), Some(25.0));
    assert_eq!(pm.y_top(40.0), Some(30.0));
    assert_eq!(pm.y_top(60.0), Some(35.0));
    assert_eq!(pm.y_top(10.0), None);
    // Shared vertex and vertical edges.
    assert_eq!(pm.y_top(30.0), Some(25.0));
    assert_eq!(pm.y_top(20.0), Some(25.0));
    assert_eq!(pm.y_top(70.0), Some(35.0));
    assert_eq!(pm.y_bottom(25.0), Some(20.0));
    assert_eq!(pm.y_bottom(20.0), Some(20.0));
    assert_eq!(pm.y_bottom(10.0), None);
    assert_eq!(pm.x_range(), (20.0, 70.0));
}

#[test]
fn sliding_direction_rules() {
    assert_eq!(
        prepared(&acads("auto", "null")).sliding(),
        Sliding::RightToLeft
    );
    let mirror = doc(
        SOIL,
        &region("soil", ACADS_POLY_MIRROR),
        "",
        "auto",
        r#"{"surface":null}"#,
    );
    assert_eq!(prepared(&mirror).sliding(), Sliding::LeftToRight);
    // Explicit overrides always win.
    assert_eq!(
        prepared(&acads("left_to_right", "null")).sliding(),
        Sliding::LeftToRight
    );
    assert_eq!(
        prepared(&acads("right_to_left", "null")).sliding(),
        Sliding::RightToLeft
    );
}

/// Symmetric dam: both crests at elevation 20 (contract §1, E1 steps 1 and 4).
fn dam(direction: &str, analysis: &str) -> String {
    doc(
        SOIL,
        &region("soil", "[[0,10],[0,20],[20,40],[40,20],[40,10]]"),
        "",
        direction,
        analysis,
    )
}

#[test]
fn symmetric_model_takes_direction_from_search_ranges() {
    let entry_right = dam(
        "auto",
        r#"{"search":{"type":"circular_entry_exit","entry":[25,35],"exit":[5,15]}}"#,
    );
    assert_eq!(
        prepared(&entry_right).sliding(),
        Sliding::RightToLeft,
        "entry on the right of the exit moves the mass to -x"
    );
    let entry_left = dam(
        "auto",
        r#"{"search":{"type":"circular_entry_exit","entry":[5,15],"exit":[25,35]}}"#,
    );
    assert_eq!(prepared(&entry_left).sliding(), Sliding::LeftToRight);
}

#[test]
fn symmetric_model_without_ranges_or_surface_is_invalid() {
    let no_ranges = dam("auto", r#"{"search":{"type":"circular_entry_exit"}}"#);
    assert!(matches!(
        prepare(&no_ranges),
        Err(OgsError::InvalidModel(_))
    ));
    let nothing = dam("auto", "{}");
    assert!(matches!(prepare(&nothing), Err(OgsError::InvalidModel(_))));
    // An explicit direction always resolves it.
    let explicit = dam("left_to_right", "{}");
    assert_eq!(prepared(&explicit).sliding(), Sliding::LeftToRight);
}

#[test]
fn area_converges_to_exact_arc_terrain_integral() {
    let pm = prepared(&acads("auto", &circle_json(CIRCLE)));
    let slices = slices_of(&pm, &CIRCLE, 2000);
    let sum_w_over_gamma: f64 = slices.iter().map(|s| s.weight / 20.0).sum();
    let x0 = slices
        .iter()
        .map(|s| s.x_left)
        .fold(f64::INFINITY, f64::min);
    let x1 = slices
        .iter()
        .map(|s| s.x_right)
        .fold(f64::NEG_INFINITY, f64::max);

    // Independent midpoint integration of (terrain − arc), terrain written out by hand.
    let terrain = |x: f64| {
        if x < 30.0 {
            25.0
        } else if x <= 50.0 {
            25.0 + (x - 30.0) / 2.0
        } else {
            35.0
        }
    };
    let arc = |x: f64| CIRCLE.yc - (CIRCLE.r * CIRCLE.r - (x - CIRCLE.xc).powi(2)).sqrt();
    let strips = 200_000;
    let h = (x1 - x0) / strips as f64;
    let exact: f64 = (0..strips)
        .map(|i| {
            let x = x0 + (i as f64 + 0.5) * h;
            terrain(x) - arc(x)
        })
        .sum::<f64>()
        * h;
    let rel = (sum_w_over_gamma - exact).abs() / exact;
    assert!(
        rel < 1e-4,
        "sum W/γ = {sum_w_over_gamma}, exact = {exact}, rel = {rel}"
    );
}

#[test]
fn two_layers_put_a_slice_boundary_at_the_interface_crossing() {
    // Lower layer below y = 27, upper layer above it (they share the edge (34,27)-(70,27)).
    let lower = "[[20,20],[20,25],[30,25],[34,27],[70,27],[70,20]]";
    let upper = "[[34,27],[50,35],[70,35],[70,27]]";
    let json = doc(
        &format!("{SOIL},{TOP}"),
        &format!("{},{}", region("soil", lower), region("top", upper)),
        "",
        "auto",
        r#"{"surface":null}"#,
    );
    let pm = prepared(&json);
    let slices = slices_of(&pm, &CIRCLE, 50);
    // Arc (x - 36)^2 + (y - 60)^2 = r^2 meets y = 27 at x = 36 + sqrt(r^2 - 33^2).
    let xb = 36.0 + (CIRCLE.r * CIRCLE.r - (CIRCLE.yc - 27.0).powi(2)).sqrt();
    let pair = slices
        .windows(2)
        .find(|w| (w[0].x_right - xb).abs() < 1e-9 && (w[1].x_left - xb).abs() < 1e-9)
        .expect("a slice boundary must sit at the arc/interface crossing");
    assert_eq!(pair[0].material, 0, "base below the interface is soil");
    assert_eq!(pair[1].material, 1, "base above the interface is top");
}

#[test]
fn order_and_sign_for_both_orientations() {
    let pm = prepared(&acads("auto", &circle_json(CIRCLE)));
    let slices = slices_of(&pm, &CIRCLE, 50);
    let (first, last) = (slices[0], slices[slices.len() - 1]);
    assert!(first.x_left < last.x_left, "toe slice first (RightToLeft)");
    assert!(last.alpha > 0.0, "crest slice has positive alpha");
    assert!(
        first.y_base_left < last.y_base_right,
        "toe is lower than crest"
    );

    let mirror_circle = Circle {
        xc: -CIRCLE.xc,
        ..CIRCLE
    };
    let mirror = doc(
        SOIL,
        &region("soil", ACADS_POLY_MIRROR),
        "",
        "auto",
        &format!(r#"{{"surface":{}}}"#, circle_json(mirror_circle)),
    );
    let pm_m = prepared(&mirror);
    let slices_m = slices_of(&pm_m, &mirror_circle, 50);
    let (first_m, last_m) = (slices_m[0], slices_m[slices_m.len() - 1]);
    assert!(
        first_m.x_right > last_m.x_right,
        "toe slice first (LeftToRight)"
    );
    assert!(
        last_m.alpha > 0.0,
        "crest slice has positive alpha (mirror)"
    );
    assert!(first_m.y_base_right < last_m.y_base_left);
    for s in slices_m.iter().chain(slices.iter()) {
        assert!(s.x_left < s.x_right && s.width > 0.0);
    }
}

#[test]
fn mirror_model_gives_same_sums() {
    let pm = prepared(&acads("auto", &circle_json(CIRCLE)));
    let mirror_circle = Circle {
        xc: -CIRCLE.xc,
        ..CIRCLE
    };
    let mirror = doc(
        SOIL,
        &region("soil", ACADS_POLY_MIRROR),
        "",
        "auto",
        &format!(r#"{{"surface":{}}}"#, circle_json(mirror_circle)),
    );
    let pm_m = prepared(&mirror);
    let a = slices_of(&pm, &CIRCLE, 50);
    let b = slices_of(&pm_m, &mirror_circle, 50);
    let sums = |s: &[Slice]| {
        (
            s.iter().map(|x| x.weight).sum::<f64>(),
            s.iter().map(|x| x.weight * x.alpha.sin()).sum::<f64>(),
            s.iter().map(|x| x.cohesion * x.base_length).sum::<f64>(),
        )
    };
    let (wa, wsa, cla) = sums(&a);
    let (wb, wsb, clb) = sums(&b);
    assert!(rel_close(wa, wb, 1e-9), "ΣW {wa} vs {wb}");
    assert!(rel_close(wsa, wsb, 1e-9), "ΣW sinα {wsa} vs {wsb}");
    assert!(rel_close(cla, clb, 1e-9), "Σc·l {cla} vs {clb}");
}

#[test]
fn circle_far_from_slope_has_no_intersection() {
    let pm = prepared(&acads("auto", "null"));
    let far = Circle {
        xc: 200.0,
        yc: 200.0,
        r: 10.0,
    };
    assert_eq!(
        slice_circle(&pm, &far, 50).unwrap_err(),
        SurfaceError::NoIntersection
    );
}

#[test]
fn circle_cutting_the_base_is_outside_model() {
    let pm = prepared(&acads("auto", "null"));
    let deep = Circle {
        xc: 45.0,
        yc: 30.0,
        r: 20.0,
    };
    assert_eq!(
        slice_circle(&pm, &deep, 50).unwrap_err(),
        SurfaceError::OutsideModel
    );
}

#[test]
fn centre_under_crest_ground_is_upper_arc() {
    let pm = prepared(&acads("auto", "null"));
    // Both ends of the lower arc are under the ground; the upper arc does cross it.
    let c = Circle {
        xc: 50.0,
        yc: 30.0,
        r: 8.0,
    };
    assert_eq!(
        slice_circle(&pm, &c, 50).unwrap_err(),
        SurfaceError::UpperArc
    );
}

#[test]
fn arc_that_resurfaces_is_above_ground() {
    // Valley: the lower arc is under the ground at both slopes and in the air over the notch.
    let valley = doc(
        SOIL,
        &region(
            "soil",
            "[[0,10],[0,20],[10,20],[20,12],[30,20],[40,20],[40,10]]",
        ),
        "",
        "right_to_left",
        r#"{"surface":null}"#,
    );
    let pm = prepared(&valley);
    let c = Circle {
        xc: 20.0,
        yc: 60.0,
        r: 44.0,
    };
    assert_eq!(
        slice_circle(&pm, &c, 50).unwrap_err(),
        SurfaceError::AboveGround
    );
}

#[test]
fn horizontal_piezometric_gives_exact_pore_pressure() {
    let water = r#""water":{"unit_weight":9.81,"piezometric_line":[[0,30],[100,30]]},"#;
    let json = doc(
        SOIL,
        &region("soil", ACADS_POLY),
        water,
        "auto",
        r#"{"surface":null}"#,
    );
    let pm = prepared(&json);
    let slices = slices_of(&pm, &CIRCLE, 50);
    let mut wet = 0;
    for s in &slices {
        let ybm = 0.5 * (s.y_base_left + s.y_base_right);
        let expected = 9.81 * (30.0 - ybm).max(0.0);
        assert!(
            (s.pore_pressure - expected).abs() <= 1e-9 * (1.0 + expected),
            "u = {}, expected {expected}",
            s.pore_pressure
        );
        if expected > 0.0 {
            wet += 1;
        }
    }
    assert!(wet > 0, "some base must lie below the piezometric line");
}

#[test]
fn ru_gives_pore_pressure_proportional_to_vertical_stress() {
    let soil_ru = SOIL.replace(
        r#""friction_angle":19.6"#,
        r#""friction_angle":19.6,"ru":0.25"#,
    );
    let json = doc(
        &soil_ru,
        &region("soil", ACADS_POLY),
        "",
        "auto",
        r#"{"surface":null}"#,
    );
    let pm = prepared(&json);
    let slices = slices_of(&pm, &CIRCLE, 50);
    for s in &slices {
        let sigma_v = s.weight / s.width;
        assert!(
            (s.pore_pressure - 0.25 * sigma_v).abs() <= 1e-12 * (1.0 + sigma_v),
            "u = {}, expected {}",
            s.pore_pressure,
            0.25 * sigma_v
        );
    }
}

#[test]
fn saturated_weight_applies_only_below_piezometric_line() {
    let soil_sat = SOIL.replace(
        r#""unit_weight":20.0"#,
        r#""unit_weight":20.0,"unit_weight_sat":22.0"#,
    );
    let water = r#""water":{"unit_weight":9.81,"piezometric_line":[[0,30],[100,30]]},"#;
    let json = doc(
        &soil_sat,
        &region("soil", ACADS_POLY),
        water,
        "auto",
        r#"{"surface":null}"#,
    );
    let pm = prepared(&json);
    let slices = slices_of(&pm, &CIRCLE, 50);
    let mut saturated_seen = false;
    for s in &slices {
        let ybm = 0.5 * (s.y_base_left + s.y_base_right);
        let g = s.y_top_mid;
        // Manual column: 22 below the piezometric line (y = 30), 20 above it.
        let below = (g.min(30.0) - ybm).max(0.0);
        let above = (g - ybm.max(30.0)).max(0.0);
        let expected = s.width * (22.0 * below + 20.0 * above);
        assert!(
            (s.weight - expected).abs() <= 1e-9 * expected,
            "W = {}, expected {expected}",
            s.weight
        );
        if below > 0.0 {
            saturated_seen = true;
            assert!(
                s.weight > s.width * 20.0 * (g - ybm),
                "saturated part adds weight"
            );
        }
    }
    assert!(saturated_seen);
}

#[test]
fn invalid_models_are_rejected() {
    let no_regions = doc(SOIL, "", "", "auto", r#"{"surface":null}"#);
    assert!(matches!(
        prepare(&no_regions),
        Err(OgsError::InvalidModel(_))
    ));
    let bad_ru = SOIL.replace(
        r#""friction_angle":19.6"#,
        r#""friction_angle":19.6,"ru":1.0"#,
    );
    let json = doc(
        &bad_ru,
        &region("soil", ACADS_POLY),
        "",
        "auto",
        r#"{"surface":null}"#,
    );
    assert!(matches!(prepare(&json), Err(OgsError::InvalidModel(_))));
    let missing = doc(
        TOP,
        &region("soil", ACADS_POLY),
        "",
        "auto",
        r#"{"surface":null}"#,
    );
    assert!(matches!(prepare(&missing), Err(OgsError::InvalidModel(_))));
}

/// Performance check (not run by default): `cargo test -p ogs-core --test slicer_geometry -- --ignored --nocapture`.
#[test]
#[ignore]
fn perf_slice_circle_50_slices() {
    let pm = prepared(&acads("auto", &circle_json(CIRCLE)));
    let iterations = 20_000;
    let start = std::time::Instant::now();
    let mut checksum = 0.0;
    for _ in 0..iterations {
        let s = slice_circle(&pm, &CIRCLE, 50).expect("circle must slice");
        checksum += s[0].weight;
    }
    let per_call_us = start.elapsed().as_secs_f64() * 1e6 / iterations as f64;
    std::hint::black_box(checksum);
    println!("slice_circle (50 slices, ACADS 1(a)): {per_call_us:.2} µs per call");
}
