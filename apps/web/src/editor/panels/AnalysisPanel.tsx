import { useId } from 'react';
import type { Direction, IntersliceFunction, MethodKind, Point } from '../../engine/types';
import type { EditorStore } from '../types';
import { applyCommands } from './dispatch';
import { ErrorList, LabeledField, PanelSection, TextInput } from './Fields';
import { useDraft, useStoreSelector } from './useStoreSelector';
import {
  DIRECTION_OPTIONS,
  INTERSLICE_OPTIONS,
  METHOD_LABELS,
  METHOD_ORDER,
  analysisCommands,
  analysisFromForm,
  analysisToForm,
  dataPointsCommand,
  dataPointsFromForm,
  dataPointsToForm,
  insertDataPoint,
  intersliceFunctionCommand,
  intersliceFunctionOf,
  methodDisabledReason,
  removeDataPoint,
  toggleMethod,
  type AnalysisForm,
} from './forms';

const NO_POINTS: readonly Point[] = [];

function samePoints(a: readonly Point[], b: readonly Point[]): boolean {
  return a.length === b.length && a.every((p, i) => p[0] === b[i]?.[0] && p[1] === b[i]?.[1]);
}

/**
 * Función de fuerzas entre dovelas de Morgenstern-Price (F3.4): selector de las cinco funciones y, con «Definida por puntos», la tabla de
 * puntos (ξ, f) editable y validada (ξ creciente de 0 a 1, f ≥ 0 y algún f > 0).
 */
function IntersliceSection({ store }: { store: EditorStore }) {
  const selectId = useId();
  const interslice = useStoreSelector(store, (s) => s.doc.analysis.interslice ?? null);
  const fn: IntersliceFunction = interslice?.function ?? intersliceFunctionOf({});
  const points = interslice?.function === 'data_points' ? (interslice.points ?? NO_POINTS) : NO_POINTS;
  const [rows, setRows, resetRows] = useDraft(() => dataPointsToForm(points), [interslice]);
  const table = dataPointsFromForm(rows);
  const tableErrors = table.ok ? {} : table.errors;
  const commitRows = (): void => {
    if (table.ok && !samePoints(points, table.value)) store.dispatch(dataPointsCommand(table.value));
  };

  return (
    <fieldset className="field">
      <legend>Morgenstern-Price: función entre dovelas</legend>
      <div className="field ep-field">
        <label htmlFor={selectId}>Función de fuerzas entre dovelas f(ξ)</label>
        <select
          id={selectId}
          value={fn}
          data-path="/analysis/interslice"
          onChange={(e) => store.dispatch(intersliceFunctionCommand(store.getState().doc, e.target.value as IntersliceFunction))}
        >
          {INTERSLICE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="muted small">La fuerza vertical entre dovelas es X = λ·f(ξ)·E, con ξ de 0 en la primera dovela a 1 en la última. Sin elegir, se usa el medio seno.</span>
      </div>
      {fn === 'data_points' ? (
        <>
          <div className="ep-table-wrap" role="region" aria-label="Puntos de la función entre dovelas" tabIndex={0}>
            <table className="ep-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">ξ (0 a 1)</th>
                  <th scope="col">f</th>
                  <th scope="col">
                    <span className="visually-hidden">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const remaining = removeDataPoint(points, i);
                  return (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      {(['xi', 'f'] as const).map((col) => (
                        <td key={col}>
                          <TextInput
                            value={row[col]}
                            ariaLabel={`Función entre dovelas, punto ${i + 1}: ${col === 'xi' ? 'ξ' : 'f'}`}
                            path={`/analysis/interslice/points/${i}/${col === 'xi' ? 0 : 1}`}
                            invalid={`${i}.${col}` in tableErrors}
                            onChange={(v) => setRows(rows.map((r, j) => (j === i ? { ...r, [col]: v } : r)))}
                            onCommit={commitRows}
                            onReset={resetRows}
                          />
                        </td>
                      ))}
                      <td>
                        <button
                          type="button"
                          disabled={i >= points.length - 1}
                          title={i >= points.length - 1 ? 'Agregue el punto antes del último' : 'Agregar un punto a medio camino del siguiente'}
                          aria-label={`Agregar un punto después del punto ${i + 1} de la función entre dovelas`}
                          onClick={() => store.dispatch(dataPointsCommand(insertDataPoint(points, i)))}
                        >
                          Agregar
                        </button>{' '}
                        <button
                          type="button"
                          disabled={remaining === null}
                          title={remaining === null ? 'Mínimo 2 puntos' : 'Quitar punto'}
                          aria-label={`Quitar el punto ${i + 1} de la función entre dovelas`}
                          onClick={() => remaining && store.dispatch(dataPointsCommand(remaining))}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ErrorList errors={tableErrors} />
          <p className="muted small">Al menos 2 puntos: ξ estrictamente creciente de 0 a 1, f igual o mayor que 0 y algún f mayor que 0. La función es lineal entre puntos.</p>
        </>
      ) : null}
    </fieldset>
  );
}

export function AnalysisPanel({ store }: { store: EditorStore }) {
  const analysis = useStoreSelector(store, (s) => s.doc.analysis);
  const slope = useStoreSelector(store, (s) => s.doc.slope);
  const noteId = useId();
  const [form, setForm, reset] = useDraft(() => analysisToForm(store.getState().doc), [analysis, slope]);
  const outcome = analysisFromForm(form);
  const errors = outcome.ok ? {} : outcome.errors;

  const commitWith = (next: AnalysisForm): void => {
    const r = analysisFromForm(next);
    if (r.ok) applyCommands(store, 'Editar el análisis', analysisCommands(store.getState().doc, r.value));
  };
  const commit = (): void => commitWith(form);
  const err = (key: string): string | undefined => (key in errors ? errors[key] : undefined);
  const field = (key: 'slices' | 'tolerance' | 'max_iterations' | 'min_m_alpha', label: string, hint: string) => (
    <LabeledField
      label={label}
      path={`/analysis/${key}`}
      value={form[key]}
      hint={hint}
      error={err(key)}
      onChange={(v) => setForm({ ...form, [key]: v })}
      onCommit={commit}
      onReset={reset}
    />
  );
  // F3.6: con una polilínea fija Bishop no se ofrece. Si ya está marcado (archivo ajeno) sigue habilitado para poder quitarlo.
  const bishopReason = methodDisabledReason('bishop', analysis);

  return (
    <PanelSection title="Análisis">
      <fieldset className="field">
        <legend>Métodos</legend>
        {METHOD_ORDER.map((method: MethodKind) => {
          const checked = form.methods.includes(method);
          const reason = methodDisabledReason(method, analysis);
          return (
            <label key={method} className="checkbox">
              <input
                type="checkbox"
                data-path={method === METHOD_ORDER[0] ? '/analysis/methods' : undefined}
                checked={checked}
                disabled={reason !== null && !checked}
                aria-describedby={reason !== null ? noteId : undefined}
                onChange={(e) => {
                  const next = { ...form, methods: toggleMethod(form.methods, method, e.target.checked) };
                  setForm(next);
                  commitWith(next);
                }}
              />
              {METHOD_LABELS[method]}
            </label>
          );
        })}
        {bishopReason !== null ? (
          <p id={noteId} className={form.methods.includes('bishop') ? 'ep-error' : 'muted small'}>
            {bishopReason}
            {form.methods.includes('bishop') ? ' Desmarque Bishop para poder comprobar el modelo.' : ''}
          </p>
        ) : null}
        <ErrorList errors={err('methods') ? { methods: err('methods') ?? '' } : {}} />
      </fieldset>

      {form.methods.includes('morgenstern_price') ? <IntersliceSection store={store} /> : null}

      <div className="ep-grid">
        {field('slices', 'Dovelas', 'Entero de 3 a 2000')}
        {field('tolerance', 'Tolerancia', 'Mayor que 0 y hasta 0,01')}
        {field('max_iterations', 'Iteraciones máximas', 'Entero de 1 a 100000')}
        {field('min_m_alpha', 'm_α mínimo', 'Mayor que 0 y hasta 1')}
      </div>

      <label className="field ep-field">
        <span>Sentido del deslizamiento</span>
        <select
          value={form.direction}
          onChange={(e) => {
            const next = { ...form, direction: e.target.value as Direction };
            setForm(next);
            commitWith(next);
          }}
        >
          {DIRECTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </PanelSection>
  );
}
