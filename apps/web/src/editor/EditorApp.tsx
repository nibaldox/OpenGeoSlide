// Aplicación del editor en el armazón A «Flujo de trabajo»: barra lateral «Modelo» con los diez pasos y el pie de acción, vistas
// (lienzo, resultados, casos, informe), cabecera (menús y chip por portal) y barra de estado (abrir, guardar, importar, calcular, informe).
// Parte del documento y llega al informe PDF. Toda la lógica no visual vive en `app/` (con pruebas en Node).

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type ComponentType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { loadBuiltinCases } from '../cases';
import type { EngineClient } from '../engine/client';
import type { MethodKind } from '../engine/types';
import { loadDraftChain, type Draft } from '../io/draft';
import { parseCsv } from '../io/csv';
import { parseDxf, type DxfParseResult } from '../io/dxf';
import { sha256Hex } from '../io/ogsJson';
import type { CsvImportResult } from '../io/types';
import { buildReportPdf } from '../report/pdf';
import './app/editor-app.css';
import './app/newModel.css';
import './app/docLabel.css';
import { buildScene } from '../render/scene';
import { CrackSummary } from '../ui/CrackResults';
import { useConfirm } from '../ui/ConfirmDialog';
import { DropdownMenu } from '../ui/DropdownMenu';
import { Legend } from '../ui/Legend';
import { IconCollapse, IconRedo, IconUndo } from '../ui/icons';
import { EditorCanvas } from './canvas/EditorCanvas';
import { piezoExtension } from './canvas/piezoExtension';
import { isImperialUnits } from './state/units';
import { applyPiezoImport, applyRegionImport } from './app/applyImport';
import { downloadBlob, downloadText } from './app/download';
import { createConfirmDiscard, createTabSwitch, createToolSwitch, runIfDiscarded } from './app/discard';
import { commitFocusedField, saveDocument } from './app/saveDocument';
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
import { calcAnnouncement, focusResultsTable } from './app/resultSummary';
import { useAnnouncer } from './app/useAnnouncer';
import { checkButtonState } from './app/engineCheck';
import { reportContents, runStatus, stepStates, STEP_ORDER } from './app/shellModel';
import { ActionFoot, CollapsedActions, ExportHint } from './app/shell/ActionFoot';
import { advisoryCounts, focusDiagnostics } from './app/shell/advisories';
import { issueNavPlan } from './app/shell/issueNavPlan';
import { reportDocTitle, reportNotice } from './app/shell/reportTitle';
import { pickShownMethod } from './app/shell/shownMethod';
import { buildRunStatusInput } from './app/shell/statusInput';
import { useCanvasHeight } from './app/shell/useCanvasHeight';
import { useHudInsets } from './app/shell/useHudInsets';
import { PaletteTools } from './app/shell/PaletteTools';
import { ReportView } from './app/shell/ReportView';
import { ResultsView } from './app/shell/ResultsView';
import { browserSideStorage, readSideCollapsed, sideLayout, writeSideCollapsed } from './app/shell/sideState';
import { StepList } from './app/shell/StepList';
import { toolStatusText } from './app/shell/tools';
import { useIsDesktop } from './app/shell/useMedia';
import { ViewTabs } from './app/shell/ViewTabs';
import { shortcutDisposition, viewTitle, type ViewId } from './app/shell/views';
import { readOpenFile, readTextFile } from './app/openFile';
import { baseFileName, buildReportInput, exportAvailability, hasExportableSurface, hasReinforcementForces, reinforcementForcesCsv, resultCaption, resultsCsv, slicesCsv, surfaceCoordsCsv } from './app/reportInput';
import { createSingleFlight } from './app/singleFlight';
import { ExamplePicker } from './app/ExamplePicker';
import { isEditableTag, runCheckShortcut, shortcutFor, type ShortcutAction } from './app/shortcuts';
import { OPEN_ELSEWHERE_TEXT } from './app/draftTabs';
import { SAME_DRAFT_TEXT, clearOwnDraft, discardOfferedDraft, offeredDraftEntry, resolveTabDraftStorage, shouldWarnBeforeUnload, useDraftAutosave, useDraftOpenElsewhere, useSameDraftWarning, useUnloadGuard } from './app/useDraftAutosave';
import { useEngineCheck } from './app/useEngineCheck';
import { PENDING_DRAFTS_TEXT, clearPendingDrafts, getPendingDrafts, pendingDraftsNotice } from './panels/forms';
import {
  AnalysisPanel,
  DiagnosticsPanel,
  GeometryPanel,
  LoadsPanel,
  MaterialsPanel,
  ProjectPanel,
  ReinforcementsPanel,
  SearchPanel,
  SeismicPanel,
  SurfacePanel,
  WaterPanel,
} from './panels';
import { DocEpochContext } from './panels/useStoreSelector';
import { isStartDocument, startRestoration } from './app/startDocument';
import { createEditorStore, useEditorStore, useLocalIssues, type EditorStoreWithSave } from './state';
import type { EditorStore, ModelDoc } from './types';

/** Pasos de la barra lateral (`PanelTabId` incluye «Refuerzos», v0.4). El orden y los rótulos viven en `app/shell/steps.ts`. */
type TabId = PanelTabId;

const PANELS: Record<TabId, ComponentType<{ store: EditorStore }>> = {
  geometry: GeometryPanel,
  materials: MaterialsPanel,
  water: WaterPanel,
  surface: SurfacePanel,
  search: SearchPanel,
  analysis: AnalysisPanel,
  loads: LoadsPanel,
  reinforcements: ReinforcementsPanel,
  seismic: SeismicPanel,
  project: ProjectPanel,
};

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
 * Estado del archivo y de los borradores en la cabecera del editor (W-R15c): distingue el estado guardado del
 * documento del de los borradores de tarjetas sin aplicar, evitando decir «sin cambios pendientes» junto a un
 * borrador abierto.
 */
export function fileStatusText({
  dirty,
  pendingDraftCount = 0,
  busy = false,
}: {
  dirty: boolean;
  pendingDraftCount?: number;
  busy?: boolean;
}): string {
  const parts = [dirty ? 'archivo con cambios sin guardar' : 'archivo sin cambios'];
  if (pendingDraftCount === 1) parts.push('borrador sin aplicar');
  else if (pendingDraftCount > 1) parts.push(`${pendingDraftCount} borradores sin aplicar`);
  if (busy) parts.push('calculando…');
  return `· ${parts.join(' · ')}`;
}

/**
 * Rótulo del documento abierto en la cabecera del área (X35 §3, punto 8): el mismo título que la barra de estado
 * (`documentTitle`: «Ejemplo: …» mientras es un ejemplo sin archivo propio) y, tras un punto medio, si tiene cambios sin guardar.
 * Una sola línea: el estilo la recorta con puntos suspensivos, y el texto completo queda en el DOM y en el `title`.
 */
export function docLabelText(input: { fileName: string | null; title: string | null | undefined; example: boolean; dirty: boolean }): string {
  return `${documentTitle(input)} · ${input.dirty ? 'con cambios sin guardar' : 'sin cambios'}`;
}

/** Nodos de la cabecera (los crea `App`) donde el editor muestra el chip de estado y los menús «Archivo» y «Exportar». */
export interface HeaderSlots {
  chip: HTMLElement | null;
  menus: HTMLElement | null;
}

export interface EditorAppProps {
  client: EngineClient;
  /** Vista activa (la lleva `App`: la guía y la cabecera dependen de ella). Todas quedan montadas; las ocultas llevan `hidden`. */
  view: ViewId;
  onViewChange: (view: ViewId) => void;
  /** Cabecera de la aplicación: si un nodo aún no existe, el control se muestra en línea. */
  headerSlots?: HeaderSlots;
  /** `EngineIndicator` para la barra de estado. */
  engineSlot?: ReactNode;
  /** Avisos de sesión de `App` (motor simulado, error del motor), sobre las vistas. */
  sessionBanners?: ReactNode;
  /** Vista «Casos de verificación» (`CasesView`), que vive en `App`. */
  casesView?: ReactNode;
}

/**
 * Con la vista «Casos de verificación» el editor sigue montado pero oculto (conserva modelo, historial y resultados) y sus
 * atajos de teclado no actúan (R7-07): `shortcutActsIn(view, action)`.
 */
export function EditorApp({ client, view, onViewChange, headerSlots, engineSlot, sessionBanners, casesView }: EditorAppProps) {
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
  const [tab, setTabState] = useState<TabId>('geometry');
  const [pendingFocus, setPendingFocus] = useState<{ n: number; target: IssueTarget } | null>(null);
  const [sideCollapsed, setSideCollapsedState] = useState(() => readSideCollapsed(browserSideStorage()));
  const sideToggled = useRef(false);
  const showSideRef = useRef<HTMLButtonElement>(null);
  const hideSideRef = useRef<HTMLButtonElement>(null);
  const setSideCollapsed = useCallback((collapsed: boolean): void => {
    sideToggled.current = true;
    setSideCollapsedState(collapsed);
    writeSideCollapsed(browserSideStorage(), collapsed);
  }, []);
  /** Despliega la barra desde un flujo programático (Diagnósticos, «Editar título»): se guarda y el foco lo lleva el destino, no el botón «Contraer» (A-09). */
  const expandSide = useCallback((): void => {
    setSideCollapsedState(false);
    writeSideCollapsed(browserSideStorage(), false);
  }, []);
  // Al plegar o desplegar, el foco pasa al botón contrario (el que acaba de aparecer): nunca cae en <body>.
  useEffect(() => {
    if (!sideToggled.current) return;
    sideToggled.current = false;
    (sideCollapsed ? showSideRef.current : hideSideRef.current)?.focus();
  }, [sideCollapsed]);
  const [dxf, setDxf] = useState<{ fileName: string; result: DxfParseResult } | null>(null);
  const [csv, setCsv] = useState<{ fileName: string; result: CsvImportResult } | null>(null);
  const [slopeOpen, setSlopeOpen] = useState(false);
  const [shownMethod, setShownMethod] = useState<MethodKind | null>(null);
  // `true` si el usuario eligió el método mostrado (en Resultados): un nuevo cálculo lo respeta. Si no, se muestra el del FS mínimo (B-05).
  const methodChosen = useRef(false);
  const chooseMethod = useCallback((m: MethodKind): void => {
    methodChosen.current = true;
    setShownMethod(m);
  }, []);
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
  // RCM-B-09: el documento de arranque, por identidad. Al deshacer hasta él (p. ej. la primera importación) vuelve el rótulo de ejemplo,
  // el estado limpio y «Reemplazar» por defecto, sin comparar documentos enteros en cada render.
  const [startDoc] = useState(() => store.getState().doc);
  const atStart = useEditorStore(store, (s) => isStartDocument(s, startDoc));
  useEffect(() => {
    const restore = startRestoration(store.getState(), startDoc);
    if (restore === null) return;
    setIsExample(true);
    if (restore.markClean) store.markSaved(null);
  }, [store, startDoc, atStart, docDirty]);
  // Un trazo a medias no está en el documento ni en el borrador, pero se perdería al cerrar: cuenta como cambio sin guardar (R9-11a).
  const tracePoints = useEditorStore(store, (s) => s.ui.tracePoints ?? 0);
  // CM-WC: el modelo de arranque sin cambios (ningún documento cargado ni edición desde que se abrió la página) es el único para el que
  // «Reemplazar» es el destino por defecto al importar; el diálogo también lo usa para nombrar a qué modelo se agrega.
  const pristineStart = useEditorStore(store, (s) => isStartDocument(s, startDoc));
  const dirty = docDirty || tracePoints > 0;
  const docLabel = docLabelText({ fileName, title: doc.meta.title, example: isExample, dirty });
  const tool = useEditorStore(store, (s) => s.ui.tool);
  useUnloadGuard(shouldWarnBeforeUnload({ dirty: docDirty, autosaveEnabled: draft === null, persistent: draftStorage.persistent, failure: draftFailure, tracePoints, pendingDrafts: engine.pendingDrafts.length }));
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
  const confirmDiscard = useMemo(() => createConfirmDiscard(store, confirm, () => getPendingDrafts(store)), [store, confirm]);
  // R16B-02: cambiar de pestaña desmonta el panel y con él el formulario de sus tarjetas; con borradores sin aplicar se pide confirmación.
  const confirmTabSwitch = useMemo(
    () =>
      createTabSwitch<TabId>({
        getPendingDrafts: () => getPendingDrafts(store),
        clearDrafts: () => clearPendingDrafts(store),
        confirm,
        // Al cancelar, el foco vuelve a la pestaña que sigue activa (con las flechas ya había pasado a la pestaña de destino).
        confirmExtras: (from) => ({ returnFocus: () => document.getElementById(`ea-tab-${from}`) }),
      }),
    [store, confirm],
  );
  const tabRef = useRef<TabId>(tab);
  tabRef.current = tab;
  /** Único camino para cambiar de pestaña (botones, flechas del `tablist`, Diagnósticos): `false` si el usuario cancela. */
  const setTab = useCallback(
    async (next: TabId): Promise<boolean> => {
      if (!(await confirmTabSwitch(tabRef.current, next))) return false;
      setTabState(next);
      return true;
    },
    [confirmTabSwitch],
  );
  /** Pasos de la barra lateral y «Editar título» del informe: el paso se abre con la barra a la vista. */
  const selectStep = useCallback((id: TabId): void => void setTab(id), [setTab]);
  // Cambiar de herramienta con un trazo de 3 o más puntos pide confirmación (A-04); con menos, el lienzo lo descarta y lo anuncia.
  const switchTool = useMemo(() => createToolSwitch(store, confirm), [store, confirm]);

  const resetEngine = engine.reset;
  /** UA-E3 §1: lo que carga o crea un modelo (y lo importado) se ve en Lienzo, no detrás de otra vista. */
  const backToCanvas = useCallback((): void => {
    if (view !== 'canvas') onViewChange('canvas');
  }, [view, onViewChange]);
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
      methodChosen.current = false;
      setIsExample(opts.example);
      backToCanvas();
    },
    [store, resetEngine, backToCanvas],
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
        // R16B-01: con borradores de tarjeta sin aplicar no se descarga nada: avisa, igual que «Comprobar».
        await saveDocument({
          getState: () => store.getState(),
          markSaved: (name) => store.markSaved(name),
          getPendingDrafts: () => getPendingDrafts(store),
          download: downloadText,
          notify,
          sha256: sha256Hex,
          afterSave: () => {
            setIsExample(false);
            clearOwnDraft(draftStorage.storage); // solo el de esta pestaña: el de otra pestaña abierta sigue a salvo (R9-01)
          },
        });
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

  const applyRegions = (plan: RegionImportPlan, mode: 'add' | 'replace', source: string, fresh: boolean): void => {
    applyRegionImport(store, plan, mode, fresh ? { fileName: source } : undefined);
    if (fresh) {
      // CM-W2: es otro modelo (el de «Nuevo» con lo importado): el resultado y el método elegido del ejemplo de arranque ya no le corresponden, y
      // deja de ser un «ejemplo» en el rótulo.
      resetEngine();
      setShownMethod(null);
      methodChosen.current = false;
      setIsExample(false);
    }
    setDxf(null);
    setCsv(null);
    backToCanvas();
    notify(
      'info',
      fresh
        ? `${source}: modelo nuevo creado con ${plan.regions.length} región(es) y ${plan.newMaterials.length} material(es) del archivo. Se deshace con Ctrl+Z.`
        : `${source}: ${plan.regions.length} región(es) importada(s) (${mode === 'add' ? 'agregadas' : 'reemplazan a las anteriores'}). Se deshace con Ctrl+Z.`,
    );
  };

  // Solo se exporta el resultado de la revisión actual: tras editar, hay que volver a pulsar «Comprobar» (E12i).
  // R15B-01: tampoco se permite comprobar ni exportar mientras exista un borrador sin aplicar en cualquier tarjeta.
  const pendingDrafts = engine.pendingDrafts;
  const hasDrafts = pendingDrafts.length > 0;
  const rawExport = exportAvailability(engine.run, engine.current);
  const canExport = rawExport.canExport && !hasDrafts;
  const canExportSurface = rawExport.canExportSurface && !hasDrafts;
  const exportBlockedTitle = hasDrafts ? PENDING_DRAFTS_TEXT : rawExport.blockedTitle;
  const exportSurfaceTitle = hasDrafts ? PENDING_DRAFTS_TEXT : rawExport.surfaceTitle;
  const exportHintText = rawExport.hint;
  // La pista se ve con un resultado obsoleto o tras intentar exportar; en el estado inicial el resumen ya dice «Pulse «Comprobar»» (B-06).
  const [exportAttempted, setExportAttempted] = useState(false);
  useEffect(() => {
    if (engine.current) setExportAttempted(false);
  }, [engine.current]);
  const exportHint = hasDrafts ? undefined : visibleExportHint({ hint: exportHintText, hasRun: engine.run !== null, current: engine.current, attempted: exportAttempted });
  const exportDescribedBy = hasDrafts ? 'ea-pending-drafts' : exportHint ? 'ea-export-hint' : undefined;

  const exportResults = (): void => {
    if (hasDrafts || !engine.run || !engine.current) return;
    downloadText(resultsCsv(engine.run.report, engine.run.doc.units), `${baseFileName(fileName, doc)}-resultados.csv`, 'text/csv;charset=utf-8');
  };
  const exportSlices = (): void => {
    if (hasDrafts || !engine.run || !engine.current || !hasExportableSurface(engine.run.report.results)) return;
    downloadText(slicesCsv(engine.run), `${baseFileName(fileName, engine.run.doc)}-dovelas.csv`, 'text/csv;charset=utf-8');
  };
  const exportSurface = (): void => {
    if (hasDrafts || !engine.run || !engine.current || !hasExportableSurface(engine.run.report.results)) return;
    downloadText(surfaceCoordsCsv(engine.run.report.results, engine.run.doc.units), `${baseFileName(fileName, doc)}-superficie.csv`, 'text/csv;charset=utf-8');
  };

  const exportForces = (): void => {
    if (hasDrafts || !engine.run || !engine.current || !hasReinforcementForces(engine.run.report.results)) return;
    downloadText(reinforcementForcesCsv(engine.run), `${baseFileName(fileName, doc)}-fuerzas-refuerzos.csv`, 'text/csv;charset=utf-8');
  };

  const onReport = async (): Promise<void> => {
    if (reportBusy) return;
    if (hasDrafts) {
      notify('aviso', pendingDraftsNotice(pendingDrafts));
      return;
    }
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
  const checkDisabled = checkState.disabled || hasDrafts;
  const onCheck = useCallback(async () => {
    if (hasDrafts) {
      notify('aviso', pendingDraftsNotice(pendingDrafts));
      return;
    }
    if (engineStatus !== 'ready') return; // el botón ya está deshabilitado; esto cubre Ctrl+Intro
    const run = await engine.check();
    if (run) setShownMethod((m) => pickShownMethod(run.report, methodChosen.current ? m : null));
  }, [engine, engineStatus, hasDrafts, pendingDrafts, notify]);

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

  // R16B-02: con borradores sin aplicar, abrir otra pestaña pide confirmación; si se cancela no se navega ni se mueve el foco.
  const navigateIssue = useCallback(
    (_issue: unknown, target: IssueTarget): void => {
      void (async () => {
        const plan = issueNavPlan(target);
        if (plan.step && !(await setTab(plan.step))) return;
        // Un campo de un paso se abre en la barra lateral (si estaba plegada, se despliega y se guarda); un destino en el lienzo o en su
        // paleta vuelve a «Lienzo» (A-10).
        if (plan.expandSide) expandSide();
        if (plan.toCanvas) onViewChange('canvas');
        setPendingFocus((p) => ({ n: (p?.n ?? 0) + 1, target }));
      })();
    },
    [setTab, onViewChange, expandSide],
  );
  /** «Editar título» del informe: confirma el cambio de paso (borradores), despliega la barra y enfoca el título (A-09). */
  const editTitle = useCallback((): void => {
    void (async () => {
      if (!(await setTab('project'))) return;
      expandSide();
      setPendingFocus((p) => ({ n: (p?.n ?? 0) + 1, target: { tab: 'project', selection: { kind: 'none' }, fieldPath: '/meta/title' } }));
    })();
  }, [setTab, expandSide]);
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

  const onCheckRef = useRef(onCheck);
  onCheckRef.current = onCheck;
  const actions = useRef<Record<ShortcutAction, () => void>>({} as Record<ShortcutAction, () => void>);
  actions.current = {
    undo: () => store.undo(),
    redo: () => store.redo(),
    // R16: con el foco en un campo, su valor se confirma (blur) antes de guardar: el archivo lleva lo que muestra la tarjeta.
    save: () => {
      commitFocusedField(document.activeElement);
      onSave();
    },
    open: () => openRef.current?.click(),
    // Ctrl+Intro con el foco en un campo: se confirma el campo y se comprueba con el estado ya repintado (`runCheckShortcut`).
    // `onCheckRef` apunta al `onCheck` del último render, porque la confirmación del campo cambia los borradores pendientes.
    check: () => runCheckShortcut({ commitFocused: () => commitFocusedField(document.activeElement), check: () => void onCheckRef.current() }),
    'tool:select': () => void switchTool('select'),
    'tool:add_vertex': () => void switchTool('add_vertex'),
    'tool:draw_region': () => void switchTool('draw_region'),
    'tool:split_region': () => void switchTool('split_region'),
    'tool:draw_reinforcement': () => void switchTool('draw_reinforcement'),
    'tool:pan': () => void switchTool('pan'),
  };
  useEffect(() => {
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
      // En «Casos de verificación» el editor sigue montado pero oculto: ningún atajo actúa (R7-07); las herramientas solo en «Lienzo».
      // Fuera de un campo de Casos, un atajo de documento se traga (UA-E3 §1): el navegador no aplica su Ctrl+Z a un campo del editor.
      const disposition = action ? shortcutDisposition(view, action, isEditableTag(t?.tagName, t?.isContentEditable ?? false)) : 'ignore';
      if (!action || disposition === 'ignore') return;
      e.preventDefault();
      if (disposition === 'run') actions.current[action]();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dxf, csv, slopeOpen, view]);

  // ───────── Presentación ─────────

  const shown = engine.run?.report.results.find((r) => r.method === shownMethod) ?? engine.run?.report.results[0] ?? null;
  // La superficie del informe (círculo o polilínea ajustada al terreno, F3.7) y sus dovelas se superponen al lienzo.
  const canvasResult = engine.current && shown && shown.slices.length > 0 ? { surface: shown.surface, slices: shown.slices, reinforcementForces: shown.reinforcement_forces, tensionCrack: shown.tension_crack } : undefined;
  // El método mostrado puede no haber convergido: su superficie es solo la última evaluada (R7-01).
  const surfaceConverged = shown?.status === 'converged';
  const ActivePanel = PANELS[tab];
  const scene = useMemo(() => buildScene(doc, canvasResult && shown ? shown : null), [doc, canvasResult, shown]);
  // Contrato con el lienzo (U2-C): superficie no convergida discontinua, unidades de las etiquetas y anuncios del teclado.
  const canvasContract = {
    surfaceConverged,
    units: (isImperialUnits(doc.units) ? 'imperial' : 'SI') as 'SI' | 'imperial',
    onAnnounce: announce,
    emptyState: <EmptyCanvasState onDraw={() => void switchTool('draw_region')} onExample={openExamples} />,
  };

  // ───────── Armazón A ─────────

  const narrow = useNarrow();
  const desktop = useIsDesktop();
  // Qué se ve de la barra lateral: plegada solo desde 761 px, y oculta en Casos (UA-E3 §1 y §2).
  const side = sideLayout({ view, preference: sideCollapsed, desktop });
  // UA2-F1: el encuadre deja libre el HUD (se mide en la tarjeta del lienzo).
  const canvasCardRef = useRef<HTMLElement>(null);
  const docEpoch = useEditorStore(store, (s) => s.docEpoch);
  const { insets: fitInsets, covered: coveredBoxes, compact: hudCompact } = useHudInsets(canvasCardRef, doc, desktop, docEpoch);
  // UA-E6: hasta 760 px el alto del lienzo se mide para que la paleta termine encima del pie fijo.
  useCanvasHeight(canvasCardRef, view === 'canvas');
  const localIssues = useLocalIssues(store);
  const steps = useMemo(() => stepStates(doc, localIssues, pendingDrafts), [doc, localIssues, pendingDrafts]);
  // Un resultado con borradores sin aplicar no es el del modelo que se ve: nunca es «actual» (UA3 A-02, B-01).
  const resultCurrent = engine.current && !hasDrafts;
  // UA-E3 §4: avisos locales y avisos del cálculo actual. Los del cálculo solo cuentan si es el del modelo que se ve.
  const advisories = advisoryCounts(localIssues, resultCurrent && engine.run ? engine.run.report : null);
  // A-03: un fallo del motor (`NoValidSurface`…) llega al chip aunque `engine.message` esté vacío.
  const status = runStatus(
    buildRunStatusInput({
      engineStatus,
      busy: engine.busy,
      run: engine.run,
      current: engine.current,
      pendingDrafts: pendingDrafts.length,
      regions: doc.regions.length,
      localErrors: localIssues.filter((i) => i.severity === 'error').length,
      methodsRequested: doc.analysis.methods?.length ?? 1,
      message: engine.message,
      messageKind: engine.messageKind,
      engineErrorText,
      advisories: advisories.total,
    }),
  );
  const contents = useMemo(() => reportContents(engine.run), [engine.run]);

  // UA-E4: el HUD muestra el error del motor (A-03) con «Ver diagnósticos». La prop `engineError` la declara `ResultSummary` en la rama de C2;
  // va como objeto para compilar también contra la firma anterior.

  // «Ver tabla de resultados» del HUD: abre «Resultados» y enfoca la tabla cuando el panel ya está a la vista.
  const [tableFocus, setTableFocus] = useState(0);
  const showTable = useCallback((): void => {
    onViewChange('results');
    setTableFocus((n) => n + 1);
  }, [onViewChange]);
  useEffect(() => {
    if (tableFocus > 0) focusResultsTable();
  }, [tableFocus]);
  // «Ver avisos» / «Ver diagnósticos» del HUD (UA-E3 §4, A-03): abre «Resultados» y enfoca Diagnósticos.
  const [diagFocus, setDiagFocus] = useState(0);
  const showAdvisories = useCallback((): void => {
    onViewChange('results');
    setDiagFocus((n) => n + 1);
  }, [onViewChange]);
  useEffect(() => {
    if (diagFocus > 0) focusDiagnostics();
  }, [diagFocus]);

  const checkProps = {
    label: checkState.label,
    disabled: checkDisabled,
    title: hasDrafts ? PENDING_DRAFTS_TEXT : 'Ctrl+Intro',
    describedBy: hasDrafts ? 'ea-pending-drafts' : undefined,
    onCheck: () => void onCheck(),
  };
  const reportDisabled = reportBusy || engine.busy || !canExport;

  const undoRedoMenu = (
    <>
      <button type="button" onClick={() => store.undo()} disabled={!canUndo} title="Ctrl+Z">
        Deshacer
      </button>
      <button type="button" onClick={() => store.redo()} disabled={!canRedo} title="Ctrl+Mayús+Z o Ctrl+Y">
        Rehacer
      </button>
    </>
  );

  const chipEl = (
    <span className="gs-chip ua-chip" data-tone={status.tone} title={status.title} data-testid="run-status">
      <span className="ua-chip-text">{status.text}</span>
    </span>
  );
  const menusEl = (
    <div
      className="ua-menus"
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
        <button
          type="button"
          onClick={onSave}
          disabled={hasDrafts}
          title={hasDrafts ? PENDING_DRAFTS_TEXT : 'Ctrl+S'}
          aria-describedby={hasDrafts ? 'ea-pending-drafts' : undefined}
        >
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
        <ExamplePicker cases={cases} onOpen={(key) => void onCase(key)} />
      </DropdownMenu>
      <DropdownMenu label="Exportar">
        <button type="button" onClick={exportResults} disabled={!canExport} title={exportBlockedTitle} aria-describedby={exportDescribedBy}>
          Exportar resultados (CSV)
        </button>
        <button type="button" onClick={exportSlices} disabled={!canExportSurface} title={exportSurfaceTitle} aria-describedby={exportDescribedBy}>
          Exportar dovelas (CSV)
        </button>
        <button type="button" onClick={exportSurface} disabled={!canExportSurface} title={exportSurfaceTitle} aria-describedby={exportDescribedBy}>
          Exportar superficie (CSV)
        </button>
        {engine.run && hasReinforcementForces(engine.run.report.results) ? (
          <button type="button" onClick={exportForces} disabled={!canExport} title={exportBlockedTitle} aria-describedby={exportDescribedBy}>
            Exportar fuerzas de refuerzos (CSV)
          </button>
        ) : null}
      </DropdownMenu>
    </div>
  );

  return (
    <div className="editor-app ua-editor" lang="es" data-testid="editor-app" data-view={view}>
      <LiveRegions polite={live.polite} alert={live.alert} />
      {headerSlots?.chip ? createPortal(chipEl, headerSlots.chip) : null}
      {headerSlots?.menus ? createPortal(menusEl, headerSlots.menus) : null}

      {/* Barra lateral «Modelo»: pasos, panel en línea y pie de acción. En el orden de foco va antes que el área principal. */}
      <aside id="ua-side" className="ua-side" aria-label="Modelo" hidden={side.hidden}>
        <div className="ua-side-head">
          <h2>Modelo</h2>
          <button type="button" ref={hideSideRef} className="gs-icon-btn" aria-label="Contraer panel" aria-expanded="true" aria-controls="ua-side" onClick={() => setSideCollapsed(true)}>
            <IconCollapse size={18} />
          </button>
        </div>
        <StepList order={STEP_ORDER} states={steps} active={tab} onSelect={selectStep}>
          <DocEpochContext.Provider value={docEpoch}>
            <ActivePanel store={store} />
          </DocEpochContext.Provider>
        </StepList>
      </aside>
      <ActionFoot
        check={{ ...checkProps, variant: 'foot' }}
        stale={engine.run !== null && !resultCurrent}
        busy={engine.busy}
        onCancel={engine.cancel}
        engineFailed={engineStatus === 'failed'}
        onRestartEngine={() => client.cancel()}
        reportBusy={reportBusy}
        reportDisabled={reportDisabled}
        reportTitle={exportBlockedTitle}
        reportDescribedBy={exportDescribedBy}
        onReport={() => void onReport()}
        exportHint={side.hidden ? undefined : exportHint}
        hidden={side.hidden}
      />

      <main id="main-content" className="ua-main" tabIndex={-1} data-side={side.hidden ? 'collapsed' : 'open'}>
        <div className="ua-notices">
          {sessionBanners}
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
        </div>

        <div className="ua-main-head">
          {!headerSlots?.chip || !headerSlots?.menus ? (
            <div className="ua-inline-header">
              {headerSlots?.chip ? null : chipEl}
              {headerSlots?.menus ? null : menusEl}
            </div>
          ) : null}
          <div className="ua-title">
            {side.collapsed ? (
              <button type="button" ref={showSideRef} className="gs-btn ua-show-side" aria-expanded="false" aria-controls="ua-side" onClick={() => setSideCollapsed(false)}>
                <span className="ua-flip" aria-hidden="true">
                  <IconCollapse size={16} />
                </span>
                <span>Mostrar panel</span>
              </button>
            ) : null}
            <h2>{viewTitle(view)}</h2>
            {view === 'cases' ? (
              <span className="ua-spacer" />
            ) : (
              // El rótulo ocupa el lugar del espaciador: ni agrega alto ni empuja nada (con 320 px se recorta con puntos suspensivos).
              <span className="ua-spacer ua-doc-label" data-testid="doc-label" title={docLabel}>
                {docLabel}
              </span>
            )}
            {side.collapsed ? <CollapsedActions check={checkProps} busy={engine.busy} onCancel={engine.cancel} engineFailed={engineStatus === 'failed'} onRestartEngine={() => client.cancel()} /> : null}
            {view === 'cases' ? null : narrow ? (
              // Con 480 px o menos, Deshacer y Rehacer se pliegan en un menú «Editar» (B-09). Las herramientas viven en la paleta.
              <div className="ua-edit" role="group" aria-label="Edición">
                <DropdownMenu label={editMenuLabel()}>{undoRedoMenu}</DropdownMenu>
              </div>
            ) : (
              <div className="ua-edit" role="group" aria-label="Edición">
                <button type="button" className="gs-icon-btn" onClick={() => store.undo()} disabled={!canUndo} title="Ctrl+Z" aria-label="Deshacer" aria-keyshortcuts="Control+Z">
                  <IconUndo size={18} />
                </button>
                <button type="button" className="gs-icon-btn" onClick={() => store.redo()} disabled={!canRedo} title="Ctrl+Mayús+Z o Ctrl+Y" aria-label="Rehacer" aria-keyshortcuts="Control+Y">
                  <IconRedo size={18} />
                </button>
              </div>
            )}
          </div>
          {/* Con la barra plegada el pie no se ve: la pista de bloqueo vive aquí (UA-E3 §2). En Casos no hay pista: el pie y el aviso son del editor. */}
          {side.collapsed && exportHint ? <ExportHint text={exportHint} /> : null}
          <ViewTabs view={view} onChange={onViewChange} />
        </div>

        {/* Los cuatro paneles permanecen montados: al volver a «Lienzo» se conservan el modelo, el historial, el trazo y la vista. */}
        <div className="ua-panels">
          <div id="mode-edit-panel" className="ua-view ua-view-canvas" role="tabpanel" aria-labelledby="mode-edit" hidden={view !== 'canvas'}>
            <section className="ua-canvas-card" aria-label="Sección del modelo" ref={canvasCardRef} data-hud-compact={hudCompact ? 'true' : undefined}>
              <div className="ea-canvas ua-canvas" data-testid="editor-canvas">
                <EditorCanvas
                  store={store}
                  result={canvasResult}
                  {...canvasContract}
                  paletteTools={<PaletteTools tool={tool} onSelect={(t) => void switchTool(t)} />}
                  fitInsets={fitInsets}
                  coveredBoxes={coveredBoxes}
                />
              </div>
              {/* El HUD y la leyenda se colocan solos sobre la tarjeta (posicionada): `resultSummary.css` y `legend.css`. */}
              <ResultSummary run={engine.run} current={engine.current} hasPendingDrafts={hasDrafts} busy={engine.busy} shownMethod={shownMethod ?? shown?.method ?? null} onShowTable={showTable} compact={hudCompact} localAdvisories={advisories.local} onShowAdvisories={showAdvisories} engineError={engineErrorText} />
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
            </section>
            {(engine.run && !engine.current) || (canvasResult && shown) ? (
              <div className="ua-canvas-notes">
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
              </div>
            ) : null}
          </div>

          <div id="view-results-panel" className="ua-view" role="tabpanel" aria-labelledby="view-results" hidden={view !== 'results'}>
            <ResultsView
              run={engine.run}
              current={engine.current}
              hasDrafts={hasDrafts}
              shownMethod={shownMethod ?? shown?.method ?? null}
              onShowMethod={chooseMethod}
              diagnostics={
                <DiagnosticsPanel
                  store={store}
                  onNavigate={navigateIssue}
                  resultInfo={engine.run ? <CrackSummary report={engine.run.report} tensionCrack={engine.run.doc.analysis.tension_crack} units={engine.run.doc.units} /> : undefined}
                />
              }
            />
          </div>

          <div id="mode-cases-panel" className="ua-view" role="tabpanel" aria-labelledby="mode-cases" hidden={view !== 'cases'}>
            <div className="ua-scroll">{casesView}</div>
          </div>

          <div id="view-report-panel" className="ua-view" role="tabpanel" aria-labelledby="view-report" hidden={view !== 'report'}>
            <ReportView
              title={reportDocTitle(doc.meta.title, doc.meta.id)}
              notice={reportNotice({ hasRun: engine.run !== null, current: engine.current, hasDrafts, draftsText: PENDING_DRAFTS_TEXT, staleText: exportHintText })}
              contents={contents}
              hasRun={engine.run !== null}
              reportBusy={reportBusy}
              reportDisabled={reportDisabled}
              reportTitle={exportBlockedTitle}
              onReport={() => void onReport()}
              csvDisabled={!canExport}
              onCsv={exportResults}
              onEditTitle={editTitle}
            />
          </div>
        </div>
      </main>

      <footer className="ua-status">
        <p className="ea-status ua-status-file" data-testid="file-status">
          <strong>{documentTitle({ fileName, title: doc.meta.title, example: isExample })}</strong>{' '}
          {fileStatusText({ dirty, pendingDraftCount: pendingDrafts.length, busy: engine.busy })}
        </p>
        {checkState.status && (
          <p className="ea-engine-status ua-status-item" data-testid="engine-status">
            {checkState.status}
          </p>
        )}
        {hasDrafts && (
          <p id="ea-pending-drafts" className="ea-export-hint ep-error ua-status-item" role="status" data-testid="pending-drafts-hint">
            {pendingDraftsNotice(pendingDrafts)}
          </p>
        )}
        <p className="ua-status-item ua-status-tool">{toolStatusText(tool)}</p>
        <span className="ua-spacer" />
        {engineSlot}
      </footer>

      <input ref={openRef} type="file" accept=".json,.ogs.json,application/json" hidden data-testid="file-open" onChange={(e) => void onOpenFile(e)} />
      <input ref={dxfRef} type="file" accept=".dxf" hidden data-testid="file-dxf" onChange={(e) => void onDxfFile(e)} />
      <input ref={csvRef} type="file" accept=".csv,text/csv" hidden data-testid="file-csv" onChange={(e) => void onCsvFile(e)} />

      {slopeOpen && <NewSlopeDialog initialUnits={isImperialUnits(doc.units) ? 'imperial' : 'SI'} onCancel={() => setSlopeOpen(false)} onCreate={onCreateSlope} />}
      {dxf && (
        <DxfImportDialog
          fileName={dxf.fileName}
          result={dxf.result}
          materials={doc.materials}
          units={doc.units}
          base={{ regionCount: doc.regions.length, title: doc.meta?.title ?? null, pristineStart }}
          onCancel={() => setDxf(null)}
          onApply={(plan, mode, fresh) => applyRegions(plan, mode, dxf.fileName, fresh)}
        />
      )}
      {csv && (
        <CsvImportDialog
          fileName={csv.fileName}
          result={csv.result}
          materials={doc.materials}
          units={doc.units}
          base={{ regionCount: doc.regions.length, title: doc.meta?.title ?? null, pristineStart }}
          onCancel={() => setCsv(null)}
          onApplyRegions={(plan, mode, fresh) => applyRegions(plan, mode, csv.fileName, fresh)}
          onApplyPiezo={(points) => {
            applyPiezoImport(store, points);
            backToCanvas();
            notify('info', `${csv.fileName}: piezométrica importada (${points.length} puntos). Se deshace con Ctrl+Z.`);
            setCsv(null);
          }}
        />
      )}
    </div>
  );
}
