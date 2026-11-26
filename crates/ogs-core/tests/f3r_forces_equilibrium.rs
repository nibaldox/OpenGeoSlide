//! R1-C: global equilibrium **independent of the solver**, with active reinforcements (F4.12, E14f).
//!
//! The test takes the converged `(F, λ)` of Spencer and of Morgenstern-Price (`constant` function, `X = λ·E`) and the
//! slices of the report, and rebuilds the forces on the sliding mass from the physics:
//! - the soil weights `W` at the midpoint of each slice;
//! - the forces of the reinforcements **as the report gives them** (`x`, `y`, `fx`, `fy`, model coordinates), each
//!   one added to the slice that contains `x` (`W* = W − Fy`, `H = s·Fx`);
//! - the normal and shear forces of the base at the midpoint of the base, from the closed form of `ΔE` (X1 §3.2).
//!
//! With `E_0 = E_n = 0` and `X_0 = X_n = 0` the interslice forces cancel, so the sum of the forces and the moment
//! about two points must vanish. The residual is below `1e-6` of the scale (the sum of the moduli of the forces, and
//! of the moments about the same point).
//!
//! Active forces only (the passive ones need R1-M).

mod f3_common;

use f3_common::*;
use ogs_core::model::Model;
use ogs_core::report::{AnalysisReport, MethodReport};
use serde_json::{Value, json};

fn analyze_doc(doc: &Value) -> AnalysisReport {
    let model: Model = match serde_json::from_value(doc.clone()) {
        Ok(m) => m,
        Err(e) if e.to_string().contains("location") => {
            let mut d = doc.clone();
            for r in d["reinforcements"].as_array_mut().unwrap() {
                if matches!(r["type"].as_str(), Some("pile" | "sheet_pile")) {
                    r["location"] = json!("slip_surface");
                }
            }
            serde_json::from_value(d).expect("parse with location")
        }
        Err(e) => panic!("the document does not parse: {e}"),
    };
    ogs_core::analyze(&model).unwrap_or_else(|e| panic!("analysis failed: {e}"))
}

/// `D = F (cos α + λ sin α) + (sin α − λ cos α) tan φ`.
fn denominator(f: f64, lambda: f64, sin: f64, cos: f64, tan_phi: f64) -> f64 {
    (sin - lambda * cos) * tan_phi + (cos + lambda * sin) * f
}

struct Balance {
    e_n: f64,
    total_w: f64,
    /// `(ΣFx, ΣFy)` and their scale.
    force: [f64; 2],
    force_scale: f64,
    /// Moments about the two points, and their scales.
    moment: [f64; 2],
    moment_scale: [f64; 2],
}

fn balance(r: &MethodReport, s_dir: f64, about: [[f64; 2]; 2]) -> Balance {
    let (f, lambda) = (r.fos.unwrap(), r.lambda.unwrap());
    let mut loads: Vec<([f64; 2], [f64; 2])> = Vec::new(); // (point, force)
    let (mut e_n, mut total_w) = (0.0_f64, 0.0_f64);
    for (i, s) in r.slices.iter().enumerate() {
        let (sin, cos) = s.alpha.sin_cos();
        let xm = 0.5 * (s.x_left + s.x_right);
        let ym = 0.5 * (s.y_base_left + s.y_base_right);
        // The forces of the reinforcements that act on this soil slice: the first soil slice (from the toe) whose
        // closed interval contains x.
        let mut w_star = s.weight;
        let mut h = 0.0;
        for rf in &r.reinforcement_forces {
            if rf.fx == 0.0 && rf.fy == 0.0 {
                continue;
            }
            let first = r
                .slices
                .iter()
                .position(|q| q.weight > 0.0 && q.x_left <= rf.x && rf.x <= q.x_right)
                .expect("a soil slice holds the crossing");
            if first == i {
                w_star += -rf.fy;
                h += s_dir * rf.fx;
                loads.push(([rf.x, rf.y], [rf.fx, rf.fy]));
            }
        }
        total_w += s.weight;
        if s.weight > 0.0 {
            loads.push(([xm, ym], [0.0, -s.weight]));
        }
        let l = s.base_length;
        let resist = (w_star * cos - s.pore_pressure * l) * s.tan_phi + s.cohesion * l;
        let d = denominator(f, lambda, sin, cos, s.tan_phi);
        let de = if s.weight == 0.0 {
            0.0
        } else {
            (f * w_star * sin - resist + (f * cos + s.tan_phi * sin) * h) / d
        };
        let n_eff = w_star * cos - s.pore_pressure * l - h * sin + (sin - lambda * cos) * de;
        let shear = (s.cohesion * l + n_eff * s.tan_phi) / f;
        let normal = n_eff + s.pore_pressure * l;
        e_n += de;
        if s.weight > 0.0 {
            // Base force on the mass at the midpoint of the base: N along the normal toward the mass, S against the
            // movement `m = (s cos α, −sin α)`.
            let n_vec = [s_dir * sin, cos];
            let m = [s_dir * cos, -sin];
            let fx = normal * n_vec[0] - shear * m[0];
            let fy = normal * n_vec[1] - shear * m[1];
            loads.push(([xm, ym], [fx, fy]));
        }
    }
    let force = [
        loads.iter().map(|l| l.1[0]).sum::<f64>(),
        loads.iter().map(|l| l.1[1]).sum::<f64>(),
    ];
    let force_scale = loads.iter().map(|l| l.1[0].hypot(l.1[1])).sum::<f64>();
    let moment_about = |o: [f64; 2]| -> (f64, f64) {
        let terms: Vec<f64> = loads
            .iter()
            .map(|(p, fo)| (p[0] - o[0]) * fo[1] - (p[1] - o[1]) * fo[0])
            .collect();
        (terms.iter().sum(), terms.iter().map(|t| t.abs()).sum())
    };
    let (m0, s0) = moment_about(about[0]);
    let (m1, s1) = moment_about(about[1]);
    Balance {
        e_n,
        total_w,
        force,
        force_scale,
        moment: [m0, m1],
        moment_scale: [s0, s1],
    }
}

fn base_doc(reinforcements: Value, ltr: bool) -> Value {
    let mut doc = v047a(json!(["spencer", "morgenstern_price"]));
    doc["version"] = json!("0.4");
    doc["analysis"]["interslice"] = json!({"function": "constant"});
    doc["analysis"]["tolerance"] = json!(1e-12);
    doc["reinforcements"] = reinforcements;
    if ltr {
        let mut m = mirror(&doc);
        for e in m["reinforcements"].as_array_mut().unwrap() {
            for k in ["x1", "x2"] {
                e[k] = json!(-e[k].as_f64().unwrap());
            }
        }
        m["version"] = json!("0.4");
        return m;
    }
    doc
}

fn scenarios() -> Vec<(&'static str, Value)> {
    let tension = |id: &str, tip: [f64; 2], direction: &str, extra: Value| {
        let mut e = json!({"type": "anchor", "id": id, "x1": 36, "y1": 28, "x2": tip[0], "y2": tip[1],
            "application": "active", "tensile_capacity": 100, "direction": direction});
        for (k, v) in extra.as_object().unwrap() {
            e[k] = v.clone();
        }
        e
    };
    vec![
        (
            "row1 horizontal anchor",
            json!([{"type": "anchor", "id": "A1", "x1": 52, "y1": 28, "x2": 25, "y2": 28,
                    "application": "active", "tensile_capacity": 100, "direction": "axial"}]),
        ),
        (
            "down30 axial",
            json!([tension("A1", [59.382686, 14.5], "axial", json!({}))]),
        ),
        (
            "down30 tangent",
            json!([tension("A1", [59.382686, 14.5], "tangent", json!({}))]),
        ),
        (
            "down30 bisector",
            json!([tension("A1", [59.382686, 14.5], "bisector", json!({}))]),
        ),
        (
            "up15 axial",
            json!([tension("A1", [62.079997, 34.988114], "axial", json!({}))]),
        ),
        (
            "pile angle 20",
            json!([{"type": "pile", "id": "P1", "x1": 40, "y1": 33, "x2": 40, "y2": 22,
                    "application": "active", "force": 60, "spacing": 1.5,
                    "direction": "angle", "angle": 20}]),
        ),
        (
            "sheet pile tangent",
            json!([{"type": "sheet_pile", "id": "S1", "x1": 44, "y1": 34, "x2": 44, "y2": 22,
                    "application": "active", "force": 120, "direction": "tangent"}]),
        ),
        (
            "two crossings, one compressed (u = d)",
            json!([{"type": "anchor", "id": "A1", "x1": 48.0, "y1": 30.06, "x2": 26.0, "y2": 22.06,
                    "application": "active", "tensile_capacity": 50, "direction": "axial"}]),
        ),
        (
            "compressed active, tangent",
            json!([{"type": "anchor", "id": "A1", "x1": 38.94, "y1": 25.33, "x2": 45.06, "y2": 30.47,
                    "application": "active", "tensile_capacity": 100, "direction": "tangent"}]),
        ),
        (
            "three elements",
            json!([
                {"type": "anchor", "id": "A1", "x1": 52, "y1": 28, "x2": 25, "y2": 28,
                 "application": "active", "tensile_capacity": 80, "direction": "axial"},
                {"type": "nail", "id": "N1", "x1": 38, "y1": 26, "x2": 60, "y2": 20,
                 "application": "active", "tensile_capacity": 40, "spacing": 2, "direction": "bisector",
                 "pullout": {"model": "bond", "strength": 15}},
                {"type": "pile", "id": "P1", "x1": 34, "y1": 30, "x2": 34, "y2": 22,
                 "application": "active", "force": 30, "direction": "perpendicular"}
            ]),
        ),
    ]
}

#[test]
fn global_equilibrium_with_active_reinforcements_spencer_and_mp() {
    let mut worst = 0.0_f64;
    for ltr in [false, true] {
        for (label, reinforcements) in scenarios() {
            let doc = base_doc(reinforcements, ltr);
            let report = analyze_doc(&doc);
            let s_dir = if ltr { 1.0 } else { -1.0 };
            for r in &report.results {
                assert!(r.fos.is_some(), "{label}: {:?}", r.status);
                assert!(
                    !r.reinforcement_forces.is_empty(),
                    "{label}: the element must cross the surface"
                );
                // Two points about which the moments are taken: the centre of the circle and another one.
                let (cx, cy) = (if ltr { -CIRCLE.0 } else { CIRCLE.0 }, CIRCLE.1);
                let b = balance(r, s_dir, [[cx, cy], [cx + 15.0, cy - 12.0]]);
                let tag = format!(
                    "{label} ({}) {:?}",
                    if ltr { "ltr" } else { "rtl" },
                    r.method
                );
                let res = [
                    b.force[0].abs() / b.force_scale,
                    b.force[1].abs() / b.force_scale,
                    b.moment[0].abs() / b.moment_scale[0],
                    b.moment[1].abs() / b.moment_scale[1],
                ];
                println!(
                    "{tag:<62} F={:.6} λ={:+.4} E_n/ΣW={:+.1e} ΣFx={:.1e} ΣFy={:.1e} M0={:.1e} M1={:.1e}",
                    r.fos.unwrap(),
                    r.lambda.unwrap(),
                    b.e_n / b.total_w,
                    res[0],
                    res[1],
                    res[2],
                    res[3]
                );
                assert!(b.e_n.abs() <= 1e-6 * b.total_w, "{tag}: E_n = {:e}", b.e_n);
                for (name, v) in ["ΣFx", "ΣFy", "M0", "M1"].iter().zip(res) {
                    assert!(v < 1e-6, "{tag}: {name} residual {v:e}");
                    worst = worst.max(v);
                }
            }
        }
    }
    println!("worst residual = {worst:.2e}");
}

/// The test above discriminates: without the force of the reinforcement in the balance, or with the wrong sign of
/// its vertical component, it would fail. Checked here on the same model by dropping the force from the balance.
#[test]
fn the_balance_detects_a_missing_force() {
    let doc = base_doc(scenarios()[1].1.clone(), false);
    let mut report = analyze_doc(&doc);
    let r = &mut report.results[0];
    // Drop the forces from the report: the weights and the base forces no longer balance.
    r.reinforcement_forces.iter_mut().for_each(|f| {
        f.fx = 0.0;
        f.fy = 0.0;
    });
    let b = balance(
        r,
        -1.0,
        [[CIRCLE.0, CIRCLE.1], [CIRCLE.0 + 15.0, CIRCLE.1 - 12.0]],
    );
    let worst = (b.force[0].abs() / b.force_scale)
        .max(b.moment[0].abs() / b.moment_scale[0])
        .max(b.moment[1].abs() / b.moment_scale[1]);
    assert!(worst > 1e-3, "a missing force must show, got {worst:e}");
}
