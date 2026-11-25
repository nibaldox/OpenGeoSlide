import type { Issue, EditorStore } from '../types';
import { PanelSection } from './Fields';
import { useStoreSelector } from './useStoreSelector';
import { SEVERITY_LABELS, diagnosticsStatusLabel, issueSummary, selectionForPath, sortIssues } from './forms';

/**
 * Lista de incidencias. Al hacer clic en una con `path` se selecciona el elemento en el lienzo y en los paneles.
 * `onCheck` (opcional) lo conecta el integrador al botón «Comprobar» del motor; el panel no ejecuta el motor.
 */
export function DiagnosticsPanel({ store, onCheck }: { store: EditorStore; onCheck?: () => void }) {
  const diagnostics = useStoreSelector(store, (s) => s.diagnostics);
  const revision = useStoreSelector(store, (s) => s.revision);
  const sorted = sortIssues(diagnostics.issues);
  const outdated =
    diagnostics.status === 'stale' ||
    ((diagnostics.status === 'ok' || diagnostics.status === 'error') && diagnostics.revision !== revision);

  const select = (issue: Issue): void =>
    store.dispatch({ type: 'ui/select', selection: selectionForPath(issue.path, store.getState().doc) });

  return (
    <PanelSection title="Diagnósticos">
      <p className={outdated ? 'ep-status-stale' : undefined} aria-live="polite">
        {outdated && diagnostics.status !== 'stale'
          ? diagnosticsStatusLabel('stale')
          : diagnosticsStatusLabel(diagnostics.status)}
      </p>
      {onCheck ? (
        <div className="ep-actions">
          <button type="button" disabled={diagnostics.status === 'checking'} onClick={onCheck}>
            Comprobar
          </button>
        </div>
      ) : null}
      <p className="muted small">{issueSummary(sorted)}</p>
      {sorted.length === 0 ? (
        <p className="muted">Sin incidencias.</p>
      ) : (
        <ul className="ep-issues">
          {sorted.map((issue, i) => {
            const content = (
              <>
                <span className={`ep-badge ep-badge-${issue.severity}`}>{SEVERITY_LABELS[issue.severity]}</span>
                <span>
                  {issue.text}
                  <span className="muted small">
                    {' '}
                    [{issue.source === 'local' ? 'local' : 'motor'}: {issue.code}
                    {issue.path ? ` · ${issue.path}` : ''}]
                  </span>
                </span>
              </>
            );
            return (
              <li key={`${issue.code}-${issue.path ?? ''}-${i}`}>
                {issue.path ? (
                  <button type="button" className="ep-issue" onClick={() => select(issue)}>
                    {content}
                  </button>
                ) : (
                  <div className="ep-issue">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PanelSection>
  );
}
