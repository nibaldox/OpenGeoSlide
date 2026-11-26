import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const AXE = new URL('./node_modules/axe-core/axe.min.js', import.meta.url).pathname;
let bad = 0;
for (const theme of ['light', 'dark']) {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, colorScheme: theme });
  await ctx.addInitScript((t) => { localStorage.setItem('ogs.onboarding.v1', 'seen'); localStorage.setItem('ogs.theme.v1', t); }, theme);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5183/');
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
    console.log(theme, tab, 'violaciones:', JSON.stringify(r), 'serious/critical:', serious.length);
  }
  await browser.close();
}
console.log('SERIOUS_OR_CRITICAL', bad);
