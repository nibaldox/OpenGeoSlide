// Protocolo del benchmark de la página /?bench=1, sin React. Es el mismo que `ogs bench` (CLI) y que
// los benchmarks de Node: 1 calentamiento y 5 repeticiones por método, con el caso V047a en modo búsqueda.

import type { AnalysisReport, MethodKind } from '../engine/types';

export const BENCH_CASE_ID = 'V047a';
export const BENCH_TARGET = 'chrome-wasm';
export const BENCH_WARMUP_RUNS = 1;
export const BENCH_REPS = 5;
export const BENCH_METHODS: readonly MethodKind[] = ['bishop', 'spencer'];

/** Un registro por método. Mismos campos en todos los targets (CLI, Node y Chrome). */
export interface BenchRecord {
  target: string;
  engine: string;
  case: string;
  method: MethodKind;
  reps: number;
  /** Tiempo de cada repetición medida (ms), en orden de ejecución; sin calentamiento. */
  ms: number[];
  median_ms: number;
  evaluated: number | null;
  valid: number | null;
  fos: number | null;
}

/** Mediana de un conjunto no vacío (media de los dos centrales si la longitud es par). */
export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median: conjunto vacío');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Construye el registro de un método a partir de los tiempos del worker y el último informe. */
export function makeBenchRecord(input: {
  method: MethodKind;
  caseId: string;
  ms: number[];
  report: AnalysisReport;
}): BenchRecord {
  const result = input.report.results[0];
  return {
    target: BENCH_TARGET,
    engine: input.report.engine,
    case: input.caseId,
    method: input.method,
    reps: input.ms.length,
    ms: input.ms,
    median_ms: median(input.ms),
    evaluated: result?.search?.evaluated ?? null,
    valid: result?.search?.valid ?? null,
    fos: result?.fos ?? null,
  };
}
