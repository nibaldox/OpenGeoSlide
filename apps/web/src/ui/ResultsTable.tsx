import type { AnalysisReport, MethodKind, SolveStatus } from '../engine/types';
import { describeWarnings } from '../engine/warnings';

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

/** Nota o aviso del motor con el método que lo emitió (R2-09: no se aplanan los avisos de todos los métodos). */
interface MethodWarning {
  key: string;
  method: MethodKind;
  text: string;
}

function methodWarnings(report: AnalysisReport, severity: 'nota' | 'aviso'): MethodWarning[] {
  return report.results.flatMap((r) =>
    describeWarnings(r.warnings)
      .filter((w) => w.severity === severity)
      .map((w) => ({ key: `${r.method}:${w.code}`, method: r.method, text: w.text })),
  );
}

export function ResultsTable({ report, elapsedMs, shownMethod, onShowMethod }: Props) {
  const notes = methodWarnings(report, 'nota');
  const avisos = methodWarnings(report, 'aviso');
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
      {notes.length > 0 && (
        <ul className="notes" aria-label="Notas del análisis">
          {notes.map((w) => (
            <li key={w.key}>
              <span className="note-tag">Nota:</span> <span className="muted">{METHOD_LABELS[w.method]}:</span> {w.text}
            </li>
          ))}
        </ul>
      )}
      {avisos.length > 0 && (
        <ul className="warnings" aria-label="Avisos del análisis">
          {avisos.map((w) => (
            <li key={w.key}>
              <strong>Aviso:</strong> <span className="muted">{METHOD_LABELS[w.method]}:</span> {w.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
