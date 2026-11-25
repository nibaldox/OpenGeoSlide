import { describe, expect, it } from 'vitest';
import { insertPiezoPoint, movePiezoPoint, removePiezoPoint } from './edits';
import { coincidentVertices, modelXRange, pointInPolygon, projectOnSegment, roundForScale, topY } from './geom';
import { makeDoc } from './fakeStore';

describe('geom', () => {
  it('proyecta sobre un segmento y acota a los extremos', () => {
    expect(projectOnSegment([5, 3], [0, 0], [10, 0])).toEqual({ point: [5, 0], t: 0.5, distance: 3 });
    expect(projectOnSegment([-4, 0], [0, 0], [10, 0]).point).toEqual([0, 0]);
    expect(projectOnSegment([14, 3], [0, 0], [10, 0]).t).toBe(1);
    expect(projectOnSegment([3, 4], [0, 0], [0, 0]).distance).toBe(5); // segmento degenerado
  });

  it('punto en polígono (par-impar)', () => {
    const sq: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(pointInPolygon([5, 5], sq)).toBe(true);
    expect(pointInPolygon([15, 5], sq)).toBe(false);
    const concave: [number, number][] = [[0, 0], [10, 0], [10, 10], [5, 3], [0, 10]];
    expect(pointInPolygon([5, 8], concave)).toBe(false);
    expect(pointInPolygon([2, 2], concave)).toBe(true);
  });

  it('ordenada del terreno y rango x del modelo', () => {
    const doc = makeDoc();
    expect(topY(doc, 0)).toBe(20);
    expect(topY(doc, 10)).toBe(20);
    expect(topY(doc, 30)).toBe(15); // sobre la pendiente (20,20)-(40,10)
    expect(topY(doc, 50)).toBe(10);
    expect(topY(doc, 61)).toBeNull();
    expect(modelXRange(doc)).toEqual([0, 60]);
  });

  it('vértices coincidentes entre regiones (el propio primero)', () => {
    const doc = makeDoc();
    expect(coincidentVertices(doc, { regionIndex: 0, vertexIndex: 3 })).toEqual([
      { regionIndex: 0, vertexIndex: 3 },
      { regionIndex: 1, vertexIndex: 0 },
    ]);
    expect(coincidentVertices(doc, { regionIndex: 1, vertexIndex: 4 })).toHaveLength(1);
    expect(coincidentVertices(doc, { regionIndex: 9, vertexIndex: 0 })).toEqual([]);
  });

  it('redondeo según la escala', () => {
    expect(roundForScale(1.23456789, 10)).toBe(1.23);
    expect(roundForScale(1.23456789, 100)).toBe(1.235);
    expect(roundForScale(1.23456789, 1000)).toBe(1.2346);
    expect(roundForScale(1.23456789, 0.1)).toBe(1.23);
  });
});

describe('edits de la piezométrica', () => {
  const pts: [number, number][] = [[0, 8], [30, 8], [60, 6]];
  it('mover acota x para conservar el orden estricto', () => {
    expect(movePiezoPoint(pts, 1, [35, 9])).toEqual([[0, 8], [35, 9], [60, 6]]);
    expect(movePiezoPoint(pts, 1, [100, 9])?.[1]).toEqual([59.999, 9]);
    expect(movePiezoPoint(pts, 1, [-5, 9])?.[1]).toEqual([0.001, 9]);
    expect(movePiezoPoint(pts, 7, [1, 1])).toBeNull();
  });
  it('insertar solo entre vecinos; quitar deja al menos 2', () => {
    expect(insertPiezoPoint(pts, 0, [10, 8])).toEqual([[0, 8], [10, 8], [30, 8], [60, 6]]);
    expect(insertPiezoPoint(pts, 0, [30, 8])).toBeNull();
    expect(insertPiezoPoint(pts, 2, [70, 5])).toEqual([[0, 8], [30, 8], [60, 6], [70, 5]]);
    expect(removePiezoPoint(pts, 1)).toEqual([[0, 8], [60, 6]]);
    expect(removePiezoPoint([[0, 1], [1, 1]], 0)).toBeNull();
  });
});
