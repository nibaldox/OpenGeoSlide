// U2-C: edición del modelo SOLO con teclado en Chrome (puerto 5187). Ninguna acción usa el ratón ni locator.click().
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SHOTS = path.join(process.env.TMPDIR, 'u2x-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5187/';
const out = { steps: [], consoleErrors: [] };
let failed = 0;
const step = (name, ok, data = {}) => {
  if (!ok) failed += 1;
  out.steps.push({ name, ok, ...data });
  console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data));
};
const num = (t) => Number(String(t).replace(',', '.'));

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => out.consoleErrors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) out.consoleErrors.push(m.text()); });
const kb = page.keyboard;

const active = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    return { key: el?.getAttribute('data-handle-key') ?? null, kind: el?.getAttribute('data-handle') ?? null, label: el?.getAttribute('aria-label') ?? null, tag: el?.tagName, role: el?.getAttribute('role') };
  });
const live = () => page.textContent('[data-testid="canvas-live"]').then((t) => (t ?? '').trim());
const nVertices = (ri) => page.locator(`[data-handle-key^="v-${ri}-"]`).count();
const polyPoints = () => page.evaluate(() => [...document.querySelectorAll('[data-layer="regions"] polygon')].map((p) => p.getAttribute('points')));
const gridLabels = () => page.evaluate(() => [...document.querySelectorAll('[data-layer="grid"] text')].map((t) => t.textContent).join('|'));
const xyOf = (label) => { const m = /x (-?[\d,]+) \w+, y (-?[\d,]+)/.exec(label ?? ''); return m ? [num(m[1]), num(m[2])] : null; };

await page.goto(URL_);
await page.waitForSelector('[data-layer="regions"] polygon');
await page.waitForSelector('[data-handle="vertex"]');
// Preparación (no es edición): se abre un caso con varias regiones y círculo de falla fijo. Desde aquí, solo teclado.
const CASE = process.env.OGS_CASE ?? 'V016a';
const sel = 'select[aria-label="Abrir un caso publicado como modelo"]';
const optLabel = await page.evaluate(([s, id]) => [...document.querySelectorAll(s + ' option')].find((o) => o.textContent.includes(id))?.textContent, [sel, CASE]);
await page.selectOption(sel, { label: optLabel });
await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length >= 2);
await page.waitForSelector('[data-handle="circle_center"]');
console.log('caso abierto:', optLabel);

// 1. Una sola parada de tabulación en el lienzo
const stops = await page.evaluate(() => {
  const svg = document.querySelector('svg[role="application"]');
  return { zeros: svg.querySelectorAll('[tabindex="0"]').length, total: svg.querySelectorAll('[data-handle]').length, svgTab: svg.getAttribute('tabindex'), describedby: !!document.getElementById(svg.getAttribute('aria-describedby') ?? '') };
});
step('1 el lienzo es una sola parada de tabulación (roving tabindex) con instrucciones', stops.zeros === 1 && stops.total > 5 && stops.describedby, stops);

// 2. Llegar al lienzo solo con Tab
let tabs = 0;
await page.evaluate(() => document.body.focus());
for (; tabs < 60; tabs += 1) {
  await kb.press('Tab');
  if ((await active()).key) break;
}
const a0 = await active();
step('2 Tab llega al lienzo (primer tirador activo)', !!a0.key && tabs < 40, { tabsDesdeElInicio: tabs + 1, foco: a0 });
await page.screenshot({ path: path.join(SHOTS, 'kb-01-foco-en-lienzo.png') });

// 3. Recorrer con ] y [ ; Tab interno
await kb.press(']');
const a1 = await active();
await kb.press('Tab');
const a2 = await active();
await kb.press('Shift+Tab');
const a3 = await active();
step('3 ] y Tab avanzan de tirador; Mayús+Tab retrocede (dentro del lienzo)', a1.key && a2.key !== a1.key && a3.key === a1.key, { a0: a0.key, a1: a1.key, a2: a2.key, a3: a3.key });

// 4. Ir al vértice 2 de la región 2 (índice v-1-1) con ] y editar
for (let i = 0; i < 40 && (await active()).key !== 'v-1-1'; i += 1) await kb.press(']');
const v11 = await active();
step('4 llegar al vértice 2 de la región 2', v11.key === 'v-1-1', v11);
const before = xyOf(v11.label);
const nBefore = await nVertices(1);

// 5. Mover con flechas
await kb.press('ArrowRight'); await kb.press('ArrowRight'); await kb.press('ArrowRight');
await kb.press('Shift+ArrowUp');
const moved = await active();
const after = xyOf(moved.label);
const liveMove = await live();
step('5 flechas mueven el vértice (0,1 m por paso; Mayús ×10) y se anuncia', after && Math.abs(after[0] - before[0] - 0.3) < 1e-6 && Math.abs(after[1] - before[1] - 1) < 1e-6 && /^Vértice 2 de la región 2: x /.test(liveMove), { antes: before, despues: after, anuncio: liveMove, foco: moved.key });

// 6. Insertar vértice (Insert)
await kb.press('Insert');
const ins = await active();
const nIns = await nVertices(1);
const liveIns = await live();
step('6 Insert agrega un vértice en el punto medio de la arista siguiente; el foco queda en el nuevo', nIns === nBefore + 1 && ins.key === 'v-1-2' && /^Vértice insertado\./.test(liveIns), { vertices: [nBefore, nIns], foco: ins.key, anuncio: liveIns });
await page.screenshot({ path: path.join(SHOTS, 'kb-02-vertice-insertado.png') });

// 7. Eliminar con Supr: el foco pasa al vecino
await kb.press('Delete');
const del = await active();
const nDel = await nVertices(1);
const liveDel = await live();
step('7 Supr elimina el vértice y el foco pasa al vecino (no se pierde en <body>)', nDel === nBefore && del.key === 'v-1-1' && del.tag !== 'BODY' && /^Vértice eliminado\. Foco en el vértice 2/.test(liveDel), { vertices: nDel, foco: del.key, anuncio: liveDel });

// 8. Insertar con la tecla i (portátiles sin Insert) y deshacer con Ctrl+Z
await kb.press('i');
const nI = await nVertices(1);
await kb.press('Control+z');
const nUndo = await nVertices(1);
step('8 «i» inserta; Ctrl+Z deshace', nI === nBefore + 1 && nUndo === nBefore, { tras_i: nI, tras_deshacer: nUndo });

// 9. Círculo: centro y radio
for (let i = 0; i < 60 && (await active()).key !== 'c-center'; i += 1) await kb.press(']');
const c0 = await active();
await kb.press('Shift+ArrowLeft');
const c1 = await active();
const cBefore = xyOf(c0.label);
const cAfter = xyOf(c1.label);
step('9 el tirador del centro mueve el centro con las flechas', c0.key === 'c-center' && cAfter && Math.abs(cBefore[0] - cAfter[0] - 1) < 1e-6 && /centro: x /.test(await live()), { antes: c0.label, despues: c1.label, anuncio: await live() });
await kb.press(']');
const r0 = await active();
await kb.press('ArrowRight'); await kb.press('ArrowRight'); await kb.press('Shift+ArrowRight');
const r1 = await active();
const rb = num(/radio: ([\d,]+)/.exec(r0.label)[1]);
const ra = num(/radio: ([\d,]+)/.exec(r1.label)[1]);
const centerNow = await page.getAttribute('[data-handle-key="c-center"]', 'aria-label');
step('10 el tirador del radio cambia el radio (no mueve el centro)', r0.key === 'c-radius' && Math.abs(ra - rb - 1.2) < 1e-6 && xyOf(centerNow).join() === cAfter.join(), { antes: r0.label, despues: r1.label, centro: centerNow, anuncio: await live() });
await page.screenshot({ path: path.join(SHOTS, 'kb-03-circulo-editado.png') });

// 11. Zoom y encuadre con el teclado
const p0 = (await polyPoints()).join('#');
await kb.press('+'); await kb.press('+');
const pz = (await polyPoints()).join('#');
await kb.press('-');
const pz2 = (await polyPoints()).join('#');
await kb.press('0');
const pf = (await polyPoints()).join('#');
step('11 + acerca, − aleja y 0 encuadra', pz !== p0 && pz2 !== pz && pf !== pz2, { anuncio: await live() });
await kb.press('Escape');
const g0 = await gridLabels();
await kb.press('ArrowRight');
const g1 = await gridLabels();
step('12 sin tirador seleccionado las flechas desplazan la vista', g0 !== g1 || (await polyPoints()).join('#') !== pf);
await page.screenshot({ path: path.join(SHOTS, 'kb-04-zoom-pan.png') });

// 13. Salir del lienzo con Tab y usar los botones de zoom con teclado
await kb.press('0');
for (let i = 0; i < 40; i += 1) {
  await kb.press('Tab');
  const a = await active();
  if (a.tag === 'BUTTON' && ['Acercar', 'Alejar', 'Encuadrar'].includes(await page.evaluate(() => document.activeElement.getAttribute('aria-label')))) break;
}
const btn = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
const pBefore = (await polyPoints()).join('#');
await kb.press('Enter');
const pAfter = (await polyPoints()).join('#');
step('13 Tab sale del lienzo hasta «Acercar»; Intro acerca', btn === 'Acercar' && pBefore !== pAfter, { boton: btn });
await kb.press('Tab'); await kb.press('Enter'); // Alejar
await kb.press('Tab'); await kb.press('Space'); // Encuadrar
step('14 «Alejar» y «Encuadrar» con teclado', (await polyPoints()).join('#') === pf, { anuncio: await live() });

step('15 sin errores de consola', out.consoleErrors.length === 0, { errors: out.consoleErrors });
writeFileSync(path.join(SHOTS, 'kb-resultado.json'), JSON.stringify(out, null, 2));
await browser.close();
console.log(failed === 0 ? `\nTODO OK (${out.steps.length} pasos)` : `\nFALLARON ${failed}`);
process.exit(failed === 0 ? 0 : 1);
