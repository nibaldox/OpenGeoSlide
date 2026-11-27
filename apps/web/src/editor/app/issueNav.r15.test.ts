// R15B-16: navegación desde Diagnósticos para campos v0.6, data-path en controles y etiquetas en español en forms.ts.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Material } from '../../engine/types';
import type { ModelDoc } from '../types';
import { MaterialsPanel } from '../panels/MaterialsPanel';
import { SearchPanel } from '../panels/SearchPanel';
import { createFakeStore } from '../panels/fakeStore';
import { materialFromForm, newMaterialForm } from '../panels/forms';
import { issueTarget } from './issueNav';

const hbMat: Material = {
  id: 'roca',
  name: 'Roca',
  model: 'hoek_brown',
  unit_weight: 26,
  ucs: 30000,
  gsi: 50,
  mi: 10,
  disturbance: 0.7,
};

const shOcr: Material = {
  id: 'arcilla_ocr',
  name: 'Arcilla OCR',
  model: 'shansep',
  unit_weight: 18,
  shansep: { ratio: 0.25, exponent: 0.8, ocr: 1.5 },
};

const shPop: Material = {
  id: 'arcilla_pop',
  name: 'Arcilla POP',
  model: 'shansep',
  unit_weight: 18,
  shansep: { ratio: 0.25, pop: 40 },
};

const shTable: Material = {
  id: 'arcilla_tbl',
  name: 'Arcilla tabla',
  model: 'shansep',
  unit_weight: 18,
  shansep: { ratio: 0.25, ocr_by_elevation: [[0, 1], [10, 2]] },
};

const doc: ModelDoc = {
  format: 'opengeoslide',
  version: '0.6',
  meta: {},
  units: 'SI',
  materials: [hbMat, shOcr, shPop, shTable],
  regions: [{ material: 'roca', polygon: [[0, 0], [0, 10], [20, 10], [40, 0]] }],
  water: null,
  slope: { direction: 'auto' },
  analysis: {
    methods: ['spencer'],
    slices: 30,
    search: { type: 'circular_entry_exit', non_circular: { seeds: 3, max_vertices: 17 } },
  },
} as unknown as ModelDoc;

describe('R15B-16: issueTarget para campos v0.6 y data-path en los paneles', () => {
  it('resuelve los campos de Hoek-Brown, SHANSEP y non_circular a sus data-path reales', () => {
    expect(issueTarget('/materials/0/ucs', doc)).toMatchObject({ tab: 'materials', fieldPath: '/materials/0/ucs' });
    expect(issueTarget('/materials/0/gsi', doc)).toMatchObject({ tab: 'materials', fieldPath: '/materials/0/gsi' });
    expect(issueTarget('/materials/0/mi', doc)).toMatchObject({ tab: 'materials', fieldPath: '/materials/0/mi' });
    expect(issueTarget('/materials/0/disturbance', doc)).toMatchObject({ tab: 'materials', fieldPath: '/materials/0/disturbance' });

    expect(issueTarget('/materials/1/shansep', doc)).toMatchObject({ tab: 'materials', fieldPath: '/materials/1/shansep' });
    expect(issueTarget('/materials/1/shansep/ratio', doc)).toMatchObject({ tab: 'materials', fieldPath: '/materials/1/ratio' });
    expect(issueTarget('/materials/1/shansep/exponent', doc)).toMatchObject({ tab: 'materials', fieldPath: '/materials/1/exponent' });
    expect(issueTarget('/materials/1/shansep/ocr', doc)).toMatchObject({ tab: 'materials', fieldPath: '/materials/1/ocr' });
    expect(issueTarget('/materials/2/shansep/pop', doc)).toMatchObject({ tab: 'materials', fieldPath: '/materials/2/pop' });
    expect(issueTarget('/materials/3/shansep/ocr_by_elevation', doc)).toMatchObject({
      tab: 'materials',
      fieldPath: '/materials/3/shansep/ocr_by_elevation/0/0',
    });
    expect(issueTarget('/materials/3/shansep/ocr_by_elevation/1/1', doc)).toMatchObject({
      tab: 'materials',
      fieldPath: '/materials/3/shansep/ocr_by_elevation/1/1',
    });

    expect(issueTarget('/analysis/search/non_circular', doc)).toMatchObject({
      tab: 'search',
      fieldPath: '/analysis/search/non_circular',
    });
    expect(issueTarget('/analysis/search/non_circular/seeds', doc)).toMatchObject({
      tab: 'search',
      fieldPath: '/analysis/search/non_circular/seeds',
    });
    expect(issueTarget('/analysis/search/non_circular/max_vertices', doc)).toMatchObject({
      tab: 'search',
      fieldPath: '/analysis/search/non_circular/max_vertices',
    });
  });

  it('MaterialsPanel y SearchPanel renderizan data-path en los controles de OCR, POP, tabla y non_circular', () => {
    const matHtml = renderToStaticMarkup(createElement(MaterialsPanel, { store: createFakeStore(doc) }));
    for (const path of [
      '/materials/0/ucs',
      '/materials/0/disturbance',
      '/materials/1/shansep',
      '/materials/1/ocr',
      '/materials/2/pop',
      '/materials/3/shansep/ocr_by_elevation/0/0',
      '/materials/3/shansep/ocr_by_elevation/1/1',
    ]) {
      expect(matHtml, path).toContain(`data-path="${path}"`);
    }

    const searchHtml = renderToStaticMarkup(createElement(SearchPanel, { store: createFakeStore(doc) }));
    for (const path of [
      '/analysis/search/non_circular',
      '/analysis/search/non_circular/seeds',
      '/analysis/search/non_circular/max_vertices',
    ]) {
      expect(searchHtml, path).toContain(`data-path="${path}"`);
    }
  });

  it('materialFromForm usa etiquetas en español en lugar de claves JSON crudas', () => {
    const fHb = { ...newMaterialForm([]), model: 'hoek_brown' as const };
    const rHb = materialFromForm(fHb, { otherIds: [], editing: null });
    expect(rHb.ok).toBe(false);
    if (!rHb.ok) {
      expect(rHb.errors.ucs).toContain('Resistencia σci');
      expect(rHb.errors.disturbance).toContain('Factor de perturbación D');
      expect(rHb.errors.disturbance).not.toContain('disturbance');
      expect(rHb.errors.mi).toContain('Constante mi');
    }

    const fSh = { ...newMaterialForm([]), model: 'shansep' as const };
    const rSh = materialFromForm(fSh, { otherIds: [], editing: null });
    expect(rSh.ok).toBe(false);
    if (!rSh.ok) {
      expect(rSh.errors.ratio).toContain('Relación S');
      expect(rSh.errors.ratio).not.toContain('ratio');
      expect(rSh.errors.ocr).toContain('OCR constante');
    }

    const fShBad = { ...fSh, ratio: '-1', exponent: '2', ocrSource: 'pop' as const, pop: '-5' };
    const rShBad = materialFromForm(fShBad, { otherIds: [], editing: null });
    expect(rShBad.ok).toBe(false);
    if (!rShBad.ok) {
      expect(rShBad.errors.ratio).toContain('Relación S');
      expect(rShBad.errors.exponent).toContain('Exponente m');
      expect(rShBad.errors.pop).toContain('POP');
    }
  });
});
