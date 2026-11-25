// Hooks de React sobre el store del editor (useSyncExternalStore). La lógica pura vive en store.ts y localIssues.ts.

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type { EditorState, EditorStore, Issue } from '../types';
import { createLocalIssuesSource } from './localIssues';

/** Igualdad superficial de objetos y arreglos, para selectores que devuelven un objeto nuevo en cada llamada. */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Lee una parte del estado del editor. El selector debe ser puro. Si crea objetos nuevos en cada llamada,
 * pase `isEqual` (p. ej. `shallowEqual`) para conservar la referencia anterior mientras el contenido no cambie.
 */
export function useEditorStore<T>(
  store: EditorStore,
  selector: (state: EditorState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const cache = useRef<{ state: EditorState; selector: (state: EditorState) => T; value: T } | null>(null);
  const getSnapshot = useCallback((): T => {
    const state = store.getState();
    const cached = cache.current;
    if (cached !== null && cached.state === state && cached.selector === selector) return cached.value;
    const selected = selector(state);
    const value = cached !== null && isEqual(cached.value, selected) ? cached.value : selected;
    cache.current = { state, selector, value };
    return value;
  }, [store, selector, isEqual]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/** Incidencias de la validación local (`validateLocal`) con antirrebote de 150 ms tras cada edición. */
export function useLocalIssues(store: EditorStore, delayMs = 150): Issue[] {
  const source = useMemo(() => createLocalIssuesSource(store, { delayMs }), [store, delayMs]);
  return useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
