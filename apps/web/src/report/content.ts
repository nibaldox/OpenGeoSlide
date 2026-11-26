// Contenido del informe (X3 §2.9): función pura de `ReportInput` a secciones. El PDF (`pdf.ts`) solo lo dibuja.
//
// Números con coma decimal (UI en español). El FS solo se muestra si el método convergió (R4-06). Los avisos usan
// el catálogo de `engine/warnings.ts` y la advertencia profesional es la aprobada en F1.4.

import { slideDirection } from '../editor/canvas/layout';
import { geotechAdvisories, piezoExtension } from '../editor/state/geotech';
import { isImperialUnits } from '../editor/state/units';
import type { ModelDoc } from '../editor/types';
import { minimalVersion } from '../io/ogsJson';
import { isPolylineReport, reportCircle } from '../engine/surface';
import type { Load, MethodKind, MethodReport, Point, Slice } from '../engine/types';
import { describeWarning, warningContext } from '../engine/warnings';
import { INTERSLICE_LABEL, analyzedPolyline, clipPolylineX, correctionFactorText, intersliceText, methodDetails, resultSurfaceSummary } from './methodInfo';
import { PDF_PALETTE, pdfMaterialColor, type Rgb } from './palette';
import type { ReportInput } from './types';

export type { Rgb };
export { clipPolylineX };

export interface DrawingRegion {
  polygon: Point[];
  materialId: string;
  color: Rgb;
}

export interface DrawingSurface {
  method: MethodKind;
  /** Base de las dovelas, o el arco del círculo si no hay dovelas. */
  points: Point[];
  /** Límites de las dovelas: de la base al terreno. */
  sliceLines: [Point, Point][];
  /** Solo en una superficie circular. */
  center?: Point;
  /** Solo en una superficie circular. */
  radius?: number;
}

/** Carga de superficie ya situada sobre el terreno (R9-05a). `ground` es el perfil del terreno bajo la carga distribuida. */
export type DrawingLoad =
  | { kind: 'udl'; x1: number; x2: number; ground: Point[]; label: string }
  | { kind: 'line'; x: number; yTop: number; angle: number; label: string };

/** Indicador sísmico (R9-05a): `dir` es el sentido del deslizamiento (+1 hacia +x), el de `kh` positivo. `kv > 0` va hacia abajo. */
export interface DrawingSeismic {
  kh: number;
  kv: number;
  dir: 1 | -1;
  label: string;
}

export interface LegendItem {
  kind: 'material' | 'piezo' | 'piezo_ext' | 'surface' | 'slices';
  label: string;
  color: Rgb;
}

export interface SectionDrawing {
  bounds: { xmin: number; xmax: number; ymin: number; ymax: number };
  regions: DrawingRegion[];
  piezo: Point[] | null;
  /** Tramos que el motor prolonga en horizontal hasta los bordes del modelo (R9-05d); vacío si la piezométrica los cubre. */
  piezoExtension: [Point, Point][];
  surface: DrawingSurface | null;
  loads: DrawingLoad[];
  seismic: DrawingSeismic | null;
  /** Unidad de longitud de las cotas: `m` o `ft`. */
  unit: string;
  legend: LegendItem[];
}

export type ReportBlock =
  | { kind: 'kv'; rows: [string, string][] }
  | { kind: 'table'; header: string[]; rows: string[][]; title?: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; title: string; items: string[] }
  | { kind: 'list'; items: { severity: 'nota' | 'aviso'; label: string; text: string }[] }
  | { kind: 'drawing'; drawing: SectionDrawing };

export type ReportSectionId = 'cover' | 'model' | 'materials' | 'section' | 'results' | 'checks' | 'warnings' | 'engine';

export interface ReportSection {
  id: ReportSectionId;
  title: string;
  blocks: ReportBlock[];
}

export interface ReportContent {
  title: string;
  sections: ReportSection[];
}

const METHOD_LABEL: Record<MethodKind, string> = {
  bishop: 'Bishop simplificado',
  spencer: 'Spencer',
  morgenstern_price: 'Morgenstern-Price',
  janbu_simplified: 'Janbu simplificado',
  janbu_corrected: 'Janbu corregido',
};
const STATUS_LABEL: Record<MethodReport['status'], string> = {
  converged: 'Convergió',
  not_converged: 'No convergió',
  invalid: 'No válida',
};
const DIRECTION_LABEL: Record<string, string> = {
  auto: 'Automático',
  left_to_right: 'De izquierda a derecha',
  right_to_left: 'De derecha a izquierda',
};
const DASH = '—';

/** Advertencia profesional aprobada (F1.4). `<versión>` se toma del `engine` del reporte. */
export function professionalDisclaimer(engineName: string): string {
  const version = engineName.startsWith('ogs-core ') ? engineName.slice('ogs-core '.length) : engineName;
  return `Resultado de un cálculo de equilibrio límite con OpenGeoSlide ${version}. No sustituye el juicio del profesional responsable. Revise los avisos antes de usar el resultado en un diseño.`;
}

/** Número con `digits` decimales y coma decimal. */
export function fmt(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  return n.toFixed(digits).replace('.', ',');
}

/** Coordenada con hasta 6 decimales (sin ceros sobrantes) y coma decimal: los puntos de una polilínea no se redondean a 6 cifras significativas. */
export function fmtCoord(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  return String(Number(n.toFixed(6))).replace('.', ',');
}

/** Número sin decimales fijos (hasta 6 cifras significativas) y coma decimal; para parámetros de entrada. */
export function fmtParam(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  return String(Number(n.toPrecision(6))).replace('.', ',');
}

function units(model: ModelDoc): { gamma: string; stress: string; line: string; length: string } {
  return isImperialUnits(model.units)
    ? { gamma: 'pcf', stress: 'psf', line: 'lbf/ft', length: 'ft' }
    : { gamma: 'kN/m³', stress: 'kPa', line: 'kN/m', length: 'm' };
}

/**
 * γw del informe (R9-03c). Sin piezométrica no hay agua que pese: «Sin agua (no aplica)», nunca el 9,81 por defecto del motor
 * (que en un modelo imperial sería «9,81 pcf»). Con piezométrica se imprime el valor; si falta, el motor usa 9,81 sin convertir
 * unidades, así que en imperial se dice «no indicado» en lugar de inventar un valor en pcf.
 */
export function waterUnitWeightText(model: ModelDoc, gammaUnit: string): string {
  const line = model.water?.piezometric_line;
  if (!Array.isArray(line) || line.length < 2) return 'Sin agua (no aplica)';
  const v = model.water?.unit_weight;
  if (typeof v === 'number') return `${fmtParam(v)} ${gammaUnit}`;
  return isImperialUnits(model.units) ? 'no indicado (el motor usaría 9,81 sin convertir unidades)' : `9,81 ${gammaUnit} (por defecto)`;
}

/**
 * Convenciones de signo del cálculo (R9-05b), tomadas del motor y no de la costumbre de otros programas:
 * - `crates/ogs-core/src/model.rs:133-135`: kh positivo actúa en el sentido del deslizamiento y kv positivo hacia abajo; ambos se
 *   aplican al peso del suelo W de cada dovela, nunca a las cargas.
 * - `crates/ogs-core/src/slicer.rs:59` y `:774-775`: `W* = W·(1 + kv) + Q + V` y `H = kh·W + H^P`.
 * - `crates/ogs-core/src/loads.rs:30`: el ángulo de la carga lineal se mide desde la vertical hacia abajo, positivo hacia +x;
 *   `slicer.rs:697-703`: `V = p·cos θ` (hacia abajo) y `H^P = s·p·sin θ` (en el sentido del deslizamiento `s`).
 */
export function conventionNotes(model: ModelDoc): string[] {
  const notes: string[] = ['Ejes: x aumenta hacia la derecha e y hacia arriba.'];
  const sk = model.analysis.seismic;
  if (sk) {
    notes.push(
      'Sismo pseudoestático: kh positivo actúa en el sentido del deslizamiento y kv positivo actúa hacia abajo (el peso del suelo pasa a W·(1 + kv)). ' +
        'Los dos coeficientes se aplican solo al peso del suelo, no a las sobrecargas. Con kv negativo la fuerza vertical va hacia arriba.',
    );
  }
  const loads = model.loads ?? [];
  if (loads.some((l) => l.type === 'udl')) notes.push('Carga distribuida q: positiva hacia abajo, sobre el terreno, entre x1 y x2.');
  if (loads.some((l) => l.type === 'line')) {
    notes.push('Carga lineal: el ángulo se mide desde la vertical hacia abajo y es positivo hacia +x (0° = vertical hacia abajo; 10° la inclina hacia +x).');
  }
  return notes;
}

function range(r: [number, number] | null | undefined, unit: string): string {
  return r ? `${fmtParam(r[0])} a ${fmtParam(r[1])} ${unit}` : 'todo el terreno';
}

// ---------------------------------------------------------------------------------------------------------------
// Dibujo de la sección
// ---------------------------------------------------------------------------------------------------------------

/** Mayor ordenada de las aristas de las regiones en la vertical `x` (superficie del terreno). */
export function terrainY(model: ModelDoc, x: number): number | null {
  let best: number | null = null;
  for (const region of model.regions) {
    const poly = region.polygon;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i] as Point;
      const b = poly[(i + 1) % poly.length] as Point;
      const lo = Math.min(a[0], b[0]);
      const hi = Math.max(a[0], b[0]);
      if (x < lo || x > hi || lo === hi) continue;
      const y = a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
      if (best === null || y > best) best = y;
    }
  }
  return best;
}

/**
 * Puntos de la base de las dovelas en orden de **x creciente** (E12i): `x_left` de cada dovela ordenada y, al final,
 * `x_right` de la última. El motor entrega las dovelas del pie al coronamiento, que en `left_to_right` es x decreciente;
 * sin ordenar se omitía el pie y la línea retrocedía.
 */
export function baseSurfacePoints(slices: readonly Slice[]): Point[] {
  const sorted = [...slices].sort((a, b) => a.x_left - b.x_left);
  const points = sorted.map((s) => [s.x_left, s.y_base_left] as Point);
  const last = sorted[sorted.length - 1];
  if (last) points.push([last.x_right, last.y_base_right]);
  return points;
}

function primaryResult(results: MethodReport[]): MethodReport | undefined {
  return results.find((r) => r.status === 'converged' && r.slices.length > 0) ?? results.find((r) => r.slices.length > 0) ?? results[0];
}

/** Puntos de la polilínea ajustada del informe (ya prolongada o recortada al terreno por el motor, F3.7); null si la superficie es un círculo. */
function reportPolyline(r: MethodReport): Point[] | null {
  return analyzedPolyline(r);
}

function circleArc(model: ModelDoc, r: MethodReport, bounds: SectionDrawing['bounds']): Point[] {
  const pts: Point[] = [];
  const c = reportCircle(r.surface);
  if (!c) return reportPolyline(r) ?? pts;
  const n = 180;
  for (let i = 0; i <= n; i++) {
    const t = Math.PI + (Math.PI * i) / n; // semicírculo inferior
    const x = c.xc + c.r * Math.cos(t);
    const y = c.yc + c.r * Math.sin(t);
    const top = terrainY(model, x);
    if (x >= bounds.xmin && x <= bounds.xmax && y >= bounds.ymin && top !== null && y <= top) pts.push([x, y]);
  }
  return pts;
}

/** Perfil del terreno entre `x1` y `x2`: los dos extremos y las abscisas de los vértices de las regiones que caen dentro. */
function groundBetween(model: ModelDoc, x1: number, x2: number): Point[] {
  const xs = new Set<number>([x1, x2]);
  for (const region of model.regions) for (const p of region.polygon) if (p[0] > x1 && p[0] < x2) xs.add(p[0]);
  const out: Point[] = [];
  for (const x of [...xs].sort((a, b) => a - b)) {
    const y = terrainY(model, x);
    if (y !== null) out.push([x, y]);
  }
  return out;
}

/** Rótulo `q = 20 kPa` o `p = 50 kN/m · 10°`, con coma decimal. */
export function loadLabel(load: Load, model: ModelDoc): string {
  const u = units(model);
  return load.type === 'udl' ? `q = ${fmtParam(load.q)} ${u.stress}` : `p = ${fmtParam(load.p)} ${u.line} · ${fmtParam(load.angle)}°`;
}

/** `kh = 0,1 (sentido del deslizamiento) · kv = 0,05 (hacia abajo)`: los signos se dicen con palabras, no solo con la flecha. */
export function seismicDrawingLabel(kh: number, kv: number): string {
  const h = kh === 0 ? 'kh = 0' : `kh = ${fmtParam(kh)} (sentido del deslizamiento)`;
  const v = kv === 0 ? 'kv = 0' : `kv = ${fmtParam(kv)} (${kv > 0 ? 'hacia abajo' : 'hacia arriba'})`;
  return `Sismo: ${h} · ${v}`;
}

function drawingLoads(model: ModelDoc): DrawingLoad[] {
  const out: DrawingLoad[] = [];
  for (const load of model.loads ?? []) {
    if (load.type === 'udl') {
      const ground = groundBetween(model, load.x1, load.x2);
      if (ground.length >= 2) out.push({ kind: 'udl', x1: load.x1, x2: load.x2, ground, label: loadLabel(load, model) });
    } else {
      const yTop = terrainY(model, load.x);
      if (yTop !== null) out.push({ kind: 'line', x: load.x, yTop, angle: load.angle, label: loadLabel(load, model) });
    }
  }
  return out;
}

/**
 * Rótulo de la superficie del dibujo (R10B-07). Solo un círculo **de búsqueda** convergido es «crítica»: un círculo o una
 * polilínea fijos son la superficie que el usuario pidió. Sin convergencia, `not_converged` (el método no cerró) e `invalid`
 * (la superficie no es admisible) se dicen distinto, porque la acción del usuario es distinta.
 */
export function surfaceLegendLabel(res: MethodReport | undefined, methodLabel: string): string {
  if (res === undefined || res.status === 'not_converged') return `Superficie evaluada, sin convergencia (${methodLabel})`;
  if (res.status === 'invalid') return `Superficie evaluada, no válida (${methodLabel})`;
  if (isPolylineReport(res.surface)) return `Superficie fija, polilínea (${methodLabel})`;
  return res.search == null ? `Superficie fija, círculo (${methodLabel})` : `Superficie crítica (${methodLabel})`;
}

export function buildSectionDrawing(model: ModelDoc, results: MethodReport[]): SectionDrawing {
  const regions: DrawingRegion[] = model.regions.map((region) => {
    const idx = Math.max(0, model.materials.findIndex((m) => m.id === region.material));
    return { polygon: region.polygon, materialId: region.material, color: pdfMaterialColor(idx) };
  });

  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const r of regions) {
    for (const [x, y] of r.polygon) {
      xmin = Math.min(xmin, x);
      xmax = Math.max(xmax, x);
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
  }
  if (!Number.isFinite(xmin)) {
    xmin = 0;
    xmax = 1;
    ymin = 0;
    ymax = 1;
  }
  const bounds = { xmin, xmax, ymin, ymax };

  const rawPiezo = model.water?.piezometric_line;
  const piezo = rawPiezo && rawPiezo.length >= 2 ? clipPolylineX(rawPiezo, xmin, xmax) : null;
  if (piezo) {
    for (const [, y] of piezo) {
      bounds.ymin = Math.min(bounds.ymin, y);
      bounds.ymax = Math.max(bounds.ymax, y);
    }
  }

  const ext = piezoExtension(model);
  const piezoExt: [Point, Point][] = [];
  if (ext?.left) piezoExt.push(ext.left);
  if (ext?.right) piezoExt.push(ext.right);
  for (const seg of piezoExt) for (const [, y] of seg) {
    bounds.ymin = Math.min(bounds.ymin, y);
    bounds.ymax = Math.max(bounds.ymax, y);
  }

  const loads = drawingLoads(model);
  const sk = model.analysis.seismic;
  const seismic: DrawingSeismic | null = sk
    ? {
        kh: sk.kh ?? 0,
        kv: sk.kv ?? 0,
        dir: slideDirection(model),
        label: seismicDrawingLabel(sk.kh ?? 0, sk.kv ?? 0),
      }
    : null;

  let surface: DrawingSurface | null = null;
  const res = primaryResult(results);
  if (res) {
    let points: Point[];
    const sliceLines: [Point, Point][] = [];
    const polyline = reportPolyline(res);
    if (res.slices.length > 0) {
      // Los límites de las dovelas salen de su base; la línea de la superficie, con una polilínea, es la del informe.
      const base = baseSurfacePoints(res.slices);
      points = polyline ?? base;
      for (const p of base) {
        const top = terrainY(model, p[0]);
        if (top !== null && top > p[1]) sliceLines.push([p, [p[0], top]]);
      }
    } else {
      points = polyline ?? circleArc(model, res, bounds);
    }
    for (const [, y] of points) bounds.ymin = Math.min(bounds.ymin, y);
    const circle = reportCircle(res.surface);
    surface = { method: res.method, points, sliceLines, ...(circle ? { center: [circle.xc, circle.yc] as Point, radius: circle.r } : {}) };
  }

  const legend: LegendItem[] = [];
  const seen = new Set<string>();
  for (const r of regions) {
    if (seen.has(r.materialId)) continue;
    seen.add(r.materialId);
    const name = model.materials.find((m) => m.id === r.materialId)?.name;
    legend.push({ kind: 'material', label: name && name !== r.materialId ? `${r.materialId} (${name})` : r.materialId, color: r.color });
  }
  if (piezo) legend.push({ kind: 'piezo', label: 'Línea piezométrica', color: [...PDF_PALETTE.piezo] });
  if (piezoExt.length > 0) legend.push({ kind: 'piezo_ext', label: 'Piezométrica (extrapolada)', color: [...PDF_PALETTE.piezo] });
  if (surface) {
    legend.push({ kind: 'surface', label: surfaceLegendLabel(res, METHOD_LABEL[surface.method]), color: [...PDF_PALETTE.surface] });
    if (surface.sliceLines.length > 0) legend.push({ kind: 'slices', label: 'Dovelas', color: [...PDF_PALETTE.slices] });
  }
  return { bounds, regions, piezo, piezoExtension: piezoExt, surface, loads, seismic, unit: units(model).length, legend };
}

// ---------------------------------------------------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------------------------------------------------

function modelSection(model: ModelDoc): ReportSection {
  const a = model.analysis;
  const u = units(model);
  const blocks: ReportBlock[] = [];
  if (model.meta.notes) blocks.push({ kind: 'paragraph', text: model.meta.notes });
  let polylinePoints: Point[] | null = null;

  const dflt = (v: unknown, text: string): string => (v === undefined || v === null ? `${text} (por defecto)` : text);
  const methods = a.methods ?? ['bishop'];
  const rows: [string, string][] = [
    ['Sentido del deslizamiento', DIRECTION_LABEL[model.slope?.direction ?? 'auto'] ?? String(model.slope?.direction)],
    ['Métodos', dflt(a.methods, methods.map((m) => METHOD_LABEL[m]).join(', '))],
    ...(methods.includes('morgenstern_price')
      ? [['Función entre dovelas (Morgenstern-Price)', intersliceText(a.interslice) ?? `${INTERSLICE_LABEL.half_sine} (por defecto)`] as [string, string]]
      : []),
    ['Dovelas', dflt(a.slices, fmtParam(a.slices ?? 50))],
    ['Tolerancia (relativa en FS)', dflt(a.tolerance, fmtParam(a.tolerance ?? 1e-5))],
    ['Iteraciones máximas', dflt(a.max_iterations, fmtParam(a.max_iterations ?? 500))],
    ['m_α mínimo', dflt(a.min_m_alpha, fmtParam(a.min_m_alpha ?? 0.2))],
    ['Peso unitario del agua', waterUnitWeightText(model, u.gamma)],
    [
      'Línea piezométrica',
      model.water?.piezometric_line && model.water.piezometric_line.length > 0 ? `${model.water.piezometric_line.length} puntos` : 'Sin piezométrica',
    ],
  ];

  if (a.search) {
    const s = a.search;
    rows.push(
      ['Superficies', 'Búsqueda circular por entrada y salida'],
      ['Rango de entrada (coronamiento)', range(s.entry, u.length)],
      ['Rango de salida (pie)', range(s.exit, u.length)],
      ['Divisiones entrada / salida / radio', `${fmtParam(s.n_entry ?? 20)} / ${fmtParam(s.n_exit ?? 20)} / ${fmtParam(s.n_radius ?? 20)}`],
      ['Factor máximo del radio', fmtParam(s.max_radius_factor ?? 5)],
      ['Ancho mínimo', s.min_width === undefined || s.min_width === null ? 'por defecto (1 % del ancho del modelo)' : `${fmtParam(s.min_width)} ${u.length}`],
      ['Refinamiento', (s.refine ?? true) ? 'Sí' : 'No'],
    );
  } else if (a.surface && a.surface.type === 'polyline') {
    rows.push(['Superficies', 'Polilínea fija'], ['Puntos de la polilínea', String(a.surface.points.length)]);
    polylinePoints = a.surface.points;
  } else if (a.surface) {
    rows.push(
      ['Superficies', 'Círculo fijo'],
      ['Centro (xc, yc)', `(${fmtParam(a.surface.xc)}; ${fmtParam(a.surface.yc)}) ${u.length}`],
      ['Radio', `${fmtParam(a.surface.r)} ${u.length}`],
    );
  } else {
    rows.push(['Superficies', 'No definidas']);
  }
  if (a.seismic) {
    rows.push(['Sismo pseudoestático', `kh = ${fmtParam(a.seismic.kh ?? 0)} · kv = ${fmtParam(a.seismic.kv ?? 0)}`]);
  }
  blocks.push({ kind: 'kv', rows });
  if (polylinePoints) {
    blocks.push({
      kind: 'paragraph',
      text: 'La polilínea se prolonga o se recorta hasta el terreno al calcular: la superficie ajustada que se dibuja y se exporta es la que devuelve el motor. Bishop no se ofrece con una polilínea.',
    });
    blocks.push({
      kind: 'table',
      title: 'Polilínea fija de falla (puntos del modelo)',
      header: ['N.º', `x (${u.length})`, `y (${u.length})`],
      rows: polylinePoints.map((p, i) => [String(i + 1), fmtCoord(p[0]), fmtCoord(p[1])]),
    });
  }
  blocks.push({ kind: 'bullets', title: 'Convenciones de signo', items: conventionNotes(model) });

  const loads = model.loads ?? [];
  if (loads.length > 0) {
    blocks.push({
      kind: 'table',
      title: 'Cargas',
      header: ['Id', 'Tipo', 'Posición', `Magnitud`, 'Ángulo (°)'],
      rows: loads.map((l, i) =>
        l.type === 'udl'
          ? [l.id ?? String(i + 1), 'Distribuida', `${fmtParam(l.x1)} a ${fmtParam(l.x2)} ${u.length}`, `${fmtParam(l.q)} ${u.stress}`, DASH]
          : [l.id ?? String(i + 1), 'Lineal', `${fmtParam(l.x)} ${u.length}`, `${fmtParam(l.p)} ${u.line}`, fmtParam(l.angle)],
      ),
    });
  }
  return { id: 'model', title: 'Datos del modelo', blocks };
}

function materialsSection(model: ModelDoc): ReportSection {
  const u = units(model);
  // Un material no drenado no tiene c ni φ: su resistencia (Su, constante o lineal con la cota) va en su propia tabla.
  const undrained = model.materials.filter((m) => m.model === 'undrained');
  const undrainedBlocks: ReportBlock[] =
    undrained.length === 0
      ? []
      : [
          {
            kind: 'table',
            title: 'Materiales no drenados (Su)',
            header: ['Id', `Su (${u.stress})`, `Cota de referencia (${u.length})`, `Gradiente (${u.stress}/${u.length})`, `Límite (${u.stress})`],
            rows: undrained.map((m) => [m.id, fmtParam(m.undrained_strength), fmtParam(m.strength_datum), fmtParam(m.strength_gradient), fmtParam(m.strength_limit)]),
          },
        ];
  return {
    id: 'materials',
    title: 'Materiales',
    blocks: [
      {
        kind: 'table',
        header: ['Id', 'Nombre', 'Modelo', `γ (${u.gamma})`, `γsat (${u.gamma})`, `c (${u.stress})`, 'φ (°)', 'ru'],
        rows: model.materials.map((m) => [
          m.id,
          m.name,
          m.model === 'undrained' ? 'No drenado (Su)' : 'Mohr-Coulomb',
          fmtParam(m.unit_weight),
          fmtParam(m.unit_weight_sat),
          fmtParam(m.cohesion),
          fmtParam(m.friction_angle),
          fmtParam(m.ru),
        ]),
      },
      ...undrainedBlocks,
    ],
  };
}

/** Filas de «Parámetros por método»: la función de Morgenstern-Price y, en Janbu corregido, f₀ y F₀ = FS / f₀ (F3.5, F3.7). */
function methodParameterRows(results: MethodReport[]): string[][] {
  const rows: string[][] = [];
  for (const r of results) {
    const d = methodDetails(r);
    if (d.interslice !== undefined) {
      rows.push([METHOD_LABEL[r.method], 'Función de fuerzas entre dovelas', d.interslice]);
      const pts = r.interslice?.function === 'data_points' ? r.interslice.points : undefined;
      if (pts && pts.length > 0) rows.push([METHOD_LABEL[r.method], 'Puntos (ξ; f)', pts.map((p) => `(${fmtParam(p[0])}; ${fmtParam(p[1])})`).join(' ')]);
    }
    if (d.f0 !== undefined) {
      rows.push([METHOD_LABEL[r.method], 'Factor de corrección f₀', correctionFactorText(d.f0)]);
      if (d.F0 !== undefined) rows.push([METHOD_LABEL[r.method], 'F₀ (Janbu simplificado) = FS / f₀', fmt(d.F0, 3)]);
    }
  }
  return rows;
}

/** Las dos polilíneas son la misma salvo ruido de coma flotante (1e-9 de la mayor coordenada). */
function samePolyline(a: readonly Point[], b: readonly Point[]): boolean {
  if (a.length !== b.length) return false;
  const scale = Math.max(1, ...a.flat().map(Math.abs), ...b.flat().map(Math.abs));
  return a.every((p, i) => Math.abs(p[0] - (b[i] as Point)[0]) <= 1e-9 * scale && Math.abs(p[1] - (b[i] as Point)[1]) <= 1e-9 * scale);
}

/**
 * Tabla de la polilínea **ajustada** que analizó el motor, cuando difiere de la de entrada (R10B-07): sin ella, «Polilínea
 * (5 puntos)» no se puede auditar con los 3 puntos de «Datos del modelo». Es la polilínea del informe, ya prolongada o
 * recortada al terreno y limitada al rango de las dovelas. Los métodos que comparten la misma comparten tabla.
 */
function fittedPolylineTables(results: MethodReport[], model: ModelDoc): ReportBlock[] {
  const u = units(model);
  const input = model.analysis.surface?.type === 'polyline' ? model.analysis.surface.points : null;
  const groups: { points: Point[]; methods: MethodKind[] }[] = [];
  for (const r of results) {
    const pts = analyzedPolyline(r);
    if (!pts || (input && samePolyline(pts, input))) continue;
    const g = groups.find((x) => samePolyline(x.points, pts));
    if (g) g.methods.push(r.method);
    else groups.push({ points: pts, methods: [r.method] });
  }
  return groups.map((g) => ({
    kind: 'table',
    title: groups.length === 1 ? 'Polilínea ajustada al terreno (superficie analizada)' : `Polilínea ajustada al terreno (${g.methods.map((m) => METHOD_LABEL[m]).join(', ')})`,
    header: ['N.º', `x (${u.length})`, `y (${u.length})`],
    rows: g.points.map((p, i) => [String(i + 1), fmtCoord(p[0]), fmtCoord(p[1])]),
  }));
}

function resultsSection(results: MethodReport[], model: ModelDoc): ReportSection {
  const u = units(model);
  const summaries = results.map((r) => resultSurfaceSummary(r));
  // Con polilínea no hay centro ni radio: si todos los métodos la usan, una sola columna; en un informe mixto, el resumen va en la celda del centro.
  const allPolyline = results.length > 0 && summaries.every((x) => x !== null);
  const surfaceHeader = allPolyline ? ['Superficie fija'] : [`Centro (xc; yc) (${u.length})`, `Radio (${u.length})`];
  const surfaceCells = (r: MethodReport, i: number): string[] => {
    const c = reportCircle(r.surface);
    if (allPolyline) return [summaries[i] as string];
    return c ? [`${fmt(c.xc, 2)}; ${fmt(c.yc, 2)}`, fmt(c.r, 2)] : [summaries[i] ?? DASH, DASH];
  };
  const blocks: ReportBlock[] = [
    {
      kind: 'table',
      header: ['Método', 'Estado', 'FS', 'Iter.', 'λ', 'Evaluadas', 'Válidas', ...surfaceHeader],
      rows: results.map((r, i) => [
        METHOD_LABEL[r.method],
        STATUS_LABEL[r.status],
        r.status === 'converged' ? fmt(r.fos, 3) : DASH,
        String(r.iterations),
        (r.method === 'spencer' || r.method === 'morgenstern_price') && r.status === 'converged' ? fmt(r.lambda, 4) : DASH,
        r.search ? String(r.search.evaluated) : DASH,
        r.search ? String(r.search.valid) : DASH,
        ...surfaceCells(r, i),
      ]),
    },
  ];
  const fitted = fittedPolylineTables(results, model);
  blocks.push(...fitted);
  const params = methodParameterRows(results);
  if (params.length > 0) blocks.push({ kind: 'table', title: 'Parámetros por método', header: ['Método', 'Parámetro', 'Valor'], rows: params });
  return { id: 'results', title: 'Factor de seguridad por método', blocks };
}

function checksSection(input: ReportInput): ReportSection | null {
  if (input.checks.length === 0) return null;
  return {
    id: 'checks',
    title: 'Comprobaciones frente a valores publicados',
    blocks: [
      {
        kind: 'table',
        header: ['Método', 'Publicado', 'FS', 'Error relativo (%)', 'Resultado'],
        rows: input.checks.map((c) => [
          METHOD_LABEL[c.method],
          fmt(c.published, 3),
          c.fos === null ? DASH : fmt(c.fos, 3),
          c.fos === null || c.published === 0 ? DASH : fmt((Math.abs(c.fos - c.published) / Math.abs(c.published)) * 100, 2),
          c.fos === null ? 'Sin FS' : c.ok ? 'Cumple' : 'No cumple',
        ]),
      },
    ],
  };
}

function warningsSection(input: ReportInput): ReportSection {
  const items: { severity: 'nota' | 'aviso'; label: string; text: string; key: string }[] = [];
  const seen = new Set<string>();
  const push = (method: MethodKind, severity: 'nota' | 'aviso', code: string, text: string): void => {
    const key = `${method}:${code}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ severity, label: METHOD_LABEL[method], text, key });
  };
  for (const w of input.warnings) push(w.method, w.severity, w.code, w.text);
  // R9-05c/d, R9-12a: avisos geotécnicos del modelo (los mismos de Diagnósticos), antes de los del motor.
  for (const a of geotechAdvisories(input.model)) {
    if (seen.has(a.code)) continue;
    seen.add(a.code);
    items.push({ severity: 'aviso', label: 'Modelo', text: a.text, key: a.code });
  }
  for (const r of input.results) {
    const ctx = warningContext(r);
    for (const code of r.warnings) {
      const info = describeWarning(code, ctx);
      push(r.method, info.severity, info.code, info.text);
    }
  }
  const blocks: ReportBlock[] =
    items.length === 0
      ? [{ kind: 'paragraph', text: 'Sin avisos ni notas.' }]
      : [{ kind: 'list', items: items.map(({ severity, label, text }) => ({ severity, label, text })) }];
  return { id: 'warnings', title: 'Avisos y notas', blocks };
}

/** Secciones del informe, en el orden de X3 §2.9. Sin comprobaciones publicadas, la sección 6 se omite. */
export function buildReportContent(input: ReportInput): ReportContent {
  const { model } = input;
  const title = model.meta.title || model.meta.id || 'Sin título';

  const cover: ReportSection = {
    id: 'cover',
    title: 'Informe de análisis de estabilidad de taludes',
    blocks: [
      {
        kind: 'kv',
        rows: [
          ['Título', title],
          ['Identificador', model.meta.id || DASH],
          ['Fecha', input.generatedAt],
          ['Motor', input.engineName],
          ['SHA-256 del .ogs.json', input.modelSha256],
          ['Unidades', model.units ?? 'no indicadas'],
          // La del texto guardado, del que sale el SHA-256 (no la que el modelo trae en memoria: un modelo abierto como 0.2 y editado con polilínea se guarda como 0.3).
          ['Versión del formato', minimalVersion(model)],
        ],
      },
    ],
  };

  const drawing = buildSectionDrawing(model, input.results);
  const sections: ReportSection[] = [
    cover,
    modelSection(model),
    materialsSection(model),
    { id: 'section', title: 'Sección analizada', blocks: [{ kind: 'drawing', drawing }] },
    resultsSection(input.results, model),
  ];
  const checks = checksSection(input);
  if (checks) sections.push(checks);
  sections.push(warningsSection(input));
  sections.push({
    id: 'engine',
    title: 'Versión del motor y advertencia',
    blocks: [
      { kind: 'kv', rows: [['Motor', input.engineName]] },
      { kind: 'paragraph', text: input.disclaimer.trim() === '' ? professionalDisclaimer(input.engineName) : input.disclaimer },
    ],
  });
  return { title, sections };
}
