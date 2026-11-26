import type { AnalysisReport, Reinforcement } from '../engine/types';
import { FORCE_TABLE_NOTE, STRUCTURAL_LIMIT_TEXT, forceRecords, forcesTable, hasStructuralElements, uncrossedByMethod } from '../report/reinforcementReport';
import { METHOD_LABELS } from './methodLabels';

const fmtFs = (v: number): string => v.toFixed(3).replace('.', ',');

/**
 * Fuerzas de los refuerzos por cruce (F4.9), una tabla por método que las trae, y el texto del límite de F4.8 cuando el modelo tiene
 * pilotes o tablestacas. Lo usan la vista Casos y el editor bajo la tabla de resultados. Sin fuerzas ni elementos estructurales no pinta nada.
 */
export function ReinforcementForces({ report, reinforcements, units }: { report: AnalysisReport; reinforcements?: readonly Reinforcement[]; units?: string | null }) {
  const withForces = report.results.filter((r) => (r.reinforcement_forces?.length ?? 0) > 0);
  const limit = hasStructuralElements(reinforcements);
  // E14o-14: la aclaración de F va con la tabla cuando hay una pasiva (en el modelo o en las fuerzas).
  const passive = withForces.length > 0 && ((reinforcements ?? []).some((r) => r.application === 'passive') || withForces.some((r) => (r.reinforcement_forces ?? []).some((f) => f.application === 'passive')));
  // E14o-16 (R11B-06): un refuerzo sin cruce con la superficie final no sale en las tablas; se nombra aparte.
  const uncrossed = uncrossedByMethod(report.results, reinforcements);
  if (withForces.length === 0 && !limit && uncrossed.length === 0) return null;
  return (
    <section className="rf" aria-label="Fuerzas de los refuerzos" data-testid="reinforcement-forces">
      {withForces.map((r) => {
        const t = forcesTable(forceRecords([r], reinforcements), units);
        return (
          <div key={r.method} className="rf-method">
            <table className="rf-table" data-method={r.method}>
              <caption>{`Fuerzas de los refuerzos por cruce con la superficie final (${METHOD_LABELS[r.method]}${typeof r.fos === 'number' ? `; F = ${fmtFs(r.fos)}` : ''})`}</caption>
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
                  <tr key={`${row[0]}-${row[2]}-${i}`} className={row[row.length - 1] === 'Aplicada' ? undefined : 'row-warn'}>
                    {row.map((cell, c) => (
                      <td key={c} className={c >= 2 && c <= 6 ? 'num' : undefined}>
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
      {uncrossed.map((u) => (
        <p key={u.method} className="rf-note small" data-testid="uncrossed" data-method={u.method}>
          Sin cruce con la superficie final ({METHOD_LABELS[u.method]}): {u.ids.join(', ')}. No aportaron fuerza.
        </p>
      ))}
      {passive && (
        <p className="rf-note small" data-testid="force-table-note">
          {FORCE_TABLE_NOTE}
        </p>
      )}
      {limit && (
        <p className="rf-limit small" data-testid="structural-limit">
          <strong>Límite del cálculo.</strong> {STRUCTURAL_LIMIT_TEXT}
        </p>
      )}
    </section>
  );
}
