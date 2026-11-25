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

describe('ajuste a aristas (herramientas de trazo)', () => {
  it('sin la opción `edges` un punto cerca de una arista no se ajusta (arrastrar un vértice no cambia)', () => {
    expect(snapPoint([10, 5.3], { doc, vp: VP, snap: snapOn }).kind).toBe('none');
  });
  it('con `edges`, un punto a menos de 10 px de la arista se apoya en ella sin redondear', () => {
    // región 0, arista (0,0)-(60,0) → y = 0; el punto está a 0,4 m (4 px)
    const r = snapPoint([17.123456789, 0.4], { doc, vp: VP, snap: snapOn, edges: true });
    expect(r.kind).toBe('edge');
    expect(r.point).toEqual([17.123456789, 0]);
    expect(r.edge).toEqual({ regionIndex: 0, afterIndex: 0 });
  });
  it('un vértice cercano gana a la arista; la bandera vertex apaga también el ajuste a aristas', () => {
    expect(snapPoint([0.2, 0.3], { doc, vp: VP, snap: snapOn, edges: true }).kind).toBe('vertex');
    expect(snapPoint([17, 0.4], { doc, vp: VP, snap: { ...snapOn, vertex: false }, edges: true }).kind).toBe('none');
  });
  it('en una arista inclinada el punto queda exactamente sobre ella', () => {
    // región 1: arista (40,10)-(20,20): pendiente −0,5
    const r = snapPoint([30.1, 15.2], { doc, vp: VP, snap: snapOn, edges: true });
    expect(r.kind).toBe('edge');
    expect(r.point[1]).toBeCloseTo(10 + (40 - r.point[0]) * 0.5, 9);
  });
  it('a 100 px/m la misma distancia de 0,4 m (40 px) ya no engancha', () => {
    expect(snapPoint([17, 0.4], { doc, vp: { ...VP, scale: 100 }, snap: snapOn, edges: true }).kind).toBe('none');
  });
});
