import type { AnalysisReport, MethodKind, MethodReport, ReinforcementApplication, ReinforcementForceStatus, SolveStatus } from './types';

const METHODS: readonly MethodKind[] = [
  'bishop',
  'spencer',
  'morgenstern_price',
  'janbu_simplified',
  'janbu_corrected',
];

const STATUSES: readonly SolveStatus[] = ['converged', 'not_converged', 'invalid'];
const FORCE_STATUSES: readonly ReinforcementForceStatus[] = ['applied', 'outside_mass', 'compression_ignored', 'no_capacity'];
const APPLICATIONS: readonly ReinforcementApplication[] = ['active', 'passive'];
const PASSIVE_SLICE_FIELDS = ['passive_v', 'passive_h', 'passive_h_moment_base', 'passive_driving_extra'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPoint(value: unknown): boolean {
  return Array.isArray(value) && value.length === 2 && isFiniteNumber(value[0]) && isFiniteNumber(value[1]);
}

function isPointList(value: unknown, min: number): boolean {
  return Array.isArray(value) && value.length >= min && value.every(isPoint);
}

/** Superficie de un informe (F3.7): `{xc, yc, r}` de un círculo o `{points}` de una polilínea (≥ 2 puntos finitos). */
function isReportSurface(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if ('points' in value) return isPointList(value.points, 2);
  return isFiniteNumber(value.xc) && isFiniteNumber(value.yc) && isFiniteNumber(value.r);
}

/** `interslice` del informe de M-P: `{function, points?}`. */
function isIntersliceReport(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.function === 'string' &&
    (value.points === undefined || isPointList(value.points, 0))
  );
}

/** Fuerza de un refuerzo en un cruce (v0.4, F4.9, E14m-4). */
function isReinforcementForce(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    ['crossing', 'x', 'y', 'station', 'available', 'fx', 'fy'].every((k) => isFiniteNumber(value[k])) &&
    APPLICATIONS.includes(value.application as ReinforcementApplication) &&
    FORCE_STATUSES.includes(value.status as ReinforcementForceStatus)
  );
}

function isMethodReport(value: unknown): value is MethodReport {
  if (!isRecord(value)) return false;
  return (
    METHODS.includes(value.method as MethodKind) &&
    (value.fos === null || isFiniteNumber(value.fos)) &&
    STATUSES.includes(value.status as SolveStatus) &&
    isFiniteNumber(value.iterations) &&
    (value.lambda === null || isFiniteNumber(value.lambda)) &&
    isReportSurface(value.surface) &&
    Array.isArray(value.slices) &&
    value.slices.every(
      (s) =>
        isRecord(s) &&
        isFiniteNumber(s.x_left) &&
        isFiniteNumber(s.x_right) &&
        isFiniteNumber(s.weight) &&
        isFiniteNumber(s.alpha) &&
        isFiniteNumber(s.material) &&
        PASSIVE_SLICE_FIELDS.every((k) => s[k] === undefined || isFiniteNumber(s[k])),
    ) &&
    (value.search === null ||
      (isRecord(value.search) &&
        isFiniteNumber(value.search.evaluated) &&
        isFiniteNumber(value.search.valid))) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((w) => typeof w === 'string') &&
    (value.correction_factor === undefined || isFiniteNumber(value.correction_factor)) &&
    (value.interslice === undefined || isIntersliceReport(value.interslice)) &&
    (value.reinforcement_forces === undefined ||
      (Array.isArray(value.reinforcement_forces) && value.reinforcement_forces.every(isReinforcementForce)))
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
