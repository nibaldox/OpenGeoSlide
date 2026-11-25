# Brief F2-U3: modelar desde cero y primera visita (2 escritores Sonnet en paralelo)

Responde en **español neutro, sin voseo**. Lee primero:
- `docs/fase2/ux/PLAN_UX.md`. El contrato de tokens es normativo: solo `var(--ui-*)` y `var(--canvas-*)`.
- Tus hallazgos en `docs/reviews/R7_agy.md` (R7-02) y en `docs/fase2/ux/X8_auditoria_practica.md` (UX-01, UX-12,
  UX-17, UX-19).
- Las notas de las olas anteriores: `docs/fase2/ux/U2L_notas.md` y `U2C_lienzo_teclado.md`.
- La guía `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/mwg/accessibility.md`.

**Base:** `main` en `50d8b0b`, con U1 y U2 integradas. Tienes menús Archivo y Exportar, resumen de FS, regiones
`aria-live` (`useAnnouncer`, `onAnnounce`), lienzo operable con teclado y el tema oscuro.

## Reglas comunes
Son las mismas de `briefs/F2U2_interaccion.md` §«Reglas comunes»:
- worktree propio con **propiedad de archivos estricta**;
- un test que falla antes de cada cambio que se pueda probar, con la lógica en módulos puros;
- sin colores literales;
- nombres accesibles estables;
- gates: `pnpm test`, `pnpm build`, paridad con `OGS_BIN` sin casos omitidos, ida y vuelta, y axe en claro y oscuro con
  0 violaciones serious o critical;
- capturas en `$TMPDIR/u3x-shots/`, revisadas con visión;
- commits con rutas explícitas y **sin push**.

**Recorridos de regresión.** Haz una copia con tu puerto y deben seguir pasando:
- `$TMPDIR/f1c-e2e/coord_walk_u2x.mjs`: 17/17;
- `coord_u2c_keyboard.mjs`: 15/15;
- `coord_u2c_touch.mjs`: 8/8.

Los tres apuntan a `127.0.0.1:5185`; cámbialo por tu puerto. Si un cambio tuyo modifica la UI que recorren, actualiza tu
copia y explica el motivo.

**Puertos:** M usa el 5186 y O el 5187. `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. Python
siempre con `env -u PYTHONPATH -u PYTHONHOME`.

## Contrato entre escritores
- **O** crea estos archivos:
  - `src/ui/ConfirmDialog.tsx`, que exporta `useConfirm(): (opts: { title: string; message: string; confirmLabel: string; cancelLabel?: string; tone?: 'danger' | 'default' }) => Promise<boolean>` y `<ConfirmHost/>`. El host se monta **una vez** en `App.tsx`; usa un `<dialog>` nativo con foco seguro, Esc para cancelar y el foco de vuelta en el disparador.
  - `src/editor/panels/ProjectPanel.tsx`, que exporta `ProjectPanel` con **la misma firma que los demás paneles**
    (revisa `MaterialsPanel` y `TabDef`).
- **M** es dueño de `EditorApp.tsx`. Ahí registra la pestaña «Geometría», en primer lugar, y la herramienta «Dibujar
  región». **No** registra `ProjectPanel` ni usa `useConfirm`: el coordinador los conecta al integrar.
- Los dos pueden agregar `data-testid` en sus propios archivos. El recorrido guiado de O apunta a selectores **que ya
  existen en `main`**: menú Archivo, selector de Ejemplos, «Comprobar», resumen de FS (`ResultSummary`), pestañas del
  panel, lienzo y selector de tema.

---

## U3-M: modelar desde cero (worktree `u3m`, rama `u3m-modelado`)

**Archivos tuyos:**
- `src/editor/EditorApp.tsx`;
- `src/editor/state/**`, `src/editor/types.ts` y `src/editor/canvas/**`;
- `src/editor/panels/GeometryPanel.tsx` (nuevo) y `src/editor/panels/index.ts`;
- `src/editor/app/newModel.ts` (nuevo).

**Tareas:**
1. **UX-01 y R7-02, dibujar una región:**
   - herramienta `draw_region` (atajo `R`) en la barra y en `TOOLS`;
   - cada clic agrega un vértice, con el ajuste a la grilla y a los vértices existentes; la vista previa muestra la
     arista elástica hasta el cursor;
   - **Intro** o un clic sobre el primer vértice cierra la región. **Retroceso** quita el último punto y **Esc** cancela;
   - al cerrar, se valida con la misma regla que `validateLocal` (polígono simple, área no nula, sin solapes) y, si es
     válida, se agrega con `region/add` en **un solo paso deshacible**, con el material seleccionado o el primero;
   - **con teclado:** las flechas mueven un cursor de dibujo (0,1 m por paso; Mayús ×10) e **Intro/Espacio** coloca el
     punto, con anuncios por `onAnnounce`;
   - en táctil, cada toque coloca un punto.
2. **Panel «Geometría»**, primera pestaña:
   - lista de regiones con su material (un `<select>`), «Eliminar región» con confirmación nativa temporal
     (`window.confirm`, que el coordinador cambia por `useConfirm`) y «Seleccionar en el lienzo»;
   - **tabla de vértices editable** de la región seleccionada: x e y con `NumberField`, agregar después, eliminar, y
     validación en línea con los mensajes de U1-M;
   - con cientos de vértices la tabla no debe trabarse: virtualiza o pagina desde 200 filas.
3. **«Nuevo» con opciones** (`newModel.ts`):
   - el menú Archivo ofrece «Nuevo ▸» con «Modelo vacío» (sin regiones, con un material por defecto, y el lienzo invita
     a «Dibujar región») y «Talud simple…»;
   - «Talud simple…» abre un diálogo pequeño, un `<dialog>` propio en tu archivo, con altura H, ángulo β o pendiente
     H:V, ancho de corona, ancho de pie, profundidad bajo el pie, material, y opcionalmente la piezométrica en el pie o
     la corona. Genera una región, una búsqueda por defecto y la dirección correcta;
   - **test con el motor:** un talud H=10, β=45°, c=10, φ=30, γ=20 sin agua calcula y da un FS finito con Bishop y
     Spencer. Usa `OGS_BIN`, o el WASM en el test si ya hay mecanismo;
   - **el botón «Nuevo» actual mantiene su nombre accesible** y equivale a «Modelo vacío», o abre el submenú. Actualiza
     el recorrido si cambia.
4. **Estado vacío del lienzo:** sin regiones, el lienzo muestra un mensaje con dos acciones, «Dibujar región» y «Abrir un
   ejemplo», y la indicación de que se puede importar un DXF o CSV.
5. **Tests:**
   - la lógica pura del dibujo: máquina de estados, cerrar, cancelar, retroceso y validación;
   - `newModel` con la geometría esperada y un análisis válido con el motor;
   - los comandos de la tabla de vértices;
   - **Chrome:** dibujar una región de 4 vértices con el ratón y otra con el teclado, asignar material, comprobar y
     obtener un FS; crear un «Talud simple…» y calcularlo; deshacer el dibujo en un solo paso.

---

## U3-O: primera visita, ayuda y proyecto (worktree `u3o`, rama `u3o-onboarding`)

**Archivos tuyos:**
- `src/App.tsx`, solo la cabecera y el montaje de `ConfirmHost`, la guía y la ayuda;
- `src/App.css`, solo los estilos nuevos;
- `src/ui/{ConfirmDialog.tsx,HelpDialog.tsx,InstallButton.tsx}` (nuevos);
- `src/onboarding/**` (nuevo);
- `src/editor/panels/ProjectPanel.tsx` (nuevo);
- `src/pwa/**`, solo para `beforeinstallprompt`.

**Tareas:**
1. **UX-12, guía de primera visita:**
   - un recorrido **no modal** de 4 a 5 pasos: 1) abrir un ejemplo o dibujar, 2) materiales y agua, 3) «Comprobar», 4)
     leer el FS y los avisos, 5) exportar el informe;
   - cada paso resalta el control real con un anillo y un `popover` anclado o posicionado. Tiene «Siguiente»,
     «Anterior» y «Omitir», y se puede operar con teclado;
   - aparece **solo la primera vez** (`localStorage` `ogs.onboarding.v1`) y se puede volver a abrir desde «Ayuda ▸
     Recorrido guiado»;
   - no bloquea la app, respeta `prefers-reduced-motion` y es legible en claro, oscuro y móvil;
   - **el recorrido e2e no debe romperse:** en tus copias de los recorridos, el recorrido guiado se marca como visto con
     `addInitScript`, o se omite con un clic, y lo documentas.
2. **Ayuda** (`HelpDialog`), un botón «Ayuda» en la cabecera:
   - **inicio rápido** en 5 pasos;
   - **glosario** con FS, Bishop simplificado, Spencer, λ, ru, piezométrica, kh/kv, m_α, dovela, superficie crítica y
     búsqueda (entrada y salida);
   - **atajos de teclado:** léelos de `EditorApp`, `keys.ts` y `docs/fase2/ux/U2C_lienzo_teclado.md`, sin inventar
     ninguno;
   - **limitaciones** principales, con un enlace a `README` en GitHub;
   - **advertencia profesional**;
   - enlaces a GitHub, a los Releases y a «Citar»;
   - todo dentro de un `<dialog>` accesible con índice interno.
3. **`ConfirmDialog` y `useConfirm`** según el contrato. Reemplaza el `window.confirm` de `App.tsx` si existe. El de
   `EditorApp` lo cambia el coordinador.
4. **`ProjectPanel`**, con la firma de panel:
   - **título**, **autor**, **descripción** (`meta/patch`) y **unidades** (SI / imperial);
   - cambiar las unidades **no convierte** los valores. Antes de aplicar el cambio, un aviso claro lo explica y pide
     confirmación (`useConfirm`);
   - lee los campos reales de `Meta` y del schema en `schema/ogs-0.2.schema.json`;
   - muestra el **título en la barra de estado**, que hoy muestra el nombre de archivo o del ejemplo.
5. **UX-19, botón «Instalar app»:** maneja `beforeinstallprompt` y muestra el botón solo cuando el navegador lo ofrece.
   Tras instalar, o si ya corre como `display-mode: standalone`, el botón se oculta.
6. **Tests:**
   - la lógica pura de la guía: pasos, persistencia, reapertura;
   - la cola de `useConfirm`, con un modelo puro;
   - el contenido de la ayuda: atajos sincronizados con una constante exportada, en lugar de texto duplicado, si es
     viable;
   - `ProjectPanel` con sus comandos;
   - el estado del botón de instalación.
   - **Chrome:**
     - la primera visita muestra la guía; recorrerla con teclado; la segunda visita no la muestra; «Ayuda ▸ Recorrido
       guiado» la reabre;
     - la ayuda se abre y se cierra con Esc, y el foco vuelve al botón;
     - capturas de la guía y de la ayuda en claro, oscuro y 390 px.
