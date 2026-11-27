// R15B-16: isAnalysisReport valida strength y search.non_circular (v0.6, F6.6).
import { describe, expect, it } from 'vitest';
import { isAnalysisReport } from './validate';

function baseReport(override: Record<string, unknown> = {}) {
  return {
    engine: 'ogs-core 0.4.0',
    results: [
      {
        method: 'spencer',
        fos: 1.25,
        status: 'converged',
        iterations: 5,
        lambda: 0.12,
        surface: { points: [[0, 10], [10, 5], [20, 0]] },
        slices: [],
        search: { evaluated: 100, valid: 50, non_circular: { seeds: 3, evaluated: 420, seed_fos: 1.31, polyline_fos: 1.25 } },
        warnings: [],
        strength: {
          passes: 7,
          slices: [
            { index: 0, law: 'hoek_brown', normal_stress: 52.1 },
            { index: 1, law: 'shansep', vertical_stress: 80.2, ocr: 1.6 },
          ],
        },
        ...override,
      },
    ],
  };
}

describe('R15B-16: isAnalysisReport valida strength y search.non_circular', () => {
  it('acepta informes v0.6 válidos (con o sin passes y polyline_fos)', () => {
    expect(isAnalysisReport(baseReport())).toBe(true);
    expect(
      isAnalysisReport(
        baseReport({
          search: { evaluated: 100, valid: 50, non_circular: { seeds: 2, evaluated: 0, seed_fos: 1.31 } },
          strength: { slices: [{ index: 0, law: 'shansep', vertical_stress: 40, ocr: 1 }] },
        }),
      ),
    ).toBe(true);
  });

  it('rechaza search.non_circular corrupto o con tipos inválidos', () => {
    expect(isAnalysisReport(baseReport({ search: { evaluated: 10, valid: 5, non_circular: 'CORRUPT' } }))).toBe(false);
    expect(isAnalysisReport(baseReport({ search: { evaluated: 10, valid: 5, non_circular: { seeds: -1, evaluated: 0, seed_fos: 1.2 } } }))).toBe(false);
    expect(isAnalysisReport(baseReport({ search: { evaluated: 10, valid: 5, non_circular: { seeds: 1.5, evaluated: 0, seed_fos: 1.2 } } }))).toBe(false);
    expect(isAnalysisReport(baseReport({ search: { evaluated: 10, valid: 5, non_circular: { seeds: 1, evaluated: 0, seed_fos: Number.NaN } } }))).toBe(false);
    expect(isAnalysisReport(baseReport({ search: { evaluated: 10, valid: 5, non_circular: { seeds: 1, evaluated: 0, seed_fos: 1.2, polyline_fos: 'bad' } } }))).toBe(false);
  });

  it('rechaza strength corrupto o con dovelas mal formadas', () => {
    expect(isAnalysisReport(baseReport({ strength: 'CORRUPT' }))).toBe(false);
    expect(isAnalysisReport(baseReport({ strength: { passes: -1, slices: [] } }))).toBe(false);
    expect(isAnalysisReport(baseReport({ strength: { passes: 1.5, slices: [] } }))).toBe(false);
    expect(isAnalysisReport(baseReport({ strength: { slices: 'bad' } }))).toBe(false);
    expect(isAnalysisReport(baseReport({ strength: { slices: [{ index: 0, law: 'unknown', normal_stress: 10 }] } }))).toBe(false);
    expect(isAnalysisReport(baseReport({ strength: { slices: [{ index: 0, law: 'hoek_brown' }] } }))).toBe(false);
    expect(isAnalysisReport(baseReport({ strength: { slices: [{ index: 0, law: 'shansep', vertical_stress: 50 }] } }))).toBe(false);
    expect(isAnalysisReport(baseReport({ strength: { slices: [{ index: -1, law: 'hoek_brown', normal_stress: 10 }] } }))).toBe(false);
  });
});
