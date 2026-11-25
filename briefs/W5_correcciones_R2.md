# Brief W5: ola correctiva tras la revisión R2 (Antigravity)

**Lee primero:**
- `briefs/00_CONTRATOS.md`, en especial las **enmiendas E7a-E7d** (§4.2 y §4.3), la lista de códigos de E6 y §5;
- `docs/reviews/R2_agy.md`, la revisión completa con sus contraejemplos.

Responde en español.

## Arbitraje del coordinador
Reproduje con el binario los hallazgos R2-01, R2-02a/b y R2-03 (fijo y búsqueda); todos se confirman.

| ID | Severidad final | Decisión | Dueño |
|---|---|---|---|
| R2-01 | HIGH | **E7a**: se deroga E4c y las dovelas aéreas vuelven a λ como cuerpos sin masa; aviso `air_gap_thrust`. R2 tiene razón: la corrección de R1-02 rompía el equilibrio global | W5a |
| R2-02 | HIGH | **E7b**: intervalo admisible de F y búsqueda acotada de la raíz | W5a |
| R2-03 | MEDIUM → **HIGH** (en minería, la presión de poros alta es el caso típico; Spencer quedaba 21 % sobre Bishop en búsqueda) | **E7c**: amortiguar λ y salvaguardar el lazo de F | W5a |
| R2-04 | MEDIUM | **E7d**: clasificación nota/aviso y N' directa | W5a (núcleo), W5c (web) |
| R2-05 | HIGH → **MEDIUM** (latente: ningún caso actual es imperial con agua y V063 trae la dirección explícita) | corregir | W5b |
| R2-06 | MEDIUM | panic hook en wasm y recuperación del motor web | W5c |
| R2-07 | MEDIUM | corregir el importador | W5b |
| R2-08 | LOW | corregir | W5c |
| R2-09 | LOW | (1) y (4): W5b; (2) y (3): W5c | W5b, W5c |
| R1-12(b) | abierto | buscar un caso publicado con `unit_weight_sat`; **no inventar** | W5b |

**Regla común:**
- cada contraejemplo de R2 entra como **test de regresión**;
- la aceptación sigue en **38/38**;
- **prohibido** tocar tolerancias, valores publicados o la lista `INFORMATIVE_WARNINGS`. Si un caso publicado dispara
  `negative_effective_normal_major` o `air_gap_thrust`, **repórtalo** con los números; el coordinador decide.

---

## W5a: métodos (`opengeoslide-wt/w5a`, rama `w5a-metodos`)
**Archivos:** `crates/ogs-core/src/methods/**` y `crates/ogs-core/tests/methods.rs`.
Puedes **agregar** `crates/ogs-core/tests/regression_r2.rs` para los casos con geometría real del slicer, usando la API
pública `analyze` con modelos JSON. Nada más.

1. **E7a:**
   - revierte la exclusión aérea en `lambda_step`;
   - reemplaza `r1_02_air_slice_is_excluded_from_lambda` por un test de **equilibrio global de momentos**: el residuo
     calculado de forma independiente es < 1e-6·momento motor, también con dovelas aéreas;
   - agrega el test de §5 con el caso R2-01 (φ = 0, muesca, n = 50 y n = 500): Spencer → Bishop;
   - aviso `air_gap_thrust`.
2. **E7b, Bishop:** `F_adm`, punto fijo desde `max(F_ord, 1.05·F_adm, 0.1)` y Brent o bisección de respaldo.
   - Tests R2-02a (FS ≈ 1,394117) y R2-02b (FS ≈ 1,936086); ambos `Converged` con `min m_α ≥ 0,2`.
   - R1-03a y R1-03b siguen en verde. **Ojo:** la revisión dice que R1-03a ahora aborta por `m_alpha_pole`; con E7b
     debe dar `Invalid("m_alpha")` solo si la raíz real viola `min_m_alpha`. Verifica cuál es la raíz real y documéntalo.
3. **E7c, Spencer:**
   - test R2-03 fijo: FS ≈ 0,623919 y λ ≈ 0,540962, `Converged`;
   - test R2-03 en búsqueda (talud `[[0,0],[0,15],[15,15],[30,25],[60,25],[60,0]]`, c = 2, φ = 45°, ru = 0,65): el FS
     crítico de Spencer queda a **≤ 5 %** del de Bishop (hoy está 21 % arriba).
4. **E7d:** clasificación por `f` y N' directa en Spencer.
   - Test con el caso de subpresión de R2-04 (ru = 0,95) → `negative_effective_normal_major`.
   - Test: la N' directa coincide con la de E4e (< 1e-9 relativo) en dovelas sin polo.
5. Corre la aceptación y reporta los FS que cambien. E7a puede mover V019 y V047a; deben seguir dentro de tolerancia.

## W5b: herramientas de verificación (`opengeoslide-wt/w5b`, rama `w5b-verificacion`)
**Archivos:** `verification/harness/**`, `verification/tools/**`, `verification/cases/**` (solo si el importador genera
algo distinto o hay un caso nuevo) y `verification/cases/INDEX.md`.

1. **R2-05:**
   - `to_cslope.resolve_direction` implementa las 4 reglas de E1/E1b, con `UnsupportedModel` cuando no se puede decidir;
   - `UnsupportedModel` si hay `piezometric_line` y |γw − 9.807| > 0.01, porque cSlope 0.1.0 ignora `waterUnitWeight`;
   - la nota de unidades usa la unidad correcta;
   - tests con una presa simétrica + rangos, y con un modelo imperial con agua.
2. **R2-07:** el importador valida x estrictamente creciente en la piezométrica; detecta agua sobre el terreno también
   en los puntos medios y en los escalones; `MODEL_SCHEMA` sincronizado con §4.5; `options.tolerance` del check se
   registra en `source.notes`. Re-ejecútalo: los casos deben quedar idénticos o con diferencias justificadas.
3. **R2-09 (1) y (4):** `run.py` lee `status` antes de `fos`; `elif` → `if` en `to_cslope.py`.
4. **R1-12(b):** revisa los problemas de cSlope **no seleccionados** que usan un peso unitario saturado (busca en
   `problems.ts` y en `verification.json` el campo real, p. ej. `saturatedUnitWeight`). Si alguno es convertible bajo
   las reglas actuales, agrégalo. Si ninguno lo es, documéntalo en `INDEX.md` con los motivos. **No inventes valores.**
5. `pytest` del harness en verde. `run.py` con el binario de `main`: ogs y cSlope reproducen lo mismo que antes.

## W5c: bindings y web (`opengeoslide-wt/w5c`, rama `w5c-bindings-web`)
**Archivos:** `crates/ogs-wasm/**`, `crates/ogs-py/**` y `apps/web/**`.

1. **R2-06:**
   - panic hook en `ogs-wasm` sin dependencias pesadas: `std::panic::set_hook` + un `extern "C"` de `console.error`
     vía wasm-bindgen, instalado con `Once` en la primera llamada;
   - `wasmEngine.ts` detecta `WebAssembly.RuntimeError` o errores que no son cadenas, reinicia la instancia y reporta
     un error fatal diferenciable;
   - test en Vitest con un módulo falso que lanza `RuntimeError`.
2. **R2-08:** `json.dumps(model, allow_nan=False)` con un `ValueError` claro; `_panic_for_tests` solo bajo un feature
   cargo `test-hooks`, y los tests de pánico se compilan y corren con ese feature (documéntalo en el README de ogs-py).
3. **R2-09 (2) y (3):** corregir el comentario de `types.ts`; `ResultsTable` asocia cada aviso a su método.
4. **Catálogo `warnings.ts`:**
   - `negative_effective_normal_major` (aviso): "Normal efectiva negativa en una parte importante de la base
     (tracción o subpresión): revise la presión de poros y considere grietas de tracción";
   - `air_gap_thrust` (aviso): "La superficie transmite empuje a través de un tramo sin suelo; revise la geometría";
   - test de que **todos** los códigos de la lista E6 tienen una entrada.
5. Gates: `pnpm test`, `pnpm build`, `cargo check -p ogs-wasm --target wasm32-unknown-unknown` y el wheel de ogs-py
   con pytest en 3.13 (con y sin el feature `test-hooks`, según corresponda).

---

## Gates comunes
- `cargo fmt --all --check` y `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`
- `cargo test -p ogs-core --release`, con la aceptación en 38/38

## Cierre
- Commits pequeños en tu rama, con rutas explícitas. Sin push.
- **Resumen:** por hallazgo, el test y los valores antes/después; los gates y los hashes.
- **Presupuesto:** ~60 iteraciones (W5a) y ~45 (W5b, W5c).
