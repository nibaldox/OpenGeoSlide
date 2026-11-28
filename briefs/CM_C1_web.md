# CM-C1W · Web de la búsqueda global no circular (formato v0.7)

Base: `cm-integracion` en `85544f7` o posterior. Tiene la web de W1 (CM-WA y CM-WC); CM-WB se integra después y no
toca tus archivos. Contrato: `briefs/06_CONTRATOS_CM.md`: F7.1 (formato), F7.2 (salida), F7.5 (web) y la enmienda E17a.
El mapa de archivos y líneas está en `docs/cm/exploracion/X33.md` §2.4, §2.6 y §3. Léelo, porque señala tres trampas:
- `ogsJson.ts` y sus mensajes de versión (punto 13);
- `validateLocal.ts` y su rama de versión (punto 14);
- `mockEngine.ts` (punto 16).

**El motor se está escribiendo en paralelo** (CM-M) y su WASM todavía no existe. Programa contra el contrato:
- la entrada es `analysis.search.non_circular.global` = `{algorithm?, generated?, seed?, polish?}`;
- la salida es `NonCircularStats.global` = `{algorithm, generated, attempts, converged, eligible, tension_rejected,
  refined, evaluated, polish_evaluated, global_fos, winner}`;
- las notas son `non_circular_global_no_candidates` y `non_circular_global_tension_rejected`.

Para los tests de salida, usa fixtures escritos a mano que cumplan F7.2. El coordinador corre los e2e con el WASM real
al integrar.

| Escritor | Worktree / rama | Puerto | Archivos propios |
|---|---|---|---|
| **CM-C1W** | `opengeoslide-wt/cm-c1w` / `cm-c1w` | 5183 | `apps/web/src/engine/**`, `apps/web/src/io/**`, `apps/web/src/editor/panels/SearchPanel.tsx` y `forms.ts`, `apps/web/src/editor/state/**`, `apps/web/src/editor/app/issueNav.ts` y `shellModel.ts`, `apps/web/src/report/**`, `apps/web/src/ui/ResultsTable.tsx`, `apps/web/src/onboarding/helpContent.ts`, `apps/web/src/App.tsx` (solo la etiqueta de `:70-73`) y sus tests |

## Qué hacer

1. **Tipos y versión:**
   - `OGS_V07`, `OGS_VERSIONS`, `OgsVersion` y el mensaje de versión desconocida, con el mismo texto que el motor:
     `version debe ser "0.1", …, "0.6" o "0.7"`. Compruébalo en `loads.rs` de la rama `cm-m` cuando exista; si no
     existe, sigue el patrón de 0.6;
   - `v07Fields` y la puerta en `VERSION_FIELD_TABLE`;
   - la rama 0.7 de los mensajes de apertura y de `validateLocal.ts`;
   - `mockEngine.ts` rechaza los campos 0.7 con el mensaje del motor;
   - `types.ts` gana `GlobalSpec` y `GlobalStats`, y `validate.ts` acepta `global` opcional en las estadísticas.
2. **Entrada** (`SearchPanel.tsx`, `forms.ts` y `reducer.ts`), con F7.5:
   - dentro de «Superficie no circular», una casilla **«Búsqueda global»** que escribe `global: {}`;
   - debajo, cuatro campos:
     - **Algoritmo:** Automático, «Bloque sobre capas débiles» o Recocido;
     - **Candidatos**, de 50 a 2000;
     - **Semilla**, de 0 a 2^53 − 1;
     - **Pulido**, una casilla.
   - Los valores por defecto salen de una constante compartida y **no se escriben en el documento** mientras el usuario
     no los cambie: `global: {}` se queda vacío.
   - Los borradores siguen el patrón de W1 (`useDraft` con `docEpoch`).
   - Las rutas de error y los diagnósticos llegan a cada campo (`issueNav.ts`, cuatro niveles).
   - Bishop sigue deshabilitado con `non_circular`.
3. **Salida:**
   - **Tabla de resultados:** una fila o un bloque «Búsqueda global» por método, con el ganador (global o
     refinamiento), el algoritmo, los candidatos (generados, elegibles y rechazados por tracción) y el FS global;
   - **CSV:** las columnas `global_algoritmo`, `global_generados`, `global_elegibles`, `global_rechazados_traccion`,
     `global_fs` y `global_ganador`, solo si hay `global`;
   - **PDF** (`report/content.ts`): los parámetros (algoritmo, candidatos, semilla y pulido) y la tabla de
     estadísticas;
   - el resumen de `shellModel.ts` y la etiqueta de `App.tsx`, que dicen «no circular, global».
4. **Avisos** (`warnings.ts`): los dos códigos nuevos, en `ENGINE_WARNING_CODES`, en el catálogo y en el puntero, con
   texto en español.
   - `non_circular_global_tension_rejected` explica que existe una superficie con un FS menor en la rama con tracción
     (λ < 0 o normal efectiva negativa), que no se tomó por no ser fiable, y qué hacer: comparar con la búsqueda
     circular y revisar N′ por dovela. Usa la misma idea que el aviso de V002 en `docs/limitaciones.md`.
5. **Ayuda** (`helpContent.ts`): una entrada de glosario y un párrafo en «Búsqueda no circular» que digan cuándo usar
   la búsqueda global (capas o contactos débiles, mecanismos de bloque), su costo (hasta unas 8000 evaluaciones más
   por método) y la guarda. Si cambia el conteo de términos, `u3o_onboarding` lo lee de `helpContent.ts`, así que no
   hay que tocar el guion.
6. **Identidad:** sin `global`, la web abre, guarda y exporta los documentos byte a byte igual que antes. Corre los
   tests de identidad que existen (`report/identity.*.mjs` con `OGS_BIN`) y suma uno para 0.7, que abra un documento
   con `global`, lo guarde y lo vuelva a abrir sin cambios.

## Reglas

Son las de `briefs/CM_W1_tareas.md` §«Reglas comunes»: puertas, Chrome, commits con mensaje `CM-C1W: …`, cuándo parar
e informe. Además:
- `src/wasm`, `node_modules` y `target/release/ogs` (v0.5.1) ya están en tu worktree. El WASM y la CLI **no** conocen
  0.7: los tests que necesiten el motor real con `global` márcalos como pendientes, con `it.skipIf` y la variable
  `OGS_V07_ENGINE`, y escribe en el informe qué validan. El coordinador los corre con el motor nuevo.
- **Recorrido en Chrome:** en la vista Búsqueda, marca y desmarca «Búsqueda global», cambia los cuatro campos, guarda
  y abre de nuevo. Comprueba que la versión del documento pase a 0.7 y vuelva a 0.6 al desmarcar. Corre axe en claro y
  en oscuro sobre el panel abierto. Toma capturas a 1440 × 900 y 390 × 844.
