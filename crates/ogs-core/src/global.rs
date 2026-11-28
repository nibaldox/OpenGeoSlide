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
fn layers(model: &Model, pm: &PreparedModel) -> (Vec<[Point; 2]>, bool) {
    let eps = 1e-4 * (pm.y_max - pm.y_min);
    let width = pm.x_max - pm.x_min;
    let has_contact_any = model.regions.iter().enumerate().any(|(i, r)| {
        r.polygon
            .iter()
            .zip(r.polygon.iter().cycle().skip(1))
            .any(|(a, b)| {
                let dx = b[0] - a[0];
                let dy = b[1] - a[1];
                let len = dx.hypot(dy);
                if dx.abs() <= 1e-9 * width || len <= 0.0 {
                    return false;
                }
                let mid = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
                let n = [-dy / len, dx / len];
                let p = [mid[0] + eps * n[0], mid[1] + eps * n[1]];
                let q = [mid[0] - eps * n[0], mid[1] - eps * n[1]];
                model.regions.iter().enumerate().any(|(j, other)| {
                    j != i && (inside(p, &other.polygon) || inside(q, &other.polygon))
                })
            })
    });
    let mut contacts: Vec<(usize, f64, Vec<[Point; 2]>)> = Vec::new();
    let mut bases = Vec::new();
    for (i, r) in model.regions.iter().enumerate() {
        let poly = &r.polygon;
        let Some(m) = model.materials.iter().find(|m| m.id == r.material) else {
            continue;
        };
        if matches!(m.model, MaterialModel::HoekBrown | MaterialModel::Shansep) {
            continue;
        }
        let n = poly.len() as f64;
        let xc = poly.iter().map(|p| p[0]).sum::<f64>() / n;
        let yc = poly.iter().map(|p| p[1]).sum::<f64>() / n;
        let depth = pm.top_at(xc).unwrap_or(yc) - yc;
        let strength = match m.model {
            MaterialModel::Undrained => {
                let mut su = m.undrained_strength.unwrap_or(0.0);
                if let (Some(d), Some(g)) = (m.strength_datum, m.strength_gradient) {
                    su = (su + (d - yc) * g).max(0.0);
                    if let Some(l) = m.strength_limit {
                        su = if g >= 0.0 { su.min(l) } else { su.max(l) };
                    }
                }
                su
            }
            _ => m.cohesion.unwrap_or(0.0),
        };
        let rho = if depth > 0.0 && m.unit_weight > 0.0 {
            strength / (m.unit_weight * depth) + m.friction_angle.unwrap_or(0.0).to_radians().tan()
        } else {
            f64::INFINITY
        };
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
        if !edges.is_empty() {
            contacts.push((i, rho, edges));
        }
    }
    contacts.sort_by(|a, b| a.1.total_cmp(&b.1).then(a.0.cmp(&b.0)));
    if let Some((_, _, edges)) = contacts.into_iter().next() {
        (edges, true)
    } else if has_contact_any {
        (Vec::new(), true)
    } else {
        (bases, false)
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
    let (edges, has_contact) = layers(model, pm);
    let mut algorithm = match spec.algorithm() {
        GlobalAlgorithm::Auto if has_contact => "block",
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
            let index = spec.seed() + stats.attempts as u64;
            let [a, b] =
                edges[((halton(index, 3) * edges.len() as f64) as usize).min(edges.len() - 1)];
            let k = 2 + usize::from(halton(index, 2) >= 0.5);
            let mut ts: Vec<f64> = [5, 7, 11, 13]
                .into_iter()
                .take(k + 1)
                .map(|base| halton(index, base))
                .collect();
            ts.sort_by(f64::total_cmp);
            let mut points: Vec<Point> = ts
                .iter()
                .map(|t| [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
                .collect();
            points.sort_by(|a, b| a[0].total_cmp(&b[0]));
            let tl = (90.0 + 45.0 * halton(index, 19)).to_radians();
            let tr = (45.0 + 45.0 * halton(index, 17)).to_radians();
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
        for (c, _) in seeds {
            let Some(p) = search_circle_polyline(pm, c) else {
                continue;
            };
            if !admissible(pm, win, &p) {
                continue;
            }
            stats.attempts += 1;
            let idx = stats.generated;
            stats.generated += 1;
            stats.evaluated += 1;
            if let Some(f) = guarded(&Surface::Polyline(Polyline { points: p.clone() })) {
                candidates.push((f, idx, p.clone()));
                start = Some((p, f));
                break;
            }
            if stats.generated >= n {
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
    #[test]
    fn contact_layers_and_homogeneous_fallback() {
        let m: Model = serde_json::from_str(include_str!(
            "../../../verification/global/models/V053.json"
        ))
        .unwrap();
        let pm = PreparedModel::new(&m).unwrap();
        let (edges, contact) = layers(&m, &pm);
        assert!(contact && !edges.is_empty());
        let row: serde_json::Value =
            serde_json::from_str(include_str!("../../../verification/cases/V001-nc.json")).unwrap();
        let m: Model = serde_json::from_value(row["model"].clone()).unwrap();
        let pm = PreparedModel::new(&m).unwrap();
        let (_, contact) = layers(&m, &pm);
        assert!(!contact);
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
}
