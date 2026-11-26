# Brief F2-U6: correcciones de R9 (3 escritores Sonnet en paralelo)

Responde en **español neutro, sin voseo**. Lee primero:
- `docs/reviews/R9_agy.md` (Antigravity, veredicto MEJORABLE): los hallazgos R9-01 a R9-12 y las 4 PARCIALES de R8;
- `briefs/F2U5_correcciones_R8.md`, con el arbitraje anterior;
- las notas `docs/fase2/ux/U5E_editor.md` y `U5S_salida.md`;
- `docs/fase2/ux/PLAN_UX.md`, cuyo contrato de tokens es normativo.

**Base:** `main` en `822f8b6`, con U5 publicada.

## Arbitraje del coordinador (normativo)
El coordinador verificó en el código R9-01 (`draftTabs.ts:144-151`), R9-03b (`validateLocal.ts:351-353`, igualdad
exacta) y R9-04 (`keys.ts:103`).

**Se aceptan los 12 hallazgos.** El motor (`crates/`) **no se modifica**: la precedencia de `ru` y la extrapolación
horizontal de la piezométrica son contrato de E12. Se **avisan** y se **dibujan**, pero no se cambian.

| Hallazgo | Escritor |
|---|---|
| R9-01, R9-02 (a y b), R9-08 (a y b), R9-11 (a y b) | **D** (borradores y estado) |
| R9-03 (a, b y c), R9-05 (a, b, c y d: avisos y PDF), R9-07, R9-09 (a y b), R9-12 (a, b, c y d) | **G** (seguridad geotécnica y salida) |
| R9-04, R9-06, R9-10, R9-11c, R9-05d (dibujar en el lienzo el tramo extrapolado de la piezométrica) | **K** (teclado y lienzo) |

**Decisión sobre R9-07:** se elimina la línea de comentario `#`. Las columnas con dimensión conservan su sufijo
(`xc_m`/`xc_ft`), y cada fila lleva una columna `unidades` con el valor `SI` o `imperial`. El CSV queda compatible con
RFC 4180, de modo que Excel y `pandas.read_csv()` lo leen sin opciones.

## Reglas comunes
Son las de `briefs/F2U5_correcciones_R8.md`:
- worktree propio y propiedad de archivos estricta;
- un test que falla antes del cambio;
- sin colores literales;
- nombres accesibles estables;
- gates: `pnpm test`, `pnpm build`, paridad con `OGS_BIN` sin omitidos, ida y vuelta, y axe en claro y oscuro con 0
  violaciones serious o critical;
- commits con rutas explícitas y **sin push**.

**Recorridos de regresión:** deben pasar todos los de `docs/fase2/ux/{u3i,u3m,u3o,u4m,u4p,u5e,u5s}-e2e/`. Córrelos con
`OGS_URL=http://127.0.0.1:<puerto>/` y `OGS_REPO=<tu worktree>`, o con copias en las que reemplaces `127.0.0.1:518x`.
Si actualizas un recorrido por un cambio intencional, deja el motivo en un comentario.

- **Puertos:** D usa el 5186, G el 5187 y K el 5188. Mata tu servidor por PID.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.
- Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.

**Reproduce antes de corregir.** Cada hallazgo trae en R9 su evidencia en vivo. Escribe primero el test o el paso de
Chrome que falla y que reproduce lo que vio el revisor; recién después corrige.

---

## U6-D: borradores y estado (worktree `u6d`, rama `u6d-borradores`)

**Archivos tuyos:**
- `src/editor/app/{draftTabs.ts,useDraftAutosave.ts}` y `src/io/draft.ts`;
- `src/editor/EditorApp.tsx`: el cableado del borrador, `dirty` y el disparador del menú «Editar»;
- `src/editor/app/discard.ts`;
- los tests de todo lo anterior.

**Tareas:**
1. **R9-01:**
   - Separa `clearOwnDraft()`, que usa `onSave` y borra **solo** el borrador de esta pestaña, de
     `discardOfferedDraft(tabId)`, que usa el botón «Descartar» del banner.
   - Si el borrador ofrecido pertenece a una pestaña que sigue abierta (`openElsewhere`), «Descartar» solo oculta el
     banner en esta pestaña.
   - **Test y Chrome:** guardar en B no borra el borrador de A; «Descartar» en B no borra el de A mientras A siga
     abierta.
2. **R9-02a:** al habilitarse el autoguardado con `dirty === true`, por ejemplo tras «Descartar» habiendo editado con
   el banner visible, programa un guardado de inmediato. `beforeunload` sigue avisando mientras haya cambios.
3. **R9-02b, pestaña duplicada:** si `createPresence` detecta otra pestaña con el mismo `tabId`, la pestaña nueva genera
   un `tabId` propio en `sessionStorage` y migra su borrador. El texto `SAME_DRAFT_TEXT` debe decir la verdad. **Test** con
   un canal falso y **Chrome**: duplicar una pestaña no pisa el borrador de la original.
4. **R9-08:**
   - **a.** Calcula el índice y borra los `dropped` **antes** de escribir. Ante `QuotaExceededError`, quita el
     borrador más antiguo y reintenta una sola vez. Si aun así falla, muestra un aviso visible.
   - **b.** Un borrador heredado corrupto en `ogs.editor.draft.v1` se muestra como `io.draft_invalid` y se limpia.
5. **R9-11a:** un trazo con puntos cuenta en `dirty`. La barra de estado dice «con cambios sin guardar» y
   `beforeunload` avisa.
6. **R9-11b:** con 480 px o menos, el disparador «Editar» muestra la herramienta activa cuando no es «Seleccionar». Por
   ejemplo, «Editar · Dibujar ▾», o una insignia visible que forme parte del nombre accesible. Actualiza los recorridos
   que esperan «Editar ▾».

---

## U6-G: seguridad geotécnica y salida (worktree `u6g`, rama `u6g-geotecnia`)

**Archivos tuyos:**
- `src/editor/state/{validateLocal.ts,units.ts}`;
- `src/editor/canvas/layout.ts`: solo la detección de unidades y la flecha de `kv`;
- `src/io/csv.ts`, `src/report/**` y `src/render/drawSection.ts`;
- `src/App.tsx`: la vista Casos, su validación y su convergencia;
- `src/ui/ResultsTable.tsx`;
- `src/editor/panels/{WaterPanel.tsx,MaterialsPanel.tsx,LoadsPanel.tsx,forms.ts}` y `src/editor/app/applyImport.ts`;
- `src/onboarding/helpContent.ts`: solo el texto de limitaciones y de convenciones;
- los tests de todo lo anterior.

**Tareas:**
1. **R9-03b:**
   - `isImperialUnits(units)` va en `units.ts`, sin distinguir mayúsculas. Úsala en `validateLocal`, `units.ts`,
     `csv.ts`, `report/content.ts` y `layout.ts`; con `grep` no debe quedar ninguna otra detección de imperial.
   - En imperial con piezométrica, bloquea cuando γw falta o es **menor que 20 pcf**, con un mensaje accionable.
   - **Tests:** `9.8`, `9.80665`, `units: "Imperial"`, y 62,4 y 64,0, que deben pasar.
2. **R9-03a:**
   - «Comprobar caso» en Casos ejecuta `validateLocal` y **bloquea** los errores con el mismo mensaje y criterio.
   - **Chrome:** un JSON imperial con piezométrica y sin γw no calcula. Los 21 casos de verificación siguen pasando,
     igual que el gate de paridad.
3. **R9-03c:** el PDF de un modelo sin agua dice «Sin agua (no aplica)», no «9,81 pcf (por defecto)».
4. **R9-05, rigor del informe y de los avisos:**
   - **a.** La figura de la sección del PDF dibuja las cargas (distribuidas y lineales) y el indicador sísmico. Sus
     cotas llevan unidad. Ninguna cota se solapa con el arco crítico: usa un margen o un halo.
   - **b.** El PDF y la Ayuda declaran las convenciones:
     - `kh` positivo en el sentido del deslizamiento y `kv` positivo hacia abajo, aplicados solo al peso del suelo;
     - el ángulo de la carga lineal se mide desde la vertical, positivo hacia +x.
     Confírmalas en el código de `crates/ogs-core` antes de escribirlas y cita el archivo y la línea en tu nota.
   - **c.** Un aviso no bloqueante cuando algún material usa γsat, que «todavía no está verificado frente a otro
     programa». Aparece en Diagnósticos y en el PDF.
   - **d.** Dos avisos en Diagnósticos y en el PDF. Uno cuando hay `ru` y piezométrica a la vez: `ru` tiene
     precedencia en ese material (cita `slicer.rs`). Otro cuando la piezométrica no cubre todo el ancho del modelo: se
     extiende horizontalmente hasta los bordes.
5. **R9-07:** CSV según la decisión del arbitraje. **Test** con un parser RFC 4180 estricto, por ejemplo Python
   `csv.DictReader` o `pandas.read_csv` sin opciones. Actualiza `u5s_salida.mjs` si lee la línea `#`.
6. **R9-09:**
   - «Crear piezométrica» e importar una piezométrica en un modelo imperial sin γw fijan `unit_weight: 62.4` en el
     mismo paso deshacible;
   - `defaultLoad` en imperial usa 200 psf y 700 lbf/ft, y en SI conserva los valores actuales.
7. **R9-12:**
   - **a.** Aviso no bloqueante cuando γsat es menor que γ.
   - **b.** En Casos, una superficie que no convergió se dibuja discontinua y con el rótulo del editor; reutiliza
     `resultCaption` o su equivalente.
   - **c.** `ResultsTable` muestra (xc, yc, r) con unidad, y el lienzo dibuja la flecha vertical cuando kv ≠ 0 (en
     `layout.ts`).
   - **d.** La etiqueta visible es «Distribuida», sin «(udl)».
8. **Chrome:**
   - el PDF exportado, revisado como imagen con pymupdf y visión: sección con cargas y sismo, cotas con unidad,
     convenciones y avisos;
   - el CSV abierto con `pandas` en un paso de Python;
   - los casos imperiales bloqueados;
   - axe en claro y oscuro.

---

## U6-K: teclado y lienzo (worktree `u6k`, rama `u6k-teclado`)

**Archivos tuyos:**
- `src/editor/canvas/{keys.ts,EditorCanvas.tsx}` y el CSS del lienzo; `layout.ts` es de G;
- `src/editor/state/{reducer.ts,history.ts,types.ts}`;
- `src/editor/panels/ProjectPanel.tsx` y `projectForm.ts`;
- `src/editor/app/ImportDialogs.tsx` (`Modal`) y `src/ui/HelpDialog.tsx`;
- `docs/fase2/ux/U2C_lienzo_teclado.md`;
- los tests de todo lo anterior.

**Tareas:**
1. **R9-04:**
   - `[`, `]`, `+`, `=` y `-` funcionan cuando el carácter llega con AltGr (`ctrlKey && altKey`, o
     `getModifierState('AltGraph')`) o con Option (`altKey` sin `metaKey`). Evalúalos por `k.key` **antes** del descarte
     genérico de modificadores.
   - Ctrl+Z, Ctrl+Y y los atajos reales con Ctrl no deben cambiar.
   - **Tests** de distribuciones: `es-ES` en Windows con AltGr, macOS con Option y US.
   - **Chrome:** un `keydown` sintético con `key: ']'`, `ctrlKey: true` y `altKey: true` avanza de tirador.
2. **R9-06:**
   - Si deshacer o rehacer cambia `doc.units`, o la caja envolvente cambia más de 2×, `ui.viewport` vuelve a `null`
     para encuadrar de nuevo.
   - `unitsNotice` de `ProjectPanel` se limpia cuando las unidades cambian desde fuera.
   - **Chrome:** convertir de SI a imperial y luego Ctrl+Z deja el talud con el mismo ancho en píxeles que antes,
     ±5 %.
3. **R9-10:** el tirador con `tabIndex=0` lleva `aria-describedby` con las instrucciones. Si el texto es largo, usa una
   versión breve. **Test.**
4. **R9-11c:** `Modal` y `HelpDialog` usan `restoreFocus` (`ui/focusReturn.ts`) en lugar de
   `previous?.isConnected && previous.focus()`. **Chrome:** el foco no cae en `<body>` al cerrarlos.
5. **R9-05d visual:** el lienzo dibuja con trazo discontinuo el tramo **extrapolado** de la piezométrica, horizontal
   hasta los bordes del modelo, con la misma regla que `crates/ogs-core/src/geometry.rs:621-627`. La leyenda lo
   identifica como «Piezométrica (extrapolada)». La leyenda, `ui/Legend.tsx` y `legendItems.ts`, no es tuya: si hace
   falta un elemento, deja un parche en `docs/fase2/ux/u6k-e2e/*.patch`, verificado con `git apply --check`.
6. **Chrome:**
   - AltGr;
   - convertir y deshacer;
   - foco en los diálogos;
   - piezométrica extrapolada;
   - axe en claro y oscuro.
