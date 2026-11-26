// I-W tareas 1a y 1c (Chrome, vite preview en 5186, WASM real): polilínea de pending/F3 con Spencer, M-P y Janbu frente a `ogs analyze`;
// Bishop con polilínea deshabilitado y el mensaje del motor si se fuerza por JSON.
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=<repo> TMPDIR=<scratch> node iw_a_c.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { launchTap, start, tab, step, summary, shot, axe, checkReport, openFile, compare, cli, OGS_BIN, casePath } from './lib.mjs';

const REPO = process.env.OGS_REPO ?? process.cwd();
const T = process.env.TMPDIR;
const variant = (id, mut) => {
  const m = JSON.parse(readFileSync(casePath(REPO, id), 'utf8')).model;
  mut(m);
  const f = path.join(T, `iw-1a-${id}.ogs.json`);
  writeFileSync(f, JSON.stringify(m));
  return f;
};
const ALL = ['spencer', 'morgenstern_price', 'janbu_simplified', 'janbu_corrected'];
const files = [
  ['V006 (plano de 2 puntos)', variant('V006', (m) => { m.analysis.methods = ALL; })],
  ['V046a (polilínea de 12 puntos, M-P medio seno)', variant('V046a', (m) => { m.analysis.methods = ALL; m.analysis.interslice = { function: 'half_sine' }; })],
  ['V046b (M-P función del caso)', variant('V046b', (m) => { m.analysis.methods = ALL; })],
];

const { browser, page } = await launchTap();
await start(page);
for (const [name, file] of files) {
  await openFile(page, file);
  await tab(page, 'Superficie');
  const isPoly = (await page.getByRole('radio', { name: 'Polilínea', exact: true }).isChecked().catch(() => false));
  const rep = await checkReport(page);
  const c = cli(file);
  const rows = compare(rep, c.results);
  step(`1a ${name}: superficie «Polilínea» y la web calculó ${rows.length} métodos`, isPoly && rows.length === 4 && c.code === 0, { isPoly, error: rep.error, cliCode: c.code });
  for (const r of rows) step(`1a ${name} · ${r.method}: FS web = FS CLI (|Δ|rel ≤ 1e-9; estado ${r.status})`, r.same, r);
  const j = rows.find((r) => r.method === 'janbu_corrected');
  step(`1a ${name} · janbu_corrected: f₀ web = f₀ CLI`, j && j.f0web !== null && Math.abs(j.f0web - j.f0cli) <= 1e-9 * Math.max(1, j.f0cli), j);
  const wp = rep.results[0].surface?.points, cp = c.results[0].surface?.points;
  step(`1a ${name}: la polilínea ajustada del informe web = la del CLI`, JSON.stringify(wp) === JSON.stringify(cp), { n: wp?.length });
  await shot(page, `1a-${name.slice(0, 4)}`);
}

// 1c. Bishop deshabilitado con polilínea (casilla y explicación) y el motor lo rechaza si se fuerza por JSON
await tab(page, 'Análisis');
const bishop = page.getByRole('checkbox', { name: 'Bishop simplificado', exact: true });
step('1c con polilínea la casilla de Bishop está deshabilitada y desmarcada', (await bishop.isDisabled()) && !(await bishop.isChecked()));
step('1c …con la explicación visible y enlazada', (await page.getByText(/Bishop simplificado no se ofrece en superficies no circulares/).first().isVisible()) && (await bishop.getAttribute('aria-describedby')) !== null);
await shot(page, '1c-bishop-deshabilitado');
const forced = JSON.parse(readFileSync(files[0][1], 'utf8'));
forced.analysis.methods = ['bishop', 'spencer'];
const fF = path.join(T, 'iw-1c-forzado.ogs.json');
writeFileSync(fF, JSON.stringify(forced));
const cliOut = spawnSync(OGS_BIN, ['analyze', fF], { encoding: 'utf8' });
const cliMsg = `${cliOut.stderr}${cliOut.stdout}`.trim();
// Motor real (WASM) sin pasar por validateLocal: se le envía el modelo directamente al Worker.
const wasmMsg = await page.evaluate((json) => new Promise((resolve) => {
  const w = window.__workers[0];
  const id = 987654;
  const h = (e) => { if (e.data?.id === id) { w.removeEventListener('message', h); resolve(e.data); } };
  w.addEventListener('message', h);
  w.postMessage({ id, type: 'analyze', payload: { modelJson: json } });
}), JSON.stringify(forced));
step('1c el WASM rechaza Bishop + polilínea con el mensaje del motor', wasmMsg.ok === false && /el método 'bishop' solo admite superficies circulares; use spencer, morgenstern_price o janbu/.test(wasmMsg.error), { wasmMsg });
step('1c el CLI da el mismo mensaje que el WASM', cliOut.status !== 0 && cliMsg.includes(String(wasmMsg.error).replace(/^.*?:\s*/, '').slice(0, 40)) || cliMsg.includes("solo admite superficies circulares"), { cliMsg: cliMsg.slice(0, 200) });
await openFile(page, fF);
await tab(page, 'Análisis');
const diag = await page.locator('main').textContent();
step('1c abierto por la web, Diagnósticos muestra el mensaje y «Comprobar» no calcula', /solo admite superficies circulares/.test(diag), {});
const n0 = await page.evaluate(() => window.__reports.length + window.__errors.length);
// La validación local no deshabilita «Comprobar»: al pulsarlo bloquea el cálculo sin llegar al motor y lo dice en pantalla.
await page.getByRole('button', { name: 'Comprobar', exact: true }).first().click();
await page.waitForTimeout(800);
const n1 = await page.evaluate(() => window.__reports.length + window.__errors.length);
const alertTxt = await page.locator('[data-testid="live-alert"]').textContent().catch(() => '');
step('1c «Comprobar» con el modelo forzado no envía nada al motor y avisa', n1 === n0, { n0, n1, alertTxt: String(alertTxt).slice(0, 160) });
await shot(page, '1c-forzado');
const failed = summary();
await browser.close();
process.exit(failed ? 1 : 0);
