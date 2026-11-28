// Formato v0.6 en la web (F6.1 a F6.4 y F6.6): tabla única «campo → versión» (`VERSION_FIELD_TABLE`) compartida por `minimalVersion`,
// `syncVersion` y `validateLocal`; apertura de "0.6" con su puerta exacta; e ida y vuelta sin pérdida de `hoek_brown`, `shansep` y `non_circular`.
import { describe, expect, it } from 'vitest';
import type { Material, MethodReport, NonCircularStats, SearchStats, ShansepSpec, StrengthReport } from '../engine/types';
import type { EditorCommand, ModelDoc } from '../editor/types';
import { applyCommand } from '../editor/state/reducer';
import { anchor, itoPile } from '../editor/state/reinforcementFixtures';
import { baseDoc } from '../editor/state/testFixtures';
import { validateLocal } from '../editor/state/validateLocal';
import {
  OGS_V06,
  VERSION_FIELD_TABLE,
  describePath,
  engineModel,
  minimalVersion,
  openOgsJson,
  saveOgsJson,
  unknownVersionMessage,
  v06Fields,
  v07Fields,
} from './ogsJson';

type Json = Record<string, unknown>;

const SURFACE = { type: 'circle', xc: 30, yc: 60, r: 50 };
const MC: Json = { id: 's', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 20, cohesion: 10, friction_angle: 25 };
const HB: Material = { id: 'roca', name: 'Roca', model: 'hoek_brown', unit_weight: 26, ucs: 30000, gsi: 50, mi: 10, disturbance: 0.7 };
const SH_POP: Material = {
  id: 'arcilla',
  name: 'Arcilla',
  model: 'shansep',
  unit_weight: 18,
  shansep: { ratio: 0.25, exponent: 0.8, pop: 30 },
};

function model(version: string, materials: unknown[] = [MC], analysis: Json = {}, extra: Json = {}): Json {
  const firstId =
    Array.isArray(materials) && typeof (materials[0] as Json | undefined)?.id === 'string'
      ? ((materials[0] as Json).id as string)
      : 's';
  return {
    format: 'opengeoslide',
    version,
    meta: {},
    units: 'SI',
    materials,
    regions: [{ material: firstId, polygon: [[0, 0], [60, 0], [60, 35], [0, 35]] }],
    slope: { direction: 'auto' },
    analysis: { methods: ['spencer'], surface: SURFACE, ...analysis },
    ...extra,
  };
}

const open = (m: unknown) => openOgsJson(JSON.stringify(m));
const errors = (m: unknown) => open(m).issues.filter((i) => i.severity === 'error');
const saved = (doc: ModelDoc): Json => JSON.parse(saveOgsJson(doc)) as Json;

describe('v0.6: tabla única «campo → versión» y versión mínima (F6.1)', () => {
  it('la tabla `VERSION_FIELD_TABLE` enumera en orden creciente de la 0.2 a la 0.7 y contiene las puertas v06Fields y v07Fields', () => {
    expect(VERSION_FIELD_TABLE.map((g) => g.version)).toEqual(['0.2', '0.3', '0.4', '0.5', '0.6', '0.7']);
    expect(VERSION_FIELD_TABLE.at(-1)?.fields).toBe(v07Fields);
    expect(VERSION_FIELD_TABLE.at(-2)?.fields).toBe(v06Fields);
    expect(OGS_V06).toBe('0.6');
  });

  const V06_SINGLE_CASES: {
    label: string;
    expectedField: string;
    expectedPath: string;
    makeJson: () => Json;
    command: EditorCommand;
  }[] = [
    {
      label: 'model = "hoek_brown"',
      expectedField: 'materials[0].model = "hoek_brown"',
      expectedPath: '/materials/0/model',
      makeJson: () => model('0.6', [HB]),
      command: { type: 'material/upsert', material: { ...HB, id: 'm1' } },
    },
    {
      label: 'model = "shansep"',
      expectedField: 'materials[0].model = "shansep"',
      expectedPath: '/materials/0/model',
      makeJson: () => model('0.6', [SH_POP]),
      command: { type: 'material/upsert', material: { ...SH_POP, id: 'm1' } },
    },
    {
      label: 'materials[i].ucs',
      expectedField: 'materials[0].ucs',
      expectedPath: '/materials/0/ucs',
      makeJson: () => model('0.6', [{ ...MC, ucs: 30000 }]),
      command: { type: 'material/upsert', material: { ...(MC as unknown as Material), id: 'm1', ucs: 30000 } },
    },
    {
      label: 'materials[i].gsi',
      expectedField: 'materials[0].gsi',
      expectedPath: '/materials/0/gsi',
      makeJson: () => model('0.6', [{ ...MC, gsi: 50 }]),
      command: { type: 'material/upsert', material: { ...(MC as unknown as Material), id: 'm1', gsi: 50 } },
    },
    {
      label: 'materials[i].mi',
      expectedField: 'materials[0].mi',
      expectedPath: '/materials/0/mi',
      makeJson: () => model('0.6', [{ ...MC, mi: 10 }]),
      command: { type: 'material/upsert', material: { ...(MC as unknown as Material), id: 'm1', mi: 10 } },
    },
    {
      label: 'materials[i].disturbance',
      expectedField: 'materials[0].disturbance',
      expectedPath: '/materials/0/disturbance',
      makeJson: () => model('0.6', [{ ...MC, disturbance: 0.7 }]),
      command: { type: 'material/upsert', material: { ...(MC as unknown as Material), id: 'm1', disturbance: 0.7 } },
    },
    {
      label: 'materials[i].shansep',
      expectedField: 'materials[0].shansep',
      expectedPath: '/materials/0/shansep',
      makeJson: () => model('0.6', [{ ...MC, shansep: { ratio: 0.25, ocr: 1.5 } }]),
      command: {
        type: 'material/upsert',
        material: { ...(MC as unknown as Material), id: 'm1', shansep: { ratio: 0.25, ocr: 1.5 } },
      },
    },
    {
      label: 'analysis.search.non_circular',
      expectedField: 'analysis.search.non_circular',
      expectedPath: '/analysis/search/non_circular',
      makeJson: () => model('0.6', [MC], { search: { type: 'circular_entry_exit', non_circular: {} } }),
      command: { type: 'search/set', search: { type: 'circular_entry_exit', non_circular: {} } },
    },
  ];

  it.each(V06_SINGLE_CASES)(
    '$label sube a "0.6" en minimalVersion, saveOgsJson, syncVersion, engineModel y validateLocal',
    ({ expectedField, expectedPath, makeJson, command }) => {
      const m = makeJson();
      const fields = v06Fields(m);
      expect(fields[0]?.field).toBe(expectedField);
      expect(fields[0]?.path).toBe(expectedPath);

      const opened = open(m);
      expect(opened.issues.filter((i) => i.severity === 'error')).toEqual([]);
      const doc = opened.doc as ModelDoc;
      expect(minimalVersion(doc)).toBe('0.6');
      expect(saved(doc).version).toBe('0.6');
      expect(engineModel({ ...doc, version: '0.2' }).version).toBe('0.6');

      // `syncVersion` en el reductor sube desde 0.1..0.5 a 0.6.
      for (const v of ['0.1', '0.2', '0.3', '0.4', '0.5'] as const) {
        const next = applyCommand({ ...baseDoc(), version: v }, command);
        expect(next?.version, `syncVersion desde ${v}`).toBe('0.6');
      }

      // `validateLocal` sobre el mismo documento con versión "0.5" exige "0.6" con el mismo primer campo.
      const localVersionErr = validateLocal({ ...doc, version: '0.5' }).find((i) => i.path === '/version');
      expect(localVersionErr?.text).toBe(`${expectedField} requiere version "0.6"`);
    },
  );

  it('un modelo sin campos v0.6 conserva su versión mínima (0.2, 0.3, 0.4 o 0.5) al guardar, y 0.6 sin ellos baja a la mínima', () => {
    expect(minimalVersion(open(model('0.2')).doc)).toBe('0.2');
    expect(saved(open(model('0.6')).doc as ModelDoc).version).toBe('0.2');
    expect(minimalVersion(open(model('0.3', [MC], { methods: ['morgenstern_price'] })).doc)).toBe('0.3');
    expect(minimalVersion(open(model('0.4', [MC], {}, { reinforcements: [anchor()] })).doc)).toBe('0.4');
    expect(minimalVersion(open(model('0.5', [MC], { tension_crack: { depth: 2, water_fill: 1 } })).doc)).toBe('0.5');
    expect(minimalVersion(open(model('0.5', [MC], {}, { reinforcements: [itoPile()] })).doc)).toBe('0.5');

    // En memoria (`syncVersion`), editar un documento 0.6 sin campos v0.6 no le baja la versión; al guardar sí recalcula la mínima.
    const d06: ModelDoc = { ...baseDoc(), version: '0.6' };
    const edited = applyCommand(d06, { type: 'analysis/patch', patch: { slices: 60 } }) as ModelDoc;
    expect(edited.version).toBe('0.6');
    expect(saved(edited).version).toBe('0.2');
  });

  it('los campos v0.6 en null cuentan como ausentes: no suben la versión y no se escriben', () => {
    const matNull = { ...MC, ucs: null, gsi: null, mi: null, disturbance: null, shansep: null };
    const m = model('0.5', [matNull], { search: { type: 'circular_entry_exit', non_circular: null } });
    expect(v06Fields(m)).toEqual([]);
    const opened = open(m);
    expect(opened.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const doc = opened.doc as ModelDoc;
    expect(minimalVersion(doc)).toBe('0.2');
    const out = saved(doc);
    expect((out.materials as Json[])[0]).toEqual(MC);
    expect('non_circular' in ((out.analysis as Json).search as Json)).toBe(false);
  });
});

describe('v0.6: apertura, puerta de versión y orden de F6.1', () => {
  it('abre un archivo "0.6" con todos los campos nuevos y admite también los campos de 0.3, 0.4 y 0.5', () => {
    const full = model(
      '0.6',
      [
        HB,
        SH_POP,
        { id: 'u', name: 'No drenado', model: 'undrained', unit_weight: 18, undrained_strength: 30 },
      ],
      {
        methods: ['spencer', 'morgenstern_price', 'janbu_corrected'],
        interslice: { function: 'half_sine' },
        tension_crack: { depth: 1.5, water_fill: 0.5 },
        search: { type: 'circular_entry_exit', non_circular: { seeds: 3, max_vertices: 33 } },
      },
      { reinforcements: [anchor(), itoPile({ id: 'p2' })] },
    );
    const r = open(full);
    expect(r.issues).toEqual([]);
    expect(r.doc?.version).toBe('0.6');
    // F6.5 (E16e): Ito-Matsui with hoek_brown or shansep materials is rejected; the file still opens without loss.
    expect(validateLocal(r.doc as ModelDoc).filter((i) => i.severity === 'error')).toContainEqual(
      expect.objectContaining({
        text: 'lateral_pressure (Ito-Matsui) no se admite con materiales hoek_brown o shansep',
      }),
    );
  });

  it.each(['0.1', '0.2', '0.3', '0.4', '0.5'])('un archivo "%s" con un campo v0.6 da el error de la puerta con el mensaje exacto', (v) => {
    const hbThird = model(v, [MC, { ...MC, id: 's2' }, HB]);
    const eHb = errors(hbThird).filter((i) => i.code === 'io.version_fields');
    expect(eHb[0]).toMatchObject({
      code: 'io.version_fields',
      path: '/materials/2/model',
      text: 'materials[2].model = "hoek_brown" requiere version "0.6"',
    });

    const nc = model(v, [MC], { methods: ['bishop'], search: { type: 'circular_entry_exit', non_circular: {} } });
    const eNc = errors(nc).filter((i) => i.code === 'io.version_fields');
    expect(eNc).toEqual([
      {
        source: 'local',
        severity: 'error',
        code: 'io.version_fields',
        path: '/analysis/search/non_circular',
        text: 'analysis.search.non_circular requiere version "0.6"',
      },
    ]);
  });

  it('respeta exactamente el orden de F6.1 en v06Fields, openOgsJson y validateLocal', () => {
    // Material 0: MC limpio; Material 1: HB con los 5 campos; Material 2: SHANSEP; más non_circular en búsqueda.
    const allFieldsModel = model(
      '0.5',
      [
        MC,
        { ...HB, shansep: { ratio: 0.2, ocr: 1 } },
        SH_POP,
      ],
      { search: { type: 'circular_entry_exit', non_circular: { seeds: 2 } } },
    );
    const expectedOrder = [
      'materials[1].model = "hoek_brown"',
      'materials[1].ucs',
      'materials[1].gsi',
      'materials[1].mi',
      'materials[1].disturbance',
      'materials[1].shansep',
      'materials[2].model = "shansep"',
      'materials[2].shansep',
      'analysis.search.non_circular',
    ];
    expect(v06Fields(allFieldsModel).map((f) => f.field)).toEqual(expectedOrder);
    expect(errors(allFieldsModel).map((i) => i.text)).toEqual(expectedOrder.map((f) => `${f} requiere version "0.6"`));

    // Si materials[0] tiene `mi` y materials[1] tiene `model = "hoek_brown"`, manda materials[0].mi (material por material).
    const crossMaterial = model('0.5', [{ ...MC, mi: 8 }, HB]);
    expect(v06Fields(crossMaterial)[0]?.field).toBe('materials[0].mi');
    expect(errors(crossMaterial)[0]?.text).toBe('materials[0].mi requiere version "0.6"');

    const doc06 = open(model('0.6', [{ ...MC, gsi: 40, disturbance: 0.5 }, SH_POP], { search: { type: 'circular_entry_exit', non_circular: {} } }))
      .doc as ModelDoc;
    const localErrs = validateLocal({ ...doc06, version: '0.5' }).filter((i) => i.path === '/version');
    expect(localErrs).toHaveLength(1);
    expect(localErrs[0]?.text).toBe('materials[0].gsi requiere version "0.6"');
  });

  it('versión desconocida "0.8": openOgsJson la rechaza enumerando 0.1 a 0.7 y validateLocal usa el texto exacto del motor', () => {
    expect(unknownVersionMessage('0.8')).toBe('version debe ser "0.1", "0.2", "0.3", "0.4", "0.5", "0.6" o "0.7", no "0.8"');
    const r = open(model('0.8'));
    expect(r.doc).toBeNull();
    expect(r.issues[0]?.code).toBe('io.version');
    expect(r.issues[0]?.text).toContain('0.1, 0.2, 0.3, 0.4, 0.5, 0.6 y 0.7');

    const badDoc = { ...baseDoc(), version: '0.8' as ModelDoc['version'] };
    const vErr = validateLocal(badDoc).find((i) => i.path === '/version');
    expect(vErr?.text).toBe('version debe ser "0.1", "0.2", "0.3", "0.4", "0.5", "0.6" o "0.7", no "0.8"');
  });
});

describe('v0.6: ida y vuelta sin pérdida y orden canónico (F6.2, F6.3, F6.4)', () => {
  it('Hoek-Brown: conserva ucs, gsi, mi, disturbance, unit_weight_sat y ru sin redondear y en orden MATERIAL_KEYS', () => {
    const rawHb = {
      disturbance: 0.7,
      mi: 10.125,
      gsi: 50,
      ucs: 30000 + 1 / 3,
      ru: 0.15,
      unit_weight_sat: 27,
      unit_weight: 26,
      model: 'hoek_brown',
      name: 'Roca intacta',
      id: 'roca',
    };
    const doc = open(model('0.6', [rawHb])).doc as ModelDoc;
    const out = (saved(doc).materials as Json[])[0]!;
    expect(Object.keys(out)).toEqual(['id', 'name', 'model', 'unit_weight', 'unit_weight_sat', 'ru', 'ucs', 'gsi', 'mi', 'disturbance']);
    expect(out).toEqual({
      id: 'roca',
      name: 'Roca intacta',
      model: 'hoek_brown',
      unit_weight: 26,
      unit_weight_sat: 27,
      ru: 0.15,
      ucs: 30000 + 1 / 3,
      gsi: 50,
      mi: 10.125,
      disturbance: 0.7,
    });
    const t1 = saveOgsJson(doc);
    expect(saveOgsJson(openOgsJson(t1).doc as ModelDoc)).toBe(t1);
  });

  it('SHANSEP: conserva exponent omitido, exponent explícito, ocr, pop y la tabla ocr_by_elevation en orden canónico', () => {
    const shOmittedExp = {
      id: 'a1',
      name: 'Arcilla POP',
      model: 'shansep',
      unit_weight: 18,
      shansep: { pop: 30.5, ratio: 0.25 },
    };
    const shOcr = {
      id: 'a2',
      name: 'Arcilla OCR',
      model: 'shansep',
      unit_weight: 17.5,
      shansep: { ocr: 1.8, exponent: 0.75, ratio: 0.22 },
    };
    const table: [number, number][] = [
      [0, 3.2],
      [5.5, 2.1],
      [12 + 1 / 3, 1.0],
    ];
    const shTable = {
      id: 'a3',
      name: 'Arcilla perfil',
      model: 'shansep',
      unit_weight: 19,
      shansep: { ocr_by_elevation: table, ratio: 0.28 },
    };

    const doc = open(model('0.6', [shOmittedExp, shOcr, shTable])).doc as ModelDoc;
    const mats = saved(doc).materials as Json[];

    // 1) exponent omitido NO se rellena con 0.8 al serializar.
    expect(mats[0]?.shansep).toEqual({ ratio: 0.25, pop: 30.5 });
    expect(Object.keys(mats[0]?.shansep as Json)).toEqual(['ratio', 'pop']);

    // 2) exponent presente y ocr en el orden ['ratio', 'exponent', 'ocr'].
    expect(mats[1]?.shansep).toEqual({ ratio: 0.22, exponent: 0.75, ocr: 1.8 });
    expect(Object.keys(mats[1]?.shansep as Json)).toEqual(['ratio', 'exponent', 'ocr']);

    // 3) ocr_by_elevation sin pérdida de precisión y sin exponent si se omitió.
    expect(mats[2]?.shansep).toEqual({ ratio: 0.28, ocr_by_elevation: table });
    expect(Object.keys(mats[2]?.shansep as Json)).toEqual(['ratio', 'ocr_by_elevation']);

    const t1 = saveOgsJson(doc);
    expect(saveOgsJson(openOgsJson(t1).doc as ModelDoc)).toBe(t1);
  });

  it('búsqueda no circular: conserva {} vacío, solo seeds, solo max_vertices y ambos en orden ["seeds", "max_vertices"] al final de search', () => {
    const emptyNc = open(model('0.6', [MC], { search: { refine: true, type: 'circular_entry_exit', non_circular: {} } })).doc as ModelDoc;
    const sEmpty = (saved(emptyNc).analysis as Json).search as Json;
    expect(Object.keys(sEmpty)).toEqual(['type', 'refine', 'non_circular']);
    expect(sEmpty.non_circular).toEqual({});
    expect(saveOgsJson(openOgsJson(saveOgsJson(emptyNc)).doc as ModelDoc)).toBe(saveOgsJson(emptyNc));

    const fullNc = open(
      model('0.6', [MC], {
        search: {
          non_circular: { max_vertices: 17, seeds: 5 },
          refine: false,
          n_entry: 15,
          type: 'circular_entry_exit',
        },
      }),
    ).doc as ModelDoc;
    const sFull = (saved(fullNc).analysis as Json).search as Json;
    expect(Object.keys(sFull)).toEqual(['type', 'n_entry', 'refine', 'non_circular']);
    expect(Object.keys(sFull.non_circular as Json)).toEqual(['seeds', 'max_vertices']);
    expect(sFull.non_circular).toEqual({ seeds: 5, max_vertices: 17 });

    const partialNc = open(model('0.6', [MC], { search: { type: 'circular_entry_exit', non_circular: { seeds: null, max_vertices: 9 } } }))
      .doc as ModelDoc;
    expect(((saved(partialNc).analysis as Json).search as Json).non_circular).toEqual({ max_vertices: 9 });
  });
});

describe('v0.6: forma estricta (deny_unknown_fields), tipos inválidos y salidas F6.6', () => {
  it('rechaza claves desconocidas en shansep (incluidas las excluidas en F6.3) y en non_circular', () => {
    for (const forbidden of ['su_min', 'yield_stress', 'su_by_stress', 'anisotropy', 'above_water', 'b_bar']) {
      const m = model('0.6', [{ ...SH_POP, shansep: { ratio: 0.25, ocr: 1.5, [forbidden]: 1 } }]);
      const e = errors(m).find((i) => i.code === 'io.unknown_field');
      expect(e?.path, forbidden).toBe(`/materials/0/shansep/${forbidden}`);
    }
    const ncUnknown = model('0.6', [MC], { search: { type: 'circular_entry_exit', non_circular: { seeds: 3, vertices: 17 } } });
    expect(errors(ncUnknown).find((i) => i.code === 'io.unknown_field')?.path).toBe('/analysis/search/non_circular/vertices');
  });

  it('rechaza tipos incorrectos con io.shape y no finitos con io.non_finite', () => {
    expect(errors(model('0.6', [{ ...HB, ucs: '30000' }]))[0]).toMatchObject({ code: 'io.shape', path: '/materials/0/ucs' });
    expect(errors(model('0.6', [{ ...SH_POP, shansep: 5 }]))[0]).toMatchObject({ code: 'io.shape', path: '/materials/0/shansep' });
    expect(errors(model('0.6', [{ ...SH_POP, shansep: { ocr: 1.5 } }]))[0]).toMatchObject({
      code: 'io.shape',
      path: '/materials/0/shansep/ratio',
    });
    expect(errors(model('0.6', [{ ...SH_POP, shansep: { ratio: 0.25, ocr_by_elevation: [[0, 'x']] } }]))[0]).toMatchObject({
      code: 'io.shape',
      path: '/materials/0/shansep/ocr_by_elevation',
    });
    expect(errors(model('0.6', [MC], { search: { type: 'circular_entry_exit', non_circular: [] } }))[0]).toMatchObject({
      code: 'io.shape',
      path: '/analysis/search/non_circular',
    });
    expect(errors(model('0.6', [MC], { search: { type: 'circular_entry_exit', non_circular: { seeds: '3' } } }))[0]).toMatchObject({
      code: 'io.shape',
      path: '/analysis/search/non_circular/seeds',
    });

    const infText = JSON.stringify(model('0.6', [{ ...SH_POP, shansep: { ratio: 0.25, ocr_by_elevation: [[0, 2], [5, 1]] } }])).replace(
      '[5,1]',
      '[5,1e400]',
    );
    const rInf = openOgsJson(infText);
    expect(rInf.doc).toBeNull();
    expect(rInf.issues.some((i) => i.code === 'io.non_finite' && i.path === '/materials/0/shansep/ocr_by_elevation/1/1')).toBe(true);
  });

  it('describePath describe las rutas nuevas y los tipos de salida de F6.6 compilan', () => {
    expect(describePath('/materials/0/ucs')).toBe('el material 1 (resistencia a compresión simple σci)');
    expect(describePath('/materials/0/shansep/ratio')).toBe('el material 1 (parámetros SHANSEP, cociente S)');
    expect(describePath('/materials/0/shansep/ocr_by_elevation/1')).toBe('el material 1 (parámetros SHANSEP, fila 2)');
    expect(describePath('/analysis/search/non_circular')).toBe('la búsqueda no circular');
    expect(describePath('/analysis/search/non_circular/max_vertices')).toBe('la búsqueda no circular (vértices máximos)');

    const strength: StrengthReport = {
      passes: 7,
      slices: [
        { index: 3, law: 'hoek_brown', normal_stress: 52.1 },
        { index: 10, law: 'shansep', vertical_stress: 80.2, ocr: 1.6 },
      ],
    };
    const shOnly: StrengthReport = {
      slices: [{ index: 0, law: 'shansep', vertical_stress: 40, ocr: 2 }],
    };
    const ncStats: NonCircularStats = { seeds: 3, evaluated: 4210, seed_fos: 1.402 };
    const searchStats: SearchStats = { evaluated: 8500, valid: 6400, non_circular: ncStats };
    const shSpec: ShansepSpec = { ratio: 0.25, ocr_by_elevation: [[0, 2], [10, 1]] };
    const rep: MethodReport = {
      method: 'spencer',
      fos: 1.19,
      status: 'converged',
      iterations: 6,
      lambda: 0.18,
      surface: { points: [[10, 20], [25, 12], [40, 25]] },
      slices: [],
      search: searchStats,
      warnings: [],
      strength,
    };
    expect(rep.strength?.passes).toBe(7);
    expect(shOnly.passes).toBeUndefined();
    expect(rep.search?.non_circular?.seed_fos).toBe(1.402);
    expect(shSpec.ratio).toBe(0.25);
  });
});
