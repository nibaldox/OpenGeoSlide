import { useCallback, useState, useSyncExternalStore } from 'react';
import type { EditorState, EditorStore } from '../types';

/**
 * Lee una parte del estado del store. El selector debe devolver una referencia estable mientras el estado no cambie
 * (p. ej. `s => s.doc.materials`); no debe construir arreglos u objetos nuevos en cada llamada.
 * Solo usa la interfaz `EditorStore` (`subscribe` y `getState`).
 */
export function useStoreSelector<T>(store: EditorStore, selector: (state: EditorState) => T): T {
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const getSnapshot = (): T => selector(store.getState());
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

/**
 * Borrador de formulario: texto que el usuario está escribiendo. Se reinicia desde el documento cuando cambian
 * `deps` (por ejemplo, tras deshacer) y `reset` lo devuelve al valor del documento (tecla Esc).
 */
export function useDraft<F>(make: () => F, deps: readonly unknown[]): [F, (next: F) => void, () => void] {
  const [state, setState] = useState(() => ({ deps, form: make() }));
  let current = state;
  if (!sameDeps(state.deps, deps)) {
    current = { deps, form: make() };
    setState(current);
  }
  const set = (next: F): void => setState({ deps: current.deps, form: next });
  const reset = (): void => setState({ deps: current.deps, form: make() });
  return [current.form, set, reset];
}
