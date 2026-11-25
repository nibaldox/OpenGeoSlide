// Ayudas SOLO para tests del lienzo: un EditorStore falso mínimo (no usa la implementación de W1) y un modelo de prueba.
// Implementa solo los comandos que usa el lienzo; el resto de comandos se ignoran.

import type { Point } from '../../engine/types';
import type { Viewport } from '../../geometry/viewport';
import type { Diagnostics, EditorCommand, EditorState, EditorStore, ModelDoc, UiAction } from '../types';

/**
 * Dos regiones que comparten la arista y = 5:
 *   región 0 (m2, abajo): (0,0) (60,0) (60,5) (0,5)
 *   región 1 (m1, arriba): (0,5) (60,5) (60,10) (40,10) (20,20) (0,20)
 */
export function makeDoc(): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.2',
    meta: { title: 'Prueba' },
    units: 'SI',
    materials: [
      { id: 'm1', name: 'Arcilla', model: 'mohr_coulomb', unit_weight: 18, cohesion: 10, friction_angle: 25 },
      { id: 'm2', name: 'Roca', model: 'mohr_coulomb', unit_weight: 24, cohesion: 50, friction_angle: 35 },
    ],
    regions: [
      { material: 'm2', polygon: [[0, 0], [60, 0], [60, 5], [0, 5]] },
      { material: 'm1', polygon: [[0, 5], [60, 5], [60, 10], [40, 10], [20, 20], [0, 20]] },
    ],
    water: { unit_weight: 9.81, piezometric_line: [[0, 8], [30, 8], [60, 6]] },
    loads: [],
    slope: { direction: 'left_to_right' },
    analysis: { methods: ['bishop'], surface: { type: 'circle', xc: 30, yc: 30, r: 25 } },
  };
}

/** Viewport de prueba: 10 px/m, pantalla (20 + 10x, 300 − 10y). */
export const VP: Viewport = { scale: 10, tx: 20, ty: 300, width: 800, height: 600 };

export function toPx(x: number, y: number): [number, number] {
  return [VP.tx + VP.scale * x, VP.ty - VP.scale * y];
}

export function makeState(doc: ModelDoc = makeDoc(), patch: Partial<EditorState['ui']> = {}): Pick<EditorState, 'doc' | 'ui'> {
  return {
    doc,
    ui: {
      tool: 'select',
      selection: { kind: 'none' },
      viewport: VP,
      snap: { vertex: true, axis: true, gridStep: null, radiusPx: 10 },
      ...patch,
    },
  };
}

export interface FakeStore extends EditorStore {
  /** Entradas del historial (un `before` por entrada). */
  past: ModelDoc[];
  future: ModelDoc[];
  /** Registro de llamadas, en orden. */
  log: string[];
}

export function createFakeStore(doc: ModelDoc = makeDoc(), patch: Partial<EditorState['ui']> = {}): FakeStore {
  const base = makeState(doc, patch);
  let doc0 = base.doc;
  let ui = base.ui;
  let gesture: { label: string; before: ModelDoc } | null = null;
  let revision = 0;
  let diagnostics: Diagnostics = { status: 'idle', issues: [], revision: 0 };
  const listeners = new Set<() => void>();
  let version = 0;
  let cache: { version: number; state: EditorState } | null = null;
  const store: FakeStore = {
    past: [],
    future: [],
    log: [],
    getState(): EditorState {
      // Instantánea estable entre cambios (useSyncExternalStore lo exige).
      if (cache && cache.version === version) return cache.state;
      const state: EditorState = {
        doc: doc0,
        revision,
        ui,
        history: { past: store.past, future: store.future },
        file: { name: null, savedRevision: 0 },
        diagnostics,
        gesture,
      };
      cache = { version, state };
      return state;
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    dispatch(a: EditorCommand | UiAction) {
      store.log.push(a.type);
      switch (a.type) {
        case 'ui/select':
          ui = { ...ui, selection: a.selection };
          break;
        case 'ui/tool':
          ui = { ...ui, tool: a.tool };
          break;
        case 'ui/viewport':
          ui = { ...ui, viewport: a.viewport };
          break;
        case 'ui/snap':
          ui = { ...ui, snap: { ...ui.snap, ...a.patch } };
          break;
        case 'vertex/move':
          change({
            ...doc0,
            regions: doc0.regions.map((r, ri) =>
              ri === a.regionIndex ? { ...r, polygon: r.polygon.map((p, vi): Point => (vi === a.vertexIndex ? a.to : p)) } : r,
            ),
          });
          break;
        case 'vertex/insert':
          change({
            ...doc0,
            regions: doc0.regions.map((r, ri) => {
              if (ri !== a.regionIndex) return r;
              const polygon = [...r.polygon];
              polygon.splice(a.afterIndex + 1, 0, a.at);
              return { ...r, polygon };
            }),
          });
          break;
        case 'vertex/remove':
          change({
            ...doc0,
            regions: doc0.regions.map((r, ri) =>
              ri === a.regionIndex && r.polygon.length > 3 ? { ...r, polygon: r.polygon.filter((_, vi) => vi !== a.vertexIndex) } : r,
            ),
          });
          break;
        case 'piezo/set':
          change({ ...doc0, water: { ...(doc0.water ?? {}), piezometric_line: a.points } });
          break;
        case 'surface/set':
          change({ ...doc0, analysis: { ...doc0.analysis, surface: a.surface } });
          break;
        default:
          break;
      }
      emit();
    },
    undo() {
      store.log.push('undo');
      const prev = store.past.pop();
      if (prev) {
        store.future.push(doc0);
        doc0 = prev;
        revision++;
      }
      emit();
    },
    redo() {
      store.log.push('redo');
      const next = store.future.pop();
      if (next) {
        store.past.push(doc0);
        doc0 = next;
        revision++;
      }
      emit();
    },
    beginGesture(label) {
      store.log.push('beginGesture');
      gesture = { label, before: doc0 };
      version++;
    },
    endGesture() {
      store.log.push('endGesture');
      if (gesture && gesture.before !== doc0) {
        store.past.push(gesture.before);
        store.future.length = 0;
      }
      gesture = null;
      version++;
    },
    cancelGesture() {
      store.log.push('cancelGesture');
      if (gesture) doc0 = gesture.before;
      gesture = null;
      emit();
    },
    setDiagnostics(d) {
      diagnostics = d;
      emit();
    },
  };

  function change(next: ModelDoc): void {
    if (!gesture) {
      store.past.push(doc0);
      store.future.length = 0;
    }
    doc0 = next;
    revision++;
  }
  function emit(): void {
    version++;
    for (const l of listeners) l();
  }
  return store;
}
