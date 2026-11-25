# Brief X8: auditoría UI/UX práctica de la web (explorador Haiku, **solo lectura**)

Responde en **español neutro, sin voseo**.

**Objetivo:** encontrar con evidencia lo que impide una gran experiencia de uso. El público son ingenieros geotécnicos
(minería y obras civiles) y estudiantes que llegan por primera vez a la app. Además, este informe sirve de base para el
**tema oscuro** que se implementará después.

**Objetivo de la prueba:** la app publicada `https://nibaldox.github.io/OpenGeoSlide/` (es el build de `main`). Código
en `/home/xodla/archivos/opengeoslide/apps/web/src` (solo lectura).

## Herramientas
- `playwright-core` en `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/f1c-e2e`, con
  `executablePath: '/usr/bin/google-chrome-stable'` y `args: ['--no-sandbox']`. Reutiliza `walk_pages.mjs` como base
  para navegar.
- **axe-core:** instálalo en `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/x8-ux` con `pnpm add axe-core`.
  Inyéctalo con `page.addScriptTag({ path })` y ejecuta `axe.run` con las etiquetas `wcag2a`, `wcag2aa`, `wcag21aa`,
  `wcag22aa` y `best-practice`.
- **Guías de buenas prácticas, ya descargadas:**
  `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/mwg/{accessibility,color,dark-mode,dark-mode-toggle,component-specific-light-dark-theme}.md`.
  Léelas y úsalas como criterio.
- **Capturas:** guárdalas en `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/x8-ux/shots/` y revísalas tú
  mismo con visión.

## Cobertura obligatoria
1. **Primera visita:**
   - ¿Se entiende qué hacer en menos de 10 s?
   - Estados vacíos, ejemplos, terminología y ayuda.
   - ¿Hay un primer cálculo guiado?
2. **Flujos completos, midiendo clics y fricción en cada uno:**
   - modelo desde cero (regiones, materiales, piezométrica, superficie o búsqueda);
   - editar vértices; sismo y cargas; «Comprobar»;
   - leer resultados (FS, tabla, avisos y diagnóstico);
   - exportar PDF y CSV; importar DXF y CSV; guardar y abrir; borrador; modo «Casos de verificación».
3. **Heurísticas de Nielsen:**
   - estado del sistema y retroalimentación;
   - mensajes de error del motor: ¿son comprensibles y accionables?
   - unidades visibles y formato decimal;
   - consistencia, prevención de errores, deshacer, atajos y documentación.
4. **Accesibilidad WCAG 2.2 AA:**
   - axe en cada vista y estado: inicio, editor con ejemplo, resultados, diálogos de importación y modo verificación.
   - **Teclado:** orden de tabulación, foco visible, Esc en diálogos y operación del lienzo SVG (¿se puede editar sin
     ratón?).
   - Nombres accesibles del lienzo y de los resultados.
   - **Contraste:** mídelo en los colores reales.
   - Tamaño de los objetivos táctiles (24 px o más), zoom al 200 % y `prefers-reduced-motion`.
5. **Responsive:** 1440×900, 1280×800, 1024×768, 768×1024 y 390×844. ¿Se puede usar en tablet y móvil, o al menos
   consultar? Busca desbordes y paneles cortados.
6. **Rendimiento percibido:**
   - tiempo hasta que la app es interactiva y hasta el primer cálculo;
   - LCP y CLS medidos con `PerformanceObserver`;
   - peso de JS y WASM;
   - el indicador mientras calcula.
7. **PWA:** aviso de instalación, uso sin conexión y aviso de actualización (solo inspección, sin forzar builds).
8. **Inventario para el tema oscuro:**
   - todos los colores fijos con `archivo:línea`: CSS, TSX y TS, en especial `render/drawSection.ts`,
     `render/scene.ts`, `editor/canvas/EditorCanvas.tsx`, `pwa/updatePrompt.ts` e `index.html` (`theme-color`).
   - Clasifica cada uno: «UI, cambia con el tema», «lienzo, cambia», «**PDF, NO cambia**: el informe se imprime
     claro» o «color de material asignado por el usuario».
   - Indica si `drawSection` se comparte entre el lienzo y el PDF, porque eso define cómo separar las paletas.
   - Riesgos: SVG con `fill` fijo, imágenes e íconos, y el `theme-color` de la PWA.

## Entregable (único archivo que escribes)
`/home/xodla/archivos/opengeoslide/docs/fase2/ux/X8_auditoria_practica.md`, de 300 líneas o menos:
1. **Resumen:** 5 líneas, con las 3 mejoras de mayor impacto.
2. **Tabla de hallazgos:** `UX-xx | severidad (CRITICAL/HIGH/MEDIUM/LOW) | vista/flujo | qué pasa | evidencia (ruta de captura, regla de axe, medición) | recomendación concreta (archivo o componente) | esfuerzo S/M/L`.
3. Resultados de axe por vista: número y reglas.
4. Tabla de responsive.
5. Rendimiento, con números.
6. Inventario del tema oscuro, con la clasificación pedida.
7. **Top 10 priorizado.**

**Reglas:**
- No inventes hallazgos. Todo hallazgo lleva evidencia reproducible.
- Sin commits. No modifiques el código.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. Si necesitas un servidor local, usa solo el
  puerto 5184.

**Presupuesto:** ~60 iteraciones. Al final responde con el resumen y el Top 10.
