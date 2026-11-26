// U6-I: la flecha de kv del lienzo del editor (R9-12c). Con kv = 0,05 hay una flecha vertical hacia abajo; sin kv no hay.
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_FX=<carpeta de make_fixtures.py> node u6g_kv_arrow.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const FX = process.env.OGS_FX ?? path.join(process.env.TMPDIR, 'u6g-fx');
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { localStorage.setItem('ogs.onboarding.v1', 'seen'); });
const p = await ctx.newPage();
await p.goto(URL_); await p.waitForSelector('[data-testid="editor-canvas"]');
let bad = 0;
const step = (n, ok, d) => { if (!ok) bad++; console.log(ok ? 'OK  ' : 'FAIL', n, JSON.stringify(d)); };
await p.setInputFiles('[data-testid="file-open"]', path.join(FX, 'si_full.ogs.json'));
await p.waitForTimeout(600);
const withKv = await p.evaluate(() => { const g = document.querySelector('[data-layer="seismic"]'); return { layer: !!g, lines: g ? g.querySelectorAll('line').length : 0, kv: !!document.querySelector('[data-testid="seismic-kv-arrow"]') }; });
step('kv = 0,05: la capa sísmica dibuja la flecha de kh y la vertical de kv', withKv.layer && withKv.lines >= 2 && withKv.kv, withKv);
await p.setInputFiles('[data-testid="file-open"]', path.join(FX, 'imp_dry.ogs.json'));
await p.waitForTimeout(600);
const dry = await p.evaluate(() => ({ layer: !!document.querySelector('[data-layer="seismic"]'), kv: !!document.querySelector('[data-testid="seismic-kv-arrow"]') }));
step('modelo con kv = 0 o sin sismo: no hay flecha de kv', dry.kv === false, dry);
await p.setInputFiles('[data-testid="file-open"]', path.join(FX, 'si_full.ogs.json'));
await p.waitForTimeout(600);
await p.locator('[data-testid="editor-canvas"]').screenshot({ path: path.join(process.env.TMPDIR, 'u6g-out', 'kv-arrow.png') });
await b.close(); process.exit(bad ? 1 : 0);
