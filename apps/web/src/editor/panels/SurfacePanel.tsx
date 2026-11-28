import { useEffect, useId } from 'react';
import type { Point } from '../../engine/types';
import type { EditorStore } from '../types';
import { applyCommands } from './dispatch';
import { ErrorList, LabeledField, PanelSection, RowsPendingNote, TextInput } from './Fields';
import { useDraft, useStoreSelector } from './useStoreSelector';
import {
  circleFromForm,
  circleToForm,
  circlesEqual,
  hasIgnoredSurface,
  canInsertPolylinePoint,
  insertPolylinePoint,
  modelXRange,
  polylineFromForm,
  polylineRowsSorted,
  polylineSetCommand,
  polylineToForm,
  removePolylinePoint,
  ROWS_PENDING_REASON,
  setPendingDraft,
  sortPolylineRows,
  surfaceMode,
  surfaceModeCommands,
  surfaceSetCommand,
  surfaceShape,
  surfaceShapeCommands,
  unitLabels,
} from './forms';

const NO_POINTS: readonly Point[] = [];

function samePoints(a: readonly Point[], b: readonly Point[]): boolean {
  return a.length === b.length && a.every((p, i) => p[0] === b[i]?.[0] && p[1] === b[i]?.[1]);
}

/** R16c: registro de los borradores de la superficie fija. */
export const SURFACE_POLYLINE_DRAFT = { key: 'surface:polyline', label: 'Superficie fija: polilínea' } as const;
export const SURFACE_CIRCLE_DRAFT = { key: 'surface:circle', label: 'Superficie fija: círculo' } as const;
/** Tabla de la polilínea inválida que difiere del documento: borrador sin aplicar. */
export const polylineDraftPending = (rows: ReturnType<typeof polylineToForm>, points: readonly Point[], xRange: readonly [number, number] | null): boolean =>
  !polylineFromForm(rows, { xRange }).ok && JSON.stringify(rows) !== JSON.stringify(polylineToForm(points));
/** Círculo fijo inválido que difiere del documento: borrador sin aplicar. */
export const circleDraftPending = (form: ReturnType<typeof circleToForm>, surface: Parameters<typeof circleToForm>[0] | null): boolean =>
  surface !== null && surface.type !== 'polyline' && !circleFromForm(form).ok && JSON.stringify(form) !== JSON.stringify(circleToForm(surface));

/**
 * Tabla de los puntos de la polilínea fija (F3.3): x, y editables, agregar (un punto a medio camino del siguiente, así la forma no cambia),
 * quitar (mínimo 2) y «Ordenar por x». Se guarda solo cuando la tabla es válida (al menos 2 puntos, x estrictamente creciente).
 */
function PolylineTable({ store }: { store: EditorStore }) {
  const surface = useStoreSelector(store, (s) => s.doc.analysis.surface ?? null);
  const units = useStoreSelector(store, (s) => s.doc.units);
  const regions = useStoreSelector(store, (s) => s.doc.regions);
  const u = unitLabels(units);
  const points = surface && surface.type === 'polyline' ? surface.points : NO_POINTS;
  const xRange = modelXRange({ regions });
  const [rows, setRows, resetRows] = useDraft(() => polylineToForm(points), [surface]);
  const table = polylineFromForm(rows, { xRange });
  const tableErrors = table.ok ? {} : table.errors;
  const rowsPending = polylineDraftPending(rows, points, xRange);
  const pendingNoteId = useId();
  // Agregar o quitar puntos reemplaza las filas con las del documento: con un borrador sin aplicar se pierde, así que se deshabilita.
  const rowsReason = rowsPending ? ROWS_PENDING_REASON : undefined;
  const rowsDescribedBy = rowsPending ? pendingNoteId : undefined;
  useEffect(() => {
    setPendingDraft(store, SURFACE_POLYLINE_DRAFT.key, rowsPending ? SURFACE_POLYLINE_DRAFT.label : null);
    return () => setPendingDraft(store, SURFACE_POLYLINE_DRAFT.key, null);
  }, [store, rowsPending]);
  const commitRows = (): void => {
    if (table.ok && !samePoints(points, table.value)) store.dispatch(polylineSetCommand(table.value));
  };
  const sorted = polylineRowsSorted(rows);
  const sortRows = (): void => {
    const next = sortPolylineRows(rows);
    setRows(next);
    const r = polylineFromForm(next, { xRange });
    if (r.ok && !samePoints(points, r.value)) store.dispatch(polylineSetCommand(r.value));
  };

  return (
    <>
      <div className="ep-table-wrap" role="region" aria-label="Puntos de la polilínea de falla" tabIndex={0}>
        <table className="ep-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">x ({u.length})</th>
              <th scope="col">y ({u.length})</th>
              <th scope="col">
                <span className="visually-hidden">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const remaining = removePolylinePoint(points, i);
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  {(['x', 'y'] as const).map((axis) => (
                    <td key={axis}>
                      <TextInput
                        value={row[axis]}
                        ariaLabel={`Polilínea, punto ${i + 1}: ${axis}`}
                        path={`/analysis/surface/points/${i}/${axis === 'x' ? 0 : 1}`}
                        invalid={`${i}.${axis}` in tableErrors}
                        onChange={(v) => setRows(rows.map((r, j) => (j === i ? { ...r, [axis]: v } : r)))}
                        onCommit={commitRows}
                        onReset={resetRows}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      disabled={rowsPending || !table.ok || i >= points.length || !canInsertPolylinePoint(points, i, xRange)}
                      title={
                        rowsReason ??
                        (table.ok && i < points.length && !canInsertPolylinePoint(points, i, xRange)
                          ? 'No cabe un punto entre estos dos: la x debe seguir creciendo con la separación mínima'
                          : 'Agregar un punto a medio camino del siguiente (o a la derecha del último)')
                      }
                      aria-describedby={rowsDescribedBy}
                      aria-label={`Agregar un punto después del punto ${i + 1} de la polilínea`}
                      onClick={() => store.dispatch(polylineSetCommand(insertPolylinePoint(points, i, xRange)))}
                    >
                      Agregar
                    </button>{' '}
                    <button
                      type="button"
                      disabled={remaining === null || rowsPending}
                      title={rowsReason ?? (remaining === null ? 'Mínimo 2 puntos' : 'Quitar punto')}
                      aria-describedby={rowsDescribedBy}
                      aria-label={`Quitar el punto ${i + 1} de la polilínea`}
                      onClick={() => remaining && store.dispatch(polylineSetCommand(remaining))}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ErrorList errors={tableErrors} />
      <RowsPendingNote id={pendingNoteId} pending={rowsPending} />
      <p className="muted small">
        Al menos 2 puntos, con x estrictamente creciente. Los extremos se prolongan o se recortan hasta el terreno; los puntos intermedios deben
        quedar bajo el terreno y dentro del modelo (lo comprueba el cálculo).
      </p>
      <div className="ep-actions">
        <button type="button" disabled={sorted} title={sorted ? 'Los puntos ya están ordenados por x' : 'Ordenar las filas por x creciente'} onClick={sortRows}>
          Ordenar por x
        </button>
      </div>
    </>
  );
}

export function SurfacePanel({ store }: { store: EditorStore }) {
  const modeName = useId();
  const shapeName = useId();
  const surface = useStoreSelector(store, (s) => s.doc.analysis.surface ?? null);
  const search = useStoreSelector(store, (s) => s.doc.analysis.search ?? null);
  const units = useStoreSelector(store, (s) => s.doc.units);
  const u = unitLabels(units);
  const mode = surfaceMode({ surface, search });
  const ignored = hasIgnoredSurface({ surface, search });
  const shape = surfaceShape({ surface });

  const [form, setForm, reset] = useDraft(() => (surface ? circleToForm(surface) : { xc: '', yc: '', r: '' }), [surface]);
  const outcome = circleFromForm(form);
  const errors = surface && shape === 'circle' && !outcome.ok ? outcome.errors : {};
  const circlePending = mode === 'fixed' && shape === 'circle' && circleDraftPending(form, surface);
  useEffect(() => {
    setPendingDraft(store, SURFACE_CIRCLE_DRAFT.key, circlePending ? SURFACE_CIRCLE_DRAFT.label : null);
    return () => setPendingDraft(store, SURFACE_CIRCLE_DRAFT.key, null);
  }, [store, circlePending]);
  const commit = (): void => {
    if (surface && shape === 'circle' && outcome.ok && !circlesEqual(outcome.value, surface)) store.dispatch(surfaceSetCommand(outcome.value));
  };
  const select = (): void => store.dispatch({ type: 'ui/select', selection: { kind: 'surface_circle' } });
  const change = (to: 'search' | 'fixed'): void =>
    applyCommands(store, 'Cambiar el tipo de superficie', surfaceModeCommands(store.getState().doc, to));
  const changeShape = (to: 'circle' | 'polyline'): void =>
    applyCommands(store, 'Cambiar la forma de la superficie', surfaceShapeCommands(store.getState().doc, to));

  return (
    <PanelSection title="Superficie de falla">
      <fieldset className="field">
        <legend>Tipo</legend>
        <div className="ep-radios">
          <label>
            <input type="radio" name={modeName} checked={mode === 'search'} onChange={() => change('search')} />
            Búsqueda
          </label>
          <label>
            <input type="radio" name={modeName} checked={mode === 'fixed'} onChange={() => change('fixed')} />
            Fija
          </label>
        </div>
      </fieldset>

      {mode === 'fixed' && shape !== null ? (
        <fieldset className="field">
          <legend>Forma de la superficie fija</legend>
          <div className="ep-radios">
            <label>
              <input type="radio" name={shapeName} checked={shape === 'circle'} onChange={() => changeShape('circle')} />
              Círculo
            </label>
            <label>
              <input type="radio" name={shapeName} checked={shape === 'polyline'} onChange={() => changeShape('polyline')} />
              Polilínea
            </label>
          </div>
          {shape === 'polyline' ? (
            <p className="muted small">
              Con una polilínea no se ofrece Bishop simplificado (solo Spencer, Morgenstern-Price y Janbu), porque su resultado depende del eje de
              momentos.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {mode === 'none' ? <p className="muted">Sin superficie definida: elija «Búsqueda» o «Fija» para poder analizar.</p> : null}
      {mode === 'search' ? (
        <p className="muted">Se busca la superficie crítica. Los rangos y la rejilla se editan en «Búsqueda».</p>
      ) : null}
      {ignored ? (
        <p className="ep-error" role="alert">
          Hay {shape === 'polyline' ? 'una polilínea fija guardada' : 'un círculo fijo guardado'}, pero con búsqueda activa el motor lo ignora.{' '}
          <button type="button" onClick={() => change('search')}>
            Quitar {shape === 'polyline' ? 'la polilínea fija' : 'el círculo fijo'}
          </button>
        </p>
      ) : null}

      {mode === 'fixed' && surface && shape === 'circle' ? (
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
              path={`/analysis/surface/${key}`}
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
      {mode === 'fixed' && shape === 'polyline' ? <PolylineTable store={store} /> : null}
    </PanelSection>
  );
}
