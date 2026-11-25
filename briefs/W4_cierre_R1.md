# Brief W4: cierre de la integración R1 (avisos, errores, UI, reportes)

**Lee primero:** `briefs/00_CONTRATOS.md`, en especial **E5** (§4.3) y **E6** (§4.5). Responde en español.

## Contexto
En `main@HEAD` las correcciones R1 están integradas, pero la aceptación da **27/38 fallos**: el aviso informativo
`negative_effective_normal` (de W3a) choca con la aceptación estricta (de W3b). Los FS están todos dentro de tolerancia.
Además, los mensajes de `OgsError` están en inglés y la web busca prefijos que no coinciden.

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/w4` (rama `w4-cierre`).

## Archivos que te pertenecen
- `crates/ogs-core/tests/acceptance.rs` y `crates/ogs-core/tests/validation.rs` (solo para adaptar los textos de
  error esperados)
- `crates/ogs-core/src/lib.rs`: **solo** los textos de `OgsError` (`#[error(...)]`) y los códigos de aviso de agua
- `crates/ogs-core/src/methods/{bishop.rs,spencer.rs}`: **solo** el texto `"max_iterations reached"` → código `"max_iterations"`
- `crates/ogs-py/**` (si los tests de mensajes cambian)
- `apps/web/src/**`
- `verification/REPORT.md`, `verification/report.json`, `bench/RESULTS.md`, `bench/results/*.json` (regenerados)

**No toques** la matemática, las tolerancias ni los casos.

## Tareas
1. **E5:** en `acceptance.rs`, `const INFORMATIVE_WARNINGS: &[&str] = &["negative_effective_normal"];`.
   Cualquier otro aviso sigue haciendo fallar el check. Imprime en la tabla una columna `avisos` con los códigos.
2. **E6:**
   - `Display` de `OgsError` = `"<Código>: <mensaje en español>"`;
   - el aviso de agua pasa a ser el código `water_above_ground`;
   - `"max_iterations reached"` pasa a `max_iterations`;
   - ajusta los tests que comparan textos. Busca en todo el repo (`rg -n "no surface defined|no valid surface|invalid model|max_iterations reached|piezometric line above"`)
     y actualiza **todos** los usos, incluidos `apps/web`, el harness (solo lectura de mensajes) y ogs-py.
3. **Web:**
   - `errors.ts` clasifica por el prefijo de código y muestra el mensaje en español;
   - nuevo `src/engine/warnings.ts`: mapa código → texto en español (sin voseo) con severidad `nota | aviso`.
     `negative_effective_normal` es una **nota**: "Normal efectiva negativa en algunas dovelas (zona de tracción;
     considere una grieta de tracción)". El resto son avisos;
   - `ResultsTable` muestra las notas con estilo neutro y los avisos destacados;
   - la columna FS muestra "—" cuando `fos` es `null`;
   - tests Vitest para `warnings.ts` y `errors.ts`.
4. **Regenera los reportes:**
   ```
   cargo build --release -p ogs-cli
   uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely python verification/harness/run.py --cases verification/cases --ogs target/release/ogs --out verification
   bench/run_all.sh
   ```
   El bench usa el puerto 5181; al terminar, verifica con `ss -ltn` que no quede nada escuchando en 5181.
   **No toques el puerto 5180**: hay una demo del coordinador corriendo ahí.

## Gates (salida real)
- `cargo fmt --all --check` y `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`
- `cargo test -p ogs-core --release` (todo, con aceptación **38/38**) y `cargo test -p ogs-core --features parallel`
- ogs-py:
  ```
  cd crates/ogs-py && uv run --python 3.13 --no-project --with maturin maturin build --release --out $TMPDIR/w4-dist
  ```
  luego un venv nuevo con `uv venv -p 3.13 $TMPDIR/w4-venv`, `pip install` del wheel y `pytest crates/ogs-py/tests`
- `apps/web`: `pnpm test` y `pnpm build`
- El harness da ogs 38 OK y cSlope 38/38; `bench/run_all.sh` sale con exit 0 y el gate de FS cumple

## Cierre
- Commits pequeños en tu rama con rutas explícitas. Sin push.
- **Resumen:** gates, totales del harness, tabla del bench y hashes.
- **Presupuesto:** ~50 iteraciones.
