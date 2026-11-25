import type { Load } from '../../engine/types';
import type { EditorStore } from '../types';
import { ErrorList, PanelSection, TextInput } from './Fields';
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

function LoadRow({ store, load, index, loads, units }: {
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
  const errorId = `load-err-${index}`;

  const commit = (): void => {
    if (outcome.ok && !loadsEqual(outcome.value, load)) store.dispatch(loadUpsertCommand(index, outcome.value));
  };
  const select = (): void => store.dispatch({ type: 'ui/select', selection: { kind: 'load', index } });
  const cell = (key: string, ariaLabel: string, mode: 'text' | 'decimal' = 'decimal') => (
    <TextInput
      value={(form as unknown as Record<string, string>)[key] ?? ''}
      mode={mode}
      ariaLabel={`Carga ${index + 1}: ${ariaLabel}`}
      invalid={key in errors}
      describedBy={errorId}
      onChange={(v) => setForm({ ...form, [key]: v } as LoadForm)}
      onCommit={commit}
      onReset={reset}
      onFocus={select}
    />
  );

  return (
    <>
      <tr className={selected ? 'ep-row-selected' : undefined}>
        <td>{index + 1}</td>
        <td>{LOAD_TYPE_LABELS[form.type]}</td>
        <td>{cell('id', 'id', 'text')}</td>
        {form.type === 'udl' ? (
          <>
            <td>{cell('x1', 'x1')}</td>
            <td>{cell('x2', 'x2')}</td>
            <td>{cell('q', `q (${units.stress})`)}</td>
            <td />
            <td />
          </>
        ) : (
          <>
            <td>{cell('x', 'x')}</td>
            <td />
            <td />
            <td>{cell('p', `p (${units.lineLoad})`)}</td>
            <td>{cell('angle', 'ángulo (°)')}</td>
          </>
        )}
        <td>
          <button type="button" aria-label={`Quitar la carga ${index + 1}`} onClick={() => store.dispatch(loadRemoveCommand(index))}>
            Quitar
          </button>
        </td>
      </tr>
      {Object.keys(errors).length > 0 ? (
        <tr>
          <td colSpan={9}>
            <ErrorList errors={errors} id={errorId} />
          </td>
        </tr>
      ) : null}
    </>
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
        <table className="ep-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Tipo</th>
              <th scope="col">id</th>
              <th scope="col">x1 / x ({units.length})</th>
              <th scope="col">x2 ({units.length})</th>
              <th scope="col">q ({units.stress})</th>
              <th scope="col">p ({units.lineLoad})</th>
              <th scope="col">ángulo (°)</th>
              <th scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loads.map((load, i) => (
              <LoadRow key={i} store={store} load={load} index={i} loads={loads} units={units} />
            ))}
          </tbody>
        </table>
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
