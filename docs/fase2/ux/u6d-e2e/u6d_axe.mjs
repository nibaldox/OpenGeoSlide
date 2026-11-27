// U6-D: axe (wcag2a/aa/21aa/22aa + best-practice) en claro y oscuro (1440 y 320 px) sobre lo nuevo: banner de borrador de otra pestaña,
// aviso de pestaña duplicada, menú «Editar · Dibujar región» a 320 px y barra con un trazo a medias. Capturas en $TMPDIR/u6d-shots.
// Uso: OGS_URL=http://127.0.0.1:5186/ node u6d_axe.mjs   (axe-core desde $TMPDIR/x8-ux/node_modules)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const TMP = process.env.TMPDIR;
const AXE = TMP + '/x8-ux/node_modules/axe-core/axe.min.js';
const SHOTS = path.join(TMP, 'u6d-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const TAB = 'ogs.editor.tab.v1';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
let bad = 0;
let views = 0;
async function axe(p, label) {
  await p.addScriptTag({ path: AXE });
  const r = await p.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
  const sc = r.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  bad += sc.length;
  views += 1;
  console.log(sc.length === 0 ? 'OK  ' : 'FAIL', label, JSON.stringify({ sc, otras: r.filter((v) => !sc.includes(v)).map((v) => `${v.id}:${v.impact}`) }));
}
const setTitle = async (p, title) => {
  await p.getByRole('tab', { name: 'Proyecto' }).click();
  await p.locator('[data-path="/meta/title"]').fill(title);
  await p.locator('[data-path="/meta/title"]').blur();
  await p.waitForTimeout(1500);
};

for (const theme of ['light', 'dark']) {
  for (const [w, h] of [[1440, 900], [320, 844]]) {
    const tag = `${theme}-${w}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme });
    await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.theme.v1', t); localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} }, theme);
    const open = async (session) => {
      const p = await ctx.newPage();
      if (session) await p.addInitScript((s) => { for (const [k, v] of Object.entries(s)) sessionStorage.setItem(k, v); }, session);
      await p.goto(URL_);
      await p.waitForSelector('[data-layer="regions"] polygon');
      return p;
    };
    const a = await open();
    await setTitle(a, 'Borrador de A');
    const idA = await a.evaluate((k) => sessionStorage.getItem(k), TAB);
    // 1. banner: el borrador de A sigue abierto
    const bb = await open();
    await bb.locator('[data-testid="draft-open-elsewhere"]').waitFor({ timeout: 4000 });
    await bb.screenshot({ path: path.join(SHOTS, `axe-${tag}-banner.png`) });
    await axe(bb, `${tag} banner de borrador de otra pestaña`);
    await bb.getByRole('button', { name: 'Descartar', exact: true }).click();
    await bb.waitForTimeout(300);
    await axe(bb, `${tag} tras «Descartar» (aviso de que el borrador sigue)`);
    // 2. pestaña duplicada
    const dup = await open({ [TAB]: idA });
    await dup.locator('[data-testid="notices"]').waitFor({ timeout: 4000 });
    await dup.screenshot({ path: path.join(SHOTS, `axe-${tag}-duplicada.png`) });
    await axe(dup, `${tag} aviso de pestaña duplicada`);
    // 3. «Editar · Dibujar región» y trazo a medias
    const p = await open();
    await p.getByRole('button', { name: /^Descartar$/ }).click().catch(() => {});
    // UA: a 480 px o menos el menú «Editar» solo trae Deshacer y Rehacer; la herramienta se elige siempre en la paleta del lienzo.
    await p.locator('nav[aria-label="Herramientas del lienzo"]').getByRole('button', { name: 'Dibujar región', exact: true }).click();
    const box = await p.locator('svg.ec-svg').boundingBox();
    for (const [fx, fy] of [[0.7, 0.12], [0.85, 0.12]]) await p.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SHOTS, `axe-${tag}-trazo.png`) });
    await axe(p, `${tag} trazo a medias: «con cambios sin guardar»` + (w <= 480 ? ' y «Editar · Dibujar región»' : ''));
    await ctx.close();
  }
}
console.log(`AXE: ${views} vistas, ${bad} serious/critical`);
await b.close();
process.exit(bad ? 1 : 0);
