# Brief F1-I: cierre de las reservas de R6 (un escritor Sonnet)

Responde en **español neutro, sin voseo**. Lee completo `docs/reviews/R6_agy.md`: los hallazgos R6-01 a R6-05 traen
la evidencia y la corrección sugerida.

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/f1i`, rama `f1i-reservas-r6`, creada desde `main`.

## Regla
Cada hallazgo empieza con un **test que falla** con el código actual y que reproduce la evidencia de R6. Solo después
viene la corrección. En el resumen, informa el test, que falla antes y pasa después.

## Tareas
1. **R6-01, PWA** (`apps/web/src/pwa/updateFlow.ts` y, si hace falta, `updatePrompt.ts`):
   - el estado «tenía controlador» debe ser **mutable**: se actualiza en el primer `controllerchange`, cuando se
     instala por primera vez y `clients.claim()` toma el control;
   - después de pulsar «Actualizar», el `controllerchange` siguiente recarga **una sola vez**.
   - **Test:** el ciclo de R6 (primera visita → `claim` v1 → llega v2 → clic → `controllerchange`) termina en
     `reloads = 1`. Los tests existentes en `pwa.test.ts` siguen pasando, y no hay bucles de recarga.
2. **R6-02** (`apps/web/src/io/ogsJson.ts` y `apps/web/src/editor/EditorApp.tsx`):
   - en `openOgsJson`, un número no finito en cualquier campo escalar (por ejemplo, `1e400` → `Infinity`) devuelve
     `{doc: null, issues: [error io.non_finite con su puntero]}`, nunca una excepción;
   - `saveOgsJson` sigue lanzando el error ante números no finitos;
   - `onOpenFile` y `onSave`, en `EditorApp.tsx`, envuelven la operación en `try/catch` y muestran el error con el
     mecanismo de notificación que ya existe.
   - **Tests:** `cohesion`, `xc`, `kh` y `q` de una carga, todos con `1e400`.
3. **R6-03** (`ogsJson.ts`): si `meta`, `slope` o `analysis` están presentes, deben ser objetos; un `null` es un error
   `io.shape`, igual que en el motor. Test de paridad con los 3 casos de R6 contra el motor: usa `OGS_BIN` si está
   disponible, como en `parity.test.ts`, o compara al menos con el mensaje esperado.
4. **R6-04** (`.github/workflows/wheels.yml`): el job `publish` exige
   `github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')`. `actionlint` debe quedar limpio con
   `$TMPDIR/f1d-actionlint/actionlint`.
5. **R6-05, DXF** (`apps/web/src/io/dxf/entities.ts`):
   - tolerancia de `1e-9` en `extrusionProblem`;
   - **no** se comprueba la extrusión en `LINE`, porque sus coordenadas son WCS. Se sigue comprobando en
     `LWPOLYLINE` y `POLYLINE`.
   - **Tests:** `(1e-16, 0, 1)` se acepta; una `LINE` con `230 = -1` se acepta; `LWPOLYLINE` con `230 = -1` sigue
     rechazándose.

## Archivos tuyos
- `apps/web/src/pwa/**`;
- `apps/web/src/io/ogsJson.ts` y sus tests;
- `apps/web/src/editor/EditorApp.tsx`, solo `onOpenFile` y `onSave`;
- `apps/web/src/io/dxf/**`;
- `.github/workflows/wheels.yml`.

## Gates
- `cd apps/web && pnpm install --frozen-lockfile && pnpm test && pnpm build`
- `OGS_BIN=<repo>/target/release/ogs pnpm --dir apps/web exec vitest run src/editor/state/parity.test.ts` sin casos
  omitidos. Antes, compila el CLI con `cargo build --release -p ogs-cli`.
- Ida y vuelta:
  ```
  env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with pytest python -m pytest -q verification/tools/test_web_roundtrip.py
  ```
- `actionlint` limpio.

## Cierre
- Commits pequeños con rutas explícitas. Sin push.
- **Resumen:** por hallazgo, el test y su resultado antes y después; gates con salida real; hashes.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. No uses los puertos 5180 a 5187.
- **Presupuesto:** ~40 iteraciones.
