import type { ReactNode } from 'react';
import type { Issue, EditorStore } from '../types';
import { issueTargetFor, type IssueTarget } from '../app/issueNav';
import { PanelSection } from './Fields';
import { useStoreSelector } from './useStoreSelector';
import { SEVERITY_LABELS, diagnosticsStatusLabel, issueSummary, sortIssues } from './forms';

/** Texto técnico de una incidencia (origen, código, puntero y detalle del analizador): va colapsado, no en la lista. */
export function issueTechnicalText(issue: Issue): string {
  const parts = [`${issue.source === 'local' ? 'local' : 'motor'}: ${issue.code}`];
  if (issue.path) parts.push(issue.path);
  if (issue.detail) parts.push(issue.detail);
  return parts.join(' · ');
}

/**
 * Lista de incidencias. Una incidencia con destino real (`issueTargetFor`) es un botón: al pulsarla se selecciona el
 * elemento y `onNavigate` abre la pestaña y lleva el foco al campo (R7-11). Sin destino es solo texto.
 * `resultInfo` es información del resultado que no es una incidencia (la grieta de tracción, F5.7): va tras la lista.
 * El panel no ejecuta el motor: el botón «Comprobar» es el de la barra (no se duplica).
 */
export function DiagnosticsPanel({ store, onNavigate, resultInfo }: { store: EditorStore; onNavigate?: (issue: Issue, target: IssueTarget) => void; resultInfo?: ReactNode }) {
  const diagnostics = useStoreSelector(store, (s) => s.diagnostics);
  const revision = useStoreSelector(store, (s) => s.revision);
  const sorted = sortIssues(diagnostics.issues);
  const outdated =
    diagnostics.status === 'stale' ||
    ((diagnostics.status === 'ok' || diagnostics.status === 'error') && diagnostics.revision !== revision);

  const go = (issue: Issue, target: IssueTarget): void => {
    store.dispatch({ type: 'ui/select', selection: target.selection });
    onNavigate?.(issue, target);
  };
  const doc = store.getState().doc;

  return (
    <PanelSection title="Diagnósticos">
      <p className={outdated ? 'ep-status-stale' : undefined} data-testid="diagnostics-status">
        {outdated && diagnostics.status !== 'stale'
          ? diagnosticsStatusLabel('stale')
          : diagnosticsStatusLabel(diagnostics.status)}
      </p>
      <p className="muted small">{issueSummary(sorted)}</p>
      {sorted.length === 0 ? (
        <p className="muted">Sin incidencias.</p>
      ) : (
        <ul className="ep-issues">
          {sorted.map((issue, i) => {
            const target = issueTargetFor(issue, doc);
            const content = (
              <>
                <span className={`ep-badge ep-badge-${issue.severity}`}>{SEVERITY_LABELS[issue.severity]}</span>
                <span>{issue.text}</span>
              </>
            );
            return (
              <li key={`${issue.code}-${issue.path ?? ''}-${i}`} className="ep-issue-item">
                {target ? (
                  <button type="button" className="ep-issue" onClick={() => go(issue, target)}>
                    {content}
                  </button>
                ) : (
                  <div className="ep-issue">{content}</div>
                )}
                <details className="ep-issue-detail">
                  <summary>Detalle técnico</summary>
                  <p className="small muted">{issueTechnicalText(issue)}</p>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      {resultInfo}
    </PanelSection>
  );
}
