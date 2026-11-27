// E15m-15 (R13): `tension_crack.face_height` opcional en el informe del motor. `isAnalysisReport` lo acepta ausente o finito y ≥ 0, y rechaza el
// negativo, el no finito y el no numérico.
import { describe, expect, it } from 'vitest';
import { isAnalysisReport } from './validate';

const SLICE = {
  x_left: 0, x_right: 1, y_base_left: 0, y_base_right: 0.1, y_top_mid: 2, width: 1, alpha: 0.1, base_length: 1.005, weight: 36, cohesion: 20,
  tan_phi: 0, pore_pressure: 0, material: 0, weight_extra: 0, h_force: 0, h_moment_base: 0, driving_extra: 0, y_centroid: 0,
};
const report = (crack: unknown): unknown => ({
  engine: 'ogs-core 0.5.0',
  results: [{ method: 'bishop', fos: 1.1, status: 'converged', iterations: 4, lambda: null, surface: { xc: 1, yc: 2, r: 3 }, slices: [SLICE], search: null, warnings: [], tension_crack: crack }],
});

describe('isAnalysisReport con tension_crack.face_height (E15m-15)', () => {
  it('lo acepta ausente, 0 y positivo, con profundidad 0 o mayor', () => {
    expect(isAnalysisReport(report({ x: -42.4, depth: 0, water_force: 0, face_height: 1.7827 }))).toBe(true);
    expect(isAnalysisReport(report({ x: 12, depth: 2.616, water_force: 34, face_height: 4.9707 }))).toBe(true);
    expect(isAnalysisReport(report({ x: 12, depth: 2.616, water_force: 34, face_height: 0 }))).toBe(true);
    expect(isAnalysisReport(report({ x: 12, depth: 2.616, water_force: 34 }))).toBe(true);
  });
  it('rechaza un face_height negativo, no finito o no numérico', () => {
    const base = { x: 12, depth: 2, water_force: 3 };
    for (const bad of [-0.001, -5, Number.NaN, Infinity, -Infinity, '1.5', null, true, [1], {}]) {
      expect(isAnalysisReport(report({ ...base, face_height: bad })), String(bad)).toBe(false);
    }
  });
});
