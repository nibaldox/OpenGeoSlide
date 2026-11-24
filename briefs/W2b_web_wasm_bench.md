# Brief W2b: web con el motor WASM real + suite de rendimiento

**Lee primero:** `briefs/00_CONTRATOS.md` y `apps/web/README.md`. Responde en español.

## Objetivo
1. Que `apps/web` use el **wasm real** de `ogs-core`, y no el simulado, cuando esté disponible.
2. Medir el rendimiento de la búsqueda (Bishop y Spencer) en **nativo**, **Node (WASM)** y **Chrome headless (WASM)**
   con el mismo caso y los mismos parámetros, y publicar `bench/RESULTS.md`.

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/w2b` (rama `w2b-bench`).

## Archivos que te pertenecen
- `apps/web/**` (solo los cambios necesarios para el wasm real y la página de benchmark)
- `crates/ogs-cli/src/**` (subcomando `bench`)
- `bench/**` (nuevo)

**No toques** `crates/ogs-core/**` ni `crates/ogs-wasm/**` (si el wrapper necesita un cambio, repórtalo).

## Requisitos
1. **WASM en la web:**
   - `apps/web/scripts/build-wasm.sh` compila y genera `apps/web/src/wasm`;
   - la app muestra "Motor: ogs-core <versión> (WASM)";
   - el mock queda solo como respaldo, con su banner;
   - `pnpm build` incluye el `.wasm` en `dist/`.
2. **Página de benchmark:** `/?bench=1` (o `bench.html`).
   - Ejecuta, en el worker, el caso `verification/cases/V047a.json` con `kind = search` (defaults 20 × 20 × 20 + refine)
     para `bishop` y `spencer`, con 1 calentamiento + 5 repeticiones.
   - Escribe el resultado como JSON en `<pre id="bench-result">` y en `window.__OGS_BENCH__`, con los campos
     `{target, method, reps, ms: [...], median_ms, evaluated, valid, fos}`.
3. **CLI:** `ogs bench <caso.json> [--reps 5] [--method bishop|spencer|all]`.
   - Mide lo mismo en nativo, con un solo hilo y build release, con `std::time::Instant`.
   - Imprime el mismo JSON.
   - Si el crate tiene la feature `parallel`, añade una corrida `target = "native-parallel"` compilada con
     `--features ogs-core/parallel`, si es posible desde la CLI sin tocar el core.
4. **Node:** `bench/node/bench.mjs` usa la salida de `wasm-bindgen --target nodejs` (en `bench/node/pkg`, ignorada por git)
   y produce el mismo JSON.
5. **Chrome:** `bench/chrome/run.mjs` con `playwright-core` (última versión) y `executablePath: '/usr/bin/google-chrome-stable'`,
   en headless.
   - Levanta `pnpm preview` en el puerto **5181**, abre `/?bench=1`, espera `#bench-result` (timeout 180 s) y guarda el JSON.
   - Al final detiene el servidor y verifica que el puerto quedó libre.
6. **`bench/run_all.sh`** ejecuta 3, 4 y 5 y genera `bench/RESULTS.md` en español:
   - máquina: CPU (`lscpu` model name, núcleos), RAM, `rustc -V`, `node -v` y la versión de Chrome;
   - tabla `target | método | evaluadas | mediana ms | ms/superficie | FS`, más la razón WASM/nativo;
   - aviso de que es una medición de spike, no un benchmark controlado.
   - El JSON crudo queda en `bench/results/*.json` (versionado).

## Gates
- `pnpm test` y `pnpm build` en verde dentro de `apps/web`.
- `bench/run_all.sh` termina con código 0. Los FS de los tres targets coinciden con 1e-9 relativo para cada método
  (mismo motor, mismo caso). Si no coinciden, **es un hallazgo: repórtalo**, no lo escondas.
- `cargo clippy -p ogs-cli -- -D warnings` limpio.

## Cierre
- Commit en tu rama con rutas explícitas (sin `node_modules`, `dist`, `pkg` ni `src/wasm`) y el mensaje
  `feat(bench): motor wasm en la web y benchmark nativo/node/chrome`. Sin push.
- **Resumen:** tabla de resultados, gates, hash del commit y procesos o puertos que hayan quedado abiertos (deben ser cero).
- **Presupuesto:** ~60 iteraciones.
