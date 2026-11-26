# U5-S: salida y cierre (R8)

Rama `u5s-salida` (base `325855a`). Recorridos en `docs/fase2/ux/u5s-e2e/` (puerto 5187): `u5s_salida.mjs` (17 pasos),
`u5s_draft_tabs.mjs` (5 pasos) y tres parches de `EditorApp.tsx` para U5-E o el coordinador.

## Cambios por hallazgo

| Hallazgo | Qué cambia | Dónde |
|---|---|---|
| A-05, B-02 | `ConfirmOptions.returnFocus` (elemento o función). Al cerrar, el foco va al primer candidato enfocable: `returnFocus`, el disparador, el botón del menú que contiene al disparador (`aria-controls` del `[popover]`) y `#main-content`. `DropdownMenu` devuelve el foco a su botón tras una acción si se perdió. | `ui/focusReturn.ts`, `ConfirmDialog.tsx`, `confirmQueue.ts`, `DropdownMenu.tsx` |
| A-06 | Con la guía abierta, Esc la cierra desde cualquier lugar, salvo con un `<dialog>` abierto, un menú `popover="auto"` abierto o un manejador que ya atendió la tecla (`defaultPrevented`). | `onboarding/tour.ts` (`shouldCloseTourOnEscape`), `GuidedTour.tsx` |
| B-03 | `/regions` → Geometría y foco en «Dibujar región» (`IssueTarget.focus`, el botón del estado vacío o, si no se ve, la herramienta de la barra). `issueTargetFor(issue, doc)`: `NoValidSurface` y `engine.invalid` → Búsqueda (o Superficie si el modelo no busca); `NoSurface` → Superficie. `/analysis/search` y `/analysis/surface` ya llevaban a sus pestañas (ahora con test). | `app/issueNav.ts`, `DiagnosticsPanel.tsx` |
| B-04 | CSV de resultados y de superficie: primera línea `# unidades: SI (m, kN/m³, kPa)` o `# unidades: imperial (ft, pcf, psf)`, y columnas `xc_m`/`xc_ft`, `r_m`, `x_m`… El CSV de **geometría** (`capa,x,y`) y su importación no cambian. El PDF: la tabla de resultados ahora dice `Centro (xc; yc) (m)` y `Radio (m)`; materiales y cargas ya declaraban unidades (test nuevo, SI e imperial). | `io/csv.ts`, `app/reportInput.ts`, `report/content.ts` |
| B-05 | La muestra de «Dovelas» es una línea de trazos verticales con `--canvas-slice-edge`. Par de contraste agregado sobre las tres superficies de la interfaz y `ui-row-warn`, además de lienzo y materiales (≥ 3:1, ambos temas). | `ui/legend.css` (nuevo), `tokens.contrast.test.ts` |
| B-07 | `tableColumnWidths` mide con DejaVu Sans y fija como mínimo de cada columna la palabra más larga de su cabecera (negrita) y de las celdas cortas; `allocateColumnWidths` reparte el resto. | `report/pdf.ts` |
| R7-25 | Caché de módulo de las fuentes (promesa por archivo; un fallo no se guarda) y de su cadena binaria (`WeakMap`). | `report/pdf.ts` |
| R7-24 | En Casos: «Comprobar caso» (y «Comprobando…»). Se conserva «Comprobar» en el editor; «caso» porque el botón ejecuta el caso elegido y lo compara con el valor publicado. Reemplaza lo dicho en `U2L_notas.md`. | `App.tsx` |
| R7-18 | Borrador por pestaña (ver abajo). | `app/draftTabs.ts`, `app/useDraftAutosave.ts` |

## Borrador por pestaña
- Id de pestaña en `sessionStorage` (`ogs.editor.tab.v1`); borrador en `localStorage` bajo `ogs.editor.draft.v1.tab.<id>`;
  índice `ogs.editor.draft.index.v1` (máx. 8 entradas, 30 días). El borrador antiguo (`ogs.editor.draft.v1`) cuenta como
  una entrada más.
- `tabDraftStorage` es un `DraftStorage`: `saveDraft`, `loadDraft`, `clearDraft` y el autoguardado de `io/draft.ts` no cambian.
  Escribe y borra la clave propia y **lee la más reciente**.
- `BroadcastChannel('ogs.editor.draft')`: hola/aquí entre pestañas. Si otra instancia usa el mismo id de pestaña (pestaña
  duplicada, que hereda `sessionStorage`), aviso no bloqueante `SAME_DRAFT_TEXT`.
- El autoguardado de una pestaña que arranca con un borrador a la vista sigue en pausa hasta que se recupera o descarta
  (decisión de `EditorApp`, sin cambios). U5-I lo cableó: el banner
  añade «Este borrador es de otra pestaña que sigue abierta…» (`data-testid="draft-open-elsewhere"`, también anunciado) cuando la
  entrada ofrecida es de otra pestaña que respondió «aquí» por `BroadcastChannel` (`offeredDraftElsewhere`, que usa
  `pickRecoverable().openElsewhere`; hook `useDraftOpenElsewhere`). Límite: no hay mensaje de «adiós», así que una pestaña que
  respondió y luego se cerró sigue contando como abierta hasta recargar.

## Integración pendiente: `EditorApp.tsx` es de U5-E
Tres parches en `docs/fase2/ux/u5s-e2e/`, cada uno verificado con `git apply --check` y los tres juntos en orden:
1. `EditorApp_issue_focus.patch`: usa `findIssueFocus(target)` antes de `fieldPath` al navegar desde Diagnósticos (B-03).
2. `EditorApp_csv_units.patch`: pasa `engine.run.doc.units` a `resultsCsv` y `surfaceCoordsCsv` (B-04). Sin él, el CSV
   siempre declara SI aunque el modelo sea imperial.
3. `EditorApp_draft_tabs.patch`: `resolveTabDraftStorage()` en lugar de `resolveDraftStorage()` y el aviso de
   `useSameDraftWarning` (R7-18).

## Pospuesto
- Análisis de DXF y CSV en un `Worker` (R7-25): sigue en el hilo principal; se pospone por el brief.
- A-07 (atajos con la guía abierta): rechazado por el coordinador; la ayuda lo documenta (`helpContent.ts` es de U5-E).
- Anillo de la guía fuera de la vista al desplazar (R8-06b): no está en el brief; no se tocó.

## Recorridos
Cambios intencionales en las copias: `u3i_walk.mjs` y `u3o_walk_u2x.mjs` (botón «Comprobar caso»); `u3i_integracion.mjs`
(`name: 'Talud simple…', exact: true`, porque la incidencia «El modelo no tiene regiones… «Talud simple…»…» ahora es un
botón y su nombre contiene esa cadena).
