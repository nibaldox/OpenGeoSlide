// Vista «Informe» (contrato UA §4.7): título del documento, lo que incluirá el PDF y las acciones de exportación.

import { IconCheck, IconExport, IconPdf } from '../../../ui/icons';
import type { ReportContentItem } from '../shellModel';

export function ReportView({
  title,
  contents,
  hasRun,
  reportBusy,
  reportDisabled,
  reportTitle,
  reportDescribedBy,
  onReport,
  csvDisabled,
  onCsv,
  onEditTitle,
}: {
  title: string;
  contents: readonly ReportContentItem[];
  hasRun: boolean;
  reportBusy: boolean;
  reportDisabled: boolean;
  reportTitle?: string;
  reportDescribedBy?: string;
  onReport: () => void;
  csvDisabled: boolean;
  onCsv: () => void;
  /** Abre el paso «Proyecto» de la barra lateral. */
  onEditTitle: () => void;
}) {
  const shown = title.trim() === '' ? 'Sin título' : title.trim();
  return (
    <div className="ua-scroll ua-report">
      <section className="gs-card ua-card ua-report-card" aria-labelledby="ua-report-title">
        <h2 id="ua-report-title">Informe técnico</h2>
        <div className="ua-report-doc">
          <span className="gs-eyebrow" id="ua-report-doc-label">
            Título del documento
          </span>
          <div className="ua-report-doc-row">
            <p className="ua-report-doc-title" aria-labelledby="ua-report-doc-label" data-testid="report-title">
              {shown}
            </p>
            <button type="button" className="gs-btn" onClick={onEditTitle}>
              Editar título
            </button>
          </div>
        </div>
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
          <button type="button" className="gs-btn gs-btn-primary" onClick={onReport} disabled={reportDisabled} title={reportTitle} aria-describedby={reportDescribedBy}>
            <IconPdf size={16} />
            <span>{reportBusy ? 'Generando…' : 'Generar PDF'}</span>
          </button>
          <button type="button" className="gs-btn" onClick={onCsv} disabled={csvDisabled} title={reportTitle} aria-describedby={reportDescribedBy}>
            <IconExport size={16} />
            <span>Exportar CSV de resultados</span>
          </button>
        </div>
      </section>
    </div>
  );
}
