// F3G (E15j-2): con una grieta de tracción de profundidad fija, la polilínea inicial que propone el panel debe bajar `1,05·d` bajo el terreno;
// si no, el motor da `NoValidSurface: tension_crack_not_reached`. Sin grieta o con grieta automática, la propuesta no cambia.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { VerificationCase } from '../../engine/types';
import { openOgsJson } from '../../io/ogsJson';
import { engineRun, haveEngine } from '../state/engineRun.testutil';
import { checkPolylineAgainstModel } from '../state/polylineGround';
import type { ModelDoc } from '../types';
import { crackReach, defaultCircle, fallbackPolyline, initialPolyline, terrainY } from './forms';

const casesDir = new URL('../../../../../verification/cases/', import.meta.url);
const load = (id: string): ModelDoc => openOgsJson(JSON.stringify((JSON.parse(readFileSync(new URL(`${id}.json`, casesDir), 'utf8')) as VerificationCase).model)).doc as ModelDoc;
const withCircle = (doc: ModelDoc): ModelDoc => ({ ...doc, analysis: { ...doc.analysis, surface: doc.analysis.surface?.type === 'circle' ? doc.analysis.surface : defaultCircle(doc), search: undefined } }) as ModelDoc;
const maxDepth = (doc: ModelDoc, pts: ReadonlyArray<readonly [number, number]>): number => Math.max(...pts.map(([x, y]) => terrainY(doc.regions, x, 1e-9) - y));

// Casos con grieta de profundidad fija: V072a y V079 (polilínea fija en el caso), V047b, V082a, V088 (círculo o búsqueda) y V096a.
const FIXED = [['V047b', 3.6], ['V072a', 1.6764], ['V079', 15], ['V080', 15], ['V082a', 3.3528], ['V088', 2.1336], ['V096a', 1.015]] as const;

describe('crackReach', () => {
  it('es 1,05·d con una grieta de profundidad fija; nulo sin grieta, automática o de profundidad nula', () => {
    for (const [id, d] of FIXED) expect(crackReach(load(id)), id).toBeCloseTo(1.05 * d, 12);
    expect(crackReach(load('V047a'))).toBeNull();
    expect(crackReach(load('V086b-auto'))).toBeNull();
    const zero = load('V047b');
    zero.analysis = { ...zero.analysis, tension_crack: { depth: 0, water_fill: 0 } };
    expect(crackReach(zero)).toBeNull();
  });
});

describe('polilínea inicial con una grieta de profundidad fija', () => {
  for (const [id, d] of FIXED) {
    it(`${id}: la propuesta y el respaldo son admisibles y bajan 1,05·d (= ${(1.05 * d).toFixed(3)}) bajo el terreno`, () => {
      const doc = withCircle(load(id));
      for (const pts of [initialPolyline(doc), fallbackPolyline(doc)]) {
        expect(checkPolylineAgainstModel(doc.regions, pts).ok).toBe(true);
        expect(maxDepth(doc, pts)).toBeGreaterThanOrEqual(1.05 * d);
      }
    });
  }

  it('también con círculos de partida perturbados (los de la ruta C del barrido), que quedan menos profundos que la grieta', () => {
    const shifts: Array<[number, number, number]> = [[0.3, 0, 1], [-0.3, 0.2, 0.8], [0.1, -0.3, 1.3], [-0.2, -0.1, 0.7], [0, 0.4, 1.15]];
    let n = 0;
    for (const [id, d] of FIXED) {
      const base = withCircle(load(id));
      const c = base.analysis.surface as { xc: number; yc: number; r: number };
      for (const [dx, dy, k] of shifts) {
        const doc = { ...base, analysis: { ...base.analysis, surface: { type: 'circle', xc: c.xc + dx * c.r, yc: c.yc + dy * c.r, r: c.r * k } } } as ModelDoc;
        const pts = initialPolyline(doc);
        n += 1;
        expect(checkPolylineAgainstModel(doc.regions, pts).ok, `${id} ${dx},${dy},${k}`).toBe(true);
        expect(maxDepth(doc, pts), `${id} ${dx},${dy},${k}`).toBeGreaterThanOrEqual(1.05 * d);
      }
    }
    expect(n).toBe(FIXED.length * shifts.length);
  });

  it('sin grieta, la propuesta no se profundiza: es la misma con y sin el campo de profundidad nula', () => {
    const doc = withCircle(load('V047a'));
    const zero = { ...doc, analysis: { ...doc.analysis, tension_crack: { depth: 0, water_fill: 0 } } } as ModelDoc;
    expect(initialPolyline(zero)).toEqual(initialPolyline(doc));
    expect(fallbackPolyline(zero)).toEqual(fallbackPolyline(doc));
  });

  it.skipIf(!haveEngine)('con el motor real, Spencer no da NoValidSurface en ninguno de los casos con grieta fija', () => {
    for (const [id] of FIXED) {
      const doc = withCircle(load(id));
      const run = engineRun({ ...doc, analysis: { ...doc.analysis, methods: ['spencer'], surface: { type: 'polyline', points: initialPolyline(doc).map(([x, y]) => [x, y] as [number, number]) } } } as ModelDoc);
      expect(run.out.split('\n')[0], id).not.toMatch(/tension_crack_not_reached/);
    }
  });
});
