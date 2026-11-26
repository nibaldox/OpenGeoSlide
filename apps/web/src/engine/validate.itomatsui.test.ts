// `isAnalysisReport` con los campos de Ito-Matsui de `reinforcement_forces` (E15i-7): `soil_force`, `governs` y `arm` son opcionales, y si
// vienen, de la forma del contrato.
import { describe, expect, it } from 'vitest';
import { isAnalysisReport } from './validate';

const SLICE = {
  x_left: 0, x_right: 1, y_base_left: 0, y_base_right: 0.1, y_top_mid: 2, width: 1, alpha: 0.1, base_length: 1.005, weight: 36, cohesion: 20,
  tan_phi: 0, pore_pressure: 0, material: 0, weight_extra: 0, h_force: 0, h_moment_base: 0, driving_extra: 0, y_centroid: 0,
};
const FORCE = { id: 'p1', crossing: 0, x: 17.5, y: 1.86, station: 3.1, available: 117.8, fx: 117.8, fy: 0, application: 'passive', status: 'applied' };

const report = (force: Record<string, unknown>): unknown => ({
  engine: 'ogs-core 0.5.0',
  results: [
    { method: 'spencer', fos: 1.5, status: 'converged', iterations: 4, lambda: 0.1, surface: { xc: 1, yc: 2, r: 3 }, slices: [SLICE], search: null, warnings: [], reinforcement_forces: [{ ...FORCE, ...force }] },
  ],
});

describe('isAnalysisReport con soil_force, governs y arm', () => {
  it('acepta una fuerza sin los campos (pilote con force) y con ellos (pilote con presión del suelo)', () => {
    expect(isAnalysisReport(report({}))).toBe(true);
    expect(isAnalysisReport(report({ soil_force: 282.77, governs: 'soil', arm: 1.2235 }))).toBe(true);
    for (const governs of ['soil', 'shear', 'bending']) expect(isAnalysisReport(report({ soil_force: 1, governs, arm: 1 })), governs).toBe(true);
  });

  it('rechaza un governs desconocido y soil_force o arm no numéricos o no finitos', () => {
    expect(isAnalysisReport(report({ governs: 'given' }))).toBe(false);
    expect(isAnalysisReport(report({ soil_force: '282' }))).toBe(false);
    expect(isAnalysisReport(report({ arm: Number.NaN }))).toBe(false);
    expect(isAnalysisReport(report({ soil_force: Number.POSITIVE_INFINITY }))).toBe(false);
  });
});
