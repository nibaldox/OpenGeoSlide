// E15m-10 (R13B-02): la información emergente (`<title>`) de las flechas de fuerza, la grieta y los refuerzos es alcanzable. Las capas con
// título llevan `pointer-events: none`; una capa `info-hit` repite el título sobre un trazo transparente, por debajo de los tiradores.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ReinforcementForce } from '../../engine/types';
import type { ModelDoc } from '../types';
import { EditorCanvas, type CanvasResult } from './EditorCanvas';
import { createFakeStore } from './fakeStore';
import { ANCHOR, docWith, force } from './reinforcementFixtures';

const slice = { x_left: 10, x_right: 20, y_base_left: 11, y_base_right: 10, y_top_mid: 18, width: 10 } as never;
const render = (doc: ModelDoc, result?: CanvasResult): string => renderToStaticMarkup(createElement(EditorCanvas, { store: createFakeStore(doc), result }));
const hitLayer = (html: string): string => {
  const i = html.indexOf('data-layer="info-hit"');
  expect(i, 'falta la capa info-hit').toBeGreaterThan(-1);
  return html.slice(i, html.indexOf('data-layer="handles"'));
};
const titles = (s: string): string[] => [...s.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]!);

describe('EditorCanvas: áreas de acierto de la información emergente (E15m-10)', () => {
  const forces: ReinforcementForce[] = [force({ fx: -150, fy: -30 }), force({ id: 'anclaje-1', crossing: 1, status: 'no_capacity' as never, fx: 0, fy: 0 })];
  const res: CanvasResult = { surface: { xc: 30, yc: 30, r: 25 }, slices: [slice], reinforcementForces: forces, tensionCrack: { x: 15, depth: 1.5, water_force: 11 } };
  const doc = { ...docWith(ANCHOR), analysis: { methods: ['bishop'], tension_crack: { depth: 1.5, water_fill: 1 } } } as unknown as ModelDoc;
  const html = render(doc, res);

  it('la capa de información va después de las bandas y antes de los tiradores, oculta a lectores de pantalla y sin enfoque', () => {
    expect(html.indexOf('data-layer="info-hit"')).toBeGreaterThan(html.indexOf('data-layer="search-ranges"'));
    expect(html.indexOf('data-layer="info-hit"')).toBeGreaterThan(html.indexOf('data-layer="reinforcement-forces"'));
    expect(html.indexOf('data-layer="info-hit"')).toBeLessThan(html.indexOf('data-layer="handles"'));
    const layer = hitLayer(html);
    expect(layer.startsWith('data-layer="info-hit" aria-hidden="true"')).toBe(true);
    expect(layer).toContain('pointer-events="visibleStroke"');
    expect(layer).toContain('stroke-opacity="0"');
    expect(layer).not.toMatch(/tabindex|role=|aria-label/);
  });

  it('cada flecha de fuerza, la línea y la flecha de la grieta y el refuerzo repiten su título en un área propia', () => {
    const layer = hitLayer(html);
    expect((layer.match(/data-info-hit="force"/g) ?? []).length).toBe(2);
    expect((layer.match(/data-info-hit="crack-line"/g) ?? []).length).toBe(1);
    expect((layer.match(/data-info-hit="crack-arrow"/g) ?? []).length).toBe(1);
    expect((layer.match(/data-info-hit="reinforcement"/g) ?? []).length).toBe(1);
    const t = titles(layer);
    for (const f of forces) expect(t.some((x) => x.includes(f.id)), f.id).toBe(true);
    // El mismo texto que ya tenía la capa visible: nada se inventa ni se pierde.
    const visible = titles(html.slice(html.indexOf('data-layer="tension-crack"'), html.indexOf('data-layer="search-ranges"')));
    expect(t).toContain(visible[0]);
    expect(t.some((x) => /^Grieta de tracción en x = 15,0 m, profundidad 1,5 m/.test(x))).toBe(true);
  });

  it('las capas visibles siguen sin interceptar el puntero (pointer-events: none) y sin color literal', () => {
    for (const layer of ['tension-crack', 'reinforcement-forces', 'reinforcements']) {
      expect(html).toMatch(new RegExp(`data-layer="${layer}"[^>]*pointer-events="none"`));
    }
    expect(hitLayer(html)).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    expect(hitLayer(html)).toContain('var(--canvas-handle-fill)');
  });

  it('sin resultado ni refuerzos solo queda la capa vacía (no hay áreas que interceptar)', () => {
    const empty = render(docWith());
    expect((hitLayer(empty).match(/data-info-hit=/g) ?? []).length).toBe(0);
  });
});
