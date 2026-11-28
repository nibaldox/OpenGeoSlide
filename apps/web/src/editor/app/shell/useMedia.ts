// Consulta de medios como `useSyncExternalStore` (se actualiza al girar o redimensionar). En Node (sin `window`) devuelve `fallback`.

import { useSyncExternalStore } from 'react';
import { DESKTOP_QUERY } from './layout';

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (listener) => {
      if (!hasMatchMedia()) return () => undefined;
      const mq = window.matchMedia(query);
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    },
    () => (hasMatchMedia() ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}

/** `true` desde 761 px de ancho: armazón de tres zonas, la página no hace scroll. */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY, true);
}
