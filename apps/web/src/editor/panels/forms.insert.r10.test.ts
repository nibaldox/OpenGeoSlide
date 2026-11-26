// R10B-04a: «Agregar» en las tablas de polilínea y de `data_points` nunca produce x o ξ duplicados o decrecientes (el redondeo a 3 decimales
// sacaba el punto nuevo de (a, b)); si no cabe un punto estrictamente entre los vecinos, no se puede agregar.

import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import { canInsertDataPoint, canInsertPolylinePoint, insertDataPoint, insertPolylinePoint } from './forms';

const strictlyIncreasing = (pts: readonly Point[]): boolean => pts.every((p, i) => i === 0 || p[0] > (pts[i - 1] as Point)[0]);

describe('insertPolylinePoint: x estrictamente creciente', () => {
  it('los contraejemplos del hallazgo (x a 0,001 y a 0,0002 de distancia) ya no duplican ni decrecen', () => {
    for (const pts of [[[10, 5], [10.001, 5]], [[10.0004, 5], [10.0006, 5]]] as Point[][]) {
      const out = insertPolylinePoint(pts, 0, [0, 100]);
      expect(strictlyIncreasing(out)).toBe(true);
      expect(out).toHaveLength(3);
    }
  });
  it('con el punto medio fuera de la rejilla de 3 decimales usa el medio exacto', () => {
    expect(insertPolylinePoint([[10.0004, 5], [10.0006, 5]], 0, [0, 100])[1]![0]).toBeCloseTo(10.0005, 12);
  });
  it('no se puede agregar si el hueco es menor que dos veces la separación mínima 1e-9·ancho (o no hay doble representable)', () => {
    const pts: Point[] = [[0, 0], [2e-9 * 1e6 * 0.999, 0]]; // ancho 1e6 → separación mínima 1e-3; el hueco 1,998e-3 < 2e-3
    expect(canInsertPolylinePoint(pts, 0, [0, 1e6])).toBe(false);
    expect(insertPolylinePoint(pts, 0, [0, 1e6])).toEqual(pts);
    const ok: Point[] = [[0, 0], [10, 0]];
    expect(canInsertPolylinePoint(ok, 0, [0, 1e6])).toBe(true);
    expect(canInsertPolylinePoint([[1, 0], [1 + Number.EPSILON, 0]], 0, null)).toBe(false);
  });
  it('tras el último punto agrega a la derecha, estrictamente creciente', () => {
    const out = insertPolylinePoint([[0, 0], [10, -2]], 1, [0, 100]);
    expect(out).toEqual([[0, 0], [10, -2], [20, -2]]);
  });
  it('el caso corriente no cambia (medio del tramo, redondeado a 3 decimales)', () => {
    expect(insertPolylinePoint([[0, 0], [10, -4]], 0, [0, 100])).toEqual([[0, 0], [5, -2], [10, -4]]);
  });
});

describe('insertDataPoint: ξ estrictamente creciente', () => {
  it('el contraejemplo del hallazgo (ξ = 0,5 y 0,501) no duplica', () => {
    const out = insertDataPoint([[0, 0], [0.5, 1], [0.501, 1], [1, 0]], 1);
    expect(strictlyIncreasing(out)).toBe(true);
    expect(out).toHaveLength(5);
  });
  it('ξ muy próximos: se usa el medio exacto; sin hueco representable no se agrega', () => {
    expect(strictlyIncreasing(insertDataPoint([[0, 0], [0.5004, 1], [0.5006, 1], [1, 0]], 1))).toBe(true);
    expect(canInsertDataPoint([[0, 0], [0.5, 1], [0.5 + 2 ** -53, 1], [1, 0]], 1)).toBe(false);
  });
  it('no se agrega tras el último punto (ξ = 1 es el final de la tabla)', () => {
    expect(canInsertDataPoint([[0, 0], [1, 1]], 1)).toBe(false);
    expect(canInsertDataPoint([[0, 0], [1, 1]], 0)).toBe(true);
  });
});
