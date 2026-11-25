import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import type { VerificationCase } from '../engine/types';
import { openOgsJson, saveOgsJson, sha256Bytes, sha256Hex } from './ogsJson';

const casesDir = new URL('../../../../verification/cases/', import.meta.url);
const caseFiles = readdirSync(casesDir).filter((f) => f.endsWith('.json') && f !== 'ogs-0.1.schema.json').sort();

function loadCase(file: string): { text: string; parsed: VerificationCase } {
  const text = readFileSync(new URL(file, casesDir), 'utf8');
  return { text, parsed: JSON.parse(text) as VerificationCase };
}

const diffDir = new URL('../../../../verification/differential/cases/', import.meta.url);
const diffFiles = readdirSync(diffDir).filter((f) => f.endsWith('.ogs.json')).sort();

type Json = Record<string, unknown>;

/** Modelo de la batería con la superficie fija (sin búsqueda), como lo calcula `differential/run.py`. */
function fixedModel(text: string): Json {
  const m = JSON.parse(text) as { analysis: Json } & Json;
  const { search: _search, ...analysis } = m.analysis;
  return { ...m, analysis };
}

/** Abre y guarda con los módulos reales y devuelve el JSON guardado. */
function roundTrip(model: unknown): Json {
  const opened = openOgsJson(JSON.stringify(model));
  expect(opened.issues.filter((i) => i.severity === 'error')).toEqual([]);
  return JSON.parse(saveOgsJson(opened.doc as ModelDoc)) as Json;
}

const CANONICAL_TOP = ['format', 'version', 'meta', 'units', 'materials', 'regions', 'water', 'loads', 'slope', 'analysis'];

function isSubsequence(keys: string[], order: string[]): boolean {
  let i = 0;
  for (const k of keys) {
    i = order.indexOf(k, i);
    if (i < 0) return false;
    i += 1;
  }
  return true;
}

describe('ogsJson: ida y vuelta con los casos de verificación', () => {
  it('hay al menos los 21 casos de v0.1 y v0.2', () => {
    expect(caseFiles.length).toBeGreaterThanOrEqual(21);
  });

  for (const file of caseFiles) {
    it(`${file}: abrir y guardar conserva todos los números (E12g: sin redondeo), salvo version`, () => {
      const { parsed } = loadCase(file);
      const opened = openOgsJson(JSON.stringify(parsed.model));
      expect(opened.doc).not.toBeNull();
      expect(opened.issues.filter((i) => i.severity === 'error')).toEqual([]);
      const saved = JSON.parse(saveOgsJson(opened.doc as ModelDoc)) as Record<string, unknown>;
      expect(saved.version).toBe('0.2');
      expect(saved).toEqual({ ...(parsed.model as unknown as Json), version: '0.2' });
      expect(isSubsequence(Object.keys(saved), CANONICAL_TOP)).toBe(true);
    });

    it(`${file}: el guardado es idempotente y el wrapper {model, checks} se abre con aviso`, () => {
      const { text, parsed } = loadCase(file);
      const first = saveOgsJson(openOgsJson(JSON.stringify(parsed.model)).doc as ModelDoc);
      const second = saveOgsJson(openOgsJson(first).doc as ModelDoc);
      expect(second).toBe(first);
      const wrapped = openOgsJson(text);
      expect(wrapped.doc).not.toBeNull();
      expect(wrapped.issues.some((i) => i.code === 'io.checks_discarded')).toBe(true);
      expect(saveOgsJson(wrapped.doc as ModelDoc)).toBe(first);
    });
  }
});

describe('ogsJson: ida y vuelta con los 14 modelos de la batería diferencial (E12g, R5-02)', () => {
  it('hay 14 modelos', () => {
    expect(diffFiles).toHaveLength(14);
  });

  for (const file of diffFiles) {
    const text = readFileSync(new URL(file, diffDir), 'utf8');
    const original = JSON.parse(text) as Json;

    it(`${file}: con búsqueda y con superficie fija, los números son idénticos al original`, () => {
      expect(roundTrip(original)).toEqual({ ...original, version: '0.2' });
      const fixed = fixedModel(text);
      const saved = roundTrip(fixed);
      expect(saved).toEqual({ ...fixed, version: '0.2' });
      // El círculo fijo conserva sus 15-17 cifras: con 6 decimales sacaba el círculo del modelo (6 de 14 modelos).
      const surface = (original.analysis as { surface: { xc: number; yc: number; r: number } }).surface;
      expect((saved.analysis as { surface: unknown }).surface).toEqual({ type: 'circle', ...surface });
      expect(Object.is((saved.analysis as { surface: { r: number } }).surface.r, surface.r)).toBe(true);
    });
  }

  it('R5-02: D01 fijo conserva el círculo bit a bit', () => {
    const original = JSON.parse(readFileSync(new URL('D01.ogs.json', diffDir), 'utf8')) as { analysis: { surface: unknown } };
    const saved = roundTrip(original) as { analysis: { surface: unknown } };
    expect(saved.analysis.surface).toEqual({ type: 'circle', xc: 49.57942825454256, yc: 34.823211318713575, r: 36.11677577292455 });
  });
});

describe('ogsJson: modelos de frontera (E12g, R5-02)', () => {
  const base = (): Json => ({
    format: 'opengeoslide',
    version: '0.2',
    meta: {},
    materials: [{ id: 's', name: 'S', model: 'mohr_coulomb', unit_weight: 20, cohesion: 3, friction_angle: 20, ru: 0.9999999 }],
    regions: [{ material: 's', polygon: [[0, 0], [10, 0], [10, 5]] }],
    analysis: { min_m_alpha: 1e-7, tolerance: 1e-8, seismic: { kh: 0.9999999, kv: -0.9999999 }, surface: { type: 'circle', xc: 1.0000001, yc: 2.0000004, r: 3.0000009 } },
  });

  it('min_m_alpha = 1e-7, kh, kv y ru = 0,9999999 se conservan; no pasan a 0 ni a 1', () => {
    const saved = roundTrip(base()) as { materials: { ru: number }[]; analysis: { min_m_alpha: number; tolerance: number; seismic: { kh: number; kv: number } } };
    expect(saved.analysis.min_m_alpha).toBe(1e-7);
    expect(saved.analysis.tolerance).toBe(1e-8);
    expect(saved.analysis.seismic).toEqual({ kh: 0.9999999, kv: -0.9999999 });
    expect(saved.materials[0]?.ru).toBe(0.9999999);
  });

  it('el texto guardado trae las cifras completas y es idempotente', () => {
    const text = saveOgsJson(openOgsJson(JSON.stringify(base())).doc as ModelDoc);
    expect(text).toContain('0.9999999');
    expect(text).toContain('3.0000009');
    expect(saveOgsJson(openOgsJson(text).doc as ModelDoc)).toBe(text);
  });
});

describe('ogsJson: abrir', () => {
  const base = (): Record<string, unknown> => ({
    format: 'opengeoslide',
    version: '0.1',
    materials: [{ id: 's', name: 'S', model: 'mohr_coulomb', unit_weight: 20, cohesion: 3, friction_angle: 20 }],
    regions: [{ material: 's', polygon: [[0, 0], [10, 0], [10, 5]] }],
    analysis: { surface: { type: 'circle', xc: 1, yc: 2, r: 3 } },
  });

  it('rechaza JSON inválido, no objeto, format y version incorrectos', () => {
    expect(openOgsJson('{no').doc).toBeNull();
    expect(openOgsJson('[]').doc).toBeNull();
    const badFormat = openOgsJson(JSON.stringify({ ...base(), format: 'otro' }));
    expect(badFormat.doc).toBeNull();
    expect(badFormat.issues[0]).toMatchObject({ severity: 'error', code: 'io.format' });
    const badVersion = openOgsJson(JSON.stringify({ ...base(), version: '0.3' }));
    expect(badVersion.doc).toBeNull();
    expect(badVersion.issues[0]?.code).toBe('io.version');
    expect(openOgsJson(JSON.stringify({ ...base(), version: undefined })).doc).toBeNull();
  });

  it('rechaza formas inválidas con la ruta del error', () => {
    const noRegions = openOgsJson(JSON.stringify({ ...base(), regions: 'x' }));
    expect(noRegions.doc).toBeNull();
    expect(noRegions.issues[0]?.path).toBe('/regions');
    const badPoly = base();
    (badPoly.regions as { polygon: unknown }[])[0]!.polygon = [[0, 0], [1, 'a']];
    expect(openOgsJson(JSON.stringify(badPoly)).issues[0]?.path).toBe('/regions/0/polygon');
    expect(openOgsJson(JSON.stringify({ ...base(), loads: [{ type: 'x' }] })).doc).toBeNull();
  });

  it('acepta BOM, v0.1 (nota de actualización) y rellena meta y analysis', () => {
    const r = openOgsJson(`\ufeff${JSON.stringify({ ...base(), analysis: undefined })}`);
    expect(r.doc?.version).toBe('0.2');
    expect(r.doc?.meta).toEqual({});
    expect(r.doc?.analysis).toEqual({});
    expect(r.issues.map((i) => i.code)).toEqual(['io.version_upgraded']);
    expect(r.issues[0]?.severity).toBe('nota');
  });

  it('v0.2 con cargas y sismo no genera incidencias', () => {
    const m: Record<string, unknown> = {
      ...base(),
      version: '0.2',
      loads: [{ type: 'udl', id: 'u1', x1: 1, x2: 2, q: 20 }],
    };
    (m.analysis as Record<string, unknown>).seismic = { kh: 0.1, kv: 0 };
    const r = openOgsJson(JSON.stringify(m));
    expect(r.issues).toEqual([]);
    expect(r.doc?.loads).toHaveLength(1);
  });

  it('E12h: v0.1 con cargas o con sismo se rechaza, como el motor', () => {
    const withLoads = openOgsJson(JSON.stringify({ ...base(), loads: [{ type: 'line', x: 1, p: 2, angle: 0 }] }));
    expect(withLoads.doc).toBeNull();
    expect(withLoads.issues).toMatchObject([{ severity: 'error', code: 'io.version_fields', path: '/loads' }]);

    const m = base();
    (m.analysis as Record<string, unknown>).seismic = { kh: 0.1, kv: 0 };
    const withSeismic = openOgsJson(JSON.stringify(m));
    expect(withSeismic.doc).toBeNull();
    expect(withSeismic.issues).toMatchObject([{ severity: 'error', code: 'io.version_fields', path: '/analysis/seismic' }]);
  });

  it('E12h: v0.1 con loads: [] o seismic: null cuenta como ausente, igual que el motor', () => {
    const m = { ...base(), loads: [] } as Record<string, unknown>;
    (m.analysis as Record<string, unknown>).seismic = null;
    const r = openOgsJson(JSON.stringify(m));
    expect(r.doc?.version).toBe('0.2');
    expect(r.issues.map((i) => i.code)).toEqual(['io.version_upgraded']);
  });

  it('E12h, R5-07: «r_u» en lugar de «ru» es un error con su puntero, no un aviso', () => {
    const m = base();
    (m.materials as Record<string, unknown>[])[0] = { id: 's', name: 'S', model: 'mohr_coulomb', unit_weight: 20, cohesion: 3, friction_angle: 20, r_u: 0.5 };
    const r = openOgsJson(JSON.stringify(m));
    expect(r.doc).toBeNull();
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ severity: 'error', code: 'io.unknown_field', path: '/materials/0/r_u' });
  });

  it('E12h: rechaza campos desconocidos en todos los niveles, con su puntero', () => {
    const cases: [string, (m: Json) => void][] = [
      ['/extra', (m) => (m.extra = 1)],
      ['/meta/color', (m) => (m.meta = { color: 'rojo' })],
      ['/materials/0/r_u', (m) => ((m.materials as Json[])[0]!.r_u = 0.5)],
      ['/regions/0/name', (m) => ((m.regions as Json[])[0]!.name = 'x')],
      ['/water/gamma', (m) => (m.water = { unit_weight: 9.81, gamma: 1 })],
      ['/slope/angle', (m) => (m.slope = { direction: 'auto', angle: 1 })],
      ['/analysis/ru', (m) => ((m.analysis as Json).ru = 0.1)],
      ['/analysis/surface/z', (m) => ((m.analysis as Json).surface = { type: 'circle', xc: 1, yc: 2, r: 3, z: 0 })],
      ['/analysis/search/n', (m) => ((m.analysis as Json).search = { type: 'circular_entry_exit', n: 3 })],
      ['/analysis/seismic/kz', (m) => ((m.analysis as Json).seismic = { kh: 0.1, kz: 1 })],
      ['/loads/0/angle', (m) => (m.loads = [{ type: 'udl', x1: 1, x2: 2, q: 3, angle: 4 }])],
      ['/loads/1/q', (m) => (m.loads = [{ type: 'udl', x1: 1, x2: 2, q: 3 }, { type: 'line', x: 1, p: 2, angle: 0, q: 1 }])],
      ['/extra', (m) => (m.extra = null)],
    ];
    for (const [path, edit] of cases) {
      const m = { ...base(), version: '0.2' } as Json;
      edit(m);
      const r = openOgsJson(JSON.stringify(m));
      expect(r.doc, path).toBeNull();
      const unknown = r.issues.filter((i) => i.code === 'io.unknown_field');
      expect(unknown.map((i) => i.path), path).toEqual([path]);
      expect(unknown[0]?.severity, path).toBe('error');
    }
  });

  it('E12h: varios campos desconocidos dan un error por cada uno; ninguno es un aviso', () => {
    const m = { ...base(), extra: 1, meta: { id: 'a', color: 'rojo' } };
    const r = openOgsJson(JSON.stringify(m));
    expect(r.doc).toBeNull();
    expect(r.issues.every((i) => i.severity === 'error')).toBe(true);
    expect(r.issues.map((i) => i.path).sort()).toEqual(['/extra', '/meta/color']);
  });

  it('el wrapper {model, checks} sigue abriéndose con aviso, pero el modelo también es estricto', () => {
    const ok = openOgsJson(JSON.stringify({ id: 'X', title: 't', model: base(), checks: [] }));
    expect(ok.doc).not.toBeNull();
    expect(ok.issues.some((i) => i.code === 'io.checks_discarded')).toBe(true);
    const bad = openOgsJson(JSON.stringify({ model: { ...base(), r_u: 1 }, checks: [] }));
    expect(bad.doc).toBeNull();
  });
});

describe('ogsJson: guardar', () => {
  it('orden canónico con loads tras water y seismic al final de analysis; 2 espacios; version 0.2', () => {
    const doc = {
      analysis: {
        seismic: { kv: 0, kh: 0.1 },
        search: { refine: true, type: 'circular_entry_exit', exit: [1, 2], entry: [3, 4] },
        surface: { r: 3, yc: 2, xc: 1, type: 'circle' },
        slices: 50,
        methods: ['bishop'],
      },
      slope: { direction: 'auto' },
      loads: [
        { q: 20, x2: 70, x1: 50, id: 'u1', type: 'udl' },
        { angle: 10, p: 20, x: 40, id: 'l1', type: 'line' },
      ],
      water: { piezometric_line: [[0, 1], [2, 3]], unit_weight: 9.81 },
      regions: [{ polygon: [[0, 0], [1, 0], [0, 1]], material: 's' }],
      materials: [{ ru: null, friction_angle: 20, cohesion: 3, unit_weight_sat: null, unit_weight: 20, model: 'mohr_coulomb', name: 'S', id: 's' }],
      units: 'SI',
      meta: { notes: 'n', title: 't', id: 'i' },
      version: '0.1',
      format: 'opengeoslide',
    } as unknown as ModelDoc;
    const text = saveOgsJson(doc);
    const parsed = JSON.parse(text) as Record<string, Record<string, unknown>>;
    expect(Object.keys(parsed)).toEqual(CANONICAL_TOP);
    expect(parsed.version).toBe('0.2');
    expect(Object.keys(parsed.meta as object)).toEqual(['id', 'title', 'notes']);
    expect(Object.keys((parsed.materials as unknown as object[])[0] as object)).toEqual([
      'id', 'name', 'model', 'unit_weight', 'unit_weight_sat', 'cohesion', 'friction_angle', 'ru',
    ]);
    expect(Object.keys(parsed.water as object)).toEqual(['unit_weight', 'piezometric_line']);
    const loads = parsed.loads as unknown as Record<string, unknown>[];
    expect(Object.keys(loads[0] as object)).toEqual(['type', 'id', 'x1', 'x2', 'q']);
    expect(Object.keys(loads[1] as object)).toEqual(['type', 'id', 'x', 'p', 'angle']);
    const analysis = parsed.analysis as Record<string, Record<string, unknown>>;
    expect(Object.keys(analysis)).toEqual(['methods', 'slices', 'surface', 'search', 'seismic']);
    expect(Object.keys(analysis.surface as object)).toEqual(['type', 'xc', 'yc', 'r']);
    expect(Object.keys(analysis.search as object)).toEqual(['type', 'entry', 'exit', 'refine']);
    expect(Object.keys(analysis.seismic as object)).toEqual(['kh', 'kv']);
    expect(text).toContain('\n  "format": "opengeoslide",\n  "version": "0.2",\n  "meta": {\n    "id": "i"');
    expect(text.endsWith('}\n')).toBe(true);
  });

  it('no redondea: conserva null y omite undefined; tolerance y valores pequeños quedan tal cual', () => {
    const doc = {
      format: 'opengeoslide',
      version: '0.2',
      meta: {},
      materials: [{ id: 's', name: 'S', model: 'mohr_coulomb', unit_weight: 20.123456789, unit_weight_sat: null, cohesion: 0, friction_angle: -0, ru: undefined }],
      regions: [],
      analysis: { tolerance: 1e-7, min_m_alpha: 0.2000004 },
    } as unknown as ModelDoc;
    const p = JSON.parse(saveOgsJson(doc)) as { materials: Record<string, unknown>[]; analysis: Record<string, number> };
    expect(p.materials[0]).toEqual({ id: 's', name: 'S', model: 'mohr_coulomb', unit_weight: 20.123456789, unit_weight_sat: null, cohesion: 0, friction_angle: 0 });
    expect(p.analysis.tolerance).toBe(1e-7);
    expect(p.analysis.min_m_alpha).toBe(0.2000004);
  });

  it('no guarda valores no finitos', () => {
    const doc = { format: 'opengeoslide', version: '0.2', meta: {}, materials: [], regions: [{ material: 'a', polygon: [[0, Number.NaN]] }], analysis: {} } as unknown as ModelDoc;
    expect(() => saveOgsJson(doc)).toThrow(/no finito/);
  });
});

describe('sha256', () => {
  it('coincide con los vectores conocidos y con node:crypto', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const long = 'φγ≤ ñ '.repeat(500);
    expect(await sha256Hex(long)).toBe(createHash('sha256').update(long, 'utf8').digest('hex'));
  });

  it('el respaldo en JS da el mismo resultado en los límites de bloque', () => {
    for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
      const bytes = new Uint8Array(n).map((_, i) => (i * 31 + 7) & 0xff);
      const hex = Array.from(sha256Bytes(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
      expect(hex).toBe(createHash('sha256').update(bytes).digest('hex'));
    }
  });

  it('el hash del texto guardado cambia con cualquier cambio', async () => {
    const a = saveOgsJson(openOgsJson(readFileSync(new URL('V047a.json', casesDir), 'utf8')).doc as ModelDoc);
    const b = a.replace('"slices": 50', '"slices": 51');
    expect(await sha256Hex(a)).not.toBe(await sha256Hex(b));
  });
});
