# U4-P: pulido (X9: UX-13, UX-19, UX9-02 a UX9-08)

Rama `u4p-pulido`. Recorridos en `docs/fase2/ux/u4p-e2e/` (puerto 5187): `u4p_polish.mjs` (25 pasos), `u4p_axe.mjs`
(claro y oscuro) y `u4p_targets.mjs` (controles menores de 24 px).

## Cambios por hallazgo

| ID | Qué cambia | Dónde |
|---|---|---|
| UX-13 | `jsonErrorOffset(text)`: escáner iterativo de RFC 8259 que devuelve el desplazamiento del primer carácter inválido (o `text.length` si el texto termina antes). La línea y la columna salen de ahí; el mensaje de V8 queda solo como `detail`. Si el escáner no encuentra fallo, se usa el «position N» del motor cuando exista. | `io/ogsJson.ts` |
| UX9-02 | `LabeledField` acepta `scope`, un prefijo solo para lectores de pantalla (`visually-hidden`): «Nuevo material: Nombre», «Material soil: Nombre», «Carga 2: Inicio x1 (m)». El texto visible no cambia. El foco va al primer campo al abrir el formulario y vuelve a «Nuevo material…» al cerrarlo. | `panels/Fields.tsx`, `MaterialsPanel.tsx`, `LoadsPanel.tsx` |
| UX9-03 | `terrainRanges(doc)`: terreno (extensión x) y corona (el tramo plano más ancho de la envolvente superior a la cota máxima; `null` si no hay). Cada carga muestra «Terreno: x de a a b m. Corona: x de c a d m.», con «Usar la corona» (distribuida: x1 y x2) o «Centrar en la corona» (lineal). Una carga sobre el talud avisa (no bloquea); fuera del terreno sigue siendo error (mensaje con el rango). Una carga nueva nace sobre la corona. | `panels/forms.ts`, `LoadsPanel.tsx` |
| UX9-04 | Tabla `exampleTitles` (id → título en español y fuente). El listado es «V047a: ACADS 1(a): talud homogéneo seco (Giam y Donald, 1989)» y el título del modelo abierto, el nombre en español. Los archivos de los casos y sus ids no cambian. | `examples/exampleTitles.ts`, `cases.ts`, `editor/app/docTemplates.ts` |
| UX9-05 | `formatFs`: siempre 3 decimales («1,200», no «1,2»), en la franja, el anuncio y la tabla. «Ver tabla de resultados» (`focusResultsTable`) desplaza y enfoca la tabla (`data-results-table`, `tabindex="-1"`). | `ui/formatFs.ts`, `ResultSummary.tsx`, `resultSummary.ts`, `ui/ResultsTable.tsx` |
| UX9-06 | `NoticeList` (nuevo) + `addNotice`/`visibleNotices`: el mismo mensaje no se apila, sube un contador («4 veces»); máximo 3 visibles (primero errores, luego avisos, luego lo reciente) con «Ver N más»/«Ver menos»; «Cerrar todos»; los errores no se cierran solos. El botón sigue llamándose «Cerrar mensaje» (nombre estable) y apunta a su aviso con `aria-describedby`. | `app/NoticeList.tsx`, `notices.ts`, `notices.css` |
| UX9-07 | El trazo de dovelas no llegaba a 3:1 sobre los materiales en ninguno de los dos temas (oscuro 2,0–2,3:1, claro 1,9–2,6:1). `--canvas-slice-edge`: claro `rgb(30 41 59 / 0.65)`, oscuro `rgb(226 232 240 / 0.7)`. Pares nuevos en `tokens.contrast.test.ts` sobre el fondo, el panel y los 8 materiales. | `styles/tokens.css`, `theme/lightPalette.ts` |
| UX9-08 | No eran dos controles de 13 px sino casillas y botones de opción de 13 px en todos los paneles (Geometría ×2, Superficie ×2, Búsqueda ×1, Análisis ×2, Casos ×2), más «Detalle técnico» (18 px de alto) y los enlaces de la ayuda (22 px). `ui/targets.css`: casillas y opciones de 24 px, `summary` y enlaces de la ayuda con mínimo 24 px. El lienzo no tiene controles menores de 24 px (el recorrido da 0). | `ui/targets.css`, `App.tsx` (una línea de importación) |
| UX-19 | `u4p_polish.mjs`, paso 7: sin oferta no hay botón; un `Event('beforeinstallprompt')` con `prompt()` y `userChoice` falsos lo muestra, `prompt()` se llama una vez y el botón se oculta. (`u3o_onboarding` ya tenía este paso.) | recorrido |

## Integración pendiente (coordinador)

`EditorApp.tsx` es de U4-M y no se tocó. Para activar los avisos nuevos, aplica `u4p-e2e/EditorApp_integracion.patch`
(`git apply`): sustituye `pushNotice` por `addNotice` y la lista inline por `<NoticeList …/>`. Sin el parche el editor
sigue con la lista de antes (`pushNotice` se conserva con su comportamiento anterior). `u4p_polish.mjs` (pasos 1 y 2) y
`u4p_axe.mjs` lo necesitan.

## Notas

- **Nombres accesibles estables:** un primer intento de `aria-label="Cerrar mensaje: {texto}"` rompió el recorrido
  `u3i_walk` (el nombre del botón «Informe PDF» pasó a coincidir por subcadena con el del aviso «Informe PDF generado»).
  Se volvió a «Cerrar mensaje» más `aria-describedby`.
- **Archivos fuera de la lista del brief, con cambios mínimos y sin dueño en U4-M:** `Fields.tsx` (prop opcional
  `scope`), `panels.css`, `cases.ts` y `docTemplates.ts` (títulos de ejemplos), `theme/lightPalette.ts` (espejo del
  token, comprobado por `lightPalette.test.ts`) y la línea `import './ui/targets.css'` de `App.tsx`.
- El mensaje de carga fuera del terreno sigue siendo el de `validateLocal` («dentro del ancho del modelo»), que es de
  `state/**` (U4-M).
