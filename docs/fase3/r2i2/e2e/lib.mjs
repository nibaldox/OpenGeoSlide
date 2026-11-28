// Utilidades de los recorridos de R2-I2 (puerto 5186). Copia de docs/fase3/iw/e2e/lib.mjs con las capturas en $TMPDIR/r2i2-shots y los ayudantes de refuerzos al final.
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const SHOTS = path.join(process.env.TMPDIR, 'r2i2-shots');
mkdirSync(SHOTS, { recursive: true });
export const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
export const OGS_BIN = process.env.OGS_BIN ?? path.join(process.env.OGS_REPO ?? process.cwd(), 'target/release/ogs');
// Un caso de verificación por id: primero en verification/cases (los promovidos por el motor) y, si aún no, en verification/pending/F3.
// Los recorridos no deben fijar la carpeta: V006 y V046a pasaron de pending/F3 a cases al promoverse.
export const casePath = (repo, id) => {
  for (const dir of ['verification/cases', 'verification/pending/F3']) {
    const f = path.join(repo, dir, `${id}.json`);
    if (existsSync(f)) return f;
  }
  throw new Error(`caso ${id} no encontrado ni en verification/cases ni en verification/pending/F3`);
};
export const errors = [];
export const dialogs = [];
let failed = 0;
let oks = 0;
export const step = (name, ok, data = {}) => {
  if (ok) oks += 1; else failed += 1;
  console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data));
};
export const summary = () => { console.log(`RESUMEN OK=${oks} FAIL=${failed} errores_consola=${errors.length}`); if (errors.length) console.log('ERRORES', errors); return failed; };

export async function launch({ theme, colorScheme, viewport = { width: 1440, height: 900 }, hasTouch = false } = {}) {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport, acceptDownloads: true, colorScheme, hasTouch });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('ogs.onboarding.v1', 'seen'); if (t) localStorage.setItem('ogs.theme.v1', t); } catch {}
  }, theme);
  const page = await ctx.newPage();
  page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return { browser, ctx, page };
}

export async function start(page) {
  await page.goto(URL_);
  await page.waitForSelector('[data-layer="regions"] polygon');
  await page.waitForFunction(() => /ogs-core/.test(document.querySelector('[data-testid="engine-banner"]')?.textContent ?? ''));
}

// C-W (F3A-C): I-W vio una caída tras el paso 8d de w1e_polilinea (`Guardar` no encontrado: `getByRole` omite lo oculto, así que el menú estaba cerrado
// aunque `aria-expanded` ya había pasado por «true»). No se reproduce (7 ejecuciones, 3 en serie y 4 en paralelo, y la sonda dbg_foco.mjs, 12 aperturas
// con CPU saturada y un borrador inválido en la tabla de la función: el menú queda abierto y el foco en «Archivo»). El foco no se pierde, así que no hay
// defecto en la app que corregir: es una carrera del guion (clic y lectura de estado en el mismo instante). Ahora espera a que el menú esté abierto
// de verdad (`:popover-open`) y, si se cerró, vuelve a pulsar el botón (hasta 3 intentos).
export async function openMenu(page, name) {
  const trigger = page.getByRole('button', { name, exact: true });
  const isOpen = () => page.evaluate((n) => {
    const b = [...document.querySelectorAll('button.dd-trigger')].find((x) => x.textContent.trim().startsWith(n));
    const menu = b && document.getElementById(b.getAttribute('aria-controls'));
    return !!b && b.getAttribute('aria-expanded') === 'true' && !!menu && menu.matches(':popover-open');
  }, name);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await isOpen())) await trigger.click();
    try { await page.waitForFunction((n) => {
      const b = [...document.querySelectorAll('button.dd-trigger')].find((x) => x.textContent.trim().startsWith(n));
      const menu = b && document.getElementById(b.getAttribute('aria-controls'));
      return !!b && b.getAttribute('aria-expanded') === 'true' && !!menu && menu.matches(':popover-open');
    }, name, { timeout: 3000 }); } catch { continue; }
    await page.waitForTimeout(120);
    if (await isOpen()) return;
  }
  throw new Error(`el menú ${name} no se abrió`);
}

export async function openMenuDebug(page, name) {
  try { await openMenu(page, name); } catch (e) {
    console.log('MENU FALLO', await page.evaluate(() => [...document.querySelectorAll('button.dd-trigger')].map((b) => [b.textContent.trim(), b.getAttribute('aria-expanded')])), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 160)));
    await shot(page, 'debug-menu'); throw e;
  }
}

export async function newSlope(page) {
  await openMenu(page, 'Archivo');
  await page.getByRole('button', { name: 'Talud simple…' }).click();
  await page.waitForSelector('dialog[open]');
  await page.getByRole('button', { name: 'Crear talud' }).click();
  const dlg = page.locator('[data-testid="confirm-dialog"]');
  try { await dlg.waitFor({ state: 'visible', timeout: 1200 }); await dlg.getByRole('button', { name: 'Descartar cambios', exact: true }).click(); } catch {}
  await page.waitForSelector('dialog[open]', { state: 'detached' });
  await page.waitForSelector('[data-vertex-row]');
}

export const tab = (page, name) => page.getByRole('tab', { name, exact: true }).click();
export const num = (t) => Number(String(t).replace(/\s/g, '').replace(',', '.'));

/** Guarda el modelo con Archivo ▸ Guardar y devuelve el texto. */
export async function saveText(page, file = 'w1e.ogs.json') {
  await openMenuDebug(page, 'Archivo');
  const g = page.getByRole('button', { name: 'Guardar', exact: true });
  if (!(await g.isEnabled({ timeout: 5000 }).catch(() => false))) {
    console.log('GUARDAR no disponible', await g.getAttribute('title').catch(() => null), await page.locator('[data-testid="export-hint"]').textContent().catch(() => null));
    await shot(page, 'debug-guardar');
  }
  const [dl] = await Promise.all([page.waitForEvent('download'), g.click()]);
  const p = path.join(process.env.TMPDIR, file);
  await dl.saveAs(p);
  return { path: p, text: readFileSync(p, 'utf8') };
}

export function cli(file) {
  const r = spawnSync(OGS_BIN, ['analyze', file], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) return { code: r.status, out: `${r.stderr}${r.stdout}`, results: [] };
  return { code: 0, out: '', results: JSON.parse(r.stdout).results };
}

export async function check(page) {
  await page.getByRole('button', { name: 'Comprobar', exact: true }).first().click();
  // UA: el resultado se espera en el HUD (result-summary, data-state=current) y la tabla se lee en la vista «Resultados»; después se vuelve a «Lienzo».
  await page.waitForSelector('[data-testid="result-summary"][data-state="current"]', { state: 'attached', timeout: 60000 });
  await page.waitForSelector('button:has-text("Comprobar"):not([disabled])');
  await showView(page, 'Resultados');
  await page.waitForSelector('[data-testid="results-panel"] table tbody tr', { timeout: 60000 });
  const rows = await page.$$eval('[data-testid="results-panel"] table tbody tr', (r) => r.map((x) => [...x.querySelectorAll('td')].map((c) => c.textContent.trim())));
  await showView(page, 'Lienzo');
  return rows;
}

// UA: la vista activa se elige en el tablist «Vistas» (Lienzo = #mode-edit, Resultados = #view-results); la tabla ya no está en el lienzo.
export async function showView(page, name) {
  const ids = { Lienzo: 'mode-edit', Resultados: 'view-results', Casos: 'mode-cases', 'Casos de verificación': 'mode-cases', Informe: 'view-report' };
  const t = page.locator(`#${ids[name] ?? name}`);
  if ((await t.getAttribute('aria-selected')) !== 'true') await t.click();
  await page.waitForSelector(`#${ids[name] ?? name}[aria-selected="true"]`);
}


export async function shot(page, name) {
  const p = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: p });
  return p;
}

export async function axe(page, label) {
  const src = readFileSync(path.join(process.env.TMPDIR, 'x8-ux/node_modules/axe-core/axe.min.js'), 'utf8');
  await page.evaluate(src);
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
  const bad = res.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  step(`axe ${label}: 0 serious/critical (total ${res.length})`, bad.length === 0, { bad, todas: res.map((v) => `${v.id}:${v.impact}`) });
  return res;
}

// ───────── Añadidos de I-W ─────────
/** Observa el Worker real: guarda cada respuesta de `analyze` (texto JSON del informe o error) y los Blob de descargas. */
export const TAP = () => {
  window.__reports = []; window.__errors = []; window.__workers = []; window.__blobs = [];
  const Real = window.Worker;
  window.Worker = class extends Real {
    constructor(...a) {
      super(...a);
      window.__workers.push(this);
      this.addEventListener('message', (e) => {
        const d = e.data;
        if (d && d.ok === true && typeof d.result === 'string' && d.result.includes('"results"')) window.__reports.push(d.result);
        else if (d && d.ok === false) window.__errors.push(d.error);
      });
    }
  };
  const create = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => { window.__blobs.push(b); return create(b); };
};

export async function launchTap(opts = {}) {
  const l = await launch(opts);
  await l.ctx.addInitScript(TAP);
  return l;
}

/** Pulsa «Comprobar» y espera un informe nuevo del Worker real; devuelve el informe completo (JSON sin redondeos). */
export async function checkReport(page, timeout = 90000) {
  const n0 = await page.evaluate(() => window.__reports.length + window.__errors.length);
  await page.getByRole('button', { name: 'Comprobar', exact: true }).first().click();
  await page.waitForFunction((n) => window.__reports.length + window.__errors.length > n, n0, { timeout });
  await page.waitForSelector('button:has-text("Comprobar"):not([disabled])');
  await page.waitForTimeout(300);
  return page.evaluate(() => (window.__reports.length ? JSON.parse(window.__reports[window.__reports.length - 1]) : { error: window.__errors[window.__errors.length - 1] }));
}

/** Abre un archivo del disco con Archivo ▸ Abrir (input oculto) y descarta cambios si el diálogo lo pide. */
export async function openFile(page, file) {
  await page.getByTestId('file-open').setInputFiles(file);
  const dlg = page.locator('[data-testid="confirm-dialog"]');
  try { await dlg.waitFor({ state: 'visible', timeout: 1200 }); await dlg.getByRole('button', { name: 'Descartar cambios', exact: true }).click(); } catch {}
  await page.waitForTimeout(600);
}

/** Compara el informe de la web con `ogs analyze` método a método. Devuelve filas [método, fosWeb, fosCli, |Δ|rel, estado]. */
export function compare(report, cliResults) {
  return (report.results ?? []).map((w) => {
    const c = cliResults.find((x) => x.method === w.method);
    const fw = w.fos ?? null, fc = c?.fos ?? null;
    const rel = fw === null || fc === null ? (fw === fc ? 0 : Infinity) : Math.abs(fw - fc) / Math.max(1, Math.abs(fc));
    return { method: w.method, web: fw, cli: fc, rel, status: `${w.status}/${c?.status}`, f0web: w.correction_factor ?? null, f0cli: c?.correction_factor ?? null, same: w.status === c?.status && rel <= 1e-9 };
  });
}

/** Lee el último Blob con el tipo dado y lo guarda en `file`. */
export async function saveBlob(page, type, file) {
  const b64 = await page.evaluate(async (t) => {
    const b = window.__blobs.filter((x) => x.type.startsWith(t)).pop();
    if (!b) return null;
    const buf = new Uint8Array(await b.arrayBuffer());
    let s = ''; for (const c of buf) s += String.fromCharCode(c);
    return btoa(s);
  }, type);
  if (b64 === null) return null;
  writeFileSync(file, Buffer.from(b64, 'base64'));
  return file;
}

// ───────── Ayudantes de refuerzos (R2-I2) ─────────
export const REPO = process.env.OGS_REPO ?? process.cwd();

/** Modelo de partida de los recorridos: el corte de V097a (arcilla, piezométrica y sobrecarga), círculo fijo, los cinco métodos y sin refuerzos. */
export function baseModel(mutate = () => {}) {
  const m = JSON.parse(readFileSync(casePath(REPO, 'V097a'), 'utf8')).model;
  m.version = '0.3';
  m.analysis.methods = ['bishop', 'spencer', 'morgenstern_price', 'janbu_simplified', 'janbu_corrected'];
  delete m.reinforcements;
  mutate(m);
  return m;
}
export function writeModel(name, model) {
  const p = path.join(process.env.TMPDIR, name);
  writeFileSync(p, JSON.stringify(model, null, 2));
  return p;
}

/** Transformación mundo → página del lienzo, deducida de los tiradores de vértice (aria-label con x e y, más cx y cy). */
export async function viewportOf(page) {
  // UA: en móvil el lienzo queda por encima de la lista de pasos y la página puede estar desplazada: se trae el lienzo a la vista antes de medir.
  await page.locator('svg.ec-svg').scrollIntoViewIfNeeded();
  const box = await page.locator('svg.ec-svg').boundingBox();
  const hs = await page.evaluate(() => [...document.querySelectorAll('[data-handle="vertex"]')].map((g) => {
    const m = /x (-?[\d.,]+) \w+, y (-?[\d.,]+)/.exec(g.getAttribute('aria-label') ?? '');
    const c = g.querySelector('[data-handle-shape]');
    return m ? { x: Number(m[1].replace(',', '.')), y: Number(m[2].replace(',', '.')), cx: Number(c.getAttribute('cx')), cy: Number(c.getAttribute('cy')) } : null;
  }).filter(Boolean));
  const a = hs[0];
  const b = hs.find((h) => Math.abs(h.x - a.x) > 1e-6 && Math.abs(h.y - a.y) > 1e-6) ?? hs.find((h) => Math.abs(h.x - a.x) > 1e-6);
  const scale = Math.abs((b.cx - a.cx) / (b.x - a.x));
  const tx = a.cx - scale * a.x;
  const ty = a.cy + scale * a.y;
  return { box, scale, px: (x, y) => [box.x + tx + scale * x, box.y + ty - scale * y], world: (sx, sy) => [(sx - box.x - tx) / scale, (ty - (sy - box.y)) / scale] };
}

/** Los refuerzos del modelo vivo, leídos de los nombres accesibles del panel no: se guardan con Archivo ▸ Guardar y se lee el JSON. */
export async function savedModel(page, file) {
  const { text } = await saveText(page, file);
  return JSON.parse(text);
}

/** Pestaña «Refuerzos» del panel lateral. */
export const reinforcementsTab = (page) => tab(page, 'Refuerzos');
export const fieldOf = (page, n, label) => page.getByLabel(new RegExp(`^Refuerzo ${n}: ${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
/** Escribe en un campo del panel y confirma con Intro. */
export async function setField(page, n, label, value) {
  const f = fieldOf(page, n, label);
  await f.fill(String(value));
  await f.press('Enter');
}

/** Captura solo el lienzo del editor (para revisar símbolos, flechas y rótulos con visión). */
export async function canvasShot(page, name) {
  const p = path.join(SHOTS, `${name}.png`);
  await page.locator('[data-testid="editor-canvas"]').screenshot({ path: p });
  return p;
}
