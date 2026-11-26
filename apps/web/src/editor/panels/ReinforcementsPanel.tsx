import { useId, useMemo } from 'react';
import type { Reinforcement } from '../../engine/types';
import { useConfirm } from '../../ui/ConfirmDialog';
import { createToolSwitch } from '../app/discard';
import { itoMatsuiOutOfRange, itoMatsuiRangeText } from '../../engine/warnings';
import { structuralLimitText } from '../../report/reinforcementReport';
import type { EditorStore } from '../types';
import { REINFORCEMENT_LABEL } from '../state/validateLocal';
import { LabeledField, PanelSection } from './Fields';
import { formatNumber, modelBounds } from './forms';
import {
  APPLICATION_OPTIONS,
  LOCATION_OPTIONS,
  PILE_DIRECTION_OPTIONS,
  PILE_SOURCE_OPTIONS,
  PULLOUT_OPTIONS,
  REINFORCEMENT_ADD_LABELS,
  REINFORCEMENT_TYPES,
  REINFORCEMENT_TYPE_LABELS,
  TENSION_DIRECTION_OPTIONS,
  reinforcementAddCommand,
  alignedSheet,
  isInclinedVertical,
  isTensionType,
  itoMatsuiRatio,
  evaluateCard,
  reinforcementLength,
  reinforcementRemoveCommand,
  reinforcementToForm,
  reinforcementUnits,
  reinforcementUpsertCommand,
  switchDirection,
  switchPileSource,
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
  // R11B-10: una tablestaca (o un pilote con presión del suelo, E15i-1) que el archivo trae inclinada enseña su x2 y su error en vez de forzar x2 = x1 sin avisar.
  const inclined = isInclinedVertical(reinforcement);
  const ctx = { otherIds, index, units: docUnits, inclined };
  const { errors, pending, valid } = evaluateCard(form, reinforcement, ctx);
  const scope = `Refuerzo ${index + 1}`;
  const tension = isTensionType(form.type);
  const sheet = form.type === 'sheet_pile';
  // E15i-1: un pilote con la presión del suelo de Ito-Matsui es vertical y no lleva `force`, sino diámetro, ubicación y capacidad.
  const ito = form.type === 'pile' && form.pileSource === 'ito_matsui';
  const vertical = sheet || ito;
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
  const ratio = ito && valid ? itoMatsuiRatio(valid) : null;
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
        {form.type === 'pile' ? (
          <SelectField
            scope={scope}
            label="Origen de la fuerza"
            value={form.pileSource}
            options={PILE_SOURCE_OPTIONS}
            path={`/reinforcements/${index}/lateral_pressure`}
            onChange={(source) => apply(switchPileSource(form, source, docUnits))}
            onFocus={select}
          />
        ) : null}
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
        {vertical ? (
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
        <>
          <div className="ep-grid">
            {ito ? field('diameter', L.diameter, units.length, { hint: 'Menor que el espaciamiento' }) : field('force', L.force, forceUnit)}
            {form.type === 'pile' ? field('spacing', L.spacing, units.length, { hint: 'Vacío: 1' }) : null}
            {form.direction === 'angle' ? field('angle', L.angle, '°') : null}
          </div>
          {ito ? (
            <>
              <SelectField
                scope={scope}
                label="Ubicación de la fuerza"
                value={form.location}
                options={LOCATION_OPTIONS}
                path={`/reinforcements/${index}/location`}
                onChange={(location) => apply({ ...form, location })}
                onFocus={select}
              />
              <div className="ep-grid">
                {field('shear', L.shear, units.force, { hint: 'Vacío: sin tope' })}
                {field('moment', L.moment, units.moment, { hint: 'Vacío: sin tope' })}
              </div>
              {ratio !== null ? (
                <p className="muted small ep-length" data-testid="ito-matsui-ratio">
                  Relación espaciamiento/diámetro: S/D = {formatNumber(Math.round(ratio * 100) / 100)}.
                </p>
              ) : null}
              {ratio !== null && itoMatsuiOutOfRange(ratio) ? (
                <p className="ep-note small" data-testid="ito-matsui-range">
                  {itoMatsuiRangeText(ratio)}
                </p>
              ) : null}
              <p className="muted small">
                La fuerza sale de la presión del suelo de Ito y Matsui (1975) sobre el tramo del pilote hasta la superficie de falla; el tope es el menor entre esa
                resultante, el corte y el momento dividido por el brazo. Una presión de suelo sobre un pilote vertical es horizontal: use la dirección «Ángulo» con
                0°; con «Tangente» el FS baja alrededor de 0,3 %.
              </p>
            </>
          ) : null}
        </>
      )}
      {inclined ? (
        <div className="ep-actions">
          <button
            type="button"
            aria-label={`Alinear verticalmente ${sheet ? 'la tablestaca' : 'el pilote'} del refuerzo ${index + 1} (x2 = x1)`}
            onClick={() => {
              // «Alinear» corrige x2 y, si el resto del borrador es válido, conserva también los cambios pendientes (una lista desplegable).
              const { commit: withDraft } = evaluateCard({ ...form, x2: form.x1 }, reinforcement, { ...ctx, inclined: false });
              store.dispatch(reinforcementUpsertCommand(index, withDraft ?? alignedSheet(reinforcement)));
            }}
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
      {hasStructural ? <p className="ep-note small">{structuralLimitText(list)}</p> : null}
    </PanelSection>
  );
}
