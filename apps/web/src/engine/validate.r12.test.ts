// R12 / W2, E15l-23 (B-12b): `isAnalysisReport` comprueba la forma de `tension_crack` del resultado: `x`, `depth` ≥ 0 y `water_force` ≥ 0, finitos.
import { describe, expect, it } from 'vitest';
import { isAnalysisReport } from './validate';

const SLICE = {
  x_left: 0, x_right: 1, y_base_left: 0, y_base_right: 0.1, y_top_mid: 2, width: 1, alpha: 0.1, base_length: 1.005, weight: 36, cohesion: 20,
  tan_phi: 0, pore_pressure: 0, material: 0, weight_extra: 0, h_force: 0, h_moment_base: 0, driving_extra: 0, y_centroid: 0,
};
const report = (crack?: unknown): unknown => ({
  engine: 'ogs-core 0.5.0',
  results: [
    { method: 'spencer', fos: 1.5, status: 'converged', iterations: 4, lambda: 0.1, surface: { xc: 1, yc: 2, r: 3 }, slices: [SLICE], search: null, warnings: [], ...(crack === undefined ? {} : { tension_crack: crack }) },
  ],
});

describe('isAnalysisReport con tension_crack', () => {
  it('acepta el resultado sin grieta y con la forma del contrato (incluida la grieta de profundidad 0 y seca)', () => {
    expect(isAnalysisReport(report())).toBe(true);
    expect(isAnalysisReport(report({ x: 32.1245, depth: 2, water_force: 19.62 }))).toBe(true);
    expect(isAnalysisReport(report({ x: -3, depth: 0, water_force: 0 }))).toBe(true);
  });

  it('rechaza una grieta que no es un objeto', () => {
    for (const bad of ['corrupt', 7, true, null, [1, 2, 3]]) expect(isAnalysisReport(report(bad)), JSON.stringify(bad)).toBe(false);
  });

  it('rechaza campos que faltan, que no son números o que no son finitos', () => {
    expect(isAnalysisReport(report({ x: 1, depth: 2 }))).toBe(false);
    expect(isAnalysisReport(report({ depth: 2, water_force: 1 }))).toBe(false);
    expect(isAnalysisReport(report({ x: '1', depth: 2, water_force: 1 }))).toBe(false);
    expect(isAnalysisReport(report({ x: Number.NaN, depth: 2, water_force: 1 }))).toBe(false);
    expect(isAnalysisReport(report({ x: 1, depth: Number.POSITIVE_INFINITY, water_force: 1 }))).toBe(false);
    expect(isAnalysisReport(report({ x: 1, depth: 2, water_force: Number.NEGATIVE_INFINITY }))).toBe(false);
  });

  it('rechaza depth o water_force negativos', () => {
    expect(isAnalysisReport(report({ x: 1, depth: -0.5, water_force: 1 }))).toBe(false);
    expect(isAnalysisReport(report({ x: 1, depth: 2, water_force: -1 }))).toBe(false);
  });
});
