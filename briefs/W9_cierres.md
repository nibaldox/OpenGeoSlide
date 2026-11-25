# Brief W9: cierres antes de R3

Responde en español. Lee primero `briefs/00_CONTRATOS.md` (E8b en §4.3 y E9b en §4.4.6).

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/w9` (rama `w9-cierres`, desde `main@4b96459`).

## Tareas
1. **`verification/differential/run.py`:** si **ambos** motores declaran la superficie fija sin solución (ogs
   `not_converged`/`invalid` y cSlope con `EngineError` o sin superficie válida), el veredicto es
   `OK (concordancia: ambos sin solución)`. Si solo uno de los dos no tiene solución, sigue siendo `FALLA`.
   - Test en `verification/differential/test_differential.py`.
   - Regenera `verification/differential/REPORT.md` y `report.json` con `target/release/ogs` (compila con
     `cargo build --release -p ogs-cli`). Se espera búsqueda 20/20 y fija 20/20.
2. **`crates/ogs-core/tests/methods.rs`:** reescribe `r1_01_spencer_negative_pole_is_not_converged`, hoy ignorado,
   con la semántica de E8b. Spencer **nunca** devuelve `Converged` sobre ese conjunto de dovelas si se cumple
   cualquiera de estas condiciones:
   - (a) un Φᵢ ≤ 0 en alguna dovela de suelo;
   - (b) falta de cierre (`|Eₙ| > 1e-6·ΣW`);
   - (c) un FS menor o igual que el espurio de la revisión (0,0749994 en la versión sintética).
   Si converge, verifica (a), (b) y (c) explícitamente. Cámbiale el nombre a
   `r1_01_spencer_never_converges_on_the_spurious_pole_branch` y quita el `#[ignore]`.
3. **Bench:** `bench/run_all.sh` (puerto 5181; **no toques el 5180**). Debe salir con exit 0, cumplir el gate de FS y
   regenerar `bench/RESULTS.md`.
4. **`README.md`** (raíz, en español): agrega la sección "Estado de verificación (Fase 0)" con:
   - aceptación: 38/38 checks publicados en 16 casos;
   - harness: cSlope reproduce 38/38;
   - batería diferencial: n/N de búsqueda y de superficie fija;
   - tabla breve del bench, con mediana nativo/Chrome de Bishop y Spencer;
   - enlaces a `verification/REPORT.md`, `verification/differential/REPORT.md` y `docs/reviews/`;
   - el aviso de que es software en desarrollo y de que el criterio profesional es responsabilidad del usuario.

## Archivos que te pertenecen
`verification/differential/**`, `crates/ogs-core/tests/methods.rs` (solo ese test), `bench/RESULTS.md`,
`bench/results/*.json` y `README.md`. Nada más.

## Gates
- `cargo fmt --all --check` y `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`
- `cargo test -p ogs-core --release --no-fail-fast`: debe dar 0 fallos y solo 1 ignorado (perf)
- `pytest verification/differential`:
  ```
  uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with pytest python -m pytest verification/differential -q
  ```
- `bench/run_all.sh` con exit 0

## Cierre
- Commits pequeños con rutas explícitas. Sin push.
- **Resumen:** gates, n/N de la batería, tabla del bench y hashes.
- **Presupuesto:** ~35 iteraciones.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.
