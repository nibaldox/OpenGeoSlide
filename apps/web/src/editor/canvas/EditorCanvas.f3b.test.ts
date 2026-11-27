// F3B-W2: lienzo SVG del editor (`EditorCanvas.tsx`) con polilínea crítica de búsqueda no circular, caso en que gana el círculo y leyes F3B.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  F3B_CRITICAL_POLYLINE,
  hoekBrownFixture,
  nonCircularCircleWinsFixture,
  nonCircularPolylineWinsFixture,
  shansepFixture,
} from '../../report/f3bFixtures';
import { EditorCanvas } from './EditorCanvas';
import { createFakeStore } from './fakeStore';

describe('EditorCanvas con resultados F3B', () => {
  it('búsqueda no circular (gana polilínea): dibuja la polilínea crítica y sus vértices marcados, sin tiradores editables de polilínea', () => {
    const { model, report } = nonCircularPolylineWinsFixture();
    const res = report.results[0]!;
    const html = renderToStaticMarkup(
      createElement(EditorCanvas, {
        store: createFakeStore(model),
        result: { surface: res.surface, slices: res.slices },
        surfaceConverged: true,
      }),
    );
    expect(html).toContain('data-critical-surface');
    expect(html).toContain('data-converged="true"');
    const vertices = [...html.matchAll(/<circle[^>]*data-critical-vertex="(\d+)"[^>]*>/g)];
    expect(vertices).toHaveLength(F3B_CRITICAL_POLYLINE.length);
    for (const v of vertices) {
      expect(v[0]).toContain('fill="var(--canvas-surface)"');
      expect(v[0]).toContain('stroke="var(--canvas-halo)"');
    }
    // La polilínea crítica de búsqueda es de solo lectura: no crea tiradores `surface_vertex` ni `data-fixed-polyline`.
    expect(html).not.toContain('data-handle="surface_vertex"');
    expect(html).not.toContain('data-fixed-polyline');
    expect(html).not.toMatch(/(#[0-9a-fA-F]{3,8}\b|rgba?\()/);
  });

  it('búsqueda no circular (gana el círculo): dibuja el arco crítico sin marcas de vértices de polilínea', () => {
    const { model, report } = nonCircularCircleWinsFixture();
    const res = report.results[0]!;
    const html = renderToStaticMarkup(
      createElement(EditorCanvas, {
        store: createFakeStore(model),
        result: { surface: res.surface, slices: res.slices },
        surfaceConverged: true,
      }),
    );
    expect(html).toContain('data-critical-surface');
    expect(html).not.toContain('data-critical-vertex=');
  });

  it('polilínea sin convergencia: trazo discontinuo y vértices con el token `--canvas-surface-unconverged`', () => {
    const { model, report } = nonCircularPolylineWinsFixture();
    const res = report.results[0]!;
    const html = renderToStaticMarkup(
      createElement(EditorCanvas, {
        store: createFakeStore(model),
        result: { surface: res.surface, slices: res.slices },
        surfaceConverged: false,
      }),
    );
    expect(html).toContain('data-converged="false"');
    expect(html).toContain('stroke-dasharray="10 6"');
    const vertices = [...html.matchAll(/<circle[^>]*data-critical-vertex="(\d+)"[^>]*>/g)];
    expect(vertices).toHaveLength(F3B_CRITICAL_POLYLINE.length);
    expect(vertices.every((v) => v[0].includes('fill="var(--canvas-surface-unconverged)"'))).toBe(true);
  });

  it('el color de las dovelas en SVG no cambia por la ley (Hoek-Brown, SHANSEP o Mohr-Coulomb)', () => {
    for (const fx of [hoekBrownFixture(), shansepFixture()]) {
      const res = fx.report.results[0]!;
      const html = renderToStaticMarkup(
        createElement(EditorCanvas, {
          store: createFakeStore(fx.model),
          result: { surface: res.surface, slices: res.slices },
        }),
      );
      const slicePolys = [...html.matchAll(/<polygon[^>]*data-slice="\d+"[^>]*>/g)].map((m) => m[0]);
      expect(slicePolys).toHaveLength(res.slices.length);
      for (const poly of slicePolys) {
        expect(poly).toContain('fill="var(--canvas-slice-fill)"');
        expect(poly).toContain('stroke="var(--canvas-slice-edge)"');
      }
    }
  });
});
