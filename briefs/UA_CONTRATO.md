# UA · Contrato del rediseño «A · Flujo de trabajo» de la web

Bloque **UA**. Rama de integración `ua-integracion` (base `v0.5.0`), worktree `~/archivos/opengeoslide-wt/ua-int`.
Solo el coordinador edita este archivo. Las enmiendas se numeran `UA-Ex` al final.

Fuentes:
- `~/archivos/geo-suite-design/docs/DISENO_B.md` (identidad común: D1-D3, §2, §4, §5, §6.3-6.4, §6.12, §7, §11);
- la maqueta A, `~/archivos/geo-suite-design/src/flujo.html` + `src/suite.css` (v1.1), y su captura
  `capturas/03-ogs-A-flujo-oscuro.png`;
- la exploración `docs/suite-a/exploracion/XA1.md` (armazón), `XA2.md` (línea base), `XA3.md` (contrato de pruebas y
  e2e) y `XA4.md` (medidas, tokens, fuentes).

Donde la maqueta y este contrato difieren, manda el contrato.

## 1. Decisiones

| N.º | Decisión |
|---|---|
| UA-D1 | Armazón **A** (D1): cabecera con marca, barra lateral «Modelo» con los pasos, vistas numeradas en el área principal, lienzo en tarjeta con paleta flotante y HUD, barra de estado al pie. |
| UA-D2 | Se mantienen los **diez pasos** de hoy (Geometría … Proyecto), con sus nombres y su `role="tab"`. No se agrupan en siete: 37 de 53 guiones los seleccionan por nombre exacto. |
| UA-D3 | Vistas: **1 Lienzo · 2 Resultados · 3 Casos de verificación · 4 Informe**, en un `tablist` «Vistas». «Lienzo» reemplaza a la pestaña «Editar» (cambio por diseño: la migración de los guiones va en UA2). «Casos de verificación» deja la cabecera y pasa a ser la vista 3. |
| UA-D4 | **Oscuro por defecto** (D3) con un botón de dos estados en la cabecera. Desaparece «Sistema». La preferencia guardada `light` se respeta; cualquier otra cosa, incluida la ausencia, es oscuro. |
| UA-D5 | Un solo acento, azul acero (D2): `#2c77c3` en oscuro y `#2f6da8` en claro, con texto blanco. Los colores de estado solo comunican estado. |
| UA-D6 | Outfit y JetBrains Mono **locales** (`@fontsource-variable/*` 5.3.0, importadas desde `src/` para que entren en la precarga de la PWA). Nada de Google Fonts. |
| UA-D7 | Sin botón de idioma: la app no tiene traducciones y un control sin efecto engaña. Sin CSP nueva (fuera de alcance; `theme.test.ts` sigue afirmando que no hay). |
| UA-D8 | El HUD muestra el **FS mínimo** de los métodos que convergieron. El chip «FS < 1,0» (falla) sale solo bajo 1. Sobre 1 no hay chip de «seguro»: la app no juzga la aceptabilidad. |
| UA-D9 | Coma decimal solo en los textos nuevos (resúmenes, HUD, chip, coordenadas). La coma en toda la pantalla queda fuera (decisión del usuario). |
| UA-D10 | Nombres accesibles y `data-testid` de §5 **no cambian**, salvo los que este contrato renombra (UA-D3). Contadores, teclas, chevrons, insignias y resúmenes van fuera del nombre accesible (`aria-hidden` o `aria-describedby`). |
| UA-D11 | La página **no hace scroll** a partir de 761 px de ancho: lo hacen la lista de pasos y las vistas Resultados, Casos e Informe. Hasta 760 px todo se apila y la página sí hace scroll. |

## 2. Armazón medido

Valores de `suite.css` v1.1 y `flujo.html` (XA4 §2), salvo lo que se indica.

```
┌ header.app-header 68 ──────────────────────────────────────────────────────────────────────────────┐
│ [marca 36] OpenGeoSlide · subtítulo   [chip estado]            [Instalar] [Ayuda] [tema] [Archivo ▾] [Exportar ▾] │
├ aside.ua-side 340 ─────────────┬ main.ua-main ────────────────────────────────────────────────────────┤
│ Modelo                    [⟨]  │ h2 vista (Lienzo)                                   [Deshacer][Rehacer] │
│ ┌ tablist «Paneles del modelo» │ ┌ tablist «Vistas»: Lienzo 1 · Resultados 2 · Casos de verificación 3 · Informe 4 ┐ │
│ │ ● Geometría  1 región · …  ▾ │ ├───────────────────────────────────────────────────────────────────┤ │
│ │ ● Materiales …             ▾ │ │ tarjeta del lienzo (alto restante)                       ┌paleta┐ │ │
│ │   [panel activo, en línea]   │ │ ┌ HUD 330 ┐                                               │  60  │ │ │
│ │ ○ Agua …                   ▾ │ │ │FS mín.  │                                               │      │ │ │
│ │ …                            │ │ └─────────┘                                               └──────┘ │ │
│ ├ pie de acción                │ │ coordenadas                                                         │ │
│ │ [Comprobar      Ctrl Intro]  │ │ leyenda                                                             │ │
│ │ [Informe PDF]                │ └───────────────────────────────────────────────────────────────────┘ │
├ footer.ua-status 30 ───────────┴─────────────────────────────────────────────────────────────────────────┤
│ Ejemplo: ACADS 1(a) · archivo sin cambios · Herramienta: Seleccionar              ● ogs-core 0.5.0 · WASM │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Pieza | Medidas |
|---|---|
| Cabecera | alto 68; relleno `0 20px 0 22px`; separación 14; borde inferior. Marca 36 × 36; nombre 19/600; subtítulo «Estabilidad de taludes 2D · equilibrio límite» 12,5 atenuado. Botones de 32 de alto, radio 8, 13/500; de solo ícono, 32 × 32. |
| Barra lateral | 340 (300 entre 761 y 1099). Filas `auto 1fr auto`: cabecera (h2 «Modelo» 15/600 y «Contraer panel»), lista con scroll propio, pie de acción. Plegada: se oculta y el área principal muestra «Mostrar panel»; el estado se guarda en `ogs.ui.side.v1`. |
| Paso (pestaña) | rejilla `30px 1fr 18px`, separación 12, relleno `9px 8px`, radio 8, hover `--ui-surface-hover`. Insignia de 28: `done` círculo `--ui-ok-ink` con ✓ en SVG; `error` círculo de falla con «!» en SVG; `draft` círculo de aviso; `optional` y `empty` borde discontinuo con el número del paso en mono. Título 14,5/600; resumen 12,5 atenuado, una línea con elipsis. Activo: fondo `--ui-accent-bg`, título `--ui-accent-bright`. |
| Panel abierto | **en línea, justo debajo de su paso** (§4.6), relleno `4px 4px 12px 12px`. |
| Pie de acción | relleno `14px 16px 16px`, borde superior, separación 8, fondo `--ui-surface`. Aviso «Hay cambios sin calcular» (aviso) si hay resultado y no es actual. «Comprobar» primario de 40 y ancho completo, con `<kbd>` «Ctrl Intro» `aria-hidden`. «Cancelar cálculo» y «Reiniciar el motor» como hoy. «Informe PDF» de 32. El texto de `export-hint` debajo. |
| Cabecera del área | relleno `18px 24px 0`. h2 de la vista 24/600. «Deshacer» y «Rehacer» como botones de ícono de 32 con su nombre de siempre. Hasta 480 px se pliegan en «Editar ▾» como hoy. |
| Vistas | pestañas de 40; relleno `0 14px`; ícono 16 + texto 14/500 + contador mono 11 en 18 × 18 (`aria-hidden`). Activa: texto y borde inferior de 2 px en `--ui-accent-bright`. |
| Tarjeta del lienzo | relleno del área `16px 24px 20px`; borde 1, radio 12, fondo `--canvas-bg`, `overflow: hidden`; alto = el restante (sin `clamp`). |
| Paleta | derecha 16, centrada en vertical, ancho 60, relleno `10px 8px`, separación 6, radio 14, borde `--ui-border-strong`, sombra `--ui-shadow-float`. Botones 42 × 42, radio 10, ícono 18. Rótulos «Herram.» y «Vista» de 9 px (`aria-hidden`) y un divisor. Si la tarjeta es más baja que la paleta, la paleta hace scroll; nunca queda recortada. |
| HUD | izquierda 16, arriba 16, ancho 330 (300 entre 1100 y 1279; 280 entre 761 y 1099), relleno `14px 16px 12px`, radio 12, borde fuerte, sombra. Eyebrow 11/600 mayúsculas; cifra mono 40/600; lista de métodos 13 px. Plegable (§4.3). |
| Leyenda | izquierda 16, abajo 14, píldora `color-mix(in srgb, var(--ui-surface) 88%, transparent)`, borde, 12 px. |
| Coordenadas | izquierda 16, encima de la leyenda; mono 12, «x 41,32 m · y 29,76 m». |
| Barra de estado | alto 30, relleno `0 16px`, separación 18, 12 px atenuado, borde superior. |

**Anchos:**

| Ancho | Cambios |
|---|---|
| ≥ 1280 | lo de arriba |
| 1100-1279 | HUD de 300 |
| 761-1099 | barra lateral de 300, HUD de 280, sin subtítulo; «Ayuda» y «Instalar» solo con ícono; «Archivo» y «Exportar» conservan el texto. Sin scroll horizontal a 768 y a 1024. |
| ≤ 760 | apilado, en este orden: cabecera (marca, nombre y chip; las acciones pasan a una segunda fila) → cabecera del área y vistas (scroll horizontal de las pestañas, nunca de la página) → vista activa (lienzo de 360 de alto, HUD estático debajo, paleta en fila) → barra lateral «Modelo» → pie de acción **fijo abajo** (`position: sticky; bottom: 0`) → barra de estado. Botones ≥ 40 de alto. |

## 3. Tokens

### 3.1 Valores

`apps/web/src/styles/tokens.css` sigue siendo el único archivo con colores literales de UI y lienzo, con su
estructura de cuatro bloques. Se **conservan todos los nombres**; cambian los valores a los de
`~/archivos/geo-suite-design/tokens/suite-tokens.css` v1.1:

| OpenGeoSlide | Suite | | OpenGeoSlide | Suite |
|---|---|---|---|---|
| `--ui-bg` | `--gs-surface` | | `--ui-accent` | `--gs-accent` |
| `--ui-surface` | `--gs-surface-raised` | | `--ui-ink-on-accent` | `--gs-accent-fg` (blanco en ambos) |
| `--ui-surface-subtle` | `--gs-surface-muted` | | `--ui-focus` | `--gs-accent-bright` |
| `--ui-surface-hover` | `--gs-surface-hover` | | `--ui-surface-active` | `--gs-accent-bg` |
| `--ui-ink` | `--gs-text` | | `--ui-ok-*`, `--ui-warn-*`, `--ui-err-*`, `--ui-info-*` | `--gs-ok-*`, `--gs-warn-*`, `--gs-nok-*`, `--gs-info-*` (`-ink` ↔ `-text`) |
| `--ui-ink-muted` | `--gs-text-muted` | | `--canvas-bg` | `--gs-viewer-bg` |
| `--ui-border` | `--gs-border` | | `--canvas-grid` | `--gs-viewer-grid` |
| `--ui-control-border` | `--gs-control-border` | | `--canvas-axis` | `--gs-viewer-axis` |

**Nombres nuevos** (UA1-T los crea en ambos temas): `--ui-ink-2` (`--gs-text-2`), `--ui-surface-sunken`,
`--ui-border-strong`, `--ui-border-dashed`, `--ui-accent-bright`, `--ui-accent-bg`, `--ui-shadow-float`,
`--canvas-grid-major`, y los no cromáticos `--ui-font-sans`, `--ui-font-mono`, `--ui-radius-sm` (4), `--ui-radius-md`
(8) y `--ui-radius-lg` (12).

Lienzo:
- Se adoptan los valores `--ogs-*` de la suite donde hay par (XA4 §3.1: superficie crítica, dovelas, tiradores, bandas
  de entrada y salida, borde de región).
- Los demás colores del lienzo conservan su tono y solo se ajustan si un par de `tokens.contrast.test.ts` falla contra
  el fondo nuevo.
- Los valores **claros** de `--canvas-mat-0` … `--canvas-mat-6` no cambian, porque la paleta del PDF
  (`report/palette.ts`, siempre clara) está atada a ellos por test. El PDF no se toca.

Todo par nuevo que use la interfaz entra en `PAIRS` de `tokens.contrast.test.ts`, en ambos temas: texto ≥ 4,5,
controles y trazos ≥ 3. Esto incluye `--ui-ink-2`, `--ui-accent-bright` sobre `--ui-surface` y sobre `--ui-accent-bg`,
el texto blanco sobre `--ui-accent` y `--ui-accent-hover`, y los chips sobre su fondo.

### 3.2 Tema

- `ThemePref` = `'light' | 'dark'`. `parsePref`: `'light'` → claro; cualquier otra cosa → oscuro.
- El guion anti-destello de `index.html` pone siempre `data-theme`.
- El `data-color` de los `theme-color` sigue igual a `--ui-bg` de su tema (`theme.test.ts`).
- El botón `ui/ThemeToggle.tsx` muestra sol o luna y se llama «Cambiar a tema claro» o «Cambiar a tema oscuro»
  (`aria-label`). Al cambiar de tema, el lienzo SVG y el Canvas 2D de Casos toman los colores nuevos sin recargar.

### 3.3 Fuentes

- `@fontsource-variable/outfit` y `@fontsource-variable/jetbrains-mono`, fijados con versión exacta 5.3.0.
- Se importan desde `src/styles/fonts.css`, solo con los subconjuntos `latin` y `latin-ext` (más `greek` para
  JetBrains Mono, para γ, λ y φ). Los woff2 emitidos suman ≤ 160 KB.
- `--ui-font-sans: 'Outfit Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  `--ui-font-mono: 'JetBrains Mono Variable', ui-monospace, 'SFMono-Regular', Menlo, monospace`.
- Las cifras, las coordenadas, los ids, las celdas numéricas y los campos numéricos usan la mono con
  `font-variant-numeric: tabular-nums`.
- Las licencias OFL de ambas familias se copian a `apps/web/public/licenses/` y se citan en `apps/web/public/fonts/README.md`.

### 3.4 Ícono de la app

`public/icons/icon.svg` pasa a ser la marca de la suite (cuadro r = 8 con el talud y el arco discontinuo, XA4 §1)
con colores fijos del tema oscuro. `icon-192.png` e `icon-512.png` se regeneran desde ese SVG. `manifest.webmanifest`
usa `#0a0a0b` como `background_color` y `theme_color`.

## 4. Interfaces congeladas (UA0, commit del coordinador)

### 4.1 `editor/app/shellModel.ts` (implementa UA1-M; consumen UA1-A y UA1-S)

Firmas en el archivo. Reglas:

**`stepStates(doc, issues, pendingDrafts)`**: resúmenes de ≤ 40 caracteres, con coma decimal y unidades del documento
(m o ft). Si un resumen no cabe, se usa la forma corta («4 métodos · 50 dovelas»), nunca un corte a mitad de palabra.

| Paso | Resumen | Estado si vacío |
|---|---|---|
| geometry | «2 regiones · 12 vértices · 1.234 m²» (sin decimales desde 100; uno por debajo) | «Sin regiones», `empty` |
| materials | «2 materiales · Mohr-Coulomb» o «… · Mohr-Coulomb, Hoek-Brown» (nombres de modelo de la UI) | «Sin materiales», `empty` |
| water | «Piezométrica · 5 puntos» | «Sin piezométrica», `optional` |
| surface | «Circular fija», «Polilínea fija · 6 puntos», «Búsqueda circular», «Búsqueda no circular» | «Sin superficie» (es `error` si `validateLocal` lo marca) |
| search | «Entrada 10–25 m · salida 40–60 m» | «Inactiva», `optional` |
| analysis | «Bishop · Spencer · M-P · 50 dovelas» (nombres cortos de `resultSummary.ts`) | — |
| loads | «1 distribuida · 2 lineales» | «Sin cargas», `optional` |
| reinforcements | «3 refuerzos» o «1 anclaje · 2 clavos» si cabe | «Sin refuerzos», `optional` |
| seismic | «kh 0,10 · kv 0,00» | «Sin sismo», `optional` |
| project | título (o «Sin título») + « · SI» o « · imperial» | `optional` sin título |

Estado, por precedencia: `error` (alguna incidencia local de severidad `error` cuyo `issueTargetFor(issue, doc).tab`
es el paso) › `draft` (un borrador pendiente del paso; mapear las claves de `getPendingDrafts` a pasos leyendo dónde
las registra cada panel) › `empty` / `optional` › `done`.

**`runStatus(input)`**: la primera fila que se cumple, de arriba abajo. «N» y «c de t» son números.

| Condición | Tono | Texto |
|---|---|---|
| `engineStatus === 'loading'` | neutral | «Cargando el motor…» |
| `engineStatus === 'failed'` | nok | «Motor no disponible» |
| `busy` | accent | «Calculando 4 métodos…» («1 método» en singular) |
| `!hasRegions` | neutral | «Sin modelo» |
| `message` y `messageKind === 'error'`, sin resultado actual | nok | «Error: …» (≤ 40 en total, con elipsis; el texto completo en `title`) |
| resultado actual y ningún método convergió | warn | «Sin convergencia» |
| resultado actual y convergieron menos de los calculados | warn | «Parcial · 3 de 4 métodos» |
| resultado actual y FS mínimo < 1 | nok | «Calculado · FS < 1,0» |
| resultado actual | ok | «Calculado · FS mín. 1,234» |
| resultado no actual y borradores | warn | «Cambios sin aplicar» |
| resultado no actual | warn | «Resultados desactualizados» |
| `localErrors > 0` | warn | «Modelo con 3 problemas» («1 problema») |
| `pendingDrafts > 0` | warn | «Cambios sin aplicar» |
| en otro caso | neutral | «Listo para calcular» |

El `title` repite el texto y añade el detalle que no cabe: el mensaje completo, o los métodos que no convergieron.

**`fsMinimum(report)`**: el mínimo sobre los resultados `converged` con `convergedFos` finito. `text` = `formatFs(value)`;
`methods` = los métodos cuyo FS formateado es igual al del mínimo; `below1` = `value < 1` con el valor crudo.

**`reportContents(run)`**: una fila por sección que **de verdad** genera `report/pdf.ts` con ese cálculo (léelo; no
inventes secciones). `included` indica si la sección sale con este modelo, por ejemplo «Refuerzos y fuerzas» solo con
refuerzos.

### 4.2 `EditorCanvas` (implementa UA1-C; pasa UA1-A)

Props opcionales nuevas, ya declaradas en `EditorCanvasProps`:
- `paletteTools?: ReactNode`: contenido que el lienzo pone en su paleta flotante (`nav.ec-palette`,
  `aria-label="Herramientas del lienzo"`), encima del grupo «Zoom y encuadre». UA1-A pasa ahí el grupo «Herramienta
  del lienzo» con los seis botones de siempre.
- `fitInsets?: FitInsets`: márgenes en px que «Encuadrar» y el encuadre automático (al abrir, al cambiar el
  documento) dejan libres. UA1-A pasa `{ top: 24, right: 92, bottom: 72, left: 24 }` desde 761 px y
  `{ top: 16, right: 16, bottom: 16, left: 16 }` por debajo.

Los botones «Acercar», «Alejar» y «Encuadrar» conservan nombre, `title` y teclas.

### 4.3 `ResultSummary` → HUD (implementa UA1-S; pasa UA1-A)

- Prop opcional nueva `onShowTable?: () => void`, ya declarada. «Ver tabla de resultados» la llama si existe.
- Se conservan:
  - el contenedor `[role=group][aria-label="Resumen del cálculo"][data-testid="result-summary"][data-state]`;
  - `data-stale-reason`, `ul.rs-list`, `li.rs-item`, `span.rs-method`;
  - `span.rs-fs[data-testid="fs-<método>"]`, con el mismo texto de hoy;
  - `span.rs-flag[data-testid="warn-<método>"]`, `p.rs-counts`, `button.rs-table-link`, `[data-testid="rs-stale-note"]`;
  - `[data-testid="calc-progress"]` y `p.rs-empty`;
  - las clases que fija `ResultSummary.r15c.test.ts`.
- Encima de la lista se agregan:
  - el eyebrow «Factor de seguridad mínimo»;
  - la cifra (`fsMinimum().text`, `data-testid="fs-min"`) y los métodos que la dan;
  - el chip de falla «FS < 1,0» si `below1`.
- Estados:
  - desactualizado: la cifra y los FS van atenuados y tachados, más un chip de aviso «Desactualizado»;
  - calculando: opacidad 0,55;
  - vacío: un texto compacto.
- El HUD se pliega con un botón «Ocultar resultado» / «Mostrar resultado» (`aria-expanded`, `aria-controls`). Plegado
  queda una píldora con «FS mín. 0,984».
- El aviso de método va con el ícono `IconWarning` y el texto «Con aviso», sin el emoji ⚠.

### 4.4 Componentes compartidos

| Archivo | Lo implementa | Uso |
|---|---|---|
| `ui/icons.tsx` | UA1-S | Íconos con los nombres ya exportados; firma `({ size }) => <svg aria-hidden>`, trazo `currentColor`. Los dibujos salen de la maqueta (`src/flujo.html`, `src/suite.css`) o se dibujan a mano; no se copian juegos de íconos de terceros. |
| `ui/ThemeToggle.tsx` | UA1-T | Botón de tema (§3.2). UA1-A lo coloca en la cabecera. |
| `ui/BrandMark.tsx` | UA1-A | Marca de la cabecera (SVG de XA4 §1, colores por `var(--…)`). |

### 4.5 Primitivas `.gs-*` (`src/styles/components.css`, UA1-S)

Solo `var(--…)` y medidas; ningún color literal. UA1-A y UA1-C las usan tal cual:

| Clase | Qué es |
|---|---|
| `.gs-btn` | Botón secundario: alto 32, radio 8, 13/500, borde `--ui-border-strong`. |
| `.gs-btn-primary` | Botón primario: acento, texto `--ui-ink-on-accent`, hover `--ui-accent-hover`. |
| `.gs-btn-lg` | Botón de 40. |
| `.gs-icon-btn` | Botón de solo ícono, 32 × 32. |
| `.gs-chip[data-tone=neutral\|accent\|ok\|warn\|nok]` | Chip: alto 24, radio 999, 12/500, punto de 7, una línea con elipsis. |
| `.gs-eyebrow` | Rótulo de 11/600, mayúsculas, +0,08 em. |
| `.gs-kbd` | Tecla: mono 11, borde. |
| `.gs-mono` | Mono con tabular-nums. |
| `.gs-tool`, `.gs-tool[aria-pressed=true]` | Botón de la paleta: 42 × 42, radio 10; activo en acento. |
| `.gs-tip` | Tooltip dentro del botón, a la izquierda, con hover y `:focus-visible`, `aria-hidden`. |
| `.gs-badge[data-status=done\|error\|draft\|optional\|empty]` | Insignia de paso de 28. |
| `.gs-spinner` | Indicador de carga; lento con `prefers-reduced-motion`. |
| `.gs-card` | Tarjeta: radio 12, borde, fondo `--ui-surface`. |

Hasta 760 px, `.gs-btn`, `.gs-icon-btn` y `.gs-tool` miden ≥ 40.

### 4.6 Pasos y panel en línea (UA1-A)

- `div[role=tablist][aria-label="Paneles del modelo"][aria-orientation=vertical]` contiene solo los diez
  `button[role=tab]`, con `id="ea-tab-<id>"`, `aria-controls="ea-tabpanel"` y `aria-selected`.
- El nombre accesible de cada pestaña es **solo el título**: `aria-labelledby` al título, y el resumen y la insignia en
  `aria-describedby`.
- El `div#ea-tabpanel[role=tabpanel]` va **fuera** del tablist, como hermano, y se coloca visualmente debajo del paso
  activo, con `display: contents` en el tablist y `order` en los hijos, o con otra técnica que pase axe
  (`aria-required-children`) y deje el orden de foco: paso activo → contenido del panel → pie de acción.
- Las flechas arriba y abajo mueven entre pasos (foco itinerante), como en el patrón de pestañas de la APG.

### 4.7 Vistas (UA1-A)

- `div[role=tablist][aria-label="Vistas"]` con cuatro pestañas:

  | Pestaña | `id` | Panel |
  |---|---|---|
  | «Lienzo» | `mode-edit` | `mode-edit-panel` |
  | «Resultados» | `view-results` | `view-results-panel` |
  | «Casos de verificación» | `mode-cases` | `mode-cases-panel` |
  | «Informe» | `view-report` | `view-report-panel` |

- Los cuatro paneles quedan montados y los ocultos llevan `hidden`. El lienzo no se desmonta nunca.
- **Lienzo:** la tarjeta del lienzo, con el HUD, la paleta, las coordenadas y la leyenda dentro. Las pistas de
  herramienta, `stale-result` y `result-caption` van en la tarjeta o justo debajo, visibles en esta vista.
- **Resultados:**
  - con cálculo, `section[data-testid="results-panel"][aria-labelledby="ea-results-title"]`: h2 «Resultados» (o
    «Resultados (desactualizados)»), `ResultsTable` y la línea del motor y el SHA-256;
  - debajo, `DiagnosticsPanel`;
  - sin cálculo, un estado vacío con «Comprobar».
- **Casos de verificación:** `CasesView` tal cual (`.cases-view`), restilizada y adaptada al ancho.
- **Informe:**
  - h2 «Informe técnico» y el título del documento en solo lectura, con un botón «Editar título» que abre el paso
    Proyecto;
  - la lista de `reportContents()`, con ✓ en SVG;
  - los botones «Generar PDF» (la misma acción que «Informe PDF», con los mismos bloqueos y el mismo `title`) y
    «Exportar CSV de resultados».
- «Ver tabla de resultados» del HUD abre «Resultados» y enfoca la tabla. Una incidencia de Diagnósticos con destino en
  el lienzo vuelve a «Lienzo».
- Atajos:
  - Ctrl Z, Ctrl Y, Ctrl S, Ctrl O y Ctrl Intro actúan en Lienzo, Resultados e Informe;
  - las teclas de herramienta y de zoom (V, A, R, D, H, + − 0) solo actúan en Lienzo;
  - en Casos no actúa ninguno (R7-07);
  - si «F» está libre en `shortcuts.ts`, se asigna a «Dibujar refuerzo» y se anuncia en su tooltip.

### 4.8 Cabecera y barra de estado (UA1-A)

- **Cabecera:** marca, «OpenGeoSlide» (sigue siendo el `h1`), subtítulo, chip, espacio, «Instalar» si procede,
  «Ayuda», tema, «Archivo» y «Exportar».
- **Menús «Archivo» y «Exportar»:** siguen siendo `DropdownMenu` de `EditorApp` (`button.dd-trigger`). Se muestran en
  la cabecera con `createPortal` a un nodo que `App` crea y pasa por props. Si el nodo aún no existe, se muestran en
  línea.
- **Chip:** `.gs-chip[data-tone]` con el texto de `runStatus().text` y el `title` completo, sin `role="status"`; los
  anuncios siguen en `live-polite`. Va por el mismo portal.
- **Barra de estado**, de izquierda a derecha:
  - `[data-testid="file-status"]` con los mismos textos de hoy;
  - los avisos de borradores pendientes;
  - «Herramienta: <nombre>»;
  - `[data-testid="engine-banner"]` (`EngineIndicator`, que deja la cabecera) con «ogs-core x.y.z · WASM».
- Los avisos de sesión (borrador recuperable, motor simulado, error del motor) y `NoticeList` van arriba del área
  principal, sobre las vistas, sin empujar la tarjeta fuera de la pantalla: se superponen o reducen el alto del
  lienzo, pero la página sigue sin scroll.

## 5. Nombres y selectores que se conservan

- **Botones:**
  - «Comprobar» (exacto), «Deshacer», «Rehacer», «Informe PDF», «Archivo», «Exportar»;
  - en los menús: «Nuevo», «Talud simple…», «Abrir», «Guardar», «Importar DXF», «Importar CSV», y las cuatro
    exportaciones CSV;
  - las herramientas «Seleccionar», «Agregar vértice», «Dibujar región», «Dividir región», «Dibujar refuerzo» y
    «Mover vista»;
  - «Acercar», «Alejar», «Encuadrar», «Ayuda», «Editar» (menú estrecho), «Cancelar cálculo», «Reiniciar el motor»;
  - «Ver tabla de resultados», «Comprobar caso», «Recuperar», «Descartar», «Cerrar todos», «Ver N más»;
  - los de diálogos y confirmaciones.

  Un botón de solo ícono lleva `aria-label` con ese mismo nombre, y su tooltip y su tecla van `aria-hidden`
  (`aria-keyshortcuts` para la tecla).
- **Pestañas:** las diez de «Paneles del modelo», y en «Vistas»: «Lienzo», «Resultados», «Casos de verificación» e
  «Informe».
- **`data-testid`:** todos los del anexo A de `XA1.md`, con los mismos textos que fijan los guiones (`file-status` con
  «con cambios» y «sin cambios»; `engine-banner` con «ogs-core»).
- **Lienzo:** `data-layer`, `data-handle*`, `data-hit-area`, `role="application"`, `svg.ec-svg`, `.ec-root`,
  `[data-results-table]`, y los `[data-path]` de los campos.
- **Diálogos:** `dialog[open]` y `confirm-dialog`; los ids `mode-cases-panel` y `results-title` de Casos;
  `.cases-view`.

## 6. Ola UA1: propiedad de archivos

Rutas relativas a `apps/web/`. Fuera de esta tabla nadie edita nada. En especial, nadie toca `docs/**/e2e/`, el
motor, `report/pdf.ts` ni `report/palette.ts`.

| Escritor | Worktree / rama | Puerto | Archivos propios |
|---|---|---|---|
| **UA1-T** tokens, tema, fuentes e ícono | `opengeoslide-wt/ua1-t` / `ua1-t` | 5182 | `src/styles/tokens.css`, `styles/tokens.contrast.test.ts`, `styles/fonts.css`, `styles/no-hardcoded-colors.test.ts` (solo si cambia la lista de archivos), `src/theme/**`, `ui/ThemeToggle.tsx`, `ui/ThemeSelect.tsx` (se puede borrar), `index.html`, `package.json`, `pnpm-lock.yaml`, `public/icons/**`, `public/manifest.webmanifest`, `public/licenses/**`, `public/fonts/README.md`, `pwa/pwa.test.ts` (solo si hace falta), `theme/lightPalette.ts` y su test |
| **UA1-A** armazón | `opengeoslide-wt/ua1-a` / `ua1-a` | 5183 | `src/App.tsx`, `src/App.css`, `src/editor/EditorApp.tsx`, `editor/app/editor-app.css`, `editor/app/newModel.css`, `editor/app/shell/**` (nuevo), `ui/BrandMark.tsx` (nuevo), `ui/EngineIndicator.tsx`, `ui/InstallButton.tsx`, `ui/HelpDialog.tsx` (texto), `ui/targets.css`, `onboarding/**`, `editor/app/shortcuts.ts` y su test, `editor/app/useNarrow.ts`; tests que fijan literales de esos archivos (`tabSwitch.r16*`, `discard.r16`, `EditorApp.r15c`, `casesVerb`, solo para seguir el código movido, conservando lo que afirman); en `editor/canvas/EditorCanvas.test.ts`, solo el `it` «el lienzo rellena el contenedor…» |
| **UA1-M** modelo puro | `opengeoslide-wt/ua1-m` / `ua1-m` | — | `editor/app/shellModel.ts` y `editor/app/shellModel.test.ts` (nuevo) |
| **UA1-C** lienzo | `opengeoslide-wt/ua1-c` / `ua1-c` | 5186 | `editor/canvas/EditorCanvas.tsx`, `editor/canvas/canvas.css`, `editor/canvas/viewportOps.ts`, `editor/canvas/DrawLayer.tsx`, tests nuevos `editor/canvas/*.ua1.test.ts` (no edita `EditorCanvas.test.ts`) |
| **UA1-S** componentes | `opengeoslide-wt/ua1-s` / `ua1-s` | 5187 | `ui/icons.tsx`, `styles/components.css`, `editor/app/ResultSummary.tsx`, `editor/app/resultSummary.css`, `editor/app/ResultSummary.r15c.test.ts`, `resultSummary*.test.ts`, `editor/panels/panels.css`, `editor/panels/*.css`, `ui/legend.css`, `ui/checkTable.css`, `editor/app/notices.css`, tests nuevos `*.ua1.test.ts` en esas carpetas |
| **UA1-Q** aceptación | `opengeoslide-wt/ua-int` (solo `docs/suite-a/e2e/`) | 5188 | `docs/suite-a/e2e/**` (nuevo) |

`App.css` es de UA1-A: los demás no lo editan; si necesitan una regla ahí, la proponen en su informe.

## 7. Puertas de cada escritor (UA1)

Desde `apps/web/` de tu worktree:

```bash
pnpm install --frozen-lockfile        # UA1-T: pnpm add -E … y después install
pnpm typecheck && pnpm test && pnpm build
```

- `src/wasm/` ya está copiado en cada worktree; si falta, `bash scripts/build-wasm.sh`.
- Antepón `env -u PYTHONPATH -u PYTHONHOME` a cualquier Python.
- **Recorrido en Chrome** (UA1-T, UA1-A, UA1-C y UA1-S):
  1. Copia `dist` a `$TMPDIR/ua1/<escritor>/dist` (`TMPDIR=~/.hermes/profiles/open-geoslide/cache/scratch`) y
     sírvelo con `python3 -m http.server <puerto> --bind 127.0.0.1 -d …`.
  2. Instala `playwright-core` en `$TMPDIR/ua1/<escritor>`, no en el repo. Chrome:
     `/usr/bin/google-chrome-stable` con `--no-sandbox`.
  3. Sigue `~/.hermes/profiles/open-geoslide/skills/software-development/ogs-web-chrome-walkthrough/SKILL.md`: guía de
     primera visita marcada como vista y espera a «ogs-core».
  4. Captura 1440 × 900 y 390 × 844, en oscuro y en claro, con un ejemplo abierto y calculado. Mata el servidor por
     PID al final.
- **Regla de los otros escritores:** el trabajo de los demás no existe en tu rama. `shellModel`, `icons`, `ThemeToggle`
  y las props nuevas tienen implementaciones neutras; programa contra la firma y no las rellenes.
- **Commits:**
  - uno por parte, con mensaje `UA1-<X>: …`, en tu rama;
  - sin push y sin merge;
  - identidad del repo (ya configurada);
  - `git add` con rutas explícitas, nunca `git add .`.
- **Cuándo parar:** para y reporta con cifras si un criterio no se puede cumplir, si un test que no es tuyo falla, o si
  necesitas un archivo de otro escritor (deja el cambio propuesto como diff en tu informe). Lo que tiene precedente en
  el repo no es motivo para parar: síguelo y anótalo en «decisiones».
- **Informe final:**
  - commits;
  - archivos tocados;
  - las cifras de las puertas (test files y tests pasados o saltados, build);
  - las rutas absolutas de las capturas;
  - decisiones;
  - los cambios que propones para archivos de otros;
  - lo que quedó pendiente, en orden de prioridad.

## 8. Aceptación del bloque (la corre el coordinador al integrar)

`docs/suite-a/e2e/aceptacion_ua.mjs` (UA1-Q). Se corre con `OGS_URL=… node aceptacion_ua.mjs` y escribe
`aceptacion-<etiqueta>.json` y las capturas.

| Id | Comprobación |
|---|---|
| A01 | Sin errores de consola ni respuestas HTTP ≥ 400 al cargar, abrir un ejemplo, comprobar, pasar por las cuatro vistas y cambiar de tema. |
| A02 | Sin scroll de página en la vista Lienzo, tras comprobar, a 1440 × 900 en oscuro y a 1280 × 800 en claro. |
| A03 | `scrollWidth ≤ innerWidth` a 320, 390, 768, 1024, 1280 y 1440. |
| A04 | La familia calculada del `body` es Outfit, y `document.fonts` tiene Outfit y JetBrains Mono cargadas. El FS del HUD y las coordenadas van en JetBrains Mono con `tabular-nums`. |
| A05 | Fondo de «Comprobar» `rgb(44, 119, 195)` en oscuro y `rgb(47, 109, 168)` en claro, con texto blanco. |
| A06 | Con `localStorage` vacío el tema es oscuro. El botón de tema cambia a claro y persiste al recargar. El fondo del lienzo cambia sin recargar. |
| A07 | La cabecera tiene la marca SVG y «OpenGeoSlide». El chip ocupa una línea (alto ≤ 26) con su `title`. |
| A08 | Los diez pasos existen con su nombre exacto en el tablist vertical, dentro de la barra lateral. Cada uno tiene un resumen no vacío de ≤ 40 caracteres en `aria-describedby`. |
| A09 | El tablist «Vistas» tiene las cuatro pestañas con su nombre exacto. Al ir y volver de cada vista, el lienzo conserva el mismo nodo `svg`. |
| A10 | Tras comprobar un ejemplo, `fs-min` es igual al mínimo de los `fs-<método>` que convergieron. |
| A11 | En Lienzo hay un solo control visible con nombre «Comprobar». |
| A12 | Ningún botón, pestaña ni encabezado visible tiene emojis ni dingbats (⚠ ▾ ✓ ✕ ↵ ▶ ⏸ y similares) en su texto. |
| A13 | axe sin violaciones serias ni críticas en Lienzo, Resultados, Casos e Informe, en oscuro y en claro, a 1440. |
| A14 | Objetivos de clic ≥ 24 × 24 a 1440. A 390, ≥ 40 de alto en la cabecera, la paleta y el pie de acción. |
| A15 | Todo botón visible tiene nombre accesible. |
| A16 | Tras «Encuadrar», ningún vértice de región cae bajo la paleta ni bajo la leyenda, a 1440 y a 1280. |
| A17 | A 390, el pie de acción sigue visible al hacer scroll hasta la mitad de la página (sticky). |

Además (UA2):
- la regresión e2e completa con 0 FAIL;
- vitest y build en verde;
- las capturas revisadas por el coordinador.

## Enmiendas

(ninguna)

### UA-E1 (27-nov, tras UA1-T)

- `src/render/drawSection.test.ts` pasa a UA1-T, solo para que siga el fondo claro v1.1 del lienzo (`#f6f7f9`).
- `--ui-accent` no se usa como color de texto: en oscuro da menos de 4,5. El texto y los trazos de acento usan
  `--ui-accent-bright`. `--ui-accent` queda para fondos (botón primario, herramienta activa).
- Ajustes de UA1-T sobre los valores de la suite, porque fallaban `tokens.contrast`:
  - `--ui-ink-muted` claro `#58626f`;
  - `--ui-err-border` claro `#c0494b`;
  - `--canvas-axis` `#55606c` / `#99a3b0`;
  - `--canvas-surface` oscuro `#ff9ca8`;
  - `--canvas-slice-edge` con alfa 0,62 / 0,55;
  - `--canvas-handle-sel` oscuro `#b45309`.

  Quedan como valores propios de OpenGeoSlide, anotados en la cabecera de `tokens.css`.
