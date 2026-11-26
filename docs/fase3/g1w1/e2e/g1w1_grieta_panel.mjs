// W1 F3G: recorrido del panel «Análisis» con la grieta de tracción y del panel «Agua». OGS_URL (por defecto 5183); sin THEME recorre claro y oscuro;
// OUT (por defecto <TMPDIR>/g1w1-out) recibe capturas y archivos guardados. Sin datos simulados: solo edita el modelo, no calcula.
import { chromium } from 'playwright-core';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const URL = process.env.OGS_URL ?? 'http://127.0.0.1:5183/';
const OUT = process.env.OUT ?? path.join(process.env.TMPDIR ?? os.tmpdir(), 'g1w1-out');
mkdirSync(OUT, { recursive: true });
const themes = process.env.THEME ? [process.env.THEME] : ['light', 'dark'];
let theme = themes[0];
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'OK' : 'FAIL', `[${theme}] ${name}`, extra]); console.log(cond ? 'OK  ' : 'FAIL', `[${theme}]`, name, extra); };

for (const th of themes) {
  theme = th;
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true, colorScheme: theme });
  await ctx.addInitScript((t) => { localStorage.setItem('ogs.onboarding.v1', 'seen'); localStorage.setItem('ogs.theme.v1', t); }, theme);
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) consoleErrors.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(URL);
  await page.waitForSelector('[data-testid="engine-banner"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="engine-banner"]')?.textContent?.includes('ogs-core'), null, { timeout: 30000 });

  await page.getByRole('tab', { name: 'Análisis' }).click();
  const panel = page.locator('section[aria-labelledby]').filter({ has: page.getByRole('heading', { name: 'Análisis', exact: true }) });
  const box = page.getByLabel('Incluir grieta de tracción');
  ok('casilla visible y apagada', (await box.count()) === 1 && !(await box.isChecked()));
  ok('sin campos con la casilla apagada', (await page.getByLabel(/Fracción de agua en la grieta/).count()) === 0);

  await box.check();
  await page.waitForTimeout(300);
  const fill = page.getByLabel('Fracción de agua en la grieta');
  ok('al crearla, fracción de agua en 1', (await fill.inputValue()) === '1');
  const mode = page.getByLabel('Tipo de profundidad de la grieta');
  ok('al crearla, profundidad Automática', (await mode.inputValue()) === 'auto');
  ok('con Automática no hay campo numérico', (await page.getByLabel(/^Profundidad de la grieta/).count()) === 0);
  await page.screenshot({ path: `${OUT}/analisis-auto-${theme}.png` });

  await mode.selectOption('fixed');
  const depth = page.getByLabel(/^Profundidad de la grieta/);
  ok('Fija: campo numérico con la unidad', ((await page.locator('label', { hasText: /^Profundidad de la grieta/ }).first().textContent()) ?? '').includes('(m)'));
  await depth.fill('2,5'); await depth.blur();
  await page.waitForTimeout(200);
  await fill.fill('0,5'); await fill.blur();
  await page.waitForTimeout(200);

  await depth.fill('0'); await depth.blur();
  await page.waitForTimeout(300);
  const errTxt = (await page.locator('.ep-error').allTextContents()).join(' | ');
  ok('depth 0: error con el texto del motor', errTxt.includes('debe ser finito y mayor que 0 (o «Automática»)'), errTxt);
  ok('depth 0: aria-invalid', (await depth.getAttribute('aria-invalid')) === 'true');
  await page.screenshot({ path: `${OUT}/analisis-error-${theme}.png` });
  await depth.press('Escape');
  await page.waitForTimeout(200);
  ok('Esc devuelve el valor guardado', (await depth.inputValue()) === '2,5');

  await fill.fill('1,5'); await fill.blur(); await page.waitForTimeout(300);
  ok('water_fill 1,5: error', (await page.locator('.ep-error').allTextContents()).join(' ').includes('debe ser finito y estar en [0, 1]'));
  await fill.press('Escape');

  // Guardar y reabrir: versión 0.5 y la grieta al final de `analysis`.
  await page.getByRole('button', { name: 'Archivo', exact: true }).click(); await page.waitForTimeout(300);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Guardar', exact: true }).click()]);
  const p = `${OUT}/saved-${theme}.ogs.json`;
  await dl.saveAs(p);
  const saved = JSON.parse(readFileSync(p, 'utf8'));
  ok('guarda version 0.5', saved.version === '0.5', saved.version);
  ok('guarda tension_crack {2.5, 0.5} al final de analysis', JSON.stringify(saved.analysis.tension_crack) === '{"depth":2.5,"water_fill":0.5}' && Object.keys(saved.analysis).at(-1) === 'tension_crack', JSON.stringify(saved.analysis));

  // Apagar: se quita y vuelve la versión mínima.
  await box.uncheck(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Archivo', exact: true }).click(); await page.waitForTimeout(300);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Guardar', exact: true }).click()]);
  const p2 = `${OUT}/saved2-${theme}.ogs.json`;
  await dl2.saveAs(p2);
  const saved2 = JSON.parse(readFileSync(p2, 'utf8'));
  ok('sin grieta: version mínima y sin tension_crack', saved2.version !== '0.5' && !('tension_crack' in saved2.analysis), saved2.version);

  // Panel «Agua»
  await page.getByRole('tab', { name: 'Agua' }).click();
  const waterText = await page.locator('section', { has: page.getByRole('heading', { name: 'Agua', exact: true }) }).first().innerText();
  ok('Agua: texto del agua embalsada', waterText.includes('agua embalsada se carga automáticamente') && waterText.includes('sin sismo'));
  await page.screenshot({ path: `${OUT}/agua-${theme}.png` });

  ok('consola sin errores ni HTTP ≥ 400', consoleErrors.length === 0, consoleErrors.join(' || '));
  await browser.close();
  writeFileSync(`${OUT}/result-${theme}.txt`, results.map((r) => r.join(' ')).join('\n'));
  const fails = results.filter((r) => r[0] === 'FAIL').length;
  console.log(`TOTAL ${results.length - fails} OK, ${fails} FAIL`);
}
