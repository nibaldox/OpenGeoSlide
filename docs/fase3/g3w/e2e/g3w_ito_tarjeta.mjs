// F3G-G3 W-ito (integrado por I-G): recorrido en Chrome del pilote de Ito-Matsui (tarjeta, validación, aviso de rango, guardado v0.5) y axe
// en claro y oscuro, con el MOTOR REAL (WASM de la web, sin inyección ni datos simulados). El archivo guardado se vuelve a calcular con el
// binario `ogs analyze` (OGS_BIN, el mismo núcleo): debe aceptar `lateral_pressure` y dar un FS finito.
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=$PWD [OGS_BIN=$PWD/target/release/ogs] TMPDIR=<scratch> node docs/fase3/g3w/e2e/g3w_ito_tarjeta.mjs
//   (playwright-core desde docs/node_modules; axe-core: AXE=<axe.min.js> o <scratch>/x8-ux/node_modules/axe-core/axe.min.js). SHOTS=<carpeta> cambia las capturas.
// Imprime una línea `OK` o `FAIL` por comprobación (el runner cuenta ^FAIL y exige al menos un ^OK).
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const TMP = process.env.TMPDIR ?? os.tmpdir();
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const REPO = process.env.OGS_REPO ?? process.cwd();
const OGS_BIN = process.env.OGS_BIN ?? path.join(REPO, 'target/release/ogs');
const SHOTS = process.env.SHOTS ?? path.join(TMP, 'g3w-ito-shots');
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
for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); localStorage.setItem('ogs.theme.v1', t); } catch {} }, theme);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) errors.push(m.text()); });
  p.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await p.goto(URL_);
  await p.waitForSelector('[data-layer="regions"] polygon');
  await p.waitForFunction(() => /ogs-core/.test(document.querySelector('[data-testid="engine-banner"]')?.textContent ?? ''));
  await p.getByRole('tab', { name: 'Refuerzos' }).click();
  await p.getByRole('button', { name: 'Agregar pilote' }).click();
  const panel = p.locator('#ea-tabpanel');
  const origin = panel.getByLabel('Refuerzo 1: Origen de la fuerza', { exact: true });
  step(`${theme}: el selector de origen existe y dice «Fuerza dada»`, (await origin.inputValue()) === 'force' && (await origin.locator('option:checked').textContent()) === 'Fuerza dada');
  step(`${theme}: sin diámetro con fuerza dada`, (await panel.getByLabel(/Refuerzo 1: Diámetro/).count()) === 0);
  await origin.selectOption('ito_matsui');
  await p.waitForTimeout(200);
  const names = ['Refuerzo 1: Diámetro (m)', 'Refuerzo 1: Ubicación de la fuerza', 'Refuerzo 1: Capacidad al corte (kN)', 'Refuerzo 1: Capacidad a momento (kN·m)'];
  for (const n of names) step(`${theme}: campo «${n}»`, (await panel.getByLabel(n, { exact: true }).count()) === 1);
  step(`${theme}: ya no está «Fuerza de corte»`, (await panel.getByLabel(/Refuerzo 1: Fuerza de corte/).count()) === 0);
  step(`${theme}: diámetro propuesto 0,8`, (await panel.getByLabel('Refuerzo 1: Diámetro (m)', { exact: true }).inputValue()) === '0,8');
  step(`${theme}: ubicación centroide`, (await panel.getByLabel('Refuerzo 1: Ubicación de la fuerza', { exact: true }).inputValue()) === 'centroid');
  const doc1 = await p.evaluate(() => document.querySelector('[data-testid="ito-matsui-ratio"]')?.textContent ?? '');
  step(`${theme}: S/D informado`, /S\/D = 2,5/.test(doc1), { doc1 });
  step(`${theme}: S/D = 2,5 no avisa`, (await p.locator('[data-testid="ito-matsui-range"]').count()) === 0);
  // capacidad y espaciamiento fuera de rango
  await panel.getByLabel('Refuerzo 1: Capacidad al corte (kN)', { exact: true }).fill('150');
  await panel.getByLabel('Refuerzo 1: Capacidad al corte (kN)', { exact: true }).press('Enter');
  await panel.getByLabel('Refuerzo 1: Capacidad a momento (kN·m)', { exact: true }).fill('250');
  await panel.getByLabel('Refuerzo 1: Capacidad a momento (kN·m)', { exact: true }).press('Enter');
  const sp = panel.getByLabel('Refuerzo 1: Espaciamiento (m)', { exact: true });
  await sp.fill('1,2'); await sp.press('Enter'); await p.waitForTimeout(200);
  step(`${theme}: S/D = 1,5 avisa`, (await p.locator('[data-testid="ito-matsui-range"]').textContent())?.includes('S/D = 1,5 fuera de 2 a 8'));
  await p.screenshot({ path: `${SHOTS}/ito-tarjeta-aviso-${theme}.png` });
  await axe(p, `${theme} tarjeta con aviso de rango`);
  // espaciamiento menor que el diámetro: error y borrador pendiente
  await sp.fill('0,5'); await sp.press('Enter'); await p.waitForTimeout(200);
  const err = await p.evaluate(() => document.querySelector('[data-path="/reinforcements/0/spacing"]')?.getAttribute('aria-invalid'));
  const txt = await panel.innerText();
  step(`${theme}: spacing ≤ diámetro marca error`, err === 'true' && /debe ser mayor que el diámetro del pilote \(0,8 m\)/.test(txt), { err });
  await p.screenshot({ path: `${SHOTS}/ito-tarjeta-error-${theme}.png` });
  await axe(p, `${theme} tarjeta con error de espaciamiento`);
  await sp.fill('2,4'); await sp.press('Enter'); await p.waitForTimeout(200);
  // Diagnósticos: sin errores del pilote
  // volver a fuerza dada
  await origin.selectOption('force'); await p.waitForTimeout(200);
  step(`${theme}: volver a «Fuerza dada» muestra «Fuerza de corte»`, (await panel.getByLabel(/Refuerzo 1: Fuerza de corte/).count()) === 1);
  await origin.selectOption('ito_matsui'); await p.waitForTimeout(200);
  // Al volver a «Fuerza dada» el modelo ya no lleva la capacidad (sin presión del suelo no es válida): se vuelve a escribir.
  await panel.getByLabel('Refuerzo 1: Capacidad al corte (kN)', { exact: true }).fill('150');
  await panel.getByLabel('Refuerzo 1: Capacidad al corte (kN)', { exact: true }).press('Enter');
  // Guardar descarga: versión 0.5
  await p.getByRole('button', { name: 'Archivo' }).click();
  await p.waitForTimeout(200);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /^Guardar/ }).first().click()]);
  const f = path.join(TMP, `g3w-ito-${theme}.ogs.json`); await dl.saveAs(f);
  const saved = JSON.parse(readFileSync(f, 'utf8'));
  step(`${theme}: el archivo guardado es 0.5 con lateral_pressure y sin force`, saved.version === '0.5' && saved.reinforcements?.[0]?.lateral_pressure?.diameter === 0.8 && !('force' in saved.reinforcements[0]) && saved.reinforcements[0].capacity?.shear === 150, { v: saved.version, r: saved.reinforcements?.[0] });
  // El mismo archivo en el motor nativo: acepta lateral_pressure y converge (sin inyección: es el binario real).
  const r = spawnSync(OGS_BIN, ['analyze', f], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const out = r.status === 0 ? JSON.parse(r.stdout) : null;
  const bishop = out?.results?.find((x) => x.method === 'bishop');
  step(`${theme}: el motor real (ogs analyze) calcula el archivo guardado con Ito-Matsui`, r.status === 0 && bishop?.status === 'converged' && Number.isFinite(bishop.fos), { code: r.status, fos: bishop?.fos, err: r.status === 0 ? '' : r.stderr.slice(0, 300) });
  await ctx.close();
}
await b.close();
step('consola sin errores ni respuestas HTTP ≥ 400', errors.length === 0, { errors });
console.log(`RESUMEN OK=${oks} FAIL=${fails} errores_consola=${errors.length}`);
