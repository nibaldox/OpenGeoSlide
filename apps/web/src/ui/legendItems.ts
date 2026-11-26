// Elementos de la leyenda de la sección (Casos y editor). Lógica pura: qué se muestra según lo que hay dibujado.

import type { Scene } from '../render/scene';

export type LegendSwatch = 'line-red' | 'line-unconverged' | 'slice' | 'line-blue' | 'line-blue-dotted' | 'band-entry' | 'band-exit' | 'line-load' | 'line-seismic';

export interface LegendExtraItem {
  key: string;
  label: string;
  swatch: LegendSwatch;
}

export interface LegendOptions {
  /** Muestra «Superficie crítica» (por defecto sí). `false` en el editor mientras no hay resultado dibujado. */
  surface?: boolean;
  /** La superficie dibujada no convergió: se rotula «Superficie evaluada (sin convergencia)» con trazo discontinuo. */
  unconverged?: boolean;
  /** Muestra «Dovelas» (por defecto sí). */
  slices?: boolean;
  /** Bandas de entrada y salida de la búsqueda de superficie. */
  bands?: boolean;
  loads?: boolean;
  seismic?: boolean;
  /** La piezométrica no cubre todo el ancho y el motor la prolonga en horizontal: se rotula el tramo punteado (R9-05d). El editor lo calcula con `piezoExtension`. */
  piezoExtrapolated?: boolean;
}

/** Elementos distintos de los materiales, en orden fijo: superficie, dovelas, piezométrica, bandas, cargas, sismo. */
export function legendItems(scene: Pick<Scene, 'piezo'>, options: LegendOptions = {}): LegendExtraItem[] {
  const { surface = true, unconverged = false, slices = true, bands = false, loads = false, seismic = false, piezoExtrapolated = false } = options;
  const items: LegendExtraItem[] = [];
  if (surface) {
    items.push(
      unconverged
        ? { key: 'surface', label: 'Superficie evaluada (sin convergencia)', swatch: 'line-unconverged' }
        : { key: 'surface', label: 'Superficie crítica', swatch: 'line-red' },
    );
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
