# X9: verificación UX práctica (cierre de X8, usuario simulado, axe, rendimiento)

Fecha: 25/11/2026 · Rama `main` (commit `0d3b893`), build local `pnpm build` + `vite preview` en `127.0.0.1:5184` (servidor terminado por PID) · Solo lectura sobre el código; sin commits.
Método: Chrome estable con playwright-core y `--no-sandbox`, 1440×900 salvo indicación. Mismas mediciones que X8 (`getBoundingClientRect`, `scrollWidth`, contraste calculado por DOM, axe-core 4.14.1 con `wcag2a, wcag2aa, wcag21aa, wcag22aa, best-practice`).
Scripts y datos (fuera del repositorio): `cache/scratch/x9-ux/` (`s1.json`, `s2.json`, `s3.json`, `s6.json`, `s7-perf.json`, `s9-draw.json`). Capturas: `cache/scratch/x9-ux/shots/`.
Límites: sin lector de pantalla; sin red lenta; Chrome headless (los tiempos son indicativos); la «usuaria» es un guion automatizado con la ruta de un primerizo, no una persona; el PDF se verificó por cabecera y tamaño, no visualmente. Las primeras ejecuciones de T2 fallaron por errores del propio guion (etiquetas con unidades, radio confundido con campo); se corrigieron y solo se reportan las ejecuciones finales.

## 1. Resumen

- **X8: 18 de 20 cerrados, 2 parciales** (UX-13 y UX-19). Desbordes, FS visible tras «Comprobar», objetivos de los vértices, contraste, `<main>`, avisos, CSV, teclado y diálogos: medidas corregidas.
- **Axe: 0 violaciones** en las 11 vistas y diálogos medidos, en claro y en oscuro (incluido Ayuda, «Talud simple…» y Proyecto). X8 tenía 2–5 reglas por vista.
- **Usuario simulado:** T1, T3, T4 y T5 completadas. **T2 no completada**: el estrato de roca bajo el talud no se puede dibujar (UX9-01, alta).
- **Rendimiento:** modelo de 341 vértices: primer cálculo 2,6 s; arrastre a mediana 16,7 ms por fotograma y 0 long tasks.
- **Hallazgos nuevos:** 8 (1 alta, 3 medias, 4 bajas).

## 2. Cierre de X8 (UX-01 a UX-20)

Estado: CERRADO | PARCIAL | ABIERTO. La medición es la de X8 o una mejor.

| ID | Estado | Medición en X9 | Evidencia |
|---|---|---|---|
| UX-01 Región nueva | CERRADO | «Nuevo»: 0 regiones, 0 vértices, «Modelo nuevo · sin cambios pendientes». «Dibujar región» + 4 clics + Intro: 1 región, 4 vértices (X8: 1→1 con 4 clics en aristas). | `s3.json` UX01_*; `s3-region-cerrada.png` |
| UX-02 Vértice con teclado | CERRADO | Foco en vértice + `Insert`: 4 → 5 vértices. Anuncio: «Vértice insertado. Vértice 2 de la región 1: x 30,0 m, y 22,451 m». | `s3.json` UX02 |
| UX-03 FS sobre el pliegue | CERRADO (FS) | Tras «Comprobar» (V047a): resumen FS en y=222–251 px (viewport 900); FS 0,985 y 0,984 visibles sin desplazarse. X8: panel en y=1064. La tabla completa sigue en y=945 (ver UX9-05). | `s1.json` pos; `s1-1440-tras-comprobar.png` |
| UX-04 Desbordes | CERRADO | `scrollWidth` − `clientWidth` = 0 en 320×568, 390×844, 720×450, 768×1024, 1024×768 y 1440×900 (X8: 294, 224, 0, 0, 75, 75 px). 0 elementos cortados. Ejemplo V047a a 390 px: 390/390. | `s1.json` anchos |
| UX-05 Objetivos táctiles | CERRADO | Vértices: caja de 24×24 px (6 de 6). Área de acierto con ratón: radio 16 px (`HIT_RADIUS_MOUSE_PX`, 32 px de diámetro). X8: 10×10. | `s1.json`; `hitTest.ts:14` |
| UX-06 Contraste `--muted` | CERRADO | `--ui-ink-muted` = `#4b5563` (claro, 6,87:1 mínimo en texto medido) y `#a3b1c6` (oscuro, 6,72:1). 0 pares por debajo de 4,5:1 en 25–36 pares medidos por tema. X8: 4,39:1. | `s2.json` contraste; `tokens.css:25` |
| UX-07 CSV no creciente | CERRADO | x = 40, 20, 70: «Importar piezométrica» deshabilitado; motivo: «x = 20 no es mayor que la anterior (40)». | `s3.json` UX07 |
| UX-08 `<main>` en Editar | CERRADO | `main#main-content` visible en modo Editar y contiene el editor. Axe `landmark-one-main`: 0. | `s1.json` main_visible_edit |
| UX-09 Lista de avisos | CERRADO | `ul.ea-notices` sin `role`; los `li` sin `role` (null). Axe `list` y `aria-allowed-role`: 0. | `s3.json` UX09 |
| UX-10 Avisos apilados | CERRADO | Info se cierra a los 6 s (3 → 2 tras 6,5 s; quedan los dos errores). Máximo 3 visibles. | `s3.json` UX09_UX10 |
| UX-11 Título del ejemplo | CERRADO | Tras cargar V047a: «Ejemplo: ACADS 1(a), homogeneous slope, dry · sin cambios pendientes». Modelo inicial = ejemplo etiquetado. | `s1.json` titulo_* (ver UX9-04) |
| UX-12 Primera visita y ayuda | CERRADO | Guía de 5 pasos al cargar («Paso 1 de 5», `role=dialog`, `aria-modal=false`), «Siguiente» la recorre y se cierra. `localStorage ogs.onboarding.v1` = «seen». Ayuda: `dialog` modal con índice (Inicio rápido, Glosario, Atajos, Limitaciones, Advertencia, Enlaces), glosario con «FS (factor de seguridad)» y botón «Recorrido guiado». | `s3.json` UX12_*; `s5`/`s6` T1 |
| UX-13 Mensajes técnicos | PARCIAL | kh: «use un valor entre 0 y 0,99 (ej. 0,15)» (CERRADO). DXF: «Línea 1: el archivo está dañado… (se esperaba un número y se encontró «esto no es un dxf»)» (CERRADO). JSON: «El archivo no es un JSON válido» sin línea ni columna (ABIERTO). Ángulo φ: no medido. | `s3.json` UX13_* |
| UX-14 Tabla sin nombre | CERRADO | `<caption>Resultados del análisis por método</caption>` (visualmente oculto). Nombre accesible presente. | `s1.json` tabla |
| UX-15 Paleta PDF vs pantalla | CERRADO (por código y test) | `report/palette.ts` es la fuente de la paleta del PDF; `palette.test.ts` comprueba que coincide con `--canvas-mat-0…6` del tema claro: 5/5 tests pasan. No comparé píxeles del PDF con el lienzo, ni la paleta en oscuro. | `vitest run src/report/palette.test.ts` |
| UX-16 Flechas en pestañas | CERRADO | ArrowRight desde «Geometría» → foco y selección en «Materiales». `tabindex` en roving: [-1, 0, -1, …]. | `s3.json` UX16 |
| UX-17 `window.confirm` | CERRADO | «Nuevo» con cambios: `dialog role=alertdialog` modal, «Seguir editando» / «Descartar cambios». `window.confirm` nativo: 0 llamadas. Esc cancela (la región sigue: 1). | `s3.json` UX17; `s3-confirmar-nuevo.png` |
| UX-18 «Comprobar» duplicado | CERRADO | 1 botón «Comprobar» (barra), 0 en el panel de resultados. | `s1.json` comprobar_botones |
| UX-19 Instalar app | PARCIAL | Código: `pwa/installPrompt.ts` + `InstallButton` (tests unitarios presentes). En Chrome headless no se disparó `beforeinstallprompt` (0 en 3 s) y el botón no aparece: no verificado en navegador. | `s3.json` UX19 |
| UX-20 Etiquetas de ejes | CERRADO | `fontSize` 12 en las etiquetas de ejes (6 de 6 muestreadas). | `s3.json` UX20 |

Conteo: CERRADO 18 · PARCIAL 2 (UX-13, UX-19) · ABIERTO 0.

## 3. Tareas del usuario simulado (T1 a T5)

Perfil: geotécnico, primera visita, sin documentación, ventana 1440×900, guía sin marcar. Cada tarea cuenta acciones de usuario (clics, campos, teclas). Los tiempos son de la máquina y no son comparables con los de una persona.

| Tarea | ¿Completada? | Pasos | Dudas y obstáculos | Mejoras concretas |
|---|---|---|---|---|
| **T1** Entender la app y calcular un ejemplo | **Sí** | 5 | La guía se entiende (5 pasos, «Siguiente»). Ejemplos en «Archivo». El título del ejemplo mezcla inglés y código («ACADS 1(a), homogeneous slope, dry»). FS 0,985 y 0,984 visibles sin desplazarse. Glosario de FS en Ayuda. | Título del ejemplo en español (UX9-04). |
| **T2** Talud 15 m, 1,5H:1V, arcilla sobre roca, piezométrica, calcular y leer FS | **No** | 12 hasta el bloqueo | Bien: «Talud simple…» con altura 15 m, modo «Pendiente H:V» 1,5, nombre y parámetros de la arcilla, línea piezométrica «En el pie» y «Crear talud»; 1 región y 6 vértices. **Bloqueo:** el estrato de roca bajo la base. La base está a 59 px del borde inferior del lienzo; 2 de 4 clics caen fuera; Intro no crea la región (1→1). No hay encuadre al dibujar; no logré alejar la vista con la tecla −. Además, las etiquetas de «Peso unitario γ», «Cohesión c» y «Nombre» se repiten en la tarjeta nueva de material (UX9-02). | Encuadrar al dibujar (UX9-01); tarjeta nueva con nombre propio (UX9-02). |
| **T3** `kh = 0,15` y carga distribuida en la corona, recalcular | **Sí** | 5 | `kh` en Sismo: un campo, Intro. Carga: Cargas › «Agregar carga distribuida» con «Inicio x1 (m)», «Fin x2 (m)» y «Carga q (kPa)». La corona está en x 0–10 m, pero el formulario no lo indica: hay que leer los vértices. FS recalculado (0,874 / 0,886). | Mostrar «Corona: x 0–10 m» junto a los campos (UX9-03). |
| **T4** Exportar PDF y guardar | **Sí** | 2 | «Informe PDF» en 1 clic: `talud-simple-informe.pdf`, 123,5 kB, cabecera `%PDF-1.3`. «Archivo › Guardar»: `talud-simple.ogs.json`. | Ninguna grave. |
| **T5** Reabrir y deshacer | **Sí** | 3 | Abrir: el título muestra «Talud simple H = 15 m, 1,5H:1V (talud-simple.ogs.json) · sin cambios pendientes». Ctrl+Z revierte el vértice movido (`revertido: true`). El estrato de roca no existe porque T2 no se completó. En una ejecución previa, `kh` 0,15 y la carga quedaron guardados en el `.ogs.json`. | — |

## 4. Hallazgos nuevos

| ID | Sev. | Vista | Qué pasa | Evidencia | Recomendación | Esf. |
|---|---|---|---|---|---|---|
| UX9-01 | ALTA | Lienzo · Dibujar región bajo el talud | Un estrato nuevo bajo la base no se puede dibujar sin ayuda: la base (y = −10 m) queda a 59 px del borde inferior con la vista por defecto. Los clics fuera del lienzo no crean vértices y Intro no cierra la región (1→1). El botón «−» existe, pero con la tecla − no observé cambio de escala en la prueba. | `s9-draw.json` (puntos a y=841 > borde 800); `s6-T2-roca-dibujada.png` | Encuadrar el modelo con margen al crear un talud y al entrar en «Dibujar región». Si Intro no cierra, mostrar el motivo. | M |
| UX9-02 | MEDIA | Materiales | La tarjeta «Agregar material» usa los mismos nombres accesibles que las tarjetas existentes («Nombre», «Peso unitario γ (kN/m³)», «Cohesión c (kPa)», «Ángulo de fricción φ (°)»). Un formulario solo se distingue por su posición. La prueba escribió los valores de roca en la arcilla (γ 22, c 100, φ 35 en `suelo`). | `talud-simple.ogs.json` (material `suelo` con valores de roca); `s6.json` | Nombre accesible propio en la tarjeta nueva (p. ej. «Nuevo material: peso unitario γ») o `fieldset` con leyenda. | S |
| UX9-03 | MEDIA | Cargas · carga distribuida | Las coordenadas x1 y x2 de la carga se piden en metros sin indicar dónde está la corona. | `s6.json` T3 (corona x 0–10 m) | Mostrar «Corona: x a–b m» junto a los campos o un botón «Usar la corona». | S |
| UX9-04 | BAJA | Cabecera de ejemplo | «Ejemplo: ACADS 1(a), homogeneous slope, dry» mezcla inglés y código, y es el título del modelo inicial. | `s1.json` titulo_inicial | Título en español y el id V047a como subtítulo. | S |
| UX9-05 | BAJA | Resultados 1440×900 | Solo el FS está sobre el pliegue. La tabla de resultados empieza en y=945 px. | `s1.json` pos (tablaTop 945, vh 900) | Compactar el resumen o llevar la tabla al panel lateral. | M |
| UX9-06 | BAJA | Avisos | Los errores no se cierran solos y se apilan (2 persisten tras 6,5 s y ocupan la barra). Solo se cierran uno a uno. | `s3.json` tras_6_5s | Botón «Cerrar todos» o límite de errores visibles. | S |
| UX9-07 | BAJA | Lienzo · modo oscuro | La muestra «Dovelas» (gris oscuro) de la leyenda apenas se distingue del fondo oscuro. Medición pendiente. | `s2-oscuro-V3-resultados.png` | Subir el contraste de la muestra en el tema oscuro. | S |
| UX9-08 | BAJA | Vista inicial | Hay 2 controles `INPUT` de 13×13 px en 320–1440 px. No los identifiqué en esta prueba. | `s1.json` pequeños | Identificarlos; si son casillas en línea, documentar la excepción de WCAG 2.5.8 o ampliar el área. | S |

## 5. Axe por vista y tema

Reglas: `wcag2a, wcag2aa, wcag21aa, wcag22aa, best-practice`. Resultado de violaciones: 0 en todas las vistas.

| Vista | Claro | Oscuro | Incompletas (no son violaciones) |
|---|---|---|---|
| V1 Inicio (modelo por defecto) | 0 | 0 | `color-contrast` (20 nodos, texto SVG sobre imagen) |
| V2 Editor con ejemplo V047a | 0 | 0 | `color-contrast` (20) |
| V3 Resultados | 0 | 0 | `color-contrast` (20) |
| V4 Diálogo importar DXF | 0 | 0 | 0 |
| V5 Diálogo importar CSV | 0 | 0 | 0 |
| V6a Casos de verificación | 0 | 0 | 0 |
| V6b Casos de verificación (resultados) | 0 | 0 | 0 |
| D1 Ayuda | 0 | 0 | 0 |
| D2 «Talud simple…» | 0 | 0 | 0 |
| P1 Pestaña Proyecto | 0 | 0 | `color-contrast` (20) |

Contraste medido por DOM (texto frente a fondo efectivo): mínimo 6,87:1 en claro y 6,72:1 en oscuro. Las 20 «incompletas» son texto SVG sobre el canvas, que axe no puede calcular; el contraste medido de esos pares es ≥ 6,7:1.

## 6. Rendimiento

| Medida | X9 | X8 (referencia) | Nota |
|---|---|---|---|
| LCP (carga, caché deshabilitada) | 76 ms | 148 ms | Servidor local, no GitHub Pages |
| CLS (carga) | 0,0021 | 0 | Insignificante (< 0,1) |
| Long tasks en la carga | 0 | 0 | |
| Comprobar habilitado (interactivo) | 103 ms | 238 ms | Local; no comparable del todo |
| Primer cálculo, modelo de 341 vértices | 2 640 ms | 336 ms (modelo inicial) | Modelo generado: talud con superficie de 161 puntos |
| Arrastre de vértice (341 vértices), rAF | 147 fotogramas en 2,0 s · mediana 16,7 ms · p95 16,7 ms · peor 16,8 ms | — | 0 long tasks durante el arrastre. Headless, sin limitación de CPU |
| Banner «ogs-core» / «Comprobar» con 341 vértices | Correcto tras cargar `.ogs.json` | — | Estado «con cambios sin guardar» y resultado obsoleto visibles |

## 7. Funciones nuevas

- **Guía de primera visita:** se abre sola en la primera visita, no es modal y no mueve el foco. 5 pasos; «Siguiente» y cierre verificados (T1).
- **Ayuda:** modal, índice interno, glosario con FS, atajos, botón «Recorrido guiado». Verificado.
- **`ConfirmDialog`:** `alertdialog` modal, Esc cancela, sustituye a `window.confirm` (UX-17). Verificado.
- **Proyecto:** pestaña presente (`role=tab`), axe 0 en claro y oscuro. No se editó el título en la prueba.
- **«Talud simple…»:** altura, pendiente H:V y parámetros; crea el talud (T2). Requiere cambiar el modo a «Pendiente H:V» para usar la pendiente.
- **«Dibujar región»:** crea una región vacía con 4 clics y Intro (UX-01). No sirve para estratos bajo un talud sin encuadrar (UX9-01).
- **Instalar app:** no verificado (UX-19).

## 8. Top 10

1. **UX9-01** (alta, M): encuadrar al dibujar y permitir estratos bajo el talud. Bloquea la tarea T2.
2. **UX-13** (parcial, S): mensaje de JSON con línea y columna; medir el rango de φ.
3. **UX9-02** (media, S): nombre accesible propio para la tarjeta de material nueva.
4. **UX9-03** (media, S): indicar la corona al pedir x1 y x2 de una carga.
5. **UX-19** (parcial, S): probar «Instalar app» con un evento `beforeinstallprompt` simulado.
6. **UX9-05** (baja, M): la tabla de resultados sobre el pliegue en 1440×900.
7. **UX9-04** (baja, S): título de ejemplo en español.
8. **UX9-06** (baja, S): cerrar todos los errores apilados.
9. **UX9-07** (baja, S): contraste de la leyenda en modo oscuro (medir primero).
10. **UX9-08** (baja, S): identificar los dos controles de 13 px.

Sin commits. Archivos creados: solo este documento. Los scripts y capturas están en `cache/scratch/x9-ux/`.
