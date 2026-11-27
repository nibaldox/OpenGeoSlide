// Pasos de la barra lateral «Modelo» (contrato UA §4.6): rótulos, estado en texto y orden visual del panel en línea.

import type { PanelTabId } from '../issueNav';
import type { StepStatus } from '../shellModel';

/** Título de cada paso: el nombre accesible de su pestaña (no cambia, UA-D2). */
export const STEP_LABELS: Readonly<Record<PanelTabId, string>> = {
  geometry: 'Geometría',
  materials: 'Materiales',
  water: 'Agua',
  surface: 'Superficie',
  search: 'Búsqueda',
  analysis: 'Análisis',
  loads: 'Cargas',
  reinforcements: 'Refuerzos',
  seismic: 'Sismo',
  project: 'Proyecto',
};

/** Estado del paso dicho en una palabra, para `aria-describedby` (el resumen va primero; los dos juntos caben en una frase corta). */
export const STATUS_TEXT: Readonly<Record<StepStatus, string>> = {
  done: 'Completo',
  error: 'Con error',
  draft: 'Borrador',
  optional: 'Opcional',
  empty: 'Vacío',
};

/**
 * Orden visual (propiedad `order`) de las pestañas y del panel. El panel cuelga justo debajo de la pestaña activa sin estar
 * dentro del tablist: pestaña i → 2i, panel → 2·activa + 1.
 */
export function stepOrder(index: number): number {
  return 2 * index;
}
export function panelOrder(activeIndex: number): number {
  return 2 * activeIndex + 1;
}

/** Índice del paso en la lista; −1 si no existe. */
export function stepIndex(order: readonly PanelTabId[], id: PanelTabId): number {
  return order.indexOf(id);
}
