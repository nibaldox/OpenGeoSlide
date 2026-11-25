// U2-C: táctil en Chrome móvil emulado (390×844): pellizco, desplazamiento de la página y arrastre de un tirador.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const SHOTS = path.join(process.env.TMPDIR, 'u2x-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5187/';
let failed = 0;
const step = (name, ok, data = {}) => { if (!ok) failed += 1; console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data)); };

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(URL_);
await page.waitForSelector('[data-handle="vertex"]');
const sel = 'select[aria-label="Abrir un caso publicado como modelo"]';
const optLabel = await page.evaluate(([s, id]) => [...document.querySelectorAll(s + ' option')].find((o) => o.textContent.includes(id))?.textContent, [sel, 'V016a']);
await page.selectOption(sel, { label: optLabel });
await page.waitForSelector('[data-handle="circle_center"]');

const rect = () => page.evaluate(() => { const r = document.querySelector('svg[role="application"]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const polys = () => page.evaluate(() => [...document.querySelectorAll('[data-layer="regions"] polygon')].map((p) => p.getAttribute('points')).join('#'));
const scrollY = () => page.evaluate(() => Math.round(window.scrollY));
const h0 = await page.evaluate(() => document.querySelector('svg[role="application"]').getBoundingClientRect().height);
step('1 altura del lienzo en móvil = clamp(320px, 55dvh, 640px)', Math.abs(h0 - Math.min(640, Math.max(320, 0.55 * 844))) < 1, { altura: h0, esperado: 0.55 * 844 });
const ts = await page.evaluate(() => getComputedStyle(document.querySelector('svg[role="application"]')).touchAction);
step('2 touch-action del lienzo permite desplazar la página (herramienta Seleccionar)', ts === 'pan-x pan-y', { touchAction: ts });

// Llevar el lienzo a la vista
await page.evaluate(() => document.querySelector('svg[role="application"]').scrollIntoView({ block: 'start' }));
await sleep(300);
let r = await rect();
const sy0 = await scrollY();
await page.screenshot({ path: path.join(SHOTS, 'touch-01-lienzo.png') });

// Pellizco: dos dedos separándose sobre el fondo del lienzo
const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
const p0 = await polys();
await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]]);
for (let i = 1; i <= 8; i += 1) { await touch('touchMove', [[cx - 40 - i * 12, cy], [cx + 40 + i * 12, cy]]); await sleep(16); }
await touch('touchEnd', []);
await sleep(100);
const p1 = await polys();
step('3 pellizco (dos punteros) acerca la vista y no desplaza la página', p1 !== p0 && (await scrollY()) === sy0, { scrollY: await scrollY() });
await page.screenshot({ path: path.join(SHOTS, 'touch-02-pellizco.png') });
// Juntar los dedos aleja
await touch('touchStart', [[cx - 130, cy], [cx + 130, cy]]);
for (let i = 1; i <= 8; i += 1) { await touch('touchMove', [[cx - 130 + i * 12, cy], [cx + 130 - i * 12, cy]]); await sleep(16); }
await touch('touchEnd', []);
await sleep(100);
step('4 pellizco inverso aleja', (await polys()) !== p1);
await page.getByRole('button', { name: 'Encuadrar' }).tap();
await sleep(100);

// Desplazar la página con un dedo sobre el fondo del lienzo (no atrapa el scroll)
r = await rect();
const bx = r.x + 30, by = r.y + r.h - 60;
const before = await scrollY();
await touch('touchStart', [[bx, by]]);
for (let i = 1; i <= 12; i += 1) { await touch('touchMove', [[bx, by - i * 15]]); await sleep(16); }
await touch('touchEnd', []);
await sleep(400);
const after = await scrollY();
step('5 un dedo sobre el fondo del lienzo desplaza la página (no la atrapa)', after > before + 20, { antes: before, despues: after });
await page.evaluate(() => document.querySelector('svg[role="application"]').scrollIntoView({ block: 'start' }));
await sleep(300);

// Arrastrar un tirador con el dedo: mueve el vértice y NO desplaza la página
r = await rect();
// Tirador más aislado (el más cercano gana: con vértices a menos de 22 px el toque elegiría otro).
const isolated = await page.evaluate(() => {
  const hs = [...document.querySelectorAll('[data-handle]')].map((e) => { const b = e.getBoundingClientRect(); return { key: e.getAttribute('data-handle-key'), x: b.x + b.width / 2, y: b.y + b.height / 2 }; }).filter((h) => h.y > 40 && h.y < 500);
  let best = null;
  for (const h of hs) { const d = Math.min(...hs.filter((o) => o !== h).map((o) => Math.hypot(o.x - h.x, o.y - h.y))); if (!best || d > best.d) best = { key: h.key, d }; }
  return best;
});
const handle = page.locator(`[data-handle-key="${isolated.key}"]`);
const hb = await handle.boundingBox();
const hx = hb.x + hb.width / 2, hy = hb.y + hb.height / 2;
const label0 = await handle.getAttribute('aria-label');
const sy1 = await scrollY();
// el dedo cae a 18 px del centro: dentro del radio táctil (22 px), fuera del de ratón con radio 10
const fx = hx + 14, fy = hy + 14;
await touch('touchStart', [[fx, fy]]);
for (let i = 1; i <= 10; i += 1) { await touch('touchMove', [[fx, fy - i * 6]]); await sleep(16); }
await touch('touchEnd', []);
await sleep(200);
const label1 = await handle.getAttribute('aria-label');
step('6 el dedo arrastra un tirador (radio táctil 22 px) y la página no se desplaza', label0 !== label1 && (await scrollY()) === sy1, { tirador: isolated, antes: label0, despues: label1, scrollY: await scrollY() });
await page.screenshot({ path: path.join(SHOTS, 'touch-03-arrastre-tirador.png') });

// Tamaños de objetivos
const sizes = await page.evaluate(() => {
  const hit = [...document.querySelectorAll('[data-hit-area]')].map((e) => e.getBoundingClientRect().width);
  const shapes = [...document.querySelectorAll('[data-handle-shape="vertex"]')].map((e) => e.getBoundingClientRect().width);
  const btns = [...document.querySelectorAll('.ec-tool')].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; });
  return { hitMin: Math.min(...hit), vertexMin: Math.min(...shapes), btns };
});
step('7 objetivos: área de acierto ≥ 24 px, marca visible ≥ 12 px, botones de zoom ≥ 24 px', sizes.hitMin >= 24 && sizes.vertexMin >= 12 && sizes.btns.every(([w, h]) => w >= 24 && h >= 24), sizes);
step('8 sin errores de página', errors.length === 0, { errors });
await browser.close();
console.log(failed === 0 ? '\nTODO OK' : `\nFALLARON ${failed}`);
process.exit(failed === 0 ? 0 : 1);
