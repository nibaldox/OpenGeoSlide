import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsv, csvToRegions } from '../../io/csv';
import { parseDxf } from '../../io/dxf';
import { loadCaseDoc } from '../../report/fixtures';
import { createEditorStore, validateLocal } from '../state';
import {
  NEW_MATERIAL,
  SKIP_LAYER,
  applyPlanToDoc,
  closeWithBase,
  defaultMapping,
  defaultUnit,
  importableLayers,
  openPolylines,
  planRegionImport,
  suggestBaseText,
  suggestBaseY,
  unitFactor,
} from './importPlan';

const fixture = (name: string): string => readFileSync(new URL(`../../io/dxf/fixtures/${name}`, import.meta.url), 'utf8');

describe('unidades', () => {
  it('factor a metros y a pies', () => {
    expect(unitFactor('m', 'SI')).toBe(1);
    expect(unitFactor('mm', 'SI')).toBeCloseTo(0.001, 12);
    expect(unitFactor('cm', undefined)).toBeCloseTo(0.01, 12);
    expect(unitFactor('ft', 'SI')).toBeCloseTo(0.3048, 12);
    expect(unitFactor('ft', 'imperial')).toBe(1);
    expect(unitFactor('in', 'imperial')).toBeCloseTo(1 / 12, 12);
    expect(unitFactor('m', 'imperial')).toBeCloseTo(3.280839895, 8);
  });

  it('la unidad propuesta es la del encabezado o, si no hay, la del modelo', () => {
    expect(defaultUnit('mm', 'SI')).toBe('mm');
    expect(defaultUnit(null, 'SI')).toBe('m');
    expect(defaultUnit(null, 'imperial')).toBe('ft');
  });
});

describe('closeWithBase', () => {
  it('cierra un terreno abierto con una base horizontal', () => {
    expect(closeWithBase([[0, 10], [10, 10], [20, 5]], 0)).toEqual([[0, 10], [10, 10], [20, 5], [20, 0], [0, 0]]);
  });
  it('no duplica vértices si el extremo ya está en la base', () => {
    expect(closeWithBase([[0, 0], [10, 5], [20, 0]], 0)).toEqual([[0, 0], [10, 5], [20, 0]]);
  });
  it('una polilínea de un punto no es una región', () => {
    expect(closeWithBase([[0, 0]], 0)).toBeNull();
  });
});

describe('DXF: terraplen.dxf', () => {
  const doc = loadCaseDoc('V047a');
  const result = parseDxf(fixture('terraplen.dxf'), { materials: [{ id: 'suelo', name: 'Suelo_1' }] });

  it('capas importables con sugerencia y polilínea abierta', () => {
    const layers = importableLayers(result);
    expect(layers.map((l) => l.name)).toContain('SUELO_1');
    expect(layers.find((l) => l.name === 'SUELO_1')?.suggestedMaterialId).toBe('suelo');
    expect(layers.reduce((a, l) => a + l.regions, 0)).toBe(2);
    expect(openPolylines(result).length).toBeGreaterThanOrEqual(1);
  });

  it('mapeo: usa el material elegido, crea uno nuevo con id único y omite capas', () => {
    const layers = importableLayers(result);
    const mapping = defaultMapping(layers);
    expect(mapping.SUELO_1).toBe('suelo');
    mapping.arcilla = NEW_MATERIAL;
    const plan = planRegionImport(
      { materials: [{ ...doc.materials[0]!, id: 'arcilla' }], units: 'SI' },
      { regions: result.regions, open: [], mapping, factor: 1, openMode: 'discard', baseY: null },
    );
    expect(plan.regions.map((r) => r.material)).toEqual(['suelo', 'arcilla_2']);
    expect(plan.newMaterials.map((m) => [m.id, m.name])).toEqual([['arcilla_2', 'arcilla']]);
    const skipAll = planRegionImport(doc, {
      regions: result.regions,
      open: [],
      mapping: { SUELO_1: SKIP_LAYER, arcilla: SKIP_LAYER },
      factor: 1,
      openMode: 'discard',
      baseY: null,
    });
    expect(skipAll.regions).toEqual([]);
    expect(skipAll.skipped).toBe(2);
  });

  it('polilíneas abiertas: cerrar con base o descartar', () => {
    const open = openPolylines(result).map((e) => ({ layer: e.layer, points: e.points }));
    const base = {
      regions: [],
      open,
      mapping: Object.fromEntries(open.map((o) => [o.layer, NEW_MATERIAL])),
      factor: 1,
    };
    const closed = planRegionImport(doc, { ...base, openMode: 'close', baseY: 0 });
    expect(closed.regions.length).toBe(open.length);
    expect(closed.regions[0]!.polygon.length).toBeGreaterThanOrEqual(3);
    const dropped = planRegionImport(doc, { ...base, openMode: 'discard', baseY: 0 });
    expect(dropped.regions).toEqual([]);
    expect(dropped.skipped).toBe(open.length);
    const noBase = planRegionImport(doc, { ...base, openMode: 'close', baseY: null });
    expect(noBase.regions).toEqual([]);
    expect(noBase.notes.length).toBe(1);
  });

  it('suggestBaseY queda por debajo de la geometría', () => {
    expect(suggestBaseY([[0, 5], [1, 7.26]], 1)).toBe(4);
    expect(suggestBaseY([], 1)).toBeNull();
  });
});

describe('DXF en mm: reescala al importar', () => {
  it('polyline2d_crlf.dxf con unidad mm → metros', () => {
    const r = parseDxf(fixture('polyline2d_crlf.dxf'));
    const plan = planRegionImport(
      { materials: [], units: 'SI' },
      { regions: r.regions, open: [], mapping: { ROCA: NEW_MATERIAL }, factor: unitFactor('mm', 'SI'), openMode: 'discard', baseY: null },
    );
    expect(plan.regions[0]!.polygon).toEqual([[0, 0], [1, 0], [1, 0.5], [0, 0.5]]);
    expect(plan.newMaterials[0]!.id).toBe('roca');
  });
});

describe('aplicar el plan al documento y deshacerlo de una vez', () => {
  it('replace y add dan documentos distintos; doc/replace se deshace con un Ctrl+Z', () => {
    const doc = loadCaseDoc('V047a');
    const plan = planRegionImport(doc, {
      regions: [{ layer: 'N', polygon: [[0, 0], [1, 0], [1, 1]] }],
      open: [],
      mapping: { N: NEW_MATERIAL },
      factor: 1,
      openMode: 'discard',
      baseY: null,
    });
    const replaced = applyPlanToDoc(doc, plan, 'replace');
    const added = applyPlanToDoc(doc, plan, 'add');
    expect(replaced.regions).toHaveLength(1);
    expect(added.regions).toHaveLength(doc.regions.length + 1);
    expect(replaced.materials.map((m) => m.id)).toContain('n');
    expect(doc.regions.length).toBeGreaterThanOrEqual(1);

    const store = createEditorStore(doc);
    store.dispatch({ type: 'doc/replace', doc: replaced, fileName: 'x.dxf' });
    expect(store.getState().doc.regions).toHaveLength(1);
    store.undo();
    expect(store.getState().doc.regions).toHaveLength(doc.regions.length);
  });

  it('modo add con gesto: material + región son una sola entrada de historial', () => {
    const doc = loadCaseDoc('V047a');
    const store = createEditorStore(doc);
    const plan = planRegionImport(doc, {
      regions: [{ layer: 'Nueva', polygon: [[0, 0], [1, 0], [1, 1]] }],
      open: [],
      mapping: { Nueva: NEW_MATERIAL },
      factor: 1,
      openMode: 'discard',
      baseY: null,
    });
    store.beginGesture('Importar DXF');
    for (const m of plan.newMaterials) store.dispatch({ type: 'material/upsert', material: m });
    for (const r of plan.regions) store.dispatch({ type: 'region/add', region: r });
    store.endGesture();
    expect(store.getState().doc.regions).toHaveLength(doc.regions.length + 1);
    expect(store.getState().doc.materials).toHaveLength(doc.materials.length + 1);
    store.undo();
    expect(store.getState().doc.regions).toHaveLength(doc.regions.length);
    expect(store.getState().doc.materials).toHaveLength(doc.materials.length);
    expect(validateLocal(store.getState().doc).filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('CSV capa,x,y', () => {
  it('las capas del CSV pasan por el mismo plan', () => {
    const csv = 'capa,x,y\nsuelo,0,0\nsuelo,10,0\nsuelo,10,5\nroca,0,-5\nroca,10,-5\nroca,10,0\n';
    const { regions } = csvToRegions(parseCsv(csv));
    expect(regions.map((r) => r.layer)).toEqual(['suelo', 'roca']);
    const doc = loadCaseDoc('V047a');
    const plan = planRegionImport(doc, {
      regions,
      open: [],
      mapping: { suelo: doc.materials[0]!.id, roca: NEW_MATERIAL },
      factor: 1,
      openMode: 'discard',
      baseY: null,
    });
    expect(plan.regions.map((r) => r.material)).toEqual([doc.materials[0]!.id, 'roca']);
  });
});

// R5-06 (c): el mapeo se consulta con Object.hasOwn; una capa llamada como una propiedad de Object.prototype no
// puede heredar un valor del prototipo.
describe('R5-06: capas con nombre de propiedad del prototipo', () => {
  const doc = { materials: [], units: 'SI' };
  const base = { open: [], factor: 1, openMode: 'discard' as const, baseY: null };
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][];

  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf'])(
    'la capa «%s» sin mapear se omite (no asigna una función como material)',
    (layer) => {
      const plan = planRegionImport(doc, { ...base, regions: [{ layer, polygon: sq }], mapping: {} });
      expect(plan.regions).toEqual([]);
      expect(plan.skipped).toBe(1);
      expect(plan.newMaterials).toEqual([]);
    },
  );

  it.each(['constructor', 'toString', '__proto__'])('la capa «%s» mapeada de forma explícita se respeta', (layer) => {
    const mapping = Object.fromEntries([[layer, NEW_MATERIAL]]);
    const plan = planRegionImport(doc, { ...base, regions: [{ layer, polygon: sq }], mapping });
    expect(plan.regions).toHaveLength(1);
    expect(typeof plan.regions[0]?.material).toBe('string');
    expect(plan.newMaterials.map((m) => m.name)).toEqual([layer]);
  });

  it('defaultMapping conserva la capa «__proto__» como propiedad propia', () => {
    const m = defaultMapping([{ name: '__proto__', suggestedMaterialId: null }, { name: 'constructor', suggestedMaterialId: 'x' }]);
    expect(Object.hasOwn(m, '__proto__')).toBe(true);
    expect(m['constructor']).toBe('x');
    const plan = planRegionImport(doc, { ...base, regions: [{ layer: '__proto__', polygon: sq }], mapping: m });
    expect(plan.regions).toHaveLength(1);
  });

  it('DXF con capas «constructor» y «toString»: el plan por defecto crea materiales de texto', () => {
    const text = '0\nSECTION\n2\nENTITIES\n' +
      ['constructor', 'toString'].map((l) => `0\nLWPOLYLINE\n8\n${l}\n90\n4\n70\n1\n10\n0\n20\n0\n10\n4\n20\n0\n10\n4\n20\n3\n10\n0\n20\n3\n`).join('') +
      '0\nENDSEC\n0\nEOF\n';
    const r = parseDxf(text);
    const unmapped = planRegionImport(doc, { ...base, regions: r.regions, mapping: {} });
    expect(unmapped.regions).toEqual([]);
    const plan = planRegionImport(doc, { ...base, regions: r.regions, mapping: defaultMapping(r.layers) });
    expect(plan.regions.map((x) => typeof x.material)).toEqual(['string', 'string']);
  });
});

describe('base de las polilíneas abiertas (R7-06)', () => {
  const open = [{ layer: 'terreno', points: [[0, 10000], [50000, 12000]] as [number, number][] }];
  it('la base sugerida depende de la unidad del dibujo: en mm no es la de metros', () => {
    const enMetros = suggestBaseText(open, 'm', 'SI');
    const enMm = suggestBaseText(open, 'mm', 'SI');
    expect(enMetros).toBe('9999');
    expect(enMm).toBe('9');
    expect(enMm).not.toBe(enMetros);
  });
  it('usa coma decimal y queda vacía sin polilíneas abiertas', () => {
    expect(suggestBaseText([{ points: [[0, 1.55], [1, 3]] }], 'm', 'SI')).toBe('0,5');
    expect(suggestBaseText([], 'm', 'SI')).toBe('');
  });
  it('las notas del plan no se repiten por cada polilínea abierta', () => {
    const doc = loadCaseDoc('V047a');
    const poly = (n: number) => ({ layer: 'terreno', points: [[0, n], [10, n + 1]] as [number, number][] });
    const plan = planRegionImport(
      { materials: doc.materials, units: doc.units },
      { regions: [], open: [poly(0), poly(5), poly(9)], mapping: { terreno: doc.materials[0]!.id }, factor: 1, openMode: 'close', baseY: null },
    );
    expect(plan.skipped).toBe(3);
    expect(plan.notes).toHaveLength(1);
  });
});
