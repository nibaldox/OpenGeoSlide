// Benchmark Chrome headless (WASM): levanta `pnpm preview` en 127.0.0.1:5181, abre /?bench=1, espera
// #bench-result (hasta 180 s), guarda el JSON y detiene el servidor, comprobando que el puerto queda libre.
// Uso: node bench/chrome/run.mjs [salida.json]   (por defecto bench/results/chrome-wasm.json)
// Variables: CHROME_PATH (por defecto /usr/bin/google-chrome-stable).

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const webDir = path.join(repoRoot, 'apps', 'web');
const outFile = path.resolve(process.argv[2] ?? path.join(repoRoot, 'bench', 'results', 'chrome-wasm.json'));
const HOST = '127.0.0.1';
const PORT = 5181;
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome-stable';
const RESULT_TIMEOUT_MS = 180_000;

/** true si nadie escucha en el puerto (la conexión es rechazada). */
function portFree(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: HOST, port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(true));
  });
}

async function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await portFree(port))) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`el puerto ${port} no se abrió en ${timeoutMs} ms`);
}

async function stopServer(server) {
  if (server.exitCode === null && server.signalCode === null) {
    // detached: el grupo de procesos incluye pnpm y vite.
    process.kill(-server.pid, 'SIGTERM');
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        process.kill(-server.pid, 'SIGKILL');
        resolve();
      }, 5_000);
      server.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

async function main() {
  if (!(await portFree(PORT))) {
    throw new Error(`el puerto ${PORT} ya está en uso; no se arranca el servidor de benchmark`);
  }

  const server = spawn('pnpm', ['preview', '--host', HOST, '--port', String(PORT), '--strictPort'], {
    cwd: webDir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', (chunk) => (serverLog += chunk));
  server.stderr.on('data', (chunk) => (serverLog += chunk));

  let browser;
  let json;
  try {
    await waitForPort(PORT, 60_000);
    browser = await chromium.launch({ executablePath: CHROME, headless: true });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(`http://${HOST}:${PORT}/?bench=1`, { waitUntil: 'load' });
    await page.waitForFunction(
      () => (document.querySelector('#bench-result')?.textContent ?? '').trim().length > 0,
      undefined,
      { timeout: RESULT_TIMEOUT_MS, polling: 250 },
    );
    const text = await page.textContent('#bench-result');
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      throw new Error(`la página devolvió un error: ${data.error ?? text}`);
    }
    if (pageErrors.length > 0) {
      throw new Error(`errores de página durante el benchmark: ${pageErrors.join(' | ')}`);
    }
    json = data;
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
    if (!(await portFree(PORT))) {
      throw new Error(`el puerto ${PORT} sigue abierto tras detener el servidor\n${serverLog}`);
    }
  }

  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(json, null, 2)}\n`);
  process.stdout.write(`chrome-wasm: ${json.length} registros -> ${path.relative(repoRoot, outFile)}\n`);
  process.stdout.write('puerto 5181 libre tras detener el servidor\n');
}

main().catch((error) => {
  process.stderr.write(`bench-chrome: ${error.message}\n`);
  process.exitCode = 1;
});
