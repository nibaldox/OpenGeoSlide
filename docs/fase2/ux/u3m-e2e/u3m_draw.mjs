// U3-M: recorrido en Chrome (puerto 5186). Modelo vacío → dibujar con el ratón una región de 4 vértices → dibujar con el teclado otra
// de 4 vértices → asignar material → Comprobar → FS (debe coincidir con el CLI: 1,7724 / 1,7717). Después, un único Deshacer, el
// Talud simple… calculado, y el cierre inválido.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SHOTS = path.join(process.env.TMPDIR, 'u3x-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const out = { steps: [], consoleErrors: [] };
let failed = 0;
const step = (name, ok, data = {}) => {
  if (!ok) failed += 1;
  out.steps.push({ name, ok, ...data });
  console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data));
};
const num = (t) => Number(String(t).replace(/\s/g, '').replace(',', '.'));

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => out.consoleErrors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) out.consoleErrors.push(m.text()); });
page.on('dialog', (d) => d.accept());
const shot = async (n) => { const p = path.join(SHOTS, 'u3m-' + n + '.png'); await page.screenshot({ path: p }); return p; };
async function openMenu(name) {
  const trigger = page.getByRole('button', { name, exact: true });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  await page.waitForFunction((n) => [...document.querySelectorAll('button.dd-trigger')].some((b) => b.textContent.trim().startsWith(n) && b.getAttribute('aria-expanded') === 'true'), name);
}
const live = () => page.waitForTimeout(300).then(() => page.textContent('[data-testid="live-polite"]')).then((t) => (t ?? '').trim());
const nRegions = () => page.locator('[data-layer="regions"] polygon').count();
const toolBtn = () => page.locator('[role="toolbar"]').getByRole('button', { name: 'Dibujar región' });
const polys = () => page.evaluate(() => [...document.querySelectorAll('[data-layer="regions"] polygon')].map((p) => p.getAttribute('points')));

await page.goto(URL_);
await page.waitForSelector('[data-testid="engine-banner"]', { timeout: 20000 });
await page.waitForSelector('[data-layer="regions"] polygon');

// 1. Nuevo → modelo vacío con el estado vacío del lienzo
await openMenu('Archivo');
await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
await page.waitForSelector('[data-testid="canvas-empty"]');
const emptyText = await page.textContent('[data-testid="canvas-empty"]');
const acts = await page.locator('[data-testid="canvas-empty"] button').allTextContents();
step('1 «Nuevo» da un modelo vacío con estado vacío (2 acciones + DXF/CSV)', (await nRegions()) === 0 && acts.join('|') === 'Dibujar región|Abrir un ejemplo' && /DXF/.test(emptyText) && /CSV/.test(emptyText), { acciones: acts, texto: emptyText.trim().slice(0, 160), shot: await shot('01-vacio') });

// Rejilla de 5 m para que el dibujo con el ratón dé coordenadas exactas (Geometría ▸ Ajuste)
await page.getByRole('tab', { name: 'Geometría' }).click();
await page.getByLabel('Rejilla de ajuste').selectOption('1');

// 2. Dibujar región con el ratón: 4 vértices, cierra con Intro
await page.locator('[data-testid="canvas-empty"]').getByRole('button', { name: 'Dibujar región' }).click();
await page.waitForSelector('[data-testid="draw-hint"]');
const pressed = await toolBtn().getAttribute('aria-pressed');
const focusOnSvg = await page.evaluate(() => document.activeElement?.getAttribute('role') === 'application');
const box = await page.locator('svg.ec-svg').boundingBox();
// Viewport inicial del modelo vacío: encuadre de 60 × 30 con margen 48
const scale = Math.min((box.width - 96) / 60, (box.height - 96) / 30);
const tx = box.width / 2 - scale * 30;
const ty = box.height / 2 + scale * 15;
const px = (x, y) => [box.x + tx + scale * x, box.y + ty - scale * y];
const click = async (x, y) => { const [sx, sy] = px(x, y); await page.mouse.move(sx, sy); await page.mouse.click(sx, sy); };
await click(0, -3);
await click(50, -3);
await click(50, 0);
const [mx, my] = px(8, 6);
await page.mouse.move(mx, my);
await page.waitForTimeout(100);
const rubber = await page.locator('[data-draw-rubber]').count();
const previewShot = await shot('02-mouse-preview');
await click(0, 0);
const hintN = (await page.textContent('[data-testid="draw-hint"]')).includes('4 puntos');
const countBefore = await nRegions();
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length === 1);
const poly1 = (await polys())[0];
step('2 dibujo con el ratón: 4 clics y Intro crean 1 región de 4 vértices (arista elástica visible)', pressed === 'true' && focusOnSvg && rubber === 1 && hintN && countBefore === 0 && (await page.locator('[data-handle-key^="v-0-"]').count()) === 4, { pressed, focusOnSvg, rubber, puntos: poly1, shot: previewShot });
const toolAfter = await toolBtn().getAttribute('aria-pressed');
step('2b al cerrar, la herramienta vuelve a «Seleccionar» y la región queda seleccionada', toolAfter === 'false' && (await page.locator('[data-region-card="0"].ep-row-selected').count()) === 1, { toolAfter, anuncio: await live() });

// 3. Un solo paso deshacible
const undo = page.getByRole('button', { name: 'Deshacer', exact: true });
await undo.click();
const afterUndo = await nRegions();
const undoDisabled = await undo.isDisabled();
await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
step('3 un solo Deshacer quita la región entera (y Rehacer la devuelve)', afterUndo === 0 && undoDisabled && (await nRegions()) === 1, { trasDeshacer: afterUndo, deshacerDeshabilitado: undoDisabled });

// 4. Dibujar con el teclado (R, flechas, Espacio, Intro), sin rejilla: paso de 0,1 m
await page.getByLabel('Rejilla de ajuste').selectOption('');
await page.locator('[role="toolbar"]').getByRole('button', { name: 'Seleccionar', exact: true }).focus();
await page.keyboard.press('r');
await page.waitForSelector('[data-testid="draw-hint"]');
const kbFocus = await page.evaluate(() => document.activeElement?.getAttribute('role'));
const cursorXY = async () => {
  const t = await live();
  const m = /Cursor: x (-?[\d,]+) m, y (-?[\d,]+) m/.exec(t);
  return m ? [num(m[1]), num(m[2])] : null;
};
async function moveCursorTo(tx_, ty_) {
  // primer movimiento: parte del centro de la vista (o del último punto)
  let cur = await cursorXY();
  if (!cur) { await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft'); cur = await cursorXY(); }
  for (let guard = 0; guard < 400; guard += 1) {
    const dx = Math.round((tx_ - cur[0]) * 10) / 10;
    const dy = Math.round((ty_ - cur[1]) * 10) / 10;
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
  throw new Error('no llegó al punto ' + tx_ + ',' + ty_);
}
const placed = [];
for (const [x, y] of [[0, 0], [50, 0], [50, 5], [0, 25]]) {
  await moveCursorTo(x, y);
  await page.keyboard.press(' ');
  placed.push(await live());
}
const kbShot = await shot('03-keyboard-preview');
await page.keyboard.press('Enter'); // cursor sin mover: cierra
await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length === 2);
const polyList = await polys();
step('4 dibujo con el teclado: flechas (0,1 m; Mayús ×10; Ctrl ×100), Espacio coloca e Intro cierra', kbFocus === 'application' && (await page.locator('[data-handle-key^="v-1-"]').count()) === 4, { anuncios: placed, regiones: polyList.length, shot: kbShot });
const closeMsg = await live();
step('4b anuncio de cierre por la región viva', /Región 2 creada con el material Suelo \(4 vértices\)/.test(closeMsg), { closeMsg });

// 5. Material: nuevo material y asignarlo a la región 2
await page.getByRole('tab', { name: 'Materiales' }).click();
await page.getByRole('button', { name: 'Nuevo material…' }).click();
await page.getByRole('button', { name: 'Agregar material' }).click();
await page.getByRole('tab', { name: 'Geometría' }).click();
await page.locator('select[data-path="/regions/1/material"]').selectOption('m1');
const mat1 = await page.locator('select[data-path="/regions/1/material"]').inputValue();
step('5 asignar material a la región dibujada con el teclado', mat1 === 'm1');

// 6. Comprobar → FS (CLI: Bishop 2,0759, Spencer 2,0754)
await page.getByRole('button', { name: 'Comprobar', exact: true }).first().click();
await page.waitForSelector('[data-testid="results-panel"] table tbody tr', { timeout: 60000 });
await page.waitForSelector('button:has-text("Comprobar"):not([disabled])');
const rows = await page.$$eval('[data-testid="results-panel"] table tbody tr', (r) => r.map((x) => [...x.querySelectorAll('td')].map((c) => c.textContent.trim())));
const fs = rows.map((r) => num(r[1]));
step('6 Comprobar: FS finito de Bishop y Spencer, igual que el CLI (1,7724 / 1,7717)', fs.length === 2 && Math.abs(fs[0] - 1.7724) < 5e-4 && Math.abs(fs[1] - 1.7717) < 5e-4, { filas: rows.map((r) => r.slice(0, 3)), shot: await shot('04-fs-dibujado') });

// 7. Cierre inválido: un solape no se agrega y explica el problema (el cruce del contorno se rechaza al colocar el punto)
await page.keyboard.press('Escape'); // salir de cualquier foco
await page.locator('[role="toolbar"]').getByRole('button', { name: 'Dibujar región' }).click();
const box2 = await page.locator('svg.ec-svg').boundingBox();
const vp2 = await page.evaluate(() => { const g = document.querySelector('[data-layer="grid"]'); return null; });
const [a1x, a1y] = [box2.x + 120, box2.y + 120];
for (const [dx, dy] of [[0, 0], [150, 120], [150, 0], [0, 120]]) { await page.mouse.click(a1x + dx, a1y + dy); }
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const err = await page.textContent('[data-testid="draw-hint"]');
const stillTwo = (await nRegions()) === 2;
step('7 una región que se solapa con otra no se agrega: queda el dibujo y se explica', stillTwo && /se solapan/.test(err), { regiones: await nRegions(), mensaje: err.trim().slice(0, 220), shot: await shot('05-cierre-invalido') });
// 7b. Retroceso quita el último punto; Esc cancela el dibujo; un segundo Esc vuelve a «Seleccionar»
const nPts = () => page.locator('[data-draw-point]').count();
const before3 = await nPts();
await page.keyboard.press('Backspace');
const afterBs = await nPts();
await page.keyboard.press('Escape');
const afterEsc = await nPts();
const stillDrawing = (await toolBtn().getAttribute('aria-pressed')) === 'true';
await page.keyboard.press('Escape');
const leftTool = (await toolBtn().getAttribute('aria-pressed')) === 'false';
step('7b Retroceso quita un punto, Esc cancela el dibujo (sin agregar región) y otro Esc sale de la herramienta', before3 === 3 && afterBs === 2 && afterEsc === 0 && stillDrawing && leftTool && (await nRegions()) === 2, { before3, afterBs, afterEsc, stillDrawing, leftTool });

// 8. Talud simple…
await openMenu('Archivo');
await page.getByRole('button', { name: 'Talud simple…' }).click();
await page.waitForSelector('dialog[open]');
const dlgShot = await shot('06-talud-dialogo');
const prevOk = (await page.locator('[data-testid="slope-preview"]').count()) === 1;
await page.getByRole('button', { name: 'Crear talud' }).click();
await page.waitForSelector('dialog[open]', { state: 'detached' });
await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length === 1);
const slopePoly = (await polys())[0];
await page.getByRole('button', { name: 'Comprobar', exact: true }).first().click();
await page.waitForSelector('[data-testid="results-panel"] table tbody tr', { timeout: 60000 });
await page.waitForSelector('button:has-text("Comprobar"):not([disabled])');
const rows2 = await page.$$eval('[data-testid="results-panel"] table tbody tr', (r) => r.map((x) => [...x.querySelectorAll('td')].map((c) => c.textContent.trim())));
const fs2 = rows2.map((r) => num(r[1]));
step('8 Talud simple (H=10, β=45°, c=10, φ=30, γ=20): FS finito con Bishop y Spencer = CLI (1,2039 / 1,1995)', prevOk && fs2.length === 2 && Math.abs(fs2[0] - 1.2039) < 5e-4 && Math.abs(fs2[1] - 1.1995) < 5e-4, { filas: rows2.map((r) => r.slice(0, 3)), poligono: slopePoly, shot: await shot('07-talud-fs'), dlg: dlgShot });

step('Errores de consola', out.consoleErrors.length === 0, { errores: out.consoleErrors });
writeFileSync(path.join(SHOTS, 'u3m-draw.json'), JSON.stringify(out, null, 2));
await browser.close();
console.log(failed === 0 ? 'TODO OK' : `${failed} FALLOS`);
process.exit(failed === 0 ? 0 : 1);
