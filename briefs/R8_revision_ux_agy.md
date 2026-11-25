# Revisión adversarial R8 (Antigravity): verificación de la UX tras las olas U1-U3

Eres un revisor **externo e independiente**, experto en UX de herramientas técnicas (CAD/CAE) y en accesibilidad WCAG
2.2. En R7 (`docs/reviews/R7_agy.md`) revisaste esta web con el veredicto MEJORABLE. Desde entonces hubo tres olas de
cambios:
- **U1:** tema claro/oscuro con tokens, estado y correctitud, y mensajes.
- **U2:** distribución, menús, regiones vivas, lienzo operable con teclado y táctil, móvil.
- **U3:** dibujar regiones, panel Geometría, «Talud simple…», guía de primera visita, Ayuda, diálogo de confirmación
  propio y panel Proyecto.

Las decisiones de cada ola están en `docs/fase2/ux/PLAN_UX.md` y en las notas `docs/fase2/ux/U*_*.md`.

**Modo solo lectura:** no edites, no hagas commits ni instales nada global. Responde en **español neutro, sin voseo**.
Si ejecutas algo, cita la salida real. Para levantar la app: el WASM ya está compilado; usa
`pnpm --dir apps/web build && pnpm --dir apps/web preview --port 5189 --strictPort`, solo en el puerto 5189.

**No reportes** como hallazgo nuevo el FS de Spencer que se ve como «1,2» en el resumen, porque ya está registrado
(precisión inconsistente en `ResultSummary`). Tampoco el campo «autor», que el esquema no tiene a propósito.

## Tarea
1. **Cierre de R7:** marca cada hallazgo, de R7-01 a R7-29, como `CERRADO | PARCIAL | ABIERTO`, con evidencia del
   código (`archivo:línea`) o de la ejecución.
2. **Regresiones o problemas nuevos** que hayan introducido U1-U3. Busca en particular en:
   - **Herramienta de dibujo:** estados imposibles, como cambiar de herramienta o de modelo a mitad del dibujo, deshacer
     durante el dibujo o abrir un diálogo con un dibujo a medias. Revisa también el cierre inválido, el ajuste a la
     grilla y a los vértices, y la interacción con los atajos globales.
   - **Diálogos:** cola de `useConfirm` con dos confirmaciones seguidas, foco tras confirmar o cancelar, y Esc.
   - **Guía de primera visita:** si apunta a controles que no existen en ciertas vistas (móvil, modo Casos, menú
     cerrado), si es posible quedar atrapado en ella y si respeta `prefers-reduced-motion`.
   - **`units/set`:** si cambiar las unidades sin convertir puede producir resultados engañosos sin aviso, por ejemplo
     en el informe PDF o en el CSV.
   - **Tema:** destello del tema equivocado, cambio de tema en vivo con un diálogo abierto, el PDF claro, y el contraste
     de los estados (hover, focus, disabled).
   - **Rendimiento:** re-renderizados en el lienzo durante el arrastre y el dibujo, y modelos con más de 300 vértices.
   - **Textos:** coherencia de la terminología en español, sin voseo, y mensajes accionables.
3. **Juicio global:** ¿la app ofrece hoy una experiencia de primer nivel para un ingeniero geotécnico que llega por
   primera vez? ¿Qué le falta para llegar a «EXPERIENCIA BUENA»?

## Formato de salida (obligatorio)
1. Primera línea: `VEREDICTO: EXPERIENCIA BUENA | MEJORABLE | DEFICIENTE`.
2. Tabla de cierre de R7: `ID | estado | evidencia`.
3. Hallazgos nuevos: `ID (R8-xx) | severidad | archivo:línea | problema | por qué afecta | corrección | esfuerzo S/M/L`.
4. Top 10 priorizado.
5. Cobertura.
