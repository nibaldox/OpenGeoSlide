# Brief W8: bloque principal (E10a) y solver GLE de Spencer (E10b)

**Lee primero:** `briefs/00_CONTRATOS.md`, en especial **E10a** (§4.1.9) y **E10b** (comienzo de §4.3), más E8b y E4e.
Lee también `verification/differential/REPORT.md`, la línea base de la batería diferencial contra cSlope. Responde en
español.

## Estado de partida (`main@HEAD`)
- Aceptación 38/38 y 96 tests en verde (3 ignorados).
- Batería diferencial: **búsqueda 17/20, fija 19/20**. Fallos:
  - **D09** (R2-03): Bishop +3,1 % y Spencer +6,6 % sobre el oráculo, porque E8a rechaza el círculo crítico del
    oráculo (lente del pie) → **E10a**;
  - **D03** Spencer (capa débil): búsqueda +32,9 %. En el círculo de pie de cSlope, ogs da 0,5572 frente a 0,5467
    (+1,9 %). En la superficie fija, ogs da `not_converged` (2,83) → robustez del solver → **E10b**;
  - **r1_07a** ignorado: hay dos raíces admisibles y la cadena de λ se pierde → **E10b**.

---

## W8a: bloque principal (`opengeoslide-wt/w8a`, rama `w8a-bloque`)
**Archivos:**
- `crates/ogs-core/src/slicer.rs` y `crates/ogs-core/src/lib.rs` (solo la traducción de `SurfaceError` y la
  propagación de `truncated_mass`)
- `crates/ogs-core/tests/{slicer_geometry.rs,regression_r2.rs,differential_r2_03.rs,acceptance.rs}`
- en `acceptance.rs`, **solo** agregar `"truncated_mass"` a `INFORMATIVE_WARNINGS` (autorizado por E10a)
- `apps/web/src/engine/warnings.ts` y su test (nota para `truncated_mass`)
- `briefs/00_CONTRATOS.md`: **solo** agregar `truncated_mass` a la lista de códigos E6, porque el test de la web la lee

1. **E10a en el slicer:**
   - bloque principal = el de mayor peso; los demás bloques y las dovelas aéreas interiores se eliminan;
   - la entrada y la salida efectivas son los extremos del bloque;
   - la dovela devuelta queda solo con suelo (más las aéreas de los extremos, si existieran);
   - el aviso `truncated_mass` se propaga como **nota**. Elige el mecanismo: un campo nuevo en el resultado del slicer
     o un `Vec<String>` de avisos del slicer que `lib.rs` agrega a `MethodReport.warnings`, sin romper firmas públicas
     o actualizándolas en el contrato si es inevitable (repórtalo);
   - elimina `SurfaceError::DisconnectedMass` y actualiza el `match` de `lib.rs`.
2. **Tests:**
   - el notch de R2-01 ahora es **válido**, se analiza solo el bloque más pesado y lleva `truncated_mass`;
   - verifica independientemente que ΣW = peso del bloque principal (integración propia);
   - **círculo del oráculo D09/R2-03** (centro 7,930327512483231; 43,43852319977387; r 29,304056275415814): Bishop en
     ese círculo fijo coincide con cSlope 0,33068 con ≤ 0,5 %;
   - reactiva `r2_03_search_is_not_above_cslope_by_more_than_1_percent` **para Bishop**. Si el de Spencer sigue fallando
     por el solver, deja la parte de Spencer ignorada con el motivo "pendiente E10b";
   - V019 sigue dentro de tolerancia; reporta su FS antes y después;
   - los tests de E2 y E8a que esperaban `DisconnectedMass` se reescriben con justificación.
3. Aceptación 38/38 y la batería diferencial con el binario de tu rama:
   ```
   uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely python verification/differential/run.py --ogs target/release/ogs --out $TMPDIR/w8a-diff
   ```
   No sobrescribas el `REPORT.md` versionado. Reporta n/N.

## W8b: solver GLE de Spencer (`opengeoslide-wt/w8b`, rama `w8b-gle`)
**Archivos:** `crates/ogs-core/src/methods/spencer.rs` (y `methods/mod.rs` si hace falta), `crates/ogs-core/tests/methods.rs`
y `crates/ogs-core/tests/spencer_gle.rs` (nuevo). **No** toques `regression_r2.rs`: si un test de ahí se rompe, repórtalo
con los números.

1. **E10b:**
   - F_m y F_f por punto fijo con X = λE;
   - barrido de λ en [−0,5; 1,5], el cambio de signo más cercano a 0 y refinamiento con Brent;
   - admisibilidad E8b y cierre de fuerzas al final;
   - conserva E4e/E7d (N' y avisos), E3 (`no_driving`) y E7a (dovelas aéreas en los extremos);
   - expón `pub fn spencer_gle_curves(slices, lambdas) -> Vec<(f64 /*λ*/, f64 /*F_m*/, f64 /*F_f*/)>` para diagnóstico
     y para la UI futura.
2. **Tests** (`spencer_gle.rs`):
   - φ = 0: F_m = Bishop exacto en todo λ;
   - el resultado coincide con la implementación anterior (Zhu) en ≤ 1e-6 relativo en los casos donde ambas convergían:
     V044, V045 y V016a (superficie fija; carga el caso desde `verification/cases` y usa la API pública);
   - **r1_07a** se recupera: FS ≈ 0,746180, λ ≈ 0,19157, o el valor que dé la raíz más cercana a 0 si es otra
     (documenta cuál y por qué);
   - D03: con el círculo de pie de cSlope fijo, Spencer **converge** y queda a ≤ 2 % de 0,5467. El modelo está en
     `verification/differential/cases/D03.ogs.json`; el círculo, en `report.json`;
   - el FS de R2-03 en superficie fija sigue en 0,623919 (o reporta la diferencia).
3. Aceptación 38/38, todos los tests en verde, y la batería diferencial con tu binario en `$TMPDIR/w8b-diff`; reporta n/N.
4. Rendimiento: `ogs bench verification/cases/V047a.json --method spencer` antes y después. Reporta la razón.

## Gates (ambos)
- `cargo fmt --all --check`, `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`
- `cargo test -p ogs-core --release --no-fail-fast` y `--features parallel`
- W8a, además: `cd apps/web && pnpm install --frozen-lockfile && pnpm test && pnpm build`

## Cierre
- Commits pequeños en tu rama con rutas explícitas. Sin push.
- **Resumen** en español, con tablas antes/después, gates y hashes.
- **Presupuesto:** ~60 iteraciones (W8b) y ~50 (W8a).
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. No uses el puerto 5180.
