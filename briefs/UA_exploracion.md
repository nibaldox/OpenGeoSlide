# UA: exploración para el rediseño «A · Flujo de trabajo» de la web

Bloque **UA** (interfaz de la suite, armazón A). Rama de integración `ua-integracion`, worktree
`~/archivos/opengeoslide-wt/ua-int`, base `v0.5.0` (69d0413). Esta ola es **solo lectura sobre el código**.

## Contexto

La familia de apps del usuario (Conciliación, OpenGeoSlide, GeotRadarSim y SimRocas 2D) adopta una identidad común,
aprobada el 27-nov-2026 en `~/archivos/geo-suite-design/docs/DISENO_B.md`:

- **D1:** las apps por pasos (Conciliación y **OpenGeoSlide**) usan el armazón **A «Flujo de trabajo»**: cabecera con
  marca, pasos del modelo a la izquierda, pestañas de vista numeradas, lienzo con paleta flotante y HUD de resultado.
  Los simuladores usan B. La maqueta de A para OpenGeoSlide es `sketches/v1-ogs-a-flujo/` (fuente:
  `src/flujo.html`, `src/suite.css`, `src/ogs-mock.js`); capturas en `capturas/03-ogs-A-flujo-oscuro.png`,
  `04-…-claro.png` y `05-…-movil.png`.
- **D2:** un solo acento de interfaz, azul acero. **D3:** oscuro por defecto, claro disponible.
- Tokens comunes: `tokens/suite-tokens.css` **v1.1**. Reglas de la familia: `README.md` del repo de diseño.
- Del documento B aplican a A las partes comunes: principios (§2), tokens (§4), tipografía (§5), estilo de controles
  (§6.3, §6.4, §6.12), estados (§7, adaptados), teclado (§9, donde aplique) y accesibilidad (§11).

Restricciones de OpenGeoSlide que ya conocemos:
- `apps/web/src/styles/tokens.css` es el único archivo con colores literales de UI y lienzo; `src/report/palette.ts`
  es la paleta fija del PDF. Los tests `no-hardcoded-colors` y `tokens.contrast` lo hacen cumplir.
- Unos 90 guiones e2e (`docs/**/e2e/*.mjs`) seleccionan por nombre accesible; el rediseño debe conservarlos.
- La PWA funciona sin conexión: cualquier fuente nueva debe quedar en la precarga.

## Reglas para cada explorador

- No edites ningún archivo versionado. Escribe **un solo archivo de hallazgos**, el tuyo, en
  `docs/suite-a/exploracion/<ID>.md` dentro del worktree. Escríbelo pronto y complétalo después, para que un corte por
  límite de iteraciones deje algo útil.
- Cada afirmación lleva su marca: **[verificado]** (comando y salida, o `archivo:línea`) o **[inferido]**.
- En los archivos de hallazgos escribe las rutas como `~/archivos/…` o relativas al repo, nunca `/home/<usuario>`.
- Lo desechable (capturas, scripts, node_modules de herramientas) va en `$TMPDIR/ua/<ID>/`, con
  `TMPDIR=~/.hermes/profiles/open-geoslide/cache/scratch`. Cita sus rutas absolutas en el informe final.
- Antepón `env -u PYTHONPATH -u PYTHONHOME` a cualquier comando de Python.
- No toques los puertos 5180, 5181 ni 5185. No hagas commit ni push.

## Temas

### XA1 · Inventario del armazón actual (código)

Archivos: `apps/web/src/App.tsx`, `App.css`, `editor/EditorApp.tsx`, `editor/app/`, `editor/panels/`, `ui/`,
`theme/`, `onboarding/`, `styles/tokens.css`.

1. Árbol de componentes del armazón actual: cabecera, vistas («Editar», «Casos de verificación»), barra de
   herramientas (Archivo, Exportar, Deshacer, Rehacer, herramientas del lienzo, Comprobar, Informe PDF), línea de
   estado, franja de resultados, lienzo y sus controles, tablist «Paneles del modelo» y sus paneles. Para cada pieza:
   `archivo:línea`, componente, clases CSS, rol y nombre accesible, `data-testid`.
2. Tabla de brechas contra la maqueta A: para cada pieza de la maqueta (cabecera con marca, chip de estado, Ayuda,
   idioma, tema, Archivo, Exportar; barra lateral «Modelo» con secciones con estado y resumen; pestañas numeradas
   Lienzo · Resultados · Casos de verificación · Informe; tarjeta del lienzo con paleta flotante «Herram.»/«Vista» y
   HUD del FS; leyenda; pie de acción Comprobar/Informe PDF/CSV; barra de estado inferior con ejemplo, herramienta,
   coordenadas y motor), di qué existe hoy, dónde, y qué falta.
3. Para cada uno de los 10 paneles, de qué estado se puede derivar un **resumen de una línea** (selectores, campos
   del documento) y un **estado** (completo, con error, opcional vacío). Cita los tipos.
4. Hoy, ¿dónde viven la tabla de resultados, los avisos del cálculo y el informe? ¿Qué haría falta para que
   «Resultados» e «Informe» sean vistas o pestañas?
5. Mecanismo de tema (`ogs.theme.v1`, `data-theme`, script anti-destello) y de idioma, si existe.
6. Inventario de `tokens.css`: cada nombre, su capa (UI, lienzo) y dónde se usa; y qué pares mide
   `tokens.contrast.test.ts`.

### XA2 · Línea base en el navegador

1. En el worktree: `bash apps/web/scripts/build-wasm.sh`, `cd apps/web && pnpm install --frozen-lockfile && pnpm build`.
   Copia `dist` a `$TMPDIR/ua/XA2/dist` y sírvelo con `python3 -m http.server 5183 --bind 127.0.0.1 -d …`.
   `playwright-core` va en `$TMPDIR/ua/XA2` (no en el repo), con `/usr/bin/google-chrome-stable` y `--no-sandbox`.
   Sigue `~/.hermes/profiles/open-geoslide/skills/software-development/ogs-web-chrome-walkthrough/SKILL.md`
   (guía de primera visita vista, esperar «ogs-core», tema con `ogs.theme.v1`).
2. Capturas a 1440×900, 1280×800 y 390×844, en oscuro y en claro: al arrancar y después de abrir un ejemplo del menú
   «Archivo» y pulsar «Comprobar». Más la vista «Casos de verificación» a 1440 en oscuro.
3. Mide en cada caso: si la página hace scroll (`scrollHeight > innerHeight`), `scrollWidth` a 320, 390, 768, 1024 y
   1440; cuántas filas ocupan la barra de herramientas y el tablist de paneles; la familia tipográfica calculada del
   cuerpo, de los números del FS y de las coordenadas; el color de fondo y de texto del botón «Comprobar»; el tamaño
   de los objetivos de clic menores de 24 px; las violaciones serias y críticas de axe en ambos temas (axe-core en
   `$TMPDIR/ua/XA2`); los errores de consola y las respuestas HTTP ≥ 400; y el tiempo hasta «ogs-core».
4. Mantén el servidor solo mientras capturas y mátalo por PID al final (`ss -ltnp | grep :5183`).

### XA3 · Contrato de pruebas y e2e

1. Recorre `docs/**/e2e/*.mjs` y `apps/web/src/**/*.test.ts(x)`. Lista cada selector que depende del armazón:
   nombres en `getByRole`/`getByLabel`/`getByText`, `data-testid`, selectores CSS de clase o de rol (por ejemplo
   `[role="tablist"][aria-label="Paneles del modelo"]`), helpers como `openMenu`, y textos esperados de la línea de
   estado o de los anuncios. Agrúpalos por pieza de la interfaz, con el número de guiones que usa cada uno.
2. ¿Qué tests fijan estructura o estilos (los que leen `App.css` o `tokens.css`, cuentan pestañas, comprueban
   orden de elementos, instantáneas)? Cita `archivo:línea` y qué afirman.
3. El runner de regresión (`docs/fase3/iw/e2e/run_regression.sh` y `ogs-e2e-preview-integration`): cuántos guiones
   corre y con qué variables.
4. PWA: cómo se genera la lista de precarga y si una fuente woff2 nueva entraría sola o hay que declararla
   (`src/pwa`, `vite.config.*`, `public/`). ¿Hay CSP en `index.html`?

### XA4 · Especificación de la maqueta A

1. Lee `src/flujo.html`, `src/suite.css`, `src/ogs-mock.js`, `sketches/v1-ogs-a-flujo/index.html`,
   `sketches/v1-sistema/index.html` y `tokens/suite-tokens.css` (v1.1). Extrae con medidas en px, sacadas del CSS:
   cabecera, barra lateral de pasos (ancho, alto de cada paso, círculo de estado, título, resumen, cuerpo
   desplegado), pestañas numeradas, tarjeta del lienzo, paleta flotante (botones, grupos, rótulos), HUD del FS,
   leyenda, pie de acción, barra de estado inferior, y los puntos de corte y el orden en móvil.
2. Tabla de equivalencias: cada token `--gs-*` de v1.1 (oscuro y claro) → el nombre que ya existe en
   `apps/web/src/styles/tokens.css`, o «sin equivalente». Marca los nombres de OpenGeoSlide que no tienen par en la
   suite.
3. La marca de OpenGeoSlide (talud con arco de falla discontinuo): copia el SVG exacto de la lámina del sistema.
4. Fuentes: versiones actuales en npm de `@fontsource/outfit` y `@fontsource/jetbrains-mono` (o variantes
   `-variable`), qué pesos necesita la maqueta, licencia, tamaño de los woff2 de los subconjuntos latin/latin-ext, y
   cómo se importan en Vite. Verifica las versiones con `npm view`.
5. Qué partes de `DISENO_B.md` (§2, §4-§7, §9, §11) aplican a A y cuáles no, con una línea por cada punto.

## Informe final de cada explorador

Ruta del archivo de hallazgos, las 5-10 conclusiones principales con su marca, y las dudas que el coordinador debe
decidir.
