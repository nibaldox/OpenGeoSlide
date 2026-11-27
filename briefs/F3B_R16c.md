# Brief F3B-R16c: cierre de la verificación R16b

Responde en **español neutro, sin voseo**. La lente R16b (Antigravity, `$TMPDIR/r16-b2/R16_b2.md`) dio **APTO CON
CORRECCIONES** sobre `7b40e98`. Las cinco correcciones de R16 quedaron cerradas. Hay cinco hallazgos nuevos y el
coordinador comprobó en el código los de la web. Son dos tareas en paralelo. Las reglas del motor están en la enmienda
**E16ac**, al final de `briefs/05_CONTRATOS_FASE3B.md`.

## R16c-M: motor (Terra)

1. **R16b2-01, identidad exacta.** Implementa el `col` exacto según E16ac.
   - Modelos de partida en `$TMPDIR/r16-b2/models5/` y en los scripts `run_audit*.py`: los contactos secos con `ru` y
     el empate exacto.
   - Test nuevo en `crates/ogs-core/tests/f3b_r16_contact.rs`. Compara los bytes del informe contra un JSON de
     referencia generado con `$TMPDIR/f3b-base/ogs`, la v0.4.0, y guardado en `tests/data/f3b/r16/`, con la versión
     normalizada.
2. **R16b2-02, σ′v no finita.** El nuevo `InvalidModel` con su texto. `apply` puede devolver un enum con el tipo de
   error.
   - Tests con γw = 1e308, piezométrica en y = 1e308 y `udl` = 1e308.
3. **R16b2-04:** el rustdoc.
4. **R16b2-05:** el párrafo en `docs/limitaciones.md` y una línea en `docs/formato-ogs-json.md` si corresponde. Usa las
   cifras de `R16_b2.md`.

**Archivos tuyos:**
- `crates/ogs-core/src/{slicer,water,shansep,lib}.rs`, solo en estos caminos
- `crates/ogs-core/tests/`
- `docs/limitaciones.md` y `docs/formato-ogs-json.md`, solo las líneas de E16ac

**Gates:** los del brief `F3B_R16_motor.md`, incluida la identidad completa frente a la v0.4.0 y la batería diferencial.

## R16c-W: borradores en todos los paneles (Sonnet)

**R16b2-03 (MEDIA), confirmado por el coordinador.**
- Usan `useDraft` y **no** registran `setPendingDraft`:
  - `GeometryPanel.tsx:39`, `ProjectPanel.tsx:70`, `WaterPanel`, `SeismicPanel`, `SurfacePanel` y `LoadsPanel`;
  - el formulario `NewMaterial`.
- `useUnloadGuard` (`EditorApp.tsx:199`) tampoco considera los borradores.
- **Precedente:** el registro ya existe en `AnalysisPanel`, `MaterialsPanel`, `ReinforcementsPanel` y `SearchPanel`.

**Tareas:**
1. Cada `useDraft` con un valor que no se puede aplicar, sea inválido o incompleto, registra
   `setPendingDraft(store, '<clave estable>', '<etiqueta en español>')` y lo limpia en el `useEffect`, con el mismo
   criterio de «pendiente» que usa `MaterialCard`.
   - Las etiquetas nombran el lugar: «Vértice (x, y) de la región 2», «Agua», «Sismo», «Superficie fija», «Carga 3»,
     «Proyecto», «Material nuevo».
   - Un valor válido que se confirma al salir del campo no cuenta como pendiente.
2. `shouldWarnBeforeUnload` incluye los borradores pendientes.
3. **Tests `*.r16c.test.ts`:**
   - por panel, que un valor inválido registre el borrador y bloquee Guardar y Comprobar, y que restablecer o aplicar
     lo limpie;
   - para el cambio de pestaña;
   - para `beforeunload`.
4. **Chrome,** en el puerto 5193 con WASM real: una ruta por panel, en claro y en oscuro, con capturas en
   `$TMPDIR/r16c-w/`.

**Archivos tuyos:**
- `apps/web/src/editor/panels/*.tsx`, solo el registro
- `apps/web/src/editor/app/useDraftAutosave.ts`
- `apps/web/src/editor/EditorApp.tsx`, solo la guarda de `beforeunload`
- tests nuevos

**Gates:** los de `F3B_R16_correcciones.md`.

## Para los dos

- **Worktrees:**
  - `/home/xodla/archivos/opengeoslide-wt/f3b-r16cm`, rama `f3b-r16cm`;
  - `/home/xodla/archivos/opengeoslide-wt/f3b-r16cw`, rama `f3b-r16cw`.
- **Entorno:**
  - `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`;
  - `CARGO_TARGET_DIR=$TMPDIR/<r16cm|r16cw>-target`;
  - Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.
- **Commits** por tarea, con rutas explícitas. Sin push, sin tags y sin merge. No subas versiones.
- **Te detienes solo** ante una contradicción de física o de formato.
- **Informe:** los cambios, la salida literal de cada gate y una línea de CHANGELOG.
