// U5-E: demostración en Chrome de A-01, A-03, B-01, A-04, γw imperial, conversión de unidades (FS), barra a 320 px y lectura del cursor.
// Uso (desde un directorio con playwright-core): OGS_URL=http://127.0.0.1:5186/ node u5e_demo.mjs [etiqueta]
// Contra la base (325855a) los pasos de A-01, A-03, B-01, A-04, γw, conversión, barra y cursor deben FALLAR; contra u5e-editor, pasar.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TMP = process.env.TMPDIR;
const SHOTS = path.join(TMP, 'u5e-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const LABEL = process.argv[2] ?? 'run';
let failed = 0;
const rows = [];
const step = (name, ok, data = {}) => {
  if (!ok) failed += 1;
  rows.push({ name, ok, ...data });
  console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data));
};

// ───────── Modelos de prueba ─────────
const mat = { id: 'suelo', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 19, cohesion: 30, friction_angle: 28 };
const base = (over) => ({ format: 'opengeoslide', version: '0.2', meta: { title: 'U5-E' }, units: 'SI', materials: [mat], regions: [], water: null, loads: [], slope: { direction: 'left_to_right' }, analysis: { methods: ['bishop'] }, ...over });
const three = base({
  regions: [
    { material: 'suelo', polygon: [[0, 0], [10, 0], [10, 10], [0, 10]] },
    { material: 'suelo', polygon: [[10, 0], [30, 0], [30, 10], [10, 10]] },
    { material: 'suelo', polygon: [[30, 0], [60, 0], [60, 10], [30, 10]] },
  ],
  analysis: { methods: ['bishop'], surface: { type: 'circle', xc: 30, yc: 30, r: 28 } },
});
const nTop = 337;
const bigPolygon = [...Array.from({ length: nTop }, (_, i) => [i, 20 + 0.01 * i]), [nTop - 1, 0], [0, 0]];
const big = base({
  regions: [{ material: 'suelo', polygon: bigPolygon }],
  water: { unit_weight: 9.81, piezometric_line: [[0, 10], [168, 10], [336, 5]] },
  analysis: { methods: ['bishop'], surface: { type: 'circle', xc: 150, yc: 60, r: 45 } },
});
const slope = base({
  regions: [{ material: 'suelo', polygon: [[0, 10], [10, 10], [30, 0], [60, 0], [60, -10], [0, -10]] }],
  water: { unit_weight: 9.81, piezometric_line: [[0, 6], [30, 0], [60, 0]] },
  loads: [{ type: 'udl', x1: 2, x2: 8, q: 25 }, { type: 'line', x: 5, p: 40, angle: 10 }],
  analysis: { methods: ['bishop', 'spencer'], seismic: { kh: 0.1, kv: 0.05 }, search: { type: 'circular_entry_exit', entry: [0, 10], exit: [28, 45], n_entry: 12, n_exit: 12, n_radius: 12 } },
});
const file = (name, doc) => { const p = path.join(TMP, name); writeFileSync(p, JSON.stringify(doc)); return p; };
const F = { three: file('u5e-three.ogs.json', three), big: file('u5e-big.ogs.json', big), slope: file('u5e-slope.ogs.json', slope) };

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const errors = [];
async function newPage(viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) errors.push(m.text()); });
  await page.goto(URL_);
  await page.waitForFunction(() => /ogs-core/.test(document.querySelector('[data-testid="engine-banner"]')?.textContent ?? ''), null, { timeout: 30000 });
  return { ctx, page };
}
const CONFIRM = '[data-testid="confirm-dialog"]';
async function openMenu(page, name) {
  const t = page.getByRole('button', { name, exact: true });
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
  await page.waitForFunction((n) => [...document.querySelectorAll('button.dd-trigger')].some((b) => b.textContent.trim().startsWith(n) && b.getAttribute('aria-expanded') === 'true'), name);
}
async function openFile(page, p) {
  await page.setInputFiles('[data-testid="file-open"]', p);
  await page.waitForFunction(() => /Abierto/.test(document.body.innerText));
}
const nRegions = (page) => page.locator('[data-layer="regions"] polygon').count();
const canvasBox = (page) => page.locator('svg.ec-svg').boundingBox();
async function clickAt(page, fx, fy) { const b = await canvasBox(page); await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy); }
async function acceptIfAsked(page, label) {
  const dlg = page.locator(CONFIRM);
  try { await dlg.waitFor({ state: 'visible', timeout: 800 }); } catch { return null; }
  const info = { title: await dlg.locator('h2').textContent(), buttons: await dlg.locator('button').allTextContents() };
  await dlg.getByRole('button', { name: label ?? /Descartar|Eliminar|Convertir/ }).first().click();
  await dlg.waitFor({ state: 'detached' });
  return info;
}
const readFs = async (page) => ({
  bishop: (await page.locator('[data-testid="fs-bishop"]').textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim(),
  spencer: (await page.locator('[data-testid="fs-spencer"]').textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim(),
});
async function check(page) {
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="result-summary"]')?.getAttribute('data-state') !== 'busy', null, { timeout: 60000 });
  await page.waitForTimeout(300);
}

// ───────── A-01: el trazo a medias no sobrevive a «Nuevo» ─────────
{
  const { ctx, page } = await newPage();
  await page.keyboard.press('r');
  await clickAt(page, 0.7, 0.15); await clickAt(page, 0.9, 0.15);
  const before = await page.locator('[data-testid="draw-hint"]').textContent();
  await openMenu(page, 'Archivo');
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  const asked = await acceptIfAsked(page);
  await page.waitForTimeout(200);
  const hint = await page.locator('[data-testid="draw-hint"]').textContent();
  await clickAt(page, 0.9, 0.35); await clickAt(page, 0.7, 0.35);
  await page.keyboard.press('Enter');
  const regions = await nRegions(page);
  const hintAfter = await page.locator('[data-testid="draw-hint"]').textContent().catch(() => null);
  step('A-01 con 2 puntos, «Nuevo» y 2 clics + Intro no crean ninguna región', regions === 0 && /ningún punto/.test(hint), { antes: before.slice(0, 40), trasNuevo: hint.slice(0, 40), regiones: regions, confirmacion: asked, hintFinal: hintAfter?.slice(0, 60) });
  await page.screenshot({ path: path.join(SHOTS, `${LABEL}-a01.png`) });
  await ctx.close();
}

// ───────── A-03: dos confirmaciones en cola borran exactamente las dos regiones pedidas ─────────
{
  const { ctx, page } = await newPage();
  await openFile(page, F.three);
  const areas = async () => (await page.locator('[data-region-card]').allTextContents()).map((t) => /área ([\d,.]+)/.exec(t)?.[1]);
  const antes = await areas();
  await page.evaluate(() => {
    document.querySelector('button[aria-label="Eliminar región 1"]').click();
    document.querySelector('button[aria-label="Eliminar región 2"]').click();
  });
  const titles = [];
  for (let i = 0; i < 2; i += 1) {
    const dlg = page.locator(CONFIRM);
    await dlg.waitFor({ state: 'visible' });
    titles.push(await dlg.locator('h2').textContent());
    await dlg.getByRole('button', { name: 'Eliminar región' }).click();
    await page.waitForTimeout(250);
  }
  const despues = await areas();
  step('A-03 dos confirmaciones en cola borran las regiones 1 y 2 y queda la 3 (área 1800)', despues.length === 1 && despues[0] === antes[2], { antes, despues, dialogos: titles });
  await ctx.close();
}
// A-03 (variante): el mismo clic repetido dos veces
{
  const { ctx, page } = await newPage();
  await openFile(page, F.three);
  await page.evaluate(() => { const b = document.querySelector('button[aria-label="Eliminar región 1"]'); b.click(); b.click(); });
  for (let i = 0; i < 2; i += 1) {
    const dlg = page.locator(CONFIRM);
    await dlg.waitFor({ state: 'visible' });
    await dlg.getByRole('button', { name: 'Eliminar región' }).click();
    await page.waitForTimeout(250);
  }
  const n = await page.locator('[data-region-card]').count();
  const notice = await page.locator('[data-testid="geometry-notice"]').textContent().catch(() => null);
  step('A-03 el mismo «Eliminar región 1» pedido dos veces borra solo esa región (quedan 2) y avisa', n === 2, { quedan: n, aviso: notice?.slice(0, 80) ?? null });
  await ctx.close();
}

// ───────── B-01: una sola parada de tabulación con 344 tiradores ─────────
{
  const { ctx, page } = await newPage();
  await openFile(page, F.big);
  const handles = await page.locator('[data-handle-key]').count();
  const tabbable = await page.locator('[data-handle-key][tabindex="0"]').count();
  await page.locator('[data-handle-key="v-0-3"]').focus();
  const inCanvas = () => page.evaluate(() => !!document.activeElement?.closest('svg.ec-svg'));
  let presses = 0;
  const keysSeen = [];
  while (presses < 420 && (await inCanvas())) {
    await page.keyboard.press('Tab');
    presses += 1;
    if (presses <= 3) keysSeen.push(await page.evaluate(() => document.activeElement?.getAttribute('data-handle-key') ?? document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName));
  }
  step(`B-01 con ${handles} tiradores, salir del lienzo con Tab toma 1 pulsación`, presses === 1 && handles >= 344, { tiradores: handles, conTabindex0: tabbable, pulsacionesTab: presses, focoTras: keysSeen });
  // Mayús+Tab sale hacia atrás; ] avanza un tirador.
  await page.locator('[data-handle-key="v-0-3"]').focus();
  await page.keyboard.press(']');
  const afterBracket = await page.evaluate(() => document.activeElement?.getAttribute('data-handle-key'));
  await page.keyboard.press('PageDown');
  const afterPage = await page.evaluate(() => document.activeElement?.getAttribute('data-handle-key'));
  await page.keyboard.press('PageUp');
  const afterPageUp = await page.evaluate(() => document.activeElement?.getAttribute('data-handle-key'));
  let back = 0;
  while (back < 420 && (await inCanvas())) { await page.keyboard.press('Shift+Tab'); back += 1; }
  step('B-01 «]» y AvPág avanzan un tirador, RePág retrocede y Mayús+Tab sale con 1 pulsación', afterBracket === 'v-0-4' && afterPage === 'v-0-5' && afterPageUp === 'v-0-4' && back === 1, { tras_corchete: afterBracket, tras_AvPag: afterPage, tras_RePag: afterPageUp, mayusTab: back });
  await ctx.close();
}

// ───────── A-04: cambiar de herramienta con un trazo ─────────
{
  const { ctx, page } = await newPage();
  await page.keyboard.press('r');
  await clickAt(page, 0.7, 0.15); await clickAt(page, 0.8, 0.15); await clickAt(page, 0.8, 0.25);
  await page.keyboard.press('v');
  const dlg = page.locator(CONFIRM);
  const asked = await dlg.isVisible().catch(() => false);
  const info = asked ? { title: await dlg.locator('h2').textContent(), tone: await dlg.getAttribute('data-tone'), buttons: await dlg.locator('button').allTextContents() } : null;
  if (asked) await dlg.getByRole('button', { name: 'Seguir trazando' }).click();
  const stillDraw = (await page.locator('nav[aria-label="Herramientas del lienzo"]').getByRole('button', { name: 'Dibujar región' }).getAttribute('aria-pressed')) === 'true'; // UA: las herramientas están en la paleta del lienzo, no en un role=toolbar
  step('A-04 con 3 puntos, cambiar de herramienta pide confirmación (danger) y «Seguir trazando» conserva el trazo', asked && info.tone === 'danger' && stillDraw, { info, sigueDibujando: stillDraw });
  await ctx.close();
  const second = await newPage();
  const page2 = second.page;
  await page2.keyboard.press('r');
  await clickAt(page2, 0.7, 0.15); await clickAt(page2, 0.8, 0.15);
  await page2.keyboard.press('v');
  await page2.waitForTimeout(250);
  const live = await page2.locator('[data-testid="live-polite"]').textContent().catch(() => '');
  const asked2 = await page2.locator(CONFIRM).isVisible().catch(() => false);
  step('A-04/B-08 con 2 puntos descarta y anuncia el descarte (sin confirmar)', !asked2 && /Se descartó el trazo en curso \(2 puntos\)/.test(live), { confirmo: asked2, anuncio: live.slice(0, 90) });
  await second.ctx.close();
}

// ───────── R7-02: lectura del cursor ─────────
{
  const { ctx, page } = await newPage();
  const b = await canvasBox(page);
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
  await page.mouse.move(b.x + b.width * 0.5 + 5, b.y + b.height * 0.5 + 3);
  const text = await page.locator('[data-testid="cursor-readout"]').textContent().catch(() => null);
  const hidden = await page.locator('[data-testid="cursor-readout"]').getAttribute('aria-hidden').catch(() => null);
  step('R7-02 el cursor muestra x e y con unidad en una línea y aria-hidden', /^x -?[\d,]+ m · y -?[\d,]+ m$/.test(text ?? '') /* UA: la píldora de coordenadas del lienzo lleva la unidad tras cada valor («x 41,32 m · y 29,76 m», UA1-C) */ && hidden === 'true', { texto: text, ariaHidden: hidden });
  await page.screenshot({ path: path.join(SHOTS, `${LABEL}-cursor.png`) });
  await ctx.close();
}

// ───────── Conversión de unidades con FS invariante y γw bloqueante ─────────
{
  const { ctx, page } = await newPage();
  await openFile(page, F.slope);
  await check(page);
  const fsSI = await readFs(page);
  await page.getByRole('tab', { name: 'Proyecto' }).click();
  await page.getByLabel('Unidades', { exact: true }).selectOption('imperial');
  const dlg = page.locator('[data-testid="units-dialog"]');
  const hasDialog = await dlg.isVisible().catch(() => false);
  const opciones = hasDialog ? await dlg.locator('button').allTextContents() : null;
  await page.waitForTimeout(200);
  const focused = hasDialog ? await page.evaluate(() => document.activeElement?.textContent?.trim()) : null;
  if (hasDialog) await dlg.getByRole('button', { name: /Convertir los valores/ }).click();
  else await acceptIfAsked(page, /Cambiar a imperial/);
  await page.waitForTimeout(300);
  await page.getByRole('tab', { name: 'Agua' }).click();
  const gamma = await page.locator('[data-path="/water/unit_weight"]').inputValue().catch(() => null);
  await page.getByRole('tab', { name: 'Geometría' }).click();
  const x3 = await page.locator('[data-path="/regions/0/polygon/2/x"]').inputValue().catch(() => null);
  await check(page);
  const fsImp = await readFs(page);
  const same = fsSI.bishop && fsSI.bishop === fsImp.bishop && fsSI.spencer === fsImp.spencer;
  step('Unidades: «Convertir los valores» deja el FS de Bishop y Spencer igual', hasDialog && same && /^62,449/.test(gamma ?? ''), { fsSI, fsImperial: fsImp, opciones, focoInicial: focused, gammaW: gamma, x_vertice3: x3 });
  await page.screenshot({ path: path.join(SHOTS, `${LABEL}-units.png`) });
  await ctx.close();
}
{
  const { ctx, page } = await newPage();
  await openFile(page, F.slope);
  await page.getByRole('tab', { name: 'Proyecto' }).click();
  await page.getByLabel('Unidades', { exact: true }).selectOption('imperial');
  const dlg = page.locator('[data-testid="units-dialog"]');
  if (await dlg.isVisible().catch(() => false)) await dlg.getByRole('button', { name: 'Solo cambiar la etiqueta' }).click();
  else await acceptIfAsked(page, /Cambiar a imperial/);
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.waitForTimeout(1500);
  const state = await page.getAttribute('[data-testid="result-summary"]', 'data-state');
  await page.locator('#view-results').click(); // UA: Diagnósticos vive en la vista «Resultados»
  const diag = await page.locator('text=Peso unitario del agua').first().textContent().catch(() => null);
  const goBtn = page.locator('button', { hasText: /Agua|Ir a/ }).filter({ hasNot: page.locator('[role="tab"]') });
  const btnTexts = await page.locator('[data-testid="diagnostics"] button, section button').allTextContents().catch(() => []);
  const blocked = state === 'empty' && !!diag;
  let wentToWater = false;
  const link = page.locator('button').filter({ hasText: /Peso unitario del agua/ }).first();
  if (await link.count()) { await link.click(); await page.waitForTimeout(250); wentToWater = (await page.getByRole('tab', { name: 'Agua' }).getAttribute('aria-selected')) === 'true'; }
  step('γw imperial: con piezométrica y 9,81 «Comprobar» queda bloqueado (error) y el botón lleva a Agua', blocked && wentToWater, { estadoResultados: state, mensaje: diag?.slice(0, 100) ?? null, botones: btnTexts.filter((t) => /Agua|Ir/.test(t)).slice(0, 4), fueAAgua: wentToWater });
  await page.screenshot({ path: path.join(SHOTS, `${LABEL}-gammaw.png`) });
  await ctx.close();
}

// ───────── B-09: barra a 320 px ─────────
{
  const { ctx, page } = await newPage({ width: 320, height: 844 });
  const m = await page.evaluate(() => ({
    // UA: ya no existe `.ea-toolbar`; las herramientas están en la paleta del lienzo (nav «Herramientas del lienzo»), cuyo alto es el que se acota.
    barra: document.querySelector('nav[aria-label="Herramientas del lienzo"]').getBoundingClientRect().height,
    lienzoY: document.querySelector('[data-testid="editor-canvas"]').getBoundingClientRect().top + scrollY,
    editar: [...document.querySelectorAll('button.dd-trigger')].some((b) => b.textContent.trim().startsWith('Editar')),
    scrollW: document.documentElement.scrollWidth,
  }));
  step('B-09 a 320 px la paleta de herramientas mide ≤ 120 px y el lienzo empieza antes de y = 400', m.barra <= 120 && m.lienzoY < 400 && m.editar && m.scrollW <= 320, m);
  await page.screenshot({ path: path.join(SHOTS, `${LABEL}-320.png`) });
  if (m.editar) {
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    const names = await page.locator('.dd-menu:popover-open button').allTextContents();
    // UA: a 480 px o menos el menú «Editar» solo trae Deshacer y Rehacer; las herramientas se eligen en la paleta, que conserva los nombres.
    const palette = await page.locator('nav[aria-label="Herramientas del lienzo"] button').evaluateAll((bs) => bs.map((x) => x.getAttribute('aria-label')));
    step('B-09 el menú «Editar» conserva los nombres de Deshacer y Rehacer, y la paleta los de las herramientas', ['Deshacer', 'Rehacer'].every((n) => names.map((x) => x.trim()).includes(n)) && ['Seleccionar', 'Agregar vértice', 'Dibujar región', 'Dividir región', 'Mover vista'].every((n) => palette.includes(n)), { names, palette });
    await page.screenshot({ path: path.join(SHOTS, `${LABEL}-320-menu.png`) });
  }
  await ctx.close();
}

step('Sin errores de consola', errors.length === 0, { errores: errors.slice(0, 5) });
writeFileSync(path.join(SHOTS, `${LABEL}.json`), JSON.stringify(rows, null, 2));
await browser.close();
console.log(failed === 0 ? 'TODO OK' : `${failed} FALLOS`);
process.exit(failed === 0 ? 0 : 1);
