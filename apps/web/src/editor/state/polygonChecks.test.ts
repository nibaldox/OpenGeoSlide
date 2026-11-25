import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import { baseDoc, singleRegionDoc, square, twoRegionDoc } from './testFixtures';
import { validateLocal } from './validateLocal';
import { classifyPoint, dedupeConsecutive, findSelfIntersection, polygonsOverlap, properCross, segmentsTouch } from './polygonChecks';

const scaled = (pts: Point[], k: number): Point[] => pts.map(([x, y]): Point => [x * k, y * k]);

describe('polygonChecks', () => {
  it('properCross distingue cruce propio, contacto en T y colineales', () => {
    expect(properCross([0, 0], [10, 10], [0, 10], [10, 0], 1e-9)).toBe(true);
    expect(properCross([0, 0], [10, 0], [5, 0], [5, 5], 1e-9)).toBe(false); // T
    expect(properCross([0, 0], [10, 0], [5, 0], [15, 0], 1e-9)).toBe(false); // colineales
    expect(properCross([0, 0], [10, 0], [0, 5], [10, 5], 1e-9)).toBe(false); // paralelas
    expect(properCross([0, 0], [0, 0], [-1, 1], [1, -1], 1e-9)).toBe(false); // arista degenerada
  });
  it('segmentsTouch detecta contacto en extremo y a menos de tol', () => {
    expect(segmentsTouch([0, 0], [10, 0], [10, 0], [20, 5], 1e-9)).toBe(true);
    expect(segmentsTouch([0, 0], [10, 0], [5, 1e-10], [5, 5], 1e-9)).toBe(true);
    expect(segmentsTouch([0, 0], [10, 0], [5, 1e-3], [5, 5], 1e-9)).toBe(false);
  });
  it('classifyPoint: dentro, frontera y fuera, también en polígonos cóncavos', () => {
    const l: Point[] = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];
    expect(classifyPoint([2, 2], l, 1e-9)).toBe('inside');
    expect(classifyPoint([7, 7], l, 1e-9)).toBe('outside');
    expect(classifyPoint([10, 2], l, 1e-9)).toBe('boundary');
    expect(classifyPoint([4, 4], l, 1e-9)).toBe('boundary');
  });
  it('dedupeConsecutive conserva los índices originales', () => {
    const r = dedupeConsecutive([[0, 0], [0, 0], [5, 0], [5, 5], [0, 0]], 1e-9);
    expect(r.points).toEqual([[0, 0], [5, 0], [5, 5]]);
    expect(r.indices).toEqual([0, 2, 3]);
  });
  it('findSelfIntersection devuelve las aristas implicadas', () => {
    const r = findSelfIntersection([[0, 0], [10, 10], [10, 0], [0, 10]], 1e-9);
    expect(r).toEqual({ edgeA: 0, edgeB: 2, kind: 'cross' });
    expect(findSelfIntersection(square(0, 0, 1, 1), 1e-9)).toBeNull();
  });
  it('polygonsOverlap: regiones disjuntas con cajas lejanas', () => {
    expect(polygonsOverlap(square(0, 0, 1, 1), square(100, 100, 101, 101), 1e-9)).toBe(false);
  });
});

describe('validateLocal: la tolerancia es relativa a la escala del modelo', () => {
  it.each([1e-3, 1, 1e3, 1e6])('arista compartida y T válidas, y solape detectado, a escala %s', (k) => {
    expect(validateLocal(twoRegionDoc(scaled(square(0, 0, 10, 10), k), scaled(square(10, 0, 20, 10), k)))).toEqual([]);
    expect(validateLocal(twoRegionDoc(scaled(square(0, 0, 10, 10), k), scaled([[5, 10], [10, 15], [0, 15]], k)))).toEqual([]);
    const overlap = validateLocal(twoRegionDoc(scaled(square(0, 0, 10, 10), k), scaled(square(9, 0, 19, 10), k)));
    expect(overlap.map((i) => i.code)).toEqual(['editor.region_overlap']);
  });
  it('una espiga se detecta a cualquier escala', () => {
    for (const k of [1e-3, 1e6]) {
      expect(validateLocal(singleRegionDoc(scaled([[0, 0], [10, 0], [10, 10], [10, 6], [0, 6]], k))).map((i) => i.code)).toEqual(['editor.self_intersection']);
    }
  });
  it('el documento base sigue siendo válido tras mover un vértice a su misma posición con ruido de 1e-13', () => {
    const doc = baseDoc();
    const r1 = doc.regions[1];
    if (r1) r1.polygon[0] = [10 + 1e-13, 0];
    expect(validateLocal(doc)).toEqual([]);
  });
});
