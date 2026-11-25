// U5-S (R7-18): borrador por pestaña. Dos pestañas del mismo navegador editan a la vez; cada una guarda en su clave y una
// tercera ofrece el más reciente. Uso: OGS_URL=http://127.0.0.1:5187/ node u5s_draft_tabs.mjs (con los parches de EditorApp).
import { chromium } from 'playwright-core';

const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5187/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} });
let bad = 0;
const step = (n, ok, d = {}) => { if (!ok) bad += 1; console.log(ok ? 'OK  ' : 'FAIL', n, JSON.stringify(d)); };
const open = async () => { const p = await ctx.newPage(); await p.goto(URL_); await p.waitForSelector('[data-layer="regions"] polygon'); return p; };
const edit = async (p, title) => { await p.getByRole('tab', { name: 'Proyecto' }).click(); await p.locator('[data-path="/meta/title"]').fill(title); await p.locator('[data-path="/meta/title"]').blur(); await p.waitForTimeout(1600); };
const keys = (p) => p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ogs.editor')).sort());

const a = await open();
await edit(a, 'Pestaña A');
const b2 = await open();
// B arranca con el borrador de A a la vista: el autoguardado de B espera a que lo recupere (no pisa lo ofrecido).
await b2.getByRole('button', { name: /Recuperar/ }).click();
await edit(b2, 'Pestaña B');
const k = await keys(b2);
step('cada pestaña guarda en su propia clave (2 claves de borrador + índice, ninguna fija)', k.filter((x) => x.includes('.tab.')).length === 2 && k.includes('ogs.editor.draft.index.v1') && !k.includes('ogs.editor.draft.v1'), { claves: k });
const ids = await Promise.all([a, b2].map((p) => p.evaluate(() => sessionStorage.getItem('ogs.editor.tab.v1'))));
step('los ids de pestaña (sessionStorage) son distintos', ids[0] && ids[1] && ids[0] !== ids[1], { ids });
const c = await open();
const banner = await c.locator('[data-testid="draft-banner"]').innerText().catch(() => '');
step('una tercera pestaña ofrece el borrador más reciente (el de B)', /borrador guardado/.test(banner), { banner: banner.replace(/\s+/g, ' ').slice(0, 120) });
await c.getByRole('button', { name: /Recuperar/ }).click();
await c.getByRole('tab', { name: 'Proyecto' }).click();
const title = await c.locator('[data-path="/meta/title"]').inputValue();
step('«Recuperar borrador» carga el título de B', title === 'Pestaña B', { title });
// la pestaña A sigue con su propio borrador (no fue pisado por B)
const aDraft = await a.evaluate(() => { const id = sessionStorage.getItem('ogs.editor.tab.v1'); return JSON.parse(localStorage.getItem('ogs.editor.draft.v1.tab.' + id)).doc.meta.title; });
step('el borrador de A no fue pisado por el de B', aDraft === 'Pestaña A', { aDraft });
await b.close();
process.exit(bad ? 1 : 0);
