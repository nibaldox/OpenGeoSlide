# Brief F3B-R16-W: borradores sin aplicar en Guardar, al cambiar de pestaña y al descartar

Responde en **español neutro, sin voseo**. Este brief corrige los dos hallazgos de la lente B de la revisión de cierre
R16 (`$TMPDIR/r16-B/R16_B.md`). El coordinador los confirmó en el código de `9c5a881`.

## Principio, el mismo que en R15B-01

Nunca puede ocurrir que una tarjeta muestre un modelo y la aplicación **use** otro, ni que se pierda en silencio un
cambio que el usuario escribió. «Usar» abarca calcular, exportar PDF o CSV y **guardar**. Toda salida con un borrador
pendiente tiene que **bloquearse con su motivo visible** o **pedir confirmación antes de descartar el borrador**.

## Hallazgos

- **R16B-01 (ALTA).** `EditorApp.tsx`, `onSave`, líneas 297-307: «Guardar», Ctrl+S y la paleta (`save`) no consultan
  los borradores pendientes. Con un material Mohr-Coulomb cambiado a Hoek-Brown sin aplicar, el archivo descargado
  trae `"model": "mohr_coulomb"`.
- **R16B-02 (MEDIA).**
  - Al cambiar de pestaña lateral (`setTab`, línea 836, y `navigateIssue`, línea 490), el panel se desmonta.
  - La limpieza de `MaterialCard` (`MaterialsPanel.tsx:259-263`) borra el registro, y `useDraft` pierde el formulario.
  - «Comprobar» se vuelve a habilitar y, al regresar, el cambio a Hoek-Brown ya no está. No sale ningún aviso.
- **Del mismo tipo, visto por el coordinador:** `createConfirmDiscard` (`editor/app/discard.ts`) solo mira
  `hasUnsavedChanges`. Si el documento está guardado pero hay un borrador pendiente, Nuevo, Abrir, Ejemplos, Talud
  simple o Recuperar lo descartan sin preguntar.

## Tareas

1. **Guardar.** Con borradores pendientes, «Guardar», Ctrl+S y la paleta **no descargan**.
   - Avisan `PENDING_DRAFTS_TEXT` con la lista de tarjetas, igual que «Comprobar».
   - El botón queda deshabilitado, con el mismo `title` y motivo que «Comprobar».
   - Test: `onSave` con un borrador no llama a `downloadText` y avisa; sin borrador, descarga.
2. **Cambio de pestaña.** Con borradores pendientes, cambiar de pestaña pide confirmación con `useConfirm` y el tono
   `danger`, siguiendo el precedente de `DISCARD_TRACE_CONFIRM`.
   - **Texto:** «Descartar los cambios sin aplicar», con el mensaje que nombra las tarjetas. Botones «Descartar
     cambios» y «Seguir editando».
   - **Al cancelar,** queda la pestaña actual con el borrador intacto.
   - **Al aceptar,** cambia de pestaña, limpia el registro y la tarjeta vuelve al modelo del documento.
   - Vale para los botones de pestaña, la navegación por teclado del `tablist` (si existe), `navigateIssue` y cualquier
     otro `setTab`. Si el destino es la misma pestaña, no pregunta.
   - La alternativa de mantener montados los paneles ocultos queda **descartada**: cambia el ciclo de vida de todos
     los paneles.
3. **Descartar el documento.** `createConfirmDiscard` también pregunta cuando hay borradores pendientes, aunque el
   documento esté guardado.
   - El mensaje dice qué se pierde: el modelo, el trazo o los borradores, combinables como ya hace `discardConfirmFor`.
   - Agrega `pendingDrafts` de forma que la función siga siendo pura y testeable. Por ejemplo, un parámetro
     `getPendingDrafts`, que en las pruebas es un doble.
4. **Deshacer, rehacer y dos tarjetas.** Comprueba y fija con tests el invariante: **no existe ningún estado sin
   bloqueo en que una tarjeta visible muestre un modelo distinto del documento**.
   - **Deshacer o rehacer con un borrador.** El borrador se conserva y el bloqueo sigue, o la tarjeta vuelve al
     documento y el registro se limpia. Documenta cuál de los dos ocurre.
   - **Dos tarjetas con borrador.** El registro tiene las dos; cada una se limpia sola al aplicar o restablecer.
   - **Eliminar el material** que tiene el borrador.
5. **Botón deshabilitado en tema oscuro (BAJA).** Hoy `button.primary:disabled` solo baja la opacidad a 0,55 y en
   oscuro parece activo.
   - Dale un estilo propio: fondo `--ui-surface-subtle`, tinta atenuada y borde de control, en claro y en oscuro.
   - Sin tocar los colores de los botones habilitados.
6. **Chrome**, con `vite preview --port 5192 --strictPort` y WASM real, en claro y en oscuro.
   - Recorre las rutas de las tareas 1 a 4, con capturas y su descripción en `$TMPDIR/r16w/`.
   - Consola sin errores y red sin respuestas ≥ 400.

## Archivos tuyos

- `apps/web/src/editor/EditorApp.tsx`
- `apps/web/src/editor/app/discard.ts` y sus tests
- `apps/web/src/editor/panels/forms.ts`, solo la API de borradores si hace falta
- `apps/web/src/editor/panels/MaterialsPanel.tsx`, solo si hace falta
- `apps/web/src/App.css`, solo la regla del botón deshabilitado
- tests nuevos `*.r16.test.ts(x)`

## Entorno y gates

- **Worktree:** `/home/xodla/archivos/opengeoslide-wt/f3b-r16w`, rama `f3b-r16w`, desde `f3b-integracion@85925ab`.
- **Variables:**
  - `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`;
  - `export CARGO_TARGET_DIR=$TMPDIR/r16w-target`.
- **WASM:** `apps/web/scripts/build-wasm.sh`.
- **Gates en `apps/web`:**
  - `pnpm test`;
  - `OGS_BIN=$CARGO_TARGET_DIR/release/ogs pnpm test` (compila antes con `cargo build --release -p ogs-cli`);
  - `pnpm exec tsc --noEmit` y `pnpm build`;
  - `OGS_BIN=… node src/report/identity.f3b.mjs`, que debe dar IGUAL contra `v0.4.0`.
- **Commits** por tarea, con rutas explícitas. Sin push, sin tags y sin merge. No subas versiones.
- **Informe:** qué cambiaste, la salida de cada gate, cada ruta del navegador con su resultado, y una línea de
  CHANGELOG.
