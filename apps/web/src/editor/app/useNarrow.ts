// Barra estrecha (R8 B-09): con 480 px de ancho o menos, las herramientas y Deshacer/Rehacer pasan a un menú «Editar».
// A 320 px la barra con todos los botones medía 298 px de alto y el lienzo empezaba en y = 610.

import { useSyncExternalStore } from 'react';

/** Ancho máximo (px) a partir del cual la barra usa el menú «Editar». */
export const NARROW_MAX_PX = 480;
export const NARROW_QUERY = `(max-width: ${NARROW_MAX_PX}px)`;

export interface ToolbarLayout {
  /** Deshacer, Rehacer y las herramientas van dentro de un menú «Editar» (patrón `DropdownMenu`). */
  editMenu: boolean;
}

export function toolbarLayout(viewportWidthPx: number): ToolbarLayout {
  return { editMenu: viewportWidthPx <= NARROW_MAX_PX };
}

function subscribe(listener: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const mq = window.matchMedia(NARROW_QUERY);
  mq.addEventListener('change', listener);
  return () => mq.removeEventListener('change', listener);
}

const snapshot = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches;

/** `true` si la ventana mide 480 px de ancho o menos (se actualiza al girar o redimensionar). */
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
