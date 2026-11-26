import { reportCircle } from '../engine/surface';
import type { AnalysisReport, MethodKind, SolveStatus } from '../engine/types';
import { describeWarnings } from '../engine/warnings';
import { convergedFos } from '../analysis/runner';
import { correctionFactorText, methodDetails, surfaceSummary } from '../report/methodInfo';
import { formatFs } from './formatFs';

export const METHOD_LABELS: Record<MethodKind, string> = {
  bishop: 'Bishop simplificado',
  spencer: 'Spencer',
  morgenstern_price: 'Morgenstern-Price',
  janbu_simplified: 'Janbu simplificado',
  janbu_corrected: 'Janbu corregido',
};

const STATUS_LABELS: Record<SolveStatus, string> = {
  // Mismos términos que el informe PDF (report/content.ts).
  converged: 'Convergió',
  not_converged: 'No convergió',
  invalid: 'No válida',
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
  /**
   * Unidad de longitud del modelo (`m` o `ft`). Con ella la tabla muestra el centro (xc; yc) y el radio de la superficie, con unidad
   * (R9-12c). Sin ella esas columnas se omiten: el reporte del motor no trae las unidades y no se inventa una. Una superficie
   * polilínea no necesita unidad: se rotula «Polilínea (n puntos)» en la columna «Superficie fija» (F3.7).
   */
  lengthUnit?: string;
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

export function ResultsTable({ report, elapsedMs, shownMethod, onShowMethod, lengthUnit }: Props) {
  const notes = methodWarnings(report, 'nota');
  const avisos = methodWarnings(report, 'aviso');
  // Con polilínea no hay centro ni radio: si todos los métodos la usan, una sola columna; en un informe mixto, el resumen va en la celda del centro.
  const polylines = report.results.map((r) => surfaceSummary(r.surface));
  const allPolyline = report.results.length > 0 && polylines.every((p) => p !== null);
  const circleColumns = Boolean(lengthUnit) && !allPolyline;
  const columns = 7 + (circleColumns ? 2 : 0) + (allPolyline ? 1 : 0) + 1; // + «Superficie» (Dibujar)
  return (
    <div className="results">
      <table data-results-table tabIndex={-1}>
        <caption className="visually-hidden">Resultados del análisis por método</caption>
        <thead>
          <tr>
            <th scope="col">Método</th>
            <th scope="col">FS</th>
            <th scope="col">Estado</th>
            <th scope="col">Iteraciones</th>
            <th scope="col">λ</th>
            <th scope="col">Superficies evaluadas</th>
            <th scope="col">Superficies válidas</th>
            {allPolyline && <th scope="col">Superficie fija</th>}
            {circleColumns && <th scope="col">Centro (xc; yc) ({lengthUnit})</th>}
            {circleColumns && <th scope="col">Radio ({lengthUnit})</th>}
            <th scope="col">Superficie</th>
          </tr>
        </thead>
        <tbody>
          {report.results.map((r, i) => {
            const detail = methodDetails(r);
            return (
            <tr key={r.method} className={r.status !== 'converged' ? 'row-warn' : undefined}>
              <td>
                {METHOD_LABELS[r.method]}
                {detail.interslice && (
                  <>
                    <br />
                    <span className="muted small">Función: {detail.interslice}</span>
                  </>
                )}
                {detail.f0 !== undefined && (
                  <>
                    <br />
                    <span className="muted small">f₀ = {correctionFactorText(detail.f0)}</span>
                  </>
                )}
              </td>
              <td className="num">{formatFs(convergedFos(r))}</td>
              <td>{STATUS_LABELS[r.status]}</td>
              <td className="num">{r.iterations}</td>
              <td className="num">{formatNumber(r.status === 'converged' ? r.lambda : null)}</td>
              <td className="num">{r.search ? r.search.evaluated : '—'}</td>
              <td className="num">{r.search ? r.search.valid : '—'}</td>
              {allPolyline && <td>{polylines[i]}</td>}
              {circleColumns && (
                <td className={polylines[i] ? undefined : 'num'}>
                  {polylines[i] ?? `${formatNumber(reportCircle(r.surface)?.xc ?? null, 2)}; ${formatNumber(reportCircle(r.surface)?.yc ?? null, 2)}`}
                </td>
              )}
              {circleColumns && <td className="num">{formatNumber(reportCircle(r.surface)?.r ?? null, 2)}</td>}
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
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={columns - 1}>
              Tiempo total del análisis
            </th>
            <td className="num">{formatNumber(elapsedMs, 1)} ms</td>
          </tr>
        </tfoot>
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
