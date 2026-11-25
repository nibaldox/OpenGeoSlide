// Utilidades comunes de los recorridos U4-M (puerto 5186). Se ejecutan desde un directorio con `playwright-core` instalado.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const SHOTS = path.join(process.env.TMPDIR, 'u4m-shots');
mkdirSync(SHOTS, { recursive: true });
export const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
export const num = (t) => Number(String(t).replace(/\s/g, '').replace(',', '.'));

export async function start(name, viewport = { width: 1440, height: 900 }, opts = {}) {
  const out = { steps: [], consoleErrors: [] };
  let failed = 0;
  const step = (n, ok, data = {}) => {
    if (!ok) failed += 1;
    out.steps.push({ name: n, ok, ...data });
    console.log(ok ? 'OK  ' : 'FAIL', n, JSON.stringify(data));
  };
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport, ...opts });
  await ctx.addInitScript(() => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => out.consoleErrors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) out.consoleErrors.push(m.text()); });
  const shot = async (n) => { const p = path.join(SHOTS, `${name}-${n}.png`); await page.screenshot({ path: p }); return p; };
  const finish = async () => {
    step('Errores de consola', out.consoleErrors.length === 0, { errores: out.consoleErrors });
    writeFileSync(path.join(SHOTS, `${name}.json`), JSON.stringify(out, null, 2));
    await browser.close();
    console.log(failed === 0 ? 'TODO OK' : `${failed} FALLOS`);
    process.exit(failed === 0 ? 0 : 1);
  };
  return { browser, ctx, page, step, shot, finish, out };
}

export async function discardIfAsked(page, label = 'Descartar cambios') {
  const dlg = page.locator('[data-testid="confirm-dialog"]');
  try { await dlg.waitFor({ state: 'visible', timeout: 1500 }); } catch { return false; }
  await dlg.getByRole('button', { name: label, exact: true }).click();
  await dlg.waitFor({ state: 'detached' });
  return true;
}

export async function openMenu(page, name) {
  const trigger = page.getByRole('button', { name, exact: true });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  await page.waitForFunction((n) => [...document.querySelectorAll('button.dd-trigger')].some((b) => b.textContent.trim().startsWith(n) && b.getAttribute('aria-expanded') === 'true'), name);
}

export async function load(page) {
  await page.goto(URL_);
  await page.waitForSelector('[data-testid="engine-banner"]', { timeout: 20000 });
  await page.waitForSelector('[data-layer="regions"] polygon');
  // esperar a que el motor (WASM) esté listo
  await page.waitForFunction(() => !/Cargando el motor/.test(document.body.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
}

/**
 * Transformación mundo → pantalla (px de página), deducida de los tiradores de vértice (su etiqueta lleva x e y en metros y el círculo su
 * posición en px del SVG). Devuelve {px(x, y) → [sx, sy] de página, world(sx, sy), scale, box}.
 */
export async function viewportOf(page) {
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
  return {
    box, scale, tx, ty,
    px: (x, y) => [box.x + tx + scale * x, box.y + ty - scale * y],
    world: (sx, sy) => [(sx - box.x - tx) / scale, (ty - (sy - box.y)) / scale],
  };
}

/** Ordenada mínima (la más profunda) de la superficie crítica dibujada, en metros, y su arco. */
export async function surfaceDepth(page) {
  const vp = await viewportOf(page);
  const pts = await page.evaluate(() => (document.querySelector('[data-critical-surface]')?.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean).map((p) => p.split(',').map(Number)));
  if (pts.length === 0) return null;
  const ys = pts.map(([sx, sy]) => vp.world(vp.box.x + sx, vp.box.y + sy)[1]);
  return { minY: Math.min(...ys), n: pts.length };
}

export const live = (page) => page.waitForTimeout(300).then(() => page.textContent('[data-testid="live-polite"]')).then((t) => (t ?? '').trim());
export const nRegions = (page) => page.locator('[data-layer="regions"] polygon').count();
export const polys = (page) => page.evaluate(() => [...document.querySelectorAll('[data-layer="regions"] polygon')].map((p) => p.getAttribute('points')));

export async function check(page) {
  await page.getByRole('button', { name: 'Comprobar', exact: true }).first().click();
  await page.waitForSelector('[data-testid="results-panel"] table tbody tr', { timeout: 90000 });
  await page.waitForSelector('button:has-text("Comprobar"):not([disabled])', { timeout: 90000 });
  const rows = await page.$$eval('[data-testid="results-panel"] table tbody tr', (r) => r.map((x) => [...x.querySelectorAll('td')].map((c) => c.textContent.trim())));
  const head = await page.$$eval('[data-testid="results-panel"] table thead th', (r) => r.map((x) => x.textContent.trim()));
  return { head, rows };
}

/** «Talud simple…» con los datos de T2 (H = 15 m, 1,5H:1V, arcilla, piezométrica en el pie); `lower` agrega el estrato de roca (contacto 5 m bajo el pie). */
export async function makeSlope(page, { lower = false, shot } = {}) {
  await openMenu(page, 'Archivo');
  await page.getByRole('button', { name: 'Talud simple…' }).click();
  await page.waitForSelector('dialog[open]');
  await page.getByLabel('Altura H').fill('15');
  await page.getByLabel('Pendiente H:V', { exact: true }).check();
  await page.getByLabel(/Pendiente H:V \(horizontal/).fill('1,5');
  await page.getByLabel('Nombre', { exact: true }).fill('Arcilla');
  await page.getByLabel(/Peso unitario γ/).first().fill('18');
  await page.getByLabel(/Cohesión c/).first().fill('25');
  await page.getByLabel(/Ángulo de fricción φ/).first().fill('20');
  // Integración U4: el selector «Caso» de Casos (oculto) también contiene «piezométrica» en sus títulos; se acota al diálogo.
  await page.locator('dialog[open]').getByLabel('Línea piezométrica').selectOption('toe');
  if (lower) {
    await page.getByLabel('Agregar un estrato inferior (material 2)').check();
    await page.getByLabel('Contacto: profundidad bajo el pie').fill('5');
    await page.getByLabel('Estrato inferior: nombre').fill('Roca');
    await page.getByLabel(/Estrato inferior: peso unitario/).fill('24');
    await page.getByLabel(/Estrato inferior: cohesión/).fill('200');
    await page.getByLabel(/Estrato inferior: ángulo/).fill('40');
  }
  const dlgShot = shot ? await shot('dialogo') : null;
  await page.getByRole('button', { name: 'Crear talud' }).click();
  await discardIfAsked(page);
  await page.waitForSelector('dialog[open]', { state: 'detached' });
  await page.waitForFunction((n) => document.querySelectorAll('[data-layer="regions"] polygon').length === n, lower ? 2 : 1);
  return dlgShot;
}

/** Mueve el cursor de dibujo del teclado hasta (tx, ty) con flechas (0,1 m; Mayús ×10; Ctrl ×100), leyendo «Cursor: x …» del anuncio. */
export async function moveCursorTo(page, tx, ty) {
  const cursorXY = async () => {
    const t = await live(page);
    const m = /Cursor: x (-?[\d,.]+) \w+, y (-?[\d,.]+)/.exec(t);
    return m ? [num(m[1]), num(m[2])] : null;
  };
  let cur = await cursorXY();
  if (!cur) { await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft'); cur = await cursorXY(); }
  for (let guard = 0; guard < 600; guard += 1) {
    const dx = Math.round((tx - cur[0]) * 10) / 10;
    const dy = Math.round((ty - cur[1]) * 10) / 10;
    if (dx === 0 && dy === 0) return cur;
    const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    const d = axis === 'x' ? dx : dy;
    const a = Math.abs(d);
    const mods = a >= 10 ? ['Control'] : a >= 1 ? ['Shift'] : [];
    const key = axis === 'x' ? (d > 0 ? 'ArrowRight' : 'ArrowLeft') : d > 0 ? 'ArrowUp' : 'ArrowDown';
    for (const m of mods) await page.keyboard.down(m);
    await page.keyboard.press(key);
    for (const m of mods) await page.keyboard.up(m);
    cur = await cursorXY();
  }
  throw new Error('no llegó al punto ' + tx + ',' + ty);
}
