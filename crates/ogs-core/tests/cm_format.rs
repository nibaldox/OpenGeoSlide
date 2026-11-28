use serde_json::{Value, json};

fn model() -> Value {
    let s = include_str!("../../../verification/cases/V001-nc.json");
    serde_json::from_str::<Value>(s).unwrap()["model"].clone()
}

fn input(version: &str, global: Value) -> Value {
    let mut m = model();
    m["version"] = json!(version);
    m["analysis"]["search"]["non_circular"]["global"] = global;
    m
}

#[test]
fn defaults_preserve_absent_fields() {
    let spec: ogs_core::model::GlobalSpec = serde_json::from_value(json!({})).unwrap();
    assert_eq!(spec.algorithm(), ogs_core::model::GlobalAlgorithm::Auto);
    assert_eq!(spec.generated(), 500);
    assert_eq!(spec.seed(), 0);
    assert!(spec.polish());
    assert_eq!(serde_json::to_value(spec).unwrap(), json!({}));
}

#[test]
fn global_stats_are_optional_and_serialize_null_fos() {
    use ogs_core::search::{GlobalStats, NonCircularStats};
    let mut nc = NonCircularStats {
        seeds: 0,
        evaluated: 0,
        seed_fos: 1.0,
        polyline_fos: None,
        global: None,
    };
    assert!(serde_json::to_value(nc).unwrap().get("global").is_none());
    nc.global = Some(GlobalStats {
        algorithm: "block",
        generated: 0,
        attempts: 0,
        converged: 0,
        eligible: 0,
        tension_rejected: 0,
        refined: 0,
        evaluated: 0,
        polish_evaluated: 0,
        global_fos: None,
        winner: "refinement",
    });
    assert_eq!(
        serde_json::to_value(nc).unwrap()["global"]["global_fos"],
        Value::Null
    );
}

#[test]
fn v07_shape_versions_and_ranges() {
    for g in [
        json!({}),
        json!({"algorithm":"block","generated":50,"seed":0,"polish":false}),
        json!({"algorithm":"annealing","generated":2000,"seed":9007199254740991u64}),
    ] {
        assert!(ogs_core::analyze_json(&input("0.7", g).to_string()).is_ok());
    }
    for g in [
        json!({"generated":49}),
        json!({"generated":2001}),
        json!({"seed":9007199254740992u64}),
        json!({"algorithm":"path"}),
        json!({"typo":1}),
    ] {
        assert!(ogs_core::analyze_json(&input("0.7", g).to_string()).is_err());
    }
    let err = ogs_core::analyze_json(&input("0.6", json!({})).to_string()).unwrap_err();
    assert!(
        err.to_string()
            .contains("analysis.search.non_circular.global requiere version \"0.7\"")
    );
    assert!(ogs_core::analyze_json(&input("0.6", Value::Null).to_string()).is_ok());
}
