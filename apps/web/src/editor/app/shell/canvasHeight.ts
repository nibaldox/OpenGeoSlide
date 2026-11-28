// UA-E6: alto del lienzo móvil medido con JS. Hasta 760 px la página se apila y el pie de acción es fijo abajo: el alto del
// lienzo se calcula para que la paleta (que va justo debajo del SVG) termine encima del pie a scroll 0. Un alto fijo en CSS no
// puede contar el alto variable de los avisos, del HUD ni del pie. Este archivo no importa React: la fórmula es pura y
// `attachCanvasHeight` solo habla con las interfaces mínimas del DOM que usa, de modo que se prueba en Node con dobles.

import { MOBILE_MAX_PX } from './layout';

/** Alto mínimo del lienzo móvil (px). Sin máximo: en una ventana alta el lienzo crece. */
export const CANVAS_MIN_PX = 200;
/** Holgura entre el final de la paleta y el borde superior del pie (px). */
export const CANVAS_MARGIN_PX = 8;
/** Solo actúa hasta este ancho; en escritorio la tarjeta rellena el alto restante y no se toca nada. */
export const CANVAS_MOBILE_QUERY = `(max-width: ${MOBILE_MAX_PX}px)`;
/** Propiedad CSS que lee `.ua-canvas-card` (el `clamp` de `shell.css` queda como respaldo del primer pintado). */
export const CANVAS_HEIGHT_VAR = '--ua-canvas-h';

export interface CanvasHeightInput {
  /** `window.innerHeight`. */
  viewportH: number;
  /** Alto del pie de acción fijo (0 si está oculto). */
  footH: number;
  /** Borde superior del SVG medido en el documento (no en la ventana): `rect.top + scrollY`. */
  svgTop: number;
  /** Alto de la paleta más sus márgenes verticales. */
  paletteH: number;
  margin?: number;
  min?: number;
}

const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

/** Alto sin acotar: negativo o menor que `min` significa que no cabe. */
export function canvasHeightRaw(i: CanvasHeightInput): number {
  return finite(i.viewportH) - finite(i.footH) - (i.margin ?? CANVAS_MARGIN_PX) - finite(i.svgTop) - finite(i.paletteH);
}

/** `alto = max(MIN, innerHeight − alto del pie − margen − top del SVG en el documento − alto de la paleta y sus márgenes)`. */
export function canvasHeightPx(i: CanvasHeightInput): number {
  return Math.max(i.min ?? CANVAS_MIN_PX, Math.floor(canvasHeightRaw(i)));
}

/** Píxeles que faltan para llegar a `min` (0 si cabe): con ese déficit la paleta cruza el pie a scroll 0. */
export function canvasHeightDeficit(i: CanvasHeightInput): number {
  return Math.max(0, (i.min ?? CANVAS_MIN_PX) - Math.floor(canvasHeightRaw(i)));
}

/* ───────── Aplicación al DOM ───────── */

interface RectLike {
  top: number;
  height: number;
}
interface ElLike {
  getBoundingClientRect(): RectLike;
}
interface CardLike {
  style: { setProperty(name: string, value: string): void; removeProperty(name: string): unknown };
  querySelector(selector: string): ElLike | null;
  getBoundingClientRect(): RectLike;
  ownerDocument: { querySelector(selector: string): ElLike | null };
}
type RoLike = { observe(el: unknown): void; disconnect(): void };
interface WinLike {
  innerHeight: number;
  scrollY: number;
  matchMedia(query: string): { matches: boolean; addEventListener(type: 'change', l: () => void): void; removeEventListener(type: 'change', l: () => void): void };
  getComputedStyle(el: never): { marginTop: string; marginBottom: string };
  addEventListener(type: string, l: () => void): void;
  removeEventListener(type: string, l: () => void): void;
  ResizeObserver?: new (cb: () => void) => RoLike;
}

/** Bloques por encima del SVG (su alto mueve el top del SVG) y el pie. Selectores del armazón (`EditorApp`, `shell.css`). */
export const ABOVE_SVG_SELECTORS = ['.ua-header', '.ua-notices', '.ua-main-head'] as const;
export const FOOT_SELECTOR = '.ua-actions';
export const SVG_SELECTOR = '.ec-root > .ec-svg';
export const PALETTE_SELECTOR = '.ec-palette';

/** Tope de ajustes seguidos sin que la medida se estabilice (red de seguridad contra un bucle de layout). */
export const MAX_STREAK = 10;

const px = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export interface CanvasMetrics extends CanvasHeightInput {
  /** `false` si la tarjeta no tiene caja (vista oculta): no se mide ni se aplica nada. */
  laidOut: boolean;
}

/** Lee del DOM las cuatro medidas de la fórmula. */
export function readCanvasMetrics(card: CardLike, win: WinLike): CanvasMetrics {
  const cardRect = card.getBoundingClientRect();
  const svg = card.querySelector(SVG_SELECTOR);
  const palette = card.querySelector(PALETTE_SELECTOR);
  const foot = card.ownerDocument.querySelector(FOOT_SELECTOR);
  // Sin SVG (estado de carga) el borde de la tarjeta es el del lienzo: `.ec-empty` y el SVG nacen en su esquina superior.
  const top = (svg ? svg.getBoundingClientRect().top : cardRect.top) + win.scrollY;
  let paletteH = 0;
  if (palette) {
    const cs = win.getComputedStyle(palette as never);
    paletteH = palette.getBoundingClientRect().height + px(cs.marginTop) + px(cs.marginBottom);
  }
  return { viewportH: win.innerHeight, footH: foot ? foot.getBoundingClientRect().height : 0, svgTop: top, paletteH, laidOut: cardRect.height > 0 };
}

/**
 * Aplica `--ua-canvas-h` sobre la tarjeta mientras la ventana mide ≤ 760 px. Vuelve a medir con un `ResizeObserver` sobre los
 * bloques que hay por encima del SVG, la paleta y el pie, y con `resize` y `orientationchange`. No observa el SVG ni la tarjeta:
 * cambiar el alto del SVG no mueve su top ni cambia los bloques medidos, así que no hay bucle (y solo se escribe si el valor
 * cambia). Devuelve la función que lo deshace. `onChange` recibe cada alto aplicado (o `null` al quitarlo).
 */
export function attachCanvasHeight(card: CardLike, win: WinLike, onChange?: (heightPx: number | null) => void): () => void {
  const mq = win.matchMedia(CANVAS_MOBILE_QUERY);
  const RO = win.ResizeObserver;
  const ro = RO ? new RO(() => measure()) : null;
  const observed = new Set<unknown>();
  let applied: number | null = null;
  let streak = 0;
  let disposed = false;

  const observe = (el: unknown): void => {
    if (ro && el && !observed.has(el)) {
      observed.add(el);
      ro.observe(el);
    }
  };
  const clear = (): void => {
    if (applied !== null) {
      card.style.removeProperty(CANVAS_HEIGHT_VAR);
      applied = null;
      onChange?.(null);
    }
  };
  function measure(): void {
    if (disposed) return;
    if (!mq.matches) {
      clear();
      streak = 0;
      return;
    }
    for (const s of ABOVE_SVG_SELECTORS) observe(card.ownerDocument.querySelector(s));
    observe(card.ownerDocument.querySelector(FOOT_SELECTOR));
    observe(card.querySelector(PALETTE_SELECTOR));
    const m = readCanvasMetrics(card, win);
    if (!m.laidOut) return;
    const next = canvasHeightPx(m);
    if (next === applied) {
      streak = 0;
      return;
    }
    if (streak >= MAX_STREAK) return;
    streak += 1;
    applied = next;
    card.style.setProperty(CANVAS_HEIGHT_VAR, `${next}px`);
    onChange?.(next);
  }
  const reset = (): void => {
    streak = 0;
    measure();
  };

  mq.addEventListener('change', reset);
  win.addEventListener('resize', reset);
  win.addEventListener('orientationchange', reset);
  measure();
  return () => {
    disposed = true;
    mq.removeEventListener('change', reset);
    win.removeEventListener('resize', reset);
    win.removeEventListener('orientationchange', reset);
    ro?.disconnect();
    clear();
  };
}
