import type { EditorStore } from '../types';
import { LabeledField, PanelSection } from './Fields';
import { useDraft, useStoreSelector } from './useStoreSelector';
import { SEISMIC_HELP, seismicFromForm, seismicSetCommand, seismicToForm, seismicsEqual } from './forms';

export function SeismicPanel({ store }: { store: EditorStore }) {
  const seismic = useStoreSelector(store, (s) => s.doc.analysis.seismic ?? null);
  const [form, setForm, reset] = useDraft(() => seismicToForm(store.getState().doc), [seismic]);
  const outcome = seismicFromForm(form);
  const errors = outcome.ok ? {} : outcome.errors;
  const commit = (): void => {
    if (outcome.ok && !seismicsEqual(outcome.value, seismic)) store.dispatch(seismicSetCommand(outcome.value));
  };
  const err = (key: 'kh' | 'kv'): string | undefined => (key in errors ? errors[key] : undefined);

  return (
    <PanelSection title="Sismo (pseudoestático)">
      <p className="muted small">{SEISMIC_HELP}</p>
      <div className="ep-grid">
        <LabeledField
          label="kh"
          path="/analysis/seismic/kh"
          value={form.kh}
          placeholder="0"
          hint="Horizontal, de 0 a menos de 1"
          error={err('kh')}
          onChange={(v) => setForm({ ...form, kh: v })}
          onCommit={commit}
          onReset={reset}
        />
        <LabeledField
          label="kv"
          path="/analysis/seismic/kv"
          value={form.kv}
          placeholder="0"
          hint="Vertical, mayor que −1 y menor que 1"
          error={err('kv')}
          onChange={(v) => setForm({ ...form, kv: v })}
          onCommit={commit}
          onReset={reset}
        />
      </div>
      <div className="ep-actions">
        <button
          type="button"
          disabled={seismic === null}
          onClick={() => store.dispatch(seismicSetCommand(null))}
        >
          Quitar sismo
        </button>
      </div>
    </PanelSection>
  );
}
