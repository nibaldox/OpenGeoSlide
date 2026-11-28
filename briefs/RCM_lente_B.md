**Lente B: la web, la propagación de los datos y la primera visita.** Ataca `apps/web` contra F7.5, E17a a E17d,
`briefs/CM_C1_web.md`, `CM_W1_tareas.md` y `CM_W2_tareas.md`:
1. **La propagación v0.7.** Si marcas, cambias, desmarcas, guardas, abres y deshaces la búsqueda global, ¿la versión
   del documento, el JSON guardado, los borradores, los diagnósticos y las rutas de error quedan coherentes? Un archivo
   0.7 con `global` y valores en los bordes (50, 2000, 2^53 − 1, `null`, un campo desconocido), ¿lo abren igual la web
   y el motor? ¿El motor simulado inventa un FS cuando el real lo rechazaría?
2. **Las salidas.** La tabla de resultados, el CSV, el PDF (rasterízalo con `uv run --no-project --with pymupdf` y
   míralo), el chip y el HUD, con `winner` global y con `winner` refinamiento, y con las dos notas:
   - ¿el FS que se muestra es el de la superficie que se dibuja?
   - ¿el método que rige es el correcto con empates y con métodos sin convergencia?
   - ¿algo dice «global» cuando ganó el refinamiento?
3. **Los borradores y el editor (W1):** los cuatro defectos corregidos, en combinaciones que los tests no cubren:
   - deshacer y rehacer;
   - abrir un caso con un borrador pendiente;
   - Ctrl+Intro con un campo inválido en otra pestaña;
   - el filtro del selector de ejemplos con teclado y lector de pantalla.
4. **La primera visita (W1 y W2):**
   - importar un DXF o un CSV sobre el arranque y sobre un documento con cambios: título, materiales, agua, búsqueda,
     deshacer;
   - la guía, con «Omitir» y con la Ayuda reabriéndola;
   - el aviso de bloqueo con varios errores que se corrigen de a uno.

   Usa un contexto limpio, sin marcar la guía como vista.
5. **Pantallas y HUD:**
   - a 320 × 568, 390 × 664, 800 × 600 y 1440 × 900, en claro y en oscuro, con y sin avisos, ¿queda algún control
     interactivo bajo el pie o el HUD tapando el modelo después de una edición?
   - axe en las vistas nuevas: el panel de búsqueda global, el selector de ejemplos y los diálogos de importación.
