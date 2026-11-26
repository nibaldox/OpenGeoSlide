# Brief F3G-G0: congelar tipos, esquema 0.5, stubs y tests RED

Responde en **español neutro, sin voseo**.

**Normativo:** `briefs/04_CONTRATOS_GRIETA_AGUA.md`, todo el archivo. Lo vigente de los contratos 00 a 03 se mantiene.

**Worktree y rama:** `/home/xodla/archivos/opengeoslide-wt/f3g0`, rama `f3g0-tipos`, con base en `f3g-integracion`.

**Ejemplo de una ola equivalente:** `briefs/F3R_R0.md`, con los tipos de refuerzos y `crates/ogs-core/tests/f3r_types.rs`.

## Archivos tuyos

**Motor:**
- `crates/ogs-core/src/model.rs`: `TensionCrack`, `CrackDepth` (enum sin etiqueta `Fixed(f64)`/`Auto`, con `"auto"`
  como cadena), la versión `"0.5"` y lo que E15h decida para `Slice`;
- `crates/ogs-core/src/loads.rs`: solo `first_v05_field` y la validación de `analysis.tension_crack`;
- el tipo del resultado donde vive la salida (`report.rs` o el que corresponda): `tension_crack: Option<CrackReport
  { x, depth, water_force }>` con `skip_serializing_if`;
- los nuevos `crates/ogs-core/src/crack.rs` y `crates/ogs-core/src/water.rs`, solo con los stubs;
- en `crates/ogs-core/src/lib.rs`, solo el cableado de los stubs.

**Esquema y herramientas:**
- `schema/ogs-0.5.schema.json`, nuevo;
- `verification/tools/test_schema.py`, extendido a 0.5;
- `verification/tools/identity_vs_baseline.py`, con dos agregados:
  - `--normalize-version`, que reemplaza la versión del motor en stdout y stderr antes de comparar;
  - un informe aparte, por nombre, de los modelos con agua sobre el terreno (la excepción de F5.1).

**Tests y web:**
- `crates/ogs-core/tests/f3g_types.rs`: la tabla de validación, como `f3r_types.rs`;
- `crates/ogs-core/tests/f3g_rows.rs`: las filas RED;
- `crates/ogs-core/tests/data/f3g/`: las 54 filas de `docs/fase3/exploracion/X21_filas/` y X21-A07, **migradas** según
  F5.5-3, con sus cifras del oráculo en un `expected.json` generado desde `resultados.json`;
- `apps/web/src/engine/types.ts`: los tipos espejo, sin UI.

## Tareas

1. **Tipos y validación** (F5.1 y F5.2):
   - el error de versión: `InvalidModel: tension_crack requiere version "0.5"`;
   - cada error de campo, con su ruta;
   - el esquema 0.5 debe coincidir con el motor en todas las filas de validación;
   - **`deny_unknown_fields`**.
2. **Stubs:**
   - `crack::truncate(...)` hace `todo!("G1: grieta de tracción")` y se llama **solo** si `analysis.tension_crack`
     existe;
   - `water::ponded_terms(...)` **devuelve términos nulos**, para que la identidad se mantenga y las filas de agua fallen
     por valor (0,848 frente a 0,939), no por pánico;
   - las firmas quedan congeladas, con documentación de qué recibe y qué devuelve cada una: las dovelas, el modelo
     resuelto, la superficie y la dirección `s`. Pensá en lo que van a necesitar M-agua (E1 a E4) y M-grieta (G1 a G9).
3. **E15h.** Lee el uso real de `h_moment_base` y `driving_extra` en `methods/*`, `slicer.rs` y el equilibrio global de
   los tests, y decide si el momento `s·V·(xg − xm)` del agua cabe en los campos actuales:
   - si cabe, no agregues nada y deja la justificación en `docs/fase3/g0/NOTAS.md`;
   - si no, agrega un campo con valor neutro 0 y `#[serde(skip)]` o `skip_serializing_if`, y actualiza todos los sitios
     de construcción, tests incluidos.
4. **Tests RED:**
   - `f3g_rows.rs` recorre las filas, compara con ≤ 0,1 % y espera `tension_crack_not_reached` en A07;
   - las filas de grieta deben fallar **en el stub**; las de agua, por valor;
   - reporta cuántas fallan de cada forma.
5. **Identidad.**
   - Corre `identity_vs_baseline.py --normalize-version --base
     /home/xodla/.hermes/profiles/open-geoslide/cache/scratch/f3g-base-target/release/ogs --new target/release/ogs`.
     Ese binario es la v0.3.0; si todavía no existe, espera o compílalo desde el tag `v0.3.0` en un worktree detached
     en `$TMPDIR`.
   - El resultado debe ser **0 diferencias**.
   - En los modelos sin refuerzos, la lista de agua sobre el terreno debe estar vacía; si encuentras alguno, repórtalo.

## Gates

- `cargo fmt --all --check`;
- `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`;
- `cargo test -p ogs-core --release --no-fail-fast`: todo verde, **salvo** `f3g_rows`, que debe estar RED con las
  causas esperadas;
- aceptación: 243 checks y 0 fallas;
- `pytest verification/tools`;
- `pnpm --dir apps/web exec tsc --noEmit`.

## Reglas

- `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch` y Python con `env -u PYTHONPATH -u
  PYTHONHOME`.
- Commits pequeños, con rutas explícitas. **Nunca push.**
- **Presupuesto:** unas 50 iteraciones. Si una decisión del contrato no se puede cumplir, detente y repórtala con
  números.
