// Resumen compacto del cálculo (franja siempre visible sobre el lienzo) y mensajes para las regiones `aria-live`.
// Lógica pura: se prueba en Node.

import { convergedFos } from '../../analysis/runner';
import type { AnalysisReport, MethodKind, SolveStatus } from '../../engine/types';
import { describeResultWarnings } from '../../engine/warnings';
import { formatFs } from '../../ui/formatFs';
import { fsMinimum } from './shellModel';

const SHORT_NAME: Record<MethodKind, string> = {
  bishop: 'Bishop',
  spencer: 'Spencer',
  morgenstern_price: 'M-P',
  janbu_simplified: 'Janbu',
  janbu_corrected: 'Janbu corr.',
};
const FULL_NAME: Record<MethodKind, string> = {
  bishop: 'Bishop simplificado',
  spencer: 'Spencer',
  morgenstern_price: 'Morgenstern-Price',
  janbu_simplified: 'Janbu simplificado',
  janbu_corrected: 'Janbu corregido',
};
const STATUS_TEXT: Record<SolveStatus, string> = { converged: 'Convergió', not_converged: 'No convergió', invalid: 'No válida' };

export interface SummaryItem {
  method: MethodKind;
  /** «Bishop simplificado». */
  name: string;
  /** FS con coma decimal y siempre 3 decimales («0,985», «1,200»), o «—» si el método no convergió. */
  fs: string;
  converged: boolean;
  status: string;
  /** Avisos de severidad `aviso` del método (códigos distintos); las notas no cuentan (R10B-09). */
  warnings: number;
  /** El método tiene avisos de severidad `aviso`: la franja muestra «Con aviso» junto a su FS. */
  flagged: boolean;
}

export interface WarningCounts {
  avisos: number;
  notas: number;
}

export function summaryItems(report: AnalysisReport): SummaryItem[] {
  return report.results.map((r) => {
    const fos = convergedFos(r);
    const warnings = describeResultWarnings(r).filter((w) => w.severity === 'aviso').length;
    return {
      method: r.method,
      name: FULL_NAME[r.method],
      fs: formatFs(fos),
      converged: r.status === 'converged',
      status: STATUS_TEXT[r.status],
      warnings,
      flagged: warnings > 0,
    };
  });
}

export function warningCounts(report: AnalysisReport): WarningCounts {
  let avisos = 0;
  let notas = 0;
  for (const r of report.results) {
    for (const w of describeResultWarnings(r)) {
      if (w.severity === 'aviso') avisos += 1;
      else notas += 1;
    }
  }
  return { avisos, notas };
}

/**
 * Método (o métodos) que rige el FS mínimo del HUD, para nombrarlo junto a la cifra (CM-W2): con uno solo, su nombre completo
 * («Morgenstern-Price»); si dos o más empatan al mostrar tres decimales, todos, con la abreviatura de la tabla de resultados
 * («Spencer · M-P»), que es lo que cabe en la píldora. `form` fuerza una de las dos (`short` es la salida cuando no cabe).
 */
export function governingMethodText(methods: readonly MethodKind[], form: 'auto' | 'full' | 'short' = 'auto'): string {
  const full = form === 'full' || (form === 'auto' && methods.length === 1);
  return methods.map((m) => (full ? FULL_NAME[m] : SHORT_NAME[m])).join(' · ');
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
  const parts = summaryItems(report).map((i) => (i.converged ? `${SHORT_NAME[i.method]} FS ${i.fs}${i.flagged ? ' con aviso' : ''}` : `${SHORT_NAME[i.method]} sin convergencia`));
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

/** Línea «Búsqueda global: …» del HUD (E17f §1, RCM-B-07). */
export interface GlobalLine {
  /** «Búsqueda global: ganó (bloque)», «… no mejoró el refinamiento» o «… sin candidatos»; con « · M-P» si hay que decir de qué método habla. */
  text: string;
  /** Está la nota `non_circular_global_tension_rejected` en el método de la línea: el HUD pone la marca de aviso. */
  flagged: boolean;
  /** Texto largo para `title`: las cifras que el HUD no lleva (generados, elegibles, rechazados por tracción) y el nombre completo del método. */
  title: string;
}

const GLOBAL_ALGORITHM_SHORT: Record<string, string> = { block: 'bloque', annealing: 'recocido' };

/**
 * La línea de la búsqueda global del HUD, o `null` si ningún resultado trae `search.non_circular.global`. Habla del método que rige
 * (`fsMinimum`, el primero si empatan); si ese método no trae la etapa global, del primero que la trae. Con más de un método con etapa
 * global, o si el método de la línea no es el que rige, la línea lo nombra con la abreviatura del HUD («· M-P»): Spencer puede haber
 * ganado por refinamiento y Morgenstern-Price por la búsqueda global. Las seis cifras siguen en la tabla, el CSV y el informe.
 */
export function globalSearchLine(report: AnalysisReport): GlobalLine | null {
  const withGlobal = report.results.filter((r) => r.search?.non_circular?.global !== undefined && r.search.non_circular.global !== null);
  if (withGlobal.length === 0) return null;
  const governing = fsMinimum(report).methods[0];
  const pick = withGlobal.find((r) => r.method === governing) ?? withGlobal[0]!;
  const g = pick.search!.non_circular!.global!;
  const verdict =
    g.winner === 'global'
      ? `ganó (${GLOBAL_ALGORITHM_SHORT[g.algorithm] ?? g.algorithm})`
      : g.eligible === 0
        ? 'sin candidatos'
        : 'no mejoró el refinamiento';
  const named = withGlobal.length > 1 || (governing !== undefined && pick.method !== governing);
  const flagged = pick.warnings.includes('non_circular_global_tension_rejected');
  const detail = `${g.generated} generados, ${g.eligible} elegibles, ${g.tension_rejected} rechazados por tracción`;
  return {
    text: `Búsqueda global: ${verdict}${named ? ` · ${SHORT_NAME[pick.method]}` : ''}`,
    flagged,
    title: `Búsqueda global (${FULL_NAME[pick.method]}): ${verdict}. ${detail}.${flagged ? ' La guarda de tracción descartó superficies con un FS menor; véase el aviso en Resultados.' : ''}`,
  };
}
