// Tramo extrapolado de la piezométrica (R9-05d). El motor no la termina donde acaba la línea: fuera de su rango de x usa el valor del
// extremo más cercano, es decir, la prolonga en horizontal hasta los bordes del modelo (`PreparedModel::piezometric_y`,
// crates/ogs-core/src/geometry.rs:621-627; x_min y x_max son los de los vértices de todas las regiones, geometry.rs:533-557).
// El lienzo la dibuja con otro trazo para que no parezca que el agua termina en el último punto. Módulo puro.

import type { Point } from '../../engine/types';
import type { ModelDoc } from '../types';
import { piezoPoints } from './geom';

/** Un tramo horizontal: de `[x, y]` a `[x, y]`, en coordenadas del mundo. */
export type Segment = readonly [Point, Point];

export interface PiezoExtension {
  /** Del borde izquierdo del modelo al primer punto de la línea; `null` si la línea ya llega al borde. */
  left: Segment | null;
  /** Del último punto de la línea al borde derecho del modelo; `null` si ya llega. */
  right: Segment | null;
}

/** `[x_min, x_max]` de los vértices de todas las regiones (como el motor); `null` sin vértices finitos. */
export function modelXRange(doc: ModelDoc): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const region of doc.regions) {
    for (const p of region.polygon) {
      if (!Number.isFinite(p[0])) continue;
      if (p[0] < lo) lo = p[0];
      if (p[0] > hi) hi = p[0];
    }
  }
  return lo <= hi ? [lo, hi] : null;
}

/** Tramos que el motor extrapola a cada lado de la piezométrica, o `null` si no hay línea (≥ 2 puntos) o ya cubre todo el ancho. */
export function piezoExtension(doc: ModelDoc): PiezoExtension | null {
  const line = piezoPoints(doc);
  if (line.length < 2) return null;
  const range = modelXRange(doc);
  if (range === null) return null;
  const [xMin, xMax] = range;
  const first = line[0] as Point;
  const last = line[line.length - 1] as Point;
  // Tolerancia relativa al ancho del modelo: una diferencia de redondeo no es un tramo.
  const tol = 1e-9 * Math.max(xMax - xMin, 1);
  const left: Segment | null = Number.isFinite(first[0]) && first[0] - xMin > tol ? [[xMin, first[1]], first] : null;
  const right: Segment | null = Number.isFinite(last[0]) && xMax - last[0] > tol ? [last, [xMax, last[1]]] : null;
  return left === null && right === null ? null : { left, right };
}
