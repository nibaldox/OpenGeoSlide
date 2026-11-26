import type { AnalysisReport, Reinforcement } from '../engine/types';
import { STRUCTURAL_LIMIT_TEXT, forceRecords, forcesTable, hasStructuralElements } from '../report/reinforcementReport';
import { METHOD_LABELS } from './methodLabels';

/**
 * Fuerzas de los refuerzos por cruce (F4.9), una tabla por método que las trae, y el texto del límite de F4.8 cuando el modelo tiene
 * pilotes o tablestacas. Lo usan la vista Casos y el editor bajo la tabla de resultados. Sin fuerzas ni elementos estructurales no pinta nada.
 */
export function ReinforcementForces({ report, reinforcements, units }: { report: AnalysisReport; reinforcements?: readonly Reinforcement[]; units?: string | null }) {
  const withForces = report.results.filter((r) => (r.reinforcement_forces?.length ?? 0) > 0);
  const limit = hasStructuralElements(reinforcements);
  if (withForces.length === 0 && !limit) return null;
  return (
    <section className="rf" aria-label="Fuerzas de los refuerzos" data-testid="reinforcement-forces">
      {withForces.map((r) => {
        const t = forcesTable(forceRecords([r], reinforcements), units);
        return (
          <div key={r.method} className="rf-method">
            <table className="rf-table" data-method={r.method}>
              <caption>Fuerzas de los refuerzos por cruce con la superficie final ({METHOD_LABELS[r.method]})</caption>
              <thead>
                <tr>
                  {t.header.map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((row, i) => (
                  <tr key={`${row[0]}-${row[2]}-${i}`} className={row[7] === 'Aplicada' ? undefined : 'row-warn'}>
                    {row.map((cell, c) => (
                      <td key={c} className={c >= 2 && c <= 5 ? 'num' : undefined}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {limit && (
        <p className="rf-limit small" data-testid="structural-limit">
          <strong>Límite del cálculo.</strong> {STRUCTURAL_LIMIT_TEXT}
        </p>
      )}
    </section>
  );
}
