// UA-E3 §4: recuento de avisos del modelo para el chip y el HUD.
import { describe, expect, it } from 'vitest';
import type { AnalysisReport } from '../../../engine/types';
import { advisoryCounts, focusDiagnostics } from './advisories';

const result = (warnings: string[]) =>
  ({ method: 'bishop', status: 'converged', fos: 1.2, surface: { type: 'circle', cx: 0, cy: 0, r: 1 }, slices: [], warnings }) as unknown as AnalysisReport['results'][number];
const report = (...rs: AnalysisReport['results']): AnalysisReport => ({ engine: 'test', results: rs }) as AnalysisReport;

describe('advisoryCounts', () => {
  it('cuenta solo las incidencias locales de severidad aviso', () => {
    const c = advisoryCounts([{ severity: 'aviso' }, { severity: 'error' }, { severity: 'nota' }, { severity: 'aviso' }], null);
    expect(c).toEqual({ local: 2, run: 0, total: 2 });
  });
  it('suma los avisos del cálculo actual y deja fuera las notas', () => {
    // `max_iterations` y `air_gap_thrust` son avisos; `water_above_ground` es una nota.
    const c = advisoryCounts([{ severity: 'aviso' }], report(result(['max_iterations', 'water_above_ground']), result(['air_gap_thrust'])));
    expect(c).toEqual({ local: 1, run: 2, total: 3 });
  });
  it('sin cálculo actual (report nulo) el recuento del cálculo es 0', () => {
    expect(advisoryCounts([], null)).toEqual({ local: 0, run: 0, total: 0 });
  });
});

describe('focusDiagnostics', () => {
  it('sin Diagnósticos en el DOM devuelve false', () => {
    expect(focusDiagnostics({ querySelector: () => null })).toBe(false);
  });
});
