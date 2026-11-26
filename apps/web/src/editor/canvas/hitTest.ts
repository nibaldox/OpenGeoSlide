// Pruebas de impacto (hit testing) en coordenadas de pantalla, con tolerancia en píxeles.

import { circleSpec } from '../../engine/surface';
import type { Circle, Point } from '../../engine/types';
import { screenToWorld, worldToScreen, type Viewport } from '../../geometry/viewport';
import type { ModelDoc } from '../types';
import { piezoPoints, pointInPolygon, projectOnSegment, topY } from './geom';

/** Alto en píxeles de la banda de un rango de búsqueda, sobre el terreno. */
export const BAND_HEIGHT_PX = 14;
/** Ángulo (rad) del tirador del radio sobre el círculo: abajo a la derecha del centro. */
export const RADIUS_HANDLE_ANGLE = -Math.PI / 4;

/** Radio de acierto de los tiradores con ratón o lápiz: diámetro de 32 px (WCAG 2.5.8 pide 24 px). */
export const HIT_RADIUS_MOUSE_PX = 16;
/** Radio de acierto con el dedo (`pointerType === 'touch'`). */
export const HIT_RADIUS_TOUCH_PX = 22;

/** Radio de acierto de los tiradores: el de ajuste de la rejilla, con un mínimo según el tipo de puntero. */
export function handleHitRadius(snapRadiusPx: number, pointerType?: string): number {
  return Math.max(snapRadiusPx, pointerType === 'touch' ? HIT_RADIUS_TOUCH_PX : HIT_RADIUS_MOUSE_PX);
}

export type Hit =
  | { kind: 'vertex'; regionIndex: number; vertexIndex: number; distPx: number }
  | { kind: 'piezo_point'; index: number; distPx: number }
  | { kind: 'circle_center'; distPx: number }
  | { kind: 'circle_radius'; distPx: number }
  | { kind: 'edge'; regionIndex: number; afterIndex: number; point: Point; distPx: number }
  | { kind: 'piezo_edge'; afterIndex: number; point: Point; distPx: number }
  | { kind: 'search_range'; which: 'entry' | 'exit' }
  | { kind: 'region'; regionIndex: number }
  | { kind: 'none' };

/** Posición (mundo) del tirador del radio de un círculo. */
export function radiusHandlePoint(c: Circle): Point {
  return [c.xc + c.r * Math.cos(RADIUS_HANDLE_ANGLE), c.yc + c.r * Math.sin(RADIUS_HANDLE_ANGLE)];
}

/** Rango [lo, hi] ordenado de una banda de búsqueda, o null si no está definida. */
export function searchRange(doc: ModelDoc, which: 'entry' | 'exit'): [number, number] | null {
  const r = doc.analysis.search?.[which];
  if (!r) return null;
  return [Math.min(r[0], r[1]), Math.max(r[0], r[1])];
}

interface HandleCandidate {
  hit: Hit;
  distPx: number;
  priority: number;
}

function screenDist(vp: Viewport, p: Point, sx: number, sy: number): number {
  const [px, py] = worldToScreen(vp, p[0], p[1]);
  return Math.hypot(px - sx, py - sy);
}

/**
 * Qué hay bajo (sx, sy) en pantalla. `radiusPx` es la tolerancia de los tiradores (véase `handleHitRadius`). Prioridad: tiradores (vértice > punto de piezométrica > centro > radio, el más
 * cercano gana) > aristas y línea piezométrica > bandas de búsqueda > interior de región > nada.
 */
export function hitTest(
  doc: ModelDoc,
  vp: Viewport,
  sx: number,
  sy: number,
  radiusPx: number,
  options: { bands?: boolean; /** Tolerancia de aristas y segmentos; por omisión `radiusPx`. */ edgeRadiusPx?: number } = {},
): Hit {
  const bandsOn = options.bands ?? true;
  const handles: HandleCandidate[] = [];
  const push = (hit: Hit, distPx: number, priority: number): void => {
    if (distPx <= radiusPx) handles.push({ hit, distPx, priority });
  };

  doc.regions.forEach((region, regionIndex) => {
    region.polygon.forEach((v, vertexIndex) => {
      push({ kind: 'vertex', regionIndex, vertexIndex, distPx: 0 }, screenDist(vp, v, sx, sy), 0);
    });
  });
  piezoPoints(doc).forEach((p, index) => {
    push({ kind: 'piezo_point', index, distPx: 0 }, screenDist(vp, p, sx, sy), 1);
  });
  const circle = circleSpec(doc.analysis.surface);
  if (circle) {
    push({ kind: 'circle_center', distPx: 0 }, screenDist(vp, [circle.xc, circle.yc], sx, sy), 2);
    push({ kind: 'circle_radius', distPx: 0 }, screenDist(vp, radiusHandlePoint(circle), sx, sy), 3);
  }
  if (handles.length > 0) {
    // Empates (p. ej. vértices coincidentes de dos regiones): gana la prioridad y luego el orden de aparición.
    let best = handles[0];
    for (const h of handles) {
      if (h.distPx < best.distPx - 1e-9 || (Math.abs(h.distPx - best.distPx) <= 1e-9 && h.priority < best.priority)) best = h;
    }
    return { ...best.hit, distPx: best.distPx } as Hit;
  }

  const world: Point = screenToWorld(vp, sx, sy);
  const pointer: Point = [sx, sy];

  // Bandas de búsqueda sobre el terreno.
  for (const which of bandsOn ? (['entry', 'exit'] as const) : []) {
    const range = searchRange(doc, which);
    if (!range || world[0] < range[0] || world[0] > range[1]) continue;
    const y = topY(doc, world[0]);
    if (y === null) continue;
    const [, ys] = worldToScreen(vp, world[0], y);
    if (sy >= ys - BAND_HEIGHT_PX && sy <= ys + 4) return { kind: 'search_range', which };
  }

  // Aristas de región y segmentos de la piezométrica: la más cercana dentro de la tolerancia.
  let bestEdge: Hit | null = null;
  let bestDist = options.edgeRadiusPx ?? radiusPx;
  const toScreen = (p: Point): Point => worldToScreen(vp, p[0], p[1]);
  doc.regions.forEach((region, regionIndex) => {
    const poly = region.polygon;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const proj = projectOnSegment(pointer, toScreen(a), toScreen(b));
      if (proj.distance < bestDist) {
        bestDist = proj.distance;
        const point: Point = [a[0] + proj.t * (b[0] - a[0]), a[1] + proj.t * (b[1] - a[1])];
        bestEdge = { kind: 'edge', regionIndex, afterIndex: i, point, distPx: proj.distance };
      }
    }
  });
  const pz = piezoPoints(doc);
  for (let i = 0; i + 1 < pz.length; i++) {
    const a = pz[i];
    const b = pz[i + 1];
    const proj = projectOnSegment(pointer, toScreen(a), toScreen(b));
    if (proj.distance < bestDist) {
      bestDist = proj.distance;
      const point: Point = [a[0] + proj.t * (b[0] - a[0]), a[1] + proj.t * (b[1] - a[1])];
      bestEdge = { kind: 'piezo_edge', afterIndex: i, point, distPx: proj.distance };
    }
  }
  if (bestEdge) return bestEdge;

  // Interior de región: la última en el orden de dibujo queda encima.
  for (let i = doc.regions.length - 1; i >= 0; i--) {
    if (pointInPolygon(world, doc.regions[i].polygon)) return { kind: 'region', regionIndex: i };
  }
  return { kind: 'none' };
}
