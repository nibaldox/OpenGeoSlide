// HUD de resultado sobre el lienzo (UX-03, UA §4.3): el FS mínimo de los métodos que convergieron, el FS de cada método y el
// estado, sin desplazarse. La tabla completa, los avisos y el diagnóstico están en la vista «Resultados».

import { useEffect, useId, useRef, useState } from 'react';
import { convergedFos } from '../../analysis/runner';
import type { MethodKind } from '../../engine/types';
import { IconCheck, IconChevronDown, IconWarning } from '../../ui/icons';
import { METHOD_LABELS } from '../../ui/methodLabels';
import { fsMinimum, fsText } from './shellModel';
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

/**
 * Plegado del HUD (UA-E3 §3). El usuario pliega y despliega a mano (`collapsed`); con `compact` el armazón lo pide plegado, y si el
 * usuario lo despliega mientras `compact` sigue en `true` (`expandedInCompact`), se respeta hasta que `compact` vuelva a `false`.
 */
export interface HudFold {
  collapsed: boolean;
  expandedInCompact: boolean;
}

export const INITIAL_HUD_FOLD: HudFold = { collapsed: false, expandedInCompact: false };

export const isHudCollapsed = (compact: boolean, fold: HudFold): boolean => (compact ? !fold.expandedInCompact : fold.collapsed);

/** El usuario pulsó «Ocultar resultado» o la píldora: la elección va a la parte que corresponde al modo actual. */
export function toggleHudFold(compact: boolean, fold: HudFold): HudFold {
  return compact ? { ...fold, expandedInCompact: isHudCollapsed(true, fold) } : { ...fold, collapsed: !fold.collapsed };
}

/** `compact` cambió (en cualquier sentido): se olvida el despliegue manual dentro del modo compacto. */
export const resetCompactChoice = (fold: HudFold): HudFold => (fold.expandedInCompact ? { ...fold, expandedInCompact: false } : fold);

/**
 * Texto visible de la píldora plegada (B-03): la cifra y, si procede, el estado («FS < 1,0» con el resultado vigente,
 * «Desactualizado» si no lo es). El nombre accesible del botón lo contiene entero (WCAG 2.5.3).
 */
export function pillParts(fsMinText: string, below1: boolean, current: boolean): { figure: string; status: string | null } {
  return { figure: `FS mín. ${fsMinText}`, status: !current ? 'Desactualizado' : below1 ? 'FS < 1,0' : null };
}

/** Nombre accesible de la píldora: «Mostrar resultado, FS mín. 0,984 FS < 1,0» (lleva todo el texto visible, en su orden). */
export const pillLabel = (parts: { figure: string; status: string | null }): string => `Mostrar resultado, ${parts.figure}${parts.status ? ` ${parts.status}` : ''}`;

/** «1 aviso del modelo» / «3 avisos del modelo». */
export const advisoriesText = (n: number): string => `${n} ${n === 1 ? 'aviso' : 'avisos'} del modelo`;

export function ResultSummary({
  run,
  current,
  busy,
  shownMethod,
  elapsedSeconds,
  activeMethod,
  hasPendingDrafts = false,
  onShowTable,
  compact = false,
  localAdvisories = 0,
  onShowAdvisories,
  engineError = null,
}: {
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
  /**
   * UA3-C2 (A-03): texto del error del motor (`NoValidSurface`…) del último cálculo; el HUD lo muestra en una línea con «Ver diagnósticos»
   * (que llama a `onShowAdvisories`, si existe). El armazón pasa el mismo texto que el chip de la cabecera.
   */
  engineError?: string | null;
}) {
  const staleNoteId = useId();
  const bodyId = useId();
  const [fold, setFold] = useState<HudFold>(INITIAL_HUD_FOLD);
  const collapsed = isHudCollapsed(compact, fold);
  const pillRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  /** A-12: tras plegar o desplegar con el botón, el foco va al botón que aparece (el pulsado se desmonta). */
  const moveFocus = useRef(false);
  useEffect(() => {
    setFold(resetCompactChoice);
  }, [compact]);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (collapsed ? pillRef.current : toggleRef.current)?.focus();
  }, [collapsed]);
  const toggleFold = (): void => {
    moveFocus.current = true;
    setFold((f) => toggleHudFold(compact, f));
  };
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
  // B-12a: el FS de cada método usa el mismo texto que la cifra (4 decimales en [0,9995, 1)).
  const fosByMethod = new Map(run ? run.report.results.map((r) => [r.method, convergedFos(r)] as const) : []);
  const effectiveCurrent = current && !hasPendingDrafts;
  const staleNote = hasPendingDrafts ? STALE_DRAFTS_TEXT : !current ? STALE_MODEL_TEXT : null;
  const state = busy ? 'busy' : !run ? 'empty' : effectiveCurrent ? 'current' : 'stale';
  const showTable = (): void => {
    if (onShowTable) onShowTable();
    else focusResultsTable();
  };
  const advisories = Number.isFinite(localAdvisories) ? Math.max(0, Math.trunc(localAdvisories)) : 0;
  const errorLine =
    engineError && engineError.trim() !== '' ? (
      <p className="rs-error" data-testid="rs-engine-error" title={engineError}>
        <IconWarning size={14} />
        <span className="rs-error-text">{engineError}</span>
        {onShowAdvisories ? (
          <button type="button" className="rs-error-link link-button" onClick={onShowAdvisories}>
            Ver diagnósticos
          </button>
        ) : null}
      </p>
    ) : null;
  const advisoriesLine =
    advisories > 0 ? (
      <p className="rs-advisories small" data-testid="rs-advisories">
        <IconWarning size={13} />
        <span>{advisoriesText(advisories)}</span>
        {onShowAdvisories ? (
          <button type="button" className="rs-advisories-link link-button" onClick={onShowAdvisories}>
            Ver avisos
          </button>
        ) : null}
      </p>
    ) : null;
  const pill = min ? pillParts(min.text, min.below1, effectiveCurrent) : null;

  return (
    <div
      className="rs"
      role="group"
      aria-label="Resumen del cálculo"
      data-testid="result-summary"
      data-state={state}
      data-stale-reason={busy || !run || effectiveCurrent ? undefined : hasPendingDrafts ? 'drafts' : 'model'}
      data-collapsed={run && !busy && collapsed ? 'true' : undefined}
      data-compact={compact ? 'true' : undefined}
    >
      {busy ? (
        <p className="rs-empty" data-testid="calc-progress">
          <span className="gs-spinner" aria-hidden="true" /> {formatBusyText(elapsedSeconds ?? measuredSec, activeMethod)}
        </p>
      ) : !run || !min || !pill ? (
        <>
          {errorLine ?? <p className="rs-empty muted">Sin resultados. Pulse «Comprobar» para calcular el factor de seguridad (FS).</p>}
          {advisoriesLine}
        </>
      ) : (
        <>
          {collapsed ? (
            <button
              ref={pillRef}
              type="button"
              className="rs-pill"
              aria-expanded={false}
              aria-controls={bodyId}
              aria-label={pillLabel(pill)}
              onClick={toggleFold}
            >
              <span className="rs-pill-text gs-mono">{pill.figure}</span>
              {pill.status ? (
                <>
                  {' '}
                  <span className="gs-chip rs-chip rs-pill-chip" data-tone={effectiveCurrent ? 'nok' : 'warn'}>
                    {pill.status}
                  </span>
                </>
              ) : null}
              <IconChevronDown size={16} />
            </button>
          ) : (
            <div className="rs-head">
              <p className="gs-eyebrow rs-eyebrow">Factor de seguridad mínimo</p>
              <button
                ref={toggleRef}
                type="button"
                className="gs-icon-btn gs-btn-ghost rs-toggle"
                aria-expanded={true}
                aria-controls={bodyId}
                aria-label="Ocultar resultado"
                onClick={toggleFold}
              >
                <IconChevronDown size={16} />
              </button>
            </div>
          )}
          <div id={bodyId} className="rs-body" hidden={collapsed}>
            {errorLine}
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
                    <span className="rs-fs-label">FS</span> {fsText(fosByMethod.get(i.method) ?? null)}
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
            {advisoriesLine}
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
