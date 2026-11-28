# XA4 · Especificación medida de la maqueta A «Flujo de trabajo»

- **Explorador:** XA4 (bloque UA, armazón A). Solo lectura: ningún archivo versionado editado; sin commit ni push.
- **Rama / worktree:** `ua-integracion` @ `807cf30` (`~/archivos/opengeoslide-wt/ua-int`).
- **Fuentes de diseño (lectura):** `~/archivos/geo-suite-design/` (`src/flujo.html`, `src/suite.css`, `src/ogs-mock.js`, `tokens/suite-tokens.css` v1.1, `sketches/v1-ogs-a-flujo/index.html`, `sketches/v1-sistema/index.html`, `docs/DISENO_B.md`, `README.md`).
- **Tokens de la app:** `~/archivos/opengeoslide-wt/ua-int/apps/web/src/styles/tokens.css`.
- **Desechables** (no en el repo): `~/.hermes/profiles/open-geoslide/cache/scratch/ua/XA4/` (tokmap.py, contrast.py, medidas `measure.json`, `diag.json`, `shots/`, paquetes npm de fuentes).

Convenciones: **[verificado]** = comando o `archivo:línea` con salida real; **[inferido]** = cálculo o lectura que no se ha medido en navegador.

**Advertencia de versión.** El sketch `sketches/v1-ogs-a-flujo/index.html` está congelado en v1 y **no coincide** con `src/` (v1.1 más retoques): difiere en `--gs-nok-text` (`#eb485d` frente a `#ee5a6c`), en `--gs-control-border` (no existe en el sketch) y en el borde de `.input` (`--gs-border-strong` frente a `--gs-control-border`) [verificado: diff de `src/flujo.html` + `suite.css` + `ogs-mock.js` generado con la misma lógica de `build.py` frente al sketch]. Las medidas de este informe salen de `src/suite.css` (v1.1). Las capturas 03–05 son del sketch v1 [inferido por fecha: sketch 15:37, capturas 16:10].

---

## 0. Resumen

- La maqueta A mide: cabecera 68 px, barra lateral 340 px, paso 53,5 px, pie 111 px, pestañas 40 px, paleta 60 × 509,1 px, HUD 330 px, barra de estado 30 px [verificado, medido en Chrome a 1440 × 900].
- Tiene **un** punto de corte (760 px). Entre 761 y 900 px (medido) la página hace scroll horizontal, y con alto < ~747 px la paleta queda recortada [verificado].
- Los tokens v1.1 y los de OpenGeoSlide comparten **nombres por función**, pero **casi ningún valor coincide** (excepto `--gs-accent-fg` claro (`#ffffff`) y `--ogs-mat-0` claro (`#d8b77a`)) [verificado].
- La marca SVG de OpenGeoSlide es idéntica en la maqueta y en la lámina, pero el icono PWA actual de la app es otro diseño [verificado].
- Outfit y JetBrains Mono están en npm en **5.3.0** (OFL-1.1). La maqueta pide Google Fonts; la app no puede hacerlo (PWA sin conexión) [verificado].

---

## 1. Marca SVG

Copia exacta de `src/flujo.html:97` [verificado]. Es byte a byte igual al de `sketches/v1-sistema/index.html:330` [verificado con comparación de cadenas]:

```html
<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect class="frame" x="1" y="1" width="30" height="30" rx="8"/><path class="g1" d="M5 23h6.5l9-11H27"/><path class="g1" d="M10.5 23Q21 23.5 23.5 12" stroke-dasharray="2.2 2.4" style="stroke-width:1.8"/></svg>
```

- Estilo (`src/suite.css:132-135`) [verificado]: `.brand-mark` 36 × 36 px (en el listado de la lámina, 64 × 64). `.frame`: relleno `--gs-accent-bg`, trazo `--gs-accent` de 1,5. `.g1`: sin relleno, trazo `--gs-accent-bright` de 2, extremos y uniones redondeados.
- El arco de falla usa `stroke-dasharray="2.2 2.4"` y `style="stroke-width:1.8"`. El estilo en línea gana a la clase, así que el arco sale en 1,8 y el resto en 2 [verificado: CSS en línea prevalece sobre la regla de clase].
- `aria-hidden="true"`: la marca no aporta nombre. El nombre lo da el texto «OpenGeoSlide» del lado (`flujo.html:98`).
- **Discrepancia [verificado]:** el icono PWA y favicon de la app es `apps/web/public/icons/icon.svg` (512 × 512, fondo `#12324a`, terreno `#c9a66b`, falla `#ff6b4a`). No es el marco de la suite. La lámina dice que «funciona igual como favicon e icono PWA» (`sketches/v1-sistema/index.html:354`). `index.html` de la app usa `icons/icon.svg` como favicon y `icon-192/512.png` en el manifiesto `apps/web/public/manifest.webmanifest`.

---

## 2. Medidas de la maqueta (px del CSS)

Las columnas «Medido» indican que el valor se leyó con `getBoundingClientRect` en Chrome (sketch con fuentes locales, ver §8). «CSS» indica que sale solo del CSS.

### 2.1 Cabecera (`.hdr`, `flujo.html:17-19`; `suite.css:132-157`)

| Pieza | Valor | Fuente | Medido |
|---|---|---|---|
| Alto de la fila de cabecera | 68 px (`--gs-header-h`) | `suite-tokens.css:104`, `flujo.html:16` | 68 (1440, 1280, 1024) |
| Padding / gap / borde | `0 20px 0 22px` · 14 px · 1 px `--gs-border` abajo | `flujo.html:17` | — |
| Marca | 36 × 36; gap a texto 12 px | `suite.css:132-133` | — |
| Nombre de app | 19 px / 600, lh 1,15, ls −0,01 em, nowrap | `suite.css:137` | — |
| Subtítulo | 12,5 px, `--gs-text-muted`, nowrap (oculto ≤ 760) | `suite.css:138`; `flujo.html:81-82` | — |
| Chip de estado | alto 24; padding 0 10 px; radio 999; 12 px / 500; punto 7 px; `role="status"` | `suite.css:160-169`; `flujo.html:100` | — |
| Botón | alto 32; padding 0 12 px; radio 8 px; 13 px / 500; gap 8 | `suite.css:141-147` | — |
| Botón icono | 32 × 32 | `suite.css:149` | — |
| Acciones | «Ayuda» (icono), «ES» (oculto ≤ 760), «Claro/Oscuro» (tema), «Archivo ▾», «Exportar» (oculto ≤ 760) | `flujo.html:103-107` | — |

### 2.2 Barra lateral «Modelo» (`aside.side`, `flujo.html:22-25, 47`)

| Pieza | Valor | Fuente | Medido |
|---|---|---|---|
| Ancho | 340 px (`--gs-sidebar-w`), columna fija; el borde derecho de 1 px cabe en esos 340 | `flujo.html:20`; `suite-tokens.css:105` | 340 |
| Grid de filas | `auto 1fr auto` (cabecera · lista · pie) | `flujo.html:22` | — |
| Cabecera | padding 18 px 16 px 10 px; h2 15 px / 600; botón «Contraer» 32 × 32 | `flujo.html:23-24` | ≈ 60 [inferido: 18 + 32 + 10] |
| Lista de pasos | `ol`, scroll propio; padding 4 10 12; gap 2 | `flujo.html:25` | — |
| Encabezado de paso | grid `30px 1fr 18px`; gap 12; padding 9 px 8 px; radio 8; hover `--gs-surface-hover` | `flujo.html:26-27` | **53,5** en los 7 pasos cerrados |
| Círculo de estado, hecho | 28 × 28; fondo `--gs-ok-text`; check en 15 px con trazo 2,6 | `flujo.html:28-30` | — |
| Círculo, opcional | 28 × 28; borde 1,5 px dashed `--gs-border-dashed`; número mono 12 / 600 en `--gs-text-muted` | `flujo.html:31` | — |
| Título de paso | 14,5 px / 600, lh 1,2 | `flujo.html:32` | — |
| Resumen | 12,5 px, `--gs-text-muted`, una línea con elipsis; ancho disponible ≈ 231 px | `flujo.html:33` | — [inferido: 303 − 72] |
| Chevron | 16 px; gira 180° con transición 0,15 s cuando está abierto | `flujo.html:34-35` | — |
| Cuerpo abierto | `display:none` si cerrado; abierto: padding 4 px 4 px 12 px 50 px; gap 10. El cuerpo queda a 10 + 50 = 60 px del borde de la lista, igual que el título (10 + 8 + 30 + 12 = 60) | `flujo.html:36-37` | — |
| Tarjeta de material | padding 12; gap 10; `.card`: radio 12, borde 1 px `--gs-border`, fondo `--gs-surface-raised` | `flujo.html:38`; `suite.css:172` | — |
| Campos (3 columnas) | grid 3 × 1fr, gap 8; etiqueta 12 px `--gs-text-2`, gap 4 | `flujo.html:43`; `suite.css:174-175` | — |
| Input | alto 32; padding 0 10 px; radio 8; borde 1 px `--gs-control-border`; fondo `--gs-surface-sunken`; mono 13 px | `suite.css:176-180` (v1.1) | — |
| Tabla de vértices | 12,5 px; th 11,5 px / 500 `--gs-text-muted`; celdas mono; padding 4 6 px | `flujo.html:44-46` | — |
| Pie de acción | padding 14 px 16 px 16 px; borde superior; gap 8 | `flujo.html:47` | **111** |
| Botón «Comprobar» | 40 px (`.btn.primary.lg.block`, 14 px); `<kbd>Ctrl ↵</kbd>` | `flujo.html:161`; `suite.css:155-156` | — |
| Fila de 2 | «Informe PDF» y «CSV»: 32 px, `grid 1fr 1fr`, gap 8 | `flujo.html:162`; `flujo.html:48` | — |

Nota: la lista de pasos tiene `overflow:auto`. No medí si desborda con un paso abierto.

### 2.3 Cabecera del área principal (`.main`, `flujo.html:51-55`)

| Pieza | Valor | Fuente | Medido |
|---|---|---|---|
| `.main-head` | padding 18 px 24 px 0; gap 10 | `flujo.html:52` | 102,8 de alto (68 → 170,8) |
| Título `h1` (vista activa) | 24 px / 600, ls −0,01 em; se cambia por JS (`data-title`) | `flujo.html:54`, `ogs-mock.js:141` | — |
| Deshacer / rehacer | botones icono 32 × 32; «Rehacer» deshabilitado | `flujo.html:171-172` | — |

### 2.4 Pestañas numeradas (`.tabs`, `flujo.html:174-179`; `suite.css:186-194`)

- Contenedor: flex, gap 4; borde inferior 1 px `--gs-border`.
- Pestaña (`.tab`): alto 40; padding 0 14 px; gap 8 (icono 16 + texto + contador); texto 14 px / 500 `--gs-text-2`; borde inferior 2 px transparente con `margin-bottom:-1px`. Activa: texto y borde en `--gs-accent-bright`.
- Contador (`.tab .n`): mono 11 px; 18 × 18; padding 0 5 px; radio 4; fondo `--gs-surface-muted`; texto `--gs-text-muted`.
- Orden y etiquetas (`flujo.html:175-178`): **1 Lienzo** · **2 Resultados** · **3 Casos de verificación** · **4 Informe**. Iconos: `canvas`, `table`, `shield`, `doc`.
- Anchos medidos a 1440 px [verificado]: Lienzo 118, Resultados 146, Casos de verificación 209, Informe 128 px.
- Suma de anchos a 1440 px: 601 + 3 gaps de 4 = 613 px [verificado por suma de lo medido]. Ancho mínimo de la barra de pestañas medido a 761 y 800 px: 554 px (la pestaña «Casos» se encoge a 150 px y su rótulo pasa a dos líneas) [verificado].
- Móvil ≤ 760: `.tabs` con `overflow-x:auto` y `scrollbar-width:none`; las pestañas no se encogen (`flex:none`). Medido a 390: clientWidth 362, scrollWidth 612 [verificado].

### 2.5 Tarjeta del lienzo (`.viewer`, `flujo.html:182`; `suite.css:222-223`; `flujo.html:58` para el borde)

- `.panelwrap`: padding 16 px 24 px 20 px; la tarjeta lleva borde 1 px `--gs-border` y radio 12.
- Fondo `--gs-viewer-bg`; `overflow:hidden`; el SVG (`svg.stage`) va absoluto a 100 %.
- Medido: a 1440 × 900 la tarjeta mide 1052 × 663,2; a 1280 × 800, 563; a 1024 × 768, 531 [verificado]. Relación: **alto de la tarjeta = alto de ventana − 237 px** (se cumple a 600, 700, 768, 800 y 900 px de alto) [verificado en cinco puntos].

#### Lienzo (SVG de `ogs-mock.js`, `draw()`)
- Ejes: x 15–75 m, y 15–42 m (`ogs-mock.js:57`). Escala: `min(ancho útil/60, alto útil/27)`.
- Márgenes: ancho ≥ 640 px → izq 70, der 120, sup 60, inf 70. Ancho < 640 → 40 / 24 / 30 / 50. **El umbral es del ancho del SVG, no de la ventana** (`ogs-mock.js:55-56`).
- Cuadrícula cada 5 m; las líneas de x o y múltiplo de 10 usan `--gs-viewer-grid-major` (`ogs-mock.js:64-66`).
- Rótulos de eje: mono 11 px `--gs-viewer-axis` (`suite.css:73`).
- Bandas de entrada y salida: trazo de 5 px con extremos redondeados, a 7 px sobre el terreno (`ogs-mock.js:74-75`).
- 26 dovelas, trazo 0,8 (`ogs-mock.js:77-81`).
- Superficie crítica: trazo 2,6, `--ogs-crit` (`ogs-mock.js:85`).
- Etiqueta de FS: rectángulo 108 × 20, radio 4; texto mono 11,5 / 600 en `--ogs-crit`. **El texto «FS mín. 0,984» va fijo en el JS** (`ogs-mock.js:87`).
- Tiradores: círculo de radio 5,5, relleno `--ogs-handle-fill`, borde 1,6 `--ogs-handle-ring` (`ogs-mock.js:89`).
- El color de cada elemento va como `style="fill:var(--…)"`, así que el cambio de tema **no necesita redibujar** (`ogs-mock.js:65-89`) [verificado].

### 2.6 Paleta flotante (`nav.palette`, `flujo.html:195-208`; `suite.css:196-220`)

| Pieza | Valor | Medido |
|---|---|---|
| Posición | `right:16px`; centrada en vertical (`top:50%`, `translateY(-50%)`); `z-index:3` | x 1339–1399 (dentro de la tarjeta) |
| Caja | ancho 60; padding 10 px 8 px; gap 6; radio 14; borde 1 px `--gs-border-strong`; sombra `--gs-shadow-float` | **60 × 509,1** |
| Rótulo «Herram.» / «Vista» | 9 px, ls 0,1 em, centrado, margen 2 px 0 | — |
| Separador | 1 px `--gs-border-strong`, margen 4 px 2 px | — |
| Botón | 42 × 42; radio 10; icono 18 px; borde 1 px `--gs-border-strong`; **fondo `--gs-surface`** (no el de capa); hover `--gs-surface-hover` | 42 (cabe justo: 60 − 16 − 2) |
| Botón activo (`aria-pressed=true`) | fondo y borde `--gs-accent`; icono `--gs-accent-fg` | — |
| Deshabilitado | opacidad 0,4 | — |
| Tooltip | `span` absoluto a la izquierda (`right: calc(100% + 10px)`); fondo `--gs-text` invertido; 12 px; padding 4 × 8; radio 6; `kbd` con margen 6; aparece con `:hover` o `:focus-visible` | — |

- Grupo «Herram.»: Seleccionar (V), Agregar vértice (A), Dibujar región (R), Dividir región (D), Dibujar refuerzo (F), Mover vista (H) — `aria-pressed`, un solo activo (`ogs-mock.js:121-125`).
- Grupo «Vista»: Acercar (+), Alejar (−), Encuadrar (0). Sin `aria-pressed` (son acciones).
- En móvil (≤ 760) la paleta es una fila: `position:static`, `flex-wrap`, 40 × 40, sin rótulos, sin separador, sin botones de zoom y sin tooltip (`suite.css:265-271`). Medido a 390: 336 × 54 [verificado].
- **Alto de la paleta frente a la tarjeta** [verificado]: a 700 px de alto, la tarjeta mide 463 px y la paleta 509 px. La paleta queda recortada por `overflow:hidden` de la tarjeta, arriba y abajo. Con 800 px de alto, la tarjeta mide 563 y cabe. La altura mínima de ventana es **≈ 747 px** (= 509,1 + 237).

### 2.7 HUD de resultado (`section.hud`, `flujo.html:184-194`; `suite.css:232-255`)

| Pieza | Valor | Medido |
|---|---|---|
| Posición | `left:16px; top:16px` respecto a la tarjeta; `z-index:2` | x 381 / y 203,8 (a 1440) |
| Caja | ancho 330; padding 14 16 12; radio 12; borde 1 px `--gs-border-strong`; sombra flotante; transición de opacidad 0,2 s | **330 × 223,8** |
| Eyebrow | «Factor de seguridad mínimo» (`.eyebrow`, 11 px / 600, mayúsculas, ls 0,08 em) | — |
| Cifra | `.fs-big`: mono 40 px / 600, ls −0,02 em, lh 1; tono `--gs-nok-text` | — |
| Metadato | «Spencer · M-P», 12 px, `--gs-text-muted` | — |
| Chip | «FS < 1,0», tono nok | — |
| Barra FS mínimo | `.bar`: **`display:none`** (`suite.css:251`); está en el HTML pero no se muestra | — |
| Métodos | lista `grid 1fr auto auto`; gap 10; 13 px; padding 3 px 0; borde superior 1 px; **Bishop simplificado 0,985 · Spencer 0,984 · Morgenstern-Price 0,984 · Janbu corregido 0,986**; el mínimo en negrita 600 | — |
| Estado «obsoleto» | `.hud.stale`: cifra y FS de método en `--gs-text-muted` y tachado de 1 px | — |
| Estado «ocupado» | `.hud.busy`: opacidad 0,55 | — |
| Móvil ≤ 760 | `position:static`; ancho auto; margen 10 px 12 px; sin sombra | 336 × 223,8 a 390 |

### 2.8 Leyenda (`.legend`, `flujo.html:209`; `suite.css:225-230`)

- `left:16px; bottom:14px`; flex con wrap; gap 6 px 14 px; texto 12 px `--gs-text-2`; padding 7 px 10 px; radio 8; fondo `color-mix(surface-raised 88 %)`; borde 1 px `--gs-border`. Sin desenfoque.
- Muestras: 14 × 10, radio 2, margen derecho 6; la de «Superficie crítica» es una raya de 3 px.
- Elementos: Soil, Superficie crítica, Dovelas, Entrada, Salida.
- Medido a 1440: 404,6 × 33,4, a ~14 px del borde inferior de la tarjeta [verificado]. Oculta ≤ 760.

### 2.9 Barra de estado inferior (`footer.status`, `flujo.html:255-261`; `flujo.html:68-71`)

- Fila de 30 px (`grid-template-rows: … 30px`). Medido: 30 px a 1440, 1280, 1024; 101,2 px a 390 (se apila en ≤ 760) [verificado].
- Padding 0 16 px; gap 18; borde superior 1 px; 12 px `--gs-text-muted`; fondo `--gs-surface`.
- Contenido, de izquierda a derecha: «Ejemplo: **ACADS 1(a)** · archivo sin cambios» (`data-file-state`) · «Herramienta: **Seleccionar**» (`data-tool-name`) · espacio · coordenadas en mono «x — · y —» (`data-coords`; se rellenan con el puntero, `ogs-mock.js:98-104`) · «**ogs-core 0.4.0 · WASM**» con punto de 7 px en `--gs-ok-text`.

### 2.10 Puntos de corte y orden en móvil

- **Un solo punto de corte CSS: `max-width: 760px`** (`suite.css:260`, `flujo.html:78`). En la maqueta no hay escalón intermedio.
- Con ≥ 761 px, la barra lateral mide 340 px siempre, incluso a 761 px de ancho [verificado: side 340 a 761 px].
- Orden en ≤ 760 [verificado]: cabecera (99 px a 390) → cabecera del área y pestañas → **lienzo** (300 px de SVG + HUD + paleta) → **Modelo** (`aside` con `order:2`) → pie «Comprobar / Informe PDF / CSV» (y = 1468 a 390) → barra de estado (y = 1579, alto 101).
- La página mide **1681 px** de alto a 390 px de ancho. No hay pie fijo (`position: sticky`) [verificado: scrollH 1681; el pie no lleva sticky].
- Objetivos de clic [verificado con `getBoundingClientRect`]: a 390 px, **9 de 28** controles miden 32 px de alto (Ayuda, tema, Archivo, Contraer, + Nuevo material, Informe PDF, CSV, Deshacer, Rehacer). A 1440, 11 de 32 miden 32 (incluye ES y Exportar). Ninguno mide menos de 24 px.

---

## 3. Tabla de equivalencias de tokens

Método: `~/.hermes/profiles/open-geoslide/cache/scratch/ua/XA4/tokmap.py` lee los dos archivos y saca los valores de cada bloque (oscuro = `:root,[data-theme="dark"]` de `suite-tokens.css:11-57`; claro = `[data-theme="light"]` de `suite-tokens.css:59-96`; OGS claro = `:root` de `tokens.css:13-92`; OGS oscuro = `@media (prefers-color-scheme: dark)` de `tokens.css:94-158`). Los tipos de equivalencia son juicio mío, sobre el nombre y la función; **los valores son [verificado]**.

Tipo: **equivalente** = mismo papel y nombre semántico (los valores pueden diferir); **parcial** = papel cercano con matices; **sin equivalente** = no hay par en OGS.

### 3.1 Tokens de color (`--gs-*` y `--ogs-*`)

| Token (v1.1) | Oscuro | Claro | Par en OGS (`tokens.css`) | OGS oscuro | OGS claro | Tipo | Nota |
|---|---|---|---|---|---|---|---|
| `--gs-surface` | `#0a0a0b` | `#eceef1` | `--ui-bg` | `#0b111b` | `#f3f4f6` | equivalente | Fondo de la app. Oscuro distinto (`#0a0a0b` frente a `#0b111b`). |
| `--gs-surface-raised` | `#101011` | `#f6f7f9` | `--ui-surface` | `#131c2b` | `#ffffff` | equivalente | Tarjetas y capas flotantes. |
| `--gs-surface-muted` | `#18181b` | `#e1e5ea` | `--ui-surface-subtle` | `#1b2638` | `#f8fafc` | parcial | Pista, chip neutro, contador de pestaña. OGS: «subtle». |
| `--gs-surface-sunken` | `#060607` | `#e4e7eb` | sin equivalente | — | — | sin equivalente | Fondo de campos (`.input`). Sin par. |
| `--gs-surface-hover` | `#1d1d21` | `#dde2e8` | `--ui-surface-hover` | `#233147` | `#eef2f7` | equivalente |  |
| `--gs-border` | `#1d1d20` | `#d3d9e0` | `--ui-border` | `#334155` | `#cbd5e1` | equivalente |  |
| `--gs-border-strong` | `rgb(255 255 255 / 0.09)` | `#c5ccd5` | sin equivalente | — | — | sin equivalente | Borde de botones y capas flotantes, con alfa. OGS no tiene borde con alfa. |
| `--gs-border-dashed` | `rgb(255 255 255 / 0.14)` | `#a3adb9` | sin equivalente | — | — | sin equivalente | Círculo de paso opcional. |
| `--gs-control-border` | `#5b6673` | `#737d8a` | `--ui-control-border` | `#7d8ba1` | `#64748b` | equivalente | Borde de campos (≥ 3:1). Valores distintos: revisar con `tokens.contrast`. |
| `--gs-text` | `#e6e9ee` | `#1f2933` | `--ui-ink` | `#f1f5f9` | `#111827` | equivalente |  |
| `--gs-text-2` | `#b3bcc8` | `#46525f` | sin equivalente | — | — | sin equivalente | Texto secundario. OGS tiene solo dos niveles (ink, ink-muted). |
| `--gs-text-muted` | `#8f9aa8` | `#5b6673` | `--ui-ink-muted` | `#a3b1c6` | `#4b5563` | equivalente |  |
| `--gs-accent` | `#2c77c3` | `#2f6da8` | `--ui-accent` | `#60a5fa` | `#1f4e79` | equivalente | Botón primario y herramienta activa. En oscuro, OGS usa un azul más claro. |
| `--gs-accent-fg` | `#ffffff` | `#ffffff` | `--ui-ink-on-accent` | `#0b111b` | `#ffffff` | equivalente | Texto sobre acento. En oscuro, OGS usa texto oscuro sobre acento claro. |
| `--gs-accent-bright` | `#6db3f2` | `#275d91` | `--ui-focus` | `#60a5fa` | `#1d4ed8` | parcial | Foco y pestaña activa. OGS: `--ui-focus` (solo foco); sin par para texto activo. |
| `--gs-accent-bg` | `rgb(109 179 242 / 0.12)` | `rgb(47 109 168 / 0.10)` | `--ui-surface-active` | `#1e3a5f` | `#dbeafe` | parcial | Alfa en la suite; OGS usa color opaco. |
| `--gs-ok-bg` | `rgb(57 171 96 / 0.12)` | `#e3f1e8` | `--ui-ok-bg` | `#052e16` | `#dcfce7` | equivalente |  |
| `--gs-ok-text` | `#39ab60` | `#1d6b3f` | `--ui-ok-ink` | `#86efac` | `#14532d` | equivalente |  |
| `--gs-ok-border` | `#39ab60` | `#b9dcc6` | `--ui-ok-border` | `#22c55e` | `#15803d` | equivalente |  |
| `--gs-warn-bg` | `rgb(230 143 25 / 0.12)` | `#f6ecd9` | `--ui-warn-bg` | `#3b2304` | `#fef3c7` | equivalente |  |
| `--gs-warn-text` | `#e68f19` | `#8a5a12` | `--ui-warn-ink` | `#fcd34d` | `#78350f` | equivalente |  |
| `--gs-warn-border` | `#e68f19` | `#e6cf9f` | `--ui-warn-border` | `#f59e0b` | `#d97706` | equivalente |  |
| `--gs-nok-bg` | `rgb(232 49 73 / 0.12)` | `#f5e1e1` | `--ui-err-bg` | `#3f0d12` | `#fee2e2` | equivalente |  |
| `--gs-nok-text` | `#ee5a6c` | `#9b2c2c` | `--ui-err-ink` | `#fca5a5` | `#7f1d1d` | equivalente | v1.1: `#ee5a6c` en oscuro. |
| `--gs-nok-border` | `#e83149` | `#e5bcbc` | `--ui-err-border` | `#f87171` | `#b91c1c` | equivalente |  |
| `--gs-info-bg` | `rgb(118 147 183 / 0.12)` | `#ebe8f3` | `--ui-info-bg` | `#082f49` | `#e0f2fe` | equivalente | Matiz distinto: gris violáceo en la suite, azul cielo en OGS. |
| `--gs-info-text` | `#92a9c7` | `#4f3f80` | `--ui-info-ink` | `#7dd3fc` | `#0c4a6e` | equivalente | Matiz distinto (ver fila anterior). |
| `--gs-info-border` | `#7693b7` | `#d2cbe6` | sin equivalente | — | — | sin equivalente | Sin par. |
| `--gs-viewer-bg` | `#060607` | `#f6f7f9` | `--canvas-bg` | `#0f172a` | `#ffffff` | equivalente |  |
| `--gs-viewer-grid` | `#17171a` | `#e6e9ed` | `--canvas-grid` | `#1e293b` | `#e2e8f0` | equivalente |  |
| `--gs-viewer-grid-major` | `#232328` | `#d3d9e0` | sin equivalente | — | — | sin equivalente | Sin par: OGS tiene una sola cuadrícula. |
| `--gs-viewer-axis` | `#8f9aa8` | `#5b6673` | `--canvas-axis` | `#cbd5e1` | `#334155` | parcial | Eje → `--canvas-axis`; rótulos → `--canvas-axis-text` (sin par en la suite). |
| `--ogs-mat-0` | `#7d6a4a` | `#d8b77a` | `--canvas-mat-0` | `#6b5630` | `#d8b77a` | equivalente | Claro igual (`#d8b77a`); oscuro distinto. |
| `--ogs-mat-edge` | `#d9dee5` | `#1f2933` | `--canvas-region-edge` | `#e2e8f0` | `#1f2937` | parcial | Borde del material; OGS `--canvas-region-edge` (claro `#1f2937` frente a `#1f2933`). |
| `--ogs-crit` | `#ff5a6e` | `#b42318` | `--canvas-surface` | `#fca5a5` | `#a31515` | parcial | Superficie crítica. OGS distingue «surface» y «surface-unconverged». |
| `--ogs-slice-fill` | `rgb(255 255 255 / 0.05)` | `rgb(31 41 51 / 0.06)` | `--canvas-slice-fill` | `rgb(203 213 225 / 0.16)` | `rgb(71 85 105 / 0.16)` | equivalente |  |
| `--ogs-slice-edge` | `rgb(255 255 255 / 0.22)` | `rgb(31 41 51 / 0.45)` | `--canvas-slice-edge` | `rgb(226 232 240 / 0.7)` | `rgb(30 41 59 / 0.65)` | equivalente |  |
| `--ogs-handle-fill` | `#0a0a0b` | `#ffffff` | `--canvas-handle-fill` | `#0f172a` | `#ffffff` | equivalente |  |
| `--ogs-handle-ring` | `#e6e9ee` | `#1f2933` | `--canvas-handle-ring` | `#f8fafc` | `#1f2937` | equivalente |  |
| `--ogs-band-entry` | `rgb(57 171 96 / 0.55)` | `rgb(29 107 63 / 0.45)` | `--canvas-band-entry` | `rgb(74 222 128 / 0.35)` | `rgb(22 163 74 / 0.35)` | equivalente |  |
| `--ogs-band-exit` | `rgb(230 143 25 / 0.55)` | `rgb(138 90 18 / 0.45)` | `--canvas-band-exit` | `rgb(251 146 60 / 0.35)` | `rgb(234 88 12 / 0.35)` | equivalente |  |

### 3.2 Tokens que no son color (sin par en `tokens.css`)

| Token (v1.1) | Valor (`:root`) | Par en OGS |
|---|---|---|
| `--gs-font-sans` | `'Outfit', 'Inter', system-ui, -apple-system, sans-serif` | OGS: `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` (`App.css:4`). Sin fuente propia. |
| `--gs-font-mono` | `'JetBrains Mono', 'Fira Code', ui-monospace, monospace` | OGS: sin fuente mono. |
| `--gs-radius-sm` | `4px` | sin par (medida, no color) |
| `--gs-radius-md` | `8px` | sin par (medida, no color) |
| `--gs-radius-lg` | `12px` | sin par (medida, no color) |
| `--gs-header-h` | `68px` | sin par (medida, no color) |
| `--gs-sidebar-w` | `340px` | sin par (medida, no color) |
| `--gs-shadow-float` | `0 12px 36px rgb(0 0 0 / 0.6)` | OGS: 4 `box-shadow` literales (`App.css:632, 923, 1118, 1142`), no tokens. |

### 3.3 Nombres de OpenGeoSlide sin par en la suite [verificado]

- **`--canvas-*`** (19): `--canvas-axis-text`, `--canvas-halo`, `--canvas-handle-sel`, `--canvas-handle-snap`, `--canvas-load`, `--canvas-mat-1`, `--canvas-mat-2`, `--canvas-mat-3`, `--canvas-mat-4`, `--canvas-mat-5`, `--canvas-mat-6`, `--canvas-mat-unknown`, `--canvas-piezo`, `--canvas-pond`, `--canvas-reinforcement`, `--canvas-seismic`, `--canvas-seismic-bg`, `--canvas-selected`, `--canvas-surface-unconverged`
- **`--ui-*`** (7): `--ui-accent-hover`, `--ui-backdrop`, `--ui-input-err-bg`, `--ui-note-bg`, `--ui-note-ink`, `--ui-row-selected`, `--ui-row-warn`

### 3.4 Contraste de los pares que usa la maqueta [verificado: cálculo WCAG 2.x con `contrast.py`]

| Par | Contraste | Mínimo |
|---|---|---|
| Suite oscuro · texto secundario `#b3bcc8` sobre `#101011` (tarjeta) | 9,91:1 | ≥ 4,5 |
| Suite oscuro · texto atenuado `#8f9aa8` sobre `#101011` | 6,66:1 | ≥ 4,5 |
| Suite oscuro · botón primario: `#ffffff` sobre `#2c77c3` | 4,63:1 | ≥ 4,5 (DISENO_B: 4,63) |
| Suite oscuro · chip falla: `#ee5a6c` sobre `#0a0a0b` | 5,95:1 | ≥ 4,5 |
| Suite oscuro · borde de campo `#5b6673` sobre `#060607` (sunken) | 3,47:1 | ≥ 3 (no texto) |
| Suite claro · texto activo `#275d91` sobre `#f6f7f9` | 6,40:1 | ≥ 4,5 |
| OGS oscuro · texto atenuado `#a3b1c6` sobre `#131c2b` | 7,86:1 | ≥ 4,5 |
| OGS oscuro · botón primario `#0b111b` sobre `#60a5fa` | 7,44:1 | ≥ 4,5 |
| OGS oscuro · error `#fca5a5` sobre `#3f0d12` | 8,66:1 | ≥ 4,5 |
| OGS claro · botón primario `#ffffff` sobre `#1f4e79` | 8,66:1 | ≥ 4,5 |

Lectura: el texto secundario y el acento de texto de la suite cumplen 4,5:1. El botón primario de la suite (4,63:1) reproduce la cifra de `DISENO_B.md §4.2`. Con los valores de OGS, el botón primario oscuro sale 7,44:1 (texto oscuro sobre `#60a5fa`). **Cambiar a valores de la suite obliga a repetir `tokens.contrast.test.ts`** [inferido: el test no se ha leído en esta exploración, ver XA3].

---

## 4. Fuentes

### 4.1 Versiones y licencia [verificado: `npm view`]

| Paquete | Versión actual | Licencia | Nota |
|---|---|---|---|
| `@fontsource/outfit` | **5.3.0** | OFL-1.1 | estático, un archivo por peso y subconjunto |
| `@fontsource/jetbrains-mono` | **5.3.0** | OFL-1.1 | estático; trae también greco, cirílico y vietnamita |
| `@fontsource-variable/outfit` | **5.3.0** | OFL-1.1 | variable (`wght` 100–900) |
| `@fontsource-variable/jetbrains-mono` | **5.3.0** | OFL-1.1 | variable (`wght` 100–800) |

Las licencias vienen en el paquete (`LICENSE`). Hay que incluirlas en la distribución [inferido de OFL-1.1, cláusula de distribución].

### 4.2 Pesos que usa la maqueta [verificado: `grep` sobre `flujo.html` y `suite.css`]

- **Outfit:** 400 (texto por defecto, sin declarar), **500** (botones, pestañas, `.chip`, `.btn`, `.tab`) y **600** (títulos, `.step-title`, `.badge`, `.brand-name`, `.mat-head b`). **700 no se usa**: el enlace de Google Fonts de la maqueta lo pide, pero no hay nada que lo consuma. Es peso que se puede omitir.
- **JetBrains Mono:** **400** (predeterminado en `.mono`, `kbd`, `.input`, `.tab .n`, celdas `td`) y **600** (`.fs-big`, `.m-fs`). **500 no se usa.**

### 4.3 Subconjuntos y tamaños (woff2) [verificado: `stat` sobre los paquetes descargados]

| Archivo | Bytes |
|---|---|
| `outfit-latin-{400,500,600}-normal.woff2` | 14 032 · 13 528 · 14 140 |
| `outfit-latin-ext-{400,500,600}-normal.woff2` | 6 380 · 6 244 · 6 528 |
| `jetbrains-mono-latin-{400,600}-normal.woff2` | 21 168 · 21 860 |
| `jetbrains-mono-latin-ext-{400,600}-normal.woff2` | 7 336 · 7 512 |
| `jetbrains-mono-greek-{400,600}-normal.woff2` | 4 228 · 4 308 |
| `outfit-latin-wght-normal.woff2` (variable) | 32 292 |
| `outfit-latin-ext-wght-normal.woff2` (variable) | 14 808 |
| `jetbrains-mono-latin-wght-normal.woff2` (variable) | 40 404 |
| `jetbrains-mono-latin-ext-wght-normal.woff2` (variable) | 15 196 |

Totales [verificado por suma]:
- **Estático, pesos de la maqueta, latin + latin-ext:** 41 700 + 19 152 + 43 028 + 14 848 = **118 728 bytes** (≈ 116 KiB). Solo latin: 84 728 bytes.
- **Variable, latin + latin-ext:** 32 292 + 14 808 + 40 404 + 15 196 = **102 700 bytes** (≈ 100 KiB). Solo latin: 72 696 bytes.
- Recomendación: **variable**, porque pesa menos (−16 KiB) y da todos los pesos. Solo latin basta para español; latin-ext solo cubre otros idiomas de Europa del Este.

### 4.4 Cobertura de glifos [verificado: `fontTools` sobre los woff2]

Caracteres no ASCII que aparecen en texto visible de `flujo.html`: `° ² ³ · º × á é í ó ú − — … « » ′ ⁵ ⁻ γ λ φ ↵ ▾ ✓`.

- **Outfit latin (400 y 600):** le faltan **γ λ φ ′ ⁵ ⁻ ↵ ▾ ✓**. No tiene `′` (U+2032): «c′» y «φ′» caen a la fuente del sistema. Sí tiene `−`, `²`, `³`, `°`, `·`, `×` y las letras acentuadas.
- **JetBrains Mono latin (400 y 600):** le faltan **γ λ φ ⁵ ⁻ ↵ ▾ ✓**. Sí tiene `′`.
- **JetBrains Mono greek (400):** cubre γ λ φ; no cubre el resto.
- **Outfit no tiene subconjunto griego en 5.3.0** (no existe `outfit-greek-*`) [verificado: `ls` del paquete].
- **Conclusión:** en Outfit, «γ (kN/m³)» (`flujo.html:131`) caería a la fuente del sistema; también el `′` de «c′ (kPa)» y «φ′ (°)» (`flujo.html:132-133`), que JetBrains Mono sí cubre si está en la pila. El `⁵ ⁻` de «1·10⁻⁵» (`flujo.html:149`) no lo cubre ninguna de las dos. Hay que decidir: (a) añadir JetBrains Mono como respaldo en la pila de `--gs-font-sans` (`'Outfit', 'JetBrains Mono', system-ui, …`) para γ, λ y φ; o (b) sustituir los glifos. `⁵ ⁻`, `↵ ▾ ✓` no los cubre ninguna de las dos; `✓` y `▾` deberían ser SVG (DISENO_B §2.8).

### 4.5 Cómo se importan en Vite (método, no probado en build) [inferido]

- Opción recomendada: `import '@fontsource-variable/outfit';` y `import '@fontsource-variable/jetbrains-mono';` en `apps/web/src/main.tsx` o en `src/styles/fonts.css`.
- **Atención al nombre de familia:** los paquetes `-variable` declaran `font-family: 'Outfit Variable'` y `'JetBrains Mono Variable'` [verificado: `index.css` del paquete]. La pila debe usar ese nombre, no `'Outfit'`. Los paquetes estáticos sí declaran `'Outfit'` y `'JetBrains Mono'` [verificado: `latin-400.css`].
- Vite reescribe las `url(./files/…)` del CSS importado y emite los woff2 con hash en `dist/assets/`. Ese fichero no entra en `public/`.
- **Precarga offline** [verificado: `apps/web/build/pwa-plugin.ts:9` (exclusión) y `:32-39` (lista = todo `dist/` filtrado)]: el precache lista todo `dist/` salvo `sw.js`, mapas y `fonts/`. Lo que está en `public/fonts/` **no** se precachea (la excepción es para el PDF, `public/fonts/README.md`). Por tanto, las fuentes deben entrar por `src/` (import) para quedar en la precarga, y no en `public/fonts/`.
- **La maqueta no es copiable tal cual:** `flujo.html:8-10` pide `fonts.googleapis.com` y `fonts.gstatic.com`. La app no lo puede hacer: sin conexión la PWA no carga la fuente, y la suite ya lo prohíbe para SimRocas (`README.md`, §«Cómo la adopta cada app», y `DISENO_B.md` anexo A.8, CSP `default-src 'self'`).
- CSP de la app: **no hay** meta CSP en `index.html` ni en `apps/web` (la única mención es una prueba que lo afirma, `apps/web/src/theme/theme.test.ts:324`) [verificado].

---

## 5. DISENO_B.md aplicable a A

Leyenda: **Aplica** · **Aplica con cambios** (adaptación explícita) · **No aplica** (es de B).

### 5.1 §2 Principios

| Nº | Principio | Para A |
|---|---|---|
| 1 | Manda el visor | **Aplica con cambios:** en A el visor es una pestaña; HUD y paleta sí flotan sobre él. Con 800 px de alto la paleta se recorta (§2.6). |
| 2 | Acción primaria siempre visible | **Aplica:** «Comprobar» va en el pie fijo del grid, visible en escritorio. En móvil no es fijo (§2.10). |
| 3 | Resumen y después detalle | **Aplica:** `step-sub` (una línea con elipsis). |
| 4 | Estado siempre visible | **Aplica:** chip de cabecera + «Resultados desactualizados» (`ogs-mock.js:145-153`). |
| 5 | Superficies mate | **Aplica:** sin brillo ni degradado. Sombra solo en HUD y paleta (`suite.css:45`, `:200`, `:233-236`). |
| 6 | Un solo acento | **Aplica:** pero la barra de estado pinta «ogs-core» en `--gs-ok-text` (`flujo.html:71`). Es estado, así que no contradice el principio. |
| 7 | Cifras en mono con unidad | **Aplica:** el FS va sin unidad (adimensional). Las coordenadas llevan «m». |
| 8 | Sin emojis ni dingbats como iconos | **Aplica, con dos excepciones de texto:** `✓` en el informe (`flujo.html:247`), `▾` en «Archivo ▾» (`flujo.html:106`) y `↵` en la `kbd` (`flujo.html:161`). Son glifos de texto y no iconos, pero el espíritu del principio pide SVG. |

### 5.2 §4 Tokens

| Sección | Para A |
|---|---|
| §4.1 tabla de tokens | **Aplica** (es la lista v1.1). Las filas de estados y de visor están en §3 de este informe. |
| §4.2 contraste medido | **Aplica con cambios:** los valores son los de la suite. No valen para OGS, que tiene otros valores (§3.4). |
| §4.3 tokens de dominio | **Aplica:** `--ogs-*` en un bloque propio. La regla «en el HTML no hay colores literales» se cumple en `flujo.html` y `ogs-mock.js` (grep sin resultados) [verificado]. |

### 5.3 §5 Tipografía: discrepancias con `suite.css`

| Uso | DISENO_B §5 | `suite.css` (maqueta A) | Nota |
|---|---|---|---|
| Texto de interfaz | Outfit 13 / 400 | `body` 14 px (`suite.css:116`) | **Diferente** |
| Encabezado de sección / paso | 13,5 / 600 | `.step-title` 14,5 / 600 (`flujo.html:32`) | **Diferente** |
| Resumen de sección | 12 / 400, atenuado | `.step-sub` 12,5 (`flujo.html:33`) | **Diferente** |
| Etiqueta de campo | 12,5 / 400, secundario | `.field label` 12 (`suite.css:175`) | **Diferente** |
| Eyebrow | 11 / 600, mayúsculas, +0,08 em | 11 / 600, +0,08 em (`suite.css:173`) | Igual |
| Cifra principal del HUD | JetBrains 34 / 600 | `.fs-big` 40 / 600 (`suite.css:240`) | **Diferente** (la maqueta es más grande) |
| Título de vista | — | `h1` 24 / 600 (`flujo.html:54`) | Solo A |
| Nombre de app | 16 / 600 (B) | `.brand-name` 19 / 600 (`suite.css:137`) | Diferente; B lo usa en la barra lateral |

Como §5 aplica a A (§0 del DISENO_B, «tipografía (§5)»), hay que decidir qué manda. Ver dudas.

### 5.4 §6 Componentes

| Sección | Aplica a A | Nota |
|---|---|---|
| §6.1 cabecera de barra lateral (56 px, marca 28) | **No aplica** | A usa la cabecera común de 68 px con marca 36. |
| §6.2 acordeón (`aria-expanded` + `aria-controls`, resumen, cuerpo) | **Aplica con cambios** | La maqueta tiene `aria-expanded` pero **no** `aria-controls` [verificado: `grep` = 0]. Acordeón de una sola sección abierta (`data-accordion-single`, `ogs-mock.js:131`). |
| §6.3 fila de campo (`1fr 112px`, alto 30) | **Aplica con cambios** | A usa etiqueta encima y campo de 32 px (`suite.css:177`). La regla de 30 px es de B. |
| §6.4 segmentados, chips de preset, interruptores | **Aplica con cambios** | A no tiene segmentados. Sí usa chips de estado. |
| §6.5 pie de acción | **Aplica con cambios** | Falta el aviso «Hay cambios sin simular» en el pie (el estado solo aparece en la cabecera). |
| §6.6 barra superior flotante | **No aplica** | Es de B. |
| §6.7 HUD | **Aplica con cambios** | Falta «Ver panel» (en A la vista es una pestaña). Estados «desactualizado» y «ocupado» sí están. |
| §6.8 paleta de herramientas | **Aplica** | Grupos «Herram.» y «Vista», sin acción primaria. Los tooltips citan teclas que la maqueta no implementa (§5.6). |
| §6.9 línea de tiempo | **No aplica** | A no tiene fotogramas. |
| §6.10 leyenda y coordenadas | **Aplica con cambios** | Las coordenadas van a la barra de estado (no sobre el visor). |
| §6.11 panel de resultados (diálogo, pantalla completa) | **Aplica con cambios** | A usa la pestaña «Resultados» y «Casos de verificación», no un diálogo. D1 lo fija así. |
| §6.12 tooltip único `position:fixed` | **Aplica con cambios** | La maqueta usa un `span` por botón. El tooltip de DISENO_B es un nodo único. Decidir. |

### 5.5 §7 Estados de la corrida

A tiene su propia lista: `Calculado · FS < 1,0` (nok) · `Resultados desactualizados` (warn) · `Calculando 4 métodos…` (accent, 1,3 s con spinner) · `archivo sin cambios` / `cambios sin guardar`.

- **Faltan** de §7 los estados: Sin perfil (botón deshabilitado con tooltip), Listo para calcular, Parcial (en A, un método sin convergencia en la tabla de resultados) y Error (≤ 60 caracteres).
- «Calculando» baja el HUD a opacidad 0,55 (`hud.busy`) y deshabilita el botón, como pide §7 [verificado: `ogs-mock.js:154-164`].

### 5.6 §9 Teclado

- La maqueta **no tiene ningún manejador `keydown`** [verificado: 0 coincidencias en `ogs-mock.js` y `flujo.html`]. Los tooltips anuncian V, A, R, D, F, H, +, −, 0, y «Ctrl ↵» en el botón. Sin implementar, los atajos de las etiquetas son falsos.
- §9 da una tabla de atajos para B. Para A, aplican los que ya existen en la app o los que se decidan (duda 9).

### 5.7 §10 Pantallas

- **No aplica** la tabla de B (1280 / 1100 / 761 / 760). A tiene un solo corte (760) (§2.10). Hace falta decidir el escalón intermedio (duda 7).
- **Sí aplica** la regla de «Los botones miden ≥ 40 px» en móvil: incumplida por 9 botones (§2.10).

### 5.8 §11 Accesibilidad

| Regla | Estado en la maqueta |
|---|---|
| Contraste (§4.2) | Aplica. Ver §3.4. |
| Foco visible: 2 px `--gs-accent-bright`, offset 2 px | **Cumple**: `suite.css:124-128` [verificado]. |
| Nombre accesible en todo botón | **Cumple** casi todo. Los botones de la paleta toman el nombre del texto del tooltip (p. ej. «Seleccionar V»). Funciona, pero depende de un `span` oculto por opacidad. |
| Roles: acordeón (`aria-expanded`, `aria-controls`) | **Incumple** `aria-controls` [verificado]. |
| Roles: paleta (`aria-pressed`) | Cumple en las 6 herramientas. |
| Roles: chip de estado (`role="status"`) | Cumple (`flujo.html:100`). |
| Pestañas | `role="tablist"`/`tab` sí; **no** hay `tabpanel` ni `aria-controls` [verificado: 0 coincidencias]. Tampoco hay navegación con flechas. |
| Objetivos ≥ 24 px (escritorio) | Cumple. |
| Objetivos ≥ 40 px (móvil) | **Incumple** en 9 botones (§2.10). |
| Movimiento reducido | Cumple (`suite.css:257`). |
| `lang="es"` | Cumple (`flujo.html:2`). |

---

## 6. Otros hallazgos de la maqueta

- **Scroll horizontal de la página entre 761 y 900 px** [verificado; a 1024 px no hay]. A 761 y 800 px de ancho, `scrollWidth` = 942. La cabecera no se pliega entre 761 y 890 px: su ancho mínimo es 890 px (los botones «ES» y «Exportar» solo se ocultan ≤ 760). A 900 px, el área de pestañas pide 602 px (554 de pestañas + 48 de relleno). A 1024 px no hay desborde [verificado]. No medí el umbral superior exacto entre 900 y 1024 px.
- **Paleta recortada con alto < ~747 px** [verificado a 700 px; [inferido] para el umbral].
- **«Casos de verificación» en dos líneas a 800 px** [verificado: `Range.getClientRects` = 2 líneas]. No se solapa con el contador.
- **Barra de FS mínimo oculta** (`.bar { display:none }`, `suite.css:251`). La maqueta la define pero no la muestra. Decidir si entra en A.
- **Etiqueta de superficie crítica fija** (`ogs-mock.js:87`, «FS mín. 0,984») y **FS fijos** en el HUD y la tabla («Iteraciones y λ ilustrativos en la maqueta», `flujo.html:224`). Son datos de maqueta, no de la app.
- **Nombres de los tooltips en la paleta** [verificado: `flujo.html:197-207`]. El nombre accesible sale del texto del `span` («Seleccionar V»). Si cambia el tooltip, cambia el nombre que usan los guiones e2e (XA3).
- **`div` dentro de `span`** en `.step-head` (`flujo.html:116` y similares): HTML no válido, pero el navegador lo resuelve. Usar `span` con `display:block` si se toma la maqueta como plantilla.

---

## 7. Conclusiones

1. [verificado] La maqueta A mide cabecera 68, barra lateral 340, paso 53,5, pie 111, pestañas 40, paleta 60 × 509,1, HUD 330 × 223,8 y barra de estado 30 px a 1440 × 900.
2. [verificado] La suite (v1.1) y OpenGeoSlide comparten **nombres por función** en casi todos sus tokens de interfaz, pero **casi ningún valor es igual**. El acento oscuro es `#2c77c3` en la suite y `#60a5fa` en OGS; el texto sobre acento, `#ffffff` y `#0b111b`. Los contrastes de la suite no valen para OGS.
3. [verificado] Hay 6 tokens de la suite sin par (`--gs-surface-sunken`, `--gs-border-strong`, `--gs-border-dashed`, `--gs-text-2`, `--gs-info-border`, `--gs-viewer-grid-major`), una sombra y ocho tokens no de color. Del lado de OGS, hay 26 nombres sin par, casi todos del lienzo (piezómetro, estanque, carga, refuerzo, sísmico, materiales 1–6).
4. [verificado] La marca SVG de OpenGeoSlide es idéntica en la maqueta y en la lámina. El icono PWA de la app (`public/icons/icon.svg`) es un diseño distinto.
5. [verificado] Outfit y JetBrains Mono van en **5.3.0**, OFL-1.1. La maqueta usa Outfit 400/500/600 y JetBrains 400/600 (no usa Outfit 700 ni JetBrains 500). En variable pesan 102,7 KB, frente a 118,7 KB en estático.
6. [verificado] Ninguna de las dos familias trae `γ λ φ ⁵ ⁻ ↵ ▾ ✓` en latin. Outfit no tiene griego y JetBrains Mono sí. `′` falta solo en Outfit.
7. [verificado] La app no tiene `@font-face`. La maqueta pide Google Fonts; eso no vale para la PWA sin conexión. El precache incluye todo `dist/` salvo `public/fonts/`, así que las fuentes deben entrar por `src/`.
8. [verificado] La maqueta tiene scroll horizontal entre 761 y 900 px (medido; a 1024 no), paleta recortada con alto < ~747 px, y 9 botones de 32 px en móvil (la regla pide ≥ 40 px). Solo tiene un punto de corte (760).
9. [verificado] `DISENO_B.md` aplica a A en §2 (los 8 principios, con matices), §4 (tokens), §5 (tipografía, con 6 discrepancias con `suite.css`), §6.2, 6.3, 6.5, 6.7, 6.8, 6.10, 6.12, §7 (parcial), §9 (sin implementar), §11. No aplica §1, §3, §6.1, §6.6, §6.9, ni la tabla de pantallas de §10 ni la aceptación de §12 (son de B).
10. [inferido] El sketch A no sirve como referencia visual: está congelado en v1 y difiere de `src/` en tres puntos. Hay que regenerarlo como `v2-…` con `build.py` (según el README, las versiones se guardan como carpetas nuevas).

---

## 8. Verificación de render (método)

- Copia de `sketches/v1-ogs-a-flujo/index.html` fuera del repo, con el enlace a Google Fonts quitado y `@font-face` locales apuntando a los woff2 de `@fontsource` 5.3.0 (Outfit 400/500/600; JetBrains Mono 400/600). Archivo: `~/.hermes/profiles/open-geoslide/cache/scratch/ua/XA4/flujo-local.html`.
- Chrome headless `/usr/bin/google-chrome-stable --no-sandbox` con `playwright-core` 1.65.1 (`~/.hermes/profiles/open-geoslide/cache/scratch/ua/XA4/measure.mjs`, `diag.mjs`, `small.mjs`, `tabchk.mjs`).
- Resultados en `measure.json`, `diag.json`. Capturas: `~/.hermes/profiles/open-geoslide/cache/scratch/ua/XA4/shots/flujo-{1440x900,800x600,390x844}.png` (no se han inspeccionado visualmente: las medidas bastan para este informe).
- Consola: 0 errores en todos los tamaños [verificado].
- Fuentes cargadas en la maqueta local: Outfit 400, 500, 600 y JetBrains Mono 400, 600 [verificado: `document.fonts`].

| Viewport (px) | `scrollWidth` / ancho | Alto de la ventana | Tarjeta (alto) | Paleta | Cabecera | Veredicto |
|---|---|---|---|---|---|---|
| 1440 × 900 | 1440 / 1440 | 900 | 663 | 509,1 dentro | 68 | OK |
| 1280 × 800 | 1280 / 1280 | 800 | 563 | 509,1 dentro | 68 | OK |
| 1100 × 800 | 1100 / 1100 | 800 | 563 | dentro | 68 | OK |
| 1024 × 768 | 1024 / 1024 | 768 | 531 | 509,1 dentro (margen 11) | 68 | OK |
| 900 × 700 | **942** / 900 | 700 | 463 | **recortada** | 68 | Desborde horizontal y paleta recortada |
| 800 × 600 | **942** / 800 | 600 | 363 | **recortada** | **890** | Desborde horizontal y paleta recortada |
| 761 × 800 | **942** / 761 | 800 | 563 | dentro | **890** | Desborde horizontal |
| 390 × 844 | 390 / 390 | 844 | 612 | 336 × 54 | 99 | OK en ancho; página de 1681 px de alto; 9 botones < 40 px |

---

## 9. Dudas para el coordinador

1. **¿Qué medidas mandan para A?** La maqueta usa `suite.css` (v1.1) y `DISENO_B.md` §5 dice otra cosa en 6 puntos (§5.3). Propongo `suite.css` para A y una corrección del documento.
2. **¿Regenerar el sketch de A como `v2-ogs-a-flujo/`?** El sketch v1 está congelado y se aparta de `src/` en tres puntos (cabecera de este informe).
3. **Ancho de la barra lateral:** `--gs-sidebar-w` es 340 px (`suite-tokens.css:105`), pero `DISENO_B.md §3` dice 312 px para B. ¿A toma 340?
4. **Fuente:** ¿variable o estática? ¿Solo latin (no hay español fuera de latin)? ¿JetBrains Mono como respaldo para γ/λ/φ, o SVG/texto distinto? ¿Se quitan `✓`, `▾`, `↵` del texto y se sustituyen por iconos?
5. **Nombre de familia** de la variable (`'Outfit Variable'`) en `--gs-font-sans`, si se usa la variable.
6. **Tokens que faltan en OGS:** `--gs-surface-sunken`, `--gs-border-strong`, `--gs-border-dashed`, `--gs-viewer-grid-major`, `--gs-info-border`, `--gs-text-2` y la sombra. ¿Se añaden a `tokens.css` (y pasan `no-hardcoded-colors`)? ¿O `--gs-text-2` se mapea a `--ui-ink-muted` (7,86:1 en oscuro, adecuado)?
7. **Escalón intermedio de la cabecera y las pestañas (761–900 px medidos; el límite superior está entre 900 y 1024 px):** ¿un corte a ~1000 px? ¿Se pliegan «ES» y «Exportar» a iconos? ¿La paleta pasa a fila por debajo de ~750 px de alto?
8. **Icono PWA e icono de la app:** `public/icons/icon.svg` y los PNG son de otro diseño. ¿Se sustituyen por la marca de la suite (que la lámina dice que sirve como favicon e icono PWA)?
9. **Teclado:** ¿A implementa V, A, R, D, F, H, +, −, 0 (que los tooltips anuncian) o se quitan de las etiquetas?
10. **Pestañas y roles:** ¿se añaden `aria-controls` y `tabpanel`, y la navegación con flechas? ¿Se quita el `span` de tooltip del nombre accesible (duda para XA3)?
11. **Pie en móvil:** ¿«Comprobar» es fijo (`sticky`) en móvil, como pide B §10? La maqueta no lo hace.
12. **Estados de §7:** ¿A adopta «Sin perfil», «Listo», «Parcial» y «Error»? ¿Y el aviso «Hay cambios sin simular» en el pie?
13. **Barra de FS mínimo** (`.bar`, oculta en la maqueta): ¿entra en A?
14. **Acento:** ¿se cambia `--ui-accent` a `#2c77c3` (oscuro) y `#2f6da8` (claro), como en la suite? Obliga a repetir los contrastes de `tokens.contrast.test.ts`.

---

_Fin del informe XA4._
