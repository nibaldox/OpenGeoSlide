// Avisos nuevos del bloque F3B (F6.7, E16g): severidad, texto exacto y ruta JSON en `warnings.ts`.
import { describe, expect, it } from 'vitest';
import { ENGINE_WARNING_CODES, describeResultWarnings, describeWarning, hoekBrownNoFosHint, warningPath } from './warnings';

describe('avisos F6.7 (Hoek-Brown, SHANSEP y búsqueda no circular)', () => {
  const EXPECTED = [
    {
      code: 'hoek_brown_not_converged',
      severity: 'aviso',
      path: '/materials',
      text: 'El cálculo con Hoek-Brown no convergió: la resistencia de la roca no se estabilizó con el factor de seguridad.',
    },
    {
      code: 'hoek_brown_low_confinement',
      severity: 'nota',
      path: '/materials',
      text: 'En parte de la base el esfuerzo normal es muy bajo o de tracción; la resistencia de Hoek-Brown se tomó con la regla de bajo confinamiento. Revise la presión de poros y las grietas.',
    },
    {
      code: 'shansep_nonpositive_stress',
      severity: 'nota',
      path: '/materials',
      text: 'En parte de la base el esfuerzo vertical efectivo es nulo o negativo; ahí la resistencia SHANSEP se tomó como cero.',
    },
    {
      code: 'non_circular_large_change',
      severity: 'nota',
      path: '/analysis/search',
      text: 'La superficie no circular bajó el factor de seguridad más de un 15 % respecto del mejor círculo; revise la geometría de la superficie crítica.',
    },
  ] as const;

  it.each(EXPECTED)('$code está en ENGINE_WARNING_CODES con su severidad, texto exacto y ruta', ({ code, severity, path, text }) => {
    expect(ENGINE_WARNING_CODES).toContain(code);
    expect(describeWarning(code)).toEqual({ code, severity, text });
    expect(warningPath(code)).toBe(path);
  });

  it('describeResultWarnings conserva los textos exactos tanto en círculos como en polilíneas (con la orientación de Hoek-Brown sin FS, R15B-04)', () => {
    const codes = EXPECTED.map((e) => e.code);
    const circleOut = describeResultWarnings({ method: 'bishop', surface: { xc: 10, yc: 20, r: 15 }, warnings: codes });
    const polyOut = describeResultWarnings({
      method: 'spencer',
      surface: { points: [[0, 10], [5, 4], [12, 10]] },
      warnings: codes,
    });
    // R15B-04: con un aviso `hoek_brown_*` en el resultado, el texto de «no convergió» agrega la orientación hacia poros altos o tracción.
    const hint = hoekBrownNoFosHint({ hoekBrown: true });
    expect(circleOut).toEqual(EXPECTED.map(({ code, severity, text }) => ({ code, severity, text: code === 'hoek_brown_not_converged' ? text + hint : text })));
    expect(polyOut).toEqual(circleOut);
  });
});
