// Pestañas de «Vistas» que no caben (UA-E3 §3): qué lado del `tablist` queda recortado, para mostrarlo con un borde. Lógica pura.

export interface TabsScroll {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

export interface TabsEdges {
  /** Hay pestañas recortadas a la izquierda (al inicio de la lectura). */
  start: boolean;
  /** Hay pestañas recortadas a la derecha. */
  end: boolean;
}

/** Con una tolerancia de 1 px por los redondeos de subpíxeles. */
export function tabsEdges({ scrollLeft, clientWidth, scrollWidth }: TabsScroll): TabsEdges {
  const left = Math.abs(scrollLeft);
  return { start: left > 1, end: left + clientWidth < scrollWidth - 1 };
}

/** `scrollLeft` que deja a la vista la pestaña `[left, left + width)` con el mínimo desplazamiento (0 si ya se ve). */
export function scrollToReveal({ scrollLeft, clientWidth }: TabsScroll, tab: { left: number; width: number }): number {
  if (tab.left < scrollLeft) return tab.left;
  if (tab.left + tab.width > scrollLeft + clientWidth) return tab.left + tab.width - clientWidth;
  return scrollLeft;
}
