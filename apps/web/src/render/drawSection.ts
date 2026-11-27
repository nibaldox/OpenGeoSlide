// Dibujo en Canvas 2D. Escala única en x e y (aspecto 1:1), ejes con escala en metros y
// superficie crítica en rojo sobre dovelas grises. Los ejes usan la unidad del modelo. La piezométrica va en azul discontinuo.

import { fitViewport, worldToScreen, type Viewport } from '../geometry/viewport';
import { lengthUnitOf } from '../editor/canvas/layout';
import { defaultSectionPalette, type SectionPalette } from '../theme/sectionPalette';
import { forceShapes, placeReinforcementLabels, reinforcementShapes, type ShapePart } from '../editor/canvas/reinforcements';
import { crackShape, noCrackLabel } from './crack';
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
/** Línea de la grieta de tracción: discontinua, distinta de la superficie (continua) y de la piezométrica (`8 5`). */
const CRACK_DASH = [5, 4];
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

/** Una parte del símbolo de un refuerzo en el Canvas 2D; `extra` ensancha el trazo (halo). */
function strokePart(ctx: CanvasRenderingContext2D, part: ShapePart, color: string, extra: number): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = part.width + extra;
  ctx.beginPath();
  if (part.kind === 'circle') {
    ctx.arc(part.cx, part.cy, part.r, 0, Math.PI * 2);
  } else {
    part.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    if (part.closed) ctx.closePath();
  }
  ctx.stroke();
  if (extra === 0 && part.fill) ctx.fill();
}

/**
 * Refuerzos (v0.4) y las fuerzas del resultado: el símbolo de cada tipo con halo, su rótulo y una flecha por fuerza aplicada; los cruces
 * que no se aplicaron llevan una marca gris con su estado. Mismas formas que el lienzo del editor (`editor/canvas/reinforcements.ts`).
 */
function drawReinforcements(ctx: CanvasRenderingContext2D, vp: Viewport, scene: Scene, palette: SectionPalette, units?: string | null): void {
  if (!scene.reinforcements || scene.reinforcements.length === 0) return;
  const u = units ?? scene.units;
  ctx.setLineDash([]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // E14o-16 (R11B-05): los rótulos de los símbolos y los de las fuerzas se colocan juntos, sin solapes.
  const placed = placeReinforcementLabels(reinforcementShapes(scene.reinforcements, vp, u), forceShapes(scene.reinforcementForces, vp, u, scene.reinforcements), vp);
  const shapes = placed.shapes;
  for (const s of shapes) for (const part of s.parts) strokePart(ctx, part, palette.halo, 3.5);
  for (const s of shapes) for (const part of s.parts) strokePart(ctx, part, palette.reinforcement, 0);
  ctx.font = AXIS_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = (t: string, x: number, y: number, color: string): void => {
    ctx.lineWidth = HALO_TEXT_PX;
    ctx.strokeStyle = palette.halo;
    ctx.strokeText(t, x, y);
    ctx.fillStyle = color;
    ctx.fillText(t, x, y);
  };
  // Primero las flechas y las marcas; los rótulos de todos, encima en una pasada final (ninguna flecha vecina los tapa).
  for (const f of placed.forces) {
    const color = f.applied ? palette.reinforcement : palette.axisText;
    if (f.tip) {
      const [ax, ay] = f.at;
      const [tx, ty] = f.tip;
      const len = Math.hypot(tx - ax, ty - ay) || 1;
      const ux = (tx - ax) / len;
      const uy = (ty - ay) / len;
      const head = 9;
      const arrow = (c: string, w: number): void => {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      };
      arrow(palette.halo, 6.5);
      arrow(color, 3);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(tx + ux * 2, ty + uy * 2);
      ctx.lineTo(tx - ux * head - uy * 4, ty - uy * head + ux * 4);
      ctx.lineTo(tx - ux * head + uy * 4, ty - uy * head - ux * 4);
      ctx.closePath();
      ctx.fill();
    } else {
      const [x, y] = f.at;
      for (const [c, w] of [[palette.halo, 6], [color, 2.5]] as const) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 6);
        ctx.lineTo(x + 6, y + 6);
        ctx.moveTo(x - 6, y + 6);
        ctx.lineTo(x + 6, y - 6);
        ctx.stroke();
      }
    }
  }
  for (const s of shapes) text(s.label.text, s.label.x, s.label.y, palette.reinforcement);
  for (const f of placed.forces) text(f.label.text, f.label.x, f.label.y, f.applied ? palette.reinforcement : palette.axisText);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

/**
 * Grieta de tracción de la superficie dibujada (F5.4): línea discontinua vertical en `x_c` con su profundidad, el hueco de agua y la
 * flecha de `Pw` hacia la masa. Mismas formas que el lienzo del editor (`crackShape`).
 */
function drawCrack(ctx: CanvasRenderingContext2D, vp: Viewport, scene: Scene, palette: SectionPalette, units?: string | null): void {
  if (!scene.crack) return;
  const shape = crackShape(scene.crack, vp, units ?? scene.units);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (shape.water) {
    const w = shape.water;
    ctx.fillStyle = palette.pond;
    ctx.fillRect(w.x, w.y, w.width, w.height);
    ctx.strokeStyle = palette.piezo;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([]);
    ctx.strokeRect(w.x, w.y, w.width, w.height);
  }
  const line = (color: string, width: number, dash: number[]): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(shape.top[0], shape.top[1]);
    ctx.lineTo(shape.bottom[0], shape.bottom[1]);
    ctx.stroke();
  };
  line(palette.halo, 2.5 + 2 * HALO_EXTRA_PX, []);
  line(palette.surface, 2.5, CRACK_DASH);
  ctx.setLineDash([]);
  if (shape.arrow) {
    const [ax, ay] = shape.arrow.at;
    const [tx, ty] = shape.arrow.tip;
    const ux = Math.sign(tx - ax);
    const arrow = (c: string, w: number): void => {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    };
    arrow(palette.halo, 6.5);
    arrow(palette.piezo, 3);
    ctx.fillStyle = palette.piezo;
    ctx.beginPath();
    ctx.moveTo(tx + ux * 2, ty);
    ctx.lineTo(tx - ux * 9, ty - 4);
    ctx.lineTo(tx - ux * 9, ty + 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.font = AXIS_FONT;
  ctx.textBaseline = 'middle';
  const text = (l: { x: number; y: number; text: string; anchor: 'start' | 'end' }, color: string): void => {
    ctx.textAlign = l.anchor === 'start' ? 'left' : 'right';
    ctx.lineWidth = HALO_TEXT_PX;
    ctx.strokeStyle = palette.halo;
    ctx.strokeText(l.text, l.x, l.y);
    ctx.fillStyle = color;
    ctx.fillText(l.text, l.x, l.y);
  };
  text(shape.depthLabel, palette.surface);
  if (shape.forceLabel) text(shape.forceLabel, palette.piezo);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

/**
 * E15m-12 (R13B-06): rótulo «Sin grieta (z = 0)» cuando el motor informa la grieta con profundidad 0: sin línea, sin hueco de agua ni flecha, como el
 * lienzo del editor (`noCrackLabel`, mismo texto, posición y color de la superficie). E15m-15: con `face_height` > 0 el rótulo es el del corte de la masa
 * sin grieta de tracción (con la cara en la unidad del modelo).
 */
function drawNoCrack(ctx: CanvasRenderingContext2D, vp: Viewport, scene: Scene, palette: SectionPalette, units?: string | null): void {
  if (!scene.noCrack || !scene.surface) return;
  const label = noCrackLabel(scene.noCrack, scene.surface.slices, vp, units ?? scene.units);
  if (!label) return;
  ctx.font = AXIS_FONT;
  ctx.textBaseline = 'middle';
  ctx.textAlign = label.anchor === 'start' ? 'left' : 'right';
  ctx.setLineDash([]);
  ctx.lineWidth = HALO_TEXT_PX;
  ctx.strokeStyle = palette.halo;
  ctx.strokeText(label.text, label.x, label.y);
  ctx.fillStyle = palette.surface;
  ctx.fillText(label.text, label.x, label.y);
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

  // Agua embalsada (F5.3): relleno bajo la piezométrica y sobre el terreno, en su propia capa (sin trazo: lo limitan el terreno y la piezométrica).
  for (const poly of scene.pond ?? []) {
    tracePolygon(ctx, vp, poly);
    ctx.fillStyle = palette.pond;
    ctx.fill();
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

    // Superficie del informe: la polilínea ajustada (F3.7) o el arco inferior del círculo entre el pie y el coronamiento.
    const { circle, polyline, slices } = scene.surface;
    ctx.beginPath();
    if (polyline) {
      polyline.forEach(([x, y], i) => {
        const [sx, sy] = worldToScreen(vp, x, y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
    } else if (circle) {
      const xmin = Math.min(...slices.map((s) => s.x_left));
      const xmax = Math.max(...slices.map((s) => s.x_right));
      for (let i = 0; i <= 240; i++) {
        const x = xmin + ((xmax - xmin) * i) / 240;
        const d = circle.r * circle.r - (x - circle.xc) ** 2;
        if (d < 0) continue;
        const [sx, sy] = worldToScreen(vp, x, circle.yc - Math.sqrt(d));
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
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

  drawCrack(ctx, vp, scene, palette, units);
  drawNoCrack(ctx, vp, scene, palette, units);
  drawReinforcements(ctx, vp, scene, palette, units);

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
      // Sin halo continuo: un halo blanco de trazo lleno convertiría los puntos en una línea blanca con motas azules.
      ctx.lineCap = 'round';
      ctx.strokeStyle = palette.piezo;
      ctx.lineWidth = 2.5;
      ctx.setLineDash(PIEZO_EXTRAPOLATED_DASH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineCap = 'butt';
    }
  }
}
