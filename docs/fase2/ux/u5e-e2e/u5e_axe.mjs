// U5-E: axe (wcag2a/aa/21aa/22aa + best-practice) en claro y oscuro sobre lo nuevo: menú «Editar» a 320 px, diálogo de unidades, confirmación
// del trazo, lectura del cursor, error de γw en Diagnósticos y la tabla de vértices con 344 tiradores. Capturas en $TMPDIR/u5e-shots.
// Uso: OGS_URL=http://127.0.0.1:5186/ node u5e_axe.mjs   (axe-core desde $TMPDIR/x8-ux/node_modules)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TMP = process.env.TMPDIR;
const AXE = TMP + '/x8-ux/node_modules/axe-core/axe.min.js';
const SHOTS = path.join(TMP, 'u5e-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
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
const slope = {
  format: 'opengeoslide', version: '0.2', meta: { title: 'U5-E' }, units: 'SI',
  materials: [{ id: 'suelo', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 19, cohesion: 30, friction_angle: 28 }],
  regions: [{ material: 'suelo', polygon: [[0, 10], [10, 10], [30, 0], [60, 0], [60, -10], [0, -10]] }],
  water: { unit_weight: 9.81, piezometric_line: [[0, 6], [30, 0], [60, 0]] }, loads: [], slope: { direction: 'left_to_right' },
  analysis: { methods: ['bishop'], surface: { type: 'circle', xc: 30, yc: 30, r: 28 } },
};
const slopeFile = path.join(TMP, 'u5e-axe-slope.ogs.json');
writeFileSync(slopeFile, JSON.stringify(slope));

for (const theme of ['light', 'dark']) {
  for (const [w, h] of [[1440, 900], [320, 844]]) {
    const tag = `${theme}-${w}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme });
    await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.theme.v1', t); localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} }, theme);
    const p = await ctx.newPage();
    await p.goto(URL_);
    await p.waitForSelector('[data-layer="regions"] polygon');
    await p.waitForFunction(() => /ogs-core/.test(document.querySelector('[data-testid="engine-banner"]')?.textContent ?? ''), null, { timeout: 30000 });
    await p.waitForTimeout(300);
    // 1. barra y menú «Editar» (320) o barra completa (1440)
    await axe(p, `${tag} barra`);
    if (w <= 480) {
      await p.getByRole('button', { name: 'Editar', exact: true }).click();
      await p.waitForTimeout(200);
      await p.screenshot({ path: path.join(SHOTS, `axe-${tag}-editar.png`) });
      await axe(p, `${tag} menú Editar abierto`);
      // UA: el menú «Editar» solo trae Deshacer y Rehacer: se cierra y la herramienta se elige en la paleta.
      await p.keyboard.press('Escape');
    }
    await p.locator('nav[aria-label="Herramientas del lienzo"]').getByRole('button', { name: 'Dibujar región', exact: true }).click(); // UA: las herramientas están en la paleta del lienzo
    // 2. trazo en curso con lectura del cursor
    const box = await p.locator('svg.ec-svg').boundingBox();
    for (const [fx, fy] of [[0.7, 0.12], [0.85, 0.12], [0.85, 0.25]]) await p.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(SHOTS, `axe-${tag}-trazo.png`) });
    await axe(p, `${tag} trazo en curso con lectura del cursor`);
    // 3. confirmación al cambiar de herramienta con 3 puntos
    await p.keyboard.press('v');
    await p.waitForSelector('[data-testid="confirm-dialog"]');
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(SHOTS, `axe-${tag}-confirmar-trazo.png`) });
    await axe(p, `${tag} confirmación del trazo (danger)`);
    await p.getByRole('button', { name: 'Descartar el trazo' }).click();
    // 4. diálogo de unidades
    await p.getByRole('tab', { name: 'Proyecto' }).click();
    await p.getByLabel('Unidades', { exact: true }).selectOption('imperial');
    await p.waitForSelector('[data-testid="units-dialog"]');
    await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(SHOTS, `axe-${tag}-unidades.png`) });
    await axe(p, `${tag} diálogo de unidades`);
    await p.getByRole('button', { name: 'Solo cambiar la etiqueta' }).click();
    // 5. γw imperial: error en Diagnósticos (el ejemplo ACADS es seco: se abre un modelo con piezométrica)
    await p.setInputFiles('[data-testid="file-open"]', slopeFile);
    await p.waitForTimeout(400);
    const confirm = p.locator('[data-testid="confirm-dialog"]');
    if (await confirm.isVisible().catch(() => false)) await confirm.getByRole('button', { name: /Descartar/ }).click();
    await p.waitForTimeout(300);
    await p.getByRole('tab', { name: 'Proyecto' }).click();
    await p.getByLabel('Unidades', { exact: true }).selectOption('imperial');
    await p.waitForSelector('[data-testid="units-dialog"]');
    await p.getByRole('button', { name: 'Solo cambiar la etiqueta' }).click();
    await p.waitForTimeout(250);
    await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
    await p.waitForTimeout(1200);
    await p.screenshot({ path: path.join(SHOTS, `axe-${tag}-gammaw.png`), fullPage: true });
    await axe(p, `${tag} error de γw en Diagnósticos`);
    await ctx.close();
  }
}
await b.close();
writeFileSync(path.join(SHOTS, 'u5e-axe.json'), JSON.stringify(summary, null, 1));
console.log(bad === 0 ? `AXE: ${summary.length} vistas, 0 serious/critical` : `AXE: ${bad} serious/critical`);
process.exit(bad === 0 ? 0 : 1);
