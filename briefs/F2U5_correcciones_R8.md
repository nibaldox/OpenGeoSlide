# Brief F2-U5: correcciones de R8 (2 escritores Sonnet en paralelo)

Responde en **español neutro, sin voseo**. Lee primero:
- `docs/reviews/R8A.md`, lente A (estado e interacción), veredicto MEJORABLE;
- `docs/reviews/R8B.md`, lente B (cierre de R7 y calidad transversal), veredicto EXPERIENCIA BUENA;
- `docs/fase2/ux/PLAN_UX.md`, cuyo contrato de tokens es normativo;
- las notas `docs/fase2/ux/U*_*.md` que toquen tus archivos.

**Base:** `main` en `3e72310`, con U1-U4 integradas.

## Arbitraje del coordinador (normativo)
Las dos lentes numeran sus hallazgos por separado. Aquí, **A-xx** se refiere a R8A y **B-xx** a R8B.

| Hallazgo | Decisión | Escritor |
|---|---|---|
| A-01: el trazo a medias sobrevive al cargar otro modelo (verificado en el código) | **Aceptado, ALTA** | E |
| A-03: con dos confirmaciones en cola se borra la región equivocada, por índice obsoleto (verificado en `GeometryPanel.tsx:151-157`) | **Aceptado y elevado a ALTA**: es pérdida de datos | E |
| B-01: Tab recorre cada tirador y salir del lienzo cuesta cientos de pulsaciones (verificado) | **Aceptado, ALTA** | E |
| A-02 y B-04: `units/set` solo cambia la etiqueta y el CSV no lleva unidades | **Aceptado.** Se agrega la opción de **convertir** valores y se declaran unidades en el CSV | E (conversión), S (CSV) |
| γw en imperial: el motor usa 9,81 por defecto aunque el modelo esté en unidades imperiales, y la web hoy solo avisa (`validateLocal.ts:351`) | **Aceptado, ALTA**: con 9,81 pcf las presiones de poros salen 6,4 veces menores y el FS queda del lado inseguro. Pasa a **error que bloquea el cálculo** | E |
| A-04 y B-08: cambiar de herramienta descarta el trazo sin avisar | Aceptado | E |
| A-08: el trazo a medias no cuenta como «cambios sin guardar» | Aceptado | E |
| A-05 y B-02: el foco cae en `<body>` si el disparador desaparece | Aceptado | S |
| A-06: Esc no cierra la guía si el foco está fuera de ella | Aceptado | S |
| A-07: los atajos siguen activos con la guía abierta | **Rechazado**: la guía es no modal por diseño (U3-O), así que usar la app con ella abierta es lo esperado. Se documenta en la ayuda | Ninguno |
| B-03: las incidencias de colección (`/regions`, búsqueda) no navegan | Aceptado | S |
| B-05: la muestra «Dovelas» de la leyenda es invisible | Aceptado | S |
| B-06: el mensaje «Pulse «Comprobar»» aparece duplicado | Aceptado | E (`EditorApp`) |
| B-07: la cabecera de la tabla del PDF se corta | Aceptado | S |
| B-09: a 320 px la barra ocupa 298 px | Aceptado | E |
| B-10: botones de opción con `name` fijo, y `.ec-visually-hidden` duplica `.visually-hidden` | Aceptado | E |
| R7-02 residual: falta la lectura de (x, y) del cursor | Aceptado | E |
| R7-24 residual: «Calcular» en Casos frente a «Comprobar» | Aceptado | S |
| R7-25 residual: caché de las fuentes del PDF | Aceptado. El análisis de DXF y CSV en un worker se pospone y queda documentado | S |
| R7-18: borrador compartido entre pestañas (A lo da por PARCIAL; B, por CERRADO) | Aceptado | S |

## Reglas comunes
Son las de `briefs/F2U4_estratos_pulido.md`:
- worktree propio y propiedad de archivos estricta;
- un test que falla antes del cambio;
- sin colores literales;
- nombres accesibles estables. Si alguno cambia, justifícalo y actualiza las copias de los recorridos;
- gates: `pnpm test`, `pnpm build`, paridad con `OGS_BIN` sin omitidos, ida y vuelta, y axe en claro y oscuro con 0
  violaciones serious o critical;
- commits con rutas explícitas y **sin push**.

**Recorridos de regresión:** todos los de `docs/fase2/ux/u3i-e2e/`, `u3m-e2e/`, `u3o-e2e/`, `u4m-e2e/` y `u4p-e2e/`
deben seguir pasando. Corre copias con tu puerto (`OGS_URL`, o un reemplazo de `127.0.0.1:518x`). Si actualizas un
recorrido por un cambio intencional, deja el motivo en un comentario.

- **Puertos:** E usa el 5186 y S el 5187. Mata tu servidor por PID.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.
- Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.

---

## U5-E: editor (worktree `u5e`, rama `u5e-editor`)

**Archivos tuyos:**
- `src/editor/EditorApp.tsx`, `src/editor/state/**`, `src/editor/types.ts` y `src/editor/canvas/**`;
- `src/editor/panels/{GeometryPanel.tsx,ProjectPanel.tsx,projectForm.ts}` y
  `src/editor/app/{NewSlopeDialog.tsx,newModel.ts,discard.ts,shortcuts.ts}`;
- `src/onboarding/helpContent.ts`, **solo** las filas de atajos;
- los tests de todo lo anterior.

**Tareas:**
1. **A-01.** Cualquier `doc/load` descarta el trazo de «Dibujar región» o «Dividir región» y lo anuncia. Pasa con Nuevo,
   Abrir, Ejemplos, Talud simple y Recuperar borrador. Usa, por ejemplo, un contador `docEpoch` en el store que cambie
   en cada carga y que el lienzo observe. **Test:** con 2 puntos colocados, «Nuevo» y luego Intro no crean ninguna región.
2. **A-03.** Elimina la región **por identidad**: la referencia del objeto `doc.regions[i]`, tomada al abrir el diálogo.
   Si la región ya no existe al confirmar, no borra nada y muestra un aviso. **Test:** dos confirmaciones en cola borran
   exactamente las dos regiones pedidas.
3. **B-01, una sola parada de tabulación en el lienzo:**
   - Tab y Mayús+Tab **entran y salen** del lienzo;
   - dentro, `[` y `]` (y también AvPág y RePág) recorren los tiradores;
   - el tirador activo es el seleccionado, o el último activo, o el primero;
   - actualiza el texto de `aria-describedby`, la ayuda (`helpContent.ts`, solo la fila de atajos) y
     `docs/fase2/ux/U2C_lienzo_teclado.md`;
   - **Chrome:** con 344 tiradores, como en el modelo de 341 vértices del recorrido de rendimiento, salir del lienzo
     toma **1 Tab**.
4. **Conversión de unidades (A-02):**
   - `src/editor/state/units.ts` exporta `convertDocUnits(doc, to)`, una función pura;
   - convierte las longitudes: coordenadas, radios, parámetros de longitud de la búsqueda y x de las cargas;
   - convierte γ, γsat y γw (1 kN/m³ = 6,365880 pcf), c y q (1 kPa = 20,885434 psf) y la carga lineal p
     (1 kN/m = 68,521766 lbf/ft). No cambian kh, kv, los ángulos ni ru;
   - los factores van tabulados con su fuente;
   - el comando `units/convert` es **un solo paso deshacible**;
   - en `ProjectPanel`, el cambio de unidades abre un diálogo propio (`<dialog>` en tu archivo) con tres opciones:
     «Convertir los valores» (la recomendada y por defecto), «Solo cambiar la etiqueta» (`units/set`, con la
     advertencia actual) y «Cancelar»;
   - **tests:**
     - ida y vuelta SI → imperial → SI con error relativo menor que 1e-9;
     - **el FS no cambia:** el mismo modelo, en SI y convertido a imperial, da el mismo FS en Bishop y Spencer con
       `OGS_BIN`, con diferencia menor que 1e-6. Usa al menos un caso con agua, carga y sismo.
5. **γw en imperial:**
   - en `validateLocal`, la regla `waterUnitWeightImperial` pasa de aviso a **error**, que bloquea «Comprobar». Se
     aplica cuando hay piezométrica, las unidades son imperiales y γw falta o vale 9,81;
   - el mensaje es accionable e incluye el **botón para ir a Agua**;
   - «Talud simple…» en imperial y la conversión a imperial escriben 62,4 explícitamente. Al convertir, 9,81 kN/m³ se
     vuelve 62,45 pcf; documéntalo;
   - revisa que ningún ejemplo ni test quede bloqueado sin motivo.
6. **Trazo y herramientas (A-04, B-08 y A-08):**
   - cambiar de herramienta con un trazo de 3 o más puntos pide confirmación con `useConfirm`, de tono `danger`;
   - con 1 o 2 puntos, descarta el trazo y lo anuncia;
   - `confirmDiscard` cuenta un trazo con puntos como cambio sin guardar.
7. **B-06:** que solo quede un mensaje «Pulse «Comprobar»» en el estado inicial. La pista de exportación aparece solo
   cuando hay un resultado obsoleto o se intenta exportar.
8. **B-09:** con un ancho de 480 px o menos, las herramientas y Deshacer/Rehacer pasan a un menú «Editar» con el
   patrón de `DropdownMenu`. Conserva los nombres accesibles de cada acción. **Medida:** a 320 px la barra mide 120 px
   de alto o menos, y el lienzo empieza antes de y = 400.
9. **R7-02:** lectura en vivo de x e y del cursor, o del cursor de teclado en las herramientas de trazo, con su unidad.
   Va en una esquina del lienzo, en una sola línea, sin tapar contenido y con `aria-hidden`. El cursor de teclado ya se
   anuncia por su cuenta.
10. **B-10:** `useId()` en los `name` de los botones de opción de `NewSlopeDialog`, y una sola clase `visually-hidden`;
    elimina `.ec-visually-hidden`.
11. **Chrome:**
    - reproduce A-01, A-03 y B-01 antes del cambio (deben fallar) y después (deben pasar);
    - conversión de unidades con el FS igual;
    - γw bloqueado;
    - barra a 320 px;
    - axe en claro y oscuro.

---

## U5-S: salida y cierre (worktree `u5s`, rama `u5s-salida`)

**Archivos tuyos:**
- `src/ui/**`, en particular `ConfirmDialog.tsx`, `confirmQueue.ts`, `DropdownMenu.tsx`, `Legend.tsx` y
  `legendItems.ts`;
- `src/onboarding/{GuidedTour.tsx,tour.ts}`, pero **no** `helpContent.ts`;
- `src/editor/app/{issueNav.ts,ResultSummary.tsx,resultSummary.ts,reportInput.ts,useDraftAutosave.ts}` y
  `src/editor/panels/DiagnosticsPanel.tsx`;
- `src/io/csv.ts` y `src/report/**`;
- `src/styles/tokens.css`, **solo** la muestra de dovelas de la leyenda;
- `src/App.tsx`, solo el verbo de Casos y lo que dependa de él;
- los tests de todo lo anterior.

**Tareas:**
1. **A-05 y B-02, foco de respaldo:**
   - `DropdownMenu` devuelve el foco a su disparador cuando un elemento ejecuta una acción;
   - `useConfirm` acepta `returnFocus?: HTMLElement | (() => HTMLElement | null)`;
   - si el elemento previo ya no está conectado, el foco va al disparador del menú o a `#main-content`, que lleva
     `tabindex=-1`;
   - **Chrome:** «Archivo ▸ Nuevo» con cambios, después Esc: el foco queda en «Archivo». Al eliminar la última tarjeta
     de región, el foco no cae en `<body>`.
2. **A-06:** mientras la guía está abierta, Esc la cierra desde cualquier lugar, salvo que haya un `<dialog>` abierto,
   que tiene prioridad. **Test.**
3. **B-03, navegación desde las incidencias:**
   - `/regions` lleva a Geometría y enfoca «Dibujar región…»;
   - `/analysis/search` y `/analysis/surface` llevan a sus pestañas;
   - «no hay superficie válida» del motor lleva a Búsqueda;
   - el botón aparece siempre que la incidencia tenga un destino;
   - la tabla de destinos lleva tests.
4. **B-04, unidades en el CSV:**
   - las columnas con dimensión llevan la unidad en la cabecera: `xc_m` o `xc_ft`, `r_m` o `r_ft`, y similares;
   - la primera línea es un comentario `# unidades: SI (m, kN/m³, kPa)`, o su equivalente imperial;
   - la importación del CSV de **geometría** sigue aceptando los archivos actuales; no confundas los dos CSV;
   - **test** de la cabecera en SI e imperial. El PDF ya declara las unidades: comprueba que también lo haga en las
     tablas de materiales y cargas.
5. **B-05:** en la leyenda, la muestra de «Dovelas» pasa a ser una línea con `--canvas-slice-edge`, con contraste de al
   menos 3:1 sobre el material en los dos temas. Agrega el par al test de contraste.
6. **B-07:** la cabecera de la tabla del PDF no se corta a mitad de palabra. Abrevia o reparte los anchos, y agrega un
   test del ancho medido con la fuente.
7. **R7-25:** caché de módulo para las fuentes del PDF y su conversión binaria. **Medida:** la segunda exportación no
   vuelve a pedir las fuentes y tarda menos. El análisis de DXF y CSV en un worker se pospone: documéntalo.
8. **R7-24:** usa un solo verbo. En Casos el botón pasa a ser «Comprobar casos», o el nombre que juzgues mejor,
   justificándolo. Actualiza las copias de los recorridos que lo usen.
9. **R7-18:** el borrador va **por pestaña**: una clave con id de pestaña en `sessionStorage` y un índice en
   `localStorage`. Con `BroadcastChannel`, si el mismo borrador está abierto en otra pestaña, aparece un aviso no
   bloqueante. «Recuperar borrador» ofrece el más reciente. **Tests** con la lógica pura.
10. **Chrome:**
    - foco tras los diálogos y menús;
    - navegación desde las incidencias de colección;
    - CSV con unidades;
    - PDF con las cabeceras completas: render de la página como captura, revisada con visión;
    - leyenda en los dos temas;
    - axe en claro y oscuro.
