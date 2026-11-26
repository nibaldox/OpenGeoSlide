# Brief F3R-R0: congelar los tipos v0.4 (un escritor Sonnet) y prototipo X17 (un explorador Sonnet), en paralelo

Responde en **español neutro, sin voseo**. El contrato normativo es `briefs/03_CONTRATOS_REFUERZOS.md`.

**Base:** la rama `f3r-integracion`, que sale de `main` en `bf1655c`, la v0.2.0.

**Reglas:**
- `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch` y Python siempre con
  `env -u PYTHONPATH -u PYTHONHOME`.
- El oráculo es `$TMPDIR/oracle-venv/bin/python`, con cslope 0.1.0. El clon de referencia está en `$TMPDIR/cslope-src`
  (MIT): se lee, no se copia.
- Commits con rutas explícitas y **sin push**.

## R0: tipos, validación, esquema y RED (worktree `f3r0`, rama `f3r0-tipos`)

**Archivos tuyos:**
- `crates/ogs-core/src/{model.rs,loads.rs,slicer.rs,report.rs}`, y un nuevo `crates/ogs-core/src/reinforcement.rs`;
- `crates/ogs-core/src/lib.rs`, **solo** para llamar al stub;
- `schema/ogs-0.4.schema.json`, que es nuevo;
- `verification/tools/test_schema.py`, solo para la tabla de acuerdo de 0.4;
- tests nuevos `crates/ogs-core/tests/f3r_*.rs`;
- `apps/web/src/engine/types.ts`;
- `apps/web/src/editor/types.ts`;
- `apps/web/src/engine/warnings.ts`, solo para los códigos nuevos;
- en `briefs/00_CONTRATOS.md`, solo la lista E6.

**Tareas:**
1. **Tipos de F4.2 en `model.rs`:**
   - `FORMAT_VERSION_V04`;
   - `enum Reinforcement`, con serde `tag = "type"`, `snake_case` y `deny_unknown_fields`, y el `enum Pullout`
     etiquetado por `model`;
   - `Model.reinforcements` con `#[serde(default, skip_serializing_if = "Vec::is_empty")]`;
   - el campo `angle` de `pile` y `sheet_pile`, obligatorio solo con `direction: "angle"`. Valídalo en el motor, no con
     serde.
2. **Validación de F4.1 y F4.2** en `loads.rs` o en `reinforcement.rs`:
   - la compuerta de versión 0.4;
   - ids únicos, rangos, longitud > 0, `x1 = x2` en `sheet_pile`, `bonded_length ≤ L` y `angle`;
   - `InvalidModel` con la **ruta JSON** del campo.
3. **`Slice`:** agrega `passive_v`, `passive_h`, `passive_h_moment_base` y `passive_driving_extra`.
   - Valen 0 sin refuerzos.
   - Llevan `#[serde(skip_serializing_if = "is_zero")]`, porque las dovelas salen en el JSON del informe y la salida
     **no debe cambiar ni un byte**.
4. **`report.rs`:** `MethodResult.reinforcement_forces: Vec<ReinforcementForce>`, con la forma de F4.9 y
   `skip_serializing_if` vacío.
5. **Stub:**
   - `reinforcement::apply_to_slices(...)`, con la firma que propongas y documentes, que hace `todo!("R1: fuerzas de
     refuerzo")`;
   - `lib.rs` lo llama **solo** si `reinforcements` no está vacío.
   - Un modelo 0.4 válido llega al stub; un modelo inválido falla en la validación.
6. **Esquema `schema/ogs-0.4.schema.json`,** derivado del 0.3, con las mismas reglas que el motor.
   - Agrega a la tabla de `test_schema.py` al menos 25 casos de aceptación y rechazo de 0.4, entre ellos tipo
     desconocido, campo desconocido, `angle` con `tangent`, `coverage` 0, una tablestaca inclinada y 0.3 con refuerzos.
   - El esquema y el motor deben coincidir en todos.
7. **Códigos de F4.9:** van a la lista E6 de `00_CONTRATOS.md`, a `warnings.ts` y a la lista blanca de aceptación,
   todos como notas.
   - Textos para `warnings.ts`, con ruta `/reinforcements`:
     - `reinforcement_outside_mass`: «Un refuerzo no cruza la masa deslizante de esta superficie: no aporta fuerza.»
     - `reinforcement_compression_ignored`: «Un refuerzo pasivo quedaría comprimido por el deslizamiento y no aporta
       fuerza (solo trabaja a tracción; Clouterre, 1991; FHWA GEC 7).»
     - `structural_checks_not_covered`: «El modelo tiene pilotes o tablestacas. OpenGeoSlide calcula la estabilidad
       global con el elemento incluido; no calcula el empuje sobre el elemento, su empotramiento, el momento flector
       ni la deflexión.»
8. **TypeScript:**
   - en `engine/types.ts`, el espejo de los tipos, `version: '0.4'` y `reinforcement_forces` en el resultado;
   - en `editor/types.ts`:
     - `Selection` con `{ kind: 'reinforcement'; index }` y `{ kind: 'reinforcement_end'; index; end: 1 | 2 }`;
     - `EditorCommand` con `reinforcement/upsert` y `reinforcement/remove`;
     - `Tool` con `'draw_reinforcement'`;
     - los `EditorIssueCode` de la validación local, `editor.reinforcement_*`, uno por regla de F4.2;
   - `tsc` limpio. Los consumidores todavía no los usan.
9. **Tests RED** en `crates/ogs-core/tests/f3r_oracle.rs`, con las filas 1 y 2 de F4.13: el ancla horizontal de
   (52; 28) a (25; 28), T = 100, `axial`, sin `pullout`, activa y pasiva, sobre V047a con el círculo fijo.
   - Deben fallar **en el stub** con el mensaje `todo!`, no en serde.
   - Las demás filas las agrega el coordinador con las entradas exactas de X17.
10. **Identidad:** compila un binario de `bf1655c` en un worktree detached en `$TMPDIR` y compara todos los modelos
    byte a byte. Son 93 casos, `pending`, D01 a D23 y `acads1a`, con todos sus métodos, en búsqueda y fija: **0 deben
    diferir**. Borra el worktree al final.

**Gates:**
- `cargo fmt --all --check`;
- `clippy -D warnings`;
- `cargo test -p ogs-core --release --no-fail-fast`: todo verde **salvo** los RED de `f3r_oracle.rs`;
- `pytest verification/tools/test_schema.py`;
- `pnpm --dir apps/web exec tsc --noEmit`;
- `pnpm --dir apps/web exec vitest run src/engine`.

**Presupuesto:** unas 60 iteraciones.

## X17: prototipo de las partes condicionales (solo lectura; código desechable en `$TMPDIR/f3r-X17`)

Entrega `docs/fase3/exploracion/X17.md` **en tu worktree** `f3r-x17`, rama `f3r-x17-explora`. Es el único archivo que
commiteas. Escríbelo temprano y refínalo. Cada afirmación lleva la etiqueta [verificado], con el comando o el
`archivo:línea` y la salida, o [inferido].

Cubre los cinco puntos de F4.15:
1. Dirección, sentido y regla de compresión.
   - Lee el código en `$TMPDIR/cslope-src`, en `crates/cslope-engine/src/model/reinforcement.rs` y en `solvers.rs`.
   - Escríbela en la notación de ogs, con s, α y el sentido del deslizamiento.
   - Explica la anomalía de X14 §5: los elementos inclinados sin fuerza, distinguiendo activo de pasivo.
   - Agrega filas del oráculo con anclas inclinadas a 15°, 30° y 45°, activas y pasivas.
2. `interface`, con r y σ′v, con y sin agua; y la rampa de `development`. Da fórmulas y filas del oráculo.
3. `location` de los pilotes, con fuerza constante.
4. **Prototipo numérico.**
   - Saca las dovelas de V047a con el círculo fijo de F4.13, con `target/release/ogs analyze`; los resultados traen
     `slices`.
   - Implementa en Python Bishop simplificado y Janbu simplificado y corregido con activas y pasivas según F4.6 y
     F4.7.
   - Reproduce las filas de F4.13 y las nuevas dentro de 0,1 %. Spencer, si alcanza.
   - Si F4.7 no reproduce al oráculo, mide la alternativa y reporta las cifras.
   - **Escribe para cada fila el JSON exacto del refuerzo en formato v0.4** (F4.2) y la cifra del oráculo, para que el
     coordinador la pase a los tests.
5. **VP 58 y VP 47 de Slide2:** ¿la convención del oráculo los reproduce?
   - El manual está en el PDF de verificación de Slide2. Bájalo con `curl` y conviértelo con `pdftotext -layout`.
   - Si no puedes transcribir un VP completo, explica por qué.

**Presupuesto:** unas 80 iteraciones.
