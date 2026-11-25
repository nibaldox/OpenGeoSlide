import { describe, expect, it } from 'vitest';
import { defaultSectionPalette, type SectionPalette } from '../theme/sectionPalette';
import { drawSection } from './drawSection';
import { buildScene, materialColor, materialSlot } from './scene';
import type { Model } from '../engine/types';

// Canvas 2D de la vista de Casos: la paleta se inyecta (tema) y, sin DOM, es la clara de tokens.css (U1-T).

const model = {
  materials: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  regions: [
    { material: 'a', polygon: [[0, 0], [10, 0], [10, 5], [0, 5]] },
    { material: 'b', polygon: [[0, 5], [10, 5], [10, 9], [0, 9]] },
  ],
  water: { piezometric_line: [[0, 4], [10, 6]] },
} as unknown as Model;

const method = {
  surface: { xc: 5, yc: 12, r: 8 },
  slices: [{ x_left: 2, x_right: 5, y_base_left: 4, y_base_right: 3, y_top_mid: 7 }, { x_left: 5, x_right: 8, y_base_left: 3, y_base_right: 4, y_top_mid: 7 }],
} as never;

/** Contexto que registra cada color asignado a fillStyle/strokeStyle. */
function recorder() {
  const fills: string[] = [];
  const strokes: string[] = [];
  const widths: number[] = [];
  const fonts: string[] = [];
  const noop = (): void => undefined;
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : noop),
      set: (_t, k, v) => {
        if (k === 'fillStyle') fills.push(String(v));
        if (k === 'strokeStyle') strokes.push(String(v));
        if (k === 'lineWidth') widths.push(Number(v));
        if (k === 'font') fonts.push(String(v));
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, fills, strokes, widths, fonts };
}

const dark: SectionPalette = {
  bg: 'BG', grid: 'GRID', axis: 'AXIS', axisText: 'TEXT', halo: 'HALO', regionEdge: 'EDGE', surface: 'SURF', piezo: 'PIEZO',
  sliceFill: 'SFILL', sliceEdge: 'SEDGE', materials: ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6'], materialUnknown: 'MU',
};

describe('drawSection con SectionPalette', () => {
  const scene = buildScene(model, method);

  it('usa los colores de la paleta recibida (fondo, materiales por índice, superficie y piezométrica con halo)', () => {
    const r = recorder();
    drawSection(r.ctx, 600, 400, 1, scene, dark);
    expect(r.fills[0]).toBe('BG');
    expect(r.fills).toContain('M0');
    expect(r.fills).toContain('M1');
    expect(r.strokes).toEqual(expect.arrayContaining(['GRID', 'AXIS', 'EDGE', 'SURF', 'PIEZO', 'HALO', 'SEDGE']));
    // El halo se dibuja antes que el trazo de la superficie crítica y es más ancho.
    expect(r.strokes.indexOf('HALO', r.strokes.indexOf('SEDGE'))).toBeLessThan(r.strokes.lastIndexOf('SURF'));
  });

  it('las etiquetas de los ejes miden 12 px o más (UX-20)', () => {
    const r = recorder();
    drawSection(r.ctx, 600, 400, 1, scene, dark);
    for (const f of r.fonts) expect(Number(/(\d+)px/.exec(f)?.[1])).toBeGreaterThanOrEqual(12);
  });

  it('sin paleta (Node) usa la clara de tokens.css, sin rastro de la oscura', () => {
    const r = recorder();
    drawSection(r.ctx, 600, 400, 1, scene);
    const light = defaultSectionPalette();
    expect(r.fills[0]).toBe(light.bg);
    expect(light.bg).toBe('#ffffff');
    expect(light.materials).toHaveLength(7);
    expect(r.fills).toContain(light.materials[0]);
  });
});

describe('paleta clara por defecto y materiales', () => {
  it('materialColor referencia el token (cíclico, 7 casillas) y las escenas lo reciben', () => {
    expect(materialColor(0)).toBe('var(--canvas-mat-0)');
    expect(materialColor(7)).toBe('var(--canvas-mat-0)');
    expect(materialColor(-1)).toBe('var(--canvas-mat-6)');
    expect(materialSlot(13)).toBe(6);
    expect(buildScene(model, null).materials.map((m) => m.color)).toEqual(['var(--canvas-mat-0)', 'var(--canvas-mat-1)']);
  });
});
