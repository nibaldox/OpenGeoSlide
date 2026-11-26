// Ajuste de una polilínea fija al terreno y su admisibilidad (F3.3, E13c, E13j-5), con la misma regla que el motor
// (`crates/ogs-core/src/surface.rs`: `fit_polyline` y `check_admissible`). Sirve para que la polilínea que propone la web sea
// admisible **por construcción** y para comprobarlo con la regla del motor, sin llamarlo. No sustituye al motor: el motor valida siempre.
//
// Regla (resumen): cada extremo se prolonga por su tramo hasta el primer cruce con el terreno (o se recorta en él si está
// sobre el terreno); los vértices interiores quedan estrictamente bajo el terreno y dentro del modelo, y ningún tramo pasa
// sobre el terreno (rozar un vértice del terreno se admite).

import type { Point } from '../../engine/types';

type Regions = ReadonlyArray<{ polygon: ReadonlyArray<readonly [number, number]> }>;

/** Tramo del terreno entre dos abscisas de vértice consecutivas, con los límites laterales y0 (en x0) e y1 (en x1). */
export interface GroundPiece {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export type PolylineFit = { ok: true; fitted: Point[] } | { ok: false; reason: 'polyline_no_ground_crossing' | 'polyline_outside_ground' };

const yAt = (g: GroundPiece, x: number): number => g.y0 + ((x - g.x0) * (g.y1 - g.y0)) / (g.x1 - g.x0);

/** Escala de longitud del modelo: la mayor de su anchura y su altura (como `scale` del motor). */
export function groundScale(regions: Regions): number {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const r of regions) {
    for (const [x, y] of r.polygon) {
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
  }
  return Math.max(xMax - xMin, yMax - yMin);
}

/** El terreno (envolvente superior de las regiones) como tramos entre abscisas de vértice, de izquierda a derecha. */
export function groundPieces(regions: Regions): GroundPiece[] {
  const xs = Array.from(new Set(regions.flatMap((r) => r.polygon.map((p) => p[0])))).sort((a, b) => a - b);
  const edges: Array<[readonly [number, number], readonly [number, number]]> = [];
  for (const r of regions) {
    r.polygon.forEach((a, i) => edges.push([a, r.polygon[(i + 1) % r.polygon.length] as readonly [number, number]]));
  }
  const pieces: GroundPiece[] = [];
  for (let i = 0; i + 1 < xs.length; i += 1) {
    const x0 = xs[i] as number;
    const x1 = xs[i + 1] as number;
    const xm = 0.5 * (x0 + x1);
    let best: { y: number; e: [readonly [number, number], readonly [number, number]] } | null = null;
    for (const e of edges) {
      const [a, b] = e;
      if (a[0] === b[0] || xm < Math.min(a[0], b[0]) || xm > Math.max(a[0], b[0])) continue;
      const y = a[1] + ((xm - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
      if (best === null || y > best.y) best = { y, e };
    }
    if (best) {
      const [a, b] = best.e;
      const line = (x: number): number => a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
      pieces.push({ x0, x1, y0: line(x0), y1: line(x1) });
    }
  }
  return pieces;
}

function segmentY(pts: readonly Point[], i: number, x: number): number {
  const a = pts[i] as Point;
  const b = pts[i + 1] as Point;
  return a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
}

function polylineY(pts: readonly Point[], x: number): number {
  const n = pts.length;
  if (x === (pts[n - 1] as Point)[0]) return (pts[n - 1] as Point)[1];
  let k = 0;
  while (k < n && (pts[k] as Point)[0] <= x) k += 1;
  const i = Math.min(Math.max(k, 1), n - 1) - 1;
  return segmentY(pts, i, x);
}

interface Stretch {
  u: number;
  v: number;
  hu: number;
  hv: number;
}

/** Tramos de la polilínea sobre un segmento y un tramo del terreno, con h = polilínea − terreno en sus extremos. `null` si el terreno tiene un hueco. */
function stretches(pts: readonly Point[], pieces: readonly GroundPiece[]): Stretch[] | null {
  const first = (pts[0] as Point)[0];
  const last = (pts[pts.length - 1] as Point)[0];
  const xs = Array.from(new Set([...pts.map((p) => p[0]), ...pieces.flatMap((g) => [g.x0, g.x1])].filter((x) => x >= first && x <= last))).sort((a, b) => a - b);
  const out: Stretch[] = [];
  for (let i = 0; i + 1 < xs.length; i += 1) {
    const u = xs[i] as number;
    const v = xs[i + 1] as number;
    const xm = 0.5 * (u + v);
    const g = pieces.find((p) => p.x0 <= xm && xm <= p.x1);
    if (!g) return null;
    let k = 0;
    while (k < pts.length && (pts[k] as Point)[0] <= xm) k += 1;
    const seg = Math.min(Math.max(k, 1), pts.length - 1) - 1;
    out.push({ u, v, hu: segmentY(pts, seg, u) - yAt(g, u), hv: segmentY(pts, seg, v) - yAt(g, v) });
  }
  return out;
}

function mirrorPieces(pieces: readonly GroundPiece[]): GroundPiece[] {
  return [...pieces].reverse().map((g) => ({ x0: -g.x1, x1: -g.x0, y0: g.y1, y1: g.y0 }));
}

function mirrorPoints(pts: readonly Point[]): Point[] {
  return [...pts].reverse().map(([x, y]): Point => [-x, y]);
}

function fitStart(pts: readonly Point[], pieces: readonly GroundPiece[], tol: number): Point[] | 'polyline_no_ground_crossing' {
  const p0 = pts[0] as Point;
  const p1 = pts[1] as Point;
  const g0piece = pieces.find((g) => g.x0 <= p0[0] && p0[0] < g.x1);
  if (!g0piece) return 'polyline_no_ground_crossing';
  const h0 = p0[1] - yAt(g0piece, p0[0]);
  if (Math.abs(h0) <= tol) return [...pts];
  if (h0 < 0) {
    const slope = (p1[1] - p0[1]) / (p1[0] - p0[0]);
    const line = (x: number): number => p0[1] + slope * (x - p0[0]);
    let reach = p0[0];
    let found: number | null = null;
    for (const g of [...pieces].reverse().filter((q) => q.x0 < p0[0])) {
      if (g.x1 < reach - tol) break; // hueco en el terreno
      const hi = Math.min(g.x1, p0[0]);
      const hb = line(hi) - yAt(g, hi);
      if (hb >= -tol) {
        found = hi; // en una cara vertical el terreno cae: la superficie sale por la cara
        break;
      }
      const lo = g.x0;
      const ha = line(lo) - yAt(g, lo);
      if (ha >= -tol) {
        found = ha > 0 ? hi - ((hi - lo) * -hb) / (ha - hb) : lo;
        break;
      }
      reach = lo;
    }
    if (found === null) return 'polyline_no_ground_crossing';
    if (p0[0] - found <= tol) return [...pts];
    return [[found, line(found)], ...pts];
  }
  // Recorte: el primer lugar donde la polilínea pasa de sobre el terreno (o sobre él) a bajo él.
  const subs = stretches(pts, pieces);
  if (!subs) return 'polyline_no_ground_crossing';
  for (const s of subs) {
    if (s.hv < -tol || s.hu < -tol) {
      const xc = s.hu > 0 && s.hv < -tol ? s.u + ((s.v - s.u) * s.hu) / (s.hu - s.hv) : s.u;
      const out: Point[] = [[xc, polylineY(pts, xc)], ...pts.filter((p) => p[0] > xc + tol)];
      return out.length < 2 ? 'polyline_no_ground_crossing' : out;
    }
  }
  return 'polyline_no_ground_crossing';
}

/** Ajusta la polilínea al terreno y comprueba su admisibilidad con la regla del motor (`fit_polyline` + `check_admissible`). */
export function fitPolylineToGround(regions: Regions, points: readonly Point[]): PolylineFit {
  const n = points.length;
  if (n < 2 || points.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return { ok: false, reason: 'polyline_no_ground_crossing' };
  const tol = 1e-9 * groundScale(regions);
  const xMin = Math.min(...regions.flatMap((r) => r.polygon.map((p) => p[0])));
  const xMax = Math.max(...regions.flatMap((r) => r.polygon.map((p) => p[0])));
  for (let i = 0; i < n; i += 1) {
    const x = (points[i] as Point)[0];
    if (x < xMin - tol || x > xMax + tol) return { ok: false, reason: i === 0 || i === n - 1 ? 'polyline_no_ground_crossing' : 'polyline_outside_ground' };
  }
  const pieces = groundPieces(regions);
  const start = fitStart(points, pieces, tol);
  if (typeof start === 'string') return { ok: false, reason: start };
  const end = fitStart(mirrorPoints(start), mirrorPieces(pieces), tol);
  if (typeof end === 'string') return { ok: false, reason: end };
  const fitted = mirrorPoints(end);
  for (let i = 1; i < fitted.length; i += 1) {
    if ((fitted[i] as Point)[0] <= (fitted[i - 1] as Point)[0]) return { ok: false, reason: 'polyline_no_ground_crossing' };
  }
  if (fitted.length < 2) return { ok: false, reason: 'polyline_no_ground_crossing' };
  // Admisibilidad: vértices interiores estrictamente bajo el terreno (bajo el lado más bajo de una cara vertical) y ningún tramo sobre él.
  for (const p of fitted.slice(1, -1)) {
    if (!(p[0] > xMin && p[0] < xMax)) return { ok: false, reason: 'polyline_outside_ground' };
    const left = pieces.find((g) => g.x0 < p[0] && p[0] <= g.x1);
    const right = pieces.find((g) => g.x0 <= p[0] && p[0] < g.x1);
    const grounds = [left, right].filter((g): g is GroundPiece => g !== undefined).map((g) => yAt(g, p[0]));
    if (grounds.length === 0 || p[1] >= Math.min(...grounds) - tol) return { ok: false, reason: 'polyline_outside_ground' };
  }
  const subs = stretches(fitted, pieces);
  if (!subs || subs.some((s) => s.hu > tol || s.hv > tol)) return { ok: false, reason: 'polyline_outside_ground' };
  return { ok: true, fitted };
}
