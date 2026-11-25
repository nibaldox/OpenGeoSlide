// Franja de resultados siempre visible sobre el lienzo (UX-03): el FS de cada método y el estado, sin desplazarse.
// La tabla completa, los avisos y el diagnóstico quedan debajo del lienzo.

import { summaryItems, warningCounts, warningCountsText } from './resultSummary';
import type { EngineRun } from './reportInput';

export function ResultSummary({ run, current, busy, shownMethod }: {
  run: EngineRun | null;
  current: boolean;
  busy: boolean;
  shownMethod: string | null;
}) {
  const items = run ? summaryItems(run.report) : [];
  const counts = run ? warningCountsText(warningCounts(run.report)) : null;
  return (
    <div className="rs" role="group" aria-label="Resumen del cálculo" data-testid="result-summary" data-state={busy ? 'busy' : !run ? 'empty' : current ? 'current' : 'stale'}>
      {busy ? (
        <p className="rs-empty">Calculando…</p>
      ) : !run ? (
        <p className="rs-empty muted">Sin resultados. Pulse «Comprobar» para calcular el factor de seguridad (FS).</p>
      ) : (
        <>
          <ul className={current ? 'rs-list' : 'rs-list rs-stale'}>
            {items.map((i) => (
              <li key={i.method} className={`rs-item${i.converged ? '' : ' rs-item-warn'}${shownMethod === i.method ? ' rs-item-shown' : ''}`}>
                <span className="rs-method">{i.name}</span>
                <span className="rs-fs" data-testid={`fs-${i.method}`}>
                  <span className="rs-fs-label">FS</span> {i.fs}
                </span>
                <span className="rs-status">{i.status}</span>
              </li>
            ))}
          </ul>
          {counts ? <p className="rs-counts small">{counts}</p> : null}
          {!current ? <p className="rs-stale-note small">Desactualizado: el modelo cambió. Pulse «Comprobar».</p> : null}
        </>
      )}
    </div>
  );
}
