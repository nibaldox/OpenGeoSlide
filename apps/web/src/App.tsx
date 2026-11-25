import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import './App.css';
import { checkModel, convergedFos, evaluateCheck, parseUploadedCase, runModel, summarizeTimes, type TimeSummary } from './analysis/runner';
import { loadBuiltinCases, type CaseEntry } from './cases';
import { getEngineClient, type AnalyzeResult, type EngineClient } from './engine/client';
import { userMessage } from './engine/errors';
import type { EngineInfo } from './engine/protocol';
import type { AnalysisReport, MethodKind, Model, VerificationCheck } from './engine/types';
import { EditorApp } from './editor/EditorApp';
import { buildScene } from './render/scene';
import { SectionCanvas } from './render/SectionCanvas';
import { CheckTable, type CheckRow } from './ui/CheckTable';
import { Legend } from './ui/Legend';
import { ThemeSelect } from './ui/ThemeSelect';
import { MAX_PERF_RUNS, PerformancePanel } from './ui/PerformancePanel';
import { METHOD_LABELS, ResultsTable } from './ui/ResultsTable';

const ALL_METHODS: MethodKind[] = ['bishop', 'spencer'];

interface RunResult {
  report: AnalysisReport;
  elapsedMs: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describeAnalysis(model: Model): string {
  const parts: string[] = [];
  if (model.analysis.search) parts.push('búsqueda de superficie crítica');
  else if (model.analysis.surface) parts.push('superficie fija');
  parts.push(`${model.materials.length} material(es)`);
  parts.push(`${model.regions.length} región(es)`);
  if (model.water?.piezometric_line?.length) parts.push('con piezométrica');
  else parts.push('sin agua');
  return parts.join(' · ');
}

/** Vista de los casos de verificación publicados con su comprobación (sin cambios de comportamiento). */
function CasesView({ client, info }: { client: EngineClient; info: EngineInfo | null }) {
  const [cases, setCases] = useState<CaseEntry[]>(loadBuiltinCases);
  // Vacío hasta elegir: current cae en el primer caso.
  const [caseKey, setCaseKey] = useState<string>('');
  const [methods, setMethods] = useState<Record<MethodKind, boolean>>({ bishop: true, spencer: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunResult | null>(null);
  const [shownMethod, setShownMethod] = useState<MethodKind | null>(null);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [perfRuns, setPerfRuns] = useState(10);
  const [perf, setPerf] = useState<TimeSummary | null>(null);

  const current: CaseEntry = cases.find((c) => c.key === caseKey) ?? cases[0];
  const selectedMethods = ALL_METHODS.filter((m) => methods[m]);

  const shownResult = run?.report.results.find((r) => r.method === shownMethod) ?? run?.report.results[0] ?? null;
  const scene = useMemo(
    () => (run && current ? buildScene(current.caseData.model, shownResult) : null),
    [run, current, shownResult],
  );

  function resetOutputs() {
    setRun(null);
    setChecks([]);
    setPerf(null);
    setShownMethod(null);
  }

  function selectCase(key: string) {
    setCaseKey(key);
    resetOutputs();
    setError(null);
  }

  async function runCheck(model: Model, check: VerificationCheck): Promise<CheckRow> {
    try {
      const { report } = await client.analyze(JSON.stringify(checkModel(model, check)));
      const fos = convergedFos(report.results[0]);
      const outcome = evaluateCheck(check, fos);
      return {
        check,
        fos: outcome.fos,
        errorRel: outcome.errorRel,
        ok: outcome.ok,
        message: fos === null ? 'El método no convergió: no se reporta FS para esta comprobación.' : undefined,
      };
    } catch (err) {
      return { check, fos: null, errorRel: null, ok: false, message: userMessage(err) };
    }
  }

  async function calcular() {
    if (!current) return;
    if (selectedMethods.length === 0) {
      setError('Seleccione al menos un método.');
      return;
    }
    setBusy(true);
    setError(null);
    setPerf(null);
    setChecks([]);
    try {
      const model = current.caseData.model;
      const result: AnalyzeResult = await client.analyze(JSON.stringify(runModel(model, selectedMethods)));
      setRun({ report: result.report, elapsedMs: result.elapsed_ms });
      setShownMethod(result.report.results[0]?.method ?? null);

      const rows: CheckRow[] = [];
      for (const check of current.caseData.checks ?? []) {
        rows.push(await runCheck(model, check));
      }
      setChecks(rows);
    } catch (err) {
      setRun(null);
      setError(userMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function medir() {
    if (!current) return;
    if (selectedMethods.length === 0) {
      setError('Seleccione al menos un método.');
      return;
    }
    const n = Math.min(MAX_PERF_RUNS, Math.max(1, Math.round(perfRuns) || 1));
    const json = JSON.stringify(runModel(current.caseData.model, selectedMethods));
    setBusy(true);
    setError(null);
    try {
      const times: number[] = [];
      for (let i = 0; i < n; i++) {
        const result = await client.analyze(json);
        times.push(result.elapsed_ms);
      }
      setPerf(summarizeTimes(times));
    } catch (err) {
      setError(userMessage(err));
    } finally {
      setBusy(false);
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
      <main className="layout">
        <aside className="sidebar">
          <section className="panel" aria-labelledby="controls-title">
            <h2 id="controls-title">Análisis</h2>
            <label className="field">
              Caso
              <select value={current?.key} onChange={(e) => selectCase(e.target.value)}>
                {cases.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Cargar modelo o caso (.json)
              <input type="file" accept=".json,application/json" onChange={onFile} />
            </label>
            {current && <p className="muted small">{describeAnalysis(current.caseData.model)}</p>}

            <fieldset className="field">
              <legend>Métodos</legend>
              {ALL_METHODS.map((m) => (
                <label key={m} className="checkbox">
                  <input
                    type="checkbox"
                    checked={methods[m]}
                    onChange={(e) => setMethods((prev) => ({ ...prev, [m]: e.target.checked }))}
                  />
                  {METHOD_LABELS[m]}
                </label>
              ))}
            </fieldset>

            <button type="button" className="primary" onClick={calcular} disabled={busy || !info}>
              {busy ? 'Calculando…' : 'Calcular'}
            </button>
          </section>

          <PerformancePanel
            summary={perf}
            runs={perfRuns}
            busy={busy || !info}
            onRunsChange={setPerfRuns}
            onMeasure={medir}
          />
        </aside>

        <div className="content">
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
                <Legend scene={scene} />
                {shownResult && (
                  <p className="small muted">
                    Superficie mostrada: {METHOD_LABELS[shownResult.method]}
                    {shownResult.search ? ' (superficie crítica de la búsqueda)' : ' (superficie fija)'}
                  </p>
                )}
              </>
            ) : (
              <p className="muted">Pulse «Calcular» para ver la sección con la superficie crítica y las dovelas.</p>
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
      </main>
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

  return (
    <div className="app" lang="es">
      <header className="app-header">
        <h1>OpenGeoSlide</h1>
        <p className="muted">Estabilidad de taludes 2D: superficies de deslizamiento por Bishop y Spencer</p>
        <ThemeSelect />
        <div className="mode-tabs" role="tablist" aria-label="Modo de la aplicación">
          <button type="button" role="tab" id="mode-edit" aria-selected={mode === 'edit'} aria-controls="mode-edit-panel" className={mode === 'edit' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setMode('edit')}>
            Editar
          </button>
          <button type="button" role="tab" id="mode-cases" aria-selected={mode === 'cases'} aria-controls="mode-cases-panel" className={mode === 'cases' ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setMode('cases')}>
            Casos de verificación
          </button>
        </div>
      </header>

      {simulated && (
        <div className="banner banner-sim" role="status">
          <strong>Motor simulado.</strong> Los resultados son aproximados (Fellenius, 30 dovelas) y no provienen de ogs-core.
          {info?.fallback_reason ? <span className="small"> Motivo: {info.fallback_reason}.</span> : null}
        </div>
      )}
      {info && !simulated && (
        <div className="banner banner-ok" role="status" data-testid="engine-banner">
          Motor: ogs-core {info.version} (WASM)
        </div>
      )}
      {!info && !engineError && <div className="banner" role="status">Cargando el motor…</div>}
      {engineError && (
        <div className="banner banner-error" role="alert">
          {engineError}
        </div>
      )}

      {/* Ambos modos permanecen montados: al volver a «Editar» se conservan el modelo, el historial y los resultados. */}
      <div id="mode-edit-panel" role="tabpanel" aria-labelledby="mode-edit" hidden={mode !== 'edit'}>
        <EditorApp client={client} />
      </div>
      <div id="mode-cases-panel" role="tabpanel" aria-labelledby="mode-cases" hidden={mode !== 'cases'}>
        <CasesView client={client} info={info} />
      </div>
    </div>
  );
}
