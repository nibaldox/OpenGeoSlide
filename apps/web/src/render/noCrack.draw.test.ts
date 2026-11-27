// E15m-12 (R13B-06): la vista «Casos» (Canvas 2D) dibuja «Sin grieta (z = 0)» cuando el motor informa la grieta con depth = 0, como el editor.
import { describe, expect, it } from 'vitest';
import { drawSection } from './drawSection';
import { buildScene } from './scene';
import { NO_CRACK_LABEL } from './crack';
import type { SectionPalette } from '../theme/sectionPalette';
import type { MethodReport, Model } from '../engine/types';

const model = {
  version: '0.5',
  units: 'SI',
  materials: [{ id: 'soil', name: 'Suelo' }],
  regions: [{ material: 'soil', polygon: [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]] }],
  analysis: { tension_crack: { depth: 'auto', water_fill: 1 } },
} as unknown as Model;
const slice = (xl: number, xr: number, yl: number, yr: number) => ({ x_left: xl, x_right: xr, y_base_left: yl, y_base_right: yr, y_top_mid: 30 });
const method = (crack: object | undefined) =>
  ({ status: 'converged', surface: { xc: 52, yc: 45, r: 24 }, slices: [slice(30, 38, 25, 23), slice(38, 47, 23, 32.6)], tension_crack: crack }) as unknown as MethodReport;
const pal = { bg: 'BG', grid: 'GRID', axis: 'AXIS', axisText: 'TEXT', halo: 'HALO', regionEdge: 'EDGE', surface: 'SURF', surfaceUnconverged: 'UNCONV', piezo: 'PIEZO', pond: 'POND', reinforcement: 'REINF', sliceFill: 'SFILL', sliceEdge: 'SEDGE', materials: ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6'], materialUnknown: 'MU' } as SectionPalette;

function record() {
  const texts: Array<{ t: string; fill: string; align: string }> = [];
  let fill = '';
  let align = '';
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'measureText') return () => ({ width: 10 });
        if (k === 'fillText') return (t: string) => void texts.push({ t, fill, align });
        return () => undefined;
      },
      set: (_t, k, v) => {
        if (k === 'fillStyle') fill = String(v);
        if (k === 'textAlign') align = String(v);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, texts };
}

describe('Casos: «Sin grieta (z = 0)» (E15m-12)', () => {
  it('buildScene conserva la grieta informada con profundidad 0 como `noCrack`, sin geometría de grieta', () => {
    const scene = buildScene(model, method({ x: 47, depth: 0, water_force: 0 }));
    expect(scene.crack).toBeUndefined();
    expect(scene.noCrack).toEqual({ x: 47, depth: 0, water_force: 0 });
    // Con profundidad, la grieta se dibuja y no hay rótulo; sin grieta en el resultado, tampoco.
    const withCrack = buildScene(model, method({ x: 47, depth: 2.4, water_force: 28.2 }));
    expect(withCrack.crack?.x).toBe(47);
    expect(withCrack.noCrack).toBeUndefined();
    expect(buildScene(model, method(undefined)).noCrack).toBeUndefined();
    expect(buildScene(model, null).noCrack).toBeUndefined();
  });

  it('drawSection escribe el rótulo una vez, con el color de la superficie y sin dibujar línea ni flecha de grieta', () => {
    const r = record();
    drawSection(r.ctx, 800, 500, 1, buildScene(model, method({ x: 47, depth: 0, water_force: 0 })), pal);
    const hits = r.texts.filter((x) => x.t === NO_CRACK_LABEL);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.fill).toBe('SURF');
    expect(NO_CRACK_LABEL).toBe('Sin grieta (z = 0)');
    expect(r.texts.some((x) => /^Grieta d =|^Pw =/.test(x.t))).toBe(false);
  });

  it('con grieta con profundidad o sin grieta en el resultado, el rótulo no sale', () => {
    for (const c of [{ x: 47, depth: 2.4, water_force: 28.2 }, undefined]) {
      const r = record();
      drawSection(r.ctx, 800, 500, 1, buildScene(model, method(c)), pal);
      expect(r.texts.some((x) => x.t === NO_CRACK_LABEL)).toBe(false);
    }
  });
});
