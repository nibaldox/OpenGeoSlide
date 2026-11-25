// Panel «Proyecto»: título, identificador y descripción del modelo (`meta`) y sistema de unidades. Misma firma que los demás
// paneles (`{ store }`). El esquema (`schema/ogs-0.2.schema.json`, `$defs/meta`) solo tiene `id`, `title` y `notes`.
// Cambiar las unidades no convierte los valores: antes de aplicar el cambio se pide confirmación (`useConfirm`).

import { useId, type KeyboardEvent } from 'react';
import { useConfirm } from '../../ui/ConfirmDialog';
import type { EditorStore } from '../types';
import { LabeledField, PanelSection } from './Fields';
import { currentUnits, metaPatchCommand, projectToForm, unitsChangeCommand, unitsChangeConfirm, unitsOptions, type MetaField } from './projectForm';
import { useDraft, useStoreSelector } from './useStoreSelector';

export function ProjectPanel({ store }: { store: EditorStore }) {
  const meta = useStoreSelector(store, (s) => s.doc.meta);
  const units = useStoreSelector(store, (s) => s.doc.units);
  const confirm = useConfirm();
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

  const unitsNow = currentUnits({ units });
  const options = unitsOptions(unitsNow);
  const selectValue = unitsNow.kind === 'other' ? unitsNow.raw : unitsNow.kind;

  const onUnitsChange = async (value: string): Promise<void> => {
    if (value !== 'SI' && value !== 'imperial') return;
    const doc = store.getState().doc;
    const cmd = unitsChangeCommand(doc, value);
    if (!cmd) return;
    const ok = await confirm(unitsChangeConfirm(unitsNow, value));
    if (!ok) return;
    // El estado pudo cambiar mientras el diálogo estaba abierto: se recalcula sobre el documento actual.
    const fresh = unitsChangeCommand(store.getState().doc, value);
    if (fresh) store.dispatch(fresh);
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
            Cambiar de sistema no convierte los valores del modelo
          </span>
          <select id={unitsId} data-path="/units" value={selectValue} aria-describedby={unitsHintId} onChange={(e) => void onUnitsChange(e.target.value)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </PanelSection>
  );
}
