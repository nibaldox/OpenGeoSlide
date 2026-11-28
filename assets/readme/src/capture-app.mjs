// Captura de la app (README): talud de dos estratos con piezométrica, calculado, en tema claro u oscuro.
// Sigue el armazón A: vista Lienzo con el modelo calculado, un paso del panel abierto, el HUD desplegado,
// sin avisos de sesión y con la guía de primera visita marcada como vista.
// Uso: OGS_URL=https://nibaldox.github.io/OpenGeoSlide/ [OGS_TAB=Análisis] node capture-app.mjs <light|dark> <salida.png> [ancho] [alto]
//   OGS_URL  dirección de la app (por defecto, la publicada).
//   OGS_TAB  paso del panel que queda abierto: «Análisis» (el de las capturas del README, porque deja visibles los
//            resúmenes de los demás pasos), «Materiales», etc. Por defecto, «Materiales».
//   ancho y alto: 1280 × 930 por defecto, el tamaño de assets/readme/app-editor-{light,dark}.png.
// Requiere playwright-core y Chrome en /usr/bin/google-chrome-stable. Node resuelve el paquete desde la carpeta del script,
// así que cópialo junto a un node_modules que lo tenga (no está en el repo).
import { chromium } from 'playwright-core';
const [theme = 'light', out = 'shot.png', W = '1280', H = '930'] = process.argv.slice(2);
const URL_ = process.env.OGS_URL ?? 'https://nibaldox.github.io/OpenGeoSlide/';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, locale: 'es-CL', colorScheme: theme });
await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); localStorage.setItem('ogs.theme.v1', t); } catch {} }, theme);
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL_);
await page.waitForSelector('[data-testid="engine-banner"]', { timeout: 30000 });
await page.waitForSelector('[data-layer="regions"] polygon');
await page.waitForFunction(() => !/Cargando el motor/.test(document.body.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
const menu = async (name) => {
  const t = page.getByRole('button', { name, exact: true });
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
};
await menu('Archivo');
await page.getByRole('button', { name: 'Talud simple…' }).click();
await page.waitForSelector('dialog[open]');
await page.getByLabel('Altura H').fill('15');
await page.getByLabel('Pendiente H:V', { exact: true }).check();
await page.getByLabel(/Pendiente H:V \(horizontal/).fill('1,5');
await page.getByLabel('Nombre', { exact: true }).fill('Arcilla');
await page.getByLabel(/Peso unitario γ/).first().fill('18');
await page.getByLabel(/Cohesión c/).first().fill('25');
await page.getByLabel(/Ángulo de fricción φ/).first().fill('20');
await page.locator('dialog[open]').getByLabel('Línea piezométrica').selectOption('toe');
await page.getByLabel('Agregar un estrato inferior (material 2)').check();
await page.getByLabel('Contacto: profundidad bajo el pie').fill('5');
await page.getByLabel('Estrato inferior: nombre').fill('Roca');
await page.getByLabel(/Estrato inferior: peso unitario/).fill('24');
await page.getByLabel(/Estrato inferior: cohesión/).fill('200');
await page.getByLabel(/Estrato inferior: ángulo/).fill('40');
await page.getByRole('button', { name: 'Crear talud' }).click();
const dlg = page.locator('[data-testid="confirm-dialog"]');
try { await dlg.waitFor({ state: 'visible', timeout: 1500 }); await dlg.getByRole('button', { name: 'Descartar cambios', exact: true }).click(); await dlg.waitFor({ state: 'detached' }); } catch {}
await page.waitForSelector('dialog[open]', { state: 'detached' });
await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length === 2);
await page.getByRole('button', { name: 'Comprobar', exact: true }).first().click();
// Armazón A: el resultado se espera en el HUD (la tabla vive en la vista Resultados).
await page.waitForSelector('[data-testid="result-summary"][data-state="current"]', { timeout: 90000 });
await page.waitForSelector('button:has-text("Comprobar"):not([disabled])', { timeout: 90000 });
// Sin avisos de sesión: cierra los avisos visibles con su botón «Cerrar».
for (let i = 0; i < 6; i++) {
  const b = page.locator('button:visible', { hasText: /^Cerrar$/ }).first();
  if (!(await b.count())) break;
  await b.click();
  await page.waitForTimeout(150);
}
await page.getByRole('tab', { name: process.env.OGS_TAB ?? 'Materiales', exact: true }).click();
await page.mouse.move(5, 5);
await page.waitForTimeout(800);
console.log('HUD:', (await page.locator('[data-testid="result-summary"]').first().innerText()).replace(/\n/g, ' | '), errs);
await page.screenshot({ path: out });
await browser.close();
