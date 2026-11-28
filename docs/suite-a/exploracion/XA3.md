# XA3 · Contrato de pruebas y e2e que depende del armazón web (+ PWA y CSP)

Brief: `briefs/UA_exploracion.md`, tema XA3. Rama `ua-integracion` (HEAD 807cf30), worktree `~/archivos/opengeoslide-wt/ua-int`.
Solo lectura: no se editó ningún archivo versionado; no hay commit ni push.
Rutas de código relativas a `apps/web/` (web) o a la raíz del repo (`docs/…`).

Método: `find` + `rg`/Python sobre `docs/**/e2e/*.mjs` y `docs/fase2/ux/*-e2e/*.mjs` (61 archivos) y `apps/web/src/**/*.test.ts` (242 archivos).
Recuentos por script. «Guiones» = archivos `.mjs` distintos donde aparece el selector literal; un mismo guion puede contar en varias filas.
Los nombres que llegan por variable (`openMenu(page, name)`, `tab(page, tab)`) se cuentan en el sitio de llamada, no por valor.
Listas y recuentos crudos: `$TMPDIR/ua/XA3/` (`$TMPDIR` = `~/.hermes/profiles/open-geoslide/cache/scratch`): `e2e_files.txt`, `test_files.txt`, `selectores_raw.txt`.

---

## 0. Cifras de referencia

- **[verificado]** 61 `.mjs` e2e: 4 son `lib.mjs` (`docs/fase3/iw/e2e`, `docs/fase3/r2i2/e2e`, `docs/fase3/w1e/e2e`, `docs/fase2/ux/u4m-e2e`), 4 son de exploración o depuración (`w1e/e2e/{dbg,dbg_foco,explore}.mjs`, `u4m-e2e/u4m_explore.mjs`). Quedan **53 guiones**.
- **[verificado]** `docs/fase3/iw/e2e/run_regression.sh` ejecuta **50 guiones** (607 llamadas `step(`). Quedan fuera 3 de `docs/fase2/ux/u2c-e2e/` (`u2c_axe`, `u2c_keyboard`, `u2c_touch`) y los 8 auxiliares/exploración.
- **[verificado]** El brief habla de «unos 90 guiones». No sale de ningún recuento de `docs/**/e2e/*.mjs` (53 guiones, 61 archivos). Ver duda 1.
- **[verificado]** Tests unitarios: 242 `*.test.ts`, 0 `*.test.tsx`, 0 snapshots (`toMatchSnapshot`/`toMatchInlineSnapshot`/`__snapshots__` = 0). `vite.config.ts:27-28`: `environment: 'node'`, `include: ['src/**/*.test.ts']`.
- **[verificado]** 44 archivos de test renderizan a cadena con `renderToStaticMarkup`/`renderToString` y afirman sobre el HTML. Ningún test usa DOM real (sin testing-library, jsdom ni happy-dom).
- **[verificado]** 24 archivos de test leen fuentes (`.ts`/`.tsx`, `.css`, `.html`, `.md`, `.yml`) como texto y afirman sobre ellas (sección 2).

---

## 1. Selectores e2e por pieza de la interfaz

Pieza → selector → guiones. Archivo fuente del armazón actual entre paréntesis.

### 1.1 Cabecera y modo (`App.tsx`)

| Selector | Tipo | Guiones |
|---|---|---|
| tab «Editar» (`mode-edit`) | `getByRole('tab', …)` / `tab(page,…)` | 7 |
| tab «Casos de verificación» (`mode-cases`) | `getByRole('tab')`, incl. regex `/Casos de verificación/` | 15 (unión) |
| botón «Ayuda» | `getByRole('button')` | 10 |
| enlace «Saltar al contenido» | `getByRole('link')` | 1 |
| enlaces «Glosario», `/Atajos/` | `getByRole('link')` | 1 + 1 |
| «Recorrido guiado» (dentro de Ayuda) | `getByRole('button')` | 1 |
| `#mode-cases-panel`, `.cases-view` | CSS | 3 y 4 |

Origen: `App.tsx:483` (salto), `:490` (`role="tablist" aria-label="Modo de la aplicación"`), `:491` y `:494` (tabs `mode-edit`, `mode-cases`), `:511` (Ayuda), `:535`/`:538` (paneles `mode-edit-panel`, `mode-cases-panel`).

### 1.2 Menús desplegables (`ui/DropdownMenu.tsx`)

| Selector | Guiones |
|---|---|
| `openMenu(page, 'Archivo')` (helper) | 16 |
| `openMenuDebug(page, 'Archivo')` | 3 |
| botón «Archivo» (`getByRole`) | 7 |
| `openMenu(page, 'Exportar')` | 4 |
| `button.dd-trigger` (CSS) | 16 |
| `.dd-trigger` (CSS, sin tag) | 1 (4 usos) |
| `.dd-menu:popover-open button` | 1 |
| `menuitem «Dibujar región»` | 1 |

Origen: `ui/DropdownMenu.tsx:134` (`className="dd-trigger"`). Los helpers dependen de `aria-expanded="true"`, de `aria-controls` y de `:popover-open` (`docs/fase3/iw/e2e/lib.mjs:55-73`).
Nota: `docs/fase3/iw/e2e/lib.mjs:50-54` (comentario sobre `openMenu`) documenta una carrera conocida del guion con `Guardar`; el helper espera a `:popover-open` y reintenta tres veces.

### 1.3 Barra de acciones (`editor/EditorApp.tsx`)

`role="toolbar" aria-label="Acciones del modelo"` (`:647`), grupos `role="group"` «Cálculo» (`:736`), «Edición y herramientas» (`:719`), «Edición» (`:728`), «Herramienta del lienzo» (`:731`).

| Nombre (`getByRole('button')`) | Guiones | Nota |
|---|---|---|
| «Comprobar» (exacto) | 24 | 41 usos; también `button:has-text("Comprobar")` en 9 guiones |
| «Deshacer» / «Rehacer» | 13 / 9 | `EditorApp.tsx:624,627` |
| «Informe PDF» | 9 | `:764` (texto cambia a «Generando…») |
| «Guardar» (exacto) / `/^Guardar/` | 4 / 2 | `:678` (dentro de Archivo) |
| «Nuevo» | 6 | `:660` (dentro de Archivo) |
| «Editar» (botón, no pestaña) | 6 | Mismo nombre que la pestaña «Editar» de §1.1 |
| «Dibujar región» (botón) | 11 | Herramienta del lienzo |
| «Seleccionar» | 8 | `:98` (`TOOLS`) |
| «Encuadrar», «Mover vista» | 3, 2 | Botones del zoom del lienzo |
| «Exportar» (menú) | 3 | `:700` |
| «Exportar resultados (CSV)», `/Exportar resultados/` | 2, 2 | `:702` |
| «Exportar superficie (CSV)», «Exportar fuerzas de refuerzos (CSV)» | 4, 2 | `:708`, `:712` |

### 1.4 Línea de estado, motor y anuncios

| Selector | Guiones | Origen |
|---|---|---|
| `[data-testid="file-status"]` (texto «con cambios», «sin cambios», «sin cambios pendientes») | 5 | `EditorApp.tsx:773` (`ea-status`) |
| `[data-testid="engine-banner"]` (texto `/ogs-core/`) | 21 (20 con el texto) | `ui/EngineIndicator.tsx:23` |
| `[data-testid="engine-status"]` | 0 (no usado en guiones) | `EditorApp.tsx:778` |
| `[data-testid="live-polite"]` | 9 | `editor/app/LiveRegions.tsx:8` |
| `[data-testid="live-alert"]` | 2 | `editor/app/LiveRegions.tsx:11` |
| `[data-testid="export-hint"]` | 3 | `EditorApp.tsx:788` |
| `[data-testid="draft-banner"]` | 5 | `EditorApp.tsx:795` |
| `[data-testid="pending-drafts-hint"]` | 0 | `EditorApp.tsx:783` (`role="status"`) |

Textos exigidos: `file-status` con «con cambios» en 4 guiones (`u3i_integracion`, `u3i_walk`, `u3o_onboarding`, `u3o_walk_u2x`) y «sin cambios pendientes» en `u6d_drafts.mjs:177`. `engine-banner` debe contener `ogs-core` (`docs/fase3/iw/e2e/lib.mjs:44-49`, `start()`).

### 1.5 Lienzo (`editor/canvas/`)

| Selector | Guiones | Origen |
|---|---|---|
| `[data-testid="editor-canvas"]` | 8 | `EditorApp.tsx:821` |
| `[role="application"]` (dentro del lienzo) | 7 | `canvas/EditorCanvas.tsx:814`; `EditorApp.tsx:528` lo busca para enfocar |
| `[data-layer=…]` (de todas las capas) | 46 (111 usos) | `canvas/DrawLayer.tsx:28` (`draw`, `reinforce`, `split`), `EditorCanvas.tsx:843` (`grid`), y `regions`, `piezometric`… |
| `svg.ec-svg` | 13 | CSS del lienzo |
| `[data-handle]` / `[data-handle-key]` / `[data-handle-shape]` | 13 / 7 / 3 | Tiradores del lienzo |
| `[data-hit-area]` | 4 | Tiradores |
| `[data-testid="canvas-empty"]` | 4 | `canvas/EditorCanvas.tsx:1414` |
| `[data-testid="draw-hint"]` | 5 | `canvas/EditorCanvas.tsx:1367` |
| `[data-testid="split-hint"]`, `cursor-readout`, `slope-preview` | 4, 1, 2 | Lienzo |
| `[data-draw-point]`, `[data-draw-rubber]`, `[data-draw-edge-snap]` | 4, 2, 2 | Trazo en curso |
| `[data-vertex-row]` (filas de vértice) | 7 | `panels/GeometryPanel.tsx:83` |
| `[data-region-card]` | 4 | Lienzo/paneles |
| `[data-crack-*]`, `[data-critical-surface]` | 1–4 cada uno | Render de la grieta y de la superficie |

Lectura: 42 de 53 guiones dependen de algún selector de lienzo (`data-layer`, `data-handle`, `role="application"`, `ec-svg`, `ec-root`).

### 1.6 Franja de resultados (`EditorApp.tsx:853-854`)

`<section data-testid="results-panel" aria-labelledby="ea-results-title">` con `<h2 id="ea-results-title">Resultados…</h2>`. El texto del `h2` cambia a «(desactualizados)» cuando el resultado es viejo (`EditorApp.tsx:854`).

| Selector | Guiones | Origen |
|---|---|---|
| `[data-testid="results-panel"]` (incl. `table tbody tr`, `h2`) | 11 | `EditorApp.tsx:853` |
| `[data-testid="stale-result"]` | 2 | `EditorApp.tsx:841` |
| `[data-testid="result-summary"]` | 3 | `editor/app/ResultSummary.tsx:57` (y `onboarding/tour.ts:42`) |
| «Ver tabla de resultados» | 2 | `ResultSummary.tsx:87` |
| `[data-results-table]` (`table`) | 5–6 | `ui/ResultsTable.tsx:72` |
| `[data-testid="reinforcement-forces"]` | 3 | `ui/ReinforcementForces.tsx:20` |
| `[data-testid="crack-results"]`, `crack-summary` | 2, 2 | `ui/CrackResults.tsx:18` |
| `[data-testid="structural-limit"]`, `result-caption` | 2, 1 | Franja |
| `#results-title`, `.cases-view #results-title` | 2, 4 | Ojo: el id del `h2` del armazón actual es `ea-results-title` (`EditorApp.tsx:854`); `results-title` es el de Casos |
| `[data-testid="cases-progress"]` | 0 | `App.tsx:346` (`role="status"`) |
| Texto «Desmarque Bishop…» / `/Bishop simplificado no se ofrece…/` | 1 / 2 | Mensajes de Casos y de Análisis |

### 1.7 Tablist «Paneles del modelo» y paneles (`EditorApp.tsx:864-865`)

`<aside className="ea-side" aria-label="Propiedades del modelo">` con `<div className="ea-tabs" role="tablist" aria-label="Paneles del modelo">`.
Las 10 pestañas salen de `const TABS` (`EditorApp.tsx:83-94`): Geometría, Materiales, Agua, Superficie, Búsqueda, Análisis, Cargas, Refuerzos, Sismo, Proyecto.
Guiones que usan al menos una de las 10 pestañas (`getByRole('tab', {name})` o `tab(page, name)`): **37 de 53**.

| Pestaña | Guiones | Pestaña | Guiones |
|---|---|---|---|
| Proyecto | 13 | Análisis | 8 |
| Materiales | 10 | Refuerzos | 7 |
| Geometría | 9 | Superficie | 6 |
| Cargas | 3 | Agua | 4 |
| Búsqueda | 2 | Sismo | 2 |

- Helper `tab(page, name)` = `getByRole('tab', { name, exact: true }).click()` (`docs/fase3/iw/e2e/lib.mjs:93`). Lo copian `w1e/lib.mjs:84`, `r2i2/lib.mjs:93` y `u4m-e2e/lib.mjs`.
- `[role="tablist"][aria-label="Paneles del modelo"]` aparece en `onboarding/tour.ts:30` (la visita guiada) y en 2 guiones.
- Campos (`getByLabel`): 48 etiquetas distintas. Las más usadas, con su pieza verificada:
  - «Unidades» (6 guiones): `NewSlopeDialog.tsx:113` y el diálogo de unidades (`ProjectPanel.tsx:33`, `data-testid="units-dialog"`).
  - «Agregar un estrato inferior (material 2)» (6): `NewSlopeDialog.tsx:162`.
  - «Función de fuerzas entre dovelas f(ξ)» (5): `AnalysisPanel.tsx:69`.
  - «Función entre dovelas, punto 2: ξ» (4): `panels/forms.ts:1546` (genera `Función entre dovelas, punto N, c`).
  - «Título» (4), «Descripción» (2): `ProjectPanel.tsx:122`, `:142`.
  - «Altura H» (3), «Peso unitario γ» (3, regex): `NewSlopeDialog.tsx:120`, `:153`.
  - «Incluir grieta de tracción» (2): `AnalysisPanel.tsx:203`.
  - «Rejilla de ajuste» (2): `GeometryPanel.tsx:226`.
  - «Modelo de arrancamiento» (regex, 2): `ReinforcementsPanel.tsx:229`.
  - «kh» (2): sismo (`editor/app/issueNav.ts:146` trae la ruta `/analysis/seismic/kv`).
- Atributo `[data-path="/analysis/…"]` (12 guiones, `input` y `select`): `AnalysisPanel.tsx:73` y `:192`. Es un direccionamiento por ruta JSON sin depender de la etiqueta visible. Sobrevive a un rediseño mientras se conserve.
- Radios y casillas de método (`getByRole`): «Polílinea» 5, «Fija» 5, «Círculo» 2; «Morgenstern-Price» 5, «Bishop simplificado» 4, «Spencer» 2, «Janbu corregido» 2, «Janbu simplificado» 1 (nombres de `ui/methodLabels.ts`).

### 1.8 Diálogos, confirmaciones, borradores y ayuda

| Selector | Guiones | Origen |
|---|---|---|
| `[data-testid="confirm-dialog"]` | 20 | `ui/ConfirmDialog.tsx:55` |
| botón «Descartar cambios» (exacto) | 13 | `editor/app/discard.ts`, `panels/MaterialsPanel.tsx:310` |
| «Seguir editando», «Cancelar» | 3, 2 | `discard.ts:23,60` |
| «Talud simple…» / «Crear talud» | 13 / 11 | `EditorApp.tsx:284`, `editor/app/NewSlopeDialog.tsx:215` |
| `dialog[open]` (CSS) | 19 | Todos los diálogos |
| `dialog.ea-dialog[open]` | 2 | Clase del armazón actual |
| `[data-testid="units-dialog"]` | 7 | `ProjectPanel.tsx:33` |
| `[data-testid="help-dialog"]` | 5 | `ui/HelpDialog.tsx:120` |
| `[data-testid="guided-tour"]`, `tour-live`, `tour-ring` | 4, 1, 1 | `onboarding/GuidedTour.tsx:171,159` |
| «Siguiente», «Anterior», «Terminar» | 3, 1, 2 | `GuidedTour.tsx:196,199` |
| `[data-testid="install-app"]` | 3 | `ui/InstallButton.tsx:10` |
| «Recuperar» / «Descartar» (borradores) | 4 / 2 | Banner de borrador (`EditorApp.tsx:795`) |
| `[data-testid="draft-open-elsewhere"]` | 3 | Borradores |
| «Importar», «Importar CSV», «Importar piezométrica» | 2, 1, 2 | Menú Archivo / diálogos de importación |
| «Cerrar todos», `/Ver \d+ más/` | 2, 2 | `editor/app/NoticeList.tsx:63` |

### 1.9 Casos de verificación (`App.tsx`, vista de modo `cases`)

- «Comprobar caso» (botón): 12 guiones. Origen `App.tsx:337`. El texto «Pulse «Comprobar caso»» de `App.tsx:387` lo fija `casesVerb.test.ts:9`.
- `#cases-bishop-note` (2), `#checks-title` (2), `.cases-view table.checks` (1), `.badge-ok`/`.badge-fail` (1 cada uno), `.cases-view canvas.section-canvas` (1), `.cases-view .legend` (1), `.banner-error` (1).
- Los guiones no citan `#cases-progress`.

### 1.10 Helpers compartidos y copias

- `docs/fase3/iw/e2e/lib.mjs`: `casePath` (:13), `launch` (:30), `start` (:44, espera `[data-layer="regions"] polygon` y `ogs-core`), `openMenu` (:55), `openMenuDebug` (:75), `newSlope` (:82), `tab` (:93), `saveText` (:97), `cli` (:110, llama a `OGS_BIN analyze`), `check` (:116, clic en «Comprobar» y espera `[data-testid="results-panel"] table tbody tr`).
- **[verificado]** `lib.mjs` existe en 4 copias (`w1e`, `r2i2`, `iw`, `u4m-e2e`) con diferencias. **[verificado]** `function openMenu` está definido en 16 archivos (`grep -l`). Un cambio en el contrato de menús obliga a tocar 16 archivos o a centralizarlo.

---

## 2. Tests unitarios que fijan estructura o estilos del armazón

Los 24 archivos que leen fuentes como texto. **[verificado]** `archivo` → qué afirma.

**Fijan CSS o tokens:**
- `editor/canvas/EditorCanvas.test.ts:262-266` → `canvas.css` `.ec-root{height:100%}` y `App.css` `.ea-canvas{height: clamp(320px, 55dvh, 640px)}`. El armazón actual pone la altura del lienzo en `App.css`; un rediseño que mueva esa regla rompe el test. Este archivo tiene 112 `expect`.
- `ui/targets.test.ts:8-19` → `min-height: 24px` en `summary` y en `.help-scroll a`; `App.tsx` importa `'./ui/targets.css'`.
- `editor/panels/panels.r15c.test.ts:9-17` y `ReinforcementsPanel.layout.test.ts:9-12` → `panels.css` (`.ep-field.ep-wide{grid-column:1/-1}`, `.ep-wide select{width:100%}`) y la clase literal `"field ep-field ep-wide"` en `ReinforcementsPanel.tsx`.
- `ui/legendItems.test.ts:43-58` y `legend.pondCrack.test.ts:26` → `legend.css` y `import './legend.css'` en `Legend.tsx`.
- `styles/no-hardcoded-colors.test.ts:11,24-40` → `ALLOWED = {styles/tokens.css, report/palette.ts, theme/lightPalette.ts}`; escanea `App.css` (`:31`), `EditorCanvas.tsx`, `pwa/updatePrompt.ts` y `render/drawSection.ts`. Cualquier color literal nuevo fuera de `tokens.css` rompe este test.
- `styles/tokens.contrast.test.ts:7` → parsea los `light-dark(…)` de `tokens.css`. `PAIRS` (`:71-120`) fija texto `ui-ink`, `ui-ink-muted`, `ui-accent`, `ui-ok/warn/err/info/note-ink` contra sus fondos (4,5:1 para texto; 3:1 para `ui-control-border`), y `:176-180` fija `color-scheme`, `accent-color`, `scrollbar-color` y los bloques `html[data-theme='light'|'dark']`.
- `theme/lightPalette.test.ts:7` y `report/palette.test.ts:16-30` → la paleta del lienzo en Node y la del PDF deben coincidir con los valores claros de `tokens.css` (`--canvas-mat-N`).
- `render/drawSection.test.ts:75` → sin paleta usa la clara de `tokens.css`.

**Fijan `index.html`:**
- `theme/theme.test.ts:273-322`: el script de tema debe ir justo después de `<meta name="color-scheme">`, sin `type=module`/`defer`/`async`/`src` (`:276-281`), y no puede haber `<script>` ni `stylesheet` entre ambos (`:283-284`). El `theme-color` debe llevar `data-color` igual al `--ui-bg` de `tokens.css` (`:312-321`, con el atributo `content` antes de `data-color` y `media` después).
- `pwa/pwa.test.ts:240-250` → `href="%BASE_URL%manifest.webmanifest"`, `icons/icon.svg`, `icons/icon-192.png`, sin rutas absolutas a la raíz.
- `theme/theme.test.ts:323-325` → `expect(html).not.toMatch(/Content-Security-Policy/i)`: afirma que no hay CSP.

**Fijan código fuente (literales de JSX o llamadas), no comportamiento:**
- `casesVerb.test.ts:8-13` → `App.tsx` contiene «Comprobar caso» y no contiene «Calcular».
- `editor/app/tabSwitch.r16.test.ts:98-103` → `setTabState(` aparece exactamente **una** vez en `EditorApp.tsx`; contiene literal `onClick={() => void setTab(t.id)}`. Es la única prueba que menciona el `tablist` (en el nombre del `it`).
- `editor/app/tabSwitch.r16c.test.ts:88` (`pendingDrafts: engine.pendingDrafts.length`), `discard.r16.test.ts:108` (`createConfirmDiscard(store, confirm, …)`), `EditorApp.r15c.test.ts:40-43` (`fileStatusText({ dirty, pendingDraftCount: … })` y prohibe «· sin cambios pendientes»), `saveDocument.r16.test.ts` (44 `expect`), `newSlopeDialog.test.ts` (20 `expect`, lee `NewSlopeDialog.tsx` y `canvas.css`).
- `editor/app/ResultSummary.r15c.test.ts:46-58` → atributos `data-state="current"|"stale"`, `data-stale-reason="drafts"` y la clase `rs-list rs-stale`.
- `ui/noImportCycle.test.ts:8`, `ui/dialogFocusReturn.test.ts:15-27` (regex sobre imports y llamadas `restoreFocus(…)`), `report/pdf.test.ts:185`, `report/hoekBrown.f3b.test.ts:33`.
- `noWindowConfirm.test.ts:21-` → no hay `window.confirm`, `window.alert` ni `window.prompt` en `src`.
- `ci/workflows.test.ts` lee `.github/workflows/*.yml` (no es armazón).

**Fijan HTML renderizado (44 archivos, `renderToStaticMarkup`):**
- `EditorCanvas.test.ts:22-27`: `role="application"`, 2 `data-region`, 10 `data-handle="vertex"`, `aria-label="Región 1, vértice 3: x 60,0 m, y 5,0 m"`, `tabindex="0"`.
- `ui/resultsTable.test.ts:163`: `<caption>Resultados del análisis por método</caption>`; `resultsTable.polyline.test.ts:28`: `<th scope="col"`.
- `ui/crackResults.test.ts:24` (3 `<tr>`); `editor/panels/MaterialsPanel.f3b.test.ts:76` (3 `<tr>` en tbody); `render/reinforcements.test.ts:128` (2 `<table`).

**Cuentan pestañas o elementos:** no hay test que cuente pestañas del tablist ni los de «Modo». Los conteos son de `<tr>`, `<table` y `data-handle`.

**Texto de los tests en la app:** `grep` de «Paneles del modelo», «Resultados», «Informe»: solo aparecen en comentarios o en `it(…)` de `tabSwitch.r16`. Ningún test fija el nombre de una vista nueva («Lienzo», «Informe»).

---

## 3. Runner de regresión

- **[verificado]** `docs/fase3/iw/e2e/run_regression.sh`: 50 guiones de 53. Por carpeta: `u3i` 5, `u3m` 4, `u3o` 3, `u4m` 5, `u4p` 3, `u5e` 2, `u5s` 2, `u6d` 2, `u6g` 2, `u6k` 2, `w1e` 2, `w1f` 1, `iw` 5, `r2i2` 5, `g1w1` 2, `g1w2` 1, `g3w` 1, `r12` 1, `r13` 2.
- **[verificado]** Huecos: `docs/fase2/ux/u2c-e2e/` (3 guiones) no está en la lista, aunque la cabecera del script dice «todos los guiones de docs/fase2/ux/{u3i,…,u6k}-e2e/». El script no tiene `u2c`.
- **[verificado]** Variables: `OGS_URL=http://127.0.0.1:5186/` (5187 solo para `w1f_canvas`), `OGS_REPO` (por defecto la raíz del repo), `OGS_BIN=$repo/target/release/ogs`, `OGS_FX=$TMPDIR/u6g-fx` (lo rellena `docs/fase2/ux/u6g-e2e/make_fixtures.py`), `TMPDIR`. Las axe-core van en `$TMPDIR/x8-ux` o `w2-e2e` (cabecera del script). Otros controles por guion: `OGS_CASE`, `OGS_LABEL`, `THEME`, `WITH_PROJECT`, `OUT`, `SHOTS`, `AXE`.
- **[verificado]** Dos servidores: 5186 (`vite preview` de `dist`) y 5187 (`docs/fase3/w1f/e2e/build_hook.sh`). El script sale con código 0 aunque haya `FAIL`: hay que contar líneas `^FAIL`.
- **[verificado]** CI (`.github/workflows/ci.yml`, `pages.yml`) no ejecuta los `.mjs` (`grep e2e|playwright` = 0). Solo corre `pnpm test`, `typecheck`, `build` y comprobaciones de `dist`. El e2e lo lanza el coordinador a mano (skill `ogs-e2e-preview-integration`, que documenta `scripts/full_regression.sh`).

---

## 4. PWA y CSP

### 4.1 Precarga

- **[verificado]** `apps/web/build/pwa-plugin.ts:7-9`: `EXCLUDE = [sw.js, *.map]` y `NOT_PRECACHED = [/^fonts\//]`. `closeBundle` (`:31-50`) recorre todo `dist/`, quita lo excluido y ordena. `:39`: `files = built.filter(!NOT_PRECACHED)`. La versión (`:36-38`) es el hash sha256 de **todo** `dist/`, fuentes incluidas.
- **[verificado]** `build/sw-template.js:14` (`ASSETS = __PRECACHE__`) y `:22` (`cache.addAll`, instalación «todo o nada»). Navegación: `index.html` del precache (`:51`). Fuentes: caché de tiempo de ejecución al primer uso (`:56-68`). Resto: precache primero (`:71-73`).
- **[verificado]** `pwa/pwa.test.ts:275-282` fija que `fonts/*.ttf` **no** entran en el precache, pero sí cambian la versión.

**Consecuencia para una fuente woff2 nueva:**
- Si se **importa desde CSS o TS** (`import f from './x.woff2'`), Vite la emite a `dist/assets/` y el plugin la precachea sola. **[inferido]** Vite emite a `assets/` salvo que quepa en `assetsInlineLimit`, en cuyo caso va en base64 dentro del CSS. Ambos casos entran en la precarga.
- Si se **coloca en `apps/web/public/fonts/`**, acaba en `dist/fonts/` y **no entra**: solo se cachea al primer uso, así que sin red la primera vez no está.
- **[verificado]** Hoy no hay `@font-face` ni `.woff2` en `apps/web/src` (`rg`). `App.css:4` usa `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`. Las únicas fuentes del repo son `apps/web/public/fonts/DejaVuSans.ttf` (705.684 bytes), `DejaVuSans-Bold.ttf` (757.076 bytes), su licencia y un README. Son para el PDF (`report/pdf.ts:56`, `fetch(BASE_URL + 'fonts/…')`).
- **[verificado]** `vite.config.ts` no fija `assetsInlineLimit` (default de Vite, **[inferido]** 4 KiB).

### 4.2 CSP

- **[verificado]** No hay CSP en `apps/web/index.html` (35 líneas: `theme-color`, `color-scheme`, script de tema en línea en `:11-24` sin `type`, `manifest` y `icon` con `%BASE_URL%`, dos `<script type="module">` en `:32-33`). No hay `<meta http-equiv="Content-Security-Policy">` en el repo (excluidos `node_modules`, `dist`, `target`, `.git`). La única mención está en `theme/theme.test.ts:323-325` (la prueba que lo afirma).
- **[verificado]** No hay `_headers`, `_redirects`, `netlify.toml`, `vercel.json` ni `server.headers` en `vite.config.ts`. Pages (`pages.yml`) no permite cabeceras propias. **[inferido]** Cualquier CSP tendría que ir como `<meta>`.
- **[inferido]** Si se añade CSP por `<meta>`: el script en línea de `index.html:11-24` necesita un hash `sha256` (no nonce), y `theme.test.ts:323-325` tendría que cambiar.

### 4.3 Comprobaciones de CI sobre `dist/`

- **[verificado]** `ci.yml:170-176`: hay un `.wasm`, `sw.js` no vacío, `manifest.webmanifest` no vacío, y `sw.js` menciona `.wasm`.
- **[verificado]** `pages.yml:55`: `grep -q "src=\"${VITE_BASE}assets/" dist/index.html`. Si la maqueta cambia cómo se referencia el script de módulo en `index.html`, esta comprobación se rompe.

---

## 5. Contratos que el rediseño «A · Flujo de trabajo» tendría que respetar

Cada fila es un punto en el que la maqueta cambia algo que hoy fijan los guiones o los tests. Recuentos de §1.

1. **Pestañas del modelo.** La maqueta pone «Modelo» como barra lateral de pasos con secciones (estado y resumen) y pestañas numeradas «Lienzo · Resultados · Casos de verificación · Informe». Los guiones usan `role="tab"` para las 10 pestañas de §1.7 (37 de 53 guiones) y para «Editar» y «Casos de verificación» (15 guiones). Si las secciones de la barra lateral no son `role="tab"`, hay que reescribir `tab()` y las 16 copias de `openMenu` (o las pestañas tienen que conservar el rol).
2. **Nombres duplicados.** «Editar» es pestaña (`App.tsx:491`, 7 guiones) y botón (`EditorApp.tsx`, 6 guiones). La maqueta llama «Lienzo» a la vista de edición. Con `exact: true`, ambos nombres deben seguir existiendo.
3. **Línea de estado.** `[data-testid="file-status"]` (5 guiones) debe conservar su testid y los textos «con cambios» / «sin cambios». `engine-banner` con `ogs-core` (21 guiones) se consulta en `start()`. La barra inferior de la maqueta (ejemplo, herramienta, coordenadas, motor) tiene que conservar el texto de motor.
4. **Lienzo.** 42 de 53 guiones dependen de `data-layer`, `data-handle`, `role="application"`, `ec-svg` o `ec-root`. La tarjeta con paleta flotante puede cambiar la estructura, pero estos atributos no.
5. **Altura del lienzo.** `EditorCanvas.test.ts:264-265` fija `.ea-canvas { height: clamp(320px, 55dvh, 640px) }` en `App.css`. Hay que mover esta regla o el test.
6. **Menús Archivo y Exportar.** `button.dd-trigger` (16 guiones) y `aria-expanded` / `aria-controls` / `:popover-open`. Hay que conservar `DropdownMenu` como lo usan `lib.mjs`.
7. **Resultados como vista.** `[data-testid="results-panel"]` con `h2` «Resultados» (11 guiones), `#ea-results-title` (2 guiones en CSS) y `result-summary`. Si «Resultados» pasa a ser pestaña, el `h2` puede desaparecer y hay que moverlo.
8. **Literales de código.** Cinco tests comparan literales de JSX o de llamadas de `EditorApp.tsx`/`App.tsx` (`tabSwitch.r16`, `tabSwitch.r16c`, `discard.r16`, `EditorApp.r15c`, `casesVerb`). Un refactor fiel al comportamiento los rompe igual.
9. **Tokens y colores.** `no-hardcoded-colors` (solo `tokens.css`, `palette.ts`, `lightPalette.ts`) y `tokens.contrast` (pares `ui-*`) se aplican a `tokens.css`. Los `--gs-*` de la maqueta deben entrar en `tokens.css` con `light-dark()` y en `PAIRS` si se quieren medir.
10. **Fuentes.** Ver §4.1: `src/` para que entren en la precarga; `public/` no.
11. **Índice de `index.html`.** `theme/theme.test.ts:273-322` exige que el script de tema vaya justo tras `color-scheme` y sin `<link rel="stylesheet">` ni `<script>` entre ambos. Un `<link rel="preload">` de fuente no lo rompe; un `<link rel="stylesheet">` sí.

---

## 6. Dudas para el coordinador

1. **Número de guiones.** El brief dice «unos 90». Hay 53 guiones y 50 se ejecutan. ¿Se refiere a otra cifra (pasos `step(`: 607; o contando los `lib` y `dbg`: 61 archivos)?
2. **`u2c-e2e` fuera del runner.** Sus 3 guiones (`axe`, `keyboard`, `touch`) no están en `run_regression.sh` aunque la cabecera dice otra cosa. ¿Es intencional?
3. **Pestañas del armazón A.** ¿Las 10 pestañas de «Paneles del modelo» pasan a secciones de la barra lateral sin `role="tab"`? Eso obliga a reescribir 37 guiones (o `tab()` en 4 copias de `lib.mjs` y 16 `openMenu`). ¿O se conserva el rol?
4. **Fuentes nuevas.** ¿En `src/` (se precachean) o en `public/` (no; hay que cambiar `NOT_PRECACHED` y `pwa/pwa.test.ts:275-282`)?
5. **CSP.** No existe. ¿Se quiere añadir por `<meta>` (requiere hash del script en línea y cambiar `theme.test.ts:323-325`), o se deja tal cual?
6. **Tests `.tsx`.** `vite.config.ts:28` solo incluye `src/**/*.test.ts`. Un test `.tsx` (p. ej. con testing-library) no se ejecutaría. ¿Se amplía el `include` antes de escribir tests del armazón nuevo?
7. **Nombres de vista.** La maqueta usa «Lienzo», «Resultados», «Informe» y «Casos de verificación». El e2e espera «Editar» y «Casos de verificación» (15 guiones). ¿Qué nombre gana?
8. **Lista de precarga y `assetsInlineLimit`.** Confirmar que una woff2 importada desde `src/` sale en `dist/assets/` con el build actual (no lo he probado; corresponde a XA2 o a un build local).
