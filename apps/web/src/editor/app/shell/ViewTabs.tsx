// Pestañas numeradas de las vistas (contrato UA §4.7): Lienzo · Resultados · Casos de verificación · Informe.

import { useRef, type ComponentType } from 'react';
import { IconCanvas, IconDoc, IconShield, IconTable, type IconProps } from '../../../ui/icons';
import { useRovingTabIndex } from '../../../ui/useRovingTabIndex';
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
  return (
    <div className="ua-view-tabs" role="tablist" aria-label="Vistas" ref={ref} onKeyDown={keys.onKeyDown}>
      {VIEWS.map((v) => {
        const Icon = ICONS[v.id];
        const selected = view === v.id;
        return (
          <button
            key={v.id}
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
            <span className="ua-view-n" aria-hidden="true">
              {v.number}
            </span>
          </button>
        );
      })}
    </div>
  );
}
