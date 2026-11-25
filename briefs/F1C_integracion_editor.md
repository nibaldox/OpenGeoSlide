# Brief F1-C: integración del editor en la web (Sonnet, un escritor)

Responde en **español neutro, sin voseo**. Lee completos:
- `briefs/01_CONTRATOS_FASE1.md` §F1.4 y §F1.5;
- `briefs/F1W_editor.md`;
- `docs/fase1/exploracion/X3.md` §2.5, §2.6 y §2.9.

Antes de empezar, inspecciona lo que ya existe en `apps/web/src/`: `editor/state`, `editor/canvas`, `editor/panels`,
`io`, `report`, `engine`, `analysis`, `render`, `ui` y `App.tsx`.

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/f1c`, rama `f1c-integracion-editor`, desde `main`.

## Objetivo
Una aplicación usable por un geotécnico, que **parte del documento** y llega al **informe**.

1. **Modos en `App.tsx`:**
   - **«Editar»:** el editor nuevo.
   - **«Casos de verificación»:** la vista actual de casos publicados con su comprobación, sin regresiones.

   El modo inicial es «Editar», con el último borrador recuperado si existe (y se ofrece «Recuperar»). Si no hay
   borrador, se abre un modelo de ejemplo: ACADS 1(a) u otro de los casos.
2. **`src/editor/EditorApp.tsx`:** compone `EditorCanvas`, los paneles (en pestañas o acordeón lateral),
   `DiagnosticsPanel` y una barra con:
   - **Nuevo / Abrir / Guardar:** `.ogs.json` canónico, con descarga y SHA-256.
   - **Importar DXF:**
     - un diálogo que mapea cada capa a un material (con sugerencia automática) y confirma unidades;
     - para las polilíneas abiertas, ofrece cerrarlas con una base `y = valor` o descartarlas.
     - Lo importado se aplica con `doc/replace` o con `region/add`, en un solo gesto que se puede deshacer.
   - **Importar CSV:**
     - `capa,x,y` → regiones;
     - `x,y` → piezométrica, si el usuario elige ese destino.
   - **Exportar CSV:** resultados y coordenadas de la superficie crítica.
   - **Calcular («Comprobar»):** ejecuta `analyze` con el motor real (worker), muestra la tabla de resultados
     existente (`ui/ResultsTable`) y convierte los errores y avisos del motor en `Issue` de origen `engine`, con
     `setDiagnostics`. Mientras corre, muestra un indicador y bloquea un segundo cálculo.
   - **Informe PDF:** `buildReportPdf` con los resultados del último cálculo, si `revision` coincide; si no, primero
     pide calcular.
   - **Deshacer / Rehacer.**
   - **Atajos de teclado.**
3. **Superficie crítica en el lienzo:** agrega a `EditorCanvas` una **prop opcional** `result?: { surface, slices }`,
   que dibuja la superficie crítica en rojo y las dovelas en gris claro. Es el **único** cambio permitido en
   `editor/canvas/EditorCanvas.tsx`, es aditivo y lleva su test de render.
4. **Unificación de mensajes:** los rangos de `editor/panels/forms.ts` deben usar los mismos textos que
   `editor/state/validateLocal.ts` (`RULE_TEXT`). Elige una sola fuente, ajusta el otro módulo y sus tests.
5. **Borrador:** autoguardado con `io/draft.ts`, y «Recuperar» o «Descartar» al arrancar.
6. **Accesibilidad mínima:** foco visible, botones con texto y `lang="es"`.

## Archivos tuyos
- `apps/web/src/App.tsx`, `src/main.tsx`, `src/App.css`;
- `src/editor/EditorApp.tsx` y la carpeta nueva `src/editor/app/**`, para diálogos, hooks (`useEngineCheck`,
  `useDraftAutosave`) y su lógica pura con tests;
- cambios **mínimos y justificados** en `editor/panels/forms.ts` y `editor/state/validateLocal.ts` (unificación),
  y en `editor/canvas/EditorCanvas.tsx` (prop `result`).

No toques `src/engine/**`, `src/io/**`, `src/report/**`, el motor Rust, `package.json` ni el lockfile.

## Verificación
- **Gates:** `cd apps/web && pnpm install --frozen-lockfile && pnpm test && pnpm build`. Los tests existentes siguen
  pasando, y la lógica nueva se prueba en entorno `node`.
- **Motor real:**
  - compila el WASM con `apps/web/scripts/build-wasm.sh` (necesita `wasm-bindgen` 0.2.130, ya instalado);
  - corre `pnpm preview --port 5182 --strictPort` en segundo plano. **No uses el 5180 ni el 5181.**
- **Recorrido en Chrome headless** (`/usr/bin/google-chrome-stable`) con un script de CDP en tu scratch. Puedes
  basarte en `bench/chrome/*.mjs`.
  1. Abre la app y comprueba que no hay errores de consola.
  2. Abre el ejemplo.
  3. Mueve un vértice y deshaz.
  4. Pon `kh = 0,1` en el panel de sismo.
  5. Calcula y verifica que el FS baja frente al cálculo sin sismo, que se dibuja la superficie crítica y que aparece la
     tabla.
  6. Genera el informe PDF: el blob es mayor que 10 kB y empieza con `%PDF`.
  7. Importa un DXF de `src/io/dxf/fixtures/` con el mapeo de capas.

  Guarda **capturas** de los pasos clave en `$TMPDIR/f1c-shots/` e informa sus rutas.
- Al terminar, **detén** el servidor de preview y Chrome. Deja libre el puerto 5182.

## Cierre
- Commits pequeños con rutas explícitas. Sin push.
- **Resumen:** archivos, tests, gates con salida real, pasos del recorrido con resultado y valores (FS sin sismo y con
  sismo), rutas de las capturas, hashes y desvíos.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.
- **Presupuesto:** unas 90 iteraciones. Prioriza primero un flujo funcional completo (pasos 1 a 3 del objetivo) y
  después el pulido.
