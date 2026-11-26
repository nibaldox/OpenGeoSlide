//! Reinforcement oracle test (amendments E14l and E14m-5, F4.13 and F4.16): the values of `cslope` 0.1.0 (binary
//! `a80f9a0`) on V047a with the fixed circle of F3.8 (`xc 29.54334963719809`, `yc 53.63784815923435`,
//! `r 28.641487934160704`, 50 slices, `tolerance 1e-5`, `slope.direction: right_to_left`).
//!
//! Source of every row: `docs/fase3/exploracion/X17.md` (§4.3 for the factors of safety, §4.4 and §4.5 for the exact
//! v0.4 JSON of each row). The JSON is copied as written there, except that the pile and sheet pile rows carry no
//! `location` (E14m-3). Every row is run with four methods:
//!
//! - Bishop;
//! - Morgenstern-Price with the `constant` interslice function (`mp_constant`);
//! - Janbu simplified;
//! - Janbu corrected.
//!
//! Rows:
//!
//! - the **7 rows of F4.13** (rows 1, 2, 3, 5, 7, 9 and 11), with the pile at (40; 33)-(40; 22), `force` 60,
//!   `spacing` 1.5, `angle` 0, and the sheet pile at (40; 33)-(40; 22), `force` 120, `angle` 0;
//! - the **inclined rows** (`inc_*`): anchors of 27 m with the head at (36; 28), going down or up toward the mass,
//!   with `axial`, `tangent` and `bisector` (X17 §4.4 has 16: 8 active and 8 passive). The `up30` and `up45` rows
//!   cross the surface in compression (`along > 0`). The **passive** ones are oracle rows (no force is applied, the
//!   value is the slope without reinforcement, `compression_ignored`). The **active** ones are **not** oracle rows:
//!   the installed binary drops the force there, but the contract (E14m-1) applies it, axial and complete, so they
//!   would differ by design. They are replaced by `inc_up30_act_applies_the_force` and
//!   `inc_up45_act_applies_the_force`, which only check that the force is applied (the value moves away from the
//!   unreinforced one); the exact `u = d` is fixed by the tests of R1-C and by the independent global equilibrium;
//! - the **9 capacity rows** (`cap_*`): `interface`, `bond`, `bonded_length` and `development`.
//!
//! **Tolerance:** `0.1 %`, and `0.25 %` in `cap_interface_pas` and `cap_interface_cov_5_sp2_pas`, where the integral of
//! `interface` governs the capacity and cSlope discretizes it in 200 steps (X17 §2.1: the exact integral of the engine
//! differs from the oracle by up to 0.18 % in `F`). The other rows stay at 0.1 %.
//!
//! **State of this file:** `R1-V` writes the rows on the base of R0, so they are **RED on purpose**: a valid v0.4
//! document gets past the parser and the validation and stops in the stub of the engine
//! (`not yet implemented: R1: fuerzas de refuerzo`). R1-C makes the active rows pass (they use the usual fields of the
//! slices); the passive rows (`_pas`) need R1-M as well. Do not change a value or a tolerance.
//!
//! Tests are named `{row}_{act|pas}_{method}` so that a filter (`_act_`) selects the rows of one application.

mod f3_common;

use f3_common::*;
use serde_json::{Value, json};

/// `|Δ| ≤ 0.1 %` of the oracle (F4.13, E14m-5).
const TOLERANCE: f64 = 1e-3;
/// `|Δ| ≤ 0.25 %`, the two `interface` rows where the integral governs (E14m-5).
const TOLERANCE_INTERFACE: f64 = 2.5e-3;

#[derive(Clone, Copy)]
enum Method {
    Bishop,
    MorgensternPriceConstant,
    JanbuSimplified,
    JanbuCorrected,
}

impl Method {
    fn name(self) -> &'static str {
        match self {
            Method::Bishop => "bishop",
            Method::MorgensternPriceConstant => "morgenstern_price (constant)",
            Method::JanbuSimplified => "janbu_simplified",
            Method::JanbuCorrected => "janbu_corrected",
        }
    }
}

/// V047a, fixed circle, `version "0.4"`, one method and the reinforcements of the row (JSON text of X17 §4.4 / §4.5).
fn doc(method: Method, reinforcements: &str) -> Value {
    let (key, interslice) = match method {
        Method::Bishop => ("bishop", false),
        Method::MorgensternPriceConstant => ("morgenstern_price", true),
        Method::JanbuSimplified => ("janbu_simplified", false),
        Method::JanbuCorrected => ("janbu_corrected", false),
    };
    let mut doc = v047a(json!([key]));
    doc["version"] = json!("0.4");
    if interslice {
        doc["analysis"]["interslice"] = json!({"function": "constant"});
    }
    doc["reinforcements"] =
        serde_json::from_str(reinforcements).expect("the JSON of the row parses");
    doc
}

/// Runs one row with one method and compares it with the oracle (`cslope` 0.1.0).
fn check(label: &str, method: Method, reinforcements: &str, want: f64, tolerance: f64) {
    let got = fos(&doc(method, reinforcements), 0);
    let rel = (got - want).abs() / want.abs();
    println!(
        "{label}, {}: ogs {got:.10}, cslope {want:.6}, Δ {:.4} %",
        method.name(),
        100.0 * rel
    );
    assert!(
        rel <= tolerance,
        "{label}, {}: ogs {got:.10} against cslope {want:.6}: Δ = {:.4} % (> {:.2} %)",
        method.name(),
        100.0 * rel,
        100.0 * tolerance
    );
}

// F4.13-1: Ancla activa horizontal..
const ROW1_ANCHOR_ACT: &str = r#"[{"type": "anchor", "id": "A1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "active", "tensile_capacity": 100, "direction": "axial"}]"#;

#[test]
fn row1_anchor_act_bishop() {
    check(
        "F4.13-1",
        Method::Bishop,
        ROW1_ANCHOR_ACT,
        1.333661,
        TOLERANCE,
    );
}

#[test]
fn row1_anchor_act_mp_constant() {
    check(
        "F4.13-1",
        Method::MorgensternPriceConstant,
        ROW1_ANCHOR_ACT,
        1.329252,
        TOLERANCE,
    );
}

#[test]
fn row1_anchor_act_janbu_simplified() {
    check(
        "F4.13-1",
        Method::JanbuSimplified,
        ROW1_ANCHOR_ACT,
        1.261727,
        TOLERANCE,
    );
}

#[test]
fn row1_anchor_act_janbu_corrected() {
    check(
        "F4.13-1",
        Method::JanbuCorrected,
        ROW1_ANCHOR_ACT,
        1.319292,
        TOLERANCE,
    );
}

// F4.13-2: Ancla pasiva horizontal..
const ROW2_ANCHOR_PAS: &str = r#"[{"type": "anchor", "id": "A1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 100, "direction": "axial"}]"#;

#[test]
fn row2_anchor_pas_bishop() {
    check(
        "F4.13-2",
        Method::Bishop,
        ROW2_ANCHOR_PAS,
        1.248405,
        TOLERANCE,
    );
}

#[test]
fn row2_anchor_pas_mp_constant() {
    check(
        "F4.13-2",
        Method::MorgensternPriceConstant,
        ROW2_ANCHOR_PAS,
        1.245588,
        TOLERANCE,
    );
}

#[test]
fn row2_anchor_pas_janbu_simplified() {
    check(
        "F4.13-2",
        Method::JanbuSimplified,
        ROW2_ANCHOR_PAS,
        1.197684,
        TOLERANCE,
    );
}

#[test]
fn row2_anchor_pas_janbu_corrected() {
    check(
        "F4.13-2",
        Method::JanbuCorrected,
        ROW2_ANCHOR_PAS,
        1.252327,
        TOLERANCE,
    );
}

// F4.13-3: Clavo pasivo, bond 30 kN/m, T=150..
const ROW3_NAIL_BOND_PAS: &str = r#"[{"type": "nail", "id": "N1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 150, "direction": "axial", "pullout": {"model": "bond", "strength": 30}}]"#;

#[test]
fn row3_nail_bond_pas_bishop() {
    check(
        "F4.13-3",
        Method::Bishop,
        ROW3_NAIL_BOND_PAS,
        1.375819,
        TOLERANCE,
    );
}

#[test]
fn row3_nail_bond_pas_mp_constant() {
    check(
        "F4.13-3",
        Method::MorgensternPriceConstant,
        ROW3_NAIL_BOND_PAS,
        1.372304,
        TOLERANCE,
    );
}

#[test]
fn row3_nail_bond_pas_janbu_simplified() {
    check(
        "F4.13-3",
        Method::JanbuSimplified,
        ROW3_NAIL_BOND_PAS,
        1.319513,
        TOLERANCE,
    );
}

#[test]
fn row3_nail_bond_pas_janbu_corrected() {
    check(
        "F4.13-3",
        Method::JanbuCorrected,
        ROW3_NAIL_BOND_PAS,
        1.379714,
        TOLERANCE,
    );
}

// F4.13-5: Geomalla pasiva tangent, interface a=10, d=20, T=60..
const ROW5_GEOGRID_INTERFACE_PAS: &str = r#"[{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 60, "direction": "tangent", "pullout": {"model": "interface", "adhesion": 10, "friction_angle": 20, "coverage": 1}}]"#;

#[test]
fn row5_geogrid_interface_pas_bishop() {
    check(
        "F4.13-5",
        Method::Bishop,
        ROW5_GEOGRID_INTERFACE_PAS,
        1.139869,
        TOLERANCE,
    );
}

#[test]
fn row5_geogrid_interface_pas_mp_constant() {
    check(
        "F4.13-5",
        Method::MorgensternPriceConstant,
        ROW5_GEOGRID_INTERFACE_PAS,
        1.137672,
        TOLERANCE,
    );
}

#[test]
fn row5_geogrid_interface_pas_janbu_simplified() {
    check(
        "F4.13-5",
        Method::JanbuSimplified,
        ROW5_GEOGRID_INTERFACE_PAS,
        1.092417,
        TOLERANCE,
    );
}

#[test]
fn row5_geogrid_interface_pas_janbu_corrected() {
    check(
        "F4.13-5",
        Method::JanbuCorrected,
        ROW5_GEOGRID_INTERFACE_PAS,
        1.142257,
        TOLERANCE,
    );
}

// F4.13-7: Pilote activo F=60, s=1.5, angle 0..
const ROW7_PILE_ACT: &str = r#"[{"type": "pile", "id": "P1", "x1": 40, "y1": 33, "x2": 40, "y2": 22, "application": "active", "force": 60, "direction": "angle", "spacing": 1.5, "angle": 0}]"#;

#[test]
fn row7_pile_act_bishop() {
    check(
        "F4.13-7",
        Method::Bishop,
        ROW7_PILE_ACT,
        1.108256,
        TOLERANCE,
    );
}

#[test]
fn row7_pile_act_mp_constant() {
    check(
        "F4.13-7",
        Method::MorgensternPriceConstant,
        ROW7_PILE_ACT,
        1.105923,
        TOLERANCE,
    );
}

#[test]
fn row7_pile_act_janbu_simplified() {
    check(
        "F4.13-7",
        Method::JanbuSimplified,
        ROW7_PILE_ACT,
        1.053426,
        TOLERANCE,
    );
}

#[test]
fn row7_pile_act_janbu_corrected() {
    check(
        "F4.13-7",
        Method::JanbuCorrected,
        ROW7_PILE_ACT,
        1.101488,
        TOLERANCE,
    );
}

// F4.13-9: Pilote pasivo F=60, s=1.5, angle 0..
const ROW9_PILE_PAS: &str = r#"[{"type": "pile", "id": "P1", "x1": 40, "y1": 33, "x2": 40, "y2": 22, "application": "passive", "force": 60, "direction": "angle", "spacing": 1.5, "angle": 0}]"#;

#[test]
fn row9_pile_pas_bishop() {
    check(
        "F4.13-9",
        Method::Bishop,
        ROW9_PILE_PAS,
        1.096378,
        TOLERANCE,
    );
}

#[test]
fn row9_pile_pas_mp_constant() {
    check(
        "F4.13-9",
        Method::MorgensternPriceConstant,
        ROW9_PILE_PAS,
        1.094400,
        TOLERANCE,
    );
}

#[test]
fn row9_pile_pas_janbu_simplified() {
    check(
        "F4.13-9",
        Method::JanbuSimplified,
        ROW9_PILE_PAS,
        1.048013,
        TOLERANCE,
    );
}

#[test]
fn row9_pile_pas_janbu_corrected() {
    check(
        "F4.13-9",
        Method::JanbuCorrected,
        ROW9_PILE_PAS,
        1.095828,
        TOLERANCE,
    );
}

// F4.13-11: Tablestaca activa, 120 kN/m, angle 0..
const ROW11_SHEET_PILE_ACT: &str = r#"[{"type": "sheet_pile", "id": "S1", "x1": 40, "y1": 33, "x2": 40, "y2": 22, "application": "active", "force": 120, "direction": "angle", "angle": 0}]"#;

#[test]
fn row11_sheet_pile_act_bishop() {
    check(
        "F4.13-11",
        Method::Bishop,
        ROW11_SHEET_PILE_ACT,
        1.455483,
        TOLERANCE,
    );
}

#[test]
fn row11_sheet_pile_act_mp_constant() {
    check(
        "F4.13-11",
        Method::MorgensternPriceConstant,
        ROW11_SHEET_PILE_ACT,
        1.448712,
        TOLERANCE,
    );
}

#[test]
fn row11_sheet_pile_act_janbu_simplified() {
    check(
        "F4.13-11",
        Method::JanbuSimplified,
        ROW11_SHEET_PILE_ACT,
        1.347821,
        TOLERANCE,
    );
}

#[test]
fn row11_sheet_pile_act_janbu_corrected() {
    check(
        "F4.13-11",
        Method::JanbuCorrected,
        ROW11_SHEET_PILE_ACT,
        1.409314,
        TOLERANCE,
    );
}

// X17-inc-down15-act: Ancla active, cabeza (36;28) en el paramento, baja 15° hacia el macizo, axial..
const INC_DOWN15_ACT: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 62.079997, "y2": 21.011886, "application": "active", "tensile_capacity": 100, "direction": "axial"}]"#;

#[test]
fn inc_down15_act_bishop() {
    check(
        "X17-inc-down15-act",
        Method::Bishop,
        INC_DOWN15_ACT,
        1.322996,
        TOLERANCE,
    );
}

#[test]
fn inc_down15_act_mp_constant() {
    check(
        "X17-inc-down15-act",
        Method::MorgensternPriceConstant,
        INC_DOWN15_ACT,
        1.318077,
        TOLERANCE,
    );
}

#[test]
fn inc_down15_act_janbu_simplified() {
    check(
        "X17-inc-down15-act",
        Method::JanbuSimplified,
        INC_DOWN15_ACT,
        1.238390,
        TOLERANCE,
    );
}

#[test]
fn inc_down15_act_janbu_corrected() {
    check(
        "X17-inc-down15-act",
        Method::JanbuCorrected,
        INC_DOWN15_ACT,
        1.294890,
        TOLERANCE,
    );
}

// X17-inc-down15-pas: Ancla passive, cabeza (36;28) en el paramento, baja 15° hacia el macizo, axial..
const INC_DOWN15_PAS: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 62.079997, "y2": 21.011886, "application": "passive", "tensile_capacity": 100, "direction": "axial"}]"#;

#[test]
fn inc_down15_pas_bishop() {
    check(
        "X17-inc-down15-pas",
        Method::Bishop,
        INC_DOWN15_PAS,
        1.243443,
        TOLERANCE,
    );
}

#[test]
fn inc_down15_pas_mp_constant() {
    check(
        "X17-inc-down15-pas",
        Method::MorgensternPriceConstant,
        INC_DOWN15_PAS,
        1.240298,
        TOLERANCE,
    );
}

#[test]
fn inc_down15_pas_janbu_simplified() {
    check(
        "X17-inc-down15-pas",
        Method::JanbuSimplified,
        INC_DOWN15_PAS,
        1.184080,
        TOLERANCE,
    );
}

#[test]
fn inc_down15_pas_janbu_corrected() {
    check(
        "X17-inc-down15-pas",
        Method::JanbuCorrected,
        INC_DOWN15_PAS,
        1.238103,
        TOLERANCE,
    );
}

// X17-inc-down30-act: Ancla active, cabeza (36;28) en el paramento, baja 30° hacia el macizo, axial..
const INC_DOWN30_ACT: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 14.5, "application": "active", "tensile_capacity": 100, "direction": "axial"}]"#;

#[test]
fn inc_down30_act_bishop() {
    check(
        "X17-inc-down30-act",
        Method::Bishop,
        INC_DOWN30_ACT,
        1.285084,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_act_mp_constant() {
    check(
        "X17-inc-down30-act",
        Method::MorgensternPriceConstant,
        INC_DOWN30_ACT,
        1.280634,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_act_janbu_simplified() {
    check(
        "X17-inc-down30-act",
        Method::JanbuSimplified,
        INC_DOWN30_ACT,
        1.202115,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_act_janbu_corrected() {
    check(
        "X17-inc-down30-act",
        Method::JanbuCorrected,
        INC_DOWN30_ACT,
        1.256961,
        TOLERANCE,
    );
}

// X17-inc-down30-pas: Ancla passive, cabeza (36;28) en el paramento, baja 30° hacia el macizo, axial..
const INC_DOWN30_PAS: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 14.5, "application": "passive", "tensile_capacity": 100, "direction": "axial"}]"#;

#[test]
fn inc_down30_pas_bishop() {
    check(
        "X17-inc-down30-pas",
        Method::Bishop,
        INC_DOWN30_PAS,
        1.221758,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_pas_mp_constant() {
    check(
        "X17-inc-down30-pas",
        Method::MorgensternPriceConstant,
        INC_DOWN30_PAS,
        1.218764,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_pas_janbu_simplified() {
    check(
        "X17-inc-down30-pas",
        Method::JanbuSimplified,
        INC_DOWN30_PAS,
        1.161085,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_pas_janbu_corrected() {
    check(
        "X17-inc-down30-pas",
        Method::JanbuCorrected,
        INC_DOWN30_PAS,
        1.214059,
        TOLERANCE,
    );
}

// X17-inc-down45-act: Ancla active, cabeza (36;28) en el paramento, baja 45° hacia el macizo, axial..
const INC_DOWN45_ACT: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 55.091883, "y2": 8.908117, "application": "active", "tensile_capacity": 100, "direction": "axial"}]"#;

#[test]
fn inc_down45_act_bishop() {
    check(
        "X17-inc-down45-act",
        Method::Bishop,
        INC_DOWN45_ACT,
        1.227727,
        TOLERANCE,
    );
}

#[test]
fn inc_down45_act_mp_constant() {
    check(
        "X17-inc-down45-act",
        Method::MorgensternPriceConstant,
        INC_DOWN45_ACT,
        1.224093,
        TOLERANCE,
    );
}

#[test]
fn inc_down45_act_janbu_simplified() {
    check(
        "X17-inc-down45-act",
        Method::JanbuSimplified,
        INC_DOWN45_ACT,
        1.152974,
        TOLERANCE,
    );
}

#[test]
fn inc_down45_act_janbu_corrected() {
    check(
        "X17-inc-down45-act",
        Method::JanbuCorrected,
        INC_DOWN45_ACT,
        1.205578,
        TOLERANCE,
    );
}

// X17-inc-down45-pas: Ancla passive, cabeza (36;28) en el paramento, baja 45° hacia el macizo, axial..
const INC_DOWN45_PAS: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 55.091883, "y2": 8.908117, "application": "passive", "tensile_capacity": 100, "direction": "axial"}]"#;

#[test]
fn inc_down45_pas_bishop() {
    check(
        "X17-inc-down45-pas",
        Method::Bishop,
        INC_DOWN45_PAS,
        1.185452,
        TOLERANCE,
    );
}

#[test]
fn inc_down45_pas_mp_constant() {
    check(
        "X17-inc-down45-pas",
        Method::MorgensternPriceConstant,
        INC_DOWN45_PAS,
        1.182804,
        TOLERANCE,
    );
}

#[test]
fn inc_down45_pas_janbu_simplified() {
    check(
        "X17-inc-down45-pas",
        Method::JanbuSimplified,
        INC_DOWN45_PAS,
        1.127108,
        TOLERANCE,
    );
}

#[test]
fn inc_down45_pas_janbu_corrected() {
    check(
        "X17-inc-down45-pas",
        Method::JanbuCorrected,
        INC_DOWN45_PAS,
        1.178531,
        TOLERANCE,
    );
}

// X17-inc-down30-tangent-act: Ancla active, baja 30°, tangent..
const INC_DOWN30_TANGENT_ACT: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 14.5, "application": "active", "tensile_capacity": 100, "direction": "tangent"}]"#;

#[test]
fn inc_down30_tangent_act_bishop() {
    check(
        "X17-inc-down30-tangent-act",
        Method::Bishop,
        INC_DOWN30_TANGENT_ACT,
        1.345237,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_tangent_act_mp_constant() {
    check(
        "X17-inc-down30-tangent-act",
        Method::MorgensternPriceConstant,
        INC_DOWN30_TANGENT_ACT,
        1.339658,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_tangent_act_janbu_simplified() {
    check(
        "X17-inc-down30-tangent-act",
        Method::JanbuSimplified,
        INC_DOWN30_TANGENT_ACT,
        1.246721,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_tangent_act_janbu_corrected() {
    check(
        "X17-inc-down30-tangent-act",
        Method::JanbuCorrected,
        INC_DOWN30_TANGENT_ACT,
        1.303601,
        TOLERANCE,
    );
}

// X17-inc-down30-tangent-pas: Ancla passive, baja 30°, tangent..
const INC_DOWN30_TANGENT_PAS: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 14.5, "application": "passive", "tensile_capacity": 100, "direction": "tangent"}]"#;

#[test]
fn inc_down30_tangent_pas_bishop() {
    check(
        "X17-inc-down30-tangent-pas",
        Method::Bishop,
        INC_DOWN30_TANGENT_PAS,
        1.253323,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_tangent_pas_mp_constant() {
    check(
        "X17-inc-down30-tangent-pas",
        Method::MorgensternPriceConstant,
        INC_DOWN30_TANGENT_PAS,
        1.249952,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_tangent_pas_janbu_simplified() {
    check(
        "X17-inc-down30-tangent-pas",
        Method::JanbuSimplified,
        INC_DOWN30_TANGENT_PAS,
        1.187454,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_tangent_pas_janbu_corrected() {
    check(
        "X17-inc-down30-tangent-pas",
        Method::JanbuCorrected,
        INC_DOWN30_TANGENT_PAS,
        1.241631,
        TOLERANCE,
    );
}

// X17-inc-down30-bisector-act: Ancla active, baja 30°, bisector..
const INC_DOWN30_BISECTOR_ACT: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 14.5, "application": "active", "tensile_capacity": 100, "direction": "bisector"}]"#;

#[test]
fn inc_down30_bisector_act_bishop() {
    check(
        "X17-inc-down30-bisector-act",
        Method::Bishop,
        INC_DOWN30_BISECTOR_ACT,
        1.355457,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_bisector_act_mp_constant() {
    check(
        "X17-inc-down30-bisector-act",
        Method::MorgensternPriceConstant,
        INC_DOWN30_BISECTOR_ACT,
        1.349912,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_bisector_act_janbu_simplified() {
    check(
        "X17-inc-down30-bisector-act",
        Method::JanbuSimplified,
        INC_DOWN30_BISECTOR_ACT,
        1.257745,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_bisector_act_janbu_corrected() {
    check(
        "X17-inc-down30-bisector-act",
        Method::JanbuCorrected,
        INC_DOWN30_BISECTOR_ACT,
        1.315129,
        TOLERANCE,
    );
}

// X17-inc-down30-bisector-pas: Ancla passive, baja 30°, bisector..
const INC_DOWN30_BISECTOR_PAS: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 14.5, "application": "passive", "tensile_capacity": 100, "direction": "bisector"}]"#;

#[test]
fn inc_down30_bisector_pas_bishop() {
    check(
        "X17-inc-down30-bisector-pas",
        Method::Bishop,
        INC_DOWN30_BISECTOR_PAS,
        1.261041,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_bisector_pas_mp_constant() {
    check(
        "X17-inc-down30-bisector-pas",
        Method::MorgensternPriceConstant,
        INC_DOWN30_BISECTOR_PAS,
        1.257672,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_bisector_pas_janbu_simplified() {
    check(
        "X17-inc-down30-bisector-pas",
        Method::JanbuSimplified,
        INC_DOWN30_BISECTOR_PAS,
        1.195595,
        TOLERANCE,
    );
}

#[test]
fn inc_down30_bisector_pas_janbu_corrected() {
    check(
        "X17-inc-down30-bisector-pas",
        Method::JanbuCorrected,
        INC_DOWN30_BISECTOR_PAS,
        1.250143,
        TOLERANCE,
    );
}

// X17-inc-up15-act: Ancla active, cabeza (36;28), sube 15° hacia el macizo, axial..
const INC_UP15_ACT: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 62.079997, "y2": 34.988114, "application": "active", "tensile_capacity": 100, "direction": "axial"}]"#;

#[test]
fn inc_up15_act_bishop() {
    check(
        "X17-inc-up15-act",
        Method::Bishop,
        INC_UP15_ACT,
        1.310751,
        TOLERANCE,
    );
}

#[test]
fn inc_up15_act_mp_constant() {
    check(
        "X17-inc-up15-act",
        Method::MorgensternPriceConstant,
        INC_UP15_ACT,
        1.310450,
        TOLERANCE,
    );
}

#[test]
fn inc_up15_act_janbu_simplified() {
    check(
        "X17-inc-up15-act",
        Method::JanbuSimplified,
        INC_UP15_ACT,
        1.292607,
        TOLERANCE,
    );
}

#[test]
fn inc_up15_act_janbu_corrected() {
    check(
        "X17-inc-up15-act",
        Method::JanbuCorrected,
        INC_UP15_ACT,
        1.351581,
        TOLERANCE,
    );
}

// X17-inc-up15-pas: Ancla passive, cabeza (36;28), sube 15° hacia el macizo, axial..
const INC_UP15_PAS: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 62.079997, "y2": 34.988114, "application": "passive", "tensile_capacity": 100, "direction": "axial"}]"#;

#[test]
fn inc_up15_pas_bishop() {
    check(
        "X17-inc-up15-pas",
        Method::Bishop,
        INC_UP15_PAS,
        1.234156,
        TOLERANCE,
    );
}

#[test]
fn inc_up15_pas_mp_constant() {
    check(
        "X17-inc-up15-pas",
        Method::MorgensternPriceConstant,
        INC_UP15_PAS,
        1.233673,
        TOLERANCE,
    );
}

#[test]
fn inc_up15_pas_janbu_simplified() {
    check(
        "X17-inc-up15-pas",
        Method::JanbuSimplified,
        INC_UP15_PAS,
        1.214752,
        TOLERANCE,
    );
}

#[test]
fn inc_up15_pas_janbu_corrected() {
    check(
        "X17-inc-up15-pas",
        Method::JanbuCorrected,
        INC_UP15_PAS,
        1.270174,
        TOLERANCE,
    );
}

// X17-inc-up30-pas: Ancla passive, cabeza (36;28), sube 30° hacia el macizo, axial..
// The crossing is in compression (`along > 0`): no force is applied and the value is the slope without reinforcement.
const INC_UP30_PAS: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 41.5, "application": "passive", "tensile_capacity": 100, "direction": "axial"}]"#;

#[test]
fn inc_up30_pas_bishop() {
    check(
        "X17-inc-up30-pas",
        Method::Bishop,
        INC_UP30_PAS,
        0.985084,
        TOLERANCE,
    );
}

#[test]
fn inc_up30_pas_mp_constant() {
    check(
        "X17-inc-up30-pas",
        Method::MorgensternPriceConstant,
        INC_UP30_PAS,
        0.984100,
        TOLERANCE,
    );
}

#[test]
fn inc_up30_pas_janbu_simplified() {
    check(
        "X17-inc-up30-pas",
        Method::JanbuSimplified,
        INC_UP30_PAS,
        0.945229,
        TOLERANCE,
    );
}

#[test]
fn inc_up30_pas_janbu_corrected() {
    check(
        "X17-inc-up30-pas",
        Method::JanbuCorrected,
        INC_UP30_PAS,
        0.988354,
        TOLERANCE,
    );
}

// X17-inc-up45-pas: Ancla passive, cabeza (36;28), sube 45° hacia el macizo, axial..
// The crossing is in compression (`along > 0`): no force is applied and the value is the slope without reinforcement.
const INC_UP45_PAS: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 55.091883, "y2": 47.091883, "application": "passive", "tensile_capacity": 100, "direction": "axial"}]"#;

#[test]
fn inc_up45_pas_bishop() {
    check(
        "X17-inc-up45-pas",
        Method::Bishop,
        INC_UP45_PAS,
        0.985084,
        TOLERANCE,
    );
}

#[test]
fn inc_up45_pas_mp_constant() {
    check(
        "X17-inc-up45-pas",
        Method::MorgensternPriceConstant,
        INC_UP45_PAS,
        0.984100,
        TOLERANCE,
    );
}

#[test]
fn inc_up45_pas_janbu_simplified() {
    check(
        "X17-inc-up45-pas",
        Method::JanbuSimplified,
        INC_UP45_PAS,
        0.945229,
        TOLERANCE,
    );
}

#[test]
fn inc_up45_pas_janbu_corrected() {
    check(
        "X17-inc-up45-pas",
        Method::JanbuCorrected,
        INC_UP45_PAS,
        0.988354,
        TOLERANCE,
    );
}

// X17-cap-interface. Oracle force at the crossing: 272.5028 kN/m.
const CAP_INTERFACE_PAS: &str = r#"[{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 1000, "direction": "axial", "pullout": {"model": "interface", "adhesion": 10, "friction_angle": 20, "coverage": 1}}]"#;

#[test]
fn cap_interface_pas_bishop() {
    check(
        "X17-cap-interface",
        Method::Bishop,
        CAP_INTERFACE_PAS,
        1.681102,
        TOLERANCE_INTERFACE,
    );
}

#[test]
fn cap_interface_pas_mp_constant() {
    check(
        "X17-cap-interface",
        Method::MorgensternPriceConstant,
        CAP_INTERFACE_PAS,
        1.676227,
        TOLERANCE_INTERFACE,
    );
}

#[test]
fn cap_interface_pas_janbu_simplified() {
    check(
        "X17-cap-interface",
        Method::JanbuSimplified,
        CAP_INTERFACE_PAS,
        1.610872,
        TOLERANCE_INTERFACE,
    );
}

#[test]
fn cap_interface_pas_janbu_corrected() {
    check(
        "X17-cap-interface",
        Method::JanbuCorrected,
        CAP_INTERFACE_PAS,
        1.684366,
        TOLERANCE_INTERFACE,
    );
}

// X17-cap-interface-cov.5-sp2. Oracle force at the crossing: 136.2514 kN/m.
const CAP_INTERFACE_COV_5_SP2_PAS: &str = r#"[{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 1000, "direction": "axial", "spacing": 2, "pullout": {"model": "interface", "adhesion": 10, "friction_angle": 20, "coverage": 0.5}}]"#;

#[test]
fn cap_interface_cov_5_sp2_pas_bishop() {
    check(
        "X17-cap-interface-cov.5-sp2",
        Method::Bishop,
        CAP_INTERFACE_COV_5_SP2_PAS,
        1.340989,
        TOLERANCE_INTERFACE,
    );
}

#[test]
fn cap_interface_cov_5_sp2_pas_mp_constant() {
    check(
        "X17-cap-interface-cov.5-sp2",
        Method::MorgensternPriceConstant,
        CAP_INTERFACE_COV_5_SP2_PAS,
        1.337655,
        TOLERANCE_INTERFACE,
    );
}

#[test]
fn cap_interface_cov_5_sp2_pas_janbu_simplified() {
    check(
        "X17-cap-interface-cov.5-sp2",
        Method::JanbuSimplified,
        CAP_INTERFACE_COV_5_SP2_PAS,
        1.286225,
        TOLERANCE_INTERFACE,
    );
}

#[test]
fn cap_interface_cov_5_sp2_pas_janbu_corrected() {
    check(
        "X17-cap-interface-cov.5-sp2",
        Method::JanbuCorrected,
        CAP_INTERFACE_COV_5_SP2_PAS,
        1.344908,
        TOLERANCE_INTERFACE,
    );
}

// X17-cap-interface-a0-d30. Oracle force at the crossing: 229.9695 kN/m.
const CAP_INTERFACE_A0_D30_PAS: &str = r#"[{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 1000, "direction": "axial", "pullout": {"model": "interface", "adhesion": 0, "friction_angle": 30, "coverage": 1}}]"#;

#[test]
fn cap_interface_a0_d30_pas_bishop() {
    check(
        "X17-cap-interface-a0-d30",
        Method::Bishop,
        CAP_INTERFACE_A0_D30_PAS,
        1.575984,
        TOLERANCE,
    );
}

#[test]
fn cap_interface_a0_d30_pas_mp_constant() {
    check(
        "X17-cap-interface-a0-d30",
        Method::MorgensternPriceConstant,
        CAP_INTERFACE_A0_D30_PAS,
        1.571536,
        TOLERANCE,
    );
}

#[test]
fn cap_interface_a0_d30_pas_janbu_simplified() {
    check(
        "X17-cap-interface-a0-d30",
        Method::JanbuSimplified,
        CAP_INTERFACE_A0_D30_PAS,
        1.510619,
        TOLERANCE,
    );
}

#[test]
fn cap_interface_a0_d30_pas_janbu_corrected() {
    check(
        "X17-cap-interface-a0-d30",
        Method::JanbuCorrected,
        CAP_INTERFACE_A0_D30_PAS,
        1.579539,
        TOLERANCE,
    );
}

// X17-cap-bond20-all. Oracle force at the crossing: 126.2266 kN/m.
const CAP_BOND20_ALL_PAS: &str = r#"[{"type": "nail", "id": "N1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 1000, "direction": "axial", "pullout": {"model": "bond", "strength": 20}}]"#;

#[test]
fn cap_bond20_all_pas_bishop() {
    check(
        "X17-cap-bond20-all",
        Method::Bishop,
        CAP_BOND20_ALL_PAS,
        1.315499,
        TOLERANCE,
    );
}

#[test]
fn cap_bond20_all_pas_mp_constant() {
    check(
        "X17-cap-bond20-all",
        Method::MorgensternPriceConstant,
        CAP_BOND20_ALL_PAS,
        1.312303,
        TOLERANCE,
    );
}

#[test]
fn cap_bond20_all_pas_janbu_simplified() {
    check(
        "X17-cap-bond20-all",
        Method::JanbuSimplified,
        CAP_BOND20_ALL_PAS,
        1.261858,
        TOLERANCE,
    );
}

#[test]
fn cap_bond20_all_pas_janbu_corrected() {
    check(
        "X17-cap-bond20-all",
        Method::JanbuCorrected,
        CAP_BOND20_ALL_PAS,
        1.319429,
        TOLERANCE,
    );
}

// X17-cap-tieback-bonded25. Oracle force at the crossing: 86.2266 kN/m.
const CAP_TIEBACK_BONDED25_ACT: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 63, "y2": 28, "application": "active", "tensile_capacity": 150, "direction": "axial", "pullout": {"model": "bond", "strength": 20, "bonded_length": 25}}]"#;

#[test]
fn cap_tieback_bonded25_act_bishop() {
    check(
        "X17-cap-tieback-bonded25",
        Method::Bishop,
        CAP_TIEBACK_BONDED25_ACT,
        1.273594,
        TOLERANCE,
    );
}

#[test]
fn cap_tieback_bonded25_act_mp_constant() {
    check(
        "X17-cap-tieback-bonded25",
        Method::MorgensternPriceConstant,
        CAP_TIEBACK_BONDED25_ACT,
        1.269798,
        TOLERANCE,
    );
}

#[test]
fn cap_tieback_bonded25_act_janbu_simplified() {
    check(
        "X17-cap-tieback-bonded25",
        Method::JanbuSimplified,
        CAP_TIEBACK_BONDED25_ACT,
        1.207886,
        TOLERANCE,
    );
}

#[test]
fn cap_tieback_bonded25_act_janbu_corrected() {
    check(
        "X17-cap-tieback-bonded25",
        Method::JanbuCorrected,
        CAP_TIEBACK_BONDED25_ACT,
        1.262995,
        TOLERANCE,
    );
}

// X17-cap-tieback-bonded10-end1=0. Oracle force at the crossing: 0.0000 kN/m.
const CAP_TIEBACK_BONDED10_END1_0_ACT: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 63, "y2": 28, "application": "active", "tensile_capacity": 150, "direction": "axial", "pullout": {"model": "bond", "strength": 20, "bonded_length": 10}}]"#;

#[test]
fn cap_tieback_bonded10_end1_0_act_bishop() {
    check(
        "X17-cap-tieback-bonded10-end1=0",
        Method::Bishop,
        CAP_TIEBACK_BONDED10_END1_0_ACT,
        0.985084,
        TOLERANCE,
    );
}

#[test]
fn cap_tieback_bonded10_end1_0_act_mp_constant() {
    check(
        "X17-cap-tieback-bonded10-end1=0",
        Method::MorgensternPriceConstant,
        CAP_TIEBACK_BONDED10_END1_0_ACT,
        0.984100,
        TOLERANCE,
    );
}

#[test]
fn cap_tieback_bonded10_end1_0_act_janbu_simplified() {
    check(
        "X17-cap-tieback-bonded10-end1=0",
        Method::JanbuSimplified,
        CAP_TIEBACK_BONDED10_END1_0_ACT,
        0.945229,
        TOLERANCE,
    );
}

#[test]
fn cap_tieback_bonded10_end1_0_act_janbu_corrected() {
    check(
        "X17-cap-tieback-bonded10-end1=0",
        Method::JanbuCorrected,
        CAP_TIEBACK_BONDED10_END1_0_ACT,
        0.988354,
        TOLERANCE,
    );
}

// X17-cap-dev10/10. Oracle force at the crossing: 96.8867 kN/m.
const CAP_DEV10_10_PAS: &str = r#"[{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 100, "direction": "axial", "pullout": {"model": "development", "length1": 10, "length2": 10}}]"#;

#[test]
fn cap_dev10_10_pas_bishop() {
    check(
        "X17-cap-dev10/10",
        Method::Bishop,
        CAP_DEV10_10_PAS,
        1.240397,
        TOLERANCE,
    );
}

#[test]
fn cap_dev10_10_pas_mp_constant() {
    check(
        "X17-cap-dev10/10",
        Method::MorgensternPriceConstant,
        CAP_DEV10_10_PAS,
        1.237628,
        TOLERANCE,
    );
}

#[test]
fn cap_dev10_10_pas_janbu_simplified() {
    check(
        "X17-cap-dev10/10",
        Method::JanbuSimplified,
        CAP_DEV10_10_PAS,
        1.190022,
        TOLERANCE,
    );
}

#[test]
fn cap_dev10_10_pas_janbu_corrected() {
    check(
        "X17-cap-dev10/10",
        Method::JanbuCorrected,
        CAP_DEV10_10_PAS,
        1.244315,
        TOLERANCE,
    );
}

// X17-cap-dev15/20-end1=10. Oracle force at the crossing: 74.5911 kN/m.
const CAP_DEV15_20_END1_10_PAS: &str = r#"[{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 100, "direction": "axial", "end1_capacity": 10, "pullout": {"model": "development", "length1": 15, "length2": 20}}]"#;

#[test]
fn cap_dev15_20_end1_10_pas_bishop() {
    check(
        "X17-cap-dev15/20-end1=10",
        Method::Bishop,
        CAP_DEV15_20_END1_10_PAS,
        1.182758,
        TOLERANCE,
    );
}

#[test]
fn cap_dev15_20_end1_10_pas_mp_constant() {
    check(
        "X17-cap-dev15/20-end1=10",
        Method::MorgensternPriceConstant,
        CAP_DEV15_20_END1_10_PAS,
        1.180341,
        TOLERANCE,
    );
}

#[test]
fn cap_dev15_20_end1_10_pas_janbu_simplified() {
    check(
        "X17-cap-dev15/20-end1=10",
        Method::JanbuSimplified,
        CAP_DEV15_20_END1_10_PAS,
        1.134844,
        TOLERANCE,
    );
}

#[test]
fn cap_dev15_20_end1_10_pas_janbu_corrected() {
    check(
        "X17-cap-dev15/20-end1=10",
        Method::JanbuCorrected,
        CAP_DEV15_20_END1_10_PAS,
        1.186620,
        TOLERANCE,
    );
}

// X17-cap-dev30/30-end2=5. Oracle force at the crossing: 32.2956 kN/m.
const CAP_DEV30_30_END2_5_PAS: &str = r#"[{"type": "geosynthetic", "id": "G1", "x1": 52, "y1": 28, "x2": 25, "y2": 28, "application": "passive", "tensile_capacity": 100, "direction": "axial", "end2_capacity": 5, "pullout": {"model": "development", "length1": 30, "length2": 30}}]"#;

#[test]
fn cap_dev30_30_end2_5_pas_bishop() {
    check(
        "X17-cap-dev30/30-end2=5",
        Method::Bishop,
        CAP_DEV30_30_END2_5_PAS,
        1.071741,
        TOLERANCE,
    );
}

#[test]
fn cap_dev30_30_end2_5_pas_mp_constant() {
    check(
        "X17-cap-dev30/30-end2=5",
        Method::MorgensternPriceConstant,
        CAP_DEV30_30_END2_5_PAS,
        1.070080,
        TOLERANCE,
    );
}

#[test]
fn cap_dev30_30_end2_5_pas_janbu_simplified() {
    check(
        "X17-cap-dev30/30-end2=5",
        Method::JanbuSimplified,
        CAP_DEV30_30_END2_5_PAS,
        1.028436,
        TOLERANCE,
    );
}

#[test]
fn cap_dev30_30_end2_5_pas_janbu_corrected() {
    check(
        "X17-cap-dev30/30-end2=5",
        Method::JanbuCorrected,
        CAP_DEV30_30_END2_5_PAS,
        1.075358,
        TOLERANCE,
    );
}

// The active rows `up30` and `up45` of X17 §4.4 are not oracle rows (see the header): the force is applied by the contract.
/// The factor of safety of V047a with the circle of F3.8 and no reinforcement, Bishop (X17 §4.3, rows `up30` and `up45`).
const UNREINFORCED_BISHOP: f64 = 0.985084;

const INC_UP30_ACT: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 59.382686, "y2": 41.5, "application": "active", "tensile_capacity": 100, "direction": "axial"}]"#;

#[test]
fn inc_up30_act_applies_the_force() {
    let got = fos(&doc(Method::Bishop, INC_UP30_ACT), 0);
    println!("X17-inc-up30-act: ogs {got:.10}, without reinforcement {UNREINFORCED_BISHOP}");
    assert!(
        (got - UNREINFORCED_BISHOP).abs() > 1e-4,
        "the active element in compression must apply its force, but the value is the unreinforced one: {got}"
    );
}

const INC_UP45_ACT: &str = r#"[{"type": "anchor", "id": "A1", "x1": 36, "y1": 28, "x2": 55.091883, "y2": 47.091883, "application": "active", "tensile_capacity": 100, "direction": "axial"}]"#;

#[test]
fn inc_up45_act_applies_the_force() {
    let got = fos(&doc(Method::Bishop, INC_UP45_ACT), 0);
    println!("X17-inc-up45-act: ogs {got:.10}, without reinforcement {UNREINFORCED_BISHOP}");
    assert!(
        (got - UNREINFORCED_BISHOP).abs() > 1e-4,
        "the active element in compression must apply its force, but the value is the unreinforced one: {got}"
    );
}
