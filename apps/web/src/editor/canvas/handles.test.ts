import { describe, expect, it } from 'vitest';
import { makeDoc } from './fakeStore';
import { handleKey, handleList, handleSelection, handleWorldPoint, selectionHandle, stepHandle } from './handles';

describe('tiradores del lienzo (orden de recorrido)', () => {
  it('orden: vértices por región, puntos de la piezométrica, centro y radio del círculo', () => {
    const list = handleList(makeDoc());
    expect(list).toHaveLength(15);
    expect(handleKey(list[0])).toBe('v-0-0');
    expect(handleKey(list[3])).toBe('v-0-3');
    expect(handleKey(list[4])).toBe('v-1-0');
    expect(handleKey(list[10])).toBe('p-0');
    expect(handleKey(list[13])).toBe('c-center');
    expect(handleKey(list[14])).toBe('c-radius');
  });

  it('sin piezométrica ni círculo solo hay vértices', () => {
    const doc = makeDoc();
    doc.water = null;
    doc.analysis.surface = null;
    expect(handleList(doc)).toHaveLength(10);
  });

  it('selección ↔ tirador: el círculo distingue centro y radio con `circlePart`', () => {
    expect(selectionHandle({ kind: 'vertex', regionIndex: 1, vertexIndex: 2 })).toEqual({ kind: 'vertex', regionIndex: 1, vertexIndex: 2 });
    expect(selectionHandle({ kind: 'piezo_point', index: 1 })).toEqual({ kind: 'piezo_point', index: 1 });
    expect(selectionHandle({ kind: 'surface_circle' })).toEqual({ kind: 'circle_center' });
    expect(selectionHandle({ kind: 'surface_circle' }, 'radius')).toEqual({ kind: 'circle_radius' });
    expect(selectionHandle({ kind: 'region', regionIndex: 0 })).toBeNull();
    expect(handleSelection({ kind: 'circle_radius' })).toEqual({ kind: 'surface_circle' });
    expect(handleSelection({ kind: 'vertex', regionIndex: 0, vertexIndex: 1 })).toEqual({ kind: 'vertex', regionIndex: 0, vertexIndex: 1 });
  });

  it('stepHandle avanza y retrocede; sin vuelta devuelve null en los extremos; con vuelta da la vuelta', () => {
    const list = handleList(makeDoc());
    expect(stepHandle(list, list[0], 1, false)).toEqual(list[1]);
    expect(stepHandle(list, list[14], 1, false)).toBeNull();
    expect(stepHandle(list, list[0], -1, false)).toBeNull();
    expect(stepHandle(list, list[14], 1, true)).toEqual(list[0]);
    expect(stepHandle(list, list[0], -1, true)).toEqual(list[14]);
    expect(stepHandle(list, null, 1, true)).toEqual(list[0]);
    expect(stepHandle([], null, 1, true)).toBeNull();
  });

  it('handleWorldPoint da la posición en el mundo de cada tirador', () => {
    const doc = makeDoc();
    expect(handleWorldPoint(doc, { kind: 'vertex', regionIndex: 1, vertexIndex: 4 })).toEqual([20, 20]);
    expect(handleWorldPoint(doc, { kind: 'piezo_point', index: 2 })).toEqual([60, 6]);
    expect(handleWorldPoint(doc, { kind: 'circle_center' })).toEqual([30, 30]);
    const r = handleWorldPoint(doc, { kind: 'circle_radius' });
    expect(r?.[0]).toBeCloseTo(30 + 25 * Math.SQRT1_2, 9);
    expect(handleWorldPoint(doc, { kind: 'vertex', regionIndex: 9, vertexIndex: 0 })).toBeNull();
  });
});
