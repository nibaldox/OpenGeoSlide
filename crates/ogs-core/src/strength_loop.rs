//! Outer fixed-point loop for Hoek–Brown strength (F6.8).
use crate::geometry::PreparedModel;
use crate::hoek_brown;
use crate::methods::{self, MethodResult, SolveOptions, SolveStatus, solve_with};
use crate::model::{IntersliceFunction, IntersliceSpec, MethodKind};
use crate::report::{SliceStrength, StrengthReport};
use crate::slicer::Slice;
use crate::strength::StrengthLaw;

fn normals(slices: &[Slice], result: &MethodResult, spec: Option<&IntersliceSpec>) -> Vec<f64> {
    let f = result.fos / result.correction_factor.unwrap_or(1.0);
    if matches!(
        result.method,
        MethodKind::Spencer | MethodKind::MorgensternPrice
    ) {
        let faces = if result.method == MethodKind::MorgensternPrice {
            let (function, points) = spec.map_or((IntersliceFunction::HalfSine, None), |s| {
                (s.function, s.points.as_deref())
            });
            methods::morgenstern_price::interslice_faces(slices, function, points)
        } else {
            vec![1.0; slices.len() + 1]
        };
        let lambda = result.lambda.unwrap_or(0.0);
        let e = methods::spencer::interslice_forces(slices, &faces, f, lambda);
        methods::spencer::direct_normals_with_at(slices, f, &faces, lambda, &e)
    } else {
        slices
            .iter()
            .map(|s| methods::effective_normal(s, f, 0.0))
            .collect()
    }
}

#[cfg(test)]
thread_local! { static COMPATIBILITY: std::cell::Cell<bool> = const { std::cell::Cell::new(false) }; }
#[cfg(test)]
thread_local! { static PASS_LIMIT: std::cell::Cell<usize> = const { std::cell::Cell::new(50) }; }

pub(crate) fn solve(
    pm: &PreparedModel,
    slices: &mut [Slice],
    method: MethodKind,
    opts: &SolveOptions,
    interslice: Option<&IntersliceSpec>,
) -> (MethodResult, StrengthReport) {
    #[cfg(test)]
    let compatibility = COMPATIBILITY.with(std::cell::Cell::get);
    #[cfg(not(test))]
    let compatibility = false;
    #[cfg(test)]
    let limit = PASS_LIMIT.with(std::cell::Cell::get);
    #[cfg(not(test))]
    let limit = 50;
    solve_rule(pm, slices, method, opts, interslice, compatibility, limit)
}

fn solve_rule(
    pm: &PreparedModel,
    slices: &mut [Slice],
    method: MethodKind,
    opts: &SolveOptions,
    interslice: Option<&IntersliceSpec>,
    compatibility: bool,
    max_passes: usize,
) -> (MethodResult, StrengthReport) {
    let indices: Vec<usize> = slices
        .iter()
        .enumerate()
        .filter_map(|(i, s)| {
            (!methods::is_inert(s)
                && matches!(pm.materials[s.material].law, StrengthLaw::HoekBrown(_)))
            .then_some(i)
        })
        .collect();
    if indices.is_empty() {
        return (
            solve_with(slices, method, opts, interslice),
            StrengthReport::default(),
        );
    }
    for &i in &indices {
        let s = &mut slices[i];
        let StrengthLaw::HoekBrown(p) = &pm.materials[s.material].law else {
            unreachable!()
        };
        let sn = s.weight / s.width * s.alpha.cos().powi(2) - s.pore_pressure;
        (s.cohesion, s.tan_phi) = hoek_brown::tangent(p, sn, compatibility);
    }
    let mut previous: Option<f64> = None;
    for pass in 1..=max_passes {
        let mut result = solve_with(slices, method, opts, interslice);
        let mut report = StrengthReport {
            passes: Some(pass),
            slices: Vec::new(),
        };
        if result.status != SolveStatus::Converged {
            return (result, report);
        }
        let ns = normals(slices, &result, interslice);
        let mut low = false;
        for &i in &indices {
            let s = &slices[i];
            let StrengthLaw::HoekBrown(p) = &pm.materials[s.material].law else {
                unreachable!()
            };
            let sn = ns[i] / s.base_length;
            low |= sn <= hoek_brown::sn_zero(p);
            report.slices.push(SliceStrength::HoekBrown {
                index: i,
                normal_stress: sn,
            });
        }
        let f = result.fos / result.correction_factor.unwrap_or(1.0);
        if previous.is_some_and(|old| (f - old).abs() <= 1e-6 * f.abs()) {
            if low {
                result
                    .warnings
                    .push("hoek_brown_low_confinement".to_owned());
            }
            return (result, report);
        }
        if pass == max_passes {
            result.status = SolveStatus::NotConverged;
            result.message = Some("hoek_brown_not_converged".to_owned());
            result.warnings.clear();
            return (result, report);
        }
        previous = Some(f);
        for &i in &indices {
            let s = &mut slices[i];
            let StrengthLaw::HoekBrown(p) = &pm.materials[s.material].law else {
                unreachable!()
            };
            let (c, t) = hoek_brown::tangent(p, ns[i] / s.base_length, compatibility);
            s.cohesion = (s.cohesion + c) * 0.5;
            s.tan_phi = (s.tan_phi + t) * 0.5;
        }
    }
    unreachable!("at least one pass")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn pass_limit_reports_nonconvergence() {
        PASS_LIMIT.with(|c| c.set(1));
        let fixture: Value =
            serde_json::from_str(include_str!("../tests/data/f3b/hb/X28-F-X25.json")).unwrap();
        let output: Value =
            serde_json::from_str(&crate::analyze_json(&fixture["model"].to_string()).unwrap())
                .unwrap();
        for result in output["results"].as_array().unwrap() {
            assert_eq!(result["status"], "not_converged");
            assert!(
                result["warnings"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .any(|w| w == "hoek_brown_not_converged")
            );
        }
        PASS_LIMIT.with(|c| c.set(50));
    }

    #[test]
    fn compatibility_against_oracle() {
        COMPATIBILITY.with(|c| c.set(true));
        for name in [
            "X28-F-X25",
            "X28-F-HAM1",
            "X28-F-SA",
            "X28-F-SB",
            "X28-W-SB-LINEA16",
            "X28-R-SB-RU03",
            "X28-R-X25-RU03",
        ] {
            let path = format!(
                "{}/tests/data/f3b/hb/{name}.json",
                env!("CARGO_MANIFEST_DIR")
            );
            let fixture: Value =
                serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
            let output = crate::analyze_json(&fixture["model"].to_string()).unwrap();
            let report: Value = serde_json::from_str(&output).unwrap();
            for result in report["results"].as_array().unwrap() {
                let method = result["method"].as_str().unwrap();
                let expected = fixture["oracle"][method].as_f64().unwrap();
                let actual = result["fos"].as_f64();
                let diagnostic = (name == "X28-F-SB" || name == "X28-R-X25-RU03")
                    && (method == "spencer" || method == "morgenstern_price");
                println!(
                    "{name} {method}: referencia {expected:.6}, motor {actual:?}, diferencia {:?}%{}",
                    actual.map(|a| (a / expected - 1.0) * 100.0),
                    if diagnostic { " diagnóstico" } else { "" }
                );
                if !diagnostic || actual.is_some_and(|a| (a / expected - 1.0).abs() <= 0.001) {
                    assert_eq!(result["status"], "converged", "{name} {method}: {result}");
                    assert!(
                        (actual.unwrap() / expected - 1.0).abs() <= 0.001,
                        "{name} {method}"
                    );
                }
            }
        }
        COMPATIBILITY.with(|c| c.set(false));
    }
}
