// Lienzo SVG del editor: regiones, vértices, piezométrica, círculo fijo, rangos de búsqueda, cargas y sismo.
// Solo usa la interfaz EditorStore. La lógica (hit test, snap, gestos, teclado) vive en módulos puros.

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import type { Circle, Point, Slice } from '../../engine/types';
import { screenToWorld, worldToScreen, type Viewport } from '../../geometry/viewport';
import { materialColor } from '../../render/scene';
import type { EditorStore, ModelDoc } from '../types';
import {
  IDLE,
  applyPreview,
  doubleClick,
  pointerCancel,
  pointerDown,
  pointerMove,
  pointerUp,
  runActions,
  type GestureContext,
  type GestureResult,
  type GestureState,
  type PointerInput,
} from './gesture';
import { DrawLayer } from './DrawLayer';
import { DRAW_INSTRUCTIONS, EMPTY_DRAFT, drawClick, drawHover, drawKey, type DrawDraft, type DrawStep } from './draw';
import { piezoPoints } from './geom';
import { piezoExtension } from './piezoExtension';
import { hitTest, handleHitRadius, radiusHandlePoint, searchRange, type Hit } from './hitTest';
import {
  handleKey,
  handleList,
  handleSelection,
  selectionHandle,
  type CirclePart,
  type HandleRef,
} from './handles';
import { keyActions, keyInputOf } from './keys';
import {
  axisTitles,
  circleCenterLabel,
  circleRadiusLabel,
  cursorReadout,
  gridLines,
  loadShapes,
  pointsAttr,
  piezoAnnouncement,
  piezoLabel,
  rangeBand,
  rangeLabel,
  seismicBadge,
  seismicLabel,
  slideDirection,
  vertexAnnouncement,
  vertexLabel,
} from './layout';
import { SPLIT_INSTRUCTIONS, splitClick, splitKey } from './split';
import { isTraceTool, traceOnDocChange, traceOnToolChange } from './trace';
import { edgeScrollDelta, fitToDoc, panBy, pinchViewport, resizeViewport, wheelFactor, zoomAt, zoomStep } from './viewportOps';
import './canvas.css';

// Colores: referencias a los tokens `--canvas-*` de styles/tokens.css; el tema los cambia sin volver a dibujar.
const COLOR_EDGE = 'var(--canvas-region-edge)';
const COLOR_SELECTED = 'var(--canvas-selected)';
const COLOR_PIEZO = 'var(--canvas-piezo)';
const COLOR_SURFACE = 'var(--canvas-surface)';
const COLOR_SURFACE_UNCONVERGED = 'var(--canvas-surface-unconverged)';
const COLOR_LOAD = 'var(--canvas-load)';
const COLOR_SEISMIC = 'var(--canvas-seismic)';
const COLOR_GRID = 'var(--canvas-grid)';
const COLOR_AXIS_TEXT = 'var(--canvas-axis-text)';
const COLOR_BAND_ENTRY = 'var(--canvas-band-entry)';
const COLOR_BAND_EXIT = 'var(--canvas-band-exit)';
const COLOR_HALO = 'var(--canvas-halo)';
const COLOR_HANDLE_FILL = 'var(--canvas-handle-fill)';
const COLOR_HANDLE_SEL = 'var(--canvas-handle-sel)';
const COLOR_HANDLE_SNAP = 'var(--canvas-handle-snap)';
const COLOR_HANDLE_RING = 'var(--canvas-handle-ring)';
const COLOR_MATERIAL_UNKNOWN = 'var(--canvas-mat-unknown)';

/** Radio visible de un tirador: 12 px de diámetro como mínimo, con anillo de contraste. */
const HANDLE_R = 6;
/** Radio del área de acierto transparente de cada tirador: 24 px de diámetro (WCAG 2.5.8). */
const HIT_AREA_R = 12;
/** Trazo discontinuo de la superficie cuando el cálculo no convergió. */
const UNCONVERGED_DASH = '10 6';
const COLOR_RESULT = COLOR_SURFACE;
const COLOR_SLICE_FILL = 'var(--canvas-slice-fill)';
const COLOR_SLICE_EDGE = 'var(--canvas-slice-edge)';

/** Rótulos del lienzo: el halo (`paint-order: stroke`) los separa de líneas y materiales en ambos temas. */
const HALO_LABEL = { stroke: COLOR_HALO, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' } as const;
/** Tamaño de las etiquetas de los ejes (UX-20: 12 px o más). */
const AXIS_FONT_PX = 12;
/** Espacio reservado, en px, para los títulos «x (m)» e «y (m)»: las marcas de los ejes que lo invadirían se omiten. */
const AXIS_TITLE_RESERVE_PX = 64;

/** Resultado del cálculo que se superpone al modelo: superficie crítica y dovelas. */
export interface CanvasResult {
  surface: Circle;
  slices: Slice[];
}

/** Puntos (en pantalla) del arco inferior de la superficie crítica entre la primera y la última dovela. */
function surfaceArc(vp: Viewport, result: CanvasResult, steps = 120): string {
  if (result.slices.length === 0) return '';
  const xmin = Math.min(...result.slices.map((s) => s.x_left));
  const xmax = Math.max(...result.slices.map((s) => s.x_right));
  const { xc, yc, r } = result.surface;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = xmin + ((xmax - xmin) * i) / steps;
    const d = r * r - (x - xc) ** 2;
    if (d < 0) continue;
    const [sx, sy] = worldToScreen(vp, x, yc - Math.sqrt(d));
    pts.push(`${sx},${sy}`);
  }
  return pts.join(' ');
}

function cursorFor(tool: string, hover: Hit['kind'] | null, dragging: boolean, panning: boolean): string {
  if (panning) return 'grabbing';
  if (tool === 'pan') return 'grab';
  if (tool === 'draw_region' || tool === 'split_region') return 'crosshair';
  if (dragging) return 'grabbing';
  if (hover === 'vertex' || hover === 'piezo_point' || hover === 'circle_center' || hover === 'circle_radius') return 'move';
  if (tool === 'add_vertex') return hover === 'edge' || hover === 'piezo_edge' ? 'copy' : 'crosshair';
  return 'default';
}

/** Instrucciones del lienzo para teclado y lector de pantalla (`aria-describedby`); documentadas también en docs/fase2/ux/U2C_lienzo_teclado.md. */
export const CANVAS_INSTRUCTIONS =
  'Lienzo del modelo: una sola parada de tabulación. Tab y Mayús+Tab entran al lienzo y salen de él; dentro, las teclas [ y ], o RePág y AvPág, pasan de un tirador a otro. ' +
  'Con las flechas se mueve el tirador seleccionado un paso de rejilla (0,1 sin rejilla); Mayús multiplica el paso por diez. ' +
  'En el tirador del radio las flechas cambian el radio del círculo; en el del centro, lo mueven. ' +
  'Insert, o la tecla i, inserta un vértice en el punto medio de la arista siguiente. ' +
  'Supr elimina el vértice o el punto y el foco pasa al vecino. ' +
  'Las teclas + y − acercan y alejan, y 0 encuadra el modelo. ' +
  'Sin tirador seleccionado las flechas desplazan la vista. Escape quita la selección. ' +
  'La tecla R elige la herramienta Dibujar región: clic, toque o Espacio colocan un vértice con el cursor del teclado (flechas), Intro cierra la región; se puede dibujar fuera del modelo y cerca del borde la vista se desplaza sola. ' +
  'La tecla D elige Dividir región: una línea que entra y sale del borde de una región la divide en dos.';

/**
 * Versión breve de las instrucciones para el tirador con el foco (R9-10): los lectores de pantalla leen el `aria-describedby` del
 * elemento enfocado, no el de su ancestro, y repetir el texto largo en cada tirador sería insufrible al recorrerlos.
 */
export const HANDLE_INSTRUCTIONS = 'Flechas: mover el tirador. [ y ]: tirador anterior o siguiente. Supr: eliminar. Tab: salir del lienzo.';

/** Espera, en ms, con el puntero junto al borde antes de que la vista empiece a desplazarse (evita desplazar al cruzar el borde de paso). */
const EDGE_SCROLL_DWELL_MS = 250;
/** Período del autodesplazamiento, en ms. */
const EDGE_SCROLL_TICK_MS = 16;

const DRAG_KINDS: ReadonlySet<Hit['kind']> = new Set(['vertex', 'piezo_point', 'circle_center', 'circle_radius']);

function handleFromKey(list: readonly HandleRef[], key: string | null): HandleRef | null {
  if (!key) return null;
  return list.find((h) => handleKey(h) === key) ?? null;
}

function sameSelection(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface EditorCanvasProps {
  store: EditorStore;
  result?: CanvasResult;
  /** `false` dibuja la superficie con trazo discontinuo y `--canvas-surface-unconverged`. Por omisión `true`. */
  surfaceConverged?: boolean;
  /** Unidades de las etiquetas accesibles y de los ejes (m o ft). Por omisión, las del documento (SI si no las declara). */
  units?: 'SI' | 'imperial';
  /** Mensajes para la región aria-live al mover, agregar o eliminar vértices. Sin esta prop el lienzo trae su propia región. */
  onAnnounce?: (msg: string) => void;
  /** Contenido que se muestra sobre el lienzo cuando el modelo no tiene regiones (mensaje con las acciones para empezar). */
  emptyState?: ReactNode;
}

/** Movimiento máximo, en píxeles, entre pulsar y soltar para que un toque o clic cuente como «colocar un punto». */
const DRAW_TAP_SLOP_PX = 6;

function ToolIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function EditorCanvas({ store, result, surfaceConverged = true, units, onAnnounce, emptyState }: EditorCanvasProps) {
  // Envolturas con identidad estable por store: no dependen de `this` ni de cómo W1 construya el objeto.
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const getState = useCallback(() => store.getState(), [store]);
  const state = useSyncExternalStore(subscribe, getState, getState);
  const svgRef = useRef<SVGSVGElement>(null);
  // Sin ResizeObserver (render en node) el tamaño por defecto cuenta como medido.
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [measured, setMeasured] = useState(typeof ResizeObserver === 'undefined');
  const [gesture, setGesture] = useState<GestureState>(IDLE);
  const gestureRef = useRef<GestureState>(IDLE);
  const [hover, setHover] = useState<Hit['kind'] | null>(null);
  const [circlePart, setCirclePart] = useState<CirclePart>('center');
  const [liveMsg, setLiveMsg] = useState('');
  // Tirador al que hay que llevar el foco tras el próximo render (insertar, eliminar, recorrer).
  const focusRequest = useRef<string | null>(null);
  // Último tirador activo: la parada de tabulación cuando la selección no es un tirador.
  const lastActiveKey = useRef<string | null>(null);
  // Punteros táctiles activos y estado de pellizco (dos dedos).
  const touchPts = useRef(new Map<number, [number, number]>());
  const pinching = useRef(false);
  // Dibujo de una región: puntos colocados y cursor (estado local: no se guarda ni entra en el historial hasta cerrar).
  const [draft, setDraftState] = useState<DrawDraft>(EMPTY_DRAFT);
  const draftRef = useRef<DrawDraft>(EMPTY_DRAFT);
  const [drawError, setDrawError] = useState<string | null>(null);
  const drawDown = useRef<{ id: number; x: number; y: number; pointerType: string } | null>(null);
  // Último puntero (ratón o lápiz) sobre el lienzo con una herramienta de trazo: el autodesplazamiento sigue mientras esté junto al borde.
  const trailPointer = useRef<{ x: number; y: number } | null>(null);
  const edgeDwell = useRef(0);
  const prevTool = useRef(store.getState().ui.tool);
  // Lectura de (x, y) del cursor: se escribe directamente en el DOM (sin estado) para no repintar el lienzo en cada movimiento.
  const readoutRef = useRef<HTMLParagraphElement>(null);
  const markerBase = useId().replace(/:/g, '_');
  const instructionsId = `${markerBase}-help`;
  const handleHelpId = `${markerBase}-handle-help`;

  const { doc, ui } = state;
  // Unidades efectivas: la prop del contrato manda; si no, las del documento.
  const unitsEff = units ?? doc.units;

  const announce = (msg: string): void => {
    if (onAnnounce) onAnnounce(msg);
    else setLiveMsg(msg);
  };
  const setDraft = (next: DrawDraft): void => {
    draftRef.current = next;
    setDraftState(next);
  };
  /** Aplica un paso del dibujo: borrador, acciones sobre el store y anuncio. */
  const runDraw = (step: DrawStep): void => {
    setDraft(step.draft);
    setDrawError(step.error ?? null);
    runActions(store, step.actions);
    if (step.announce) announce(step.announce);
  };

  // Tamaño del lienzo (ResizeObserver solo existe en el navegador).
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = (): void => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setSize({ w: Math.round(r.width), h: Math.round(r.height) });
        setMeasured(true);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Viewport inicial (ajuste al contenido) y seguimiento del tamaño.
  useEffect(() => {
    const s = store.getState();
    const vp = s.ui.viewport;
    if (vp === null) {
      // El ajuste inicial espera a la primera medida real: con el tamaño por defecto el modelo quedaba
      // centrado en 800 × 600 y, en un lienzo más ancho, con un margen vacío a la derecha.
      if (measured) store.dispatch({ type: 'ui/viewport', viewport: fitToDoc(s.doc, size.w, size.h) });
    } else if (vp.width !== size.w || vp.height !== size.h) {
      store.dispatch({ type: 'ui/viewport', viewport: resizeViewport(vp, size.w, size.h) });
    }
  }, [store, size.w, size.h, measured, ui.viewport]);

  // Rueda: zoom alrededor del cursor. Listener nativo no pasivo para poder llamar a preventDefault.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      const vp = store.getState().ui.viewport;
      if (!vp) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      store.dispatch({ type: 'ui/viewport', viewport: zoomAt(vp, e.clientX - rect.left, e.clientY - rect.top, wheelFactor(dy)) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [store]);

  // Táctil (R7-10): `touch-action: pan-x pan-y` deja desplazar la página; aquí se bloquea el desplazamiento solo cuando el
  // toque empieza sobre un tirador, con la herramienta «Mover vista», sobre una arista con «Agregar vértice» o con dos dedos.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent): void => {
      const s = store.getState();
      const vp = s.ui.viewport;
      if (!vp || !e.cancelable) return;
      if (s.ui.tool === 'pan' || e.touches.length >= 2) {
        e.preventDefault();
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      const rect = el.getBoundingClientRect();
      const radius = handleHitRadius(s.ui.snap.radiusPx, 'touch');
      const hit = hitTest(s.doc, vp, t.clientX - rect.left, t.clientY - rect.top, radius, { bands: false });
      if (DRAG_KINDS.has(hit.kind) || (s.ui.tool === 'add_vertex' && (hit.kind === 'edge' || hit.kind === 'piezo_edge'))) e.preventDefault();
    };
    // Con dos dedos, o con un arrastre de tirador en curso, también se bloquea el movimiento (mientras el navegador lo permita).
    const onTouchMove = (e: TouchEvent): void => {
      if (e.cancelable && (e.touches.length >= 2 || gestureRef.current.mode !== 'idle')) e.preventDefault();
    };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [store]);

  // Si el componente se desmonta durante un arrastre, el gesto se cancela.
  useEffect(
    () => () => {
      if (gestureRef.current.mode === 'drag') store.cancelGesture();
    },
    [store],
  );

  // Foco pedido por el teclado (insertar, eliminar, recorrer): se aplica cuando el tirador ya está en el DOM.
  useEffect(() => {
    const key = focusRequest.current;
    if (!key) return;
    focusRequest.current = null;
    svgRef.current?.querySelector<SVGElement>(`[data-handle-key="${key}"]`)?.focus({ preventScroll: true });
  });

  // Herramientas de trazo («Dibujar región» y «Dividir región»): al elegirlas el foco pasa al lienzo (para operar con el teclado) y se
  // anuncia cómo usarlas; al salir de ellas, o al cambiar de una a otra, el trazo en curso se descarta y se anuncia (A-04, B-08).
  useEffect(() => {
    const was = prevTool.current;
    prevTool.current = ui.tool;
    const reset = traceOnToolChange(draftRef.current, was, ui.tool);
    if (reset.draft !== draftRef.current) {
      setDraft(reset.draft);
      setDrawError(null);
    } else if (!isTraceTool(ui.tool) && (draftRef.current.points.length > 0 || draftRef.current.cursor !== null)) {
      setDraft(EMPTY_DRAFT);
      setDrawError(null);
    }
    if (isTraceTool(ui.tool) && was !== ui.tool) {
      if (!isTraceTool(was) && (draftRef.current.points.length > 0 || draftRef.current.cursor !== null)) {
        setDraft(EMPTY_DRAFT);
        setDrawError(null);
      }
      svgRef.current?.focus({ preventScroll: true });
      const text = ui.tool === 'split_region' ? SPLIT_INSTRUCTIONS : DRAW_INSTRUCTIONS;
      announce(reset.announce ? `${reset.announce} ${text}` : text);
    } else if (reset.announce) {
      announce(reset.announce);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.tool]);

  // Otro documento (Nuevo, Abrir, Ejemplos, Talud simple, Recuperar, importar): el trazo a medias era del anterior y se descarta (A-01).
  const lastEpoch = useRef(state.docEpoch);
  useEffect(() => {
    if (lastEpoch.current === state.docEpoch) return;
    lastEpoch.current = state.docEpoch;
    const reset = traceOnDocChange(draftRef.current);
    if (reset.draft !== draftRef.current) {
      setDraft(reset.draft);
      setDrawError(null);
    }
    if (reset.announce) announce(reset.announce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.docEpoch]);

  const showReadout = (p: Point | null): void => {
    if (readoutRef.current) readoutRef.current.textContent = p ? cursorReadout(p, unitsEff) : '';
  };
  // Con una herramienta de trazo manda el cursor del dibujo (con ajuste, o el del teclado): también se lee desde el teclado.
  useEffect(() => {
    if (isTraceTool(ui.tool) && draft.cursor) showReadout(draft.cursor);
    else if (!isTraceTool(ui.tool)) showReadout(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.cursor, ui.tool, unitsEff]);

  // El resto de la aplicación (confirmar al cambiar de herramienta, cambios sin guardar) necesita saber si hay un trazo.
  useEffect(() => {
    store.dispatch({ type: 'ui/trace', points: draft.points.length });
  }, [store, draft.points.length]);

  // Autodesplazamiento (UX9-01): con una herramienta de trazo, el puntero a menos de 24 px del borde del lienzo desplaza la vista
  // hacia ese lado (más rápido cuanto más cerca), para poder dibujar fuera de lo que se ve. Empieza tras una breve espera.
  const edgeTick = useRef<() => void>(() => undefined);
  edgeTick.current = () => {
    const p = trailPointer.current;
    const s = store.getState();
    const cur = s.ui.viewport;
    if (!p || !cur || !isTraceTool(s.ui.tool)) {
      edgeDwell.current = 0;
      return;
    }
    const [dx, dy] = edgeScrollDelta(cur.width, cur.height, p.x, p.y);
    if (dx === 0 && dy === 0) {
      edgeDwell.current = 0;
      return;
    }
    edgeDwell.current += EDGE_SCROLL_TICK_MS;
    if (edgeDwell.current < EDGE_SCROLL_DWELL_MS) return;
    const next = panBy(cur, dx, dy);
    store.dispatch({ type: 'ui/viewport', viewport: next });
    // Bajo el puntero quieto hay ahora otro punto del mundo: el cursor de dibujo lo sigue.
    const ctx: GestureContext = { doc: s.doc, ui: { ...s.ui, viewport: next } };
    const moved = drawHover(draftRef.current, ctx, { x: p.x, y: p.y, button: 0, pointerType: 'mouse' });
    if (moved !== draftRef.current) setDraft(moved);
  };
  useEffect(() => {
    if (!isTraceTool(ui.tool)) {
      trailPointer.current = null;
      edgeDwell.current = 0;
      return;
    }
    const id = window.setInterval(() => edgeTick.current(), EDGE_SCROLL_TICK_MS);
    return () => window.clearInterval(id);
  }, [ui.tool]);

  const vp: Viewport = ui.viewport ?? fitToDoc(doc, size.w, size.h);
  const preview = gesture.mode === 'drag' ? gesture.preview : null;
  const shown: ModelDoc = applyPreview(doc, preview);

  const context = (): GestureContext => {
    const s = store.getState();
    return { doc: s.doc, ui: s.ui.viewport ? s.ui : { ...s.ui, viewport: vp } };
  };
  const localInput = (e: PointerEvent<SVGSVGElement>): PointerInput => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, button: e.button, altKey: e.altKey, pointerType: e.pointerType };
  };
  const apply = (r: GestureResult): void => {
    gestureRef.current = r.state;
    setGesture(r.state);
    runActions(store, r.actions);
  };

  /** Texto para la región aria-live de lo que queda seleccionado tras un arrastre con el puntero. */
  const describeAfterDrag = (target: string): string | null => {
    const s = store.getState();
    const sel = s.ui.selection;
    if (sel.kind === 'vertex') {
      const p = s.doc.regions[sel.regionIndex]?.polygon[sel.vertexIndex];
      return p ? vertexAnnouncement(sel.regionIndex, sel.vertexIndex, p, unitsEff) : null;
    }
    if (sel.kind === 'piezo_point') {
      const p = piezoPoints(s.doc)[sel.index];
      return p ? piezoAnnouncement(sel.index, p, unitsEff) : null;
    }
    const c = s.doc.analysis.surface;
    if (sel.kind === 'surface_circle' && c) return target === 'circle_radius' ? circleRadiusLabel(c.r, unitsEff) : circleCenterLabel(c.xc, c.yc, unitsEff);
    return null;
  };

  const touchPoint = (e: PointerEvent<SVGSVGElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>): void => {
    if (e.pointerType === 'touch') {
      touchPts.current.set(e.pointerId, touchPoint(e));
      if (touchPts.current.size >= 2) {
        // Segundo dedo: pellizco. Se cancela cualquier arrastre en curso y no se empieza otro gesto.
        if (!pinching.current && gestureRef.current.mode !== 'idle') apply(pointerCancel(gestureRef.current));
        pinching.current = true;
        return;
      }
    }
    if (pinching.current) {
      drawDown.current = null;
      return;
    }
    const input = localInput(e);
    // «Dibujar región»: el punto se coloca al soltar (si el puntero no se movió), así un arrastre táctil sigue desplazando la página.
    if (isTraceTool(store.getState().ui.tool) && e.button === 0) {
      drawDown.current = { id: e.pointerId, x: input.x, y: input.y, pointerType: e.pointerType };
      setDraft(drawHover(draftRef.current, context(), input));
      return;
    }
    // El círculo recuerda qué parte se tocó (centro o radio) para que las flechas sepan qué cambiar.
    const ctx = context();
    if (ctx.ui.viewport) {
      const hit = hitTest(ctx.doc, ctx.ui.viewport, input.x, input.y, handleHitRadius(ctx.ui.snap.radiusPx, e.pointerType), { bands: false });
      if (hit.kind === 'circle_radius') setCirclePart('radius');
      else if (hit.kind === 'circle_center') setCirclePart('center');
    }
    const r = pointerDown(gestureRef.current, ctx, input);
    if (r.state.mode !== 'idle') {
      e.currentTarget.setPointerCapture(e.pointerId);
      if (e.button === 1) e.preventDefault();
    }
    apply(r);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>): void => {
    if (e.pointerType === 'touch' && touchPts.current.has(e.pointerId)) {
      const before = [...touchPts.current.values()];
      touchPts.current.set(e.pointerId, touchPoint(e));
      if (pinching.current) {
        drawDown.current = null;
        const now = [...touchPts.current.values()];
        const cur = store.getState().ui.viewport;
        if (cur && before.length >= 2 && now.length >= 2) {
          store.dispatch({ type: 'ui/viewport', viewport: pinchViewport(cur, [before[0], before[1]], [now[0], now[1]]) });
        }
        return;
      }
    }
    if (pinching.current) return;
    const input = localInput(e);
    const ctx = context();
    if (e.pointerType !== 'touch' && ctx.ui.viewport && !isTraceTool(ctx.ui.tool)) {
      showReadout(screenToWorld(ctx.ui.viewport, input.x, input.y) as Point);
    }
    if (isTraceTool(ctx.ui.tool) && gestureRef.current.mode === 'idle') {
      if (e.pointerType !== 'touch') trailPointer.current = { x: input.x, y: input.y };
      const next = drawHover(draftRef.current, ctx, input);
      if (next !== draftRef.current) setDraft(next);
      return;
    }
    if (gestureRef.current.mode === 'idle') {
      const kind = ctx.ui.viewport
        ? hitTest(ctx.doc, ctx.ui.viewport, input.x, input.y, handleHitRadius(ctx.ui.snap.radiusPx, e.pointerType), { edgeRadiusPx: ctx.ui.snap.radiusPx }).kind
        : null;
      if (kind !== hover) setHover(kind);
      return;
    }
    apply(pointerMove(gestureRef.current, ctx, input));
  };
  /** Quita el puntero táctil; devuelve true si el evento pertenecía a un pellizco (no debe tratarse como gesto). */
  const endTouch = (e: PointerEvent<SVGSVGElement>): boolean => {
    if (e.pointerType !== 'touch') return pinching.current;
    touchPts.current.delete(e.pointerId);
    const wasPinching = pinching.current;
    if (touchPts.current.size < 2) pinching.current = false;
    return wasPinching;
  };
  const onPointerUp = (e: PointerEvent<SVGSVGElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (endTouch(e)) {
      drawDown.current = null;
      return;
    }
    const down = drawDown.current;
    if (down && down.id === e.pointerId) {
      drawDown.current = null;
      const input = localInput(e);
      const traceTool = store.getState().ui.tool;
      if (isTraceTool(traceTool) && Math.hypot(input.x - down.x, input.y - down.y) <= DRAW_TAP_SLOP_PX) {
        const click = traceTool === 'split_region' ? splitClick : drawClick;
        runDraw(click(draftRef.current, context(), { ...input, pointerType: down.pointerType }));
      }
      return;
    }
    const before = gestureRef.current;
    const r = pointerUp(before, context(), localInput(e));
    apply(r);
    if (before.mode === 'drag' && before.moved && r.actions.some((a) => a.type === 'gesture/end')) {
      const msg = describeAfterDrag(before.target.kind);
      if (msg) announce(msg);
    }
  };
  const onPointerCancel = (e: PointerEvent<SVGSVGElement>): void => {
    if (drawDown.current?.id === e.pointerId) drawDown.current = null;
    if (endTouch(e)) return;
    apply(pointerCancel(gestureRef.current));
  };
  const onPointerLeave = (): void => {
    if (!isTraceTool(store.getState().ui.tool)) showReadout(null);
    trailPointer.current = null;
    edgeDwell.current = 0;
  };
  const onDoubleClick = (e: MouseEvent<SVGSVGElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    runActions(store, doubleClick(context(), { x: e.clientX - rect.left, y: e.clientY - rect.top, button: 0 }));
  };

  const handles = handleList(doc);
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>): void => {
    if (e.key === 'Escape' && gestureRef.current.mode !== 'idle') {
      e.preventDefault();
      apply(pointerCancel(gestureRef.current));
      return;
    }
    // Herramientas de trazo: las flechas, Espacio, Intro, Retroceso y Esc son del trazo; el resto (zoom, Tab…) sigue su camino.
    const activeTool = store.getState().ui.tool;
    if (isTraceTool(activeTool)) {
      const d = (activeTool === 'split_region' ? splitKey : drawKey)(draftRef.current, context(), e);
      if (d.handled) {
        e.preventDefault();
        runDraw(d.step);
        return;
      }
    }
    // El elemento con el foco manda: tras Escape (selección vacía) un tirador enfocado sigue siendo el punto de partida.
    const focusedKey = (e.target as Element).getAttribute?.('data-handle-key') ?? null;
    const focused = handleFromKey(handles, focusedKey);
    let ctx = context();
    if (focused && e.key !== 'Escape' && ctx.ui.selection.kind === 'none') ctx = { ...ctx, ui: { ...ctx.ui, selection: handleSelection(focused) } };
    const part: CirclePart = focused?.kind === 'circle_radius' ? 'radius' : focused?.kind === 'circle_center' ? 'center' : circlePart;
    const r = keyActions(ctx, keyInputOf(e), gestureRef.current.mode !== 'idle', { circlePart: part, units: unitsEff });
    if (r.handled) e.preventDefault();
    if (r.focus) {
      focusRequest.current = handleKey(r.focus);
      if (r.focus.kind === 'circle_radius') setCirclePart('radius');
      else if (r.focus.kind === 'circle_center') setCirclePart('center');
    }
    runActions(store, r.actions);
    if (r.announce) announce(r.announce);
    // Escape sale del modo tirador: la selección se quita y el foco vuelve al lienzo (las flechas desplazan la vista).
    if (e.key === 'Escape' && r.handled && focused) svgRef.current?.focus({ preventScroll: true });
  };

  const onHandleFocus = (h: HandleRef): void => {
    if (h.kind === 'circle_radius') setCirclePart('radius');
    else if (h.kind === 'circle_center') setCirclePart('center');
    const target = handleSelection(h);
    if (!sameSelection(store.getState().ui.selection, target)) store.dispatch({ type: 'ui/select', selection: target });
  };

  const viewAction = (kind: 'in' | 'out' | 'fit'): void => {
    const cur = store.getState().ui.viewport ?? vp;
    if (kind === 'fit') {
      store.dispatch({ type: 'ui/viewport', viewport: fitToDoc(store.getState().doc, cur.width, cur.height) });
      announce('Vista encuadrada al modelo');
      return;
    }
    store.dispatch({ type: 'ui/viewport', viewport: zoomStep(cur, kind === 'in' ? 1 : -1) });
    announce(kind === 'in' ? 'Zoom acercado' : 'Zoom alejado');
  };

  const sel = ui.selection;
  const toS = (p: Point): [number, number] => worldToScreen(vp, p[0], p[1]);
  const grid = gridLines(vp);
  const titles = axisTitles(unitsEff);
  const pz = piezoPoints(shown);
  const pzExtra = piezoExtension(shown);
  const circle = shown.analysis.surface ?? null;
  const loads = loadShapes(shown, vp);
  const seismic = shown.analysis.seismic ?? null;
  const dir = slideDirection(shown);
  const badge = seismicBadge(vp, dir);
  const dragging = gesture.mode === 'drag' && gesture.moved;
  const guides = preview && preview.kind !== 'circle' ? preview.snap.guides : null;
  const snapTarget = preview && preview.kind === 'vertex' ? preview.snap.target : null;
  const arrowId = `${markerBase}-load`;
  const seismicArrowId = `${markerBase}-seismic`;

  // Tabindex itinerante: una sola parada de tabulación, el tirador seleccionado (o el último activo, o el primero). Tab entra y sale
  // del lienzo; los tiradores se recorren con [ ] y RePág/AvPág (`keys.ts`), no con Tab (B-01).
  const keys = handles.map(handleKey);
  const selectedHandle = selectionHandle(sel, circlePart);
  if (selectedHandle) lastActiveKey.current = handleKey(selectedHandle);
  const remembered = lastActiveKey.current !== null && keys.includes(lastActiveKey.current) ? lastActiveKey.current : null;
  const activeKey = remembered ?? keys[0] ?? null;
  const tabIndexFor = (h: HandleRef): number => (handleKey(h) === activeKey ? 0 : -1);

  const style: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    background: 'var(--canvas-bg)',
    // Solo «Mover vista» bloquea el desplazamiento de la página; con el resto el bloqueo se decide por toque (touchstart).
    touchAction: ui.tool === 'pan' ? 'none' : 'pan-x pan-y',
    userSelect: 'none',
    cursor: cursorFor(ui.tool, hover, dragging, gesture.mode === 'pan'),
  };

  const hitProps = { 'data-hit-area': '', r: HIT_AREA_R, fill: COLOR_HANDLE_FILL, fillOpacity: 0, pointerEvents: 'all' } as const;
  const handleProps = (h: HandleRef, label: string, pressed?: boolean) =>
    ({
      className: 'ec-handle',
      'data-handle': h.kind,
      'data-handle-key': handleKey(h),
      tabIndex: tabIndexFor(h),
      ...(tabIndexFor(h) === 0 ? { 'aria-describedby': handleHelpId } : {}),
      role: 'button',
      'aria-label': label,
      ...(pressed === undefined ? {} : { 'aria-pressed': pressed }),
      onFocus: () => onHandleFocus(h),
    }) as const;

  return (
    <div className="ec-root">
      <svg
        ref={svgRef}
        className="ec-svg"
        role="application"
        aria-label="Lienzo del modelo: regiones, piezométrica y superficie de falla"
        aria-describedby={instructionsId}
        tabIndex={handles.length > 0 ? -1 : 0}
        viewBox={`0 0 ${size.w} ${size.h}`}
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      >
        <defs>
          <marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={COLOR_LOAD} />
          </marker>
          <marker id={seismicArrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={COLOR_SEISMIC} />
          </marker>
        </defs>

        <g data-layer="grid" aria-hidden="true">
          {grid.vertical.map((l) => (
            <g key={`gx${l.px}`}>
              <line x1={l.px} x2={l.px} y1={0} y2={vp.height} stroke={COLOR_GRID} strokeWidth={1} />
              {l.px < vp.width - AXIS_TITLE_RESERVE_PX && (
                <text x={l.px + 2} y={vp.height - 4} fontSize={AXIS_FONT_PX} fill={COLOR_AXIS_TEXT} {...HALO_LABEL}>{l.label}</text>
              )}
            </g>
          ))}
          {grid.horizontal.map((l) => (
            <g key={`gy${l.px}`}>
              <line x1={0} x2={vp.width} y1={l.px} y2={l.px} stroke={COLOR_GRID} strokeWidth={1} />
              {l.px > AXIS_TITLE_RESERVE_PX / 2 && (
                <text x={4} y={l.px - 2} fontSize={AXIS_FONT_PX} fill={COLOR_AXIS_TEXT} {...HALO_LABEL}>{l.label}</text>
              )}
            </g>
          ))}
          <text data-axis-title="x" x={vp.width - 6} y={vp.height - 4} textAnchor="end" fontSize={AXIS_FONT_PX} fill={COLOR_AXIS_TEXT} {...HALO_LABEL}>{titles.x}</text>
          <text data-axis-title="y" x={6} y={AXIS_FONT_PX + 4} fontSize={AXIS_FONT_PX} fill={COLOR_AXIS_TEXT} {...HALO_LABEL}>{titles.y}</text>
        </g>

        <g data-layer="regions">
          {shown.regions.map((region, ri) => {
            const mi = shown.materials.findIndex((m) => m.id === region.material);
            const regionSelected = sel.kind === 'region' && sel.regionIndex === ri;
            return (
              <polygon
                key={ri}
                data-region={ri}
                points={pointsAttr(vp, region.polygon)}
                fill={mi >= 0 ? materialColor(mi) : COLOR_MATERIAL_UNKNOWN}
                fillOpacity={0.85}
                stroke={regionSelected ? COLOR_SELECTED : COLOR_EDGE}
                strokeWidth={regionSelected ? 2.5 : 1.25}
                strokeLinejoin="round"
              />
            );
          })}
        </g>

        {result && result.slices.length > 0 && (
          <g data-layer="result" aria-hidden="true" pointerEvents="none">
            {result.slices.map((sl, i) => (
              <polygon
                key={i}
                data-slice={i}
                points={pointsAttr(vp, [
                  [sl.x_left, sl.y_base_left],
                  [sl.x_right, sl.y_base_right],
                  [sl.x_right, sl.y_top_mid],
                  [sl.x_left, sl.y_top_mid],
                ])}
                fill={COLOR_SLICE_FILL}
                stroke={COLOR_SLICE_EDGE}
                strokeWidth={0.6}
              />
            ))}
            <polyline points={surfaceArc(vp, result)} fill="none" stroke={COLOR_HALO} strokeWidth={6.5} strokeLinejoin="round" data-halo="critical-surface" />
            <polyline
              data-critical-surface
              data-converged={surfaceConverged ? 'true' : 'false'}
              points={surfaceArc(vp, result)}
              fill="none"
              stroke={surfaceConverged ? COLOR_RESULT : COLOR_SURFACE_UNCONVERGED}
              strokeWidth={2.5}
              strokeDasharray={surfaceConverged ? undefined : UNCONVERGED_DASH}
            />
          </g>
        )}

        <g data-layer="search-ranges">
          {(['entry', 'exit'] as const).map((which) => {
            const poly = rangeBand(shown, vp, which);
            const range = searchRange(shown, which);
            if (!poly || !range) return null;
            const rangeSelected = sel.kind === 'search_range' && sel.which === which;
            return (
              <polygon
                key={which}
                data-search-range={which}
                points={poly.map((p) => `${p[0]},${p[1]}`).join(' ')}
                fill={which === 'entry' ? COLOR_BAND_ENTRY : COLOR_BAND_EXIT}
                stroke={rangeSelected ? COLOR_SELECTED : 'none'}
                strokeWidth={2}
              >
                <title>{rangeLabel(which, range, unitsEff)}</title>
              </polygon>
            );
          })}
        </g>

        {pz.length >= 2 && (
          <g data-layer="piezometric">
            <polyline points={pointsAttr(vp, pz)} fill="none" stroke={COLOR_PIEZO} strokeWidth={2} strokeDasharray="8 4" />
          </g>
        )}
        {pzExtra && (
          // Tramo que el motor extrapola en horizontal hasta los bordes del modelo (R9-05d): punteado, para distinguirlo de la línea definida.
          <g data-layer="piezometric-extrapolated" aria-hidden="true" pointerEvents="none">
            {(['left', 'right'] as const).map((side) => {
              const seg = pzExtra[side];
              if (!seg) return null;
              return (
                <polyline
                  key={side}
                  data-piezo-extrapolated={side}
                  points={pointsAttr(vp, [...seg])}
                  fill="none"
                  stroke={COLOR_PIEZO}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray="1 5"
                >
                  <title>Piezométrica extrapolada: el motor la prolonga en horizontal hasta el borde del modelo</title>
                </polyline>
              );
            })}
          </g>
        )}

        {circle && (
          <g data-layer="surface">
            {(() => {
              const [cx, cy] = toS([circle.xc, circle.yc]);
              return (
                <circle cx={cx} cy={cy} r={circle.r * vp.scale} fill="none" stroke={COLOR_SURFACE} strokeWidth={2} strokeDasharray="6 4" />
              );
            })()}
          </g>
        )}

        <g data-layer="loads" aria-hidden="true">
          {loads.map((l) =>
            l.kind === 'udl' ? (
              <g key={`l${l.index}`} data-load={l.index} stroke={COLOR_LOAD} strokeWidth={1.5} fill="none">
                <polyline points={l.topLine.map((p) => `${p[0]},${p[1]}`).join(' ')} />
                {l.arrows.map((a, i) => (
                  <line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} markerEnd={`url(#${arrowId})`} />
                ))}
                <text x={l.label.x} y={l.label.y} fontSize={12} fill={COLOR_LOAD} {...HALO_LABEL} textAnchor="middle">{l.label.text}</text>
              </g>
            ) : (
              <g key={`l${l.index}`} data-load={l.index} stroke={COLOR_LOAD} strokeWidth={2.5} fill="none">
                <line x1={l.arrow.x1} y1={l.arrow.y1} x2={l.arrow.x2} y2={l.arrow.y2} markerEnd={`url(#${arrowId})`} />
                <text x={l.label.x} y={l.label.y} fontSize={12} fill={COLOR_LOAD} {...HALO_LABEL} textAnchor="middle">{l.label.text}</text>
              </g>
            ),
          )}
        </g>

        <g data-layer="seismic" aria-hidden="true">
          {seismic && (
            <g>
              <rect
                x={badge.x}
                y={badge.y}
                width={badge.width}
                height={badge.height}
                rx={4}
                fill="var(--canvas-seismic-bg)"
                stroke={COLOR_SEISMIC}
                strokeOpacity={0.8}
              />
              <text x={badge.textX} y={badge.textY} fontSize={13} fill={COLOR_SEISMIC}>{seismicLabel(seismic)}</text>
              <line
                x1={badge.arrowX1}
                x2={badge.arrowX2}
                y1={badge.arrowY}
                y2={badge.arrowY}
                stroke={COLOR_SEISMIC}
                strokeWidth={2.5}
                markerEnd={`url(#${seismicArrowId})`}
              />
            </g>
          )}
        </g>

        {guides && (
          <g data-layer="guides" aria-hidden="true" stroke={COLOR_SELECTED} strokeWidth={1} strokeDasharray="4 4">
            {guides.x !== null && <line x1={toS([guides.x, 0])[0]} x2={toS([guides.x, 0])[0]} y1={0} y2={vp.height} />}
            {guides.y !== null && <line x1={0} x2={vp.width} y1={toS([0, guides.y])[1]} y2={toS([0, guides.y])[1]} />}
          </g>
        )}

        {isTraceTool(ui.tool) && <DrawLayer draft={draft} vp={vp} mode={ui.tool === 'split_region' ? 'split' : 'draw'} />}

        <g data-layer="handles">
          {shown.regions.map((region, ri) =>
            region.polygon.map((p, vi) => {
              const [sx, sy] = toS(p);
              const isSel = sel.kind === 'vertex' && sel.regionIndex === ri && sel.vertexIndex === vi;
              const isTarget = snapTarget !== null && snapTarget.regionIndex === ri && snapTarget.vertexIndex === vi;
              const h: HandleRef = { kind: 'vertex', regionIndex: ri, vertexIndex: vi };
              return (
                <g key={`v${ri}-${vi}`} {...handleProps(h, vertexLabel(ri, vi, p, unitsEff), isSel)}>
                  <circle cx={sx} cy={sy} {...hitProps} />
                  <circle
                    data-handle-shape="vertex"
                    cx={sx}
                    cy={sy}
                    r={isSel || isTarget ? HANDLE_R + 2 : HANDLE_R}
                    fill={isSel ? COLOR_HANDLE_SEL : isTarget ? COLOR_HANDLE_SNAP : COLOR_HANDLE_FILL}
                    stroke={COLOR_HANDLE_RING}
                    strokeWidth={2}
                  />
                </g>
              );
            }),
          )}
          {pz.map((p, i) => {
            const [sx, sy] = toS(p);
            const isSel = sel.kind === 'piezo_point' && sel.index === i;
            const h: HandleRef = { kind: 'piezo_point', index: i };
            return (
              <g key={`p${i}`} {...handleProps(h, piezoLabel(i, p, unitsEff), isSel)}>
                <circle cx={sx} cy={sy} {...hitProps} />
                <rect
                  data-handle-shape="piezo_point"
                  x={sx - HANDLE_R}
                  y={sy - HANDLE_R}
                  width={HANDLE_R * 2}
                  height={HANDLE_R * 2}
                  fill={isSel ? COLOR_HANDLE_SEL : COLOR_PIEZO}
                  stroke={COLOR_HANDLE_RING}
                  strokeWidth={2}
                />
              </g>
            );
          })}
          {circle && (
            <>
              {(() => {
                const [cx, cy] = toS([circle.xc, circle.yc]);
                const [rx, ry] = toS(radiusHandlePoint(circle));
                const circleSel = sel.kind === 'surface_circle';
                const hc: HandleRef = { kind: 'circle_center' };
                const hr: HandleRef = { kind: 'circle_radius' };
                return (
                  <>
                    <line x1={cx} y1={cy} x2={rx} y2={ry} stroke={COLOR_SURFACE} strokeWidth={1} strokeDasharray="2 3" />
                    <g {...handleProps(hc, circleCenterLabel(circle.xc, circle.yc, unitsEff))}>
                      <circle cx={cx} cy={cy} {...hitProps} />
                      <circle
                        data-handle-shape="circle_center"
                        cx={cx}
                        cy={cy}
                        r={HANDLE_R + 1}
                        fill={circleSel ? COLOR_HANDLE_SEL : COLOR_SURFACE}
                        stroke={COLOR_HANDLE_RING}
                        strokeWidth={2}
                      />
                    </g>
                    <g {...handleProps(hr, circleRadiusLabel(circle.r, unitsEff))}>
                      <circle cx={rx} cy={ry} {...hitProps} />
                      <rect
                        data-handle-shape="circle_radius"
                        x={rx - HANDLE_R}
                        y={ry - HANDLE_R}
                        width={HANDLE_R * 2}
                        height={HANDLE_R * 2}
                        transform={`rotate(45 ${rx} ${ry})`}
                        fill={circleSel ? COLOR_HANDLE_SEL : COLOR_SURFACE}
                        stroke={COLOR_HANDLE_RING}
                        strokeWidth={2}
                      />
                    </g>
                  </>
                );
              })()}
            </>
          )}
        </g>
      </svg>

      <div className="ec-tools" role="group" aria-label="Zoom y encuadre">
        <button type="button" className="ec-tool" aria-label="Acercar" title="Acercar (+)" onClick={() => viewAction('in')}>
          <ToolIcon><path d="M10 4v12M4 10h12" /></ToolIcon>
        </button>
        <button type="button" className="ec-tool" aria-label="Alejar" title="Alejar (−)" onClick={() => viewAction('out')}>
          <ToolIcon><path d="M4 10h12" /></ToolIcon>
        </button>
        <button type="button" className="ec-tool" aria-label="Encuadrar" title="Encuadrar el modelo (0)" onClick={() => viewAction('fit')}>
          <ToolIcon><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" /></ToolIcon>
        </button>
      </div>

      <p ref={readoutRef} className="ec-cursor" aria-hidden="true" data-testid="cursor-readout" />

      {ui.tool === 'draw_region' && (
        <p className="ec-draw-hint" data-testid="draw-hint">
          <strong>Dibujar región</strong>: {draft.points.length === 0 ? 'ningún punto todavía' : `${draft.points.length} ${draft.points.length === 1 ? 'punto' : 'puntos'}`}.{' '}
          <span className="ec-draw-keys">
            Clic, toque o Espacio agrega un punto{draft.points.length >= 3 ? '; Intro o clic en el primero cierra' : ''} · Retroceso quita · Esc cancela
          </span>
          {drawError ? <span className="ec-draw-error"> {drawError}</span> : null}
        </p>
      )}
      {ui.tool === 'split_region' && (
        <p className="ec-draw-hint" data-testid="split-hint">
          <strong>Dividir región</strong>: {draft.points.length === 0 ? 'empiece la línea en el borde de la región' : `${draft.points.length} ${draft.points.length === 1 ? 'punto' : 'puntos'}`}.{' '}
          <span className="ec-draw-keys">
            Clic, toque o Espacio agrega un punto{draft.points.length >= 1 ? '; un clic en el borde o Intro divide' : ''} · Retroceso quita · Esc cancela
          </span>
          {drawError ? <span className="ec-draw-error"> {drawError}</span> : null}
        </p>
      )}
      {emptyState && doc.regions.length === 0 && !isTraceTool(ui.tool) ? (
        <div className="ec-empty" data-testid="canvas-empty">
          {emptyState}
        </div>
      ) : null}

      <p id={handleHelpId} className="visually-hidden">{HANDLE_INSTRUCTIONS}</p>
      <p id={instructionsId} className="visually-hidden">{CANVAS_INSTRUCTIONS}{doc.regions.length === 0 ? ' El modelo no tiene regiones: elija la herramienta Dibujar región (tecla R).' : ''}</p>
      {!onAnnounce && (
        <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-testid="canvas-live">
          {liveMsg}
        </div>
      )}
    </div>
  );
}
