# Arbitraje de la revisión RUA (Antigravity, gemini-4-neon-high, commit 8e18cf5)

Informes completos: `docs/reviews/RUA_agy_A.md` (lente A, estado e interacción: **NO APTO**) y
`docs/reviews/RUA_agy_B.md` (lente B, contrato, a11y e ingeniero: **APTO CON CORRECCIONES**).

## Cómo se arbitró

- Los hallazgos se agruparon por causa.
- Antes de aceptar un hallazgo CRÍTICO o ALTO, el coordinador revisó la premisa en el código o en las capturas del
  revisor:
  - A-01 en `engineCheck.ts:78-81` y `engine/client.ts:165`;
  - A-02 y B-01 en `EditorApp.tsx:662-673` y en la captura `02_bug_pending_draft_chip.png`;
  - B-03 en `ResultSummary.tsx:96-109`;
  - B-05 en `EditorApp.tsx:494`.
- **Propietarios:** C1 (armazón y estado) y C2 (modelo, HUD, tokens y lienzo). Las tareas están en
  `briefs/UA3_tareas.md`.

| Hallazgo(s) | Severidad final | Decisión | Propietario |
|---|---|---|---|
| A-01 | ALTA (era CRÍTICA) | Aceptado. El defecto ya estaba en v0.5.0 (`engineCheck.ts` no cambió en UA), pero UA lo hizo más alcanzable al dejar «Comprobar» visible en Casos. Una cancelación externa (Casos cancela, o «Reiniciar el motor») con el guardia todavía vigente deja `busy: false`, restaura `engine` y avisa «Cálculo cancelado.» (`info`). | C1 |
| A-02, B-01 | ALTA | Aceptado. `runStatus` no trata un resultado como actual si `pendingDrafts > 0`, y `EditorApp` pasa `current: resultCurrent`. | C2 (modelo), C1 (llamada) |
| A-03 | ALTA | Aceptado. Un fallo del motor (`engine.status === 'error'`) llega a `runStatus` como `message` y `messageKind: 'error'`, y el HUD muestra el error en una línea con «Ver diagnósticos». | C1 (llamada), C2 (HUD) |
| A-04, B-10(a) | ALTA | Aceptado. En el HUD, «No convergió» no se superpone a nada; se mide con cajas que no se cruzan. | C2 |
| A-05, A-13, B-13(d) | ALTA | Aceptado con otra corrección (**UA-E3 §1**): en la vista Casos se ocultan la barra lateral y el pie de acción. Cargar un modelo desde «Archivo» (Nuevo, Talud simple, Abrir, Ejemplos, Importar, Recuperar) estando fuera de Lienzo vuelve a Lienzo. Resultados sin cálculo no repite «Comprobar». | C1 |
| A-06 | ALTA | Aceptado (**UA-E3 §2**). | C1 |
| A-07, B-10(b, d) | ALTA | Aceptado (**UA-E3 §3**). | C1 (condición y pestañas), C2 (`compact` en el HUD) |
| A-08 | ALTA | Aceptado. El candidato del HUD (`below`/`beside`) solo se recalcula cuando cambia el tamaño del HUD o de la tarjeta, cuando cambia `docEpoch` o con «Encuadrar» y la tecla 0. Editar el documento no reencuadra. | C1 |
| B-02 | ALTA | Aceptado (**UA-E3 §4**). | C2 (modelo y HUD), C1 (cableado) |
| B-03, A-12 | ALTA y MEDIA | Aceptado. La píldora plegada tiene un nombre que contiene todo su texto visible: `aria-label` «Mostrar resultado, FS mín. 0,984», o texto visible «Mostrar resultado» con la cifra en un hermano decorativo. Conserva «FS < 1,0» y «Desactualizado» en el texto. Plegar y desplegar con teclado deja el foco en el botón que aparece. | C2 |
| B-04 | ALTA | Aceptado (**UA-E3 §5**). Cambia UA-D8 y la tabla de `runStatus`. | C2 |
| B-05 | ALTA | Aceptado. Tras cada cálculo, el método mostrado por defecto es el primero de `fsMinimum(report).methods`, o `results[0]` si ninguno convergió. Si el usuario eligió otro método y sigue en el informe, se respeta. | C1 |
| A-09 | MEDIA | Aceptado. «Editar título» espera la confirmación del cambio de paso, despliega la barra con `writeSideCollapsed` (persistido) y enfoca `[data-path="/meta/title"]`. `navigateIssue` también persiste. | C1 |
| A-10 | MEDIA | Aceptado. Si el destino de una incidencia tiene `tab === null` o `focus` con controles del lienzo o la paleta, primero se vuelve a Lienzo. | C1 |
| A-11 | MEDIA | Aceptado. `useRovingTabIndex` sigue a `aria-selected` cuando el foco no está dentro del grupo (los cambios programáticos de paso o de vista). | C1 |
| A-14 | BAJA | Aceptado. El disparador del menú estrecho se llama siempre «Editar». | C1 |
| B-06 | MEDIA | Aceptado. Agua con grieta inundada: «Agua en grieta · γw 9,81» (`done`). Con `ru > 0` en algún material: «Sin piezométrica · ru en N mat.» (`done`). | C2 |
| B-07 | MEDIA | Aceptado. El título de Informe sigue la regla del PDF (`title.trim() || id.trim() || 'Sin título'`). La tarjeta de Informe muestra su propio aviso de desactualizado o bloqueo, visible con la barra plegada. | C1 |
| B-08 | MEDIA | Aceptado. Las bandas de entrada y salida dan ≥ 3:1 sobre `--canvas-bg` en ambos temas, y su par entra en `PAIRS`. Sobre los materiales se mide y se anota la cifra, sin fijarla: van sobre el terreno, en el aire. `--ui-warn-ink` claro sobre `--ui-accent-bg` llega a ≥ 4,5. | C2 |
| B-09, B-12 | MEDIA y BAJA | Aceptado. Cada rango definido lleva su unidad. Un FS en [0,9995, 1) se muestra con 4 decimales («0,9997»), nunca «1,000» junto a «FS < 1,0». `kh` y `kv` no nulos que redondean a 0: «kh < 0,001». Los rangos con negativos se escriben con «a» y el signo menos (−): «−25,5 a −10,2 m». | C2 |
| B-10(c) | MEDIA | Aceptado. Si la paleta no cabe, primero se compacta (botones de 36, sin rótulos «Herram.» ni «Vista»); si aún no cabe, hace scroll con la barra visible (`scrollbar-width: thin`). | C2 |
| B-11 | MEDIA | Aceptado. Sin `aria-labelledby` en `<p>`: se usa `<dl><dt><dd>`. | C1 |
| B-13(a) | BAJA | Aceptado. Hasta 760 px, el orden es lienzo, HUD y después la paleta en fila, como dice §2. | C1 (`shell.css`), C2 (si toca `canvas.css`) |
| B-13(b) | BAJA | Aceptado. El título de eje «y (m)» no se dibuja bajo el HUD ni bajo la leyenda (como los rótulos, `coveredBoxes`); se muestra en el primer hueco libre del eje. | C2 |
| B-13(c) | BAJA | Aceptado. `GeometryPanel`: «de la barra del lienzo» pasa a «de la paleta del lienzo». | C2 |
| Aceptación A13 sin el HUD plegado | — | El guion de aceptación también corre axe con el HUD plegado y con un error del motor. | UA2-E (dueño de `docs/**/e2e`) |

## UA-E3 (enmienda al contrato)

1. **Casos de verificación.**
   - Con esa vista activa, la barra lateral «Modelo» y el pie de acción quedan `hidden` y el área principal ocupa el
     ancho.
   - Los menús de la cabecera siguen activos.
   - Cargar o crear un modelo desde ellos vuelve a Lienzo; «Guardar» y «Exportar» actúan sin cambiar de vista.
   - En Casos, los atajos de documento llaman a `preventDefault()` cuando el foco no está en un campo de Casos, para
     que el navegador no aplique su propio deshacer.
2. **Barra plegada:**
   - La cabecera del área muestra «Comprobar», y además «Cancelar cálculo» si hay un cálculo en curso y «Reiniciar el
     motor» si el motor falló. Cada uno es el único visible con su nombre.
   - El texto de bloqueo (`export-hint`) vive en un nodo que no depende del pie, y Informe tiene el suyo.
   - Hasta 760 px no se puede plegar: se ignora `ogs.ui.side.v1` y no se muestra el botón.
   - A 320 px, `.ua-title` hace `flex-wrap` y nada se aplasta por debajo de su contenido.
3. **Ventanas bajas.**
   - El armazón pasa `compact` al HUD cuando:
     - la tarjeta del lienzo mide menos de 360 px de alto;
     - o ningún candidato de `chooseHudFit` deja el modelo libre;
     - o el HUD se cruzaría con la leyenda.
   - Con el HUD plegado, la píldora no se cruza con la leyenda ni con el modelo encuadrado.
   - Las pestañas de «Vistas» no se recortan en silencio entre 761 y 1099 px: se compactan (relleno 10, sin ícono) y,
     si aun así no caben, muestran que hay más con un borde del lado recortado. No se usa degradado.
4. **Avisos del modelo.**
   - `StepStatus` suma `warn` (paso con avisos locales, palabra «Con avisos»; insignia con el ícono de aviso).
   - `RunStatusInput.advisories` cuenta los avisos locales más los avisos de severidad `aviso` del cálculo actual.
   - El HUD muestra «N avisos del modelo» con «Ver avisos» (`localAdvisories` y `onShowAdvisories`), que abre
     Resultados y enfoca Diagnósticos.
5. **Tono del chip:** el estado no juzga la aceptabilidad del talud. Sustituye las filas correspondientes de §4.1:

   | Condición | Tono | Texto |
   |---|---|---|
   | resultado actual, FS mín. < 1, todos convergieron | nok | «Calculado · FS < 1,0» (+ « · N avisos» si cabe) |
   | resultado actual, convergencia parcial y FS mín. < 1 | nok | «Parcial · c de t · FS < 1,0» |
   | resultado actual, convergencia parcial y FS mín. ≥ 1 | warn | «Parcial · c de t métodos» |
   | resultado actual, FS mín. ≥ 1, con avisos | warn | «Calculado · FS mín. 1,356 · N avisos» |
   | resultado actual, FS mín. ≥ 1, sin avisos | **neutral** | «Calculado · FS mín. 1,356» |

   Se agrega la condición previa: un resultado con `pendingDrafts > 0` nunca es actual. El `title` lista los métodos
   que no convergieron y el número de avisos. El tono `ok` deja de usarse en el chip.
