// U6-K (R9-04, R9-06, R9-10, R9-11c, R9-05d): reproduce en Chrome lo que vio el revisor R9 y mide el resultado.
// Uso (copiar a un directorio con playwright-core): OGS_URL=http://127.0.0.1:5188/ node u6k_demo.mjs [etiqueta]
// Contra la base (59fef87) deben FALLAR los pasos 1 (AltGr), 2 (encuadre y aviso al deshacer), 3 (aria-describedby), 4 (foco, según
// el diálogo) y 5 (piezométrica extrapolada); contra u6k-teclado, pasar. Capturas en $TMPDIR/u6k-shots.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TMP = process.env.TMPDIR;
const SHOTS = path.join(TMP, 'u6k-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5188/';
const LABEL = process.argv[2] ?? 'run';
let failed = 0;
const step = (name, ok, data = {}) => {
  if (!ok) failed += 1;
  console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data));
};

// ───────── Modelos ─────────
const mat = { id: 'suelo', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 19, cohesion: 30, friction_angle: 28 };
const base = (over) => ({ format: 'opengeoslide', version: '0.2', meta: { title: 'U6-K' }, units: 'SI', materials: [mat], regions: [], water: null, loads: [], slope: { direction: 'left_to_right' }, analysis: { methods: ['bishop'] }, ...over });
const region = [[0, 10], [10, 10], [30, 0], [60, 0], [60, -10], [0, -10]];
const slope = base({
  regions: [{ material: 'suelo', polygon: region }],
  water: { unit_weight: 9.81, piezometric_line: [[0, 6], [30, 0], [60, 0]] },
  analysis: { methods: ['bishop'], surface: { type: 'circle', xc: 30, yc: 30, r: 28 } },
});
// Piezométrica corta (x de 10 a 50) en un modelo que va de 0 a 60: el motor la prolonga en horizontal a cada lado.
const shortLine = [[10, 6], [30, 0], [50, -1]];
const shortPiezo = base({ regions: [{ material: 'suelo', polygon: region }], water: { unit_weight: 9.81, piezometric_line: shortLine }, analysis: { methods: ['bishop'], surface: { type: 'circle', xc: 30, yc: 30, r: 28 } } });
// La misma, con la prolongación escrita explícitamente: el motor debe dar el mismo FS.
const explicitPiezo = base({ regions: [{ material: 'suelo', polygon: region }], water: { unit_weight: 9.81, piezometric_line: [[0, 6], ...shortLine, [60, -1]] }, analysis: { methods: ['bishop'], surface: { type: 'circle', xc: 30, yc: 30, r: 28 } } });
const file = (name, doc) => { const p = path.join(TMP, name); writeFileSync(p, JSON.stringify(doc)); return p; };
const F = { slope: file('u6k-slope.ogs.json', slope), short: file('u6k-short.ogs.json', shortPiezo), explicit: file('u6k-explicit.ogs.json', explicitPiezo) };
const csvRegions = path.join(TMP, 'u6k-regions.csv');
writeFileSync(csvRegions, 'capa,x,y\nA,0,0\nA,10,0\nA,10,5\nA,0,5\n');

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
async function openFile(page, p) {
  await page.setInputFiles('[data-testid="file-open"]', p);
  await page.waitForFunction(() => /Abierto/.test(document.body.innerText));
  await page.waitForSelector('[data-layer="regions"] polygon');
  await page.waitForTimeout(250);
}
async function check(page) {
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="result-summary"]')?.getAttribute('data-state') !== 'busy', null, { timeout: 60000 });
  await page.waitForTimeout(300);
}
const fsOf = async (page) => (await page.locator('[data-testid="fs-bishop"]').textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim();
const active = (page) => page.evaluate(() => { const a = document.activeElement; return { tag: a?.tagName, key: a?.getAttribute?.('data-handle-key') ?? null, id: a?.id ?? '', label: (a?.getAttribute?.('aria-label') ?? a?.textContent ?? '').trim().slice(0, 40) }; });
const polyWidth = (page) => page.evaluate(() => { const b = document.querySelector('[data-layer="regions"] polygon').getBoundingClientRect(); return b.width; });

// ───────── 1. R9-04: [ ] con AltGr y Option ─────────
{
  const { ctx, page } = await newPage();
  await openFile(page, F.slope);
  await page.locator('[data-handle-key="v-0-0"]').focus();
  const a0 = await active(page);
  const fire = (init) => page.evaluate((i) => {
    const el = document.activeElement;
    const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...i });
    el.dispatchEvent(ev);
    return { prevented: ev.defaultPrevented };
  }, init);
  // es-ES en Windows: AltGr llega como Ctrl+Alt.
  const r1 = await fire({ key: ']', ctrlKey: true, altKey: true });
  const a1 = await active(page);
  step('1a AltGr (Ctrl+Alt) + ] avanza de tirador', a1.key === 'v-0-1' && r1.prevented, { antes: a0.key, despues: a1.key, ...r1 });
  const r2 = await fire({ key: '[', ctrlKey: true, altKey: true });
  const a2 = await active(page);
  step('1b AltGr + [ vuelve al tirador anterior', a2.key === 'v-0-0' && r2.prevented, { despues: a2.key, ...r2 });
  // macOS: Option sin Meta.
  const r3 = await fire({ key: ']', altKey: true });
  const a3 = await active(page);
  step('1c Option + ] avanza', a3.key === 'v-0-1' && r3.prevented, { despues: a3.key, ...r3 });
  // Ctrl+] sin Alt NO se consume (atajo del navegador).
  const r4 = await fire({ key: ']', ctrlKey: true });
  const a4 = await active(page);
  step('1d Ctrl+] sin Alt no cambia de tirador ni se consume', a4.key === 'v-0-1' && !r4.prevented, { despues: a4.key, ...r4 });
  // Zoom con AltGr: + = -
  const scaleOf = () => page.evaluate(() => document.querySelector('[data-layer="regions"] polygon').getBoundingClientRect().width);
  const w0 = await scaleOf();
  await fire({ key: '+', ctrlKey: true, altKey: true });
  const w1 = await scaleOf();
  await fire({ key: '-', ctrlKey: true, altKey: true });
  const w2 = await scaleOf();
  step('1e AltGr + + acerca y AltGr + - aleja', w1 > w0 * 1.2 && Math.abs(w2 - w0) / w0 < 0.01, { w0, w1, w2 });
  // Teclado real de Playwright (Ctrl+Alt+]): Chrome reporta key ']'.
  await page.locator('[data-handle-key="v-0-0"]').focus();
  await page.keyboard.press('Control+Alt+BracketRight');
  const a5 = await active(page);
  step('1f pulsación real Ctrl+Alt+] avanza', a5.key === 'v-0-1', { despues: a5.key });
  // Ctrl+Z real sigue deshaciendo.
  await page.keyboard.press('ArrowRight');
  const moved = await page.locator('[data-handle-key="v-0-1"]').getAttribute('aria-label');
  await page.keyboard.press('Control+z');
  const undone = await page.locator('[data-handle-key="v-0-1"]').getAttribute('aria-label');
  step('1g Ctrl+Z real sigue deshaciendo', moved !== undone, { moved, undone });
  await ctx.close();
}

// ───────── 2. R9-06: convertir y deshacer ─────────
{
  const { ctx, page } = await newPage();
  await openFile(page, F.slope);
  await page.getByRole('tab', { name: 'Proyecto' }).click();
  const wSI = await polyWidth(page);
  await page.getByLabel('Unidades', { exact: true }).selectOption('imperial');
  await page.locator('[data-testid="units-dialog"]').getByRole('button', { name: /Convertir los valores/ }).click();
  await page.waitForTimeout(400);
  const wImp = await polyWidth(page);
  const noticeAfter = (await page.locator('[data-testid="units-notice"]').textContent().catch(() => null)) ?? null;
  await page.screenshot({ path: path.join(SHOTS, `${LABEL}-units-convertido.png`) });
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  const unitsAfterUndo = await page.getByLabel('Unidades', { exact: true }).inputValue();
  const wUndo = await polyWidth(page);
  const noticeUndo = (await page.locator('[data-testid="units-notice"]').textContent().catch(() => null)) ?? null;
  await page.screenshot({ path: path.join(SHOTS, `${LABEL}-units-deshecho.png`) });
  step('2a convertir a imperial: aviso visible', /convertidos a imperial/i.test(noticeAfter ?? ''), { noticeAfter });
  step('2b Ctrl+Z: el talud mide lo mismo en píxeles (±5 %)', unitsAfterUndo === 'SI' && Math.abs(wUndo - wSI) / wSI <= 0.05, { wSI, wImp, wUndo, unitsAfterUndo, ratio: +(wUndo / wSI).toFixed(3) });
  step('2c Ctrl+Z: el aviso «Valores convertidos…» desaparece', noticeUndo === null, { noticeUndo });
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(400);
  const wRedo = await polyWidth(page);
  const unitsAfterRedo = await page.getByLabel('Unidades', { exact: true }).inputValue();
  const noticeRedo = (await page.locator('[data-testid="units-notice"]').textContent().catch(() => null)) ?? null;
  step('2d Ctrl+Y: encuadre correcto en imperial (±5 % del encuadre de la conversión) y sin aviso obsoleto', unitsAfterRedo === 'imperial' && Math.abs(wRedo - wImp) / wImp <= 0.05 && noticeRedo === null, { wImp, wRedo, unitsAfterRedo, noticeRedo });
  // imperial → SI → Ctrl+Z (el caso que se recortaba fuera de pantalla)
  await page.keyboard.press('Control+z'); // vuelve a SI
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+y'); // otra vez imperial
  await page.waitForTimeout(300);
  await page.getByLabel('Unidades', { exact: true }).selectOption('SI');
  await page.locator('[data-testid="units-dialog"]').getByRole('button', { name: /Convertir los valores/ }).click();
  await page.waitForTimeout(400);
  const wBack = await polyWidth(page);
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  const wImp2 = await polyWidth(page);
  const box = await page.locator('svg.ec-svg').boundingBox();
  const pb = await page.locator('[data-layer="regions"] polygon').boundingBox();
  step('2e imperial → SI → Ctrl+Z: el talud queda a la vista y con el mismo ancho que antes (±5 %)', Math.abs(wImp2 - wImp) / wImp <= 0.05 && pb.x >= box.x - 1 && pb.x + pb.width <= box.x + box.width + 1, { wImp, wBack, wImp2 });
  await ctx.close();
}

// ───────── 3. R9-10: aria-describedby del tirador activo ─────────
{
  const { ctx, page } = await newPage();
  await openFile(page, F.slope);
  const info = await page.evaluate(() => {
    const act = document.querySelector('g[data-handle][tabindex="0"]');
    const id = act?.getAttribute('aria-describedby');
    const target = id ? document.getElementById(id) : null;
    const others = [...document.querySelectorAll('g[data-handle][tabindex="-1"]')].filter((g) => g.hasAttribute('aria-describedby')).length;
    const svg = document.querySelector('svg.ec-svg');
    return { id, text: target?.textContent ?? null, len: target?.textContent?.length ?? 0, others, svgLen: document.getElementById(svg.getAttribute('aria-describedby'))?.textContent.length };
  });
  step('3 el tirador con tabindex 0 tiene aria-describedby con instrucciones breves', !!info.id && /\[/.test(info.text ?? '') && /\]/.test(info.text ?? '') && info.len < 220 && info.len < info.svgLen / 2 && info.others === 0, info);
  await ctx.close();
}

// ───────── 4. R9-11c: el foco no cae en <body> al cerrar los diálogos ─────────
{
  const { ctx, page } = await newPage();
  await openFile(page, F.slope);
  const settle = () => page.waitForTimeout(400);
  // Ayuda: con Esc y con «Cerrar».
  await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
  await page.waitForSelector('dialog[data-testid="help-dialog"][open]');
  await page.keyboard.press('Escape');
  await settle();
  const h1 = await active(page);
  step('4a Ayuda + Esc: el foco vuelve al botón Ayuda', h1.tag === 'BUTTON' && /Ayuda/.test(h1.label), h1);
  await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
  await page.waitForSelector('dialog[data-testid="help-dialog"][open]');
  await page.locator('dialog[data-testid="help-dialog"]').getByRole('button', { name: 'Cerrar' }).click();
  await settle();
  const h2 = await active(page);
  step('4b Ayuda + «Cerrar»: el foco vuelve al botón Ayuda', h2.tag === 'BUTTON' && /Ayuda/.test(h2.label), h2);
  // Importar CSV (Modal): el disparador es un menú ya cerrado y un <input hidden>; antes el foco caía en <body>.
  const trigger = page.getByRole('button', { name: 'Archivo', exact: true });
  await trigger.click();
  await page.getByRole('button', { name: 'Importar CSV', exact: false }).first().click().catch(() => {});
  await page.setInputFiles('[data-testid="file-csv"]', csvRegions);
  await page.waitForSelector('dialog.ea-dialog[open]');
  const title = await page.locator('dialog.ea-dialog[open] h2').first().textContent();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog.ea-dialog[open]'));
  await settle();
  const m1 = await active(page);
  step('4c Importar CSV (Modal) + Esc: el foco no cae en <body>', m1.tag !== 'BODY' && m1.tag !== 'HTML', { titulo: title, ...m1 });
  await page.getByRole('button', { name: 'Archivo', exact: true }).click();
  await page.getByRole('button', { name: /Talud simple/ }).click();
  await page.waitForSelector('dialog.ea-dialog[open]');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog.ea-dialog[open]'));
  await settle();
  const m2 = await active(page);
  step('4d Talud simple (Modal) + Esc: el foco no cae en <body>', m2.tag !== 'BODY' && m2.tag !== 'HTML', m2);
  await ctx.close();
}

// ───────── 5. R9-05d: piezométrica extrapolada ─────────
{
  const { ctx, page } = await newPage();
  await openFile(page, F.short);
  const info = await page.evaluate(() => {
    const poly = [...document.querySelectorAll('[data-layer="piezometric-extrapolated"] polyline')].map((p) => ({ side: p.getAttribute('data-piezo-extrapolated'), points: p.getAttribute('points'), dash: p.getAttribute('stroke-dasharray'), stroke: p.getAttribute('stroke') }));
    const line = document.querySelector('[data-layer="piezometric"] polyline');
    const regions = document.querySelector('[data-layer="regions"] polygon').getBoundingClientRect();
    const svg = document.querySelector('svg.ec-svg').getBoundingClientRect();
    const legend = [...document.querySelectorAll('ul.legend li')].map((l) => l.textContent.trim());
    return { poly, lineDash: line?.getAttribute('stroke-dasharray'), lineFirst: line?.getAttribute('points').split(' ')[0], regionsLeft: regions.left - svg.left, regionsRight: regions.right - svg.left, legend };
  });
  const left = info.poly.find((p) => p.side === 'left');
  const right = info.poly.find((p) => p.side === 'right');
  const pt = (s, i) => s.split(' ')[i].split(',').map(Number);
  const leftOk = left && Math.abs(pt(left.points, 0)[0] - info.regionsLeft) < 1.5 && pt(left.points, 0)[1] === pt(left.points, 1)[1] && left.points.split(' ')[1] === info.lineFirst;
  const rightOk = right && Math.abs(pt(right.points, 1)[0] - info.regionsRight) < 1.5 && pt(right.points, 0)[1] === pt(right.points, 1)[1];
  step('5a dos tramos horizontales: del borde izquierdo al primer punto y del último al borde derecho', !!leftOk && !!rightOk && info.poly.length === 2, info);
  step('5b trazo distinto al de la línea definida', left?.dash === '1 5' && info.lineDash === '8 4', { extrapolado: left?.dash, definida: info.lineDash });
  step('5c la leyenda dice «Piezométrica (extrapolada)»', info.legend.some((t) => /Piezométrica \(extrapolada\)/.test(t)), { legend: info.legend });
  await page.screenshot({ path: path.join(SHOTS, `${LABEL}-piezo-extrapolada.png`) });
  await check(page);
  const fsShort = await fsOf(page);
  const e = await newPage();
  await openFile(e.page, F.explicit);
  const noExtra = await e.page.locator('[data-layer="piezometric-extrapolated"]').count();
  await check(e.page);
  const fsExplicit = await fsOf(e.page);
  step('5d el FS con la línea corta es igual al de la línea prolongada a mano (el motor extrapola como se dibuja)', !!fsShort && fsShort === fsExplicit && noExtra === 0, { fsShort, fsExplicit, tramoSiCubre: noExtra });
  await e.ctx.close();
  await ctx.close();
}

step('Errores de consola', errors.length === 0, { errores: errors });
await browser.close();
console.log(failed === 0 ? 'TODO OK' : `${failed} FALLOS`);
process.exit(failed === 0 ? 0 : 1);
