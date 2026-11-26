// Tiradores del lienzo en orden de recorrido por teclado (tabindex itinerante, R7-04): vértices por región,
// puntos de la piezométrica y, de la superficie fija, el centro del círculo y su radio o los vértices de la polilínea (F3.3). Puro: sin React ni DOM.

import { circleSpec } from '../../engine/surface';
import type { Point } from '../../engine/types';
import type { ModelDoc, Selection } from '../types';
import { piezoPoints } from './geom';
import { radiusHandlePoint } from './hitTest';

export type HandleRef =
  | { kind: 'vertex'; regionIndex: number; vertexIndex: number }
  | { kind: 'piezo_point'; index: number }
  | { kind: 'circle_center' }
  | { kind: 'circle_radius' }
  /** Vértice de la polilínea fija de falla (F3.3). */
  | { kind: 'surface_vertex'; index: number };

/** Parte del círculo de falla que tiene el foco (la selección `surface_circle` no la distingue). */
export type CirclePart = 'center' | 'radius';

export function handleList(doc: ModelDoc): HandleRef[] {
  const out: HandleRef[] = [];
  doc.regions.forEach((region, regionIndex) => {
    region.polygon.forEach((_, vertexIndex) => out.push({ kind: 'vertex', regionIndex, vertexIndex }));
  });
  piezoPoints(doc).forEach((_, index) => out.push({ kind: 'piezo_point', index }));
  const surface = doc.analysis.surface;
  if (surface && surface.type === 'polyline') surface.points.forEach((_, index) => out.push({ kind: 'surface_vertex', index }));
  else if (surface) out.push({ kind: 'circle_center' }, { kind: 'circle_radius' });
  return out;
}

/** Clave estable (atributo `data-handle-key`) para localizar el elemento de un tirador. */
export function handleKey(h: HandleRef): string {
  switch (h.kind) {
    case 'vertex':
      return `v-${h.regionIndex}-${h.vertexIndex}`;
    case 'piezo_point':
      return `p-${h.index}`;
    case 'circle_center':
      return 'c-center';
    case 'circle_radius':
      return 'c-radius';
    case 'surface_vertex':
      return `s-${h.index}`;
  }
}

export function sameHandle(a: HandleRef | null, b: HandleRef | null): boolean {
  return a !== null && b !== null && handleKey(a) === handleKey(b);
}

/** Selección del store que corresponde a un tirador. */
export function handleSelection(h: HandleRef): Selection {
  switch (h.kind) {
    case 'vertex':
      return { kind: 'vertex', regionIndex: h.regionIndex, vertexIndex: h.vertexIndex };
    case 'piezo_point':
      return { kind: 'piezo_point', index: h.index };
    case 'circle_center':
    case 'circle_radius':
      return { kind: 'surface_circle' };
    case 'surface_vertex':
      return { kind: 'surface_vertex', index: h.index };
  }
}

/** Tirador de la selección, o null si la selección no es un tirador (región, material, banda…). */
export function selectionHandle(sel: Selection, circlePart: CirclePart = 'center'): HandleRef | null {
  switch (sel.kind) {
    case 'vertex':
      return { kind: 'vertex', regionIndex: sel.regionIndex, vertexIndex: sel.vertexIndex };
    case 'piezo_point':
      return { kind: 'piezo_point', index: sel.index };
    case 'surface_circle':
      return { kind: circlePart === 'radius' ? 'circle_radius' : 'circle_center' };
    case 'surface_vertex':
      return { kind: 'surface_vertex', index: sel.index };
    default:
      return null;
  }
}

/**
 * Tirador vecino de `current`. Sin `wrap` devuelve null en los extremos (Tab deja salir del lienzo); con `wrap` da la vuelta
 * ([ y ]). Sin tirador actual entra por el primero (delta 1) o por el último (delta −1).
 */
export function stepHandle(list: readonly HandleRef[], current: HandleRef | null, delta: 1 | -1, wrap: boolean): HandleRef | null {
  if (list.length === 0) return null;
  const at = current ? list.findIndex((h) => sameHandle(h, current)) : -1;
  if (at < 0) return delta === 1 ? list[0] : list[list.length - 1];
  const next = at + delta;
  if (next >= 0 && next < list.length) return list[next];
  return wrap ? list[(next + list.length) % list.length] : null;
}

/** Posición (mundo) del tirador, o null si ya no existe. */
export function handleWorldPoint(doc: ModelDoc, h: HandleRef): Point | null {
  switch (h.kind) {
    case 'vertex':
      return doc.regions[h.regionIndex]?.polygon[h.vertexIndex] ?? null;
    case 'piezo_point':
      return piezoPoints(doc)[h.index] ?? null;
    case 'circle_center': {
      const c = circleSpec(doc.analysis.surface);
      return c ? [c.xc, c.yc] : null;
    }
    case 'circle_radius': {
      const c = circleSpec(doc.analysis.surface);
      return c ? radiusHandlePoint(c) : null;
    }
    case 'surface_vertex': {
      const surface = doc.analysis.surface;
      return surface && surface.type === 'polyline' ? (surface.points[h.index] ?? null) : null;
    }
  }
}
