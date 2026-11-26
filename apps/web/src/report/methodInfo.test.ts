import { describe, expect, it } from 'vitest';
import type { MethodReport } from '../engine/types';
import { INTERSLICE_LABEL, analyzedPolyline, clipPolylineX, correctionFactorText, intersliceText, methodDetails, polylineSummary, surfaceSummary } from './methodInfo';

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

describe('f₀ visible (R10B-01, parte web)', () => {
  it('se muestra siempre que sea finito: también un valor menor que 1 o no positivo, que ya no se oculta', () => {
    for (const f0 of [1.048, 1, 0.516, 0, -0.101243]) {
      const d = methodDetails(rep({ method: 'janbu_corrected', fos: 1.2, correction_factor: f0 }));
      expect(d.f0, String(f0)).toBe(f0);
    }
    expect(methodDetails(rep({ method: 'janbu_corrected', fos: -0.752333, correction_factor: -0.101243 })).f0).toBe(-0.101243);
  });
  it('un f₀ no finito no se muestra, y F₀ = FS / f₀ solo si es finito', () => {
    expect(methodDetails(rep({ method: 'janbu_corrected', correction_factor: Number.NaN })).f0).toBeUndefined();
    expect(methodDetails(rep({ method: 'janbu_corrected', correction_factor: Number.POSITIVE_INFINITY })).f0).toBeUndefined();
    const z = methodDetails(rep({ method: 'janbu_corrected', fos: 1.2, correction_factor: 0 }));
    expect(z.f0).toBe(0);
    expect(z.F0).toBeUndefined();
  });
});

describe('polilínea analizada (R10B-05)', () => {
  const slice = (xl: number, xr: number) => ({ x_left: xl, x_right: xr, y_base_left: 0, y_base_right: 0 }) as MethodReport['slices'][number];
  const full = [[5, 15], [12, 6], [35, 6], [42, 3]] as [number, number][];
  it('recorta la polilínea al rango de las dovelas, interpolando en el extremo', () => {
    const r = rep({ surface: { points: full }, slices: [slice(5, 10), slice(10, 15)] });
    expect(analyzedPolyline(r)).toEqual([[5, 15], [12, 6], [15, 6]]);
  });
  it('si las dovelas cubren la polilínea, o ya está recortada, no la toca (ni siquiera con ruido de coma flotante)', () => {
    const r = rep({ surface: { points: full }, slices: [slice(5 + 1e-14, 20), slice(20, 42 - 1e-14)] });
    expect(analyzedPolyline(r)).toEqual(full);
    expect(analyzedPolyline(rep({ surface: { points: full }, slices: [] }))).toEqual(full);
  });
  it('un círculo no tiene polilínea', () => {
    expect(analyzedPolyline(rep({}))).toBeNull();
  });
  it('clipPolylineX no repite el punto cuando un vértice cae justo en el límite', () => {
    expect(clipPolylineX([[0, 0], [5, 5], [10, 0]], 0, 5)).toEqual([[0, 0], [5, 5]]);
    expect(clipPolylineX([[0, 0], [5, 5], [10, 0]], 5, 10)).toEqual([[5, 5], [10, 0]]);
  });
  it('clipPolylineX interpola en ambos extremos', () => {
    expect(clipPolylineX([[0, 0], [10, 10]], 2, 8)).toEqual([[2, 2], [8, 8]]);
  });
});
