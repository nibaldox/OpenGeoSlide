import { useEffect, useMemo, useRef, useState } from 'react';
import type { Point } from '../../engine/types';
import type { EditorStore, Issue } from '../types';
import { applyCommands } from './dispatch';
import { PanelSection, TextInput } from './Fields';
import { regionMaterialCommand, unitLabels } from './forms';
import {
  GRID_CHOICES,
  coordText,
  nextVertexIndex,
  pageOf,
  pageRange,
  regionIssues,
  regionRemoveCommand,
  regionSummary,
  vertexCoordEdit,
  vertexInsertCommand,
  vertexRemoveCommand,
  type RegionSummary,
} from './geometry';
import { useDraft, useStoreSelector } from './useStoreSelector';
import './geometry.css';

/**
 * Confirmación nativa temporal. El coordinador la cambia por `useConfirm()` (ConfirmDialog de U3-O) al integrar: es el único
 * punto del panel que bloquea, y la acción que protege se puede deshacer con Ctrl+Z.
 */
function confirmRemoval(message: string): boolean {
  return window.confirm(message);
}

const FIELD_PATH = (regionIndex: number, vertexIndex: number, axis: 'x' | 'y'): string => `/regions/${regionIndex}/polygon/${vertexIndex}/${axis}`;

function VertexRow({ store, regionIndex, vertexIndex, point, count, selected, onFocusRow }: {
  store: EditorStore;
  regionIndex: number;
  vertexIndex: number;
  point: Point;
  count: number;
  selected: boolean;
  onFocusRow: () => void;
}) {
  const [form, setForm, reset] = useDraft(() => ({ x: coordText(point[0]), y: coordText(point[1]) }), [point[0], point[1]]);
  const [committed, setCommitted] = useState(false);
  const doc = () => store.getState().doc;
  const errorOf = (axis: 'x' | 'y'): string | null => {
    const r = vertexCoordEdit(doc(), { regionIndex, vertexIndex }, axis, form[axis]);
    return r.ok ? null : r.error;
  };
  const errX = errorOf('x');
  const errY = errorOf('y');
  const error = errX ?? errY;

  const commit = (axis: 'x' | 'y'): void => {
    setCommitted(true);
    const r = vertexCoordEdit(doc(), { regionIndex, vertexIndex }, axis, form[axis]);
    if (r.ok) applyCommands(store, 'Editar coordenadas del vértice', r.commands);
  };
  const n = vertexIndex + 1;
  const removeCmd = vertexRemoveCommand(doc(), regionIndex, vertexIndex);
  const errId = `gp-err-${regionIndex}-${vertexIndex}`;

  const focusField = (axis: 'x' | 'y', vi: number): void => {
    // Tras el cambio de la tabla, el foco va al campo indicado (cuando React ya lo pintó).
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-path="${FIELD_PATH(regionIndex, vi, axis)}"]`)?.focus(), 0);
  };

  return (
    <>
      <tr className={selected ? 'ep-row-selected' : undefined} aria-current={selected ? 'true' : undefined} data-vertex-row={vertexIndex}>
        <td>{n}</td>
        {(['x', 'y'] as const).map((axis) => (
          <td key={axis}>
            <TextInput
              value={form[axis]}
              ariaLabel={`Región ${regionIndex + 1}, vértice ${n}: ${axis}`}
              path={FIELD_PATH(regionIndex, vertexIndex, axis)}
              invalid={(axis === 'x' ? errX : errY) !== null}
              describedBy={error ? errId : undefined}
              onChange={(v) => {
                setCommitted(false);
                setForm({ ...form, [axis]: v });
              }}
              onCommit={() => commit(axis)}
              onReset={reset}
              onFocus={onFocusRow}
            />
          </td>
        ))}
        <td className="gp-row-actions">
          <button
            type="button"
            aria-label={`Agregar después del vértice ${n} de la región ${regionIndex + 1}`}
            title="Agrega un vértice en el punto medio de la arista siguiente"
            onClick={() => {
              const cmd = vertexInsertCommand(doc(), regionIndex, vertexIndex);
              if (!cmd) return;
              store.dispatch(cmd);
              store.dispatch({ type: 'ui/select', selection: { kind: 'vertex', regionIndex, vertexIndex: vertexIndex + 1 } });
              focusField('x', vertexIndex + 1);
            }}
          >
            Agregar después
          </button>
          <button
            type="button"
            disabled={removeCmd === null}
            aria-label={`Eliminar el vértice ${n} de la región ${regionIndex + 1}`}
            title={removeCmd === null ? 'Una región necesita al menos 3 vértices' : 'Eliminar vértice'}
            onClick={() => {
              if (!removeCmd) return;
              const target = nextVertexIndex(count, vertexIndex);
              store.dispatch(removeCmd);
              store.dispatch({ type: 'ui/select', selection: { kind: 'vertex', regionIndex, vertexIndex: target } });
              focusField('x', target);
            }}
          >
            Eliminar
          </button>
        </td>
      </tr>
      {error ? (
        <tr className="gp-error-row">
          <td />
          <td colSpan={3}>
            <span id={errId} className="ep-error" role={committed ? 'alert' : undefined}>
              {error}
            </span>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function IssueList({ issues }: { issues: readonly Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="ep-error-list gp-issues" aria-label="Incidencias de esta región">
      {issues.map((i, k) => (
        <li key={`${i.code}-${k}`} className={i.severity === 'error' ? undefined : 'gp-issue-warn'}>
          <strong>{i.severity === 'error' ? 'Error' : 'Aviso'}:</strong> {i.text}
        </li>
      ))}
    </ul>
  );
}

function RegionCard({ store, summary, selected, units }: { store: EditorStore; summary: RegionSummary; selected: boolean; units: string | undefined }) {
  const materials = useStoreSelector(store, (s) => s.doc.materials);
  const u = unitLabels(units).length;
  const n = summary.index + 1;
  const remove = (): void => {
    const cmd = regionRemoveCommand(store.getState().doc, summary.index);
    if (!cmd) return;
    const ok = confirmRemoval(`¿Eliminar la región ${n} (${summary.materialName}, ${summary.vertexCount} vértices)? Se puede deshacer con Ctrl+Z.`);
    if (ok) store.dispatch(cmd);
  };
  return (
    <li className={selected ? 'gp-region ep-row-selected' : 'gp-region'} data-region-card={summary.index}>
      <div className="gp-region-head">
        <strong>Región {n}</strong>
        <span className="muted small">
          {summary.vertexCount} vértices · área {coordText(Number(summary.area.toPrecision(6)))} {u}²
        </span>
      </div>
      <label className="field ep-field">
        <span>Material de la región {n}</span>
        <select
          value={summary.materialId}
          data-path={`/regions/${summary.index}/material`}
          onChange={(e) => store.dispatch(regionMaterialCommand(summary.index, e.target.value))}
        >
          {summary.known ? null : <option value={summary.materialId}>{summary.materialId} (no existe)</option>}
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name === m.id ? m.id : `${m.name} (${m.id})`}
            </option>
          ))}
        </select>
      </label>
      <div className="ep-actions">
        <button
          type="button"
          aria-label={`Seleccionar en el lienzo: región ${n}`}
          onClick={() => store.dispatch({ type: 'ui/select', selection: { kind: 'region', regionIndex: summary.index } })}
        >
          Seleccionar en el lienzo
        </button>
        <button type="button" aria-label={`Eliminar región ${n}`} onClick={remove}>
          Eliminar región
        </button>
      </div>
    </li>
  );
}

function SnapControls({ store, units }: { store: EditorStore; units: string | undefined }) {
  const snap = useStoreSelector(store, (s) => s.ui.snap);
  const u = unitLabels(units).length;
  return (
    <fieldset className="ep-card gp-snap">
      <legend>Ajuste al dibujar y mover</legend>
      <label className="field ep-field">
        <span>Rejilla de ajuste</span>
        <select
          value={snap.gridStep === null ? '' : String(snap.gridStep)}
          onChange={(e) => store.dispatch({ type: 'ui/snap', patch: { gridStep: e.target.value === '' ? null : Number(e.target.value) } })}
        >
          {GRID_CHOICES.map((g) => (
            <option key={String(g)} value={g === null ? '' : String(g)}>
              {g === null ? 'Sin rejilla' : `${coordText(g)} ${u}`}
            </option>
          ))}
        </select>
      </label>
      <label className="gp-check">
        <input type="checkbox" checked={snap.vertex} onChange={(e) => store.dispatch({ type: 'ui/snap', patch: { vertex: e.target.checked } })} />
        Ajustar a los vértices existentes
      </label>
      <label className="gp-check">
        <input type="checkbox" checked={snap.axis} onChange={(e) => store.dispatch({ type: 'ui/snap', patch: { axis: e.target.checked } })} />
        Alinear en horizontal y vertical con los vecinos
      </label>
    </fieldset>
  );
}

function VertexTable({ store, regionIndex, units }: { store: EditorStore; regionIndex: number; units: string | undefined }) {
  const polygon = useStoreSelector(store, (s) => s.doc.regions[regionIndex]?.polygon);
  const selection = useStoreSelector(store, (s) => s.ui.selection);
  const doc = useStoreSelector(store, (s) => s.doc);
  const u = unitLabels(units).length;
  const count = polygon?.length ?? 0;
  const [page, setPage] = useState(0);
  const selectedVertex = selection.kind === 'vertex' && selection.regionIndex === regionIndex ? selection.vertexIndex : null;
  const rootRef = useRef<HTMLDivElement>(null);

  // Un vértice elegido en el lienzo lleva a su página y a su fila.
  useEffect(() => {
    if (selectedVertex === null) return;
    setPage(pageOf(count, selectedVertex));
    window.setTimeout(() => rootRef.current?.querySelector(`[data-vertex-row="${selectedVertex}"]`)?.scrollIntoView({ block: 'nearest' }), 0);
  }, [selectedVertex, count]);

  const issues = useMemo(() => regionIssues(doc, regionIndex), [doc, regionIndex]);
  if (!polygon) return null;
  const range = pageRange(count, page);

  return (
    <div ref={rootRef} className="gp-vertices">
      <h3 id="gp-vertices-title">Vértices de la región {regionIndex + 1}</h3>
      <p className="muted small">
        Escriba x e y y confirme con Intro. Un vértice compartido con otra región se mueve junto con él. Mínimo 3 vértices por región.
      </p>
      <IssueList issues={issues} />
      <div className="ep-table-wrap" role="region" aria-label={`Vértices de la región ${regionIndex + 1}`} tabIndex={0}>
        <table className="ep-table" aria-labelledby="gp-vertices-title">
          <thead>
            <tr>
              <th scope="col">N.º</th>
              <th scope="col">x ({u})</th>
              <th scope="col">y ({u})</th>
              <th scope="col">
                <span className="visually-hidden">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {polygon.slice(range.start, range.end).map((p, k) => {
              const vi = range.start + k;
              return (
                <VertexRow
                  key={vi}
                  store={store}
                  regionIndex={regionIndex}
                  vertexIndex={vi}
                  point={p}
                  count={count}
                  selected={selectedVertex === vi}
                  onFocusRow={() => store.dispatch({ type: 'ui/select', selection: { kind: 'vertex', regionIndex, vertexIndex: vi } })}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {range.pages > 1 ? (
        <nav className="gp-pager" aria-label="Páginas de la tabla de vértices">
          <button type="button" onClick={() => setPage(range.page - 1)} disabled={range.page === 0}>
            Anterior
          </button>
          <span className="small" aria-live="polite">
            Vértices {range.start + 1} a {range.end} de {count} (página {range.page + 1} de {range.pages})
          </span>
          <button type="button" onClick={() => setPage(range.page + 1)} disabled={range.page >= range.pages - 1}>
            Siguiente
          </button>
        </nav>
      ) : null}
    </div>
  );
}

export function GeometryPanel({ store }: { store: EditorStore }) {
  const doc = useStoreSelector(store, (s) => s.doc);
  const selection = useStoreSelector(store, (s) => s.ui.selection);
  const summaries = useMemo(() => regionSummary(doc), [doc]);
  const [lastRegion, setLastRegion] = useState(0);

  const selectedRegion = selection.kind === 'region' || selection.kind === 'vertex' ? selection.regionIndex : null;
  useEffect(() => {
    if (selectedRegion !== null) setLastRegion(selectedRegion);
  }, [selectedRegion]);
  const active = summaries.length === 0 ? null : Math.min(selectedRegion ?? lastRegion, summaries.length - 1);

  return (
    <PanelSection title="Geometría">
      {summaries.length === 0 ? (
        <p className="muted" data-testid="geometry-empty">
          El modelo no tiene regiones. Dibuje una con «Dibujar región», cree un «Talud simple…» desde Archivo ▸ Nuevo, o importe un DXF o un CSV.
        </p>
      ) : (
        <>
          <p className="muted small">
            Para crear otra región use la herramienta «Dibujar región» (tecla R) de la barra del lienzo. Aquí se asigna el material de cada
            región y se editan sus vértices.
          </p>
          <ul className="gp-regions" aria-label="Regiones del modelo">
          {summaries.map((s) => (
            <RegionCard key={s.index} store={store} summary={s} selected={active === s.index} units={doc.units} />
          ))}
          </ul>
        </>
      )}
      {active !== null ? <VertexTable key={active} store={store} regionIndex={active} units={doc.units} /> : null}
      <SnapControls store={store} units={doc.units} />
    </PanelSection>
  );
}
