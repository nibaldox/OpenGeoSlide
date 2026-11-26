import { describe, expect, it } from 'vitest';
import { crackDepthText, crackForceText, crackGeometry, crackShape, crackTitle } from './crack';
import type { Slice } from '../engine/types';
import type { Viewport } from '../geometry/viewport';

// Resultado simulado de V047a (talud hacia la izquierda), con grieta en x_c = 47 y profundidad 2,4: la masa queda a la izquierda.
const slice = (xl: number, xr: number, yl: number, yr: number): Slice => ({ x_left: xl, x_right: xr, y_base_left: yl, y_base_right: yr, y_top_mid: 30 }) as Slice;
const slices = [slice(30, 38, 25, 23), slice(38, 47, 23, 32.6)];
const vp: Viewport = { scale: 10, tx: 0, ty: 400, width: 800, height: 400 };

describe('crackGeometry (F5.4, G1 a G3)', () => {
  it('sin grieta, sin dovelas o con datos no finitos da null', () => {
    expect(crackGeometry(undefined, slices)).toBeNull();
    expect(crackGeometry(null, slices)).toBeNull();
    expect(crackGeometry({ x: 47, depth: 2.4, water_force: 0 }, [])).toBeNull();
    expect(crackGeometry({ x: Number.NaN, depth: 2.4, water_force: 0 }, slices)).toBeNull();
    expect(crackGeometry({ x: 47, depth: 0, water_force: 0 }, slices)).toBeNull();
  });

  it('toma la base en x_c del borde de dovela y sube la profundidad hasta el terreno', () => {
    const g = crackGeometry({ x: 47, depth: 2.4, water_force: 28.2 }, slices, 1);
    expect(g).not.toBeNull();
    expect(g?.yBase).toBe(32.6);
    expect(g?.yTop).toBeCloseTo(35, 12);
    expect(g?.hw).toBeCloseTo(2.4, 12);
    expect(g?.yForce).toBeCloseTo(32.6 + 0.8, 12);
  });

  it('Pw va hacia la masa: dovelas a la izquierda de x_c → −x; a la derecha → +x', () => {
    expect(crackGeometry({ x: 47, depth: 2.4, water_force: 1 }, slices, 1)?.dir).toBe(-1);
    const right = [slice(47, 55, 32, 30), slice(55, 60, 30, 26)];
    expect(crackGeometry({ x: 47, depth: 2.4, water_force: 1 }, right, 1)?.dir).toBe(1);
  });

  it('la fracción de agua sale del modelo; sin ella se deduce de Pw', () => {
    expect(crackGeometry({ x: 47, depth: 2, water_force: 5 }, slices, 0.5)?.hw).toBeCloseTo(1, 12);
    expect(crackGeometry({ x: 47, depth: 2, water_force: 5 }, slices)?.waterFill).toBe(1);
    expect(crackGeometry({ x: 47, depth: 2, water_force: 0 }, slices)?.waterFill).toBe(0);
    expect(crackGeometry({ x: 47, depth: 2, water_force: 0 }, slices, 7)?.waterFill).toBe(1);
  });
});

describe('crackShape (píxeles)', () => {
  const wet = crackGeometry({ x: 47, depth: 2.4, water_force: 28.2 }, slices, 1);
  const dry = crackGeometry({ x: 47, depth: 2.4, water_force: 0 }, slices, 0);

  it('línea vertical de la base al terreno, con el sentido del eje y de pantalla', () => {
    const s = crackShape(wet!, vp);
    expect(s.top[0]).toBeCloseTo(470, 9);
    expect(s.bottom[0]).toBeCloseTo(470, 9);
    expect(s.top[1]).toBeCloseTo(400 - 350, 9);
    expect(s.bottom[1]).toBeCloseTo(400 - 326, 9);
  });

  it('con agua: hueco de agua del lado de la cresta, y flecha de la cara hacia la masa (−x) a un tercio de hw', () => {
    const s = crackShape(wet!, vp);
    expect(s.water).not.toBeNull();
    expect(s.water?.x).toBeCloseTo(470, 9); // dir = −1: el hueco queda a la derecha de la cara (cresta)
    expect(s.water?.height).toBeCloseTo(24, 9);
    expect(s.arrow?.at[0]).toBeCloseTo(470, 9);
    expect((s.arrow?.tip[0] ?? 0) < 470).toBe(true);
    expect(s.arrow?.at[1]).toBeCloseTo(400 - 10 * (32.6 + 0.8), 9);
    expect(s.forceLabel?.text).toBe('Pw = 28,2 kN/m');
    expect(s.forceLabel?.anchor).toBe('end');
    expect(s.depthLabel.anchor).toBe('start');
  });

  it('grieta seca: sin agua, sin flecha y sin rótulo de Pw', () => {
    const s = crackShape(dry!, vp);
    expect(s.water).toBeNull();
    expect(s.arrow).toBeNull();
    expect(s.forceLabel).toBeNull();
    expect(s.title).toContain('grieta seca');
  });

  it('los textos usan las unidades del modelo', () => {
    expect(crackDepthText(2.4)).toBe('Grieta d = 2,4 m');
    expect(crackDepthText(8, 'imperial')).toBe('Grieta d = 8,0 ft');
    expect(crackForceText(1500, 'imperial')).toBe('Pw = 1500,0 lbf/ft');
    expect(crackTitle({ x: 47, depth: 2.4, waterFill: 0.5, force: 7 }, 'imperial')).toBe(
      'Grieta de tracción en x = 47,0 ft, profundidad 2,4 ft; agua en la grieta 50 %, Pw = 7,0 lbf/ft',
    );
  });
});
