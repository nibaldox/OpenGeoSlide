//! Global non-circular candidates (F7.3, E17a).
use crate::geometry::PreparedModel;
use crate::model::{Circle, GlobalAlgorithm, GlobalSpec, MaterialModel, Model, Point, SearchSpec};
use crate::noncircular;
use crate::search::GlobalStats;
use crate::surface::{Polyline, Surface, search_circle_polyline, search_polyline_admissible};

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
/// The weak layer of F7.3.1 and its fallbacks.
struct Layers {
    /// Contact edges of the region with the lowest ρ (HB and SHANSEP regions do not compete; E17d).
    contact: Vec<[Point; 2]>,
    /// Non-vertical edges whose outer side lies outside every region.
    bases: Vec<[Point; 2]>,
    /// There is at least one contact edge between regions (any material): the `auto` rule of E17a.
    has_contact: bool,
}

impl Layers {
    /// Edges the block samples: the layer, or the bases when nothing is in contact.
    fn block_edges(&self) -> &[[Point; 2]] {
        if self.contact.is_empty() {
            &self.bases
        } else {
            &self.contact
        }
    }
}

fn layers(model: &Model, pm: &PreparedModel) -> Layers {
    let eps = 1e-4 * (pm.y_max - pm.y_min);
    let width = pm.x_max - pm.x_min;
    let mut has_contact = false;
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
        has_contact = true;
        let Some(m) = model.materials.iter().find(|m| m.id == r.material) else {
            continue;
        };
        // E17d: Hoek-Brown and SHANSEP regions have no c and φ to rank; they do not take part in the choice.
        if matches!(m.model, MaterialModel::HoekBrown | MaterialModel::Shansep) {
            continue;
        }
        let n = poly.len() as f64;
        let xc = poly.iter().map(|p| p[0]).sum::<f64>() / n;
        let yc = poly.iter().map(|p| p[1]).sum::<f64>() / n;
        let depth = pm.top_at(xc).unwrap_or(yc) - yc;
        let (strength, tan_phi) = match m.model {
            MaterialModel::Undrained => {
                let mut su = m.undrained_strength.unwrap_or(0.0);
                if let (Some(d), Some(g)) = (m.strength_datum, m.strength_gradient) {
                    su = (su + (d - yc) * g).max(0.0);
                    if let Some(l) = m.strength_limit {
                        su = if g >= 0.0 { su.min(l) } else { su.max(l) };
                    }
                }
                (su, 0.0)
            }
            _ => (
                m.cohesion.unwrap_or(0.0),
                m.friction_angle.unwrap_or(0.0).to_radians().tan(),
            ),
        };
        let rho = if depth > 0.0 && m.unit_weight > 0.0 {
            strength / (m.unit_weight * depth) + tan_phi
        } else {
            f64::INFINITY
        };
        contacts.push((i, rho, edges));
    }
    contacts.sort_by(|a, b| a.1.total_cmp(&b.1).then(a.0.cmp(&b.0)));
    Layers {
        contact: contacts.into_iter().next().map(|c| c.2).unwrap_or_default(),
        bases,
        has_contact,
    }
}
fn project(pm: &PreparedModel, p: Point, theta: f64, h: f64) -> Option<Point> {
    if h <= 0.0 {
        return None;
    }
    let (dx, dy) = (theta.cos(), theta.sin());
    let step = 0.01 * h;
    let max = 3.0 * (pm.x_max - pm.x_min + h);
    let (mut s, mut prev) = (0.0, 0.0);
    loop {
        s += step;
        if s > max {
            return None;
        }
        let x = p[0] + s * dx;
        if p[1] + s * dy >= pm.top_at(x)? {
            break;
        }
        prev = s;
    }
    for _ in 0..60 {
        let m = 0.5 * (prev + s);
        let x = p[0] + m * dx;
        if pm.top_at(x).is_none_or(|g| p[1] + m * dy >= g) {
            s = m;
        } else {
            prev = m;
        }
    }
    let x = p[0] + s * dx;
    Some([x, pm.top_at(x)?])
}
fn admissible(pm: &PreparedModel, win: [[f64; 2]; 2], p: &[Point]) -> bool {
    let tol = pm.tol().max(1e-6 * (pm.x_max - pm.x_min));
    let ok = |x: f64, w: [f64; 2]| x >= w[0].min(w[1]) - tol && x <= w[0].max(w[1]) + tol;
    p.len() >= 2
        && ok(p[0][0], win[0])
        && ok(p[p.len() - 1][0], win[1])
        && search_polyline_admissible(pm, p)
}
fn height(pm: &PreparedModel) -> f64 {
    let mut lo = f64::INFINITY;
    let mut hi = f64::NEG_INFINITY;
    for i in 0..=400 {
        if let Some(y) = pm.top_at(pm.x_min + (pm.x_max - pm.x_min) * i as f64 / 400.0) {
            lo = lo.min(y);
            hi = hi.max(y);
        }
    }
    hi - lo
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
    let mut algorithm = match spec.algorithm() {
        GlobalAlgorithm::Auto if layer.has_contact => "block",
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
                project(pm, points[0], tl, h),
                project(pm, *points.last().unwrap(), tr, h),
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
            let (q, value, used, _) =
                noncircular::refine_generated(pm, search, p.clone(), f, budget, &mut guarded);
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
            noncircular::refine_generated(pm, search, p, f, 1500, &mut guarded);
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
        assert!(l.has_contact && !l.contact.is_empty());
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
        assert!(!l.has_contact && l.contact.is_empty());
        assert!(!l.bases.is_empty());
        assert_eq!(l.block_edges(), l.bases.as_slice());
    }

    #[test]
    fn hoek_brown_and_shansep_regions_do_not_compete_for_the_layer() {
        // E17d: with `layer_4` turned into Hoek-Brown (or SHANSEP) it has no c and φ to rank: the layer moves.
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let original = layers(&m, &pm);
        for kind in [MaterialModel::HoekBrown, MaterialModel::Shansep] {
            let mut other = m.clone();
            other
                .materials
                .iter_mut()
                .find(|x| x.id == "layer_4")
                .unwrap()
                .model = kind;
            let moved = layers(&other, &pm);
            assert!(
                moved.has_contact,
                "the contact edges between regions still exist"
            );
            assert_ne!(moved.contact, original.contact);
            assert!(
                owners(&other, &moved.contact)
                    .iter()
                    .any(|id| id != "layer_4"),
                "{:?}",
                owners(&other, &moved.contact)
            );
        }
        // Undrained: ρ = Su/(γ·z) with tan φ = 0, so a very strong Su leaves the weakest region where it is.
        let mut su = m.clone();
        let mat = su.materials.iter_mut().find(|x| x.id == "layer_4").unwrap();
        mat.model = MaterialModel::Undrained;
        mat.undrained_strength = Some(1.0);
        mat.cohesion = None;
        mat.friction_angle = None;
        assert_eq!(layers(&su, &pm).contact, original.contact);
        su.materials
            .iter_mut()
            .find(|x| x.id == "layer_4")
            .unwrap()
            .undrained_strength = Some(1.0e6);
        assert_ne!(layers(&su, &pm).contact, original.contact);
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

    #[test]
    fn project_lands_on_the_ground_or_fails() {
        let m = v053();
        let pm = PreparedModel::new(&m).unwrap();
        let h = height(&pm);
        assert!(h > 0.0);
        let x = pm.x_min + 0.5 * (pm.x_max - pm.x_min);
        let deep = [x, pm.top_at(x).unwrap() - 0.5 * h];
        for deg in [30.0_f64, 60.0, 120.0, 150.0] {
            if let Some(q) = project(&pm, deep, deg.to_radians(), h) {
                assert!((q[1] - pm.top_at(q[0]).unwrap()).abs() < 1e-9);
                assert_eq!(q[0] > deep[0], deg < 90.0);
            }
        }
        assert!(project(&pm, deep, 0.5, 0.0).is_none());
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
        assert!(stats.refined >= 1 && stats.refined <= 3);
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
