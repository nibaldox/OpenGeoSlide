// Entradas del informe y exportaciones CSV a partir del último cálculo. Lógica pura (sin React ni DOM).

import { toCsv, resultsToCsv, type CsvCell } from '../../io/csv';
import { professionalDisclaimer } from '../../report/content';
import type { ReportInput } from '../../report/types';
import { describeWarnings } from '../../engine/warnings';
import type { AnalysisReport, MethodReport } from '../../engine/types';
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
    describeWarnings(r.warnings).map((w) => ({ method: r.method, severity: w.severity, code: w.code, text: w.text })),
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

/** Resultados por método (FS solo si convergió; ver `resultsToCsv`). */
export function resultsCsv(report: AnalysisReport): string {
  return resultsToCsv(report.results);
}

/** Puntos de la base de las dovelas de cada método: `metodo,punto,x,y` (la superficie crítica de izquierda a derecha). */
export function surfaceCoordsCsv(results: readonly MethodReport[]): string {
  const rows: CsvCell[][] = [];
  for (const r of results) {
    let n = 0;
    for (const s of r.slices) {
      n += 1;
      rows.push([r.method, n, s.x_left, s.y_base_left]);
    }
    const last = r.slices[r.slices.length - 1];
    if (last) rows.push([r.method, n + 1, last.x_right, last.y_base_right]);
  }
  return toCsv(['metodo', 'punto', 'x', 'y'], rows);
}

/** Nombre base de archivo para descargas: nombre del archivo abierto, id del modelo o «modelo». */
export function baseFileName(fileName: string | null, doc: ModelDoc): string {
  const raw = (fileName ?? doc.meta.id ?? '').trim().split(/[\\/]/).pop() ?? '';
  const stripped = raw.replace(/\.ogs\.json$/i, '').replace(/\.json$/i, '');
  const safe = stripped.replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^[._]+|_+$/g, '');
  return safe === '' ? 'modelo' : safe;
}
