// Lógica pura de los paneles del editor (X3 §2.4): parseo de números con coma o punto decimal, validación de
// rangos (mismos límites y redacción que el motor, §1 y §4.5 de 00_CONTRATOS.md y F1.1) y conversión entre los
// formularios (todo texto) y los comandos del editor. No depende de React ni del DOM.

import type {
  AnalysisSettings,
  Direction,
  Load,
  Material,
  MethodKind,
  Point,
  SearchSpec,
  SurfaceSpec,
} from '../../engine/types';
import type { EditorCommand, Issue, ModelDoc, Selection } from '../types';

// ───────────────────────── Números ─────────────────────────

export type NumberParse = { kind: 'empty' } | { kind: 'ok'; value: number } | { kind: 'invalid' };

// Dígitos con un único separador decimal (coma o punto) y exponente opcional. Sin separador de miles: «1,234.5»
// es ambiguo y se rechaza.
const NUMBER_PATTERN = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/;

/** Interpreta el texto de un campo numérico. Vacío (o solo espacios) es `empty`; lo que no es un número finito, `invalid`. */
export function parseNumber(text: string): NumberParse {
  const t = text.trim().replace(/\u2212/g, '-');
  if (t === '') return { kind: 'empty' };
  if (!NUMBER_PATTERN.test(t)) return { kind: 'invalid' };
  const value = Number(t.replace(',', '.'));
  return Number.isFinite(value) ? { kind: 'ok', value } : { kind: 'invalid' };
}

/** Número para la UI: coma decimal, sin ceros de relleno ni ruido de coma flotante (12 cifras significativas). */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return String(Number(value.toPrecision(12))).replace('.', ',');
}

// ───────────────────────── Resultado de formularios ─────────────────────────

/** Errores por campo (clave = nombre del campo del formulario). */
export type FieldErrors = Record<string, string>;

export type FormOutcome<V> = { ok: true; value: V } | { ok: false; errors: FieldErrors };

function done<V>(errors: FieldErrors, value: () => V): FormOutcome<V> {
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: value() };
}

const NOT_A_NUMBER = 'escriba un número (admite coma o punto decimal)';

interface NumberRule {
  /** Si es falso, un campo vacío es válido y el valor es `null`. */
  required: boolean;
  /** Mensaje para un campo obligatorio vacío. */
  missing: string;
  /** Devuelve `true` si el valor cumple el rango. */
  accept: (v: number) => boolean;
  /** Mensaje de rango (redacción del motor). */
  range: string;
  integer?: boolean;
}

function readNumber(text: string, rule: NumberRule): { ok: true; value: number | null } | { ok: false; message: string } {
  const p = parseNumber(text);
  if (p.kind === 'empty') return rule.required ? { ok: false, message: rule.missing } : { ok: true, value: null };
  if (p.kind === 'invalid') return { ok: false, message: NOT_A_NUMBER };
  if (rule.integer === true && !Number.isInteger(p.value)) return { ok: false, message: 'debe ser un número entero' };
  if (!rule.accept(p.value)) return { ok: false, message: rule.range };
  return { ok: true, value: p.value };
}

/** Lee un campo y, si falla, anota el error. Devuelve el valor o `null` (vacío opcional o error). */
function take(errors: FieldErrors, field: string, text: string, rule: NumberRule): number | null {
  const r = readNumber(text, rule);
  if (!r.ok) {
    errors[field] = r.message;
    return null;
  }
  return r.value;
}

const finite = (v: number): boolean => Number.isFinite(v);

// ───────────────────────── Unidades ─────────────────────────

export interface UnitLabels {
  length: string;
  unitWeight: string;
  stress: string;
  lineLoad: string;
}

/** Etiquetas de unidades según `units` del modelo (`imperial` o SI por defecto). */
export function unitLabels(units: string | undefined): UnitLabels {
  return units === 'imperial'
    ? { length: 'ft', unitWeight: 'pcf', stress: 'psf', lineLoad: 'lbf/ft' }
    : { length: 'm', unitWeight: 'kN/m³', stress: 'kPa', lineLoad: 'kN/m' };
}

// ───────────────────────── Geometría del modelo ─────────────────────────

export interface ModelBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Caja de todos los vértices de todas las regiones; `null` si no hay vértices finitos. */
export function modelBounds(doc: ModelDoc): ModelBounds | null {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const region of doc.regions) {
    for (const [x, y] of region.polygon) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
  }
  return xMin <= xMax && yMin <= yMax ? { xMin, xMax, yMin, yMax } : null;
}

export function modelXRange(doc: ModelDoc): [number, number] | null {
  const b = modelBounds(doc);
  return b ? [b.xMin, b.xMax] : null;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Tolerancia de la comparación con la extensión del modelo (misma idea que `pm.tol()` del motor). */
function extentTol(range: readonly [number, number]): number {
  return 1e-9 * Math.max(1, Math.abs(range[1] - range[0]));
}

function insideRange(v: number, range: readonly [number, number]): boolean {
  const tol = extentTol(range);
  return v >= range[0] - tol && v <= range[1] + tol;
}

// ───────────────────────── Materiales ─────────────────────────

export interface MaterialForm {
  id: string;
  name: string;
  unit_weight: string;
  unit_weight_sat: string;
  cohesion: string;
  friction_angle: string;
  ru: string;
}

export function materialToForm(m: Material): MaterialForm {
  return {
    id: m.id,
    name: m.name,
    unit_weight: formatNumber(m.unit_weight),
    unit_weight_sat: formatNumber(m.unit_weight_sat),
    cohesion: formatNumber(m.cohesion),
    friction_angle: formatNumber(m.friction_angle),
    ru: formatNumber(m.ru),
  };
}

/** Siguiente id libre del tipo `m1`, `m2`… */
export function nextMaterialId(existingIds: readonly string[]): string {
  const used = new Set(existingIds);
  for (let n = 1; ; n += 1) {
    const id = `m${n}`;
    if (!used.has(id)) return id;
  }
}

/** Formulario de un material nuevo, con valores típicos de un suelo (el usuario los ajusta). */
export function newMaterialForm(existingIds: readonly string[]): MaterialForm {
  const id = nextMaterialId(existingIds);
  return {
    id,
    name: `Material ${id.slice(1)}`,
    unit_weight: '18',
    unit_weight_sat: '',
    cohesion: '5',
    friction_angle: '30',
    ru: '',
  };
}

export interface MaterialFormContext {
  /** Ids de los demás materiales del documento (sin contar el que se edita). */
  otherIds: readonly string[];
  /** Material que se edita; conserva su `model`. `null` = material nuevo. */
  editing: Material | null;
}

/** Rangos del motor (geometry.rs `resolve_materials`): γ > 0, γsat > 0, c ≥ 0, φ en [0, 90), ru en [0, 1). */
export function materialFromForm(form: MaterialForm, ctx: MaterialFormContext): FormOutcome<Material> {
  const errors: FieldErrors = {};
  const id = form.id.trim();
  const subject = id === '' ? 'nuevo' : id;
  if (id === '') errors.id = 'el id del material no puede estar vacío';
  else if (ctx.otherIds.includes(id)) errors.id = `id de material duplicado: '${id}'`;

  const unitWeight = take(errors, 'unit_weight', form.unit_weight, {
    required: true,
    missing: `el material '${subject}' debe tener peso unitario > 0`,
    accept: (v) => finite(v) && v > 0,
    range: `el material '${subject}' debe tener peso unitario > 0`,
  });
  const unitWeightSat = take(errors, 'unit_weight_sat', form.unit_weight_sat, {
    required: false,
    missing: '',
    accept: (v) => finite(v) && v > 0,
    range: `el peso unitario saturado del material '${subject}' debe ser > 0`,
  });
  const cohesion = take(errors, 'cohesion', form.cohesion, {
    required: true,
    missing: `la cohesión del material '${subject}' debe ser ≥ 0`,
    accept: (v) => finite(v) && v >= 0,
    range: `la cohesión del material '${subject}' debe ser ≥ 0`,
  });
  const friction = take(errors, 'friction_angle', form.friction_angle, {
    required: true,
    missing: `el ángulo de fricción del material '${subject}' debe estar en [0, 90)`,
    accept: (v) => v >= 0 && v < 90,
    range: `el ángulo de fricción del material '${subject}' debe estar en [0, 90)`,
  });
  const ru = take(errors, 'ru', form.ru, {
    required: false,
    missing: '',
    accept: (v) => v >= 0 && v < 1,
    range: `ru del material '${subject}' debe estar en [0, 1)`,
  });

  return done(errors, () => ({
    id,
    name: form.name.trim() === '' ? id : form.name.trim(),
    model: ctx.editing?.model ?? 'mohr_coulomb',
    unit_weight: unitWeight ?? 0,
    unit_weight_sat: unitWeightSat,
    cohesion: cohesion ?? 0,
    friction_angle: friction ?? 0,
    ru,
  }));
}

/** Igualdad de materiales tratando `null` y `undefined` como lo mismo (no genera historial al confirmar sin cambios). */
export function materialsEqual(a: Material, b: Material): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.model === b.model &&
    a.unit_weight === b.unit_weight &&
    (a.unit_weight_sat ?? null) === (b.unit_weight_sat ?? null) &&
    a.cohesion === b.cohesion &&
    a.friction_angle === b.friction_angle &&
    (a.ru ?? null) === (b.ru ?? null)
  );
}

export function materialUpsertCommand(material: Material): EditorCommand {
  return { type: 'material/upsert', material };
}

/** Índices de las regiones que usan el material. */
export function materialUsage(doc: ModelDoc, materialId: string): number[] {
  const out: number[] = [];
  doc.regions.forEach((r, i) => {
    if (r.material === materialId) out.push(i);
  });
  return out;
}

export function materialRemoveCommand(doc: ModelDoc, materialId: string): EditorCommand | null {
  return materialUsage(doc, materialId).length > 0 ? null : { type: 'material/remove', materialId };
}

export function regionMaterialCommand(regionIndex: number, materialId: string): EditorCommand {
  return { type: 'region/setMaterial', regionIndex, materialId };
}

// ───────────────────────── Agua ─────────────────────────

export const DEFAULT_WATER_UNIT_WEIGHT = 9.81;

/** `water.unit_weight`: vacío = omitir (el motor usa 9,81); si no, > 0. */
export function waterUnitWeightFromForm(text: string): FormOutcome<number | undefined> {
  const errors: FieldErrors = {};
  const v = take(errors, 'unit_weight', text, {
    required: false,
    missing: '',
    accept: (n) => finite(n) && n > 0,
    range: 'water.unit_weight debe ser > 0',
  });
  return done(errors, () => v ?? undefined);
}

export function waterUnitWeightCommand(value: number | undefined): EditorCommand {
  return { type: 'water/setUnitWeight', value };
}

export interface PiezoRow {
  x: string;
  y: string;
}

export function piezoToForm(points: readonly Point[] | null | undefined): PiezoRow[] {
  return (points ?? []).map(([x, y]) => ({ x: formatNumber(x), y: formatNumber(y) }));
}

/**
 * Tabla → puntos. Cero filas = sin piezométrica (`null`); si hay filas, mínimo 2, finitas y con x estrictamente
 * creciente (motor: `resolve_water`). Los errores llevan la clave `<fila>.x`, `<fila>.y` o `table`.
 */
export function piezoFromForm(rows: readonly PiezoRow[]): FormOutcome<Point[] | null> {
  const errors: FieldErrors = {};
  if (rows.length === 0) return { ok: true, value: null };
  const points: Array<[number | null, number | null]> = rows.map((row, i) => {
    const rule: NumberRule = { required: true, missing: 'falta el valor', accept: finite, range: NOT_A_NUMBER };
    return [take(errors, `${i}.x`, row.x, rule), take(errors, `${i}.y`, row.y, rule)];
  });
  if (rows.length < 2) errors.table = 'la piezométrica necesita al menos 2 puntos';
  if (Object.keys(errors).length === 0) {
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1][0] ?? 0;
      const cur = points[i][0] ?? 0;
      if (cur <= prev) {
        errors[`${i}.x`] = 'la piezométrica debe tener x estrictamente creciente';
        errors.table = 'la piezométrica debe tener x estrictamente creciente';
      }
    }
  }
  return done(errors, () => points.map(([x, y]): Point => [x ?? 0, y ?? 0]));
}

export function piezoSetCommand(points: Point[] | null): EditorCommand {
  return { type: 'piezo/set', points };
}

/** Piezométrica inicial: horizontal a media altura del modelo; `null` si el modelo no tiene geometría. */
export function defaultPiezo(doc: ModelDoc): Point[] | null {
  const b = modelBounds(doc);
  if (!b) return null;
  const y = round2((b.yMin + b.yMax) / 2);
  return [
    [round2(b.xMin), y],
    [round2(b.xMax), y],
  ];
}

/** Punto nuevo al final de la tabla: a la derecha del último, a su misma altura. */
export function appendPiezoPoint(points: readonly Point[], doc: ModelDoc): Point[] {
  const last = points[points.length - 1];
  const b = modelBounds(doc);
  const width = b ? b.xMax - b.xMin : 1;
  const step = round2(Math.max(width / 10, 0.01));
  return [...points, [round2(last[0] + step), last[1]]];
}

/** Quita el punto `index`; `null` si quedarían menos de 2. */
export function removePiezoPoint(points: readonly Point[], index: number): Point[] | null {
  if (points.length <= 2 || index < 0 || index >= points.length) return null;
  return points.filter((_, i) => i !== index);
}

// ───────────────────────── Superficie ─────────────────────────

/** `search`: búsqueda de la superficie crítica; `fixed`: círculo fijo; `none`: ninguna definida. */
export type SurfaceMode = 'search' | 'fixed' | 'none';

/** La búsqueda manda sobre la superficie fija (contrato §1), como en el motor. */
export function surfaceMode(analysis: Pick<AnalysisSettings, 'surface' | 'search'>): SurfaceMode {
  if (analysis.search) return 'search';
  if (analysis.surface) return 'fixed';
  return 'none';
}

/** Hay una superficie fija guardada que el motor ignorará porque también hay búsqueda. */
export function hasIgnoredSurface(analysis: Pick<AnalysisSettings, 'surface' | 'search'>): boolean {
  return Boolean(analysis.search && analysis.surface);
}

export function defaultSearch(): SearchSpec {
  return {
    type: 'circular_entry_exit',
    entry: null,
    exit: null,
    n_entry: 20,
    n_exit: 20,
    n_radius: 20,
    max_radius_factor: 5,
    min_width: null,
    refine: true,
  };
}

/** Círculo inicial: centrado sobre el modelo, a la altura de su cota máxima, con radio de medio lado mayor. */
export function defaultCircle(doc: ModelDoc): SurfaceSpec {
  const b = modelBounds(doc);
  if (!b) return { type: 'circle', xc: 0, yc: 0, r: 1 };
  const width = b.xMax - b.xMin;
  const height = b.yMax - b.yMin;
  return {
    type: 'circle',
    xc: round2((b.xMin + b.xMax) / 2),
    yc: round2(b.yMax + 0.25 * height),
    r: Math.max(round2(0.5 * Math.max(width, height)), 0.01),
  };
}

/**
 * Comandos para pasar al modo pedido. «Búsqueda» deja `surface: null`; «Fija» deja `search: null`: nunca quedan
 * guardadas las dos. Conserva la especificación existente del modo elegido. Lista vacía si no hay nada que cambiar.
 */
export function surfaceModeCommands(doc: ModelDoc, mode: Exclude<SurfaceMode, 'none'>): EditorCommand[] {
  const { surface, search } = doc.analysis;
  const commands: EditorCommand[] = [];
  if (mode === 'search') {
    if (!search) commands.push({ type: 'search/set', search: defaultSearch() });
    if (surface) commands.push({ type: 'surface/set', surface: null });
  } else {
    if (!surface) commands.push({ type: 'surface/set', surface: defaultCircle(doc) });
    if (search) commands.push({ type: 'search/set', search: null });
  }
  return commands;
}

export interface CircleForm {
  xc: string;
  yc: string;
  r: string;
}

export function circleToForm(surface: SurfaceSpec): CircleForm {
  return { xc: formatNumber(surface.xc), yc: formatNumber(surface.yc), r: formatNumber(surface.r) };
}

/** Motor: «analysis.surface: xc, yc y r deben ser finitos, con r > 0». */
export function circleFromForm(form: CircleForm): FormOutcome<SurfaceSpec> {
  const errors: FieldErrors = {};
  const msg = 'analysis.surface: xc, yc y r deben ser finitos, con r > 0';
  const coord: NumberRule = { required: true, missing: msg, accept: finite, range: msg };
  const xc = take(errors, 'xc', form.xc, coord);
  const yc = take(errors, 'yc', form.yc, coord);
  const r = take(errors, 'r', form.r, { required: true, missing: msg, accept: (v) => finite(v) && v > 0, range: msg });
  return done(errors, () => ({ type: 'circle', xc: xc ?? 0, yc: yc ?? 0, r: r ?? 1 }));
}

export function circlesEqual(a: SurfaceSpec, b: SurfaceSpec): boolean {
  return a.xc === b.xc && a.yc === b.yc && a.r === b.r;
}

export function surfaceSetCommand(surface: SurfaceSpec | null): EditorCommand {
  return { type: 'surface/set', surface };
}

// ───────────────────────── Búsqueda ─────────────────────────

export const SEARCH_DEFAULTS = {
  n_entry: 20,
  n_exit: 20,
  n_radius: 20,
  max_radius_factor: 5,
  refine: true,
} as const;

export const MAX_AXIS_POINTS = 200;
export const MAX_GRID_CANDIDATES = 2_000_000;
/** `max_radius_factor` debe ser estrictamente mayor que este valor. */
export const MIN_RADIUS_FACTOR_EXCLUSIVE = 0.51;

export interface RangeForm {
  lo: string;
  hi: string;
}

export interface SearchForm {
  entry: RangeForm;
  exit: RangeForm;
  n_entry: string;
  n_exit: string;
  n_radius: string;
  max_radius_factor: string;
  min_width: string;
  refine: boolean;
}

function rangeToForm(range: readonly [number, number] | null | undefined): RangeForm {
  return range ? { lo: formatNumber(range[0]), hi: formatNumber(range[1]) } : { lo: '', hi: '' };
}

export function searchToForm(spec: SearchSpec): SearchForm {
  return {
    entry: rangeToForm(spec.entry),
    exit: rangeToForm(spec.exit),
    n_entry: formatNumber(spec.n_entry ?? SEARCH_DEFAULTS.n_entry),
    n_exit: formatNumber(spec.n_exit ?? SEARCH_DEFAULTS.n_exit),
    n_radius: formatNumber(spec.n_radius ?? SEARCH_DEFAULTS.n_radius),
    max_radius_factor: formatNumber(spec.max_radius_factor ?? SEARCH_DEFAULTS.max_radius_factor),
    min_width: formatNumber(spec.min_width),
    refine: spec.refine ?? SEARCH_DEFAULTS.refine,
  };
}

function rangeFromForm(
  errors: FieldErrors,
  name: 'entry' | 'exit',
  form: RangeForm,
  xRange: readonly [number, number] | null,
): [number, number] | null {
  const loText = form.lo.trim();
  const hiText = form.hi.trim();
  if (loText === '' && hiText === '') return null; // vacío = toda la extensión x del terreno
  const rule: NumberRule = {
    required: true,
    missing: `search.${name}: indique mínimo y máximo, o deje ambos vacíos`,
    accept: finite,
    range: NOT_A_NUMBER,
  };
  const lo = take(errors, `${name}.lo`, form.lo, rule);
  const hi = take(errors, `${name}.hi`, form.hi, rule);
  if (lo === null || hi === null) return null;
  if (lo > hi) {
    errors[`${name}.lo`] = `search.${name} = [${formatNumber(lo)}, ${formatNumber(hi)}]: lo debe ser ≤ hi`;
    return null;
  }
  if (xRange && (!insideRange(lo, xRange) || !insideRange(hi, xRange))) {
    errors[`${name}.lo`] =
      `search.${name} = [${formatNumber(lo)}, ${formatNumber(hi)}] sale de la extensión del modelo ` +
      `[${formatNumber(xRange[0])}, ${formatNumber(xRange[1])}]`;
    return null;
  }
  return [lo, hi];
}

/** Rangos del motor (lib.rs `validate_search_counts` y `validate_search_ranges`). */
export function searchFromForm(form: SearchForm, ctx: { xRange: readonly [number, number] | null }): FormOutcome<SearchSpec> {
  const errors: FieldErrors = {};
  const entry = rangeFromForm(errors, 'entry', form.entry, ctx.xRange);
  const exit = rangeFromForm(errors, 'exit', form.exit, ctx.xRange);
  const count = (field: 'n_entry' | 'n_exit' | 'n_radius'): number | null =>
    take(errors, field, form[field], {
      required: true,
      missing: `search.${field} debe estar en [1, ${MAX_AXIS_POINTS}]`,
      accept: (v) => v >= 1 && v <= MAX_AXIS_POINTS,
      range: `search.${field} debe estar en [1, ${MAX_AXIS_POINTS}], no ${form[field].trim()}`,
      integer: true,
    });
  const nEntry = count('n_entry');
  const nExit = count('n_exit');
  const nRadius = count('n_radius');
  if (nEntry !== null && nExit !== null && nRadius !== null) {
    const candidates = nEntry * nExit * nRadius;
    if (candidates > MAX_GRID_CANDIDATES) {
      errors.n_radius =
        `la grilla de búsqueda tendría ${candidates} candidatos (máximo ${MAX_GRID_CANDIDATES}); ` +
        'reduzca n_entry, n_exit o n_radius';
    }
  }
  const factor = take(errors, 'max_radius_factor', form.max_radius_factor, {
    required: true,
    missing: `search.max_radius_factor debe ser finito y mayor que ${formatNumber(MIN_RADIUS_FACTOR_EXCLUSIVE)}`,
    accept: (v) => finite(v) && v > MIN_RADIUS_FACTOR_EXCLUSIVE,
    range: `search.max_radius_factor debe ser finito y mayor que ${formatNumber(MIN_RADIUS_FACTOR_EXCLUSIVE)}, no ${form.max_radius_factor.trim()}`,
  });
  const minWidth = take(errors, 'min_width', form.min_width, {
    required: false,
    missing: '',
    accept: (v) => finite(v) && v >= 0,
    range: `search.min_width debe ser finito y ≥ 0, no ${form.min_width.trim()}`,
  });
  return done(errors, () => ({
    type: 'circular_entry_exit',
    entry,
    exit,
    n_entry: nEntry ?? SEARCH_DEFAULTS.n_entry,
    n_exit: nExit ?? SEARCH_DEFAULTS.n_exit,
    n_radius: nRadius ?? SEARCH_DEFAULTS.n_radius,
    max_radius_factor: factor ?? SEARCH_DEFAULTS.max_radius_factor,
    min_width: minWidth,
    refine: form.refine,
  }));
}

function sameRange(a: readonly [number, number] | null | undefined, b: readonly [number, number] | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a[0] === b[0] && a[1] === b[1];
}

/** Igualdad efectiva de búsquedas (los campos ausentes valen su valor por defecto; `null` y ausente son lo mismo). */
export function searchesEqual(a: SearchSpec, b: SearchSpec): boolean {
  return (
    sameRange(a.entry, b.entry) &&
    sameRange(a.exit, b.exit) &&
    (a.n_entry ?? SEARCH_DEFAULTS.n_entry) === (b.n_entry ?? SEARCH_DEFAULTS.n_entry) &&
    (a.n_exit ?? SEARCH_DEFAULTS.n_exit) === (b.n_exit ?? SEARCH_DEFAULTS.n_exit) &&
    (a.n_radius ?? SEARCH_DEFAULTS.n_radius) === (b.n_radius ?? SEARCH_DEFAULTS.n_radius) &&
    (a.max_radius_factor ?? SEARCH_DEFAULTS.max_radius_factor) ===
      (b.max_radius_factor ?? SEARCH_DEFAULTS.max_radius_factor) &&
    (a.min_width ?? null) === (b.min_width ?? null) &&
    (a.refine ?? SEARCH_DEFAULTS.refine) === (b.refine ?? SEARCH_DEFAULTS.refine)
  );
}

export function searchSetCommand(search: SearchSpec | null): EditorCommand {
  return { type: 'search/set', search };
}

/** Número de candidatos de la rejilla (producto), con los valores por defecto si faltan. */
export function searchCandidates(spec: SearchSpec): number {
  return (
    (spec.n_entry ?? SEARCH_DEFAULTS.n_entry) *
    (spec.n_exit ?? SEARCH_DEFAULTS.n_exit) *
    (spec.n_radius ?? SEARCH_DEFAULTS.n_radius)
  );
}

// ───────────────────────── Análisis ─────────────────────────

export const METHOD_ORDER: readonly MethodKind[] = ['bishop', 'spencer'];
export const METHOD_LABELS: Readonly<Record<MethodKind, string>> = {
  bishop: 'Bishop simplificado',
  spencer: 'Spencer',
};
export const DIRECTION_OPTIONS: ReadonlyArray<{ value: Direction; label: string }> = [
  { value: 'auto', label: 'Automático' },
  { value: 'left_to_right', label: 'Hacia la derecha (izquierda → derecha)' },
  { value: 'right_to_left', label: 'Hacia la izquierda (derecha → izquierda)' },
];

export const ANALYSIS_DEFAULTS = {
  methods: ['bishop'] as readonly MethodKind[],
  slices: 50,
  tolerance: 1e-5,
  max_iterations: 500,
  min_m_alpha: 0.2,
} as const;

export const MIN_SLICES = 3;
export const MAX_SLICES = 2000;
export const MAX_TOLERANCE = 0.01;
export const MAX_ITERATIONS = 100_000;

export interface AnalysisForm {
  methods: MethodKind[];
  slices: string;
  tolerance: string;
  max_iterations: string;
  min_m_alpha: string;
  direction: Direction;
}

export function analysisToForm(doc: ModelDoc): AnalysisForm {
  const a = doc.analysis;
  return {
    methods: sortMethods(a.methods ?? ANALYSIS_DEFAULTS.methods),
    slices: formatNumber(a.slices ?? ANALYSIS_DEFAULTS.slices),
    tolerance: formatNumber(a.tolerance ?? ANALYSIS_DEFAULTS.tolerance),
    max_iterations: formatNumber(a.max_iterations ?? ANALYSIS_DEFAULTS.max_iterations),
    min_m_alpha: formatNumber(a.min_m_alpha ?? ANALYSIS_DEFAULTS.min_m_alpha),
    direction: doc.slope?.direction ?? 'auto',
  };
}

function sortMethods(methods: readonly MethodKind[]): MethodKind[] {
  return METHOD_ORDER.filter((m) => methods.includes(m));
}

/** Marca o desmarca un método; el resultado va en orden canónico y puede quedar vacío (la validación lo señala). */
export function toggleMethod(methods: readonly MethodKind[], method: MethodKind, on: boolean): MethodKind[] {
  const next = on ? [...methods, method] : methods.filter((m) => m !== method);
  return sortMethods(next);
}

export interface AnalysisValues {
  methods: MethodKind[];
  slices: number;
  tolerance: number;
  max_iterations: number;
  min_m_alpha: number;
  direction: Direction;
}

/** Rangos del motor (lib.rs `validate_analysis`): métodos ≥ 1, slices 3–2000, tolerancia (0, 0,01], etc. */
export function analysisFromForm(form: AnalysisForm): FormOutcome<AnalysisValues> {
  const errors: FieldErrors = {};
  if (form.methods.length === 0) errors.methods = 'analysis.methods está vacío: elija al menos un método';
  const slices = take(errors, 'slices', form.slices, {
    required: true,
    missing: `analysis.slices debe estar en [${MIN_SLICES}, ${MAX_SLICES}]`,
    accept: (v) => v >= MIN_SLICES && v <= MAX_SLICES,
    range: `analysis.slices debe estar en [${MIN_SLICES}, ${MAX_SLICES}], no ${form.slices.trim()}`,
    integer: true,
  });
  const tolerance = take(errors, 'tolerance', form.tolerance, {
    required: true,
    missing: `analysis.tolerance debe ser finita y estar en (0, ${formatNumber(MAX_TOLERANCE)}]`,
    accept: (v) => finite(v) && v > 0 && v <= MAX_TOLERANCE,
    range: `analysis.tolerance debe ser finita y estar en (0, ${formatNumber(MAX_TOLERANCE)}], no ${form.tolerance.trim()}`,
  });
  const maxIterations = take(errors, 'max_iterations', form.max_iterations, {
    required: true,
    missing: `analysis.max_iterations debe estar en [1, ${MAX_ITERATIONS}]`,
    accept: (v) => v >= 1 && v <= MAX_ITERATIONS,
    range: `analysis.max_iterations debe estar en [1, ${MAX_ITERATIONS}], no ${form.max_iterations.trim()}`,
    integer: true,
  });
  const minMAlpha = take(errors, 'min_m_alpha', form.min_m_alpha, {
    required: true,
    missing: 'analysis.min_m_alpha debe ser finito y estar en (0, 1]',
    accept: (v) => finite(v) && v > 0 && v <= 1,
    range: `analysis.min_m_alpha debe ser finito y estar en (0, 1], no ${form.min_m_alpha.trim()}`,
  });
  return done(errors, () => ({
    methods: sortMethods(form.methods),
    slices: slices ?? ANALYSIS_DEFAULTS.slices,
    tolerance: tolerance ?? ANALYSIS_DEFAULTS.tolerance,
    max_iterations: maxIterations ?? ANALYSIS_DEFAULTS.max_iterations,
    min_m_alpha: minMAlpha ?? ANALYSIS_DEFAULTS.min_m_alpha,
    direction: form.direction,
  }));
}

/**
 * Comandos que llevan el documento a los valores del formulario. Solo se emiten los campos que cambian respecto al
 * valor efectivo (con los defaults del motor), de modo que confirmar sin cambios no ensucia el historial.
 */
export function analysisCommands(doc: ModelDoc, values: AnalysisValues): EditorCommand[] {
  const current = analysisToForm(doc);
  const patch: Partial<AnalysisSettings> = {};
  if (current.methods.join() !== values.methods.join()) patch.methods = values.methods;
  if (parseNumberOr(current.slices) !== values.slices) patch.slices = values.slices;
  if (parseNumberOr(current.tolerance) !== values.tolerance) patch.tolerance = values.tolerance;
  if (parseNumberOr(current.max_iterations) !== values.max_iterations) patch.max_iterations = values.max_iterations;
  if (parseNumberOr(current.min_m_alpha) !== values.min_m_alpha) patch.min_m_alpha = values.min_m_alpha;
  const commands: EditorCommand[] = [];
  if (Object.keys(patch).length > 0) commands.push({ type: 'analysis/patch', patch });
  if (current.direction !== values.direction) commands.push({ type: 'slope/setDirection', direction: values.direction });
  return commands;
}

function parseNumberOr(text: string): number {
  const p = parseNumber(text);
  return p.kind === 'ok' ? p.value : Number.NaN;
}

// ───────────────────────── Cargas ─────────────────────────

export interface UdlForm {
  type: 'udl';
  id: string;
  x1: string;
  x2: string;
  q: string;
}

export interface LineForm {
  type: 'line';
  id: string;
  x: string;
  p: string;
  angle: string;
}

export type LoadForm = UdlForm | LineForm;

export function loadToForm(load: Load): LoadForm {
  if (load.type === 'udl') {
    return { type: 'udl', id: load.id ?? '', x1: formatNumber(load.x1), x2: formatNumber(load.x2), q: formatNumber(load.q) };
  }
  return { type: 'line', id: load.id ?? '', x: formatNumber(load.x), p: formatNumber(load.p), angle: formatNumber(load.angle) };
}

/** Siguiente id libre del tipo `u1`/`l1`. */
export function nextLoadId(loads: readonly Load[], type: Load['type']): string {
  const prefix = type === 'udl' ? 'u' : 'l';
  const used = new Set(loads.map((l) => l.id));
  for (let n = 1; ; n += 1) {
    const id = `${prefix}${n}`;
    if (!used.has(id)) return id;
  }
}

/** Carga nueva con valores válidos dentro del modelo; `null` si no hay geometría donde situarla. */
export function defaultLoad(type: Load['type'], doc: ModelDoc): Load | null {
  const range = modelXRange(doc);
  if (!range || !(range[1] > range[0])) return null;
  const width = range[1] - range[0];
  const id = nextLoadId(doc.loads ?? [], type);
  if (type === 'udl') {
    return { type: 'udl', id, x1: round2(range[0] + 0.4 * width), x2: round2(range[0] + 0.6 * width), q: 10 };
  }
  return { type: 'line', id, x: round2(range[0] + 0.5 * width), p: 10, angle: 0 };
}

export interface LoadFormContext {
  /** Rango x del modelo; `null` si no se conoce (no se comprueba la pertenencia). */
  xRange: readonly [number, number] | null;
  /** Ids de las demás cargas (sin contar la que se edita). */
  otherIds: readonly string[];
  /** Posición (0-based) de la carga que se edita; `null` = carga nueva. Solo sirve para redactar mensajes. */
  index: number | null;
}

/** F1.1: udl con x1 < x2 dentro del modelo y q ≥ 0; line con x dentro, p ≥ 0 y ángulo en [−90, 90]; ids únicos. */
export function loadFromForm(form: LoadForm, ctx: LoadFormContext): FormOutcome<Load> {
  const errors: FieldErrors = {};
  const id = form.id.trim();
  const subject = id !== '' ? `la carga '${id}'` : ctx.index !== null ? `la carga ${ctx.index + 1}` : 'la carga nueva';
  if (id !== '' && ctx.otherIds.includes(id)) errors.id = `id de carga duplicado: '${id}'`;
  const idPart = id === '' ? {} : { id };
  const inRange = (field: string, v: number | null): void => {
    if (v !== null && ctx.xRange && !insideRange(v, ctx.xRange)) {
      errors[field] =
        `${subject} tiene ${field} fuera del rango x del modelo [${formatNumber(ctx.xRange[0])}, ${formatNumber(ctx.xRange[1])}]`;
    }
  };
  const xRule = (what: string): NumberRule => ({
    required: true,
    missing: `${subject}: falta ${what}`,
    accept: finite,
    range: NOT_A_NUMBER,
  });

  if (form.type === 'udl') {
    const x1 = take(errors, 'x1', form.x1, xRule('x1'));
    const x2 = take(errors, 'x2', form.x2, xRule('x2'));
    const q = take(errors, 'q', form.q, {
      required: true,
      missing: `${subject}: falta q`,
      accept: (v) => finite(v) && v >= 0,
      range: `${subject} debe tener q ≥ 0`,
    });
    if (x1 !== null && x2 !== null && x1 >= x2) errors.x1 = `${subject} tiene x1 >= x2`;
    else {
      if (!errors.x1) inRange('x1', x1);
      if (!errors.x2) inRange('x2', x2);
    }
    return done(errors, (): Load => ({ type: 'udl', ...idPart, x1: x1 ?? 0, x2: x2 ?? 0, q: q ?? 0 }));
  }

  const x = take(errors, 'x', form.x, xRule('x'));
  const p = take(errors, 'p', form.p, {
    required: true,
    missing: `${subject}: falta p`,
    accept: (v) => finite(v) && v >= 0,
    range: `${subject} debe tener p ≥ 0`,
  });
  const angle = take(errors, 'angle', form.angle, {
    required: true,
    missing: `${subject}: falta el ángulo`,
    accept: (v) => v >= -90 && v <= 90,
    range: `${subject} debe tener ángulo en [-90, 90]`,
  });
  if (!errors.x) inRange('x', x);
  return done(errors, (): Load => ({ type: 'line', ...idPart, x: x ?? 0, p: p ?? 0, angle: angle ?? 0 }));
}

export function loadsEqual(a: Load, b: Load): boolean {
  if ((a.id ?? null) !== (b.id ?? null) || a.type !== b.type) return false;
  if (a.type === 'udl' && b.type === 'udl') return a.x1 === b.x1 && a.x2 === b.x2 && a.q === b.q;
  if (a.type === 'line' && b.type === 'line') return a.x === b.x && a.p === b.p && a.angle === b.angle;
  return false;
}

export function loadUpsertCommand(index: number | null, load: Load): EditorCommand {
  return { type: 'load/upsert', index, load };
}

export function loadRemoveCommand(index: number): EditorCommand {
  return { type: 'load/remove', index };
}

export const LOAD_TYPE_LABELS: Readonly<Record<Load['type'], string>> = {
  udl: 'Distribuida (udl)',
  line: 'Lineal',
};

// ───────────────────────── Sismo ─────────────────────────

export interface SeismicForm {
  kh: string;
  kv: string;
}

export const SEISMIC_HELP =
  'Coeficientes pseudoestáticos. kh positivo actúa en el sentido del deslizamiento; kv positivo actúa hacia abajo. ' +
  'Se aplican solo al peso del suelo, no a las cargas.';

export function seismicToForm(doc: ModelDoc): SeismicForm {
  const s = doc.analysis.seismic;
  return s ? { kh: formatNumber(s.kh ?? 0), kv: formatNumber(s.kv ?? 0) } : { kh: '', kv: '' };
}

/**
 * F1.1: kh en [0, 1), kv en (−1, 1). Ambos vacíos = sin sismo (`null`); si solo uno está vacío, vale 0.
 */
export function seismicFromForm(form: SeismicForm): FormOutcome<{ kh: number; kv: number } | null> {
  const errors: FieldErrors = {};
  if (form.kh.trim() === '' && form.kv.trim() === '') return { ok: true, value: null };
  const kh = take(errors, 'kh', form.kh, {
    required: false,
    missing: '',
    accept: (v) => v >= 0 && v < 1,
    range: 'analysis.seismic.kh debe estar en [0, 1)',
  });
  const kv = take(errors, 'kv', form.kv, {
    required: false,
    missing: '',
    accept: (v) => v > -1 && v < 1,
    range: 'analysis.seismic.kv debe estar en (-1, 1)',
  });
  return done(errors, () => ({ kh: kh ?? 0, kv: kv ?? 0 }));
}

export function seismicsEqual(
  a: { kh?: number; kv?: number } | null | undefined,
  b: { kh?: number; kv?: number } | null | undefined,
): boolean {
  if (!a || !b) return !a && !b;
  return (a.kh ?? 0) === (b.kh ?? 0) && (a.kv ?? 0) === (b.kv ?? 0);
}

export function seismicSetCommand(seismic: { kh: number; kv: number } | null): EditorCommand {
  return { type: 'seismic/set', seismic };
}

// ───────────────────────── Diagnósticos ─────────────────────────

function unescapePointer(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function toIndex(segment: string | undefined): number | null {
  return segment !== undefined && /^\d+$/.test(segment) ? Number(segment) : null;
}

/**
 * Puntero JSON de una incidencia → elemento a seleccionar. Rutas reconocidas:
 * `/regions/i[/material]` → región; `/regions/i/polygon/j` → vértice; `/materials/k` → material;
 * `/water/piezometric_line/k` → punto de la piezométrica; `/analysis/surface[/…]` → círculo;
 * `/analysis/search/entry|exit` → banda; `/loads/k` → carga. Cualquier otra → `none`.
 */
export function selectionForPath(path: string | null, doc: ModelDoc): Selection {
  if (path === null || path === '') return { kind: 'none' };
  const seg = path.split('/').slice(1).map(unescapePointer);
  const [a, b, c, d] = seg;
  if (a === 'regions') {
    const regionIndex = toIndex(b);
    if (regionIndex === null || regionIndex >= doc.regions.length) return { kind: 'none' };
    const vertexIndex = c === 'polygon' ? toIndex(d) : null;
    if (vertexIndex !== null && vertexIndex < doc.regions[regionIndex].polygon.length) {
      return { kind: 'vertex', regionIndex, vertexIndex };
    }
    return { kind: 'region', regionIndex };
  }
  if (a === 'materials') {
    const k = toIndex(b);
    const material = k === null ? undefined : doc.materials[k];
    return material ? { kind: 'material', materialId: material.id } : { kind: 'none' };
  }
  if (a === 'water' && b === 'piezometric_line') {
    const k = toIndex(c);
    const n = doc.water?.piezometric_line?.length ?? 0;
    return k !== null && k < n ? { kind: 'piezo_point', index: k } : { kind: 'none' };
  }
  if (a === 'analysis' && b === 'surface') return { kind: 'surface_circle' };
  if (a === 'analysis' && b === 'search' && (c === 'entry' || c === 'exit')) return { kind: 'search_range', which: c };
  if (a === 'loads') {
    const k = toIndex(b);
    return k !== null && k < (doc.loads?.length ?? 0) ? { kind: 'load', index: k } : { kind: 'none' };
  }
  return { kind: 'none' };
}

const SEVERITY_ORDER: Readonly<Record<Issue['severity'], number>> = { error: 0, aviso: 1, nota: 2 };

export const SEVERITY_LABELS: Readonly<Record<Issue['severity'], string>> = {
  error: 'Error',
  aviso: 'Aviso',
  nota: 'Nota',
};

/** Errores primero, luego avisos y notas; dentro de cada grado se conserva el orden de entrada. */
export function sortIssues(issues: readonly Issue[]): Issue[] {
  return issues
    .map((issue, i) => ({ issue, i }))
    .sort((a, b) => SEVERITY_ORDER[a.issue.severity] - SEVERITY_ORDER[b.issue.severity] || a.i - b.i)
    .map((e) => e.issue);
}

export function issueCounts(issues: readonly Issue[]): Record<Issue['severity'], number> {
  const counts = { error: 0, aviso: 0, nota: 0 };
  for (const issue of issues) counts[issue.severity] += 1;
  return counts;
}

export function diagnosticsStatusLabel(status: 'idle' | 'checking' | 'ok' | 'error' | 'stale'): string {
  switch (status) {
    case 'idle':
      return 'Sin comprobar con el motor';
    case 'checking':
      return 'Comprobando con el motor…';
    case 'ok':
      return 'El motor aceptó el modelo';
    case 'error':
      return 'El motor rechazó el modelo';
    case 'stale':
      return 'Desactualizado: el modelo cambió desde la última comprobación';
  }
}

/** Resumen en una línea: «2 errores, 1 aviso, 0 notas». */
export function issueSummary(issues: readonly Issue[]): string {
  const c = issueCounts(issues);
  const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
  return [plural(c.error, 'error', 'errores'), plural(c.aviso, 'aviso', 'avisos'), plural(c.nota, 'nota', 'notas')].join(', ');
}
