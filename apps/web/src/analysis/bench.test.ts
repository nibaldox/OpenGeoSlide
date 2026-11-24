import { describe, expect, it } from 'vitest';
import { BENCH_TARGET, makeBenchRecord, median } from './bench';
import type { AnalysisReport } from '../engine/types';

describe('bench', () => {
  it('median: impar, par y error con conjunto vacío', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
    expect(() => median([])).toThrow(/vacío/);
  });

  it('makeBenchRecord copia los campos del protocolo desde el informe', () => {
    const report: AnalysisReport = {
      engine: 'ogs-core 0.1.0',
      results: [
        {
          method: 'bishop',
          fos: 0.98,
          status: 'converged',
          iterations: 5,
          lambda: null,
          surface: { xc: 1, yc: 2, r: 3 },
          slices: [],
          search: { evaluated: 4340, valid: 2510 },
          warnings: [],
        },
      ],
    };
    const record = makeBenchRecord({ method: 'bishop', caseId: 'V047a', ms: [5, 3, 4, 6, 2], report });
    expect(record).toEqual({
      target: BENCH_TARGET,
      engine: 'ogs-core 0.1.0',
      case: 'V047a',
      method: 'bishop',
      reps: 5,
      ms: [5, 3, 4, 6, 2],
      median_ms: 4,
      evaluated: 4340,
      valid: 2510,
      fos: 0.98,
    });
  });
});
