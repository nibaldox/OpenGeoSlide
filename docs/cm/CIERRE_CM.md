# Cierre del bloque CM: búsqueda global no circular y cierre del MVP (28-nov-2026)

Rama `cm-integracion`, sobre v0.5.1 (`main` `1d1d097`). Plan: `docs/cm/PLAN_CM.md`. Contrato: `briefs/06_CONTRATOS_CM.md`,
con F7.0 a F7.7 y las enmiendas E17a a E17f (las dos últimas, de la revisión adversarial). La versión del formato es la
**v0.7** (la versión de los crates la decide el usuario al publicar; el plan propone la 0.6.0). **Nada de este bloque está
publicado.**

## Olas

| Ola | Qué hizo | Escritores |
|---|---|---|
| CX | Exploración X31 a X36: algoritmos globales, los 10 checks no medidos, el formato y la web, la web (borradores, pantallas bajas, HUD), la primera visita (KLM y protocolo) y xslope | 6 × Haiku |
| W1 | Web del MVP: borradores y editor (CM-WA), pantallas bajas y HUD (CM-WB), primera visita (CM-WC); xslope como columna informativa (CM-V) | Sonnet |
| X37 | Prototipo de la búsqueda global sobre las dovelas del motor, con las filas de aceptación: el bloque (G2) cierra V053; *path* (G1) no mejora ningún caso válido y queda fuera | Haiku |
| C0 | Contrato (F7.0 a F7.7), tipos del formato v0.7, esquema `ogs-0.7.schema.json`, ganchos y tests en rojo | coordinador y Terra |
| C1 | Motor: búsqueda global (bloque, recocido, descarte sucesivo, pulido y guarda de tracción), con A1 a A10 (CM-M); web de la búsqueda global: panel, salidas, avisos y Ayuda (CM-C1W) | Terra y Sonnet |
| E17a a E17d | Enmiendas del contrato que mide el motor: `auto` y el respaldo al recocido (E17a); descarte sucesivo y robustez frente a la semilla (E17b); Halton rotado y proyecciones de 15° a 75° (E17c); capas con HB, SHANSEP y no drenado, y los tres taludes sin etapa global (E17d, cuyo punto 1 reemplazó E17e) | coordinador y CM-M |
| W2 | Lo que encontró la prueba a ciegas de los 5 minutos: el HUD nombra el método, importar sobre el arranque crea un modelo nuevo, la base de la polilínea abierta se explica y «Omitir» sin restos | Sonnet |
| C2 | Cierre: casos promovidos (CM-C2V) y documentación (CM-C2D, este documento) | 2 × Sonnet |
| RCM | Revisión adversarial con dos lentes en un clon congelado (`72abec6`): la lente A (motor, guarda y compuertas) y la lente B (web). Las dos dan «apto con correcciones»; los arbitrajes son E17e y E17f ([abajo](#la-revisión-adversarial-rcm)) | 2 lentes |
| CM-M2 | Correcciones del motor por la lente A (E17e) y las compuertas regeneradas | Sonnet |
| CM-W3A y CM-W3B | Correcciones de la web por la lente B (E17f): salidas (PDF, recuadro, Ayuda, chip) y editor (algoritmo inválido, accesibilidad, borradores) | 2 × Sonnet |
| Medición | La compuerta de los 5 minutos sobre el candidato a versión, y A7 en Chrome | las dos primeras mediciones de los 5 minutos y A7 en Chrome, hechas; la humana, **pendiente del usuario** |
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
  con 45° a 90° 472 de 500 candidatos no convergían (E17c); la capa débil se elige con la resistencia efectiva en
  σ′v = γ·z·(1 − ru), y compiten Mohr-Coulomb, `undrained`, Hoek-Brown y SHANSEP (E17e, que reemplazó la exclusión de HB y
  SHANSEP de E17d).

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
  CSV y el informe muestran el ganador, el algoritmo y los contadores, y el HUD, una sola línea con el ganador; la Ayuda
  explica cuándo usarla y la guarda.

**La verificación:** xslope 1.1.0 como tercera columna informativa del harness
([detalle](../verificacion.md#xslope-110-como-columna-informativa)); 9 checks no circulares pasan a `verification/cases`
(CM-C2V).

## Puertas

Medidas por el coordinador en `3ca0f31` (`$TMPDIR/cm-coord/gates-int.log`), **antes de la revisión RCM y de sus correcciones**, salvo donde se indica. Las cifras de después, en el bloque de abajo.

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

### Cifras después de CM-C2V y de la revisión RCM

Estas cifras dependen de los casos promovidos, de las correcciones de la revisión o de la integración final. En este documento
están en un solo lugar:

- **Casos y checks de aceptación tras promover los 9 checks de F7.6: 175 casos y 356 checks**, con **9 de 9** promovidos y
  ninguno retenido (`verification/pending/CM/HOLD.json` vacío). ogs reproduce 356 de 356; cSlope, 355 de 356 (V027 no
  converge). Los retenidos de todo `verification/pending/` siguen siendo 18 checks en 12 casos. En la web, la ida y vuelta es
  de 418 modelos (356 checks, 56 diferenciales y 6 de frontera) y pasa.
- **Identidad con la 0.5.1 tras CM-M2:** 0 diferencias en **202 modelos** (variantes `own`, `search`, `fixed`, @0.4 y @0.6), y
  los 26 modelos con agua sobre el terreno, idénticos. V053 ya está en `verification/cases` como v0.7, y la identidad lo
  compara sin `global` y como 0.6.
- **La medición de A7 en Chrome real** (HeadlessChrome 158, `verification/global/a7_chrome.json`): V053 **2,83 veces** el
  circular (0,373 s a 1,057 s) y S2 **1,94 veces** (0,351 s a 0,680 s), con el FS igual al nativo a **1,8e-14 o menos** (a
  1,3e-15 o menos en el resultado con `global`). Está por debajo del tope de 4 veces, y casi igual a la medición en V8 de Node
  (2,83 y 1,96).
- **El resultado de la revisión adversarial (RCM):** las dos lentes, «apto con correcciones». Los 5 hallazgos ALTA del motor y
  los 7 de la web, corregidos ([abajo](#la-revisión-adversarial-rcm)).
- `cargo test -p ogs-core --release` y la aceptación finales, en `b0044ce`: **827 pasan y 0 fallan, con y sin `parallel`** (3
  ignorados); aceptación **356 checks, 0 fallas**; `fmt` y `clippy` limpios; los 8 tests de la CLI pasan.
- `pytest -q verification` final, en `b0044ce`: **1609 pasan y 1 omitido**. Harness: 356/356 OK y cSlope 355/356. Batería
  diferencial: búsqueda 28/28, fija 28/28, fase 3a 71/71, v0.4 12/12, v0.5 58/60 (2 explicados) y F3B 41/42 (1 explicado), sin
  fallas. Identidad: 0 diferencias en 202 modelos frente a la 0.5.1. El wheel: 373 pasan y 2 omitidos.
- Vitest, `tsc` y build finales de `apps/web`, en `b0044ce` y con el motor v0.7 (`OGS_V07_ENGINE=1`): **294 archivos y 4974
  tests, todos pasan**; `tsc` limpio; build con 25 archivos en el precache. Identidad del informe: igual contra v0.4.0 y contra
  `b75f38a`, salvo las 15 diferencias declaradas del PDF que dibuja el método que rige (E17f §2).
- Regresión e2e de la web sobre la integración final, en `b0044ce` y con el WASM v0.7: **53 guiones, OK = 1440, FAIL = 0**, y
  ninguno se corta antes de terminar (la base de la 0.5.1: OK = 1226, FAIL = 2 y dos guiones cortados por un `TimeoutError`).

## La revisión adversarial (RCM)

Dos revisores independientes, cada uno con su lente, sobre un clon congelado de `cm-integracion` (`72abec6`, comparado con la
0.5.1). Cada uno ejecutó lo que afirma, y sus reproductores y modelos están en
`~/.hermes/profiles/open-geoslide/cache/scratch/rcm-A/` y `rcm-B/`:

| Lente | Qué revisó | Informe | Hallazgos | Veredicto |
|---|---|---|---|---|
| **A** | El motor: `global.rs`, `noncircular.rs`, el formato, la guarda, el determinismo y las compuertas (más de 110 corridas adversariales contra cSlope) | `rcm-A/RCM_A.md` | 11: 5 ALTA, 5 MEDIA y 1 BAJA | **apto con correcciones** |
| **B** | La web, en Chrome con el WASM v0.7: propagación de la versión, salidas (tabla, CSV, PDF, recuadro), borradores, primera visita, pantallas bajas y accesibilidad con axe | `rcm-B/RCM_B.md` | 15: 7 ALTA, 5 MEDIA y 3 BAJA | **apto con correcciones** |

**Lo que comprobaron y quedó bien.** La lente A: 0 diferencias de identidad en 196 modelos más 24 con agua (y en 10 modelos
v0.7 sin `global`), 0 violaciones de monotonía, 0 fugas de la guarda, todos los ganadores globales evaluados en cSlope a 0,05 % o
menos, 0 diferencias entre el binario serial y el `parallel` en 9 modelos, y 48 de 48 semillas distintas (la rotación de
Cranley-Patterson es real). La lente B: la propagación de la versión 0.7 (activar, editar, guardar, reabrir, desmarcar,
deshacer), una matriz de 21 casos borde contra el motor, el motor simulado sin inventar FS, los borradores y la primera visita
a 320 × 568 y 1440 × 900 sin solape con «Comprobar», y 0 violaciones de axe en el panel de búsqueda global y en los diálogos.

### Hallazgos altos y qué se hizo

| Hallazgo | Problema | Corrección |
|---|---|---|
| **RCM-A-01** | `project()` marchaba a paso fijo según el relieve del terreno: un terreno casi plano con una capa profunda colgaba el motor (más de 60 s) | Intersección exacta del rayo con el terreno; la altura del recocido tiene un piso (E17e §1). Con el reproductor: 0,35 s |
| **RCM-A-02** | `auto` elegía `block` sobre las «bases» del fondo cuando todas las regiones eran Hoek-Brown o SHANSEP | `auto` decide por las aristas de la capa elegida; las bases nunca cuentan (E17e §2) |
| **RCM-A-03** | La nota `non_circular_global_tension_rejected` salía con `tension_rejected = 0` | Se documenta: el contador cuenta la generación y la nota cubre toda la etapa; el texto de la web ya no sugiere otra cosa (E17e §6) |
| **RCM-A-04** | `max_vertices` se ignoraba con `global`: 33 vértices con `max_vertices: 9` | La etapa global respeta el tope; con 9, la polilínea tiene 9 vértices y V053 da 1,0194 (E17e §3) |
| **RCM-A-05** | El motor aceptaba `global` como arreglo (exit 0) y el esquema y la web lo rechazaban | `global` y `non_circular` solo admiten un objeto: `InvalidModel` (E17e §5) |
| **RCM-B-01** | El PDF escribía la semilla `9007199254740991` como `9007200000000000` | La semilla sale entera, con un test (CM-W3A) |
| **RCM-B-02** | 7 botones de «Ejemplos destacados» con una violación `serious` de axe (WCAG 2.5.3) | El texto visible es el nombre accesible (CM-W3B) |
| **RCM-B-03** | La web aceptaba un `algorithm` inexistente, lo mostraba como «Automático» y una edición lo borraba | `openOgsJson` lo rechaza con `io.shape` (E17f §3, CM-W3B) |
| **RCM-B-04** | «Nuevo material» no se reiniciaba con `docEpoch` | Reinicio con el documento (CM-W3B) |
| **RCM-B-05** | La tabla de OCR por cota de SHANSEP no bloqueaba filas pendientes e insertaba una fila vacía desde `NaN` | Bloqueo como en las demás tablas, sin `NaN` (CM-W3B) |
| **RCM-B-06** | El PDF dibujaba la superficie del primer método que convergió, no la del que rige | La del método que rige, como el lienzo y el HUD (E17f §2, CM-W3A); cambia la identidad del PDF en 5 modelos, declarada |
| **RCM-B-07** | El HUD no mostraba nada de la búsqueda global | Una línea: «ganó (bloque)» o «(recocido)», «no mejoró el refinamiento» o «sin candidatos» (E17f §1, CM-W3A) |

También se corrigieron los hallazgos MEDIA y BAJA: la elección de la capa con la resistencia efectiva de Hoek-Brown y SHANSEP
(RCM-A-06 y A-11, con `ru` incluido), el mejor par entre niveles del refinamiento (A-07), la medición de A4, A8 y A7 (A-08), los
mensajes de rango y la descripción del esquema (A-09 y A-11), la Ayuda al día con el descarte sucesivo (B-08), la importación
sobre el arranque y deshacer (B-09), el chip parcial (B-10), la etiqueta del filtro (B-11), los rótulos de carga del PDF y la
tabla global sin cortar (B-12), la tabla del refinamiento (B-13) y la leyenda de atajos (B-15). **RCM-A-10** (`to_cslope.py`
acepta la versión 0.7) ya lo había hecho CM-C2V.

**Lo que no se cambió, a propósito.** E17f §4 deja la versión en memoria de la web como un piso: lo que va al motor y al
archivo es la versión mínima de los campos (RCM-B-14). E17e §8 deja sin cambio los enteros escritos como `50.0` (inválidos en
el motor, aceptados por el esquema) y la clasificación `Json` de un enum con el tipo equivocado (RCM-A-09), que es la de los
enums de la v0.6: queda como limitación.

### Las enmiendas

- **E17e** (lente A; reemplaza E17d §1): `project()` exacto, la capa con la resistencia efectiva de los cuatro modelos,
  `max_vertices` en la etapa global, el mejor par entre niveles, `GlobalSpec` solo objeto, `tension_rejected` y su nota, `refined`
  (0 o 1), los mensajes y la medición (A4 sobre `extra`, Janbu y Morgenstern-Price; A8 con los elegibles; A7 con el margen).
- **E17f** (lente B): la línea de búsqueda global en el HUD, el PDF con el método que rige, `algorithm` inválido rechazado al
  abrir, y la versión en memoria como piso.

Las dos están en `briefs/06_CONTRATOS_CM.md`.

### Las olas correctivas

| Ola | Qué hizo | Cifras |
|---|---|---|
| **CM-M2** (`5d8da66`, `a66a1ba`, `83a15fb`) | E17e §1 a §8 en el motor, con un test por punto, y las compuertas regeneradas: A4 sobre 38 ganadores (con Janbu y Morgenstern-Price), A8 con los elegibles, A7 con el margen, los seis reproductores antes y después, V053 en v0.7 | 827 tests de `ogs-core` (809 antes), con y sin `parallel`; A1 a A10 y A2b pasan; identidad en 202 modelos; costo mediana 1,56 y máximo 3,81 (margen 0,19); A5 57 de 57; V053 1,0103 con 48 de 48 semillas |
| **CM-W3A** (`bdeeaad`, `005dd12`, `257026e`, `9a86740`) | Las salidas de la web: PDF (semilla, método que rige, rótulos de carga, tabla global, ganador del refinamiento), línea «Búsqueda global» del HUD, Ayuda y nota de tracción, chip parcial y leyenda de atajos (RCM-B-01, 06, 07, 08, 10, 12, 13 y 15) | typecheck, vitest (291 archivos, 4956 tests) y build en verde; 17 guiones e2e con OK = 463 y FAIL = 0; la identidad del PDF cambia en 5 modelos (RCM-B-06), declarada en los guiones |
| **CM-W3B** (`3d56643`, `94e2636`, `c1ecb50`, `6005e79`, `bb276b7`, `730b2ab`) | El editor: `algorithm` inválido rechazado, destacados y filtro accesibles, «Nuevo material» con `docEpoch`, tabla OCR de SHANSEP, deshacer la importación sobre el arranque (RCM-B-02, 03, 04, 05, 09 y 11) | typecheck, vitest (292 archivos, 4943 tests) y build en verde; 20 guiones e2e con FAIL = 0 |

Las dos olas de la web se midieron cada una en su rama. La integración final de las tres, con las puertas completas, la mide el
coordinador (arriba).

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
2. **Las cifras de los tests «medidas en el commit de versión»** del CHANGELOG, que se toman al hacer ese commit. Las puertas
   finales de la integración ya están arriba.
3. **La versión:** las versiones de los crates y del wheel, `CITATION.cff` y el «sube» del usuario. El `CHANGELOG.md` ya tiene
   la sección `[Unreleased]`. Tras el commit de versión, la barra de estado de las capturas del README dice `ogs-core 0.5.1`
   (la versión de los crates cuando se capturaron): conviene regenerarlas con `assets/readme/src/capture-app.mjs`.
4. **Lo abierto de la revisión:** los rótulos `q = …` apilados en el lienzo con V051; la versión en memoria de la web (piso);
   y los mensajes de enum con el tipo equivocado (`Json` en vez de `InvalidModel`).
5. **Lo que el contrato dejó fuera:** el *path search* y el PSO; un pulido sin generador (el refinamiento de la v0.6 sigue sin
   pulido); los campos de cSlope que el formato no tiene (Hoek-Brown `mb`, `s` y `a`; SHANSEP `su_min`, `yield_stress`,
   `su_by_stress`, `anisotropy`, `yield_from_earlier_stage`, `above_water` y `b_bar`); Bishop con superficies no circulares.
6. **Los retenidos de siempre:** V002 (E16u), V009c (E13k) y V105a (`aboveWater`), más los de las demás carpetas de
   `verification/pending/` (18 checks en 12 casos; el lote CM no retiene ninguno); y los tres taludes sin etapa global efectiva
   (TAL-H30-b60-f35-c5, TAL-H30-b60-f20-c30 y TAL-H10-b60-f35-c30), que llevan la nota `non_circular_global_no_candidates`.
7. **La paridad del bloque con el prototipo X37 no existe** (cambió en E17c); solo el recocido la tiene (40 de 40). La igualdad
   entre el motor nativo y WASM no se promete (en Chrome, el FS coincide a 1,8e-14 o menos).
