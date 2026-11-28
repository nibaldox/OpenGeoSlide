import { useEffect, useId } from 'react';
import type { Point } from '../../engine/types';
import type { EditorStore } from '../types';
import { ErrorList, LabeledField, PanelSection, RowsPendingNote, TextInput } from './Fields';
import { useDraft, useStoreSelector } from './useStoreSelector';
import {
  appendPiezoPoint,
  defaultWaterUnitWeight,
  defaultPiezo,
  formatNumber,
  piezoCreateCommands,
  piezoFromForm,
  piezoSetCommand,
  piezoToForm,
  removePiezoPoint,
  ROWS_PENDING_REASON,
  setPendingDraft,
  unitLabels,
  waterUnitWeightCommand,
  waterUnitWeightHint,
  waterUnitWeightFromForm,
} from './forms';

function samePoints(a: readonly Point[], b: readonly Point[]): boolean {
  return a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);
}

/** R16c: registro de los borradores del agua (γw y tabla piezométrica). */
export const WATER_GAMMA_DRAFT = { key: 'water:unit_weight', label: 'Agua: peso unitario γw' } as const;
export const WATER_PIEZO_DRAFT = { key: 'water:piezometric_line', label: 'Agua: línea piezométrica' } as const;
/** γw inválido que difiere del documento: borrador sin aplicar. */
export const gammaDraftPending = (text: string, unitWeight: number | undefined): boolean => !waterUnitWeightFromForm(text).ok && text !== formatNumber(unitWeight);
/** Tabla piezométrica inválida que difiere del documento: borrador sin aplicar. */
export const piezoDraftPending = (rows: ReturnType<typeof piezoToForm>, points: readonly Point[] | null): boolean =>
  !piezoFromForm(rows).ok && JSON.stringify(rows) !== JSON.stringify(piezoToForm(points));

export function WaterPanel({ store }: { store: EditorStore }) {
  const unitWeight = useStoreSelector(store, (s) => s.doc.water?.unit_weight);
  const points = useStoreSelector(store, (s) => s.doc.water?.piezometric_line ?? null);
  const units = useStoreSelector(store, (s) => s.doc.units);
  // E15l-18: el agua de la grieta (`water_fill > 0`) también usa γw.
  const crackFill = useStoreSelector(store, (s) => s.doc.analysis.tension_crack?.water_fill ?? 0);
  const selection = useStoreSelector(store, (s) => s.ui.selection);
  const u = unitLabels(units);

  const [gammaText, setGammaText, resetGamma] = useDraft(() => formatNumber(unitWeight), [unitWeight]);
  const gamma = waterUnitWeightFromForm(gammaText);
  // R16c: γw o la tabla piezométrica inválidos que difieren del documento son borradores sin aplicar.
  const gammaPending = gammaDraftPending(gammaText, unitWeight);
  useEffect(() => {
    setPendingDraft(store, WATER_GAMMA_DRAFT.key, gammaPending ? WATER_GAMMA_DRAFT.label : null);
    return () => setPendingDraft(store, WATER_GAMMA_DRAFT.key, null);
  }, [store, gammaPending]);
  const commitGamma = (): void => {
    if (gamma.ok && gamma.value !== unitWeight) store.dispatch(waterUnitWeightCommand(gamma.value));
  };

  const [rows, setRows, resetRows] = useDraft(() => piezoToForm(points), [points]);
  const table = piezoFromForm(rows);
  const tableErrors = table.ok ? {} : table.errors;
  const rowsPending = piezoDraftPending(rows, points);
  const pendingNoteId = useId();
  // Quitar o agregar puntos reemplaza las filas con las del documento: con un borrador sin aplicar se pierde, así que se deshabilita.
  const rowsReason = rowsPending ? ROWS_PENDING_REASON : undefined;
  const rowsDescribedBy = rowsPending ? pendingNoteId : undefined;
  useEffect(() => {
    setPendingDraft(store, WATER_PIEZO_DRAFT.key, rowsPending ? WATER_PIEZO_DRAFT.label : null);
    return () => setPendingDraft(store, WATER_PIEZO_DRAFT.key, null);
  }, [store, rowsPending]);
  const commitRows = (): void => {
    if (table.ok && table.value !== null && !(points && samePoints(points, table.value))) {
      store.dispatch(piezoSetCommand(table.value));
    }
  };
  const selectPoint = (index: number): void =>
    store.dispatch({ type: 'ui/select', selection: { kind: 'piezo_point', index } });
  const created = defaultPiezo(store.getState().doc);
  // R9-09: crear la piezométrica en un modelo imperial sin γw fija también γw = 62,4 pcf, en el mismo paso deshacible.
  const createPiezo = (pts: Point[]): void => {
    store.beginGesture('Crear piezométrica');
    try {
      for (const cmd of piezoCreateCommands(store.getState().doc, pts)) store.dispatch(cmd);
    } finally {
      store.endGesture();
    }
  };

  return (
    <PanelSection title="Agua">
      <p className="muted small">
        Si la línea piezométrica queda sobre el terreno, el agua embalsada se carga automáticamente, con su peso y su empuje horizontal
        (sin sismo). No hay nada que activar: se calcula con el peso unitario γw de este panel, el mismo que usa el agua de la grieta de tracción.
      </p>
      <LabeledField
        label="Peso unitario del agua γw"
        unit={u.unitWeight}
        value={gammaText}
        placeholder={formatNumber(defaultWaterUnitWeight(units))}
        hint={waterUnitWeightHint(units)}
        path="/water/unit_weight"
        error={gamma.ok ? undefined : gamma.errors.unit_weight}
        onChange={setGammaText}
        onCommit={commitGamma}
        onReset={resetGamma}
      />

      <h3>Línea piezométrica</h3>
      {points === null ? (
        <>
          {crackFill > 0 ? (
            <p className="muted">
              Sin piezométrica no hay presión de poros por agua (salvo ru), pero el agua de la grieta de tracción sí pesa: su empuje usa el peso
              unitario γw de este panel.
            </p>
          ) : (
            <p className="muted">Sin piezométrica: el análisis es seco (salvo ru).</p>
          )}
          <div className="ep-actions">
            <button type="button" disabled={created === null} onClick={() => created && createPiezo(created)}>
              Crear piezométrica
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="ep-table-wrap" role="region" aria-label="Puntos de la línea piezométrica" tabIndex={0}>
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
                const remaining = removePiezoPoint(points, i);
                return (
                  <tr key={i} className={selection.kind === 'piezo_point' && selection.index === i ? 'ep-row-selected' : undefined}>
                    <td>{i + 1}</td>
                    {(['x', 'y'] as const).map((axis) => (
                      <td key={axis}>
                        <TextInput
                          value={row[axis]}
                          ariaLabel={`Piezométrica, punto ${i + 1}: ${axis}`}
                          path={`/water/piezometric_line/${i}/${axis}`}
                          invalid={`${i}.${axis}` in tableErrors}
                          onChange={(v) => setRows(rows.map((r, j) => (j === i ? { ...r, [axis]: v } : r)))}
                          onCommit={commitRows}
                          onReset={resetRows}
                          onFocus={() => selectPoint(i)}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        disabled={remaining === null || rowsPending}
                        title={rowsReason ?? (remaining === null ? 'Mínimo 2 puntos' : 'Quitar punto')}
                        aria-describedby={rowsDescribedBy}
                        aria-label={`Quitar el punto ${i + 1} de la piezométrica`}
                        onClick={() => remaining && store.dispatch(piezoSetCommand(remaining))}
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
          <p className="muted small">Mínimo 2 puntos, con x estrictamente creciente.</p>
          <RowsPendingNote id={pendingNoteId} pending={rowsPending} />
          <div className="ep-actions">
            <button
              type="button"
              disabled={rowsPending}
              title={rowsReason}
              aria-describedby={rowsDescribedBy}
              onClick={() => store.dispatch(piezoSetCommand(appendPiezoPoint(points, store.getState().doc)))}
            >
              Agregar punto
            </button>
            <button type="button" disabled={rowsPending} title={rowsReason} aria-describedby={rowsDescribedBy} onClick={() => store.dispatch(piezoSetCommand(null))}>
              Quitar piezométrica
            </button>
          </div>
        </>
      )}
    </PanelSection>
  );
}
