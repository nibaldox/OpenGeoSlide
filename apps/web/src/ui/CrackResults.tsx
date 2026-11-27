import type { AnalysisReport, TensionCrack } from '../engine/types';
import { CRACK_PW_NOTE, NO_CRACK_TEXT, crackRecords, crackTable, crackUnits, cutNoCrackText, faceSuffix, isCutNoCrack, isNoCrack, waterFillText } from '../report/crackReport';
import { METHOD_LABELS } from './methodLabels';

const fmt = (v: number, digits = 2): string => new Intl.NumberFormat('es', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(v);

/**
 * Grieta de tracción de la superficie final (F5.4, F5.7): una tabla con `x_c`, la profundidad usada, la fracción de agua y `Pw` por método.
 * Va bajo la tabla de resultados (Casos y editor). Sin grieta en los resultados (el motor la omite) no pinta nada.
 */
export function CrackTable({ report, tensionCrack, units }: { report: AnalysisReport; tensionCrack?: TensionCrack | null; units?: string | null }) {
  const records = crackRecords(report.results);
  if (records.length === 0) return null;
  const t = crackTable(records, units, tensionCrack?.water_fill);
  // El texto (método, agua y la frase del corte) va a la izquierda; las cifras, a la derecha.
  const waterCol = t.header.indexOf('Agua en la grieta');
  return (
    <section className="rf crack-results" aria-label="Grieta de tracción" data-testid="crack-results">
      <table className="rf-table">
        <caption>Grieta de tracción en la superficie final</caption>
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
          {t.rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, c) => (
                <td key={c} className={c === 0 || c === waterCol || cell.startsWith('Corte de la masa') ? undefined : 'num'}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rf-note small" data-testid="crack-note">
        {CRACK_PW_NOTE}
      </p>
    </section>
  );
}

/**
 * Resumen de la grieta para «Diagnósticos»: una línea por método con `x_c`, la profundidad y `Pw`. Es información del resultado, no una
 * incidencia del modelo: va aparte de la lista y no cuenta en el resumen de incidencias.
 */
export function CrackSummary({ report, tensionCrack, units }: { report: AnalysisReport; tensionCrack?: TensionCrack | null; units?: string | null }) {
  const records = crackRecords(report.results);
  if (records.length === 0) return null;
  const u = crackUnits(units);
  return (
    <div className="crack-summary" data-testid="crack-summary">
      <h3 className="small">Grieta de tracción en el resultado</h3>
      <ul className="small">
        {records.map((r) => (
          <li key={r.method}>
            <span className="muted">{METHOD_LABELS[r.method]}:</span>{' '}
            {isCutNoCrack({ depth: r.depth, face_height: r.face }) ? (
              cutNoCrackText(r.x, r.face as number, units)
            ) : isNoCrack({ depth: r.depth, face_height: r.face }) ? (
              NO_CRACK_TEXT
            ) : (
              <>
                x_c = {fmt(r.x)} {u.length}, profundidad = {fmt(r.depth)} {u.length}
                {faceSuffix(r.face, units)}, Pw = {fmt(r.force)} {u.line}
                {tensionCrack ? ` (agua en la grieta: ${waterFillText(tensionCrack.water_fill)})` : ''}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
