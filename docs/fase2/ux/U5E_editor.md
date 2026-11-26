# U5-E: editor (R8)

Rama `u5e-editor` (base `325855a`), integrada en `main` con U5-S (`9bfe88e`, `15ee061`). Recorridos en
`docs/fase2/ux/u5e-e2e/` (`u5e_demo.mjs`: reproduce los hallazgos y mide; `u5e_axe.mjs`: axe en claro y oscuro). Este resumen sale de los
commits de `git log 325855a..main -- apps/web/src/editor` y del brief `briefs/F2U5_correcciones_R8.md`.

## Cambios por hallazgo

| Hallazgo | Qué cambia | Commit | Dónde |
|---|---|---|---|
| A-01 | Cargar otro documento (`doc/load`, `doc/replace`) sube `docEpoch`; el lienzo descarta el trazo en curso y lo anuncia. El lienzo publica su número de puntos en `ui.tracePoints` (`ui/trace`). | `1341c78` | `canvas/trace.ts`, `EditorCanvas.tsx`, `state/reducer.ts` |
| A-03 | «Eliminar región» opera por identidad (la referencia del objeto tomada al abrir el diálogo). Dos confirmaciones en cola borran las dos regiones pedidas; si la región ya no existe, no borra y avisa. | `831b551` | `panels/geometry.ts`, `GeometryPanel.tsx` |
| B-01 | El lienzo es una sola parada de tabulación: `Tab` y `Mayús+Tab` entran y salen; los tiradores se recorren con `[ ]` y `AvPág`/`RePág`. Medido con 344 tiradores: salir toma 1 Tab. | `c956cb4` | `canvas/keys.ts`, `EditorCanvas.tsx`, `U2C_lienzo_teclado.md`, ayuda |
| A-02 | `units/convert` (un solo paso deshacible) y `convertDocUnits`, pura: convierte longitudes, γ, γsat, γw, c, q y carga lineal; no cambian kh, kv, ángulos ni ru. El FS no cambia (Bishop y Spencer, con agua, cargas y sismo, comprobado con el motor en `units.test.ts`). El diálogo del cambio de unidades tiene tres opciones: «Convertir los valores» (recomendada, por defecto), «Solo cambiar la etiqueta» (`units/set`) y «Cancelar». | `36ab592` | `state/units.ts`, `panels/ProjectPanel.tsx`, `projectForm.ts` |
| γw imperial | Con piezométrica, unidades imperiales y γw ausente o 9,81, `validateLocal` da **error** (antes aviso) y bloquea «Comprobar». Al convertir a imperial, γw se escribe explícito (9,81 kN/m³ → 62,45 pcf; no se redondea a 62,4 porque eso cambia el FS en la 6.ª cifra). | `36ab592` | `state/validateLocal.ts` |
| A-04, B-08, A-08 | Cambiar de herramienta con un trazo de 3 o más puntos pide confirmación (`useConfirm`, tono `danger`); con 1 o 2 lo descarta y lo anuncia. `confirmDiscard` cuenta un trazo con puntos como cambio sin guardar. | `ad76649` | `app/discard.ts`, `EditorApp.tsx` |
| B-06 | Una sola pista «Pulse «Comprobar»»; la pista de exportación solo aparece con un resultado obsoleto o al intentar exportar. | `ad76649` | `app/exportHint.ts` |
| B-09 | Con 480 px o menos, herramientas y Deshacer/Rehacer pasan a un menú «Editar» (patrón `DropdownMenu`, con los nombres accesibles de cada acción). | `c22385f` | `app/useNarrow.ts`, `EditorApp.tsx` |
| R7-02 | Lectura de `x`, `y` y la unidad del cursor (o del cursor de teclado) en la esquina superior izquierda del lienzo; una línea, `aria-hidden`. | `c22385f` | `canvas/EditorCanvas.tsx`, `canvas.css` |
| B-10 | `useId()` en los `name` de los botones de opción de `NewSlopeDialog`; una sola clase `visually-hidden` (se elimina `.ec-visually-hidden`). | `c22385f` | `app/NewSlopeDialog.tsx` |
| Cierre | Foco inicial del diálogo de unidades, comentario de γw y guiones ajustados. | `45bde65` | ver U5-I abajo |

## Cierre en U5-I

- **Foco inicial de los diálogos modales.** U5-E enfocaba «Convertir los valores» con `setTimeout(50)` después de que `Modal` pusiera el foco
  en el título: una carrera. Ahora `Modal` acepta `initialFocus` (un `ref`) y lo enfoca justo después de `showModal()`
  (`pickInitialFocus` elige ese elemento si sigue conectado, y si no el título). Los demás diálogos (`ConfirmDialog`, `HelpDialog`, el
  resto de usos de `Modal`) ya enfocaban dentro del efecto, sin temporizadores.
- **Documentación y ayuda.** `U2C_lienzo_teclado.md`, `CANVAS_INSTRUCTIONS` (el `aria-describedby` del lienzo) y `helpContent.ts`
  (fila de atajos y limitación de unidades) ya describían Tab como entrada y salida y la conversión opcional.
