// Store del editor: fachada `EditorStore` (editor/types.ts) sobre el reductor puro.

import type { Diagnostics, EditorCommand, EditorState, EditorStore, ModelDoc, UiAction } from '../types';
import { redo as redoState, undo as undoState } from './history';
import {
  beginGesture as beginGestureState,
  cancelGesture as cancelGestureState,
  createInitialState,
  endGesture as endGestureState,
  markSaved as markSavedState,
  reduce,
} from './reducer';

/** `EditorStore` más `markSaved`, para que la app registre un guardado (fija `file.savedRevision`). */
export interface EditorStoreWithSave extends EditorStore {
  markSaved(fileName?: string | null): void;
}

export function createEditorStore(initial: ModelDoc, fileName: string | null = null): EditorStoreWithSave {
  let state: EditorState = createInitialState(initial, fileName);
  const listeners = new Set<() => void>();

  const update = (next: EditorState): void => {
    if (next === state) return; // los no-ops del reductor devuelven el mismo estado: no se notifica
    state = next;
    for (const listener of [...listeners]) listener();
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch: (action: EditorCommand | UiAction) => update(reduce(state, action)),
    undo: () => update(undoState(state)),
    redo: () => update(redoState(state)),
    beginGesture: (label) => update(beginGestureState(state, label)),
    endGesture: () => update(endGestureState(state)),
    cancelGesture: () => update(cancelGestureState(state)),
    setDiagnostics(d: Diagnostics) {
      // Un resultado de otra revisión ya no corresponde al documento actual: queda `stale`.
      const diagnostics: Diagnostics =
        d.status !== 'idle' && d.status !== 'stale' && d.revision !== state.revision ? { ...d, status: 'stale' } : d;
      update({ ...state, diagnostics });
    },
    markSaved: (name) => update(markSavedState(state, name)),
  };
}
