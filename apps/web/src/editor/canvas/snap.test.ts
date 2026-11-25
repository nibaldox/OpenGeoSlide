import { describe, expect, it } from 'vitest';
import { makeDoc, VP } from './fakeStore';
import { pxToMeters, snapPoint } from './snap';
import type { EditorUi } from '../types';

const snapOn: EditorUi['snap'] = { vertex: true, axis: true, gridStep: null, radiusPx: 10 };
const doc = makeDoc();

describe('snap', () => {
  it('convierte la tolerancia de píxeles a metros con la escala', () => {
    expect(pxToMeters(VP, 10)).toBe(1);
    expect(pxToMeters({ ...VP, scale: 100 }, 10)).toBeCloseTo(0.1, 12);
  });

  it('prioridad 1: vértice cercano de cualquier región', () => {
    const r = snapPoint([20.4, 19.7], { doc, vp: VP, snap: snapOn });
    expect(r).toMatchObject({ kind: 'vertex', point: [20, 20], target: { regionIndex: 1, vertexIndex: 4 } });
  });

  it('el vértice gana a eje y rejilla', () => {
    const r = snapPoint([20.4, 19.7], {
      doc,
      vp: VP,
      snap: { ...snapOn, gridStep: 5 },
      neighbors: [[20.3, 0]],
    });
    expect(r.kind).toBe('vertex');
  });

  it('la tolerancia depende del zoom: a 100 px/m el mismo desvío de 0,4 m ya no engancha', () => {
    const r = snapPoint([20.4, 19.7], { doc, vp: { ...VP, scale: 100 }, snap: snapOn });
    expect(r.kind).toBe('none');
  });

  it('ignora los vértices excluidos y respeta la bandera vertex', () => {
    const ex = snapPoint([20.1, 20.1], { doc, vp: VP, snap: snapOn, exclude: [{ regionIndex: 1, vertexIndex: 4 }] });
    expect(ex.kind).toBe('none');
    expect(snapPoint([20.1, 20.1], { doc, vp: VP, snap: { ...snapOn, vertex: false } }).kind).toBe('none');
  });

  it('prioridad 2: alineación con vecinos; el otro eje cae a la rejilla', () => {
    const r = snapPoint([35.3, 12.4], {
      doc,
      vp: VP,
      snap: { ...snapOn, gridStep: 1 },
      neighbors: [[35, 3], [50, 12.2]],
    });
    expect(r.kind).toBe('axis');
    expect(r.point).toEqual([35, 12.2]);
    expect(r.guides).toEqual({ x: 35, y: 12.2 });
    const onlyX = snapPoint([35.3, 12.4], { doc, vp: VP, snap: { ...snapOn, gridStep: 1 }, neighbors: [[35, 3]] });
    expect(onlyX.point).toEqual([35, 12]);
    expect(onlyX.guides).toEqual({ x: 35, y: null });
  });

  it('con axis desactivado no alinea', () => {
    const r = snapPoint([35.3, 12.4], { doc, vp: VP, snap: { ...snapOn, axis: false }, neighbors: [[35, 3]] });
    expect(r.kind).toBe('none');
  });

  it('prioridad 3: rejilla (siempre, sin tolerancia)', () => {
    const r = snapPoint([33.37, 11.81], { doc, vp: VP, snap: { ...snapOn, gridStep: 0.5 } });
    expect(r).toMatchObject({ kind: 'grid', point: [33.5, 12] });
  });

  it('sin nada que enganchar, redondea a la precisión del zoom', () => {
    const r = snapPoint([33.123456, 11.987654], { doc, vp: VP, snap: snapOn });
    expect(r).toMatchObject({ kind: 'none', point: [33.12, 11.99] });
  });
});
