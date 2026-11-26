import { describe, expect, it } from 'vitest';
import type { MethodReport } from '../engine/types';
import { INTERSLICE_LABEL, correctionFactorText, intersliceText, methodDetails, polylineSummary, surfaceSummary } from './methodInfo';

const base = { fos: 1.1, status: 'converged', iterations: 3, lambda: null, slices: [], search: null, warnings: [], surface: { xc: 1, yc: 2, r: 3 } } as const;
const rep = (o: Partial<MethodReport>): MethodReport => ({ method: 'bishop', ...base, ...o }) as MethodReport;

describe('nombres de las funciones de interfaz (F3.9)', () => {
  it('son los de la tabla de etiquetas del contrato', () => {
    expect(INTERSLICE_LABEL).toEqual({
      constant: 'Constante',
      half_sine: 'Medio seno',
      clipped_sine: 'Seno recortado (mín. 0,35)',
      trapezoidal: 'Trapezoidal (20 %-80 %)',
      data_points: 'Definida por puntos',
    });
  });
  it('intersliceText añade el número de puntos de data_points', () => {
    expect(intersliceText({ function: 'half_sine' })).toBe('Medio seno');
    expect(intersliceText({ function: 'data_points', points: [[0, 0], [0.5, 1], [1, 0]] })).toBe('Definida por puntos (3 puntos)');
    expect(intersliceText(undefined)).toBeNull();
  });
});

describe('detalles del método para tabla, CSV y PDF', () => {
  it('Morgenstern-Price: la función; Janbu corregido: f₀ y F₀ = FS / f₀', () => {
    expect(methodDetails(rep({ method: 'morgenstern_price', interslice: { function: 'clipped_sine' } }))).toEqual({ interslice: 'Seno recortado (mín. 0,35)' });
    const j = methodDetails(rep({ method: 'janbu_corrected', fos: 1.04, correction_factor: 1.04 / 0.96 }));
    expect(j.f0).toBeCloseTo(1.04 / 0.96, 12);
    expect(j.F0).toBeCloseTo(0.96, 12);
  });
  it('f₀ solo se muestra si el método convergió y es un número finito; F₀ no se inventa sin FS', () => {
    expect(methodDetails(rep({ method: 'janbu_corrected', status: 'not_converged', correction_factor: 1.05 }))).toEqual({});
    expect(methodDetails(rep({ method: 'janbu_corrected', fos: null, status: 'converged', correction_factor: 1.05 })).F0).toBeUndefined();
    expect(methodDetails(rep({ method: 'bishop' }))).toEqual({});
    expect(methodDetails(rep({ method: 'janbu_simplified', correction_factor: 1.2 }))).toEqual({});
  });
  it('f₀ con coma decimal y 3 decimales', () => {
    expect(correctionFactorText(1.04321)).toBe('1,043');
  });
});

describe('resumen de la superficie', () => {
  it('polilínea: «Polilínea (n puntos)»; círculo: null', () => {
    expect(polylineSummary(5)).toBe('Polilínea (5 puntos)');
    expect(polylineSummary(1)).toBe('Polilínea (1 punto)');
    expect(surfaceSummary({ points: [[0, 0], [1, 1], [2, 0]] })).toBe('Polilínea (3 puntos)');
    expect(surfaceSummary({ xc: 1, yc: 2, r: 3 })).toBeNull();
  });
});
