import type { Load } from '../../engine/types';
import type { EditorStore } from '../types';
import { LabeledField, PanelSection } from './Fields';
import { useDraft, useStoreSelector } from './useStoreSelector';
import {
  LOAD_TYPE_LABELS,
  defaultLoad,
  loadFromForm,
  loadRemoveCommand,
  loadToForm,
  loadUpsertCommand,
  loadsEqual,
  modelXRange,
  unitLabels,
  type LoadForm,
  type UnitLabels,
} from './forms';

const NO_LOADS: readonly Load[] = [];

/** Una carga como tarjeta apilada con etiquetas visibles (R7-13): sin tabla de 9 columnas dentro del lateral. */
function LoadCard({ store, load, index, loads, units }: {
  store: EditorStore;
  load: Load;
  index: number;
  loads: readonly Load[];
  units: UnitLabels;
}) {
  const regions = useStoreSelector(store, (s) => s.doc.regions);
  const selected = useStoreSelector(store, (s) => s.ui.selection.kind === 'load' && s.ui.selection.index === index);
  const [form, setForm, reset] = useDraft<LoadForm>(() => loadToForm(load), [load]);
  const otherIds = loads.flatMap((l, i) => (i !== index && l.id ? [l.id] : []));
  const outcome = loadFromForm(form, { xRange: modelXRange({ regions }), otherIds, index });
  const errors = outcome.ok ? {} : outcome.errors;

  const commit = (): void => {
    if (outcome.ok && !loadsEqual(outcome.value, load)) store.dispatch(loadUpsertCommand(index, outcome.value));
  };
  const select = (): void => store.dispatch({ type: 'ui/select', selection: { kind: 'load', index } });
  const field = (key: string, label: string, unit?: string, mode: 'text' | 'decimal' = 'decimal') => (
    <LabeledField
      key={key}
      label={label}
      unit={unit}
      mode={mode}
      value={(form as unknown as Record<string, string>)[key] ?? ''}
      path={`/loads/${index}/${key}`}
      error={key in errors ? errors[key] : undefined}
      onChange={(v) => setForm({ ...form, [key]: v } as LoadForm)}
      onCommit={commit}
      onReset={reset}
      onFocus={select}
    />
  );

  return (
    <fieldset className={selected ? 'ep-card ep-row-selected' : 'ep-card'}>
      <legend>
        Carga {index + 1}: {LOAD_TYPE_LABELS[form.type]}
      </legend>
      <div className="ep-grid">
        {field('id', 'Identificador (id)', undefined, 'text')}
        {form.type === 'udl' ? (
          <>
            {field('x1', 'Inicio x1', units.length)}
            {field('x2', 'Fin x2', units.length)}
            {field('q', 'Carga q', units.stress)}
          </>
        ) : (
          <>
            {field('x', 'Posición x', units.length)}
            {field('p', 'Carga p', units.lineLoad)}
            {field('angle', 'Ángulo', '°')}
          </>
        )}
      </div>
      <div className="ep-actions">
        <button type="button" aria-label={`Quitar la carga ${index + 1}`} onClick={() => store.dispatch(loadRemoveCommand(index))}>
          Quitar
        </button>
      </div>
    </fieldset>
  );
}

export function LoadsPanel({ store }: { store: EditorStore }) {
  const loads = useStoreSelector(store, (s) => s.doc.loads ?? NO_LOADS);
  const regions = useStoreSelector(store, (s) => s.doc.regions);
  const units = unitLabels(useStoreSelector(store, (s) => s.doc.units));
  const canAdd = modelXRange({ regions }) !== null;
  const add = (type: Load['type']): void => {
    const load = defaultLoad(type, store.getState().doc);
    if (load) store.dispatch(loadUpsertCommand(null, load));
  };

  return (
    <PanelSection title="Cargas">
      {loads.length === 0 ? (
        <p className="muted">Sin cargas.</p>
      ) : (
        <div className="ep-cards">
          {loads.map((load, i) => (
            <LoadCard key={i} store={store} load={load} index={i} loads={loads} units={units} />
          ))}
        </div>
      )}
      <div className="ep-actions">
        <button type="button" disabled={!canAdd} onClick={() => add('udl')}>
          Agregar carga distribuida
        </button>
        <button type="button" disabled={!canAdd} onClick={() => add('line')}>
          Agregar carga lineal
        </button>
      </div>
      <p className="muted small">
        Distribuida: vertical sobre el terreno entre x1 y x2 (q ≥ 0). Lineal: en (x, cota del terreno), p ≥ 0; el
        ángulo, de −90° a 90°, se mide desde la vertical hacia abajo y es positivo hacia +x. Las cargas no reciben sismo.
      </p>
    </PanelSection>
  );
}
