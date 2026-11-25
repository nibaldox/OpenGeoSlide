// U5-S: foco de respaldo, Esc de la guía, navegación desde incidencias, CSV con unidades, PDF (fuentes en caché y cabeceras),
// leyenda y axe. Uso: OGS_URL=http://127.0.0.1:5187/ node u5s_salida.mjs (desde un directorio con playwright-core).
// Requiere los parches de docs/fase2/ux/u5s-e2e/*.patch aplicados a EditorApp.tsx (los pasos 3 y 4 dependen de ellos).
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.env.TMPDIR, 'u5s-shots');
mkdirSync(OUT, { recursive: true });
const AXE = process.env.TMPDIR + '/x8-ux/node_modules/axe-core/axe.min.js';
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5187/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const res = [];
const step = (name, ok, data = {}) => { res.push({ name, ok }); console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data)); };
const active = (p) => p.evaluate(() => { const a = document.activeElement; return a ? { tag: a.tagName, text: (a.textContent || '').trim().slice(0, 40), id: a.id } : null; });
const ready = async (p) => { await p.goto(URL_); await p.waitForSelector('[data-layer="regions"] polygon'); await p.waitForFunction(() => /ogs-core/.test(document.body.innerText), null, { timeout: 60000 }); };
const newCtx = async (theme = 'light', opts = {}) => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, acceptDownloads: true, ...opts });
  await ctx.addInitScript(({ t, seen }) => { try { localStorage.setItem('ogs.theme.v1', t); if (seen) localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} }, { t: theme, seen: !opts.unseen });
  return ctx;
};
const noBom = (t) => t.replace(/^\uFEFF/, ''); // downloadText antepone BOM (Excel)
const archivo = (p) => p.getByRole('button', { name: /^Archivo/ });

// ───── 1. Foco tras diálogos y menús (A-05, B-02)
{
  const ctx = await newCtx(); const p = await ctx.newPage(); await ready(p);
  await p.getByRole('tab', { name: 'Proyecto' }).click();
  await p.locator('[data-path="/meta/title"]').fill('Cambio de prueba'); await p.locator('[data-path="/meta/title"]').blur();
  await archivo(p).click();
  await p.getByRole('button', { name: /^Nuevo$/ }).first().click();
  await p.waitForSelector('[data-testid="confirm-dialog"]');
  const fdlg = await active(p);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  const afterEsc = await active(p);
  step('1a Archivo ▸ Nuevo con cambios, Esc: el foco queda en «Archivo»', afterEsc?.text.startsWith('Archivo'), { enDialogo: fdlg, trasEsc: afterEsc });
  await archivo(p).click();
  await p.getByRole('button', { name: /^Nuevo$/ }).first().click();
  await p.waitForSelector('[data-testid="confirm-dialog"]');
  await p.getByRole('button', { name: 'Descartar cambios' }).click().catch(async () => { await p.locator('[data-testid="confirm-dialog"] .ogs-danger').click(); });
  await p.waitForTimeout(400);
  const afterOk = await active(p);
  step('1b …y tras confirmar el foco no cae en <body>', afterOk && afterOk.tag !== 'BODY', { trasConfirmar: afterOk });
  // 1c. eliminar la última tarjeta de región: dibujar no hace falta; se abre un ejemplo con una región y se eliminan todas
  await archivo(p).click();
  await p.locator('select[aria-label="Abrir un caso publicado como modelo"]').selectOption({ index: 1 });
  await p.waitForSelector('[data-layer="regions"] polygon');
  await p.getByRole('tab', { name: 'Geometría' }).click();
  let guard = 0;
  while ((await p.getByRole('button', { name: /^Eliminar región/ }).count()) > 0 && guard++ < 10) {
    await p.getByRole('button', { name: /^Eliminar región/ }).first().click();
    await p.waitForSelector('[data-testid="confirm-dialog"]');
    await p.locator('[data-testid="confirm-dialog"] .ogs-danger').click();
    await p.waitForTimeout(300);
  }
  const lastCard = await active(p);
  step('1c eliminar la última tarjeta de región: el foco no cae en <body>', lastCard && lastCard.tag !== 'BODY', { regionesEliminadas: guard, foco: lastCard });
  // 3. incidencia /regions
  await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await p.waitForSelector('.ep-issue', { timeout: 20000 });
  await p.getByRole('tab', { name: 'Materiales' }).click();
  const issueBtn = p.locator('button.ep-issue', { hasText: /regiones/ });
  const n = await issueBtn.count();
  if (n > 0) {
    await issueBtn.first().click(); await p.waitForTimeout(300);
    const foco = await active(p);
    const tab = await p.getByRole('tab', { name: 'Geometría' }).getAttribute('aria-selected');
    step('3a «/regions» (modelo vacío): botón, abre Geometría y enfoca «Dibujar región»', tab === 'true' && /^Dibujar región/.test(foco?.text ?? ''), { foco, geometriaSeleccionada: tab });
  } else step('3a «/regions» (modelo vacío): botón', false, { botones: n });
  await ctx.close();
}

// ───── 2. Esc cierra la guía desde cualquier lugar (A-06)
{
  const ctx = await newCtx('light', { unseen: true }); const p = await ctx.newPage(); await ready(p);
  await p.waitForSelector('[data-testid="guided-tour"]', { state: 'visible' });
  await p.locator('[data-testid="editor-canvas"] [role="application"], [data-testid="editor-canvas"] svg').first().focus().catch(() => {});
  const f = await active(p);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const open = await p.locator('[data-testid="guided-tour"]').isVisible();
  step('2 Esc con el foco fuera de la guía la cierra', !open, { foco: f, guiaAbierta: open });
  await ctx.close();
}

// ───── 4. CSV con unidades, 5. PDF y fuentes, 6. leyenda
for (const theme of ['light', 'dark']) {
  const ctx = await newCtx(theme); const p = await ctx.newPage();
  const fontReq = []; p.on('request', (r) => { if (/\/fonts\/DejaVu/.test(r.url())) fontReq.push(r.url().split('/').pop()); });
  await ready(p);
  await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await p.waitForSelector('[data-testid="fs-bishop"]', { timeout: 60000 });
  const download = async (menu, item) => { const [d] = await Promise.all([p.waitForEvent('download'), (async () => { await p.getByRole('button', { name: new RegExp('^' + menu) }).click(); await p.getByRole('button', { name: item }).click(); })()]); const f = path.join(OUT, `${theme}-${d.suggestedFilename()}`); await d.saveAs(f); return f; };
  if (theme === 'light') {
    const r = noBom(readFileSync(await download('Exportar', /Exportar resultados/), 'utf8')).split(/\r?\n/);
    const s = noBom(readFileSync(await download('Exportar', /Exportar superficie/), 'utf8')).split(/\r?\n/);
    step('4a CSV de resultados SI: comentario y cabecera con unidad', r[0] === '# unidades: SI (m, kN/m³, kPa)' && /xc_m,yc_m,r_m/.test(r[1]), { l0: r[0], l1: r[1] });
    step('4b CSV de superficie SI', s[0] === '# unidades: SI (m, kN/m³, kPa)' && s[1] === 'metodo,estado,punto,x_m,y_m', { l0: s[0], l1: s[1] });
    // imperial
    await p.getByRole('tab', { name: 'Proyecto' }).click();
    await p.locator('[data-path="/units"]').selectOption('imperial');
    await p.waitForSelector('[data-testid="confirm-dialog"]');
    await p.locator('[data-testid="confirm-dialog"] button').last().click(); await p.waitForTimeout(300);
    await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
    await p.waitForFunction(() => document.querySelector('[data-testid="fs-bishop"]'), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const ri = noBom(readFileSync(await download('Exportar', /Exportar resultados/), 'utf8')).split(/\r?\n/);
    step('4c CSV imperial: «# unidades: imperial» y _ft', ri[0] === '# unidades: imperial (ft, pcf, psf)' && /xc_ft,yc_ft,r_ft/.test(ri[1]), { l0: ri[0], l1: ri[1] });
  }
  if (theme === 'light') {
    // PDF
    const times = [];
    for (let i = 0; i < 2; i++) {
      const t0 = Date.now();
      const [d] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /^Informe PDF/ }).click()]);
      const f = path.join(OUT, `informe-${i + 1}.pdf`); await d.saveAs(f); times.push(Date.now() - t0);
    }
    step('5 caché de fuentes: la 2.ª exportación no vuelve a pedir las fuentes y tarda menos', fontReq.length === 2 && times[1] < times[0], { peticionesDeFuentes: fontReq, msPrimera: times[0], msSegunda: times[1] });
  }
  // leyenda: muestra de dovelas
  const sw = await p.evaluate(() => { const el = document.querySelector('.legend .swatch.slice'); if (!el) return null; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return { img: cs.backgroundImage.slice(0, 160), w: r.width, h: r.height, border: cs.borderTopWidth }; });
  step(`6 leyenda (${theme}): muestra de dovelas con --canvas-slice-edge`, !!sw && /repeating-linear-gradient/.test(sw.img) && sw.w >= 20, sw ?? {});
  const leg = p.locator('.ea-canvas-panel .legend, .legend').first();
  await leg.scrollIntoViewIfNeeded();
  await p.screenshot({ path: path.join(OUT, `leyenda-${theme}.png`), clip: await leg.boundingBox().then((bb) => ({ x: Math.max(0, bb.x - 8), y: Math.max(0, bb.y - 8), width: Math.min(bb.width + 16, 1400), height: bb.height + 16 })) });
  // 7. axe
  await p.addScriptTag({ path: AXE });
  const ax = await p.evaluate(async () => { const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }); return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id); });
  step(`7 axe ${theme} (editor con resultados): 0 serious/critical`, ax.length === 0, { ax });
  await p.getByRole('tab', { name: /Casos de verificación/ }).click();
  const verb = await p.getByRole('button', { name: 'Comprobar caso' }).count();
  const old = await p.getByRole('button', { name: 'Calcular', exact: true }).count();
  step(`8 Casos (${theme}): botón «Comprobar caso», sin «Calcular»`, verb === 1 && old === 0, { verb, old });
  await p.addScriptTag({ path: AXE }).catch(() => {});
  const ax2 = await p.evaluate(async () => { const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }); return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id); });
  step(`7b axe ${theme} (Casos): 0 serious/critical`, ax2.length === 0, { ax2 });
  await ctx.close();
}
await b.close();
const bad = res.filter((r) => !r.ok);
writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify(res, null, 1));
console.log(`\n${res.length - bad.length}/${res.length} pasos OK`);
process.exit(bad.length ? 1 : 0);
