// Elementos de la leyenda de la sección (Casos y editor). Lógica pura: qué se muestra según lo que hay dibujado.

import type { Scene } from '../render/scene';

export type LegendSwatch = 'line-red' | 'line-polyline-dashed' | 'line-unconverged' | 'slice' | 'line-blue' | 'line-blue-dotted' | 'band-entry' | 'band-exit' | 'line-load' | 'line-seismic';

export interface LegendExtraItem {
  key: string;
  label: string;
  swatch: LegendSwatch;
}

export interface LegendOptions {
  /** Muestra «Superficie crítica» (por defecto sí). `false` en el editor mientras no hay resultado dibujado. */
  surface?: boolean;
  /** La superficie dibujada no es un resultado válido (no convergió o no es admisible): se rotula «Superficie evaluada (…)» con trazo discontinuo. */
  unconverged?: boolean;
  /** La superficie dibujada no es admisible (`invalid`): «Superficie evaluada (no válida)». Solo se lee junto con `unconverged` (R10B-07). */
  invalid?: boolean;
  /** La superficie dibujada es un círculo **fijo** (el resultado no viene de una búsqueda): «Superficie fija (círculo)», no «crítica» (R10B-07, como `surfaceLegendLabel` del PDF). */
  fixedCircle?: boolean;
  /** Muestra «Dovelas» (por defecto sí). */
  slices?: boolean;
  /** Bandas de entrada y salida de la búsqueda de superficie. */
  bands?: boolean;
  loads?: boolean;
  seismic?: boolean;
  /** La piezométrica no cubre todo el ancho y el motor la prolonga en horizontal: se rotula el tramo punteado (R9-05d). El editor lo calcula con `piezoExtension`. */
  piezoExtrapolated?: boolean;
  /**
   * El modelo tiene una polilínea fija (F3.3): el editor la dibuja discontinua aunque no haya resultado. Sin resultado se rotula
   * aparte; con resultado, «Superficie fija (polilínea)» sustituye a «Superficie crítica». La vista Casos no necesita la opción:
   * lo deduce de `scene.surface.polyline`.
   */
  fixedPolyline?: boolean;
}

/** Elementos distintos de los materiales, en orden fijo: superficie, dovelas, piezométrica, bandas, cargas, sismo. */
export const FIXED_POLYLINE_LABEL = 'Superficie fija (polilínea)';
export const FIXED_CIRCLE_LABEL = 'Superficie fija (círculo)';
export const UNCONVERGED_LABEL = 'Superficie evaluada (sin convergencia)';
export const INVALID_LABEL = 'Superficie evaluada (no válida)';

export function legendItems(scene: Pick<Scene, 'piezo'> & { surface?: Pick<NonNullable<Scene['surface']>, 'polyline'> | null }, options: LegendOptions = {}): LegendExtraItem[] {
  const { surface = true, unconverged = false, invalid = false, fixedCircle = false, slices = true, bands = false, loads = false, seismic = false, piezoExtrapolated = false, fixedPolyline = false } = options;
  const items: LegendExtraItem[] = [];
  // Con una polilínea la superficie no es «crítica»: la da el usuario (fija) y el cálculo solo la ajusta al terreno.
  const polyline = fixedPolyline || Boolean(scene.surface?.polyline);
  if (surface) {
    items.push(
      unconverged
        ? { key: 'surface', label: invalid ? INVALID_LABEL : UNCONVERGED_LABEL, swatch: 'line-unconverged' }
        : { key: 'surface', label: polyline ? FIXED_POLYLINE_LABEL : fixedCircle ? FIXED_CIRCLE_LABEL : 'Superficie crítica', swatch: 'line-red' },
    );
  } else if (fixedPolyline) {
    items.push({ key: 'surface-fixed', label: FIXED_POLYLINE_LABEL, swatch: 'line-polyline-dashed' });
  }
  if (slices) items.push({ key: 'slices', label: 'Dovelas', swatch: 'slice' });
  if (scene.piezo) items.push({ key: 'piezo', label: 'Piezométrica', swatch: 'line-blue' });
  if (scene.piezo && piezoExtrapolated) items.push({ key: 'piezo-extrapolated', label: 'Piezométrica (extrapolada)', swatch: 'line-blue-dotted' });
  if (bands) {
    items.push({ key: 'band-entry', label: 'Banda de entrada', swatch: 'band-entry' });
    items.push({ key: 'band-exit', label: 'Banda de salida', swatch: 'band-exit' });
  }
  if (loads) items.push({ key: 'loads', label: 'Cargas', swatch: 'line-load' });
  if (seismic) items.push({ key: 'seismic', label: 'Sismo', swatch: 'line-seismic' });
  return items;
}
