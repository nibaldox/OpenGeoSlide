// Franja de resultados siempre visible sobre el lienzo (UX-03): el FS de cada método y el estado, sin desplazarse.
// La tabla completa, los avisos y el diagnóstico quedan debajo del lienzo.

import { useEffect, useId, useState } from 'react';
import type { MethodKind } from '../../engine/types';
import { METHOD_LABELS } from '../../ui/methodLabels';
import { focusResultsTable, summaryItems, warningCounts, warningCountsText } from './resultSummary';
import type { EngineRun } from './reportInput';
import './resultSummary.css';

/** Nota visible cuando existen borradores de tarjetas sin aplicar al modelo (W-R15c). */
export const STALE_DRAFTS_TEXT = 'Desactualizado: calculado antes de los cambios sin aplicar.';

/** Nota visible cuando el modelo en memoria cambió tras el último cálculo. */
export const STALE_MODEL_TEXT = 'Desactualizado: el modelo cambió. Pulse «Comprobar».';

/** Texto de avance en cálculos largos (R15B-11): contador de segundos y, si se informa, el método en curso. */
export function formatBusyText(elapsedSeconds: number, activeMethod?: MethodKind | null): string {
  const secs = Math.max(0, Math.floor(elapsedSeconds));
  return activeMethod ? `Calculando ${METHOD_LABELS[activeMethod]}… (${secs} s)` : `Calculando… (${secs} s)`;
}

export function ResultSummary({ run, current, busy, shownMethod, elapsedSeconds, activeMethod, hasPendingDrafts = false }: {
  run: EngineRun | null;
  current: boolean;
  busy: boolean;
  shownMethod: string | null;
  elapsedSeconds?: number;
  activeMethod?: MethodKind | null;
  hasPendingDrafts?: boolean;
  /**
   * UA0 (contrato §4.3): «Ver tabla de resultados» llama a esta función (el armazón abre la vista «Resultados» y
   * enfoca la tabla). Sin ella, el comportamiento de siempre (`focusResultsTable()`).
   */
  onShowTable?: () => void;
}) {
  const staleNoteId = useId();
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
  const effectiveCurrent = current && !hasPendingDrafts;
  const staleNote = hasPendingDrafts ? STALE_DRAFTS_TEXT : !current ? STALE_MODEL_TEXT : null;

  return (
    <div
      className="rs"
      role="group"
      aria-label="Resumen del cálculo"
      data-testid="result-summary"
      data-state={busy ? 'busy' : !run ? 'empty' : effectiveCurrent ? 'current' : 'stale'}
      data-stale-reason={busy || !run || effectiveCurrent ? undefined : hasPendingDrafts ? 'drafts' : 'model'}
    >
      {busy ? (
        <p className="rs-empty" data-testid="calc-progress">
          {formatBusyText(elapsedSeconds ?? measuredSec, activeMethod)}
        </p>
      ) : !run ? (
        <p className="rs-empty muted">Sin resultados. Pulse «Comprobar» para calcular el factor de seguridad (FS).</p>
      ) : (
        <>
          <ul className={effectiveCurrent ? 'rs-list' : 'rs-list rs-stale'} aria-describedby={staleNote ? staleNoteId : undefined}>
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
          {staleNote ? (
            <p id={staleNoteId} className="rs-stale-note small" role="status" data-testid="rs-stale-note">
              {staleNote}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
