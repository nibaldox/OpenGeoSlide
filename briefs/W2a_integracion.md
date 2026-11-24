# Brief W2a: integración y gate de aceptación (38/38)

**Lee primero:** `briefs/00_CONTRATOS.md` completo. Atiende en especial a las enmiendas **E1b** (§1), **E2** (§4.1.2 y
§4.1.8) y **E3** (§4.2 y §4.3), todas nuevas. Responde en español.

## Contexto (medido por el coordinador sobre `main` en `df21e03`)
`cargo test -p ogs-core --release --test acceptance -- --nocapture` → **32/38 OK**. Las **10 comprobaciones de superficie
fija pasan con error ≤ 0,40 %**, así que el slicer y los métodos están bien. Fallan:

1. **V019** (4 checks de búsqueda): ogs da 1,4325 (Bishop 1,4365); cSlope obtiene 1,399 con su búsqueda circular.
   - La superficie crítica de cSlope (en el marco espejado, xc = 46 − 38,29 = 7,71; yc = 24,30; r = 14,48) sale por la
     cota del pie a la izquierda de x = 10, **asoma** una franja mínima sobre el terreno cerca de (10, 10) y reentra
     bajo la cara.
   - La regla vieja `AboveGround` la rechazaba y dejaba un "muro" en el espacio de búsqueda justo en el pie.
   - Con grilla densa (80³), ogs llega a 1,418.
   - **E2** cambia esa regla.
2. **V063** (2 checks):
   - Presa simétrica (ambos extremos a cota 7,3) con `entry == exit = [101.7, 185.6]`. La dirección `auto` quedaba
     empatada y elegía `right_to_left`.
   - Con el sentido equivocado, Bishop devolvió un **FS = 2,3e16 marcado como `Converged`**: es un bug de robustez
     (**E3**) y Spencer no encontró superficie.
   - La masa realmente se mueve hacia +x: en cSlope, con orientación ltr, da 2,4528, y su círculo crítico, de centro
     aproximado (154,2; 76,7) y r 69,4, está sobre la cara derecha.

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/w2a` (rama `w2a-integracion`, desde `main`).

## Archivos que te pertenecen
- `crates/ogs-core/src/**` (incluidos `geometry.rs`, `slicer.rs`, `methods/**` y `search.rs`) y `crates/ogs-core/tests/**`
- `verification/tools/import_cslope.py`, `verification/cases/**`
- `verification/REPORT.md` y `verification/report.json` (nuevos, generados por el harness)

**No toques:** `apps/**`, `crates/ogs-cli/**`, `crates/ogs-wasm/**`, `crates/ogs-py/**`, `bench/**`, `briefs/**`, `docs/**`
y `verification/harness/**`. Otro agente trabaja en paralelo en web y CLI.

## Tareas
1. **E1b** en `PreparedModel::new` + test: un modelo simétrico con `entry == exit` → se pasa a las reglas 2-4 →
   `InvalidModel` si no hay otra pista.
2. **V063:**
   - en `import_cslope.py`, una tabla `DIRECTION_OVERRIDES = {"V063": "left_to_right"}` con un comentario que cite la
     evidencia (el círculo crítico de cSlope sobre la cara derecha y que la orientación ltr reproduce 2,4528);
   - regenera los casos;
   - verifica la idempotencia del script: dos corridas seguidas, con `git diff` vacío en la segunda.
3. **E2** en `slicer.rs`:
   - cruces más externos, dovelas aéreas con peso y resistencia nulos, y bordes de dovela en los cruces intermedios;
   - `AboveGround` solo en el caso degenerado;
   - actualiza los tests existentes que asumían la regla vieja y **justifica cada cambio** de test en el resumen;
   - nuevo test: un círculo que sale y reentra cerca del pie es válido, las dovelas aéreas tienen `weight = 0` y la
     suma de pesos coincide con el área real de suelo dentro del círculo (integración independiente, < 1e-3 relativo
     con n = 2000).
4. **E3** en `methods/` (`"no_driving"`) + test: dovelas con `Σ W sin α` ≈ 0 → `Invalid` en Bishop y en Spencer.
   Las dovelas aéreas no deben disparar `m_alpha`.
5. **Gate de aceptación:**
   - `cargo test -p ogs-core --release --test acceptance -- --nocapture` debe dar **38/38**;
   - si V019 sigue fallando por la búsqueda, mejora `search.rs` de forma general (no específica del caso): por ejemplo,
     más semillas de refinamiento, o un reinicio del refinamiento con los rangos completos. Respeta el determinismo
     serial = parallel y los tests existentes;
   - **prohibido** cambiar tolerancias, valores publicados o la grilla por defecto de un caso concreto para que pase.
6. **Harness:**
   ```
   cargo build --release -p ogs-cli
   uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely python verification/harness/run.py --cases verification/cases --ogs target/release/ogs --out verification
   ```
   Debe generar `verification/REPORT.md` y `report.json` con la columna ogs llena.

## Gates (salida real)
- `cargo fmt --all --check`
- `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`
- `cargo test -p ogs-core` (todo) y `cargo test -p ogs-core --features parallel`
- Aceptación 38/38 (copia la tabla completa en el resumen)
- Harness con exit 0: totales de ogs y de cSlope

## Cierre
- Commits pequeños en tu rama (uno por enmienda y uno por casos y reporte), con rutas explícitas. Sin push.
- **Resumen:** tabla de aceptación, tests modificados con su justificación, cambios en la búsqueda (si los hubo),
  totales del harness y hashes.
- **Presupuesto:** ~60 iteraciones.
