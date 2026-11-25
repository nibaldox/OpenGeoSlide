// Autosave del borrador (io/draft.ts): 1 s después de la última edición, y al ocultar o cerrar la página.
// No guarda mientras `enabled` sea falso (p. ej. mientras se ofrece «Recuperar», para no pisar el borrador).

import { useEffect, useState } from 'react';
import { createDraftAutosaver, type DraftSaveResult, type DraftStorage } from '../../io/draft';
import type { EditorStore } from '../types';

/** Último fallo del autosave (`null` si el último guardado fue bien). */
export function useDraftAutosave(store: EditorStore, storage: DraftStorage, enabled: boolean): string | null {
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const saver = createDraftAutosaver({
      storage,
      onResult: (r: DraftSaveResult) => setFailure(r.ok ? null : r.text),
    });
    // Solo las ediciones posteriores a este momento generan un borrador.
    let last = store.getState().revision;
    const unsubscribe = store.subscribe(() => {
      const s = store.getState();
      if (s.revision === last) return;
      last = s.revision;
      saver.schedule(s.doc, s.file.name);
    });
    const flush = (): void => {
      saver.flush();
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      saver.flush();
    };
  }, [store, storage, enabled]);

  return failure;
}
