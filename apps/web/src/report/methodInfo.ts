// Textos de la superficie del informe, la función de interfaz de Morgenstern-Price y el factor de Janbu (F3.5, F3.7, F3.9).
// Los comparten la tabla de resultados, el CSV y el PDF, para que digan lo mismo. Puro: sin React ni DOM.

import { isPolylineReport } from '../engine/surface';
import type { IntersliceFunction, IntersliceSpec, MethodReport, Point, ReportSurface } from '../engine/types';

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
  if (r.method === 'janbu_corrected' && r.status === 'converged' && typeof r.correction_factor === 'number' && Number.isFinite(r.correction_factor)) {
    // R10B-01: f₀ se muestra siempre que sea finito. Ocultar un f₀ ≤ 0 escondía justo el factor responsable de un FS absurdo.
    out.f0 = r.correction_factor;
    if (typeof r.fos === 'number' && Number.isFinite(r.fos)) {
      const base = r.fos / r.correction_factor;
      if (Number.isFinite(base)) out.F0 = base;
    }
  }
  return out;
}

/** Recorta una polilínea (x creciente) al intervalo [xmin, xmax], interpolando en los extremos. */
export function clipPolylineX(points: Point[], xmin: number, xmax: number): Point[] {
  const out: Point[] = [];
  const yAt = (a: Point, b: Point, x: number): number => (b[0] === a[0] ? a[1] : a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    if (Math.max(a[0], b[0]) < xmin || Math.min(a[0], b[0]) > xmax) continue;
    const p0: Point = a[0] < xmin ? [xmin, yAt(a, b, xmin)] : a;
    const p1: Point = b[0] > xmax ? [xmax, yAt(a, b, xmax)] : b;
    if (out.length === 0) out.push(p0);
    out.push(p1);
  }
  return out;
}

/**
 * Polilínea que el resultado **analizó** (R10B-05, E13l-7): la polilínea ajustada del informe limitada al rango de x de las
 * dovelas, como el trazo de un círculo. Cuando la masa se trunca (`truncated_driving_mass`) el motor solo evalúa un bloque y
 * la polilínea completa sería una falla más larga que la analizada. Con el rango cubierto (salvo ruido de coma flotante) o
 * sin dovelas devuelve los puntos del informe tal cual; `null` si la superficie es un círculo.
 */
export function analyzedPolyline(r: Pick<MethodReport, 'surface' | 'slices'>): Point[] | null {
  if (!isPolylineReport(r.surface)) return null;
  const pts = r.surface.points.map((p): Point => [p[0], p[1]]);
  if (pts.length < 2 || r.slices.length === 0) return pts;
  let xmin = Infinity;
  let xmax = -Infinity;
  for (const s of r.slices) {
    xmin = Math.min(xmin, s.x_left);
    xmax = Math.max(xmax, s.x_right);
  }
  const first = (pts[0] as Point)[0];
  const last = (pts[pts.length - 1] as Point)[0];
  const eps = 1e-9 * Math.max(1, Math.abs(last - first));
  if (xmin <= first + eps && xmax >= last - eps) return pts;
  const clipped = clipPolylineX(pts, Math.max(xmin, first), Math.min(xmax, last));
  return clipped.length >= 2 ? clipped : pts;
}

/** «Polilínea (5 puntos)». */
export function polylineSummary(n: number): string {
  return `Polilínea (${plural(n, 'punto', 'puntos')})`;
}

/** Resumen de una superficie polilínea del informe; null si es un círculo (que se describe con centro y radio). */
export function surfaceSummary(surface: ReportSurface): string | null {
  return isPolylineReport(surface) ? polylineSummary(surface.points.length) : null;
}

/** Como `surfaceSummary`, pero cuenta los puntos de la polilínea **analizada** (los que se dibujan y se exportan). */
export function resultSurfaceSummary(r: Pick<MethodReport, 'surface' | 'slices'>): string | null {
  const pts = analyzedPolyline(r);
  return pts ? polylineSummary(pts.length) : null;
}
