// Panel «Proyecto»: título, identificador y descripción del modelo (`meta`) y sistema de unidades. Misma firma que los demás
// paneles (`{ store }`). El esquema (`schema/ogs-0.2.schema.json`, `$defs/meta`) solo tiene `id`, `title` y `notes`.
// Cambiar las unidades abre un diálogo propio con tres opciones: «Convertir los valores» (recomendada: el FS no cambia),
// «Solo cambiar la etiqueta» (la advertencia de siempre) y «Cancelar» (R8 A-02).

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Modal } from '../app/ImportDialogs';
import type { EditorStore } from '../types';
import { LabeledField, PanelSection } from './Fields';
import {
  currentUnits,
  metaPatchCommand,
  projectToForm,
  unitsChangeDialog,
  unitsChoiceCommand,
  unitsNoticeStillValid,
  unitsOptions,
  type MetaField,
  type UnitsNotice,
  type UnitsChoice,
  type UnitsKind,
} from './projectForm';
import { useDraft, useStoreSelector } from './useStoreSelector';
import './project.css';

/** Diálogo del cambio de unidades. El foco inicial va a la opción por defecto («Convertir los valores»). */
function UnitsDialog({ from, to, onChoose }: { from: ReturnType<typeof currentUnits>; to: UnitsKind; onChoose: (choice: UnitsChoice) => void }) {
  const dialog = unitsChangeDialog(from, to);
  const defaultRef = useRef<HTMLButtonElement>(null);
  const descId = useId();
  return (
    <Modal title={dialog.title} onCancel={() => onChoose('cancel')} initialFocus={defaultRef}>
      <div className="pj-units-dialog" data-testid="units-dialog">
        <p id={descId}>{dialog.intro}</p>
        <ul className="pj-units-options">
          {dialog.options.map((o) => (
            <li key={o.id} className={o.recommended ? 'pj-units-option pj-units-recommended' : 'pj-units-option'}>
              <button
                type="button"
                ref={o.id === dialog.defaultOption ? defaultRef : undefined}
                className={o.recommended ? 'primary' : o.id === 'cancel' ? undefined : 'pj-units-secondary'}
                aria-describedby={`${descId}-${o.id}`}
                data-units-choice={o.id}
                onClick={() => onChoose(o.id)}
              >
                {o.label}
                {o.recommended ? ' (recomendado)' : ''}
              </button>
              <span id={`${descId}-${o.id}`} className="muted small">
                {o.description}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

export function ProjectPanel({ store }: { store: EditorStore }) {
  const meta = useStoreSelector(store, (s) => s.doc.meta);
  const units = useStoreSelector(store, (s) => s.doc.units);
  const [pendingUnits, setPendingUnits] = useState<UnitsKind | null>(null);
  const [unitsNotice, setUnitsNotice] = useState<UnitsNotice | null>(null);
  const notesId = useId();
  const notesHintId = useId();
  const unitsId = useId();
  const unitsHintId = useId();

  const [form, setForm, reset] = useDraft(() => projectToForm({ meta }), [meta]);

  const commit = (field: MetaField): void => {
    const cmd = metaPatchCommand(store.getState().doc, field, form[field]);
    if (cmd) store.dispatch(cmd);
    else reset(); // texto equivalente (espacios): vuelve al valor guardado
  };

  // Las unidades pueden cambiar desde fuera (Ctrl+Z, Ctrl+Y): el aviso deja de ser cierto y se quita (R9-06).
  useEffect(() => {
    if (unitsNotice !== null && !unitsNoticeStillValid(unitsNotice, units)) setUnitsNotice(null);
  }, [units, unitsNotice]);

  const unitsNow = currentUnits({ units });
  const options = unitsOptions(unitsNow);
  const selectValue = unitsNow.kind === 'other' ? unitsNow.raw : unitsNow.kind;

  const onUnitsChange = (value: string): void => {
    if (value !== 'SI' && value !== 'imperial') return;
    if (value === unitsNow.kind) return;
    setUnitsNotice(null);
    setPendingUnits(value);
  };
  const onUnitsChoice = (choice: UnitsChoice): void => {
    const to = pendingUnits;
    setPendingUnits(null);
    if (to === null) return;
    // El estado pudo cambiar mientras el diálogo estaba abierto: el comando se recalcula sobre el documento actual.
    const cmd = unitsChoiceCommand(store.getState().doc, to, choice);
    if (!cmd) return;
    store.dispatch(cmd);
    const after = store.getState().doc.units ?? 'SI';
    if (choice === 'convert') {
      store.dispatch({ type: 'ui/viewport', viewport: null }); // las coordenadas cambiaron de escala: el lienzo vuelve a encuadrar
      setUnitsNotice({
        text: `Valores convertidos a ${to === 'imperial' ? 'imperial (ft, pcf, psf)' : 'SI (m, kN/m³, kPa)'}. El factor de seguridad no cambia. Ctrl+Z lo deshace.`,
        units: after,
      });
    } else {
      setUnitsNotice({ text: 'Solo se cambió la etiqueta: los números del modelo no se convirtieron.', units: after });
    }
  };

  const onNotesKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Escape') reset();
  };

  return (
    <PanelSection title="Proyecto">
      <p className="muted small">El título y la descripción se guardan en el archivo y aparecen en el informe PDF.</p>
      <div className="project-stack">
        <LabeledField
          label="Título"
          mode="text"
          path="/meta/title"
          value={form.title}
          hint="Se muestra en la barra de estado"
          onChange={(v) => setForm({ ...form, title: v })}
          onCommit={() => commit('title')}
          onReset={reset}
        />
        <LabeledField
          label="Identificador (id)"
          mode="text"
          path="/meta/id"
          value={form.id}
          hint="Nombra los archivos exportados cuando el modelo no tiene archivo"
          onChange={(v) => setForm({ ...form, id: v })}
          onCommit={() => commit('id')}
          onReset={reset}
        />
        <div className="field ep-field">
          <label htmlFor={notesId}>Descripción</label>
          <span id={notesHintId} className="muted small">
            Notas del proyecto: objetivo, fuentes de los datos, supuestos
          </span>
          <textarea
            id={notesId}
            data-path="/meta/notes"
            rows={5}
            className="project-textarea"
            value={form.notes}
            aria-describedby={notesHintId}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            onBlur={() => commit('notes')}
            onKeyDown={onNotesKeyDown}
          />
        </div>
        <div className="field ep-field">
          <label htmlFor={unitsId}>Unidades</label>
          <span id={unitsHintId} className="muted small">
            Al cambiar de sistema puede convertir los valores del modelo (el factor de seguridad no cambia) o solo cambiar la etiqueta
          </span>
          <select id={unitsId} data-path="/units" value={selectValue} aria-describedby={unitsHintId} onChange={(e) => onUnitsChange(e.target.value)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {unitsNoticeStillValid(unitsNotice, units) ? (
            <p className="small pj-units-notice" role="status" data-testid="units-notice">
              {unitsNotice.text}
            </p>
          ) : null}
        </div>
      </div>
      {pendingUnits ? <UnitsDialog from={unitsNow} to={pendingUnits} onChoose={onUnitsChoice} /> : null}
    </PanelSection>
  );
}
