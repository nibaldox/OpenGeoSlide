# X8: auditoría UX práctica de OpenGeoSlide (web publicada)

Fecha: 25/11/2026 · Objetivo: https://nibaldox.github.io/OpenGeoSlide/ (build de `main`) · Código: `apps/web/src` (solo lectura, sin commits, sin builds).
Método: Chrome estable 1440×900 con playwright-core y `--no-sandbox`; axe-core 4.14.1 con `wcag2a, wcag2aa, wcag21aa, wcag22aa, best-practice`; mediciones por DOM y CDP. Guías de criterio: `mwg/` (color, contraste, modo oscuro, accesibilidad).
Scripts y datos: `cache/scratch/x8-ux/` (`axe_views.json`, `flows.json`, `errs.json`, `resp.json`, `perf.json`, `contrast.json`, `final.json`, `saveopen.json`). Capturas: `cache/scratch/x8-ux/shots/`.
Límites: no se probó con lector de pantalla; Superficie y Búsqueda se revisaron como paneles, no como flujo completo; no se midió red lenta; el informe PDF se verificó por tamaño y cabecera, no visualmente.

## 1. Resumen

- Los cálculos funcionan de forma fiable: motor WASM, 336 ms de primer cálculo, LCP 148 ms, CLS 0, PWA con uso sin conexión.
- Tres mejoras de mayor impacto: (1) mostrar el FS sin desplazarse y arreglar los desbordes horizontales (UX-03, UX-04); (2) permitir crear un modelo o una región desde cero y editar vértices con teclado (UX-01, UX-02); (3) corregir contraste y tokens de color antes del tema oscuro (UX-06 y sección 8).
- La importación CSV acepta datos que su propio diálogo declara inválidos (UX-07).
- axe: 2–5 reglas por vista, todas corregibles con cambios de esfuerzo S; ninguna vista pasa limpia.

## 2. Tabla de hallazgos

Severidad: CRITICAL / HIGH / MEDIUM / LOW. Esfuerzo: S / M / L. Rutas de capturas relativas a `shots/`.

| ID | Sev. | Vista / flujo | Qué pasa | Evidencia | Recomendación (archivo / componente) | Esf. |
|---|---|---|---|---|---|---|
| UX-01 | HIGH | Editor · modelo desde cero | No se puede dibujar una región nueva. «Nuevo» carga un modelo de una región («Suelo»). «Agregar vértice» solo actúa sobre aristas existentes; 4 clics en el lienzo no cambian nada (regiones 1→1, vértices 6→6). La única vía de regiones nuevas es importar DXF o JSON. | `fA2-cuatro-clics.png`; `EditorCanvas.tsx:86`, `gesture.ts:191-218` (solo `hover === 'edge'`); `types.ts:7` (sin herramienta de región) | Añadir herramienta «Nueva región» (`types.ts`, `reducer.ts`, `gesture.ts`) y plantilla vacía en `editor/app/docTemplates.ts`. | L |
| UX-02 | HIGH | Lienzo · teclado | Sin ratón no se pueden añadir vértices. Los vértices sí se mueven: foco + flechas (0,1 m; Mayús ×10), Supr quita. WCAG 2.1.1 incumplido de forma parcial. | `keys.ts` sin acción de inserción; prueba de teclado en `flows.json` (`F3_teclado_flechas`) | `editor/canvas/keys.ts`: acción «insertar vértice en el punto medio de la arista seleccionada»; foco en aristas en `EditorCanvas.tsx`. | M |
| UX-03 | HIGH | Resultados · 1440×900 | Tras «Comprobar», el panel de resultados empieza en y=1064 px (viewport 900). El FS, la tabla y el diagnóstico no se ven sin desplazarse, aunque el lienzo ocupa la pantalla. | `final.json` (`resultsTop` 1064, `canvasBottom` 986); `f2-ejemplo-resultados.png` | Mostrar un resumen de FS mínimo junto a «Comprobar» (barra de herramientas) o reordenar: resultados en columna lateral fija. `App.tsx`/`EditorApp.tsx` (layout de resultados). | M |
| UX-04 | HIGH | Responsive · escritorio estrecho y móvil | Desborde horizontal: tabla de materiales de 75 px sobrante en 1024–1440; 224 px en 390 px (barra «Archivo» y selector «Ejemplos» cortados); 294 px a 320 px (falla 1.4.10). | `resp.json`; `resp-390x844.png`; `resp-1440x900-full.png` | Envolver `.ep-table` en contenedor `overflow-x: auto` (`editor/panels/panels.css`); barra de herramientas con `flex-wrap`; `select` con `max-width: 100%` (`App.css`). | S |
| UX-05 | HIGH | Lienzo · objetivos táctiles | Los manejadores de vértice miden 10×10 px (mínimo WCAG 2.2 2.5.8: 24×24). Son los únicos controles por debajo del mínimo; el resto de controles mide ≥ 24 px. | `contrast.json` (`smallTargets`: 6 vértices, 10×10) | Área de acierto transparente de 24×24 px por manejador, sin cambiar el dibujo (`EditorCanvas.tsx`, bloques de manejadores, líneas 425–490). | S |
| UX-06 | HIGH | Todas las vistas · contraste | `--muted #6b7280` sobre `--bg #f3f4f6` = 4,39:1 (requiere 4,5:1). Afecta subtítulo del encabezado y pestaña inactiva «Casos de verificación». axe: `color-contrast` serious en las 7 vistas. | `axe_views.json`; `contrast.json`; `App.css:5` | Cambiar `--muted` a `#4b5563` (6,9:1 sobre `#f3f4f6`). Con el tema oscuro, definir el token en ambos temas. | S |
| UX-07 | HIGH | Importar CSV (piezométrica) | El diálogo avisa «debe ser x estrictamente creciente», pero «Importar piezométrica» sigue activo. Un CSV con x = 40, 20, 70 importa 3 puntos sin ningún aviso de error. | `errs2.log` (E4b); `bad.csv`; texto del diálogo en `f8-csv-dialogo.png` | Validar en `editor/app/importPlan.ts` y deshabilitar el botón con el motivo en `ImportDialogs.tsx`. | S |
| UX-08 | MEDIUM | Todas las vistas de edición · estructura | No hay `<main>` visible en el modo Editar. El único `<main>` está dentro de `.cases-view` (oculto). axe: `landmark-one-main` en V1–V3 y `region` en las 7 vistas. | `kb.mjs` (MAIN: `visible:false`, padre `cases-view`); `axe_views.json` | Envolver el contenido de `#mode-edit-panel` en `<main>` (`App.tsx:322`). | S |
| UX-09 | MEDIUM | Avisos (todas las vistas) | Lista de avisos con `<ul>` cuyos `<li>` tienen `role="status"`: axe `list` (serious, WCAG 1.3.1) y `aria-allowed-role` en V2–V5. | `axe_views.json` | Quitar `role` de los `li`; un solo contenedor `aria-live="polite"` (`EditorApp.tsx`, bloque de avisos `ea-notices`). | S |
| UX-10 | MEDIUM | Avisos · flujo general | Los avisos no se cierran solos y se acumulan: al importar DXF y CSV quedan 4 avisos apilados, con desplazamiento del lienzo. | `flows.json` (`F8_csv_aviso`: 4 entradas) | Cierre automático de avisos «info» a los 6 s y máximo 3 visibles (`EditorApp.tsx`, `notify`). | S |
| UX-11 | MEDIUM | Primera visita · ejemplo | Al cargar «V047a» el título sigue «Sin título · sin cambios pendientes». El modelo inicial es el mismo caso V047a sin etiqueta: el «primer cálculo» y el ejemplo dan idéntico FS (0,985 / 0,984). | `dbg-v047a.png`; `flows.json` (`F1_diagnostico`, `F2_tabla`) | Nombre del documento = nombre del caso al cargar ejemplo; modelo inicial etiquetado como ejemplo (`docTemplates.ts`, `EditorApp.tsx`). | S |
| UX-12 | MEDIUM | Primera visita · ayuda | Sin guía de inicio ni enlace de ayuda. Texto de ayuda solo en paneles (p. ej. `HELP` en `SeismicPanel.tsx`). «Diagnósticos: Sin comprobar con el motor» no indica qué hacer. La palabra «Ejemplo» es el único indicio. | `flows.json` (`F1_sin_ayuda_texto_visible`); `01-inicio-1440.png` | Banner de primera visita con 3 pasos (ejemplo → Comprobar → leer FS) y enlace «Ayuda» en el encabezado (`App.tsx`, `EditorApp.tsx`). | M |
| UX-13 | MEDIUM | Mensajes del motor y de importación | Mensajes técnicos: «kh debe estar en [0, 1)»; «el ángulo de fricción debe estar en [0, 90)»; DXF: «Línea 1: se esperaba un código de grupo entero y se encontró «…»»; JSON: «El archivo no es JSON válido.» sin posición. | `errs.json` (E1, E2, E5, E6) | Mostrar valor actual, rango en lenguaje llano y línea/columna (`engine/errors.ts`, `editor/state/validateLocal.ts`, `io/dxf/*`). | S |
| UX-14 | MEDIUM | Resultados · tabla | Tabla sin `<caption>` ni `aria-labelledby`: nombre accesible vacío; el título «Resultados» no está asociado. | `flows.json` (`F2_tabla_caption`: null/null/null) | Añadir `aria-labelledby` al `h2` de «Resultados» (`ui/ResultsTable.tsx`). | S |
| UX-15 | MEDIUM | Colores de material · pantalla vs PDF | La pantalla y el PDF usan paletas distintas por índice: `render/scene.ts:6` (#d8b77a…) y `report/content.ts:63-71` ([217,200,160]…). El mismo material puede verse con otro color en el informe. | Inventario, sección 8 | Una sola paleta en `shared/` o `scene.ts` como fuente; el PDF la importa (`report/content.ts`). | M |
| UX-16 | LOW | Pestañas (panel derecho y modo) | Las flechas no mueven el foco en las pestañas (ARIA APG). Hay 9 paradas de tabulación en el panel en lugar de una con flechas. | `errs2.log` (E8: foco sigue en «Materiales») | Foco en roving tabindex y flechas izquierda/derecha (`EditorApp.tsx`, `App.tsx` tablist). | S |
| UX-17 | LOW | «Nuevo» con cambios | Usa `window.confirm` nativo («Hay cambios sin guardar. ¿Descartarlos?»): sin estilo, no respeta el tema y bloquea la pestaña. | `errs2.log` (E7); `EditorApp.tsx:122` | Diálogo propio con foco y Esc (`ImportDialogs.tsx` como patrón). | S |
| UX-18 | LOW | Barra de herramientas | «Comprobar» aparece dos veces (barra y panel de resultados): dos paradas de tabulación con el mismo nombre. | `kb-tab-focus.png` (tabs 12 y 20) | Dejar uno o diferenciar el nombre (`EditorApp.tsx`). | S |
| UX-19 | LOW | PWA · instalación | No hay botón ni aviso de instalación: no existe manejador de `beforeinstallprompt` en el código. La instalación depende del menú del navegador. | `grep beforeinstallprompt` vacío en `src/` | Capturar `beforeinstallprompt` en `pwa/register.ts` y ofrecer botón en el encabezado. | S |
| UX-20 | LOW | Lienzo · ejes | Etiquetas de ejes de 10 px (unidades del SVG). Contraste correcto (4,83:1). | `EditorCanvas.tsx:270,276` (`fontSize={10}`) | Subir a 12 px o usar `vector-effect`/escala. | S |

Aspectos positivos verificados (no son hallazgos): foco visible 3 px en las 45 paradas de tabulación (`App.css:331`); Esc cierra diálogos de importación y devuelve el foco al disparador; el diálogo DXF es claro (avisos, entidades ignoradas, mapeo por capa, destino y resumen «se crearán 3 material(es)»); recuperación de borrador con «Recuperar/Descartar»; guardado .ogs.json con SHA-256 en el aviso; el lienzo tiene `role="application"` con nombre y los vértices `role="button"` con coordenadas en el nombre; la vista de casos tiene `role="img"` con nombre en el gráfico.

## 3. Flujos: clics y fricción (1440×900)

| Flujo | Medición | Fricción observada |
|---|---|---|
| F1 Comprobar modelo inicial | 1 acción; tabla visible en 336 ms (motor 278 ms) | Resultado fuera de pantalla (UX-03) |
| F2 Cargar ejemplo V047a | 2 acciones (selector + Comprobar); aviso inmediato | Título no cambia (UX-11) |
| F3 Arrastrar vértice | 1 arrastre; banner «resultado de una versión anterior» al instante | Buena retroalimentación; sin ratón no se edita (UX-02) |
| F3 Teclado | Tab al vértice + flechas (0,1 m; Mayús ×10) | Sin añadir vértices |
| F3b Añadir vértice en arista | 3 acciones (herramienta, clic, volver a Seleccionar) | Solo ratón |
| F4 Sismo kh = 0,1 | 4 acciones; FS Bishop 0,985 → 0,790; Spencer 0,984 → 0,791; recálculo 482 ms | Entrada inválida: «kh debe estar en [0, 1)» (UX-13) |
| F5 Exportar | PDF 1 clic (121 kB, `V047a-informe.pdf`); CSV resultados y superficie 1 clic cada uno | Correcto |
| F6 Leer resultados | Tabla de 9 columnas; notas de «bloque principal» visibles | FS fuera de pantalla (UX-03); tabla sin nombre (UX-14) |
| F7 Importar DXF | 2 acciones + mapeo; Ctrl+Z deshace la importación en 1 paso; Esc cancela | Buen diseño; avisos apilados (UX-10) |
| F8 Importar CSV piezométrica | 3 acciones | Acepta x no creciente (UX-07) |
| F9 Guardar / Abrir | Guardar: 1 acción, `V047a.ogs.json` (1,3 kB), aviso con SHA-256. Abrir: selector + aviso «Abierto» | Correcto |
| F10 Borrador | Autoguardado en localStorage; banner tras recargar; kh recuperado = 0,15 | Correcto |
| F11 Casos de verificación | 2 acciones; 1,1 s; tablas FS y «Publicado / Error (%) / Tolerancia» | Correcto; sin ayuda sobre tolerancias |
| Modelo desde cero | No posible en lienzo (UX-01) | Bloquea el flujo principal de nuevos usuarios |
| Piezométrica, superficie, búsqueda (editor) | Paneles presentes con texto de ayuda; no recorridos de extremo a extremo | No medido completo |

## 4. Heurísticas de Nielsen

| Heurística | Valoración | Evidencia |
|---|---|---|
| Visibilidad del estado | Buena (barra de estado, «con cambios sin guardar», «Calculando…», banner de resultado obsoleto) | `F3_arrastre_vertice`, `perf.json` |
| Correspondencia con el mundo real | Buena para ingeniería (kN/m³, kPa, °, m; decimal con coma). Términos técnicos sin explicación (rᵤ, λ, m_α) | `flows.json` |
| Control y libertad | Deshacer/rehacer, Ctrl+Z, Esc. Falta un «Nuevo» sin confirmación nativa (UX-17) | `errs2.log` |
| Consistencia | Buena dentro de la app; «Comprobar» duplicado (UX-18); paleta de material distinta en PDF (UX-15) | Sección 8 |
| Prevención de errores | Parcial: validación de campos con `aria-describedby` (buena), CSV no validado (UX-07), región nueva imposible (UX-01) | `errs.json` |
| Reconocer antes que recordar | Parcial: unidades visibles; sin ayuda de primera visita (UX-12) | `flows.json` |
| Flexibilidad y eficiencia | Atajos Ctrl+S/O/Z, A (añadir), Esc; sin atajo para región nueva ni para insertar vértice por teclado | `shortcuts.ts` |
| Diseño estético y minimalista | Buena jerarquía en editor; resultados por debajo del pliegue (UX-03) | `f2-ejemplo-resultados.png` |
| Ayuda para reconocer, diagnosticar y recuperarse de errores | Parcial: mensajes técnicos (UX-13) | `errs.json` |
| Ayuda y documentación | Insuficiente: sin ayuda en la app (UX-12) | `flows.json` |

Primera visita (criterio de 10 s): la pantalla muestra el lienzo con una sección y la barra con «Comprobar»; el propósito se entiende, pero no el primer paso ni el significado de «Diagnósticos». Valoración subjetiva, basada en `01-inicio-1440.png`.

## 5. Accesibilidad WCAG 2.2 AA

### 5.1 axe-core por vista (`axe_views.json`)

| Vista | Violaciones (nodos) | Reglas | Incomplete |
|---|---|---|---|
| V1 Inicio (editor, modelo por defecto) | 3 (4) | `color-contrast` serious (2), `landmark-one-main` moderate, `region` moderate | `color-contrast` 17 (texto SVG sobre imagen) |
| V2 Editor con ejemplo V047a | 5 (6) | `color-contrast` (2), `list` serious (1), `aria-allowed-role` minor (1), `landmark-one-main`, `region` | 17 |
| V3 Resultados | 5 (6) | `color-contrast` (2), `list` (1), `aria-allowed-role` (1), `landmark-one-main`, `region` | 17 |
| V4 Diálogo importar DXF | 4 (5) | `color-contrast` (2), `list` (1), `aria-allowed-role` (1), `region` | 17 |
| V5 Diálogo importar CSV | 4 (5) | Igual que V4 | 17 |
| V6a Casos de verificación (inicio) | 2 (3) | `color-contrast` (2), `region` | `aria-allowed-role` (1) |
| V6b Casos de verificación (resultados) | 2 (3) | Igual que V6a | `aria-allowed-role` (1) |

Los 17 «incomplete» de contraste son las etiquetas de ejes del SVG: `#6b7280` sobre `#ffffff` = 4,83:1, pasa.

### 5.2 Contraste medido (colores reales, `contrast.json`)

| Par (texto / fondo) | Ratio | Estado |
|---|---|---|
| `#6b7280` / `#f3f4f6` (subtítulo, pestaña inactiva) | 4,39 | FALLA (4,5) |
| `rgba(16,16,16,.3)` / `#f9fafb` («Rehacer», «Quitar», deshabilitados) | 1,99 | Exento (control deshabilitado), pero poco legible |
| `#6b7280` / `#ffffff` (ejes SVG) | 4,83 | Pasa |
| `#ffffff` / `#1f4e79` (botón Comprobar) | 8,66 | Pasa |
| `#2563eb` / `#ffffff` (anillo de foco) | 5,17 | Pasa (≥ 3:1) |
| `#2563eb` / `#111827` (anillo de foco en modo oscuro previsto) | ≈ 3,4 | Pasa justo; reforzar en el tema oscuro |

### 5.3 Teclado y foco

- Orden de tabulación (45 paradas en el editor): pestañas → barra (Nuevo…Informe PDF) → lienzo → 6 vértices → «Comprobar» duplicado → pestañas del panel → campos de material → «Nuevo material…» → selector de región.
- Foco visible en las 45 paradas: 3 px sólido `#2563eb` (`App.css:331`).
- Diálogos DXF y CSV: el foco entra al diálogo (`aria-modal="true"`), Esc lo cierra y devuelve el foco al botón de origen.
- Lienzo: vértices operables con flechas y Supr; no se pueden añadir vértices (UX-02).
- Pestañas: sin navegación con flechas (UX-16).

### 5.4 Objetivos, zoom y movimiento

- Objetivos ≥ 24 px: todos los controles salvo los 6 manejadores de vértice (10×10 px) (UX-05).
- Zoom 200 % (aprox. viewport 720×450): sin desborde horizontal (`scrollWidth` 720).
- Reflow 320 px: desborde de 294 px (UX-04; falla 1.4.10).
- `prefers-reduced-motion`: el código no tiene `transition` ni `animation` (0 elementos animados en ejecución); no hay nada que reducir. El indicador de cálculo es texto («Calculando…»).
- Nombres accesibles: lienzo `role="application"` con nombre; vértices con coordenadas; tabla de resultados sin nombre (UX-14); gráfico de verificación `role="img"` con nombre.

## 6. Responsive (`resp.json`, capturas `resp-*.png`)

| Viewport | Ancho documento / ventana | Desborde | Lienzo (px) | Observación |
|---|---|---|---|---|
| 1440×900 | 1515 / 1440 | +75 | 940×538 | Tabla de materiales cortada (columnas «ru» y «Acciones») |
| 1280×800 | 1355 / 1280 | +75 | 780×538 | Igual que 1440 |
| 1024×768 | 1099 / 1024 | +75 | 524×538 | Igual; lienzo estrecho |
| 768×1024 | 768 / 768 | 0 | 704×538 | Usable |
| 390×844 | 614 / 390 | +224 | 326×538 | Barra «Archivo» y selector «Ejemplos» cortados |
| 720×450 (≈ zoom 200 %) | 720 / 720 | 0 | 656×538 | Sin desborde |
| 320×568 | 614 / 320 | +294 | 256×538 | Falla reflow 1.4.10 |

Tablet (768): usable para consultar y editar; móvil (390): consulta posible, edición de tabla y barra incómoda.

## 7. Rendimiento y PWA

Rendimiento (`perf.json`, caché deshabilitada por CDP, 1440 px):

| Métrica | Valor |
|---|---|
| DOMContentLoaded | 107 ms |
| Banner «Motor: ogs-core» visible | 229 ms |
| «Comprobar» habilitado (interactivo) | 238 ms |
| LCP (PerformanceObserver) | 148 ms |
| CLS | 0,0000 |
| Long tasks en la carga | 0 |
| JS inicial (transferencia / descomprimido) | 140 KB / 451 KB (`index-*.js`), más 4 KB de worker y 3 KB de CSS |
| Peticiones en la carga inicial | 4 |
| WASM (`ogs_wasm_bg-BJkOBZTe.wasm`, medido en caché del SW) | 350 061 bytes sin comprimir; lo carga el worker, por lo que no aparece en `resource timing` |
| JS precacheado total (incluye jsPDF y html2canvas, diferidos) | 1 254 919 bytes en 7 archivos |
| Primer cálculo visible (ejemplo/modelo inicial) | 336 ms (motor 278 ms) |
| Recálculo con sismo | 482 ms |
| Indicador mientras calcula | «Calculando…» en el botón y «· calculando…» en la barra de estado; sin animación |

PWA:
- Service worker activo (`sw.js`, alcance `/OpenGeoSlide/`), 14 entradas precacheadas. Recarga sin conexión en 66 ms con motor cargado y cálculo offline correcto (`offline.png`).
- Manifiesto: nombre «OpenGeoSlide», `display: standalone`, `theme_color` y `background_color` `#12324a`, iconos 192/512 y maskable.
- Aviso de actualización: código en `pwa/updatePrompt.ts` (texto «Hay una versión nueva de OpenGeoSlide», botón «Actualizar», con `position: fixed` y colores en línea). No se forzó ninguna actualización.
- Aviso de instalación: no existe (UX-19).

## 8. Inventario de colores para el tema oscuro

Clases: **UI** = cambia con el tema; **LIENZO** = cambia con el tema (SVG/canvas en pantalla); **PDF, NO cambia** = el informe se imprime claro; **MATERIAL** = color de material. No hay color editable por el usuario en `editor/types.ts` (sin campo `color`); la paleta de material es automática por índice, por lo que se clasifica como lienzo/PDF con paleta propia.

### 8.1 CSS

| Archivo:línea | Valores | Clase | Nota |
|---|---|---|---|
| `App.css:2–11` (`:root`) | `--bg #f3f4f6`, `--panel #ffffff`, `--ink #111827`, `--muted #6b7280`, `--line #d1d5db`, `--accent #1f4e79`, `--ok #15803d`, `--fail #b91c1c`, `--sim #fef3c7`, `--sim-ink #78350f` | UI, cambia | Tokens base: definir en `[data-theme=dark]`. `--muted` falla contraste (UX-06) |
| `App.css:53–69` | banners `#e5e7eb`, `#f59e0b`, `#dcfce7`, `#14532d`, `#fee2e2`, `#7f1d1d` | UI, cambia | Usar tokens |
| `App.css:141, 155, 165` | botones `#f9fafb`, texto `#ffffff`, activo `#fee2e2` | UI, cambia | |
| `App.css:210` | `.section-wrap` `#ffffff` | LIENZO, cambia | Fondo de sección de verificación |
| `App.css:237–256` | `.swatch` `#374151`, `#dc2626`, `#1d4ed8`, `rgba(75,85,99,.14/.55)` | LIENZO, cambia | Leyenda de sección |
| `App.css:269–324` | `td #e5e7eb`, `th #f9fafb`, `.row-warn #fffbeb`, `.warnings #92400e`, `.notes #475569`, `.badge-ok #dcfce7`, `.badge-fail #fee2e2` | UI, cambia | |
| `App.css:331` | `:focus-visible` `#2563eb` | UI, cambia | En oscuro: ≈ 3,4:1 sobre `#111827`; subir a `#60a5fa` |
| `App.css:373, 409–410` | `.mode-tab-active #ffffff`; `.ea-tool-active #dbeafe`, `#2563eb` | UI, cambia | |
| `App.css:428–461` | `.ea-draft`, `.ea-notice*` (`#fef3c7`, `#f59e0b`, `#78350f`, `#e0f2fe`, `#0c4a6e`, `#fee2e2`, `#7f1d1d`) | UI, cambia | |
| `App.css:490, 494, 511` | `.ea-canvas #ffffff`; `.ea-stale #92400e`; `.ea-tab-active #ffffff` | LIENZO / UI, cambia | Fondo del lienzo editor |
| `App.css:520–535` | `.ea-backdrop rgba(17,24,39,.5)`, `.ea-modal #ffffff`, `box-shadow rgba(0,0,0,.35)` | UI, cambia | |
| `App.css:581` | `.ea-issue-aviso #92400e` | UI, cambia | |
| `editor/panels/panels.css:32–123` (9 líneas) | `#fef2f2`, `#eff6ff`, `#f9fafb`, `#fee2e2`/`#7f1d1d`, `#fef3c7`/`#78350f`, `#e5e7eb`/`#374151` | UI, cambia | |

No hay `prefers-color-scheme`, `color-scheme` ni `forced-colors` en `App.css`, `panels.css` ni `index.html`.

### 8.2 TSX y TS

| Archivo:línea | Valores | Clase | Nota |
|---|---|---|---|
| `editor/canvas/EditorCanvas.tsx:42–56` | `COLOR_EDGE #1f2937`, `COLOR_SELECTED #2563eb`, `COLOR_PIEZO #1d4ed8`, `COLOR_SURFACE #dc2626`, `COLOR_LOAD #7c3aed`, `COLOR_SEISMIC #c2410c`, `COLOR_GRID #e5e7eb`, `COLOR_AXIS_TEXT #6b7280`, `COLOR_BAND_ENTRY rgba(22,163,74,.35)`, `COLOR_BAND_EXIT rgba(234,88,12,.35)`, `COLOR_RESULT #dc2626`, `COLOR_SLICE_FILL rgba(120,120,120,.22)`, `COLOR_SLICE_EDGE rgba(90,90,90,.55)` | LIENZO, cambia | Constantes SVG (atributos `fill`/`stroke` fijos). Crear objeto `theme` pasado como prop |
| `EditorCanvas.tsx:236` | `background: '#ffffff'` (estilo del `<svg>`) | LIENZO, cambia | |
| `EditorCanvas.tsx:259–276` | `fill`/`stroke` de flechas de carga, rejilla y texto de ejes con constantes | LIENZO, cambia | |
| `EditorCanvas.tsx:290–292` | `fill={materialColor(mi)}` o `'#cccccc'`; `stroke` | MATERIAL (paleta automática) + LIENZO | Usar la paleta de material del tema con fallback propio |
| `EditorCanvas.tsx:312–356` | sección de dovelas, superficie, bandas, piezométrica | LIENZO, cambia | |
| `EditorCanvas.tsx:362–397` | cargas y sismo; badge `fill="rgba(255,255,255,0.72)"` (L387) | LIENZO, cambia | Badge de sismo: en oscuro necesita fondo propio |
| `EditorCanvas.tsx:406–490` | guías `COLOR_SELECTED`; manejadores `#f59e0b`, `#16a34a`, `#ffffff` (L425–490) | LIENZO, cambia | Borde de manejador `#ffffff` (L449, 475, 490): en oscuro, invertir |
| `render/drawSection.ts:8–14` | `COLOR_GRID #e5e7eb`, `COLOR_AXIS #374151`, `COLOR_REGION_EDGE #1f2937`, `COLOR_SURFACE #dc2626`, `COLOR_SLICE_FILL rgba(75,85,99,.14)`, `COLOR_SLICE_EDGE rgba(75,85,99,.55)`, `COLOR_PIEZO #1d4ed8` | LIENZO (sección de verificación) | Solo lo usa `SectionCanvas`, montado en `App.tsx:222` (modo casos) |
| `render/drawSection.ts:113` | `ctx.fillStyle '#ffffff'` (fondo) | LIENZO, cambia | |
| `render/drawSection.ts:123` | `material?.color ?? '#cccccc'` | MATERIAL | |
| `render/scene.ts:6–9` | `MATERIAL_COLORS` (7 colores: `#d8b77a #9cc29a #9fb9d9 #d59b9b #c2a8d8 #e3cf86 #a9d4d0`) | MATERIAL (lienzo, sección) | Fuente compartida por `EditorCanvas` y `drawSection` (vía `scene`) |
| `ui/Legend.tsx:8` | `background: m.color` (dinámico) | LIENZO, cambia | |
| `pwa/updatePrompt.ts:37–41` | `background #12324a`, `color #fff`, `border 1px solid #fff`, `box-shadow rgba(0,0,0,.35)` | UI, cambia | Estilo en línea: mover a clase con tokens |
| `report/content.ts:63–71` | `MATERIAL_COLORS` RGB (8 colores: `[217,200,160]`, `[166,206,227]`, `[178,223,138]`, `[253,191,111]`, `[202,178,214]`, `[251,154,153]`, `[190,190,190]`, `[255,255,153]`) | **PDF, NO cambia** | Paleta distinta de `scene.ts` (UX-15) |
| `report/content.ts:73–75` | `SURFACE_COLOR [200,0,0]`, `PIEZO_COLOR [0,90,200]`, `SLICE_COLOR [120,120,120]` | **PDF, NO cambia** | |
| `report/pdf.ts` (18 líneas) | 14 literales (`setDrawColor(150)` L110, `setFillColor(230,230,230)` L163, `setDrawColor(70,70,70)` L217, `setTextColor(60)` L260, `setTextColor(90)` L336, respaldos `[120,120,120]`/`[0,90,200]`/`[200,0,0]` L249–253, etc.) y 4 dinámicos (L221, 234, 273, 278) | **PDF, NO cambia** | Sin relación con el tema |

### 8.3 Fuera de CSS/TSX

| Archivo | Valor | Clase | Riesgo |
|---|---|---|---|
| `index.html:7` | `<meta name="theme-color" content="#12324a">` | UI del navegador (PWA) | Estático: con tema oscuro la barra queda azul oscuro fija; decidir por tema o por `media` |
| `public/manifest.webmanifest:11–12` | `background_color #12324a`, `theme_color #12324a` | Splash e instalación | Igual que el anterior |
| `public/icons/icon.svg` | `fill #12324a`, `#c9a66b`, `#ff6b4a`, `#f4e3bd` | Icono (imagen) | Icono fijo; PNG `icon-192/512` no inspeccionados en píxeles |

### 8.4 ¿Se comparte `drawSection` entre el lienzo y el PDF?

No. `drawSection` (canvas 2D) lo usa solo `SectionCanvas`, en el modo «Casos de verificación» (`App.tsx:222`). El PDF usa `report/pdf.ts` con `report/content.ts` y no importa `drawSection`. `EditorCanvas.tsx` (SVG) tampoco lo importa. Lo que sí se comparte es `MATERIAL_COLORS` de `render/scene.ts` entre `EditorCanvas` y `drawSection`. Separación recomendada:

- Tema de UI: tokens CSS (`App.css:2–11`), con `[data-theme]` o `prefers-color-scheme` y `color-scheme`.
- Tema de lienzo: objeto `theme` pasado como prop a `EditorCanvas` y a `drawSection` (sus constantes `COLOR_*` pasan a ser del tema). No conviene `var()` dentro de atributos SVG `fill`/`stroke` sin probar en todos los navegadores.
- PDF: no lee el tema. Mantener `report/content.ts` como única fuente de la paleta del informe y hacer que `scene.ts` la importe o al revés (UX-15).

### 8.5 Riesgos

- SVG con `fill`/`stroke` fijos: ~47 líneas en `EditorCanvas.tsx` y 9 en `drawSection.ts`; la mayoría no pasa por CSS.
- Imágenes e iconos: `icon.svg` con colores fijos; PNG no revisados.
- `theme-color` y `background_color` de la PWA: `#12324a` fijo en `index.html:7` y `manifest:11–12`; con tema oscuro hay que decidir el valor por tema.
- `pwa/updatePrompt.ts`: estilo en línea; no hereda tokens.
- Focus y bordes: `#2563eb` en oscuro ≈ 3,4:1; el borde blanco de manejadores (`EditorCanvas.tsx:449, 475, 490`) pasa a ser invisible sobre fondo claro del tema oscuro si el lienzo no cambia.
- Forced colors: no hay `@media (forced-colors)`; el mínimo es usar `outline` y `border` con palabras clave de sistema.

## 9. Top 10 priorizado

1. **UX-03** Resultados sobre el pliegue (1440×900: panel en y=1064). Mostrar FS junto a «Comprobar» o en columna lateral fija. Impacto alto, esfuerzo M.
2. **UX-06** Contraste de `--muted` (4,39:1, serious en 7 vistas). `#4b5563`; definirlo también en el tema oscuro. Impacto alto, esfuerzo S.
3. **UX-04** Desbordes horizontales (75 px en 1024–1440; 224 px en 390; falla 1.4.10 a 320). `overflow-x` en la tabla, `flex-wrap` en la barra. Impacto alto, esfuerzo S.
4. **UX-01** Crear región o modelo desde cero (no posible en el lienzo). Herramienta «Nueva región» y plantilla vacía. Impacto alto, esfuerzo L.
5. **UX-07** Validar el CSV piezométrico (x estrictamente creciente) antes de importar. Impacto alto, esfuerzo S.
6. **UX-05** Área de acierto de 24×24 px en los manejadores de vértice (WCAG 2.5.8). Impacto medio-alto, esfuerzo S.
7. **UX-02** Añadir vértices con teclado (acción de insertar en la arista seleccionada). Impacto alto para accesibilidad, esfuerzo M.
8. **UX-12** Guía de primera visita y enlace de ayuda (3 pasos). Impacto medio-alto para estudiantes, esfuerzo M.
9. **UX-08 + UX-09** `<main>` en modo Editar y markup de avisos (`li` sin `role`); eliminan las violaciones de landmark (V1–V3) y de lista (V2–V5). Esfuerzo S.
10. **UX-13** Mensajes de error con valor actual, rango llano y ubicación (DXF/JSON). Esfuerzo S.

Siguiente en prioridad: UX-15 (paleta de material PDF vs pantalla, antes del tema oscuro), UX-10, UX-11, UX-14, UX-16 a UX-20.
