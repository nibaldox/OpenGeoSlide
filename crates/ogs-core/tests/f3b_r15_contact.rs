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

#[test]
fn strong_rock_over_weak_layer_uses_below_and_janbu() {
    // Spencer has no lambda root here; simplified Janbu converges on both surfaces.
    for name in ["HB_str_over_MC_weak", "HB_str_over_HB_weak"] {
        let load = |side| -> Value {
            let path = format!(
                "{}/tests/data/f3b/r15/contact/ct_{side}_{name}.json",
                env!("CARGO_MANIFEST_DIR")
            );
            let mut doc: Value =
                serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
            doc["analysis"]["methods"] = serde_json::json!(["janbu_simplified"]);
            doc
        };
        let a = run(&load("on"));
        let b = run(&load("be"));
        let (a, b) = (&a.results[0], &b.results[0]);
        assert!((a.fos.unwrap() / b.fos.unwrap() - 1.0).abs() <= 0.005);
        let pairs: Vec<_> = a
            .slices
            .iter()
            .zip(&b.slices)
            .filter(|(x, _)| {
                (x.y_base_left - 5.0).abs() < 1e-7 && (x.y_base_right - 5.0).abs() < 1e-7
            })
            .collect();
        assert!(!pairs.is_empty());
        for (x, y) in pairs {
            assert_eq!(x.material, y.material);
            assert_eq!(x.material, 1);
        }
    }
}
