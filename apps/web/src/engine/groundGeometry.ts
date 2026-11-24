import type { Model, Point } from './types';

// Geometría del modelo (§1): envolventes superior e inferior y piezométrica.
// Las regiones se consultan con una regla de cruce (semiabierta), igual que un test punto-en-polígono.

export interface Interval {
  lo: number;
  hi: number;
  /** Índice en Model.regions. */
  region: number;
}

export function modelXRange(model: Model): [number, number] {
  let xmin = Infinity;
  let xmax = -Infinity;
  for (const region of model.regions) {
    for (const [x] of region.polygon) {
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
    }
  }
  if (!Number.isFinite(xmin) || !Number.isFinite(xmax)) {
    throw new Error('InvalidModel: no hay regiones con vértices');
  }
  return [xmin, xmax];
}

/**
 * Intervalos verticales de todas las regiones en la vertical `x`.
 * En los bordes del modelo se evalúa un poco hacia el interior para no perder el vértice extremo.
 */
export function verticalIntervals(model: Model, x: number): Interval[] {
  const [xmin, xmax] = modelXRange(model);
  const eps = 1e-9 * Math.max(xmax - xmin, 1);
  if (x < xmin - eps || x > xmax + eps) return [];
  const xx = x <= xmin + eps ? xmin + eps : x >= xmax - eps ? xmax - eps : x;

  const out: Interval[] = [];
  model.regions.forEach((region, ri) => {
    const ys: number[] = [];
    const pts: Point[] = region.polygon;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((x1 <= xx && xx < x2) || (x2 <= xx && xx < x1)) {
        ys.push(y1 + ((xx - x1) * (y2 - y1)) / (x2 - x1));
      }
    }
    ys.sort((a, b) => a - b);
    for (let k = 0; k + 1 < ys.length; k += 2) {
      if (ys[k + 1] > ys[k]) out.push({ lo: ys[k], hi: ys[k + 1], region: ri });
    }
  });
  return out;
}

/** Envolvente superior y_top(x), o null fuera del modelo. */
export function yTop(model: Model, x: number): number | null {
  const ints = verticalIntervals(model, x);
  if (ints.length === 0) return null;
  return Math.max(...ints.map((i) => i.hi));
}

/** Envolvente inferior y_bottom(x), o null fuera del modelo. */
export function yBottom(model: Model, x: number): number | null {
  const ints = verticalIntervals(model, x);
  if (ints.length === 0) return null;
  return Math.min(...ints.map((i) => i.lo));
}

/** Piezométrica interpolada linealmente; extrapolación constante fuera de rango. Null si no existe. */
export function piezoY(model: Model, x: number): number | null {
  const line = model.water?.piezometric_line;
  if (!line || line.length === 0) return null;
  const pts = [...line].sort((a, b) => a[0] - b[0]);
  if (x <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    if (x >= x1 && x <= x2) {
      return x2 === x1 ? y1 : y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
    }
  }
  return last[1];
}

export type Sliding = 'left_to_right' | 'right_to_left';

/** Resuelve la dirección de deslizamiento (§1, `auto`). */
export function resolveSliding(model: Model): Sliding {
  const dir = model.slope?.direction ?? 'auto';
  if (dir === 'left_to_right' || dir === 'right_to_left') return dir;
  const [xmin, xmax] = modelXRange(model);
  const yl = yTop(model, xmin);
  const yr = yTop(model, xmax);
  if (yl === null || yr === null) {
    throw new Error('InvalidModel: no se puede resolver la dirección del talud');
  }
  return yl > yr ? 'left_to_right' : 'right_to_left';
}
