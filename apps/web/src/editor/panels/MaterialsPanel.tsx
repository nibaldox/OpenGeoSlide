import { useState } from 'react';
import type { Material } from '../../engine/types';
import type { EditorStore } from '../types';
import { ErrorList, PanelSection, TextInput } from './Fields';
import { useDraft, useStoreSelector } from './useStoreSelector';
import {
  materialFromForm,
  materialRemoveCommand,
  materialToForm,
  materialUpsertCommand,
  materialUsage,
  materialsEqual,
  newMaterialForm,
  regionMaterialCommand,
  unitLabels,
  type MaterialForm,
} from './forms';

const FIELD_LABELS: ReadonlyArray<{ key: keyof MaterialForm; short: string; mode: 'text' | 'decimal' }> = [
  { key: 'name', short: 'nombre', mode: 'text' },
  { key: 'unit_weight', short: 'peso unitario', mode: 'decimal' },
  { key: 'unit_weight_sat', short: 'peso unitario saturado', mode: 'decimal' },
  { key: 'cohesion', short: 'cohesión', mode: 'decimal' },
  { key: 'friction_angle', short: 'ángulo de fricción', mode: 'decimal' },
  { key: 'ru', short: 'ru', mode: 'decimal' },
];

function MaterialRow({ store, material, otherIds, usedBy }: {
  store: EditorStore;
  material: Material;
  otherIds: readonly string[];
  usedBy: readonly number[];
}) {
  const [form, setForm, reset] = useDraft(() => materialToForm(material), [material]);
  const selected = useStoreSelector(store, (s) => s.ui.selection.kind === 'material' && s.ui.selection.materialId === material.id);
  const outcome = materialFromForm(form, { otherIds, editing: material });
  const errors = outcome.ok ? {} : outcome.errors;
  const errorId = `mat-err-${material.id}`;

  const commit = (): void => {
    if (!outcome.ok || materialsEqual(outcome.value, material)) return;
    store.dispatch(materialUpsertCommand(outcome.value));
  };
  const select = (): void => store.dispatch({ type: 'ui/select', selection: { kind: 'material', materialId: material.id } });
  const remove = materialRemoveCommand(store.getState().doc, material.id);

  return (
    <>
      <tr className={selected ? 'ep-row-selected' : undefined}>
        <td>
          <TextInput value={form.id} readOnly mode="text" ariaLabel={`Material ${material.id}: id`} onChange={() => undefined} onFocus={select} />
        </td>
        {FIELD_LABELS.map(({ key, short, mode }) => (
          <td key={key}>
            <TextInput
              value={form[key]}
              mode={mode}
              ariaLabel={`Material ${material.id}: ${short}`}
              invalid={key in errors}
              describedBy={errorId}
              onChange={(v) => setForm({ ...form, [key]: v })}
              onCommit={commit}
              onReset={reset}
              onFocus={select}
            />
          </td>
        ))}
        <td>
          <button
            type="button"
            disabled={remove === null || usedBy.length > 0}
            title={usedBy.length > 0 ? `En uso por ${usedBy.map((i) => `la región ${i + 1}`).join(', ')}` : 'Quitar material'}
            aria-label={`Quitar el material ${material.id}`}
            onClick={() => {
              if (remove) store.dispatch(remove);
            }}
          >
            Quitar
          </button>
        </td>
      </tr>
      {Object.keys(errors).length > 0 ? (
        <tr>
          <td colSpan={FIELD_LABELS.length + 2}>
            <ErrorList errors={errors} id={errorId} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function NewMaterial({ store, ids }: { store: EditorStore; ids: readonly string[] }) {
  const [form, setForm] = useState<MaterialForm | null>(null);
  if (form === null) {
    return (
      <div className="ep-actions">
        <button type="button" onClick={() => setForm(newMaterialForm(ids))}>
          Nuevo material…
        </button>
      </div>
    );
  }
  const outcome = materialFromForm(form, { otherIds: ids, editing: null });
  const errors = outcome.ok ? {} : outcome.errors;
  const entries: ReadonlyArray<{ key: keyof MaterialForm; short: string; mode: 'text' | 'decimal' }> = [
    { key: 'id', short: 'id', mode: 'text' },
    ...FIELD_LABELS,
  ];
  return (
    <fieldset className="field ep-new">
      <legend>Nuevo material</legend>
      <div className="ep-grid">
        {entries.map(({ key, short, mode }) => (
          <label key={key} className="field ep-field">
            <span>{short}</span>
            <TextInput
              value={form[key]}
              mode={mode}
              ariaLabel={`Nuevo material: ${short}`}
              invalid={key in errors}
              onChange={(v) => setForm({ ...form, [key]: v })}
              onCommit={() => undefined}
            />
          </label>
        ))}
      </div>
      <ErrorList errors={errors} />
      <div className="ep-actions">
        <button
          type="button"
          disabled={!outcome.ok}
          onClick={() => {
            if (!outcome.ok) return;
            store.dispatch(materialUpsertCommand(outcome.value));
            setForm(null);
          }}
        >
          Agregar material
        </button>
        <button type="button" onClick={() => setForm(null)}>
          Cancelar
        </button>
      </div>
    </fieldset>
  );
}

const NO_MATERIALS: readonly Material[] = [];

export function MaterialsPanel({ store }: { store: EditorStore }) {
  const materials = useStoreSelector(store, (s) => s.doc.materials ?? NO_MATERIALS);
  const regions = useStoreSelector(store, (s) => s.doc.regions);
  const units = useStoreSelector(store, (s) => s.doc.units);
  const u = unitLabels(units);
  const ids = materials.map((m) => m.id);

  return (
    <PanelSection title="Materiales">
      <table className="ep-table">
        <thead>
          <tr>
            <th scope="col">id</th>
            <th scope="col">nombre</th>
            <th scope="col">γ ({u.unitWeight})</th>
            <th scope="col">γsat ({u.unitWeight})</th>
            <th scope="col">c ({u.stress})</th>
            <th scope="col">φ (°)</th>
            <th scope="col">ru</th>
            <th scope="col">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {materials.map((m) => (
            <MaterialRow
              key={m.id}
              store={store}
              material={m}
              otherIds={ids.filter((id) => id !== m.id)}
              usedBy={materialUsage({ regions }, m.id)}
            />
          ))}
        </tbody>
      </table>
      <p className="muted small">γsat y ru vacíos = no definidos. Rangos: γ mayor que 0, c ≥ 0, φ en [0, 90), ru en [0, 1).</p>
      <NewMaterial store={store} ids={ids} />

      <h3>Material por región</h3>
      {regions.length === 0 ? <p className="muted">El modelo no tiene regiones.</p> : null}
      {regions.map((region, i) => {
        const known = materials.some((m) => m.id === region.material);
        return (
          <label key={i} className="field ep-field">
            <span>Región {i + 1}</span>
            <select
              value={region.material}
              aria-label={`Material de la región ${i + 1}`}
              onChange={(e) => store.dispatch(regionMaterialCommand(i, e.target.value))}
            >
              {known ? null : <option value={region.material}>{region.material} (no existe)</option>}
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name === m.id ? m.id : `${m.name} (${m.id})`}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </PanelSection>
  );
}
