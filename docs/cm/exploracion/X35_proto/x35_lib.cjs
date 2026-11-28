// X35: utilidades comunes de los guiones de la ruta mínima (Playwright + conteo de operadores KLM).
//
// Variables de entorno:
//   OGS_URL     URL de la web (por defecto, la publicada v0.5.1). Ej.: OGS_URL=http://127.0.0.1:5182/
//   OGS_OUT     carpeta de salida (JSON y capturas). Por defecto ./x35-out (relativa al directorio de trabajo).
//   OGS_REPO    raíz del repo (solo T3, para el DXF de ejemplo). Por defecto, la del propio repo.
//   OGS_CHROME  ejecutable de Chrome. Por defecto /usr/bin/google-chrome-stable.
//
// Cada guion parte de un contexto de navegador nuevo (almacenamiento vacío). Requiere `playwright-core`
// resoluble desde este directorio (node_modules en el repo o NODE_PATH).
//
// Conteo KLM (Kieras, 2001, KLM.pdf): P = 1,1 s; B = 0,1 s (clic = BB = 0,2 s); H = 0,4 s; K = 0,28 s (recomendado para
// la mayoría de usuarios; 0,20 s para un mecanógrafo medio); M = 1,2 s (Kieras: «use 1.2 sec»). Reglas de conteo:
//   - cada clic de ratón = P + BB;
//   - cada tecla (incluidas Control y Mayús) = K; un texto de n caracteres = n·K;
//   - H al cambiar de dispositivo (ratón ↔ teclado);
//   - M antes de cada decisión: buscar un control, leer un valor, elegir una opción (la función think()).
// El tiempo de sistema R (cálculo y renderizado) se mide aparte con cronómetro y no entra en el KLM.

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');

const DEFAULT_URL = 'https://nibaldox.github.io/OpenGeoSlide/';
const URL_ = process.env.OGS_URL || DEFAULT_URL;
const OUT = process.env.OGS_OUT || path.join(process.cwd(), 'x35-out');
const REPO = process.env.OGS_REPO || path.resolve(__dirname, '../../../..');
const CHROME = process.env.OGS_CHROME || '/usr/bin/google-chrome-stable';

/** Tiempos KLM en segundos (Kieras, 2001). */
const KLM = { K: 0.28, P: 1.1, B: 0.1, H: 0.4, M: 1.2 };

class Run {
  constructor(name) {
    this.name = name;
    this.t0 = Date.now();
    this.ops = { P: 0, B: 0, K: 0, H: 0, M: 0 };
    this.last = null; // 'mouse' | 'kbd'
    this.log = [];
    this.marks = {};
    this.meta = {};
    this.status = 'running';
    this.error = null;
  }
  _log(op, label, extra = {}) {
    this.log.push({ t_ms: Date.now() - this.t0, op, label, ...extra });
  }
  /** Clic de ratón (o selección de una opción con el ratón): P + BB, y H si venía del teclado. */
  mouse(label) {
    if (this.last === 'kbd') this.ops.H += 1;
    this.last = 'mouse';
    this.ops.P += 1;
    this.ops.B += 2;
    this._log('mouse', label);
  }
  /** n pulsaciones de tecla (Control y Mayús cuentan como una K cada una), H si venía del ratón. */
  keys(n, label) {
    if (this.last === 'mouse') this.ops.H += 1;
    this.last = 'kbd';
    this.ops.K += n;
    this._log('keys', label, { n });
  }
  /** Decisión mental (buscar un control, leer un valor): M. */
  think(label) {
    this.ops.M += 1;
    this._log('think', label);
  }
  mark(name) {
    this.marks[name] = Date.now() - this.t0;
  }
  /** Tiempo KLM en segundos con los valores dados (por defecto, KLM). */
  klmSeconds(v = KLM) {
    return ['P', 'B', 'K', 'H', 'M'].reduce((s, op) => s + this.ops[op] * v[op], 0);
  }
  /** Tiempo de sistema medido: del clic en «Comprobar» a la aparición del FS. */
  engineSeconds() {
    if (this.marks.calc_click === undefined || this.marks.fs_visible === undefined) return null;
    return (this.marks.fs_visible - this.marks.calc_click) / 1000;
  }
  report() {
    return {
      tarea: this.name,
      estado: this.status,
      error: this.error,
      operadores: this.ops,
      klm_s: Number(this.klmSeconds().toFixed(2)),
      klm_s_con_M_1_35: Number(this.klmSeconds({ ...KLM, M: 1.35 }).toFixed(2)),
      klm_s_con_K_0_20: Number(this.klmSeconds({ ...KLM, K: 0.2 }).toFixed(2)),
      sistema_s_medido: this.engineSeconds(),
      total_inicio_a_FS_s_medido: this.marks.fs_visible !== undefined ? Number(((this.marks.fs_visible) / 1000).toFixed(2)) : null,
      hitos_ms: this.marks,
      meta: this.meta,
      registro: this.log,
    };
  }
  save() {
    fs.mkdirSync(OUT, { recursive: true });
    const file = path.join(OUT, `${this.name}.json`);
    fs.writeFileSync(file, JSON.stringify(this.report(), null, 2));
    return file;
  }
}

/** Abre un navegador nuevo con almacenamiento vacío, carga la web y espera al motor (WASM). */
async function session(run, url = URL_) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-ES' });
  const page = await ctx.newPage();
  // Diagnóstico: errores de página, consola y caída del renderizador, para clasificar fallos.
  run.meta.errores_pagina = [];
  page.on('pageerror', (e) => run.meta.errores_pagina.push(`pageerror: ${String(e.message).slice(0, 160)}`));
  page.on('console', (m) => { if (m.type() === 'error') run.meta.errores_pagina.push(`console: ${m.text().slice(0, 160)}`); });
  page.on('crash', () => run.meta.errores_pagina.push('crash: el renderizador se cayó'));
  run.meta.url = url;
  // Almacenamiento vacío antes de cargar: el contexto es nuevo (la guía aún no ha escrito nada).
  run.meta.almacenamiento_limpio_al_inicio = (await ctx.storageState()).origins.length === 0;
  run.t0 = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  run.mark('load');
  await page.getByText(/ogs-core/).first().waitFor({ timeout: 90000 });
  run.mark('engine_ready');
  run.meta.motor_texto = (await page.getByText(/ogs-core/).first().innerText()).trim();
  run.meta.guia_abierta_al_entrar = (await page.getByText(/^Paso 1 de 5/).count()) > 0;
  run.meta.guia_persistida_tras_entrar = (await page.evaluate(() => localStorage.getItem('ogs.onboarding.v1'))) !== null;
  return { browser, page };
}

/** Clic de un control; cuenta P + BB. */
async function click(run, locator, label) {
  await locator.first().click({ timeout: 30000 });
  run.mouse(label);
}

/** Pulsa «Comprobar», espera al FS en el resumen y guarda la captura. */
async function calcAndWaitFS(run, page, shotName) {
  const btn = page.getByRole('button', { name: 'Comprobar', exact: true }).first();
  await click(run, btn, 'Comprobar');
  run.mark('calc_click');
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="result-summary"]');
      const t = el ? el.innerText : '';
      return /\bFS\b/.test(t) && /\d+[,.]\d+/.test(t) && !/Sin resultados|Desactualizado|Calculando/i.test(t);
    },
    null,
    { timeout: 300000, polling: 100 },
  );
  run.mark('fs_visible');
  run.meta.resumen_FS = (await page.locator('[data-testid="result-summary"]').innerText()).slice(0, 700);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${shotName}_fs.png`) });
}

/** Ejecuta el cuerpo del guion, cierra el navegador y escribe el JSON, con o sin error. */
async function runTask(name, body) {
  const run = new Run(name);
  let browser = null;
  try {
    const s = await session(run);
    browser = s.browser;
    await body(run, s.page);
    run.status = 'ok';
  } catch (e) {
    run.status = 'error';
    run.error = String(e && e.message ? e.message : e).split('\n').slice(0, 3).join(' | ');
  } finally {
    if (browser) await browser.close();
    const file = run.save();
    console.log(JSON.stringify({ ...run.report(), registro: undefined, archivo: file }, null, 2));
    if (run.status !== 'ok') process.exitCode = 1;
  }
}

module.exports = { Run, session, click, calcAndWaitFS, runTask, URL_, OUT, REPO, KLM };
