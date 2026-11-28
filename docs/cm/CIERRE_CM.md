# Cierre del bloque CM: búsqueda global no circular y cierre del MVP (28-nov-2026)

Rama `cm-integracion`, sobre v0.5.1 (`main` `1d1d097`). Plan: `docs/cm/PLAN_CM.md`. Contrato: `briefs/06_CONTRATOS_CM.md`,
con F7.0 a F7.7 y las enmiendas E17a a E17d. La versión del formato es la **v0.7** (la versión de los crates la decide el
usuario al publicar; el plan propone la 0.6.0). **Nada de este bloque está publicado.**

## Olas

| Ola | Qué hizo | Escritores |
|---|---|---|
| CX | Exploración X31 a X36: algoritmos globales, los 10 checks no medidos, el formato y la web, la web (borradores, pantallas bajas, HUD), la primera visita (KLM y protocolo) y xslope | 6 × Haiku |
| W1 | Web del MVP: borradores y editor (CM-WA), pantallas bajas y HUD (CM-WB), primera visita (CM-WC); xslope como columna informativa (CM-V) | Sonnet |
| X37 | Prototipo de la búsqueda global sobre las dovelas del motor, con las filas de aceptación: el bloque (G2) cierra V053; *path* (G1) no mejora ningún caso válido y queda fuera | Haiku |
| C0 | Contrato (F7.0 a F7.7), tipos del formato v0.7, esquema `ogs-0.7.schema.json`, ganchos y tests en rojo | coordinador y Terra |
| C1 | Motor: búsqueda global (bloque, recocido, descarte sucesivo, pulido y guarda de tracción), con A1 a A10 (CM-M); web de la búsqueda global: panel, salidas, avisos y Ayuda (CM-C1W) | Terra y Sonnet |
| E17a a E17d | Enmiendas del contrato que mide el motor: `auto` y el respaldo al recocido (E17a); descarte sucesivo y robustez frente a la semilla (E17b); Halton rotado y proyecciones de 15° a 75° (E17c); capas con HB, SHANSEP y no drenado, y los tres taludes sin etapa global (E17d) | coordinador y CM-M |
| W2 | Lo que encontró la prueba a ciegas de los 5 minutos: el HUD nombra el método, importar sobre el arranque crea un modelo nuevo, la base de la polilínea abierta se explica y «Omitir» sin restos | Sonnet |
| C2 | Cierre: casos promovidos (CM-C2V) y documentación (CM-C2D, este documento) | 2 × Sonnet |
| RCM | Revisión adversarial con dos lentes en un clon congelado, olas correctivas y revisión de cierre | **pendiente** |
| Medición | La compuerta de los 5 minutos sobre el candidato a versión | las dos primeras mediciones hechas; la humana, **pendiente del usuario** |
| Versión | Commit de versión, gates y la espera del «sube» del usuario | **pendiente** |

## Qué cambia

**La búsqueda global no circular** (`analysis.search.non_circular.global`, formato v0.7;
[formato](../formato-ogs-json.md#v07-búsqueda-global-no-circular), [límites](../limitaciones.md#búsqueda-global-no-circular-formato-v07-qué-hace-y-qué-no),
[verificación](../verificacion.md#búsqueda-global-no-circular-v07)):

- Un bloque automático sobre capas débiles, con recocido simulado como respaldo, que genera superficies propias; el
  descarte sucesivo (4 → 3 → 1) elige la que se refina; el pulido y la guarda de tracción cierran la etapa.
- **El resultado nunca empeora:** el refinamiento de la v0.6 se calcula siempre y la etapa global solo lo reemplaza si da un
  FS estrictamente menor y elegible. Sin `global`, la salida es la de la 0.5.1 byte a byte.
- V053 pasa de 1,0847 (+7,4 %) a **1,0103**, dentro de la banda publicada (1,01 ± 3,5 %), con 48 de 48 semillas en la banda.
- **Decisiones medidas:** `auto` elige `block` solo con contactos entre regiones y recurre al recocido (E17a); la semilla es
  una rotación de Cranley-Patterson de la secuencia de Halton, y las proyecciones del bloque se inclinan de 15° a 75°, porque
  con 45° a 90° 472 de 500 candidatos no convergían (E17c); los materiales Hoek-Brown y SHANSEP no compiten en la elección de
  la capa (E17d).

**La web** (W1, C1W y W2):

- Borradores: se reinician con cada documento (`docEpoch` en `useDraft`), un borrador por eje, las tablas de puntos con una
  fila pendiente deshabilitan «Agregar» y «Quitar», y Ctrl+Intro calcula con el foco en un campo.
- Pantallas de 360 px o menos compactas: 0 controles bajo el pie en 8 viewports y 7 estados; el lienzo se reencuadra tras
  una edición si la vista sigue en el último encuadre automático.
- Selector de ejemplos con 7 destacados y un filtro accesible; el rótulo del documento en la cabecera del lienzo.
- Primera visita: importar sobre el modelo de arranque reemplaza y crea un modelo nuevo (título del archivo, solo sus
  materiales, sin agua, con la búsqueda de «Nuevo»); la guía parte del ejemplo abierto; el aviso de bloqueo nombra el primer
  error; hay un DXF y un CSV de ejemplo descargables; «Omitir» deja la guía cerrada de verdad; el diálogo explica de dónde sale
  la cota de cierre de una polilínea abierta.
- El recuadro del FS y el chip nombran el método que rige («FS mín. 1,401 · Morgenstern-Price»).
- El panel «Búsqueda global»: la casilla, el algoritmo, los candidatos, la semilla y el pulido; la tabla de resultados, el
  CSV, el informe y el HUD muestran el ganador, el algoritmo y los contadores; la Ayuda explica cuándo usarla y la guarda.

**La verificación:** xslope 1.1.0 como tercera columna informativa del harness
([detalle](../verificacion.md#xslope-110-como-columna-informativa)); 9 checks no circulares pasan a `verification/cases`
(CM-C2V).

## Puertas

Medidas por el coordinador en `3ca0f31` (`$TMPDIR/cm-coord/gates-int.log`), salvo donde se indica.

| Puerta | Resultado |
|---|---|
| `cargo fmt --all --check` y `clippy -D warnings` | sin diferencias ni avisos |
| `cargo test -p ogs-core --release`, con y sin `parallel` | **809 pasan**, 0 fallan, 3 ignorados (igual con `parallel`) |
| Aceptación | 347 checks, 0 fallas (antes de CM-C2V; la cifra final está en el bloque de abajo) |
| `ogs-cli` | 8 pasan |
| `pytest verification` (con cslope, shapely, jsonschema y xslope) | **1603 pasan**, 1 omitida |
| Identidad con la 0.5.1 (`--normalize-version --include-reinforced --include-v05 --include-v06 --with-v06`) | **0 diferencias en 196 modelos**; 24 con agua sobre el terreno, aparte |
| Harness frente a cSlope | 347/347 OK; cSlope reproduce 346/347 (V027) |
| Batería diferencial | búsqueda 28/28 y fija 28/28; Fase 3a 71 OK y 1 «ambos sin solución»; v0.4 12/12; v0.5 58/60 (2 explicados); F3B 41 OK y 1 explicado; 0 fallas |
| Wheel (`maturin build`, instalación y `pytest tests`) | **371 pasan**, 2 omitidas |
| Web: `tsc`, vitest y build | `tsc` en verde; **289 archivos y 4885 tests pasan**; el build deja 25 archivos en el precache de la PWA |
| Identidad de la web (`identity.f3b.mjs` y `identity.v07.mjs`) | todo igual contra la v0.4.0 y contra `b75f38a` |
| Compuertas del contrato A1 a A10 y A2b (CM-M, `verification/global/REPORT.md`) | todas pasan: V053 1,0103; 48/48 semillas; costo mediana 1,55 y máximo 3,81; WASM en Node 2,87 |
| Regresión e2e de la web tras W1 (51 guiones) | **OK = 1302, FAIL = 0** (la base de la 0.5.1: OK = 1226 y FAIL = 2, con dos guiones cortados por un `TimeoutError`) |
| `docs/tools/validar_ejemplos.py --ogs target/release/ogs --schema schema/ogs-0.7.schema.json` | **15 ejemplos y 116 fragmentos**, OK (antes: 14 y 103) |

Las cifras de V053 y de A1 a A10 se midieron con el binario `ogs 0.5.1`: la versión de los crates no cambió.

### Cifras que completa el coordinador tras CM-C2V

Estas cifras dependen de los casos promovidos o de la integración final. En este documento están en un solo lugar:

- Casos y checks de aceptación tras promover los 9 checks de F7.6: ⟨CASOS⟩ casos y ⟨CHECKS⟩ checks, con ⟨PROMOVIDOS⟩ de 9
  promovidos (y los retenidos de `verification/pending/CM/HOLD.json`, si hay).
- `cargo test -p ogs-core --release` y la aceptación finales: ⟨CARGO⟩.
- `pytest -q verification` final: ⟨PYTEST⟩.
- Vitest, `tsc` y build finales de `apps/web`: ⟨VITEST⟩.
- Regresión e2e de la web sobre la integración final (con el selector de ejemplos y los guiones de CM-C2V): ⟨E2E⟩.
- La medición de A7 en WASM sobre Chrome, que hace el coordinador al integrar: ⟨A7-CHROME⟩.
- El resultado de la revisión adversarial (RCM): ⟨RCM⟩.

## La compuerta de los 5 minutos

D4 de `docs/cm/PLAN_CM.md`: «primer FS de un usuario nuevo en menos de 5 minutos». Se mide de tres maneras, y cada una se
informa por separado. **Solo la tercera cierra la compuerta;** las dos primeras son aproximaciones.

Las tres tareas (los enunciados exactos de `docs/cm/exploracion/X35.md` §1):

- **T1:** abrir el ejemplo V001 (talud homogéneo de 20 m, 1,5H:1V) desde el menú Archivo y obtener su FS.
- **T2:** crear un talud simple de 10 m de alto, pendiente 1,5H:1V, sin agua, con cohesión 10 kPa, fricción 30° y peso
  unitario 19 kN/m³, y calcular su FS.
- **T3:** importar `terraplen.dxf` como modelo y calcular su FS.

### 1. Ruta mínima guionada (KLM)

Playwright cuenta las acciones de cada tarea y el modelo KLM (Kieras, 2001: K 0,28 s, M 1,20 s, P 1,1 s, BB 0,2 s, H 0,4 s)
las convierte en un tiempo. Los guiones están en `docs/cm/exploracion/X35_proto/`. Son los de CM-WC (`$TMPDIR/cm-wc/`) y de
CM-W2 (`$TMPDIR/cm-w2/`).

| Tarea | KLM en la 0.5.1 | KLM tras CM-WC y CM-W2 | Acciones (P / B / K / H / M) tras los cambios | Cálculo medido | FS mostrado |
|---|---:|---:|---|---:|---|
| T1 | 8,80 s | **8,80 s** | 4 / 8 / 0 / 0 / 3 | 0,51 s | 1,401 (Morgenstern-Price) |
| T2 | 19,22 s | **19,22 s** | 7 / 14 / 9 / 4 / 5 | 0,21 s | 1,570 (Spencer) |
| T3 | 18,42 s | **15,92 s** | 4 / 8 / 14 / 2 / 5 | 0,21 s | 1,568 (Spencer) |
| T3 con el destino por defecto | **bloqueada** (sin FS) | **15,92 s** | 4 / 8 / 14 / 2 / 5 | 0,21 s | 1,568 (Spencer) |

- **Ninguna tarea tiene más acciones que antes.** T3 baja un clic: «Reemplazar» ya es el destino por defecto sobre el modelo
  de arranque, y la variante con el destino por defecto, que bloqueaba el cálculo, ya da FS.
- El FS de T3 cambia de 1,567 (Janbu corregido) a 1,568 (Spencer), porque importar sobre el arranque crea un modelo nuevo y
  ya no arrastra el título, el material sobrante ni la búsqueda del ejemplo (W2). El cálculo baja de 1,11 s a 0,21 s
  (inferido: el modelo nuevo usa la búsqueda de «Nuevo»).
- **Lo que el KLM no mide:** leer, dudar y recuperarse de un error. El KLM de cada tarea es de 3 a 6 % de los 300 s.

### 2. Prueba a ciegas (agentes sin acceso al repo)

Tres agentes Haiku (`claude-haiku-5-5`), cada uno con un navegador limpio y solo la URL, sobre la integración con W1.
Los registros están en `~/.hermes/profiles/open-geoslide/cache/delegation/live/deleg_c2d4ab30/task-{0,1,2}.log`
(resumen en `briefs/CM_W2_tareas.md`). **Los tres resolvieron su tarea sin ayuda externa.**

| Tarea | FS | Estimación del agente para una persona | Medido por el agente (con su propia latencia) |
|---|---:|---|---|
| T1 | 1,401 | 30-45 s | 81,2 s desde la carga hasta ver el FS |
| T2 | 1,570 | 3-5 min | 105,8 s hasta pulsar «Comprobar»; 242,9 s hasta terminar de verificar el modelo |
| T3 | 1,567 | 60-90 s | no se registró un tiempo comparable; la tarea completa del agente duró 168 s |

Lo que encontraron, y lo que se hizo (W2):

- No sabían de qué método era el FS del HUD → el chip y la píldora nombran el método.
- T3 dejó restos del ejemplo ACADS 1(a) (título, un material «Soil» sin uso, agua, búsqueda y análisis) y el agente no supo
  qué modelo había calculado → importar sobre el arranque crea un modelo nuevo.
- El diálogo propuso «Cerrar con base horizontal, y = 24» sin decir qué era → el diálogo explica la cota y el área.
- T1: pulsar «Omitir» en el paso 2 pareció devolver a la guía al paso 1 → se corrigió: la guía queda cerrada, sin el cuadro
  oculto con «Paso 1 de 5» y sus botones en el DOM.

**Un agente tiene su propio costo de lectura:** el resultado orienta, no reemplaza al humano.

### 3. Protocolo humano — **pendiente del usuario**

Es la medición que cierra la compuerta. Está sin hacer. Qué hay que hacer (`docs/cm/exploracion/X35.md` §5):

1. Reclutar de 6 a 10 personas que no conozcan el programa. Rotar el orden de las tareas (6 órdenes para 6 personas).
2. Cada persona usa la versión candidata, desde una **ventana privada nueva** (sin `ogs.onboarding.v1`), en un navegador de
   escritorio normal. Se le da solo el enunciado de la tarea y, para T3, el archivo `terraplen.dxf`
   (`apps/web/public/examples/terraplen.dxf`).
3. Un observador cronometra desde Enter en la URL hasta ver el FS en el resumen, y cuenta clics, teclas y campos escritos.
4. Se llena `docs/cm/exploracion/X35_proto/planilla_humana.csv` (separador `;`, una fila por tarea y persona).
5. El FS de referencia de la 0.5.1 era 1,401, 1,570 y 1,567. **En la integración, T3 da 1,568 (Spencer):** el valor esperado
   de la columna `FS_en_rango_esperado` cambia para T3.

**Criterio propuesto** (X35 §5; son números para discutir, no salen de una medición): la compuerta pasa si las tres tareas
tienen `tiempo_s < 300` en al menos 8 de cada 10 personas, sin ayuda externa, y cada bloqueo lo resuelve la propia persona en
menos de 60 s. **Lo decide el usuario.**

## Pendiente

En orden de prioridad:

1. **El protocolo humano de los 5 minutos** (arriba). Sin él, la compuerta no está cerrada.
2. **La revisión adversarial (RCM)** del bloque, con dos lentes sobre un clon congelado, y sus olas correctivas.
3. **El diff de `docs/tools/validar_ejemplos.py`**: apunta por defecto al esquema 0.6, y el ejemplo de la v0.7 solo pasa con
   `--schema schema/ogs-0.7.schema.json`. Con la ruta por defecto fallan 8 comprobaciones. El diff está en el informe de CM-C2D.
   `gates_cm.sh` del coordinador llama al validador sin `--schema`.
4. **Las cifras de CM-C2V** en el README, en `docs/verificacion.md` y en `docs/limitaciones.md`: buscar `⟨`. También cambian
   las cifras fijas «347 checks» y «167 casos» (README, `docs/verificacion.md`, `docs/limitaciones.md`).
5. **La medición de A7 en Chrome** (V053 y S2, con y sin `global`): se midió en V8 de Node, no en el navegador.
6. **La versión:** `CHANGELOG.md`, `CITATION.cff`, las versiones de los crates y del wheel, y el «sube» del usuario.
7. **Las capturas del README** (`assets/readme/`): son de la 0.5.1; la web cambió (selector, rótulo, HUD con el método).
8. **Lo que el contrato dejó fuera:** el *path search* y el PSO; un pulido sin generador (el refinamiento de la v0.6 sigue sin
   pulido); los campos de cSlope que el formato no tiene (Hoek-Brown `mb`, `s` y `a`; SHANSEP `su_min`, `yield_stress`,
   `su_by_stress`, `anisotropy`, `yield_from_earlier_stage`, `above_water` y `b_bar`); Bishop con superficies no circulares.
9. **Los retenidos de siempre:** V002 (E16u), V009c (E13k) y V105a (`aboveWater`), más los de las demás carpetas de
   `verification/pending/`; y los tres taludes sin etapa global efectiva (TAL-H30-b60-f35-c5, TAL-H30-b60-f20-c30 y
   TAL-H10-b60-f35-c30), que llevan la nota `non_circular_global_no_candidates`.
10. **La paridad del bloque con el prototipo X37 no existe** (cambió en E17c); solo el recocido la tiene (40 de 40). La
    igualdad entre el motor nativo y WASM no se promete.
