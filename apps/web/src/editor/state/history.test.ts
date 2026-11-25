import { describe, expect, it } from 'vitest';
import type { EditorCommand, EditorState } from '../types';
import { canRedo, canUndo, redo, undo } from './history';
import { baseDoc } from './testFixtures';
import { beginGesture, cancelGesture, createInitialState, endGesture, HISTORY_LIMIT, reduce } from './reducer';

const move = (i: number, to: [number, number]): EditorCommand => ({ type: 'vertex/move', regionIndex: 0, vertexIndex: i, to });
const fresh = (): EditorState => createInitialState(baseDoc());

describe('undo / redo', () => {
  it('sin historial no hacen nada', () => {
    const s = fresh();
    expect(undo(s)).toBe(s);
    expect(redo(s)).toBe(s);
    expect(canUndo(s)).toBe(false);
    expect(canRedo(s)).toBe(false);
  });

  it('deshacen y rehacen en orden, y suben la revisión en cada paso', () => {
    const s0 = fresh();
    const s1 = reduce(s0, move(0, [1, 1]));
    const s2 = reduce(s1, move(1, [9, 1]));
    expect(s2.revision).toBe(2);

    const u1 = undo(s2);
    expect(u1.doc).toBe(s1.doc);
    expect(u1.revision).toBe(3);
    expect(u1.history.future).toEqual([s2.doc]);
    const u2 = undo(u1);
    expect(u2.doc).toBe(s0.doc);
    expect(u2.history.past).toEqual([]);
    expect(canUndo(u2)).toBe(false);
    expect(canRedo(u2)).toBe(true);

    const r1 = redo(u2);
    expect(r1.doc).toBe(s1.doc);
    const r2 = redo(r1);
    expect(r2.doc).toBe(s2.doc);
    expect(r2.history.past).toEqual([s0.doc, s1.doc]);
    expect(r2.history.future).toEqual([]);
    expect(redo(r2)).toBe(r2);
  });

  it('un comando nuevo tras deshacer descarta el futuro', () => {
    const s = undo(reduce(reduce(fresh(), move(0, [1, 1])), move(1, [9, 1])));
    expect(s.history.future).toHaveLength(1);
    const n = reduce(s, { type: 'meta/patch', patch: { title: 'otra rama' } });
    expect(n.history.future).toEqual([]);
    expect(canRedo(n)).toBe(false);
  });

  it('Ctrl+Z tras doc/load no restaura el documento anterior ni su nombre (R7-08)', () => {
    const s0 = fresh();
    const other = { ...baseDoc(), meta: { title: 'Abierto' } };
    const s1 = reduce(s0, { type: 'doc/load', doc: other, fileName: 'b.ogs.json' });
    expect(canUndo(s1)).toBe(false);
    expect(undo(s1)).toBe(s1);
  });

  it('deshacer un doc/replace restaura el documento anterior', () => {
    const s0 = fresh();
    const other = { ...baseDoc(), meta: { title: 'Abierto' } };
    const s1 = reduce(s0, { type: 'doc/replace', doc: other, fileName: 'a.ogs.json' });
    const u = undo(s1);
    expect(u.doc).toBe(s0.doc);
    expect(redo(u).doc).toBe(other);
  });

  it('deja stale el diagnóstico y no toca la UI salvo una selección que ya no existe', () => {
    let s = reduce(fresh(), { type: 'region/add', region: { material: 'm1', polygon: [[30, 0], [40, 0], [40, 10]] } });
    s = reduce(s, { type: 'ui/select', selection: { kind: 'region', regionIndex: 2 } });
    s = { ...s, diagnostics: { status: 'error', issues: [], revision: s.revision } };
    const u = undo(s);
    expect(u.diagnostics.status).toBe('stale');
    expect(u.ui.selection).toEqual({ kind: 'none' }); // la región 2 ya no existe
    expect(u.ui.tool).toBe(s.ui.tool);
  });

  it('el límite de 200 también rige al rehacer', () => {
    let s = fresh();
    for (let i = 0; i < HISTORY_LIMIT; i += 1) s = reduce(s, move(0, [0, -(i + 1)]));
    expect(s.history.past).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < 10; i += 1) s = undo(s);
    for (let i = 0; i < 10; i += 1) s = redo(s);
    expect(s.history.past).toHaveLength(HISTORY_LIMIT);
    expect(s.history.future).toHaveLength(0);
  });
});

describe('gestos', () => {
  it('beginGesture guarda before y las acciones del gesto no apilan', () => {
    const s0 = fresh();
    let s = beginGesture(s0, 'Mover vértice');
    expect(s.gesture).toEqual({ label: 'Mover vértice', before: s0.doc });
    s = reduce(s, move(0, [1, 1]));
    s = reduce(s, move(0, [2, 2]));
    s = reduce(s, move(0, [3, 3]));
    expect(s.doc.regions[0]?.polygon[0]).toEqual([3, 3]);
    expect(s.history.past).toEqual([]);
    expect(s.revision).toBe(3);
  });

  it('endGesture apila una sola entrada: el documento previo al gesto', () => {
    const s0 = fresh();
    let s = beginGesture(s0, 'Mover vértice');
    for (let i = 1; i <= 5; i += 1) s = reduce(s, move(0, [i, i]));
    s = endGesture(s);
    expect(s.gesture).toBeNull();
    expect(s.history.past).toEqual([s0.doc]);
    expect(s.history.future).toEqual([]);
    const u = undo(s);
    expect(u.doc).toBe(s0.doc);
    expect(redo(u).doc.regions[0]?.polygon[0]).toEqual([5, 5]);
  });

  it('endGesture sin cambios (o con el mismo resultado) no apila nada', () => {
    const s0 = fresh();
    expect(endGesture(beginGesture(s0, 'nada')).history.past).toEqual([]);
    let s = beginGesture(s0, 'ida y vuelta');
    s = reduce(s, move(0, [5, 5]));
    s = reduce(s, move(0, [0, 0]));
    s = endGesture(s);
    expect(s.history.past).toEqual([]);
    expect(s.gesture).toBeNull();
  });

  it('endGesture vacía future', () => {
    let s = undo(reduce(fresh(), move(0, [1, 1])));
    expect(s.history.future).toHaveLength(1);
    s = beginGesture(s, 'g');
    s = reduce(s, move(1, [9, 9]));
    s = endGesture(s);
    expect(s.history.future).toEqual([]);
  });

  it('cancelGesture restaura before sin tocar el historial', () => {
    const s0 = reduce(fresh(), move(0, [1, 1]));
    let s = beginGesture(s0, 'g');
    s = reduce(s, move(0, [7, 7]));
    s = reduce(s, move(2, [7, 8]));
    const c = cancelGesture(s);
    expect(c.doc).toBe(s0.doc);
    expect(c.gesture).toBeNull();
    expect(c.history).toEqual(s0.history);
    expect(c.revision).toBeGreaterThan(s.revision);
  });

  it('cancelGesture sin cambios solo cierra el gesto, y fuera de un gesto no hace nada', () => {
    const s0 = fresh();
    const c = cancelGesture(beginGesture(s0, 'g'));
    expect(c.gesture).toBeNull();
    expect(c.revision).toBe(s0.revision);
    expect(cancelGesture(s0)).toBe(s0);
    expect(endGesture(s0)).toBe(s0);
  });

  it('beginGesture dentro de un gesto conserva el primero', () => {
    const s = beginGesture(fresh(), 'uno');
    expect(beginGesture(s, 'dos')).toBe(s);
  });

  it('no se deshace ni se rehace con un gesto abierto', () => {
    const s = beginGesture(reduce(fresh(), move(0, [1, 1])), 'g');
    expect(undo(s)).toBe(s);
    expect(canUndo(s)).toBe(false);
  });

  it('los comandos inválidos dentro de un gesto no lo alteran', () => {
    const s = beginGesture(fresh(), 'g');
    expect(reduce(s, { type: 'vertex/move', regionIndex: 9, vertexIndex: 0, to: [0, 0] })).toBe(s);
  });

  it('las UiAction dentro de un gesto no lo alteran ni apilan', () => {
    let s = beginGesture(fresh(), 'g');
    s = reduce(s, { type: 'ui/tool', tool: 'pan' });
    s = endGesture(s);
    expect(s.history.past).toEqual([]);
  });
});
