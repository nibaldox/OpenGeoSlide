// Resumen compacto del cálculo (franja siempre visible sobre el lienzo) y mensajes para las regiones `aria-live`.
// Lógica pura: se prueba en Node.

import { convergedFos } from '../../analysis/runner';
import type { AnalysisReport, MethodKind, SolveStatus } from '../../engine/types';
import { describeWarnings } from '../../engine/warnings';
import { formatFs } from '../../ui/formatFs';

const SHORT_NAME: Record<MethodKind, string> = { bishop: 'Bishop', spencer: 'Spencer' };
const FULL_NAME: Record<MethodKind, string> = { bishop: 'Bishop simplificado', spencer: 'Spencer' };
const STATUS_TEXT: Record<SolveStatus, string> = { converged: 'Convergió', not_converged: 'No convergió', invalid: 'No válida' };

export interface SummaryItem {
  method: MethodKind;
  /** «Bishop simplificado». */
  name: string;
  /** FS con coma decimal y siempre 3 decimales («0,985», «1,200»), o «—» si el método no convergió. */
  fs: string;
  converged: boolean;
  status: string;
}

export interface WarningCounts {
  avisos: number;
  notas: number;
}

export function summaryItems(report: AnalysisReport): SummaryItem[] {
  return report.results.map((r) => {
    const fos = convergedFos(r);
    return {
      method: r.method,
      name: FULL_NAME[r.method],
      fs: formatFs(fos),
      converged: r.status === 'converged',
      status: STATUS_TEXT[r.status],
    };
  });
}

export function warningCounts(report: AnalysisReport): WarningCounts {
  let avisos = 0;
  let notas = 0;
  for (const r of report.results) {
    for (const w of describeWarnings(r.warnings)) {
      if (w.severity === 'aviso') avisos += 1;
      else notas += 1;
    }
  }
  return { avisos, notas };
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** «1 aviso y 2 notas», «2 notas», o `null` si no hay ninguna. */
export function warningCountsText({ avisos, notas }: WarningCounts): string | null {
  const parts = [avisos > 0 ? plural(avisos, 'aviso', 'avisos') : null, notas > 0 ? plural(notas, 'nota', 'notas') : null].filter(
    (p): p is string => p !== null,
  );
  return parts.length === 0 ? null : parts.join(' y ');
}

/** Mensaje para la región `aria-live="polite"` al terminar un cálculo: «Cálculo completado: Bishop FS 0,985; Spencer FS 0,984; 2 notas». */
export function calcAnnouncement(report: AnalysisReport): string {
  const parts = summaryItems(report).map((i) => (i.converged ? `${SHORT_NAME[i.method]} FS ${i.fs}` : `${SHORT_NAME[i.method]} sin convergencia`));
  const counts = warningCountsText(warningCounts(report));
  if (counts) parts.push(counts);
  return `Cálculo completado: ${parts.join('; ')}`;
}

/**
 * Texto que se escribe en una región viva. Si es idéntico al anterior se le añade un espacio de no separación
 * alterno: sin cambio de contenido, los lectores de pantalla no repiten el anuncio.
 */
export function nextAnnouncement(previous: string, message: string): string {
  const prev = previous.replace(/\u00a0$/, '');
  if (message !== prev) return message;
  return previous.endsWith('\u00a0') ? message : `${message}\u00a0`;
}

/**
 * Lleva el foco y la vista a la tabla completa de resultados (UX9-05). La tabla lleva `data-results-table` y
 * `tabindex="-1"`. Devuelve `false` si no hay tabla (aún no hay resultados).
 */
export function focusResultsTable(root: Pick<Document, 'querySelector'> = document): boolean {
  const table = root.querySelector<HTMLElement>('[data-results-table]');
  if (!table) return false;
  table.scrollIntoView({ block: 'start' });
  table.focus({ preventScroll: true });
  return true;
}
