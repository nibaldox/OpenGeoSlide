import { useEffect } from 'react';
import type { EditorStore } from '../types';
import { LabeledField, PanelSection } from './Fields';
import { useDraft, useStoreSelector } from './useStoreSelector';
import {
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
  type SearchForm,
} from './forms';

export function SearchPanel({ store }: { store: EditorStore }) {
  const search = useStoreSelector(store, (s) => s.doc.analysis.search ?? null);
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
        <input type="checkbox" checked={form.non_circular ?? false} onChange={e => {
          const next = { ...form, non_circular: e.target.checked };
          setForm(next); commitWith(next);
        }} />
        Superficie no circular
      </label>
      {form.non_circular ? <div className="ep-grid">
        <LabeledField label="Semillas" value={form.seeds ?? ''} hint="Entero de 1 a 10; vacío = 3" error={err('seeds')} onChange={v => setForm({ ...form, seeds: v })} onCommit={commit} onReset={reset} />
        <label className="field ep-field"><span>Máximo de vértices</span>
          <select value={form.max_vertices || '33'} onChange={e => { const next = { ...form, max_vertices: e.target.value }; setForm(next); commitWith(next); }}>
            <option value="9">9</option><option value="17">17</option><option value="33">33</option>
          </select>
        </label>
      </div> : null}
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
