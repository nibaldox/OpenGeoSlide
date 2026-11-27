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
import { NO_CRACK_LABEL, cutNoCrackLabelText, cutNoCrackTitle, noCrackHitRect } from '../../render/crack';

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

// E15n-4 (R14-03): el rótulo «Sin grieta (z = 0)» y el de «Corte de la masa…» (capas `tension-crack-none` y `tension-crack-cut`, con
// `pointer-events: none`) también repiten su título en `info-hit`, bajo los tiradores.
describe('EditorCanvas: área de acierto del rótulo sin grieta (E15n-4)', () => {
  const doc = { ...docWith(), analysis: { methods: ['bishop'], tension_crack: { depth: 'auto', water_fill: 1 } } } as unknown as ModelDoc;
  const cut: CanvasResult = { surface: { xc: 30, yc: 30, r: 25 }, slices: [slice], tensionCrack: { x: 15, depth: 0, water_force: 0, face_height: 1.78 } };
  const none: CanvasResult = { ...cut, tensionCrack: { x: 15, depth: 0, water_force: 0 } };
  const rect = (layer: string): { attrs: string; title: string } => {
    const m = /<rect data-info-hit="([^"]+)"([^>]*)><title>([^<]*)<\/title><\/rect>/.exec(layer);
    expect(m, 'falta el rectángulo del rótulo').not.toBeNull();
    return { attrs: `${m![1]}|${m![2]}`, title: m![3]! };
  };
  const num = (attrs: string, k: string): number => Number(new RegExp(`${k}="(-?[\\d.]+)"`).exec(attrs)![1]);

  it('un corte de la masa trae su área con la frase completa de E15m-15, antes de los tiradores', () => {
    const html = render(doc, cut);
    const r = rect(hitLayer(html));
    expect(r.attrs.startsWith('crack-cut|')).toBe(true);
    // El título es el de la capa visible del rótulo (la frase completa, no la abreviada).
    expect(r.title).toBe(cutNoCrackTitle(15, 1.78, 'SI').replace(/&/g, '&amp;'));
    expect(titles(html.slice(html.indexOf('data-layer="tension-crack-cut"'), html.indexOf('data-layer="search-ranges"')))).toEqual([r.title]);
    expect(html.indexOf('data-info-hit="crack-cut"')).toBeLessThan(html.indexOf('data-layer="handles"'));
    expect(html.indexOf('data-info-hit="crack-cut"')).toBeGreaterThan(html.indexOf('data-layer="tension-crack-cut"'));
  });

  it('sin grieta (z = 0) trae su área con su título y no hay áreas de grieta', () => {
    const layer = hitLayer(render(doc, none));
    const r = rect(layer);
    expect(r.attrs.startsWith('crack-none|')).toBe(true);
    expect(r.title).toBe(NO_CRACK_LABEL);
    expect((layer.match(/data-info-hit="crack-(line|arrow)"/g) ?? []).length).toBe(0);
  });

  it('es transparente (token del lienzo, sin color literal), recibe el puntero, no se enfoca y no duplica el texto del rótulo', () => {
    for (const res of [cut, none]) {
      const html = render(doc, res);
      const layer = hitLayer(html);
      const r = rect(layer);
      expect(r.attrs).toMatch(/fill="var\(--canvas-handle-fill\)"/);
      expect(r.attrs).toContain('fill-opacity="0"');
      expect(r.attrs).toContain('pointer-events="all"');
      expect(layer).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
      expect(layer).not.toMatch(/<text|tabindex|role=|aria-label/);
      // La capa visible sigue sin recibir el puntero y el texto del rótulo aparece una sola vez.
      expect(html).toMatch(/data-layer="tension-crack-(cut|none)"[^>]*pointer-events="none"/);
      expect((html.match(/data-crack-label="(cut|none)"/g) ?? []).length).toBe(1);
    }
  });

  it('el rectángulo cubre el rótulo del lienzo: parte del ancla, hacia el lado de la masa, con el alto de una línea', () => {
    for (const res of [cut, none]) {
      const html = render(doc, res);
      const t = /<text data-crack-label="(?:cut|none)" x="(-?[\d.]+)" y="(-?[\d.]+)"[^>]*text-anchor="(start|end)"[^>]*>([^<]*)<\/text>/.exec(html);
      expect(t, 'falta el rótulo visible').not.toBeNull();
      const [x, y, anchor, text] = [Number(t![1]), Number(t![2]), t![3] as 'start' | 'end', t![4]!];
      const box = noCrackHitRect({ x, y, anchor, text });
      const a = rect(hitLayer(html)).attrs;
      expect(num(a, 'x')).toBeCloseTo(box.x, 6);
      expect(num(a, 'y')).toBeCloseTo(box.y, 6);
      expect(num(a, 'width')).toBeCloseTo(box.width, 6);
      expect(num(a, 'height')).toBeGreaterThanOrEqual(14);
      // Con anclaje «start» el rectángulo empieza en el ancla; con «end» termina en ella (más la holgura); el centro vertical es el del texto.
      if (anchor === 'start') expect(box.x).toBeLessThanOrEqual(x);
      else expect(box.x + box.width).toBeGreaterThanOrEqual(x);
      expect(box.y + box.height / 2).toBeCloseTo(y, 6);
      expect(box.width).toBeGreaterThan(text.length * 5);
    }
    expect(cutNoCrackLabelText(1.78, 'SI').length).toBeGreaterThan(NO_CRACK_LABEL.length);
  });

  it('con grieta con profundidad no hay área de «sin grieta»', () => {
    const withCrack: CanvasResult = { ...cut, tensionCrack: { x: 15, depth: 1.5, water_force: 11 } };
    expect(hitLayer(render(doc, withCrack))).not.toMatch(/data-info-hit="crack-(cut|none)"/);
    expect(hitLayer(render(doc, { ...cut, tensionCrack: undefined }))).not.toMatch(/data-info-hit="crack-(cut|none)"/);
  });
});
