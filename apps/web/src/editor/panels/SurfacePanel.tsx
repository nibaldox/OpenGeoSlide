import type { EditorStore } from '../types';
import { applyCommands } from './dispatch';
import { LabeledField, PanelSection } from './Fields';
import { useDraft, useStoreSelector } from './useStoreSelector';
import {
  circleFromForm,
  circleToForm,
  circlesEqual,
  hasIgnoredSurface,
  surfaceMode,
  surfaceModeCommands,
  surfaceSetCommand,
  unitLabels,
} from './forms';

export function SurfacePanel({ store }: { store: EditorStore }) {
  const surface = useStoreSelector(store, (s) => s.doc.analysis.surface ?? null);
  const search = useStoreSelector(store, (s) => s.doc.analysis.search ?? null);
  const units = useStoreSelector(store, (s) => s.doc.units);
  const u = unitLabels(units);
  const mode = surfaceMode({ surface, search });
  const ignored = hasIgnoredSurface({ surface, search });

  const [form, setForm, reset] = useDraft(() => (surface ? circleToForm(surface) : { xc: '', yc: '', r: '' }), [surface]);
  const outcome = circleFromForm(form);
  const errors = surface && !outcome.ok ? outcome.errors : {};
  const commit = (): void => {
    if (surface && outcome.ok && !circlesEqual(outcome.value, surface)) store.dispatch(surfaceSetCommand(outcome.value));
  };
  const select = (): void => store.dispatch({ type: 'ui/select', selection: { kind: 'surface_circle' } });
  const change = (to: 'search' | 'fixed'): void =>
    applyCommands(store, 'Cambiar el tipo de superficie', surfaceModeCommands(store.getState().doc, to));

  return (
    <PanelSection title="Superficie de falla">
      <fieldset className="field">
        <legend>Tipo</legend>
        <div className="ep-radios">
          <label>
            <input type="radio" name="surface-mode" checked={mode === 'search'} onChange={() => change('search')} />
            Búsqueda
          </label>
          <label>
            <input type="radio" name="surface-mode" checked={mode === 'fixed'} onChange={() => change('fixed')} />
            Fija
          </label>
        </div>
      </fieldset>

      {mode === 'none' ? <p className="muted">Sin superficie definida: elija «Búsqueda» o «Fija» para poder analizar.</p> : null}
      {mode === 'search' ? (
        <p className="muted">Se busca la superficie crítica. Los rangos y la rejilla se editan en «Búsqueda».</p>
      ) : null}
      {ignored ? (
        <p className="ep-error" role="alert">
          Hay un círculo fijo guardado, pero con búsqueda activa el motor lo ignora.{' '}
          <button type="button" onClick={() => change('search')}>
            Quitar el círculo fijo
          </button>
        </p>
      ) : null}

      {mode === 'fixed' && surface ? (
        <div className="ep-grid">
          {(
            [
              ['xc', 'Centro xc'],
              ['yc', 'Centro yc'],
              ['r', 'Radio r'],
            ] as const
          ).map(([key, label]) => (
            <LabeledField
              key={key}
              label={label}
              unit={u.length}
              value={form[key]}
              error={key in errors ? errors[key] : undefined}
              onChange={(v) => setForm({ ...form, [key]: v })}
              onCommit={commit}
              onReset={reset}
              onFocus={select}
            />
          ))}
        </div>
      ) : null}
    </PanelSection>
  );
}
