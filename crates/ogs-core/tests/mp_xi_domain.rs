//! D-2: the domain of ξ of Morgenstern-Price (E13j-1) is the **soil block**: `x₀`/`x₁` are the ends of the slices that
//! carry soil, not of the aerial slices that E7a keeps at the ends of a circle grazing the ground (cSlope has no aerial
//! slices, so its `x₀ = slices[0].x_left` and `x₁ = slices[last].x_right` are those of the soil).

use serde_json::json;

/// D09 (R2-03 slope, c = 2, φ = 45°, r_u = 0.65, circle that grazes the flat toe): the arc runs over the ground from
/// x = 10.59 to x = 15.77, so the first 15 of the 50 slices are aerial and the soil block runs 15.77 … 30.59. With the
/// aerial slices in the domain ξ ran over 10.59 … 30.59, and a half sine ran +3.39 % over cSlope.
fn d09(method: &str, function: Option<&str>) -> serde_json::Value {
    let mut analysis = json!({
        "methods": [method], "slices": 50, "tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2,
        "surface": {"type": "circle", "xc": 10.77159214833143, "yc": 39.640974335435686, "r": 24.641649084951563}
    });
    if let Some(f) = function {
        analysis["interslice"] = json!({ "function": f });
    }
    let doc = json!({
        "format": "opengeoslide", "version": "0.3",
        "meta": {"id": "D09", "title": "Talud R2-03, círculo que roza el pie"},
        "units": "SI",
        "materials": [{"id": "soil", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 2.0, "friction_angle": 45.0, "ru": 0.65}],
        "regions": [{"material": "soil", "polygon": [[0.0, 0.0], [0.0, 15.0], [15.0, 15.0], [30.0, 25.0], [60.0, 25.0], [60.0, 0.0]]}],
        "water": {"unit_weight": 9.807},
        "slope": {"direction": "auto"},
        "analysis": analysis
    });
    serde_json::from_str(&ogs_core::analyze_json(&doc.to_string()).unwrap()).unwrap()
}

fn fos(method: &str, function: Option<&str>) -> (f64, String) {
    let r = d09(method, function);
    let res = &r["results"][0];
    (
        res["fos"].as_f64().unwrap_or(f64::NAN),
        res["status"].as_str().unwrap().to_string(),
    )
}

/// cSlope 0.1.0 (`Morgenstern-Price`, `intersliceFunction` half-sine / clipped-sine / trapezoidal), same circle, 50 slices.
#[test]
fn xi_of_the_interslice_function_runs_over_the_soil_block_not_over_the_aerial_slices_of_d09() {
    for (function, oracle) in [
        ("half_sine", 0.4253437074086093),
        ("clipped_sine", 0.4254650624848855),
        ("trapezoidal", 0.42836872032784473),
    ] {
        let (f, status) = fos("morgenstern_price", Some(function));
        assert_eq!(status, "converged", "{function}");
        assert!(
            (f - oracle).abs() / oracle < 1e-3,
            "M-P {function}: {f} against cSlope {oracle} ({:+.3} %)",
            100.0 * (f - oracle) / oracle
        );
    }
}

/// With `constant` the function is 1 everywhere: the domain does not enter and M-P is Spencer, as before.
#[test]
fn constant_m_p_still_is_spencer_on_d09() {
    let (m, _) = fos("morgenstern_price", Some("constant"));
    let (s, _) = fos("spencer", None);
    assert!(
        (m - s).abs() <= 1e-10,
        "M-P constant {m} against Spencer {s}"
    );
}
