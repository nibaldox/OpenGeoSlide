import { describe, expect, it } from 'vitest';
import { baseDoc } from './testFixtures';
import { convertDocUnits, UNIT_FACTORS } from './units';
import { OGS_BIN, engineRun, haveEngine, type EngineMethodResult } from './engineRun.testutil';
import type { Material } from '../../engine/types';
import type { ModelDoc } from '../types';

function model() {
  const doc = baseDoc();
  doc.version = '0.6';
  doc.materials = [
    { id: 'hb', name: 'roca', model: 'hoek_brown', unit_weight: 25, ucs: 30000, gsi: 50, mi: 10, disturbance: 0.7 },
    { id: 'sh', name: 'arcilla', model: 'shansep', unit_weight: 18, shansep: { ratio: 0.25, pop: 30 } },
    { id: 'tab', name: 'tabla', model: 'shansep', unit_weight: 18, shansep: { ratio: 0.3, exponent: 0.8, ocr_by_elevation: [[-12, 3], [10, 1]] } },
  ];
  return doc;
}

it('convierte ucs, pop y las cotas, y conserva OCR y parámetros adimensionales', () => {
  const si = model();
  const imp = convertDocUnits(si, 'imperial');
  expect(imp.materials[0].ucs).toBeCloseTo(30000 * UNIT_FACTORS.stress, 7);
  expect(imp.materials[1].shansep?.pop).toBeCloseTo(30 * UNIT_FACTORS.stress, 9);
  expect(imp.materials[2].shansep?.ocr_by_elevation?.[0]).toEqual([-12 * UNIT_FACTORS.length, 3]);
  const back = convertDocUnits(imp, 'SI');
  expect(back.materials[0].ucs).toBeCloseTo(30000, 9);
  expect(back.materials[1].shansep?.pop).toBeCloseTo(30, 12);
  expect(back.materials[2].shansep?.ocr_by_elevation?.[0][0]).toBeCloseTo(-12, 12);
  expect(back.materials[2].shansep?.ocr_by_elevation?.[0][1]).toBe(3);
});

// El motor ya tiene la física v0.6: el test corre siempre que haya OGS_BIN (B2a, W1-T1).
// Tres modelos válidos para el motor, con Hoek-Brown en la capa baja y SHANSEP en la alta, y un círculo fijo que atraviesa las dos:
//  - SA: el rajo de X23 §4.1 (`crates/ogs-core/tests/data/f3b/hb/X28-F-SA.json`: geometría, círculo y roca débil, GSI 25, mi 8, D 0,7),
//    partido en y = 20; encima, SHANSEP con OCR por cota. La base del círculo va de y ≈ 17 a y = 30.
//  - V047a: el talud de `tests/data/f3b/sh/X30-F-V047a-*.json` (círculo de X30), con la roca de SA, partido en y = 29; encima,
//    SHANSEP con POP y con OCR por cota. La base va de y ≈ 25 a y ≈ 35.
// (SA con POP no sirve: Spencer y Morgenstern-Price no convergen en ese círculo, una propiedad del modelo y no de las unidades.)
type Pt = [number, number];
const ROCK = { id: 'roca', name: 'roca', model: 'hoek_brown', unit_weight: 25, ucs: 12000, gsi: 25, mi: 8, disturbance: 0.7, ru: null } as const;
const METHODS = ['bishop', 'spencer', 'morgenstern_price', 'janbu_simplified', 'janbu_corrected'] as const;
// Misma tolerancia que los demás tests de unidades con el motor real (units.crack.engine y units.itomatsui.engine): 1e-9.
const FS_TOLERANCE = 1e-9;

interface Layered { lower: Pt[]; upper: Pt[]; surface: { xc: number; yc: number; r: number }; slices: number; upperMaterial: Material }

function layered(c: Layered): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.6',
    meta: { id: 'units-f3b', title: 'Hoek-Brown y SHANSEP: unidades' },
    units: 'SI',
    materials: [ROCK, c.upperMaterial],
    regions: [{ material: 'roca', polygon: c.lower }, { material: c.upperMaterial.id, polygon: c.upper }],
    water: null,
    slope: { direction: 'right_to_left' },
    analysis: {
      methods: [...METHODS], slices: c.slices, tolerance: 1e-5, max_iterations: 1000, min_m_alpha: 0.2,
      surface: { type: 'circle', ...c.surface }, interslice: { function: 'constant' },
    },
  } as unknown as ModelDoc;
}

const SA = {
  lower: [[-40, -10], [72.3205, -10], [72.3205, 20], [21.547, 20], [16.547, 20], [10.7735, 10], [5.7735, 10], [0, 0], [-40, 0]] as Pt[],
  upper: [[21.547, 20], [72.3205, 20], [72.3205, 30], [32.3205, 30], [27.3205, 30]] as Pt[],
  surface: { xc: 11.064761108572334, yc: 35.672573017328205, r: 18.85046460530379 },
  slices: 40,
};
const V047A = {
  lower: [[20, 20], [20, 25], [30, 25], [38, 29], [70, 29], [70, 20]] as Pt[],
  upper: [[38, 29], [50, 35], [70, 35], [70, 29]] as Pt[],
  surface: { xc: 29.511, yc: 53.738, r: 28.742 },
  slices: 50,
};
const arcilla = (shansep: NonNullable<Material['shansep']>): Material => ({ id: 'arc', name: 'arcilla', model: 'shansep', unit_weight: 18, shansep });
const CASES: Record<string, Layered> = {
  'SA: Hoek-Brown y SHANSEP con OCR por cota': { ...SA, upperMaterial: arcilla({ ratio: 0.3, exponent: 0.8, ocr_by_elevation: [[20, 3], [30, 1.5]] }) },
  'V047a: Hoek-Brown y SHANSEP con POP': { ...V047A, upperMaterial: arcilla({ ratio: 0.25, exponent: 0.8, pop: 10 }) },
  'V047a: Hoek-Brown y SHANSEP con OCR por cota': { ...V047A, upperMaterial: arcilla({ ratio: 0.3, exponent: 0.8, ocr_by_elevation: [[29, 1.5], [35, 1]] }) },
};

describe.skipIf(!haveEngine)(`el FS v0.6 se conserva entre SI e imperial (${OGS_BIN})`, () => {
  const run = (doc: ModelDoc): Map<string, EngineMethodResult> => {
    const r = engineRun(doc);
    expect(r.code, r.out).toBe(0);
    return new Map(r.results.map((x) => [x.method, x]));
  };
  for (const [name, c] of Object.entries(CASES)) {
    describe(name, () => {
      // `describe.skipIf` ejecuta igual el cuerpo: el motor se llama dentro de cada test, una vez por modelo.
      const memo = <T,>(f: () => T): (() => T) => {
        let v: T | undefined;
        return () => (v === undefined ? (v = f()) : v);
      };
      const siRun = memo(() => run(layered(c)));
      const imperialRun = memo(() => run(convertDocUnits(layered(c), 'imperial')));
      const backRun = memo(() => run(convertDocUnits(convertDocUnits(layered(c), 'imperial'), 'SI')));
      it.each(METHODS)('%s: el FS es finito, converge y es el mismo en SI, en imperial y de vuelta', (method) => {
        const si = siRun(), imperial = imperialRun(), back = backRun();
        const a = si.get(method)!;
        expect(a.status).toBe('converged');
        expect(a.fos).not.toBeNull();
        expect(a.fos!).toBeGreaterThan(0.2);
        expect(Math.abs(a.fos! - imperial.get(method)!.fos!), `${method}: SI ${a.fos} vs imperial ${imperial.get(method)!.fos}`).toBeLessThanOrEqual(FS_TOLERANCE);
        expect(Math.abs(a.fos! - back.get(method)!.fos!)).toBeLessThanOrEqual(FS_TOLERANCE);
      });
    });
  }
});
