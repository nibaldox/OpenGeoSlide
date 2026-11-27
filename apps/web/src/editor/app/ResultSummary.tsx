// HUD de resultado sobre el lienzo (UX-03, UA §4.3): el FS mínimo de los métodos que convergieron, el FS de cada método y el
// estado, sin desplazarse. La tabla completa, los avisos y el diagnóstico están en la vista «Resultados».

import { useEffect, useId, useState } from 'react';
import type { MethodKind } from '../../engine/types';
import { IconCheck, IconChevronDown, IconWarning } from '../../ui/icons';
import { METHOD_LABELS } from '../../ui/methodLabels';
import { fsMinimum } from './shellModel';
import { focusResultsTable, summaryItems, warningCounts, warningCountsText } from './resultSummary';
import type { EngineRun } from './reportInput';
import './resultSummary.css';

/** Nota visible cuando existen borradores de tarjetas sin aplicar al modelo (W-R15c). */
export const STALE_DRAFTS_TEXT = 'Desactualizado: calculado antes de los cambios sin aplicar.';

/** Nota visible cuando el modelo en memoria cambió tras el último cálculo. */
export const STALE_MODEL_TEXT = 'Desactualizado: el modelo cambió. Pulse «Comprobar».';

/** Nombres cortos para la línea «Spencer · M-P» bajo la cifra (los mismos de `resultSummary.ts`). */
const SHORT_METHOD: Record<MethodKind, string> = {
  bishop: 'Bishop',
  spencer: 'Spencer',
  morgenstern_price: 'M-P',
  janbu_simplified: 'Janbu',
  janbu_corrected: 'Janbu corr.',
};

/** Texto de avance en cálculos largos (R15B-11): contador de segundos y, si se informa, el método en curso. */
export function formatBusyText(elapsedSeconds: number, activeMethod?: MethodKind | null): string {
  const secs = Math.max(0, Math.floor(elapsedSeconds));
  return activeMethod ? `Calculando ${METHOD_LABELS[activeMethod]}… (${secs} s)` : `Calculando… (${secs} s)`;
}

export function ResultSummary({ run, current, busy, shownMethod, elapsedSeconds, activeMethod, hasPendingDrafts = false, onShowTable }: {
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
  /**
   * UA-E3: el armazón pide el HUD plegado (tarjeta del lienzo baja o sin sitio). Si el usuario lo despliega a mano
   * mientras `compact` sigue en `true`, se respeta su elección hasta que `compact` vuelva a `false`.
   */
  compact?: boolean;
  /** UA-E3: número de incidencias locales de severidad `aviso` del modelo (no del cálculo). */
  localAdvisories?: number;
  /** UA-E3: «Ver avisos» del HUD; el armazón abre «Resultados» y enfoca Diagnósticos. */
  onShowAdvisories?: () => void;
}) {
  const staleNoteId = useId();
  const bodyId = useId();
  const pillTextId = useId();
  const [collapsed, setCollapsed] = useState(false);
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
  const min = run ? fsMinimum(run.report) : null;
  const effectiveCurrent = current && !hasPendingDrafts;
  const staleNote = hasPendingDrafts ? STALE_DRAFTS_TEXT : !current ? STALE_MODEL_TEXT : null;
  const state = busy ? 'busy' : !run ? 'empty' : effectiveCurrent ? 'current' : 'stale';
  const showTable = (): void => {
    if (onShowTable) onShowTable();
    else focusResultsTable();
  };

  return (
    <div
      className="rs"
      role="group"
      aria-label="Resumen del cálculo"
      data-testid="result-summary"
      data-state={state}
      data-stale-reason={busy || !run || effectiveCurrent ? undefined : hasPendingDrafts ? 'drafts' : 'model'}
      data-collapsed={run && !busy && collapsed ? 'true' : undefined}
    >
      {busy ? (
        <p className="rs-empty" data-testid="calc-progress">
          <span className="gs-spinner" aria-hidden="true" /> {formatBusyText(elapsedSeconds ?? measuredSec, activeMethod)}
        </p>
      ) : !run || !min ? (
        <p className="rs-empty muted">Sin resultados. Pulse «Comprobar» para calcular el factor de seguridad (FS).</p>
      ) : (
        <>
          {collapsed ? (
            <button
              type="button"
              className="rs-pill"
              aria-expanded={false}
              aria-controls={bodyId}
              aria-label="Mostrar resultado"
              aria-describedby={pillTextId}
              onClick={() => setCollapsed(false)}
            >
              <span id={pillTextId} className="rs-pill-text gs-mono">
                FS mín. {min.text}
              </span>
              <IconChevronDown size={16} />
            </button>
          ) : (
            <div className="rs-head">
              <p className="gs-eyebrow rs-eyebrow">Factor de seguridad mínimo</p>
              <button
                type="button"
                className="gs-icon-btn gs-btn-ghost rs-toggle"
                aria-expanded={true}
                aria-controls={bodyId}
                aria-label="Ocultar resultado"
                onClick={() => setCollapsed(true)}
              >
                <IconChevronDown size={16} />
              </button>
            </div>
          )}
          <div id={bodyId} className="rs-body" hidden={collapsed}>
            <div className="rs-top">
              <span className="rs-fs-min gs-mono" data-testid="fs-min" data-tone={effectiveCurrent && min.below1 ? 'nok' : undefined}>
                {min.text}
              </span>
              {min.methods.length > 0 ? <span className="rs-fs-methods">{min.methods.map((m) => SHORT_METHOD[m]).join(' · ')}</span> : null}
              {effectiveCurrent && min.below1 ? (
                <span className="gs-chip rs-chip" data-tone="nok">
                  FS &lt; 1,0
                </span>
              ) : null}
              {!effectiveCurrent ? (
                <span className="gs-chip rs-chip" data-tone="warn">
                  Desactualizado
                </span>
              ) : null}
            </div>
            <ul className={effectiveCurrent ? 'rs-list' : 'rs-list rs-stale'} aria-describedby={staleNote ? staleNoteId : undefined}>
              {items.map((i) => (
                <li
                  key={i.method}
                  className={`rs-item${i.converged ? '' : ' rs-item-warn'}${i.flagged ? ' rs-item-flagged' : ''}${shownMethod === i.method ? ' rs-item-shown' : ''}${min.methods.includes(i.method) ? ' rs-item-min' : ''}`}
                >
                  <span className="rs-method">{i.name}</span>
                  <span className="rs-fs gs-mono" data-testid={`fs-${i.method}`}>
                    <span className="rs-fs-label">FS</span> {i.fs}
                  </span>
                  {i.flagged ? (
                    <span className="rs-flag" data-testid={`warn-${i.method}`}>
                      <IconWarning size={13} />
                      Con aviso
                    </span>
                  ) : null}
                  {i.converged ? (
                    <span className="rs-ok" aria-hidden="true">
                      <IconCheck size={15} />
                    </span>
                  ) : null}
                  <span className={i.converged ? 'rs-status visually-hidden' : 'rs-status'}>{i.status}</span>
                </li>
              ))}
            </ul>
            {counts ? <p className="rs-counts small">{counts}</p> : null}
            <button type="button" className="rs-table-link link-button" onClick={showTable}>
              Ver tabla de resultados
            </button>
            {staleNote ? (
              <p id={staleNoteId} className="rs-stale-note small" role="status" data-testid="rs-stale-note">
                {staleNote}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
