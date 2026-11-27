//! Acceptance test: every check in `verification/cases/*.json` must match its published value
//! within the stated relative tolerance. An empty case set is a failure, never a silent pass.
//!
//! The case files are strict: an unknown field in a case, check or option is an error. A check also
//! fails when the engine emits a warning that is not informative, because such a warning means the
//! result was computed under an assumption (for example, water over the ground) that the verification
//! case does not state. Informative warnings (contract E5) are listed in `INFORMATIVE_WARNINGS`; they
//! are printed in the `avisos` column and do not fail the check.

use std::fs;
use std::path::PathBuf;

use ogs_core::analyze;
use ogs_core::methods::SolveStatus;
use ogs_core::model::{MethodKind, Model};
use serde::Deserialize;
use serde_json::{Value, json};

/// Warning codes that are informative (contract E5): they are reported, not failed.
/// Any other warning code fails the check.
const INFORMATIVE_WARNINGS: &[&str] = &[
    "negative_effective_normal",
    "truncated_mass",
    "negative_lambda",
    "load_outside_mass",
    "multiple_admissible_roots",
    "reinforcement_outside_mass",
    "reinforcement_compression_ignored",
    "reinforcement_active_compression",
    "structural_checks_not_covered",
    "water_above_ground",        // F5.3: a note, the ponded water is included
    "water_unit_weight_default", // E15m-6: imperial model with water and without water.unit_weight
];

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Case {
    id: String,
    title: String,
    model: Model,
    checks: Vec<Check>,
    source: Source,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
#[allow(dead_code)] // Documentation fields: they must be present, their content is not checked.
struct Source {
    reference: String,
    derived_from: String,
    notes: Vec<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
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
#[serde(deny_unknown_fields)]
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
        "{:<10} | {:<8} | {:<6} | {:>12} | {:>12} | {:>8} | {:>7} | {:<28} | OK/FAIL",
        "id", "método", "tipo", "publicado", "ogs", "err%", "tol%", "avisos"
    );

    for file in &files {
        let text = fs::read_to_string(file)
            .unwrap_or_else(|e| panic!("cannot read {}: {e}", file.display()));
        let case: Case = serde_json::from_str(&text)
            .unwrap_or_else(|e| panic!("{} is not a valid case: {e}", file.display()));
        println!("# {} — {}", case.id, case.title);
        assert!(!case.checks.is_empty(), "case {} has no checks", case.id);
        assert!(
            !case.source.reference.is_empty(),
            "case {} has an empty source reference",
            case.id
        );

        for check in &case.checks {
            total += 1;
            let mut model = case.model.clone();
            model.analysis.methods = vec![check.method];
            // `analysis.interslice` only goes with Morgenstern-Price (F3.4): a Bishop, Spencer or Janbu check of the
            // same case runs without it, like the harness does.
            if check.method != MethodKind::MorgensternPrice {
                model.analysis.interslice = None;
            }
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
                    let blocking: Vec<&String> = res
                        .warnings
                        .iter()
                        .filter(|w| !INFORMATIVE_WARNINGS.contains(&w.as_str()))
                        .collect();
                    if !blocking.is_empty() {
                        return Err(format!("unexpected warnings: {blocking:?}"));
                    }
                    // Converged implies a finite FS; a `None` here is a contract violation.
                    let fos = res
                        .fos
                        .ok_or_else(|| "converged without a finite fos".to_string())?;
                    Ok((fos, res.warnings.clone()))
                });

            match outcome {
                Ok((fos, warnings)) => {
                    let err = (fos - check.published).abs() / check.published.abs();
                    let ok = err <= check.tolerance;
                    let avisos = if warnings.is_empty() {
                        "-".to_string()
                    } else {
                        warnings.join(",")
                    };
                    println!(
                        "{:<10} | {:<8} | {:<6} | {:>12.6} | {:>12.6} | {:>8.4} | {:>7.3} | {:<28} | {}",
                        case.id,
                        method,
                        kind,
                        check.published,
                        fos,
                        100.0 * err,
                        100.0 * check.tolerance,
                        avisos,
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
                        "{:<10} | {:<8} | {:<6} | {:>12.6} | {:>12} | {:>8} | {:>7.3} | {:<28} | ERROR",
                        case.id,
                        method,
                        kind,
                        check.published,
                        "-",
                        "-",
                        100.0 * check.tolerance,
                        "-"
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

/// Parses a minimal case document; `patch` lets a test add one unknown field somewhere.
fn case_doc(patch: impl Fn(&mut Value)) -> String {
    let model: Value =
        serde_json::from_str(include_str!("../../../examples/acads1a.ogs.json")).unwrap();
    let mut doc = json!({
        "id": "T000",
        "title": "documento de prueba",
        "model": model,
        "checks": [{
            "method": "bishop", "kind": "search", "published": 0.987,
            "published_by": "prueba", "tolerance": 0.01, "options": {"slices": 50}
        }],
        "source": {"reference": "ref", "derived_from": "origen", "notes": []}
    });
    patch(&mut doc);
    doc.to_string()
}

#[test]
fn case_documents_parse_and_reject_unknown_fields() {
    assert!(serde_json::from_str::<Case>(&case_doc(|_| {})).is_ok());
    type Patch = fn(&mut Value);
    let variants: [(&str, Patch); 3] = [
        ("case", |d| d["extra"] = json!(1)),
        ("check", |d| d["checks"][0]["tolerence"] = json!(0.01)),
        ("options", |d| {
            d["checks"][0]["options"]["slice"] = json!(50)
        }),
    ];
    for (level, patch) in variants {
        let err = serde_json::from_str::<Case>(&case_doc(patch))
            .err()
            .unwrap_or_else(|| panic!("{level}: an unknown field must be an error"));
        assert!(err.to_string().contains("unknown field"), "{level}: {err}");
    }
}

#[test]
fn case_documents_require_source() {
    let mut doc: Value = serde_json::from_str(&case_doc(|_| {})).unwrap();
    doc.as_object_mut().unwrap().remove("source");
    assert!(serde_json::from_str::<Case>(&doc.to_string()).is_err());
}
