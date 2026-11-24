import type { AnalysisReport, MethodReport, SolveStatus } from './types';

const STATUSES: readonly SolveStatus[] = ['converged', 'not_converged', 'invalid'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isMethodReport(value: unknown): value is MethodReport {
  if (!isRecord(value)) return false;
  const surface = value.surface;
  return (
    (value.method === 'bishop' || value.method === 'spencer') &&
    (value.fos === null || isFiniteNumber(value.fos)) &&
    STATUSES.includes(value.status as SolveStatus) &&
    isFiniteNumber(value.iterations) &&
    (value.lambda === null || isFiniteNumber(value.lambda)) &&
    isRecord(surface) &&
    isFiniteNumber(surface.xc) &&
    isFiniteNumber(surface.yc) &&
    isFiniteNumber(surface.r) &&
    Array.isArray(value.slices) &&
    value.slices.every(
      (s) =>
        isRecord(s) &&
        isFiniteNumber(s.x_left) &&
        isFiniteNumber(s.x_right) &&
        isFiniteNumber(s.weight) &&
        isFiniteNumber(s.alpha) &&
        isFiniteNumber(s.material),
    ) &&
    (value.search === null ||
      (isRecord(value.search) &&
        isFiniteNumber(value.search.evaluated) &&
        isFiniteNumber(value.search.valid))) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((w) => typeof w === 'string')
  );
}

/** Comprobación en tiempo de ejecución de los campos clave de un AnalysisReport (§3). */
export function isAnalysisReport(value: unknown): value is AnalysisReport {
  return (
    isRecord(value) &&
    typeof value.engine === 'string' &&
    Array.isArray(value.results) &&
    value.results.every(isMethodReport)
  );
}
