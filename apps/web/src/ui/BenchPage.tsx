// Página de benchmark (/?bench=1). Ejecuta el caso V047a en el worker con el motor wasm, para Bishop y
// Spencer, y deja el resultado en <pre id="bench-result"> y en window.__OGS_BENCH__. Lo lee bench/chrome/run.mjs.

import { useEffect, useRef, useState } from 'react';
import {
  BENCH_CASE_ID,
  BENCH_METHODS,
  BENCH_REPS,
  BENCH_WARMUP_RUNS,
  makeBenchRecord,
  type BenchRecord,
} from '../analysis/bench';
import { runModel } from '../analysis/runner';
import { loadBuiltinCases } from '../cases';
import { getEngineClient, type AnalyzeResult } from '../engine/client';
import { METHOD_LABELS } from './ResultsTable';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

declare global {
  interface Window {
    __OGS_BENCH__?: BenchRecord[] | { error: string };
  }
}

async function runBench(setStatus: (text: string) => void): Promise<BenchRecord[]> {
  const entry = loadBuiltinCases().find((c) => c.caseData.id === BENCH_CASE_ID);
  if (!entry) throw new Error(`No se encontró el caso ${BENCH_CASE_ID} en verification/cases.`);

  const client = getEngineClient();
  const info = await client.info();
  if (info.name !== 'ogs-wasm') {
    throw new Error(`El motor activo es «${info.name}», no ogs-wasm. ${info.fallback_reason ?? ''}`.trim());
  }

  const records: BenchRecord[] = [];
  for (const method of BENCH_METHODS) {
    const model = runModel(entry.caseData.model, [method]);
    if (!model.analysis.search || model.analysis.surface) {
      throw new Error(`El caso ${BENCH_CASE_ID} debe analizarse en modo búsqueda.`);
    }
    const json = JSON.stringify(model);
    for (let i = 0; i < BENCH_WARMUP_RUNS; i++) {
      setStatus(`${METHOD_LABELS[method]}: calentamiento`);
      await client.analyze(json);
    }
    const ms: number[] = [];
    let last: AnalyzeResult | null = null;
    for (let i = 0; i < BENCH_REPS; i++) {
      setStatus(`${METHOD_LABELS[method]}: repetición ${i + 1} de ${BENCH_REPS}`);
      last = await client.analyze(json);
      ms.push(last.elapsed_ms);
    }
    if (!last) throw new Error('Sin repeticiones.');
    records.push(makeBenchRecord({ method, caseId: BENCH_CASE_ID, ms, report: last.report }));
  }
  return records;
}

export function BenchPage() {
  const [status, setStatus] = useState('Preparando el benchmark…');
  const [output, setOutput] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runBench(setStatus).then(
      (records) => {
        window.__OGS_BENCH__ = records;
        setOutput(JSON.stringify(records, null, 2));
        setStatus('Benchmark terminado.');
      },
      (error: unknown) => {
        const result = { error: errorMessage(error) };
        window.__OGS_BENCH__ = result;
        setOutput(JSON.stringify(result, null, 2));
        setStatus('El benchmark falló.');
      },
    );
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>OpenGeoSlide: benchmark</h1>
        <p className="muted">
          Caso {BENCH_CASE_ID}, búsqueda 20 × 20 × 20 con refinamiento, {BENCH_WARMUP_RUNS} calentamiento y{' '}
          {BENCH_REPS} repeticiones por método, en el worker (motor wasm).
        </p>
      </header>
      <p role="status">{status}</p>
      <pre id="bench-result">{output}</pre>
    </div>
  );
}
