# Brief F1-W: editor web, en 4 escritores Sonnet en paralelo

Responde en **español neutro, sin voseo**. El código y los identificadores van en inglés; la UI y los mensajes, en
español, con coma decimal en la UI.

**Lee primero, completos:**
- `briefs/01_CONTRATOS_FASE1.md` §F1.1, §F1.3 y §F1.4;
- `docs/fase1/exploracion/X3.md` §2.1-§2.10, que es el diseño base;
- `apps/web/src/editor/types.ts`, `src/io/types.ts`, `src/report/types.ts` y `src/engine/types.ts`.

**Los tipos están CONGELADOS:** no los modifiques. Si necesitas un cambio de interfaz, detente y repórtalo.

## Reglas comunes
- Trabaja solo en tu worktree, `opengeoslide-wt/f1w<N>`, rama `f1w<N>-…`, y en tus archivos.
- Commits pequeños con rutas explícitas. Nunca hagas push.
- **Tests:**
  - Vitest con `environment: 'node'`;
  - archivos `*.test.ts` junto al código;
  - separa la lógica pura de los componentes React para poder probarla.
  - No agregues jsdom ni Testing Library.
- **Dependencias:** **solo W4** modifica `apps/web/package.json` y `pnpm-lock.yaml`. Los demás no agregan
  dependencias.
- **No toques** `App.tsx`, `main.tsx`, `src/engine/**`, `src/analysis/**` ni `src/render/**`, ni los archivos de otro
  escritor. `src/geometry/viewport.ts` es de solo lectura; si necesitas otra cosa, haz un helper propio en tu carpeta.
- **Gates:** `cd apps/web && pnpm install --frozen-lockfile && pnpm test && pnpm build`, con `tsc` estricto y sin
  `any` implícito.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. Puertos 5182 a 5189 (nunca 5180 ni 5181).
- **Resumen final:** archivos, tests (cantidad y qué cubren), salida real de los gates, hashes y desvíos.

---

## W1: estado del editor (`src/editor/state/**`)
- **`reducer.ts`:** `reduce(state: EditorState, action: EditorCommand | UiAction): EditorState`, una función pura.
  - **Reglas de X3 §2.1:**
    - un cambio de `doc` empuja a `past` (máximo 200), vacía `future` y sube `revision`;
    - las `UiAction` no entran en el historial;
    - `doc/replace` se puede deshacer.
  - **Gestos:** `beginGesture` guarda `before`; las acciones dentro del gesto **no** apilan entradas; `endGesture`
    apila una sola entrada (`before`); `cancelGesture` restaura `before`.
  - **Comandos inválidos** (un índice fuera de rango, `material/remove` de un material en uso, `vertex/remove` que
    dejaría menos de 3 vértices): el estado no cambia y el comando no apila nada. Expón un helper para saber si un
    comando es aplicable.
- **`history.ts`:** `undo` y `redo`.
- **`validateLocal.ts`:** `validateLocal(doc): Issue[]`, con los códigos `editor.*` de F1.4.
  - La geometría usa la **misma semántica que E12c**: aristas compartidas y uniones en T permitidas.
  - Rangos numéricos: los de `00_CONTRATOS.md` §4.5 y §1, más F1.1 para sismo y cargas.
  - `path` es un puntero JSON.
- **`store.ts`:** `createEditorStore(initial: ModelDoc, fileName?: string): EditorStore`, más un hook
  `useEditorStore(store, selector)` con `useSyncExternalStore`, en `useEditor.ts`.
- **Tests:**
  - cada comando: efecto y no-op en caso inválido;
  - undo, redo y gestos;
  - límite de 200 entradas;
  - `validateLocal` con lazo «8», espiga, solape, contención, polígonos idénticos, arista compartida válida, unión en T
    válida, piezométrica desordenada, rangos de sismo y cargas, y material faltante;
  - neutralidad: los 16 casos de `verification/cases` dan **0 errores** en `validateLocal`.

## W2: lienzo SVG (`src/editor/canvas/**`)
- **`EditorCanvas.tsx`:** `({ store }: { store: EditorStore })`. Dibuja:
  - regiones con color por material y vértices con tiradores enfocables (`aria-label` como en X3 §2.3);
  - la piezométrica con sus puntos;
  - el círculo fijo con tiradores de centro y radio;
  - las bandas de `entry` y `exit`;
  - **las cargas**, sin interacción en v1: `udl` como banda de flechas y `line` como flecha con su ángulo;
  - **el sismo**, como un indicador «kh = … · kv = …» con una flecha en el sentido de deslizamiento.

  Usa `viewport.ts` para la transformación.
- **Interacción, según X3 §2.3:**
  - arrastrar vértices o puntos de la piezométrica (un gesto = una entrada de historial);
  - agregar un vértice sobre una arista con la herramienta `add_vertex`;
  - quitar un vértice con Supr o Retroceso;
  - teclado: Ctrl+Z, Ctrl+Mayús+Z, Ctrl+Y y flechas (Mayús = ×10);
  - pan con la herramienta `pan` y zoom con la rueda.
- **Lógica pura con tests:**
  - `hitTest.ts`: vértice, arista y proyección sobre la arista, círculo y tiradores, punto de la piezométrica;
  - `snap.ts`: prioridad vértice > eje > rejilla, con tolerancia en píxeles convertida a metros;
  - `gesture.ts`: máquina de estados `pointerdown/move/up/cancel` → lista de acciones del store.

## W3: paneles (`src/editor/panels/**`)
- **Paneles** (X3 §2.4), todos con `({ store }: { store: EditorStore })`:
  - `MaterialsPanel`;
  - `WaterPanel` (unit_weight y tabla de la piezométrica);
  - `SurfacePanel` (radio «Búsqueda»/«Fija», que nunca deja guardadas las dos);
  - `SearchPanel`;
  - `AnalysisPanel` (métodos, dovelas, tolerancia, iteraciones, min_m_alpha y dirección);
  - `LoadsPanel` (tabla de cargas `udl` y `line`: agregar, editar y quitar);
  - `SeismicPanel` (kh y kv con sus rangos y una explicación breve del sentido, «kh positivo actúa en el sentido del
    deslizamiento»);
  - `DiagnosticsPanel` (lista de `Issue` con severidad; al hacer clic se selecciona el elemento según `path`).
- **Lógica pura con tests**, en `forms.ts`:
  - parseo de números con coma o punto decimal y campos vacíos;
  - validación de rangos con los mismos mensajes que `validateLocal`;
  - conversión entre formulario y comando (`EditorCommand`) para cada panel.

## W4: abrir, guardar, borrador, DXF, CSV e informe (`src/io/**`, `src/report/**`, `public/fonts/**`)
- **`io/ogsJson.ts`:**
  - `openOgsJson(text) → { doc, issues }`: acepta v0.1 y v0.2, y también `{model, checks}` (descarta `checks` con un
    aviso). Rechaza `format` incorrecto.
  - `saveOgsJson(doc) → string`: orden de claves canónico (F1.4), 2 espacios, 6 decimales y `version: "0.2"`.
  - `sha256Hex(text)`.
  - **Tests de ida y vuelta** con los 16 casos: abrir y guardar conserva el contenido, salvo `version` y el redondeo.
- **`io/draft.ts`:** borrador en `localStorage` con almacenamiento inyectable para los tests, según X3 §2.6.
- **`io/csv.ts`:** según X3 §2.8, con `papaparse@5.7.1`, la regla de coma decimal y protección contra inyección de
  fórmulas al exportar.
- **`io/dxf/{tokenize,entities,layers}.ts`:** parser propio según X3 §2.7, con LINE, LWPOLYLINE y POLYLINE 2D.
  - Rechaza bulge distinto de 0, 3D y coordenadas no finitas.
  - Ignora el resto con recuento, sugiere el material por capa y lee `$INSUNITS`.
  - Límites: 2 MB y 10 000 entidades.
  - **Tests** con un corpus pequeño escrito a mano en `src/io/dxf/fixtures/`, comparado contra `dxf-parser@1.1.2`
    (devDependency) en las entidades soportadas.
- **`report/content.ts`:** `buildReportContent(input: ReportInput)`, una función pura que devuelve las secciones de
  X3 §2.9. Usa la advertencia profesional aprobada de F1.4 y los avisos vía `describeWarning`.
- **`report/pdf.ts`:**
  - `buildReportPdf: BuildReportPdf`, con `jspdf@4.2.1` cargado mediante `await import`;
  - fuente TTF embebida (DejaVu Sans o Noto Sans) en `public/fonts/`, con su archivo de licencia. **Verifica la
    licencia** y cítala en el resumen;
  - la sección se dibuja en vectorial (regiones, piezométrica y superficie crítica).
  - **Test:** el PDF generado contiene la fuente embebida (`/FontFile2`) y el texto se codifica con la fuente
    (Identity-H). Para un informe con φ, γ y ≤, comprueba que no aparecen como bytes WinAnsi crudos.
- **Dependencias:** `papaparse` y `jspdf` como dependencias, y `dxf-parser` y `@types/papaparse` como
  devDependencies. Actualiza `pnpm-lock.yaml`.
