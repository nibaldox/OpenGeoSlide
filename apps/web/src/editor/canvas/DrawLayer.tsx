// Vista previa del dibujo de una región (herramienta «Dibujar región»): contorno colocado, arista elástica hasta el cursor,
// primer vértice destacado para cerrar y cursor del teclado. Capa decorativa (`aria-hidden`): el estado se anuncia por la región viva.

import { worldToScreen, type Viewport } from '../../geometry/viewport';
import type { DrawDraft } from './draw';

const COLOR_PATH = 'var(--canvas-selected)';
const COLOR_HALO = 'var(--canvas-halo)';
const COLOR_FILL = 'var(--canvas-handle-fill)';
const COLOR_RING = 'var(--canvas-handle-ring)';
const COLOR_SNAP = 'var(--canvas-handle-snap)';

/** Radio visible de los puntos colocados: 12 px de diámetro como los tiradores. */
const POINT_R = 6;
/** Anillo del primer punto cuando ya se puede cerrar. */
const CLOSE_R = 11;
const CROSS_ARM = 9;

export function DrawLayer({ draft, vp, mode = 'draw' }: { draft: DrawDraft; vp: Viewport; mode?: 'draw' | 'split' }) {
  const split = mode === 'split';
  const pts = draft.points.map((p) => worldToScreen(vp, p[0], p[1]));
  const cur = draft.cursor ? worldToScreen(vp, draft.cursor[0], draft.cursor[1]) : null;
  const last = pts[pts.length - 1];
  const first = pts[0];
  const joined = pts.map((p) => `${p[0]},${p[1]}`).join(' ');
  return (
    <g data-layer={split ? 'split' : 'draw'} data-points={draft.points.length} aria-hidden="true" pointerEvents="none">
      {!split && pts.length >= 3 && cur && <polygon points={`${joined} ${cur[0]},${cur[1]}`} fill={COLOR_PATH} fillOpacity={0.12} stroke="none" />}
      {!split && pts.length >= 3 && !cur && <polygon points={joined} fill={COLOR_PATH} fillOpacity={0.12} stroke="none" />}
      {pts.length >= 2 && <polyline points={joined} fill="none" stroke={COLOR_HALO} strokeWidth={5.5} strokeLinejoin="round" strokeLinecap="round" />}
      {pts.length >= 2 && <polyline data-draw-path points={joined} fill="none" stroke={COLOR_PATH} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      {last && cur && (
        <>
          <line x1={last[0]} y1={last[1]} x2={cur[0]} y2={cur[1]} stroke={COLOR_HALO} strokeWidth={5.5} strokeLinecap="round" />
          <line data-draw-rubber x1={last[0]} y1={last[1]} x2={cur[0]} y2={cur[1]} stroke={COLOR_PATH} strokeWidth={2} strokeDasharray="6 4" />
        </>
      )}
      {!split && first && cur && pts.length >= 2 && <line x1={cur[0]} y1={cur[1]} x2={first[0]} y2={first[1]} stroke={COLOR_PATH} strokeWidth={1.5} strokeDasharray="2 5" strokeOpacity={0.7} />}
      {!split && first && pts.length >= 3 && <circle data-draw-close cx={first[0]} cy={first[1]} r={CLOSE_R} fill="none" stroke={COLOR_PATH} strokeWidth={2.5} />}
      {pts.map((p, i) => (
        <circle key={i} data-draw-point={i} cx={p[0]} cy={p[1]} r={POINT_R} fill={COLOR_FILL} stroke={COLOR_RING} strokeWidth={2} />
      ))}
      {cur && (
        <g data-draw-cursor>
          {draft.snapKind === 'vertex' && <circle cx={cur[0]} cy={cur[1]} r={POINT_R + 4} fill="none" stroke={COLOR_SNAP} strokeWidth={2.5} />}
          {draft.snapKind === 'edge' && (
            <rect data-draw-edge-snap x={cur[0] - POINT_R - 3} y={cur[1] - POINT_R - 3} width={2 * POINT_R + 6} height={2 * POINT_R + 6} transform={`rotate(45 ${cur[0]} ${cur[1]})`} fill="none" stroke={COLOR_SNAP} strokeWidth={2.5} />
          )}
          <path d={`M${cur[0] - CROSS_ARM},${cur[1]}H${cur[0] + CROSS_ARM}M${cur[0]},${cur[1] - CROSS_ARM}V${cur[1] + CROSS_ARM}`} stroke={COLOR_HALO} strokeWidth={4.5} strokeLinecap="round" />
          <path d={`M${cur[0] - CROSS_ARM},${cur[1]}H${cur[0] + CROSS_ARM}M${cur[0]},${cur[1] - CROSS_ARM}V${cur[1] + CROSS_ARM}`} stroke={COLOR_PATH} strokeWidth={2} strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}
