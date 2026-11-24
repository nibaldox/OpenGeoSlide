// Benchmark Node (WASM): mismo caso, mismos parámetros y mismo protocolo que `ogs bench` y que la página
// /?bench=1 (1 calentamiento y 5 repeticiones por método, tiempo de analyze_json con performance.now()).
// Requiere bench/node/pkg, que genera bench/run_all.sh con `wasm-bindgen --target nodejs`.
// Uso: node bench/node/bench.mjs [caso.json]   (el JSON va a stdout; los errores, a stderr)

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const TARGET = 'node-wasm';
const CASE_ID = 'V047a';
const METHODS = ['bishop', 'spencer'];
const WARMUP_RUNS = 1;
const REPS = 5;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function main() {
  const casePath =
    process.argv[2] ?? path.join(here, '..', '..', 'verification', 'cases', `${CASE_ID}.json`);
  const { analyze_json } = require('./pkg/ogs_wasm.js');

  const caseFile = JSON.parse(readFileSync(casePath, 'utf8'));
  const model = caseFile.model ?? caseFile;
  const caseId = caseFile.id ?? model.meta?.id ?? '';
  if (!model.analysis?.search) throw new Error('el caso no tiene analysis.search');

  const records = [];
  for (const method of METHODS) {
    const input = JSON.stringify({ ...model, analysis: { ...model.analysis, methods: [method] } });
    for (let i = 0; i < WARMUP_RUNS; i++) analyze_json(input);

    const ms = [];
    let output = '';
    for (let i = 0; i < REPS; i++) {
      const start = performance.now();
      output = analyze_json(input);
      ms.push(performance.now() - start);
    }

    const report = JSON.parse(output);
    const result = report.results[0];
    records.push({
      target: TARGET,
      engine: report.engine,
      case: caseId,
      method,
      reps: REPS,
      ms,
      median_ms: median(ms),
      evaluated: result.search?.evaluated ?? null,
      valid: result.search?.valid ?? null,
      fos: result.fos,
    });
  }
  process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  // analyze_json lanza el texto del error (String), no un Error.
  process.stderr.write(`bench-node: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
