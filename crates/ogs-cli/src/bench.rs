//! `ogs bench`: times the critical-surface search of one verification case, per method.
//!
//! Same protocol as the Node and Chrome benchmarks (`bench/`): one warm-up run, then `--reps` timed
//! runs of `analyze_json` (JSON in, JSON out, the same entry point the wasm build exports). Only the
//! analysis call is timed; reading the case and checking the output happen outside the timer.
//!
//! Output: a JSON array with one record per method. Target `native` is the default single-thread
//! build; `native-parallel` is the same code built with `--features parallel`.

use std::fs;
use std::process::ExitCode;
use std::time::Instant;

use serde_json::{Value, json};

const USAGE: &str = "uso: ogs bench <caso.json> [--reps N] \
     [--method bishop|spencer|morgenstern_price|janbu_simplified|janbu_corrected|all] \
     (all = los cinco métodos)";
/// Methods that need the format v0.3 (E13a): the benchmark raises the version of the case to 0.3 for them, never lower.
const V03_METHODS: [&str; 3] = ["morgenstern_price", "janbu_simplified", "janbu_corrected"];
const WARMUP_RUNS: usize = 1;
const DEFAULT_REPS: usize = 5;

/// Label written in the `target` field of every record.
const TARGET: &str = if cfg!(feature = "parallel") {
    "native-parallel"
} else {
    "native"
};

struct Options {
    path: String,
    reps: usize,
    methods: Vec<&'static str>,
}

/// Runs `ogs bench` with the arguments that follow the subcommand name.
pub fn run(args: &[&str]) -> ExitCode {
    let opts = match parse(args) {
        Ok(opts) => opts,
        Err(msg) => {
            eprintln!("ogs: {msg}\n{USAGE}");
            return ExitCode::from(2);
        }
    };
    match execute(&opts) {
        Ok(json) => {
            println!("{json}");
            ExitCode::SUCCESS
        }
        Err(msg) => {
            eprintln!("ogs: {msg}");
            ExitCode::from(2)
        }
    }
}

fn parse(args: &[&str]) -> Result<Options, String> {
    let mut path: Option<String> = None;
    let mut reps = DEFAULT_REPS;
    let mut method = "all";
    let mut i = 0;
    while i < args.len() {
        match args[i] {
            "--reps" => {
                i += 1;
                let raw = args.get(i).ok_or("--reps requiere un número")?;
                reps = raw
                    .parse::<usize>()
                    .ok()
                    .filter(|&n| n >= 1)
                    .ok_or_else(|| format!("--reps no válido: {raw}"))?;
            }
            "--method" => {
                i += 1;
                method = args.get(i).ok_or("--method requiere un método o all")?;
            }
            flag if flag.starts_with("--") => return Err(format!("opción desconocida: {flag}")),
            file => {
                if path.is_some() {
                    return Err("se esperaba un único archivo de caso".to_string());
                }
                path = Some(file.to_string());
            }
        }
        i += 1;
    }
    let path = path.ok_or("falta el archivo de caso")?;
    let methods = match method {
        "all" => vec![
            "bishop",
            "spencer",
            "morgenstern_price",
            "janbu_simplified",
            "janbu_corrected",
        ],
        "bishop" => vec!["bishop"],
        "spencer" => vec!["spencer"],
        "morgenstern_price" => vec!["morgenstern_price"],
        "janbu_simplified" => vec!["janbu_simplified"],
        "janbu_corrected" => vec!["janbu_corrected"],
        other => return Err(format!("método no válido: {other}")),
    };
    Ok(Options {
        path,
        reps,
        methods,
    })
}

fn execute(opts: &Options) -> Result<String, String> {
    let text = fs::read_to_string(&opts.path)
        .map_err(|e| format!("no se puede leer {}: {e}", opts.path))?;
    let root: Value =
        serde_json::from_str(&text).map_err(|e| format!("JSON no válido en {}: {e}", opts.path))?;
    // A verification case (§2) wraps the model in `model`; a bare .ogs.json model is accepted too.
    let model = match root.get("model") {
        Some(model) => model.clone(),
        None => root.clone(),
    };
    if model["analysis"]["search"].is_null() {
        return Err("el caso no tiene analysis.search: ogs bench mide la búsqueda".to_string());
    }
    let case_id = root
        .get("id")
        .or_else(|| model["meta"].get("id"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    let mut records = Vec::with_capacity(opts.methods.len());
    for &method in &opts.methods {
        records.push(bench_method(&model, &case_id, method, opts.reps)?);
    }
    serde_json::to_string_pretty(&Value::Array(records)).map_err(|e| e.to_string())
}

/// The version the benchmark writes for `method` (E14o-15): the greater of the declared one and the one the method needs.
/// A declared version that is not `"major.minor"` is returned as it is, for the engine to refuse.
fn bench_version(declared: &str, method: &str) -> String {
    fn parse(version: &str) -> Option<(u32, u32)> {
        let (major, minor) = version.split_once('.')?;
        Some((major.parse().ok()?, minor.parse().ok()?))
    }
    if !V03_METHODS.contains(&method) {
        return declared.to_string();
    }
    match parse(declared) {
        Some(declared_at) if declared_at < (0, 3) => "0.3".to_string(),
        _ => declared.to_string(),
    }
}

fn bench_method(model: &Value, case_id: &str, method: &str, reps: usize) -> Result<Value, String> {
    let mut model = model.clone();
    model["analysis"]["methods"] = json!([method]);
    let declared = model["version"].as_str().unwrap_or_default().to_string();
    model["version"] = json!(bench_version(&declared, method));
    let input = serde_json::to_string(&model).map_err(|e| e.to_string())?;

    for _ in 0..WARMUP_RUNS {
        ogs_core::analyze_json(&input).map_err(|e| format!("{method}: {e}"))?;
    }

    let mut ms = Vec::with_capacity(reps);
    let mut last_output = String::new();
    for _ in 0..reps {
        let start = Instant::now();
        let output = ogs_core::analyze_json(&input).map_err(|e| format!("{method}: {e}"))?;
        ms.push(start.elapsed().as_secs_f64() * 1000.0);
        last_output = output;
    }

    // Outside the timer: read the figures of the last run.
    let report: Value = serde_json::from_str(&last_output).map_err(|e| e.to_string())?;
    let result = &report["results"][0];
    let median_ms = median(&ms);
    Ok(json!({
        "target": TARGET,
        "engine": report["engine"],
        "case": case_id,
        "method": method,
        "reps": reps,
        "ms": ms,
        "median_ms": median_ms,
        "evaluated": result["search"]["evaluated"],
        "valid": result["search"]["valid"],
        "fos": result["fos"],
    }))
}

/// Median of a non-empty slice (mean of the two middle values when the length is even).
fn median(values: &[f64]) -> f64 {
    let mut sorted = values.to_vec();
    sorted.sort_by(f64::total_cmp);
    let mid = sorted.len() / 2;
    if sorted.len() % 2 == 1 {
        sorted[mid]
    } else {
        (sorted[mid - 1] + sorted[mid]) / 2.0
    }
}

#[cfg(test)]
mod tests {
    use super::{median, parse};

    #[test]
    fn median_odd_and_even() {
        assert_eq!(median(&[3.0, 1.0, 2.0]), 2.0);
        assert_eq!(median(&[4.0, 1.0, 3.0, 2.0]), 2.5);
        assert_eq!(median(&[7.0]), 7.0);
    }

    /// A v0.4 case with reinforcements and a (small) search, read from the verification cases.
    fn v04_case_text() -> String {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../verification/cases/V037.json"
        );
        let text = std::fs::read_to_string(path).expect("V037.json");
        let mut root: serde_json::Value = serde_json::from_str(&text).unwrap();
        let search = &mut root["model"]["analysis"]["search"];
        for key in ["n_entry", "n_exit", "n_radius"] {
            search[key] = serde_json::json!(5);
        }
        search["refine"] = serde_json::json!(false);
        root.to_string()
    }

    /// R11B-04: `ogs bench` lowered `"0.4"` to `"0.3"` for the v0.3 methods, and the engine refused the reinforcements.
    #[test]
    fn bench_keeps_version_0_4_for_every_method() {
        let dir = std::env::temp_dir().join(format!("ogs-bench-v04-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("v037-small.json");
        std::fs::write(&file, v04_case_text()).unwrap();
        let methods: Vec<&'static str> = vec![
            "bishop",
            "spencer",
            "morgenstern_price",
            "janbu_simplified",
            "janbu_corrected",
        ];
        let opts = super::Options {
            path: file.to_string_lossy().into_owned(),
            reps: 1,
            methods: methods.clone(),
        };
        let out = super::execute(&opts);
        std::fs::remove_dir_all(&dir).ok();
        let records: serde_json::Value =
            serde_json::from_str(&out.expect("bench of a v0.4 case")).unwrap();
        for (record, method) in records.as_array().unwrap().iter().zip(methods) {
            assert_eq!(record["method"], method);
            assert!(record["fos"].as_f64().is_some(), "{method}: {record}");
        }
    }

    #[test]
    fn bench_version_is_the_greater_of_the_declared_and_the_needed() {
        use super::bench_version;
        // v0.1 and v0.2 rise to 0.3 for the v0.3 methods; the others stay as they are.
        assert_eq!(bench_version("0.1", "janbu_corrected"), "0.3");
        assert_eq!(bench_version("0.2", "morgenstern_price"), "0.3");
        assert_eq!(bench_version("0.2", "bishop"), "0.2");
        // 0.3 and 0.4 never go down.
        assert_eq!(bench_version("0.3", "janbu_simplified"), "0.3");
        assert_eq!(bench_version("0.4", "janbu_simplified"), "0.4");
        assert_eq!(bench_version("0.4", "bishop"), "0.4");
        // What is not a version is left for the engine to refuse.
        assert_eq!(bench_version("9.9", "janbu_corrected"), "9.9");
        assert_eq!(bench_version("", "morgenstern_price"), "");
    }

    #[test]
    fn method_names_include_the_v03_methods() {
        for name in ["morgenstern_price", "janbu_simplified", "janbu_corrected"] {
            let opts = parse(&["caso.json", "--method", name]).expect(name);
            assert_eq!(opts.methods, vec![name]);
        }
        let all = parse(&["caso.json"]).unwrap();
        assert_eq!(
            all.methods,
            vec![
                "bishop",
                "spencer",
                "morgenstern_price",
                "janbu_simplified",
                "janbu_corrected"
            ],
            "all runs the five methods"
        );
        assert!(parse(&["caso.json", "--method", "janbu"]).is_err());
    }
}
