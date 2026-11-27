//! E16aa: contact comparisons include ponded water and distributed and line loads.
mod f3_common;
use serde_json::{Value, json};

fn model(name: &str) -> Value {
    let path = format!(
        "{}/tests/data/f3b/r16/{name}.json",
        env!("CARGO_MANIFEST_DIR")
    );
    serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
}
fn factor(name: &str) -> f64 {
    f3_common::run(&model(name)).results[0]
        .fos
        .expect("converged")
}

#[test]
fn contact_is_no_stronger_than_either_side() {
    for (prefix, low, middle, high) in [
        ("_tgt_hbpond", "6.999", "7.0", "7.001"),
        ("_reg_udl", "7.999", "8.0", "8.001"),
        ("ll_coh_sobre_fric", "6.999", "7.0", "7.001"),
        ("ll_fric_sobre_coh", "6.999", "7.0", "7.001"),
        ("line", "7.999", "8.0", "8.001"),
    ] {
        let below = factor(&format!("{prefix}_{low}"));
        let on = factor(&format!("{prefix}_{middle}"));
        let above = factor(&format!("{prefix}_{high}"));
        assert!(
            on <= 1.005 * below.min(above),
            "{prefix}: above={above} on={on} below={below}"
        );
    }
}

#[test]
fn chosen_shansep_contact_uses_reported_vertical_stress() {
    let mut d = model("_reg_udl_8.0");
    d["materials"][1]["shansep"]["ratio"] = json!(0.01);
    d["materials"][0]["ru"] = json!(0.2);
    d["materials"][1]["ru"] = json!(0.2);
    d["water"] = json!({"unit_weight":10.0,"piezometric_line":[[0,20],[40,20]]});
    d["loads"]
        .as_array_mut()
        .unwrap()
        .push(json!({"type":"line","x":16.0,"p":1000.0,"angle":0.0}));
    d["analysis"]["seismic"] = json!({"kv":0.1,"kh":0.0});
    let report = serde_json::to_value(f3_common::run(&d)).unwrap();
    let r = &report["results"][0];
    let entries = r["strength"]["slices"].as_array().unwrap();
    let slices = r["slices"].as_array().unwrap();
    let mut checked = 0;
    let mut probe = None;
    for e in entries {
        let s = &slices[e["index"].as_u64().unwrap() as usize];
        if (s["y_base_left"].as_f64().unwrap() - 8.0).abs() > 1e-8
            || (s["y_base_right"].as_f64().unwrap() - 8.0).abs() > 1e-8
        {
            continue;
        }
        let n = |k: &str| s[k].as_f64().unwrap();
        assert_eq!(s["material"], 1);
        let total = (n("weight") + (n("weight_extra") - 0.1 * n("weight"))) / n("width");
        let effective = total - n("pore_pressure");
        let reported = e["vertical_stress"].as_f64().unwrap();
        assert!((effective - reported).abs() <= 1e-12 * effective.abs().max(1.0));
        // OCR=1, identical ru on both materials: independently compare the two real strengths.
        let sh = 0.01 * effective.max(0.0);
        let mc = 25.0
            + (total * n("alpha").cos().powi(2) - n("pore_pressure")).max(0.0)
                * 5_f64.to_radians().tan();
        assert!(sh <= mc, "selected SH {sh} > MC {mc}");
        if probe.is_none() && sh > 0.0 {
            probe = Some((e["index"].as_u64().unwrap() as usize, sh));
        }
        checked += 1;
    }
    assert!(checked > 5, "no contact slices checked");
    // Bracket the actual comparison at 1e-12 around the reported stress: OCR=1 and ratio=0.01.
    // A stale soil-only stress or wrong ru makes at least one of the two choices fail.
    let (index, su) = probe.unwrap();
    d["materials"][0]["friction_angle"] = json!(0.0);
    for (factor, expected) in [(1.0 - 1e-12, 0), (1.0 + 1e-12, 1)] {
        d["materials"][0]["cohesion"] = json!(su * factor);
        let result = serde_json::to_value(f3_common::run(&d)).unwrap();
        assert_eq!(result["results"][0]["slices"][index]["material"], expected);
    }
}

#[test]
fn six_dry_contacts_remain_weak() {
    for (name, side, method) in [
        ("MC_weak_over_HB_str", "ab", "spencer"),
        ("MC_weak_over_SH_str", "ab", "spencer"),
        ("SH_str_over_MC_weak", "be", "spencer"),
        ("SH_str_over_SH_weak", "be", "spencer"),
        ("HB_str_over_MC_weak", "be", "janbu_simplified"),
        ("HB_str_over_HB_weak", "be", "janbu_simplified"),
    ] {
        let load = |part: &str| {
            let path = format!(
                "{}/tests/data/f3b/r15/contact/ct_{part}_{name}.json",
                env!("CARGO_MANIFEST_DIR")
            );
            let mut d: Value =
                serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
            d["analysis"]["methods"] = json!([method]);
            f3_common::run(&d).results[0].fos.unwrap()
        };
        let on = load("on");
        let weak = load(side);
        assert!((on / weak - 1.0).abs() <= 0.005, "{name}: {on} {weak}");
    }
}
