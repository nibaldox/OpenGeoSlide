# Brief CM-X: exploración del bloque «Cierre del MVP»

## Contexto

- **Proyecto.** OpenGeoSlide v0.5.1, publicado el 2026-11-27. Formato v0.6: Hoek-Brown, SHANSEP y el refinamiento no
  circular `analysis.search.non_circular`. Motor Rust en `crates/ogs-core`, web en `apps/web` y wheel en
  `crates/ogs-py`.
- **Plan del bloque:** `docs/cm/PLAN_CM.md`. Léelo primero, en especial §0, las decisiones D1 a D5 y las preguntas de §4.
- **Exploración previa** que sirve de punto de partida. No la repitas: verifica lo que uses y actualízalo.
  - `docs/fase3/exploracion/X24.md`: el refinamiento no circular, Slide2, SLOPE/W y OGR.
  - `X29.md`: el prototipo del refinamiento (§5: el pulido final de cSlope).
  - `X23.md`: los casos.
  - `X27.md`: el mapa del motor, el formato y la web en F3B (algunas líneas ya cambiaron).
- **Contratos vigentes:** de `briefs/00_CONTRATOS.md` a `briefs/05_CONTRATOS_FASE3B.md`. La regla de versión mínima
  F3.9 está en `02_CONTRATOS_FASE3.md`; F6.12 a F6.14, la búsqueda no circular, en `05_CONTRATOS_FASE3B.md`.
- **Límites publicados:** `docs/limitaciones.md`, en especial §«Búsqueda no circular (v0.6)» y §«Lo que sigue fuera
  tras la Fase 3b».

## Reglas comunes

- **Solo lectura del repo.** Escribes **un único archivo de hallazgos**, `docs/cm/exploracion/X<n>.md`, dentro del
  worktree `/home/xodla/archivos/opengeoslide-wt/cm-int` (rama `cm-integracion`). Escríbelo **temprano**, con el
  esqueleto de tus secciones, y refínalo después: si te quedas sin iteraciones, lo escrito sirve. X35 puede escribir
  además sus guiones en `docs/cm/exploracion/X35_proto/`.
- **No commitees**, no cambies de rama y no toques ningún otro archivo del repo, ni en este worktree ni en
  `~/archivos/opengeoslide`.
- **Dentro del archivo de hallazgos,** escribe las rutas como `~/archivos/…` o relativas al repo. Nunca escribas la
  ruta absoluta de tu home.
- **Instrumentación:**
  - `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`;
  - todo va en `$TMPDIR/cm-x<n>/`. Si te hace falta un worktree detached, va ahí, con
    `CARGO_TARGET_DIR=$TMPDIR/cm-x<n>/target`, y lo borras al final con `git worktree remove --force`;
  - **no** compiles en el checkout principal ni en `cm-int`;
  - Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.
- **Cada afirmación lleva su marca:**
  - `[verificado]`, con el comando y su salida, `archivo:línea`, o la URL y la cita exacta;
  - `[inferido]`, cuando no lo comprobaste.

  **Nada de cifras inventadas.** Una fórmula o un valor que viste solo en una fuente secundaria queda `[inferido]`.
- **Herramientas:**
  - **Motor v0.5.1:** `$TMPDIR/cm-base/ogs analyze <modelo.json>` (o `/dev/stdin`). Comprueba antes `--version`; debe
    decir 0.5.1. El `target/release/ogs` del checkout principal es la 0.4.0: no lo uses.
  - **Oráculo:** `$TMPDIR/oracle-venv/bin/python` con `import cslope` (cslope 0.1.0). En Hoek-Brown, σci va en `ucs`.
  - **Código de cSlope:** el clon `$TMPDIR/cslope-src` (commit `0f07e7a`, MIT), con las rutas Rust bajo
    `packages/engine-rs/crates/cslope-engine/src/`. Se lee y se cita; **no se copia**.
  - **Corpus de cSlope:** `$TMPDIR/cslope-src/packages/engine-rs/golden/verification.json`.
  - **Importador:** `verification/tools/import_cslope.py`; **conversor:** `verification/harness/to_cslope.py`;
    **harness:** `verification/harness/run.py`.
  - **Web publicada (v0.5.1):** https://nibaldox.github.io/OpenGeoSlide/. **Preview local de la v0.5.1:**
    http://127.0.0.1:5182/, que levanta el coordinador. Si no responde, avisa en tu informe y usa la publicada.
  - **Chrome:** `playwright-core` con el Chrome del sistema. Hay `node_modules` con `playwright-core` y `axe-core` en
    `$TMPDIR/ua1/Q/node_modules`; enlázalo con `ln -s` en tu carpeta de scratch.
- **Código con otra licencia:** OGR Slip2D es AGPL. Lee su documentación, pero no su código fuente, y no copies nada.
- **Presupuesto:** unas 60 iteraciones. Prioriza las tablas de hallazgos sobre la prosa.
- **Cierre:** tu respuesta final resume los hallazgos clave en 15 líneas o menos e incluye la ruta del archivo.

## X31: algoritmos de búsqueda global no circular

**Pregunta:** qué búsqueda global no circular conviene agregar delante del refinamiento actual, y con qué criterios se
acepta.

1. **Slide2 (Rocscience).** Cómo funcionan, según su documentación:
   - Path Search, Simulated Annealing, Block Search, Auto Refine no circular, Cuckoo y PSO;
   - Optimize Surfaces (Monte Carlo y Surface Altering).

   Para cada método: cómo genera las superficies, sus parámetros y valores por defecto, qué ventanas o restricciones
   usa, y si es determinista. Cita la URL y la frase.
2. **OGR Slip2D.** Lo mismo, desde `opengeorock.org/docs` (teoría y guía de usuario). Comprueba también si existe un
   ejecutable o un paquete instalable que sirva de **oráculo de caja negra** para una búsqueda global (pip, binario o
   CLI). Si lo hay, prueba una corrida mínima en `$TMPDIR/cm-x31/`.
3. **Fuentes primarias:** Cheng (2003), recocido simulado; Greco (1996), Monte Carlo; Malkawi, Hassan y Sarma (2001);
   Zolfaghari, Heath y McCombie (2005), algoritmo genético; Cheng et al. (2007), PSO. Para cada una: si hay texto
   abierto (tesis, preprint, repositorio), las ecuaciones del generador y del criterio de aceptación con su número de
   ecuación, y los ejemplos con sus valores de FS. Lo que leas solo en resumen queda `[inferido]`.
4. **El pulido final de cSlope.** Qué hace, en `archivo:línea` de `model/optimize.rs`, cuándo corre, qué mueve, y su
   costo (X29 §5 midió 3,6 veces más).
5. **El refinamiento actual de ogs** (`crates/ogs-core/src/noncircular.rs`): las semillas, el presupuesto, el desempate,
   el uso de `parallel` y las notas que emite. Solo lo necesario para decir cómo se le enchufa un generador global.
6. **Recomendación:**
   - algoritmo, o combinación de algoritmos, y por qué;
   - generador pseudoaleatorio con semilla fija, el mismo resultado con y sin `parallel`, y el desempate;
   - admisibilidad de las superficies generadas (concavidad, extremos dentro de las ventanas, cruces con el terreno);
   - presupuesto en evaluaciones del motor;
   - cómo entran sus mejores superficies al refinamiento y al pulido;
   - criterios de aceptación medibles: publicado, oráculo, monotonía frente al refinamiento local, barrido de taludes
     simples y costo.

## X32: casos y oráculo

**Pregunta:** cuáles checks publicados necesitan una búsqueda global, y cuánto falta hoy para alcanzarlos.

1. **Los 10 checks no medidos:** V036c, V036d, V039 (2), V041a, V041b, V051, V053 y V098. Agrega V100, que es
   `shear-normal` (solo para anotar que no se soporta), y V002-nc, que está retenido.
   - Conviértelos con el importador hacia `$TMPDIR/cm-x32/pending/`, **no** hacia el repo. Lee el `--help` del
     importador para dirigir la salida.
   - Córrelos con el motor v0.5.1 y `analysis.search.non_circular` (los 3 seeds y 33 vértices por defecto), y con cSlope
     y su `nonCircularOptimization`.
   - Tabla: caso, método, publicado y su fuente («Commercial program A (non-circular)» u otra), tolerancia, FS de ogs
     circular, FS de ogs no circular, FS de cSlope, error y veredicto con el criterio de un solo lado de D3.
2. **Diagnóstico de cada check que falla.** Haz la evaluación cruzada de `slope-stability-lem-engine`:
   - corre la polilínea final de cSlope en ogs como superficie fija, y la de ogs en cSlope;
   - clasifica la causa: alcance de la búsqueda (la superficie de cSlope es mejor y ogs no la encuentra), una regla
     compartida (la rama con tracción de E12e), el conversor o los datos.
   - Di cuáles cerraría una búsqueda global, con la evidencia.
3. **Mínimos globales publicados en la literatura** para modelos que ya están en el corpus: Arai y Tagyo (1985), ejemplos
   1, 2 y 3 (V001, V002 y V003); Cheng et al. (2007), V019 y V020; Greco (1996); Malkawi et al. (2001); Zolfaghari et
   al. (2005); y otros que encuentres con texto abierto.
   - Tabla: caso, autor, algoritmo, método de cálculo, FS publicado, fuente (URL y cita, o `[inferido]`) y si el modelo
     del corpus es el mismo problema (geometría, materiales y agua).
   - Esos valores pueden ser checks nuevos de un solo lado para la búsqueda global.
4. **Dos modelos sintéticos de rajo con una capa débil o una falla** donde el mecanismo crítico sea un bloque. Mide qué dan
   la búsqueda circular y el refinamiento de ogs, y qué da cSlope. Es la brecha que debería cerrar una búsqueda global.
   Deja los JSON de entrada en `$TMPDIR/cm-x32/` y cita su ruta.

## X33: motor, formato y web

**Pregunta:** dónde se engancha una búsqueda global no circular, qué campos necesita el formato v0.7 y cómo se reparte el
trabajo entre escritores con archivos disjuntos.

1. **Motor** (`crates/ogs-core/src/{noncircular,search,model,surface,slicer,report}.rs`), en `archivo:línea`:
   - cómo llegan las semillas al refinamiento, cómo se evalúa una polilínea y qué se reporta;
   - dónde entraría un generador global, con la firma del gancho: qué lee (la especificación de la búsqueda, las
     ventanas, el modelo preparado, el método, el presupuesto) y qué devuelve (las superficies, las notas y los
     contadores);
   - cómo se mantienen el determinismo y la igualdad con y sin `parallel` (el patrón de F3B para los errores).
2. **Formato v0.7:**
   - la propuesta de campos bajo `analysis.search.non_circular`, por ejemplo un algoritmo global, una semilla, un
     presupuesto y el pulido. Da al menos dos alternativas, con sus pros y sus contras;
   - la regla de versión mínima (F3.9) y la tabla campo → versión que comparten los tests;
   - qué validaciones cruzadas hacen falta (Bishop, la grieta automática, Ito-Matsui y otras combinaciones de F6.5);
   - el esquema `schema/ogs-0.7.schema.json` a partir del 0.6.
3. **Web** (`apps/web/src`): todos los archivos que tocan `non_circular` (panel, `forms.ts`, `reducer.ts`,
   `validateLocal.ts`, `ogsJson.ts`, `csv.ts`, el informe, la Ayuda, `ResultsTable.tsx`, `warnings.ts`, `shellModel.ts`
   e `issueNav.ts`), qué cambia en cada uno, y la experiencia de una búsqueda larga en WASM de un solo hilo (el contador
   de tiempo y el botón de cancelar, que ya existen).
4. **Python y CLI:** el wheel (`crates/ogs-py`), `ogs analyze`, `ogs bench --method all` y la documentación del formato
   (`docs/formato-ogs-json.md`).
5. **Olas:** una propuesta de olas C0, C1 y C2 con dueños de archivo disjuntos, la lista de archivos que compartirían dos
   escritores y cómo evitarlo (campos congelados en C0, parches entre dueños).

## X34: residuos de la web

**Pregunta:** la causa en `archivo:línea` y la corrección propuesta de cada defecto conocido de la web.

1. **Borradores** (Known issues de la 0.5.0 en `CHANGELOG.md`):
   - tras «Nuevo» o «Abrir», un campo cuyo valor del documento es nulo (por ejemplo, Sismo sin sismo) conserva el texto
     inválido anterior;
   - en una fila de vértice con `x` válida e `y` inválida, confirmar `x` borra el texto de `y`;
   - «Agregar punto» en las tablas de puntos descarta una fila inválida sin preguntar;
   - Ctrl+Intro no calcula con el foco dentro de un campo de texto.

   Reproduce cada uno en Chrome contra la v0.5.1 con un guion mínimo y una captura. Busca la causa en el código
   (`useDraft` y sus dependencias, los paneles, los atajos) y propón la corrección y su test.
2. **Pendientes del rediseño UA** (`docs/suite-a/CIERRE_UA.md` §«Pendiente para otra ola», y Known issues de la 0.5.1):
   - pantallas de 640 px de alto o menos (320 × 568, 320 × 640 y 390 × 664 con avisos): la paleta queda en parte bajo
     la barra fija de «Comprobar»;
   - a unos 800 × 600, el recuadro (HUD) tapa parte del modelo.

   Mídelos con capturas, cuantificando el solape en px, y propón la corrección.
3. **Los 2 guiones e2e que fallan** desde la 0.5.0: `u3o_onboarding` (paso 6, la Ayuda como diálogo) y `u6d_drafts`
   (R9-11a). Córrelos, lee el registro y clasifica cada uno: guion desactualizado o defecto del producto. Si es del
   producto, di si coincide con uno de los defectos del punto 1.
4. **El corredor de la regresión** (`docs/fase3/iw/e2e/run_regression.sh`) y los guiones que migró UA: ¿qué carpetas
   recorre hoy, y le falta alguna?
5. **Reparto:** una propuesta para una ola web de dos escritores con archivos disjuntos.

## X35: la compuerta «primer FS en menos de 5 minutos»

**Pregunta:** cuánto tarda hoy un usuario nuevo en obtener su primer FS, qué lo alarga y cómo se mide de forma
repetible.

1. **El protocolo.** Define tres tareas, con la condición de inicio (primera visita, almacenamiento limpio) y la de fin
   (el FS visible en pantalla):
   - **T1:** abrir un ejemplo y calcular;
   - **T2:** un talud simple desde cero, con un enunciado fijo (por ejemplo, 10 m de alto, 1,5H:1V, c = 10 kPa,
     φ = 30°, γ = 19 kN/m³, sin agua), hasta su FS;
   - **T3:** importar un DXF o un CSV de ejemplo y calcular.

   Escribe el enunciado exacto de cada tarea, tal como se lo daría a un usuario.
2. **La ruta mínima guionada.** Escribe un guion de Playwright por tarea en `docs/cm/exploracion/X35_proto/` y córrelo
   contra la web publicada y contra la preview local. Cuenta los clics, las teclas y los campos de cada tarea.
   - Estima el tiempo con el modelo KLM (Card, Moran y Newell), con los operadores K, P, H y M y sus valores citados de
     una fuente.
   - Suma el tiempo de cálculo medido del motor.
3. **Los puntos de fricción:** dónde se perdería un usuario nuevo (la guía de primera visita, el estado vacío, los
   valores por defecto, los mensajes de error) y qué cambios de la web quitarían pasos. Ordénalos por pasos ahorrados.
4. **La prueba a ciegas.** Escribe el enunciado que recibirá un agente sin acceso al repo, solo con la URL y la tarea:
   qué puede usar, qué se mide (tiempo, acciones y desvíos) y cómo informa.
5. **El protocolo humano:** una planilla para que el usuario o un colega midan las tres tareas con cronómetro, con los
   campos que hay que anotar.

## X36: xslope en el harness

**Pregunta:** si xslope puede ser la tercera columna del harness, y en qué subconjunto de los 347 checks.

1. **Instalación:** xslope en un venv de scratch (`uv venv -p 3.13 $TMPDIR/cm-x36/venv` y `uv pip install xslope`).
   Anota la versión, la licencia, el repositorio y la documentación.
2. **API:** el formato de entrada (diccionario, planilla Excel u otro), los métodos (Bishop, Spencer, Janbu, M-P y
   otros), la búsqueda (circular o no circular), el agua (piezométrica, `ru`), el sismo, las cargas y los refuerzos. Cita
   el código o la documentación.
3. **Conversor prototipo:** de `.ogs.json` a la entrada de xslope, en `$TMPDIR/cm-x36/`. Córrelo en unos 10 casos de
   `verification/cases`, con Bishop y Spencer, en superficie fija y en búsqueda, y compara con el publicado y con ogs.
   Tabla con las cifras.
4. **Cobertura:** cuántos de los 347 checks puede correr xslope, por capacidad (versión del formato, método, tipo de
   superficie, agua, cargas y refuerzos), con el conteo hecho en código.
5. **Recomendación:** tercera columna sí o no, en qué subconjunto, quién es dueño del conversor y cuánto cuesta
   mantenerlo.
