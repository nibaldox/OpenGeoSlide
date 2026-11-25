// U3-I: axe (wcag2a/aa/21aa/22aa + best-practice) en claro y oscuro sobre el editor, la pestaña «Proyecto», los diálogos de confirmación
// (descartar y eliminar región) y la Ayuda; capturas u3i-*.png en $TMPDIR/u3x-shots. Uso: OGS_URL=http://127.0.0.1:5186/ node u3i_axe_shots.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const AXE = process.env.TMPDIR + '/x8-ux/node_modules/axe-core/axe.min.js';
const SHOTS = path.join(process.env.TMPDIR, 'u3x-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const CONFIRM = '[data-testid="confirm-dialog"]';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const summary = [];
let bad = 0;
async function axe(p, label) {
  await p.addScriptTag({ path: AXE });
  const r = await p.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
  const sc = r.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  bad += sc.length;
  summary.push({ label, serious_critical: sc, otras: r.filter((v) => !sc.includes(v)).map((v) => `${v.id}:${v.impact}`) });
  console.log(sc.length === 0 ? 'OK  ' : 'FAIL', label, JSON.stringify({ sc, otras: r.filter((v) => !sc.includes(v)).map((v) => `${v.id}:${v.impact}`) }));
}
async function openMenu(p, name) {
  const t = p.getByRole('button', { name, exact: true });
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
  await p.waitForFunction((n) => [...document.querySelectorAll('button.dd-trigger')].some((x) => x.textContent.trim().startsWith(n) && x.getAttribute('aria-expanded') === 'true'), name);
}

for (const theme of ['light', 'dark']) {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const tag = `${theme}-${w}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme });
    await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.theme.v1', t); localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} }, theme);
    const p = await ctx.newPage();
    await p.goto(URL_);
    await p.waitForSelector('[data-testid="editor-app"]');
    await p.waitForSelector('[data-layer="regions"] polygon');
    await p.waitForTimeout(300);
    // 1. editor
    await axe(p, `${tag} editor (Geometría)`);
    // 2. Proyecto
    await p.getByRole('tab', { name: 'Proyecto' }).click();
    await p.getByLabel('Título', { exact: true }).fill('Talud norte, corte 12');
    await p.getByLabel('Título', { exact: true }).press('Enter');
    await p.getByLabel('Descripción').fill('Corte de 12 m en arcilla firme.\nDatos de la campaña de 2025.');
    await p.getByLabel('Descripción').press('Tab');
    await p.waitForTimeout(250);
    await p.locator('#ea-tabpanel').scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SHOTS}/u3i-proyecto-${tag}.png` });
    await axe(p, `${tag} pestaña Proyecto`);
    // 3. Diálogo de descarte (Nuevo con cambios sin guardar)
    await openMenu(p, 'Archivo');
    await p.getByRole('button', { name: 'Nuevo', exact: true }).click();
    await p.waitForSelector(`dialog${CONFIRM}[open]`);
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${SHOTS}/u3i-confirmar-descartar-${tag}.png` });
    await axe(p, `${tag} diálogo de descarte abierto`);
    await p.getByRole('button', { name: 'Seguir editando' }).click();
    await p.waitForSelector(CONFIRM, { state: 'detached' });
    // 4. Diálogo de eliminar región
    await p.getByRole('tab', { name: 'Geometría' }).click();
    await p.getByRole('button', { name: 'Eliminar región 1', exact: true }).click();
    await p.waitForSelector(`dialog${CONFIRM}[open]`);
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${SHOTS}/u3i-confirmar-eliminar-${tag}.png` });
    await axe(p, `${tag} diálogo de eliminar región abierto`);
    await p.getByRole('button', { name: 'Conservar la región' }).click();
    await p.waitForSelector(CONFIRM, { state: 'detached' });
    // 5. Ayuda (atajos, con R)
    await p.getByRole('button', { name: 'Ayuda' }).click();
    await p.waitForSelector('dialog[open]');
    await p.getByRole('link', { name: /Atajos/ }).first().click().catch(() => {});
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${SHOTS}/u3i-ayuda-atajos-${tag}.png` });
    await axe(p, `${tag} Ayuda`);
    await ctx.close();
  }
}
await b.close();
writeFileSync(path.join(SHOTS, 'u3i-axe.json'), JSON.stringify(summary, null, 1));
console.log(bad === 0 ? `AXE: ${summary.length} vistas, 0 serious/critical` : `AXE: ${bad} serious/critical en ${summary.length} vistas`);
process.exit(bad === 0 ? 0 : 1);
