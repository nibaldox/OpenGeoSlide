// Vista «Informe» (contrato UA §4.7): título del documento, lo que incluirá el PDF y las acciones de exportación.

import { IconCheck, IconExport, IconPdf } from '../../../ui/icons';
import type { ReportContentItem } from '../shellModel';

export function ReportView({
  title,
  notice,
  contents,
  hasRun,
  reportBusy,
  reportDisabled,
  reportTitle,
  onReport,
  csvDisabled,
  onCsv,
  onEditTitle,
}: {
  /** Título que se muestra: el del PDF (`reportDocTitle`). */
  title: string;
  /** Aviso visible de desactualizado o de borradores sin aplicar (propio de Informe, aunque la barra esté plegada). */
  notice?: string | null;
  contents: readonly ReportContentItem[];
  hasRun: boolean;
  reportBusy: boolean;
  reportDisabled: boolean;
  reportTitle?: string;
  onReport: () => void;
  csvDisabled: boolean;
  onCsv: () => void;
  /** Abre el paso «Proyecto» de la barra lateral. */
  onEditTitle: () => void;
}) {
  const describedBy = notice ? 'ua-report-notice' : undefined;
  return (
    <div className="ua-scroll ua-report">
      <section className="gs-card ua-card ua-report-card" aria-labelledby="ua-report-title">
        <h2 id="ua-report-title">Informe técnico</h2>
        {notice ? (
          <p id="ua-report-notice" className="gs-chip ua-report-notice" data-tone="warn" data-testid="report-notice">
            {notice}
          </p>
        ) : null}
        {/* B-11: `aria-labelledby` no vale en un <p>; la pareja término-descripción lleva el nombre sin atributos ARIA. */}
        <dl className="ua-report-doc">
          <dt className="gs-eyebrow">Título del documento</dt>
          <dd className="ua-report-doc-row">
            <span className="ua-report-doc-title" data-testid="report-title">
              {title}
            </span>
            <button type="button" className="gs-btn" onClick={onEditTitle}>
              Editar título
            </button>
          </dd>
        </dl>
        <div>
          <span className="gs-eyebrow" id="ua-report-contents-label">
            Contenido
          </span>
          {contents.length === 0 ? (
            <p className="muted small">{hasRun ? 'Sin secciones.' : 'Calcule el modelo para ver qué incluirá el informe.'}</p>
          ) : (
            <ul className="ua-report-list" aria-labelledby="ua-report-contents-label">
              {contents.map((c) => (
                <li key={c.label} data-included={c.included ? 'true' : 'false'}>
                  <span className="ua-report-mark" aria-hidden="true">
                    {c.included ? <IconCheck size={15} /> : null}
                  </span>
                  <span>
                    {c.label}
                    {c.included ? '' : ' (no aplica a este modelo)'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="ua-report-actions">
          <button type="button" className="gs-btn gs-btn-primary" onClick={onReport} disabled={reportDisabled} title={reportTitle} aria-describedby={describedBy}>
            <IconPdf size={16} />
            <span>{reportBusy ? 'Generando…' : 'Generar PDF'}</span>
          </button>
          <button type="button" className="gs-btn" onClick={onCsv} disabled={csvDisabled} title={reportTitle} aria-describedby={describedBy}>
            <IconExport size={16} />
            <span>Exportar CSV de resultados</span>
          </button>
        </div>
      </section>
    </div>
  );
}
