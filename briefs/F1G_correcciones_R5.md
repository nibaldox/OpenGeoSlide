# Brief F1-G: ola correctiva tras R5 (tres escritores Sonnet en paralelo)

Responde en **español neutro, sin voseo**. Lee completos:
- `briefs/01_CONTRATOS_FASE1.md`, en especial **§F1.7 (E12f-E12j)**, que es normativo;
- `docs/reviews/R5_agy.md`, con los hallazgos y su evidencia;
- tu sección de este brief.

## Reglas comunes
- Trabaja solo en tu worktree y tu rama, y solo en tus archivos.
- Commits pequeños, con rutas explícitas. Nunca hagas push.
- Cada hallazgo corregido lleva un **test de regresión** con los datos de R5.
- Python siempre con el prefijo `env -u PYTHONPATH -u PYTHONHOME`.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.
- Oráculo: `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/oracle-venv/bin/python`, con
  `verification/harness/to_cslope.py`.
- Si un criterio no se cumple, **detente y reporta con números**. No toques tolerancias ni casos.
- **Resumen final:** por hallazgo, el test y los valores antes y después; los gates con su salida real; los hashes.

## Gates comunes
- **Rust:**
  - `cargo fmt --all --check`;
  - `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`;
  - `cargo test -p ogs-core --release --no-fail-fast`, y también con `--features parallel`.
- **Verificación:** aceptación 51/51, harness 51/51, batería 28/28 + 28/28 y pytest de `verification`.
- **Web:** `cd apps/web && pnpm install --frozen-lockfile && pnpm test && pnpm build`.

---

## G1: motor (`opengeoslide-wt/f1g1`, rama `f1g1-motor-r5`)

**Archivos:**
- `crates/ogs-core/src/{slicer.rs,loads.rs,geometry.rs,methods/spencer.rs}`;
- `crates/ogs-core/tests/{loads_seismic.rs,regions_validation.rs,spencer_root_selection.rs}`;
- `crates/ogs-core/tests/fixtures/oracle_seismic_v047a.json`;
- `verification/harness/oracle_seismic_v047a.py`.

1. **E12f (R5-01): carga lineal en bordes.**
   - **Evidencia:** V047a con el círculo fijo de la fixture, bloque [30,0000016; 51,2911184], `p = 100`, ángulo 10°.
     En el extremo derecho, ogs da 0,985123 frente a cSlope 0,919973. En el vértice x = 50, el espejo da
     Δ = 3,4e-7.
   - **Criterios (tests):**
     - carga en el extremo derecho y en el extremo izquierdo, en `rtl` y en `ltr` (espejo): Bishop y Spencer ≤ 0,1 %
       frente a cSlope. Agrega los escenarios a la fixture del oráculo y al script;
     - carga sobre el vértice de la corona y sobre una frontera de dovela: el espejo da ≤ 1e-9;
     - equilibrio global (ii) con la carga en un borde;
     - fuera del bloque, la nota `load_outside_mass` y el FS sin carga.
2. **R5-11:** guarda en la iteración 0 de `newton_near` (`guess > 0`, `≤ FOS_MAX` y la vecindad `ROOT_STEP0`). La
   aceptación y la batería no deben cambiar más de 1e-9 relativo.
3. **E12j (motor):** `InvalidModel` para `material.id` vacío, con su test.

## G2: datos, informe y exportaciones de la web (`opengeoslide-wt/f1g2`, rama `f1g2-web-datos-r5`)

**Archivos:**
- `apps/web/src/io/{ogsJson.ts,csv.ts}` y sus tests;
- `apps/web/src/report/**`;
- `apps/web/src/editor/app/{useEngineCheck.ts,reportInput.ts}` y sus tests;
- `apps/web/src/editor/EditorApp.tsx`, solo los botones de exportación y las condiciones que los habilitan.

1. **E12g (R5-02): sin redondeo.**
   - Quita `round6` del camino de abrir, calcular y guardar. `tolerance` y el resto de los números se conservan tal
     cual.
   - **Test de ida y vuelta con el motor real:** un script Node o Python en el test, o un test de Vitest que compare el
     JSON, verifica que abrir y guardar los 21 casos y los 14 modelos produce números **idénticos** al original.
     Además, un test de integración en Python (`verification/tools/test_web_roundtrip.py`, que es tuyo) ejecuta
     `ogs analyze` sobre el original y sobre la salida de `saveOgsJson` y exige reportes iguales. Para eso, exporta la
     salida de `saveOgsJson` con un pequeño script Node (`node --experimental-strip-types`), sin dependencias nuevas.
   - **Modelos de frontera:** `min_m_alpha = 1e-7` y `kh`, `kv` o `ru` = 0,9999999 se conservan.
2. **E12h (R5-07): `openOgsJson` estricto.**
   - Rechaza campos desconocidos en todos los niveles con un `error` (no un aviso), con su puntero.
   - Rechaza `version: "0.1"` con `loads` no vacío o con `seismic` no nulo.
   - **Tests:** el caso de R5 con `r_u` en lugar de `ru`.
3. **E12i (R5-03, R5-04):**
   - **Superficie en x creciente:** `content.ts` (`buildSectionDrawing`) y `reportInput.ts` (`surfaceCoordsCsv`).
     - Test con D01 en superficie fija (`left_to_right`): el primer punto es el de menor x, el último el de mayor x,
       incluye el pie (x = 40) y no hay retrocesos.
   - **`surfaceCoordsCsv`:** columna `estado` y solo métodos `converged`.
   - **`resultsToCsv`:** columna `avisos`, con los códigos separados por `;` o `|` y protegidos contra fórmulas.
   - **`lambda`:** solo si el método convergió, en el CSV y en la tabla del PDF.
   - **Rótulo del PDF:** si ningún método convergió, no dice «Superficie crítica».
   - **Exportaciones bloqueadas** si `!engine.current`: los botones quedan deshabilitados, con un `title` explicativo.
4. **R5-06 (CSV):** límite de tamaño en `parseCsv`, igual al de DXF (2 MB), con su error y su test.

## G3: importación, validación, PWA, CI y esquema (`opengeoslide-wt/f1g3`, rama `f1g3-entradas-pwa-ci`)

**Archivos:**
- `apps/web/src/io/dxf/**`;
- `apps/web/src/editor/app/importPlan.ts` y su test;
- `apps/web/src/editor/state/{validateLocal.ts,polygonChecks.ts}` y sus tests;
- `apps/web/src/editor/types.ts`, **solo** para agregar `editor.degenerate_region` y `editor.no_surface` a
  `EditorIssueCode`;
- `apps/web/build/**`, `apps/web/src/pwa/**` y `apps/web/index.html`;
- `.github/workflows/**`;
- `schema/ogs-0.2.schema.json` y `verification/tools/test_schema.py`.

1. **R5-06 (DXF):**
   - rechaza con aviso las entidades con extrusión distinta de (0, 0, 1) (códigos 210/220/230);
   - valida el código 30 en la cabecera de `POLYLINE`;
   - en `importPlan.ts`, usa `Object.hasOwn` o un `Map`. Test con capas llamadas `constructor` y `toString`;
   - no cuenta dos veces las polilíneas coincidentes promovidas a región.
2. **E12j (editor):**
   - las regiones degeneradas dan `editor.degenerate_region`, con la misma regla de área que `geometry.rs`;
   - un modelo sin `surface` ni `search` da `editor.no_surface`;
   - un vértice consecutivo repetido pasa a severidad **aviso**.
   - **Test de paridad:** una tabla de casos (los 4 de R5-10 y los existentes) con el veredicto esperado del motor.
3. **R5-08 (PWA):**
   - `updateViaCache: 'none'`;
   - **flujo de actualización:** cuando hay un service worker en `waiting`, se muestra un aviso DOM mínimo, sin React,
     dentro de `src/pwa/`: «Hay una versión nueva de OpenGeoSlide» con el botón «Actualizar». El botón envía
     `SKIP_WAITING`, y la página se recarga en `controllerchange`;
   - caché de fuentes versionada con el hash del build;
   - rutas relativas, o `%BASE_URL%`, en `index.html`, verificadas con `VITE_BASE=/opengeoslide/`.
   - **Verifica en Chrome headless** (puerto 5187, nunca 5180 a 5186): el build A se instala, el build B se sirve, se
     muestra el aviso, «Actualizar» carga el JS y el WASM nuevos (compara el hash del asset) y funciona sin conexión
     después de actualizar.
4. **R5-09 (workflows):**
   - `pages: write` e `id-token: write` solo en el job `deploy`;
   - `wheels.yml` ejecuta `pytest crates/ogs-py/tests` contra el wheel instalado;
   - `release.yml`: `github-release` solo con `github.event_name == 'push'`.
   - `actionlint` limpio, con el binario de `$TMPDIR/f1d-actionlint/actionlint`.
5. **E12h (esquema):** `ogs-0.2.schema.json` acepta `loads: []` y `seismic: null` con 0.1, igual que el motor, y sus
   cotas coinciden con §4.5. El test confirma que el esquema y el binario aceptan y rechazan exactamente los mismos
   documentos de una tabla de casos límite.
