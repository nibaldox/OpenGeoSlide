// Tabindex itinerante (ARIA APG) para `tablist` y `toolbar`: una sola parada de tabulación, flechas, Inicio y Fin.
// Opera sobre el DOM del contenedor: los elementos son los que cumplen `selector` fuera de cualquier `[popover]`.

import { useCallback, useEffect, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { nextRovingIndex, tabStopIndex, type RovingOrientation } from './rovingTabIndex';

export interface RovingOptions {
  /** Elementos navegables dentro del contenedor (por defecto, botones). */
  selector?: string;
  orientation?: RovingOrientation;
  /** Activa (clic) el elemento al recibir el foco por flechas: pestañas con activación automática. */
  activateOnFocus?: boolean;
}

/**
 * Índice del elemento que se recuerda como parada de tabulación (UA3 A-11). Con el foco dentro del grupo manda el último
 * elemento enfocado. Con el foco fuera (un cambio programático de paso o de vista) manda el elemento con `aria-selected="true"`,
 * si está habilitado; si no, el recordado.
 */
export function rememberedIndex({ focusInside, remembered, selected, enabled }: { focusInside: boolean; remembered: number; selected: number; enabled: readonly boolean[] }): number {
  if (!focusInside && selected >= 0 && enabled[selected]) return selected;
  return remembered;
}

function isEnabled(el: HTMLElement): boolean {
  return !(el instanceof HTMLButtonElement && el.disabled) && el.getAttribute('aria-disabled') !== 'true';
}

function itemsOf(container: HTMLElement, selector: string): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((el) => !el.closest('[popover]'));
}

/** Devuelve `onKeyDown` para el contenedor; mantiene `tabindex` (0 en uno, -1 en el resto) aunque cambie el DOM. */
export function useRovingTabIndex(ref: RefObject<HTMLElement | null>, options: RovingOptions = {}): { onKeyDown: (e: KeyboardEvent<HTMLElement>) => void } {
  const { selector = 'button', orientation = 'horizontal', activateOnFocus = false } = options;
  const remembered = useRef<HTMLElement | null>(null);

  const sync = useCallback(() => {
    const container = ref.current;
    if (!container) return;
    const items = itemsOf(container, selector);
    const enabled = items.map(isEnabled);
    const focusInside = container.contains(document.activeElement);
    const idx = rememberedIndex({
      focusInside,
      remembered: remembered.current ? items.indexOf(remembered.current) : -1,
      selected: items.findIndex((el) => el.getAttribute('aria-selected') === 'true'),
      enabled,
    });
    if (!focusInside && idx >= 0 && items[idx]) remembered.current = items[idx];
    const stop = tabStopIndex(enabled, idx);
    items.forEach((el, i) => {
      const want = i === stop ? '0' : '-1';
      if (el.getAttribute('tabindex') !== want) el.setAttribute('tabindex', want);
    });
  }, [ref, selector]);

  // En cada render (un botón puede habilitarse o deshabilitarse) y ante cambios de `disabled` / nodos.
  useLayoutEffect(sync);
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const observer = new MutationObserver(sync);
    observer.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'aria-selected'] });
    const onFocusIn = (e: FocusEvent): void => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t && itemsOf(container, selector).includes(t)) {
        remembered.current = t;
        sync();
      }
    };
    container.addEventListener('focusin', onFocusIn);
    return () => {
      observer.disconnect();
      container.removeEventListener('focusin', onFocusIn);
    };
  }, [ref, selector, sync]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>): void => {
      const container = ref.current;
      if (!container || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (!target || target.closest('[popover]') || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      const items = itemsOf(container, selector).filter(isEnabled);
      const next = nextRovingIndex({ key: e.key, index: items.indexOf(target), count: items.length, orientation, rtl: getComputedStyle(container).direction === 'rtl' });
      if (next === null || !items[next]) return;
      e.preventDefault();
      const el = items[next];
      remembered.current = el;
      sync();
      el.focus();
      if (activateOnFocus) el.click();
    },
    [ref, selector, orientation, activateOnFocus, sync],
  );

  return { onKeyDown };
}
