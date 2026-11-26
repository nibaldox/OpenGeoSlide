//! Spencer and Morgenstern-Price (F3a closure, C-M): a root of the λ scan that lies between the last λ where the force
//! root `F_f(λ)` exists and the next grid point, where it does not (the root of the closure leaves the admissible
//! region, `F < lower(λ)`).
//!
//! The grid sees a defined point followed by an undefined one, so there is no sign change to bracket and the result was
//! `no_lambda_root`, while the equilibrium solution sits just before the edge. The oracle (cSlope, Morgenstern-Price
//! `constant` = Spencer) converges on the same polyline: 2.1798508290832195.
//!
use ogs_core::analyze_json;
use serde_json::{Value, json};

fn model(points: Value, methods: Value) -> Value {
    let mut doc = json!({
        "format": "opengeoslide", "version": "0.3",
        "meta": {"id": "scan-edge", "title": "Polilínea con raíz de λ junto al borde admisible"},
        "units": "SI",
        "materials": [
            {"id": "suelo", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 10.0, "friction_angle": 30.0},
            {"id": "e2", "name": "Roca", "model": "undrained", "unit_weight": 24.0, "undrained_strength": 30.0,
             "strength_datum": -3.0, "strength_gradient": 2.5, "strength_limit": 90.0}
        ],
        "regions": [
            {"material": "suelo", "polygon": [[0.0, -3.0], [40.0, -3.0], [40.0, 0.0], [20.0, 0.0], [10.0, 10.0], [0.0, 10.0]]},
            {"material": "e2", "polygon": [[0.0, -10.0], [40.0, -10.0], [40.0, -3.0], [0.0, -3.0]]}
        ],
        "slope": {"direction": "left_to_right"},
        "analysis": {"methods": methods, "slices": 50, "tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2,
                     "surface": {"type": "polyline", "points": points}}
    });
    if methods
        .as_array()
        .unwrap()
        .iter()
        .any(|m| m == "morgenstern_price")
    {
        doc["analysis"]["interslice"] = json!({"function": "constant"});
    }
    doc
}

fn run(doc: &Value) -> Value {
    serde_json::from_str(&analyze_json(&doc.to_string()).expect("analysis")).unwrap()
}

fn points() -> Value {
    json!([
        [6.32, 9.95],
        [12.829, 4.12],
        [16.853, -1.539],
        [26.06, -0.807],
        [26.923, -0.05]
    ])
}

fn with_min_m_alpha(mut doc: Value, m: f64) -> Value {
    doc["analysis"]["min_m_alpha"] = json!(m);
    doc
}

#[test]
fn the_guard_on_phi_over_f_is_what_stops_spencer_on_this_polyline() {
    let r = run(&model(points(), json!(["spencer"])));
    let res = &r["results"][0];
    assert_eq!(res["status"], "not_converged");
    assert_eq!(res["warnings"], json!(["no_lambda_root"]));
}

#[test]
fn with_a_lower_min_m_alpha_spencer_reaches_the_oracle_value() {
    let r = run(&with_min_m_alpha(model(points(), json!(["spencer"])), 0.15));
    let res = &r["results"][0];
    assert_eq!(
        res["status"], "converged",
        "{} {}",
        res["status"], res["warnings"]
    );
    let f = res["fos"].as_f64().unwrap();
    assert!(
        (f - 2.179_850_829_083_219_5).abs() / 2.18 < 5e-4,
        "Spencer {f} against cSlope 2.17985083"
    );
    let l = res["lambda"].as_f64().unwrap();
    assert!(
        (l - 0.4587).abs() < 2e-3,
        "lambda {l} against cSlope 0.4587"
    );
}

#[test]
fn morgenstern_price_constant_equals_spencer_on_that_polyline_with_the_lower_min_m_alpha() {
    let r = run(&with_min_m_alpha(
        model(points(), json!(["spencer", "morgenstern_price"])),
        0.15,
    ));
    let (s, m) = (
        r["results"][0]["fos"].as_f64().unwrap(),
        r["results"][1]["fos"].as_f64().unwrap(),
    );
    assert!(
        (s - m).abs() <= 1e-10,
        "Spencer {s} against M-P constant {m}"
    );
}

/// W1e: fixed circle on an undrained slope (Su = 40, γ = 20, H = 10, 45°), the rounded critical circle of the search.
/// Spencer gives `no_lambda_root` in the web and the CLI. cSlope (Morgenstern-Price `constant`) does not converge either
/// ("cohesion along a nearly vertical base can only hold it with tension": the circle enters at 73°), so it is a
/// surface without an admissible equilibrium, not a defect. Bishop (1.17460) and Janbu simplified (1.23776, cSlope
/// 1.23797) do converge.
#[test]
fn the_undrained_fixed_circle_of_w1e_has_no_spencer_equilibrium_and_the_oracle_agrees() {
    let doc = json!({
        "format": "opengeoslide", "version": "0.3",
        "meta": {"id": "talud-simple", "title": "Talud simple H = 10 m, β = 45°"},
        "units": "SI",
        "materials": [{"id": "suelo", "name": "Suelo", "model": "undrained", "unit_weight": 20.0, "undrained_strength": 40.0}],
        "regions": [{"material": "suelo", "polygon": [[0.0, -10.0], [40.0, -10.0], [40.0, 0.0], [20.0, 0.0], [10.0, 10.0], [0.0, 10.0]]}],
        "slope": {"direction": "left_to_right"},
        "analysis": {"methods": ["bishop", "spencer", "janbu_simplified"], "slices": 50, "tolerance": 1e-5, "max_iterations": 500,
                     "min_m_alpha": 0.2, "surface": {"type": "circle", "xc": 15.6514712047, "yc": 14.3284192964, "r": 14.9737537784}}
    });
    let r = run(&doc);
    let res = r["results"].as_array().unwrap();
    assert_eq!(res[1]["status"], "not_converged");
    assert_eq!(res[1]["warnings"], json!(["no_lambda_root"]));
    assert!((res[0]["fos"].as_f64().unwrap() - 1.174_595_386).abs() < 1e-6);
    assert!((res[2]["fos"].as_f64().unwrap() - 1.237_759_6).abs() < 1e-5);
}
