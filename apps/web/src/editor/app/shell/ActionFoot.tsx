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
  const button = (
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
    </button>
  );
  if (variant !== 'foot') return button;
  // La tecla es un hermano decorativo superpuesto: el nombre del botón es exactamente «Comprobar» (UA-E2, WCAG 2.5.3).
  return (
    <div className="ua-check-wrap">
      {button}
      <kbd className="gs-kbd ua-kbd" aria-hidden="true">
        Ctrl Intro
      </kbd>
    </div>
  );
}

/** Pista de bloqueo de las exportaciones. Un solo nodo con este `id`: vive en el pie o, con la barra plegada, en la cabecera del área. */
export function ExportHint({ text }: { text: string }) {
  return (
    <p id="ea-export-hint" className="ea-export-hint small" data-testid="export-hint">
      {text}
    </p>
  );
}

export interface CollapsedActionsProps {
  check: Omit<CheckButtonProps, 'variant'>;
  busy: boolean;
  onCancel: () => void;
  engineFailed: boolean;
  onRestartEngine: () => void;
}

/**
 * Con la barra plegada el pie de acción está oculto: «Comprobar», «Cancelar cálculo» (si hay un cálculo en curso) y «Reiniciar
 * el motor» (si el motor falló) pasan a la cabecera del área (UA-E3 §2). Cada uno es el único visible con su nombre.
 */
export function CollapsedActions({ check, busy, onCancel, engineFailed, onRestartEngine }: CollapsedActionsProps) {
  return (
    <div className="ua-collapsed-actions" role="group" aria-label="Cálculo">
      <CheckButton {...check} variant="compact" />
      {busy ? (
        <button type="button" className="gs-btn ua-compact-btn" onClick={onCancel} title="Termina el cálculo y reinicia el motor">
          Cancelar cálculo
        </button>
      ) : null}
      {engineFailed ? (
        <button type="button" className="gs-btn ua-compact-btn" onClick={onRestartEngine}>
          Reiniciar el motor
        </button>
      ) : null}
    </div>
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
    <section className="ua-actions" aria-label="Cálculo e informe" hidden={hidden} data-swap={busy || engineFailed ? 'true' : undefined}>
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
      <button type="button" className="gs-btn ua-report-btn" onClick={onReport} disabled={reportDisabled} title={reportTitle} aria-describedby={reportDescribedBy}>
        <IconPdf size={16} />
        <span>{reportBusy ? 'Generando…' : 'Informe PDF'}</span>
      </button>
      {exportHint ? <ExportHint text={exportHint} /> : null}
    </section>
  );
}
