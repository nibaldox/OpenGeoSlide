// Contenido del informe (X3 §2.9): función pura de `ReportInput` a secciones. El PDF (`pdf.ts`) solo lo dibuja.
//
// Números con coma decimal (UI en español). El FS solo se muestra si el método convergió (R4-06). Los avisos usan
// el catálogo de `engine/warnings.ts` y la advertencia profesional es la aprobada en F1.4.

import type { ModelDoc } from '../editor/types';
import type { MethodKind, MethodReport, Point, Slice } from '../engine/types';
import { describeWarning } from '../engine/warnings';
import { PDF_PALETTE, pdfMaterialColor, type Rgb } from './palette';
import type { ReportInput } from './types';

export type { Rgb };

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
  center: Point;
  radius: number;
}

export interface LegendItem {
  kind: 'material' | 'piezo' | 'surface' | 'slices';
  label: string;
  color: Rgb;
}

export interface SectionDrawing {
  bounds: { xmin: number; xmax: number; ymin: number; ymax: number };
  regions: DrawingRegion[];
  piezo: Point[] | null;
  surface: DrawingSurface | null;
  legend: LegendItem[];
}

export type ReportBlock =
  | { kind: 'kv'; rows: [string, string][] }
  | { kind: 'table'; header: string[]; rows: string[][]; title?: string }
  | { kind: 'paragraph'; text: string }
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

/** Número sin decimales fijos (hasta 6 cifras significativas) y coma decimal; para parámetros de entrada. */
export function fmtParam(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  return String(Number(n.toPrecision(6))).replace('.', ',');
}

function units(model: ModelDoc): { gamma: string; stress: string; line: string; length: string } {
  return model.units === 'imperial'
    ? { gamma: 'pcf', stress: 'psf', line: 'lbf/ft', length: 'ft' }
    : { gamma: 'kN/m³', stress: 'kPa', line: 'kN/m', length: 'm' };
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

/** Recorta una polilínea (x creciente) al intervalo [xmin, xmax], interpolando en los extremos. */
export function clipPolylineX(points: Point[], xmin: number, xmax: number): Point[] {
  const out: Point[] = [];
  const yAt = (a: Point, b: Point, x: number): number => (b[0] === a[0] ? a[1] : a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    if (Math.max(a[0], b[0]) < xmin || Math.min(a[0], b[0]) > xmax) continue;
    const p0: Point = a[0] < xmin ? [xmin, yAt(a, b, xmin)] : a;
    const p1: Point = b[0] > xmax ? [xmax, yAt(a, b, xmax)] : b;
    if (out.length === 0) out.push(p0);
    out.push(p1);
  }
  return out;
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

function circleArc(model: ModelDoc, r: MethodReport, bounds: SectionDrawing['bounds']): Point[] {
  const pts: Point[] = [];
  const n = 180;
  for (let i = 0; i <= n; i++) {
    const t = Math.PI + (Math.PI * i) / n; // semicírculo inferior
    const x = r.surface.xc + r.surface.r * Math.cos(t);
    const y = r.surface.yc + r.surface.r * Math.sin(t);
    const top = terrainY(model, x);
    if (x >= bounds.xmin && x <= bounds.xmax && y >= bounds.ymin && top !== null && y <= top) pts.push([x, y]);
  }
  return pts;
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

  let surface: DrawingSurface | null = null;
  const res = primaryResult(results);
  if (res) {
    let points: Point[];
    const sliceLines: [Point, Point][] = [];
    if (res.slices.length > 0) {
      points = baseSurfacePoints(res.slices);
      for (const p of points) {
        const top = terrainY(model, p[0]);
        if (top !== null && top > p[1]) sliceLines.push([p, [p[0], top]]);
      }
    } else {
      points = circleArc(model, res, bounds);
    }
    for (const [, y] of points) bounds.ymin = Math.min(bounds.ymin, y);
    surface = { method: res.method, points, sliceLines, center: [res.surface.xc, res.surface.yc], radius: res.surface.r };
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
  if (surface) {
    // Solo un método convergido da la superficie crítica; si ninguno convergió, es la superficie evaluada sin resultado.
    const converged = res?.status === 'converged';
    legend.push({
      kind: 'surface',
      label: converged
        ? `Superficie crítica (${METHOD_LABEL[surface.method]})`
        : `Superficie evaluada, sin convergencia (${METHOD_LABEL[surface.method]})`,
      color: [...PDF_PALETTE.surface],
    });
    if (surface.sliceLines.length > 0) legend.push({ kind: 'slices', label: 'Dovelas', color: [...PDF_PALETTE.slices] });
  }
  return { bounds, regions, piezo, surface, legend };
}

// ---------------------------------------------------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------------------------------------------------

function modelSection(model: ModelDoc): ReportSection {
  const a = model.analysis;
  const u = units(model);
  const blocks: ReportBlock[] = [];
  if (model.meta.notes) blocks.push({ kind: 'paragraph', text: model.meta.notes });

  const dflt = (v: unknown, text: string): string => (v === undefined || v === null ? `${text} (por defecto)` : text);
  const methods = a.methods ?? ['bishop'];
  const rows: [string, string][] = [
    ['Sentido del deslizamiento', DIRECTION_LABEL[model.slope?.direction ?? 'auto'] ?? String(model.slope?.direction)],
    ['Métodos', dflt(a.methods, methods.map((m) => METHOD_LABEL[m]).join(', '))],
    ['Dovelas', dflt(a.slices, fmtParam(a.slices ?? 50))],
    ['Tolerancia (relativa en FS)', dflt(a.tolerance, fmtParam(a.tolerance ?? 1e-5))],
    ['Iteraciones máximas', dflt(a.max_iterations, fmtParam(a.max_iterations ?? 500))],
    ['m_α mínimo', dflt(a.min_m_alpha, fmtParam(a.min_m_alpha ?? 0.2))],
    ['Peso unitario del agua', dflt(model.water?.unit_weight, `${fmtParam(model.water?.unit_weight ?? 9.81)} ${u.gamma}`)],
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
  return {
    id: 'materials',
    title: 'Materiales',
    blocks: [
      {
        kind: 'table',
        header: ['Id', 'Nombre', `γ (${u.gamma})`, `γsat (${u.gamma})`, `c (${u.stress})`, 'φ (°)', 'ru'],
        rows: model.materials.map((m) => [
          m.id,
          m.name,
          fmtParam(m.unit_weight),
          fmtParam(m.unit_weight_sat),
          fmtParam(m.cohesion),
          fmtParam(m.friction_angle),
          fmtParam(m.ru),
        ]),
      },
    ],
  };
}

function resultsSection(results: MethodReport[]): ReportSection {
  return {
    id: 'results',
    title: 'Factor de seguridad por método',
    blocks: [
      {
        kind: 'table',
        header: ['Método', 'Estado', 'FS', 'Iter.', 'λ', 'Evaluadas', 'Válidas', 'Centro (xc; yc)', 'Radio'],
        rows: results.map((r) => [
          METHOD_LABEL[r.method],
          STATUS_LABEL[r.status],
          r.status === 'converged' ? fmt(r.fos, 3) : DASH,
          String(r.iterations),
          r.method === 'spencer' && r.status === 'converged' ? fmt(r.lambda, 4) : DASH,
          r.search ? String(r.search.evaluated) : DASH,
          r.search ? String(r.search.valid) : DASH,
          `${fmt(r.surface.xc, 2)}; ${fmt(r.surface.yc, 2)}`,
          fmt(r.surface.r, 2),
        ]),
      },
    ],
  };
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
  for (const r of input.results) {
    for (const code of r.warnings) {
      const info = describeWarning(code);
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
          ['Versión del formato', model.version],
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
    resultsSection(input.results),
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
