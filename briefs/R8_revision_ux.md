# Revisión adversarial R8 (revisor independiente): verificación de la UX tras las olas U1-U4

Eres un revisor **externo e independiente**, de una familia de modelos distinta de la que escribió el código, y experto
en UX de herramientas técnicas (CAD/CAE) y en accesibilidad WCAG 2.2. Tu trabajo es encontrar problemas, no aprobar.
En R7 (`docs/reviews/R7_agy.md`), otro revisor externo dejó el veredicto MEJORABLE. Desde entonces hubo cuatro olas de
cambios:
- **U1:** tema claro/oscuro con tokens, estado y correctitud, y mensajes.
- **U2:** distribución, menús, regiones vivas, lienzo operable con teclado y táctil, móvil.
- **U3:** dibujar regiones, panel Geometría, «Talud simple…», guía de primera visita, Ayuda, diálogo de confirmación
  propio y panel Proyecto.
- **U4:** estratos (margen de dibujo, ajuste a aristas, «Dividir región», «Talud simple…» con estrato inferior) y
  pulido (posición del error JSON, nombres accesibles únicos, «Usar la corona», títulos de ejemplos, FS con 3
  decimales, avisos deduplicados, contraste de dovelas, objetivos de 24 px). La verificación práctica está en
  `docs/fase2/ux/X9_verificacion.md`.

Las decisiones de cada ola están en `docs/fase2/ux/PLAN_UX.md` y en las notas `docs/fase2/ux/U*_*.md`.

**Modo solo lectura:** no edites el código, no hagas commits ni instales nada global. El único archivo que escribes es
tu informe. Responde en **español neutro, sin voseo**. Si ejecutas algo, cita la salida real. Para levantar la app: el
WASM ya está compilado; usa `pnpm --dir apps/web build && pnpm --dir apps/web preview --port <tu puerto> --strictPort`,
solo en tu puerto, y al terminar mata el servidor por PID. Afirma un problema solo con evidencia (`archivo:línea` o una
salida de Chrome); marca como «sospecha» lo que no pudiste reproducir.

**No reportes** el campo «autor», que el esquema no tiene a propósito.

## Lentes (cada revisor cubre la suya a fondo; si ve algo grave de la otra, lo anota aparte)
- **Lente A, estado e interacción:** las herramientas de dibujo y división, los diálogos y `useConfirm`, `units/set`,
  la guía de primera visita, los avisos, deshacer y rehacer, y los atajos globales (punto 2, salvo tema, rendimiento y
  textos).
- **Lente B, cierre y calidad transversal:** cierre de R7 (punto 1), tema, accesibilidad con axe y teclado,
  rendimiento, textos y móvil.
- Ambos responden el punto 3, el juicio global.

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
