// Pie de acción de la barra lateral (contrato UA §2): «Comprobar», «Cancelar cálculo», «Reiniciar el motor», «Informe PDF» y la
// pista de exportación. Con la barra plegada, `CheckButton` se ofrece también en la cabecera del área.

import { IconPdf, IconPlay } from '../../../ui/icons';

export interface CheckButtonProps {
  label: string;
  disabled: boolean;
  title: string;
  describedBy?: string;
  onCheck: () => void;
  /** Ancho completo y de 40 (pie de acción) o compacto (cabecera del área con la barra plegada). */
  variant: 'foot' | 'compact';
}

export function CheckButton({ label, disabled, title, describedBy, onCheck, variant }: CheckButtonProps) {
  return (
    <button
      type="button"
      className={variant === 'foot' ? 'primary ea-primary gs-btn gs-btn-primary gs-btn-lg ua-check' : 'primary ea-primary gs-btn gs-btn-primary ua-check ua-check-compact'}
      onClick={onCheck}
      disabled={disabled}
      title={title}
      aria-describedby={describedBy}
      aria-keyshortcuts="Control+Enter"
    >
      <IconPlay size={16} />
      <span>{label}</span>
      {variant === 'foot' ? (
        <kbd className="gs-kbd ua-kbd" aria-hidden="true">
          Ctrl Intro
        </kbd>
      ) : null}
    </button>
  );
}

export interface ActionFootProps {
  check: CheckButtonProps;
  /** Hay un resultado y no corresponde al modelo actual (o hay borradores): «Hay cambios sin calcular». */
  stale: boolean;
  busy: boolean;
  onCancel: () => void;
  engineFailed: boolean;
  onRestartEngine: () => void;
  reportBusy: boolean;
  reportDisabled: boolean;
  reportTitle?: string;
  reportDescribedBy?: string;
  onReport: () => void;
  /** Texto de `export-hint` (visible con un resultado obsoleto o tras intentar exportar). */
  exportHint?: string;
  hidden: boolean;
}

export function ActionFoot({ check, stale, busy, onCancel, engineFailed, onRestartEngine, reportBusy, reportDisabled, reportTitle, reportDescribedBy, onReport, exportHint, hidden }: ActionFootProps) {
  return (
    <section className="ua-actions" aria-label="Cálculo e informe" hidden={hidden}>
      {stale ? (
        <p className="gs-chip ua-stale-chip" data-tone="warn">
          Hay cambios sin calcular
        </p>
      ) : null}
      <CheckButton {...check} variant="foot" />
      {busy ? (
        <button type="button" className="gs-btn" onClick={onCancel} title="Termina el cálculo y reinicia el motor">
          Cancelar cálculo
        </button>
      ) : null}
      {engineFailed ? (
        <button type="button" className="gs-btn" onClick={onRestartEngine}>
          Reiniciar el motor
        </button>
      ) : null}
      <button type="button" className="gs-btn" onClick={onReport} disabled={reportDisabled} title={reportTitle} aria-describedby={reportDescribedBy}>
        <IconPdf size={16} />
        <span>{reportBusy ? 'Generando…' : 'Informe PDF'}</span>
      </button>
      {exportHint ? (
        <p id="ea-export-hint" className="ea-export-hint small" data-testid="export-hint">
          {exportHint}
        </p>
      ) : null}
    </section>
  );
}
