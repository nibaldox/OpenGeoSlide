# U2-L: decisiones de distribución, navegación y paneles

Escritor U2-L, rama `u2l-layout`. Resume las decisiones que no se leen directamente en el código.

## Verbo «Comprobar» (editor) y «Calcular» (Casos)
Se mantienen los dos, a propósito:
- En el editor, «Comprobar» valida el modelo (reglas locales y del motor) y después calcula. El recorrido e2e y el brief fijan ese nombre.
- En Casos de verificación, «Calcular» ejecuta un caso publicado y lo compara con el valor publicado; es otra acción.
- El «Comprobar» duplicado de Diagnósticos se eliminó: queda un solo botón con ese nombre, el de la barra.

## Menús de la barra
- Patrón «disclosure»: un `<button>` con `aria-expanded` abre un `popover="auto"` (Baseline). Esc y clic fuera cierran, y el foco vuelve al botón.
- Los elementos del menú son `<button>` normales (sin `role="menuitem"`), para que conserven su nombre accesible y el recorrido los encuentre con `getByRole('button')`.
- Hay dos menús: **Archivo** (Nuevo, Abrir, Guardar, Importar DXF, Importar CSV, Ejemplos) y **Exportar** (CSV de resultados y de superficie). «Importar» no es un menú aparte: su nombre chocaba con el botón «Importar» de los diálogos.
- Las flechas ↑ ↓ Inicio Fin recorren los botones. El selector de Ejemplos se alcanza con Tab; una flecha sobre él abre la lista en lugar de cambiar el valor, para no cargar un ejemplo sin querer.
- Sin invocadores declarativos (`command`/`commandfor`) se usa `popovertarget`; sin anchor positioning, el menú se coloca por script.

## Resultados visibles (UX-03)
- Franja `ResultSummary` sobre el lienzo: FS grande por método, estado y recuento de avisos y notas. A 1440×900 y 1280×800 queda a y≈203 (antes, la tabla empezaba en y=1064).
- La tabla completa, las notas y los Diagnósticos siguen debajo del lienzo.
- El lienzo del editor mide `clamp(320px, 55dvh, 640px)` en escritorio y `clamp(320px, 48dvh, 640px)` por debajo de 640 px: así cabe entero en la primera pantalla de 390×844 junto a la barra compacta. Esta altura la fija el contenedor `.ea-canvas` (App.css); U2-C solo debe rellenarlo (`height: 100%`).

## Contrato con U2-C
`EditorApp` pasa `surfaceConverged`, `units` y `onAnnounce` a `EditorCanvas` como atributos extendidos (`{...canvasContract}`): la rama compila sola aunque el lienzo aún no declare las props.
`onAnnounce` escribe en la región `aria-live="polite"` persistente.

## Avisos y regiones vivas
- Una región `polite` (resumen del cálculo, avisos informativos, anuncios del lienzo) y una `alert` (errores) viven siempre en el DOM; solo cambia su texto, con un retraso de 150 ms para no chocar con el foco ni con un diálogo que se cierra.
- Los avisos visibles no llevan `role`: el anuncio lo hacen las regiones. Los informativos se cierran a los 6 s (se pausan con el puntero o el foco encima), no se repiten y se muestran como máximo 3.

## Navegación desde Diagnósticos
`issueTarget(path, doc)` (`editor/app/issueNav.ts`) da la pestaña, la selección y el campo (`data-path`) de cada incidencia. Solo es un `<button>` la que tiene un destino real; las demás son texto. Los avisos del motor llevan su puntero con `warningPath(code)`.
