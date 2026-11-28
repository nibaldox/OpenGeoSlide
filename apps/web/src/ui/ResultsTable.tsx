import { reportCircle } from '../engine/surface';
import { globalAlgorithmLabel, globalWinnerLabel } from '../engine/globalSearch';
import type { AnalysisReport, MethodKind, Reinforcement, SolveStatus, TensionCrack } from '../engine/types';
import { describeResultWarnings } from '../engine/warnings';
import { convergedFos } from '../analysis/runner';
import { correctionFactorText, methodDetails, refinementWinnerText, resultSurfaceSummary } from '../report/methodInfo';
import { formatFs } from './formatFs';
import { METHOD_LABELS } from './methodLabels';
import { CrackTable } from './CrackResults';
import { ReinforcementForces } from './ReinforcementForces';

export { METHOD_LABELS };

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
  /** Refuerzos del modelo calculado: con ellos la tabla de fuerzas dice el tipo y, con pilotes o tablestacas, el límite de F4.8. */
  reinforcements?: readonly Reinforcement[];
  /** `analysis.tension_crack` del modelo calculado (F5.2): con ella la tabla de la grieta dice la fracción de agua. */
  tensionCrack?: TensionCrack | null;
}

/** Nota o aviso del motor con el método que lo emitió (R2-09: no se aplanan los avisos de todos los métodos). */
interface MethodWarning {
  key: string;
  method: MethodKind;
  text: string;
}

function methodWarnings(report: AnalysisReport, severity: 'nota' | 'aviso'): MethodWarning[] {
  return report.results.flatMap((r) =>
    describeResultWarnings(r)
      .filter((w) => w.severity === severity)
      .map((w) => ({ key: `${r.method}:${w.code}`, method: r.method, text: w.text })),
  );
}

export function ResultsTable({ report, elapsedMs, shownMethod, onShowMethod, lengthUnit, reinforcements, tensionCrack }: Props) {
  const notes = methodWarnings(report, 'nota');
  const avisos = methodWarnings(report, 'aviso');
  // Con polilínea no hay centro ni radio: si todos los métodos la usan, una sola columna; en un informe mixto, el resumen va en la celda del centro.
  const polylines = report.results.map((r) => resultSurfaceSummary(r));
  const allPolyline = report.results.length > 0 && polylines.every((p) => p !== null);
  const anySearch = report.results.some((r) => r.search != null);
  const nonCircularResults = report.results.filter((r) => r.search?.non_circular !== undefined);
  const globalResults = report.results.filter((r) => r.search?.non_circular?.global !== undefined);
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
            {allPolyline && <th scope="col">{anySearch ? 'Superficie crítica' : 'Superficie fija'}</th>}
            {circleColumns && <th scope="col">Centro (xc; yc) ({lengthUnit})</th>}
            {circleColumns && <th scope="col">Radio ({lengthUnit})</th>}
            <th scope="col">Superficie</th>
          </tr>
        </thead>
        <tbody>
          {report.results.map((r, i) => {
            const detail = methodDetails(r);
            const circle = reportCircle(r.surface);
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
                {typeof r.strength?.passes === 'number' && (
                  <>
                    <br />
                    <span className="muted small">
                      Hoek-Brown: {r.strength.passes} {r.strength.passes === 1 ? 'pasada' : 'pasadas'}
                    </span>
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
                  {polylines[i] ?? `${formatNumber(circle?.xc ?? null, 2)}; ${formatNumber(circle?.yc ?? null, 2)}`}
                </td>
              )}
              {circleColumns && <td className="num">{formatNumber(circle?.r ?? null, 2)}</td>}
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
      {nonCircularResults.length > 0 && (
        <section className="rf nc-results" aria-label="Búsqueda no circular" data-testid="non-circular-summary">
          <table className="rf-table">
            <caption>Búsqueda no circular (refinamiento de semillas)</caption>
            <thead>
              <tr>
                <th scope="col">Método</th>
                <th scope="col">Semillas</th>
                <th scope="col">Eval. no circ.</th>
                <th scope="col">FS círculo (semilla)</th>
                <th scope="col">FS polilínea</th>
                <th scope="col">Superficie ganadora</th>
              </tr>
            </thead>
            <tbody>
              {nonCircularResults.map((r) => {
                const nc = r.search!.non_circular!;
                const winner = r.status !== 'converged' ? '—' : refinementWinnerText(r);
                return (
                  <tr key={r.method}>
                    <td>{METHOD_LABELS[r.method]}</td>
                    <td className="num">{nc.seeds}</td>
                    <td className="num">{nc.evaluated}</td>
                    <td className="num">{formatFs(nc.seed_fos)}</td>
                    <td className={nc.polyline_fos !== undefined ? 'num' : undefined}>
                      {nc.polyline_fos !== undefined ? formatFs(nc.polyline_fos) : 'Sin polilínea admisible'}
                    </td>
                    <td>{winner}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      {globalResults.length > 0 && (
        <section className="rf nc-results" aria-label="Búsqueda global" data-testid="global-summary">
          <table className="rf-table">
            <caption>Búsqueda global</caption>
            <thead>
              <tr>
                <th scope="col">Método</th>
                <th scope="col">Algoritmo</th>
                <th scope="col">Generados</th>
                <th scope="col">Elegibles</th>
                <th scope="col">Rechazados por tracción</th>
                <th scope="col">FS global</th>
                <th scope="col">Ganador</th>
              </tr>
            </thead>
            <tbody>
              {globalResults.map((r) => {
                const g = r.search!.non_circular!.global!;
                return (
                  <tr key={r.method}>
                    <td>{METHOD_LABELS[r.method]}</td>
                    <td>{globalAlgorithmLabel(g.algorithm)}</td>
                    <td className="num">{g.generated}</td>
                    <td className="num">{g.eligible}</td>
                    <td className="num">{g.tension_rejected}</td>
                    <td className={g.global_fos != null ? 'num' : undefined}>{g.global_fos != null ? formatFs(g.global_fos) : 'Sin superficie elegible'}</td>
                    <td>{globalWinnerLabel(g.winner)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      <CrackTable report={report} tensionCrack={tensionCrack} units={lengthUnit === 'ft' ? 'imperial' : 'SI'} />
      <ReinforcementForces report={report} reinforcements={reinforcements} units={lengthUnit === 'ft' ? 'imperial' : 'SI'} />
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
