// Formato v0.4 en la web (F4.1, F4.2, E14k, E14m-3): abre 0.1 a 0.4; guarda "0.4" solo si hay refuerzos; lectura y guardado sin pérdida
// de los cinco tipos; rechazo de claves desconocidas (también `location`, que E14m-3 quitó).
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import { FIVE, anchor, pile, sheet } from '../editor/state/reinforcementFixtures';
import type { Reinforcement } from '../engine/types';
import { describePath, engineModel, minimalVersion, openOgsJson, saveOgsJson, v04Fields } from './ogsJson';

type Json = Record<string, unknown>;

function model(version: string, reinforcements?: unknown, extra: Json = {}): Json {
  const m: Json = {
    format: 'opengeoslide',
    version,
    meta: {},
    units: 'SI',
    materials: [{ id: 's', name: 'S', model: 'mohr_coulomb', unit_weight: 20, cohesion: 3, friction_angle: 20 }],
    regions: [{ material: 's', polygon: [[0, 0], [60, 0], [60, 35], [0, 35]] }],
    loads: [{ type: 'udl', id: 'u1', x1: 0, x2: 10, q: 5 }],
    ...(reinforcements === undefined ? {} : { reinforcements }),
    slope: { direction: 'auto' },
    analysis: { methods: ['bishop'], surface: { type: 'circle', xc: 30, yc: 60, r: 50 } },
    ...extra,
  };
  return m;
}

const open = (m: unknown) => openOgsJson(JSON.stringify(m));
const errors = (m: unknown) => open(m).issues.filter((i) => i.severity === 'error');
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('v0.4: versión mínima y compuerta', () => {
  it('guarda 0.4 solo con refuerzos', () => {
    const withR = open(model('0.4', FIVE)).doc as ModelDoc;
    expect(minimalVersion(withR)).toBe('0.4');
    expect((JSON.parse(saveOgsJson(withR)) as Json).version).toBe('0.4');
    const without = open(model('0.4')).doc as ModelDoc;
    expect(minimalVersion(without)).toBe('0.2');
    expect((JSON.parse(saveOgsJson(without)) as Json).version).toBe('0.2');
  });

  it('un campo de la v0.3 sin refuerzos sigue guardando 0.3; con refuerzos, 0.4', () => {
    const v03 = model('0.3', undefined, { analysis: { methods: ['morgenstern_price'], surface: { type: 'circle', xc: 30, yc: 60, r: 50 } } });
    expect(minimalVersion(open(v03).doc)).toBe('0.3');
    const both = model('0.4', [anchor()], { analysis: { methods: ['morgenstern_price'], surface: { type: 'circle', xc: 30, yc: 60, r: 50 } } });
    expect(minimalVersion(open(both).doc)).toBe('0.4');
  });

  it('una lista vacía no se guarda y no sube la versión', () => {
    const doc = open(model('0.4', [])).doc as ModelDoc;
    expect(minimalVersion(doc)).toBe('0.2');
    expect('reinforcements' in (JSON.parse(saveOgsJson(doc)) as Json)).toBe(false);
    const doc2: ModelDoc = { ...(open(model('0.2')).doc as ModelDoc), reinforcements: [] };
    expect('reinforcements' in (JSON.parse(saveOgsJson(doc2)) as Json)).toBe(false);
  });

  it('con una versión menor que 0.4 y refuerzos, es un error con su puntero', () => {
    for (const v of ['0.1', '0.2', '0.3']) {
      const m = model(v, [anchor()], v === '0.1' ? { loads: undefined } : {});
      if (v === '0.1') delete m.loads;
      const errs = errors(m);
      const e = errs.find((i) => i.code === 'io.version_fields');
      expect(e, v).toBeDefined();
      expect(e?.path).toBe('/reinforcements');
      expect(e?.text).toContain('0.4');
      expect(e?.text).toContain('refuerzos');
    }
  });

  it('una lista vacía con 0.1, 0.2 o 0.3 se acepta (como el motor)', () => {
    expect(errors(model('0.3', []))).toEqual([]);
    expect(errors(model('0.2', []))).toEqual([]);
  });

  it('la versión 0.7 se rechaza y el texto nombra la 0.4, la 0.5 y la 0.6', () => {
    const e = errors(model('0.7', [anchor()])).find((i) => i.code === 'io.version');
    expect(e?.text).toContain('0.4');
    expect(e?.text).toContain('0.5');
    expect(e?.text).toContain('0.6');
  });

  it('v04Fields y engineModel', () => {
    expect(v04Fields({ reinforcements: [] })).toEqual([]);
    expect(v04Fields({ reinforcements: null })).toEqual([]);
    expect(v04Fields({ reinforcements: [anchor()] })[0]?.path).toBe('/reinforcements');
    const doc = open(model('0.4', [anchor()])).doc as ModelDoc;
    expect(engineModel({ ...doc, version: '0.2' }).version).toBe('0.4');
    expect(engineModel(open(model('0.2')).doc as ModelDoc).version).toBe('0.2');
  });
});

describe('v0.4: ida y vuelta sin pérdida', () => {
  it('abre y guarda los cinco tipos con todos sus campos, en orden canónico (type primero) y después de loads', () => {
    const text = saveOgsJson(open(model('0.4', FIVE)).doc as ModelDoc);
    const saved = JSON.parse(text) as Json;
    expect(saved.reinforcements).toEqual(FIVE);
    expect(Object.keys(saved)).toEqual(['format', 'version', 'meta', 'units', 'materials', 'regions', 'loads', 'reinforcements', 'slope', 'analysis']);
    const first = (saved.reinforcements as Json[])[0] as Json;
    expect(Object.keys(first).slice(0, 3)).toEqual(['type', 'id', 'x1']);
    expect(Object.keys(first)).toEqual(['type', 'id', 'x1', 'y1', 'x2', 'y2', 'application', 'tensile_capacity', 'end1_capacity', 'direction', 'pullout']);
    expect(Object.keys((first.pullout as Json))).toEqual(['model', 'strength', 'bonded_length']);
  });

  it('guardar, abrir y guardar da el mismo texto, byte a byte', () => {
    const t1 = saveOgsJson(open(model('0.4', FIVE)).doc as ModelDoc);
    const t2 = saveOgsJson(openOgsJson(t1).doc as ModelDoc);
    expect(t2).toBe(t1);
  });

  it('el orden de claves de entrada no importa', () => {
    const shuffled = FIVE.map((r) => Object.fromEntries(Object.entries(r).reverse()));
    expect(saveOgsJson(open(model('0.4', shuffled)).doc as ModelDoc)).toBe(saveOgsJson(open(model('0.4', FIVE)).doc as ModelDoc));
  });

  it('los números no se redondean', () => {
    const r = anchor({ x1: 0.1 + 0.2, tensile_capacity: 1 / 3, spacing: 1e-7 });
    const saved = JSON.parse(saveOgsJson(open(model('0.4', [r])).doc as ModelDoc)) as { reinforcements: Json[] };
    expect(saved.reinforcements[0]).toMatchObject({ x1: 0.1 + 0.2, tensile_capacity: 1 / 3, spacing: 1e-7 });
  });

  it('los opcionales en null se leen como ausentes y no se escriben', () => {
    const r = { ...anchor(), end1_capacity: null, end2_capacity: null, spacing: null, pullout: null };
    const p = { ...pile({ direction: 'tangent' }), angle: null };
    const b = anchor({ id: 'b', pullout: { model: 'bond', strength: 3, bonded_length: null } });
    const saved = JSON.parse(saveOgsJson(open(model('0.4', [r, p, b])).doc as ModelDoc)) as { reinforcements: Json[] };
    expect(saved.reinforcements[0]).toEqual(anchor());
    expect(saved.reinforcements[1]).toEqual(pile({ direction: 'tangent', angle: undefined }));
    expect((saved.reinforcements[2] as Json).pullout).toEqual({ model: 'bond', strength: 3 });
  });

  it('un caso de verificación {model, checks} con refuerzos se abre', () => {
    const wrapped = { model: model('0.4', [sheet()]), checks: [] };
    const r = open(wrapped);
    expect(r.doc?.reinforcements).toEqual([sheet()]);
  });
});

describe('v0.4: forma estricta (deny_unknown_fields)', () => {
  const bad = (r: unknown) => errors(model('0.4', [r]));

  it('una clave desconocida en un refuerzo es io.unknown_field con su puntero', () => {
    const e = bad({ ...anchor(), prestress: 50 }).find((i) => i.code === 'io.unknown_field');
    expect(e?.path).toBe('/reinforcements/0/prestress');
    expect(e?.text).toContain('prestress');
  });

  it('`location` ya no existe en pile ni sheet_pile (E14m-3)', () => {
    for (const r of [{ ...pile(), location: 'slip_surface' }, { ...sheet(), location: 'centroid' }]) {
      const e = bad(r).find((i) => i.code === 'io.unknown_field');
      expect(e?.path).toBe('/reinforcements/0/location');
    }
  });

  it('claves de otro tipo son desconocidas: force en un anchor, tensile_capacity en un pile, spacing en un sheet_pile', () => {
    expect(bad({ ...anchor(), force: 5 }).map((i) => i.path)).toContain('/reinforcements/0/force');
    expect(bad({ ...pile(), tensile_capacity: 5 }).map((i) => i.path)).toContain('/reinforcements/0/tensile_capacity');
    expect(bad({ ...sheet(), spacing: 1 }).map((i) => i.path)).toContain('/reinforcements/0/spacing');
  });

  it('claves desconocidas en pullout, incluidas las de otro modelo', () => {
    const e = bad(anchor({ pullout: { model: 'bond', strength: 3, adhesion: 1 } as never }));
    expect(e.find((i) => i.code === 'io.unknown_field')?.path).toBe('/reinforcements/0/pullout/adhesion');
  });

  it('tipo desconocido o ausente, y lista que no es lista', () => {
    expect(bad({ ...anchor(), type: 'strut' })[0]?.code).toBe('io.shape');
    const { type: _t, ...noType } = anchor();
    expect(bad(noType)[0]?.code).toBe('io.shape');
    expect(errors(model('0.4', { type: 'anchor' }))[0]?.code).toBe('io.shape');
    expect(errors(model('0.4', null))[0]?.code).toBe('io.shape');
  });

  it('tipos de valor y enumeraciones incorrectos son io.shape con la ruta del campo', () => {
    const paths = (r: unknown): string[] => bad(r).filter((i) => i.code === 'io.shape').map((i) => i.path ?? '');
    expect(paths({ ...anchor(), x1: '44' })).toContain('/reinforcements/0/x1');
    expect(paths({ ...anchor(), id: 7 })).toContain('/reinforcements/0/id');
    expect(paths({ ...anchor(), application: 'both' })).toContain('/reinforcements/0/application');
    expect(paths({ ...anchor(), application: undefined })).toContain('/reinforcements/0/application');
    expect(paths({ ...anchor(), direction: 'angle' })).toContain('/reinforcements/0/direction');
    expect(paths({ ...pile(), direction: 'axial', angle: undefined })).toContain('/reinforcements/0/direction');
    expect(paths({ ...anchor(), tensile_capacity: undefined })).toContain('/reinforcements/0/tensile_capacity');
    expect(paths({ ...pile(), force: undefined })).toContain('/reinforcements/0/force');
    expect(paths({ ...anchor(), pullout: { model: 'grout' } })).toContain('/reinforcements/0/pullout/model');
    expect(paths({ ...anchor(), pullout: { model: 'bond' } })).toContain('/reinforcements/0/pullout/strength');
    expect(paths({ ...anchor(), pullout: { model: 'interface', adhesion: 1, friction_angle: 2 } })).toContain('/reinforcements/0/pullout/coverage');
    expect(paths({ ...anchor(), pullout: { model: 'development', length1: 1 } })).toContain('/reinforcements/0/pullout/length2');
    expect(paths({ ...anchor(), pullout: 'bond' })).toContain('/reinforcements/0/pullout');
  });

  it('un número no finito es io.non_finite', () => {
    const text = JSON.stringify(model('0.4', [anchor()])).replace('"x1":44', '"x1":1e400');
    const r = openOgsJson(text);
    expect(r.doc).toBeNull();
    expect(r.issues.some((i) => i.code === 'io.non_finite' && i.path === '/reinforcements/0/x1')).toBe(true);
  });

  it('saveOgsJson no guarda un no finito en un refuerzo', () => {
    const doc = open(model('0.4', [anchor()])).doc as ModelDoc;
    const broken: ModelDoc = { ...doc, reinforcements: [anchor({ x1: Number.NaN })] };
    expect(() => saveOgsJson(broken)).toThrow(/no finito/);
  });

  it('los valores fuera de rango no son un asunto del formato: se abren y los señala la validación local', () => {
    expect(errors(model('0.4', [anchor({ tensile_capacity: -1, spacing: 0 }), sheet({ x2: 41 })]))).toEqual([]);
  });
});

describe('v0.4: ubicación en palabras de usuario', () => {
  it('describePath', () => {
    expect(describePath('/reinforcements')).toBe('la lista de refuerzos');
    expect(describePath('/reinforcements/2')).toBe('el refuerzo 3');
    expect(describePath('/reinforcements/2/x1')).toBe('el refuerzo 3 (cabeza x1)');
    expect(describePath('/reinforcements/1/pullout/coverage')).toBe('el refuerzo 2 (arrancamiento, cobertura Rc)');
    expect(describePath('/reinforcements/1/pullout')).toBe('el refuerzo 2 (arrancamiento)');
  });

  it('los textos de error de formato usan el nombre del campo en español', () => {
    const e = errors(model('0.4', [{ ...anchor(), prestress: 1 }])).find((i) => i.code === 'io.unknown_field');
    expect(e?.text).toContain('el refuerzo 1');
  });
});

describe('v0.4: el tipo Reinforcement cubre los cinco', () => {
  it('compila con las variantes', () => {
    const all: Reinforcement[] = FIVE;
    expect(new Set(all.map((r) => r.type)).size).toBe(5);
    expect(clone(all)).toEqual(all);
  });
});
