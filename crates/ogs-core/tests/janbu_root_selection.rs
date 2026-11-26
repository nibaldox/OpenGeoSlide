//! Janbu's `F₀`, amendment E13j-4: among the roots of the force closure `E_n(F, λ = 0) = 0` the **lowest admissible**
//! one is taken (as in Spencer, E12e), with the note `multiple_admissible_roots` when another admissible root lies
//! more than 1 % above it. Before, the root nearest to Fellenius' value won.
//!
//! The probe of I-M found no model with more than one admissible root (0 of 370 403 calls on the cases, the battery,
//! `pending/F3` and the examples), so the rule is exercised here with a synthetic block of four slices whose closure
//! has two roots above the admissibility bound: 0.4433 and 1.8327 (Fellenius' start is 1.4242, nearer to the
//! upper one). The roots were found by scanning `h(F) = Σ (F·T − R) / (F cos α + tan φ sin α)` on a geometric grid
//! and bisecting, in a script independent of the engine.

use ogs_core::methods::spencer::spencer_interslice;
use ogs_core::methods::{SolveOptions, SolveStatus, solve};
use ogs_core::model::MethodKind;
use ogs_core::slicer::Slice;

/// `(α, b, W, c, tan φ, base length, pore pressure)` of the synthetic block.
const BLOCK: [(f64, f64, f64, f64, f64, f64, f64); 4] = [
    (
        -0.5012922148694521,
        3.251091976778068,
        129.65448945592073,
        0.0,
        0.5894687422507252,
        3.7072197346199816,
        75.49443650827564,
    ),
    (
        0.14005359887238225,
        2.5514556953776633,
        158.72336460550798,
        0.0,
        0.10916241400241457,
        2.576685269417697,
        26.07833385319872,
    ),
    (
        0.6772163382345374,
        2.597875367071131,
        541.5310016265726,
        14.424760348544115,
        0.47414868861392767,
        3.3335153687146684,
        10.222860494980761,
    ),
    (
        -0.5213227224389939,
        2.208969052610459,
        281.65656310233624,
        14.516603649406086,
        0.23388958440171095,
        2.5473569248427492,
        19.602341704019935,
    ),
];

fn slices() -> Vec<Slice> {
    let mut x = 0.0;
    BLOCK
        .iter()
        .map(
            |&(alpha, width, weight, cohesion, tan_phi, base_length, pore_pressure)| {
                let s = Slice {
                    x_left: x,
                    x_right: x + width,
                    y_base_left: 0.0,
                    y_base_right: 0.0,
                    y_top_mid: 5.0,
                    width,
                    alpha,
                    base_length,
                    weight,
                    cohesion,
                    tan_phi,
                    pore_pressure,
                    material: 0,
                    weight_extra: 0.0,
                    h_force: 0.0,
                    h_moment_base: 0.0,
                    driving_extra: 0.0,
                    y_centroid: 0.0,
                };
                x += width;
                s
            },
        )
        .collect()
}

fn opts() -> SolveOptions {
    SolveOptions {
        tolerance: 1e-8,
        max_iterations: 500,
        min_m_alpha: 0.2,
        circular: true,
    }
}

/// Closure residual `E_n / ΣW` of the force march at `λ = 0`, outside the solver.
fn closure(slices: &[Slice], f: f64) -> f64 {
    let w: f64 = slices.iter().map(|s| s.weight).sum();
    spencer_interslice(slices, f, 0.0).last().copied().unwrap() / w
}

#[test]
fn the_closure_of_the_block_has_two_roots_above_the_admissibility_bound() {
    // Control of the fixture: two sign changes, at 0.4433 and 1.8327, both with `m_α ≥ 0.2` on every slice.
    let s = slices();
    let (lo, hi) = (0.43, 1.9);
    let signs: Vec<f64> = [lo, 0.5, 1.0, 1.5, 1.8, hi]
        .iter()
        .map(|&f| closure(&s, f).signum())
        .collect();
    assert_eq!(
        signs,
        [1.0, -1.0, -1.0, -1.0, -1.0, 1.0],
        "closure signs {signs:?}"
    );
}

#[test]
fn janbu_takes_the_lowest_admissible_root_and_flags_the_other() {
    let s = slices();
    let r = solve(&s, MethodKind::JanbuSimplified, &opts());
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    assert!(
        (r.fos - 0.443_313_484_589_6).abs() < 1e-6,
        "F0 {} (the lowest root is 0.4433134846)",
        r.fos
    );
    assert!(
        closure(&s, r.fos).abs() < 1e-9,
        "the reported F0 is not a root: {}",
        closure(&s, r.fos)
    );
    assert!(
        r.warnings.iter().any(|w| w == "multiple_admissible_roots"),
        "warnings {:?}",
        r.warnings
    );
    // The other root (1.8327) is a root too: the note is true, and the rule picked the lower one.
    assert!(closure(&s, 1.832_672_156_556_821).abs() < 1e-9);
    assert!(r.fos < 1.832_672_156_556_821);
}

#[test]
fn janbu_corrected_applies_f0_to_the_lowest_root() {
    let s = slices();
    let (simple, corrected) = (
        solve(&s, MethodKind::JanbuSimplified, &opts()),
        solve(&s, MethodKind::JanbuCorrected, &opts()),
    );
    let f0 = corrected.correction_factor.expect("f0");
    assert!(
        (corrected.fos - f0 * simple.fos).abs() <= 1e-12 * corrected.fos,
        "{} vs {} * {}",
        corrected.fos,
        f0,
        simple.fos
    );
    assert!(
        corrected
            .warnings
            .iter()
            .any(|w| w == "multiple_admissible_roots")
    );
}
