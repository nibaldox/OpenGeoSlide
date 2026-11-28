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
