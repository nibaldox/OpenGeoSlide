// Formato v0.5 en la web (F5.1, F5.2, E15a, E15b): abre 0.1 a 0.5; guarda "0.5" solo si existe `analysis.tension_crack`; la grieta
// se lee y se guarda sin pérdida y en orden canónico; `tension_crack` con una versión menor es un error con su puntero.
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import { anchor } from '../editor/state/reinforcementFixtures';
import { describePath, engineModel, minimalVersion, openOgsJson, saveOgsJson, v05Fields } from './ogsJson';

type Json = Record<string, unknown>;

const SURFACE = { type: 'circle', xc: 30, yc: 60, r: 50 };

function model(version: string, crack?: unknown, extra: Json = {}, analysis: Json = {}): Json {
  return {
    format: 'opengeoslide',
    version,
    meta: {},
    units: 'SI',
    materials: [{ id: 's', name: 'S', model: 'mohr_coulomb', unit_weight: 20, cohesion: 3, friction_angle: 20 }],
    regions: [{ material: 's', polygon: [[0, 0], [60, 0], [60, 35], [0, 35]] }],
    slope: { direction: 'auto' },
    analysis: { methods: ['bishop'], surface: SURFACE, ...(crack === undefined ? {} : { tension_crack: crack }), ...analysis },
    ...extra,
  };
}

const open = (m: unknown) => openOgsJson(JSON.stringify(m));
const errors = (m: unknown) => open(m).issues.filter((i) => i.severity === 'error');
const saved = (doc: ModelDoc): Json => JSON.parse(saveOgsJson(doc)) as Json;
const CRACK = { depth: 2, water_fill: 1 };

describe('v0.5: versión mínima y compuerta (F5.1)', () => {
  it('abre 0.5 con y sin grieta', () => {
    expect(errors(model('0.5', CRACK))).toEqual([]);
    expect(errors(model('0.5'))).toEqual([]);
  });

  it('guarda 0.5 solo si hay grieta; con la 0.5 declarada y sin grieta baja a la mínima', () => {
    const withCrack = open(model('0.5', CRACK)).doc as ModelDoc;
    expect(minimalVersion(withCrack)).toBe('0.5');
    expect(saved(withCrack).version).toBe('0.5');
    const without = open(model('0.5')).doc as ModelDoc;
    expect(minimalVersion(without)).toBe('0.2');
    expect(saved(without).version).toBe('0.2');
  });

  it('con campos de la v0.3 o refuerzos y sin grieta, sigue 0.3 o 0.4; con grieta, 0.5', () => {
    const mp = { methods: ['morgenstern_price'] };
    expect(minimalVersion(open(model('0.5', undefined, {}, mp)).doc)).toBe('0.3');
    expect(minimalVersion(open(model('0.5', undefined, { reinforcements: [anchor()] })).doc)).toBe('0.4');
    expect(minimalVersion(open(model('0.5', CRACK, { reinforcements: [anchor()] }, mp)).doc)).toBe('0.5');
  });

  it('`tension_crack: null` cuenta como ausente: no sube la versión y no se escribe', () => {
    const doc = open(model('0.4', null)).doc as ModelDoc;
    expect(minimalVersion(doc)).toBe('0.2');
    expect('tension_crack' in (saved(doc).analysis as Json)).toBe(false);
    expect(v05Fields({ analysis: { tension_crack: null } })).toEqual([]);
  });

  it('con una versión menor que 0.5 y grieta es un error con su puntero y nombra la 0.5', () => {
    for (const v of ['0.1', '0.2', '0.3', '0.4']) {
      const e = errors(model(v, CRACK, v === '0.1' ? {} : {})).find((i) => i.code === 'io.version_fields');
      expect(e, v).toBeDefined();
      expect(e?.path).toBe('/analysis/tension_crack');
      expect(e?.text).toContain('0.5');
      expect(e?.text).toContain('grieta de tracción');
    }
  });

  it('la versión 0.8 se rechaza y el texto nombra de la 0.1 a la 0.7', () => {
    const e = errors(model('0.8')).find((i) => i.code === 'io.version');
    expect(e?.text).toContain('0.5');
    expect(e?.text).toContain('0.6');
    expect(e?.text).toContain('0.7');
  });

  it('refuerzos y campos de la v0.3 se aceptan en un archivo 0.5', () => {
    expect(errors(model('0.5', undefined, { reinforcements: [anchor()] }, { methods: ['spencer', 'janbu_simplified'], interslice: null }))).toEqual([]);
  });

  it('v05Fields y engineModel', () => {
    expect(v05Fields({ analysis: { tension_crack: CRACK } })[0]?.path).toBe('/analysis/tension_crack');
    expect(v05Fields({ analysis: {} })).toEqual([]);
    const doc = open(model('0.5', CRACK)).doc as ModelDoc;
    expect(engineModel({ ...doc, version: '0.2' }).version).toBe('0.5');
    expect(engineModel(open(model('0.2')).doc as ModelDoc).version).toBe('0.2');
    const both = { ...doc, reinforcements: [anchor()] } as ModelDoc;
    expect(engineModel({ ...both, version: '0.4' }).version).toBe('0.5');
  });
});

describe('v0.5: ida y vuelta de la grieta (F5.2)', () => {
  it('abre y guarda `depth` numérica y `water_fill` sin pérdida, al final de `analysis` y con depth primero', () => {
    const doc = open(model('0.5', { water_fill: 0.5, depth: 1 / 3 }, {}, { seismic: { kh: 0.1, kv: 0 } })).doc as ModelDoc;
    const a = saved(doc).analysis as Json;
    expect(a.tension_crack).toEqual({ depth: 1 / 3, water_fill: 0.5 });
    expect(Object.keys(a)).toEqual(['methods', 'surface', 'seismic', 'tension_crack']);
    expect(Object.keys(a.tension_crack as Json)).toEqual(['depth', 'water_fill']);
  });

  it('«auto» se conserva como cadena y 0 es un valor válido de water_fill', () => {
    const doc = open(model('0.5', { depth: 'auto', water_fill: 0 })).doc as ModelDoc;
    expect((saved(doc).analysis as Json).tension_crack).toEqual({ depth: 'auto', water_fill: 0 });
  });

  it('guardar, abrir y guardar da el mismo texto, byte a byte', () => {
    const t1 = saveOgsJson(open(model('0.5', CRACK)).doc as ModelDoc);
    expect(saveOgsJson(openOgsJson(t1).doc as ModelDoc)).toBe(t1);
  });

  it('un caso de verificación {model, checks} con grieta se abre', () => {
    const r = open({ model: model('0.5', CRACK), checks: [] });
    expect(r.doc?.analysis.tension_crack).toEqual(CRACK);
  });
});

describe('v0.5: forma estricta de la grieta (deny_unknown_fields)', () => {
  const bad = (c: unknown) => errors(model('0.5', c));

  it('una clave desconocida, incluida la posición que no existe, es io.unknown_field con su puntero', () => {
    const e = bad({ ...CRACK, x: 12 }).find((i) => i.code === 'io.unknown_field');
    expect(e?.path).toBe('/analysis/tension_crack/x');
    expect(bad({ ...CRACK, water: 1 }).some((i) => i.code === 'io.unknown_field')).toBe(true);
  });

  it('campos ausentes o de tipo incorrecto son io.shape con la ruta del campo; `water_fill` no tiene valor por defecto', () => {
    const paths = (c: unknown): string[] => bad(c).filter((i) => i.code === 'io.shape').map((i) => i.path ?? '');
    expect(paths({ depth: 2 })).toContain('/analysis/tension_crack/water_fill');
    expect(paths({ water_fill: 1 })).toContain('/analysis/tension_crack/depth');
    expect(paths({ depth: '2', water_fill: 1 })).toContain('/analysis/tension_crack/depth');
    expect(paths({ depth: 'automatica', water_fill: 1 })).toContain('/analysis/tension_crack/depth');
    expect(paths({ depth: 2, water_fill: '1' })).toContain('/analysis/tension_crack/water_fill');
    expect(paths([2, 1])).toContain('/analysis/tension_crack');
    expect(paths(7)).toContain('/analysis/tension_crack');
  });

  it('los rangos (depth ≤ 0, water_fill fuera de [0, 1]) no son del formato: se abren y los señala la validación local', () => {
    expect(bad({ depth: 0, water_fill: 2 })).toEqual([]);
    expect(bad({ depth: -1, water_fill: -0.1 })).toEqual([]);
  });

  it('un número no finito es io.non_finite y saveOgsJson no lo guarda', () => {
    const text = JSON.stringify(model('0.5', { depth: 2, water_fill: 1 })).replace('"depth":2', '"depth":1e400');
    const r = openOgsJson(text);
    expect(r.doc).toBeNull();
    expect(r.issues.some((i) => i.code === 'io.non_finite' && i.path === '/analysis/tension_crack/depth')).toBe(true);
    const doc = open(model('0.5', CRACK)).doc as ModelDoc;
    const broken: ModelDoc = { ...doc, analysis: { ...doc.analysis, tension_crack: { depth: Number.NaN, water_fill: 1 } } };
    expect(() => saveOgsJson(broken)).toThrow(/no finito/);
  });
});

describe('v0.5: ubicación en palabras de usuario', () => {
  it('describePath', () => {
    expect(describePath('/analysis/tension_crack')).toBe('la grieta de tracción');
    expect(describePath('/analysis/tension_crack/depth')).toBe('la grieta de tracción (profundidad)');
    expect(describePath('/analysis/tension_crack/water_fill')).toBe('la grieta de tracción (fracción de agua)');
  });
});
