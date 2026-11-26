import { useId, useMemo } from 'react';
import type { Reinforcement } from '../../engine/types';
import { useConfirm } from '../../ui/ConfirmDialog';
import { createToolSwitch } from '../app/discard';
import type { EditorStore } from '../types';
import { REINFORCEMENT_LABEL } from '../state/validateLocal';
import { LabeledField, PanelSection } from './Fields';
import { formatNumber, modelBounds } from './forms';
import {
  APPLICATION_OPTIONS,
  PILE_DIRECTION_OPTIONS,
  PULLOUT_OPTIONS,
  REINFORCEMENT_ADD_LABELS,
  REINFORCEMENT_TYPES,
  REINFORCEMENT_TYPE_LABELS,
  STRUCTURAL_LIMIT_TEXT,
  TENSION_DIRECTION_OPTIONS,
  reinforcementAddCommand,
  alignedSheet,
  isInclinedSheet,
  isTensionType,
  evaluateCard,
  reinforcementLength,
  reinforcementRemoveCommand,
  reinforcementToForm,
  reinforcementUnits,
  reinforcementUpsertCommand,
  switchDirection,
  switchPullout,
  type PulloutKind,
  type ReinforcementForm,
  type ReinforcementType,
  type ReinforcementUnits,
} from './reinforcementForm';
import { useDraft, useStoreSelector } from './useStoreSelector';

const NO_REINFORCEMENTS: readonly Reinforcement[] = [];

/** Lista desplegable con etiqueta visible y prefijo accesible («Refuerzo 2: Aplicación»), como el modelo de un material. */
function SelectField<V extends string>({ scope, label, value, options, path, onChange, onFocus }: {
  scope: string;
  label: string;
  value: V;
  options: ReadonlyArray<{ value: V; label: string }>;
  path?: string;
  onChange: (value: V) => void;
  onFocus?: () => void;
}) {
  const id = useId();
  return (
    <div className="field ep-field ep-wide">
      <label htmlFor={id}>
        <span className="visually-hidden">{scope}: </span>
        {label}
      </label>
      <select id={id} value={value} data-path={path} onChange={(e) => onChange(e.target.value as V)} onFocus={onFocus}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Un refuerzo como tarjeta apilada con etiquetas visibles (como las cargas): nombres accesibles «Refuerzo N: Campo (unidad)». */
function ReinforcementCard({ store, reinforcement, index, list, docUnits, units }: {
  store: EditorStore;
  reinforcement: Reinforcement;
  index: number;
  list: readonly Reinforcement[];
  docUnits: string | undefined;
  units: ReinforcementUnits;
}) {
  const selected = useStoreSelector(
    store,
    (s) => (s.ui.selection.kind === 'reinforcement' || s.ui.selection.kind === 'reinforcement_end') && s.ui.selection.index === index,
  );
  const [form, setForm, reset] = useDraft<ReinforcementForm>(() => reinforcementToForm(reinforcement), [reinforcement]);
  const otherIds = list.flatMap((r, i) => (i !== index ? [r.id] : []));
  // R11B-10: una tablestaca que el archivo trae inclinada enseña su x2 y su error en vez de forzar x2 = x1 sin avisar.
  const inclined = isInclinedSheet(reinforcement);
  const ctx = { otherIds, index, units: docUnits, inclined };
  const { errors, pending, valid } = evaluateCard(form, reinforcement, ctx);
  const scope = `Refuerzo ${index + 1}`;
  const tension = isTensionType(form.type);
  const sheet = form.type === 'sheet_pile';
  const L = REINFORCEMENT_LABEL;

  const select = (): void => store.dispatch({ type: 'ui/select', selection: { kind: 'reinforcement', index } });
  const commitForm = (next: ReinforcementForm): void => {
    const { commit: value } = evaluateCard(next, reinforcement, ctx);
    if (value) store.dispatch(reinforcementUpsertCommand(index, value));
  };
  const commit = (): void => commitForm(form);
  // Las listas desplegables confirman al elegir: el borrador y el documento cambian a la vez.
  const apply = (next: ReinforcementForm): void => {
    setForm(next);
    commitForm(next);
  };

  const field = (key: keyof ReinforcementForm, label: string, unit?: string, opts: { mode?: 'text' | 'decimal'; hint?: string; readOnly?: boolean } = {}) => (
    <LabeledField
      key={key}
      label={label}
      scope={scope}
      unit={unit}
      hint={opts.hint}
      mode={opts.mode ?? 'decimal'}
      readOnly={opts.readOnly}
      value={form[key] as string}
      path={`/reinforcements/${index}/${key}`}
      error={key in errors ? errors[key] : undefined}
      onChange={(v) => setForm({ ...form, [key]: v })}
      onCommit={commit}
      onReset={reset}
      onFocus={select}
    />
  );

  // R11B-10: con algún error en el borrador, un cambio de lista desplegable se ve en el control pero no llega al modelo; se avisa.
  const length = valid ? reinforcementLength(valid) : null;
  const forceUnit = sheet ? units.forcePerLength : units.force;

  return (
    <fieldset className={selected ? 'ep-card ep-row-selected' : 'ep-card'} data-reinforcement-index={index}>
      <legend>
        {scope}: {REINFORCEMENT_TYPE_LABELS[form.type]}
      </legend>
      <div className="ep-grid">
        {field('id', L.id, undefined, { mode: 'text' })}
        <SelectField
          scope={scope}
          label="Aplicación"
          value={form.application}
          options={APPLICATION_OPTIONS}
          path={`/reinforcements/${index}/application`}
          onChange={(application) => apply({ ...form, application })}
          onFocus={select}
        />
        {tension ? (
          <SelectField
            scope={scope}
            label="Dirección de la fuerza"
            value={form.direction as (typeof TENSION_DIRECTION_OPTIONS)[number]['value']}
            options={TENSION_DIRECTION_OPTIONS}
            path={`/reinforcements/${index}/direction`}
            onChange={(direction) => apply(switchDirection(form, direction))}
            onFocus={select}
          />
        ) : (
          <SelectField
            scope={scope}
            label="Dirección de la fuerza"
            value={form.direction as (typeof PILE_DIRECTION_OPTIONS)[number]['value']}
            options={PILE_DIRECTION_OPTIONS}
            path={`/reinforcements/${index}/direction`}
            onChange={(direction) => apply(switchDirection(form, direction))}
            onFocus={select}
          />
        )}
      </div>
      <div className="ep-grid">
        {sheet ? (
          <>
            {field('x1', 'Posición x (vertical)', units.length)}
            {field('y1', L.y1, units.length)}
            {field('y2', L.y2, units.length)}
            {inclined ? field('x2', L.x2, units.length) : null}
          </>
        ) : (
          <>
            {field('x1', L.x1, units.length)}
            {field('y1', L.y1, units.length)}
            {field('x2', L.x2, units.length)}
            {field('y2', L.y2, units.length)}
          </>
        )}
      </div>
      {length !== null ? <p className="muted small ep-length">Longitud del refuerzo: {formatNumber(Math.round(length * 100) / 100)} {units.length}.</p> : null}
      {tension ? (
        <>
          <div className="ep-grid">
            {field('tensile_capacity', L.tensile_capacity, units.force)}
            {field('end1_capacity', L.end1_capacity, units.force, { hint: 'Vacío: 0' })}
            {field('end2_capacity', L.end2_capacity, units.force, { hint: 'Vacío: 0' })}
            {field('spacing', L.spacing, units.length, { hint: 'Vacío: 1' })}
          </div>
          <SelectField
            scope={scope}
            label="Modelo de arrancamiento"
            value={form.pullout}
            options={PULLOUT_OPTIONS}
            path={`/reinforcements/${index}/pullout`}
            onChange={(kind: PulloutKind) => apply(switchPullout(form, kind, docUnits))}
            onFocus={select}
          />
          {form.pullout === 'bond' ? (
            <div className="ep-grid">
              {field('strength', L.strength, units.forcePerLength)}
              {field('bonded_length', L.bonded_length, units.length, { hint: 'Vacío: todo el elemento' })}
            </div>
          ) : null}
          {form.pullout === 'interface' ? (
            <div className="ep-grid">
              {field('adhesion', L.adhesion, units.stress)}
              {field('friction_angle', L.friction_angle, '°')}
              {field('coverage', L.coverage)}
            </div>
          ) : null}
          {form.pullout === 'development' ? (
            <div className="ep-grid">
              {field('length1', L.length1, units.length)}
              {field('length2', L.length2, units.length)}
            </div>
          ) : null}
        </>
      ) : (
        <div className="ep-grid">
          {field('force', L.force, forceUnit)}
          {form.type === 'pile' ? field('spacing', L.spacing, units.length, { hint: 'Vacío: 1' }) : null}
          {form.direction === 'angle' ? field('angle', L.angle, '°') : null}
        </div>
      )}
      {inclined ? (
        <div className="ep-actions">
          <button
            type="button"
            aria-label={`Alinear verticalmente la tablestaca del refuerzo ${index + 1} (x2 = x1)`}
            onClick={() => store.dispatch(reinforcementUpsertCommand(index, alignedSheet(reinforcement)))}
          >
            Alinear verticalmente (x2 = x1)
          </button>
        </div>
      ) : null}
      {pending ? (
        <p className="ep-note small" role="status" data-testid="reinforcement-pending">
          Hay cambios de esta tarjeta sin aplicar al modelo: corrija los errores para guardarlos.
        </p>
      ) : null}
      <div className="ep-actions">
        <button type="button" aria-label={`Quitar el refuerzo ${index + 1}`} onClick={() => store.dispatch(reinforcementRemoveCommand(index))}>
          Quitar
        </button>
      </div>
    </fieldset>
  );
}

export function ReinforcementsPanel({ store }: { store: EditorStore }) {
  const list = useStoreSelector(store, (s) => s.doc.reinforcements ?? NO_REINFORCEMENTS);
  const regions = useStoreSelector(store, (s) => s.doc.regions);
  const docUnits = useStoreSelector(store, (s) => s.doc.units);
  const drawing = useStoreSelector(store, (s) => s.ui.tool === 'draw_reinforcement');
  const units = reinforcementUnits(docUnits);
  const canAdd = modelBounds({ regions }) !== null;
  // Cambiar de herramienta con un trazo de región a medias pide confirmación, igual que la barra (A-04).
  const confirm = useConfirm();
  const switchTool = useMemo(() => createToolSwitch(store, confirm), [store, confirm]);
  const hasStructural = list.some((r) => r.type === 'pile' || r.type === 'sheet_pile');
  const add = (type: ReinforcementType): void => {
    const command = reinforcementAddCommand(type, store.getState().doc);
    if (!command) return;
    store.dispatch(command);
    store.dispatch({ type: 'ui/select', selection: { kind: 'reinforcement', index: list.length } });
  };

  return (
    <PanelSection title="Refuerzos">
      {list.length === 0 ? (
        <p className="muted">Sin refuerzos.</p>
      ) : (
        <div className="ep-cards">
          {list.map((r, i) => (
            <ReinforcementCard key={i} store={store} reinforcement={r} index={i} list={list} docUnits={docUnits} units={units} />
          ))}
        </div>
      )}
      <div className="ep-actions">
        {REINFORCEMENT_TYPES.map((type) => (
          <button key={type} type="button" disabled={!canAdd} onClick={() => add(type)}>
            {REINFORCEMENT_ADD_LABELS[type]}
          </button>
        ))}
      </div>
      <div className="ep-actions">
        <button
          type="button"
          aria-pressed={drawing}
          disabled={!canAdd}
          onClick={() => void switchTool(drawing ? 'select' : 'draw_reinforcement')}
        >
          Trazar en el lienzo
        </button>
      </div>
      <p className="muted small">
        Cabeza: el extremo en el paramento o en la superficie del terreno; punta: el extremo embebido. Activa: fuerza conocida (por ejemplo, la de
        bloqueo de un anclaje); pasiva: se moviliza con el deslizamiento y entra dividida por F. Las capacidades son por elemento y el espaciamiento las
        pasa a fuerza por metro de talud. La tablestaca es vertical y su fuerza es por metro de muro. Los refuerzos no reciben sismo.
      </p>
      {hasStructural ? <p className="ep-note small">{STRUCTURAL_LIMIT_TEXT}</p> : null}
    </PanelSection>
  );
}
