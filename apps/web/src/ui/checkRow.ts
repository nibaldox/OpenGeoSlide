// Fila de la tabla de comprobación (vista «Casos»): el resultado de una comprobación con su estado real y sus avisos (R10B-06).
// Lógica pura, sin React: se prueba en Node.

import type { MethodReport, VerificationCheck } from '../engine/types';
import { describeResultWarnings, type WarningInfo } from '../engine/warnings';
import { convergedFos, evaluateCheck } from '../analysis/runner';

export interface CheckRow {
  check: VerificationCheck;
  fos: number | null;
  errorRel: number | null;
  /** El FS está dentro de la tolerancia. No dice nada de los avisos: un resultado con aviso puede cumplir numéricamente. */
  ok: boolean;
  message?: string;
  /** Avisos y notas del motor para este resultado, con el texto de `engine/warnings.ts`. */
  warnings?: WarningInfo[];
}

/** Hay algún aviso de severidad `aviso` (no basta una nota): el resultado está condicionado o no es admisible. */
export function hasBlockingWarning(row: Pick<CheckRow, 'warnings'>): boolean {
  return (row.warnings ?? []).some((w) => w.severity === 'aviso');
}

/**
 * Fila de una comprobación a partir del resultado del motor. Conserva el estado real: `invalid` (la superficie no es
 * admisible) no se disfraza de «no convergió», y los avisos del motor se propagan en lugar de descartarse.
 */
export function checkRowFromResult(check: VerificationCheck, result: MethodReport | undefined): CheckRow {
  const outcome = evaluateCheck(check, convergedFos(result));
  const warnings = result ? describeResultWarnings(result) : [];
  let message: string | undefined;
  if (!result) message = 'El motor no devolvió ningún resultado para esta comprobación.';
  else if (outcome.fos === null) {
    message =
      result.status === 'invalid'
        ? 'El método no encontró una superficie válida: no se reporta FS para esta comprobación.'
        : 'El método no convergió: no se reporta FS para esta comprobación.';
  }
  return { check, fos: outcome.fos, errorRel: outcome.errorRel, ok: outcome.ok, message, warnings };
}
