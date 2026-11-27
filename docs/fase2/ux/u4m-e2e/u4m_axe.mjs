// U4-M: axe (wcag2a/aa/21aa/22aa + best-practice) en claro y oscuro (1440×900 y 390×844) sobre las vistas nuevas: «Talud simple…» con estrato
// inferior, talud de dos estratos con las muestras de color en Geometría, «Dividir región» con una línea en curso y «Dibujar región» con el
// ajuste a aristas. Capturas en u4m-shots. Uso: OGS_URL=http://127.0.0.1:5186/ node u4m_axe.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { makeSlope, viewportOf, openMenu, discardIfAsked } from './lib.mjs';

const AXE = process.env.TMPDIR + '/x8-ux/node_modules/axe-core/axe.min.js';
const SHOTS = path.join(process.env.TMPDIR, 'u4m-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const summary = [];
let bad = 0;
async function axe(p, label) {
  await p.addScriptTag({ path: AXE });
  const r = await p.evaluate(async () => { const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }); return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes[0]?.html?.slice(0, 140) })); });
  const sc = r.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  bad += sc.length;
  summary.push({ label, violaciones: r.length, serious_critical: sc, otras: r.filter((v) => !sc.includes(v)).map((v) => `${v.id}:${v.impact}`) });
  console.log(sc.length === 0 ? 'OK  ' : 'FAIL', label, JSON.stringify({ total: r.length, sc, otras: r.filter((v) => !sc.includes(v)).map((v) => `${v.id}:${v.impact}`) }));
}
for (const theme of ['light', 'dark']) {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.theme.v1', t); } catch {} }, theme);
    await ctx.addInitScript(() => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} });
    const p = await ctx.newPage();
    await p.goto(URL_, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-layer="regions"] polygon');
    const tag = `${theme}-${w}`;
    const shot = (n) => p.screenshot({ path: `${SHOTS}/u4m-axe-${tag}-${n}.png`, fullPage: w < 600 });
    // 1. «Talud simple…» con el estrato inferior encendido
    await openMenu(p, 'Archivo');
    await p.getByRole('button', { name: 'Talud simple…' }).click();
    await p.waitForSelector('dialog[open]');
    await p.getByLabel('Agregar un estrato inferior (material 2)').check();
    await p.waitForTimeout(200);
    await shot('1-dialogo-estrato');
    await axe(p, `${tag} diálogo Talud simple con estrato inferior`);
    await p.getByRole('button', { name: 'Cancelar' }).click();
    await p.waitForSelector('dialog[open]', { state: 'detached' });
    // 2. talud de un material → Dividir región con una línea en curso
    await makeSlope(p);
    await p.getByRole('tab', { name: 'Geometría' }).click();
    // UA: a 480 px o menos el menú «Editar» solo trae Deshacer y Rehacer; las herramientas se eligen siempre en la paleta del lienzo.
    await p.locator('nav[aria-label="Herramientas del lienzo"]').getByRole('button', { name: 'Dividir región', exact: true }).click();
    await p.waitForSelector('[data-testid="split-hint"]');
    const vp = await viewportOf(p);
    const [lx, ly] = vp.px(0, -5);
    await p.mouse.move(lx + 2, ly);
    await p.mouse.click(lx + 2, ly);
    await p.mouse.move(vp.px(26, 0)[0], vp.px(26, -5)[1]);
    await p.waitForTimeout(200);
    await shot('2-dividiendo');
    await axe(p, `${tag} Dividir región con una línea en curso`);
    // 3. completar la división y ver Geometría con las dos regiones y sus muestras
    const [rx, ry] = vp.px(52.5, -5);
    await p.mouse.click(rx - 2, ry);
    await p.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length === 2);
    await p.waitForTimeout(300);
    await shot('3-geometria-2-regiones');
    await axe(p, `${tag} Geometría con dos regiones y muestras de material`);
    // 4. Dibujar región con el puntero sobre una arista (indicador de ajuste)
    // UA: a 480 px o menos el menú «Editar» solo trae Deshacer y Rehacer; las herramientas se eligen siempre en la paleta del lienzo.
    await p.locator('nav[aria-label="Herramientas del lienzo"]').getByRole('button', { name: 'Dibujar región', exact: true }).click();
    await p.waitForSelector('[data-testid="draw-hint"]');
    const [bx, by] = vp.px(20, -10);
    await p.mouse.click(bx, by + 3);
    await p.mouse.move(bx + 60, by + 40);
    await p.waitForTimeout(200);
    await shot('4-dibujando-arista');
    await axe(p, `${tag} Dibujar región apoyado en una arista`);
    await ctx.close();
  }
}
writeFileSync(`${SHOTS}/u4m-axe.json`, JSON.stringify(summary, null, 1));
await b.close();
console.log(bad === 0 ? 'AXE: 0 serious/critical' : `AXE: ${bad} serious/critical`);
process.exit(bad === 0 ? 0 : 1);
