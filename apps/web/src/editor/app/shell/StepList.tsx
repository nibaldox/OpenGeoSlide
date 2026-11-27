// Barra lateral «Modelo»: los diez pasos y el panel en línea justo debajo del paso activo (contrato UA §4.6).
// El tablist contiene solo las diez pestañas; el panel es su hermano (fuera del tablist) y se coloca debajo del paso activo
// con `order` (el tablist es `display: contents`). Orden de foco: paso activo → contenido del panel → pie de acción.

import { useId, useRef, type ReactNode } from 'react';
import { IconCheck, IconChevronDown } from '../../../ui/icons';
import { useRovingTabIndex } from '../../../ui/useRovingTabIndex';
import type { PanelTabId } from '../issueNav';
import type { StepState, StepStatus } from '../shellModel';
import { panelOrder, STATUS_TEXT, stepIndex, STEP_LABELS, stepOrder } from './steps';

/** «!» de la insignia de error, en SVG (sin glifos de texto). */
function BangMark() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M12 6v7" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function DraftMark() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

/** Contenido de la insignia: ✓ (hecho), ! (error), punto (borrador) o el número del paso (opcional y vacío). */
function BadgeMark({ status, number }: { status: StepStatus; number: number }) {
  if (status === 'done') return <IconCheck size={15} />;
  if (status === 'error') return <BangMark />;
  if (status === 'draft') return <DraftMark />;
  return <>{number}</>;
}

export interface StepListProps {
  order: readonly PanelTabId[];
  states: Readonly<Record<PanelTabId, StepState>>;
  active: PanelTabId;
  /** Único camino para cambiar de paso (confirma si hay borradores sin aplicar). */
  onSelect: (id: PanelTabId) => void;
  /** Panel activo (el formulario del paso). */
  children: ReactNode;
}

export function StepList({ order, states, active, onSelect, children }: StepListProps) {
  const tablistRef = useRef<HTMLDivElement>(null);
  const keys = useRovingTabIndex(tablistRef, { selector: '[role="tab"]', orientation: 'vertical', activateOnFocus: true });
  const base = useId();
  const activeIndex = Math.max(0, stepIndex(order, active));
  return (
    <div className="ua-steps" data-testid="ua-steps">
      <div className="ua-tablist" role="tablist" aria-label="Paneles del modelo" aria-orientation="vertical" ref={tablistRef} onKeyDown={keys.onKeyDown}>
        {order.map((id, i) => {
          const state = states[id];
          const titleId = `${base}-${id}-t`;
          const subId = `${base}-${id}-s`;
          const statusId = `${base}-${id}-b`;
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`ea-tab-${id}`}
              className={selected ? 'ua-step ea-tab ea-tab-active' : 'ua-step ea-tab'}
              aria-selected={selected}
              aria-controls="ea-tabpanel"
              aria-labelledby={titleId}
              aria-describedby={`${subId} ${statusId}`}
              data-status={state.status}
              style={{ order: stepOrder(i) }}
              onClick={() => onSelect(id)}
            >
              <span className="gs-badge ua-badge" data-status={state.status} aria-hidden="true">
                <BadgeMark status={state.status} number={i + 1} />
              </span>
              <span className="ua-step-text">
                <span id={titleId} className="ua-step-title">
                  {STEP_LABELS[id]}
                </span>
                <span id={subId} className="ua-step-sub">
                  {state.summary}
                </span>
                <span id={statusId} className="visually-hidden">
                  {STATUS_TEXT[state.status]}
                </span>
              </span>
              <span className="ua-step-chevron" aria-hidden="true">
                <IconChevronDown size={16} />
              </span>
            </button>
          );
        })}
      </div>
      <div id="ea-tabpanel" className="ua-panel" role="tabpanel" aria-labelledby={`ea-tab-${active}`} style={{ order: panelOrder(activeIndex) }}>
        {children}
      </div>
    </div>
  );
}
