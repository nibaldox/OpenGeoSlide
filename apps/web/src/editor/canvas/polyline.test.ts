import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import { POLYLINE_MIN_GAP, insertPolylineVertex, movePolylineVertex, removePolylineVertex, polylineCrossingMessage } from './polyline';

const P: Point[] = [[30, 25], [35, 25.5], [40, 27], [45, 29.5], [51, 35]];

describe('movePolylineVertex (F3.3: x estrictamente creciente)', () => {
  it('mueve libremente dentro de los vecinos', () => {
    const r = movePolylineVertex(P, 2, [41, 20]);
    expect(r?.points[2]).toEqual([41, 20]);
    expect(r?.clamped).toBe(false);
    expect(P[2]).toEqual([40, 27]); // no muta
  });
  it('la x no cruza la del vecino: se acota a una separación mínima y avisa', () => {
    const right = movePolylineVertex(P, 2, [47, 27]);
    expect(right?.points[2][0]).toBeCloseTo(45 - POLYLINE_MIN_GAP, 12);
    expect(right?.clamped).toBe(true);
    const left = movePolylineVertex(P, 2, [10, 27]);
    expect(left?.points[2][0]).toBeCloseTo(35 + POLYLINE_MIN_GAP, 12);
    expect(left?.clamped).toBe(true);
    // la y no se toca al acotar
    expect(left?.points[2][1]).toBe(27);
  });
  it('los extremos solo tienen un vecino', () => {
    expect(movePolylineVertex(P, 0, [-100, 25])?.points[0]).toEqual([-100, 25]);
    expect(movePolylineVertex(P, 4, [500, 35])?.clamped).toBe(false);
    expect(movePolylineVertex(P, 0, [36, 25])?.points[0][0]).toBeCloseTo(35 - POLYLINE_MIN_GAP, 12);
  });
  it('índice fuera de rango → null; sin espacio entre vecinos se conserva la x', () => {
    expect(movePolylineVertex(P, 9, [0, 0])).toBeNull();
    const tight: Point[] = [[0, 0], [0.0005, 1], [0.001, 2]];
    const r = movePolylineVertex(tight, 1, [0.0007, 3]);
    expect(r?.points[1]).toEqual([0.0005, 3]);
    expect(r?.clamped).toBe(true);
  });
  it('el mensaje del aviso es el mismo para puntero y teclado', () => {
    expect(polylineCrossingMessage()).toBe('La x de un punto de la polilínea no puede cruzar la de su vecino: se dejó junto a ella');
  });
});

describe('insertPolylineVertex / removePolylineVertex', () => {
  it('inserta el punto medio de un tramo sin cambiar la forma', () => {
    const r = insertPolylineVertex(P, 1);
    expect(r?.points).toHaveLength(6);
    expect(r?.index).toBe(2);
    expect(r?.points[2]).toEqual([37.5, 26.25]);
  });
  it('en el último punto inserta en el tramo anterior y el nuevo ocupa el penúltimo lugar', () => {
    const r = insertPolylineVertex(P, 4);
    expect(r?.points).toHaveLength(6);
    expect(r?.index).toBe(4);
    expect(r?.points[4]).toEqual([48, 32.25]);
    expect(r?.points[5]).toEqual([51, 35]);
  });
  it('no se puede insertar si el tramo es demasiado corto', () => {
    expect(insertPolylineVertex([[0, 0], [0.001, 1]], 0)).toBeNull();
    expect(insertPolylineVertex([[0, 0]], 0)).toBeNull();
  });
  it('quita un punto; mínimo 2', () => {
    expect(removePolylineVertex(P, 2)).toEqual([[30, 25], [35, 25.5], [45, 29.5], [51, 35]]);
    expect(removePolylineVertex([[0, 0], [1, 1]], 0)).toBeNull();
    expect(removePolylineVertex(P, 7)).toBeNull();
  });
});
