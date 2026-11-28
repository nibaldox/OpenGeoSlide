//! `ogs` command-line front end for ogs-core.

mod bench;

use std::env;
use std::fs;
use std::process::ExitCode;

const USAGE: &str = "uso: ogs --version | ogs analyze <archivo.ogs.json> | \
ogs bench <caso.json> [--reps N] \
[--method bishop|spencer|morgenstern_price|janbu_simplified|janbu_corrected|all] (all = los cinco métodos)\n\
el modelo es un .ogs.json v0.1 a v0.6 y v0.7; analysis.search.non_circular.global pide \"version\": \"0.7\" \
(algorithm, generated, seed, polish); con refuerzos (anchor, nail, geosynthetic, pile y sheet_pile) pide \"version\": \"0.4\" \
y cada método del informe trae reinforcement_forces; \
con analysis.tension_crack (grieta de tracción: depth, un número o \"auto\", y water_fill de 0 a 1), con lateral_pressure \
(presión de suelo de Ito-Matsui en un pile, en lugar de force; agrega soil_force, governs y arm a cada cruce) o con capacity \
(topes shear y moment de ese pilote) pide \"version\": \"0.5\" y, con grieta, el informe trae tension_crack; \
con un material model \"hoek_brown\" (ucs, gsi, mi, disturbance), model \"shansep\" (objeto shansep con ratio, exponent y \
exactamente una de ocr, pop u ocr_by_elevation) o con analysis.search.non_circular (seeds y max_vertices, no admite bishop) \
pide \"version\": \"0.6\"; con hoek_brown o shansep, cada método del informe trae strength: con Hoek-Brown, passes (pasadas del lazo) y, por dovela \
de roca, normal_stress; con SHANSEP, vertical_stress y ocr por dovela; con non_circular, search.non_circular trae seeds, \
evaluated, seed_fos y polyline_fos (ogs bench --method all omite bishop con non_circular); \
una piezométrica sobre el terreno suma el agua embalsada en todas las versiones (cambia el FS frente a la v0.3.0); \
con un pile o una sheet_pile con force se calcula solo la estabilidad global, con el elemento como una fuerza dada, y el pilote \
de Ito-Matsui estima la fuerza del suelo entre pilotes rígidos pero no es el diseño del pilote \
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

#[cfg(test)]
mod tests {
    use super::USAGE;

    /// E15l-25 (B-12a): the help lists what the v0.5 format adds and drops the note from before Ito-Matsui.
    #[test]
    fn usage_lists_the_v05_fields_and_the_structural_limit() {
        for field in [
            "tension_crack",
            "lateral_pressure",
            "capacity",
            "soil_force",
            "\"0.5\"",
        ] {
            assert!(USAGE.contains(field), "USAGE does not mention {field}");
        }
        assert!(
            !USAGE.contains("solo se calcula la estabilidad global"),
            "USAGE keeps the note from before Ito-Matsui: {USAGE}"
        );
    }

    /// F6.1: the help names the v0.6 fields (Hoek-Brown, SHANSEP and the non-circular search).
    #[test]
    fn usage_lists_the_v06_fields() {
        for field in [
            "v0.1 a v0.6",
            "hoek_brown",
            "ucs",
            "gsi",
            "mi",
            "disturbance",
            "shansep",
            "ocr_by_elevation",
            "non_circular",
            "max_vertices",
            "\"0.6\"",
            "strength",
            "passes",
            "normal_stress",
            "vertical_stress",
            "ocr",
            "seed_fos",
            "polyline_fos",
            "search.non_circular",
        ] {
            assert!(USAGE.contains(field), "USAGE does not mention {field}");
        }
    }
}
