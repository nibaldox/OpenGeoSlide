// Lógica pura del panel «Geometría»: resumen de regiones, edición de las coordenadas de la tabla de vértices, comandos para
// agregar y quitar vértices o regiones, incidencias de la región y paginación de las tablas grandes. Sin React ni DOM.

import type { Point } from '../../engine/types';
import type { ConfirmOptions } from '../../ui/confirmQueue';
import { coincidentVertices, type VertexRef } from '../canvas/geom';
import { validateLocalCached } from '../state/validateLocal';
import type { EditorCommand, Issue, ModelDoc } from '../types';
import { formatNumber, parseNumber } from './forms';

// ───────────────────────── Regiones ─────────────────────────

export interface RegionSummary {
  index: number;
  materialId: string;
  materialName: string;
  /** El material existe en el modelo. */
  known: boolean;
  vertexCount: number;
  /** Área del contorno, en unidades de longitud al cuadrado. */
  area: number;
}

/** Área del polígono (fórmula del topógrafo), siempre positiva. */
export function polygonArea(polygon: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i] as Point;
    const b = polygon[(i + 1) % polygon.length] as Point;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) / 2;
}

export function regionSummary(doc: ModelDoc): RegionSummary[] {
  return doc.regions.map((r, index) => {
    const m = doc.materials.find((x) => x.id === r.material);
    return {
      index,
      materialId: r.material,
      materialName: m ? m.name : r.material,
      known: m !== undefined,
      vertexCount: r.polygon.length,
      area: polygonArea(r.polygon),
    };
  });
}

export function regionRemoveCommand(doc: ModelDoc, regionIndex: number): EditorCommand | null {
  return Number.isInteger(regionIndex) && regionIndex >= 0 && regionIndex < doc.regions.length ? { type: 'region/remove', regionIndex } : null;
}

/** Confirmación previa a eliminar una región: dice cuál (número, material y vértices) y que se puede deshacer. */
export function regionRemoveConfirm(summary: Pick<RegionSummary, 'index' | 'materialName' | 'vertexCount'>): ConfirmOptions {
  const n = summary.index + 1;
  const vertices = summary.vertexCount === 1 ? '1 vértice' : `${summary.vertexCount} vértices`;
  return {
    title: `Eliminar la región ${n}`,
    message: `Se eliminará la región ${n} (material «${summary.materialName}», ${vertices}) con su contorno. Puede deshacerlo con Ctrl+Z.`,
    confirmLabel: 'Eliminar región',
    cancelLabel: 'Conservar la región',
    tone: 'danger',
  };
}

/** Incidencias locales de una región (errores y avisos), con los mismos mensajes que el panel de Diagnósticos. */
export function regionIssues(doc: ModelDoc, regionIndex: number): Issue[] {
  const base = `/regions/${regionIndex}`;
  return validateLocalCached(doc).filter((i) => i.path === base || (i.path?.startsWith(`${base}/`) ?? false));
}

// ───────────────────────── Vértices ─────────────────────────

/** Texto de una coordenada para el campo: coma decimal y sin ruido de coma flotante. */
export function coordText(v: number): string {
  return formatNumber(v);
}

export type CoordEdit = { ok: true; commands: EditorCommand[] } | { ok: false; error: string };

/**
 * Cambia una coordenada de un vértice. Un vértice compartido con otra región se mueve junto con él (como al arrastrarlo en el
 * lienzo), de modo que las aristas comunes siguen coincidiendo. Sin cambio, la lista de comandos queda vacía.
 */
export function vertexCoordEdit(doc: ModelDoc, ref: VertexRef, axis: 'x' | 'y', text: string): CoordEdit {
  const current = doc.regions[ref.regionIndex]?.polygon[ref.vertexIndex];
  if (!current) return { ok: false, error: 'Ese vértice ya no existe.' };
  const parsed = parseNumber(text);
  if (parsed.kind !== 'ok') {
    return { ok: false, error: `Región ${ref.regionIndex + 1}, vértice ${ref.vertexIndex + 1}: la coordenada ${axis} debe ser un número. Corrija el valor (ej. 12,5).` };
  }
  const to: Point = axis === 'x' ? [parsed.value, current[1]] : [current[0], parsed.value];
  if (to[0] === current[0] && to[1] === current[1]) return { ok: true, commands: [] };
  const group = coincidentVertices(doc, ref);
  return {
    ok: true,
    commands: group.map((r): EditorCommand => ({ type: 'vertex/move', regionIndex: r.regionIndex, vertexIndex: r.vertexIndex, to })),
  };
}

/** «Agregar después»: inserta un vértice en el punto medio de la arista que sale del vértice indicado (la de cierre, si es el último). */
export function vertexInsertCommand(doc: ModelDoc, regionIndex: number, afterIndex: number): EditorCommand | null {
  const poly = doc.regions[regionIndex]?.polygon;
  if (!poly || !Number.isInteger(afterIndex) || afterIndex < 0 || afterIndex >= poly.length) return null;
  const a = poly[afterIndex] as Point;
  const b = poly[(afterIndex + 1) % poly.length] as Point;
  const at: Point = [Number(((a[0] + b[0]) / 2).toPrecision(12)), Number(((a[1] + b[1]) / 2).toPrecision(12))];
  return { type: 'vertex/insert', regionIndex, afterIndex, at };
}

/** Elimina un vértice; `null` si la región quedaría con menos de 3. */
export function vertexRemoveCommand(doc: ModelDoc, regionIndex: number, vertexIndex: number): EditorCommand | null {
  const poly = doc.regions[regionIndex]?.polygon;
  if (!poly || !Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= poly.length || poly.length <= 3) return null;
  return { type: 'vertex/remove', regionIndex, vertexIndex };
}

/** Índice (ya sin el eliminado) del vértice que recibe el foco: el anterior, o el último si se quitó el primero. */
export function nextVertexIndex(countBefore: number, removedIndex: number): number {
  return removedIndex > 0 ? removedIndex - 1 : countBefore - 2;
}

// ───────────────────────── Tablas grandes ─────────────────────────

/** Con más filas que este umbral la tabla se pagina (200 filas se muestran todas). */
export const PAGE_THRESHOLD = 200;
export const PAGE_SIZE = 100;

export function pageCount(rows: number): number {
  return rows <= PAGE_THRESHOLD ? 1 : Math.ceil(rows / PAGE_SIZE);
}

export interface PageRange {
  start: number;
  /** Fin exclusivo. */
  end: number;
  page: number;
  pages: number;
}

export function pageRange(rows: number, page: number): PageRange {
  const pages = pageCount(rows);
  const p = Math.min(Math.max(0, Math.trunc(page)), pages - 1);
  if (pages === 1) return { start: 0, end: rows, page: 0, pages };
  return { start: p * PAGE_SIZE, end: Math.min(rows, (p + 1) * PAGE_SIZE), page: p, pages };
}

/** Página que contiene la fila `index`. */
export function pageOf(rows: number, index: number): number {
  return pageCount(rows) === 1 ? 0 : Math.min(pageCount(rows) - 1, Math.floor(index / PAGE_SIZE));
}

// ───────────────────────── Ajuste del dibujo ─────────────────────────

/** Pasos de rejilla ofrecidos (`null` = sin rejilla), en la unidad de longitud del modelo. */
export const GRID_CHOICES: ReadonlyArray<number | null> = [null, 0.1, 0.5, 1, 2, 5, 10];
