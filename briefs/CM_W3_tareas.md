# CM-W3 · Correcciones de la web por la revisión adversarial (lente B)

Base: `cm-integracion` en `08c2246`. Los informes y la evidencia están en `$TMPDIR/rcm-B/`: `RCM_B.md`, `models/`, los
guiones `e2e_part*.mjs` y las capturas del PDF en `pdf_pages/`. El contrato es E17f de `briefs/06_CONTRATOS_CM.md`, más
E17e §6 para la nota de tracción. Las reglas comunes están en `briefs/CM_W1_tareas.md` §«Reglas comunes»: puertas,
Chrome, commits, cuándo parar e informe. Los commits llevan el mensaje `CM-W3A: …` o `CM-W3B: …`.

`apps/web/src/editor/state/validateLocal.ts` es del motor (CM-M2), que iguala los mensajes de rango. No lo toques.

| Escritor | Worktree / rama | Puerto | Archivos propios |
|---|---|---|---|
| **CM-W3A** salidas | `opengeoslide-wt/cm-w3a` / `cm-w3a` | 5184 | `apps/web/src/report/**`, `ui/ResultsTable.tsx`, `ui/HelpDialog.tsx`, `editor/app/ResultSummary.tsx`, `resultSummary.ts`, `resultSummary.css`, `shellModel.ts`, `onboarding/helpContent.ts` y `engine/warnings.ts`, con sus tests; `verification/tools/identity_exceptions.json` solo si cambia la identidad del informe (E17f §2) |
| **CM-W3B** editor | `opengeoslide-wt/cm-w3b` / `cm-w3b` | 5185 | `apps/web/src/io/ogsJson.ts`, `editor/panels/SearchPanel.tsx`, `forms.ts`, `MaterialsPanel.tsx`, `editor/app/ExamplePicker.tsx` y `editor/EditorApp.tsx`, con sus tests |

## CM-W3A · Salidas

1. **RCM-B-01:** la semilla y `generated` del informe se escriben con `String`, nunca con `fmtParam`. Va con un test que
   usa `Number.MAX_SAFE_INTEGER`.
2. **RCM-B-06:** el PDF dibuja la superficie del método que rige (E17f §2).
   - Comprueba la identidad con `node src/report/identity.f3b.mjs` y con `identity.v07.mjs`. Si cambia, declara la
     excepción con su causa, nombrando los modelos.
   - Rasteriza el PDF de V053 y el de V051 (`$TMPDIR/rcm-B/models/scenario_*.ogs.json`) y confirma que la figura dice el
     mismo método que el HUD.
3. **RCM-B-07:** la línea «Búsqueda global: …» del HUD (E17f §1).
   - Tiene que caber en el barrido de CM-WB (`$TMPDIR/cm-wb/sweep/`, 0 controles cruzados) y en `hudFit`.
   - A 320 px va en la parte desplegada, no en la píldora.
4. **RCM-B-08 y E17e §6:**
   - la entrada `global-search` de la Ayuda describe el descarte sucesivo 4 → 3 → 1 (60, 150 y 1500 evaluaciones) y
     el pulido, con el tope real de evaluaciones;
   - el texto de la nota `non_circular_global_tension_rejected` dice que cubre toda la etapa global y que
     `tension_rejected` cuenta solo los candidatos de la generación.
5. **RCM-B-10:** con una convergencia parcial y FS ≥ 1, el chip lleva el mínimo en `details`. Si cabe en 40 caracteres,
   también el FS.
6. **RCM-B-12:**
   - los rótulos `q = … kPa` del PDF no salen del recuadro de la sección;
   - la tabla «Búsqueda global» del PDF no corta «Morgenstern-Price». Usa la abreviatura de la tabla de resultados o
     ajusta el ancho de las columnas.
7. **RCM-B-13:** la tabla del refinamiento nombra al ganador del refinamiento (`polyline_fos` frente a `seed_fos`), no a
   la superficie ganadora global. Si gana la global, lo dice: «Polilínea (global)».
8. **RCM-B-15:** la leyenda de atajos de la Ayuda dice que `Ctrl+Intro`, `Ctrl+S` y `Ctrl+O` también funcionan dentro de
   los campos.

## CM-W3B · Editor

1. **RCM-B-03:**
   - `openOgsJson` rechaza `global.algorithm` fuera de `auto`, `block` y `annealing` con `io.shape`, con el mismo texto
     de los otros enums;
   - además, `SearchPanel` y `forms.ts` nunca reemplazan en silencio un valor desconocido. Si llega uno, por ejemplo
     desde un borrador viejo, se ve como error de campo.
   - **Tests:** el modelo `$TMPDIR/rcm-B/models/edge_algo_typo.ogs.json`.
2. **RCM-B-02:** los 7 botones destacados del selector de ejemplos tienen como nombre accesible el texto visible, o un
   texto que lo contiene (WCAG 2.5.3). Pasa axe sin violaciones serias, en claro y en oscuro.
3. **RCM-B-11:** el filtro del selector tiene su propia etiqueta, «Filtrar ejemplos por id o título». El texto «Todos
   los ejemplos, por tipo» queda como encabezado.
4. **RCM-B-04:** `NewMaterial` se reinicia con `docEpoch`, como pide W1-1a. Al hacer Nuevo o Abrir, se cierra o vuelve
   al formulario inicial.
5. **RCM-B-05:** la tabla `ocr_by_elevation` de SHANSEP cumple W1-1c, igual que `WaterPanel`:
   - con una fila pendiente, «Agregar fila» y «Quitar» quedan deshabilitados, con `RowsPendingNote` y
     `aria-describedby`;
   - «Agregar fila» nunca inserta un `NaN`.
6. **RCM-B-09:** después de importar sobre el modelo de arranque y deshacer hasta el documento inicial sin haber
   guardado:
   - el rótulo vuelve a «Ejemplo: …»;
   - el documento vuelve a estar limpio;
   - `pristineStart` vuelve a ser cierto, así que una segunda importación propone «Reemplazar» otra vez.

   Hazlo con el historial; no compares documentos enteros en cada render.

## Comprobación (los dos)

- Puertas en `apps/web`: `pnpm typecheck && OGS_BIN=… pnpm test && pnpm build`. Vale también
  `OGS_V07_ENGINE=1 OGS_BIN=…`, con el binario v0.7 de tu worktree.
- Reproduce cada hallazgo con el guion de `$TMPDIR/rcm-B/` que corresponda, adaptado a tu puerto, antes y después.
- Corre los guiones de `docs/cm/e2e/`, `docs/cm/c1w-e2e/`, `u3o-e2e`, `u3i-e2e`, `u5s-e2e`, `u4p-e2e`,
  `docs/fase2/ux/u6d-e2e` y `docs/suite-a/e2e/aceptacion_ua.mjs` (con `OGS_Q`) contra tu build, con 0 FAIL.
- CM-W3A agrega las capturas del PDF rasterizado de V053 y V051 y del HUD con la línea global, en 1440 × 900 y en
  320 × 568.
