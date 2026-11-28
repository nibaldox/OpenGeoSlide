import { useContext, useEffect, useId, useRef } from 'react';
import { hoekBrownParameters } from '../state/hoekBrown';
import type { Material, MaterialModel } from '../../engine/types';
import type { EditorStore, ModelDoc } from '../types';
import { ErrorList, LabeledField, PanelSection, RowsPendingNote, TextInput } from './Fields';
import { DocEpochContext, useDraft, useStoreSelector } from './useStoreSelector';
import {
  MATERIAL_MODEL_OPTIONS,
  defaultStrengthGradient,
  evaluateMaterialCard,
  formatNumber,
  materialFromForm,
  materialRemoveCommand,
  materialToForm,
  materialTopElevation,
  materialUpsertCommand,
  materialUsage,
  newMaterialForm,
  regionMaterialCommand,
  ROWS_PENDING_REASON,
  setPendingDraft,
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

const SUPERSCRIPT: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

/** Cifras significativas con coma decimal («0,6410»); un valor que `toPrecision` escribe con exponente va en notación científica. */
export function formatSignificant(value: number, digits = 4): string {
  const text = value.toPrecision(digits);
  return /e/i.test(text) ? formatScientific(value, digits) : text.replace('.', ',');
}

/** Notación científica con coma decimal y exponente en superíndice («7,128·10⁻⁴»). */
export function formatScientific(value: number, digits = 4): string {
  const [mantissa, exponent] = value.toExponential(digits - 1).split('e');
  const power = String(Number(exponent)).split('').map((c) => SUPERSCRIPT[c] ?? c).join('');
  return `${mantissa!.replace('.', ',')}·10${power}`;
}

/** mb, s y a como los muestra el panel (W1-UX-1): 4 cifras significativas y s en notación científica cuando es menor que 0,01. */
export function formatHoekBrownParameters(p: { mb: number; s: number; a: number }): { mb: string; s: string; a: string } {
  return { mb: formatSignificant(p.mb), s: p.s < 0.01 ? formatScientific(p.s) : formatSignificant(p.s), a: formatSignificant(p.a) };
}

/** Rangos de los materiales nuevos de la v0.6 (`crates/ogs-core/src/strength.rs`), para la nota del pie del panel. */
export const MATERIAL_RANGES_NOTE =
  'γsat y ru vacíos = no definidos. Rangos: γ mayor que 0, c ≥ 0 y φ en [0, 90) en Mohr-Coulomb, Su ≥ 0 en «No drenado (Su)», ru en [0, 1). ' +
  'Hoek-Brown: σci mayor que 0, GSI en [0, 100], mi mayor que 0 y D en [0, 1]. ' +
  'SHANSEP: S mayor que 0, exponente m en [0, 1] (vacío = 0,8), exactamente una fuente de OCR (OCR constante, POP o tabla por cota), OCR ≥ 1 y POP ≥ 0; ' +
  'la tabla necesita al menos 2 filas con la cota estrictamente creciente.';

/** ¿Hay una fila de la tabla `ocr_by_elevation` con un borrador sin aplicar (celda inválida o tabla que no se puede aplicar)? */
export function shansepRowsPending(errors: Readonly<Record<string, string>>): boolean {
  return 'ocrRows' in errors || Object.keys(errors).some((k) => /^row\d+(y|ocr)$/.test(k));
}

/** Cota de la fila que «Agregar fila» inserta (la última + 1), o `null` si la última cota no es un número: nunca un `NaN`. */
export function nextOcrRowY(rows: readonly { y: string }[]): string | null {
  const last = rows[rows.length - 1];
  if (!last || last.y.trim() === '') return null;
  const n = Number(last.y.trim().replace(',', '.'));
  return Number.isFinite(n) ? formatNumber(n + 1) : null;
}

function MaterialExtras({ form, setForm, scope, units, errors, commit, index, onReset }: {
  form: MaterialForm;
  setForm: (f: MaterialForm) => void;
  scope: string;
  units: UnitLabels;
  errors: Record<string, string>;
  commit?: (f: MaterialForm) => void;
  index?: number;
  onReset?: () => void;
}) {
  const sourceId = useId();
  const pendingNoteId = useId();
  const basePath = index !== undefined ? `/materials/${index}` : undefined;
  const update = (next: MaterialForm) => { setForm(next); commit?.(next); };
  if (form.model === 'hoek_brown') {
    const values = [form.gsi, form.mi, form.disturbance].map(v => v == null || v.trim() === '' ? NaN : Number(v.replace(',', '.')));
    const [gsi, mi, d] = values;
    const p = values.every(Number.isFinite) && gsi >= 0 && gsi <= 100 && mi > 0 && d >= 0 && d <= 1 ? hoekBrownParameters(gsi, mi, d) : null;
    const ucs = Number((form.ucs ?? '').replace(',', '.'));
    const equivalent = units.stress === 'psf' ? ucs / 144000 : ucs / 1000;
    const shown = p ? formatHoekBrownParameters(p) : null;
    return <div style={{ gridColumn: '1 / -1' }}><p>σci equivalente: {form.ucs && Number.isFinite(ucs) ? formatNumber(Number(equivalent.toPrecision(4))) : '—'} {units.stress === 'psf' ? 'ksi' : 'MPa'}</p>
      <p>mb = {shown?.mb ?? '—'}; s = {shown?.s ?? '—'}; a = {shown?.a ?? '—'}</p></div>;
  }
  if (form.model !== 'shansep') return null;
  const rows = form.ocrRows ?? [{ y: '0', ocr: '1' }, { y: '1', ocr: '1' }];
  const ocrKey = form.ocrSource === 'pop' ? 'pop' : 'ocr';
  // W1-1c: con una fila con borrador pendiente (cota u OCR inválidos, o tabla no aplicable) «Agregar fila» y «Quitar» reemplazarían
  // las filas y perderían el borrador: quedan deshabilitados, con el motivo y la nota enlazada.
  const rowsPending = shansepRowsPending(errors);
  const rowsReason = rowsPending ? ROWS_PENDING_REASON : undefined;
  const rowsDescribedBy = rowsPending ? pendingNoteId : undefined;
  const nextY = nextOcrRowY(rows);
  return <fieldset className="field" style={{ gridColumn: '1 / -1' }}><legend>Fuente de OCR</legend>
    <div className="field"><label htmlFor={sourceId}><span className="visually-hidden">{scope}: </span>Fuente de OCR</label><select
      id={sourceId}
      data-path={basePath ? `${basePath}/shansep` : undefined}
      value={form.ocrSource ?? 'ocr'}
      onChange={e => update({ ...form, ocrSource: e.target.value as 'ocr' | 'pop' | 'table', ocrRows: rows })}
      onKeyDown={onReset ? (e) => { if (e.key === 'Escape') onReset(); } : undefined}
    >
      <option value="ocr">OCR constante</option><option value="pop">POP</option><option value="table">Tabla por cota</option>
    </select></div>
    {(form.ocrSource ?? 'ocr') !== 'table' ? <LabeledField
      scope={scope}
      label={form.ocrSource === 'pop' ? 'POP' : 'OCR constante'}
      unit={form.ocrSource === 'pop' ? units.stress : undefined}
      path={basePath ? `${basePath}/${ocrKey}` : undefined}
      value={form.ocrSource === 'pop' ? form.pop ?? '' : form.ocr ?? ''}
      error={errors[ocrKey]}
      onChange={v => setForm({ ...form, [ocrKey]: v })}
      onCommit={() => commit?.(form)}
      onReset={onReset}
    /> : <>
      <div className="ep-table-wrap" role="region" aria-label={`${scope}: OCR por cota`} tabIndex={0}>
        <table className="ep-table">
          <thead>
            <tr>
              <th scope="col">Cota ({units.length})</th>
              <th scope="col">OCR</th>
              <th scope="col"><span className="visually-hidden">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => <tr key={i}>
              {(['y', 'ocr'] as const).map(k => <td key={k}>
                <TextInput
                  value={row[k]}
                  ariaLabel={`${scope}: fila ${i + 1}, ${k === 'y' ? 'Cota' : 'OCR'}`}
                  path={basePath ? `${basePath}/shansep/ocr_by_elevation/${i}/${k === 'y' ? 0 : 1}` : undefined}
                  invalid={`row${i}${k}` in errors}
                  onChange={v => setForm({ ...form, ocrRows: rows.map((r, j) => i === j ? { ...r, [k]: v } : r) })}
                  onCommit={() => commit?.(form)}
                  onReset={onReset}
                />
              </td>)}
              <td><button type="button" disabled={rows.length <= 2 || rowsPending} title={rowsReason} aria-describedby={rowsDescribedBy} aria-label={`${scope}: quitar la fila ${i + 1}`} onClick={() => update({ ...form, ocrRows: rows.filter((_, j) => i !== j) })}>Quitar</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <ErrorList errors={Object.fromEntries(Object.entries(errors).filter(([k]) => /^row\d+(y|ocr)$/.test(k)))} />
      <RowsPendingNote id={pendingNoteId} pending={rowsPending} />
      <button type="button" disabled={rowsPending || nextY === null} title={rowsReason} aria-describedby={rowsDescribedBy} onClick={() => { if (nextY !== null) update({ ...form, ocrRows: [...rows, { y: nextY, ocr: rows[rows.length - 1].ocr }] }); }}>Agregar fila</button>
      {errors.ocrRows ? <p className="ep-error">{errors.ocrRows}</p> : null}
    </>}
  </fieldset>;
}

/**
 * Cambio de modelo de un material que ya está en el documento. Hoek-Brown y SHANSEP no se pueden escribir de una vez: sin σci, GSI, mi
 * y D (o sin S y la fuente de OCR) el material no es válido y el reducer rechaza el comando, así que el selector se quedaba en el modelo
 * anterior (hallazgo de la regresión en Chrome, B2a). Para esos dos modelos el cambio es un borrador del formulario de la tarjeta, que se
 * escribe en el modelo con el primer «confirmar» en que el material es válido; el resto de los cambios son un comando, como antes.
 */
export type ModelChange =
  | { kind: 'command'; material: Material }
  | { kind: 'draft'; form: MaterialForm }
  | { kind: 'reset' };

export function planModelChange(material: Material, form: MaterialForm, next: MaterialModel, units?: string): ModelChange {
  if (next === material.model) return { kind: 'reset' };
  if (next === 'hoek_brown' || next === 'shansep') return { kind: 'draft', form: { ...form, model: next } };
  return { kind: 'command', material: switchMaterialModel(material, next, units) };
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
  const { errors, pending } = evaluateMaterialCard(form, material, { otherIds, editing: material });

  const commitWith = (next: MaterialForm): void => {
    const { commit: value } = evaluateMaterialCard(next, material, { otherIds, editing: material });
    if (value) store.dispatch(materialUpsertCommand(value));
  };
  const commit = (): void => commitWith(form);
  const select = (): void => store.dispatch({ type: 'ui/select', selection: { kind: 'material', materialId: material.id } });
  const remove = materialRemoveCommand(store.getState().doc, material.id);

  const scope = `Material ${material.id}`;
  useEffect(() => {
    const key = `material:${material.id}`;
    setPendingDraft(store, key, pending ? scope : null);
    return () => setPendingDraft(store, key, null);
  }, [store, material.id, pending, scope]);
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
        <ModelSelect scope={scope} value={model} onChange={(m) => {
          const change = planModelChange(material, form, m, doc().units);
          if (change.kind === 'command') store.dispatch(materialUpsertCommand(change.material));
          else if (change.kind === 'draft') setForm(change.form);
          else reset();
        }} />
        {fields.before.map(field)}
        {model === 'undrained' ? (
          <VariableCheckbox scope={scope} checked={form.variable === true} onChange={(on) => store.dispatch(materialUpsertCommand(setSuVariable(material, on, doc())))} />
        ) : null}
        {fields.variable.map(field)}
        {fields.after.map(field)}
        <MaterialExtras form={form} setForm={setForm} scope={scope} units={units} errors={errors} commit={commitWith} index={index} onReset={reset} />
      </div>
      {pending ? (
        <p className="ep-note small" role="status" data-testid="material-pending">
          Hay cambios de esta tarjeta sin aplicar al modelo: corrija los errores para guardarlos.{' '}
          <button type="button" className="link-button" aria-label={`Descartar cambios del material ${material.id}`} onClick={reset}>
            Descartar cambios
          </button>
        </p>
      ) : null}
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
/** R16c: registro del formulario de material nuevo. */
export const NEW_MATERIAL_DRAFT = { key: 'material:new', label: 'Material nuevo' } as const;
/** El formulario abierto con cambios respecto del valor con que se abrió: el material nuevo solo entra al modelo con «Agregar material». */
export const newMaterialDraftPending = (form: MaterialForm | null, baseline: string | null): boolean =>
  form !== null && baseline !== null && JSON.stringify(form) !== baseline;

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
  // W1-1a (RCM-B-04): el formulario es un borrador y se reinicia con `docEpoch` (Nuevo, Abrir, ejemplos): se cierra, o vuelve al
  // formulario inicial si `initiallyOpen`. La referencia para saber si hay cambios viaja con el borrador, para reiniciarse con él.
  const epoch = useContext(DocEpochContext);
  const [draft, setDraft] = useDraft(() => {
    const initial = initiallyOpen ? newMaterialForm(ids, units) : null;
    return { form: initial, baseline: initial === null ? null : JSON.stringify(initial) };
  }, []);
  const form = draft.form;
  const setForm = (next: MaterialForm | null): void => setDraft({ form: next, baseline: draft.baseline });
  const u = unitLabels(units);
  const open = form !== null;
  // R16c: el formulario abierto con cambios sin agregar es un borrador pendiente (el material nuevo solo entra al modelo con «Agregar material»).
  const pending = newMaterialDraftPending(form, draft.baseline);
  useEffect(() => {
    setPendingDraft(store, NEW_MATERIAL_DRAFT.key, pending ? NEW_MATERIAL_DRAFT.label : null);
    return () => setPendingDraft(store, NEW_MATERIAL_DRAFT.key, null);
  }, [store, pending]);
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const lastEpoch = useRef(epoch);
  useEffect(() => {
    // Al cambiar de documento el formulario se reinicia solo: no es un cierre del usuario y el foco no se mueve.
    const epochChanged = lastEpoch.current !== epoch;
    lastEpoch.current = epoch;
    if (epochChanged) {
      wasOpen.current = open;
      return;
    }
    // Al abrir, el foco va al primer campo; al cerrar (agregar o cancelar), vuelve a «Nuevo material…».
    if (open && !wasOpen.current && !initiallyOpen) fieldsetRef.current?.querySelector('input')?.focus();
    else if (!open && wasOpen.current) openerRef.current?.focus();
    wasOpen.current = open;
  }, [open, initiallyOpen, epoch]);
  if (form === null) {
    return (
      <div className="ep-actions">
        <button ref={openerRef} type="button" onClick={() => {
          const initial = newMaterialForm(ids, units);
          setDraft({ form: initial, baseline: JSON.stringify(initial) });
        }}>
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
      <p className="muted small">{MATERIAL_RANGES_NOTE}</p>
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
