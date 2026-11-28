// Guía de primera visita (UX-12): lógica pura. Los pasos, la máquina de estados, la persistencia (`ogs.onboarding.v1`) y la
// colocación del cuadro junto al control destacado viven aquí, sin DOM, para probarlos en Node. `GuidedTour.tsx` los dibuja.

export const ONBOARDING_KEY = 'ogs.onboarding.v1';

/** Control real de la aplicación que destaca un paso: selector CSS y, si hace falta, expresión regular sobre su texto. */
export interface TargetSpec {
  selector: string;
  text?: string;
}

export interface TourStep {
  id: 'check' | 'materials' | 'open' | 'import' | 'help';
  title: string;
  body: string;
  target: TargetSpec;
}

// CM-WC: la guía parte del modelo que ya está abierto (al arrancar, el ejemplo ACADS 1(a)) y señala «Comprobar»: el primer
// factor de seguridad está a un clic. Los demás pasos cubren editar, abrir otro ejemplo, importar y la Ayuda.
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'check',
    title: 'Pulse «Comprobar» para obtener el FS',
    body: 'Al arrancar está abierto el ejemplo ACADS 1(a). Pulse «Comprobar», al pie de la barra lateral, para obtener su factor de seguridad (FS) con los métodos elegidos en «Análisis»; con otro modelo abierto, calcula el de ese modelo. También funciona con Ctrl+Intro. El FS y los avisos aparecen en el resumen sobre el lienzo.',
    target: { selector: 'button.ea-primary' },
  },
  {
    id: 'materials',
    title: 'Edite geometría, materiales y agua',
    body: 'En la barra lateral «Modelo», cada paso se abre en línea y muestra un resumen de su estado. Se editan la geometría (regiones y vértices), los materiales (peso unitario, cohesión y ángulo de fricción), el agua (línea piezométrica), la superficie o la búsqueda, el análisis, las cargas, el sismo y los datos del proyecto (título y unidades). Después de editar, vuelva a pulsar «Comprobar».',
    // El tablist es `display: contents` (sin caja): se señala el contenedor de los pasos.
    target: { selector: '.ua-steps' },
  },
  {
    id: 'open',
    title: 'Abra otro ejemplo o empiece un modelo',
    body: 'En «Archivo», la lista «Ejemplos» abre otro caso publicado como modelo (por ejemplo, V001). También puede abrir un archivo guardado, empezar un modelo vacío o crear un talud simple. Un modelo vacío se dibuja en el lienzo con la herramienta «Dibujar región» (tecla R), en la paleta flotante.',
    target: { selector: '.dd-trigger', text: '^Archivo' },
  },
  {
    id: 'import',
    title: 'Importe un DXF o un CSV',
    body: 'En «Archivo», «Importar DXF» e «Importar CSV» traen regiones (o la línea piezométrica) desde un archivo. Sobre el modelo de arranque sin cambios, la importación lo reemplaza; sobre otro modelo, se agrega a sus regiones, y puede elegir lo contrario. Si no tiene un archivo, el diálogo de importación y la Ayuda ofrecen un DXF y un CSV de ejemplo.',
    target: { selector: '.dd-trigger', text: '^Archivo' },
  },
  {
    id: 'help',
    title: 'Consulte la Ayuda',
    body: 'La «Ayuda» reúne el glosario, los atajos de teclado y las limitaciones, y repite esta guía. Con un cálculo vigente, «Informe PDF» genera el informe con el modelo, la superficie crítica y los resultados. Los resultados deben ser revisados por un profesional competente.',
    target: { selector: 'button.help-button' },
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

/**
 * Parte del control que se ve en el viewport (UA2-F8): un destino más alto que la pantalla (la lista de pasos apilada a 390 px
 * mide más de 1400 px) no puede resaltarse entero; el anillo se limita a la parte visible, con el margen del propio anillo.
 */
export function clipRect(target: Rect, vp: Size, inset: number = RING_PAD): Rect {
  const x0 = Math.max(target.x, inset);
  const y0 = Math.max(target.y, inset);
  const x1 = Math.min(target.x + target.width, vp.width - inset);
  const y1 = Math.min(target.y + target.height, vp.height - inset);
  if (x1 <= x0 || y1 <= y0) return target; // fuera de la pantalla: se deja como está (el anillo quedará fuera hasta el próximo ajuste)
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Cómo desplazar el destino a la vista con `scrollIntoView` (UA2-F8): si es más alto que el viewport, por su inicio; si ya se
 * ve entero con un margen, `nearest` (no mueve nada); si queda cortado o fuera, al centro (no pegado al borde).
 */
export function revealBlock(target: Rect, vpHeight: number, margin: number = VIEWPORT_MARGIN): 'start' | 'center' | 'nearest' {
  if (target.height > vpHeight - 2 * margin) return 'start';
  return target.y >= margin && target.y + target.height <= vpHeight - margin ? 'nearest' : 'center';
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
