// F3G-R13 W (E15m-9 y E15m-12): recorrido en Chrome con el MOTOR REAL (WASM de la web, sin inyección ni datos simulados), en claro y oscuro.
//   E15m-9: un modelo imperial con piezométrica y sin γw (a) se abre sin error, (b) «Comprobar» calcula y no se bloquea, (c) Diagnósticos lleva la nota
//           «El modelo usa agua y no indica γw…62,4 pcf» como NOTA (no como error), (d) la pestaña «Agua» dice «Si lo deja vacío, el cálculo usa 62,4 pcf»,
//           (e) «Comprobar caso» en Casos tampoco lo bloquea, y (f) un γw explícito de 9,81 pcf SÍ se rechaza (error con la acción para corregirlo).
//   E15m-12: Casos dibuja «Sin grieta (z = 0)» en el Canvas 2D con una grieta automática de profundidad 0 (c = 0); con profundidad no lo dibuja. El
//           texto se mide espiando `CanvasRenderingContext2D.fillText` (el Canvas 2D no tiene DOM), y el editor lo repite en SVG (`data-crack-label="none"`).
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=$PWD TMPDIR=<scratch> node docs/fase3/r13/e2e/r13_w_web.mjs
//   (playwright-core desde docs/node_modules; axe-core: AXE=<axe.min.js> o <scratch>/x8-ux/node_modules/axe-core/axe.min.js). SHOTS=<carpeta> cambia las capturas.
// Imprime una línea `OK` o `FAIL` por comprobación (el runner cuenta ^FAIL y exige al menos un ^OK).
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = process.env.TMPDIR ?? os.tmpdir();
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const SHOTS = process.env.SHOTS ?? path.join(TMP, 'r13-w-shots');
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

const GW_NOTE = /El modelo usa agua y no indica γw: se toma γw = 62,4 pcf \(9,81 kN\/m³\)/;
const CIRCLE = { xc: 38, yc: 38, r: 12.5 };

for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme, acceptDownloads: true });
  await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); localStorage.setItem('ogs.theme.v1', t); } catch {} }, theme);
  // Espía del Canvas 2D: los textos que se dibujan (Casos no tiene DOM para el rótulo).
  await ctx.addInitScript(() => {
    window.__fillTexts = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, ...rest) { window.__fillTexts.push(String(t)); return orig.call(this, t, ...rest); };
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) errors.push(m.text()); });
  p.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await p.goto(URL_);
  await p.waitForSelector('[data-layer="regions"] polygon');
  await p.waitForFunction(() => /ogs-core/.test(document.querySelector('[data-testid="engine-banner"]')?.textContent ?? ''));

  // Modelo base: ACADS 1(a) guardado desde el editor (piezométrica bajo el terreno, sin γw).
  await p.getByRole('button', { name: 'Archivo' }).click();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /^Guardar/ }).first().click()]);
  const basePath = path.join(TMP, `r13w-base-${theme}.ogs.json`); await dl.saveAs(basePath);
  const base = JSON.parse(readFileSync(basePath, 'utf8'));
  // El ejemplo inicial no trae agua: se le agrega una piezométrica horizontal al 40 % de la altura, bajo el terreno y sin γw.
  const allPts = base.regions.flatMap((r) => r.polygon);
  const xs = allPts.map((q) => q[0]), ys = allPts.map((q) => q[1]);
  base.water = { piezometric_line: [[Math.min(...xs), Math.min(...ys) + 0.4 * (Math.max(...ys) - Math.min(...ys))], [Math.max(...xs), Math.min(...ys) + 0.4 * (Math.max(...ys) - Math.min(...ys))]] };
  step(`${theme}: el modelo base tiene piezométrica y no tiene γw`, Array.isArray(base.water?.piezometric_line) && base.water.piezometric_line.length >= 2 && base.water.unit_weight === undefined, { water: base.water });
  const write = (name, mut) => { const m = structuredClone(base); mut(m); const f = path.join(TMP, `r13w-${name}-${theme}.ogs.json`); writeFileSync(f, JSON.stringify(m)); return f; };
  const fImpNoGw = write('imp-sin-gw', (m) => { m.units = 'imperial'; m.analysis.surface = { type: 'circle', ...CIRCLE }; m.analysis.search = null; m.analysis.methods = ['bishop']; });
  const fImpGw981 = write('imp-gw981', (m) => { m.units = 'imperial'; m.water.unit_weight = 9.81; m.analysis.surface = { type: 'circle', ...CIRCLE }; m.analysis.search = null; m.analysis.methods = ['bishop']; });
  const openFile = async (f) => {
    await p.setInputFiles('[data-testid="file-open"]', f);
    await p.waitForTimeout(300);
    if (await p.locator('[data-testid="confirm-dialog"]').isVisible()) await p.getByRole('button', { name: 'Descartar cambios' }).click();
    await p.waitForTimeout(400);
  };

  // ── E15m-9 (a-d): editor ──
  await openFile(fImpNoGw);
  await p.getByRole('tab', { name: 'Agua' }).click();
  const bodyNow = await p.locator('body').innerText();
  step(`${theme}: imperial sin γw: la nota de γw por defecto está en Diagnósticos antes de calcular`, GW_NOTE.test(bodyNow) && /Las versiones anteriores a la v0\.4\.0/.test(bodyNow), {});
  const noteBadge = await p.locator('.ep-issue-item', { hasText: 'El modelo usa agua y no indica γw' }).locator('.ep-badge').innerText();
  step(`${theme}: la incidencia es una «Nota», no un «Error»`, /^nota$/i.test(noteBadge), { noteBadge });
  step(`${theme}: la ayuda del campo γw dice que vacío usa 62,4 pcf (y no 9,81)`, /Si lo deja vacío, el cálculo usa 62,4 pcf/.test(bodyNow) && !/el cálculo usa 9,81/.test(bodyNow), {});
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await p.waitForFunction(() => /FS \d/.test(document.body.innerText), null, { timeout: 30000 });
  const after = await p.locator('body').innerText();
  step(`${theme}: «Comprobar» no se bloquea: hay FS y ningún error de γw`, /FS \d/.test(after) && !/Peso unitario del agua γw: el modelo está en unidades imperiales/.test(after), {});
  step(`${theme}: la nota sigue una sola vez tras calcular`, (after.match(/El modelo usa agua y no indica γw/g) ?? []).length === 1, { n: (after.match(/El modelo usa agua y no indica γw/g) ?? []).length });
  await p.screenshot({ path: path.join(SHOTS, `${theme}-1-imperial-sin-gw.png`) });
  await axe(p, `${theme} editor imperial sin γw (nota)`);

  // ── E15m-9 (f): γw explícito de 9,81 en imperial = error ──
  await openFile(fImpGw981);
  await p.getByRole('tab', { name: 'Agua' }).click();
  const bodyErr = await p.locator('body').innerText();
  const errBadge = await p.locator('.ep-issue-item', { hasText: 'Peso unitario del agua γw' }).first().locator('.ep-badge').innerText().catch(() => '');
  step(`${theme}: γw = 9,81 explícito en imperial: error con la acción para corregirlo`, /^error$/i.test(errBadge) && /menor que 20 pcf/.test(bodyErr) && /Escriba 62,4 pcf/.test(bodyErr) && !GW_NOTE.test(bodyErr), { errBadge });

  // ── E15m-9 (e): Casos ──
  const casosOpen = async (file) => {
    await p.getByRole('tab', { name: 'Casos de verificación' }).click();
    await p.waitForSelector('.cases-view');
    await p.locator('.cases-view input[type="file"]').setInputFiles(file);
    await p.waitForTimeout(300);
    await p.evaluate(() => { window.__fillTexts.length = 0; });
    await p.getByRole('button', { name: 'Comprobar caso', exact: true }).click();
    await p.waitForTimeout(1500);
    return p.locator('.cases-view').innerText();
  };
  let cases = await casosOpen(fImpNoGw);
  await p.waitForSelector('.cases-view #results-title', { timeout: 60000 });
  step(`${theme}: Casos: el modelo imperial sin γw no se bloquea (hay resultados y ningún «No se calculó el caso»)`, !/No se calculó el caso/.test(cases + (await p.locator('body').innerText())), {});
  cases = await casosOpen(fImpGw981);
  const caseBody = await p.locator('body').innerText();
  step(`${theme}: Casos: γw = 9,81 explícito en imperial sí se bloquea con el mensaje del editor`, /No se calculó el caso/.test(caseBody) && /menor que 20 pcf/.test(caseBody), {});

  // ── E15m-12: Casos dibuja «Sin grieta (z = 0)» ──
  await p.getByRole('tab', { name: 'Editar' }).click();
  await p.waitForSelector('[data-layer="regions"] polygon');
  const granular = (name, depth) => write(name, (m) => {
    m.version = '0.5';
    m.materials = m.materials.map((x) => ({ ...x, cohesion: 0, friction_angle: 30 }));
    m.analysis.surface = { type: 'circle', ...CIRCLE }; m.analysis.search = null; m.analysis.methods = ['bishop'];
    m.analysis.tension_crack = { depth, water_fill: 1 };
  });
  const fAuto0 = granular('granular-auto', 'auto');
  const fFija = granular('granular-fija', 1.5);
  await casosOpen(fAuto0);
  await p.waitForSelector('.cases-view #results-title', { timeout: 60000 });
  await p.waitForTimeout(800);
  let texts = await p.evaluate(() => window.__fillTexts.slice());
  step(`${theme}: Casos (c = 0, grieta automática): el Canvas 2D dibuja «Sin grieta (z = 0)» una vez`, texts.filter((t) => t === 'Sin grieta (z = 0)').length === 1, { textos: texts.filter((t) => /grieta|Pw/i.test(t)) });
  step(`${theme}: Casos sin grieta: no hay rótulo de profundidad ni de Pw`, !texts.some((t) => /^Grieta d =|^Pw =/.test(t)), {});
  const tableText = await p.locator('.cases-view').innerText();
  step(`${theme}: Casos: la tabla de la grieta dice lo mismo («Sin grieta (z = 0)»)`, /Sin grieta \(z = 0\)/.test(tableText), {});
  await p.screenshot({ path: path.join(SHOTS, `${theme}-2-casos-sin-grieta.png`), fullPage: true });
  await axe(p, `${theme} Casos sin grieta`);
  await casosOpen(fFija);
  await p.waitForSelector('.cases-view #results-title', { timeout: 60000 });
  await p.waitForTimeout(800);
  texts = await p.evaluate(() => window.__fillTexts.slice());
  step(`${theme}: Casos (grieta fija de 1,5 m): dibuja la grieta con su profundidad y NO el rótulo «Sin grieta»`, texts.some((t) => /^Grieta d = /.test(t)) && !texts.includes('Sin grieta (z = 0)'), { textos: texts.filter((t) => /grieta|Pw/i.test(t)) });
  await p.screenshot({ path: path.join(SHOTS, `${theme}-3-casos-grieta-fija.png`), fullPage: true });

  // El editor, con el mismo modelo, repite el rótulo en SVG (paridad con Casos).
  await p.getByRole('tab', { name: 'Editar' }).click();
  await p.waitForSelector('[data-layer="regions"] polygon');
  await openFile(fAuto0);
  await p.getByRole('tab', { name: 'Análisis' }).click();
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await p.waitForSelector('[data-crack-label="none"]', { state: 'attached', timeout: 30000 });
  step(`${theme}: el editor, con el mismo modelo, rotula «Sin grieta (z = 0)» en el lienzo`, (await p.locator('[data-crack-label="none"]').textContent()) === 'Sin grieta (z = 0)', {});
  step(`${theme}: consola sin errores ni HTTP ≥ 400`, errors.length === 0, { errors });
  await ctx.close();
}
await b.close();
console.log(`RESUMEN OK=${oks} FAIL=${fails} errores_consola=${errors.length}`);
