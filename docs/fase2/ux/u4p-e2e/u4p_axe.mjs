// U4-P: axe (wcag2a/aa/21aa/22aa + best-practice) en claro y oscuro sobre las vistas que cambió el pulido.
// Uso: OGS_URL=http://127.0.0.1:5187/ node u4p_axe.mjs  (axe-core desde $TMPDIR/x8-ux/node_modules)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const AXE = process.env.TMPDIR + '/x8-ux/node_modules/axe-core/axe.min.js';
const SHOTS = path.join(process.env.TMPDIR, 'u4p-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5187/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
let bad = 0;
async function axe(p, label) {
  await p.addScriptTag({ path: AXE });
  const r = await p.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] });
    return { v: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })), inc: r.incomplete.map((v) => v.id) };
  });
  const sc = r.v.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  bad += sc.length;
  console.log(sc.length === 0 ? 'OK  ' : 'FAIL', label, JSON.stringify({ total: r.v.length, sc, otras: r.v.filter((v) => !sc.includes(v)).map((v) => `${v.id}:${v.impact}`) }));
}
const openFile = (page, name, text) => page.setInputFiles('[data-testid="file-open"]', { name, mimeType: 'application/json', buffer: Buffer.from(text) });
for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.theme.v1', t); localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} }, theme);
  const page = await ctx.newPage();
  await page.goto(URL_);
  await page.waitForSelector('[data-layer="regions"] polygon');
  await axe(page, `${theme}: editor inicial`);
  await page.getByRole('tab', { name: 'Materiales' }).click();
  await page.getByRole('button', { name: 'Nuevo material…' }).click();
  await axe(page, `${theme}: Materiales con «Nuevo material»`);
  await page.screenshot({ path: path.join(SHOTS, `u4p-materiales-${theme}.png`) });
  await page.getByRole('tab', { name: 'Cargas' }).click();
  await page.getByRole('button', { name: 'Agregar carga distribuida' }).click();
  await page.getByRole('button', { name: 'Agregar carga lineal' }).click();
  await axe(page, `${theme}: Cargas con corona`);
  for (let i = 0; i < 5; i++) await openFile(page, `d${i}.ogs.json`, '{\n' + ' '.repeat(i + 1) + '"a": x}');
  await page.getByRole('button', { name: /^Ver \d+ más$/ }).click();
  await axe(page, `${theme}: avisos (5, expandidos, «Cerrar todos»)`);
  await page.getByRole('button', { name: 'Cerrar todos' }).click();
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.waitForSelector('[data-testid="fs-bishop"]', { timeout: 60000 });
  await page.getByRole('button', { name: 'Ver tabla de resultados' }).click();
  await axe(page, `${theme}: resultados + tabla enfocada`);
  await page.screenshot({ path: path.join(SHOTS, `u4p-resultados-${theme}.png`) });
  await page.getByRole('tab', { name: /Casos de verificación/ }).click();
  await axe(page, `${theme}: casos de verificación`);
  await ctx.close();
}
await b.close();
console.log(bad === 0 ? 'AXE: 0 serious/critical' : `AXE: ${bad} serious/critical`);
process.exit(bad === 0 ? 0 : 1);
