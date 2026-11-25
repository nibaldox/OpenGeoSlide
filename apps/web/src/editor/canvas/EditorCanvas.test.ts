import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EditorCanvas } from './EditorCanvas';
import { createFakeStore, makeDoc } from './fakeStore';

function render(patch: (doc: ReturnType<typeof makeDoc>) => void = () => undefined, ui: Parameters<typeof createFakeStore>[1] = {}): string {
  const doc = makeDoc();
  patch(doc);
  const store = createFakeStore(doc, ui);
  return renderToStaticMarkup(createElement(EditorCanvas, { store }));
}

describe('EditorCanvas (render estático)', () => {
  it('dibuja regiones, tiradores enfocables con aria-label en español y role=application', () => {
    const html = render();
    expect(html).toContain('role="application"');
    expect((html.match(/data-region=/g) ?? []).length).toBe(2);
    expect((html.match(/data-handle="vertex"/g) ?? []).length).toBe(10);
    expect(html).toContain('aria-label="Región 1, vértice 3: x 60,0 m, y 5,0 m"');
    expect(html).toContain('aria-label="Región 2, vértice 5: x 20,0 m, y 20,0 m"');
    expect(html).toContain('tabindex="0"');
  });

  it('dibuja la piezométrica con sus puntos y el círculo con tiradores de centro y radio', () => {
    const html = render();
    expect(html).toContain('data-layer="piezometric"');
    expect((html.match(/data-handle="piezo_point"/g) ?? []).length).toBe(3);
    expect(html).toContain('data-handle="circle_center"');
    expect(html).toContain('data-handle="circle_radius"');
    expect(html).toContain('aria-label="Círculo de falla, radio: 25,0 m"');
  });

  it('omite piezométrica y círculo si el modelo no los tiene', () => {
    const html = render((d) => {
      d.water = null;
      d.analysis.surface = null;
    });
    expect(html).not.toContain('data-layer="piezometric"');
    expect(html).not.toContain('data-handle="circle_center"');
  });

  it('dibuja las bandas de entry y exit', () => {
    const html = render((d) => {
      d.analysis.search = { type: 'circular_entry_exit', entry: [0, 10], exit: [45, 55] };
    });
    expect(html).toContain('data-search-range="entry"');
    expect(html).toContain('data-search-range="exit"');
    expect(html).toContain('Entrada: x 0,0 a 10,0 m');
    expect(render()).not.toContain('data-search-range');
  });

  it('cargas y sismo en capas aria-hidden', () => {
    const html = render((d) => {
      d.loads = [{ type: 'udl', x1: 40, x2: 60, q: 20 }, { type: 'line', x: 50, p: 15, angle: 10 }];
      d.analysis.seismic = { kh: 0.1, kv: 0 };
    });
    expect(html).toContain('<g data-layer="loads" aria-hidden="true">');
    expect(html).toContain('<g data-layer="seismic" aria-hidden="true">');
    expect(html).toContain('q = 20,0 kPa');
    expect(html).toContain('p = 15,0 kN/m · 10°');
    expect(html).toContain('kh = 0,10 · kv = 0,00');
    expect((html.match(/data-load=/g) ?? []).length).toBe(2);
  });

  it('sin sismo ni cargas las capas quedan vacías', () => {
    const html = render();
    expect(html).toMatch(/<g data-layer="loads" aria-hidden="true"><\/g>/);
    expect(html).toMatch(/<g data-layer="seismic" aria-hidden="true"><\/g>/);
  });

  it('el color de la región sigue al material', () => {
    const html = render();
    expect(html).toContain('fill="var(--canvas-mat-0)"'); // m1 = índice 0
    expect(html).toContain('fill="var(--canvas-mat-1)"'); // m2 = índice 1
    expect(render((d) => (d.regions[0].material = 'no-existe'))).toContain('fill="var(--canvas-mat-unknown)"');
  });

  it('sin result no dibuja la capa de resultado; con result dibuja dovelas en gris y la superficie crítica en rojo', () => {
    expect(render()).not.toContain('data-layer="result"');
    const doc = makeDoc();
    const store = createFakeStore(doc, {});
    const slice = (x0: number, x1: number) => ({
      x_left: x0,
      x_right: x1,
      y_base_left: 10,
      y_base_right: 9,
      y_top_mid: 20,
      width: x1 - x0,
      alpha: 0.1,
      base_length: 10,
      weight: 100,
      cohesion: 5,
      tan_phi: 0.5,
      pore_pressure: 0,
      material: 0,
    });
    const html = renderToStaticMarkup(
      createElement(EditorCanvas, {
        store,
        result: { surface: { xc: 30, yc: 40, r: 30 }, slices: [slice(20, 30), slice(30, 40)] },
      }),
    );
    expect(html).toContain('data-layer="result"');
    expect((html.match(/data-slice=/g) ?? []).length).toBe(2);
    expect(html).toContain('data-critical-surface');
    expect(html).toContain('stroke="var(--canvas-surface)"');
    expect(html).toContain('fill="var(--canvas-slice-fill)"');
    // UX-06: halo bajo la superficie crítica, para que se lea sobre cualquier material en ambos temas.
    expect(html).toMatch(/<polyline[^>]*stroke="var\(--canvas-halo\)"[^>]*data-halo="critical-surface"/);
  });

  it('el lienzo no escribe colores literales: todo sale de los tokens --canvas-*', () => {
    const html = render((d) => {
      d.loads = [{ type: 'udl', x1: 40, x2: 60, q: 20 }, { type: 'line', x: 50, p: 15, angle: 10 }];
      d.analysis.seismic = { kh: 0.1, kv: 0 };
    });
    expect(html).not.toMatch(/(#[0-9a-fA-F]{3,8}\b|rgba?\()/);
    expect(html).toContain('background:var(--canvas-bg)');
    expect(html).toContain('fill="var(--canvas-seismic-bg)"');
    expect(html).toContain('paint-order="stroke"'); // etiquetas de las cargas con halo
  });

  it('UX-20 y UX-06: las etiquetas de los ejes miden 12 px o más y llevan halo (paint-order: stroke)', () => {
    const html = render();
    const texts = [...html.matchAll(/<text [^>]*>/g)].map((m) => m[0]).filter((t) => t.includes('var(--canvas-axis-text)'));
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      expect(Number(/font-size="(\d+)"/.exec(t)?.[1])).toBeGreaterThanOrEqual(12);
      expect(t).toContain('paint-order="stroke"');
      expect(t).toContain('stroke="var(--canvas-halo)"');
    }
  });
});
