//! Spencer root selection, amendment E12e (`briefs/01_CONTRATOS_FASE1.md` F1.6, evidence in
//! `docs/fase1/exploracion/X5.md` and review R4-01).
//!
//! Rule: the whole range λ ∈ [−0.5; 1.5] is scanned, and among the admissible roots (E11b) the one of smallest F
//! wins (ties within 1e-9 relative: smallest |λ|). The note `multiple_admissible_roots` is emitted when more than one
//! root is admissible and their F differ by more than 1 %.
//!
//! - R4-01 case (1): the old rule (smallest |λ|) returned λ = −0.2268, FS 1.1732 (+3.47 % over cSlope 1.133838); now
//!   FS 1.1341 with λ = +0.2702.
//! - R4-01 case (2): both roots are admissible; the smaller F (1.1325, λ = −0.1720) is reported, which is 7.08 % below
//!   cSlope (1.218789, whose root is the other one). It is the conservative side.
//! - Regressions: R3-01a, R3-01b, D03 (search), and the property "the chosen F is never above the F of another
//!   admissible root", with each root checked as an equilibrium state independently of the solver.
//!
//! cSlope values come from `verification/harness/to_cslope.py` with cslope 0.1.0 on the fixed circles (scratch script
//! `b1_oracle.py` of the B1 session).

use ogs_core::analyze;
use ogs_core::geometry::PreparedModel;
use ogs_core::methods::spencer::{SpencerRoot, spencer_interslice, spencer_roots};
use ogs_core::methods::{SolveOptions, SolveStatus, solve};
use ogs_core::model::{Circle, MethodKind, Model};
use ogs_core::report::MethodReport;
use ogs_core::slicer::{Slice, slice_circle};
use serde_json::{Value, json};

const D03: &str = include_str!("../../../verification/differential/cases/D03.ogs.json");

/// cSlope 0.1.0 Spencer (Morgenstern-Price, constant f) on the fixed circles below.
const CSLOPE_R4_01_CASE1: f64 = 1.133_838_187_609_605_8;
const CSLOPE_R4_01_CASE2: f64 = 1.218_788_779_983_493_8;
const CSLOPE_R3_01A: f64 = 1.597_387_286_910_499_2;
const CSLOPE_D03_SEARCH: f64 = 0.546_673_842_037_715_4;

type Layer = (f64, f64, f64, Option<f64>);

/// Two-layer slope of R4-01: the terrain `[[0,0],[0,10],[10,10],[30,25],[60,25],[60,0]]` split at height `y_split`
/// into `top` and `bot`, each `(c, φ, γ, r_u)`. The split is where the terrain (slope 0.75 from (10,10) to (30,25))
/// reaches `y_split`. Same model as `regression_r3_methods.rs`.
fn two_layer_model(id: &str, y_split: f64, top: Layer, bot: Layer) -> Value {
    let x_split = 10.0 + (y_split - 10.0) * 20.0 / 15.0;
    let material = |name: &str, (c, phi, gamma, ru): Layer| {
        json!({
            "id": name, "name": name, "model": "mohr_coulomb",
            "unit_weight": gamma, "unit_weight_sat": null,
            "cohesion": c, "friction_angle": phi, "ru": ru
        })
    };
    json!({
        "format": "opengeoslide", "version": "0.1",
        "meta": {"id": id, "title": "R4-01 two-layer slope"},
        "units": "SI",
        "materials": [material("top", top), material("bot", bot)],
        "regions": [
            {"material": "top", "polygon": [[x_split, y_split], [30.0, 25.0], [60.0, 25.0], [60.0, y_split]]},
            {"material": "bot", "polygon": [[0.0, 0.0], [0.0, 10.0], [10.0, 10.0], [x_split, y_split],
                                             [60.0, y_split], [60.0, 0.0]]}
        ],
        "slope": {"direction": "auto"},
        "analysis": {
            "methods": ["spencer"], "slices": 50, "tolerance": 1e-5, "max_iterations": 500,
            "min_m_alpha": 0.2
        }
    })
}

fn r4_01_case1() -> Value {
    two_layer_model(
        "R4-01-1",
        20.0,
        (40.0, 0.0, 20.0, None),
        (10.0, 30.0, 20.0, Some(0.3)),
    )
}

fn r4_01_case2() -> Value {
    two_layer_model(
        "R4-01-2",
        14.0,
        (50.0, 0.0, 22.0, None),
        (2.0, 45.0, 20.0, Some(0.5)),
    )
}

/// Runs Spencer on the fixed circle `(xc, yc, r)` of the model document `doc`.
fn fixed_run(doc: &Value, circle: (f64, f64, f64)) -> MethodReport {
    let mut m = doc.clone();
    m["analysis"]["methods"] = json!(["spencer"]);
    m["analysis"]["surface"] =
        json!({"type": "circle", "xc": circle.0, "yc": circle.1, "r": circle.2});
    let model: Model = serde_json::from_value(m).expect("model");
    let report = analyze(&model).expect("analyze");
    report.results.into_iter().next().expect("one method")
}

fn has(r: &MethodReport, code: &str) -> bool {
    r.warnings.iter().any(|w| w == code)
}

fn slices_of(doc: &Value, circle: (f64, f64, f64)) -> Vec<Slice> {
    let model: Model = serde_json::from_value(doc.clone()).expect("model");
    let pm = PreparedModel::new(&model).expect("prepared model");
    let c = Circle {
        xc: circle.0,
        yc: circle.1,
        r: circle.2,
    };
    slice_circle(&pm, &c, 50).expect("slices")
}

fn options() -> SolveOptions {
    SolveOptions {
        tolerance: 1e-5,
        max_iterations: 500,
        min_m_alpha: 0.2,
    }
}

/// Independent check of one root as an equilibrium state (E12b ii): the force closure `|E_n| ≤ 1e-6·ΣW` and the
/// moment residual `Σ b (E_k + E_{k+1})(tan α − λ) − 2·Σ h_moment_base`, normalised by `ΣW·Σb`, below 1e-6.
fn assert_equilibrium(slices: &[Slice], root: &SpencerRoot) {
    let e = spencer_interslice(slices, root.fos, root.lambda);
    let total_w: f64 = slices.iter().map(|s| s.weight).sum();
    let total_b: f64 = slices.iter().map(|s| s.width).sum();
    let closure = e.last().copied().unwrap().abs();
    assert!(
        closure <= 1e-6 * total_w,
        "closure {closure} at {root:?} (ΣW {total_w})"
    );
    let moment: f64 = slices
        .iter()
        .enumerate()
        .map(|(k, s)| s.width * (e[k] + e[k + 1]) * (s.alpha.tan() - root.lambda))
        .sum::<f64>()
        - 2.0 * slices.iter().map(|s| s.h_moment_base).sum::<f64>();
    let rho = moment / (total_w * total_b);
    assert!(rho.abs() <= 1e-6, "ρ {rho} at {root:?}");
}

/// The admissible roots of `slices`, each one verified as an equilibrium state.
fn admissible_roots(slices: &[Slice]) -> Vec<SpencerRoot> {
    let roots = spencer_roots(slices, &options()).expect("scan");
    let adm: Vec<SpencerRoot> = roots.into_iter().filter(|r| r.admissible).collect();
    for r in &adm {
        assert_equilibrium(slices, r);
    }
    adm
}

/// Property: when Spencer converges, its F is the smallest F of the admissible roots (E12e), and the note
/// `multiple_admissible_roots` appears exactly when a second admissible root is more than 1 % above it. Returns whether
/// the note was expected.
fn assert_chooses_smallest_f(slices: &[Slice], label: &str) -> bool {
    let res = solve(slices, MethodKind::Spencer, &options());
    let adm = admissible_roots(slices);
    if res.status != SolveStatus::Converged {
        assert!(adm.is_empty(), "{label}: {res:?} with roots {adm:?}");
        return false;
    }
    let fmin = adm.iter().map(|r| r.fos).fold(f64::INFINITY, f64::min);
    assert!(
        res.fos <= fmin * (1.0 + 1e-9),
        "{label}: chosen F {} above the smallest admissible F {fmin} ({adm:?})",
        res.fos
    );
    for r in &adm {
        assert!(
            res.fos <= r.fos * (1.0 + 1e-9),
            "{label}: F {} above the F of {r:?}",
            res.fos
        );
    }
    let fmax = adm.iter().map(|r| r.fos).fold(f64::NEG_INFINITY, f64::max);
    let expected = adm.len() > 1 && fmax > fmin * 1.01;
    assert_eq!(
        res.warnings
            .iter()
            .any(|w| w == "multiple_admissible_roots"),
        expected,
        "{label}: notes {:?}, roots {adm:?}",
        res.warnings
    );
    expected
}

// ---------------------------------------------------------------------------------------------------- R4-01

/// R4-01 case (1): two admissible roots, λ = −0.2268 (FS 1.1732) and λ = +0.2702 (FS 1.1341). The smaller F wins, which
/// is the root of cSlope (1.133838, ≤ 0.1 %), and the note is emitted. Before E12e: 1.173171, +3.47 % over cSlope.
#[test]
fn r4_01_case1_picks_the_smaller_f_and_matches_cslope() {
    let doc = r4_01_case1();
    let circle = (10.0, 36.0, 27.0);
    let r = fixed_run(&doc, circle);
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let fos = r.fos.expect("finite");
    let lambda = r.lambda.expect("λ");
    assert!(
        (fos - CSLOPE_R4_01_CASE1).abs() / CSLOPE_R4_01_CASE1 <= 1e-3,
        "FS {fos} vs cSlope {CSLOPE_R4_01_CASE1}"
    );
    assert!((fos - 1.1341).abs() <= 1e-4, "FS {fos}");
    assert!((lambda - 0.270_172).abs() <= 1e-3, "λ {lambda}");
    assert!(has(&r, "multiple_admissible_roots"), "{r:?}");
    assert!(!has(&r, "negative_lambda"), "{r:?}");

    // The two roots of X5 §2.2, each an equilibrium state; the chosen F is the smaller one.
    let slices = slices_of(&doc, circle);
    let adm = admissible_roots(&slices);
    assert_eq!(adm.len(), 2, "{adm:?}");
    let neg = adm.iter().find(|r| r.lambda < 0.0).expect("negative root");
    let pos = adm.iter().find(|r| r.lambda > 0.0).expect("positive root");
    assert!((neg.lambda + 0.226_765).abs() <= 1e-4, "{neg:?}");
    assert!((neg.fos - 1.173_171).abs() <= 1e-4, "{neg:?}");
    assert!((pos.lambda - 0.270_172).abs() <= 1e-4, "{pos:?}");
    assert!((pos.fos - 1.134_112).abs() <= 1e-4, "{pos:?}");
    assert!(fos <= neg.fos);
    assert!(assert_chooses_smallest_f(&slices, "R4-01 (1)"));
}

/// R4-01 case (2): both roots are admissible, λ = −0.1720 (FS 1.1325) and λ = +0.2363 (FS 1.2188). Spencer reports the
/// root of smaller F, 7.08 % below cSlope (1.218789), which follows the other root: the conservative side. Both notes
/// are emitted. Same value as before E12e, because here the smaller |λ| and the smaller F coincide.
#[test]
fn r4_01_case2_reports_the_root_of_smaller_f() {
    let doc = r4_01_case2();
    let circle = (16.0, 36.0, 26.0);
    let r = fixed_run(&doc, circle);
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let fos = r.fos.expect("finite");
    let lambda = r.lambda.expect("λ");
    assert!((fos - 1.1325).abs() <= 1e-4, "FS {fos}");
    assert!((lambda + 0.171_989).abs() <= 1e-3, "λ {lambda}");
    assert!(
        fos < CSLOPE_R4_01_CASE2,
        "FS {fos} must be below cSlope {CSLOPE_R4_01_CASE2} (conservative)"
    );
    assert!(has(&r, "multiple_admissible_roots"), "{r:?}");
    assert!(has(&r, "negative_lambda"), "{r:?}");

    let slices = slices_of(&doc, circle);
    let adm = admissible_roots(&slices);
    assert_eq!(adm.len(), 2, "{adm:?}");
    let other = adm.iter().find(|r| r.lambda > 0.0).expect("positive root");
    assert!((other.lambda - 0.236_262).abs() <= 1e-4, "{other:?}");
    assert!((other.fos - 1.218_769).abs() <= 1e-4, "{other:?}");
    // The other root is the one cSlope follows.
    assert!((other.fos - CSLOPE_R4_01_CASE2).abs() / CSLOPE_R4_01_CASE2 <= 1e-3);
    assert!(assert_chooses_smallest_f(&slices, "R4-01 (2)"));
}

// ------------------------------------------------------------------------------------------- regressions

/// R3-01a: one admissible root (λ = −0.371 has Φ/F = 0.073, not admissible). FS 1.5977 against cSlope 1.597387 (+0.019 %),
/// no `multiple_admissible_roots`, no `negative_lambda`.
#[test]
fn r3_01a_is_unchanged() {
    let doc = two_layer_model(
        "R3-01a",
        16.0,
        (40.0, 0.0, 20.0, None),
        (5.0, 35.0, 20.0, None),
    );
    let circle = (12.0, 35.0, 26.0);
    let r = fixed_run(&doc, circle);
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let fos = r.fos.expect("finite");
    assert!((fos - 1.5974).abs() <= 1e-3, "FS {fos}");
    assert!(
        (fos - CSLOPE_R3_01A).abs() / CSLOPE_R3_01A <= 1e-3,
        "FS {fos} vs cSlope {CSLOPE_R3_01A}"
    );
    assert!((r.lambda.expect("λ") - 0.401_834).abs() <= 1e-4, "{r:?}");
    assert!(!has(&r, "multiple_admissible_roots"), "{r:?}");
    assert!(!has(&r, "negative_lambda"), "{r:?}");
    assert!(!assert_chooses_smallest_f(
        &slices_of(&doc, circle),
        "R3-01a"
    ));
}

/// R3-01b: one admissible root, λ = +0.766074, FS 0.268487 (the cSlope of this fixed surface does not converge).
#[test]
fn r3_01b_is_unchanged() {
    let doc = two_layer_model(
        "R3-01b",
        15.0,
        (20.0, 40.0, 20.0, Some(0.4)),
        (2.0, 0.0, 20.0, None),
    );
    let circle = (14.0, 38.0, 28.0);
    let r = fixed_run(&doc, circle);
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    assert!((r.fos.expect("finite") - 0.268_487).abs() <= 1e-4, "{r:?}");
    assert!((r.lambda.expect("λ") - 0.766_074).abs() <= 1e-3, "{r:?}");
    assert!(!has(&r, "multiple_admissible_roots"), "{r:?}");
    assert!(!assert_chooses_smallest_f(
        &slices_of(&doc, circle),
        "R3-01b"
    ));
}

/// D03, search: the F stays at 0.549743 (+0.55 % over cSlope 0.546674, E9b ≤ 1 %), with λ = −0.1345 and now the note
/// `multiple_admissible_roots` (the other admissible root has λ > 0, R4-05).
#[test]
fn d03_search_stays_within_one_percent_of_cslope() {
    let mut m: Value = serde_json::from_str(D03).expect("json");
    m["analysis"]["methods"] = json!(["spencer"]);
    let model: Model = serde_json::from_value(m).expect("model");
    let r = analyze(&model)
        .expect("analyze")
        .results
        .into_iter()
        .next()
        .expect("one method");
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    let fos = r.fos.expect("finite");
    assert!(fos <= CSLOPE_D03_SEARCH * 1.01, "FS {fos}");
    assert!((fos - 0.549_743).abs() <= 1e-5, "FS {fos}");
    assert!(has(&r, "negative_lambda"), "{r:?}");
    assert!(has(&r, "multiple_admissible_roots"), "{r:?}");
}

/// Property over a grid of two-layer models (a reduced version of the X5 sweep): in no case the chosen F is above
/// the F of another admissible root, and the note matches the 1 % rule. The grid must contain cases with the note,
/// otherwise the test would not exercise the rule.
#[test]
fn chosen_f_is_never_above_another_admissible_root() {
    let circles = [(10.0, 36.0, 27.0), (12.0, 35.0, 26.0), (14.0, 38.0, 28.0)];
    let (mut total, mut with_note, mut multi_root) = (0, 0, 0);
    for y_split in [14.0, 18.0, 22.0] {
        for c_top in [10.0, 40.0, 74.0] {
            for phi_bot in [30.0, 45.0] {
                for ru in [None, Some(0.5)] {
                    let doc = two_layer_model(
                        "grid",
                        y_split,
                        (c_top, 0.0, 20.0, None),
                        (2.0, phi_bot, 20.0, ru),
                    );
                    for circle in circles {
                        let slices = slices_of(&doc, circle);
                        total += 1;
                        let label =
                            format!("y={y_split} c_top={c_top} φ={phi_bot} ru={ru:?} {circle:?}");
                        if assert_chooses_smallest_f(&slices, &label) {
                            with_note += 1;
                        }
                        if admissible_roots(&slices).len() > 1 {
                            multi_root += 1;
                        }
                    }
                }
            }
        }
    }
    println!(
        "grid: {total} models, {multi_root} with several admissible roots, {with_note} with the note"
    );
    assert!(with_note >= 1, "no model of the grid exercises the note");
    assert!(multi_root >= with_note);
}
