import { useEffect, useId, useRef, useState } from 'react';
import { hoekBrownParameters } from '../state/hoekBrown';
import type { Material, MaterialModel } from '../../engine/types';
import type { EditorStore, ModelDoc } from '../types';
import { LabeledField, PanelSection } from './Fields';
import { useDraft, useStoreSelector } from './useStoreSelector';
import {
  MATERIAL_MODEL_OPTIONS,
  defaultStrengthGradient,
  formatNumber,
  materialFromForm,
  materialRemoveCommand,
  materialToForm,
  materialTopElevation,
  materialUpsertCommand,
  materialUsage,
  materialsEqual,
  newMaterialForm,
  regionMaterialCommand,
  setSuVariable,
  switchMaterialModel,
  unitLabels,
  type MaterialForm,
  type UnitLabels,
} from './forms';

type FieldKey = Exclude<keyof MaterialForm, 'id' | 'model' | 'variable' | 'ocrSource' | 'ocrRows'>;

interface FieldSpec {
  key: FieldKey;
  label: string;
  unit?: string;
  mode: 'text' | 'decimal';
  hint?: string;
}

/**
 * Campos editables de un material según su modelo (F3.2): clave del formulario, etiqueta visible y unidad (según el sistema del modelo).
 * `part` separa los que van antes de la casilla «Su variable con la cota» de los que van después.
 */
function materialFields(u: UnitLabels, model: MaterialModel, variable: boolean): { before: FieldSpec[]; variable: FieldSpec[]; after: FieldSpec[] } {
  const common: FieldSpec[] = [
    { key: 'name', label: 'Nombre', mode: 'text' },
    { key: 'unit_weight', label: 'Peso unitario γ', unit: u.unitWeight, mode: 'decimal' },
    { key: 'unit_weight_sat', label: 'Peso unitario saturado γsat', unit: u.unitWeight, mode: 'decimal', hint: 'Vacío = no definido' },
  ];
  const ru: FieldSpec = { key: 'ru', label: 'Coeficiente de presión de poros ru', mode: 'decimal', hint: 'Vacío = no definido' };
  if (model === 'hoek_brown') return { before: [...common,
    { key: 'ucs', label: 'Resistencia σci', unit: u.stress, mode: 'decimal' },
    { key: 'gsi', label: 'GSI', mode: 'decimal' }, { key: 'mi', label: 'mi', mode: 'decimal' },
    { key: 'disturbance', label: 'Factor de perturbación D', mode: 'decimal', hint: 'Elija D entre 0 y 1. Guía: 0 para TBM o voladura controlada; 0,5 para desprendimiento sin contrafuerte; 0,8 para voladura muy mala; 0,7 para taludes con voladura controlada o excavación mecánica en mina; 1 para voladura de producción a cielo abierto. Aplique con criterio (Hoek et al., 2002, tabla 1).' }, ru], variable: [], after: [] };
  if (model === 'shansep') return { before: [...common,
    { key: 'ratio', label: 'Relación S', mode: 'decimal' },
    { key: 'exponent', label: 'Exponente m', mode: 'decimal', hint: 'Vacío = 0,8' }, ru], variable: [], after: [] };
  if (model === 'undrained') {
    return {
      before: [...common, { key: 'undrained_strength', label: 'Su', unit: u.stress, mode: 'decimal', hint: 'Resistencia al corte no drenada (φ = 0)' }],
      variable: variable
        ? [
            { key: 'strength_datum', label: 'Cota de referencia de Su', unit: u.length, mode: 'decimal', hint: 'Cota y donde Su vale el valor de arriba' },
            { key: 'strength_gradient', label: 'Gradiente de Su', unit: u.stressGradient, mode: 'decimal', hint: 'Positivo si Su crece hacia abajo' },
            { key: 'strength_limit', label: 'Límite de Su', unit: u.stress, mode: 'decimal', hint: 'Vacío = sin límite' },
          ]
        : [],
      after: [ru],
    };
  }
  return {
    before: [
      ...common,
      { key: 'cohesion', label: 'Cohesión c', unit: u.stress, mode: 'decimal' },
      { key: 'friction_angle', label: 'Ángulo de fricción φ', unit: '°', mode: 'decimal' },
      ru,
    ],
    variable: [],
    after: [],
  };
}

function MaterialExtras({ form, setForm, scope, units, errors, commit }: { form: MaterialForm; setForm: (f: MaterialForm) => void; scope: string; units: UnitLabels; errors: Record<string, string>; commit?: (f: MaterialForm) => void }) {
  const sourceId = useId();
  const update = (next: MaterialForm) => { setForm(next); commit?.(next); };
  if (form.model === 'hoek_brown') {
    const values = [form.gsi, form.mi, form.disturbance].map(v => v == null || v.trim() === '' ? NaN : Number(v.replace(',', '.')));
    const [gsi, mi, d] = values;
    const p = values.every(Number.isFinite) && gsi >= 0 && gsi <= 100 && mi > 0 && d >= 0 && d <= 1 ? hoekBrownParameters(gsi, mi, d) : null;
    const ucs = Number((form.ucs ?? '').replace(',', '.'));
    const equivalent = units.stress === 'psf' ? ucs / 144000 : ucs / 1000;
    return <div><p>σci equivalente: {form.ucs && Number.isFinite(ucs) ? formatNumber(equivalent) : '—'} {units.stress === 'psf' ? 'ksi' : 'MPa'}</p>
      <p>mb = {p ? formatNumber(p.mb) : '—'}; s = {p ? formatNumber(p.s) : '—'}; a = {p ? formatNumber(p.a) : '—'}</p></div>;
  }
  if (form.model !== 'shansep') return null;
  const rows = form.ocrRows ?? [{ y: '0', ocr: '1' }, { y: '1', ocr: '1' }];
  return <fieldset className="field"><legend>Fuente de OCR</legend>
    <div className="field"><label htmlFor={sourceId}><span className="visually-hidden">{scope}: </span>Fuente de OCR</label><select id={sourceId} value={form.ocrSource ?? 'ocr'} onChange={e => update({ ...form, ocrSource: e.target.value as 'ocr' | 'pop' | 'table', ocrRows: rows })}>
      <option value="ocr">OCR constante</option><option value="pop">POP</option><option value="table">Tabla por cota</option>
    </select></div>
    {(form.ocrSource ?? 'ocr') !== 'table' ? <LabeledField scope={scope} label={form.ocrSource === 'pop' ? 'POP' : 'OCR constante'} unit={form.ocrSource === 'pop' ? units.stress : undefined} value={form.ocrSource === 'pop' ? form.pop ?? '' : form.ocr ?? ''} error={errors[form.ocrSource === 'pop' ? 'pop' : 'ocr']} onChange={v => setForm({ ...form, [form.ocrSource === 'pop' ? 'pop' : 'ocr']: v })} onCommit={() => commit?.(form)} /> : <>
      {rows.map((row, i) => <div className="ep-grid" key={i}>
        {(['y', 'ocr'] as const).map(k => <LabeledField key={k} scope={`${scope}: fila ${i + 1}`} label={k === 'y' ? 'Cota' : 'OCR'} unit={k === 'y' ? units.length : undefined} value={row[k]} error={errors[`row${i}${k}`]} onChange={v => setForm({ ...form, ocrRows: rows.map((r, j) => i === j ? { ...r, [k]: v } : r) })} onCommit={() => commit?.(form)} />)}
        <button type="button" disabled={rows.length <= 2} onClick={() => update({ ...form, ocrRows: rows.filter((_, j) => i !== j) })}>Quitar fila {i + 1}</button>
      </div>)}
      <button type="button" onClick={() => update({ ...form, ocrRows: [...rows, { y: formatNumber(Number(rows[rows.length - 1].y.replace(',', '.')) + 1), ocr: rows[rows.length - 1].ocr }] })}>Agregar fila</button>
      {errors.ocrRows ? <p className="ep-error">{errors.ocrRows}</p> : null}
    </>}
  </fieldset>;
}

/** Selector del modelo constitutivo con el prefijo para lectores de pantalla («Material arcilla: Modelo»), como los demás campos. */
function ModelSelect({ scope, value, onChange }: { scope: string; value: MaterialModel; onChange: (model: MaterialModel) => void }) {
  const id = useId();
  return (
    <div className="field ep-field">
      <label htmlFor={id}>
        <span className="visually-hidden">{scope}: </span>Modelo
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as MaterialModel)}>
        {MATERIAL_MODEL_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value="hoek_brown">Hoek-Brown</option>
        <option value="shansep">SHANSEP</option>
      </select>
    </div>
  );
}

/** Casilla «Su variable con la cota», con el mismo prefijo accesible. */
function VariableCheckbox({ scope, checked, onChange }: { scope: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="visually-hidden">{scope}: </span>Su variable con la cota
    </label>
  );
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

  const commitWith = (next: MaterialForm): void => {
    const result = materialFromForm(next, { otherIds, editing: material });
    if (!result.ok || materialsEqual(result.value, material)) return;
    store.dispatch(materialUpsertCommand(result.value));
  };
  const commit = (): void => commitWith(form);
  const select = (): void => store.dispatch({ type: 'ui/select', selection: { kind: 'material', materialId: material.id } });
  const remove = materialRemoveCommand(store.getState().doc, material.id);

  const scope = `Material ${material.id}`;
  const model: MaterialModel = form.model ?? 'mohr_coulomb';
  const fields = materialFields(units, model, form.variable === true);
  const field = ({ key, label, unit, mode, hint }: FieldSpec) => (
    <LabeledField
      key={key}
      label={label}
      scope={scope}
      unit={unit}
      hint={hint}
      value={form[key] ?? ''}
      mode={mode}
      path={`/materials/${index}/${key}`}
      error={key in errors ? errors[key] : undefined}
      onChange={(v) => setForm({ ...form, [key]: v })}
      onCommit={commit}
      onReset={reset}
      onFocus={select}
    />
  );
  // El cambio de modelo y la casilla de Su variable escriben el material de una vez: un solo paso deshacible cada uno.
  const doc = (): ModelDoc => store.getState().doc;

  return (
    <fieldset className={selected ? 'ep-card ep-row-selected' : 'ep-card'}>
      <legend>Material {material.id}</legend>
      <p className="muted small ep-card-id">
        Identificador: <code>{material.id}</code> (no se puede cambiar)
      </p>
      <div className="ep-grid">
        <ModelSelect scope={scope} value={material.model} onChange={(m) => store.dispatch(materialUpsertCommand(switchMaterialModel(material, m, doc().units)))} />
        {fields.before.map(field)}
        {model === 'undrained' ? (
          <VariableCheckbox scope={scope} checked={form.variable === true} onChange={(on) => store.dispatch(materialUpsertCommand(setSuVariable(material, on, doc())))} />
        ) : null}
        {fields.variable.map(field)}
        {fields.after.map(field)}
        <MaterialExtras form={form} setForm={setForm} scope={scope} units={units} errors={errors} commit={commitWith} />
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
  const model: MaterialModel = form.model ?? 'mohr_coulomb';
  const fields = materialFields(u, model, form.variable === true);
  const field = ({ key, label, unit, mode, hint }: FieldSpec) => (
    <LabeledField
      key={key}
      label={label}
      scope={NEW_MATERIAL_SCOPE}
      unit={unit}
      hint={hint}
      value={form[key] ?? ''}
      mode={mode}
      error={key in errors ? errors[key] : undefined}
      onChange={(v) => setForm({ ...form, [key]: v })}
    />
  );
  const setVariable = (on: boolean): void => {
    if (!on) {
      setForm({ ...form, variable: false });
      return;
    }
    const top = materialTopElevation(store.getState().doc, form.id);
    setForm({
      ...form,
      variable: true,
      strength_datum: form.strength_datum && form.strength_datum !== '' ? form.strength_datum : formatNumber(top === null ? 0 : Math.round(top * 100) / 100),
      strength_gradient: form.strength_gradient && form.strength_gradient !== '' ? form.strength_gradient : formatNumber(defaultStrengthGradient(units)),
    });
  };
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
        <ModelSelect scope={NEW_MATERIAL_SCOPE} value={model} onChange={(m) => setForm({ ...form, model: m })} />
        {fields.before.map(field)}
        {model === 'undrained' ? <VariableCheckbox scope={NEW_MATERIAL_SCOPE} checked={form.variable === true} onChange={setVariable} /> : null}
        {fields.variable.map(field)}
        {fields.after.map(field)}
        <MaterialExtras form={form} setForm={setForm} scope={NEW_MATERIAL_SCOPE} units={u} errors={errors} />
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
      <p className="muted small">γsat y ru vacíos = no definidos. Rangos: γ mayor que 0, c ≥ 0 y φ en [0, 90) en Mohr-Coulomb, Su ≥ 0 en «No drenado (Su)», ru en [0, 1).</p>
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
