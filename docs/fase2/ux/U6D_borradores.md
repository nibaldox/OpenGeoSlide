# U6-D: borradores y estado (R9)

Rama `u6d-borradores` (base `59fef87`). Recorridos en `docs/fase2/ux/u6d-e2e/` (puerto 5186): `u6d_drafts.mjs` (reproduce y mide; 19 pasos)
y `u6d_axe.mjs` (axe en claro y oscuro, 1440 y 320 px). El motor (`crates/`) no cambia.

## Cambios por hallazgo

| Hallazgo | Qué cambia | Dónde |
|---|---|---|
| R9-01 | `tabDraftStorage` ya no borra «el propio y el más reciente»: `clearOwn()` (Guardar) solo toca la clave de esta pestaña; `discard(id)` (Descartar) la de la entrada ofrecida; `removeItem(DRAFT_KEY)` (lo que usa `loadDraft` al descartar uno corrupto) solo la entrada leída. «Descartar» con la pestaña dueña abierta (`openElsewhere`) solo oculta el banner y lo dice. | `draftTabs.ts`, `useDraftAutosave.ts` (`clearOwnDraft`, `discardOfferedDraft`), `EditorApp.tsx` |
| R9-02a | `attachDraftAutosave` guarda de inmediato si el autoguardado se habilita con cambios pendientes (editó con el banner a la vista y pulsó «Descartar»; también tras «Recuperar»: lo recuperado pasa a ser el borrador de esta pestaña). `beforeunload` sigue avisando mientras el autoguardado está en pausa; una vez el borrador está a salvo, no (R7-18). | `useDraftAutosave.ts` |
| R9-02b | `createPresence` recibe `born` y `renameTab`: ante el mismo `tabId`, la instancia **más nueva** (desempate por `instanceId`) se da un id propio (`sessionStorage`), migra lo que ya escribió (`rename`), cuenta el id anterior como pestaña abierta y avisa; la original conserva id y borrador. `SAME_DRAFT_TEXT` dice lo que pasa. | `draftTabs.ts`, `useDraftAutosave.ts` |
| R9-08a | `setItem` calcula el índice y borra los `dropped` **antes** de escribir. Ante `QuotaExceededError` quita el borrador ajeno más antiguo y reintenta **una** vez; si falla, limpia el índice de lo ya borrado, no deja huérfanos y el aviso de `saveDraft` (banner + anuncio) ahora recomienda guardar un archivo. | `draftTabs.ts`, `io/draft.ts` |
| R9-08b | Un `ogs.editor.draft.v1` sin `savedAt` legible cuenta como entrada más reciente: `loadDraft` emite `io.draft_invalid` y lo limpia. `loadDraftChain` repite la lectura para seguir ofreciendo el siguiente borrador válido. | `draftTabs.ts` (`readIndex`), `io/draft.ts` |
| R9-11a | `dirty` de la barra incluye `ui.tracePoints > 0`; `shouldWarnBeforeUnload` avisa con un trazo a medias aunque el borrador esté a salvo (el trazo no está en el documento). | `EditorApp.tsx`, `useDraftAutosave.ts` |
| R9-11b | Con 480 px o menos el disparador dice «Editar · <herramienta>» salvo con «Seleccionar» (`editMenuLabel`). El nombre accesible es el mismo texto visible. | `app/editMenuLabel.ts`, `EditorApp.tsx` |

## Decisiones y límites
- Tras «Recuperar» el borrador recuperado se guarda ya en la clave de la pestaña que lo recupera (consecuencia de R9-02a). El borrador de origen
  no se borra. `u5s_draft_tabs.mjs` cierra también esa pestaña antes de comprobar el banner «sin dueña» (motivo en el recorrido).
- La presencia sigue sin mensaje de «adiós» (límite de U5-S): una pestaña dueña que respondió y se cerró cuenta como abierta hasta recargar. En ese
  caso «Descartar» solo oculta el banner: nunca se pierde un borrador por esa imprecisión.
- Un guardado pendiente (menos de 1 s) en la pestaña que acaba de pulsar «Guardar» puede reescribir su borrador tras `clearOwn()`; no se tocó
  (no es de este brief).
