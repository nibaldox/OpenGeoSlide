// W2-HB: el informe y el panel de materiales usan la misma calculadora de mb, s y a (ecs. 3 a 5 de Hoek et al., 2002).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hoekBrownParameters } from '../editor/state/hoekBrown';
import { deriveHoekBrown, deriveHoekBrownFromMaterial } from './hoekBrown';

describe('report/hoekBrown: paridad con la calculadora de W1', () => {
  it('da exactamente los mismos mb, s y a en una malla de GSI, mi y D', () => {
    for (const gsi of [0, 5, 25, 50, 62.5, 75, 100]) {
      for (const mi of [1, 7, 10, 25, 33]) {
        for (const d of [0, 0.3, 0.5, 0.7, 1]) {
          expect(deriveHoekBrown(mi, gsi, d)).toEqual(hoekBrownParameters(gsi, mi, d));
          expect(deriveHoekBrownFromMaterial({ mi, gsi, disturbance: d })).toEqual(hoekBrownParameters(gsi, mi, d));
        }
      }
    }
  });

  it('conserva las cifras de referencia de F6.8 (GSI 50, mi 10, D 0,7)', () => {
    const p = deriveHoekBrown(10, 50, 0.7);
    expect(p.mb).toBeCloseTo(10 * Math.exp(-50 / (28 - 9.8)), 12);
    expect(p.s).toBeCloseTo(Math.exp(-50 / (9 - 2.1)), 12);
    expect(p.a).toBeCloseTo(0.5 + (Math.exp(-50 / 15) - Math.exp(-20 / 3)) / 6, 12);
  });

  it('devuelve null si falta algún dato o no es finito', () => {
    expect(deriveHoekBrownFromMaterial({ mi: 10, gsi: 50 })).toBeNull();
    expect(deriveHoekBrownFromMaterial({ mi: null, gsi: 50, disturbance: 0 })).toBeNull();
    expect(deriveHoekBrownFromMaterial({ mi: 10, gsi: Number.NaN, disturbance: 0 })).toBeNull();
  });

  it('el informe no repite las fórmulas: importa la calculadora de W1', () => {
    const source = readFileSync(new URL('./hoekBrown.ts', import.meta.url), 'utf8');
    expect(source).toContain("from '../editor/state/hoekBrown'");
    expect(source).not.toMatch(/Math\.exp/);
  });
});
