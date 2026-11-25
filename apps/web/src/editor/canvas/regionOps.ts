// Operaciones geométricas puras sobre regiones: dividir una región con una polilínea (`splitRegion`) y vértices compartidos con las
// regiones vecinas (`sharedInsertions`). Sin React ni DOM. Metros, mundo con y hacia arriba.
//
//   dividir:  una polilínea que entra y sale del borde de una región la parte en dos, con los dos puntos de corte como vértices
//             compartidos. La línea puede empezar y terminar sobre el borde, o fuera de la región (solo cuenta el tramo de dentro).
//   vecinas:  un vértice que cae en medio de una arista de otra región se inserta también en esa región, para que los estratos
//             compartan el límite sin hueco ni solape (`vertex/insert` por cada punto).

import type { Point } from '../../engine/types';
import { boundsOf, classifyPoint, distPointSegment, findSelfIntersection, normalizedArea, properCross, segmentsTouch } from '../state/polygonChecks';
import type { ModelDoc } from '../types';
import type { CanvasAction } from './gesture';

/** Por qué una línea no divide la región. */
export type SplitFailure = 'too_short' | 'few_hits' | 'many_hits' | 'on_boundary' | 'same_point' | 'self_intersect' | 'outside' | 'degenerate';

export interface BoundaryHit {
  point: Point;
  /** Vértice de la región en el que cae el corte, o `null` si cae en medio de una arista. */
  vertex: number | null;
  /** Arista (vértice anterior) en la que cae el corte, o `null` si cae en un vértice. */
  edge: number | null;
}

export type SplitResult =
  | {
      ok: true;
      /** Parte que conserva la región (la de arriba: centroide más alto; a igual altura, la de la izquierda). */
      kept: Point[];
      /** Parte nueva (la de abajo, o la de la derecha). */
      added: Point[];
      entry: BoundaryHit;
      exit: BoundaryHit;
      /** Tramo interior de la línea, de la entrada a la salida (incluye ambos puntos). */
      path: Point[];
    }
  | { ok: false; reason: SplitFailure; message: string };

const MESSAGES: Record<SplitFailure, string> = {
  too_short: 'La línea necesita al menos 2 puntos. Coloque el segundo punto del otro lado de la región.',
  few_hits: 'La línea no entra y sale de la región. Empiece y termine fuera de la región o sobre su borde, de modo que la atraviese.',
  many_hits: 'La línea cruza el borde de la región más de dos veces. Divida la región en pasos, con una línea que la cruce solo una vez.',
  on_boundary: 'Un tramo de la línea va pegado al borde de la región. Trácela por dentro de la región.',
  same_point: 'La entrada y la salida de la línea son el mismo punto. Termine la línea en otro punto del borde.',
  self_intersect: 'La línea se cruza o se toca a sí misma. Quite el último punto con Retroceso y trácela sin cruces.',
  outside: 'La línea va por fuera de la región entre los dos cortes. Trácela por dentro de la región.',
  degenerate: 'Una de las dos partes quedaría sin área. Mueva la línea para que deje área a ambos lados.',
};

export function splitMessage(reason: SplitFailure): string {
  return MESSAGES[reason];
}

const fail = (reason: SplitFailure): SplitResult => ({ ok: false, reason, message: MESSAGES[reason] });

function clean(v: number): number {
  return Number(v.toPrecision(12));
}

const cross2 = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

interface RawHit {
  /** Posición a lo largo de la línea: segmento + parámetro (0–1). */
  seq: number;
  point: Point;
  edge: number;
  /** Parámetro a lo largo de la arista. */
  u: number;
  vertex: number | null;
}

function scaleOf(points: readonly Point[]): number {
  const b = boundsOf(points);
  return Math.max(b.maxX - b.minX, b.maxY - b.minY, 1e-9);
}

/** Intersecciones de la polilínea con el borde del polígono, en orden a lo largo de la línea y sin repetir las que coinciden. */
function boundaryHits(polygon: readonly Point[], line: readonly Point[], tol: number): RawHit[] | 'on_boundary' {
  const hits: RawHit[] = [];
  const n = polygon.length;
  for (let s = 0; s + 1 < line.length; s += 1) {
    const a = line[s] as Point;
    const b = line[s + 1] as Point;
    const rx = b[0] - a[0];
    const ry = b[1] - a[1];
    const len = Math.hypot(rx, ry);
    if (len <= tol) continue;
    for (let e = 0; e < n; e += 1) {
      const c = polygon[e] as Point;
      const d = polygon[(e + 1) % n] as Point;
      const sx = d[0] - c[0];
      const sy = d[1] - c[1];
      const elen = Math.hypot(sx, sy);
      if (elen <= tol) continue;
      const denom = cross2(rx, ry, sx, sy);
      // Paralelas (el seno del ángulo es despreciable): colineales y solapadas = tramo sobre el borde; si no, no se cortan.
      if (Math.abs(denom) <= 1e-12 * len * elen) {
        const overlapping = distPointSegment(a, c, d) <= tol || distPointSegment(b, c, d) <= tol || distPointSegment(c, a, b) <= tol;
        const collinear = Math.abs(cross2(c[0] - a[0], c[1] - a[1], rx, ry)) / len <= tol;
        if (collinear && overlapping) {
          // Se toca en un solo extremo (colineal y contiguo sin solape): no es un tramo común.
          const shared = Math.min(
            Math.hypot(a[0] - c[0], a[1] - c[1]) + Math.hypot(b[0] - d[0], b[1] - d[1]),
            Math.hypot(a[0] - d[0], a[1] - d[1]) + Math.hypot(b[0] - c[0], b[1] - c[1]),
          );
          if (shared < len + elen - 4 * tol) return 'on_boundary';
        }
        continue;
      }
      const t = cross2(c[0] - a[0], c[1] - a[1], sx, sy) / denom;
      const u = cross2(c[0] - a[0], c[1] - a[1], rx, ry) / denom;
      const eps = tol / len;
      const epsU = tol / elen;
      if (t < -eps || t > 1 + eps || u < -epsU || u > 1 + epsU) continue;
      const tc = Math.min(1, Math.max(0, t));
      const uc = Math.min(1, Math.max(0, u));
      const point: Point = [clean(a[0] + tc * rx), clean(a[1] + tc * ry)];
      let vertex: number | null = null;
      if (uc * elen <= tol) vertex = e;
      else if ((1 - uc) * elen <= tol) vertex = (e + 1) % n;
      if (vertex !== null) {
        const v = polygon[vertex] as Point;
        point[0] = v[0];
        point[1] = v[1];
      }
      hits.push({ seq: s + tc, point, edge: e, u: uc, vertex });
    }
  }
  hits.sort((p, q) => p.seq - q.seq);
  // Un mismo punto puede salir de dos aristas (en un vértice) o de dos segmentos (en el vértice de la línea): se queda uno.
  const out: RawHit[] = [];
  for (const h of hits) {
    const prev = out[out.length - 1];
    if (prev && Math.hypot(prev.point[0] - h.point[0], prev.point[1] - h.point[1]) <= 4 * tol) {
      if (prev.vertex === null && h.vertex !== null) out[out.length - 1] = { ...h, seq: prev.seq };
      continue;
    }
    out.push(h);
  }
  return out;
}

function signedArea(poly: readonly Point[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i] as Point;
    const q = poly[(i + 1) % poly.length] as Point;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

function centroid(poly: readonly Point[]): Point {
  const a = signedArea(poly);
  if (Math.abs(a) < 1e-300) return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i] as Point;
    const q = poly[(i + 1) % poly.length] as Point;
    const f = p[0] * q[1] - q[0] * p[1];
    cx += (p[0] + q[0]) * f;
    cy += (p[1] + q[1]) * f;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

function pathSelfIntersects(path: readonly Point[], tol: number): boolean {
  const segs = path.length - 1;
  for (let i = 0; i < segs; i += 1) {
    for (let j = i + 1; j < segs; j += 1) {
      const a = path[i] as Point;
      const b = path[i + 1] as Point;
      const c = path[j] as Point;
      const d = path[j + 1] as Point;
      if (j === i + 1) {
        // Contiguos: solo es problema que vuelvan sobre sí mismos (colineales con retroceso).
        const cr = cross2(b[0] - a[0], b[1] - a[1], d[0] - c[0], d[1] - c[1]);
        const dot = (b[0] - a[0]) * (d[0] - c[0]) + (b[1] - a[1]) * (d[1] - c[1]);
        if (Math.abs(cr) <= 1e-12 * Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(d[0] - c[0], d[1] - c[1]) && dot < 0) return true;
      } else if (properCross(a, b, c, d, tol) || segmentsTouch(a, b, c, d, tol)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Divide `polygon` con la polilínea `line`. La línea debe cruzar el borde exactamente dos veces (entrada y salida), no puede
 * tocarse a sí misma y las dos partes deben tener área. El resultado conserva el orden de los vértices de cada parte.
 */
export function splitRegion(polygon: readonly Point[], line: readonly Point[]): SplitResult {
  if (line.length < 2 || polygon.length < 3) return fail('too_short');
  const scale = scaleOf([...polygon, ...line]);
  const tol = 1e-9 * scale;

  const found = boundaryHits(polygon, line, tol);
  if (found === 'on_boundary') return fail('on_boundary');
  if (found.length < 2) return fail('few_hits');
  if (found.length > 2) return fail('many_hits');
  const [h1, h2] = found as [RawHit, RawHit];
  if (Math.hypot(h1.point[0] - h2.point[0], h1.point[1] - h2.point[1]) <= 4 * tol) return fail('same_point');

  // Tramo interior: de la entrada a la salida, con los puntos de la línea que quedan entre ambas.
  const inner: Point[] = [];
  for (let k = 0; k < line.length; k += 1) {
    if (k > h1.seq + 1e-12 && k < h2.seq - 1e-12) inner.push([line[k]![0], line[k]![1]]);
  }
  const path: Point[] = [h1.point, ...inner, h2.point];
  const deduped: Point[] = [];
  for (const p of path) {
    const last = deduped[deduped.length - 1];
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 4 * tol) deduped.push(p);
  }
  if (deduped.length < 2) return fail('same_point');
  if (pathSelfIntersects(deduped, tol)) return fail('self_intersect');
  for (let i = 0; i + 1 < deduped.length; i += 1) {
    const a = deduped[i] as Point;
    const b = deduped[i + 1] as Point;
    if (classifyPoint([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], polygon, tol) !== 'inside') return fail('outside');
  }

  // Anillo del polígono con los dos cortes insertados (si no caen en un vértice).
  const ring: Point[] = [];
  const idx = new Map<RawHit, number>();
  const onEdge = (e: number): RawHit[] => [h1, h2].filter((h) => h.vertex === null && h.edge === e).sort((p, q) => p.u - q.u);
  polygon.forEach((v, i) => {
    ring.push([v[0], v[1]]);
    for (const h of [h1, h2]) if (h.vertex === i) idx.set(h, ring.length - 1);
    for (const h of onEdge(i)) {
      ring.push([h.point[0], h.point[1]]);
      idx.set(h, ring.length - 1);
    }
  });
  const i1 = idx.get(h1);
  const i2 = idx.get(h2);
  if (i1 === undefined || i2 === undefined) return fail('few_hits');
  const arc = (from: number, to: number): Point[] => {
    const out: Point[] = [];
    for (let i = from; ; i = (i + 1) % ring.length) {
      out.push(ring[i] as Point);
      if (i === to) break;
    }
    return out;
  };
  const mid = deduped.slice(1, -1);
  const partA = [...arc(i1, i2), ...[...mid].reverse()];
  const partB = [...arc(i2, i1), ...mid];
  const total = Math.abs(signedArea(polygon));
  for (const part of [partA, partB]) {
    if (part.length < 3 || normalizedArea(part, scale) <= 1e-9 || Math.abs(signedArea(part)) <= 1e-9 * total) return fail('degenerate');
    if (findSelfIntersection(part, tol)) return fail('self_intersect');
  }

  const ca = centroid(partA);
  const cb = centroid(partB);
  const aIsKept = Math.abs(ca[1] - cb[1]) > tol ? ca[1] > cb[1] : ca[0] <= cb[0];
  const hit = (h: RawHit): BoundaryHit => ({ point: [h.point[0], h.point[1]], vertex: h.vertex, edge: h.vertex === null ? h.edge : null });
  return { ok: true, kept: aIsKept ? partA : partB, added: aIsKept ? partB : partA, entry: hit(h1), exit: hit(h2), path: deduped };
}

// ───────────────────────── Vértices compartidos con las regiones vecinas ─────────────────────────

export interface EdgeInsertion {
  regionIndex: number;
  /** Vértice anterior a la arista en la que se inserta. */
  afterIndex: number;
  at: Point;
  /** Posición a lo largo de la arista (0–1), para ordenar varias inserciones en la misma. */
  t: number;
}

/**
 * Puntos de `points` que caen en medio de una arista de una región de `doc` (no en sus vértices): hay que insertarlos en esa
 * región para que el límite sea compartido. `skip` excluye una región (la que se está dividiendo).
 */
export function sharedInsertions(doc: ModelDoc, points: readonly Point[], skip: number | null = null): EdgeInsertion[] {
  const all: Point[] = [];
  doc.regions.forEach((r) => all.push(...r.polygon));
  const tol = 1e-9 * scaleOf([...all, ...points, [0, 0]]);
  const out: EdgeInsertion[] = [];
  doc.regions.forEach((region, regionIndex) => {
    if (regionIndex === skip) return;
    const poly = region.polygon;
    for (const p of points) {
      if (poly.some((v) => Math.hypot(v[0] - p[0], v[1] - p[1]) <= 4 * tol)) continue;
      for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i] as Point;
        const b = poly[(i + 1) % poly.length] as Point;
        if (distPointSegment(p, a, b) > tol) continue;
        const len2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
        const t = len2 === 0 ? 0 : ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / len2;
        if (!out.some((o) => o.regionIndex === regionIndex && o.afterIndex === i && Math.hypot(o.at[0] - p[0], o.at[1] - p[1]) <= 4 * tol)) {
          out.push({ regionIndex, afterIndex: i, at: [p[0], p[1]], t });
        }
        break;
      }
    }
  });
  return out;
}

/** `vertex/insert` para cada inserción, en un orden que no desplaza los índices (de la última arista a la primera, de t mayor a menor). */
export function insertionCommands(insertions: readonly EdgeInsertion[]): CanvasAction[] {
  return [...insertions]
    .sort((p, q) => p.regionIndex - q.regionIndex || q.afterIndex - p.afterIndex || q.t - p.t)
    .map((i): CanvasAction => ({ type: 'vertex/insert', regionIndex: i.regionIndex, afterIndex: i.afterIndex, at: [i.at[0], i.at[1]] }));
}

/** Documento con las inserciones aplicadas (para validar antes de emitir los comandos). */
export function withInsertions(doc: ModelDoc, insertions: readonly EdgeInsertion[]): ModelDoc {
  const regions = doc.regions.map((r) => ({ ...r, polygon: r.polygon.map((p): Point => [p[0], p[1]]) }));
  for (const i of [...insertions].sort((p, q) => p.regionIndex - q.regionIndex || q.afterIndex - p.afterIndex || q.t - p.t)) {
    regions[i.regionIndex]?.polygon.splice(i.afterIndex + 1, 0, [i.at[0], i.at[1]]);
  }
  return { ...doc, regions };
}
