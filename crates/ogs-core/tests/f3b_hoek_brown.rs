use serde_json::{Value, json};

fn fixture(name: &str) -> Value {
    let path = format!(
        "{}/tests/data/f3b/hb/X28-F-{name}.json",
        env!("CARGO_MANIFEST_DIR")
    );
    serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
}
fn analyze(model: &Value) -> Value {
    serde_json::from_str(&ogs_core::analyze_json(&model.to_string()).unwrap()).unwrap()
}

#[test]
fn product_matches_independent_full_envelope() {
    let references: Value =
        serde_json::from_str(include_str!("data/f3b/hb/reglas_coordinador.json")).unwrap();
    for name in ["X25", "HAM1", "SA", "SB"] {
        let report = analyze(&fixture(name)["model"]);
        for r in report["results"].as_array().unwrap() {
            let method = r["method"].as_str().unwrap();
            let expected = references[name][method]["cut/1e-08/w0.5"][0]
                .as_f64()
                .unwrap();
            let actual = r["fos"].as_f64().unwrap();
            let error = (actual / expected - 1.0) * 100.0;
            println!(
                "{name} {method}: referencia {expected:.6}, motor {actual:.9}, diferencia {error:+.6}%"
            );
            assert_eq!(r["status"], "converged");
            assert!(error.abs() <= 0.1);
            assert!(r["strength"]["passes"].as_u64().unwrap() > 1);
            assert!(!r["strength"]["slices"].as_array().unwrap().is_empty());
        }
    }
}

#[test]
fn r15_ru03_converges_with_full_envelope() {
    let model: Value =
        serde_json::from_str(include_str!("data/f3b/r15/hb/hb_sb_ru03.json")).unwrap();
    let report = analyze(&model);
    let results = report["results"].as_array().unwrap();
    assert_eq!(results.len(), 5);
    for r in results {
        println!(
            "RU03 {}: {} passes={}",
            r["method"], r["fos"], r["strength"]["passes"]
        );
        assert_eq!(r["status"], "converged", "{r}");
        let f = r["fos"].as_f64().unwrap();
        assert!(f > 0.0);
        if r["method"] == "bishop" {
            assert!(f < 0.9618);
        }
        if r["method"] == "spencer" || r["method"] == "morgenstern_price" {
            assert!(f < 1.0103);
        }
    }
}

#[test]
fn mixed_mohr_coulomb_and_hoek_brown() {
    fn clip(points: &[[f64; 2]], cut: f64, left: bool) -> Vec<[f64; 2]> {
        let inside = |p: [f64; 2]| if left { p[0] <= cut } else { p[0] >= cut };
        let mut out = Vec::new();
        for i in 0..points.len() {
            let a = points[i];
            let b = points[(i + 1) % points.len()];
            if inside(a) {
                out.push(a);
            }
            if inside(a) != inside(b) {
                let t = (cut - a[0]) / (b[0] - a[0]);
                out.push([cut, a[1] + t * (b[1] - a[1])]);
            }
        }
        out
    }
    let mut model = fixture("SA")["model"].clone();
    let polygon: Vec<[f64; 2]> =
        serde_json::from_value(model["regions"][0]["polygon"].clone()).unwrap();
    model["regions"] = json!([
        {"material":"suelo", "polygon":clip(&polygon,25.0,true)},
        {"material":"roca", "polygon":clip(&polygon,25.0,false)}
    ]);
    model["materials"].as_array_mut().unwrap().push(json!({"id":"suelo", "name":"suelo", "model":"mohr_coulomb", "unit_weight":25.0, "cohesion":10.0, "friction_angle":30.0}));
    let report = analyze(&model);
    let slices = report["results"][0]["slices"].as_array().unwrap();
    let mc: Vec<_> = slices.iter().filter(|s| s["material"] == 1).collect();
    let hb: Vec<_> = slices.iter().filter(|s| s["material"] == 0).collect();
    assert!(!mc.is_empty() && !hb.is_empty());
    for s in mc {
        assert_eq!(s["cohesion"], 10.0);
        assert!((s["tan_phi"].as_f64().unwrap() - 30.0_f64.to_radians().tan()).abs() < 1e-12);
    }
}

#[test]
fn final_strength_closes_equilibrium() {
    use ogs_core::methods::{effective_normal, spencer::interslice_forces};
    use ogs_core::model::Model;
    let mut doc = fixture("SA")["model"].clone();
    doc["analysis"]["tolerance"] = json!(1e-10);
    let model: Model = serde_json::from_value(doc).unwrap();
    let report = ogs_core::analyze(&model).unwrap();
    for r in &report.results {
        let f = r.fos.unwrap() / r.correction_factor.unwrap_or(1.0);
        let slices = &r.slices;
        let faces = vec![1.0; slices.len() + 1];
        let lambda = r.lambda.unwrap_or(0.0);
        let e = interslice_forces(slices, &faces, f, lambda);
        let mut horizontal = 0.0;
        let mut moment = 0.0;
        let mut driving = 0.0;
        let xc = 11.064761108572334;
        let yc = 35.672573017328205;
        let mut bishop_resist = 0.0;
        for (k, s) in slices.iter().enumerate() {
            let (sin, cos) = s.alpha.sin_cos();
            let n_eff = effective_normal(s, f, lambda * (e[k + 1] - e[k]));
            let n = n_eff + s.pore_pressure * s.base_length;
            let shear = (s.cohesion * s.base_length + n_eff * s.tan_phi) / f;
            horizontal += -n * sin + shear * cos - s.h_force;
            let rx = (s.x_left + s.x_right) * 0.5 - xc;
            let ry = (s.y_base_left + s.y_base_right) * 0.5 - yc;
            moment += -rx * s.total_weight()
                + s.h_force * ry
                + s.h_moment_base
                + n * (rx * cos + ry * sin)
                + shear * (rx * sin - ry * cos);
            driving += (rx * s.total_weight()).abs();
            bishop_resist += s.cohesion * s.base_length + n_eff * s.tan_phi - f * s.driving_term();
        }
        let scale: f64 = slices.iter().map(|s| s.weight).sum();
        match r.method {
            ogs_core::model::MethodKind::Bishop => assert!(
                bishop_resist.abs() / scale < 1e-9,
                "bishop {}",
                bishop_resist / scale
            ),
            ogs_core::model::MethodKind::Spencer
            | ogs_core::model::MethodKind::MorgensternPrice => {
                assert!(
                    horizontal.abs() / scale < 1e-6,
                    "force {}",
                    horizontal / scale
                );
                assert!(moment.abs() / driving < 1e-6, "moment {}", moment / driving);
            }
            _ => assert!(
                horizontal.abs() / scale < 1e-6,
                "janbu {}",
                horizontal / scale
            ),
        }
    }
}

#[test]
fn mirror_and_confinement_note() {
    let model = fixture("SB")["model"].clone();
    let original = analyze(&model);
    assert!(
        original["results"][0]["warnings"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v == "hoek_brown_low_confinement")
    );
    let mut mirror = model.clone();
    for region in mirror["regions"].as_array_mut().unwrap() {
        for point in region["polygon"].as_array_mut().unwrap() {
            point[0] = json!(-point[0].as_f64().unwrap());
        }
    }
    mirror["analysis"]["surface"]["xc"] =
        json!(-model["analysis"]["surface"]["xc"].as_f64().unwrap());
    mirror["slope"]["direction"] = json!("left_to_right");
    let reflected = analyze(&mirror);
    for (a, b) in original["results"]
        .as_array()
        .unwrap()
        .iter()
        .zip(reflected["results"].as_array().unwrap())
    {
        let difference = (a["fos"].as_f64().unwrap() - b["fos"].as_f64().unwrap()).abs();
        assert!(difference <= 1e-9, "{}: {difference}", a["method"]);
    }
    let x25 = analyze(&fixture("X25")["model"]);
    assert!(
        !x25["results"][1]["warnings"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v == "hoek_brown_low_confinement")
    );
}

#[test]
fn gsi_ucs_and_disturbance_monotonicity() {
    let model = fixture("X25")["model"].clone();
    let fs = |m: &Value| analyze(m)["results"][0]["fos"].as_f64().unwrap();
    let base = fs(&model);
    for (field, value, rises) in [
        ("gsi", 25.0, true),
        ("ucs", 6000.0, true),
        ("disturbance", 0.5, false),
    ] {
        let mut altered = model.clone();
        altered["materials"][0][field] = json!(value);
        assert_eq!(fs(&altered) > base, rises, "{field}");
    }
}
