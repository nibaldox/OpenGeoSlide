# Brief W6: masa desconectada, admisibilidad de Spencer y avisos múltiples (E8a-E8d)

**Lee primero:** `briefs/00_CONTRATOS.md`, en especial **E8a** (§4.1.9), **E8b** (E4b reformulada, §4.3), **E8c** (umbral
de E7d) y **E8d** (`MethodResult.warnings`, §3). Lee también `docs/reviews/R2_agy.md` y `briefs/W5_correcciones_R2.md`.
Responde en español.

## Contexto
La rama `w6-cierre-r2` = `main` (con W5b y W5c integrados) + `w5a-metodos` mergeada. Hoy en esa rama:
- La aceptación da 30/38: con E7a, la búsqueda de Spencer encuentra superficies con un tramo aéreo interior y FS
  absurdos (V003: 0,11). Es lo que corrige **E8a**.
- 6 checks de Bishop marcan `negative_effective_normal_major` con f entre 0,022 y 0,038, que el umbral nuevo de
  **E8c** (0,05) reclasifica como nota.
- `validation::r1_05` falla porque `examples/acads1a` emite `air_gap_thrust`; E8a debería resolverlo.
- El test `regression_r2` de búsqueda R2-03 (≤ 5 % de Bishop) está `#[ignore]`: lo bloqueaba E4b, y **E8b** lo
  desbloquea.

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/w6` (rama `w6-cierre-r2`).

## Archivos que te pertenecen
- `crates/ogs-core/src/**`, `crates/ogs-core/tests/**`
- `apps/web/src/engine/warnings.ts` y su test, **solo** si cambia la lista de códigos (E6) o hace falta un texto para
  `disconnected_mass` en el motivo de `NoValidSurface`
- `verification/REPORT.md`, `verification/report.json` y `bench/RESULTS.md` + `bench/results/*.json` (regenerados al final)

## Tareas
1. **E8a** en `slicer.rs`:
   - después de construir las dovelas, identificar los bloques de suelo separados por tramos aéreos interiores;
   - si algún bloque distinto del principal pesa > 1e-3·ΣW → `SurfaceError::DisconnectedMass`;
   - el `match` de `lib.rs` que traduce `SurfaceError` al español debe cubrir la nueva variante;
   - **tests:**
     - notch de R2-01 (`[[0,0],[0,10],[10,10],[25,18],[26,6],[38,14],[40,28],[60,28],[60,0]]`, círculo (16, 42, 34))
       → `DisconnectedMass`;
     - el círculo crítico de V019 (la franja del pie) **sigue siendo válido**;
     - un caso con un lente justo bajo y justo sobre el umbral.
   - Los tests de `regression_r2.rs` que usaban el notch con `analyze` deben pasar a esperar
     `NoValidSurface`/`DisconnectedMass`. La **identidad de equilibrio global** de E7a se conserva como test a nivel
     de métodos, con dovelas sintéticas en `tests/methods.rs` (ya existe; verifica que siga).
2. **E8b** en `spencer.rs`:
   - admisibilidad final `Φᵢ > 1e-9·F` **y** `m_α(F) ≥ min_m_alpha`, con el criterio de Bishop en el F de Spencer;
   - **reactiva** el test de búsqueda R2-03: el FS crítico de Spencer debe quedar a ≤ 5 % del de Bishop;
   - R1-01 sigue rechazado (contraejemplo con D < 0).
3. **E8c:** umbral 0,05 en la clasificación de N'. Tests: R2-04 (f = 0,105) → `major`; un caso con f ≈ 0,03 → nota.
4. **E8d:**
   - `MethodResult.warnings: Vec<String>`;
   - `message` queda solo para el motivo del estado (`Invalid` o `NotConverged`);
   - `lib.rs` propaga `message` + `warnings` al `MethodReport.warnings`, sin duplicados y en orden estable;
   - test: una superficie con `air_gap_thrust` y una clase de N' reporta **ambos** códigos.
5. **Aceptación 38/38** con la lista `INFORMATIVE_WARNINGS` **sin cambios**.
   - Reporta la tabla y los FS que cambian frente a `main` (`git stash` o el binario de `main` en
     `/home/xodla/archivos/opengeoslide/target/release/ogs`).
   - Si V019 u otro caso sale de tolerancia por E8a, **detente y reporta** con los números (peso del bloque, FS antes y
     después); no ajustes el umbral por tu cuenta.
6. **Regenera los reportes:**
   - harness:
     ```
     cargo build --release -p ogs-cli
     uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely python verification/harness/run.py --cases verification/cases --ogs target/release/ogs --out verification
     ```
   - `bench/run_all.sh` usa el puerto 5181; **no toques el 5180**.

## Gates (salida real)
- `cargo fmt --all --check` y `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`
- `cargo test -p ogs-core --release --no-fail-fast` (todo verde, con la aceptación 38/38) y `cargo test -p ogs-core --features parallel`
- `cd apps/web && pnpm install --frozen-lockfile && pnpm test && pnpm build`
- El harness da ogs 38 OK y cSlope 38/38; `bench/run_all.sh` sale con exit 0

## Cierre
- Commits pequeños en tu rama con rutas explícitas. Sin push.
- **Resumen:** por enmienda, sus tests; tabla de aceptación con los FS cambiados; totales del harness; tabla del bench;
  hashes.
- **Presupuesto:** ~60 iteraciones.
