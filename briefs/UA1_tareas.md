# UA1 · Tareas de la ola (léase junto con `briefs/UA_CONTRATO.md`)

Cada escritor lee primero el contrato completo (§1-§7) y luego su sección de aquí. Lo común (propiedad de archivos,
puertas, regla de los demás escritores, cuándo parar, informe) está en el contrato §6 y §7. Ejecuta en el orden de
prioridad indicado y haz commit al terminar cada parte: si te quedas sin iteraciones, lo hecho queda guardado.

## UA1-T · Tokens, tema, fuentes e ícono

Objetivo: la identidad de la suite en `tokens.css` (§3.1), oscuro por defecto con botón de dos estados (§3.2), fuentes
locales (§3.3) y el ícono nuevo (§3.4).

Prioridad:
1. **Tokens:** los valores v1.1 sobre los nombres de siempre más los nombres nuevos, en los cuatro bloques. Agrega a
   `PAIRS` los pares nuevos. Asegura `tokens.contrast.test.ts` y `no-hardcoded-colors.test.ts` en verde.
   - Calcula tú los pares del lienzo contra el fondo nuevo. Ajusta solo lo que falle y deja anotado cada ajuste con su
     contraste.
   - `--ui-accent-hover` va con un valor propio que dé ≥ 4,5 con texto blanco.
   - `--ui-shadow-float`: `0 12px 36px` negro al 60 % en oscuro y `0 12px 32px` `#0f172a` al 12 % en claro.
2. **Tema:** `theme.ts` (`ThemePref` de dos valores, sin «Sistema»), `useTheme.ts`, el guion de `index.html`,
   `ThemeToggle.tsx` (sol o luna con `IconSun`/`IconMoon` de `ui/icons.tsx`, clase `gs-icon-btn`), y los tests de
   `theme/` adaptados a la decisión UA-D4. El Canvas 2D de Casos (`render/SectionCanvas.tsx` lee `useTheme().resolved`)
   tiene que seguir repintando.
3. **Fuentes:**
   - `pnpm add -E @fontsource-variable/outfit@5.3.0 @fontsource-variable/jetbrains-mono@5.3.0`;
   - en `styles/fonts.css`, los `@import` de los subconjuntos que pide §3.3; mira qué CSS por subconjunto trae cada
     paquete en `node_modules`;
   - mide el total de woff2 en `dist/assets/` tras el build (≤ 160 KB) y comprueba que salen en la lista de precarga
     de `dist/sw.js`;
   - en `tokens.css`, `--ui-font-sans` y `--ui-font-mono`, más `body { font-family: var(--ui-font-sans) }`. Esa regla
     va en `tokens.css` o en `fonts.css`; `App.css` es de UA1-A;
   - las licencias OFL.
4. **Ícono:** `public/icons/icon.svg` con la marca; regenera los PNG con Chrome headless, capturando el SVG a 192 y a
   512; actualiza `manifest.webmanifest` y los `theme-color` de `index.html`.

Aceptación propia:
- capturas de la app en oscuro y en claro a 1440 (la estructura sigue siendo la vieja, pero con los colores y las
  fuentes nuevas);
- `getComputedStyle(document.body).fontFamily` empieza por `"Outfit Variable"`;
- `document.fonts` tiene ambas familias `loaded`;
- el fondo de «Comprobar» es `rgb(44, 119, 195)` en oscuro.

## UA1-A · Armazón

Objetivo: la estructura A de §2 y §4.6-§4.8, sin romper los nombres de §5.

Prioridad:
1. **Estructura y CSS de escritorio:**
   - la cabecera (con el chip y los menús por portal);
   - la barra lateral con los diez pasos y el panel en línea (§4.6), usando `stepStates()`;
   - el pie de acción;
   - el área principal con las cuatro vistas (§4.7);
   - la tarjeta del lienzo con el HUD (`ResultSummary`, pasándole `onShowTable`), las coordenadas y la leyenda dentro;
   - la paleta (pasa el grupo «Herramienta del lienzo» a `EditorCanvas` por `paletteTools`, con botones
     `gs-tool ea-tool`, `aria-pressed`, íconos de `ui/icons.tsx`, `aria-label` con el nombre de siempre y `gs-tip`);
   - `fitInsets`;
   - la barra de estado;
   - `html, body { height: 100%; overflow: hidden }` desde 761 px.

   Pon la lógica que se pueda probar (vista activa, qué atajos valen en cada vista, `fitInsets` según el ancho, el texto
   de la barra de estado) en módulos puros de `editor/app/shell/` con tests en Node.
2. **Anchos:** 1100-1279, 761-1099 y ≤ 760 (§2), con el pie sticky en móvil. Sin scroll horizontal a 320, 390, 768,
   1024, 1280 ni 1440; mídelo.
3. **Vistas Resultados e Informe** completas, «Ver tabla de resultados» y las incidencias de Diagnósticos que llevan al
   lienzo.
4. **Visita guiada** (`onboarding/tour.ts`): cada paso apunta a una pieza que existe en el armazón nuevo. Y el texto de
   Ayuda donde nombre la barra de herramientas o los modos viejos.
5. **Tests** que fijan literales de tus archivos: adáptalos para seguir el código movido y conserva lo que afirman.
   Haz lo mismo con el `it` de altura de `EditorCanvas.test.ts`: la altura del lienzo sale ahora del armazón, no de un
   `clamp`; el test pasa a afirmar la nueva fuente única de altura.

No edites guiones e2e (`docs/**/e2e/`): la migración es de UA2. Antes de terminar, sí corre a mano contra tu build estos
dos y anota qué pasos fallan y por qué: `docs/fase2/ux/u3i-e2e/u3i_walk.mjs` y `docs/fase3/iw/e2e/iw_a_c.mjs`. Se
espera que fallen en «Editar» y en `results-panel`; cualquier otro fallo es tuyo.

Aceptación propia:
- capturas a 1440 × 900, 1280 × 800 y 390 × 844, en oscuro y en claro, de Lienzo con un ejemplo calculado, de
  Resultados y de Informe;
- `scrollHeight ≤ innerHeight` a 1440 y a 1280;
- `scrollWidth ≤ innerWidth` en los seis anchos;
- axe (en `$TMPDIR/ua1/A`) sin violaciones serias ni críticas en las cuatro vistas.

## UA1-M · Modelo puro

Objetivo: implementar `editor/app/shellModel.ts` según §4.1, sin cambiar las firmas, con `shellModel.test.ts`.

- Tests: cada fila de las tablas de §4.1 con un documento mínimo construido en el test, más estos casos:
  - documento vacío;
  - modelo imperial;
  - un resumen que no cabe en 40 caracteres;
  - empates en el FS mínimo;
  - ningún método convergido;
  - `NaN` o `Infinity` en `convergedFos`;
  - un borrador pendiente de cada panel que registra borradores.
- Usa ejemplos reales de `src/examples/` o de `verification/cases/` cuando sirvan.
- `formatFs` y los nombres cortos de los métodos ya existen (`ui/formatFs.ts`, `resultSummary.ts`). Úsalos y no
  dupliques los formateadores; la coma decimal sale de `Intl` con `es`, como el resto de la app.
- Para mapear las claves de borrador a los pasos, lee dónde registra cada panel su borrador (`setPendingDraft` en
  `editor/panels/`). Si alguna clave no corresponde a un paso, documéntalo.
- Para `reportContents`, lee `report/pdf.ts` y `report/reportInput.ts` y lista solo secciones que existen.
- `pnpm typecheck && pnpm test` en verde. No hace falta navegador.

## UA1-C · Lienzo

Objetivo: la paleta flotante y el encuadre con márgenes de §4.2, la rejilla mayor y la piel del lienzo.

Prioridad:
1. **`nav.ec-palette` dentro de `.ec-root`:** `paletteTools` arriba, con el rótulo «Herram.» (`aria-hidden`), un
   divisor, y el grupo «Zoom y encuadre» con el rótulo «Vista» (`aria-hidden`).
   - Los botones de zoom pasan a íconos (`IconZoomIn`, `IconZoomOut`, `IconFit`), con `gs-tool ec-tool` y `gs-tip`
     (nombre más tecla).
   - Conservan el nombre accesible, el `title` y las teclas.
   - Hasta 760 px de ancho de ventana, la paleta va en fila, abajo de la tarjeta, con botones de 40.
2. **`fitInsets`:** `fitToDocInsets(doc, w, h, insets)` en `viewportOps.ts`, con tests (márgenes asimétricos, modelo
   degenerado, `w` o `h` menores que la suma de márgenes). Úsalo en «Encuadrar» y en todo encuadre automático del
   lienzo.
3. **Rejilla mayor:** las líneas múltiplo de 5 pasos de la rejilla usan `var(--canvas-grid-major, var(--canvas-grid))`.
   Los rótulos de los ejes van en `var(--ui-font-mono)` con `tabular-nums`.
4. **Coordenadas** (`.ec-cursor`, `data-testid="cursor-readout"`): una píldora mono a la izquierda, a 16 px, encima de
   la leyenda (abajo, a 56 px). El texto es «x 41,32 m · y 29,76 m», con las unidades del documento.

Para verlo en tu rama tienes que pasar `paletteTools` y `fitInsets`, pero `EditorApp` no es tuyo. Hazlo en una copia
**sin commit**, o con una página de prueba en scratch. En el informe, adjunta el diff mínimo que UA1-A debería aplicar.

Aceptación propia:
- tests en Node de los márgenes y del marcado de la paleta (`renderToStaticMarkup`);
- capturas de la paleta en oscuro y en claro a 1440 y a 390.

## UA1-S · Componentes

Objetivo: los íconos reales (§4.4), las primitivas `.gs-*` (§4.5), el HUD (§4.3) y la piel de los paneles, la leyenda,
los avisos y las tablas de casos.

Prioridad:
1. `ui/icons.tsx`: los 28 íconos, lineales, de 24 × 24 con trazo de 1,8 en `currentColor`. Mira los que ya dibuja la
   maqueta (`~/archivos/geo-suite-design/src/flujo.html`, `src/suite.css`, `sketches/v1-sistema/index.html`).
2. `styles/components.css`: las primitivas de §4.5, con estados hover, activo, deshabilitado y `:focus-visible` (anillo
   de 2 px `--ui-accent-bright` con desplazamiento de 2), y `prefers-reduced-motion`.
3. **HUD:** `ResultSummary.tsx` y `resultSummary.css` según §4.3. Usa `fsMinimum()` de `shellModel.ts`; en tu rama es
   neutral, y en tus tests usa datos que no dependan de su implementación. Los tests existentes siguen pasando. Si
   alguno fija un texto que §4.3 cambia (el emoji ⚠), actualízalo y anótalo.
4. **Paneles** (`editor/panels/*.css`): campos con la etiqueta encima en `--ui-ink-2` 12 px, controles de 32 de alto,
   fondo `--ui-surface-sunken`, borde `--ui-control-border`, mono con tabular-nums en los numéricos, foco con anillo,
   invalidez con borde y texto de falla. Tarjetas `.ep-card` con radio 12. Las leyendas de `fieldset` como eyebrow.
5. **Leyenda** (`ui/legend.css`, como píldora), avisos (`editor/app/notices.css`) y la tabla de casos
   (`ui/checkTable.css`).

Para ver el HUD en tu rama basta la app actual: `ResultSummary` ya se muestra sobre el lienzo.

Aceptación propia:
- capturas del HUD con un ejemplo calculado, desactualizado y calculando, en oscuro y en claro;
- una captura de un panel (Materiales) en ambos temas;
- ningún color literal fuera de `tokens.css` (`no-hardcoded-colors` en verde).

## UA1-Q · Guion de aceptación

Objetivo: `docs/suite-a/e2e/aceptacion_ua.mjs`, con las comprobaciones A01-A17 del contrato §8. Lo escribes en
`~/archivos/opengeoslide-wt/ua-int` y no tocas nada más.

- **Base:** usa `playwright-core` instalado en `$TMPDIR/ua1/Q` (no en el repo) y Chrome
  `/usr/bin/google-chrome-stable`. Toma de `docs/fase3/iw/e2e/lib.mjs` el arranque: guía marcada como vista y espera a
  «ogs-core».
- **Ejemplo:** se abre con el selector «Ejemplos» del menú «Archivo», con `openMenu`. Elige un ejemplo con varias
  regiones y al menos dos métodos.
- **axe:** `axe-core` en `$TMPDIR/ua1/Q`; inyéctalo con `page.addScriptTag`.
- **Salida:** una línea `OK <id> …` o `FAIL <id> …` por comprobación, el resumen `N/17` y el código de salida
  distinto de 0 si algo falla. Además, `aceptacion-<OGS_LABEL>.json` y capturas en `$OUT`, que por defecto es
  `$TMPDIR/ua1/Q/out`.
- **Selectores:** solo los del contrato (§4.6-§4.8, §5). Donde el armazón nuevo aún no existe, la comprobación falla
  con un mensaje claro: no se cae el guion entero. Usa `try` por comprobación y tiempos de espera cortos (≤ 5 s por
  selector ausente).
- **Pitfalls:**
  - un `position: fixed` tiene `offsetParent` nulo; mide la visibilidad con `getClientRects().length` y `visibility`;
  - `document.fonts.check()` devuelve `true` sin `@font-face`; comprueba
    `[...document.fonts].some(f => f.family === … && f.status === 'loaded')`, con las familias
    `"Outfit Variable"` y `"JetBrains Mono Variable"`;
  - los nombres que son prefijo de otros van con `exact: true`.
- **Corrida contra la línea base:**
  1. Construye la app de `ua-int`, que ya tiene `node_modules` y `src/wasm`, en una copia: copia `apps/web/dist` a
     `$TMPDIR/ua1/Q/dist-base` después de `pnpm build`.
  2. Sírvela en el 5188 y corre el guion con `OGS_LABEL=base`.
  3. Deberían fallar casi todas las comprobaciones de estructura y pasar A01, A03, A13, A14 y A15. Si una comprobación
     falla por un defecto del guion y no de la app, corrige el guion.
  4. Mata el servidor por PID.
- **Commit:** `UA1-Q: guion de aceptación A01-A17 (línea base N/17)`, con `git add docs/suite-a/e2e/`, en la rama
  `ua-integracion`, sin push.
- **Informe final:** las líneas de la corrida base y la ruta del json.
