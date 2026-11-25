# Brief W10: ola correctiva tras la revisión R3 (Antigravity)

**Lee primero:**
- `briefs/00_CONTRATOS.md`: §4.3 completo (bloque "Vigente" al inicio, E11a, E11b, E11c, E11f), §4.1.9 (E11d, E11e) y
  §4.5 (lista de códigos E6/E11g);
- `docs/reviews/R3_agy.md`: revisión con contraejemplos exactos;
- `verification/differential/REPORT.md`.

Responde en español.

## Arbitraje del coordinador
Se aceptan los 8 hallazgos, todos con su severidad original. Reproduje con el binario R3-01a (Spencer 1,51777 con
λ = −0,371 frente a cSlope 1,59739) y R3-03a1 (botadero con `min_width = 10`: ogs 0,8556 frente a cSlope 1,1424).

**Regla común:**
- cada contraejemplo de R3 entra como **test de regresión**, con los datos exactos de `R3_agy.md`;
- se mantienen la aceptación **38/38** y la batería diferencial **20/20 + 20/20**. Si E11b u otra enmienda rompe algo,
  **detente y reporta** con números;
- **prohibido** tocar tolerancias, casos o valores publicados.

---

## W10a: solver de Spencer y clasificación de N' (`opengeoslide-wt/w10a`, rama `w10a-spencer`)
**Archivos:** `crates/ogs-core/src/methods/**`, `crates/ogs-core/tests/{methods.rs,spencer_gle.rs}` y uno nuevo,
`crates/ogs-core/tests/regression_r3_methods.rs`.

1. **E11a:**
   - residuo sin divisor `r(λ) = Σ b(Eᵢ + Eᵢ₋₁)(tan αᵢ − λ)`;
   - barrido completo con paso 0,05 en [−0,5; 1,5] y Brent en **todos** los cambios de signo;
   - selección por el λ ≥ 0 más pequeño admisible; si no hay, el λ < 0 más cercano a 0 con el aviso `negative_lambda`;
   - códigos `no_admissible_root` y `no_lambda_root`.
   - Tests:
     - R3-01a: Spencer ≈ 1,5974 (cSlope 1,597387, λ ≈ +0,402);
     - R3-01b, trampa de asíntota: converge a F ≈ 0,268487 con λ ≈ +0,766.
2. **E11b:** admisibilidad `Φᵢ/F ≥ min_m_alpha` y `m_α(F) ≥ min_m_alpha`.
   - Tests de R3-02:
     - (1) ya no devuelve 0,357 `Converged`; queda `NotConverged` o un valor admisible cercano a cSlope (0,1073);
     - (2) ya no devuelve 0,245 (Spencer −27 % bajo Bishop).
   - `r1_01` sigue en verde, con su semántica.
3. **E11c:** `tol_r = min(1e-3·tolerance, MOMENT_ACCEPT)`. Test R3-04: D01 y D06 en superficie fija con
   `tolerance = 0.01` → `Converged` y FS dentro de 1e-3 del valor con `1e-5`.
4. **E11f:** criterio compuesto de `negative_effective_normal_major`.
   - Tests con los 3 contraejemplos de R3-06 → `major`;
   - V002, V003 y V101 deben seguir como nota. Verifícalo con `analyze` sobre los casos de `verification/cases` y
     reporta f y la fracción de base de cada uno.
5. **Rendimiento:** `ogs bench verification/cases/V047a.json --method spencer` antes y después. Objetivo: ≤ 1,5× el
   actual, que está en ~93-109 ms. Si el barrido completo lo supera, propón una optimización (p. ej., cachear la
   rebanada o empezar por la evaluación de r sin Brent) y aplícala si mantiene los resultados.

## W10b: slicer, búsqueda y herramientas (`opengeoslide-wt/w10b`, rama `w10b-bloque-busqueda`)
**Archivos:**
- `crates/ogs-core/src/{slicer.rs,lib.rs,geometry.rs,search.rs}`, `crates/ogs-core/tests/{slicer_geometry.rs,search.rs,validation.rs,acceptance.rs}`
  y uno nuevo, `crates/ogs-core/tests/regression_r3_geometry.rs`;
- en `acceptance.rs` **no** se cambia `INFORMATIVE_WARNINGS`: `truncated_driving_mass` es un aviso, no una nota;
- `apps/web/src/engine/warnings.ts` y su test: códigos nuevos (`truncated_driving_mass`, `no_lambda_root`,
  `no_admissible_root`, `negative_lambda`) y retiro de `m_alpha_pole`, `lambda_undefined` y `fos_nonpositive`, de
  acuerdo con E6/E11g;
- `verification/harness/run.py` y su test (R3-05 (2): leer `warnings` en lugar de `message`);
- `verification/tools/import_cslope.py` (R3-08) y su test.

1. **E11d:**
   - re-rebanado del bloque conservado con n dovelas y quiebres; mínimo 3 dovelas de suelo;
   - en `lib.rs`, el evaluador de la búsqueda verifica `min_width` y los rangos `entry`/`exit` sobre los extremos
     efectivos;
   - tests R3-03a1 (botadero con `min_width = 10` → Bishop ≈ 1,1423 y Spencer ≈ 1,1478, con ≤ 1 % frente a cSlope) y
     R3-03a2 (pared de rajo de 2 bancos con `entry = [0, 12]`, `exit = [24, 45]`: datos en `R3_agy.md`).
2. **E11e:** aviso `truncated_driving_mass` si un bloque descartado es motriz. Test con el ejemplo de bermas o valle de
   R3-03c (está en `R3_agy.md`; si el texto aparece truncado, construye un caso equivalente: un talud con berma cuyo
   bloque inferior tenga α > 0).
3. **R3-07:** la regla 3 de `auto` en `resolve_sliding` usa el tramo de deslizamiento sin validar los extremos del
   bloque, o se documenta. Test: el valle simétrico de R3-07 con `auto` debe resolver la dirección o dar un error
   explicado, sin `InvalidModel` espurio.
4. **R3-05 (2) y R3-08:** `run.py` y el schema del importador.
5. Regenera `verification/differential/REPORT.md` con tu binario y reporta n/N.

## Gates (ambos)
- `cargo fmt --all --check` y `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`
- `cargo test -p ogs-core --release --no-fail-fast` y `--features parallel`
- Aceptación 38/38
- Batería diferencial:
  ```
  uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely python verification/differential/run.py --ogs target/release/ogs --out $TMPDIR/<rama>-diff
  ```
- W10b, además: `cd apps/web && pnpm install --frozen-lockfile && pnpm test && pnpm build` y `pytest verification/harness verification/tools`

## Cierre
- Commits pequeños con rutas explícitas. Sin push.
- **Resumen:** por hallazgo, su test y los valores antes/después, gates, n/N de la batería y hashes.
- **Presupuesto:** ~60 iteraciones cada uno.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. No uses el puerto 5180.
