// Entradas del informe y exportaciones CSV a partir del último cálculo. Lógica pura (sin React ni DOM).

import { polylineSurfaceRows, reinforcementForcesToCsv, resultsToCsv, surfaceToCsv, type CsvCell } from '../../io/csv';
import { forceRecords } from '../../report/reinforcementReport';
import { baseSurfacePoints, professionalDisclaimer } from '../../report/content';
import type { ReportInput } from '../../report/types';
import { isPolylineReport } from '../../engine/surface';
import { describeResultWarnings } from '../../engine/warnings';
import type { AnalysisReport, MethodKind, MethodReport, SolveStatus } from '../../engine/types';
import type { ModelDoc } from '../types';

/** Último cálculo: el reporte del motor con el documento (y su hash) al que corresponde. */
export interface EngineRun {
  revision: number;
  doc: ModelDoc;
  /** Texto `.ogs.json` canónico que se envió al motor. */
  json: string;
  sha256: string;
  report: AnalysisReport;
  elapsedMs: number;
  checkedAt: string;
}

/** `true` si el cálculo corresponde a la revisión actual del documento. */
export function isRunCurrent(run: EngineRun | null, revision: number): run is EngineRun {
  return run !== null && run.revision === revision;
}

export function buildReportInput(run: EngineRun, now: Date = new Date()): ReportInput {
  const warnings = run.report.results.flatMap((r) =>
    describeResultWarnings(r).map((w) => ({ method: r.method, severity: w.severity, code: w.code, text: w.text })),
  );
  return {
    generatedAt: now.toISOString(),
    engineName: run.report.engine,
    model: run.doc,
    modelSha256: run.sha256,
    results: run.report.results,
    warnings,
    checks: [],
    disclaimer: professionalDisclaimer(run.report.engine),
  };
}

/**
 * Resultados por método (FS y λ solo si convergió, con los avisos; ver `resultsToCsv`). `units` es el `doc.units` del
 * modelo calculado: con él la cabecera lleva `xc_m` o `xc_ft` y la primera línea declara las unidades (B-04).
 */
export function resultsCsv(report: AnalysisReport, units?: string | null): string {
  return resultsToCsv(report.results, { units });
}

/**
 * Puntos de la superficie de cada método que **convergió**: `metodo,estado,punto,x,y`, de izquierda a derecha (x creciente, con
 * el pie). Con un círculo son los puntos de la base de las dovelas; con una polilínea, uno por punto de la polilínea ajustada. Los métodos `not_converged` o `invalid` no se exportan: sus dovelas no
 * son un resultado.
 */
export function surfaceCoordsCsv(results: readonly MethodReport[], units?: string | null): string {
  const rows: CsvCell[][] = [];
  for (const r of results) {
    if (r.status !== 'converged') continue;
    // Polilínea (F3.7): los puntos ajustados del informe; círculo: los de la base de las dovelas.
    if (isPolylineReport(r.surface)) rows.push(...polylineSurfaceRows(r));
    else baseSurfacePoints(r.slices).forEach(([x, y], i) => rows.push([r.method, r.status, i + 1, x, y]));
  }
  return surfaceToCsv(rows, { units });
}

/** `true` si algún método trae `reinforcement_forces`: hay una tabla de fuerzas que exportar. */
export function hasReinforcementForces(results: readonly MethodReport[]): boolean {
  return results.some((r) => (r.reinforcement_forces?.length ?? 0) > 0);
}

/** CSV de las fuerzas de los refuerzos por cruce, de todos los métodos que las traen (ver `reinforcementForcesToCsv`). */
export function reinforcementForcesCsv(run: Pick<EngineRun, 'report' | 'doc'>): string {
  return reinforcementForcesToCsv(forceRecords(run.report.results, run.doc.reinforcements), { units: run.doc.units });
}

export interface ExportAvailability {
  /** Resultados CSV e informe PDF: hay un cálculo y corresponde a la revisión actual. */
  canExport: boolean;
  /** Superficie CSV: además, algún método convergió y tiene dovelas. */
  canExportSurface: boolean;
  /** Texto del botón bloqueado (`title`); `undefined` si está habilitado. */
  blockedTitle: string | undefined;
  surfaceTitle: string | undefined;
  /** Motivo visible de que haya exportaciones bloqueadas (R7-17): el `title` de un botón apagado no llega a todos. */
  hint: string | undefined;
}

/** Qué exportaciones están permitidas (E12i): solo el resultado de la revisión actual, nunca uno obsoleto. */
export function exportAvailability(run: EngineRun | null, current: boolean): ExportAvailability {
  const canExport = run !== null && current;
  const blockedTitle =
    run === null
      ? 'Pulse «Comprobar» para calcular el modelo antes de exportar.'
      : !current
        ? 'El modelo cambió desde el último cálculo: pulse «Comprobar» para exportar el resultado actual.'
        : undefined;
  const canExportSurface = canExport && hasExportableSurface(run.report.results);
  const surfaceTitle = blockedTitle ?? (canExportSurface ? undefined : 'Ningún método convergió: no hay una superficie crítica que exportar.');
  const unlock = 'Pulse «Comprobar» para habilitar las exportaciones del modelo actual.';
  const hint = run === null ? unlock : !current ? `El modelo cambió desde el último cálculo. ${unlock}` : canExportSurface ? undefined : surfaceTitle;
  return { canExport, canExportSurface, blockedTitle, surfaceTitle, hint };
}

/** `true` si algún método convergió y tiene dovelas: hay una superficie que exportar. */
export function hasExportableSurface(results: readonly MethodReport[]): boolean {
  return results.some((r) => r.status === 'converged' && r.slices.length > 0);
}

/** Nombre base de archivo para descargas: nombre del archivo abierto, id del modelo o «modelo». */
export function baseFileName(fileName: string | null, doc: ModelDoc): string {
  const raw = (fileName ?? doc.meta.id ?? '').trim().split(/[\\/]/).pop() ?? '';
  const stripped = raw.replace(/\.ogs\.json$/i, '').replace(/\.json$/i, '');
  const safe = stripped.replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^[._]+|_+$/g, '');
  return safe === '' ? 'modelo' : safe;
}

const CAPTION_METHOD: Record<MethodKind, string> = {
  bishop: 'Bishop simplificado',
  spencer: 'Spencer',
  morgenstern_price: 'Morgenstern-Price',
  janbu_simplified: 'Janbu simplificado',
  janbu_corrected: 'Janbu corregido',
};

/**
 * Pie de la sección dibujada. `fixed`: la superficie es la fija del modelo (no el crítico de una búsqueda). Un método que no convergió no tiene superficie crítica: la superficie mostrada es solo la
 * última evaluada y no debe leerse como resultado (R7-01).
 */
export function resultCaption(method: MethodKind, status: SolveStatus, fixed = false): string {
  const name = CAPTION_METHOD[method];
  if (status === 'converged') return `${fixed ? 'Superficie fija' : 'Superficie crítica'} en rojo y dovelas en gris (${name}).`;
  // R10B-07: `invalid` (la superficie no es admisible) y `not_converged` (el método no cerró) no son lo mismo.
  return status === 'invalid'
    ? `Superficie evaluada (no válida) en rojo y dovelas en gris (${name}). La superficie no es admisible: no es un resultado válido.`
    : `Superficie evaluada (sin convergencia) en rojo y dovelas en gris (${name}). El método no convergió: no es un resultado válido.`;
}
