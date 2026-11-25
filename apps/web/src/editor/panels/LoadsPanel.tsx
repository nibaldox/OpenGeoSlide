import { useId } from 'react';
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
  formatNumber,
  loadUpsertCommand,
  loadsEqual,
  modelXRange,
  rangeText,
  terrainRanges,
  unitLabels,
  type LoadForm,
  type TerrainRanges,
  type UnitLabels,
} from './forms';

const NO_LOADS: readonly Load[] = [];

/**
 * Aviso (no bloquea) cuando la carga cae sobre el terreno pero fuera de la corona, por ejemplo sobre la cara del talud.
 * Los valores fuera del terreno los rechaza `loadFromForm`. `null` si la carga está sobre la corona o no se puede leer.
 */
export function loadPlacementHint(form: LoadForm, ranges: TerrainRanges, unit: string): string | null {
  if (!ranges.crown) return null;
  const xs = (form.type === 'udl' ? [form.x1, form.x2] : [form.x]).map((t) => Number(t.trim().replace(',', '.')));
  if (xs.some((x) => !Number.isFinite(x))) return null;
  const tol = 1e-9 * Math.max(1, Math.abs(ranges.terrain[1] - ranges.terrain[0]));
  const onCrown = xs.every((x) => x >= ranges.crown![0] - tol && x <= ranges.crown![1] + tol);
  const onTerrain = xs.every((x) => x >= ranges.terrain[0] - tol && x <= ranges.terrain[1] + tol);
  if (onCrown || !onTerrain) return null;
  return `La carga no queda sobre la corona (${rangeText(ranges.crown, unit)}): actúa sobre la cara del talud. Si no es lo que busca, use el botón de la corona.`;
}

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
  const ranges = terrainRanges({ regions });
  const crown = ranges?.crown ?? null;
  const baseId = useId();

  const commit = (): void => {
    if (outcome.ok && !loadsEqual(outcome.value, load)) store.dispatch(loadUpsertCommand(index, outcome.value));
  };
  const select = (): void => store.dispatch({ type: 'ui/select', selection: { kind: 'load', index } });
  // UX9-03: «Usar la corona» rellena x1 y x2 (o centra la carga lineal) y confirma el cambio, como Intro en el campo.
  const useCrown = (): void => {
    if (!crown) return;
    const next: LoadForm =
      form.type === 'udl'
        ? { ...form, x1: formatNumber(crown[0]), x2: formatNumber(crown[1]) }
        : { ...form, x: formatNumber((crown[0] + crown[1]) / 2) };
    setForm(next);
    select();
    const out = loadFromForm(next, { xRange: modelXRange({ regions }), otherIds, index });
    if (out.ok && !loadsEqual(out.value, load)) store.dispatch(loadUpsertCommand(index, out.value));
  };
  const hint = ranges ? loadPlacementHint(form, ranges, units.length) : null;
  const field = (key: string, label: string, unit?: string, mode: 'text' | 'decimal' = 'decimal') => (
    <LabeledField
      key={key}
      label={label}
      scope={`Carga ${index + 1}`}
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
      {ranges ? (
        <div className="ep-placement">
          <p className="muted small" id={`${baseId}-range`}>
            Terreno: {rangeText(ranges.terrain, units.length)}.{' '}
            {crown ? `Corona: ${rangeText(crown, units.length)}.` : 'El terreno no tiene un tramo plano en lo alto (sin corona).'}
          </p>
          <button
            type="button"
            disabled={!crown}
            aria-describedby={`${baseId}-range`}
            aria-label={`${form.type === 'udl' ? 'Usar la corona' : 'Centrar en la corona'} para la carga ${index + 1}`}
            onClick={useCrown}
          >
            {form.type === 'udl' ? 'Usar la corona' : 'Centrar en la corona'}
          </button>
          {hint ? <p className="ep-note small">{hint}</p> : null}
        </div>
      ) : null}
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
