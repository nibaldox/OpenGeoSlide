//! Global non-circular candidates (F7.3, E17a).
use crate::geometry::PreparedModel;
use crate::model::{
    Circle, GlobalAlgorithm, GlobalSpec, Model, NonCircularSpec, Point, SearchSpec,
};
use crate::noncircular;
use crate::search::GlobalStats;
use crate::strength::{self, StrengthLaw};
use crate::surface::{Polyline, Surface, search_circle_polyline, search_polyline_admissible};
use crate::{hoek_brown, shansep};

struct SplitMix64(u64);
impl SplitMix64 {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9e3779b97f4a7c15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
        z ^ (z >> 31)
    }
    fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }
    fn uniform(&mut self, a: f64, b: f64) -> f64 {
        a + (b - a) * ((self.next() >> 11) as f64 / 9007199254740992.0)
    }
}
fn halton(mut index: u64, base: u64) -> f64 {
    let mut place = 1.0 / base as f64;
    let mut value = 0.0;
    while index > 0 {
        value += (index % base) as f64 * place;
        index /= base;
        place /= base as f64;
    }
    value
}

fn inside(p: Point, poly: &[Point]) -> bool {
    let mut yes = false;
    for i in 0..poly.len() {
        let a = poly[i];
        let b = poly[(i + 1) % poly.len()];
        if (a[1] > p[1]) != (b[1] > p[1])
            && p[0] < a[0] + (p[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])
        {
            yes = !yes;
        }
    }
    yes
}
/// The weak layer of F7.3.1 and its fallbacks (E17e §2).
struct Layers {
    /// Contact edges of the region with the lowest ρ.
    contact: Vec<[Point; 2]>,
    /// Non-vertical edges whose outer side lies outside every region.
    bases: Vec<[Point; 2]>,
}

impl Layers {
    /// The `auto` rule of E17a: there is at least one edge in the chosen layer (the bases never count).
    fn has_layer(&self) -> bool {
        !self.contact.is_empty()
    }

    /// Edges the block samples: the layer, or the bases when nothing is in contact (explicit `block` only).
    fn block_edges(&self) -> &[[Point; 2]] {
        if self.contact.is_empty() {
            &self.bases
        } else {
            &self.contact
        }
    }
}

/// Strength ratio ρ = τ / (γ·z) of a region at its centroid, with the effective vertical stress
/// σ′v = γ·z·(1 − ru) (E17e §2). `None` when the region has no depth to rank.
fn rho(pm: &PreparedModel, region: usize, depth: f64, y: f64) -> f64 {
    let m = &pm.materials[pm.regions[region].material];
    if !(depth > 0.0 && m.unit_weight > 0.0) {
        return f64::INFINITY;
    }
    let sigma_v = m.unit_weight * depth * (1.0 - m.ru.unwrap_or(0.0));
    let tau = match &m.law {
        StrengthLaw::Linear => {
            let (c, tan_phi) = strength::resolve(m, y);
            c + sigma_v * tan_phi
        }
        StrengthLaw::HoekBrown(p) => hoek_brown::tau_at_normal(p, sigma_v),
        StrengthLaw::Shansep(p) => shansep::su_at(p, sigma_v, y),
    };
    tau / (m.unit_weight * depth)
}

fn layers(model: &Model, pm: &PreparedModel) -> Layers {
    let eps = 1e-4 * (pm.y_max - pm.y_min);
    let width = pm.x_max - pm.x_min;
    let mut contacts: Vec<(usize, f64, Vec<[Point; 2]>)> = Vec::new();
    let mut bases = Vec::new();
    for (i, r) in model.regions.iter().enumerate() {
        let poly = &r.polygon;
        let mut edges = Vec::new();
        for j in 0..poly.len() {
            let a = poly[j];
            let b = poly[(j + 1) % poly.len()];
            let dx = b[0] - a[0];
            let dy = b[1] - a[1];
            let len = dx.hypot(dy);
            if dx.abs() <= 1e-9 * width || len <= 0.0 {
                continue;
            }
            let mid = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
            let n = [-dy / len, dx / len];
            let p = [mid[0] + eps * n[0], mid[1] + eps * n[1]];
            let q = [mid[0] - eps * n[0], mid[1] - eps * n[1]];
            if model
                .regions
                .iter()
                .enumerate()
                .any(|(k, r)| k != i && (inside(p, &r.polygon) || inside(q, &r.polygon)))
            {
                edges.push([a, b]);
            }
            if pm
                .top_at(mid[0])
                .is_some_and(|y| (mid[1] - y).abs() <= 1e-6 * (pm.y_max - pm.y_min))
            {
                continue;
            }
            if [p, q]
                .iter()
                .any(|p| !model.regions.iter().any(|r| inside(*p, &r.polygon)))
            {
                bases.push([a, b]);
            }
        }
        if edges.is_empty() {
            continue;
        }
        let n = poly.len() as f64;
        let xc = poly.iter().map(|p| p[0]).sum::<f64>() / n;
        let yc = poly.iter().map(|p| p[1]).sum::<f64>() / n;
        let depth = pm.top_at(xc).unwrap_or(yc) - yc;
        contacts.push((i, rho(pm, i, depth, yc), edges));
    }
    contacts.sort_by(|a, b| a.1.total_cmp(&b.1).then(a.0.cmp(&b.0)));
    Layers {
        contact: contacts.into_iter().next().map(|c| c.2).unwrap_or_default(),
        bases,
    }
}

/// The upper envelope of the ground as a polyline, with its two one-sided limits at every vertex abscissa (E17e §1).
struct Terrain {
    xs: Vec<f64>,
    /// Ground just to the left and just to the right of each `xs[k]`.
    left: Vec<f64>,
    right: Vec<f64>,
}

impl Terrain {
    fn new(pm: &PreparedModel) -> Terrain {
        let xs = pm.vertex_xs.clone();
        let left = xs
            .iter()
            .map(|x| {
                pm.top_toward(*x, -1.0)
                    .or_else(|| pm.top_at(*x))
                    .unwrap_or(f64::NAN)
            })
            .collect();
        let right = xs
            .iter()
            .map(|x| {
                pm.top_toward(*x, 1.0)
                    .or_else(|| pm.top_at(*x))
                    .unwrap_or(f64::NAN)
            })
            .collect();
        Terrain { xs, left, right }
    }

    /// First point where the ray from `p` at angle `theta` (0 < θ < π, so it rises) reaches the ground, by exact
    /// intersection with each piece of the terrain: no step, no dependence on the size of the model.
    fn hit(&self, pm: &PreparedModel, p: Point, theta: f64) -> Option<Point> {
        let (dx, dy) = (theta.cos(), theta.sin());
        let n = self.xs.len();
        if !(dx.abs() > 1e-12 && dy > 0.0) || n < 2 {
            return None;
        }
        let slope = dy / dx;
        let ray = |x: f64| p[1] + (x - p[0]) * slope;
        // One piece of the terrain, travelled from (xa, ga) to (xb, gb); `start` is where the ray enters it.
        let piece = |start: f64, xa: f64, ga: f64, xb: f64, gb: f64| -> Option<Option<f64>> {
            let ga = if start == xa {
                ga
            } else {
                ga + (gb - ga) * (start - xa) / (xb - xa)
            };
            let (da, db) = (ga - ray(start), gb - ray(xb));
            if !(da.is_finite() && db.is_finite()) {
                return Some(None);
            }
            if da <= 0.0 {
                Some(Some(start))
            } else if db <= 0.0 {
                Some(Some(start + (xb - start) * da / (da - db)))
            } else {
                None
            }
        };
        let mut hit = None;
        if dx > 0.0 {
            let first = self.xs.partition_point(|x| *x <= p[0]);
            if first == 0 || first >= n {
                return None;
            }
            for k in first - 1..n - 1 {
                let start = p[0].max(self.xs[k]);
                if let Some(h) = piece(
                    start,
                    self.xs[k],
                    self.right[k],
                    self.xs[k + 1],
                    self.left[k + 1],
                ) {
                    hit = Some(h?);
                    break;
                }
            }
        } else {
            let first = self.xs.partition_point(|x| *x < p[0]);
            if first == 0 || first >= n {
                return None;
            }
            for k in (1..=first).rev() {
                let start = p[0].min(self.xs[k]);
                if let Some(h) = piece(
                    start,
                    self.xs[k],
                    self.left[k],
                    self.xs[k - 1],
                    self.right[k - 1],
                ) {
                    hit = Some(h?);
                    break;
                }
            }
        }
        let mut x = hit?;
        // A hit on the foot of a vertical step: take the ground of the side the ray travels on.
        let tol = pm.tol();
        if pm
            .top_at(x)
            .is_some_and(|y| (y - ray(x)).abs() > 10.0 * tol)
        {
            x += if dx > 0.0 { 2.0 * tol } else { -2.0 * tol };
        }
        Some([x, pm.top_at(x)?])
    }
}

fn admissible(pm: &PreparedModel, win: [[f64; 2]; 2], p: &[Point]) -> bool {
    let tol = pm.tol().max(1e-6 * (pm.x_max - pm.x_min));
    let ok = |x: f64, w: [f64; 2]| x >= w[0].min(w[1]) - tol && x <= w[0].max(w[1]) + tol;
    p.len() >= 2
        && ok(p[0][0], win[0])
        && ok(p[p.len() - 1][0], win[1])
        && search_polyline_admissible(pm, p)
}
/// H of F7.3.3: the relief of the ground; a ground that is almost flat uses the depth of the model (E17e §1).
fn height(pm: &PreparedModel) -> f64 {
    let mut lo = f64::INFINITY;
    let mut hi = f64::NEG_INFINITY;
    for i in 0..=400 {
        if let Some(y) = pm.top_at(pm.x_min + (pm.x_max - pm.x_min) * i as f64 / 400.0) {
            lo = lo.min(y);
            hi = hi.max(y);
        }
    }
    let depth = pm.y_max - pm.y_min;
    if hi - lo < 1e-3 * depth {
        depth
    } else {
        hi - lo
    }
}
type Candidate = (f64, usize, Vec<Point>);

/// Diagnostic of A9 (test builds only): the best generated candidate, before the successive halving.
#[cfg(test)]
mod probe {
    use super::Candidate;
    use std::cell::RefCell;

    thread_local! {
        static SORTED: RefCell<Vec<Candidate>> = const { RefCell::new(Vec::new()) };
        static START: RefCell<Option<Vec<crate::model::Point>>> = const { RefCell::new(None) };
    }

    pub(super) fn record_start(start: &[crate::model::Point]) {
        START.with(|b| *b.borrow_mut() = Some(start.to_vec()));
    }

    /// The starting polyline of the annealing, if there was one.
    pub(super) fn take_start() -> Option<Vec<crate::model::Point>> {
        START.with(|b| b.borrow_mut().take())
    }

    pub(super) fn record(sorted: &[Candidate]) {
        SORTED.with(|b| *b.borrow_mut() = sorted.to_vec());
    }

    /// The generated candidates, best first.
    pub(super) fn take() -> Vec<Candidate> {
        SORTED.with(|b| std::mem::take(&mut *b.borrow_mut()))
    }
}
/// The evaluator returns the converged FS and whether it fails the tension guard.
pub(crate) fn run<E: FnMut(&Surface) -> Option<(f64, bool)>>(
    model: &Model,
    pm: &PreparedModel,
    search: &SearchSpec,
    spec: &GlobalSpec,
    seeds: &[(Circle, f64)],
    baseline: f64,
    mut solve: E,
) -> (Option<Surface>, GlobalStats, bool) {
    let layer = layers(model, pm);
    let edges = layer.block_edges();
    let terrain = Terrain::new(pm);
    let max_vertices = search
        .non_circular
        .as_ref()
        .map_or(33, NonCircularSpec::max_vertices);
    let mut algorithm = match spec.algorithm() {
        GlobalAlgorithm::Auto if layer.has_layer() => "block",
        GlobalAlgorithm::Auto => "annealing",
        GlobalAlgorithm::Block => "block",
        GlobalAlgorithm::Annealing => "annealing",
    };
    let mut stats = GlobalStats {
        algorithm,
        generated: 0,
        attempts: 0,
        converged: 0,
        eligible: 0,
        tension_rejected: 0,
        refined: 0,
        evaluated: 0,
        polish_evaluated: 0,
        global_fos: None,
        winner: "refinement",
    };
    let rejected = std::cell::Cell::new(f64::INFINITY);
    let converged = std::cell::Cell::new(0usize);
    let eligible = std::cell::Cell::new(0usize);
    let tensions = std::cell::Cell::new(0usize);
    let generation_phase = std::cell::Cell::new(true);
    let mut rng = SplitMix64(spec.seed());
    let rot: [f64; 20] = {
        let mut r = SplitMix64(spec.seed() ^ 0x005e_ed0f_ca11);
        let mut a = [0.0; 20];
        if spec.seed() != 0 {
            for v in a.iter_mut() {
                *v = r.uniform(0.0, 1.0);
            }
        }
        a
    };
    // E17c: Halton con rotación de Cranley-Patterson por dimensión; la semilla 0 no rota.
    let hs = |i: u64, b: u64| -> f64 { (halton(i, b) + rot[b as usize]).fract() };
    let win = noncircular::windows(pm, search);
    let h = height(pm);
    let n = spec.generated();
    let mut candidates: Vec<Candidate> = Vec::new();
    // Record every solve serially, including guarded candidates in refinement and polishing.
    let mut guarded = |surface: &Surface| -> Option<f64> {
        let (f, tension) = solve(surface)?;
        if generation_phase.get() {
            converged.set(converged.get() + 1);
        }
        if tension {
            rejected.set(rejected.get().min(f));
            if generation_phase.get() {
                tensions.set(tensions.get() + 1);
            }
            None
        } else {
            if generation_phase.get() {
                eligible.set(eligible.get() + 1);
            }
            Some(f)
        }
    };
    if algorithm == "block" {
        while stats.generated < n && stats.attempts < 20 * n && !edges.is_empty() {
            stats.attempts += 1;
            let index = stats.attempts as u64;
            let [a, b] = edges[((hs(index, 3) * edges.len() as f64) as usize).min(edges.len() - 1)];
            let k = 2 + usize::from(hs(index, 2) >= 0.5);
            let mut ts: Vec<f64> = [5, 7, 11, 13]
                .into_iter()
                .take(k + 1)
                .map(|base| hs(index, base))
                .collect();
            ts.sort_by(f64::total_cmp);
            let mut points: Vec<Point> = ts
                .iter()
                .map(|t| [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
                .collect();
            points.sort_by(|a, b| a[0].total_cmp(&b[0]));
            // E17c: inclinación de cada proyección entre 15° y 75° sobre la horizontal, a ambos lados.
            let tl = (105.0 + 60.0 * hs(index, 19)).to_radians();
            let tr = (15.0 + 60.0 * hs(index, 17)).to_radians();
            let (Some(l), Some(r)) = (
                terrain.hit(pm, points[0], tl),
                terrain.hit(pm, *points.last().unwrap(), tr),
            ) else {
                continue;
            };
            points.insert(0, l);
            points.push(r);
            if !admissible(pm, win, &points) {
                continue;
            }
            let idx = stats.generated;
            stats.generated += 1;
            stats.evaluated += 1;
            let f = guarded(&Surface::Polyline(Polyline {
                points: points.clone(),
            }));
            if let Some(f) = f {
                candidates.push((f, idx, points));
            }
        }
        if stats.generated == 0 && spec.algorithm() == GlobalAlgorithm::Auto {
            algorithm = "annealing";
            stats.algorithm = algorithm;
        }
    }
    if algorithm == "annealing" {
        let begin = stats.attempts;
        let mut start = None;
        // The seed circle is the starting state, not a candidate: it is evaluated (it counts in `evaluated`) but it
        // does not enter `generated`, `attempts` or the converged/eligible counters, as in the prototype.
        for (c, _) in seeds {
            let Some(p) = search_circle_polyline(pm, c) else {
                continue;
            };
            if !admissible(pm, win, &p) {
                continue;
            }
            stats.evaluated += 1;
            generation_phase.set(false);
            let f = guarded(&Surface::Polyline(Polyline { points: p.clone() }));
            generation_phase.set(true);
            if let Some(f) = f {
                #[cfg(test)]
                probe::record_start(&p);
                start = Some((p, f));
                break;
            }
        }
        if let Some((mut current, mut current_f)) = start {
            while stats.generated < n && stats.attempts - begin < 20 * n {
                stats.attempts += 1;
                let k = stats.generated;
                let t = 0.02 * (0.0005_f64 / 0.02).powf(k as f64 / (n - 1).max(1) as f64);
                let sigma = (0.2 * h * t / 0.02).max(0.005 * h);
                let i = 1 + rng.below(7);
                let mut q = current.clone();
                q[i][1] += sigma * rng.uniform(-1.0, 1.0);
                if !admissible(pm, win, &q) {
                    continue;
                }
                let idx = stats.generated;
                stats.generated += 1;
                stats.evaluated += 1;
                if let Some(f) = guarded(&Surface::Polyline(Polyline { points: q.clone() })) {
                    candidates.push((f, idx, q.clone()));
                    let df = f - current_f;
                    if df <= 0.0 || rng.uniform(0.0, 1.0) < (-df / t).exp() {
                        current = q;
                        current_f = f;
                    }
                }
            }
        }
    }
    generation_phase.set(false);
    candidates.sort_by(|a, b| a.0.total_cmp(&b.0).then(a.1.cmp(&b.1)));
    #[cfg(test)]
    probe::record(&candidates);
    let span = (win[0][1] - win[1][0])
        .abs()
        .max((win[1][1] - win[0][0]).abs())
        .max(pm.tol());
    let mut picks: Vec<Candidate> = Vec::new();
    for c in candidates {
        if picks.iter().all(|q| {
            (q.2[0][0] - c.2[0][0]).abs() > 0.05 * span
                || (q.2[q.2.len() - 1][0] - c.2[c.2.len() - 1][0]).abs() > 0.05 * span
        }) {
            picks.push(c);
            if picks.len() == 4 {
                break;
            }
        }
    }
    // E17b successive halving: rank on short refinements before committing full budgets.
    for (budget, cap) in [(60, 3), (150, 1)] {
        let keep = (picks.len() * 3).div_ceil(4).min(cap);
        let mut next = Vec::new();
        for (f, idx, p) in picks {
            let (q, value, used, _) = noncircular::refine_generated(
                pm,
                search,
                p.clone(),
                f,
                (budget, max_vertices),
                &mut guarded,
            );
            stats.evaluated += used;
            if value < f {
                next.push((value, idx, q));
            } else {
                next.push((f, idx, p));
            }
        }
        next.sort_by(|a, b| a.0.total_cmp(&b.0).then(a.1.cmp(&b.1)));
        next.truncate(keep);
        picks = next;
    }
    let mut best: Option<(Vec<Point>, f64, f64)> = None;
    for (f, _, p) in picks {
        stats.refined += 1;
        let (p, f, used, gain) =
            noncircular::refine_generated(pm, search, p, f, (1500, max_vertices), &mut guarded);
        stats.evaluated += used;
        if best.as_ref().is_none_or(|b| f < b.1) {
            best = Some((p, f, gain));
        }
    }
    let mut winner = None;
    if let Some((mut p, mut f, gain)) = best {
        if f < baseline - 1e-6 {
            stats.winner = "global";
            if spec.polish() {
                let (q, g, used) =
                    noncircular::polish_generated(pm, search, p, f, gain, &mut guarded);
                p = q;
                f = g;
                stats.evaluated += used;
                stats.polish_evaluated = used;
            }
            winner = Some(Surface::Polyline(Polyline { points: p }));
        }
        stats.global_fos = Some(f);
    }
    stats.converged = converged.get();
    stats.eligible = eligible.get();
    stats.tension_rejected = tensions.get();
    let reported = if stats.winner == "global" {
        stats.global_fos.unwrap_or(baseline)
    } else {
        baseline
    };
    (winner, stats, rejected.get() < reported)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v053() -> Model {
        serde_json::from_str(include_str!(
            "../../../verification/global/models/V053.json"
        ))
        .unwrap()
    }

    fn homogeneous() -> Model {
        let row: serde_json::Value =
            serde_json::from_str(include_str!("../../../verification/cases/V001-nc.json")).unwrap();
        serde_json::from_value(row["model"].clone()).unwrap()
    }

    fn spec(json: serde_json::Value) -> GlobalSpec {
        serde_json::from_value(json).unwrap()
    }

    fn points(surface: &Surface) -> &[Point] {
        match surface {
            Surface::Polyline(p) => &p.points,
            Surface::Circle(_) => panic!("a polyline was expected"),
        }
    }

    /// An FS that falls as the interior vertices rise towards the ground, deterministic and smooth.
    fn depth_fos(pm: &PreparedModel, surface: &Surface) -> f64 {
        let p = points(surface);
        let depth: f64 = p[1..p.len() - 1]
            .iter()
            .map(|q| pm.top_at(q[0]).unwrap() - q[1])
            .sum();
        1.0 + 0.1 * depth / p.len() as f64
    }

    #[test]
    fn splitmix64_zero_matches_reference() {
        let mut rng = SplitMix64(0);
        for expected in [
            0xe220a8397b1dcdaf,
            0x6e789e6aa1b965f4,
            0x06c45d188009454f,
            0xf88bb8a8724c81ec,
            0x1b39896a51a8749b,
        ] {
            assert_eq!(rng.next(), expected);
        }
    }

    #[test]
    fn prng_ranges_and_halton_values() {
        let mut rng = SplitMix64(12345);
        for _ in 0..1000 {
            let u = rng.uniform(-2.0, 3.0);
            assert!((-2.0..3.0).contains(&u));
            assert!(rng.below(7) < 7);
        }
        // Van der Corput sequences: base 2 and base 3.
        for (index, base, expected) in [
            (1, 2, 0.5),
            (2, 2, 0.25),
            (3, 2, 0.75),
            (4, 2, 0.125),
            (1, 3, 1.0 / 3.0),
            (2, 3, 2.0 / 3.0),
            (3, 3, 1.0 / 9.0),
        ] {
            assert!(
                (halton(index, base) - expected).abs() < 1e-15,
                "{index} {base}"
            );
        }
        assert_eq!(halton(0, 5), 0.0);
    }

    /// Region (by material id) whose polygon owns every endpoint of the given edges.
    fn owners(m: &Model, edges: &[[Point; 2]]) -> Vec<String> {
        m.regions
            .iter()
            .filter(|r| {
                edges
                    .iter()
                    .all(|e| e.iter().all(|q| r.polygon.iter().any(|v| v == q)))
            })
            .map(|r| r.material.clone())
            .collect()
    }

    #[test]
    fn layers_of_v053_are_the_edges_of_the_weakest_region_in_contact() {
        // ρ = c/(γ·z) + tan φ is ≈ 0,30 in `layer_4` (c = 9,8, φ = 16°, deep) and larger in the others.
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let l = layers(&m, &pm);
        assert!(l.has_layer());
        assert_eq!(l.block_edges(), l.contact.as_slice());
        assert!(owners(&m, &l.contact).contains(&"layer_4".to_string()));
        let width = pm.x_max - pm.x_min;
        assert!(
            l.contact
                .iter()
                .all(|[a, b]| (b[0] - a[0]).abs() > 1e-9 * width)
        );
        // The model bottom (y = 0) is outside every region: the bases exist and are not in the layer.
        assert!(!l.bases.is_empty());
    }

    #[test]
    fn homogeneous_slope_has_no_contact_and_uses_bases() {
        let m = homogeneous();
        let pm = PreparedModel::new(&m).unwrap();
        let l = layers(&m, &pm);
        assert!(!l.has_layer() && l.contact.is_empty());
        assert!(!l.bases.is_empty());
        assert_eq!(l.block_edges(), l.bases.as_slice());
    }

    fn set_layer_4(m: &mut Model, patch: serde_json::Value) {
        let mut v = serde_json::to_value(&*m).unwrap();
        for mat in v["materials"].as_array_mut().unwrap() {
            if mat["id"] == "layer_4" {
                for k in ["cohesion", "friction_angle", "ru"] {
                    mat.as_object_mut().unwrap().remove(k);
                }
                for (k, x) in patch.as_object().unwrap() {
                    mat[k] = x.clone();
                }
            }
        }
        *m = serde_json::from_value(v).unwrap();
    }

    #[test]
    fn every_material_competes_for_the_layer_with_its_effective_strength() {
        // E17e §2: with a weak `layer_4` of any model, the layer stays `layer_4` (A-06); a strong one moves it.
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let original = layers(&m, &pm);
        for weak in [
            serde_json::json!({"model": "hoek_brown", "ucs": 2000.0, "gsi": 15.0, "mi": 5.0, "disturbance": 0.8}),
            serde_json::json!({"model": "shansep", "shansep": {"ratio": 0.12, "exponent": 0.8, "ocr": 1.0}}),
            serde_json::json!({"model": "undrained", "undrained_strength": 5.0}),
            serde_json::json!({"model": "mohr_coulomb", "cohesion": 25.0, "friction_angle": 25.0, "ru": 0.75}),
        ] {
            let mut other = m.clone();
            set_layer_4(&mut other, weak.clone());
            let pm = PreparedModel::new(&other).unwrap();
            let l = layers(&other, &pm);
            assert!(l.has_layer(), "{weak}");
            assert_eq!(l.contact, original.contact, "{weak}");
        }
        for strong in [
            serde_json::json!({"model": "hoek_brown", "ucs": 60000.0, "gsi": 80.0, "mi": 20.0, "disturbance": 0.0}),
            serde_json::json!({"model": "shansep", "shansep": {"ratio": 5.0, "exponent": 0.8, "ocr": 1.0}}),
            serde_json::json!({"model": "undrained", "undrained_strength": 1.0e6}),
        ] {
            let mut other = m.clone();
            set_layer_4(&mut other, strong.clone());
            let pm = PreparedModel::new(&other).unwrap();
            let l = layers(&other, &pm);
            assert!(l.has_layer(), "{strong}");
            assert_ne!(l.contact, original.contact, "{strong}");
            assert!(
                owners(&other, &l.contact).iter().any(|id| id != "layer_4"),
                "{strong}"
            );
        }
    }

    #[test]
    fn ru_lowers_the_strength_ratio_of_a_mohr_coulomb_layer() {
        // ρ = c/(γz) + (1 − ru)·tan φ: the same c and φ with a large ru is the weakest region of V053.
        let m = v053();
        let mut other = m.clone();
        set_layer_4(
            &mut other,
            serde_json::json!({"model": "mohr_coulomb", "cohesion": 60.0, "friction_angle": 30.0}),
        );
        let pm = PreparedModel::new(&other).unwrap();
        let dry = layers(&other, &pm);
        set_layer_4(
            &mut other,
            serde_json::json!({"model": "mohr_coulomb", "cohesion": 60.0, "friction_angle": 30.0, "ru": 0.95}),
        );
        let pm = PreparedModel::new(&other).unwrap();
        let wet = layers(&other, &pm);
        assert_ne!(dry.contact, wet.contact, "ru changes the choice");
        assert!(owners(&other, &wet.contact).contains(&"layer_4".to_string()));
    }

    #[test]
    fn a_model_of_hoek_brown_regions_in_contact_has_a_layer_and_never_runs_the_bases() {
        // RCM-A-02 (`repro_03`): with `auto` the bases do not count; the layer of the weakest rock mass is chosen.
        let m: Model = serde_json::from_str(include_str!(
            "../../../verification/global/repro/repro_03_all_hb_auto_bases.ogs.json"
        ))
        .unwrap();
        let pm = PreparedModel::new(&m).unwrap();
        let l = layers(&m, &pm);
        assert!(l.has_layer() && !l.bases.is_empty());
        assert_eq!(l.block_edges(), l.contact.as_slice());
        assert!(owners(&m, &l.contact).contains(&"weak".to_string()));
    }

    #[test]
    fn admissibility_rejects_what_the_engine_would_not_evaluate() {
        // V053 slides right to left: exit window [0, 55], entry window [145, 240], ground 20 at x = 30 and 70 at x = 200.
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let win = noncircular::windows(&pm, m.analysis.search.as_ref().unwrap());
        let y = |x: f64| pm.top_at(x).unwrap();
        let good = vec![
            [30.0, y(30.0)],
            [60.0, 5.0],
            [120.0, 2.0],
            [200.0, y(200.0)],
        ];
        assert!(admissible(&pm, win, &good));
        let mut backwards = good.clone();
        backwards.reverse();
        assert!(!admissible(&pm, win, &backwards));
        let mut above = good.clone();
        above[1][1] = y(60.0) + 1.0;
        assert!(!admissible(&pm, win, &above));
        let mut convex = good.clone();
        convex[2] = [120.0, 40.0];
        assert!(
            !admissible(&pm, win, &convex),
            "concavity α(i+1) ≤ α(i) + 1°"
        );
        let mut late = good.clone();
        late[0] = [70.0, y(70.0)];
        assert!(
            !admissible(&pm, win, &late),
            "the exit end is outside its window"
        );
        assert!(!admissible(&pm, win, &good[..1]));
    }

    /// A model with a ground at `y = depth + 10 + relief·x/100` over a layer `depth` metres thick.
    fn nearly_flat(relief: f64, depth: f64) -> Model {
        serde_json::from_value(serde_json::json!({
            "format": "opengeoslide", "version": "0.7", "units": "SI", "slope": {"direction": "right_to_left"},
            "materials": [
                {"id": "top", "name": "top", "model": "mohr_coulomb", "unit_weight": 19.0, "cohesion": 15.0, "friction_angle": 25.0},
                {"id": "weak", "name": "weak", "model": "mohr_coulomb", "unit_weight": 18.0, "cohesion": 2.0, "friction_angle": 8.0}
            ],
            "regions": [
                {"material": "top", "polygon": [[0, depth], [100, depth], [100, depth + 10.0 + relief], [0, depth + 10.0]]},
                {"material": "weak", "polygon": [[0, 0], [100, 0], [100, depth], [0, depth]]}
            ],
            "analysis": {"methods": ["spencer"], "search": {"type": "circular_entry_exit"}}
        }))
        .unwrap()
    }

    #[test]
    fn the_ray_meets_the_ground_exactly_whatever_the_relief_and_the_depth() {
        // E17e §1: no step, so a nearly flat ground over a deep model costs the same as any other.
        for (relief, depth) in [
            (10.0, 10.0),
            (0.001, 10.0),
            (0.0001, 10.0),
            (0.0, 10.0),
            (1e-6, 5000.0),
        ] {
            let m = nearly_flat(relief, depth);
            let pm = PreparedModel::new(&m).unwrap();
            let terrain = Terrain::new(&pm);
            for (x, deg) in [
                (30.0, 60.0),
                (30.0, 15.0),
                (70.0, 120.0),
                (70.0, 165.0),
                (50.0, 90.0 - 1e-3),
            ] {
                let p = [x, depth + 5.0];
                let q = terrain
                    .hit(&pm, p, f64::to_radians(deg))
                    .unwrap_or_else(|| panic!("{relief} {depth} {x} {deg}"));
                assert!(
                    (q[1] - pm.top_at(q[0]).unwrap()).abs() < 1e-9,
                    "on the ground"
                );
                // On the ray, to rounding.
                let (dx, dy) = (f64::to_radians(deg).cos(), f64::to_radians(deg).sin());
                assert!(
                    ((q[0] - p[0]) * dy - (q[1] - p[1]) * dx).abs() < 1e-7 * depth.max(1.0),
                    "{q:?}"
                );
                assert_eq!(q[0] > p[0], deg < 90.0);
            }
        }
    }

    #[test]
    fn the_ray_on_a_sloped_ground_has_the_closed_form_intersection() {
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let terrain = Terrain::new(&pm);
        // Ground between x = 55 and 75: y = 20 + 0.5·(x − 55) (55 → 20, 75 → 30). Ray from (60, 8) at 45°: y = 8 + (x − 60).
        let q = terrain
            .hit(&pm, [60.0, 8.0], std::f64::consts::FRAC_PI_4)
            .unwrap();
        let x = (8.0 - 60.0 - 20.0 + 0.5 * 55.0) / (0.5 - 1.0);
        assert!(
            (q[0] - x).abs() < 1e-9 && (q[1] - (20.0 + 0.5 * (x - 55.0))).abs() < 1e-9,
            "{q:?}"
        );
        // Leaving the model before reaching the ground, or from outside it: no point.
        assert!(
            terrain
                .hit(&pm, [1.0, 0.1], 165.0_f64.to_radians())
                .is_none()
        );
        assert!(
            terrain
                .hit(&pm, [-5.0, 0.0], 60.0_f64.to_radians())
                .is_none()
        );
        // A vertical or downward direction is not a ray that rises.
        assert!(
            terrain
                .hit(&pm, [60.0, 8.0], std::f64::consts::FRAC_PI_2)
                .is_none()
        );
        assert!(terrain.hit(&pm, [60.0, 8.0], -0.5).is_none());
    }

    #[test]
    fn the_height_of_an_almost_flat_ground_is_the_depth_of_the_model() {
        let m = nearly_flat(0.0001, 10.0);
        let pm = PreparedModel::new(&m).unwrap();
        assert!((height(&pm) - (pm.y_max - pm.y_min)).abs() < 1e-12);
        let m = nearly_flat(10.0, 10.0);
        let pm = PreparedModel::new(&m).unwrap();
        assert!(
            (height(&pm) - 10.0).abs() < 1e-9,
            "the relief when it is not small"
        );
    }

    #[test]
    fn a_nearly_flat_ground_over_a_deep_layer_finishes_with_attempts_bounded() {
        let m = nearly_flat(0.0001, 10.0);
        let pm = PreparedModel::new(&m).unwrap();
        let search = m.analysis.search.clone().unwrap_or_else(|| {
            serde_json::from_value(serde_json::json!({"type": "circular_entry_exit"})).unwrap()
        });
        let g = spec(serde_json::json!({"generated": 200}));
        let t = std::time::Instant::now();
        let (_, stats, _) = run(&m, &pm, &search, &g, &[], 5.0, |s| {
            Some((depth_fos(&pm, s), false))
        });
        assert!(t.elapsed().as_secs_f64() < 5.0, "{:?}", t.elapsed());
        assert!(stats.attempts <= 40 * 200 && stats.generated > 0);
    }

    #[test]
    fn run_without_a_better_surface_keeps_the_refinement() {
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let search = m.analysis.search.as_ref().unwrap();
        let g = spec(serde_json::json!({"generated": 60, "polish": true}));
        let (winner, stats, flag) = run(&m, &pm, search, &g, &[], 0.5, |s| {
            Some((depth_fos(&pm, s), false))
        });
        assert!(winner.is_none());
        assert_eq!((stats.winner, stats.polish_evaluated), ("refinement", 0));
        assert!(stats.eligible > 0 && stats.global_fos.unwrap() >= 1.0);
        assert!(!flag, "nothing was rejected");
    }

    #[test]
    fn run_beats_a_high_baseline_stays_below_it_and_counts_every_evaluation() {
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let search = m.analysis.search.as_ref().unwrap();
        let g = spec(serde_json::json!({"generated": 80}));
        let calls = std::cell::Cell::new(0usize);
        let solve = |s: &Surface| {
            calls.set(calls.get() + 1);
            Some((depth_fos(&pm, s), false))
        };
        let (winner, stats, _) = run(&m, &pm, search, &g, &[], 5.0, solve);
        let w = winner.expect("the generator beats 5.0");
        assert_eq!(stats.winner, "global");
        assert_eq!(stats.algorithm, "block");
        let fos = depth_fos(&pm, &w);
        assert!(fos < 5.0 - 1e-6);
        assert_eq!(stats.global_fos, Some(fos));
        assert!(stats.polish_evaluated <= 3000);
        assert!(stats.generated <= 80 && stats.attempts <= 20 * 80);
        assert_eq!(stats.converged, stats.eligible + stats.tension_rejected);
        assert_eq!(stats.refined, 1);
        assert_eq!(
            stats.evaluated,
            calls.get(),
            "evaluated counts every call of the guarded solver"
        );
        assert!(stats.evaluated <= 80 + 3 * 1500 + 3000);
        // The result is a polyline in the engine's own coordinates: admissible and inside the ground.
        let win = noncircular::windows(&pm, search);
        assert!(admissible(&pm, win, points(&w)));
    }

    #[test]
    fn run_is_deterministic_and_the_seed_changes_the_sample() {
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let search = m.analysis.search.as_ref().unwrap();
        let go = |seed: u64| {
            let g = spec(serde_json::json!({"generated": 60, "seed": seed}));
            let (w, st, fl) = run(&m, &pm, search, &g, &[], 5.0, |s| {
                Some((depth_fos(&pm, s), false))
            });
            (format!("{:?}", w.map(|s| points(&s).to_vec())), st, fl)
        };
        assert_eq!(go(0), go(0));
        assert_eq!(go(7), go(7));
        assert_ne!(go(0).0, go(7).0);
    }

    #[test]
    fn the_guard_never_lets_a_rejected_surface_win_or_hide() {
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let search = m.analysis.search.as_ref().unwrap();
        let g = spec(serde_json::json!({"generated": 100}));
        // Every surface below the median FS of the sample is "in tension": the guard hides it from the optimizer.
        let seen = std::cell::RefCell::new(Vec::new());
        run(&m, &pm, search, &g, &[], 5.0, |s| {
            let f = depth_fos(&pm, s);
            seen.borrow_mut().push(f);
            Some((f, false))
        });
        let mut first: Vec<f64> = seen.borrow()[..100].to_vec();
        first.sort_by(f64::total_cmp);
        let limit = first[50];
        let (winner, stats, flag) = run(&m, &pm, search, &g, &[], 5.0, |s| {
            let f = depth_fos(&pm, s);
            Some((f, f < limit))
        });
        assert!(stats.tension_rejected > 0 && stats.eligible > 0);
        assert!(
            flag,
            "a rejected FS below the reported one must raise the note"
        );
        let w = winner.expect("surfaces above the limit exist");
        assert!(depth_fos(&pm, &w) >= limit);
        assert!(stats.global_fos.unwrap() >= limit);
        // Everything in tension: no candidate, the refinement stands, `global_fos` is null.
        let (winner, stats, flag) = run(&m, &pm, search, &g, &[], 5.0, |s| {
            Some((depth_fos(&pm, s), true))
        });
        assert!(winner.is_none());
        assert_eq!(
            (stats.eligible, stats.refined, stats.winner),
            (0, 0, "refinement")
        );
        assert_eq!(stats.global_fos, None);
        assert_eq!(stats.tension_rejected, stats.converged);
        assert!(flag);
        // Nothing converges: the counters stay at zero and no note about tension is raised.
        let (winner, stats, flag) = run(&m, &pm, search, &g, &[], 5.0, |_| None);
        assert!(winner.is_none() && !flag);
        assert_eq!(
            (stats.converged, stats.eligible, stats.tension_rejected),
            (0, 0, 0)
        );
        assert_eq!(stats.generated, 100);
    }

    #[test]
    fn explicit_block_on_a_homogeneous_slope_uses_the_bases_and_never_falls_back() {
        let m = homogeneous();
        let pm = PreparedModel::new(&m).unwrap();
        let search = m.analysis.search.as_ref().unwrap();
        let g = spec(serde_json::json!({"algorithm": "block", "generated": 50}));
        let (_, stats, _) = run(&m, &pm, search, &g, &[], 5.0, |s| {
            Some((depth_fos(&pm, s), false))
        });
        assert_eq!(stats.algorithm, "block");
        assert!(stats.attempts > 0 && stats.attempts <= 20 * 50);
        let g = spec(serde_json::json!({"algorithm": "auto", "generated": 50}));
        let (_, stats, _) = run(&m, &pm, search, &g, &[], 5.0, |s| {
            Some((depth_fos(&pm, s), false))
        });
        assert_eq!(
            stats.algorithm, "annealing",
            "no contact: auto never chooses block"
        );
        assert_eq!(stats.generated, 0, "no seed circle was given");
    }

    #[test]
    fn auto_falls_back_to_annealing_when_the_block_finds_nothing_and_explicit_block_does_not() {
        // E17a: windows that no block can reach: the contact layer exists, but 20·N attempts give no candidate.
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let mut search = m.analysis.search.clone().unwrap();
        search.entry = Some([239.0, 240.0]);
        search.exit = Some([0.0, 1.0]);
        let solve = |s: &Surface| Some((depth_fos(&pm, s), false));
        let auto = spec(serde_json::json!({"generated": 50}));
        let (winner, stats, _) = run(&m, &pm, &search, &auto, &[], 5.0, solve);
        assert!(winner.is_none());
        assert_eq!(stats.algorithm, "annealing", "auto recurs to the annealing");
        assert_eq!(
            stats.attempts,
            20 * 50,
            "the attempts of the block stage are kept"
        );
        assert_eq!(
            (stats.generated, stats.eligible, stats.winner),
            (0, 0, "refinement")
        );
        let block = spec(serde_json::json!({"algorithm": "block", "generated": 50}));
        let (_, stats, _) = run(&m, &pm, &search, &block, &[], 5.0, solve);
        assert_eq!(
            stats.algorithm, "block",
            "an explicit block never recurs to the annealing"
        );
        assert_eq!(stats.attempts, 20 * 50);
    }

    fn good_polyline(pm: &PreparedModel) -> Vec<Point> {
        let y = |x: f64| pm.top_at(x).unwrap();
        vec![
            [30.0, y(30.0)],
            [60.0, 5.0],
            [120.0, 2.0],
            [200.0, y(200.0)],
        ]
    }

    #[test]
    fn refine_generated_never_returns_a_factor_above_its_input() {
        // E17e §4: an FS that grows with the number of vertices, so every level is worse than the input.
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let search = m.analysis.search.as_ref().unwrap();
        let start = good_polyline(&pm);
        let f0 = 1.0 + 0.01 * start.len() as f64;
        let mut eval = |s: &Surface| Some(1.0 + 0.01 * points(s).len() as f64);
        let (p, f, used, _) =
            noncircular::refine_generated(&pm, search, start.clone(), f0, (1500, 33), &mut eval);
        assert!(used > 0, "the levels were tried");
        assert_eq!((p, f), (start, f0));
    }

    #[test]
    fn refine_generated_stops_at_max_vertices() {
        // E17e §3: 9 → 17 → 33, cut at the cap, like the refinement of F6.10.
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let search = m.analysis.search.as_ref().unwrap();
        for cap in [9, 17, 33] {
            let start = good_polyline(&pm);
            let f0 = 1.0 + 1.0 / start.len() as f64;
            // The FS falls with the vertices: every level improves, so the cap is what stops it.
            let mut eval = |s: &Surface| Some(1.0 + 1.0 / points(s).len() as f64);
            let (p, f, _, _) =
                noncircular::refine_generated(&pm, search, start, f0, (1500, cap), &mut eval);
            assert_eq!(p.len(), cap, "cap {cap}");
            assert!(f < f0);
        }
    }

    #[test]
    fn the_global_stage_respects_max_vertices() {
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let g = spec(serde_json::json!({"generated": 60}));
        for cap in [9, 17] {
            let mut search = m.analysis.search.clone().unwrap();
            search.non_circular.as_mut().unwrap().max_vertices = Some(cap);
            let (winner, _, _) = run(&m, &pm, &search, &g, &[], 5.0, |s| {
                Some((depth_fos(&pm, s), false))
            });
            let w = winner.expect("the generator beats 5.0");
            assert!(points(&w).len() <= cap, "{} > {cap}", points(&w).len());
        }
    }

    #[test]
    fn the_tension_note_covers_the_whole_stage_and_the_count_only_the_generation() {
        // E17e §6: the candidates are the polylines of the generation (≤ 6 vertices); the refinement and the polish
        // add vertices, and what the guard rejects there raises the note without adding to `tension_rejected`.
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let search = m.analysis.search.as_ref().unwrap();
        let g = spec(serde_json::json!({"generated": 60}));
        let (winner, stats, flag) = run(&m, &pm, search, &g, &[], 5.0, |s| {
            let f = depth_fos(&pm, s);
            if points(s).len() >= 9 {
                Some((f - 0.5, true))
            } else {
                Some((f, false))
            }
        });
        assert!(winner.is_some());
        assert_eq!(stats.tension_rejected, 0);
        assert_eq!(stats.converged, stats.eligible + stats.tension_rejected);
        assert!(flag, "a rejected FS below the reported one");
    }

    #[test]
    fn refined_counts_the_polylines_of_the_full_refinement_only() {
        // E17e §7: the short rounds of the successive halving add to `evaluated`, not to `refined`.
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let search = m.analysis.search.as_ref().unwrap();
        let g = spec(serde_json::json!({"generated": 80}));
        let (_, stats, _) = run(&m, &pm, search, &g, &[], 5.0, |s| {
            Some((depth_fos(&pm, s), false))
        });
        assert_eq!(stats.refined, 1);
        assert!(stats.evaluated > stats.generated + 1500);
        let (_, stats, _) = run(&m, &pm, search, &g, &[], 5.0, |_| None);
        assert_eq!((stats.refined, stats.eligible), (0, 0));
    }

    /// Diagnostic of A9, not a test: `OGS_A9_MODEL=<model.json (v0.7, with global)> cargo test --release --lib
    /// a9_probe -- --ignored --nocapture` prints the best generated candidate before the refinement. It needs the
    /// build without `parallel`, so that the generation runs in the thread of the test.
    #[test]
    #[ignore = "diagnostic of A9; needs OGS_A9_MODEL"]
    fn a9_probe() {
        let path = std::env::var("OGS_A9_MODEL").expect("OGS_A9_MODEL");
        let text = std::fs::read_to_string(path).unwrap();
        let out: serde_json::Value =
            serde_json::from_str(&crate::analyze_json(&text).unwrap()).unwrap();
        let g = &out["results"][0]["search"]["non_circular"]["global"];
        let sorted = probe::take();
        let best = sorted
            .first()
            .map(|(f, i, p)| serde_json::json!({"fos": f, "index": i, "points": p}));
        let mut by_index: Vec<_> = sorted.iter().map(|(f, i, p)| (*i, *f, p.clone())).collect();
        by_index.sort_by_key(|c| c.0);
        let head: Vec<_> = by_index
            .iter()
            .take(6)
            .map(|(i, f, p)| serde_json::json!([i, f, p]))
            .collect();
        println!(
            "A9 {}",
            serde_json::json!({"best": best, "head": head, "start": probe::take_start(), "stats": g})
        );
    }
}
