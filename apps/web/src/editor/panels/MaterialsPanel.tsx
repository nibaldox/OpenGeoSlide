import { useEffect, useRef, useState } from 'react';
import type { Material } from '../../engine/types';
import type { EditorStore } from '../types';
import { LabeledField, PanelSection } from './Fields';
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
  type UnitLabels,
} from './forms';

type FieldKey = Exclude<keyof MaterialForm, 'id'>;

/** Campos editables de un material: clave del formulario, etiqueta visible y unidad (según el sistema del modelo). */
function materialFields(u: UnitLabels): ReadonlyArray<{ key: FieldKey; label: string; unit?: string; mode: 'text' | 'decimal'; hint?: string }> {
  return [
    { key: 'name', label: 'Nombre', mode: 'text' },
    { key: 'unit_weight', label: 'Peso unitario γ', unit: u.unitWeight, mode: 'decimal' },
    { key: 'unit_weight_sat', label: 'Peso unitario saturado γsat', unit: u.unitWeight, mode: 'decimal', hint: 'Vacío = no definido' },
    { key: 'cohesion', label: 'Cohesión c', unit: u.stress, mode: 'decimal' },
    { key: 'friction_angle', label: 'Ángulo de fricción φ', unit: '°', mode: 'decimal' },
    { key: 'ru', label: 'Coeficiente de presión de poros ru', mode: 'decimal', hint: 'Vacío = no definido' },
  ];
}

/** Un material como tarjeta apilada: etiquetas visibles, sin tabla ancha (R7-13). El id es de solo lectura y se ve como texto. */
function MaterialCard({ store, material, index, otherIds, usedBy, units }: {
  store: EditorStore;
  material: Material;
  index: number;
  otherIds: readonly string[];
  usedBy: readonly number[];
  units: UnitLabels;
}) {
  const [form, setForm, reset] = useDraft(() => materialToForm(material), [material]);
  const selected = useStoreSelector(store, (s) => s.ui.selection.kind === 'material' && s.ui.selection.materialId === material.id);
  const outcome = materialFromForm(form, { otherIds, editing: material });
  const errors = outcome.ok ? {} : outcome.errors;

  const commit = (): void => {
    if (!outcome.ok || materialsEqual(outcome.value, material)) return;
    store.dispatch(materialUpsertCommand(outcome.value));
  };
  const select = (): void => store.dispatch({ type: 'ui/select', selection: { kind: 'material', materialId: material.id } });
  const remove = materialRemoveCommand(store.getState().doc, material.id);

  return (
    <fieldset className={selected ? 'ep-card ep-row-selected' : 'ep-card'}>
      <legend>Material {material.id}</legend>
      <p className="muted small ep-card-id">
        Identificador: <code>{material.id}</code> (no se puede cambiar)
      </p>
      <div className="ep-grid">
        {materialFields(units).map(({ key, label, unit, mode, hint }) => (
          <LabeledField
            key={key}
            label={label}
            scope={`Material ${material.id}`}
            unit={unit}
            hint={hint}
            value={form[key]}
            mode={mode}
            path={`/materials/${index}/${key}`}
            error={key in errors ? errors[key] : undefined}
            onChange={(v) => setForm({ ...form, [key]: v })}
            onCommit={commit}
            onReset={reset}
            onFocus={select}
          />
        ))}
      </div>
      <div className="ep-actions">
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
        {usedBy.length > 0 ? <span className="muted small">En uso por {usedBy.map((i) => `la región ${i + 1}`).join(', ')}.</span> : null}
      </div>
    </fieldset>
  );
}

export const NEW_MATERIAL_SCOPE = 'Nuevo material';

/**
 * Formulario de material nuevo (UX9-02): `fieldset` con la leyenda «Nuevo material», nombres accesibles únicos
 * («Nuevo material: Nombre», …) y el foco en el primer campo al abrirlo. `initiallyOpen` solo sirve para probarlo.
 */
export function NewMaterial({ store, ids, units, initiallyOpen = false }: {
  store: EditorStore;
  ids: readonly string[];
  units: string | undefined;
  initiallyOpen?: boolean;
}) {
  const [form, setForm] = useState<MaterialForm | null>(() => (initiallyOpen ? newMaterialForm(ids, units) : null));
  const u = unitLabels(units);
  const open = form !== null;
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    // Al abrir, el foco va al primer campo; al cerrar (agregar o cancelar), vuelve a «Nuevo material…».
    if (open && !wasOpen.current && !initiallyOpen) fieldsetRef.current?.querySelector('input')?.focus();
    else if (!open && wasOpen.current) openerRef.current?.focus();
    wasOpen.current = open;
  }, [open, initiallyOpen]);
  if (form === null) {
    return (
      <div className="ep-actions">
        <button ref={openerRef} type="button" onClick={() => setForm(newMaterialForm(ids, units))}>
          Nuevo material…
        </button>
      </div>
    );
  }
  const outcome = materialFromForm(form, { otherIds: ids, editing: null });
  const errors = outcome.ok ? {} : outcome.errors;
  return (
    <fieldset ref={fieldsetRef} className="field ep-new">
      <legend>{NEW_MATERIAL_SCOPE}</legend>
      <div className="ep-grid">
        <LabeledField
          label="Identificador (id)"
          scope={NEW_MATERIAL_SCOPE}
          value={form.id}
          mode="text"
          error={'id' in errors ? errors.id : undefined}
          onChange={(v) => setForm({ ...form, id: v })}
        />
        {materialFields(u).map(({ key, label, unit, mode, hint }) => (
          <LabeledField
            key={key}
            label={label}
            scope={NEW_MATERIAL_SCOPE}
            unit={unit}
            hint={hint}
            value={form[key]}
            mode={mode}
            error={key in errors ? errors[key] : undefined}
            onChange={(v) => setForm({ ...form, [key]: v })}
          />
        ))}
      </div>
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
      <div className="ep-cards">
        {materials.map((m, i) => (
          <MaterialCard
            key={m.id}
            store={store}
            material={m}
            index={i}
            units={u}
            otherIds={ids.filter((id) => id !== m.id)}
            usedBy={materialUsage({ regions }, m.id)}
          />
        ))}
      </div>
      <p className="muted small">γsat y ru vacíos = no definidos. Rangos: γ mayor que 0, c ≥ 0, φ en [0, 90), ru en [0, 1).</p>
      <NewMaterial store={store} ids={ids} units={units} />

      <h3>Material por región</h3>
      {regions.length === 0 ? <p className="muted">El modelo no tiene regiones.</p> : null}
      {regions.map((region, i) => {
        const known = materials.some((m) => m.id === region.material);
        return (
          <label key={i} className="field ep-field">
            <span>Material de la región {i + 1}</span>
            <select
              value={region.material}
              data-path={`/regions/${i}/material`}
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
