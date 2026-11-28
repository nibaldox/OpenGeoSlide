// Formato v0.7 en la web (F7.1, F7.5): la puerta `analysis.search.non_circular.global`, la versión mínima, el orden canónico de
// `global`, la ida y vuelta sin pérdida (abrir → guardar → abrir) y los rechazos de forma. Los casos que necesitan el motor real
// con `global` van detrás de `OGS_V07_ENGINE` (el binario v0.5.1 de este árbol no conoce la 0.7).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import { applyCommand } from '../editor/state/reducer';
import { baseDoc } from '../editor/state/testFixtures';
import { validateLocal } from '../editor/state/validateLocal';
import { isAnalysisReport } from '../engine/validate';
import {
  OGS_V07,
  OGS_VERSIONS,
  VERSION_FIELD_TABLE,
  describePath,
  engineModel,
  isKnownOgsVersion,
  minimalVersion,
  openOgsJson,
  saveOgsJson,
  unknownVersionMessage,
  v07Fields,
  versionAtLeast,
} from './ogsJson';

type Json = Record<string, unknown>;

const MC: Json = { id: 's', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 20, cohesion: 10, friction_angle: 25 };
const SEARCH = { type: 'circular_entry_exit', n_entry: 8, n_exit: 8, n_radius: 6, refine: true };

function model(version: string, nonCircular: unknown, extra: Json = {}): Json {
  return {
    format: 'opengeoslide',
    version,
    meta: {},
    units: 'SI',
    materials: [MC],
    regions: [{ material: 's', polygon: [[0, 0], [60, 0], [60, 35], [0, 35]] }],
    slope: { direction: 'auto' },
    analysis: { methods: ['spencer'], search: nonCircular === undefined ? SEARCH : { ...SEARCH, non_circular: nonCircular } },
    ...extra,
  };
}

const open = (m: unknown) => openOgsJson(JSON.stringify(m));
const errors = (m: unknown) => open(m).issues.filter((i) => i.severity === 'error');
const saved = (doc: ModelDoc): Json => JSON.parse(saveOgsJson(doc)) as Json;
const nonCircularOf = (j: Json): Json => ((j.analysis as Json).search as Json).non_circular as Json;

describe('v0.7: puerta, versión mínima y tabla (F7.1)', () => {
  it('OGS_V07 es la última versión conocida y el mensaje de versión desconocida la nombra', () => {
    expect(OGS_V07).toBe('0.7');
    expect(OGS_VERSIONS.at(-1)).toBe('0.7');
    expect(isKnownOgsVersion('0.7')).toBe(true);
    expect(isKnownOgsVersion('0.8')).toBe(false);
    expect(versionAtLeast('0.7', '0.6')).toBe(true);
    expect(versionAtLeast('0.6', '0.7')).toBe(false);
    expect(unknownVersionMessage('0.8')).toBe('version debe ser "0.1", "0.2", "0.3", "0.4", "0.5", "0.6" o "0.7", no "0.8"');
  });

  it('v07Fields detecta global (también vacío) y trata null y ausente como sin campo', () => {
    expect(v07Fields(model('0.7', { global: {} }))).toEqual([
      { path: '/analysis/search/non_circular/global', field: 'analysis.search.non_circular.global', what: 'la búsqueda global' },
    ]);
    expect(v07Fields(model('0.7', { global: { seed: 3 } }))).toHaveLength(1);
    expect(v07Fields(model('0.7', { global: null }))).toEqual([]);
    expect(v07Fields(model('0.7', {}))).toEqual([]);
    expect(v07Fields(model('0.7', undefined))).toEqual([]);
    expect(v07Fields({})).toEqual([]);
    expect(v07Fields(null)).toEqual([]);
  });

  it('la tabla termina en la puerta 0.7 y la versión mínima sube a 0.7 solo con global', () => {
    expect(VERSION_FIELD_TABLE.at(-1)).toMatchObject({ version: '0.7', fields: v07Fields });
    const ver = (nc: unknown): string => minimalVersion(open(model('0.7', nc)).doc);
    expect(ver({ global: {} })).toBe('0.7');
    expect(ver({ global: { algorithm: 'block', generated: 100, seed: 7, polish: false } })).toBe('0.7');
    expect(ver({})).toBe('0.6');
    expect(ver({ seeds: 3, global: null })).toBe('0.6');
    expect(ver(undefined)).toBe('0.2');
  });

  it('un archivo 0.6 con global se rechaza con el mensaje exacto del motor', () => {
    const e = errors(model('0.6', { global: {} })).filter((i) => i.code === 'io.version_fields');
    expect(e).toEqual([
      {
        source: 'local',
        severity: 'error',
        code: 'io.version_fields',
        path: '/analysis/search/non_circular/global',
        text: 'analysis.search.non_circular.global requiere version "0.7"',
      },
    ]);
    // Con 0.5 también falla la puerta de 0.6 (non_circular); el mensaje de 0.7 va aparte.
    const texts = errors(model('0.5', { global: {} })).map((i) => i.text);
    expect(texts).toContain('analysis.search.non_circular requiere version "0.6"');
    expect(texts).toContain('analysis.search.non_circular.global requiere version "0.7"');
  });

  it('un archivo 0.7 abre con global y con todos los campos de 0.6 (las puertas anteriores quedan abiertas)', () => {
    const hb = { id: 'roca', name: 'Roca', model: 'hoek_brown', unit_weight: 26, ucs: 30000, gsi: 50, mi: 10, disturbance: 0.7 };
    const m = model('0.7', { seeds: 2, max_vertices: 17, global: { algorithm: 'annealing', generated: 120, seed: 9, polish: false } }, {
      materials: [MC, hb],
      reinforcements: [],
    });
    const r = open(m);
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(r.doc?.version).toBe('0.7');
    expect(r.doc?.analysis.search?.non_circular?.global).toEqual({ algorithm: 'annealing', generated: 120, seed: 9, polish: false });
  });

  it('un archivo que declara 0.7 sin ningún campo nuevo se guarda con su versión mínima', () => {
    const r = open(model('0.7', { seeds: 3 }));
    expect(r.doc?.version).toBe('0.6');
    expect(saved(r.doc as ModelDoc).version).toBe('0.6');
    expect(saved(open(model('0.7', undefined)).doc as ModelDoc).version).toBe('0.2');
  });

  it('engineModel de un documento con global lleva "0.7"; sin global, la versión de siempre', () => {
    expect(engineModel(open(model('0.7', { global: {} })).doc as ModelDoc).version).toBe('0.7');
    expect(engineModel(open(model('0.6', { seeds: 2 })).doc as ModelDoc).version).toBe('0.6');
  });
});

describe('v0.7: orden canónico, nulos y ida y vuelta (F7.1)', () => {
  it('global se escribe en el orden algorithm, generated, seed, polish y sin nulos; {} se conserva', () => {
    const doc = open(model('0.7', { max_vertices: 9, seeds: 2, global: { polish: false, seed: 5, generated: 80, algorithm: 'block' } })).doc as ModelDoc;
    const nc = nonCircularOf(saved(doc));
    expect(Object.keys(nc)).toEqual(['seeds', 'max_vertices', 'global']);
    expect(Object.keys(nc.global as Json)).toEqual(['algorithm', 'generated', 'seed', 'polish']);
    const withNulls = open(model('0.7', { global: { algorithm: null, generated: 60, seed: null, polish: null } })).doc as ModelDoc;
    expect(nonCircularOf(saved(withNulls)).global).toEqual({ generated: 60 });
    const empty = open(model('0.7', { global: {} })).doc as ModelDoc;
    expect(nonCircularOf(saved(empty))).toEqual({ global: {} });
  });

  it('abrir → guardar → abrir → guardar da los mismos bytes y el mismo documento (seed 2^53 − 1 sin perder)', () => {
    const text = JSON.stringify(model('0.7', { seeds: 4, global: { algorithm: 'auto', generated: 2000, seed: Number.MAX_SAFE_INTEGER, polish: true } }));
    const a = openOgsJson(text);
    expect(a.issues).toEqual([]);
    const s1 = saveOgsJson(a.doc as ModelDoc);
    const b = openOgsJson(s1);
    expect(b.issues).toEqual([]);
    expect(b.doc).toEqual(a.doc);
    expect(saveOgsJson(b.doc as ModelDoc)).toBe(s1);
    expect(nonCircularOf(JSON.parse(s1) as Json).global).toEqual({ algorithm: 'auto', generated: 2000, seed: 9007199254740991, polish: true });
  });

  it('un caso real del corpus (V001-nc) con global: abre, guarda y vuelve a abrir sin cambios', () => {
    const base = (JSON.parse(readFileSync(new URL('../../../../verification/cases/V001-nc.json', import.meta.url), 'utf8')) as { model: Json }).model;
    const analysis = base.analysis as Json;
    const search = analysis.search as Json;
    const withGlobal = {
      ...base,
      version: '0.7',
      analysis: { ...analysis, search: { ...search, non_circular: { ...(search.non_circular as Json), global: {} } } },
    };
    const a = open(withGlobal);
    expect(a.issues).toEqual([]);
    expect(a.doc?.version).toBe('0.7');
    const s1 = saveOgsJson(a.doc as ModelDoc);
    const b = openOgsJson(s1);
    expect(b.doc).toEqual(a.doc);
    expect(saveOgsJson(b.doc as ModelDoc)).toBe(s1);
    // Sin global, el mismo caso vuelve a 0.6 y no queda rastro de global.
    const plain = open(base);
    expect(saved(plain.doc as ModelDoc).version).toBe('0.6');
    expect(saveOgsJson(plain.doc as ModelDoc)).not.toContain('global');
  });
});

describe('v0.7: rechazos de forma con su ruta (F7.1)', () => {
  it('rechaza campos desconocidos dentro de global', () => {
    const e = errors(model('0.7', { global: { algorithm: 'auto', paths: 3 } })).find((i) => i.code === 'io.unknown_field');
    expect(e?.path).toBe('/analysis/search/non_circular/global/paths');
  });

  it('rechaza una forma que no es un objeto y los tipos equivocados de cada campo', () => {
    expect(errors(model('0.7', { global: [] }))[0]).toMatchObject({ code: 'io.shape', path: '/analysis/search/non_circular/global' });
    expect(errors(model('0.7', { global: 'si' }))[0]).toMatchObject({ code: 'io.shape', path: '/analysis/search/non_circular/global' });
    expect(errors(model('0.7', { global: { algorithm: 3 } }))[0]).toMatchObject({ code: 'io.shape', path: '/analysis/search/non_circular/global/algorithm' });
    expect(errors(model('0.7', { global: { generated: '500' } }))[0]).toMatchObject({ code: 'io.shape', path: '/analysis/search/non_circular/global/generated' });
    expect(errors(model('0.7', { global: { seed: true } }))[0]).toMatchObject({ code: 'io.shape', path: '/analysis/search/non_circular/global/seed' });
    expect(errors(model('0.7', { global: { polish: 1 } }))[0]).toMatchObject({ code: 'io.shape', path: '/analysis/search/non_circular/global/polish' });
  });

  it('el texto del error nombra el campo con palabras de la interfaz', () => {
    expect(describePath('/analysis/search/non_circular/global')).toBe('la búsqueda global');
    expect(describePath('/analysis/search/non_circular/global/generated')).toBe('la búsqueda global (candidatos)');
    expect(describePath('/analysis/search/non_circular/global/seed')).toBe('la búsqueda global (semilla)');
    expect(describePath('/analysis/search/non_circular/global/algorithm')).toBe('la búsqueda global (algoritmo)');
    expect(describePath('/analysis/search/non_circular/global/polish')).toBe('la búsqueda global (pulido)');
    expect(describePath('/analysis/search/non_circular/seeds')).toBe('la búsqueda no circular (semillas)');
    const e = errors(model('0.7', { global: { generated: 'x' } }))[0];
    expect(e?.text).toContain('la búsqueda global (candidatos)');
  });

  it('los rangos no son del archivo: abre y validateLocal los señala', () => {
    const doc = open(model('0.7', { global: { generated: 10, seed: -1 } })).doc as ModelDoc;
    expect(doc).not.toBeNull();
    const msgs = validateLocal(doc).filter((i) => i.severity === 'error').map((i) => i.text);
    expect(msgs).toContain('analysis.search.non_circular.global.generated debe estar en [50, 2000], no 10');
    expect(msgs).toContain('analysis.search.non_circular.global.seed debe estar en [0, 9007199254740991], no -1');
  });

  // RCM-B-03: `algorithm` es un enum cerrado: un texto desconocido se rechaza al abrir (como `interslice.function`), no se deja pasar.
  it('un algoritmo desconocido se rechaza al abrir con io.shape y el puntero del campo', () => {
    for (const bad of ['typo', 'path', 'Auto', '']) {
      const r = open(model('0.7', { global: { generated: 50, seed: 0, polish: false, algorithm: bad } }));
      expect(r.doc, bad).toBeNull();
      const e = r.issues.find((i) => i.code === 'io.shape');
      expect(e?.path, bad).toBe('/analysis/search/non_circular/global/algorithm');
      expect(e?.text, bad).toContain('la búsqueda global (algoritmo)');
      expect(e?.text, bad).toContain('no se reconoce');
    }
    for (const good of ['auto', 'block', 'annealing']) {
      expect(open(model('0.7', { global: { algorithm: good } })).doc, good).not.toBeNull();
    }
  });

});

describe('v0.7: la versión del documento sube y baja con global (reducer)', () => {
  const searchWith = (nc: unknown) => ({ type: 'circular_entry_exit' as const, ...(nc === undefined ? {} : { non_circular: nc as never }) });

  it('search/set con global sube la versión a 0.7; sin global, el guardado vuelve a 0.6', () => {
    const start = applyCommand(baseDoc(), { type: 'search/set', search: searchWith({}) }) as ModelDoc;
    expect(start.version).toBe('0.6');
    const up = applyCommand(start, { type: 'search/set', search: searchWith({ global: {} }) }) as ModelDoc;
    expect(up.version).toBe('0.7');
    expect(up.analysis.search?.non_circular).toEqual({ global: {} });
    expect(validateLocal(up).filter((i) => i.path === '/version')).toEqual([]);
    expect(saved(up).version).toBe('0.7');
    // En memoria la versión no baja (syncVersion); al guardar se recalcula la mínima.
    const down = applyCommand(up, { type: 'search/set', search: searchWith({}) }) as ModelDoc;
    expect(down.analysis.search?.non_circular).toEqual({});
    expect(saved(down).version).toBe('0.6');
  });

  it('un documento 0.6 en memoria con global recibe el error exacto de la puerta 0.7', () => {
    const doc = { ...(applyCommand(baseDoc(), { type: 'search/set', search: searchWith({ global: {} }) }) as ModelDoc), version: '0.6' as const };
    const e = validateLocal(doc).filter((i) => i.path === '/version');
    expect(e).toHaveLength(1);
    expect(e[0]?.text).toBe('analysis.search.non_circular.global requiere version "0.7"');
  });

  it('search/set copia global (el comando no comparte referencias) y rechaza formas inválidas', () => {
    const g = { algorithm: 'block' as const, generated: 100 };
    const doc = applyCommand(baseDoc(), { type: 'search/set', search: searchWith({ global: g }) }) as ModelDoc;
    expect(doc.analysis.search?.non_circular?.global).toEqual(g);
    expect(doc.analysis.search?.non_circular?.global).not.toBe(g);
    expect(applyCommand(baseDoc(), { type: 'search/set', search: searchWith({ global: { polish: 'si' } }) })).toBeNull();
    expect(applyCommand(baseDoc(), { type: 'search/set', search: searchWith({ global: { extra: 1 } }) })).toBeNull();
    expect(applyCommand(baseDoc(), { type: 'search/set', search: searchWith({ global: [] }) })).toBeNull();
  });
});

// ── Motor real con global: pendiente del motor nuevo ────────────────────────────────────────────────────────────────
// El binario `ogs` de este árbol es la v0.5.1 y no conoce la 0.7. El coordinador corre estos casos con el motor nuevo:
//   OGS_V07_ENGINE=1 OGS_BIN=<ogs nuevo> pnpm test
const OGS_BIN = process.env.OGS_BIN;
const haveV07Engine = process.env.OGS_V07_ENGINE !== undefined && OGS_BIN !== undefined && existsSync(OGS_BIN);

function analyzeWithEngine(text: string): { status: number | null; out: string; report: Json | null } {
  const dir = mkdtempSync(join(tmpdir(), 'ogs-v07-'));
  try {
    const file = join(dir, 'm.ogs.json');
    writeFileSync(file, text);
    const r = spawnSync(OGS_BIN as string, ['analyze', file], { encoding: 'utf8', maxBuffer: 1 << 28 });
    let report: Json | null = null;
    try {
      report = JSON.parse(r.stdout) as Json;
    } catch {
      report = null;
    }
    return { status: r.status, out: `${r.stderr}${r.stdout}`, report };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!haveV07Engine)('v0.7: motor real (OGS_V07_ENGINE)', () => {
  const v001 = (JSON.parse(readFileSync(new URL('../../../../verification/cases/V001-nc.json', import.meta.url), 'utf8')) as { model: Json }).model;
  const withGlobal = (g: unknown): Json => {
    const analysis = v001.analysis as Json;
    const search = analysis.search as Json;
    return { ...v001, version: '0.7', analysis: { ...analysis, search: { ...search, non_circular: { ...(search.non_circular as Json), global: g } } } };
  };

  it('el archivo que guarda la web con global lo acepta el motor y devuelve GlobalStats con la forma de F7.2', () => {
    const doc = open(withGlobal({})).doc as ModelDoc;
    const r = analyzeWithEngine(saveOgsJson(doc));
    expect(r.status, r.out).toBe(0);
    expect(isAnalysisReport(r.report), 'el informe debe pasar isAnalysisReport (incluye GlobalStats)').toBe(true);
    const stats = ((r.report as unknown as { results: { search: { non_circular: { global?: Json } } }[] }).results[0]?.search.non_circular.global) as Json;
    expect(stats).toBeDefined();
    expect(['block', 'annealing']).toContain(stats.algorithm);
    expect(['global', 'refinement']).toContain(stats.winner);
  });

  it('el motor rechaza global en un archivo 0.6 con el mismo texto que la web', () => {
    const r = analyzeWithEngine(JSON.stringify({ ...withGlobal({}), version: '0.6' }));
    expect(r.status).not.toBe(0);
    const web = errors({ ...withGlobal({}), version: '0.6' }).find((i) => i.code === 'io.version_fields');
    expect(r.out).toContain(web?.text);
  });

  it('el motor rechaza los mismos rangos que validateLocal', () => {
    for (const g of [{ generated: 10 }, { generated: 5000 }, { seed: -1 }]) {
      const r = analyzeWithEngine(JSON.stringify(withGlobal(g)));
      expect(r.status, JSON.stringify(g)).not.toBe(0);
      const local = validateLocal(open(withGlobal(g)).doc as ModelDoc).filter((i) => i.severity === 'error');
      expect(local.length, JSON.stringify(g)).toBeGreaterThan(0);
    }
    // El algoritmo desconocido lo rechazan los dos al abrir (RCM-B-03): el motor al leer el JSON y la web con io.shape.
    const algo = withGlobal({ algorithm: 'path' });
    expect(analyzeWithEngine(JSON.stringify(algo)).status).not.toBe(0);
    expect(open(algo).doc).toBeNull();
  });
});
