# Brief F3R-R2: integración del bloque de refuerzos (tres escritores Sonnet en paralelo)

Responde en **español neutro, sin voseo**.

**Normativo:** `briefs/03_CONTRATOS_REFUERZOS.md`, que incluye F4.16 (E14m).

**Base:** `f3r-integracion`, con la ola R1 integrada.

**Estado de la base**, medido por el coordinador:
- motor: 501 tests sin fallas;
- 120 filas del oráculo en verde;
- web: 2974 tests;
- pytest de `verification`: 899;
- harness con ogs sobre `pending/F3R`: 32 OK y **1 «sin dato», V065 con Spencer**;
- batería diferencial v0.4: 12/12;
- identidad: 0 diferencias en los 121 modelos sin refuerzos. Las 143 diferencias restantes son de los modelos con
  refuerzos, que la v0.2.0 no puede leer.

**Reglas:**
- Un test RED antes de cada cambio.
- No relajes umbrales ni tolerancias.
- Commits con rutas explícitas y **sin push**.
- `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch` y Python siempre con
  `env -u PYTHONPATH -u PYTHONHOME`.
- El oráculo es `$TMPDIR/oracle-venv/bin/python`.
- No toques archivos de otro escritor.

## I1: verificación y promoción (worktree `f3r2i1`, rama `f3r2i1-verif`)

**Archivos tuyos:**
- `verification/**`;
- `crates/ogs-core/tests/acceptance.rs`, solo si hace falta;
- `docs/verificacion.md`;
- en `README.md`, solo la tabla de verificación y sus cifras;
- `docs/fase3/r2i1/`.

Del motor (`crates/ogs-core/src`), solo con un test RED y un diagnóstico escrito, si encuentras un error real.

**Tareas:**
1. **V065 con Spencer «sin dato»:**
   - reproduce el caso;
   - di qué estado y qué avisos da ogs;
   - compáralo con cSlope (0,9585) y con lo publicado (0,964).

   ¿Es un error, un caso que el motor rechaza con razón (guardas) o un problema de conversión? Diagnostícalo con
   números. **No relajes guardas.** Si hay un error del motor, corrígelo con test e identidad; si no, el check queda
   retenido con su número.
2. **Comparación por cruce:** compara las fuerzas aplicadas por ogs (`reinforcement_forces`) con las del oráculo
   (`reinforcementForces`) en los 25 casos.
   - Muestra x, fuerza y dirección, y explica cada diferencia. V016b se explica por E14m-1, porque el oráculo descarta
     los activos comprimidos.
   - Agrega la comparación al informe del harness.
3. **Promoción:** pasa `pending/F3R` a `verification/cases` (los que pasen) con su índice, y regenera
   `verification/REPORT.md` y el informe diferencial. La aceptación debe dar 0 fallas.
4. **`identity_vs_baseline.py`:** que salte, y cuente aparte, los modelos con `reinforcements`, que el binario base no
   puede leer. Así el gate da «0 diferencias» limpio.
5. **VP de Slide2** pendientes:
   - VP 31, 50, 59 y 88, citando la tabla del manual;
   - VP 87 y 94, cotejando todas sus cifras con los casos del corpus.

   Baja el manual con `curl` y conviértelo con `pdftotext -layout`. Si un VP no se puede transcribir, explica por qué.
6. **Cifras:** `docs/verificacion.md` y la tabla del README, con cifras **leídas** de los informes.

**Gates:**
- `cargo test -p ogs-core --release --no-fail-fast`, con la aceptación;
- `pytest verification` con `cslope==0.1.0`, `shapely`, `jsonschema` y `pytest`;
- la batería con `--require-f3r`;
- identidad.

**Presupuesto:** unas 90 iteraciones.

## I2: web, recorridos de extremo a extremo (worktree `f3r2i2`, rama `f3r2i2-web`)

**Archivos tuyos:**
- `apps/web/**`;
- `docs/fase3/r2i2/`, que es nuevo, para los guiones e2e;
- `docs/fase3/iw/e2e/run_regression.sh`, para agregar tus guiones.

Skills: `ogs-web-chrome-walkthrough`, `ogs-e2e-preview-integration` y `opengeoslide-editor-canvas-tools`.

**Tareas:**
1. **Lo que quedó de R1:**
   - Diagnósticos navega a la pestaña «Refuerzos» (`app/issueNav.ts`);
   - la portada del PDF dice v0.4 con refuerzos;
   - un `anchor` nuevo propone `end1_capacity = tensile_capacity` (E14m-2), con su test;
   - verifica la conversión de unidades de los refuerzos (`units/convert`): con el motor real, el FS no cambia al
     convertir SI ↔ imperial, a 1e-9;
   - el ciclo de imports entre `ui/ResultsTable` y `ui/ReinforcementForces`: rómpelo si es trivial.
2. **Recorridos nuevos en Chrome** con el WASM real, con preview en 5186 y `node_modules/.bin/vite`, en claro y en
   oscuro, con axe sin hallazgos serios ni críticos:
   - **tablestaca anclada:**
     1. dibujar la tablestaca con la herramienta y fijar su fuerza en el panel;
     2. agregar un anclaje activo;
     3. Calcular;
     4. comprobar las flechas, la tabla de fuerzas, el texto del límite de F4.8 y el PDF, con `%PDF` y tamaño;
   - **muro TEM:** cinco geosintéticos con `interface` desde el panel y el teclado; Calcular, CSV de fuerzas,
     deshacer y rehacer;
   - **talud con clavos:** clavos pasivos con `bond`, editados con el dedo (táctil) y con las flechas; el estado
     `compression_ignored` visible con un clavo empinado;
   - **ida y vuelta:** guardar un modelo 0.4, abrirlo y comparar byte a byte.
   - Captura cada vista y revísala con visión.
3. **Regresión completa:** `docs/fase3/iw/e2e/run_regression.sh` con tus guiones agregados, con **0 FAIL**. Las
   expectativas viejas se actualizan con comentario del motivo; las regresiones se corrigen en el código.

**Gates:**
- `tsc`;
- `pnpm test` con `OGS_BIN`;
- `pnpm build`;
- regresión con 0 FAIL.

**Presupuesto:** unas 90 iteraciones.

## I3: documentación y bindings (worktree `f3r2i3`, rama `f3r2i3-docs`)

**Archivos tuyos:**
- `docs/{formato-ogs-json,limitaciones,desarrollo}.md`;
- `docs/tools/validar_ejemplos.py`;
- `CHANGELOG.md`;
- `crates/ogs-py/**`;
- en `crates/ogs-cli/src/main.rs`, solo `USAGE`;
- en `README.md`, solo «Qué es», «Limitaciones conocidas» e «In English», no la tabla de verificación;
- en `apps/web/src/onboarding/helpContent.ts`, solo el texto de ayuda de refuerzos;
- `docs/fase3/r2i3/`.

**Tareas:**
1. **`docs/formato-ogs-json.md`:** el formato v0.4 completo, con ejemplos que validen contra
   `schema/ogs-0.4.schema.json` y contra `ogs analyze`, mediante `validar_ejemplos.py` y sus marcas.
   - Cubre los cinco tipos, `pullout` con sus tres modelos, activo y pasivo, la dirección y la regla de compresión.
   - Una tablestaca anclada como ejemplo completo.
   - Los estados de `reinforcement_forces` y las notas nuevas.
2. **`docs/limitaciones.md`:**
   - **El límite de F4.8**, destacado;
   - lo que se pospone (F4.1);
   - el tramo libre sin placa (`no_capacity`);
   - el activo comprimido (E14m-1) y la diferencia con el oráculo instalado;
   - la discretización del oráculo en `interface`;
   - VP 58 pendiente;
   - la búsqueda con refuerzos, que tiene discontinuidades por los cruces.
3. **Ayuda de la web:** el texto de refuerzos y el límite, solo en `helpContent.ts`.
4. **`ogs-py`:** el docstring y `tests/test_v04.py`, con los cinco tipos, las notas y `reinforcement_forces`, sobre las
   filas de X17. Compila el wheel con `maturin` en un venv de `$TMPDIR`. `USAGE` de la CLI con refuerzos.
5. **`CHANGELOG.md`:** la sección «Unreleased» del bloque, de E14a a E14m.

**Gates:**
- `validar_ejemplos.py`;
- los tests de `ogs-py`;
- el audit del README: `python3
  /home/xodla/.hermes/profiles/open-geoslide/skills/beautify-github-readme/scripts/audit_readme.py README.md`;
- los enlaces relativos.

**Presupuesto:** unas 70 iteraciones.
