// Geometría 2D pura del lienzo (metros, mundo con y hacia arriba). Sin dependencias de React.

import type { ModelDoc } from '../types';
import type { Point } from '../../engine/types';

export interface SegmentProjection {
  /** Punto más cercano sobre el segmento. */
  point: Point;
  /** Parámetro t en [0, 1] a lo largo del segmento. */
  t: number;
  /** Distancia del punto consultado al segmento (misma unidad que la entrada). */
  distance: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Proyección de `p` sobre el segmento a-b (acotada a los extremos). Un segmento degenerado devuelve `a`. */
export function projectOnSegment(p: Point, a: Point, b: Point): SegmentProjection {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
    t = Math.min(1, Math.max(0, t));
  }
  const point: Point = [a[0] + t * dx, a[1] + t * dy];
  return { point, t, distance: distance(p, point) };
}

/** Punto en polígono por la regla par-impar. Los puntos sobre el borde cuentan según el rayo; no se usa para bordes. */
export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Ordenada máxima de la superficie del terreno (envolvente superior de las regiones) en x, o null si ninguna región la cubre. */
export function topY(doc: ModelDoc, x: number): number | null {
  let best: number | null = null;
  const consider = (y: number): void => {
    if (best === null || y > best) best = y;
  };
  for (const region of doc.regions) {
    const poly = region.polygon;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const lo = Math.min(a[0], b[0]);
      const hi = Math.max(a[0], b[0]);
      if (x < lo || x > hi) continue;
      if (hi === lo) {
        consider(a[1]);
        consider(b[1]);
      } else {
        consider(a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]));
      }
    }
  }
  return best;
}

/** Extensión x de todo el modelo (regiones), o null si no hay vértices. */
export function modelXRange(doc: ModelDoc): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of doc.regions) {
    for (const [x] of r.polygon) {
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
  }
  return Number.isFinite(lo) ? [lo, hi] : null;
}

export interface VertexRef {
  regionIndex: number;
  vertexIndex: number;
}

/** Vértices de cualquier región que coinciden (a `tol` m) con el indicado, incluido él mismo (primero). */
export function coincidentVertices(doc: ModelDoc, ref: VertexRef, tol = 1e-9): VertexRef[] {
  const origin = doc.regions[ref.regionIndex]?.polygon[ref.vertexIndex];
  if (!origin) return [];
  const out: VertexRef[] = [ref];
  doc.regions.forEach((region, regionIndex) => {
    region.polygon.forEach((v, vertexIndex) => {
      if (regionIndex === ref.regionIndex && vertexIndex === ref.vertexIndex) return;
      if (Math.abs(v[0] - origin[0]) <= tol && Math.abs(v[1] - origin[1]) <= tol) out.push({ regionIndex, vertexIndex });
    });
  });
  return out;
}

/** Redondea a la precisión útil para la escala (px/m): ~0,1 px, entre 2 y 6 decimales. */
export function roundForScale(v: number, scale: number): number {
  const decimals = Math.min(6, Math.max(2, Math.ceil(Math.log10(Math.max(scale, 1e-9))) + 1));
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

/** Puntos de la piezométrica del documento, o [] si no hay. */
export function piezoPoints(doc: ModelDoc): Point[] {
  return doc.water?.piezometric_line ?? [];
}
