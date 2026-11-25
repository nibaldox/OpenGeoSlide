// Ediciones puras de la piezométrica (x estrictamente creciente) y utilidades de vértices, compartidas por gestos y teclado.

import type { Point } from '../../engine/types';

/** Separación mínima en x entre puntos contiguos de la piezométrica (m). */
export const PIEZO_MIN_GAP = 1e-3;

/** Mueve el punto `index` acotando x para conservar el orden estricto. Devuelve null si el índice no existe. */
export function movePiezoPoint(points: readonly Point[], index: number, to: Point): Point[] | null {
  if (index < 0 || index >= points.length) return null;
  let x = to[0];
  if (index > 0) x = Math.max(x, points[index - 1][0] + PIEZO_MIN_GAP);
  if (index < points.length - 1) x = Math.min(x, points[index + 1][0] - PIEZO_MIN_GAP);
  return points.map((p, i): Point => (i === index ? [x, to[1]] : [p[0], p[1]]));
}

/** Inserta `at` tras `afterIndex`; null si rompería el orden estricto de x o el índice no es válido. */
export function insertPiezoPoint(points: readonly Point[], afterIndex: number, at: Point): Point[] | null {
  if (afterIndex < 0 || afterIndex >= points.length) return null;
  const prev = points[afterIndex];
  const next = points[afterIndex + 1];
  if (at[0] <= prev[0]) return null;
  if (next && at[0] >= next[0]) return null;
  const out = points.map((p): Point => [p[0], p[1]]);
  out.splice(afterIndex + 1, 0, [at[0], at[1]]);
  return out;
}

/** Quita el punto `index`; null si quedarían menos de 2 puntos o el índice no existe. */
export function removePiezoPoint(points: readonly Point[], index: number): Point[] | null {
  if (index < 0 || index >= points.length || points.length <= 2) return null;
  return points.filter((_, i) => i !== index).map((p): Point => [p[0], p[1]]);
}
