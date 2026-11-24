import type { VerificationCheck } from '../engine/types';
import { formatNumber, METHOD_LABELS } from './ResultsTable';

export interface CheckRow {
  check: VerificationCheck;
  fos: number | null;
  errorRel: number | null;
  ok: boolean;
  message?: string;
}

export function CheckTable({ rows }: { rows: CheckRow[] }) {
  return (
    <table className="checks">
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
              <span className={row.ok ? 'badge badge-ok' : 'badge badge-fail'}>{row.ok ? 'OK' : 'FALLA'}</span>
              {row.message ? <div className="muted small">{row.message}</div> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
