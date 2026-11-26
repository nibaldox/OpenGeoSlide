// Sonda de C-W: ¿se cierra el menú Archivo si se abre con el foco en una tabla con un borrador inválido (paso 8e de w1e_polilinea)?
import { launch, start, newSlope, tab, openMenu } from './lib.mjs';
const { browser, page } = await launch();
await start(page);
await newSlope(page);
await tab(page, 'Superficie');
await page.getByRole('radio', { name: 'Fija', exact: true }).check();
await page.getByRole('radio', { name: 'Polilínea', exact: true }).check();
await tab(page, 'Análisis');
await page.getByRole('checkbox', { name: 'Morgenstern-Price', exact: true }).check();
await page.getByLabel('Función de fuerzas entre dovelas f(ξ)').selectOption('data_points');
await page.waitForSelector('[aria-label="Puntos de la función entre dovelas"]');
const f = page.getByLabel('Función entre dovelas, punto 2: ξ', { exact: true });
for (let k = 0; k < 12; k += 1) {
  await f.fill('1,2');
  await f.press('Enter');
  const act = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName);
  await openMenu(page, 'Archivo');
  const t0 = Date.now();
  let seen = [];
  for (let i = 0; i < 8; i += 1) {
    await page.waitForTimeout(100);
    seen.push(await page.evaluate(() => [document.querySelector('button.dd-trigger[aria-expanded="true"]') !== null, [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Guardar' && b.offsetParent !== null), document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.slice(0, 20)].join('|')));
  }
  console.log(k, 'foco antes:', act, seen.join(' ; '));
  await page.keyboard.press('Escape');
  await f.fill('0,5'); await f.press('Enter');
}
await browser.close();
