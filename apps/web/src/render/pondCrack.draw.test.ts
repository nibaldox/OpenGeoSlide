import { describe, expect, it } from 'vitest';
import { drawSection } from './drawSection';
import { buildScene } from './scene';
import type { SectionPalette } from '../theme/sectionPalette';
import type { MethodReport, Model } from '../engine/types';

// V047a con 2 m de agua al pie (piezométrica en y = 27) y un resultado simulado con grieta de tracción (F5.3, F5.4).
const model = {
  version: '0.5',
  units: 'SI',
  materials: [{ id: 'soil', name: 'Suelo' }],
  regions: [{ material: 'soil', polygon: [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]] }],
  water: { piezometric_line: [[20, 27], [70, 27]] },
  analysis: { tension_crack: { depth: 2.4, water_fill: 1 } },
} as unknown as Model;

const slice = (xl: number, xr: number, yl: number, yr: number) => ({ x_left: xl, x_right: xr, y_base_left: yl, y_base_right: yr, y_top_mid: 30 });
const method = {
  status: 'converged',
  surface: { xc: 52, yc: 45, r: 24 },
  slices: [slice(30, 38, 25, 23), slice(38, 47, 23, 32.6)],
  tension_crack: { x: 47, depth: 2.4, water_force: 28.2 },
} as unknown as MethodReport;

const pal = { bg: 'BG', grid: 'GRID', axis: 'AXIS', axisText: 'TEXT', halo: 'HALO', regionEdge: 'EDGE', surface: 'SURF', surfaceUnconverged: 'UNCONV', piezo: 'PIEZO', pond: 'POND', reinforcement: 'REINF', sliceFill: 'SFILL', sliceEdge: 'SEDGE', materials: ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6'], materialUnknown: 'MU' } as SectionPalette;

function record() {
  const log: Array<[string, string]> = [];
  const texts: string[] = [];
  const dashes: number[][] = [];
  let fill = '';
  let stroke = '';
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'measureText') return () => ({ width: 10 });
        if (k === 'setLineDash') return (d: number[]) => void dashes.push([...d]);
        if (k === 'fillText') return (t: string) => void texts.push(t);
        if (k === 'fill' || k === 'fillRect') return () => void log.push(['fill', fill]);
        if (k === 'stroke' || k === 'strokeRect') return () => void log.push(['stroke', stroke]);
        return () => undefined;
      },
      set: (_t, k, v) => {
        if (k === 'fillStyle') fill = String(v);
        if (k === 'strokeStyle') stroke = String(v);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, log, texts, dashes };
}

describe('Casos: agua embalsada y grieta en el Canvas 2D', () => {
  it('buildScene trae el polígono del agua y la geometría de la grieta', () => {
    const scene = buildScene(model, method);
    expect(scene.pond).toHaveLength(1);
    expect(scene.crack?.x).toBe(47);
    expect(scene.crack?.dir).toBe(-1);
    expect(buildScene(model, { ...method, tension_crack: undefined } as never).crack).toBeUndefined();
    expect(buildScene({ ...model, water: undefined } as never, method).pond).toBeUndefined();
  });

  it('el agua se rellena con el token del estanque, después de los materiales y antes que la piezométrica', () => {
    const r = record();
    drawSection(r.ctx, 800, 500, 1, buildScene(model, method), pal);
    const firstPond = r.log.findIndex(([, c]) => c === 'POND');
    expect(firstPond).toBeGreaterThan(r.log.findIndex(([, c]) => c === 'M0'));
    expect(firstPond).toBeLessThan(r.log.findIndex(([k, c]) => k === 'stroke' && c === 'PIEZO'));
  });

  it('la grieta va discontinua con el color de la superficie, con su profundidad y Pw', () => {
    const r = record();
    drawSection(r.ctx, 800, 500, 1, buildScene(model, method), pal);
    expect(r.dashes).toContainEqual([5, 4]);
    expect(r.texts).toContain('Grieta d = 2,4 m');
    expect(r.texts).toContain('Pw = 28,2 kN/m');
  });

  it('grieta seca: rótulo de la profundidad, sin Pw ni flecha', () => {
    const r = record();
    const dry = { ...method, tension_crack: { x: 47, depth: 2.4, water_force: 0 } } as MethodReport;
    drawSection(r.ctx, 800, 500, 1, buildScene({ ...model, analysis: { tension_crack: { depth: 2.4, water_fill: 0 } } } as never, dry), pal);
    expect(r.texts).toContain('Grieta d = 2,4 m');
    expect(r.texts.some((t) => t.startsWith('Pw'))).toBe(false);
  });

  it('sin grieta ni agua el dibujo no cambia: ni relleno POND ni rótulos de grieta', () => {
    const r = record();
    drawSection(r.ctx, 800, 500, 1, buildScene({ ...model, water: undefined, analysis: {} } as never, { ...method, tension_crack: undefined } as never), pal);
    expect(r.log.some(([, c]) => c === 'POND')).toBe(false);
    expect(r.texts.some((t) => t.startsWith('Grieta') || t.startsWith('Pw'))).toBe(false);
    expect(r.dashes).not.toContainEqual([5, 4]);
  });
});
