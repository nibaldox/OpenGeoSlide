// Lógica pura de los paneles del editor (X3 §2.4): parseo de números con coma o punto decimal, validación de
// rangos (mismos límites y redacción que el motor, §1 y §4.5 de 00_CONTRATOS.md y F1.1) y conversión entre los
// formularios (todo texto) y los comandos del editor. No depende de React ni del DOM.

import type {
  AnalysisSettings,
  Direction,
  IntersliceFunction,
  Load,
  Material,
  MaterialModel,
  MethodKind,
  Point,
  SearchSpec,
  CircleSurfaceSpec,
  SurfaceSpec,
} from '../../engine/types';
import {
  RULE_TEXT,
  SEARCH_RANGE_LABEL,
  intersliceTableError,
  loadXText,
  rangeExtentText,
  rangeOrderText,
  searchCountText,
  searchProductText,
} from '../state/validateLocal';
import { fitPolylineToGround, groundPieces } from '../state/polylineGround';
import { isImperialUnits } from '../state/units';
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

/** Entero con espacio fino de no separación como separador de miles (independiente del ICU del entorno). */
export function formatCount(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}

// ───────────────────────── Resultado de formularios ─────────────────────────

/** Errores por campo (clave = nombre del campo del formulario). */
export type FieldErrors = Record<string, string>;

export type FormOutcome<V> = { ok: true; value: V } | { ok: false; errors: FieldErrors };

function done<V>(errors: FieldErrors, value: () => V): FormOutcome<V> {
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: value() };
}

const NOT_A_NUMBER = 'Escriba un número (admite coma o punto decimal)';

/** Mensaje de «no es un número» con la etiqueta del campo, para que el aviso se entienda sin ver el campo. */
function notANumber(label: string | undefined): string {
  return label ? `${label}: escriba un número (admite coma o punto decimal)` : NOT_A_NUMBER;
}

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
  /** Etiqueta del campo en la interfaz; encabeza los mensajes de formato («no es un número», «no es entero»). */
  label?: string;
}

function readNumber(text: string, rule: NumberRule): { ok: true; value: number | null } | { ok: false; message: string } {
  const p = parseNumber(text);
  if (p.kind === 'empty') return rule.required ? { ok: false, message: rule.missing } : { ok: true, value: null };
  if (p.kind === 'invalid') return { ok: false, message: notANumber(rule.label) };
  if (rule.integer === true && !Number.isInteger(p.value)) {
    return { ok: false, message: `${rule.label ?? 'El valor'}: use un número entero, sin decimales` };
  }
  if (!rule.accept(p.value)) return { ok: false, message: rule.range };
  return { ok: true, value: p.value };
}

/** Etiqueta en la interfaz de cada campo de los formularios (clave = nombre del campo). */
const FIELD_LABEL: Readonly<Record<string, string>> = {
  unit_weight: 'Peso unitario γ',
  unit_weight_sat: 'Peso unitario saturado γsat',
  cohesion: 'Cohesión c',
  friction_angle: 'Ángulo de fricción φ',
  ru: 'Coeficiente de presión de poros ru',
  xc: 'Centro xc del círculo de falla',
  yc: 'Centro yc del círculo de falla',
  r: 'Radio r del círculo de falla',
  n_entry: 'Puntos de entrada',
  n_exit: 'Puntos de salida',
  n_radius: 'Radios por par',
  max_radius_factor: 'Factor de radio máximo',
  min_width: 'Ancho mínimo',
  slices: 'Dovelas',
  tolerance: 'Tolerancia',
  max_iterations: 'Iteraciones máximas',
  min_m_alpha: 'm_α mínimo',
  kh: 'Coeficiente sísmico horizontal kh',
  kv: 'Coeficiente sísmico vertical kv',
  x: 'Posición x de la carga lineal',
  x1: 'Inicio x1 de la carga distribuida',
  x2: 'Fin x2 de la carga distribuida',
  q: 'Carga distribuida q',
  p: 'Carga lineal p',
  angle: 'Ángulo de la carga lineal',
  undrained_strength: 'Resistencia no drenada Su',
  strength_datum: 'Cota de referencia de Su',
  strength_gradient: 'Gradiente de Su',
  strength_limit: 'Límite de Su',
};

/** Lee un campo y, si falla, anota el error. Devuelve el valor o `null` (vacío opcional o error). */
function take(errors: FieldErrors, field: string, text: string, rule: NumberRule): number | null {
  const r = readNumber(text, { label: FIELD_LABEL[field], ...rule });
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
  /** Esfuerzo por unidad de longitud: el gradiente de Su (kPa/m o psf/ft). */
  stressGradient: string;
}

/** Etiquetas de unidades según `units` del modelo (`imperial` o SI por defecto). */
export function unitLabels(units: string | undefined): UnitLabels {
  return isImperialUnits(units)
    ? { length: 'ft', unitWeight: 'pcf', stress: 'psf', lineLoad: 'lbf/ft', stressGradient: 'psf/ft' }
    : { length: 'm', unitWeight: 'kN/m³', stress: 'kPa', lineLoad: 'kN/m', stressGradient: 'kPa/m' };
}

// ───────────────────────── Geometría del modelo ─────────────────────────

export interface ModelBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Caja de todos los vértices de todas las regiones; `null` si no hay vértices finitos. */
export function modelBounds(doc: Pick<ModelDoc, 'regions'>): ModelBounds | null {
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

export function modelXRange(doc: Pick<ModelDoc, 'regions'>): [number, number] | null {
  const b = modelBounds(doc);
  return b ? [b.xMin, b.xMax] : null;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Rangos x que sirven para ubicar una carga (UX9-03): el terreno completo y la corona (el tramo horizontal más alto). */
export interface TerrainRanges {
  /** Extensión x de la superficie del terreno. */
  terrain: readonly [number, number];
  /** Tramo horizontal más alto del terreno; `null` si el perfil no tiene un tramo plano en su cota máxima. */
  crown: readonly [number, number] | null;
}

/** Cota de la superficie del terreno (envolvente superior de todas las regiones) en `x`; `-Infinity` fuera. */
function terrainY(regions: ModelDoc['regions'], x: number, tol: number): number {
  let best = -Infinity;
  for (const { polygon } of regions) {
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i] as readonly [number, number];
      const b = polygon[(i + 1) % polygon.length] as readonly [number, number];
      const lo = Math.min(a[0], b[0]);
      const hi = Math.max(a[0], b[0]);
      if (x < lo - tol || x > hi + tol) continue;
      if (hi - lo <= tol) best = Math.max(best, a[1], b[1]);
      else best = Math.max(best, a[1] + ((Math.min(Math.max(x, lo), hi) - a[0]) / (b[0] - a[0])) * (b[1] - a[1]));
    }
  }
  return best;
}

/**
 * Terreno y corona del modelo, calculados de la geometría (sin usar el nombre de ninguna región). La corona es el
 * tramo más ancho de la envolvente superior que está a la cota máxima del terreno; `null` si no hay ninguno
 * (terreno sin tramo plano en lo alto). `null` también si el modelo no tiene vértices.
 */
export function terrainRanges(doc: Pick<ModelDoc, 'regions'>): TerrainRanges | null {
  const range = modelXRange(doc);
  if (!range) return null;
  const tol = extentTol(range);
  const xs = Array.from(new Set(doc.regions.flatMap((r) => r.polygon.map((v) => v[0])).filter(Number.isFinite))).sort((p, q) => p - q);
  const ys = xs.map((x) => terrainY(doc.regions, x, tol));
  const top = Math.max(...ys);
  const yTol = 1e-9 * Math.max(1, Math.abs(top));
  let crown: [number, number] | null = null;
  let start: number | null = null;
  const close = (end: number): void => {
    if (start !== null && end > start && (crown === null || end - start > crown[1] - crown[0])) crown = [start, end];
    start = null;
  };
  for (let i = 0; i < xs.length; i += 1) {
    const x = xs[i] as number;
    if (Math.abs((ys[i] as number) - top) <= yTol) start ??= x;
    else close(xs[i - 1] as number);
  }
  close(xs[xs.length - 1] as number);
  return { terrain: range, crown };
}

/** Texto «x de a a b m» con la unidad del modelo. */
export function rangeText(range: readonly [number, number], unit: string): string {
  return `x de ${formatNumber(range[0])} a ${formatNumber(range[1])} ${unit}`;
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
  /** Modelo constitutivo (F3.2); ausente = `mohr_coulomb`. */
  model?: MaterialModel;
  unit_weight: string;
  unit_weight_sat: string;
  cohesion: string;
  friction_angle: string;
  ru: string;
  /** Su, solo con `undrained`. */
  undrained_strength?: string;
  /** «Su variable con la cota»: la cota de referencia y el gradiente (y el límite, si hay) existen. */
  variable?: boolean;
  strength_datum?: string;
  strength_gradient?: string;
  strength_limit?: string;
}

/** Opciones del selector de modelo constitutivo, con las etiquetas de F3.9. */
export const MATERIAL_MODEL_OPTIONS: ReadonlyArray<{ value: MaterialModel; label: string }> = [
  { value: 'mohr_coulomb', label: 'Mohr-Coulomb' },
  { value: 'undrained', label: 'No drenado (Su)' },
];

export function materialToForm(m: Material): MaterialForm {
  const variable = m.strength_datum !== undefined && m.strength_datum !== null ? true : m.strength_gradient !== undefined && m.strength_gradient !== null;
  return {
    id: m.id,
    name: m.name,
    model: m.model,
    unit_weight: formatNumber(m.unit_weight),
    unit_weight_sat: formatNumber(m.unit_weight_sat),
    cohesion: formatNumber(m.cohesion),
    friction_angle: formatNumber(m.friction_angle),
    ru: formatNumber(m.ru),
    undrained_strength: formatNumber(m.undrained_strength),
    variable,
    strength_datum: formatNumber(m.strength_datum),
    strength_gradient: formatNumber(m.strength_gradient),
    strength_limit: formatNumber(m.strength_limit),
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

/** Su de partida al pasar a «No drenado» desde un material sin cohesión: un valor típico de una arcilla blanda (25 kPa ≈ 500 psf). */
export function defaultUndrainedStrength(units?: string): number {
  return isImperialUnits(units) ? 500 : 25;
}

/** Gradiente de partida de «Su variable con la cota»: 1,5 kPa/m (≈ 10 psf/ft). */
export function defaultStrengthGradient(units?: string): number {
  return isImperialUnits(units) ? 10 : 1.5;
}

/**
 * Formulario de un material nuevo, con valores típicos de un suelo (el usuario los ajusta). Con `units` imperial
 * usa pcf y psf (mismos valores que `materialForLayer` de la importación DXF); sin él, SI.
 */
export function newMaterialForm(existingIds: readonly string[], units?: string): MaterialForm {
  const imperial = isImperialUnits(units);
  const id = nextMaterialId(existingIds);
  return {
    id,
    name: `Material ${id.slice(1)}`,
    model: 'mohr_coulomb',
    unit_weight: imperial ? '115' : '18',
    unit_weight_sat: '',
    cohesion: imperial ? '100' : '5',
    friction_angle: '30',
    ru: '',
    undrained_strength: formatNumber(defaultUndrainedStrength(units)),
    variable: false,
    strength_datum: '',
    strength_gradient: '',
    strength_limit: '',
  };
}

export interface MaterialFormContext {
  /** Ids de los demás materiales del documento (sin contar el que se edita). */
  otherIds: readonly string[];
  /** Material que se edita; `null` = material nuevo. El modelo constitutivo lo da el formulario (`form.model`). */
  editing: Material | null;
}

/**
 * Rangos del motor (strength.rs `resolve_materials`): γ > 0, γsat > 0, ru en [0, 1) y, según el modelo, c ≥ 0 y φ en [0, 90) en
 * Mohr-Coulomb o Su ≥ 0 (con la cota y el gradiente juntos y el límite ≥ 0 opcional) en «No drenado» (F3.2).
 */
export function materialFromForm(form: MaterialForm, ctx: MaterialFormContext): FormOutcome<Material> {
  const errors: FieldErrors = {};
  const model: MaterialModel = form.model ?? 'mohr_coulomb';
  const id = form.id.trim();
  if (id === '') errors.id = RULE_TEXT.materialId;
  else if (ctx.otherIds.includes(id)) errors.id = `Identificador del material: «${id}» ya lo usa otro material; use uno distinto`;

  const unitWeight = take(errors, 'unit_weight', form.unit_weight, {
    required: true,
    missing: RULE_TEXT.unitWeight,
    accept: (v) => finite(v) && v > 0,
    range: RULE_TEXT.unitWeight,
  });
  const unitWeightSat = take(errors, 'unit_weight_sat', form.unit_weight_sat, {
    required: false,
    missing: '',
    accept: (v) => finite(v) && v > 0,
    range: RULE_TEXT.unitWeightSat,
  });
  let cohesion: number | null = null;
  let friction: number | null = null;
  let su: number | null = null;
  let datum: number | null = null;
  let gradient: number | null = null;
  let limit: number | null = null;
  if (model === 'undrained') {
    su = take(errors, 'undrained_strength', form.undrained_strength ?? '', {
      required: true,
      missing: RULE_TEXT.undrainedStrength,
      accept: (v) => finite(v) && v >= 0,
      range: RULE_TEXT.undrainedStrength,
    });
    if (form.variable === true) {
      datum = take(errors, 'strength_datum', form.strength_datum ?? '', {
        required: true,
        missing: RULE_TEXT.strengthDatum,
        accept: finite,
        range: RULE_TEXT.strengthDatum,
      });
      gradient = take(errors, 'strength_gradient', form.strength_gradient ?? '', {
        required: true,
        missing: RULE_TEXT.strengthGradient,
        accept: finite,
        range: RULE_TEXT.strengthGradient,
      });
      limit = take(errors, 'strength_limit', form.strength_limit ?? '', {
        required: false,
        missing: '',
        accept: (v) => finite(v) && v >= 0,
        range: RULE_TEXT.strengthLimit,
      });
    }
  } else {
    cohesion = take(errors, 'cohesion', form.cohesion, {
      required: true,
      missing: RULE_TEXT.cohesion,
      accept: (v) => finite(v) && v >= 0,
      range: RULE_TEXT.cohesion,
    });
    friction = take(errors, 'friction_angle', form.friction_angle, {
      required: true,
      missing: RULE_TEXT.frictionAngle,
      accept: (v) => v >= 0 && v < 90,
      range: RULE_TEXT.frictionAngle,
    });
  }
  const ru = take(errors, 'ru', form.ru, {
    required: false,
    missing: '',
    accept: (v) => v >= 0 && v < 1,
    range: RULE_TEXT.ru,
  });

  return done(errors, () => {
    const base = { id, name: form.name.trim() === '' ? id : form.name.trim(), model, unit_weight: unitWeight ?? 0, unit_weight_sat: unitWeightSat };
    if (model === 'undrained') {
      const out: Material = { ...base, ru, undrained_strength: su ?? 0 };
      if (form.variable === true) {
        out.strength_datum = datum ?? 0;
        out.strength_gradient = gradient ?? 0;
        if (limit !== null) out.strength_limit = limit;
      }
      return out;
    }
    return { ...base, cohesion: cohesion ?? 0, friction_angle: friction ?? 0, ru };
  });
}

/**
 * El mismo material con otro modelo constitutivo (un solo comando `material/upsert`, un solo paso deshacible). De Mohr-Coulomb a «No
 * drenado», Su parte de la cohesión (si es 0, de un valor típico) y se pierden c y φ; de «No drenado» a Mohr-Coulomb, c parte de Su y
 * φ = 0, que da el mismo FS si Su es constante, y se pierde el perfil con la cota. γ, γsat y ru se conservan.
 */
export function switchMaterialModel(material: Material, model: MaterialModel, units?: string): Material {
  if (material.model === model) return material;
  const common = { id: material.id, name: material.name, model, unit_weight: material.unit_weight, unit_weight_sat: material.unit_weight_sat ?? null, ru: material.ru ?? null };
  if (model === 'undrained') {
    const c = material.cohesion;
    return { ...common, undrained_strength: typeof c === 'number' && c > 0 ? c : defaultUndrainedStrength(units) };
  }
  return { ...common, cohesion: material.undrained_strength ?? 0, friction_angle: 0 };
}

/** Cota más alta de las regiones que usan el material (o del modelo, si ninguna); `null` si el modelo no tiene vértices. */
export function materialTopElevation(doc: Pick<ModelDoc, 'regions'>, materialId: string): number | null {
  const own = doc.regions.filter((r) => r.material === materialId);
  const ys = (own.length > 0 ? own : doc.regions).flatMap((r) => r.polygon.map((v) => v[1])).filter(Number.isFinite);
  return ys.length > 0 ? Math.max(...ys) : null;
}

/**
 * «Su variable con la cota»: activarla agrega la cota de referencia (la cota más alta del material) y un gradiente de partida; desactivarla
 * quita la cota, el gradiente y el límite (Su vuelve a ser constante). Un solo comando.
 */
export function setSuVariable(material: Material, on: boolean, doc: Pick<ModelDoc, 'regions' | 'units'>): Material {
  if (material.model !== 'undrained') return material;
  if (!on) {
    const { strength_datum: _d, strength_gradient: _g, strength_limit: _l, ...rest } = material;
    void _d;
    void _g;
    void _l;
    return rest;
  }
  const top = materialTopElevation(doc, material.id);
  return { ...material, strength_datum: top === null ? 0 : round2(top), strength_gradient: defaultStrengthGradient(doc.units) };
}

/** Igualdad de materiales tratando `null` y `undefined` como lo mismo (no genera historial al confirmar sin cambios). */
export function materialsEqual(a: Material, b: Material): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.model === b.model &&
    a.unit_weight === b.unit_weight &&
    (a.unit_weight_sat ?? null) === (b.unit_weight_sat ?? null) &&
    (a.cohesion ?? null) === (b.cohesion ?? null) &&
    (a.friction_angle ?? null) === (b.friction_angle ?? null) &&
    (a.ru ?? null) === (b.ru ?? null) &&
    (a.undrained_strength ?? null) === (b.undrained_strength ?? null) &&
    (a.strength_datum ?? null) === (b.strength_datum ?? null) &&
    (a.strength_gradient ?? null) === (b.strength_gradient ?? null) &&
    (a.strength_limit ?? null) === (b.strength_limit ?? null)
  );
}

export function materialUpsertCommand(material: Material): EditorCommand {
  return { type: 'material/upsert', material };
}

/** Índices de las regiones que usan el material. */
export function materialUsage(doc: Pick<ModelDoc, 'regions'>, materialId: string): number[] {
  const out: number[] = [];
  doc.regions.forEach((r, i) => {
    if (r.material === materialId) out.push(i);
  });
  return out;
}

export function materialRemoveCommand(doc: Pick<ModelDoc, 'regions'>, materialId: string): EditorCommand | null {
  return materialUsage(doc, materialId).length > 0 ? null : { type: 'material/remove', materialId };
}

export function regionMaterialCommand(regionIndex: number, materialId: string): EditorCommand {
  return { type: 'region/setMaterial', regionIndex, materialId };
}

// ───────────────────────── Agua ─────────────────────────

/** Valor por defecto del motor para γw (kN/m³). El motor **no** lo convierte: en un modelo imperial hay que escribir γw. */
export const DEFAULT_WATER_UNIT_WEIGHT = 9.81;
/** γw del agua dulce en pcf, el valor que corresponde escribir en un modelo imperial. */
export const DEFAULT_WATER_UNIT_WEIGHT_IMPERIAL = 62.4;

/** Valor de referencia de γw (para el marcador del campo) según las unidades del modelo. */
export function defaultWaterUnitWeight(units: string | undefined): number {
  return isImperialUnits(units) ? DEFAULT_WATER_UNIT_WEIGHT_IMPERIAL : DEFAULT_WATER_UNIT_WEIGHT;
}

/** Ayuda del campo γw: en imperial avisa de que dejarlo vacío usaría 9,81 (kN/m³), que no es el valor correcto en pcf. */
export function waterUnitWeightHint(units: string | undefined): string {
  return isImperialUnits(units)
    ? 'Escriba 62,4 pcf para agua dulce. Si lo deja vacío, el cálculo usa 9,81 (valor en kN/m³), que no corresponde a pcf.'
    : 'Vacío = se usa 9,81 kN/m³.';
}

/** γw del agua: vacío = omitir (el motor usa 9,81, sin convertir unidades); si no, > 0. */
export function waterUnitWeightFromForm(text: string): FormOutcome<number | undefined> {
  const errors: FieldErrors = {};
  const v = take(errors, 'unit_weight', text, {
    required: false,
    missing: '',
    accept: (n) => finite(n) && n > 0,
    range: RULE_TEXT.waterUnitWeight,
    label: 'Peso unitario del agua γw',
  });
  return done(errors, () => v ?? undefined);
}

/**
 * Comandos que fijan una piezométrica nueva o importada (R9-09): `piezo/set` y, en un modelo imperial sin γw, `water/setUnitWeight` con
 * 62,4 pcf. El motor usaría 9,81 «pcf» si γw faltara y «Comprobar» se bloquea (R8), así que el valor que el campo muestra como marcador
 * se escribe de verdad. Un γw ya indicado no se toca. Despáchelos dentro de un solo gesto para que Deshacer los quite juntos.
 */
export function piezoCreateCommands(doc: ModelDoc, points: Point[]): EditorCommand[] {
  const cmds: EditorCommand[] = [piezoSetCommand(points)];
  const gw = doc.water?.unit_weight;
  if (isImperialUnits(doc.units) && (gw === undefined || gw === null)) cmds.push(waterUnitWeightCommand(DEFAULT_WATER_UNIT_WEIGHT_IMPERIAL));
  return cmds;
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
    const rule = (axis: 'x' | 'y'): NumberRule => ({
      required: true,
      missing: `Línea piezométrica, punto ${i + 1}: falta la coordenada ${axis}`,
      accept: finite,
      range: notANumber(`Línea piezométrica, punto ${i + 1}, coordenada ${axis}`),
      label: `Línea piezométrica, punto ${i + 1}, coordenada ${axis}`,
    });
    return [take(errors, `${i}.x`, row.x, rule('x')), take(errors, `${i}.y`, row.y, rule('y'))];
  });
  if (rows.length < 2) errors.table = RULE_TEXT.piezoMinPoints;
  if (Object.keys(errors).length === 0) {
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1][0] ?? 0;
      const cur = points[i][0] ?? 0;
      if (cur <= prev) {
        errors[`${i}.x`] = `Línea piezométrica, punto ${i + 1}: la coordenada x debe ser mayor que la del punto anterior; ordene los puntos de izquierda a derecha`;
        errors.table = RULE_TEXT.piezoOrder;
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
export function defaultCircle(doc: ModelDoc): CircleSurfaceSpec {
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
  // Una polilínea no tiene centro ni radio: el panel de círculo queda vacío (F3-W1f añade su editor).
  if (surface.type === 'polyline') return { xc: '', yc: '', r: '' };
  return { xc: formatNumber(surface.xc), yc: formatNumber(surface.yc), r: formatNumber(surface.r) };
}

/** Círculo fijo: xc e yc finitos y r > 0 (misma regla que el motor). */
export function circleFromForm(form: CircleForm): FormOutcome<CircleSurfaceSpec> {
  const errors: FieldErrors = {};
  const xc = take(errors, 'xc', form.xc, { required: true, missing: RULE_TEXT.surfaceCenterX, accept: finite, range: RULE_TEXT.surfaceCenterX });
  const yc = take(errors, 'yc', form.yc, { required: true, missing: RULE_TEXT.surfaceCenterY, accept: finite, range: RULE_TEXT.surfaceCenterY });
  const r = take(errors, 'r', form.r, {
    required: true,
    missing: RULE_TEXT.surfaceRadius,
    accept: (v) => finite(v) && v > 0,
    range: RULE_TEXT.surfaceRadius,
  });
  return done(errors, () => ({ type: 'circle', xc: xc ?? 0, yc: yc ?? 0, r: r ?? 1 }));
}

export function circlesEqual(a: SurfaceSpec, b: SurfaceSpec): boolean {
  return a.type !== 'polyline' && b.type !== 'polyline' && a.xc === b.xc && a.yc === b.yc && a.r === b.r;
}

export function surfaceSetCommand(surface: SurfaceSpec | null): EditorCommand {
  return { type: 'surface/set', surface };
}

// ── Polilínea fija (F3.3) ──

/** Forma de la superficie fija guardada: `null` si no hay. */
export function surfaceShape(analysis: Pick<AnalysisSettings, 'surface'>): 'circle' | 'polyline' | null {
  const s = analysis.surface;
  if (s === undefined || s === null) return null;
  return s.type === 'polyline' ? 'polyline' : 'circle';
}

/** Hay una polilínea fija que se analiza (sin búsqueda): con ella Bishop no se ofrece (F3.6). */
export function isFixedPolyline(analysis: Pick<AnalysisSettings, 'surface' | 'search'>): boolean {
  return !analysis.search && analysis.surface?.type === 'polyline';
}

export interface PolylineRow {
  x: string;
  y: string;
}

export function polylineToForm(points: readonly Point[]): PolylineRow[] {
  return points.map(([x, y]) => ({ x: formatNumber(x), y: formatNumber(y) }));
}

/**
 * Tabla → puntos (F3.3, `validate_polyline`): al menos 2 puntos finitos y x estrictamente creciente, con una separación de al menos
 * `1e-9 · ancho del modelo` (`xRange`). Los errores llevan la clave `<fila>.x`, `<fila>.y` o `table`.
 */
export function polylineFromForm(rows: readonly PolylineRow[], ctx: { xRange: readonly [number, number] | null }): FormOutcome<Point[]> {
  const errors: FieldErrors = {};
  const cells = rows.map((row, i) => {
    const label = (axis: 'x' | 'y'): string => `Polilínea, punto ${i + 1}, coordenada ${axis}`;
    const rule = (axis: 'x' | 'y'): NumberRule => ({ required: true, missing: `${label(axis)}: escriba un número`, accept: finite, range: notANumber(label(axis)), label: label(axis) });
    return [take(errors, `${i}.x`, row.x, rule('x')), take(errors, `${i}.y`, row.y, rule('y'))] as const;
  });
  if (rows.length < 2) errors.table = `${RULE_TEXT.polylineMinPoints} (ahora hay ${rows.length})`;
  if (Object.keys(errors).length === 0) {
    const minDx = ctx.xRange ? 1e-9 * (ctx.xRange[1] - ctx.xRange[0]) : 0;
    for (let i = 1; i < cells.length; i += 1) {
      const dx = (cells[i]?.[0] ?? 0) - (cells[i - 1]?.[0] ?? 0);
      if (!(dx > 0 && dx >= minDx)) {
        errors[`${i}.x`] = `Polilínea, punto ${i + 1}: la x debe ser mayor que la del punto anterior; ordene los puntos de izquierda a derecha`;
        errors.table = RULE_TEXT.polylineOrder;
      }
    }
  }
  return done(errors, () => cells.map(([x, y]): Point => [x ?? 0, y ?? 0]));
}

export function polylineSetCommand(points: readonly Point[]): EditorCommand {
  return { type: 'surface/set', surface: { type: 'polyline', points: points.map(([x, y]): Point => [x, y]) } };
}

/**
 * x del punto nuevo entre `a` y `b` (R10B-04a): el medio redondeado a 3 decimales si queda estrictamente dentro, a al menos `minDx` de ambos
 * vecinos; si no, el medio exacto con la misma condición; `null` si no cabe ninguno (el redondeo sacaba antes el punto de `(a, b)`).
 */
function midBetween(a: number, b: number, minDx: number): number | null {
  const inside = (x: number): boolean => x > a && x < b && x - a >= minDx && b - x >= minDx;
  const rounded = round3((a + b) / 2);
  if (inside(rounded)) return rounded;
  const exact = (a + b) / 2;
  return inside(exact) ? exact : null;
}

/** Separación mínima de x entre puntos de la polilínea: `1e-9 · ancho del modelo` (`validate_polyline`); 0 sin modelo. */
function polylineMinDx(xRange?: readonly [number, number] | null): number {
  return xRange ? 1e-9 * (xRange[1] - xRange[0]) : 0;
}

/** Posición `x` del punto nuevo tras el `index` de la polilínea, o `null` si no cabe uno con x estrictamente creciente. */
function polylineInsertX(points: readonly Point[], index: number, xRange?: readonly [number, number] | null): number | null {
  const a = points[index];
  if (!a) return null;
  const minDx = polylineMinDx(xRange);
  const b = points[index + 1];
  if (b) return midBetween(a[0], b[0], minDx);
  const step = xRange ? (xRange[1] - xRange[0]) / 10 : 1;
  const x = round3(a[0] + step);
  return x - a[0] >= Math.max(minDx, Number.MIN_VALUE) ? x : null;
}

/** ¿Cabe un punto nuevo después del `index` de la polilínea sin duplicar ni invertir la x? */
export function canInsertPolylinePoint(points: readonly Point[], index: number, xRange?: readonly [number, number] | null): boolean {
  return polylineInsertX(points, index, xRange) !== null;
}

/**
 * Punto nuevo después del `index`: el punto medio del tramo siguiente (o, tras el último, a la derecha a su misma altura). La forma no cambia y
 * la x queda siempre estrictamente entre las de sus vecinos; si no cabe (`canInsertPolylinePoint`), devuelve la polilínea sin cambios.
 */
export function insertPolylinePoint(points: readonly Point[], index: number, xRange?: readonly [number, number] | null): Point[] {
  const x = polylineInsertX(points, index, xRange);
  const a = points[index];
  if (x === null || !a) return points.map(([px, py]): Point => [px, py]);
  const b = points[index + 1];
  const y = b ? round3((a[1] + b[1]) / 2) : a[1];
  return [...points.slice(0, index + 1), [x, y], ...points.slice(index + 1)];
}

/** Quita el punto `index`; `null` si quedarían menos de 2. */
export function removePolylinePoint(points: readonly Point[], index: number): Point[] | null {
  if (points.length <= 2 || index < 0 || index >= points.length) return null;
  return points.filter((_, i) => i !== index);
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function sameXs(a: readonly PolylineRow[], b: readonly PolylineRow[]): boolean {
  return a.length === b.length && a.every((r, i) => r.x === b[i]?.x);
}

/** Ordena las filas de la tabla por x creciente (las filas con una x que no es un número van al final, en su orden). */
export function sortPolylineRows(rows: readonly PolylineRow[]): PolylineRow[] {
  const keyed = rows.map((row, i) => {
    const p = parseNumber(row.x);
    return { row, i, x: p.kind === 'ok' ? p.value : Number.POSITIVE_INFINITY };
  });
  keyed.sort((p, q) => p.x - q.x || p.i - q.i);
  return keyed.map((k) => k.row);
}

/** La tabla ya está ordenada por x (no hay nada que reordenar). */
export function polylineRowsSorted(rows: readonly PolylineRow[]): boolean {
  return sameXs(rows, sortPolylineRows(rows));
}

/**
 * Polilínea inicial al pasar de círculo a polilínea: admisible **por construcción** (F3.3). Se toman los puntos del arco inferior del círculo
 * (el fijo actual o, si no hay, el de partida) bajo el terreno, entre sus dos cruces con él, con 5 puntos equiespaciados en x **más un punto en
 * cada vértice del terreno** que cae dentro del arco, bajado hasta quedar estrictamente bajo el terreno. Como entre dos puntos consecutivos el
 * terreno es una recta y ambos quedan bajo ella, ninguna cuerda pasa sobre el terreno (la cuerda del círculo pasaba sobre el vértice del pie).
 * El resultado se comprueba con la regla del motor (`fitPolylineToGround`); si aun así no la cumple se densifica (9, 17, 33, 65 puntos) y,
 * como último recurso, se baja cada punto una fracción de la altura. Sin cruces, es la recta de dos puntos que baja del pie a media altura
 * bajo la cresta.
 */
export function initialPolyline(doc: ModelDoc): Point[] {
  const bounds = modelBounds(doc);
  if (!bounds) return [[0, 0], [1, 0]];
  const range: [number, number] = [bounds.xMin, bounds.xMax];
  const tol = extentTol(range);
  const height = Math.max(1, bounds.yMax - bounds.yMin);
  const margin = 1e-6 * height;
  const current = doc.analysis.surface;
  const circle = current && current.type !== 'polyline' ? current : defaultCircle(doc);
  const lower = (x: number): number => circle.yc - Math.sqrt(Math.max(0, circle.r * circle.r - (x - circle.xc) ** 2));
  const under = (x: number): boolean => {
    const t = terrainY(doc.regions, x, tol);
    return Number.isFinite(t) && lower(x) < t - margin;
  };
  // Tramo x donde el arco inferior queda bajo el terreno (dentro del círculo y del modelo).
  const lo = Math.max(range[0], circle.xc - circle.r);
  const hi = Math.min(range[1], circle.xc + circle.r);
  const SAMPLES = 2000;
  let a = Number.NaN;
  let b = Number.NaN;
  for (let k = 0; k <= SAMPLES; k += 1) {
    const x = lo + ((hi - lo) * k) / SAMPLES;
    if (under(x)) {
      if (Number.isNaN(a)) a = x;
      b = x;
    }
  }
  if (Number.isFinite(a) && Number.isFinite(b) && b - a > 1e-6 * (range[1] - range[0])) {
    // Cota del terreno que no se debe alcanzar en x: bajo el lado más bajo de una cara vertical.
    const cap = (x: number, depth: number): number => {
      const g = Math.min(terrainY(doc.regions, x - 2 * tol, tol), terrainY(doc.regions, x + 2 * tol, tol));
      return Number.isFinite(g) ? g - depth : Number.POSITIVE_INFINITY;
    };
    // Vértices del terreno dentro del arco donde cambia la pendiente o hay un escalón (los colineales no hacen falta), excluidos los extremos.
    const pieces = groundPieces(doc.regions);
    const slopeOf = (g: { x0: number; x1: number; y0: number; y1: number }): number => (g.y1 - g.y0) / (g.x1 - g.x0);
    const groundXs = pieces
      .map((g, i) => ({ g, x: g.x1, next: pieces[i + 1] }))
      .filter(({ g, x, next }) => {
        if (x <= a + 1e-6 * (b - a) || x >= b - 1e-6 * (b - a)) return false;
        if (!next) return true;
        const step = Math.abs(next.y0 - g.y1) > tol;
        return step || Math.abs(slopeOf(next) - slopeOf(g)) > 1e-9 * Math.max(1, Math.abs(slopeOf(g)));
      })
      .map(({ x }) => x);
    const floor3 = (v: number): number => Math.floor(v * 1000) / 1000;
    const build = (n: number, depth: number): Point[] => {
      const xs = Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
      const all = [...xs, ...groundXs].sort((p, q) => p - q).filter((x, i, arr) => i === 0 || x - (arr[i - 1] as number) > 1e-6 * (b - a));
      return all.map((x, i): Point => {
        const interior = i > 0 && i < all.length - 1;
        const rx = round3(x);
        // Los extremos van sobre el arco (el motor los prolonga hasta el terreno); los interiores, bajo el terreno y redondeados hacia abajo.
        return interior ? [rx, floor3(Math.min(lower(rx), cap(rx, depth)))] : [rx, round3(lower(x))];
      });
    };
    const admissible = (pts: readonly Point[]): boolean => fitPolylineToGround(doc.regions, pts).ok;
    let first: Point[] | null = null;
    for (const depth of [Math.max(margin, 1e-3), 1e-3 * height, 1e-2 * height]) {
      for (const n of [5, 9, 17, 33, 65]) {
        const pts = build(n, depth);
        first ??= pts;
        if (admissible(pts)) return pts;
      }
    }
    return first ?? [];
  }
  const w = range[1] - range[0];
  const h = bounds.yMax - bounds.yMin;
  return [
    [round2(range[0] + 0.25 * w), round2(bounds.yMin + 0.4 * h)],
    [round2(range[0] + 0.75 * w), round2(bounds.yMin + 0.4 * h)],
  ];
}

/**
 * Comandos para pasar la superficie fija a círculo o a polilínea (un solo paso deshacible). Al pasar a polilínea el círculo se reemplaza por su
 * cuerda (`initialPolyline`) y Bishop, que no se ofrece en superficies no circulares (F3.6), se quita de los métodos; si no queda ninguno se
 * marca Spencer. Al pasar a círculo se pone el círculo de partida.
 */
export function surfaceShapeCommands(doc: ModelDoc, shape: 'circle' | 'polyline'): EditorCommand[] {
  if (surfaceShape(doc.analysis) === shape) return [];
  if (shape === 'circle') return [{ type: 'surface/set', surface: defaultCircle(doc) }];
  const commands: EditorCommand[] = [polylineSetCommand(initialPolyline(doc))];
  const methods = doc.analysis.methods ?? ANALYSIS_DEFAULTS.methods;
  if (methods.includes('bishop')) {
    const rest = methods.filter((m) => m !== 'bishop');
    commands.push({ type: 'analysis/patch', patch: { methods: sortMethods(rest.length > 0 ? rest : ['spencer']) } });
  }
  return commands;
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
    missing: `${SEARCH_RANGE_LABEL[name]}: indique el mínimo y el máximo, o deje ambos vacíos para usar todo el ancho del terreno`,
    accept: finite,
    range: NOT_A_NUMBER,
  };
  const lo = take(errors, `${name}.lo`, form.lo, { ...rule, label: `${SEARCH_RANGE_LABEL[name]}, mínimo` });
  const hi = take(errors, `${name}.hi`, form.hi, { ...rule, label: `${SEARCH_RANGE_LABEL[name]}, máximo` });
  if (lo === null || hi === null) return null;
  if (lo > hi) {
    errors[`${name}.lo`] = rangeOrderText(name, [lo, hi]);
    return null;
  }
  if (xRange && (!insideRange(lo, xRange) || !insideRange(hi, xRange))) {
    errors[`${name}.lo`] = rangeExtentText(name, { min: xRange[0], max: xRange[1] });
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
      missing: searchCountText(field),
      accept: (v) => v >= 1 && v <= MAX_AXIS_POINTS,
      range: searchCountText(field),
      integer: true,
    });
  const nEntry = count('n_entry');
  const nExit = count('n_exit');
  const nRadius = count('n_radius');
  if (nEntry !== null && nExit !== null && nRadius !== null) {
    const candidates = nEntry * nExit * nRadius;
    if (candidates > MAX_GRID_CANDIDATES) {
      errors.n_radius = searchProductText(candidates);
    }
  }
  const factor = take(errors, 'max_radius_factor', form.max_radius_factor, {
    required: true,
    missing: RULE_TEXT.maxRadiusFactor,
    accept: (v) => finite(v) && v > MIN_RADIUS_FACTOR_EXCLUSIVE,
    range: RULE_TEXT.maxRadiusFactor,
  });
  const minWidth = take(errors, 'min_width', form.min_width, {
    required: false,
    missing: '',
    accept: (v) => finite(v) && v >= 0,
    range: RULE_TEXT.minWidth,
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

/** Los cinco métodos, en el orden del panel y de la tabla de resultados. */
export const METHOD_ORDER: readonly MethodKind[] = ['bishop', 'spencer', 'morgenstern_price', 'janbu_simplified', 'janbu_corrected'];
export const METHOD_LABELS: Readonly<Record<MethodKind, string>> = {
  bishop: 'Bishop simplificado',
  spencer: 'Spencer',
  morgenstern_price: 'Morgenstern-Price',
  janbu_simplified: 'Janbu simplificado',
  janbu_corrected: 'Janbu corregido',
};
/** Nombres cortos de los métodos (F3.9), para tablas y espacios estrechos. */
export const METHOD_SHORT_LABELS: Readonly<Record<MethodKind, string>> = {
  bishop: 'Bishop',
  spencer: 'Spencer',
  morgenstern_price: 'M-P',
  janbu_simplified: 'Janbu',
  janbu_corrected: 'Janbu corr.',
};

/** Por qué Bishop no se ofrece con una polilínea fija (F3.6); se muestra siempre que corresponda. */
export const BISHOP_POLYLINE_NOTE =
  'Bishop simplificado no se ofrece en superficies no circulares: con una polilínea su resultado dependería del eje de momentos, que no es un dato físico. Use Spencer, Morgenstern-Price o Janbu.';

/** Motivo por el que un método no se puede marcar con el documento actual, o `null` si se puede. */
export function methodDisabledReason(method: MethodKind, analysis: Pick<AnalysisSettings, 'surface' | 'search'>): string | null {
  return method === 'bishop' && isFixedPolyline(analysis) ? BISHOP_POLYLINE_NOTE : null;
}

// ── Función de fuerzas entre dovelas de Morgenstern-Price (F3.4) ──

/** Funciones de interfaz y sus etiquetas (F3.9). */
export const INTERSLICE_OPTIONS: ReadonlyArray<{ value: IntersliceFunction; label: string }> = [
  { value: 'constant', label: 'Constante' },
  { value: 'half_sine', label: 'Medio seno' },
  { value: 'clipped_sine', label: 'Seno recortado (mín. 0,35)' },
  { value: 'trapezoidal', label: 'Trapezoidal (20 %-80 %)' },
  { value: 'data_points', label: 'Definida por puntos' },
];

/** Tabla de partida de «Definida por puntos»: la forma de un medio seno con tres puntos. */
export const DEFAULT_DATA_POINTS: readonly Point[] = [[0, 0], [0.5, 1], [1, 0]];

/** Función vigente: la de `analysis.interslice` o, sin ella, el medio seno que usa el motor. */
export function intersliceFunctionOf(analysis: Pick<AnalysisSettings, 'interslice'>): IntersliceFunction {
  return analysis.interslice?.function ?? 'half_sine';
}

/** Cambia la función: `data_points` conserva su tabla (o toma la de partida) y las demás no llevan puntos. */
export function intersliceFunctionCommand(doc: ModelDoc, fn: IntersliceFunction): EditorCommand {
  const kept = doc.analysis.interslice?.points;
  const points = Array.isArray(kept) && kept.length >= 2 ? kept.map(([x, f]): Point => [x, f]) : DEFAULT_DATA_POINTS.map(([x, f]): Point => [x, f]);
  return { type: 'analysis/patch', patch: { interslice: fn === 'data_points' ? { function: fn, points } : { function: fn } } };
}

export interface DataPointRow {
  xi: string;
  f: string;
}

export function dataPointsToForm(points: readonly Point[] | null | undefined): DataPointRow[] {
  return (points ?? []).map(([xi, f]) => ({ xi: formatNumber(xi), f: formatNumber(f) }));
}

/**
 * Tabla → puntos (F3.4): al menos 2 puntos finitos, ξ estrictamente creciente de 0 a 1, f ≥ 0 y algún f > 0. Los errores llevan la clave
 * `<fila>.xi`, `<fila>.f` o `table`, con los mismos textos que `validateLocal`.
 */
export function dataPointsFromForm(rows: readonly DataPointRow[]): FormOutcome<Point[]> {
  const errors: FieldErrors = {};
  const cells = rows.map((row, i) => {
    const label = (c: string): string => `Función entre dovelas, punto ${i + 1}, ${c}`;
    const rule = (c: string): NumberRule => ({ required: true, missing: `${label(c)}: escriba un número`, accept: finite, range: notANumber(label(c)), label: label(c) });
    return [take(errors, `${i}.xi`, row.xi, rule('ξ')), take(errors, `${i}.f`, row.f, rule('f'))] as const;
  });
  if (Object.keys(errors).length === 0) {
    const points = cells.map(([xi, f]): Point => [xi ?? 0, f ?? 0]);
    const e = intersliceTableError(points);
    if (e) {
      if (e.index === null) errors.table = e.text;
      else {
        const col = e.text === RULE_TEXT.intersliceNegative ? 'f' : 'xi';
        errors[`${e.index}.${col}`] = e.text;
        errors.table = e.text;
      }
    }
  } else if (rows.length < 2) errors.table = RULE_TEXT.intersliceMinPoints;
  return done(errors, () => cells.map(([xi, f]): Point => [xi ?? 0, f ?? 0]));
}

export function dataPointsCommand(points: readonly Point[]): EditorCommand {
  return { type: 'analysis/patch', patch: { interslice: { function: 'data_points', points: points.map(([x, f]): Point => [x, f]) } } };
}

/** ¿Cabe un punto nuevo entre el `index` y el siguiente de la tabla (ξ, f), con ξ estrictamente creciente? No tras el último (ξ = 1). */
export function canInsertDataPoint(points: readonly Point[], index: number): boolean {
  const a = points[index];
  const b = points[index + 1];
  return a !== undefined && b !== undefined && midBetween(a[0], b[0], 0) !== null;
}

/**
 * Punto nuevo después del `index`: ξ y f a medio camino, así la forma no cambia, con ξ estrictamente entre las de sus vecinos
 * (R10B-04a). Si no cabe (`canInsertDataPoint`), devuelve la tabla sin cambios.
 */
export function insertDataPoint(points: readonly Point[], index: number): Point[] {
  const a = points[index];
  const b = points[index + 1];
  const xi = a && b ? midBetween(a[0], b[0], 0) : null;
  if (!a || !b || xi === null) return points.map(([px, py]): Point => [px, py]);
  return [...points.slice(0, index + 1), [xi, round3((a[1] + b[1]) / 2)], ...points.slice(index + 1)];
}

/** Quita el punto `index`; `null` si quedarían menos de 2. */
export function removeDataPoint(points: readonly Point[], index: number): Point[] | null {
  if (points.length <= 2 || index < 0 || index >= points.length) return null;
  return points.filter((_, i) => i !== index);
}

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
  if (form.methods.length === 0) errors.methods = RULE_TEXT.methodsEmpty;
  const slices = take(errors, 'slices', form.slices, {
    required: true,
    missing: RULE_TEXT.slices,
    accept: (v) => v >= MIN_SLICES && v <= MAX_SLICES,
    range: RULE_TEXT.slices,
    integer: true,
  });
  const tolerance = take(errors, 'tolerance', form.tolerance, {
    required: true,
    missing: RULE_TEXT.tolerance,
    accept: (v) => finite(v) && v > 0 && v <= MAX_TOLERANCE,
    range: RULE_TEXT.tolerance,
  });
  const maxIterations = take(errors, 'max_iterations', form.max_iterations, {
    required: true,
    missing: RULE_TEXT.maxIterations,
    accept: (v) => v >= 1 && v <= MAX_ITERATIONS,
    range: RULE_TEXT.maxIterations,
    integer: true,
  });
  const minMAlpha = take(errors, 'min_m_alpha', form.min_m_alpha, {
    required: true,
    missing: RULE_TEXT.minMAlpha,
    accept: (v) => finite(v) && v > 0 && v <= 1,
    range: RULE_TEXT.minMAlpha,
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
  // `interslice` solo se admite con morgenstern_price (F3.4): al desmarcarlo la función se quita en el mismo paso.
  if (doc.analysis.interslice !== undefined && doc.analysis.interslice !== null && !values.methods.includes('morgenstern_price')) {
    patch.interslice = undefined;
  }
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

/** Valores iniciales de una carga nueva: SI (kPa, kN/m) e imperial (psf, lbf/ft). */
export const DEFAULT_UDL_SI = 10;
export const DEFAULT_LINE_LOAD_SI = 10;
export const DEFAULT_UDL_IMPERIAL = 200;
export const DEFAULT_LINE_LOAD_IMPERIAL = 700;

/** Carga nueva con valores válidos dentro del modelo; `null` si no hay geometría donde situarla. */
export function defaultLoad(type: Load['type'], doc: ModelDoc): Load | null {
  const range = modelXRange(doc);
  if (!range || !(range[1] > range[0])) return null;
  // UX9-03: una carga nueva nace sobre la corona (la mitad central), no sobre el talud; sin corona, en el centro.
  const crown = terrainRanges(doc)?.crown;
  const [lo, hi] = crown && crown[1] > crown[0] ? crown : range;
  const width = hi - lo;
  const id = nextLoadId(doc.loads ?? [], type);
  const [f1, f2] = crown ? [0.25, 0.75] : [0.4, 0.6];
  // R9-09: en imperial 200 psf (≈ 9,6 kPa) y 700 lbf/ft (≈ 10,2 kN/m): el mismo orden de magnitud que los 10 kPa y 10 kN/m del SI.
  const imperial = isImperialUnits(doc.units);
  if (type === 'udl') {
    return { type: 'udl', id, x1: round2(lo + f1 * width), x2: round2(lo + f2 * width), q: imperial ? DEFAULT_UDL_IMPERIAL : DEFAULT_UDL_SI };
  }
  return { type: 'line', id, x: round2(lo + 0.5 * width), p: imperial ? DEFAULT_LINE_LOAD_IMPERIAL : DEFAULT_LINE_LOAD_SI, angle: 0 };
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
  if (id !== '' && ctx.otherIds.includes(id)) errors.id = `Identificador de carga: «${id}» ya lo usa otra carga; use uno distinto`;
  const idPart = id === '' ? {} : { id };
  const inRange = (field: 'x' | 'x1' | 'x2', v: number | null): void => {
    if (v !== null && ctx.xRange && !insideRange(v, ctx.xRange)) {
      errors[field] = loadXText(field, { min: ctx.xRange[0], max: ctx.xRange[1] });
    }
  };
  const xRule = (what: string): NumberRule => ({
    required: true,
    missing: `${what}: falta el valor; escriba un número`,
    accept: finite,
    range: NOT_A_NUMBER,
    label: what,
  });

  if (form.type === 'udl') {
    const x1 = take(errors, 'x1', form.x1, xRule(FIELD_LABEL.x1 as string));
    const x2 = take(errors, 'x2', form.x2, xRule(FIELD_LABEL.x2 as string));
    const q = take(errors, 'q', form.q, {
      required: true,
      missing: `${FIELD_LABEL.q}: falta el valor; use un número igual o mayor que 0`,
      accept: (v) => finite(v) && v >= 0,
      range: RULE_TEXT.loadQ,
    });
    if (x1 !== null && x2 !== null && x1 >= x2) errors.x1 = RULE_TEXT.udlOrder;
    else {
      if (!errors.x1) inRange('x1', x1);
      if (!errors.x2) inRange('x2', x2);
    }
    return done(errors, (): Load => ({ type: 'udl', ...idPart, x1: x1 ?? 0, x2: x2 ?? 0, q: q ?? 0 }));
  }

  const x = take(errors, 'x', form.x, xRule(FIELD_LABEL.x as string));
  const p = take(errors, 'p', form.p, {
    required: true,
    missing: `${FIELD_LABEL.p}: falta el valor; use un número igual o mayor que 0`,
    accept: (v) => finite(v) && v >= 0,
    range: RULE_TEXT.loadP,
  });
  const angle = take(errors, 'angle', form.angle, {
    required: true,
    missing: `${FIELD_LABEL.angle}: falta el valor; use un número entre −90 y 90`,
    accept: (v) => v >= -90 && v <= 90,
    range: RULE_TEXT.loadAngle,
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
  udl: 'Distribuida',
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
    range: RULE_TEXT.kh,
  });
  const kv = take(errors, 'kv', form.kv, {
    required: false,
    missing: '',
    accept: (v) => v > -1 && v < 1,
    range: RULE_TEXT.kv,
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
 * `/water/piezometric_line/k` → punto de la piezométrica; `/analysis/surface[/…]` → círculo (con una polilínea, `/analysis/surface/points/k` → su vértice k);
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
  if (a === 'analysis' && b === 'surface') {
    // R10B-11: con una polilínea, `/analysis/surface/points/k` es el vértice k; sin índice no hay un elemento que seleccionar (y nunca un círculo).
    const surface = doc.analysis.surface;
    if (surface && surface.type === 'polyline') {
      const k = c === 'points' ? toIndex(d) : null;
      return k !== null && k < surface.points.length ? { kind: 'surface_vertex', index: k } : { kind: 'none' };
    }
    return { kind: 'surface_circle' };
  }
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
