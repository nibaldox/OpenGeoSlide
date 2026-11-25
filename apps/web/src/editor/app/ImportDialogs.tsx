// Diálogos de importación: DXF (capas → materiales, unidades, polilíneas abiertas) y CSV (regiones o piezométrica).

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Material, Point } from '../../engine/types';
import { csvToPoints, csvToRegions } from '../../io/csv';
import type { DxfParseResult } from '../../io/dxf';
import type { CsvImportResult, ImportIssue } from '../../io/types';
import { parseNumber } from '../panels/forms';
import {
  LENGTH_UNITS,
  NEW_MATERIAL,
  SKIP_LAYER,
  defaultMapping,
  defaultUnit,
  importableLayers,
  openPolylines,
  planRegionImport,
  suggestBaseText,
  unitFactor,
  type LengthUnit,
  type RegionImportPlan,
} from './importPlan';
import { layerChoice } from './layerChoice';

/**
 * Diálogo modal nativo (`<dialog>` + `showModal()`): el navegador atrapa el foco, deja inerte el resto de la página y cierra
 * con Esc (R7-03). El foco inicial va al título para que se lea antes que las incidencias; al cerrar, vuelve al botón que
 * lo abrió.
 */
export function Modal({ title, onCancel, children }: { title: string; onCancel: () => void; children: ReactNode }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    titleRef.current?.focus();
    // Al desmontar, el navegador saca el diálogo de la capa superior y devuelve la inercia al resto de la página;
    // solo falta devolver el foco. No se llama a `close()`: su evento `close` volvería a invocar `onCancel`.
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="ea-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault(); // el estado de React decide cuándo desaparece
        onCancel();
      }}
      onClose={onCancel}
    >
      <h2 id={titleId} ref={titleRef} tabIndex={-1}>
        {title}
      </h2>
      {children}
    </dialog>
  );
}

function IssueList({ issues }: { issues: readonly ImportIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="ea-issues small" aria-label="Incidencias de la lectura del archivo">
      {issues.map((i, k) => (
        <li key={k} className={i.severity === 'error' ? 'ea-issue-error' : 'ea-issue-aviso'}>
          <strong>{i.severity === 'error' ? 'Error' : 'Aviso'}:</strong> {i.text}
        </li>
      ))}
    </ul>
  );
}

function LayerMapTable({ layers, materials, mapping, onChange }: {
  layers: { name: string; detail: string }[];
  materials: readonly Material[];
  mapping: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <div className="table-scroll" role="region" aria-label="Asignación de materiales por capa" tabIndex={0}>
    <table className="ea-table">
      <thead>
        <tr>
          <th scope="col">Capa</th>
          <th scope="col">Contenido</th>
          <th scope="col">Material</th>
        </tr>
      </thead>
      <tbody>
        {layers.map((l) => (
          <tr key={l.name}>
            <td>{l.name}</td>
            <td className="muted small">{l.detail}</td>
            <td>
              <select
                aria-label={`Material de la capa ${l.name}`}
                value={layerChoice(mapping, l.name)}
                onChange={(e) => onChange({ ...mapping, [l.name]: e.target.value })}
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
                <option value={NEW_MATERIAL}>Crear material nuevo «{l.name}»</option>
                <option value={SKIP_LAYER}>No importar esta capa</option>
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

function ModeChoice({ mode, onChange }: { mode: 'add' | 'replace'; onChange: (m: 'add' | 'replace') => void }) {
  const name = useId();
  return (
    <fieldset className="ea-fieldset">
      <legend>Destino</legend>
      <label>
        <input type="radio" name={name} checked={mode === 'add'} onChange={() => onChange('add')} /> Agregar a las regiones actuales
      </label>
      <label>
        <input type="radio" name={name} checked={mode === 'replace'} onChange={() => onChange('replace')} /> Reemplazar las regiones
        actuales
      </label>
    </fieldset>
  );
}

function PlanSummary({ plan }: { plan: RegionImportPlan }) {
  return (
    <p className="small" role="status">
      Se importarán <strong>{plan.regions.length}</strong> región(es) y se crearán <strong>{plan.newMaterials.length}</strong> material(es)
      nuevo(s)
      {plan.skipped > 0 ? `; ${plan.skipped} elemento(s) omitido(s)` : ''}. {plan.notes.join(' ')}
    </p>
  );
}

const UNIT_LABEL: Record<LengthUnit, string> = { m: 'metros (m)', cm: 'centímetros (cm)', mm: 'milímetros (mm)', ft: 'pies (ft)', in: 'pulgadas (in)' };

export interface DxfDialogProps {
  fileName: string;
  result: DxfParseResult;
  materials: readonly Material[];
  units: string | undefined;
  onCancel: () => void;
  onApply: (plan: RegionImportPlan, mode: 'add' | 'replace') => void;
}

export function DxfImportDialog({ fileName, result, materials, units, onCancel, onApply }: DxfDialogProps) {
  const layers = useMemo(() => importableLayers(result), [result]);
  const open = useMemo(() => openPolylines(result), [result]);
  const [mapping, setMapping] = useState(() => defaultMapping(layers));
  const [unit, setUnit] = useState<LengthUnit>(() => defaultUnit(result.unitsFromHeader, units));
  const [mode, setMode] = useState<'add' | 'replace'>('add');
  const [openMode, setOpenMode] = useState<'close' | 'discard'>('close');
  const openModeName = useId();
  const factor = unitFactor(unit, units);
  // La base sugerida sigue a la unidad del dibujo mientras el usuario no haya escrito su propio valor (R7-06).
  const [baseEdited, setBaseEdited] = useState<string | null>(null);
  const baseText = baseEdited ?? suggestBaseText(open, unit, units);
  const parsedBase = parseNumber(baseText);
  const baseY = parsedBase.kind === 'ok' ? parsedBase.value : null;

  const plan = useMemo(
    () =>
      planRegionImport(
        { materials: [...materials], units },
        {
          regions: result.regions,
          open: open.map((e) => ({ layer: e.layer, points: e.points })),
          mapping,
          factor,
          openMode,
          baseY,
        },
      ),
    [materials, units, result.regions, open, mapping, factor, openMode, baseY],
  );

  return (
    <Modal title={`Importar DXF: ${fileName}`} onCancel={onCancel}>
      <IssueList issues={result.issues} />
      {result.unsupported.length > 0 && (
        <p className="small muted">
          Entidades ignoradas: {result.unsupported.map((u) => `${u.type} (${u.count})`).join(', ')}.
        </p>
      )}
      <label className="ea-field">
        Unidades del dibujo{' '}
        {result.unitsFromHeader ? <span className="muted small">(el archivo declara {result.unitsFromHeader})</span> : <span className="muted small">(el archivo no las declara: confírmelas)</span>}
        <select aria-label="Unidades del dibujo" value={unit} onChange={(e) => setUnit(e.target.value as LengthUnit)}>
          {LENGTH_UNITS.map((u) => (
            <option key={u} value={u}>
              {UNIT_LABEL[u]}
            </option>
          ))}
        </select>
      </label>
      <p className="small muted">El modelo usa {units === 'imperial' ? 'pies' : 'metros'}; las coordenadas se reescalan al importar.</p>

      {layers.length === 0 ? (
        <p role="alert">El DXF no contiene polilíneas cerradas ni abiertas para formar regiones.</p>
      ) : (
        <LayerMapTable
          layers={layers.map((l) => ({
            name: l.name,
            detail: [l.regions > 0 ? `${l.regions} cerrada(s)` : '', l.open > 0 ? `${l.open} abierta(s)` : ''].filter(Boolean).join(', '),
          }))}
          materials={materials}
          mapping={mapping}
          onChange={setMapping}
        />
      )}

      {open.length > 0 && (
        <fieldset className="ea-fieldset">
          <legend>Polilíneas abiertas ({open.length})</legend>
          <label>
            <input type="radio" name={openModeName} checked={openMode === 'close'} onChange={() => setOpenMode('close')} /> Cerrarlas con una base
            horizontal
          </label>
          <label className="ea-inline">
            y =
            <input
              type="text"
              inputMode="decimal"
              aria-label="Valor de y de la base"
              value={baseText}
              disabled={openMode !== 'close'}
              aria-invalid={openMode === 'close' && baseY === null ? true : undefined}
              onChange={(e) => setBaseEdited(e.target.value)}
            />
            <span className="muted small">en unidades del modelo</span>
          </label>
          <label>
            <input type="radio" name={openModeName} checked={openMode === 'discard'} onChange={() => setOpenMode('discard')} /> Descartarlas
          </label>
        </fieldset>
      )}

      <ModeChoice mode={mode} onChange={setMode} />
      <PlanSummary plan={plan} />
      <div className="ea-actions">
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="primary ea-primary" disabled={plan.regions.length === 0} onClick={() => onApply(plan, mode)}>
          Importar
        </button>
      </div>
    </Modal>
  );
}

export interface CsvDialogProps {
  fileName: string;
  result: CsvImportResult;
  materials: readonly Material[];
  units: string | undefined;
  onCancel: () => void;
  onApplyRegions: (plan: RegionImportPlan, mode: 'add' | 'replace') => void;
  onApplyPiezo: (points: Point[]) => void;
}

export function CsvImportDialog({ fileName, result, materials, units, onCancel, onApplyRegions, onApplyPiezo }: CsvDialogProps) {
  const hasLayer = result.rows[0] !== undefined && ('capa' in result.rows[0] || 'layer' in result.rows[0]);
  const [target, setTarget] = useState<'regions' | 'piezo'>(hasLayer ? 'regions' : 'piezo');
  const targetName = useId();
  const regionRead = useMemo(() => csvToRegions(result), [result]);
  const piezoRead = useMemo(() => csvToPoints(result), [result]);
  const layers = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of regionRead.regions) seen.set(r.layer, (seen.get(r.layer) ?? 0) + 1);
    return [...seen].map(([name, n]) => ({ name, detail: `${n} región(es)` }));
  }, [regionRead]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const effective = useMemo(() => {
    const base = defaultMapping(layers.map((l) => ({ name: l.name, suggestedMaterialId: materials.find((m) => m.id.toLowerCase() === l.name.toLowerCase() || m.name.toLowerCase() === l.name.toLowerCase())?.id ?? null })));
    return { ...base, ...mapping };
  }, [layers, materials, mapping]);
  const [mode, setMode] = useState<'add' | 'replace'>('add');
  const plan = useMemo(
    () =>
      planRegionImport(
        { materials: [...materials], units },
        { regions: regionRead.regions, open: [], mapping: effective, factor: 1, openMode: 'discard', baseY: null },
      ),
    [materials, units, regionRead, effective],
  );
  const issues: ImportIssue[] = [...result.issues, ...(target === 'regions' ? regionRead.issues : piezoRead.issues)];
  const piezoOk = piezoRead.points.length >= 2 && !issues.some((i) => i.severity === 'error');
  const regionsOk = plan.regions.length > 0 && !issues.some((i) => i.severity === 'error');

  return (
    <Modal title={`Importar CSV: ${fileName}`} onCancel={onCancel}>
      <p className="small muted">
        Delimitador detectado: «{result.delimiter === '\t' ? 'tabulación' : result.delimiter}». {result.rows.length} fila(s) de datos.
      </p>
      <fieldset className="ea-fieldset">
        <legend>Qué contiene el archivo</legend>
        <label>
          <input type="radio" name={targetName} checked={target === 'regions'} onChange={() => setTarget('regions')} /> Regiones (columnas capa, x, y)
        </label>
        <label>
          <input type="radio" name={targetName} checked={target === 'piezo'} onChange={() => setTarget('piezo')} /> Línea piezométrica (columnas x, y)
        </label>
      </fieldset>
      <IssueList issues={issues} />
      {target === 'regions' ? (
        <>
          {layers.length > 0 && <LayerMapTable layers={layers} materials={materials} mapping={effective} onChange={setMapping} />}
          <ModeChoice mode={mode} onChange={setMode} />
          <PlanSummary plan={plan} />
        </>
      ) : (
        <p className="small" role="status">
          {piezoRead.issues.some((i) => i.severity === 'error') ? (
            <>No se puede importar: corrija el archivo. La piezométrica necesita al menos 2 puntos y x estrictamente creciente.</>
          ) : (
            <>
              Se reemplazará la piezométrica por <strong>{piezoRead.points.length}</strong> punto(s). Debe tener al menos 2 y x estrictamente creciente.
            </>
          )}
        </p>
      )}
      <div className="ea-actions">
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
        {target === 'regions' ? (
          <button type="button" className="primary ea-primary" disabled={!regionsOk} onClick={() => onApplyRegions(plan, mode)}>
            Importar regiones
          </button>
        ) : (
          <button type="button" className="primary ea-primary" disabled={!piezoOk} onClick={() => onApplyPiezo(piezoRead.points)}>
            Importar piezométrica
          </button>
        )}
      </div>
    </Modal>
  );
}
