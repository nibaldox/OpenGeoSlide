// I-W tareas 3 y 5: axe en claro y oscuro en las vistas nuevas de F3a (Chrome, vite preview en 5186, WASM real):
// materiales no drenados (con Su variable), análisis con M-P (función «Definida por puntos», con su error), Bishop deshabilitado,
// superficie polilínea (tabla), lienzo con polilínea y resultado, Casos con polilínea y Ayuda. Debe dar 0 serious/critical.
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=<repo> TMPDIR=<scratch> node iw_h_axe.mjs  (necesita iw_b.mjs ejecutado antes: usa iw-b3.ogs.json)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launchTap, start, tab, step, summary, shot, axe, checkReport, openFile } from './lib.mjs';

const T = process.env.TMPDIR;
const REPO = process.env.OGS_REPO ?? process.cwd();
for (const scheme of ['light', 'dark']) {
  const tag = scheme === 'light' ? 'claro' : 'oscuro';
  const { browser, page } = await launchTap({ colorScheme: scheme, theme: scheme });
  await start(page);
  await openFile(page, path.join(T, 'iw-b3.ogs.json'));
  const vw = async (name, fn) => { await fn(); await page.waitForTimeout(250); await shot(page, `axe-${scheme}-${name}`); await axe(page, `${name} (${tag})`); };
  await vw('materiales-no-drenados', async () => { await tab(page, 'Materiales'); });
  await vw('superficie-polilinea', async () => { await tab(page, 'Superficie'); });
  await vw('analisis-mp', async () => { await tab(page, 'Análisis'); });
  // Función «Definida por puntos» con un error visible (ξ fuera de orden)
  await vw('analisis-mp-puntos-con-error', async () => {
    await page.getByLabel('Función de fuerzas entre dovelas f(ξ)').selectOption('data_points');
    await page.waitForSelector('[aria-label="Puntos de la función entre dovelas"]');
    await page.getByLabel('Función entre dovelas, punto 2: ξ', { exact: true }).fill('1,2');
  });
  await page.getByLabel('Función entre dovelas, punto 2: ξ', { exact: true }).press('Escape');
  await page.getByLabel('Función de fuerzas entre dovelas f(ξ)').selectOption('half_sine');
  await vw('lienzo-con-polilinea-y-resultado', async () => { await checkReport(page); await page.evaluate(() => window.scrollTo(0, 0)); });
  await vw('material-no-drenado-con-error', async () => {
    await tab(page, 'Materiales');
    const su = page.getByLabel(/^Material estrato-2: Su \(kPa\)$/);
    await su.fill('-3');
  });
  await page.getByLabel(/^Material estrato-2: Su \(kPa\)$/).press('Escape');
  await vw('ayuda', async () => { await page.getByRole('button', { name: 'Ayuda', exact: true }).click(); await page.waitForSelector('dialog[open]'); });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await vw('casos-con-polilinea', async () => {
    await page.getByRole('tab', { name: 'Casos de verificación' }).click();
    await page.locator('#mode-cases-panel input[type="file"]').setInputFiles(path.join(REPO, 'verification/pending/F3/V046a.json'));
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Comprobar caso' }).click();
    await page.locator('[data-results-table]').last().waitFor({ state: 'visible', timeout: 60000 });
  });
  step(`sin errores del motor ni de consola (${tag})`, (await page.evaluate(() => window.__errors.length)) === 0);
  await browser.close();
}
const failed = summary();
process.exit(failed ? 1 : 0);
