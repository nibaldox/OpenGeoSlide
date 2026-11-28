# XA1 · Inventario del armazón actual y brechas contra la maqueta A

- Explorador: XA1 (solo lectura de código; sin commits, sin ediciones de archivos versionados).
- Worktree: `~/archivos/opengeoslide-wt/ua-int`, rama `ua-integracion`, HEAD `807cf30` (brief), base `v0.5.0` (`69d0413`). Árbol limpio al empezar (`git status --short` vacío).
- Maqueta: `~/archivos/geo-suite-design` (`src/flujo.html`, `src/suite.css`, `src/ogs-mock.js`, `capturas/03-ogs-A-flujo-oscuro.png`, `docs/DISENO_B.md`).
- Marcas: **[verificado]** = leído en el código o salida de comando (`archivo:línea`); **[inferido]** = deducción mía a partir de lo leído.
- Rutas relativas al repo: `apps/web/…` = `~/archivos/opengeoslide-wt/ua-int/apps/web/…`.

---

## 1. Árbol de componentes del armazón actual

Convención de cada línea: `archivo:línea` · componente · clases · rol y nombre accesible · `data-testid`. «—» = no aplica.

### 1.1 Raíz y cabecera (`apps/web/src/App.tsx`, función `App`)

- `index.html:2` · `<html lang="es">` · — · — · —
- `App.tsx:481` · `div.app[lang=es]` · `.app` · — · —
- `App.tsx:482-484` · enlace «Saltar al contenido» · `.skip-link` · link «Saltar al contenido» (`href=#main-content`) · —
- `App.tsx:485-489` · `header.app-header` > `div.app-brand` · `.app-header`, `.app-brand` · landmark banner (header) · —
  - `App.tsx:487` `h1` «OpenGeoSlide»; `App.tsx:488` `p.muted` «Estabilidad de taludes 2D: superficies de deslizamiento por Bishop, Spencer, Morgenstern-Price y Janbu». **No hay SVG de marca** [verificado: sin `<svg>` en `App.tsx:485-515`].
- `App.tsx:490-497` · `div[role=tablist][aria-label="Modo de la aplicación"]` con 2 `button[role=tab]`: #mode-edit «Editar», #mode-cases «Casos de verificación» · `.mode-tabs`, `.mode-tab`, `.mode-tab-active` · tab · `id=mode-edit|mode-cases`
- `App.tsx:498-514` · `div.app-header-tools`:
  - `ui/EngineIndicator.tsx:20-36` · `p.engine-badge.engine-badge-{ok|simulated|error|loading}` con `span.engine-dot` (aria-hidden) · texto «Motor: … (WASM)» o «Motor simulado» · sin rol · `data-testid=engine-banner`, `data-engine-state`
  - `ui/InstallButton.tsx:5-10` · `button.install-button` (solo si es instalable) · botón · `data-testid=install-app`
  - `App.tsx:501-512` · `button.help-button[aria-haspopup=dialog]` · `.help-button` · botón «Ayuda» · —
  - `ui/ThemeSelect.tsx:5-18` · `label.theme-select` > `select` · `.theme-select` · combobox con nombre «Tema» (label envolvente) · opciones «Sistema (oscuro|claro)», «Claro», «Oscuro»
- `App.tsx:518` · `GuidedTour` (`onboarding/GuidedTour.tsx:50`) · no modal; `role=dialog` con `h2.tour-title` (`GuidedTour.tsx:166-184`) · `data-testid=tour-live` (`GuidedTour.tsx:159`)
- `App.tsx:521-526` · `div.banner.banner-sim[role=status]` (solo modo simulado) · — · status
- `App.tsx:527-531` · `div.banner.banner-error[role=alert]` (fallo de carga del motor) · — · alert
- `App.tsx:534-541` · `main#main-content[tabIndex=-1]` con dos `div[role=tabpanel]`:
  - `#mode-edit-panel` (`App.tsx:535-537`) → `EditorApp`
  - `#mode-cases-panel` (`App.tsx:538-540`) → `CasesView`
  - Ambos modos quedan montados; el oculto usa `hidden` (comentario `App.tsx:533`).
- `App.tsx:543` · `HelpDialog` (`ui/HelpDialog.tsx:83`) · `dialog` con `h2`, `nav[aria-label="Contenido de la ayuda"]` (`HelpDialog.tsx:136`)
- `App.tsx:545` · `ConfirmHost` (`ui/ConfirmDialog.tsx:78`) · diálogo de confirmación único

### 1.2 Vista «Casos de verificación» (`App.tsx:82-419`, `CasesView`)

- `App.tsx:293` · `div.cases-view > div.layout` (grid 300 px + 1fr, `App.css:163-168`)
- `App.tsx:295` · `aside.sidebar`:
  - `App.tsx:296` · `section.panel[aria-labelledby=controls-title]` · h2 «Análisis» (`App.tsx:297`)
    - `App.tsx:298-307` · `label.field` «Caso» > `select` con la lista de casos (`cases` de `loadBuiltinCases`) · `select` con nombre «Caso»
    - `App.tsx:308-311` · `label.field` «Cargar modelo o caso (.json)» > `input[type=file]`
    - `App.tsx:312` · `p.muted.small` = `describeAnalysis(...)` (`App.tsx:66-79`)
    - `App.tsx:314-333` · `fieldset.field` > `legend` «Métodos» con 5 `label.checkbox` (una por método; Bishop puede quedar deshabilitado)
    - `App.tsx:335-344` · `div.ep-actions`: `button.primary` «Comprobar caso» (o «Comprobando…») · `button` «Cancelar» (`data-testid=cases-cancel`, solo ocupado)
    - `App.tsx:345-349` · `p[role=status][data-testid=cases-progress]` (solo ocupado)
  - `App.tsx:352-358` · `PerformancePanel` (`ui/PerformancePanel.tsx`) · medición de tiempos
- `App.tsx:361` · `div.content`:
  - `App.tsx:362-366` · `div.banner[role=status][data-testid=cases-notice]`
  - `App.tsx:367-371` · `div.banner.banner-error[role=alert]`
  - `App.tsx:373-389` · `section.panel[aria-labelledby=section-title]` · h2 «Sección» · `SectionCanvas` (`render/SectionCanvas.tsx:10`, canvas 2D) + `Legend` (`App.tsx:378`) + `p[data-testid=result-caption]` (`App.tsx:380`)
  - `App.tsx:391-404` · `section.panel[aria-labelledby=results-title]` · h2 «Resultados» · `ResultsTable` (solo con cálculo)
  - `App.tsx:406-414` · `section.panel[aria-labelledby=checks-title]` · h2 «Verificación» · `CheckTable` (`ui/CheckTable.tsx:7`; `div[role=region][aria-label="Tabla de comprobación frente a los valores publicados"]`, `table.checks`)

### 1.3 Editor (`apps/web/src/editor/EditorApp.tsx`, función `EditorApp`)

**Barra de acciones** (`EditorApp.tsx:647`, `div.ea-toolbar.panel[role=toolbar][aria-label="Acciones del modelo"]`, clases `.ea-toolbar`, `.ea-group`):

- Grupo «Menús» (`EditorApp.tsx:648-716`, `div[role=group][aria-label=Menús]`):
  - `DropdownMenu` «Archivo» (`EditorApp.tsx:658-699`; `ui/DropdownMenu.tsx:28`, trigger `button.dd-trigger` con texto «Archivo ▾», `DropdownMenu.tsx:144`). Contenido (popover `auto`, `.dd-menu`):
    - «Nuevo» `EditorApp.tsx:659` (con `span.dd-note` `#ea-new-hint`)
    - «Talud simple…» `:665`
    - «Abrir» `:668` (`title=Ctrl+O`)
    - «Guardar» `:671-679` (`disabled` con borradores)
    - `hr` · «Importar DXF» `:681` · «Importar CSV» `:684`
    - `hr` · `label.dd-field` «Ejemplos» > `select[aria-label="Abrir un caso publicado como modelo"]` `:688-698`
  - `DropdownMenu` «Exportar» (`EditorApp.tsx:700-715`): «Exportar resultados (CSV)» `:701`, «Exportar dovelas (CSV)» `:704`, «Exportar superficie (CSV)» `:707`, «Exportar fuerzas de refuerzos (CSV)» `:710-714` (condicional)
- Edición y herramientas:
  - Ancho ≤ 480 px (`useNarrow`, `EditorApp.tsx:717-725`): `group[aria-label="Edición y herramientas"]` con `DropdownMenu` cuya etiqueta depende de la herramienta (`editMenuLabel`, `EditorApp.tsx:720`).
  - Ancho mayor (`EditorApp.tsx:728-734`):
    - `group[aria-label=Edición]`: «Deshacer» (`:623`, `title=Ctrl+Z`), «Rehacer» (`:626`, `title=Ctrl+Mayús+Z o Ctrl+Y`)
    - `group[aria-label="Herramienta del lienzo"]` (`:731-733`): 6 botones `.ea-tool` con `aria-pressed` (`TOOLS` `EditorApp.tsx:97-104`): «Seleccionar» (V), «Agregar vértice» (A), «Dibujar región» (R), «Dividir región» (D), «Dibujar refuerzo» (sin tecla), «Mover vista» (H). `title="Tecla X"`.
- `group[aria-label=Cálculo].ea-group-main` (`EditorApp.tsx:736-766`):
  - `button.primary.ea-primary` «Comprobar» (o «Calculando…», `checkButtonState` en `editor/app/engineCheck.ts:119-126`) · `title=Ctrl+Intro`
  - «Cancelar cálculo» (solo ocupado, `:747-751`)
  - «Reiniciar el motor» (solo motor fallido, `:752-756`)
  - «Informe PDF» (o «Generando…», `:757-765`; `onReport` `:432-453`)
- Inputs ocultos: `input#file-open` (`data-testid=file-open`, `:767`), `file-dxf` (`:768`), `file-csv` (`:769`).

**Línea de estado** (`EditorApp.tsx:772-792`, `div.ea-statusbar`) — **situada encima del lienzo, no al pie**:
- `p.ea-status.small[data-testid=file-status]` · `<strong>` = `documentTitle(...)` + `fileStatusText(...)` (`EditorApp.tsx:124-138`: «archivo sin cambios» / «archivo con cambios sin guardar» + borradores + «calculando…»)
- `p.ea-engine-status[data-testid=engine-status]` (`:778-780`, solo si hay texto de `checkButtonState`)
- `p#ea-pending-drafts.ea-export-hint[role=status][data-testid=pending-drafts-hint]` (`:783-786`)
- `p#ea-export-hint[data-testid=export-hint]` (`:788-790`)

**Avisos de estado de la sesión**:
- `div.ea-draft.banner[data-testid=draft-banner]` (`:794-812`) con botones «Recuperar» y «Descartar»
- `div.banner.banner-sim` (`draftFailure`, `:813`); `div.banner(.banner-error)` con `engine.message` (`:814`)
- `NoticeList` (`editor/app/NoticeList.tsx:9-70`, `:815`): `div.ea-notice-bar[data-testid=notice-bar]` > `ul.ea-notices[aria-label=Mensajes][data-testid=notices]`; por aviso `button` «Cerrar mensaje» (`aria-describedby`); «Ver N más», «Ver menos», «Cerrar todos» (`NoticeList.tsx:49-67`). Máx. 3 visibles; cierre automático de los informativos (6 s).
- `LiveRegions` (`editor/app/LiveRegions.tsx:5-16`, `:646`): `div[aria-live=polite][data-testid=live-polite]` y `div[role=alert][data-testid=live-alert]`, ocultos con `.visually-hidden`.

**Cuerpo** (`EditorApp.tsx:817`, `div.ea-layout`, grid `minmax(0,1fr) 420px`, `App.css:803-806`; a 1 columna ≤ 1000 px, `App.css:811`):

- Columna principal `div.ea-main` (`:818`):
  - **Franja de resultados** `ResultSummary` (`editor/app/ResultSummary.tsx:23-98`; `EditorApp.tsx:819`): `div.rs[role=group][aria-label="Resumen del cálculo"][data-testid=result-summary][data-state]`.
    - Vacío: `p.rs-empty` «Sin resultados. Pulse «Comprobar» para calcular el factor de seguridad (FS).»
    - Ocupado: `p[data-testid=calc-progress]` «Calculando… (n s)»
    - Con resultado: `ul.rs-list` > `li.rs-item` por método: `span.rs-method` (nombre), `span.rs-fs[data-testid=fs-<método>]` («FS» + valor), `span.rs-flag[data-testid=warn-<método>]` («⚠ Con aviso»), `span.rs-status` («Convergió» / «No convergió» / «No válida»). `p.rs-counts` (recuento de avisos), `button.rs-table-link` «Ver tabla de resultados», `p.rs-stale-note[role=status][data-testid=rs-stale-note]` («Desactualizado: el modelo cambió. Pulse «Comprobar».»).
  - **Lienzo** `section.panel.ea-canvas-panel[aria-label="Sección del modelo"]` (`:820-850`):
    - `div.ea-canvas[data-testid=editor-canvas]` (`:821`; alto `clamp(320px,55dvh,640px)`, `App.css:824-830`) > `EditorCanvas` (`editor/canvas/EditorCanvas.tsx:252`):
      - `svg[role=application][aria-label="Lienzo del modelo: regiones, piezométrica y superficie de falla"]` (`EditorCanvas.tsx:811-815`)
      - `div.ec-tools[role=group][aria-label="Zoom y encuadre"]` (`:1346-1356`): `button.ec-tool` «Acercar» (+), «Alejar» (−), «Encuadrar» (0)
      - `p.ec-cursor[aria-hidden][data-testid=cursor-readout]` (`:1358`): coordenadas bajo el puntero (no accesibles)
      - Pistas de herramienta: `data-testid=polyline-crossing-warning` (`:1361`), `draw-hint` (`:1367`), `split-hint` (`:1376`), `reinforce-hint` (`:1385`) con `div.ec-reinforce-types[role=group][aria-label="Tipo de refuerzo"]` (`:1391`)
      - Estado vacío `div.ec-empty[data-testid=canvas-empty]` (`:1414`) → `EmptyCanvasState` (`editor/app/EmptyCanvasState.tsx:6-26`): `h`-lite `p#ns-empty-title` «El modelo no tiene regiones», botones «Dibujar región» y «Abrir un ejemplo».
      - `div.visually-hidden[role=status][data-testid=canvas-live]` (`:1422`)
    - `Legend` (`ui/Legend.tsx:22-38`, `EditorApp.tsx:824-839`): `ul.legend[aria-label="Leyenda de la sección"]` **debajo** del lienzo.
    - `p.small.ea-stale[data-testid=stale-result]` (`:840-844`) y `p[data-testid=result-caption]` (`:845-849`).
  - **Resultados** `section.panel[aria-labelledby=ea-results-title][data-testid=results-panel]` (`:852-860`), solo con `engine.run`: h2 «Resultados» (o «Resultados (desactualizados)»), `ResultsTable` (ver §4), y `p.small.muted` «Motor: … · SHA-256 del modelo calculado: …».
  - **Diagnósticos** `DiagnosticsPanel` (`editor/panels/DiagnosticsPanel.tsx:54-113`, `EditorApp.tsx:861`): `PanelSection` h2 «Diagnósticos»; `p[data-testid=diagnostics-status]`; `ul.ep-issues` (`button.ep-issue` si hay destino); `details.ep-issue-detail` > `summary` «Detalle técnico»; `resultInfo` = `CrackSummary` (`ui/CrackResults.tsx:53`).
- Columna lateral `aside.ea-side[aria-label="Propiedades del modelo"]` (`:864-884`, ancho 420 px):
  - `div.ea-tabs[role=tablist][aria-label="Paneles del modelo"]` (`:865-880`): **10** `button[role=tab]` con `id=ea-tab-<id>`, `aria-controls=ea-tabpanel`, clase `.ea-tab` / `.ea-tab-active`. Orden y etiquetas (`EditorApp.tsx:83-94`): Geometría, Materiales, Agua, Superficie, Búsqueda, Análisis, Cargas, Refuerzos, Sismo, Proyecto.
  - `div#ea-tabpanel[role=tabpanel][aria-labelledby=ea-tab-<activa>]` (`:881-883`): **un solo panel** montado a la vez (`ActivePanel`); cada panel es un `section.panel.ep-panel[aria-labelledby]` con h2 (`editor/panels/Fields.tsx:6-14`, `PanelSection`).
- Diálogos (`EditorApp.tsx:887-912`): `NewSlopeDialog`, `DxfImportDialog`, `CsvImportDialog`.

### 1.4 Paneles del modelo (`apps/web/src/editor/panels/`)

Título del h2 de cada panel (`PanelSection title=`): Geometría (`GeometryPanel.tsx:340`), Materiales (`MaterialsPanel.tsx:461`), Agua (`WaterPanel.tsx:84`), «Superficie de falla» (`SurfacePanel.tsx:182`), Búsqueda (`SearchPanel.tsx:39` si no activa; `:100` si activa), Análisis (`AnalysisPanel.tsx:305`), Cargas (`LoadsPanel.tsx:169`), Refuerzos (`ReinforcementsPanel.tsx:347`), «Sismo (pseudoestático)» (`SeismicPanel.tsx:31`), Proyecto (`ProjectPanel.tsx:118`).

Piezas con nombre accesible o `data-testid` relevantes:
- Geometría: `div[role=region][aria-label="Vértices de la región N"]` (`GeometryPanel.tsx:276`), `fieldset.ep-card.gp-snap > legend` «Ajuste al dibujar y mover» (`:223-224`), `ul.gp-regions[aria-label="Regiones del modelo"]` (`:373`), `data-testid=geometry-empty` (`:342`), `geometry-notice` (`:366`), `region-material-N` (`:180`). Botones «Seleccionar en el lienzo: región N» / «Eliminar región N» (`:206, :211`).
- Materiales: `fieldset.ep-card > legend` «Material <id>» (`MaterialsPanel.tsx:288`), `data-testid=material-pending` (`:308`), `fieldset.field > legend` «Fuente de OCR» (`:134`).
- Agua: `h3` «Línea piezométrica» (`WaterPanel.tsx:102`), `div[role=region][aria-label="Puntos de la línea piezométrica"]` (`:121`), botón «Crear piezométrica» (`:114`).
- Superficie: `fieldset > legend` «Tipo» (`SurfacePanel.tsx:184`), `legend` «Forma de la superficie fija» (`:199`), `div[role=region][aria-label="Puntos de la polilínea de falla"]` (`:78`).
- Búsqueda: `fieldset > legend` por rango «Entrada (coronamiento)» / «Salida (pie)» (`SearchPanel.tsx:70-71`), `data-testid=non-circular-bishop-note` (`:159`), `search-pending` (`:186`).
- Análisis: `fieldset > legend` «Métodos» (`AnalysisPanel.tsx:306-307`), «Morgenstern-Price: función entre dovelas» (`:67`), «Grieta de tracción» (`:187`), `data-testid=crack-f65-note` (`:212`), `div[role=region][aria-label="Puntos de la función entre dovelas"]` (`:86`).
- Cargas: `fieldset.ep-card > legend` por carga (`LoadsPanel.tsx:111-112`), botones «Quitar la carga N» (`:150`).
- Refuerzos: `fieldset.ep-card[data-reinforcement-index]` (`ReinforcementsPanel.tsx:142-143`), `data-testid=reinforcement-pending` (`:313`), `ito-matsui-*` (`:172, :279, :284`).
- Sismo: campos kh y kv (`SeismicPanel.tsx:34-55`), botón «Quitar sismo» (`:58-64`).
- Proyecto: `data-testid=units-dialog` (`ProjectPanel.tsx:33`), `units-notice` (`:171`), campos «Título», «Identificador (id)», «Descripción», «Unidades».

---

## 2. Tabla de brechas contra la maqueta A

Referencia: `geo-suite-design/src/flujo.html` (líneas citadas) y `capturas/03-ogs-A-flujo-oscuro.png`. Estado: **Existe** / **Existe distinto** / **Falta**.

| # | Pieza de la maqueta | Maqueta (flujo.html) | Hoy en la app | Estado | Qué falta |
|---|---|---|---|---|---|
| 1 | Cabecera: marca | `:95-99` SVG 32×32 (cuadro r=8, talud con arco discontinuo) + «OpenGeoSlide» + subtítulo «Estabilidad de taludes 2D · equilibrio límite» | h1 «OpenGeoSlide» y subtítulo largo (`App.tsx:487-488`); sin SVG. El icono de la app (`public/icons/icon.svg`, 512 px, otro dibujo) solo es favicon/PWA (`index.html`) | Existe distinto | Insertar el SVG de la marca; decidir subtítulo corto (el de la maqueta) o largo |
| 2 | Chip de estado en cabecera | `:100` «Calculado · FS < 1,0» (`data-status`) | No hay chip en cabecera; el estado está en la franja `rs` y en `file-status` | Falta | Chip en cabecera con el estado del cálculo |
| 3 | Ayuda y atajos | `:103` botón icono, `aria-label="Ayuda y atajos"` | «Ayuda» como texto (`App.tsx:501-512`) | Existe distinto | Icono + nombre accesible «Ayuda y atajos» |
| 4 | Idioma «ES» | `:104` botón `hide-sm` | No existe. `lang="es"` fijo (`index.html:2`, `App.tsx:481`, `EditorApp.tsx:645`); no hay i18n [verificado: búsqueda de i18n/locale sin resultados de UI] | Falta | Decidir: etiqueta estática «ES» o eliminar |
| 5 | Tema | `:105` botón toggle; texto = destino («Claro»/«Oscuro»); 2 estados; **por defecto oscuro** (`:2` `data-theme="dark"`; `ogs-mock.js:118`) | `ThemeSelect` (`ui/ThemeSelect.tsx:5-18`): select de 3 estados; por defecto «Sistema» (`theme/theme.ts:60-66`, `readPref` sin valor → `system`); `:root` sigue `prefers-color-scheme` (`styles/tokens.css:13-14, 94`) | Existe distinto | Control (toggle o select) y **defecto oscuro** (D3); decidir si «Sistema» se mantiene |
| 6 | Archivo ▾ | `:106` en cabecera | `DropdownMenu` «Archivo ▾» dentro de la barra del editor (`EditorApp.tsx:658`) | Existe distinto (posición) | Mover a cabecera |
| 7 | Exportar | `:107` en cabecera (`hide-sm`) | `DropdownMenu` «Exportar» dentro de la barra (`EditorApp.tsx:700`) | Existe distinto (posición) | Mover a cabecera |
| 8 | Barra lateral «Modelo» | `:112-164` `aside[aria-label=Modelo]`, h2 «Modelo», botón «Contraer panel» (`:113`) | No existe. Propiedades a la derecha (`EditorApp.tsx:864`, `App.css:803-806`) | Falta | Columna izquierda con lista de pasos y botón de contraer |
| 9 | Pasos: estado, resumen y cuerpo desplegable (acordeón) | `:115-158` 7 `li[data-step]`; cada uno: insignia (hecho ✓ / opcional «6»), título, resumen (`step-sub`), chevron, cuerpo | 10 `button[role=tab]` sin resumen ni insignia de estado (`EditorApp.tsx:83-94, 865-880`); el estado se ve solo en campos y avisos de `pending` | Falta | Resumen de una línea y estado por paso (ver §3); acordeón de una sola sección abierta |
| 10 | Número de pasos | 7: Geometría · Materiales · Agua · Superficie y búsqueda · Análisis · Cargas, refuerzos y sismo · Proyecto | 10 pestañas: Geometría · Materiales · Agua · Superficie · Búsqueda · Análisis · Cargas · Refuerzos · Sismo · Proyecto | Falta (agrupación) | Agrupar Superficie+Búsqueda y Cargas+Refuerzos+Sismo, o mantener 10 (decisión del coordinador) |
| 11 | Pie de la barra lateral | `:160-163` «Comprobar» (primario, `Ctrl ↵`), «Informe PDF», «CSV» | «Comprobar» y «Informe PDF» en la barra del editor (`EditorApp.tsx:736-766`); CSV dentro del menú Exportar (`:700-715`); el atajo no es visible (`title=Ctrl+Intro`) | Existe distinto | Pie fijo con Comprobar, Informe PDF y CSV; atajo visible |
| 12 | Pestañas numeradas de vista | `:174-178` `div[role=tablist][aria-label=Vistas]`: «Lienzo 1», «Resultados 2», «Casos de verificación 3», «Informe 4» | Solo dos modos en cabecera: «Editar» y «Casos de verificación» (`App.tsx:490-497`). Resultados = sección bajo el lienzo (`EditorApp.tsx:852`); Informe = botón (`:757`) | Falta | Vistas Lienzo / Resultados / Casos / Informe con numeración |
| 13 | Título de vista y deshacer/rehacer | `:168-172` h1 «Lienzo» (`data-view-title`) + iconos Deshacer/Rehacer | Sin h1 de vista; Deshacer/Rehacer como texto en la barra (`EditorApp.tsx:623-627`) | Existe distinto | h1 de vista; botones icono (nombre accesible igual) |
| 14 | Tarjeta del lienzo (`.viewer`) | `:182` contenedor con borde y radio grande | `section.panel.ea-canvas-panel` + `div.ea-canvas` (`EditorApp.tsx:820-821`, `App.css:824-830`) | Existe | Ajustar estilo a la tarjeta de la maqueta |
| 15 | Paleta flotante «Herram.» | `:195-203` `nav[aria-label="Herramientas del lienzo"]`, eyebrow «Herram.», 6 herramientas con tooltip y tecla (`kbd`) | Botones en barra horizontal, sin flotar, sin rótulo «Herram.»; etiqueta del grupo «Herramienta del lienzo» (`EditorApp.tsx:731`) | Existe distinto | Paleta flotante dentro de la tarjeta; tooltips con tecla |
| 16 | Grupo «Vista» (zoom) | `:204-207` eyebrow «Vista», Acercar `+`, Alejar `−`, Encuadrar `0` | `div.ec-tools[aria-label="Zoom y encuadre"]` con los mismos 3 botones (`EditorCanvas.tsx:1346-1356`) | Existe | Rótulo visible «Vista»; ubicación (en la paleta) |
| 17 | HUD «Resultado» (FS mínimo) | `:184-194` overlay sobre el lienzo: eyebrow «Factor de seguridad mínimo», valor grande «0,984», método, chip «FS < 1,0», barra con marca en 1,0, lista de 4 métodos con ✓ | La franja `rs` (`ResultSummary.tsx`) va **encima** del lienzo, no sobrepuesta; muestra FS por método y no hay FS mínimo agregado en ningún componente (`resultSummary.ts`) | Falta | Overlay HUD; cálculo de FS mínimo; barra con marca de 1,0 |
| 18 | Métodos del HUD | 4 métodos (`:189-192`): Bishop simplificado, Spencer, Morgenstern-Price, Janbu corregido | 5 métodos: `METHOD_ORDER` incluye `janbu_simplified` (`editor/panels/forms.ts`, `App.tsx:34`) | Falta (decisión) | Confirmar si se muestra Janbu simplificado |
| 19 | Leyenda | `:209` dentro de la tarjeta del lienzo: «Soil», «Superficie crítica», «Dovelas», «Entrada», «Salida» | `ul.legend[aria-label="Leyenda de la sección"]` debajo del lienzo (`EditorApp.tsx:824-839`) | Existe distinto (posición) | Mover dentro de la tarjeta |
| 20 | Estado desactualizado | HUD `stale` + chip «Resultados desactualizados» (`ogs-mock.js:146-153`) | `rs` con `data-state=stale` y `rs-stale-note` (`ResultSummary.tsx:50-59, 89-93`); `stale-result` (`EditorApp.tsx:840`) | Existe | Ajustar copy al de la maqueta si se adopta |
| 21 | Vista Resultados | `:212-225` tabla: Método · FS · Estado (chip) · Iteraciones · λ | `ResultsTable` con más columnas (`ui/ResultsTable.tsx:76-86`) dentro de la vista editor, no como pestaña | Existe distinto | Vista propia; decidir columnas (la maqueta omite las de superficie) |
| 22 | Vista Casos de verificación | `:227-241` resumen «347 / 347 checks dentro de tolerancia · 167 casos publicados» + chip «Motor verificado» + tabla de casos (Caso · Título · Tipo · Estado) | `CasesView` (`App.tsx:82-419`): un caso a la vez en un `select`; sin resumen agregado ni tabla de casos | Falta | Tabla de casos y resumen; ver nota en §5 sobre las cifras |
| 23 | Vista Informe | `:243-250` h2-eyebrow «Informe técnico», campo «Título», checklist ✓, «Generar PDF», «Exportar CSV» | Título en el panel Proyecto (`ProjectPanel.tsx:118-`); PDF en barra (`EditorApp.tsx:757`); sin vista ni checklist | Falta | Vista con título editable, lista de contenido y botones |
| 24 | Barra de estado inferior | `:255-261` «Ejemplo: ACADS 1(a) · archivo sin cambios» · «Herramienta: Seleccionar» · coordenadas «x — · y —» · «ogs-core 0.4.0 · WASM» | `div.ea-statusbar` **arriba**, bajo la barra de acciones (`EditorApp.tsx:772-792`): título y estado de archivo; motor en cabecera (`EngineIndicator`); coordenadas solo visibles dentro del lienzo (`cursor-readout`, aria-hidden) | Falta (footer, herramienta, coordenadas) | Footer de 30 px al pie con ejemplo, herramienta activa, coordenadas accesibles y motor |
| 25 | Marco de página | `body { overflow: hidden }`, grid de altura 100vh (`:15-16`) | Página con scroll (XA2 medirá `scrollHeight > innerHeight`) | Falta | Layout de altura fija (pendiente de XA2) |
| 26 | Móvil | ≤760 px: lateral debajo, pestañas con scroll horizontal (`:78-90`) | ≤1000 px: 1 columna (`App.css:811`); ≤480 px: menú «Editar» (`EditorApp.tsx:717`) | Existe distinto | Puntos de corte y orden (ver XA4) |
| 27 | Extras de la app sin par en la maqueta | — | Banner de motor simulado (`App.tsx:521`), guía de primera visita (`App.tsx:518`), botón «Instalar» (`InstallButton`), `NoticeList`, Diagnósticos (`EditorApp.tsx:861`), menú «Ejemplos» | Extra | Decidir si se conservan en A |

**Tipografía y marca fuera de la tabla (verificado):**
- La app usa `font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` (`App.css:4`) y `tabular-nums` en la tabla (`App.css:342, 457, 729`; `canvas.css:79`). **No hay `@font-face` ni fuentes web** en `apps/web/src` (búsqueda `@font-face` vacía). La carpeta `apps/web/public/fonts/` contiene DejaVu para el PDF (`report/pdf.ts:56`), no para la UI.
- La maqueta carga Outfit y JetBrains Mono desde Google Fonts (`flujo.html:8-10`, `<link>` externo). Es una dependencia de red que la PWA sin conexión no cubre.

---

## 3. Resumen y estado derivables por panel

Fuentes: `ModelDoc` = `Model` (`engine/types.ts:320-334`); validación local `validateLocal(doc)` (`editor/state/validateLocal.ts:1057`); destino de cada incidencia `issueTarget(path, doc)` (`editor/app/issueNav.ts:71`) que da la pestaña (`tab`); borradores sin aplicar `getPendingDrafts(store)` (`editor/panels/forms.ts:703`). Con esto, el **estado** de cada pestaña es derivable sin tocar React: «con error» = alguna incidencia local cuyo `tab` coincide; «borrador» = clave pendiente del panel.

Los estados de la maqueta son: **completo** (✓), **con error** (chip de falla) y **opcional vacío** (círculo discontinuo, `badge.opt`, `flujo.html:31`). Los resúmenes usan el formato de `step-sub` (`flujo.html:116-156`).

| Pestaña (id) | Resumen de una línea (ejemplo) | Campos del documento | Completo | Con error | Opcional vacío | Tipos / funciones |
|---|---|---|---|---|---|---|
| Geometría (`geometry`) | «1 región · 6 vértices · 550 m²» | `regions[].polygon`, `regions[].material` | ≥1 región válida | `regionIssues(doc,i)` (`panels/geometry.ts:95`): autointersección, vértices duplicados, <3 vértices, región degenerada | Sin regiones: **no es opcional**, es vacío bloqueante (`validateLocal.ts:434`) | `regionSummary` (`geometry.ts:35`, con `area` por `polygonArea` `:25`) |
| Materiales (`materials`) | «1 material · Mohr-Coulomb» (modelos distintos: «2 materiales · Mohr-Coulomb, Hoek-Brown») | `materials[].model`, `.id`, `.name`; `regions[].material` | Todos los materiales válidos | `duplicate_material`, `missing_material` (`validateLocal.ts:405, 442`), `out_of_range` en cualquier campo; borrador `material-pending` (`MaterialsPanel.tsx:308`) | Sin materiales: vacío bloqueante | `Material`, `MaterialModel` (`engine/types.ts:36-67, 11`) |
| Agua (`water`) | «Talud seco · sin piezométrica» (`WaterPanel.tsx:111`) o «Piezométrica de N puntos · γw 9,81» | `water.unit_weight`, `water.piezometric_line` | Siempre válido si γw ok | `editor.water_unit_weight` (`validateLocal.ts:563, 602`), `editor.piezo_order` (`:590`); borradores `WATER_GAMMA_DRAFT` / `WATER_PIEZO_DRAFT` | `piezometric_line == null` (texto de `WaterPanel.tsx:111`) | `Water` (`engine/types.ts:73`) |
| Superficie (`surface`) | «Circular · fija» / «Polilínea de N puntos» / «Sin superficie» | `analysis.surface`, `analysis.search` | Modo `fixed` o `search` con forma | `editor.no_surface` (`validateLocal.ts:775-777`) cuando `analysis.surface` y `analysis.search` son ambos nulos; `surfaceMode` (`panels/forms.ts:862-866`) da el mismo modo en la UI | — (la superficie es obligatoria en el modelo) | `SurfaceSpec` (`engine/types.ts`), `surfaceMode` |
| Búsqueda (`search`) | «Entrada [a, b] · salida [c, d] · 20 × 20 × 20» | `analysis.search.{entry,exit,n_entry,n_exit,n_radius}`, `non_circular` | Búsqueda activa con rangos válidos | `out_of_range` en rangos; borrador `search` (`SearchPanel.tsx:33`); nota Bishop no circular (`:159`) | Búsqueda no activa: «La búsqueda no está activa…» (`SearchPanel.tsx:39-41`) → **opcional vacío** | `SearchSpec` (`engine/types.ts:124-139`) |
| Análisis (`analysis`) | «Bishop · Spencer · M-P · Janbu» + «50 dovelas» | `analysis.methods` (por defecto `bishop`), `slices` (50), `tolerance`, `max_iterations`, `tension_crack` | Métodos elegidos habilitados | `methodDisabledReason` (`forms.ts`) p. ej. Bishop con polilínea; `crack-f65-note` (`AnalysisPanel.tsx:212`) | Sin grieta: el bloque de grieta es opcional | `AnalysisSettings` (`engine/types.ts:302-318`), `TensionCrack` (`:296`) |
| Cargas (`loads`) | «2 cargas: 1 UDL, 1 lineal» / «Sin cargas» (`LoadsPanel.tsx:171`) | `loads[]` (`udl` / `line`) | Todas válidas | `editor.load_range` (`validateLocal.ts:850, 856`); borrador `loadDraftPending` (`LoadsPanel.tsx:46`) | `loads` vacío → **opcional vacío** | `Load`, `UdlLoad`, `LineLoad` (`engine/types.ts:150-174`) |
| Refuerzos (`reinforcements`) | «2 refuerzos: 1 anclaje, 1 pilote» / «Sin refuerzos» | `reinforcements[]` (`type`, `application`, `x1…y2`) | Todos válidos | `editor.reinforcement_*` (11 códigos, `engine/types`/`state/validateLocal.ts`; lista en `editor/types.ts:49-60`); borrador `reinforcement-pending` (`ReinforcementsPanel.tsx:313`) | Vacío → **opcional vacío** | `Reinforcement` (`engine/types.ts:287`) |
| Sismo (`seismic`) | «kh 0,10 · kv 0» / «Sin sismo» | `analysis.seismic.{kh,kv}` | kh en [0,1), kv en (−1,1) | `errors` de `seismicFromForm` (`SeismicPanel.tsx:17-18`); borrador `seismic` (`:20-24`) | `seismic == null` (`SeismicPanel.tsx:60`) → **opcional vacío** | `Seismic` (`engine/types.ts:141`) |
| Proyecto (`project`) | «ACADS 1(a) · unidades SI» (`flujo.html:156`) | `meta.id`, `meta.title`, `meta.notes`, `units`, `slope.direction` | Título no vacío | Sin errores de validación; `units/convert` (`ProjectPanel.tsx`) | `title` vacío → **opcional vacío** (en la cabecera, `documentTitle` cae a «Sin título»/«Ejemplo», `editor/app/docTitle.ts:11-17`) | `Meta` (`engine/types.ts:13-17`), `Model.units` |

**Diagnósticos** (no es pestaña, pero es la fuente de la mayoría de errores): `issuesFromReport` y `validateLocal` (`editor/app/diagnostics.ts`) → `DiagnosticsPanel` (`:54-113`).

**Conclusión de este punto [inferido]:** resumen y estado son derivables para las 10 pestañas con datos que ya existen en `store.getState()` y `validateLocal`; no hace falta añadir estado nuevo. El único dato no existente es el FS mínimo (ítem 17 de la tabla).

---

## 4. Resultados, avisos del cálculo e informe: dónde viven hoy

- **Tabla de resultados**: `ResultsTable` (`ui/ResultsTable.tsx:60`) recibe solo props (`report`, `elapsedMs`, `shownMethod`, `onShowMethod`, `lengthUnit`, `reinforcements`, `tensionCrack`), no lee el store. Se monta en `EditorApp.tsx:852-860` (solo con `engine.run`) y en `App.tsx:391-404` (Casos). **[verificado]**
- **Avisos y notas del cálculo** están en tres sitios:
  1. Dentro de `ResultsTable`: `ul.notes[aria-label="Notas del análisis"]` y `ul.warnings[aria-label="Avisos del análisis"]`, por método (`ResultsTable.tsx`, bloque final del componente). **[verificado]**
  2. Recuento en la franja: `p.rs-counts` (`ResultSummary.tsx:85`, texto de `warningCountsText`). **[verificado]**
  3. `DiagnosticsPanel` con las incidencias `source: 'engine'` y `local` (`editor/panels/DiagnosticsPanel.tsx`). **[verificado]**
  4. Mensajes transitorios: `NoticeList` (`EditorApp.tsx:815`) y `engine.message` (`:814`).
- **Informe**: no hay vista. Es el botón «Informe PDF» de la barra (`EditorApp.tsx:757-765`) → `onReport` (`:432-453`) → `buildReportPdf(buildReportInput(engine.run))` (`report/pdf.ts`, `reportInput.ts`). Requiere `engine.run` vigente y ningún borrador (`EditorApp.tsx:438-441`). **[verificado]**

**Qué haría falta para que «Resultados» e «Informe» sean vistas [inferido]:**
1. Un estado `view` en `EditorApp` (Lienzo | Resultados | Casos | Informe) que sustituya a `tab` para el área principal, sin desmontar el lienzo: `EditorCanvas` debe seguir montado (con `hidden`) porque guarda el trazo en curso y `docEpoch` (`editor/types.ts:79-89`).
2. Vista «Resultados»: mover `section` de `EditorApp.tsx:852-860` a la vista; `ResultsTable` ya es reutilizable tal cual. El botón «Ver tabla de resultados» (`ResultSummary.tsx:86-88`, `focusResultsTable`) pasaría a cambiar de vista antes de enfocar.
3. Vista «Informe»: `buildReportInput(engine.run)` es puro; el título ya existe en el panel Proyecto (`meta.title`), así que la vista solo necesitaría el campo (o un enlace) y el botón. La lista de contenido de la maqueta (`flujo.html:247`) se podría derivar de `report` (¿hay notas? ¿hay dovelas? ¿hay refuerzos?).
4. El modo «Casos de verificación» (`App.tsx:421`, `mode`) hoy es de nivel superior; para ser una pestaña del mismo armazón hay que moverlo al estado de vista. Afecta a la guía, que se cierra fuera de «Editar» (`App.tsx:465-467`), y a los atajos, que dependen de `active` (`EditorApp.tsx:580`, `R7-07`).

---

## 5. Tema, idioma, marca y cifras de la maqueta

**Mecanismo de tema (verificado):**
- Clave `ogs.theme.v1` en `localStorage` (`theme/theme.ts:12`). Valores: `light` | `dark`; ausencia o cualquier otro valor = `system` (`parsePref`, `theme/theme.ts:44-46`). Elegir «Sistema» borra la clave (`storePref`, `:69-78`).
- `data-theme` en `<html>` (`applyTheme`, `theme/theme.ts:84-95`); también `meta[name=color-scheme]` y los dos `meta[name=theme-color]`.
- Script anti-destello en `index.html:10-24` (síncrono, sin `type=module`, antes de pintar): lee la clave y aplica `data-theme`, `color-scheme` y `theme-color`.
- Controlador único `getThemeController` / hook `useTheme` (`theme/useTheme.ts:15-34`), con `matchMedia` y evento `storage`.
- Tokens: `:root` = claro (`styles/tokens.css:16-88`); oscuro en `@media (prefers-color-scheme: dark)` (`:94-158`); `@supports (color: light-dark(...))` (`:160-224`); selección manual `html[data-theme=…]` (`:226-232`, y respaldo sin `light-dark()` en `:234-362`).
- **Brecha**: el valor por defecto es «Sistema», no oscuro (D3). Para que el defecto sea oscuro hay que cambiar `readPref` y el `:root` de tokens (o el script anti-destello), y decidir qué pasa con «Sistema».
- Canvas 2D de «Casos»: `render/SectionCanvas.tsx:15` lee `useTheme().resolved` y repinta; paleta de respaldo en `theme/lightPalette.ts`.

**Idioma (verificado):** no hay selector ni i18n. Todo el texto está escrito en español dentro del código (`lang="es"` en `index.html:2`, `App.tsx:481`, `EditorApp.tsx:645`). No existe el botón «ES» de la maqueta.

**Marca (verificado):**
- Maqueta: `flujo.html:97` (SVG 32×32, `rect.frame` r=8 + `path.g1` del talud + arco discontinuo `stroke-dasharray`). Copia exacta: la hará XA4 (punto 3 del tema).
- App: sin marca en cabecera. `apps/web/public/icons/icon.svg` (512 px, fondo `#12324a`, talud con superficie circular en rojo `#ff6b4a`) es otro dibujo, usado como favicon/PWA (`index.html`, `manifest.webmanifest`).

**Cifras de la maqueta (verificado con script):**
- `verification/cases/*.json`: **167** archivos, **347** checks en total (suma de `checks` por caso); 167 casos tienen al menos un check. Coinciden con «347 / 347» y «167 casos publicados» de `flujo.html:229`.
- El «347 / 347 dentro de tolerancia» es un **resultado de ejecución**, no una propiedad del código; la maqueta lo muestra como dato fijo. Para mostrarlo en la app habría que correr las 347 comprobaciones.

---

## 6. Inventario de `styles/tokens.css` (v. código actual)

61 tokens definidos en el bloque `:root` (30 de interfaz `--ui-*`, 31 de lienzo `--canvas-*`). Columna «usos»: número de archivos fuente (sin tests) que leen `var(--…)`, con ejemplos. Cuatro tokens se usan de forma dinámica o solo vía el mapa de la paleta (ver notas).

| Token | Capa | Usos (archivos) | Ejemplos de uso |
|---|---|---|---|
| `--ui-bg` | UI | 1 | App.css |
| `--ui-surface` | UI | 4 | App.css, editor/app/editor-app.css, newModel.css… |
| `--ui-surface-subtle` | UI | 2 | App.css, panels/project.css |
| `--ui-surface-hover` | UI | 3 | App.css, canvas.css, panels.css |
| `--ui-surface-active` | UI | 2 | App.css, canvas.css |
| `--ui-backdrop` | UI | 2 | App.css, editor-app.css |
| `--ui-ink` | UI | 4 | App.css, editor-app.css, newModel.css… |
| `--ui-ink-muted` | UI | 7 | App.css, editor-app.css, newModel.css… |
| `--ui-ink-on-accent` | UI | 2 | App.css, canvas.css |
| `--ui-border` | UI | 6 | App.css, editor-app.css, newModel.css… |
| `--ui-control-border` | UI | 4 | App.css, canvas.css, geometry.css… |
| `--ui-focus` | UI | 3 | App.css, editor-app.css, canvas.css |
| `--ui-accent` | UI | 3 | App.css, canvas.css, project.css |
| `--ui-accent-hover` | UI | 1 | App.css |
| `--ui-ok-bg` | UI | 1 | App.css |
| `--ui-ok-ink` | UI | 1 | App.css |
| `--ui-ok-border` | UI | **0** | — (definido; solo en la prueba de contraste) |
| `--ui-warn-bg` | UI | 5 | App.css, editor-app.css, resultSummary.css… |
| `--ui-warn-ink` | UI | 6 | App.css, editor-app.css, resultSummary.css… |
| `--ui-warn-border` | UI | 4 | App.css, editor-app.css, resultSummary.css… |
| `--ui-err-bg` | UI | 2 | App.css, panels.css |
| `--ui-err-ink` | UI | 3 | App.css, canvas.css, panels.css |
| `--ui-err-border` | UI | 2 | App.css, panels.css |
| `--ui-info-bg` | UI | 1 | App.css |
| `--ui-info-ink` | UI | 1 | App.css |
| `--ui-note-bg` | UI | 2 | App.css, panels.css |
| `--ui-note-ink` | UI | 2 | App.css, panels.css |
| `--ui-row-selected` | UI | 1 | panels.css |
| `--ui-row-warn` | UI | 1 | App.css |
| `--ui-input-err-bg` | UI | 1 | panels.css |
| `--canvas-bg` | Lienzo | 4 | App.css, newModel.css, EditorCanvas.tsx… |
| `--canvas-grid` | Lienzo | 1 | EditorCanvas.tsx |
| `--canvas-axis` | Lienzo | 0 (CSS) | Usado vía `sectionPalette.ts:34` → `render/drawSection.ts:81` (Canvas 2D) |
| `--canvas-axis-text` | Lienzo | 2 | EditorCanvas.tsx, ui/legend.css |
| `--canvas-halo` | Lienzo | 2 | DrawLayer.tsx, EditorCanvas.tsx |
| `--canvas-region-edge` | Lienzo | 3 | App.css, NewSlopeDialog.tsx, EditorCanvas.tsx |
| `--canvas-selected` | Lienzo | 2 | DrawLayer.tsx, EditorCanvas.tsx |
| `--canvas-surface` | Lienzo | 3 | App.css, EditorCanvas.tsx, legend.css |
| `--canvas-surface-unconverged` | Lienzo | 2 | App.css, EditorCanvas.tsx |
| `--canvas-piezo` | Lienzo | 4 | App.css, NewSlopeDialog.tsx, EditorCanvas.tsx… |
| `--canvas-pond` | Lienzo | 2 | EditorCanvas.tsx, legend.css |
| `--canvas-load` | Lienzo | 2 | App.css, EditorCanvas.tsx |
| `--canvas-reinforcement` | Lienzo | 2 | EditorCanvas.tsx, legend.css |
| `--canvas-seismic` | Lienzo | 2 | App.css, EditorCanvas.tsx |
| `--canvas-seismic-bg` | Lienzo | 1 | EditorCanvas.tsx |
| `--canvas-band-entry` | Lienzo | 2 | App.css, EditorCanvas.tsx |
| `--canvas-band-exit` | Lienzo | 2 | App.css, EditorCanvas.tsx |
| `--canvas-slice-fill` | Lienzo | 2 | App.css, EditorCanvas.tsx |
| `--canvas-slice-edge` | Lienzo | 3 | App.css, EditorCanvas.tsx, legend.css |
| `--canvas-handle-fill` | Lienzo | 2 | DrawLayer.tsx, EditorCanvas.tsx |
| `--canvas-handle-sel` | Lienzo | 1 | EditorCanvas.tsx |
| `--canvas-handle-snap` | Lienzo | 2 | DrawLayer.tsx, EditorCanvas.tsx |
| `--canvas-handle-ring` | Lienzo | 2 | DrawLayer.tsx, EditorCanvas.tsx |
| `--canvas-mat-0` … `--canvas-mat-6` | Lienzo | 0 literales | Dinámicos: `render/scene.ts:34` (`var(--canvas-mat-${slot})`), `NewSlopeDialog.tsx:49`, `sectionPalette.ts:48` |
| `--canvas-mat-unknown` | Lienzo | 2 | EditorCanvas.tsx, panels/GeometryPanel.tsx |

Notas [verificado]:
- Ningún token usado está sin definir (las variables leídas por el escaneo son todas de la lista, salvo los patrones dinámicos `--canvas-mat-${…}`).
- Tokens de lienzo también leídos en JS: `sectionPalette.ts` resuelve los `--canvas-*` con `getComputedStyle` para el Canvas 2D; `theme/lightPalette.ts` es el respaldo en Node (lo ata `lightPalette.test.ts`).
- Archivos con colores literales permitidos: `styles/tokens.css`, `report/palette.ts`, `theme/lightPalette.ts` (`styles/no-hardcoded-colors.test.ts:11`).

**Pares de `tokens.contrast.test.ts` [verificado con `npx vitest run src/styles/tokens.contrast.test.ts`]:** 317 tests pasan en ~133 ms. Desglose: 156 pares por tema × 2 temas = 312 (`PAIRS`, `:71-120`, `it` por par, `:122-133`); 1 prueba de halo = fondo del lienzo en ambos temas (`:135`); 1 prueba de anillo de foco y borde de control con texto atenuado ≥ 4,5 en claro (`:141-145`); 3 pruebas de contrato y respaldos (`:147-202`). Umbrales: texto 4,5:1; elementos de interfaz y trazos 3:1 (`:68-69`).

Pares de interés para la maqueta A (deducción [inferido]): la maqueta usa `--gs-*` de `suite-tokens.css` v1.1 (equivalencia en XA4); los pares «chip de falla» y «borde de campo» son los que la v1 de la suite fallaba (`DISENO_B.md:119`), y aquí `ui-err-*` ya cubre el error (`:142-144`).

---

## 7. Dudas para el coordinador

1. **Defecto de tema (D3):** ¿el oscuro por defecto sustituye a «Sistema» (y se elimina ese estado), o se mantienen los tres estados con defecto oscuro? La decisión cambia `readPref`, `:root` de tokens, el script de `index.html` y el texto de las capturas.
2. **Número de pasos:** ¿siete pasos agrupados como en la maqueta (Superficie+Búsqueda, Cargas+Refuerzos+Sismo) o diez pestañas? Agrupar afecta a los nombres accesibles y `data-testid` que usan los e2e (lo medirá XA3).
3. **Casos de verificación como vista:** ¿se mueve el modo «Casos» dentro del armazón (vista 3 de 4)? Hay que tocar la guía (`App.tsx:465-467`) y los atajos (`EditorApp.tsx:580`).
4. **Idioma «ES»:** ¿etiqueta estática o se elimina? La app no tiene i18n.
5. **Marca:** ¿se usa el SVG de la maqueta en cabecera (`flujo.html:97`) y el icono 512 queda como favicon, o se unifica con `public/icons/icon.svg`? El subtítulo de la maqueta difiere del de la app.
6. **HUD con FS mínimo:** el valor «0,984» (FS mínimo) no existe hoy en código. ¿Se calcula como mínimo de los FS convergidos, o se muestra solo por método?
7. **Métodos del HUD:** la maqueta muestra 4 métodos y la app tiene 5 (incluye Janbu simplificado). ¿Cuál es la lista de la vista A?
8. **Cifras «347 / 347» y «167 casos»:** 167 y 347 son correctas en el catálogo (verificado), pero «347 / 347 dentro de tolerancia» es un resultado de ejecución. ¿Se muestra en vivo (ejecutando el catálogo) o como dato estático de la versión?
9. **Footer de estado:** ¿se traslada la línea de estado a un pie de 30 px (ejemplo, herramienta, coordenadas, motor) y se quita el motor de la cabecera? Afecta a `file-status` y `engine-banner`, que usan los e2e.
10. **Fuentes:** la maqueta usa Google Fonts por red (`flujo.html:8-10`) y la app no tiene webfonts. La decisión de self-host y su precarga PWA la cierra XA4 (versiones y tamaños) y XA3 (precarga).
11. **Janbu simplificado y Bishop con polilínea:** en el panel Análisis, Bishop puede quedar deshabilitado (`App.tsx:126-128`). ¿Cómo lo muestra la barra lateral de pasos?

---

## Anexo A · Piezas con `data-testid` (para XA3)

`editor-app`, `file-status`, `engine-status`, `pending-drafts-hint`, `export-hint`, `draft-banner`, `draft-open-elsewhere`, `notice-bar`, `notices`, `notice-count`, `live-polite`, `live-alert`, `result-summary`, `calc-progress`, `fs-<método>`, `warn-<método>`, `rs-stale-note`, `editor-canvas`, `stale-result`, `result-caption` (en `EditorApp.tsx:846` y `App.tsx:380`), `results-panel`, `cursor-readout`, `canvas-empty`, `canvas-live`, `polyline-crossing-warning`, `draw-hint`, `split-hint`, `reinforce-hint`, `diagnostics-status`, `issue-suggested-action`, `region-material-N`, `geometry-empty`, `geometry-notice`, `material-pending`, `non-circular-bishop-note`, `search-pending`, `crack-f65-note`, `ito-matsui-*`, `reinforcement-pending`, `units-dialog`, `units-notice`, `file-open`, `file-dxf`, `file-csv`, `engine-banner`, `install-app`, `tour-live`, `cases-cancel`, `cases-progress`, `cases-notice`.

## Anexo B · Hallazgos de control (no de diseño)

- `index.html` no tiene `<meta http-equiv="Content-Security-Policy">` [verificado: `index.html` completo, 35 líneas]. La maqueta tampoco.
- `theme/useTheme.ts` y `theme/theme.ts` no leen `window` al importarse (comentario `theme.ts:6-7`); `getThemeController` se crea en el primer uso.
- Los `div[role=tabpanel]` de `App.tsx:535-540` referencian `aria-labelledby="mode-edit"` / `"mode-cases"` (correcto), pero los diez tabs del editor comparten `aria-controls="ea-tabpanel"` (`EditorApp.tsx:873`), que es un único panel montado.

## Anexo C · Comandos y verificaciones ejecutadas

- `git status --short` (vacío) y `git log --oneline -3` → HEAD `807cf30`.
- Lectura de `apps/web/src/App.tsx`, `App.css`, `editor/EditorApp.tsx`, `editor/app/*.tsx`, `editor/panels/*.tsx`, `ui/*.tsx`, `theme/*.ts`, `onboarding/*.tsx`, `styles/tokens.css`, `styles/tokens.contrast.test.ts`, `styles/no-hardcoded-colors.test.ts`, `index.html`, `main.tsx`, `cases.ts`.
- Escaneo de `var(--…)` y de tokens definidos en `tokens.css` (script Python, sin escritura en el repo).
- Conteo de `verification/cases/*.json` (167 archivos, 347 checks).
- `npx vitest run src/styles/tokens.contrast.test.ts` en `apps/web` (317 pasan). No se construyó ni se sirvió la app (eso es XA2).
- Maqueta: lectura de `src/flujo.html`, `src/ogs-mock.js` y visión de `capturas/03-ogs-A-flujo-oscuro.png`.
