# Brief F3A-0: ola 0 de la Fase 3a, tres escritores Sonnet en paralelo

Responde en **español neutro, sin voseo**. Identificadores en inglés. Lee primero **completo**
`briefs/02_CONTRATOS_FASE3.md`, que es normativo, y los hallazgos `docs/fase3/exploracion/X10.md` a `X13.md`.
- Si algo del contrato no se puede cumplir, o parece incorrecto, **detente y repórtalo con números**: no improvises,
  no ajustes tolerancias ni valores de referencia.
- Base: `main` en el commit que creó tu worktree.

## Reglas comunes
- Trabaja **solo en tu worktree** y **solo en tus archivos**. Si necesitas un cambio en un archivo ajeno, deja un
  parche en `docs/fase3/<tu id>/*.patch`, verificado con `git apply --check`.
- Para cada cambio de comportamiento, escribe primero un test que falle. Commits pequeños con rutas explícitas.
  **Nunca hagas push.**
- **Entorno:**
  - `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`;
  - Python siempre con `env -u PYTHONPATH -u PYTHONHOME`;
  - oráculo: `$TMPDIR/oracle-venv/bin/python` (`cslope` 0.1.0), o
    `uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely ...`;
  - toolchain: Rust 1.97.1, Node 22, pnpm 11.8 y uv.
- **Gates del motor:**
  - `cargo fmt --all --check`;
  - `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`;
  - `cargo test -p ogs-core --release --no-fail-fast`, y también con `--features parallel`;
  - aceptación: `cargo test -p ogs-core --release --test acceptance -- --nocapture`.
- **Gates de la web:**
  - `bash apps/web/scripts/build-wasm.sh`;
  - `cd apps/web && pnpm install --frozen-lockfile && pnpm test && pnpm build`;
  - paridad: `OGS_BIN=<wt>/target/release/ogs pnpm --dir apps/web exec vitest run`, sin omitidos.
- **Al terminar, reporta en español:**
  - qué hiciste y qué no, por punto;
  - salida real de los gates;
  - hashes;
  - decisiones que el coordinador debe revisar.

---

## W0a: núcleo del motor v0.3 (worktree `f3w0a`, rama `f3w0a-nucleo`)

**Archivos tuyos:**
- `crates/ogs-core/src/{model.rs,loads.rs,report.rs,lib.rs,geometry.rs,slicer.rs}` (en `slicer.rs`, **solo** la
  llamada a `strength::resolve`);
- nuevos: `crates/ogs-core/src/surface.rs` y `crates/ogs-core/src/strength.rs`;
- `crates/ogs-core/tests/*` nuevos;
- `schema/ogs-0.3.schema.json` (nuevo) y `verification/tools/test_schema.py`;
- `crates/ogs-cli/src/bench.rs` (nombres de métodos), `crates/ogs-py/python/opengeoslide/__init__.py` (documentación
  de códigos) y `CHANGELOG.md`.

**Tareas**, por prioridad:
1. **E13a, formato v0.3:**
   - la constante `FORMAT_VERSION_V03` y la compuerta en `validate_document`, con el mensaje exacto del contrato;
   - tipos nuevos en `model.rs`:
     - `MaterialModel::Undrained` y los campos opcionales del material (F3.2);
     - `SurfaceSpec::Polyline { points }`;
     - `MethodKind::{MorgensternPrice, JanbuSimplified, JanbuCorrected}`, en snake_case;
     - `AnalysisSettings.interslice: Option<IntersliceSpec>` con `function` y `points`.
   - Validaciones de F3.2, F3.3 (formato de la polilínea), F3.4 (`interslice`) y F3.6 (Bishop con polilínea), con
     `InvalidModel` y mensajes en español.
2. **E13b, material no drenado completo:**
   - En `strength.rs`, `resolve(material, y_base_mid) -> (c, tan_phi)`, con la firma exacta del contrato.
   - Mueve a `strength.rs` la resolución y la validación de materiales que hoy está en `geometry.rs:40-131`. Es un
     refactor puro; `geometry.rs` solo lo llama.
   - En `slicer.rs`, cada dovela obtiene `(c, tan φ)` con `strength::resolve` en el punto medio de su base.
   - **Prueba bit a bit:** Mohr-Coulomb no cambia, y `undrained` sin gradiente es idéntico a Mohr-Coulomb con
     φ = 0.
3. **E13g, informe:**
   - `MethodReport.surface` pasa a ser un enum *untagged*, con el círculo primero para que su salida sea idéntica;
   - los campos opcionales `correction_factor` e `interslice`.
4. **Interfaces congeladas para la ola 1:**
   - `surface.rs`: `enum Surface { Circle(Circle), Polyline(Polyline) }`, con `y_at`, cruces con el terreno y puntos
     de quiebre.
     - El círculo delega en el código actual, **sin recablear todavía** `slicer.rs`, que es de W1a.
     - La polilínea queda en `unimplemented!("F3-W1a")`.
   - En `lib.rs`, el despacho de métodos nuevos llega a `unimplemented!("F3-W1b")` y el de polilínea a
     `unimplemented!("F3-W1a")`.
   - Documenta cada firma con un comentario.
5. **Test RED** `crates/ogs-core/tests/f3_oracle.rs`:
   - **todos** los valores de F3.8, con su tolerancia;
   - los criterios de neutralidad e identidad que ya se pueden probar.

   Los de no drenado deben pasar ya. Los de M-P, Janbu y polilínea deben fallar **en el stub**, no al parsear:
   confírmalo y cópialo en tu informe.
6. **Esquema y tests:**
   - `schema/ogs-0.3.schema.json`;
   - `test_schema.py`, cambiando la prueba que hoy exige que `"0.3"` falle;
   - `bench.rs` con los métodos nuevos;
   - `CHANGELOG.md` en «Unreleased».

**Gates:**
- todos los del motor, con la aceptación actual intacta;
- la batería diferencial actual sin cambios en su informe:
  `uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely python verification/differential/run.py --ogs target/release/ogs --out $TMPDIR/f3w0a-bat`;
- `test_schema.py` con
  `uv run -q --python 3.13 --no-project --with jsonschema --with pytest python -m pytest -q verification/tools/test_schema.py`.

**Presupuesto:** unas 95 iteraciones. Si no alcanza, el orden de prioridad es 1, 2, 5, 3, 4, 6.

---

## W0b: tipos web v0.3 (worktree `f3w0b`, rama `f3w0b-tipos-web`)

**Archivos tuyos:**
- `apps/web/src/engine/{types.ts,validate.ts,mockEngine.ts}` y sus tests;
- `apps/web/src/editor/types.test.ts`;
- **todos** los sitios `Record<MethodKind, …>`, y solo para agregar las entradas nuevas con las etiquetas exactas de
  F3.9:
  - `editor/panels/forms.ts`;
  - `report/content.ts`;
  - `editor/app/{reportInput.ts,resultSummary.ts,diagnostics.ts}`;
  - `editor/panels/AnalysisPanel.tsx` (`METHOD_ORDER` y `METHOD_LABELS`).
- `io/ogsJson.ts`, **solo** si `tsc` lo exige por el tipo nuevo de versión, sin cambiar su comportamiento: la apertura
  de 0.3 es de W1e.

**Tareas:**
1. **`engine/types.ts`, espejo exacto del contrato:**
   - versión `'0.1' | '0.2' | '0.3'`;
   - `MaterialModel` con `undrained` y los campos opcionales;
   - `SurfaceSpec` con `polyline`;
   - `MethodKind` con los tres métodos nuevos;
   - `IntersliceSpec` y `IntersliceFunction`;
   - `MethodReport.surface` como unión de círculo y `{points}`;
   - `correction_factor` e `interslice` opcionales;
   - `Slice` con **los 18 campos** que emite el motor (riesgo B de X12: hoy le faltan 5).
2. **`engine/validate.ts`:** acepta un informe con superficie polilínea y con los métodos nuevos (riesgo G de X12).
   Sin esto, `client.ts` descarta informes válidos.
3. **`mockEngine.ts`:** rechaza todo modelo con campos de 0.3 con un error explícito (F3.9). Nunca inventa un FS.
4. **`editor/types.test.ts`:**
   - actualiza el `@ts-expect-error` de versión;
   - agrega un test que lea el **primer bloque `json`** de `briefs/02_CONTRATOS_FASE3.md` y lo asigne con tipos,
     igual que el de F1.1.
5. **Etiquetas** en todos los `Record<MethodKind>`. Agrega solo entradas: no cambies ninguna interfaz visible.

**Gates:** los de la web con paridad (el motor no cambia en tu rama) y `tsc --noEmit`.

**Presupuesto:** unas 55 iteraciones.

---

## W1v: verificación, importación y oráculo (worktree `f3w1v`, rama `f3w1v-verificacion`)

**Archivos tuyos:**
- `verification/tools/import_cslope.py` y sus tests;
- `verification/harness/*`;
- `verification/differential/*`;
- `verification/cases/*` (solo el lote 0);
- `verification/pending/**`, incluida `verification/pending/F3/`;
- los informes regenerados (`verification/REPORT.md`, `report.json` y `verification/differential/REPORT.md`);
- `NOTICE` si hace falta.
- **No toques** `verification/tools/test_schema.py`, que es de W0a.

**Tareas**, por prioridad:
1. **Lote 0 (F3.8):**
   - elimina `MAX_CASES = 20` y la selección por mínimos;
   - importa **todos** los casos convertibles hoy (X10 contó 63 casos y 128 checks) a `verification/cases/`;
   - corre la aceptación con el binario de `main`.
   - Si algún check falla, **no lo promuevas ni relajes nada**: déjalo en `verification/pending/` con su motivo,
     reproduce su FS con el binario y con el oráculo, y repórtalo con números (publicado, ogs, cSlope y diagnóstico).
   - Busca y actualiza las pruebas que cuenten casos con un literal, en Rust, Python o la web; deben leer el índice.
     Lístalas en tu informe. Si alguna es de otro escritor, déjala como parche.
2. **Conversor `to_cslope.py`** (F3.8): `undrained`, polilínea, M-P con sus cinco funciones y Janbu.
   - Cada mapeo con su test.
   - Prueba que el conversor reproduce, con el oráculo, los valores de F3.8 a 1e-9.
3. **Lotes 1 y 2:**
   - extiende el importador para escribir los casos en `.ogs.json` v0.3, según el contrato, en
     `verification/pending/F3/`, con su `INDEX.md`. Ahí esperan a que el motor los soporte;
   - verifica con el harness, solo contra el oráculo, que cSlope reproduce cada valor publicado. Las discrepancias
     se marcan como «revisar conversión», sin tocar los datos.
4. **Batería diferencial (F3.8):**
   - agrega los tres modelos nuevos;
   - prepara el runner para M-P `half_sine` y Janbu corregido sobre el círculo fijo de cada modelo, y para la
     polilínea fija.
   - Mientras el motor no soporte esos métodos, el runner debe marcarlos como «pendiente» sin fallar, y el informe
     actual de Bishop y Spencer no debe cambiar.

**Gates:**
- `uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with jsonschema --with pytest python -m pytest -q verification`;
- la aceptación con el lote 0;
- la batería.

**Presupuesto:** unas 90 iteraciones. Si no alcanza, el orden de prioridad es 1, 2, 3, 4.
