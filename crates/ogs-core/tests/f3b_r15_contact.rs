//! R15 E16v: the contact must follow the weaker neighboring layer.
mod f3_common;

use f3_common::run;
use serde_json::Value;

fn fos(side: &str, name: &str) -> f64 {
    let path = format!(
        "{}/tests/data/f3b/r15/contact/ct_{side}_{name}.json",
        env!("CARGO_MANIFEST_DIR")
    );
    let model: Value = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
    run(&model).results[0].fos.expect("converged factor")
}

#[test]
fn contact_follows_weaker_layer_for_convergent_cases() {
    for (name, side) in [
        ("MC_weak_over_HB_str", "ab"),
        ("MC_weak_over_SH_str", "ab"),
        ("SH_str_over_MC_weak", "be"),
        ("SH_str_over_SH_weak", "be"),
    ] {
        let on = fos("on", name);
        let weak = fos(side, name);
        assert!((on / weak - 1.0).abs() <= 0.005, "{name}: {on} vs {weak}");
    }
}
