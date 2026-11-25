// Geometría 2D para la validación local de regiones (semántica E12c, briefs/01_CONTRATOS_FASE1.md §F1.3).
//
// Todas las funciones usan una tolerancia absoluta `tol` (= 1e-9 · escala del modelo). Permitidos: aristas
// compartidas, tramos colineales compartidos y uniones en T. Son solape: cruce propio de aristas, un vértice
// estrictamente dentro de la otra región y polígonos iguales (aquí generalizado: dos fronteras que se contienen
// mutuamente, y un punto de la frontera de una región estrictamente dentro de la otra).

import type { Point } from '../../engine/types';

export type PointClass = 'inside' | 'boundary' | 'outside';

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function orient(a: Point, b: Point, c: Point): number {
  return cross(b[0] - a[0], b[1] - a[1], c[0] - a[0], c[1] - a[1]);
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Parámetro t ∈ [0, 1] de la proyección de p sobre el segmento ab. */
function projectParam(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  return Math.min(1, Math.max(0, t));
}

export function distPointSegment(p: Point, a: Point, b: Point): number {
  const t = projectParam(p, a, b);
  return Math.hypot(p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1])));
}

/** Distancia con signo de c a la recta ab (positiva a la izquierda). 0 si ab es degenerado. */
function signedDist(a: Point, b: Point, c: Point): number {
  const len = distance(a, b);
  return len === 0 ? 0 : orient(a, b, c) / len;
}

/**
 * Cruce propio: los interiores de ab y cd se cortan en un punto y no son colineales. Los extremos que tocan
 * (a menos de `tol`) la otra recta no cuentan (eso es un contacto o una unión en T).
 */
export function properCross(a: Point, b: Point, c: Point, d: Point, tol: number): boolean {
  if (distance(a, b) <= tol || distance(c, d) <= tol) return false;
  const sc = signedDist(a, b, c);
  const sd = signedDist(a, b, d);
  const sa = signedDist(c, d, a);
  const sb = signedDist(c, d, b);
  return ((sc > tol && sd < -tol) || (sc < -tol && sd > tol)) && ((sa > tol && sb < -tol) || (sa < -tol && sb > tol));
}

/** Los segmentos se tocan o se cruzan (distancia mínima ≤ tol). */
export function segmentsTouch(a: Point, b: Point, c: Point, d: Point, tol: number): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  return (
    distPointSegment(a, c, d) <= tol ||
    distPointSegment(b, c, d) <= tol ||
    distPointSegment(c, a, b) <= tol ||
    distPointSegment(d, a, b) <= tol
  );
}

/** Quita vértices consecutivos repetidos (incluido el último frente al primero). Devuelve los índices originales. */
export function dedupeConsecutive(poly: readonly Point[], tol: number): { points: Point[]; indices: number[] } {
  const points: Point[] = [];
  const indices: number[] = [];
  poly.forEach((p, i) => {
    const prev = points[points.length - 1];
    if (prev === undefined || distance(prev, p) > tol) {
      points.push(p);
      indices.push(i);
    }
  });
  while (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first !== undefined && last !== undefined && distance(first, last) <= tol) {
      points.pop();
      indices.pop();
    } else break;
  }
  return { points, indices };
}

export interface SelfIntersection {
  /** Índices (base 0) de las dos aristas implicadas; la arista i va del vértice i al (i+1) mod n. */
  edgeA: number;
  edgeB: number;
  kind: 'cross' | 'spike';
}

/**
 * Auto-intersección de un polígono (n ≥ 3): dos aristas no adyacentes que se tocan o se cruzan, o dos aristas
 * adyacentes colineales que se superponen (espiga). Devuelve la primera pareja encontrada.
 */
export function findSelfIntersection(poly: readonly Point[], tol: number): SelfIntersection | null {
  const n = poly.length;
  if (n < 3) return null;
  const at = (i: number): Point => poly[((i % n) + n) % n] as Point;
  for (let i = 0; i < n; i += 1) {
    const prev = at(i - 1);
    const cur = at(i);
    const next = at(i + 1);
    const ax = prev[0] - cur[0];
    const ay = prev[1] - cur[1];
    const bx = next[0] - cur[0];
    const by = next[1] - cur[1];
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (Math.abs(cross(ax, ay, bx, by)) <= tol * Math.min(la, lb) && ax * bx + ay * by > 0) {
      return { edgeA: (i - 1 + n) % n, edgeB: i, kind: 'spike' };
    }
  }
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue; // adyacentes por el cierre del polígono
      if (segmentsTouch(at(i), at(i + 1), at(j), at(j + 1), tol)) return { edgeA: i, edgeB: j, kind: 'cross' };
    }
  }
  return null;
}

/** Clasifica p frente a un polígono: sobre la frontera (≤ tol), dentro (par-impar) o fuera. */
export function classifyPoint(p: Point, poly: readonly Point[], tol: number): PointClass {
  const n = poly.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const a = poly[i] as Point;
    const b = poly[j] as Point;
    if (distPointSegment(p, a, b) <= tol) return 'boundary';
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}

export interface Bounds2 {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function boundsOf(points: readonly Point[]): Bounds2 {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  return { minX, maxX, minY, maxY };
}

function boundsDisjoint(a: Bounds2, b: Bounds2, tol: number): boolean {
  return a.maxX < b.minX - tol || b.maxX < a.minX - tol || a.maxY < b.minY - tol || b.maxY < a.minY - tol;
}

/**
 * Clasifica los puntos medios de los sub-tramos de la frontera de `a` (cortada por la frontera de `b`) frente a `b`.
 */
function boundaryProbe(a: readonly Point[], b: readonly Point[], tol: number): { inside: boolean; outside: boolean; count: number } {
  let inside = false;
  let outside = false;
  let count = 0;
  const na = a.length;
  const nb = b.length;
  for (let i = 0; i < na; i += 1) {
    const p = a[i] as Point;
    const q = a[(i + 1) % na] as Point;
    const len = distance(p, q);
    if (len <= tol) continue;
    const ts = [0, 1];
    for (let k = 0; k < nb; k += 1) {
      const c = b[k] as Point;
      const d = b[(k + 1) % nb] as Point;
      if (distPointSegment(c, p, q) <= tol) ts.push(projectParam(c, p, q));
      if (properCross(p, q, c, d, tol)) {
        const denom = cross(q[0] - p[0], q[1] - p[1], d[0] - c[0], d[1] - c[1]);
        if (denom !== 0) ts.push(cross(c[0] - p[0], c[1] - p[1], d[0] - c[0], d[1] - c[1]) / denom);
      }
    }
    ts.sort((x, y) => x - y);
    for (let k = 0; k + 1 < ts.length; k += 1) {
      const t0 = ts[k] as number;
      const t1 = ts[k + 1] as number;
      if ((t1 - t0) * len <= 2 * tol) continue;
      const tm = (t0 + t1) / 2;
      const m: Point = [p[0] + tm * (q[0] - p[0]), p[1] + tm * (q[1] - p[1])];
      const cls = classifyPoint(m, b, tol);
      count += 1;
      if (cls === 'inside') inside = true;
      else if (cls === 'outside') outside = true;
    }
  }
  return { inside, outside, count };
}

/** Solape entre dos polígonos simples (ya sin vértices repetidos). Las aristas compartidas y las uniones en T son válidas. */
export function polygonsOverlap(a: readonly Point[], b: readonly Point[], tol: number): boolean {
  if (boundsDisjoint(boundsOf(a), boundsOf(b), tol)) return false;
  const na = a.length;
  const nb = b.length;
  for (let i = 0; i < na; i += 1) {
    for (let k = 0; k < nb; k += 1) {
      if (properCross(a[i] as Point, a[(i + 1) % na] as Point, b[k] as Point, b[(k + 1) % nb] as Point, tol)) return true;
    }
  }
  if (a.some((p) => classifyPoint(p, b, tol) === 'inside')) return true;
  if (b.some((p) => classifyPoint(p, a, tol) === 'inside')) return true;
  const ab = boundaryProbe(a, b, tol);
  const ba = boundaryProbe(b, a, tol);
  if (ab.inside || ba.inside) return true;
  // Fronteras contenidas una en la otra: polígonos iguales (cualquier orden, orientación o vértices colineales extra).
  return ab.count > 0 && ba.count > 0 && !ab.outside && !ba.outside;
}
