// W1 F3G: axe (wcag2a/aa/21aa/22aa + best-practice) en claro y oscuro sobre «Análisis» (grieta con profundidad 0: error visible) y «Agua».
// OGS_URL (por defecto 5183). axe-core: AXE=<axe.min.js> o <TMPDIR>/x8-ux/node_modules/axe-core/axe.min.js (o w2-e2e). Cada vista imprime OK/FAIL
// (sin serious/critical) para el runner de regresión; el motor no interviene (solo se edita el modelo).
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const TMP = process.env.TMPDIR ?? os.tmpdir();
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5183/';
const AXE = [process.env.AXE, path.join(TMP, 'x8-ux/node_modules/axe-core/axe.min.js'), path.join(TMP, 'w2-e2e/node_modules/axe-core/axe.min.js')].find((p) => p && existsSync(p));
if (!AXE) { console.log('FAIL axe-core no encontrado (AXE=<ruta de axe.min.js>)'); process.exit(1); }
let bad = 0;
for (const theme of ['light', 'dark']) {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, colorScheme: theme });
  await ctx.addInitScript((t) => { localStorage.setItem('ogs.onboarding.v1', 'seen'); localStorage.setItem('ogs.theme.v1', t); }, theme);
  const page = await ctx.newPage();
  await page.goto(URL_);
  await page.waitForFunction(() => document.querySelector('[data-testid="engine-banner"]')?.textContent?.includes('ogs-core'), null, { timeout: 30000 });
  for (const tab of ['Análisis', 'Agua']) {
    await page.getByRole('tab', { name: tab }).click();
    if (tab === 'Análisis') {
      await page.getByLabel('Incluir grieta de tracción').check();
      await page.getByLabel('Tipo de profundidad de la grieta').selectOption('fixed');
      await page.getByLabel(/^Profundidad de la grieta/).fill('0'); await page.getByLabel(/^Profundidad de la grieta/).blur();
    }
    await page.waitForTimeout(400);
    await page.addScriptTag({ content: readFileSync(AXE, 'utf8') });
    const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.map((n) => n.target.join(' ')).slice(0, 3) })));
    const serious = r.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    bad += serious.length;
    console.log(serious.length === 0 ? 'OK  ' : 'FAIL', `axe sin serious/critical: ${theme} ${tab}`, JSON.stringify({ violaciones: r, serious: serious.length }));
  }
  await browser.close();
}
console.log('SERIOUS_OR_CRITICAL', bad);
process.exit(bad === 0 ? 0 : 1);
