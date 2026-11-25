// Descartar el trabajo actual (Nuevo, Abrir, Ejemplos, Talud simple, Recuperar borrador): la pregunta y la guarda.
// Lógica pura: la confirmación llega por parámetro (`useConfirm()` en la interfaz, un doble en las pruebas).

import type { ConfirmOptions } from '../../ui/confirmQueue';

export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

/** Lo mínimo del almacén que hace falta para saber si hay cambios sin guardar. */
export interface DirtyStateSource {
  getState(): { revision: number; file: { savedRevision: number } };
}

export const DISCARD_CONFIRM: ConfirmOptions = {
  title: 'Descartar los cambios sin guardar',
  message:
    'El modelo actual tiene cambios que no se han guardado en un archivo. Si continúa, se reemplaza por el nuevo y se pierde también el historial de deshacer. ' +
    'Si quiere conservarlos, cancele y guarde antes con Ctrl+S.',
  confirmLabel: 'Descartar cambios',
  cancelLabel: 'Seguir editando',
  tone: 'danger',
};

export function hasUnsavedChanges(store: DirtyStateSource): boolean {
  const s = store.getState();
  return s.revision !== s.file.savedRevision;
}

/** Sin cambios sin guardar no se pregunta nada; con cambios, `true` solo si el usuario acepta descartarlos. */
export function createConfirmDiscard(store: DirtyStateSource, confirm: ConfirmFn): () => Promise<boolean> {
  return async () => (hasUnsavedChanges(store) ? await confirm(DISCARD_CONFIRM) : true);
}

/** Ejecuta `run` solo si el usuario acepta descartar; si cancela, no se toca nada. Devuelve si se ejecutó. */
export async function runIfDiscarded(confirmDiscard: () => boolean | Promise<boolean>, run: () => void): Promise<boolean> {
  if (!(await confirmDiscard())) return false;
  run();
  return true;
}
