// R10B-02 / R10B-04b: la polilínea fija también se comprueba contra la base del modelo (envolvente inferior de las regiones), con la regla del
// motor (`Surface::below_base` + `check_block_ends`: `polyline_outside_model` es el `OutsideModel` del motor, «la polilínea sale del modelo»).

import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import { checkPolylineAgainstModel, polylineAboveBase } from './polylineGround';

type Regions = Array<{ polygon: Point[] }>;
// Terreno y = 10 en x ≤ 10, baja a y = 0 en x = 20 y sigue llano hasta 30; base llana en y = -5.
const SLOPE: Regions = [{ polygon: [[0, -5], [30, -5], [30, 0], [20, 0], [10, 10], [0, 10]] }];
// Base con un vértice: (0,-5) → (15,-8) → (30,-5).
const BENT: Regions = [{ polygon: [[0, -5], [15, -8], [30, -5], [30, 0], [20, 0], [10, 10], [0, 10]] }];

describe('polylineAboveBase (misma regla que `below_base`)', () => {
  it('una polilínea dentro del modelo está sobre la base', () => {
    expect(polylineAboveBase(SLOPE, [[5, 10], [12, 3], [20, 0]])).toBe(true);
  });
  it('un punto bajo la base no lo está', () => {
    expect(polylineAboveBase(SLOPE, [[5, 10], [12, -6], [25, 0]])).toBe(false);
  });
  it('un tramo que cruza la base entre dos vértices (extremos sobre ella) tampoco', () => {
    // base y = -5: (15, -4,9) → (25, -4,9) está sobre ella; con -5,1 en x = 15 queda bajo.
    expect(polylineAboveBase(SLOPE, [[5, 10], [15, -4.9], [25, -4.9]])).toBe(true);
    expect(polylineAboveBase(SLOPE, [[5, 10], [15, -5.1], [25, -4.9]])).toBe(false);
  });
  it('una base con un vértice (el fondo baja a -8 en x = 15): se comprueba con los vértices de las regiones', () => {
    // La base baja a -8 en x = 15 (y vale -7 en x = 10 y en x = 20): una polilínea a -6 queda sobre ella.
    expect(polylineAboveBase(BENT, [[5, 5], [10, -6], [20, -6], [25, 5]])).toBe(true);
    // (14, -8,5) está bajo la base (-7,8).
    expect(polylineAboveBase(BENT, [[5, 5], [14, -8.5], [25, 5]])).toBe(false);
    // (20, -7,9) queda bajo la base (-7) aunque (10, -6,5) esté sobre la suya (-7).
    expect(polylineAboveBase(BENT, [[5, 5], [10, -6.5], [20, -7.9], [25, 5]])).toBe(false);
  });
});

describe('checkPolylineAgainstModel: terreno y base, el orden del motor', () => {
  it('admisible: devuelve la polilínea ajustada', () => {
    const r = checkPolylineAgainstModel(SLOPE, [[8, 8], [14, -2], [22, -0.5]]);
    expect(r.ok).toBe(true);
  });
  it('bajo la base: polyline_outside_model (OutsideModel)', () => {
    expect(checkPolylineAgainstModel(SLOPE, [[8, 8], [14, -9], [22, -1]])).toEqual({ ok: false, reason: 'polyline_outside_model' });
  });
  it('el error del terreno tiene prioridad (el motor ajusta antes de cortar)', () => {
    expect(checkPolylineAgainstModel(SLOPE, [[5, 10], [15, 12], [25, 0]])).toMatchObject({ ok: false, reason: 'polyline_outside_ground' });
  });
});
