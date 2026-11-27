import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import './App.css';
import './ui/targets.css';
import { blockedMessage, caseBlockers } from './analysis/caseGate';
import { checkModel, parseUploadedCase, runModel, summarizeTimes, type TimeSummary } from './analysis/runner';
import { loadBuiltinCases, type CaseEntry } from './cases';
import { EngineCancelledError, getEngineClient, type AnalyzeResult, type EngineClient } from './engine/client';
import { userMessage } from './engine/errors';
import type { EngineInfo } from './engine/protocol';
import type { AnalysisReport, MethodKind, Model, VerificationCheck } from './engine/types';
import { EditorApp } from './editor/EditorApp';
import { resultCaption } from './editor/app/reportInput';
import { lengthUnitOf } from './editor/canvas/layout';
import { createRunGuard } from './editor/app/runGuard';
import { METHOD_ORDER, methodDisabledReason } from './editor/panels/forms';
import { engineModel } from './io/ogsJson';
import { GuidedTour } from './onboarding/GuidedTour';
import { autoOpenTour, initialTour, tourReducer } from './onboarding/tour';
import { buildScene } from './render/scene';
import { SectionCanvas } from './render/SectionCanvas';
import { CheckTable } from './ui/CheckTable';
import { checkRowFromResult, type CheckRow } from './ui/checkRow';
import { ConfirmHost } from './ui/ConfirmDialog';
import { HelpDialog } from './ui/HelpDialog';
import { InstallButton } from './ui/InstallButton';
import { Legend } from './ui/Legend';
import { EngineIndicator } from './ui/EngineIndicator';
import { ThemeSelect } from './ui/ThemeSelect';
import { useRovingTabIndex } from './ui/useRovingTabIndex';
import { MAX_PERF_RUNS, PerformancePanel } from './ui/PerformancePanel';
import { METHOD_LABELS, ResultsTable } from './ui/ResultsTable';

/** Los cinco métodos de la vista Casos, en el orden del editor (F3.9). */
const ALL_METHODS: readonly MethodKind[] = METHOD_ORDER;

/** Selección inicial de métodos en Casos de verificación. */
export const DEFAULT_CASE_METHODS: Readonly<Record<MethodKind, boolean>> = {
  bishop: true,
  spencer: true,
  morgenstern_price: false,
  janbu_simplified: false,
  janbu_corrected: false,
};

/** Métodos efectivos que pide Casos con la selección dada, omitiendo Bishop si no aplica (polilínea fija o búsqueda no circular, F3.6 / F6.4). */
export function effectiveCaseMethods(model: Model, selection: Readonly<Record<MethodKind, boolean>> = DEFAULT_CASE_METHODS): MethodKind[] {
  const bishopBlocked = methodDisabledReason('bishop', model.analysis) !== null;
  return ALL_METHODS.filter((m) => selection[m] && !(m === 'bishop' && bishopBlocked));
}

/** Texto de avance durante un cálculo largo en Casos de verificación (R15B-11). */
export function formatCasesProgress(elapsedSeconds: number, activeMethod?: MethodKind | null): string {
  const secs = Math.max(0, Math.floor(elapsedSeconds));
  return activeMethod ? `Comprobando ${METHOD_LABELS[activeMethod]}… (${secs} s)` : `Comprobando… (${secs} s)`;
}

interface RunResult {
  report: AnalysisReport;
  elapsedMs: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function describeAnalysis(model: Model): string {
  const parts: string[] = [];
  if (model.analysis.search) {
    parts.push(model.analysis.search.non_circular ? 'búsqueda de superficie crítica (no circular)' : 'búsqueda de superficie crítica');
  } else if (model.analysis.surface) parts.push(model.analysis.surface.type === 'polyline' ? 'superficie fija (polilínea)' : 'superficie fija');
  parts.push(`${model.materials.length} material(es)`);
  parts.push(`${model.regions.length} región(es)`);
  // E15l-18: el agua de la grieta (`water_fill > 0`) también es agua.
  const crackWater = (model.analysis.tension_crack?.water_fill ?? 0) > 0;
  if (model.water?.piezometric_line?.length) parts.push('con piezométrica');
  if (crackWater) parts.push('con agua en la grieta');
  if (!model.water?.piezometric_line?.length && !crackWater) parts.push('sin agua');
  return parts.join(' · ');
}

/** Vista de los casos de verificación publicados con su comprobación (sin cambios de comportamiento). */
function CasesView({ client, info }: { client: EngineClient; info: EngineInfo | null }) {
  const [cases, setCases] = useState<CaseEntry[]>(loadBuiltinCases);
  // Vacío hasta elegir: current cae en el primer caso.
  const [caseKey, setCaseKey] = useState<string>('');
  const [methods, setMethods] = useState<Record<MethodKind, boolean>>(() => ({ ...DEFAULT_CASE_METHODS }));
  const [busy, setBusy] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [activeMethod, setActiveMethod] = useState<MethodKind | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunResult | null>(null);
  const [shownMethod, setShownMethod] = useState<MethodKind | null>(null);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [perfRuns, setPerfRuns] = useState(10);
  const [perf, setPerf] = useState<TimeSummary | null>(null);
  const engineStatus = useSyncExternalStore(
    useCallback((listener: () => void) => client.subscribe(listener), [client]),
    () => client.getStatus(),
    () => client.getStatus(),
  );

  // Token de solicitud y AbortController: descarta respuestas tardías y permite cancelar cálculos largos (R7-09, R15B-11).
  const guard = useRef(createRunGuard()).current;
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!busy) {
      setElapsedSec(0);
      return;
    }
    const start = Date.now();
    setElapsedSec(0);
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const current: CaseEntry = cases.find((c) => c.key === caseKey) ?? cases[0];
  // F3.6 / F6.4: con una polilínea fija o búsqueda no circular, Bishop no se ofrece ni se pide aunque haya quedado marcado.
  const bishopReason = current ? methodDisabledReason('bishop', current.caseData.model.analysis) : null;
  const bishopBlocked = bishopReason !== null;
  const methodOff = (m: MethodKind): boolean => m === 'bishop' && bishopBlocked;
  const selectedMethods = current ? effectiveCaseMethods(current.caseData.model, methods) : [];

  const shownResult = run?.report.results.find((r) => r.method === shownMethod) ?? run?.report.results[0] ?? null;
  const scene = useMemo(
    () => (run && current ? buildScene(current.caseData.model, shownResult) : null),
    [run, current, shownResult],
  );

  function resetOutputs() {
    abortRef.current?.abort();
    abortRef.current = null;
    guard.invalidate();
    setBusy(false);
    setActiveMethod(null);
    setNotice(null);
    setRun(null);
    setChecks([]);
    setPerf(null);
    setShownMethod(null);
  }

  function cancelar() {
    if (!busy) return;
    abortRef.current?.abort();
    abortRef.current = null;
    guard.invalidate();
    client.cancel();
    setBusy(false);
    setActiveMethod(null);
    setNotice('Cálculo cancelado.');
  }

  function selectCase(key: string) {
    setCaseKey(key);
    resetOutputs();
    setError(null);
  }

  async function runCheck(model: Model, check: VerificationCheck, signal: AbortSignal): Promise<CheckRow | null> {
    if (signal.aborted) return null;
    try {
      const { report } = await client.analyze(JSON.stringify(engineModel(checkModel(model, check))));
      if (signal.aborted) return null;
      return checkRowFromResult(check, report.results[0]);
    } catch (err) {
      if (signal.aborted || err instanceof EngineCancelledError) return null;
      return { check, fos: null, errorRel: null, ok: false, message: userMessage(err) };
    }
  }

  async function calcular() {
    if (!current || engineStatus !== 'ready') return;
    if (selectedMethods.length === 0) {
      setError('Seleccione al menos un método.');
      return;
    }
    // R9-03a: la misma validación local que el editor; un error (p. ej. γw imperial ausente o < 20 pcf) impide calcular.
    const blockers = caseBlockers(current.caseData.model);
    if (blockers.length > 0) {
      guard.invalidate();
      setRun(null);
      setChecks([]);
      setPerf(null);
      setError(blockedMessage(blockers));
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const id = guard.next();
    setBusy(true);
    setActiveMethod(selectedMethods.length === 1 ? selectedMethods[0]! : null);
    setNotice(null);
    setError(null);
    setPerf(null);
    setChecks([]);
    try {
      const model = current.caseData.model;
      const result: AnalyzeResult = await client.analyze(JSON.stringify(engineModel(runModel(model, selectedMethods))));
      if (ac.signal.aborted || !guard.isCurrent(id)) return;
      setRun({ report: result.report, elapsedMs: result.elapsed_ms });
      setShownMethod(result.report.results[0]?.method ?? null);

      const rows: CheckRow[] = [];
      for (const check of current.caseData.checks ?? []) {
        if (ac.signal.aborted || !guard.isCurrent(id)) return;
        setActiveMethod(check.method);
        const row = await runCheck(model, check, ac.signal);
        if (row === null || ac.signal.aborted || !guard.isCurrent(id)) return;
        rows.push(row);
      }
      setChecks(rows);
    } catch (err) {
      if (ac.signal.aborted || !guard.isCurrent(id) || err instanceof EngineCancelledError) return;
      setRun(null);
      setError(userMessage(err));
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      if (guard.isCurrent(id)) {
        setBusy(false);
        setActiveMethod(null);
      }
    }
  }

  async function medir() {
    if (!current || engineStatus !== 'ready') return;
    if (selectedMethods.length === 0) {
      setError('Seleccione al menos un método.');
      return;
    }
    const blockers = caseBlockers(current.caseData.model);
    if (blockers.length > 0) {
      setError(blockedMessage(blockers));
      return;
    }
    const n = Math.min(MAX_PERF_RUNS, Math.max(1, Math.round(perfRuns) || 1));
    const json = JSON.stringify(engineModel(runModel(current.caseData.model, selectedMethods)));
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const id = guard.next();
    setBusy(true);
    setActiveMethod(selectedMethods.length === 1 ? selectedMethods[0]! : null);
    setNotice(null);
    setError(null);
    try {
      const times: number[] = [];
      for (let i = 0; i < n; i++) {
        if (ac.signal.aborted || !guard.isCurrent(id)) return;
        const result = await client.analyze(json);
        if (ac.signal.aborted || !guard.isCurrent(id)) return;
        times.push(result.elapsed_ms);
      }
      setPerf(summarizeTimes(times));
    } catch (err) {
      if (ac.signal.aborted || !guard.isCurrent(id) || err instanceof EngineCancelledError) return;
      setError(userMessage(err));
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      if (guard.isCurrent(id)) {
        setBusy(false);
        setActiveMethod(null);
      }
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const data = parseUploadedCase(await file.text(), file.name);
      const key = `upload:${file.name}:${Date.now()}`;
      setCases((prev) => [...prev, { key, label: `${data.id}: ${data.title} (archivo)`, caseData: data }]);
      setCaseKey(key);
      resetOutputs();
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="cases-view">
      <div className="layout">
        <aside className="sidebar">
          <section className="panel" aria-labelledby="controls-title">
            <h2 id="controls-title">Análisis</h2>
            <label className="field">
              Caso
              <select value={current?.key} disabled={busy} onChange={(e) => selectCase(e.target.value)}>
                {cases.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Cargar modelo o caso (.json)
              <input type="file" accept=".json,application/json" disabled={busy} onChange={onFile} />
            </label>
            {current && <p className="muted small">{describeAnalysis(current.caseData.model)}</p>}

            <fieldset className="field">
              <legend>Métodos</legend>
              {ALL_METHODS.map((m) => (
                <label key={m} className="checkbox">
                  <input
                    type="checkbox"
                    checked={methods[m] && !methodOff(m)}
                    disabled={methodOff(m)}
                    aria-describedby={methodOff(m) ? 'cases-bishop-note' : undefined}
                    onChange={(e) => setMethods((prev) => ({ ...prev, [m]: e.target.checked }))}
                  />
                  {METHOD_LABELS[m]}
                </label>
              ))}
              {bishopBlocked && (
                <p id="cases-bishop-note" className="muted small">
                  {bishopReason}
                </p>
              )}
            </fieldset>

            <div className="ep-actions">
              <button type="button" className="primary" onClick={calcular} disabled={busy || !info || engineStatus !== 'ready'}>
                {busy ? 'Comprobando…' : 'Comprobar caso'}
              </button>
              {busy && (
                <button type="button" onClick={cancelar} title="Termina el cálculo y reinicia el motor" data-testid="cases-cancel">
                  Cancelar
                </button>
              )}
            </div>
            {busy && (
              <p className="muted small" role="status" data-testid="cases-progress">
                {formatCasesProgress(elapsedSec, activeMethod)}
              </p>
            )}
          </section>

          <PerformancePanel
            summary={perf}
            runs={perfRuns}
            busy={busy || !info || engineStatus !== 'ready'}
            onRunsChange={setPerfRuns}
            onMeasure={medir}
          />
        </aside>

        <div className="content">
          {notice && (
            <div className="banner" role="status" data-testid="cases-notice">
              {notice}
            </div>
          )}
          {error && (
            <div className="banner banner-error" role="alert">
              {error}
            </div>
          )}

          <section className="panel" aria-labelledby="section-title">
            <h2 id="section-title">Sección</h2>
            {scene ? (
              <>
                <SectionCanvas scene={scene} />
                <Legend scene={scene} options={{ unconverged: shownResult !== null && shownResult.status !== 'converged', invalid: shownResult?.status === 'invalid', fixedCircle: shownResult !== null && !shownResult.search, piezoExtrapolated: scene.piezoExtension != null }} />
                {shownResult && (
                  <p className={shownResult.status === 'converged' ? 'small muted' : 'small ea-caption-unconverged'} data-testid="result-caption">
                    Superficie mostrada: {METHOD_LABELS[shownResult.method]}
                    {shownResult.search ? ' (de la búsqueda)' : ' (superficie fija)'}. {resultCaption(shownResult.method, shownResult.status, !shownResult.search)}
                  </p>
                )}
              </>
            ) : (
              <p className="muted">Pulse «Comprobar caso» para ver la sección con la superficie crítica y las dovelas.</p>
            )}
          </section>

          {run && (
            <section className="panel" aria-labelledby="results-title">
              <h2 id="results-title">Resultados</h2>
              <ResultsTable
                report={run.report}
                elapsedMs={run.elapsedMs}
                shownMethod={shownMethod}
                onShowMethod={setShownMethod}
                lengthUnit={lengthUnitOf(current?.caseData.model.units)}
                reinforcements={current?.caseData.model.reinforcements}
                tensionCrack={current?.caseData.model.analysis.tension_crack}
              />
            </section>
          )}

          {checks.length > 0 && (
            <section className="panel" aria-labelledby="checks-title">
              <h2 id="checks-title">Verificación</h2>
              <p className="small muted">
                Comparación con el valor publicado. Criterio: |FS − publicado| / publicado ≤ tolerancia.
              </p>
              <CheckTable rows={checks} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

type Mode = 'edit' | 'cases';

export default function App() {
  const client = useMemo(() => getEngineClient(), []);
  const [info, setInfo] = useState<EngineInfo | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('edit');

  useEffect(() => {
    let alive = true;
    client
      .info()
      .then((data) => {
        if (alive) setInfo(data);
      })
      .catch((err: unknown) => {
        if (alive) setEngineError(userMessage(err));
      });
    return () => {
      alive = false;
    };
  }, [client]);

  const simulated = info?.name === 'mock';

  // Guía de primera visita y ayuda (UX-12). La guía no es modal: se abre sola solo la primera vez (`ogs.onboarding.v1`) y se
  // reabre desde «Ayuda ▸ Recorrido guiado».
  const [tour, dispatchTour] = useReducer(tourReducer, undefined, initialTour);
  const [tourFocus, setTourFocus] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      /* sin almacenamiento */
    }
    if (autoOpenTour(storage, { editing: mode === 'edit' })) {
      setTourFocus(false);
      dispatchTour({ type: 'open' });
    }
  }, [mode]);
  // La guía señala controles del editor: en «Casos de verificación» no tiene destino y se cierra.
  useEffect(() => {
    if (mode !== 'edit') dispatchTour({ type: 'skip' });
  }, [mode]);
  const skipTour = useCallback(() => dispatchTour({ type: 'skip' }), []);
  const nextStep = useCallback(() => dispatchTour({ type: 'next' }), []);
  const prevStep = useCallback(() => dispatchTour({ type: 'prev' }), []);
  const helpFallback = useCallback(() => helpButtonRef.current, []);
  const startTourFromHelp = (): void => {
    setHelpOpen(false);
    setTourFocus(true);
    dispatchTour({ type: 'open' });
  };
  const modeTabsRef = useRef<HTMLDivElement>(null);
  const modeKeys = useRovingTabIndex(modeTabsRef, { selector: '[role="tab"]', orientation: 'horizontal', activateOnFocus: true });

  return (
    <div className="app" lang="es">
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <header className="app-header">
        <div className="app-brand">
          <h1>OpenGeoSlide</h1>
          <p className="muted">Estabilidad de taludes 2D: superficies de deslizamiento por Bishop, Spencer, Morgenstern-Price y Janbu</p>
        </div>
        <div className="mode-tabs" role="tablist" aria-label="Modo de la aplicación" ref={modeTabsRef} onKeyDown={modeKeys.onKeyDown}>
          <button type="button" role="tab" id="mode-edit" aria-selected={mode === 'edit'} aria-controls="mode-edit-panel" className={mode === 'edit' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setMode('edit')}>
            Editar
          </button>
          <button type="button" role="tab" id="mode-cases" aria-selected={mode === 'cases'} aria-controls="mode-cases-panel" className={mode === 'cases' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setMode('cases')}>
            Casos de verificación
          </button>
        </div>
        <div className="app-header-tools">
          <EngineIndicator info={info} error={engineError} />
          <InstallButton />
          <button
            type="button"
            ref={helpButtonRef}
            className="help-button"
            aria-haspopup="dialog"
            onClick={() => {
              skipTour();
              setHelpOpen(true);
            }}
          >
            Ayuda
          </button>
          <ThemeSelect />
        </div>
      </header>

      {/* Justo después de la cabecera en el orden de tabulación: la guía no mueve el foco al abrirse sola. */}
      <GuidedTour open={tour.open && mode === 'edit'} index={tour.index} focusOnOpen={tourFocus} onNext={nextStep} onPrev={prevStep} onSkip={skipTour} fallbackFocus={helpFallback} />

      {/* El estado normal del motor es el indicador compacto de la cabecera; el modo simulado y los fallos de carga siguen visibles con su explicación. */}
      {simulated && (
        <div className="banner banner-sim" role="status">
          <strong>Motor simulado.</strong> Los resultados son aproximados (Fellenius, 30 dovelas) y no provienen de ogs-core.
          {info?.fallback_reason ? <span className="small"> Motivo: {info.fallback_reason}.</span> : null}
        </div>
      )}
      {engineError && (
        <div className="banner banner-error" role="alert">
          {engineError}
        </div>
      )}

      {/* Ambos modos permanecen montados: al volver a «Editar» se conservan el modelo, el historial y los resultados. */}
      <main id="main-content" tabIndex={-1}>
        <div id="mode-edit-panel" role="tabpanel" aria-labelledby="mode-edit" hidden={mode !== 'edit'}>
          <EditorApp client={client} active={mode === 'edit'} />
        </div>
        <div id="mode-cases-panel" role="tabpanel" aria-labelledby="mode-cases" hidden={mode !== 'cases'}>
          <CasesView client={client} info={info} />
        </div>
      </main>

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} onStartTour={startTourFromHelp} />}
      {/* Único anfitrión de `useConfirm()`: todas las confirmaciones de la aplicación pasan por aquí. */}
      <ConfirmHost />
    </div>
  );
}
