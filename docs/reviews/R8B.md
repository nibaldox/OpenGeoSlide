# R8, lente B: cierre de R7 y calidad transversal (revisor independiente, deepseek-flash)

> **Nota del coordinador:** el revisor agotó su presupuesto de iteraciones antes de escribir este archivo. El contenido
> es su respuesta final, transcrita sin cambios de fondo. Los datos crudos quedaron en `$TMPDIR/r8/` (`s1-axe.json` …
> `s15-nav2.json`, `shots/`).

VEREDICTO: EXPERIENCIA BUENA

- **Commit auditado:** `3e723100`, en el worktree `r8b`, sin modificaciones ni commits.
- **Build:** `pnpm build` OK; `vite preview` en 127.0.0.1:5189.
- **Tests:** `vitest run` da 85 archivos; pasan 1568 tests y 37 se omiten.
- **Navegador:** Chrome estable con playwright-core.
- **Accesibilidad:** axe-core 4.14.1 con **todas** las reglas (sin `runOnly`), en 38 vistas o estados, cada uno en
  claro y en oscuro.
  - Resultado: **0 violaciones**.
  - Entre 22 y 28 nodos de `color-contrast` quedan como incompletos. Son texto SVG y se midieron aparte en el DOM:
    7,58:1 en claro y 12,02:1 en oscuro.

## 1. Cierre de R7 (R7-01 … R7-29)

| ID | Estado | Evidencia |
|---|---|---|
| R7-01 | CERRADO | `EditorApp.tsx:486` `surfaceConverged`; `:658` rótulo vía `resultCaption` (`reportInput.ts:109-113`); `ResultsTable.tsx:74` λ solo si `converged`; `csv.ts` `resultsToCsv` igual; `legendItems.test.ts:14` (discontinua + «Superficie evaluada (sin convergencia)»); `reportInput.test.ts:183` |
| R7-02 | PARCIAL | `GeometryPanel.tsx` (alta y baja de región, tabla de vértices), `ProjectPanel.tsx:1-60` (meta y unidades con confirmación), `EditorCanvas.tsx:920-929` (Acercar, Alejar, Encuadrar), rejilla en Geometría. **Falta la lectura en vivo de (x, y)**: no hay indicador del cursor en `EditorCanvas.tsx:920-947` |
| R7-03 | CERRADO | `ImportDialogs.tsx:26-47` `<dialog>` con `showModal()`; `ConfirmDialog.tsx:36`, `HelpDialog.tsx:65`; foco inicial correcto (medido: «Seguir editando»); reserva sobre el foco en R8-02 |
| R7-04 | PARCIAL | `keys.ts:113-141` (Tab, `[`, `]`, `+`, `-`, `0`), `:166-199` (Supr conserva el foco, medido `activeInCanvas:true`), `:258-266` (`circle_radius` con flechas), `EditorCanvas.tsx:647-649` `aria-describedby`. **Pero el «único punto de tabulación» no existe**: el `tabindex` rota en `onFocus` (`EditorCanvas.tsx:610-638`) y Tab recorre cada tirador. Con 344 tiradores, 12 Tab llevan de vértice 4 a vértice 15 (`s14-roving.json`) |
| R7-05 | CERRADO | `EditorApp.tsx:192-202` `loadDoc` → `resetEngine()`; `useEngineCheck.ts:38-56`; token en `engineCheck.ts` y `runGuard.ts`. Medido: tras «Nuevo», `fs=null`, `resultsTable=false`, sin el FS del modelo anterior |
| R7-06 | CERRADO | `ImportDialogs.tsx:170` `baseEdited ?? suggestBaseText(open, unit, units)`; `importPlan.ts:189` notas sin repetir |
| R7-07 | CERRADO | `EditorApp.tsx:106` `active`, `:458` guarda; `App.tsx:401`. Medido en Casos: Ctrl+S → 0 descargas; Ctrl+Z y R sin efecto |
| R7-08 | CERRADO | `reducer.ts:360-367`: `doc/load` vacía `history` y fija `file.name`. Medido: Ctrl+Z tras «Nuevo» no revive regiones ni desajusta el nombre |
| R7-09 | CERRADO | `App.tsx:64` `createRunGuard`, `:113/121/128/133` `isCurrent`, `:192/:202` `disabled={busy}` |
| R7-10 | CERRADO | `hitTest.ts:13-14` (16 px con ratón y 22 px táctil), `EditorCanvas.tsx:623` `touch-action: pan-x pan-y`, `App.css:818,1046` `clamp(320px,48dvh,640px)`. Medido: 390→405 px, 320→320 px, **0** objetivos menores de 24 px, deslizamiento táctil 0→349 px, **pellizco 26→58 px y 73→166 px** |
| R7-11 | PARCIAL | `issueNav.ts:27-79`, `DiagnosticsPanel.tsx:47-61`, `EditorApp.tsx:402-423`. Pero `/regions` → `null` (`issueNav.ts:33-35`, `k===null`): el error de modelo vacío sale **sin botón** (medido), igual que «no hay superficie válida» del motor |
| R7-12 | CERRADO | `LiveRegions.tsx` y `useAnnouncer.ts:15-35`; medido un solo anuncio: «Cálculo completado: Bishop FS 0,985; Spencer FS 0,984; 2 notas», y `alert` para errores |
| R7-13 | CERRADO | `MaterialsPanel.tsx` `ep-cards`, `LoadsPanel.tsx:41` tarjetas, `App.css:456-461` `.results/.table-scroll/.ep-table-wrap{overflow-x:auto}`; medido: tabla de 675 px en un contenedor de 344 px con desplazamiento, y página 390/390 |
| R7-14 | CERRADO | `client.ts:69-72` (`error` y `messageerror`), `:165-179` `cancel()` termina y recrea el Worker; `EditorApp.tsx:573-577` «Cancelar cálculo», medido con el aviso «Cálculo cancelado.»; `checkButtonState` deshabilita hasta `ready` |
| R7-15 | CERRADO | `tokens.css`: `--ui-ink-muted` 6,87:1, `--ui-control-border` 4,76/3,59:1, superficie `#a31515` 4,10:1 y `#fca5a5` 3,69:1 sobre material, halo de 6,5 px (`EditorCanvas.tsx:726`), foco 6,09/7,44:1 |
| R7-16 | CERRADO | `App.tsx:399-406` `main#main-content`; `useRovingTabIndex.ts` en ambas tablist y en la barra; medido ArrowRight Geometría→Materiales con `aria-selected=true` |
| R7-17 | CERRADO | `EditorApp.tsx:609-613`: `#ea-export-hint` visible («Pulse «Comprobar» para habilitar…») y `aria-describedby` en `:539/:542/:588` |
| R7-18 | CERRADO | `useDraftAutosave.ts:32` `beforeunload`. Medido `defaultPrevented:true` con un `localStorage` que lanza error y el aviso visible «…el borrador solo se conserva mientras la página esté abierta»; `updatePrompt.ts:8,41-45` «Más tarde» |
| R7-19 | CERRADO | `validateLocal.ts:22-47` `RULE_TEXT` con ejemplos y unidades («use un valor entre 0 y 0,99 (ej. 0,15)»); `DiagnosticsPanel.tsx:8-13` código y puntero solo dentro de `<details>` |
| R7-20 | CERRADO | `warnings.ts:83-86` sin «v0.1»; `:91-125` acción sugerida en `m_alpha/pole/no_driving/no_admissible_root/non_finite`; `:141-155` `WARNING_PATH` |
| R7-21 | CERRADO | `CheckTable.tsx:41` «Cumple/No cumple» (= `content.ts:381`); `ResultsTable.tsx:11-16` «Convergió/No convergió/No válida»; tiempo total solo en `tfoot` (`:90-97`) |
| R7-22 | CERRADO | `layout.ts:24-29,62-63,180-182`; `drawSection.ts:96,99` «x (ft)»; `WaterPanel` «Escriba 62,4 pcf… 9,81 (valor en kN/m³) no corresponde»; medido: vértices «x 20,0 ft» tras cambiar las unidades |
| R7-23 | CERRADO | `Fields.tsx:91-138`: `aria-describedby` con pista y error, `role="alert"` solo al confirmar. Medido: 0 alertas mientras se teclea y 1 al salir del campo |
| R7-24 | PARCIAL | Título «Ejemplo: ACADS 1(a): talud homogéneo seco», un solo «Comprobar», leyenda con bandas. Pero el verbo sigue partido («Calcular» en Casos) y al inicio hay **dos** mensajes redundantes «Pulse «Comprobar»…» |
| R7-25 | PARCIAL | `pdf.ts:39-43` `fetchFont` sin caché de módulo (solo la caché HTTP) y `toBinaryString(:45-52)` en cada exportación; DXF y CSV siguen en el hilo principal |
| R7-26 | CERRADO | `EditorApp.tsx:502-545` menús Archivo y Exportar; el botón principal y las herramientas quedan visibles. Reserva: a 320 px la barra mide 298 px |
| R7-27 | CERRADO | `styles/tokens.css` es el único con literales (más `no-hardcoded-colors.test.ts`), `report/palette.ts`, `theme.ts`, script en línea `index.html:8-21`. Primer pintado medido: `html` #f3f4f6 / #0b111b, sin destello |
| R7-28 | CERRADO | `openFile.ts:21-58` (confirmación antes de los avisos, `try/catch`), `singleFlight.ts` en `onSave` |
| R7-29 | PARCIAL | `ImportDialogs.tsx` con `useId`; quedan `NewSlopeDialog.tsx:127,131,166,170` con `name="ns-mode"/"ns-contact"`, y `.ec-visually-hidden` duplica `.visually-hidden` |

**Conteo: CERRADO 23 · PARCIAL 6 (02, 04, 11, 24, 25, 29) · ABIERTO 0.**

## 2. Hallazgos nuevos

| ID | Sev. | Archivo:línea | Problema | Por qué afecta | Corrección | Esf. |
|---|---|---|---|---|---|---|
| R8-01 | ALTA | `EditorCanvas.tsx:610-638` | El `tabindex` itinerante rota en `onFocus` (`onHandleFocus`→`ui/select`), así que Tab recorre **todos** los tiradores. Con 344 tiradores, 12 Tab llevaron de «vértice 4» a «vértice 15»; salir del lienzo exige unas 344 pulsaciones | Con un DXF real, el lienzo queda en la práctica inaccesible por teclado o con lector de pantalla. Es justo el defecto que R7-04 daba por cerrado | Un solo `tabindex=0` fijo (el primer o el último seleccionado) y navegación interna con `[`/`]` o AvPág/RePág; Tab entra y sale del lienzo | M |
| R8-02 | MEDIA | `ConfirmDialog.tsx:30-45` | Al confirmar o cancelar una acción lanzada desde un menú, el disparador ya no existe (`previous.isConnected===false`) y el foco cae en `<body>` (medido: `activeElement` es el cuerpo tras Esc en «Nuevo») | Quien usa teclado pierde su posición y tiene que tabular desde el principio tras cada descarte | `DropdownMenu` devuelve el foco a su `trigger` al cerrarse, o `ConfirmDialog` recibe un `fallbackFocus` estable (la barra o el lienzo) | S |
| R8-03 | MEDIA | `issueNav.ts:33-35` | `issueTarget` devuelve `null` para punteros de colección (`/regions`, sin índice). El error de modelo vacío, el primero que ve un usuario nuevo, se muestra como texto y no como botón (medido `button:false`) | El flujo «leer el error → ir a donde se corrige» no existe en los dos casos más frecuentes (modelo vacío y motor sin superficie) | Agregar destinos de colección (`/regions` → Geometría con foco en «Dibujar región…», `/analysis/search` → Búsqueda) y mostrar el botón siempre que haya pestaña | S |
| R8-04 | MEDIA-BAJA | `io/csv.ts:246`; `editor/app/reportInput.ts` | El CSV de resultados no declara unidades (`metodo,estado,fs,iteraciones,lambda,xc,yc,r,…`). Con `units=imperial` los números están en pies y no lo dice; el PDF sí lo indica (`content.ts:428`) | Un CSV sin unidades se reutiliza en otra planilla y se lee como metros: error de un factor 3,28 en xc, yc y r | Unidad en la cabecera (`xc_ft`) o una primera fila `unidades,Sistema imperial (ft, pcf, psf)` | S |
| R8-05 | BAJA | `tokens.css:71-72,139-140`; `ui/Legend.tsx` | La muestra «Dovelas» es `rgb(203 213 225 / .16)` sobre `#131c2b` (1,55:1) y `rgb(71 85 105 / .16)` sobre blanco (1,26:1): invisible en ambos temas (visto en captura) | La leyenda no explica qué son las líneas grises del lienzo; UX9-07 sigue abierto | Usar `--canvas-slice-edge` (3,18:1 sobre material) o una muestra de línea en lugar de un relleno translúcido | S |
| R8-06 | BAJA | `EditorApp.tsx:609-613` y `ResultSummary.tsx` | En la primera pantalla, dos mensajes distintos dicen lo mismo: «Pulse «Comprobar» para habilitar las exportaciones…» y «Sin resultados. Pulse «Comprobar» para calcular el factor de seguridad (FS).» | Ruido en el primer contacto; el estado vacío pierde fuerza | Dejar uno (el del resumen) y mostrar la pista de exportación solo después de editar | S |
| R8-07 | BAJA | `report/content.ts` (tabla §4) | En el PDF, la cabecera «Superficies evaluadas» se corta a mitad de palabra («Evaluada / s») por el ancho de la columna | Aspecto descuidado en un entregable que se imprime y se firma | Abreviar («Evaluadas», «Válidas») o repartir los anchos | S |
| R8-08 | BAJA | `EditorCanvas.tsx:328-348` | Cambiar de herramienta a mitad de un trazo descarta los puntos sin anunciarlo (medido: `live` sigue con «Punto 2 colocado…», sin mensaje de descarte) | El usuario cree que conserva el trazo y lo pierde sin enterarse | `onAnnounce('Trazo descartado: cambió de herramienta')` al limpiar el borrador | S |
| R8-09 | BAJA | barra en `App.css` y `EditorApp.tsx:500-596` | A 320 px, la barra mide 298 px (11 botones) y el lienzo empieza en y=610 de 844 | En un móvil pequeño se ve media pantalla de botones antes del modelo | Llevar Deshacer, Rehacer y las herramientas a un menú «Editar» o «Herramientas» bajo los 480 px | M |
| R8-10 | BAJA | `NewSlopeDialog.tsx:127,131,166,170`; `canvas.css:65` | Nombres fijos en los botones de opción (chocan si se montan dos diálogos) y `.ec-visually-hidden` duplica `.visually-hidden` | Deuda que reaparece al reutilizar el diálogo, y dos fuentes de verdad para el CSS de accesibilidad | `useId()` en los `name` y una sola clase `visually-hidden` | S |

## 3. Top 10 priorizado

1. **R8-01** (ALTA, M): Tab pasa por cada tirador. Anula el objetivo de R7-04 y bloquea el uso con teclado en modelos importados.
2. **R8-03** (MEDIA, S): las incidencias de colección no llevan a ningún lado, y es el error más común del primer uso (residual de R7-11).
3. **R8-02** (MEDIA, S): el foco cae en `<body>` al cerrar una confirmación abierta desde un menú.
4. **R8-04** (MEDIA-BAJA, S): el CSV sin unidades arriesga que se reutilicen pies como metros.
5. **R8-05** (BAJA, S): la muestra «Dovelas» no se distingue en ningún tema (UX9-07 pendiente).
6. **R7-25 residual** (MEDIA, S): caché en memoria de las fuentes del PDF (1,4 MB más la conversión binaria en cada exportación).
7. **R7-02 residual** (MEDIA, S): lectura en vivo de (x, y) sobre el lienzo.
8. **R8-08** (BAJA, S): avisar cuando se descarta un trazo por cambiar de herramienta.
9. **R8-06** (BAJA, S): un solo mensaje «Pulse «Comprobar»» en el estado inicial.
10. **R8-09 / R8-07** (BAJA, M/S): barra de 298 px a 320 px y cabecera de tabla cortada en el PDF.

## 4. Juicio global y cobertura

**Juicio.** Hoy la app ofrece una experiencia de buen nivel para un geotécnico que llega de cero:
- axe da 0 violaciones en 38 vistas o estados, en los dos temas, con **todas** las reglas;
- contraste medido de al menos 4,5:1 en texto y 3:1 en los trazos esenciales;
- reflujo sin desbordes a 320, 390, 768 y 1440 px, y objetivos de 24 px o más;
- pellizco y desplazamiento táctil funcionan (26→58 px; 0→349 px de desplazamiento);
- el PDF sale claro aunque la app esté en oscuro (2 páginas, 123 442 B, texto y figura correctos);
- sin destello de tema y con `prefers-reduced-motion` respetado.

**Rendimiento con 341 vértices:**
- interactivo en 97 ms, LCP 84 ms y CLS 0,0021;
- primer cálculo en 2 332 ms;
- arrastre de 147 fotogramas con mediana de 16,7 ms y p95 de 16,7 ms;
- 0 tareas largas en la carga, el cálculo, el tecleo y el dibujo.

Para llegar a «primer nivel» faltan tres cosas:
- la accesibilidad por teclado del lienzo (R8-01);
- que los errores lleven hasta el control que los causa (R8-03);
- unidades declaradas en los datos que se exportan (R8-04).

Se suman tres remates pequeños del PDF y la leyenda. Nada de esto es estructural: son correcciones S o M sobre una base
que ya es sólida.

**Cobertura.**
- **Revisado en vivo, en claro y en oscuro:**
  - editor con un ejemplo y las 9 pestañas;
  - «Nuevo material», diálogos DXF y CSV, «Talud simple», Ayuda;
  - confirmación de descarte, cambio de unidades con confirmación, resultados;
  - Casos de verificación con resultados;
  - guía de primera visita (pasos 1 a 5, en móvil y en Casos);
  - avisos (3 más «Ver 3 más» y «Cerrar todos»), cálculo cancelado y cambio en vivo del esquema de color del
    sistema.
- **Medido:**
  - contraste en el DOM y por token;
  - orden de tabulación (22 paradas) y recorrido del lienzo con 6 y con 344 tiradores;
  - foco tras los diálogos;
  - reflujo a 320, 390, 768 y 1440 px, zoom de texto al 200 % y tabla de resultados en móvil.
- **Revisado en código:** `EditorApp`, `App`, `reducer`, `store`, `engineCheck`, `client`, `keys`, `hitTest`,
  `layout`, `EditorCanvas`, `NoticeList`, `LiveRegions`, `ConfirmDialog`, `ImportDialogs`, `issueNav`,
  `DiagnosticsPanel`, `Fields`, `MaterialsPanel`, `LoadsPanel`, `GeometryPanel`, `ProjectPanel`, `warnings`,
  `validateLocal`, `csv`, `pdf`, `content`, `palette`, `useDraftAutosave`, `updatePrompt`, `GuidedTour`, `tokens.css`,
  `targets.css` y `NewSlopeDialog`.
- **No verificado:**
  - lector de pantalla real (NVDA o VoiceOver), red lenta y dispositivos táctiles físicos;
  - el PDF píxel a píxel; solo se inspeccionaron visualmente sus 2 páginas;
  - el caso real de un método no convergido con resultados presentes. Se probó con `max_iterations=1`, pero el motor lo
    rechaza antes de calcular. El cierre de R7-01 se apoya en el código y en `reportInput.test.ts:183`,
    `legendItems.test.ts:14` y `resultsTable.test.ts:39`.
