// Diálogos de importación: DXF (capas → materiales, unidades, polilíneas abiertas) y CSV (regiones o piezométrica).

import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
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
  addModeLabel,
  defaultImportMode,
  freshMapping,
  importDocTitle,
  isFreshImport,
  openBaseHelp,
  openClosureAreas,
  openMinY,
  type ImportBase,
  type LengthUnit,
  type RegionImportPlan,
} from './importPlan';
import { isImperialUnits } from '../state/units';
import { layerChoice } from './layerChoice';
import { restoreFocus } from '../../ui/focusReturn';
import { EXAMPLE_FILES, exampleFileUrl, type ExampleFile } from '../../onboarding/exampleFiles';

/** Elemento que recibe el foco al abrir un `Modal`: el pedido, si sigue conectado; si no, el título. */
export function pickInitialFocus<T extends { isConnected: boolean }>(requested: T | null | undefined, title: T | null | undefined): T | null {
  if (requested?.isConnected) return requested;
  return title ?? null;
}

/**
 * Diálogo modal nativo (`<dialog>` + `showModal()`): el navegador atrapa el foco, deja inerte el resto de la página y cierra
 * con Esc (R7-03). El foco inicial va al título para que se lea antes que las incidencias, salvo que el diálogo pida otro
 * elemento con `initialFocus` (se enfoca justo tras `showModal()`, sin temporizadores); al cerrar, vuelve al botón que lo abrió.
 */
export function Modal({ title, onCancel, children, initialFocus }: {
  title: string;
  onCancel: () => void;
  children: ReactNode;
  /** Elemento que recibe el foco al abrir (por defecto, el título). Su ref ya está asignada cuando corre el efecto del diálogo. */
  initialFocus?: RefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Quien tenía el foco al abrir. Se fija una sola vez, al montar: en desarrollo (StrictMode) el efecto corre dos veces y la segunda el foco
  // ya estaría en el diálogo, de modo que «volver al disparador» devolvería el foco a <body> (u3o_onboarding 11b).
  const [previous] = useState<HTMLElement | null>(() => (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null));
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    pickInitialFocus(initialFocus?.current, titleRef.current)?.focus();
    // Al desmontar, el navegador saca el diálogo de la capa superior y devuelve la inercia al resto de la página;
    // solo falta devolver el foco (`restoreFocus`). No se llama a `close()`: su evento `close` volvería a invocar `onCancel`.
    return () => {
      // Si el disparador ya no se puede enfocar (elemento de un menú cerrado, botón retirado), va al botón del menú o a #main-content:
      // el foco nunca cae en <body> (R9-11c).
      restoreFocus(null, previous, { preventScroll: true });
    };
  }, [previous]);
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

/** Enlace para bajar el archivo de ejemplo del formato que se está importando. */
function ExampleLink({ file }: { file: ExampleFile }) {
  return (
    <p className="small muted" data-testid="example-download">
      ¿No tiene un archivo? <a href={exampleFileUrl(file)} download={file.fileName}>{file.label}</a>.
    </p>
  );
}

/** Rótulo de «Reemplazar»: con el modelo de arranque sin cambios crea un modelo nuevo; en otro caso cambia solo las regiones (CM-W2). */
export function replaceModeLabel(base: ImportBase | undefined): string {
  return base?.pristineStart === true ? 'Reemplazar: crea un modelo nuevo con este archivo' : 'Reemplazar las regiones actuales (se conservan materiales, agua y análisis)';
}

function ModeChoice({ mode, onChange, base }: { mode: 'add' | 'replace'; onChange: (m: 'add' | 'replace') => void; base?: ImportBase }) {
  const name = useId();
  return (
    <fieldset className="ea-fieldset">
      <legend>Destino</legend>
      <label>
        <input type="radio" name={name} checked={mode === 'add'} onChange={() => onChange('add')} /> {addModeLabel(base)}
      </label>
      <label>
        <input type="radio" name={name} checked={mode === 'replace'} onChange={() => onChange('replace')} /> {replaceModeLabel(base)}
      </label>
    </fieldset>
  );
}

function PlanSummary({ plan, freshTitle }: { plan: RegionImportPlan; /** Título del modelo nuevo si «Reemplazar» parte de uno (CM-W2). */ freshTitle?: string }) {
  return (
    <p className="small" role="status">
      Se importarán <strong>{plan.regions.length}</strong> región(es) y se crearán <strong>{plan.newMaterials.length}</strong> material(es)
      nuevo(s)
      {plan.skipped > 0 ? `; ${plan.skipped} elemento(s) omitido(s)` : ''}. {plan.notes.join(' ')}
      {freshTitle !== undefined ? ` Se creará un modelo nuevo titulado «${freshTitle}», sin agua y con búsqueda y análisis nuevos; el ejemplo de arranque se puede recuperar con Ctrl+Z.` : ''}
    </p>
  );
}

const UNIT_LABEL: Record<LengthUnit, string> = { m: 'metros (m)', cm: 'centímetros (cm)', mm: 'milímetros (mm)', ft: 'pies (ft)', in: 'pulgadas (in)' };

export interface DxfDialogProps {
  fileName: string;
  result: DxfParseResult;
  materials: readonly Material[];
  units: string | undefined;
  /** Modelo abierto: decide el destino por defecto y lo nombra. Sin él, «Agregar» y rótulos genéricos. */
  base?: ImportBase;
  onCancel: () => void;
  /** `fresh`: «Reemplazar» sobre el modelo de arranque sin cambios: el documento resultante es un modelo nuevo (CM-W2). */
  onApply: (plan: RegionImportPlan, mode: 'add' | 'replace', fresh: boolean) => void;
}

export function DxfImportDialog({ fileName, result, materials, units, base, onCancel, onApply }: DxfDialogProps) {
  const layers = useMemo(() => importableLayers(result), [result]);
  const open = useMemo(() => openPolylines(result), [result]);
  const [mapping, setMapping] = useState(() => defaultMapping(layers));
  const [unit, setUnit] = useState<LengthUnit>(() => defaultUnit(result.unitsFromHeader, units));
  const [mode, setMode] = useState<'add' | 'replace'>(() => defaultImportMode(base));
  const [openMode, setOpenMode] = useState<'close' | 'discard'>('close');
  const openModeName = useId();
  const factor = unitFactor(unit, units);
  // La base sugerida sigue a la unidad del dibujo mientras el usuario no haya escrito su propio valor (R7-06).
  const [baseEdited, setBaseEdited] = useState<string | null>(null);
  const baseText = baseEdited ?? suggestBaseText(open, unit, units);
  const parsedBase = parseNumber(baseText);
  const baseY = parsedBase.kind === 'ok' ? parsedBase.value : null;
  // CM-W2: «Reemplazar» sobre el modelo de arranque crea un modelo nuevo, sin los materiales del ejemplo: las capas solo pueden crear
  // material (o omitirse) y los ids se calculan sin los del ejemplo.
  const fresh = isFreshImport(mode, base);
  const planMaterials = useMemo(() => (fresh ? [] : [...materials]), [fresh, materials]);
  const planMapping = useMemo(() => (fresh ? freshMapping(mapping) : mapping), [fresh, mapping]);
  const openInput = useMemo(() => open.map((e) => ({ layer: e.layer, points: e.points })), [open]);

  const plan = useMemo(
    () =>
      planRegionImport(
        { materials: planMaterials, units },
        {
          regions: result.regions,
          open: openInput,
          mapping: planMapping,
          factor,
          openMode,
          baseY,
        },
      ),
    [planMaterials, units, result.regions, openInput, planMapping, factor, openMode, baseY],
  );
  const baseHelpId = useId();
  const baseHelp = useMemo(
    () =>
      openBaseHelp({
        minY: openMinY(openInput, unit, units),
        baseY,
        areas: baseY === null ? [] : openClosureAreas(openInput, planMapping, factor, baseY),
        units,
      }),
    [openInput, unit, units, baseY, planMapping, factor],
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
      <p className="small muted">El modelo usa {isImperialUnits(units) ? 'pies' : 'metros'}; las coordenadas se reescalan al importar.</p>

      {layers.length === 0 ? (
        <p role="alert">El DXF no contiene polilíneas cerradas ni abiertas para formar regiones.</p>
      ) : (
        <LayerMapTable
          layers={layers.map((l) => ({
            name: l.name,
            detail: [l.regions > 0 ? `${l.regions} cerrada(s)` : '', l.open > 0 ? `${l.open} abierta(s)` : ''].filter(Boolean).join(', '),
          }))}
          materials={planMaterials}
          mapping={planMapping}
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
              aria-describedby={openMode === 'close' ? baseHelpId : undefined}
              onChange={(e) => setBaseEdited(e.target.value)}
            />
            <span className="muted small">en unidades del modelo</span>
          </label>
          {openMode === 'close' && (
            <p id={baseHelpId} className="small muted" data-testid="open-base-help">
              {baseHelp.join(' ')}
            </p>
          )}
          <label>
            <input type="radio" name={openModeName} checked={openMode === 'discard'} onChange={() => setOpenMode('discard')} /> Descartarlas
          </label>
        </fieldset>
      )}

      <ModeChoice mode={mode} onChange={setMode} base={base} />
      <PlanSummary plan={plan} freshTitle={fresh ? importDocTitle(fileName) : undefined} />
      <ExampleLink file={EXAMPLE_FILES.dxf} />
      <div className="ea-actions">
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="primary ea-primary" disabled={plan.regions.length === 0} onClick={() => onApply(plan, mode, fresh)}>
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
  /** Modelo abierto: decide el destino por defecto y lo nombra. Sin él, «Agregar» y rótulos genéricos. */
  base?: ImportBase;
  onCancel: () => void;
  onApplyRegions: (plan: RegionImportPlan, mode: 'add' | 'replace', fresh: boolean) => void;
  onApplyPiezo: (points: Point[]) => void;
}

export function CsvImportDialog({ fileName, result, materials, units, base, onCancel, onApplyRegions, onApplyPiezo }: CsvDialogProps) {
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
  const [mode, setMode] = useState<'add' | 'replace'>(() => defaultImportMode(base));
  // CM-W2: igual que en el DXF, «Reemplazar» sobre el modelo de arranque crea un modelo nuevo y sus capas solo crean material.
  const fresh = isFreshImport(mode, base);
  const planMaterials = useMemo(() => (fresh ? [] : [...materials]), [fresh, materials]);
  const planMapping = useMemo(() => (fresh ? freshMapping(effective) : effective), [fresh, effective]);
  const plan = useMemo(
    () =>
      planRegionImport(
        { materials: planMaterials, units },
        { regions: regionRead.regions, open: [], mapping: planMapping, factor: 1, openMode: 'discard', baseY: null },
      ),
    [planMaterials, units, regionRead, planMapping],
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
          {layers.length > 0 && <LayerMapTable layers={layers} materials={planMaterials} mapping={planMapping} onChange={setMapping} />}
          <ModeChoice mode={mode} onChange={setMode} base={base} />
          <PlanSummary plan={plan} freshTitle={fresh ? importDocTitle(fileName) : undefined} />
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
      <ExampleLink file={EXAMPLE_FILES.csv} />
      <div className="ea-actions">
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
        {target === 'regions' ? (
          <button type="button" className="primary ea-primary" disabled={!regionsOk} onClick={() => onApplyRegions(plan, mode, fresh)}>
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
