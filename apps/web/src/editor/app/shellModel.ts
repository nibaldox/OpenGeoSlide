// UA0 (congelado por el coordinador): modelo puro del armazón A «Flujo de trabajo».
// Resumen y estado de cada paso de la barra lateral, chip de estado de la cabecera, FS mínimo del HUD y contenido
// del informe. Lógica pura, probada en Node. Las firmas son contrato (briefs/UA_CONTRATO.md §4.1): el escritor UA1-M
// rellena las implementaciones; los demás escritores solo importan. Hasta entonces, estas implementaciones neutras
// devuelven valores plausibles para que los consumidores compilen y se vean.

import type { EngineStatus } from '../../engine/client';
import type { AnalysisReport, MethodKind } from '../../engine/types';
import type { Issue, ModelDoc } from '../types';
import type { PanelTabId } from './issueNav';
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
 * - `optional`: paso opcional vacío (sin agua, sin búsqueda activa, sin cargas, sin refuerzos, sin sismo, sin título);
 * - `empty`: paso obligatorio vacío (sin regiones, sin materiales).
 */
export type StepStatus = 'done' | 'error' | 'draft' | 'optional' | 'empty';

export interface StepState {
  /** Una línea, ≤ 40 caracteres, con unidades y coma decimal. Nunca vacía: «—» o «Ninguno» si no hay nada. */
  summary: string;
  status: StepStatus;
  /** Incidencias locales de severidad `error` que apuntan a este paso. */
  errorCount: number;
}

/**
 * Resumen y estado de los diez pasos. `issues` es la salida de `validateLocal(doc)`; `pendingDrafts`, la de
 * `getPendingDrafts(store)`.
 */
export function stepStates(doc: ModelDoc, issues: readonly Issue[], pendingDrafts: readonly string[]): Record<PanelTabId, StepState> {
  void doc;
  void issues;
  void pendingDrafts;
  const out = {} as Record<PanelTabId, StepState>;
  for (const id of STEP_ORDER) out[id] = { summary: '—', status: 'optional', errorCount: 0 };
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
}

export interface RunStatus {
  tone: Tone;
  /** Texto corto, una línea, ≤ 40 caracteres. */
  text: string;
  /** Texto completo (atributo `title`), igual a `text` si no hay más que decir. */
  title: string;
}

/** Chip de estado de la cabecera (contrato §4.1, tabla de estados). */
export function runStatus(input: RunStatusInput): RunStatus {
  if (input.busy) return { tone: 'accent', text: 'Calculando…', title: 'Calculando…' };
  if (input.run && input.current) return { tone: 'ok', text: 'Calculado', title: 'Calculado' };
  return { tone: 'neutral', text: 'Listo para calcular', title: 'Listo para calcular' };
}

export interface FsMinimum {
  /** Mínimo de los FS de los métodos que convergieron; `null` si ninguno convergió. */
  value: number | null;
  /** «0,984» (`formatFs`) o «—». */
  text: string;
  /** Métodos que dan el mínimo (empates incluidos), en el orden del informe. */
  methods: MethodKind[];
  /** `value < 1`. */
  below1: boolean;
  /** Métodos que convergieron y métodos calculados. */
  converged: number;
  total: number;
}

/** FS mínimo del HUD. */
export function fsMinimum(report: AnalysisReport): FsMinimum {
  return { value: null, text: '—', methods: [], below1: false, converged: 0, total: report.results.length };
}

export interface ReportContentItem {
  /** «Geometría y materiales», «Resultados por método», «Dovelas de la superficie crítica»… */
  label: string;
  included: boolean;
}

/** Lista de lo que incluirá el informe PDF con el cálculo actual (vista «Informe»). `run` nulo: lista vacía. */
export function reportContents(run: EngineRun | null): ReportContentItem[] {
  void run;
  return [];
}
