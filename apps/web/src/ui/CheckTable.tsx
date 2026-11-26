import { hasBlockingWarning, type CheckRow } from './checkRow';
import { formatNumber, METHOD_LABELS } from './ResultsTable';
import './checkTable.css';

export type { CheckRow };

export function CheckTable({ rows }: { rows: CheckRow[] }) {
  return (
    <div className="table-scroll" role="region" aria-label="Tabla de comprobación frente a los valores publicados" tabIndex={0}>
    <table className="checks">
      <caption className="visually-hidden">Comprobación frente a los valores publicados</caption>
      <thead>
        <tr>
          <th scope="col">Método</th>
          <th scope="col">Superficie</th>
          <th scope="col">Publicado</th>
          <th scope="col">FS</th>
          <th scope="col">Error (%)</th>
          <th scope="col">Tolerancia (%)</th>
          <th scope="col">Resultado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={`${row.check.method}-${row.check.kind}-${i}`}>
            <td>{METHOD_LABELS[row.check.method]}</td>
            <td>{row.check.kind === 'fixed' ? 'Fija' : 'Búsqueda'}</td>
            <td className="num">
              {formatNumber(row.check.published)}
              {row.check.published_by ? <span className="muted"> ({row.check.published_by})</span> : null}
            </td>
            <td className="num">{formatNumber(row.fos)}</td>
            <td className="num">{row.errorRel === null ? '—' : formatNumber(row.errorRel * 100, 2)}</td>
            <td className="num">{formatNumber(row.check.tolerance * 100, 2)}</td>
            <td>
              {/* Un FS dentro de la tolerancia pero con un aviso del motor no es «Cumple» sin más (R10B-06). */}
              {row.ok && hasBlockingWarning(row) ? (
                <span className="badge badge-warn">Cumple, con aviso</span>
              ) : (
                <span className={row.ok ? 'badge badge-ok' : 'badge badge-fail'}>{row.ok ? 'Cumple' : 'No cumple'}</span>
              )}
              {row.message ? <div className="muted small">{row.message}</div> : null}
              {row.warnings && row.warnings.length > 0 ? (
                <ul className="check-warnings" aria-label={`Avisos de la comprobación de ${METHOD_LABELS[row.check.method]}`}>
                  {row.warnings.map((w) => (
                    <li key={w.code} className={w.severity === 'nota' ? 'check-note' : undefined}>
                      <span className="check-tag">{w.severity === 'nota' ? 'Nota:' : 'Aviso:'}</span> {w.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
