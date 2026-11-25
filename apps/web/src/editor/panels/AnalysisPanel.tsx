import type { Direction, MethodKind } from '../../engine/types';
import type { EditorStore } from '../types';
import { applyCommands } from './dispatch';
import { ErrorList, LabeledField, PanelSection } from './Fields';
import { useDraft, useStoreSelector } from './useStoreSelector';
import {
  DIRECTION_OPTIONS,
  METHOD_LABELS,
  METHOD_ORDER,
  analysisCommands,
  analysisFromForm,
  analysisToForm,
  toggleMethod,
  type AnalysisForm,
} from './forms';

export function AnalysisPanel({ store }: { store: EditorStore }) {
  const analysis = useStoreSelector(store, (s) => s.doc.analysis);
  const slope = useStoreSelector(store, (s) => s.doc.slope);
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

  return (
    <PanelSection title="Análisis">
      <fieldset className="field">
        <legend>Métodos</legend>
        {METHOD_ORDER.map((method: MethodKind) => (
          <label key={method} className="checkbox">
            <input
              type="checkbox"
              data-path={method === METHOD_ORDER[0] ? '/analysis/methods' : undefined}
              checked={form.methods.includes(method)}
              onChange={(e) => {
                const next = { ...form, methods: toggleMethod(form.methods, method, e.target.checked) };
                setForm(next);
                commitWith(next);
              }}
            />
            {METHOD_LABELS[method]}
          </label>
        ))}
        <ErrorList errors={err('methods') ? { methods: err('methods') ?? '' } : {}} />
      </fieldset>

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
