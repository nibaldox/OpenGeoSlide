**Lente B (Terra, cruzada): el código de la web y de Python que escribieron otros agentes después de R15.**

En R15, Antigravity escribió W-R15a (`9547a76..6b34dd3`) y W-R15c (`fbcefe9..7b4b221`), y Sonnet escribió W-R15b
(`2b126af..78b2ad6`) y P-R15 (`2320d0c..3d9cbc9`). Esta lente los revisa desde otra familia de modelos.

1. **Cierre de R15B-01 a R15B-16:** comprueba cada uno en el código y con tests o sondas ejecutadas.
   - Cuando no haga falta el navegador, usa `pnpm exec vitest run <archivo>` dentro de `apps/web` (node_modules ya
     está instalado).
   - Para una prueba en el navegador, usa `vite preview` en el puerto **5191** desde tu copia congelada.
2. **R15B-01, borradores de material** (fue crítico). ¿Hay **algún** camino para calcular o exportar con el material
   anterior mientras una tarjeta muestra otro?
   - Pruébalo con Ctrl+Intro, con la paleta de comandos, cambiando de pestaña, con deshacer y rehacer, al abrir otro
     archivo, con la tabla de OCR inválida y con dos tarjetas con borrador.
   - ¿El registro de borradores en un `WeakMap` por store se limpia bien al cambiar de modelo?
   - ¿Los FS «desactualizados» desaparecen cuando corresponde?
3. **R15B-02:** ¿los 15 casos no circulares de Casos calculan con la selección por defecto? ¿«Cancelar» en Casos
   reinicia bien el worker?
4. **R15B-03, el aviso combinado de rama con tracción.** ¿Sale solo cuando corresponde? ¿Cambió algún texto o algún
   PDF de un modelo v0.5? Revisa `identity.f3b.mjs` contra `v0.4.0`. El único cambio aceptado es la deduplicación por
   `(code, path)`.
5. **R15B-05 y R15B-12, el PDF.** Deduplicación, unidades activas del aviso de σci y la nota de SHANSEP con sismo.
6. **R15B-06 y R15B-13, Python y CLI.**
   - ¿El wheel prueba lo que dice probar? ¿Hay tests tautológicos?
   - ¿`ogs bench --method all` y `--help` cumplen?
7. **Accesibilidad.** Notas en línea de F6.5, contador de segundos, `data-path` y `onReset`, y etiquetas en español.
   - Un detalle conocido: con un borrador, el botón «Comprobar» deshabilitado (`button.primary:disabled`, opacidad
     0,55) se distingue poco en tema oscuro. ¿Cumple el contraste WCAG para un control deshabilitado con su motivo
     visible?
