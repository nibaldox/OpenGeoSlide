// Snapping con prioridad: vértice cercano > alineación con vecinos (eje) > rejilla. Tolerancia en píxeles → metros.

import type { Point } from '../../engine/types';
import type { Viewport } from '../../geometry/viewport';
import type { EditorUi, ModelDoc } from '../types';
import { roundForScale, type VertexRef } from './geom';

export type SnapKind = 'vertex' | 'axis' | 'grid' | 'none';

export interface SnapContext {
  doc: ModelDoc;
  vp: Viewport;
  snap: EditorUi['snap'];
  /** Vértices a ignorar como destino (el que se arrastra y sus coincidentes). */
  exclude?: readonly VertexRef[];
  /** Puntos vecinos con los que alinear en horizontal o vertical (los vecinos del vértice arrastrado). */
  neighbors?: readonly Point[];
}

export interface SnapResult {
  point: Point;
  kind: SnapKind;
  /** Vértice destino cuando `kind === 'vertex'`. */
  target: VertexRef | null;
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

  if (gx !== null || gy !== null) return { point: [x, y], kind: 'axis', target: null, guides: { x: gx, y: gy } };
  if (grid !== null) return { point: [x, y], kind: 'grid', target: null, guides: { x: null, y: null } };
  return {
    point: [roundForScale(x, vp.scale), roundForScale(y, vp.scale)],
    kind: 'none',
    target: null,
    guides: { x: null, y: null },
  };
}
