// Lienzo SVG del editor: regiones, vértices, piezométrica, círculo fijo, rangos de búsqueda, cargas y sismo.
// Solo usa la interfaz EditorStore. La lógica (hit test, snap, gestos, teclado) vive en módulos puros.

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import type { Point } from '../../engine/types';
import { worldToScreen, type Viewport } from '../../geometry/viewport';
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
import { piezoPoints } from './geom';
import { hitTest, radiusHandlePoint, searchRange, type Hit } from './hitTest';
import { keyActions } from './keys';
import {
  circleCenterLabel,
  circleRadiusLabel,
  gridLines,
  loadShapes,
  pointsAttr,
  piezoLabel,
  rangeBand,
  rangeLabel,
  seismicLabel,
  slideDirection,
  vertexLabel,
} from './layout';
import { fitToDoc, wheelFactor, zoomAt } from './viewportOps';

const COLOR_EDGE = '#1f2937';
const COLOR_SELECTED = '#2563eb';
const COLOR_PIEZO = '#1d4ed8';
const COLOR_SURFACE = '#dc2626';
const COLOR_LOAD = '#7c3aed';
const COLOR_SEISMIC = '#c2410c';
const COLOR_GRID = '#e5e7eb';
const COLOR_AXIS_TEXT = '#6b7280';
const COLOR_BAND_ENTRY = 'rgba(22, 163, 74, 0.35)';
const COLOR_BAND_EXIT = 'rgba(234, 88, 12, 0.35)';

const HANDLE_R = 5;

function cursorFor(tool: string, hover: Hit['kind'] | null, dragging: boolean, panning: boolean): string {
  if (panning) return 'grabbing';
  if (tool === 'pan') return 'grab';
  if (dragging) return 'grabbing';
  if (hover === 'vertex' || hover === 'piezo_point' || hover === 'circle_center' || hover === 'circle_radius') return 'move';
  if (tool === 'add_vertex') return hover === 'edge' || hover === 'piezo_edge' ? 'copy' : 'crosshair';
  return 'default';
}

export function EditorCanvas({ store }: { store: EditorStore }) {
  // Envolturas con identidad estable por store: no dependen de `this` ni de cómo W1 construya el objeto.
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const getState = useCallback(() => store.getState(), [store]);
  const state = useSyncExternalStore(subscribe, getState, getState);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [gesture, setGesture] = useState<GestureState>(IDLE);
  const gestureRef = useRef<GestureState>(IDLE);
  const [hover, setHover] = useState<Hit['kind'] | null>(null);
  const markerBase = useId().replace(/:/g, '_');

  const { doc, ui } = state;

  // Tamaño del lienzo (ResizeObserver solo existe en el navegador).
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = (): void => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
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
      store.dispatch({ type: 'ui/viewport', viewport: fitToDoc(s.doc, size.w, size.h) });
    } else if (vp.width !== size.w || vp.height !== size.h) {
      store.dispatch({ type: 'ui/viewport', viewport: { ...vp, width: size.w, height: size.h } });
    }
  }, [store, size.w, size.h, ui.viewport]);

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

  // Si el componente se desmonta durante un arrastre, el gesto se cancela.
  useEffect(
    () => () => {
      if (gestureRef.current.mode === 'drag') store.cancelGesture();
    },
    [store],
  );

  const vp: Viewport = ui.viewport ?? fitToDoc(doc, size.w, size.h);
  const preview = gesture.mode === 'drag' ? gesture.preview : null;
  const shown: ModelDoc = applyPreview(doc, preview);

  const context = (): GestureContext => {
    const s = store.getState();
    return { doc: s.doc, ui: s.ui.viewport ? s.ui : { ...s.ui, viewport: vp } };
  };
  const localInput = (e: PointerEvent<SVGSVGElement>): PointerInput => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, button: e.button, altKey: e.altKey };
  };
  const apply = (r: GestureResult): void => {
    gestureRef.current = r.state;
    setGesture(r.state);
    runActions(store, r.actions);
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>): void => {
    const r = pointerDown(gestureRef.current, context(), localInput(e));
    if (r.state.mode !== 'idle') {
      e.currentTarget.setPointerCapture(e.pointerId);
      if (e.button === 1) e.preventDefault();
    }
    apply(r);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>): void => {
    const input = localInput(e);
    const ctx = context();
    if (gestureRef.current.mode === 'idle') {
      const kind = ctx.ui.viewport ? hitTest(ctx.doc, ctx.ui.viewport, input.x, input.y, ctx.ui.snap.radiusPx).kind : null;
      if (kind !== hover) setHover(kind);
      return;
    }
    apply(pointerMove(gestureRef.current, ctx, input));
  };
  const onPointerUp = (e: PointerEvent<SVGSVGElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    apply(pointerUp(gestureRef.current, context(), localInput(e)));
  };
  const onPointerCancel = (): void => apply(pointerCancel(gestureRef.current));
  const onDoubleClick = (e: MouseEvent<SVGSVGElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    runActions(store, doubleClick(context(), { x: e.clientX - rect.left, y: e.clientY - rect.top, button: 0 }));
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>): void => {
    if (e.key === 'Escape' && gestureRef.current.mode !== 'idle') {
      e.preventDefault();
      apply(pointerCancel(gestureRef.current));
      return;
    }
    const r = keyActions(context(), e, gestureRef.current.mode !== 'idle');
    if (r.handled) e.preventDefault();
    runActions(store, r.actions);
  };

  const sel = ui.selection;
  const toS = (p: Point): [number, number] => worldToScreen(vp, p[0], p[1]);
  const grid = gridLines(vp);
  const pz = piezoPoints(shown);
  const circle = shown.analysis.surface ?? null;
  const loads = loadShapes(shown, vp);
  const seismic = shown.analysis.seismic ?? null;
  const dir = slideDirection(shown);
  const dragging = gesture.mode === 'drag' && gesture.moved;
  const guides = preview && preview.kind !== 'circle' ? preview.snap.guides : null;
  const snapTarget = preview && preview.kind === 'vertex' ? preview.snap.target : null;
  const arrowId = `${markerBase}-load`;
  const seismicArrowId = `${markerBase}-seismic`;

  const style: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    minHeight: 320,
    background: '#ffffff',
    touchAction: 'none',
    userSelect: 'none',
    cursor: cursorFor(ui.tool, hover, dragging, gesture.mode === 'pan'),
  };

  return (
    <svg
      ref={svgRef}
      role="application"
      aria-label="Lienzo del modelo: regiones, piezométrica y superficie de falla"
      tabIndex={0}
      viewBox={`0 0 ${size.w} ${size.h}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
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
            <text x={l.px + 2} y={vp.height - 4} fontSize={10} fill={COLOR_AXIS_TEXT}>{l.label}</text>
          </g>
        ))}
        {grid.horizontal.map((l) => (
          <g key={`gy${l.px}`}>
            <line x1={0} x2={vp.width} y1={l.px} y2={l.px} stroke={COLOR_GRID} strokeWidth={1} />
            <text x={4} y={l.px - 2} fontSize={10} fill={COLOR_AXIS_TEXT}>{l.label}</text>
          </g>
        ))}
      </g>

      <g data-layer="regions">
        {shown.regions.map((region, ri) => {
          const mi = shown.materials.findIndex((m) => m.id === region.material);
          const selected = sel.kind === 'region' && sel.regionIndex === ri;
          return (
            <polygon
              key={ri}
              data-region={ri}
              points={pointsAttr(vp, region.polygon)}
              fill={mi >= 0 ? materialColor(mi) : '#cccccc'}
              fillOpacity={0.85}
              stroke={selected ? COLOR_SELECTED : COLOR_EDGE}
              strokeWidth={selected ? 2.5 : 1.25}
              strokeLinejoin="round"
            />
          );
        })}
      </g>

      <g data-layer="search-ranges">
        {(['entry', 'exit'] as const).map((which) => {
          const poly = rangeBand(shown, vp, which);
          const range = searchRange(shown, which);
          if (!poly || !range) return null;
          const selected = sel.kind === 'search_range' && sel.which === which;
          return (
            <polygon
              key={which}
              data-search-range={which}
              points={poly.map((p) => `${p[0]},${p[1]}`).join(' ')}
              fill={which === 'entry' ? COLOR_BAND_ENTRY : COLOR_BAND_EXIT}
              stroke={selected ? COLOR_SELECTED : 'none'}
              strokeWidth={2}
            >
              <title>{rangeLabel(which, range)}</title>
            </polygon>
          );
        })}
      </g>

      {pz.length >= 2 && (
        <g data-layer="piezometric">
          <polyline points={pointsAttr(vp, pz)} fill="none" stroke={COLOR_PIEZO} strokeWidth={2} strokeDasharray="8 4" />
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
              <text x={l.label.x} y={l.label.y} fontSize={12} fill={COLOR_LOAD} stroke="none" textAnchor="middle">{l.label.text}</text>
            </g>
          ) : (
            <g key={`l${l.index}`} data-load={l.index} stroke={COLOR_LOAD} strokeWidth={2.5} fill="none">
              <line x1={l.arrow.x1} y1={l.arrow.y1} x2={l.arrow.x2} y2={l.arrow.y2} markerEnd={`url(#${arrowId})`} />
              <text x={l.label.x} y={l.label.y} fontSize={12} fill={COLOR_LOAD} stroke="none" textAnchor="middle">{l.label.text}</text>
            </g>
          ),
        )}
      </g>

      <g data-layer="seismic" aria-hidden="true">
        {seismic && (
          <g>
            <rect x={10} y={10} width={196} height={50} rx={4} fill="rgba(255,255,255,0.9)" stroke={COLOR_SEISMIC} />
            <text x={18} y={29} fontSize={13} fill={COLOR_SEISMIC}>{seismicLabel(seismic)}</text>
            <line
              x1={dir === 1 ? 18 : 198}
              x2={dir === 1 ? 198 : 18}
              y1={46}
              y2={46}
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

      <g data-layer="handles">
        {shown.regions.map((region, ri) =>
          region.polygon.map((p, vi) => {
            const [sx, sy] = toS(p);
            const selected = sel.kind === 'vertex' && sel.regionIndex === ri && sel.vertexIndex === vi;
            const target = snapTarget !== null && snapTarget.regionIndex === ri && snapTarget.vertexIndex === vi;
            return (
              <circle
                key={`v${ri}-${vi}`}
                data-handle="vertex"
                cx={sx}
                cy={sy}
                r={selected || target ? HANDLE_R + 2 : HANDLE_R}
                fill={selected ? '#f59e0b' : target ? '#16a34a' : '#ffffff'}
                stroke={COLOR_EDGE}
                strokeWidth={1.5}
                tabIndex={0}
                role="button"
                aria-label={vertexLabel(ri, vi, p)}
                aria-pressed={selected}
                onFocus={() => store.dispatch({ type: 'ui/select', selection: { kind: 'vertex', regionIndex: ri, vertexIndex: vi } })}
              />
            );
          }),
        )}
        {pz.map((p, i) => {
          const [sx, sy] = toS(p);
          const selected = sel.kind === 'piezo_point' && sel.index === i;
          return (
            <rect
              key={`p${i}`}
              data-handle="piezo_point"
              x={sx - HANDLE_R}
              y={sy - HANDLE_R}
              width={HANDLE_R * 2}
              height={HANDLE_R * 2}
              fill={selected ? '#f59e0b' : COLOR_PIEZO}
              stroke="#ffffff"
              strokeWidth={1.5}
              tabIndex={0}
              role="button"
              aria-label={piezoLabel(i, p)}
              aria-pressed={selected}
              onFocus={() => store.dispatch({ type: 'ui/select', selection: { kind: 'piezo_point', index: i } })}
            />
          );
        })}
        {circle && (
          <>
            {(() => {
              const [cx, cy] = toS([circle.xc, circle.yc]);
              const [rx, ry] = toS(radiusHandlePoint(circle));
              const selected = sel.kind === 'surface_circle';
              const select = (): void => store.dispatch({ type: 'ui/select', selection: { kind: 'surface_circle' } });
              return (
                <>
                  <line x1={cx} y1={cy} x2={rx} y2={ry} stroke={COLOR_SURFACE} strokeWidth={1} strokeDasharray="2 3" />
                  <circle
                    data-handle="circle_center"
                    cx={cx}
                    cy={cy}
                    r={HANDLE_R + 1}
                    fill={selected ? '#f59e0b' : COLOR_SURFACE}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    tabIndex={0}
                    role="button"
                    aria-label={circleCenterLabel(circle.xc, circle.yc)}
                    onFocus={select}
                  />
                  <rect
                    data-handle="circle_radius"
                    x={rx - HANDLE_R}
                    y={ry - HANDLE_R}
                    width={HANDLE_R * 2}
                    height={HANDLE_R * 2}
                    transform={`rotate(45 ${rx} ${ry})`}
                    fill={selected ? '#f59e0b' : COLOR_SURFACE}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    tabIndex={0}
                    role="button"
                    aria-label={circleRadiusLabel(circle.r)}
                    onFocus={select}
                  />
                </>
              );
            })()}
          </>
        )}
      </g>
    </svg>
  );
}
