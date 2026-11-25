// Lógica pura del tabindex itinerante (ARIA APG: tablist, toolbar, menú). Sin DOM: la envoltura de React está en
// `useRovingTabIndex.ts`.

export type RovingOrientation = 'horizontal' | 'vertical' | 'both';

export interface RovingKeyInput {
  key: string;
  /** Índice actual dentro de los elementos habilitados; `-1` si el foco no está en uno de ellos. */
  index: number;
  /** Número de elementos habilitados. */
  count: number;
  orientation: RovingOrientation;
  /** Da la vuelta al llegar al extremo (por defecto sí). */
  wrap?: boolean;
  /** Dirección de lectura de derecha a izquierda: invierte las flechas horizontales. */
  rtl?: boolean;
}

/**
 * Índice destino para una tecla de navegación, o `null` si la tecla no navega (el llamador no debe interceptarla).
 * Inicio y Fin van al primero y al último; las flechas de la orientación avanzan o retroceden.
 */
export function nextRovingIndex({ key, index, count, orientation, wrap = true, rtl = false }: RovingKeyInput): number | null {
  if (count <= 0) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const horizontal = orientation === 'horizontal' || orientation === 'both';
  const vertical = orientation === 'vertical' || orientation === 'both';
  let step = 0;
  if (horizontal && key === 'ArrowRight') step = rtl ? -1 : 1;
  else if (horizontal && key === 'ArrowLeft') step = rtl ? 1 : -1;
  else if (vertical && key === 'ArrowDown') step = 1;
  else if (vertical && key === 'ArrowUp') step = -1;
  else return null;
  const from = index < 0 ? (step > 0 ? -1 : count) : index;
  const to = from + step;
  if (to < 0) return wrap ? count - 1 : 0;
  if (to >= count) return wrap ? 0 : count - 1;
  return to;
}

/**
 * Qué elemento es la única parada de tabulación: el recordado si sigue disponible; si no, el primero habilitado.
 * `enabled[i]` indica si el elemento `i` está habilitado; devuelve `-1` si no hay ninguno.
 */
export function tabStopIndex(enabled: readonly boolean[], remembered: number): number {
  if (remembered >= 0 && remembered < enabled.length && enabled[remembered]) return remembered;
  return enabled.findIndex(Boolean);
}
