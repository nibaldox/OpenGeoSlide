// C-W (F3A-C), tarea 2: pasar de círculo a polilínea y calcular de inmediato con Spencer y M-P converge (Chrome, WASM real, puerto 5186).
// La propuesta de polilínea es admisible por construcción: antes, la cuerda del círculo crítico pasaba sobre el vértice del pie y el motor daba
// `polyline_outside_ground`. Modelos: «Talud simple…» con y sin estrato inferior, V047a y V040 (dique con berma), cada uno con su círculo crítico
// fijo. Compara cada FS con `ogs analyze` del mismo archivo guardado (1e-9).
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=<repo> TMPDIR=<scratch> node iw_polilinea_inicial.mjs
import { launchTap, start, tab, step, summary, shot, checkReport, compare, cli, saveText, openMenu } from './lib.mjs';

const { browser, page } = await launchTap();
await start(page);
const confirm = async () => {
  const dlg = page.locator('[data-testid="confirm-dialog"]');
  try { await dlg.waitFor({ state: 'visible', timeout: 1200 }); await dlg.getByRole('button', { name: 'Descartar cambios', exact: true }).click(); } catch {}
};
const talud = async (estrato) => {
  await openMenu(page, 'Archivo');
  await page.getByRole('button', { name: 'Talud simple…' }).click();
  await page.waitForSelector('dialog[open]');
  const box = page.getByLabel('Agregar un estrato inferior (material 2)');
  if (estrato) { await box.check(); await page.getByLabel('Contacto: profundidad bajo el pie (m)').fill('3'); } else if (await box.isChecked()) await box.uncheck();
  await page.getByRole('button', { name: 'Crear talud' }).click();
  await confirm();
  await page.waitForSelector('dialog[open]', { state: 'detached' });
  await tab(page, 'Geometría');
  await page.waitForSelector('[data-vertex-row]');
};
const caso = async (id) => {
  await openMenu(page, 'Archivo');
  await page.locator('select[aria-label="Abrir un caso publicado como modelo"]').selectOption({ value: `../../../verification/cases/${id}.json` });
  await confirm();
  await page.waitForTimeout(500);
  await tab(page, 'Geometría');
  await page.waitForSelector('[data-vertex-row]');
};

const escenarios = [
  ['Talud simple sin estrato', () => talud(false)],
  ['Talud simple con estrato inferior', () => talud(true)],
  ['V047a (ACADS 1(a))', () => caso('V047a')],
  ['V040 (dique con berma)', () => caso('V040')],
];
let n = 0;
for (const [nombre, abrir] of escenarios) {
  n += 1;
  await abrir();
  // Círculo crítico de la búsqueda (CLI sobre el mismo archivo) como superficie fija, luego a polilínea.
  const s0 = await saveText(page, `cw-pi-${n}-0.ogs.json`);
  const c0 = cli(s0.path);
  const circ = c0.results.map((r) => r.surface).find((s) => s && 'xc' in s);
  step(`${nombre}: la CLI da un círculo crítico de partida`, c0.code === 0 && !!circ, { code: c0.code, out: c0.out.slice(0, 120) });
  if (!circ) continue;
  await tab(page, 'Superficie');
  await page.getByRole('radio', { name: 'Fija', exact: true }).check();
  for (const [k, v] of [['xc', circ.xc], ['yc', circ.yc], ['r', circ.r]]) await page.locator(`[data-path="/analysis/surface/${k}"]`).fill(String(v).replace('.', ','));
  await page.locator('[data-path="/analysis/surface/r"]').press('Enter');
  await page.getByRole('radio', { name: 'Polilínea', exact: true }).check();
  await page.waitForSelector('[aria-label="Puntos de la polilínea de falla"]');
  await tab(page, 'Análisis');
  const mp = page.getByRole('checkbox', { name: 'Morgenstern-Price', exact: true });
  if (!(await mp.isChecked())) await mp.check();
  const sp = page.getByRole('checkbox', { name: 'Spencer', exact: true });
  if (!(await sp.isChecked())) await sp.check();
  // Calcular de inmediato, sin editar la polilínea propuesta.
  const s1 = await saveText(page, `cw-pi-${n}-1.ogs.json`);
  const d1 = JSON.parse(s1.text);
  const pts = d1.analysis.surface.points;
  step(`${nombre}: pasar a polilínea guarda una propuesta de ≥ 5 puntos con x creciente (0.3)`, d1.version === '0.3' && d1.analysis.surface.type === 'polyline' && pts.length >= 5 && pts.every((p, i) => i === 0 || p[0] > pts[i - 1][0]), { n: pts.length, version: d1.version });
  const rep = await checkReport(page);
  const cmp = compare(rep, cli(s1.path).results);
  for (const m of ['spencer', 'morgenstern_price']) {
    const r = (rep.results ?? []).find((x) => x.method === m);
    step(`${nombre}: ${m} converge de inmediato con la polilínea propuesta`, r?.status === 'converged' && r.fos > 0, { error: rep.error, status: r?.status, fos: r?.fos, warnings: r?.warnings });
  }
  for (const r of cmp) step(`${nombre}: ${r.method} web = CLI (1e-9, ${r.status})`, r.same && r.web !== null, r);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, `cw-pi-${n}`);
}
const failed = summary();
await browser.close();
process.exit(failed ? 1 : 0);
