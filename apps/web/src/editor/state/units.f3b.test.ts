import { expect, it } from 'vitest';
import { baseDoc } from './testFixtures';
import { convertDocUnits, UNIT_FACTORS } from './units';
import { engineRun, haveEngine } from './engineRun.testutil';

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

// B2: activar solo con un binario que implemente los tres stubs de B0.
const physicsAvailable = haveEngine && process.env.OGS_F3B_PHYSICS === '1';
it.skipIf(!physicsAvailable)('el FS v0.6 se conserva entre SI e imperial', () => {
  const si = model();
  si.regions = si.regions.map(r => ({ ...r, material: 'hb' }));
  const a = engineRun(si), b = engineRun(convertDocUnits(si, 'imperial'));
  expect(a.code, a.out).toBe(0); expect(b.code, b.out).toBe(0);
  expect(a.results.length).toBeGreaterThan(0);
  for (let i = 0; i < a.results.length; i++) {
    expect(a.results[i].fos).not.toBeNull(); expect(b.results[i].fos).not.toBeNull();
    expect(Math.abs(a.results[i].fos! - b.results[i].fos!)).toBeLessThanOrEqual(1e-9);
  }
});
