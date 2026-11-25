// U4-P (UX9-08): lista los controles interactivos de menos de 24 px (WCAG 2.5.8) en cada vista y ancho.
// Uso: OGS_URL=http://127.0.0.1:5187/ node u4p_targets.mjs   (playwright-core desde $TMPDIR/f1c-e2e/node_modules)
import { chromium } from 'playwright-core';
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5187/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const SEL = 'button, a[href], input, select, textarea, summary, [role=tab], [role=button], [tabindex]:not([tabindex="-1"])';
let total = 0;
async function scan(p, label) {
  const small = await p.evaluate((SEL) => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden],[inert]'); };
    const path = (e) => { const n = []; for (let x = e; x && n.length < 3; x = x.parentElement) n.push(x.tagName.toLowerCase() + (x.id ? '#' + x.id : '') + (x.className && typeof x.className === 'string' ? '.' + x.className.split(' ')[0] : '')); return n.join(' < '); };
    return [...document.querySelectorAll(SEL)].filter(vis).map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.width < 23.5 || r.height < 23.5).map(({ e, r }) => ({
      tag: e.tagName, type: e.type ?? null, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, name: (e.getAttribute('aria-label') ?? e.labels?.[0]?.textContent ?? e.textContent ?? '').trim().slice(0, 50), where: path(e),
    }));
  }, SEL);
  total += small.length;
  console.log(`${small.length === 0 ? 'OK  ' : 'FAIL'} ${label}: ${small.length} < 24 px`);
  for (const s of small) console.log('   ', JSON.stringify(s));
}
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844], [320, 568]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} });
  const p = await ctx.newPage();
  await p.goto(URL_);
  await p.waitForSelector('[data-testid="editor-app"]');
  await p.waitForSelector('[data-layer="regions"] polygon');
  await scan(p, `${w}: editor inicial`);
  for (const tab of ['Geometría', 'Materiales', 'Cargas', 'Agua', 'Superficie', 'Búsqueda', 'Sismo', 'Análisis', 'Proyecto']) {
    const t = p.getByRole('tab', { name: tab });
    if (await t.count()) { await t.first().click(); await scan(p, `${w}: pestaña ${tab}`); }
  }
  await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await p.waitForSelector('[data-testid="fs-bishop"]', { timeout: 60000 });
  await scan(p, `${w}: con resultados`);
  for (const menu of ['Archivo', 'Exportar']) {
    const t = p.getByRole('button', { name: menu, exact: true });
    if (await t.count()) { await t.click(); await scan(p, `${w}: menú ${menu}`); await p.keyboard.press('Escape'); }
  }
  await p.getByRole('button', { name: 'Ayuda', exact: true }).click();
  await scan(p, `${w}: ayuda`);
  await p.keyboard.press('Escape');
  await p.getByRole('tab', { name: /Casos de verificación/ }).click();
  await scan(p, `${w}: casos de verificación`);
  await ctx.close();
}
await b.close();
console.log('TOTAL', total);
process.exit(total === 0 ? 0 : 1);
