# Brief W11: cierre de los hallazgos baratos de R4 y documentación del cierre de la Fase 0

Responde en español neutro, sin voseo.

**Lee primero:**
- `briefs/00_CONTRATOS.md`: §4.1.9, sobre todo **E11e′**, y §4.3 (E11a′);
- `docs/reviews/R4_agy.md`: veredicto APROBADO_CON_RESERVAS y hallazgos R4-01 … R4-06.

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/w11` (rama `w11-cierre-r4`, desde `main`).

## Arbitraje del coordinador
- **Se corrigen ahora:**
  - **R4-04 y R4-03b**, con E11e′. Reproducido: D09 en búsqueda con Spencer emite hoy `truncated_driving_mass`, que es
    un falso positivo;
  - **R4-05**;
  - **R4-06**;
  - **el registro de avisos en la batería diferencial**, parte de R4-04.
- **Pasan a la Fase 1, sin cambios de código:** R4-01, R4-02, R4-03a y la búsqueda con restricción de frontera de
  E11d′. Solo se documentan.
  - R4-01 reproducido: fijo, Spencer 1,173171 frente a cSlope 1,133838, +3,47 %, con avisos
    `negative_lambda` y `negative_effective_normal_major`; búsqueda, 1,07005 frente a 1,050115, +1,9 %.

## Tareas
1. **E11e′** (`crates/ogs-core/src/slicer.rs`, función `discards_driving` o equivalente):
   - un bloque descartado es motriz si `Σ W sin α > 1e-3·Σ W` del propio bloque **y** no toca `x_min`/`x_max`;
   - si toca una pared lateral, se emite la nota `truncated_mass`.
   - Tests nuevos en `crates/ogs-core/tests/regression_r4.rs`, con los datos exactos de `R4_agy.md`:
     - D09 en búsqueda, Bishop y Spencer: sin `truncated_driving_mass`;
     - R4-03b (banco de 70 m con banco inferior de 10 m, círculo fijo (105, 105, 102)): `truncated_driving_mass`;
     - R3-03c, rajo fijo (53; 46,5; 45): sigue emitiendo `truncated_driving_mass`.
   - **Ajuste autorizado:** solo las expectativas de `regression_r2.rs`/`regression_r3_geometry.rs` que dependan del
     umbral viejo, justificando cada una en el resumen.
2. **R4-05** (`apps/web/src/engine/warnings.ts`):
   - `negative_lambda` pasa a severidad de **nota** (informativa, igual que en `acceptance.rs`);
   - texto: "Spencer seleccionó la raíz admisible de menor |λ|, que es negativa; revise el resultado".
3. **R4-06** (`apps/web/src/App.tsx`): `runCheck`/resultado solo usa `fos` si `status === 'converged'`. Agrega un test
   en el archivo de tests correspondiente de la web.
4. **`verification/differential/run.py`:**
   - guarda `ogs["warnings"]` en `report.json`;
   - en `REPORT.md`, agrega la columna "avisos ogs (no informativos)". Los informativos son: `negative_effective_normal`,
     `truncated_mass` y `negative_lambda`.
   - Test en `test_differential.py`. Regenera `REPORT.md` y `report.json`.
5. **`README.md`:**
   - sección "Limitaciones conocidas (Fase 0)" con R4-01, R4-02, R4-03a, la frontera de `min_width` de E11d′ y la falta
     de cobertura de `unit_weight_sat`, cada una en una línea con su síntoma y el aviso que lo acompaña;
   - enlace a `docs/reviews/R4_agy.md`.

## Archivos que te pertenecen
- `crates/ogs-core/src/slicer.rs` (solo E11e′);
- `crates/ogs-core/tests/regression_r4.rs`, nuevo, más los ajustes autorizados de expectativas;
- `apps/web/src/engine/warnings.ts`, `apps/web/src/App.tsx` y sus tests;
- `verification/differential/**`;
- `README.md`.

## Gates
- `cargo fmt --all --check` y `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`
- `cargo test -p ogs-core --release --no-fail-fast` y `--features parallel`
- Aceptación 38/38
- Batería diferencial 20/20 + 20/20
- `cd apps/web && pnpm test && pnpm build`
- pytest:
  ```
  uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with jsonschema --with pytest python -m pytest -q verification
  ```

## Cierre
- Commits pequeños con rutas explícitas. Sin push.
- **Resumen:** gates con salida real, valores antes/después y hashes.
- **Presupuesto:** ~40 iteraciones.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. No uses el puerto 5180.
