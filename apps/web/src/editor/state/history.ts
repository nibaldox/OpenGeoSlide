// Deshacer y rehacer sobre el historial de documentos (máx. 200 entradas, ver `HISTORY_LIMIT`).
//
// `past[past.length - 1]` es el documento anterior; `future[future.length - 1]`, el que vuelve con `redo`.
// Con un gesto abierto no se deshace ni se rehace (el gesto debe cerrarse o cancelarse antes).

import type { EditorState, ModelDoc } from '../types';
import { docBounds } from '../canvas/viewportOps';
import { pushPast, withDoc } from './reducer';

/** Factor máximo de cambio de la caja envolvente (ancho o alto) con el que se conserva el encuadre al deshacer o rehacer. */
export const REFIT_FACTOR = 2;

function spanChanged(a: number, b: number): boolean {
  const lo = Math.min(Math.abs(a), Math.abs(b));
  const hi = Math.max(Math.abs(a), Math.abs(b));
  if (hi < 1e-12) return false;
  return lo * REFIT_FACTOR < hi;
}

/**
 * ¿Hay que volver a encuadrar al pasar de `from` a `to`? Sí si cambian las unidades (las coordenadas cambian de escala) o si la caja
 * envolvente cambia más de 2× en ancho o alto (R9-06). Sin esto, deshacer una conversión SI → imperial dejaba el talud 3,3× más pequeño.
 */
export function needsRefit(from: ModelDoc, to: ModelDoc): boolean {
  if ((from.units ?? 'SI') !== (to.units ?? 'SI')) return true;
  const a = docBounds(from);
  const b = docBounds(to);
  return spanChanged(a.maxX - a.minX, b.maxX - b.minX) || spanChanged(a.maxY - a.minY, b.maxY - b.minY);
}

/** `withDoc` que además pone `ui.viewport` en `null` (el lienzo encuadra de nuevo) cuando el cambio de documento lo exige. */
function withDocRefit(state: EditorState, doc: ModelDoc, history: EditorState['history']): EditorState {
  const next = withDoc(state, doc, { history });
  if (next.ui.viewport === null || !needsRefit(state.doc, doc)) return next;
  return { ...next, ui: { ...next.ui, viewport: null } };
}

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
  return withDocRefit(state, previous, { past: past.slice(0, -1), future: [...future, state.doc] });
}

export function redo(state: EditorState): EditorState {
  if (!canRedo(state)) return state;
  const { past, future } = state.history;
  const next = future[future.length - 1];
  if (next === undefined) return state;
  return withDocRefit(state, next, { past: pushPast(past, state.doc), future: future.slice(0, -1) });
}
