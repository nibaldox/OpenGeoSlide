// Store falso mínimo para probar los paneles sin depender de la implementación real (W1). Solo cumple la interfaz
// `EditorStore`: registra todo lo que recibe y aplica unos pocos comandos para poder comprobar efectos simples.

import type { Diagnostics, EditorCommand, EditorState, EditorStore, ModelDoc, UiAction } from '../types';

export interface FakeStore extends EditorStore {
  /** Todo lo despachado, en orden, incluidas las marcas de gesto (`begin:`/`end`). */
  readonly log: Array<EditorCommand | UiAction | string>;
  /** Comandos de documento despachados (sin acciones de UI). */
  commands(): EditorCommand[];
  setState(patch: Partial<EditorState>): void;
}

export function makeState(doc: ModelDoc, patch: Partial<EditorState> = {}): EditorState {
  return {
    doc,
    revision: 0,
    docEpoch: 0,
    ui: { tool: 'select', selection: { kind: 'none' }, viewport: null, snap: { vertex: true, axis: true, gridStep: null, radiusPx: 8 }, tracePoints: 0 },
    history: { past: [], future: [] },
    file: { name: null, savedRevision: 0 },
    diagnostics: { status: 'idle', issues: [], revision: 0 },
    gesture: null,
    ...patch,
  };
}

export function createFakeStore(doc: ModelDoc, patch: Partial<EditorState> = {}): FakeStore {
  let state = makeState(doc, patch);
  const listeners = new Set<() => void>();
  const log: FakeStore['log'] = [];
  const emit = (): void => listeners.forEach((l) => l());

  const store: FakeStore = {
    log,
    commands: () => log.filter((e): e is EditorCommand => typeof e !== 'string' && !e.type.startsWith('ui/')),
    setState(p) {
      state = { ...state, ...p };
      emit();
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(action) {
      log.push(action);
      switch (action.type) {
        case 'surface/set':
          state = { ...state, doc: { ...state.doc, analysis: { ...state.doc.analysis, surface: action.surface } } };
          break;
        case 'search/set':
          state = { ...state, doc: { ...state.doc, analysis: { ...state.doc.analysis, search: action.search } } };
          break;
        case 'ui/select':
          state = { ...state, ui: { ...state.ui, selection: action.selection } };
          break;
        default:
          break;
      }
      emit();
    },
    undo() {
      log.push('undo');
    },
    redo() {
      log.push('redo');
    },
    beginGesture(label) {
      log.push(`begin:${label}`);
    },
    endGesture() {
      log.push('end');
    },
    cancelGesture() {
      log.push('cancel');
    },
    setDiagnostics(d: Diagnostics) {
      state = { ...state, diagnostics: d };
      emit();
    },
  };
  return store;
}
