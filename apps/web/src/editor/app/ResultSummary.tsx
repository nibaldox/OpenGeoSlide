// Franja de resultados siempre visible sobre el lienzo (UX-03): el FS de cada método y el estado, sin desplazarse.
// La tabla completa, los avisos y el diagnóstico quedan debajo del lienzo.

import { useEffect, useState } from 'react';
import type { MethodKind } from '../../engine/types';
import { METHOD_LABELS } from '../../ui/methodLabels';
import { focusResultsTable, summaryItems, warningCounts, warningCountsText } from './resultSummary';
import type { EngineRun } from './reportInput';
import './resultSummary.css';

/** Texto de avance en cálculos largos (R15B-11): contador de segundos y, si se informa, el método en curso. */
export function formatBusyText(elapsedSeconds: number, activeMethod?: MethodKind | null): string {
  const secs = Math.max(0, Math.floor(elapsedSeconds));
  return activeMethod ? `Calculando ${METHOD_LABELS[activeMethod]}… (${secs} s)` : `Calculando… (${secs} s)`;
}

export function ResultSummary({ run, current, busy, shownMethod, elapsedSeconds, activeMethod }: {
  run: EngineRun | null;
  current: boolean;
  busy: boolean;
  shownMethod: string | null;
  elapsedSeconds?: number;
  activeMethod?: MethodKind | null;
}) {
  const [measuredSec, setMeasuredSec] = useState(0);
  useEffect(() => {
    if (!busy || elapsedSeconds !== undefined) {
      setMeasuredSec(0);
      return;
    }
    const start = Date.now();
    setMeasuredSec(0);
    const timer = window.setInterval(() => {
      setMeasuredSec(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [busy, elapsedSeconds]);

  const items = run ? summaryItems(run.report) : [];
  const counts = run ? warningCountsText(warningCounts(run.report)) : null;
  return (
    <div className="rs" role="group" aria-label="Resumen del cálculo" data-testid="result-summary" data-state={busy ? 'busy' : !run ? 'empty' : current ? 'current' : 'stale'}>
      {busy ? (
        <p className="rs-empty" data-testid="calc-progress">
          {formatBusyText(elapsedSeconds ?? measuredSec, activeMethod)}
        </p>
      ) : !run ? (
        <p className="rs-empty muted">Sin resultados. Pulse «Comprobar» para calcular el factor de seguridad (FS).</p>
      ) : (
        <>
          <ul className={current ? 'rs-list' : 'rs-list rs-stale'}>
            {items.map((i) => (
              <li key={i.method} className={`rs-item${i.converged ? '' : ' rs-item-warn'}${i.flagged ? ' rs-item-flagged' : ''}${shownMethod === i.method ? ' rs-item-shown' : ''}`}>
                <span className="rs-method">{i.name}</span>
                <span className="rs-fs" data-testid={`fs-${i.method}`}>
                  <span className="rs-fs-label">FS</span> {i.fs}
                </span>
                {i.flagged ? (
                  <span className="rs-flag" data-testid={`warn-${i.method}`}>
                    <span aria-hidden="true">⚠ </span>Con aviso
                  </span>
                ) : null}
                <span className="rs-status">{i.status}</span>
              </li>
            ))}
          </ul>
          {counts ? <p className="rs-counts small">{counts}</p> : null}
          <button type="button" className="rs-table-link link-button" onClick={() => focusResultsTable()}>
            Ver tabla de resultados
          </button>
          {!current ? <p className="rs-stale-note small">Desactualizado: el modelo cambió. Pulse «Comprobar».</p> : null}
        </>
      )}
    </div>
  );
}
