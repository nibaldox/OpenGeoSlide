// Aplicación del editor: lienzo, paneles, diagnósticos y barra de acciones (abrir, guardar, importar, calcular, informe).
// Parte del documento y llega al informe PDF. Toda la lógica no visual vive en `app/` (con pruebas en Node).

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type ComponentType } from 'react';
import { loadBuiltinCases } from '../cases';
import type { EngineClient } from '../engine/client';
import type { MethodKind } from '../engine/types';
import { loadDraftChain, type Draft } from '../io/draft';
import { parseCsv } from '../io/csv';
import { parseDxf, type DxfParseResult } from '../io/dxf';
import { saveOgsJson, sha256Hex } from '../io/ogsJson';
import type { CsvImportResult } from '../io/types';
import { buildReportPdf } from '../report/pdf';
import './app/editor-app.css';
import './app/newModel.css';
import { buildScene } from '../render/scene';
import { useConfirm } from '../ui/ConfirmDialog';
import { DropdownMenu } from '../ui/DropdownMenu';
import { Legend } from '../ui/Legend';
import { ResultsTable } from '../ui/ResultsTable';
import { useRovingTabIndex } from '../ui/useRovingTabIndex';
import { EditorCanvas } from './canvas/EditorCanvas';
import { piezoExtension } from './canvas/piezoExtension';
import { lengthUnitOf } from './canvas/layout';
import { isImperialUnits } from './state/units';
import { applyPiezoImport, applyRegionImport } from './app/applyImport';
import { downloadBlob, downloadText } from './app/download';
import { createConfirmDiscard, createToolSwitch, runIfDiscarded } from './app/discard';
import { visibleExportHint } from './app/exportHint';
import { editMenuLabel } from './app/editMenuLabel';
import { useNarrow } from './app/useNarrow';
import { docFromCase, newDoc } from './app/docTemplates';
import { EmptyCanvasState } from './app/EmptyCanvasState';
import { NewSlopeDialog } from './app/NewSlopeDialog';
import { emptyModel, simpleSlope, type SlopeInput } from './app/newModel';
import { CsvImportDialog, DxfImportDialog } from './app/ImportDialogs';
import type { RegionImportPlan } from './app/importPlan';
import type { PanelTabId } from './app/issueNav';
import { documentTitle } from './app/docTitle';
import { fieldSelector, findIssueFocus, type IssueTarget } from './app/issueNav';
import { LiveRegions } from './app/LiveRegions';
import { NoticeList } from './app/NoticeList';
import { addNotice, noticeLifetimeMs, type Notice } from './app/notices';
import { ResultSummary } from './app/ResultSummary';
import { calcAnnouncement } from './app/resultSummary';
import { useAnnouncer } from './app/useAnnouncer';
import { checkButtonState } from './app/engineCheck';
import { readOpenFile, readTextFile } from './app/openFile';
import { baseFileName, buildReportInput, exportAvailability, hasExportableSurface, resultCaption, resultsCsv, surfaceCoordsCsv } from './app/reportInput';
import { createSingleFlight } from './app/singleFlight';
import { isEditableTag, shortcutFor, type ShortcutAction } from './app/shortcuts';
import { OPEN_ELSEWHERE_TEXT } from './app/draftTabs';
import { SAME_DRAFT_TEXT, clearOwnDraft, discardOfferedDraft, offeredDraftEntry, resolveTabDraftStorage, shouldWarnBeforeUnload, useDraftAutosave, useDraftOpenElsewhere, useSameDraftWarning, useUnloadGuard } from './app/useDraftAutosave';
import { useEngineCheck } from './app/useEngineCheck';
import {
  AnalysisPanel,
  DiagnosticsPanel,
  GeometryPanel,
  LoadsPanel,
  MaterialsPanel,
  ProjectPanel,
  SearchPanel,
  SeismicPanel,
  SurfacePanel,
  WaterPanel,
} from './panels';
import { createEditorStore, useEditorStore, type EditorStoreWithSave } from './state';
import type { EditorStore, ModelDoc, Tool } from './types';

interface TabDef {
  id: PanelTabId;
  label: string;
  Panel: ComponentType<{ store: EditorStore }>;
}

const TABS: TabDef[] = [
  { id: 'geometry', label: 'Geometría', Panel: GeometryPanel },
  { id: 'materials', label: 'Materiales', Panel: MaterialsPanel },
  { id: 'water', label: 'Agua', Panel: WaterPanel },
  { id: 'surface', label: 'Superficie', Panel: SurfacePanel },
  { id: 'search', label: 'Búsqueda', Panel: SearchPanel },
  { id: 'analysis', label: 'Análisis', Panel: AnalysisPanel },
  { id: 'loads', label: 'Cargas', Panel: LoadsPanel },
  { id: 'seismic', label: 'Sismo', Panel: SeismicPanel },
  { id: 'project', label: 'Proyecto', Panel: ProjectPanel },
];

const TOOLS: { tool: Tool; label: string; key: string }[] = [
  { tool: 'select', label: 'Seleccionar', key: 'V' },
  { tool: 'add_vertex', label: 'Agregar vértice', key: 'A' },
  { tool: 'draw_region', label: 'Dibujar región', key: 'R' },
  { tool: 'split_region', label: 'Dividir región', key: 'D' },
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

/**
 * `active`: el editor está a la vista. Permanece montado al cambiar a «Casos de verificación» (conserva modelo, historial
 * y resultados), pero entonces sus atajos de teclado no deben actuar (R7-07).
 */
export function EditorApp({ client, active = true }: { client: EngineClient; active?: boolean }) {
  const [store] = useState<EditorStoreWithSave>(() => createEditorStore(initialDoc().doc, null));
  const cases = useMemo(() => loadBuiltinCases(), []);
  const draftStorage = useMemo(() => resolveTabDraftStorage(), []);
  // El borrador se lee una sola vez (uno corrupto, también el heredado, se elimina al leerlo y solo se avisa esa vez; se ofrece el siguiente).
  const [boot] = useState(() => loadDraftChain(draftStorage.storage));
  // La entrada del índice que se ofrece (la más reciente), para avisar si su pestaña sigue abierta.
  const [offeredEntry] = useState(() => (boot.draft ? offeredDraftEntry(draftStorage.storage) : null));
  const draftOpenElsewhere = useDraftOpenElsewhere(offeredEntry);
  const [draft, setDraft] = useState<Draft | null>(boot.draft);
  const [notices, setNotices] = useState<Notice[]>(() => {
    let first: Notice[] = [];
    boot.issues.forEach((i, k) => {
      first = addNotice(first, { id: k + 1, kind: 'aviso', text: i.text });
    });
    if (draftStorage.issue) first = addNotice(first, { id: first.length + 1, kind: 'aviso', text: draftStorage.issue.text });
    return first;
  });
  const noticeId = useRef(100);
  const [noticesPaused, setNoticesPaused] = useState(false);
  const live = useAnnouncer();
  const { announce, announceError } = live;
  const [tab, setTab] = useState<PanelTabId>('geometry');
  const [pendingFocus, setPendingFocus] = useState<{ n: number; target: IssueTarget } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const tablistRef = useRef<HTMLDivElement>(null);
  const toolbarKeys = useRovingTabIndex(toolbarRef, { selector: 'button', orientation: 'horizontal' });
  const tabKeys = useRovingTabIndex(tablistRef, { selector: '[role="tab"]', orientation: 'horizontal', activateOnFocus: true });
  const [dxf, setDxf] = useState<{ fileName: string; result: DxfParseResult } | null>(null);
  const [csv, setCsv] = useState<{ fileName: string; result: CsvImportResult } | null>(null);
  const [slopeOpen, setSlopeOpen] = useState(false);
  const [shownMethod, setShownMethod] = useState<MethodKind | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  // El modelo de partida y los de «Ejemplos» son ejemplos hasta que se guardan con nombre propio (UX-11).
  const [isExample, setIsExample] = useState(true);
  const saveFlight = useRef(createSingleFlight());
  const engineStatus = useSyncExternalStore(
    useCallback((listener: () => void) => client.subscribe(listener), [client]),
    () => client.getStatus(),
  );
  const openRef = useRef<HTMLInputElement>(null);
  const dxfRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const engine = useEngineCheck(store, client);
  const draftFailure = useDraftAutosave(store, draftStorage.storage, draft === null);
  const sameDraftElsewhere = useSameDraftWarning();

  const doc = useEditorStore(store, (s) => s.doc);
  const fileName = useEditorStore(store, (s) => s.file.name);
  const docDirty = useEditorStore(store, (s) => s.revision !== s.file.savedRevision);
  // Un trazo a medias no está en el documento ni en el borrador, pero se perdería al cerrar: cuenta como cambio sin guardar (R9-11a).
  const tracePoints = useEditorStore(store, (s) => s.ui.tracePoints ?? 0);
  const dirty = docDirty || tracePoints > 0;
  const tool = useEditorStore(store, (s) => s.ui.tool);
  useUnloadGuard(shouldWarnBeforeUnload({ dirty: docDirty, autosaveEnabled: draft === null, persistent: draftStorage.persistent, failure: draftFailure, tracePoints }));
  const canUndo = useEditorStore(store, (s) => s.history.past.length > 0);
  const canRedo = useEditorStore(store, (s) => s.history.future.length > 0);

  // Cada aviso se muestra (máximo 3, sin repetidos) y se anuncia en la región viva que corresponde (R7-12).
  const notify = useCallback(
    (kind: Notice['kind'], text: string) => {
      noticeId.current += 1;
      const id = noticeId.current;
      setNotices((prev) => addNotice(prev, { id, kind, text }));
      if (kind === 'error') announceError(text);
      else announce(text);
    },
    [announce, announceError],
  );
  const dismiss = useCallback((id: number): void => setNotices((prev) => prev.filter((n) => n.id !== id)), []);

  // Los informativos se cierran solos a los 6 s (UX-10); el puntero o el foco sobre la lista los mantienen.
  useEffect(() => {
    if (noticesPaused) return;
    const timers = notices.flatMap((n) => {
      const ms = noticeLifetimeMs(n.kind);
      return ms === null ? [] : [window.setTimeout(() => dismiss(n.id), ms)];
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [notices, noticesPaused, dismiss]);

  // ───────── Documento: nuevo, abrir, guardar ─────────

  // Con cambios sin guardar pregunta con el diálogo de la aplicación (`useConfirm`, asíncrono); sin cambios no pregunta.
  const confirm = useConfirm();
  const confirmDiscard = useMemo(() => createConfirmDiscard(store, confirm), [store, confirm]);
  // Cambiar de herramienta con un trazo de 3 o más puntos pide confirmación (A-04); con menos, el lienzo lo descarta y lo anuncia.
  const switchTool = useMemo(() => createToolSwitch(store, confirm), [store, confirm]);

  const resetEngine = engine.reset;
  /**
   * Carga otro documento (Nuevo, Abrir, Ejemplos, Recuperar): reinicia el historial (`doc/load`) y descarta el resultado,
   * el diagnóstico y las respuestas pendientes del modelo anterior (R7-05, R7-08). `saved` marca el documento como guardado.
   */
  const loadDoc = useCallback(
    (next: ModelDoc, name: string | null, opts: { saved: boolean; example: boolean }) => {
      store.dispatch({ type: 'doc/load', doc: next, fileName: name });
      if (opts.saved) store.markSaved(name);
      store.dispatch({ type: 'ui/viewport', viewport: null });
      resetEngine();
      setShownMethod(null);
      setIsExample(opts.example);
    },
    [store, resetEngine],
  );

  // «Nuevo» = «Modelo vacío»: sin regiones y con un material por defecto; el lienzo invita a «Dibujar región» (UX-01).
  const onNew = useCallback(
    () =>
      void runIfDiscarded(confirmDiscard, () => {
        loadDoc(emptyModel(), null, { saved: true, example: false });
        notify('info', 'Modelo vacío creado. Dibuje una región con la herramienta «Dibujar región» (tecla R).');
      }),
    [confirmDiscard, loadDoc, notify],
  );

  /** «Talud simple…»: crea el modelo parametrizado. Resuelve a `false` si el usuario no confirma descartar los cambios. */
  const onCreateSlope = useCallback(
    (input: SlopeInput): Promise<boolean> =>
      runIfDiscarded(confirmDiscard, () => {
        loadDoc(simpleSlope(input), null, { saved: true, example: false });
        notify('info', 'Talud simple creado. Pulse «Comprobar» para calcular el factor de seguridad.');
      }),
    [confirmDiscard, loadDoc, notify],
  );

  /** «Abrir un ejemplo» del estado vacío: abre el menú Archivo y lleva el foco a la lista de ejemplos. */
  const openExamples = useCallback((): void => {
    const trigger = Array.from(document.querySelectorAll<HTMLButtonElement>('button.dd-trigger')).find((b) => b.textContent?.trim().startsWith('Archivo'));
    trigger?.click();
    window.setTimeout(() => {
      const select = document.querySelector<HTMLSelectElement>('select[aria-label="Abrir un caso publicado como modelo"]');
      select?.focus();
      try {
        select?.showPicker();
      } catch {
        /* sin showPicker (o sin gesto del usuario): queda enfocada la lista */
      }
    }, 50);
  }, []);

  const onOpenFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // La confirmación de descarte va antes de los avisos del archivo: si se cancela, no queda ruido (R7-28).
    const opened = await readOpenFile(file, confirmDiscard);
    for (const n of opened.notices) notify(n.kind, n.text);
    if (!opened.doc) return;
    loadDoc(opened.doc, file.name, { saved: true, example: false });
    notify('info', `Abierto «${file.name}».`);
  };

  const onSave = useCallback(
    () =>
      // Un doble clic (o Ctrl+S repetido) mientras se calcula el SHA-256 no descarga dos veces (R7-28).
      void saveFlight.current.run(async () => {
        try {
          const s = store.getState();
          const text = saveOgsJson(s.doc);
          const name = s.file.name ?? `${baseFileName(null, s.doc)}.ogs.json`;
          const finalName = /\.ogs\.json$/i.test(name) ? name : `${baseFileName(name, s.doc)}.ogs.json`;
          downloadText(text, finalName, 'application/json');
          store.markSaved(finalName);
          setIsExample(false);
          clearOwnDraft(draftStorage.storage); // solo el de esta pestaña: el de otra pestaña abierta sigue a salvo (R9-01)
          const sha = await sha256Hex(text);
          notify('info', `Guardado «${finalName}». SHA-256: ${sha}`);
        } catch (err) {
          notify('error', `No se pudo guardar: ${err instanceof Error ? err.message : String(err)}`);
        }
      }),
    [store, draftStorage, notify],
  );

  const onCase = async (key: string): Promise<void> => {
    const entry = cases.find((c) => c.key === key);
    if (!entry || !(await confirmDiscard())) return;
    const opened = docFromCase(entry.caseData);
    if (!opened) {
      notify('error', `No se pudo abrir el caso ${entry.caseData.id}.`);
      return;
    }
    loadDoc(opened.doc, null, { saved: true, example: true });
    notify('info', `Caso ${entry.caseData.id} abierto como modelo (se descartan sus comprobaciones publicadas).`);
  };

  // ───────── Importar y exportar ─────────

  const onDxfFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const read = await readTextFile(file);
    if (!read.ok) {
      notify(read.notice.kind, read.notice.text);
      return;
    }
    const s = store.getState();
    const result = parseDxf(read.text, { materials: s.doc.materials.map((m) => ({ id: m.id, name: m.name })) });
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
    const read = await readTextFile(file);
    if (!read.ok) {
      notify(read.notice.kind, read.notice.text);
      return;
    }
    setCsv({ fileName: file.name, result: parseCsv(read.text) });
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
  const { canExport, canExportSurface, blockedTitle: exportBlockedTitle, surfaceTitle: exportSurfaceTitle, hint: exportHintText } = exportAvailability(engine.run, engine.current);
  // La pista se ve con un resultado obsoleto o tras intentar exportar; en el estado inicial el resumen ya dice «Pulse «Comprobar»» (B-06).
  const [exportAttempted, setExportAttempted] = useState(false);
  useEffect(() => {
    if (engine.current) setExportAttempted(false);
  }, [engine.current]);
  const exportHint = visibleExportHint({ hint: exportHintText, hasRun: engine.run !== null, current: engine.current, attempted: exportAttempted });

  const exportResults = (): void => {
    if (!engine.run || !engine.current) return;
    downloadText(resultsCsv(engine.run.report, engine.run.doc.units), `${baseFileName(fileName, doc)}-resultados.csv`, 'text/csv;charset=utf-8');
  };
  const exportSurface = (): void => {
    if (!engine.run || !engine.current || !hasExportableSurface(engine.run.report.results)) return;
    downloadText(surfaceCoordsCsv(engine.run.report.results, engine.run.doc.units), `${baseFileName(fileName, doc)}-superficie.csv`, 'text/csv;charset=utf-8');
  };

  const onReport = async (): Promise<void> => {
    if (reportBusy) return;
    if (!engine.run || !engine.current) {
      setExportAttempted(true);
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

  const checkState = checkButtonState({ busy: engine.busy, engineStatus });
  const onCheck = useCallback(async () => {
    if (engineStatus !== 'ready') return; // el botón ya está deshabilitado; esto cubre Ctrl+Intro
    const run = await engine.check();
    if (run) setShownMethod((m) => (m && run.report.results.some((r) => r.method === m) ? m : (run.report.results[0]?.method ?? null)));
  }, [engine, engineStatus]);

  // ───────── Anuncios (regiones vivas persistentes) ─────────

  // Resumen al terminar un cálculo: «Cálculo completado: Bishop FS 0,985; Spencer FS 0,984; 2 notas».
  const announcedRun = useRef<unknown>(null);
  useEffect(() => {
    if (engine.run && engine.run !== announcedRun.current) {
      announcedRun.current = engine.run;
      announce(calcAnnouncement(engine.run.report));
    }
  }, [engine.run, announce]);
  // Errores del motor y mensajes de la última pulsación (errores locales, cálculo cancelado).
  const diagnostics = useEditorStore(store, (s) => s.diagnostics);
  const engineErrorText = diagnostics.status === 'error' ? (diagnostics.issues.find((i) => i.source === 'engine' && i.severity === 'error')?.text ?? null) : null;
  useEffect(() => {
    if (engineErrorText) announceError(engineErrorText);
  }, [engineErrorText, announceError]);
  useEffect(() => {
    if (!engine.message) return;
    if (engine.messageKind === 'error') announceError(engine.message);
    else announce(engine.message);
  }, [engine.message, engine.messageKind, announce, announceError]);
  useEffect(() => {
    if (draftFailure) announce(draftFailure);
  }, [draftFailure, announce]);
  useEffect(() => {
    if (sameDraftElsewhere) notify('aviso', SAME_DRAFT_TEXT);
  }, [sameDraftElsewhere, notify]);
  const draftAnnounced = useRef(false);
  useEffect(() => {
    if (draft && !draftAnnounced.current) {
      draftAnnounced.current = true;
      announce(`Hay un borrador guardado el ${formatWhen(draft.savedAt)}. Puede recuperarlo o descartarlo.`);
    }
  }, [draft, announce]);
  // La presencia de las otras pestañas llega después de montar: se anuncia cuando aparece (la franja visible no es una región viva).
  useEffect(() => {
    if (draft && draftOpenElsewhere) announce(OPEN_ELSEWHERE_TEXT);
  }, [draft, draftOpenElsewhere, announce]);
  const bootNotices = useRef(notices);
  useEffect(() => {
    for (const n of bootNotices.current) announce(n.text);
  }, [announce]);

  // ───────── Navegación desde Diagnósticos (R7-11) ─────────

  const navigateIssue = useCallback((_issue: unknown, target: IssueTarget): void => {
    if (target.tab) setTab(target.tab);
    setPendingFocus((p) => ({ n: (p?.n ?? 0) + 1, target }));
  }, []);
  // Tras abrir la pestaña (el panel ya está en el DOM), el foco va al campo; si no existe, al primer control del panel.
  useEffect(() => {
    if (!pendingFocus) return;
    const { target } = pendingFocus;
    let el: HTMLElement | null = null;
    if (target.tab === null) {
      el = document.querySelector<HTMLElement>('[data-testid="editor-canvas"] [role="application"], [data-testid="editor-canvas"] svg');
    } else {
      const panel = document.getElementById('ea-tabpanel');
      el = findIssueFocus(target) ?? (target.fieldPath ? panel?.querySelector<HTMLElement>(fieldSelector(target.fieldPath)) : null) ?? panel?.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled)') ?? panel;
    }
    if (el) {
      if (!el.matches('input, select, button, textarea, [tabindex]')) el.tabIndex = -1;
      el.focus();
      el.scrollIntoView({ block: 'nearest' });
    }
    setPendingFocus(null);
  }, [pendingFocus]);

  // ───────── Borrador ─────────

  const recoverDraft = async (): Promise<void> => {
    if (!draft) return;
    // Recuperar reemplaza el modelo actual: si se editó tras arrancar, se pregunta antes de descartarlo.
    if (!(await confirmDiscard())) return;
    // Lo recuperado sigue siendo trabajo sin guardar en archivo: no se marca como guardado y el borrador se conserva.
    loadDoc(draft.doc, draft.fileName, { saved: false, example: false });
    setDraft(null);
    notify('info', `Borrador recuperado (${formatWhen(draft.savedAt)}).`);
  };
  const discardDraft = (): void => {
    // Si el borrador es de otra pestaña que sigue abierta, solo se oculta el aviso aquí: no se borra su trabajo (R9-01).
    const removed = discardOfferedDraft(draftStorage.storage, offeredEntry, draftOpenElsewhere);
    setDraft(null);
    notify('info', removed ? 'Borrador descartado.' : 'Aviso oculto: el borrador sigue guardado porque es de otra pestaña que sigue abierta.');
  };

  // ───────── Atajos globales ─────────

  const actions = useRef<Record<ShortcutAction, () => void>>({} as Record<ShortcutAction, () => void>);
  actions.current = {
    undo: () => store.undo(),
    redo: () => store.redo(),
    save: () => onSave(),
    open: () => openRef.current?.click(),
    check: () => void onCheck(),
    'tool:select': () => void switchTool('select'),
    'tool:add_vertex': () => void switchTool('add_vertex'),
    'tool:draw_region': () => void switchTool('draw_region'),
    'tool:split_region': () => void switchTool('split_region'),
    'tool:pan': () => void switchTool('pan'),
  };
  useEffect(() => {
    if (!active) return; // en «Casos de verificación» el editor sigue montado pero oculto: sus atajos no actúan (R7-07)
    const onKey = (e: KeyboardEvent): void => {
      if (dxf || csv || slopeOpen) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      // Con un diálogo modal abierto (confirmación, ayuda) las teclas son del diálogo: Ctrl+Z o R no deben tocar el modelo de detrás.
      if (t?.closest('dialog')) return;
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
  }, [dxf, csv, slopeOpen, active]);

  // ───────── Presentación ─────────

  const shown = engine.run?.report.results.find((r) => r.method === shownMethod) ?? engine.run?.report.results[0] ?? null;
  // La superficie del informe (círculo o polilínea ajustada al terreno, F3.7) y sus dovelas se superponen al lienzo.
  const canvasResult = engine.current && shown && shown.slices.length > 0 ? { surface: shown.surface, slices: shown.slices } : undefined;
  // El método mostrado puede no haber convergido: su superficie es solo la última evaluada (R7-01).
  const surfaceConverged = shown?.status === 'converged';
  const ActivePanel = (TABS.find((t) => t.id === tab) ?? TABS[0]!).Panel;
  const scene = useMemo(() => buildScene(doc, canvasResult && shown ? shown : null), [doc, canvasResult, shown]);
  // Contrato con el lienzo (U2-C): superficie no convergida discontinua, unidades de las etiquetas y anuncios del teclado.
  const canvasContract = {
    surfaceConverged,
    units: (isImperialUnits(doc.units) ? 'imperial' : 'SI') as 'SI' | 'imperial',
    onAnnounce: announce,
    emptyState: <EmptyCanvasState onDraw={() => void switchTool('draw_region')} onExample={openExamples} />,
  };

  const narrow = useNarrow();
  const undoRedoButtons = (
    <>
      <button type="button" onClick={() => store.undo()} disabled={!canUndo} title="Ctrl+Z">
        Deshacer
      </button>
      <button type="button" onClick={() => store.redo()} disabled={!canRedo} title="Ctrl+Mayús+Z o Ctrl+Y">
        Rehacer
      </button>
    </>
  );
  const toolButtons = TOOLS.map((t) => (
    <button
      key={t.tool}
      type="button"
      aria-pressed={tool === t.tool}
      className={tool === t.tool ? 'ea-tool ea-tool-active' : 'ea-tool'}
      onClick={() => void switchTool(t.tool)}
      title={`Tecla ${t.key}`}
    >
      {t.label}
    </button>
  ));

  return (
    <div className="editor-app" lang="es" data-testid="editor-app">
      <LiveRegions polite={live.polite} alert={live.alert} />
      <div className="ea-toolbar panel" role="toolbar" aria-label="Acciones del modelo" ref={toolbarRef} onKeyDown={toolbarKeys.onKeyDown}>
        <div
          className="ea-group"
          role="group"
          aria-label="Menús"
          onClickCapture={(e) => {
            // Abrir «Exportar» sin resultado vigente es un intento de exportar: se muestra la pista.
            const trigger = e.target instanceof Element ? e.target.closest('button.dd-trigger') : null;
            if (trigger?.textContent?.trim().startsWith('Exportar') && !canExport) setExportAttempted(true);
          }}
        >
          <DropdownMenu label="Archivo">
            <button type="button" onClick={onNew} aria-describedby="ea-new-hint">
              Nuevo
            </button>
            <span id="ea-new-hint" className="dd-note">
              Modelo vacío: sin regiones, para dibujarlas.
            </span>
            <button type="button" onClick={() => setSlopeOpen(true)}>
              Talud simple…
            </button>
            <button type="button" onClick={() => openRef.current?.click()} title="Ctrl+O">
              Abrir
            </button>
            <button type="button" onClick={onSave} title="Ctrl+S">
              Guardar
            </button>
            <hr />
            <button type="button" onClick={() => dxfRef.current?.click()}>
              Importar DXF
            </button>
            <button type="button" onClick={() => csvRef.current?.click()}>
              Importar CSV
            </button>
            <hr />
            <label className="dd-field">
              <span>Ejemplos</span>
              <select aria-label="Abrir un caso publicado como modelo" value="" onChange={(e) => void onCase(e.target.value)}>
                <option value="">Elegir un ejemplo…</option>
                {cases.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </DropdownMenu>
          <DropdownMenu label="Exportar">
            <button type="button" onClick={exportResults} disabled={!canExport} title={exportBlockedTitle} aria-describedby={exportHint ? 'ea-export-hint' : undefined}>
              Exportar resultados (CSV)
            </button>
            <button type="button" onClick={exportSurface} disabled={!canExportSurface} title={exportSurfaceTitle} aria-describedby={exportHint ? 'ea-export-hint' : undefined}>
              Exportar superficie (CSV)
            </button>
          </DropdownMenu>
        </div>
        {narrow ? (
          // Con 480 px o menos, Deshacer, Rehacer y las herramientas van en un menú «Editar» (B-09). Los botones conservan sus nombres.
          <div className="ea-group" role="group" aria-label="Edición y herramientas">
            <DropdownMenu label={editMenuLabel(tool, TOOLS.find((t) => t.tool === tool)?.label)}>
              {undoRedoButtons}
              <hr />
              {toolButtons}
            </DropdownMenu>
          </div>
        ) : (
          <>
            <div className="ea-group" role="group" aria-label="Edición">
              {undoRedoButtons}
            </div>
            <div className="ea-group" role="group" aria-label="Herramienta del lienzo">
              {toolButtons}
            </div>
          </>
        )}
        <div className="ea-group ea-group-main" role="group" aria-label="Cálculo">
          <button type="button" className="primary ea-primary" onClick={() => void onCheck()} disabled={checkState.disabled} title="Ctrl+Intro">
            {checkState.label}
          </button>
          {engine.busy && (
            <button type="button" onClick={engine.cancel} title="Termina el cálculo y reinicia el motor">
              Cancelar cálculo
            </button>
          )}
          {engineStatus === 'failed' && (
            <button type="button" onClick={() => client.cancel()}>
              Reiniciar el motor
            </button>
          )}
          <button
            type="button"
            onClick={() => void onReport()}
            disabled={reportBusy || engine.busy || !canExport}
            title={exportBlockedTitle}
            aria-describedby={exportHint ? 'ea-export-hint' : undefined}
          >
            {reportBusy ? 'Generando…' : 'Informe PDF'}
          </button>
        </div>
        <input ref={openRef} type="file" accept=".json,.ogs.json,application/json" hidden data-testid="file-open" onChange={(e) => void onOpenFile(e)} />
        <input ref={dxfRef} type="file" accept=".dxf" hidden data-testid="file-dxf" onChange={(e) => void onDxfFile(e)} />
        <input ref={csvRef} type="file" accept=".csv,text/csv" hidden data-testid="file-csv" onChange={(e) => void onCsvFile(e)} />
      </div>

      <div className="ea-statusbar">
        <p className="ea-status small" data-testid="file-status">
          <strong>{documentTitle({ fileName, title: doc.meta.title, example: isExample })}</strong>{' '}
          {dirty ? '· con cambios sin guardar' : '· sin cambios pendientes'}
          {engine.busy ? ' · calculando…' : ''}
        </p>
        {checkState.status && (
          <p className="ea-engine-status small" data-testid="engine-status">
            {checkState.status}
          </p>
        )}
        {exportHint && (
          <p id="ea-export-hint" className="ea-export-hint small" data-testid="export-hint">
            {exportHint}
          </p>
        )}
      </div>

      {draft && (
        <div className="banner ea-draft" data-testid="draft-banner">
          <span>
            Hay un borrador guardado el {formatWhen(draft.savedAt)} ({draft.fileName ?? 'sin nombre'}).
            {draftOpenElsewhere && (
              <>
                {' '}
                <strong data-testid="draft-open-elsewhere">{OPEN_ELSEWHERE_TEXT}</strong>
              </>
            )}
          </span>
          <button type="button" onClick={() => void recoverDraft()}>
            Recuperar
          </button>
          <button type="button" onClick={discardDraft}>
            Descartar
          </button>
        </div>
      )}
      {draftFailure && <div className="banner banner-sim">{draftFailure}</div>}
      {engine.message && <div className={engine.messageKind === 'error' ? 'banner banner-error' : 'banner'}>{engine.message}</div>}
      <NoticeList notices={notices} onDismiss={dismiss} onDismissAll={() => setNotices([])} onPausedChange={setNoticesPaused} />

      <div className="ea-layout">
        <div className="ea-main">
          <ResultSummary run={engine.run} current={engine.current} busy={engine.busy} shownMethod={shownMethod ?? shown?.method ?? null} />
          <section className="panel ea-canvas-panel" aria-label="Sección del modelo">
            <div className="ea-canvas" data-testid="editor-canvas">
              <EditorCanvas store={store} result={canvasResult} {...canvasContract} />
            </div>
            <Legend
              scene={scene}
              label="Leyenda de la sección"
              options={{
                surface: Boolean(canvasResult),
                unconverged: Boolean(canvasResult) && !surfaceConverged,
                invalid: shown?.status === 'invalid',
                fixedCircle: Boolean(canvasResult) && Boolean(shown) && !shown?.search,
                slices: Boolean(canvasResult),
                bands: Boolean(doc.analysis.search),
                loads: (doc.loads?.length ?? 0) > 0,
                seismic: Boolean(doc.analysis.seismic),
                piezoExtrapolated: piezoExtension(doc) !== null,
                fixedPolyline: doc.analysis.surface?.type === 'polyline',
              }}
            />
            {engine.run && !engine.current && (
              <p className="small ea-stale" data-testid="stale-result">
                El resultado mostrado es de una versión anterior del modelo. Pulse «Comprobar» para actualizarlo.
              </p>
            )}
            {canvasResult && shown && (
              <p className={surfaceConverged ? 'small muted' : 'small ea-caption-unconverged'} data-testid="result-caption">
                {resultCaption(shown.method, shown.status, !shown.search)}
              </p>
            )}
          </section>

          {engine.run && (
            <section className="panel" aria-labelledby="ea-results-title" data-testid="results-panel">
              <h2 id="ea-results-title">Resultados{engine.current ? '' : ' (desactualizados)'}</h2>
              <ResultsTable report={engine.run.report} elapsedMs={engine.run.elapsedMs} shownMethod={shownMethod ?? shown?.method ?? null} onShowMethod={setShownMethod} lengthUnit={lengthUnitOf(engine.run.doc.units)} />
              <p className="small muted">
                Motor: {engine.run.report.engine} · SHA-256 del modelo calculado: <code>{engine.run.sha256.slice(0, 16)}…</code>
              </p>
            </section>
          )}
          <DiagnosticsPanel store={store} onNavigate={navigateIssue} />
        </div>

        <aside className="ea-side" aria-label="Propiedades del modelo">
          <div className="ea-tabs" role="tablist" aria-label="Paneles del modelo" ref={tablistRef} onKeyDown={tabKeys.onKeyDown}>
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

      {slopeOpen && <NewSlopeDialog initialUnits={isImperialUnits(doc.units) ? 'imperial' : 'SI'} onCancel={() => setSlopeOpen(false)} onCreate={onCreateSlope} />}
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
