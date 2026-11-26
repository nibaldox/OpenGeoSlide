// Atajos de teclado del lienzo, como función pura: tecla → lista de acciones (+ tirador que recibe el foco + anuncio).
//   Ctrl+Z deshace; Ctrl+Mayús+Z o Ctrl+Y rehace; Escape deselecciona.
//   [ ] (también con AltGr u Option, R9-04) y RePág/AvPág recorren los tiradores, dando la vuelta. Tab y Mayús+Tab entran y salen del lienzo (una sola parada de tabulación).
//   Flechas: mueven el tirador seleccionado 1 paso de rejilla (Mayús = ×10); en el tirador del radio cambian el radio;
//   sin tirador seleccionado desplazan la vista.
//   Insert (o «i»): inserta un vértice en el punto medio de la arista siguiente. Supr/Retroceso: quita el vértice o punto
//   y el foco pasa al vecino. + (o =), − y 0: acercar, alejar y encuadrar.

import { circleSpec } from '../../engine/surface';
import type { Point } from '../../engine/types';
import { worldToScreen } from '../../geometry/viewport';
import { coincidentVertices, piezoPoints } from './geom';
import { movePiezoPoint, removePiezoPoint } from './edits';
import type { CanvasAction, GestureContext } from './gesture';
import {
  handleList,
  handleSelection,
  handleWorldPoint,
  selectionHandle,
  stepHandle,
  type CirclePart,
  type HandleRef,
} from './handles';
import { circleCenterLabel, circleRadiusLabel, piezoAnnouncement, vertexAnnouncement } from './layout';
import { ensureVisible, fitToDoc, panBy, zoomStep } from './viewportOps';

export interface KeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  /** `getModifierState('AltGraph')`: AltGr en Linux/Firefox/Chrome. En Windows el navegador además marca `ctrlKey` y `altKey`. */
  altGraph?: boolean;
}

/** Evento de teclado del navegador (o React) → `KeyInput`, con `AltGraph` leído de `getModifierState`. */
export function keyInputOf(e: Pick<KeyInput, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'> & { getModifierState?(key: 'AltGraph'): boolean }): KeyInput {
  return {
    key: e.key,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    altGraph: typeof e.getModifierState === 'function' && e.getModifierState('AltGraph'),
  };
}

/** Teclas cuyo carácter, en teclados en español, sale con AltGr (`[`, `]`) o Option; `+`, `=` y `-` se aceptan igual (R9-04). */
const ALT_CHAR_KEYS: ReadonlySet<string> = new Set(['[', ']', '+', '=', '-']);

/**
 * ¿La tecla ya trae el carácter con AltGr (Ctrl+Alt en Windows, `AltGraph`) u Option (Alt sin Meta)? Se decide por `k.key`
 * (el carácter producido) antes del descarte genérico de modificadores. Ctrl o Meta sin Alt siguen siendo atajos del navegador.
 */
function isAltCharKey(k: KeyInput): boolean {
  return ALT_CHAR_KEYS.has(k.key) && !k.metaKey && (k.altKey || k.altGraph === true);
}

export interface KeyResult {
  /** Si es true, el componente debe llamar a preventDefault(). */
  handled: boolean;
  actions: CanvasAction[];
  /** Tirador que debe recibir el foco del teclado tras aplicar las acciones. */
  focus?: HandleRef;
  /** Mensaje para la región aria-live (cambios que el lector no percibe por sí solo). */
  announce?: string;
}

export interface KeyOptions {
  /** Qué parte del círculo de falla tiene el foco (la selección no lo distingue). Por omisión, el centro. */
  circlePart?: CirclePart;
  /** Unidades del modelo para los anuncios (`imperial` → ft). */
  units?: string | null;
}

/** Paso de las flechas, en metros, cuando no hay rejilla activa. */
export const DEFAULT_ARROW_STEP = 0.1;
/** Desplazamiento de la vista con las flechas cuando no hay tirador seleccionado, en píxeles. */
export const PAN_STEP_PX = 40;
/** Radio mínimo del círculo de falla al reducirlo con el teclado. */
export const MIN_CIRCLE_RADIUS = 1e-3;
/** Margen, en píxeles, para considerar que un tirador sigue a la vista. */
const REVEAL_MARGIN_PX = 12;

const NOT_HANDLED: KeyResult = { handled: false, actions: [] };

function clean(v: number): number {
  return Number(v.toPrecision(12));
}

/** Acción que centra la vista en `p` (mundo) si quedó fuera o pegada al borde; null si ya se ve. */
function revealAction(ctx: GestureContext, p: Point | null): CanvasAction | null {
  const vp = ctx.ui.viewport;
  if (!vp || !p) return null;
  const [sx, sy] = worldToScreen(vp, p[0], p[1]);
  const next = ensureVisible(vp, sx, sy, REVEAL_MARGIN_PX);
  return next === vp ? null : { type: 'ui/viewport', viewport: next };
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function focusOn(ctx: GestureContext, h: HandleRef, extra: CanvasAction[] = [], announce?: string): KeyResult {
  // El centro del círculo de falla suele quedar fuera de la vista (el arco es lo que importa): no se arrastra la vista hasta él.
  const reveal = h.kind === 'vertex' || h.kind === 'piezo_point' ? revealAction(ctx, handleWorldPoint(ctx.doc, h)) : null;
  return {
    handled: true,
    actions: [{ type: 'ui/select', selection: handleSelection(h) }, ...extra, ...(reveal ? [reveal] : [])],
    focus: h,
    ...(announce ? { announce } : {}),
  };
}

export function keyActions(ctx: GestureContext, k: KeyInput, gestureActive = false, opts: KeyOptions = {}): KeyResult {
  if (gestureActive) return NOT_HANDLED; // Escape se resuelve como cancelación del gesto en el componente.
  const { doc, ui } = ctx;
  const vp = ui.viewport;
  const units = opts.units ?? doc.units;
  const part = opts.circlePart ?? 'center';
  const mod = k.ctrlKey || k.metaKey;
  const lower = k.key.length === 1 ? k.key.toLowerCase() : k.key;

  if (mod && lower === 'z') {
    return { handled: true, actions: [{ type: k.shiftKey ? 'history/redo' : 'history/undo' }] };
  }
  if (mod && lower === 'y') return { handled: true, actions: [{ type: 'history/redo' }] };
  if ((mod || k.altKey) && !isAltCharKey(k)) return NOT_HANDLED;

  const sel = ui.selection;
  const current = selectionHandle(sel, part);

  if (k.key === 'Escape') {
    if (sel.kind === 'none') return NOT_HANDLED;
    return { handled: true, actions: [{ type: 'ui/select', selection: { kind: 'none' } }] };
  }

  // Recorrido de tiradores: [ y ], o RePág y AvPág, con vuelta. Tab y Mayús+Tab NO se atienden aquí: el lienzo es una sola parada
  // de tabulación (el tirador activo tiene tabindex 0 y los demás −1), así que el navegador entra y sale del lienzo con ellos (B-01).
  if (k.key === '[' || k.key === ']' || k.key === 'PageUp' || k.key === 'PageDown') {
    const forward = k.key === ']' || k.key === 'PageDown';
    const next = stepHandle(handleList(doc), current, forward ? 1 : -1, true);
    return next ? focusOn(ctx, next) : NOT_HANDLED;
  }

  // Zoom y encuadre.
  if (k.key === '+' || k.key === '=' || k.key === '-' || k.key === '0') {
    if (!vp) return NOT_HANDLED;
    if (k.key === '0') return { handled: true, actions: [{ type: 'ui/viewport', viewport: fitToDoc(doc, vp.width, vp.height) }], announce: 'Vista encuadrada al modelo' };
    // El tirador seleccionado queda fijo en pantalla si se ve; si no, el zoom es alrededor del centro.
    let anchor: [number, number] | undefined;
    const at = current ? handleWorldPoint(doc, current) : null;
    if (at) {
      const [sx, sy] = worldToScreen(vp, at[0], at[1]);
      if (sx >= 0 && sx <= vp.width && sy >= 0 && sy <= vp.height) anchor = [sx, sy];
    }
    const zin = k.key !== '-';
    return {
      handled: true,
      actions: [{ type: 'ui/viewport', viewport: zoomStep(vp, zin ? 1 : -1, anchor) }],
      announce: zin ? 'Zoom acercado' : 'Zoom alejado',
    };
  }

  // Insertar un vértice en el punto medio de la arista siguiente.
  if (k.key === 'Insert' || lower === 'i') {
    if (sel.kind !== 'vertex') return NOT_HANDLED;
    const poly = doc.regions[sel.regionIndex]?.polygon;
    if (!poly || poly.length < 1) return { handled: true, actions: [] };
    const a = poly[sel.vertexIndex];
    const b = poly[(sel.vertexIndex + 1) % poly.length];
    if (!a || !b) return { handled: true, actions: [] };
    const at: Point = [clean((a[0] + b[0]) / 2), clean((a[1] + b[1]) / 2)];
    const created: HandleRef = { kind: 'vertex', regionIndex: sel.regionIndex, vertexIndex: sel.vertexIndex + 1 };
    // La inserción cambia los índices: la selección (ui/select) se aplica después.
    const r = focusOn(ctx, created, [], `Vértice insertado. ${vertexAnnouncement(sel.regionIndex, created.vertexIndex, at, units)}`);
    const reveal = revealAction(ctx, at);
    return {
      ...r,
      actions: [
        { type: 'vertex/insert', regionIndex: sel.regionIndex, afterIndex: sel.vertexIndex, at },
        { type: 'ui/select', selection: handleSelection(created) },
        ...(reveal ? [reveal] : []),
      ],
    };
  }

  if (k.key === 'Delete' || k.key === 'Backspace') {
    if (sel.kind === 'vertex') {
      const poly = doc.regions[sel.regionIndex]?.polygon ?? [];
      if (poly.length <= 3) return { handled: true, actions: [], announce: 'No se puede eliminar: la región necesita al menos 3 vértices' };
      // El foco pasa al vértice anterior (o al último si se quitó el primero).
      const neighbourIndex = sel.vertexIndex > 0 ? sel.vertexIndex - 1 : poly.length - 2;
      const neighbourOld = sel.vertexIndex > 0 ? sel.vertexIndex - 1 : poly.length - 1;
      const p = poly[neighbourOld];
      const next: HandleRef = { kind: 'vertex', regionIndex: sel.regionIndex, vertexIndex: neighbourIndex };
      return {
        handled: true,
        actions: [
          { type: 'vertex/remove', regionIndex: sel.regionIndex, vertexIndex: sel.vertexIndex },
          { type: 'ui/select', selection: handleSelection(next) },
        ],
        focus: next,
        announce: `Vértice eliminado. Foco en el ${lowerFirst(vertexAnnouncement(sel.regionIndex, neighbourIndex, p, units))}`,
      };
    }
    if (sel.kind === 'piezo_point') {
      const pts = piezoPoints(doc);
      const next = removePiezoPoint(pts, sel.index);
      if (!next) return { handled: true, actions: [], announce: 'No se puede eliminar: la piezométrica necesita al menos 2 puntos' };
      const idx = Math.max(0, sel.index - 1);
      const h: HandleRef = { kind: 'piezo_point', index: idx };
      return {
        handled: true,
        actions: [{ type: 'piezo/set', points: next }, { type: 'ui/select', selection: handleSelection(h) }],
        focus: h,
        announce: `Punto eliminado. Foco en el ${lowerFirst(piezoAnnouncement(idx, next[idx], units))}`,
      };
    }
    return NOT_HANDLED;
  }

  const dir: Point | null =
    k.key === 'ArrowLeft' ? [-1, 0] : k.key === 'ArrowRight' ? [1, 0] : k.key === 'ArrowUp' ? [0, 1] : k.key === 'ArrowDown' ? [0, -1] : null;
  if (!dir) return NOT_HANDLED;

  const movable = sel.kind === 'vertex' || sel.kind === 'piezo_point' || sel.kind === 'surface_circle';
  if (!movable) {
    // Sin tirador seleccionado las flechas desplazan la vista (en vez de desplazar la página).
    if (!vp) return NOT_HANDLED;
    const px = PAN_STEP_PX * (k.shiftKey ? 4 : 1);
    // La vista se mueve hacia donde apunta la flecha: el contenido se desplaza al revés.
    return { handled: true, actions: [{ type: 'ui/viewport', viewport: panBy(vp, -dir[0] * px, dir[1] * px) }] };
  }

  const step = (ui.snap.gridStep !== null && ui.snap.gridStep > 0 ? ui.snap.gridStep : DEFAULT_ARROW_STEP) * (k.shiftKey ? 10 : 1);
  const dx = dir[0] * step;
  const dy = dir[1] * step;
  const shift = (p: Point): Point => [clean(p[0] + dx), clean(p[1] + dy)];
  const withReveal = (r: KeyResult, p: Point): KeyResult => {
    const reveal = revealAction(ctx, p);
    return reveal ? { ...r, actions: [...r.actions, reveal] } : r;
  };

  if (sel.kind === 'vertex') {
    const origin = doc.regions[sel.regionIndex]?.polygon[sel.vertexIndex];
    if (!origin) return NOT_HANDLED;
    const group = coincidentVertices(doc, sel);
    const to = shift(origin);
    const moves: CanvasAction[] = group.map((r) => ({
      type: 'vertex/move',
      regionIndex: r.regionIndex,
      vertexIndex: r.vertexIndex,
      to,
    }));
    // Varias regiones comparten el vértice: un solo paso de historial.
    return withReveal(
      {
        handled: true,
        actions: group.length > 1 ? [{ type: 'gesture/begin', label: 'Mover vértice' }, ...moves, { type: 'gesture/end' }] : moves,
        announce: vertexAnnouncement(sel.regionIndex, sel.vertexIndex, to, units),
      },
      to,
    );
  }
  if (sel.kind === 'piezo_point') {
    const pts = piezoPoints(doc);
    const cur = pts[sel.index];
    if (!cur) return NOT_HANDLED;
    const next = movePiezoPoint(pts, sel.index, shift(cur));
    if (!next) return { handled: true, actions: [] };
    return withReveal(
      { handled: true, actions: [{ type: 'piezo/set', points: next }], announce: piezoAnnouncement(sel.index, next[sel.index], units) },
      next[sel.index],
    );
  }
  // surface_circle
  const c = circleSpec(doc.analysis.surface);
  if (!c) return NOT_HANDLED;
  if (part === 'radius') {
    // Derecha o arriba agrandan el radio; izquierda o abajo lo reducen.
    const grow = dir[0] + dir[1] > 0 ? 1 : -1;
    const r = Math.max(clean(c.r + grow * step), MIN_CIRCLE_RADIUS);
    return {
      handled: true,
      actions: [{ type: 'surface/set', surface: { type: 'circle', xc: c.xc, yc: c.yc, r } }],
      announce: circleRadiusLabel(r, units),
    };
  }
  const center = shift([c.xc, c.yc]);
  return {
    handled: true,
    actions: [{ type: 'surface/set', surface: { type: 'circle', xc: center[0], yc: center[1], r: c.r } }],
    announce: circleCenterLabel(center[0], center[1], units),
  };
}
