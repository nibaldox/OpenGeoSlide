//! Tests for the circular entry/exit search (§4.4). They use a fake `Ground` and fake evaluators only.
//! Run with `cargo test -p ogs-core --test search` and `cargo test -p ogs-core --features parallel --test search`.

use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};

use ogs_core::geometry::{Ground, Sliding};
use ogs_core::model::{Circle, SearchSpec};
use ogs_core::search::{SearchResult, SearchStats, search_circular};

/// Piecewise-linear ground through `vertices` (sorted by x).
struct Profile {
    vertices: Vec<(f64, f64)>,
    sliding: Sliding,
}

impl Profile {
    fn y(&self, x: f64) -> Option<f64> {
        let (first, last) = (self.vertices[0], self.vertices[self.vertices.len() - 1]);
        if x < first.0 || x > last.0 {
            return None;
        }
        self.vertices.windows(2).find_map(|w| {
            let ((xa, ya), (xb, yb)) = (w[0], w[1]);
            (x >= xa && x <= xb).then(|| ya + (yb - ya) * (x - xa) / (xb - xa))
        })
    }
}

impl Ground for Profile {
    fn y_top(&self, x: f64) -> Option<f64> {
        self.y(x)
    }
    fn x_range(&self) -> (f64, f64) {
        (self.vertices[0].0, self.vertices[self.vertices.len() - 1].0)
    }
    fn sliding(&self) -> Sliding {
        self.sliding
    }
}

/// Slope 2:1 (H = 10) on the left, flat base on the right; the mass moves to +x.
fn slope_2_to_1() -> Profile {
    Profile {
        vertices: vec![(-20.0, 10.0), (0.0, 10.0), (20.0, 0.0), (60.0, 0.0)],
        sliding: Sliding::LeftToRight,
    }
}

/// Smooth fake FS with its minimum (1.0) at (40, 45, 25).
fn bowl(c: &Circle) -> Option<f64> {
    Some(
        1.0 + ((c.xc - 40.0) / 10.0).powi(2)
            + ((c.yc - 45.0) / 10.0).powi(2)
            + ((c.r - 25.0) / 10.0).powi(2),
    )
}

fn default_spec() -> SearchSpec {
    SearchSpec {
        entry: None,
        exit: None,
        n_entry: 20,
        n_exit: 20,
        n_radius: 20,
        max_radius_factor: 5.0,
        min_width: None,
        refine: true,
    }
}

/// Crossings of the circle with the straight ground `y = a + b·x`: `(x, y)` of both points.
/// Recomputed from the circle alone; independent of the search code.
fn line_crossings(c: &Circle, a: f64, b: f64) -> Vec<(f64, f64)> {
    // (x − xc)² + (k + b·x)² = r², with k = a − yc.
    let k = a - c.yc;
    let qa = 1.0 + b * b;
    let qb = 2.0 * k * b - 2.0 * c.xc;
    let qc = c.xc * c.xc + k * k - c.r * c.r;
    let disc = qb * qb - 4.0 * qa * qc;
    assert!(disc > 0.0, "circle does not cut the ground twice: {c:?}");
    [
        (-qb - disc.sqrt()) / (2.0 * qa),
        (-qb + disc.sqrt()) / (2.0 * qa),
    ]
    .into_iter()
    .map(|x| (x, a + b * x))
    .collect()
}

/// Entry (uphill crossing) and exit (downhill crossing) of a circle on a straight ground.
/// Also checks that the center is above the chord, i.e. the minor arc below the chord is the sliding arc.
/// (Whether a crossing lies on the lower semicircle is the slicer's job, not checked here.)
fn entry_exit(c: &Circle, a: f64, b: f64) -> (f64, f64) {
    let pts = line_crossings(c, a, b);
    let (up, down) = if pts[0].1 > pts[1].1 {
        (pts[0], pts[1])
    } else {
        (pts[1], pts[0])
    };
    let slope = (down.1 - up.1) / (down.0 - up.0);
    let chord_y = up.1 + slope * (c.xc - up.0);
    assert!(c.yc > chord_y, "center below the chord (major arc): {c:?}");
    (up.0, down.0)
}

/// Reference construction of the circle through two ground points for `R = (L/2)·e^ρ`,
/// with the center above the chord. Only used by the brute-force reference.
fn circle_through(p: (f64, f64), q: (f64, f64), rho: f64) -> Option<Circle> {
    let (dx, dy) = (q.0 - p.0, q.1 - p.1);
    let len = dx.hypot(dy);
    if len <= 0.0 {
        return None;
    }
    let (mut nx, mut ny) = (-dy / len, dx / len);
    if ny < 0.0 {
        (nx, ny) = (-nx, -ny);
    }
    let h = 0.5 * len;
    let r = h * rho.exp();
    let d = (r * r - h * h).sqrt();
    Some(Circle {
        xc: 0.5 * (p.0 + q.0) + d * nx,
        yc: 0.5 * (p.1 + q.1) + d * ny,
        r,
    })
}

/// Brute-force reference over the same family: `n³` points on (x_e, x_s, ρ), inclusive grid.
fn brute_force_best(g: &Profile, n: usize) -> f64 {
    let (x0, x1) = g.x_range();
    let min_width = 0.01 * (x1 - x0);
    let rho_lo = 1.0001f64.ln();
    let rho_hi = 10.0f64.ln();
    let at = |lo: f64, hi: f64, i: usize| lo + (hi - lo) * i as f64 / (n - 1) as f64;
    let mut best = f64::INFINITY;
    for i in 0..n {
        let xe = at(x0, x1, i);
        for j in 0..n {
            let xs = at(x0, x1, j);
            if xs - xe < min_width {
                continue;
            }
            let (Some(ye), Some(ys)) = (g.y(xe), g.y(xs)) else {
                continue;
            };
            for k in 0..n {
                let rho = at(rho_lo, rho_hi, k);
                if let Some(c) = circle_through((xe, ye), (xs, ys), rho)
                    && let Some(fs) = bowl(&c)
                {
                    best = best.min(fs);
                }
            }
        }
    }
    best
}

fn best_fs(res: &SearchResult) -> f64 {
    res.best.expect("a valid surface must be found").1
}

#[test]
fn optimality_beats_dense_brute_force() {
    let g = slope_2_to_1();
    let calls = AtomicUsize::new(0);
    let res = search_circular(&g, &default_spec(), |c| {
        calls.fetch_add(1, Ordering::Relaxed);
        bowl(c)
    });
    let fs = best_fs(&res);
    let brute = brute_force_best(&g, 60);
    eprintln!(
        "[optimality] search FS = {fs:.9}, brute 60^3 FS = {brute:.9}, evaluated = {}, valid = {}",
        res.stats.evaluated, res.stats.valid
    );
    assert!(
        fs <= brute + 1e-3,
        "search {fs} worse than brute force {brute}"
    );
    assert_eq!(res.stats.evaluated, calls.load(Ordering::Relaxed));
    assert_eq!(res.stats.valid, res.stats.evaluated);
}

#[test]
fn entry_is_uphill_of_exit() {
    // (ground, line (a, b) with y = a + b·x, sliding)
    let cases = [
        // Ground descends to the right: mass moves to +x.
        (
            Profile {
                vertices: vec![(0.0, 20.0), (40.0, 0.0)],
                sliding: Sliding::LeftToRight,
            },
            (20.0, -0.5),
            Sliding::LeftToRight,
        ),
        // Ground descends to the left: mass moves to -x.
        (
            Profile {
                vertices: vec![(0.0, 0.0), (40.0, 20.0)],
                sliding: Sliding::RightToLeft,
            },
            (0.0, 0.5),
            Sliding::RightToLeft,
        ),
    ];
    for (g, (a, b), sliding) in cases {
        let seen = Mutex::new(Vec::new());
        let res = search_circular(&g, &default_spec(), |c| {
            seen.lock().unwrap().push(*c);
            Some(c.r + 0.01 * c.xc)
        });
        assert!(res.best.is_some());
        let seen = seen.into_inner().unwrap();
        assert!(!seen.is_empty());
        for c in &seen {
            let (entry_x, exit_x) = entry_exit(c, a, b);
            match sliding {
                Sliding::LeftToRight => {
                    assert!(entry_x < exit_x, "{sliding:?}: {entry_x} >= {exit_x}")
                }
                Sliding::RightToLeft => {
                    assert!(entry_x > exit_x, "{sliding:?}: {entry_x} <= {exit_x}")
                }
            }
        }
    }
}

#[test]
fn entry_and_exit_respect_ranges_and_min_width() {
    // (ground, line (a, b), sliding, entry range, exit range)
    let cases = [
        (
            Profile {
                vertices: vec![(0.0, 20.0), (40.0, 0.0)],
                sliding: Sliding::LeftToRight,
            },
            (20.0, -0.5),
            Sliding::LeftToRight,
            [5.0, 20.0],
            [25.0, 38.0],
        ),
        (
            Profile {
                vertices: vec![(0.0, 0.0), (40.0, 20.0)],
                sliding: Sliding::RightToLeft,
            },
            (0.0, 0.5),
            Sliding::RightToLeft,
            [20.0, 35.0],
            [2.0, 15.0],
        ),
    ];
    let min_width = 2.0;
    for (g, (a, b), _sliding, entry, exit) in cases {
        let spec = SearchSpec {
            entry: Some(entry),
            exit: Some(exit),
            min_width: Some(min_width),
            ..default_spec()
        };
        let seen = Mutex::new(Vec::new());
        let res = search_circular(&g, &spec, |c| {
            seen.lock().unwrap().push(*c);
            Some(c.r)
        });
        assert!(res.best.is_some());
        let seen = seen.into_inner().unwrap();
        assert!(!seen.is_empty());
        let tol = 1e-6;
        for c in &seen {
            let (xe, xs) = entry_exit(c, a, b);
            assert!(
                xe >= entry[0] - tol && xe <= entry[1] + tol,
                "entry {xe} outside {entry:?}"
            );
            assert!(
                xs >= exit[0] - tol && xs <= exit[1] + tol,
                "exit {xs} outside {exit:?}"
            );
            assert!(
                (xe - xs).abs() >= min_width - tol,
                "width {} < {min_width}",
                (xe - xs).abs()
            );
        }
    }
}

#[test]
fn repeated_runs_are_bit_identical_and_match_golden() {
    let g = slope_2_to_1();
    let run = || search_circular(&g, &default_spec(), bowl);
    let (a, b) = (run(), run());
    assert_eq!(a, b);
    let (ca, fa) = a.best.unwrap();
    let fs_bits = fa.to_bits();
    assert_eq!(fs_bits, b.best.unwrap().1.to_bits());
    // Golden values recorded from the serial build. The parallel build must reproduce them exactly.
    assert_eq!(fs_bits, GOLDEN_FS_BITS, "FS = {fa:?}");
    assert_eq!(
        [ca.xc.to_bits(), ca.yc.to_bits(), ca.r.to_bits()],
        GOLDEN_CIRCLE_BITS,
        "circle = {ca:?}"
    );
    assert_eq!(a.stats.evaluated, GOLDEN_EVALUATED);
    assert_eq!(a.stats.valid, GOLDEN_EVALUATED);
}

// GOLDEN_START
// Recorded from the serial build (`cargo test -p ogs-core --test search`); the parallel build matches.
const GOLDEN_FS_BITS: u64 = 4614019456113153336; // FS = 3.0362544981059294
const GOLDEN_CIRCLE_BITS: [u64; 3] = [
    4630817057798425978,
    4630114869740570006,
    4630140219797701819,
];
// E9a: 10 refinement seeds instead of 5 (FS and circle unchanged; the seed count changes `evaluated`).
const GOLDEN_EVALUATED: usize = 5849;
// GOLDEN_END

#[test]
fn no_valid_surface_gives_no_best() {
    let g = slope_2_to_1();
    let calls = AtomicUsize::new(0);
    let res = search_circular(&g, &default_spec(), |_| {
        calls.fetch_add(1, Ordering::Relaxed);
        None
    });
    assert!(res.best.is_none());
    assert!(res.stats.evaluated > 0);
    assert_eq!(res.stats.valid, 0);
    assert_eq!(res.stats.evaluated, calls.load(Ordering::Relaxed));
}

/// `slope_2_to_1` that also declares its ground vertices, as `PreparedModel` does (E9a).
struct WithVertices(Profile);

impl Ground for WithVertices {
    fn y_top(&self, x: f64) -> Option<f64> {
        self.0.y_top(x)
    }
    fn x_range(&self) -> (f64, f64) {
        self.0.x_range()
    }
    fn sliding(&self) -> Sliding {
        self.0.sliding()
    }
    fn ground_vertices_x(&self) -> Vec<f64> {
        self.0.vertices.iter().map(|v| v.0).collect()
    }
}

/// E9a: with the ground vertices declared, entry and exit candidates sit on them, so some evaluated circle passes
/// through a vertex. The uniform grid of `default_spec` has no such point on this profile (x = 0 and x = 20 are not
/// grid abscissae), so the hit comes from the vertex candidates.
#[test]
fn ground_vertices_are_entry_and_exit_candidates() {
    let g = WithVertices(slope_2_to_1());
    let seen: Mutex<Vec<Circle>> = Mutex::new(Vec::new());
    let res = search_circular(&g, &default_spec(), |c| {
        seen.lock().unwrap().push(*c);
        bowl(c)
    });
    assert!(res.best.is_some());
    let vertices = [(0.0, 10.0), (20.0, 0.0)];
    let circles = seen.into_inner().unwrap();
    let hit = circles.iter().any(|c| {
        vertices
            .iter()
            .any(|&(x, y)| ((c.xc - x).hypot(c.yc - y) - c.r).abs() <= 1e-9 * c.r)
    });
    assert!(hit, "no evaluated circle passes through a ground vertex");
}

#[test]
fn refinement_never_worsens_the_grid_result() {
    let g = slope_2_to_1();
    let grid_only = search_circular(
        &g,
        &SearchSpec {
            refine: false,
            ..default_spec()
        },
        bowl,
    );
    let refined = search_circular(&g, &default_spec(), bowl);
    assert!(best_fs(&refined) <= best_fs(&grid_only));
    assert!(refined.stats.evaluated >= grid_only.stats.evaluated);
}

// ---------------------------------------------------------------- R1-10: robustness

/// Runs the search with a counting `eval`; returns the result and the number of `eval` calls.
fn run_counting(spec: &SearchSpec) -> (SearchResult, usize) {
    let calls = AtomicUsize::new(0);
    let res = search_circular(&slope_2_to_1(), spec, |c| {
        calls.fetch_add(1, Ordering::Relaxed);
        bowl(c)
    });
    (res, calls.into_inner())
}

#[test]
fn r1_10_grid_product_overflow_is_refused_before_allocation() {
    // usize::MAX · 2 · 2 overflows; the grid must not be built (it would not fit in memory).
    let spec = SearchSpec {
        n_entry: usize::MAX,
        n_exit: 2,
        n_radius: 2,
        ..default_spec()
    };
    let (res, calls) = run_counting(&spec);
    assert!(res.best.is_none());
    assert_eq!(res.stats, SearchStats::default());
    assert_eq!(calls, 0);
}

#[test]
fn r1_10_grid_above_the_limit_is_refused() {
    // 2000 · 2000 · 2 = 8e6 candidates, above MAX_GRID_CANDIDATES (2e6).
    let spec = SearchSpec {
        n_entry: 2000,
        n_exit: 2000,
        n_radius: 2,
        ..default_spec()
    };
    let (res, calls) = run_counting(&spec);
    assert!(res.best.is_none());
    assert_eq!(calls, 0);
}

#[test]
fn r1_10_radius_range_too_small_yields_no_candidate() {
    // With factor ≤ 0.50005 the radius range is empty or inverted (ρ_max ≤ ρ_min, or NaN).
    for factor in [0.5, 0.0, -1.0, f64::NAN, f64::INFINITY] {
        let spec = SearchSpec {
            max_radius_factor: factor,
            ..default_spec()
        };
        let (res, calls) = run_counting(&spec);
        assert!(res.best.is_none(), "factor {factor}");
        assert_eq!(calls, 0, "factor {factor}");
    }
}

#[test]
fn r1_10_zero_step_axis_is_not_probed() {
    // A point entry and a point exit: their pattern steps are 0. The refinement must not probe the
    // current circle again through those axes, so no two consecutive `eval` calls are identical.
    let spec = SearchSpec {
        entry: Some([-5.0, -5.0]),
        exit: Some([30.0, 30.0]),
        n_entry: 1,
        n_exit: 1,
        n_radius: 1,
        refine: true,
        ..default_spec()
    };
    let seen = Mutex::new(Vec::<Circle>::new());
    let res = search_circular(&slope_2_to_1(), &spec, |c| {
        seen.lock().unwrap().push(*c);
        bowl(c)
    });
    let seen = seen.into_inner().unwrap();
    assert!(res.best.is_some());
    assert!(seen.len() > 1, "the refinement must run");
    for pair in seen.windows(2) {
        assert!(pair[0] != pair[1], "repeated evaluation: {:?}", pair[0]);
    }
}

#[test]
fn r1_10_search_stays_deterministic_after_the_guards() {
    let spec = default_spec();
    let (a, _) = run_counting(&spec);
    let (b, _) = run_counting(&spec);
    assert_eq!(a, b);
}
