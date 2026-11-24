# Brief W3: ola correctiva tras la revisión adversarial R1 (Antigravity)

**Lee primero:**
- `briefs/00_CONTRATOS.md`, en especial las **enmiendas E4a-E4f** (§4.2, §4.3 y la nueva §4.5);
- `docs/reviews/R1_agy.md`, la revisión completa con sus contraejemplos.

Responde en español.

## Arbitraje del coordinador
Reproduje en el binario los hallazgos R1-01, 02, 03a/b, 05, 08 y 09; todos se confirman.

| ID | Severidad final | Dueño |
|---|---|---|
| R1-01, R1-02, R1-03, R1-07, E4e | CRITICAL / HIGH / HIGH / MEDIUM / nuevo | **W3a** |
| R1-05, R1-08, R1-09, R1-10, R1-12, R1-13 | HIGH / MEDIUM / MEDIUM / MEDIUM / LOW / LOW | **W3b** |
| R1-04 (bajado a MEDIUM: un NaN no puede entrar por JSON), R1-06, R1-11 | MEDIUM / MEDIUM / LOW | **W3c** |

**Regla común:**
- cada contraejemplo de la revisión entra como **test de regresión** que hoy falla y que, después del cambio, pasa;
- la aceptación debe seguir en **38/38** (`cargo test -p ogs-core --release --test acceptance`);
- **prohibido** tocar tolerancias, valores publicados o casos.

---

## W3a: métodos (worktree `opengeoslide-wt/w3a`, rama `w3a-metodos`)
**Archivos:** `crates/ogs-core/src/methods/**` y `crates/ogs-core/tests/methods.rs`. Nada más.

1. **E4a, Bishop:**
   - F₀ desde Fellenius;
   - solo los polos abortan durante las iteraciones;
   - `min_m_alpha` se verifica sobre el F convergido.
   - Tests:
     - R1-03a: superficie con `m_α(F) = 0,19999` → `Invalid("m_alpha")`;
     - R1-03b: la superficie con F ≈ 6,545 converge.
   - Reproduce ambas con dovelas sintéticas equivalentes, o con los datos exactos de la revisión mediante una rutina
     de dovelas propia del test.
2. **E4b, Spencer:** admisibilidad `Φᵢ/F ≥ min_m_alpha` al converger, con polos y `F ≤ 0` en las iteraciones.
   - Test R1-01: dovelas con D < 0 en el pie → `Invalid`, nunca `Converged` con un FS menor que el de Bishop.
3. **E4c:** las dovelas aéreas se excluyen de λ.
   - Test R1-02, evidencia 1: con la dovela aérea a 80°, λ queda en el rango de las dovelas de suelo y es **igual** al
     λ del mismo conjunto sin la dovela aérea, dentro de 1e-9.
4. **E4d:** recálculo de F con el λ final antes de declarar `Converged`.
5. **E4e:** cálculo de N' y aviso `"negative_effective_normal"`. Test: la fórmula de Spencer con ΔX = 0 es idéntica a
   la de Bishop, y un caso con u alto emite el aviso.
6. Los tests existentes deben seguir en verde. Si alguno cambia, justifícalo.

## W3b: validación, reporte y búsqueda (worktree `opengeoslide-wt/w3b`, rama `w3b-validacion`)
**Archivos:**
- `crates/ogs-core/src/{lib.rs,model.rs,report.rs,search.rs}` y `crates/ogs-core/tests/{acceptance.rs,search.rs}`;
- un test nuevo `crates/ogs-core/tests/validation.rs`;
- adaptaciones mínimas de compilación en `crates/ogs-cli/src/**`, `crates/ogs-wasm/src/**` y `crates/ogs-py/**`, solo si
  el cambio a `fos: Option<f64>` lo exige;
- `apps/web/src/engine/types.ts` y `mockEngine.ts`, solo si hace falta (ya usan `number | null`).

1. **E4f, entrada:**
   - `deny_unknown_fields` en todos los structs de `model.rs`; cuida la compatibilidad con el struct de transporte de
     `SearchSpec` y su tag `type`;
   - validación de `format`, `version` y parámetros de `analysis` en `analyze`, con mensajes en español.
   - **Ojo:** verifica que los 16 casos, `examples/acads1a.ogs.json`, el modelo de ejemplo de la web
     (`apps/web/src/examples/acads1a.json`) y el fixture del harness sigan deserializando. Si alguno trae campos extra,
     **repórtalo** en vez de relajar la regla.
   - Test R1-05: el JSON de la revisión → `InvalidModel`; `methods: []` → `InvalidModel`.
2. **Reporte:**
   - `MethodReport.fos: Option<f64>`;
   - `NoValidSurface(String)` con el motivo;
   - en superficie fija, un método `Invalid` o `NotConverged` se reporta con su estado y no como error. Test R1-09.
3. **Aviso de agua:** con tolerancia, solo dovelas de suelo, extremos y punto medio. Test: V003 **sin** el aviso.
4. **Búsqueda (R1-10):**
   - `checked_mul`, o el límite de producto ya validado;
   - `explore` salta los ejes con paso 0;
   - mantén el determinismo serial = parallel.
5. **Aceptación (R1-12):**
   - `deny_unknown_fields` en `Case`, `Check` y `CheckOptions`;
   - el test falla si un check produce un warning **no esperado**. Opcionalmente, un campo
     `expected_warnings: []` en el check; si lo agregas, documéntalo en la sección de casos del README.
6. **R1-13:** actualizar el doc de cabecera de `lib.rs`.

## W3c: geometría (worktree `opengeoslide-wt/w3c`, rama `w3c-geometria`)
**Archivos:** `crates/ogs-core/src/{geometry.rs,slicer.rs}` y `crates/ogs-core/tests/slicer_geometry.rs`. Nada más.

1. **R1-04:** `piezometric_y` robusta frente a NaN e ±∞, con test.
2. **R1-06:** círculos con cruce externo exactamente en `x_min` o `x_max` son válidos si el arco no sale bajo el terreno.
   - Test con el círculo de la revisión en ACADS 1(a): entra en (50, 35), sale en (20, 25), r = 30,
     xc = 26.937742, yc = 54.186773.
   - **Además**, con un test de grilla, comprueba que los extremos de `grid_axis` dejan de desperdiciarse
     (que esos círculos produzcan dovelas).
3. **R1-11:** el modelo debe tener ancho y alto finitos y > 0; los polígonos degenerados (área ≈ 0) se rechazan con
   `InvalidModel`. Tests.

---

## Gates (cada subagente, en su worktree)
- `cargo fmt --all --check`
- `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`
- `cargo test -p ogs-core` y `cargo test -p ogs-core --features parallel`
- Aceptación 38/38 con `--release`

## Cierre
- Commits pequeños en tu rama, con rutas explícitas. Sin push.
- **Resumen:** cada hallazgo R1-xx de tu bloque con su test (nombre), el valor antes/después cuando aplique, los gates y
  los hashes.
- **Presupuesto:** ~50 iteraciones.
