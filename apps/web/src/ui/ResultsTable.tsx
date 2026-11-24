import type { AnalysisReport, MethodKind, SolveStatus } from '../engine/types';

export const METHOD_LABELS: Record<MethodKind, string> = {
  bishop: 'Bishop simplificado',
  spencer: 'Spencer',
};

const STATUS_LABELS: Record<SolveStatus, string> = {
  converged: 'Convergido',
  not_converged: 'No convergido',
  invalid: 'No válido',
};

const numberFormat = (digits: number) =>
  new Intl.NumberFormat('es', { minimumFractionDigits: 0, maximumFractionDigits: digits });

export function formatNumber(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return numberFormat(digits).format(value);
}

interface Props {
  report: AnalysisReport;
  elapsedMs: number;
  shownMethod: MethodKind | null;
  onShowMethod: (method: MethodKind) => void;
}

export function ResultsTable({ report, elapsedMs, shownMethod, onShowMethod }: Props) {
  const warnings = Array.from(new Set(report.results.flatMap((r) => r.warnings)));
  return (
    <div className="results">
      <table>
        <thead>
          <tr>
            <th scope="col">Método</th>
            <th scope="col">FS</th>
            <th scope="col">Estado</th>
            <th scope="col">Iteraciones</th>
            <th scope="col">λ</th>
            <th scope="col">Superficies evaluadas</th>
            <th scope="col">Superficies válidas</th>
            <th scope="col">Tiempo (ms)</th>
            <th scope="col">Superficie</th>
          </tr>
        </thead>
        <tbody>
          {report.results.map((r) => (
            <tr key={r.method} className={r.status !== 'converged' ? 'row-warn' : undefined}>
              <td>{METHOD_LABELS[r.method]}</td>
              <td className="num">{formatNumber(r.fos)}</td>
              <td>{STATUS_LABELS[r.status]}</td>
              <td className="num">{r.iterations}</td>
              <td className="num">{formatNumber(r.lambda)}</td>
              <td className="num">{r.search ? r.search.evaluated : '—'}</td>
              <td className="num">{r.search ? r.search.valid : '—'}</td>
              <td className="num">{formatNumber(elapsedMs, 1)}</td>
              <td>
                <button
                  type="button"
                  className={shownMethod === r.method ? 'link-button active' : 'link-button'}
                  onClick={() => onShowMethod(r.method)}
                  aria-pressed={shownMethod === r.method}
                >
                  Dibujar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {warnings.length > 0 && (
        <ul className="warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
