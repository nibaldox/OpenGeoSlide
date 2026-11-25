// Validación local con antirrebote (X3 §2.5): fuente de incidencias locales para la UI, sin React.

import type { EditorStore, Issue } from '../types';
import { validateLocalCached } from './validateLocal';

export interface LocalIssuesSource {
  /** Incidencias del último documento validado (referencia estable entre cambios). */
  getSnapshot(): Issue[];
  subscribe(listener: () => void): () => void;
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const REAL_TIMERS: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Valida `store.getState().doc` y vuelve a validar 150 ms (por defecto) después del último cambio de `doc`.
 * La primera lectura es síncrona. Mientras hay suscriptores escucha al store; sin ellos no hace nada.
 */
export function createLocalIssuesSource(
  store: EditorStore,
  options: { delayMs?: number; timers?: Timers } = {},
): LocalIssuesSource {
  const delayMs = options.delayMs ?? 150;
  const timers = options.timers ?? REAL_TIMERS;
  const listeners = new Set<() => void>();
  let validatedDoc = store.getState().doc;
  let issues = validateLocalCached(validatedDoc);
  let handle: unknown = null;
  let unsubscribeStore: (() => void) | null = null;

  const flush = (): void => {
    handle = null;
    const doc = store.getState().doc;
    if (doc === validatedDoc) return;
    validatedDoc = doc;
    issues = validateLocalCached(doc);
    for (const l of [...listeners]) l();
  };

  const onStore = (): void => {
    if (store.getState().doc === validatedDoc && handle === null) return;
    if (handle !== null) timers.clearTimeout(handle);
    handle = timers.setTimeout(flush, delayMs);
  };

  return {
    getSnapshot: () => issues,
    subscribe(listener) {
      listeners.add(listener);
      if (unsubscribeStore === null) {
        unsubscribeStore = store.subscribe(onStore);
        onStore(); // el documento pudo cambiar mientras nadie escuchaba
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && unsubscribeStore !== null) {
          unsubscribeStore();
          unsubscribeStore = null;
          if (handle !== null) {
            timers.clearTimeout(handle);
            handle = null;
          }
        }
      };
    },
  };
}
