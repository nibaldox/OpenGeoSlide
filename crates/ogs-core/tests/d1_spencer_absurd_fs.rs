//! D-1: Spencer converges with FS of 73 to 450 on some fixed polylines where Janbu gives 2 to 5 and cSlope does not converge.
//!
//! Diagnosis (details and tables in `docs/fase3/d1/DIAGNOSTICO.md`): it is **not** a code error. The result is an exact
//! solution of the equations of the contract (force closure and global moment equilibrium, computed here independently of
//! the solver), with compressive E everywhere, no negative N′, and a single admissible root of the λ scan. What it violates is
//! a *physical admissibility* condition the contract does not impose: the interslice shear it needs is far above the
//! shear strength mobilizable on the vertical faces at the same F (criterion (d) of Zhu, Lee & Jiang 2003, from Chen &
//! Morgenstern 1983). These tests pin the numbers; they do not add a guard.
//!
//! The models are the mirror image (x → −x, direction `right_to_left`) of the generator of `docs/fase3/d1/tools/gen_cases.py`
//! (talud simple H = 10 m, 1:1, c = 10, φ = 30, γ = 20), so that the global-moment helper (slide toward −x) applies.

use ogs_core::methods::spencer::{
    SpencerRoot, spencer_direct_normals, spencer_interslice, spencer_roots,
};
use ogs_core::methods::{SolveOptions, SolveStatus, effective_normal};
use ogs_core::slicer::Slice;
use ogs_core::{analyze, model::Model, report::MethodReport};
use serde_json::{Value, json};

/// (label, polyline in the frame of the generator, crest on the left).
fn cases() -> Vec<(&'static str, Vec<[f64; 2]>)> {
    vec![
        ("A", vec![[9.63, 9.95], [21.796, -2.571], [26.067, -0.05]]),
        ("B", vec![[8.091, 9.95], [24.156, -5.734], [33.598, -0.05]]),
        (
            "C",
            vec![
                [13.132, 6.818],
                [13.273, 6.502],
                [15.729, 1.233],
                [16.332, 0.79],
                [20.439, -5.871],
                [23.337, -6.659],
                [31.391, -0.05],
            ],
        ),
    ]
}

/// Ground of the generator (crest at x ≤ 10, 1:1 down to x = 20), before mirroring.
fn ground(x: f64) -> f64 {
    if x <= 10.0 {
        10.0
    } else if x <= 20.0 {
        10.0 - (x - 10.0)
    } else {
        0.0
    }
}

fn doc(points: &[[f64; 2]], methods: Value) -> Value {
    // Mirror: x → −x, polyline from the smallest x.
    let pts: Vec<[f64; 2]> = points.iter().rev().map(|p| [-p[0], p[1]]).collect();
    let mut d = json!({
        "format": "opengeoslide", "version": "0.3",
        "meta": {"id": "d1", "title": "D-1"}, "units": "SI",
        "materials": [{"id": "suelo", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 10.0, "friction_angle": 30.0}],
        "regions": [{"material": "suelo", "polygon": [[0.0, -10.0], [-40.0, -10.0], [-40.0, 0.0], [-20.0, 0.0], [-10.0, 10.0], [0.0, 10.0]]}],
        "slope": {"direction": "right_to_left"},
        "analysis": {"methods": methods, "slices": 50, "tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2,
                     "surface": {"type": "polyline", "points": pts}}
    });
    if d["analysis"]["methods"]
        .as_array()
        .unwrap()
        .iter()
        .any(|m| m == "morgenstern_price")
    {
        d["analysis"]["interslice"] = json!({"function": "constant"});
    }
    d
}

fn run(d: &Value) -> Vec<MethodReport> {
    let model: Model = serde_json::from_value(d.clone()).expect("model");
    analyze(&model).expect("analysis").results
}

fn options() -> SolveOptions {
    SolveOptions {
        tolerance: 1e-5,
        max_iterations: 500,
        min_m_alpha: 0.2,
        circular: false,
    }
}

/// Resultant moment about `p` of the forces on the whole mass (see `f3_methods.rs`): weight, base `N` and `S`; the
/// interslice forces are internal. `N′` comes from the `m_α` form, not from the solver's direct one.
fn global_moment(slices: &[Slice], e: &[f64], fos: f64, lambda: f64, p: (f64, f64)) -> (f64, f64) {
    let (mut moment, mut scale) = (0.0_f64, 0.0_f64);
    for (k, s) in slices.iter().enumerate() {
        let (sin, cos) = s.alpha.sin_cos();
        let dx = lambda * (e[k + 1] - e[k]);
        let n_eff = effective_normal(s, fos, dx);
        let n = n_eff + s.pore_pressure * s.base_length;
        let shear = (s.cohesion * s.base_length + n_eff * s.tan_phi) / fos;
        let (xm, ym) = (
            0.5 * (s.x_left + s.x_right),
            0.5 * (s.y_base_left + s.y_base_right),
        );
        let (rx, ry) = (xm - p.0, ym - p.1);
        let w = s.total_weight();
        moment += -rx * w;
        moment += n * (rx * cos + ry * sin);
        moment += shear * (rx * sin - ry * cos);
        scale += (w * rx).abs();
    }
    (moment, scale)
}

fn spencer_report(points: &[[f64; 2]]) -> (MethodReport, MethodReport, MethodReport) {
    let mut r = run(&doc(
        points,
        json!(["spencer", "morgenstern_price", "janbu_simplified"]),
    ));
    let j = r.pop().unwrap();
    let m = r.pop().unwrap();
    let s = r.pop().unwrap();
    (s, m, j)
}

/// The three polylines: Spencer converges with FS > 3·F₀ (Janbu) and is an exact solution of the contract's equations.
#[test]
fn the_absurd_spencer_fs_is_an_exact_solution_of_the_equations() {
    println!(
        "caso |   F Spencer |  λ    |  F0 Janbu | cierre E_n/ΣW | M(punto1)/escala | M(punto2)/escala | E máx tracción | N'<0 /ΣW"
    );
    for (label, pts) in cases() {
        let (s, m, j) = spencer_report(&pts);
        assert_eq!(s.status, SolveStatus::Converged, "{label}");
        assert_eq!(j.status, SolveStatus::Converged, "{label}");
        let (f, lam, f0) = (s.fos.unwrap(), s.lambda.unwrap(), j.fos.unwrap());
        assert!(f > 3.0 * f0, "{label}: Spencer {f} against Janbu {f0}");
        // M-P `constant` is Spencer, bit for bit in F up to 1e-10.
        assert!(
            (m.fos.unwrap() - f).abs() <= 1e-10 * f,
            "{label}: M-P constant {} against Spencer {f}",
            m.fos.unwrap()
        );
        let sl = &s.slices;
        let e = spencer_interslice(sl, f, lam);
        let total_w: f64 = sl.iter().map(|x| x.weight).sum();
        let closure = e[sl.len()] / total_w;
        assert!(closure.abs() <= 1e-6, "{label}: closure {closure}");
        let mut worst = 0.0_f64;
        let mut out = vec![];
        for p in [(0.0, 20.0), (-30.0, 35.0)] {
            let (mom, scale) = global_moment(sl, &e, f, lam, p);
            worst = worst.max((mom / scale).abs());
            out.push(mom / scale);
        }
        assert!(worst < 1e-6, "{label}: global moment {worst}");
        // Signs: E ≤ 0 everywhere (E > 0 is tension): no tension between slices.
        let e_tension = e.iter().cloned().fold(f64::MIN, f64::max);
        assert!(e_tension <= 1e-9 * total_w, "{label}: E > 0 {e_tension}");
        let n = spencer_direct_normals(sl, lam, &e);
        let neg: f64 = n.iter().filter(|v| **v < 0.0).map(|v| -v).sum::<f64>() / total_w;
        assert!(neg < 1e-3, "{label}: N' < 0 fraction {neg}");
        println!(
            "{label:4} | {f:11.4} | {lam:.4} | {f0:9.4} | {closure:13.2e} | {:16.2e} | {:16.2e} | {e_tension:14.2e} | {neg:.2e}",
            out[0], out[1]
        );
    }
}

/// All the roots of the scan, and the one E12e chooses: a single root, admissible, with the F of the report.
#[test]
fn the_scan_has_one_admissible_root_and_it_is_the_one_reported() {
    for (label, pts) in cases() {
        let (s, _, _) = spencer_report(&pts);
        let roots: Vec<SpencerRoot> = spencer_roots(&s.slices, &options()).expect("scan");
        println!("{label}: raíces del barrido de λ (λ, F, admisible): {roots:?}");
        let adm: Vec<&SpencerRoot> = roots.iter().filter(|r| r.admissible).collect();
        assert_eq!(adm.len(), 1, "{label}: {roots:?}");
        assert!(
            (adm[0].fos - s.fos.unwrap()).abs() <= 1e-9 * adm[0].fos,
            "{label}"
        );
    }
}

/// The measurement behind the proposed criterion: `r_v = |X|·F / (c·h + max(−E, 0)·tan φ)` on the vertical faces (dry,
/// homogeneous soil), criterion (d) of Zhu, Lee & Jiang (2003). Faces with |E| < 2 % of the largest are not evaluated.
/// The three absurd results have r_v ≫ 1 (the required shear is `r_v` times the one that F lets the soil mobilize);
/// Janbu's F₀ and a critical circle do not.
#[test]
fn the_required_interslice_shear_exceeds_the_mobilizable_one_by_an_order_of_magnitude() {
    let rv = |sl: &[Slice], f: f64, lam: f64| -> f64 {
        let e = spencer_interslice(sl, f, lam);
        let e_max = e.iter().fold(0.0_f64, |a, v| a.max(v.abs()));
        let mut worst = 0.0_f64;
        for k in 0..sl.len() - 1 {
            if e[k + 1].abs() < 0.02 * e_max {
                continue;
            }
            // Face between slice k and k + 1 (slices run toe → crest, crest on the right): x_right of slice k.
            let s = &sl[k];
            let h = (ground(-s.x_right) - s.y_base_right).max(0.0);
            let cap = 10.0 * h + (-e[k + 1]).max(0.0) * (30.0_f64).to_radians().tan();
            if cap > 0.0 {
                worst = worst.max((lam * e[k + 1]).abs() * f / cap);
            }
        }
        worst
    };
    for (label, pts) in cases() {
        let (s, _, _) = spencer_report(&pts);
        let (f, lam) = (s.fos.unwrap(), s.lambda.unwrap());
        let r = rv(&s.slices, f, lam);
        println!("{label}: F {f:.3}, λ {lam:.4}, r_v máx = {r:.2}");
        assert!(r > 3.0, "{label}: r_v {r}");
    }
}
