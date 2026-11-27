// W-R15c (tarea 1): la polilínea crítica de una búsqueda no circular se rotula «Superficie crítica (polilínea)».
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MethodReport, Model } from '../engine/types';
import { buildScene, type Scene } from '../render/scene';
import { CRITICAL_POLYLINE_LABEL, Legend, resolveLegendItems } from './Legend';
import { FIXED_CIRCLE_LABEL, FIXED_POLYLINE_LABEL, INVALID_LABEL, UNCONVERGED_LABEL } from './legendItems';

const BASE_MODEL: Model = {
  format: 'opengeoslide',
  version: '0.6',
  units: 'SI',
  meta: { id: 'T1', title: 'Prueba' },
  materials: [{ id: 'm1', name: 'Suelo', unit_weight: 18, cohesion: 10, friction_angle: 30 }],
  regions: [{ material: 'm1', polygon: [[0, 0], [20, 0], [20, 10], [10, 10], [0, 5]] }],
  slope: { direction: 'right_to_left' },
  analysis: { methods: ['spencer'], slices: 20, tolerance: 1e-5, max_iterations: 200, min_m_alpha: 0.2 },
};

function polyReport(opts: { search: boolean; status?: MethodReport['status'] }): MethodReport {
  return {
    method: 'spencer',
    status: opts.status ?? 'converged',
    fos: opts.status && opts.status !== 'converged' ? null : 1.25,
    lambda: 0.2,
    iterations: 6,
    warnings: [],
    surface: { type: 'polyline', points: [[2, 5], [8, 2], [15, 10]] },
    search: opts.search
      ? {
          type: 'non_circular',
          evaluated: 200,
          valid: 180,
          refined: true,
          passes: 3,
          initial_fos: 1.31,
          final_fos: 1.25,
        }
      : null,
    slices: [
      {
        index: 0,
        x_left: 2,
        x_right: 8,
        x_mid: 5,
        width: 6,
        y_top: 6,
        y_base: 3.5,
        alpha_deg: -22,
        weight: 200,
        pore_pressure: 0,
        normal_force: 180,
        shear_strength: 120,
        material: 'm1',
      },
    ],
  } as unknown as MethodReport;
}

describe('W-R15c: leyenda de polilínea crítica en búsqueda no circular', () => {
  it('rotula «Superficie crítica (polilínea)» cuando la polilínea viene de una búsqueda no circular', () => {
    const scene = buildScene(BASE_MODEL, polyReport({ search: true }));
    expect(scene.surface?.search).toBe(true);
    expect(scene.surface?.polyline?.length).toBeGreaterThan(1);

    // Vista Casos (opciones por defecto)
    const casesItems = resolveLegendItems(scene, { unconverged: false, invalid: false, fixedCircle: false });
    expect(casesItems[0]).toMatchObject({ key: 'surface', label: CRITICAL_POLYLINE_LABEL, swatch: 'line-red' });

    const html = renderToStaticMarkup(createElement(Legend, { scene, options: { surface: true, unconverged: false, fixedCircle: false, slices: true } }));
    expect(html).toContain(CRITICAL_POLYLINE_LABEL);
    expect(html).not.toContain(FIXED_POLYLINE_LABEL);
  });

  it('conserva «Superficie fija (polilínea)» cuando la polilínea es fija (sin búsqueda)', () => {
    const scene = buildScene(BASE_MODEL, polyReport({ search: false }));
    expect(scene.surface?.search).toBe(false);

    const items = resolveLegendItems(scene, { surface: true, fixedPolyline: true, fixedCircle: true });
    expect(items[0]).toMatchObject({ key: 'surface', label: FIXED_POLYLINE_LABEL, swatch: 'line-red' });

    const html = renderToStaticMarkup(createElement(Legend, { scene, options: { surface: true, fixedPolyline: true, fixedCircle: true } }));
    expect(html).toContain(FIXED_POLYLINE_LABEL);
    expect(html).not.toContain(CRITICAL_POLYLINE_LABEL);
  });

  it('conserva «Superficie fija (polilínea)» discontinua en el editor antes de calcular', () => {
    const scene = buildScene(BASE_MODEL, null);
    const items = resolveLegendItems(scene, { surface: false, slices: false, fixedPolyline: true });
    expect(items).toEqual([{ key: 'surface-fixed', label: FIXED_POLYLINE_LABEL, swatch: 'line-polyline-dashed' }]);
  });

  it('conserva los rótulos de no convergencia e invalidez aunque sea búsqueda no circular', () => {
    const scene = buildScene(BASE_MODEL, polyReport({ search: true, status: 'not_converged' }));
    expect(resolveLegendItems(scene, { unconverged: true, invalid: false })[0]).toMatchObject({
      key: 'surface',
      label: UNCONVERGED_LABEL,
      swatch: 'line-unconverged',
    });
    expect(resolveLegendItems(scene, { unconverged: true, invalid: true })[0]).toMatchObject({
      key: 'surface',
      label: INVALID_LABEL,
      swatch: 'line-unconverged',
    });
  });

  it('no altera los rótulos de círculo crítico ni círculo fijo', () => {
    const circleScene: Scene = {
      ...buildScene(BASE_MODEL, null),
      surface: { circle: { xc: 5, yc: 15, r: 12 }, polyline: null, slices: [], converged: true, search: true },
    };
    expect(resolveLegendItems(circleScene)[0]).toMatchObject({ key: 'surface', label: 'Superficie crítica', swatch: 'line-red' });
    expect(resolveLegendItems({ ...circleScene, surface: { ...circleScene.surface!, search: false } }, { fixedCircle: true })[0]).toMatchObject({
      key: 'surface',
      label: FIXED_CIRCLE_LABEL,
      swatch: 'line-red',
    });
  });
});
