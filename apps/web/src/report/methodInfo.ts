// Textos de la superficie del informe, la función de interfaz de Morgenstern-Price y el factor de Janbu (F3.5, F3.7, F3.9).
// Los comparten la tabla de resultados, el CSV y el PDF, para que digan lo mismo. Puro: sin React ni DOM.

import { isPolylineReport } from '../engine/surface';
import type { IntersliceFunction, IntersliceSpec, MethodReport, ReportSurface } from '../engine/types';

/** Nombres de las funciones de interfaz, fijos por F3.9. */
export const INTERSLICE_LABEL: Record<IntersliceFunction, string> = {
  constant: 'Constante',
  half_sine: 'Medio seno',
  clipped_sine: 'Seno recortado (mín. 0,35)',
  trapezoidal: 'Trapezoidal (20 %-80 %)',
  data_points: 'Definida por puntos',
};

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** «Medio seno», o «Definida por puntos (3 puntos)»; null si el informe no trae función. */
export function intersliceText(spec: IntersliceSpec | undefined | null): string | null {
  if (!spec) return null;
  const label = INTERSLICE_LABEL[spec.function] ?? spec.function;
  return spec.function === 'data_points' && spec.points ? `${label} (${plural(spec.points.length, 'punto', 'puntos')})` : label;
}

/** `f₀` con coma decimal y 3 decimales. */
export function correctionFactorText(f0: number): string {
  return f0.toFixed(3).replace('.', ',');
}

export interface MethodDetails {
  /** Función de fuerzas entre dovelas (Morgenstern-Price). */
  interslice?: string;
  /** Factor de corrección de Janbu (solo `janbu_corrected` convergido). */
  f0?: number;
  /** F₀ = FS / f₀, el FS de Janbu simplificado que sirve de base al corregido. */
  F0?: number;
}

/** Lo que el informe dice del método más allá del FS: la función de M-P y f₀ de Janbu corregido. Un método sin convergencia no muestra f₀. */
export function methodDetails(r: MethodReport): MethodDetails {
  const out: MethodDetails = {};
  if (r.method === 'morgenstern_price') {
    const text = intersliceText(r.interslice);
    if (text) out.interslice = text;
  }
  if (r.method === 'janbu_corrected' && r.status === 'converged' && typeof r.correction_factor === 'number' && Number.isFinite(r.correction_factor) && r.correction_factor > 0) {
    out.f0 = r.correction_factor;
    if (typeof r.fos === 'number' && Number.isFinite(r.fos)) out.F0 = r.fos / r.correction_factor;
  }
  return out;
}

/** «Polilínea (5 puntos)». */
export function polylineSummary(n: number): string {
  return `Polilínea (${plural(n, 'punto', 'puntos')})`;
}

/** Resumen de una superficie polilínea del informe; null si es un círculo (que se describe con centro y radio). */
export function surfaceSummary(surface: ReportSurface): string | null {
  return isPolylineReport(surface) ? polylineSummary(surface.points.length) : null;
}
