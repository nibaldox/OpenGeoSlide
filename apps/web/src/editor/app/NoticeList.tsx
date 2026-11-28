// Lista de avisos del editor (UX9-06): sin repetidos (con contador), máximo visible con «ver más» y «Cerrar todos».
// El nombre del botón sigue siendo «Cerrar mensaje» (estable, lo usan los recorridos); el aviso al que pertenece lo da
// `aria-describedby`. Los errores no se cierran solos. La lógica (deduplicar, elegir los visibles) está en `notices.ts`.

import { useEffect, useId, useState } from 'react';
import { visibleNotices, type Notice } from './notices';
import './notices.css';

export function NoticeList({ notices, onDismiss, onDismissAll, onPausedChange }: {
  notices: readonly Notice[];
  onDismiss: (id: number) => void;
  onDismissAll: () => void;
  /** El puntero o el foco sobre la lista pausan el cierre automático de los informativos. */
  onPausedChange?: (paused: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const baseId = useId();
  // Si la lista se desmonta con el foco dentro, `blur` no llega: se libera la pausa aquí.
  useEffect(() => () => onPausedChange?.(false), [onPausedChange]);
  if (notices.length === 0) return null;
  const { shown, hidden } = visibleNotices(notices, expanded);
  const canCollapse = expanded && visibleNotices(notices, false).hidden > 0;
  return (
    <div
      className="ea-notice-bar"
      data-testid="notice-bar"
      onMouseEnter={() => onPausedChange?.(true)}
      onMouseLeave={() => onPausedChange?.(false)}
      onFocus={() => onPausedChange?.(true)}
      onBlur={() => onPausedChange?.(false)}
    >
      <ul className="ea-notices" aria-label="Mensajes" data-testid="notices">
        {shown.map((n) => (
          <li key={n.id} className={`ea-notice ea-notice-${n.kind}`}>
            <span id={`${baseId}-${n.id}`} title={n.text}>
              {n.text}
              {(n.count ?? 1) > 1 ? (
                <span className="ea-notice-count" data-testid="notice-count">
                  {n.count} veces
                </span>
              ) : null}
            </span>
            <button type="button" className="link-button" onClick={() => onDismiss(n.id)} aria-label="Cerrar mensaje" aria-describedby={`${baseId}-${n.id}`}>
              Cerrar
            </button>
          </li>
        ))}
      </ul>
      {hidden > 0 || canCollapse || notices.length > 1 ? (
        <div className="ea-notice-actions">
          {hidden > 0 ? (
            <button type="button" className="link-button" aria-expanded={false} onClick={() => setExpanded(true)}>
              Ver {hidden} más
            </button>
          ) : null}
          {canCollapse ? (
            <button type="button" className="link-button" aria-expanded={true} onClick={() => setExpanded(false)}>
              Ver menos
            </button>
          ) : null}
          {notices.length > 1 ? (
            <button type="button" className="link-button" onClick={onDismissAll}>
              Cerrar todos
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
