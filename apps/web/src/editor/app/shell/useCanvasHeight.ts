// UA-E6: aplica el alto medido del lienzo móvil (ver `canvasHeight.ts`) sobre la tarjeta del lienzo. `active` es «la vista Lienzo está
// visible»: con la vista oculta la tarjeta no tiene caja y no se mide; al volver se vuelve a medir.

import { useLayoutEffect, type RefObject } from 'react';
import { attachCanvasHeight } from './canvasHeight';

export function useCanvasHeight(cardRef: RefObject<HTMLElement | null>, active: boolean): void {
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !active || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    return attachCanvasHeight(card, window as never);
  }, [cardRef, active]);
}
