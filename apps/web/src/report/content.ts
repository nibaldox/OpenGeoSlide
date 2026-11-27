// Contenido del informe (X3 §2.9): función pura de `ReportInput` a secciones. El PDF (`pdf.ts`) solo lo dibuja.
//
// Números con coma decimal (UI en español). El FS solo se muestra si el método convergió (R4-06). Los avisos usan
// el catálogo de `engine/warnings.ts` y la advertencia profesional es la aprobada en F1.4.

import { slideDirection } from '../editor/canvas/layout';
import { geotechAdvisories, piezoExtension } from '../editor/state/geotech';
import { UNIT_FACTORS, WATER_UNIT_WEIGHT_SI, isImperialUnits } from '../editor/state/units';
import type { ModelDoc } from '../editor/types';
import { minimalVersion } from '../io/ogsJson';
import { isPolylineReport, reportCircle } from '../engine/surface';
import type { CrackReport, Load, MaterialModel, MethodKind, MethodReport, Point, Reinforcement, ReinforcementForce, ShansepSpec, Slice } from '../engine/types';
import { describeWarning, warningContext } from '../engine/warnings';
import { INTERSLICE_LABEL, analyzedPolyline, clipPolylineX, correctionFactorText, intersliceText, methodDetails, resultSurfaceSummary } from './methodInfo';
import { crackGeometry, type CrackGeometry } from '../render/crack';
import { pondPolygons } from '../render/pond';
import { MATERIAL_MODEL_LABEL } from '../render/scene';
import { CRACK_CONVENTIONS, POND_CONVENTIONS, crackInputRows, crackRecords, crackTable, pondSummary } from './crackReport';
import { deriveHoekBrownFromMaterial } from './hoekBrown';
import { PDF_PALETTE, pdfMaterialColor, type Rgb } from './palette';
import {
  PASSIVE_LEGEND,
  REINFORCEMENT_FORCE_BASIS,
  ITO_MATSUI_NOTE,
  isItoMatsuiPile,
  structuralLimitText,
  FORCE_TABLE_NOTE,
  forceRecords,
  forcesTable,
  hasStructuralElements,
  isMockResult,
  reinforcementInputTables,
  reinforcementsOf,
  uncrossedByMethod,
} from './reinforcementReport';
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
  kind: 'material' | 'piezo' | 'piezo_ext' | 'pond' | 'crack' | 'surface' | 'slices' | 'reinforcement' | 'force' | 'force_off';
  label: string;
  color: Rgb;
}

export interface SectionDrawing {
  bounds: { xmin: number; xmax: number; ymin: number; ymax: number };
  regions: DrawingRegion[];
  piezo: Point[] | null;
  /** Tramos que el motor prolonga en horizontal hasta los bordes del modelo (R9-05d); vacío si la piezométrica los cubre. */
  piezoExtension: [Point, Point][];
  /** Agua embalsada (F5.3): polígonos entre la piezométrica y el terreno donde pasa sobre él; vacío sin agua sobre el terreno. */
  pond: Point[][];
  /** Grieta de tracción de la superficie del resultado principal (F5.4); `null` sin grieta. */
  crack: CrackGeometry | null;
  /**
   * E15n-4: la grieta que el motor informa con `depth` 0 (sin grieta, o corte de la masa si trae `face_height`) y las dovelas con que se ubica su rótulo;
   * la figura dibuja el mismo rótulo que el lienzo y Casos (`noCrackLabel`). `null` si hay grieta con profundidad o no hay informe de grieta.
   */
  noCrack: { crack: CrackReport; slices: readonly Slice[] } | null;
  surface: DrawingSurface | null;
  loads: DrawingLoad[];
  seismic: DrawingSeismic | null;
  /** Refuerzos del modelo (v0.4): el PDF dibuja el símbolo de cada tipo; vacío sin refuerzos. */
  reinforcements: Reinforcement[];
  /** Fuerzas del resultado principal en la superficie final (`reinforcement_forces`); vacío si no hay. */
  forces: ReinforcementForce[];
  /** `doc.units` del modelo: el dibujo de los refuerzos usa la unidad de las fuerzas. */
  units: string | undefined;
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

export type ReportSectionId = 'cover' | 'model' | 'materials' | 'section' | 'results' | 'crack' | 'reinforcements' | 'checks' | 'warnings' | 'engine';

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
 * γw del informe (R9-03c, E15l-14). Se muestra cuando el modelo usa el agua: con piezométrica (que incluye el agua embalsada sobre el
 * terreno) o con agua en la grieta (`tension_crack.water_fill > 0`). Sin ningún uso del agua, «Sin agua (no aplica)», nunca el 9,81 por
 * defecto del motor. Sin γw explícito, el valor por defecto es 9,81 kN/m³ en SI y su conversión (62,45 pcf) en imperial (E15l-6).
 */
export function waterUnitWeightText(model: ModelDoc, gammaUnit: string): string {
  const line = model.water?.piezometric_line;
  const hasPiezo = Array.isArray(line) && line.length >= 2;
  const crackFill = model.analysis.tension_crack?.water_fill;
  const crackWater = typeof crackFill === 'number' && crackFill > 0;
  if (!hasPiezo && !crackWater) return 'Sin agua (no aplica)';
  const v = model.water?.unit_weight;
  if (typeof v === 'number') return `${fmtParam(v)} ${gammaUnit}`;
  const byDefault = isImperialUnits(model.units) ? Number((WATER_UNIT_WEIGHT_SI * UNIT_FACTORS.unitWeight).toFixed(2)) : WATER_UNIT_WEIGHT_SI;
  return `${fmtParam(byDefault)} ${gammaUnit} (por defecto)`;
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
  if (isPolylineReport(res.surface)) {
    return res.search == null ? `Superficie fija, polilínea (${methodLabel})` : `Superficie crítica, polilínea (${methodLabel})`;
  }
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

  const reinforcements = [...reinforcementsOf(model)];
  for (const r of reinforcements) {
    for (const [x, y] of [[r.x1, r.y1], [r.x2, r.y2]] as Point[]) {
      bounds.xmin = Math.min(bounds.xmin, x);
      bounds.xmax = Math.max(bounds.xmax, x);
      bounds.ymin = Math.min(bounds.ymin, y);
      bounds.ymax = Math.max(bounds.ymax, y);
    }
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
  const hasF3bMaterials = model.materials.some((m) => m.model === 'hoek_brown' || m.model === 'shansep');
  for (const r of regions) {
    if (seen.has(r.materialId)) continue;
    seen.add(r.materialId);
    const mat = model.materials.find((m) => m.id === r.materialId);
    const name = mat?.name;
    const baseLabel = name && name !== r.materialId ? `${r.materialId} (${name})` : r.materialId;
    const modelSuffix = hasF3bMaterials ? ` · ${MATERIAL_MODEL_LABEL[(mat?.model ?? 'mohr_coulomb') as MaterialModel]}` : '';
    legend.push({ kind: 'material', label: `${baseLabel}${modelSuffix}`, color: r.color });
  }
  if (piezo) legend.push({ kind: 'piezo', label: 'Línea piezométrica', color: [...PDF_PALETTE.piezo] });
  if (piezoExt.length > 0) legend.push({ kind: 'piezo_ext', label: 'Piezométrica (extrapolada)', color: [...PDF_PALETTE.piezo] });
  const pond = pondPolygons(model.regions, model.water?.piezometric_line);
  if (pond.length > 0) legend.push({ kind: 'pond', label: 'Agua embalsada (piezométrica sobre el terreno)', color: [...PDF_PALETTE.pond] });
  const crack = res && res.slices.length > 0 ? crackGeometry(res.tension_crack, res.slices, model.analysis.tension_crack?.water_fill) : null;
  const noCrack = res && res.slices.length > 0 && res.tension_crack && !crack && Number.isFinite(res.tension_crack.x) && res.tension_crack.depth <= 0 ? { crack: res.tension_crack, slices: res.slices } : null;
  if (crack) legend.push({ kind: 'crack', label: 'Grieta de tracción (línea discontinua; flecha: Pw del agua en la grieta)', color: [...PDF_PALETTE.surface] });
  if (surface) {
    legend.push({ kind: 'surface', label: surfaceLegendLabel(res, METHOD_LABEL[surface.method]), color: [...PDF_PALETTE.surface] });
    if (surface.sliceLines.length > 0) legend.push({ kind: 'slices', label: 'Dovelas', color: [...PDF_PALETTE.slices] });
  }
  const forces = reinforcements.length > 0 ? [...(res?.reinforcement_forces ?? [])] : [];
  if (reinforcements.length > 0) {
    legend.push({ kind: 'reinforcement', label: 'Refuerzos (un símbolo por tipo: anclaje, clavo, geosintético, pilote, tablestaca)', color: [...PDF_PALETTE.reinforcement] });
    if (forces.some((f) => f.status === 'applied')) legend.push({ kind: 'force', label: `Fuerza del refuerzo sobre la masa (flecha, ${units(model).line}; la pasiva ${PASSIVE_LEGEND})`, color: [...PDF_PALETTE.reinforcement] });
    if (forces.some((f) => f.status !== 'applied')) legend.push({ kind: 'force_off', label: 'Cruce sin fuerza aplicada (gris): fuera de la masa, compresión o sin capacidad', color: [...PDF_PALETTE.inkMuted] });
  }
  return { bounds, regions, piezo, piezoExtension: piezoExt, pond, crack, noCrack, surface, loads, seismic, reinforcements, forces, units: model.units, unit: units(model).length, legend };
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
    if (s.non_circular) {
      const nc = s.non_circular;
      rows.push(
        ['Búsqueda no circular', 'Sí (variación alterna)'],
        ['Semillas no circulares', dflt(nc.seeds, fmtParam(nc.seeds ?? 3))],
        ['Vértices máximos (polilínea)', dflt(nc.max_vertices, fmtParam(nc.max_vertices ?? 33))],
      );
    }
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
  rows.push(...crackInputRows(model));
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

/**
 * Nota fija de todo informe con materiales Hoek-Brown (F6.8, X25 §1.5):
 * declara la regla de la envolvente completa bajo confinamiento bajo y la advertencia de Hoek (1994) sobre la cohesión tangente.
 */
export const HOEK_BROWN_REPORT_NOTE =
  'Criterio de Hoek-Brown generalizado (Hoek, Carranza-Torres y Corkum, 2002): en cada dovela se evalúa la tangente instantánea (cᵢ, φᵢ) a la envolvente curvilínea en el esfuerzo normal efectivo σ′n de la base. ' +
  'Bajo confinamiento bajo o tracción (σ′n ≤ sn(0), donde sn(0) corresponde a σ′3 = 0), se aplica la regla de la envolvente completa hasta la resistencia a tracción σt = −s·σci/mb, y para σ′n ≤ σt la base no resiste (c = 0, tan φ = 0); no se extrapola la recta tangente de σ′3 = 0, diferencia conservadora de 0 % a −2,9 % frente a cSlope en los modelos de prueba. ' +
  'Advertencia de Hoek (1994, ISRM News Journal, citado en Hoek et al., 2002): la cohesión determinada ajustando una tangente a la envolvente curvilínea de Mohr es un valor de cota superior y puede dar resultados optimistas en cálculos de estabilidad.';

function shansepOcrCells(spec: ShansepSpec | null | undefined, stressUnit: string, lengthUnit: string): [string, string] {
  if (!spec) return [DASH, DASH];
  if (spec.ocr !== undefined && spec.ocr !== null) return ['OCR constante', `OCR = ${fmtParam(spec.ocr)}`];
  if (spec.pop !== undefined && spec.pop !== null) return ['POP (sobreconsolidación)', `POP = ${fmtParam(spec.pop)} ${stressUnit}`];
  if (Array.isArray(spec.ocr_by_elevation) && spec.ocr_by_elevation.length > 0) {
    const pts = spec.ocr_by_elevation.map(([y, ocr]) => `(${fmtParam(y)} ${lengthUnit}; OCR ${fmtParam(ocr)})`).join(' ');
    return ['OCR por cota', pts];
  }
  return [DASH, DASH];
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
  const hoekBrown = model.materials.filter((m) => m.model === 'hoek_brown');
  const hoekBrownBlocks: ReportBlock[] =
    hoekBrown.length === 0
      ? []
      : [
          {
            kind: 'table',
            title: 'Materiales Hoek-Brown generalizado',
            header: ['Id', `σci (${u.stress})`, 'GSI', 'mi', 'D', 'mb', 's', 'a'],
            rows: hoekBrown.map((m) => {
              const d = deriveHoekBrownFromMaterial(m);
              return [m.id, fmtParam(m.ucs), fmtParam(m.gsi), fmtParam(m.mi), fmtParam(m.disturbance), fmtParam(d?.mb), fmtParam(d?.s), fmtParam(d?.a)];
            }),
          },
          { kind: 'paragraph', text: HOEK_BROWN_REPORT_NOTE },
        ];
  const shansep = model.materials.filter((m) => m.model === 'shansep');
  const shansepBlocks: ReportBlock[] =
    shansep.length === 0
      ? []
      : [
          {
            kind: 'table',
            title: 'Materiales SHANSEP',
            header: ['Id', 'Cociente S', 'Exponente m', 'Fuente OCR', 'Historia de esfuerzos'],
            rows: shansep.map((m) => {
              const s = m.shansep;
              const expText = !s ? DASH : s.exponent === undefined || s.exponent === null ? `${fmtParam(0.8)} (por defecto)` : fmtParam(s.exponent);
              const [source, detail] = shansepOcrCells(s, u.stress, u.length);
              return [m.id, fmtParam(s?.ratio), expText, source, detail];
            }),
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
          MATERIAL_MODEL_LABEL[(m.model ?? 'mohr_coulomb') as MaterialModel] ?? 'Mohr-Coulomb',
          fmtParam(m.unit_weight),
          fmtParam(m.unit_weight_sat),
          fmtParam(m.cohesion),
          fmtParam(m.friction_angle),
          fmtParam(m.ru),
        ]),
      },
      ...undrainedBlocks,
      ...hoekBrownBlocks,
      ...shansepBlocks,
    ],
  };
}

/** Filas de «Parámetros por método»: la función de Morgenstern-Price, f₀ y F₀ de Janbu corregido, y las pasadas de Hoek-Brown (F3.5, F3.7, F6.6). */
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
    if (typeof r.strength?.passes === 'number') {
      rows.push([METHOD_LABEL[r.method], 'Pasadas del lazo de Hoek-Brown', String(r.strength.passes)]);
    }
  }
  return rows;
}

/** Tabla de estadísticas de la búsqueda no circular por método (F6.6, F6.10 punto 8). */
function nonCircularStatsTable(results: MethodReport[]): ReportBlock | null {
  const ncResults = results.filter((r) => r.search?.non_circular !== undefined);
  if (ncResults.length === 0) return null;
  return {
    kind: 'table',
    title: 'Búsqueda no circular (refinamiento de semillas)',
    header: ['Método', 'Semillas', 'Eval. no circ.', 'FS círculo (semilla)', 'FS polilínea', 'Superficie ganadora'],
    rows: ncResults.map((r) => {
      const nc = r.search!.non_circular!;
      const polyText = nc.polyline_fos !== undefined ? fmt(nc.polyline_fos, 3) : 'Sin polilínea admisible';
      const winner = r.status !== 'converged' ? DASH : isPolylineReport(r.surface) ? 'Polilínea' : 'Círculo';
      return [METHOD_LABEL[r.method], String(nc.seeds), String(nc.evaluated), fmt(nc.seed_fos, 3), polyText, winner];
    }),
  };
}

/** Las dos polilíneas son la misma salvo ruido de coma flotante (1e-9 de la mayor coordenada). */
function samePolyline(a: readonly Point[], b: readonly Point[]): boolean {
  if (a.length !== b.length) return false;
  const scale = Math.max(1, ...a.flat().map(Math.abs), ...b.flat().map(Math.abs));
  return a.every((p, i) => Math.abs(p[0] - (b[i] as Point)[0]) <= 1e-9 * scale && Math.abs(p[1] - (b[i] as Point)[1]) <= 1e-9 * scale);
}

/**
 * Tabla de la polilínea **ajustada** (superficie fija, R10B-07) o de los **vértices de la polilínea crítica** (búsqueda no circular, F6.10).
 * Los métodos que comparten la misma polilínea comparten tabla.
 */
function fittedPolylineTables(results: MethodReport[], model: ModelDoc): ReportBlock[] {
  const u = units(model);
  const input = model.analysis.surface?.type === 'polyline' ? model.analysis.surface.points : null;
  const groups: { points: Point[]; methods: MethodKind[]; fromSearch: boolean }[] = [];
  for (const r of results) {
    const fromSearch = r.search != null;
    if (fromSearch && r.status !== 'converged') continue;
    const pts = analyzedPolyline(r);
    if (!pts || (!fromSearch && input && samePolyline(pts, input))) continue;
    const g = groups.find((x) => x.fromSearch === fromSearch && samePolyline(x.points, pts));
    if (g) g.methods.push(r.method);
    else groups.push({ points: pts, methods: [r.method], fromSearch });
  }
  return groups.map((g) => {
    const methodsText = g.methods.map((m) => METHOD_LABEL[m]).join(', ');
    const title = g.fromSearch
      ? groups.filter((x) => x.fromSearch).length === 1
        ? 'Vértices de la polilínea crítica (búsqueda no circular)'
        : `Vértices de la polilínea crítica (${methodsText})`
      : groups.filter((x) => !x.fromSearch).length === 1
        ? 'Polilínea ajustada al terreno (superficie analizada)'
        : `Polilínea ajustada al terreno (${methodsText})`;
    return {
      kind: 'table',
      title,
      header: ['N.º', `x (${u.length})`, `y (${u.length})`],
      rows: g.points.map((p, i) => [String(i + 1), fmtCoord(p[0]), fmtCoord(p[1])]),
    };
  });
}

function resultsSection(results: MethodReport[], model: ModelDoc): ReportSection {
  const u = units(model);
  const summaries = results.map((r) => resultSurfaceSummary(r));
  // Con polilínea no hay centro ni radio: si todos los métodos la usan, una sola columna; en un informe mixto, el resumen va en la celda del centro.
  const allPolyline = results.length > 0 && summaries.every((x) => x !== null);
  const anySearch = results.some((r) => r.search != null);
  const surfaceHeader = allPolyline ? [anySearch ? 'Superficie crítica' : 'Superficie fija'] : [`Centro (xc; yc) (${u.length})`, `Radio (${u.length})`];
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
  const ncTable = nonCircularStatsTable(results);
  if (ncTable) blocks.push(ncTable);
  const fitted = fittedPolylineTables(results, model);
  blocks.push(...fitted);
  const params = methodParameterRows(results);
  if (params.length > 0) blocks.push({ kind: 'table', title: 'Parámetros por método', header: ['Método', 'Parámetro', 'Valor'], rows: params });
  return { id: 'results', title: 'Factor de seguridad por método', blocks };
}

/**
 * Sección «Grieta de tracción y agua embalsada» (F5.3, F5.4, F5.7): la nota del agua embalsada (con su calado máximo), los datos de la grieta
 * de entrada, la tabla de `x_c`, profundidad y `Pw` por método y las convenciones. Sin grieta en el modelo ni agua sobre el terreno no existe.
 */
function crackSection(input: ReportInput): ReportSection | null {
  const { model, results } = input;
  const crack = model.analysis.tension_crack;
  const pond = pondSummary(model);
  if (!crack && !pond) return null;
  const blocks: ReportBlock[] = [];
  if (pond) blocks.push({ kind: 'paragraph', text: pond.text });
  if (crack) {
    const records = crackRecords(results);
    if (records.length > 0) {
      const t = crackTable(records, model.units, crack.water_fill);
      blocks.push({ kind: 'table', title: 'Grieta de tracción en la superficie final', header: t.header, rows: t.rows });
      blocks.push({
        kind: 'paragraph',
        text:
          'x_c es la posición de la grieta en la superficie de falla y la profundidad es la usada en x_c (la fija, o la automática). ' +
          'Pw es la fuerza del agua en la grieta por metro de talud; con la grieta seca vale 0. «Sin grieta (z = 0)» indica que ese método no cortó ninguna grieta: la profundidad en x_c es 0.' +
          (records.some((r) => r.face !== undefined)
            ? ' La cara cortada es la altura de la cara vertical de la masa en x_c (terreno menos base de la superficie); el motor la informa solo cuando difiere de la profundidad. ' +
              '«Corte de la masa … sin grieta de tracción» indica que la masa se cortó en x_c pero la profundidad de Rankine es 0 en ese punto (p. ej., bajo una sobrecarga).'
            : ''),
      });
    } else if (results.some(isMockResult)) {
      blocks.push({ kind: 'paragraph', text: 'El motor simulado no calcula la grieta de tracción.' });
    } else {
      blocks.push({
        kind: 'paragraph',
        text: 'Ningún método devolvió la grieta: la superficie final no la alcanza o el método no convergió. Una superficie que no alcanza la profundidad de la grieta no tiene masa y el motor la descarta.',
      });
    }
  }
  const conventions = [...(pond ? POND_CONVENTIONS : []), ...(crack ? CRACK_CONVENTIONS : [])];
  blocks.push({ kind: 'bullets', title: 'Convenciones', items: conventions });
  return { id: 'crack', title: 'Grieta de tracción y agua embalsada', blocks };
}

/**
 * Sección «Refuerzos» (F4.9): los datos de entrada, la tabla de fuerzas por cruce de cada método que las trae, la leyenda de las
 * pasivas y, con pilotes o tablestacas, el texto del límite de F4.8. Sin refuerzos en el modelo no existe.
 */
function reinforcementsSection(input: ReportInput): ReportSection | null {
  const { model, results } = input;
  const list = reinforcementsOf(model);
  if (list.length === 0) return null;
  const blocks: ReportBlock[] = [{ kind: 'paragraph', text: `El modelo tiene ${list.length} ${list.length === 1 ? 'refuerzo' : 'refuerzos'}. ${REINFORCEMENT_FORCE_BASIS}` }];
  const inputs = reinforcementInputTables(model);
  blocks.push({ kind: 'table', title: 'Datos de entrada: geometría', header: inputs.geometry.header, rows: inputs.geometry.rows });
  blocks.push({ kind: 'table', title: 'Datos de entrada: capacidades', header: inputs.capacity.header, rows: inputs.capacity.rows });
  let withForces = 0;
  for (const r of results) {
    const records = forceRecords([r], list);
    if (records.length === 0) continue;
    withForces += 1;
    const t = forcesTable(records, model.units);
    blocks.push({ kind: 'table', title: `Fuerzas por cruce con la superficie final (${METHOD_LABEL[r.method]})`, header: t.header, rows: t.rows });
  }
  // E14o-16 (R11B-06): sin fuerzas no siempre es un fallo; el texto distingue el motor simulado, la falta de convergencia y la falta de cruces.
  const uncrossed = uncrossedByMethod(results, list);
  const converged = results.filter((r) => r.status === 'converged' && !isMockResult(r));
  if (withForces === 0) {
    let text: string;
    if (results.some(isMockResult)) text = 'El motor simulado no calcula las fuerzas de los refuerzos.';
    else if (converged.length === 0) text = 'Ningún método convergió: no hay superficie final ni fuerzas de refuerzo que informar.';
    else
      text = `Ningún refuerzo cruzó la superficie final de los métodos que convergieron (${converged.map((r) => METHOD_LABEL[r.method]).join(', ')}): no aportaron fuerza. Refuerzos sin cruce: ${list.map((r) => r.id).join(', ')}.`;
    blocks.push({ kind: 'paragraph', text });
  } else {
    for (const u of uncrossed) blocks.push({ kind: 'paragraph', text: `Sin cruce con la superficie final (${METHOD_LABEL[u.method]}): ${u.ids.join(', ')}. No aportaron fuerza.` });
  }
  if (list.some((r) => r.application === 'passive')) {
    blocks.push({ kind: 'paragraph', text: FORCE_TABLE_NOTE });
  }
  // E15i-7: la explicación de las columnas «Fuerza del suelo», «Gobierna» y «Brazo» va solo si hay un pilote de Ito-Matsui.
  if (list.some(isItoMatsuiPile)) blocks.push({ kind: 'paragraph', text: ITO_MATSUI_NOTE });
  if (hasStructuralElements(list)) blocks.push({ kind: 'paragraph', text: `Límite del cálculo. ${structuralLimitText(list)}` });
  return { id: 'reinforcements', title: 'Refuerzos', blocks };
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
  const crackBlock = crackSection(input);
  if (crackBlock) sections.push(crackBlock);
  const reinforcementBlock = reinforcementsSection(input);
  if (reinforcementBlock) sections.push(reinforcementBlock);
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
