// R15B-03, R15B-04 y E16x: el aviso combinado de la rama de tracción, la orientación de Hoek-Brown sin FS y la nota `non_circular_not_refined`.
import { describe, expect, it } from 'vitest';
import { summaryItems, warningCounts } from '../editor/app/resultSummary';
import type { MethodReport } from './types';
import {
  ENGINE_WARNING_CODES,
  PENDING_E6_WARNING_CODES,
  describeResultWarnings,
  describeWarning,
  warningContext,
  warningPath,
} from './warnings';

const VOSEO = /\b(usted|vos|podés|tenés|sabés|querés|considerá|indicá)\b/i;
const POLY: MethodReport['surface'] = { points: [[0, 10], [5, 4], [12, 10]] };
const CIRCLE: MethodReport['surface'] = { xc: 10, yc: 20, r: 15 };
const NC = { evaluated: 100, valid: 50, non_circular: { seeds: 3, evaluated: 4210, seed_fos: 0.402, polyline_fos: 0.386 } };
const BOTH = ['negative_lambda', 'negative_effective_normal_major'];

function result(over: Partial<MethodReport>): MethodReport {
  return { method: 'spencer', fos: 0.386, status: 'converged', iterations: 8, lambda: -0.5, surface: POLY, slices: [], search: null, warnings: [], ...over };
}

describe('R15B-03: aviso combinado de la rama de tracción (V002, E16u)', () => {
  it('el contexto marca el riesgo solo si coinciden los dos códigos, y la búsqueda no circular solo con sus estadísticas', () => {
    expect(warningContext(result({ warnings: BOTH, search: NC }))).toEqual({ method: 'spencer', surface: 'polyline', nonCircular: true, tractionBranchRisk: true });
    expect(warningContext(result({ warnings: ['negative_lambda'], search: NC })).tractionBranchRisk).toBeUndefined();
    expect(warningContext(result({ warnings: ['negative_effective_normal_major'] })).tractionBranchRisk).toBeUndefined();
    expect(warningContext(result({ warnings: BOTH })).nonCircular).toBeUndefined();
  });

  it('en la búsqueda no circular, λ negativo sube a aviso con el riesgo de rama de tracción, Janbu, λ y N′; no sugiere Bishop', () => {
    const out = describeResultWarnings(result({ warnings: BOTH, search: NC }));
    const lambda = out.find((w) => w.code === 'negative_lambda')!;
    expect(lambda.severity).toBe('aviso');
    expect(lambda.text).toBe(
      'Aviso combinado: λ negativo y normal efectiva negativa en una parte importante de la base. En la búsqueda no circular el FS puede venir de una rama de equilibrio con tracción y quedar por debajo del valor real; compare con Janbu y revise λ y la normal efectiva N′ (presión de poros y grieta de tracción) antes de aceptarlo.',
    );
    expect(lambda.text).not.toMatch(/Bishop/);
    expect(out.find((w) => w.code === 'negative_effective_normal_major')?.severity).toBe('aviso');
    expect(lambda.text).not.toMatch(VOSEO);
  });

  it('sin la búsqueda no circular el aviso combinado no la nombra, y en un círculo contrasta con Bishop', () => {
    const poly = describeResultWarnings(result({ warnings: BOTH })).find((w) => w.code === 'negative_lambda')!;
    expect(poly.severity).toBe('aviso');
    expect(poly.text).toContain('Con tracción en la base el FS puede venir de una rama de equilibrio con tracción');
    expect(poly.text).not.toMatch(/no circular/);
    const circle = describeResultWarnings(result({ warnings: BOTH, surface: CIRCLE })).find((w) => w.code === 'negative_lambda')!;
    expect(circle.text).toContain('compare con Bishop simplificado');
  });

  it('λ negativo solo conserva su nota de E12e', () => {
    const only = describeResultWarnings(result({ warnings: ['negative_lambda'], search: NC }))[0]!;
    expect(only).toEqual({
      code: 'negative_lambda',
      severity: 'nota',
      text: 'El método seleccionó una raíz de equilibrio con λ negativo; revise el resultado o compare con Janbu.',
    });
  });

  it('el aviso combinado cuenta como aviso en la franja de resultados y marca el método', () => {
    const report = { engine: 'ogs-core', results: [result({ warnings: BOTH, search: NC })] };
    expect(warningCounts(report)).toEqual({ avisos: 2, notas: 0 });
    expect(summaryItems(report)[0]).toMatchObject({ flagged: true, warnings: 2 });
    const solo = { engine: 'ogs-core', results: [result({ warnings: ['negative_lambda'], search: NC })] };
    expect(warningCounts(solo)).toEqual({ avisos: 0, notas: 1 });
  });
});

describe('R15B-04: Hoek-Brown sin FS orienta hacia poros altos o tracción', () => {
  const hbCtx = { passes: 1, slices: [] };
  it.each(['m_alpha', 'no_admissible_root', 'hoek_brown_not_converged'])('%s lo orienta con un modelo Hoek-Brown', (code) => {
    const hb = describeResultWarnings(result({ method: 'bishop', surface: CIRCLE, status: 'invalid', fos: null, warnings: [code, 'hoek_brown_low_confinement'], strength: hbCtx }))[0]!;
    expect(hb.code).toBe(code);
    expect(hb.text).toMatch(/presión de poros alta \(ru o piezométrica\) o a tracción en la base/);
    expect(hb.text).toMatch(/resistencia a tracción σt/);
    expect(hb.text).not.toMatch(VOSEO);
  });

  it('sin Hoek-Brown los textos de m_alpha y no_admissible_root no cambian', () => {
    for (const code of ['m_alpha', 'no_admissible_root']) {
      expect(describeWarning(code).text).not.toMatch(/Hoek-Brown/);
      expect(describeResultWarnings(result({ warnings: [code] }))[0]!.text).not.toMatch(/Hoek-Brown/);
    }
  });

  it('un SHANSEP sin Hoek-Brown (strength sin passes) no lleva la orientación', () => {
    const sh = describeResultWarnings(result({ warnings: ['m_alpha'], strength: { slices: [{ index: 0, law: 'shansep', vertical_stress: 50, ocr: 1.5 }] } }))[0]!;
    expect(sh.text).not.toMatch(/Hoek-Brown/);
  });
});

describe('E16x: non_circular_not_refined', () => {
  it('es una nota con el texto del contrato y lleva a la búsqueda', () => {
    expect(describeWarning('non_circular_not_refined')).toEqual({
      code: 'non_circular_not_refined',
      severity: 'nota',
      text: 'La búsqueda no circular no encontró ninguna polilínea admisible: el resultado es el círculo de la búsqueda circular.',
    });
    expect(warningPath('non_circular_not_refined')).toBe('/analysis/search');
    expect(describeWarning('non_circular_not_refined').text).not.toMatch(VOSEO);
  });

  it('está en la lista de E6 y ya no figura como pendiente', () => {
    expect(ENGINE_WARNING_CODES as readonly string[]).toContain('non_circular_not_refined');
    expect(PENDING_E6_WARNING_CODES as readonly string[]).not.toContain('non_circular_not_refined');
  });

  it('no cuenta como aviso en la franja de resultados', () => {
    const report = { engine: 'ogs-core', results: [result({ warnings: ['non_circular_not_refined'], surface: CIRCLE, search: { evaluated: 1, valid: 1, non_circular: { seeds: 1, evaluated: 0, seed_fos: 1.9 } } })] };
    expect(warningCounts(report)).toEqual({ avisos: 0, notas: 1 });
  });
});
