// CM-C1W · recorrido en Chrome de la búsqueda global (F7.5): casilla, cuatro campos, guardar, abrir, versión 0.7 ↔ 0.6, errores por campo,
// axe en claro y oscuro con el panel abierto y capturas a 1440 × 900 y 390 × 844.
// Uso: TMPDIR=… OGS_URL=http://127.0.0.1:5183/ node cm_c1w_walk.mjs   (playwright-core y axe-core desde $TMPDIR/cm-c1w/node_modules y $TMPDIR/x8-ux/node_modules)
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const TMP = process.env.TMPDIR;
const REPO = process.env.OGS_REPO ?? '/home/xodla/archivos/opengeoslide-wt/cm-c1w';
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5183/';
const SHOTS = `${TMP}/cm-c1w/shots`;
const AXE = `${TMP}/x8-ux/node_modules/axe-core/axe.min.js`;
mkdirSync(SHOTS, { recursive: true });
const base = JSON.parse(readFileSync(`${REPO}/verification/cases/V001-nc.json`, 'utf8')).model;
base.version = '0.6';
const startFile = `${TMP}/cm-c1w/v001nc.ogs.json`;
writeFileSync(startFile, JSON.stringify(base));

let failed = 0;
const step = (name, ok, data = {}) => {
  if (!ok) failed += 1;
  console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data));
};
const G = '/analysis/search/non_circular/global';
const sel = (path) => `[data-path="${path}"]`;

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
async function newPage(viewport, theme = 'dark') {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); localStorage.setItem('ogs.theme.v1', t); } catch {} }, theme);
  const p = await ctx.newPage();
  await p.goto(URL_);
  await p.waitForSelector('[data-layer="regions"] polygon');
  return { ctx, p };
}
const openFile = async (p, file) => {
  await p.locator('[data-testid="file-open"]').setInputFiles(file);
  await p.waitForTimeout(700);
};
const gotoSearch = async (p) => {
  await p.getByRole('tab', { name: 'Búsqueda' }).click();
  await p.waitForSelector(sel('/analysis/search/non_circular'));
};
const save = async (p, name) => {
  const dl = p.waitForEvent('download', { timeout: 8000 });
  await p.getByRole('button', { name: 'Archivo', exact: true }).click();
  await p.getByRole('button', { name: 'Guardar', exact: true }).click();
  const d = await dl;
  const file = `${TMP}/cm-c1w/${name}.ogs.json`;
  await d.saveAs(file);
  return JSON.parse(readFileSync(file, 'utf8'));
};
const ncOf = (j) => j.analysis.search.non_circular;
const commitText = async (p, path, text) => {
  await p.locator(sel(path)).fill(text);
  await p.locator(sel(path)).press('Enter');
  await p.waitForTimeout(150);
};
async function axe(p, label) {
  await p.addScriptTag({ path: AXE });
  const r = await p.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
  const sc = r.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  step(`axe ${label}`, sc.length === 0, { serious: sc, otras: r.filter((v) => !sc.includes(v)).map((v) => `${v.id}:${v.impact}`) });
  return r;
}

// ───────── 1. Casilla, campos, guardar y abrir ─────────
{
  const { ctx, p } = await newPage({ width: 1440, height: 900 }, 'dark');
  await openFile(p, startFile);
  await gotoSearch(p);
  step('«Búsqueda global» existe y está desmarcada; sin campos', (await p.locator(sel(G)).isVisible()) && !(await p.locator(sel(G)).isChecked()) && (await p.locator(sel(`${G}/generated`)).count()) === 0);
  const j0 = await save(p, 'walk0');
  step('sin global: se guarda 0.6 y sin la clave global (identidad)', j0.version === '0.6' && !('global' in ncOf(j0)), { version: j0.version, nc: ncOf(j0) });

  await p.locator(sel(G)).check();
  await p.waitForTimeout(200);
  step('marcar escribe global: {} y aparecen los cuatro campos', (await p.locator(sel(`${G}/algorithm`)).isVisible()) && (await p.locator(sel(`${G}/generated`)).isVisible()) && (await p.locator(sel(`${G}/seed`)).isVisible()) && (await p.locator(sel(`${G}/polish`)).isChecked()));
  const j1 = await save(p, 'walk1');
  step('guardar con global: {} sube la versión a 0.7', j1.version === '0.7' && JSON.stringify(ncOf(j1).global) === '{}', { version: j1.version, nc: ncOf(j1) });

  const opts = await p.locator(`${sel(`${G}/algorithm`)} option`).allInnerTexts();
  step('opciones del algoritmo', JSON.stringify(opts) === JSON.stringify(['Automático', 'Bloque sobre capas débiles', 'Recocido']), { opts });

  await p.locator(sel(`${G}/algorithm`)).selectOption('block');
  await commitText(p, `${G}/generated`, '120');
  await commitText(p, `${G}/seed`, '42');
  await p.locator(sel(`${G}/polish`)).uncheck();
  await p.waitForTimeout(250);
  const j2 = await save(p, 'walk2');
  step('los cuatro campos se escriben', j2.version === '0.7' && JSON.stringify(ncOf(j2).global) === JSON.stringify({ algorithm: 'block', generated: 120, seed: 42, polish: false }), { nc: ncOf(j2) });
  await p.screenshot({ path: `${SHOTS}/walk-1440x900-global-dark.png` });

  // errores por campo
  await p.locator(sel(`${G}/generated`)).fill('10');
  await p.locator(sel(`${G}/generated`)).press('Enter');
  await p.locator(sel(`${G}/seed`)).fill('-3');
  await p.locator(sel(`${G}/seed`)).press('Enter');
  await p.waitForTimeout(250);
  const inv = await p.evaluate((g) => [`${g}/generated`, `${g}/seed`].map((x) => document.querySelector(`[data-path="${x}"]`)?.getAttribute('aria-invalid')), G);
  const txt = await p.locator('body').innerText();
  step('fuera de rango: campos marcados y mensaje con el rango', inv.every((x) => x === 'true') && /entre 50 y 2000/.test(txt) && /entre 0 y 9007199254740991/.test(txt), { inv });
  await p.screenshot({ path: `${SHOTS}/walk-1440x900-global-errores-dark.png` });
  await p.locator(sel(`${G}/generated`)).fill('250');
  await p.locator(sel(`${G}/generated`)).press('Enter');
  await p.locator(sel(`${G}/seed`)).fill('7');
  await p.locator(sel(`${G}/seed`)).press('Enter');
  await p.waitForTimeout(250);
  const j3 = await save(p, 'walk3');
  step('corregidos los errores, el documento recibe los valores', JSON.stringify(ncOf(j3).global) === JSON.stringify({ algorithm: 'block', generated: 250, seed: 7, polish: false }), { nc: ncOf(j3) });

  // abrir de nuevo el archivo guardado (walk2) en otra sesión
  await ctx.close();
  const again = await newPage({ width: 1440, height: 900 }, 'dark');
  await openFile(again.p, `${TMP}/cm-c1w/walk3.ogs.json`);
  await gotoSearch(again.p);
  const vals = await again.p.evaluate((g) => ({
    checked: document.querySelector(`[data-path="${g}"]`)?.checked,
    algorithm: document.querySelector(`[data-path="${g}/algorithm"]`)?.value,
    generated: document.querySelector(`[data-path="${g}/generated"]`)?.value,
    seed: document.querySelector(`[data-path="${g}/seed"]`)?.value,
    polish: document.querySelector(`[data-path="${g}/polish"]`)?.checked,
  }), G);
  step('abrir de nuevo: casilla y los cuatro campos conservan sus valores', vals.checked === true && vals.algorithm === 'block' && vals.generated === '250' && vals.seed === '7' && vals.polish === false, vals);
  const j4 = await save(again.p, 'walk4');
  step('abrir y guardar sin cambios da el mismo documento', JSON.stringify(j4) === JSON.stringify(j3));
  const bytes3 = readFileSync(`${TMP}/cm-c1w/walk3.ogs.json`, 'utf8');
  const bytes4 = readFileSync(`${TMP}/cm-c1w/walk4.ogs.json`, 'utf8');
  step('…y los mismos bytes', bytes3 === bytes4, { len: bytes3.length });

  // desmarcar → vuelve a 0.6
  await again.p.locator(sel(G)).uncheck();
  await again.p.waitForTimeout(250);
  const j5 = await save(again.p, 'walk5');
  step('desmarcar «Búsqueda global»: la versión guardada vuelve a 0.6 y sin global', j5.version === '0.6' && !('global' in ncOf(j5)), { version: j5.version, nc: ncOf(j5) });
  step('los campos desaparecen al desmarcar', (await again.p.locator(sel(`${G}/generated`)).count()) === 0);

  // marcar de nuevo: parte de global: {} (valores por defecto)
  await again.p.locator(sel(G)).check();
  await again.p.waitForTimeout(200);
  const j6 = await save(again.p, 'walk6');
  step('volver a marcar empieza con global: {}', j6.version === '0.7' && JSON.stringify(ncOf(j6).global) === '{}', { nc: ncOf(j6) });

  // Comprobar con el motor WASM v0.5.1 (no conoce la 0.7): debe decirlo, no devolver un FS inventado
  await again.p.getByRole('button', { name: /Comprobar/ }).first().click();
  await again.p.waitForTimeout(4000);
  const body = await again.p.locator('body').innerText();
  step('Comprobar con el WASM v0.5.1 (sin 0.7): informa el rechazo del motor («unknown field `global`»), sin FS', /unknown field `global`/.test(body) && !/Factor de seguridad\s*[:=]?\s*\d/.test(body), { extracto: (body.match(/[^\n]*unknown field[^\n]*/i) ?? [''])[0].slice(0, 200) });
  await again.p.screenshot({ path: `${SHOTS}/walk-1440x900-comprobar-wasm051.png` });
  await again.ctx.close();
}

// ───────── 2. Capturas y axe, claro y oscuro, 1440 × 900 y 390 × 844 ─────────
for (const theme of ['light', 'dark']) {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const { ctx, p } = await newPage({ width: w, height: h }, theme);
    await openFile(p, `${TMP}/cm-c1w/walk3.ogs.json`);
    await gotoSearch(p);
    await p.locator(sel(`${G}/algorithm`)).scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${SHOTS}/panel-${w}x${h}-${theme}.png` });
    await p.locator(sel(G)).scrollIntoViewIfNeeded();
    await axe(p, `panel de búsqueda con «Búsqueda global» abierta, ${theme} ${w}×${h}`);
    // con error visible
    await p.locator(sel(`${G}/generated`)).fill('3');
    await p.locator(sel(`${G}/generated`)).press('Enter');
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${SHOTS}/panel-error-${w}x${h}-${theme}.png` });
    await axe(p, `…con un campo inválido, ${theme} ${w}×${h}`);
    await ctx.close();
  }
}
await browser.close();
console.log(failed === 0 ? 'RESULTADO: todo OK' : `RESULTADO: ${failed} FAIL`);
