// Genera bench/RESULTS.md a partir de bench/results/*.json y comprueba que los FS coinciden entre targets.
// Sale con código 1 si algún FS difiere del de referencia (nativo) más de 1e-9 relativo; el informe se escribe igual.
// Uso: node bench/report.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(here, 'results');
const outFile = path.join(here, 'RESULTS.md');
const FS_TOLERANCE = 1e-9;
const REFERENCE = 'native';
const METHODS = ['bishop', 'spencer'];
const METHOD_LABELS = { bishop: 'Bishop simplificado', spencer: 'Spencer' };

// Orden de las filas. `native-parallel` es opcional; los demás son obligatorios.
const TARGETS = [
  { target: 'native', file: 'native.json', required: true },
  { target: 'native-parallel', file: 'native-parallel.json', required: false },
  { target: 'node-wasm', file: 'node-wasm.json', required: true },
  { target: 'chrome-wasm', file: 'chrome-wasm.json', required: true },
];

function run(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      env: { ...process.env, LC_ALL: 'C' },
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'no disponible';
  }
}

function lscpuField(text, name) {
  const match = text.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

function machineInfo() {
  const lscpu = run('lscpu', []);
  const cpuModel = lscpuField(lscpu, 'Model name') ?? os.cpus()[0]?.model ?? 'desconocida';
  const sockets = Number(lscpuField(lscpu, 'Socket\\(s\\)')) || 1;
  const coresPerSocket = Number(lscpuField(lscpu, 'Core\\(s\\) per socket')) || null;
  const threads = Number(lscpuField(lscpu, 'CPU\\(s\\)')) || os.cpus().length;
  const chrome = process.env.CHROME_PATH ?? '/usr/bin/google-chrome-stable';
  return {
    cpu: cpuModel,
    cores: coresPerSocket ? coresPerSocket * sockets : null,
    threads,
    ramGiB: (os.totalmem() / 1024 ** 3).toFixed(1),
    rustc: run('rustc', ['-V']),
    wasmBindgen: run('wasm-bindgen', ['-V']),
    node: process.version,
    chrome: run(chrome, ['--version']),
  };
}

function loadRuns() {
  const runs = new Map();
  for (const { target, file, required } of TARGETS) {
    const full = path.join(resultsDir, file);
    if (!existsSync(full)) {
      if (required) throw new Error(`falta ${path.relative(here, full)}; ejecute bench/run_all.sh`);
      continue;
    }
    const records = JSON.parse(readFileSync(full, 'utf8'));
    for (const record of records) {
      if (record.target !== target) {
        throw new Error(`${file}: registro con target "${record.target}", se esperaba "${target}"`);
      }
    }
    runs.set(target, records);
  }
  return runs;
}

const fmt = (value, digits) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function main() {
  const runs = loadRuns();
  const info = machineInfo();
  const find = (target, method) => runs.get(target)?.find((r) => r.method === method);

  // Gate de FS: cada target frente a la referencia (nativo), por método.
  const fsChecks = [];
  for (const method of METHODS) {
    const ref = find(REFERENCE, method);
    for (const { target } of TARGETS) {
      if (target === REFERENCE || !runs.has(target)) continue;
      const other = find(target, method);
      const rel =
        ref && other && ref.fos !== null && other.fos !== null
          ? Math.abs(other.fos - ref.fos) / Math.abs(ref.fos)
          : NaN;
      fsChecks.push({ method, target, fos: other?.fos ?? null, rel, ok: Number.isFinite(rel) && rel <= FS_TOLERANCE });
    }
  }
  const fsOk = fsChecks.length > 0 && fsChecks.every((c) => c.ok);

  // Superficies válidas: no entra en el gate, pero si difiere entre targets se publica como hallazgo.
  const presentTargets = TARGETS.filter(({ target }) => runs.has(target));
  const validRows = METHODS.map((method) => {
    const counts = presentTargets.map(({ target }) => find(target, method)?.valid ?? null);
    const same = counts.every((c) => c === counts[0]);
    return { method, counts, same };
  });
  const validMismatch = validRows.filter((row) => !row.same);
  const validFindings = validMismatch.length
    ? `**Hallazgo:** el número de superficies válidas difiere entre targets (${validMismatch
        .map((row) => METHOD_LABELS[row.method])
        .join(', ')}). El FS del mejor resultado coincide, pero las evaluaciones en el límite de validez no. ` +
      'Causa no verificada; una hipótesis es la diferencia de redondeo de las funciones trigonométricas entre la libm ' +
      'del sistema (nativo) y la de wasm32.'
    : 'Coinciden en todos los targets.';

  const rows = [];
  for (const { target } of TARGETS) {
    for (const method of METHODS) {
      const r = find(target, method);
      if (!r) continue;
      rows.push(
        `| ${target} | ${METHOD_LABELS[method]} | ${r.evaluated ?? '—'} | ${fmt(r.median_ms, 2)} | ` +
          `${fmt(r.median_ms / r.evaluated, 4)} | ${fmt(r.fos, 9)} |`,
      );
    }
  }

  const ratioRows = [];
  for (const method of METHODS) {
    const native = find(REFERENCE, method);
    const cells = ['native-parallel', 'node-wasm', 'chrome-wasm'].map((target) => {
      const r = find(target, method);
      if (!r || !native) return '—';
      return fmt(r.median_ms / native.median_ms, 2);
    });
    ratioRows.push(`| ${METHOD_LABELS[method]} | ${cells.join(' | ')} |`);
  }

  const fsRows = fsChecks.map(
    (c) =>
      `| ${METHOD_LABELS[c.method]} | ${c.target} | ${fmt(c.fos, 9)} | ${c.rel.toExponential(2)} | ` +
      `${c.ok ? 'sí' : '**NO**'} |`,
  );

  const now = new Date().toISOString();
  const md = `# Resultados de rendimiento de OpenGeoSlide (spike)

> **Medición de spike, no un benchmark controlado.** Una sola máquina, sin aislar procesos, sin fijar la frecuencia
> de la CPU y con el resto del sistema activo. Sirve para orientarse sobre el orden de magnitud; no para comparar
> versiones con precisión.

Generado por \`bench/run_all.sh\` el ${now}.

## Máquina y versiones

| Concepto | Valor |
|---|---|
| CPU | ${info.cpu} (${info.cores ?? '?'} núcleos, ${info.threads} hilos) |
| RAM | ${info.ramGiB} GiB |
| Rust | ${info.rustc} |
| wasm-bindgen | ${info.wasmBindgen} |
| Node | ${info.node} |
| Chrome | ${info.chrome} (headless) |

## Caso y protocolo

- Caso: \`verification/cases/V047a.json\` (ACADS 1(a), talud homogéneo seco), \`kind = search\`:
  búsqueda circular entrada–salida 20 × 20 × 20 con refinamiento, 50 dovelas.
- Método por separado (Bishop y Spencer). Un calentamiento y 5 repeticiones; se reporta la mediana.
- Tiempo medido alrededor de \`analyze_json\` (JSON de entrada → JSON de salida), igual en los tres targets.
- \`native\`: \`ogs bench\` (un hilo, perfil release). \`native-parallel\`: mismo código con \`--features parallel\`
  (rayon). \`node-wasm\`: wasm-bindgen \`--target nodejs\`. \`chrome-wasm\`: \`/?bench=1\` en el worker, con \`pnpm preview\`.

## Resultados

| target | método | evaluadas | mediana ms | ms/superficie | FS |
|---|---|---|---|---|---|
${rows.join('\n')}

Razón de tiempo: mediana de cada target dividida por la mediana nativa de un hilo (menor es mejor). Los valores
menores que 1 indican que el target es más rápido que el nativo de un hilo.

| método | native-parallel | node-wasm | chrome-wasm |
|---|---|---|---|
${ratioRows.join('\n')}

## Verificación de FS

Tolerancia relativa de referencia: ${FS_TOLERANCE}. Referencia: \`native\`.

| método | target | FS | error relativo | ¿coincide? |
|---|---|---|---|---|
${fsRows.join('\n')}

Resultado del gate de FS: **${fsOk ? 'CUMPLE' : 'NO CUMPLE'}**.

## Superficies válidas

Número de superficies con FS válido (\`valid\` de la búsqueda). No es parte del gate, pero debe coincidir entre targets.

| método | ${presentTargets.map(({ target }) => target).join(' | ')} |
|---|${presentTargets.map(() => '---').join('|')}|
${validRows.map((row) => `| ${METHOD_LABELS[row.method]} | ${row.counts.join(' | ')} |`).join('\n')}

${validFindings}

## Datos crudos

\`bench/results/*.json\` (tiempos por repetición, \`evaluated\`, \`valid\` y FS de cada método).
`;
  writeFileSync(outFile, md);
  process.stdout.write(`RESULTS.md escrito en ${path.relative(process.cwd(), outFile)}\n`);
  process.stdout.write(`gate FS (${FS_TOLERANCE} relativo): ${fsOk ? 'CUMPLE' : 'NO CUMPLE'}\n`);
  for (const c of fsChecks) {
    process.stdout.write(`  ${c.method} ${c.target}: rel=${c.rel.toExponential(3)} ${c.ok ? 'ok' : 'FALLO'}\n`);
  }
  process.exitCode = fsOk ? 0 : 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(`report: ${error.message}\n`);
  process.exitCode = 1;
}
