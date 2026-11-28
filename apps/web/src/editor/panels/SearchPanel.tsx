import { useEffect } from 'react';
import type { EditorStore } from '../types';
import { LabeledField, PanelSection } from './Fields';
import { useDraft, useStoreSelector } from './useStoreSelector';
import {
  GLOBAL_ALGORITHMS,
  GLOBAL_ALGORITHM_LABEL,
  GLOBAL_BUDGET_APPROX,
  GLOBAL_DEFAULTS,
  GLOBAL_GENERATED_MAX,
  GLOBAL_GENERATED_MIN,
} from '../../engine/globalSearch';
import {
  GLOBAL_FORM_EMPTY,
  MAX_AXIS_POINTS,
  formatCount,
  formatNumber,
  MAX_GRID_CANDIDATES,
  modelXRange,
  searchFromForm,
  searchCandidates,
  searchSetCommand,
  searchToForm,
  searchesEqual,
  setPendingDraft,
  unitLabels,
  withoutGlobal,
  type SearchForm,
} from './forms';

export function SearchPanel({ store }: { store: EditorStore }) {
  const search = useStoreSelector(store, (s) => s.doc.analysis.search ?? null);
  const methods = useStoreSelector(store, (s) => s.doc.analysis.methods);
  const bishopActive = (methods ?? ['bishop']).includes('bishop');
  const regions = useStoreSelector(store, (s) => s.doc.regions);
  const units = useStoreSelector(store, (s) => s.doc.units);
  const u = unitLabels(units);
  const [form, setForm, reset] = useDraft(() => (search ? searchToForm(search) : null), [search]);
  const xRange = modelXRange({ regions });
  const outcome = form ? searchFromForm(form, { xRange }) : null;
  const pending = Boolean(search && form && outcome && !outcome.ok && JSON.stringify(form) !== JSON.stringify(searchToForm(search)));
  useEffect(() => {
    setPendingDraft(store, 'search', pending ? 'Búsqueda' : null);
    return () => setPendingDraft(store, 'search', null);
  }, [store, pending]);

  if (search === null || form === null || outcome === null) {
    return (
      <PanelSection title="Búsqueda">
        <p className="muted">La búsqueda no está activa. Elija «Búsqueda» en el panel de superficie para editarla.</p>
      </PanelSection>
    );
  }

  const errors = outcome.ok ? {} : outcome.errors;
  const commitWith = (next: SearchForm): void => {
    const r = searchFromForm(next, { xRange: modelXRange(store.getState().doc) });
    if (r.ok && !searchesEqual(r.value, search)) store.dispatch(searchSetCommand(r.value));
  };
  const commit = (): void => commitWith(form);
  const selectRange = (which: 'entry' | 'exit') => (): void =>
    store.dispatch({ type: 'ui/select', selection: { kind: 'search_range', which } });
  const err = (key: string): string | undefined => (key in errors ? errors[key] : undefined);

  const count = (key: 'n_entry' | 'n_exit' | 'n_radius', label: string) => (
    <LabeledField
      key={key}
      label={label}
      path={`/analysis/search/${key}`}
      value={form[key]}
      hint={`1 a ${MAX_AXIS_POINTS}`}
      error={err(key)}
      onChange={(v) => setForm({ ...form, [key]: v })}
      onCommit={commit}
      onReset={reset}
    />
  );

  const range = (which: 'entry' | 'exit', label: string) => (
    <fieldset className="field" key={which}>
      <legend>
        {label} <span className="muted">({u.length}; vacío = todo el ancho del terreno)</span>
      </legend>
      <div className="ep-grid">
        <LabeledField
          label="Mínimo"
          path={`/analysis/search/${which}/lo`}
          value={form[which].lo}
          error={err(`${which}.lo`)}
          onChange={(v) => setForm({ ...form, [which]: { ...form[which], lo: v } })}
          onCommit={commit}
          onReset={reset}
          onFocus={selectRange(which)}
        />
        <LabeledField
          label="Máximo"
          path={`/analysis/search/${which}/hi`}
          value={form[which].hi}
          error={err(`${which}.hi`)}
          onChange={(v) => setForm({ ...form, [which]: { ...form[which], hi: v } })}
          onCommit={commit}
          onReset={reset}
          onFocus={selectRange(which)}
        />
      </div>
    </fieldset>
  );

  return (
    <PanelSection title="Búsqueda">
      {range('entry', 'Entrada (coronamiento)')}
      {range('exit', 'Salida (pie)')}
      {xRange ? (
        <p className="muted small">
          Extensión x del modelo: [{formatNumber(xRange[0])}; {formatNumber(xRange[1])}] {u.length}.
        </p>
      ) : null}
      <div className="ep-grid">
        {count('n_entry', 'Puntos de entrada')}
        {count('n_exit', 'Puntos de salida')}
        {count('n_radius', 'Radios por par')}
        <LabeledField
          label="Factor de radio máximo"
          path="/analysis/search/max_radius_factor"
          value={form.max_radius_factor}
          hint="Mayor que 0,51"
          error={err('max_radius_factor')}
          onChange={(v) => setForm({ ...form, max_radius_factor: v })}
          onCommit={commit}
          onReset={reset}
        />
        <LabeledField
          label="Ancho mínimo"
          path="/analysis/search/min_width"
          unit={u.length}
          value={form.min_width}
          hint="Vacío = 1 % del ancho del modelo"
          error={err('min_width')}
          onChange={(v) => setForm({ ...form, min_width: v })}
          onCommit={commit}
          onReset={reset}
        />
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={form.refine}
          onChange={(e) => {
            const next = { ...form, refine: e.target.checked };
            setForm(next);
            commitWith(next);
          }}
        />
        Refinar el mínimo por patrones
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          data-path="/analysis/search/non_circular"
          checked={form.non_circular ?? false}
          onChange={e => {
            const next = { ...form, non_circular: e.target.checked };
            setForm(next); commitWith(next);
          }}
        />
        Superficie no circular
      </label>
      {form.non_circular && bishopActive ? (
        <p className="ep-error" role="alert" data-testid="non-circular-bishop-note">
          Bishop simplificado no se admite con búsqueda no circular (la superficie crítica es una polilínea). Desmarque Bishop en el panel «Análisis».
        </p>
      ) : null}
      {form.non_circular ? <div className="ep-grid">
        <LabeledField
          label="Semillas"
          path="/analysis/search/non_circular/seeds"
          value={form.seeds ?? ''}
          hint="Entero de 1 a 10; vacío = 3"
          error={err('seeds')}
          onChange={v => setForm({ ...form, seeds: v })}
          onCommit={commit}
          onReset={reset}
        />
        <label className="field ep-field"><span>Máximo de vértices</span>
          <select
            data-path="/analysis/search/non_circular/max_vertices"
            value={form.max_vertices || '33'}
            onChange={e => { const next = { ...form, max_vertices: e.target.value }; setForm(next); commitWith(next); }}
            onKeyDown={(e) => { if (e.key === 'Escape') reset(); }}
          >
            <option value="9">9</option><option value="17">17</option><option value="33">33</option>
          </select>
        </label>
      </div> : null}
      {form.non_circular ? (
        <fieldset className="field" data-testid="global-search">
          <legend className="visually-hidden">Búsqueda global</legend>
          <label className="checkbox">
            <input
              type="checkbox"
              data-path="/analysis/search/non_circular/global"
              checked={form.global ?? false}
              aria-describedby="global-search-help"
              onChange={(e) => {
                const next: SearchForm = e.target.checked ? { ...form, ...GLOBAL_FORM_EMPTY } : withoutGlobal(form);
                setForm(next);
                commitWith(next);
              }}
            />
            Búsqueda global
          </label>
          <p className="muted small" id="global-search-help">
            Genera superficies sobre capas o contactos débiles y las refina; el resultado nunca es peor que el del refinamiento.
            Cuesta hasta unas {formatCount(GLOBAL_BUDGET_APPROX)} evaluaciones más por método.
          </p>
          {form.global ? (
            <>
              <label className="field ep-field">
                <span>Algoritmo</span>
                <select
                  data-path="/analysis/search/non_circular/global/algorithm"
                  value={form.global_algorithm || GLOBAL_DEFAULTS.algorithm}
                  onChange={(e) => {
                    const next = { ...form, global_algorithm: e.target.value === GLOBAL_DEFAULTS.algorithm ? '' : e.target.value };
                    setForm(next);
                    commitWith(next);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') reset();
                  }}
                >
                  {GLOBAL_ALGORITHMS.map((a) => (
                    <option key={a} value={a}>
                      {GLOBAL_ALGORITHM_LABEL[a]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ep-grid">
                <LabeledField
                  label="Candidatos"
                  path="/analysis/search/non_circular/global/generated"
                  value={form.global_generated ?? ''}
                  hint={`Entero de ${GLOBAL_GENERATED_MIN} a ${formatCount(GLOBAL_GENERATED_MAX)}; vacío = ${GLOBAL_DEFAULTS.generated}`}
                  error={err('global_generated')}
                  onChange={(v) => setForm({ ...form, global_generated: v })}
                  onCommit={commit}
                  onReset={reset}
                />
                <LabeledField
                  label="Semilla"
                  path="/analysis/search/non_circular/global/seed"
                  value={form.global_seed ?? ''}
                  hint={`Entero de 0 a 2^53 − 1; vacío = ${GLOBAL_DEFAULTS.seed}`}
                  error={err('global_seed')}
                  onChange={(v) => setForm({ ...form, global_seed: v })}
                  onCommit={commit}
                  onReset={reset}
                />
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  data-path="/analysis/search/non_circular/global/polish"
                  checked={form.global_polish ?? GLOBAL_DEFAULTS.polish}
                  onChange={(e) => {
                    // El valor por defecto (pulir) no se escribe: al volver a marcarla, el campo queda ausente.
                    const { global_polish: _omit, ...rest } = form;
                    const next: SearchForm = e.target.checked ? rest : { ...rest, global_polish: false };
                    setForm(next);
                    commitWith(next);
                  }}
                />
                Pulido
              </label>
            </>
          ) : null}
        </fieldset>
      ) : null}
      {pending ? (
        <p className="ep-note small" role="status" data-testid="search-pending">
          Hay cambios de esta tarjeta sin aplicar al modelo: corrija los errores para guardarlos.
        </p>
      ) : null}
      <p className="muted small">
        Rejilla: {outcome.ok ? formatCount(searchCandidates(outcome.value)) : '—'} candidatos
        (máximo {formatCount(MAX_GRID_CANDIDATES)}).
      </p>
    </PanelSection>
  );
}
