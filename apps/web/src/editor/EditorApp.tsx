// Aplicación del editor: lienzo, paneles, diagnósticos y barra de acciones (abrir, guardar, importar, calcular, informe).
// Parte del documento y llega al informe PDF. Toda la lógica no visual vive en `app/` (con pruebas en Node).

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ComponentType } from 'react';
import { loadBuiltinCases } from '../cases';
import type { EngineClient } from '../engine/client';
import type { MethodKind } from '../engine/types';
import { clearDraft, loadDraft, resolveDraftStorage, type Draft } from '../io/draft';
import { parseCsv } from '../io/csv';
import { parseDxf, type DxfParseResult } from '../io/dxf';
import { openOgsJson, saveOgsJson, sha256Hex } from '../io/ogsJson';
import type { CsvImportResult } from '../io/types';
import { buildReportPdf } from '../report/pdf';
import { ResultsTable } from '../ui/ResultsTable';
import { EditorCanvas } from './canvas/EditorCanvas';
import { applyPiezoImport, applyRegionImport } from './app/applyImport';
import { downloadBlob, downloadText } from './app/download';
import { docFromCase, newDoc } from './app/docTemplates';
import { CsvImportDialog, DxfImportDialog } from './app/ImportDialogs';
import type { RegionImportPlan } from './app/importPlan';
import { baseFileName, buildReportInput, exportAvailability, hasExportableSurface, resultsCsv, surfaceCoordsCsv } from './app/reportInput';
import { isEditableTag, shortcutFor, type ShortcutAction } from './app/shortcuts';
import { useDraftAutosave } from './app/useDraftAutosave';
import { useEngineCheck } from './app/useEngineCheck';
import {
  AnalysisPanel,
  DiagnosticsPanel,
  LoadsPanel,
  MaterialsPanel,
  SearchPanel,
  SeismicPanel,
  SurfacePanel,
  WaterPanel,
} from './panels';
import { createEditorStore, useEditorStore, type EditorStoreWithSave } from './state';
import type { EditorStore, ModelDoc, Tool } from './types';

interface Notice {
  id: number;
  kind: 'info' | 'aviso' | 'error';
  text: string;
}

interface TabDef {
  id: string;
  label: string;
  Panel: ComponentType<{ store: EditorStore }>;
}

const TABS: TabDef[] = [
  { id: 'materials', label: 'Materiales', Panel: MaterialsPanel },
  { id: 'water', label: 'Agua', Panel: WaterPanel },
  { id: 'surface', label: 'Superficie', Panel: SurfacePanel },
  { id: 'search', label: 'Búsqueda', Panel: SearchPanel },
  { id: 'analysis', label: 'Análisis', Panel: AnalysisPanel },
  { id: 'loads', label: 'Cargas', Panel: LoadsPanel },
  { id: 'seismic', label: 'Sismo', Panel: SeismicPanel },
];

const TOOLS: { tool: Tool; label: string; key: string }[] = [
  { tool: 'select', label: 'Seleccionar', key: 'V' },
  { tool: 'add_vertex', label: 'Agregar vértice', key: 'A' },
  { tool: 'pan', label: 'Mover vista', key: 'H' },
];

/** Modelo de partida: ACADS 1(a) (V047a) si está entre los casos publicados; si no, el primero. */
function initialDoc(): { doc: ModelDoc; name: string } {
  const cases = loadBuiltinCases();
  const chosen = cases.find((c) => c.caseData.id === 'V047a') ?? cases[0];
  const opened = chosen ? docFromCase(chosen.caseData) : null;
  return opened ? { doc: opened.doc, name: chosen!.caseData.id } : { doc: newDoc(), name: 'nuevo' };
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('es');
}

export function EditorApp({ client }: { client: EngineClient }) {
  const [store] = useState<EditorStoreWithSave>(() => createEditorStore(initialDoc().doc, null));
  const cases = useMemo(() => loadBuiltinCases(), []);
  const draftStorage = useMemo(() => resolveDraftStorage(), []);
  // El borrador se lee una sola vez (un borrador corrupto se elimina al leerlo y solo se avisa esa vez).
  const [boot] = useState(() => loadDraft(draftStorage.storage));
  const [draft, setDraft] = useState<Draft | null>(boot.draft);
  const [notices, setNotices] = useState<Notice[]>(() => {
    const first: Notice[] = boot.issues.map((i, k) => ({ id: k + 1, kind: 'aviso' as const, text: i.text }));
    if (draftStorage.issue) first.push({ id: first.length + 1, kind: 'aviso', text: draftStorage.issue.text });
    return first;
  });
  const noticeId = useRef(100);
  const [tab, setTab] = useState<string>('materials');
  const [dxf, setDxf] = useState<{ fileName: string; result: DxfParseResult } | null>(null);
  const [csv, setCsv] = useState<{ fileName: string; result: CsvImportResult } | null>(null);
  const [shownMethod, setShownMethod] = useState<MethodKind | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const openRef = useRef<HTMLInputElement>(null);
  const dxfRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const engine = useEngineCheck(store, client);
  const draftFailure = useDraftAutosave(store, draftStorage.storage, draft === null);

  const doc = useEditorStore(store, (s) => s.doc);
  const fileName = useEditorStore(store, (s) => s.file.name);
  const dirty = useEditorStore(store, (s) => s.revision !== s.file.savedRevision);
  const tool = useEditorStore(store, (s) => s.ui.tool);
  const canUndo = useEditorStore(store, (s) => s.history.past.length > 0);
  const canRedo = useEditorStore(store, (s) => s.history.future.length > 0);

  const notify = useCallback((kind: Notice['kind'], text: string) => {
    noticeId.current += 1;
    const id = noticeId.current;
    setNotices((prev) => [...prev.slice(-4), { id, kind, text }]);
  }, []);
  const dismiss = (id: number): void => setNotices((prev) => prev.filter((n) => n.id !== id));

  // ───────── Documento: nuevo, abrir, guardar ─────────

  const confirmDiscard = useCallback((): boolean => {
    const s = store.getState();
    return s.revision === s.file.savedRevision || window.confirm('Hay cambios sin guardar. ¿Descartarlos?');
  }, [store]);

  const replaceDoc = useCallback(
    (next: ModelDoc, name: string | null) => {
      store.dispatch({ type: 'doc/replace', doc: next, fileName: name });
      store.markSaved(name);
      store.dispatch({ type: 'ui/viewport', viewport: null });
      setShownMethod(null);
    },
    [store],
  );

  const onNew = useCallback(() => {
    if (!confirmDiscard()) return;
    replaceDoc(newDoc(), null);
    notify('info', 'Modelo nuevo creado.');
  }, [confirmDiscard, replaceDoc, notify]);

  const onOpenFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const opened = openOgsJson(await file.text());
      for (const i of opened.issues) notify(i.severity === 'error' ? 'error' : 'aviso', `${file.name}: ${i.text}`);
      if (!opened.doc) return;
      if (!confirmDiscard()) return;
      replaceDoc(opened.doc, file.name);
      notify('info', `Abierto «${file.name}».`);
    } catch (err) {
      notify('error', `No se pudo abrir «${file.name}»: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const onSave = useCallback(async () => {
    try {
      const s = store.getState();
      const text = saveOgsJson(s.doc);
      const name = s.file.name ?? `${baseFileName(null, s.doc)}.ogs.json`;
      const finalName = /\.ogs\.json$/i.test(name) ? name : `${baseFileName(name, s.doc)}.ogs.json`;
      downloadText(text, finalName, 'application/json');
      store.markSaved(finalName);
      clearDraft(draftStorage.storage);
      const sha = await sha256Hex(text);
      notify('info', `Guardado «${finalName}». SHA-256: ${sha}`);
    } catch (err) {
      notify('error', `No se pudo guardar: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [store, draftStorage, notify]);

  const onCase = (key: string): void => {
    const entry = cases.find((c) => c.key === key);
    if (!entry || !confirmDiscard()) return;
    const opened = docFromCase(entry.caseData);
    if (!opened) {
      notify('error', `No se pudo abrir el caso ${entry.caseData.id}.`);
      return;
    }
    replaceDoc(opened.doc, null);
    notify('info', `Caso ${entry.caseData.id} abierto como modelo (se descartan sus comprobaciones publicadas).`);
  };

  // ───────── Importar y exportar ─────────

  const onDxfFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const s = store.getState();
    const result = parseDxf(await file.text(), { materials: s.doc.materials.map((m) => ({ id: m.id, name: m.name })) });
    if (!result.ok) {
      notify('error', `${file.name}: ${result.issues.filter((i) => i.severity === 'error').map((i) => i.text).join(' ') || 'No se pudo leer el DXF.'}`);
      return;
    }
    setDxf({ fileName: file.name, result });
  };

  const onCsvFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCsv({ fileName: file.name, result: parseCsv(await file.text()) });
  };

  const applyRegions = (plan: RegionImportPlan, mode: 'add' | 'replace', source: string): void => {
    applyRegionImport(store, plan, mode);
    setDxf(null);
    setCsv(null);
    notify(
      'info',
      `${source}: ${plan.regions.length} región(es) importada(s) (${mode === 'add' ? 'agregadas' : 'reemplazan a las anteriores'}). Se deshace con Ctrl+Z.`,
    );
  };

  // Solo se exporta el resultado de la revisión actual: tras editar, hay que volver a pulsar «Comprobar» (E12i).
  const { canExport, canExportSurface, blockedTitle: exportBlockedTitle, surfaceTitle: exportSurfaceTitle } = exportAvailability(engine.run, engine.current);

  const exportResults = (): void => {
    if (!engine.run || !engine.current) return;
    downloadText(resultsCsv(engine.run.report), `${baseFileName(fileName, doc)}-resultados.csv`, 'text/csv;charset=utf-8');
  };
  const exportSurface = (): void => {
    if (!engine.run || !engine.current || !hasExportableSurface(engine.run.report.results)) return;
    downloadText(surfaceCoordsCsv(engine.run.report.results), `${baseFileName(fileName, doc)}-superficie.csv`, 'text/csv;charset=utf-8');
  };

  const onReport = async (): Promise<void> => {
    if (reportBusy) return;
    if (!engine.run || !engine.current) {
      notify('aviso', 'El informe necesita un cálculo del modelo actual. Pulse «Comprobar» y después «Informe PDF».');
      return;
    }
    setReportBusy(true);
    try {
      const blob = await buildReportPdf(buildReportInput(engine.run));
      downloadBlob(blob, `${baseFileName(fileName, doc)}-informe.pdf`);
      notify('info', `Informe PDF generado (${Math.round(blob.size / 1024)} kB).`);
    } catch (err) {
      notify('error', `No se pudo generar el informe: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setReportBusy(false);
    }
  };

  const onCheck = useCallback(async () => {
    const run = await engine.check();
    if (run) setShownMethod((m) => (m && run.report.results.some((r) => r.method === m) ? m : (run.report.results[0]?.method ?? null)));
  }, [engine]);

  // ───────── Borrador ─────────

  const recoverDraft = (): void => {
    if (!draft) return;
    // Lo recuperado sigue siendo trabajo sin guardar en archivo: no se marca como guardado y el borrador se conserva.
    store.dispatch({ type: 'doc/replace', doc: draft.doc, fileName: draft.fileName });
    store.dispatch({ type: 'ui/viewport', viewport: null });
    setShownMethod(null);
    setDraft(null);
    notify('info', `Borrador recuperado (${formatWhen(draft.savedAt)}).`);
  };
  const discardDraft = (): void => {
    clearDraft(draftStorage.storage);
    setDraft(null);
    notify('info', 'Borrador descartado.');
  };

  // ───────── Atajos globales ─────────

  const actions = useRef<Record<ShortcutAction, () => void>>({} as Record<ShortcutAction, () => void>);
  actions.current = {
    undo: () => store.undo(),
    redo: () => store.redo(),
    save: () => void onSave(),
    open: () => openRef.current?.click(),
    check: () => void onCheck(),
    'tool:select': () => store.dispatch({ type: 'ui/tool', tool: 'select' }),
    'tool:add_vertex': () => store.dispatch({ type: 'ui/tool', tool: 'add_vertex' }),
    'tool:pan': () => store.dispatch({ type: 'ui/tool', tool: 'pan' }),
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (dxf || csv) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      const action = shortcutFor({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        defaultPrevented: e.defaultPrevented,
        inField: isEditableTag(t?.tagName, t?.isContentEditable ?? false),
      });
      if (!action) return;
      e.preventDefault();
      actions.current[action]();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dxf, csv]);

  // ───────── Presentación ─────────

  const shown = engine.run?.report.results.find((r) => r.method === shownMethod) ?? engine.run?.report.results[0] ?? null;
  const canvasResult = engine.current && shown && shown.slices.length > 0 ? { surface: shown.surface, slices: shown.slices } : undefined;
  const ActivePanel = (TABS.find((t) => t.id === tab) ?? TABS[0]!).Panel;

  return (
    <div className="editor-app" lang="es" data-testid="editor-app">
      <div className="ea-toolbar panel" role="toolbar" aria-label="Acciones del modelo">
        <div className="ea-group" role="group" aria-label="Archivo">
          <button type="button" onClick={onNew}>
            Nuevo
          </button>
          <button type="button" onClick={() => openRef.current?.click()} title="Ctrl+O">
            Abrir
          </button>
          <button type="button" onClick={() => void onSave()} title="Ctrl+S">
            Guardar
          </button>
          <label className="ea-select">
            <span className="visually-hidden">Abrir un caso publicado como modelo</span>
            <select aria-label="Abrir un caso publicado como modelo" value="" onChange={(e) => onCase(e.target.value)}>
              <option value="">Ejemplos…</option>
              {cases.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ea-group" role="group" aria-label="Importar y exportar">
          <button type="button" onClick={() => dxfRef.current?.click()}>
            Importar DXF
          </button>
          <button type="button" onClick={() => csvRef.current?.click()}>
            Importar CSV
          </button>
          <button type="button" onClick={exportResults} disabled={!canExport} title={exportBlockedTitle}>
            Exportar resultados (CSV)
          </button>
          <button type="button" onClick={exportSurface} disabled={!canExportSurface} title={exportSurfaceTitle}>
            Exportar superficie (CSV)
          </button>
        </div>
        <div className="ea-group" role="group" aria-label="Edición">
          <button type="button" onClick={() => store.undo()} disabled={!canUndo} title="Ctrl+Z">
            Deshacer
          </button>
          <button type="button" onClick={() => store.redo()} disabled={!canRedo} title="Ctrl+Mayús+Z o Ctrl+Y">
            Rehacer
          </button>
        </div>
        <div className="ea-group" role="group" aria-label="Herramienta del lienzo">
          {TOOLS.map((t) => (
            <button
              key={t.tool}
              type="button"
              aria-pressed={tool === t.tool}
              className={tool === t.tool ? 'ea-tool ea-tool-active' : 'ea-tool'}
              onClick={() => store.dispatch({ type: 'ui/tool', tool: t.tool })}
              title={`Tecla ${t.key}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ea-group ea-group-main" role="group" aria-label="Cálculo">
          <button type="button" className="primary ea-primary" onClick={() => void onCheck()} disabled={engine.busy} title="Ctrl+Intro">
            {engine.busy ? 'Calculando…' : 'Comprobar'}
          </button>
          <button type="button" onClick={() => void onReport()} disabled={reportBusy || engine.busy || !canExport} title={exportBlockedTitle}>
            {reportBusy ? 'Generando…' : 'Informe PDF'}
          </button>
        </div>
        <input ref={openRef} type="file" accept=".json,.ogs.json,application/json" hidden data-testid="file-open" onChange={(e) => void onOpenFile(e)} />
        <input ref={dxfRef} type="file" accept=".dxf" hidden data-testid="file-dxf" onChange={(e) => void onDxfFile(e)} />
        <input ref={csvRef} type="file" accept=".csv,text/csv" hidden data-testid="file-csv" onChange={(e) => void onCsvFile(e)} />
      </div>

      <p className="ea-status small" aria-live="polite" data-testid="file-status">
        <strong>{fileName ?? 'Sin título'}</strong> {dirty ? '· con cambios sin guardar' : '· sin cambios pendientes'}
        {engine.busy ? ' · calculando…' : ''}
      </p>

      {draft && (
        <div className="banner ea-draft" role="alert" data-testid="draft-banner">
          <span>
            Hay un borrador guardado el {formatWhen(draft.savedAt)} ({draft.fileName ?? 'sin nombre'}).
          </span>
          <button type="button" onClick={recoverDraft}>
            Recuperar
          </button>
          <button type="button" onClick={discardDraft}>
            Descartar
          </button>
        </div>
      )}
      {draftFailure && (
        <div className="banner banner-sim" role="status">
          {draftFailure}
        </div>
      )}
      {engine.message && (
        <div className="banner banner-error" role="alert">
          {engine.message}
        </div>
      )}
      {notices.length > 0 && (
        <ul className="ea-notices" aria-label="Mensajes" data-testid="notices">
          {notices.map((n) => (
            <li key={n.id} className={`ea-notice ea-notice-${n.kind}`} role={n.kind === 'error' ? 'alert' : 'status'}>
              <span>{n.text}</span>
              <button type="button" className="link-button" onClick={() => dismiss(n.id)} aria-label="Cerrar mensaje">
                Cerrar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="ea-layout">
        <div className="ea-main">
          <section className="panel ea-canvas-panel" aria-label="Sección del modelo">
            <div className="ea-canvas" data-testid="editor-canvas">
              <EditorCanvas store={store} result={canvasResult} />
            </div>
            {engine.run && !engine.current && (
              <p className="small ea-stale" role="status" data-testid="stale-result">
                El resultado mostrado es de una versión anterior del modelo. Pulse «Comprobar» para actualizarlo.
              </p>
            )}
            {canvasResult && (
              <p className="small muted" data-testid="result-caption">
                Superficie crítica en rojo y dovelas en gris ({shown?.method === 'spencer' ? 'Spencer' : 'Bishop simplificado'}).
              </p>
            )}
          </section>

          {engine.run && (
            <section className="panel" aria-labelledby="ea-results-title" data-testid="results-panel">
              <h2 id="ea-results-title">Resultados{engine.current ? '' : ' (desactualizados)'}</h2>
              <ResultsTable report={engine.run.report} elapsedMs={engine.run.elapsedMs} shownMethod={shownMethod ?? shown?.method ?? null} onShowMethod={setShownMethod} />
              <p className="small muted">
                Motor: {engine.run.report.engine} · SHA-256 del modelo calculado: <code>{engine.run.sha256.slice(0, 16)}…</code>
              </p>
            </section>
          )}
          <DiagnosticsPanel store={store} onCheck={() => void onCheck()} />
        </div>

        <aside className="ea-side" aria-label="Propiedades del modelo">
          <div className="ea-tabs" role="tablist" aria-label="Paneles del modelo">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`ea-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="ea-tabpanel"
                className={tab === t.id ? 'ea-tab ea-tab-active' : 'ea-tab'}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div id="ea-tabpanel" role="tabpanel" aria-labelledby={`ea-tab-${tab}`}>
            <ActivePanel store={store} />
          </div>
        </aside>
      </div>

      {dxf && (
        <DxfImportDialog
          fileName={dxf.fileName}
          result={dxf.result}
          materials={doc.materials}
          units={doc.units}
          onCancel={() => setDxf(null)}
          onApply={(plan, mode) => applyRegions(plan, mode, dxf.fileName)}
        />
      )}
      {csv && (
        <CsvImportDialog
          fileName={csv.fileName}
          result={csv.result}
          materials={doc.materials}
          units={doc.units}
          onCancel={() => setCsv(null)}
          onApplyRegions={(plan, mode) => applyRegions(plan, mode, csv.fileName)}
          onApplyPiezo={(points) => {
            applyPiezoImport(store, points);
            notify('info', `${csv.fileName}: piezométrica importada (${points.length} puntos). Se deshace con Ctrl+Z.`);
            setCsv(null);
          }}
        />
      )}
    </div>
  );
}
