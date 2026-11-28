//! Deterministic alternating-variable non-circular refinement (F6.10, X24 §1, X29).
use crate::geometry::{PreparedModel, Sliding};
use crate::model::{Circle, MethodKind, NonCircularSpec, Point, SearchSpec};
use crate::search::NonCircularStats;
use crate::surface::{Polyline, Surface, search_circle_polyline, search_polyline_admissible};

/// Informative note emitted by the caller when FS falls more than 15%.
pub const NON_CIRCULAR_LARGE_CHANGE: &str = "non_circular_large_change";
/// Informative note (E16x): the non-circular search was asked for and no polyline was admissible (`evaluated = 0`), so
/// the result is the circle of the circular search.
pub const NON_CIRCULAR_NOT_REFINED: &str = "non_circular_not_refined";
const BUDGET: usize = 1500;

struct Optimizer<'a, E> {
    pm: &'a PreparedModel,
    windows: [[f64; 2]; 2],
    eval: &'a mut E,
    used: usize,
    budget: usize,
}

impl<E: FnMut(&Surface) -> Option<f64>> Optimizer<'_, E> {
    /// Margin of the windows (E16x): `max(pm.tol(), 1e-6·width)`, the scale of the minimum `dx` of F6.10, point 6. A circle
    /// that leaves grazing the toe crosses the ground almost tangent, and the error of its crossing is of the order of
    /// the square root of the tolerance (9,5e-6 measured in a berm with the exit in `[10, 20]`).
    fn window_margin(&self) -> f64 {
        self.pm.tol().max(1e-6 * (self.pm.x_max - self.pm.x_min))
    }
    fn evaluate(&mut self, p: &[Point]) -> Option<f64> {
        let tol = self.window_margin();
        let inside = |x: f64, [a, b]: [f64; 2]| x >= a.min(b) - tol && x <= a.max(b) + tol;
        if self.used >= self.budget
            || p.len() < 2
            || !inside(p[0][0], self.windows[0])
            || !inside(p[p.len() - 1][0], self.windows[1])
            || !search_polyline_admissible(self.pm, p)
        {
            return None;
        }
        self.used += 1;
        (self.eval)(&Surface::Polyline(Polyline { points: p.to_vec() }))
            .filter(|f| f.is_finite() && *f > 0.0)
    }
    fn moved(&self, points: &[Point], k: usize, t: f64, dirs: &[Point]) -> Option<Point> {
        let p = points[k];
        if k == 0 || k + 1 == points.len() {
            let x = p[0] + t;
            let [a, b] = self.windows[usize::from(k != 0)];
            let tol = self.window_margin();
            if x < a.min(b) - tol || x > a.max(b) + tol {
                return None;
            }
            Some([x, self.pm.top_at(x)?])
        } else {
            Some([p[0] + t * dirs[k][0], p[1] + t * dirs[k][1]])
        }
    }
    fn optimize(&mut self, mut p: Vec<Point>, mut f: f64) -> (Vec<Point>, f64) {
        let delta0 = 0.1
            * p.windows(2)
                .map(|w| (w[1][0] - w[0][0]).hypot(w[1][1] - w[0][1]))
                .fold(f64::INFINITY, f64::min);
        if !delta0.is_finite() || delta0 <= 0.0 {
            return (p, f);
        }
        let mut delta = delta0;
        while delta >= 0.02 * delta0 && self.used < self.budget {
            for _ in 0..6 {
                if self.used >= self.budget {
                    break;
                }
                let n = p.len();
                let mut dirs = vec![[0.0, 0.0]; n];
                for k in 1..n - 1 {
                    let normal = |a: Point, b: Point| {
                        let dx = b[0] - a[0];
                        let dy = b[1] - a[1];
                        let l = dx.hypot(dy);
                        [-dy / l, dx / l]
                    };
                    let a = normal(p[k - 1], p[k]);
                    let b = normal(p[k], p[k + 1]);
                    let (x, y) = (a[0] + b[0], a[1] + b[1]);
                    let l = x.hypot(y);
                    dirs[k] = if l < 1e-12 { a } else { [x / l, y / l] };
                }
                let mut shifts = vec![0.0; n];
                let mut best: Option<(f64, Vec<Point>)> = None;
                for k in 0..n {
                    let mut sides = [None, None];
                    for (j, t) in [delta, -delta].into_iter().enumerate() {
                        if self.used >= self.budget {
                            break;
                        }
                        let Some(pt) = self.moved(&p, k, t, &dirs) else {
                            continue;
                        };
                        let mut q = p.clone();
                        q[k] = pt;
                        if let Some(v) = self.evaluate(&q) {
                            sides[j] = Some(v);
                            if best.as_ref().is_none_or(|(b, _)| v < *b) {
                                best = Some((v, q));
                            }
                        }
                    }
                    shifts[k] = match (sides[0], sides[1]) {
                        (Some(fp), Some(fm)) => {
                            let c = fp + fm - 2.0 * f;
                            if c > 0.0 {
                                (delta * (fm - fp) / (2.0 * c)).clamp(-delta, delta)
                            } else if fp < f || fm < f {
                                if fp < fm { delta } else { -delta }
                            } else {
                                0.0
                            }
                        }
                        (Some(fp), None) if fp < f => delta,
                        (None, Some(fm)) if fm < f => -delta,
                        _ => 0.0,
                    };
                }
                if self.used < self.budget && shifts.iter().any(|s| *s != 0.0) {
                    let mut q = p.clone();
                    let mut ok = true;
                    for k in 0..n {
                        if shifts[k] != 0.0 {
                            if let Some(pt) = self.moved(&p, k, shifts[k], &dirs) {
                                q[k] = pt;
                            } else {
                                ok = false;
                                break;
                            }
                        }
                    }
                    if ok
                        && let Some(v) = self.evaluate(&q)
                        && best.as_ref().is_none_or(|(b, _)| v < *b)
                    {
                        best = Some((v, q));
                    }
                }
                match best {
                    Some((v, q)) if v < f - 1e-6 => {
                        p = q;
                        f = v;
                    }
                    _ => break,
                }
            }
            delta *= 0.5;
        }
        (p, f)
    }
}

pub(crate) fn windows(pm: &PreparedModel, search: &SearchSpec) -> [[f64; 2]; 2] {
    let full = [pm.x_min, pm.x_max];
    let entry = search.entry.unwrap_or(full);
    let exit = search.exit.unwrap_or(full);
    match pm.sliding {
        Sliding::LeftToRight => [entry, exit],
        Sliding::RightToLeft => [exit, entry],
    }
}

/// Refine each seed, keeping the circle on ties (F6.10 and E16s).
pub(crate) fn refine(
    pm: &PreparedModel,
    _method: MethodKind,
    search: &SearchSpec,
    spec: &NonCircularSpec,
    seeds: Vec<(Circle, f64)>,
    mut eval: impl FnMut(&Surface) -> Option<f64>,
) -> (Surface, NonCircularStats) {
    let (circle, seed_fos) = seeds[0];
    let windows = windows(pm, search);
    let mut stats = NonCircularStats {
        seeds: 0,
        evaluated: 0,
        seed_fos,
        polyline_fos: None,
        global: None,
    };
    let mut best_surface = Surface::Circle(circle);
    for (circle, _) in seeds.into_iter().take(spec.seeds()) {
        stats.seeds += 1;
        let mut opt = Optimizer {
            pm,
            windows,
            eval: &mut eval,
            used: 0,
            budget: BUDGET,
        };
        if let Some(mut p) = search_circle_polyline(pm, &circle)
            && let Some(mut f) = opt.evaluate(&p)
        {
            for level in [9, 17, 33] {
                if level > spec.max_vertices() {
                    break;
                }
                if p.len() < level {
                    let mut q = Vec::with_capacity(level);
                    for w in p.windows(2) {
                        q.push(w[0]);
                        q.push([(w[0][0] + w[1][0]) * 0.5, (w[0][1] + w[1][1]) * 0.5]);
                    }
                    q.push(*p.last().unwrap());
                    if let Some(v) = opt.evaluate(&q) {
                        p = q;
                        f = v;
                    } else {
                        break;
                    }
                }
                (p, f) = opt.optimize(p, f);
                if stats.polyline_fos.is_none_or(|v| f < v) {
                    stats.polyline_fos = Some(f);
                    if f < seed_fos {
                        best_surface = Surface::Polyline(Polyline { points: p.clone() });
                    }
                }
            }
        }
        stats.evaluated += opt.used;
    }
    (best_surface, stats)
}

/// Refine a generated polyline under the same geometric and evaluation budget as F6.10, up to `max_vertices`
/// (E17e §3). It keeps the best `(points, FS)` pair of every level and round, so the result is never above the FS
/// of its input (E17e §4). `gain` is what the last optimization gained.
pub(crate) fn refine_generated<E: FnMut(&Surface) -> Option<f64>>(
    pm: &PreparedModel,
    search: &SearchSpec,
    mut points: Vec<Point>,
    mut fos: f64,
    (budget, max_vertices): (usize, usize),
    eval: &mut E,
) -> (Vec<Point>, f64, usize, f64) {
    let mut opt = Optimizer {
        pm,
        windows: windows(pm, search),
        eval,
        used: 0,
        budget,
    };
    let mut best = (points.clone(), fos);
    let mut gain = 0.0;
    for level in [9, 17, 33] {
        if level > max_vertices {
            break;
        }
        if points.len() > level {
            continue;
        }
        if points.len() < level {
            let mut next = points.clone();
            if level == 2 * next.len() - 1 {
                let mut q = Vec::with_capacity(level);
                for w in next.windows(2) {
                    q.push(w[0]);
                    q.push([(w[0][0] + w[1][0]) * 0.5, (w[0][1] + w[1][1]) * 0.5]);
                }
                q.push(*next.last().unwrap());
                next = q;
            } else {
                while next.len() < level {
                    let i = next
                        .windows(2)
                        .enumerate()
                        .max_by(|(ia, a), (ib, b)| {
                            (a[1][0] - a[0][0])
                                .hypot(a[1][1] - a[0][1])
                                .total_cmp(&(b[1][0] - b[0][0]).hypot(b[1][1] - b[0][1]))
                                .then_with(|| ib.cmp(ia))
                        })
                        .unwrap()
                        .0;
                    let a = next[i];
                    let b = next[i + 1];
                    next.insert(i + 1, [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5]);
                }
            }
            let Some(f) = opt.evaluate(&next) else { break };
            points = next;
            fos = f;
        }
        let prior = fos;
        (points, fos) = opt.optimize(points, fos);
        gain = prior - fos;
        if fos < best.1 {
            best = (points.clone(), fos);
        }
    }
    (best.0, best.1, opt.used, gain)
}

pub(crate) fn polish_generated<E: FnMut(&Surface) -> Option<f64>>(
    pm: &PreparedModel,
    search: &SearchSpec,
    mut points: Vec<Point>,
    mut fos: f64,
    mut gain: f64,
    eval: &mut E,
) -> (Vec<Point>, f64, usize) {
    let mut opt = Optimizer {
        pm,
        windows: windows(pm, search),
        eval,
        used: 0,
        budget: 3000,
    };
    for _ in 0..4 {
        if gain <= 0.001 || opt.used >= opt.budget {
            break;
        }
        let prior = fos;
        (points, fos) = opt.optimize(points, fos);
        gain = prior - fos;
    }
    (points, fos, opt.used)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Model;
    use serde_json::{Value, json};

    fn fixture(name: &str) -> (Value, Model, PreparedModel) {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/data/f3b/nc")
            .join(name);
        let row: Value = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
        let v = row["model"].clone();
        let m: Model = serde_json::from_value(v.clone()).unwrap();
        let pm = PreparedModel::new(&m).unwrap();
        (v, m, pm)
    }

    #[test]
    fn search_concavity_does_not_change_fixed_polylines() {
        let (_, _, pm) = fixture("V001-k4.json");
        let points = vec![
            [0.0, 15.0],
            [10.0, 9.0],
            [20.0, 11.0],
            [30.0, 12.0],
            [40.0, pm.top_at(40.0).unwrap()],
        ];
        assert!(!search_polyline_admissible(&pm, &points));
        let surface = Surface::Polyline(Polyline { points });
        assert!(surface.fit_to_ground(&pm).is_ok());
    }

    /// E16x, point 2: an end within `max(pm.tol(), 1e-6·width)` of the edge of its window is inside; one beyond it is not.
    #[test]
    fn window_has_a_margin_of_1e6_width() {
        let (_, _, pm) = fixture("V001-k4.json");
        let tol = pm.tol().max(1e-6 * (pm.x_max - pm.x_min));
        let (x0, x1) = (10.0, 20.0);
        let mut calls = 0;
        let mut eval = |_: &Surface| {
            calls += 1;
            Some(1.0)
        };
        let mut opt = Optimizer {
            pm: &pm,
            windows: [[x0, x1], [x0, x1]],
            eval: &mut eval,
            used: 0,
            budget: BUDGET,
        };
        let y = |x: f64| pm.top_at(x).unwrap();
        let ok = |a: f64, b: f64| vec![[a, y(a)], [15.0, 5.0], [b, y(b)]];
        assert!(opt.evaluate(&ok(x0 - 0.5 * tol, x1 + 0.5 * tol)).is_some());
        assert!(opt.evaluate(&ok(x0 - 100.0 * tol, 15.0 + 1.0)).is_none());
        assert!(opt.evaluate(&ok(11.0, x1 + 100.0 * tol)).is_none());
    }

    #[test]
    fn no_evaluable_polyline_omits_polyline_fos() {
        let (_, model, pm) = fixture("V001-k4.json");
        let search = model.analysis.search.as_ref().unwrap();
        let spec = search.non_circular.as_ref().unwrap();
        let c = Circle {
            xc: 35.0,
            yc: 40.0,
            r: 25.0,
        };
        let (surface, stats) = refine(
            &pm,
            MethodKind::Spencer,
            search,
            spec,
            vec![(c, 1.0)],
            |_| None,
        );
        assert!(matches!(surface, Surface::Circle(_)));
        assert!(stats.polyline_fos.is_none());
        assert!(
            serde_json::to_value(stats)
                .unwrap()
                .get("polyline_fos")
                .is_none()
        );
    }

    // Instrument all converged candidate polylines without changing the product interface.
    #[test]
    #[ignore = "diagnostic: re-analyzes every candidate"]
    fn v002_tension_candidate_proportion() {
        let (mut doc, model, pm) = fixture("V002-k1.json");
        let search = model.analysis.search.as_ref().unwrap();
        let spec = search.non_circular.as_ref().unwrap();
        doc["analysis"].as_object_mut().unwrap().remove("search");
        let fixed = |doc: &mut Value, surface: Value| -> Option<Value> {
            doc["analysis"]["surface"] = surface;
            Some(serde_json::from_str::<Value>(&crate::analyze_json(&doc.to_string()).ok()?).ok()?["results"][0].clone())
        };
        let search_result = crate::search::search_circular(&pm, search, |c| {
            let mut d = doc.clone();
            let r = fixed(&mut d, json!({"type":"circle","xc":c.xc,"yc":c.yc,"r":c.r}))?;
            (r["status"] == "converged")
                .then(|| r["fos"].as_f64())
                .flatten()
        });
        let (mut converged, mut major) = (0usize, 0usize);
        let (_, stats) = refine(
            &pm,
            MethodKind::MorgensternPrice,
            search,
            spec,
            search_result.seeds,
            |s| {
                let Surface::Polyline(p) = s else {
                    unreachable!()
                };
                let r = fixed(&mut doc, json!({"type":"polyline","points":p.points}))?;
                if r["status"] != "converged" {
                    return None;
                }
                converged += 1;
                if r["warnings"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .any(|w| w == "negative_effective_normal_major")
                {
                    major += 1;
                }
                r["fos"].as_f64()
            },
        );
        println!(
            "V002 candidate warnings: {major}/{converged} converged; {} admissible evaluations",
            stats.evaluated
        );
        assert!(converged > 0);
    }
}
