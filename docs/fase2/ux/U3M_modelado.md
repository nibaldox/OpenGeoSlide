# Modelar desde cero (U3-M)

Hallazgos que cubre: R7-02 y UX-01 (parte de modelado). Código en `apps/web/src/editor/`.

## Herramienta «Dibujar región» (tecla R)

Lógica pura en `canvas/draw.ts` (máquina de estados, con tests en `draw.test.ts`); el lienzo solo la conecta
(`EditorCanvas.tsx`) y la dibuja (`DrawLayer.tsx`). Al elegir la herramienta, el foco pasa al lienzo y se anuncian las instrucciones.

| Entrada | Acción |
|---|---|
| Clic o toque | Agrega un vértice, con ajuste a vértices existentes, a la alineación horizontal/vertical con el último y el primer punto, y a la rejilla. El punto se coloca **al soltar** (si el puntero se movió menos de 6 px), de modo que un arrastre táctil sigue desplazando la página. |
| Clic sobre el primer vértice | Cierra la región (con 3 o más puntos; radio de 16 px, o 22 px con el dedo). |
| Flechas | Mueven el cursor de dibujo: 0,1 m por paso (o el paso de la rejilla); `Mayús` ×10; `Ctrl` ×100. El primer movimiento parte del último punto o del centro de la vista. |
| `Espacio` | Coloca el punto en el cursor. |
| `Intro` | Si el cursor se movió con las flechas desde el último punto, **coloca** el punto; si no (o si está sobre el primer punto), **cierra** la región. Con menos de 3 puntos siempre coloca. |
| `Retroceso`, `Supr`, `Ctrl+Z` | Quitan el último punto (con el dibujo vacío, `Ctrl+Z` deshace el historial). |
| `Esc` | Cancela el dibujo; con el dibujo vacío, vuelve a «Seleccionar». |
| `+`, `-`, `0`, `Tab`, `[`, `]` | Siguen su función de siempre en el lienzo. |

- **Cada punto se anuncia** por `onAnnounce` («Punto 3 colocado: x 31,4 m, y 26,4 m. Intro cierra la región.»), también el movimiento del cursor y el cierre.
- **Rechazos al colocar:** un punto igual al anterior, sobre otro ya colocado, o cuyo segmento cruzaría el contorno en curso.
- **Cierre:** `validateNewRegion` ejecuta `validateLocal` sobre el modelo con la región añadida y solo cuentan los errores de esa región (polígono simple, área no nula, sin solapes). Si falla, el dibujo se conserva y el motivo sale en la ayuda del lienzo y en la región viva. Si es válida, se emite **un solo** `region/add` con el material seleccionado (o el primero) y se vuelve a «Seleccionar» con la región nueva seleccionada: un solo paso deshacible. Para dibujar otra, `R` de nuevo (así un clic suelto no empieza una región sin querer).
- El estado del dibujo es local del lienzo (no entra en el documento ni en el historial hasta cerrar). Cambiar de herramienta lo descarta.

## Panel «Geometría» (primera pestaña, la de arranque)

Lógica pura en `panels/geometry.ts`; interfaz en `GeometryPanel.tsx`.
- **Regiones:** una tarjeta por región con su material (`<select>`), vértices y área, «Seleccionar en el lienzo» y «Eliminar región» (confirmación nativa temporal `window.confirm`, aislada en `confirmRemoval()`: el coordinador la cambia por `useConfirm`).
- **Tabla de vértices** de la región seleccionada (o de la última): x e y editables (coma o punto decimal, Intro confirma, Esc descarta), «Agregar después» (punto medio de la arista siguiente) y «Eliminar» (mínimo 3). Un vértice compartido con otra región se mueve junto con él, en un solo paso de historial, como en el lienzo. Un texto no numérico queda marcado en línea y solo se anuncia (`role="alert"`) al confirmar. Debajo del título se listan las incidencias de la región (mismos mensajes de `validateLocal`).
- **Tablas grandes:** hasta 200 filas se muestran todas; con más, se paginan de a 100. Elegir un vértice en el lienzo lleva a su página. **No** se desplaza la página del navegador hasta la fila: en móvil arrastrar un tirador movía la vista.
- **Ajuste del dibujo:** rejilla (sin rejilla, 0,1 … 10 en la unidad del modelo) y los dos ajustes (vértices, ejes). Escriben `ui/snap`.
- Desde Diagnósticos, una incidencia de contorno, vértice o solape abre esta pestaña con el foco en la `x` del vértice (`issueNav.ts`).

## «Nuevo» (`app/newModel.ts`, `NewSlopeDialog.tsx`)

- **Nuevo** = **Modelo vacío**: sin regiones, un material «Suelo», búsqueda por defecto (rangos automáticos). El botón conserva el nombre «Nuevo»; bajo él, una nota y **«Talud simple…»**. (En vez de un submenú anidado, dos botones del mismo menú: se recorren con las flechas como el resto.)
- **Talud simple…** (`<dialog>` modal con `Modal`): altura H, ángulo β o pendiente H:V (1° a 89°), ancho de corona, ancho de pie, profundidad bajo el pie, material (nombre, γ, c, φ), unidades y piezométrica. Vista previa del perfil en vivo, validación en línea con los mensajes de los paneles. Crea una región de 4 a 6 vértices, `slope.direction = left_to_right`, Bishop y Spencer, y la búsqueda por defecto.
- **Piezométrica:** «En el pie» = el nivel freático aflora en el pie y llega a la mitad de la altura en el extremo posterior; «En la corona» = aflora en el pie y llega a la cota de la corona atrás. (Un nivel horizontal a la cota del pie no cambiaba el FS: la superficie crítica queda por encima.) En imperial se escribe γw = 62,4 pcf.
- **Verificado con el motor** (`newModel.test.ts`, con `OGS_BIN`): H = 10, β = 45°, c = 10, φ = 30, γ = 20 → Bishop 1,2039 y Spencer 1,1995, convergidos; `left_to_right` da lo mismo que `auto` y `right_to_left` no halla superficie; con piezométrica en la corona el FS baja; pendiente H:V e imperial calculan.
- Crear descarta el modelo actual: pide confirmación (`confirmDiscard`) **al crear**, no al abrir el diálogo.

## Estado vacío del lienzo

Sin regiones y sin dibujar, el lienzo muestra (prop `emptyState`) «El modelo no tiene regiones» con **«Dibujar región»** y **«Abrir un ejemplo»** (abre el menú Archivo y enfoca la lista de ejemplos) y el texto de que se puede importar un DXF o CSV (solo texto, sin botones, para no repetir los nombres «Importar DXF» e «Importar CSV» del menú). La vista inicial de un modelo vacío es de 60 × 30.

## Notas para la integración

- `EditorApp.tsx` registra «Geometría» (primera pestaña) y la herramienta; **no** usa `useConfirm` ni `ProjectPanel`. Los dos `window.confirm` (`confirmDiscard` y `confirmRemoval`) los cambia el coordinador.
- Se tocaron dos archivos fuera de la lista del brief, con cambios mínimos: `app/shortcuts.ts` (acción `tool:draw_region`) y `app/issueNav.ts` (pestaña `geometry`).
- El recorrido de regresión no necesitó cambios; los nuevos son `u3m_draw.mjs`, `u3m_panel.mjs`, `u3m_touch.mjs` y `u3m_axe.mjs` (puerto 5186), copiados a `docs/fase2/ux/u3m-e2e/`.
