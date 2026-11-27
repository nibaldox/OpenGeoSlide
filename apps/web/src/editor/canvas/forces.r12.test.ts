// R12 / W2, E15l-22 (B-11): el punto de aplicación de la fuerza de un pilote Ito-Matsui y su información emergente.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Reinforcement, ReinforcementForce } from '../../engine/types';
import { worldToScreen } from '../../geometry/viewport';
import { buildScene } from '../../render/scene';
import { drawSection } from '../../render/drawSection';
import { EditorCanvas, type CanvasResult } from './EditorCanvas';
import { VP, createFakeStore } from './fakeStore';
import { PILE, asReinforcement, docWith, force } from './reinforcementFixtures';
import { forceShapes } from './reinforcements';

const imPile = (location: 'centroid' | 'slip_surface'): Reinforcement =>
  asReinforcement({
    id: 'pilote-im', type: 'pile', x1: 45, y1: 10, x2: 45, y2: 2, application: 'passive', direction: 'angle', angle: 0, spacing: 2.4,
    lateral_pressure: { model: 'ito_matsui', diameter: 0.8, location },
  });

/** Cruce en (45, 5) con brazo L_m = 1,5: con `centroid` la fuerza actúa en (45, 6,5). */
const imForce = (patch: Partial<ReinforcementForce> = {}): ReinforcementForce =>
  force({ id: 'pilote-im', x: 45, y: 5, station: 5, available: 80, fx: 80, fy: 0, application: 'passive', soil_force: 95.5, governs: 'shear', arm: 1.5, ...patch });

describe('E15l-22: forceShapes, punto de aplicación', () => {
  it('con centroid la flecha nace en (x, y + arm)', () => {
    const [s] = forceShapes([imForce()], VP, 'SI', [imPile('centroid')]);
    const want = worldToScreen(VP, 45, 6.5);
    expect(s!.at[0]).toBeCloseTo(want[0], 9);
    expect(s!.at[1]).toBeCloseTo(want[1], 9);
    expect(s!.tip).not.toBeNull();
  });

  it('con slip_surface la flecha nace en el cruce (x, y), aunque el motor informe arm', () => {
    const [s] = forceShapes([imForce()], VP, 'SI', [imPile('slip_surface')]);
    const want = worldToScreen(VP, 45, 5);
    expect(s!.at).toEqual(want);
  });

  it('sin la lista de refuerzos (o con arm = 0) nace en el cruce', () => {
    expect(forceShapes([imForce()], VP, 'SI')[0]!.at).toEqual(worldToScreen(VP, 45, 5));
    expect(forceShapes([imForce({ arm: 0 })], VP, 'SI', [imPile('centroid')])[0]!.at).toEqual(worldToScreen(VP, 45, 5));
  });

  it('un cruce sin aplicar queda marcado en el cruce, no en y + arm', () => {
    const [s] = forceShapes([imForce({ status: 'outside_mass' as never, fx: 0, fy: 0 })], VP, 'SI', [imPile('centroid')]);
    expect(s!.at).toEqual(worldToScreen(VP, 45, 5));
  });

  it('un pilote con force o un anclaje siguen naciendo en el cruce', () => {
    const f = force({ id: 'pilote-1', x: 45, y: 5 });
    expect(forceShapes([f], VP, 'SI', [PILE])[0]!.at).toEqual(worldToScreen(VP, 45, 5));
  });
});

describe('E15l-22: información emergente', () => {
  it('muestra la fuerza del suelo, qué gobierna y el brazo', () => {
    const [s] = forceShapes([imForce()], VP, 'SI', [imPile('centroid')]);
    expect(s!.title).toContain('Fuerza del suelo 95,5 kN/m');
    expect(s!.title).toContain('gobierna el corte');
    expect(s!.title).toContain('brazo 1,50 m');
  });

  it('cada valor de governs tiene su texto y las unidades imperiales llevan lbf/ft y ft', () => {
    expect(forceShapes([imForce({ governs: 'soil' })], VP, 'SI', [imPile('centroid')])[0]!.title).toContain('gobierna el suelo');
    expect(forceShapes([imForce({ governs: 'bending' })], VP, 'SI', [imPile('centroid')])[0]!.title).toContain('gobierna la flexión');
    const imp = forceShapes([imForce()], VP, 'imperial', [imPile('centroid')])[0]!.title;
    expect(imp).toContain('lbf/ft');
    expect(imp).toContain('ft');
  });

  it('un cruce sin los campos de Ito-Matsui conserva el texto de siempre', () => {
    const t = forceShapes([force()], VP, 'SI')[0]!.title;
    expect(t).not.toContain('Fuerza del suelo');
    expect(t).not.toContain('gobierna');
    expect(t).toContain('Cruce 1, estación');
  });
});

describe('E15l-22: lienzo SVG del editor', () => {
  const result = (f: ReinforcementForce[]): CanvasResult => ({
    surface: { xc: 30, yc: 30, r: 25 },
    slices: [{ x_left: 10, x_right: 20, y_base_left: 11, y_base_right: 10, y_top_mid: 18, width: 10, weight: 1, alpha: 0, phi: 30, c: 5, u: 0, normal: 1, shear_strength: 1, shear_mobilized: 1, area: 1 } as never],
    reinforcementForces: f,
  });
  const arrowOrigin = (html: string): [number, number] => {
    const m = /<line data-force-arrow="true" x1="([\d.]+)" y1="([\d.]+)"/.exec(html);
    if (!m) throw new Error('sin flecha');
    return [Number(m[1]), Number(m[2])];
  };
  const render = (loc: 'centroid' | 'slip_surface'): string =>
    renderToStaticMarkup(createElement(EditorCanvas, { store: createFakeStore(docWith(imPile(loc))), result: result([imForce()]) }));

  it('la flecha parte de y + arm con centroid y del cruce con slip_surface', () => {
    const c = arrowOrigin(render('centroid'));
    const s = arrowOrigin(render('slip_surface'));
    expect(c[0]).toBeCloseTo(worldToScreen(VP, 45, 6.5)[0], 6);
    expect(c[1]).toBeCloseTo(worldToScreen(VP, 45, 6.5)[1], 6);
    expect(s[1]).toBeCloseTo(worldToScreen(VP, 45, 5)[1], 6);
  });

  it('la información emergente lleva soil_force, governs y arm', () => {
    const html = render('centroid');
    expect(html).toContain('Fuerza del suelo 95,5 kN/m');
    expect(html).toContain('gobierna el corte');
    expect(html).toContain('brazo 1,50 m');
  });
});

describe('E15l-22: Casos (Canvas 2D)', () => {
  /** Contexto que registra los `moveTo` en orden. */
  function moves(loc: 'centroid' | 'slip_surface'): [number, number][] {
    const out: [number, number][] = [];
    const noop = (): void => undefined;
    const ctx = new Proxy({}, {
      get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'moveTo' ? (x: number, y: number) => void out.push([x, y]) : noop),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    const model = {
      materials: [{ id: 'a', name: 'A' }],
      regions: [{ material: 'a', polygon: [[0, 0], [60, 0], [60, 20], [0, 20]] }],
      reinforcements: [imPile(loc)],
    } as never;
    const method = { status: 'converged', surface: { xc: 30, yc: 30, r: 25 }, slices: [], reinforcement_forces: [imForce()] } as never;
    drawSection(ctx, 800, 600, 1, buildScene(model, method));
    return out;
  }
  const key = (p: [number, number]): string => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;

  it('la flecha parte más arriba con centroid que con slip_surface: todo lo que cambia se desplaza solo en vertical y hacia arriba', () => {
    const c = moves('centroid');
    const s = moves('slip_surface');
    expect(c.length).toBe(s.length);
    const moved = c.map((p, i) => [p, s[i]!] as const).filter(([a, b]) => key(a) !== key(b));
    expect(moved.length).toBeGreaterThan(0);
    for (const [a, b] of moved) {
      expect(a[0]).toBeCloseTo(b[0], 6);
      expect(a[1]).toBeLessThan(b[1]); // y de pantalla menor = más arriba
    }
    // Todos los puntos movidos se desplazan lo mismo (el brazo, a escala).
    const dys = new Set(moved.map(([a, b]) => (b[1] - a[1]).toFixed(4)));
    expect(dys.size).toBe(1);
  });
});
