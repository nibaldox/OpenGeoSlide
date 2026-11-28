// Vista «Resultados» (contrato UA §4.7): la tabla completa con su encabezado, la línea del motor, Diagnósticos y, sin cálculo,
// un estado vacío que remite a «Comprobar» (sin repetir el botón).

import type { ReactNode } from 'react';
import type { MethodKind } from '../../../engine/types';
import { ResultsTable } from '../../../ui/ResultsTable';
import { lengthUnitOf } from '../../canvas/layout';
import type { EngineRun } from '../reportInput';

export function ResultsView({
  run,
  current,
  hasDrafts,
  shownMethod,
  onShowMethod,
  diagnostics,
}: {
  run: EngineRun | null;
  current: boolean;
  hasDrafts: boolean;
  shownMethod: MethodKind | null;
  onShowMethod: (m: MethodKind) => void;
  /** `DiagnosticsPanel` ya armado por el editor. */
  diagnostics: ReactNode;
}) {
  return (
    <div className="ua-scroll ua-results">
      {run ? (
        <section className="gs-card ua-card" aria-labelledby="ea-results-title" data-testid="results-panel">
          <h2 id="ea-results-title">Resultados{current && !hasDrafts ? '' : ' (desactualizados)'}</h2>
          <ResultsTable
            report={run.report}
            elapsedMs={run.elapsedMs}
            shownMethod={shownMethod}
            onShowMethod={onShowMethod}
            lengthUnit={lengthUnitOf(run.doc.units)}
            reinforcements={run.doc.reinforcements}
            tensionCrack={run.doc.analysis.tension_crack}
          />
          <p className="small muted ua-engine-line">
            Motor: {run.report.engine} · SHA-256 del modelo calculado: <code>{run.sha256.slice(0, 16)}…</code>
          </p>
        </section>
      ) : (
        <section className="gs-card ua-card ua-empty" aria-labelledby="ua-results-empty-title" data-testid="results-empty">
          <h2 id="ua-results-empty-title">Sin resultados</h2>
          {/* UA-E3 §1 (B-13d): el botón «Comprobar» es uno solo, el del pie o el de la cabecera del área; aquí no se repite. */}
          <p className="muted">Calcule el factor de seguridad del modelo con «Comprobar» para ver aquí la tabla por método.</p>
        </section>
      )}
      {diagnostics}
    </div>
  );
}
