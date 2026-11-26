// `isAnalysisReport` con `reinforcement_forces` (v0.4, F4.9, E14m-4): se acepta antes de que el motor lo emita (riesgo G de X16).
import { describe, expect, it } from 'vitest';
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

const FORCE = { id: 'ancla-1', crossing: 0, x: 42.31, y: 28, station: 9.69, available: 100, fx: 100, fy: 0, application: 'active', status: 'applied' };

function report(extra: Record<string, unknown> = {}, slice: Record<string, unknown> = {}): unknown {
  return {
    engine: 'ogs-core 0.4.0',
    results: [
      {
        method: 'spencer',
        fos: 1.5,
        status: 'converged',
        iterations: 4,
        lambda: 0.1,
        surface: { xc: 1, yc: 2, r: 3 },
        slices: [{ ...SLICE, ...slice }],
        search: null,
        warnings: [],
        ...extra,
      },
    ],
  };
}

describe('isAnalysisReport con reinforcement_forces (v0.4)', () => {
  it('acepta un informe sin refuerzos y uno con la lista de fuerzas', () => {
    expect(isAnalysisReport(report())).toBe(true);
    expect(isAnalysisReport(report({ reinforcement_forces: [FORCE] }))).toBe(true);
    expect(isAnalysisReport(report({ reinforcement_forces: [] }))).toBe(true);
  });

  it('acepta los cuatro estados y las dos aplicaciones', () => {
    for (const status of ['applied', 'outside_mass', 'compression_ignored', 'no_capacity']) {
      for (const application of ['active', 'passive']) {
        expect(isAnalysisReport(report({ reinforcement_forces: [{ ...FORCE, status, application }] })), `${status} ${application}`).toBe(true);
      }
    }
  });

  it('acepta las dovelas con los campos pasivos opcionales', () => {
    expect(isAnalysisReport(report({}, { passive_v: 1, passive_h: 2, passive_h_moment_base: 3, passive_driving_extra: 4 }))).toBe(true);
  });

  it('rechaza una lista que no es lista, un estado desconocido y campos que faltan o no son finitos', () => {
    expect(isAnalysisReport(report({ reinforcement_forces: 'x' }))).toBe(false);
    expect(isAnalysisReport(report({ reinforcement_forces: [{ ...FORCE, status: 'ignored' }] }))).toBe(false);
    expect(isAnalysisReport(report({ reinforcement_forces: [{ ...FORCE, application: 'both' }] }))).toBe(false);
    expect(isAnalysisReport(report({ reinforcement_forces: [{ ...FORCE, id: 3 }] }))).toBe(false);
    for (const key of ['crossing', 'x', 'y', 'station', 'available', 'fx', 'fy']) {
      expect(isAnalysisReport(report({ reinforcement_forces: [{ ...FORCE, [key]: null }] })), key).toBe(false);
      expect(isAnalysisReport(report({ reinforcement_forces: [{ ...FORCE, [key]: undefined }] })), `${key} ausente`).toBe(false);
      expect(isAnalysisReport(report({ reinforcement_forces: [{ ...FORCE, [key]: Number.NaN }] })), `${key} NaN`).toBe(false);
    }
  });

  it('rechaza los campos pasivos de la dovela que no son números', () => {
    expect(isAnalysisReport(report({}, { passive_v: 'a' }))).toBe(false);
  });
});
