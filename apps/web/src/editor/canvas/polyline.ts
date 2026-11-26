// Ediciones puras de la polilínea fija de falla (F3.3): x estrictamente creciente, al menos 2 puntos.
// Las comparten el puntero (gesture.ts) y el teclado (keys.ts). Sin React ni DOM.

import type { Point } from '../../engine/types';

/** Separación mínima en x entre puntos contiguos de la polilínea (m). El motor exige 1e-9·ancho; el editor es más conservador, como en la piezométrica. */
export const POLYLINE_MIN_GAP = 1e-3;

/**
 * Separación mínima de x que usan el lienzo y el teclado en un modelo de ancho `width` (R10B-04d): la fija de 1e-3 o, si es mayor, el doble de la que
 * exige el motor (`1e-9·ancho`; el doble deja margen al redondeo de los números). Sin ella, en un modelo de millones de unidades de ancho
 * el lienzo producía puntos que el motor rechaza.
 */
export function polylineMinGap(width: number): number {
  return Number.isFinite(width) && width > 0 ? Math.max(POLYLINE_MIN_GAP, 2e-9 * width) : POLYLINE_MIN_GAP;
}

/** Ancho en x del modelo (de todas las regiones), para `polylineMinGap`; 0 si no hay vértices. */
export function modelWidth(regions: ReadonlyArray<{ polygon: ReadonlyArray<readonly [number, number]> }>): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of regions) {
    for (const p of r.polygon) {
      if (Number.isFinite(p[0])) {
        lo = Math.min(lo, p[0]);
        hi = Math.max(hi, p[0]);
      }
    }
  }
  return hi > lo ? hi - lo : 0;
}

/** Mínimo de puntos de una polilínea de falla (F3.3). */
export const POLYLINE_MIN_POINTS = 2;

function clean(v: number): number {
  return Number(v.toPrecision(12));
}

/** Aviso (visible y para el lector de pantalla) cuando la x de un punto se acota para no cruzar a su vecino. */
export function polylineCrossingMessage(): string {
  return 'La x de un punto de la polilínea no puede cruzar la de su vecino: se dejó junto a ella';
}

/**
 * Mueve el punto `index` a `to`, acotando la x entre las de sus vecinos para conservar el orden estricto. `clamped` indica
 * que hubo que acotar (el llamador avisa). Devuelve null si el índice no existe.
 */
export function movePolylineVertex(points: readonly Point[], index: number, to: Point, minGap: number = POLYLINE_MIN_GAP): { points: Point[]; clamped: boolean } | null {
  if (index < 0 || index >= points.length) return null;
  const lo = index > 0 ? points[index - 1]![0] + minGap : -Infinity;
  const hi = index < points.length - 1 ? points[index + 1]![0] - minGap : Infinity;
  let x = to[0];
  let clamped = false;
  if (lo > hi) {
    // Sin espacio entre los vecinos: la x no se mueve.
    x = points[index]![0];
    clamped = true;
  } else if (x < lo) {
    x = lo;
    clamped = true;
  } else if (x > hi) {
    x = hi;
    clamped = true;
  }
  const out = points.map((p, i): Point => (i === index ? [clean(x), to[1]] : [p[0], p[1]]));
  return { points: out, clamped };
}

/**
 * Inserta un punto en el centro de un tramo, sin cambiar la forma. Con un tramo siguiente (`index` < último) lo hace entre
 * `index` e `index + 1` y el nuevo punto es `index + 1`; en el último punto usa el tramo anterior y el nuevo ocupa su lugar
 * (`index`). Null si no hay tramo o es demasiado corto para separar la x en dos veces el mínimo.
 */
export function insertPolylineVertex(points: readonly Point[], index: number, minGap: number = POLYLINE_MIN_GAP): { points: Point[]; index: number } | null {
  if (points.length < POLYLINE_MIN_POINTS || index < 0 || index >= points.length) return null;
  const after = index < points.length - 1 ? index : index - 1;
  const a = points[after]!;
  const b = points[after + 1]!;
  if (b[0] - a[0] < 2 * minGap) return null;
  const at: Point = [clean((a[0] + b[0]) / 2), clean((a[1] + b[1]) / 2)];
  const out = points.map((p): Point => [p[0], p[1]]);
  out.splice(after + 1, 0, at);
  return { points: out, index: after + 1 };
}

/** Quita el punto `index`; null si quedarían menos de 2 o el índice no existe. */
export function removePolylineVertex(points: readonly Point[], index: number): Point[] | null {
  if (index < 0 || index >= points.length || points.length <= POLYLINE_MIN_POINTS) return null;
  return points.filter((_, i) => i !== index).map((p): Point => [p[0], p[1]]);
}
