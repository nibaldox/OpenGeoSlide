// U2-C: axe-core (claro y oscuro) y capturas 1440×900, 1024×768 y 390×844 de la vista Editar.
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SHOTS = path.join(process.env.TMPDIR, 'u2x-shots');
mkdirSync(SHOTS, { recursive: true });
const AXE = readFileSync(path.join(process.env.TMPDIR, 'x8-ux/node_modules/axe-core/axe.min.js'), 'utf8');
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5187/';
const CASE = process.env.OGS_CASE ?? 'V016a';
const sizes = [[1440, 900], [1024, 768], [390, 844]];
let bad = 0;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(URL_);
  await page.waitForSelector('[data-handle="vertex"]');
  const sel = 'select[aria-label="Abrir un caso publicado como modelo"]';
  const optLabel = await page.evaluate(([s, id]) => [...document.querySelectorAll(s + ' option')].find((o) => o.textContent.includes(id))?.textContent, [sel, CASE]);
  await page.selectOption(sel, { label: optLabel });
  await page.waitForSelector('[data-handle="circle_center"]');
  await page.getByRole('button', { name: 'Comprobar' }).first().click();
  await page.waitForSelector('[data-layer="result"]', { timeout: 30000 });
  // Un vértice con foco de teclado para ver el anillo
  await page.keyboard.press('Tab');
  await page.focus('[data-handle-key="v-1-1"]');
  await page.keyboard.press('Tab');
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    await page.evaluate(() => document.querySelector('svg[role="application"]').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, `canvas-${scheme}-${w}x${h}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(250);
  await page.evaluate((s) => { window.eval(s); }, AXE);
  const res = await page.evaluate(async () => {
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0].target.join(' ').slice(0, 120) }));
  });
  const serious = res.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  bad += serious.length;
  console.log(`axe ${scheme}: ${res.length} violaciones en total, ${serious.length} serious/critical`);
  for (const v of res) console.log('   ', v.impact, v.id, v.n, v.sample);
  // axe sobre el lienzo solamente
  const canvasOnly = await page.evaluate(async () => {
    const r = await axe.run(document.querySelector('.ec-root'), {});
    return r.violations.map((v) => v.id + ':' + v.impact + ':' + v.nodes.length);
  });
  console.log(`axe ${scheme} (solo .ec-root):`, canvasOnly.length ? canvasOnly : 'sin violaciones');
  await ctx.close();
}
await browser.close();
console.log(bad === 0 ? 'AXE: 0 serious/critical en claro y oscuro' : `AXE: ${bad} serious/critical`);
process.exit(bad === 0 ? 0 : 1);
