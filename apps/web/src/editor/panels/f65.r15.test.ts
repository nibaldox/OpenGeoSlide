// R15B-10: combinaciones F6.5 en los paneles (grieta numérica por defecto con HB/SHANSEP y notas en línea en Análisis, Refuerzos y Búsqueda).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Material, PileReinforcement } from '../../engine/types';
import type { ModelDoc } from '../types';
import { AnalysisPanel } from './AnalysisPanel';
import { ReinforcementsPanel } from './ReinforcementsPanel';
import { SearchPanel } from './SearchPanel';
import { createFakeStore } from './fakeStore';
import { CRACK_DEFAULT_FIXED_DEPTH, formatNumber, initialCrackForm } from './forms';

const hbMat: Material = {
  id: 'roca',
  name: 'Roca',
  model: 'hoek_brown',
  unit_weight: 25,
  ucs: 30000,
  gsi: 50,
  mi: 10,
  disturbance: 0.7,
};

const shMat: Material = {
  id: 'arcilla',
  name: 'Arcilla',
  model: 'shansep',
  unit_weight: 18,
  shansep: { ratio: 0.25, exponent: 0.8, ocr: 1.5 },
};

const mcMat: Material = {
  id: 'suelo',
  name: 'Suelo',
  model: 'mohr_coulomb',
  unit_weight: 18,
  cohesion: 5,
  friction_angle: 30,
};

const itoPile: PileReinforcement = {
  id: 'p1',
  type: 'pile',
  x1: 10,
  y1: 10,
  x2: 10,
  y2: 0,
  application: 'passive',
  direction: 'angle',
  angle: 0,
  spacing: 2,
  lateral_pressure: { model: 'ito_matsui', diameter: 0.6, location: 'centroid' },
};

function makeDoc(overrides: Partial<ModelDoc> = {}): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.6',
    meta: {},
    units: 'SI',
    materials: [hbMat],
    regions: [{ material: hbMat.id, polygon: [[0, 0], [0, 10], [20, 10], [40, 0]] }],
    water: null,
    slope: { direction: 'auto' },
    analysis: {
      methods: ['bishop', 'spencer'],
      slices: 30,
      search: { type: 'circular_entry_exit', non_circular: { seeds: 3, max_vertices: 33 } },
    },
    ...overrides,
  } as unknown as ModelDoc;
}

describe('R15B-10: combinaciones F6.5 en paneles', () => {
  it('al activar la grieta con Hoek-Brown o SHANSEP la profundidad inicial es numérica, no auto', () => {
    const hbCrack = initialCrackForm({ materials: [hbMat] });
    expect(hbCrack.enabled).toBe(true);
    expect(hbCrack.auto).toBe(false);
    expect(hbCrack.depth).toBe(formatNumber(CRACK_DEFAULT_FIXED_DEPTH));

    const shCrack = initialCrackForm({ materials: [shMat] });
    expect(shCrack.auto).toBe(false);
    expect(shCrack.depth).toBe(formatNumber(CRACK_DEFAULT_FIXED_DEPTH));

    const mcCrack = initialCrackForm({ materials: [mcMat] });
    expect(mcCrack.auto).toBe(true);
    expect(mcCrack.depth).toBe('');
  });

  it('AnalysisPanel muestra nota en línea de grieta fija con HB/SHANSEP y alerta si quedó en auto', () => {
    const fixedDoc = makeDoc({
      analysis: {
        methods: ['spencer'],
        slices: 30,
        surface: { type: 'circle', xc: 20, yc: 25, r: 20 },
        tension_crack: { depth: 2, water_fill: 1 },
      },
    });
    const htmlFixed = renderToStaticMarkup(createElement(AnalysisPanel, { store: createFakeStore(fixedDoc) }));
    expect(htmlFixed).toContain('data-testid="crack-f65-note"');
    expect(htmlFixed).toContain('profundidad fija');
    expect(htmlFixed).toMatch(/<option value="auto" disabled="">/);

    const autoDoc = makeDoc({
      analysis: {
        methods: ['spencer'],
        slices: 30,
        surface: { type: 'circle', xc: 20, yc: 25, r: 20 },
        tension_crack: { depth: 'auto', water_fill: 1 },
      },
    });
    const htmlAuto = renderToStaticMarkup(createElement(AnalysisPanel, { store: createFakeStore(autoDoc) }));
    expect(htmlAuto).toContain('data-testid="crack-f65-note"');
    expect(htmlAuto).toContain('role="alert"');
  });

  it('ReinforcementsPanel muestra nota en línea para Ito-Matsui con Hoek-Brown o SHANSEP', () => {
    const doc = makeDoc({ reinforcements: [itoPile] });
    const html = renderToStaticMarkup(createElement(ReinforcementsPanel, { store: createFakeStore(doc) }));
    expect(html).toContain('data-testid="ito-matsui-f65-note"');
    expect(html).toContain('Ito-Matsui no se admite con materiales Hoek-Brown o SHANSEP');

    const mcDoc = makeDoc({
      materials: [mcMat],
      regions: [{ material: mcMat.id, polygon: [[0, 0], [0, 10], [20, 10], [40, 0]] }],
      reinforcements: [itoPile],
    });
    const htmlMc = renderToStaticMarkup(createElement(ReinforcementsPanel, { store: createFakeStore(mcDoc) }));
    expect(htmlMc).not.toContain('ito-matsui-f65');
  });

  it('SearchPanel muestra nota en línea cuando non_circular está activo con Bishop', () => {
    const doc = makeDoc();
    const html = renderToStaticMarkup(createElement(SearchPanel, { store: createFakeStore(doc) }));
    expect(html).toContain('data-testid="non-circular-bishop-note"');
    expect(html).toContain('Bishop simplificado no se admite con búsqueda no circular');

    const spencerOnly = makeDoc({
      analysis: {
        methods: ['spencer'],
        slices: 30,
        search: { type: 'circular_entry_exit', non_circular: { seeds: 3, max_vertices: 33 } },
      },
    });
    const htmlOk = renderToStaticMarkup(createElement(SearchPanel, { store: createFakeStore(spencerOnly) }));
    expect(htmlOk).not.toContain('non-circular-bishop-note');
  });
});
