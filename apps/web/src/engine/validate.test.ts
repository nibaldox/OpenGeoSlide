import { describe, expect, it } from 'vitest';
import type { MethodKind } from './types';
import { isAnalysisReport } from './validate';

const SLICE = {
  x_left: 0,
  x_right: 1,
  y_base_left: 0,
  y_base_right: 0.1,
  y_top_mid: 2,
  width: 1,
  alpha: 0.1,
  base_length: 1.005,
  weight: 36,
  cohesion: 20,
  tan_phi: 0,
  pore_pressure: 0,
  material: 0,
  weight_extra: 0,
  h_force: 0,
  h_moment_base: 0,
  driving_extra: 0,
  y_centroid: 0,
};

function report(over: Record<string, unknown> = {}): unknown {
  return {
    engine: 'ogs-core 0.3.0',
    results: [
      {
        method: 'bishop',
        fos: 1.5,
        status: 'converged',
        iterations: 4,
        lambda: null,
        surface: { xc: 1, yc: 2, r: 3 },
        slices: [SLICE],
        search: null,
        warnings: [],
        ...over,
      },
    ],
  };
}

describe('isAnalysisReport (v0.3)', () => {
  it('sigue aceptando el informe de círculo', () => {
    expect(isAnalysisReport(report())).toBe(true);
  });

  it('acepta una superficie polilínea {points}', () => {
    const points = [
      [30, 25],
      [40, 26.9],
      [51.3, 35],
    ];
    expect(isAnalysisReport(report({ method: 'spencer', surface: { points }, lambda: 0.2 }))).toBe(true);
  });

  it('acepta los métodos nuevos, con correction_factor e interslice opcionales', () => {
    const methods: MethodKind[] = ['morgenstern_price', 'janbu_simplified', 'janbu_corrected'];
    for (const method of methods) {
      expect(isAnalysisReport(report({ method }))).toBe(true);
    }
    expect(isAnalysisReport(report({ method: 'janbu_corrected', correction_factor: 1.05 }))).toBe(true);
    expect(
      isAnalysisReport(
        report({
          method: 'morgenstern_price',
          interslice: {
            function: 'data_points',
            points: [
              [0, 0],
              [0.5, 1],
              [1, 0],
            ],
          },
        }),
      ),
    ).toBe(true);
    expect(isAnalysisReport(report({ method: 'morgenstern_price', interslice: { function: 'half_sine' } }))).toBe(
      true,
    );
  });

  it('rechaza lo malformado: método desconocido, polilínea sin puntos válidos, extras mal tipados', () => {
    expect(isAnalysisReport(report({ method: 'fellenius' }))).toBe(false);
    expect(isAnalysisReport(report({ surface: { points: [] } }))).toBe(false);
    expect(isAnalysisReport(report({ surface: { points: [[1, 2], [3]] } }))).toBe(false);
    expect(isAnalysisReport(report({ surface: { points: [[1, 2], [Number.NaN, 3]] } }))).toBe(false);
    expect(isAnalysisReport(report({ surface: { points: 'x' } }))).toBe(false);
    expect(isAnalysisReport(report({ surface: { xc: 1, yc: 2 } }))).toBe(false);
    expect(isAnalysisReport(report({ surface: null }))).toBe(false);
    expect(isAnalysisReport(report({ method: 'janbu_corrected', correction_factor: 'x' }))).toBe(false);
    expect(isAnalysisReport(report({ method: 'morgenstern_price', interslice: { function: 3 } }))).toBe(false);
    expect(
      isAnalysisReport(report({ method: 'morgenstern_price', interslice: { function: 'data_points', points: [[0]] } })),
    ).toBe(false);
  });
});
