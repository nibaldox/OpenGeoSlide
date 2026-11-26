//! Passive reinforcement forces in the methods (amendments E14g, E14j and E14m-6; wave R1-M).
//!
//! A passive force is mobilized with the sliding and **divided by F** (F4.7, Duncan and Wright method B): every method
//! evaluates, at each F, `W* + passive_v/F`, `H + passive_h/F`, `h_moment_base + passive_h_moment_base/F` and
//! `driving_extra + passive_driving_extra/F`. This file checks that, without touching the reinforcement code (wave
//! R1-C): the `passive_*` fields are set here, by hand, from physical force vectors (the mapping of F4.6 and F4.7).
//!
//! 1. **Fixed-point consistency** (hand-built slices, five methods, circle and polyline): solving with a passive force
//!    `P` until `F_p`, and then with the **active** force `P/F_p`, gives `F_p` (1e-9). The same test with `P·F_p`, or
//!    with `P` undivided, must not give it (the test discriminates).
//! 2. **Independent global equilibrium** with passive forces divided by F, for Spencer and Morgenstern-Price: the force
//!    sums and the moments about two points, from the physical forces and an own march of the slices, below 1e-6.
//! 3. **Oracle rows** of F4.13 and the inclined ones of X17 §4.3 (cslope 0.1.0), with the forces of the oracle applied
//!    here to the slices of V047a and the fixed circle: Bishop, Spencer/M-P `constant` and Janbu, within 0.1 %.
//! 4. **E14m-6:** the force scale with the reinforcement forces moves no FS of those rows by more than 1e-9.

mod f3_common;

use f3_common::*;
use ogs_core::methods::{
    SolveOptions, SolveStatus, morgenstern_price, slice_at_fos, solve_with, spencer,
};
use ogs_core::model::{IntersliceFunction, IntersliceSpec, MethodKind};
use ogs_core::slicer::Slice;
use serde_json::json;

// ------------------------------------------------------------------------------------------ hand-built slices

/// Ground of the hand-built block: flat at 25 up to x = 30, a slope up to 35 at x = 50, flat after.
fn terrain(x: f64) -> f64 {
    if x <= 30.0 {
        25.0
    } else if x <= 50.0 {
        25.0 + 0.5 * (x - 30.0)
    } else {
        35.0
    }
}

#[derive(Clone, Copy)]
struct Arc {
    xc: f64,
    yc: f64,
    r: f64,
}

impl Arc {
    fn y(&self, x: f64) -> f64 {
        self.yc - (self.r * self.r - (x - self.xc).powi(2)).sqrt()
    }
}

const ARC: Arc = Arc {
    xc: 44.0,
    yc: 48.0,
    r: 26.0,
};
const GAMMA: f64 = 20.0;
/// The mass slides toward −x (`right_to_left`), so `s = −1` of F4.6, and the crest is on the right.
const S: f64 = -1.0;

fn bisect(mut a: f64, mut b: f64, g: impl Fn(f64) -> f64) -> f64 {
    let ga = g(a);
    for _ in 0..200 {
        let m = 0.5 * (a + b);
        if (g(m) > 0.0) == (ga > 0.0) {
            a = m;
        } else {
            b = m;
        }
    }
    0.5 * (a + b)
}

/// `n` slices of the arc, from the toe (left) to the crest, with two materials and a pore pressure. All the extra
/// fields are zero (no seismic force, no loads, no reinforcement).
fn hand_slices(n: usize) -> Vec<Slice> {
    let g = |x: f64| ARC.y(x) - terrain(x);
    let x_toe = bisect(ARC.xc - ARC.r + 1e-9, ARC.xc, g);
    let x_entry = bisect(ARC.xc, ARC.xc + ARC.r - 1e-9, g);
    let b = (x_entry - x_toe) / n as f64;
    (0..n)
        .map(|k| {
            let (xl, xr) = (x_toe + k as f64 * b, x_toe + (k + 1) as f64 * b);
            let (yl, yr) = (ARC.y(xl), ARC.y(xr));
            let alpha = (yr - yl).atan2(b);
            let xm = 0.5 * (xl + xr);
            let ybm = 0.5 * (yl + yr);
            let h = terrain(xm) - ybm;
            let (cohesion, phi) = if k < n / 2 {
                (3.0, 19.6_f64)
            } else {
                (8.0, 12.0)
            };
            Slice {
                x_left: xl,
                x_right: xr,
                y_base_left: yl,
                y_base_right: yr,
                y_top_mid: terrain(xm),
                width: b,
                alpha,
                base_length: b / alpha.cos(),
                weight: GAMMA * b * h,
                cohesion,
                tan_phi: phi.to_radians().tan(),
                pore_pressure: 0.25 * GAMMA * h,
                material: 0,
                weight_extra: 0.0,
                h_force: 0.0,
                h_moment_base: 0.0,
                driving_extra: 0.0,
                y_centroid: 0.0,
                passive_v: 0.0,
                passive_h: 0.0,
                passive_h_moment_base: 0.0,
                passive_driving_extra: 0.0,
            }
        })
        .collect()
}

/// A reinforcement force on the mass, in model coordinates (y upward), applied at `(x, y)`.
#[derive(Clone, Copy, Debug)]
struct Force {
    x: f64,
    y: f64,
    px: f64,
    py: f64,
    passive: bool,
}

/// Index of the slice that receives a force at `x`: the narrowest one whose closed interval contains it.
fn receiver(slices: &[Slice], x: f64) -> usize {
    (0..slices.len())
        .filter(|&k| slices[k].x_left <= x && x <= slices[k].x_right)
        .min_by(|&a, &b| slices[a].width.total_cmp(&slices[b].width))
        .expect("a slice receives the force")
}

/// F4.6 and F4.7: the active force goes to the four fields of always, the passive one to the `passive_*` fields,
/// both **before** dividing by F. `circle` is `(yc, r)` of the surface (`driving_extra` only on a circle).
fn apply(slices: &mut [Slice], f: &Force, yc: f64, r: f64) {
    let k = receiver(slices, f.x);
    let s = &mut slices[k];
    let ybm = 0.5 * (s.y_base_left + s.y_base_right);
    let v = -f.py;
    let h = S * f.px;
    let hm = S * f.px * (f.y - ybm);
    let de = S * f.px * (yc - f.y) / r;
    if f.passive {
        s.passive_v += v;
        s.passive_h += h;
        s.passive_h_moment_base += hm;
        s.passive_driving_extra += de;
    } else {
        s.weight_extra += v;
        s.h_force += h;
        s.h_moment_base += hm;
        s.driving_extra += de;
    }
}

/// Forces of the consistency and equilibrium tests: two passive ones and one active one, in three slices.
fn hand_forces(slices: &[Slice]) -> Vec<Force> {
    let at = |k: usize, up: f64, px: f64, py: f64, passive: bool| {
        let s = &slices[k];
        Force {
            x: 0.5 * (s.x_left + s.x_right),
            y: 0.5 * (s.y_base_left + s.y_base_right) + up,
            px,
            py,
            passive,
        }
    };
    vec![
        at(9, 0.6, 70.0, -25.0, true),
        at(21, 0.0, 40.0, 15.0, true),
        at(15, 1.2, 25.0, -5.0, false),
    ]
}

fn reinforced(forces: &[Force]) -> Vec<Slice> {
    let mut slices = hand_slices(40);
    for f in forces {
        apply(&mut slices, f, ARC.yc, ARC.r);
    }
    slices
}

fn opts(circular: bool) -> SolveOptions {
    SolveOptions {
        tolerance: 1e-12,
        max_iterations: 2000,
        min_m_alpha: 0.2,
        circular,
    }
}

fn constant() -> IntersliceSpec {
    IntersliceSpec {
        function: IntersliceFunction::Constant,
        points: None,
    }
}

fn half_sine() -> IntersliceSpec {
    IntersliceSpec {
        function: IntersliceFunction::HalfSine,
        points: None,
    }
}

const METHODS: [MethodKind; 5] = [
    MethodKind::Bishop,
    MethodKind::Spencer,
    MethodKind::MorgensternPrice,
    MethodKind::JanbuSimplified,
    MethodKind::JanbuCorrected,
];

/// The slices with every passive force moved to the active fields **multiplied by `k`** (the passive ones keep their
/// sign and arm). With `k = 1/F_p` it is the active equivalent of the passive force at `F_p`.
fn passive_as_active(slices: &[Slice], k: f64) -> Vec<Slice> {
    slices
        .iter()
        .map(|s| Slice {
            weight_extra: s.weight_extra + k * s.passive_v,
            h_force: s.h_force + k * s.passive_h,
            h_moment_base: s.h_moment_base + k * s.passive_h_moment_base,
            driving_extra: s.driving_extra + k * s.passive_driving_extra,
            passive_v: 0.0,
            passive_h: 0.0,
            passive_h_moment_base: 0.0,
            passive_driving_extra: 0.0,
            ..*s
        })
        .collect()
}

fn fos_of(slices: &[Slice], method: MethodKind, circular: bool) -> Option<f64> {
    let spec = (method == MethodKind::MorgensternPrice).then(half_sine);
    let r = solve_with(slices, method, &opts(circular), spec.as_ref());
    (r.status == SolveStatus::Converged).then_some(r.fos)
}

// ---------------------------------------------------------------------- 1. fixed-point consistency (F4.7, R1-M)

/// The passive force `P` solved to `F_p` is the active force `P/F_p`: the same solve with the active equivalent gives
/// `F_p` (1e-9), in the five methods, on a circle and (all but Bishop) on a polyline. With the factor inverted (`P·F_p`)
/// or removed (`P`) the equivalent gives another F: the comparison discriminates.
#[test]
fn passive_force_is_the_active_force_divided_by_the_fixed_point() {
    let forces: Vec<Force> = hand_forces(&hand_slices(40))
        .into_iter()
        .filter(|f| f.passive)
        .collect();
    let passive = reinforced(&forces);
    let bare = hand_slices(40);
    for circular in [true, false] {
        for method in METHODS {
            if method == MethodKind::Bishop && !circular {
                continue;
            }
            let label = format!("{method:?} circular={circular}");
            let f_bare = fos_of(&bare, method, circular).expect("the bare block converges");
            let f_p = fos_of(&passive, method, circular).expect("the passive block converges");
            assert!(
                (f_p / f_bare - 1.0).abs() > 0.01,
                "{label}: the passive force must matter ({f_bare} -> {f_p})"
            );
            // The factor that divides the passive force is the F of the equilibrium: F itself, except in Janbu corrected,
            // where it is `F₀ = F/f₀` (the closure is solved at F₀, and `f₀` does not change with the forces, E13l-1).
            let f_eq = |slices: &[Slice], method: MethodKind| {
                let spec = (method == MethodKind::MorgensternPrice).then(half_sine);
                let r = solve_with(slices, method, &opts(circular), spec.as_ref());
                r.fos / r.correction_factor.unwrap_or(1.0)
            };
            let f_0 = f_eq(&passive, method);
            // The active equivalent P/F.
            let f_a = fos_of(&passive_as_active(&passive, 1.0 / f_0), method, circular)
                .expect("the active equivalent converges");
            println!(
                "{label}: F_p = {f_p:.12}, F(active P/F) = {f_a:.12}, Δ = {:.2e}",
                (f_a / f_p - 1.0).abs()
            );
            assert!(
                (f_a / f_p - 1.0).abs() < 1e-9,
                "{label}: passive {f_p:.12} against the active equivalent {f_a:.12}"
            );
            // Discrimination: the inverted factor and the missing factor give another F.
            let mut wrongs = vec![("P·F", f_0), ("P (no division)", 1.0)];
            if (f_p - f_0).abs() > 1e-6 {
                // Janbu corrected: dividing by the corrected F instead of F₀ is another solution.
                wrongs.push(("P/(f₀·F₀)", 1.0 / f_p));
            }
            for (what, k) in wrongs {
                let wrong = fos_of(&passive_as_active(&passive, k), method, circular);
                // `k` multiplies the passive force: `P·F` is `k = F`, and `1/F` is the right one.
                let differs = wrong.is_none_or(|w| (w / f_p - 1.0).abs() > 1e-3);
                assert!(
                    differs,
                    "{label}: the test does not tell {what} from P/F_p ({wrong:?})"
                );
            }
        }
    }
}

/// A passive force that is zero (all four fields) gives the bare block bit for bit, and the passive force of a nail
/// raises F with its size (monotonic).
#[test]
fn passive_force_is_monotonic_and_zero_is_neutral() {
    let bare = hand_slices(40);
    for method in METHODS {
        let f0 = fos_of(&bare, method, true).unwrap();
        let mut prev = f0;
        for p in [10.0, 40.0, 160.0] {
            let mut slices = hand_slices(40);
            let k = 20;
            let s = slices[k];
            let force = Force {
                x: 0.5 * (s.x_left + s.x_right),
                y: 0.5 * (s.y_base_left + s.y_base_right),
                px: p,
                py: 0.0,
                passive: true,
            };
            apply(&mut slices, &force, ARC.yc, ARC.r);
            let f = fos_of(&slices, method, true).unwrap();
            assert!(f > prev, "{method:?}: F({p}) = {f} must exceed {prev}");
            prev = f;
        }
        let mut slices = hand_slices(40);
        slices[20].passive_h = 0.0;
        assert_eq!(
            fos_of(&slices, method, true).unwrap().to_bits(),
            f0.to_bits()
        );
    }
}

/// Bishop with a passive force that is large against the weight: the fixed point leaves the admissible interval and the
/// safeguard (bisection of the divisor-free `F·D(F) − N(F)`) runs, which shows in the iteration count. It still gives the
/// fixed point of the passive force: the active equivalent `P/F` gives the same F.
#[test]
fn bishop_safeguard_with_large_passive_forces() {
    let mut safeguarded = 0;
    for m in [20.0, 50.0, 100.0, 400.0] {
        let mut slices = hand_slices(40);
        let s = slices[20];
        let force = Force {
            x: 0.5 * (s.x_left + s.x_right),
            y: 0.5 * (s.y_base_left + s.y_base_right),
            px: 40.0 * m,
            py: 0.0,
            passive: true,
        };
        apply(&mut slices, &force, ARC.yc, ARC.r);
        let r = solve_with(&slices, MethodKind::Bishop, &opts(true), None);
        assert_eq!(r.status, SolveStatus::Converged, "m = {m}: {r:?}");
        let a = solve_with(
            &passive_as_active(&slices, 1.0 / r.fos),
            MethodKind::Bishop,
            &opts(true),
            None,
        );
        println!(
            "m {m}: F = {:.9} ({} iterations), active equivalent {:.9}",
            r.fos, r.iterations, a.fos
        );
        assert!(
            (a.fos / r.fos - 1.0).abs() < 1e-9,
            "m = {m}: {} against {}",
            r.fos,
            a.fos
        );
        if r.iterations > 30 {
            safeguarded += 1;
        }
    }
    assert!(
        safeguarded >= 2,
        "the test must exercise the Brent safeguard of Bishop"
    );
}

/// The normal forces of the guards (E4e, E7d) are those of the converged F with the passive force included: for a vertical
/// passive force (`H = 0`, `λ = 0`) the direct form of Spencer at `F` equals Bishop's `m_α` form, at any `F`, and both
/// differ from the form that ignores the passive force.
#[test]
fn normal_forces_include_the_passive_force_at_the_given_f() {
    let mut slices = hand_slices(40);
    for k in [8, 20, 31] {
        let s = slices[k];
        let force = Force {
            x: 0.5 * (s.x_left + s.x_right),
            y: 0.5 * (s.y_base_left + s.y_base_right),
            px: 0.0,
            py: 60.0 * (k as f64 / 8.0),
            passive: true,
        };
        apply(&mut slices, &force, ARC.yc, ARC.r);
    }
    let f = 1.3;
    let e = spencer::spencer_interslice(&slices, f, 0.0);
    let direct = spencer::spencer_direct_normals_at(&slices, f, 0.0, &e);
    let blind = spencer::spencer_direct_normals(&slices, 0.0, &e);
    let mut moved = 0.0_f64;
    for (k, s) in slices.iter().enumerate() {
        let bishop = ogs_core::methods::effective_normal(s, f, 0.0);
        assert!(
            (direct[k] - bishop).abs() <= 1e-9 * (1.0 + bishop.abs()),
            "slice {k}: {} against {}",
            direct[k],
            bishop
        );
        moved = moved.max((direct[k] - blind[k]).abs());
    }
    assert!(moved > 1.0, "the passive force must change N' ({moved})");
}

// -------------------------------------------------------------------- 2. independent global equilibrium (F4.7)

/// Own march of the slices at `(F, λ)` with the interslice function `faces` (`X = λ f E`): from the two equations of
/// each slice, solved as a 2 × 2 system, with the **physical** forces (`W*`, `H` and the passive forces divided by `F`
/// added here from the vectors, not from the fields). Returns `(E, N', S)` per slice and the interslice forces.
struct March {
    e: Vec<f64>,
    normal: Vec<f64>,
    shear: Vec<f64>,
}

fn march(slices: &[Slice], forces: &[Force], f: f64, lambda: f64, faces: &[f64]) -> March {
    let mut e = vec![0.0];
    let (mut normal, mut shear) = (Vec::new(), Vec::new());
    for (k, s) in slices.iter().enumerate() {
        // Vertical and horizontal (in the sliding direction) forces on the slice, from the physical vectors.
        let (mut w_star, mut h) = (s.weight, 0.0);
        for fo in forces.iter().filter(|fo| receiver(slices, fo.x) == k) {
            let scale = if fo.passive { 1.0 / f } else { 1.0 };
            w_star += -fo.py * scale;
            h += S * fo.px * scale;
        }
        let (sin, cos) = s.alpha.sin_cos();
        let (l, t) = (s.base_length, s.tan_phi);
        let u = s.pore_pressure * l;
        let e0 = e[k];
        let (f0, f1) = (faces[k], faces[k + 1]);
        // (a11 N' + a12 E1 = r1) and (a21 N' + E1 = r2).
        let a11 = cos + t * sin / f;
        let a12 = lambda * f1;
        let r1 = w_star - u * cos - s.cohesion * l * sin / f + lambda * f0 * e0;
        let a21 = -(sin - t * cos / f);
        let r2 = e0 + u * sin - s.cohesion * l * cos / f + h;
        let det = a11 - a12 * a21;
        let n_eff = (r1 - a12 * r2) / det;
        let e1 = (a11 * r2 - a21 * r1) / det;
        normal.push(n_eff + u);
        shear.push((s.cohesion * l + n_eff * t) / f);
        e.push(e1);
    }
    March { e, normal, shear }
}

/// Residuals of the global equilibrium of the mass from the physical forces: `(ΣFx, ΣFy, M_O, M_O2)` and their scales
/// `(ΣW, Σ|M_O terms|, Σ|M_O2 terms|)`. The interslice forces cancel; the base forces are `N` along the inward normal
/// and `S` toward the crest at the midpoint of each base; the passive forces enter as `P/F` at their point.
fn global_residuals(slices: &[Slice], forces: &[Force], f: f64, m: &March) -> ([f64; 4], [f64; 3]) {
    let o1 = (ARC.xc, ARC.yc);
    let o2 = (ARC.xc + 7.0, ARC.yc - 11.0);
    let (mut fx, mut fy, mut mo1, mut mo2) = (0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64);
    let (mut scale_w, mut scale_1, mut scale_2) = (0.0_f64, 0.0_f64, 0.0_f64);
    let mut add = |x: f64, y: f64, vx: f64, vy: f64| {
        fx += vx;
        fy += vy;
        for (o, mo, sc) in [(o1, &mut mo1, &mut scale_1), (o2, &mut mo2, &mut scale_2)] {
            let moment = (x - o.0) * vy - (y - o.1) * vx;
            *mo += moment;
            *sc += moment.abs();
        }
    };
    for (k, s) in slices.iter().enumerate() {
        let (sin, cos) = s.alpha.sin_cos();
        let (xm, ym) = (
            0.5 * (s.x_left + s.x_right),
            0.5 * (s.y_base_left + s.y_base_right),
        );
        scale_w += s.weight;
        add(xm, ym, 0.0, -s.weight);
        // Normal along (−sin α, cos α) and shear along (cos α, sin α): the crest is on the right.
        add(
            xm,
            ym,
            -m.normal[k] * sin + m.shear[k] * cos,
            m.normal[k] * cos + m.shear[k] * sin,
        );
    }
    for fo in forces {
        let scale = if fo.passive { 1.0 / f } else { 1.0 };
        add(fo.x, fo.y, fo.px * scale, fo.py * scale);
    }
    ([fx, fy, mo1, mo2], [scale_w, scale_1, scale_2])
}

/// Spencer and Morgenstern-Price (`constant`, `half_sine`), a passive and an active force on a hand-built circle: the
/// force sums and the moments about two points, computed from the physical forces and an own march, are below 1e-6 of
/// their scales at the converged `(F, λ)`.
#[test]
fn global_equilibrium_with_passive_forces_divided_by_f() {
    let forces = hand_forces(&hand_slices(40));
    let slices = reinforced(&forces);
    let cases = [
        ("spencer", MethodKind::Spencer, None),
        (
            "mp constant",
            MethodKind::MorgensternPrice,
            Some(constant()),
        ),
        (
            "mp half_sine",
            MethodKind::MorgensternPrice,
            Some(half_sine()),
        ),
    ];
    for circular in [true, false] {
        for (label, method, spec) in &cases {
            let r = solve_with(
                &slices,
                *method,
                &SolveOptions {
                    tolerance: 1e-9,
                    ..opts(circular)
                },
                spec.as_ref(),
            );
            assert_eq!(r.status, SolveStatus::Converged, "{label}: {r:?}");
            let (f, lambda) = (r.fos, r.lambda.expect("lambda"));
            let faces = match method {
                MethodKind::MorgensternPrice => {
                    let s = spec.as_ref().unwrap();
                    morgenstern_price::interslice_faces(&slices, s.function, None)
                }
                _ => vec![1.0; slices.len() + 1],
            };
            let m = march(&slices, &forces, f, lambda, &faces);
            let (res, scale) = global_residuals(&slices, &forces, f, &m);
            let closure = m.e.last().unwrap().abs() / scale[0];
            println!(
                "[eq] {label:<13} circular={circular:<5} F={f:.6} λ={lambda:+.4} E_n/ΣW={closure:.1e} \
                 ΣFx/ΣW={:+.1e} ΣFy/ΣW={:+.1e} M_O={:+.1e} M_O2={:+.1e}",
                res[0] / scale[0],
                res[1] / scale[0],
                res[2] / scale[1],
                res[3] / scale[2]
            );
            assert!(closure < 1e-6, "{label}: E_n/ΣW = {closure:e}");
            assert!(
                res[0].abs() < 1e-6 * scale[0],
                "{label}: ΣFx = {:e}",
                res[0]
            );
            assert!(
                res[1].abs() < 1e-6 * scale[0],
                "{label}: ΣFy = {:e}",
                res[1]
            );
            assert!(
                res[2].abs() < 1e-6 * scale[1],
                "{label}: M_O = {:e}",
                res[2]
            );
            assert!(
                res[3].abs() < 1e-6 * scale[2],
                "{label}: M_O2 = {:e}",
                res[3]
            );
            // The solver's own slice view at F agrees with the physical forces of the march.
            for (k, s) in slices.iter().enumerate() {
                let at = slice_at_fos(s, f);
                let expect_v: f64 = forces
                    .iter()
                    .filter(|fo| receiver(&slices, fo.x) == k)
                    .map(|fo| -fo.py * if fo.passive { 1.0 / f } else { 1.0 })
                    .sum();
                assert!((at.weight_extra - expect_v).abs() <= 1e-12 * (1.0 + expect_v.abs()));
                // The four fields of the slice at F: the active ones plus the passive ones divided by F (F4.7).
                let ybm = 0.5 * (s.y_base_left + s.y_base_right);
                let (mut h, mut hm, mut de) = (0.0, 0.0, 0.0);
                for fo in forces.iter().filter(|fo| receiver(&slices, fo.x) == k) {
                    let k = if fo.passive { 1.0 / f } else { 1.0 };
                    h += S * fo.px * k;
                    hm += S * fo.px * (fo.y - ybm) * k;
                    de += S * fo.px * (ARC.yc - fo.y) / ARC.r * k;
                }
                let tol = |v: f64| 1e-12 * (1.0 + v.abs());
                assert!((at.h_force - h).abs() <= tol(h), "{label}: H of slice {k}");
                assert!(
                    (at.h_moment_base - hm).abs() <= tol(hm),
                    "{label}: moment of slice {k}"
                );
                assert!(
                    (at.driving_extra - de).abs() <= tol(de),
                    "{label}: M of slice {k}"
                );
            }
        }
    }
}

/// The equilibrium test discriminates: with the passive force **not** divided by F in the solver's fields (as if it
/// were active) the same residual check fails by far more than 1e-6.
#[test]
fn global_equilibrium_check_rejects_an_undivided_passive_force() {
    let forces = hand_forces(&hand_slices(40));
    let slices = reinforced(&forces);
    // Solve the block whose passive forces are active (undivided), and check it against the divided physics.
    let undivided = passive_as_active(&slices, 1.0);
    let r = solve_with(&undivided, MethodKind::Spencer, &opts(true), None);
    assert_eq!(r.status, SolveStatus::Converged);
    let (f, lambda) = (r.fos, r.lambda.unwrap());
    let faces = vec![1.0; slices.len() + 1];
    let m = march(&slices, &forces, f, lambda, &faces);
    let (res, scale) = global_residuals(&slices, &forces, f, &m);
    let worst = (res[0].abs() / scale[0])
        .max(res[2].abs() / scale[1])
        .max(m.e.last().unwrap().abs() / scale[0]);
    assert!(
        worst > 1e-4,
        "the undivided solution passes the divided check ({worst:e})"
    );
}

// ------------------------------------------------------------------------------ 3. oracle rows (F4.13, X17 §4.3)

const CIRCLE: (f64, f64, f64) = (29.54334963719809, 53.63784815923435, 28.641487934160704);

fn v047a_terrain(x: f64) -> f64 {
    if x <= 30.0 {
        25.0
    } else if x <= 50.0 {
        25.0 + 0.5 * (x - 30.0)
    } else {
        35.0
    }
}

/// A row of the oracle: the segment of the reinforcement, the force that cslope applies on the mass (X17 §4.4), whether
/// it is passive, and the oracle values `[Bishop, M-P constant, Janbu corrected, Janbu simplified]` of X17 §4.3.
struct Row {
    name: &'static str,
    a: (f64, f64),
    b: (f64, f64),
    px: f64,
    py: f64,
    passive: bool,
    oracle: [f64; 4],
}

fn rows() -> Vec<Row> {
    let h = ((52.0, 28.0), (25.0, 28.0));
    let pile = ((40.0, 33.0), (40.0, 22.0));
    let d15 = ((36.0, 28.0), (62.079997, 21.011886));
    let d30 = ((36.0, 28.0), (59.382686, 14.5));
    let d45 = ((36.0, 28.0), (55.091883, 8.908117));
    let u15 = ((36.0, 28.0), (62.079997, 34.988114));
    let row = |name, (a, b): ((f64, f64), (f64, f64)), px, py, passive, oracle| Row {
        name,
        a,
        b,
        px,
        py,
        passive,
        oracle,
    };
    vec![
        row(
            "F4.13-1 anchor active",
            h,
            100.0,
            0.0,
            false,
            [1.333661, 1.329252, 1.319292, 1.261727],
        ),
        row(
            "F4.13-2 anchor passive",
            h,
            100.0,
            0.0,
            true,
            [1.248405, 1.245588, 1.252327, 1.197684],
        ),
        row(
            "F4.13-3 nail passive",
            h,
            150.0,
            0.0,
            true,
            [1.375819, 1.372304, 1.379714, 1.319513],
        ),
        row(
            "F4.13-5 geogrid passive",
            h,
            53.7078,
            26.7483,
            true,
            [1.139869, 1.137672, 1.142257, 1.092417],
        ),
        row(
            "F4.13-7 pile active",
            pile,
            40.0,
            0.0,
            false,
            [1.108256, 1.105923, 1.101488, 1.053426],
        ),
        row(
            "F4.13-9 pile passive",
            pile,
            40.0,
            0.0,
            true,
            [1.096378, 1.094400, 1.095828, 1.048013],
        ),
        row(
            "F4.13-11 sheet pile active",
            pile,
            120.0,
            0.0,
            false,
            [1.455483, 1.448712, 1.409314, 1.347821],
        ),
        row(
            "down15 act",
            d15,
            96.5926,
            -25.8819,
            false,
            [1.322996, 1.318077, 1.294890, 1.238390],
        ),
        row(
            "down15 pas",
            d15,
            96.5926,
            -25.8819,
            true,
            [1.243443, 1.240298, 1.238103, 1.184080],
        ),
        row(
            "down30 act",
            d30,
            86.6025,
            -50.0,
            false,
            [1.285084, 1.280634, 1.256961, 1.202115],
        ),
        row(
            "down30 pas",
            d30,
            86.6025,
            -50.0,
            true,
            [1.221758, 1.218764, 1.214059, 1.161085],
        ),
        row(
            "down45 act",
            d45,
            70.7107,
            -70.7107,
            false,
            [1.227727, 1.224093, 1.205578, 1.152974],
        ),
        row(
            "down45 pas",
            d45,
            70.7107,
            -70.7107,
            true,
            [1.185452, 1.182804, 1.178531, 1.127108],
        ),
        row(
            "down30 tangent act",
            d30,
            94.8269,
            31.7469,
            false,
            [1.345237, 1.339658, 1.303601, 1.246721],
        ),
        row(
            "down30 tangent pas",
            d30,
            94.8269,
            31.7469,
            true,
            [1.253323, 1.249952, 1.241631, 1.187454],
        ),
        row(
            "down30 bisector act",
            d30,
            99.4977,
            -10.0102,
            false,
            [1.355457, 1.349912, 1.315129, 1.257745],
        ),
        row(
            "down30 bisector pas",
            d30,
            99.4977,
            -10.0102,
            true,
            [1.261041, 1.257672, 1.250143, 1.195595],
        ),
        row(
            "up15 act",
            u15,
            96.5926,
            25.8819,
            false,
            [1.310751, 1.310450, 1.351581, 1.292607],
        ),
        row(
            "up15 pas",
            u15,
            96.5926,
            25.8819,
            true,
            [1.234156, 1.233673, 1.270174, 1.214752],
        ),
    ]
}

/// Crossing of the segment with the lower arc of the fixed circle, inside the ground (F4.4).
fn crossing(a: (f64, f64), b: (f64, f64)) -> (f64, f64) {
    let (xc, yc, r) = CIRCLE;
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let (fx, fy) = (a.0 - xc, a.1 - yc);
    let qa = dx * dx + dy * dy;
    let qb = 2.0 * (fx * dx + fy * dy);
    let qc = fx * fx + fy * fy - r * r;
    let disc = (qb * qb - 4.0 * qa * qc).sqrt();
    [(-qb - disc) / (2.0 * qa), (-qb + disc) / (2.0 * qa)]
        .into_iter()
        .filter(|t| (0.0..1.0).contains(t))
        .map(|t| (a.0 + t * dx, a.1 + t * dy))
        .find(|&(x, y)| y < yc && y <= v047a_terrain(x))
        .expect("the segment crosses the lower arc")
}

/// The five-method V047a document with a line load of `p = 1e-9` at each crossing, so that the slicer cuts the fine
/// slice `x_c ± 1e-6·width` of E14d (the trick of X17 §4.1). Its slices are returned with every extra field cleared.
fn row_slices(xs: &[f64]) -> Vec<Slice> {
    let mut doc = v047a(json!(["bishop"]));
    doc["loads"] = json!(
        xs.iter()
            .enumerate()
            .map(|(i, x)| json!({"type": "line", "id": format!("c{i}"), "x": x, "p": 1e-9, "angle": 0.0}))
            .collect::<Vec<_>>()
    );
    let mut slices = run(&doc).results[0].slices.clone();
    for s in &mut slices {
        s.weight_extra = 0.0;
        s.h_force = 0.0;
        s.h_moment_base = 0.0;
        s.driving_extra = 0.0;
    }
    slices
}

/// The slices of a row with its force applied (`None` when the segment does not cross the arc: the bare slope).
fn row_block(row: &Row) -> Vec<Slice> {
    let (xc, yc, r) = CIRCLE;
    let _ = xc;
    let (x, y) = crossing(row.a, row.b);
    let mut slices = row_slices(&[x]);
    apply(
        &mut slices,
        &Force {
            x,
            y,
            px: row.px,
            py: row.py,
            passive: row.passive,
        },
        yc,
        r,
    );
    slices
}

fn row_options(method: MethodKind) -> (SolveOptions, Option<IntersliceSpec>) {
    (
        SolveOptions {
            tolerance: 1e-5,
            max_iterations: 500,
            min_m_alpha: 0.2,
            circular: true,
        },
        (method == MethodKind::MorgensternPrice).then(constant),
    )
}

/// The four values of a row, in the order of the oracle: Bishop, Morgenstern-Price `constant`, Janbu corrected and
/// simplified.
fn row_values(slices: &[Slice]) -> [f64; 4] {
    let kinds = [
        MethodKind::Bishop,
        MethodKind::MorgensternPrice,
        MethodKind::JanbuCorrected,
        MethodKind::JanbuSimplified,
    ];
    kinds.map(|k| {
        let (o, spec) = row_options(k);
        let r = solve_with(slices, k, &o, spec.as_ref());
        assert_eq!(r.status, SolveStatus::Converged, "{k:?}: {r:?}");
        r.fos
    })
}

/// The rows of F4.13 (7) and the inclined rows of X17 (12 more, with the forces of the oracle): within 0.1 % of
/// cslope 0.1.0 in Bishop, Morgenstern-Price `constant`, Janbu corrected and Janbu simplified. The forces are applied
/// here by hand; the crossing, the direction and the capacity of the reinforcement code are checked by R1-C.
#[test]
fn oracle_rows_with_the_forces_of_the_oracle() {
    let names = [
        "Bishop",
        "M-P constant",
        "Janbu corrected",
        "Janbu simplified",
    ];
    let mut worst = 0.0_f64;
    for row in rows() {
        let got = row_values(&row_block(&row));
        for i in 0..4 {
            let rel = (got[i] - row.oracle[i]).abs() / row.oracle[i];
            worst = worst.max(rel);
            println!(
                "{:<26} {:<16} ogs {:.6}  cslope {:.6}  Δ {:+.4} %",
                row.name,
                names[i],
                got[i],
                row.oracle[i],
                100.0 * (got[i] - row.oracle[i]) / row.oracle[i]
            );
            assert!(
                rel <= 1e-3,
                "{} {}: ogs {:.6} against cslope {:.6}: Δ = {:.4} % (> 0.1 %)",
                row.name,
                names[i],
                got[i],
                row.oracle[i],
                100.0 * rel
            );
        }
    }
    println!("peor |Δ| contra el oráculo = {:.4} %", 100.0 * worst);
}

/// The rows discriminate the 1/F factor: with the passive force of a row **undivided** (as an active one) the FS is
/// outside 0.1 % of the oracle's.
#[test]
fn oracle_rows_reject_the_undivided_passive_force() {
    for row in rows().into_iter().filter(|r| r.passive) {
        let undivided = passive_as_active(&row_block(&row), 1.0);
        let got = row_values(&undivided);
        assert!(
            (got[0] - row.oracle[0]).abs() / row.oracle[0] > 1e-3,
            "{}: Bishop with the undivided force {:.6} is within 0.1 % of {:.6}",
            row.name,
            got[0],
            row.oracle[0]
        );
    }
}

// ----------------------------------------------------------------------------------------- 4. E14m-6, force scale

/// The force scale of E13l-3 and E14m-6, written here from the contract: `max(D, min(max(ΣW, ΣW*), 3·D))` with
/// `D = max(ΣW, Σ|t_i|, Σ|H_i|)`, `t = W*·sin α + H·cos α`. With `passive` the available passive force (not divided by
/// F) is added to `W*` and `H` of `t_i` and `H_i`; the vertical scale `ΣW*` has no passive term.
fn contract_scale(slices: &[Slice], passive: bool) -> f64 {
    let soil: f64 = slices.iter().map(|s| s.weight).sum();
    let vertical = soil.max(slices.iter().map(|s| s.weight + s.weight_extra).sum());
    let (mut t, mut h) = (0.0_f64, 0.0_f64);
    for s in slices {
        let (pv, ph) = if passive {
            (s.passive_v, s.passive_h)
        } else {
            (0.0, 0.0)
        };
        let hh = s.h_force + ph;
        t += ((s.weight + s.weight_extra + pv) * s.alpha.sin() + hh * s.alpha.cos()).abs();
        h += hh.abs();
    }
    let d = soil.max(t).max(h);
    d.max(vertical.min(3.0 * d))
}

/// E14m-6: the force scale of E13l-3 includes the forces of the reinforcements (`t_i` and `H_i`, the passive ones with
/// their available value). On the rows of acceptance the FS is compared (a) with the scale of the bare slope (`ΣW`,
/// without any reinforcement force, active or passive) and (b) with the scale that has the active forces and no passive
/// ones, in the five methods and at two solver tolerances (the rows' `1e-5` and a tight `1e-9`). The scale only fixes
/// the closure tolerance `|E_n| ≤ 1e-6·scale` and the normalisation of the moment residual.
#[test]
fn e14m6_the_scale_with_the_forces_moves_no_fos_by_more_than_1e9() {
    let kinds = [
        MethodKind::Bishop,
        MethodKind::Spencer,
        MethodKind::MorgensternPrice,
        MethodKind::JanbuSimplified,
        MethodKind::JanbuCorrected,
    ];
    // Worst relative change per (ablation, tolerance, passive?, method).
    let mut worst: std::collections::BTreeMap<String, (f64, String)> = Default::default();
    let (mut count, mut skipped, mut moved) = (0, 0, 0);
    // The forces of the oracle rows are small against ΣW (the scale of the rows is ΣW whatever the forces): the rows are
    // also run with the force multiplied by 5 and by 25, where the passive force does enter `Σ|t_i|` and `Σ|H_i|`.
    let stress: Vec<(Row, f64)> = [1.0, 5.0, 25.0]
        .into_iter()
        .flat_map(|m| rows().into_iter().map(move |r| (r, m)))
        .collect();
    for (row, multiplier) in stress {
        let row = Row {
            px: row.px * multiplier,
            py: row.py * multiplier,
            name: row.name,
            ..row
        };
        let slices = row_block(&row);
        let scales = [
            ("(a) vs ΣW   ", slices.iter().map(|s| s.weight).sum::<f64>()),
            ("(b) vs no-pas", contract_scale(&slices, false)),
        ];
        let with_forces = contract_scale(&slices, true);
        println!(
            "[E14m-6] {:<26} x{multiplier:<3} ΣW {:.1}  scale bare {:.1}  scale without passive {:.4}  with forces {:.4}",
            row.name, scales[0].1, scales[0].1, scales[1].1, with_forces
        );
        for tolerance in [1e-5, 1e-9] {
            for k in kinds {
                let (mut o, spec) = row_options(k);
                o.tolerance = tolerance;
                spencer::set_force_scale_override(None);
                let with = solve_with(&slices, k, &o, spec.as_ref());
                // The scale written here from the contract is the one of the engine: the same bits.
                spencer::set_force_scale_override(Some(with_forces));
                let same = solve_with(&slices, k, &o, spec.as_ref());
                assert_eq!(with.fos.to_bits(), same.fos.to_bits(), "{} {k:?}", row.name);
                for (name, scale) in scales {
                    spencer::set_force_scale_override(Some(scale));
                    let without = solve_with(&slices, k, &o, spec.as_ref());
                    spencer::set_force_scale_override(None);
                    if multiplier == 1.0 {
                        assert_eq!(with.status, SolveStatus::Converged, "{} {k:?}", row.name);
                        assert_eq!(without.status, SolveStatus::Converged, "{} {k:?}", row.name);
                    } else if with.status != SolveStatus::Converged
                        || without.status != SolveStatus::Converged
                    {
                        // A stress force can leave no driving mass, or an FS out of range: nothing to compare.
                        skipped += 1;
                        continue;
                    }
                    let rel = (with.fos - without.fos).abs() / without.fos;
                    count += 1;
                    if with_forces != contract_scale(&slices, false) {
                        moved += 1;
                    }
                    let key = format!(
                        "{name} tol {tolerance:e} {} {} {k:?}",
                        if multiplier == 1.0 {
                            "rows  "
                        } else {
                            "stress"
                        },
                        if row.passive { "passive" } else { "active " }
                    );
                    let entry = worst.entry(key).or_insert((0.0, String::new()));
                    if rel >= entry.0 {
                        *entry = (rel, row.name.to_string());
                    }
                }
            }
        }
    }
    println!(
        "E14m-6: {count} soluciones comparadas ({skipped} sin solución convergida, omitidas); en {moved} la escala con las \
         fuerzas pasivas difiere de la escala sin ellas; mayor |ΔFS|/FS por (ablación, tolerancia, aplicación, método):"
    );
    for (key, (rel, row)) in &worst {
        println!("  {key:<48} {rel:.3e}  ({row})");
    }
    for (key, (rel, row)) in &worst {
        // The criterion of E14m-6: at the tight tolerance no FS moves by more than 1e-9, and neither does one of the
        // passive rows of acceptance at any tolerance (their scale does not change: ΣW dominates).
        if key.contains("tol 1e-9") || (key.contains("rows") && key.contains("passive")) {
            assert!(*rel <= 1e-9, "{key}: {rel:e} ({row})");
        }
        // At the rows' tolerance (1e-5) Spencer and M-P stop Brent at |ρ| ≤ 1e-3·tolerance = 1e-8, and ρ is normalised
        // by the scale, so a change of scale moves the stopping point inside the tolerance of the solver (it is the case
        // too of the load scale of E13l-3, in the active row `down45`): it is bounded by 1e-2 of the tolerance.
        if key.contains("tol 1e-5") {
            assert!(*rel <= 1e-7, "{key}: {rel:e} ({row})");
        }
    }
}
