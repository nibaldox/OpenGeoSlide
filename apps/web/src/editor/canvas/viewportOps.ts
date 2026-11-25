// Operaciones puras sobre el viewport (zoom, pan, ajuste al contenido). `geometry/viewport.ts` es de solo lectura.

import { fitViewport, screenToWorld, type Bounds, type Viewport } from '../../geometry/viewport';
import type { ModelDoc } from '../types';
import { piezoPoints } from './geom';

export const MIN_SCALE = 0.01;
export const MAX_SCALE = 1e5;

/** Cambia la escala por `factor` manteniendo fijo el punto del mundo que está bajo (sx, sy). */
export function zoomAt(vp: Viewport, sx: number, sy: number, factor: number): Viewport {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, vp.scale * factor));
  const [wx, wy] = screenToWorld(vp, sx, sy);
  return { ...vp, scale, tx: sx - scale * wx, ty: sy + scale * wy };
}

/** Desplaza la vista (dx, dy) píxeles. */
export function panBy(vp: Viewport, dx: number, dy: number): Viewport {
  return { ...vp, tx: vp.tx + dx, ty: vp.ty + dy };
}

/**
 * Cambia el tamaño del lienzo conservando el punto del mundo que está en su centro, de modo que un modelo
 * centrado sigue centrado (y no queda un margen vacío en un lado cuando el lienzo crece o se encoge).
 */
export function resizeViewport(vp: Viewport, width: number, height: number): Viewport {
  return { ...vp, width, height, tx: vp.tx + (width - vp.width) / 2, ty: vp.ty + (height - vp.height) / 2 };
}

/** Factor de zoom para un `deltaY` de rueda (negativo acerca). */
export function wheelFactor(deltaY: number): number {
  const clamped = Math.max(-200, Math.min(200, deltaY));
  return Math.exp(-clamped * 0.0015);
}

/** Cuadro delimitador de regiones y piezométrica; por defecto un cuadro de 60 × 30 si el modelo está vacío (el tamaño de un talud típico para empezar a dibujar). */
export function docBounds(doc: ModelDoc): Bounds {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const region of doc.regions) {
    for (const [x, y] of region.polygon) {
      xs.push(x);
      ys.push(y);
    }
  }
  for (const [x, y] of piezoPoints(doc)) {
    xs.push(x);
    ys.push(y);
  }
  if (xs.length === 0) return { minX: 0, maxX: 60, minY: 0, maxY: 30 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const x of xs) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  for (const y of ys) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

/** Espacio libre del encuadre, como fracción del alto del modelo: bajo la base y a los lados (para dibujar estratos), y arriba. */
export const FIT_PAD_BELOW = 0.25;
export const FIT_PAD_SIDE = 0.25;
export const FIT_PAD_TOP = 0.1;

/** Cuadro delimitador ampliado con el espacio libre del encuadre (UX9-01): al menos 25 % del alto bajo la base y a los lados. */
export function paddedBounds(b: Bounds): Bounds {
  const span = b.maxY - b.minY;
  const h = span > 1e-9 ? span : Math.max((b.maxX - b.minX) / 2, 1);
  return { minX: b.minX - FIT_PAD_SIDE * h, maxX: b.maxX + FIT_PAD_SIDE * h, minY: b.minY - FIT_PAD_BELOW * h, maxY: b.maxY + FIT_PAD_TOP * h };
}

/** Encuadre del modelo con margen de dibujo: deja sitio bajo la base y a los lados para agregar estratos y regiones. */
export function fitToDoc(doc: ModelDoc, width: number, height: number, margin = 24): Viewport {
  return fitViewport(paddedBounds(docBounds(doc)), width, height, margin);
}

/** Factor de un paso de zoom con los botones o las teclas + y −. */
export const ZOOM_STEP = 1.25;

/** Un paso de zoom (dir 1 acerca, −1 aleja) alrededor de `anchor` (px); sin ancla, del centro del lienzo. */
export function zoomStep(vp: Viewport, dir: 1 | -1, anchor?: readonly [number, number]): Viewport {
  const [ax, ay] = anchor ?? [vp.width / 2, vp.height / 2];
  return zoomAt(vp, ax, ay, dir === 1 ? ZOOM_STEP : 1 / ZOOM_STEP);
}

/** Si el punto de pantalla (sx, sy) queda a menos de `margin` px del borde o fuera, centra la vista en él; si no, la deja igual. */
export function ensureVisible(vp: Viewport, sx: number, sy: number, margin: number): Viewport {
  const inside = sx >= margin && sx <= vp.width - margin && sy >= margin && sy <= vp.height - margin;
  return inside ? vp : panBy(vp, vp.width / 2 - sx, vp.height / 2 - sy);
}

export type PointerPair = readonly [readonly [number, number], readonly [number, number]];

/**
 * Pellizco con dos punteros: la escala sigue a la separación entre los dedos, y el punto del mundo que estaba bajo el punto
 * medio anterior pasa a quedar bajo el nuevo (así también se desplaza la vista con los dos dedos).
 */
export function pinchViewport(vp: Viewport, prev: PointerPair, next: PointerPair): Viewport {
  const d0 = Math.hypot(prev[0][0] - prev[1][0], prev[0][1] - prev[1][1]);
  const d1 = Math.hypot(next[0][0] - next[1][0], next[0][1] - next[1][1]);
  const factor = d0 >= 1 && d1 >= 1 ? d1 / d0 : 1;
  const m0x = (prev[0][0] + prev[1][0]) / 2;
  const m0y = (prev[0][1] + prev[1][1]) / 2;
  const m1x = (next[0][0] + next[1][0]) / 2;
  const m1y = (next[0][1] + next[1][1]) / 2;
  return panBy(zoomAt(vp, m0x, m0y, factor), m1x - m0x, m1y - m0y);
}

// ───────────────────────── Autodesplazamiento al dibujar (UX9-01) ─────────────────────────

/** Franja, en píxeles, junto al borde del lienzo en la que la vista se desplaza sola mientras se dibuja. */
export const EDGE_SCROLL_ZONE_PX = 24;
/** Velocidad máxima del autodesplazamiento, en píxeles por paso (unos 16 ms). */
export const EDGE_SCROLL_MAX_PX = 10;

/**
 * Desplazamiento de la vista (dx, dy en píxeles, para `panBy`) cuando el puntero está en (x, y) dentro de un lienzo de
 * `width × height`: nulo en el interior y creciente al acercarse al borde, de modo que el contenido se mueve hacia
 * el lado contrario al borde que se toca (si el puntero está abajo, el contenido sube y aparece lo de abajo).
 */
export function edgeScrollDelta(width: number, height: number, x: number, y: number, zone = EDGE_SCROLL_ZONE_PX, maxPx = EDGE_SCROLL_MAX_PX): [number, number] {
  const axis = (v: number, size: number): number => {
    if (size <= 2 * zone) return 0; // lienzo demasiado pequeño: sin autodesplazamiento
    if (v < zone) return Math.min(1, (zone - v) / zone) * maxPx;
    if (v > size - zone) return -Math.min(1, (v - (size - zone)) / zone) * maxPx;
    return 0;
  };
  const dx = axis(x, width);
  const dy = axis(y, height);
  return [dx === 0 ? 0 : dx, dy === 0 ? 0 : dy];
}

/**
 * Teclado: si el punto de pantalla (sx, sy) queda a menos de `zone` px del borde o fuera, desplaza la vista lo justo para
 * dejarlo a `zone + lead` px del borde (con `lead` = 20 % del lado, para no volver a tocar el borde con la siguiente tecla).
 * Si ya está en el interior, devuelve la misma vista.
 */
export function revealCursor(vp: Viewport, sx: number, sy: number, zone = EDGE_SCROLL_ZONE_PX): Viewport {
  const axis = (v: number, size: number): number => {
    const lead = 0.2 * size;
    if (v < zone) return zone + lead - v;
    if (v > size - zone) return size - zone - lead - v;
    return 0;
  };
  const dx = axis(sx, vp.width);
  const dy = axis(sy, vp.height);
  return dx === 0 && dy === 0 ? vp : panBy(vp, dx, dy);
}
