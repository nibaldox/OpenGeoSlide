//! Mandatory tests of brief W1b (Bishop simplified and Spencer, f = 1).
//!
//! Geometry used by the tests is generated here, independently of `slice_circle`:
//! homogeneous 2:1 dry slope of height H = 10 m, ground `y = 0` for `x ≤ 0`,
//! `y = x/2` for `0 ≤ x ≤ 20`, `y = 10` for `x ≥ 20`. The sliding mass moves toward −x, so
//! `slices[0]` is the toe slice and `alpha > 0` where the base rises toward the crest.
//! Slices have uniform width, the weight is taken at the chord midpoint and the base is the chord.

use ogs_core::methods::spencer::spencer_interslice;
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
    let tan_phi = phi_deg.to_radians().tan();
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
                tan_phi,
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

/// Test 4. Dovelas con α muy negativo y φ alto: m_α < 0.2 → Bishop `Invalid`.
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
    // First slice: α = −60°, φ = 45°, m_α(F = 1) = 0.5 − 0.866 < 0. Second slice keeps Σ W sin α > 0.
    let sl = vec![mk(-60.0, 1.0), mk(30.0, 10.0)];
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
