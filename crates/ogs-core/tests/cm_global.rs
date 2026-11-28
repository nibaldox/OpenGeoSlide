use serde_json::{Value, json};

fn model() -> Value {
    let mut m: Value = serde_json::from_str(include_str!(
        "../../../verification/global/models/V053.json"
    ))
    .unwrap();
    m["version"] = json!("0.7");
    m["analysis"]["search"]["non_circular"] = json!({});
    m
}

#[test]
fn global_is_monotone_and_deterministic() {
    let mut m = model();
    let base: Value =
        serde_json::from_str(&ogs_core::analyze_json(&m.to_string()).unwrap()).unwrap();
    m["analysis"]["search"]["non_circular"]["global"] =
        json!({"generated":50,"seed":0,"polish":false});
    let a = ogs_core::analyze_json(&m.to_string()).unwrap();
    let b = ogs_core::analyze_json(&m.to_string()).unwrap();
    assert_eq!(a, b);
    let result: Value = serde_json::from_str(&a).unwrap();
    assert!(
        result["results"][0]["fos"].as_f64().unwrap()
            <= base["results"][0]["fos"].as_f64().unwrap()
    );
    let g = &result["results"][0]["search"]["non_circular"]["global"];
    assert!(g["generated"].as_u64().unwrap() <= 50);
    assert!(g["refined"].as_u64().unwrap() <= 3);
}

fn model_of(text: &str) -> Value {
    let v: Value = serde_json::from_str(text).unwrap();
    v.get("model").cloned().unwrap_or(v)
}

fn v053() -> Value {
    model_of(include_str!(
        "../../../verification/global/models/V053.json"
    ))
}
fn v051() -> Value {
    model_of(include_str!(
        "../../../verification/global/models/V051.json"
    ))
}
fn homogeneous() -> Value {
    model_of(include_str!("../../../verification/cases/V001-nc.json"))
}

/// The model in v0.7 with `global` set as given (`None`: the plain v0.6 refinement of the same model).
fn with_global(mut m: Value, global: Option<Value>) -> Value {
    match global {
        Some(g) => {
            m["version"] = json!("0.7");
            m["analysis"]["search"]["non_circular"]["global"] = g;
        }
        None => {
            m["analysis"]["search"]["non_circular"]
                .as_object_mut()
                .unwrap()
                .remove("global");
        }
    }
    m
}

fn analyze(m: &Value) -> (String, Value) {
    let text = ogs_core::analyze_json(&m.to_string()).unwrap();
    let r: Value = serde_json::from_str(&text).unwrap();
    (text, r["results"][0].clone())
}

fn warnings(r: &Value) -> Vec<String> {
    r["warnings"]
        .as_array()
        .unwrap()
        .iter()
        .map(|w| w.as_str().unwrap().to_string())
        .collect()
}

fn stats(r: &Value) -> Value {
    r["search"]["non_circular"]["global"].clone()
}

#[test]
fn v053_defaults_reach_the_published_band_and_report_every_counter() {
    let (_, r) = analyze(&with_global(v053(), Some(json!({}))));
    let g = stats(&r);
    // A2: published 1.01 ± 3.5 %.
    assert!(r["fos"].as_f64().unwrap() <= 1.01 * 1.035, "{}", r["fos"]);
    assert_eq!(g["algorithm"], "block");
    assert_eq!(g["winner"], "global");
    assert_eq!(g["tension_rejected"], 0);
    assert_eq!(g["global_fos"], r["fos"]);
    let n = |k: &str| g[k].as_u64().unwrap();
    assert!(n("generated") <= 500 && n("attempts") <= 20 * 500);
    assert_eq!(n("converged"), n("eligible") + n("tension_rejected"));
    assert!(n("refined") >= 1 && n("refined") <= 3);
    assert!(n("evaluated") > n("generated") && n("evaluated") <= 500 + 3 * 1500 + 3000);
    assert!(n("polish_evaluated") > 0 && n("polish_evaluated") <= 3000);
    assert!(
        r["surface"]["points"].as_array().unwrap().len() >= 5,
        "the winner is a polyline"
    );
    assert!(!warnings(&r).contains(&"non_circular_global_no_candidates".to_string()));
}

#[test]
fn golden_v053_is_the_same_with_and_without_parallel() {
    // The suite runs with and without `--features parallel`: these figures are the same in both.
    let m = with_global(
        v053(),
        Some(json!({"generated": 50, "seed": 0, "polish": false})),
    );
    let (a, r) = analyze(&m);
    let (b, _) = analyze(&m);
    assert_eq!(a, b, "two runs are byte-identical");
    assert!((r["fos"].as_f64().unwrap() - 1.0058226239153714).abs() < 1e-9);
    let g = stats(&r);
    for (key, value) in [
        ("generated", 50),
        ("attempts", 285),
        ("converged", 22),
        ("eligible", 22),
        ("evaluated", 2240),
        ("polish_evaluated", 0),
    ] {
        assert_eq!(g[key], value, "{key}");
    }
}

#[test]
fn global_never_ends_above_the_refinement() {
    for (name, m) in [
        ("V053", v053()),
        ("V051", v051()),
        ("V001-nc", homogeneous()),
    ] {
        let (_, base) = analyze(&with_global(m.clone(), None));
        let (_, with) = analyze(&with_global(m, Some(json!({"generated": 50}))));
        let (f0, f1) = (base["fos"].as_f64().unwrap(), with["fos"].as_f64().unwrap());
        assert!(f1 <= f0, "{name}: {f1} > {f0}");
        if stats(&with)["winner"] == "refinement" {
            assert_eq!(
                f1, f0,
                "{name}: refinement wins, so the result is the v0.6 one"
            );
            assert_eq!(with["surface"], base["surface"], "{name}");
        } else {
            assert!(f1 < f0 - 1e-6, "{name}");
        }
    }
}

#[test]
fn auto_chooses_block_only_with_contacts_and_annealing_otherwise() {
    // E17a: V053 has contacts; the homogeneous slope has none, so `auto` runs the annealing from the seed circle.
    let (_, layered) = analyze(&with_global(v053(), Some(json!({"generated": 50}))));
    assert_eq!(stats(&layered)["algorithm"], "block");
    let (_, plain) = analyze(&with_global(homogeneous(), Some(json!({"generated": 50}))));
    let g = stats(&plain);
    assert_eq!(g["algorithm"], "annealing");
    assert_eq!(g["generated"], 50);
    assert!(g["evaluated"].as_u64().unwrap() > 0);
    // An explicit `block` keeps the bases and never recurs to the annealing: no candidates, the note, the v0.6 result.
    let (_, base) = analyze(&with_global(homogeneous(), None));
    let (_, forced) = analyze(&with_global(
        homogeneous(),
        Some(json!({"algorithm": "block", "generated": 50})),
    ));
    let g = stats(&forced);
    assert_eq!(g["algorithm"], "block");
    assert_eq!(
        (g["generated"].as_u64(), g["eligible"].as_u64()),
        (Some(0), Some(0))
    );
    assert_eq!(g["attempts"], 20 * 50);
    assert_eq!(g["winner"], "refinement");
    assert_eq!(g["global_fos"], Value::Null);
    assert!(warnings(&forced).contains(&"non_circular_global_no_candidates".to_string()));
    assert_eq!(forced["fos"], base["fos"]);
}

#[test]
fn annealing_is_deterministic_and_depends_on_the_seed() {
    let run = |seed: u64| {
        analyze(&with_global(
            homogeneous(),
            Some(json!({"algorithm": "annealing", "generated": 50, "seed": seed})),
        ))
    };
    let (a, ra) = run(0);
    let (b, _) = run(0);
    assert_eq!(a, b);
    let (_, rc) = run(5);
    assert_ne!(stats(&ra)["global_fos"], stats(&rc)["global_fos"]);
}

#[test]
fn v051_guard_keeps_the_factor_above_the_false_tension_branch() {
    // X37 §4.2: without the guard the global search wins with 0.630 (cSlope: 1.048) on a surface with λ < 0.
    let (_, r) = analyze(&with_global(v051(), Some(json!({}))));
    assert!(r["fos"].as_f64().unwrap() >= 0.69, "{}", r["fos"]);
    let g = stats(&r);
    assert!(g["tension_rejected"].as_u64().unwrap() > 0);
    // A global winner is never one of the guarded notes; a rejected FS under the reported one is told.
    if g["winner"] == "global" {
        let w = warnings(&r);
        assert!(!w.contains(&"negative_lambda".to_string()));
        assert!(!w.contains(&"negative_effective_normal_major".to_string()));
    }
    assert!(warnings(&r).contains(&"non_circular_global_tension_rejected".to_string()));
    // The surface of V051 with λ < 0 evaluates with the note when it is fixed: it is what the guard excludes.
    let fixed: Value = serde_json::from_str(include_str!(
        "../../../verification/global/models/V051-negative-lambda.json"
    ))
    .unwrap();
    let (_, fixed) = analyze(&fixed);
    assert!(warnings(&fixed).contains(&"negative_lambda".to_string()));
    assert!(fixed["fos"].as_f64().unwrap() < r["fos"].as_f64().unwrap());
}

#[test]
fn no_global_no_stats_and_the_same_output_as_v06() {
    let (text, r) = analyze(&with_global(v053(), None));
    assert!(r["search"]["non_circular"].get("global").is_none());
    assert!(!text.contains("non_circular_global"));
}

fn repro(text: &str) -> Value {
    serde_json::from_str(text).unwrap()
}
fn repro_01() -> Value {
    repro(include_str!(
        "../../../verification/global/repro/repro_01_project_hang.ogs.json"
    ))
}
fn repro_02() -> Value {
    repro(include_str!(
        "../../../verification/global/repro/repro_02_max_vertices_9.ogs.json"
    ))
}
fn repro_03() -> Value {
    repro(include_str!(
        "../../../verification/global/repro/repro_03_all_hb_auto_bases.ogs.json"
    ))
}
fn repro_04() -> Value {
    repro(include_str!(
        "../../../verification/global/repro/repro_04_tension_note_zero_count.ogs.json"
    ))
}
fn repro_06() -> Value {
    repro(include_str!(
        "../../../verification/global/repro/repro_06_v053_shansep_layer4.ogs.json"
    ))
}

#[test]
fn rcm_a_01_a_nearly_flat_ground_over_a_deep_layer_ends_in_bounded_time() {
    // The marching of `project` took more than 30 s here (0.2 s without `global`). E17e §1.
    let started = std::time::Instant::now();
    let (_, r) = analyze(&repro_01());
    let elapsed = started.elapsed().as_secs_f64();
    assert!(elapsed < 15.0, "{elapsed} s");
    assert_eq!(stats(&r)["generated"], 500);
    let mut plain = repro_01();
    plain["version"] = json!("0.6");
    plain["analysis"]["search"]["non_circular"]
        .as_object_mut()
        .unwrap()
        .remove("global");
    let (_, base) = analyze(&plain);
    assert!(r["fos"].as_f64().unwrap() <= base["fos"].as_f64().unwrap());
}

#[test]
fn rcm_a_03_auto_with_only_hoek_brown_regions_runs_the_block_on_a_layer_not_on_the_bases() {
    let (_, r) = analyze(&repro_03());
    let g = stats(&r);
    assert_eq!(g["algorithm"], "block");
    assert!(g["generated"].as_u64().unwrap() > 0);
    // The bases of this model are inclined: a block on them would have been the 1236-attempt run of the review.
    assert!(g["attempts"].as_u64().unwrap() < 1236, "{g}");
}

#[test]
fn rcm_a_04_max_vertices_bounds_the_global_stage() {
    for cap in [9usize, 17] {
        let mut m = repro_02();
        m["analysis"]["search"]["non_circular"]["max_vertices"] = json!(cap);
        let (_, r) = analyze(&m);
        let points = r["surface"]["points"].as_array().unwrap().len();
        assert!(points <= cap, "{points} > {cap}");
        assert!(r["fos"].as_f64().unwrap() <= 1.0453);
    }
    let (_, r) = analyze(&repro_02());
    assert!(r["surface"]["points"].as_array().unwrap().len() <= 9);
}

#[test]
fn rcm_a_03_the_note_can_come_with_a_zero_count() {
    // The guard rejected the polylines of the refinement or the polish, not the ones of the generation.
    let (_, r) = analyze(&repro_04());
    let g = stats(&r);
    assert_eq!(g["tension_rejected"], 0);
    assert_eq!(g["converged"], g["eligible"]);
    assert!(warnings(&r).contains(&"non_circular_global_tension_rejected".to_string()));
}

#[test]
fn rcm_a_06_a_weak_shansep_or_hoek_brown_layer_4_is_followed_by_the_block() {
    let (_, r) = analyze(&repro_06());
    let g = stats(&r);
    assert_eq!(g["algorithm"], "block");
    assert!(
        r["fos"].as_f64().unwrap() < 0.9,
        "annealing gave 1.0844: {}",
        r["fos"]
    );
    let mut m = repro_06();
    for mat in m["materials"].as_array_mut().unwrap() {
        if mat["id"] == "layer_4" {
            mat.as_object_mut().unwrap().remove("shansep");
            for (k, v) in json!({"model": "hoek_brown", "ucs": 2000.0, "gsi": 15.0, "mi": 5.0, "disturbance": 0.8})
                .as_object()
                .unwrap()
            {
                mat[k] = v.clone();
            }
        }
    }
    let (_, r) = analyze(&m);
    assert_eq!(stats(&r)["algorithm"], "block");
    assert!(r["fos"].as_f64().unwrap() < 0.9, "{}", r["fos"]);
}

#[test]
fn rcm_a_05_a_global_array_is_invalid() {
    let text = include_str!("../../../verification/global/repro/repro_05_global_array.ogs.json");
    let err = ogs_core::analyze_json(text).unwrap_err();
    assert!(err.starts_with("InvalidModel: "), "{err}");
}
