import { useEffect, useId } from 'react';
import type { Direction, IntersliceFunction, MethodKind, Point } from '../../engine/types';
import type { EditorStore } from '../types';
import { crackEditCommands } from './crackWater';
import { applyCommands } from './dispatch';
import { ErrorList, LabeledField, PanelSection, RowsPendingNote, TextInput } from './Fields';
import { useDraft, useStoreSelector } from './useStoreSelector';
import {
  CRACK_DEFAULT_FIXED_DEPTH,
  DIRECTION_OPTIONS,
  INTERSLICE_OPTIONS,
  METHOD_LABELS,
  METHOD_ORDER,
  analysisCommands,
  analysisFromForm,
  analysisToForm,
  crackFromForm,
  crackToForm,
  dataPointsCommand,
  dataPointsFromForm,
  dataPointsToForm,
  canInsertDataPoint,
  formatNumber,
  hasNonLinearStrength,
  initialCrackForm,
  insertDataPoint,
  intersliceFunctionCommand,
  intersliceFunctionOf,
  methodDisabledReason,
  removeDataPoint,
  ROWS_PENDING_REASON,
  setPendingDraft,
  toggleMethod,
  unitLabels,
  type AnalysisForm,
  type CrackForm,
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
  const rowsPending = fn === 'data_points' && !table.ok && JSON.stringify(rows) !== JSON.stringify(dataPointsToForm(points));
  const pendingNoteId = useId();
  // Agregar o quitar puntos reemplaza las filas con las del documento: con un borrador sin aplicar se pierde, así que se deshabilita.
  const rowsReason = rowsPending ? ROWS_PENDING_REASON : undefined;
  const rowsDescribedBy = rowsPending ? pendingNoteId : undefined;
  useEffect(() => {
    setPendingDraft(store, 'analysis:interslice', rowsPending ? 'Función entre dovelas' : null);
    return () => setPendingDraft(store, 'analysis:interslice', null);
  }, [store, rowsPending]);
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
                          disabled={rowsPending || !canInsertDataPoint(points, i)}
                          title={
                            rowsReason ??
                            (i >= points.length - 1
                              ? 'Agregue el punto antes del último'
                              : canInsertDataPoint(points, i)
                                ? 'Agregar un punto a medio camino del siguiente'
                                : 'No cabe un punto entre estos dos: ξ debe seguir creciendo')
                          }
                          aria-describedby={rowsDescribedBy}
                          aria-label={`Agregar un punto después del punto ${i + 1} de la función entre dovelas`}
                          onClick={() => store.dispatch(dataPointsCommand(insertDataPoint(points, i)))}
                        >
                          Agregar
                        </button>{' '}
                        <button
                          type="button"
                          disabled={remaining === null || rowsPending}
                          title={rowsReason ?? (remaining === null ? 'Mínimo 2 puntos' : 'Quitar punto')}
                          aria-describedby={rowsDescribedBy}
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
          <RowsPendingNote id={pendingNoteId} pending={rowsPending} />
          <p className="muted small">Al menos 2 puntos: ξ estrictamente creciente de 0 a 1, f igual o mayor que 0 y algún f mayor que 0. La función es lineal entre puntos.</p>
        </>
      ) : null}
    </fieldset>
  );
}

/**
 * Grieta de tracción (v0.5, F5.7): casilla, profundidad (un número o «Automática») y fracción de agua (de 0 a 1, en 1 al crearla). Cada
 * cambio válido se confirma al instante (casilla y lista) o al salir del campo; un valor fuera de rango muestra el texto del motor y no
 * se guarda. La posición de la grieta no se escribe: sale de la superficie y de la profundidad.
 */
function CrackSection({ store }: { store: EditorStore }) {
  const base = useId();
  const crack = useStoreSelector(store, (s) => s.doc.analysis.tension_crack ?? null);
  const materials = useStoreSelector(store, (s) => s.doc.materials);
  const hasNonLinear = hasNonLinearStrength(materials);
  const units = useStoreSelector(store, (s) => s.doc.units);
  const u = unitLabels(units);
  const [form, setForm, reset] = useDraft(() => crackToForm(store.getState().doc), [crack]);
  const outcome = crackFromForm(form);
  const errors = outcome.ok ? {} : outcome.errors;
  const crackPending = !outcome.ok && JSON.stringify(form) !== JSON.stringify(crackToForm(store.getState().doc));
  useEffect(() => {
    setPendingDraft(store, 'analysis:crack', crackPending ? 'Grieta de tracción' : null);
    return () => setPendingDraft(store, 'analysis:crack', null);
  }, [store, crackPending]);
  const commitWith = (next: CrackForm): void => {
    const r = crackFromForm(next);
    if (r.ok) applyCommands(store, 'Editar la grieta de tracción', crackEditCommands(store.getState().doc, r.value));
  };
  const checkId = `${base}-on`;
  const modeId = `${base}-mode`;
  const noteId = `${base}-note`;

  return (
    <fieldset className="field">
      <legend>Grieta de tracción</legend>
      <div className="checkbox">
        <input
          id={checkId}
          type="checkbox"
          data-path="/analysis/tension_crack"
          checked={form.enabled}
          aria-describedby={noteId}
          onChange={(e) => {
            const next: CrackForm = e.target.checked
              ? initialCrackForm(store.getState().doc)
              : { ...form, enabled: false };
            setForm(next);
            commitWith(next);
          }}
        />
        <label htmlFor={checkId}>Incluir grieta de tracción</label>
      </div>
      <span id={noteId} className="muted small">
        Grieta vertical en la cresta de la masa deslizante: se quita el suelo del lado de la cresta y, si tiene agua, su empuje horizontal
        actúa a favor del deslizamiento. Su posición sale de la superficie y de la profundidad.
      </span>
      {form.enabled ? (
        <>
          {hasNonLinear ? (
            <p className={form.auto ? 'ep-error' : 'ep-note small'} role={form.auto ? 'alert' : 'status'} data-testid="crack-f65-note">
              {form.auto
                ? 'La profundidad automática (Rankine) no se admite con materiales Hoek-Brown o SHANSEP: elija una profundidad fija.'
                : 'Con materiales Hoek-Brown o SHANSEP la grieta usa una profundidad fija (la profundidad automática de Rankine requiere c y φ constantes).'}
            </p>
          ) : null}
          <div className="ep-grid">
            <div className="field ep-field">
              <label htmlFor={modeId}>Tipo de profundidad de la grieta</label>
              <select
                id={modeId}
                value={form.auto ? 'auto' : 'fixed'}
                onChange={(e) => {
                  const auto = e.target.value === 'auto';
                  const next: CrackForm = { ...form, auto, depth: auto || form.depth.trim() !== '' ? form.depth : formatNumber(CRACK_DEFAULT_FIXED_DEPTH) };
                  setForm(next);
                  commitWith(next);
                }}
              >
                <option value="fixed">Fija (un valor)</option>
                <option value="auto" disabled={hasNonLinear && !form.auto}>
                  Automática
                </option>
              </select>
              {form.auto ? (
                <span className="muted small">Automática: z = 2c/(γ·tan(45° − φ/2)) − q/γ, con el suelo y las sobrecargas de cada x.</span>
              ) : null}
            </div>
            {form.auto ? null : (
              <LabeledField
                label="Profundidad de la grieta"
                unit={u.length}
                path="/analysis/tension_crack/depth"
                value={form.depth}
                hint="Mayor que 0"
                error={'depth' in errors ? errors.depth : undefined}
                onChange={(v) => setForm({ ...form, depth: v })}
                onCommit={() => commitWith(form)}
                onReset={reset}
              />
            )}
            <LabeledField
              label="Fracción de agua en la grieta"
              path="/analysis/tension_crack/water_fill"
              value={form.water_fill}
              hint="De 0 a 1: 0 es seca y 1 es llena (lo más conservador)"
              error={'water_fill' in errors ? errors.water_fill : undefined}
              onChange={(v) => setForm({ ...form, water_fill: v })}
              onCommit={() => commitWith(form)}
              onReset={reset}
            />
          </div>
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
  const analysisPending = !outcome.ok && JSON.stringify(form) !== JSON.stringify(analysisToForm(store.getState().doc));
  useEffect(() => {
    setPendingDraft(store, 'analysis', analysisPending ? 'Análisis' : null);
    return () => setPendingDraft(store, 'analysis', null);
  }, [store, analysisPending]);

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

      <CrackSection store={store} />

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
