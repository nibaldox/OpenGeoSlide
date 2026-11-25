// Utilidades puras y sin dependencias para el estado del editor (comparación profunda, finitud, copia de puntos).

import type { Point } from '../../engine/types';

/** Igualdad estructural de valores tipo JSON. `undefined` y clave ausente se consideran distintos solo por valor. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra).filter((k) => ra[k] !== undefined);
  const kb = Object.keys(rb).filter((k) => rb[k] !== undefined);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(rb, k) || !deepEqual(ra[k], rb[k])) return false;
  }
  return true;
}

/** `true` si todos los números anidados del valor son finitos (NaN e Infinity no son válidos en el JSON). */
export function allFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFinite);
  if (typeof value === 'object' && value !== null) return Object.values(value).every(allFinite);
  return true;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isPoint(value: unknown): value is Point {
  return Array.isArray(value) && value.length === 2 && isFiniteNumber(value[0]) && isFiniteNumber(value[1]);
}

export function isPointList(value: unknown): value is Point[] {
  return Array.isArray(value) && value.every(isPoint);
}

export function copyPoints(points: readonly Point[]): Point[] {
  return points.map((p): Point => [p[0], p[1]]);
}
