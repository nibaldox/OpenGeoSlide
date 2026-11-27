// Guía de primera visita (UX-12): lógica pura. Los pasos, la máquina de estados, la persistencia (`ogs.onboarding.v1`) y la
// colocación del cuadro junto al control destacado viven aquí, sin DOM, para probarlos en Node. `GuidedTour.tsx` los dibuja.

export const ONBOARDING_KEY = 'ogs.onboarding.v1';

/** Control real de la aplicación que destaca un paso: selector CSS y, si hace falta, expresión regular sobre su texto. */
export interface TargetSpec {
  selector: string;
  text?: string;
}

export interface TourStep {
  id: 'open' | 'materials' | 'check' | 'results' | 'report';
  title: string;
  body: string;
  target: TargetSpec;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'open',
    title: 'Abra un ejemplo o empiece un modelo',
    body: 'En «Archivo», en la cabecera, puede abrir un ejemplo publicado (por ejemplo, V047a), abrir un archivo guardado, importar un DXF o un CSV, o empezar un modelo vacío o un talud simple. Un modelo vacío se dibuja en el lienzo con la herramienta «Dibujar región» (tecla R), en la paleta flotante.',
    target: { selector: '.dd-trigger', text: '^Archivo' },
  },
  {
    id: 'materials',
    title: 'Defina geometría, materiales y agua',
    body: 'En la barra lateral «Modelo», cada paso se abre en línea y muestra un resumen de su estado. Se editan la geometría (regiones y vértices), los materiales (peso unitario, cohesión y ángulo de fricción), el agua (línea piezométrica), la superficie o la búsqueda, el análisis, las cargas, el sismo y los datos del proyecto (título y unidades).',
    // El tablist es `display: contents` (sin caja): se señala el contenedor de los pasos.
    target: { selector: '.ua-steps' },
  },
  {
    id: 'check',
    title: 'Pulse «Comprobar»',
    body: '«Comprobar», al pie de la barra lateral, valida el modelo y calcula el factor de seguridad (FS) con los métodos elegidos en «Análisis». También funciona con Ctrl+Intro.',
    target: { selector: 'button.ea-primary' },
  },
  {
    id: 'results',
    title: 'Lea el FS y los avisos',
    body: 'Este resumen sobre el lienzo muestra el FS mínimo y el de cada método, y si convergió. Revise también los avisos y las notas: el detalle está en la vista «Resultados», junto con «Diagnósticos».',
    target: { selector: '[data-testid="result-summary"]' },
  },
  {
    id: 'report',
    title: 'Exporte el informe',
    body: 'Con un cálculo vigente, «Informe PDF» genera el informe con el modelo, la superficie crítica y los resultados; la vista «Informe» lista su contenido. Los CSV están en «Exportar». Los resultados deben ser revisados por un profesional competente.',
    target: { selector: '.ua-actions button', text: '^(Informe PDF|Generando)' },
  },
];

/** ¿El texto del elemento cumple lo que pide el paso? Sin `text`, basta el selector. */
export function matchesTarget(target: TargetSpec, elementText: string): boolean {
  return target.text === undefined || new RegExp(target.text).test(elementText.trim());
}

// ───────── Máquina de estados ─────────

export interface TourState {
  open: boolean;
  index: number;
}

export type TourAction = { type: 'open' } | { type: 'next' } | { type: 'prev' } | { type: 'skip' };

export function initialTour(): TourState {
  return { open: false, index: 0 };
}

export function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case 'open':
      return { open: true, index: 0 };
    case 'skip':
      return initialTour();
    case 'next':
      if (!state.open) return state;
      return state.index >= TOUR_STEPS.length - 1 ? initialTour() : { open: true, index: state.index + 1 };
    case 'prev':
      if (!state.open) return state;
      return { open: true, index: Math.max(0, state.index - 1) };
  }
}

export function stepProgress(index: number): { label: string; first: boolean; last: boolean } {
  return { label: `Paso ${index + 1} de ${TOUR_STEPS.length}`, first: index === 0, last: index === TOUR_STEPS.length - 1 };
}

// ───────── Persistencia ─────────

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * ¿Ya se mostró la guía? Cualquier valor guardado cuenta. Si el almacenamiento no está disponible (modo privado, política
 * del navegador) se da por vista: no se puede recordar la respuesta y no se debe insistir en cada visita.
 */
export function hasSeenTour(storage: StorageLike | null): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(ONBOARDING_KEY) !== null;
  } catch {
    return true;
  }
}

export function markTourSeen(storage: StorageLike | null): void {
  try {
    storage?.setItem(ONBOARDING_KEY, 'seen');
  } catch {
    /* sin almacenamiento: la guía se podrá reabrir desde «Ayuda» */
  }
}

/** Primera visita en una vista del editor (no en «Casos de verificación»): abre la guía y la deja marcada como vista (recargar a mitad no la repite). */
export function autoOpenTour(storage: StorageLike | null, ctx: { editing: boolean }): boolean {
  if (!ctx.editing || hasSeenTour(storage)) return false;
  markTourSeen(storage);
  return true;
}

// ───────── Colocación del cuadro ─────────

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Size {
  width: number;
  height: number;
}
export type Placement = 'below' | 'above' | 'right' | 'left' | 'floating' | 'center';
export interface Placed {
  left: number;
  top: number;
  placement: Placement;
}

export const POPOVER_GAP = 12;
export const VIEWPORT_MARGIN = 8;
export const RING_PAD = 4;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(v, Math.max(lo, hi)));

/**
 * Coloca el cuadro junto al control: debajo, encima, a la derecha o a la izquierda, el primero que cabe entero en el
 * viewport sin tapar el control. Si ninguno cabe, queda «flotando» abajo, dentro del viewport. Sin control (oculto o
 * inexistente) se centra abajo.
 */
export function placePopover(target: Rect | null, pop: Size, vp: Size): Placed {
  const m = VIEWPORT_MARGIN;
  const maxLeft = vp.width - m - pop.width;
  const maxTop = vp.height - m - pop.height;
  const bottomCenter = (placement: Placement): Placed => ({
    placement,
    left: clamp((vp.width - pop.width) / 2, m, maxLeft),
    top: clamp(vp.height - pop.height - m, m, maxTop),
  });
  if (!target) return bottomCenter('center');

  const cx = target.x + target.width / 2;
  const cy = target.y + target.height / 2;
  const candidates: Placed[] = [
    { placement: 'below', left: clamp(cx - pop.width / 2, m, maxLeft), top: target.y + target.height + POPOVER_GAP },
    { placement: 'above', left: clamp(cx - pop.width / 2, m, maxLeft), top: target.y - POPOVER_GAP - pop.height },
    { placement: 'right', left: target.x + target.width + POPOVER_GAP, top: clamp(cy - pop.height / 2, m, maxTop) },
    { placement: 'left', left: target.x - POPOVER_GAP - pop.width, top: clamp(cy - pop.height / 2, m, maxTop) },
  ];
  const fits = (c: Placed): boolean => c.left >= m && c.top >= m && c.left + pop.width <= vp.width - m && c.top + pop.height <= vp.height - m;
  return candidates.find(fits) ?? bottomCenter('floating');
}

/** Rectángulo del anillo: el control con un pequeño margen para que el contorno no lo tape. */
export function ringRect(target: Rect): Rect {
  return { x: target.x - RING_PAD, y: target.y - RING_PAD, width: target.width + 2 * RING_PAD, height: target.height + 2 * RING_PAD };
}

// ───────── Esc global (A-06) ─────────

export interface EscapeContext {
  key: string;
  /** Otro manejador ya atendió la tecla (p. ej. el lienzo cancelando un trazo). */
  defaultPrevented: boolean;
  /** Hay un `<dialog>` abierto (modal): tiene prioridad y el Esc es suyo. */
  dialogOpen: boolean;
  /** Hay un menú desplegable (`popover="auto"`) abierto: Esc lo cierra a él primero. */
  menuOpen: boolean;
}

/** ¿Esc debe cerrar la guía? Desde cualquier lugar de la página, salvo si un diálogo, un menú o un manejador ya lo usaron. */
export function shouldCloseTourOnEscape(ctx: EscapeContext): boolean {
  return ctx.key === 'Escape' && !ctx.defaultPrevented && !ctx.dialogOpen && !ctx.menuOpen;
}
