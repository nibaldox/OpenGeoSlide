// Dibujo en Canvas 2D. Escala única en x e y (aspecto 1:1), ejes con escala en metros y
// superficie crítica en rojo sobre dovelas grises. Los ejes usan la unidad del modelo. La piezométrica va en azul discontinuo.

import { fitViewport, worldToScreen, type Viewport } from '../geometry/viewport';
import { lengthUnitOf } from '../editor/canvas/layout';
import { defaultSectionPalette, type SectionPalette } from '../theme/sectionPalette';
import { materialSlot, type Scene } from './scene';

const MARGIN_PX = 56;
/** Etiquetas de los ejes de 12 px o más (UX-20). */
const AXIS_FONT = '12px system-ui, sans-serif';
/** Grosor extra, a cada lado, del halo que separa un trazo del fondo y de los materiales. */
const HALO_EXTRA_PX = 2;
/** Trazo de la superficie evaluada sin convergencia: el mismo `10 6` del lienzo del editor. */
const UNCONVERGED_DASH = [10, 6];
/** Tramo extrapolado de la piezométrica: punteado `1 5` con extremos redondos, como en el lienzo del editor. */
const PIEZO_EXTRAPOLATED_DASH = [1, 5];
/** Grosor del halo de los rótulos. */
const HALO_TEXT_PX = 3;

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

function drawAxes(ctx: CanvasRenderingContext2D, vp: Viewport, scene: Scene, palette: SectionPalette, unit: string): void {
  const { minX, maxX, minY, maxY } = scene.bounds;
  const [left, top] = worldToScreen(vp, minX, maxY);
  const [right, bottom] = worldToScreen(vp, maxX, minY);

  const stepX = niceStep(maxX - minX);
  const stepY = niceStep(maxY - minY);
  const decX = decimalsFor(stepX);
  const decY = decimalsFor(stepY);

  ctx.font = AXIS_FONT;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;

  ctx.strokeStyle = palette.grid;
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

  ctx.strokeStyle = palette.axis;
  ctx.strokeRect(left, top, right - left, bottom - top);

  ctx.fillStyle = palette.axisText;
  const label = (text: string, x: number, y: number): void => {
    // Halo: el rótulo se lee aunque lo cruce una línea de la cuadrícula o un material.
    ctx.lineWidth = HALO_TEXT_PX;
    ctx.strokeStyle = palette.halo;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  };
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const x of ticksBetween(minX, maxX, stepX)) {
    const [sx] = worldToScreen(vp, x, 0);
    label(x.toFixed(decX), sx, bottom + 4);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const y of ticksBetween(minY, maxY, stepY)) {
    const [, sy] = worldToScreen(vp, 0, y);
    label(y.toFixed(decY), left - 6, sy);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  label(`x (${unit})`, right, bottom + 18);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  label(`y (${unit})`, left, top - 6);
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
  palette: SectionPalette = defaultSectionPalette(),
  units?: string | null,
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const vp = fitViewport(scene.bounds, cssWidth, cssHeight, MARGIN_PX);
  // Los ejes llevan la unidad de longitud del modelo (m en SI, ft en imperial): el parámetro manda sobre `scene.units`.
  drawAxes(ctx, vp, scene, palette, lengthUnitOf(units ?? scene.units));

  // Regiones por material
  for (const region of scene.regions) {
    const known = scene.materials[region.materialIndex] !== undefined;
    tracePolygon(ctx, vp, region.polygon);
    ctx.fillStyle = known ? palette.materials[materialSlot(region.materialIndex)] : palette.materialUnknown;
    ctx.fill();
    ctx.strokeStyle = palette.regionEdge;
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
      ctx.fillStyle = palette.sliceFill;
      ctx.fill();
      ctx.strokeStyle = palette.sliceEdge;
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
    ctx.setLineDash([]);
    // Halo bajo la superficie crítica (UX-06): conserva el contraste sobre cualquier material.
    ctx.strokeStyle = palette.halo;
    ctx.lineWidth = 2.2 + 2 * HALO_EXTRA_PX;
    ctx.stroke();
    // R9-12b: un método que no convergió no tiene superficie crítica; la evaluada se dibuja discontinua y con otro tono, como en el editor.
    const converged = scene.surface.converged !== false;
    ctx.strokeStyle = converged ? palette.surface : palette.surfaceUnconverged;
    ctx.lineWidth = 2.2;
    ctx.setLineDash(converged ? [] : UNCONVERGED_DASH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Piezométrica (azul discontinuo)
  if (scene.piezo && scene.piezo.length > 0) {
    ctx.beginPath();
    scene.piezo.forEach(([x, y], i) => {
      const [sx, sy] = worldToScreen(vp, x, y);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.setLineDash([]);
    ctx.strokeStyle = palette.halo;
    ctx.lineWidth = 2 + 2 * HALO_EXTRA_PX;
    ctx.stroke();
    ctx.strokeStyle = palette.piezo;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // R9-05d: el motor prolonga la piezométrica en horizontal hasta los bordes del modelo; ese tramo va punteado para que el agua no parezca terminar en el último punto.
  const ext = scene.piezoExtension;
  if (scene.piezo && scene.piezo.length > 0 && ext) {
    for (const seg of [ext.left, ext.right]) {
      if (!seg) continue;
      ctx.beginPath();
      seg.forEach(([x, y], i) => {
        const [sx, sy] = worldToScreen(vp, x, y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.setLineDash([]);
      ctx.lineCap = 'butt';
      ctx.strokeStyle = palette.halo;
      ctx.lineWidth = 2 + 2 * HALO_EXTRA_PX;
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.strokeStyle = palette.piezo;
      ctx.lineWidth = 2;
      ctx.setLineDash(PIEZO_EXTRAPOLATED_DASH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineCap = 'butt';
    }
  }
}
