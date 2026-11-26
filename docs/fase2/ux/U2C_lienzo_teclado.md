# Lienzo del editor: teclado, táctil y zoom (U2-C)

Hallazgos que cubre: R7-04, R7-10, parte de R7-02, UX-02 y UX-05. Código en `apps/web/src/editor/canvas/`.

## Teclado

El lienzo es **una sola parada de tabulación** (tabindex itinerante): el tirador activo (el seleccionado, o el último que
lo estuvo, o el primero) tiene `tabindex="0"` y los demás `-1`. (Hasta U4 `Tab` también recorría los tiradores, y con 344 salir del
lienzo costaba cientos de pulsaciones: R8 B-01. Desde U5-E el recorrido es solo con `[ ]` y `AvPág`/`RePág`.) El elemento `<svg role="application">` se describe con
`aria-describedby` (texto de `CANVAS_INSTRUCTIONS` en `EditorCanvas.tsx`).

| Tecla | Acción |
|---|---|
| `Tab` / `Mayús+Tab` | **Entran al lienzo y salen de él.** El lienzo es una sola parada de tabulación: el canvas no atiende Tab, de modo que el navegador pasa al siguiente (o anterior) elemento enfocable de la página, sin importar cuántos tiradores haya. |
| `]` / `[` (también con AltGr u Option), `AvPág` / `RePág` | Tirador siguiente / anterior, dando la vuelta. Entran al lienzo desde una selección que no sea un tirador (primero o último). |
| Flechas | Mueven el tirador seleccionado 1 paso de rejilla (0,1 sin rejilla); `Mayús` = ×10. En `circle_radius` cambian el radio (derecha/arriba +, izquierda/abajo −); en `circle_center` mueven el centro. Sin tirador seleccionado desplazan la vista 40 px (`Mayús` ×4). |
| `Insert` o `i` | Con un vértice seleccionado, inserta otro en el punto medio de la arista siguiente (la de cierre, si es el último) y le pasa el foco. «i» existe porque muchos portátiles no tienen `Insert`. |
| `Supr` / `Retroceso` | Elimina el vértice (mínimo 3 por región) o el punto de la piezométrica (mínimo 2); el foco pasa al vecino anterior. Si no se puede, se anuncia. |
| `+` o `=`, `-` (también con AltGr u Option), `0` | Acercar, alejar y encuadrar. El zoom se hace alrededor del tirador seleccionado si se ve; si no, del centro. |
| `Escape` | Quita la selección y devuelve el foco al lienzo (después las flechas desplazan la vista). |
| `Ctrl+Z`, `Ctrl+Mayús+Z`, `Ctrl+Y` | Deshacer y rehacer. |

**Decisión sobre `+`:** el brief pedía que `+` insertara un vértice y a la vez que `+`, `-` y `0` hicieran zoom. Los dos usos
chocan con un vértice seleccionado (casi siempre), así que `+` hace zoom e insertar es `Insert` o `i`.

El foco se mueve al tirador pedido después de que React pinte (insertar, eliminar, recorrer). Si el elemento enfocado es un
tirador y la selección está vacía, el tirador enfocado es el punto de partida.

## Anuncios

`onAnnounce(msg)` se llama al mover, insertar o eliminar (por teclado) y al terminar un arrastre con el puntero, con
mensajes como «Vértice 3 de la región 1: x 31,4 m, y 26,4 m», «Vértice insertado. …», «Vértice eliminado. Foco en el
vértice 2 …» o «No se puede eliminar: la región necesita al menos 3 vértices». Las unidades salen de la prop `units` (o,
si falta, de `doc.units`). Si **no** se pasa `onAnnounce`, el lienzo trae su propia región `aria-live="polite"`.

## Objetivos y táctil

- Radio de acierto de los tiradores: **16 px** con ratón o lápiz y **22 px** con `pointerType === 'touch'` (`handleHitRadius`).
  Las aristas conservan la tolerancia de ajuste (10 px) salvo con el dedo.
- Cada tirador es un `<g>` con un área de acierto transparente de 24 px de diámetro y una marca visible de 12 px o más con
  anillo `--canvas-handle-ring`. El foco se dibuja con `--ui-focus` alrededor del área de acierto.
- `touch-action: pan-x pan-y` (la página se desplaza). Se bloquea el desplazamiento solo cuando el toque empieza sobre un
  tirador, con dos dedos, con la herramienta «Mover vista» (`touch-action: none`) o sobre una arista con «Agregar vértice».
- Dos punteros táctiles = pellizco: `pinchViewport` escala por la separación y desplaza por el punto medio.
- Altura del lienzo: `clamp(320px, 55dvh, 640px)` (`.ec-root` en `canvas.css`). El contenedor `.ea-canvas` de `App.css`
  fija hoy 540 px; conviene dejarlo en `height: auto` (U2-L).

## Zoom y encuadre

Botones «Acercar», «Alejar» y «Encuadrar» (`role="group"` «Zoom y encuadre», 36 px; 44 px con `pointer: coarse`), rueda del
ratón y pellizco. Lógica pura en `viewportOps.ts` (`zoomStep`, `ensureVisible`, `pinchViewport`).

## Props nuevas de `EditorCanvas` (contrato con U2-L)

```ts
surfaceConverged?: boolean   // false → trazo discontinuo (10 6) y --canvas-surface-unconverged
units?: 'SI' | 'imperial'    // etiquetas accesibles y ejes en m o ft; por omisión, doc.units
onAnnounce?: (msg: string) => void
```

`drawSection(ctx, w, h, dpr, scene, palette, units?)` rotula los ejes con la unidad del modelo (`scene.units`, que ahora
rellena `buildScene`).

## Comprobación en Chrome

Guiones usados (Playwright, puerto 5187), en `docs/fase2/ux/u2c-e2e/`: `u2c_keyboard.mjs` (edición solo con teclado),
`u2c_touch.mjs` (pellizco, desplazamiento y arrastre táctil) y `u2c_axe.mjs` (axe en claro y oscuro, capturas).

## Cambios de U5-E (R8)

- **Una sola parada de tabulación (B-01):** `Tab` y `Mayús+Tab` entran y salen del lienzo; los tiradores se recorren con `[ ]` y `AvPág`/`RePág`.
  Medido en Chrome con 344 tiradores: salir del lienzo toma **1 Tab** (antes, 12 Tab no pasaban del vértice 4 al 15).
- **Trazo y documento (A-01):** cargar otro documento (`doc/load` o `doc/replace`) sube `docEpoch`; el lienzo descarta el trazo en curso
  y lo anuncia. El lienzo publica su número de puntos en `ui.tracePoints` (`ui/trace`).
- **Cambiar de herramienta con un trazo (A-04, B-08, A-08):** con 3 o más puntos pide confirmación (`useConfirm`, tono `danger`); con 1 o 2
  lo descarta y lo anuncia. Un trazo con puntos cuenta como «cambios sin guardar» en `confirmDiscard`.
- **Lectura del cursor (R7-02):** una línea `aria-hidden` en la esquina inferior izquierda con `x`, `y` y la unidad (U5-E decía «superior» por error: R9).

## Cambios de U6-K (R9)

Rama `u6k-teclado` (base `59fef87`). Recorrido en Chrome: `docs/fase2/ux/u6k-e2e/u6k_demo.mjs` (22 pasos; contra la base fallan 16).

| Hallazgo | Qué cambia | Dónde |
|---|---|---|
| R9-04 | `[`, `]`, `+`, `=` y `-` se evalúan por `k.key` **antes** del descarte de modificadores: valen con AltGr (`ctrlKey && altKey` en Windows, o `getModifierState('AltGraph')`) y con Option (`altKey` sin `metaKey`). Ctrl o Meta solos siguen siendo del navegador; Ctrl+Z, Ctrl+Mayús+Z y Ctrl+Y no cambian; `Alt`+otra tecla (flechas, `i`, `0`, Supr…) sigue sin consumirse. `keyInputOf(e)` lee `AltGraph` del evento. Probado con tres distribuciones: US, `es-ES` en Windows/Linux (AltGr) y macOS (Option). | `canvas/keys.ts` |
| R9-06 | `undo` y `redo` ponen `ui.viewport` en `null` (el lienzo vuelve a encuadrar) cuando cambian `doc.units` o el ancho o el alto de la caja envolvente cambian más de 2× (`needsRefit`, `REFIT_FACTOR`). `unitsNotice` guarda las unidades en que se hizo y se descarta cuando `doc.units` ya no coincide (Ctrl+Z, Ctrl+Y). Medido en Chrome: SI → imperial → Ctrl+Z dejaba el talud en 233 px frente a 765 (0,305×); ahora 765. | `state/history.ts`, `panels/ProjectPanel.tsx`, `panels/projectForm.ts` |
| R9-10 | El tirador con `tabindex="0"` lleva `aria-describedby` con `HANDLE_INSTRUCTIONS` (102 caracteres: flechas, `[ ]`, Supr, Tab). El `<svg>` conserva el texto largo (`CANVAS_INSTRUCTIONS`). Los tiradores con `−1` no lo llevan, para no repetirlo al recorrerlos. | `canvas/EditorCanvas.tsx` |
| R9-11c | `Modal` y `HelpDialog` devuelven el foco con `restoreFocus` (`ui/focusReturn.ts`). Antes, un disparador oculto (el `<input hidden>` de «Importar CSV», un elemento de un menú cerrado) recibía `focus()` sin efecto y el foco caía en `<body>`; ahora va al botón del menú o a `#main-content`. `ui/dialogFocusReturn.test.ts` impide volver al patrón anterior. | `app/ImportDialogs.tsx`, `ui/HelpDialog.tsx` |
| R9-05d | El lienzo dibuja con trazo punteado (`1 5`, puntos redondos, `--canvas-piezo`) el tramo que el motor extrapola: horizontal, con el valor del extremo, desde el borde del modelo hasta el primer punto y desde el último hasta el borde (`PreparedModel::piezometric_y`, `crates/ogs-core/src/geometry.rs:621-627`; `x_min` y `x_max` de los vértices de todas las regiones, `geometry.rs:533-557`). No tiene tiradores y no entra en el encuadre. La línea definida sigue discontinua (`8 4`). En Chrome, el FS con la línea corta es idéntico al de la misma línea prolongada a mano. | `canvas/piezoExtension.ts`, `canvas/EditorCanvas.tsx` |

**Leyenda (parches para G/D):** el elemento «Piezométrica (extrapolada)» necesita `ui/legendItems.ts`, `ui/legend.css` y una línea en `EditorApp.tsx`, que no son de este escritor. Parches verificados con `git apply --check` en `docs/fase2/ux/u6k-e2e/legend-piezo-extrapolada.patch` y `legend-editorapp-wiring.patch`. Con ambos, la opción es `piezoExtrapolated` de `legendItems`.

**Pendiente en Casos:** la vista Casos dibuja con `render/drawSection.ts` (de G): hoy no dibuja el tramo extrapolado. Con `piezoExtension(doc)` (puro, en `canvas/piezoExtension.ts`) se obtienen los dos segmentos.
