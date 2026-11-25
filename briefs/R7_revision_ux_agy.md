# Revisión adversarial R7 (Antigravity): UI/UX y accesibilidad de la web

Eres un revisor **externo e independiente**, experto en UX de herramientas técnicas (CAD/CAE) y en accesibilidad WCAG
2.2. Revisa la web de OpenGeoSlide (`apps/web/src`): un editor de secciones de taludes y un análisis de estabilidad por
equilibrio límite. La usan ingenieros geotécnicos y estudiantes. La app está publicada en
`https://nibaldox.github.io/OpenGeoSlide/`.

**Modo solo lectura:** no edites, no hagas commits ni instales nada global. Responde en **español neutro, sin voseo**.
Si ejecutas algo, cita la salida real. Para levantar la app en local, usa solo el puerto 5189, con
`pnpm --dir apps/web preview --port 5189 --strictPort`, después de `pnpm --dir apps/web build`. Si no puedes, revisa
solo el código.

## Qué revisar
1. **Arquitectura de interacción:**
   - modelo mental: ¿el flujo editar → comprobar → leer → exportar es evidente?
   - descubribilidad, estados vacíos, retroalimentación mientras calcula;
   - resultados obsoletos (E12i), deshacer y rehacer;
   - diálogos de importación y su mapeo de capas.
2. **Calidad de los mensajes:** errores del motor, validación local (`editor/state/validateLocal.ts`), avisos
   (`engine/warnings.ts`). ¿Son comprensibles y accionables para un geotécnico? ¿Dicen dónde está el problema?
3. **Accesibilidad en el código:**
   - semántica, roles y nombres accesibles;
   - manejo del foco en los diálogos (`<dialog>` o equivalentes);
   - operación con teclado del lienzo SVG (`editor/canvas/**`);
   - `aria-live` para los resultados y los avisos;
   - contraste de los colores definidos;
   - objetivos táctiles.
4. **Preparación para un tema oscuro:**
   - colores fijos y su ubicación;
   - si `render/drawSection.ts` y `render/scene.ts` se comparten con el informe PDF, que debe seguir claro;
   - propón una arquitectura de tokens: `color-scheme: light dark`, `light-dark()`,
     `<meta name="color-scheme">` con un script mínimo para evitar el destello del tema equivocado, un selector
     Sistema/Claro/Oscuro y una paleta separada para el lienzo y para el PDF.
5. **Responsive y rendimiento:** distribución en tablet y móvil, trabajo en el hilo principal durante el cálculo y
   carga del WASM.
6. **Robustez de la UI:** estados imposibles, dobles envíos, pérdida de trabajo y textos en español coherentes.

## Formato de salida (obligatorio)
1. Primera línea: `VEREDICTO: EXPERIENCIA BUENA | MEJORABLE | DEFICIENTE`.
2. Tabla `ID (R7-xx) | severidad (CRITICAL/HIGH/MEDIUM/LOW) | archivo:línea | problema | por qué afecta al usuario | corrección concreta | esfuerzo S/M/L`.
3. La arquitectura de tokens para el tema oscuro: los nombres de los tokens y la separación entre UI, lienzo y PDF.
4. Top 10 priorizado por impacto/esfuerzo.
5. Cobertura: qué miraste y qué no.
