// F3-W1f: render estático de la polilínea fija y del resultado con polilínea ajustada en el lienzo.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Point, Slice } from '../../engine/types';
import type { Viewport } from '../../geometry/viewport';
import { CANVAS_INSTRUCTIONS, EditorCanvas, surfaceArc, type EditorCanvasProps } from './EditorCanvas';
import { createFakeStore, makeDoc } from './fakeStore';

const PTS: Point[] = [[10, 8], [20, 9], [30, 12], [45, 8]];

function render(points: Point[] | null = PTS, props: Omit<EditorCanvasProps, 'store'> = {}, ui: Parameters<typeof createFakeStore>[1] = {}): string {
  const doc = makeDoc();
  doc.analysis.surface = points ? { type: 'polyline', points } : null;
  return renderToStaticMarkup(createElement(EditorCanvas, { store: createFakeStore(doc, ui), ...props }));
}

const slice = (x0: number, x1: number): Slice => ({
  x_left: x0, x_right: x1, y_base_left: 10, y_base_right: 9, y_top_mid: 20, width: x1 - x0, alpha: 0.1, base_length: 10, weight: 100,
  cohesion: 5, tan_phi: 0.5, pore_pressure: 0, material: 0, weight_extra: 0, h_force: 0, h_moment_base: 0, driving_extra: 0, y_centroid: 0,
});

describe('EditorCanvas con polilínea fija', () => {
  it('dibuja la polilínea con el color de la superficie y un tirador por vértice, sin tiradores de círculo', () => {
    const html = render();
    expect(html).toMatch(/<g data-layer="surface"><polyline data-fixed-polyline[^>]*stroke="var\(--canvas-surface\)"/);
    expect((html.match(/data-handle="surface_vertex"/g) ?? []).length).toBe(4);
    expect(html).toContain('aria-label="Polilínea de falla, punto 3: x 30,0 m, y 12,0 m"');
    expect(html).toContain('data-handle-key="s-3"');
    expect(html).not.toContain('data-handle="circle_center"');
    expect(html).not.toContain('data-handle-shape="circle_center"');
    expect(html).not.toMatch(/(#[0-9a-fA-F]{3,8}\b|rgba?\()/);
  });
  it('las etiquetas llevan ft con unidades imperiales', () => {
    expect(render(PTS, { units: 'imperial' })).toContain('aria-label="Polilínea de falla, punto 1: x 10,0 ft, y 8,0 ft"');
  });
  it('con una polilínea de un punto o sin x creciente igual se dibuja lo que hay (la validación es de validateLocal)', () => {
    expect((render([[10, 8], [9, 9]]).match(/data-handle="surface_vertex"/g) ?? []).length).toBe(2);
  });
  it('el resultado con polilínea se dibuja con los puntos ajustados del informe, no con los del documento', () => {
    const fitted: Point[] = [[8, 7.5], [20, 9], [30, 12], [47, 7]];
    const html = render(PTS, { result: { surface: { points: fitted }, slices: [slice(10, 20), slice(20, 30)] } });
    expect(html).toContain('data-critical-surface');
    expect(html).toMatch(/data-critical-surface="true" data-converged="true" points="[^"]*"/);
    const m = /data-critical-surface[^>]*points="([^"]*)"/.exec(html);
    expect(m).not.toBeNull();
    const coords = m![1]!.trim().split(' ');
    // R10B-05: limitada al rango de las dovelas (10 a 30), no los 4 puntos ajustados completos (8 a 47).
    expect(coords).toHaveLength(3);
    // la polilínea fija del documento no se confunde con la del resultado
    expect(html).toContain('data-fixed-polyline');
  });
  it('R10B-05: con la masa truncada solo se dibuja la parte de la polilínea dentro del rango de las dovelas', () => {
    const vp: Viewport = { scale: 10, tx: 0, ty: 100, width: 600, height: 400 };
    const full: Point[] = [[0, 10], [10, 5], [20, 5], [30, 10]];
    const arc = (pts: Point[], slices: Slice[]): number[][] =>
      surfaceArc(vp, { surface: { points: pts }, slices }).trim().split(' ').map((c) => c.split(',').map(Number));
    // rango cubierto: la polilínea completa
    expect(arc(full, [slice(0, 15), slice(15, 30)])).toHaveLength(4);
    // dovelas de 5 a 25: recortada en x = 5 y x = 25 (interpolación sobre el tramo)
    const clipped = arc(full, [slice(5, 15), slice(15, 25)]);
    expect(clipped[0]![0]).toBeCloseTo(50, 6);
    expect(clipped[0]![1]).toBeCloseTo(100 - 7.5 * 10, 6);
    expect(clipped[clipped.length - 1]![0]).toBeCloseTo(250, 6);
    expect(clipped[clipped.length - 1]![1]).toBeCloseTo(100 - 7.5 * 10, 6);
    for (const c of clipped) expect(c[0]!).toBeGreaterThanOrEqual(50 - 1e-9);
    // sin dovelas no hay trazo
    expect(surfaceArc(vp, { surface: { points: full }, slices: [] })).toBe('');
  });
  it('no convergió: trazo discontinuo y token de superficie no convergida', () => {
    const html = render(PTS, { surfaceConverged: false, result: { surface: { points: PTS }, slices: [slice(10, 20)] } });
    expect(html).toMatch(/data-critical-surface="true" data-converged="false"[^>]*stroke="var\(--canvas-surface-unconverged\)"[^>]*stroke-dasharray="10 6"/);
  });
  it('las instrucciones del lienzo mencionan la polilínea', () => {
    expect(CANVAS_INSTRUCTIONS).toMatch(/polilínea/);
    expect(CANVAS_INSTRUCTIONS).toMatch(/Insert/);
  });
  it('sin superficie no hay capa de superficie ni tiradores', () => {
    const html = render(null);
    expect(html).not.toContain('data-layer="surface"');
    expect(html).not.toContain('surface_vertex');
  });
});
