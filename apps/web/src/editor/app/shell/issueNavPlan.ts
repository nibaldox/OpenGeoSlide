// Qué hace el armazón al pulsar una incidencia de Diagnósticos (UA3 A-10, A-09). Lógica pura, probada en Node.

import type { IssueTarget, PanelTabId } from '../issueNav';

export interface IssueNavPlan {
  /** Paso de la barra lateral que se abre (con confirmación si hay borradores), o `null`. */
  step: PanelTabId | null;
  /** Se vuelve a «Lienzo»: el destino es el lienzo o su paleta (`tab === null`, o `focus` con controles que solo se ven allí). */
  toCanvas: boolean;
  /** Se despliega la barra lateral (y se guarda): el destino es un campo de un paso. */
  expandSide: boolean;
}

export function issueNavPlan(target: IssueTarget): IssueNavPlan {
  const canvasControls = (target.focus?.length ?? 0) > 0;
  const toCanvas = target.tab === null || canvasControls;
  return { step: target.tab, toCanvas, expandSide: target.tab !== null && !canvasControls };
}
