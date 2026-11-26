// U6-K: axe (wcag2a/aa/21aa/22aa + best-practice) en claro y oscuro, a 1440 y 320 px, sobre lo nuevo: lienzo con la piezométrica extrapolada y su
// leyenda (con el tirador activo que lleva aria-describedby), diálogo de Ayuda y diálogo de importar CSV (Modal). Capturas en $TMPDIR/u6k-shots.
// Uso (desde un directorio con playwright-core): OGS_URL=http://127.0.0.1:5188/ node u6k_axe.mjs   (axe-core desde $TMPDIR/x8-ux/node_modules)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TMP = process.env.TMPDIR;
const AXE = TMP + '/x8-ux/node_modules/axe-core/axe.min.js';
const SHOTS = path.join(TMP, 'u6k-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5188/';
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
const mat = { id: 'suelo', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 19, cohesion: 30, friction_angle: 28 };
const doc = {
  format: 'opengeoslide', version: '0.2', meta: { title: 'U6-K' }, units: 'SI', materials: [mat],
  regions: [{ material: 'suelo', polygon: [[0, 10], [10, 10], [30, 0], [60, 0], [60, -10], [0, -10]] }],
  water: { unit_weight: 9.81, piezometric_line: [[10, 6], [30, 0], [50, -1]] }, loads: [], slope: { direction: 'left_to_right' },
  analysis: { methods: ['bishop'], surface: { type: 'circle', xc: 30, yc: 30, r: 28 } },
};
const f = path.join(TMP, 'u6k-axe-short.ogs.json');
writeFileSync(f, JSON.stringify(doc));
const csv = path.join(TMP, 'u6k-axe.csv');
writeFileSync(csv, 'capa,x,y\nA,0,0\nA,10,0\nA,10,5\nA,0,5\n');

for (const theme of ['light', 'dark']) {
  for (const [w, h] of [[1440, 900], [320, 844]]) {
    const tag = `${theme}-${w}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme });
    await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.theme.v1', t); localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} }, theme);
    const p = await ctx.newPage();
    await p.goto(URL_);
    await p.waitForFunction(() => /ogs-core/.test(document.querySelector('[data-testid="engine-banner"]')?.textContent ?? ''), null, { timeout: 30000 });
    await p.setInputFiles('[data-testid="file-open"]', f);
    await p.waitForSelector('[data-layer="piezometric-extrapolated"] polyline', { state: 'attached' });
    await p.waitForTimeout(300);
    await p.locator('svg.ec-svg').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(SHOTS, `axe-${tag}-piezo.png`) });
    await axe(p, `${tag} lienzo con piezométrica extrapolada y leyenda`);
    await p.getByRole('button', { name: 'Ayuda', exact: true }).click();
    await p.waitForSelector('dialog[data-testid="help-dialog"][open]');
    await axe(p, `${tag} diálogo de Ayuda`);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    await p.setInputFiles('[data-testid="file-csv"]', csv);
    await p.waitForSelector('dialog.ea-dialog[open]');
    await p.screenshot({ path: path.join(SHOTS, `axe-${tag}-importar.png`) });
    await axe(p, `${tag} diálogo Importar CSV (Modal)`);
    await ctx.close();
  }
}
await b.close();
console.log(`AXE: ${views} vistas, ${bad} serious/critical`);
process.exit(bad === 0 ? 0 : 1);
