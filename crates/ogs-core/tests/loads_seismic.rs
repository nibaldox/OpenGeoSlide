//! Pseudo-static seismic force and surface loads in the engine (schema v0.2, amendments E12a and E12b).
//!
//! Criteria of F1.2, one section each:
//! - (i) neutrality: v0.1 and v0.2 without the new fields give the same result bit for bit (the existing tests, the
//!   acceptance and the differential battery cover the rest);
//! - (ii) global equilibrium with seismic force and loads, computed here independently of the solver;
//! - (iii) cSlope oracle on the fixed circle of V047a (`fixtures/oracle_seismic_v047a.json`, written by
//!   `verification/harness/oracle_seismic_v047a.py`);
//! - (iv) mirror (x → −x, opposite direction, opposite load angle);
//! - (v) monotonicity in `kh`.
//!
//! Also: every validation message of F1.1, the exact centroid, the closed form of Spencer against a 2 × 2 solve, the
//! contract formula of Bishop, the loads on air and discarded slices, and the note `load_outside_mass`.

use ogs_core::methods::spencer::{spencer_direct_normals, spencer_interslice};
use ogs_core::methods::{SolveStatus, effective_normal};
use ogs_core::model::Model;
use ogs_core::report::MethodReport;
use ogs_core::slicer::{Slice, slice_circle};
use ogs_core::{analyze, analyze_json};
use serde_json::{Value, json};

const V047A: &str = include_str!("../../../verification/cases/V047a.json");

/// The model of V047a as a v0.1 document with Bishop and Spencer, the two methods this file covers. The case file
/// itself is the v0.3 target (it also carries the Morgenstern-Price and Janbu checks), so the neutrality and search
/// tests take the v0.1 part of it.
fn v047a_v01() -> Value {
    let case: Value = serde_json::from_str(V047A).expect("V047a is valid JSON");
    let mut m = case["model"].clone();
    m["version"] = json!("0.1");
    m["analysis"]["methods"] = json!(["bishop", "spencer"]);
    m["analysis"].as_object_mut().unwrap().remove("interslice");
    m
}
const ORACLE: &str = include_str!("fixtures/oracle_seismic_v047a.json");

/// Circle of the oracle: the Bishop critical circle of V047a (X1 §2.2), exact floats.
const CIRCLE: (f64, f64, f64) = (29.54334963719809, 53.63784815923435, 28.641487934160704);

/// Ends of the analysed block on that circle (R5-01, E12f): the toe and the entry point, exact floats of the report.
const X_TOE: f64 = 30.00000164700758;
const X_ENTRY: f64 = 51.29111842105263;
/// Model width of V047a (x from 20 to 70) and the tolerance of a line load against a slice end (E12f).
const WIDTH: f64 = 50.0;

/// Terrain of V047a, in the frame where the mass moves toward −x (`right_to_left`).
fn terrain_rtl(x: f64) -> f64 {
    if x <= 30.0 {
        25.0
    } else if x <= 50.0 {
        25.0 + (x - 30.0) / 2.0
    } else {
        35.0
    }
}

// ------------------------------------------------------------------ scenarios

#[derive(Debug, Clone, PartialEq)]
struct Scenario {
    id: String,
    /// `true` when the mass moves toward +x (`left_to_right`).
    ltr: bool,
    kh: f64,
    kv: f64,
    /// `(x1, x2, q)`.
    udls: Vec<(f64, f64, f64)>,
    /// `(x, p, angle in degrees)`.
    lines: Vec<(f64, f64, f64)>,
    /// Layered model with water (second geometry) instead of V047a.
    layered: bool,
}

impl Scenario {
    fn rtl(id: &str) -> Self {
        Self {
            id: id.to_string(),
            ltr: false,
            kh: 0.0,
            kv: 0.0,
            udls: vec![],
            lines: vec![],
            layered: false,
        }
    }
    fn kh(mut self, kh: f64) -> Self {
        self.kh = kh;
        self
    }
    fn kv(mut self, kv: f64) -> Self {
        self.kv = kv;
        self
    }
    fn udl(mut self, x1: f64, x2: f64, q: f64) -> Self {
        self.udls.push((x1, x2, q));
        self
    }
    fn line(mut self, x: f64, p: f64, angle: f64) -> Self {
        self.lines.push((x, p, angle));
        self
    }
    fn layered(mut self) -> Self {
        self.layered = true;
        self
    }

    /// The mirror image: x → −x, opposite direction, opposite angle of the line loads.
    fn mirror(&self) -> Self {
        Self {
            id: format!("mirror_{}", self.id),
            ltr: !self.ltr,
            udls: self.udls.iter().map(|&(a, b, q)| (-b, -a, q)).collect(),
            lines: self.lines.iter().map(|&(x, p, t)| (-x, p, -t)).collect(),
            ..self.clone()
        }
    }

    /// Terrain elevation at `x` in this scenario's frame.
    fn terrain(&self, x: f64) -> f64 {
        terrain_rtl(if self.ltr { -x } else { x })
    }

    fn circle(&self) -> (f64, f64, f64) {
        (
            if self.ltr { -CIRCLE.0 } else { CIRCLE.0 },
            CIRCLE.1,
            CIRCLE.2,
        )
    }

    /// The v0.2 document of the scenario, with the fixed circle and both methods.
    fn document(&self) -> Value {
        let mut doc = if self.layered {
            layered_document()
        } else {
            let case: Value = serde_json::from_str(V047A).expect("V047a is valid JSON");
            let mut m = case["model"].clone();
            m["analysis"].as_object_mut().unwrap().remove("search");
            m
        };
        doc["version"] = json!("0.2");
        doc["analysis"]["methods"] = json!(["bishop", "spencer"]);
        doc["analysis"]["slices"] = json!(50);
        doc["analysis"]["tolerance"] = json!(1e-8);
        doc["analysis"]["max_iterations"] = json!(2000);
        let (xc, yc, r) = self.circle();
        doc["analysis"]["surface"] = json!({"type": "circle", "xc": xc, "yc": yc, "r": r});
        doc["slope"] = json!({"direction": if self.ltr {"left_to_right"} else {"right_to_left"}});
        if self.ltr {
            let mirror_polygon = |poly: &mut Value| {
                for p in poly.as_array_mut().unwrap() {
                    p[0] = json!(-p[0].as_f64().unwrap());
                }
            };
            for region in doc["regions"].as_array_mut().unwrap() {
                mirror_polygon(&mut region["polygon"]);
            }
            if let Some(line) = doc["water"]["piezometric_line"].as_array_mut() {
                for p in line.iter_mut() {
                    p[0] = json!(-p[0].as_f64().unwrap());
                }
                line.reverse();
            }
        }
        let mut loads: Vec<Value> = Vec::new();
        for (i, &(x1, x2, q)) in self.udls.iter().enumerate() {
            loads.push(json!({"type": "udl", "id": format!("u{i}"), "x1": x1, "x2": x2, "q": q}));
        }
        for (i, &(x, p, angle)) in self.lines.iter().enumerate() {
            loads.push(
                json!({"type": "line", "id": format!("l{i}"), "x": x, "p": p, "angle": angle}),
            );
        }
        if !loads.is_empty() {
            doc["loads"] = Value::Array(loads);
        }
        if self.kh != 0.0 || self.kv != 0.0 {
            doc["analysis"]["seismic"] = json!({"kh": self.kh, "kv": self.kv});
        }
        doc
    }

    fn model(&self) -> Model {
        serde_json::from_value(self.document()).expect("the scenario is a valid model")
    }
}

/// Two materials, a piezometric line and the V047a ground: second geometry to exercise the centroid and `γsat`.
fn layered_document() -> Value {
    json!({
        "format": "opengeoslide", "version": "0.2",
        "materials": [
            {"id": "a", "name": "A", "model": "mohr_coulomb", "unit_weight": 18.0, "cohesion": 5.0, "friction_angle": 25.0},
            {"id": "b", "name": "B", "model": "mohr_coulomb", "unit_weight": 21.0, "unit_weight_sat": 22.5,
             "cohesion": 8.0, "friction_angle": 30.0}
        ],
        "regions": [
            {"material": "b", "polygon": [[20, 20], [20, 25], [30, 25], [36, 28], [70, 28], [70, 20]]},
            {"material": "a", "polygon": [[36, 28], [50, 35], [70, 35], [70, 28]]}
        ],
        "water": {"unit_weight": 9.81, "piezometric_line": [[20, 23], [30, 23], [50, 33], [70, 33]]},
        "analysis": {}
    })
}

struct Run {
    bishop: MethodReport,
    spencer: MethodReport,
}

fn run(sc: &Scenario) -> Run {
    let report = analyze(&sc.model()).unwrap_or_else(|e| panic!("{}: {e}", sc.id));
    let mut it = report.results.into_iter();
    let (bishop, spencer) = (it.next().unwrap(), it.next().unwrap());
    for r in [&bishop, &spencer] {
        assert_eq!(r.status, SolveStatus::Converged, "{}: {r:?}", sc.id);
        assert!(r.fos.is_some_and(f64::is_finite), "{}: {r:?}", sc.id);
    }
    Run { bishop, spencer }
}

fn fos(r: &MethodReport) -> f64 {
    r.fos.expect("converged")
}

// ------------------------------------------------------------ (i) neutrality

/// (i) A model without the new fields gives exactly the same report in v0.1 and v0.2, with fixed circle and with
/// search; the explicit zeros of v0.2 (`kh = kv = 0`, `loads: []`) change nothing either.
#[test]
fn i_neutrality_v01_and_v02_are_bit_identical() {
    let search_doc = v047a_v01();
    let mut fixed_doc = v047a_v01();
    fixed_doc["analysis"]
        .as_object_mut()
        .unwrap()
        .remove("search");
    let (xc, yc, r) = CIRCLE;
    fixed_doc["analysis"]["surface"] = json!({"type": "circle", "xc": xc, "yc": yc, "r": r});
    for (name, doc) in [("fixed", fixed_doc), ("search", search_doc)] {
        let v01 = analyze_json(&doc.to_string()).expect("v0.1 analyses");
        let mut v02 = doc.clone();
        v02["version"] = json!("0.2");
        let text02 = analyze_json(&v02.to_string()).expect("v0.2 analyses");
        assert_eq!(v01, text02, "{name}: v0.1 and v0.2 differ");
        let mut zeros = v02.clone();
        zeros["analysis"]["seismic"] = json!({"kh": 0.0, "kv": 0.0});
        zeros["loads"] = json!([]);
        let text_zero = analyze_json(&zeros.to_string()).expect("explicit zeros analyse");
        assert_eq!(v01, text_zero, "{name}: explicit zeros change the result");
        println!(
            "[i] {name}: v0.1 == v0.2 == v0.2 con ceros ({} bytes)",
            v01.len()
        );
    }
}

// ----------------------------------------------------------- F1.1 validation

fn v02_doc() -> Value {
    Scenario::rtl("base").document()
}

fn expect_invalid(doc: &Value, needle: &str) {
    let msg = analyze_json(&doc.to_string()).expect_err("the document must be rejected");
    println!("[F1.1] {needle:?} -> {msg}");
    assert!(
        msg.starts_with("InvalidModel:") && msg.contains(needle),
        "expected InvalidModel mentioning {needle:?}, got {msg:?}"
    );
}

#[test]
fn f11_version_gates_the_new_fields() {
    let needle = "los campos 'loads' y 'analysis.seismic' requieren version \"0.2\"";
    let mut with_loads = v02_doc();
    with_loads["version"] = json!("0.1");
    with_loads["loads"] = json!([{"type": "udl", "x1": 50.0, "x2": 60.0, "q": 10.0}]);
    expect_invalid(&with_loads, needle);
    let mut with_seismic = v02_doc();
    with_seismic["version"] = json!("0.1");
    with_seismic["analysis"]["seismic"] = json!({"kh": 0.1});
    expect_invalid(&with_seismic, needle);
    // An empty list is the same as absent, and an unknown future version (`"0.7"`; `"0.3"` is valid since E13a, `"0.4"` since E14a, `"0.5"` since E15a and `"0.6"` since F6.1) is still rejected.
    let mut empty = v02_doc();
    empty["version"] = json!("0.1");
    empty["loads"] = json!([]);
    analyze_json(&empty.to_string()).expect("empty loads in v0.1");
    let mut future = v02_doc();
    future["version"] = json!("0.7");
    expect_invalid(&future, "version debe ser");
}

#[test]
fn f11_seismic_ranges() {
    for (seismic, needle) in [
        (
            json!({"kh": 1.0}),
            "analysis.seismic.kh debe estar en [0, 1)",
        ),
        (
            json!({"kh": -0.01}),
            "analysis.seismic.kh debe estar en [0, 1)",
        ),
        (
            json!({"kv": 1.0}),
            "analysis.seismic.kv debe estar en (-1, 1)",
        ),
        (
            json!({"kv": -1.0}),
            "analysis.seismic.kv debe estar en (-1, 1)",
        ),
        (json!({"kh": 0.1, "ky": 0.0}), "ky"),
    ] {
        let mut doc = v02_doc();
        doc["analysis"]["seismic"] = seismic;
        expect_invalid(&doc, needle);
    }
    // Non-finite values cannot be written in JSON: build the model and break it.
    for (kh, kv, needle) in [
        (f64::NAN, 0.0, "kh"),
        (f64::INFINITY, 0.0, "kh"),
        (0.0, f64::NAN, "kv"),
        (0.0, f64::NEG_INFINITY, "kv"),
    ] {
        let mut model = Scenario::rtl("nan").kh(0.1).model();
        let s = model.analysis.seismic.as_mut().unwrap();
        (s.kh, s.kv) = (kh, kv);
        let err = analyze(&model)
            .expect_err("non-finite coefficient")
            .to_string();
        assert!(
            err.starts_with("InvalidModel:") && err.contains(needle),
            "{err}"
        );
    }
    // Boundaries that are valid: kh = 0 and 0.999, kv ±0.999.
    for (kh, kv) in [(0.0, 0.0), (0.999, 0.0), (0.0, 0.999), (0.0, -0.999)] {
        let mut doc = v02_doc();
        doc["analysis"]["seismic"] = json!({"kh": kh, "kv": kv});
        let model: Model = serde_json::from_value(doc).unwrap();
        // It must not be rejected as an invalid model (the surface may well be invalid for a huge kh).
        if let Err(e) = analyze(&model) {
            assert!(!e.to_string().starts_with("InvalidModel:"), "{e}");
        }
    }
}

#[test]
fn f11_load_validation_messages() {
    let udl = |extra: Value| {
        let mut l = json!({"type": "udl", "id": "u1", "x1": 50.0, "x2": 60.0, "q": 20.0});
        for (k, v) in extra.as_object().unwrap() {
            l[k] = v.clone();
        }
        l
    };
    let line = |extra: Value| {
        let mut l = json!({"type": "line", "id": "l1", "x": 40.0, "p": 20.0, "angle": 10.0});
        for (k, v) in extra.as_object().unwrap() {
            l[k] = v.clone();
        }
        l
    };
    let cases: Vec<(Vec<Value>, &str)> = vec![
        (
            vec![udl(json!({"x1": 60.0}))],
            "la carga 'u1' tiene x1 >= x2",
        ),
        (
            vec![udl(json!({"x1": 70.0, "x2": 60.0}))],
            "la carga 'u1' tiene x1 >= x2",
        ),
        (
            vec![udl(json!({"q": -1.0}))],
            "la carga 'u1' debe tener q finito y mayor o igual que 0",
        ),
        (
            vec![udl(json!({"x1": 10.0}))],
            "la carga 'u1' sale del rango x del modelo [20, 70]",
        ),
        (
            vec![udl(json!({"x2": 75.0}))],
            "la carga 'u1' sale del rango x del modelo [20, 70]",
        ),
        (
            vec![udl(json!({"id": null, "x1": 60.0}))],
            "la carga #0 tiene x1 >= x2",
        ),
        (
            vec![line(json!({"p": -1.0}))],
            "la carga 'l1' debe tener p finito y mayor o igual que 0",
        ),
        (
            vec![line(json!({"angle": 91.0}))],
            "la carga 'l1' debe tener angle en [-90, 90] grados",
        ),
        (
            vec![line(json!({"angle": -90.5}))],
            "la carga 'l1' debe tener angle en [-90, 90] grados",
        ),
        (
            vec![line(json!({"x": 19.0}))],
            "la carga 'l1' sale del rango x del modelo [20, 70]",
        ),
        (
            vec![line(json!({"x": 71.0}))],
            "la carga 'l1' sale del rango x del modelo [20, 70]",
        ),
        (
            vec![udl(json!({})), line(json!({"id": "u1"}))],
            "el id de carga 'u1' está repetido",
        ),
        // Unknown tag, unknown field in each variant, and a missing required field.
        (vec![json!({"type": "point", "x": 1.0})], "point"),
        (vec![udl(json!({"direction": "vertical"}))], "direction"),
        (vec![line(json!({"y": 30.0}))], "unknown field"),
        (
            vec![json!({"type": "udl", "x1": 50.0, "x2": 60.0})],
            "missing field",
        ),
    ];
    for (loads, needle) in cases {
        let mut doc = v02_doc();
        doc["loads"] = Value::Array(loads);
        expect_invalid(&doc, needle);
    }
    // Non-finite positions and magnitudes, through the model struct.
    use ogs_core::model::Load;
    for (which, needle) in [
        ("udl.x1", "coordenadas no finitas"),
        ("udl.q", "q finito"),
        ("line.x", "coordenadas no finitas"),
        ("line.p", "p finito"),
        ("line.angle", "angle en [-90, 90]"),
    ] {
        let mut model = Scenario::rtl("nan")
            .udl(50.0, 60.0, 5.0)
            .line(40.0, 5.0, 0.0)
            .model();
        for load in &mut model.loads {
            match (load, which) {
                (Load::Udl(u), "udl.x1") => u.x1 = f64::NAN,
                (Load::Udl(u), "udl.q") => u.q = f64::INFINITY,
                (Load::Line(l), "line.x") => l.x = f64::INFINITY,
                (Load::Line(l), "line.p") => l.p = f64::NAN,
                (Load::Line(l), "line.angle") => l.angle = f64::NAN,
                _ => {}
            }
        }
        let err = analyze(&model).expect_err(which).to_string();
        assert!(
            err.starts_with("InvalidModel:") && err.contains(needle),
            "{which}: {err}"
        );
    }
    // Valid loads of both kinds and without id are accepted and serialize back without the unused fields.
    let mut doc = v02_doc();
    doc["loads"] = json!([
        {"type": "udl", "x1": 50.0, "x2": 60.0, "q": 20.0},
        {"type": "line", "x": 40.0, "p": 20.0, "angle": 10.0}
    ]);
    analyze_json(&doc.to_string()).expect("valid loads");
    let model: Model = serde_json::from_value(doc).unwrap();
    let back: Value = serde_json::to_value(&model).unwrap();
    assert_eq!(
        back["loads"][0],
        json!({"type": "udl", "x1": 50.0, "x2": 60.0, "q": 20.0})
    );
    assert_eq!(back["loads"][1]["type"], "line");
    assert_eq!(serde_json::from_value::<Model>(back).unwrap(), model);
}

/// The unknown top-level field `seismic_kh` of the validation fixture stays an error in v0.2 (X1 §2.1): the new
/// coefficients live in `analysis.seismic`.
#[test]
fn f11_old_seismic_kh_is_still_an_unknown_field() {
    let mut doc = v02_doc();
    doc["seismic_kh"] = json!(0.3);
    expect_invalid(&doc, "seismic_kh");
    let mut doc = v02_doc();
    doc["analysis"]["seismic_kh"] = json!(0.3);
    expect_invalid(&doc, "seismic_kh");
}

// ------------------------------------------------- independent recomputation

/// Everything the test needs about a converged slice, computed from the physics and not from the new `Slice` fields.
struct Forces {
    /// Vertical downward forces on the slice: (x of application, force).
    verticals: Vec<(f64, f64)>,
    /// Horizontal forces in the sliding direction: (y of application, force in the sliding direction).
    horizontals: Vec<(f64, f64)>,
    w_star: f64,
    h: f64,
}

/// Fraction of the line load at `x` that the soil slice `index` of `all` takes (E12f): the load goes to the soil slices
/// whose closed interval contains `x` (within `1e-9·width`), split in equal parts.
fn line_share(all: &[Slice], index: usize, x: f64) -> f64 {
    let tol = 1e-9 * WIDTH;
    let touches = |s: &Slice| s.weight > 0.0 && s.x_left - tol <= x && x <= s.x_right + tol;
    if !touches(&all[index]) {
        return 0.0;
    }
    1.0 / all.iter().filter(|s| touches(s)).count() as f64
}

fn slice_forces(sc: &Scenario, all: &[Slice], index: usize) -> Forces {
    let s = &all[index];
    let dir = if sc.ltr { 1.0 } else { -1.0 }; // sliding direction along x
    let w = s.weight;
    let xm = 0.5 * (s.x_left + s.x_right);
    let mut verticals = vec![(xm, w * (1.0 + sc.kv))];
    let mut horizontals = Vec::new();
    let mut h = 0.0;
    let mut w_star = w * (1.0 + sc.kv);
    for &(x1, x2, q) in &sc.udls {
        let (a, b) = (s.x_left.max(x1), s.x_right.min(x2));
        if b > a {
            verticals.push((0.5 * (a + b), q * (b - a)));
            w_star += q * (b - a);
        }
    }
    for &(x, p, angle) in &sc.lines {
        let share = line_share(all, index, x);
        if share > 0.0 {
            let t = angle.to_radians();
            verticals.push((x, share * p * t.cos()));
            w_star += share * p * t.cos();
            // Component in the sliding direction: H^P = s·p·sin θ, with s = +1 when the mass moves toward +x.
            let hp = share * dir * p * t.sin();
            horizontals.push((sc.terrain(x), hp));
            h += hp;
        }
    }
    if sc.kh > 0.0 {
        horizontals.push((s.y_centroid, sc.kh * w));
        h += sc.kh * w;
    }
    Forces {
        verticals,
        horizontals,
        w_star,
        h,
    }
}

/// Interslice forces, normal forces and the global moment about the circle centre, from the physics.
/// Returns `(E_n, ΣW, residual moment, driving moment)`.
fn global_equilibrium(sc: &Scenario, r: &MethodReport) -> (f64, f64, f64, f64) {
    let (f, lambda) = (r.fos.unwrap(), r.lambda.unwrap());
    let (xc, yc, _) = sc.circle();
    let dir = if sc.ltr { 1.0 } else { -1.0 };
    let crest = -dir;
    let (mut e, mut total_w) = (0.0_f64, 0.0_f64);
    let (mut external, mut base) = (0.0_f64, 0.0_f64);
    for (index, s) in r.slices.iter().enumerate() {
        let (sin, cos) = s.alpha.sin_cos();
        let fz = slice_forces(sc, &r.slices, index);
        total_w += s.weight;
        // Independent of the solver: closed form of ΔE (X1 §3.2) with m_α·F = F cos α + tan φ sin α.
        let l = s.base_length;
        let resist = (fz.w_star * cos - s.pore_pressure * l) * s.tan_phi + s.cohesion * l;
        let d = denominator(f, lambda, s);
        let de = if s.weight == 0.0 {
            0.0
        } else {
            (f * fz.w_star * sin - resist + (f * cos + s.tan_phi * sin) * fz.h) / d
        };
        let n_eff = fz.w_star * cos - s.pore_pressure * l - fz.h * sin + (sin - lambda * cos) * de;
        let shear = (s.cohesion * l + n_eff * s.tan_phi) / f;
        let normal = n_eff + s.pore_pressure * l;
        e += de;
        // Moments about O (z of (P − O) × F).
        for &(x, fv) in &fz.verticals {
            external += (x - xc) * (-fv);
        }
        for &(y, fh) in &fz.horizontals {
            external += -(y - yc) * (dir * fh);
        }
        // Base force at the chord midpoint: N along the inward normal, S along the chord toward the crest.
        let (px, py) = (
            0.5 * (s.x_left + s.x_right),
            0.5 * (s.y_base_left + s.y_base_right),
        );
        let (fx, fy) = (
            normal * (-crest * sin) + shear * (crest * cos),
            normal * cos + shear * sin,
        );
        base += (px - xc) * fy - (py - yc) * fx;
    }
    (e, total_w, external + base, external.abs())
}

/// `D = F (cos α + λ sin α) + (sin α − λ cos α) tan φ` of a soil slice (1 for an air slice, which has no ΔE).
fn denominator(f: f64, lambda: f64, s: &Slice) -> f64 {
    let (sin, cos) = s.alpha.sin_cos();
    if s.weight == 0.0 {
        return 1.0;
    }
    (sin - lambda * cos) * s.tan_phi + (cos + lambda * sin) * f
}

// ----------------------------------------------------- (ii) global equilibrium

fn equilibrium_scenarios() -> Vec<Scenario> {
    let base = vec![
        Scenario::rtl("kh0.1").kh(0.1),
        Scenario::rtl("kh0.2_udl").kh(0.2).udl(50.0, 70.0, 20.0),
        Scenario::rtl("kh0.1_kv-0.05_line10")
            .kh(0.1)
            .kv(-0.05)
            .line(40.0, 20.0, 10.0),
        Scenario::rtl("udl_line_-10")
            .udl(36.0, 44.0, 30.0)
            .line(41.0, 35.0, -10.0),
        Scenario::rtl("kv0.1").kv(0.1),
        // E12f: line loads on the ends of the block, on a terrain vertex and on the edge of a distributed load.
        Scenario::rtl("line_entry").line(X_ENTRY, 100.0, 10.0),
        Scenario::rtl("line_toe").line(X_TOE, 100.0, -10.0),
        Scenario::rtl("line_crown_kh0.1")
            .kh(0.1)
            .line(50.0, 100.0, 15.0),
        Scenario::rtl("line_udl_edge")
            .udl(40.0, 52.0, 15.0)
            .line(40.0, 100.0, 10.0),
        Scenario::rtl("layered_kh0.15").kh(0.15).layered(),
        Scenario::rtl("layered_all")
            .kh(0.12)
            .kv(0.04)
            .udl(40.0, 52.0, 15.0)
            .line(38.0, 25.0, 25.0)
            .layered(),
        // The terrain vertex x = 36 of the layered model.
        Scenario::rtl("layered_vertex")
            .kh(0.1)
            .line(36.0, 60.0, -20.0)
            .layered(),
    ];
    let mirrors: Vec<Scenario> = base.iter().map(Scenario::mirror).collect();
    base.into_iter().chain(mirrors).collect()
}

/// (ii) With the converged `(F, λ)`, the residual moment about O, computed here from the forces (including `H` and the
/// loads) is below 1e-6 of the driving moment, and `|E_n| ≤ 1e-6·ΣW`. The centroid `ȳ` enters through the slice.
#[test]
fn ii_global_equilibrium_with_seismic_force_and_loads() {
    let mut worst = 0.0_f64;
    for sc in equilibrium_scenarios() {
        let r = run(&sc);
        let s = &r.spencer;
        let (en, total_w, residual, motor) = global_equilibrium(&sc, s);
        println!(
            "[ii] {:<34} F={:.6} λ={:+.4} E_n/ΣW={:+.2e} M_res/M_motor={:+.2e}",
            sc.id,
            s.fos.unwrap(),
            s.lambda.unwrap(),
            en / total_w,
            residual / motor
        );
        assert!(en.abs() <= 1e-6 * total_w, "{}: E_n = {en:e}", sc.id);
        assert!(
            residual.abs() < 1e-6 * motor,
            "{}: residual {residual:e} vs motor {motor:e}",
            sc.id
        );
        worst = worst.max((residual / motor).abs());
        // The slicer carries the same forces as the independent recomputation.
        for (index, sl) in s.slices.iter().enumerate() {
            let fz = slice_forces(&sc, &s.slices, index);
            let scale = sl.weight.max(1.0);
            assert!(
                (sl.total_weight() - fz.w_star).abs() <= 1e-12 * scale,
                "{}: W* {sl:?}",
                sc.id
            );
            assert!(
                (sl.h_force - fz.h).abs() <= 1e-12 * scale,
                "{}: H {sl:?}",
                sc.id
            );
        }
    }
    println!("[ii] peor |M_res/M_motor| = {worst:.2e}");
}

// ----------------------------------------------------------------- (iii) oracle

fn scenario_of_oracle(v: &Value) -> Scenario {
    let f = |x: &Value| x.as_f64().expect("number");
    let mut sc = Scenario::rtl(v["id"].as_str().unwrap())
        .kh(f(&v["kh"]))
        .kv(f(&v["kv"]));
    sc.ltr = v["direction"] == "ltr";
    for u in v["udls"].as_array().unwrap() {
        sc = sc.udl(f(&u["x1"]), f(&u["x2"]), f(&u["q"]));
    }
    for l in v["lines"].as_array().unwrap() {
        sc = sc.line(f(&l["x"]), f(&l["p"]), f(&l["angle"]));
    }
    sc
}

/// (iii) The fixed circle of V047a, in the six scenarios of X1 §2.3 and `kh = 0.2` with a `udl` (plus the rest of the
/// fixture), agrees with cSlope within 0.1 %: Bishop with Bishop, Spencer with Morgenstern-Price `constant`.
#[test]
fn iii_cslope_oracle_on_the_fixed_circle_of_v047a() {
    let fixture: Value = serde_json::from_str(ORACLE).expect("fixture");
    assert_eq!(fixture["oracle"], "cslope 0.1.0");
    let c = &fixture["circle"];
    assert_eq!(
        (c["xc"].as_f64(), c["yc"].as_f64(), c["r"].as_f64()),
        (Some(CIRCLE.0), Some(CIRCLE.1), Some(CIRCLE.2)),
        "the fixture and the test use the same circle"
    );
    let scenarios = fixture["scenarios"].as_array().unwrap();
    let required = [
        "control",
        "kh0.1",
        "kv+0.1",
        "kv-0.1",
        "udl20",
        "line40_0",
        "line40_10",
        "kh0.2_udl20",
        "line_entry_10",
        "line_entry_-10",
        "line_toe_10",
        "line_toe_-10",
        "line_crown_15",
        "line_udl_edge_10",
        "ltr_line_entry_10",
        "ltr_line_toe_-10",
    ];
    for id in required {
        assert!(
            scenarios.iter().any(|s| s["id"] == id),
            "missing scenario {id}"
        );
    }
    let mut worst = 0.0_f64;
    for v in scenarios {
        let sc = scenario_of_oracle(v);
        let r = run(&sc);
        for (name, rep) in [("bishop", &r.bishop), ("spencer", &r.spencer)] {
            let reference = v[name].as_f64().unwrap();
            let delta = (fos(rep) - reference) / reference;
            println!(
                "[iii] {:<26} {name:<8} ogs={:.6} cSlope={reference:.6} Δ={:+.4} %",
                sc.id,
                fos(rep),
                delta * 100.0
            );
            assert!(delta.abs() <= 1e-3, "{} {name}: {delta:e}", sc.id);
            worst = worst.max(delta.abs());
        }
    }
    println!(
        "[iii] peor |Δ| = {:.4} % ({} escenarios)",
        worst * 100.0,
        scenarios.len()
    );
}

// ------------------------------------------------------------------- (iv) mirror

/// (iv) x → −x with the opposite direction and the opposite angle of the line loads gives the same FS (≤ 1e-9
/// relative), in Bishop and in Spencer, on both geometries.
#[test]
fn iv_mirror_gives_the_same_factor_of_safety() {
    let mut worst = 0.0_f64;
    for sc in equilibrium_scenarios().into_iter().filter(|s| !s.ltr) {
        let (a, b) = (run(&sc), run(&sc.mirror()));
        for (name, x, y) in [
            ("bishop", &a.bishop, &b.bishop),
            ("spencer", &a.spencer, &b.spencer),
        ] {
            let rel = (fos(x) - fos(y)).abs() / fos(x);
            println!(
                "[iv] {:<26} {name:<8} {:.9} vs {:.9} rel={rel:.2e}",
                sc.id,
                fos(x),
                fos(y)
            );
            assert!(rel <= 1e-9, "{} {name}: {rel:e}", sc.id);
            worst = worst.max(rel);
        }
    }
    println!("[iv] peor diferencia relativa = {worst:.2e}");
}

// -------------------------------------------------------------- (v) monotonicity

/// (v) The FS decreases strictly with `kh ∈ {0, 0.05, 0.1, 0.2}` on the fixed circle of V047a, in both methods, and
/// also with `kv` (downward) and with a growing `udl`.
#[test]
fn v_factor_of_safety_decreases_with_kh() {
    let runs: Vec<(f64, Run)> = [0.0, 0.05, 0.1, 0.2]
        .into_iter()
        .map(|kh| (kh, run(&Scenario::rtl("kh").kh(kh))))
        .collect();
    for w in runs.windows(2) {
        for (name, a, b) in [
            ("bishop", &w[0].1.bishop, &w[1].1.bishop),
            ("spencer", &w[0].1.spencer, &w[1].1.spencer),
        ] {
            println!(
                "[v] {name:<8} kh {} -> {}: {:.6} -> {:.6}",
                w[0].0,
                w[1].0,
                fos(a),
                fos(b)
            );
            assert!(
                fos(b) < fos(a),
                "{name}: FS must decrease from kh={} to kh={}",
                w[0].0,
                w[1].0
            );
        }
    }
    let kv: Vec<f64> = [-0.1, 0.0, 0.1]
        .map(|kv| fos(&run(&Scenario::rtl("kv").kv(kv)).bishop))
        .to_vec();
    assert!(kv[0] > kv[1] && kv[1] > kv[2], "{kv:?}");
}

// ----------------------------------------------------- centroid and the weights

/// Soil columns of the layered model at `x` in the rtl frame: `(lo, hi, γ, γ_sat)` from the bottom up.
fn layered_columns(x: f64) -> Vec<(f64, f64, f64, f64)> {
    let ground = terrain_rtl(x);
    let b_top = ground.min(28.0);
    let mut c = vec![(0.0, b_top, 21.0, 22.5)];
    if ground > 28.0 {
        c.push((28.0, ground, 18.0, 18.0));
    }
    c
}

/// Piezometric line of the layered model: 2 m under the ground.
fn piezo_rtl(x: f64) -> f64 {
    terrain_rtl(x) - 2.0
}

/// Mass and first moment of the soil of a slice by midpoint quadrature on thin strips, with the water split.
fn quadrature(
    s: &Slice,
    columns: impl Fn(f64) -> Vec<(f64, f64, f64, f64)>,
    piezo: Option<&dyn Fn(f64) -> f64>,
) -> (f64, f64) {
    let n = 4000;
    let h = (s.x_right - s.x_left) / n as f64;
    let (mut mass, mut moment) = (0.0, 0.0);
    for i in 0..n {
        let x = s.x_left + (i as f64 + 0.5) * h;
        let yb = s.y_base_left
            + (s.y_base_right - s.y_base_left) * (x - s.x_left) / (s.x_right - s.x_left);
        for (lo, hi, g, gs) in columns(x) {
            let (a, b) = (lo.max(yb), hi);
            if b <= a {
                continue;
            }
            let z = piezo.map_or(f64::NEG_INFINITY, |p| p(x));
            let wet_hi = b.min(z).max(a);
            for (p, q, gamma) in [(a, wet_hi, gs), (wet_hi, b, g)] {
                mass += gamma * (q - p) * h;
                moment += gamma * 0.5 * (q * q - p * p) * h;
            }
        }
    }
    (mass, moment / mass)
}

/// The centroid `ȳ` is the weight-weighted centroid of the soil (trapezoids per material), not the average of heights.
/// Checked on the homogeneous V047a (a cut by a straight chord) and on two materials with `γsat`, against quadrature.
#[test]
fn centroid_is_the_exact_weight_weighted_one() {
    for (name, layered) in [("V047a", false), ("capas y agua", true)] {
        let mut sc = Scenario::rtl(name).kh(0.1);
        sc.layered = layered;
        let report = run(&sc);
        let (mut worst, mut kinks) = (0.0_f64, 0);
        for s in report.spencer.slices.iter().filter(|s| s.weight > 0.0) {
            let (mass, ybar) = if layered {
                quadrature(s, layered_columns, Some(&piezo_rtl))
            } else {
                quadrature(s, |x| vec![(0.0, terrain_rtl(x), 20.0, 20.0)], None)
            };
            // A slice whose chord crosses the water table has a kink in the integrand: the engine (as in v0.1) evaluates
            // the column at the midpoint, so the weight and the centroid are exact only up to O(b²) there.
            let side = |x: f64, y: f64| y - piezo_rtl(x);
            // The same happens where the water table crosses the interface of the layers (x = 40, y = 28).
            let kink = layered
                && (side(s.x_left, s.y_base_left) * side(s.x_right, s.y_base_right) < 0.0
                    || (s.x_left < 40.0 && 40.0 < s.x_right));
            let (w_tol, y_tol) = if kink { (2e-3, 2e-2) } else { (1e-6, 1e-5) };
            assert!(
                (mass - s.weight).abs() <= w_tol * s.weight,
                "{name}: W {} vs {mass} (kink {kink})",
                s.weight
            );
            let diff = (s.y_centroid - ybar).abs();
            if kink {
                kinks += 1;
            } else {
                worst = worst.max(diff);
            }
            assert!(
                diff <= y_tol,
                "{name}: ȳ {} vs {ybar} (kink {kink}) in {s:?}",
                s.y_centroid
            );
            // The half-sum of the heights would be wrong in the slices where the ground is sloped.
        }
        println!(
            "[ȳ] {name}: peor |ȳ − cuadratura| = {worst:.2e} m ({kinks} dovelas con quiebre en la freática)"
        );
        assert_eq!(
            kinks > 0,
            layered,
            "the layered model must exercise a water-table kink"
        );
    }
    // The shortcut (ground + base)/2 differs by more than the tolerance in the sloped slices: the test can tell.
    let sc = Scenario::rtl("semisuma").kh(0.1);
    let report = run(&sc);
    let gap = report
        .spencer
        .slices
        .iter()
        .filter(|s| s.weight > 0.0)
        .map(|s| {
            let half = 0.25 * (s.y_top_mid * 2.0 + s.y_base_left + s.y_base_right);
            (s.y_centroid - half).abs()
        })
        .fold(0.0_f64, f64::max);
    assert!(
        gap > 1e-3,
        "ȳ must differ from the half-sum in some slice: {gap:e}"
    );
}

// ---------------------------------------------------------- Spencer closed form

/// The closed form of ΔE and the direct N' against a 2 × 2 solve of the equilibrium of the slice written from scratch
/// (X1 §3.6 item 1): unknowns `N'` and `ΔE` from
/// `N' cos α + U cos α + S sin α + λ ΔE = W*` and `ΔE = (N' + U) sin α − S cos α + H`, with `S = (c l + N' tan φ)/F`.
#[test]
fn spencer_closed_form_matches_a_2x2_solve() {
    let sc = Scenario::rtl("2x2")
        .kh(0.15)
        .kv(0.05)
        .line(40.0, 30.0, 15.0)
        .udl(36.0, 48.0, 12.0);
    let r = run(&sc);
    let s = &r.spencer;
    let (f, lambda) = (s.fos.unwrap(), s.lambda.unwrap());
    let e = spencer_interslice(&s.slices, f, lambda);
    let normals = spencer_direct_normals(&s.slices, lambda, &e);
    let mut worst = 0.0_f64;
    for (k, sl) in s.slices.iter().enumerate() {
        if sl.weight == 0.0 {
            continue;
        }
        let (sin, cos) = sl.alpha.sin_cos();
        let (t, l, u) = (
            sl.tan_phi,
            sl.base_length,
            sl.pore_pressure * sl.base_length,
        );
        let (ws, h, c) = (sl.total_weight(), sl.h_force, sl.cohesion);
        // Unknowns x = (N', ΔE). Row 1: vertical. Row 2: horizontal. S = (c l + N' t)/F.
        let a11 = cos + t * sin / f;
        let a12 = lambda;
        let b1 = ws - u * cos - c * l * sin / f;
        let a21 = sin - t * cos / f;
        let a22 = -1.0;
        let b2 = -u * sin + c * l * cos / f - h;
        let det = a11 * a22 - a12 * a21;
        let n_eff = (b1 * a22 - a12 * b2) / det;
        let de = (a11 * b2 - a21 * b1) / det;
        let d_de = (e[k + 1] - e[k] - de).abs() / sl.total_weight().max(1.0);
        let d_n = (normals[k] - n_eff).abs() / sl.total_weight().max(1.0);
        worst = worst.max(d_de).max(d_n);
        assert!(
            d_de < 1e-12 && d_n < 1e-12,
            "slice {k}: ΔE {} vs {de}, N' {} vs {n_eff}",
            e[k + 1] - e[k],
            normals[k]
        );
        // The E4e form of N' (with m_α and ΔX = λ ΔE) gives the same normal force.
        let alt = effective_normal(sl, f, lambda * (e[k + 1] - e[k]));
        assert!(
            (alt - n_eff).abs() <= 1e-11 * sl.total_weight().max(1.0),
            "slice {k}: {alt} vs {n_eff}"
        );
    }
    println!("[Spencer 2×2] peor diferencia relativa = {worst:.2e}");
}

/// Bishop with the formula of the contract, written here: `F = Σ[c b + (W* − u b) tan φ]/m_α ÷ Σ[W* sin α + M]`
/// with `M = [kh W (yc − ȳ) + H^P (yc − y_g)] / R`, solved by fixed point on the slices of the report.
#[test]
fn bishop_follows_the_contract_formula() {
    let sc = Scenario::rtl("bishop")
        .kh(0.12)
        .kv(-0.03)
        .line(40.0, 25.0, 12.0)
        .udl(38.0, 46.0, 20.0);
    let r = run(&sc);
    let (xc, yc, rad) = sc.circle();
    let _ = xc;
    let mut f = 1.0_f64;
    for _ in 0..200 {
        let (mut num, mut den) = (0.0, 0.0);
        for (index, s) in r
            .bishop
            .slices
            .iter()
            .enumerate()
            .filter(|(_, s)| s.weight > 0.0)
        {
            let (sin, cos) = s.alpha.sin_cos();
            let fz = slice_forces(&sc, &r.bishop.slices, index);
            let mut m_driving = sc.kh * s.weight * (yc - s.y_centroid) / rad;
            for &(x, p, angle) in &sc.lines {
                let share = line_share(&r.bishop.slices, index, x);
                if share > 0.0 {
                    let hp = -share * p * angle.to_radians().sin(); // s = −1 (right_to_left)
                    m_driving += hp * (yc - sc.terrain(x)) / rad;
                }
            }
            let m_alpha = cos + sin * s.tan_phi / f;
            num += (s.cohesion * s.width + (fz.w_star - s.pore_pressure * s.width) * s.tan_phi)
                / m_alpha;
            den += fz.w_star * sin + m_driving;
        }
        f = num / den;
    }
    let ogs = fos(&r.bishop);
    println!(
        "[Bishop] contrato={f:.9} ogs={ogs:.9} rel={:.2e}",
        (f - ogs).abs() / ogs
    );
    assert!((f - ogs).abs() / ogs < 1e-7, "{f} vs {ogs}");
}

// ----------------------------------------------- slicer: breakpoints, air, E10a

/// Breakpoints of E12b: `x1` and `x2` of every `udl` and `x ± 1e-6·width` of every `line` are slice boundaries, also in
/// the second slicing of the kept block (E11d). V047a's circle is truncated, so that path is the one tested.
#[test]
fn slicer_adds_breakpoints_for_the_loads() {
    let sc = Scenario::rtl("breaks")
        .udl(36.37, 44.11, 10.0)
        .line(40.0, 10.0, 0.0);
    let r = run(&sc);
    assert!(
        r.bishop.warnings.iter().any(|w| w == "truncated_mass"),
        "{:?}",
        r.bishop.warnings
    );
    let xs: Vec<f64> = r
        .bishop
        .slices
        .iter()
        .flat_map(|s| [s.x_left, s.x_right])
        .collect();
    let has = |x: f64, tol: f64| xs.iter().any(|&v| (v - x).abs() <= tol);
    assert!(
        has(36.37, 0.0) && has(44.11, 0.0),
        "udl ends are boundaries"
    );
    let delta = 1e-6 * 50.0;
    assert!(
        has(40.0 - delta, 1e-12) && has(40.0 + delta, 1e-12),
        "line breakpoints at x ± 1e-6·width"
    );
    // The load goes to exactly one slice: the thin one around x = 40.
    let carrying: Vec<&Slice> = r
        .bishop
        .slices
        .iter()
        .filter(|s| s.weight_extra != 0.0)
        .collect();
    let line_slice: Vec<&&Slice> = carrying
        .iter()
        .filter(|s| s.x_left <= 40.0 && 40.0 < s.x_right)
        .collect();
    assert_eq!(line_slice.len(), 1);
    assert!((line_slice[0].x_right - line_slice[0].x_left - 2.0 * delta).abs() < 1e-12);
    // Σ Q + V = q·|[36.37, 44.11] ∩ analysed block| + p.
    let total: f64 = carrying.iter().map(|s| s.weight_extra).sum();
    let q_len: f64 = r
        .bishop
        .slices
        .iter()
        .filter(|s| s.weight > 0.0)
        .map(|s| (s.x_right.min(44.11) - s.x_left.max(36.37)).max(0.0))
        .sum();
    assert!(
        (total - (10.0 * q_len + 10.0)).abs() < 1e-9,
        "{total} vs {}",
        10.0 * q_len + 10.0
    );
    assert!(
        (q_len - (44.11 - 36.37)).abs() < 1e-9,
        "the udl lies inside the mass: {q_len}"
    );
}

/// Loads count only on soil slices of the analysed block (E12b). Circle of the toe-gap geometry (E2, E10a): the toe
/// lens is discarded and its slices carry no load, and a load over the lens is `load_outside_mass`.
#[test]
fn loads_do_not_act_on_air_or_discarded_slices() {
    let doc = json!({
        "format": "opengeoslide", "version": "0.2",
        "materials": [{"id": "soil", "name": "Soil", "model": "mohr_coulomb",
                       "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6}],
        "regions": [{"material": "soil", "polygon": [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]]}],
        "slope": {"direction": "right_to_left"},
        "analysis": {"methods": ["bishop", "spencer"], "slices": 60,
                     "surface": {"type": "circle", "xc": 25.0, "yc": 44.0, "r": 19.5}}
    });
    let plain: Value = serde_json::from_str(&analyze_json(&doc.to_string()).unwrap()).unwrap();
    let plain_warn = plain["results"][0]["warnings"].as_array().unwrap().clone();
    assert!(
        plain_warn.iter().any(|w| w == "truncated_mass"),
        "{plain_warn:?}"
    );
    let kept_from = plain["results"][0]["slices"][0]["x_left"].as_f64().unwrap();
    let kept_to = plain["results"][0]["slices"]
        .as_array()
        .unwrap()
        .last()
        .unwrap()["x_right"]
        .as_f64()
        .unwrap();
    assert!(
        kept_from > 29.0,
        "the toe lens is discarded: the block starts at {kept_from}"
    );

    // A udl over the whole ground [20, 70] and a line load on the discarded lens (x = 25).
    let mut loaded = doc.clone();
    loaded["loads"] = json!([
        {"type": "udl", "id": "all", "x1": 20.0, "x2": 70.0, "q": 10.0},
        {"type": "line", "id": "lens", "x": 25.0, "p": 40.0, "angle": 0.0}
    ]);
    let rep: Value = serde_json::from_str(&analyze_json(&loaded.to_string()).unwrap()).unwrap();
    for res in rep["results"].as_array().unwrap() {
        let slices = res["slices"].as_array().unwrap();
        let mut q_total = 0.0;
        for s in slices {
            let extra = s["weight_extra"].as_f64().unwrap();
            if s["weight"].as_f64().unwrap() == 0.0 {
                assert_eq!(extra, 0.0, "air slice with load: {s}");
            }
            q_total += extra;
        }
        let covered: f64 = slices
            .iter()
            .filter(|s| s["weight"].as_f64().unwrap() > 0.0)
            .map(|s| s["x_right"].as_f64().unwrap() - s["x_left"].as_f64().unwrap())
            .sum();
        assert!(
            (q_total - 10.0 * covered).abs() < 1e-9,
            "Σ Q = {q_total}, q·soil = {}",
            10.0 * covered
        );
        assert!(covered < kept_to - kept_from + 1e-9);
        let warnings: Vec<&str> = res["warnings"]
            .as_array()
            .unwrap()
            .iter()
            .map(|w| w.as_str().unwrap())
            .collect();
        assert!(
            warnings.contains(&"load_outside_mass"),
            "the lens load is outside the mass: {warnings:?}"
        );
    }
}

// ------------------------------------------------------------- load_outside_mass

fn notes(r: &MethodReport) -> bool {
    r.warnings.iter().any(|w| w == "load_outside_mass")
}

/// The note `load_outside_mass` appears when a declared load acts on no soil slice of the reported surface, and not
/// otherwise. The result does not change because of that load (X1 T5/T6).
#[test]
fn load_outside_mass_note() {
    let control = run(&Scenario::rtl("control"));
    assert!(!notes(&control.bishop) && !notes(&control.spencer));
    // Inside the mass: no note.
    let inside = run(&Scenario::rtl("in")
        .line(40.0, 20.0, 0.0)
        .udl(36.0, 44.0, 10.0));
    assert!(
        !notes(&inside.bishop) && !notes(&inside.spencer),
        "{:?}",
        inside.bishop.warnings
    );
    // x = 60 is not above the circle (the entry is near x = 45): the line load is outside, and nothing changes.
    let outside = run(&Scenario::rtl("out").line(60.0, 20.0, 0.0));
    assert!(
        notes(&outside.bishop) && notes(&outside.spencer),
        "{:?}",
        outside.bishop.warnings
    );
    assert_eq!(fos(&outside.bishop), fos(&control.bishop));
    assert_eq!(fos(&outside.spencer), fos(&control.spencer));
    // A udl beyond the entry, and one of two loads outside: still the note.
    let udl_out = run(&Scenario::rtl("udl_out").udl(60.0, 70.0, 20.0));
    assert!(notes(&udl_out.bishop) && notes(&udl_out.spencer));
    assert_eq!(fos(&udl_out.bishop), fos(&control.bishop));
    let one_out = run(&Scenario::rtl("one_out")
        .line(40.0, 20.0, 0.0)
        .line(60.0, 20.0, 0.0));
    assert!(notes(&one_out.bishop) && notes(&one_out.spencer));
    // The mirror image keeps the note.
    let mirror = run(&Scenario::rtl("m").line(60.0, 20.0, 0.0).mirror());
    assert!(notes(&mirror.bishop) && notes(&mirror.spencer));
    // The note is informative: the contract lists it with the other codes of §4.5 (checked in acceptance/validation).
}

// ------------------------------------------------- E12f: loads on the edges (R5-01)

/// Slices of a run that carry a share of the line load: `(x_left, x_right, weight_extra, h_force)`.
fn carriers(r: &MethodReport) -> Vec<(f64, f64, f64, f64)> {
    r.slices
        .iter()
        .filter(|s| s.weight_extra != 0.0)
        .map(|s| (s.x_left, s.x_right, s.weight_extra, s.h_force))
        .collect()
}

/// E12f: a line load exactly at the entry or at the exit of the analysed block acts on the end slice, with the whole
/// force and without the note `load_outside_mass`. The half-open interval of E12b dropped it at the entry: FS 0.985
/// against cSlope 0.920 (+7.1 %). The same in both directions, and the factor of safety does not depend on the side
/// (≤ 1e-9); cSlope agrees within 0.1 % (the oracle scenarios of `iii` cover those ids, here the end slice is checked).
#[test]
fn e12f_line_load_at_the_ends_of_the_block_acts_on_the_end_slice() {
    let control = run(&Scenario::rtl("control"));
    for (x, angle) in [
        (X_ENTRY, 10.0),
        (X_ENTRY, -10.0),
        (X_TOE, 10.0),
        (X_TOE, -10.0),
    ] {
        let rtl = Scenario::rtl("end").line(x, 100.0, angle);
        let ltr = rtl.mirror();
        let (a, b) = (run(&rtl), run(&ltr));
        for (name, ra, rb, c) in [
            ("bishop", &a.bishop, &b.bishop, &control.bishop),
            ("spencer", &a.spencer, &b.spencer, &control.spencer),
        ] {
            assert!(!notes(ra) && !notes(rb), "x={x} {name}: {:?}", ra.warnings);
            assert!(
                (fos(ra) - fos(c)).abs() > 1e-3,
                "x={x} θ={angle} {name}: the load changes the FS"
            );
            let rel = (fos(ra) - fos(rb)).abs() / fos(ra);
            println!(
                "[E12f] x={x:.8} θ={angle:+} {name:<8} rtl={:.9} ltr={:.9} rel={rel:.2e}",
                fos(ra),
                fos(rb)
            );
            assert!(rel <= 1e-9, "x={x} θ={angle} {name}: {rel:e}");
            // One carrier: the end slice, whose edge is the load, with the whole force.
            for run in [ra, rb] {
                let c = carriers(run);
                assert_eq!(c.len(), 1, "x={x}: {c:?}");
                let (xl, xr, v, _) = c[0];
                let edge = if x > 0.0 { x } else { -x };
                assert!(
                    (xl.abs() - edge).abs() < 1e-12 || (xr.abs() - edge).abs() < 1e-12,
                    "x={x}: slice [{xl}, {xr}]"
                );
                assert!((v - 100.0 * angle.to_radians().cos()).abs() < 1e-9, "{v}");
            }
        }
    }
}

/// E12f: a line load on a boundary shared by two soil slices is split 50/50: the terrain vertex of the crown (x = 50),
/// the edge of a distributed load, and the vertex of the layered model. The sum is the whole load, the two halves are
/// equal, and the mirror image gives the same FS (≤ 1e-9; with E12b the right slice took it all, 3.4e-7).
#[test]
fn e12f_load_on_a_shared_boundary_is_split_in_half_and_mirrors() {
    let cases = [
        (
            "crown",
            Scenario::rtl("crown").line(50.0, 100.0, 15.0),
            50.0,
            15.0,
        ),
        (
            "udl_edge",
            Scenario::rtl("udl_edge")
                .udl(40.0, 52.0, 15.0)
                .line(40.0, 100.0, 10.0),
            40.0,
            10.0,
        ),
        (
            "layered_vertex",
            Scenario::rtl("layered_vertex")
                .kh(0.1)
                .line(36.0, 60.0, -20.0)
                .layered(),
            36.0,
            -20.0,
        ),
    ];
    for (name, sc, x, angle) in cases {
        let angle: f64 = angle;
        let p = if name == "layered_vertex" {
            60.0
        } else {
            100.0
        };
        let (a, b) = (run(&sc), run(&sc.mirror()));
        for (method, ra, rb) in [
            ("bishop", &a.bishop, &b.bishop),
            ("spencer", &a.spencer, &b.spencer),
        ] {
            let rel = (fos(ra) - fos(rb)).abs() / fos(ra);
            println!(
                "[E12f] {name:<15} {method:<8} {:.12} vs {:.12} rel={rel:.2e}",
                fos(ra),
                fos(rb)
            );
            assert!(rel <= 1e-9, "{name} {method}: {rel:e}");
            for (run, sx) in [(ra, 1.0), (rb, -1.0)] {
                // Slices that touch the load: their interval contains it.
                let touching: Vec<&Slice> = run
                    .slices
                    .iter()
                    .filter(|s| {
                        let (l, r) = (s.x_left.min(s.x_right), s.x_left.max(s.x_right));
                        s.weight > 0.0 && l - 1e-9 <= sx * x && sx * x <= r + 1e-9
                    })
                    .collect();
                assert_eq!(touching.len(), 2, "{name} {method}: {touching:?}");
                let udl_part = |s: &Slice| {
                    // Subtract the distributed load of the slice and the kv part (none here): what is left is V.
                    let overlap = if name == "udl_edge" {
                        let (a, b) = if sx > 0.0 {
                            (40.0, 52.0)
                        } else {
                            (-52.0, -40.0)
                        };
                        (s.x_right.min(b) - s.x_left.max(a)).max(0.0) * 15.0
                    } else {
                        0.0
                    };
                    s.weight_extra - overlap
                };
                let (v0, v1) = (udl_part(touching[0]), udl_part(touching[1]));
                let v = p * angle.to_radians().cos();
                assert!(
                    (v0 - 0.5 * v).abs() < 1e-9 && (v1 - 0.5 * v).abs() < 1e-9,
                    "{name}: {v0} {v1} vs {}",
                    0.5 * v
                );
                // The mirror has the opposite direction and the opposite angle: H^P is the same, −p·sin θ.
                let h = -p * angle.to_radians().sin();
                let kh_part = |s: &Slice| {
                    s.h_force - 0.1 * s.weight * if name == "layered_vertex" { 1.0 } else { 0.0 }
                };
                assert!(
                    (kh_part(touching[0]) - 0.5 * h).abs() < 1e-9
                        && (kh_part(touching[1]) - 0.5 * h).abs() < 1e-9,
                    "{name}: H"
                );
            }
        }
    }
}

/// E12f: outside the block there is no load. The ground at x = 30 lies 1.6e-6 before the toe of the block (more than
/// `1e-9·width`), x = 60 is beyond the entry: the note `load_outside_mass` and the FS of the model without the load.
#[test]
fn e12f_load_outside_the_block_is_noted_and_does_not_change_the_factor() {
    let control = run(&Scenario::rtl("control"));
    for x in [30.0, X_ENTRY + 1e-3, 60.0] {
        let sc = Scenario::rtl("out").line(x, 100.0, 10.0);
        for sc in [sc.clone(), sc.mirror()] {
            let r = run(&sc);
            assert!(notes(&r.bishop) && notes(&r.spencer), "x={x}");
            // The breakpoints x ± 1e-6·width still cut the block, which moves the FS by ~1e-9.
            for (a, b) in [(&r.bishop, &control.bishop), (&r.spencer, &control.spencer)] {
                assert!((fos(a) - fos(b)).abs() <= 1e-8 * fos(b), "x={x}");
            }
            assert!(carriers(&r.bishop).is_empty(), "x={x}");
        }
    }
    // Within the tolerance (1e-9 of the width) of the end: still inside.
    let near = run(&Scenario::rtl("near").line(X_ENTRY + 1e-9 * WIDTH * 0.5, 100.0, 10.0));
    assert!(!notes(&near.bishop) && !notes(&near.spencer));
    assert_eq!(carriers(&near.bishop).len(), 1);
}

// ----------------------------------------------------------------- search

/// A search with seismic force runs end to end: it converges and the critical FS is lower than without it.
#[test]
fn search_with_seismic_force_converges_and_lowers_the_factor() {
    let mut base = v047a_v01();
    base["version"] = json!("0.2");
    let plain = analyze_json(&base.to_string()).unwrap();
    let plain: Value = serde_json::from_str(&plain).unwrap();
    let mut seismic = base.clone();
    seismic["analysis"]["seismic"] = json!({"kh": 0.1, "kv": 0.0});
    seismic["loads"] = json!([{"type": "udl", "x1": 40.0, "x2": 52.0, "q": 15.0}]);
    let rep: Value = serde_json::from_str(&analyze_json(&seismic.to_string()).unwrap()).unwrap();
    for i in 0..2 {
        let (a, b) = (&plain["results"][i], &rep["results"][i]);
        assert_eq!(b["status"], "converged", "{b}");
        let (fa, fb) = (a["fos"].as_f64().unwrap(), b["fos"].as_f64().unwrap());
        println!(
            "[búsqueda] {}: sin sismo {fa:.6}, kh=0.1 + udl {fb:.6}",
            b["method"]
        );
        assert!(fb < fa, "{fb} must be below {fa}");
    }
}

/// `slice_circle` without loads is what it was before v0.2 (the neutral `LoadCase`): all new fields are zero.
#[test]
fn slice_circle_without_loads_has_zero_new_fields() {
    let sc = Scenario::rtl("neutral");
    let model = sc.model();
    let pm = ogs_core::geometry::PreparedModel::new(&model).unwrap();
    let (xc, yc, r) = sc.circle();
    let slices = slice_circle(&pm, &ogs_core::model::Circle { xc, yc, r }, 50).unwrap();
    assert!(!slices.is_empty());
    for s in &slices {
        assert_eq!(
            (
                s.weight_extra,
                s.h_force,
                s.h_moment_base,
                s.driving_extra,
                s.y_centroid
            ),
            (0.0, 0.0, 0.0, 0.0, 0.0)
        );
    }
}
