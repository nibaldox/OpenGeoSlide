// Snapping con prioridad: vértice cercano > alineación con vecinos (eje) > rejilla. Tolerancia en píxeles → metros.

import type { Point } from '../../engine/types';
import type { Viewport } from '../../geometry/viewport';
import type { EditorUi, ModelDoc } from '../types';
import { projectOnSegment, roundForScale, type VertexRef } from './geom';

export type SnapKind = 'vertex' | 'edge' | 'axis' | 'grid' | 'none';

export interface SnapContext {
  doc: ModelDoc;
  vp: Viewport;
  snap: EditorUi['snap'];
  /** Vértices a ignorar como destino (el que se arrastra y sus coincidentes). */
  exclude?: readonly VertexRef[];
  /** Puntos vecinos con los que alinear en horizontal o vertical (los vecinos del vértice arrastrado). */
  neighbors?: readonly Point[];
  /** Ajuste a aristas (herramientas «Dibujar región» y «Dividir región»): con `snap.vertex` activo, un punto cerca de una arista se apoya en ella. */
  edges?: boolean;
}

export interface SnapResult {
  point: Point;
  kind: SnapKind;
  /** Vértice destino cuando `kind === 'vertex'`. */
  target: VertexRef | null;
  /** Arista destino cuando `kind === 'edge'`: región y vértice anterior a la arista. */
  edge?: { regionIndex: number; afterIndex: number };
  /** Coordenadas (mundo) de las guías de alineación activas, para dibujarlas. */
  guides: { x: number | null; y: number | null };
}

/** Convierte una tolerancia en píxeles a metros con la escala del viewport. */
export function pxToMeters(vp: Viewport, px: number): number {
  return px / vp.scale;
}

function snapToGrid(v: number, step: number): number {
  return Number((Math.round(v / step) * step).toPrecision(12));
}

export function snapPoint(raw: Point, ctx: SnapContext): SnapResult {
  const { doc, vp, snap } = ctx;
  const tol = pxToMeters(vp, snap.radiusPx);

  // 1. Vértice más cercano de cualquier región.
  if (snap.vertex) {
    let bestRef: VertexRef | null = null;
    let bestPoint: Point = raw;
    let bestD = Infinity;
    for (let regionIndex = 0; regionIndex < doc.regions.length; regionIndex++) {
      const polygon = doc.regions[regionIndex].polygon;
      for (let vertexIndex = 0; vertexIndex < polygon.length; vertexIndex++) {
        if (ctx.exclude?.some((e) => e.regionIndex === regionIndex && e.vertexIndex === vertexIndex)) continue;
        const p = polygon[vertexIndex];
        const d = Math.hypot(p[0] - raw[0], p[1] - raw[1]);
        if (d <= tol && d < bestD) {
          bestD = d;
          bestRef = { regionIndex, vertexIndex };
          bestPoint = p;
        }
      }
    }
    if (bestRef !== null) {
      return { point: [bestPoint[0], bestPoint[1]], kind: 'vertex', target: bestRef, guides: { x: null, y: null } };
    }
  }

  // 1b. Arista más cercana (solo al dibujar o dividir): el punto se apoya en la arista, sin redondear, para que dos regiones
  // compartan su límite sin hueco ni solape.
  if (snap.vertex && ctx.edges) {
    let best: { regionIndex: number; afterIndex: number; point: Point } | null = null;
    let bestD = Infinity;
    doc.regions.forEach((region, regionIndex) => {
      const poly = region.polygon;
      for (let i = 0; i < poly.length; i++) {
        const proj = projectOnSegment(raw, poly[i] as Point, poly[(i + 1) % poly.length] as Point);
        if (proj.distance <= tol && proj.distance < bestD) {
          bestD = proj.distance;
          best = { regionIndex, afterIndex: i, point: proj.point };
        }
      }
    });
    if (best !== null) {
      const b: { regionIndex: number; afterIndex: number; point: Point } = best;
      const point: Point = [Number(b.point[0].toPrecision(12)), Number(b.point[1].toPrecision(12))];
      // Con rejilla, en una arista vertical u horizontal la coordenada libre sigue la rejilla (sin salirse de la arista).
      const grid = snap.gridStep !== null && snap.gridStep > 0 ? snap.gridStep : null;
      if (grid !== null) {
        const poly = doc.regions[b.regionIndex]!.polygon;
        const p0 = poly[b.afterIndex] as Point;
        const p1 = poly[(b.afterIndex + 1) % poly.length] as Point;
        const within = (v: number, lo: number, hi: number): boolean => v >= Math.min(lo, hi) - 1e-12 && v <= Math.max(lo, hi) + 1e-12;
        if (p0[0] === p1[0]) {
          const y = snapToGrid(point[1], grid);
          if (within(y, p0[1], p1[1])) point[1] = y;
        } else if (p0[1] === p1[1]) {
          const x = snapToGrid(point[0], grid);
          if (within(x, p0[0], p1[0])) point[0] = x;
        }
      }
      return { point, kind: 'edge', target: null, edge: { regionIndex: b.regionIndex, afterIndex: b.afterIndex }, guides: { x: null, y: null } };
    }
  }

  // 2. Alineación horizontal/vertical con los vecinos; el eje no alineado puede ir a la rejilla.
  let x = raw[0];
  let y = raw[1];
  let gx: number | null = null;
  let gy: number | null = null;
  if (snap.axis && ctx.neighbors) {
    let bx = tol;
    let by = tol;
    for (const n of ctx.neighbors) {
      const dx = Math.abs(raw[0] - n[0]);
      const dy = Math.abs(raw[1] - n[1]);
      if (dx <= bx) {
        bx = dx;
        gx = n[0];
      }
      if (dy <= by) {
        by = dy;
        gy = n[1];
      }
    }
  }
  const grid = snap.gridStep !== null && snap.gridStep > 0 ? snap.gridStep : null;
  if (gx !== null) x = gx;
  else if (grid !== null) x = snapToGrid(x, grid);
  if (gy !== null) y = gy;
  else if (grid !== null) y = snapToGrid(y, grid);

  if (gx !== null || gy !== null) {
    // El eje que no se alinea y no va a la rejilla se redondea a la escala, como un punto libre: sin esto el ruido del píxel
    // (p. ej. 0,999997) acabaría guardado en el modelo y en el informe.
    if (gx === null && grid === null) x = roundForScale(x, vp.scale);
    if (gy === null && grid === null) y = roundForScale(y, vp.scale);
  }
  if (gx !== null || gy !== null) return { point: [x, y], kind: 'axis', target: null, guides: { x: gx, y: gy } };
  if (grid !== null) return { point: [x, y], kind: 'grid', target: null, guides: { x: null, y: null } };
  return {
    point: [roundForScale(x, vp.scale), roundForScale(y, vp.scale)],
    kind: 'none',
    target: null,
    guides: { x: null, y: null },
  };
}
