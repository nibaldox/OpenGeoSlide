//! SHANSEP in the engine (F6.3, F6.9, F6.11; M-SH of B1).
//!
//! - **Oracle:** the rows of X30 (`docs/fase3/exploracion/X30_filas/`), migrated to `tests/data/f3b/sh/` in the final
//!   format (`model: "shansep"` and the `shansep` object): V047a dry and wet with the three sources of OCR, the loads
//!   (`udl`, `line`), the seismic rows (`kh`, `kv`), the deep circle of the search (as a fixed circle) and the row
//!   with `σ′v ≤ 0`. Every method of the oracle within 0.1 % (X30 measured ≤ 0.023 %).
//! - **V105a:** prints the figure of the engine and the difference with the published one (1.285 ± 0.01039), without an
//!   assertion. The row has no `aboveWater` (outside v0.6, F6.9).
//! - **Identities:** `Su = ratio·σ′v` with OCR 1 slice by slice, POP 0 equal to OCR 1, the mirror, the monotonicity, the
//!   earthquake out of `Su`, `σ′v ≤ 0` with its note, a Mohr-Coulomb layer next to a SHANSEP one.
//! - The identity of the faces (F6.9) is a unit test in `src/shansep.rs`: `interslice_face_strength` is crate-private.

mod f3_common;

use f3_common::{mirror, run};
use ogs_core::report::{AnalysisReport, MethodReport, SliceStrength};
use serde_json::{Value, json};
use std::path::PathBuf;

const METHODS: [&str; 5] = [
    "bishop",
    "spencer",
    "morgenstern_price",
    "janbu_simplified",
    "janbu_corrected",
];
const NOTE: &str = "shansep_nonpositive_stress";
const TOLERANCE_PCT: f64 = 0.1;

fn row(id: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/data/f3b/sh")
        .join(format!("{id}.json"));
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
    serde_json::from_str(&text).expect("row parses")
}

fn model(id: &str) -> Value {
    row(id)["model"].clone()
}

fn fos_of(report: &AnalysisReport, method: &str) -> f64 {
    let i = METHODS
        .iter()
        .position(|m| *m == method)
        .expect("known method");
    report.results[i].fos.expect("fos is finite")
}

/// The Shansep entries of `MethodReport.strength`: `(index, σ′v, OCR)`.
fn entries(result: &MethodReport) -> Vec<(usize, f64, f64)> {
    result
        .strength
        .as_ref()
        .map(|s| {
            s.slices
                .iter()
                .filter_map(|e| match e {
                    SliceStrength::Shansep {
                        index,
                        vertical_stress,
                        ocr,
                    } => Some((*index, *vertical_stress, *ocr)),
                    _ => None,
                })
                .collect()
        })
        .unwrap_or_default()
}

fn set_ocr(doc: &mut Value, shansep: Value) {
    doc["materials"][0]["shansep"] = shansep;
}

// --------------------------------------------------------------------------------------------------- the oracle

const ORACLE_ROWS: [&str; 14] = [
    "X30-F-V047a-seco-ocr1",
    "X30-F-V047a-seco-ocr1.5",
    "X30-F-V047a-seco-pop10",
    "X30-F-V047a-seco-ocrbyelev",
    "X30-F-V047a-humedo-ocr1",
    "X30-F-V047a-humedo-ocr1.5",
    "X30-F-V047a-humedo-pop10",
    "X30-F-V047a-humedo-ocrbyelev",
    "X30-F-carga-udl",
    "X30-F-carga-line",
    "X30-F-sismo-kh0.1",
    "X30-F-sismo-kv0.1",
    "X30-S-V047a-profundo",
    "X30-F-sv-negativo",
];

#[test]
fn the_rows_of_the_oracle_agree_to_a_tenth_of_a_percent() {
    println!(
        "{:<32} {:<18} {:>10} {:>10} {:>9}",
        "row", "method", "oracle", "engine", "dif %"
    );
    let mut failures = Vec::new();
    for id in ORACLE_ROWS {
        let r = row(id);
        let mut doc = r["model"].clone();
        // X30 compares M-P with the constant interslice function, not the default half-sine.
        doc["analysis"]["interslice"] = json!({"function": "constant"});
        let report = run(&doc);
        for method in METHODS {
            if id == "X30-F-sv-negativo" && method != "bishop" {
                continue; // X30 measured this supplementary diagnostic only for Bishop.
            }
            let expected = r["oracle"][method]
                .as_f64()
                .unwrap_or_else(|| panic!("{id} {method}: falta referencia del oráculo"));
            let got = fos_of(&report, method);
            let dif = (got - expected) / expected * 100.0;
            println!("{id:<32} {method:<18} {expected:>10.6} {got:>10.6} {dif:>+9.4}");
            if dif.abs() > TOLERANCE_PCT {
                failures.push(format!(
                    "{id} {method}: {got} frente a {expected} ({dif:+.4} %)"
                ));
            }
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}

#[test]
fn every_oracle_row_has_all_its_methods_converged_and_the_shansep_strength() {
    for id in ORACLE_ROWS {
        let report = run(&model(id));
        for result in &report.results {
            assert_eq!(
                result.status,
                ogs_core::methods::SolveStatus::Converged,
                "{id} {:?}",
                result.method
            );
            assert!(result.fos.is_some(), "{id} {:?}", result.method);
            let entries = entries(result);
            assert!(
                !entries.is_empty(),
                "{id} {:?}: sin strength",
                result.method
            );
            // Entries are sorted by index and each one points to a slice with `tan_phi = 0`.
            assert!(entries.windows(2).all(|w| w[0].0 < w[1].0), "{id}");
            for (index, _, _) in &entries {
                assert_eq!(result.slices[*index].tan_phi, 0.0, "{id}");
            }
        }
    }
}

/// V105a: the figure of the engine and the difference with the published value; no assertion on the value.
#[test]
fn v105a_prints_the_engine_figure_against_the_published_one() {
    let r = row("X30-F-V105a");
    let report = run(&r["model"]);
    let published = r["publicado"]["bishop"].as_f64().unwrap();
    let tol = r["publicado"]["tolerancia"].as_f64().unwrap();
    println!("V105a (sin aboveWater): publicado {published} ± {tol}");
    for method in METHODS {
        let got = fos_of(&report, method);
        let oracle = r["oracle"][method].as_f64().unwrap();
        println!(
            "  {method:<18} motor {got:.6}  oráculo {oracle:.6}  dif. con el oráculo {:+.4} %",
            (got - oracle) / oracle * 100.0
        );
    }
    let bishop = fos_of(&report, "bishop");
    println!(
        "  Bishop: motor {bishop:.6} frente al publicado {published}: dif. {:+.6} ({:+.3} %), tolerancia ±{tol} → {}",
        bishop - published,
        (bishop - published) / published * 100.0,
        if (bishop - published).abs() <= tol {
            "dentro"
        } else {
            "fuera"
        }
    );
}

// --------------------------------------------------------------------------------------------------- identities

/// With OCR 1, `Su = ratio·σ′v` slice by slice and `σ′v = W/b − u` (dry, no loads). The earthquake does not change it.
#[test]
fn with_ocr_one_su_is_ratio_times_the_effective_vertical_stress() {
    for id in [
        "X30-F-V047a-seco-ocr1",
        "X30-F-sismo-kh0.1",
        "X30-F-sismo-kv0.1",
    ] {
        let report = run(&model(id));
        for result in &report.results {
            for (index, sigma_v, ocr) in entries(result) {
                let s = &result.slices[index];
                let expected = s.weight / s.width - s.pore_pressure;
                assert!(
                    (sigma_v - expected).abs() < 1e-9,
                    "{id}: σ′v {sigma_v} frente a {expected}"
                );
                assert_eq!(ocr, 1.0, "{id}");
                assert!(
                    (s.cohesion - 0.25 * sigma_v).abs() < 1e-12 * sigma_v.abs().max(1.0),
                    "{id}: Su {} frente a {}",
                    s.cohesion,
                    0.25 * sigma_v
                );
                assert_eq!(s.tan_phi, 0.0);
            }
        }
    }
}

/// `σ′v` includes the vertical loads (`Q + V`) and not the seismic term: `Σ b·(σ′v − (W/b − u))` is the vertical force
/// of the loads of the slices, and for the `udl` it is `q` on every slice that the load covers.
#[test]
fn the_loads_enter_the_effective_vertical_stress() {
    let udl = run(&model("X30-F-carga-udl"));
    let result = &udl.results[0];
    let mut covered = 0;
    for (index, sigma_v, _) in entries(result) {
        let s = &result.slices[index];
        let extra = sigma_v - (s.weight / s.width - s.pore_pressure);
        if s.x_left >= 40.0 && s.x_right <= 60.0 {
            assert!((extra - 50.0).abs() < 1e-9, "x {}: {extra}", s.x_left);
            covered += 1;
        } else if s.x_right <= 40.0 {
            assert!(extra.abs() < 1e-9, "x {}: {extra}", s.x_left);
        }
    }
    assert!(covered >= 3, "the load must cover some slices: {covered}");

    // A line load of 300 kN/m (vertical): the sum of the extra forces is 300.
    let line = run(&model("X30-F-carga-line"));
    let result = &line.results[0];
    let total: f64 = entries(result)
        .iter()
        .map(|&(index, sigma_v, _)| {
            let s = &result.slices[index];
            s.width * (sigma_v - (s.weight / s.width - s.pore_pressure))
        })
        .sum();
    assert!((total - 300.0).abs() < 1e-8, "Σ Q+V = {total}");
}

/// The earthquake acts on the forces of the methods only: `Su` and `σ′v` do not change, slice by slice (X30 §1).
#[test]
fn the_earthquake_does_not_change_su() {
    let base = run(&model("X30-F-V047a-seco-ocr1"));
    for id in ["X30-F-sismo-kh0.1", "X30-F-sismo-kv0.1"] {
        let quake = run(&model(id));
        // Same method order: compare Bishop of both, and the FS must have changed.
        let (b, q) = (&base.results[0], &quake.results[0]);
        assert_eq!(b.slices.len(), q.slices.len(), "{id}");
        for (x, y) in b.slices.iter().zip(&q.slices) {
            assert!(
                (x.cohesion - y.cohesion).abs() <= 1e-12 * x.cohesion.abs().max(1.0),
                "{id}"
            );
        }
        for (x, y) in entries(b).iter().zip(entries(q)) {
            assert!(
                (x.1 - y.1).abs() < 1e-9,
                "{id}: σ′v {} frente a {}",
                x.1,
                y.1
            );
        }
        assert!(
            q.fos.unwrap() < b.fos.unwrap() - 0.01,
            "{id}: el sismo debe bajar el FS"
        );
    }
}

/// `pop = 0` is `ocr = 1`: the same `Su` slice by slice and the same FS in the five methods.
#[test]
fn pop_zero_is_the_same_as_ocr_one() {
    for id in ["X30-F-V047a-seco-ocr1", "X30-F-V047a-humedo-ocr1"] {
        let one = run(&model(id));
        let mut doc = model(id);
        set_ocr(
            &mut doc,
            json!({"ratio": 0.25, "exponent": 0.8, "pop": 0.0}),
        );
        let zero = run(&doc);
        for (a, b) in one.results.iter().zip(&zero.results) {
            let (fa, fb) = (a.fos.unwrap(), b.fos.unwrap());
            assert!(
                (fa - fb).abs() <= 1e-12 * fa,
                "{id} {:?}: {fa} {fb}",
                a.method
            );
            for (x, y) in a.slices.iter().zip(&b.slices) {
                assert!((x.cohesion - y.cohesion).abs() <= 1e-12 * x.cohesion.abs().max(1.0));
            }
        }
    }
}

/// Mirror x → −x: the same FS to 1e-9 in the five methods (the water and the loads are mirrored too).
fn mirror_all(doc: &Value) -> Value {
    let mut d = mirror(doc);
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
                if l["type"] == "udl" {
                    let (x1, x2) = (l["x1"].as_f64().unwrap(), l["x2"].as_f64().unwrap());
                    l["x1"] = json!(-x2);
                    l["x2"] = json!(-x1);
                } else {
                    l["x"] = json!(-l["x"].as_f64().unwrap());
                }
                l
            })
            .collect();
        d["loads"] = Value::Array(flipped);
    }
    d
}

#[test]
fn the_mirror_gives_the_same_fos() {
    for id in [
        "X30-F-V047a-seco-pop10",
        "X30-F-V047a-humedo-ocrbyelev",
        "X30-F-carga-udl",
        "X30-F-carga-line",
        "X30-F-sismo-kh0.1",
    ] {
        let doc = model(id);
        let a = run(&doc);
        let b = run(&mirror_all(&doc));
        for method in METHODS {
            let (fa, fb) = (fos_of(&a, method), fos_of(&b, method));
            assert!(
                (fa - fb).abs() <= 1e-9 * fa,
                "{id} {method}: {fa} frente a {fb}"
            );
        }
    }
}

/// The FS rises with `ratio` and with the OCR (the three sources), in the five methods.
#[test]
fn the_fos_rises_with_ratio_and_with_ocr() {
    let fos_for = |id: &str, shansep: Value| -> Vec<f64> {
        let mut doc = model(id);
        set_ocr(&mut doc, shansep);
        let report = run(&doc);
        METHODS.iter().map(|m| fos_of(&report, m)).collect()
    };
    for id in ["X30-F-V047a-seco-ocr1", "X30-F-V047a-humedo-ocr1"] {
        let series: Vec<(&str, Vec<Value>)> = vec![
            (
                "ratio",
                [0.20, 0.25, 0.30]
                    .iter()
                    .map(|r| json!({"ratio": r, "exponent": 0.8, "ocr": 1.5}))
                    .collect(),
            ),
            (
                "ocr",
                [1.0, 1.5, 2.0]
                    .iter()
                    .map(|o| json!({"ratio": 0.25, "exponent": 0.8, "ocr": o}))
                    .collect(),
            ),
            (
                "pop",
                [0.0, 10.0, 20.0]
                    .iter()
                    .map(|p| json!({"ratio": 0.25, "exponent": 0.8, "pop": p}))
                    .collect(),
            ),
            (
                "ocr_by_elevation",
                [1.0, 1.5, 2.0]
                    .iter()
                    .map(|o| json!({"ratio": 0.25, "exponent": 0.8, "ocr_by_elevation": [[20.0, 1.0], [35.0, o]]}))
                    .collect(),
            ),
        ];
        for (name, specs) in series {
            let runs: Vec<Vec<f64>> = specs.into_iter().map(|s| fos_for(id, s)).collect();
            for (i, method) in METHODS.iter().enumerate() {
                assert!(
                    runs[0][i] < runs[1][i] && runs[1][i] < runs[2][i],
                    "{id} {name} {method}: {} {} {}",
                    runs[0][i],
                    runs[1][i],
                    runs[2][i]
                );
            }
        }
    }
}

/// The exponent: with `exponent = 0` the OCR does not matter.
#[test]
fn with_exponent_zero_the_ocr_does_not_matter() {
    let fos_for = |ocr: f64| -> f64 {
        let mut doc = model("X30-F-V047a-seco-ocr1");
        set_ocr(
            &mut doc,
            json!({"ratio": 0.25, "exponent": 0.0, "ocr": ocr}),
        );
        run(&doc).results[0].fos.unwrap()
    };
    let (a, b) = (fos_for(1.0), fos_for(3.0));
    assert!((a - b).abs() <= 1e-12 * a, "{a} {b}");
}

// --------------------------------------------------------------------------------------------------- σ′v ≤ 0

/// `unit_weight < γw` under the water with no `unit_weight_sat`: `σ′v ≤ 0` in some slices (X30 §4). `Su = 0` there,
/// the OCR is not evaluated, and the note appears once per method.
#[test]
fn a_non_positive_stress_gives_zero_strength_and_the_note_once_per_method() {
    let report = run(&model("X30-F-sv-negativo"));
    assert_eq!(report.results.len(), METHODS.len());
    for result in &report.results {
        let count = result.warnings.iter().filter(|w| *w == NOTE).count();
        assert_eq!(count, 1, "{:?}: {:?}", result.method, result.warnings);
        let entries = entries(result);
        let negative: Vec<_> = entries.iter().filter(|e| e.1 <= 0.0).collect();
        // X30 counted 26 slices with σ′v ≤ 0 (prototype and oracle).
        assert_eq!(negative.len(), 26, "{:?}", result.method);
        for &&(index, _, ocr) in &negative {
            let s = &result.slices[index];
            assert_eq!(s.cohesion, 0.0);
            assert_eq!(s.tan_phi, 0.0);
            assert_eq!(ocr, 1.0, "the OCR is not evaluated");
        }
        for &(index, sigma_v, _) in entries.iter().filter(|e| e.1 > 0.0) {
            assert!(result.slices[index].cohesion > 0.0, "{sigma_v}");
        }
    }
}

#[test]
fn without_a_non_positive_stress_there_is_no_note() {
    for id in [
        "X30-F-V047a-seco-ocr1",
        "X30-F-V047a-humedo-ocr1.5",
        "X30-F-V105a",
    ] {
        let report = run(&model(id));
        for result in &report.results {
            assert!(
                !result.warnings.iter().any(|w| w == NOTE),
                "{id}: {:?}",
                result.warnings
            );
        }
    }
}

// --------------------------------------------------------------------------------------------------- mixed

/// A Mohr-Coulomb layer under a SHANSEP layer: only the slices whose base is in the SHANSEP layer have `Su`; the others
/// keep `c` and `φ` of the Mohr-Coulomb material, and `strength` lists exactly the SHANSEP ones.
#[test]
fn a_mohr_coulomb_layer_and_a_shansep_layer() {
    let mut doc = model("X30-F-V047a-seco-ocr1");
    doc["materials"] = json!([
        {"id": "mc", "name": "MC", "model": "mohr_coulomb", "unit_weight": 20.0,
         "cohesion": 3.0, "friction_angle": 19.6},
        {"id": "sh", "name": "SH", "model": "shansep", "unit_weight": 20.0,
         "shansep": {"ratio": 0.25, "exponent": 0.8, "ocr": 1.5}}
    ]);
    // The interface is the horizontal line y = 30; the circle has its base in the upper layer on the crest side.
    doc["regions"] = json!([
        {"material": "mc", "polygon": [[20, 20], [20, 25], [30, 25], [40, 30], [70, 30], [70, 20]]},
        {"material": "sh", "polygon": [[40, 30], [50, 35], [70, 35], [70, 30]]}
    ]);
    let report = run(&doc);
    let tan_mc = 19.6_f64.to_radians().tan();
    for result in &report.results {
        let listed: Vec<usize> = entries(result).iter().map(|e| e.0).collect();
        let by_slice: Vec<usize> = result
            .slices
            .iter()
            .enumerate()
            .filter(|(_, s)| s.weight > 0.0 && s.tan_phi == 0.0)
            .map(|(i, _)| i)
            .collect();
        assert_eq!(listed, by_slice, "{:?}", result.method);
        assert!(!listed.is_empty() && listed.len() < result.slices.len());
        for (i, s) in result.slices.iter().enumerate() {
            if s.weight > 0.0 && !listed.contains(&i) {
                assert_eq!(s.cohesion, 3.0, "{:?} slice {i}", result.method);
                assert!((s.tan_phi - tan_mc).abs() < 1e-12);
            }
        }
        for (index, sigma_v, ocr) in entries(result) {
            let s = &result.slices[index];
            assert_eq!(ocr, 1.5);
            assert!((s.cohesion - 0.25 * sigma_v * 1.5_f64.powf(0.8)).abs() < 1e-9);
            assert!((sigma_v - s.weight / s.width).abs() < 1e-9);
        }
        assert!(result.fos.is_some(), "{:?}", result.method);
    }
}

/// Independent force/moment checks on the final SHANSEP strengths (F6.11).
#[test]
fn final_shansep_strengths_close_equilibrium() {
    use ogs_core::methods::{
        effective_normal, morgenstern_price::interslice_faces, spencer::interslice_forces,
    };
    use ogs_core::model::IntersliceFunction;
    let report = run(&model("X30-F-V047a-seco-ocr1"));
    for (i, r) in report.results.iter().enumerate() {
        let f = r.fos.unwrap();
        let slices = &r.slices;
        let weight: f64 = slices.iter().map(|s| s.weight).sum();
        if i == 0 {
            let resist: f64 = slices.iter().map(|s| s.cohesion * s.base_length).sum();
            let drive: f64 = slices.iter().map(|s| s.weight * s.alpha.sin()).sum();
            assert!((resist / f - drive).abs() < 1e-9 * drive.abs());
        } else if i <= 2 {
            let lambda = r.lambda.unwrap();
            let faces = if i == 2 {
                interslice_faces(slices, IntersliceFunction::HalfSine, None)
            } else {
                vec![1.0; slices.len() + 1]
            };
            let e = interslice_forces(slices, &faces, f, lambda);
            assert!(e[slices.len()].abs() < 1e-6 * weight);
            for (px, py) in [(29.511, 53.738), (45.0, 40.0)] {
                let (mut moment, mut scale) = (0.0_f64, 0.0_f64);
                for (k, s) in slices.iter().enumerate() {
                    if s.weight == 0.0 {
                        continue;
                    }
                    let (sin, cos) = s.alpha.sin_cos();
                    let normal = effective_normal(
                        s,
                        f,
                        lambda * (faces[k + 1] * e[k + 1] - faces[k] * e[k]),
                    ) + s.pore_pressure * s.base_length;
                    let shear = s.cohesion * s.base_length / f;
                    let rx = (s.x_left + s.x_right) / 2.0 - px;
                    let ry = (s.y_base_left + s.y_base_right) / 2.0 - py;
                    moment += -rx * s.total_weight()
                        + normal * (rx * cos + ry * sin)
                        + shear * (rx * sin - ry * cos);
                    scale += (s.total_weight() * rx).abs();
                }
                println!(
                    "method {i}, point ({px}, {py}): normalized moment {}",
                    (moment / scale).abs()
                );
                assert!((moment / scale).abs() < 1e-6);
            }
        } else if i == 3 {
            let residual: f64 = slices
                .iter()
                .map(|s| {
                    let (sin, cos) = s.alpha.sin_cos();
                    let normal = effective_normal(s, f, 0.0) + s.pore_pressure * s.base_length;
                    -normal * sin + s.cohesion * s.base_length / f * cos
                })
                .sum();
            assert!(residual.abs() < 1e-6 * weight);
        }
    }
}
