// U3-M: axe (wcag2a/aa/21aa/22aa + best-practice) en claro y oscuro sobre las vistas nuevas; capturas en u3x-shots.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const AXE = process.env.TMPDIR + '/x8-ux/node_modules/axe-core/axe.min.js';
const SHOTS = path.join(process.env.TMPDIR, 'u3x-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const summary = [];
let bad = 0;
async function axe(p, label) {
  await p.addScriptTag({ path: AXE });
  const r = await p.evaluate(async () => { const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }); return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes[0]?.html.slice(0, 120) })); });
  const sc = r.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  bad += sc.length;
  summary.push({ label, serious_critical: sc, otras: r.filter((v) => !sc.includes(v)).map((v) => `${v.id}:${v.impact}`) });
  console.log(sc.length === 0 ? 'OK  ' : 'FAIL', label, JSON.stringify({ sc, otras: r.filter((v) => !sc.includes(v)).map((v) => `${v.id}:${v.impact}`) }));
}
// U3-I: «descartar cambios» es un diálogo propio (`useConfirm`), no window.confirm. Acepta si aparece (solo con cambios sin guardar).
async function discardIfAsked(page, label = 'Descartar cambios') {
  const dlg = page.locator('[data-testid="confirm-dialog"]');
  try { await dlg.waitFor({ state: 'visible', timeout: 1500 }); } catch { return false; }
  await dlg.getByRole('button', { name: label, exact: true }).click();
  await dlg.waitFor({ state: 'detached' });
  return true;
}
async function openMenu(p, name) {
  const t = p.getByRole('button', { name, exact: true });
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
  await p.waitForFunction((n) => [...document.querySelectorAll('button.dd-trigger')].some((x) => x.textContent.trim().startsWith(n) && x.getAttribute('aria-expanded') === 'true'), name);
}
for (const theme of ['light', 'dark']) {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.theme.v1', t); } catch {} }, theme);
    await ctx.addInitScript(() => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} }); // guía ya vista
    const p = await ctx.newPage();
    p.on('dialog', (d) => d.accept());
    await p.goto(URL_, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-layer="regions"] polygon');
    const tag = `${theme}-${w}`;
    // 1. modelo vacío
    await openMenu(p, 'Archivo');
    await p.getByRole('button', { name: 'Nuevo', exact: true }).click();
    await p.waitForSelector('[data-testid="canvas-empty"]');
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${SHOTS}/u3m-${tag}-1-vacio.png` });
    await axe(p, `${tag} estado vacío (Geometría vacía)`);
    // 2. dibujando
    // UA: a 480 px o menos el menú «Editar» solo trae Deshacer y Rehacer; las herramientas se eligen siempre en la paleta del lienzo (sin abrir el menú).
    await p.locator('nav[aria-label="Herramientas del lienzo"]').getByRole('button', { name: 'Dibujar región' }).click(); // UA: las herramientas están en la paleta del lienzo, no en un role=toolbar
    const box = await p.locator('svg.ec-svg').boundingBox();
    const pts = [[0.2, 0.7], [0.7, 0.7], [0.62, 0.35]];
    for (const [fx, fy] of pts) await p.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await p.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3);
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${SHOTS}/u3m-${tag}-2-dibujando.png` });
    await axe(p, `${tag} dibujando (3 puntos)`);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(200);
    // 3. panel Geometría con región y resultados (talud simple)
    await openMenu(p, 'Archivo');
    await p.getByRole('button', { name: 'Talud simple…' }).click();
    await p.waitForSelector('dialog[open]');
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${SHOTS}/u3m-${tag}-3-dialogo.png` });
    await axe(p, `${tag} diálogo Talud simple`);
    await p.getByRole('button', { name: 'Crear talud' }).click();
    await discardIfAsked(p);
    await p.waitForSelector('dialog[open]', { state: 'detached' });
    await p.getByRole('button', { name: 'Comprobar', exact: true }).first().click();
    await p.waitForSelector('[data-testid="result-summary"][data-state="current"]', { timeout: 60000 }); // UA: el resultado se espera en el HUD (la tabla está en la vista «Resultados»)
    await p.waitForSelector('button:has-text("Comprobar"):not([disabled])');
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${SHOTS}/u3m-${tag}-4-geometria.png`, fullPage: w < 600 });
    await axe(p, `${tag} editor con talud, Geometría y resultados`);
    await ctx.close();
  }
}
writeFileSync(`${SHOTS}/u3m-axe.json`, JSON.stringify(summary, null, 1));
await b.close();
console.log(bad === 0 ? 'AXE: 0 serious/critical' : `AXE: ${bad} serious/critical`);
process.exit(bad === 0 ? 0 : 1);
