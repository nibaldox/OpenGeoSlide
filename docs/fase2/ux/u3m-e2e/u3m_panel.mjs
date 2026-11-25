// U3-M: panel Geometría en Chrome (puerto 5186): tabla de vértices editable, validación en línea, agregar/eliminar, eliminar región,
// paginación con 360 vértices y navegación desde Diagnósticos.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SHOTS = path.join(process.env.TMPDIR, 'u3x-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
let failed = 0;
const errors = [];
const step = (name, ok, data = {}) => { if (!ok) failed += 1; console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data)); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const dialogs = [];
page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) errors.push(m.text()); });
async function openMenu(name) {
  const trigger = page.getByRole('button', { name, exact: true });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  await page.waitForFunction((n) => [...document.querySelectorAll('button.dd-trigger')].some((b) => b.textContent.trim().startsWith(n) && b.getAttribute('aria-expanded') === 'true'), name);
}
const nRegions = () => page.locator('[data-layer="regions"] polygon').count();
const rowsCount = () => page.locator('[data-vertex-row]').count();
const field = (r, v, a) => page.locator(`[data-path="/regions/${r}/polygon/${v}/${a}"]`);
const label = (r, v) => page.locator(`[data-handle-key="v-${r}-${v}"]`).getAttribute('aria-label');

await page.goto(URL_);
await page.waitForSelector('[data-layer="regions"] polygon');
await openMenu('Archivo');
await page.getByRole('button', { name: 'Talud simple…' }).click();
await page.waitForSelector('dialog[open]');
await page.getByRole('button', { name: 'Crear talud' }).click();
await page.waitForSelector('dialog[open]', { state: 'detached' });
await page.waitForSelector('[data-vertex-row]');
step('1 el panel Geometría es la primera pestaña y muestra la región con 6 vértices', (await page.locator('[aria-label="Paneles del modelo"] [role="tab"]').first().textContent()) === 'Geometría' && (await rowsCount()) === 6, { tabs: await page.locator('[aria-label="Paneles del modelo"] [role="tab"]').allTextContents() });

// 2. Editar una coordenada (un paso de historial)
const l0 = await label(0, 4);
await field(0, 4, 'x').fill('12,5');
await field(0, 4, 'x').press('Enter');
const l1 = await label(0, 4);
const pastOne = await page.getByRole('button', { name: 'Deshacer', exact: true }).isEnabled();
step('2 editar x de un vértice en la tabla lo mueve en el lienzo', l0 !== l1 && /x 12,5 m/.test(l1), { antes: l0, despues: l1, pastOne });
await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
step('2b un Deshacer la devuelve (y no queda historial)', (await label(0, 4)) === l0 && (await page.getByRole('button', { name: 'Deshacer', exact: true }).isDisabled()));

// 3. Validación en línea
await field(0, 4, 'y').fill('abc');
const invalid = await field(0, 4, 'y').getAttribute('aria-invalid');
const msg = await page.locator('.gp-error-row .ep-error').first().textContent();
const roleBefore = await page.locator('.gp-error-row .ep-error').first().getAttribute('role');
await field(0, 4, 'y').press('Enter');
const roleAfter = await page.locator('.gp-error-row .ep-error').first().getAttribute('role');
step('3 texto no numérico: error en línea (alert solo al confirmar) y no se aplica', invalid === 'true' && /debe ser un número/.test(msg) && roleBefore === null && roleAfter === 'alert' && (await label(0, 4)) === l0, { msg, roleBefore, roleAfter });
await field(0, 4, 'y').press('Escape');

// 4. Agregar después / Eliminar (foco)
await page.getByRole('button', { name: 'Agregar después del vértice 2 de la región 1' }).click();
await page.waitForFunction(() => document.querySelectorAll('[data-vertex-row]').length === 7);
await page.waitForFunction(() => document.activeElement?.getAttribute('data-path') === '/regions/0/polygon/2/x').catch(() => {});
const focusAdd = await page.evaluate(() => document.activeElement?.getAttribute('data-path'));
step('4 «Agregar después» inserta en el punto medio y el foco va a su x', focusAdd === '/regions/0/polygon/2/x', { foco: focusAdd, vertice: await label(0, 2) });
await page.getByRole('button', { name: 'Eliminar el vértice 3 de la región 1' }).click();
await page.waitForFunction(() => document.querySelectorAll('[data-vertex-row]').length === 6);
await page.waitForFunction(() => document.activeElement?.getAttribute('data-path') === '/regions/0/polygon/1/x').catch(() => {});
const focusDel = await page.evaluate(() => document.activeElement?.getAttribute('data-path'));
step('4b «Eliminar» quita el vértice y el foco pasa al anterior', focusDel === '/regions/0/polygon/1/x', { foco: focusDel });
// mínimo de 3 vértices
const poly = [[0, 0], [10, 0], [5, 8]];
const small = { format: 'opengeoslide', version: '0.2', meta: { id: 's', title: 's' }, units: 'SI', materials: [{ id: 'a', name: 'A', model: 'mohr_coulomb', unit_weight: 18, cohesion: 5, friction_angle: 30 }], regions: [{ material: 'a', polygon: poly }], slope: { direction: 'auto' }, analysis: { methods: ['bishop'], search: { type: 'circular_entry_exit', entry: null, exit: null } } };
writeFileSync(path.join(SHOTS, 'tri.ogs.json'), JSON.stringify(small));

// 5. Eliminar región con confirmación, deshacer
await page.getByRole('button', { name: 'Eliminar región 1' }).click();
await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length === 0);
const confirmText = dialogs.at(-1);
const emptyMsg = await page.locator('[data-testid="geometry-empty"]').count();
await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
step('5 «Eliminar región» pide confirmación y se deshace', /¿Eliminar la región 1/.test(confirmText ?? '') && emptyMsg === 1 && (await nRegions()) === 1, { confirmText });

// 6. Mínimo de 3 vértices
await page.setInputFiles('[data-testid="file-open"]', path.join(SHOTS, 'tri.ogs.json'));
await page.waitForFunction(() => document.querySelectorAll('[data-vertex-row]').length === 3);
const disabledDel = await page.getByRole('button', { name: /Eliminar el vértice 1 de la región 1/ }).isDisabled();
step('6 con 3 vértices «Eliminar» está deshabilitado', disabledDel);

// 7. 360 vértices: paginación
const big = [];
for (let i = 0; i < 360; i += 1) { const a = (i / 360) * 2 * Math.PI; big.push([Math.round(Math.cos(a) * 5000) / 100, Math.round(Math.sin(a) * 5000) / 100]); }
writeFileSync(path.join(SHOTS, 'big.ogs.json'), JSON.stringify({ ...small, regions: [{ material: 'a', polygon: big }] }));
await page.setInputFiles('[data-testid="file-open"]', path.join(SHOTS, 'big.ogs.json'));
await page.waitForSelector('[data-vertex-row]');
const t0 = Date.now();
const firstPage = await rowsCount();
const pager = (await page.locator('.gp-pager').textContent()).trim();
await page.getByRole('button', { name: 'Siguiente' }).click();
await page.waitForFunction(() => document.querySelector('[data-vertex-row]')?.getAttribute('data-vertex-row') === '100');
const t1 = Date.now() - t0;
const second = await page.locator('[data-vertex-row]').first().getAttribute('data-vertex-row');
// el vértice 250 elegido con el teclado en el lienzo lleva a su página
await page.locator('[data-handle-key="v-0-250"]').focus();
await page.waitForFunction(() => document.querySelector('[data-vertex-row]')?.getAttribute('data-vertex-row') === '200');
const rowSel = await page.locator('tr[aria-current="true"]').getAttribute('data-vertex-row');
step('7 360 vértices: 100 filas por página, «Siguiente» y salto al vértice elegido en el lienzo', firstPage === 100 && /1 a 100 de 360/.test(pager) && second === '100' && rowSel === '250', { filas: firstPage, pager, segundaPagina: second, filaSeleccionada: rowSel, msPagina: t1 });
await page.screenshot({ path: path.join(SHOTS, 'u3m-panel-360.png') });

// 8. Diagnósticos → Geometría
await openMenu('Archivo');
await page.getByRole('button', { name: 'Talud simple…' }).click();
await page.waitForSelector('dialog[open]');
await page.getByRole('button', { name: 'Crear talud' }).click();
await page.waitForSelector('dialog[open]', { state: 'detached' });
await page.waitForSelector('[data-vertex-row]');
await field(0, 4, 'x').fill('45'); await field(0, 4, 'x').press('Enter');
await field(0, 4, 'y').fill('-5'); await field(0, 4, 'y').press('Enter');
await page.waitForSelector('.gp-issues');
const issueText = await page.locator('.gp-issues').textContent();
await page.getByRole('tab', { name: 'Materiales' }).click();
const issueBtn = page.locator('section:has(h2:text("Diagnósticos")) button', { hasText: /cruza/ }).first();
await issueBtn.click();
await page.waitForTimeout(300);
const tabSel = await page.locator('[aria-label="Paneles del modelo"] [role="tab"][aria-selected="true"]').textContent();
const focusPath = await page.evaluate(() => document.activeElement?.getAttribute('data-path'));
step('8 la incidencia de la región se ve en el panel y desde Diagnósticos lleva a Geometría con el foco en el campo', /se cruza/.test(issueText) && tabSel === 'Geometría' && /^\/regions\/0\/polygon\/\d+\/x$/.test(focusPath ?? ''), { issueText: issueText.trim().slice(0, 160), tabSel, focusPath });
await page.screenshot({ path: path.join(SHOTS, 'u3m-panel-incidencia.png') });

step('9 sin errores de consola', errors.length === 0, { errors });
await browser.close();
process.exit(failed === 0 ? 0 : 1);
