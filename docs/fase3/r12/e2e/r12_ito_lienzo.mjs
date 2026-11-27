// F3G-R12 W2 (E15l-21 y E15l-22): recorrido en Chrome del pilote Ito-Matsui en el lienzo, con el MOTOR REAL (WASM de la web, sin
// inyección ni datos simulados), en claro y oscuro:
//   1. arrastrar la punta con el ratón y moverla con el teclado: el pilote sigue vertical (x1 = x2) y el modelo sigue calculando;
//   2. la flecha de la fuerza nace en (x, y + arm) con `centroid` y en el cruce (x, y) con `slip_surface` (el cruce sale de la superficie
//      fija del modelo, calculado aquí con la ecuación del círculo, no del DOM);
//   3. la información emergente de la flecha trae la fuerza del suelo, qué gobierna y el brazo;
//   4. Casos y el PDF con el mismo modelo (el PDF se guarda en SHOTS para verlo rasterizado) y axe-core.
// Uso: OGS_URL=http://127.0.0.1:5187/ OGS_REPO=$PWD TMPDIR=<scratch> node docs/fase3/r12/e2e/r12_ito_lienzo.mjs
//   (playwright-core desde docs/node_modules; axe-core: AXE=<axe.min.js> o <scratch>/x8-ux/node_modules/axe-core/axe.min.js). SHOTS=<carpeta> cambia las capturas.
// Imprime una línea `OK` o `FAIL` por comprobación (el runner cuenta ^FAIL y exige al menos un ^OK).
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const TMP = process.env.TMPDIR ?? os.tmpdir();
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5187/';
const SHOTS = process.env.SHOTS ?? path.join(TMP, 'r12-ito-lienzo-shots');
mkdirSync(SHOTS, { recursive: true });
const AXE = [process.env.AXE, path.join(TMP, 'x8-ux/node_modules/axe-core/axe.min.js'), path.join(TMP, 'w2-e2e/node_modules/axe-core/axe.min.js')].find((p) => p && existsSync(p));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
let fails = 0, oks = 0; const errors = [];
const step = (n, ok, d = {}) => { if (ok) oks++; else fails++; console.log(ok ? 'OK  ' : 'FAIL', n, JSON.stringify(d)); };
step('axe-core disponible', !!AXE, { AXE });
async function axe(p, label) {
  if (!AXE) return;
  await p.addScriptTag({ path: AXE });
  const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })));
  const sc = r.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  step(`axe ${label}`, sc.length === 0, { sc, otras: r.filter((v) => !sc.includes(v)).map((v) => `${v.id}:${v.impact}`) });
}

// Modelo: el ejemplo ACADS 1(a) con un pilote Ito-Matsui vertical en x = 45 (cabeza y = 32,5; punta y = 26,5) y una superficie circular fija que lo
// cruza. El cruce en x = 45 sale de la ecuación del círculo.
const CIRCLE = { xc: 38, yc: 38, r: 12.5 };
const PILE_X = 45;
const crossY = CIRCLE.yc - Math.sqrt(CIRCLE.r ** 2 - (PILE_X - CIRCLE.xc) ** 2);
const num = (s) => Number(String(s).replace(',', '.'));
const PX_TOL = 0.75; // el rótulo redondea el brazo a 2 decimales (0,005 m ≈ 0,08 px); el resto es redondeo del DOM

/** Centro (en la página) de un tirador del lienzo. */
async function center(p, key) {
  const box = await p.locator(`[data-handle-key="${key}"] [data-hit-area]`).boundingBox();
  return [box.x + box.width / 2, box.y + box.height / 2];
}
/** Coordenadas del SVG (cx, cy) del tirador: sirven para la escala px/m. */
const handleCx = (p, key = 'r-0-1') => p.locator(`[data-handle-key="${key}"] [data-hit-area]`).getAttribute('cx').then(Number);
const handleCy = (p, key) => p.locator(`[data-handle-key="${key}"] [data-hit-area]`).getAttribute('cy').then(Number);
const handleLabel = (p, key) => p.locator(`[data-handle-key="${key}"]`).getAttribute('aria-label');
async function arrow(p) {
  return p.evaluate(() => {
    const g = document.querySelector('[data-force="p1"]');
    if (!g) return null;
    const line = g.querySelector('[data-force-arrow]');
    return { x1: Number(line.getAttribute('x1')), y1: Number(line.getAttribute('y1')), title: g.querySelector('title')?.textContent ?? '' };
  });
}
async function check(p) {
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await p.waitForSelector('[data-force="p1"]', { state: 'attached', timeout: 30000 });
}

for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme, acceptDownloads: true });
  await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); localStorage.setItem('ogs.theme.v1', t); } catch {} }, theme);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) errors.push(m.text()); });
  p.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await p.goto(URL_);
  await p.waitForSelector('[data-layer="regions"] polygon');
  await p.waitForFunction(() => /ogs-core/.test(document.querySelector('[data-testid="engine-banner"]')?.textContent ?? ''));

  // ── Preparación: pilote Ito-Matsui desde el panel, guardado, superficie fija y reapertura ──
  await p.getByRole('tab', { name: 'Refuerzos' }).click();
  await p.getByRole('button', { name: 'Agregar pilote' }).click();
  const panel = p.locator('#ea-tabpanel');
  await panel.getByLabel('Refuerzo 1: Origen de la fuerza', { exact: true }).selectOption('ito_matsui');
  await p.waitForTimeout(200);
  await p.getByRole('button', { name: 'Archivo' }).click();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /^Guardar/ }).first().click()]);
  const base = path.join(TMP, `r12-ito-${theme}.ogs.json`); await dl.saveAs(base);
  const model = JSON.parse(readFileSync(base, 'utf8'));
  step(`${theme}: el pilote guardado es vertical y con presión del suelo`, model.reinforcements?.[0]?.x1 === PILE_X && model.reinforcements[0].x2 === PILE_X && model.reinforcements[0].lateral_pressure?.location === 'centroid', { r: model.reinforcements?.[0] });
  const variant = (location) => {
    const m = structuredClone(model);
    m.analysis.surface = { type: 'circle', ...CIRCLE };
    m.analysis.search = null;
    m.analysis.methods = ['bishop'];
    m.reinforcements[0].lateral_pressure.location = location;
    const f = path.join(TMP, `r12-ito-${theme}-${location}.ogs.json`);
    writeFileSync(f, JSON.stringify(m));
    return f;
  };
  const files = { centroid: variant('centroid'), slip_surface: variant('slip_surface') };
  await p.setInputFiles('[data-testid="file-open"]', files.centroid);
  await p.waitForTimeout(400);
  await p.getByRole('tab', { name: 'Refuerzos' }).click();
  await check(p);

  // ── E15l-22: punto de aplicación de la flecha ──
  const headCy = await handleCy(p, 'r-0-1');
  const tipCy = await handleCy(p, 'r-0-2');
  const scale = (tipCy - headCy) / 6; // px por metro (la pila mide 6 m)
  const yPx = (worldY) => headCy + (32.5 - worldY) * scale;
  let a = await arrow(p);
  const arm = num(/brazo ([\d,]+) m/.exec(a.title)?.[1]);
  step(`${theme}: la información emergente trae la fuerza del suelo, qué gobierna y el brazo`, /Fuerza del suelo [\d,]+ kN\/m/.test(a.title) && /gobierna (el suelo|el corte|la flexión)/.test(a.title) && Number.isFinite(arm) && arm > 0, { title: a.title });
  step(`${theme}: centroid: la flecha nace en (x, y + arm) (y = ${crossY.toFixed(3)}, arm = ${arm})`, Math.abs(a.y1 - yPx(crossY + arm)) < PX_TOL && Math.abs(a.x1 - (await handleCx(p))) < 0.01, { y1: a.y1, esperado: yPx(crossY + arm), alCruce: yPx(crossY) });
  await p.screenshot({ path: path.join(SHOTS, `${theme}-1-centroid.png`) });
  await axe(p, `${theme} lienzo con la flecha en y + arm`);

  // PDF del modelo con centroid: se guarda para verlo rasterizado
  const [pdfDl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Informe PDF' }).click()]);
  const pdfPath = path.join(SHOTS, `${theme}-ito-centroid.pdf`); await pdfDl.saveAs(pdfPath);
  step(`${theme}: PDF generado con el pilote Ito-Matsui`, readFileSync(pdfPath).subarray(0, 5).toString('latin1') === '%PDF-', { bytes: readFileSync(pdfPath).length });
  spawnSync('pdftoppm', ['-r', '80', '-png', '-f', '1', '-l', '3', pdfPath, path.join(SHOTS, `${theme}-ito-centroid-pdf`)]);

  // Casos: el mismo modelo en «Casos de verificación» (Canvas 2D), con centroid y con slip_surface; el dibujo cambia
  const casosImage = async (file) => {
    await p.getByRole('tab', { name: 'Casos de verificación' }).click();
    await p.waitForSelector('.cases-view');
    await p.locator('.cases-view input[type="file"]').setInputFiles(file);
    await p.waitForTimeout(300);
    await p.getByRole('button', { name: 'Comprobar caso', exact: true }).click();
    await p.waitForSelector('.cases-view #results-title', { timeout: 60000 });
    await p.waitForFunction(() => document.querySelector('.cases-view table') && !/Comprobando/.test(document.body.innerText), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    return p.evaluate(() => {
      const c = document.querySelector('.cases-view canvas');
      if (!c) return null;
      return { width: c.width, height: c.height, data: c.toDataURL() };
    });
  };
  const casC = await casosImage(files.centroid);
  await p.screenshot({ path: path.join(SHOTS, `${theme}-2-casos-centroid.png`), fullPage: true });
  const casS = await casosImage(files.slip_surface);
  await p.screenshot({ path: path.join(SHOTS, `${theme}-3-casos-slip.png`), fullPage: true });
  step(`${theme}: Casos dibuja un lienzo para cada ubicación y la flecha cambia con la ubicación (centroid ≠ slip_surface)`, !!casC?.data && !!casS?.data && casC.data !== casS.data, { w: casC?.width, h: casC?.height });
  await axe(p, `${theme} Casos con el pilote Ito-Matsui`);
  await p.getByRole('tab', { name: 'Editar' }).click();
  await p.waitForSelector('[data-layer="regions"] polygon');

  // ── E15l-22: slip_surface → la flecha nace en el cruce ──
  await p.setInputFiles('[data-testid="file-open"]', files.slip_surface);
  await p.waitForTimeout(400);
  await p.getByRole('tab', { name: 'Refuerzos' }).click();
  await check(p);
  a = await arrow(p);
  step(`${theme}: slip_surface: la flecha nace en el cruce (x, y = ${crossY.toFixed(3)})`, Math.abs(a.y1 - yPx(crossY)) < PX_TOL, { y1: a.y1, esperado: yPx(crossY) });
  await p.screenshot({ path: path.join(SHOTS, `${theme}-4-slip.png`) });

  // ── E15l-21: arrastre y teclado con el pilote Ito-Matsui (vuelta a centroid) ──
  await p.setInputFiles('[data-testid="file-open"]', files.centroid);
  await p.waitForTimeout(400);
  await p.getByRole('tab', { name: 'Refuerzos' }).click();
  await check(p);
  const [tx, ty] = await center(p, 'r-0-2');
  await p.mouse.move(tx, ty);
  await p.mouse.down();
  await p.mouse.move(tx + 40, ty - 10, { steps: 5 });
  await p.mouse.move(tx + 90, ty - 20, { steps: 5 });
  await p.mouse.up();
  await p.waitForTimeout(300);
  let tipLabel = await handleLabel(p, 'r-0-2');
  let headLabel = await handleLabel(p, 'r-0-1');
  step(`${theme}: arrastrar la punta 90 px a la derecha la deja en x = 45,0 (vertical)`, /punta: x 45,0 m, y /.test(tipLabel) && /cabeza: x 45,0 m/.test(headLabel), { tipLabel, headLabel });
  step(`${theme}: el arrastre sí cambió la y de la punta`, !/y 26,5 m/.test(tipLabel), { tipLabel });
  step(`${theme}: tras arrastrar no hay error de pilote vertical`, !/es vertical; la x de la punta/.test(await p.locator('body').innerText()));
  // Teclado: izquierda y derecha no inclinan; arriba y abajo mueven.
  await p.locator('[data-handle-key="r-0-2"]').focus();
  const live = p.locator('[data-testid="live-polite"]');
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(200);
  const afterRight = await handleLabel(p, 'r-0-2');
  step(`${theme}: la flecha derecha no inclina el pilote y lo dice`, /punta: x 45,0 m/.test(afterRight) && /vertical/.test(await live.innerText()), { afterRight, live: await live.innerText() });
  await p.keyboard.press('ArrowLeft');
  await p.waitForTimeout(200);
  step(`${theme}: la flecha izquierda tampoco`, /punta: x 45,0 m/.test(await handleLabel(p, 'r-0-2')));
  const yBefore = await handleLabel(p, 'r-0-2');
  await p.keyboard.press('ArrowDown');
  await p.waitForTimeout(200);
  const afterDown = await handleLabel(p, 'r-0-2');
  step(`${theme}: la flecha abajo mueve la punta y conserva x = 45,0`, afterDown !== yBefore && /punta: x 45,0 m/.test(afterDown), { yBefore, afterDown });
  // Mover el cuerpo entero con el centro (teclado) conserva la verticalidad
  await p.locator('[data-handle-key="r-0-c"]').focus();
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(200);
  const head2 = await handleLabel(p, 'r-0-1');
  const tip2 = await handleLabel(p, 'r-0-2');
  const hx = /cabeza: x ([\d,]+) m/.exec(head2)?.[1];
  const tx2 = /punta: x ([\d,]+) m/.exec(tip2)?.[1];
  step(`${theme}: mover el centro desplaza la cabeza y la punta juntas (x1 = x2 = ${hx})`, hx === tx2 && hx !== '45,0', { head2, tip2 });
  // El modelo sigue calculando con el pilote movido
  await check(p);
  await p.waitForTimeout(300);
  const body = await p.locator('body').innerText();
  step(`${theme}: el modelo con el pilote movido calcula sin error de verticalidad`, !/reinforcement_pile_vertical|es vertical; la x de la punta/.test(body) && /FS \d/.test(body));
  await p.screenshot({ path: path.join(SHOTS, `${theme}-5-movido.png`) });
  await axe(p, `${theme} lienzo con el pilote movido`);
  step(`${theme}: consola sin errores ni HTTP ≥ 400`, errors.length === 0, { errors });
  await ctx.close();
}
await b.close();
console.log(`RESUMEN OK=${oks} FAIL=${fails} errores_consola=${errors.length}`);
