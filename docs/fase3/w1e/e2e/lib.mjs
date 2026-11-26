// Utilidades comunes de los recorridos de W1e (puerto 5186). OGS_URL y OGS_BIN por entorno.
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const SHOTS = path.join(process.env.TMPDIR, 'w1e-shots');
mkdirSync(SHOTS, { recursive: true });
export const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
export const OGS_BIN = process.env.OGS_BIN ?? '/home/xodla/archivos/opengeoslide-wt/f3w1e/target/release/ogs';
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

export async function openMenu(page, name) {
  const trigger = page.getByRole('button', { name, exact: true });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  await page.waitForFunction((n) => [...document.querySelectorAll('button.dd-trigger')].some((b) => b.textContent.trim().startsWith(n) && b.getAttribute('aria-expanded') === 'true'), name);
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
  await page.waitForSelector('[data-testid="results-panel"] table tbody tr', { timeout: 60000 });
  await page.waitForSelector('button:has-text("Comprobar"):not([disabled])');
  return page.$$eval('[data-testid="results-panel"] table tbody tr', (r) => r.map((x) => [...x.querySelectorAll('td')].map((c) => c.textContent.trim())));
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
