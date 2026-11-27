// E15l-15: el lienzo no dibuja una grieta con `depth = 0` (ni línea, ni agua, ni flecha) y la rotula «Sin grieta (z = 0)».
import { describe, expect, it } from 'vitest';
import type { Slice } from '../engine/types';
import type { Viewport } from '../geometry/viewport';
import { NO_CRACK_LABEL, crackGeometry, noCrackLabel } from './crack';

const vp: Viewport = { scale: 10, tx: 0, ty: 400, width: 800, height: 400 };
const slice = (xl: number, xr: number): Slice =>
  ({ x_left: xl, x_right: xr, y_base_left: 20, y_base_right: 22, y_top_mid: 30, width: xr - xl, alpha: 0.2, base_length: xr - xl, weight: 100, cohesion: 3, tan_phi: 0.35, pore_pressure: 0, material: 0, weight_extra: 0, h_force: 0, h_moment_base: 0, driving_extra: 0, y_centroid: 0 }) as Slice;
const slices = [slice(30, 38), slice(38, 47)];

describe('lienzo: grieta con depth = 0', () => {
  it('crackGeometry no la dibuja y noCrackLabel la rotula del lado de la masa', () => {
    const c = { x: 30, depth: 0, water_force: 0 };
    expect(crackGeometry(c, slices, 1)).toBeNull();
    const l = noCrackLabel(c, slices, vp);
    expect(l?.text).toBe(NO_CRACK_LABEL);
    expect(l?.text).toBe('Sin grieta (z = 0)');
    expect(l?.anchor).toBe('start'); // la masa queda a la derecha de x_c = 30
    expect(l!.x).toBeGreaterThan(300);
  });
  it('con profundidad > 0, sin grieta o sin dovelas no hay rótulo', () => {
    expect(noCrackLabel({ x: 47, depth: 2.4, water_force: 28.2 }, slices, vp)).toBeNull();
    expect(noCrackLabel(undefined, slices, vp)).toBeNull();
    expect(noCrackLabel({ x: 30, depth: 0, water_force: 0 }, [], vp)).toBeNull();
    expect(noCrackLabel({ x: Number.NaN, depth: 0, water_force: 0 }, slices, vp)).toBeNull();
  });
});
