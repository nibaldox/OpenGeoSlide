import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import type { VerificationCase } from '../engine/types';
import { openOgsJson, round6, saveOgsJson, sha256Bytes, sha256Hex } from './ogsJson';

const casesDir = new URL('../../../../verification/cases/', import.meta.url);
const caseFiles = readdirSync(casesDir).filter((f) => f.endsWith('.json') && f !== 'ogs-0.1.schema.json').sort();

function loadCase(file: string): { text: string; parsed: VerificationCase } {
  const text = readFileSync(new URL(file, casesDir), 'utf8');
  return { text, parsed: JSON.parse(text) as VerificationCase };
}

/** Aplica el mismo redondeo que el guardado (excepto `tolerance`) a un valor JSON. */
function rounded(v: unknown, key = ''): unknown {
  if (typeof v === 'number') return key === 'tolerance' ? Number(v.toPrecision(12)) : round6(v);
  if (Array.isArray(v)) return v.map((x) => rounded(x, key));
  if (typeof v === 'object' && v !== null) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rounded(x, k)]));
  }
  return v;
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
  it('hay 16 casos', () => {
    expect(caseFiles).toHaveLength(16);
  });

  for (const file of caseFiles) {
    it(`${file}: abrir y guardar conserva el contenido salvo version y redondeo`, () => {
      const { parsed } = loadCase(file);
      const opened = openOgsJson(JSON.stringify(parsed.model));
      expect(opened.doc).not.toBeNull();
      expect(opened.issues.filter((i) => i.severity === 'error')).toEqual([]);
      const saved = JSON.parse(saveOgsJson(opened.doc as ModelDoc)) as Record<string, unknown>;
      expect(saved.version).toBe('0.2');
      const expected = { ...(rounded(parsed.model) as Record<string, unknown>), version: '0.2' };
      expect(saved).toEqual(expected);
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

  it('v0.1 con cargas o sismo se abre como v0.2 con una nota que lo explica', () => {
    const m = { ...base(), loads: [{ type: 'line', x: 1, p: 2, angle: 0 }] };
    const r = openOgsJson(JSON.stringify(m));
    expect(r.doc?.version).toBe('0.2');
    expect(r.issues[0]?.text).toContain('cargas o sismo');
  });

  it('avisa de los campos desconocidos y los descarta', () => {
    const m = { ...base(), extra: 1, meta: { id: 'a', color: 'rojo' } };
    const r = openOgsJson(JSON.stringify(m));
    const paths = r.issues.filter((i) => i.code === 'io.unknown_field').map((i) => i.path);
    expect([...paths].sort()).toEqual(['/extra', '/meta/color']);
    expect(JSON.parse(saveOgsJson(r.doc as ModelDoc))).not.toHaveProperty('extra');
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

  it('redondea a 6 decimales, conserva null y omite undefined; tolerance no se redondea a 0', () => {
    const doc = {
      format: 'opengeoslide',
      version: '0.2',
      meta: {},
      materials: [{ id: 's', name: 'S', model: 'mohr_coulomb', unit_weight: 20.123456789, unit_weight_sat: null, cohesion: 0, friction_angle: -0, ru: undefined }],
      regions: [],
      analysis: { tolerance: 1e-7, min_m_alpha: 0.2000004 },
    } as unknown as ModelDoc;
    const p = JSON.parse(saveOgsJson(doc)) as { materials: Record<string, unknown>[]; analysis: Record<string, number> };
    expect(p.materials[0]).toEqual({ id: 's', name: 'S', model: 'mohr_coulomb', unit_weight: 20.123457, unit_weight_sat: null, cohesion: 0, friction_angle: 0 });
    expect(p.analysis.tolerance).toBe(1e-7);
    expect(p.analysis.min_m_alpha).toBe(0.2);
    expect(round6(-0.0000001)).toBe(0);
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
