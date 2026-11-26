# Brief F3R-R1: fuerzas de refuerzo en el motor y en la web (cinco escritores Sonnet en paralelo)

Responde en **español neutro, sin voseo**.

**Normativo:** `briefs/03_CONTRATOS_REFUERZOS.md`, en particular **F4.16 (E14m)**, que prevalece sobre F4.2 a F4.13
donde difieran.

**Evidencia:**
- `docs/fase3/exploracion/X17.md`: fórmulas, signos y el JSON exacto de cada fila con su cifra del oráculo;
- `X14.md`, `X15.md` y `X16.md`, este último con el mapa de archivos.

**Base:** `f3r-integracion`, en el commit que creó tu worktree. Ya trae los tipos, la validación, el stub y los RED de
R0.

**Reglas:**
- Un test RED antes de cada cambio.
- No relajes umbrales ni tolerancias.
- Commits con rutas explícitas y **sin push**.
- `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch` y Python siempre con
  `env -u PYTHONPATH -u PYTHONHOME`.
- El oráculo es `$TMPDIR/oracle-venv/bin/python`, con cslope 0.1.0. El clon está en `$TMPDIR/cslope-src` (MIT): se
  lee, no se copia.
- **Identidad, gate de los escritores del motor:**
  - corre `verification/tools/identity_vs_baseline.py` contra un binario del commit base, compilado en un worktree
    detached en `$TMPDIR` que borras al final;
  - el resultado debe ser **0 diferencias**;
  - además, ningún modelo sin refuerzos puede cambiar ni un byte.
- **No toques archivos de otro escritor.** Si necesitas un cambio en uno, anótalo en tu informe.

## R1-C: cruces y fuerzas (worktree `f3r1c`, rama `f3r1c-fuerzas`)

**Archivos tuyos:**
- `crates/ogs-core/src/reinforcement.rs`, salvo `validate`, que no cambia;
- en `geometry.rs` y `surface.rs`, solo para hacer `pub(crate)` lo que necesites;
- en `crates/ogs-core/src/lib.rs`, solo:
  - las llamadas ya puestas por R0;
  - la emisión de las notas `reinforcement_outside_mass`, `reinforcement_compression_ignored` y
    `structural_checks_not_covered`;
  - `report.reinforcement_forces`;
- tests nuevos `crates/ogs-core/tests/f3r_forces*.rs`.

**Tareas:**
1. **`crossing_nodes`:** los cruces del segmento con la superficie ajustada (el arco inferior del círculo o la
   polilínea ajustada) y los nodos `x_c ± 1e-6·ancho` (F4.4). Un cruce en un extremo del refuerzo, dentro de `tol`, no
   cuenta.
2. **`apply_to_slices`**, con un `ReinforcementForce` por cruce:
   - la estación `s_c`;
   - `T(s_c)` con E14m-2, con la integral **exacta** de `interface`;
   - la dirección `u` y la regla de compresión de E14m-1;
   - los pilotes y tablestacas de E14m-1;
   - la escritura de las **activas** en los campos de siempre (F4.6) y de las **pasivas** en `passive_*` (F4.7),
     ambas en la dovela fina;
   - los estados `applied`, `outside_mass`, `compression_ignored` y `no_capacity`.
   - Ni el sismo ni las cargas actúan sobre los refuerzos.
3. **Notas** de F4.4, F4.8 y E14m-1. `reinforcement_forces` solo va en los métodos convergidos y sobre la superficie
   final.
4. **Tests:**
   - fuerzas aplicadas contra las cifras del oráculo de X17 §4.4 y §4.5, con x, y, Px, Py y la fuerza disponible;
     `interface` con integral exacta frente a la cifra de X17 §4.5, columna «fuerza prototipo», a 1e-4;
   - signos y espejo;
   - un activo con `along > 0` aplica `u = d`;
   - dos cruces;
   - un cruce en el aire, que da `outside_mass`;
   - el tramo libre sin placa, que da `no_capacity`;
   - **equilibrio global independiente con activas**: momento respecto de dos puntos y fuerza, con un residuo menor
     que 1e-6 de la escala, para Spencer y M-P;
   - **las filas activas de `crates/ogs-core/tests/f3r_oracle.rs` pasan a verde** (filas 1, 7 y 11, y las inclinadas
     activas cuando V las agregue), porque las activas solo usan los campos de siempre.
   - Las pasivas siguen en RED hasta que entre R1-M; anótalo.

**Gates:**
- `fmt`;
- `clippy -D warnings`;
- `cargo test -p ogs-core --release --no-fail-fast`, también con `--features parallel`: verde salvo los RED pasivos;
- identidad.

**Presupuesto:** unas 90 iteraciones.

## R1-M: términos pasivos en los métodos (worktree `f3r1m`, rama `f3r1m-metodos`)

**Archivos tuyos:**
- `crates/ogs-core/src/methods/{bishop,spencer,morgenstern_price,janbu,mod}.rs`;
- tests nuevos `crates/ogs-core/tests/f3r_methods*.rs`.

**Tareas:**
1. **F4.7:** cada método evalúa en cada F `W* + passive_v/F`, `H + passive_h/F`,
   `h_moment_base + passive_h_moment_base/F` y `driving_extra + passive_driving_extra/F`.
   - Va en Bishop (punto fijo y Brent de respaldo), en Spencer y M-P (dos curvas, el barrido de λ y la marcha de
     fuerzas) y en Janbu (raíz F₀, con f₀ sin cambios).
   - **Sin pasivos, el camino de siempre queda byte a byte.** Usa la estrategia de la skill: si no hay pasivos, no se
     toca `Prep`.
   - Los guards (m_α, N′, E3) se evalúan al F convergido con los pasivos incluidos.
2. **Test de consistencia del punto fijo**, que discrimina: con dovelas construidas a mano, resuelve con una pasiva P
   hasta F_p; luego resuelve con una **activa** P/F_p, que debe dar F_p a 1e-9, en los cinco métodos. Invierte el
   factor 1/F para comprobar que el test falla.
3. **E14m-6:** las fuerzas de los refuerzos entran en la escala motriz. Mide sobre las filas de aceptación que ningún
   FS cambie más de 1e-9 frente a usar la escala sin refuerzos, y repórtalo con números.
4. **Equilibrio global independiente con pasivas divididas por F**, para Spencer y M-P, con un residuo menor que 1e-6.
   Construye las dovelas a mano o con un modelo en el que pongas los campos `passive_*` desde el test.

**Gates:** los mismos que R1-C. Las filas del oráculo requieren C y M juntos; las corre el coordinador al integrar.

**Presupuesto:** unas 80 iteraciones.

## R1-V: esquema, filas del oráculo, conversor, importación y batería (worktree `f3r1v`, rama `f3r1v-verif`)

**Archivos tuyos:**
- `crates/ogs-core/src/model.rs`, solo para quitar `location` y `PileLocation` (E14m-3);
- `crates/ogs-core/tests/{f3r_types.rs,f3r_oracle.rs}`;
- `schema/ogs-0.4.schema.json`;
- `verification/**`;
- `docs/fase3/r1v/`.

**Tareas:**
1. **E14m-3:** quita `location` del modelo, del esquema y de los tests de tipos y de esquema. Agrega el caso «pile con
   location» a la tabla de acuerdo como rechazo.
2. **`f3r_oracle.rs`:** las filas de E14m-5 con el JSON exacto de X17 §4.4 y §4.5.
   - Son las 7 de F4.13 con 4 métodos, las 16 inclinadas y las 9 de capacidad, con Bishop, M-P `constant`, Janbu
     simplificado y corregido.
   - La tolerancia es 0,1 %, y 0,25 % en las dos filas de `interface` señaladas.
   - Quedan en RED en tu base; anótalo.
3. **`to_cslope.py`:** conversión de `reinforcements` v0.4 a cSlope.
   - `pile` y `sheet_pile` van a `piles`; la tablestaca con `spacing` 1 y `force` por metro.
   - `location` se escribe como `"slip-surface"`, y `direction` y `application` se escriben explícitos.
   - Con su test.
4. **`import_cslope.py`:** importa los lotes de F4.12 a `verification/pending/F3R/` con su `INDEX.md`:
   - R1: V016b, V035a, V035b y V037;
   - R2: V011a, V011b, V012, V064, V065, V066a, V066b, V066c y V066e;
   - R3: V010, V010b, V014, V083 y V084a a V084f;
   - R4: V015 y V095c.

   Corre el harness en `--oracle-only` y entrega la tabla de lo publicado frente a cSlope. Los casos que el oráculo no
   reproduzca quedan retenidos con su número.
5. **VP de Slide2:** transcribe a `pending/F3R/` los que tengan datos completos, citando la tabla del manual: VP 47
   (E14m-5), 48, 50, 54, 59, 85, 86, 31, 32, 87, 88 y 94. El manual se baja con `curl` y se convierte con `pdftotext
   -layout`. Explica los que no se puedan transcribir.
6. **Batería diferencial:** modelos `cases_f3r/` D24 en adelante:
   - un talud con clavos pasivos;
   - un muro TEM con geosintéticos;
   - una tablestaca anclada (tablestaca más un anclaje activo);
   - una fila de pilotes.

   Con Bishop, M-P y Janbu, con la sonda de capacidad que deja pendiente lo que el motor todavía no tiene.

**Gates:**
- `pytest verification` con `cslope==0.1.0`, `shapely`, `jsonschema` y `pytest`;
- `cargo test -p ogs-core --test f3r_types`.

**Presupuesto:** unas 90 iteraciones.

## R1-WA: formato, validación local y panel «Refuerzos» (worktree `f3r1wa`, rama `f3r1wa-panel`)

**Archivos tuyos:**
- `apps/web/src/io/ogsJson.ts`;
- `apps/web/src/engine/{types,validate,mockEngine}.ts`;
- `apps/web/src/editor/state/{reducer,validateLocal}.ts`;
- `apps/web/src/editor/panels/*`, con el nuevo `ReinforcementsPanel.tsx`;
- `apps/web/src/editor/EditorApp.tsx`, para el panel y el botón de la herramienta;
- sus tests.

Skill: `/home/xodla/.hermes/profiles/open-geoslide/skills/software-development/opengeoslide-editor-canvas-tools/SKILL.md`.

**Tareas:**
1. **`engine/types.ts`:** quita `location` (E14m-3).
2. **`ogsJson.ts`:**
   - lectura y guardado sin pérdida de los cinco tipos;
   - `minimalVersion` sube a 0.4 solo con refuerzos;
   - rechazo de claves desconocidas.

   **`validate.ts`:** acepta `reinforcement_forces` en el informe.

   **`mockEngine.ts`:** rechaza los modelos 0.4 con un error explícito.
3. **Reductor:** `reinforcement/upsert` y `reinforcement/remove`, que se deshacen en un solo paso y suben la versión a
   0.4.
4. **`validateLocal`:** las reglas de F4.2 con los `editor.reinforcement_*` de R0, con las rutas JSON.
   - Cubre `angle` solo con `direction: "angle"`, `x1 = x2` en tablestaca, `bonded_length ≤ L`, rangos e ids.
   - Bishop sigue con la regla de F3.6.
5. **Panel «Refuerzos»:**
   - lista, alta por tipo, baja y edición;
   - rótulos Anclaje, Clavo, Geosintético, Pilote y Tablestaca;
   - unidades en SI e imperial;
   - un `anchor` nuevo propone `end1_capacity = tensile_capacity` (E14m-2);
   - nombres accesibles estables, del tipo «Refuerzo 2: Capacidad a tracción (kN)»;
   - el botón «Dibujar refuerzo», que activa la herramienta `draw_reinforcement`.

   El comportamiento en el lienzo es de WB.
6. **Paridad:** la validación local y el motor dan el mismo veredicto sobre los casos de rechazo de
   `verification/tools/test_schema.py` de 0.4, con el motor real (`OGS_BIN`).

**Gates:**
- `tsc`;
- `pnpm test` con `OGS_BIN`;
- `pnpm build`.

**Presupuesto:** unas 80 iteraciones.

## R1-WB: lienzo, escena, informe, CSV y Casos (worktree `f3r1wb`, rama `f3r1wb-lienzo`)

**Archivos tuyos:**
- `apps/web/src/editor/canvas/*`;
- `apps/web/src/render/*`;
- `apps/web/src/report/*`;
- `apps/web/src/io/csv.ts`;
- `apps/web/src/ui/*`;
- `apps/web/src/editor/app/*`;
- sus tests.

Skill: `opengeoslide-editor-canvas-tools`.

**Tareas:**
1. **Lienzo:**
   - cada refuerzo es un segmento con dos tiradores; la tablestaca tiene la x fija;
   - funciona con puntero, teclado y táctil;
   - la herramienta `draw_reinforcement` crea el refuerzo con dos clics;
   - arrastrar el centro mueve los dos extremos en un solo paso;
   - un símbolo por tipo.

   Los gestos emiten los `EditorCommand` congelados por R0; el reductor lo hace WA.
2. **Resultado:**
   - una flecha por fuerza aplicada de `reinforcement_forces`, con la dirección de fx y fy;
   - los estados `compression_ignored`, `outside_mass` y `no_capacity` en gris con su rótulo;
   - la leyenda.
3. **Informe:**
   - en el PDF, la sección «Refuerzos», con los datos de entrada y la tabla de fuerzas por cruce: id, tipo, estación,
     disponible, aplicada (fx; fy), activa o pasiva, y estado. En una pasiva va la leyenda «se moviliza dividida por
     F»;
   - **el texto del límite de F4.8** cuando hay pilotes o tablestacas;
   - en el CSV, la tabla de fuerzas;
   - en Casos, las fuerzas.
4. **Tests:** con informes sintéticos que traen `reinforcement_forces`, y un PDF real revisado con visión (`pdftoppm`)
   de un modelo con tablestaca y anclaje.

**Gates:**
- `tsc`;
- `pnpm test` con `OGS_BIN`;
- `pnpm build`.

**Presupuesto:** unas 80 iteraciones.
