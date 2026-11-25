import type { Point } from '../../engine/types';
import type { EditorStore } from '../types';
import { ErrorList, LabeledField, PanelSection, TextInput } from './Fields';
import { useDraft, useStoreSelector } from './useStoreSelector';
import {
  appendPiezoPoint,
  defaultWaterUnitWeight,
  defaultPiezo,
  formatNumber,
  piezoFromForm,
  piezoSetCommand,
  piezoToForm,
  removePiezoPoint,
  unitLabels,
  waterUnitWeightCommand,
  waterUnitWeightHint,
  waterUnitWeightFromForm,
} from './forms';

function samePoints(a: readonly Point[], b: readonly Point[]): boolean {
  return a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);
}

export function WaterPanel({ store }: { store: EditorStore }) {
  const unitWeight = useStoreSelector(store, (s) => s.doc.water?.unit_weight);
  const points = useStoreSelector(store, (s) => s.doc.water?.piezometric_line ?? null);
  const units = useStoreSelector(store, (s) => s.doc.units);
  const selection = useStoreSelector(store, (s) => s.ui.selection);
  const u = unitLabels(units);

  const [gammaText, setGammaText, resetGamma] = useDraft(() => formatNumber(unitWeight), [unitWeight]);
  const gamma = waterUnitWeightFromForm(gammaText);
  const commitGamma = (): void => {
    if (gamma.ok && gamma.value !== unitWeight) store.dispatch(waterUnitWeightCommand(gamma.value));
  };

  const [rows, setRows, resetRows] = useDraft(() => piezoToForm(points), [points]);
  const table = piezoFromForm(rows);
  const tableErrors = table.ok ? {} : table.errors;
  const commitRows = (): void => {
    if (table.ok && table.value !== null && !(points && samePoints(points, table.value))) {
      store.dispatch(piezoSetCommand(table.value));
    }
  };
  const selectPoint = (index: number): void =>
    store.dispatch({ type: 'ui/select', selection: { kind: 'piezo_point', index } });
  const created = defaultPiezo(store.getState().doc);

  return (
    <PanelSection title="Agua">
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
          <p className="muted">Sin piezométrica: el análisis es seco (salvo ru).</p>
          <div className="ep-actions">
            <button type="button" disabled={created === null} onClick={() => created && store.dispatch(piezoSetCommand(created))}>
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
                        disabled={remaining === null}
                        title={remaining === null ? 'Mínimo 2 puntos' : 'Quitar punto'}
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
          <div className="ep-actions">
            <button type="button" onClick={() => store.dispatch(piezoSetCommand(appendPiezoPoint(points, store.getState().doc)))}>
              Agregar punto
            </button>
            <button type="button" onClick={() => store.dispatch(piezoSetCommand(null))}>
              Quitar piezométrica
            </button>
          </div>
        </>
      )}
    </PanelSection>
  );
}
