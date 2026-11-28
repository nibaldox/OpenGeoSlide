// Modelo puro del armazón A «Flujo de trabajo» (UA1-M).
// Resumen y estado de cada paso de la barra lateral, chip de estado de la cabecera, FS mínimo del HUD y contenido
// del informe. Lógica pura, probada en Node. Las firmas son contrato (briefs/UA_CONTRATO.md §4.1).

import { convergedFos } from '../../analysis/runner';
import type { EngineStatus } from '../../engine/client';
import type { AnalysisReport, MethodKind } from '../../engine/types';
import { materialModelLabel } from '../../render/scene';
import { pondSummary } from '../../report/crackReport';
import { reinforcementsOf } from '../../report/reinforcementReport';
import { formatFs } from '../../ui/formatFs';
import { METHOD_ORDER, METHOD_SHORT_LABELS } from '../panels/forms';
import { REINFORCEMENT_TYPES, REINFORCEMENT_TYPE_LABELS } from '../panels/reinforcementForm';
import { UNIT_FACTORS, WATER_UNIT_WEIGHT_SI, isImperialUnits } from '../state/units';
import type { Issue, ModelDoc } from '../types';
import { issueTargetFor, type PanelTabId } from './issueNav';
import type { EngineRun } from './reportInput';

/** Orden de los pasos de la barra lateral (el mismo de las pestañas actuales). */
export const STEP_ORDER: readonly PanelTabId[] = [
  'geometry',
  'materials',
  'water',
  'surface',
  'search',
  'analysis',
  'loads',
  'reinforcements',
  'seismic',
  'project',
];

/**
 * Estado de un paso:
 * - `done`: completo y sin errores locales;
 * - `error`: alguna incidencia local de severidad `error` apunta a este paso;
 * - `draft`: tiene un borrador sin aplicar (gana sobre `done`, pierde frente a `error`);
 * - `warn`: alguna incidencia local de severidad `aviso` apunta a este paso (UA-E3 §4; gana sobre `empty`, `optional` y `done`);
 * - `optional`: paso opcional vacío (sin agua, sin búsqueda activa, sin cargas, sin refuerzos, sin sismo, sin título);
 * - `empty`: paso obligatorio vacío (sin regiones, sin materiales).
 */
export type StepStatus = 'done' | 'error' | 'draft' | 'warn' | 'optional' | 'empty';

export interface StepState {
  /** Una línea, ≤ 40 caracteres, con unidades y coma decimal. Nunca vacía: «—» o «Ninguno» si no hay nada. */
  summary: string;
  status: StepStatus;
  /** Incidencias locales de severidad `error` que apuntan a este paso. */
  errorCount: number;
}

// ───────── Formato (coma decimal y miles con punto, `Intl` con `es`) ─────────

const MAX_CHARS = 40;
const ELLIPSIS = '…';

const decimalFormats = new Map<string, Intl.NumberFormat>();

/**
 * Número con coma decimal (de `Intl` con `es`) entre `min` y `max` decimales y miles con punto desde 1.000: el «es» de `Intl` no
 * agrupa los de cuatro cifras, así que el agrupado se pone aparte, sin depender del ICU del entorno.
 */
function num(value: number, min = 0, max = min): string {
  const key = `${min}:${max}`;
  let f = decimalFormats.get(key);
  if (!f) {
    f = new Intl.NumberFormat('es', { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: false });
    decimalFormats.set(key, f);
  }
  return f.format(value).replace(/^(-?\d+)/, (int) => int.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
}

const count = (n: number, one: string, many: string): string => `${num(n)} ${n === 1 ? one : many}`;

/** Recorta en el límite de una palabra (o en el carácter, si no hay ninguno razonable) y añade la elipsis. */
function clip(text: string, max = MAX_CHARS): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  const space = head.lastIndexOf(' ');
  return `${(space >= Math.floor(max / 2) ? head.slice(0, space) : head).replace(/[\s,;:]+$/, '')}${ELLIPSIS}`;
}

/** La primera forma (de la más completa a la más corta) que cabe en 40 caracteres; si ninguna cabe, la última, recortada. */
function fit(...forms: string[]): string {
  return forms.find((f) => f.length <= MAX_CHARS) ?? clip(forms[forms.length - 1] ?? '—');
}

// ───────── Borradores → paso ─────────

/**
 * Paso al que pertenece un borrador pendiente. `getPendingDrafts(store)` devuelve las **etiquetas** que cada panel pasa a
 * `setPendingDraft(store, clave, etiqueta)` (no las claves), así que se reconocen las dos formas:
 *
 * | Paso | Clave | Etiqueta | Panel |
 * |---|---|---|---|
 * | geometry | `geometry:<región>:<vértice>` | `Vértice n (x, y) de la región m` | GeometryPanel |
 * | materials | `material:<id>`, `material:new` | `Material <id>`, `Material nuevo` | MaterialsPanel |
 * | water | `water:unit_weight`, `water:piezometric_line` | `Agua: peso unitario γw`, `Agua: línea piezométrica` | WaterPanel |
 * | surface | `surface:polyline`, `surface:circle` | `Superficie fija: polilínea`, `Superficie fija: círculo` | SurfacePanel |
 * | search | `search` | `Búsqueda` | SearchPanel |
 * | analysis | `analysis`, `analysis:interslice`, `analysis:crack` | `Análisis`, `Función entre dovelas`, `Grieta de tracción` | AnalysisPanel |
 * | loads | `load:<i>` | `Carga n` | LoadsPanel |
 * | reinforcements | `reinforcement:<i>` | `Refuerzo n` | ReinforcementsPanel |
 * | seismic | `seismic` | `Sismo` | SeismicPanel |
 *
 * `project` no registra borradores (ProjectPanel no llama a `setPendingDraft`). Una entrada desconocida no corresponde a ningún paso.
 */
const DRAFT_RULES: ReadonlyArray<readonly [RegExp, PanelTabId]> = [
  [/^(geometry:|Vértice )/, 'geometry'],
  [/^(material:|Material( |$))/, 'materials'],
  [/^(water:|Agua: )/, 'water'],
  [/^(surface:|Superficie fija: )/, 'surface'],
  [/^(search$|Búsqueda$)/, 'search'],
  [/^(analysis(:|$)|Análisis$|Función entre dovelas$|Grieta de tracción$)/, 'analysis'],
  [/^(load:|Carga )/, 'loads'],
  [/^(reinforcement:|Refuerzo )/, 'reinforcements'],
  [/^(seismic$|Sismo$)/, 'seismic'],
];

/** Paso de un borrador pendiente (clave o etiqueta de `setPendingDraft`), o `null` si no corresponde a ninguno. */
export function draftStep(draft: string): PanelTabId | null {
  return DRAFT_RULES.find(([re]) => re.test(draft))?.[1] ?? null;
}

// ───────── Resúmenes ─────────

/** Resumen y estado de base del paso (sin errores ni borradores): `done` si tiene contenido; si no, `empty` u `optional`. */
type Summary = { summary: string; base: 'done' | 'empty' | 'optional' };

/** Área de la región por la fórmula del topógrafo; una con coordenadas no finitas no suma. */
function regionArea(polygon: readonly (readonly [number, number])[]): number {
  if (polygon.length < 3 || polygon.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return 0;
  let twice = 0;
  polygon.forEach(([x1, y1], i) => {
    const [x2, y2] = polygon[(i + 1) % polygon.length] as readonly [number, number];
    twice += x1 * y2 - x2 * y1;
  });
  return Math.abs(twice) / 2;
}

/** Sin decimales desde 100 (redondeado), uno por debajo. */
const areaText = (area: number): string => (Math.round(area * 10) / 10 >= 100 ? num(area, 0) : num(area, 1));

function geometrySummary(doc: ModelDoc, u: { length: string }): Summary {
  const regions = doc.regions ?? [];
  if (regions.length === 0) return { summary: 'Sin regiones', base: 'empty' };
  const vertices = regions.reduce((n, r) => n + r.polygon.length, 0);
  const area = `${areaText(regions.reduce((n, r) => n + regionArea(r.polygon), 0))} ${u.length}²`;
  const r = count(regions.length, 'región', 'regiones');
  return { summary: fit(`${r} · ${count(vertices, 'vértice', 'vértices')} · ${area}`, `${r} · ${area}`, r), base: 'done' };
}

function materialsSummary(doc: ModelDoc): Summary {
  const materials = doc.materials ?? [];
  if (materials.length === 0) return { summary: 'Sin materiales', base: 'empty' };
  const models = (['mohr_coulomb', 'undrained', 'hoek_brown', 'shansep'] as const).filter((m) => materials.some((x) => (x.model ?? 'mohr_coulomb') === m));
  const n = count(materials.length, 'material', 'materiales');
  return {
    summary: fit(`${n} · ${models.map((m) => materialModelLabel(m)).join(', ')}`, `${n} · ${count(models.length, 'modelo', 'modelos')}`, n),
    base: 'done',
  };
}

/**
 * B-06: el agua no es solo la piezométrica. Sin línea, la grieta de tracción con agua (`water_fill > 0`) usa γw (el mismo criterio que
 * `waterUnitWeightText` del informe) y una `ru > 0` en algún material pesa en el cálculo sin piezométrica: ninguna de las dos es «sin agua».
 */
function waterSummary(doc: ModelDoc): Summary {
  const points = doc.water?.piezometric_line?.length ?? 0;
  if (points > 0) return { summary: `Piezométrica · ${count(points, 'punto', 'puntos')}`, base: 'done' };
  const fill = doc.analysis?.tension_crack?.water_fill;
  if (typeof fill === 'number' && fill > 0) {
    const explicit = doc.water?.unit_weight;
    const gamma = typeof explicit === 'number' && Number.isFinite(explicit) ? explicit : isImperialUnits(doc.units) ? Number((WATER_UNIT_WEIGHT_SI * UNIT_FACTORS.unitWeight).toFixed(2)) : WATER_UNIT_WEIGHT_SI;
    return { summary: `Agua en grieta · γw ${num(gamma, 0, 3)}`, base: 'done' };
  }
  const withRu = (doc.materials ?? []).filter((m) => typeof m.ru === 'number' && m.ru > 0).length;
  if (withRu > 0) return { summary: `Sin piezométrica · ru en ${num(withRu)} mat.`, base: 'done' };
  return { summary: 'Sin piezométrica', base: 'optional' };
}

function surfaceSummary(doc: ModelDoc): Summary {
  const a = doc.analysis;
  // Con búsqueda, la superficie fija se ignora (misma regla que `issueTargetFor`).
  if (a?.search) return { summary: a.search.non_circular ? 'Búsqueda no circular' : 'Búsqueda circular', base: 'done' };
  if (a?.surface?.type === 'circle') return { summary: 'Circular fija', base: 'done' };
  if (a?.surface?.type === 'polyline') return { summary: `Polilínea fija · ${count(a.surface.points.length, 'punto', 'puntos')}`, base: 'done' };
  return { summary: 'Sin superficie', base: 'empty' };
}

function searchSummary(doc: ModelDoc, u: { length: string }): Summary {
  const s = doc.analysis?.search;
  if (!s) return { summary: 'Inactiva', base: 'optional' };
  const range = (r: readonly [number, number] | null | undefined): string | null => {
    if (!r) return null;
    // B-12(c): con algún extremo negativo, «a» y el signo menos tipográfico (−25,5 a −10,2); sin negativos, la semirraya de siempre.
    const negative = r[0] < 0 || r[1] < 0;
    const text = (n: number): string => (negative ? num(n, 0, 2).replace(/^-/, '\u2212') : num(n, 0, 2));
    return `${text(r[0])}${negative ? ' a ' : '–'}${text(r[1])}`;
  };
  const entry = range(s.entry);
  const exit = range(s.exit);
  if (entry === null && exit === null) return { summary: 'Entrada y salida automáticas', base: 'done' };
  const l = u.length;
  // B-09: cada rango definido lleva su unidad en todas las formas; «auto.» no es un número y no la necesita.
  return {
    summary: fit(
      `${entry ? `Entrada ${entry} ${l}` : 'Entrada automática'} · ${exit ? `salida ${exit} ${l}` : 'salida automática'}`,
      `${entry ? `Ent. ${entry} ${l}` : 'Ent. auto.'} · ${exit ? `sal. ${exit} ${l}` : 'sal. auto.'}`,
      `${entry ? `${entry} ${l}` : 'auto.'} · ${exit ? `${exit} ${l}` : 'auto.'}`,
    ),
    base: 'done',
  };
}

function analysisSummary(doc: ModelDoc): Summary {
  const a = doc.analysis;
  const requested = a?.methods ?? ['bishop'];
  const methods = METHOD_ORDER.filter((m) => requested.includes(m));
  const slices = count(a?.slices ?? 50, 'dovela', 'dovelas');
  if (methods.length === 0) return { summary: 'Sin métodos', base: 'empty' };
  return {
    summary: fit(`${methods.map((m) => METHOD_SHORT_LABELS[m]).join(' · ')} · ${slices}`, `${count(methods.length, 'método', 'métodos')} · ${slices}`, slices),
    base: 'done',
  };
}

function loadsSummary(doc: ModelDoc): Summary {
  const loads = doc.loads ?? [];
  if (loads.length === 0) return { summary: 'Sin cargas', base: 'optional' };
  const udl = loads.filter((l) => l.type === 'udl').length;
  const line = loads.length - udl;
  const parts = [udl > 0 ? count(udl, 'distribuida', 'distribuidas') : null, line > 0 ? count(line, 'lineal', 'lineales') : null].filter((p): p is string => p !== null);
  return { summary: fit(parts.join(' · '), count(loads.length, 'carga', 'cargas')), base: 'done' };
}

function reinforcementsSummary(doc: ModelDoc): Summary {
  const list = doc.reinforcements ?? [];
  if (list.length === 0) return { summary: 'Sin refuerzos', base: 'optional' };
  const byType = REINFORCEMENT_TYPES.map((t) => [t, list.filter((r) => r.type === t).length] as const)
    .filter(([, n]) => n > 0)
    .map(([t, n]) => {
      const name = REINFORCEMENT_TYPE_LABELS[t].toLowerCase();
      return count(n, name, `${name}s`);
    });
  return { summary: fit(byType.join(' · '), count(list.length, 'refuerzo', 'refuerzos')), base: 'done' };
}

function seismicSummary(doc: ModelDoc): Summary {
  const s = doc.analysis?.seismic;
  const kh = s?.kh ?? 0;
  const kv = s?.kv ?? 0;
  if (!Number.isFinite(kh) || !Number.isFinite(kv) || (kh === 0 && kv === 0)) return { summary: 'Sin sismo', base: 'optional' };
  // B-12(b): un coeficiente no nulo que redondea a 0,000 no se escribe «0,00» (parece sin sismo): «< 0,001».
  const coef = (label: string, v: number): string => (v !== 0 && Math.abs(v) < 0.0005 ? `${label} ${v > 0 ? '<' : '>'} ${v < 0 ? '\u2212' : ''}0,001` : `${label} ${num(v, 2, 3)}`);
  return { summary: fit(`${coef('kh', kh)} · ${coef('kv', kv)}`, coef('kh', kh)), base: 'done' };
}

function projectSummary(doc: ModelDoc): Summary {
  const title = (doc.meta?.title ?? '').replace(/\s+/g, ' ').trim();
  const suffix = ` · ${isImperialUnits(doc.units) ? 'imperial' : 'SI'}`;
  // El título cede espacio al sufijo: se recorta él, nunca el sistema de unidades.
  return { summary: `${clip(title === '' ? 'Sin título' : title, MAX_CHARS - suffix.length)}${suffix}`, base: title === '' ? 'optional' : 'done' };
}

/**
 * Resumen y estado de los diez pasos. `issues` es la salida de `validateLocal(doc)`; `pendingDrafts`, la de
 * `getPendingDrafts(store)`.
 */
export function stepStates(doc: ModelDoc, issues: readonly Issue[], pendingDrafts: readonly string[]): Record<PanelTabId, StepState> {
  const u = { length: isImperialUnits(doc.units) ? 'ft' : 'm' };
  const summaries: Record<PanelTabId, Summary> = {
    geometry: geometrySummary(doc, u),
    materials: materialsSummary(doc),
    water: waterSummary(doc),
    surface: surfaceSummary(doc),
    search: searchSummary(doc, u),
    analysis: analysisSummary(doc),
    loads: loadsSummary(doc),
    reinforcements: reinforcementsSummary(doc),
    seismic: seismicSummary(doc),
    project: projectSummary(doc),
  };
  const errors = new Map<PanelTabId, number>();
  const advised = new Set<PanelTabId>();
  for (const issue of issues) {
    if (issue.severity !== 'error' && issue.severity !== 'aviso') continue;
    const tab = issueTargetFor(issue, doc)?.tab ?? null;
    if (tab === null) continue;
    if (issue.severity === 'error') errors.set(tab, (errors.get(tab) ?? 0) + 1);
    else advised.add(tab);
  }
  const drafted = new Set(pendingDrafts.map(draftStep));
  const out = {} as Record<PanelTabId, StepState>;
  for (const id of STEP_ORDER) {
    const { summary, base } = summaries[id];
    const errorCount = errors.get(id) ?? 0;
    // Precedencia (UA-E3 §4): error › borrador › aviso › vacío / opcional › hecho.
    const status: StepStatus = errorCount > 0 ? 'error' : drafted.has(id) ? 'draft' : advised.has(id) ? 'warn' : base;
    out[id] = { summary, status, errorCount };
  }
  return out;
}

/** Tono del chip de estado (solo comunica estado; el acento solo para «calculando»). */
export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'nok';

export interface RunStatusInput {
  engineStatus: EngineStatus;
  busy: boolean;
  /** Último cálculo correcto, de esta revisión o de una anterior. */
  run: EngineRun | null;
  /** `run` corresponde a la revisión actual. */
  current: boolean;
  /** Número de borradores sin aplicar. */
  pendingDrafts: number;
  /** El modelo tiene al menos una región. */
  hasRegions: boolean;
  /** Incidencias locales de severidad `error`. */
  localErrors: number;
  /** Número de métodos pedidos en `analysis.methods`. */
  methodsRequested: number;
  /** Último mensaje de `useEngineCheck` (`message`, `messageKind`). */
  message: string | null;
  messageKind: 'error' | 'info';
  /**
   * UA-E3: avisos vigentes (incidencias locales de severidad `aviso` más avisos de severidad `aviso` del cálculo
   * actual). Opcional; por omisión 0.
   */
  advisories?: number;
}

export interface RunStatus {
  tone: Tone;
  /** Texto corto, una línea, ≤ 40 caracteres. */
  text: string;
  /** Texto completo (atributo `title`), igual a `text` si no hay más que decir. */
  title: string;
}

const methodNames = (methods: readonly MethodKind[]): string => methods.map((m) => METHOD_SHORT_LABELS[m]).join(', ');

/** Añade « · N avisos» al texto del chip si cabe en 40 caracteres (UA-E3 §5: «+ N avisos si cabe»). */
function withAdvisories(text: string, advisories: number): string {
  if (advisories <= 0) return text;
  const full = `${text} · ${count(advisories, 'aviso', 'avisos')}`;
  return full.length <= MAX_CHARS ? full : text;
}

/** `title` = el texto, el detalle que no cabe y, si el texto no lo lleva, el número de avisos (UA-E3 §5). */
function titled(tone: Tone, text: string, details: readonly string[], advisories: number, advisoriesInText: boolean): RunStatus {
  const parts = [text, ...details.filter((d) => d !== '')];
  if (advisories > 0 && !advisoriesInText) parts.push(`Avisos: ${num(advisories)}`);
  const title = parts.reduce((acc, part) => `${acc.endsWith('.') ? acc : `${acc}.`} ${part}`);
  return { tone, text, title: parts.length > 1 ? title : text };
}

/**
 * Chip de estado de la cabecera (contrato §4.1 con las filas de «resultado actual» de UA-E3 §5): el estado no juzga la
 * aceptabilidad del talud, así que el tono `ok` no se usa. Un resultado con borradores pendientes nunca es actual.
 */
export function runStatus(input: RunStatusInput): RunStatus {
  const same = (tone: Tone, text: string): RunStatus => ({ tone, text, title: text });
  if (input.engineStatus === 'loading') return same('neutral', 'Cargando el motor…');
  if (input.engineStatus === 'failed') return same('nok', 'Motor no disponible');
  if (input.busy) {
    const n = input.methodsRequested;
    return same('accent', n > 0 ? `Calculando ${count(n, 'método', 'métodos')}…` : 'Calculando…');
  }
  if (!input.hasRegions) return same('neutral', 'Sin modelo');
  // A-02 y B-01: con borradores sin aplicar el cálculo ya no corresponde a lo que hay en pantalla.
  const run = input.run !== null && input.current && input.pendingDrafts === 0 ? input.run : null;
  const message = input.message?.replace(/\s+/g, ' ').trim() ?? '';
  if (message !== '' && input.messageKind === 'error' && run === null) {
    const full = `Error: ${message}`;
    return { tone: 'nok', text: full.length <= MAX_CHARS ? full : `${full.slice(0, MAX_CHARS - 1).trimEnd()}${ELLIPSIS}`, title: full };
  }
  if (run !== null) {
    const advisories = Number.isFinite(input.advisories) ? Math.max(0, Math.trunc(input.advisories ?? 0)) : 0;
    const fs = fsMinimum(run.report);
    const failed = run.report.results.filter((r) => convergedFos(r) === null || !Number.isFinite(convergedFos(r))).map((r) => r.method);
    const notConverged = failed.length > 0 ? `No convergieron: ${methodNames(failed).replace(/\.?$/, '.')}` : ''; // «Janbu corr.» ya lleva su punto
    const out = (tone: Tone, base: string, details: readonly string[]): RunStatus => {
      const text = withAdvisories(base, advisories);
      return titled(tone, text, details, advisories, text !== base);
    };
    if (fs.converged === 0) return out('warn', 'Sin convergencia', notConverged === '' ? [] : [notConverged]);
    const minimum = `FS mínimo ${fs.text} (${methodNames(fs.methods)})`;
    if (fs.converged < fs.total) {
      const part = `${fs.converged} de ${fs.total}`;
      if (fs.below1) return out('nok', `Parcial · ${part} · FS < 1,0`, [minimum, notConverged]);
      return out('warn', `Parcial · ${part} métodos`, [notConverged]);
    }
    if (fs.below1) return out('nok', 'Calculado · FS < 1,0', [minimum]);
    return out(advisories > 0 ? 'warn' : 'neutral', `Calculado · FS mín. ${fs.text}`, [minimum]);
  }
  if (input.run !== null) return same('warn', input.pendingDrafts > 0 ? 'Cambios sin aplicar' : 'Resultados desactualizados');
  if (input.localErrors > 0) return same('warn', `Modelo con ${count(input.localErrors, 'problema', 'problemas')}`);
  if (input.pendingDrafts > 0) return same('warn', 'Cambios sin aplicar');
  return same('neutral', 'Listo para calcular');
}

export interface FsMinimum {
  /** Mínimo de los FS de los métodos que convergieron; `null` si ninguno convergió. */
  value: number | null;
  /** «0,984» (`fsText`) o «—». */
  text: string;
  /** Métodos que dan el mínimo (empates incluidos), en el orden del informe. */
  methods: MethodKind[];
  /** `value < 1`. */
  below1: boolean;
  /** Métodos que convergieron y métodos calculados. */
  converged: number;
  total: number;
}

/**
 * FS con 3 decimales y coma (`formatFs`), salvo en [0,9995, 1): ahí 3 decimales dan «1,000», que junto al chip «FS < 1,0» se contradice
 * (B-12a). Se escribe con 4 decimales truncados («0,9997»), para que nunca llegue a «1,0000».
 */
export function fsText(value: number | null | undefined): string {
  const text = formatFs(value);
  if (typeof value !== 'number' || !(value < 1) || text !== formatFs(1)) return text;
  return num(Math.floor(Number((value * 1e4).toFixed(6))) / 1e4, 4);
}

/** FS mínimo del HUD: el menor FS finito de los métodos que convergieron (el de uno que no convergió no es un resultado). */
export function fsMinimum(report: AnalysisReport): FsMinimum {
  const usable = report.results.flatMap((r) => {
    const fos = convergedFos(r);
    return fos !== null && Number.isFinite(fos) ? [{ method: r.method, fos }] : [];
  });
  const total = report.results.length;
  if (usable.length === 0) return { value: null, text: '—', methods: [], below1: false, converged: 0, total };
  const value = Math.min(...usable.map((u) => u.fos));
  const text = fsText(value);
  return { value, text, methods: usable.filter((u) => fsText(u.fos) === text).map((u) => u.method), below1: value < 1, converged: usable.length, total };
}

export interface ReportContentItem {
  /** «Geometría y materiales», «Resultados por método», «Dovelas de la superficie crítica»… */
  label: string;
  included: boolean;
}

/**
 * Secciones que `buildReportContent` (`report/content.ts`) puede producir con la entrada del editor, en su orden, con el título que
 * lleva el PDF (`report/pdf.ts` solo las dibuja). `checks` («Comprobaciones frente a valores publicados») no está: `buildReportInput`
 * siempre pasa `checks: []`, así que el informe del editor nunca la lleva.
 */
const REPORT_SECTIONS: ReadonlyArray<{ id: string; label: string; included: (model: ModelDoc) => boolean }> = [
  { id: 'cover', label: 'Portada', included: () => true },
  { id: 'model', label: 'Datos del modelo', included: () => true },
  { id: 'materials', label: 'Materiales', included: () => true },
  { id: 'section', label: 'Sección analizada', included: () => true },
  { id: 'results', label: 'Factor de seguridad por método', included: () => true },
  // `crackSection`: solo con grieta de tracción en el modelo o con agua embalsada sobre el terreno.
  { id: 'crack', label: 'Grieta de tracción y agua embalsada', included: (m) => Boolean(m.analysis?.tension_crack) || pondSummary(m) !== null },
  // `reinforcementsSection`: solo con refuerzos.
  { id: 'reinforcements', label: 'Refuerzos', included: (m) => reinforcementsOf(m).length > 0 },
  { id: 'warnings', label: 'Avisos y notas', included: () => true },
  { id: 'engine', label: 'Versión del motor y advertencia', included: () => true },
];

/** Lista de lo que incluirá el informe PDF con el cálculo actual (vista «Informe»). `run` nulo: lista vacía. */
export function reportContents(run: EngineRun | null): ReportContentItem[] {
  if (run === null) return [];
  return REPORT_SECTIONS.map((section) => ({ label: section.label, included: section.included(run.doc) }));
}
