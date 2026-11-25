import { describe, expect, it } from 'vitest';
import { keyActions, type KeyInput } from './keys';
import { makeDoc, makeState } from './fakeStore';
import type { Selection } from '../types';

const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...extra,
});
const ctx = (selection: Selection, gridStep: number | null = null, doc = makeDoc()) =>
  makeState(doc, { selection, snap: { vertex: true, axis: true, gridStep, radiusPx: 10 } });

describe('teclado', () => {
  it('Ctrl+Z deshace; Ctrl+Mayús+Z y Ctrl+Y rehacen (también con Meta)', () => {
    const c = ctx({ kind: 'none' });
    expect(keyActions(c, key('z', { ctrlKey: true }))).toEqual({ handled: true, actions: [{ type: 'history/undo' }] });
    expect(keyActions(c, key('Z', { ctrlKey: true, shiftKey: true })).actions).toEqual([{ type: 'history/redo' }]);
    expect(keyActions(c, key('y', { ctrlKey: true })).actions).toEqual([{ type: 'history/redo' }]);
    expect(keyActions(c, key('z', { metaKey: true })).actions).toEqual([{ type: 'history/undo' }]);
  });

  it('Supr y Retroceso quitan el vértice seleccionado; con 3 vértices no hacen nada', () => {
    const sel: Selection = { kind: 'vertex', regionIndex: 1, vertexIndex: 4 };
    for (const k of ['Delete', 'Backspace']) {
      expect(keyActions(ctx(sel), key(k))).toEqual({
        handled: true,
        actions: [
          { type: 'vertex/remove', regionIndex: 1, vertexIndex: 4 },
          { type: 'ui/select', selection: { kind: 'none' } },
        ],
      });
    }
    const tri = makeDoc();
    tri.regions[0].polygon = [[0, 0], [60, 0], [60, 5]];
    expect(keyActions(ctx({ kind: 'vertex', regionIndex: 0, vertexIndex: 0 }, null, tri), key('Delete'))).toEqual({ handled: true, actions: [] });
  });

  it('Supr quita un punto de la piezométrica (mínimo 2) y se ignora sin selección', () => {
    expect(keyActions(ctx({ kind: 'piezo_point', index: 1 }), key('Delete')).actions[0]).toEqual({
      type: 'piezo/set',
      points: [[0, 8], [60, 6]],
    });
    expect(keyActions(ctx({ kind: 'none' }), key('Delete')).handled).toBe(false);
  });

  it('las flechas mueven un paso de rejilla; Mayús = ×10; arriba es +y', () => {
    const sel: Selection = { kind: 'vertex', regionIndex: 1, vertexIndex: 4 }; // (20,20), sin vértices coincidentes
    expect(keyActions(ctx(sel, 0.5), key('ArrowRight')).actions).toEqual([
      { type: 'vertex/move', regionIndex: 1, vertexIndex: 4, to: [20.5, 20] },
    ]);
    expect(keyActions(ctx(sel, 0.5), key('ArrowUp', { shiftKey: true })).actions).toEqual([
      { type: 'vertex/move', regionIndex: 1, vertexIndex: 4, to: [20, 25] },
    ]);
    expect(keyActions(ctx(sel, 0.5), key('ArrowDown')).actions[0]).toMatchObject({ to: [20, 19.5] });
    // sin rejilla: 0,1 m, sin ruido de coma flotante
    expect(keyActions(ctx(sel, null), key('ArrowLeft')).actions[0]).toMatchObject({ to: [19.9, 20] });
  });

  it('un vértice compartido se mueve con sus coincidentes dentro de un solo gesto', () => {
    const r = keyActions(ctx({ kind: 'vertex', regionIndex: 0, vertexIndex: 3 }, 1), key('ArrowRight'));
    expect(r.actions).toEqual([
      { type: 'gesture/begin', label: 'Mover vértice' },
      { type: 'vertex/move', regionIndex: 0, vertexIndex: 3, to: [1, 5] },
      { type: 'vertex/move', regionIndex: 1, vertexIndex: 0, to: [1, 5] },
      { type: 'gesture/end' },
    ]);
  });

  it('flechas sobre un punto de la piezométrica y sobre el círculo', () => {
    expect(keyActions(ctx({ kind: 'piezo_point', index: 1 }, 1), key('ArrowUp')).actions).toEqual([
      { type: 'piezo/set', points: [[0, 8], [30, 9], [60, 6]] },
    ]);
    expect(keyActions(ctx({ kind: 'surface_circle' }, 1), key('ArrowLeft', { shiftKey: true })).actions).toEqual([
      { type: 'surface/set', surface: { type: 'circle', xc: 20, yc: 30, r: 25 } },
    ]);
  });

  it('sin selección las flechas no se consumen; Escape deselecciona; en pleno gesto no se hace nada', () => {
    expect(keyActions(ctx({ kind: 'none' }), key('ArrowLeft')).handled).toBe(false);
    expect(keyActions(ctx({ kind: 'region', regionIndex: 0 }), key('Escape')).actions).toEqual([
      { type: 'ui/select', selection: { kind: 'none' } },
    ]);
    expect(keyActions(ctx({ kind: 'vertex', regionIndex: 0, vertexIndex: 0 }), key('ArrowLeft'), true)).toEqual({ handled: false, actions: [] });
    expect(keyActions(ctx({ kind: 'none' }), key('z', { ctrlKey: true }), true).handled).toBe(false);
  });
});
