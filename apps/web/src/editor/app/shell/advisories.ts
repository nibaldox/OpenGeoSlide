// Avisos del modelo en el armazón (UA-E3 §4): cuántos hay y cómo llevar al usuario a Diagnósticos. Sin React: se prueba en Node.

import type { AnalysisReport } from '../../../engine/types';
import { describeResultWarnings } from '../../../engine/warnings';
import type { Issue } from '../../types';

export interface AdvisoryCounts {
  /** Incidencias locales de severidad `aviso` (σci fuera de rango, γsat < γ, ru con piezométrica…). */
  local: number;
  /** Avisos de severidad `aviso` del cálculo actual (no las notas), con el mismo recuento que el HUD (`warningCounts`). */
  run: number;
  /** `local + run`: lo que cuenta el chip de la cabecera (`RunStatusInput.advisories`). */
  total: number;
}

/**
 * `report` es el del cálculo **actual**: un resultado de otra revisión o con borradores sin aplicar no aporta avisos
 * (el armazón pasa `null`). Las incidencias de severidad `error` y las `nota` no cuentan.
 */
export function advisoryCounts(localIssues: readonly Pick<Issue, 'severity'>[], report: AnalysisReport | null): AdvisoryCounts {
  const local = localIssues.filter((i) => i.severity === 'aviso').length;
  let run = 0;
  if (report) for (const r of report.results) run += describeResultWarnings(r).filter((w) => w.severity === 'aviso').length;
  return { local, run, total: local + run };
}

/** Lleva el foco al título de Diagnósticos (la vista «Resultados» ya debe estar a la vista). `false` si no se encuentra. */
export function focusDiagnostics(root: Pick<Document, 'querySelector'> = document): boolean {
  const status = root.querySelector<HTMLElement>('[data-testid="diagnostics-status"]');
  const heading = status?.closest('section')?.querySelector<HTMLElement>(':scope > h2') ?? null;
  if (!heading) return false;
  heading.tabIndex = -1;
  heading.scrollIntoView({ block: 'start' });
  heading.focus({ preventScroll: true });
  return true;
}
