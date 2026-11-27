// U6-G: seguridad geotécnica y salida (R9-03, R9-05, R9-07, R9-09, R9-12). Reproduce lo que vio el revisor R9 y comprueba el arreglo.
// Uso (desde un directorio con playwright-core):
//   OGS_URL=http://127.0.0.1:5187/ OGS_FX=<carpeta de make_fixtures.py> node u6g_geotecnia.mjs
// El mismo script corre contra la base (59fef87) para el «antes» y contra u6g para el «después»: los pasos FALLAN en la base.
// Las descargas quedan en $TMPDIR/u6g-out/<etiqueta>/ (OGS_LABEL, por defecto «after»).
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const LABEL = process.env.OGS_LABEL ?? 'after';
const OUT = path.join(process.env.TMPDIR, 'u6g-out', LABEL);
mkdirSync(OUT, { recursive: true });
const AXE = process.env.TMPDIR + '/x8-ux/node_modules/axe-core/axe.min.js';
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5187/';
const FX = process.env.OGS_FX ?? path.join(process.env.TMPDIR, 'u6g-fx');
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const res = [];
const step = (name, ok, data = {}) => { res.push({ name, ok }); console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data)); };
const newCtx = async (theme = 'light') => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, acceptDownloads: true });
  await ctx.addInitScript(({ t }) => { try { localStorage.setItem('ogs.theme.v1', t); localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} }, { t: theme });
  return ctx;
};
const ready = async (p) => { await p.goto(URL_); await p.waitForSelector('[data-layer="regions"] polygon, [data-testid="editor-canvas"]'); await p.waitForFunction(() => /ogs-core/.test(document.body.innerText), null, { timeout: 60000 }); };
const noBom = (t) => t.replace(/^\uFEFF/, '');
const axeRun = async (p) => { await p.addScriptTag({ path: AXE }).catch(() => {}); return p.evaluate(async () => { const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }); return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id); }); };

// ───── 1. Casos: «Comprobar caso» y γw imperial (R9-03a, R9-03b)
const casesTab = (p) => p.getByRole('tab', { name: /Casos de verificación/ });
async function runCase(p, file) {
  await p.locator('.cases-view input[type=file]').setInputFiles(path.join(FX, file));
  await p.getByRole('button', { name: 'Comprobar caso' }).click();
  await p.waitForFunction(() => document.querySelector('.cases-view .banner-error') || document.querySelector('.cases-view .results table'), null, { timeout: 60000 });
  return p.evaluate(() => ({
    banner: document.querySelector('.cases-view .banner-error')?.textContent?.trim().slice(0, 200) ?? null,
    bishopFs: document.querySelector('.cases-view .results tbody tr td:nth-child(2)')?.textContent?.trim() ?? null,
    caption: document.querySelector('[data-testid="result-caption"]')?.textContent?.trim() ?? null,
  }));
}
{
  const ctx = await newCtx(); const p = await ctx.newPage(); await ready(p);
  await casesTab(p).click();
  // R13 (E15m-9): un modelo imperial SIN γw ya no se bloquea (el motor toma 62,4 pcf y la web lo dice con una nota); solo se bloquea el γw explícito < 20 pcf.
  const blocked = { imp_gw98: 'γw = 9,8', imp_gw980665: 'γw = 9,80665', imp_gw981: 'γw = 9,81', imp_Imperial_gw981: 'units «Imperial»' };
  for (const [f, why] of Object.entries(blocked)) {
    const r = await runCase(p, `${f}.ogs.json`);
    step(`1 Casos imperial ${why}: bloquea (sin FS)`, r.banner !== null && r.bishopFs === null && /γw/.test(r.banner), r);
  }
  for (const [f, why] of Object.entries({ imp_nogw: 'sin γw (E15m-9: nota, no bloqueo)', imp_gw624: 'γw = 62,4', imp_gw640: 'γw = 64,0', imp_dry: 'seco (sin piezométrica)' })) {
    const r = await runCase(p, `${f}.ogs.json`);
    step(`1 Casos imperial ${why}: calcula`, r.banner === null && /^\d/.test(r.bishopFs ?? ''), r);
  }
  await ctx.close();
}

// ───── 2. Los casos de verificación publicados siguen pasando (todas las comprobaciones «Cumple»)
{
  const ctx = await newCtx(); const p = await ctx.newPage(); await ready(p);
  await casesTab(p).click();
  const n = await p.locator('.cases-view select option').count();
  const bad = [];
  for (let i = 0; i < n; i++) {
    await p.locator('.cases-view select').first().selectOption({ index: i });
    await p.getByRole('button', { name: 'Comprobar caso' }).click();
    await p.waitForFunction(() => document.querySelector('.cases-view .banner-error') || document.querySelector('.cases-view table.checks'), null, { timeout: 120000 });
    const r = await p.evaluate(() => ({ err: document.querySelector('.cases-view .banner-error')?.textContent ?? null, ok: document.querySelectorAll('.cases-view table.checks .badge-ok').length, fail: document.querySelectorAll('.cases-view table.checks .badge-fail').length }));
    if (r.err || r.fail > 0 || r.ok === 0) bad.push({ i, ...r });
  }
  step(`2 los ${n} casos de verificación: todas las comprobaciones «Cumple»`, n >= 21 && bad.length === 0, { n, bad });
  await ctx.close();
}

// ───── 3. Editor imperial: γw al crear la piezométrica (R9-09a) y cargas por defecto (R9-09b)
{
  const ctx = await newCtx(); const p = await ctx.newPage(); await ready(p);
  await p.setInputFiles('[data-testid="file-open"]', path.join(FX, 'imp_dry.ogs.json'));
  await p.waitForTimeout(600);
  await p.getByRole('tab', { name: 'Agua' }).click();
  await p.getByRole('button', { name: 'Crear piezométrica' }).click();
  await p.waitForTimeout(300);
  const gw = await p.locator('[data-path="/water/unit_weight"]').inputValue();
  await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await p.waitForTimeout(2500);
  const afterCreate = await p.evaluate(() => ({ fs: !!document.querySelector('[data-testid="fs-bishop"]'), gwBlock: /γw/.test(document.querySelector('[data-testid="diagnostics"], aside, body')?.innerText ?? '') }));
  const fsShown = await p.locator('[data-testid="fs-bishop"]').count();
  step('3a Crear piezométrica en imperial: γw = 62,4 escrito y «Comprobar» calcula', /^62[,.]4$/.test(gw) && fsShown > 0, { gw, fsShown, afterCreate });
  await p.getByRole('button', { name: /^Deshacer/ }).click();
  await p.waitForTimeout(300);
  const undone = await p.evaluate(() => ({ crear: [...document.querySelectorAll('button')].some((x) => x.textContent?.trim() === 'Crear piezométrica'), gw: document.querySelector('[data-path="/water/unit_weight"]')?.value ?? null }));
  step('3b Un solo Deshacer quita piezométrica y γw (mismo gesto)', undone.crear && undone.gw === '', undone);
  await p.getByRole('tab', { name: 'Cargas' }).click();
  await p.getByRole('button', { name: 'Agregar carga distribuida' }).click();
  await p.getByRole('button', { name: 'Agregar carga lineal' }).click();
  await p.waitForTimeout(300);
  const loads = await p.evaluate(() => [...document.querySelectorAll('input[data-path^="/loads/"]')].map((i) => [i.getAttribute('data-path'), i.value]));
  const q = loads.find(([k]) => /\/q$/.test(k))?.[1]; const pp = loads.find(([k]) => /\/p$/.test(k))?.[1];
  step('3c Cargas por defecto en imperial: 200 psf y 700 lbf/ft', q === '200' && pp === '700', { q, p: pp });
  await ctx.close();
}

// ───── 4. Modelo completo imperial: Diagnósticos, PDF y CSV (R9-03c, R9-05, R9-07, R9-12a/c)
for (const theme of ['light', 'dark']) {
  const ctx = await newCtx(theme); const p = await ctx.newPage(); await ready(p);
  await p.setInputFiles('[data-testid="file-open"]', path.join(FX, 'imp_full.ogs.json'));
  await p.waitForTimeout(600);
  await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await p.waitForSelector('[data-testid="fs-bishop"]', { timeout: 60000 });
  const body = await p.evaluate(() => document.body.innerText);
  const adv = {
    // F3G (I-G): γsat ya no lleva el aviso «todavía no está verificado frente a otro programa» (lo verifican V082a, V082b, V088 y V089, E15k;
    // geotech.ts): ahora se exige que el aviso NO aparezca.
    gammaSatSinAvisoDeSinVerificar: !/todavía no está verificado frente a otro programa/.test(body),
    ru: /ru tiene precedencia/.test(body),
    piezo: /extiende en horizontal hasta los bordes/.test(body),
    satLtGamma: /γsat \([\d,]+\) es menor que γ/.test(body),
  };
  step(`4a Diagnósticos (${theme}): sin aviso de γsat sin verificar, ru + piezométrica, piezométrica corta y γsat < γ`, Object.values(adv).every(Boolean), adv);
  const heads = await p.evaluate(() => [...document.querySelectorAll('[data-results-table] thead th')].map((x) => x.textContent.trim()));
  step(`4b Tabla de resultados (${theme}): centro y radio con unidad`, heads.includes('Centro (xc; yc) (ft)') && heads.includes('Radio (ft)'), { heads });
  const ax = await axeRun(p);
  step(`4c axe ${theme} (editor con resultados y avisos): 0 serious/critical`, ax.length === 0, { ax });
  if (theme === 'light') {
    const dl = async (menu, item) => { const [d] = await Promise.all([p.waitForEvent('download'), (async () => { await p.getByRole('button', { name: new RegExp('^' + menu) }).click(); await p.getByRole('button', { name: item }).click(); })()]); const f = path.join(OUT, d.suggestedFilename()); await d.saveAs(f); return f; };
    const r = await dl('Exportar', /Exportar resultados/);
    const s = await dl('Exportar', /Exportar superficie/);
    const [d] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /^Informe PDF/ }).click()]);
    const pdf = path.join(OUT, 'informe-imp-full.pdf'); await d.saveAs(pdf);
    writeFileSync(path.join(OUT, 'paths.json'), JSON.stringify({ results: r, surface: s, pdf }));
    step('4d CSV y PDF exportados', true, { r: path.basename(r), s: path.basename(s), pdf: path.basename(pdf) });
    // PDF seco imperial (R9-03c)
    await p.setInputFiles('[data-testid="file-open"]', path.join(FX, 'imp_dry.ogs.json'));
    await p.waitForTimeout(600);
    await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
    await p.waitForSelector('[data-testid="fs-bishop"]', { timeout: 60000 });
    const [d2] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /^Informe PDF/ }).click()]);
    const dry = path.join(OUT, 'informe-imp-dry.pdf'); await d2.saveAs(dry);
    step('4e PDF imperial seco exportado', true, { dry: path.basename(dry) });
  }
  await ctx.close();
}

// ───── 5. Casos: superficie que no convergió (R9-12b) y axe en Casos
for (const theme of ['light', 'dark']) {
  const ctx = await newCtx(theme); const p = await ctx.newPage(); await ready(p);
  await casesTab(p).click();
  const r = await runCase(p, 'nc.ogs.json');
  const leg = await p.evaluate(() => ({ swatch: !!document.querySelector('.cases-view .legend .swatch.line-unconverged'), cls: document.querySelector('[data-testid="result-caption"]')?.className ?? '' }));
  step(`5a Casos (${theme}): no convergió → rótulo del editor, leyenda y clase «sin convergencia»`, /sin convergencia/.test(r.caption ?? '') && /no es un resultado válido/.test(r.caption ?? '') && leg.swatch && /unconverged/.test(leg.cls), { ...r, ...leg });
  const heads = await p.evaluate(() => [...document.querySelectorAll('.cases-view .results thead th')].map((x) => x.textContent.trim()));
  step(`5b Casos (${theme}): centro y radio con unidad en la tabla`, heads.includes('Centro (xc; yc) (m)') && heads.includes('Radio (m)'), { heads });
  const canvas = p.locator('.cases-view canvas.section-canvas');
  await canvas.screenshot({ path: path.join(OUT, `casos-no-convergio-${theme}.png`) });
  const ax = await axeRun(p);
  step(`5c axe ${theme} (Casos con resultados): 0 serious/critical`, ax.length === 0, { ax });
  await ctx.close();
}

// ───── 6. Casos dibuja y rotula el tramo extrapolado de la piezométrica (U6-I, R9-05d): imp_full tiene la línea más corta que el modelo
{
  const ctx = await newCtx(); const p = await ctx.newPage(); await ready(p);
  await casesTab(p).click();
  const r = await runCase(p, 'imp_full.ogs.json');
  const leg = await p.evaluate(() => [...document.querySelectorAll('.cases-view .legend li, .cases-view .legend > *')].map((x) => x.textContent?.trim()).filter(Boolean));
  step('6a Casos: la leyenda rotula «Piezométrica (extrapolada)»', leg.some((t) => /Piezométrica \(extrapolada\)/.test(t)), { banner: r.banner, leg });
  const canvas = p.locator('.cases-view canvas.section-canvas');
  await canvas.screenshot({ path: path.join(OUT, 'casos-piezo-extrapolada.png') });
  // Píxeles azules en la franja izquierda del lienzo (a la izquierda del primer punto de la línea, solo está el tramo extrapolado).
  const blue = await canvas.evaluate((c) => { const w = c.width; const d = c.getContext('2d').getImageData(Math.round(w * 0.1), 0, Math.round(w * 0.12), c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 150 && d[i] < 90 && d[i + 1] < 130) n++; return n; });
  step('6b Casos: el tramo extrapolado deja píxeles azules a la izquierda del primer punto', blue > 20, { blue });
  await ctx.close();
}
await b.close();
const failed = res.filter((r) => !r.ok);
console.log(`\n${res.length - failed.length}/${res.length} pasos OK`);
process.exit(failed.length ? 1 : 0);
