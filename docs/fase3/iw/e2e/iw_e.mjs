// I-W tarea 1e (Chrome, vite preview en 5186, WASM real): un caso con polilínea en la vista Casos, con la superficie ajustada y las dovelas
// dibujadas por el motor real, en claro y en oscuro, con axe.
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=<repo> TMPDIR=<scratch> node iw_e.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { launchTap, start, step, summary, shot, axe, cli } from './lib.mjs';

const REPO = process.env.OGS_REPO ?? process.cwd();
const T = process.env.TMPDIR;
for (const scheme of ['light', 'dark']) {
  const { browser, page } = await launchTap({ colorScheme: scheme, theme: scheme });
  await start(page);
  const tag = scheme === 'light' ? '' : ' (oscuro)';
  await page.getByRole('tab', { name: 'Casos de verificación' }).click();
  await page.waitForSelector('#mode-cases-panel');
  // Caso: V046a de pending/F3 (con sus comprobaciones publicadas), cargado por el camino de importación de Casos.
  const f = path.join(REPO, 'verification/pending/F3/V046a.json');
  await page.locator('#mode-cases-panel input[type="file"]').setInputFiles(f);
  await page.waitForTimeout(600);
  const bishop = page.locator('#mode-cases-panel').getByRole('checkbox', { name: 'Bishop simplificado' });
  step(`1e${tag} Casos: con polilínea fija Bishop queda deshabilitado, con su explicación`, (await bishop.isDisabled()) && (await page.locator('#cases-bishop-note').isVisible()));
  for (const m of ['Morgenstern-Price', 'Janbu corregido']) await page.locator('#mode-cases-panel').getByRole('checkbox', { name: m, exact: true }).check();
  const n0 = await page.evaluate(() => window.__reports.length);
  await page.getByRole('button', { name: 'Comprobar caso' }).click();
  await page.waitForSelector('[data-results-table]', { timeout: 60000 });
  await page.waitForTimeout(600);
  // Casos envía un `analyze` por método: se reúnen todos los informes nuevos.
  const all = await page.evaluate((n) => window.__reports.slice(n).flatMap((x) => JSON.parse(x).results), n0);
  const rep = { results: [...new Map(all.map((r) => [r.method, r])).values()] }; // el último informe de cada método
  const model = JSON.parse(readFileSync(f, 'utf8')).model;
  model.analysis.methods = rep.results.map((r) => r.method);
  const mf = path.join(T, 'iw-1e-modelo.ogs.json'); writeFileSync(mf, JSON.stringify(model));
  const c = cli(mf);
  step(`1e${tag} Casos: el motor real calculó los 3 métodos marcados y coincide con la CLI (bit a bit)`, rep.results.length === 3 && rep.results.every((r) => { const k = c.results.find((x) => x.method === r.method); return k && r.fos === k.fos && r.status === k.status; }), { web: rep.results.map((r) => [r.method, r.fos]), cli: c.results.map((r) => [r.method, r.fos]), code: c.code });
  const nPts = rep.results[0].surface.points.length;
  const legend = (await page.locator('ul.legend').allInnerTexts()).join(' | ');
  step(`1e${tag} Casos: la leyenda dice «Superficie fija (polilínea)»`, /Superficie fija \(polilínea\)/.test(legend), { legend });
  const table = await page.locator('[data-results-table]').innerText();
  step(`1e${tag} Casos: la tabla dice «Polilínea (${nPts} puntos)», la función y f₀`, new RegExp(`Polilínea \\(${nPts} puntos\\)`).test(table) && /Función: /.test(table) && /f₀ = /.test(table), { table: table.slice(0, 260) });
  // El <canvas> 2D: píxeles del color de la superficie (tokens: rojo en claro; en oscuro el token cambia: se cuenta el color dominante de la polilínea).
  const px = await page.evaluate(() => {
    const probe = document.createElement('i'); probe.style.color = 'var(--canvas-surface)'; document.body.appendChild(probe);
    const [r0, g0, b0] = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number); probe.remove();
    const cv = document.querySelector('canvas'); const g = cv.getContext('2d'); const d = g.getImageData(0, 0, cv.width, cv.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) < 60) n++;
    return { w: cv.width, h: cv.height, token: [r0, g0, b0], n };
  });
  step(`1e${tag} Casos: el lienzo 2D dibuja la polilínea (píxeles del color --canvas-surface)`, px.n > 150, px);
  await page.locator('canvas').first().scrollIntoViewIfNeeded();
  await shot(page, `e-casos-${scheme}`);
  await axe(page, `Casos con polilínea y motor real${tag}`);
  step(`1e${tag} sin errores de consola`, (await page.evaluate(() => window.__errors.length)) === 0);
  await browser.close();
}
const failed = summary();
process.exit(failed ? 1 : 0);
