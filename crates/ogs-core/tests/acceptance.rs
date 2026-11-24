//! Acceptance test: every check in `verification/cases/*.json` must match its published value
//! within the stated relative tolerance. An empty case set is a failure, never a silent pass.

use std::fs;
use std::path::PathBuf;

use ogs_core::analyze;
use ogs_core::methods::SolveStatus;
use ogs_core::model::{MethodKind, Model};
use serde::Deserialize;

#[derive(Deserialize)]
struct Case {
    id: String,
    title: String,
    model: Model,
    checks: Vec<Check>,
}

#[derive(Deserialize)]
struct Check {
    method: MethodKind,
    kind: CheckKind,
    published: f64,
    published_by: String,
    tolerance: f64,
    #[serde(default)]
    options: CheckOptions,
}

#[derive(Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum CheckKind {
    Fixed,
    Search,
}

#[derive(Deserialize, Default)]
struct CheckOptions {
    slices: Option<usize>,
}

#[test]
fn verification_cases_match_published_values() {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../verification/cases");
    let entries =
        fs::read_dir(&dir).unwrap_or_else(|e| panic!("cannot read {}: {e}", dir.display()));
    let mut files: Vec<PathBuf> = entries
        .map(|e| e.expect("readable directory entry").path())
        .filter(|p| p.extension().is_some_and(|x| x == "json"))
        .collect();
    files.sort();
    assert!(
        !files.is_empty(),
        "no verification cases found in {} (refusing to report an empty success)",
        dir.display()
    );

    let mut total = 0usize;
    let mut failures: Vec<String> = Vec::new();
    println!(
        "{:<10} | {:<8} | {:<6} | {:>12} | {:>12} | {:>8} | {:>7} | OK/FAIL",
        "id", "método", "tipo", "publicado", "ogs", "err%", "tol%"
    );

    for file in &files {
        let text = fs::read_to_string(file)
            .unwrap_or_else(|e| panic!("cannot read {}: {e}", file.display()));
        let case: Case = serde_json::from_str(&text)
            .unwrap_or_else(|e| panic!("{} is not a valid case: {e}", file.display()));
        println!("# {} — {}", case.id, case.title);
        assert!(!case.checks.is_empty(), "case {} has no checks", case.id);

        for check in &case.checks {
            total += 1;
            let mut model = case.model.clone();
            model.analysis.methods = vec![check.method];
            match check.kind {
                CheckKind::Fixed => {
                    assert!(
                        model.analysis.surface.is_some(),
                        "{}: kind \"fixed\" requires model.analysis.surface",
                        case.id
                    );
                    model.analysis.search = None;
                }
                CheckKind::Search => assert!(
                    model.analysis.search.is_some(),
                    "{}: kind \"search\" requires model.analysis.search",
                    case.id
                ),
            }
            if let Some(slices) = check.options.slices {
                model.analysis.slices = slices;
            }

            let method = format!("{:?}", check.method).to_lowercase();
            let kind = format!("{:?}", check.kind).to_lowercase();
            let outcome = analyze(&model)
                .map_err(|e| e.to_string())
                .and_then(|report| {
                    let res = report
                        .results
                        .first()
                        .ok_or_else(|| "analysis returned no result".to_string())?;
                    if res.status != SolveStatus::Converged {
                        return Err(format!("status {:?}", res.status));
                    }
                    Ok(res.fos)
                });

            match outcome {
                Ok(fos) => {
                    let err = (fos - check.published).abs() / check.published.abs();
                    let ok = err <= check.tolerance;
                    println!(
                        "{:<10} | {:<8} | {:<6} | {:>12.6} | {:>12.6} | {:>8.4} | {:>7.3} | {}",
                        case.id,
                        method,
                        kind,
                        check.published,
                        fos,
                        100.0 * err,
                        100.0 * check.tolerance,
                        if ok { "OK" } else { "FAIL" }
                    );
                    if !ok {
                        failures.push(format!(
                            "{} {method} ({kind}): ogs={fos:.6} vs publicado={:.6} (por {}), err={:.3}% > tol={:.3}%",
                            case.id,
                            check.published,
                            check.published_by,
                            100.0 * err,
                            100.0 * check.tolerance
                        ));
                    }
                }
                Err(msg) => {
                    println!(
                        "{:<10} | {:<8} | {:<6} | {:>12.6} | {:>12} | {:>8} | {:>7.3} | ERROR",
                        case.id,
                        method,
                        kind,
                        check.published,
                        "-",
                        "-",
                        100.0 * check.tolerance
                    );
                    failures.push(format!(
                        "{} {method} ({kind}): {msg} (publicado {:.6} por {})",
                        case.id, check.published, check.published_by
                    ));
                }
            }
        }
    }

    println!("{total} checks, {} failures", failures.len());
    assert!(
        failures.is_empty(),
        "{} de {total} checks fallan:\n{}",
        failures.len(),
        failures.join("\n")
    );
}
