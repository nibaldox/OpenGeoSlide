// Pestañas numeradas de las vistas (contrato UA §4.7): Lienzo · Resultados · Casos de verificación · Informe.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import { IconCanvas, IconDoc, IconShield, IconTable, type IconProps } from '../../../ui/icons';
import { useRovingTabIndex } from '../../../ui/useRovingTabIndex';
import { scrollToReveal, tabsEdges, type TabsEdges } from './tabsOverflow';
import { VIEWS, type ViewId } from './views';

const ICONS: Record<ViewId, ComponentType<IconProps>> = {
  canvas: IconCanvas,
  results: IconTable,
  cases: IconShield,
  report: IconDoc,
};

export function ViewTabs({ view, onChange }: { view: ViewId; onChange: (v: ViewId) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const keys = useRovingTabIndex(ref, { selector: '[role="tab"]', orientation: 'horizontal', activateOnFocus: true });
  // UA-E3 §3: si las pestañas no caben, el borde del lado recortado lo dice (no se recortan en silencio).
  const [edges, setEdges] = useState<TabsEdges>({ start: false, end: false });
  const measure = useCallback((): void => {
    const el = ref.current;
    if (!el) return;
    const next = tabsEdges(el);
    setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);
  useLayoutEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [measure]);
  // La pestaña activa siempre queda a la vista (cambios de vista programáticos: «Ver tabla de resultados», la guía…).
  useEffect(() => {
    const el = ref.current;
    const tab = el?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.parentElement;
    if (!el || !tab) return;
    const to = scrollToReveal(el, { left: tab.offsetLeft, width: tab.offsetWidth });
    if (to !== el.scrollLeft) el.scrollLeft = to;
    measure();
  }, [view, measure]);
  return (
    <div
      className="ua-view-tabs"
      role="tablist"
      aria-label="Vistas"
      ref={ref}
      onKeyDown={keys.onKeyDown}
      onScroll={measure}
      data-more-start={edges.start ? 'true' : undefined}
      data-more-end={edges.end ? 'true' : undefined}
    >
      {VIEWS.map((v) => {
        const Icon = ICONS[v.id];
        const selected = view === v.id;
        return (
          <div key={v.id} className="ua-view-tab-wrap" role="presentation">
            <button
              type="button"
              role="tab"
              id={v.tabId}
              className={selected ? 'ua-view-tab ua-view-tab-active' : 'ua-view-tab'}
              aria-selected={selected}
              aria-controls={v.panelId}
              onClick={() => onChange(v.id)}
            >
              <Icon size={16} />
              <span className="ua-view-label">{v.label}</span>
            </button>
            {/* El contador es un hermano decorativo: el texto visible del botón es su nombre (WCAG 2.5.3). */}
            <span className="ua-view-n" aria-hidden="true">
              {v.number}
            </span>
          </div>
        );
      })}
    </div>
  );
}
