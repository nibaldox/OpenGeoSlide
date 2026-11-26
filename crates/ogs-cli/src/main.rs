//! `ogs` command-line front end for ogs-core.

mod bench;

use std::env;
use std::fs;
use std::process::ExitCode;

const USAGE: &str = "uso: ogs --version | ogs analyze <archivo.ogs.json> | \
ogs bench <caso.json> [--reps N] \
[--method bishop|spencer|morgenstern_price|janbu_simplified|janbu_corrected|all] (all = los cinco métodos)\n\
el modelo es un .ogs.json v0.1 a v0.4; con refuerzos (anchor, nail, geosynthetic, pile y sheet_pile) pide \"version\": \"0.4\" \
y cada método del informe trae reinforcement_forces; con pilotes o tablestacas solo se calcula la estabilidad global \
(formato y limitaciones: docs/formato-ogs-json.md y docs/limitaciones.md)";

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    match args.as_slice() {
        ["--version"] | ["-V"] => {
            println!("ogs {}", ogs_core::VERSION);
            ExitCode::SUCCESS
        }
        ["analyze", path] => run_analyze(path),
        ["bench", rest @ ..] => bench::run(rest),
        _ => {
            eprintln!("{USAGE}");
            ExitCode::from(2)
        }
    }
}

fn run_analyze(path: &str) -> ExitCode {
    let input = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(err) => {
            eprintln!("ogs: no se puede leer {path}: {err}");
            return ExitCode::from(2);
        }
    };
    match ogs_core::analyze_json(&input) {
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
