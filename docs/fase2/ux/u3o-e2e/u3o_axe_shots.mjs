// U3-O: axe (claro y oscuro) y capturas de la guía, la ayuda, la confirmación, el panel Proyecto y «Instalar app».
// Vistas: guía abierta (primera visita), cada paso de la guía, ayuda, confirmación, panel Proyecto, botón instalar.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const AXE = process.env.TMPDIR + '/x8-ux/node_modules/axe-core/axe.min.js';
const SHOTS = path.join(process.env.TMPDIR, 'u3x-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const WITH_PROJECT = process.env.WITH_PROJECT !== '0';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
const summary = [];
async function axe(p, label) {
  await p.addScriptTag({ path: AXE });
  const r = await p.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, nodes: v.nodes.slice(0, 2).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join(' ')) }));
  });
  const bad = r.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  summary.push({ label, serious_critical: bad, otras: r.filter((v) => !bad.includes(v)).map((v) => `${v.id}:${v.impact}`) });
  console.log(bad.length === 0 ? 'OK  ' : 'FAIL', label, JSON.stringify(bad.length ? bad : { otras: summary.at(-1).otras }));
}

for (const theme of ['light', 'dark']) {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const tag = `${theme}-${w}`;
    // 1. Primera visita: la guía abierta sola
    {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme, hasTouch: w < 500 });
      await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.theme.v1', t); } catch {} }, theme);
      const p = await ctx.newPage();
      await p.goto(URL_);
      await p.waitForFunction(() => document.querySelector('[data-testid="guided-tour"]')?.matches(':popover-open'));
      await p.waitForTimeout(700);
      await p.screenshot({ path: `${SHOTS}/o-guia-paso1-${tag}.png` });
      await axe(p, `${tag} guía paso 1 abierta`);
      // pasos 2 a 5 (capturas y axe del último)
      for (let i = 2; i <= 5; i++) {
        await p.getByRole('button', { name: i === 5 ? 'Siguiente' : 'Siguiente' }).click();
        await p.waitForTimeout(450);
        if (i === 3 || i === 5) await p.screenshot({ path: `${SHOTS}/o-guia-paso${i}-${tag}.png` });
      }
      await axe(p, `${tag} guía paso 5`);
      // Instalar app visible
      await p.getByRole('button', { name: 'Terminar' }).click();
      await p.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); });
      await p.waitForSelector('[data-testid="install-app"]');
      await p.screenshot({ path: `${SHOTS}/o-instalar-${tag}.png` });
      await axe(p, `${tag} botón Instalar app y Ayuda en cabecera`);
      // 2. Ayuda
      await p.getByRole('button', { name: 'Ayuda', exact: true }).click();
      await p.waitForSelector('dialog[data-testid="help-dialog"][open]');
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${SHOTS}/o-ayuda-${tag}.png` });
      await axe(p, `${tag} ayuda (inicio)`);
      for (const [name, file] of [['Glosario', 'glosario'], ['Atajos de teclado', 'atajos'], ['Limitaciones', 'limites']]) {
        await p.getByRole('link', { name, exact: true }).click();
        await p.waitForTimeout(250);
        await p.screenshot({ path: `${SHOTS}/o-ayuda-${file}-${tag}.png` });
        if (file === 'atajos') await axe(p, `${tag} ayuda (atajos)`);
      }
      await ctx.close();
    }
    // 3. Panel Proyecto y confirmación
    if (WITH_PROJECT) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme });
      await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.theme.v1', t); localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} }, theme);
      const p = await ctx.newPage();
      await p.goto(URL_);
      await p.waitForSelector('[data-testid="editor-app"]');
      await p.getByRole('tab', { name: 'Proyecto' }).click();
      await p.getByLabel('Título', { exact: true }).fill('Talud norte, corte 12');
      await p.getByLabel('Título', { exact: true }).press('Enter');
      await p.waitForTimeout(300);
      await p.locator('#ea-tabpanel').scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SHOTS}/o-proyecto-${tag}.png` });
      await axe(p, `${tag} panel Proyecto`);
      await p.getByLabel('Unidades').selectOption('imperial');
      await p.waitForSelector('dialog[data-testid="confirm-dialog"][open]');
      await p.waitForTimeout(250);
      await p.screenshot({ path: `${SHOTS}/o-confirmar-${tag}.png` });
      await axe(p, `${tag} confirmación de unidades`);
      await ctx.close();
    }
  }
}
await b.close();
writeFileSync(path.join(SHOTS, 'o-axe.json'), JSON.stringify(summary, null, 1));
const bad = summary.filter((s) => s.serious_critical.length > 0);
console.log(`AXE: ${summary.length} vistas, ${bad.length} con violaciones serious/critical`);
