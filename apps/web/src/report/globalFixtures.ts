// Informes y modelos de prueba escritos a mano para la salida de la búsqueda global (F7.2): cumplen `GlobalStats` sin depender del motor,
// que todavía no emite la v0.7 en este árbol. Solo para los tests `*.v07.test.ts` (nunca en `engine/`).

import type { ModelDoc } from '../editor/types';
import type { AnalysisReport, GlobalStats, MethodReport } from '../engine/types';
import { nonCircularPolylineWinsFixture } from './f3bFixtures';
import type { ReportInput } from './types';

export const GLOBAL_STATS_WINS: GlobalStats = {
  algorithm: 'block',
  generated: 300,
  attempts: 1840,
  converged: 296,
  eligible: 241,
  tension_rejected: 55,
  refined: 3,
  evaluated: 7415,
  polish_evaluated: 2210,
  global_fos: 1.0412,
  winner: 'global',
};

export const GLOBAL_STATS_REFINEMENT: GlobalStats = {
  algorithm: 'annealing',
  generated: 300,
  attempts: 300,
  converged: 300,
  eligible: 0,
  tension_rejected: 0,
  refined: 0,
  evaluated: 300,
  polish_evaluated: 0,
  global_fos: null,
  winner: 'refinement',
};

/**
 * Spencer: gana la búsqueda global (bloque, 300 candidatos, sin pulido, con rechazos por tracción y el aviso `non_circular_global_tension_rejected`).
 * Morgenstern-Price: sin candidatos elegibles; gana el refinamiento (recocido, `global_fos` nulo, nota `non_circular_global_no_candidates`).
 * El modelo declara `global` con valores no por defecto en algoritmo y candidatos (semilla y pulido por defecto, no escritos).
 */
export function globalSearchFixture(): { model: ModelDoc; report: AnalysisReport; input: ReportInput } {
  const base = nonCircularPolylineWinsFixture(false);
  const model: ModelDoc = structuredClone(base.model);
  model.version = '0.7';
  const search = model.analysis.search!;
  search.non_circular = { ...search.non_circular, global: { algorithm: 'block', generated: 300, polish: false } };
  const [spencer, mp] = base.report.results as [MethodReport, MethodReport];
  const results: MethodReport[] = [
    {
      ...spencer,
      fos: GLOBAL_STATS_WINS.global_fos!,
      warnings: ['non_circular_global_tension_rejected'],
      search: { ...spencer.search!, non_circular: { ...spencer.search!.non_circular!, polyline_fos: 1.2, global: GLOBAL_STATS_WINS } },
    },
    {
      ...mp,
      warnings: ['non_circular_global_no_candidates'],
      search: { ...mp.search!, non_circular: { ...mp.search!.non_circular!, global: GLOBAL_STATS_REFINEMENT } },
    },
  ];
  const report: AnalysisReport = { engine: 'ogs-core 0.6.0', results };
  const input: ReportInput = { ...base.input, engineName: report.engine, model, results };
  return { model, report, input };
}
