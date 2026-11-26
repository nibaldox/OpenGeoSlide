// Formato v0.5 de Ito-Matsui en la web (E15i-1): `lateral_pressure` y `capacity` en un `pile`, `force` opcional, versión mínima 0.5 y
// ida y vuelta sin pérdida. El texto del error de versión es el del motor (`lateral_pressure requiere version "0.5"`).
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import { anchor, itoPile, pile } from '../editor/state/reinforcementFixtures';
import { describePath, engineModel, minimalVersion, openOgsJson, saveOgsJson, v05Fields } from './ogsJson';

type Json = Record<string, unknown>;

function model(version: string, reinforcements: unknown[], analysis: Json = {}): Json {
  return {
    format: 'opengeoslide',
    version,
    meta: {},
    units: 'SI',
    materials: [{ id: 's', name: 'S', model: 'mohr_coulomb', unit_weight: 20, cohesion: 3, friction_angle: 20 }],
    regions: [{ material: 's', polygon: [[0, 0], [60, 0], [60, 35], [0, 35]] }],
    slope: { direction: 'auto' },
    analysis: { methods: ['bishop'], surface: { type: 'circle', xc: 30, yc: 60, r: 50 }, ...analysis },
    reinforcements,
  };
}

const open = (m: unknown) => openOgsJson(JSON.stringify(m));
const errors = (m: unknown) => open(m).issues.filter((i) => i.severity === 'error');
const saved = (doc: ModelDoc): Json => JSON.parse(saveOgsJson(doc)) as Json;
const CAP = { shear: 150, moment: 250 };

describe('Ito-Matsui: versión mínima y compuerta (E15i-1)', () => {
  it('un pilote con lateral_pressure se abre con la 0.5, y la versión mínima es 0.5', () => {
    const doc = open(model('0.5', [itoPile()])).doc as ModelDoc;
    expect(errors(model('0.5', [itoPile()]))).toEqual([]);
    expect(minimalVersion(doc)).toBe('0.5');
    expect(saved(doc).version).toBe('0.5');
  });

  it('un pilote con capacity sin lateral_pressure también exige la 0.5 (el resto lo rechaza la validación)', () => {
    expect(v05Fields({ reinforcements: [pile({ capacity: CAP })] })[0]?.path).toBe('/reinforcements/0/capacity');
  });

  it('un pilote con force se queda en 0.4 (identidad): no escribe lateral_pressure ni capacity', () => {
    const doc = open(model('0.5', [pile()])).doc as ModelDoc;
    expect(minimalVersion(doc)).toBe('0.4');
    const out = (saved(doc).reinforcements as Json[])[0]!;
    expect('lateral_pressure' in out).toBe(false);
    expect('capacity' in out).toBe(false);
    expect(v05Fields({ reinforcements: [pile(), anchor()] })).toEqual([]);
  });

  it('`lateral_pressure: null` y `capacity: null` cuentan como ausentes: no suben la versión y no se escriben', () => {
    const doc = open(model('0.4', [pile({ lateral_pressure: null, capacity: null })])).doc as ModelDoc;
    expect(minimalVersion(doc)).toBe('0.4');
    expect(v05Fields(doc)).toEqual([]);
    const out = (saved(doc).reinforcements as Json[])[0]!;
    expect(Object.keys(out)).not.toContain('lateral_pressure');
    expect(Object.keys(out)).not.toContain('capacity');
  });

  it.each(['0.1', '0.2', '0.3', '0.4'])('con la versión %s y lateral_pressure es un error con su puntero que nombra la 0.5', (v) => {
    const list = errors(model(v, [itoPile()])).filter((i) => i.code === 'io.version_fields');
    // La 0.1 y la 0.2 ya rechazan además los refuerzos (0.4): el error de la presión del suelo va aparte.
    const e = list.find((i) => i.path === '/reinforcements/0/lateral_pressure');
    expect(e, v).toBeDefined();
    expect(e?.text).toContain('0.5');
    expect(e?.text).toContain('presión del suelo');
  });

  it('con capacity y la versión 0.4, el error señala /reinforcements/0/capacity', () => {
    const e = errors(model('0.4', [itoPile({ capacity: CAP })])).filter((i) => i.code === 'io.version_fields').map((i) => i.path);
    expect(e).toContain('/reinforcements/0/capacity');
  });

  it('engineModel sube la versión a 0.5 con lateral_pressure aunque el documento diga 0.4', () => {
    const doc = open(model('0.5', [itoPile()])).doc as ModelDoc;
    expect(engineModel({ ...doc, version: '0.4' }).version).toBe('0.5');
    expect(engineModel({ ...doc, version: '0.2' }).version).toBe('0.5');
  });
});

describe('Ito-Matsui: ida y vuelta (E15i-1)', () => {
  const full = itoPile({ capacity: CAP, lateral_pressure: { model: 'ito_matsui', diameter: 0.8, location: 'slip_surface' } });

  it('lateral_pressure y capacity se leen y se guardan sin pérdida, sin force', () => {
    const doc = open(model('0.5', [full])).doc as ModelDoc;
    const out = (saved(doc).reinforcements as Json[])[0]!;
    expect(out.lateral_pressure).toEqual({ model: 'ito_matsui', diameter: 0.8, location: 'slip_surface' });
    expect(out.capacity).toEqual(CAP);
    expect('force' in out).toBe(false);
  });

  it('orden canónico: …, direction, angle, lateral_pressure, capacity; dentro, model, diameter, location y shear, moment', () => {
    const out = (saved(open(model('0.5', [full])).doc as ModelDoc).reinforcements as Json[])[0]!;
    expect(Object.keys(out)).toEqual(['type', 'id', 'x1', 'y1', 'x2', 'y2', 'application', 'spacing', 'direction', 'angle', 'lateral_pressure', 'capacity']);
    expect(Object.keys(out.lateral_pressure as Json)).toEqual(['model', 'diameter', 'location']);
    expect(Object.keys(out.capacity as Json)).toEqual(['shear', 'moment']);
  });

  it('una capacidad con solo corte o solo momento se conserva sin escribir el otro', () => {
    const one = saved(open(model('0.5', [itoPile({ capacity: { shear: 90, moment: null } })])).doc as ModelDoc);
    expect((one.reinforcements as Json[])[0]!.capacity).toEqual({ shear: 90 });
    const two = saved(open(model('0.5', [itoPile({ capacity: { moment: 40 } })])).doc as ModelDoc);
    expect((two.reinforcements as Json[])[0]!.capacity).toEqual({ moment: 40 });
  });

  it('guardar, abrir y guardar da el mismo texto, byte a byte', () => {
    const t1 = saveOgsJson(open(model('0.5', [full])).doc as ModelDoc);
    expect(saveOgsJson(openOgsJson(t1).doc as ModelDoc)).toBe(t1);
  });

  it('un caso {model, checks} con presión del suelo se abre', () => {
    const r = open({ model: model('0.5', [full]), checks: [] });
    expect(r.doc?.reinforcements?.[0]).toMatchObject({ lateral_pressure: { diameter: 0.8 } });
  });
});

describe('Ito-Matsui: forma estricta (deny_unknown_fields)', () => {
  const bad = (over: Json) => errors(model('0.5', [{ ...itoPile(), ...over }]));

  it('una clave desconocida en lateral_pressure o en capacity es io.unknown_field con su puntero', () => {
    expect(bad({ lateral_pressure: { model: 'ito_matsui', diameter: 0.8, location: 'centroid', ru: 0.3 } }).find((i) => i.code === 'io.unknown_field')?.path).toBe(
      '/reinforcements/0/lateral_pressure/ru',
    );
    expect(bad({ capacity: { shear: 1, flexure: 2 } }).find((i) => i.code === 'io.unknown_field')?.path).toBe('/reinforcements/0/capacity/flexure');
  });

  it('tipos incorrectos son io.shape con la ruta del campo', () => {
    const paths = (over: Json): string[] => bad(over).filter((i) => i.code === 'io.shape').map((i) => i.path ?? '');
    expect(paths({ lateral_pressure: { model: 'ito_matsui', diameter: '0.8', location: 'centroid' } })).toContain('/reinforcements/0/lateral_pressure/diameter');
    expect(paths({ lateral_pressure: { model: 'ito_matsui', location: 'centroid' } })).toContain('/reinforcements/0/lateral_pressure/diameter');
    expect(paths({ lateral_pressure: 7 })).toContain('/reinforcements/0/lateral_pressure');
    expect(paths({ capacity: { shear: 'x' } })).toContain('/reinforcements/0/capacity/shear');
    expect(paths({ capacity: [1] })).toContain('/reinforcements/0/capacity');
  });

  it('`model` y `location` desconocidos son io.shape; `location` es obligatorio (la web propone centroid)', () => {
    const paths = (lp: unknown): string[] => bad({ lateral_pressure: lp }).filter((i) => i.code === 'io.shape').map((i) => i.path ?? '');
    expect(paths({ model: 'otro', diameter: 0.8, location: 'centroid' })).toContain('/reinforcements/0/lateral_pressure/model');
    expect(paths({ model: 'ito_matsui', diameter: 0.8, location: 'cabeza' })).toContain('/reinforcements/0/lateral_pressure/location');
    expect(paths({ model: 'ito_matsui', diameter: 0.8 })).toContain('/reinforcements/0/lateral_pressure/location');
  });

  it('un pilote sin force y sin lateral_pressure es io.shape en la fuerza; con los dos, lo señala la validación local', () => {
    const e = errors(model('0.5', [{ ...pile(), force: undefined }])).filter((i) => i.code === 'io.shape');
    expect(e.map((i) => i.path)).toContain('/reinforcements/0/force');
    expect(errors(model('0.5', [{ ...itoPile(), force: 50 }]))).toEqual([]);
  });

  it('la tablestaca no admite lateral_pressure ni capacity (clave desconocida)', () => {
    const sheet = { type: 'sheet_pile', id: 's', x1: 40, y1: 12, x2: 40, y2: 1, application: 'active', force: 100, direction: 'perpendicular' };
    const e = errors(model('0.5', [{ ...sheet, lateral_pressure: { model: 'ito_matsui', diameter: 0.8, location: 'centroid' } }]));
    expect(e.some((i) => i.code === 'io.unknown_field' && i.path === '/reinforcements/0/lateral_pressure')).toBe(true);
  });

  it('un número no finito en diameter es io.non_finite', () => {
    const doc = open(model('0.5', [itoPile()])).doc as ModelDoc;
    const bad2 = { ...doc, reinforcements: [itoPile({ lateral_pressure: { model: 'ito_matsui', diameter: Infinity, location: 'centroid' } })] } as ModelDoc;
    expect(() => saveOgsJson(bad2)).toThrow();
  });
});

describe('describePath con presión del suelo', () => {
  it('nombra los campos con palabras de la interfaz', () => {
    expect(describePath('/reinforcements/0/lateral_pressure')).toBe('el refuerzo 1 (presión del suelo)');
    expect(describePath('/reinforcements/0/lateral_pressure/diameter')).toBe('el refuerzo 1 (presión del suelo, diámetro)');
    expect(describePath('/reinforcements/2/capacity/shear')).toBe('el refuerzo 3 (capacidad, corte)');
    expect(describePath('/reinforcements/2/capacity/moment')).toBe('el refuerzo 3 (capacidad, momento)');
  });
});
