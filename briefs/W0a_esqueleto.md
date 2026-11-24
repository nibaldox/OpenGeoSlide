# Brief W0a: esqueleto del workspace y contratos en código

**Lee primero:** `briefs/00_CONTRATOS.md` (normativo). Responde en español.

## Objetivo
Crear el workspace Rust con los tipos y las firmas congeladas de `ogs-core`, las funciones de cálculo como *stubs*
(`todo!()`), la orquestación `analyze` completa, una CLI y un wrapper wasm mínimos, el JSON Schema v0.1 y el test de
aceptación en **RED**.

## Directorio de trabajo
Worktree `/home/xodla/archivos/opengeoslide-wt/w0a` (rama `w0a-esqueleto`), ya creado. Trabaja **solo** ahí.
Usa `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.

## Archivos que te pertenecen (crear)
- `Cargo.toml` (workspace, resolver 3, edition 2024; `members = ["crates/ogs-core", "crates/ogs-cli", "crates/ogs-wasm"]`;
  `default-members = ["crates/ogs-core", "crates/ogs-cli"]`; perfil release con `lto = "thin"`, `codegen-units = 1`).
- `crates/ogs-core/Cargo.toml`: serde (derive), serde_json, thiserror 2, rayon opcional (`features.parallel = ["dep:rayon"]`).
- `crates/ogs-core/src/lib.rs`, `model.rs`, `geometry.rs`, `slicer.rs`, `methods/mod.rs`, `methods/bishop.rs`,
  `methods/spencer.rs`, `search.rs`, `report.rs`.
- `crates/ogs-core/tests/acceptance.rs`.
- `crates/ogs-cli/` (binario `ogs`): `ogs analyze <archivo.ogs.json>` imprime `analyze_json` y sale con código 0, o
  escribe el error en stderr y sale con 2; `ogs --version` imprime la versión. Solo std, sin clap.
- `crates/ogs-wasm/`: `crate-type = ["cdylib", "rlib"]`, `wasm-bindgen = "=0.2.130"` (debe coincidir con el CLI instalado).
  Exporta `analyze_json(input: &str) -> Result<String, JsValue>` y `version() -> String`.
- `schema/ogs-0.1.schema.json`: JSON Schema draft 2020-12 fiel a §1 del contrato, con `required` mínimos:
  `format`, `version`, `materials`, `regions`, `analysis`.
- `examples/acads1a.ogs.json`: ACADS 1(a), geometría `(20,20)-(20,25)-(30,25)-(50,35)-(70,35)-(70,20)`, c = 3, φ = 19.6,
  γ = 20, seco, búsqueda por defecto, métodos bishop y spencer.
- `LICENSE` (texto completo de Apache-2.0) y `README.md` (español, breve: qué es, estado "Fase 0 / spike", cómo compilar y probar).

**No toques:** `verification/**`, `NOTICE`, `briefs/**`, `docs/**`, `.gitignore`.

## Qué implementar de verdad y qué dejar en stub
- **Implementar completo:**
  - `model.rs`: tipos serde, con defaults exactamente como en §1.
  - `report.rs`.
  - `lib.rs`: `OgsError`, `VERSION`, `analyze`, `analyze_json`.
  - Los tipos de `geometry.rs`, `slicer.rs`, `methods/mod.rs` y `search.rs` (structs, enums, trait `Ground`).
  - La CLI y el wasm.
- **Dejar en stub `todo!("W1x")`** (cuerpo mínimo, sin warnings; prefija con `_` los argumentos no usados):
  - `PreparedModel::new`, `PreparedModel::piezometric_y` e `impl Ground for PreparedModel` → `"W1a"`;
  - `slice_circle` → `"W1a"`;
  - `solve` → `"W1b"`;
  - `search_circular` → `"W1c"`.
- **Orquestación de `analyze`**, por cada método de `analysis.methods`:
  1. Con `search`: llama `search_circular(&pm, spec, |c| …)`. El evaluador hace `slice_circle` y luego `solve`,
     y devuelve `Some(fos)` solo si el estado es `Converged` y el FS es finito y positivo.
     Si no queda ninguna superficie válida → `OgsError::NoValidSurface`.
  2. Sin `search` pero con `surface`: usa esa superficie. Si `slice_circle` falla → `NoValidSurface`.
  3. Sin ninguna de las dos → `NoSurface`.
  4. Recalcula las dovelas y la solución de la superficie elegida y llena `MethodReport`.
     Añade un warning si `piezometric_y(x_mid) > y_top_mid` en alguna dovela (agua sobre el terreno ignorada en v0.1).
- `SolveOptions` se construye desde `analysis` (`tolerance`, `max_iterations`, `min_m_alpha`).

## Test de aceptación `crates/ogs-core/tests/acceptance.rs`
- Lee `../../verification/cases/*.json` relativo a `CARGO_MANIFEST_DIR` (formato de §2; define el struct del caso dentro del test).
- **Por cada check:**
  1. Clona el modelo y fija `analysis.methods = [check.method]`.
  2. Con `kind = fixed`, pone `search = None` (y exige que exista `surface`); con `kind = search`, exige que exista `search`.
  3. Aplica `options.slices` si viene.
  4. Ejecuta `analyze`.
  5. Exige estado `Converged` y calcula el error relativo.
- Imprime una tabla (`id | método | tipo | publicado | ogs | err% | tol% | OK/FAIL`) con `println!`.
  Así se ve con `-- --nocapture`.
- **Falla si:** no hay casos (mensaje explícito, nunca éxito vacío), algún check queda fuera de tolerancia o algún
  análisis devuelve error.
- Un panic dentro de un check (por ejemplo, un `todo!`) también hace fallar el test. Es lo esperado mientras haya stubs.

## Tests unitarios mínimos (en `model.rs`)
- Un modelo mínimo deserializa con todos los defaults de §1.
- El ida y vuelta serde de `examples/acads1a.ogs.json` conserva los valores.

## Gates (ejecútalos y reporta salida y código de salida reales)
1. `cargo fmt --all --check`
2. `cargo clippy --workspace --all-targets -- -D warnings`
3. `cargo test -p ogs-core --lib` → verde
4. `cargo test -p ogs-core --test acceptance` → **debe fallar** porque aún no hay casos o por los stubs. Copia el mensaje.
5. `cargo build -p ogs-wasm --target wasm32-unknown-unknown --release` → verde
6. `cargo run -p ogs-cli -- --version` → imprime la versión

## Cierre
- Haz commit en tu rama `w0a-esqueleto` con `git add` de rutas explícitas (nunca `git add .`) y el mensaje
  `chore: esqueleto del workspace y contratos v0.1`. **No hagas push**.
- **Resumen final:** archivos creados, salida de los gates, hash del commit y cualquier contrato que te haya parecido incorrecto.
- **Presupuesto:** ~40 iteraciones. Si te acercas al límite, haz commit de lo que compile y reporta exactamente qué falta.
