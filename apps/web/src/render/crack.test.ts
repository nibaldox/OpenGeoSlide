import { describe, expect, it } from 'vitest';
import { CRACK_LABEL_GAP, CRACK_LABEL_PX, CRACK_SHALLOW_PX, crackDepthText, crackForceText, crackGeometry, crackShape, crackTitle } from './crack';
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

// V047a con la piezométrica en y = 27 y `tension_crack { depth: "auto", water_fill: 1 }`: la grieta automática mide 0,43 m, unos 4 px a
// esta escala. Los rótulos no caben dentro de ella: con la profundidad a media altura caía sobre la línea del terreno y el de Pw junto a
// la flecha se le acercaba. Ahora se apilan sobre el terreno, del lado de la masa.
describe('crackShape: grieta poco profunda (rótulos sobre el terreno)', () => {
  const shallowSlices = [slice(30, 38, 25, 23), slice(38, 47, 23, 33.07)];
  const wet = crackGeometry({ x: 47, depth: 0.43, water_force: 0.0906 }, shallowSlices, 1)!;
  const dry = crackGeometry({ x: 47, depth: 0.43, water_force: 0 }, shallowSlices, 0)!;
  const half = CRACK_LABEL_PX / 2;

  it('es poco profunda en píxeles y deja ambos rótulos por encima de la línea del terreno', () => {
    const s = crackShape(wet, vp);
    expect(s.bottom[1] - s.top[1]).toBeCloseTo(4.3, 9);
    expect(s.shallow).toBe(true);
    // El terreno en x_c está en `top[1]`; los rótulos se miden por su caja de texto (y ± media línea), con la separación mínima.
    expect(s.depthLabel.y + half).toBeLessThanOrEqual(s.top[1] - CRACK_LABEL_GAP);
    expect(s.forceLabel!.y + half).toBeLessThanOrEqual(s.top[1] - CRACK_LABEL_GAP);
  });

  it('los rótulos de la profundidad y de Pw no se superponen: sin solape vertical y del mismo lado (el de la masa)', () => {
    const s = crackShape(wet, vp);
    const d = s.depthLabel;
    const f = s.forceLabel!;
    expect(d.y + half).toBeLessThanOrEqual(f.y - half); // la profundidad queda encima de Pw
    expect(f.y - half - (d.y + half)).toBeGreaterThanOrEqual(0);
    expect(d.anchor).toBe(f.anchor);
    expect(d.anchor).toBe('end'); // dir = −1: la masa queda a la izquierda, el texto se extiende hacia ella
    expect(d.x).toBeLessThan(s.top[0]);
    expect(f.x).toBeLessThan(s.top[0]);
  });

  it('sin agua, el rótulo de la profundidad queda solo, sobre el terreno', () => {
    const s = crackShape(dry, vp);
    expect(s.shallow).toBe(true);
    expect(s.forceLabel).toBeNull();
    expect(s.depthLabel.y + half).toBeLessThanOrEqual(s.top[1] - CRACK_LABEL_GAP);
  });

  it('con la grieta del otro lado (dir = +1) los rótulos van hacia +x y siguen sobre el terreno', () => {
    const right = [slice(47, 56, 33.07, 23), slice(56, 64, 23, 25)];
    const g = crackGeometry({ x: 47, depth: 0.43, water_force: 0.0906 }, right, 1)!;
    const s = crackShape(g, vp);
    expect(g.dir).toBe(1);
    expect(s.depthLabel.anchor).toBe('start');
    expect(s.forceLabel!.anchor).toBe('start');
    expect(s.depthLabel.x).toBeGreaterThan(s.top[0]);
    expect(s.depthLabel.y + half).toBeLessThanOrEqual(s.forceLabel!.y - half);
    expect(s.forceLabel!.y + half).toBeLessThanOrEqual(s.top[1] - CRACK_LABEL_GAP);
  });

  it('el umbral es el de un rótulo más la separación: una grieta de 2,4 m a esta escala conserva la disposición dentro de ella', () => {
    const deep = crackShape(crackGeometry({ x: 47, depth: 2.4, water_force: 28.2 }, slices, 1)!, vp);
    expect(deep.bottom[1] - deep.top[1]).toBeGreaterThanOrEqual(CRACK_SHALLOW_PX);
    expect(deep.shallow).toBe(false);
    expect(deep.depthLabel.y).toBeCloseTo(0.5 * (deep.top[1] + deep.bottom[1]), 9); // a media altura, del lado de la cresta
    expect(deep.depthLabel.anchor).toBe('start');
    // y la de Pw sobre la flecha, y no sobre ella como línea de texto (y es el centro, también en el lienzo SVG)
    expect(deep.forceLabel!.y).toBeLessThan(deep.arrow!.tip[1] - half);
    // la altura justo bajo el umbral cae del lado «poco profunda»
    const edge = crackGeometry({ x: 47, depth: (CRACK_SHALLOW_PX - 0.5) / 10, water_force: 1 }, [slice(38, 47, 23, 33.07)], 1)!;
    expect(crackShape(edge, vp).shallow).toBe(true);
  });
});
