// F5.3 y F5.4 en el lienzo SVG del editor: el agua embalsada (capa propia, token `--canvas-pond`) y la grieta de tracción del resultado.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EditorCanvas, type CanvasResult } from './EditorCanvas';
import { createFakeStore } from './fakeStore';
import type { ModelDoc } from '../types';

// V047a con 2 m de agua al pie (piezométrica y = 27), talud hacia la izquierda.
const doc = {
  format: 'opengeoslide', version: '0.5', meta: { id: 'v047a', title: 'V047a' }, units: 'SI',
  materials: [{ id: 'soil', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 20, cohesion: 3, friction_angle: 19.6 }],
  regions: [{ material: 'soil', polygon: [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]] }],
  water: { piezometric_line: [[20, 27], [70, 27]] },
  slope: { direction: 'right_to_left' },
  analysis: { methods: ['bishop'], tension_crack: { depth: 2.4, water_fill: 1 } },
} as unknown as ModelDoc;

const slice = (xl: number, xr: number, yl: number, yr: number) => ({ x_left: xl, x_right: xr, y_base_left: yl, y_base_right: yr, y_top_mid: 30, width: xr - xl }) as never;
const result = (crack?: CanvasResult['tensionCrack']): CanvasResult => ({ surface: { xc: 52, yc: 45, r: 24 }, slices: [slice(30, 38, 25, 23), slice(38, 47, 23, 32.6)], tensionCrack: crack });
const render = (d: ModelDoc, r?: CanvasResult): string => renderToStaticMarkup(createElement(EditorCanvas, { store: createFakeStore(d), result: r }));

describe('EditorCanvas: agua embalsada', () => {
  it('dibuja un relleno con var(--canvas-pond) en su propia capa, antes de la piezométrica y sin color literal', () => {
    const html = render(doc);
    expect(html).toContain('data-layer="pond"');
    expect((html.match(/data-pond=/g) ?? []).length).toBe(1);
    const layer = html.slice(html.indexOf('data-layer="pond"'), html.indexOf('data-layer="search-ranges"'));
    expect(layer).toContain('fill="var(--canvas-pond)"');
    expect(layer).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    expect(html.indexOf('data-layer="pond"')).toBeGreaterThan(html.indexOf('data-layer="regions"'));
    expect(html.indexOf('data-layer="pond"')).toBeLessThan(html.indexOf('data-layer="piezometric"'));
  });
  it('sin piezométrica sobre el terreno no hay capa', () => {
    const low = { ...doc, water: { piezometric_line: [[20, 22], [70, 22]] } } as unknown as ModelDoc;
    expect(render(low)).not.toContain('data-layer="pond"');
    expect(render({ ...doc, water: undefined } as unknown as ModelDoc)).not.toContain('data-layer="pond"');
  });
});

describe('EditorCanvas: grieta de tracción del resultado', () => {
  it('con tension_crack dibuja la línea discontinua en x_c, su profundidad y la flecha de Pw hacia la masa', () => {
    const html = render(doc, result({ x: 47, depth: 2.4, water_force: 28.2 }));
    expect(html).toContain('data-layer="tension-crack"');
    expect(html).toContain('data-crack-x="47"');
    expect(html).toContain('data-crack-depth="2.4"');
    expect(html).toContain('data-crack-water-force="28.2"');
    expect(html).toContain('stroke-dasharray="5 4"');
    expect(html).toContain('>Grieta d = 2,4 m<');
    expect(html).toContain('>Pw = 28,2 kN/m<');
    expect(html).toContain('data-crack-arrow');
    expect(html).toContain('data-crack-water="true"');
    expect(html).toContain('Grieta de tracción en x = 47,0 m, profundidad 2,4 m; agua en la grieta 100 %, Pw = 28,2 kN/m');
    const layer = html.slice(html.indexOf('data-layer="tension-crack"'), html.indexOf('data-layer="search-ranges"'));
    expect(layer).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
  });
  it('con una grieta automática poco profunda (0,43 m) los dos rótulos van sobre el terreno y con el mismo anclaje vertical (dy)', () => {
    const shallowSlices = [slice(30, 38, 25, 23), slice(38, 47, 23, 33.07)] as never;
    const html = render(doc, { surface: { xc: 52, yc: 45, r: 24 }, slices: shallowSlices, tensionCrack: { x: 47, depth: 0.43, water_force: 0.0906 } });
    const depth = /data-crack-label="depth" x="([-\d.e]+)" y="([-\d.e]+)" dy="0.35em"/.exec(html);
    const force = /data-crack-label="force" x="([-\d.e]+)" y="([-\d.e]+)" dy="0.35em"/.exec(html);
    expect(depth).not.toBeNull();
    expect(force).not.toBeNull();
    expect(Number(depth![2]) + 7).toBeLessThanOrEqual(Number(force![2]) - 7); // sin solape entre sí
  });
  it('el sentido de la flecha es el de las dovelas respecto de la cara (aquí hacia −x)', () => {
    const html = render(doc, result({ x: 47, depth: 2.4, water_force: 28.2 }));
    const m = /data-crack-arrow="true" x1="([-\d.e]+)" y1="[-\d.e]+" x2="([-\d.e]+)"/.exec(html);
    expect(m).not.toBeNull();
    expect(Number(m![2])).toBeLessThan(Number(m![1]));
  });
  it('grieta seca: línea y profundidad, sin flecha, hueco de agua ni rótulo de Pw', () => {
    const dry = { ...doc, analysis: { methods: ['bishop'], tension_crack: { depth: 2.4, water_fill: 0 } } } as unknown as ModelDoc;
    const html = render(dry, result({ x: 47, depth: 2.4, water_force: 0 }));
    expect(html).toContain('data-crack-line');
    expect(html).not.toContain('data-crack-arrow');
    expect(html).not.toContain('data-crack-water="true"');
    expect(html).not.toContain('>Pw');
    expect(html).toContain('grieta seca (Pw = 0)');
  });
  it('sin tension_crack en el resultado, o sin resultado, no hay capa de grieta', () => {
    expect(render(doc, result())).not.toContain('data-layer="tension-crack"');
    expect(render(doc)).not.toContain('data-layer="tension-crack"');
  });
  it('en imperial los rótulos dicen ft y lbf/ft', () => {
    const html = renderToStaticMarkup(createElement(EditorCanvas, { store: createFakeStore({ ...doc, units: 'imperial' } as ModelDoc), result: result({ x: 47, depth: 8, water_force: 1500 }), units: 'imperial' }));
    expect(html).toContain('>Grieta d = 8,0 ft<');
    expect(html).toContain('>Pw = 1500,0 lbf/ft<');
  });
});
