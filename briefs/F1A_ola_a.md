# Brief F1-A: ola A de la Fase 1 (escritores con Sonnet)

Responde en **español neutro, sin voseo**. El código y los identificadores van en inglés; la UI, los mensajes y la
documentación, en español.

**Lee primero, completos:**
- `briefs/01_CONTRATOS_FASE1.md`, normativo;
- `briefs/00_CONTRATOS.md`, base normativa;
- tu sección de este brief.

Evidencia: `docs/fase1/exploracion/X1.md` (sismo y cargas) y `X3.md` (editor).

## Reglas comunes
- Trabaja **solo** en tu worktree y tu rama. Toca solo los archivos de tu sección.
- Commits pequeños, con rutas explícitas (`git add <ruta>`). **Nunca hagas push.**
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.
- Puertos: no uses el 5180 ni el 5181. Para `vite preview` usa uno del 5182 al 5189.
- **Oráculo:**
  - `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/oracle-venv/bin/python` (`import cslope`, 0.1.0);
  - conversor `verification/harness/to_cslope.py`.
- **Si un criterio del contrato no se cumple, detente y reporta con números.** No ajustes tolerancias, casos ni
  valores publicados.
- **Resumen final:** por criterio, el test y su resultado real; los gates con su salida; y los hashes de los commits.

---

## F1-0: tipos congelados de la web (`opengeoslide-wt/f1-0`, rama `f1-0-tipos`)

Tarea corta, de unas 25 iteraciones.

1. `apps/web/src/engine/types.ts`: agrega los tipos del esquema v0.2 según F1.1: `Load`, `UdlLoad`, `LineLoad`,
   `Seismic`, `Model.version: '0.1' | '0.2'`, `Model.loads?` y `AnalysisSettings.seismic?`.
2. Crea `apps/web/src/editor/types.ts`, `apps/web/src/io/types.ts` y `apps/web/src/report/types.ts`. Cópialos
   **literalmente** de X3 §2.1 y aplica los cambios de F1.4 (sin `features`, comandos de sismo y cargas, `Selection`
   de carga y códigos `editor.*` como `type EditorIssueCode`).
   - Solo tipos e interfaces, más la declaración de `buildReportPdf` como **tipo** (`export type BuildReportPdf =
     (input: ReportInput) => Promise<Blob>`), sin implementación.
3. `apps/web/src/engine/warnings.ts`: agrega `load_outside_mass` como **nota**, con el texto «Alguna carga declarada no
   actúa sobre la masa analizada». El test que compara con la lista E6 del contrato debe pasar, porque el contrato ya
   incluye el código.
4. **Test** `apps/web/src/editor/types.test.ts`: un `ModelDoc` v0.2 de ejemplo con `loads` y `seismic` tipa bien, y
   un `EditorCommand` de cada tipo compila. Comprueba también que el JSON de ejemplo de F1.1 coincide con los tipos.
5. **Gates:** `pnpm install --frozen-lockfile && pnpm test && pnpm build`.

**Archivos tuyos:**
- `apps/web/src/engine/types.ts`, solo el agregado;
- `apps/web/src/engine/warnings.ts`, solo el código nuevo;
- `apps/web/src/editor/types.ts`, `apps/web/src/io/types.ts`, `apps/web/src/report/types.ts`;
- `apps/web/src/editor/types.test.ts`.

---

## A1: sismo y cargas en el motor (`opengeoslide-wt/f1a1`, rama `f1a1-sismo-cargas`)

1. **E12a:**
   - `model.rs` (tipos de F1.1) y validación (en `lib.rs` o en un módulo nuevo `loads.rs`; **no** en `geometry.rs`);
   - versiones 0.1 y 0.2, más el error para los campos nuevos con 0.1;
   - en `validation.rs`, revisa la fixture con `seismic_kh` (X1 §2.1): debe seguir siendo un campo **desconocido** que
     falla.
2. **E12b:**
   - `slicer.rs`: quiebres de carga, `W*`, `H`, `ȳ` exacto ponderado por peso y `y_g`, con campos nuevos en `Slice`;
   - `methods/bishop.rs`, `methods/spencer.rs` y `methods/mod.rs` (N′ y clasificación).
   - Deriva la forma de Spencer con H y verifícala con los criterios (ii) a (v).
3. **Nota `load_outside_mass`:** agrégala a `INFORMATIVE_WARNINGS` en `tests/acceptance.rs` y a la lista informativa de
   `tests/validation.rs`.
4. **Tests nuevos** en `crates/ogs-core/tests/loads_seismic.rs`, con los criterios (i) a (v) de F1.2 y la validación
   de F1.1 (cada mensaje).
   - Para (iii), un script reproducible `verification/harness/oracle_seismic_v047a.py` ejecuta cSlope y escribe
     `crates/ogs-core/tests/fixtures/oracle_seismic_v047a.json`, que el test lee. Ambos archivos son tuyos.
   - El mapeo de sismo y cargas en `to_cslope.py` es de A2. Hasta que se integre, tu script construye el documento de
     cSlope a mano: `options.seismicHorizontal`/`seismicVertical`, `definition.udls[]{id,magnitude,x1,x2,direction:"vertical"}`
     y `definition.lineLoads[]{id,x,magnitude,angle}`, partiendo de `ogs_to_cslope` del modelo sin cargas.
5. **Rendimiento:** `ogs bench verification/cases/V047a.json` con Bishop y Spencer, 5 repeticiones antes y después,
   sin sismo. Regresión máxima: 3 %.

**Archivos tuyos:**
- `crates/ogs-core/src/{model.rs,lib.rs,slicer.rs,methods/**}` y el nuevo `crates/ogs-core/src/loads.rs`;
- `crates/ogs-core/tests/{loads_seismic.rs,acceptance.rs (solo INFORMATIVE_WARNINGS),validation.rs}`;
- `crates/ogs-core/tests/fixtures/oracle_seismic_v047a.json`;
- `verification/harness/oracle_seismic_v047a.py`.

**No toques** `geometry.rs`, que es de A2.

---

## A2: validación de regiones y harness v0.2 (`opengeoslide-wt/f1a2`, rama `f1a2-regiones-harness`)

1. **E12c** en `crates/ogs-core/src/geometry.rs` (`PreparedModel::new`): auto-intersección, solape, aristas
   compartidas permitidas, uniones en T permitidas y x creciente de la piezométrica.
   - Tests en `crates/ogs-core/tests/regions_validation.rs`, con al menos:
     - un lazo «8»;
     - una espiga;
     - dos cuadrados solapados;
     - un cuadrado dentro de otro;
     - polígonos idénticos en orden inverso;
     - arista compartida válida;
     - unión en T válida;
     - piezométrica desordenada.
   - **Neutralidad:** comprueba que los 16 casos, los 10 diferenciales y todas las fixtures de `crates/*/tests` siguen
     siendo válidos.
2. **`verification/harness/to_cslope.py`:** mapeo de `analysis.seismic` y `loads` al documento de cSlope (ver A1 §4).
   - **Verifica con el oráculo** la convención de ángulo de la carga lineal en **ambas** direcciones (`ltr` y `rtl`),
     con un caso mínimo y la salida citada en el docstring.
   - Si cSlope espeja la geometría (`canonical.rs`, X1 §2.2), documenta la regla.
   - Tests en `verification/harness/test_to_cslope.py`.
3. **`verification/tools/import_cslope.py`:** importa los problemas de cSlope con `seismicHorizontal`,
   `seismicVertical`, `udls` y `lineLoads` al esquema v0.2. Sigue rechazando los que usan `reinforcements`,
   `excessPorePressure`, `customSurfaces` o B̄.
   - Genera, **en `verification/pending/`** (no en `verification/cases/`, para no romper la aceptación antes de
     integrar A1), los casos V102a, V102b y los candidatos `udl` de X1 §2.4 (V097a/b, V081a, V066e), si sus datos no
     dependen de lo excluido.
   - Agrega `verification/pending/INDEX.md` con cada caso y el motivo de inclusión o exclusión.
   - Los casos pendientes deben validar contra el JSON Schema del importador, actualizado a v0.2.
   - Tests en `verification/tools/test_import_cslope.py`.

**Archivos tuyos:**
- `crates/ogs-core/src/geometry.rs` y `crates/ogs-core/tests/regions_validation.rs`;
- `verification/harness/to_cslope.py` y su test;
- `verification/tools/import_cslope.py` y su test;
- `verification/pending/**`.

**No toques** `model.rs`, `lib.rs`, `slicer.rs` ni `methods/`, que son de A1. Si necesitas un tipo v0.2 en Rust, no lo
necesitas: tu parte de Rust es solo geometría.

---

## Gates (A1 y A2)
- `cargo fmt --all --check` y `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`
- `cargo test -p ogs-core --release --no-fail-fast` y `--features parallel`
- Aceptación 38/38 (`cargo test -p ogs-core --release --test acceptance -- --nocapture`)
- Batería diferencial:
  ```
  uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely python verification/differential/run.py --ogs target/release/ogs --out $TMPDIR/<rama>-diff
  ```
  Debe dar 20/20 + 20/20.
- Solo A2: pytest
  ```
  uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with jsonschema --with pytest python -m pytest -q verification
  ```
