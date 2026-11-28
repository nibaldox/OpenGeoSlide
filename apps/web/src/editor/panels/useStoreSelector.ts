import { createContext, useCallback, useContext, useState, useSyncExternalStore } from 'react';
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
 * Época del documento (`EditorState.docEpoch`), que sube con «Nuevo», «Abrir», los ejemplos y la recuperación de un borrador.
 * `EditorApp` la entrega a los paneles con este contexto y `useDraft` la suma a sus dependencias: así, todo borrador se reinicia
 * al cambiar de documento aunque su valor sea el mismo (por ejemplo `null` antes y después), sin repetirlo panel por panel.
 */
export const DocEpochContext = createContext(0);

/**
 * Borrador de formulario: texto que el usuario está escribiendo. Se reinicia desde el documento cuando cambian
 * `deps` (por ejemplo, tras deshacer) o cuando se carga otro documento (`docEpoch`), y `reset` lo devuelve al valor del
 * documento (tecla Esc).
 */
export function useDraft<F>(make: () => F, deps: readonly unknown[]): [F, (next: F) => void, () => void] {
  const epoch = useContext(DocEpochContext);
  const all = [epoch, ...deps];
  const [state, setState] = useState(() => ({ deps: all, form: make() }));
  let current = state;
  if (!sameDeps(state.deps, all)) {
    current = { deps: all, form: make() };
    setState(current);
  }
  const set = (next: F): void => setState({ deps: current.deps, form: next });
  const reset = (): void => setState({ deps: current.deps, form: make() });
  return [current.form, set, reset];
}
