import { describe, expect, it } from 'vitest';
import { LIGHT_SECTION_PALETTE } from '../theme/lightPalette';
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
  status: 'converged', // R9-12b: sin convergencia la superficie se dibuja discontinua
  surface: { xc: 5, yc: 12, r: 8 },
  slices: [{ x_left: 2, x_right: 5, y_base_left: 4, y_base_right: 3, y_top_mid: 7 }, { x_left: 5, x_right: 8, y_base_left: 3, y_base_right: 4, y_top_mid: 7 }],
} as never;

/** Contexto que registra cada color asignado a fillStyle/strokeStyle. */
function recorder() {
  const fills: string[] = [];
  const strokes: string[] = [];
  const widths: number[] = [];
  const fonts: string[] = [];
  const texts: string[] = [];
  const dashes: number[][] = [];
  const noop = (): void => undefined;
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) =>
        k === 'measureText' ? () => ({ width: 10 }) : k === 'setLineDash' ? (d: number[]) => void dashes.push([...d]) : k === 'fillText' ? (t: string) => void texts.push(String(t)) : noop,
      set: (_t, k, v) => {
        if (k === 'fillStyle') fills.push(String(v));
        if (k === 'strokeStyle') strokes.push(String(v));
        if (k === 'lineWidth') widths.push(Number(v));
        if (k === 'font') fonts.push(String(v));
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, fills, strokes, widths, fonts, texts, dashes };
}

const dark: SectionPalette = {
  bg: 'BG', grid: 'GRID', axis: 'AXIS', axisText: 'TEXT', halo: 'HALO', regionEdge: 'EDGE', surface: 'SURF', surfaceUnconverged: 'UNCONV', piezo: 'PIEZO', pond: 'POND', reinforcement: 'REINF',
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
    // El fondo claro sale de lightPalette.ts (atado a tokens.css por lightPalette.test.ts): no se repite el literal aquí.
    expect(light.bg).toBe(LIGHT_SECTION_PALETTE.bg);
    expect(light.materials).toHaveLength(7);
    expect(r.fills).toContain(light.materials[0]);
  });
});

describe('R9-12b: superficie que no convergió, en Casos', () => {
  it('convergida: trazo continuo con el color de la superficie crítica', () => {
    const r = recorder();
    drawSection(r.ctx, 600, 400, 1, buildScene(model, method), dark);
    expect(r.strokes).toContain('SURF');
    expect(r.strokes).not.toContain('UNCONV');
    expect(r.dashes.some((d) => d.length === 2 && d[0] === 10)).toBe(false);
  });
  it('no convergida: trazo discontinuo `10 6` y el color de «sin convergencia», nunca el de la superficie crítica', () => {
    for (const status of ['not_converged', 'invalid'] as const) {
      const scene = buildScene(model, { ...(method as object), status } as never);
      expect(scene.surface?.converged).toBe(false);
      const r = recorder();
      drawSection(r.ctx, 600, 400, 1, scene, dark);
      expect(r.strokes).toContain('UNCONV');
      expect(r.strokes).not.toContain('SURF');
      expect(r.dashes).toContainEqual([10, 6]);
    }
  });
});

describe('U2-C: unidades en los ejes', () => {
  const scene = buildScene(model, method);

  it('por defecto los ejes dicen x (m) e y (m)', () => {
    const r = recorder();
    drawSection(r.ctx, 600, 400, 1, scene, dark);
    expect(r.texts).toContain('x (m)');
    expect(r.texts).toContain('y (m)');
  });

  it('con unidades imperiales (parámetro o `scene.units`) dicen x (ft) e y (ft)', () => {
    const a = recorder();
    drawSection(a.ctx, 600, 400, 1, scene, dark, 'imperial');
    expect(a.texts).toContain('x (ft)');
    expect(a.texts).toContain('y (ft)');
    expect(a.texts).not.toContain('x (m)');
    const b = recorder();
    drawSection(b.ctx, 600, 400, 1, { ...scene, units: 'imperial' }, dark);
    expect(b.texts).toContain('x (ft)');
  });

  it('buildScene recoge la unidad del modelo', () => {
    expect(buildScene({ ...model, units: 'imperial' } as Model, null).units).toBe('imperial');
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

describe('R9-05d: piezométrica extrapolada, en Casos', () => {
  const short = { ...model, water: { piezometric_line: [[3, 4], [7, 6]] } } as unknown as Model;

  it('buildScene calcula los tramos del borde del modelo al primer/último punto (misma regla que el editor)', () => {
    expect(buildScene(short, null).piezoExtension).toEqual({ left: [[0, 4], [3, 4]], right: [[7, 6], [10, 6]] });
    expect(buildScene(model, null).piezoExtension).toBeNull(); // la línea ya cubre 0–10
    expect(buildScene({ ...model, water: undefined } as unknown as Model, null).piezoExtension).toBeNull();
  });

  it('la línea se ordena por x antes de buscar el primer y el último punto', () => {
    const shuffled = { ...model, water: { piezometric_line: [[7, 6], [3, 4]] } } as unknown as Model;
    expect(buildScene(shuffled, null).piezoExtension).toEqual({ left: [[0, 4], [3, 4]], right: [[7, 6], [10, 6]] });
  });

  it('dibuja los dos tramos punteados `1 5` con el color de la piezométrica, y ninguno si la línea cubre el ancho', () => {
    const r = recorder();
    drawSection(r.ctx, 600, 400, 1, buildScene(short, null), dark);
    expect(r.dashes.filter((d) => d.length === 2 && d[0] === 1 && d[1] === 5)).toHaveLength(2);
    const full = recorder();
    drawSection(full.ctx, 600, 400, 1, buildScene(model, null), dark);
    expect(full.dashes.some((d) => d[0] === 1 && d[1] === 5)).toBe(false);
  });

  it('solo se dibuja el lado que falta', () => {
    const rightOnly = { ...model, water: { piezometric_line: [[0, 4], [7, 6]] } } as unknown as Model;
    const scene = buildScene(rightOnly, null);
    expect(scene.piezoExtension).toEqual({ left: null, right: [[7, 6], [10, 6]] });
    const r = recorder();
    drawSection(r.ctx, 600, 400, 1, scene, dark);
    expect(r.dashes.filter((d) => d[0] === 1 && d[1] === 5)).toHaveLength(1);
  });
});
