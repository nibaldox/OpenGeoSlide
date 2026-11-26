import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../types';
import { newDoc } from './docTemplates';
import { fieldSelector, issueTarget, issueTargetFor } from './issueNav';

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

describe('issueTarget: proyecto', () => {
  it('título, id y descripción abren «Proyecto» y enfocan su campo', () => {
    for (const f of ['title', 'id', 'notes']) expect(issueTarget(`/meta/${f}`, doc())).toMatchObject({ tab: 'project', fieldPath: `/meta/${f}` });
  });
  it('/meta sin campo conocido enfoca el título', () => {
    expect(issueTarget('/meta', doc())).toMatchObject({ tab: 'project', fieldPath: '/meta/title' });
    expect(issueTarget('/meta/otro', doc())).toMatchObject({ tab: 'project', fieldPath: '/meta/title' });
  });
  it('las unidades abren «Proyecto» y enfocan el selector de unidades', () => {
    expect(issueTarget('/units', doc())).toMatchObject({ tab: 'project', fieldPath: '/units' });
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

describe('issueTarget: colecciones (B-03)', () => {
  it('/regions (modelo vacío) lleva a Geometría y enfoca «Dibujar región»', () => {
    const t = issueTarget('/regions', doc());
    expect(t).toMatchObject({ tab: 'geometry', selection: { kind: 'none' }, fieldPath: null });
    expect(t?.focus?.map((f) => f.selector)).toEqual(['.ns-empty button', '[aria-label=\"Herramienta del lienzo\"] button']);
    expect(t?.focus?.every((f) => f.text === '^Dibujar región')).toBe(true);
  });
  it('/analysis/search y /analysis/surface llevan a sus pestañas', () => {
    expect(issueTarget('/analysis/search', doc())).toMatchObject({ tab: 'search' });
    expect(issueTarget('/analysis/surface', doc())).toMatchObject({ tab: 'surface' });
  });
  it('/regions/99 (índice inexistente) sigue sin destino', () => {
    expect(issueTarget('/regions/99', doc())).toBeNull();
  });
});

describe('issueTargetFor: incidencias sin puntero', () => {
  const issue = (code: string, path: string | null = null) => ({ source: 'engine' as const, severity: 'error' as const, code, text: 'x', path });
  it('«no hay superficie válida» del motor lleva a Búsqueda si el modelo busca', () => {
    const d = { ...doc(), analysis: { ...doc().analysis, search: { type: 'circular_entry_exit', entry: [0, 1], exit: [2, 3] } } } as ModelDoc;
    expect(issueTargetFor(issue('NoValidSurface'), d)).toMatchObject({ tab: 'search', fieldPath: null });
  });
  it('sin búsqueda, la misma incidencia lleva a Superficie', () => {
    const d = { ...doc(), analysis: { ...doc().analysis, search: undefined } } as ModelDoc;
    expect(issueTargetFor(issue('NoValidSurface'), d)).toMatchObject({ tab: 'surface' });
  });
  it('un método sin superficie válida (engine.invalid) también', () => {
    expect(issueTargetFor(issue('engine.invalid'), doc())).not.toBeNull();
  });
  it('con puntero, manda el puntero', () => {
    expect(issueTargetFor(issue('NoValidSurface', '/analysis/seismic/kh'), doc())).toMatchObject({ tab: 'seismic' });
  });
  it('una incidencia sin puntero ni código conocido no tiene destino', () => {
    expect(issueTargetFor(issue('EngineError'), doc())).toBeNull();
    expect(issueTargetFor(issue('InvalidModel'), doc())).toBeNull();
  });
  it('tabla de destinos: cada código con destino', () => {
    for (const code of ['NoValidSurface', 'engine.invalid', 'NoSurface']) expect(issueTargetFor(issue(code), doc()), code).not.toBeNull();
  });
});

describe('issueTarget: refuerzos (v0.4)', () => {
  const withR = (): ModelDoc =>
    ({
      ...doc(),
      version: '0.4',
      reinforcements: [
        { type: 'anchor', id: 'a1', x1: 0, y1: 5, x2: 4, y2: 4, application: 'active', direction: 'axial', tensile_capacity: 100 },
        { type: 'nail', id: 'n1', x1: 1, y1: 3, x2: 5, y2: 2, application: 'passive', direction: 'axial', tensile_capacity: 50, pullout: { model: 'bond', strength: 10 } },
      ],
    }) as ModelDoc;
  it('un campo de un refuerzo abre «Refuerzos», selecciona el elemento y enfoca el campo', () => {
    expect(issueTarget('/reinforcements/1/tensile_capacity', withR())).toMatchObject({
      tab: 'reinforcements',
      selection: { kind: 'reinforcement', index: 1 },
      fieldPath: '/reinforcements/1/tensile_capacity',
    });
    expect(issueTarget('/reinforcements/0/id', withR())).toMatchObject({ tab: 'reinforcements', fieldPath: '/reinforcements/0/id' });
  });
  it('los campos de pullout apuntan al control plano del panel', () => {
    expect(issueTarget('/reinforcements/1/pullout/strength', withR())).toMatchObject({ tab: 'reinforcements', fieldPath: '/reinforcements/1/strength' });
    expect(issueTarget('/reinforcements/1/pullout/bonded_length', withR())).toMatchObject({ fieldPath: '/reinforcements/1/bonded_length' });
    expect(issueTarget('/reinforcements/1/pullout', withR())).toMatchObject({ fieldPath: '/reinforcements/1/pullout' });
  });
  it('sin índice abre la pestaña; un índice inexistente no es navegable', () => {
    expect(issueTarget('/reinforcements', withR())).toMatchObject({ tab: 'reinforcements', fieldPath: null });
    expect(issueTarget('/reinforcements/9/id', withR())).toBeNull();
  });
});
