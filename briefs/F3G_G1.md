# Brief F3G-G1: implementación de la grieta de tracción y el agua embalsada (cinco escritores Sonnet en paralelo)

Responde en **español neutro, sin voseo**.

**Normativo:** `briefs/04_CONTRATOS_GRIETA_AGUA.md`, que contiene F5.1 a F5.8.

**Evidencia:**
- `docs/fase3/exploracion/X21.md` y su prototipo `X21_proto/`: `terms.py` y `solvers.py` tienen la formulación que
  coincide con el oráculo. **Se reescribe en Rust; no se traduce línea por línea ni se copia código de cSlope.**
- `X20.md`: dónde entra cada cosa.
- `docs/fase3/g0/NOTAS.md`: E15h, sin campo nuevo en `Slice`, y las firmas congeladas.

**Base:** `f3g-integracion`, en el commit de tu worktree.
- Los stubs están en `crates/ogs-core/src/{crack.rs,water.rs}`.
- Las filas RED están en `crates/ogs-core/tests/f3g_rows.rs`, con los datos en `tests/data/f3g/`.

## Reglas comunes

- **Test RED antes de cada cambio** y números antes y después.
- **No relajes umbrales ni tolerancias.**
- **Gate de identidad:**
  ```
  verification/tools/identity_vs_baseline.py --normalize-version --include-reinforced \
    --base $TMPDIR/f3g-base-target/release/ogs --new target/release/ogs
  ```
  Es la v0.3.0 y debe dar **0 diferencias**. El corpus actual no tiene agua sobre el terreno.
- **Gates del motor:**
  - `cargo fmt --all --check`;
  - `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`;
  - `cargo test -p ogs-core --release --no-fail-fast`, también con `--features parallel`;
  - la aceptación, en 243 checks y 0 fallas.
- `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch` y Python con `env -u PYTHONPATH -u PYTHONHOME`.
- **Oráculo:** `$TMPDIR/oracle-venv/bin/python`, con el adaptador del prototipo `X21_proto/oracle.py`.
- **Commits pequeños,** con rutas explícitas. **Nunca push.**
- **No toques archivos de otro escritor.** Si necesitas un cambio en uno, déjalo escrito en tu informe.

## M-agua (worktree `f3g1a`, rama `f3g1a-agua`)

**Archivos tuyos:** `crates/ogs-core/src/water.rs` y los tests nuevos `crates/ogs-core/tests/f3g1a_*.rs`.

**Tareas:**
- **E1 a E4, E7 y E9** de F5.3 en `ponded_terms`:
  - la región en todo el modelo, partida en los vértices y en los cruces;
  - `V`, `H_x` y los momentos con Gauss de 3 puntos;
  - los términos por método, en `weight_extra`, `h_force`, `h_moment_base` y `driving_extra`;
  - el paramento vertical;
  - sin sismo.
- **E15c-ru:** `pore_pressure += ru·V/b` en los materiales con `ru`.

**Criterios (F5.5), todos con tests:**
- las filas de agua sin grieta de `f3g_rows`, en verde a ≤ 0,1 %: P01 a P08, D01 a D04, y CP-V023, V024, V042, V061,
  V087, V089, V091 y V092;
- neutralidad byte a byte cuando no hay agua sobre el terreno;
- equilibrio global independiente: Spencer y M-P ≤ 1e-6 y Bishop ≤ 1e-9 en su formulación. Incluye la dovela de
  terreno plano bajo el agua, con `h_force = 0` y `h_moment_base ≠ 0`, el riesgo que anotó G0;
- espejo ≤ 1e-9 en P01/P03, D01/D03 y D02/D04;
- un test de `ru` con agua embalsada, que da un FS menor que con `ru` solo sobre el suelo;
- un test de búsqueda: V047a con la piezométrica 2 m sobre el pie da un FS cerca de 0,924 (cSlope con búsqueda,
  X20 §1.2) y no 0,132.

**Presupuesto:** unas 80 iteraciones.

## M-grieta (worktree `f3g1b`, rama `f3g1b-grieta`)

**Archivos tuyos:**
- `crates/ogs-core/src/crack.rs`;
- `crates/ogs-core/src/slicer.rs`: el nodo en `x_c` y `check_block_ends` sobre la masa truncada (G2);
- en `crates/ogs-core/src/lib.rs`, solo el cableado de la grieta;
- `crates/ogs-core/src/search.rs`, si hace falta;
- los tests nuevos `crates/ogs-core/tests/f3g1b_*.rs`.

**Tareas:**
- **G1 a G9** de F5.4:
  - `locate`, con barrido y bisección, y `truncate`, que quita las dovelas, deja la cara vertical y aplica `Pw` con
    sus términos por método;
  - `CrackReport` en la salida;
  - la profundidad automática G6. La sobrecarga `q` del agua embalsada se calcula **en `crack.rs`** desde la
    piezométrica y el terreno, `γw·max(0, piezo − terreno)`; **no llames a `water.rs`**;
  - el descarte en la búsqueda, G9;
  - las polilíneas;
  - la nota `reinforcement_outside_mass` para los cruces de refuerzo del lado de la cresta.
- **E15f condicional, círculos tangentes al fondo.** V096a y V086b, que X21 §5 dejó con el fondo bajado 2 m:
  - reproduce el rechazo con el fondo original;
  - si viene del redondeo del contacto con el fondo, como V065, corrígelo con un test y mide la identidad;
  - si no, documenta la causa con números en `docs/fase3/g1b/NOTAS.md`.

**Criterios:**
- las filas de grieta sin agua embalsada de `f3g_rows`, en verde a ≤ 0,1 %: C10, C20, C30, W025, W050, W100 y W100m,
  A01 a A06, CP-V079 en todas sus variantes, CP-V072a, V080, V082a, V088 y V096c, y S-V048, S-V086b y S-V096a;
- **A07** con `tension_crack_not_reached`;
- espejo W100/W100m ≤ 1e-9;
- monotonía con `water_fill`;
- continuidad con `depth → 0⁺`;
- equilibrio global independiente;
- identidad.

Las filas que combinan grieta y agua embalsada, CP-V009a, CP-V009b y A06 con agua libre, se cierran al integrar.
Reporta su estado con tu rama.

**Presupuesto:** unas 90 iteraciones.

## V: verificación (worktree `f3g1v`, rama `f3g1v-verif`)

**Archivos tuyos:**
- `verification/tools/import_cslope.py` y su test;
- `verification/harness/to_cslope.py` y su test;
- `verification/pending/F3G/`, nuevo;
- `verification/differential/{run.py,test_differential.py}` y un directorio nuevo de modelos `F3G`;
- las listas informativas de `crates/ogs-core/tests/acceptance.rs`, para agregar `water_above_ground` como nota;
- E6 de `briefs/00_CONTRATOS.md`, solo el texto de `water_above_ground`;
- la ayuda de `crates/ogs-cli/src/main.rs`, que debe decir «v0.1 a v0.5».

**Tareas:**
1. **Conversor ogs → cSlope.**
   - `tension_crack` pasa a `tensionCrackDepth`, `tensionCrackAuto` y `tensionCrackWater`.
   - El agua embalsada se emite **siempre**, con `freeWater: true` y `followBoundary: false`, porque en ogs es
     automática en todas las versiones.
   - **Demuestra con números que no cambia nada** cuando la piezométrica no pasa sobre el terreno:
     - en el informe de aceptación, cSlope reproduce 242 de 243;
     - en la batería diferencial: 71/71 de la Fase 3a, 12/12 de refuerzos, 28/28 de búsqueda y 28/28 de superficie
       fija.
2. **Importador cSlope → ogs v0.5.**
   - Lleva los casos de X18 §3.1 a `verification/pending/F3G/`, con su `INDEX.md` y un `HOLD.json`.
   - En `HOLD.json` van los 5 checks que el oráculo no reproduce, con la causa de X18: V009b, V086a, V087 y los de
     V092.
   - El importador debe ser **idempotente**.
   - La promoción a `cases/` la hace el integrador, cuando el motor esté listo.
3. **Bloque diferencial F3G.** Entre 8 y 12 modelos sintéticos:
   - embalse al pie;
   - cara de presa;
   - grieta seca;
   - grieta llena;
   - grieta automática;
   - combinados.

   Cada uno se corre en búsqueda y en superficie fija frente a cSlope, con la opción `--require-f3g`. Con el motor de
   tu base van a fallar: déjalos preparados y reporta el estado.

**Gates:**
- `pytest verification`, en verde salvo lo que dependa del motor nuevo, que marcas y reportas;
- `cargo test -p ogs-cli`.

**Presupuesto:** unas 70 iteraciones.

## W1: web, modelo y paneles (worktree `f3g1w1`, rama `f3g1w1-panel`)

**Archivos tuyos:**
- `apps/web/src/editor/panels/{AnalysisPanel.tsx,WaterPanel.tsx,forms.ts}` y sus tests;
- `apps/web/src/editor/state/**`, incluida la conversión de unidades;
- `apps/web/src/io/**`, con la versión mínima 0.5;
- `apps/web/src/engine/warnings.ts`, con el texto nuevo de `water_above_ground` (F5.3), la severidad «nota» y la ruta;
- `apps/web/src/engine/types.ts`, si hace falta.

**Tareas:** F5.7, panel «Análisis»:
- la casilla de la grieta;
- la profundidad, con un número o «Automática»;
- la fracción de agua, en 1 al crearla;
- la validación local con el mismo texto que el motor;
- la versión mínima: se guarda en 0.5 solo con la grieta.

El panel «Agua» lleva un texto que explica que el agua sobre el terreno se carga automáticamente.

**Pruebas:**
- unitarias;
- guardar y reabrir;
- un test con el motor real (`OGS_BIN` de tu rama), que con los stubs falla para la grieta. Márcalo `skip` con
  comentario hasta la integración, o usa solo el agua.

**Gates:** `tsc`, `pnpm test` con `OGS_BIN` y `pnpm build`.

**Presupuesto:** unas 70 iteraciones.

## W2: web, lienzo, informe y Ayuda (worktree `f3g1w2`, rama `f3g1w2-lienzo`)

**Archivos tuyos:**
- `apps/web/src/render/**`;
- `apps/web/src/report/**`;
- `apps/web/src/theme/**` y `apps/web/src/styles/**`, para el token `--canvas-pond` en claro y oscuro con contraste
  AA;
- la Ayuda y el glosario, donde vivan, con los términos «Agua embalsada» y «Grieta de tracción»;
- la tabla y la vista de Casos, si muestran resultados;
- `apps/web/src/ui/**` para Diagnósticos.

**Tareas:** F5.7, lienzo e informe:
- el relleno azul del agua embalsada, en una capa propia bajo la piezométrica;
- en el resultado, la grieta en `x_c` de la superficie crítica: una línea discontinua vertical, su profundidad y la
  flecha de `Pw`;
- en el PDF, el CSV y Diagnósticos: `x_c`, la profundidad, `Pw` y la nota del agua embalsada;
- en la Ayuda, las convenciones: sin sismo sobre el agua, la regla de `ru` y `water_fill`, con lo conservador de 1.

**Pruebas:**
- unitarias, con resultados simulados que traen `tension_crack`;
- capturas en Chrome, en claro y en oscuro, de V047a con 2 m de agua, revisadas con visión;
- axe sin problemas serious ni critical.

**Preview:** en el puerto 5186, con `apps/web/node_modules/.bin/vite preview --port 5186 --strictPort --host 127.0.0.1`.
Mátalo por PID y comprueba con `ss -ltnp` que quede libre. **Reserva las últimas 3 iteraciones para eso y para el
informe.**

**Gates:** `tsc`, `pnpm test` con `OGS_BIN` y `pnpm build`.

**Presupuesto:** unas 80 iteraciones.
