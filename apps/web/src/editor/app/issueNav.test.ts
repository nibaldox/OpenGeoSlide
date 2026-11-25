import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../types';
import { newDoc } from './docTemplates';
import { fieldSelector, issueTarget } from './issueNav';

function doc(): ModelDoc {
  const d = newDoc();
  return { ...d, water: { piezometric_line: [[0, 1], [5, 2], [9, 3]] }, loads: [{ type: 'udl', id: 'q1', x1: 0, x2: 2, q: 10 }] } as ModelDoc;
}

describe('issueTarget', () => {
  it('sin puntero no hay destino', () => {
    expect(issueTarget(null, doc())).toBeNull();
    expect(issueTarget('', doc())).toBeNull();
  });
  it('punteros sin elemento real en la interfaz no son navegables', () => {
    expect(issueTarget('/version', doc())).toBeNull();
    expect(issueTarget('/regions', doc())).toBeNull();
    expect(issueTarget('/regions/99', doc())).toBeNull();
    expect(issueTarget('/materials/42/cohesion', doc())).toBeNull();
    expect(issueTarget('/loads/9/q', doc())).toBeNull();
  });
  it('sismo: abre Sismo y enfoca kh o kv', () => {
    expect(issueTarget('/analysis/seismic/kh', doc())).toMatchObject({ tab: 'seismic', fieldPath: '/analysis/seismic/kh' });
    expect(issueTarget('/analysis/seismic/kv', doc())).toMatchObject({ tab: 'seismic', fieldPath: '/analysis/seismic/kv' });
  });
  it('análisis: dovelas, tolerancia, iteraciones y m_alpha abren Análisis', () => {
    for (const f of ['slices', 'tolerance', 'max_iterations', 'min_m_alpha', 'methods']) {
      expect(issueTarget(`/analysis/${f}`, doc())).toMatchObject({ tab: 'analysis', fieldPath: `/analysis/${f}` });
    }
  });
  it('superficie y búsqueda', () => {
    expect(issueTarget('/analysis/surface/r', doc())).toMatchObject({ tab: 'surface', fieldPath: '/analysis/surface/r', selection: { kind: 'surface_circle' } });
    expect(issueTarget('/analysis/surface', doc())).toMatchObject({ tab: 'surface', fieldPath: '/analysis/surface/xc' });
    expect(issueTarget('/analysis/search', doc())).toMatchObject({ tab: 'search', fieldPath: null });
    expect(issueTarget('/analysis/search/min_width', doc())).toMatchObject({ tab: 'search', fieldPath: '/analysis/search/min_width' });
    expect(issueTarget('/analysis/search/entry', doc())).toMatchObject({ tab: 'search', selection: { kind: 'search_range', which: 'entry' }, fieldPath: '/analysis/search/entry/lo' });
  });
  it('/analysis (sin superficie ni búsqueda) lleva al panel de Superficie', () => {
    expect(issueTarget('/analysis', doc())).toMatchObject({ tab: 'surface', fieldPath: null });
  });
  it('agua: peso unitario y puntos de la piezométrica', () => {
    expect(issueTarget('/water/unit_weight', doc())).toMatchObject({ tab: 'water', fieldPath: '/water/unit_weight' });
    expect(issueTarget('/water/piezometric_line/2', doc())).toMatchObject({ tab: 'water', selection: { kind: 'piezo_point', index: 2 }, fieldPath: '/water/piezometric_line/2/x' });
    expect(issueTarget('/water/piezometric_line', doc())).toMatchObject({ tab: 'water', fieldPath: null });
  });
  it('cargas', () => {
    expect(issueTarget('/loads', doc())).toMatchObject({ tab: 'loads', fieldPath: null });
    expect(issueTarget('/loads/0/q', doc())).toMatchObject({ tab: 'loads', selection: { kind: 'load', index: 0 }, fieldPath: '/loads/0/q' });
  });
  it('materiales y material de una región', () => {
    const d = doc();
    const m = d.materials[0]!.id;
    expect(issueTarget('/materials/0/cohesion', d)).toMatchObject({ tab: 'materials', selection: { kind: 'material', materialId: m }, fieldPath: '/materials/0/cohesion' });
    expect(issueTarget('/regions/0/material', d)).toMatchObject({ tab: 'materials', fieldPath: '/regions/0/material' });
  });
  it('geometría de una región: la pestaña «Geometría», con el vértice y su campo x', () => {
    expect(issueTarget('/regions/0/polygon/1', doc())).toMatchObject({ tab: 'geometry', selection: { kind: 'vertex', regionIndex: 0, vertexIndex: 1 }, fieldPath: '/regions/0/polygon/1/x' });
  });
  it('contorno entero o solape de regiones: la pestaña «Geometría» y el primer vértice', () => {
    expect(issueTarget('/regions/0/polygon', doc())).toMatchObject({ tab: 'geometry', selection: { kind: 'region', regionIndex: 0 }, fieldPath: '/regions/0/polygon/0/x' });
    expect(issueTarget('/regions/0', doc())).toMatchObject({ tab: 'geometry', fieldPath: '/regions/0/polygon/0/x' });
  });
  it('un vértice fuera de rango cae en el primero', () => {
    expect(issueTarget('/regions/0/polygon/99', doc())).toMatchObject({ tab: 'geometry', fieldPath: '/regions/0/polygon/0/x' });
  });
});

describe('fieldSelector', () => {
  it('construye el selector del campo por su puntero', () => {
    expect(fieldSelector('/analysis/seismic/kh')).toBe('[data-path="/analysis/seismic/kh"]');
  });
  it('escapa comillas y barras invertidas', () => {
    expect(fieldSelector('/a"b\\c')).toBe('[data-path="/a\\"b\\\\c"]');
  });
});
