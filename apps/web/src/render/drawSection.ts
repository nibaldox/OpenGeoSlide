// Dibujo en Canvas 2D. Escala única en x e y (aspecto 1:1), ejes con escala en metros y
// superficie crítica en rojo sobre dovelas grises. La piezométrica va en azul discontinuo.

import { fitViewport, worldToScreen, type Viewport } from '../geometry/viewport';
import type { Scene } from './scene';

const MARGIN_PX = 56;
const COLOR_GRID = '#e5e7eb';
const COLOR_AXIS = '#374151';
const COLOR_REGION_EDGE = '#1f2937';
const COLOR_SURFACE = '#dc2626';
const COLOR_SLICE_FILL = 'rgba(75, 85, 99, 0.14)';
const COLOR_SLICE_EDGE = 'rgba(75, 85, 99, 0.55)';
const COLOR_PIEZO = '#1d4ed8';

/** Paso "bonito" (1, 2 o 5 × 10^k) para unas `target` divisiones del intervalo. */
export function niceStep(span: number, target = 8): number {
  if (!(span > 0)) return 1;
  const raw = span / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const f = raw / power;
  const mult = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  return mult * power;
}

export function ticksBetween(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  for (let k = first; k <= last; k++) {
    out.push(Number((k * step).toFixed(10)));
  }
  return out;
}

function decimalsFor(step: number): number {
  return step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step)));
}

function drawAxes(ctx: CanvasRenderingContext2D, vp: Viewport, scene: Scene): void {
  const { minX, maxX, minY, maxY } = scene.bounds;
  const [left, top] = worldToScreen(vp, minX, maxY);
  const [right, bottom] = worldToScreen(vp, maxX, minY);

  const stepX = niceStep(maxX - minX);
  const stepY = niceStep(maxY - minY);
  const decX = decimalsFor(stepX);
  const decY = decimalsFor(stepY);

  ctx.font = '11px system-ui, sans-serif';
  ctx.lineWidth = 1;

  ctx.strokeStyle = COLOR_GRID;
  for (const x of ticksBetween(minX, maxX, stepX)) {
    const [sx] = worldToScreen(vp, x, 0);
    ctx.beginPath();
    ctx.moveTo(sx, top);
    ctx.lineTo(sx, bottom);
    ctx.stroke();
  }
  for (const y of ticksBetween(minY, maxY, stepY)) {
    const [, sy] = worldToScreen(vp, 0, y);
    ctx.beginPath();
    ctx.moveTo(left, sy);
    ctx.lineTo(right, sy);
    ctx.stroke();
  }

  ctx.strokeStyle = COLOR_AXIS;
  ctx.strokeRect(left, top, right - left, bottom - top);

  ctx.fillStyle = COLOR_AXIS;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const x of ticksBetween(minX, maxX, stepX)) {
    const [sx] = worldToScreen(vp, x, 0);
    ctx.fillText(x.toFixed(decX), sx, bottom + 4);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const y of ticksBetween(minY, maxY, stepY)) {
    const [, sy] = worldToScreen(vp, 0, y);
    ctx.fillText(y.toFixed(decY), left - 6, sy);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('x (m)', right, bottom + 18);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('y (m)', left, top - 6);
}

function tracePolygon(ctx: CanvasRenderingContext2D, vp: Viewport, points: [number, number][]): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    const [sx, sy] = worldToScreen(vp, x, y);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
}

/** Dibuja la escena completa. `cssWidth`/`cssHeight` están en px CSS; el lienzo ya tiene `dpr` escalado. */
export function drawSection(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  scene: Scene,
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const vp = fitViewport(scene.bounds, cssWidth, cssHeight, MARGIN_PX);
  drawAxes(ctx, vp, scene);

  // Regiones por material
  for (const region of scene.regions) {
    const material = scene.materials[region.materialIndex];
    tracePolygon(ctx, vp, region.polygon);
    ctx.fillStyle = material?.color ?? '#cccccc';
    ctx.fill();
    ctx.strokeStyle = COLOR_REGION_EDGE;
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }

  // Dovelas
  if (scene.surface) {
    for (const s of scene.surface.slices) {
      tracePolygon(ctx, vp, [
        [s.x_left, s.y_base_left],
        [s.x_right, s.y_base_right],
        [s.x_right, s.y_top_mid],
        [s.x_left, s.y_top_mid],
      ]);
      ctx.fillStyle = COLOR_SLICE_FILL;
      ctx.fill();
      ctx.strokeStyle = COLOR_SLICE_EDGE;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Superficie crítica (arco inferior entre el pie y el coronamiento)
    const { circle, slices } = scene.surface;
    const xmin = Math.min(...slices.map((s) => s.x_left));
    const xmax = Math.max(...slices.map((s) => s.x_right));
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const x = xmin + ((xmax - xmin) * i) / 240;
      const d = circle.r * circle.r - (x - circle.xc) ** 2;
      if (d < 0) continue;
      const [sx, sy] = worldToScreen(vp, x, circle.yc - Math.sqrt(d));
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = COLOR_SURFACE;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([]);
    ctx.stroke();
  }

  // Piezométrica (azul discontinuo)
  if (scene.piezo && scene.piezo.length > 0) {
    ctx.beginPath();
    scene.piezo.forEach(([x, y], i) => {
      const [sx, sy] = worldToScreen(vp, x, y);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.strokeStyle = COLOR_PIEZO;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
