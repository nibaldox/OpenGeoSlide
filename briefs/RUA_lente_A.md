**Lente A: estado e interacción.** Busca trabajo perdido, estados viejos, carreras y controles que actúan donde no
se ven. Construye y ejecuta tus propios contraejemplos en el navegador; no te limites a releer los tests.

Prioridad de pruebas:
1. **Vistas.** Cambiar de vista con un cálculo en curso, con borradores sin aplicar, con un diálogo abierto o con el
   trazo de una región a medias.
   - ¿El lienzo conserva el trazo y la selección?
   - ¿Los atajos de herramienta (V, A, R, D, F, E, H, +, −, 0) actúan en Resultados, Casos o Informe?
   - ¿Ctrl+Z, Ctrl+S y Ctrl+Intro actúan donde deben (Lienzo, Resultados e Informe) y no en Casos?
2. **Encuadre automático del HUD** (`editor/app/shell/hudFit.ts`, `useHudInsets.ts`, `EditorCanvas`).
   - Después de hacer zoom o mover la vista, ¿algún evento (calcular, plegar el HUD, redimensionar, abrir un aviso,
     cambiar de tema, cambiar de vista) reencuadra y pierde la vista del usuario?
   - ¿Hay bucles de reencuadre o saltos al editar vértices?
   - ¿Qué pasa con el HUD en ventanas pequeñas (800 × 600) y a 761-1099?
3. **Pasos y panel en línea.**
   - Navegar con flechas, Inicio y Fin.
   - Pasar de un paso con borrador a otro: ¿se pierde el borrador o se pide confirmación, como antes?
   - Las incidencias de Diagnósticos que llevan a un campo de un paso o al lienzo, desde la vista Resultados.
   - Plegar y mostrar la barra lateral con un paso abierto y con borradores.
4. **Menús y chip por portal en la cabecera.** Abrir, Guardar, Importar y Ejemplos desde la cabecera con la vista
   Casos activa, el foco al cerrar, Esc, y el chip de estado en cada estado de `runStatus`: calculando, actual,
   desactualizado, parcial, error y motor caído.
5. **HUD.** Plegar y desplegar, «Ver tabla de resultados» (¿abre Resultados y enfoca la tabla?), el estado
   desactualizado tras editar, el estado calculando y el resultado parcial con un método sin convergencia.
6. **Informe.** «Generar PDF» y «Exportar CSV de resultados» con un resultado desactualizado o con borradores: ¿se
   bloquean igual que «Informe PDF»? ¿«Editar título» abre el paso Proyecto y enfoca el campo?
7. **Móvil (390) y ventanas intermedias (768, 1024).** El orden del apilado, el pie fijo, la paleta en fila, el
   tacto (emula `hasTouch`) y la guía de primera visita a 390.
8. **Tema.** Cambiar de tema a mitad de un cálculo y con el lienzo de Casos visible. La persistencia en
   `ogs.theme.v1`, y una preferencia antigua `system` guardada por la versión anterior.

Lista de comprobación de referencia, con fallas típicas de estado de esta app:
`~/.hermes/profiles/open-geoslide/skills/software-development/web-ux-audit/references/state-and-persistence-pitfalls.md`.
