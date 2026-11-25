// U3-M: dibujo táctil en Chrome móvil (390×844, puerto 5186): cada toque coloca un punto; tocar el primero cierra; un arrastre
// con un dedo desplaza la página y no agrega puntos.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const SHOTS = path.join(process.env.TMPDIR, 'u3x-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
let failed = 0;
const errors = [];
const step = (name, ok, data = {}) => { if (!ok) failed += 1; console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data)); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) errors.push(m.text()); });
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nRegions = () => page.locator('[data-layer="regions"] polygon').count();

await page.goto(URL_);
await page.waitForSelector('[data-layer="regions"] polygon');
await page.getByRole('button', { name: 'Archivo', exact: true }).tap();
await page.getByRole('button', { name: 'Nuevo', exact: true }).tap();
await page.waitForSelector('[data-testid="canvas-empty"]');
await page.evaluate(() => document.querySelector('svg.ec-svg').scrollIntoView({ block: 'start' }));
await sleep(300);
await page.screenshot({ path: path.join(SHOTS, 'u3m-m390-01-vacio.png') });
await page.locator('[data-testid="canvas-empty"]').getByRole('button', { name: 'Dibujar región' }).tap();
await page.waitForSelector('[data-testid="draw-hint"]');
const box = await page.locator('svg.ec-svg').boundingBox();
const scale = Math.min((box.width - 96) / 60, (box.height - 96) / 30);
const tx = box.width / 2 - scale * 30;
const ty = box.height / 2 + scale * 15;
const px = (x, y) => [box.x + tx + scale * x, box.y + ty - scale * y];
const pts = [[10, 6], [50, 6], [42, 16], [14, 20]];
for (const [x, y] of pts) { const [sx, sy] = px(x, y); await page.touchscreen.tap(sx, sy); await sleep(80); }
const placed = await page.locator('[data-draw-point]').count();
await page.screenshot({ path: path.join(SHOTS, 'u3m-m390-02-puntos.png') });

// Un arrastre con un dedo desplaza la página y no agrega puntos
const scrollBefore = await page.evaluate(() => window.scrollY);
const [dx, dy] = px(30, 26);
await touch('touchStart', [[dx, dy]]);
for (let i = 1; i <= 12; i += 1) { await touch('touchMove', [[dx, dy - i * 15]]); await sleep(16); }
await touch('touchEnd', []);
await sleep(400);
const scrollAfter = await page.evaluate(() => window.scrollY);
const placedAfterDrag = await page.locator('[data-draw-point]').count();
step('1 cada toque coloca un punto (4 toques = 4 puntos)', placed === 4, { placed });
step('2 un arrastre con el dedo desplaza la página y no agrega puntos', placedAfterDrag === 4 && scrollAfter > scrollBefore + 20, { scrollBefore, scrollAfter, placedAfterDrag });

// Cierra tocando el primer punto (radio táctil de 22 px)
await page.evaluate(() => document.querySelector('svg.ec-svg').scrollIntoView({ block: 'start' }));
await sleep(300);
const box2 = await page.locator('svg.ec-svg').boundingBox();
const [fx, fy] = [box2.x + tx + scale * 10 + 15, box2.y + ty - scale * 6 + 10]; // a ~18 px del primer punto
await page.touchscreen.tap(fx, fy);
await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length === 1);
const verts = await page.locator('[data-handle-key^="v-0-"]').count();
step('3 tocar cerca del primer punto cierra la región (4 vértices) y es un solo Deshacer', (await nRegions()) === 1 && verts === 4, { regiones: await nRegions(), verts });
await page.getByRole('button', { name: 'Deshacer', exact: true }).tap();
step('3b Deshacer quita la región entera', (await nRegions()) === 0);
await page.screenshot({ path: path.join(SHOTS, 'u3m-m390-03-cerrada.png') });
step('4 sin errores de página', errors.length === 0, { errors });
await browser.close();
process.exit(failed === 0 ? 0 : 1);
