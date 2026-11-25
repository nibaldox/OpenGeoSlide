# Brief F1-B: ola B del motor (escritores Sonnet)

Responde en **español neutro, sin voseo**. Lee completos `briefs/01_CONTRATOS_FASE1.md` (normativo),
`briefs/00_CONTRATOS.md` y tu sección.

## Reglas comunes
- Trabaja solo en tu worktree, tu rama y tus archivos.
- Commits pequeños con rutas explícitas. Nunca hagas push.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.
- **Python:** todo comando Python o uv (oráculo, harness, batería, pytest) va con el prefijo `env -u PYTHONPATH -u
  PYTHONHOME`, porque el terminal hereda un PYTHONPATH de Python 3.14 que rompe numpy.
- **Oráculo:** `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/oracle-venv/bin/python` y
  `verification/harness/to_cslope.py`, que ya mapea sismo y cargas.
- **Si un criterio no se cumple, detente y reporta con números.** No toques tolerancias ni valores publicados.
- **Resumen final:** cada criterio con su test y su resultado real, los gates con su salida real y los hashes.

## Gates
- `cargo fmt --all --check`
- `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`
- `cargo test -p ogs-core --release --no-fail-fast` y `--features parallel`
- Aceptación con `--nocapture`, leyendo toda la tabla.
- Harness:
  ```
  env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely python verification/harness/run.py --cases verification/cases --ogs target/release/ogs --out <dir>
  ```
- Batería diferencial (`verification/differential/run.py`).
- pytest:
  ```
  env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with jsonschema --with pytest python -m pytest -q verification
  ```

---

## B1: selección de raíz de Spencer, E12e (`opengeoslide-wt/f1b1`, rama `f1b1-raiz-menor-f`)

1. Implementa F1.6 en `crates/ogs-core/src/methods/spencer.rs`:
   - barrido completo y Brent en cada cambio de signo;
   - se elige la raíz admisible de menor F, y si hay empate gana la de menor |λ|;
   - nota `multiple_admissible_roots`;
   - se mantienen `negative_lambda`, `no_lambda_root` y `no_admissible_root`.
2. **Tests** en un archivo nuevo, `crates/ogs-core/tests/spencer_root_selection.rs`:
   - **R4-01 caso (1):** perfil `[[0,0],[0,10],[10,10],[30,25],[60,25],[60,0]]`, corte y = 20.
     - Techo: c = 40, φ = 0, γ = 20. Base: c = 10, φ = 30, γ = 20, ru = 0,3.
     - Círculo (10, 36, 27) y 50 dovelas.
     - Esperado: Spencer ≈ 1,1341 (cSlope 1,133838, ≤ 0,1 %), con la nota `multiple_admissible_roots`.
   - **R4-01 caso (2):** corte y = 14.
     - Techo: c = 50, φ = 0, γ = 22. Base: c = 2, φ = 45, γ = 20, ru = 0,5.
     - Círculo (16, 36, 26).
     - Esperado: la raíz de menor F, ≈ 1,1325.
   - **Regresiones:** R3-01a (≈ 1,5974), R3-01b, D03 en búsqueda ≤ 1 % frente a cSlope, r1_01, y los casos de
     `regression_r3_methods.rs` y `spencer_gle.rs`.
   - **Propiedad:** en ningún caso de los tests la F elegida supera la F de otra raíz admisible.
3. **Ajustes autorizados** en `acceptance.rs` y `validation.rs`: agregar `multiple_admissible_roots` a las listas
   informativas (una línea en cada uno). Ajusta también las expectativas de tests existentes que cambien **solo**
   porque ahora se elige la raíz de menor F, justificando cada cambio con los valores antes y después.
4. **Rendimiento:** `ogs bench verification/cases/V047a.json --method spencer`, 5 repeticiones antes y después.
   Objetivo ≤ 1,8× (F1.6). Si se supera, propón y aplica una optimización que no cambie los resultados.
5. **Web:** agrega `multiple_admissible_roots` a `apps/web/src/engine/warnings.ts` como **nota**, con el texto «Spencer
   tiene varias soluciones de equilibrio admisibles; se reporta la de menor factor de seguridad». El coordinador agrega
   el código a la lista del contrato al integrar. El test de la lista E6 fallará en tu rama: repórtalo, no lo
   «arregles» editando el contrato.

**Archivos tuyos:**
- `crates/ogs-core/src/methods/spencer.rs`;
- `crates/ogs-core/tests/spencer_root_selection.rs`;
- `crates/ogs-core/tests/{acceptance.rs,validation.rs,regression_r3_methods.rs,spencer_gle.rs,methods.rs}`, solo en lo
  autorizado;
- `apps/web/src/engine/warnings.ts`.

## B2: verificación v0.2 y esquema (`opengeoslide-wt/f1b2`, rama `f1b2-verificacion-v02`)

1. **Promoción de casos:**
   - mueve los 5 casos de `verification/pending/` (V102a, V102b, V097a, V081a, V081b) a `verification/cases/`, con
     el importador (`verification/tools/import_cslope.py`) o con `git mv`, según convenga;
   - actualiza `verification/cases/INDEX.md` y deja `verification/pending/INDEX.md` con lo excluido y su motivo;
   - actualiza `NOTICE` con la atribución a cSlope.
   - **Objetivo:** aceptación 51/51 checks en 21 casos, y harness con cSlope reproduciendo 51/51.
2. **Esquema JSON:** crea `schema/ogs-0.2.schema.json` con `loads` y `analysis.seismic` (F1.1) y deja `ogs-0.1` como
   está.
   - Tests en `verification/tools/` (o donde ya se pruebe el esquema): los 21 casos validan; los modelos con
     `version: "0.1"` y campos nuevos fallan.
3. **Batería diferencial con sismo y cargas:** agrega 4 casos nuevos en `verification/differential/cases/`:
   - D11: rajo de 3 bancos con kh = 0,15;
   - D12: botadero con `udl` de 50 kPa en la corona y kv = −0,05;
   - D13: talud civil con una carga lineal de 100 kN/m a 15°;
   - D14: presa o terraplén con kh = 0,1 y piezométrica.

   Cada uno se corre en búsqueda y en superficie fija, con Bishop y Spencer. **Objetivo:** 28/28 + 28/28. Si un caso
   falla frente a cSlope, analízalo con la receta de diagnóstico de la batería (superficie crítica del oráculo como
   superficie fija) y repórtalo; no lo quites.
4. **Documentación:**
   - `verification/harness/README.md`: tabla de correspondencias de sismo y cargas;
   - `README.md`: actualiza la sección de verificación (casos, checks y batería) y documenta el esquema v0.2 con un
     ejemplo de sismo y cargas;
   - `crates/ogs-py/README.md`, si existe: un ejemplo con sismo.

**Archivos tuyos:**
- `verification/cases/**`, `verification/pending/**`, `verification/tools/**`, `verification/differential/**`;
- `verification/harness/README.md`;
- `schema/**`;
- `NOTICE`, `README.md` y `crates/ogs-py/README.md`.

**No toques** código Rust.
