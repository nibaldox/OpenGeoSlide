# Brief F3G-G3: Ito-Matsui y cierre de la web (cuatro escritores Sonnet en paralelo)

Responde en **español neutro, sin voseo**.

**Normativo:**
- `briefs/04_CONTRATOS_GRIETA_AGUA.md` **§F5.10** (E15i, Ito-Matsui) y **§F5.11** (E15k, γsat);
- lo vigente de §F5.1 a §F5.9 y de los contratos 00 a 03, en particular E14d a E14g para cruces, activo y pasivo.

**Evidencia:**
- `docs/fase3/exploracion/X22.md`;
- el prototipo `X22_proto/` (`im.py` y los términos), que **se reescribe en Rust**; el código de cSlope no se copia;
- las filas `X22_filas/`, con las cifras del oráculo en `resultados.json`.

**Base:** `f3g-integracion`, en el commit de tu worktree.

## Reglas comunes

- **Antes de cada cambio,** un test RED, y números antes y después.
- **No relajes** umbrales ni tolerancias.
- **Gate de identidad:**
  ```
  verification/tools/identity_vs_baseline.py --normalize-version --include-reinforced \
    --base $TMPDIR/f3g-base-target/release/ogs --new target/release/ogs
  ```
  Debe dar **0 diferencias**. Las excepciones declaradas en `identity_exceptions.json` y los modelos con agua sobre el
  terreno se informan aparte.
- **Gates del motor:**
  - `cargo fmt --all --check`;
  - `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`;
  - `cargo test -p ogs-core --release --no-fail-fast`, también con `--features parallel`;
  - aceptación: **323 checks, 0 fallas**.
- **Entorno:** `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch` y Python con `env -u PYTHONPATH -u
  PYTHONHOME`.
- **Oráculo:** `$TMPDIR/oracle-venv/bin/python`.
- **Commits** pequeños, con rutas explícitas. **Nunca push.**
- **No toques archivos de otro escritor.** Si necesitas un cambio en uno, déjalo escrito en tu informe. **Ningún
  escritor toca `CHANGELOG.md`:** deja en tu informe las líneas que propones.
- Reserva las últimas 4 iteraciones para el informe. Si abriste un preview, cuéntalas también para matarlo por PID y
  comprobar con `ss -ltnp` que el puerto quede libre.

## M-ito (worktree `f3g3m`, rama `f3g3m-ito`)

**Archivos tuyos:**
- `crates/ogs-core/src/{reinforcement.rs,model.rs,loads.rs,report.rs}`;
- en `crates/ogs-core/src/lib.rs`, solo la emisión del aviso;
- `schema/ogs-0.5.schema.json` y `verification/tools/test_schema.py`, en las filas de `lateral_pressure` y `capacity`;
- E6 de `briefs/00_CONTRATOS.md`, solo el código nuevo;
- los tests nuevos `crates/ogs-core/tests/f3g3_*.rs`, con sus datos en `crates/ogs-core/tests/data/f3g3/`, que son las 28
  filas migradas al formato de E15i-1 más un `expected.json`.

**Tareas:**
- E15i-1 a E15i-8 en el motor: formato, validación, presión, integración, tope, punto de aplicación, salida y aviso.
- Los criterios de E15i-9, todos con test.
- **S06 en Bishop:** si el acotamiento actual de E14o-2 no basta, propón el cambio mínimo en `methods/bishop.rs` en tu
  informe. **No lo hagas tú.**

**Presupuesto:** unas 90 iteraciones.

## V-ito (worktree `f3g3v`, rama `f3g3v-verif`)

**Archivos tuyos:**
- `verification/harness/to_cslope.py` y su test;
- `verification/tools/import_cslope.py` y su test;
- `verification/pending/**`;
- `verification/differential/**`.

**Tareas:**
1. **Conversor, E15i-10.** Haz pasar por el conversor las 28 filas de X22, que deben reproducir el oráculo a 1e-6.
   Demuestra con números que nada cambia sin `lateral_pressure`: el informe de aceptación da 322 de 323 en cSlope, y la
   batería diferencial queda igual.
2. **Importador.** Prepara V013b a V013e en formato 0.5 con `lateral_pressure`, en `verification/pending/F3G/` o en el
   lote que corresponda, con su índice y un importador idempotente.
   - Hoy esos casos están excluidos en `verification/pending/F3/INDEX.md` o en `verification/pending/INDEX.md`, con el
     motivo «Ito-Matsui».
   - La promoción a `cases/` la hace el coordinador al integrar, con tu comando documentado.
3. **Batería diferencial.** Agrega 2 o 3 modelos de Ito-Matsui al bloque F3G, en búsqueda y en superficie fija: φ = 0,
   c-φ y bajo el agua.

**Presupuesto:** unas 60 iteraciones.

## W-ito (worktree `f3g3w`, rama `f3g3w-ito`)

**Archivos tuyos:**
- `apps/web/src/editor/panels/{ReinforcementsPanel.tsx,reinforcementForm.ts}` y sus tests;
- `apps/web/src/editor/state/{reinforcement*.ts,validate*.ts}`. **No** toques `geotech.ts`;
- `apps/web/src/io/**`, en lo que toque a `lateral_pressure` y `capacity`;
- `apps/web/src/engine/{types.ts,warnings.ts}`;
- `apps/web/src/report/**` y `apps/web/src/ui/ReinforcementForces.tsx`, por las columnas `soil_force`, `governs` y
  `arm`;
- la Ayuda y el glosario, con el término «Ito-Matsui» y sus límites (E15i-8).

**Tareas:**
- En la tarjeta de pilote:
  - el selector de la fuerza: «Fuerza dada» o «Presión del suelo (Ito-Matsui)»;
  - el diámetro, la ubicación (centroide por defecto) y la capacidad opcional, con corte y momento;
  - la validación local con el mismo texto que el motor;
  - la versión mínima 0.5.
- La tabla de fuerzas y el PDF muestran la fuerza del suelo, qué gobierna y el brazo.
- El texto del aviso `ito_matsui_spacing_range`.
- La conversión de unidades:
  - `diameter` es una longitud;
  - `shear` es una fuerza;
  - `moment` es un momento, fuerza por longitud;
  - el FS no cambia, con una diferencia ≤ 1e-9 usando el motor real. Si el motor de tu rama todavía no tiene Ito-Matsui,
    marca el test `skip` con un comentario hasta la integración.

**Gates:** `tsc`, `pnpm test` con `OGS_BIN` y `pnpm build`.

**Presupuesto:** unas 80 iteraciones.

## W-fix2 (worktree `f3g3f`, rama `f3g3f-fix`)

**Archivos tuyos:**
- `apps/web/src/examples/**`;
- `apps/web/src/editor/state/geotech.ts` y sus tests;
- `apps/web/src/editor/panels/forms.ts` y sus tests;
- en `README.md`, las líneas de γsat;
- `docs/limitaciones.md`;
- `docs/verificacion.md`.

**Tareas.** Hoy fallan 11 tests de `pnpm test`, que ya fallaban en la base:
1. **`exampleTitles.test.ts` (3 tests).**
   - El regex del índice debe aceptar la versión 0.5.
   - Faltan los títulos en español de los **31 casos promovidos en F3G**: los de grieta y agua embalsada, como V023 y
     V024. Tómalos de `meta.title` y de las notas de cada JSON; la fuente es la referencia bibliográfica. No inventes
     datos.
2. **E15k, γsat (`validateLocal.test.ts`, 4 tests: V082a, V082b, V088 y V089).**
   - Retira el aviso `editor.gamma_sat_unverified` de `geotech.ts` y de los tests.
   - Corrige las líneas del README y de `docs/limitaciones.md` que dicen que γsat no está verificado, porque ahora lo
     verifican esos 4 casos publicados.
   - Busca otras menciones con `grep -rn "gamma_sat_unverified\|γsat" apps/web/src docs README.md`.
3. **`forms.polylineInicial93.test.ts` (4 tests).** V079 y V080 dan `NoValidSurface: tension_crack_not_reached` con la
   polilínea inicial que propone la web.
   - Corrige el generador en `forms.ts` para que, con una grieta de profundidad fija, la polilínea propuesta alcance esa
     profundidad bajo la coronación, con un margen. Con una grieta automática, que use el círculo crítico de la búsqueda
     si existe.
   - Si no se puede, el test acepta `tension_crack_not_reached` **solo** para los casos con grieta y lo explica en un
     comentario. **No** se admiten los otros códigos.
4. **Documentación.** `docs/verificacion.md`, cerca de la línea 186, y lo que diga sobre «D30 fija» como falla abierta:
   E15j-8 la deja en +0,13 %. Corrígelo. Las líneas que propones para `CHANGELOG.md` van en tu informe.

**Gates:**
- `pnpm --dir apps/web exec tsc --noEmit`;
- `OGS_BIN=$PWD/target/release/ogs pnpm --dir apps/web test`, con **0 fallas**;
- `pnpm --dir apps/web build`;
- la auditoría del README.

**Presupuesto:** unas 60 iteraciones.
