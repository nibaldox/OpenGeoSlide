// Anchos del armazón A (contrato UA §2): lógica pura y constantes que comparten el CSS y el código.

import type { FitInsets } from '../../canvas/EditorCanvas';

/** Hasta este ancho (inclusive) todo se apila y la página hace scroll. Desde el siguiente, la página no hace scroll. */
export const MOBILE_MAX_PX = 760;
export const DESKTOP_MIN_PX = MOBILE_MAX_PX + 1;
export const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_PX}px)`;

export type WidthClass = 'mobile' | 'compact' | 'medium' | 'wide';

/** mobile ≤ 760 · compact 761-1099 · medium 1100-1279 · wide ≥ 1280. */
export function widthClass(widthPx: number): WidthClass {
  if (widthPx <= MOBILE_MAX_PX) return 'mobile';
  if (widthPx < 1100) return 'compact';
  if (widthPx < 1280) return 'medium';
  return 'wide';
}

/** Ancho de la barra lateral: 340, y 300 entre 761 y 1099. `null` en móvil (la barra se apila a todo el ancho). */
export function sideWidth(widthPx: number): number | null {
  const c = widthClass(widthPx);
  return c === 'mobile' ? null : c === 'compact' ? 300 : 340;
}

/** Ancho del HUD: 330, 300 entre 1100 y 1279 y 280 entre 761 y 1099. `null` en móvil (estático, a todo el ancho). */
export function hudWidth(widthPx: number): number | null {
  const c = widthClass(widthPx);
  return c === 'mobile' ? null : c === 'compact' ? 280 : c === 'medium' ? 300 : 330;
}

/** Márgenes que «Encuadrar» deja libres para la paleta, el HUD y la leyenda (contrato §4.2). Identidad estable. */
export const FIT_INSETS_DESKTOP: FitInsets = Object.freeze({ top: 24, right: 92, bottom: 72, left: 24 });
export const FIT_INSETS_MOBILE: FitInsets = Object.freeze({ top: 16, right: 16, bottom: 16, left: 16 });

export function fitInsetsFor(widthPx: number): FitInsets {
  return widthPx >= DESKTOP_MIN_PX ? FIT_INSETS_DESKTOP : FIT_INSETS_MOBILE;
}

/** Con 480 px o menos, Deshacer y Rehacer se pliegan en el menú «Editar» (contrato §2). */
export const NARROW_MAX_PX = 480;
export function undoRedoInMenu(widthPx: number): boolean {
  return widthPx <= NARROW_MAX_PX;
}
