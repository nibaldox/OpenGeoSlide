// U6-D (R9-01, R9-02a/b, R9-08a/b, R9-11a/b): borradores y estado en Chrome real.
// Uso (desde un directorio con playwright-core): OGS_URL=http://127.0.0.1:5186/ node u6d_drafts.mjs [etiqueta]
// Contra la base (59fef87) estos pasos deben FALLAR; contra u6d-borradores, pasar.
// Varias pestañas = varias pages de UN mismo BrowserContext (comparten localStorage). Duplicar una pestaña se simula copiando
// sessionStorage a la page nueva antes de que cargue (como hace Chrome al duplicar).
import { chromium } from 'playwright-core';

const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const KEY = 'ogs.editor.draft.v1';
const TAB = 'ogs.editor.tab.v1';
let failed = 0;
const step = (name, ok, data = {}) => {
  if (!ok) failed += 1;
  console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data));
};
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const newCtx = async (viewport = { width: 1440, height: 900 }) => {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} });
  return ctx;
};
const open = async (ctx, session) => {
  const p = await ctx.newPage();
  if (session) await p.addInitScript((s) => { for (const [k, v] of Object.entries(s)) sessionStorage.setItem(k, v); }, session);
  await p.goto(URL_);
  await p.waitForSelector('[data-layer="regions"] polygon');
  return p;
};
const setTitle = async (p, title) => {
  await p.getByRole('tab', { name: 'Proyecto' }).click();
  await p.locator('[data-path="/meta/title"]').fill(title);
  await p.locator('[data-path="/meta/title"]').blur();
  await p.waitForTimeout(1500);
};
const tabId = (p) => p.evaluate((k) => sessionStorage.getItem(k), TAB);
const draftOf = (p, id) => p.evaluate(([k, i]) => { const v = localStorage.getItem(`${k}.tab.${i}`); return v ? JSON.parse(v).doc.meta.title : null; }, [KEY, id]);
const keys = (p) => p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ogs.editor')).sort());
const unloadWarns = (p) => p.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
const menu = async (p, name, item) => { await p.getByRole('button', { name, exact: true }).click(); await p.getByRole('button', { name: item, exact: true }).click(); };

// ───────── R9-01: guardar y descartar en B no borran el borrador de A ─────────
{
  const ctx = await newCtx();
  const a = await open(ctx);
  await setTitle(a, 'Borrador de A');
  const idA = await tabId(a);
  step('R9-01 precondición: A tiene su borrador', (await draftOf(a, idA)) === 'Borrador de A', { idA });
  const b = await open(ctx);
  await b.locator('[data-testid="draft-open-elsewhere"]').waitFor({ timeout: 4000 }).catch(() => {});
  const dl = b.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await menu(b, 'Archivo', 'Guardar');
  await dl;
  await b.waitForTimeout(500);
  step('R9-01 «Guardar» en B no borra el borrador de A', (await draftOf(b, idA)) === 'Borrador de A', { keys: await keys(b) });
  await ctx.close();
}
{
  const ctx = await newCtx();
  const a = await open(ctx);
  await setTitle(a, 'Borrador de A');
  const idA = await tabId(a);
  const b = await open(ctx);
  const aviso = await b.locator('[data-testid="draft-open-elsewhere"]').waitFor({ timeout: 4000 }).then(() => true, () => false);
  await b.getByRole('button', { name: 'Descartar', exact: true }).click();
  await b.waitForTimeout(400);
  const banner = await b.locator('[data-testid="draft-banner"]').count();
  step('R9-01 «Descartar» en B con A abierta oculta el banner y no borra el borrador de A', aviso && banner === 0 && (await draftOf(b, idA)) === 'Borrador de A', { aviso, banner, keys: await keys(b) });
  await ctx.close();
}

// ───────── R9-02a: editar con el banner a la vista y pulsar «Descartar» guarda lo editado ─────────
{
  const ctx = await newCtx();
  const a = await open(ctx);
  await setTitle(a, 'Borrador viejo');
  await a.close(); // la pestaña dueña se cierra: el borrador queda ofrecido sin «abierta en otra pestaña»
  const c = await open(ctx);
  await c.locator('[data-testid="draft-banner"]').waitFor();
  const idC = await tabId(c);
  await c.getByRole('tab', { name: 'Proyecto' }).click();
  await c.locator('[data-path="/meta/title"]').fill('Editado con el banner');
  await c.locator('[data-path="/meta/title"]').blur();
  await c.waitForTimeout(1300);
  const warnBefore = await unloadWarns(c);
  await c.getByRole('button', { name: 'Descartar', exact: true }).click();
  await c.waitForTimeout(500);
  const saved = await draftOf(c, idC);
  step('R9-02a tras «Descartar» con cambios, el borrador de esta pestaña tiene lo editado', saved === 'Editado con el banner', { saved, warnBefore });
  step('R9-02a antes de descartar, cerrar avisa (autoguardado en pausa)', warnBefore === true, { warnBefore });
  await ctx.close();
}

// ───────── R9-02b: pestaña duplicada ─────────
{
  const ctx = await newCtx();
  const a = await open(ctx);
  await setTitle(a, 'Original');
  const idA = await tabId(a);
  const dup = await open(ctx, { [TAB]: idA }); // hereda sessionStorage
  await dup.waitForTimeout(800);
  const idD = await tabId(dup);
  step('R9-02b la duplicada recibe un id de pestaña propio', !!idD && idD !== idA, { idA, idD });
  const aviso = await dup.locator('[data-testid="notices"]').innerText().catch(() => '');
  step('R9-02b el aviso dice la verdad (duplicado, borrador propio)', /duplicado de otra/.test(aviso) && /propio/.test(aviso), { aviso: aviso.slice(0, 160) });
  await dup.getByRole('button', { name: 'Recuperar', exact: true }).click();
  await setTitle(dup, 'Pisado por duplicada');
  step('R9-02b la duplicada no pisa el borrador de la original', (await draftOf(a, idA)) === 'Original' && (await draftOf(dup, idD)) === 'Pisado por duplicada', { keys: await keys(a) });
  await setTitle(a, 'Original 2');
  step('R9-02b la original sigue guardando en su clave', (await draftOf(a, idA)) === 'Original 2' && (await draftOf(a, idD)) === 'Pisado por duplicada', {});
  await ctx.close();
}

// ───────── R9-08b: borrador heredado corrupto ─────────
{
  const ctx = await newCtx();
  const probe = await ctx.newPage();
  await probe.goto(URL_);
  await probe.evaluate((k) => localStorage.setItem(k, '{CORRUPT_JSON'), KEY);
  await probe.close();
  const p = await open(ctx);
  await p.waitForTimeout(500);
  const text = await p.locator('body').innerText();
  const left = await p.evaluate((k) => localStorage.getItem(k), KEY);
  step('R9-08b el heredado corrupto se avisa y se limpia', /Se descartó el borrador local/.test(text) && left === null, { left, aviso: (text.match(/Se descartó el borrador local[^\n]*/) ?? [''])[0] });
  await ctx.close();
}

// ───────── R9-08a: cuota casi llena ─────────
{
  const ctx = await newCtx();
  const a = await open(ctx);
  await setTitle(a, 'semilla');
  const idA = await tabId(a);
  const info = await a.evaluate(({ k, id }) => {
    const mine = JSON.parse(localStorage.getItem(`${k}.tab.${id}`));
    const entries = [];
    for (let i = 0; i < 8; i += 1) {
      const d = JSON.parse(JSON.stringify(mine));
      d.doc.meta.title = 'viejo'.padEnd(450_000, 'x');
      d.savedAt = new Date(Date.now() - (10 + i) * 3600_000).toISOString();
      localStorage.setItem(`${k}.tab.old${i}`, JSON.stringify(d));
      entries.push({ tabId: `old${i}`, savedAt: d.savedAt, fileName: null });
    }
    localStorage.removeItem(`${k}.tab.${id}`);
    localStorage.setItem('ogs.editor.draft.index.v1', JSON.stringify(entries));
    // Relleno hasta dejar ~1,5 kB libres (el borrador nuevo no cabe sin liberar un viejo).
    let chunk = 100_000, n = 0;
    for (;;) {
      try { localStorage.setItem(`ogs.junk.${n}`, 'j'.repeat(chunk)); n += 1; } catch { if (chunk <= 500) break; chunk = Math.floor(chunk / 2); }
    }
    return { junk: n, bytes: Object.entries(localStorage).reduce((s, [kk, v]) => s + kk.length + v.length, 0) };
  }, { k: KEY, id: idA });
  await setTitle(a, 'cabe tras podar');
  const failureBanner = await a.locator('.banner-sim').count();
  const saved = await draftOf(a, idA);
  const idx = await a.evaluate(() => JSON.parse(localStorage.getItem('ogs.editor.draft.index.v1')).map((e) => e.tabId));
  step('R9-08a con la cuota llena, el borrador nuevo se guarda tras podar el más antiguo', saved === 'cabe tras podar' && failureBanner === 0 && !idx.includes('old7') && idx.includes(idA), { saved, failureBanner, idx, ...info });
  await ctx.close();
}

// ───────── R9-11a: un trazo a medias cuenta como cambio sin guardar ─────────
{
  const ctx = await newCtx();
  const p = await open(ctx);
  const status0 = await p.locator('[data-testid="file-status"]').innerText();
  await p.getByRole('button', { name: 'Dibujar región', exact: true }).click();
  const box = await p.locator('[data-testid="editor-canvas"] svg').first().boundingBox();
  await p.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
  await p.waitForTimeout(300);
  const status = await p.locator('[data-testid="file-status"]').innerText();
  const warns = await unloadWarns(p);
  step('R9-11a con 2 puntos la barra dice «con cambios sin guardar» y beforeunload avisa', /con cambios sin guardar/.test(status) && warns, { status0: status0.replace(/\s+/g, ' '), status: status.replace(/\s+/g, ' '), warns });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  const after = await p.locator('[data-testid="file-status"]').innerText();
  step('R9-11a sin trazo y sin cambios, vuelve a «sin cambios pendientes»', /sin cambios pendientes/.test(after) && !(await unloadWarns(p)), { after: after.replace(/\s+/g, ' ') });
  await ctx.close();
}

// ───────── R9-11b: «Editar» muestra la herramienta activa a 480 px o menos ─────────
for (const w of [480, 390, 320]) {
  const ctx = await newCtx({ width: w, height: 844 });
  const p = await open(ctx);
  const before = (await p.locator('button.dd-trigger', { hasText: 'Editar' }).innerText()).trim();
  await menu(p, 'Editar', 'Dibujar región');
  await p.waitForTimeout(300);
  const trig = p.locator('button.dd-trigger', { hasText: 'Editar' });
  const text = (await trig.innerText()).trim();
  const name = await trig.evaluate((el) => el.textContent.replace(/\s+/g, ' ').trim());
  const fits = await trig.evaluate((el) => { const r = el.getBoundingClientRect(); return r.right <= innerWidth && r.left >= 0 && document.documentElement.scrollWidth <= innerWidth; });
  step(`R9-11b ${w} px: «Editar» pasa de «${before}» a «${text}» y cabe`, /Editar · Dibujar región/.test(name) && /^Editar/.test(before) && fits, { before, text, fits });
  await p.getByRole('button', { name: /^Editar · Dibujar región/ }).click();
  await p.getByRole('button', { name: 'Seleccionar', exact: true }).click();
  await p.waitForTimeout(300);
  const back = (await p.locator('button.dd-trigger', { hasText: 'Editar' }).innerText()).trim();
  step(`R9-11b ${w} px: con «Seleccionar» vuelve a «Editar»`, /^Editar\s*▾?$/.test(back), { back });
  await ctx.close();
}

await browser.close();
console.log(failed ? `${failed} paso(s) fallaron` : 'todos los pasos pasaron');
process.exit(failed ? 1 : 0);
