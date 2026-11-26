import { describe, expect, it } from 'vitest';
import { pondMaxDepth, pondPolygons } from './pond';
import type { Point } from '../engine/types';

// V047a: talud 2:1 de 10 m (terreno (20,25) → (30,25) → (50,35) → (70,35)), con agua embalsada al pie.
const V047A = [{ polygon: [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]] as Point[] }];

const area = (poly: readonly Point[]): number => {
  let a = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const [x1, y1] = poly[i] as Point;
    const [x2, y2] = poly[(i + 1) % poly.length] as Point;
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
};

describe('pondPolygons (E15c, E1: agua embalsada en todo el modelo)', () => {
  it('sin piezométrica o con la piezométrica bajo el terreno no hay agua embalsada', () => {
    expect(pondPolygons(V047A, null)).toEqual([]);
    expect(pondPolygons(V047A, [])).toEqual([]);
    expect(pondPolygons(V047A, [[20, 22], [70, 22]])).toEqual([]);
    expect(pondMaxDepth(V047A, [[20, 22], [70, 22]])).toBe(0);
  });

  it('piezométrica 2 m sobre el pie: un polígono hasta el cruce con el talud, con el área exacta', () => {
    // Nivel 27 sobre el terreno plano (y = 25, 10 m) y el talud 1:2 hasta y = 27 (x = 34): área = 10·2 (rectángulo x∈[20,30]) + ½·4·2.
    const polys = pondPolygons(V047A, [[20, 27], [70, 27]]);
    expect(polys).toHaveLength(1);
    const poly = polys[0] as Point[];
    expect(area(poly)).toBeCloseTo(10 * 2 + 0.5 * 4 * 2, 9);
    expect(Math.min(...poly.map((p) => p[0]))).toBe(20);
    expect(Math.max(...poly.map((p) => p[0]))).toBeCloseTo(34, 9);
    expect(poly).toContainEqual([34, 27]);
    expect(pondMaxDepth(V047A, [[20, 27], [70, 27]])).toBeCloseTo(2, 12);
  });

  it('la piezométrica corta se prolonga en horizontal hasta el borde del modelo', () => {
    const [poly] = pondPolygons(V047A, [[25, 27], [28, 27]]);
    expect(Math.min(...(poly as Point[]).map((p) => p[0]))).toBe(20);
    expect(area(poly as Point[])).toBeCloseTo(20 + 4, 9);
  });

  it('la piezométrica inclinada parte el polígono en sus vértices y en el cruce con el talud', () => {
    // De y = 28 en x = 20 a 24 en x = 40: sobre el plano (y = 25) hasta x = 30 (h de 3 a 1) y cruza el talud en x = 220/7.
    const [poly] = pondPolygons(V047A, [[20, 28], [40, 24]]);
    const p = poly as Point[];
    const xc = 220 / 7;
    expect(p.some(([x, y]) => Math.abs(x - xc) < 1e-9 && Math.abs(y - (25 + 0.5 * (xc - 30))) < 1e-9)).toBe(true);
    expect(p.some(([x, y]) => x === 30 && Math.abs(y - 26) < 1e-12)).toBe(true);
    expect(Math.max(...p.map((q) => q[0]))).toBeCloseTo(xc, 9);
    expect(area(p)).toBeCloseTo(20 + 0.5 * 1 * (xc - 30), 9);
  });

  it('un paramento vertical (cara de presa) deja un borde vertical y un solo polígono', () => {
    // Presa: terreno plano y = 10 de 0 a 10, muro vertical hasta y = 20 en x = 10, coronamiento hasta 20. Agua a nivel 15 al pie.
    const dam = [{ polygon: [[0, 0], [0, 10], [10, 10], [10, 20], [20, 20], [20, 0]] as Point[] }];
    const polys = pondPolygons(dam, [[0, 15], [20, 15]]);
    expect(polys).toHaveLength(1);
    const p = polys[0] as Point[];
    expect(area(p)).toBeCloseTo(10 * 5, 9);
    expect(p).toContainEqual([10, 15]);
    expect(p).toContainEqual([10, 10]);
  });

  it('dos charcas separadas dan dos polígonos', () => {
    const wavy = [{ polygon: [[0, 0], [0, 10], [10, 5], [20, 10], [30, 5], [40, 10], [40, 0]] as Point[] }];
    const polys = pondPolygons(wavy, [[0, 7], [40, 7]]);
    expect(polys).toHaveLength(2);
  });
});
