// E15m-15 (R13): la cara cortada en el lienzo (SVG del editor), en Casos (Canvas 2D) y en las formas puras de `render/crack.ts`.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EditorCanvas, type CanvasResult } from '../editor/canvas/EditorCanvas';
import { createFakeStore } from '../editor/canvas/fakeStore';
import type { ModelDoc } from '../editor/types';
import type { MethodReport, Model, Slice } from '../engine/types';
import type { Viewport } from '../geometry/viewport';
import type { SectionPalette } from '../theme/sectionPalette';
import { crackDepthText, crackGeometry, crackShape, crackTitle, cutNoCrackLabelText, cutNoCrackTitle, noCrackLabel } from './crack';
import { drawSection } from './drawSection';
import { buildScene } from './scene';

const vp: Viewport = { scale: 10, tx: 0, ty: 400, width: 800, height: 400 };
const sl = (xl: number, xr: number, yl: number, yr: number) => ({ x_left: xl, x_right: xr, y_base_left: yl, y_base_right: yr, y_top_mid: 30, width: xr - xl }) as unknown as Slice;
const slices = [sl(30, 38, 25, 23), sl(38, 47, 23, 32.6)];
const CUT = { x: 30, depth: 0, water_force: 0, face_height: 1.7827 };
const DEEP = { x: 47, depth: 2.616, water_force: 34.2, face_height: 4.9707 };
const FULL = 'Corte de la masa en x = 30 (cara de 1,783 m) sin grieta de tracción: la profundidad de Rankine es 0 en ese punto (p. ej., bajo una sobrecarga)';

describe('render/crack.ts con face_height (E15m-15)', () => {
  it('crackGeometry conserva la cara solo si es finita y positiva; el rótulo y el título la muestran junto a la profundidad', () => {
    const g = crackGeometry(DEEP, slices, 1);
    expect(g?.face).toBe(4.9707);
    expect(crackGeometry({ ...DEEP, face_height: 0 }, slices, 1)?.face).toBeUndefined();
    expect(crackGeometry({ x: 47, depth: 2.4, water_force: 28.2 }, slices, 1)?.face).toBeUndefined();
    expect(crackDepthText(2.616, 'SI', 4.9707)).toBe('Grieta d = 2,62 m (cara de 4,97 m)');
    expect(crackDepthText(2.616, 'imperial', 4.9707)).toBe('Grieta d = 2,62 ft (cara de 4,97 ft)');
    expect(crackDepthText(2.4, 'SI')).toBe('Grieta d = 2,4 m');
    expect(crackShape(g!, vp, 'SI').depthLabel.text).toBe('Grieta d = 2,62 m (cara de 4,97 m)');
    expect(crackTitle(g!, 'SI')).toContain('profundidad 2,62 m (cara cortada de 4,97 m)');
  });
  it('noCrackLabel: depth 0 y cara > 0 es el rótulo del corte (no «Sin grieta»), con la frase completa de título y la cara en la unidad', () => {
    const l = noCrackLabel(CUT, slices, vp, 'SI');
    expect(l?.kind).toBe('cut');
    expect(l?.text).toBe('Corte de la masa (cara de 1,78 m) sin grieta de tracción');
    expect(l?.text).not.toContain('Sin grieta');
    expect(l?.title).toBe(FULL);
    expect(l?.anchor).toBe('start');
    expect(noCrackLabel(CUT, slices, vp, 'imperial')?.text).toBe('Corte de la masa (cara de 1,78 ft) sin grieta de tracción');
    expect(cutNoCrackLabelText(5, 'SI')).toBe('Corte de la masa (cara de 5,0 m) sin grieta de tracción'); // 1 decimal mínimo, como los demás rótulos del lienzo
    expect(cutNoCrackTitle(30, 1.7827, 'imperial')).toContain('(cara de 1,783 ft)');
  });
  it('sin cara (o 0) sigue siendo «Sin grieta (z = 0)»; con profundidad no hay rótulo', () => {
    for (const f of [undefined, 0]) {
      const l = noCrackLabel({ x: 30, depth: 0, water_force: 0, ...(f === undefined ? {} : { face_height: f }) }, slices, vp, 'SI');
      expect(l?.kind).toBe('none');
      expect(l?.text).toBe('Sin grieta (z = 0)');
    }
    expect(noCrackLabel(DEEP, slices, vp, 'SI')).toBeNull();
  });
});

describe('EditorCanvas con face_height (E15m-15)', () => {
  const doc = {
    format: 'opengeoslide', version: '0.5', meta: { id: 'v047a', title: 'V047a' }, units: 'SI',
    materials: [{ id: 'soil', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 20, cohesion: 3, friction_angle: 19.6 }],
    regions: [{ material: 'soil', polygon: [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]] }],
    slope: { direction: 'right_to_left' },
    analysis: { methods: ['bishop'], tension_crack: { depth: 'auto', water_fill: 1 } },
  } as unknown as ModelDoc;
  const render = (crack: CanvasResult['tensionCrack'], d: ModelDoc = doc): string =>
    renderToStaticMarkup(createElement(EditorCanvas, { store: createFakeStore(d), result: { surface: { xc: 52, yc: 45, r: 24 }, slices, tensionCrack: crack } }));
  it('depth 0 y cara: rótulo del corte con la frase completa en el título, sin «Sin grieta» ni línea de grieta', () => {
    const html = render(CUT);
    expect(html).toContain('data-layer="tension-crack-cut"');
    expect(html).toContain('data-crack-label="cut"');
    expect(html).toContain('>Corte de la masa (cara de 1,78 m) sin grieta de tracción<');
    expect(html).toContain(`<title>${FULL.replace('(p. ej., bajo', '(p. ej., bajo')}</title>`);
    expect(html).not.toContain('Sin grieta');
    expect(html).not.toContain('data-layer="tension-crack"');
    expect(html).not.toContain('data-layer="tension-crack-none"');
    const layer = html.slice(html.indexOf('data-layer="tension-crack-cut"'), html.indexOf('data-layer="search-ranges"'));
    expect(layer).toContain('fill="var(--canvas-surface)"');
    expect(layer).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
  });
  it('depth > 0 con cara: «Grieta d = … (cara de …)» y data-crack-face; sin cara no hay atributo', () => {
    const html = render(DEEP);
    expect(html).toContain('>Grieta d = 2,62 m (cara de 4,97 m)<');
    expect(html).toContain('data-crack-face="4.9707"');
    const plain = render({ x: 47, depth: 2.4, water_force: 28.2 });
    expect(plain).toContain('>Grieta d = 2,4 m<');
    expect(plain).not.toContain('data-crack-face');
  });
  it('en imperial la cara va en ft', () => {
    const html = render(CUT, { ...doc, units: 'imperial' } as unknown as ModelDoc);
    expect(html).toContain('(cara de 1,78 ft)');
  });
});

describe('Casos (Canvas 2D) con face_height (E15m-15)', () => {
  const model = {
    version: '0.5', units: 'SI', materials: [{ id: 'soil', name: 'Suelo' }],
    regions: [{ material: 'soil', polygon: [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]] }],
    analysis: { tension_crack: { depth: 'auto', water_fill: 1 } },
  } as unknown as Model;
  const method = (crack: object | undefined) => ({ status: 'converged', surface: { xc: 52, yc: 45, r: 24 }, slices, tension_crack: crack }) as unknown as MethodReport;
  const pal = { bg: 'BG', grid: 'GRID', axis: 'AXIS', axisText: 'TEXT', halo: 'HALO', regionEdge: 'EDGE', surface: 'SURF', surfaceUnconverged: 'UNCONV', piezo: 'PIEZO', pond: 'POND', reinforcement: 'REINF', sliceFill: 'SFILL', sliceEdge: 'SEDGE', materials: ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6'], materialUnknown: 'MU' } as SectionPalette;
  const draw = (crack: object | undefined, units?: string) => {
    const texts: Array<{ t: string; fill: string }> = [];
    let fill = '';
    const ctx = new Proxy({}, {
      get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'fillText' ? (t: string) => void texts.push({ t, fill }) : () => undefined),
      set: (_t, k, v) => { if (k === 'fillStyle') fill = String(v); return true; },
    }) as unknown as CanvasRenderingContext2D;
    drawSection(ctx, 800, 500, 1, buildScene(model, method(crack)), pal, units);
    return texts;
  };
  it('buildScene pasa la cara dentro de noCrack (depth 0) y dentro de crack (depth > 0)', () => {
    expect(buildScene(model, method(CUT)).noCrack).toEqual(CUT);
    expect(buildScene(model, method(CUT)).crack).toBeUndefined();
    expect(buildScene(model, method(DEEP)).crack?.face).toBe(4.9707);
  });
  it('depth 0 y cara: escribe el rótulo del corte una vez con el color de la superficie y no «Sin grieta»', () => {
    const texts = draw(CUT);
    const hits = texts.filter((x) => x.t === 'Corte de la masa (cara de 1,78 m) sin grieta de tracción');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.fill).toBe('SURF');
    expect(texts.some((x) => x.t.includes('Sin grieta'))).toBe(false);
    expect(draw(CUT, 'imperial').some((x) => x.t === 'Corte de la masa (cara de 1,78 ft) sin grieta de tracción')).toBe(true);
  });
  it('depth > 0 y cara: el rótulo de la profundidad la lleva', () => {
    expect(draw(DEEP).some((x) => x.t === 'Grieta d = 2,62 m (cara de 4,97 m)')).toBe(true);
  });
  it('sin cara no cambia: «Sin grieta (z = 0)»', () => {
    expect(draw({ x: 30, depth: 0, water_force: 0 }).some((x) => x.t === 'Sin grieta (z = 0)')).toBe(true);
  });
});
