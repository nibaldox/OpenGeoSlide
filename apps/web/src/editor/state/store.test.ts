import { describe, expect, it, vi } from 'vitest';
import type { Diagnostics } from '../types';
import { createLocalIssuesSource, type Timers } from './localIssues';
import { createEditorStore } from './store';
import { baseDoc } from './testFixtures';

describe('createEditorStore', () => {
  it('expone el estado inicial con el nombre de archivo', () => {
    const doc = baseDoc();
    const store = createEditorStore(doc, 'a.ogs.json');
    expect(store.getState().doc).toBe(doc);
    expect(store.getState().file.name).toBe('a.ogs.json');
    expect(createEditorStore(doc).getState().file.name).toBeNull();
  });

  it('notifica solo cuando el estado cambia, y deja de notificar al darse de baja', () => {
    const store = createEditorStore(baseDoc());
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.dispatch({ type: 'meta/patch', patch: { title: 'x' } });
    expect(listener).toHaveBeenCalledTimes(1);
    store.dispatch({ type: 'meta/patch', patch: { title: 'x' } }); // sin cambio
    store.dispatch({ type: 'region/remove', regionIndex: 9 }); // inválido
    store.dispatch({ type: 'ui/tool', tool: 'select' }); // ya activo
    store.undo();
    store.undo(); // sin historial
    expect(listener).toHaveBeenCalledTimes(2);
    store.dispatch({ type: 'ui/tool', tool: 'pan' });
    expect(listener).toHaveBeenCalledTimes(3);
    off();
    store.dispatch({ type: 'ui/tool', tool: 'select' });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('getState devuelve una referencia estable entre cambios (contrato de useSyncExternalStore)', () => {
    const store = createEditorStore(baseDoc());
    const a = store.getState();
    expect(store.getState()).toBe(a);
    store.dispatch({ type: 'ui/tool', tool: 'pan' });
    expect(store.getState()).not.toBe(a);
  });

  it('dispatch, undo, redo y gestos funcionan de extremo a extremo', () => {
    const store = createEditorStore(baseDoc());
    store.beginGesture('Mover');
    store.dispatch({ type: 'vertex/move', regionIndex: 0, vertexIndex: 0, to: [1, 1] });
    store.dispatch({ type: 'vertex/move', regionIndex: 0, vertexIndex: 0, to: [2, 2] });
    store.endGesture();
    expect(store.getState().history.past).toHaveLength(1);
    store.undo();
    expect(store.getState().doc.regions[0]?.polygon[0]).toEqual([0, 0]);
    store.redo();
    expect(store.getState().doc.regions[0]?.polygon[0]).toEqual([2, 2]);
    store.beginGesture('Mover');
    store.dispatch({ type: 'vertex/move', regionIndex: 0, vertexIndex: 0, to: [9, 9] });
    store.cancelGesture();
    expect(store.getState().doc.regions[0]?.polygon[0]).toEqual([2, 2]);
    expect(store.getState().gesture).toBeNull();
  });

  it('un listener que se da de baja durante la notificación no rompe a los demás', () => {
    const store = createEditorStore(baseDoc());
    const second = vi.fn();
    const off = store.subscribe(() => off());
    store.subscribe(second);
    store.dispatch({ type: 'ui/tool', tool: 'pan' });
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('setDiagnostics guarda el diagnóstico de la revisión actual y marca stale el de otra', () => {
    const store = createEditorStore(baseDoc());
    store.dispatch({ type: 'meta/patch', patch: { title: 'x' } });
    const rev = store.getState().revision;
    const ok: Diagnostics = { status: 'ok', issues: [], revision: rev };
    store.setDiagnostics(ok);
    expect(store.getState().diagnostics).toEqual(ok);
    store.setDiagnostics({ status: 'error', issues: [], revision: rev - 1 });
    expect(store.getState().diagnostics.status).toBe('stale');
    store.setDiagnostics({ status: 'checking', issues: [], revision: rev });
    expect(store.getState().diagnostics.status).toBe('checking');
    store.dispatch({ type: 'meta/patch', patch: { title: 'y' } });
    expect(store.getState().diagnostics.status).toBe('stale'); // la edición invalida lo comprobado
    expect(store.getState().history.past).toHaveLength(2); // setDiagnostics no entra en el historial
  });

  it('markSaved registra la revisión guardada', () => {
    const store = createEditorStore(baseDoc());
    store.dispatch({ type: 'meta/patch', patch: { title: 'x' } });
    store.markSaved('guardado.ogs.json');
    expect(store.getState().file).toEqual({ name: 'guardado.ogs.json', savedRevision: 1 });
  });
});

describe('createLocalIssuesSource (antirrebote 150 ms)', () => {
  function fakeTimers(): Timers & { advance(ms: number): void } {
    let now = 0;
    let nextId = 1;
    const pending = new Map<number, { at: number; fn: () => void }>();
    return {
      setTimeout(fn, ms) {
        const id = nextId++;
        pending.set(id, { at: now + ms, fn });
        return id;
      },
      clearTimeout(handle) {
        pending.delete(handle as number);
      },
      advance(ms) {
        now += ms;
        for (const [id, t] of [...pending]) {
          if (t.at <= now) {
            pending.delete(id);
            t.fn();
          }
        }
      },
    };
  }

  it('valida al instante la primera vez y revalida 150 ms después del último cambio', () => {
    const timers = fakeTimers();
    const store = createEditorStore(baseDoc());
    const source = createLocalIssuesSource(store, { timers });
    expect(source.getSnapshot()).toEqual([]);
    const listener = vi.fn();
    const off = source.subscribe(listener);

    store.dispatch({ type: 'material/upsert', material: { id: 'm1', name: 'm1', model: 'mohr_coulomb', unit_weight: -1, cohesion: 1, friction_angle: 1 } });
    timers.advance(100);
    expect(listener).not.toHaveBeenCalled();
    expect(source.getSnapshot()).toEqual([]);
    store.dispatch({ type: 'meta/patch', patch: { title: 'otro' } }); // reinicia el antirrebote
    timers.advance(100);
    expect(listener).not.toHaveBeenCalled();
    timers.advance(50);
    expect(listener).toHaveBeenCalledTimes(1);
    const issues = source.getSnapshot();
    expect(issues.map((i) => i.path)).toEqual(['/materials/0/unit_weight']);
    expect(source.getSnapshot()).toBe(issues); // referencia estable

    store.dispatch({ type: 'ui/tool', tool: 'pan' }); // un cambio de UI no revalida
    timers.advance(1000);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('sin suscriptores no escucha al store', () => {
    const timers = fakeTimers();
    const store = createEditorStore(baseDoc());
    const source = createLocalIssuesSource(store, { timers });
    store.dispatch({ type: 'meta/patch', patch: { title: 'x' } });
    timers.advance(1000);
    const listener = vi.fn();
    const off = source.subscribe(listener); // al suscribirse detecta que el documento cambió
    timers.advance(150);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });
});
