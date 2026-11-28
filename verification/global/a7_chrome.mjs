// A7 en Chrome: corre analyze_json del WASM web (wasm-bindgen --target web) en una página real y mide el tiempo.
// Uso: OGS_PLAYWRIGHT=<ruta a playwright-core> node a7_chrome.mjs <puerto>, con un servidor estático sobre un directorio
// que tenga este archivo, wasm/ (ogs_wasm.js y ogs_wasm_bg.wasm de apps/web/src/wasm) y models/ (las entradas wasm_*.json de run.py).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.OGS_PLAYWRIGHT ?? 'playwright-core');
const port = process.argv[2] ?? '5189';
const dir = new URL('.', import.meta.url).pathname;
const models = readdirSync(`${dir}/models`).filter((f) => f.endsWith('.json')).sort();
writeFileSync(`${dir}/index.html`, `<!doctype html><meta charset="utf-8"><script type="module">
import init, { analyze_json, version } from './wasm/ogs_wasm.js';
window.run = async (names) => {
  await init();
  const out = [];
  for (const n of names) {
    const input = await (await fetch('./models/' + n)).text();
    const seconds = [];
    let text = '';
    for (let i = 0; i < 3; i++) { const t = performance.now(); text = analyze_json(input); seconds.push((performance.now() - t) / 1000); }
    const r = JSON.parse(text).results[0];
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    out.push({ input: n.replace(/\\.json$/, ''), fos: r.fos, seconds, sha256: [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join(''), stats: r.search?.non_circular?.global ?? null });
  }
  return { version: version(), out };
};
window.ready = true;
</script>`);
const browser = await chromium.launch({ executablePath: process.env.OGS_CHROME ?? '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => window.ready === true);
const res = await page.evaluate((names) => window.run(names), models);
const ua = await page.evaluate(() => navigator.userAgent);
await browser.close();
writeFileSync(`${dir}/chrome.json`, JSON.stringify({ ua, ...res }, null, 1));
console.log(ua);
console.log('ogs-wasm', res.version);
const med = (a) => [...a].sort((x, y) => x - y)[1];
const by = Object.fromEntries(res.out.map((x) => [x.input, x]));
for (const name of ['V053', 'S2']) {
  const c = by[`wasm_${name}_circular`], f = by[`wasm_${name}_refinement`], g = by[`wasm_${name}_global`];
  console.log(JSON.stringify({ id: name, circular_s: +med(c.seconds).toFixed(3), refinement_s: +med(f.seconds).toFixed(3), global_s: +med(g.seconds).toFixed(3), ratio_global_circular: +(med(g.seconds) / med(c.seconds)).toFixed(2), fos_global: g.fos, fos_refinement: f.fos, winner: g.stats?.winner }));
}
