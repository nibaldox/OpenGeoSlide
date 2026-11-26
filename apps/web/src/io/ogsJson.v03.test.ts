// Formato v0.3 en la web (F3.9): abre 0.1, 0.2 y 0.3; guarda "0.2" si el modelo no usa ningún campo de la v0.3 y "0.3" si usa alguno.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import { engineModel, minimalVersion, openOgsJson, saveOgsJson, v03Fields } from './ogsJson';

type Json = Record<string, unknown>;

const arcilla = { id: 'arcilla', name: 'Arcilla blanda', model: 'undrained', unit_weight: 18, undrained_strength: 20, strength_datum: 30, strength_gradient: 1.5, strength_limit: 60 };
const mc = { id: 's', name: 'S', model: 'mohr_coulomb', unit_weight: 20, cohesion: 3, friction_angle: 20 };

/** Modelo de la v0.3 del contrato (F3.1): no drenado variable, M-P con puntos y polilínea fija. */
function modelV03(): Json {
  return {
    format: 'opengeoslide',
    version: '0.3',
    meta: {},
    units: 'SI',
    materials: [arcilla],
    regions: [{ material: 'arcilla', polygon: [[0, 0], [60, 0], [60, 35], [0, 35]] }],
    slope: { direction: 'auto' },
    analysis: {
      methods: ['spencer', 'morgenstern_price', 'janbu_simplified', 'janbu_corrected'],
      slices: 50,
      tolerance: 1e-5,
      max_iterations: 500,
      min_m_alpha: 0.2,
      surface: { type: 'polyline', points: [[30, 25], [40, 26.9], [51.3, 35]] },
      interslice: { function: 'data_points', points: [[0, 0], [0.5, 1], [1, 0]] },
    },
  };
}

function modelV02(): Json {
  return {
    format: 'opengeoslide',
    version: '0.2',
    meta: {},
    materials: [mc],
    regions: [{ material: 's', polygon: [[0, 0], [10, 0], [10, 5]] }],
    analysis: { methods: ['bishop', 'spencer'], surface: { type: 'circle', xc: 1, yc: 2, r: 3 } },
  };
}

const roundTrip = (model: unknown): Json => {
  const opened = openOgsJson(JSON.stringify(model));
  expect(opened.issues.filter((i) => i.severity === 'error')).toEqual([]);
  return JSON.parse(saveOgsJson(opened.doc as ModelDoc)) as Json;
};

describe('versión mínima al guardar (F3.9)', () => {
  it('sin campos de la v0.3 guarda 0.2, también si el archivo declaraba 0.1 o 0.3', () => {
    expect(minimalVersion(modelV02())).toBe('0.2');
    expect(roundTrip({ ...modelV02(), version: '0.1' }).version).toBe('0.2');
    expect(roundTrip({ ...modelV02(), version: '0.3' }).version).toBe('0.2');
  });

  it.each([
    ['material no drenado', (m: Json) => ({ ...m, materials: [arcilla] })],
    ['polilínea fija', (m: Json) => ({ ...m, analysis: { ...(m.analysis as Json), surface: { type: 'polyline', points: [[0, 0], [1, 1]] } } })],
    ['Morgenstern-Price', (m: Json) => ({ ...m, analysis: { ...(m.analysis as Json), methods: ['morgenstern_price'] } })],
    ['Janbu simplificado', (m: Json) => ({ ...m, analysis: { ...(m.analysis as Json), methods: ['janbu_simplified'] } })],
    ['Janbu corregido', (m: Json) => ({ ...m, analysis: { ...(m.analysis as Json), methods: ['janbu_corrected'] } })],
    ['función entre dovelas', (m: Json) => ({ ...m, analysis: { ...(m.analysis as Json), methods: ['morgenstern_price'], interslice: { function: 'constant' } } })],
  ])('con %s guarda 0.3', (_name, make) => {
    const model = make(modelV02());
    expect(minimalVersion(model)).toBe('0.3');
    // Un modelo del editor puede tener todavía la versión 0.2 en memoria: al guardar se corrige.
    const doc = { ...model, version: '0.2' } as unknown as ModelDoc;
    expect(JSON.parse(saveOgsJson(doc)).version).toBe('0.3');
  });

  it('un null cuenta como campo ausente: no sube la versión y no se escribe', () => {
    const model = modelV02();
    (model.materials as Json[])[0] = { ...mc, undrained_strength: null, strength_limit: null };
    (model.analysis as Json).interslice = null;
    expect(minimalVersion(model)).toBe('0.2');
    const saved = roundTrip(model);
    expect(saved.version).toBe('0.2');
    expect((saved.materials as Json[])[0]).toEqual(mc);
    expect(Object.keys(saved.analysis as Json)).not.toContain('interslice');
  });
});

describe('ida y vuelta de un modelo 0.3 (F3.1)', () => {
  it('conserva todos los campos, sin redondeo, y el orden canónico', () => {
    const original = modelV03();
    const saved = roundTrip(original);
    expect(saved).toEqual(original);
    expect(Object.keys((saved.materials as Json[])[0] as Json)).toEqual([
      'id', 'name', 'model', 'unit_weight', 'undrained_strength', 'strength_datum', 'strength_gradient', 'strength_limit',
    ]);
    expect(Object.keys(saved.analysis as Json)).toEqual([
      'methods', 'slices', 'tolerance', 'max_iterations', 'min_m_alpha', 'surface', 'interslice',
    ]);
    expect(Object.keys((saved.analysis as { surface: Json }).surface)).toEqual(['type', 'points']);
    expect(Object.keys((saved.analysis as { interslice: Json }).interslice)).toEqual(['function', 'points']);
  });

  it('es idempotente y los números de la polilínea y de la función se conservan bit a bit', () => {
    const first = saveOgsJson(openOgsJson(JSON.stringify(modelV03())).doc as ModelDoc);
    const second = saveOgsJson(openOgsJson(first).doc as ModelDoc);
    expect(second).toBe(first);
    const pts = [[30, 25.000001], [35, 25.520953], [51.29111842105263, 35]];
    const m = modelV03();
    (m.analysis as Json).surface = { type: 'polyline', points: pts };
    const saved = roundTrip(m) as { analysis: { surface: { points: number[][] } } };
    expect(saved.analysis.surface.points).toEqual(pts);
    expect(Object.is(saved.analysis.surface.points[2]![0], 51.29111842105263)).toBe(true);
  });

  it('el ejemplo del contrato (primer bloque json de F3.1) se abre y se guarda en 0.3', () => {
    const md = readFileSync(new URL('../../../../briefs/02_CONTRATOS_FASE3.md', import.meta.url), 'utf8');
    const block = /```json\n([\s\S]*?)```/.exec(md)?.[1] as string;
    const example = JSON.parse(block) as Json;
    // El bloque es un fragmento (no trae regiones): se completa con lo mínimo para abrirlo.
    const full = { ...example, meta: {}, regions: [{ material: 'arcilla', polygon: [[0, 0], [1, 0], [0, 1]] }] };
    const saved = roundTrip(full);
    expect(saved.version).toBe('0.3');
    expect((saved.materials as Json[])[0]).toEqual(example.materials && (example.materials as Json[])[0]);
    expect((saved.analysis as Json).interslice).toEqual((example.analysis as Json).interslice);
    expect((saved.analysis as Json).surface).toEqual((example.analysis as Json).surface);
  });
});

describe('abrir: campos de la v0.3 en un archivo 0.1 o 0.2 se rechazan, como el motor (E13a)', () => {
  it.each(['0.1', '0.2'])('versión %s con un material no drenado: error con su puntero', (version) => {
    const r = openOgsJson(JSON.stringify({ ...modelV03(), version }));
    expect(r.doc).toBeNull();
    const first = r.issues.find((i) => i.code === 'io.version_fields');
    expect(first).toMatchObject({ severity: 'error', path: '/materials/0/model' });
    expect(first?.text).toContain(`declara el formato ${version}`);
    expect(first?.text).toContain('No drenado (Su)');
    expect(first?.text).toContain('"0.3"');
  });

  it('el primer campo es el del material, luego la polilínea, los métodos y la función (orden del motor)', () => {
    const r = openOgsJson(JSON.stringify({ ...modelV03(), version: '0.2' }));
    const paths = r.issues.filter((i) => i.code === 'io.version_fields').map((i) => i.path);
    expect(paths).toEqual([
      '/materials/0/model',
      '/materials/0/undrained_strength',
      '/materials/0/strength_datum',
      '/materials/0/strength_gradient',
      '/materials/0/strength_limit',
      '/analysis/surface',
      '/analysis/methods/1',
      '/analysis/methods/2',
      '/analysis/methods/3',
      '/analysis/interslice',
    ]);
  });

  it('cada campo por separado exige 0.3', () => {
    const cases: [string, Json, string][] = [
      ['polilínea', { ...modelV02(), analysis: { surface: { type: 'polyline', points: [[0, 0], [1, 1]] } } }, '/analysis/surface'],
      ['M-P', { ...modelV02(), analysis: { methods: ['morgenstern_price'], surface: { type: 'circle', xc: 1, yc: 2, r: 3 } } }, '/analysis/methods/0'],
      ['Janbu', { ...modelV02(), analysis: { methods: ['spencer', 'janbu_corrected'], surface: { type: 'circle', xc: 1, yc: 2, r: 3 } } }, '/analysis/methods/1'],
      ['interslice', { ...modelV02(), analysis: { interslice: { function: 'constant' } } }, '/analysis/interslice'],
    ];
    for (const [name, model, path] of cases) {
      const r = openOgsJson(JSON.stringify(model));
      expect(r.doc, name).toBeNull();
      expect(r.issues.find((i) => i.code === 'io.version_fields')?.path, name).toBe(path);
    }
  });

  it('un modelo 0.2 normal no genera incidencias de versión', () => {
    expect(openOgsJson(JSON.stringify(modelV02())).issues).toEqual([]);
  });
});

describe('abrir 0.3: forma y campos desconocidos', () => {
  it('abre un 0.3 sin incidencias y la versión del documento es la mínima', () => {
    const r = openOgsJson(JSON.stringify(modelV03()));
    expect(r.issues).toEqual([]);
    expect(r.doc?.version).toBe('0.3');
    expect(openOgsJson(JSON.stringify({ ...modelV02(), version: '0.3' })).doc?.version).toBe('0.2');
  });

  it('un modelo constitutivo desconocido, una polilínea mal formada y una función desconocida se rechazan con su puntero', () => {
    const badModel = openOgsJson(JSON.stringify({ ...modelV03(), materials: [{ ...arcilla, model: 'hoek_brown' }] }));
    expect(badModel.doc).toBeNull();
    expect(badModel.issues[0]).toMatchObject({ code: 'io.shape', path: '/materials/0/model' });
    const m = modelV03();
    (m.analysis as Json).surface = { type: 'polyline', points: [[0, 0], [1, 'a']] };
    const badPoly = openOgsJson(JSON.stringify(m));
    expect(badPoly.issues.find((i) => i.code === 'io.shape')?.path).toBe('/analysis/surface/points');
    const f = modelV03();
    (f.analysis as Json).interslice = { function: 'triangular' };
    expect(openOgsJson(JSON.stringify(f)).issues.find((i) => i.code === 'io.shape')?.path).toBe('/analysis/interslice/function');
  });

  it('un campo desconocido en la polilínea o en la función se rechaza (deny_unknown_fields)', () => {
    const m = modelV03();
    (m.analysis as Json).interslice = { function: 'constant', extra: 1 };
    const r = openOgsJson(JSON.stringify(m));
    expect(r.doc).toBeNull();
    expect(r.issues.find((i) => i.code === 'io.unknown_field')?.path).toBe('/analysis/interslice/extra');
  });
});

describe('engineModel: lo que se envía al motor en la vista Casos', () => {
  const asDoc = (m: Json): ModelDoc => m as unknown as ModelDoc;

  it('un modelo sin campos nuevos queda tal cual (misma referencia de contenido y versión)', () => {
    const m = asDoc(modelV02());
    expect(engineModel(m)).toEqual(m);
    expect(engineModel({ ...m, version: '0.1' }).version).toBe('0.1');
  });

  it('un 0.2 al que se le piden métodos nuevos sube a 0.3', () => {
    const m = asDoc({ ...modelV02(), analysis: { methods: ['morgenstern_price', 'janbu_corrected'], surface: { type: 'circle', xc: 1, yc: 2, r: 3 } } });
    expect(engineModel(m).version).toBe('0.3');
  });

  it('quita interslice si morgenstern_price no está entre los métodos, y lo conserva si está', () => {
    const base = modelV03();
    const sin = engineModel(asDoc({ ...base, analysis: { ...(base.analysis as Json), methods: ['janbu_simplified'] } }));
    expect(sin.analysis.interslice).toBeUndefined();
    const con = engineModel(asDoc(base));
    expect(con.analysis.interslice).toEqual({ function: 'data_points', points: [[0, 0], [0.5, 1], [1, 0]] });
    // no modifica el original
    expect((base.analysis as Json).interslice).toBeDefined();
  });
});

describe('v03Fields', () => {
  it('lista vacía para un modelo de la v0.2 y para algo que no es un modelo', () => {
    expect(v03Fields(modelV02())).toEqual([]);
    expect(v03Fields(null)).toEqual([]);
    expect(v03Fields({ materials: 'x', analysis: 3 })).toEqual([]);
  });
});
