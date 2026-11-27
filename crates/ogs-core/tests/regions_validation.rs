//! Region validation (contract F1.3, amendment E12c): self-intersection, overlap between regions and the
//! order of the piezometric line. Closes the gap between contract §1 ("simple polygons that do not overlap")
//! and the implementation. Tests use only the public API.

use std::fs;
use std::path::PathBuf;

use ogs_core::geometry::PreparedModel;
use ogs_core::model::Model;
use ogs_core::{OgsError, analyze, analyze_json};
use serde_json::{Value, json};

fn material(id: &str) -> Value {
    json!({
        "id": id, "name": id, "model": "mohr_coulomb",
        "unit_weight": 18.0, "cohesion": 10.0, "friction_angle": 30.0
    })
}

/// A model with the given regions (all of material `soil`, or `(material, polygon)` pairs through
/// `model_with`) and the explicit sliding direction, so that no region check depends on `auto`.
fn doc_with(regions: Vec<Value>) -> Value {
    json!({
        "format": "opengeoslide", "version": "0.1", "meta": {"id": "E12c"}, "units": "SI",
        "materials": [material("soil"), material("rock")],
        "regions": regions,
        "slope": {"direction": "left_to_right"},
        "analysis": {
            "methods": ["bishop"], "slices": 50, "tolerance": 1e-5,
            "max_iterations": 500, "min_m_alpha": 0.2,
            "surface": {"type": "circle", "xc": 6.0, "yc": 13.0, "r": 7.5}
        }
    })
}

fn region(material: &str, polygon: Value) -> Value {
    json!({"material": material, "polygon": polygon})
}

fn prepare(doc: &Value) -> Result<PreparedModel, OgsError> {
    let model: Model = serde_json::from_value(doc.clone()).expect("the test document deserializes");
    PreparedModel::new(&model)
}

/// The error text of `PreparedModel::new` (`InvalidModel: ...`), failing if the model is accepted.
fn rejected(doc: &Value) -> String {
    match prepare(doc) {
        Ok(_) => panic!("the model must be rejected: {doc}"),
        Err(e) => e.to_string(),
    }
}

fn accepted(doc: &Value) {
    if let Err(e) = prepare(doc) {
        panic!("the model must be accepted, got {e}: {doc}");
    }
}

fn square(x: f64, y: f64, side: f64) -> Value {
    json!([[x, y], [x, y + side], [x + side, y + side], [x + side, y]])
}

// ---------------------------------------------------------------- self-intersection

#[test]
fn figure_eight_loop_is_a_self_intersection() {
    // The bow tie (0,0) (2,2) (2,0) (0,2): edges 0 and 2 cross at (1,1).
    let doc = doc_with(vec![region(
        "soil",
        json!([[0, 0], [2, 2], [2, 0], [0, 2]]),
    )]);
    assert_eq!(
        rejected(&doc),
        "InvalidModel: la región 0 se auto-intersecta (aristas 0 y 2)"
    );
}

#[test]
fn figure_eight_in_a_second_region_reports_that_region() {
    let doc = doc_with(vec![
        region("soil", square(0.0, 0.0, 4.0)),
        region("rock", json!([[4, 0], [8, 4], [8, 0], [4, 4]])),
    ]);
    assert!(rejected(&doc).starts_with("InvalidModel: la región 1 se auto-intersecta"));
}

#[test]
fn spike_is_a_self_intersection() {
    // The square (0,0) (4,0) (4,4) (0,4) with a spike up the left side: (0,4) -> (0,6) -> (0,0) doubles
    // back over (0,4) -> (0,6), so edges 3 and 4 overlap on a collinear stretch (and edge 4 passes through
    // the vertex (0,4), where it touches edge 2; the first pair found is reported).
    let doc = doc_with(vec![region(
        "soil",
        json!([[0, 0], [4, 0], [4, 4], [0, 4], [0, 6]]),
    )]);
    assert_eq!(
        rejected(&doc),
        "InvalidModel: la región 0 se auto-intersecta (aristas 2 y 4)"
    );
}

#[test]
fn spike_in_the_middle_of_a_side_is_a_self_intersection() {
    // Out to (6,0) and back to (4,0) along the bottom, in the middle of the vertex list.
    let doc = doc_with(vec![region(
        "soil",
        json!([[0, 0], [6, 0], [4, 0], [4, 4], [0, 4]]),
    )]);
    assert!(rejected(&doc).contains("se auto-intersecta (aristas 0 y 1)"));
}

#[test]
fn non_adjacent_edges_that_touch_are_a_self_intersection() {
    // The vertex (2,2) appears twice: edges 1 and 4 touch there (a pinched polygon).
    let doc = doc_with(vec![region(
        "soil",
        json!([[0, 0], [4, 0], [2, 2], [4, 4], [0, 4], [2, 2]]),
    )]);
    assert!(rejected(&doc).contains("se auto-intersecta"));
}

#[test]
fn a_vertex_touching_a_non_adjacent_edge_is_a_self_intersection() {
    // The last vertex (3,2) lies on edge 2, (4,2) -> (2,2): edges 2 and 6 overlap on a collinear stretch.
    let doc = doc_with(vec![region(
        "soil",
        json!([
            [0, 0],
            [4, 0],
            [4, 2],
            [2, 2],
            [2, 4],
            [0, 4],
            [0, 2],
            [3, 2]
        ]),
    )]);
    assert!(rejected(&doc).contains("se auto-intersecta"));
}

#[test]
fn a_concave_polygon_is_valid() {
    // An L and a staircase profile with collinear vertices are simple polygons.
    accepted(&doc_with(vec![region(
        "soil",
        json!([[0, 0], [10, 0], [10, 4], [6, 4], [6, 8], [0, 8]]),
    )]));
    accepted(&doc_with(vec![region(
        "soil",
        json!([
            [0, 0],
            [10, 0],
            [10, 4],
            [8, 4],
            [6, 4],
            [6, 6],
            [4, 6],
            [4, 8],
            [0, 8],
            [0, 4]
        ]),
    )]));
}

#[test]
fn a_repeated_consecutive_vertex_is_not_a_self_intersection() {
    // A zero-length edge is not a geometric feature (the model was valid before E12c).
    accepted(&doc_with(vec![region(
        "soil",
        json!([[0, 0], [10, 0], [10, 0], [10, 6], [0, 6]]),
    )]));
}

// ---------------------------------------------------------------- overlap between regions

#[test]
fn two_overlapping_squares_are_rejected() {
    let doc = doc_with(vec![
        region("soil", square(0.0, 0.0, 6.0)),
        region("rock", square(3.0, 3.0, 6.0)),
    ]);
    assert_eq!(
        rejected(&doc),
        "InvalidModel: las regiones 0 y 1 se solapan"
    );
}

#[test]
fn a_square_inside_another_is_rejected() {
    let doc = doc_with(vec![
        region("soil", square(0.0, 0.0, 10.0)),
        region("rock", square(3.0, 3.0, 2.0)),
    ]);
    assert_eq!(
        rejected(&doc),
        "InvalidModel: las regiones 0 y 1 se solapan"
    );
    // Also with the inner region first: the indices stay in model order.
    let doc = doc_with(vec![
        region("rock", square(3.0, 3.0, 2.0)),
        region("soil", square(0.0, 0.0, 10.0)),
    ]);
    assert_eq!(
        rejected(&doc),
        "InvalidModel: las regiones 0 y 1 se solapan"
    );
}

#[test]
fn identical_polygons_in_reverse_order_are_rejected() {
    let doc = doc_with(vec![
        region("soil", json!([[0, 0], [0, 5], [8, 5], [8, 0]])),
        region("rock", json!([[8, 0], [8, 5], [0, 5], [0, 0]])),
    ]);
    assert_eq!(
        rejected(&doc),
        "InvalidModel: las regiones 0 y 1 se solapan"
    );
}

#[test]
fn identical_polygons_with_another_start_or_extra_collinear_vertices_are_rejected() {
    let doc = doc_with(vec![
        region("soil", json!([[0, 0], [0, 5], [8, 5], [8, 0]])),
        region("rock", json!([[8, 5], [8, 0], [0, 0], [0, 5]])),
    ]);
    assert_eq!(
        rejected(&doc),
        "InvalidModel: las regiones 0 y 1 se solapan"
    );
    let doc = doc_with(vec![
        region("soil", json!([[0, 0], [0, 5], [8, 5], [8, 0]])),
        region(
            "rock",
            json!([[0, 0], [0, 5], [4, 5], [8, 5], [8, 0], [3, 0]]),
        ),
    ]);
    assert_eq!(
        rejected(&doc),
        "InvalidModel: las regiones 0 y 1 se solapan"
    );
}

#[test]
fn a_proper_edge_crossing_without_vertices_inside_is_rejected() {
    // A cross: a horizontal and a vertical bar. No vertex of one is inside the other, but their edges cross.
    let doc = doc_with(vec![
        region("soil", json!([[0, 4], [0, 6], [10, 6], [10, 4]])),
        region("rock", json!([[4, 0], [4, 10], [6, 10], [6, 0]])),
    ]);
    assert_eq!(
        rejected(&doc),
        "InvalidModel: las regiones 0 y 1 se solapan"
    );
}

#[test]
fn a_diagonal_across_a_shared_square_is_rejected() {
    // Beyond the contract's list: the triangle is half of the square. All its vertices lie on the square's
    // boundary and no edges cross, yet the regions overlap.
    let doc = doc_with(vec![
        region("soil", square(0.0, 0.0, 6.0)),
        region("rock", json!([[0, 0], [6, 6], [6, 0]])),
    ]);
    assert_eq!(
        rejected(&doc),
        "InvalidModel: las regiones 0 y 1 se solapan"
    );
}

#[test]
fn the_first_overlapping_pair_is_reported_with_model_indices() {
    let doc = doc_with(vec![
        region("soil", square(0.0, 0.0, 4.0)),
        region("rock", square(4.0, 0.0, 4.0)),
        region("soil", square(6.0, 1.0, 4.0)),
    ]);
    assert_eq!(
        rejected(&doc),
        "InvalidModel: las regiones 1 y 2 se solapan"
    );
}

#[test]
fn a_shared_edge_is_valid() {
    // Two layers stacked on the whole width and side by side blocks.
    accepted(&doc_with(vec![
        region("soil", json!([[0, 4], [0, 8], [10, 8], [10, 4]])),
        region("rock", json!([[0, 0], [0, 4], [10, 4], [10, 0]])),
    ]));
    accepted(&doc_with(vec![
        region("soil", square(0.0, 0.0, 4.0)),
        region("rock", square(4.0, 0.0, 4.0)),
    ]));
}

#[test]
fn a_shared_collinear_stretch_is_valid() {
    // The upper region rests on part of the lower one's top edge, whose vertices do not match.
    accepted(&doc_with(vec![
        region("rock", json!([[0, 0], [0, 4], [10, 4], [10, 0]])),
        region("soil", json!([[2, 4], [2, 8], [7, 8], [7, 4]])),
    ]));
}

#[test]
fn a_t_junction_is_valid() {
    // Two blocks over a base: the vertex (5,4), shared by the blocks, lies in the middle of the base's top edge.
    let doc = doc_with(vec![
        region("rock", json!([[0, 0], [0, 4], [10, 4], [10, 0]])),
        region("soil", json!([[0, 4], [0, 8], [5, 8], [5, 4]])),
        region("soil", json!([[5, 4], [5, 8], [10, 6], [10, 4]])),
    ]);
    accepted(&doc);
    // And the model can be analyzed end to end.
    let model: Model = serde_json::from_value(doc).unwrap();
    analyze(&model).expect("a model with a T junction is analyzed");
}

#[test]
fn regions_touching_at_one_vertex_are_valid() {
    accepted(&doc_with(vec![
        region("soil", square(0.0, 0.0, 4.0)),
        region("rock", square(4.0, 4.0, 4.0)),
    ]));
}

#[test]
fn a_concave_region_with_another_in_its_notch_is_valid() {
    // The block fills the notch of the L exactly.
    accepted(&doc_with(vec![
        region(
            "soil",
            json!([[0, 0], [10, 0], [10, 4], [6, 4], [6, 8], [0, 8]]),
        ),
        region("rock", json!([[6, 4], [10, 4], [10, 8], [6, 8]])),
    ]));
}

#[test]
fn the_overlap_tolerance_is_1e_9_of_the_model_scale() {
    // A vertex a hair inside the neighbour (1e-11 of the scale of 10) is within the tolerance; 1e-3 is not.
    let tiny = 1e-11;
    accepted(&doc_with(vec![
        region("soil", json!([[0, 0], [0, 4], [4, 4], [4, 0]])),
        region(
            "rock",
            json!([[4.0 - tiny, 1.0], [4.0 - tiny, 3.0], [10, 3], [10, 1]]),
        ),
    ]));
    let doc = doc_with(vec![
        region("soil", json!([[0, 0], [0, 4], [4, 4], [4, 0]])),
        region(
            "rock",
            json!([[3.999, 1.0], [3.999, 3.0], [10, 3], [10, 1]]),
        ),
    ]);
    assert_eq!(
        rejected(&doc),
        "InvalidModel: las regiones 0 y 1 se solapan"
    );
}

#[test]
fn the_checks_do_not_depend_on_scale_or_origin() {
    // The same configurations at 1e-3, 1e6 and far from the origin.
    for (k, dx, dy) in [
        (1e-3, 0.0, 0.0),
        (1e6, 0.0, 0.0),
        (1.0, 1e5, -3e4),
        (1e3, 1e7, 1e7),
    ] {
        let sq = |x: f64, y: f64, s: f64| {
            let (x, y, s) = (x * k + dx, y * k + dy, s * k);
            json!([[x, y], [x, y + s], [x + s, y + s], [x + s, y]])
        };
        let mut doc = doc_with(vec![
            region("soil", sq(0.0, 0.0, 4.0)),
            region("rock", sq(4.0, 0.0, 4.0)),
        ]);
        doc["analysis"]["surface"] =
            json!({"type": "circle", "xc": dx, "yc": dy + 20.0 * k, "r": 5.0 * k});
        accepted(&doc);
        let mut doc = doc_with(vec![
            region("soil", sq(0.0, 0.0, 6.0)),
            region("rock", sq(3.0, 3.0, 6.0)),
        ]);
        doc["analysis"]["surface"] =
            json!({"type": "circle", "xc": dx, "yc": dy + 20.0 * k, "r": 5.0 * k});
        assert_eq!(
            rejected(&doc),
            "InvalidModel: las regiones 0 y 1 se solapan",
            "k={k}"
        );
        let mut doc = doc_with(vec![region(
            "soil",
            json!([
                [dx, dy],
                [dx + 2.0 * k, dy + 2.0 * k],
                [dx + 2.0 * k, dy],
                [dx, dy + 2.0 * k]
            ]),
        )]);
        doc["analysis"]["surface"] =
            json!({"type": "circle", "xc": dx, "yc": dy + 20.0 * k, "r": 5.0 * k});
        assert!(rejected(&doc).contains("se auto-intersecta"), "k={k}");
    }
}

// ---------------------------------------------------------------- piezometric line

fn piezo_doc(line: Value) -> Value {
    let mut doc = doc_with(vec![region(
        "soil",
        json!([[0, 0], [0, 6], [20, 6], [20, 0]]),
    )]);
    doc["water"] = json!({"unit_weight": 9.81, "piezometric_line": line});
    doc
}

#[test]
fn unordered_piezometric_line_is_rejected() {
    let msg = "InvalidModel: la piezométrica debe tener x estrictamente creciente";
    assert_eq!(rejected(&piezo_doc(json!([[0, 4], [15, 3], [10, 3]]))), msg);
    // Repeated x (a vertical step) and a reversed line.
    assert_eq!(rejected(&piezo_doc(json!([[0, 4], [10, 3], [10, 2]]))), msg);
    assert_eq!(rejected(&piezo_doc(json!([[20, 4], [0, 3]]))), msg);
    // The same through the public JSON entry point.
    let out = analyze_json(&piezo_doc(json!([[0, 4], [15, 3], [10, 3]])).to_string());
    assert_eq!(out.unwrap_err(), msg);
}

#[test]
fn increasing_piezometric_line_is_valid() {
    accepted(&piezo_doc(json!([[0, 4], [10, 3], [20, 3]])));
}

// ---------------------------------------------------------------- neutrality

fn repo_path(rel: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(rel)
}

fn json_files(dir: &str, suffix: &str) -> Vec<PathBuf> {
    let mut files: Vec<PathBuf> = fs::read_dir(repo_path(dir))
        .unwrap_or_else(|e| panic!("cannot read {dir}: {e}"))
        .map(|e| e.expect("directory entry").path())
        .filter(|p| p.to_string_lossy().ends_with(suffix))
        .collect();
    files.sort();
    files
}

/// Loads a model from a verification case (`model` member) or from a bare `.ogs.json`.
fn load_model(path: &PathBuf) -> Model {
    let text = fs::read_to_string(path).unwrap_or_else(|e| panic!("cannot read {path:?}: {e}"));
    let doc: Value = serde_json::from_str(&text).unwrap_or_else(|e| panic!("{path:?}: {e}"));
    let model = doc.get("model").cloned().unwrap_or(doc);
    serde_json::from_value(model).unwrap_or_else(|e| panic!("{path:?} is not a model: {e}"))
}

fn assert_all_valid(files: &[PathBuf]) {
    for file in files {
        let model = load_model(file);
        if let Err(e) = PreparedModel::new(&model) {
            panic!("{file:?} was valid before E12c and is now rejected: {e}");
        }
    }
}

/// Number of cases the index declares ("Casos convertidos e incluidos: **N**").
fn included_cases_in_index() -> usize {
    let text = fs::read_to_string(repo_path("verification/cases/INDEX.md"))
        .unwrap_or_else(|e| panic!("cannot read verification/cases/INDEX.md: {e}"));
    let tail = text
        .split("Casos convertidos e incluidos: **")
        .nth(1)
        .expect("INDEX.md states the number of included cases");
    let digits: String = tail.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits
        .parse()
        .expect("the number of included cases is an integer")
}

#[test]
fn every_verification_case_stays_valid() {
    let files: Vec<PathBuf> = json_files("verification/cases", ".json")
        .into_iter()
        .filter(|p| {
            p.file_name().is_some_and(|n| {
                n.to_string_lossy()
                    .starts_with(|c: char| c.is_ascii_uppercase())
            })
        })
        .collect();
    // The index is the source of truth; it lists at least the 21 cases of v0.1 and v0.2.
    let expected = included_cases_in_index();
    assert!(expected >= 21, "INDEX.md declares only {expected} cases");
    assert_eq!(
        files.len(),
        expected,
        "verification/cases and INDEX.md disagree: {files:?}"
    );
    assert_all_valid(&files);
}

#[test]
fn every_differential_model_stays_valid() {
    let files = json_files("verification/differential/cases", ".ogs.json");
    assert!(
        files.len() >= 14,
        "verification/differential/cases has fewer than the 14 models of D01-D14: {files:?}"
    );
    assert_all_valid(&files);
}

#[test]
fn the_example_and_the_harness_fixture_stay_valid() {
    assert_all_valid(&[
        repo_path("examples/acads1a.ogs.json"),
        repo_path("verification/harness/fixtures/V047a.json"),
    ]);
}

// ------------------------------------------------------------ E12j: empty material id (R5-10)

/// E12j: `material.id == ""` is rejected with `InvalidModel`, wherever the material sits in the list and through the
/// public entry points too. The error names the material by its position.
#[test]
fn an_empty_material_id_is_rejected() {
    let mut doc = doc_with(vec![region("soil", square(0.0, 0.0, 10.0))]);
    accepted(&doc);
    doc["materials"][0]["id"] = json!("");
    doc["regions"][0]["material"] = json!("");
    assert_eq!(
        rejected(&doc),
        "InvalidModel: el id del material 0 está vacío: debe tener al menos un carácter"
    );
    // The same through `analyze` and `analyze_json` (the path of the CLI, wasm and python).
    let model: Model = serde_json::from_value(doc.clone()).unwrap();
    match analyze(&model) {
        Err(OgsError::InvalidModel(msg)) => assert!(msg.contains("vacío"), "{msg}"),
        other => panic!("analyze must reject an empty material id: {other:?}"),
    }
    match analyze_json(&doc.to_string()) {
        Err(msg) => assert!(
            msg.contains("InvalidModel") && msg.contains("vacío"),
            "{msg}"
        ),
        other => panic!("analyze_json must reject an empty material id: {other:?}"),
    }
    // Second material: it is the position 1 that is reported, and the first one is still fine.
    let mut doc = doc_with(vec![region("soil", square(0.0, 0.0, 10.0))]);
    doc["materials"][1]["id"] = json!("");
    assert_eq!(
        rejected(&doc),
        "InvalidModel: el id del material 1 está vacío: debe tener al menos un carácter"
    );
    // A one-character id (or a blank-looking one that is not empty) stays valid.
    doc["materials"][1]["id"] = json!(" ");
    accepted(&doc);
}
