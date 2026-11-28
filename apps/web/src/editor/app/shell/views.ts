// Vistas del armazón A (contrato UA §4.7): lienzo, resultados, casos de verificación e informe. Lógica pura, probada en Node.

import type { ShortcutAction } from '../shortcuts';

export type ViewId = 'canvas' | 'results' | 'cases' | 'report';

export interface ViewDef {
  id: ViewId;
  /** `id` de la pestaña del tablist «Vistas». «Lienzo» conserva el de la pestaña «Editar» de siempre. */
  tabId: string;
  /** `id` del panel que cuelga de la pestaña (los cuatro paneles quedan montados; los ocultos llevan `hidden`). */
  panelId: string;
  /** Nombre accesible de la pestaña y título (h2) de la vista. */
  label: string;
  /** Número que se ve en la pestaña (fuera del nombre accesible). */
  number: number;
}

export const VIEWS: readonly ViewDef[] = [
  { id: 'canvas', tabId: 'mode-edit', panelId: 'mode-edit-panel', label: 'Lienzo', number: 1 },
  { id: 'results', tabId: 'view-results', panelId: 'view-results-panel', label: 'Resultados', number: 2 },
  { id: 'cases', tabId: 'mode-cases', panelId: 'mode-cases-panel', label: 'Casos de verificación', number: 3 },
  { id: 'report', tabId: 'view-report', panelId: 'view-report-panel', label: 'Informe', number: 4 },
];

export const DEFAULT_VIEW: ViewId = 'canvas';

export function viewDef(id: ViewId): ViewDef {
  return VIEWS.find((v) => v.id === id) ?? VIEWS[0]!;
}

/** Título (h2) del área principal: el nombre de la vista. */
export function viewTitle(id: ViewId): string {
  return viewDef(id).label;
}

/** Acciones de documento (valen en toda vista salvo Casos) frente a herramientas del lienzo (solo en Lienzo). */
const DOCUMENT_ACTIONS: ReadonlySet<ShortcutAction> = new Set<ShortcutAction>(['undo', 'redo', 'save', 'open', 'check']);

export function isDocumentAction(action: ShortcutAction): boolean {
  return DOCUMENT_ACTIONS.has(action);
}

/**
 * ¿Actúa este atajo en esta vista? Ctrl Z, Ctrl Y, Ctrl S, Ctrl O y Ctrl Intro: Lienzo, Resultados e Informe. Las teclas de
 * herramienta: solo Lienzo. En Casos no actúa ninguno (R7-07: el editor sigue montado pero oculto).
 */
export function shortcutActsIn(view: ViewId, action: ShortcutAction): boolean {
  if (view === 'cases') return false;
  if (view === 'canvas') return true;
  return isDocumentAction(action);
}

/** ¿Está el lienzo a la vista? (el SVG está siempre montado; esto decide si los controles del lienzo se ofrecen). */
export function canvasVisible(view: ViewId): boolean {
  return view === 'canvas';
}

/** Vista vecina con flechas (da la vuelta): `step` = +1 o −1. */
export function neighborView(id: ViewId, step: 1 | -1): ViewId {
  const i = VIEWS.findIndex((v) => v.id === id);
  return VIEWS[(i + step + VIEWS.length) % VIEWS.length]!.id;
}

/** Vista de la que viene `PanelTabId` para volver al lienzo cuando una incidencia apunta a él. */
export function viewForIssueTarget(tab: string | null, current: ViewId): ViewId {
  return tab === null ? 'canvas' : current;
}

export type ShortcutDisposition = 'run' | 'swallow' | 'ignore';

/**
 * Qué hace el armazón con un atajo (UA-E3 §1). `run`: ejecuta la acción. `swallow`: no hace nada pero llama a `preventDefault()`
 * (en Casos, un atajo de documento fuera de un campo de Casos: si no, el navegador aplicaría su deshacer a un campo del editor
 * oculto). `ignore`: el evento sigue su camino.
 */
export function shortcutDisposition(view: ViewId, action: ShortcutAction, inField: boolean): ShortcutDisposition {
  if (shortcutActsIn(view, action)) return 'run';
  return view === 'cases' && isDocumentAction(action) && !inField ? 'swallow' : 'ignore';
}
