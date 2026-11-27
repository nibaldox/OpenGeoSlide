// Descartar el trabajo actual (Nuevo, Abrir, Ejemplos, Talud simple, Recuperar borrador): la pregunta y la guarda.
// Lógica pura: la confirmación llega por parámetro (`useConfirm()` en la interfaz, un doble en las pruebas).

import type { ConfirmOptions } from '../../ui/confirmQueue';
import { traceDiscardConfirm, traceToolSwitchNeedsConfirm } from '../canvas/trace';
import type { Tool } from '../types';

export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

/** Lo mínimo del almacén que hace falta para saber si hay cambios sin guardar. */
export interface DirtyStateSource {
  getState(): { revision: number; file: { savedRevision: number }; ui?: { tracePoints?: number } };
}

type DirtyState = ReturnType<DirtyStateSource['getState']>;

export const DISCARD_CONFIRM: ConfirmOptions = {
  title: 'Descartar los cambios sin guardar',
  message:
    'El modelo actual tiene cambios que no se han guardado en un archivo. Si continúa, se reemplaza por el nuevo y se pierde también el historial de deshacer. ' +
    'Si quiere conservarlos, cancele y guarde antes con Ctrl+S.',
  confirmLabel: 'Descartar cambios',
  cancelLabel: 'Seguir editando',
  tone: 'danger',
};

/** Solo hay un trazo a medias («Dibujar región» o «Dividir región»): el modelo no cambió, pero se perdería. */
export const DISCARD_TRACE_CONFIRM = (points: number): ConfirmOptions => ({
  title: 'Descartar el trazo en curso',
  message:
    `Hay un trazo de ${tracePhrase(points)} sin cerrar. Si continúa se descarta y no se puede deshacer. ` +
    'Para conservarlo, cancele y ciérrelo con Intro.',
  confirmLabel: 'Descartar el trazo',
  cancelLabel: 'Seguir trazando',
  tone: 'danger',
});

function tracePhrase(points: number): string {
  return `${points} ${points === 1 ? 'punto' : 'puntos'}`;
}

const tracePoints = (s: DirtyState): number => s.ui?.tracePoints ?? 0;

/** Cambios sin guardar: el documento editado desde el último guardado o un trazo con puntos (A-08). */
export function hasUnsavedChanges(store: DirtyStateSource): boolean {
  const s = store.getState();
  return s.revision !== s.file.savedRevision || tracePoints(s) > 0;
}

/** Lista de tarjetas con cambios sin aplicar, para los mensajes («Material m1, Búsqueda»). */
const draftsPhrase = (drafts: readonly string[]): string => drafts.join(', ');

/** Hay borradores de tarjeta sin aplicar al modelo: no cambian el documento, pero se perderían (R16B-02). */
export const DISCARD_DRAFTS_CONFIRM = (drafts: readonly string[]): ConfirmOptions => ({
  title: 'Descartar los cambios sin aplicar',
  message:
    `Hay cambios sin aplicar al modelo en: ${draftsPhrase(drafts)}. Si continúa se descartan, la tarjeta vuelve al modelo del documento y no se puede deshacer. ` +
    'Para conservarlos, cancele y complete o corrija la tarjeta hasta que se aplique al modelo.',
  confirmLabel: 'Descartar cambios',
  cancelLabel: 'Seguir editando',
  tone: 'danger',
});

/**
 * Cambio de pestaña lateral (R16B-02): el panel que se abandona se desmonta y con él se pierde el formulario de sus tarjetas.
 * Con borradores sin aplicar pide confirmación (tono `danger`); si el usuario acepta, `clearDrafts` limpia el registro y la
 * tarjeta vuelve al modelo del documento. Resuelve a `false` si cancela (queda la pestaña actual con el borrador intacto).
 * Sin borradores, o si el destino es la pestaña actual, no pregunta.
 */
export function createTabSwitch<T>(opts: {
  getPendingDrafts: () => readonly string[];
  clearDrafts: () => void;
  confirm: ConfirmFn;
  /** Opciones extra de la confirmación (el foco vuelve a la pestaña actual al cancelar). */
  confirmExtras?: (from: T, to: T) => Partial<ConfirmOptions>;
}): (from: T, to: T) => Promise<boolean> {
  return async (from, to) => {
    if (from === to) return true;
    const drafts = opts.getPendingDrafts();
    if (drafts.length === 0) return true;
    if (!(await opts.confirm({ ...DISCARD_DRAFTS_CONFIRM(drafts), ...opts.confirmExtras?.(from, to) }))) return false;
    opts.clearDrafts();
    return true;
  };
}

/** Texto de la confirmación según qué se perdería: el modelo, solo el trazo, o ambos. */
export function discardConfirmFor(s: DirtyState): ConfirmOptions {
  const trace = tracePoints(s);
  const modelDirty = s.revision !== s.file.savedRevision;
  if (trace === 0) return DISCARD_CONFIRM;
  if (!modelDirty) return DISCARD_TRACE_CONFIRM(trace);
  return { ...DISCARD_CONFIRM, message: `${DISCARD_CONFIRM.message} También se descarta el trazo en curso (${tracePhrase(trace)}).` };
}

/** Sin cambios sin guardar no se pregunta nada; con cambios, `true` solo si el usuario acepta descartarlos. */
export function createConfirmDiscard(store: DirtyStateSource, confirm: ConfirmFn): () => Promise<boolean> {
  return async () => (hasUnsavedChanges(store) ? await confirm(discardConfirmFor(store.getState())) : true);
}

/** Lo mínimo del almacén para cambiar de herramienta. */
export interface ToolSwitchStore {
  getState(): { ui: { tool: Tool; tracePoints?: number } };
  dispatch(action: { type: 'ui/tool'; tool: Tool }): void;
}

/**
 * Cambio de herramienta (barra, atajos, paneles): con un trazo de 3 o más puntos pide confirmación (tono `danger`); con 1 o 2 lo
 * cambia sin preguntar y el lienzo anuncia el descarte (A-04, B-08). Resuelve a `false` si el usuario cancela.
 */
export function createToolSwitch(store: ToolSwitchStore, confirm: ConfirmFn): (tool: Tool) => Promise<boolean> {
  return async (tool) => {
    const { ui } = store.getState();
    if (traceToolSwitchNeedsConfirm(ui.tracePoints ?? 0, ui.tool, tool)) {
      if (!(await confirm(traceDiscardConfirm(ui.tracePoints ?? 0)))) return false;
    }
    store.dispatch({ type: 'ui/tool', tool });
    return true;
  };
}

/** Ejecuta `run` solo si el usuario acepta descartar; si cancela, no se toca nada. Devuelve si se ejecutó. */
export async function runIfDiscarded(confirmDiscard: () => boolean | Promise<boolean>, run: () => void): Promise<boolean> {
  if (!(await confirmDiscard())) return false;
  run();
  return true;
}
