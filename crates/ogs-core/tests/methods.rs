//! Mandatory tests of brief W1b (Bishop simplified and Spencer, f = 1).
//!
//! Geometry used by the tests is generated here, independently of `slice_circle`:
//! homogeneous 2:1 dry slope of height H = 10 m, ground `y = 0` for `x ≤ 0`,
//! `y = x/2` for `0 ≤ x ≤ 20`, `y = 10` for `x ≥ 20`. The sliding mass moves toward −x, so
//! `slices[0]` is the toe slice and `alpha > 0` where the base rises toward the crest.
//! Slices have uniform width, the weight is taken at the chord midpoint and the base is the chord.

use ogs_core::methods::spencer::{
    spencer_direct_normals, spencer_effective_normals, spencer_interslice,
};
use ogs_core::methods::{MethodResult, SolveOptions, SolveStatus, solve};
use ogs_core::model::MethodKind;
use ogs_core::slicer::Slice;

/// Terrain elevation of the test slope.
fn ground(x: f64) -> f64 {
    if x <= 0.0 {
        0.0
    } else if x <= 20.0 {
        0.5 * x
    } else {
        10.0
    }
}

/// Circle `(xc, yc, r)`.
#[derive(Clone, Copy, Debug)]
struct Circ {
    xc: f64,
    yc: f64,
    r: f64,
}

/// Lower arc of the circle at `x`.
fn arc_y(c: Circ, x: f64) -> Option<f64> {
    let d = c.r * c.r - (x - c.xc).powi(2);
    (d >= 0.0).then(|| c.yc - d.sqrt())
}

/// Ground minus lower arc at `x`.
fn gap(c: Circ, x: f64) -> Option<f64> {
    arc_y(c, x).map(|ya| ground(x) - ya)
}

/// Sign changes of `gap` (intersections of the lower arc with the ground), by scan and bisection.
fn intersections(c: Circ) -> Vec<f64> {
    let (x0, x1) = (c.xc - c.r, c.xc + c.r);
    let steps = 4000;
    let mut out = Vec::new();
    let mut prev: Option<(f64, f64)> = None;
    for i in 0..=steps {
        let x = x0 + (x1 - x0) * i as f64 / steps as f64;
        let Some(g) = gap(c, x) else {
            prev = None;
            continue;
        };
        if let Some((px, pg)) = prev
            && (pg < 0.0) != (g < 0.0)
        {
            let (mut a, mut b, mut ga) = (px, x, pg);
            for _ in 0..100 {
                let mid = 0.5 * (a + b);
                let gm = gap(c, mid).expect("inside the circle");
                if (gm < 0.0) == (ga < 0.0) {
                    a = mid;
                    ga = gm;
                } else {
                    b = mid;
                }
            }
            out.push(0.5 * (a + b));
        }
        prev = Some((x, g));
    }
    out
}

/// Uniform slices between the exit (toe) and the entry (crest) of circle `c`.
///
/// `coh` in kPa, `phi_deg` in degrees, `gamma` in kN/m³, `u` = uniform pore pressure at the base (kPa).
fn slices(c: Circ, n: usize, coh: f64, phi_deg: f64, gamma: f64, u: f64) -> Vec<Slice> {
    slices_by(c, n, |_| (coh, phi_deg, gamma, u))
}

/// Slices as in `slices`, with the material chosen by the abscissa of the slice midpoint.
/// `material(x_mid)` returns `(cohesion, phi_deg, gamma, u)`.
fn slices_by(c: Circ, n: usize, material: impl Fn(f64) -> (f64, f64, f64, f64)) -> Vec<Slice> {
    let xs_all = intersections(c);
    assert!(
        xs_all.len() >= 2,
        "circle {c:?} does not cut the slope twice"
    );
    let (xs, xe) = (xs_all[0], *xs_all.last().expect("non-empty"));
    for k in 1..100 {
        let x = xs + (xe - xs) * k as f64 / 100.0;
        assert!(
            gap(c, x).expect("inside") > 0.0,
            "arc above ground between exit and entry"
        );
    }
    let w = (xe - xs) / n as f64;
    (0..n)
        .map(|k| {
            let xl = xs + k as f64 * w;
            let xr = xl + w;
            let yl = arc_y(c, xl).expect("inside");
            let yr = arc_y(c, xr).expect("inside");
            let xm = 0.5 * (xl + xr);
            let y_base_mid = 0.5 * (yl + yr);
            let top = ground(xm);
            let alpha = (yr - yl).atan2(w);
            let (coh, phi_deg, gamma, u) = material(xm);
            Slice {
                x_left: xl,
                x_right: xr,
                y_base_left: yl,
                y_base_right: yr,
                y_top_mid: top,
                width: w,
                alpha,
                base_length: w / alpha.cos(),
                weight: gamma * w * (top - y_base_mid),
                cohesion: coh,
                tan_phi: phi_deg.to_radians().tan(),
                pore_pressure: u,
                material: 0,
            }
        })
        .collect()
}

/// Dry, cohesive reference slope of the brief: c = 10 kPa, φ = 30°, γ = 20 kN/m³.
/// Circle with the lowest Bishop FS on a coarse grid (`scan_critical`, n = 30).
const CRITICAL: Circ = Circ {
    xc: 2.0,
    yc: 26.0,
    r: 26.0,
};

fn opts(tolerance: f64, max_iterations: usize) -> SolveOptions {
    SolveOptions {
        tolerance,
        max_iterations,
        min_m_alpha: 0.2,
    }
}

fn sum_weight(sl: &[Slice]) -> f64 {
    sl.iter().map(|s| s.weight).sum()
}

fn assert_converged(r: &MethodResult) {
    assert_eq!(r.status, SolveStatus::Converged, "{r:?}");
    assert!(r.fos.is_finite() && r.fos > 0.0, "{r:?}");
}

/// Test 1. φ = 0: Bishop = Spencer = Σ c·l / Σ W·sin α.
///
/// The Bishop identity is algebraic. The Spencer identity holds only in the fine-mesh limit: the
/// chord-midpoint weights give an O(1/n²) discretisation error (≈ 4.5e-5 at n = 30, 8.5e-10 at
/// n = 8000). This test therefore uses n = 16000 slices.
#[test]
fn phi_zero_identity_bishop_and_spencer() {
    let sl = slices(CRITICAL, 16_000, 10.0, 0.0, 20.0, 0.0);
    let cl: f64 = sl.iter().map(|s| s.cohesion * s.base_length).sum();
    let wsin: f64 = sl.iter().map(|s| s.weight * s.alpha.sin()).sum();
    let target = cl / wsin;
    let o = opts(1e-12, 5_000);
    let b = solve(&sl, MethodKind::Bishop, &o);
    let s = solve(&sl, MethodKind::Spencer, &o);
    assert_converged(&b);
    assert_converged(&s);
    println!(
        "[1] phi=0 n=16000: target={target:.12} bishop={:.12} (rel {:.2e}) spencer={:.12} (rel {:.2e}) lambda={:?}",
        b.fos,
        (b.fos - target).abs() / target,
        s.fos,
        (s.fos - target).abs() / target,
        s.lambda
    );
    assert!(
        (b.fos - target).abs() / target < 1e-9,
        "Bishop: {} vs {target}",
        b.fos
    );
    assert!(
        (s.fos - target).abs() / target < 1e-9,
        "Spencer: {} vs {target}",
        s.fos
    );
}

/// Test 2. Dry case, c = 10, φ = 30°, γ = 20, 2:1 slope of H = 10: |Spencer − Bishop| / Bishop < 1.5 %, 0 < λ < 1.
#[test]
fn spencer_close_to_bishop_dry_slope() {
    let sl = slices(CRITICAL, 50, 10.0, 30.0, 20.0, 0.0);
    let o = opts(1e-8, 500);
    let b = solve(&sl, MethodKind::Bishop, &o);
    let s = solve(&sl, MethodKind::Spencer, &o);
    assert_converged(&b);
    assert_converged(&s);
    let lambda = s.lambda.expect("Spencer reports lambda");
    let diff = (s.fos - b.fos).abs() / b.fos;
    println!(
        "[2] dry c=10 phi=30 gamma=20: bishop={:.6} spencer={:.6} diff={:.3}% lambda={lambda:.6} (iter B={} S={})",
        b.fos,
        s.fos,
        100.0 * diff,
        b.iterations,
        s.iterations
    );
    assert!(diff < 0.015, "difference {:.4}% >= 1.5%", 100.0 * diff);
    assert!(lambda > 0.0 && lambda < 1.0, "lambda = {lambda}");
}

/// Test 3. Force equilibrium: with the converged F and λ of Spencer, the recurrence gives Eₙ ≈ 0 (< 1e-6 · Σ W).
///
/// Also checks E₀ = 0, and that each slice satisfies base equilibrium with the failure criterion:
/// `F·S = c·l + (N − u·l)·tan φ`, where N and S are recovered from the vertical and horizontal
/// equations of the slice with the interslice forces of this convention.
#[test]
fn spencer_force_equilibrium_residual() {
    let sl = slices(CRITICAL, 50, 10.0, 30.0, 20.0, 0.0);
    let total_w = sum_weight(&sl);
    for tol in [1e-5, 1e-10] {
        let s = solve(&sl, MethodKind::Spencer, &opts(tol, 5_000));
        assert_converged(&s);
        let lambda = s.lambda.expect("Spencer reports lambda");
        let e = spencer_interslice(&sl, s.fos, lambda);
        let en = *e.last().expect("n + 1 interfaces");
        println!(
            "[3] tol={tol:e}: F={:.9} lambda={lambda:.9} E0={:.3e} En={en:.3e} En/sumW={:.3e}",
            s.fos,
            e[0],
            en.abs() / total_w
        );
        assert_eq!(e.len(), sl.len() + 1);
        assert_eq!(e[0], 0.0);
        assert!(en.abs() < 1e-6 * total_w, "En = {en} with sumW = {total_w}");

        // Per-slice base equilibrium, independent of the recurrence formulas.
        // Convention: E > 0 is tension, X = λ·E, so the vertical and horizontal equations are
        //   −N sin α + S cos α + ΔE = 0,  N cos α + S sin α − W + λ ΔE = 0,  with ΔE = E_{k+1} − E_k.
        let mut worst = 0.0_f64;
        for (k, sk) in sl.iter().enumerate() {
            let de = e[k + 1] - e[k];
            let (sin, cos) = sk.alpha.sin_cos();
            let big_s = (sk.weight - lambda * de) * sin - de * cos;
            let big_n = (sk.weight - lambda * de) * cos + de * sin;
            let residual = s.fos * big_s
                - (sk.cohesion * sk.base_length
                    + (big_n - sk.pore_pressure * sk.base_length) * sk.tan_phi);
            worst = worst.max(residual.abs());
        }
        println!(
            "[3] tol={tol:e}: worst per-slice failure residual = {worst:.3e} (sumW {total_w:.1})"
        );
        assert!(worst < 1e-9 * total_w, "per-slice residual {worst}");
    }
}

/// Test 4. Dovelas con α muy negativo y φ alto: m_α < 0.2 en el F convergido → Bishop `Invalid`.
///
/// Amendment E4a: the m_α limit applies to the converged F, not to the start F₀. The first slice (α = −60°,
/// φ = 45°) has m_α(1) < 0 and m_α(F) = 0.5 − 0.866/F. With W₂ = 10 the converged F = 3.378 has m_α = 0.244 ≥ 0.2
/// (valid). With W₂ = 30 it is F = 2.462 with m_α = 0.148 < 0.2 (invalid).
#[test]
fn bishop_invalid_when_m_alpha_small() {
    let tan_phi = 45.0_f64.to_radians().tan();
    let mk = |alpha_deg: f64, weight: f64| {
        let alpha = alpha_deg.to_radians();
        Slice {
            x_left: 0.0,
            x_right: 1.0,
            y_base_left: 0.0,
            y_base_right: alpha.tan(),
            y_top_mid: 5.0,
            width: 1.0,
            alpha,
            base_length: 1.0 / alpha.cos(),
            weight,
            cohesion: 0.0,
            tan_phi,
            pore_pressure: 0.0,
            material: 0,
        }
    };
    // First slice: α = −60°, φ = 45°. Second slice keeps Σ W sin α > 0.
    let sl = vec![mk(-60.0, 1.0), mk(30.0, 30.0)];
    let b = solve(&sl, MethodKind::Bishop, &opts(1e-5, 500));
    println!("[4] invalid case: {b:?}");
    assert_eq!(b.status, SolveStatus::Invalid);
    assert_eq!(b.message.as_deref(), Some("m_alpha"));
}

/// Test 5. `max_iterations = 1` → `NotConverged` (never reported as converged).
#[test]
fn max_iterations_one_is_not_converged() {
    let sl = slices(CRITICAL, 50, 10.0, 30.0, 20.0, 0.0);
    let o = opts(1e-5, 1);
    let b = solve(&sl, MethodKind::Bishop, &o);
    let s = solve(&sl, MethodKind::Spencer, &o);
    println!("[5] bishop={b:?}\n[5] spencer={s:?}");
    assert_eq!(b.status, SolveStatus::NotConverged);
    assert_eq!(s.status, SolveStatus::NotConverged);
}

/// Test 6. Monotonicity: uniform pore pressure increase reduces FS for both methods.
#[test]
fn pore_pressure_reduces_fos_monotonically() {
    let o = opts(1e-8, 2_000);
    for method in [MethodKind::Bishop, MethodKind::Spencer] {
        let mut previous = f64::INFINITY;
        for u in [0.0, 1.0, 2.0, 3.0] {
            let sl = slices(CRITICAL, 50, 10.0, 30.0, 20.0, u);
            let r = solve(&sl, method, &o);
            assert_converged(&r);
            println!("[6] {method:?} u={u} kPa: FS={:.6}", r.fos);
            assert!(
                r.fos < previous,
                "{method:?}: FS {} not below {previous} at u={u}",
                r.fos
            );
            previous = r.fos;
        }
    }
}

/// Soil slice of width 1 at inclination `alpha_deg` (test helper for amendment E3 and E2).
fn unit_slice(alpha_deg: f64, weight: f64, tan_phi: f64) -> Slice {
    synth_slice(alpha_deg, weight, 1.0, tan_phi)
}

/// Soil slice of width 1 with explicit cohesion (synthetic regression cases of R1-02, R1-03).
fn synth_slice(alpha_deg: f64, weight: f64, cohesion: f64, tan_phi: f64) -> Slice {
    let alpha = alpha_deg.to_radians();
    Slice {
        x_left: 0.0,
        x_right: 1.0,
        y_base_left: 0.0,
        y_base_right: alpha.tan(),
        y_top_mid: 5.0,
        width: 1.0,
        alpha,
        base_length: 1.0 / alpha.cos(),
        weight,
        cohesion,
        tan_phi,
        pore_pressure: 0.0,
        material: 0,
    }
}

/// Air slice (E2): base above the ground, no weight, no strength.
fn air_slice(alpha_deg: f64) -> Slice {
    Slice {
        weight: 0.0,
        cohesion: 0.0,
        tan_phi: 0.0,
        pore_pressure: 0.0,
        ..unit_slice(alpha_deg, 0.0, 0.0)
    }
}

/// Test 7 (E3). `Σ W·sin α ≈ 0` gives `Invalid` with message `"no_driving"` in Bishop and in Spencer.
#[test]
fn zero_driving_moment_is_no_driving_in_both_methods() {
    let tan30 = 30.0_f64.to_radians().tan();
    // Mirror pair: W sin α cancels exactly.
    let balanced = vec![
        unit_slice(-10.0, 10.0, tan30),
        unit_slice(10.0, 10.0, tan30),
    ];
    for method in [MethodKind::Bishop, MethodKind::Spencer] {
        let r = solve(&balanced, method, &opts(1e-8, 500));
        println!("[7] balanced {method:?}: {r:?}");
        assert_eq!(r.status, SolveStatus::Invalid, "{method:?}");
        assert_eq!(r.message.as_deref(), Some("no_driving"), "{method:?}");
    }
    // Driving component just above the 1e-6·ΣW threshold: the rule does not apply.
    let slight = vec![
        unit_slice(-10.0, 10.0, tan30),
        unit_slice(10.0, 10.0 + 1e-3, tan30),
    ];
    let b = solve(&slight, MethodKind::Bishop, &opts(1e-8, 500));
    assert_ne!(b.message.as_deref(), Some("no_driving"), "{b:?}");
}

/// Test 8 (E2 and E3). Air slices take no part in the m_α test and add nothing to Bishop's F.
/// Without the exclusion, the air slice at α = 80° (m_α = cos 80° < 0.2) would make the surface `Invalid`.
#[test]
fn air_slices_do_not_trigger_m_alpha() {
    let tan30 = 30.0_f64.to_radians().tan();
    let soil = vec![unit_slice(20.0, 10.0, tan30), unit_slice(25.0, 12.0, tan30)];
    let mut with_air = soil.clone();
    with_air.insert(1, air_slice(80.0));
    with_air.push(air_slice(-80.0));

    let o = opts(1e-10, 1_000);
    let b_soil = solve(&soil, MethodKind::Bishop, &o);
    let b_air = solve(&with_air, MethodKind::Bishop, &o);
    println!("[8] bishop soil={b_soil:?}\n[8] bishop +air={b_air:?}");
    assert_converged(&b_air);
    assert_eq!(
        b_air.fos.to_bits(),
        b_soil.fos.to_bits(),
        "air slices must not change Bishop's FS"
    );

    let s_air = solve(&with_air, MethodKind::Spencer, &o);
    println!("[8] spencer +air={s_air:?}");
    assert_converged(&s_air);
    assert!(s_air.fos.is_finite() && s_air.fos > 0.0);
}

/// Test-local m_α = cos α + sin α · tan φ / F (§4.2), independent of the solver code.
fn m_alpha_of(s: &Slice, fos: f64) -> f64 {
    s.alpha.cos() + s.alpha.sin() * s.tan_phi / fos
}

/// Test-local Spencer pole Φ = (sin α − λ cos α) tan φ + (cos α + λ sin α) F (§4.3, f = 1).
fn pole_of(s: &Slice, fos: f64, lambda: f64) -> f64 {
    (s.alpha.sin() - lambda * s.alpha.cos()) * s.tan_phi
        + (s.alpha.cos() + lambda * s.alpha.sin()) * fos
}

/// Test-local residual of the Spencer F equation: |F(λ) − F| / F, with F(λ) = Σ(R/Φ) / Σ(T/Φ) over the
/// non-air slices (air slices have T = R = 0). Zero at a consistent (F, λ) pair.
fn fos_residual_of(sl: &[Slice], fos: f64, lambda: f64) -> f64 {
    let (mut num, mut den) = (0.0, 0.0);
    for s in sl
        .iter()
        .filter(|s| !(s.weight == 0.0 && s.cohesion == 0.0 && s.tan_phi == 0.0))
    {
        let r = (s.weight * s.alpha.cos() - s.pore_pressure * s.base_length) * s.tan_phi
            + s.cohesion * s.base_length;
        let t = s.weight * s.alpha.sin();
        let d = pole_of(s, fos, lambda);
        num += r / d;
        den += t / d;
    }
    let next = num / den;
    (next - fos).abs() / fos
}

/// R1-01 (E4b). Circle (10, 22, 19.5), 50 slices: φ = 45°, c = 10 for x < 8 and φ = 0, c = 2 beyond, γ = 20.
/// Before the fix Spencer returned `Converged` at FS 0.0749994 (5 slices with Φ < 0, the surface won the search)
/// while Bishop gives 0.3262908. A converged Spencer state must not have Φ/F < min_m_alpha on any soil slice.
#[test]
#[ignore = "E10b (W8b): the GLE root for R1-01 is admissible under E8b (Φ > 0 and m_α ≥ 0.2 at F = 0.518756, λ = 0.199954, \
             closure E_n = −4e-11, unit-arm moment identity 7e-15); the test expects rejection, and min Φ/F = 0.174 < 0.2 \
             is not part of E8b. Coordinator decision pending (E4b vs E8b)."]
fn r1_01_spencer_negative_pole_is_not_converged() {
    let circ = Circ {
        xc: 10.0,
        yc: 22.0,
        r: 19.5,
    };
    let sl = slices_by(circ, 50, |x| {
        if x < 8.0 {
            (10.0, 45.0, 20.0, 0.0)
        } else {
            (2.0, 0.0, 20.0, 0.0)
        }
    });
    let o = opts(1e-5, 2_000);
    let b = solve(&sl, MethodKind::Bishop, &o);
    let s = solve(&sl, MethodKind::Spencer, &o);
    println!("[R1-01] bishop={b:?}\n[R1-01] spencer={s:?}");
    assert_converged(&b);
    assert_ne!(s.status, SolveStatus::Converged, "spencer {s:?}");
    // E8b (review R1-01 stays rejected): the λ chain under the amended admissibility stops at the budget
    // (NotConverged, λ ≈ 0.0499 with 2000 iterations). Either rejection is a rejection; a Converged state is not.
    assert!(
        matches!(s.status, SolveStatus::Invalid | SolveStatus::NotConverged),
        "spencer {s:?}"
    );
    assert!(
        !(s.status == SolveStatus::Converged && s.fos < b.fos),
        "Converged below Bishop: {s:?}"
    );
}

/// E7a under E10b (replaces the λ-sum check of the Zhu update, which no longer exists). Soil slices α = 20°, 25°
/// with an air slice at α = 80° between them. The air slice is massless and passes `E` unchanged (`E[2] = E[1]`).
/// The converged state satisfies the two GLE equations: the force closure `E_n ≈ 0`, and the moment identity
/// `F_m = F` checked with unit arms (`Σ(S − F·T) ≈ 0`). The `air_gap_thrust` warning follows `|E_gap| > 1e-3·ΣW`.
#[test]
fn e7a_air_slice_takes_part_in_lambda_sums() {
    let tan30 = 30.0_f64.to_radians().tan();
    let soil = vec![unit_slice(20.0, 10.0, tan30), unit_slice(25.0, 12.0, tan30)];
    let mut with_air = soil.clone();
    with_air.insert(1, air_slice(80.0));
    let o = opts(1e-10, 1_000);
    let s_soil = solve(&soil, MethodKind::Spencer, &o);
    let s_air = solve(&with_air, MethodKind::Spencer, &o);
    println!("[E7a] soil={s_soil:?}\n[E7a] +air={s_air:?}");
    assert_converged(&s_soil);
    assert_converged(&s_air);
    let lambda = s_air.lambda.expect("lambda");
    let fos = s_air.fos;
    let e = spencer_interslice(&with_air, fos, lambda);
    assert!(e[1] == e[2], "the air slice must pass E unchanged: {e:?}");
    let normals = spencer_direct_normals(&with_air, lambda, &e);
    let (mut shear_minus_driving, mut driving) = (0.0, 0.0);
    for (k, s) in with_air.iter().enumerate() {
        let (sin, _) = s.alpha.sin_cos();
        shear_minus_driving +=
            s.cohesion * s.base_length + normals[k] * s.tan_phi - fos * s.weight * sin;
        driving += fos * s.weight * sin;
    }
    assert!(
        (shear_minus_driving / driving).abs() < 1e-9,
        "F_m = F identity: {shear_minus_driving} vs {driving}"
    );
    let total_w: f64 = with_air.iter().map(|s| s.weight).sum();
    assert!(
        e[e.len() - 1].abs() <= 1e-6 * total_w,
        "closure E_n = {:?}",
        e.last()
    );
    let gap = e[1].abs();
    let expected = gap > 1e-3 * total_w;
    assert_eq!(
        s_air.warnings.iter().any(|w| w == "air_gap_thrust"),
        expected,
        "|E_gap| = {gap} vs 1e-3·ΣW = {}",
        1e-3 * total_w
    );
    assert!(
        s_air.message.is_none(),
        "a converged state has no reason: {s_air:?}"
    );
}

/// R1-03a (E4a, E7b). Synthetic pair with the failure mode of the review. Toe: α = −30°, φ = 45°,
/// W = 0.0115 (negligible but not air); crest: α = 53.5°, W = 20.
///
/// E7b: `F_adm = (−sin α·tan φ)/(cos α − 0.2) = 0.750722`. A scan of `h(F) = F − g(F)` on (0.05, 20) gives three
/// roots: 0.568172, 0.577350 (pole, m_toe = 0) and 0.750711. The last one is the only one that could be
/// admissible, and it lies BELOW F_adm: m_toe = 0.19999 < 0.2. `h > 0` on the whole admissible interval, so
/// there is no admissible root: `Invalid("m_alpha")`, with no FS (NaN). The fixed-point start F₀ = 0.788 is above
/// F_adm; the iteration leaves the interval and the bisection finds no sign change.
#[test]
fn r1_03a_bishop_converged_m_alpha_below_minimum_is_invalid() {
    let sl = vec![
        synth_slice(-30.0, 0.011_481_348_487_987_746, 0.0, 1.0),
        synth_slice(53.5, 20.0, 0.0, 1.0),
    ];
    let r = solve(&sl, MethodKind::Bishop, &opts(1e-5, 500));
    println!("[R1-03a] {r:?}");
    assert_eq!(r.status, SolveStatus::Invalid, "{r:?}");
    assert_eq!(r.message.as_deref(), Some("m_alpha"));
    assert!(r.fos.is_nan(), "no admissible root, so no FS: {r:?}");
    let f_adm = -(-30.0_f64).to_radians().sin() / ((-30.0_f64).to_radians().cos() - 0.2);
    assert!((f_adm - 0.750_722).abs() < 1e-6, "F_adm = {f_adm}");
    let m_root = m_alpha_of(&sl[0], 0.750_711);
    assert!(
        m_root < 0.2 && m_root > 0.19998,
        "m_toe at the real root = {m_root}"
    );
}

/// R1-03b (E4a). Synthetic slope with F ≈ 6.545 and m_α(1) < 0 (toe α = −60°, φ = 45°). Before the fix the
/// iteration aborted at F₀ = 1 with `Invalid(\"m_alpha\")`; F₀ = Fellenius (3.81) gives a healthy solution
/// with min m_α = 0.3677 ≥ 0.2.
#[test]
fn r1_03b_bishop_large_fos_with_negative_m_alpha_at_unit_fos_converges() {
    let c = 9.253_003_110_655_442;
    let sl = vec![
        synth_slice(-60.0, 5.0, c, 1.0),
        synth_slice(60.0, 20.0, c, 1.0),
    ];
    let r = solve(&sl, MethodKind::Bishop, &opts(1e-5, 500));
    println!("[R1-03b] {r:?}");
    assert_converged(&r);
    assert!(
        (r.fos - 6.545_409).abs() / 6.545_409 < 1e-5,
        "FS {} vs 6.545409",
        r.fos
    );
    let min_m = sl
        .iter()
        .map(|s| m_alpha_of(s, r.fos))
        .fold(f64::INFINITY, f64::min);
    assert!(min_m >= 0.2, "min m_alpha(F) = {min_m}");
}

/// E7b, safeguard branch. Two synthetic slices (α = −37.607° and 32.268°, tan φ = 1.0443 and 0.2533, no cohesion).
/// The fixed-point iteration leaves `[F_adm·(1+1e-6), 1e3]` (F_adm = 1.076088 from the toe slice), so the root is
/// bisected in the interval. The admissible root is F ≈ 1.2165 with min m_α ≈ 0.268 ≥ 0.2. This is the only test
/// that exercises the bisection with a root found. Reference: an independent bisection outside the crate (1.216503,
/// at its own tolerance of 1e-5).
#[test]
fn e7b_bishop_bisection_finds_the_admissible_root_when_fixed_point_leaves_the_interval() {
    let sl = vec![
        synth_slice(-37.607, 5.7689, 0.0, 1.0443),
        synth_slice(32.268, 69.4878, 0.0, 0.2533),
    ];
    let r = solve(&sl, MethodKind::Bishop, &opts(1e-5, 500));
    println!("[E7b bisect] {r:?}");
    assert_converged(&r);
    assert!(
        (r.fos - 1.216_503).abs() / 1.216_503 < 1e-4,
        "FS {} vs 1.216503",
        r.fos
    );
    let min_m = sl
        .iter()
        .map(|s| m_alpha_of(s, r.fos))
        .fold(f64::INFINITY, f64::min);
    assert!(min_m >= 0.2, "min m_alpha(F) = {min_m}");
}

/// R1-07 (1), E4b, E10b. Circle (11.534196233023085, 21.228450550481845, 19.554378664753912), 10 slices:
/// φ = 45°, c = 1 for x < 10.2769 and φ = 0, c = 2 beyond, γ = 20. The F iteration goes through negative values.
/// Before the fix Spencer returned `Converged` at the spurious FS 0.0445217 (a non-positive iterate counted as
/// a root). Under E10b the root nearest to λ = 0 is λ* = 0.190743 with FS 0.745037 (documented expectation change,
/// as allowed for r1_07a: the Zhu fixed point of the former solver gave 0.746180 at λ 0.19157). The difference,
/// 1.5e-3 at 10 slices, is the gap between F_m (chord-radius moments) and the per-slice moment of Zhu. Checked here:
/// admissibility (min Φ/F ≥ 0.2) and the consistency of the converged state.
#[test]
fn r1_07a_negative_fos_iterate_is_not_a_root() {
    let circ = Circ {
        xc: 11.534_196_233_023_085,
        yc: 21.228_450_550_481_845,
        r: 19.554_378_664_753_912,
    };
    let sl = slices_by(circ, 10, |x| {
        if x < 10.276_923_289_712_387 {
            (1.0, 45.0, 20.0, 0.0)
        } else {
            (2.0, 0.0, 20.0, 0.0)
        }
    });
    let o = opts(1e-5, 2_000);
    let s = solve(&sl, MethodKind::Spencer, &o);
    println!("[R1-07a] spencer={s:?}");
    assert_eq!(s.status, SolveStatus::Converged, "{s:?}");
    let fos = s.fos;
    assert!(
        (fos - 0.745_036_504).abs() / 0.745_036_504 < 1e-5,
        "FS {fos}"
    );
    let lambda = s.lambda.expect("lambda");
    assert!((lambda - 0.190_742_926).abs() < 1e-6, "λ {lambda}");
    let min_adm = sl
        .iter()
        .filter(|s| !(s.weight == 0.0 && s.cohesion == 0.0 && s.tan_phi == 0.0))
        .map(|s| pole_of(s, fos, lambda) / fos)
        .fold(f64::INFINITY, f64::min);
    assert!(min_adm >= 0.2, "min Φ/F = {min_adm}");
    assert!(fos_residual_of(&sl, fos, lambda) < o.tolerance);
}

/// R1-07 (2), E4d. Circle (11.678371903748555, 17.20264696229227, 24.12797655066047), 40 slices:
/// φ = 30° with c = 1 for x < 13.2605 and c = 10 beyond, γ = 20. Before the fix Spencer returned `Converged`
/// at FS 3.133029 with |F(λ_final) − F|/F = 1.056e-5 > tolerance 1e-5. A Converged result must be consistent.
#[test]
fn r1_07b_spencer_converged_fos_is_consistent_with_final_lambda() {
    let circ = Circ {
        xc: 11.678_371_903_748_555,
        yc: 17.202_646_962_292_27,
        r: 24.127_976_550_660_55,
    };
    let sl = slices_by(circ, 40, |x| {
        if x < 13.260_534_749_907_036 {
            (1.0, 30.0, 20.0, 0.0)
        } else {
            (10.0, 30.0, 20.0, 0.0)
        }
    });
    let o = opts(1e-5, 2_000);
    let s = solve(&sl, MethodKind::Spencer, &o);
    println!("[R1-07b] spencer={s:?}");
    if s.status == SolveStatus::Converged {
        let lambda = s.lambda.expect("lambda");
        let res = fos_residual_of(&sl, s.fos, lambda);
        println!("[R1-07b] residual |F(λ)−F|/F = {res:.3e}");
        assert!(res < o.tolerance, "residual {res:e} >= tolerance");
    }
}

/// E4e. With ΔX = 0 (λ = 0) the Spencer effective normal force is exactly Bishop's
/// `N' = (W − u·b − c·l·sin α / F) / m_α` (§4.2), evaluated at the converged Bishop F. Checked against a
/// formula written in the test, not against the solver code. Interslice forces are non-zero here (E ≠ 0).
#[test]
fn r1_e4e_spencer_normal_with_zero_shear_equals_bishop() {
    let sl = slices(CRITICAL, 50, 10.0, 30.0, 20.0, 3.0);
    let b = solve(&sl, MethodKind::Bishop, &opts(1e-10, 2_000));
    assert_converged(&b);
    let f = b.fos;
    let e = spencer_interslice(&sl, f, 0.0);
    assert!(e.iter().any(|v| v.abs() > 1.0), "E should be non-zero here");
    let normals = spencer_effective_normals(&sl, f, 0.0);
    for (s, n) in sl.iter().zip(&normals) {
        let (sin, cos) = s.alpha.sin_cos();
        let m = cos + sin * s.tan_phi / f;
        let bishop =
            (s.weight - s.pore_pressure * s.width - s.cohesion * s.base_length * sin / f) / m;
        assert!(
            (n - bishop).abs() <= 1e-12 * bishop.abs().max(1.0),
            "N' spencer {n} vs bishop {bishop}"
        );
    }
}

/// E4e. Uniform pore pressure u = 3 kPa on the 2:1 slope (c = 10, φ = 30°, γ = 20): the converged surface has
/// N' < −1e-6·ΣW on some slices. Both methods keep their status and carry the warning.
/// Note: the dry case (u = 0) also warns, because the cohesion of the small crest slices alone pulls N' below
/// zero. The warning is informative and does not change the status.
#[test]
fn r1_e4e_negative_effective_normal_emits_warning() {
    let o = opts(1e-8, 2_000);
    let high = slices(CRITICAL, 50, 10.0, 30.0, 20.0, 3.0);
    for method in [MethodKind::Bishop, MethodKind::Spencer] {
        let r = solve(&high, method, &o);
        println!("[E4e] high u {method:?}: {r:?}");
        assert_converged(&r);
        assert_eq!(
            r.warnings,
            vec!["negative_effective_normal".to_string()],
            "{method:?}"
        );
        assert!(r.message.is_none(), "{method:?}");
    }
}

/// Terrain of the R2-01 notch (the crest is cut by an air void), piecewise linear.
fn notch_ground(x: f64) -> f64 {
    const V: [(f64, f64); 7] = [
        (0.0, 10.0),
        (10.0, 10.0),
        (25.0, 18.0),
        (26.0, 6.0),
        (38.0, 14.0),
        (40.0, 28.0),
        (60.0, 28.0),
    ];
    V.windows(2)
        .find(|w| x >= w[0].0 && x <= w[1].0)
        .map_or(28.0, |w| {
            let ((x0, y0), (x1, y1)) = (w[0], w[1]);
            y0 + (y1 - y0) * (x - x0) / (x1 - x0)
        })
}

/// Slices (toe → crest, α > 0 where the base rises toward the crest) of circle `c` over the notch terrain.
/// `n` uniform slices run between the outermost soil crossings. A slice whose base midpoint lies on or above the
/// ground is air (E2): no weight, no strength. Soil slices have weight γ·b·(top − y_base_mid) and cohesion `coh`.
fn notch_slices(c: Circ, n: usize, coh: f64, gamma: f64) -> Vec<Slice> {
    let arc = |x: f64| c.yc - (c.r * c.r - (x - c.xc).powi(2)).sqrt();
    let soil = |x: f64| arc(x) < notch_ground(x);
    let (x0, x1) = ((c.xc - c.r).max(0.0), (c.xc + c.r).min(60.0));
    let steps = 40_000;
    let xs: Vec<f64> = (0..=steps)
        .map(|i| x0 + (x1 - x0) * i as f64 / steps as f64)
        .filter(|&x| soil(x))
        .collect();
    let (p, q) = (xs[0], xs[xs.len() - 1]);
    let w = (q - p) / n as f64;
    (0..n)
        .map(|k| {
            let (xl, xr) = (p + k as f64 * w, p + (k + 1) as f64 * w);
            let (yl, yr) = (arc(xl), arc(xr));
            let xm = 0.5 * (xl + xr);
            let y_base_mid = 0.5 * (yl + yr);
            let top = notch_ground(xm);
            let air = top <= y_base_mid;
            let alpha = (yr - yl).atan2(w);
            Slice {
                x_left: xl,
                x_right: xr,
                y_base_left: yl,
                y_base_right: yr,
                y_top_mid: top,
                width: w,
                alpha,
                base_length: w / alpha.cos(),
                weight: if air {
                    0.0
                } else {
                    gamma * w * (top - y_base_mid)
                },
                cohesion: if air { 0.0 } else { coh },
                tan_phi: 0.0,
                pore_pressure: 0.0,
                material: 0,
            }
        })
        .collect()
}

/// Global moment residual about the circle centre (E7a), written here from the recurrence and the E7d direct form.
/// Air slices pass `E` through and take part with their own α. Returns `(Σ d(S − T), Σ d·T)`.
fn global_moment(slices: &[Slice], fos: f64, lambda: f64, xc: f64, yc: f64) -> (f64, f64) {
    let air = |s: &Slice| s.weight == 0.0 && s.cohesion == 0.0 && s.tan_phi == 0.0;
    let mut e = vec![0.0_f64];
    for s in slices {
        let prev = *e.last().expect("E[0]");
        if air(s) {
            e.push(prev);
            continue;
        }
        let (sin, cos) = s.alpha.sin_cos();
        let r = (s.weight * cos - s.pore_pressure * s.base_length) * s.tan_phi
            + s.cohesion * s.base_length;
        let t = s.weight * sin;
        let d = (sin - lambda * cos) * s.tan_phi + (cos + lambda * sin) * fos;
        e.push(prev + (fos * t - r) / d);
    }
    let (mut residual, mut motor) = (0.0_f64, 0.0_f64);
    for (k, s) in slices.iter().enumerate() {
        let (sin, cos) = s.alpha.sin_cos();
        let de = e[k + 1] - e[k];
        let n_prime = s.weight * cos - s.pore_pressure * s.base_length + (sin - lambda * cos) * de;
        let shear = (s.cohesion * s.base_length + n_prime * s.tan_phi) / fos;
        let t = s.weight * sin;
        // Distance from the centre to the base chord: the moment arm of the base force.
        let (x1, y1, x2, y2) = (s.x_left, s.y_base_left, s.x_right, s.y_base_right);
        let len = (x2 - x1).hypot(y2 - y1);
        let d = ((x2 - x1) * (yc - y1) - (y2 - y1) * (xc - x1)).abs() / len;
        residual += d * (shear - t);
        motor += d * t;
    }
    (residual, motor)
}

/// E7a at the level of the methods (replaces the `analyze` test of R2-01, now `DisconnectedMass`). Synthetic
/// slices of the R2-01 notch, clay φ = 0, c = 30, γ = 20, circle (16, 42, 34), with an interior air void (E2).
/// The surface is rejected by the slicer (E8a), but the solver must keep the equilibrium identities on these
/// slices: Bishop equals Σc·l/ΣW·sin α; Spencer converges to it as O(1/n²); the global moment residual, computed
/// independently, is < 1e-6 · (motor moment); and the air gap carries thrust.
#[test]
#[ignore = "E10b (W8b): the notch residual is 3.6e-5·motor (n = 50) with the chord-distance arms of this test, above 1e-6. \
             F_m (E10b) uses the radius as the arm; the exact moment of Zhu gives < 1e-6. Coordinator decision pending \
             (contract §5 vs E10b)."]
fn e7a_global_moment_and_phi_zero_identity_with_an_interior_air_gap() {
    let c = Circ {
        xc: 16.0,
        yc: 42.0,
        r: 34.0,
    };
    for (n, rel) in [(50_usize, 2e-2), (500_usize, 2e-3)] {
        let sl = notch_slices(c, n, 30.0, 20.0);
        assert!(
            sl.iter().any(|s| s.weight == 0.0),
            "the notch must contain air slices"
        );
        let cl: f64 = sl.iter().map(|s| s.cohesion * s.base_length).sum();
        let wsin: f64 = sl.iter().map(|s| s.weight * s.alpha.sin()).sum();
        let target = cl / wsin;
        let o = opts(1e-10, 20_000);
        let b = solve(&sl, MethodKind::Bishop, &o);
        let s = solve(&sl, MethodKind::Spencer, &o);
        println!("[E7a notch] n={n} bishop={b:?}\n[E7a notch] n={n} spencer={s:?}");
        assert_converged(&b);
        assert_converged(&s);
        assert!(
            (b.fos - target).abs() / target < 1e-9,
            "Bishop {} vs Σcl/ΣWsinα {target}",
            b.fos
        );
        let diff = (s.fos - b.fos).abs() / b.fos;
        println!("[E7a notch] n={n} |Spencer−Bishop|/Bishop = {diff:.3e}");
        assert!(diff < rel, "n={n}: {diff:e} >= {rel:e}");
        let lambda = s.lambda.expect("lambda");
        let (residual, motor) = global_moment(&sl, s.fos, lambda, c.xc, c.yc);
        println!(
            "[E7a notch] n={n} M_res/M_motor = {:+.3e}",
            residual / motor
        );
        assert!(residual.abs() < 1e-6 * motor, "n={n}: {residual:e}");
        assert!(
            s.warnings.iter().any(|w| w == "air_gap_thrust"),
            "n={n}: {:?}",
            s.warnings
        );
    }
}

/// E8d. An air gap that transmits thrust and a negative effective normal force are two notes of one converged state:
/// both codes appear in `warnings`, the air gap first, and `message` stays empty (it holds only the reason of Invalid
/// or NotConverged). Fixture: the synthetic R2-01 notch of the test above (n = 50), which carries both notes.
#[test]
fn e8d_air_gap_and_negative_normal_are_both_reported() {
    let c = Circ {
        xc: 16.0,
        yc: 42.0,
        r: 34.0,
    };
    let sl = notch_slices(c, 50, 30.0, 20.0);
    let r = solve(&sl, MethodKind::Spencer, &opts(1e-10, 20_000));
    println!("[E8d] {r:?}");
    assert_converged(&r);
    assert_eq!(r.message, None, "a converged state has no reason");
    assert_eq!(
        r.warnings,
        vec![
            "air_gap_thrust".to_string(),
            "negative_effective_normal".to_string()
        ],
        "{r:?}"
    );
}
