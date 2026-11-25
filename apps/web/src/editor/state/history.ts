// Deshacer y rehacer sobre el historial de documentos (máx. 200 entradas, ver `HISTORY_LIMIT`).
//
// `past[past.length - 1]` es el documento anterior; `future[future.length - 1]`, el que vuelve con `redo`.
// Con un gesto abierto no se deshace ni se rehace (el gesto debe cerrarse o cancelarse antes).

import type { EditorState } from '../types';
import { pushPast, withDoc } from './reducer';

export function canUndo(state: EditorState): boolean {
  return state.gesture === null && state.history.past.length > 0;
}

export function canRedo(state: EditorState): boolean {
  return state.gesture === null && state.history.future.length > 0;
}

export function undo(state: EditorState): EditorState {
  if (!canUndo(state)) return state;
  const { past, future } = state.history;
  const previous = past[past.length - 1];
  if (previous === undefined) return state;
  return withDoc(state, previous, {
    history: { past: past.slice(0, -1), future: [...future, state.doc] },
  });
}

export function redo(state: EditorState): EditorState {
  if (!canRedo(state)) return state;
  const { past, future } = state.history;
  const next = future[future.length - 1];
  if (next === undefined) return state;
  return withDoc(state, next, {
    history: { past: pushPast(past, state.doc), future: future.slice(0, -1) },
  });
}
