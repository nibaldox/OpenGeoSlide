// Diagnósticos del editor: convierte los errores y avisos del motor en `Issue` (source «engine») y los combina
// con las incidencias locales en un único `Diagnostics` para el store. Lógica pura (sin React).

import { engineErrorCode, userMessage } from '../../engine/errors';
import { describeWarning, warningPath } from '../../engine/warnings';
import type { AnalysisReport, MethodKind, SolveStatus } from '../../engine/types';
import type { Diagnostics, Issue } from '../types';

const METHOD_NAME: Record<MethodKind, string> = {
  bishop: 'Bishop simplificado',
  spencer: 'Spencer',
  morgenstern_price: 'Morgenstern-Price',
  janbu_simplified: 'Janbu simplificado',
  janbu_corrected: 'Janbu corregido',
};

const STATUS_TEXT: Record<Exclude<SolveStatus, 'converged'>, string> = {
  not_converged: 'no convergió: no se reporta FS',
  invalid: 'no encontró una superficie válida: no se reporta FS',
};

/** Error lanzado por el motor (o por el worker) → incidencia de severidad `error`. */
export function issueFromEngineError(error: unknown): Issue {
  const raw = error instanceof Error ? error.message : String(error);
  return {
    source: 'engine',
    severity: 'error',
    code: engineErrorCode(raw) ?? 'EngineError',
    text: userMessage(error),
    path: null,
  };
}

/** Avisos, notas y estados no convergidos de un reporte → incidencias de origen `engine`. */
export function issuesFromReport(report: AnalysisReport): Issue[] {
  const issues: Issue[] = [];
  for (const r of report.results) {
    if (r.status !== 'converged') {
      issues.push({
        source: 'engine',
        severity: 'aviso',
        code: `engine.${r.status}`,
        text: `${METHOD_NAME[r.method]}: ${STATUS_TEXT[r.status]}.`,
        path: null,
      });
    }
    for (const code of r.warnings) {
      const info = describeWarning(code);
      issues.push({
        source: 'engine',
        severity: info.severity,
        code: info.code,
        text: `${METHOD_NAME[r.method]}: ${info.text}`,
        path: warningPath(code),
      });
    }
  }
  return issues;
}

/** Resultado de la última comprobación con el motor, asociado a la revisión del documento que se analizó. */
export interface EngineDiagState {
  status: 'checking' | 'ok' | 'error';
  issues: Issue[];
  revision: number;
}

/**
 * Diagnóstico para el store. Las incidencias del motor solo valen para la revisión que se analizó: si el documento
 * cambió, el diagnóstico queda `stale` y solo conserva las locales. Sin comprobación previa, `idle`.
 */
export function composeDiagnostics(local: readonly Issue[], engine: EngineDiagState | null, revision: number): Diagnostics {
  if (engine === null) return { status: 'idle', issues: [...local], revision };
  if (engine.revision !== revision) return { status: 'stale', issues: [...local], revision };
  return { status: engine.status, issues: [...local, ...engine.issues], revision };
}

export function hasErrors(issues: readonly Issue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
